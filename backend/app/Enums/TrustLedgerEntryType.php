<?php

namespace App\Enums;

enum TrustLedgerEntryType: string
{
    case TRUST_DEPOSIT = 'trust_deposit';
    case TRUST_RELEASE = 'trust_release';
    case TRUST_REFUND = 'trust_refund';
    case ADJUSTMENT = 'adjustment';
}
