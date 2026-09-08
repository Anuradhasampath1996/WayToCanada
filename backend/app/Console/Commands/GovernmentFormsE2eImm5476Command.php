<?php

namespace App\Console\Commands;

use App\Models\ClientProfile;
use App\Services\GovernmentForms\ApplicationInfoReviewService;
use App\Services\GovernmentForms\FormGenerationService;
use App\Services\GovernmentForms\GovernmentFormGenerationException;
use Illuminate\Console\Command;

class GovernmentFormsE2eImm5476Command extends Command
{
    protected $signature = 'government-forms:e2e-imm5476
        {profile : Client profile ID to use}
        {--consultant= : Consultant user ID (defaults to profile consultant)}';

    protected $description = 'Run end-to-end IMM 5476 generation through Laravel → Java processor → private storage.';

    public function handle(
        ApplicationInfoReviewService $reviewService,
        FormGenerationService $generationService,
    ): int {
        $profile = ClientProfile::with(['consultant', 'caseFile', 'user'])->findOrFail($this->argument('profile'));
        $consultant = $profile->consultant;

        if ($this->option('consultant')) {
            $consultant = \App\Models\User::findOrFail($this->option('consultant'));
        }

        if (! $consultant) {
            $this->error('No consultant found for profile.');

            return self::FAILURE;
        }

        if (! is_file(config('government_forms.processor.jar_path'))) {
            $this->warn('Building Java processor JAR...');
            passthru('mvn -f '.escapeshellarg(dirname(base_path()).'/form-processor-poc/java-itext/pom.xml').' package -DskipTests', $code);
            if ($code !== 0) {
                return self::FAILURE;
            }
        }

        $templatePath = storage_path('app/private/government-forms-poc/templates/official/imm5476-official-aca5c476b93d.pdf');
        if (! is_file($templatePath)) {
            $this->call('government-forms:fetch-official', ['form' => 'IMM5476']);
        }

        $this->call('db:seed', ['--class' => 'Database\\Seeders\\GovernmentFormVersionSeeder']);

        if (! $reviewService->isReviewed($profile->caseFile)) {
            $reviewService->markReviewed($profile->caseFile, $consultant);
            $this->info('Application information reviewed.');
        }

        try {
            $result = $generationService->generate($consultant, $profile, 'IMM5476');
        } catch (GovernmentFormGenerationException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $submission = $result['submission'];
        $this->info('E2E generation succeeded.');
        $this->line('Submission ID: '.$submission->id);
        $this->line('Private path: storage/app/private/'.$submission->file_path);
        $this->line('Source data hash: '.$submission->source_data_hash);
        $this->line('Output SHA-256: '.$submission->output_sha256);

        return self::SUCCESS;
    }
}
