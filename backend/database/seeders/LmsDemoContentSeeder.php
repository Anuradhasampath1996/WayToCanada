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

class LmsDemoContentSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(LmsCategorySeeder::class);

        $courses = [];
        foreach ($this->courseBlueprints() as $blueprint) {
            $courses[] = $this->seedCourse($blueprint);
        }

        $assigned = 0;
        foreach ($courses as $course) {
            $assigned += $this->assignToClients($course);
        }

        if ($this->command) {
            $this->command->newLine();
            $this->command->info('✅ LMS test content seeded — ' . count($courses) . ' published course(s)');
            foreach ($courses as $course) {
                $course->loadCount(['modules', 'questionBank', 'quizzes', 'homework']);
                $this->command->info(sprintf(
                    '   • %s — %d modules, %d bank Qs, %d quizzes, %d homework',
                    $course->title,
                    $course->modules_count,
                    $course->question_bank_count,
                    $course->quizzes_count,
                    $course->homework_count,
                ));
            }
            $this->command->info('   Assigned to ' . $assigned . ' client assignment(s) total');
            $this->command->newLine();
            $this->command->info('👉 Admin LMS:  http://localhost:3001/admindashboard/lms');
            $this->command->info('👉 Client LMS: http://localhost:3002/user-dashboard/learning');
            $this->command->info('👉 Consultant: assign courses at /workspace/lms');
        }
    }

    /** @return list<array<string, mixed>> */
    private function courseBlueprints(): array
    {
        return [
            [
                'category'    => 'ielts',
                'slug'        => 'ielts-academic-complete-prep',
                'title'       => 'IELTS Academic — Complete Prep',
                'description' => 'Full IELTS Academic preparation: listening, reading, writing, and speaking modules with practice quizzes, mock exam, and writing homework.',
                'thumbnail'   => 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=80',
                'sort_order'  => 0,
                'modules'     => [
                    [
                        'title' => 'Module 1 — Exam overview & strategy',
                        'lessons' => [
                            [
                                'title' => 'Welcome & band score targets',
                                'lesson_type' => 'mixed',
                                'video_url' => 'https://www.youtube.com/embed/9k0c9HxH1Mc',
                                'text_content' => '<h3>IELTS Academic at a glance</h3><ul><li><strong>Listening</strong> — 30 min + 10 min transfer (paper)</li><li><strong>Reading</strong> — 60 min, 3 passages</li><li><strong>Writing</strong> — Task 1 (150 words) + Task 2 (250 words)</li><li><strong>Speaking</strong> — 11–14 min, 3 parts</li></ul><p>Express Entry typically needs CLB 7+ (IELTS 6.0 each skill). Aim higher for competitive CRS scores.</p>',
                            ],
                            [
                                'title' => 'How CRS uses language scores',
                                'lesson_type' => 'text',
                                'text_content' => '<p>Language points in Express Entry depend on your <strong>CLB level</strong> per skill. First official language scores can add up to 136 CRS points (with spouse) or 128 (single applicant).</p><p>Retake planning: focus on your weakest skill first — often Writing or Speaking.</p>',
                            ],
                        ],
                    ],
                    [
                        'title' => 'Module 2 — Reading & Listening',
                        'lessons' => [
                            [
                                'title' => 'Reading: skimming, scanning & T/F/NG',
                                'lesson_type' => 'text',
                                'text_content' => '<p><strong>TRUE</strong> = agrees with passage.<br><strong>FALSE</strong> = contradicts passage.<br><strong>NOT GIVEN</strong> = not mentioned.</p><p>Skim for structure first; scan for names, dates, and numbers when answering.</p>',
                            ],
                            [
                                'title' => 'Listening: section types & note-taking',
                                'lesson_type' => 'text',
                                'text_content' => '<p>Sections 1–2 are social/everyday; 3–4 are academic. Watch for <em>spelling</em> in gap-fill answers. Practice predicting answer type (number, name, place) before audio plays.</p>',
                            ],
                        ],
                    ],
                    [
                        'title' => 'Module 3 — Writing & Speaking',
                        'lessons' => [
                            [
                                'title' => 'Writing Task 1 — charts & processes',
                                'lesson_type' => 'text',
                                'text_content' => '<p>Overview paragraph first (main trend). No opinion in Task 1. Use precise data language: rose sharply, remained stable, accounted for the largest share.</p>',
                            ],
                            [
                                'title' => 'Speaking Part 2 — cue card structure',
                                'lesson_type' => 'text',
                                'text_content' => '<p>Use 1 minute prep to jot keywords. Speak for 2 minutes: introduction → details → brief conclusion. Extend answers with examples and feelings.</p>',
                            ],
                        ],
                    ],
                ],
                'bank' => [
                    ['topic' => 'Reading', 'difficulty' => 'easy', 'q' => 'How many passages are in IELTS Academic Reading?', 'opts' => ['2', '3', '4', '5'], 'correct' => 1, 'exp' => 'Academic Reading has 3 long passages.'],
                    ['topic' => 'Reading', 'difficulty' => 'medium', 'q' => 'How long is the IELTS Academic Reading section?', 'opts' => ['30 min', '45 min', '60 min', '90 min'], 'correct' => 2, 'exp' => 'Reading is 60 minutes.'],
                    ['topic' => 'Listening', 'difficulty' => 'easy', 'q' => 'How many sections are in IELTS Listening?', 'opts' => ['2', '3', '4', '5'], 'correct' => 2, 'exp' => 'Four sections, increasing in difficulty.'],
                    ['topic' => 'Writing', 'difficulty' => 'medium', 'q' => 'Minimum words for Writing Task 2?', 'opts' => ['150', '200', '250', '300'], 'correct' => 2, 'exp' => 'Task 2 requires at least 250 words.'],
                    ['topic' => 'Speaking', 'difficulty' => 'easy', 'q' => 'Speaking Part 1 covers:', 'opts' => ['A long monologue', 'Familiar topics', 'A debate', 'Reading aloud'], 'correct' => 1, 'exp' => 'Part 1 is introduction and familiar topics.'],
                    ['topic' => 'Grammar', 'difficulty' => 'medium', 'q' => '"The number of applicants ___ increased."', 'opts' => ['have', 'has', 'are', 'were'], 'correct' => 1, 'exp' => '"The number of" takes singular verb.'],
                    ['topic' => 'Vocabulary', 'difficulty' => 'easy', 'q' => '"Furthermore" is used to:', 'opts' => ['Contrast', 'Add information', 'Give example', 'Conclude'], 'correct' => 1, 'exp' => 'Furthermore adds similar points.'],
                    ['topic' => 'General', 'difficulty' => 'easy', 'q' => 'IELTS band scores range from:', 'opts' => ['0–10', '1–9', '1–10', '0–12'], 'correct' => 1, 'exp' => 'Bands run from 1 to 9.'],
                    ['topic' => 'Reading', 'difficulty' => 'hard', 'q' => 'NOT GIVEN means:', 'opts' => ['Statement is false', 'No information in text', 'Answer is zero', 'Optional question'], 'correct' => 1, 'exp' => 'Not Given = insufficient information.'],
                    ['topic' => 'Listening', 'difficulty' => 'medium', 'q' => 'Paper-based Listening transfer time:', 'opts' => ['5 min', '10 min', '15 min', 'None'], 'correct' => 1, 'exp' => '10 extra minutes to transfer answers.'],
                ],
                'quizzes' => [
                    ['title' => 'Reading warm-up quiz', 'content_type' => 'quiz', 'source_mode' => 'inline', 'passing_score' => 70, 'time_limit_minutes' => 10, 'inline' => [
                        ['q' => 'Skimming helps you find:', 'opts' => [['Every detail', false], ['Main ideas quickly', true], ['Grammar errors', false]]],
                        ['q' => 'IELTS Reading time limit:', 'opts' => [['30 min', false], ['60 min', true], ['90 min', false]]],
                    ]],
                    ['title' => 'IELTS Academic Mock Exam', 'content_type' => 'mock_exam', 'source_mode' => 'bank_random', 'random_question_count' => 8, 'time_limit_minutes' => 30, 'passing_score' => 65],
                ],
                'homework' => [
                    'title' => 'Writing Task 2 — Immigration essay',
                    'instructions' => '<p>Write at least <strong>250 words</strong>:</p><blockquote>Some people believe immigration benefits a country\'s economy. Others think it creates challenges. Discuss both views and give your opinion.</blockquote>',
                ],
            ],
            [
                'category'    => 'celpip',
                'slug'        => 'celpip-general-ls-prep',
                'title'       => 'CELPIP-General — Listening & Speaking',
                'description' => 'Prepare for CELPIP-General LS used for Canadian citizenship. Canadian English contexts, listening tasks, and speaking response strategies.',
                'thumbnail'   => 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80',
                'sort_order'  => 1,
                'modules'     => [
                    [
                        'title' => 'Module 1 — CELPIP format',
                        'lessons' => [
                            [
                                'title' => 'What is CELPIP-General LS?',
                                'lesson_type' => 'text',
                                'text_content' => '<p>CELPIP-General <strong>LS</strong> tests <strong>Listening</strong> and <strong>Speaking</strong> only — common for Canadian citizenship applications.</p><p>Scores are CLB levels 4–12. All content uses Canadian English accents and scenarios.</p>',
                            ],
                            [
                                'title' => 'Canadian English vs other varieties',
                                'lesson_type' => 'text',
                                'text_content' => '<p>Note spelling: <em>colour, centre, programme</em>. Listen for Canadian place names and everyday situations: transit, banking, community events.</p>',
                            ],
                        ],
                    ],
                    [
                        'title' => 'Module 2 — Speaking tasks',
                        'lessons' => [
                            [
                                'title' => 'Giving advice & describing scenes',
                                'lesson_type' => 'text',
                                'text_content' => '<p>Speaking tasks include: giving advice, talking about personal experience, describing a scene, and expressing opinions. You have preparation time — use it to outline 2–3 points.</p>',
                            ],
                        ],
                    ],
                ],
                'bank' => [
                    ['topic' => 'Format', 'difficulty' => 'easy', 'q' => 'CELPIP-General LS tests which skills?', 'opts' => ['Reading & Writing', 'Listening & Speaking', 'All four skills', 'Writing only'], 'correct' => 1, 'exp' => 'LS = Listening + Speaking.'],
                    ['topic' => 'Format', 'difficulty' => 'easy', 'q' => 'CELPIP scores are reported as:', 'opts' => ['IELTS bands', 'CLB levels', 'TOEFL scores', 'Percentages only'], 'correct' => 1, 'exp' => 'CELPIP maps to Canadian Language Benchmarks.'],
                    ['topic' => 'Listening', 'difficulty' => 'medium', 'q' => 'CELPIP listening uses:', 'opts' => ['British accents only', 'Canadian English contexts', 'French audio', 'No audio'], 'correct' => 1, 'exp' => 'Canadian scenarios and accents.'],
                    ['topic' => 'Citizenship', 'difficulty' => 'easy', 'q' => 'CELPIP-General LS is often used for:', 'opts' => ['Express Entry only', 'Canadian citizenship', 'Study permits only', 'Work permits only'], 'correct' => 1, 'exp' => 'Common for citizenship language proof.'],
                    ['topic' => 'Speaking', 'difficulty' => 'medium', 'q' => 'Before speaking, you should:', 'opts' => ['Memorize a script', 'Use prep time to outline points', 'Skip preparation', 'Read the question aloud only'], 'correct' => 1, 'exp' => 'Outline main ideas in prep time.'],
                ],
                'quizzes' => [
                    ['title' => 'CELPIP format quiz', 'content_type' => 'quiz', 'source_mode' => 'inline', 'passing_score' => 80, 'time_limit_minutes' => 8, 'inline' => [
                        ['q' => 'CELPIP-General LS includes Reading?', 'opts' => [['Yes', false], ['No', true]]],
                    ]],
                    ['title' => 'CELPIP LS Mock Test', 'content_type' => 'mock_exam', 'source_mode' => 'bank_random', 'random_question_count' => 5, 'time_limit_minutes' => 20, 'passing_score' => 70],
                ],
                'homework' => [
                    'title' => 'Speaking practice — record yourself',
                    'instructions' => '<p>Record a 90-second response: <em>"Describe a community event you attended in Canada or your home country. What happened and how did you feel?"</em></p><p>Paste your self-review notes below (main points, vocabulary to improve).</p>',
                ],
            ],
            [
                'category'    => 'pte',
                'slug'        => 'pte-academic-essentials',
                'title'       => 'PTE Academic — Essentials',
                'description' => 'Computer-based PTE Academic overview: speaking & writing, reading, listening, and automated scoring tips for Express Entry applicants.',
                'thumbnail'   => 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80',
                'sort_order'  => 2,
                'modules'     => [
                    [
                        'title' => 'Module 1 — PTE structure',
                        'lessons' => [
                            [
                                'title' => 'Computer-based test overview',
                                'lesson_type' => 'text',
                                'text_content' => '<p>PTE Academic is fully computer-delivered with AI scoring. Single 2-hour session covering Speaking & Writing (54–67 min), Reading (29–30 min), and Listening (30–43 min).</p>',
                            ],
                            [
                                'title' => 'Integrated tasks & time management',
                                'lesson_type' => 'text',
                                'text_content' => '<p>Tasks like <strong>Read Aloud</strong> and <strong>Repeat Sentence</strong> test fluency under time pressure. Practice with a timer — hesitation affects pronunciation scores.</p>',
                            ],
                        ],
                    ],
                ],
                'bank' => [
                    ['topic' => 'Format', 'difficulty' => 'easy', 'q' => 'PTE Academic is scored by:', 'opts' => ['Human examiners only', 'Automated AI scoring', 'Mail-in evaluation', 'Interview only'], 'correct' => 1, 'exp' => 'PTE uses automated scoring technology.'],
                    ['topic' => 'Format', 'difficulty' => 'medium', 'q' => 'PTE results typically arrive within:', 'opts' => ['6 weeks', '48 hours to 5 days', 'Same day only', '3 months'], 'correct' => 1, 'exp' => 'Results are usually fast vs IELTS.'],
                    ['topic' => 'Speaking', 'difficulty' => 'medium', 'q' => 'Read Aloud tests:', 'opts' => ['Handwriting', 'Oral fluency & pronunciation', 'Essay planning', 'Multiple choice only'], 'correct' => 1, 'exp' => 'Read Aloud assesses oral skills.'],
                    ['topic' => 'CRS', 'difficulty' => 'easy', 'q' => 'PTE scores can be used for:', 'opts' => ['Express Entry language proof', 'Driver licence only', 'Medical exams only', 'None'], 'correct' => 0, 'exp' => 'IRCC accepts PTE Core for immigration.'],
                ],
                'quizzes' => [
                    ['title' => 'PTE quick check', 'content_type' => 'quiz', 'source_mode' => 'bank_random', 'random_question_count' => 4, 'time_limit_minutes' => 10, 'passing_score' => 75],
                ],
                'homework' => null,
            ],
            [
                'category'    => 'tef',
                'slug'        => 'tef-canada-basics',
                'title'       => 'TEF Canada — French basics for IRCC',
                'description' => 'Introduction to TEF Canada for bilingual CRS points: comprehension écrite/orale, expression écrite/orale, and CLB mapping.',
                'thumbnail'   => 'https://images.unsplash.com/photo-1546410531-bb4ca0506ed2?w=1200&q=80',
                'sort_order'  => 3,
                'modules'     => [
                    [
                        'title' => 'Module 1 — TEF Canada overview',
                        'lessons' => [
                            [
                                'title' => 'Why French for Express Entry?',
                                'lesson_type' => 'text',
                                'text_content' => '<p>Strong French (NCLC 7+) can add significant CRS points as a <strong>second official language</strong>. TEF Canada is one of IRCC-approved tests.</p>',
                            ],
                            [
                                'title' => 'Test sections explained',
                                'lesson_type' => 'text',
                                'text_content' => '<ul><li>Compréhension écrite (Reading)</li><li>Compréhension orale (Listening)</li><li>Expression écrite (Writing)</li><li>Expression orale (Speaking)</li></ul><p>Prepare each skill separately; weak oral expression is common for English-first applicants.</p>',
                            ],
                        ],
                    ],
                ],
                'bank' => [
                    ['topic' => 'IRCC', 'difficulty' => 'easy', 'q' => 'TEF Canada is used to prove:', 'opts' => ['English proficiency', 'French proficiency', 'Medical fitness', 'Work experience'], 'correct' => 1, 'exp' => 'TEF evaluates French.'],
                    ['topic' => 'CRS', 'difficulty' => 'medium', 'q' => 'Second official language points require:', 'opts' => ['Any French course certificate', 'Approved test results at required NCLC', 'Birth in Quebec only', 'No test needed'], 'correct' => 1, 'exp' => 'IRCC needs approved test scores.'],
                ],
                'quizzes' => [
                    ['title' => 'TEF Canada intro quiz', 'content_type' => 'quiz', 'source_mode' => 'bank_random', 'random_question_count' => 2, 'time_limit_minutes' => 5, 'passing_score' => 50],
                ],
                'homework' => null,
            ],
        ];
    }

    /** @param array<string, mixed> $blueprint */
    private function seedCourse(array $blueprint): LmsCourse
    {
        $category = LmsCategory::where('slug', $blueprint['category'])->firstOrFail();

        $course = LmsCourse::firstOrCreate(
            ['category_id' => $category->id, 'slug' => $blueprint['slug']],
            [
                'title'        => $blueprint['title'],
                'description'  => $blueprint['description'],
                'is_published' => true,
                'sort_order'   => $blueprint['sort_order'],
            ],
        );

        if (! $course->thumbnail_url && ! empty($blueprint['thumbnail'])) {
            $course->update(['thumbnail_url' => $blueprint['thumbnail']]);
        }

        if ($course->modules()->count() === 0) {
            $this->seedModules($course, $blueprint['modules'] ?? []);
        }

        if ($course->questionBank()->count() === 0) {
            $this->seedQuestionBank($course, $blueprint['bank'] ?? []);
        }

        if ($course->quizzes()->count() === 0) {
            $this->seedQuizzes($course, $blueprint['quizzes'] ?? []);
        }

        if ($course->homework()->count() === 0 && ! empty($blueprint['homework'])) {
            $hw = $blueprint['homework'];
            $module = $course->modules()->first();
            $course->homework()->create([
                'module_id'    => $module?->id,
                'title'        => $hw['title'],
                'instructions' => $hw['instructions'],
                'max_score'    => 100,
                'sort_order'   => 0,
            ]);
        }

        return $course;
    }

    /** @param list<array<string, mixed>> $modules */
    private function seedModules(LmsCourse $course, array $modules): void
    {
        foreach ($modules as $mi => $mod) {
            $module = $course->modules()->create([
                'title'      => $mod['title'],
                'sort_order' => $mi,
            ]);

            foreach ($mod['lessons'] ?? [] as $li => $lesson) {
                $module->lessons()->create([
                    'title'        => $lesson['title'],
                    'lesson_type'  => $lesson['lesson_type'] ?? 'text',
                    'video_url'    => $lesson['video_url'] ?? null,
                    'text_content' => $lesson['text_content'] ?? null,
                    'sort_order'   => $li,
                ]);
            }
        }
    }

    /** @param list<array<string, mixed>> $questions */
    private function seedQuestionBank(LmsCourse $course, array $questions): void
    {
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

    /** @param list<array<string, mixed>> $quizzes */
    private function seedQuizzes(LmsCourse $course, array $quizzes): void
    {
        foreach ($quizzes as $qi => $quizDef) {
            $quiz = $course->quizzes()->create([
                'title'                 => $quizDef['title'],
                'content_type'          => $quizDef['content_type'],
                'source_mode'           => $quizDef['source_mode'],
                'random_question_count' => $quizDef['random_question_count'] ?? null,
                'time_limit_minutes'    => $quizDef['time_limit_minutes'] ?? null,
                'passing_score'         => $quizDef['passing_score'] ?? 70,
                'description'           => $quizDef['description'] ?? null,
                'sort_order'            => $qi,
            ]);

            foreach ($quizDef['inline'] ?? [] as $i => $inline) {
                $q = $quiz->questions()->create([
                    'question_text' => $inline['q'],
                    'sort_order'    => $i,
                ]);
                foreach ($inline['opts'] as $oi => [$text, $correct]) {
                    $q->options()->create([
                        'option_text' => $text,
                        'is_correct'  => $correct,
                        'sort_order'  => $oi,
                    ]);
                }
            }
        }
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
