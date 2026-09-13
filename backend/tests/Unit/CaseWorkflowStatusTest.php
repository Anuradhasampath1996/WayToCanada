<?php

namespace Tests\Unit;

use App\Support\CaseWorkflowStatus;
use PHPUnit\Framework\TestCase;

class CaseWorkflowStatusTest extends TestCase
{
    public function test_legacy_statuses_map_without_breaking_old_cases(): void
    {
        $this->assertSame(CaseWorkflowStatus::ELIGIBILITY_ASSESSMENT, CaseWorkflowStatus::fromLegacy('PENDING_ASSESSMENT'));
        $this->assertSame(CaseWorkflowStatus::PATHWAY_SELECTED, CaseWorkflowStatus::fromLegacy('PATHWAY_SELECTED'));
        $this->assertSame(CaseWorkflowStatus::RETAINER_PENDING, CaseWorkflowStatus::fromLegacy('AGREEMENT_SENT'));
        $this->assertSame(CaseWorkflowStatus::CASE_ACTIVE, CaseWorkflowStatus::fromLegacy('AGREEMENT_SIGNED'));
        $this->assertSame(CaseWorkflowStatus::DOCUMENT_COLLECTION, CaseWorkflowStatus::fromLegacy('DOCUMENTS_UPLOADING'));
        $this->assertSame(CaseWorkflowStatus::SUBMITTED, CaseWorkflowStatus::fromLegacy('APPLICATION_SUBMITTED'));
        $this->assertSame(CaseWorkflowStatus::ELIGIBILITY_ASSESSMENT, CaseWorkflowStatus::fromLegacy('active'));
        $this->assertSame(CaseWorkflowStatus::ELIGIBILITY_ASSESSMENT, CaseWorkflowStatus::fromLegacy(null));
    }

    public function test_statuses_group_into_three_ui_columns(): void
    {
        $this->assertSame(CaseWorkflowStatus::GROUP_PRE_ENGAGEMENT, CaseWorkflowStatus::group('PATHWAY_SELECTED'));
        $this->assertSame(CaseWorkflowStatus::GROUP_ACTIVE_CASE, CaseWorkflowStatus::group('DOCUMENT_COLLECTION'));
        $this->assertSame(CaseWorkflowStatus::GROUP_POST_SUBMISSION, CaseWorkflowStatus::group('APPLICATION_SUBMITTED'));

        $serialized = CaseWorkflowStatus::serialize(null, 'AGREEMENT_SIGNED');
        $this->assertSame(CaseWorkflowStatus::CASE_ACTIVE, $serialized['status']);
        $this->assertSame(CaseWorkflowStatus::GROUP_ACTIVE_CASE, $serialized['group']);
        $this->assertCount(3, $serialized['groups']);
    }

    public function test_explicit_workflow_status_wins_over_legacy(): void
    {
        $this->assertSame(
            CaseWorkflowStatus::CLIENT_REVIEW,
            CaseWorkflowStatus::resolveForCase(CaseWorkflowStatus::CLIENT_REVIEW, 'AGREEMENT_SIGNED')
        );
    }
}
