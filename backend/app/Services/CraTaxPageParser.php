<?php

namespace App\Services;

class CraTaxPageParser
{
    /**
     * Extract hints from CRA HTML for change monitoring (not authoritative parsing).
     *
     * @return array{title: string|null, rate_mentions: string[], table_rows: int}
     */
    public function parse(string $html, string $key): array
    {
        $title = null;
        if (preg_match('/<title[^>]*>([^<]+)<\/title>/i', $html, $m)) {
            $title = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5);
        }

        $rateMentions = [];
        if (preg_match_all('/\b(\d{1,2}(?:\.\d+)?)\s*%/u', $html, $matches)) {
            $rateMentions = array_values(array_unique(array_map(
                fn ($r) => rtrim($r, '.') . '%',
                $matches[1]
            )));
            $rateMentions = array_slice($rateMentions, 0, 12);
        }

        $tableRows = 0;
        if (preg_match_all('/<tr\b/i', $html, $tr)) {
            $tableRows = count($tr[0]);
        }

        return [
            'source_key'    => $key,
            'title'         => $title,
            'rate_mentions' => $rateMentions,
            'table_rows'    => $tableRows,
        ];
    }
}
