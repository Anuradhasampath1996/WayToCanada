<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RcicConsultant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminRcicController extends Controller
{
    /**
     * GET /api/v1/admin/rcic-consultants
     * Paginated, searchable CICC public register.
     *
     * Query params:
     *   search   — name, college_id, company, or email
     *   active   — 1 (entitled to practise) | 0
     *   status   — e.g. "Active Member"
     *   per_page — default 20, max 100
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search'   => 'nullable|string|max:100',
            'active'   => 'nullable|boolean',
            'status'   => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = RcicConsultant::query();

        if ($search = $request->input('search')) {
            $query->search($search);
        }

        if ($request->filled('active')) {
            $query->where('entitled_to_practise', $request->boolean('active'));
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $consultants = $query
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->paginate($request->input('per_page', 20));

        return response()->json($consultants);
    }

    /**
     * POST /api/v1/admin/rcic-consultants
     * Create a new RCIC record manually.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'profile_id'           => 'required|integer|unique:cws.rcic_consultants,profile_id',
            'college_id'           => 'nullable|string|max:20',
            'full_name'            => 'nullable|string|max:255',
            'first_name'           => 'nullable|string|max:100',
            'last_name'            => 'nullable|string|max:100',
            'type'                 => 'nullable|string|max:50',
            'status'               => 'nullable|string|max:50',
            'company'              => 'nullable|string|max:1000',
            'address_line_1'       => 'nullable|string|max:500',
            'address_line_2'       => 'nullable|string|max:500',
            'city'                 => 'nullable|string|max:100',
            'province'             => 'nullable|string|max:100',
            'country'              => 'nullable|string|max:100',
            'postal_code'          => 'nullable|string|max:20',
            'phone'                => 'nullable|string|max:50',
            'fax'                  => 'nullable|string|max:50',
            'email'                => 'nullable|email|max:255',
            'website'              => 'nullable|url|max:500',
            'languages'            => 'nullable|string|max:500',
            'entitled_to_practise' => 'nullable|boolean',
        ]);

        $data['entitled_to_practise'] = $data['entitled_to_practise'] ?? false;

        $consultant = RcicConsultant::create($data);

        return response()->json([
            'message'    => 'Record created.',
            'consultant' => $consultant,
        ], 201);
    }

    /**
     * GET /api/v1/admin/rcic-consultants/{profileId}
     * Single RCIC record by CICC profile_id.
     */
    public function show(int $profileId): JsonResponse
    {
        $consultant = RcicConsultant::where('profile_id', $profileId)->firstOrFail();

        return response()->json($consultant);
    }

    /**
     * PUT /api/v1/admin/rcic-consultants/{profileId}
     * Update editable fields of a single RCIC record.
     */
    public function update(Request $request, int $profileId): JsonResponse
    {
        $consultant = RcicConsultant::where('profile_id', $profileId)->firstOrFail();

        $data = $request->validate([
            'full_name'           => 'nullable|string|max:255',
            'college_id'          => 'nullable|string|max:20',
            'type'                => 'nullable|string|max:50',
            'status'              => 'nullable|string|max:50',
            'company'             => 'nullable|string|max:1000',
            'city'                => 'nullable|string|max:100',
            'province'            => 'nullable|string|max:100',
            'country'             => 'nullable|string|max:100',
            'phone'               => 'nullable|string|max:50',
            'email'               => 'nullable|email|max:255',
            'entitled_to_practise'=> 'nullable|boolean',
        ]);

        $consultant->update($data);

        return response()->json([
            'message'    => 'Record updated.',
            'consultant' => $consultant->fresh(),
        ]);
    }

    /**
     * DELETE /api/v1/admin/rcic-consultants/{profileId}
     * Delete a single RCIC record by profile_id.
     */
    public function destroyOne(int $profileId): JsonResponse
    {
        $consultant = RcicConsultant::where('profile_id', $profileId)->firstOrFail();
        $consultant->delete();

        return response()->json(['message' => 'Record deleted.']);
    }

    /**
     * DELETE /api/v1/admin/rcic-consultants/clear
     * Truncates the entire rcic_consultants table.
     */
    public function clearAll(): JsonResponse
    {
        $count = RcicConsultant::count();
        RcicConsultant::truncate();

        return response()->json([
            'message' => "All {$count} records deleted.",
            'deleted' => $count,
        ]);
    }

    /**
     * POST /api/v1/admin/rcic-consultants/import
     * Accepts a CSV file and upserts records by profile_id.
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:20480',
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $rawHeaders = fgetcsv($handle);

        if (!$rawHeaders) {
            fclose($handle);
            return response()->json(['message' => 'Empty CSV file.'], 422);
        }

        // Strip BOM from first header
        $rawHeaders[0] = ltrim($rawHeaders[0], "\xEF\xBB\xBF");

        $simpleMap = [
            'Profile ID'            => 'profile_id',
            'College ID'            => 'college_id',
            'Full Name'             => 'full_name',
            'First Name'            => 'first_name',
            'Last Name'             => 'last_name',
            'Type'                  => 'type',
            'Status'                => 'status',
            'Company'               => 'company',
            'Address Line 1'        => 'address_line_1',
            'Address Line 2'        => 'address_line_2',
            'City'                  => 'city',
            'Province'              => 'province',
            'Country'               => 'country',
            'Postal Code'           => 'postal_code',
            'Phone'                 => 'phone',
            'Fax'                   => 'fax',
            'Email'                 => 'email',
            'Website'               => 'website',
            'Languages'             => 'languages',
            'Entitled to Practise'  => 'entitled_to_practise',
            'Scrape Status'         => 'scrape_status',
            'Scraped At'            => 'scraped_at',
            'Profile URL'           => 'profile_url',
        ];

        // Build column index: dbCol => csvIndex
        $colIndex = [];
        foreach ($rawHeaders as $i => $h) {
            $h = trim($h, '"');
            if (isset($simpleMap[$h])) {
                $colIndex[$simpleMap[$h]] = $i;
            }
            if (str_starts_with($h, 'Licence History'))       $colIndex['licence_history']       = $i;
            if (str_starts_with($h, 'Suspension/Revocation')) $colIndex['suspension_revocation'] = $i;
            if (str_starts_with($h, 'Employment'))            $colIndex['employment']            = $i;
            if (str_starts_with($h, 'Agents'))                $colIndex['agents']                = $i;
        }

        $imported = 0;
        $skipped  = 0;

        // Max lengths for remaining varchar columns (TEXT columns have no limit here)
        $varcharLimits = [
            'college_id'    => 20,
            'full_name'     => 255,
            'first_name'    => 255,
            'last_name'     => 255,
            'type'          => 50,
            'status'        => 50,
            'city'          => 100,
            'province'      => 100,
            'country'       => 100,
            'postal_code'   => 20,
            'phone'         => 50,
            'fax'           => 50,
            'scrape_status' => 30,
        ];

        while (($row = fgetcsv($handle)) !== false) {
            $profileIdIdx = $colIndex['profile_id'] ?? null;
            if ($profileIdIdx === null) { $skipped++; continue; }

            $profileId = trim($row[$profileIdIdx] ?? '');
            if ($profileId === '' || !is_numeric($profileId)) { $skipped++; continue; }

            $data = ['profile_id' => $profileId];
            foreach ($colIndex as $dbCol => $idx) {
                if ($dbCol === 'profile_id') continue;
                $val = (isset($row[$idx]) && $row[$idx] !== '') ? $row[$idx] : null;
                if ($dbCol === 'entitled_to_practise') {
                    $val = in_array($val, ['1', 'true', 'True', 'yes', 'Yes']) ? 1 : 0;
                } elseif ($val !== null && isset($varcharLimits[$dbCol])) {
                    // Safely truncate to avoid SQLSTATE[22001] on varchar columns
                    $val = mb_substr($val, 0, $varcharLimits[$dbCol]);
                }
                $data[$dbCol] = $val;
            }

            RcicConsultant::updateOrCreate(['profile_id' => $profileId], $data);
            $imported++;
        }

        fclose($handle);

        return response()->json([
            'message'  => "Import complete. {$imported} records saved, {$skipped} skipped.",
            'imported' => $imported,
            'skipped'  => $skipped,
        ]);
    }

    /**
     * GET /api/v1/admin/rcic-consultants/export
     * Stream all records as CSV download.
     */
    public function export(): StreamedResponse
    {
        $filename = 'rcic_export_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'Profile ID', 'College ID', 'Full Name', 'First Name', 'Last Name',
                'Type', 'Status', 'Company', 'Address Line 1', 'Address Line 2',
                'City', 'Province', 'Country', 'Postal Code', 'Phone', 'Fax',
                'Email', 'Website', 'Languages', 'Entitled to Practise',
                'Scrape Status', 'Scraped At', 'Profile URL',
                'Licence History (Class|Start|Expiry|Status)',
                'Suspension/Revocation (Status|Reason|Start|End)',
                'Employment (Company|Start|City|Province|Country|Email|Phone)',
                'Agents (Name|Company|City|Province|Country|Email|Phone)',
            ]);

            RcicConsultant::orderBy('last_name')->orderBy('first_name')
                ->chunk(500, function ($rows) use ($handle) {
                    foreach ($rows as $r) {
                        fputcsv($handle, [
                            $r->profile_id,   $r->college_id,    $r->full_name,
                            $r->first_name,   $r->last_name,     $r->type,
                            $r->status,       $r->company,       $r->address_line_1,
                            $r->address_line_2, $r->city,        $r->province,
                            $r->country,      $r->postal_code,   $r->phone,
                            $r->fax,          $r->email,         $r->website,
                            $r->languages,    $r->entitled_to_practise ? '1' : '0',
                            $r->scrape_status, $r->scraped_at,   $r->profile_url,
                            $r->licence_history, $r->suspension_revocation,
                            $r->employment,   $r->agents,
                        ]);
                    }
                });

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv']);
    }
}
