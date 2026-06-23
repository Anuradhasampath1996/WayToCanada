<?php

namespace App\Services;

use App\Models\LegislationAmendmentAlert;
use App\Models\LegislationCatalogEntry;
use App\Models\LegislationDocument;
use App\Models\LegislationSyncRun;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class LegislationClearService
{
    /** @return array<string, int|bool> */
    public function clear(
        bool $clearDocuments = true,
        bool $clearCatalog = false,
        bool $clearSyncHistory = true,
    ): array {
        if ($clearDocuments === false && $clearCatalog === false && $clearSyncHistory === false) {
            throw new \InvalidArgumentException('Select at least one item to clear.');
        }

        $counts = [
            'documents'         => 0,
            'catalog_entries'   => 0,
            'sync_runs'         => 0,
            'amendment_alerts'  => 0,
            'storage_cleared'   => false,
            'catalog_reset'     => false,
        ];

        return DB::transaction(function () use ($clearDocuments, $clearCatalog, $clearSyncHistory, &$counts) {
            LegislationSyncRun::query()
                ->whereIn('status', ['pending', 'running'])
                ->update([
                    'status'        => 'failed',
                    'finished_at'   => now(),
                    'error_message' => 'Cancelled — data cleared by admin.',
                    'current_step'  => 'Cancelled',
                ]);

            if ($clearDocuments) {
                $counts['documents'] = LegislationDocument::count();
                LegislationDocument::query()->update(['paired_document_id' => null]);
                LegislationDocument::query()->delete();

                if (Storage::disk('local')->exists('legislation')) {
                    Storage::disk('local')->deleteDirectory('legislation');
                    $counts['storage_cleared'] = true;
                }

                if (! $clearCatalog) {
                    LegislationCatalogEntry::query()->update([
                        'last_synced_at'   => null,
                        'documents_synced' => 0,
                    ]);
                    $counts['catalog_reset'] = true;
                }
            }

            if ($clearCatalog) {
                $counts['catalog_entries'] = LegislationCatalogEntry::count();
                LegislationCatalogEntry::query()->delete();
            }

            if ($clearSyncHistory) {
                $counts['sync_runs']        = LegislationSyncRun::count();
                $counts['amendment_alerts'] = LegislationAmendmentAlert::count();
                LegislationSyncRun::query()->delete();
                LegislationAmendmentAlert::query()->delete();
            }

            $driver = (string) config('queue.default');
            if ($driver === 'database' && Schema::hasTable('jobs')) {
                DB::table('jobs')
                    ->where(function ($query) {
                        $query->where('payload', 'like', '%RunLegislationSyncJob%')
                            ->orWhere('payload', 'like', '%SyncLegislationCatalogBatchJob%');
                    })
                    ->delete();
            }

            return $counts;
        });
    }

    public function hasActiveSync(): bool
    {
        return LegislationSyncRun::query()
            ->whereIn('status', ['pending', 'running'])
            ->exists();
    }
}
