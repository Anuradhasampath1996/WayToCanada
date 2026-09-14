<?php

namespace App\Models\Academy;

class AcademyContentSourceLink extends AcademyModel
{
    protected $table = 'academy_content_source_links';

    protected $fillable = ['legal_source_id', 'linkable_type', 'linkable_id', 'section_label'];
}
