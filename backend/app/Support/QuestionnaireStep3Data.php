<?php

namespace App\Support;

use App\Models\QuestionnaireSubmission;

/**
 * Authoritative reader for Step 3 assessment/eligibility questionnaire data.
 *
 * Storage location (canonical): questionnaire_submissions.step3_data
 * Legacy fallback (read-only): accompanying_data.step3, step1_data (partial overlap)
 */
class QuestionnaireStep3Data
{
    /** @return array<string, mixed> */
    public static function resolve(QuestionnaireSubmission $submission): array
    {
        $canonical = $submission->step3_data;
        if (is_array($canonical) && $canonical !== []) {
            return $canonical;
        }

        $legacy = self::legacyFromSubmission($submission);
        if ($legacy !== []) {
            return $legacy;
        }

        return [];
    }

    /** @return array<string, mixed> */
    public static function legacyFromSubmission(QuestionnaireSubmission $submission): array
    {
        $legacy = [];

        $accompanying = $submission->accompanying_data;
        if (is_array($accompanying) && isset($accompanying['step3']) && is_array($accompanying['step3'])) {
            $legacy = array_merge($legacy, $accompanying['step3']);
        }

        $step1 = $submission->step1_data;
        if (is_array($step1)) {
            foreach (['hasVisaRefusal', 'hasCriminalRecord', 'hasMedicalCondition'] as $key) {
                if (array_key_exists($key, $step1) && ! array_key_exists($key, $legacy)) {
                    $legacy[$key] = $step1[$key];
                }
            }
        }

        return $legacy;
    }

    /**
     * Normalize payload for persistence without rewriting legacy nested data.
     *
     * @param  array<string, mixed>|null  $incoming
     * @return array<string, mixed>|null
     */
    public static function normalizeForStorage(?array $incoming): ?array
    {
        if ($incoming === null) {
            return null;
        }

        return $incoming === [] ? null : $incoming;
    }
}
