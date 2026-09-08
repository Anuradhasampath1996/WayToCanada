<?php

namespace Tests\Unit\GovernmentForms;

use App\Data\GovernmentForms\CanonicalDataSet;
use App\Data\GovernmentForms\FormReadinessResult;
use App\Models\GovernmentFormVersion;
use App\Services\GovernmentForms\FormReadinessService;
use App\Services\GovernmentForms\XfaDatasetBuilder;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FormReadinessServiceTest extends TestCase
{
    #[Test]
    public function it_calculates_readiness_from_required_canonical_fields_only(): void
    {
        $version = new GovernmentFormVersion(['form_code' => 'IMM5476']);

        $canonical = new CanonicalDataSet(
            caseFileId: 1,
            values: [
                'applicant.personal.family_name' => 'Client',
                'applicant.personal.given_names' => 'Test',
                'representative.personal.family_name' => 'RCIC',
                'representative.personal.given_names' => 'Jane',
                'representative.rcic_number' => 'R123456789',
            ],
            sourceHash: 'abc',
            sources: [],
            resolvedAt: Carbon::now(),
            usesSnapshot: true,
        );

        $result = app(FormReadinessService::class)->assess($version, $canonical);

        $this->assertInstanceOf(FormReadinessResult::class, $result);
        $this->assertTrue($result->ready);
        $this->assertSame(100, $result->percentage);
    }
}
