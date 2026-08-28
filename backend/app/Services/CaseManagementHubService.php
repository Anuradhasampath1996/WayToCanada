<?php

namespace App\Services;

use App\Http\Controllers\ApplicationPackageController;
use App\Models\CaseFile;
use App\Models\DocumentSubmission;

class CaseManagementHubService
{
    private const BASE_REQUIREMENTS = [
        ['id' => 'passport', 'label' => 'Valid Passport (all pages)', 'category' => 'identity'],
        ['id' => 'photos', 'label' => 'Passport-style photos (2×)', 'category' => 'identity'],
        ['id' => 'proof_address', 'label' => 'Proof of address', 'category' => 'identity'],
        ['id' => 'police_cert', 'label' => 'Police clearance certificate', 'category' => 'background'],
        ['id' => 'medical_exam', 'label' => 'Medical examination (IMM 1017E)', 'category' => 'medical'],
    ];

    /** @var array<string, list<array{id: string, label: string, category: string}>> */
    private const PATHWAY_REQUIREMENTS = [
        'Express Entry' => [
            ['id' => 'ielts_results', 'label' => 'Language test results (IELTS / CELPIP)', 'category' => 'eligibility'],
            ['id' => 'eca', 'label' => 'Educational Credential Assessment (ECA)', 'category' => 'eligibility'],
            ['id' => 'employment_refs', 'label' => 'Employment reference letters', 'category' => 'work'],
            ['id' => 'pay_stubs', 'label' => 'Pay stubs (last 3 months)', 'category' => 'work'],
            ['id' => 'tax_returns', 'label' => 'NOA / Tax returns', 'category' => 'financial'],
            ['id' => 'proof_funds', 'label' => 'Proof of funds (bank statements)', 'category' => 'financial'],
            ['id' => 'express_entry_profile', 'label' => 'Express Entry profile confirmation', 'category' => 'application'],
        ],
        'PNP' => [
            ['id' => 'ielts_results', 'label' => 'Language test results', 'category' => 'eligibility'],
            ['id' => 'eca', 'label' => 'Educational Credential Assessment', 'category' => 'eligibility'],
            ['id' => 'employment_refs', 'label' => 'Employment reference letters', 'category' => 'work'],
            ['id' => 'pnp_nomination', 'label' => 'Provincial Nomination Certificate', 'category' => 'application'],
            ['id' => 'job_offer', 'label' => 'Job offer letter (if applicable)', 'category' => 'work'],
            ['id' => 'proof_funds', 'label' => 'Proof of funds', 'category' => 'financial'],
        ],
        'Family Sponsorship' => [
            ['id' => 'sponsor_status', 'label' => "Sponsor's PR card / citizenship certificate", 'category' => 'sponsor'],
            ['id' => 'marriage_cert', 'label' => 'Marriage / relationship certificate', 'category' => 'relationship'],
            ['id' => 'sponsor_income', 'label' => "Sponsor's proof of income (NOA)", 'category' => 'financial'],
            ['id' => 'relationship_proof', 'label' => 'Proof of genuine relationship', 'category' => 'relationship'],
            ['id' => 'birth_certs', 'label' => 'Birth certificates (dependents)', 'category' => 'identity'],
        ],
        'Study Permit' => [
            ['id' => 'acceptance_letter', 'label' => 'Letter of acceptance from DLI', 'category' => 'study'],
            ['id' => 'ielts_results', 'label' => 'Language test results', 'category' => 'eligibility'],
            ['id' => 'transcripts', 'label' => 'Academic transcripts', 'category' => 'study'],
            ['id' => 'study_plan', 'label' => 'Statement of purpose / study plan', 'category' => 'study'],
            ['id' => 'proof_funds', 'label' => 'Proof of financial support', 'category' => 'financial'],
        ],
        'Work Permit' => [
            ['id' => 'lmia_job_offer', 'label' => 'LMIA-approved or LMIA-exempt job offer', 'category' => 'work'],
            ['id' => 'employment_contract', 'label' => 'Signed employment contract', 'category' => 'work'],
            ['id' => 'ielts_results', 'label' => 'Language test results (if required)', 'category' => 'eligibility'],
            ['id' => 'qualifications', 'label' => 'Educational / professional qualifications', 'category' => 'work'],
            ['id' => 'resume', 'label' => 'Current resume / CV', 'category' => 'work'],
        ],
    ];

