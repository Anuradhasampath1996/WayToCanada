<?php

namespace App\Services\GovernmentForms;

use App\Models\ClientProfile;
use App\Models\GovernmentFormVersion;
use App\Models\QuestionnaireSubmission;
use Illuminate\Support\Str;

use App\Support\GovernmentForms\CanonicalKeyLabel;

/**
 * Measures how many mapped PDF fields have canonical values,
 * and maps unanswered fields to questionnaire remark keys for client requests.
 */
class FormFillCoverageService
{
    public function __construct(
        private CanonicalDataResolver $canonicalResolver,
        private GovernmentFormGapFillService $gapFillService,
    ) {}

    /**
     * @return array{
     *   mapped_total: int,
     *   mapped_filled: int,
     *   percentage: int,
     *   unanswered_fields: list<array{
     *     key: string,
     *     label: string,
     *     questionnaire_key: string|null,
     *     responsible_party: string,
     *     can_request: bool,
     *     can_fill: bool
     *   }>
     * }
     */
    public function assess(ClientProfile $profile, GovernmentFormVersion $version, ?\App\Models\CaseFile $caseFile = null): array
    {
        $caseFile ??= $profile->caseFiles()->latest('id')->first();
        $canonical = $caseFile
            ? $this->canonicalResolver->resolveLive($caseFile)
            : null;

        $values = $canonical?->values ?? [];
        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();

        $mappings = $version->mappings()->orderBy('sort_order')->get();
        $applicable = $mappings->filter(function ($mapping) use ($values) {
            return $this->isApplicableMapping($mapping->canonical_key, $values);
        });

        $unanswered = [];
        $filled = 0;

        foreach ($applicable as $mapping) {
            $value = $values[$mapping->canonical_key] ?? null;
            $hasValue = $value !== null && $value !== '';

            if ($hasValue) {
                $filled++;
                continue;
            }

            $questionnaireKey = $this->resolveQuestionnaireKey($mapping->canonical_key, $submission);
            $canFill = $this->gapFillService->resolveTarget($mapping->canonical_key) !== null;
            $canRequest = $questionnaireKey !== null
                && ! str_starts_with($mapping->canonical_key, 'representative.')
                && $this->questionnaireFieldExists($questionnaireKey);

            $unanswered[] = [
                'key' => $mapping->canonical_key,
                'label' => CanonicalKeyLabel::from($mapping->canonical_key),
                'questionnaire_key' => $questionnaireKey,
                'responsible_party' => str_starts_with($mapping->canonical_key, 'representative.') ? 'consultant' : 'client',
                'can_request' => $canRequest,
                'can_fill' => $canFill,
            ];
        }

        $total = $applicable->count();
        $percentage = $total === 0 ? 0 : (int) round(($filled / $total) * 100);

        return [
            'mapped_total' => $total,
            'mapped_filled' => $filled,
            'percentage' => $percentage,
            'unanswered_fields' => $unanswered,
        ];
    }

    /**
     * Skip optional slots that do not exist yet (no child 2 if only 1 child, etc.).
     *
     * @param  array<string, mixed>  $values
     */
    private function isApplicableMapping(string $canonicalKey, array $values): bool
    {
        if (preg_match('/^applicant\.family\.children\.(\d+)\./', $canonicalKey, $m)) {
            $idx = (int) $m[1];
            if ($idx === 0) {
                return true; // readiness always expects child 0 for now
            }

            return isset($values["applicant.family.children.{$idx}.family_name"])
                || isset($values["applicant.family.children.{$idx}.given_names"])
                || isset($values["applicant.family.children.{$idx}.full_name"]);
        }

        if (preg_match('/^applicant\.family\.siblings\.(\d+)\./', $canonicalKey, $m)) {
            $idx = (int) $m[1];

            return isset($values["applicant.family.siblings.{$idx}.family_name"])
                || isset($values["applicant.family.siblings.{$idx}.given_names"])
                || isset($values["applicant.family.siblings.{$idx}.full_name"]);
        }

        if (str_starts_with($canonicalKey, 'applicant.family.spouse.')) {
            $married = strtolower((string) ($values['applicant.flags.married'] ?? $values['applicant.personal.marital_status'] ?? ''));

            return in_array($married, ['yes', 'married'], true)
                || isset($values['applicant.family.spouse.family_name'])
                || isset($values['applicant.family.spouse.given_names']);
        }

        if (str_starts_with($canonicalKey, 'applicant.family.parents_overflow.')) {
            return false;
        }

        return true;
    }

