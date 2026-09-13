export type PlatformBillingStatus =
  | "trial"
  | "active"
  | "past_due"
  | "expired"
  | "cancelled"
  | "payment_declined";

export type PlatformSubscriptionView = {
  status: string;
  package_name?: string | null;
  billing_cycle?: string | null;
  in_grace?: boolean;
  grace_ends_at?: string | null;
  cancel_at_period_end?: boolean;
  can_update_payment_method?: boolean;
  can_change_plan?: boolean;
  has_live_stripe?: boolean;
  access_active?: boolean;
};

export function isPastDueWarning(sub: PlatformSubscriptionView | null | undefined): boolean {
  return sub?.status === "past_due";
}

export function isGraceAccess(sub: PlatformSubscriptionView | null | undefined): boolean {
  return sub?.status === "past_due" && Boolean(sub.in_grace);
}

export function shouldBlockWorkspace(isActive: boolean): boolean {
  return !isActive;
}

export function billingPrimaryAction(sub: PlatformSubscriptionView | null | undefined): "portal" | "change-plan" | "subscribe" {
  if (sub?.can_update_payment_method || sub?.has_live_stripe) return "portal";
  if (sub?.can_change_plan) return "change-plan";
  return "subscribe";
}
