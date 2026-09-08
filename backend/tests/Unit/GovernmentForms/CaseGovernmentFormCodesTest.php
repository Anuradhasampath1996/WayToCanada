<?php

namespace Tests\Unit\GovernmentForms;

use App\Models\CaseFile;
use App\Services\GovernmentForms\CaseGovernmentFormCodes;
use Tests\TestCase;

class CaseGovernmentFormCodesTest extends TestCase
{
    public function test_normalize_strips_spaces_and_hyphens(): void
    {
        $svc = new CaseGovernmentFormCodes;

        $this->assertSame('IMM5406', $svc->normalize('IMM 5406'));
        $this->assertSame('IMM5476', $svc->normalize('imm-5476'));
        $this->assertSame('IMM0008', $svc->normalize('IMM0008'));
        $this->assertSame('', $svc->normalize('Online'));
    }

    public function test_express_entry_pathway_includes_fillable_and_manual_reference(): void
    {
        $case = new CaseFile([
            'immigration_pathway' => 'Express Entry — Federal Skilled Worker',
        ]);

        $resolved = (new CaseGovernmentFormCodes)->resolve($case);

        $this->assertContains('IMM5406', $resolved['fillable']);
        $this->assertContains('IMM5476', $resolved['fillable']);
        $this->assertContains('IMM0008', $resolved['fillable']);
        $this->assertContains('IMM5562', $resolved['fillable']);
        $this->assertContains('IMM5669', $resolved['fillable']);

        $manual = collect($resolved['package_reference'])->where('fillable', false)->pluck('normalized')->all();
        $this->assertSame([], $manual);

        $fillableRefs = collect($resolved['package_reference'])->where('fillable', true)->pluck('normalized')->all();
        $this->assertContains('IMM5406', $fillableRefs);
        $this->assertContains('IMM5476', $fillableRefs);
        $this->assertContains('IMM0008', $fillableRefs);
    }

    public function test_study_and_work_pathways_are_fillable(): void
    {
        $study = (new CaseGovernmentFormCodes)->resolve(new CaseFile([
            'immigration_pathway' => 'Study Permit',
        ]));
        $this->assertContains('IMM1294', $study['fillable']);
        $this->assertContains('IMM5707', $study['fillable']);
        $this->assertContains('IMM5476', $study['fillable']);
        $this->assertSame([], collect($study['package_reference'])->where('fillable', false)->pluck('normalized')->all());

        $work = (new CaseGovernmentFormCodes)->resolve(new CaseFile([
            'immigration_pathway' => 'Work Permit',
        ]));
        $this->assertContains('IMM1295', $work['fillable']);
        $this->assertContains('IMM5707', $work['fillable']);
        $this->assertContains('IMM5476', $work['fillable']);
        $this->assertSame([], collect($work['package_reference'])->where('fillable', false)->pluck('normalized')->all());
    }
}