    public function resolveQuestionnaireKey(string $canonicalKey, ?QuestionnaireSubmission $submission): ?string
    {
        $key = Str::lower(trim($canonicalKey));

        $static = [
            'applicant.personal.family_name' => 'main_data.passportFullName',
            'applicant.personal.given_names' => 'main_data.passportFullName',
            'applicant.personal.full_name' => 'main_data.passportFullName',
            'applicant.personal.date_of_birth' => 'main_data.dob',
            'applicant.personal.uci' => 'main_data.uci',
            'applicant.application.type' => 'main_data.imm5476ApplicationType',
            'applicant.personal.country_of_birth' => 'main_data.birthCountry',
            'applicant.personal.address.full' => 'main_data.addressLine1',
            'applicant.address.line1' => 'main_data.addressLine1',
            'applicant.address.city' => 'main_data.city',
            'applicant.address.province' => 'main_data.province',
            'applicant.address.postal_code' => 'main_data.postalCode',
            'applicant.address.country' => 'main_data.countryOfResidence',
            'applicant.personal.marital_status' => 'step1_data.married',
            'applicant.contact.email' => 'step1_data.email',
            'applicant.contact.phone' => 'step1_data.whatsapp',
            'applicant.passport.number' => 'main_data.passportNumber',
            'applicant.passport.country' => 'main_data.passportNationality',
            'applicant.national_id.number' => 'main_data.nicNumber',
            'applicant.national_id.country' => 'main_data.passportNationality',
            'applicant.education.level' => 'main_data.educationLevels',
            'applicant.work.job_title' => 'main_data.currentJobTitle',
            'applicant.work.intended_occupation' => 'main_data.intendedNocTitle',
            'applicant.family.spouse.family_name' => 'spouse_data.passportFullName',
            'applicant.family.spouse.given_names' => 'spouse_data.passportFullName',
            'applicant.family.spouse.date_of_birth' => 'spouse_data.dob',
            'applicant.family.spouse.country_of_birth' => 'spouse_data.nicBirthPlace',
            'applicant.family.spouse.address.full' => 'spouse_data.nicAddress',
            'applicant.family.spouse.marital_status' => 'spouse_data.maritalStatus',
            'applicant.family.spouse.contact.email' => 'spouse_data.email',
        ];

        if (isset($static[$key])) {
            return $static[$key];
        }

        if (preg_match('/^applicant\.family\.children\.(\d+)\.(.+)$/', $key, $m)) {
            $field = $this->familyQuestionnaireField($m[2]);

            return $field ? "children_data.{$m[1]}.{$field}" : null;
        }

        if (preg_match('/^applicant\.family\.parent([12])\.(.+)$/', $key, $m)) {
            $slot = (int) $m[1] - 1;
            $field = $this->familyQuestionnaireField($m[2]);
            if (! $field || ! $submission) {
                return null;
            }
            $index = $this->parentAccompanyingIndex($submission, $slot);

            return $index === null ? null : "accompanying_data.{$index}.{$field}";
        }

        if (preg_match('/^applicant\.family\.siblings\.(\d+)\.(.+)$/', $key, $m)) {
            $field = $this->familyQuestionnaireField($m[2]);
            if (! $field || ! $submission) {
                return null;
            }
            $index = $this->siblingAccompanyingIndex($submission, (int) $m[1]);

            return $index === null ? null : "accompanying_data.{$index}.{$field}";
        }

        return null;
    }

    private function familyQuestionnaireField(string $suffix): ?string
    {
        return match ($suffix) {
            'date_of_birth' => 'dob',
            'family_name', 'given_names', 'full_name' => 'passportFullName',
            'country_of_birth' => 'nicBirthPlace',
            'address.full' => 'nicAddress',
            'marital_status' => 'maritalStatus',
            'contact.email' => 'email',
            'uci' => 'uci',
            'relationship' => 'relationship',
            default => null,
        };
    }

    private function parentAccompanyingIndex(QuestionnaireSubmission $submission, int $slot): ?int
    {
        $accompanying = $submission->accompanying_data ?? [];
        $parentEntries = [];

        foreach ($accompanying as $index => $person) {
            if (! is_array($person)) {
                continue;
            }
            $rel = strtolower((string) ($person['relationship'] ?? ''));
            if (in_array($rel, ['father', 'mother', 'my_parent'], true)) {
                $parentEntries[] = ['index' => (int) $index, 'person' => $person];
            }
        }

        usort($parentEntries, function (array $a, array $b): int {
            $rank = static fn (array $p): int => match (strtolower((string) ($p['person']['relationship'] ?? ''))) {
                'father' => 0,
                'mother' => 1,
                default => 2,
            };

            return $rank($a) <=> $rank($b);
        });

        return $parentEntries[$slot]['index'] ?? null;
    }

    private function siblingAccompanyingIndex(QuestionnaireSubmission $submission, int $siblingSlot): ?int
    {
        $accompanying = $submission->accompanying_data ?? [];
        $siblingIndex = 0;

        foreach ($accompanying as $index => $person) {
            if (! is_array($person)) {
                continue;
            }
            $rel = strtolower((string) ($person['relationship'] ?? ''));
            if (! in_array($rel, ['sibling', 'spouse_father', 'spouse_mother', 'spouse_parent', 'in_law', 'other'], true)) {
                continue;
            }
            if ($siblingIndex === $siblingSlot) {
                return (int) $index;
            }
            $siblingIndex++;
        }

        return null;
    }

    /**
     * Only request fields the client questionnaire UI actually collects today.
     */
    private function questionnaireFieldExists(string $questionnaireKey): bool
    {
        if (preg_match('/^(step1_data|main_data|spouse_data)\.(.+)$/', $questionnaireKey, $m)) {
            $field = $m[2];
            if ($m[1] === 'spouse_data' && $field === 'maritalStatus') {
                return false;
            }

            return true;
        }

        if (preg_match('/^children_data\.\d+\.(.+)$/', $questionnaireKey, $m)) {
            return in_array($m[1], ['fullName', 'dob', 'nicBirthPlace', 'nicAddress', 'relationship', 'email', 'uci', 'name'], true);
        }

        if (preg_match('/^accompanying_data\.\d+\.(.+)$/', $questionnaireKey, $m)) {
            return in_array($m[1], ['fullName', 'dob', 'nicBirthPlace', 'nicAddress', 'relationship', 'otherRelationship', 'email'], true);
        }

        return false;
    }
}
