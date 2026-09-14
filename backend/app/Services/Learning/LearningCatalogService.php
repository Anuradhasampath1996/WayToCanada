<?php

namespace App\Services\Learning;

use App\Models\Academy\AcademyCourse;
use App\Models\Academy\AcademyExam;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\Lms\LmsExam;
use App\Models\User;
use App\Services\Academy\AcademyAccess;
use App\Support\Learning\LearningCatalogCard;

class LearningCatalogService
{
    public function __construct(private AcademyAccess $access) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function academyCatalog(User $user, string $locale, array $filters = []): array
    {
        $query = AcademyCourse::query()
            ->with(['translations', 'track'])
            ->where('status', 'published')
            ->whereNotNull('current_published_version_id');

        if (! empty($filters['q'])) {
            $q = (string) $filters['q'];
            $query->where(function ($inner) use ($q) {
                $inner->where('title', 'ilike', '%'.$q.'%')
                    ->orWhere('subtitle', 'ilike', '%'.$q.'%')
                    ->orWhere('description', 'ilike', '%'.$q.'%');
            });
        }
        if (! empty($filters['exam_id'])) {
            $query->where('exam_id', (int) $filters['exam_id']);
        }
        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }
        if (! empty($filters['language'])) {
            $query->where('content_language', $filters['language']);
        }
        if (($filters['price'] ?? '') === 'free') {
            $query->where(function ($inner) {
                $inner->where('access_tier', 'free')->orWhere('price_cents', 0);
            });
        } elseif (($filters['price'] ?? '') === 'paid') {
            $query->where('access_tier', 'purchase')->where('price_cents', '>', 0);
        }

        $cards = $query->orderBy('title')->get()->map(function (AcademyCourse $course) use ($user, $locale) {
            $state = $this->academyEntitlement($user, $course);
            if (($filters['status'] ?? '') && $state['status'] !== $filters['status']) {
                return null;
            }
            $exam = $course->exam_id ? AcademyExam::query()->with('translations')->find($course->exam_id) : null;

            return LearningCatalogCard::fromDomain(
                'rcic_academy',
                $this->academyCourseArray($course),
                $exam ? $this->examArray($exam) : null,
                $locale,
                $state
            );
        })->filter()->values();

        return $cards->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function lmsCatalog(User $user, string $locale, array $filters = []): array
    {
        $query = LmsCourse::query()
            ->with('category')
            ->where('is_published', true)
            ->whereIn('access_mode', ['self_purchase', 'assigned_or_purchase', 'free']);

        if (! empty($filters['q'])) {
            $q = (string) $filters['q'];
            $query->where(function ($inner) use ($q) {
                $inner->where('title', 'ilike', '%'.$q.'%')
                    ->orWhere('subtitle', 'ilike', '%'.$q.'%')
                    ->orWhere('description', 'ilike', '%'.$q.'%');
            });
        }
        if (! empty($filters['exam_id'])) {
            $query->where('exam_id', (int) $filters['exam_id']);
        }
        if (! empty($filters['category'])) {
            $query->whereHas('category', function ($inner) use ($filters) {
                $inner->where('slug', $filters['category'])->orWhere('name', $filters['category']);
            });
        }
        if (! empty($filters['language'])) {
            $query->where('content_language', $filters['language']);
        }
        if (($filters['price'] ?? '') === 'free') {
            $query->where(function ($inner) {
                $inner->where('access_mode', 'free')->orWhere('price_cents', 0);
            });
        } elseif (($filters['price'] ?? '') === 'paid') {
            $query->where('price_cents', '>', 0);
        }

        $cards = $query->orderBy('sort_order')->orderBy('title')->get()
            ->filter(function (LmsCourse $course) {
                if (! $course->exam_id) {
                    return true;
                }
                $exam = LmsExam::query()->find($course->exam_id);
                if (! $exam) {
                    return true;
                }

                return $exam->generation_profile !== 'rcic_exam_prep'
                    && $exam->audience !== 'rcic'
                    && $exam->product_domain !== 'rcic_academy';
            })
            ->map(function (LmsCourse $course) use ($user, $locale, $filters) {
                $state = $this->lmsEntitlement($user, $course);
                if (($filters['status'] ?? '') && $state['status'] !== $filters['status']) {
                    return null;
                }
                $exam = $course->exam_id ? LmsExam::query()->find($course->exam_id) : null;

                return LearningCatalogCard::fromDomain(
                    'client_lms',
                    $this->lmsCourseArray($course),
                    $exam ? [
                        'id' => $exam->id,
                        'name' => $exam->name,
                        'translations' => [],
                    ] : null,
                    $locale,
                    $state
                );
            })->filter()->values();

        return $cards->all();
    }

