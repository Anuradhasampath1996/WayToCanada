<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\ConsultantClientAiAdvisory;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use App\Support\WorkspaceAiCharacter;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WorkspaceAiAdvisorService
{
    public function __construct(
        private WorkspaceCaseRulesService $rules,
        private IrccInteractiveFormVerificationService $verificationService,
        private WorkspaceMapleCaseChatService $caseChat,
        private WorkspaceCaseDetailService $caseDetail,
        private WorkspaceMapleImmigrationKnowledgeService $immigrationKnowledge,
    ) {}

    /** @return array<string, mixed> */
    public function analyze(ClientProfile $profile, User $consultant): array
    {
        ['context' => $context, 'case_file' => $caseFile] = $this->loadCaseContext($profile, $consultant);

        $rulesAdvisory = $this->buildRulesAdvisory($context);
        $aiLayer       = $this->openAiAvailable()
            ? $this->enrichWithOpenAi($context, $rulesAdvisory)
            : null;

        $payload = $aiLayer ?? $rulesAdvisory;
        $payload['openai_used']    = $aiLayer !== null;
        $payload['generated_at']   = now()->toIso8601String();
        $payload['assistant']      = WorkspaceAiCharacter::meta();
        $payload['greeting']       = $this->buildGreeting($context);
        $payload['disclaimer']     = 'Maple assists with workflow guidance only. Verify all facts, CRS scores, and IRCC requirements before advising the client. Your RCIC professional judgment is final.';
        $payload['data_sources']   = ['case_file', 'questionnaire', 'forms_verification', 'pathway_assessment', 'crs_rules', 'legislation', 'express_entry_draws'];

        ConsultantClientAiAdvisory::create([
            'client_profile_id' => $profile->id,
            'consultant_id'     => $consultant->id,
            'workflow_stage'    => (string) ($context['case_file']['status'] ?? 'UNKNOWN'),
            'openai_used'       => $payload['openai_used'],
            'context_snapshot'  => $context,
            'advisory_payload'  => $payload,
        ]);

        return $payload;
    }

    /**
     * @param  list<array{role: string, content: string}>  $history
     * @return array<string, mixed>
     */
    public function chat(ClientProfile $profile, User $consultant, string $message, array $history = []): array
    {
        $message = trim($message);
        if ($message === '') {
            throw new \InvalidArgumentException('Message is required.');
        }

        ['context' => $context] = $this->loadCaseContext($profile, $consultant);
        $context['immigration_knowledge'] = $this->immigrationKnowledge->packForQuestion($message);

        if (! $this->openAiAvailableForChat()) {
            $fallback = $this->caseChat->reply($context, $message, $history);

            return [
                'reply'       => $fallback,
                'openai_used' => false,
                'assistant'   => WorkspaceAiCharacter::meta(),
            ];
        }

        try {
            $reply = $this->chatWithOpenAi($context, $message, $history);

            return [
                'reply'       => $reply,
                'openai_used' => true,
                'assistant'   => WorkspaceAiCharacter::meta(),
            ];
        } catch (\RuntimeException $e) {
            Log::warning('Maple chat OpenAI fallback to rules: '.$e->getMessage());

            return [
                'reply'       => $this->caseChat->reply($context, $message, $history),
                'openai_used' => false,
                'assistant'   => WorkspaceAiCharacter::meta(),
            ];
        }
    }

    /** @return array{context: array<string, mixed>, case_file: CaseFile} */
    private function loadCaseContext(ClientProfile $profile, User $consultant): array
    {
        $profile->loadMissing('user');

        $caseFile = CaseFile::firstOrCreate(
            ['client_profile_id' => $profile->id],
            ['consultant_id' => $consultant->id, 'status' => 'PENDING_ASSESSMENT'],
        );

        $caseFile->syncStatusFromAgreement();
        $caseFile = $caseFile->fresh();

        $submission   = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();
        $verification = $this->verificationService->getVerificationStatus($caseFile);
        $context      = $this->rules->buildContextPack($profile, $caseFile, $submission, $verification);
        $context['case_detail'] = $this->caseDetail->build($profile, $caseFile, $submission);

        return ['context' => $context, 'case_file' => $caseFile];
    }

    /**
     * @param  array<string, mixed>  $context
     * @param  list<array{role: string, content: string}>  $history
     */
    private function chatWithOpenAi(array $context, string $message, array $history): string
    {
        $system = WorkspaceAiCharacter::chatPersona();

        $messages = [
            ['role' => 'system', 'content' => $system],
            [
                'role'    => 'system',
                'content' => 'FULL_CASE_CONTEXT_JSON (client case facts, questionnaire detail, pathway assessment, CRS estimate — use for all client-specific answers): '
                    .json_encode($context, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
            ],
            [
                'role'    => 'system',
                'content' => 'CANADIAN_IMMIGRATION_KNOWLEDGE_JSON (CRS rules, EE draws, IRPA/IRPR excerpts, pathway guides — use for immigration law/policy answers; cite gaps if unsure): '
                    .json_encode($context['immigration_knowledge'] ?? [], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
            ],
        ];

        foreach (array_slice($history, -8) as $turn) {
            $role    = ($turn['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
            $content = trim((string) ($turn['content'] ?? ''));
            if ($content !== '') {
                $messages[] = ['role' => $role, 'content' => $content];
            }
        }

        $messages[] = ['role' => 'user', 'content' => $message];

        $response = Http::withToken(config('services.openai.key'))
            ->timeout((int) config('workspace_ai.timeout', 90))
            ->post('https://api.openai.com/v1/chat/completions', [
                'model'       => config('workspace_ai.model'),
                'temperature' => 0.3,
                'messages'    => $messages,
            ]);

        if (! $response->successful()) {
            Log::warning('Maple chat OpenAI failed', ['status' => $response->status(), 'body' => $response->body()]);
            throw new \RuntimeException('Maple could not answer right now. Please try again.');
        }

        $reply = $response->json('choices.0.message.content');

        if (! is_string($reply) || trim($reply) === '') {
            throw new \RuntimeException('Maple returned an empty response.');
        }

        return trim($reply);
    }

    /** @param array<string, mixed> $context */
    private function buildRulesAdvisory(array $context): array
    {
        $next = $context['next_action'] ?? [];
        $consultantActions = [[
            'priority' => 1,
            'action'   => $next['title'] ?? 'Continue workflow',
            'why'      => $next['description'] ?? '',
            'href'     => $next['href'] ?? null,
        ]];

        $blockers = collect($context['questionnaire_gaps'] ?? [])
            ->map(fn ($g) => $g['label'] ?? '')
            ->filter()
            ->values()
            ->all();

        $pathwayGuidance = null;
        if ($context['pathway_focus'] ?? false) {
            $pathwayGuidance = $this->defaultPathwayGuidance($context);
        }

        return [
            'current_stage'      => $context['case_file']['status'] ?? null,
            'summary'            => $this->buildRulesSummary($context),
            'next_action'        => $next,
            'consultant_actions' => $consultantActions,
            'client_actions'     => $this->clientActionsForStage($context),
            'blockers'           => $blockers,
            'pathway_guidance'   => $pathwayGuidance,
            'inadmissibility_notes' => $context['inadmissibility_flags'] ?? [],
        ];
    }

    /** @param array<string, mixed> $context */
    private function buildRulesSummary(array $context): string
    {
        $client = $context['client']['name'] ?? 'Client';
        $status = $context['case_file']['status'] ?? 'unknown';
        $next   = $context['next_action']['title'] ?? 'Continue workflow';

        return sprintf(
            "Hi! I'm %s, your case co-pilot. %s is at stage %s. I'd focus next on: %s.",
            WorkspaceAiCharacter::NAME,
            $client,
            $status,
            $next,
        );
    }

    /** @param array<string, mixed> $context */
    private function buildGreeting(array $context): string
    {
        $name = WorkspaceAiCharacter::NAME;

        if ($context['pathway_focus'] ?? false) {
            return "Hi! I'm {$name} — great timing for a pathway review. I've looked at the questionnaire and case data below.";
        }

        return "Hi! I'm {$name}, always here when you need me. Here's what I found for this client.";
    }

    /** @param array<string, mixed> $context @return list<array{action: string}> */
    private function clientActionsForStage(array $context): array
    {
        $q = $context['questionnaire'] ?? [];

        if (! ($q['is_submitted'] ?? false)) {
            return [['action' => 'Complete and submit the immigration questionnaire in the client portal.']];
        }

        if (($q['pending_refills'] ?? 0) > 0) {
            return [['action' => 'Correct questionnaire fields flagged by the consultant and resubmit.']];
        }

        if (! ($context['case_file']['immigration_pathway'] ?? null)) {
            return [['action' => 'Await consultant pathway assignment after questionnaire review.']];
        }

        if (! ($context['case_file']['agreement_signed_at'] ?? null)) {
            return [['action' => 'Review and sign the retainer agreement in the client portal.']];
        }

        return [];
    }

    /** @param array<string, mixed> $context @return array<string, mixed> */
    private function defaultPathwayGuidance(array $context): array
    {
        $crs = $context['case_file']['pathway_assessment_crs_score'] ?? null;
        $snapshot = $context['pathway_snapshot_summary'] ?? [];

        return [
            'focus' => true,
            'title' => 'Pathway recommendation stage',
            'steps' => [
                'Open the pathway calculator and confirm CRS with questionnaire prefill.',
                'Compare Express Entry, PNP, study, and work routes using latest draw trends.',
                'Document inadmissibility flags before recommending a pathway.',
                'Save assessment notes, then assign the pathway in the workspace.',
            ],
            'crs_score' => $crs,
            'snapshot_insights' => $snapshot['insights'] ?? [],
            'questionnaire_gaps_to_resolve' => collect($context['questionnaire_gaps'] ?? [])
                ->pluck('label')
                ->take(8)
                ->all(),
        ];
    }

    /** @param array<string, mixed> $context @param array<string, mixed> $rulesAdvisory */
    private function enrichWithOpenAi(array $context, array $rulesAdvisory): ?array
    {
        $pathwayFocus = (bool) ($context['pathway_focus'] ?? false);

        $system = WorkspaceAiCharacter::systemPersona();

        $userPayload = json_encode([
            'context'        => $context,
            'rules_advisory' => $rulesAdvisory,
            'pathway_focus'  => $pathwayFocus,
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

        try {
            $response = Http::withToken(config('services.openai.key'))
                ->timeout((int) config('workspace_ai.timeout', 90))
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model'           => config('workspace_ai.model'),
                    'temperature'     => 0.2,
                    'response_format' => ['type' => 'json_object'],
                    'messages'        => [
                        ['role' => 'system', 'content' => $system],
                        [
                            'role'    => 'user',
                            'content' => "As Maple, analyze this client case and return JSON with keys: summary (friendly first-person string starting with a brief greeting), consultant_actions (array of {priority, action, why}), client_actions (array of {action}), blockers (array of strings), pathway_guidance (object or null with steps, recommended_pathways, crs_notes, risks), inadmissibility_notes (array of strings). Context:\n{$userPayload}",
                        ],
                    ],
                ]);

            if (! $response->successful()) {
                Log::warning('Workspace AI advisor OpenAI failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return null;
            }

            $content = $response->json('choices.0.message.content');
            $parsed  = is_string($content) ? json_decode($content, true) : null;

            if (! is_array($parsed)) {
                return null;
            }

            return $this->mergeAiWithRules($rulesAdvisory, $parsed, $context);
        } catch (\Throwable $e) {
            Log::warning('Workspace AI advisor exception: '.$e->getMessage());

            return null;
        }
    }

    /** @param array<string, mixed> $rules @param array<string, mixed> $ai @param array<string, mixed> $context */
    private function mergeAiWithRules(array $rules, array $ai, array $context): array
    {
        $merged = $rules;

        if (! empty($ai['summary']) && is_string($ai['summary'])) {
            $merged['summary'] = $ai['summary'];
        }

        if (! empty($ai['consultant_actions']) && is_array($ai['consultant_actions'])) {
            $merged['consultant_actions'] = $this->sanitizeActions($ai['consultant_actions'], $rules['consultant_actions'] ?? []);
        }

        if (! empty($ai['client_actions']) && is_array($ai['client_actions'])) {
            $merged['client_actions'] = $ai['client_actions'];
        }

        if (! empty($ai['blockers']) && is_array($ai['blockers'])) {
            $merged['blockers'] = array_values(array_unique(array_merge(
                $rules['blockers'] ?? [],
                array_map('strval', $ai['blockers']),
            )));
        }

        if (($context['pathway_focus'] ?? false) && ! empty($ai['pathway_guidance']) && is_array($ai['pathway_guidance'])) {
            $merged['pathway_guidance'] = array_merge(
                $rules['pathway_guidance'] ?? [],
                $ai['pathway_guidance'],
            );
        }

        if (! empty($ai['inadmissibility_notes']) && is_array($ai['inadmissibility_notes'])) {
            $merged['inadmissibility_notes'] = $ai['inadmissibility_notes'];
        }

        $merged['next_action'] = $rules['next_action'];

        return $merged;
    }

    /** @param list<array<string, mixed>> $aiActions @param list<array<string, mixed>> $fallback */
    private function sanitizeActions(array $aiActions, array $fallback): array
    {
        $clean = collect($aiActions)
            ->filter(fn ($a) => is_array($a) && ! empty($a['action']))
            ->take(8)
            ->values()
            ->all();

        return $clean !== [] ? $clean : $fallback;
    }

    private function openAiAvailable(): bool
    {
        return (bool) config('workspace_ai.enabled')
            && (bool) config('services.openai.key');
    }

    private function openAiAvailableForChat(): bool
    {
        return (bool) config('workspace_ai.enabled')
            && (bool) config('services.openai.key');
    }
}
