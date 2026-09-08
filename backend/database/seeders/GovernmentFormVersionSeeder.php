<?php

namespace Database\Seeders;

use App\Enums\GovernmentFormMappingStatus;
use App\Enums\GovernmentFormPdfTechnology;
use App\Enums\GovernmentFormSubmissionMode;
use App\Enums\GovernmentFormVersionStatus;
use App\Models\GovernmentFormMapping;
use App\Models\GovernmentFormVersion;
use App\Support\GovernmentForms\Imm0008MappingDefinitions;
use App\Support\GovernmentForms\Imm1294MappingDefinitions;
use App\Support\GovernmentForms\Imm1295MappingDefinitions;
use App\Support\GovernmentForms\Imm5406MappingDefinitions;
use App\Support\GovernmentForms\Imm5476MappingDefinitions;
use App\Support\GovernmentForms\Imm5562MappingDefinitions;
use App\Support\GovernmentForms\Imm5669MappingDefinitions;
use App\Support\GovernmentForms\Imm5707MappingDefinitions;
use Illuminate\Database\Seeder;

class GovernmentFormVersionSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedImm5476();
        $this->seedImm5406();
        $this->seedImm0008();
        $this->seedImm5562();
        $this->seedImm5669();
        $this->seedImm1294();
        $this->seedImm1295();
        $this->seedImm5707();
    }

    private function seedImm5476(): void
    {
        $version = GovernmentFormVersion::updateOrCreate(
            ['form_code' => 'IMM5476', 'version_label' => '11-2025'],
            [
                'name'                  => 'Use of a Representative',
                'government_authority'  => 'IRCC',
                'official_url'          => 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5476/01-11-2025/imm5476e.pdf',
                'template_storage_path' => 'government-forms-poc/templates/official/imm5476-official-aca5c476b93d.pdf',
                'template_sha256'       => 'aca5c476b93d1c496b1afbc2cfe843499e852e31dcf0c192153bd01f8d6c56c4',
                'pdf_technology'        => GovernmentFormPdfTechnology::ACROFORM_XFA_HYBRID,
                'submission_mode'       => GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
                'engine_strategy'       => 'pdfxfa_append',
                'mapping_version'       => '1.2.1',
                'mapping_status'        => GovernmentFormMappingStatus::VERIFIED,
                'status'                => GovernmentFormVersionStatus::ACTIVE,
                'compatibility_status'  => 'SUPPORTED',
                'last_verified_at'      => now(),
                'effective_date'        => '2025-11-01',
                'notes'                 => 'Merge mapped values into full IMM5476 XFA datasets skeleton for Adobe binding.',
            ]
        );

        $this->seedMappings($version, Imm5476MappingDefinitions::all());
    }

    private function seedImm5406(): void
    {
        $version = GovernmentFormVersion::updateOrCreate(
            ['form_code' => 'IMM5406', 'version_label' => '05-2026'],
            [
                'name'                  => 'Additional Family Information',
                'government_authority'  => 'IRCC',
                'official_url'          => 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5406/01-05-2026/imm5406e.pdf',
                'template_storage_path' => 'government-forms-poc/templates/official/imm5406-official-4f544818e48b.pdf',
                'template_sha256'       => '4f544818e48b7355b2b7bb0dc89feed47fdd7e7ce836075b5d3c9489ed315b27',
                'pdf_technology'        => GovernmentFormPdfTechnology::XFA_DYNAMIC,
                'submission_mode'       => GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
                'engine_strategy'       => 'pdfxfa_append',
                'mapping_version'       => '1.0.0',
                'mapping_status'        => GovernmentFormMappingStatus::VERIFIED,
                'status'                => GovernmentFormVersionStatus::ACTIVE,
                'compatibility_status'  => 'SUPPORTED',
                'last_verified_at'      => now(),
                'effective_date'        => '2026-05-01',
                'notes'                 => 'Stage H integrated — repeatable family mappings with overflow detection.',
            ]
        );

        $this->seedMappings($version, Imm5406MappingDefinitions::all());
    }

    private function seedImm0008(): void
    {
        $version = GovernmentFormVersion::updateOrCreate(
            ['form_code' => 'IMM0008', 'version_label' => '05-2026'],
            [
                'name'                  => 'Generic Application Form for Canada',
                'government_authority'  => 'IRCC',
                'official_url'          => 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm0008/01-05-2026/imm0008e.pdf',
                'template_storage_path' => 'government-forms-poc/templates/official/imm0008-official-2560489b5716.pdf',
                'template_sha256'       => '2560489b57160f59c54a58d2f837d220a0426285ec17465c487b6fe2a5f63285',
                'pdf_technology'        => GovernmentFormPdfTechnology::XFA_DYNAMIC,
                'submission_mode'       => GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
                'engine_strategy'       => 'pdfxfa_append',
                'mapping_version'       => '0.3.0-c3',
                'mapping_status'        => GovernmentFormMappingStatus::VERIFIED,
                'status'                => GovernmentFormVersionStatus::ACTIVE,
                'compatibility_status'  => 'SUPPORTED',
                'last_verified_at'      => now(),
                'effective_date'        => '2026-05-01',
                'notes'                 => 'Phase C3 — C2 + native/communicate languages.',
            ]
        );

        $this->seedMappings($version, Imm0008MappingDefinitions::all());
    }

    private function seedImm5562(): void
    {
        $version = GovernmentFormVersion::updateOrCreate(
            ['form_code' => 'IMM5562', 'version_label' => '07-2024'],
            [
                'name'                  => 'Supplementary Information — Your Travels',
                'government_authority'  => 'IRCC',
                'official_url'          => 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5562/01-07-2024/imm5562e.pdf',
                'template_storage_path' => 'government-forms-poc/templates/official/imm5562-official-aeb0b9ae7322.pdf',
                'template_sha256'       => 'aeb0b9ae7322c847b03429fcf8c05efb595d59f5992bd54b1d67fd0b2bd3d52e',
                'pdf_technology'        => GovernmentFormPdfTechnology::XFA_DYNAMIC,
                'submission_mode'       => GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
                'engine_strategy'       => 'pdfxfa_append',
                'mapping_version'       => '0.2.0-c2',
                'mapping_status'        => GovernmentFormMappingStatus::VERIFIED,
                'status'                => GovernmentFormVersionStatus::ACTIVE,
                'compatibility_status'  => 'SUPPORTED',
                'last_verified_at'      => now(),
                'effective_date'        => '2024-07-01',
                'notes'                 => 'C2 — name + up to 3 travelHistory rows (main_data.travelHistory).',
            ]
        );

        $this->seedMappings($version, Imm5562MappingDefinitions::all());
    }

    private function seedImm5669(): void
    {
        $version = GovernmentFormVersion::updateOrCreate(
            ['form_code' => 'IMM5669', 'version_label' => '05-2021'],
            [
                'name'                  => 'Schedule A — Background/Declaration',
                'government_authority'  => 'IRCC',
                'official_url'          => 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5669/01-05-2021/imm5669e.pdf',
                'template_storage_path' => 'government-forms-poc/templates/official/imm5669-official-4bdc23bb6a9d.pdf',
                'template_sha256'       => '4bdc23bb6a9dfa3731927f9b93295fb14008ee504d02b3037e349c4cda421f7a',
                'pdf_technology'        => GovernmentFormPdfTechnology::XFA_DYNAMIC,
                'submission_mode'       => GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
                'engine_strategy'       => 'pdfxfa_append',
                'mapping_version'       => '0.1.0-c1',
                'mapping_status'        => GovernmentFormMappingStatus::VERIFIED,
                'status'                => GovernmentFormVersionStatus::ACTIVE,
                'compatibility_status'  => 'SUPPORTED',
                'last_verified_at'      => now(),
                'effective_date'        => '2021-05-01',
                'notes'                 => 'C1 — name/DOB/parents. Engine injects missing datasets packet before fill (Designer 6.2).',
            ]
        );

        $this->seedMappings($version, Imm5669MappingDefinitions::all());
    }

    private function seedImm1294(): void
    {
        $version = GovernmentFormVersion::updateOrCreate(
            ['form_code' => 'IMM1294', 'version_label' => '06-2026'],
            [
                'name'                  => 'Application for a Study Permit Made Outside of Canada',
                'government_authority'  => 'IRCC',
                'official_url'          => 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm1294/01-06-2026/imm1294e.pdf',
                'template_storage_path' => 'government-forms-poc/templates/official/imm1294-official-394c745501ef.pdf',
                'template_sha256'       => '394c745501ef87e46a0b15618ca342387ca06c5b2f226face2956b0372047d09',
                'pdf_technology'        => GovernmentFormPdfTechnology::XFA_DYNAMIC,
                'submission_mode'       => GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
                'engine_strategy'       => 'pdfxfa_append',
                'mapping_version'       => '0.1.0-c1',
                'mapping_status'        => GovernmentFormMappingStatus::VERIFIED,
                'status'                => GovernmentFormVersionStatus::ACTIVE,
                'compatibility_status'  => 'SUPPORTED',
                'last_verified_at'      => now(),
                'effective_date'        => '2026-06-01',
                'notes'                 => 'Phase C1 — identity, spouse name, languages, passport, phone/email.',
            ]
        );

        $this->seedMappings($version, Imm1294MappingDefinitions::all());
    }

    private function seedImm1295(): void
    {
        $version = GovernmentFormVersion::updateOrCreate(
            ['form_code' => 'IMM1295', 'version_label' => '09-2023'],
            [
                'name'                  => 'Application for a Work Permit Made Outside of Canada',
                'government_authority'  => 'IRCC',
                'official_url'          => 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm1295/01-09-2023/imm1295e.pdf',
                'template_storage_path' => 'government-forms-poc/templates/official/imm1295-official-57fc256eef7d.pdf',
                'template_sha256'       => '57fc256eef7d9d856e4ae85ebf8bfe80da41833ebde7a8c7ed78f2483470d7bb',
                'pdf_technology'        => GovernmentFormPdfTechnology::XFA_DYNAMIC,
                'submission_mode'       => GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
                'engine_strategy'       => 'pdfxfa_append',
                'mapping_version'       => '0.1.0-c1',
                'mapping_status'        => GovernmentFormMappingStatus::VERIFIED,
                'status'                => GovernmentFormVersionStatus::ACTIVE,
                'compatibility_status'  => 'SUPPORTED',
                'last_verified_at'      => now(),
                'effective_date'        => '2023-09-01',
                'notes'                 => 'Phase C1 — identity, spouse name, languages, passport, phone/email.',
            ]
        );

        $this->seedMappings($version, Imm1295MappingDefinitions::all());
    }

    private function seedImm5707(): void
    {
        $version = GovernmentFormVersion::updateOrCreate(
            ['form_code' => 'IMM5707', 'version_label' => '01-2023'],
            [
                'name'                  => 'Family Information — Visitors, Students and Workers',
                'government_authority'  => 'IRCC',
                'official_url'          => 'https://www.canada.ca/content/dam/ircc/documents/pdf/english/kits/forms/imm5707/01-01-2023/imm5707e.pdf',
                'template_storage_path' => 'government-forms-poc/templates/official/imm5707-official-6e59d35048ef.pdf',
                'template_sha256'       => '6e59d35048ef3995e1d4583f08c38a710a351e23b1cc0fbfe517d82f38cb20ef',
                'pdf_technology'        => GovernmentFormPdfTechnology::XFA_DYNAMIC,
                'submission_mode'       => GovernmentFormSubmissionMode::PDF_AUTO_FILL_ADOBE_VALIDATE,
                'engine_strategy'       => 'pdfxfa_append',
                'mapping_version'       => '0.1.0-c1',
                'mapping_status'        => GovernmentFormMappingStatus::VERIFIED,
                'status'                => GovernmentFormVersionStatus::ACTIVE,
                'compatibility_status'  => 'SUPPORTED',
                'last_verified_at'      => now(),
                'effective_date'        => '2023-01-01',
                'notes'                 => 'Phase C1 — applicant/spouse/parents/first child name+DOB+COB.',
            ]
        );

        $this->seedMappings($version, Imm5707MappingDefinitions::all());
    }

    /**
     * @param  array<int, array{0: string, 1: string, 2: bool, 3?: string}>  $mappings
     */
    private function seedMappings(GovernmentFormVersion $version, array $mappings): void
    {
        foreach ($mappings as $index => $row) {
            [$canonicalKey, $pdfPath, $required] = $row;
            $explicitTransformer = $row[3] ?? null;

            GovernmentFormMapping::updateOrCreate(
                [
                    'government_form_version_id' => $version->id,
                    'canonical_key'              => $canonicalKey,
                    'pdf_field_path'             => $pdfPath,
                ],
                [
                    'field_type'      => str_contains($canonicalKey, 'date_of_birth') ? 'date' : 'text',
                    'transformer'     => $explicitTransformer ?? match (true) {
                        str_contains($canonicalKey, 'date_of_birth') => 'date',
                        str_contains($canonicalKey, 'family_name'), str_contains($canonicalKey, 'given_names') => 'name',
                        str_ends_with($canonicalKey, '.uci') || $canonicalKey === 'uci' => 'uci',
                        default => 'text',
                    },
                    'is_required'     => $required,
                    'sort_order'      => $index,
                    'mapping_version' => $version->mapping_version,
                ]
            );
        }
    }
}
