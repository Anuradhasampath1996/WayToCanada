<?php

namespace App\Http\Controllers;

use App\Models\ClientProfile;
use App\Models\User;
use App\Services\ClientActivity\ClientActivityTriggers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ClientController extends Controller
{
    public function __construct(
        private ClientActivityTriggers $activity,
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

        // Optional filter by immigration pathway
        if ($pathway = $request->query('pathway')) {
            $query->where('immigration_pathway', $pathway);
        }

        $clients = $query->paginate(min((int) $request->query('per_page', 20), 200));

        return response()->json($clients);
    }

    // ── Create client ──────────────────────────────────────────────────────────

    /**
     * POST /api/v1/consultant/clients
     * Creates a User + ClientProfile in a single DB transaction.
     * Auto-generates a secure password and dispatches an invitation email.
     */
    public function store(Request $request): JsonResponse
    {
        $consultant = $request->user();

        $validated = $request->validate([
            'name'                 => ['required', 'string', 'max:255'],
            'email'                => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone'                => ['nullable', 'string', 'max:30'],
            'passport_number'      => ['nullable', 'string', 'max:50'],
            'immigration_pathway'  => ['nullable', 'string', 'max:100'],
            'family_id'            => ['nullable', 'integer', 'min:1'],
            'notes'                => ['nullable', 'string', 'max:5000'],
            'send_invite'          => ['boolean'],
        ]);

        $shouldSendInvite = (bool) ($validated['send_invite'] ?? true);

        // Generate a secure random password (16 chars)
        $plainPassword = Str::password(16);

        try {
            $result = DB::connection('cws')->transaction(function () use ($validated, $consultant, $plainPassword) {
                // 1. Create the user account
                $user = User::create([
                    'name'          => $validated['name'],
                    'email'         => $validated['email'],
                    'phone'         => $validated['phone'] ?? null,
                    'password'      => Hash::make($plainPassword),
                    'consultant_id' => $consultant->id,
                    // Mark as verified since the consultant is registering them
                    'email_verified_at' => now(),
                    'is_verified'       => true,
                ]);

                // 2. Assign the 'client' role
                $user->assignRole('client');

                // 3. Create the linked profile
                $profile = ClientProfile::create([
                    'user_id'             => $user->id,
                    'consultant_id'       => $consultant->id,
                    'phone'               => $validated['phone'] ?? null,
                    'passport_number'     => $validated['passport_number'] ?? null,
                    'immigration_pathway' => $validated['immigration_pathway'] ?? null,
                    'family_id'           => $validated['family_id'] ?? null,
                    'notes'               => $validated['notes'] ?? null,
                    'invited_at'          => now(),
                ]);

                return ['user' => $user, 'profile' => $profile];
            });

            // 4. Send invitation email (outside the transaction so a mail failure doesn't roll back)
        if ($shouldSendInvite) {
            $this->sendInvitationEmail($result['user'], $plainPassword, $consultant);
            $this->activity->onClientInvited($result['profile'], $consultant, $request);
        }
        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
            return response()->json([
                'message' => 'A user with this email already exists.',
                'errors'  => ['email' => ['This email is already registered.']],
            ], 422);
        } catch (\Throwable $e) {
            Log::error('[ClientController] Failed to create client: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to create client. Please try again.'], 500);
        }

        return response()->json([
            'message'      => $shouldSendInvite ? 'Client created and invitation sent.' : 'Client created. Invitation not sent.',
            'invite_sent'  => $shouldSendInvite,
            'client'       => $result['profile']->load('user:id,name,email,phone,created_at'),
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
     * Removes the profile and optionally the user account (if no other data).
     */
    public function destroy(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        DB::connection('cws')->transaction(function () use ($profile) {
            $user = $profile->user;
            $profile->delete();     // cascades via FK
            $user?->delete();
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

        $this->sendInvitationEmail($profile->user, $plainPassword, $request->user());
        $this->activity->onClientInvited($profile, $request->user(), $request);

        return response()->json(['message' => 'Invitation resent.']);
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

    private function sendInvitationEmail(User $client, string $plainPassword, User $consultant): void
    {
        try {
            Mail::send([], [], function ($message) use ($client, $plainPassword, $consultant) {
                $message
                    ->to($client->email, $client->name)
                    ->subject('Your RCICMASTER Client Portal Invitation')
                    ->html(
                        view('emails.client-invitation', [
                            'client'        => $client,
                            'password'      => $plainPassword,
                            'consultant'    => $consultant,
                            'loginUrl'      => env('CLIENT_PORTAL_URL', 'http://localhost:3001') . '/login',
                        ])->render()
                    );
            });
        } catch (\Throwable $e) {
            Log::warning('[ClientController] Invitation email failed for ' . $client->email . ': ' . $e->getMessage());
        }
    }
}
