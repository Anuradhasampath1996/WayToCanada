<?php

namespace App\Enums;

enum GovernmentFormVersionStatus: string
{
    case ACTIVE = 'ACTIVE';
    case DEPRECATED = 'DEPRECATED';
    case DISABLED = 'DISABLED';
    case MAPPING_REVIEW_REQUIRED = 'MAPPING_REVIEW_REQUIRED';
    case REVALIDATION_REQUIRED = 'REVALIDATION_REQUIRED';
}
