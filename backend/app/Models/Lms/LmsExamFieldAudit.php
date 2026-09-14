<?php

namespace App\Models\Lms;

use Illuminate\Database\Eloquent\Model;

class LmsExamFieldAudit extends Model
{
    protected $connection = 'lms';

    protected $table = 'lms_exam_field_audits';

    protected $fillable = ['exam_id', 'actor_user_id', 'field', 'previous_value', 'new_value', 'reason'];
}
