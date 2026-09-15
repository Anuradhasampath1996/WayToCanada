<?php

namespace App\Services\CourseFactory\Pipeline;

final class PipelineDefinition
{
    /**
     * Fresh Course Factory pipeline — not the old evidence-pack flow.
     *
     * @return list<array{key:string,name:string}>
     */
    public static function steps(): array
    {
        return [
            ['key' => 'exam_discovery', 'name' => 'Exam Discovery'],
            ['key' => 'manus_deep_research', 'name' => 'Deep Research'],
            ['key' => 'source_library', 'name' => 'Source Library'],
            ['key' => 'research_verification', 'name' => 'Source Verification'],
            ['key' => 'exam_blueprint', 'name' => 'Exam Blueprint'],
            ['key' => 'course_metadata', 'name' => 'Course Identity'],
            ['key' => 'thumbnail', 'name' => 'Course Thumbnail'],
            ['key' => 'course_architecture', 'name' => 'Course Structure'],
            ['key' => 'lesson_content', 'name' => 'Lesson Generation'],
            ['key' => 'lesson_images', 'name' => 'Supporting Images'],
            ['key' => 'lesson_practice', 'name' => 'Practice Content'],
            ['key' => 'module_quizzes', 'name' => 'Module Assessments'],
            ['key' => 'assignments', 'name' => 'Activities'],
            ['key' => 'question_bank', 'name' => 'Question Bank'],
            ['key' => 'case_bank', 'name' => 'Case Bank'],
            ['key' => 'mock_exam', 'name' => 'Mock Exam'],
            ['key' => 'answer_validation', 'name' => 'Answer Validation'],
            ['key' => 'manus_factual_validation', 'name' => 'Factual Validation'],
            ['key' => 'coverage_audit', 'name' => 'Coverage Audit'],
            ['key' => 'completeness_gate', 'name' => 'Final Assembly'],
            ['key' => 'admin_review', 'name' => 'Admin Review'],
        ];
    }
}
