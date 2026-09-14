<?php

namespace App\Services\Referral;

use App\Enums\NotificationType;
use App\Models\ConsultantWallet;
use App\Models\ConsultantWalletTransaction;
use App\Models\ConsultantWithdrawalRequest;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WithdrawalService
{
    public function __construct(
        private ReferralSettingsService $settings,
        private ConsultantWalletLedgerService $ledger,
        private ReferralNotificationService $notifications,
        private ReferralAuditService $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function request(User $user, array $data): ConsultantWithdrawalRequest
    {
        $rule = $this->settings->current();
        if (! $rule->program_enabled) {
            throw ValidationException::withMessages(['amount' => 'The referral program is currently disabled.']);
        }

        $amount = round((float) $data['amount'], 2);
        $minimum = (float) $rule->withdrawal_minimum;
        if ($amount < $minimum) {
            throw ValidationException::withMessages([
                'amount' => 'The minimum withdrawal is CAD '.number_format($minimum, 2).'.',
            ]);
        }

        if ($rule->withdrawal_maximum !== null && $amount > (float) $rule->withdrawal_maximum) {
            throw ValidationException::withMessages([
                'amount' => 'The amount exceeds the maximum withdrawal.',
            ]);
        }

        $accountNumber = preg_replace('/\s+/', '', (string) $data['account_number']);
        $last4 = substr($accountNumber, -4);

        return DB::connection('cws')->transaction(function () use ($user, $data, $amount, $accountNumber, $last4) {
            $wallet = $this->ledger->forUser($user);
            $wallet = ConsultantWallet::query()->whereKey($wallet->id)->lockForUpdate()->firstOrFail();

            if ($wallet->withdrawalsFrozen()) {
                throw ValidationException::withMessages([
                    'amount' => 'Withdrawals are frozen on this wallet pending admin review.',
                ]);
            }

            $spendable = $this->ledger->spendable($wallet);
            if ($amount > $spendable + 0.001) {
                throw ValidationException::withMessages([
                    'amount' => 'The amount exceeds your spendable wallet balance.',
                ]);
            }

            $request = ConsultantWithdrawalRequest::query()->create([
                'user_id' => $user->id,
                'wallet_id' => $wallet->id,
                'amount' => $amount,
                'currency' => 'CAD',
                'status' => ConsultantWithdrawalRequest::STATUS_REQUESTED,
                'account_holder_name' => $data['account_holder_name'],
                'bank_name' => $data['bank_name'],
                'account_number_encrypted' => Crypt::encryptString($accountNumber),
                'transit_number_encrypted' => ! empty($data['transit_number'])
                    ? Crypt::encryptString((string) $data['transit_number'])
                    : null,
                'institution_number' => $data['institution_number'] ?? null,
                'routing_swift' => $data['routing_swift'] ?? null,
                'country' => $data['country'] ?? 'CA',
                'account_last4' => $last4,
                'consultant_note' => $data['consultant_note'] ?? null,
                'requested_at' => now(),
            ]);

            $reserved = $this->ledger->post(
                $wallet,
                ConsultantWalletTransaction::TYPE_WITHDRAWAL_RESERVED,
                'debit',
                $amount,
                'withdrawal_reserved:'.$request->id,
                'Withdrawal reserved',
                ConsultantWithdrawalRequest::class,
                $request->id,
            );
            $request->update(['reserved_transaction_id' => $reserved->id]);

            $this->audit->record('withdrawal_requested', 'consultant_withdrawal_request', $request->id, null, [
                'amount' => $amount,
            ], $user->id);
            $this->notifications->withdrawalRequested($request->fresh('user'));

            return $request->fresh();
        });
    }

    public function cancelByConsultant(User $user, ConsultantWithdrawalRequest $request): ConsultantWithdrawalRequest
    {
        if ((int) $request->user_id !== (int) $user->id) {
            abort(403);
        }

        if (! $request->isCancellableByConsultant()) {
            throw ValidationException::withMessages([
                'status' => 'This withdrawal can only be cancelled before admin approval.',
            ]);
        }

        return $this->release($request, ConsultantWithdrawalRequest::STATUS_CANCELLED, $user->id, 'Cancelled by consultant');
    }

    public function review(ConsultantWithdrawalRequest $request, int $actorId): ConsultantWithdrawalRequest
    {
        return $this->transition($request, ConsultantWithdrawalRequest::STATUS_UNDER_REVIEW, $actorId);
    }

    public function approve(ConsultantWithdrawalRequest $request, int $actorId, ?string $notes = null): ConsultantWithdrawalRequest
    {
        $updated = $this->transition($request, ConsultantWithdrawalRequest::STATUS_APPROVED, $actorId, $notes);
        $amount = number_format((float) $updated->amount, 2);
        $this->notifications->withdrawalStatus(
            $updated,
            NotificationType::REFERRAL_WITHDRAWAL_APPROVED,
            'Withdrawal approved',
            "Your CAD {$amount} withdrawal was approved and is being prepared for payout.",
        );

        return $updated;
    }

    public function markProcessing(ConsultantWithdrawalRequest $request, int $actorId, ?string $notes = null): ConsultantWithdrawalRequest
    {
        return $this->transition($request, ConsultantWithdrawalRequest::STATUS_PROCESSING, $actorId, $notes);
    }

    public function reject(ConsultantWithdrawalRequest $request, int $actorId, ?string $notes = null): ConsultantWithdrawalRequest
    {
        $updated = $this->release($request, ConsultantWithdrawalRequest::STATUS_REJECTED, $actorId, $notes ?? 'Rejected by admin');
        $amount = number_format((float) $updated->amount, 2);
        $this->notifications->withdrawalStatus(
            $updated,
            NotificationType::REFERRAL_WITHDRAWAL_REJECTED,
            'Withdrawal rejected',
            "Your CAD {$amount} withdrawal was rejected. The reserved funds are available again.",
        );

        return $updated;
    }

    public function markPaid(ConsultantWithdrawalRequest $request, int $actorId, string $payoutReference, ?string $notes = null): ConsultantWithdrawalRequest
    {
        if ($request->status === ConsultantWithdrawalRequest::STATUS_PAID) {
            abort(409, 'This withdrawal has already been marked paid.');
        }

        if (! in_array($request->status, [
            ConsultantWithdrawalRequest::STATUS_APPROVED,
            ConsultantWithdrawalRequest::STATUS_PROCESSING,
        ], true)) {
            throw ValidationException::withMessages([
                'status' => 'Only approved or processing withdrawals can be marked paid.',
            ]);
        }

        return DB::connection('cws')->transaction(function () use ($request, $actorId, $payoutReference, $notes) {
            $locked = ConsultantWithdrawalRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === ConsultantWithdrawalRequest::STATUS_PAID) {
                abort(409, 'This withdrawal has already been marked paid.');
            }

            $wallet = $this->ledger->forUser($locked->user);
            $paid = $this->ledger->post(
                $wallet,
                ConsultantWalletTransaction::TYPE_WITHDRAWAL_PAID,
                'debit',
                (float) $locked->amount,
                'withdrawal_paid:'.$locked->id,
                'Withdrawal paid',
                ConsultantWithdrawalRequest::class,
                $locked->id,
                ['payout_reference' => $payoutReference],
                $actorId,
            );

            $before = ['status' => $locked->status];
            $locked->update([
                'status' => ConsultantWithdrawalRequest::STATUS_PAID,
                'paid_at' => now(),
                'reviewed_at' => $locked->reviewed_at ?? now(),
                'processed_by' => $actorId,
                'payout_reference' => $payoutReference,
                'admin_notes' => $notes ?? $locked->admin_notes,
                'paid_transaction_id' => $paid->id,
            ]);

            $this->audit->record('withdrawal_paid', 'consultant_withdrawal_request', $locked->id, $before, [
                'status' => ConsultantWithdrawalRequest::STATUS_PAID,
                'payout_reference' => $payoutReference,
            ], $actorId);

            $amount = number_format((float) $locked->amount, 2);
            $this->notifications->withdrawalStatus(
                $locked->fresh('user'),
                NotificationType::REFERRAL_WITHDRAWAL_PAID,
                'Withdrawal paid',
                "CAD {$amount} was marked paid. Reference: {$payoutReference}.",
            );

            return $locked->fresh();
        });
    }

    private function transition(
        ConsultantWithdrawalRequest $request,
        string $status,
        int $actorId,
        ?string $notes = null,
    ): ConsultantWithdrawalRequest {
        $before = ['status' => $request->status];
        $request->update([
            'status' => $status,
            'reviewed_at' => $request->reviewed_at ?? now(),
            'processed_by' => $actorId,
            'admin_notes' => $notes ?? $request->admin_notes,
        ]);
        $this->audit->record('withdrawal_'.$status, 'consultant_withdrawal_request', $request->id, $before, [
            'status' => $status,
        ], $actorId);

        return $request->fresh();
    }

    private function release(
        ConsultantWithdrawalRequest $request,
        string $status,
        int $actorId,
        ?string $notes = null,
    ): ConsultantWithdrawalRequest {
        return DB::connection('cws')->transaction(function () use ($request, $status, $actorId, $notes) {
            $locked = ConsultantWithdrawalRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            if (in_array($locked->status, [
                ConsultantWithdrawalRequest::STATUS_PAID,
                ConsultantWithdrawalRequest::STATUS_REJECTED,
                ConsultantWithdrawalRequest::STATUS_CANCELLED,
            ], true)) {
                return $locked;
            }

            $wallet = $this->ledger->forUser($locked->user);
            $this->ledger->post(
                $wallet,
                ConsultantWalletTransaction::TYPE_WITHDRAWAL_RELEASED,
                'credit',
                (float) $locked->amount,
                'withdrawal_released:'.$locked->id,
                'Withdrawal reservation released',
                ConsultantWithdrawalRequest::class,
                $locked->id,
            );

            $before = ['status' => $locked->status];
            $locked->update([
                'status' => $status,
                'reviewed_at' => $locked->reviewed_at ?? now(),
                'processed_by' => $actorId,
                'admin_notes' => $notes ?? $locked->admin_notes,
            ]);
            $this->audit->record('withdrawal_'.$status, 'consultant_withdrawal_request', $locked->id, $before, [
                'status' => $status,
            ], $actorId);

            return $locked->fresh();
        });
    }
}
