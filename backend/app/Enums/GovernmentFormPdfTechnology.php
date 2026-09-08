<?php

namespace App\Enums;

enum GovernmentFormPdfTechnology: string
{
    case ACROFORM = 'ACROFORM';
    case XFA_STATIC = 'XFA_STATIC';
    case XFA_DYNAMIC = 'XFA_DYNAMIC';
    case ACROFORM_XFA_HYBRID = 'ACROFORM_XFA_HYBRID';
    case NON_INTERACTIVE = 'NON_INTERACTIVE';
    case UNKNOWN = 'UNKNOWN';
}
