<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RcicConsultant extends Model
{
    use HasFactory;

    protected $connection = 'cws';
    protected $table      = 'rcic_consultants';

    /**
     * All columns from the CICC public register.
     * This table is read-only (seeded from CSV) — no mass-assignment needed.
     */
    protected $guarded = [];

    protected $casts = [
        'entitled_to_practise' => 'boolean',
        'scraped_at'           => 'datetime',
        'created_at'           => 'datetime',
        'updated_at'           => 'datetime',
    ];

    // ── Scopes ───────────────────────────────────────────────────────────────

    /** Only consultants currently entitled to practise */
    public function scopeActive($query)
    {
        return $query->where('entitled_to_practise', true);
    }

    /** Quick search by name, college_id, or company */
    public function scopeSearch($query, string $term)
    {
        return $query->where(function ($q) use ($term) {
            $q->where('full_name',   'like', "%{$term}%")
              ->orWhere('college_id', 'like', "%{$term}%")
              ->orWhere('company',    'like', "%{$term}%")
              ->orWhere('email',      'like', "%{$term}%");
        });
    }
}
