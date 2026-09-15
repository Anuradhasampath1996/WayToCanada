export type TeamActorType = "owner" | "staff";

export type TeamSession = {
  actor_type: TeamActorType;
  workspace?: {
    id: number;
    owner_name?: string | null;
    firm_name?: string | null;
    owner_user_id?: number;
  } | null;
  preset_key?: string | null;
  job_title?: string | null;
  access_scope?: string | null;
  permissions?: Record<string, boolean>;
  owner_only?: string[];
  member_id?: number;
};

export const OWNER_ONLY_NAV = new Set([
  "/dashboard/billing",
  "/dashboard/referrals",
  "/dashboard/team",
  "/dashboard/subscribe",
]);

const NAV_PERMISSION: Record<string, string> = {
  "/consultantdashboard": "dashboard.view",
  "/dashboard/default": "dashboard.view",
  "/dashboard/legislations": "legislations.view",
  "/dashboard/letters": "letters.use",
  "/dashboard/clients": "clients.view",
  "/dashboard/client-requests": "clients.view",
  "/dashboard/clients/new": "clients.create",
  "/dashboard/case-pipeline": "cases.view",
  "/dashboard/storage": "storage.view",
  "/dashboard/marketing": "marketing.view",
  "/dashboard/rcic-community": "community.view",
};

export function readTeamSession(user: { team?: TeamSession | null; roles?: string[] } | null | undefined): TeamSession | null {
  if (!user) return null;
  if (user.team) return user.team;
  if (user.roles?.includes("staff")) {
    return { actor_type: "staff", permissions: {} };
  }
  if (user.roles?.includes("rcic")) {
    return { actor_type: "owner", permissions: {} };
  }
  return null;
}

export function hasTeamPermission(session: TeamSession | null | undefined, key: string): boolean {
  if (!session) return false;
  if (session.actor_type === "owner") return true;
  return Boolean(session.permissions?.[key]);
}

export function canSeeNavHref(session: TeamSession | null | undefined, href: string): boolean {
  if (!session) return true;
  if (session.actor_type === "owner") {
    return true;
  }
  if (OWNER_ONLY_NAV.has(href) || href.startsWith("/dashboard/billing") || href.startsWith("/dashboard/referrals") || href.startsWith("/dashboard/team")) {
    return false;
  }
  const permission = Object.entries(NAV_PERMISSION).find(([path]) => href === path || href.startsWith(`${path}/`))?.[1];
  if (!permission) return hasTeamPermission(session, "dashboard.view");
  return hasTeamPermission(session, permission);
}

export const PERMISSION_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Dashboard", keys: ["dashboard.view"] },
  { title: "Clients", keys: ["clients.view", "clients.create", "clients.edit", "clients.notes"] },
  { title: "Cases", keys: ["cases.view", "cases.create", "cases.edit", "cases.notes", "cases.tasks", "cases.assign", "cases.status_update"] },
  { title: "Documents", keys: ["documents.view", "documents.request", "documents.upload", "documents.request_correction"] },
  { title: "Forms", keys: ["forms.view", "forms.prepare", "forms.edit"] },
  { title: "Assessments & pathways", keys: ["assessments.view", "assessments.prepare", "pathways.view", "pathways.recommend"] },
  { title: "Application", keys: ["application.prepare", "application.review", "submission.view"] },
  { title: "Calendar & tasks", keys: ["calendar.view", "calendar.manage", "tasks.view", "tasks.create", "tasks.edit"] },
  { title: "Communication", keys: ["communications.view", "communications.send"] },
  { title: "Team", keys: ["team.view"] },
  { title: "Extra modules", keys: ["letters.use", "legislations.view", "community.view", "storage.view", "storage.manage", "marketing.view", "lms.view", "academy.learn"] },
];

export const OWNER_ONLY_LABELS = [
  "Final profile / information approval",
  "Questionnaire final verification",
  "Final pathway confirmation",
  "Official document verify / approve / reject",
  "Official form review",
  "Representative send / review / complete",
  "Final consultant review / sign-off",
  "Ready-for-client / ready-to-submit",
  "Confirm submission portal / record government submission",
  "Post-submission decision / close case",
  "Send retainer / use owner digital signature",
  "Platform subscription, referral, wallet, team management",
];
