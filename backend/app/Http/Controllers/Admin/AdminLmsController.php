<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Lms\LmsCategory;
use App\Models\Lms\LmsCourse;
use App\Models\Lms\LmsHomework;
use App\Models\Lms\LmsLesson;
use App\Models\Lms\LmsModule;
use App\Models\Lms\LmsQuestion;
use App\Models\Lms\LmsQuestionBank;
use App\Models\Lms\LmsQuestionOption;
use App\Models\Lms\LmsQuiz;
use App\Models\Lms\LmsQuizBankQuestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminLmsController extends Controller
{
    // ── Categories ────────────────────────────────────────────────────────────

    public function categoriesIndex(): JsonResponse
    {
        $items = LmsCategory::withCount('courses')->orderBy('sort_order')->orderBy('name')->get();
        return response()->json(['data' => $items]);
    }

    public function categoriesStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:120',
            'description' => 'nullable|string',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'nullable|boolean',
        ]);
        $data['slug'] = Str::slug($data['name']);
        $cat = LmsCategory::create($data);
        return response()->json($cat, 201);
    }

    public function categoriesUpdate(Request $request, LmsCategory $category): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:120',
            'description' => 'nullable|string',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'nullable|boolean',
        ]);
        if (isset($data['name'])) {
            $data['slug'] = Str::slug($data['name']);
        }
        $category->update($data);
        return response()->json($category);
    }

    public function categoriesDestroy(LmsCategory $category): JsonResponse
    {
        $category->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── Courses ───────────────────────────────────────────────────────────────

    public function coursesIndex(Request $request): JsonResponse
    {
        $q = LmsCourse::with('category')->withCount(['modules', 'quizzes'])->orderBy('sort_order');
        if ($request->filled('category_id')) {
            $q->where('category_id', $request->integer('category_id'));
        }
        return response()->json(['data' => $q->get()]);
    }

    public function coursesShow(LmsCourse $course): JsonResponse
    {
        $course->load([
            'category', 'modules.lessons',
            'quizzes.questions.options', 'quizzes.bankLinks.bankQuestion.options',
            'homework', 'questionBank.options',
        ]);
        $course->setAttribute('question_bank_count', $course->questionBank->count());

        return response()->json($course);
    }

    public function coursesStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id'   => 'required|exists:lms.lms_categories,id',
            'title'         => 'required|string|max:200',
            'description'   => 'nullable|string',
            'thumbnail_url' => 'nullable|url|max:500',
            'is_published'  => 'nullable|boolean',
            'sort_order'    => 'nullable|integer|min:0',
        ]);
        $data['slug'] = Str::slug($data['title']);
        $course = LmsCourse::create($data);
        return response()->json($course->load('category'), 201);
    }

    public function coursesUpdate(Request $request, LmsCourse $course): JsonResponse
    {
        $data = $request->validate([
            'category_id'   => 'sometimes|exists:lms.lms_categories,id',
            'title'         => 'sometimes|string|max:200',
            'description'   => 'nullable|string',
            'thumbnail_url' => 'nullable|url|max:500',
            'is_published'  => 'nullable|boolean',
            'sort_order'    => 'nullable|integer|min:0',
        ]);
        if (isset($data['title'])) {
            $data['slug'] = Str::slug($data['title']);
        }
        $course->update($data);
        return response()->json($course->fresh()->load('category'));
    }

    public function coursesDestroy(LmsCourse $course): JsonResponse
    {
        $course->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function uploadThumbnail(Request $request, LmsCourse $course): JsonResponse
    {
        $request->validate([
            'thumbnail' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        if ($course->thumbnail_url) {
            $oldPath = str_replace(
                rtrim(config('app.url'), '/') . '/storage/',
                '',
                $course->thumbnail_url
            );
            if ($oldPath && ! str_starts_with($oldPath, 'http')) {
                Storage::disk('public')->delete($oldPath);
            }
        }

        $file     = $request->file('thumbnail');
        $filename = sprintf('lms-thumbnails/%d_%s.%s', $course->id, time(), $file->getClientOriginalExtension());
        $file->storeAs('', $filename, 'public');

        $url = rtrim(config('app.url'), '/') . '/storage/' . $filename;
        $course->update(['thumbnail_url' => $url]);

        return response()->json([
            'message'       => 'Thumbnail uploaded successfully.',
            'thumbnail_url' => $url,
            'course'        => $course->fresh()->load('category'),
        ]);
    }

    // ── Modules & Lessons ───────────────────────────────────────────────────

    public function modulesStore(Request $request, LmsCourse $course): JsonResponse
    {
        $data = $request->validate([
            'title'      => 'required|string|max:200',
            'sort_order' => 'nullable|integer|min:0',
        ]);
        $module = $course->modules()->create($data);
        return response()->json($module, 201);
    }

    public function modulesUpdate(Request $request, LmsModule $module): JsonResponse
    {
        $data = $request->validate([
            'title'      => 'sometimes|string|max:200',
            'sort_order' => 'nullable|integer|min:0',
        ]);
        $module->update($data);
        return response()->json($module);
    }

    public function modulesDestroy(LmsModule $module): JsonResponse
    {
        $module->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function lessonsStore(Request $request, LmsModule $module): JsonResponse
    {
        $data = $request->validate([
            'title'            => 'required|string|max:200',
            'lesson_type'      => ['nullable', Rule::in(['video', 'text', 'pdf', 'mixed'])],
            'video_url'        => 'nullable|string|max:1000',
            'pdf_url'          => 'nullable|string|max:1000',
            'text_content'     => 'nullable|string',
            'duration_minutes' => 'nullable|integer|min:0',
            'sort_order'       => 'nullable|integer|min:0',
        ]);
        $lesson = $module->lessons()->create($data);
        return response()->json($lesson, 201);
    }

    public function lessonsUpdate(Request $request, LmsLesson $lesson): JsonResponse
    {
        $data = $request->validate([
            'title'            => 'sometimes|string|max:200',
            'lesson_type'      => ['nullable', Rule::in(['video', 'text', 'pdf', 'mixed'])],
            'video_url'        => 'nullable|string|max:1000',
            'pdf_url'          => 'nullable|string|max:1000',
            'text_content'     => 'nullable|string',
            'duration_minutes' => 'nullable|integer|min:0',
            'sort_order'       => 'nullable|integer|min:0',
        ]);
        $lesson->update($data);
        return response()->json($lesson);
    }

    public function lessonsDestroy(LmsLesson $lesson): JsonResponse
    {
        $lesson->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── Quizzes & MCQ bank ──────────────────────────────────────────────────

    public function quizzesStore(Request $request, LmsCourse $course): JsonResponse
    {
        $data = $request->validate([
            'title'                  => 'required|string|max:200',
            'content_type'           => ['nullable', Rule::in(['quiz', 'exam', 'mock_exam'])],
            'source_mode'            => ['nullable', Rule::in(['inline', 'bank_fixed', 'bank_random'])],
            'random_question_count'  => 'nullable|integer|min:1|max:200',
            'time_limit_minutes'     => 'nullable|integer|min:1|max:600',
            'description'            => 'nullable|string',
            'module_id'              => 'nullable|exists:lms.lms_modules,id',
            'passing_score'          => 'nullable|integer|min:1|max:100',
            'sort_order'             => 'nullable|integer|min:0',
            'bank_question_ids'      => 'nullable|array',
            'bank_question_ids.*'    => 'integer|exists:lms.lms_question_bank,id',
            'questions'              => 'nullable|array',
            'questions.*.question_text' => 'required_with:questions|string',
            'questions.*.options'       => 'required_with:questions|array|min:2',
            'questions.*.options.*.option_text' => 'required|string',
            'questions.*.options.*.is_correct'  => 'nullable|boolean',
        ]);

        $sourceMode = $data['source_mode'] ?? 'inline';

        $quiz = $course->quizzes()->create([
            'title'                 => $data['title'],
            'content_type'          => $data['content_type'] ?? 'quiz',
            'source_mode'           => $sourceMode,
            'random_question_count' => $data['random_question_count'] ?? null,
            'time_limit_minutes'    => $data['time_limit_minutes'] ?? null,
            'description'           => $data['description'] ?? null,
            'module_id'             => $data['module_id'] ?? null,
            'passing_score'         => $data['passing_score'] ?? 70,
            'sort_order'            => $data['sort_order'] ?? 0,
        ]);

        if ($sourceMode === 'bank_fixed' && ! empty($data['bank_question_ids'])) {
            foreach ($data['bank_question_ids'] as $i => $bqId) {
                LmsQuizBankQuestion::create([
                    'quiz_id'          => $quiz->id,
                    'bank_question_id' => $bqId,
                    'sort_order'       => $i,
                ]);
            }
        }

        if ($sourceMode === 'inline') {
            foreach ($data['questions'] ?? [] as $qi => $qData) {
                $question = $quiz->questions()->create([
                    'question_text' => $qData['question_text'],
                    'sort_order'    => $qi,
                ]);
                foreach ($qData['options'] as $oi => $opt) {
                    $question->options()->create([
                        'option_text' => $opt['option_text'],
                        'is_correct'  => $opt['is_correct'] ?? false,
                        'sort_order'  => $oi,
                    ]);
                }
            }
        }

        return response()->json($quiz->load(['questions.options', 'bankLinks.bankQuestion']), 201);
    }

    public function quizzesUpdate(Request $request, LmsQuiz $quiz): JsonResponse
    {
        $data = $request->validate([
            'title'                 => 'sometimes|string|max:200',
            'content_type'          => ['nullable', Rule::in(['quiz', 'exam', 'mock_exam'])],
            'source_mode'           => ['nullable', Rule::in(['inline', 'bank_fixed', 'bank_random'])],
            'random_question_count' => 'nullable|integer|min:1|max:200',
            'time_limit_minutes'    => 'nullable|integer|min:1|max:600',
            'description'           => 'nullable|string',
            'passing_score'         => 'nullable|integer|min:1|max:100',
            'bank_question_ids'     => 'nullable|array',
            'bank_question_ids.*'   => 'integer|exists:lms.lms_question_bank,id',
        ]);

        $quiz->update($data);

        if (array_key_exists('bank_question_ids', $data)) {
            $quiz->bankLinks()->delete();
            foreach ($data['bank_question_ids'] as $i => $bqId) {
                LmsQuizBankQuestion::create([
                    'quiz_id'          => $quiz->id,
                    'bank_question_id' => $bqId,
                    'sort_order'       => $i,
                ]);
            }
        }

        return response()->json($quiz->fresh()->load(['questions.options', 'bankLinks.bankQuestion']));
    }

    public function quizzesDestroy(LmsQuiz $quiz): JsonResponse
    {
        $quiz->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ── Question bank ─────────────────────────────────────────────────────────

    public function questionBankIndex(LmsCourse $course): JsonResponse
    {
        $items = LmsQuestionBank::with('options')
            ->where('course_id', $course->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function questionBankStore(Request $request, LmsCourse $course): JsonResponse
    {
        $data = $request->validate([
            'question_text' => 'required|string',
            'topic'         => 'nullable|string|max:120',
            'difficulty'    => ['nullable', Rule::in(['easy', 'medium', 'hard'])],
            'explanation'   => 'nullable|string',
            'options'       => 'required|array|min:2|max:6',
            'options.*.option_text' => 'required|string',
            'options.*.is_correct'  => 'nullable|boolean',
        ]);

        $q = $course->questionBank()->create([
            'question_text' => $data['question_text'],
            'topic'         => $data['topic'] ?? null,
            'difficulty'    => $data['difficulty'] ?? 'medium',
            'explanation'   => $data['explanation'] ?? null,
        ]);

        foreach ($data['options'] as $i => $opt) {
            $q->options()->create([
                'option_text' => $opt['option_text'],
                'is_correct'  => $opt['is_correct'] ?? false,
                'sort_order'  => $i,
            ]);
        }

        return response()->json($q->load('options'), 201);
    }

    public function questionBankUpdate(Request $request, LmsQuestionBank $question): JsonResponse
    {
        $data = $request->validate([
            'question_text' => 'sometimes|string',
            'topic'         => 'nullable|string|max:120',
            'difficulty'    => ['nullable', Rule::in(['easy', 'medium', 'hard'])],
            'explanation'   => 'nullable|string',
            'options'       => 'sometimes|array|min:2|max:6',
            'options.*.option_text' => 'required_with:options|string',
            'options.*.is_correct'  => 'nullable|boolean',
        ]);

        $question->update(collect($data)->except('options')->all());

        if (isset($data['options'])) {
            $question->options()->delete();
            foreach ($data['options'] as $i => $opt) {
                $question->options()->create([
                    'option_text' => $opt['option_text'],
                    'is_correct'  => $opt['is_correct'] ?? false,
                    'sort_order'  => $i,
                ]);
            }
        }

        return response()->json($question->fresh()->load('options'));
    }

    public function questionBankDestroy(LmsQuestionBank $question): JsonResponse
    {
        $question->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function questionBankImport(Request $request, LmsCourse $course): JsonResponse
    {
        $data = $request->validate([
            'format'  => ['nullable', Rule::in(['csv', 'json'])],
            'content' => 'required|string',
        ]);

        $format = $data['format'] ?? 'csv';
        $rows   = $format === 'json'
            ? json_decode($data['content'], true, 512, JSON_THROW_ON_ERROR)
            : $this->parseCsvQuestions($data['content']);

        $created = 0;
        foreach ($rows as $row) {
            if (empty($row['question_text'])) {
                continue;
            }
            $options = $row['options'] ?? [];
            if (count($options) < 2) {
                continue;
            }

            $q = $course->questionBank()->create([
                'question_text' => $row['question_text'],
                'topic'         => $row['topic'] ?? null,
                'difficulty'    => $row['difficulty'] ?? 'medium',
                'explanation'   => $row['explanation'] ?? null,
            ]);

            foreach ($options as $i => $opt) {
                $q->options()->create([
                    'option_text' => $opt['option_text'],
                    'is_correct'  => $opt['is_correct'] ?? false,
                    'sort_order'  => $i,
                ]);
            }
            $created++;
        }

        return response()->json(['imported' => $created]);
    }

    public function questionBankExport(LmsCourse $course): StreamedResponse
    {
        $questions = LmsQuestionBank::with('options')
            ->where('course_id', $course->id)
            ->orderBy('id')
            ->get();

        $filename = Str::slug($course->title) . '-question-bank.csv';

        return response()->streamDownload(function () use ($questions) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'correct', 'topic', 'difficulty', 'explanation']);

            foreach ($questions as $q) {
                $opts = $q->options->values();
                $letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                $correct = 'A';
                foreach ($opts as $i => $o) {
                    if ($o->is_correct) {
                        $correct = $letters[$i] ?? 'A';
                    }
                }

                fputcsv($out, [
                    $q->question_text,
                    $opts[0]->option_text ?? '',
                    $opts[1]->option_text ?? '',
                    $opts[2]->option_text ?? '',
                    $opts[3]->option_text ?? '',
                    $opts[4]->option_text ?? '',
                    $opts[5]->option_text ?? '',
                    $correct,
                    $q->topic ?? '',
                    $q->difficulty ?? 'medium',
                    $q->explanation ?? '',
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    /** @return list<array<string, mixed>> */
    private function parseCsvQuestions(string $content): array
    {
        $lines = preg_split('/\r\n|\r|\n/', trim($content));
        if (! $lines) {
            return [];
        }

        $header = str_getcsv(array_shift($lines));
        $header = array_map(fn ($h) => strtolower(trim($h)), $header);
        $rows   = [];

        foreach ($lines as $line) {
            if (trim($line) === '') {
                continue;
            }
            $cols = str_getcsv($line);
            $map  = [];
            foreach ($header as $i => $key) {
                $map[$key] = $cols[$i] ?? '';
            }

            $optionKeys = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f'];
            $options    = [];
            $letters    = ['A', 'B', 'C', 'D', 'E', 'F'];
            $correct    = strtoupper(trim($map['correct'] ?? 'A'));

            foreach ($optionKeys as $i => $key) {
                if (! empty($map[$key])) {
                    $options[] = [
                        'option_text' => $map[$key],
                        'is_correct'  => ($letters[$i] === $correct),
                    ];
                }
            }

            $rows[] = [
                'question_text' => $map['question'] ?? $map['question_text'] ?? '',
                'topic'         => $map['topic'] ?? null,
                'difficulty'    => $map['difficulty'] ?? 'medium',
                'explanation'   => $map['explanation'] ?? null,
                'options'       => $options,
            ];
        }

        return $rows;
    }

    // ── Written assignments (homework) ────────────────────────────────────────

    public function homeworkIndex(LmsCourse $course): JsonResponse
    {
        return response()->json(['data' => $course->homework()->orderBy('sort_order')->get()]);
    }

    public function homeworkStore(Request $request, LmsCourse $course): JsonResponse
    {
        $data = $request->validate([
            'title'        => 'required|string|max:200',
            'instructions' => 'nullable|string',
            'module_id'    => 'nullable|exists:lms.lms_modules,id',
            'max_score'    => 'nullable|integer|min:1|max:1000',
        ]);

        $hw = $course->homework()->create($data);

        return response()->json($hw, 201);
    }

    public function homeworkDestroy(LmsHomework $homework): JsonResponse
    {
        $homework->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
