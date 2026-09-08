<?php

namespace Tests\Unit\GovernmentForms;

use App\Data\GovernmentForms\CanonicalDataSet;
use App\Services\GovernmentForms\Imm5406FamilyCapacityService;
use Tests\TestCase;

class Imm5406FamilyCapacityServiceTest extends TestCase
{
    public function test_it_blocks_when_children_exceed_template_capacity(): void
    {
        $canonical = new CanonicalDataSet(
            caseFileId: 1,
            values: [
                'applicant.family.children.0.given_names' => 'A',
                'applicant.family.children.1.given_names' => 'B',
                'applicant.family.children.2.given_names' => 'C',
                'applicant.family.children.3.given_names' => 'D',
            ],
            sourceHash: 'test',
            sources: [],
            resolvedAt: now(),
            usesSnapshot: false,
        );

        $result = app(Imm5406FamilyCapacityService::class)->assess($canonical);

        $this->assertTrue($result['blocked']);
        $this->assertSame('children', $result['warnings'][0]['section']);
        $this->assertSame(4, $result['warnings'][0]['count']);
    }

    public function test_it_blocks_when_more_than_two_parents_are_mapped(): void
    {
        $canonical = new CanonicalDataSet(
            caseFileId: 1,
            values: [
                'applicant.family.parent1.given_names' => 'P1',
                'applicant.family.parent2.given_names' => 'P2',
                'applicant.family.parents_overflow.2.given_names' => 'P3',
            ],
            sourceHash: 'test',
            sources: [],
            resolvedAt: now(),
            usesSnapshot: false,
        );

        $result = app(Imm5406FamilyCapacityService::class)->assess($canonical);

        $this->assertTrue($result['blocked']);
        $this->assertSame('parents', $result['warnings'][0]['section']);
    }

    public function test_it_passes_when_family_counts_fit_capacity(): void
    {
        $canonical = new CanonicalDataSet(
            caseFileId: 1,
            values: [
                'applicant.family.children.0.given_names' => 'Child',
                'applicant.family.siblings.0.given_names' => 'Sibling',
                'applicant.family.parent1.given_names' => 'Parent1',
                'applicant.family.parent2.given_names' => 'Parent2',
            ],
            sourceHash: 'test',
            sources: [],
            resolvedAt: now(),
            usesSnapshot: false,
        );

        $result = app(Imm5406FamilyCapacityService::class)->assess($canonical);

        $this->assertFalse($result['blocked']);
        $this->assertSame([], $result['warnings']);
    }
}
