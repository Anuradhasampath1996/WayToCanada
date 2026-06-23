<?php

namespace App\Services;

use App\Models\LegislationDocument;

class LegislationHubLinkService
{
    /** @var array<string, array<string, int>>|null */
    private static ?array $viewerCache = null;

    /**
     * @return array{citation: string, act_code: string, provision_key: string, language: string, viewer_document_id: int|null, hub_path: string|null}
     */
    public function buildLink(string $actCode, string $provisionKey, string $language = 'en', ?string $marginalNote = null): array
    {
        $viewerId = $this->viewerDocumentId($actCode, $language);
        $section  = $provisionKey !== '' ? 'Section '.$this->formatSectionLabel($provisionKey) : '';
        $citation = trim($actCode.($section !== '' ? ' — '.$section : ''));

        return [
            'citation'            => $citation,
            'act_code'            => $actCode,
            'provision_key'       => $provisionKey,
            'language'            => $language,
            'marginal_note'       => $marginalNote,
            'viewer_document_id'  => $viewerId,
            'hub_path'            => $viewerId
                ? '/dashboard/legislations/'.$viewerId.'?provision='.rawurlencode($provisionKey)
                : null,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    public function enrichRows(array $rows, string $language = 'en'): array
    {
        return array_map(function (array $row) use ($language) {
            $lang = (string) ($row['language'] ?? $language);
            $link = $this->buildLink(
                (string) ($row['act_code'] ?? ''),
                (string) ($row['provision_key'] ?? ''),
                $lang,
                isset($row['marginal_note']) ? (string) $row['marginal_note'] : null,
            );

            return array_merge($row, $link);
        }, $rows);
    }

    public function viewerDocumentId(string $actCode, string $language = 'en'): ?int
    {
        $map = $this->viewerMap();

        return $map[$actCode][$language] ?? $map[$actCode]['en'] ?? null;
    }

    /** @return array<string, array<string, int>> */
    private function viewerMap(): array
    {
        if (self::$viewerCache !== null) {
            return self::$viewerCache;
        }

        $docs = LegislationDocument::query()
            ->where('format', 'xml')
            ->whereNotNull('rendered_html')
            ->whereNotNull('act_code')
            ->get(['id', 'act_code', 'language']);

        $map = [];
        foreach ($docs as $doc) {
            $map[$doc->act_code][$doc->language] = $doc->id;
        }

        self::$viewerCache = $map;

        return $map;
    }

    private function formatSectionLabel(string $provisionKey): string
    {
        return $provisionKey;
    }
}
