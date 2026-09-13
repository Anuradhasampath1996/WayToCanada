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

async function completeGates(token, profileId) {
  await api(token, "POST", `/consultant/clients/${profileId}/case-file/consultation/complete`, {
    notes: "Phase 2 smoke consult.",
  });
  await api(token, "POST", `/consultant/clients/${profileId}/case-file/profile-review`);
}

function ids(items, key = "id") {
  return (items ?? []).map((item) => item[key]);
}

function hasReuse(docs, docId) {
  return Boolean((docs ?? []).find((d) => d.id === docId)?.reuse_candidate);
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
  await page.goto(`${APP}/auth/callback#token=${token}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/consultantdashboard|dashboard/, { timeout: 30000 });

  await completeGates(token, fixture.study_profile_id);
  await completeGates(token, fixture.ee_profile_id);

  const studySelect = await api(token, "PATCH", `/consultant/clients/${fixture.study_profile_id}/case-file/select-pathway`, {
    immigration_pathway: "Study Permit",
    pathway_code: "study",
    selection_reason: "Study permit matches LOA and program start date.",
  });
  const study = studySelect.json.assignment ?? {};
  const studyDocs = ids(study.documents);
  const studyForms = ids(study.forms, "code");

  record(
    "study.forms_and_docs",
    studySelect.status === 200
      && studyForms.includes("IMM 1294")
      && studyDocs.includes("acceptance_letter")
      && !studyForms.includes("IMM 0008")
      && !studyDocs.includes("eca")
      && !studyDocs.includes("express_entry_profile"),
    studySelect.status === 200
      ? `Study forms=${studyForms.join(", ")} docs=${studyDocs.join(", ")}`
      : `HTTP ${studySelect.status} ${studySelect.json.message ?? ""}`,
  );

  await page.goto(`${APP}/dashboard/clients/${fixture.study_profile_id}/workspace/pathway-calculator`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.getByText("Auto-assigned to client").waitFor({ timeout: 30000 });
  await page.getByText("IMM 1294").first().waitFor({ timeout: 20000 });
  await page.getByText(/intake file on file|Reused from intake/i).first().waitFor({ timeout: 15000 });
  await shot(page, "01-study-assignment");
  const studyUi = await page.getByText("IMM 1294").first().isVisible()
    && await page.getByText("Letter of acceptance").first().isVisible();
  const studyNoEe = !await page.getByText("Educational Credential Assessment (ECA)").isVisible().catch(() => false);
  record("study.ui_not_ee", studyUi && studyNoEe, studyUi && studyNoEe
    ? "Study panel shows study forms/docs, not EE-only ECA"
    : "Study assignment UI missing or leaked EE items");

  const studyReuse = hasReuse(study.documents, "passport")
    && hasReuse(study.documents, "ielts_results")
    && hasReuse(study.documents, "transcripts");
  const reuseUi = await page.getByText("intake file on file").first().isVisible();
  record(
    "reuse.intake_candidates",
    studyReuse && reuseUi,
    studyReuse && reuseUi
      ? "Passport, language, and education reuse candidates shown"
      : `reuse api=${studyReuse} ui=${reuseUi}`,
  );

  const eeSelect = await api(token, "PATCH", `/consultant/clients/${fixture.ee_profile_id}/case-file/select-pathway`, {
    immigration_pathway: "Express Entry – Canadian Experience Class",
    pathway_code: "ee.cec",
    selection_reason: "CEC fits Canadian work history and intended NOC.",
  });
  const ee = eeSelect.json.assignment ?? {};
  const eeDocs = ids(ee.documents);
  const eeForms = ids(ee.forms, "code");

  record(
    "ee.forms_and_docs",
    eeSelect.status === 200
      && eeForms.includes("IMM 0008")
      && eeDocs.includes("express_entry_profile")
      && !eeForms.includes("IMM 1294")
      && !eeDocs.includes("acceptance_letter"),
    eeSelect.status === 200
      ? `EE forms=${eeForms.join(", ")} docs=${eeDocs.join(", ")}`
      : `HTTP ${eeSelect.status} ${eeSelect.json.message ?? ""}`,
  );

  await page.goto(`${APP}/dashboard/clients/${fixture.ee_profile_id}/workspace/pathway-calculator`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.getByText("Auto-assigned to client").waitFor({ timeout: 30000 });
  await page.getByText("IMM 0008").first().waitFor({ timeout: 20000 });
  await shot(page, "02-ee-assignment");
  const eeUi = await page.getByText("IMM 0008").first().isVisible()
    && await page.getByText("Express Entry profile confirmation").first().isVisible();
  const eeNoStudy = !await page.getByText("Letter of acceptance").isVisible().catch(() => false);
  record("ee.ui_not_study", eeUi && eeNoStudy, eeUi && eeNoStudy
    ? "EE panel shows EE forms/docs, not Study LOA"
    : "EE assignment UI missing or leaked Study items");

  const firstPlanId = studySelect.json.requirement_plan?.id;
  const firstVersion = studySelect.json.requirement_plan?.plan_version;
  const change = await api(token, "PATCH", `/consultant/clients/${fixture.study_profile_id}/case-file/select-pathway`, {
    immigration_pathway: "Work Permit",
    pathway_code: "work",
    selection_reason: "Employer offer arrived; switching from study to work.",
    change_note: "Employer offer arrived; switching from study to work.",
  });
  const changed = change.json.assignment ?? {};
  const changedDocs = ids(changed.documents);
  const changedForms = ids(changed.forms, "code");
  const obsolete = change.json.requirement_plan?.snapshot?.obsolete_items ?? [];
  const obsoleteKeys = obsolete.map((item) => item.key ?? item.id);
  const history = await api(token, "GET", `/consultant/clients/${fixture.study_profile_id}/case-file/case-history`);
  const events = history.json.events ?? [];
  const changedEvent = events.find((e) => e.event_type === "pathway_changed");
  const newVersion = change.json.requirement_plan?.plan_version;
  const previousKept = Boolean(change.json.requirement_plan?.previous_plan_id) && newVersion > firstVersion;

  record(
    "change.non_destructive",
    change.status === 200
      && previousKept
      && Boolean(firstPlanId)
      && changedForms.includes("IMM 1295")
      && changedDocs.includes("lmia_job_offer")
      && !changedDocs.includes("acceptance_letter")
      && obsoleteKeys.includes("dli_number")
      && obsoleteKeys.includes("acceptance_letter")
      && Boolean(changedEvent),
    change.status === 200
      ? `v${firstVersion}->v${newVersion} prev=${change.json.requirement_plan?.previous_plan_id} obsolete=${[...new Set(obsoleteKeys)].join(", ")} history=${changedEvent?.event_type}`
      : `HTTP ${change.status} ${change.json.message ?? ""}`,
  );

  await page.goto(`${APP}/dashboard/clients/${fixture.study_profile_id}/workspace/pathway-calculator`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.getByText("Auto-assigned to client").waitFor({ timeout: 30000 });
  await page.getByText("IMM 1295").first().waitFor({ timeout: 20000 });
  await page.getByText(/LMIA-approved|Signed employment contract/i).first().waitFor({ timeout: 15000 });
  await shot(page, "03-after-pathway-change");
  const workUi = await page.getByText("IMM 1295").first().isVisible()
    && await page.getByText(/LMIA-approved|Signed employment contract/i).first().isVisible();
  record("change.ui_work_plan", workUi, workUi
    ? "After change, Work Permit checklist replaced Study items"
    : "Work assignment UI not shown after pathway change");
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
  "# Phase 2 Auto-assign — browser smoke",
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
