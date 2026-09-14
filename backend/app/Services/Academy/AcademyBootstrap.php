<?php

namespace App\Services\Academy;

use App\Models\Academy\AcademyCompetency;
use App\Models\Academy\AcademyExamTemplate;
use App\Models\Academy\AcademyLearningTrack;
use App\Models\Academy\AcademyTopic;
use Illuminate\Support\Facades\DB;

class AcademyBootstrap
{
    public function ensure(): void
    {
        DB::connection('academy')->transaction(function () {
            $this->tracks();
            $irb = AcademyLearningTrack::query()->where('key', 'irb_specialization')->firstOrFail();
            $this->topics($irb->id);
            $this->competencies();
            $this->irbExamTemplate($irb->id);
            $this->irbExamMaster();
        });
    }

    private function tracks(): void
    {
        $rows = [
            ['key' => 'irb_specialization', 'name' => 'RCIC-IRB Specialization Exam Preparation', 'description' => 'Independent RCIC exam preparation for IRB specialization.', 'sort_order' => 1, 'is_active' => true],
            ['key' => 'entry_to_practice', 'name' => 'RCIC Entry-to-Practice Exam Preparation', 'description' => 'Reserved for later Entry-to-Practice content.', 'sort_order' => 2, 'is_active' => false],
            ['key' => 'cpd', 'name' => 'Continuing Professional Development', 'description' => 'Reserved for later CPD courses.', 'sort_order' => 3, 'is_active' => false],
            ['key' => 'professional_practice', 'name' => 'Professional Practice', 'description' => 'Reserved for later professional practice courses.', 'sort_order' => 4, 'is_active' => false],
            ['key' => 'mentoring', 'name' => 'Mentoring Preparation', 'description' => 'Reserved for later mentoring support.', 'sort_order' => 5, 'is_active' => false],
            ['key' => 'legislation_update', 'name' => 'Legislation Updates', 'description' => 'Reserved for later legislation update courses.', 'sort_order' => 6, 'is_active' => false],
        ];

        foreach ($rows as $row) {
            AcademyLearningTrack::query()->updateOrCreate(['key' => $row['key']], $row);
        }
    }

    private function topics(int $irbTrackId): void
    {
        $topics = [
            ['key' => 'irb_foundations', 'name' => 'IRB Foundations', 'division' => 'irb', 'sort_order' => 1],
            ['key' => 'id', 'name' => 'Immigration Division (ID)', 'division' => 'id', 'sort_order' => 2],
            ['key' => 'iad', 'name' => 'Immigration Appeal Division (IAD)', 'division' => 'iad', 'sort_order' => 3],
            ['key' => 'rpd', 'name' => 'Refugee Protection Division (RPD)', 'division' => 'rpd', 'sort_order' => 4],
            ['key' => 'rad', 'name' => 'Refugee Appeal Division (RAD)', 'division' => 'rad', 'sort_order' => 5],
            ['key' => 'ethics', 'name' => 'Ethics', 'division' => 'ethics', 'sort_order' => 6],
            ['key' => 'professional_responsibility', 'name' => 'Professional Responsibility', 'division' => 'ethics', 'sort_order' => 7],
            ['key' => 'irpa', 'name' => 'IRPA', 'division' => 'other', 'sort_order' => 8],
            ['key' => 'irpr', 'name' => 'IRPR', 'division' => 'other', 'sort_order' => 9],
            ['key' => 'evidence', 'name' => 'Evidence', 'division' => 'other', 'sort_order' => 10],
            ['key' => 'administrative_law', 'name' => 'Administrative Law', 'division' => 'other', 'sort_order' => 11],
            ['key' => 'procedural_fairness', 'name' => 'Procedural Fairness', 'division' => 'other', 'sort_order' => 12],
            ['key' => 'hearing_preparation', 'name' => 'Hearing Preparation', 'division' => 'other', 'sort_order' => 13],
            ['key' => 'legal_research', 'name' => 'Legal Research', 'division' => 'other', 'sort_order' => 14],
            ['key' => 'written_submissions', 'name' => 'Written Submissions', 'division' => 'other', 'sort_order' => 15],
        ];

        foreach ($topics as $topic) {
            AcademyTopic::query()->updateOrCreate(
                ['key' => $topic['key']],
                [
                    'track_id' => $irbTrackId,
                    'name' => $topic['name'],
                    'division' => $topic['division'],
                    'sort_order' => $topic['sort_order'],
                    'is_active' => true,
                ]
            );
        }
    }

