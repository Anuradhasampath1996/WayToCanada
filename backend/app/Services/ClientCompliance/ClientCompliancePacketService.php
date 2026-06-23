<?php

namespace App\Services\ClientCompliance;

use App\Models\CaseFile;
use App\Models\ClientActivityLog;
use App\Models\ClientProfile;
use App\Models\DocumentSubmission;
use App\Models\TrustLedgerEntry;
use App\Models\User;
use App\Services\ClientActivity\ClientActivityRecorder;
use App\Services\TrustLedger\TrustLedgerService;
use App\Support\RetainerAgreementConfig;
use Illuminate\Http\Request;

class ClientCompliancePacketService
{
    private const ACTIVITY_LOG_LIMIT = 250;

    public function __construct(
        private ClientActivityRecorder $activityRecorder,
        private TrustLedgerService $trustLedger,
    ) {}

    /** @return array<string, mixed> */
    public function gather(ClientProfile $profile, User $consultant, Request $request): array
    {
        $this->activityRecorder->syncHistorical($profile);

        $profile->loadMissing('user', 'caseFile');
        $caseFile = $profile->caseFile;

        $consultant->loadMissing([]);

        $companyAddress = collect([
            $consultant->company_address_line1,
            $consultant->company_address_line2,
            $consultant->company_city,
            $consultant->company_province,
            $consultant->company_postal_code,
            $consultant->company_country,
        ])->filter()->implode(', ');

        $generatedAt = now();
        $reportRef = sprintf('WTC-CCP-%d-%s', $profile->id, $generatedAt->format('YmdHis'));

        $totalActivityCount = ClientActivityLog::where('client_profile_id', $profile->id)->count();
        $activityLogs = ClientActivityLog::where('client_profile_id', $profile->id)
            ->orderBy('occurred_at')
            ->orderBy('id')
            ->limit(self::ACTIVITY_LOG_LIMIT)
            ->get();

        $trustData = $this->trustLedger->dashboardForProfile($profile);
        $trustAccount = $trustData['trust_account'] ?? null;

        $ledgerEntries = [];
        if ($trustAccount && isset($trustAccount['id'])) {
            $ledgerEntries = TrustLedgerEntry::where('client_trust_account_id', $trustAccount['id'])
                ->orderBy('occurred_at')
                ->orderBy('id')
                ->get()
                ->map(fn ($e) => $this->trustLedger->formatLedgerEntry($e))
                ->all();
        }

        $documents = $caseFile
            ? DocumentSubmission::where('case_file_id', $caseFile->id)
                ->orderByDesc('created_at')
                ->get()
            : collect();

        return [
            'reportRef'          => $reportRef,
            'generatedAt'        => $generatedAt->timezone('America/Toronto')->format('F j, Y \a\t g:i A T'),
            'consultant'         => $consultant,
            'companyName'        => $consultant->company_name ?: $consultant->name,
            'companyAddress'     => $companyAddress,
            'companyPhone'       => $consultant->company_phone ?: $consultant->phone,
            'companyWeb'         => $consultant->company_website,
            'companyLogo'        => \App\Support\PdfImageEmbedder::logoDataUri($consultant->company_logo),
            'rcicNo'             => $consultant->rcic_number,
            'client'             => $profile,
            'clientUser'         => $profile->user,
            'clientPhone'        => $profile->user?->phone ?? $profile->phone,
            'pathway'            => $profile->immigration_pathway ?? $caseFile?->immigration_pathway,
            'caseFile'           => $caseFile,
            'agreement'          => $this->agreementSummary($caseFile),
            'trust'              => [
                'account'    => $trustAccount,
                'milestones' => $trustData['milestones'] ?? [],
                'ledger'     => $ledgerEntries,
                'note'       => $trustData['compliance_note'] ?? null,
            ],
            'documents'          => $documents,
            'activityLogs'       => $activityLogs,
            'totalActivityCount' => $totalActivityCount,
            'activityTruncated'  => $totalActivityCount > self::ACTIVITY_LOG_LIMIT,
            'clientActions'      => $activityLogs->where('actor_type', 'client')->count(),
            'consultantActions'  => $activityLogs->where('actor_type', 'consultant')->count(),
        ];
    }

    /** @return array<string, mixed>|null */
    private function agreementSummary(?CaseFile $caseFile): ?array
    {
        if (! $caseFile) {
            return null;
        }

        $config = RetainerAgreementConfig::formatAgreementPayload($caseFile);
        $currency = $config['currency'] ?? 'CAD';

        $milestones = [
            [
                'label'      => $config['milestone1Label'] ?? 'Milestone 1',
                'percentage' => (int) ($config['milestone1Pct'] ?? 0),
                'amount'     => round(((float) ($config['totalFee'] ?? 0)) * ((int) ($config['milestone1Pct'] ?? 0)) / 100, 2),
            ],
            [
                'label'      => $config['milestone2Label'] ?? 'Milestone 2',
                'percentage' => (int) ($config['milestone2Pct'] ?? 0),
                'amount'     => round(((float) ($config['totalFee'] ?? 0)) * ((int) ($config['milestone2Pct'] ?? 0)) / 100, 2),
            ],
            [
                'label'      => $config['milestone3Label'] ?? 'Milestone 3',
                'percentage' => (int) ($config['milestone3Pct'] ?? 0),
                'amount'     => round(((float) ($config['totalFee'] ?? 0)) * ((int) ($config['milestone3Pct'] ?? 0)) / 100, 2),
            ],
        ];

        return [
            'status'              => $caseFile->status,
            'sent_at'             => $caseFile->agreement_sent_at,
            'signed_at'           => $caseFile->agreement_signed_at,
            'signed_via'          => $caseFile->signed_document_path ? 'Uploaded signed PDF' : ($caseFile->agreement_signed_at ? 'Digital signature on portal' : null),
            'signed_ip'           => $caseFile->agreement_signed_ip,
            'total_fee'           => (float) ($config['totalFee'] ?? 0),
            'currency'            => $currency,
            'pathway'             => $config['pathway'] ?? $caseFile->immigration_pathway,
            'scope_description'   => $config['scopeDescription'] ?? null,
            'refund_policy'       => $config['refundPolicy'] ?? null,
            'doc_deadline_days'   => (int) ($config['docDeadlineDays'] ?? 14),
            'milestones'          => $milestones,
            'custom_clauses'      => $config['customClauses'] ?? null,
            'consultant_license'  => $config['consultantLicenseNo'] ?? null,
        ];
    }

    public function filename(ClientProfile $profile): string
    {
        $profile->loadMissing('user');
        $name = $profile->user?->name ?? 'client';
        $slug = preg_replace('/[^a-zA-Z0-9_-]+/', '-', $name) ?: 'client';

        return 'compliance-packet-' . trim($slug, '-') . '-' . now()->format('Y-m-d') . '.pdf';
    }
}
