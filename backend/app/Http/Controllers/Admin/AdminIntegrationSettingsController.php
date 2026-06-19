<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\IntegrationSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class AdminIntegrationSettingsController extends Controller
{
    public function __construct(
        private IntegrationSettingsService $settings,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->settings->adminIndex()]);
    }

    public function update(Request $request, string $group): JsonResponse
    {
        if (! isset(IntegrationSettingsService::GROUPS[$group])) {
            return response()->json(['message' => 'Unknown integration group.'], 404);
        }

        $meta = IntegrationSettingsService::GROUPS[$group];
        $rules = [];
        foreach ($meta['fields'] as $field) {
            $rules[$field] = in_array($field, $meta['secrets'], true)
                ? 'nullable|string|max:2048'
                : 'nullable|string|max:512';
        }

        $data = $request->validate($rules);

        try {
            $this->settings->updateGroup($group, $data, $request->user()->id);
            $this->settings->applyRuntimeConfig();
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $updated = collect($this->settings->adminIndex())->firstWhere('key', $group);

        return response()->json([
            'message' => $meta['label'] . ' settings saved.',
            'group'   => $updated,
        ]);
    }

    public function clear(string $group): JsonResponse
    {
        if (! isset(IntegrationSettingsService::GROUPS[$group])) {
            return response()->json(['message' => 'Unknown integration group.'], 404);
        }

        $this->settings->clearGroup($group);
        $this->settings->applyRuntimeConfig();

        return response()->json(['message' => 'Reverted to .env defaults for this section.']);
    }

    public function testMail(Request $request): JsonResponse
    {
        $data = $request->validate([
            'to' => 'required|email|max:255',
        ]);

        $this->settings->applyRuntimeConfig();

        try {
            Mail::raw(
                'This is a test email from RCICMASTER admin integration settings.',
                fn ($m) => $m->to($data['to'])->subject('RCICMASTER — test email'),
            );

            return response()->json(['message' => 'Test email sent to ' . $data['to']]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Send failed: ' . $e->getMessage()], 422);
        }
    }
}
