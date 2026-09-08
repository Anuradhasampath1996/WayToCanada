<?php

namespace App\Services\GovernmentForms;

use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Illuminate\Support\Str;

class GovernmentFormGapFillService
{
    /**
     * @return array{type: string, path?: string, field_key?: string, consultant_field?: string}
     */
    public function resolveTarget(string $canonicalKey): ?array
    {
        $key = Str::lower(trim($canonicalKey));

        if (str_starts_with($key, 'representative.')) {
            return $this->resolveRepresentativeTarget($key);
        }

        if (preg_match('/^applicant\.family\.children\.(\d+)\./', $key, $m)) {
            $field = $this->childFieldSuffix($key);

            return $field ? [
                'type'      => 'questionnaire_child',
                'index'     => (int) $m[1],
                'field'     => $field,
                'field_key' => "children_data.{$m[1]}.{$field}",
            ] : null;
        }

        if (preg_match('/^applicant\.family\.siblings\.(\d+)\./', $key, $m)) {
            $field = $this->childFieldSuffix($key);

            return $field ? [
                'type'      => 'questionnaire_sibling',
                'index'     => (int) $m[1],
                'field'     => $field,
                'field_key' => "accompanying_data.sibling{$m[1]}.{$field}",
            ] : null;
        }

        if (preg_match('/^applicant\.family\.parent([12])\./', $key, $m)) {
            $slot = (int) $m[1] - 1;
            $field = $this->parentFieldSuffix($key);

            return $field ? [
                'type'      => 'questionnaire_parent',
                'slot'      => $slot,
                'field'     => $field,
                'field_key' => "accompanying_data.parent{$m[1]}.{$field}",
            ] : null;
        }

        if (str_starts_with($key, 'applicant.family.spouse.')) {
            $field = $this->spouseFieldSuffix($key);

            return $field ? [
                'type'      => 'questionnaire_spouse',
                'field'     => $field,
                'field_key' => "spouse_data.{$field}",
            ] : null;
        }

        return match ($key) {
            'applicant.personal.date_of_birth'    => ['type' => 'questionnaire', 'path' => 'main_data.dob', 'field_key' => 'main_data.dob', 'input' => 'date'],
            'applicant.personal.uci'              => ['type' => 'questionnaire', 'path' => 'main_data.uci', 'field_key' => 'main_data.uci', 'input' => 'text'],
            'applicant.application.type'          => ['type' => 'questionnaire', 'path' => 'main_data.imm5476ApplicationType', 'field_key' => 'main_data.imm5476ApplicationType', 'input' => 'text'],
            'applicant.personal.country_of_birth' => ['type' => 'questionnaire', 'path' => 'main_data.birthCountry', 'field_key' => 'main_data.birthCountry', 'input' => 'text'],
            'applicant.personal.marital_status'   => ['type' => 'questionnaire', 'path' => 'step1_data.married', 'field_key' => 'step1_data.married', 'input' => 'select', 'options' => ['yes', 'no']],
            'applicant.contact.email'             => ['type' => 'questionnaire', 'path' => 'step1_data.email', 'field_key' => 'step1_data.email', 'input' => 'email'],
            'applicant.contact.phone'             => ['type' => 'questionnaire', 'path' => 'step1_data.whatsapp', 'field_key' => 'step1_data.whatsapp', 'input' => 'text'],
            'applicant.personal.address.full'     => ['type' => 'questionnaire', 'path' => 'main_data.addressLine1', 'field_key' => 'main_data.addressLine1', 'input' => 'text'],
            'applicant.address.line1'             => ['type' => 'questionnaire', 'path' => 'main_data.addressLine1', 'field_key' => 'main_data.addressLine1', 'input' => 'text'],
            'applicant.address.city'              => ['type' => 'questionnaire', 'path' => 'main_data.city', 'field_key' => 'main_data.city', 'input' => 'text'],
            'applicant.address.province'          => ['type' => 'questionnaire', 'path' => 'main_data.province', 'field_key' => 'main_data.province', 'input' => 'text'],
            'applicant.address.postal_code'       => ['type' => 'questionnaire', 'path' => 'main_data.postalCode', 'field_key' => 'main_data.postalCode', 'input' => 'text'],
            'applicant.address.country'           => ['type' => 'questionnaire', 'path' => 'main_data.countryOfResidence', 'field_key' => 'main_data.countryOfResidence', 'input' => 'text'],
            'applicant.passport.number'           => ['type' => 'questionnaire', 'path' => 'main_data.passportNumber', 'field_key' => 'main_data.passportNumber', 'input' => 'text'],
            'applicant.passport.country'          => ['type' => 'questionnaire', 'path' => 'main_data.passportNationality', 'field_key' => 'main_data.passportNationality', 'input' => 'text'],
            'applicant.national_id.number'        => ['type' => 'questionnaire', 'path' => 'main_data.nicNumber', 'field_key' => 'main_data.nicNumber', 'input' => 'text'],
            'applicant.work.job_title'            => ['type' => 'questionnaire', 'path' => 'main_data.currentJobTitle', 'field_key' => 'main_data.currentJobTitle', 'input' => 'text'],
            'applicant.work.intended_occupation'  => ['type' => 'questionnaire', 'path' => 'main_data.intendedNocTitle', 'field_key' => 'main_data.intendedNocTitle', 'input' => 'text'],
            'applicant.personal.family_name',
            'applicant.personal.given_names',
            'applicant.personal.full_name'        => ['type' => 'questionnaire', 'path' => 'main_data.passportFullName', 'field_key' => 'main_data.passportFullName', 'input' => 'text'],
            default => null,
        };
    }