    /** @var array<string, list<array{code: string, name: string, type: string}>> */
    private const PATHWAY_IRCC_FORMS = [
        'Express Entry' => [
            ['code' => 'Online', 'name' => 'Express Entry profile & e-APR (online-only)', 'type' => 'online'],
            ['code' => 'IMM 0008', 'name' => 'Generic Application Form for Canada', 'type' => 'pdf'],
            ['code' => 'IMM 5669', 'name' => 'Schedule A — Background/Declaration', 'type' => 'pdf'],
            ['code' => 'IMM 5406', 'name' => 'Additional Family Information', 'type' => 'pdf'],
            ['code' => 'IMM 5562', 'name' => 'Supplementary Information — Your Travels', 'type' => 'pdf'],
        ],
        'PNP' => [
            ['code' => 'IMM 0008', 'name' => 'Generic Application Form for Canada', 'type' => 'pdf'],
            ['code' => 'IMM 5669', 'name' => 'Schedule A — Background/Declaration', 'type' => 'pdf'],
            ['code' => 'IMM 5406', 'name' => 'Additional Family Information', 'type' => 'pdf'],
        ],
        'Family Sponsorship' => [
            ['code' => 'IMM 1344', 'name' => 'Application to Sponsor & Undertaking', 'type' => 'pdf'],
            ['code' => 'IMM 0008', 'name' => 'Generic Application Form for Canada', 'type' => 'pdf'],
            ['code' => 'IMM 5540', 'name' => 'Sponsorship Agreement', 'type' => 'pdf'],
            ['code' => 'IMM 5490', 'name' => "Sponsor's Financial Evaluation", 'type' => 'pdf'],
        ],
        'Study Permit' => [
            ['code' => 'IMM 1294', 'name' => 'Application for Study Permit', 'type' => 'pdf'],
            ['code' => 'IMM 5707', 'name' => 'Family Information', 'type' => 'pdf'],
        ],
        'Work Permit' => [
            ['code' => 'IMM 1295', 'name' => 'Application for Work Permit', 'type' => 'pdf'],
            ['code' => 'IMM 5707', 'name' => 'Family Information', 'type' => 'pdf'],
        ],
    ];

    public function __construct(
        private IrccInteractiveFormVerificationService $verificationService,
    ) {}

    /** @return array<string, mixed> */
    public function buildForCaseFile(CaseFile $caseFile): array
    {
        $caseFile->loadMissing('assignedIrccCategory');

        $package = ApplicationPackageController::formatPackage(
            $caseFile->assignedIrccCategory,
            $caseFile->id
        );

        $submissions = DocumentSubmission::where('case_file_id', $caseFile->id)
            ->orderByDesc('created_at')
            ->get();

        $submissionsByType = $submissions->groupBy('document_type')->map(
            fn ($group) => $this->formatSubmission($group->first())
        );

        $requirements = $this->buildRequirements($caseFile, $package, $submissionsByType);
        $irccForms = $this->buildIrccForms($caseFile, $package);
        $verification = $this->verificationService->getVerificationStatus($caseFile);

        $docStats = $this->documentStats($requirements, $submissions);
        $pipeline = $this->pipelineInfo($caseFile);

        return [
            'case_file'              => $caseFile,
            'application_package'    => $package,
            'verification'           => $verification,
            'case_management_unlocked' => (bool) ($verification['case_management_unlocked'] ?? false),
            'pathway_family'         => $this->pathwayFamily($caseFile->immigration_pathway),
            'document_requirements'  => $requirements,
            'ircc_forms'             => $irccForms,
            'documents'              => $submissions->map(fn ($s) => $this->formatSubmission($s))->values(),
            'progress'               => [
                'documents' => $docStats,
                'forms'     => [
                    'total'     => (int) ($verification['total_forms'] ?? 0),
                    'submitted' => (int) ($verification['submitted_count'] ?? 0),
                    'reviewed'  => (int) ($verification['reviewed_count'] ?? 0),
                    'complete'  => (bool) ($verification['all_reviewed'] ?? false),
                ],
                'pipeline'  => $pipeline,
                'overall_percent' => $this->overallPercent($docStats, $verification, $pipeline),
            ],
        ];
    }

    public static function pathwayFamily(?string $pathway): ?string
    {
        if (! $pathway) {
            return null;
        }

        if (str_contains($pathway, 'Express Entry')) {
            return 'Express Entry';
        }
        if (str_contains($pathway, 'PNP') || str_contains($pathway, 'Provincial Nominee')) {
            return 'PNP';
        }
        if (str_contains($pathway, 'Family Sponsorship') || str_contains($pathway, 'Sponsorship')) {
            return 'Family Sponsorship';
        }
        if (str_contains($pathway, 'Study Permit') || str_contains($pathway, 'Study')) {
            return 'Study Permit';
        }
        if (str_contains($pathway, 'Work Permit') || str_contains($pathway, 'Work')) {
            return 'Work Permit';
        }

        return $pathway;
    }

