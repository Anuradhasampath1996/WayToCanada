<?php

namespace Tests\Unit;

use App\Models\QuestionnaireSubmission;
use App\Services\QuestionnaireFieldRemarkService;
use Tests\TestCase;

class QuestionnaireFieldRemarkServiceTest extends TestCase
{
    public function test_resolves_when_value_differs_from_value_at_request(): void
    {
        $service = new QuestionnaireFieldRemarkService;
        $submission = new QuestionnaireSubmission;
        $submission->forceFill([
            'step1_data' => ['whatsapp' => '+10000000000'],
            'field_remarks' => [
                'step1_data.whatsapp' => [
                    'remark' => 'Fix WhatsApp',
                    'status' => 'pending',
                    'value_at_request' => '+10000000000',
                ],
            ],
        ]);

        [$remarks, $resolved] = $service->resolveChangedRemarks($submission, [
            'step1_data' => ['whatsapp' => '+14165551234'],
        ]);

        $this->assertSame(['step1_data.whatsapp'], $resolved);
        $this->assertSame('resolved', $remarks['step1_data.whatsapp']['status']);
    }

    public function test_keeps_pending_when_value_unchanged(): void
    {
        $service = new QuestionnaireFieldRemarkService;
        $submission = new QuestionnaireSubmission;
        $submission->forceFill([
            'step1_data' => ['whatsapp' => '+10000000000'],
            'field_remarks' => [
                'step1_data.whatsapp' => [
                    'remark' => 'Fix WhatsApp',
                    'status' => 'pending',
                    'value_at_request' => '+10000000000',
                ],
            ],
        ]);

        [$remarks, $resolved] = $service->resolveChangedRemarks($submission, [
            'step1_data' => ['whatsapp' => '+10000000000', 'fullName' => 'Other'],
        ]);

        $this->assertSame([], $resolved);
        $this->assertSame('pending', $remarks['step1_data.whatsapp']['status']);
    }

    public function test_legacy_remark_uses_current_stored_value_as_baseline(): void
    {
        $service = new QuestionnaireFieldRemarkService;
        $submission = new QuestionnaireSubmission;
        $submission->forceFill([
            'step1_data' => ['whatsapp' => 'old'],
            'field_remarks' => [
                'step1_data.whatsapp' => [
                    'remark' => 'Fix WhatsApp',
                    'status' => 'pending',
                ],
            ],
        ]);

        [$remarks, $resolved] = $service->resolveChangedRemarks($submission, [
            'step1_data' => ['whatsapp' => 'new'],
        ]);

        $this->assertSame(['step1_data.whatsapp'], $resolved);
        $this->assertSame('resolved', $remarks['step1_data.whatsapp']['status']);
    }
}