    public function fill(ClientProfile $profile, User $consultant, string $canonicalKey, mixed $value): QuestionnaireSubmission|User
    {
        $target = $this->resolveTarget($canonicalKey);
        if ($target === null) {
            throw new \InvalidArgumentException('This field cannot be filled from the case hub yet.');
        }

        if ($canonicalKey === 'representative.address.street_number') {
            return $this->fillRepresentativeStreetNumber($consultant, $value);
        }

        return match ($target['type']) {
            'consultant' => $this->fillConsultantField($consultant, $target['consultant_field'], $value),
            'questionnaire' => $this->fillQuestionnairePath($profile, $target['path'], $value),
            'questionnaire_spouse' => $this->fillQuestionnairePath($profile, "spouse_data.{$target['field']}", $value),
            'questionnaire_child' => $this->fillQuestionnairePath(
                $profile,
                "children_data.{$target['index']}.{$target['field']}",
                $value,
            ),
            'questionnaire_parent' => $this->fillParentSlot($profile, $target['slot'], $target['field'], $value),
            'questionnaire_sibling' => $this->fillSiblingSlot($profile, $target['index'], $target['field'], $value),
            default => throw new \InvalidArgumentException('Unsupported fill target.'),
        };
    }

    /** @return array<string, mixed>|null */
    public function currentValue(ClientProfile $profile, User $consultant, string $canonicalKey): ?array
    {
        $target = $this->resolveTarget($canonicalKey);
        if ($target === null) {
            return null;
        }

        if ($target['type'] === 'consultant') {
            $field = $target['consultant_field'];

            return ['value' => $consultant->{$field} ?? ''];
        }

        $submission = QuestionnaireSubmission::firstOrCreate(['user_id' => $profile->user_id]);

        return ['value' => $this->readQuestionnaireValue($submission, $target, $canonicalKey)];
    }

    /** @return array{type: string, path?: string, field_key?: string, consultant_field?: string, input?: string, options?: array<int, string>}|null */
    public function fillMeta(string $canonicalKey): ?array
    {
        return $this->resolveTarget($canonicalKey);
    }

    private function fillConsultantField(User $consultant, string $field, mixed $value): User
    {
        if ($field === 'name') {
            $consultant->name = trim((string) $value);
        } elseif ($field === 'rcic_number') {
            $consultant->rcic_number = trim((string) $value);
        } else {
            $consultant->{$field} = $value;
        }

        $consultant->save();

        return $consultant->fresh();
    }

    /**
     * Street number is derived from company_address_line1 — merge instead of overwriting the whole line.
     */
    private function fillRepresentativeStreetNumber(User $consultant, mixed $value): User
    {
        $number = trim((string) $value);
        if ($number === '') {
            throw new \InvalidArgumentException('Please enter a street number.');
        }

        // Accept "123" or values accidentally pasted as "123 Main St" — use leading token as number.
        if (preg_match('/^(\d+[A-Za-z]?)\b/u', $number, $m)) {
            $number = $m[1];
        }

        $line1 = trim((string) ($consultant->company_address_line1 ?? ''));
        // Strip an existing leading street number (with or without following space).
        $rest = trim(preg_replace('/^\d+[A-Za-z]?\s*[,\- ]*/u', '', $line1) ?? '');

        $consultant->company_address_line1 = $rest === '' ? $number : "{$number} {$rest}";
        $consultant->save();

        return $consultant->fresh();
    }

