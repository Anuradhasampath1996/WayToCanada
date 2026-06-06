<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * RcicConsultantsSeeder
 *
 * Imports the CICC public register export into the rcic_consultants table.
 *
 * SETUP: Copy the export file to:
 *   backend/database/seeders/data/rcic_export.csv
 *
 * Then run:
 *   php artisan db:seed --class=RcicConsultantsSeeder
 *
 * Re-running is safe — it truncates the table first (CICC data is periodically refreshed).
 * Admin uploads a fresh export via the Super-Admin panel (Phase 2).
 */
class RcicConsultantsSeeder extends Seeder
{
    private const CSV_PATH  = __DIR__ . '/data/rcic_export.csv';
    private const CHUNK_SIZE = 500;

    public function run(): void
    {
        if (! file_exists(self::CSV_PATH)) {
            $this->command->error(
                'CSV file not found at: ' . self::CSV_PATH . "\n" .
                'Copy rcic_export.csv to database/seeders/data/ and re-run.'
            );
            return;
        }

        $this->command->info('Truncating rcic_consultants table...');
        DB::connection('cws')->table('rcic_consultants')->truncate();

        $handle = fopen(self::CSV_PATH, 'r');

        if ($handle === false) {
            $this->command->error('Failed to open CSV file.');
            return;
        }

        // Skip UTF-8 BOM if present (EF BB BF) — must be done before fgetcsv
        $bom = fread($handle, 3);
        if ($bom !== "\xEF\xBB\xBF") {
            // Not a BOM — rewind and read from start
            rewind($handle);
        }

        // Read header row and normalize keys
        $headers = fgetcsv($handle);
        if ($headers === false) {
            $this->command->error('CSV appears to be empty.');
            fclose($handle);
            return;
        }

        $now   = now();
        $chunk = [];
        $total = 0;
        $skipped = 0;

        $this->command->getOutput()->progressStart();

        while (($row = fgetcsv($handle)) !== false) {
            // Skip rows with mismatched column count
            if (count($row) !== count($headers)) {
                $skipped++;
                continue;
            }

            $data = array_combine($headers, $row);

            // profile_id is the canonical CICC key — skip if missing
            $profileId = (int) ($data['Profile ID'] ?? 0);
            if ($profileId === 0) {
                $skipped++;
                continue;
            }

            $chunk[] = [
                'profile_id'           => $profileId,
                'college_id'           => $this->nullableStr($data['College ID'] ?? ''),
                'full_name'            => $this->nullableStr($data['Full Name'] ?? ''),
                'first_name'           => $this->nullableStr($data['First Name'] ?? ''),
                'last_name'            => $this->nullableStr($data['Last Name'] ?? ''),
                'type'                 => $this->nullableStr($data['Type'] ?? ''),
                'status'               => $this->nullableStr($data['Status'] ?? ''),
                'company'              => $this->nullableStr($data['Company'] ?? ''),
                'address_line_1'       => $this->nullableStr($data['Address Line 1'] ?? ''),
                'address_line_2'       => $this->nullableStr($data['Address Line 2'] ?? ''),
                'city'                 => $this->nullableStr($data['City'] ?? ''),
                'province'             => $this->nullableStr($data['Province'] ?? ''),
                'country'              => $this->nullableStr($data['Country'] ?? ''),
                'postal_code'          => $this->nullableStr($data['Postal Code'] ?? ''),
                'phone'                => $this->nullableStr($data['Phone'] ?? ''),
                'fax'                  => $this->nullableStr($data['Fax'] ?? ''),
                'email'                => $this->nullableStr($data['Email'] ?? ''),
                'website'              => $this->nullableStr($data['Website'] ?? ''),
                'languages'            => $this->nullableStr($data['Languages'] ?? ''),
                'entitled_to_practise' => (bool) ($data['Entitled to Practise'] ?? false),
                'scrape_status'        => $this->nullableStr($data['Scrape Status'] ?? ''),
                'scraped_at'           => $this->parseTimestamp($data['Scraped At'] ?? ''),
                'profile_url'          => $this->nullableStr($data['Profile URL'] ?? ''),
                'licence_history'      => $this->nullableStr($data['Licence History (Class|Start|Expiry|Status)'] ?? ''),
                'suspension_revocation'=> $this->nullableStr($data['Suspension/Revocation (Status|Reason|Start|End)'] ?? ''),
                'employment'           => $this->nullableStr($data['Employment (Company|Start|City|Province|Country|Email|Phone)'] ?? ''),
                'agents'               => $this->nullableStr($data['Agents (Name|Company|City|Province|Country|Email|Phone)'] ?? ''),
                'created_at'           => $now,
                'updated_at'           => $now,
            ];

            if (count($chunk) >= self::CHUNK_SIZE) {
                DB::connection('cws')->table('rcic_consultants')->insert($chunk);
                $total += count($chunk);
                $this->command->getOutput()->progressAdvance(count($chunk));
                $chunk = [];
            }
        }

        // Flush remaining records
        if (! empty($chunk)) {
            DB::connection('cws')->table('rcic_consultants')->insert($chunk);
            $total += count($chunk);
            $this->command->getOutput()->progressAdvance(count($chunk));
        }

        fclose($handle);

        $this->command->getOutput()->progressFinish();
        $this->command->info("Import complete: {$total} records inserted, {$skipped} rows skipped.");
    }

    /**
     * Return null for empty/whitespace strings, trimmed string otherwise.
     */
    private function nullableStr(string $value): ?string
    {
        $trimmed = trim($value);
        return $trimmed !== '' ? $trimmed : null;
    }

    /**
     * Parse a "YYYY-MM-DD HH:MM:SS" string into a valid timestamp or null.
     */
    private function parseTimestamp(string $value): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        $ts = strtotime($trimmed);
        return $ts !== false ? date('Y-m-d H:i:s', $ts) : null;
    }
}
