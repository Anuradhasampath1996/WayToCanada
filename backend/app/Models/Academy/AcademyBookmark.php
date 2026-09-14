<?php

namespace App\Models\Academy;

class AcademyBookmark extends AcademyModel
{
    protected $table = 'academy_bookmarks';

    protected $fillable = ['user_id', 'bookmarkable_type', 'bookmarkable_id'];
}
