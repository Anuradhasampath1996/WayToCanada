import { describe, expect, it } from "vitest";
import { canSeeNavHref, hasTeamPermission, type TeamSession } from "../team-access";

const staff = (permissions: Record<string, boolean>): TeamSession => ({
  actor_type: "staff",
  permissions,
});

describe("team access nav helpers", () => {
  it("hides billing, wallet, and team management from staff", () => {
    const session = staff({ "dashboard.view": true, "clients.view": true });
    expect(canSeeNavHref(session, "/dashboard/billing")).toBe(false);
    expect(canSeeNavHref(session, "/dashboard/referrals")).toBe(false);
    expect(canSeeNavHref(session, "/dashboard/team")).toBe(false);
    expect(canSeeNavHref(session, "/dashboard/clients")).toBe(true);
  });

  it("requires extra module permissions that default off", () => {
    const session = staff({ "dashboard.view": true });
    expect(canSeeNavHref(session, "/dashboard/letters")).toBe(false);
    expect(canSeeNavHref(session, "/dashboard/legislations")).toBe(false);
    expect(canSeeNavHref(session, "/dashboard/storage")).toBe(false);
    expect(canSeeNavHref(session, "/dashboard/marketing")).toBe(false);
    expect(canSeeNavHref(session, "/dashboard/lms")).toBe(false);
    expect(canSeeNavHref({ ...session, permissions: { ...session.permissions, "letters.use": true } }, "/dashboard/letters")).toBe(true);
    expect(canSeeNavHref({ ...session, permissions: { ...session.permissions, "lms.view": true } }, "/dashboard/lms")).toBe(true);
  });

  it("lets owners see everything", () => {
    const owner: TeamSession = { actor_type: "owner", permissions: {} };
    expect(canSeeNavHref(owner, "/dashboard/team")).toBe(true);
    expect(canSeeNavHref(owner, "/dashboard/referrals")).toBe(true);
    expect(hasTeamPermission(owner, "clients.archive")).toBe(true);
  });
});
