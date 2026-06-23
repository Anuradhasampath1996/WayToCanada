<?php

namespace App\Services;

use App\Models\ConsultantLetter;
use App\Models\ConsultantLetterTemplate;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ConsultantLetterGenerationService
{
    public function __construct(
        private ConsultantLetterContextService $context,
    ) {}

    public function openAiAvailable(): bool
    {
        return (bool) config('consultant_letters.openai.enabled')
            && (bool) config('services.openai.key');
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array{title: string, subject: string, body_html: string, notes: string|null, openai_used: bool}
     */
    public function generate(User $consultant, array $options): array
    {
        $letterType = (string) ($options['letter_type'] ?? 'other');
        $instructions = trim((string) ($options['custom_instructions'] ?? ''));
        $template = isset($options['template_id'])
            ? ConsultantLetterTemplate::where('consultant_id', $consultant->id)
                ->find($options['template_id'])
            : null;

        $clientProfile = null;
        if (! empty($options['client_profile_id'])) {
            $clientProfile = \App\Models\ClientProfile::forConsultant($consultant->id)
                ->findOrFail((int) $options['client_profile_id']);
        }

        $snapshot = $this->context->buildSnapshot($consultant, $clientProfile);
        $typeLabel = config("consultant_letters.letter_types.{$letterType}", $letterType);

        if ($this->openAiAvailable()) {
            $ai = $this->generateWithOpenAi($snapshot, $letterType, $typeLabel, $instructions, $template);
            if ($ai !== null) {
                return array_merge($ai, ['openai_used' => true]);
            }
        }

        return array_merge(
            $this->generateFallback($snapshot, $letterType, $typeLabel, $instructions, $template),
            ['openai_used' => false],
        );
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array{title: string, subject: string, body_html: string, notes: string|null}|null
     */
    private function generateWithOpenAi(
        array $snapshot,
        string $letterType,
        string $typeLabel,
        string $instructions,
        ?ConsultantLetterTemplate $template,
    ): ?array {
        $payload = json_encode([
            'letter_type'         => $letterType,
            'letter_type_label'   => $typeLabel,
            'custom_instructions' => $instructions,
            'template'            => $template ? [
                'name'                => $template->name,
                'subject_template'    => $template->subject_template,
                'body_html'           => $template->body_html,
                'prompt_instructions' => $template->prompt_instructions,
            ] : null,
            'context' => $snapshot,
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

        $system = <<<'PROMPT'
You are a professional Canadian immigration consultant (RCIC) letter drafting assistant.
Write formal, accurate, client-ready correspondence in Canadian English.
Use only facts present in the provided context. Do not invent case facts, dates, or officer decisions.
If information is missing, use neutral placeholders like [Client Name], [Date], [Application Number], or [Officer Name].

IMPORTANT layout rules:
- body_html is ONLY the letter body content (salutation, paragraphs, and a closing such as "Sincerely,").
- Do NOT include consultant letterhead, company name, logo, address, phone, email, RCIC number, or signature block in body_html.
- The system adds a professional header (logo + company) and footer (signature + RCIC details) automatically.
- Do NOT repeat client contact details in the body if they appear in context — reference the client by name in prose only.

Return JSON only with keys: title, subject, body_html, notes.
body_html must be valid HTML using <p>, <br>, <ul>, <li>, <strong> only — no markdown.
notes is optional brief guidance for the consultant about missing facts or assumptions.
PROMPT;

        try {
            $response = Http::withToken(config('services.openai.key'))
                ->timeout((int) config('consultant_letters.openai.timeout', 90))
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model'           => config('consultant_letters.openai.model'),
                    'temperature'     => 0.3,
                    'response_format' => ['type' => 'json_object'],
                    'messages'        => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => "Draft this letter:\n{$payload}"],
                    ],
                ]);

            if (! $response->successful()) {
                Log::warning('Consultant letter OpenAI failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return null;
            }

            $content = $response->json('choices.0.message.content');
            $parsed  = is_string($content) ? json_decode($content, true) : null;

            if (! is_array($parsed) || empty($parsed['body_html'])) {
                return null;
            }

            return [
                'title'     => (string) ($parsed['title'] ?? $typeLabel),
                'subject'   => (string) ($parsed['subject'] ?? $typeLabel),
                'body_html' => (string) $parsed['body_html'],
                'notes'     => isset($parsed['notes']) ? (string) $parsed['notes'] : null,
            ];
        } catch (\Throwable $e) {
            Log::warning('Consultant letter OpenAI exception: '.$e->getMessage());

            return null;
        }
    }

    /** Strip consultant signature blocks that AI may still append. */
    public function normalizeBodyHtml(string $html): string
    {
        if ($html === '') {
            return $html;
        }

        if (preg_match('/(<p>\s*(?:Sincerely|Yours faithfully|Yours truly|Respectfully),?\s*<\/p>)(.*)$/is', $html, $matches)) {
            $tail = $matches[2] ?? '';
            if ($tail !== '' && preg_match('/RCIC|Regulated Canadian|License No|@\w+\.\w+/i', $tail)) {
                return trim($matches[1]);
            }
        }

        return $html;
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array{title: string, subject: string, body_html: string, notes: string|null}
     */
    private function generateFallback(
        array $snapshot,
        string $letterType,
        string $typeLabel,
        string $instructions,
        ?ConsultantLetterTemplate $template,
    ): array {
        $consultant = $snapshot['consultant'] ?? [];
        $client     = $snapshot['client'] ?? [];
        $clientName = $client['client_name'] ?? '[Client Name]';
        $pathway    = $client['immigration_pathway'] ?? '[Immigration Pathway]';

        if ($template?->body_html) {
            $body = $template->body_html;
            $subject = $template->subject_template ?? $typeLabel;
        } else {
            $body = "<p>Dear Sir/Madam,</p>"
                ."<p>I am writing regarding {$clientName}'s immigration matter"
                .($pathway !== '[Immigration Pathway]' ? " ({$pathway})" : '')
                .'.</p>'
                .($instructions !== '' ? "<p>{$instructions}</p>" : '<p>[Add your letter content here.]</p>')
                ."<p>Sincerely,</p>";
            $subject = $typeLabel.' — '.$clientName;
        }

        return [
            'title'     => $template?->name ?? $typeLabel,
            'subject'   => $subject,
            'body_html' => $body,
            'notes'     => $this->openAiAvailable()
                ? null
                : 'AI unavailable — template or blank draft created. Edit before sending.',
        ];
    }

    /** @return array<string, mixed> */
    public function formatLetter(ConsultantLetter $letter): array
    {
        $letter->loadMissing('clientProfile.user:id,name');

        return [
            'id'                  => $letter->id,
            'title'               => $letter->title,
            'letter_type'         => $letter->letter_type,
            'letter_type_label'   => config("consultant_letters.letter_types.{$letter->letter_type}", $letter->letter_type),
            'status'              => $letter->status,
            'subject'             => $letter->subject,
            'body_html'           => $letter->body_html,
            'body_json'           => $letter->body_json,
            'generation_mode'     => $letter->generation_mode,
            'generation_prompt'   => $letter->generation_prompt,
            'context_snapshot'    => $letter->context_snapshot,
            'openai_used'         => $letter->openai_used,
            'client_profile_id'   => $letter->client_profile_id,
            'client_name'         => $letter->clientProfile?->user?->name,
            'template_id'         => $letter->template_id,
            'exported_pdf_path'   => $letter->exported_pdf_path,
            'created_at'          => $letter->created_at?->toIso8601String(),
            'updated_at'          => $letter->updated_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    public function formatTemplate(ConsultantLetterTemplate $template): array
    {
        return [
            'id'                  => $template->id,
            'name'                => $template->name,
            'letter_type'         => $template->letter_type,
            'letter_type_label'   => config("consultant_letters.letter_types.{$template->letter_type}", $template->letter_type),
            'applies_to_client'   => $template->applies_to_client,
            'prompt_instructions' => $template->prompt_instructions,
            'subject_template'    => $template->subject_template,
            'body_html'           => $template->body_html,
            'body_json'           => $template->body_json,
            'is_default'          => $template->is_default,
            'created_at'          => $template->created_at?->toIso8601String(),
            'updated_at'          => $template->updated_at?->toIso8601String(),
        ];
    }
}
