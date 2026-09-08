<?php

namespace App\Enums;

enum GovernmentFormGenerationStatus: string
{
    case NOT_READY = 'NOT_READY';
    case READY = 'READY';
    case GENERATING = 'GENERATING';
    case GENERATED = 'GENERATED';
    case NEEDS_REVIEW = 'NEEDS_REVIEW';
    case REVIEWED = 'REVIEWED';
    case ADOBE_VALIDATION_REQUIRED = 'ADOBE_VALIDATION_REQUIRED';
    case VALIDATED = 'VALIDATED';
    case SUPERSEDED = 'SUPERSEDED';
    case ERROR = 'ERROR';
}
