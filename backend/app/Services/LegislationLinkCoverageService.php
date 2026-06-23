<?php

namespace App\Services;

use App\Models\LegislationDocument;
use App\Models\LegislationSyncRun;

class LegislationLinkCoverageService
{
    public function __construct(
        private LegislationReferenceRenderService $render,
    ) {}

    /** @return array{document_id: int, act_code: string|null, language: string, linked: int, gaps: int, coverage_percent: float} */
    public function documentCoverage(LegislationDocument $document): array
    {
        $stats  = $this->render->referenceCacheStats($document);
        $linked = (int) ($stats['linked'] ?? 0);
        $gaps   = (int) (($stats['prefix_gaps'] ?? 0) + ($stats['pending_queue'] ?? 0));
        $denom  = max($linked + $gaps, 1);

        return [
            'document_id'      => $document->id,
            'act_code'         => $document->act_code,
            'language'         => $document->language,
            'linked'           => $linked,
            'gaps'             => $gaps,
            'coverage_percent' => round(($linked / $denom) * 100, 1),
        ];
    }

    /** @return array<string, mixed> */
    public function aggregateCoverage(): array
    {
        $documents = LegislationDocument::query()
            ->where('format', 'xml')
            ->whereNotNull('rendered_html')
            ->get();

        $linked = 0;
        $gaps   = 0;
        $perDoc = [];

        foreach ($documents as $document) {
            $cov = $this->documentCoverage($document);
            $linked += $cov['linked'];
            $gaps += $cov['gaps'];
            $perDoc[] = $cov;
        }

        $denom = max($linked + $gaps, 1);

        return [
            'documents'        => $documents->count(),
            'linked'           => $linked,
            'gaps'             => $gaps,
            'coverage_percent' => round(($linked / $denom) * 100, 1),
            'by_document'      => $perDoc,
        ];
    }

    /** @return array<string, mixed> */
    public function relinkifyAllXml(): array
    {
        $stripped = 0;
        $documents = LegislationDocument::query()
            ->where('format', 'xml')
            ->whereNotNull('storage_path')
            ->get();

        foreach ($documents as $document) {
            $result = $this->render->finalizeDocument($document);
            $document->update(['rendered_html' => $result['html']]);
            $stripped += (int) ($result['stripped'] ?? 0);
        }

        $coverage = $this->aggregateCoverage();

        return array_merge($coverage, ['stripped_broken' => $stripped]);
    }

    /** @return array<string, mixed> */
    public function runAiLinkifyAll(LegislationReferenceAiService $ai, ?LegislationSyncRun $run = null): array
    {
        $useOpenAi = (bool) config('legislation_sources.openai.enabled')
            && (bool) config('services.openai.key');

        $totals = [
            'analyzed'   => 0,
            'linked'     => 0,
            'unresolved' => 0,
            'openai_used'=> $useOpenAi,
        ];

        foreach (LegislationDocument::query()->where('format', 'xml')->cursor() as $document) {
            if ($run) {
                $run->update(['current_step' => "AI linkify: {$document->act_code} ({$document->language})"]);
            }

            $result = $ai->analyzeLinkifyAndCache($document, $useOpenAi);
            $totals['analyzed']++;
            $totals['linked'] += (int) ($result['linked'] ?? 0);
            $totals['unresolved'] += (int) ($result['unresolved'] ?? 0);
        }

        return array_merge($totals, ['coverage' => $this->aggregateCoverage()]);
    }
}
