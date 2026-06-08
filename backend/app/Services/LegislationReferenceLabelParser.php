<?php

namespace App\Services;

use App\Models\LegislationDocument;

class LegislationReferenceLabelParser
{
    private const REF_KEY = '\d+(?:\.\d+)?(?:\([^)]+\))*';

    /** @return array{target_act_code: string, target_provision_key: string}|null */
    public function parse(string $label, LegislationDocument $document): ?array
    {
        $label = trim($label);
        if ($label === '') {
            return null;
        }

        $actCode   = $document->act_code;
        $parentAct = config('legislation_sources.regulation_parent_acts', [])[$actCode] ?? null;
        $frKey     = LegislationLinkifyTerms::FR_REF_KEY;
        $isFr      = LegislationLinkifyTerms::isFrench($document->language);

        if (preg_match('/^(.+?)\s+of\s+the\s+Act\.?$/iu', $label, $m)) {
            $key = $this->normalizeKey($m[1]);

            return $key !== '' ? [
                'target_act_code'      => $parentAct ?? $actCode,
                'target_provision_key' => $key,
            ] : null;
        }

        if (preg_match('/^(.+?)\s+de\s+la\s+Loi\.?$/iu', $label, $m)) {
            $key = $isFr
                ? LegislationLinkifyTerms::normalizeFrenchRefKey($m[1])
                : $this->normalizeKey($m[1]);

            return $key !== '' ? [
                'target_act_code'      => $parentAct ?? $actCode,
                'target_provision_key' => $key,
            ] : null;
        }

        if (preg_match('/^(?:subsections?|sections?|paragraphs?)\s+('.self::REF_KEY.')\b/iu', $label, $m)) {
            $key = $this->normalizeKey($m[1]);

            return $key !== '' ? [
                'target_act_code'      => $actCode,
                'target_provision_key' => $key,
            ] : null;
        }

        if (preg_match('/^(?:(?:du|au|le|les|des)\s+)?paragraphe[s]?\s+('.$frKey.')\b/iu', $label, $m)) {
            $key = LegislationLinkifyTerms::normalizeFrenchRefKey($m[1]);

            return $key !== '' ? [
                'target_act_code'      => $actCode,
                'target_provision_key' => $key,
            ] : null;
        }

        if (preg_match('/^(?:l\'|aux?\s+|les\s+|des\s+)?article[s]?\s+('.$frKey.')\b/iu', $label, $m)) {
            $key = LegislationLinkifyTerms::normalizeFrenchRefKey($m[1]);

            return $key !== '' ? [
                'target_act_code'      => $actCode,
                'target_provision_key' => $key,
            ] : null;
        }

        if (preg_match('/^(?:l\'|les\s+|des\s+)?alinéa[s]?\s+('.$frKey.')\b/iu', $label, $m)) {
            $key = LegislationLinkifyTerms::normalizeFrenchRefKey($m[1]);

            return $key !== '' ? [
                'target_act_code'      => $actCode,
                'target_provision_key' => $key,
            ] : null;
        }

        if (preg_match('/^('.self::REF_KEY.')\s+of\s+the\s+Act\.?$/iu', $label, $m)) {
            $key = $this->normalizeKey($m[1]);

            return $key !== '' ? [
                'target_act_code'      => $parentAct ?? $actCode,
                'target_provision_key' => $key,
            ] : null;
        }

        if (preg_match('/^('.$frKey.')$/u', $label, $m)) {
            $key = $isFr
                ? LegislationLinkifyTerms::normalizeFrenchRefKey($m[1])
                : $this->normalizeKey($m[1]);

            return $key !== '' ? [
                'target_act_code'      => $actCode,
                'target_provision_key' => $key,
            ] : null;
        }

        if (preg_match('/^('.self::REF_KEY.')$/u', $label, $m)) {
            $key = $this->normalizeKey($m[1]);

            return $key !== '' ? [
                'target_act_code'      => $actCode,
                'target_provision_key' => $key,
            ] : null;
        }

        return null;
    }

    private function normalizeKey(string $key): string
    {
        $key = trim($key);
        $key = rtrim($key, '.,;:');

        return preg_replace('/\s+/', '', $key) ?? $key;
    }
}
