<?php

namespace Tests\Unit;

use App\Support\ImmigrationPathwayLabels;
use PHPUnit\Framework\TestCase;

class ImmigrationPathwayLabelsTest extends TestCase
{
    public function test_pnp_non_express_entry_label_is_not_express_entry(): void
    {
        $this->assertFalse(
            ImmigrationPathwayLabels::mentionsExpressEntry(
                'Provincial Nominee Program (PNP - Non-Express Entry)'
            )
        );
        $this->assertTrue(
            ImmigrationPathwayLabels::mentionsPnp(
                'Provincial Nominee Program (PNP - Non-Express Entry)'
            )
        );
        $this->assertTrue(
            ImmigrationPathwayLabels::mentionsExpressEntry(
                'Express Entry (FSW, CEC, FST)'
            )
        );
    }
}
