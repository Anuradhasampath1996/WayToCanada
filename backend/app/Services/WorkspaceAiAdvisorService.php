<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\ConsultantClientAiAdvisory;
use App\Models\ConsultantClientAiChatMessage;
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
        private WorkspaceMapleCompactContextService $compactContext,
        private WorkspaceMaplePathwayAdvisorService $pathwayAdvisor,
        private WorkspaceMapleDocumentService $documents,
        private WorkspaceCaseLegislationService $caseLegislation,
    ) {}

    /** @return array<string, mixed> */
    public function state(ClientProfile $profile, User $consultant): array
    {
        $latest = ConsultantClientAiAdvisory::query()
            ->where('client_profile_id', $profile->id)
            ->where('consultant_id', $consultant->id)
            ->latest('id')
            ->first();

        $messages = ConsultantClientAiChatMessage::query()
            ->where('client_profile_id', $profile->id)
            ->where('consultant_id', $consultant->id)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->map(fn (ConsultantClientAiChatMessage $m) => [
                'role'        => $m->role,
                'content'     => $m->content,
                'openai_used' => $m->openai_used,
                'metadata'    => $m->metadata,
                'created_at'  => $m->created_at?->toIso8601String(),
            ])
            ->all();

        ['context' => $context] = $this->loadCaseContext($profile, $consultant);

        return [
            'latest_advisory'      => $latest?->advisory_payload,
            'chat_messages'        => $messages,
            'openai_available'     => $this->openAiAvailableForChat(),
            'documents'            => $this->documents->listForWorkspace($profile, $consultant),
            'relevant_legislation' => $this->caseLegislation->relevantForCase($context),
        ];
    }

    /** @return array<string, mixed> */
    public function analyze(ClientProfile $profile, User $consultant): array
    {
        ['context' => $context, 'case_file' => $caseFile] = $this->loadCaseContext($profile, $consultant);

        $rulesAdvisory = $this->buildRulesAdvisory($context);
        $aiLayer       = $this->openAiAvailable()
            ? $this->enrichWithOpenAi($context, $rulesAdvisory)
            : null;

        $payload = $aiLayer ?? $rulesAdvisory;
        $payload['openai_used']       = $aiLayer !== null;
        $payload['intelligence_mode'] = $aiLayer !== null ? 'ai_enhanced' : 'rules_engine';
        $payload['generated_at']      = now()->toIso8601String();
        $payload['assistant']         = WorkspaceAiCharacter::meta();
        $payload['greeting']          = $this->buildGreeting($context);
        $payload['disclaimer']        = 'Maple assists with workflow guidance only. Verify all facts, CRS scores, and IRCC requirements before advising the client. Your RCIC professional judgment is final.';
        $payload['data_sources']      = ['case_file', 'questionnaire', 'forms_verification', 'pathway_assessment', 'crs_rules', 'legislation', 'express_entry_draws'];
        $payload['workflow_phase']    = $context['workflow_phase'] ?? null;
        $payload['pathway_review_mode'] = (bool) ($context['pathway_review_mode'] ?? false);

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
     * @return array<string, mixed>
     */
    public function chat(ClientProfile $profile, User $consultant, string $message): array
    {
        $message = trim($message);
        if ($message === '') {
            throw new \InvalidArgumentException('Message is required.');
        }

        ['context' => $context] = $this->loadCaseContext($profile, $consultant);
        $context['immigration_knowledge'] = $this->immigrationKnowledge->packForQuestion($message);
        $context['uploaded_documents']    = $this->documents->contextPackForChat($profile, $consultant);
        $compact = $this->compactContext->forChat($context);

        $history = $this->loadChatHistory($profile, $consultant);
        $legLinks = $this->immigrationKnowledge->citationLinksForResponse($context['immigration_knowledge'] ?? []);

        if (! $this->openAiAvailableForChat()) {
            $fallback = $this->caseChat->reply($context, $message, $history);

            $this->persistChatTurn($profile, $consultant, $message, $fallback, false, $legLinks);

            return [
                'reply'              => $fallback,
                'openai_used'        => false,
                'intelligence_mode'  => 'rules_engine',
                'legislation_links'  => $legLinks,
                'assistant'          => WorkspaceAiCharacter::meta(),
            ];
        }

        try {
            $reply = $this->chatWithOpenAi(
                $compact,
                $context['immigration_knowledge'] ?? [],
                $context['uploaded_documents'] ?? [],
                $message,
                $history,
            );

            $this->persistChatTurn($profile, $consultant, $message, $reply, true, $legLinks);

            return [
                'reply'              => $reply,
                'openai_used'        => true,
                'intelligence_mode'  => 'ai_enhanced',
                'legislation_links'  => $legLinks,
                'assistant'          => WorkspaceAiCharacter::meta(),
            ];
        } catch (\RuntimeException $e) {
            Log::warning('Maple chat OpenAI fallback to rules: '.$e->getMessage());

            $fallback = $this->caseChat->reply($context, $message, $history);
            $this->persistChatTurn($profile, $consultant, $message, $fallback, false, $legLinks);

            return [
                'reply'              => $fallback,
                'openai_used'        => false,
                'intelligence_mode'  => 'rules_engine',
                'fallback_reason'    => $e->getMessage(),
                'legislation_links'  => $legLinks,
                'assistant'          => WorkspaceAiCharacter::meta(),
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
     * @param  array<string, mixed>  $compact
     * @param  array<string, mixed>  $immigrationKnowledge
     * @param  list<array{filename: string, text: string, char_count: int}>  $uploadedDocuments
     * @param  list<array{role: string, content: string}>  $history
     */
    private function chatWithOpenAi(
        array $compact,
        array $immigrationKnowledge,
        array $uploadedDocuments,
        string $message,
        array $history,
    ): string {
        $system = WorkspaceAiCharacter::chatPersona();

        $messages = [
            ['role' => 'system', 'content' => $system],
            [
                'role'    => 'system',
                'content' => 'FULL_CASE_CONTEXT_JSON: '
                    .json_encode($compact, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
            ],
            [
                'role'    => 'system',
                'content' => 'CANADIAN_IMMIGRATION_KNOWLEDGE_JSON: '
                    .json_encode($immigrationKnowledge, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
            ],
        ];

        if ($uploadedDocuments !== []) {
            $messages[] = [
                'role'    => 'system',
                'content' => 'UPLOADED_DOCUMENTS_JSON: '
                    .json_encode($uploadedDocuments, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
            ];
        }

        foreach (array_slice($history, -16) as $turn) {
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

    /** @param array<string, mixed> $context @return list<string> */
    private function resolveBlockers(array $context): array
    {
        $phase = (string) ($context['workflow_phase'] ?? '');
        $gaps  = collect($context['questionnaire_gaps'] ?? []);

        if (in_array($phase, ['case_hub', 'post_agreement', 'application_forms'], true)) {
            return $gaps
                ->filter(fn ($g) => ($g['severity'] ?? '') === 'error')
                ->pluck('label')
                ->filter()
                ->values()
                ->all();
        }

        return $gaps->pluck('label')->filter()->values()->all();
    }

    /** @param array<string, mixed> $context @return list<string> */
    private function resolveOptionalGaps(array $context): array
    {
        $phase = (string) ($context['workflow_phase'] ?? '');
        if (! in_array($phase, ['case_hub', 'post_agreement', 'application_forms'], true)) {
            return [];
        }

        return collect($context['questionnaire_gaps'] ?? [])
            ->filter(fn ($g) => ($g['severity'] ?? '') !== 'error')
            ->pluck('label')
            ->filter()
            ->take(6)
            ->values()
            ->all();
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

        $blockers = $this->resolveBlockers($context);

        $pathwayGuidance = null;
        if ($context['pathway_focus'] ?? false) {
            $pathwayGuidance = $this->defaultPathwayGuidance($context);
        }

        $consultantActions = collect($consultantActions);
        if (($context['pathway_review_mode'] ?? false) && ($context['workflow_phase'] ?? '') === 'post_agreement') {
            $consultantActions->push([
                'priority' => 2,
                'action'   => 'Continue post-agreement workflow',
                'why'      => 'Retainer is signed — focus on application forms, documents, and case hub tasks rather than re-verifying the whole questionnaire unless gaps block progress.',
            ]);
        }

        $nextTitle = (string) ($next['title'] ?? '');
        $consultantActions = $consultantActions
            ->reject(fn ($a) => $nextTitle !== '' && ($a['action'] ?? '') === $nextTitle)
            ->values();

        return [
            'current_stage'      => $context['case_file']['status'] ?? null,
            'workflow_phase'     => $context['workflow_phase'] ?? null,
            'summary'            => $this->buildRulesSummary($context),
            'next_action'        => $next,
            'consultant_actions' => $consultantActions->take(8)->values()->all(),
            'client_actions'     => $this->clientActionsForStage($context),
            'blockers'           => $blockers,
            'pathway_guidance'   => $pathwayGuidance,
            'inadmissibility_notes' => $context['inadmissibility_flags'] ?? [],
        ];
    }

    /** @param array<string, mixed> $context */
    private function buildRulesSummary(array $context): string
    {
        $client = $this->clientDisplayName($context);
        $status = $context['case_file']['status'] ?? 'unknown';
        $next   = $context['next_action']['title'] ?? 'Continue workflow';
        $pathway = $context['case_file']['immigration_pathway'] ?? null;

        if ($context['pathway_review_mode'] ?? false) {
            return $pathway
                ? "{$client} — stage {$status}, {$pathway} assigned. Workflow focus: {$next}."
                : "{$client} — stage {$status}. Workflow focus: {$next}.";
        }

        return sprintf(
            '%s is at stage %s. I\'d focus next on: %s.',
            $client,
            $status,
            $next,
        );
    }

    /** @param array<string, mixed> $context */
    private function clientDisplayName(array $context): string
    {
        $facts = $context['case_facts'] ?? [];

        return (string) (
            $facts['main_applicant']['display_name']
            ?? $context['client']['name']
            ?? 'Client'
        );
    }

    /** @param array<string, mixed> $context */
    private function buildGreeting(array $context): string
    {
        $name = WorkspaceAiCharacter::NAME;

        if ($context['pathway_review_mode'] ?? false) {
            $pathway = $context['case_file']['immigration_pathway'] ?? 'the assigned pathway';
            $client  = $this->clientDisplayName($context);

            return "Hi! I'm {$name}. I reviewed {$client}'s assigned pathway ({$pathway}) against their questionnaire and case stage.";
        }

        if ($context['pathway_focus'] ?? false) {
            return "Hi! I'm {$name} — pathway review ready. I've looked at the questionnaire and case data below.";
        }

        return "Hi! I'm {$name}, always here when you need me. Here's what I found for this client.";
    }

    /** @param array<string, mixed> $context @return list<array{action: string}> */
    private function clientActionsForStage(array $context): array
    {
        $phase = $context['workflow_phase'] ?? '';
        $verification = $context['forms_verification'] ?? [];

        if (in_array($phase, ['application_forms', 'case_hub', 'post_agreement'], true)) {
            $total = (int) ($verification['total_forms'] ?? 0);
            if ($total > 0 && ! ($verification['all_submitted'] ?? false)) {
                return [['action' => 'Complete and submit assigned IRCC application forms in the client portal.']];
            }
            if ($total > 0 && ! ($verification['all_reviewed'] ?? false)) {
                return [['action' => 'Await consultant review of submitted application forms.']];
            }

            return [['action' => 'Upload requested documents and monitor case hub tasks from the client portal.']];
        }

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
        $assigned   = $context['case_file']['immigration_pathway'] ?? null;
        $reviewMode = (bool) ($context['pathway_review_mode'] ?? false);
        $snapshot   = $context['pathway_snapshot_summary'] ?? [];
        $optionalGaps = $this->resolveOptionalGaps($context);

        if ($reviewMode && $assigned) {
            $review = $this->pathwayAdvisor->buildStructuredReview($context);

            return [
                'focus'                => true,
                'title'                => 'Pathway review — '.$assigned,
                'headline'             => $review['headline'] ?? null,
                'verdict'              => $review['verdict'] ?? 'reasonable',
                'assigned_pathway'     => $assigned,
                'case_facts'           => $review['case_facts'] ?? [],
                'assessment_points'    => $review['assessment_points'] ?? [],
                'crs_notes'            => $review['crs_notes'] ?? null,
                'risks'                => $review['risks'] ?? [],
                'recommended_pathways' => $review['recommended_pathways'] ?? [],
                'rcic_next_step'       => $review['rcic_next_step'] ?? null,
                'snapshot_insights'    => $snapshot['insights'] ?? [],
                'questionnaire_gaps_to_resolve' => $reviewMode
                    ? []
                    : collect($context['questionnaire_gaps'] ?? [])->pluck('label')->take(8)->all(),
                'optional_questionnaire_cleanup' => $optionalGaps,
                'legislation_refs'     => $review['legislation_refs'] ?? [],
            ];
        }

        $crs = $context['case_file']['pathway_assessment_crs_score']
            ?? $context['case_detail']['crs_estimate']['crs_total']
            ?? null;

        return [
            'focus' => true,
            'title' => 'Pathway recommendation stage',
            'steps' => [
                'Open the pathway calculator and confirm CRS with questionnaire prefill.',
                'Compare Express Entry, PNP, study, and work routes using latest draw trends.',
                'Document inadmissibility flags before recommending a pathway.',
                'Save assessment notes, then assign the pathway in the workspace.',
            ],
            'assigned_pathway' => $assigned,
            'crs_score'        => $crs,
            'snapshot_insights'=> $snapshot['insights'] ?? [],
            'questionnaire_gaps_to_resolve' => collect($context['questionnaire_gaps'] ?? [])
                ->pluck('label')
                ->take(8)
                ->all(),
            'legislation_refs' => $this->caseLegislation->relevantForCase($context, 5),
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
                            'content' => "As Maple, analyze this client case and return JSON with keys: summary (friendly first-person string starting with a brief greeting), consultant_actions (array of {priority, action, why}), client_actions (array of {action}), blockers (array of strings), pathway_guidance (object or null with steps, recommended_pathways, crs_notes, risks, assigned_pathway_review), inadmissibility_notes (array of strings). When pathway_review_mode is true, evaluate whether the assigned pathway still fits. Context:\n{$userPayload}",
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
        } elseif (($context['pathway_focus'] ?? false) && ! empty($rules['pathway_guidance'])) {
            $merged['pathway_guidance'] = $rules['pathway_guidance'];
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

    /** @return list<array{role: string, content: string, metadata?: array<string, mixed>|null}> */
    private function loadChatHistory(ClientProfile $profile, User $consultant): array
    {
        return ConsultantClientAiChatMessage::query()
            ->where('client_profile_id', $profile->id)
            ->where('consultant_id', $consultant->id)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->map(fn (ConsultantClientAiChatMessage $m) => [
                'role'     => $m->role,
                'content'  => $m->content,
                'metadata' => $m->metadata,
            ])
            ->all();
    }

    /** @param  list<array<string, mixed>>  $legislationLinks */
    private function persistChatTurn(
        ClientProfile $profile,
        User $consultant,
        string $userMessage,
        string $reply,
        bool $openAiUsed,
        array $legislationLinks = [],
    ): void {
        ConsultantClientAiChatMessage::create([
            'client_profile_id' => $profile->id,
            'consultant_id'     => $consultant->id,
            'role'              => 'user',
            'content'           => $userMessage,
            'openai_used'       => null,
        ]);

        ConsultantClientAiChatMessage::create([
            'client_profile_id' => $profile->id,
            'consultant_id'     => $consultant->id,
            'role'              => 'assistant',
            'content'           => $reply,
            'openai_used'       => $openAiUsed,
            'metadata'          => $legislationLinks !== [] ? ['legislation_links' => $legislationLinks] : null,
        ]);
    }
}
