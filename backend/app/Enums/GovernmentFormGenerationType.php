<?php

namespace App\Enums;

enum GovernmentFormGenerationType: string
{
    case MANUAL_UPLOAD = 'manual_upload';
    case AUTO_GENERATED = 'auto_generated';
}
