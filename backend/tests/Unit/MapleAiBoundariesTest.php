<?php

namespace Tests\Unit;

use App\Support\MapleAiBoundaries;
use PHPUnit\Framework\TestCase;

class MapleAiBoundariesTest extends TestCase
{
    public function test_maple_cannot_perform_consultant_only_actions(): void
    {
        foreach ([
            'select_final_pathway',
            'approve_client_information',
            'approve_documents',
            'sign_declarations',
            'submit_application',
            'make_final_eligibility_decision',
        ] as $action) {
            $this->assertTrue(MapleAiBoundaries::forbids($action));
        }

        $this->assertFalse(MapleAiBoundaries::forbids('recommend_pathway'));
    }

    public function test_assert_not_forbidden_throws_for_blocked_actions(): void
    {
        $this->expectException(\LogicException::class);
        $this->expectExceptionMessage('licensed consultant remains responsible');
        MapleAiBoundaries::assertNotForbidden('submit_application');
    }
}
