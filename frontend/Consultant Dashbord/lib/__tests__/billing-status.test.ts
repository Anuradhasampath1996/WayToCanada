import { describe, expect, it } from "vitest";
import {
  billingPrimaryAction,
  isGraceAccess,
  isPastDueWarning,
  shouldBlockWorkspace,
} from "../billing-status";

describe("billing-status helpers", () => {
  it("shows a past-due warning during grace without blocking", () => {
    const sub = { status: "past_due", in_grace: true, has_live_stripe: true, can_update_payment_method: true };
    expect(isPastDueWarning(sub)).toBe(true);
    expect(isGraceAccess(sub)).toBe(true);
    expect(shouldBlockWorkspace(true)).toBe(false);
    expect(billingPrimaryAction(sub)).toBe("portal");
  });

  it("blocks workspace after grace", () => {
    expect(shouldBlockWorkspace(false)).toBe(true);
    expect(isGraceAccess({ status: "past_due", in_grace: false })).toBe(false);
  });

  it("does not treat two packages as two active subscriptions", () => {
    const current = { status: "active", package_name: "Pro", can_change_plan: true, has_live_stripe: true };
    expect(current.status).toBe("active");
    expect(billingPrimaryAction(current)).toBe("portal");
  });
});
