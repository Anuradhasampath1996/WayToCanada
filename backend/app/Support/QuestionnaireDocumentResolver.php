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
