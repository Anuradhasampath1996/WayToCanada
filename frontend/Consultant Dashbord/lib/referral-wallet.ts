export type ReferralWalletBalances = {
  pending_rewards: number;
  available_balance: number;
  reserved_for_withdrawal: number;
  spendable_balance: number;
};

export function spendableBalance(available: number, reserved: number): number {
  return Math.max(0, roundMoney(available - reserved));
}

export function canWithdraw(
  amount: number,
  spendable: number,
  minimum: number,
  frozen = false,
): { ok: boolean; reason?: string } {
  if (frozen) return { ok: false, reason: "frozen" };
  if (amount < minimum) return { ok: false, reason: "below_minimum" };
  if (amount > spendable) return { ok: false, reason: "over_spendable" };
  return { ok: true };
}

export function referralRewardCopy(status: string | null | undefined): string {
  switch (status) {
    case "pending":
      return "Pending hold";
    case "available":
      return "Available";
    case "cancelled":
      return "Cancelled";
    case "reversed":
      return "Reversed";
    case "rejected":
      return "Rejected";
    default:
      return "No reward yet";
  }
}

export function selfReferralBlockedMessage(): string {
  return "You cannot refer yourself. Share this link with another consultant.";
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