    /** @return array<string, mixed> */
    public function academyEntitlement(User $user, AcademyCourse $course): array
    {
        $grant = $this->access->courseGrant($user, $course);
        if ($course->access_tier === 'free') {
            return ['status' => 'active', 'cta' => 'start', 'cta_label' => LearningCatalogCard::ctaLabel('start', $user->locale ?? 'en'), 'entitled_until' => null];
        }
        if ($grant && $grant->isCurrentlyActive()) {
            return [
                'status' => 'active',
                'cta' => 'continue',
                'cta_label' => LearningCatalogCard::ctaLabel('continue', $user->locale ?? 'en'),
                'entitled_until' => $grant->ends_at?->toIso8601String(),
            ];
        }
        if ($grant && $grant->ends_at && $grant->ends_at->isPast()) {
            return [
                'status' => 'expired',
                'cta' => 'renew',
                'cta_label' => LearningCatalogCard::ctaLabel('renew', $user->locale ?? 'en'),
                'entitled_until' => $grant->ends_at->toIso8601String(),
            ];
        }
        if ($course->access_tier === 'purchase') {
            return ['status' => 'not_purchased', 'cta' => 'buy_now', 'cta_label' => LearningCatalogCard::ctaLabel('buy_now', $user->locale ?? 'en'), 'entitled_until' => null];
        }
        if ($this->access->hasEligibleSubscription($user) || $this->access->hasActiveGrant($user, $course)) {
            return ['status' => 'active', 'cta' => 'continue', 'cta_label' => LearningCatalogCard::ctaLabel('continue', $user->locale ?? 'en'), 'entitled_until' => null];
        }

        return ['status' => 'not_purchased', 'cta' => 'view', 'cta_label' => LearningCatalogCard::ctaLabel('view', $user->locale ?? 'en'), 'entitled_until' => null];
    }

    /** @return array<string, mixed> */
    public function lmsEntitlement(User $user, LmsCourse $course): array
    {
        $assignment = LmsCourseAssignment::query()
            ->where('client_user_id', $user->id)
            ->where('course_id', $course->id)
            ->latest('assigned_at')
            ->first();

        $locale = $user->locale ?? 'en';
        if ($course->access_mode === 'free' && ! $assignment) {
            return ['status' => 'not_purchased', 'cta' => 'start', 'cta_label' => LearningCatalogCard::ctaLabel('start', $locale), 'entitled_until' => null];
        }
        if ($assignment && $assignment->ends_at && $assignment->ends_at->isPast()) {
            return [
                'status' => 'expired',
                'cta' => 'renew',
                'cta_label' => LearningCatalogCard::ctaLabel('renew', $locale),
                'entitled_until' => $assignment->ends_at->toIso8601String(),
            ];
        }
        if ($assignment) {
            return [
                'status' => 'active',
                'cta' => 'continue',
                'cta_label' => LearningCatalogCard::ctaLabel('continue', $locale),
                'entitled_until' => $assignment->ends_at?->toIso8601String(),
                'assignment_id' => $assignment->id,
            ];
        }
        if ($course->access_mode === 'free') {
            return ['status' => 'not_purchased', 'cta' => 'start', 'cta_label' => LearningCatalogCard::ctaLabel('start', $locale), 'entitled_until' => null];
        }

        return ['status' => 'not_purchased', 'cta' => 'buy_now', 'cta_label' => LearningCatalogCard::ctaLabel('buy_now', $locale), 'entitled_until' => null];
    }

    /** @return array<string, mixed> */
    private function academyCourseArray(AcademyCourse $course): array
    {
        $translations = $course->relationLoaded('translations')
            ? $course->translations->keyBy('locale')->map(fn ($row) => [
                'title' => $row->title,
                'subtitle' => $row->subtitle,
                'description' => $row->description,
            ])->all()
            : [];

        return array_merge($course->toArray(), [
            'translations' => $translations,
            'category_name' => $course->category,
        ]);
    }

    /** @return array<string, mixed> */
    private function lmsCourseArray(LmsCourse $course): array
    {
        return array_merge($course->toArray(), [
            'translations' => [],
            'category_name' => $course->category?->name,
            'difficulty' => null,
            'estimated_hours' => null,
        ]);
    }

    /** @param  AcademyExam|LmsExam  $exam */
    private function examArray($exam): array
    {
        $translations = method_exists($exam, 'translations') && $exam->relationLoaded('translations')
            ? $exam->translations->keyBy('locale')->map(fn ($row) => [
                'name' => $row->name,
                'description' => $row->description ?? null,
            ])->all()
            : [];

        return [
            'id' => $exam->id,
            'name' => $exam->name,
            'translations' => $translations,
        ];
    }
}
