<?php

namespace App\Services\Referral;

use App\Models\ConsultantWallet;
use App\Models\ConsultantWalletTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class ConsultantWalletLedgerService
{
    public function forUser(User $user): ConsultantWallet
    {
        return ConsultantWallet::query()->firstOrCreate(
            ['user_id' => $user->id],
            [
                'currency' => 'CAD',
                'pending_rewards' => 0,
                'available_balance' => 0,
                'reserved_for_withdrawal' => 0,
                'spendable_balance' => 0,
                'lifetime_earned' => 0,
                'lifetime_subscription_credits' => 0,
                'lifetime_withdrawn' => 0,
                'auto_use_wallet_on_renewal' => false,
            ]
        );
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     */
    public function post(
        ConsultantWallet $wallet,
        string $type,
        string $direction,
        float $amount,
        string $idempotencyKey,
        ?string $description = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?array $metadata = null,
        ?int $createdBy = null,
    ): ConsultantWalletTransaction {
        if ($amount < 0) {
            throw new InvalidArgumentException('Ledger amounts must be >= 0.');
        }

        if (! in_array($direction, ['credit', 'debit'], true)) {
            throw new InvalidArgumentException('Ledger direction must be credit or debit.');
        }

        $existing = ConsultantWalletTransaction::query()->where('idempotency_key', $idempotencyKey)->first();
        if ($existing) {
            return $existing;
        }

        return DB::connection('cws')->transaction(function () use (
            $wallet, $type, $direction, $amount, $idempotencyKey, $description,
            $referenceType, $referenceId, $metadata, $createdBy
        ) {
            $locked = ConsultantWallet::query()->whereKey($wallet->id)->lockForUpdate()->firstOrFail();

            try {
                $tx = ConsultantWalletTransaction::query()->create([
                    'wallet_id' => $locked->id,
                    'user_id' => $locked->user_id,
                    'type' => $type,
                    'direction' => $direction,
                    'amount' => $amount,
                    'currency' => 'CAD',
                    'status' => 'posted',
                    'reference_type' => $referenceType,
                    'reference_id' => $referenceId,
                    'idempotency_key' => $idempotencyKey,
                    'description' => $description,
                    'metadata' => $metadata,
                    'created_by' => $createdBy,
                ]);
            } catch (\Illuminate\Database\UniqueConstraintViolationException) {
                return ConsultantWalletTransaction::query()->where('idempotency_key', $idempotencyKey)->firstOrFail();
            }

            $this->recompute($locked);

            return $tx;
        });
    }

    public function recompute(ConsultantWallet $wallet): ConsultantWallet
    {
        $rows = ConsultantWalletTransaction::query()
            ->where('wallet_id', $wallet->id)
            ->where('status', 'posted')
            ->orderBy('id')
            ->get();

        $pending = 0.0;
        $available = 0.0;
        $reservedWithdrawal = 0.0;
        $reservedCredit = 0.0;
        $lifetimeEarned = 0.0;
        $lifetimeCredits = 0.0;
        $lifetimeWithdrawn = 0.0;

        foreach ($rows as $row) {
            $amount = (float) $row->amount;
            $signed = $row->direction === 'debit' ? -$amount : $amount;

            match ($row->type) {
                ConsultantWalletTransaction::TYPE_REWARD_PENDING => $pending += $signed,
                ConsultantWalletTransaction::TYPE_REWARD_AVAILABLE => tap(null, function () use ($signed, &$pending, &$available, &$lifetimeEarned) {
                    $pending -= $signed;
                    $available += $signed;
                    if ($signed > 0) {
                        $lifetimeEarned += $signed;
                    }
                }),
                ConsultantWalletTransaction::TYPE_REWARD_REVERSAL => tap(null, function () use ($row, $amount, &$pending, &$available) {
                    $from = $row->metadata['from'] ?? 'available';
                    if ($from === 'pending') {
                        $pending -= $amount;
                    } else {
                        $available -= $amount;
                    }
                }),
                ConsultantWalletTransaction::TYPE_SUB_CREDIT_RESERVED => $reservedCredit += $amount,
                ConsultantWalletTransaction::TYPE_SUB_CREDIT_RELEASED => $reservedCredit -= $amount,
                ConsultantWalletTransaction::TYPE_SUB_CREDIT_APPLIED => tap(null, function () use ($amount, &$available, &$reservedCredit, &$lifetimeCredits) {
                    $reservedCredit -= $amount;
                    $available -= $amount;
                    $lifetimeCredits += $amount;
                }),
                ConsultantWalletTransaction::TYPE_WITHDRAWAL_RESERVED => $reservedWithdrawal += $amount,
                ConsultantWalletTransaction::TYPE_WITHDRAWAL_RELEASED => $reservedWithdrawal -= $amount,
                ConsultantWalletTransaction::TYPE_WITHDRAWAL_PAID => tap(null, function () use ($amount, &$available, &$reservedWithdrawal, &$lifetimeWithdrawn) {
                    $reservedWithdrawal -= $amount;
                    $available -= $amount;
                    $lifetimeWithdrawn += $amount;
                }),
                ConsultantWalletTransaction::TYPE_ADMIN_CREDIT => $available += $amount,
                ConsultantWalletTransaction::TYPE_ADMIN_DEBIT => $available -= $amount,
                ConsultantWalletTransaction::TYPE_ADMIN_RECOVERY => null,
                default => null,
            };
        }

        $pending = max(0, round($pending, 2));
        $available = round($available, 2);
        $reservedWithdrawal = max(0, round($reservedWithdrawal, 2));
        $reservedCredit = max(0, round($reservedCredit, 2));
        $spendable = round($available - $reservedWithdrawal - $reservedCredit, 2);

        $wallet->forceFill([
            'pending_rewards' => $pending,
            'available_balance' => $available,
            'reserved_for_withdrawal' => $reservedWithdrawal,
            'spendable_balance' => $spendable,
            'lifetime_earned' => round($lifetimeEarned, 2),
            'lifetime_subscription_credits' => round($lifetimeCredits, 2),
            'lifetime_withdrawn' => round($lifetimeWithdrawn, 2),
        ])->save();

        return $wallet->fresh();
    }

    public function spendable(ConsultantWallet $wallet): float
    {
        return (float) $this->recompute($wallet)->spendable_balance;
    }
}