    /** @return list<array<string, mixed>> */
    private function buildRequirements(CaseFile $caseFile, ?array $package, $submissionsByType): array
    {
        $family = $this->pathwayFamily($caseFile->immigration_pathway);
        $pathwayReqs = $family && isset(self::PATHWAY_REQUIREMENTS[$family])
            ? self::PATHWAY_REQUIREMENTS[$family]
            : [];

        $all = array_merge(self::BASE_REQUIREMENTS, $pathwayReqs);
        $checklist = $caseFile->checklist_data ?? [];

        return array_map(function (array $req) use ($submissionsByType, $checklist) {
            $submission = $submissionsByType->get($req['id']);
            $status = $this->requirementStatus($submission);

            return [
                'id'       => $req['id'],
                'label'    => $req['label'],
                'category' => $req['category'],
                'status'   => $status,
                'checked'  => (bool) ($checklist[$req['id']] ?? false),
                'submission' => $submission,
            ];
        }, $all);
    }

    /** @return list<array<string, mixed>> */
    private function buildIrccForms(CaseFile $caseFile, ?array $package): array
    {
        $forms = [];

        if ($package && ! empty($package['interactive_forms'])) {
            foreach ($package['interactive_forms'] as $form) {
                $response = $form['response'] ?? null;
                $forms[] = [
                    'code'     => 'Form',
                    'name'     => $form['title'] ?? 'Application form',
                    'type'     => 'interactive',
                    'form_id'  => $form['id'] ?? null,
                    'slug'     => $form['slug'] ?? null,
                    'status'   => $response['status'] ?? 'not_started',
                    'reviewed' => ! empty($response['reviewed_at']),
                ];
            }
        }

        if ($package && ! empty($package['result']['forms'])) {
            foreach ($package['result']['forms'] as $code) {
                if ($code === 'Online Web Forms' || $code === 'Online Form') {
                    continue;
                }
                $exists = collect($forms)->contains(fn ($f) => $f['code'] === $code);
                if (! $exists) {
                    $forms[] = [
                        'code' => $code,
                        'name' => $this->formNameForCode($code),
                        'type' => 'reference',
                    ];
                }
            }
        }

        if ($forms !== []) {
            return $forms;
        }

        $family = $this->pathwayFamily($caseFile->immigration_pathway);
        if ($family && isset(self::PATHWAY_IRCC_FORMS[$family])) {
            return self::PATHWAY_IRCC_FORMS[$family];
        }

        return [];
    }

    private function formNameForCode(string $code): string
    {
        return match ($code) {
            'IMM 0008' => 'Generic Application Form for Canada',
            'IMM 5669' => 'Schedule A — Background/Declaration',
            'IMM 5406' => 'Additional Family Information',
            default    => 'IRCC form '.$code,
        };
    }

    /** @return array<string, mixed>|null */
    private function formatSubmission(?DocumentSubmission $submission): ?array
    {
        if (! $submission) {
            return null;
        }

        return [
            'id'                => $submission->id,
            'document_type'     => $submission->document_type,
            'document_label'    => $submission->document_label,
            'original_filename' => $submission->original_filename,
            'file_url'          => $submission->file_url,
            'mime_type'         => $submission->mime_type,
            'file_size'         => $submission->file_size,
            'status'            => $submission->status,
            'ai_confidence'     => $submission->ai_confidence,
            'ai_match_result'   => $submission->ai_match_result,
            'rejection_comment' => $submission->rejection_comment,
            'reviewed_at'       => $submission->reviewed_at,
            'uploaded_at'       => $submission->created_at?->toDateTimeString(),
        ];
    }

    private function requirementStatus(?array $submission): string
    {
        if (! $submission) {
            return 'missing';
        }

        return match ($submission['status']) {
            'consultant_approved', 'ai_verified' => 'approved',
            'consultant_rejected' => 'rejected',
            'pending_review', 'under_ai_review', 'ai_flagged' => 'pending',
            default => 'uploaded',
        };
    }

