<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\IntegrationSettingsService;
use App\Services\WhatsApp\MetaWhatsAppCloudService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class AdminIntegrationSettingsController extends Controller
{
    public function __construct(
        private IntegrationSettingsService $settings,
        private MetaWhatsAppCloudService $whatsappCloud,
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

    public function testWhatsApp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'to' => 'required|string|max:32',
        ]);

        $this->settings->applyRuntimeConfig();

        $result = $this->whatsappCloud->sendTest($data['to']);

        if ($result['sent']) {
            return response()->json([
                'message' => 'Test WhatsApp sent via Meta Cloud API to ' . $data['to'],
            ]);
        }

        if ($result['error'] === null) {
            return response()->json([
                'message' => 'Meta WhatsApp Cloud API is not configured. Save Phone Number ID and Access Token first.',
            ], 422);
        }

        return response()->json(['message' => 'Send failed: ' . $result['error']], 422);
    }

    public function testOpenAi(): JsonResponse
    {
        $this->settings->applyRuntimeConfig();

        $key = (string) config('services.openai.key', '');
        if ($key === '') {
            return response()->json([
                'message' => 'No OpenAI API key configured. Paste your key in the API key field and Save.',
            ], 422);
        }

        if (str_starts_with($key, 'sk-test')) {
            return response()->json([
                'message' => 'The saved key is a placeholder (sk-test…), not a real OpenAI key. Paste your key from platform.openai.com/api-keys and Save again.',
            ], 422);
        }

        if (! (bool) config('workspace_ai.enabled')) {
            return response()->json([
                'message' => 'Maple workspace AI is disabled. Turn on “Maple workspace AI” and Save.',
            ], 422);
        }

        try {
            $response = \Illuminate\Support\Facades\Http::withToken($key)
                ->timeout(25)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model'       => config('workspace_ai.model', 'gpt-4o-mini'),
                    'max_tokens'  => 16,
                    'temperature' => 0,
                    'messages'    => [
                        ['role' => 'user', 'content' => 'Reply with exactly: Maple OK'],
                    ],
                ]);

            if (! $response->successful()) {
                $error = $response->json('error.message') ?? $response->body();

                return response()->json([
                    'message' => 'OpenAI rejected the key: '.(is_string($error) ? $error : 'API error'),
                ], 422);
            }

            return response()->json([
                'message' => 'OpenAI connection OK — Maple can use AI enhanced mode.',
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Test failed: '.$e->getMessage()], 422);
        }
    }
}
