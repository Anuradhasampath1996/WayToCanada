<?php

namespace App\Enums;

enum MilestoneInvoiceStatus: string
{
    case PENDING_CLIENT_APPROVAL = 'pending_client_approval';
    case APPROVED = 'approved';
    case RELEASED = 'released';
    case CANCELLED = 'cancelled';
}
