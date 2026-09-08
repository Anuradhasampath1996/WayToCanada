<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

class GovernmentFormsInspectCommand extends Command
{
    protected $signature = 'government-forms:inspect
        {template? : Path to PDF or storage-relative path under government-forms-poc}
        {--form=IMM5476 : Form code when auto-resolving latest official template}
        {--output= : Optional JSON output path relative to storage/app/private}';

    protected $description = 'Inspect an official government PDF template (PoC A — read-only).';

    public function handle(): int
    {
        $template = $this->resolveTemplatePath();
        if (! $template) {
            return self::FAILURE;
        }

        $this->info("Inspecting: {$template}");

        $python = $this->findPython();
        if (! $python) {
            $this->error('Python 3 with PyMuPDF not found. Install pymupdf in the active Python environment.');

            return self::FAILURE;
        }

        $script = dirname(base_path()).'/form-processor-poc/python/inspect_pdf.py';
        if (! file_exists($script)) {
            $this->error('Missing inspect script: '.$script);

            return self::FAILURE;
        }

        $outputArg = '';
        $outputRelative = $this->option('output')
            ?: 'government-forms-poc/reports/'.basename($template, '.pdf').'-inspection.json';
        $outputFull = storage_path('app/private/'.$outputRelative);
        @mkdir(dirname($outputFull), 0777, true);
        $outputArg = $outputFull;

        $result = Process::timeout(120)->run([
            $python,
            $script,
            $template,
            $outputArg,
        ]);

        $this->output->write($result->output());
        if ($result->errorOutput()) {
            $this->error($result->errorOutput());
        }

        if (! $result->successful()) {
            return self::FAILURE;
        }

        $this->newLine();
        $this->info('Inspection report saved: storage/app/private/'.$outputRelative);

        return self::SUCCESS;
    }

    private function resolveTemplatePath(): ?string
    {
        $arg = $this->argument('template');
        if ($arg) {
            if (file_exists($arg)) {
                return realpath($arg) ?: $arg;
            }
            $private = storage_path('app/private/'.$arg);
            if (file_exists($private)) {
                return $private;
            }
            $this->error('Template not found: '.$arg);

            return null;
        }

        $normalized = strtolower(preg_replace('/\s+/', '', $this->option('form')));
        $manifestPath = 'government-forms-poc/templates/official/'.$normalized.'-manifest.json';
        if (Storage::disk('local')->exists($manifestPath)) {
            $manifest = json_decode(Storage::disk('local')->get($manifestPath), true);
            $relative = $manifest['storage_path'] ?? null;
            if ($relative && Storage::disk('local')->exists($relative)) {
                return storage_path('app/private/'.$relative);
            }
        }

        $this->warn('No cached official template found. Run: php artisan government-forms:fetch-official '.$this->option('form'));

        return null;
    }

    private function findPython(): ?string
    {
        foreach (['python', 'python3', 'py'] as $bin) {
            $check = Process::run([$bin, '-c', 'import fitz']);
            if ($check->successful()) {
                return $bin;
            }
        }

        return null;
    }
}
