<?php

namespace Tests\Unit;

use App\Models\IrccCategory;
use App\Services\IrccPackageSuggestionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IrccPackageSuggestionServiceTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = false;

    public function test_express_entry_pathway_maps_to_express_entry_leaf(): void
    {
        $this->seedMinimalTree();

        $service = app(IrccPackageSuggestionService::class);
        $case = new \App\Models\CaseFile([
            'immigration_pathway' => 'Express Entry – Federal Skilled Worker',
        ]);

        $suggestion = $service->suggestForCase($case);

        $this->assertNotNull($suggestion['category']);
        $this->assertStringContainsString('Express Entry', (string) $suggestion['category']->label);
        $this->assertContains($suggestion['source'], ['deterministic', 'maple']);
    }

    public function test_pnp_pathway_maps_to_pnp_leaf(): void
    {
        $this->seedMinimalTree();

        $service = app(IrccPackageSuggestionService::class);
        $case = new \App\Models\CaseFile([
            'immigration_pathway' => 'Provincial Nominee Program',
        ]);

        $suggestion = $service->suggestForCase($case);

        $this->assertNotNull($suggestion['category']);
        $this->assertStringContainsString('Provincial Nominee', (string) $suggestion['category']->label);
    }

    public function test_family_sponsorship_maps_to_family_leaf_not_super_visa(): void
    {
        $this->seedMinimalTree();

        $service = app(IrccPackageSuggestionService::class);
        $case = new \App\Models\CaseFile([
            'immigration_pathway' => 'Family Sponsorship',
        ]);

        $suggestion = $service->suggestForCase($case);

        $this->assertNotNull($suggestion['category']);
        $this->assertStringContainsString('Family Sponsorship', (string) $suggestion['category']->label);
        $this->assertStringNotContainsString('Super Visa', (string) $suggestion['category']->label);
    }

    public function test_study_permit_does_not_pick_work_permit(): void
    {
        $this->seedMinimalTree();

        $service = app(IrccPackageSuggestionService::class);
        $case = new \App\Models\CaseFile([
            'immigration_pathway' => 'Study Permit',
        ]);

        $suggestion = $service->suggestForCase($case);

        $this->assertNotNull($suggestion['category']);
        $this->assertStringContainsString('Study', (string) $suggestion['category']->label);
        $this->assertStringNotContainsString('Work permit', (string) $suggestion['category']->label);
    }

    private function seedMinimalTree(): void
    {
        $l1 = IrccCategory::create([
            'parent_id' => null,
            'level' => 1,
            'label' => 'Immigrate, visit, work or study',
            'sort_order' => 1,
        ]);
        $pr = IrccCategory::create([
            'parent_id' => $l1->id,
            'level' => 2,
            'label' => 'To immigrate to Canada (Permanent Residence)',
            'sort_order' => 1,
        ]);
        $study = IrccCategory::create([
            'parent_id' => $l1->id,
            'level' => 2,
            'label' => 'To study in Canada',
            'sort_order' => 2,
        ]);
        $work = IrccCategory::create([
            'parent_id' => $l1->id,
            'level' => 2,
            'label' => 'To work in Canada',
            'sort_order' => 3,
        ]);
        IrccCategory::create([
            'parent_id' => $pr->id,
            'level' => 3,
            'label' => 'Express Entry (FSW, CEC, FST)',
            'sort_order' => 1,
            'result' => ['guide' => 'EE', 'checklist' => 'X', 'forms' => []],
        ]);
        IrccCategory::create([
            'parent_id' => $pr->id,
            'level' => 3,
            'label' => 'Provincial Nominee Program (PNP - Non-Express Entry)',
            'sort_order' => 2,
            'result' => ['guide' => 'PNP', 'checklist' => 'Y', 'forms' => []],
        ]);
        IrccCategory::create([
            'parent_id' => $pr->id,
            'level' => 3,
            'label' => 'Family Sponsorship — Spouse or Partner',
            'sort_order' => 3,
            'result' => ['guide' => 'G3999', 'checklist' => 'IMM 5533', 'forms' => ['IMM 0008']],
        ]);
        IrccCategory::create([
            'parent_id' => $pr->id,
            'level' => 3,
            'label' => 'Super Visa (Parents and Grandparents)',
            'sort_order' => 4,
            'result' => ['guide' => 'SV', 'checklist' => 'Z', 'forms' => []],
        ]);
        IrccCategory::create([
            'parent_id' => $study->id,
            'level' => 3,
            'label' => 'Study permit from outside Canada',
            'sort_order' => 1,
            'result' => ['guide' => 'S', 'checklist' => 'S', 'forms' => ['IMM 1294']],
        ]);
        IrccCategory::create([
            'parent_id' => $work->id,
            'level' => 3,
            'label' => 'Work permit from outside Canada',
            'sort_order' => 1,
            'result' => ['guide' => 'W', 'checklist' => 'W', 'forms' => ['IMM 1295']],
        ]);
    }
}