    /** @param list<array<string, mixed>> $requirements */
    private function documentStats(array $requirements, $submissions): array
    {
        $total = count($requirements);
        $approved = count(array_filter($requirements, fn ($r) => $r['status'] === 'approved'));
        $pending = count(array_filter($requirements, fn ($r) => in_array($r['status'], ['pending', 'uploaded'], true)));
        $missing = count(array_filter($requirements, fn ($r) => $r['status'] === 'missing'));
        $rejected = count(array_filter($requirements, fn ($r) => $r['status'] === 'rejected'));

        return [
            'total'     => $total,
            'approved'  => $approved,
            'pending'   => $pending,
            'missing'   => $missing,
            'rejected'  => $rejected,
            'percent'   => $total > 0 ? (int) round(($approved / $total) * 100) : 0,
            'uploaded'  => $submissions->count(),
        ];
    }

    /** @return array<string, mixed> */
    private function pipelineInfo(CaseFile $caseFile): array
    {
        $labels = [
            'AGREEMENT_SIGNED'      => 'Retainer Signed',
            'DOCUMENTS_UPLOADING'   => 'Documents Uploading',
            'UNDER_REVIEW'          => 'Under Review',
            'READY_FOR_SUBMISSION'  => 'Ready for Submission',
            'APPLICATION_SUBMITTED' => 'Application Submitted',
        ];

        $step = $caseFile->statusStep();
        $postAgreementSteps = array_keys($labels);
        $currentIndex = array_search($caseFile->status, $postAgreementSteps, true);

        return [
            'status'       => $caseFile->status,
            'label'        => $labels[$caseFile->status] ?? $caseFile->status,
            'step'         => $currentIndex !== false ? $currentIndex + 1 : ($step >= 3 ? 1 : 0),
            'total_steps'  => count($postAgreementSteps),
            'options'      => collect($postAgreementSteps)->map(fn ($s) => [
                'value' => $s,
                'label' => $labels[$s],
            ])->values(),
        ];
    }

    /** @param array<string, mixed> $docStats */
    private function overallPercent(array $docStats, array $verification, array $pipeline): int
    {
        $docPct = (int) ($docStats['percent'] ?? 0);
        $formsComplete = (bool) ($verification['agreement_signed'] ?? false)
            && (
                ($verification['total_forms'] ?? 0) === 0
                || ($verification['all_reviewed'] ?? false)
            );
        $formsPct = $formsComplete ? 100 : (int) round(
            (($verification['reviewed_count'] ?? 0) / max(1, $verification['total_forms'] ?? 1)) * 100
        );

        $pipelinePct = match ($pipeline['status'] ?? '') {
            'APPLICATION_SUBMITTED' => 100,
            'READY_FOR_SUBMISSION'  => 90,
            'UNDER_REVIEW'          => 70,
            'DOCUMENTS_UPLOADING'   => 40,
            default                 => 20,
        };

        return (int) round(($docPct * 0.5) + ($formsPct * 0.2) + ($pipelinePct * 0.3));
    }

    /** Auto-advance pipeline based on document review progress. */
    public function syncPipelineStatus(CaseFile $caseFile): void
    {
        if ($caseFile->status === 'APPLICATION_SUBMITTED') {
            return;
        }

        $caseFile->loadMissing('assignedIrccCategory');
        $package = ApplicationPackageController::formatPackage(
            $caseFile->assignedIrccCategory,
            $caseFile->id
        );

        $submissions = DocumentSubmission::where('case_file_id', $caseFile->id)
            ->orderByDesc('created_at')
            ->get();

        $submissionsByType = $submissions->groupBy('document_type')->map(
            fn ($group) => $this->formatSubmission($group->first())
        );

        $requirements = $this->buildRequirements($caseFile, $package, $submissionsByType);
        $docStats     = $this->documentStats($requirements, $submissions);

        $total    = (int) ($docStats['total'] ?? 0);
        $approved = (int) ($docStats['approved'] ?? 0);
        $pending  = (int) ($docStats['pending'] ?? 0);

        $hasPendingSubmissions = $submissions
            ->whereIn('status', ['pending_review', 'under_ai_review', 'ai_flagged'])
            ->isNotEmpty();

        if ($total > 0 && $approved === $total && $pending === 0 && ! $hasPendingSubmissions) {
            $caseFile->update(['status' => 'READY_FOR_SUBMISSION']);

            return;
        }

        if ($hasPendingSubmissions || $pending > 0 || $submissions->isNotEmpty()) {
            if (in_array($caseFile->status, ['AGREEMENT_SIGNED', 'DOCUMENTS_UPLOADING', 'UNDER_REVIEW'], true)) {
                $caseFile->update(['status' => 'UNDER_REVIEW']);
            }
        }
    }
}
