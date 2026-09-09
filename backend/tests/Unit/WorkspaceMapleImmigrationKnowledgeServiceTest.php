<?php

namespace Tests\Unit;

use App\Services\WorkspaceMapleImmigrationKnowledgeService;
use ReflectionMethod;
use Tests\TestCase;

class WorkspaceMapleImmigrationKnowledgeServiceTest extends TestCase
{
    public function test_casual_case_chat_does_not_want_legislation_search(): void
    {
        $svc = $this->app->make(WorkspaceMapleImmigrationKnowledgeService::class);
        $method = new ReflectionMethod($svc, 'wantsLegislationSearch');
        $method->setAccessible(true);

        $this->assertFalse($method->invoke($svc, 'me client gana nadaganna oni mata'));
        $this->assertFalse($method->invoke($svc, 'tell me about this client'));
        $this->assertFalse($method->invoke($svc, 'What is their CRS score?'));
    }

    public function test_law_questions_want_legislation_search(): void
    {
        $svc = $this->app->make(WorkspaceMapleImmigrationKnowledgeService::class);
        $method = new ReflectionMethod($svc, 'wantsLegislationSearch');
        $method->setAccessible(true);

        $this->assertTrue($method->invoke($svc, 'What does IRPA section 28 say about residency?'));
        $this->assertTrue($method->invoke($svc, 'criminal inadmissibility for this client'));
        $this->assertTrue($method->invoke($svc, 'PR card residency obligation'));
    }

    public function test_citation_links_only_when_reply_cites_section(): void
    {
        $svc = $this->app->make(WorkspaceMapleImmigrationKnowledgeService::class);

        $knowledge = [
            'legislation_links' => [
                [
                    'act_code' => 'A-1',
                    'provision_key' => '28(2)',
                    'section_label' => '28(2)',
                    'citation' => 'A-1 — Section 28(2)',
                    'hub_path' => '/dashboard/legislation/1?key=28(2)',
                ],
                [
                    'act_code' => 'A-1',
                    'provision_key' => '36(2)',
                    'section_label' => '36(2)',
                    'citation' => 'A-1 — Section 36(2)',
                    'hub_path' => '/dashboard/legislation/1?key=36(2)',
                ],
            ],
        ];

        $this->assertSame([], $svc->citationLinksForResponse($knowledge, 'Client is at case hub stage.'));

        $cited = $svc->citationLinksForResponse(
            $knowledge,
            'Check IRPA section 28(2) residency obligation for this PR.',
        );

        $this->assertCount(1, $cited);
        $this->assertSame('28(2)', $cited[0]['section_label']);
    }
}
