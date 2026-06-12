<?php

namespace App\Http\Controllers;

use App\Services\Notifications\NotificationPreferenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationPreferenceController extends Controller
{
    public function __construct(
        private NotificationPreferenceService $preferences,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $prefs = $this->preferences->forUser($request->user());

        return response()->json([
            'in_app_enabled'       => $prefs->in_app_enabled,
            'email_enabled'        => $prefs->email_enabled,
            'whatsapp_enabled'     => $prefs->whatsapp_enabled,
            'whatsapp_phone'       => $prefs->whatsapp_phone,
            'whatsapp_verified'    => $prefs->whatsapp_verified,
            'category_preferences' => $prefs->category_preferences ?? [],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'in_app_enabled'       => 'sometimes|boolean',
            'email_enabled'        => 'sometimes|boolean',
            'whatsapp_enabled'     => 'sometimes|boolean',
            'whatsapp_phone'       => 'nullable|string|max:32',
            'category_preferences' => 'sometimes|array',
        ]);

        $prefs = $this->preferences->forUser($request->user());
        $prefs->update($data);

        return $this->show($request);
    }
}
