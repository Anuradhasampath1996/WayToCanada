<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Services\ClientCompliance\ClientCompliancePacketPdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ConsultantClientComplianceController extends Controller
{
    public function __construct(
        private ClientCompliancePacketPdfService $pdfService,
    ) {}

    /**
     * GET /api/v1/consultant/clients/{profile}/compliance-packet/pdf
     * Combined compliance export: agreement summary, trust ledger, activity log, document inventory.
     */
    public function downloadPdf(Request $request, ClientProfile $profile)
    {
        $this->authorizeConsultant($request, $profile);

        try {
            $pdf = $this->pdfService->generate($profile, $request->user(), $request);

            return $pdf->download($this->pdfService->filename($profile));
        } catch (\Throwable $e) {
            Log::error('Compliance packet PDF failed', [
                'profile_id' => $profile->id,
                'error'      => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Could not generate the compliance packet PDF. Please try again.',
            ], 500);
        }
    }

    /**
     * GET /api/v1/consultant/clients/{profile}/compliance-packet
     * JSON preview of packet contents (for UI summary before download).
     */
    public function preview(Request $request, ClientProfile $profile): JsonResponse
    {
        $this->authorizeConsultant($request, $profile);

        $data = app(\App\Services\ClientCompliance\ClientCompliancePacketService::class)
            ->gather($profile, $request->user(), $request);

        return response()->json([
            'report_ref'    => $data['reportRef'],
            'generated_at'  => $data['generatedAt'],
            'case_status'   => $data['caseFile']?->status,
            'pathway'       => $data['pathway'],
            'agreement'     => $data['agreement'] ? [
                'signed_at'  => $data['agreement']['signed_at']?->toIso8601String(),
                'sent_at'    => $data['agreement']['sent_at']?->toIso8601String(),
                'total_fee'  => $data['agreement']['total_fee'],
                'currency'   => $data['agreement']['currency'],
            ] : null,
            'trust' => [
                'balance_held'    => $data['trust']['account']['balance_held'] ?? 0,
                'total_deposited' => $data['trust']['account']['total_deposited'] ?? 0,
                'ledger_entries'  => count($data['trust']['ledger']),
                'milestones'      => count($data['trust']['milestones']),
            ],
            'documents_count'      => $data['documents']->count(),
            'activity_events'      => $data['totalActivityCount'],
            'activity_in_packet'   => $data['activityLogs']->count(),
            'activity_truncated'   => $data['activityTruncated'],
            'compliance_note'      => 'This packet combines retainer agreement summary, trust ledger, document inventory, and portal activity log for CICC compliance review.',
        ]);
    }

    private function authorizeConsultant(Request $request, ClientProfile $profile): void
    {
        if ($profile->consultant_id !== $request->user()->id) {
            abort(403, 'Access denied.');
        }
    }
}
