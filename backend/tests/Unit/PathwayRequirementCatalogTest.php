<?php

namespace Tests\Unit;

use App\Support\PathwayRequirementCatalog;
use PHPUnit\Framework\TestCase;

class PathwayRequirementCatalogTest extends TestCase
{
    public function test_imm5476_is_not_hard_coded_required_for_every_family(): void
    {
        $defs = PathwayRequirementCatalog::definitions();

        $this->assertSame('required', $defs['Express Entry']['representative']['default']);
        $this->assertSame('optional', $defs['Visitor']['representative']['default']);
        $this->assertSame('optional', $defs['Citizenship']['representative']['default']);
        $this->assertSame('optional', $defs['PR Card']['representative']['default']);
        $this->assertSame('optional', $defs['default']['representative']['default']);
    }

    public function test_resolve_key_uses_family_aliases(): void
    {
        $this->assertSame('Express Entry', PathwayRequirementCatalog::resolveKey('ee.cec', 'Express Entry', 'Express Entry – Canadian Experience Class'));
        $this->assertSame('Family Sponsorship – PGP', PathwayRequirementCatalog::resolveKey('family.pgp', null, null));
        $this->assertSame('Study Permit', PathwayRequirementCatalog::resolveKey(null, 'Study Permit', 'Study permit from outside Canada'));
        $this->assertSame('default', PathwayRequirementCatalog::resolveKey(null, null, 'Unknown custom stream'));
    }

    public function test_acknowledgement_is_required_and_signature_is_process_specific(): void
    {
        $defs = PathwayRequirementCatalog::definitions();
        $this->assertTrue($defs['Express Entry']['client_acknowledgement_required']);
        $this->assertTrue($defs['Visitor']['client_acknowledgement_required']);
        $this->assertTrue($defs['Express Entry']['client_signature_required']);
        $this->assertFalse($defs['default']['client_signature_required']);
    }
}
