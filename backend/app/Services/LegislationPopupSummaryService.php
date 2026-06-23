<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LegislationPopupSummaryService
{
    /**
     * @param  array<string, mixed>  $resolved
     * @return array{summary: string, key_points: list<string>, openai_used: bool}|null
     */
    public function summarize(array $resolved): ?array
    {
        if (! $this->openAiAvailable()) {
            return null;
        }

        $act  = (string) ($resolved['act_code'] ?? '');
        $key  = (string) ($resolved['provision_key'] ?? '');
        $lang = (string) ($resolved['language'] ?? 'en');
        $cacheKey = "legislation_popup_summary:{$act}:{$key}:{$lang}";

        return Cache::remember($cacheKey, now()->addDays(14), function () use ($resolved) {
            return $this->generateSummary($resolved);
        });
    }

    /**
     * @param  array<string, mixed>  $resolved
     * @return array{summary: string, key_points: list<string>, openai_used: bool}|null
     */
    private function generateSummary(array $resolved): ?array
    {
        $citation = (string) ($resolved['citation'] ?? '');
        $marginal = (string) ($resolved['marginal_note'] ?? '');
        $text     = strip_tags((string) ($resolved['text_content'] ?? ''));
        if ($text === '') {
            $text = strip_tags((string) ($resolved['popup_html'] ?? $resolved['html_fragment'] ?? ''));
        }
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');
        if ($text === '') {
            return null;
        }

        if (strlen($text) > 3500) {
            $text = mb_substr($text, 0, 3500).'…';
        }

        try {
            $response = Http::withToken((string) config('services.openai.key'))
                ->timeout(45)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model'       => config('legislation_sources.openai.model', 'gpt-4o-mini'),
                    'temperature' => 0.2,
                    'max_tokens'  => 450,
                    'messages'    => [
                        [
                            'role'    => 'system',
                            'content' => <<<'PROMPT'
You are Maple, an AI assistant for RCIC consultants reading Canadian immigration legislation.

Summarize the given legal provision in plain, professional English for a consultant (not a lawyer brief, not for clients directly).

Reply ONLY with valid JSON:
{"summary":"2-4 sentences","key_points":["bullet 1","bullet 2","bullet 3"]}

Rules:
- Be accurate — do not invent requirements not in the text
- Mention who it applies to and any key conditions or exceptions visible in the text
- Keep key_points to 2-4 short bullets
- Do not use markdown
PROMPT,
                        ],
                        [
                            'role'    => 'user',
                            'content' => "Citation: {$citation}\nMarginal note: {$marginal}\n\nProvision text:\n{$text}",
                        ],
                    ],
                ]);

            if ($response->failed()) {
                Log::warning('[Legislation popup] OpenAI summary failed', ['status' => $response->status()]);

                return null;
            }

            $content = trim((string) ($response->json('choices.0.message.content') ?? ''));
            $content = preg_replace('/^```json\s*|\s*```$/', '', $content) ?? $content;
            $parsed  = json_decode($content, true);
            if (! is_array($parsed) || empty($parsed['summary'])) {
                return null;
            }

            $points = $parsed['key_points'] ?? [];
            if (! is_array($points)) {
                $points = [];
            }

            return [
                'summary'      => trim((string) $parsed['summary']),
                'key_points'   => array_values(array_filter(array_map('strval', $points))),
                'openai_used'  => true,
            ];
        } catch (\Throwable $e) {
            Log::warning('[Legislation popup] OpenAI summary error: '.$e->getMessage());

            return null;
        }
    }

    public function openAiAvailable(): bool
    {
        $key = (string) config('services.openai.key');

        return (bool) config('legislation_sources.openai.enabled')
            && $key !== ''
            && ! str_starts_with($key, 'sk-test');
    }
}
