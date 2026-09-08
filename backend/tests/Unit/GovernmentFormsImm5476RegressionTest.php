<?php

namespace Tests\Unit;

use Illuminate\Support\Facades\Process;
use Tests\TestCase;

/**
 * Structural regression for IMM 5476 pdfXFA append-mode output.
 * Does NOT replace Adobe manual acceptance testing.
 */
class GovernmentFormsImm5476RegressionTest extends TestCase
{
    private function repoRoot(): string
    {
        return dirname(__DIR__, 2); // backend/
    }

    private function path(string $relative): string
    {
        return $this->repoRoot().DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relative);
    }

    public function test_imm5476_pdfxfa_append_output_passes_structural_regression(): void
    {
        $original = $this->path('storage/app/private/government-forms-poc/templates/official/imm5476-official-aca5c476b93d.pdf');
        $output = $this->path('storage/app/private/government-forms-poc/output/IMM5476_itext_pdfxfa_append_test.pdf');
        $script = dirname(__DIR__, 3).DIRECTORY_SEPARATOR.'form-processor-poc'.DIRECTORY_SEPARATOR.'python'.DIRECTORY_SEPARATOR.'validate_pdfxfa_output.py';

        if (! is_file($original)) {
            $this->markTestSkipped('Official IMM 5476 template not present. Run: php artisan government-forms:fetch-official IMM5476');
        }

        if (! is_file($output)) {
            $this->markTestSkipped('Adobe-pass output not present. Regenerate with fill-xfa-datasets append command.');
        }

        $result = Process::path($this->repoRoot())
            ->run([
                'python',
                $script,
                'imm5476',
                $original,
                $output,
            ]);

        $this->assertTrue(
            $result->successful(),
            "Structural regression failed:\n".$result->output()."\n".$result->errorOutput()
        );

        $payload = json_decode($result->output(), true);
        $this->assertIsArray($payload);
        $this->assertTrue($payload['passed'] ?? false, implode('; ', $payload['errors'] ?? []));
        $this->assertSame(4, $payload['output_pages'] ?? null);
        $this->assertTrue($payload['datasets_changed'] ?? false);
        $this->assertTrue($payload['output_encrypted'] ?? false);

        foreach ($payload['synthetic_values_in_datasets'] ?? [] as $value => $present) {
            $this->assertTrue($present, "Missing datasets value: {$value}");
        }
    }
}
