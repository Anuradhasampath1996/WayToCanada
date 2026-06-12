<?php

namespace App\Enums;

enum CaseFeeMilestoneStatus: string
{
    case PENDING = 'pending';
    case IN_PROGRESS = 'in_progress';
    case COMPLETED = 'completed';
    case INVOICED = 'invoiced';
    case RELEASED = 'released';
}
