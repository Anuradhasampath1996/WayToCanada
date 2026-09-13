<?php

namespace App\Support;

/**
 * Maple is decision support only. The licensed consultant remains responsible.
 */
final class MapleAiBoundaries
{
    public const FORBIDDEN_ACTIONS = [
        'select_final_pathway',
        'approve_client_information',
        'approve_documents',
        'sign_declarations',
        'submit_application',
        'make_final_eligibility_decision',
    ];

    public static function forbids(string $action): bool
    {
        return in_array($action, self::FORBIDDEN_ACTIONS, true);
    }

    public static function assertNotForbidden(string $action): void
    {
        if (self::forbids($action)) {
            throw new \LogicException('Maple AI must not '.$action.'. The licensed consultant remains responsible.');
        }
    }
}