    private function competencies(): void
    {
        $rows = [
            ['key' => 'canadian_legal_framework', 'name' => 'Canadian legal framework', 'sort_order' => 1],
            ['key' => 'immigration_legislation', 'name' => 'Immigration legislation', 'sort_order' => 2],
            ['key' => 'legal_research', 'name' => 'Legal research', 'sort_order' => 3],
            ['key' => 'issue_identification', 'name' => 'Issue identification', 'sort_order' => 4],
            ['key' => 'evidence_analysis', 'name' => 'Evidence analysis', 'sort_order' => 5],
            ['key' => 'tribunal_process', 'name' => 'Tribunal process', 'sort_order' => 6],
            ['key' => 'hearing_preparation', 'name' => 'Hearing preparation', 'sort_order' => 7],
            ['key' => 'written_advocacy', 'name' => 'Written advocacy', 'sort_order' => 8],
            ['key' => 'oral_advocacy', 'name' => 'Oral advocacy', 'sort_order' => 9],
            ['key' => 'professional_judgment', 'name' => 'Professional judgment', 'sort_order' => 10],
            ['key' => 'ethics', 'name' => 'Ethics', 'sort_order' => 11],
            ['key' => 'client_communication', 'name' => 'Client communication', 'sort_order' => 12],
        ];

        foreach ($rows as $row) {
            AcademyCompetency::query()->updateOrCreate(
                ['key' => $row['key']],
                [
                    'name' => $row['name'],
                    'description' => $row['name'],
                    'sort_order' => $row['sort_order'],
                    'is_active' => true,
                ]
            );
        }
    }

    private function irbExamTemplate(int $irbTrackId): void
    {
        AcademyExamTemplate::query()->updateOrCreate(
            ['slug' => 'irb-specialization-readiness-mock'],
            [
                'track_id' => $irbTrackId,
                'name' => 'Independent IRB Specialization Readiness Mock',
                'description' => 'Seeded readiness mock equivalent to a 190-question / 4-hour IRB-style structure. This is not an official CICC exam and the score is not an official pass prediction.',
                'total_questions' => 190,
                'duration_minutes' => 240,
                'independent_count' => 95,
                'case_based_count' => 95,
                'topic_mix_json' => [],
                'difficulty_mix_json' => [],
                'randomize_questions' => true,
                'randomize_options' => true,
                'allow_navigation' => true,
                'allow_review' => true,
                'pass_threshold_percent' => 70,
                'readiness_threshold_percent' => 70,
                'max_attempts' => null,
                'status' => 'published',
                'version_number' => 1,
            ]
        );
    }

    private function irbExamMaster(): void
    {
        if (! \Illuminate\Support\Facades\Schema::connection('academy')->hasTable('academy_exams')) {
            return;
        }

        \App\Models\Academy\AcademyExam::query()->updateOrCreate(
            ['key' => 'rcic_irb_specialization'],
            [
                'product_domain' => 'rcic_academy',
                'audience' => 'rcic',
                'slug' => 'rcic-irb-specialization',
                'generation_profile' => 'rcic_exam_prep',
                'name' => 'RCIC-IRB Specialization Exam',
                'description' => 'Independent preparation target. Not an official CICC exam.',
                'exam_authority' => 'CICC',
                'official_exam_url' => 'https://college-ic.ca',
                'content_language' => 'en',
                'status' => 'active',
                'exam_format_json' => [
                    'total_questions' => 190,
                    'duration_minutes' => 240,
                    'independent_mcq_count' => 95,
                    'case_based_mcq_count' => 95,
                ],
                'next_review_at' => now()->addDays((int) config('learning.verification_intervals_days.rcic_exam_prep', 90)),
                'verification_interval_days' => (int) config('learning.verification_intervals_days.rcic_exam_prep', 90),
            ]
        );
    }
}
