<?php

namespace Tests\Feature;

use App\Models\DocumentSubmission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesGovernmentFormFixtures;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class DocumentWorkshopTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;
    use CreatesGovernmentFormFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        $this->seedGovernmentFormRoles();
    }

    public function test_sources_lists_usable_active_case_documents_and_hides_other_mimes(): void
    {
        Storage::fake('public');

        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();

        $pdfPath = 'case-documents/passport.pdf';
        Storage::disk('public')->put($pdfPath, $this->minimalPdfBytes());

        DocumentSubmission::create([
            'case_file_id' => $caseFile->id,
            'uploaded_by' => $consultant->id,
            'document_type' => 'passport',
            'document_label' => 'Passport',
            'file_path' => $pdfPath,
            'original_filename' => 'passport.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 120,
            'status' => 'pending_review',
        ]);

        DocumentSubmission::create([
            'case_file_id' => $caseFile->id,
            'uploaded_by' => $consultant->id,
            'document_type' => 'other',
            'document_label' => 'Word Doc',
            'file_path' => 'case-documents/notes.docx',
            'original_filename' => 'notes.docx',
            'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'file_size' => 200,
            'status' => 'pending_review',
        ]);

        $this->actingAsConsultant($consultant);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/document-workshop/sources")
            ->assertOk()
            ->assertJsonPath('case_file_id', $caseFile->id)
            ->assertJsonCount(1, 'documents')
            ->assertJsonPath('documents.0.document_label', 'Passport')
            ->assertJsonPath('documents.0.is_pdf', true);
    }

    public function test_cross_consultant_cannot_access_sources_or_save(): void
    {
        ['profile' => $profile] = $this->createConsultantWithClient();
        $other = User::factory()->create();
        $other->assignRole('rcic');
        $this->actingAsConsultant($other);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/document-workshop/sources")
            ->assertForbidden();

        $this->postJson("/api/v1/consultant/clients/{$profile->id}/document-workshop/save", [
            'document_name' => 'Package',
        ])->assertForbidden();
    }

    public function test_save_stores_pdf_and_creates_approved_workshop_submission(): void
    {
        Storage::fake('public');

        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $caseFile] = $this->createConsultantWithClient();
        $this->actingAsConsultant($consultant);

        $file = UploadedFile::fake()->createWithContent('merged.pdf', $this->minimalPdfBytes());

        $response = $this->post("/api/v1/consultant/clients/{$profile->id}/document-workshop/save", [
            'file' => $file,
            'document_name' => 'IRCC Package Bundle',
            'description' => 'Merged for submission',
        ], [
            'Accept' => 'application/json',
        ]);

        $response->assertCreated()
            ->assertJsonPath('document.document_type', 'workshop_package')
            ->assertJsonPath('document.status', 'consultant_approved')
            ->assertJsonPath('document.document_label', 'IRCC Package Bundle — Merged for submission');

        $submission = DocumentSubmission::query()->findOrFail($response->json('document.id'));
        $this->assertSame($caseFile->id, $submission->case_file_id);
        $this->assertSame($consultant->id, $submission->uploaded_by);
        $this->assertSame('application/pdf', $submission->mime_type);
        Storage::disk('public')->assertExists($submission->file_path);
    }

    public function test_sources_lists_documents_from_all_client_cases_when_active_differs(): void
    {
        Storage::fake('public');

        ['consultant' => $consultant, 'profile' => $profile, 'caseFile' => $activeCase] = $this->createConsultantWithClient();

        $otherCase = \App\Models\CaseFile::create([
            'client_profile_id' => $profile->id,
            'consultant_id' => $consultant->id,
            'case_number' => 2,
            'name' => 'Older case',
            'status' => 'active',
            'lifecycle_status' => 'closed',
        ]);

        $pdfPath = 'case-documents/older-passport.pdf';
        Storage::disk('public')->put($pdfPath, $this->minimalPdfBytes());

        DocumentSubmission::create([
            'case_file_id' => $otherCase->id,
            'uploaded_by' => $consultant->id,
            'document_type' => 'passport',
            'document_label' => 'Passport from closed case',
            'file_path' => $pdfPath,
            'original_filename' => 'passport.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 120,
            'status' => 'pending_review',
        ]);

        $this->assertSame($activeCase->id, $profile->fresh()->active_case_file_id);
        $this->actingAsConsultant($consultant);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/document-workshop/sources")
            ->assertOk()
            ->assertJsonCount(1, 'documents')
            ->assertJsonPath('documents.0.document_label', 'Passport from closed case')
            ->assertJsonPath('documents.0.source_kind', 'case_document');
    }

    public function test_sources_includes_questionnaire_intake_uploads(): void
    {
        Storage::fake('public');
        Storage::fake('local');

        ['consultant' => $consultant, 'profile' => $profile, 'clientUser' => $clientUser] = $this->createConsultantWithClient();

        $path = 'client-document/2026/09/passport-main.pdf';
        Storage::disk('local')->put($path, $this->minimalPdfBytes());

        \App\Models\QuestionnaireSubmission::where('user_id', $clientUser->id)->update([
            'main_data' => [
                'passportFullName' => 'Synthetic Client',
                'passportName' => $path,
            ],
        ]);

        $this->actingAsConsultant($consultant);

        $this->getJson("/api/v1/consultant/clients/{$profile->id}/document-workshop/sources")
            ->assertOk()
            ->assertJsonFragment([
                'source_kind' => 'questionnaire',
                'document_label' => 'Main applicant — Passport',
                'original_filename' => 'passport-main.pdf',
            ]);
    }

    private function minimalPdfBytes(): string
    {
        return "%PDF-1.4\n"
            ."1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"
            ."2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n"
            ."3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj\n"
            ."xref\n0 4\n0000000000 65535 f \n"
            ."trailer<< /Size 4 /Root 1 0 R >>\n"
            ."startxref\n0\n%%EOF\n";
    }
}
