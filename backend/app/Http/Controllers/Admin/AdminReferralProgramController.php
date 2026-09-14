<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ConsultantReferral;
use App\Models\ConsultantWalletTransaction;
use App\Models\ConsultantWithdrawalRequest;
use App\Models\ReferralRiskFlag;
use App\Models\User;
use App\Services\Referral\ConsultantWalletLedgerService;
use App\Services\Referral\ReferralAuditService;
use App\Services\Referral\ReferralSettingsService;
use App\Services\Referral\WithdrawalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminReferralProgramController extends Controller
{
    public function __construct(
        private ReferralSettingsService $settings,
        private ReferralAuditService $audit,
        private ConsultantWalletLedgerService $ledger,
        private WithdrawalService $withdrawals,
    ) {}

    public function settings(): JsonResponse
    {
        $rule = $this->settings->current();

        return response()->json(['settings' => $this->settingsPayload($rule)]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'program_enabled' => ['required', 'boolean'],
            'reward_value' => ['required', 'numeric', 'min:0'],
            'hold_days' => ['required', 'integer', 'min:0', 'max:90'],
            'withdrawal_minimum' => ['required', 'numeric', 'min:0'],
            'withdrawal_maximum' => ['nullable', 'numeric', 'min:0'],
            'wallet_credit_enabled' => ['required', 'boolean'],
            'eligible_package_ids' => ['nullable', 'array'],
            'eligible_package_ids.*' => ['integer'],
            'terms_markdown' => ['nullable', 'string'],
        ]);

        $before = $this->settingsPayload($this->settings->current());
        $rule = $this->settings->publish($data, $request->user()->id);
        $this->audit->recordFromRequest($request, 'settings_published', 'referral_reward_rule', $rule->id, $before, $this->settingsPayload($rule));

        return response()->json(['settings' => $this->settingsPayload($rule)]);
    }

    public function referrals(Request $request): JsonResponse
    {
        $query = ConsultantReferral::query()
            ->with(['referrer:id,name,email', 'referred:id,name,email,is_license_verified', 'reward'])
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        $rows = $query->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => collect($rows->items())->map(fn (ConsultantReferral $row) => [
                'id' => $row->id,
                'referrer' => ['id' => $row->referrer?->id, 'name' => $row->referrer?->name, 'email' => $row->referrer?->email],
                'referred' => ['id' => $row->referred?->id, 'name' => $row->referred?->name, 'email' => $row->referred?->email],
                'status' => $row->status,
                'qualified_at' => $row->qualified_at?->toIso8601String(),
                'reward_status' => $row->reward?->status,
                'reward_amount' => $row->reward ? (float) $row->reward->reward_amount_snapshot : null,
            ])->values(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function updateReferral(Request $request, ConsultantReferral $referral): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', 'in:registered,rcic_verified,trial_started,subscribed,rejected'],
            'admin_note' => ['nullable', 'string', 'max:500'],
        ]);

        $before = ['status' => $referral->status];
        if (isset($data['status'])) {
            $referral->update(['status' => $data['status']]);
        }
        $this->audit->recordFromRequest($request, 'referral_corrected', 'consultant_referral', $referral->id, $before, [
            'status' => $referral->status,
            'admin_note' => $data['admin_note'] ?? null,
        ]);

        return response()->json(['referral' => $referral->fresh(['referrer', 'referred', 'reward'])]);
    }

    public function ledger(Request $request): JsonResponse
    {
        $query = ConsultantWalletTransaction::query()->with('wallet')->orderByDesc('id');
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        $rows = $query->paginate($request->integer('per_page', 30));

        return response()->json([
            'data' => collect($rows->items())->map(fn (ConsultantWalletTransaction $tx) => [
                'id' => $tx->id,
                'user_id' => $tx->user_id,
                'type' => $tx->type,
                'direction' => $tx->direction,
                'amount' => (float) $tx->amount,
                'description' => $tx->description,
                'idempotency_key' => $tx->idempotency_key,
                'created_at' => $tx->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function withdrawals(Request $request): JsonResponse
    {
        $query = ConsultantWithdrawalRequest::query()->with('user:id,name,email')->orderByDesc('id');
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        $rows = $query->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => collect($rows->items())->map(fn (ConsultantWithdrawalRequest $row) => $this->adminWithdrawal($row))->values(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function reviewWithdrawal(Request $request, ConsultantWithdrawalRequest $withdrawal): JsonResponse
    {
        return response()->json([
            'withdrawal' => $this->adminWithdrawal($this->withdrawals->review($withdrawal, $request->user()->id)),
        ]);
    }

    public function approveWithdrawal(Request $request, ConsultantWithdrawalRequest $withdrawal): JsonResponse
    {
        return response()->json([
            'withdrawal' => $this->adminWithdrawal($this->withdrawals->approve($withdrawal, $request->user()->id, $request->input('admin_notes'))),
        ]);
    }

    public function rejectWithdrawal(Request $request, ConsultantWithdrawalRequest $withdrawal): JsonResponse
    {
        return response()->json([
            'withdrawal' => $this->adminWithdrawal($this->withdrawals->reject($withdrawal, $request->user()->id, $request->input('admin_notes'))),
        ]);
    }

    public function processingWithdrawal(Request $request, ConsultantWithdrawalRequest $withdrawal): JsonResponse
    {
        return response()->json([
            'withdrawal' => $this->adminWithdrawal($this->withdrawals->markProcessing($withdrawal, $request->user()->id, $request->input('admin_notes'))),
        ]);
    }

    public function paidWithdrawal(Request $request, ConsultantWithdrawalRequest $withdrawal): JsonResponse
    {
        $data = $request->validate([
            'payout_reference' => ['required', 'string', 'max:120'],
            'admin_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        return response()->json([
            'withdrawal' => $this->adminWithdrawal($this->withdrawals->markPaid(
                $withdrawal,
                $request->user()->id,
                $data['payout_reference'],
                $data['admin_notes'] ?? null,
            )),
        ]);
    }

    public function adjustWallet(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'direction' => ['required', 'in:credit,debit'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $wallet = $this->ledger->forUser($user);
        $type = $data['direction'] === 'credit'
            ? ConsultantWalletTransaction::TYPE_ADMIN_CREDIT
            : ConsultantWalletTransaction::TYPE_ADMIN_DEBIT;

        $tx = $this->ledger->post(
            $wallet,
            $type,
            $data['direction'],
            (float) $data['amount'],
            'admin_adjust:'.$user->id.':'.now()->timestamp.':'.substr(hash('sha256', $data['reason']), 0, 8),
            $data['reason'],
            'admin_adjustment',
            $request->user()->id,
            ['reason' => $data['reason']],
            $request->user()->id,
        );

        $this->audit->recordFromRequest($request, 'wallet_adjusted', 'consultant_wallet', $wallet->id, null, [
            'direction' => $data['direction'],
            'amount' => (float) $data['amount'],
            'reason' => $data['reason'],
        ]);

        return response()->json([
            'transaction' => [
                'id' => $tx->id,
                'type' => $tx->type,
                'amount' => (float) $tx->amount,
            ],
            'wallet' => $this->ledger->recompute($wallet->fresh()),
        ]);
    }

    public function riskFlags(Request $request): JsonResponse
    {
        $query = ReferralRiskFlag::query()->with(['referral'])->orderByDesc('id');
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        $rows = $query->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => $rows->items(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function clearRiskFlag(Request $request, ReferralRiskFlag $flag): JsonResponse
    {
        $flag->update([
            'status' => 'cleared',
            'cleared_at' => now(),
        ]);
        $this->audit->recordFromRequest($request, 'risk_flag_cleared', 'referral_risk_flag', $flag->id);

        return response()->json(['flag' => $flag->fresh()]);
    }

    public function unfreezeWallet(Request $request, User $user): JsonResponse
    {
        $wallet = $this->ledger->forUser($user);
        $wallet->update(['withdrawals_frozen_at' => null]);
        $this->audit->recordFromRequest($request, 'wallet_unfrozen', 'consultant_wallet', $wallet->id);

        return response()->json(['wallet' => $wallet->fresh()]);
    }

    /** @return array<string, mixed> */
    private function settingsPayload($rule): array
    {
        return [
            'version' => $rule->version,
            'program_enabled' => (bool) $rule->program_enabled,
            'reward_type' => $rule->reward_type,
            'reward_value' => (float) $rule->reward_value,
            'currency' => $rule->currency,
            'eligible_package_ids' => $rule->eligible_package_ids,
            'hold_days' => (int) $rule->hold_days,
            'withdrawal_minimum' => (float) $rule->withdrawal_minimum,
            'withdrawal_maximum' => $rule->withdrawal_maximum !== null ? (float) $rule->withdrawal_maximum : null,
            'wallet_credit_enabled' => (bool) $rule->wallet_credit_enabled,
            'terms_markdown' => $rule->terms_markdown,
        ];
    }

    /** @return array<string, mixed> */
    private function adminWithdrawal(ConsultantWithdrawalRequest $row): array
    {
        return [
            'id' => $row->id,
            'user' => ['id' => $row->user?->id, 'name' => $row->user?->name, 'email' => $row->user?->email],
            'amount' => (float) $row->amount,
            'status' => $row->status,
            'account_holder_name' => $row->account_holder_name,
            'bank_name' => $row->bank_name,
            'account_masked' => $row->maskedAccount(),
            'account_number' => $row->decryptAccountNumber(),
            'transit_number' => $row->transit_number_encrypted ? \Illuminate\Support\Facades\Crypt::decryptString($row->transit_number_encrypted) : null,
            'institution_number' => $row->institution_number,
            'routing_swift' => $row->routing_swift,
            'country' => $row->country,
            'consultant_note' => $row->consultant_note,
            'admin_notes' => $row->admin_notes,
            'payout_reference' => $row->payout_reference,
            'requested_at' => $row->requested_at?->toIso8601String(),
            'paid_at' => $row->paid_at?->toIso8601String(),
        ];
    }
}
