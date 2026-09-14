<?php

namespace App\Models\Academy;

use Illuminate\Database\Eloquent\Model;

abstract class AcademyModel extends Model
{
    protected $connection = 'academy';
}
