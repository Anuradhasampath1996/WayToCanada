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
        'Family Sponsorship – PGP' => [
            ['id' => 'sponsor_status', 'label' => "Sponsor's PR card / citizenship certificate", 'category' => 'sponsor'],
            ['id' => 'sponsor_income', 'label' => "Sponsor's proof of income (NOA / MNI)", 'category' => 'financial'],
            ['id' => 'birth_certs', 'label' => 'Birth certificates (parents / grandparents)', 'category' => 'identity'],
            ['id' => 'relationship_proof', 'label' => 'Proof of parent/grandparent relationship', 'category' => 'relationship'],
            ['id' => 'undertaking', 'label' => 'Sponsorship undertaking documents', 'category' => 'sponsor'],
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
        'Community Pilot' => [
            ['id' => 'job_offer', 'label' => 'Job offer from designated employer', 'category' => 'work'],
            ['id' => 'community_recommendation', 'label' => 'Community recommendation letter', 'category' => 'application'],
            ['id' => 'ielts_results', 'label' => 'Language test results', 'category' => 'eligibility'],
            ['id' => 'employment_refs', 'label' => 'Work experience letters', 'category' => 'work'],
            ['id' => 'proof_funds', 'label' => 'Settlement funds', 'category' => 'financial'],
            ['id' => 'settlement_plan', 'label' => 'Settlement plan (if required)', 'category' => 'application'],
        ],
        'Quebec' => [
            ['id' => 'french_test', 'label' => 'French language test results (TEF / TCF)', 'category' => 'eligibility'],
            ['id' => 'eca', 'label' => 'Educational Credential Assessment / Quebec diploma', 'category' => 'eligibility'],
            ['id' => 'employment_refs', 'label' => 'Work experience letters', 'category' => 'work'],
            ['id' => 'proof_funds', 'label' => 'Proof of financial self-sufficiency', 'category' => 'financial'],
            ['id' => 'csq', 'label' => 'Certificat de sélection du Québec (CSQ)', 'category' => 'application'],
            ['id' => 'arrima', 'label' => 'Arrima expression of interest / invitation (if applicable)', 'category' => 'application'],
        ],
        'Business Immigration' => [
            ['id' => 'business_plan', 'label' => 'Business plan / venture details', 'category' => 'application'],
            ['id' => 'proof_funds', 'label' => 'Proof of investment / settlement funds', 'category' => 'financial'],
            ['id' => 'experience_letters', 'label' => 'Business / self-employment experience evidence', 'category' => 'work'],
            ['id' => 'language_tests', 'label' => 'Language test results', 'category' => 'eligibility'],
            ['id' => 'letter_of_support', 'label' => 'Designated organization letter of support (Start-up Visa)', 'category' => 'application'],
            ['id' => 'police_cert_extra', 'label' => 'Police certificates (all countries lived 6+ months)', 'category' => 'background'],
        ],
        'Visitor' => [
            ['id' => 'invitation_letter', 'label' => 'Invitation letter (if applicable)', 'category' => 'application'],
            ['id' => 'proof_funds', 'label' => 'Proof of funds / ties to home country', 'category' => 'financial'],
            ['id' => 'travel_history', 'label' => 'Travel history / itinerary', 'category' => 'application'],
            ['id' => 'employment_letter', 'label' => 'Employment letter from home country', 'category' => 'work'],
            ['id' => 'insurance', 'label' => 'Medical insurance (required for Super Visa)', 'category' => 'medical'],
        ],
        'Citizenship' => [
            ['id' => 'pr_card', 'label' => 'PR card / confirmation of PR', 'category' => 'identity'],
            ['id' => 'language_proof', 'label' => 'Language proof (IELTS / CELPIP / TEF)', 'category' => 'eligibility'],
            ['id' => 'tax_filings', 'label' => 'Tax filings / physical presence evidence', 'category' => 'eligibility'],
            ['id' => 'knowledge_test', 'label' => 'Citizenship knowledge study materials', 'category' => 'application'],
            ['id' => 'photos', 'label' => 'Citizenship application photos', 'category' => 'identity'],
        ],
        'PR Card' => [
            ['id' => 'current_pr_card', 'label' => 'Current / expired PR card', 'category' => 'identity'],
            ['id' => 'travel_history', 'label' => 'Travel history outside Canada', 'category' => 'application'],
            ['id' => 'photos', 'label' => 'PR card photos', 'category' => 'identity'],
            ['id' => 'proof_address', 'label' => 'Proof of address in Canada', 'category' => 'identity'],
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
        'Community Pilot' => [
            ['code' => 'IMM 0008', 'name' => 'Generic Application Form for Canada', 'type' => 'pdf'],
            ['code' => 'IMM 5669', 'name' => 'Schedule A — Background/Declaration', 'type' => 'pdf'],
            ['code' => 'IMM 5406', 'name' => 'Additional Family Information', 'type' => 'pdf'],
        ],
        'Quebec' => [
            ['code' => 'IMM 0008', 'name' => 'Generic Application Form for Canada', 'type' => 'pdf'],
            ['code' => 'IMM 5669', 'name' => 'Schedule A — Background/Declaration', 'type' => 'pdf'],
            ['code' => 'IMM 5406', 'name' => 'Additional Family Information', 'type' => 'pdf'],
        ],
        'Business Immigration' => [
            ['code' => 'IMM 0008', 'name' => 'Generic Application Form for Canada', 'type' => 'pdf'],
            ['code' => 'IMM 5669', 'name' => 'Schedule A — Background/Declaration', 'type' => 'pdf'],
            ['code' => 'IMM 5406', 'name' => 'Additional Family Information', 'type' => 'pdf'],
        ],
        'Visitor' => [
            ['code' => 'IMM 5257', 'name' => 'Application for Temporary Resident Visa', 'type' => 'pdf'],
            ['code' => 'IMM 5707', 'name' => 'Family Information', 'type' => 'pdf'],
        ],
        'Citizenship' => [
            ['code' => 'CIT 0002', 'name' => 'Application for Canadian Citizenship — Adults', 'type' => 'pdf'],
        ],
        'PR Card' => [
            ['code' => 'IMM 5444', 'name' => 'Application for a Permanent Resident Card', 'type' => 'pdf'],
            ['code' => 'IMM 5455', 'name' => 'Document Checklist — PR Card', 'type' => 'pdf'],
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
            'case_management_unlocked' => (bool) ($verification['case_management_unlocked'] ?? false)
                || ($caseFile->isAgreementSigned() && (bool) $caseFile->current_requirement_plan_id),
            'pathway_family'         => app(PathwayCatalogService::class)->hubFamilyForCase($caseFile),
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

        $lower = mb_strtolower($pathway);

        // PNP before Express Entry — labels like "PNP - Non-Express Entry" contain both phrases.
        if (\App\Support\ImmigrationPathwayLabels::mentionsPnp($pathway)) {
            return 'PNP';
        }
        if (\App\Support\ImmigrationPathwayLabels::mentionsExpressEntry($pathway)) {
            return 'Express Entry';
        }
        if (str_contains($lower, 'family sponsorship') || str_contains($lower, 'sponsor your')) {
            return 'Family Sponsorship';
        }
        if (str_contains($lower, 'study permit')) {
            return 'Study Permit';
        }
        if (str_contains($lower, 'work permit')) {
            return 'Work Permit';
        }
        if (str_contains($lower, 'rcip') || str_contains($lower, 'fcip') || str_contains($lower, 'atlantic immigration') || str_contains($lower, 'rural community') || str_contains($lower, 'francophone community')) {
            return 'Community Pilot';
        }
        if (str_contains($lower, 'quebec') || str_contains($lower, 'pstq') || str_contains($lower, 'arrima') || str_contains($lower, 'peq') || str_contains($lower, 'csq')) {
            return 'Quebec';
        }
        if (str_contains($lower, 'start-up') || str_contains($lower, 'startup') || str_contains($lower, 'self-employed') || str_contains($lower, 'self employed') || str_contains($lower, 'caregiver') || str_contains($lower, 'business immigration')) {
            return 'Business Immigration';
        }
        if (str_contains($lower, 'super visa') || str_contains($lower, 'visitor visa') || str_contains($lower, 'temporary resident visa') || preg_match('/\btrv\b/', $lower)) {
            return 'Visitor';
        }
        if (str_contains($lower, 'citizenship')) {
            return 'Citizenship';
        }
        if (str_contains($lower, 'pr card') || str_contains($lower, 'permanent resident card')) {
            return 'PR Card';
        }
        // Exact known pathway labels only — do not match bare "Work"/"Study"/"Sponsorship".
        $known = [
            'Study Permit' => 'Study Permit',
            'Work Permit' => 'Work Permit',
            'Family Sponsorship' => 'Family Sponsorship',
            'Provincial Nominee Program' => 'PNP',
            'Atlantic Immigration Program' => 'Community Pilot',
            'Rural Community Immigration Pilot (RCIP)' => 'Community Pilot',
            'Francophone Community Immigration Pilot (FCIP)' => 'Community Pilot',
            'Start-up Visa' => 'Business Immigration',
            'Self-employed Persons' => 'Business Immigration',
            'Visitor Visa (TRV)' => 'Visitor',
            'Super Visa (Parents and Grandparents)' => 'Visitor',
            'Canadian Citizenship (Grant)' => 'Citizenship',
            'Proof of Citizenship Certificate' => 'Citizenship',
            'PR Card Renew / Replace' => 'PR Card',
        ];
        foreach ($known as $label => $family) {
            if (strcasecmp(trim($pathway), $label) === 0) {
                return $family;
            }
        }

        return null;
    }

    /** @return list<array<string, mixed>> */
    private function buildRequirements(CaseFile $caseFile, ?array $package, $submissionsByType): array
    {
        $planDocs = $this->planDocuments($caseFile);
        $all = $planDocs !== []
            ? $planDocs
            : $this->legacyRequirements($caseFile);
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
                'reuse_candidate' => $req['reuse_candidate'] ?? null,
            ];
        }, $all);
    }

    /** @return list<array{id: string, label: string, category: string, reuse_candidate?: mixed}> */
    private function planDocuments(CaseFile $caseFile): array
    {
        $plan = app(CaseRequirementPlanService::class)->currentPlan($caseFile);
        if (! $plan) {
            return [];
        }

        $out = [];
        foreach ($plan->snapshot['documents'] ?? [] as $doc) {
            $status = $doc['status'] ?? 'requested';
            if ($status === 'obsolete' || ($doc['requirement_state'] ?? null) === 'not_required') {
                continue;
            }
            $out[] = [
                'id' => (string) ($doc['id'] ?? ''),
                'label' => (string) ($doc['label'] ?? $doc['id'] ?? 'Document'),
                'category' => (string) ($doc['category'] ?? 'other'),
                'reuse_candidate' => $doc['reuse_candidate'] ?? null,
            ];
        }

        return array_values(array_filter($out, fn (array $doc) => $doc['id'] !== ''));
    }

    /** @return list<array{id: string, label: string, category: string}> */
    private function legacyRequirements(CaseFile $caseFile): array
    {
        $family = app(PathwayCatalogService::class)->hubFamilyForCase($caseFile);
        if (($caseFile->pathway_code ?? '') === 'family.pgp') {
            $family = 'Family Sponsorship – PGP';
        }
        $pathwayReqs = $family && isset(self::PATHWAY_REQUIREMENTS[$family])
            ? self::PATHWAY_REQUIREMENTS[$family]
            : [];

        return array_merge(self::BASE_REQUIREMENTS, $pathwayReqs);
    }

    /** @return list<array<string, mixed>> */
    private function buildIrccForms(CaseFile $caseFile, ?array $package): array
    {
        $planForms = $this->planForms($caseFile);
        if ($planForms !== []) {
            return $planForms;
        }

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

        $family = app(PathwayCatalogService::class)->hubFamilyForCase($caseFile);
        if ($family && isset(self::PATHWAY_IRCC_FORMS[$family])) {
            return self::PATHWAY_IRCC_FORMS[$family];
        }

        return [];
    }

    /** @return list<array<string, mixed>> */
    private function planForms(CaseFile $caseFile): array
    {
        $plan = app(CaseRequirementPlanService::class)->currentPlan($caseFile);
        if (! $plan) {
            return [];
        }

        $out = [];
        foreach ($plan->snapshot['forms'] ?? [] as $form) {
            $status = $form['status'] ?? 'pending';
            if ($status === 'obsolete') {
                continue;
            }
            $out[] = [
                'code' => $form['code'] ?? '',
                'name' => $form['name'] ?? ($form['code'] ?? 'Form'),
                'type' => $form['kind'] ?? 'official',
                'form_id' => $form['form_id'] ?? null,
                'status' => $status,
            ];
        }

        return array_values(array_filter($out, fn (array $form) => ($form['code'] ?? '') !== ''));
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

        return match (\App\Support\DocumentWorkflowStatus::canonicalize($submission['status'] ?? null)) {
            \App\Support\DocumentWorkflowStatus::VERIFIED => 'approved',
            \App\Support\DocumentWorkflowStatus::CORRECTION_REQUIRED,
            \App\Support\DocumentWorkflowStatus::RESUBMISSION_REQUESTED => 'rejected',
            \App\Support\DocumentWorkflowStatus::UNDER_REVIEW => 'pending',
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
            if (
                in_array($caseFile->status, ['AGREEMENT_SIGNED', 'DOCUMENTS_UPLOADING', 'UNDER_REVIEW'], true)
                && ! $caseFile->ready_to_submit_at
                && ! $caseFile->submitted_at
            ) {
                $caseFile->update(['status' => 'UNDER_REVIEW']);
            }

            return;
        }

        if ($hasPendingSubmissions || $pending > 0 || $submissions->isNotEmpty()) {
            if (in_array($caseFile->status, ['AGREEMENT_SIGNED', 'DOCUMENTS_UPLOADING', 'UNDER_REVIEW'], true)) {
                $caseFile->update(['status' => 'UNDER_REVIEW']);
            }
        }
    }
}
