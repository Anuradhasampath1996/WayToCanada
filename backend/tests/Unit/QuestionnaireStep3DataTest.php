<?php

namespace Tests\Unit;

use App\Models\QuestionnaireSubmission;
use App\Support\QuestionnaireStep3Data;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class QuestionnaireStep3DataTest extends TestCase
{
    #[Test]
    public function it_prefers_canonical_step3_data_column(): void
    {
        $submission = new QuestionnaireSubmission([
            'step3_data' => [
                'hasVisaRefusal' => 'yes',
                'hasCriminalRecord' => 'no',
            ],
            'accompanying_data' => [
                'step3' => ['hasVisaRefusal' => 'no'],
            ],
        ]);

        $resolved = QuestionnaireStep3Data::resolve($submission);

        $this->assertSame('yes', $resolved['hasVisaRefusal']);
        $this->assertSame('no', $resolved['hasCriminalRecord']);
    }

    #[Test]
    public function it_falls_back_to_legacy_accompanying_step3(): void
    {
        $submission = new QuestionnaireSubmission([
            'accompanying_data' => [
                'step3' => [
                    'hasMedicalCondition' => 'yes',
                    'intlTestTaken' => 'yes',
                ],
            ],
        ]);

        $resolved = QuestionnaireStep3Data::resolve($submission);

        $this->assertSame('yes', $resolved['hasMedicalCondition']);
        $this->assertSame('yes', $resolved['intlTestTaken']);
    }

    #[Test]
    public function it_falls_back_to_step1_inadmissibility_flags_when_step3_missing(): void
    {
        $submission = new QuestionnaireSubmission([
            'step1_data' => [
                'hasVisaRefusal' => 'yes',
                'hasCriminalRecord' => 'yes',
            ],
        ]);

        $resolved = QuestionnaireStep3Data::resolve($submission);

        $this->assertSame('yes', $resolved['hasVisaRefusal']);
        $this->assertSame('yes', $resolved['hasCriminalRecord']);
    }

    #[Test]
    public function legacy_nested_step3_does_not_override_canonical_keys(): void
    {
        $submission = new QuestionnaireSubmission([
            'step3_data' => ['hasVisaRefusal' => 'no'],
            'accompanying_data' => ['step3' => ['hasVisaRefusal' => 'yes']],
        ]);

        $this->assertSame('no', QuestionnaireStep3Data::resolve($submission)['hasVisaRefusal']);
    }

    #[Test]
    public function normalize_for_storage_converts_empty_array_to_null(): void
    {
        $this->assertNull(QuestionnaireStep3Data::normalizeForStorage([]));
        $this->assertSame(['hasVisaRefusal' => 'yes'], QuestionnaireStep3Data::normalizeForStorage(['hasVisaRefusal' => 'yes']));
    }
}
