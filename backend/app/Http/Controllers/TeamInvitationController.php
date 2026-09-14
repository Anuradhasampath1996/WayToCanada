<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Services\Team\TeamInvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password as PasswordRule;

class TeamInvitationController extends Controller
{
    public function __construct(private TeamInvitationService $invitations) {}

    public function show(string $token): JsonResponse
    {
        $invitation = $this->invitations->findByToken($token);
        if (! $invitation) {
            abort(404, 'Invitation not found.');
        }
        $this->invitations->assertUsable($invitation);

        return response()->json([
            'email' => $invitation->email,
            'name' => $invitation->name,
            'job_title' => $invitation->job_title,
            'firm_name' => $invitation->workspace?->name,
            'expires_at' => $invitation->expires_at?->toIso8601String(),
        ]);
    }

    public function accept(Request $request, string $token): JsonResponse
    {
        $invitation = $this->invitations->findByToken($token);
        if (! $invitation) {
            abort(404, 'Invitation not found.');
        }

        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)->max(255)->letters()->numbers()],
        ]);

        $result = $this->invitations->accept($invitation, $data);

        return response()->json([
            'token' => $result['token'],
            'user' => new UserResource($result['user']),
            'message' => 'Account created.',
        ], 201);
    }
}
