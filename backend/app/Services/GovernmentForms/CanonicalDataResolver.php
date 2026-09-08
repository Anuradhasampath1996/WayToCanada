<?php

namespace App\Services\GovernmentForms;

use App\Data\GovernmentForms\CanonicalDataSet;
use App\Models\CaseFile;
use App\Models\IrccInteractiveFormResponse;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Carbon\Carbon;

class CanonicalDataResolver
{
    public function __construct(
        private SourceDataHasher $hasher,
    ) {}

    public function resolve(CaseFile $caseFile, ?Carbon $asOf = null): CanonicalDataSet
    {
        return $this->resolveInternal($caseFile, $asOf, useSnapshot: true);
    }

    /** Live questionnaire/profile data for gap analysis UI (ignores review snapshot). */
    public function resolveLive(CaseFile $caseFile, ?Carbon $asOf = null): CanonicalDataSet
    {
        return $this->resolveInternal($caseFile, $asOf, useSnapshot: false);
    }

    private function resolveInternal(CaseFile $caseFile, ?Carbon $asOf, bool $useSnapshot): CanonicalDataSet
    {
        if ($caseFile->exists) {
            $caseFile->loadMissing(['clientProfile.user', 'consultant']);
        }

        $resolvedAt = $asOf ?? now();
        $sources = [];
        $values = [];

        $usesSnapshot = $useSnapshot && $this->hasValidSnapshot($caseFile);

        if ($usesSnapshot) {
            $values = array_merge($values, $this->mapFromSnapshot($caseFile->questionnaire_snapshot ?? []));
            $sources['questionnaire_snapshot'] = [
                'hash' => $caseFile->questionnaire_snapshot_hash,
                'captured_at' => $caseFile->questionnaire_snapshot_at?->toIso8601String(),
            ];
        } else {
            $submission = $this->resolveQuestionnaireSubmission($caseFile);
            if ($submission) {
                $values = array_merge($values, $this->mapFromQuestionnaire($submission, $caseFile->clientProfile?->user));
                $sources['questionnaire'] = [
                    'submission_id' => $submission->id,
                    'updated_at' => $submission->updated_at?->toIso8601String(),
                ];
            } elseif ($caseFile->clientProfile?->user) {
                $values = array_merge($values, $this->mapFromUserOnly($caseFile->clientProfile->user));
                $sources['user_profile'] = ['user_id' => $caseFile->clientProfile->user->id];
            }
        }

        $interactiveValues = $this->mapFromInteractiveForms($caseFile);
        if ($interactiveValues !== []) {
            $values = array_merge($values, $interactiveValues);
            $sources['interactive_forms'] = ['case_file_id' => $caseFile->id];
        }

        $consultant = $caseFile->relationLoaded('consultant')
            ? $caseFile->getRelation('consultant')
            : ($caseFile->exists ? $caseFile->consultant : null);

        $representativeValues = $this->mapRepresentative($consultant);
        if ($representativeValues !== []) {
            $values = array_merge($values, $representativeValues);
            $sources['representative'] = ['consultant_id' => $caseFile->consultant_id];
        }

        // IMM 5476 defaults for paid RCIC appointment workflow (export values from template).
        $values['form.purpose.appoint_representative'] ??= '0';
        $values['representative.paid_cicc'] ??= '0';

        $values = $this->filterEmpty($values);
        $sourceHash = $this->hasher->hash($values);

        return new CanonicalDataSet(
            caseFileId: $caseFile->id,
            values: $values,
            sourceHash: $sourceHash,
            sources: $sources,
            resolvedAt: $resolvedAt,
            usesSnapshot: $usesSnapshot,
        );
    }

    private function hasValidSnapshot(CaseFile $caseFile): bool
    {
        return $caseFile->application_info_reviewed_at !== null
            && is_array($caseFile->questionnaire_snapshot)
            && $caseFile->questionnaire_snapshot !== [];
    }

