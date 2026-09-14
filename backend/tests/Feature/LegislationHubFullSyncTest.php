<?php

namespace Tests\Feature;

use App\Jobs\RunLegislationSyncJob;
use App\Jobs\SyncLegislationCatalogBatchJob;
use App\Models\LegislationCatalogEntry;
use App\Models\LegislationSyncRun;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\RefreshesLmsDatabase;
use Tests\TestCase;

class LegislationHubFullSyncTest extends TestCase
{
    use RefreshDatabase;
    use RefreshesLmsDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->wipeLmsTestDatabase();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_full_sync_discovers_catalog_then_queues_remaining_downloads(): void
    {
        Queue::fake();
        config([
            'queue.default' => 'database',
            'legislation_sources.batch.request_delay_ms' => 0,
            'legislation_sources.immigration_tier' => [
                ['act_code' => 'C-29', 'title' => 'Citizenship Act', 'category' => 'act'],
            ],
        ]);

        $actsIndex = <<<'HTML'
<li><span class="objTitle"><a class="TocTitle" href="I-2.5/index.html">
Immigration and Refugee Protection Act
</a></span></li>
<li><span class="objTitle"><a class="TocTitle" href="C-29/index.html">
Citizenship Act
</a></span></li>
<li><span class="objTitle"><a class="TocTitle" href="A-1/index.html">
Access to Information Act
</a></span></li>
HTML;
        $regsIndex = <<<'HTML'
<li><span class="objTitle"><a class="TocTitle" href="SOR-2002-227/index.html">
Immigration and Refugee Protection Regulations
</a></span></li>
HTML;

        Http::fake(function (\Illuminate\Http\Client\Request $request) use ($actsIndex, $regsIndex) {
            $url = $request->url();
            if (str_contains($url, '/eng/acts/i.html')) {
                return Http::response($actsIndex, 200);
            }
            if (str_contains($url, '/eng/regulations/s.html')) {
                return Http::response($regsIndex, 200);
            }
            if (str_contains($url, '/eng/acts/') || str_contains($url, '/eng/regulations/')) {
                return Http::response('<html></html>', 200);
            }

            return Http::response('<?xml version="1.0"?><statute><title>Test</title></statute>', 200);
        });

        $admin = User::factory()->create([
            'email_verified_at' => now(),
            'is_license_verified' => true,
        ]);
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/legislation/sync', [
            'scope' => 'full',
            'async' => true,
            'only_unsynced' => true,
            'batch_size' => 10,
        ])->assertStatus(202)->assertJsonPath('run.scope', 'full');

        Queue::assertPushed(RunLegislationSyncJob::class);
        $run = LegislationSyncRun::query()->latest('id')->firstOrFail();

        $job = new RunLegislationSyncJob($run->id, null, true, false);
        $job->handle(
            app(\App\Services\LegislationSyncService::class),
            app(\App\Services\LegislationReferenceAiService::class),
            app(\App\Services\LegislationLinkCoverageService::class),
        );

        $this->assertDatabaseHas('legislation_catalog', [
            'act_code' => 'I-2.5',
            'category' => 'act',
        ]);
        $this->assertDatabaseHas('legislation_catalog', [
            'act_code' => 'SOR-2002-227',
            'category' => 'regulation',
        ]);
        $this->assertNotNull(LegislationCatalogEntry::where('act_code', 'I-2.5')->value('last_synced_at'));
        $this->assertNull(LegislationCatalogEntry::where('act_code', 'A-1')->value('last_synced_at'));

        Queue::assertPushed(SyncLegislationCatalogBatchJob::class, function (SyncLegislationCatalogBatchJob $queued) use ($run) {
            return $queued->syncRunId === $run->id && $queued->onlyUnsynced === true;
        });

        $run->refresh();
        $this->assertSame('catalog', $run->stats['phase'] ?? null);
        $this->assertGreaterThanOrEqual(1, (int) ($run->stats['pending_total'] ?? 0));
        $this->assertSame(3, (int) ($run->stats['discovered_acts'] ?? 0));
        $this->assertSame(1, (int) ($run->stats['discovered_regs'] ?? 0));
    }
}
