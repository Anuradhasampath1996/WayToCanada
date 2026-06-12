<?php

namespace App\Services\TrustLedger;

use App\Enums\CaseFeeMilestoneStatus;
use App\Enums\MilestoneInvoiceStatus;
use App\Enums\TrustLedgerEntryType;
use App\Models\CaseFeeMilestone;
use App\Models\CaseFile;
use App\Models\ClientPaymentRequest;
use App\Models\ClientProfile;
use App\Models\ClientTrustAccount;
use App\Models\MilestoneInvoice;
use App\Models\TrustLedgerEntry;
use App\Models\User;
use App\Support\RetainerAgreementConfig;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TrustLedgerService
{
    public function ensureTrustAccount(CaseFile $caseFile): ClientTrustAccount
    {
        $caseFile->loadMissing('clientProfile');

        return ClientTrustAccount::firstOrCreate(
            ['case_file_id' => $caseFile->id],
            [
                'client_profile_id' => $caseFile->client_profile_id,
                'consultant_id'     => $caseFile->consultant_id,
                'currency'          => $caseFile->agreement_config['currency'] ?? 'CAD',
                'opened_at'         => now(),
                'status'            => 'active',
            ]
        );
    }

    /** Sync fee milestones from signed retainer agreement config. */
    public function syncMilestonesFromAgreement(CaseFile $caseFile): void
    {
        if (! $caseFile->isAgreementSigned()) {
            return;
        }

        $caseFile->loadMissing('clientProfile');
        $config   = RetainerAgreementConfig::formatAgreementPayload($caseFile);
        $totalFee = (float) ($config['totalFee'] ?? $caseFile->agreement_fee ?? 0);
        $currency = $config['currency'] ?? 'CAD';

        $defs = [
            ['key' => '1', 'pct' => (int) ($config['milestone1Pct'] ?? 30), 'label' => $config['milestone1Label'] ?? 'Milestone 1'],
            ['key' => '2', 'pct' => (int) ($config['milestone2Pct'] ?? 40), 'label' => $config['milestone2Label'] ?? 'Milestone 2'],
            ['key' => '3', 'pct' => (int) ($config['milestone3Pct'] ?? 30), 'label' => $config['milestone3Label'] ?? 'Milestone 3'],
        ];

        $this->ensureTrustAccount($caseFile);

        foreach ($defs as $i => $def) {
            $amount = round($totalFee * $def['pct'] / 100, 2);

            CaseFeeMilestone::updateOrCreate(
                [
                    'case_file_id'  => $caseFile->id,
                    'milestone_key' => $def['key'],
                ],
                [
                    'client_profile_id' => $caseFile->client_profile_id,
                    'label'             => $def['label'],
                    'percentage'        => $def['pct'],
                    'amount'            => $amount,
                    'currency'          => $currency,
                    'sort_order'        => $i + 1,
                ]
            );
        }
    }

    /** @return array<string, mixed> */
    public function dashboardForProfile(ClientProfile $profile): array
    {
        $profile->loadMissing('caseFile');
        $caseFile = $profile->caseFile;

        if (! $caseFile) {
            return ['trust_account' => null, 'milestones' => [], 'ledger' => [], 'pending_invoices' => []];
        }

        $this->syncMilestonesFromAgreement($caseFile);

        $trust = ClientTrustAccount::where('case_file_id', $caseFile->id)->first();
        $milestones = CaseFeeMilestone::where('case_file_id', $caseFile->id)
            ->orderBy('sort_order')
            ->get()
            ->map(fn ($m) => $this->formatMilestone($m));

        $ledger = $trust
            ? TrustLedgerEntry::where('client_trust_account_id', $trust->id)
                ->orderByDesc('occurred_at')
                ->orderByDesc('id')
                ->limit(50)
                ->get()
                ->map(fn ($e) => $this->formatLedgerEntry($e))
            : collect();

        $pendingInvoices = MilestoneInvoice::where('client_profile_id', $profile->id)
            ->whereIn('status', [
                MilestoneInvoiceStatus::PENDING_CLIENT_APPROVAL->value,
                MilestoneInvoiceStatus::APPROVED->value,
            ])
            ->with('milestone')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($inv) => $this->formatInvoice($inv));

        return [
            'trust_account'     => $trust ? $this->formatTrustAccount($trust) : null,
            'milestones'        => $milestones,
            'ledger'            => $ledger,
            'pending_invoices'  => $pendingInvoices,
            'compliance_note'   => 'Client funds recorded here represent trust ledger entries. Consultants must maintain a separate Client Trust Account at a regulated financial institution as required by CICC.',
        ];
    }

    public function recordDeposit(
        ClientTrustAccount $account,
        float $amount,
        string $title,
        ?string $description,
        User $actor,
        string $actorType,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?Request $request = null,
    ): TrustLedgerEntry {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Deposit amount must be positive.');
        }

        return DB::connection('cws')->transaction(function () use (
            $account, $amount, $title, $description, $actor, $actorType, $referenceType, $referenceId, $request
        ) {
            $account = ClientTrustAccount::lockForUpdate()->findOrFail($account->id);

            $newBalance = (float) $account->balance_held + $amount;

            $entry = TrustLedgerEntry::create([
                'client_trust_account_id' => $account->id,
                'case_file_id'            => $account->case_file_id,
                'client_profile_id'       => $account->client_profile_id,
                'entry_type'              => TrustLedgerEntryType::TRUST_DEPOSIT->value,
                'direction'               => 'credit',
                'amount'                  => $amount,
                'currency'                => $account->currency,
                'balance_after'           => $newBalance,
                'title'                   => $title,
                'description'             => $description,
                'reference_type'          => $referenceType,
                'reference_id'            => $referenceId,
                'actor_user_id'           => $actor->id,
                'actor_type'              => $actorType,
                'occurred_at'             => now(),
            ]);

            $account->update([
                'total_deposited' => (float) $account->total_deposited + $amount,
                'balance_held'    => $newBalance,
            ]);

            return $entry;
        });
    }

    public function recordManualDeposit(
        ClientProfile $profile,
        User $consultant,
        float $amount,
        string $method,
        ?string $reference,
        ?string $notes,
        Request $request,
    ): TrustLedgerEntry {
        $caseFile = $profile->caseFile ?? abort(422, 'No case file for this client.');
        $account  = $this->ensureTrustAccount($caseFile);

        return $this->recordDeposit(
            $account,
            $amount,
            'Trust deposit recorded',
            trim("Method: {$method}" . ($reference ? " · Ref: {$reference}" : '') . ($notes ? " · {$notes}" : '')),
            $consultant,
            'consultant',
            'manual_deposit',
            null,
            $request,
        );
    }

    public function recordPaymentRequestDeposit(ClientPaymentRequest $payment): ?TrustLedgerEntry
    {
        if (($payment->payment_purpose ?? 'general') !== 'trust_deposit') {
            return null;
        }

        $payment->loadMissing('clientProfile.user', 'clientProfile.caseFile', 'consultant');
        $caseFile = $payment->clientProfile?->caseFile;
        if (! $caseFile) {
            return null;
        }

        $account = $this->ensureTrustAccount($caseFile);

        $existing = TrustLedgerEntry::where('reference_type', 'client_payment_request')
            ->where('reference_id', $payment->id)
            ->exists();

        if ($existing) {
            return null;
        }

        return $this->recordDeposit(
            $account,
            (float) $payment->amount,
            'Trust deposit received',
            $payment->title . ' — online payment recorded to client trust ledger.',
            $payment->clientProfile->user ?? $payment->consultant ?? User::find($payment->consultant_id),
            'client',
            'client_payment_request',
            $payment->id,
        );
    }

    public function completeMilestone(CaseFeeMilestone $milestone, User $consultant): CaseFeeMilestone
    {
        if (! in_array($milestone->status, [
            CaseFeeMilestoneStatus::PENDING->value,
            CaseFeeMilestoneStatus::IN_PROGRESS->value,
        ], true)) {
            throw new \RuntimeException('This milestone cannot be marked complete.');
        }

        $milestone->update([
            'status'       => CaseFeeMilestoneStatus::COMPLETED->value,
            'completed_at' => now(),
            'completed_by' => $consultant->id,
        ]);

        return $milestone->fresh();
    }

    public function issueInvoice(CaseFeeMilestone $milestone, User $consultant, ?string $notes = null): MilestoneInvoice
    {
        if ($milestone->status !== CaseFeeMilestoneStatus::COMPLETED->value) {
            throw new \RuntimeException('Milestone must be completed before invoicing.');
        }

        $activeInvoice = $milestone->invoices()
            ->whereIn('status', [
                MilestoneInvoiceStatus::PENDING_CLIENT_APPROVAL->value,
                MilestoneInvoiceStatus::APPROVED->value,
            ])
            ->exists();

        if ($activeInvoice) {
            throw new \RuntimeException('An active invoice already exists for this milestone.');
        }

        $milestone->loadMissing('caseFile');
        $account = $this->ensureTrustAccount($milestone->caseFile ?? abort(422, 'Case file not found.'));

        $invoice = MilestoneInvoice::create([
            'case_fee_milestone_id'   => $milestone->id,
            'client_trust_account_id' => $account->id,
            'case_file_id'            => $milestone->case_file_id,
            'client_profile_id'       => $milestone->client_profile_id,
            'consultant_id'           => $consultant->id,
            'invoice_number'          => $this->nextInvoiceNumber($milestone->client_profile_id),
            'amount'                  => $milestone->amount,
            'currency'                => $milestone->currency,
            'status'                  => MilestoneInvoiceStatus::PENDING_CLIENT_APPROVAL->value,
            'consultant_notes'        => $notes,
        ]);

        $milestone->update(['status' => CaseFeeMilestoneStatus::INVOICED->value]);

        return $invoice->fresh(['milestone']);
    }

    public function approveInvoice(MilestoneInvoice $invoice, User $client): MilestoneInvoice
    {
        if ($invoice->status !== MilestoneInvoiceStatus::PENDING_CLIENT_APPROVAL->value) {
            throw new \RuntimeException('Invoice is not awaiting client approval.');
        }

        $invoice->update([
            'status'             => MilestoneInvoiceStatus::APPROVED->value,
            'client_approved_at' => now(),
        ]);

        return $invoice->fresh(['milestone']);
    }

    public function releaseInvoice(MilestoneInvoice $invoice, User $releaser): MilestoneInvoice
    {
        if ($invoice->status !== MilestoneInvoiceStatus::APPROVED->value) {
            throw new \RuntimeException('Invoice must be client-approved before release to operating account.');
        }

        return DB::connection('cws')->transaction(function () use ($invoice, $releaser) {
            $invoice = MilestoneInvoice::lockForUpdate()->findOrFail($invoice->id);
            $account = ClientTrustAccount::lockForUpdate()->findOrFail($invoice->client_trust_account_id);

            $amount = (float) $invoice->amount;
            if ((float) $account->balance_held < $amount) {
                throw new \RuntimeException('Insufficient trust balance to release this invoice amount.');
            }

            $newBalance = (float) $account->balance_held - $amount;

            $entry = TrustLedgerEntry::create([
                'client_trust_account_id' => $account->id,
                'case_file_id'            => $account->case_file_id,
                'client_profile_id'       => $account->client_profile_id,
                'entry_type'              => TrustLedgerEntryType::TRUST_RELEASE->value,
                'direction'               => 'debit',
                'amount'                  => $amount,
                'currency'                => $account->currency,
                'balance_after'           => $newBalance,
                'title'                   => 'Released to operating account',
                'description'             => 'Milestone invoice ' . $invoice->invoice_number . ' — earned fee transferred from trust.',
                'reference_type'          => 'milestone_invoice',
                'reference_id'            => $invoice->id,
                'case_fee_milestone_id'   => $invoice->case_fee_milestone_id,
                'milestone_invoice_id'    => $invoice->id,
                'actor_user_id'           => $releaser->id,
                'actor_type'              => $releaser->id === $invoice->consultant_id ? 'consultant' : 'system',
                'occurred_at'             => now(),
            ]);

            $account->update([
                'total_released' => (float) $account->total_released + $amount,
                'balance_held'   => $newBalance,
            ]);

            $invoice->update([
                'status'                   => MilestoneInvoiceStatus::RELEASED->value,
                'released_at'              => now(),
                'released_by'              => $releaser->id,
                'ledger_release_entry_id'  => $entry->id,
            ]);

            $invoice->milestone?->update(['status' => CaseFeeMilestoneStatus::RELEASED->value]);

            return $invoice->fresh(['milestone']);
        });
    }

    public function recordRefund(
        ClientProfile $profile,
        User $consultant,
        float $amount,
        string $reason,
        Request $request,
    ): TrustLedgerEntry {
        $caseFile = $profile->caseFile ?? abort(422, 'No case file.');
        $account  = $this->ensureTrustAccount($caseFile);

        if ($amount <= 0 || (float) $account->balance_held < $amount) {
            throw new \RuntimeException('Invalid refund amount or insufficient trust balance.');
        }

        return DB::connection('cws')->transaction(function () use ($account, $amount, $reason, $consultant, $request) {
            $account = ClientTrustAccount::lockForUpdate()->findOrFail($account->id);
            $newBalance = (float) $account->balance_held - $amount;

            $entry = TrustLedgerEntry::create([
                'client_trust_account_id' => $account->id,
                'case_file_id'            => $account->case_file_id,
                'client_profile_id'       => $account->client_profile_id,
                'entry_type'              => TrustLedgerEntryType::TRUST_REFUND->value,
                'direction'               => 'debit',
                'amount'                  => $amount,
                'currency'                => $account->currency,
                'balance_after'           => $newBalance,
                'title'                   => 'Trust refund to client',
                'description'             => $reason,
                'actor_user_id'           => $consultant->id,
                'actor_type'              => 'consultant',
                'occurred_at'             => now(),
            ]);

            $account->update([
                'total_refunded' => (float) $account->total_refunded + $amount,
                'balance_held'   => $newBalance,
            ]);

            return $entry;
        });
    }

    private function nextInvoiceNumber(int $clientProfileId): string
    {
        $seq = MilestoneInvoice::where('client_profile_id', $clientProfileId)->count() + 1;

        return 'INV-' . $clientProfileId . '-' . str_pad((string) $seq, 4, '0', STR_PAD_LEFT) . '-' . now()->format('Ymd');
    }

    /** @return array<string, mixed> */
    public function formatTrustAccount(ClientTrustAccount $account): array
    {
        return [
            'id'              => $account->id,
            'currency'        => $account->currency,
            'balance_held'    => (float) $account->balance_held,
            'total_deposited' => (float) $account->total_deposited,
            'total_released'  => (float) $account->total_released,
            'total_refunded'  => (float) $account->total_refunded,
            'status'          => $account->status,
            'opened_at'       => $account->opened_at,
        ];
    }

    /** @return array<string, mixed> */
    public function formatMilestone(CaseFeeMilestone $m): array
    {
        return [
            'id'           => $m->id,
            'milestone_key'=> $m->milestone_key,
            'label'        => $m->label,
            'percentage'   => $m->percentage,
            'amount'       => (float) $m->amount,
            'currency'     => $m->currency,
            'status'       => $m->status,
            'completed_at' => $m->completed_at,
            'sort_order'   => $m->sort_order,
        ];
    }

    /** @return array<string, mixed> */
    public function formatInvoice(MilestoneInvoice $inv): array
    {
        $inv->loadMissing('milestone');

        return [
            'id'                 => $inv->id,
            'invoice_number'     => $inv->invoice_number,
            'amount'             => (float) $inv->amount,
            'currency'           => $inv->currency,
            'status'             => $inv->status,
            'consultant_notes'   => $inv->consultant_notes,
            'milestone_label'    => $inv->milestone?->label,
            'client_approved_at' => $inv->client_approved_at,
            'released_at'        => $inv->released_at,
            'created_at'         => $inv->created_at,
        ];
    }

    /** @return array<string, mixed> */
    public function formatLedgerEntry(TrustLedgerEntry $e): array
    {
        return [
            'id'            => $e->id,
            'entry_type'    => $e->entry_type,
            'direction'     => $e->direction,
            'amount'        => (float) $e->amount,
            'currency'      => $e->currency,
            'balance_after' => (float) $e->balance_after,
            'title'         => $e->title,
            'description'   => $e->description,
            'actor_type'    => $e->actor_type,
            'occurred_at'   => $e->occurred_at,
        ];
    }
}