    private function fillQuestionnairePath(ClientProfile $profile, string $path, mixed $value): QuestionnaireSubmission
    {
        $submission = QuestionnaireSubmission::firstOrCreate(['user_id' => $profile->user_id]);

        $parts = explode('.', $path);
        $section = array_shift($parts);
        $allowed = ['step1_data', 'main_data', 'spouse_data', 'children_data', 'accompanying_data'];

        if (! in_array($section, $allowed, true)) {
            throw new \InvalidArgumentException('Invalid questionnaire section.');
        }

        if (in_array($section, ['children_data', 'accompanying_data'], true)) {
            $idx = (int) array_shift($parts);
            $field = implode('.', $parts);
            $arr = $submission->{$section} ?? [];
            $arr[$idx] = $arr[$idx] ?? [];
            $arr[$idx][$field] = $value;
            $submission->update([$section => array_values($arr)]);
        } else {
            $field = implode('.', $parts);
            $sectionData = $submission->{$section} ?? [];
            $sectionData[$field] = $value;
            $submission->update([$section => $sectionData]);
        }

        return $submission->fresh();
    }

    private function isParentRelationship(mixed $person): bool
    {
        if (! is_array($person)) {
            return false;
        }

        return in_array(strtolower((string) ($person['relationship'] ?? '')), ['father', 'mother', 'my_parent'], true);
    }

    private function fillParentSlot(ClientProfile $profile, int $slot, string $field, mixed $value): QuestionnaireSubmission
    {
        $submission = QuestionnaireSubmission::firstOrCreate(['user_id' => $profile->user_id]);
        $accompanying = $submission->accompanying_data ?? [];
        $parents = array_values(array_filter(
            $accompanying,
            fn ($person) => $this->isParentRelationship($person),
        ));

        // Slot 0 = Father, slot 1 = Mother when creating empty placeholders
        $defaultRel = $slot === 0 ? 'father' : ($slot === 1 ? 'mother' : 'my_parent');

        while (count($parents) <= $slot) {
            $parents[] = ['relationship' => count($parents) === 0 ? 'father' : (count($parents) === 1 ? 'mother' : 'my_parent')];
        }

        $parents[$slot][$field] = $value;
        if (empty($parents[$slot]['relationship'])) {
            $parents[$slot]['relationship'] = $defaultRel;
        }

        $others = array_values(array_filter(
            $accompanying,
            fn ($person) => ! $this->isParentRelationship($person),
        ));

        $submission->update(['accompanying_data' => array_values([...$parents, ...$others])]);

        return $submission->fresh();
    }

    private function fillSiblingSlot(ClientProfile $profile, int $siblingSlot, string $field, mixed $value): QuestionnaireSubmission
    {
        $submission = QuestionnaireSubmission::firstOrCreate(['user_id' => $profile->user_id]);
        $accompanying = $submission->accompanying_data ?? [];
        $siblingRels = ['sibling', 'spouse_father', 'spouse_mother', 'spouse_parent', 'in_law', 'other'];
        $seen = 0;
        $targetIndex = null;

        foreach ($accompanying as $index => $person) {
            if (! is_array($person)) {
                continue;
            }
            $rel = strtolower((string) ($person['relationship'] ?? ''));
            if (! in_array($rel, $siblingRels, true)) {
                continue;
            }
            if ($seen === $siblingSlot) {
                $targetIndex = (int) $index;
                break;
            }
            $seen++;
        }

        if ($targetIndex === null) {
            $accompanying[] = ['relationship' => 'sibling', $field => $value];
        } else {
            $accompanying[$targetIndex][$field] = $value;
        }

        $submission->update(['accompanying_data' => array_values($accompanying)]);

        return $submission->fresh();
    }

    /** @param  array<string, mixed>  $target */
    private function readQuestionnaireValue(QuestionnaireSubmission $submission, array $target, string $canonicalKey): mixed
    {
        return match ($target['type']) {
            'questionnaire' => data_get([
                'step1_data' => $submission->step1_data ?? [],
                'main_data' => $submission->main_data ?? [],
            ], $target['path'] ?? '', ''),
            'questionnaire_spouse' => ($submission->spouse_data ?? [])[$target['field']] ?? '',
            'questionnaire_child' => ($submission->children_data[$target['index']] ?? [])[$target['field']] ?? '',
            'questionnaire_parent' => $this->readParentSlot($submission, $target['slot'], $target['field']),
            default => '',
        };
    }

