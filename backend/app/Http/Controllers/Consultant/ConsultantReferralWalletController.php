<?php

namespace App\Http\Controllers\Consultant;

use App\Http\Controllers\Controller;
use App\Models\ConsultantReferral;
use App\Models\ConsultantWalletTransaction;
use App\Models\ConsultantWithdrawalRequest;
use App\Services\Referral\ConsultantWalletLedgerService;
use App\Services\Referral\ReferralCodeService;
use App\Services\Referral\ReferralSettingsService;
use App\Services\Referral\WithdrawalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsultantReferralWalletController extends Controller
{
    public function __construct(
        private ReferralCodeService $codes,
        private ReferralSettingsService $settings,
        private ConsultantWalletLedgerService $ledger,
        private WithdrawalService $withdrawals,
    ) {}

    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();
        $code = $this->codes->ensureForUser($user);
        $wallet = $this->ledger->recompute($this->ledger->forUser($user));
        $rule = $this->settings->current();

        $referrals = ConsultantReferral::query()->where('referrer_user_id', $user->id);
        $total = (clone $referrals)->count();
        $verified = (clone $referrals)->whereIn('status', [
            ConsultantReferral::STATUS_RCIC_VERIFIED,
            ConsultantReferral::STATUS_TRIAL_STARTED,
            ConsultantReferral::STATUS_SUBSCRIBED,
        ])->count();
        $subscribed = (clone $referrals)->where('status', ConsultantReferral::STATUS_SUBSCRIBED)->count();
        $openWithdrawals = ConsultantWithdrawalRequest::query()
            ->where('user_id', $user->id)
            ->whereNotIn('status', [
                ConsultantWithdrawalRequest::STATUS_PAID,
                ConsultantWithdrawalRequest::STATUS_REJECTED,
                ConsultantWithdrawalRequest::STATUS_CANCELLED,
            ])
            ->count();

        return response()->json([
            'code' => $code->code,
            'link' => $code->publicUrl(),
            'program_enabled' => $rule->program_enabled,
            'reward_value' => (float) $rule->reward_value,
            'hold_days' => (int) $rule->hold_days,
            'withdrawal_minimum' => (float) $rule->withdrawal_minimum,
            'wallet_credit_enabled' => (bool) $rule->wallet_credit_enabled,
            'stats' => [
                'total_referrals' => $total,
                'verified' => $verified,
                'successful_paid' => $subscribed,
                'pending_rewards' => (float) $wallet->pending_rewards,
                'available_balance' => (float) $wallet->available_balance,
                'reserved_for_withdrawal' => (float) $wallet->reserved_for_withdrawal,
                'spendable_balance' => (float) $wallet->spendable_balance,
                'pending_withdrawals' => $openWithdrawals,
                'lifetime_earned' => (float) $wallet->lifetime_earned,
                'lifetime_subscription_credits' => (float) $wallet->lifetime_subscription_credits,
                'lifetime_withdrawn' => (float) $wallet->lifetime_withdrawn,
            ],
            'wallet' => $this->walletPayload($wallet),
        ]);
    }

    public function referrals(Request $request): JsonResponse
    {
        $user = $request->user();
        $rows = ConsultantReferral::query()
            ->with(['referred:id,name,created_at,is_license_verified', 'reward'])
            ->where('referrer_user_id', $user->id)
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => collect($rows->items())->map(fn (ConsultantReferral $row) => [
                'id' => $row->id,
                'referred_first_name' => $this->codes->firstName($row->referred),
                'registered_at' => $row->created_at?->toIso8601String(),
                'status' => $row->status,
                'verified' => (bool) $row->referred?->is_license_verified,
                'reward_status' => $row->reward?->status,
                'reward_amount' => $row->reward ? (float) $row->reward->reward_amount_snapshot : null,
                'reward_available_at' => $row->reward?->reward_available_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function wallet(Request $request): JsonResponse
    {
        $wallet = $this->ledger->recompute($this->ledger->forUser($request->user()));

        return response()->json(['wallet' => $this->walletPayload($wallet)]);
    }

    public function transactions(Request $request): JsonResponse
    {
        $wallet = $this->ledger->forUser($request->user());
        $rows = ConsultantWalletTransaction::query()
            ->where('wallet_id', $wallet->id)
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => collect($rows->items())->map(fn (ConsultantWalletTransaction $tx) => [
                'id' => $tx->id,
                'type' => $tx->type,
                'direction' => $tx->direction,
                'amount' => (float) $tx->amount,
                'currency' => $tx->currency,
                'description' => $tx->description,
                'created_at' => $tx->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function updateCreditPreference(Request $request): JsonResponse
    {
        $data = $request->validate([
            'auto_use_wallet_on_renewal' => ['required', 'boolean'],
        ]);

        $wallet = $this->ledger->forUser($request->user());
        $wallet->update(['auto_use_wallet_on_renewal' => (bool) $data['auto_use_wallet_on_renewal']]);

        return response()->json(['wallet' => $this->walletPayload($wallet->fresh())]);
    }

    public function terms(): JsonResponse
    {
        $rule = $this->settings->current();

        return response()->json([
            'terms_markdown' => $rule->terms_markdown,
            'draft_banner' => 'Draft for legal/admin review — not final policy.',
        ]);
    }

    public function withdrawals(Request $request): JsonResponse
    {
        $rows = ConsultantWithdrawalRequest::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => collect($rows->items())->map(fn (ConsultantWithdrawalRequest $row) => $this->withdrawalPayload($row, false))->values(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function storeWithdrawal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'account_holder_name' => ['required', 'string', 'max:120'],
            'bank_name' => ['required', 'string', 'max:120'],
            'account_number' => ['required', 'string', 'max:40'],
            'transit_number' => ['nullable', 'string', 'max:20'],
            'institution_number' => ['nullable', 'string', 'max:20'],
            'routing_swift' => ['nullable', 'string', 'max:40'],
            'country' => ['nullable', 'string', 'size:2'],
            'consultant_note' => ['nullable', 'string', 'max:500'],
        ]);

        $row = $this->withdrawals->request($request->user(), $data);

        return response()->json(['withdrawal' => $this->withdrawalPayload($row, false)], 201);
    }

    public function cancelWithdrawal(Request $request, ConsultantWithdrawalRequest $withdrawal): JsonResponse
    {
        $row = $this->withdrawals->cancelByConsultant($request->user(), $withdrawal);

        return response()->json(['withdrawal' => $this->withdrawalPayload($row, false)]);
    }

    /** @return array<string, mixed> */
    private function walletPayload($wallet): array
    {
        return [
            'currency' => $wallet->currency,
            'pending_rewards' => (float) $wallet->pending_rewards,
            'available_balance' => (float) $wallet->available_balance,
            'reserved_for_withdrawal' => (float) $wallet->reserved_for_withdrawal,
            'spendable_balance' => (float) $wallet->spendable_balance,
            'lifetime_earned' => (float) $wallet->lifetime_earned,
            'lifetime_subscription_credits' => (float) $wallet->lifetime_subscription_credits,
            'lifetime_withdrawn' => (float) $wallet->lifetime_withdrawn,
            'auto_use_wallet_on_renewal' => (bool) $wallet->auto_use_wallet_on_renewal,
            'withdrawals_frozen' => $wallet->withdrawalsFrozen(),
        ];
    }

    /** @return array<string, mixed> */
    private function withdrawalPayload(ConsultantWithdrawalRequest $row, bool $admin): array
    {
        return [
            'id' => $row->id,
            'amount' => (float) $row->amount,
            'currency' => $row->currency,
            'status' => $row->status,
            'account_holder_name' => $row->account_holder_name,
            'bank_name' => $row->bank_name,
            'account_masked' => $row->maskedAccount(),
            'account_number' => $admin ? $row->decryptAccountNumber() : null,
            'institution_number' => $row->institution_number,
            'country' => $row->country,
            'consultant_note' => $row->consultant_note,
            'admin_notes' => $row->admin_notes,
            'payout_reference' => $row->payout_reference,
            'requested_at' => $row->requested_at?->toIso8601String(),
            'paid_at' => $row->paid_at?->toIso8601String(),
            'cancellable' => $row->isCancellableByConsultant(),
        ];
    }
}
