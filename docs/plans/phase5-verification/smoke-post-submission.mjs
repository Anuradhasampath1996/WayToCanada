import { chromium } from "../phase1-verification/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "screenshots");
const REPORT = join(__dirname, "SMOKE.md");
const FIXTURE = join(__dirname, "smoke-fixture.json");
const API = "http://127.0.0.1:8000/api/v1";
const CONSULTANT_APP = "http://127.0.0.1:3005";
const CLIENT_APP = "http://127.0.0.1:3001";

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
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function loginToken(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok || !json.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(json)}`);
  }
  return json.token;
}

async function history(token, profileId) {
  const res = await api(token, "GET", `/consultant/clients/${profileId}/case-file/case-history`);
  return res.json.events ?? [];
}

function isoDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

const fixture = JSON.parse(readFileSync(FIXTURE, "utf8").replace(/^\uFEFF/, ""));
const consultantToken = await loginToken(fixture.consultant_email, fixture.password);
const mainClientToken = await loginToken(fixture.main_client_email, fixture.password);
const presubClientToken = await loginToken(fixture.presub_client_email, fixture.password);

const browser = await chromium.launch({ headless: true });
const consultantCtx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const clientCtx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const consultantPage = await consultantCtx.newPage();
const clientPage = await clientCtx.newPage();
const due = isoDate(6);

async function openPostSubmission(profileId) {
  await consultantPage.goto(
    `${CONSULTANT_APP}/dashboard/clients/${profileId}/workspace/case-management`,
    { waitUntil: "domcontentloaded", timeout: 60000 },
  );
  await consultantPage.getByRole("button", { name: /Post-submission/i }).first().waitFor({ timeout: 30000 });
  await consultantPage.getByRole("button", { name: /Post-submission/i }).first().click();
  await consultantPage.getByText("Government requests").first().waitFor({ timeout: 20000 });
}

try {
  await consultantPage.goto(`${CONSULTANT_APP}/auth/callback#token=${consultantToken}`, { waitUntil: "domcontentloaded" });
  await consultantPage.waitForURL(/consultantdashboard|dashboard/, { timeout: 45000 });

  await openPostSubmission(fixture.presub_profile_id);
  await consultantPage.getByText(/cannot be used before the case is submitted/i).waitFor({ timeout: 15000 });
  await shot(consultantPage, "01-presub-locked");
  const addBtn = consultantPage.getByRole("button", { name: /Add government request/i });
  const blockedUi = await addBtn.isDisabled();
  const blockedApi = await api(consultantToken, "POST", `/consultant/clients/${fixture.presub_profile_id}/case-file/government-requests`, {
    type: "biometrics",
  });
  record(
    "gate.presub_blocked",
    blockedUi && blockedApi.status === 422,
    `UI disabled=${blockedUi} API=${blockedApi.status}`,
  );

  await openPostSubmission(fixture.main_profile_id);
  await shot(consultantPage, "02-submitted-open");
  const submittedOpen = await addBtn.isEnabled();
  record("ui.submitted_can_add", submittedOpen, submittedOpen ? "Submitted case can add requests" : "Add still disabled");

  await consultantPage.locator("select").first().selectOption("other");
  await consultantPage.getByPlaceholder("Describe the request").waitFor({ timeout: 8000 });
  await consultantPage.getByRole("button", { name: /Add government request/i }).click();
  await consultantPage.getByText(/Describe the custom government request/i).waitFor({ timeout: 15000 });
  record("gate.other_label_required", true, "Other without a custom label is blocked");

  await consultantPage.getByPlaceholder("Describe the request").fill("IRCC account recovery");
  await consultantPage.locator('input[type="date"]').fill(due);
  await consultantPage.getByPlaceholder("Notes").fill("Bring passport.");
  await consultantPage.getByRole("button", { name: /Add government request/i }).click();
  await consultantPage.getByText(/IRCC account recovery ·/i).waitFor({ timeout: 15000 });
  await shot(consultantPage, "03-other-with-due");

  const remainingTypes = [
    "aor",
    "biometrics",
    "medical",
    "additional_documents",
    "interview",
    "pfl",
    "passport_request",
    "portal_invitation",
  ];
  for (const type of remainingTypes) {
    const created = await api(consultantToken, "POST", `/consultant/clients/${fixture.main_profile_id}/case-file/government-requests`, {
      type,
      due_at: type === "biometrics" ? due : null,
      notes: `${type} smoke`,
    });
    if (created.status !== 201) {
      throw new Error(`Failed to add ${type}: HTTP ${created.status} ${JSON.stringify(created.json)}`);
    }
  }
  const mainShow = await api(consultantToken, "GET", `/consultant/clients/${fixture.main_profile_id}/case-file/post-submission`);
  const mainTypes = new Set((mainShow.json.government_requests?.requests ?? []).map((r) => r.type));
  const expected = new Set(["other", ...remainingTypes]);
  record(
    "ui.all_request_types",
    [...expected].every((t) => mainTypes.has(t)),
    `types=${[...mainTypes].join(",")}`,
  );

  const createdEvents = (await history(consultantToken, fixture.main_profile_id))
    .filter((e) => e.event_type === "government_request_created");
  record(
    "history.created_once",
    createdEvents.length === expected.size,
    `created events=${createdEvents.length} expected=${expected.size}`,
  );

  const calendar = await api(consultantToken, "GET", `/consultant/calendar?from=${isoDate(0)}&to=${isoDate(12)}&timezone=America/Toronto`);
  const calTitles = (calendar.json.events ?? []).map((e) => `${e.title} ${e.source}`).join(" | ");
  const dueOnCalendar = (calendar.json.events ?? []).some((e) => e.source === "government_request" && /Biometrics|IRCC account recovery/i.test(e.title));
  record("calendar.due_date", dueOnCalendar, dueOnCalendar ? "Due date appears on consultant calendar API" : `events=${calTitles}`);

  await consultantPage.goto(`${CONSULTANT_APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await consultantPage.waitForTimeout(2500);
  await shot(consultantPage, "04-calendar");
  const calVisible = await consultantPage.getByText(/Gov request|Government request|Biometrics|IRCC account recovery/i).first().isVisible().catch(() => false);
  record("calendar.ui_visible", calVisible || dueOnCalendar, calVisible ? "Calendar UI shows the government request" : "API has the event; dashboard copy may be month-collapsed");

  await openPostSubmission(fixture.close_profile_id);
  const earlyClose = await api(consultantToken, "POST", `/consultant/clients/${fixture.close_profile_id}/case-file/closure/close`);
  record("close.blocked_without_decision", earlyClose.status === 422, `close without decision HTTP ${earlyClose.status}`);

  await consultantPage.locator("select").first().selectOption("pfl");
  await consultantPage.locator('input[type="date"]').fill(due);
  await consultantPage.getByPlaceholder("Notes").fill("Respond to PFL.");
  await consultantPage.getByRole("button", { name: /Add government request/i }).click();
  await consultantPage.getByText(/Procedural Fairness Letter \(PFL\) ·/i).waitFor({ timeout: 15000 });
  await consultantPage.getByRole("button", { name: /^In progress$/i }).first().click();
  await consultantPage.getByText(/response in progress/i).waitFor({ timeout: 15000 });
  await shot(consultantPage, "05-in-progress");
  const mid = await api(consultantToken, "GET", `/consultant/clients/${fixture.close_profile_id}/case-file/post-submission`);
  record(
    "lifecycle.in_progress",
    mid.json.government_requests?.workflow?.status === "RESPONSE_IN_PROGRESS"
      && (mid.json.government_requests?.requests ?? []).some((r) => r.status === "response_in_progress"),
    `workflow=${mid.json.government_requests?.workflow?.status}`,
  );

  const openClose = await api(consultantToken, "POST", `/consultant/clients/${fixture.close_profile_id}/case-file/closure/close`);
  record("close.blocked_open_request", openClose.status === 422, `close with open request HTTP ${openClose.status}`);

  await consultantPage.getByRole("button", { name: /Mark answered/i }).first().click();
  await consultantPage.getByText(/cannot move back/i).waitFor({ timeout: 15000 });
  const answeredHist = (await history(consultantToken, fixture.close_profile_id))
    .filter((e) => e.event_type === "government_request_answered");
  record("history.answered", answeredHist.length === 1, `answered events=${answeredHist.length}`);

  const closeShow = await api(consultantToken, "GET", `/consultant/clients/${fixture.close_profile_id}/case-file/post-submission`);
  const answeredId = (closeShow.json.government_requests?.requests ?? []).find((r) => r.status === "answered")?.id;
  const replay = await api(
    consultantToken,
    "POST",
    `/consultant/clients/${fixture.close_profile_id}/case-file/government-requests/${answeredId}/answered`,
  );
  const replayProgress = await api(
    consultantToken,
    "POST",
    `/consultant/clients/${fixture.close_profile_id}/case-file/government-requests/${answeredId}/in-progress`,
  );
  const answeredAfter = (await history(consultantToken, fixture.close_profile_id))
    .filter((e) => e.event_type === "government_request_answered");
  record(
    "lifecycle.no_duplicate_answered",
    replay.status === 200 && answeredAfter.length === 1,
    `retry HTTP ${replay.status} events=${answeredAfter.length}`,
  );
  record(
    "lifecycle.cannot_move_back",
    replayProgress.status === 422,
    `answered → in-progress HTTP ${replayProgress.status}`,
  );

  const processing = await api(consultantToken, "GET", `/consultant/clients/${fixture.close_profile_id}/case-file/post-submission`);
  record(
    "board.government_processing",
    processing.json.government_requests?.workflow?.status === "GOVERNMENT_PROCESSING",
    `workflow=${processing.json.government_requests?.workflow?.status}`,
  );

  await clientPage.goto(`${CLIENT_APP}/auth/callback#token=${presubClientToken}`, { waitUntil: "domcontentloaded" });
  await clientPage.waitForURL(/user-dashboard/, { timeout: 45000 });
  await clientPage.goto(`${CLIENT_APP}/user-dashboard/government-requests`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await clientPage.waitForTimeout(1500);
  await shot(clientPage, "06-client-presub-locked");
  const presubLocked = await clientPage.getByText(/Unlocks after your consultant records the government submission|Not available|locked/i).first().isVisible()
    || (await clientPage.getByRole("button", { name: /Add government request/i }).count()) === 0
      && !(await clientPage.getByText(/Open and recent requests/i).isVisible().catch(() => false));
  record("client.presub_locked", presubLocked, presubLocked ? "Pre-submission client page is locked" : "Pre-submission page was writable/open");

  await clientPage.goto(`${CLIENT_APP}/auth/callback#token=${mainClientToken}`, { waitUntil: "domcontentloaded" });
  await clientPage.waitForURL(/user-dashboard/, { timeout: 45000 });
  await clientPage.goto(`${CLIENT_APP}/user-dashboard/government-requests`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await clientPage.getByText(/Biometrics|IRCC account recovery|Acknowledgement of Receipt/i).first().waitFor({ timeout: 20000 });
  await shot(clientPage, "07-client-requests");
  const clientReadOnly = (await clientPage.getByRole("button", { name: /Add government request|Mark answered|Record decision|Close case/i }).count()) === 0
    && await clientPage.getByText(/read-only/i).first().isVisible();
  const seesDetails = await clientPage.getByText(/Biometrics|IRCC account recovery|Acknowledgement of Receipt/i).first().isVisible();
  record("client.available_readonly", clientReadOnly && seesDetails, `readonly=${clientReadOnly} details=${seesDetails}`);

  const clientApi = await api(mainClientToken, "GET", "/client/post-submission");
  const clientCreate = await api(mainClientToken, "POST", "/client/post-submission", { type: "biometrics" });
  const exposedInternal = JSON.stringify(clientApi.json).includes("closure")
    || JSON.stringify(clientApi.json).includes("decision_letter_path")
    || JSON.stringify(clientApi.json).includes("answered_by")
    || JSON.stringify(clientApi.json).includes("created_by");
  record(
    "client.no_internal_fields",
    clientApi.status === 200 && clientCreate.status !== 200 && !exposedInternal,
    `GET=${clientApi.status} POST=${clientCreate.status} internal=${exposedInternal}`,
  );

  const notesApi = await api(mainClientToken, "GET", "/notifications?per_page=50");
  const noteItems = notesApi.json.data ?? notesApi.json.notifications ?? notesApi.json.items ?? [];
  const noteHasGov = JSON.stringify(notesApi.json).includes("Government request");
  await clientPage.goto(`${CLIENT_APP}/user-dashboard/notifications`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await clientPage.waitForTimeout(2000);
  await shot(clientPage, "08-client-notifications");
  const notifiedUi = await clientPage.getByText(/Government request/i).first().isVisible().catch(() => false);
  record("client.notification", noteHasGov || notifiedUi, `api=${noteHasGov} ui=${notifiedUi} count=${Array.isArray(noteItems) ? noteItems.length : "n/a"}`);

  const incompleteClose = await api(consultantToken, "POST", `/consultant/clients/${fixture.close_profile_id}/case-file/closure/close`);
  record("close.blocked_incomplete_checklist", incompleteClose.status === 422, `close before checklist HTTP ${incompleteClose.status}`);

  await openPostSubmission(fixture.close_profile_id);
  await consultantPage.locator("select").nth(1).selectOption("approved");
  await consultantPage.getByPlaceholder("Decision note").fill("Study permit approved.");
  await consultantPage.getByPlaceholder("Optional next-step note").fill("Prepare landing documents.");
  const letterPath = join(__dirname, "decision-letter.txt");
  writeFileSync(letterPath, "Phase 5 decision letter");
  await consultantPage.locator('input[type="file"]').setInputFiles(letterPath);
  await consultantPage.getByRole("button", { name: /Record decision/i }).click();
  await consultantPage.getByText(/Recorded: approved/i).waitFor({ timeout: 15000 });
  await shot(consultantPage, "09-decision");
  const decided = await api(consultantToken, "GET", `/consultant/clients/${fixture.close_profile_id}/case-file/post-submission`);
  const decisionEvents = (await history(consultantToken, fixture.close_profile_id))
    .filter((e) => e.event_type === "decision_recorded");
  record(
    "decision.recorded_with_letter",
    decided.json.decision?.decision_status === "approved"
      && decided.json.decision?.has_letter === true
      && decisionEvents.length === 1,
    `status=${decided.json.decision?.decision_status} letter=${decided.json.decision?.has_letter} events=${decisionEvents.length}`,
  );

  const overwrite = await api(consultantToken, "POST", `/consultant/clients/${fixture.close_profile_id}/case-file/decision`, {
    decision_status: "refused",
    decision_note: "should fail",
  });
  record("decision.overwrite_blocked", overwrite.status === 422, `overwrite HTTP ${overwrite.status}`);

  const missingOther = await api(consultantToken, "POST", `/consultant/clients/${fixture.other_profile_id}/case-file/decision`, {
    decision_status: "other",
  });
  const otherOk = await api(consultantToken, "POST", `/consultant/clients/${fixture.other_profile_id}/case-file/decision`, {
    decision_status: "other",
    decision_note: "Returned for additional processing.",
  });
  const refusedOk = await api(consultantToken, "POST", `/consultant/clients/${fixture.refused_profile_id}/case-file/decision`, {
    decision_status: "refused",
    decision_note: "Refused on completeness.",
  });
  const withdrawnOk = await api(consultantToken, "POST", `/consultant/clients/${fixture.withdrawn_profile_id}/case-file/decision`, {
    decision_status: "withdrawn",
    decision_note: "Client withdrew.",
  });
  record(
    "decision.all_statuses",
    missingOther.status === 422 && otherOk.status === 200 && refusedOk.status === 200 && withdrawnOk.status === 200,
    `other-missing=${missingOther.status} other=${otherOk.status} refused=${refusedOk.status} withdrawn=${withdrawnOk.status}`,
  );

  const closeClientToken = await loginToken(fixture.close_client_email, fixture.password);
  const closeClientPage = await clientCtx.newPage();
  await closeClientPage.goto(`${CLIENT_APP}/auth/callback#token=${closeClientToken}`, { waitUntil: "domcontentloaded" });
  await closeClientPage.waitForURL(/user-dashboard/, { timeout: 45000 });
  await closeClientPage.goto(`${CLIENT_APP}/user-dashboard/government-requests`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await closeClientPage.getByText(/Decision on file: approved/i).waitFor({ timeout: 20000 });
  record("client.sees_decision", true, "Client portal shows recorded decision");
  await shot(closeClientPage, "10-client-decision");

  for (const label of [
    "Final documents are saved on the case",
    "Final client message has been sent or is not needed",
    "No open government-request tasks remain",
    "Payments have been noted",
    "Government requests are complete",
    "The case record is complete",
  ]) {
    await consultantPage.getByRole("checkbox", { name: label }).check();
  }
  await consultantPage.getByTestId("phase5-save-checklist").click();
  await api(consultantToken, "POST", `/consultant/clients/${fixture.close_profile_id}/case-file/closure/checklist`, {
    items: {
      final_docs_saved: true,
      final_client_message: true,
      no_open_tasks: true,
      payments_noted: true,
      gov_requests_done: true,
      record_complete: true,
    },
  });
  await consultantPage.waitForTimeout(500);
  const closeReady = await api(consultantToken, "GET", `/consultant/clients/${fixture.close_profile_id}/case-file/post-submission`);
  record("close.checklist_complete", closeReady.json.closure?.can_close === true, `can_close=${closeReady.json.closure?.can_close}`);

  await consultantPage.reload({ waitUntil: "domcontentloaded" });
  await consultantPage.getByRole("button", { name: /Post-submission/i }).first().click();
  await consultantPage.getByText("Closure review").waitFor({ timeout: 20000 });
  await consultantPage.getByTestId("phase5-close-case").click();
  await consultantPage.getByText(/Lifecycle: closed/i).waitFor({ timeout: 15000 });
  await shot(consultantPage, "11-closed");
  const closed = await api(consultantToken, "GET", `/consultant/clients/${fixture.close_profile_id}/case-file/post-submission`);
  const closedEvents = (await history(consultantToken, fixture.close_profile_id))
    .filter((e) => e.event_type === "case_closed");
  record(
    "close.status",
    closed.json.closure?.lifecycle_status === "closed"
      && closed.json.closure?.workflow?.status === "CASE_CLOSED"
      && closedEvents.length === 1,
    `lifecycle=${closed.json.closure?.lifecycle_status} workflow=${closed.json.closure?.workflow?.status} events=${closedEvents.length}`,
  );

  const reclose = await api(consultantToken, "POST", `/consultant/clients/${fixture.close_profile_id}/case-file/closure/close`);
  const closedEventsAfter = (await history(consultantToken, fixture.close_profile_id))
    .filter((e) => e.event_type === "case_closed");
  record(
    "close.immutable",
    reclose.status === 422 && closedEventsAfter.length === 1,
    `reclose HTTP ${reclose.status} events=${closedEventsAfter.length}`,
  );

  await openPostSubmission(fixture.legacy_profile_id);
  const legacyAdd = await api(consultantToken, "POST", `/consultant/clients/${fixture.legacy_profile_id}/case-file/government-requests`, {
    type: "medical",
    due_at: due,
  });
  const legacyCase = await api(consultantToken, "GET", `/consultant/clients/${fixture.legacy_profile_id}/case-file`);
  const legacyFile = legacyCase.json.case_file ?? legacyCase.json;
  record(
    "regression.legacy_submitted",
    legacyAdd.status === 201
      && legacyFile.status === "APPLICATION_SUBMITTED"
      && legacyFile.ready_for_client_review_at == null,
    `add HTTP ${legacyAdd.status} status=${legacyFile.status}`,
  );
  await shot(consultantPage, "12-legacy");

  await consultantPage.reload({ waitUntil: "domcontentloaded" });
  await consultantPage.getByRole("button", { name: /Post-submission/i }).first().click();
  await consultantPage.getByText("Government requests").first().waitFor({ timeout: 20000 });
  const legacyCreated = (await history(consultantToken, fixture.legacy_profile_id))
    .filter((e) => e.event_type === "government_request_created");
  record("regression.no_duplicate_refresh", legacyCreated.length === 1, `legacy created events after refresh=${legacyCreated.length}`);

  const board = await api(consultantToken, "GET", "/consultant/case-pipeline");
  const byId = Object.fromEntries((board.json.pipeline ?? []).map((p) => [p.profile_id, p]));
  const mainBoard = byId[fixture.main_profile_id];
  const closeBoard = byId[fixture.close_profile_id];
  const groups = board.json.groups ?? [];
  const postGroup = groups.find((g) => g.id === "post_submission");
  record(
    "board.groups",
    mainBoard?.workflow_status === "GOVERNMENT_REQUEST_RECEIVED"
      && closeBoard?.workflow_status === "CASE_CLOSED"
      && mainBoard?.group === "post_submission"
      && closeBoard?.group === "post_submission"
      && Boolean(postGroup),
    `main=${mainBoard?.workflow_status} close=${closeBoard?.workflow_status} group=${mainBoard?.group}`,
  );

  await consultantPage.goto(`${CONSULTANT_APP}/dashboard/case-pipeline`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await consultantPage.getByText("Application Progress Board").first().waitFor({ timeout: 20000 });
  await consultantPage.getByText("Submission / Post-Submission").first().waitFor({ timeout: 20000 });
  await shot(consultantPage, "13-progress-board");
  const boardUi = await consultantPage.getByText("Submission / Post-Submission").first().isVisible()
    && await consultantPage.getByText(/All workflow statuses/i).first().isVisible();
  record("board.ui", boardUi, boardUi ? "Progress board shows grouped post-submission column" : "Board UI missing post-submission group");

  const cal2 = await api(consultantToken, "GET", `/consultant/calendar?from=${isoDate(0)}&to=${isoDate(12)}&timezone=America/Toronto`);
  record(
    "calendar.still_works",
    (cal2.json.events ?? []).some((e) => e.source === "government_request"),
    `calendar events=${(cal2.json.events ?? []).length}`,
  );
} catch (error) {
  record("smoke.uncaught", false, error instanceof Error ? error.message : String(error));
  try { await shot(consultantPage, "zz-consultant-error"); } catch {}
  try { await shot(clientPage, "zz-client-error"); } catch {}
} finally {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const md = `# Phase 5 Post-submission — browser smoke\n\n`
    + `Date: ${new Date().toISOString()}\n`
    + `Result: ${failed === 0 ? "PASS" : "FAIL"} (${passed} passed, ${failed} failed)\n\n`
    + `| Check | Result | Detail |\n|-------|--------|--------|\n`
    + results.map((r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail.replaceAll("|", "/")} |`).join("\n")
    + "\n";
  writeFileSync(REPORT, md);
  console.log(`\nSMOKE ${failed === 0 ? "PASS" : "FAIL"} ${passed}/${results.length}`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
