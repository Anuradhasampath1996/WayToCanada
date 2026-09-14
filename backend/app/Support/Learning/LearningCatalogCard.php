<?php

namespace App\Support\Learning;

class LearningCatalogCard
{
    /**
     * @param  array<string, mixed>  $course
     * @param  array<string, mixed>|null  $exam
     * @param  array<string, mixed>  $entitlement
     * @return array<string, mixed>
     */
    public static function fromDomain(string $productDomain, array $course, ?array $exam, string $locale, array $entitlement = []): array
    {
        $title = self::localized($course, 'title', $locale);
        $subtitle = self::localized($course, 'subtitle', $locale);
        $description = self::localized($course, 'description', $locale);
        $cta = $entitlement['cta'] ?? 'view';

        return [
            'product_domain' => $productDomain,
            'course_id' => $course['id'] ?? null,
            'id' => $course['id'] ?? null,
            'slug' => $course['slug'] ?? null,
            'exam_id' => $course['exam_id'] ?? ($exam['id'] ?? null),
            'target_exam' => $exam ? self::localized($exam, 'name', $locale) : null,
            'title' => $title,
            'subtitle' => $subtitle,
            'description' => $description,
            'thumbnail_url' => $course['thumbnail_url'] ?? null,
            'content_language' => $course['content_language'] ?? 'en',
            'difficulty' => $course['difficulty'] ?? null,
            'estimated_hours' => $course['estimated_hours'] ?? null,
            'category' => $course['category_name'] ?? ($course['category'] ?? null),
            'price_cents' => ($course['commerce_confirmed'] ?? false) ? ($course['price_cents'] ?? null) : null,
            'currency' => $course['currency'] ?? 'CAD',
            'access_months' => $course['access_months'] ?? config('learning.default_access_months', 3),
            'access_tier' => $course['access_tier'] ?? null,
            'access_mode' => $course['access_mode'] ?? null,
            'status' => $entitlement['status'] ?? 'not_purchased',
            'status_cta' => $cta,
            'cta_label' => $entitlement['cta_label'] ?? self::ctaLabel($cta, $locale),
            'entitled_until' => $entitlement['entitled_until'] ?? null,
            'assignment_id' => $entitlement['assignment_id'] ?? null,
            'is_preview' => (bool) ($course['is_preview'] ?? false),
            'ratings' => null,
        ];
    }

    public static function ctaLabel(string $cta, string $locale = 'en'): string
    {
        $en = [
            'buy_now' => 'Buy Now',
            'continue' => 'Continue Learning',
            'renew' => 'Renew Access',
            'start' => 'Start Course',
            'view' => 'View',
        ];
        $fr = [
            'buy_now' => 'Acheter',
            'continue' => 'Continuer l’apprentissage',
            'renew' => 'Renouveler l’accès',
            'start' => 'Commencer le cours',
            'view' => 'Voir',
        ];
        $dict = $locale === 'fr' ? $fr : $en;

        return $dict[$cta] ?? $en['view'];
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private static function localized(array $row, string $field, string $locale): ?string
    {
        $translations = $row['translations'] ?? [];
        if (isset($translations[$locale][$field]) && $translations[$locale][$field] !== '') {
            return $translations[$locale][$field];
        }
        if (isset($translations['en'][$field]) && $translations['en'][$field] !== '') {
            return $translations['en'][$field];
        }

        return $row[$field] ?? null;
    }
}
