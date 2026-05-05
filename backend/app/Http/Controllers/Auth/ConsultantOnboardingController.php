<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Mail\RcicLicenseVerificationMail;
use App\Models\RcicConsultant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

class ConsultantOnboardingController extends Controller
{
    /**
     * POST /api/v1/consultant/onboarding
     *
     * Saves preferred language + RCIC number.
     * Looks up the number in rcic_consultants (CICC public register):
     *   - Emails match   → verify immediately, no email needed
     *   - Emails differ  → send verification email to the CICC-registered address
     *   - Not found      → return 404
     */
    public function submit(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rcic_number' => ['required', 'string', 'max:30'],
            'language'    => ['required', 'in:en,fr'],
        ]);

        /** @var User $user */
        $user = $request->user();

        // Normalise the college_id (trim whitespace, uppercase)
        $collegeId = strtoupper(trim($data['rcic_number']));

        // Look up in the CICC public register
        $rcic = RcicConsultant::where('college_id', $collegeId)->first();

        if (! $rcic) {
            return response()->json([
                'message' => 'RCIC number not found in the CICC register. Please double-check and try again.',
            ], 404);
        }

        // Save language and RCIC number
        $user->update([
            'rcic_number' => $collegeId,
            'locale'      => $data['language'],
        ]);

        // If the user registered with the same email as in the CICC register → auto-verify
        if ($rcic->email && strtolower($rcic->email) === strtolower($user->email)) {
            $user->update([
                'is_license_verified' => true,
                'license_verified_at' => now(),
            ]);

            return response()->json([
                'status' => 'verified',
                'user'   => new UserResource($user->fresh()->load('roles')),
            ]);
        }

        // Emails differ → send verification email to the CICC-registered address
        if ($rcic->email) {
            $signedUrl = URL::temporarySignedRoute(
                'consultant.license.verify',
                now()->addDays(3),
                ['id' => $user->id, 'hash' => sha1($user->email)]
            );

            Mail::to($rcic->email)->send(
                new RcicLicenseVerificationMail($user, $collegeId, $signedUrl)
            );
        }

        return response()->json([
            'status'  => 'pending',
            'message' => 'A verification email has been sent to the CICC-registered address for this RCIC number. Please ask the licence holder to click the link to complete verification.',
        ]);
    }

    /**
     * GET /api/v1/consultant/license/verify/{id}
     *
     * Signed URL endpoint — clicked from the verification email.
     * Marks the user as licence-verified and redirects to the consultant dashboard.
     */
    public function verify(Request $request, int $id)
    {
        if (! $request->hasValidSignature()) {
            abort(403, 'Invalid or expired verification link.');
        }

        $user = User::findOrFail($id);

        if (! hash_equals(sha1($user->email), (string) $request->query('hash', ''))) {
            abort(403, 'Invalid verification link.');
        }

        if (! $user->is_license_verified) {
            $user->update([
                'is_license_verified' => true,
                'license_verified_at' => now(),
            ]);
        }

        $dashboardUrl = rtrim(env('CONSULTANT_DASHBOARD_URL', 'http://localhost:3004'), '/');

        return redirect()->away("{$dashboardUrl}/license-verified");
    }
}
