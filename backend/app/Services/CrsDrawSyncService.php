<?php

namespace App\Services;

use App\Models\ExpressEntryDraw;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CrsDrawSyncService
{
    /** @return int Number of draws upserted */
    public function sync(): int
    {
        $sources = config('crs_rules.draw_sync.sources', []);
        $count   = 0;

        foreach ($sources as $url) {
            try {
                $response = Http::timeout(20)->get($url);
                if (! $response->successful()) {
                    continue;
                }

                $data = $response->json();
                if (! is_array($data)) {
                    continue;
                }

                $rows = $data['rounds'] ?? $data['draws'] ?? (isset($data[0]) ? $data : []);
                if (! is_array($rows)) {
                    continue;
                }

                foreach ($rows as $row) {
                    if ($this->upsertDrawRow($row)) {
                        $count++;
                    }
                }

                if ($count > 0) {
                    return $count;
                }
            } catch (\Throwable $e) {
                Log::info('CRS draw sync source failed: '.$url.' — '.$e->getMessage());
            }
        }

        return $this->seedFallbackDraws();
    }

    private function upsertDrawRow(array $row): bool
    {
        $drawNumber = (int) ($row['drawNumber'] ?? $row['draw_number'] ?? $row['round'] ?? 0);
        if ($drawNumber <= 0) {
            return false;
        }

        $dateRaw = $row['drawDate'] ?? $row['draw_date'] ?? $row['date'] ?? null;
        if (! $dateRaw) {
            return false;
        }

        ExpressEntryDraw::updateOrCreate(
            ['draw_number' => $drawNumber],
            [
                'draw_date'            => date('Y-m-d', strtotime((string) $dateRaw)),
                'draw_name'            => $row['drawName'] ?? $row['draw_name'] ?? $row['name'] ?? null,
                'minimum_crs_score'    => isset($row['crsScore']) ? (int) $row['crsScore']
                    : (isset($row['drawCRS']) ? (int) $row['drawCRS']
                    : (isset($row['minimum_crs_score']) ? (int) $row['minimum_crs_score'] : null)),
                'invitations_issued'   => isset($row['drawSize']) ? (int) $row['drawSize']
                    : (isset($row['invitations_issued']) ? (int) $row['invitations_issued'] : null),
                'round_type'           => $row['drawType'] ?? $row['round_type'] ?? null,
                'raw_data'             => $row,
            ]
        );

        return true;
    }

    private function seedFallbackDraws(): int
    {
        if (ExpressEntryDraw::count() > 0) {
            return 0;
        }

        $samples = [
            ['draw_number' => 300, 'draw_date' => '2025-12-15', 'minimum_crs_score' => 520, 'invitations_issued' => 1500, 'round_type' => 'General', 'draw_name' => 'No program specified'],
            ['draw_number' => 299, 'draw_date' => '2025-11-28', 'minimum_crs_score' => 505, 'invitations_issued' => 800, 'round_type' => 'PNP', 'draw_name' => 'Provincial Nominee Program'],
            ['draw_number' => 298, 'draw_date' => '2025-11-12', 'minimum_crs_score' => 475, 'invitations_issued' => 1200, 'round_type' => 'Category', 'draw_name' => 'Healthcare occupations'],
        ];

        foreach ($samples as $s) {
            ExpressEntryDraw::create(array_merge($s, ['raw_data' => ['seed' => true]]));
        }

        return count($samples);
    }
}
