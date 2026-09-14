<?php

namespace App\Http\Controllers;

use App\Contracts\StripePlatformClient;
use App\Models\Academy\AcademyCourse;
use App\Models\LearningCoursePayment;
use App\Models\Lms\LmsCourse;
use App\Services\Academy\AcademyAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LearningCourseCheckoutController extends Controller
{
    public function store(Request $request, StripePlatformClient $stripe, AcademyAccess $access): JsonResponse
    {
        $data = $request->validate([
            'product_domain' => 'required|in:rcic_academy,client_lms',
            'course_id' => 'required|integer',
        ]);
        $user = $request->user();
        if ($data['product_domain'] === 'rcic_academy') {
            $access->assertLearner($user);
            $course = AcademyCourse::query()->findOrFail($data['course_id']);
            if (! $course->isPublished() || ! $course->commerce_confirmed || ! $course->price_cents) {
                return response()->json(['message' => 'Course is not available for purchase.'], 422);
            }
            if ($course->access_tier !== 'purchase') {
                return response()->json(['message' => 'This course is not a one-time purchase product.'], 422);
            }
        } else {
            if (! $user->hasRole('client')) {
                abort(404);
            }
            $course = LmsCourse::query()->findOrFail($data['course_id']);
            if (! $course->is_published || ! $course->commerce_confirmed || ! $course->price_cents) {
                return response()->json(['message' => 'Course is not available for purchase.'], 422);
            }
            if (! in_array($course->access_mode, ['self_purchase', 'assigned_or_purchase', 'free'], true)) {
                return response()->json(['message' => 'This course is not available for self-purchase.'], 422);
            }
        }

        $months = (int) ($course->access_months ?: config('learning.default_access_months', 3));
        if ($data['product_domain'] === 'rcic_academy') {
            $base = rtrim((string) env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3005'), '/');
            $success = $base.'/dashboard/academy/courses?checkout=return&session_id={CHECKOUT_SESSION_ID}';
            $cancel = $base.'/dashboard/academy/courses?checkout=cancelled';
        } else {
            $base = rtrim((string) env('CLIENT_DASHBOARD_URL', env('PUBLIC_DASHBOARD_URL', 'http://localhost:3000')), '/');
            $success = $base.'/user-dashboard/learning?checkout=return&session_id={CHECKOUT_SESSION_ID}';
            $cancel = $base.'/user-dashboard/learning?checkout=cancelled';
        }
        $session = $stripe->createCheckoutSession([
            'mode' => 'payment',
            'success_url' => $success,
            'cancel_url' => $cancel,
            'line_items' => [[
                'price_data' => [
                    'currency' => strtolower((string) ($course->currency ?? 'cad')),
                    'product_data' => ['name' => $course->title],
                    'unit_amount' => (int) $course->price_cents,
                ],
                'quantity' => 1,
            ]],
            'metadata' => [
                'type' => 'learning_course',
                'product_domain' => $data['product_domain'],
                'course_id' => (string) $course->id,
                'learner_user_id' => (string) $user->id,
                'access_months' => (string) $months,
            ],
        ]);

        LearningCoursePayment::query()->create([
            'learner_user_id' => $user->id,
            'product_domain' => $data['product_domain'],
            'course_id' => $course->id,
            'amount_cents' => (int) $course->price_cents,
            'currency' => strtoupper((string) ($course->currency ?? 'CAD')),
            'status' => 'pending',
            'stripe_checkout_session_id' => $session->id,
            'access_months' => $months,
        ]);

        return response()->json(['id' => $session->id, 'url' => $session->url]);
    }
}
