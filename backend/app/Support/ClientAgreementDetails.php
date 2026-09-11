<?php

namespace App\Support;

use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;

class ClientAgreementDetails
{
    public static function extract(?ClientProfile $profile, ?array $stored = null): array
    {
        $profile?->loadMissing('user:id,name,email,phone');
        $submission = self::loadSubmission($profile);
        $main = is_array($submission?->main_data) ? $submission->main_data : [];
        $step1 = is_array($submission?->step1_data) ? $submission->step1_data : [];
        $verified = is_array($submission?->verified_fields) ? $submission->verified_fields : [];

        $composed = trim(implode(' ', array_filter([
            $main['firstName'] ?? null,
            $main['lastName'] ?? null,
        ], fn ($v) => is_string($v) && trim($v) !== '')));

        $extracted = [
            'fullLegalName' => self::pickVerifiedThenAny($verified, [
                [['main_data.passportFullName', 'main_data.fullName'], $main['passportFullName'] ?? null],
                [['main_data.fullName', 'main_data.passportFullName'], $main['fullName'] ?? null],
                [['main_data.nicFullName'], $main['nicFullName'] ?? null],
                [['main_data.firstName', 'main_data.lastName'], $composed !== '' ? $composed : null],
                [['step1_data.fullName'], $step1['fullName'] ?? null],
                [[], $profile?->user?->name],
            ]),
            'email' => self::pickVerifiedThenAny($verified, [
                [['step1_data.email', 'main_data.email'], $step1['email'] ?? null],
                [['main_data.email'], $main['email'] ?? null],
                [[], $profile?->user?->email],
            ]),
            'phone' => self::pickVerifiedThenAny($verified, [
                [['main_data.phone'], $main['phone'] ?? null],
                [['main_data.mobile'], $main['mobile'] ?? null],
                [['step1_data.whatsapp'], $step1['whatsapp'] ?? null],
                [[], $profile?->phone],
                [[], $profile?->user?->phone],
            ]),
            'dateOfBirth' => self::formatDob(self::pickVerifiedThenAny($verified, [
                [['main_data.dob'], $main['dob'] ?? null],
                [['main_data.passportDob'], $main['passportDob'] ?? null],
                [['main_data.nicDob'], $main['nicDob'] ?? null],
            ])),
            'passportNumber' => self::pickVerifiedThenAny($verified, [
                [['main_data.passportNumber'], $main['passportNumber'] ?? null],
                [[], $profile?->passport_number],
            ]),
            'citizenship' => self::pickVerifiedThenAny($verified, [
                [['main_data.passportNationality'], $main['passportNationality'] ?? null],
                [['main_data.nationality'], $main['nationality'] ?? null],
            ]),
            'residentialAddress' => self::cleanAddress(self::pickVerifiedThenAny($verified, [
                [['main_data.nicAddress'], $main['nicAddress'] ?? null],
                [['main_data.currentAddress', 'main_data.addressLine1'], $main['currentAddress'] ?? null],
                [['main_data.address', 'main_data.addressLine1'], $main['address'] ?? null],
                [['main_data.mailingAddress'], $main['mailingAddress'] ?? null],
                [['main_data.residentialAddress'], $main['residentialAddress'] ?? null],
                [['main_data.addressLine1', 'main_data.city', 'main_data.province', 'main_data.postalCode'], self::composeAddress(
                    $main['addressLine1'] ?? $main['streetAddress'] ?? null,
                    $main['city'] ?? null,
                    $main['province'] ?? null,
                    $main['postalCode'] ?? null,
                    $main['countryOfResidence'] ?? $main['country'] ?? null,
                )],
            ])),
            'caseReference' => $profile ? 'WTC-'.$profile->id : null,
        ];

        // Stored agreement_config fills gaps only — verified/questionnaire wins.
        return self::mergeGaps($extracted, is_array($stored) ? $stored : null);
    }

    /** @param  array<string, mixed>  $base  @param  array<string, mixed>|null  $overrides */
    public static function merge(array $base, ?array $overrides): array
    {
        if (! $overrides) {
            return $base;
        }

        foreach ($overrides as $key => $value) {
            if (is_string($value) && trim($value) !== '') {
                $base[$key] = $key === 'residentialAddress'
                    ? self::cleanAddress($value)
                    : trim($value);
            }
        }

        return $base;
    }

    /** @param  array<string, mixed>  $extracted  @param  array<string, mixed>|null  $stored */
    private static function mergeGaps(array $extracted, ?array $stored): array
    {
        if (! $stored) {
            return $extracted;
        }

        foreach ($stored as $key => $value) {
            $existing = $extracted[$key] ?? null;
            if (is_string($existing) && trim($existing) !== '') {
                continue;
            }
            if (is_string($value) && trim($value) !== '') {
                $extracted[$key] = $key === 'residentialAddress'
                    ? self::cleanAddress($value)
                    : trim($value);
            }
        }

        return $extracted;
    }

    private static function loadSubmission(?ClientProfile $profile): ?QuestionnaireSubmission
    {
        if (! $profile?->user_id) {
            return null;
        }

        return QuestionnaireSubmission::where('user_id', $profile->user_id)->first();
    }

    /**
     * @param  array<string, mixed>  $verified
     * @param  list<array{0: list<string>, 1: mixed}>  $candidates
     */
    private static function pickVerifiedThenAny(array $verified, array $candidates): ?string
    {
        foreach ($candidates as [$keys, $value]) {
            if (self::anyVerified($verified, $keys)) {
                $picked = self::pickString($value);
                if ($picked !== null) {
                    return $picked;
                }
            }
        }

        foreach ($candidates as [, $value]) {
            $picked = self::pickString($value);
            if ($picked !== null) {
                return $picked;
            }
        }

        return null;
    }

    /** @param  array<string, mixed>  $verified  @param  list<string>  $keys */
    private static function anyVerified(array $verified, array $keys): bool
    {
        foreach ($keys as $key) {
            if (! empty($verified[$key])) {
                return true;
            }
        }

        return false;
    }

    private static function pickString(mixed ...$values): ?string
    {
        foreach ($values as $value) {
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return null;
    }

    private static function composeAddress(mixed ...$parts): ?string
    {
        $chunks = [];
        foreach ($parts as $part) {
            if (! is_string($part) || trim($part) === '') {
                continue;
            }
            foreach (explode(',', $part) as $piece) {
                $piece = trim($piece);
                if ($piece !== '') {
                    $chunks[] = $piece;
                }
            }
        }

        return $chunks === [] ? null : implode(', ', $chunks);
    }

    private static function cleanAddress(?string $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        return preg_replace('/,\s*,+/', ', ', preg_replace('/\s+/', ' ', trim($value)) ?? '') ?: null;
    }

    private static function formatDob(mixed $value): ?string
    {
        $raw = self::pickString($value);

        if (! $raw) {
            return null;
        }

        try {
            return \Carbon\Carbon::parse($raw)->format('F j, Y');
        } catch (\Throwable) {
            return $raw;
        }
    }
}
