<?php

namespace Tests\Unit;

use App\Support\RequirementPlanDiff;
use PHPUnit\Framework\TestCase;

class RequirementPlanDiffTest extends TestCase
{
    public function test_compare_reports_added_removed_and_changed_items(): void
    {
        $current = [
            'extra_fields' => [['key' => 'old_field', 'label' => 'Old']],
            'forms' => [['code' => 'IMM 0008', 'name' => 'IMM 0008', 'kind' => 'official']],
            'documents' => [['id' => 'passport', 'label' => 'Passport', 'category' => 'identity']],
            'representative' => ['status' => 'required'],
            'portals' => ['recommended' => ['ircc_rep']],
        ];
        $proposed = [
            'extra_fields' => [['key' => 'new_field', 'label' => 'New']],
            'forms' => [['code' => 'IMM 1294', 'name' => 'Study', 'kind' => 'official']],
            'documents' => [['id' => 'passport', 'label' => 'Valid Passport', 'category' => 'identity']],
            'representative' => ['status' => 'optional'],
            'portals' => ['recommended' => ['ircc_rep', 'pr_portal']],
        ];

        $diff = RequirementPlanDiff::compare($current, $proposed);

        $this->assertSame('new_field', $diff['added_fields'][0]['key']);
        $this->assertSame('old_field', $diff['removed_fields'][0]['key']);
        $this->assertSame('IMM 1294', $diff['added_forms'][0]['code']);
        $this->assertSame('IMM 0008', $diff['removed_forms'][0]['code']);
        $this->assertNotEmpty($diff['changed_documents']);
        $this->assertTrue($diff['representative']['changed']);
        $this->assertTrue($diff['portals']['changed']);
    }

    public function test_merge_reuses_compatible_items_and_keeps_obsolete_history(): void
    {
        $current = [
            'extra_fields' => [
                ['key' => 'express_entry_profile_number', 'label' => 'EE #', 'status' => 'complete', 'value' => 'E123'],
                ['key' => 'retired_field', 'label' => 'Gone', 'status' => 'complete', 'value' => 'keep-me'],
            ],
            'forms' => [
                ['code' => 'IMM 0008', 'name' => 'IMM 0008', 'kind' => 'official', 'status' => 'in_progress'],
            ],
            'documents' => [
                ['id' => 'passport', 'label' => 'Passport', 'status' => 'verified'],
                ['id' => 'eca', 'label' => 'ECA', 'status' => 'uploaded'],
            ],
            'portals' => ['recommended' => ['ircc_rep'], 'confirmed' => 'ircc_rep'],
            'obsolete_items' => [],
        ];
        $proposed = [
            'extra_fields' => [
                ['key' => 'express_entry_profile_number', 'label' => 'Express Entry profile number', 'status' => 'pending'],
                ['key' => 'dli_number', 'label' => 'DLI', 'status' => 'pending'],
            ],
            'forms' => [
                ['code' => 'IMM 1294', 'name' => 'IMM 1294', 'kind' => 'official', 'status' => 'pending'],
            ],
            'documents' => [
                ['id' => 'passport', 'label' => 'Valid Passport', 'status' => 'requested'],
                ['id' => 'acceptance_letter', 'label' => 'LOA', 'status' => 'requested'],
            ],
            'portals' => ['recommended' => ['ircc_rep'], 'confirmed' => null],
            'obsolete_items' => [],
        ];

        $merged = RequirementPlanDiff::mergePreservingHistory($current, $proposed);

        $this->assertSame('complete', $merged['extra_fields'][0]['status']);
        $this->assertSame('E123', $merged['extra_fields'][0]['value']);
        $this->assertSame('pending', $merged['extra_fields'][1]['status']);
        $this->assertSame('verified', $merged['documents'][0]['status']);
        $this->assertSame('ircc_rep', $merged['portals']['confirmed']);

        $obsoleteKeys = array_column($merged['obsolete_items'], 'key');
        $obsoleteIds = array_column($merged['obsolete_items'], 'id');
        $this->assertContains('retired_field', $obsoleteKeys);
        $this->assertContains('eca', $obsoleteIds);
        $this->assertSame('obsolete', $merged['obsolete_items'][0]['status']);
        $this->assertSame('not_required', $merged['obsolete_items'][0]['requirement_state']);
    }
}
