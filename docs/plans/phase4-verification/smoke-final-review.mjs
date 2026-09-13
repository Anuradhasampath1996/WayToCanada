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

async function api(token, method, path, body, extraHeaders = {}) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
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

const fixtureRaw = readFileSync(FIXTURE);
const fixtureText = fixtureRaw[1] === 0 ? fixtureRaw.toString("utf16le") : fixtureRaw.toString("utf8");
const fixture = JSON.parse(fixtureText.replace(/^\uFEFF/, ""));

const consultantToken = await loginToken(fixture.consultant_email, fixture.password);
const sigClientToken = await loginToken(fixture.sig_client_email, fixture.password);
const nosigClientToken = await loginToken(fixture.nosig_client_email, fixture.password);

const browser = await chromium.launch({ headless: true });
const consultantCtx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const clientCtx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const consultantPage = await consultantCtx.newPage();
const clientPage = await clientCtx.newPage();

const checklistKeys = [
  "forms_complete",
  "names_dates_consistent",
  "history_complete",
  "required_documents_verified",
  "inconsistencies_reviewed",
];

try {
  await consultantPage.goto(`${CONSULTANT_APP}/auth/callback#token=${consultantToken}`, { waitUntil: "domcontentloaded" });
  await consultantPage.waitForURL(/consultantdashboard|dashboard/, { timeout: 45000 });

  await consultantPage.goto(
    `${CONSULTANT_APP}/dashboard/clients/${fixture.sig_profile_id}/workspace/case-management`,
    { waitUntil: "domcontentloaded", timeout: 60000 },
  );
  await consultantPage.getByRole("button", { name: /Final review/i }).first().waitFor({ timeout: 30000 });
  await consultantPage.getByRole("button", { name: /Final review/i }).first().click();
  await consultantPage.getByText("Consultant final review checklist").waitFor({ timeout: 20000 });
  await shot(consultantPage, "01-final-review-tab");

  const checklistVisible = await consultantPage.getByText("Consultant final review checklist").isVisible()
    && await consultantPage.getByText("Forms are complete").isVisible()
    && await consultantPage.getByText("Inconsistency highlights have been reviewed").isVisible();
  record("ui.checklist_visible", checklistVisible, checklistVisible
    ? "Checklist labels are visible and readable"
    : "Checklist missing from Final Review tab");

  const advisory = await consultantPage.getByText(/Highlights are support only/i).isVisible()
    && await consultantPage.getByText(/never approve, sign, or submit/i).isVisible();
  const before = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review`);
  record(
    "ui.highlights_advisory",
    advisory && before.json.final_review?.automatic_approval === false && before.json.final_review?.highlights_are_support_only === true,
    advisory ? "Highlights are advisory and do not auto-approve" : "Advisory copy or API flags missing",
  );

  const readyBtn = consultantPage.getByRole("button", { name: /Mark ready for client review/i });
  const incompleteBlockedUi = await readyBtn.isDisabled();
  const incompleteApi = await api(consultantToken, "POST", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review/ready-for-client`);
  record(
    "gate.incomplete_checklist_blocked",
    incompleteBlockedUi && incompleteApi.status === 422,
    `UI disabled=${incompleteBlockedUi} API=${incompleteApi.status}`,
  );

  for (const label of [
    "Forms are complete",
    "Names and dates are consistent",
    "Work, education, travel, and immigration history is complete",
    "All required documents are verified",
    "Inconsistency highlights have been reviewed",
  ]) {
    await consultantPage.getByLabel(label, { exact: false }).check();
  }
  await consultantPage.getByPlaceholder("Internal review notes").fill("Reviewed highlights. Support only.");
  await consultantPage.getByRole("button", { name: /Save checklist/i }).click();
  await consultantPage.waitForTimeout(800);
  const saved = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review`);
  record("ui.checklist_saved", saved.json.final_review?.checklist_complete === true, saved.json.final_review?.checklist_complete
    ? "All required checklist items saved"
    : "Checklist did not complete");

  await consultantPage.getByRole("button", { name: /Mark ready for client review/i }).click();
  await consultantPage.waitForTimeout(1000);
  await shot(consultantPage, "02-ready-for-client");
  const ready = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review`);
  const history = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file/case-history`);
  const events = history.json.events ?? history.json ?? [];
  const historyList = Array.isArray(events) ? events : (events.data ?? []);
  const readyEvent = historyList.find((e) => e.event_type === "ready_for_client_review");
  record(
    "status.ready_for_client",
    ready.json.final_review?.ready_for_client_review === true
      && ready.json.final_review?.workflow?.status === "CLIENT_REVIEW"
      && Boolean(readyEvent),
    `workflow=${ready.json.final_review?.workflow?.status} event=${Boolean(readyEvent)}`,
  );

  await clientPage.goto(`${CLIENT_APP}/auth/callback#token=${sigClientToken}`, { waitUntil: "domcontentloaded" });
  await clientPage.waitForURL(/user-dashboard/, { timeout: 45000 });
  await clientPage.goto(`${CLIENT_APP}/user-dashboard/final-review`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await clientPage.getByRole("button", { name: /I acknowledge this final package/i }).waitFor({ timeout: 25000 });
  await clientPage.getByText(/Nothing here is submitted to IRCC automatically/i).waitFor({ timeout: 15000 });
  await shot(clientPage, "03-client-final-review");

  const readOnly = await clientPage.getByText(/read-only/i).first().isVisible()
    && (await clientPage.getByText("Consultant final review checklist").count()) === 0
    && (await clientPage.getByRole("button", { name: /Save checklist/i }).count()) === 0;
  record("client.read_only", readOnly, readOnly
    ? "Package is read-only; no consultant checklist edits"
    : "Client can see edit controls that should be hidden");

  const ackRequired = await clientPage.getByRole("button", { name: /I acknowledge this final package/i }).isVisible();
  record("client.ack_required", ackRequired, ackRequired ? "Acknowledgement control is required/visible" : "Ack button missing");

  const signVisible = await clientPage.getByRole("button", { name: /Sign declaration/i }).isVisible();
  record("client.signature_required_true", signVisible, signVisible
    ? "Signature/declaration required when snapshot says so"
    : "Signature control missing on required case");

  const beforeAckReady = await api(consultantToken, "POST", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review/ready-to-submit`);
  record("client.blocked_before_ack", beforeAckReady.status === 422, `ready-to-submit before ack HTTP ${beforeAckReady.status}`);

  await clientPage.getByRole("button", { name: /I acknowledge this final package/i }).click();
  await clientPage.getByText(/Acknowledged/i).waitFor({ timeout: 15000 });
  const afterAck = await api(sigClientToken, "GET", "/client/final-review");
  const ackAt = afterAck.json.final_review?.acknowledged_at;
  const caseAfterAck = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file`);
  const caseFile = caseAfterAck.json.case_file ?? caseAfterAck.json;
  record(
    "client.ack_audit",
    Boolean(ackAt) && Boolean(caseFile.client_acknowledgement_ip) && Boolean(caseFile.client_acknowledgement_user_agent),
    `at=${ackAt} ip=${caseFile.client_acknowledgement_ip ?? "missing"} ua=${caseFile.client_acknowledgement_user_agent ? "set" : "missing"}`,
  );

  const beforeSignReady = await api(consultantToken, "POST", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review/ready-to-submit`);
  record("client.blocked_before_signature", beforeSignReady.status === 422, `ready-to-submit before sign HTTP ${beforeSignReady.status}`);

  await clientPage.getByPlaceholder(/Type your full name/i).fill("Phase4 sig");
  await clientPage.getByRole("button", { name: /Sign declaration/i }).click();
  await clientPage.getByText(/Declaration signed/i).waitFor({ timeout: 15000 });
  await shot(clientPage, "04-client-acked-signed");
  record("client.signed", true, "Client signed the required declaration");

  const ack403 = await api(consultantToken, "POST", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review/acknowledge`);
  const sign403 = await api(consultantToken, "POST", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review/sign`, {
    signature: "Consultant Impersonation",
  });
  record("security.consultant_ack_403", ack403.status === 403, `ack HTTP ${ack403.status}`);
  record("security.consultant_sign_403", sign403.status === 403, `sign HTTP ${sign403.status}`);

  await consultantPage.reload({ waitUntil: "domcontentloaded" });
  await consultantPage.getByRole("button", { name: /Final review/i }).first().click();
  await consultantPage.getByText("Consultant final review checklist").waitFor({ timeout: 20000 });
  const noImpersonateUi = await consultantPage.getByText(/cannot acknowledge or sign for the client/i).isVisible()
    && (await consultantPage.getByRole("button", { name: /I acknowledge this final package/i }).count()) === 0;
  const clientDoneVisible = await consultantPage.getByText(/Acknowledged:.*yes/i).isVisible()
    && await consultantPage.getByText(/Signed: yes/i).isVisible();
  record("security.no_impersonate_ui", noImpersonateUi, noImpersonateUi
    ? "Consultant UI has no client ack/sign actions"
    : "Consultant UI still exposes client acknowledgement");
  record("ui.client_review_visible", clientDoneVisible, clientDoneVisible
    ? "Client review completion is visible to consultant"
    : "Consultant UI did not show ack/sign completion");
  await shot(consultantPage, "05-consultant-after-client");

  const beforePortal = await api(consultantToken, "POST", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review/ready-to-submit`);
  record("gate.portal_required", beforePortal.status === 422, `ready-to-submit without portal HTTP ${beforePortal.status}`);

  await consultantPage.getByRole("button", { name: /Confirm portal/i }).click();
  await consultantPage.waitForTimeout(800);
  const portal = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file/requirement-plan`);
  record(
    "portal.confirmed_not_autosubmitted",
    Boolean(portal.json.confirmed_submission_portal) && portal.json.auto_submitted !== true,
    `portal=${portal.json.confirmed_submission_portal ?? "missing"} auto_submitted=${portal.json.auto_submitted}`,
  );

  await consultantPage.getByRole("button", { name: /Mark Ready to Submit/i }).click();
  await consultantPage.waitForTimeout(1000);
  const rts = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review`);
  record(
    "status.ready_to_submit",
    rts.json.final_review?.ready_to_submit === true
      && rts.json.final_review?.workflow?.status === "READY_TO_SUBMIT"
      && rts.json.final_review?.auto_submitted === false,
    `workflow=${rts.json.final_review?.workflow?.status} auto=${rts.json.final_review?.auto_submitted}`,
  );
  await shot(consultantPage, "06-ready-to-submit");

  const approve = await api(
    consultantToken,
    "PATCH",
    `/consultant/clients/${fixture.docs_profile_id}/documents/${(await (async () => {
      const hub = await api(consultantToken, "GET", `/consultant/clients/${fixture.docs_profile_id}/case-management-hub`);
      const docs = hub.json.documents ?? [];
      return docs[0]?.id;
    })())}/review`,
    { action: "approve" },
  );
  const docsCase = await api(consultantToken, "GET", `/consultant/clients/${fixture.docs_profile_id}/case-file`);
  const docsFile = docsCase.json.case_file ?? docsCase.json;
  record(
    "regression.doc_approve_not_ready",
    docsFile.status !== "READY_FOR_SUBMISSION" && !docsFile.ready_to_submit_at,
    `docs case status=${docsFile.status} ready_to_submit_at=${docsFile.ready_to_submit_at ?? "null"} approve=${approve.status}`,
  );

  const runId = `P4-${Date.now()}`;
  await consultantPage.locator('input[type="date"]').fill("2026-09-13");
  await consultantPage.getByPlaceholder("Application number").fill(runId);
  await consultantPage.getByPlaceholder("Confirmation number").fill(`${runId}-CONF`);
  await consultantPage.getByPlaceholder("Government fees").fill("150");
  await consultantPage.getByPlaceholder("Payment confirmation").fill("PAY-P4");
  const receiptPath = join(__dirname, "receipt.txt");
  writeFileSync(receiptPath, "Phase 4 receipt smoke");
  await consultantPage.locator('input[type="file"]').setInputFiles(receiptPath);
  const histBefore = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file/case-history`);
  const beforeEvents = (histBefore.json.events ?? histBefore.json ?? []);
  const beforeList = Array.isArray(beforeEvents) ? beforeEvents : [];
  const submittedBefore = beforeList.filter((e) => e.event_type === "application_submitted").length;

  await consultantPage.getByRole("button", { name: /Record submission confirmation/i }).click();
  await consultantPage.getByText(/Recorded on|immutable/i).waitFor({ timeout: 20000 });
  await shot(consultantPage, "07-submitted");
  const submitted = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review`);
  record(
    "submit.fields_and_status",
    submitted.json.submission?.submitted === true
      && submitted.json.submission?.application_number === runId
      && submitted.json.submission?.confirmation_number === `${runId}-CONF`
      && submitted.json.final_review?.workflow?.status === "SUBMITTED"
      && submitted.json.submission?.immutable === true
      && Boolean(submitted.json.submission?.submitted_documents_snapshot),
    `app=${submitted.json.submission?.application_number} status=${submitted.json.final_review?.workflow?.status}`,
  );

  const histAfter = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file/case-history`);
  const afterList = Array.isArray(histAfter.json.events ?? histAfter.json) ? (histAfter.json.events ?? histAfter.json) : [];
  const submittedEvents = afterList.filter((e) => e.event_type === "application_submitted");
  record(
    "submit.immutable_event",
    submittedEvents.length === submittedBefore + 1 && submittedEvents[0]?.payload?.auto_submitted === false,
    `events=${submittedEvents.length} (was ${submittedBefore})`,
  );

  const edit = await api(consultantToken, "POST", `/consultant/clients/${fixture.sig_profile_id}/case-file/submission`, {
    submission_date: "2026-09-14",
    application_number: "TAMPERED",
  });
  const still = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file/final-review`);
  record(
    "submit.edit_rejected",
    edit.status === 422 && still.json.submission?.application_number === runId,
    `edit HTTP ${edit.status} number=${still.json.submission?.application_number}`,
  );

  await consultantPage.reload({ waitUntil: "domcontentloaded" });
  await consultantPage.getByRole("button", { name: /Final review/i }).first().click();
  await consultantPage.getByText(/Recorded on|immutable/i).waitFor({ timeout: 20000 });
  const histRefresh = await api(consultantToken, "GET", `/consultant/clients/${fixture.sig_profile_id}/case-file/case-history`);
  const refreshList = Array.isArray(histRefresh.json.events ?? histRefresh.json) ? (histRefresh.json.events ?? histRefresh.json) : [];
  const refreshSubmitted = refreshList.filter((e) => e.event_type === "application_submitted").length;
  record("regression.no_duplicate_history", refreshSubmitted === submittedEvents.length, `after refresh submitted events=${refreshSubmitted}`);

  await consultantPage.goto(
    `${CONSULTANT_APP}/dashboard/clients/${fixture.legacy_ready_profile_id}/workspace/case-management`,
    { waitUntil: "domcontentloaded", timeout: 60000 },
  );
  await consultantPage.getByRole("button", { name: /Final review/i }).first().waitFor({ timeout: 30000 });
  await consultantPage.getByRole("button", { name: /Final review/i }).first().click();
  await consultantPage.getByText("Consultant final review checklist").waitFor({ timeout: 20000 });
  const legacyReady = await api(consultantToken, "GET", `/consultant/clients/${fixture.legacy_ready_profile_id}/case-file`);
  const legacyReadyFile = legacyReady.json.case_file ?? legacyReady.json;
  record(
    "regression.legacy_ready_opens",
    legacyReadyFile.status === "READY_FOR_SUBMISSION" && await consultantPage.getByText("Consultant final review checklist").isVisible(),
    `status=${legacyReadyFile.status}`,
  );
  await shot(consultantPage, "08-legacy-ready");

  await consultantPage.goto(
    `${CONSULTANT_APP}/dashboard/clients/${fixture.legacy_submitted_profile_id}/workspace/case-management`,
    { waitUntil: "domcontentloaded", timeout: 60000 },
  );
  await consultantPage.getByRole("button", { name: /Final review/i }).first().click();
  await consultantPage.getByText("Consultant final review checklist").waitFor({ timeout: 20000 });
  const legacySub = await api(consultantToken, "GET", `/consultant/clients/${fixture.legacy_submitted_profile_id}/case-file/final-review`);
  record(
    "regression.legacy_submitted_stays",
    (legacySub.json.final_review?.workflow?.status === "SUBMITTED"
      || legacySub.json.submission?.submitted === true)
      && legacySub.json.final_review?.can_mark_ready_for_client === false,
    `workflow=${legacySub.json.final_review?.workflow?.status} submitted=${legacySub.json.submission?.submitted}`,
  );
  await shot(consultantPage, "09-legacy-submitted");

  const nosigReadyItems = Object.fromEntries(checklistKeys.map((k) => [k, true]));
  await api(consultantToken, "POST", `/consultant/clients/${fixture.nosig_profile_id}/case-file/final-review/checklist`, { items: nosigReadyItems });
  await api(consultantToken, "POST", `/consultant/clients/${fixture.nosig_profile_id}/case-file/final-review/ready-for-client`);
  const nosigPage = await clientCtx.newPage();
  await nosigPage.goto(`${CLIENT_APP}/auth/callback#token=${nosigClientToken}`, { waitUntil: "domcontentloaded" });
  await nosigPage.waitForURL(/user-dashboard/, { timeout: 45000 });
  await nosigPage.goto(`${CLIENT_APP}/user-dashboard/final-review`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await nosigPage.getByRole("button", { name: /I acknowledge this final package/i }).waitFor({ timeout: 20000 });
  const nosigSignHidden = (await nosigPage.getByRole("button", { name: /Sign declaration/i }).count()) === 0;
  await nosigPage.getByRole("button", { name: /I acknowledge this final package/i }).click();
  await nosigPage.getByText(/Acknowledged/i).waitFor({ timeout: 15000 });
  await api(consultantToken, "POST", `/consultant/clients/${fixture.nosig_profile_id}/case-file/requirement-plan/confirm-portal`, { portal: "ircc_rep" });
  const nosigRts = await api(consultantToken, "POST", `/consultant/clients/${fixture.nosig_profile_id}/case-file/final-review/ready-to-submit`);
  record(
    "client.ack_enough_when_no_signature",
    nosigSignHidden && nosigRts.status === 200 && nosigRts.json.final_review?.signature_required === false,
    `signHidden=${nosigSignHidden} ready HTTP ${nosigRts.status}`,
  );
  await shot(nosigPage, "10-nosig-ack-only");

  await clientPage.goto(`${CLIENT_APP}/user-dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await clientPage.getByText(/Final review/i).first().waitFor({ timeout: 20000 });
  const clientStage = await clientPage.getByText(/Final review/i).first().isVisible();
  const consultantStage = submitted.json.final_review?.workflow?.status === "SUBMITTED";
  record(
    "regression.same_stage",
    consultantStage && clientStage && submitted.json.submission?.submitted === true,
    `consultant=SUBMITTED clientFinalReviewNav=${clientStage}`,
  );
} catch (error) {
  record("smoke.uncaught", false, error instanceof Error ? error.message : String(error));
  try { await shot(consultantPage, "zz-consultant-error"); } catch {}
  try { await shot(clientPage, "zz-client-error"); } catch {}
} finally {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const md = `# Phase 4 Final Review — browser smoke\n\n`
    + `Date: ${new Date().toISOString()}\n`
    + `Result: ${failed === 0 ? "PASS" : "FAIL"} (${passed} passed, ${failed} failed)\n\n`
    + `| Check | Result | Detail |\n|-------|--------|--------|\n`
    + results.map((r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail} |`).join("\n")
    + "\n";
  writeFileSync(REPORT, md);
  console.log(`\nSMOKE ${failed === 0 ? "PASS" : "FAIL"} ${passed}/${results.length}`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