    private function readParentSlot(QuestionnaireSubmission $submission, int $slot, string $field): mixed
    {
        $parents = array_values(array_filter(
            $submission->accompanying_data ?? [],
            fn ($person) => $this->isParentRelationship($person),
        ));

        usort($parents, function (array $a, array $b): int {
            $rank = static fn (array $p): int => match (strtolower((string) ($p['relationship'] ?? ''))) {
                'father' => 0,
                'mother' => 1,
                default  => 2,
            };

            return $rank($a) <=> $rank($b);
        });

        return ($parents[$slot] ?? [])[$field] ?? '';
    }

    /** @return array{type: string, consultant_field: string, field_key: string, input: string}|null */
    private function resolveRepresentativeTarget(string $key): ?array
    {
        return match ($key) {
            'representative.rcic_number',
            'representative.membership_id' => [
                'type' => 'consultant',
                'consultant_field' => 'rcic_number',
                'field_key' => 'consultant.rcic_number',
                'input' => 'text',
            ],
            'representative.personal.given_names',
            'representative.personal.family_name',
            'representative.personal.full_name' => [
                'type' => 'consultant',
                'consultant_field' => 'name',
                'field_key' => 'consultant.name',
                'input' => 'text',
            ],
            'representative.firm_name' => [
                'type' => 'consultant',
                'consultant_field' => 'company_name',
                'field_key' => 'consultant.company_name',
                'input' => 'text',
            ],
            'representative.contact.email' => [
                'type' => 'consultant',
                'consultant_field' => 'email',
                'field_key' => 'consultant.email',
                'input' => 'email',
            ],
            'representative.contact.phone',
            'representative.contact.phone_country_code',
            'representative.contact.phone_number' => [
                'type' => 'consultant',
                'consultant_field' => 'company_phone',
                'field_key' => 'consultant.company_phone',
                'input' => 'text',
            ],
            'representative.address.street_name',
            'representative.address.street_number',
            'representative.address.line1' => [
                'type' => 'consultant',
                'consultant_field' => 'company_address_line1',
                'field_key' => 'consultant.company_address_line1',
                'input' => 'text',
            ],
            'representative.address.unit',
            'representative.address.line2' => [
                'type' => 'consultant',
                'consultant_field' => 'company_address_line2',
                'field_key' => 'consultant.company_address_line2',
                'input' => 'text',
            ],
            'representative.address.city' => [
                'type' => 'consultant',
                'consultant_field' => 'company_city',
                'field_key' => 'consultant.company_city',
                'input' => 'text',
            ],
            'representative.address.province' => [
                'type' => 'consultant',
                'consultant_field' => 'company_province',
                'field_key' => 'consultant.company_province',
                'input' => 'text',
            ],
            'representative.address.postal_code' => [
                'type' => 'consultant',
                'consultant_field' => 'company_postal_code',
                'field_key' => 'consultant.company_postal_code',
                'input' => 'text',
            ],
            'representative.address.country' => [
                'type' => 'consultant',
                'consultant_field' => 'company_country',
                'field_key' => 'consultant.company_country',
                'input' => 'text',
            ],
            default => null,
        };
    }

    private function childFieldSuffix(string $key): ?string
    {
        return match (true) {
            str_ends_with($key, '.date_of_birth') => 'dob',
            str_ends_with($key, '.family_name'),
            str_ends_with($key, '.given_names'),
            str_ends_with($key, '.full_name') => 'fullName',
            str_ends_with($key, '.country_of_birth') => 'nicBirthPlace',
            str_ends_with($key, '.address.full') => 'nicAddress',
            str_ends_with($key, '.marital_status') => 'maritalStatus',
            str_ends_with($key, '.contact.email') => 'email',
            str_ends_with($key, '.relationship') => 'relationship',
            default => null,
        };
    }

    private function parentFieldSuffix(string $key): ?string
    {
        return $this->childFieldSuffix($key);
    }

    private function spouseFieldSuffix(string $key): ?string
    {
        return $this->childFieldSuffix($key);
    }
}
