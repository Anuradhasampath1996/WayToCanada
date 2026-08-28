<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Suggest ESDC NOC 2021 codes from a plain-language job description.
 * Uses the same OPENAI_API_KEY as legislation / document OCR.
 */
class NocLookupService
{
    public function available(): bool
    {
        $key = (string) config('services.openai.key', '');

        return $key !== '' && ! str_starts_with($key, 'sk-test');
    }

    /**
     * @return array{
     *   suggestions: list<array{code: string, teer: string, title: string, why: string}>,
     *   engine: string
     * }|null
     */
    public function suggest(string $query): ?array
    {
        if (! $this->available()) {
            return null;
        }

        $query = trim(preg_replace('/\s+/', ' ', $query) ?? '');
        if (strlen($query) < 3) {
            return null;
        }
        if (strlen($query) > 200) {
            $query = substr($query, 0, 200);
        }

        $system = <<<'PROMPT'
You help Canadian immigration clients map a job description to ESDC National Occupational Classification (NOC) 2021 codes.

Return JSON only:
{
  "suggestions": [
    {
      "code": "21231",
      "teer": "1",
      "title": "Software engineers and designers",
      "why": "Short reason this matches"
    }
  ]
}

Rules:
- Use real NOC 2021 five-digit codes only.
- TEER must equal the first digit of the code (0–5) as a string.
- title must be the official NOC unit-group title (or very close).
- Return 1–5 suggestions, best match first.
- If the query is already a 5-digit NOC code, return that code (if valid) plus close alternatives.
- Prefer skilled TEER 0–3 occupations when ambiguous only if the description clearly matches skilled work; otherwise stay faithful to the description.
- Never invent impossible codes. If unsure, still give best-effort matches with honest "why".
PROMPT;

        try {
            $response = Http::withToken((string) config('services.openai.key'))
                ->timeout(45)
                ->connectTimeout(10)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model'           => (string) config(
                        'services.ocr.openai_model',
                        env('LEGISLATION_OPENAI_MODEL', 'gpt-4o-mini')
                    ),
                    'temperature'     => 0.1,
                    'response_format' => ['type' => 'json_object'],
                    'messages'        => [
                        ['role' => 'system', 'content' => $system],
                        [
                            'role'    => 'user',
                            'content' => "Find NOC 2021 matches for this job / occupation description:\n{$query}",
                        ],
                    ],
                ]);

            if (! $response->successful()) {
                Log::warning('[NOC Lookup] OpenAI failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return null;
            }

            $content = $response->json('choices.0.message.content');
            $parsed = is_string($content) ? json_decode($content, true) : null;
            if (! is_array($parsed)) {
                return null;
            }

            $suggestions = [];
            $rawList = $parsed['suggestions'] ?? null;
            if (! is_array($rawList)) {
                return null;
            }

            foreach ($rawList as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $code = preg_replace('/\D+/', '', (string) ($row['code'] ?? '')) ?? '';
                $code = substr($code, 0, 5);
                if (strlen($code) !== 5) {
                    continue;
                }
                $teer = (string) ($row['teer'] ?? '');
                if ($teer === '' || ! in_array($teer, ['0', '1', '2', '3', '4', '5'], true)) {
                    $teer = $code[0];
                }
                // NOC 2021: TEER digit is the first digit of the code
                if ($teer !== $code[0]) {
                    $teer = $code[0];
                }
                $title = trim(preg_replace('/\s+/', ' ', (string) ($row['title'] ?? '')) ?? '');
                if ($title === '') {
                    continue;
                }
                $why = trim(preg_replace('/\s+/', ' ', (string) ($row['why'] ?? '')) ?? '');
                $suggestions[] = [
                    'code'  => $code,
                    'teer'  => $teer,
                    'title' => substr($title, 0, 180),
                    'why'   => substr($why, 0, 220),
                ];
                if (count($suggestions) >= 5) {
                    break;
                }
            }

            if ($suggestions === []) {
                return null;
            }

            return [
                'suggestions' => $suggestions,
                'engine'      => 'openai',
            ];
        } catch (\Throwable $e) {
            Log::warning('[NOC Lookup] exception: '.$e->getMessage());

            return null;
        }
    }
}
