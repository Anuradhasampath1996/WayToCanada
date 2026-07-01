<?php

namespace App\Support;

use App\Models\ClientProfile;
use App\Models\QuestionnaireSubmission;

class ClientAgreementDetails
{
    public static function extract(?ClientProfile $profile, ?array $stored = null): array
    {
        $profile?->loadMissing('user:id,name,email,phone');
        $main = self::loadQuestionnaireMain($profile);
        $step1 = self::loadQuestionnaireStep1($profile);

        $passportName = self::pickString($main['passportFullName'] ?? null, $main['fullName'] ?? null, $main['nicFullName'] ?? null);
        $composed = trim(implode(' ', array_filter([
            $main['firstName'] ?? null,
            $main['lastName'] ?? null,
        ], fn ($v) => is_string($v) && trim($v) !== '')));

        $extracted = [
            'fullLegalName'      => $passportName ?: ($composed ?: ($profile?->user?->name)),
            'email'              => self::pickString($step1['email'] ?? null, $profile?->user?->email),
            'phone'              => self::pickString(
                $main['phone'] ?? null,
                $main['mobile'] ?? null,
                $step1['whatsapp'] ?? null,
                $profile?->phone,
                $profile?->user?->phone,
            ),
            'dateOfBirth'        => self::formatDob($main['dob'] ?? $main['passportDob'] ?? $main['nicDob'] ?? null),
            'passportNumber'     => self::pickString($main['passportNumber'] ?? null, $profile?->passport_number),
            'citizenship'        => self::pickString($main['passportNationality'] ?? null, $main['nationality'] ?? null),
            'residentialAddress' => self::cleanAddress(self::pickString(
                $main['nicAddress'] ?? null,
                $main['currentAddress'] ?? null,
                $main['address'] ?? null,
                $main['mailingAddress'] ?? null,
                $main['residentialAddress'] ?? null,
            )),
            'caseReference'      => $profile ? 'WTC-' . $profile->id : null,
        ];

        return self::merge($extracted, is_array($stored) ? $stored : null);
    }

    /** @param array<string, mixed> $base @param array<string, mixed>|null $overrides */
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

    private static function loadQuestionnaireMain(?ClientProfile $profile): array
    {
        if (! $profile?->user_id) {
            return [];
        }

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();

        return is_array($submission?->main_data) ? $submission->main_data : [];
    }

    private static function loadQuestionnaireStep1(?ClientProfile $profile): array
    {
        if (! $profile?->user_id) {
            return [];
        }

        $submission = QuestionnaireSubmission::where('user_id', $profile->user_id)->first();

        return is_array($submission?->step1_data) ? $submission->step1_data : [];
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

    private static function cleanAddress(?string $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        return preg_replace('/,\s*,+/', ', ', preg_replace('/\s+/', ' ', trim($value)));
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
