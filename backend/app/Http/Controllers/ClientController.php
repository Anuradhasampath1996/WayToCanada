<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Models\User;
use App\Services\ClientActivity\ClientActivityTriggers;
use App\Services\ClientCommandCenterService;
use App\Services\ConsultantClientListService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class ClientController extends Controller
{
    public function __construct(
        private ClientActivityTriggers $activity,
        private ConsultantClientListService $clientList,
        private ClientCommandCenterService $commandCenter,
    ) {}

    // ── List clients ───────────────────────────────────────────────────────────

    /**
     * GET /api/v1/consultant/clients
     * Returns all clients for the authenticated consultant with pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $consultant = $request->user();

        $query = ClientProfile::forConsultant($consultant->id)
            ->with('user:id,name,email,phone,created_at')
            ->latest();

        // Optional search by name / email
        if ($search = $request->query('search')) {
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%");
            });
        }

        if ($email = $request->query('email')) {
            $query->whereHas('user', function ($q) use ($email) {
                $q->where('email', 'ilike', "%{$email}%");
            });
        }

        if ($phone = $request->query('phone')) {
            $query->where(function ($q) use ($phone) {
                $q->where('phone', 'ilike', "%{$phone}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('phone', 'ilike', "%{$phone}%"));
            });
        }

        // Optional filter by immigration pathway
        if ($pathway = $request->query('pathway')) {
            $query->where('immigration_pathway', $pathway);
        }

        $clients = $query->paginate(min((int) $request->query('per_page', 20), 200));

        return response()->json($this->clientList->transformPaginated($clients));
    }

    // ── Create client ──────────────────────────────────────────────────────────

    /**
     * POST /api/v1/consultant/clients
     * Creates a ClientProfile for this consultant.
     * Email uniqueness is consultant-scoped: the same client user may work with multiple consultants.
     */
    public function store(Request $request): JsonResponse
    {
        $consultant = $request->user();

        $validated = $request->validate([
            'name'                 => ['required', 'string', 'max:255'],
            'email'                => ['required', 'email', 'max:255'],
            'phone'                => ['nullable', 'string', 'max:30'],
            'passport_number'      => ['nullable', 'string', 'max:50'],
            'immigration_pathway'  => ['nullable', 'string', 'max:100'],
            'family_id'            => ['nullable', 'integer', 'min:1'],
            'notes'                => ['nullable', 'string', 'max:5000'],
            'send_invite'          => ['boolean'],
        ]);

        $email = strtolower(trim($validated['email']));
        $shouldSendInvite = (bool) ($validated['send_invite'] ?? true);

        // Already linked to THIS consultant?
        $existingForConsultant = ClientProfile::query()
            ->where('consultant_id', $consultant->id)
            ->whereHas('user', fn ($q) => $q->whereRaw('LOWER(email) = ?', [$email]))
            ->first();

        if ($existingForConsultant) {
            return response()->json([
                'message' => 'You already have a client with this email.',
                'errors'  => ['email' => ['This email is already in your client list.']],
            ], 422);
        }

        $existingUser = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if ($existingUser && ! $existingUser->hasRole('client')) {
            return response()->json([
                'message' => 'This email belongs to a consultant or admin account.',
                'errors'  => ['email' => ['This email cannot be used for a client profile.']],
            ], 422);
        }

        $plainPassword = null;
        $createdNewUser = false;
        $linkedExisting = false;

        try {
            $result = DB::connection('cws')->transaction(function () use (
                $validated,
                $consultant,
                $email,
                $existingUser,
                $shouldSendInvite,
                &$plainPassword,
                &$createdNewUser,
                &$linkedExisting,
            ) {
                if ($existingUser) {
                    $user = $existingUser;
                    $linkedExisting = true;

                    // Keep their login; refresh name/phone lightly if provided.
                    $userUpdates = array_filter([
                        'name'  => $validated['name'] ?? null,
                        'phone' => $validated['phone'] ?? $user->phone,
                    ], fn ($v) => $v !== null && $v !== '');
                    if ($userUpdates !== []) {
                        $user->update($userUpdates);
                    }
                    if (! $user->hasRole('client')) {
                        $user->assignRole('client');
                    }
                } else {
                    $createdNewUser = true;
                    $plainPassword = Str::password(16);
                    $user = User::create([
                        'name'              => $validated['name'],
                        'email'             => $email,
                        'phone'             => $validated['phone'] ?? null,
                        'password'          => Hash::make($plainPassword),
                        'consultant_id'     => $consultant->id,
                        'email_verified_at' => now(),
                        'is_verified'       => true,
                    ]);
                    $user->assignRole('client');
                }

                // Point "current" consultant for portal resolution to the inviting RCIC.
                $user->update(['consultant_id' => $consultant->id]);

                $profile = ClientProfile::create([
                    'user_id'             => $user->id,
                    'consultant_id'       => $consultant->id,
                    'phone'               => $validated['phone'] ?? $user->phone,
                    'passport_number'     => $validated['passport_number'] ?? null,
                    'immigration_pathway' => $validated['immigration_pathway'] ?? null,
                    'family_id'           => $validated['family_id'] ?? null,
                    'notes'               => $validated['notes'] ?? null,
                    'invited_at'          => $shouldSendInvite ? now() : null,
                ]);

                return ['user' => $user->fresh(), 'profile' => $profile];
            });

            if ($shouldSendInvite) {
                $mailOk = false;
                if ($createdNewUser && $plainPassword) {
                    $mailOk = $this->sendInvitationEmail($result['user'], $plainPassword, $consultant);
                } else {
                    $mailOk = $this->sendLinkedConsultantEmail($result['user'], $consultant);
                }
                $this->activity->onClientInvited($result['profile'], $consultant, $request);
            } else {
                $mailOk = null;
            }
        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
            return response()->json([
                'message' => 'You already have a client with this email.',
                'errors'  => ['email' => ['This email is already in your client list.']],
            ], 422);
        } catch (\Throwable $e) {
            Log::error('[ClientController] Failed to create client: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to create client. Please try again.'], 500);
        }

        $message = $shouldSendInvite
            ? ($linkedExisting
                ? 'Existing client linked to your practice.'
                : 'Client created.')
            : ($linkedExisting
                ? 'Existing client linked to your practice. Invitation not sent.'
                : 'Client created. Invitation not sent.');

        if ($shouldSendInvite) {
            $message .= ! empty($mailOk)
                ? ' Invitation email sent.'
                : ' Invitation email failed to send — use Resend invite, or check Admin → Integrations → Email.';
        }

        return response()->json([
            'message'         => $message,
            'invite_sent'     => $shouldSendInvite && ! empty($mailOk),
            'mail_sent'       => $shouldSendInvite ? (bool) $mailOk : null,
            'linked_existing' => $linkedExisting,
            'client'          => $result['profile']->load('user:id,name,email,phone,created_at'),
        ], 201);
    }

    // ── Show client ────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/consultant/clients/{profile}
     */
    public function show(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        return response()->json([
            'client' => $profile->load('user:id,name,email,phone,is_verified,email_verified_at,created_at'),
        ]);
    }

    /**
     * GET /api/v1/consultant/clients/{profile}/command-center
     * Unified workspace summary for the client profile command center.
     */
    public function commandCenter(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        return response()->json($this->commandCenter->build($profile));
    }

    // ── Update client profile ──────────────────────────────────────────────────

    /**
     * PUT /api/v1/consultant/clients/{profile}
     */
    public function update(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $validated = $request->validate([
            'name'                 => ['sometimes', 'required', 'string', 'max:255'],
            'phone'                => ['nullable', 'string', 'max:30'],
            'passport_number'      => ['nullable', 'string', 'max:50'],
            'immigration_pathway'  => ['nullable', 'string', 'max:100'],
            'family_id'            => ['nullable', 'integer', 'min:1'],
            'notes'                => ['nullable', 'string', 'max:5000'],
        ]);

        DB::connection('cws')->transaction(function () use ($validated, $profile) {
            // Update user's name / phone if provided
            if (isset($validated['name']) || isset($validated['phone'])) {
                $profile->user->update(array_filter([
                    'name'  => $validated['name'] ?? null,
                    'phone' => $validated['phone'] ?? null,
                ], fn($v) => $v !== null));
            }

            // Update profile fields
            $profileFields = array_intersect_key($validated, array_flip([
                'phone', 'passport_number', 'immigration_pathway', 'family_id', 'notes',
            ]));

            // Stamp notes_updated_at if notes changed
            if (array_key_exists('notes', $validated)) {
                $profileFields['notes_updated_at'] = now();
            }

            $profile->update($profileFields);
        });

        return response()->json([
            'message' => 'Client updated.',
            'client'  => $profile->fresh()->load('user:id,name,email,phone,created_at'),
        ]);
    }

    // ── Delete client ──────────────────────────────────────────────────────────

    /**
     * DELETE /api/v1/consultant/clients/{profile}
     * Removes this consultant's client profile. Deletes the user only if no other profiles remain.
     */
    public function destroy(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);
        $consultantId = (int) $request->user()->id;

        DB::connection('cws')->transaction(function () use ($profile, $consultantId) {
            $user = $profile->user;
            $profile->delete();

            if ($user && ! ClientProfile::where('user_id', $user->id)->exists()) {
                $user->delete();
            } elseif ($user && (int) $user->consultant_id === $consultantId) {
                $next = ClientProfile::where('user_id', $user->id)->latest('id')->first();
                $user->update(['consultant_id' => $next?->consultant_id]);
            }
        });

        return response()->json(['message' => 'Client removed.']);
    }

    // ── Resend invitation ──────────────────────────────────────────────────────

    /**
     * POST /api/v1/consultant/clients/{profile}/resend-invite
     */
    public function resendInvite(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $plainPassword = Str::password(16);
        $profile->user->update(['password' => Hash::make($plainPassword)]);
        $profile->update(['invited_at' => now()]);

        $mailOk = $this->sendInvitationEmail($profile->user, $plainPassword, $request->user());
        $this->activity->onClientInvited($profile, $request->user(), $request);

        return response()->json([
            'message'   => $mailOk
                ? 'Invitation resent.'
                : 'Password reset, but email failed to send. Check Admin → Integrations → Email.',
            'mail_sent' => $mailOk,
        ], $mailOk ? 200 : 502);
    }

    // ── Toggle active / inactive ───────────────────────────────────────────────

    /**
     * PATCH /api/v1/consultant/clients/{profile}/toggle-status
     * Flips the client's is_verified (active/inactive) flag.
     */
    public function toggleStatus(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $newStatus = ! $profile->user->is_verified;
        $profile->user->update(['is_verified' => $newStatus]);

        // Revoke all tokens when deactivating so active sessions are terminated
        if (! $newStatus) {
            $profile->user->tokens()->delete();
        }

        return response()->json([
            'message'     => $newStatus ? 'Client activated.' : 'Client deactivated.',
            'is_verified' => $newStatus,
        ]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function authorizeConsultant(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Unauthorized.');
        }
    }

    private function sendInvitationEmail(User $client, string $plainPassword, User $consultant): bool
    {
        try {
            app(\App\Services\IntegrationSettingsService::class)->applyRuntimeConfig();

            $loginUrl = rtrim(
                (string) (env('PUBLIC_FRONTEND_URL') ?: env('CLIENT_PORTAL_URL', 'http://localhost:3000')),
                '/'
            ) . '/login';

            $html = view('emails.client-invitation', [
                'client'     => $client,
                'password'   => $plainPassword,
                'consultant' => $consultant,
                'loginUrl'   => $loginUrl,
            ])->render();

            Mail::html($html, function ($message) use ($client) {
                $message
                    ->to($client->email, $client->name)
                    ->subject('Your RCICMASTER Client Portal Invitation');
            });

            Log::info('[ClientController] Invitation email sent', [
                'to'     => $client->email,
                'mailer' => config('mail.default'),
                'host'   => config('mail.mailers.smtp.host'),
            ]);

            return true;
        } catch (\Throwable $e) {
            Log::error('[ClientController] Invitation email failed for ' . $client->email . ': ' . $e->getMessage(), [
                'mailer' => config('mail.default'),
                'host'   => config('mail.mailers.smtp.host'),
            ]);

            return false;
        }
    }

    private function sendLinkedConsultantEmail(User $client, User $consultant): bool
    {
        try {
            app(\App\Services\IntegrationSettingsService::class)->applyRuntimeConfig();

            $loginUrl = rtrim(
                (string) (env('PUBLIC_FRONTEND_URL') ?: env('CLIENT_PORTAL_URL', 'http://localhost:3000')),
                '/'
            ) . '/login';
            $consultantName = $consultant->company_name ?: $consultant->name;
            $html = '<p>Hello '.e($client->name).',</p>'
                .'<p><strong>'.e($consultantName).'</strong> has added you to their RCICMASTER practice workspace.</p>'
                .'<p>Sign in with your existing account: <a href="'.e($loginUrl).'">'.e($loginUrl).'</a></p>'
                .'<p>If you work with more than one consultant, each practice keeps its own case files.</p>';

            Mail::html($html, function ($message) use ($client, $consultantName) {
                $message
                    ->to($client->email, $client->name)
                    ->subject('You were added by '.$consultantName.' on RCICMASTER');
            });

            Log::info('[ClientController] Link email sent', [
                'to'     => $client->email,
                'mailer' => config('mail.default'),
            ]);

            return true;
        } catch (\Throwable $e) {
            Log::error('[ClientController] Link email failed for ' . $client->email . ': ' . $e->getMessage());

            return false;
        }
    }
}
