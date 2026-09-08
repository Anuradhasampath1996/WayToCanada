<?php

namespace App\Enums;

enum GovernmentFormSubmissionMode: string
{
    case PDF_AUTO_FILL = 'PDF_AUTO_FILL';
    case PDF_AUTO_FILL_ADOBE_VALIDATE = 'PDF_AUTO_FILL_ADOBE_VALIDATE';
    case PDF_MANUAL = 'PDF_MANUAL';
    case PORTAL_DIGITAL = 'PORTAL_DIGITAL';
    case NOT_APPLICABLE = 'NOT_APPLICABLE';
}
