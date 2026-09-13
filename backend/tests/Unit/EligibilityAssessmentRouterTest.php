<?php

namespace Tests\Unit;

use App\Support\EligibilityAssessmentRouter;
use PHPUnit\Framework\TestCase;

class EligibilityAssessmentRouterTest extends TestCase
{
    public function test_express_entry_uses_full_crs_calculators(): void
    {
        $route = EligibilityAssessmentRouter::for(null, 'Express Entry', 'ee.cec', 'Express Entry – Canadian Experience Class');

        $this->assertSame('express_entry', $route['mode']);
        $this->assertContains('crs', $route['calculators']);
        $this->assertSame('Express Entry', $route['registry_key']);
    }

    public function test_study_permit_uses_checklist_mode(): void
    {
        $route = EligibilityAssessmentRouter::for(null, 'Study Permit', 'study', 'Study Permit');

        $this->assertSame('checklist', $route['mode']);
        $this->assertContains('study_permit', $route['calculators']);
        $this->assertNotEmpty($route['checklist']);
        $this->assertTrue(collect($route['checklist'])->contains(fn (array $item) => str_contains($item['label'], 'LOA')));
    }
}
