import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "screenshots");
const REPORT = join(__dirname, "SMOKE.md");
const FIXTURE = join(__dirname, "smoke-fixture.json");
const API = "http://127.0.0.1:8000/api/v1";
const APP = "http://127.0.0.1:3005";

mkdirSync(OUT, { recursive: true });

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
}

async function login(page, token) {
  await page.goto(`${APP}/auth/callback#token=${token}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/consultantdashboard|dashboard/, { timeout: 30000 });
}

async function openAssessment(page, profileId) {
  await page.goto(`${APP}/dashboard/clients/${profileId}/workspace/pathway-calculator`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.getByText("Eligibility assessment gates").waitFor({ timeout: 30000 });
}

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const fixtureRaw = readFileSync(FIXTURE);
const fixtureText = fixtureRaw[1] === 0
  ? fixtureRaw.toString("utf16le")
  : fixtureRaw.toString("utf8");
const fixture = JSON.parse(fixtureText.replace(/^\uFEFF/, ""));

const loginRes = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { Accept: "application/json", "Content-Type": "application/json" },
  body: JSON.stringify({ email: fixture.consultant_email, password: fixture.password }),
});
const loginJson = await loginRes.json();
if (!loginRes.ok || !loginJson.token) {
  throw new Error(`Login failed: ${JSON.stringify(loginJson)}`);
}
const token = loginJson.token;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

try {
  await login(page, token);

  // Incomplete client — missing core fields, no consult
  await openAssessment(page, fixture.incomplete_profile_id);
  await shot(page, "01-incomplete-locked");

  const locked = await page.getByText("Select Pathway locked").isVisible();
  record("blocked.consultation_incomplete", locked, locked ? "UI shows Select Pathway locked" : "Lock badge missing");

  const reviewBtn = page.getByRole("button", { name: "Mark profile reviewed" });
  const reviewDisabled = await reviewBtn.isDisabled();
  record("blocked.missing_core_fields", reviewDisabled, reviewDisabled ? "Review button disabled until core fields exist" : "Review should be disabled");

  await page.getByRole("button", { name: "Skip with reason" }).click();
  await page.waitForTimeout(800);
  const skipError = await page.getByText(/recorded reason|Skip reason|min/i).first().isVisible().catch(() => false);
  const stillLocked = await page.getByText("Select Pathway locked").isVisible();
  record("blocked.skip_without_reason", stillLocked, stillLocked ? "Skip without reason did not unlock Select Pathway" : "Skip unlocked without reason");

  await page.goto(`${APP}/dashboard/clients/${fixture.incomplete_profile_id}/workspace/questionnaire-review`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.getByText("Questionnaire review").waitFor({ timeout: 30000 });
  await shot(page, "02-questionnaire-unblocked");
  const onQuestionnaire = page.url().includes("questionnaire-review");
  const questionnaireUi = await page.getByText("Questionnaire review").isVisible();
  record(
    "intake.not_blocked_by_consultation",
    onQuestionnaire && questionnaireUi,
    onQuestionnaire ? "Questionnaire review opened without completing consultation" : page.url(),
  );

  // Complete client — gates then Maple then select
  await openAssessment(page, fixture.complete_profile_id);
  await shot(page, "03-complete-before-gates");

  const blockedSelect = await api(token, "PATCH", `/consultant/clients/${fixture.complete_profile_id}/case-file/select-pathway`, {
    immigration_pathway: "Study Permit",
    pathway_code: "study",
    selection_reason: "Should be blocked before gates.",
  });
  record(
    "blocked.profile_not_reviewed_api",
    blockedSelect.status === 422 && blockedSelect.json.assessment?.can_select_pathway === false,
    `select-pathway before gates HTTP ${blockedSelect.status}`,
  );

  await page.getByRole("button", { name: "Mark consult done" }).click();
  await page.getByRole("button", { name: "Mark profile reviewed" }).click({ timeout: 10000 }).catch(() => {});
  await page.getByText("Select Pathway ready").waitFor({ timeout: 15000 }).catch(() => {});
  await shot(page, "04-gates-complete");
  const ready = await page.getByText("Select Pathway ready").isVisible();
  record("gates.consult_and_review_unlock", ready, ready ? "Select Pathway ready after consult + review" : "Still locked after gates");

  await page.getByRole("button", { name: "Ask Maple" }).click();
  await page.waitForTimeout(2500);
  await shot(page, "05-maple-recommendation");
  const mapleCopy = await page.getByText("Decision support only").isVisible();
  const mapleAfter = await api(token, "GET", `/consultant/clients/${fixture.complete_profile_id}/case-file`);
  const rec = mapleAfter.json.case_file?.maple_recommendation;
  const pathwayStillEmpty = !mapleAfter.json.case_file?.immigration_pathway;
  record("maple.structured_only", Boolean(rec) && mapleCopy, rec ? "Maple recommendation stored" : "No maple_recommendation on case");
  record("maple.never_auto_selects", pathwayStillEmpty, pathwayStillEmpty ? "Pathway still empty after Ask Maple" : `Maple set pathway to ${mapleAfter.json.case_file?.immigration_pathway}`);

  await page.getByRole("button", { name: "Study Permit" }).click();
  await page.waitForTimeout(800);
  await shot(page, "06-study-checklist");
  const studyChecklist = await page.getByText(/checklist assessment|LOA\/DLI|Non-EE family/i).first().isVisible();
  record("routing.study_checklist", studyChecklist, studyChecklist ? "Study family shows checklist, not CRS as primary" : "Study checklist copy missing");

  await page.getByRole("button", { name: "Express Entry" }).click();
  await page.waitForTimeout(800);
  await shot(page, "07-express-entry-crs");
  const eeTools = await page.getByText(/full CRS \/ FSW|Express Entry family/i).first().isVisible();
  record("routing.express_entry_crs", eeTools, eeTools ? "Express Entry routes to CRS/FSW tools" : "EE routing copy missing");

  await page.getByRole("button", { name: "Calculate score" }).first().click();
  await page.waitForTimeout(4000);
  const step2 = page.getByText("Assign pathway", { exact: false }).first();
  if (await step2.isVisible().catch(() => false)) {
    await step2.click();
  }
  await page.waitForTimeout(800);
  await shot(page, "08-before-reason");

  const noReason = await api(token, "PATCH", `/consultant/clients/${fixture.complete_profile_id}/case-file/select-pathway`, {
    immigration_pathway: "Study Permit",
    pathway_code: "study",
  });
  record(
    "blocked.selection_without_reason",
    noReason.status === 422,
    `select-pathway without reason HTTP ${noReason.status}: ${noReason.json.message ?? ""}`,
  );

  await page.getByPlaceholder("Why this pathway?").fill("Study permit matches the client's LOA and funds.");
  // alternatives/risks left empty on purpose
  await shot(page, "09-reason-only");

  const assigned = await api(token, "PATCH", `/consultant/clients/${fixture.complete_profile_id}/case-file/select-pathway`, {
    immigration_pathway: "Study Permit",
    pathway_code: "study",
    selection_reason: "Study permit matches the client's LOA and funds.",
  });
  const plan = assigned.json.requirement_plan;
  record(
    "select.reason_required_and_optional_alts",
    assigned.status === 200 && plan?.plan_version === 1,
    assigned.status === 200
      ? `Plan v${plan.plan_version} key=${plan.registry_key}`
      : `HTTP ${assigned.status} ${assigned.json.message ?? ""}`,
  );
  record(
    "snapshot.versioned_plan",
    Boolean(plan?.id) && plan?.status === "current" && plan?.registry_key === "Study Permit",
    plan ? `case_requirement_plan #${plan.id} v${plan.plan_version}` : "No plan returned",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Eligibility assessment gates").waitFor({ timeout: 30000 });
  await shot(page, "10-after-select");

  const work = await page.getByRole("button", { name: "Work Permit" });
  if (await work.isVisible()) {
    await work.click();
    await page.waitForTimeout(600);
    await shot(page, "11-work-checklist");
    const workList = await page.getByText(/job offer|LMIA|checklist/i).first().isVisible();
    record("routing.work_family", workList, workList ? "Work Permit uses checklist/assessment items" : "Work checklist not shown");
  }

  const family = await page.getByRole("button", { name: "Family Sponsorship" });
  if (await family.isVisible()) {
    await family.click();
    await page.waitForTimeout(600);
    await shot(page, "12-family-checklist");
    const familyList = await page.getByText(/sponsor status|relationship|checklist/i).first().isVisible();
    record("routing.family_family", familyList, familyList ? "Family Sponsorship uses checklist/assessment items" : "Family checklist not shown");
  }
} catch (error) {
  record("runner.exception", false, String(error));
  try {
    await shot(page, "99-error");
  } catch {}
} finally {
  await browser.close();
}

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
const md = [
  "# Phase 1 Eligibility Assessment — browser smoke",
  "",
  `Date: ${new Date().toISOString()}`,
  `Result: ${failed === 0 ? "PASS" : "FAIL"} (${passed} passed, ${failed} failed)`,
  "",
  "| Check | Result | Detail |",
  "|-------|--------|--------|",
  ...results.map((r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail.replaceAll("|", "/")} |`),
  "",
  "Screenshots are in `screenshots/`.",
  "",
].join("\n");

writeFileSync(REPORT, md);
console.log(`\nSMOKE ${failed === 0 ? "PASS" : "FAIL"} ${passed}/${results.length}`);
if (failed > 0) process.exit(1);
