<?php

namespace Tests\Unit\GovernmentForms;

use App\Support\GovernmentForms\Imm1294MappingDefinitions;
use App\Support\GovernmentForms\Imm5562MappingDefinitions;
use App\Support\GovernmentForms\Imm5707MappingDefinitions;
use Tests\TestCase;

class ImmStudyWorkAndTravelMappingDefinitionsTest extends TestCase
{
    public function test_imm5562_includes_three_travel_rows(): void
    {
        $keys = array_column(Imm5562MappingDefinitions::all(), 0);

        $this->assertContains('applicant.personal.family_name', $keys);
        $this->assertContains('applicant.travel.0.from_date', $keys);
        $this->assertContains('applicant.travel.2.destination', $keys);
    }

    public function test_imm1294_c1_identity_and_contact(): void
    {
        $keys = array_column(Imm1294MappingDefinitions::all(), 0);

        $this->assertContains('applicant.personal.family_name', $keys);
        $this->assertContains('applicant.contact.email', $keys);
        $this->assertContains('applicant.language.native', $keys);
        $this->assertContains('applicant.passport.number', $keys);
    }

    public function test_imm5707_c1_family_slots(): void
    {
        $keys = array_column(Imm5707MappingDefinitions::all(), 0);

        $this->assertContains('applicant.personal.family_name', $keys);
        $this->assertContains('applicant.family.spouse.family_name', $keys);
        $this->assertContains('applicant.family.parent1.family_name', $keys);
        $this->assertContains('applicant.family.children.0.given_names', $keys);
    }
}
