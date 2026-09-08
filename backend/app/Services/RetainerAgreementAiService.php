<?php

namespace App\Services;

use App\Models\ClientProfile;
use App\Models\User;
use App\Support\RetainerAgreementConfig;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RetainerAgreementAiService
{
    /**
     * Generate agreement terms from consultant-provided instructions.
     *
     * @param array<string, mixed> $input
     * @return array{config: array<string, mixed>, ai_used: bool, notes: string}
     */
    public function generate(User $consultant, ClientProfile $profile, array $input): array
    {
        $pathway = trim((string) ($input['pathway'] ?? $profile->immigration_pathway ?? ''));
        $base = RetainerAgreementConfig::normalize([
            'totalFee' => $input['total_fee'] ?? null,
            'currency' => $input['currency'] ?? 'CAD',
            'pathway' => $pathway,
            'refundPolicy' => $input['refund_policy'] ?? null,
        ], $pathway ?: null);

        if (array_key_exists('total_fee', $input) && $input['total_fee'] !== null) {
            $base['totalFee'] = (float) $input['total_fee'];
        }

        $payload = [
            'pathway' => $pathway,
            'consultant_name' => $consultant->name,
            'fee' => [
                'amount' => $base['totalFee'],
                'currency' => $base['currency'],
            ],
            'payment_rules' => trim((string) ($input['payment_rules'] ?? '')),
            'refund_policy' => trim((string) ($input['refund_policy'] ?? '')),
            'instructions' => trim((string) ($input['instructions'] ?? '')),
        ];

        if ($this->available()) {
            $generated = $this->generateWithOpenAi($payload, $base);
            if ($generated !== null) {
                return [
                    'config' => $generated,
                    'ai_used' => true,
                    'notes' => 'Maple AI created a draft. Review and edit every term before sending it to the client.',
                ];
            }
        }

        return [
            'config' => $this->fallbackConfig($base, $payload),
            'ai_used' => false,
            'notes' => 'Maple AI is unavailable, so a draft was prepared from your inputs. Review and edit every term before sending it to the client.',
        ];
    }

    public function available(): bool
    {
        return (bool) config('workspace_ai.enabled')
            && filled(config('services.openai.key'));
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $base
     * @return array<string, mixed>|null
     */
    private function generateWithOpenAi(array $payload, array $base): ?array
    {
        $system = <<<'PROMPT'
You are Maple, an assistant for Canadian immigration consultants.
Create a professional retainer agreement configuration from the consultant's instructions.
This is a draft for consultant review, not legal advice. Never promise an immigration outcome,
invent government requirements, or add facts that were not provided.

Return JSON only with these keys:
totalFee (number), currency ("CAD" or "USD"), milestone1Pct (integer),
milestone1Label (string), milestone2Pct (integer), milestone2Label (string),
milestone3Pct (integer), milestone3Label (string), docDeadlineDays (integer),
refundPolicy (HTML string), customClauses (HTML string), scopeDescription (string).

Payment milestone percentages must total exactly 100. Use valid HTML only in refundPolicy
and customClauses, with <p>, <br>, <strong>, <em>, <ul>, <ol>, and <li> tags.
Keep the consultant's requested fee, payment rules, and refund terms unless they are
missing; use clear neutral defaults for missing values.
PROMPT;

        try {
            $response = Http::withToken((string) config('services.openai.key'))
                ->timeout((int) config('workspace_ai.timeout', 90))
                ->connectTimeout(10)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => (string) config('workspace_ai.model', 'gpt-4o-mini'),
                    'temperature' => 0.2,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        [
                            'role' => 'user',
                            'content' => "Prepare this retainer agreement draft:\n"
                                .json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
                        ],
                    ],
                ]);

            if (! $response->successful()) {
                Log::warning('Retainer agreement Maple AI request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return null;
            }

            $content = $response->json('choices.0.message.content');
            $parsed = is_string($content) ? json_decode($content, true) : null;
            if (! is_array($parsed)) {
                return null;
            }

            return $this->normalizeGeneratedConfig(array_merge($base, $parsed), $base);
        } catch (\Throwable $exception) {
            Log::warning('Retainer agreement Maple AI exception: '.$exception->getMessage());

            return null;
        }
    }

    /**
     * @param array<string, mixed> $config
     * @param array<string, mixed> $base
     * @return array<string, mixed>
     */
    private function normalizeGeneratedConfig(array $config, array $base): array
    {
        $allowed = array_keys(RetainerAgreementConfig::defaults());
        $config = array_intersect_key($config, array_flip($allowed));
        $config = array_merge($base, $config);

        $config['totalFee'] = max(0, min(50000, (float) ($config['totalFee'] ?? $base['totalFee'])));
        $config['currency'] = in_array($config['currency'] ?? null, ['CAD', 'USD'], true)
            ? $config['currency']
            : $base['currency'];
        $config['docDeadlineDays'] = max(3, min(60, (int) ($config['docDeadlineDays'] ?? 14)));

        foreach (['milestone1Label', 'milestone2Label', 'milestone3Label', 'scopeDescription'] as $key) {
            $config[$key] = $this->limitText((string) ($config[$key] ?? $base[$key] ?? ''), 2000);
        }

        foreach (['refundPolicy', 'customClauses'] as $key) {
            $config[$key] = $this->cleanHtml((string) ($config[$key] ?? $base[$key] ?? ''));
        }

        $p1 = max(0, min(100, (int) ($config['milestone1Pct'] ?? $base['milestone1Pct'])));
        $p2 = max(0, min(100, (int) ($config['milestone2Pct'] ?? $base['milestone2Pct'])));
        if ($p1 + $p2 > 100) {
            $p1 = (int) $base['milestone1Pct'];
            $p2 = (int) $base['milestone2Pct'];
        }

        $config['milestone1Pct'] = $p1;
        $config['milestone2Pct'] = $p2;
        $config['milestone3Pct'] = 100 - $p1 - $p2;
        $config['pathway'] = $base['pathway'];

        return RetainerAgreementConfig::normalize($config, $base['pathway'] ?: null);
    }

    /**
     * @param array<string, mixed> $base
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function fallbackConfig(array $base, array $payload): array
    {
        $config = $base;
        $config['scopeDescription'] = $payload['pathway']
            ? "Professional immigration consulting services for {$payload['pathway']}."
            : 'Professional immigration consulting services as described by the consultant.';

        $custom = [];
        if ($payload['payment_rules'] !== '') {
            $custom[] = '<p><strong>Payment rules</strong></p><p>'
                .$this->escapeHtml((string) $payload['payment_rules']).'</p>';
        }
        if ($payload['instructions'] !== '') {
            $custom[] = '<p><strong>Additional instructions</strong></p><p>'
                .$this->escapeHtml((string) $payload['instructions']).'</p>';
        }

        if ($custom !== []) {
            $config['customClauses'] = implode('', $custom);
        }
        if ($payload['refund_policy'] !== '') {
            $config['refundPolicy'] = $this->cleanHtml((string) $payload['refund_policy']);
        }

        return $this->normalizeGeneratedConfig($config, $base);
    }

    private function cleanHtml(string $value): string
    {
        return trim(strip_tags($value, '<p><br><strong><em><ul><ol><li>'));
    }

    private function escapeHtml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function limitText(string $value, int $length): string
    {
        return mb_substr(trim($value), 0, $length);
    }
}
