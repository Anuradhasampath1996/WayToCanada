<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CaseTeamAssignment extends Model
{
    public const ROLE_PRIMARY = 'primary_case_manager';
    public const ROLE_COLLABORATOR = 'collaborator';

    protected $connection = 'cws';

    protected $fillable = [
        'case_file_id',
        'member_id',
        'assignment_role',
        'assigned_by',
    ];

    public function caseFile(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(ConsultantWorkspaceMember::class, 'member_id');
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
