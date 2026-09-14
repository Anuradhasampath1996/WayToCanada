import { describe, expect, it } from "vitest";
import {
  canWithdraw,
  referralRewardCopy,
  selfReferralBlockedMessage,
  spendableBalance,
} from "../referral-wallet";

describe("referral wallet helpers", () => {
  it("computes spendable as available minus reserved", () => {
    expect(spendableBalance(200, 100)).toBe(100);
    expect(spendableBalance(40, 50)).toBe(0);
  });

  it("rejects withdrawals below minimum or over spendable", () => {
    expect(canWithdraw(49, 200, 50).ok).toBe(false);
    expect(canWithdraw(80, 50, 50).reason).toBe("over_spendable");
    expect(canWithdraw(50, 80, 50).ok).toBe(true);
    expect(canWithdraw(50, 80, 50, true).reason).toBe("frozen");
  });

  it("shows reward status copy and self-referral message", () => {
    expect(referralRewardCopy("pending")).toBe("Pending hold");
    expect(referralRewardCopy(null)).toBe("No reward yet");
    expect(selfReferralBlockedMessage()).toContain("cannot refer yourself");
  });
});
