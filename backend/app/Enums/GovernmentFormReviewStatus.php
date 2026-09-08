<?php

namespace App\Enums;

enum GovernmentFormReviewStatus: string
{
    case PENDING = 'pending';
    case NEEDS_REVIEW = 'needs_review';
    case REVIEWED = 'reviewed';
    case VALIDATED = 'validated';
}
