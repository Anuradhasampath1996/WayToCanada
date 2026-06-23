<?php

namespace App\Console\Commands;

use App\Models\LegislationDocument;
use App\Services\LegislationReferenceAiService;
use App\Services\LegislationReferenceRenderService;
use Illuminate\Console\Command;

class RelinkifyLegislationCommand extends Command
{
    protected $signature = 'legislation:relinkify
                            {--document= : Re-linkify a single document ID only}
                            {--ai : Run Analyze & Linkify (OpenAI) before final render}';

    protected $description = 'Re-apply cross-reference linkify to all XML legislation documents';

    public function handle(
        LegislationReferenceRenderService $render,
        LegislationReferenceAiService $ai,
    ): int {
        $query = LegislationDocument::query()
            ->where('format', 'xml')
            ->whereNotNull('rendered_html')
            ->orderBy('id');

        if ($id = $this->option('document')) {
            $query->where('id', (int) $id);
        }

        $documents = $query->get();

        if ($documents->isEmpty()) {
            $this->warn('No XML legislation documents found.');

            return self::FAILURE;
        }

        $this->info('Re-linkifying '.$documents->count().' document(s)...');

        $bar = $this->output->createProgressBar($documents->count());
        $bar->start();

        $totals = ['ok' => 0, 'failed' => 0, 'stripped' => 0];

        foreach ($documents as $document) {
            try {
                if ($this->option('ai')) {
                    $useOpenAi = (bool) config('legislation_sources.openai.enabled')
                        && (bool) config('services.openai.key');
                    $ai->analyzeLinkifyAndCache($document, $useOpenAi);
                    $document->refresh();
                }

                $result = $render->finalizeDocument($document);
                $document->update([
                    'rendered_html' => $result['html'],
                    'ai_analyzed'   => $this->option('ai') ? true : $document->ai_analyzed,
                ]);

                $totals['ok']++;
                $totals['stripped'] += (int) ($result['stripped'] ?? 0);
            } catch (\Throwable $e) {
                $totals['failed']++;
                $this->newLine();
                $this->error("Doc {$document->id} ({$document->act_code}): {$e->getMessage()}");
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Done. Updated: {$totals['ok']}, Failed: {$totals['failed']}, Stripped broken links: {$totals['stripped']}");

        return $totals['failed'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