    private function resolveQuestionnaireSubmission(CaseFile $caseFile): ?QuestionnaireSubmission
    {
        $userId = $caseFile->clientProfile?->user_id;

        if (! $userId) {
            return null;
        }

        return QuestionnaireSubmission::where('user_id', $userId)->first();
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function mapFromSnapshot(array $snapshot): array
    {
        $step1 = is_array($snapshot['step1_data'] ?? null) ? $snapshot['step1_data'] : [];
        $main = is_array($snapshot['main_data'] ?? null) ? $snapshot['main_data'] : [];
        $spouse = is_array($snapshot['spouse_data'] ?? null) ? $snapshot['spouse_data'] : [];
        $children = is_array($snapshot['children_data'] ?? null) ? $snapshot['children_data'] : [];
        $accompanying = is_array($snapshot['accompanying_data'] ?? null) ? $snapshot['accompanying_data'] : [];
        $step3 = is_array($snapshot['step3_data'] ?? null) ? $snapshot['step3_data'] : [];

        return array_merge(
            $this->mapApplicantPersonal($step1, $main),
            $this->mapApplicantContact($step1, $main),
            $this->mapApplicantPassport($main),
            $this->mapApplicantAddress($main),
            $this->mapApplicantWork($main),
            $this->mapApplicantEducation($main),
            $this->mapApplicantNationalId($main),
            $this->mapApplicantLanguages($main),
            $this->mapApplicantTravel($main),
            $this->mapApplicantFlags($step1, $main),
            $this->mapSpouse($spouse),
            $this->mapChildren($children),
            $this->mapParentsAndSiblingsFromAccompanying($accompanying),
            $this->mapStep3($step3),
        );
    }

    /** @return array<string, mixed> */
    private function mapFromQuestionnaire(QuestionnaireSubmission $submission, ?User $user): array
    {
        $step1 = $submission->step1_data ?? [];
        $main = $submission->main_data ?? [];

        return array_merge(
            $this->mapApplicantPersonal($step1, $main, $user),
            $this->mapApplicantContact($step1, $main, $user),
            $this->mapApplicantPassport($main),
            $this->mapApplicantAddress($main),
            $this->mapApplicantWork($main),
            $this->mapApplicantEducation($main),
            $this->mapApplicantNationalId($main),
            $this->mapApplicantLanguages($main),
            $this->mapApplicantTravel($main),
            $this->mapApplicantFlags($step1, $main),
            $this->mapSpouse($submission->spouse_data ?? []),
            $this->mapChildren($submission->children_data ?? []),
            $this->mapParentsAndSiblingsFromAccompanying($submission->accompanying_data ?? []),
        );
    }

    /** @return array<string, mixed> */
    private function mapFromUserOnly(User $user): array
    {
        $parts = preg_split('/\s+/', trim($user->name ?? ''), 2) ?: [];

        return array_filter([
            'applicant.personal.given_names' => $parts[0] ?? null,
            'applicant.personal.family_name' => $parts[1] ?? null,
            'applicant.contact.email'        => $user->email,
            'applicant.contact.phone'        => $user->phone,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @return array<string, mixed> */
    private function mapRepresentative(?User $consultant): array
    {
        if (! $consultant) {
            return [];
        }

        $parts = preg_split('/\s+/', trim($consultant->name ?? ''), 2) ?: [];
        $phoneParts = $this->splitPhone((string) ($consultant->company_phone ?? $consultant->phone ?? ''));
        $streetParts = $this->splitStreetAddress((string) ($consultant->company_address_line1 ?? ''));

        return array_filter([
            'representative.personal.given_names' => $parts[0] ?? null,
            'representative.personal.family_name' => $parts[1] ?? null,
            'representative.personal.full_name'   => $consultant->name,
            'representative.rcic_number'          => $consultant->rcic_number,
            'representative.membership_id'       => $consultant->rcic_number,
            'representative.firm_name'            => $consultant->company_name,
            'representative.contact.email'        => $consultant->email,
            'representative.contact.phone'        => $consultant->company_phone ?? $consultant->phone,
            'representative.contact.phone_country_code' => $phoneParts['country_code'],
            'representative.contact.phone_number' => $phoneParts['number'],
            'representative.address.line1'        => $consultant->company_address_line1,
            'representative.address.line2'        => $consultant->company_address_line2,
            'representative.address.unit'         => $consultant->company_address_line2,
            'representative.address.street_number'=> $streetParts['street_number'],
            'representative.address.street_name'  => $streetParts['street_name'] ?: $consultant->company_address_line1,
            'representative.address.city'         => $consultant->company_city,
            'representative.address.province'     => $consultant->company_province,
            'representative.address.postal_code'  => $consultant->company_postal_code,
            'representative.address.country'      => $consultant->company_country ?: 'Canada',
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @return array{country_code: ?string, number: ?string} */
    private function splitPhone(string $raw): array
    {
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if ($digits === '') {
            return ['country_code' => null, 'number' => null];
        }

        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
        }

        if (strlen($digits) === 11 && str_starts_with($digits, '1')) {
            return ['country_code' => '1', 'number' => substr($digits, 1)];
        }

        if (strlen($digits) === 10) {
            return ['country_code' => '1', 'number' => $digits];
        }

        if (strlen($digits) > 10) {
            return [
                'country_code' => substr($digits, 0, strlen($digits) - 10),
                'number' => substr($digits, -10),
            ];
        }

        return ['country_code' => null, 'number' => $digits];
    }

    /** @return array{street_number: ?string, street_name: ?string} */
    private function splitStreetAddress(string $line1): array
    {
        $line1 = trim($line1);
        if ($line1 === '') {
            return ['street_number' => null, 'street_name' => null];
        }

        // Number only (common after gap-fill of street number alone): "123" / "12A"
        if (preg_match('/^(\d+[A-Za-z]?)$/', $line1, $m)) {
            return ['street_number' => $m[1], 'street_name' => null];
        }

        // "123 Main St", "12A-Main Street", "45, King Road"
        if (preg_match('/^(\d+[A-Za-z]?)\s*[,\- ]+\s*(.+)$/u', $line1, $m)) {
            return ['street_number' => $m[1], 'street_name' => trim($m[2])];
        }

        return ['street_number' => null, 'street_name' => $line1];
    }

    /** @return array<string, mixed> */
    private function mapFromInteractiveForms(CaseFile $caseFile): array
    {
        if (! $caseFile->exists) {
            return [];
        }

        $responses = IrccInteractiveFormResponse::where('case_file_id', $caseFile->id)
            ->whereNotNull('response_data')
            ->get();

        $values = [];

        foreach ($responses as $response) {
            $data = $response->response_data ?? [];
            if (! is_array($data)) {
                continue;
            }

            foreach ($data as $key => $value) {
                if ($value === null || $value === '') {
                    continue;
                }
                $values['interactive.' . $response->ircc_interactive_form_id . '.' . $key] = $value;
            }
        }

        return $values;
    }

    /**
     * @param  array<string, mixed>  $step1
     * @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapApplicantPersonal(array $step1, array $main, ?User $user = null): array
    {
        $fullName = $main['passportFullName'] ?? $step1['fullName'] ?? $user?->name ?? '';
        $nameParts = preg_split('/\s+/', trim((string) $fullName), 2) ?: [];

        $gender = strtolower((string) ($main['passportGender'] ?? ''));
        $genderMap = ['male' => 'male', 'female' => 'female', 'm' => 'male', 'f' => 'female'];

        return array_filter([
            'applicant.personal.given_names'      => $nameParts[0] ?? null,
            'applicant.personal.family_name'      => $nameParts[1] ?? null,
            'applicant.personal.full_name'        => $fullName ?: null,
            'applicant.personal.date_of_birth'    => $this->normalizeDate($main['dob'] ?? $main['passportDob'] ?? null),
            'applicant.personal.uci'              => $this->normalizeUci($main['uci'] ?? $main['UCI'] ?? $main['clientId'] ?? null),
            'applicant.personal.gender'           => $genderMap[$gender] ?? ($gender === 'other' ? 'other' : null),
            'applicant.personal.city_of_birth'      => $main['birthCity'] ?? $main['birthPlace'] ?? null,
            'applicant.personal.country_of_birth' => $main['birthCountry'] ?? $main['passportNationality'] ?? $main['nicBirthPlace'] ?? null,
            'applicant.personal.citizenship'      => $main['passportNationality'] ?? $main['citizenship'] ?? null,
            'applicant.personal.marital_status'   => $this->resolveMaritalStatusLabel($step1['married'] ?? null),
            'applicant.personal.address.full'     => $this->buildAddress($main) ?? ($main['nicAddress'] ?? null),
            'applicant.application.type'         => $main['imm5476ApplicationType'] ?? $main['applicationType'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /**
     * @param  array<string, mixed>  $step1
     * @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapApplicantContact(array $step1, array $main, ?User $user = null): array
    {
        return array_filter([
            'applicant.contact.email' => $step1['email'] ?? $user?->email,
            'applicant.contact.phone' => $step1['whatsapp'] ?? $step1['phone'] ?? $user?->phone,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapApplicantPassport(array $main): array
    {
        return array_filter([
            'applicant.passport.number'       => $main['passportNumber'] ?? null,
            'applicant.passport.issue_date'   => $this->normalizeDate($main['passportIssueDate'] ?? null),
            'applicant.passport.expiry_date'  => $this->normalizeDate($main['passportExpiry'] ?? null),
            'applicant.passport.country'      => $main['passportNationality'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapApplicantAddress(array $main): array
    {
        return array_filter([
            'applicant.address.line1'       => $main['addressLine1'] ?? $main['address'] ?? null,
            'applicant.address.line2'       => $main['addressLine2'] ?? null,
            'applicant.address.city'        => $main['city'] ?? null,
            'applicant.address.province'    => $main['province'] ?? $main['state'] ?? null,
            'applicant.address.postal_code' => $main['postalCode'] ?? null,
            'applicant.address.country'     => $main['countryOfResidence'] ?? null,
            'applicant.address.full'        => $this->buildAddress($main),
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapApplicantWork(array $main): array
    {
        return array_filter([
            'applicant.work.job_title'             => $main['currentJobTitle'] ?? null,
            'applicant.work.intended_occupation'   => $main['intendedNocTitle'] ?? $main['intendedOccupation'] ?? $main['currentJobTitle'] ?? null,
            'applicant.work.employer_name'         => $main['currentEmployer'] ?? $main['employerName'] ?? null,
            'applicant.work.employer_city'         => $main['currentJobCity'] ?? null,
            'applicant.work.employer_country'      => $main['currentJobCountry'] ?? $main['countryOfResidence'] ?? null,
            'applicant.work.main_duties'           => $main['currentJobDuties'] ?? $main['currentJobField'] ?? null,
            'applicant.work.hours_per_week'        => $main['weeklyWorkHours'] ?? null,
            'applicant.work.start_date'            => $this->normalizeDate($main['currentJobStartDate'] ?? null),
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapApplicantEducation(array $main): array
    {
        $quals = $main['educationQuals'] ?? [];
        $first = is_array($quals) && count($quals) > 0 ? ($quals[0] ?? []) : [];
        $levels = $main['educationLevels'] ?? [];
        $levelLabel = null;
        if (is_array($levels) && $levels !== []) {
            $levelLabel = is_string($levels[0] ?? null) ? $levels[0] : null;
        }
        if ($levelLabel === null && is_string($first['level'] ?? null)) {
            $levelLabel = $first['level'];
        }

        return array_filter([
            'applicant.education.level'           => $levelLabel,
            'applicant.education.field_of_study'   => $first['courseName'] ?? $main['canadaStudyProgram'] ?? null,
            'applicant.education.institution_name' => $first['universityName'] ?? $main['canadaStudyInstitution'] ?? null,
            'applicant.education.country'          => $first['country'] ?? null,
            'applicant.education.end_date'         => $this->normalizeDate($first['graduationYear'] ?? null, yearOnly: true),
            'applicant.education.eca_completed'    => ! empty($main['hasEca']) ? ($main['hasEca'] === 'yes' ? 'yes' : 'no') : null,
            'applicant.education.eca_organization' => $main['ecaProvider'] ?? null,
            'applicant.education.eca_reference'    => $main['ecaReference'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapApplicantNationalId(array $main): array
    {
        return array_filter([
            'applicant.national_id.number'  => $main['nicNumber'] ?? $main['nationalIdNumber'] ?? null,
            'applicant.national_id.country' => $main['passportNationality'] ?? $main['countryOfResidence'] ?? $main['birthCountry'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapApplicantLanguages(array $main): array
    {
        $languages = $main['languages'] ?? [];
        if (! is_array($languages) || $languages === []) {
            return [];
        }

        $normalized = [];
        foreach ($languages as $lang) {
            if (is_string($lang) && trim($lang) !== '') {
                $normalized[] = trim($lang);
            } elseif (is_array($lang) && is_string($lang['name'] ?? null) && trim((string) $lang['name']) !== '') {
                $normalized[] = trim((string) $lang['name']);
            }
        }

        if ($normalized === []) {
            return [];
        }

        $native = $normalized[0];
        $communicate = 'Neither';
        $lower = array_map(static fn (string $l) => strtolower($l), $normalized);
        $hasEn = (bool) array_filter($lower, static fn (string $l) => str_contains($l, 'english'));
        $hasFr = (bool) array_filter($lower, static fn (string $l) => str_contains($l, 'french'));
        if ($hasEn && $hasFr) {
            $communicate = 'Both';
        } elseif ($hasEn) {
            $communicate = 'English';
        } elseif ($hasFr) {
            $communicate = 'French';
        }

        return array_filter([
            'applicant.language.native'      => $native,
            'applicant.language.communicate' => $communicate,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /**
     * Travel history for IMM 5562 (main_data.travelHistory[]).
     *
     * @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapApplicantTravel(array $main): array
    {
        $rows = $main['travelHistory'] ?? [];
        if (! is_array($rows) || $rows === []) {
            return [];
        }

        $values = [];
        $slot = 0;
        foreach ($rows as $row) {
            if (! is_array($row) || $slot >= 3) {
                continue;
            }
            $prefix = "applicant.travel.{$slot}";
            $mapped = array_filter([
                "{$prefix}.from_date"   => $this->normalizeDate($row['fromDate'] ?? $row['from'] ?? null),
                "{$prefix}.to_date"     => $this->normalizeDate($row['toDate'] ?? $row['to'] ?? null),
                "{$prefix}.destination" => $row['destination'] ?? $row['country'] ?? null,
                "{$prefix}.purpose"     => $row['purpose'] ?? $row['purposeOfTravel'] ?? null,
                "{$prefix}.details"     => $row['details'] ?? null,
            ], fn ($v) => $v !== null && $v !== '');
            if ($mapped !== []) {
                $values = array_merge($values, $mapped);
                $slot++;
            }
        }

        return $values;
    }

    /** @param  array<string, mixed>  $spouse
     * @return array<string, mixed>
     */
    private function mapSpouse(array $spouse): array
    {
        if ($spouse === []) {
            return [];
        }

        $fullName = $spouse['fullName'] ?? $spouse['passportFullName'] ?? '';
        $nameParts = preg_split('/\s+/', trim((string) $fullName), 2) ?: [];

        return array_filter([
            'applicant.family.spouse.given_names'      => $nameParts[0] ?? null,
            'applicant.family.spouse.family_name'      => $nameParts[1] ?? null,
            'applicant.family.spouse.full_name'        => $fullName ?: null,
            'applicant.family.spouse.date_of_birth'    => $this->normalizeDate($spouse['dob'] ?? $spouse['dateOfBirth'] ?? null),
            'applicant.family.spouse.country_of_birth' => $spouse['birthCountry'] ?? $spouse['nicBirthPlace'] ?? null,
            'applicant.family.spouse.citizenship'      => $spouse['citizenship'] ?? $spouse['nationality'] ?? $spouse['passportNationality'] ?? null,
            'applicant.family.spouse.passport_number'  => $spouse['passportNumber'] ?? null,
            'applicant.family.spouse.address.full'     => $spouse['nicAddress'] ?? null,
            'applicant.family.spouse.marital_status'   => 'Married',
            'applicant.family.spouse.contact.email'    => $spouse['email'] ?? $spouse['contactEmail'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @param  array<int, array<string, mixed>>  $children
     * @return array<string, mixed>
     */
    private function mapChildren(array $children): array
    {
        $values = [];

        foreach ($children as $index => $child) {
            if (! is_array($child)) {
                continue;
            }

            $fullName = $child['fullName'] ?? $child['passportFullName'] ?? $child['name'] ?? '';
            $nameParts = preg_split('/\s+/', trim((string) $fullName), 2) ?: [];
            $prefix = "applicant.family.children.{$index}";

            $mapped = array_filter([
                "{$prefix}.given_names"   => $nameParts[0] ?? null,
                "{$prefix}.family_name"   => $nameParts[1] ?? null,
                "{$prefix}.full_name"     => $fullName ?: null,
                "{$prefix}.date_of_birth" => $this->normalizeDate($child['dob'] ?? $child['dateOfBirth'] ?? null),
                "{$prefix}.relationship"  => $child['relationship'] ?? 'Child',
                "{$prefix}.country_of_birth" => $child['birthCountry'] ?? $child['nicBirthPlace'] ?? null,
                "{$prefix}.address.full"  => $child['nicAddress'] ?? null,
                "{$prefix}.marital_status" => $child['maritalStatus'] ?? 'Single',
                "{$prefix}.contact.email" => $child['email'] ?? $child['contactEmail'] ?? null,
                "{$prefix}.uci"           => $this->normalizeUci($child['uci'] ?? $child['UCI'] ?? $child['clientId'] ?? null),
            ], fn ($v) => $v !== null && $v !== '');

            $values = array_merge($values, $mapped);
        }

        return $values;
    }

    /**
     * @param  array<string, mixed>  $step1
     * @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapApplicantFlags(array $step1, array $main): array
    {
        $married = strtolower((string) ($step1['married'] ?? ''));

        return array_filter([
            'applicant.flags.married' => $married === 'yes' ? 'yes' : ($married === 'no' ? 'no' : null),
        ], fn ($v) => $v !== null && $v !== '');
    }

    /**
     * @param  array<int, array<string, mixed>>  $accompanying
     * @return array<string, mixed>
     */
    private function mapParentsAndSiblingsFromAccompanying(array $accompanying): array
    {
        $values = [];
        $parents = [];
        $siblings = [];
        $siblingIndex = 0;

        foreach ($accompanying as $person) {
            if (! is_array($person)) {
                continue;
            }

            $relationship = strtolower((string) ($person['relationship'] ?? ''));

            if (in_array($relationship, ['father', 'mother', 'my_parent'], true)) {
                $parents[] = $person;
                continue;
            }

            if (in_array($relationship, ['sibling', 'spouse_father', 'spouse_mother', 'spouse_parent', 'in_law', 'other'], true)) {
                $prefix = "applicant.family.siblings.{$siblingIndex}";
                $values = array_merge($values, $this->mapFamilyMember($person, $prefix, $this->relationshipLabel($relationship, $person)));
                $siblingIndex++;
            }
        }

        // Prefer Father → Parent1, Mother → Parent2 when both exist
        usort($parents, function (array $a, array $b): int {
            $rank = static fn (array $p): int => match (strtolower((string) ($p['relationship'] ?? ''))) {
                'father' => 0,
                'mother' => 1,
                default  => 2,
            };

            return $rank($a) <=> $rank($b);
        });

        foreach ([0 => 'parent1', 1 => 'parent2'] as $slot => $key) {
            if (! isset($parents[$slot])) {
                continue;
            }

            $rel = strtolower((string) ($parents[$slot]['relationship'] ?? ''));
            $label = match ($rel) {
                'father' => 'Father',
                'mother' => 'Mother',
                default  => 'Parent',
            };
            $values = array_merge($values, $this->mapFamilyMember($parents[$slot], "applicant.family.{$key}", $label));
        }

        for ($i = Imm5406FamilyCapacityService::PARENT_SLOTS; $i < count($parents); $i++) {
            $values = array_merge(
                $values,
                $this->mapFamilyMember($parents[$i], "applicant.family.parents_overflow.{$i}", 'Parent'),
            );
        }

        return $values;
    }

    /**
     * @param  array<string, mixed>  $person
     * @return array<string, mixed>
     */
    private function mapFamilyMember(array $person, string $prefix, ?string $relationship = null): array
    {
        $fullName = $person['fullName'] ?? $person['passportFullName'] ?? $person['nicFullName'] ?? '';
        $nameParts = preg_split('/\s+/', trim((string) $fullName), 2) ?: [];

        return array_filter([
            "{$prefix}.given_names"      => $nameParts[0] ?? null,
            "{$prefix}.family_name"      => $nameParts[1] ?? null,
            "{$prefix}.full_name"        => $fullName ?: null,
            "{$prefix}.date_of_birth"    => $this->normalizeDate($person['dob'] ?? $person['nicDob'] ?? null),
            "{$prefix}.relationship"     => $relationship ?? $this->relationshipLabel((string) ($person['relationship'] ?? ''), $person),
            "{$prefix}.country_of_birth" => $person['birthCountry'] ?? $person['nicBirthPlace'] ?? $person['passportNationality'] ?? null,
            "{$prefix}.address.full"     => $person['nicAddress'] ?? null,
            "{$prefix}.marital_status"   => $person['maritalStatus'] ?? null,
            "{$prefix}.contact.email"    => $person['email'] ?? $person['contactEmail'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @param  array<string, mixed>  $person */
    private function relationshipLabel(string $relationship, array $person): string
    {
        return match ($relationship) {
            'father'        => 'Father',
            'mother'        => 'Mother',
            'my_parent'     => 'Parent',
            'spouse_father' => 'Spouse\'s Father',
            'spouse_mother' => 'Spouse\'s Mother',
            'spouse_parent' => 'Spouse\'s Parent',
            'sibling'       => 'Sibling',
            'in_law'        => 'In-Law',
            'other'         => trim((string) ($person['otherRelationship'] ?? '')) ?: 'Other',
            default         => ucfirst($relationship ?: 'Other'),
        };
    }

    private function resolveMaritalStatusLabel(mixed $married): ?string
    {
        return match (strtolower((string) $married)) {
            'yes' => 'Married',
            'no'  => 'Single',
            default => null,
        };
    }

    /** @param  array<string, mixed>  $step3
     * @return array<string, mixed>
     */
    private function mapStep3(array $step3): array
    {
        if ($step3 === []) {
            return [];
        }

        $values = [];
        foreach ($step3 as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $values['applicant.background.' . $key] = $value;
        }

        return $values;
    }

    /** @param  array<string, mixed>  $main */
    private function buildAddress(array $main): ?string
    {
        $parts = array_filter([
            $main['addressLine1'] ?? $main['address'] ?? null,
            $main['addressLine2'] ?? null,
            $main['city'] ?? null,
            $main['province'] ?? $main['state'] ?? null,
            $main['postalCode'] ?? null,
            $main['countryOfResidence'] ?? null,
        ]);

        return $parts !== [] ? implode(', ', $parts) : null;
    }

    private function normalizeUci(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $digits = preg_replace('/\D+/', '', (string) $value) ?? '';

        return $digits !== '' ? $digits : null;
    }

    private function normalizeDate(mixed $value, bool $yearOnly = false): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($yearOnly && preg_match('/^\d{4}$/', (string) $value)) {
            return (string) $value . '-01-01';
        }

        $ts = strtotime((string) $value);

        return $ts ? date('Y-m-d', $ts) : null;
    }

    /** @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function filterEmpty(array $values): array
    {
        return array_filter($values, fn ($v) => $v !== null && $v !== '');
    }
}
