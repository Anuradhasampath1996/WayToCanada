<?php

namespace App\Http\Controllers;

use App\Contracts\StripePlatformClient;
use App\Models\Academy\AcademyCourse;
use App\Models\LearningCoursePayment;
use App\Models\Lms\LmsCourse;
use App\Services\Academy\AcademyAccess;
use App\Services\CanadianBillingTaxService;
use App\Services\GstHstRatesService;
use App\Services\GstHstStripeTaxService;
use App\Services\Stripe\LiveStripePlatformClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearningCourseCheckoutController extends Controller
{
    /** @return array<string, string> */
    private function billingRules(bool $requireCourse = true): array
    {
        $rules = [
            'product_domain' => 'required|in:rcic_academy,client_lms,consultant_lms',
            'billing_country' => 'required|string|max:100',
            'billing_address_line1' => 'required|string|max:255',
            'billing_address_line2' => 'nullable|string|max:255',
            'billing_city' => 'required|string|max:100',
            'billing_province' => 'nullable|string|max:100',
            'billing_postal_code' => 'nullable|string|max:20',
            'province' => 'nullable|string|max:100',
        ];
        if ($requireCourse) {
            $rules['course_id'] = 'required|integer';
        }

        return $rules;
    }

    public function taxQuote(Request $request, CanadianBillingTaxService $taxService): JsonResponse
    {
        $data = $request->validate($this->billingRules());
        [$course] = $this->resolvePurchasableCourse($request, $data);
        $subtotal = round(((int) $course->price_cents) / 100, 2);

        try {
            $billingAddress = $taxService->validateBillingAddress($data);
            $tax = $taxService->quote($subtotal, $billingAddress);

            return response()->json([
                'billing_address' => $billingAddress,
                'tax' => $tax,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function store(Request $request, StripePlatformClient $stripe, AcademyAccess $access, CanadianBillingTaxService $taxService): JsonResponse
    {
        $data = $request->validate($this->billingRules());
        $user = $request->user();
        [$course, $productDomain] = $this->resolvePurchasableCourse($request, $data, $access);

        $months = (int) ($course->access_months ?: config('learning.default_access_months', 3));
        if ($productDomain === 'rcic_academy') {
            $base = rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');
            $success = $base.'/dashboard/academy/courses?checkout=return&session_id={CHECKOUT_SESSION_ID}';
            $cancel = $base.'/dashboard/academy/courses?checkout=cancelled';
        } elseif ($productDomain === 'consultant_lms') {
            $base = rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');
            $success = $base.'/dashboard/lms/'.$course->id.'?checkout=return&session_id={CHECKOUT_SESSION_ID}';
            $cancel = $base.'/dashboard/lms/'.$course->id.'?checkout=cancelled';
        } else {
            $base = rtrim((string) env('CLIENT_DASHBOARD_URL', env('PUBLIC_DASHBOARD_URL', 'http://localhost:3000')), '/');
            $success = $base.'/user-dashboard/learning?checkout=return&session_id={CHECKOUT_SESSION_ID}';
            $cancel = $base.'/user-dashboard/learning?checkout=cancelled';
        }

        try {
            $billingAddress = $taxService->validateBillingAddress($data);
            $subtotal = round(((int) $course->price_cents) / 100, 2);
            $taxBreakdown = $taxService->quote($subtotal, $billingAddress);

            $taxRateIds = null;
            $provinceCode = $billingAddress['province'] ?? null;
            if ($taxBreakdown['tax_applicable'] && $provinceCode && $stripe instanceof LiveStripePlatformClient) {
                $taxRateIds = (new GstHstStripeTaxService(new GstHstRatesService()))->ensureTaxRates($provinceCode);
            }

            $user->fill([
                'company_address_line1' => $billingAddress['line1'],
                'company_address_line2' => $billingAddress['line2'] ?: null,
                'company_city' => $billingAddress['city'],
                'company_province' => $billingAddress['province'] ?? null,
                'company_postal_code' => $billingAddress['postal_code'] ?: null,
                'company_country' => $billingAddress['country'],
            ])->save();

            $lineItem = [
                'price_data' => [
                    'currency' => strtolower((string) ($course->currency ?? 'cad')),
                    'product_data' => ['name' => $course->title],
                    'unit_amount' => (int) $course->price_cents,
                    'tax_behavior' => 'exclusive',
                ],
                'quantity' => 1,
            ];
            if ($taxRateIds) {
                $lineItem['tax_rates'] = $taxRateIds;
            }

            $sessionParams = [
                'mode' => 'payment',
                'success_url' => $success,
                'cancel_url' => $cancel,
                'client_reference_id' => (string) $user->id,
                'customer_email' => $user->email,
                'line_items' => [$lineItem],
                'metadata' => [
                    'type' => 'learning_course',
                    'product_domain' => $productDomain,
                    'course_id' => (string) $course->id,
                    'learner_user_id' => (string) $user->id,
                    'access_months' => (string) $months,
                    'province' => (string) ($provinceCode ?? ''),
                    'billing_country' => (string) $billingAddress['country'],
                ],
            ];

            $session = $stripe->createCheckoutSession($sessionParams);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        LearningCoursePayment::query()->create([
            'learner_user_id' => $user->id,
            'product_domain' => $productDomain,
            'course_id' => $course->id,
            'amount_cents' => (int) $course->price_cents,
            'currency' => strtoupper((string) ($course->currency ?? 'CAD')),
            'status' => 'pending',
            'stripe_checkout_session_id' => $session->id,
            'access_months' => $months,
            'metadata_json' => [
                'billing_address' => $billingAddress,
                'tax' => $taxBreakdown,
            ],
        ]);

        return response()->json([
            'id' => $session->id,
            'url' => $session->url,
            'billing_address' => $billingAddress,
            'tax' => $taxBreakdown,
        ]);
    }

    public function verify(Request $request, StripePlatformClient $stripe): JsonResponse
    {
        $data = $request->validate([
            'session_id' => ['required', 'string'],
        ]);

        $session = $stripe->retrieveCheckoutSession($data['session_id']);
        $fulfillment = app(\App\Services\StripePaymentFulfillmentService::class);
        $result = $fulfillment->fulfillCheckoutSession($session);

        $metadata = $fulfillment->sessionMetadata($session);
        $userId = (int) $request->user()->id;
        $courseId = (int) ($metadata['course_id'] ?? 0);
        $domain = (string) ($metadata['product_domain'] ?? '');

        if ((int) ($metadata['learner_user_id'] ?? 0) !== $userId) {
            abort(403);
        }

        $assignment = null;
        if (in_array($domain, ['client_lms', 'consultant_lms'], true) && $courseId > 0) {
            $assignment = \App\Models\Lms\LmsCourseAssignment::query()
                ->where('client_user_id', $userId)
                ->where('course_id', $courseId)
                ->where('status', '!=', 'expired')
                ->first();
        }

        $paid = in_array(($session->payment_status ?? ''), ['paid', 'no_payment_required'], true)
            || ($session->status ?? '') === 'complete';

        if ($paid && ! $assignment && in_array($domain, ['client_lms', 'consultant_lms'], true)) {
            return response()->json([
                'message' => 'Payment received but course access could not be activated. Please contact support.',
                'data' => [
                    'paid' => true,
                    'product_domain' => $domain,
                    'course_id' => $courseId,
                    'assignment_id' => null,
                    'fulfillment' => $result,
                ],
            ], 422);
        }

        return response()->json([
            'data' => [
                'paid' => $paid,
                'product_domain' => $domain,
                'course_id' => $courseId,
                'assignment_id' => $assignment?->id,
                'fulfillment' => $result,
            ],
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: AcademyCourse|LmsCourse, 1: string}
     */
    private function resolvePurchasableCourse(Request $request, array $data, ?AcademyAccess $access = null): array
    {
        $user = $request->user();
        $productDomain = (string) $data['product_domain'];

        if ($productDomain === 'rcic_academy') {
            $access ??= app(AcademyAccess::class);
            $access->assertLearner($user);
            $course = AcademyCourse::query()->findOrFail($data['course_id']);
            if (! $course->isPublished() || ! $course->commerce_confirmed || ! $course->price_cents) {
                throw new \Illuminate\Http\Exceptions\HttpResponseException(
                    response()->json(['message' => 'Course is not available for purchase.'], 422)
                );
            }
            if ($course->access_tier !== 'purchase') {
                throw new \Illuminate\Http\Exceptions\HttpResponseException(
                    response()->json(['message' => 'This course is not a one-time purchase product.'], 422)
                );
            }

            return [$course, $productDomain];
        }

        if ($productDomain === 'consultant_lms') {
            if (! $user->hasAnyRole(['rcic', 'staff', 'admin', 'super-admin'])) {
                abort(403, 'Only consultants can purchase this course.');
            }
            $course = LmsCourse::query()->findOrFail($data['course_id']);
            if (! $course->is_published || ($course->audience ?? 'client') !== 'consultant') {
                throw new \Illuminate\Http\Exceptions\HttpResponseException(
                    response()->json(['message' => 'Course is not available for purchase.'], 422)
                );
            }
            if (! $course->price_cents || (int) $course->price_cents < 1) {
                throw new \Illuminate\Http\Exceptions\HttpResponseException(
                    response()->json(['message' => 'Course is not available for purchase.'], 422)
                );
            }

            return [$course, $productDomain];
        }

        if (! $user->hasRole('client')) {
            abort(404);
        }
        $course = LmsCourse::query()->findOrFail($data['course_id']);
        if (! $course->is_published || ($course->audience ?? 'client') === 'consultant' || ! $course->commerce_confirmed || ! $course->price_cents) {
            throw new \Illuminate\Http\Exceptions\HttpResponseException(
                response()->json(['message' => 'Course is not available for purchase.'], 422)
            );
        }
        if (! in_array($course->access_mode, ['self_purchase', 'assigned_or_purchase', 'free', null], true)) {
            throw new \Illuminate\Http\Exceptions\HttpResponseException(
                response()->json(['message' => 'This course is not available for self-purchase.'], 422)
            );
        }

        return [$course, $productDomain];
    }
}
