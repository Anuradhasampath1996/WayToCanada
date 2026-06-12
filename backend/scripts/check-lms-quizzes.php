<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

foreach (App\Models\Lms\LmsCourseAssignment::with('course.quizzes')->get() as $a) {
    echo "Assignment {$a->id}: client={$a->client_user_id} course=\"{$a->course->title}\" quizzes={$a->course->quizzes->count()}\n";
}
