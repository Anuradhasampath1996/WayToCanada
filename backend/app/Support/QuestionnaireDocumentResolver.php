<?php

namespace App\Support;

use App\Models\QuestionnaireSubmission;
use Illuminate\Support\Facades\Storage;

class QuestionnaireDocumentResolver
{
    /**
     * Resolve a questionnaire document reference (full S3 path or bare filename) to a storage path.
     */
    public static function resolveStoragePath(QuestionnaireSubmission $submission, string $path): ?string
    {
        if (preg_match('#^client-document/\d{4}/\d{2}/#', $path)) {
            return self::submissionContainsFilePath($submission, $path) ? $path : null;
        }

        $basename = basename($path);

        $fullPath = self::findFullPathInSubmission($submission, $basename);
        if ($fullPath) {
            return $fullPath;
        }

        if (! self::submissionContainsFilePath($submission, $path)
            && ! self::submissionContainsBasename($submission, $basename)) {
            return null;
        }

        return self::locateInStorage($basename);
    }

    private static function findFullPathInSubmission(QuestionnaireSubmission $submission, string $basename): ?string
    {
        foreach (self::allSubmissionSections($submission) as $data) {
            $found = self::findPathEndingWith($data, $basename);
            if ($found) {
                return $found;
            }
        }

        return null;
    }

    private static function findPathEndingWith(mixed $data, string $basename): ?string
    {
        if (! is_array($data)) {
            return null;
        }

        foreach ($data as $value) {
            if (is_string($value) && preg_match('#^client-document/\d{4}/\d{2}/#', $value)) {
                if (basename($value) === $basename) {
                    return $value;
                }
            }
            if (is_array($value)) {
                $nested = self::findPathEndingWith($value, $basename);
                if ($nested) {
                    return $nested;
                }
            }
        }

        return null;
    }

    private static function submissionContainsBasename(QuestionnaireSubmission $submission, string $basename): bool
    {
        foreach (self::allSubmissionSections($submission) as $data) {
            if (self::arrayContainsBasename($data, $basename)) {
                return true;
            }
        }

        return false;
    }

    private static function arrayContainsBasename(mixed $data, string $basename): bool
    {
        if (! is_array($data)) {
            return false;
        }

        foreach ($data as $value) {
            if (is_string($value) && (basename($value) === $basename || $value === $basename)) {
                return true;
            }
            if (is_array($value) && self::arrayContainsBasename($value, $basename)) {
                return true;
            }
        }

        return false;
    }

    private static function locateInStorage(string $basename): ?string
    {
        return ClientDocumentStorage::locatePath($basename);
    }

    public static function submissionContainsFilePath(QuestionnaireSubmission $submission, string $filePath): bool
    {
        foreach (self::allSubmissionSections($submission) as $data) {
            if (self::arrayContainsValue($data, $filePath)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Collect intake/questionnaire uploaded files for Document Workshop sources.
     *
     * @return list<array{
     *   path: string,
     *   field_key: string,
     *   label: string,
     *   person: string,
     *   original_filename: string
     * }>
     */
    public static function listUploadedDocuments(QuestionnaireSubmission $submission): array
    {
        $labels = [
            'passportName' => 'Passport',
            'governmentIdName' => 'Government ID (front)',
            'governmentIdBackName' => 'Government ID (back)',
            'drivingLicenseName' => 'Driving licence (front)',
            'drivingLicenseBackName' => 'Driving licence (back)',
            'canadaStudyDocName' => 'Canadian study proof',
            'languageTestDocName' => 'Language test certificate',
            'documentName' => 'Education certificate',
        ];

        $found = [];
        $seen = [];

        $walk = function (mixed $data, string $person, string $fieldKey = '') use (&$walk, &$found, &$seen, $labels): void {
            if (! is_array($data)) {
                return;
            }

            foreach ($data as $key => $value) {
                if (is_string($value) && self::looksLikeClientDocumentPath($value)) {
                    if (isset($seen[$value])) {
                        continue;
                    }
                    $seen[$value] = true;
                    $labelKey = is_string($key) ? $key : $fieldKey;
                    $label = $labels[$labelKey] ?? self::humanizeFieldKey($labelKey);
                    $found[] = [
                        'path' => $value,
                        'field_key' => $labelKey !== '' ? $labelKey : 'document',
                        'label' => $label,
                        'person' => $person,
                        'original_filename' => basename($value),
                    ];
                    continue;
                }

                if (is_array($value)) {
                    if ($key === 'educationQuals') {
                        foreach (array_values($value) as $qual) {
                            $walk($qual, $person, 'documentName');
                        }
                        continue;
                    }
                    $walk($value, $person, is_string($key) ? $key : $fieldKey);
                }
            }
        };

        $walk($submission->main_data, 'Main applicant');
        $walk($submission->step1_data, 'Main applicant');
        $walk($submission->spouse_data, 'Spouse');

        foreach (array_values($submission->children_data ?? []) as $i => $child) {
            $walk($child, 'Child '.($i + 1));
        }
        foreach (array_values($submission->accompanying_data ?? []) as $i => $person) {
            $name = is_array($person) ? trim((string) ($person['fullName'] ?? '')) : '';
            $walk($person, $name !== '' ? $name : ('Family member '.($i + 1)));
        }

        return $found;
    }

    private static function looksLikeClientDocumentPath(string $value): bool
    {
        if (preg_match('#^client-document/\d{4}/\d{2}/#', $value)) {
            return true;
        }

        // Bare filenames sometimes stored before full path rewrite
        $ext = strtolower(pathinfo($value, PATHINFO_EXTENSION));

        return $ext !== ''
            && ! str_contains($value, '/')
            && in_array($ext, ['pdf', 'jpg', 'jpeg', 'png', 'webp'], true)
            && strlen($value) < 260;
    }

    private static function humanizeFieldKey(string $key): string
    {
        $key = preg_replace('/Name$/', '', $key) ?: $key;
        $key = str_replace('_', ' ', $key);

        return ucwords(trim(preg_replace('/([a-z])([A-Z])/', '$1 $2', $key) ?? $key)) ?: 'Document';
    }

    private static function allSubmissionSections(QuestionnaireSubmission $submission): array
    {
        return [
            $submission->step1_data,
            $submission->main_data,
            $submission->spouse_data,
            $submission->children_data,
            $submission->accompanying_data,
        ];
    }

    private static function arrayContainsValue(mixed $data, string $needle): bool
    {
        if (! is_array($data)) {
            return false;
        }

        foreach ($data as $value) {
            if (is_string($value) && $value === $needle) {
                return true;
            }
            if (is_array($value) && self::arrayContainsValue($value, $needle)) {
                return true;
            }
        }

        return false;
    }
}
