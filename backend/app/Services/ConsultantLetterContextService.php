<?php

namespace App\Services;

use App\Models\CaseFile;
use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Models\User;

class ConsultantLetterContextService
{
    public function __construct(
        private QuestionnaireFormPrefillService $prefill,
    ) {}

    /** @return array<string, mixed> */
    public function buildConsultantContext(User $consultant): array
    {
        return array_filter([
            'name'                  => $consultant->name,
            'email'                 => $consultant->email,
            'phone'                 => $consultant->phone,
            'rcic_number'           => $consultant->rcic_number,
            'company_name'          => $consultant->company_name,
            'company_logo'          => $consultant->company_logo,
            'company_phone'         => $consultant->company_phone,
            'company_website'       => $consultant->company_website,
            'company_address_line1' => $consultant->company_address_line1,
            'company_address_line2' => $consultant->company_address_line2,
            'company_city'          => $consultant->company_city,
            'company_province'      => $consultant->company_province,
            'company_postal_code'   => $consultant->company_postal_code,
            'company_country'       => $consultant->company_country ?? 'Canada',
            'digital_signature'     => $consultant->digital_signature,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @return array<string, mixed> */
    public function buildClientContext(ClientProfile $profile, User $consultant): array
    {
        if ($profile->consultant_id !== $consultant->id) {
            abort(403, 'Access denied.');
        }

        $profile->loadMissing('user:id,name,email,phone');

        $caseFile = CaseFile::where('client_profile_id', $profile->id)->first();
        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();
        $prefill = $profile->user
            ? $this->prefill->buildPrefill($profile->user, $submission)
            : [];

        return [
            'client_profile_id' => $profile->id,
            'client_name'       => $profile->user?->name,
            'client_email'      => $profile->user?->email,
            'client_phone'      => $profile->phone ?? $profile->user?->phone,
            'passport_number'   => $profile->passport_number,
            'immigration_pathway' => $profile->immigration_pathway ?? $caseFile?->immigration_pathway,
            'case_status'       => $caseFile?->status,
            'pathway_assessment_crs_score' => $caseFile?->pathway_assessment_crs_score,
            'pathway_assessment_notes'     => $caseFile?->pathway_assessment_notes,
            'questionnaire_prefill' => $prefill,
            'questionnaire_submitted' => (bool) ($submission?->is_submitted),
        ];
    }

    /** @return array<string, mixed> */
    public function buildSnapshot(User $consultant, ?ClientProfile $profile = null): array
    {
        $snapshot = [
            'generated_at' => now()->toIso8601String(),
            'consultant'   => $this->buildConsultantContext($consultant),
        ];

        if ($profile) {
            $snapshot['client'] = $this->buildClientContext($profile, $consultant);
        }

        return $snapshot;
    }
}
