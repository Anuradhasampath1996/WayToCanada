<?php

namespace Database\Seeders;

use App\Models\Lms\LmsCategory;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsCourseAssignment;
use App\Models\Lms\LmsHomework;
use App\Models\Lms\LmsModule;
use App\Models\Lms\LmsQuestionBank;
use App\Models\Lms\LmsQuiz;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class LmsDemoContentSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(LmsCategorySeeder::class);

        $category = LmsCategory::where('slug', 'ielts')->firstOrFail();

        $course = LmsCourse::firstOrCreate(
            ['category_id' => $category->id, 'slug' => 'ielts-demo-mock-prep'],
            [
                'title'        => 'IELTS Academic — Demo Mock Prep',
                'description'  => 'Full demo course with lessons, question bank, mock exam (45 min timer), and a written assignment. Use this to preview the client learning portal.',
                'is_published' => true,
                'sort_order'   => 0,
            ]
        );

        if (! $course->thumbnail_url) {
            $course->update([
                'thumbnail_url' => 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=80',
            ]);
        }

        if ($course->modules()->count() === 0) {
            $this->seedModulesAndLessons($course);
        }

        if ($course->questionBank()->count() === 0) {
            $this->seedQuestionBank($course);
        }

        if ($course->quizzes()->count() === 0) {
            $this->seedExams($course);
        }

        if ($course->homework()->count() === 0) {
            $this->seedHomework($course);
        }

        $assigned = $this->assignToClients($course);

        if ($this->command) {
            $this->command->newLine();
            $this->command->info('✅ LMS demo course seeded: "' . $course->title . '" (ID: ' . $course->id . ')');
            $this->command->info('   Question bank: ' . $course->questionBank()->count() . ' MCQs');
            $this->command->info('   Mock exam: 10 random questions · 45 min · pass 65%');
            $this->command->info('   Assigned to ' . $assigned . ' client user(s)');
            $this->command->newLine();
            $this->command->info('👉 Client preview: http://localhost:3002/user-dashboard/learning');
            $this->command->info('👉 Admin builder:  http://localhost:3001/admindashboard/lms');
            $this->command->info('   (Open course "IELTS Academic — Demo Mock Prep" → Course Builder)');
        }
    }

    private function seedModulesAndLessons(LmsCourse $course): void
    {
        $intro = $course->modules()->create(['title' => 'Module 1 — Introduction to IELTS', 'sort_order' => 0]);
        $intro->lessons()->createMany([
            [
                'title'        => 'Welcome & exam overview',
                'lesson_type'  => 'mixed',
                'video_url'    => 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                'text_content' => '<h3>IELTS Academic format</h3><ul><li><strong>Listening</strong> — 30 min + 10 min transfer</li><li><strong>Reading</strong> — 60 min, 3 passages</li><li><strong>Writing</strong> — 60 min, Task 1 + Task 2</li><li><strong>Speaking</strong> — 11–14 min face-to-face</li></ul><p>Complete each lesson and mark as done to track your progress.</p>',
                'sort_order'   => 0,
            ],
            [
                'title'        => 'Reading strategies',
                'lesson_type'  => 'text',
                'text_content' => '<h3>Skimming &amp; scanning</h3><p>Skim the passage first for main ideas. Scan for keywords from the question. Do not read every word on the first pass.</p><p><strong>Tip:</strong> Underline names, dates, and numbers — they often appear in questions.</p>',
                'sort_order'   => 1,
            ],
        ]);

        $reading = $course->modules()->create(['title' => 'Module 2 — Reading practice', 'sort_order' => 1]);
        $reading->lessons()->create([
            'title'        => 'True / False / Not Given — technique',
            'lesson_type'  => 'text',
            'text_content' => '<p><strong>TRUE</strong> = statement matches the passage.<br><strong>FALSE</strong> = statement contradicts the passage.<br><strong>NOT GIVEN</strong> = no information to confirm or deny.</p>',
            'sort_order'   => 0,
        ]);
    }

    private function seedQuestionBank(LmsCourse $course): void
    {
        $questions = [
            ['topic' => 'Reading', 'difficulty' => 'easy', 'q' => 'What does "skimming" mean in IELTS reading?', 'opts' => ['Reading every word slowly', 'Reading quickly for main ideas', 'Translating to your language', 'Memorizing vocabulary'], 'correct' => 1, 'exp' => 'Skimming means reading quickly to get the gist.'],
            ['topic' => 'Reading', 'difficulty' => 'medium', 'q' => 'In IELTS Reading, how many passages are in the Academic test?', 'opts' => ['2', '3', '4', '5'], 'correct' => 1, 'exp' => 'Academic Reading has 3 long passages.'],
            ['topic' => 'Reading', 'difficulty' => 'medium', 'q' => 'How long is the IELTS Academic Reading section?', 'opts' => ['30 minutes', '45 minutes', '60 minutes', '90 minutes'], 'correct' => 2, 'exp' => 'Reading is 60 minutes with no extra transfer time.'],
            ['topic' => 'Listening', 'difficulty' => 'easy', 'q' => 'How many sections are in the IELTS Listening test?', 'opts' => ['2', '3', '4', '5'], 'correct' => 2, 'exp' => 'Listening has 4 sections, increasing in difficulty.'],
            ['topic' => 'Listening', 'difficulty' => 'medium', 'q' => 'When can you check your Listening answers on paper?', 'opts' => ['During each section only', 'At the end — 10 extra minutes', 'Never', 'Only section 4'], 'correct' => 1, 'exp' => 'Paper-based tests allow 10 minutes to transfer answers.'],
            ['topic' => 'Writing', 'difficulty' => 'medium', 'q' => 'IELTS Academic Writing Task 1 usually requires you to:', 'opts' => ['Write an opinion essay', 'Describe a chart, graph, or diagram', 'Write a letter to a friend', 'Summarize a lecture'], 'correct' => 1, 'exp' => 'Task 1 Academic is data description (150 words min).'],
            ['topic' => 'Writing', 'difficulty' => 'hard', 'q' => 'What is the minimum word count for Writing Task 2?', 'opts' => ['150 words', '200 words', '250 words', '300 words'], 'correct' => 2, 'exp' => 'Task 2 requires at least 250 words.'],
            ['topic' => 'Speaking', 'difficulty' => 'easy', 'q' => 'Speaking Part 1 typically covers:', 'opts' => ['A long monologue', 'Familiar topics about yourself', 'A debate with the examiner', 'Reading aloud'], 'correct' => 1, 'exp' => 'Part 1 is introduction and familiar topics.'],
            ['topic' => 'Speaking', 'difficulty' => 'medium', 'q' => 'In Speaking Part 2, how long do you have to prepare?', 'opts' => ['30 seconds', '1 minute', '2 minutes', '5 minutes'], 'correct' => 1, 'exp' => 'You get 1 minute to prepare with cue card notes.'],
            ['topic' => 'Grammar', 'difficulty' => 'medium', 'q' => 'Choose the correct form: "The number of applicants ___ increased."', 'opts' => ['have', 'has', 'are', 'were'], 'correct' => 1, 'exp' => '"The number of" takes a singular verb: has.'],
            ['topic' => 'Grammar', 'difficulty' => 'hard', 'q' => 'Which sentence uses articles correctly?', 'opts' => ['She is university student', 'She is an university student', 'She is a university student', 'She is the university student always'], 'correct' => 2, 'exp' => 'Use "a" before consonant sounds: a university.'],
            ['topic' => 'Vocabulary', 'difficulty' => 'medium', 'q' => 'What is a synonym for "significant" in academic writing?', 'opts' => ['Tiny', 'Notable', 'Random', 'Boring'], 'correct' => 1, 'exp' => 'Notable/substantial are academic synonyms.'],
            ['topic' => 'Vocabulary', 'difficulty' => 'easy', 'q' => '"Furthermore" is used to:', 'opts' => ['Contrast ideas', 'Add similar information', 'Give an example', 'Conclude an essay'], 'correct' => 1, 'exp' => 'Furthermore adds supporting points.'],
            ['topic' => 'Reading', 'difficulty' => 'hard', 'q' => 'NOT GIVEN means:', 'opts' => ['The statement is false', 'The passage does not say', 'The answer is zero', 'The question is optional'], 'correct' => 1, 'exp' => 'Not Given = insufficient information in the text.'],
            ['topic' => 'General', 'difficulty' => 'easy', 'q' => 'IELTS band scores range from:', 'opts' => ['0 to 10', '1 to 9', '1 to 10', '0 to 12'], 'correct' => 1, 'exp' => 'IELTS bands run from 1 (non-user) to 9 (expert).'],
        ];

        foreach ($questions as $i => $item) {
            $bq = $course->questionBank()->create([
                'question_text' => $item['q'],
                'topic'         => $item['topic'],
                'difficulty'    => $item['difficulty'],
                'explanation'   => $item['exp'],
                'sort_order'    => $i,
            ]);

            foreach ($item['opts'] as $oi => $text) {
                $bq->options()->create([
                    'option_text' => $text,
                    'is_correct'  => $oi === $item['correct'],
                    'sort_order'  => $oi,
                ]);
            }
        }
    }

    private function seedExams(LmsCourse $course): void
    {
        $inlineQuiz = $course->quizzes()->create([
            'title'                 => 'IELTS Reading Mini Quiz (inline)',
            'content_type'          => 'quiz',
            'source_mode'           => 'inline',
            'passing_score'         => 70,
            'time_limit_minutes'    => 15,
            'description'           => 'Quick 2-question warm-up before the full mock exam.',
            'sort_order'            => 0,
        ]);

        $q1 = $inlineQuiz->questions()->create([
            'question_text' => 'How many passages are in IELTS Academic Reading?',
            'sort_order'    => 0,
        ]);
        $q1->options()->createMany([
            ['option_text' => 'Two', 'is_correct' => false, 'sort_order' => 0],
            ['option_text' => 'Three', 'is_correct' => true, 'sort_order' => 1],
            ['option_text' => 'Four', 'is_correct' => false, 'sort_order' => 2],
        ]);

        $q2 = $inlineQuiz->questions()->create([
            'question_text' => 'Skimming helps you find:',
            'sort_order'    => 1,
        ]);
        $q2->options()->createMany([
            ['option_text' => 'Every detail', 'is_correct' => false, 'sort_order' => 0],
            ['option_text' => 'Main ideas quickly', 'is_correct' => true, 'sort_order' => 1],
            ['option_text' => 'Grammar mistakes', 'is_correct' => false, 'sort_order' => 2],
        ]);

        $course->quizzes()->create([
            'title'                 => 'IELTS Academic Mock Exam — Demo',
            'content_type'          => 'mock_exam',
            'source_mode'           => 'bank_random',
            'random_question_count' => 10,
            'time_limit_minutes'    => 45,
            'passing_score'         => 65,
            'description'           => 'Full mock test: 10 random MCQs from the question bank. You have 45 minutes. Timer starts when you begin. Review your answers after submit.',
            'sort_order'            => 1,
        ]);
    }

    private function seedHomework(LmsCourse $course): void
    {
        $module = $course->modules()->first();

        $course->homework()->create([
            'module_id'    => $module?->id,
            'title'        => 'Writing Task 2 — Practice assignment',
            'instructions' => '<p>Write at least <strong>250 words</strong> on:</p><blockquote>Some people believe that immigration benefits a country\'s economy. Others think it creates challenges. Discuss both views and give your opinion.</blockquote><p>Submit your essay text below. Your consultant will review it.</p>',
            'max_score'    => 100,
            'sort_order'   => 0,
        ]);
    }

    private function assignToClients(LmsCourse $course): int
    {
        $consultant = User::role('rcic')->first() ?? User::role('super-admin')->first();
        $clients    = User::role('client')->get();
        $count      = 0;

        foreach ($clients as $client) {
            LmsCourseAssignment::firstOrCreate(
                ['course_id' => $course->id, 'client_user_id' => $client->id],
                [
                    'assigned_by_user_id' => $consultant?->id ?? $client->id,
                    'status'              => 'assigned',
                    'progress_percent'    => 0,
                ]
            );
            $count++;
        }

        return $count;
    }
}
