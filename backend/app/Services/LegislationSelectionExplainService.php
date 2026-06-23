<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LegislationSelectionExplainService
{
    public function __construct(
        private LegislationPopupSummaryService $summaries,
    ) {}

    /**
     * @return array{explanation: string, openai_used: bool}
     */
    public function explain(string $selectedText, ?string $citation = null, ?string $clientContext = null): array
    {
        $selectedText = trim($selectedText);
        if ($selectedText === '') {
            throw new \InvalidArgumentException('Selected text is required.');
        }

        if (strlen($selectedText) > 4000) {
            $selectedText = mb_substr($selectedText, 0, 4000).'…';
        }

        if ($this->summaries->openAiAvailable()) {
            $ai = $this->explainWithOpenAi($selectedText, $citation, $clientContext);
            if ($ai !== null) {
                return $ai;
            }
        }

        return [
            'explanation' => 'Selected text: "'.mb_substr($selectedText, 0, 280).'…" '
                .($citation ? "({$citation}) " : '')
                .'Review the full legal text and verify against current IRCC policy before advising clients.',
            'openai_used' => false,
        ];
    }

    /** @return array{explanation: string, openai_used: bool}|null */
    private function explainWithOpenAi(string $text, ?string $citation, ?string $clientContext): ?array
    {
        $user = "Citation: ".($citation ?: 'Unknown section')."\n\nSelected legal text:\n{$text}";
        if ($clientContext) {
            $user .= "\n\nOptional client context (do not invent facts beyond this):\n".mb_substr($clientContext, 0, 1200);
        }

        try {
            $response = Http::withToken((string) config('services.openai.key'))
                ->timeout(45)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model'       => config('legislation_sources.openai.model', 'gpt-4o-mini'),
                    'temperature' => 0.2,
                    'max_tokens'  => 400,
                    'messages'    => [
                        [
                            'role'    => 'system',
                            'content' => 'You are Maple, helping an RCIC consultant understand a selected excerpt from Canadian immigration legislation. Explain in 3-6 clear sentences what this text means in practice. If client context is provided, briefly note how it may apply — only using given facts. End with a short reminder to verify the full section.',
                        ],
                        ['role' => 'user', 'content' => $user],
                    ],
                ]);

            if ($response->failed()) {
                return null;
            }

            $content = trim((string) ($response->json('choices.0.message.content') ?? ''));
            if ($content === '') {
                return null;
            }

            return ['explanation' => $content, 'openai_used' => true];
        } catch (\Throwable $e) {
            Log::warning('[Legislation explain] '.$e->getMessage());

            return null;
        }
    }
}
