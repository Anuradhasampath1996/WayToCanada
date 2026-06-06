<?php

namespace App\Services;

use App\Models\QuestionnaireSubmission;
use App\Models\User;

class QuestionnaireFormPrefillService
{
    /** @return array<string, mixed> */
    public function buildPrefill(User $user, ?QuestionnaireSubmission $submission = null): array
    {
        $submission ??= QuestionnaireSubmission::where('user_id', $user->id)->first();

        if (! $submission) {
            return $this->userOnlyPrefill($user);
        }

        $step1 = $submission->step1_data ?? [];
        $main  = $submission->main_data ?? [];

        $prefill = array_merge(
            $this->userOnlyPrefill($user),
            $this->mapPersonal($step1, $main, $user),
            $this->mapWork($main),
            $this->mapEducation($main),
        );

        return array_filter($prefill, fn ($v) => $v !== null && $v !== '');
    }

    /** @return array<string, mixed> */
    private function userOnlyPrefill(User $user): array
    {
        $parts = preg_split('/\s+/', trim($user->name ?? ''), 2) ?: [];

        return array_filter([
            'email'       => $user->email,
            'phone'       => $user->phone,
            'given_names' => $parts[0] ?? null,
            'family_name' => $parts[1] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @param  array<string, mixed>  $step1
     * @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapPersonal(array $step1, array $main, User $user): array
    {
        $fullName = $main['passportFullName'] ?? $step1['fullName'] ?? $user->name ?? '';
        $nameParts = preg_split('/\s+/', trim($fullName), 2) ?: [];

        $gender = strtolower((string) ($main['passportGender'] ?? ''));
        $genderMap = [
            'male'   => 'male',
            'female' => 'female',
            'm'      => 'male',
            'f'      => 'female',
        ];

        return array_filter([
            'given_names'           => $nameParts[0] ?? null,
            'family_name'           => $nameParts[1] ?? ($nameParts[0] !== ($main['passportFullName'] ?? '') ? null : null),
            'date_of_birth'         => $this->normalizeDate($main['dob'] ?? $main['passportDob'] ?? null),
            'gender'                => $genderMap[$gender] ?? ($gender === 'other' ? 'other' : null),
            'city_of_birth'         => $main['birthCity'] ?? $main['birthPlace'] ?? null,
            'country_of_birth'      => $main['birthCountry'] ?? $main['passportNationality'] ?? null,
            'citizenship'           => $main['passportNationality'] ?? $main['citizenship'] ?? null,
            'email'                 => $step1['email'] ?? $user->email,
            'phone'                 => $step1['whatsapp'] ?? $step1['phone'] ?? $user->phone,
            'current_address'       => $this->buildAddress($main),
            'passport_number'       => $main['passportNumber'] ?? null,
            'passport_issue_date'   => $this->normalizeDate($main['passportIssueDate'] ?? null),
            'passport_expiry_date'  => $this->normalizeDate($main['passportExpiry'] ?? null),
            'passport_expiry'       => $this->normalizeDate($main['passportExpiry'] ?? null),
            'passport_country'      => $main['passportNationality'] ?? null,
            'birth_country'         => $main['birthCountry'] ?? $main['passportNationality'] ?? null,
            'full_name'             => $fullName ?: null,
            'travel_purpose'        => $step1['visaType'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapWork(array $main): array
    {
        return array_filter([
            'job_title'        => $main['currentJobTitle'] ?? null,
            'employer_name'    => $main['currentEmployer'] ?? $main['employerName'] ?? null,
            'employer_city'    => $main['currentJobCity'] ?? null,
            'employer_country' => $main['currentJobCountry'] ?? $main['countryOfResidence'] ?? null,
            'main_duties'      => $main['currentJobDuties'] ?? $main['currentJobField'] ?? null,
            'hours_per_week'   => $main['weeklyWorkHours'] ?? null,
            'work_start_date'  => $this->normalizeDate($main['currentJobStartDate'] ?? null),
        ], fn ($v) => $v !== null && $v !== '');
    }

    /** @param  array<string, mixed>  $main
     * @return array<string, mixed>
     */
    private function mapEducation(array $main): array
    {
        $quals = $main['educationQuals'] ?? [];
        $first = is_array($quals) && count($quals) > 0 ? ($quals[0] ?? []) : [];

        return array_filter([
            'field_of_study'        => $first['courseName'] ?? $main['canadaStudyProgram'] ?? null,
            'institution_name'      => $first['universityName'] ?? $main['canadaStudyInstitution'] ?? null,
            'institution_country'   => $first['country'] ?? null,
            'education_end_date'    => $this->normalizeDate($first['graduationYear'] ?? null, yearOnly: true),
            'education_start_date'  => null,
            'eca_completed'         => ! empty($main['hasEca']) ? ($main['hasEca'] === 'yes' ? 'yes' : 'no') : null,
            'eca_organization'      => $main['ecaProvider'] ?? null,
            'eca_reference_number'  => $main['ecaReference'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
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

    /**
     * Merge prefill into existing response data without overwriting user entries.
     *
     * @param  array<string, mixed>  $existing
     * @param  array<string, mixed>  $prefill
     * @return array<string, mixed>
     */
    public function mergePrefill(array $existing, array $prefill): array
    {
        foreach ($prefill as $key => $value) {
            if (! array_key_exists($key, $existing) || $existing[$key] === null || $existing[$key] === '') {
                $existing[$key] = $value;
            }
        }

        return $existing;
    }
}
