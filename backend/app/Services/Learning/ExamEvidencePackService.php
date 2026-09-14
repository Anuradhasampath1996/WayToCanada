<?php

namespace App\Services\Learning;

use App\Models\Academy\AcademyExam;
use App\Models\Academy\AcademyExamEvidenceItem;
use App\Models\Academy\AcademyExamEvidencePack;
use App\Models\Academy\AcademyExamFieldAudit;
use App\Models\Academy\AcademyExamGenerationOverride;
use App\Models\Lms\LmsExam;
use App\Models\Lms\LmsExamEvidenceItem;
use App\Models\Lms\LmsExamEvidencePack;
use App\Models\Lms\LmsExamFieldAudit;
use App\Models\Lms\LmsExamGenerationOverride;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ExamEvidencePackService
{
    public const OFFICIAL_SOURCE_TYPES = [
        'official_exam_page',
        'official_candidate_guide',
        'official_exam_handbook',
        'official_exam_blueprint',
        'official_syllabus',
        'official_government_page',
        'official_regulator_page',
        'official_sample_questions',
        'official_practice_paper',
        'official_past_paper',
        'official_competency_framework',
        'official_scoring',
    ];

    /**
     * @param  array<string, mixed>  $payload
     */
    public function ingestItem(string $productDomain, int $examId, array $payload, ?User $actor = null): object
    {
        $pack = $this->ensurePack($productDomain, $examId);
        $url = (string) ($payload['url'] ?? '');
        $profile = $this->profileFor($productDomain, $examId);
        $hostOfficial = $this->hostIsOfficial($profile, $url);

        $flag = $payload['classification_flag'] ?? null;
        $isOfficial = (bool) ($payload['is_official'] ?? false);
        $sourceType = (string) ($payload['source_type'] ?? 'unknown');

        if (! empty($payload['suspected_leak']) || $flag === 'unverified_exam_material') {
            $flag = 'unverified_exam_material';
            $isOfficial = false;
        } elseif ($hostOfficial && in_array($sourceType, self::OFFICIAL_SOURCE_TYPES, true)) {
            $isOfficial = true;
        } elseif ($isOfficial && ! $hostOfficial) {
            $isOfficial = false;
            $flag = $flag ?: 'unofficial_host';
        }

        if ($flag === 'unverified_exam_material') {
            $payload['verification_status'] = 'unverified';
            $payload['usage_permission_status'] = AcademyExamEvidenceItem::USAGE_PROHIBITED;
        }

        $usage = $this->classifyUsagePermission($payload);
        $robots = array_key_exists('robots_txt_allowed', $payload) ? (bool) $payload['robots_txt_allowed'] : null;
        if ($usage === AcademyExamEvidenceItem::USAGE_REUSE_ALLOWED && $robots === true && ($payload['usage_permission_status'] ?? null) === null) {
            $usage = AcademyExamEvidenceItem::USAGE_UNKNOWN;
        }

        $body = (string) ($payload['body'] ?? $payload['excerpt'] ?? '');
        $hash = $payload['content_hash'] ?? ($body !== '' ? hash('sha256', $body) : null);

        $storeFull = $usage === AcademyExamEvidenceItem::USAGE_REUSE_ALLOWED
            && ($payload['verification_status'] ?? 'unverified') === 'verified'
            && $flag !== 'unverified_exam_material'
            && $isOfficial;

        $disk = $storeFull ? 'local' : null;
        $path = null;
        if ($storeFull && $body !== '') {
            $path = 'exam-evidence/'.$productDomain.'/'.$examId.'/'.Str::uuid().'.bin';
            Storage::disk('local')->put($path, $body);
        }

        $attrs = [
            'pack_id' => $pack->id,
            'source_type' => $sourceType,
            'authority' => $payload['authority'] ?? null,
            'url' => $url ?: null,
            'title' => $payload['title'] ?? null,
            'publication_date' => $payload['publication_date'] ?? null,
            'effective_date' => $payload['effective_date'] ?? null,
            'version_label' => $payload['version_label'] ?? null,
            'retrieved_at' => $payload['retrieved_at'] ?? now(),
            'content_hash' => $hash,
            'is_official' => $isOfficial,
            'verification_status' => $flag === 'unverified_exam_material'
                ? 'unverified'
                : ($payload['verification_status'] ?? 'unverified'),
            'usage_permission_status' => $usage,
            'robots_txt_allowed' => $robots,
            'snapshot_disk' => $disk,
            'snapshot_path' => $path,
            'full_file_stored' => (bool) $path,
            'excerpt' => $this->excerpt($payload, $usage),
            'pattern_metadata_json' => $payload['pattern_metadata_json'] ?? null,
            'disabled' => false,
            'classification_flag' => $flag,
        ];

        $item = $productDomain === 'client_lms'
            ? LmsExamEvidenceItem::query()->create($attrs)
            : AcademyExamEvidenceItem::query()->create($attrs);

        $this->refreshPackCounters($pack);

        return $item;
    }

    /**
     * @param  array<string, mixed>  $manus
     * @param  array<string, mixed>  $openai
     * @return array{agreement:bool,disagreement:bool,verified_facts:array<string,mixed>,unverified_facts:array<string,mixed>}
     */
    public function recordIndependentResearch(object $pack, array $manus, array $openai): array
    {
        $comparison = $this->compareResearch($manus, $openai, $pack);

        $pack->manus_research_json = $manus;
        $pack->openai_verification_json = $openai;
        $pack->research_provider = 'hybrid';
        $pack->researched_at = now();
        if ($comparison['disagreement']) {
            $pack->status = 'review_required';
        }
        $pack->save();

        return $comparison;
    }

    /**
     * @param  array<string, mixed>  $manus
     * @param  array<string, mixed>  $openai
     * @return array{agreement:bool,disagreement:bool,verified_facts:array<string,mixed>,unverified_facts:array<string,mixed>}
     */
    public function compareResearch(array $manus, array $openai, object $pack): array
    {
        $keys = ['total_questions', 'duration_minutes', 'question_types', 'section_structure', 'syllabus', 'competencies'];
        $disagreement = false;
        $verified = [];
        $unverified = [];

        foreach ($keys as $key) {
            $m = $manus[$key] ?? null;
            $o = $openai[$key] ?? null;
            if ($m !== null && $o !== null && $m !== $o) {
                $disagreement = true;
                $unverified[$key] = ['manus' => $m, 'openai' => $o];
                continue;
            }
            $claim = $m ?? $o;
            if ($claim === null) {
                continue;
            }
            $official = $this->officialItemSupportsFact($pack, $key);
            if ($official) {
                $verified[$key] = $claim;
            } else {
                $unverified[$key] = ['claim' => $claim, 'reason' => 'model_agreement_without_official_source'];
            }
        }

        return [
            'agreement' => ! $disagreement && $unverified === [],
            'disagreement' => $disagreement,
            'verified_facts' => $verified,
            'unverified_facts' => $unverified,
        ];
    }

    public function markAdminAssertedStructure(string $productDomain, int $examId, User $actor, array $format, string $reason, ?string $supportingUrl = null): object
    {
        $exam = $this->exam($productDomain, $examId);
        $previous = json_encode($exam->exam_format_json);
        $exam->exam_format_json = $format;
        $exam->structure_verification_status = 'admin_asserted';
        $exam->structure_entered_by = $actor->id;
        $exam->structure_entered_at = now();
        $exam->structure_entered_reason = $reason;
        $exam->structure_supporting_url = $supportingUrl;
        $exam->save();

        $this->audit($productDomain, $examId, $actor->id, 'exam_format_json', $previous, json_encode($format), $reason);

        return $exam->fresh();
    }

    public function applyOfficialStructure(object $exam, array $format, object $officialItem): void
    {
        if (! $officialItem->is_official || $officialItem->verification_status !== 'verified') {
            return;
        }
        $exam->exam_format_json = $format;
        $exam->structure_verification_status = 'verified';
        $exam->last_verified_at = now();
        $exam->save();
    }

    public function refreshDoesNotOverwriteApproved(object $pack, array $proposedExamFields, bool $adminApprovedReplace): array
    {
        $blocked = [];
        if ($pack->approved_at && ! $adminApprovedReplace) {
            $blocked = array_keys($proposedExamFields);
        }

        return [
            'applied' => $adminApprovedReplace ? $proposedExamFields : [],
            'blocked' => $blocked,
        ];
    }

    public function detectStaleness(object $pack, ?object $exam = null): ?string
    {
        $items = $pack->items()->where('disabled', false)->get();
        foreach ($items as $item) {
            if ($item->classification_flag === 'new_official_version' || ($item->version_label && $this->newerVersionExists($items, $item))) {
                return 'new_official_version';
            }
        }

        $reason = $pack->stale_reason;
        if (in_array($reason, ['source_content_changed', 'authority_change_notice', 'source_removed', 'new_official_version'], true)) {
            return $reason;
        }

        $profile = $exam->generation_profile ?? 'rcic_exam_prep';
        $days = $exam->verification_interval_days
            ?? config('learning.verification_intervals_days.'.$profile)
            ?? 90;
        $anchor = $pack->last_verified_at ?? $pack->approved_at ?? $pack->researched_at;
        if ($anchor && Carbon::parse($anchor)->addDays((int) $days)->isPast()) {
            return 'verification_interval_expired';
        }

        return null;
    }

    public function markHashChanged(object $item, string $newHash): void
    {
        if ($item->content_hash && $item->content_hash !== $newHash) {
            $item->content_hash = $newHash;
            $item->verification_status = 'review_required';
            $item->save();
            $pack = $item->pack;
            $pack->stale_reason = 'source_content_changed';
            $pack->status = 'outdated';
            $pack->save();
        }
    }

    public function markNewOfficialVersion(object $pack): void
    {
        $pack->stale_reason = 'new_official_version';
        $pack->status = 'outdated';
        $pack->next_review_at = now();
        $pack->save();
    }

    public function nextReviewAt(string $profile, $from = null): Carbon
    {
        $days = (int) (config('learning.verification_intervals_days.'.$profile) ?? 90);

        return Carbon::parse($from ?? now())->addDays($days);
    }

    /**
     * @return array<string, mixed>
     */
    public function evidenceSummary(string $productDomain, int $examId): array
    {
        $exam = $this->exam($productDomain, $examId);
        $pack = $this->ensurePack($productDomain, $examId);
        $this->refreshPackCounters($pack);
        $pack->refresh();
        $stale = $this->detectStaleness($pack, $exam);
        if ($stale) {
            $pack->stale_reason = $stale;
            $pack->save();
        }

        $officialVerified = $pack->items()
            ->where('disabled', false)
            ->where('is_official', true)
            ->where('verification_status', 'verified')
            ->where(function ($q) {
                $q->whereNull('classification_flag')
                    ->orWhere('classification_flag', '!=', 'unverified_exam_material');
            })
            ->get();

        $hasOfficialIdentity = $officialVerified->contains(function ($item) {
            return in_array($item->source_type, [
                'official_exam_page', 'official_candidate_guide', 'official_exam_handbook',
                'official_exam_blueprint', 'official_syllabus', 'official_government_page',
                'official_regulator_page',
            ], true);
        });

        $format = $exam->exam_format_json ?? [];
        $criticalUnverified = $this->criticalStructureUnverified($format, $officialVerified->all(), $exam->structure_verification_status);

        $syllabus = $pack->syllabus_found ? 'Verified' : 'Not Found';
        $competency = $pack->competency_framework_found ? 'Verified' : 'Not Found';

        $criticalStale = $stale && $criticalUnverified === false ? 0 : ($stale ? 1 : 0);
        if ($stale && in_array($stale, ['new_official_version', 'source_content_changed', 'authority_change_notice', 'source_removed', 'verification_interval_expired'], true)) {
            $criticalStale = 1;
        }

        return [
            'exam_structure' => $exam->structure_verification_status === 'verified' ? 'Verified' : ($exam->structure_verification_status === 'admin_asserted' ? 'Admin Asserted' : 'Review Required'),
            'official_authority' => $hasOfficialIdentity ? 'Verified' : 'Review Required',
            'current_duration' => ! empty($format['duration_minutes']) && $exam->structure_verification_status === 'verified' ? 'Verified' : ($criticalUnverified ? 'Critical Structure Unverified' : 'Review Required'),
            'question_structure' => ! empty($format['total_questions']) && $exam->structure_verification_status === 'verified' ? 'Verified' : ($criticalUnverified ? 'Critical Structure Unverified' : 'Review Required'),
            'syllabus' => $syllabus,
            'competency_framework' => $competency,
            'official_samples' => (int) $pack->official_sample_paper_count,
            'official_public_past_papers' => (int) $pack->public_past_paper_count,
            'source_conflicts' => (int) $pack->unresolved_conflict_count,
            'critical_stale_sources' => $criticalStale,
            'evidence_pack' => $pack->approved_at ? 'APPROVED' : strtoupper(str_replace('_', ' ', (string) $pack->status)),
            'critical_structure_unverified' => $criticalUnverified,
            'stale_reason' => $stale,
            'pack_id' => $pack->id,
            'pack_status' => $pack->status,
            'approved' => (bool) $pack->approved_at,
            'admin_asserted_only' => $exam->structure_verification_status === 'admin_asserted' && ! $hasOfficialIdentity,
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array{ok:bool,code:?string,message:?string,summary:array<string,mixed>}
     */
    public function generationGate(string $productDomain, int $examId, User $actor, array $options = []): array
    {
        $summary = $this->evidenceSummary($productDomain, $examId);
        $exam = $this->exam($productDomain, $examId);
        $pack = $this->ensurePack($productDomain, $examId);

        if (! $exam->generation_profile) {
            return $this->gateFail('missing_profile', 'Generation profile is required.', $summary);
        }

        $expectedDomain = config('learning.generation_profiles.'.$exam->generation_profile.'.product_domain');
        if (is_string($expectedDomain) && $expectedDomain !== $productDomain) {
            return $this->gateFail(
                'profile_domain_mismatch',
                $productDomain === 'client_lms'
                    ? 'This generation profile cannot target Client LMS exams.'
                    : 'This generation profile cannot target RCIC Academy exams.',
                $summary
            );
        }

        if ($summary['admin_asserted_only']) {
            return $this->gateFail('minimum_evidence_missing', 'Admin-entered structure alone is not sufficient. A verified official authority source is required.', $summary);
        }

        if ($summary['official_authority'] !== 'Verified') {
            return $this->gateFail('minimum_evidence_missing', 'At least one verified official exam-authority source is required.', $summary);
        }

        if ((int) $summary['source_conflicts'] > 0) {
            return $this->gateFail('exam_source_conflict', 'Unresolved official source conflicts block generation.', $summary);
        }

        if ($summary['critical_structure_unverified'] && ($options['include_mock'] ?? true)) {
            return $this->gateFail('critical_structure_unverified', 'Critical mock structure is unverified.', $summary);
        }

        if ($summary['critical_stale_sources'] > 0) {
            return $this->gateFail('exam_reverification_required', 'Critical evidence is stale and must be reviewed.', $summary);
        }

        if (! $pack->approved_at) {
            return $this->gateFail('pack_not_approved', 'Approve the Exam Evidence Pack before generating.', $summary);
        }

        $warning = $options['warning_code'] ?? null;
        if ($warning && in_array($warning, ['missing_samples', 'missing_competency_framework', 'missing_past_papers'], true)) {
            $reason = trim((string) ($options['override_reason'] ?? ''));
            if ($reason === '') {
                return $this->gateFail('override_reason_required', 'Non-critical warning override requires an audited reason.', $summary);
            }
            $this->recordOverride($productDomain, $examId, $actor->id, $warning, $reason);
        }

        return ['ok' => true, 'code' => null, 'message' => null, 'summary' => $summary];
    }

    public function recordConflict(object $pack, string $field, mixed $a, mixed $b): void
    {
        $conflicts = $pack->unresolved_conflicts_json ?? [];
        $conflicts[] = ['field' => $field, 'values' => [$a, $b], 'flag' => 'exam_source_conflict'];
        $pack->unresolved_conflicts_json = $conflicts;
        $pack->unresolved_conflict_count = count($conflicts);
        $pack->status = 'source_conflict';
        $pack->save();
    }

    public function resolveConflictWithNewerOfficial(object $pack, object $newerItem): void
    {
        if (! $newerItem->is_official || $newerItem->verification_status !== 'verified') {
            return;
        }
        $pack->unresolved_conflicts_json = [];
        $pack->unresolved_conflict_count = 0;
        if ($pack->status === 'source_conflict') {
            $pack->status = 'review_required';
        }
        $pack->save();
    }

    public function approvePack(string $productDomain, int $examId, User $actor): object
    {
        $pack = $this->ensurePack($productDomain, $examId);
        $summary = $this->evidenceSummary($productDomain, $examId);
        if ($summary['official_authority'] !== 'Verified') {
            throw ValidationException::withMessages(['pack' => 'Cannot approve without a verified official authority source.']);
        }
        if ((int) $summary['source_conflicts'] > 0) {
            throw ValidationException::withMessages(['pack' => 'Resolve source conflicts before approval.']);
        }
        $pack->approved_at = now();
        $pack->approved_by = $actor->id;
        $pack->status = 'verified';
        $pack->last_verified_at = now();
        $exam = $this->exam($productDomain, $examId);
        $pack->next_review_at = $this->nextReviewAt($exam->generation_profile);
        $pack->save();

        return $pack->fresh('items');
    }

    public function analyzeOfficialSample(object $item, array $pattern): array
    {
        if (! $item->is_official || $item->verification_status !== 'verified') {
            throw ValidationException::withMessages(['item' => 'Only verified official samples may be analyzed.']);
        }
        if ($item->classification_flag === 'unverified_exam_material') {
            throw ValidationException::withMessages(['item' => 'Unverified exam material cannot be analyzed as authoritative.']);
        }
        $item->pattern_metadata_json = $pattern;
        $item->save();

        return $pattern;
    }

    public function manusCannotWriteExam(object $exam, array $manusNotes): void
    {
        // Intentionally no-op on Exam Master fields. Callers must persist ResearchNotes only.
        unset($manusNotes);
        $exam->refresh();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function classifyUsagePermission(array $payload): string
    {
        $explicit = $payload['usage_permission_status'] ?? null;
        if (is_string($explicit) && $explicit !== '') {
            if ($explicit === AcademyExamEvidenceItem::USAGE_REUSE_ALLOWED && ! empty($payload['robots_txt_allowed']) && empty($payload['licence_allows_reuse'])) {
                return AcademyExamEvidenceItem::USAGE_UNKNOWN;
            }

            return $explicit;
        }

        if (! empty($payload['suspected_leak'])) {
            return AcademyExamEvidenceItem::USAGE_PROHIBITED;
        }

        if (! empty($payload['licence_allows_reuse'])) {
            return AcademyExamEvidenceItem::USAGE_REUSE_ALLOWED;
        }

        if (! empty($payload['robots_txt_allowed'])) {
            return AcademyExamEvidenceItem::USAGE_UNKNOWN;
        }

        return AcademyExamEvidenceItem::USAGE_UNKNOWN;
    }

    public function coverageReport(array $requiredCompetencies, array $coveredCompetencies, array $requiredTopics, array $coveredTopics, array $requiredSections, array $coveredSections): array
    {
        $missingComp = array_values(array_diff($requiredCompetencies, $coveredCompetencies));
        $missingTopics = array_values(array_diff($requiredTopics, $coveredTopics));
        $missingSections = array_values(array_diff($requiredSections, $coveredSections));
        $gap = $missingComp !== [] || $missingTopics !== [] || $missingSections !== [];

        return [
            'competencies_covered' => count($coveredCompetencies).'/'.count($requiredCompetencies),
            'syllabus_topics_covered' => count($coveredTopics).'/'.count($requiredTopics),
            'exam_sections_represented' => count($coveredSections).'/'.count($requiredSections),
            'missing_competencies' => $missingComp,
            'missing_topics' => $missingTopics,
            'missing_sections' => $missingSections,
            'flag' => $gap ? 'coverage_gap' : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $mix
     */
    public function mockPoolSufficient(int $eligible, array $required, array $mix, bool $allowFallback = false): array
    {
        $need = (int) ($required['total'] ?? 0);
        if ($eligible < $need) {
            return ['ok' => false, 'code' => 'insufficient_question_pool', 'message' => 'Insufficient Question Pool'];
        }
        foreach (['topic', 'competency', 'difficulty', 'section'] as $dim) {
            $want = $mix[$dim] ?? null;
            if (is_array($want) && $want !== [] && ! $allowFallback && empty($required[$dim.'_satisfied'])) {
                return ['ok' => false, 'code' => 'insufficient_question_pool', 'message' => 'Insufficient Question Pool'];
            }
        }

        return ['ok' => true, 'code' => null, 'message' => null];
    }

    public function nearCopy(string $generatedStem, string $officialStem): bool
    {
        $a = preg_replace('/\s+/', ' ', mb_strtolower(trim($generatedStem)));
        $b = preg_replace('/\s+/', ' ', mb_strtolower(trim($officialStem)));
        similar_text($a, $b, $pct);
        if ($pct >= 85) {
            return true;
        }
        $strippedA = preg_replace('/\b(\d+|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|[A-Z][a-z]+)\b/u', '', $a);

        return similar_text($strippedA, $b, $pct2) >= 80;
    }

    public function examRelevance(array $questionCompetencies, array $examCompetencies): bool
    {
        if ($examCompetencies === []) {
            return true;
        }

        return array_intersect($questionCompetencies, $examCompetencies) !== [];
    }

    public function ensurePack(string $productDomain, int $examId): object
    {
        if ($productDomain === 'client_lms') {
            return LmsExamEvidencePack::query()->firstOrCreate(
                ['exam_id' => $examId],
                ['product_domain' => 'client_lms', 'status' => 'researching', 'critical_structure_unverified' => true]
            );
        }

        return AcademyExamEvidencePack::query()->firstOrCreate(
            ['exam_id' => $examId],
            ['product_domain' => 'rcic_academy', 'status' => 'researching', 'critical_structure_unverified' => true]
        );
    }

    public function exam(string $productDomain, int $examId): object
    {
        return $productDomain === 'client_lms'
            ? LmsExam::query()->findOrFail($examId)
            : AcademyExam::query()->findOrFail($examId);
    }

    private function refreshPackCounters(object $pack): void
    {
        $items = $pack->items()->where('disabled', false)->get();
        $pack->source_count = $items->count();
        $pack->official_source_count = $items->where('is_official', true)->where('verification_status', 'verified')->count();
        $pack->official_sample_paper_count = $items->whereIn('source_type', ['official_sample_questions', 'official_practice_paper'])->where('is_official', true)->count();
        $pack->public_past_paper_count = $items->where('source_type', 'official_past_paper')->where('is_official', true)->where('classification_flag', '!=', 'unverified_exam_material')->count();
        $pack->blueprint_found = $items->contains(fn ($i) => $i->source_type === 'official_exam_blueprint' && $i->is_official);
        $pack->syllabus_found = $items->contains(fn ($i) => $i->source_type === 'official_syllabus' && $i->is_official);
        $pack->competency_framework_found = $items->contains(fn ($i) => $i->source_type === 'official_competency_framework' && $i->is_official);
        $pack->exam_structure_verified = $items->contains(fn ($i) => $i->is_official && $i->verification_status === 'verified' && in_array($i->source_type, ['official_exam_page', 'official_candidate_guide', 'official_exam_handbook', 'official_exam_blueprint'], true));
        $pack->save();
    }

    private function hostIsOfficial(string $profile, string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        if ($host === '') {
            return false;
        }
        $allowed = config('learning.official_hosts.'.$profile, []);

        return in_array($host, $allowed, true);
    }

    private function profileFor(string $productDomain, int $examId): string
    {
        return (string) $this->exam($productDomain, $examId)->generation_profile;
    }

    private function officialItemSupportsFact(object $pack, string $key): bool
    {
        return $pack->items()
            ->where('disabled', false)
            ->where('is_official', true)
            ->where('verification_status', 'verified')
            ->where(function ($q) {
                $q->whereNull('classification_flag')
                    ->orWhere('classification_flag', '!=', 'unverified_exam_material');
            })
            ->exists();
    }

    /**
     * @param  list<object>  $officialItems
     */
    private function criticalStructureUnverified(array $format, array $officialItems, string $structureStatus): bool
    {
        if ($structureStatus !== 'verified' || $officialItems === []) {
            return true;
        }
        foreach (['duration_minutes', 'total_questions'] as $field) {
            if (! isset($format[$field]) || $format[$field] === null || $format[$field] === '') {
                return true;
            }
        }

        return false;
    }

    private function newerVersionExists($items, object $item): bool
    {
        return $items->contains(function ($other) use ($item) {
            return $other->id !== $item->id
                && $other->is_official
                && $other->source_type === $item->source_type
                && $other->version_label
                && $item->version_label
                && version_compare((string) $other->version_label, (string) $item->version_label, '>');
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function excerpt(array $payload, string $usage): ?string
    {
        $text = (string) ($payload['excerpt'] ?? '');
        if ($text === '' && isset($payload['body']) && $usage !== AcademyExamEvidenceItem::USAGE_REUSE_ALLOWED) {
            $text = mb_substr((string) $payload['body'], 0, 500);
        }

        return $text !== '' ? $text : null;
    }

    private function audit(string $productDomain, int $examId, int $actorId, string $field, ?string $previous, ?string $next, ?string $reason): void
    {
        $attrs = [
            'exam_id' => $examId,
            'actor_user_id' => $actorId,
            'field' => $field,
            'previous_value' => $previous,
            'new_value' => $next,
            'reason' => $reason,
        ];
        if ($productDomain === 'client_lms') {
            LmsExamFieldAudit::query()->create($attrs);

            return;
        }
        AcademyExamFieldAudit::query()->create($attrs);
    }

    private function recordOverride(string $productDomain, int $examId, int $actorId, string $code, string $reason): void
    {
        $attrs = [
            'exam_id' => $examId,
            'actor_user_id' => $actorId,
            'warning_code' => $code,
            'reason' => $reason,
        ];
        if ($productDomain === 'client_lms') {
            LmsExamGenerationOverride::query()->create($attrs);

            return;
        }
        AcademyExamGenerationOverride::query()->create($attrs);
    }

    /**
     * @param  array<string, mixed>  $summary
     * @return array{ok:bool,code:string,message:string,summary:array<string,mixed>}
     */
    private function gateFail(string $code, string $message, array $summary): array
    {
        return ['ok' => false, 'code' => $code, 'message' => $message, 'summary' => $summary];
    }
}
