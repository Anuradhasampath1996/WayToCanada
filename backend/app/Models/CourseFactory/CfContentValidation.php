<?php

namespace App\Models\CourseFactory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CfContentValidation extends Model
{
    protected $connection = 'lms';
    protected $table = 'cf_content_validations';

    protected $fillable = [
        'generation_run_id', 'target_type', 'target_id', 'validator', 'status', 'result_json',
    ];

    protected function casts(): array
    {
        return ['result_json' => 'array'];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(CfGenerationRun::class, 'generation_run_id');
    }
}
