<?php

namespace App\Services\Academy;

use App\Models\Academy\AcademyStudyPlan;
use App\Models\Academy\AcademyStudyPlanItem;
use App\Models\Academy\AcademyTopic;
use App\Models\User;

class AcademyPlannerService
{
    public function __construct(private AcademyAccess $access) {}

    public function upsert(User $user, array $data): AcademyStudyPlan
    {
        $this->access->assertAcademySurface($user);
        $examDate = $data['exam_date'] ?? now()->addWeeks(8)->toDateString();
        $weeks = max(1, (int) ceil(now()->startOfDay()->diffInDays($examDate) / 7));
        $topics = AcademyTopic::query()->where('is_active', true)->orderBy('sort_order')->get();
        $generated = [];
        for ($i = 1; $i <= $weeks; $i++) {
            $topic = $topics[($i - 1) % max(1, $topics->count())] ?? null;
            $generated[] = [
                'week' => $i,
                'title' => $topic?->name ?? 'Review',
                'topic_id' => $topic?->id,
            ];
        }

        $plan = AcademyStudyPlan::query()->updateOrCreate(
            ['user_id' => $user->id, 'status' => 'active'],
            [
                'track_id' => $data['track_id'] ?? null,
                'exam_template_id' => $data['exam_template_id'] ?? null,
                'exam_date' => $examDate,
                'weekly_hours' => $data['weekly_hours'] ?? 8,
                'preferred_days_json' => $data['preferred_days'] ?? ['mon', 'wed', 'sat'],
                'generated_weeks_json' => $generated,
            ]
        );

        $plan->items()->delete();
        $minutes = ((int) ($data['weekly_hours'] ?? 8)) * 60;
        foreach ($generated as $row) {
            AcademyStudyPlanItem::query()->create([
                'plan_id' => $plan->id,
                'week_number' => $row['week'],
                'topic_id' => $row['topic_id'],
                'title' => $row['title'],
                'planned_minutes' => $minutes,
                'completed_minutes' => 0,
                'status' => 'planned',
            ]);
        }

        return $plan->fresh('items');
    }
}
