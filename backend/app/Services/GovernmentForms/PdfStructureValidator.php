<?php

namespace App\Services\GovernmentForms;

use App\Contracts\GovernmentForms\GovernmentPdfEngine;

class PdfStructureValidator
{
    public function __construct(
        private GovernmentPdfEngine $pdfEngine,
    ) {}

    /**
     * @return array{passed: bool, report: array<string, mixed>}
     */
    public function validateImm5476(string $templatePath, string $outputPath): array
    {
        $compare = $this->pdfEngine->validateStructure($templatePath, $outputPath);

        $passed = ($compare['filled_xfa_present'] ?? false) === true
            && ($compare['page_count_match'] ?? false) === true
            && ($compare['filled_pages'] ?? 0) >= 1
            && ($compare['filled_size'] ?? 0) > ($compare['source_size'] ?? 0);

        if ($passed && config('government_forms.processor.use_poc_python_validator', false)) {
            $poc = $this->runPocPythonValidator($templatePath, $outputPath);
            if (! $poc['passed']) {
                return $poc;
            }
        }

        return ['passed' => $passed, 'report' => $compare];
    }

    /**
     * @return array{passed: bool, report: array<string, mixed>}
     */
    public function validateImm5406(string $templatePath, string $outputPath): array
    {
        $compare = $this->pdfEngine->validateStructure($templatePath, $outputPath);

        $passed = ($compare['filled_xfa_present'] ?? false) === true
            && ($compare['page_count_match'] ?? false) === true
            && ($compare['filled_pages'] ?? 0) >= 1
            && ($compare['filled_size'] ?? 0) > ($compare['source_size'] ?? 0);

        return ['passed' => $passed, 'report' => $compare];
    }

    /** @return array{passed: bool, report: array<string, mixed>} */
    private function runPocPythonValidator(string $templatePath, string $outputPath): array
    {
        $script = config('government_forms.processor.validation_script');
        if (! is_file($script)) {
            return ['passed' => true, 'report' => ['skipped' => true]];
        }

        $result = \Illuminate\Support\Facades\Process::timeout(60)->run([
            config('government_forms.processor.python_binary', 'python'),
            $script,
            'imm5476',
            $templatePath,
            $outputPath,
        ]);

        if (! $result->successful()) {
            return ['passed' => false, 'report' => ['error' => $result->errorOutput()]];
        }

        $report = json_decode($result->output(), true) ?? [];

        return ['passed' => (bool) ($report['passed'] ?? false), 'report' => $report];
    }
}
