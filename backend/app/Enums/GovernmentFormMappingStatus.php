<?php

namespace App\Enums;

enum GovernmentFormMappingStatus: string
{
    case DRAFT = 'DRAFT';
    case VERIFIED = 'VERIFIED';
    case MAPPING_REVIEW_REQUIRED = 'MAPPING_REVIEW_REQUIRED';
    case REVALIDATION_REQUIRED = 'REVALIDATION_REQUIRED';
}
