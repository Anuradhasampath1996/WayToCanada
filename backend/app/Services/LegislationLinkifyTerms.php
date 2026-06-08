<?php

namespace App\Services;

/** Shared EN/FR terminology for legislation cross-reference linkify. */
final class LegislationLinkifyTerms
{
    /** Numeric provision key (shared across languages). */
    public const REF_KEY = '\d+(?:\.\d+)?(?:\([^)]+\))*';

    /** FR keys may end with a letter paragraph suffix: 10.3(1)a) → 10.3(1)(a) */
    public const FR_REF_KEY = '\d+(?:\.\d+)?(?:\([^)]+\))*(?:[a-z][a-z0-9.]*)?';

    public const SUB_NUM = '[\d.]+';

    public static function isFrench(string $language): bool
    {
        return str_starts_with(strtolower($language), 'fr');
    }

    /** Prefix words before a split anchor (expandPrefixLinks). */
    public static function expandPrefixPattern(): string
    {
        return '(?:subsections?|sections?|paragraphs?|paragraphes?|articles?|alin[ée]as?|'
            .'(?:du|au|de|le|les|des)\s+paragraphe[s]?|'
            ."(?:l'|aux?\s+|les\s+|des\s+)?article[s]?|"
            ."(?:l'|les\s+|des\s+)?alin[ée]a[s]?)";
    }

    /** @return list<string> */
    public static function plainTextGapPatterns(string $language): array
    {
        $patterns = [
            '/\b((?:subsections?|sections?|paragraphs?)\s+\d+(?:\.\d+)?(?:\([^)]+\))*(?:\s+of\s+the\s+Act)?)/iu',
            '/\b(\d+(?:\.\d+)?(?:\([^)]+\))*\s+of\s+the\s+Act)/iu',
            '/\b((?:subsections?|sections?|paragraphs?)\s+\d+(?:\.\d+)?(?:\([^)]+\))*)/iu',
            '/\b(subsections?\s+\([\d.]+\)(?:\s+to\s+\([\d.]+\))?)/iu',
            '/\b(subsections?\s+\([\d.]+\)(?:\s+or\s+\([\d.]+\))+)/iu',
            '/\b(subsections\s+\d+(?:\.\d+)?\([\d.]+\)(?:\s+and\s+\d+(?:\.\d+)?\([\d.]+\))*)/iu',
            '/\b(sections?\s+\d+(?:\.\d+)?\s+to\s+\d+(?:\.\d+)?)/iu',
            '/\b(sections?\s+\d+(?:\.\d+)?\s+or\s+\d+(?:\.\d+)?)/iu',
            '/\b(to\s+\([\d.]+\))/iu',
        ];

        if (self::isFrench($language)) {
            $patterns = array_merge($patterns, [
                '/\b((?:du|au|le|les|des)\s+paragraphe[s]?\s+'.self::FR_REF_KEY.'(?:\s+de\s+la\s+Loi)?)/iu',
                '/\b((?:l\'|aux?\s+|les\s+|des\s+)?article[s]?\s+'.self::FR_REF_KEY.')/iu',
                '/\b((?:l\'|les\s+|des\s+)?alin[ée]a[s]?\s+'.self::FR_REF_KEY.')/iu',
                '/\b(paragraphes?\s+'.self::FR_REF_KEY.')/iu',
                '/\b(paragraphes?\s+\([\d.]+\)(?:\s+à\s+\([\d.]+\))?)/iu',
                '/\b(articles?\s+\d+(?:\.\d+)?\s+à\s+\d+(?:\.\d+)?)/iu',
                '/\b(articles?\s+\d+(?:\.\d+)?\s+ou\s+\d+(?:\.\d+)?)/iu',
                '/\b(articles\s+\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)*(?:\s+et\s+\d+(?:\.\d+)?)?)/iu',
            ]);
        }

        return $patterns;
    }

    public static function normalizeFrenchRefKey(string $target): string
    {
        $target = trim($target);
        $target = rtrim($target, '.,;:');

        if (preg_match('/^(\d+(?:\.\d+)?(?:\([^)]+\))+)([a-z][a-z0-9.]*)$/iu', $target, $m)) {
            return $m[1].'('.$m[2].')';
        }
        if (preg_match('/^(\d+(?:\.\d+)?)([a-z][a-z0-9.]*)$/iu', $target, $m)) {
            return $m[1].'('.$m[2].')';
        }

        return preg_replace('/\s+/', '', $target) ?? $target;
    }
}
