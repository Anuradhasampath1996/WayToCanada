<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;

class LmsExamGenerationOverride extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_exam_generation_overrides';

    protected $fillable = ['exam_id', 'actor_user_id', 'warning_code', 'reason'];
}
