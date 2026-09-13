import { chromium } from "../phase1-verification/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "screenshots");
const REPORT = join(__dirname, "JOURNEY.md");
const STAGES = join(__dirname, "stages.json");
const API = "http://127.0.0.1:8000/api/v1";
const CONSULTANT_APP = "http://127.0.0.1:3005";
const CLIENT_APP = "http://127.0.0.1:3001";
const PHASE5 = JSON.parse(readFileSync(join(__dirname, "../phase5-verification/smoke-fixture.json"), "utf8").replace(/^\uFEFF/, ""));
const PASSWORD = "ReleaseReady123!";
const EMAIL = `rc.journey.${Date.now()}@example.test`;

mkdirSync(OUT, { recursive: true });
const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail: String(detail) });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${detail}`);
}
async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
}
async function api(token, method, path, body, extraHeaders = {}) {
  const headers = { Accept: "application/json", ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
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
  if (!res.ok || !json.token) throw new Error(`Login failed for ${email}: ${JSON.stringify(json)}`);
  return json.token;
}
function setClientPassword(email) {
  const php = `<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
$user = App\\Models\\User::where('email', ${JSON.stringify(email)})->first();
if (!$user) { fwrite(STDERR, 'user missing'); exit(1); }
$user->update(['password' => Illuminate\\Support\\Facades\\Hash::make(${JSON.stringify(PASSWORD)})]);
echo 'ok';
`;
  const script = join(__dirname, "_set-password.php");
  writeFileSync(script, php);
  execFileSync("php", [script], { cwd: join(__dirname, "../../../backend"), stdio: "inherit" });
}
async function pipelineRow(token, profileId) {
  const pipe = await api(token, "GET", "/consultant/case-pipeline");
  return (pipe.json.pipeline ?? []).find((p) => Number(p.profile_id) === Number(profileId));
}

const consultantToken = await loginToken(PHASE5.consultant_email, PHASE5.password);
const created = await api(consultantToken, "POST", "/consultant/clients", {
  name: "RC Journey Client",
  email: EMAIL,
  phone: "4165550199",
  send_invite: true,
});
record("01.add_invite", created.status === 201 && Boolean(created.json.client?.id), `HTTP ${created.status}`);
const profileId = created.json.client?.id;
if (!profileId) {
  writeFileSync(STAGES, JSON.stringify({ email: EMAIL, results }, null, 2));
  process.exit(1);
}
setClientPassword(EMAIL);
const clientToken = await loginToken(EMAIL, PASSWORD);
record("01.client_login", Boolean(clientToken), "Client logged in after invite");

const q = await api(clientToken, "PUT", "/questionnaire", {
  step1_data: { email: EMAIL, fullName: "RC Journey Client" },
  main_data: {
    passportFullName: "RC Journey Client",
    dob: "1994-04-12",
    passportNumber: "N7654321",
    educationLevels: ["bachelors"],
    languageTest: "yes",
    workExperience: "3_or_more",
    canadaStudyProgram: "Computer Science",
    canadaStudyStart: "2026-09-01",
    passportName: "client-document/2026/09/passport.pdf",
    languageTestDocName: "client-document/2026/09/ielts.pdf",
    educationQuals: [{ documentName: "client-document/2026/09/transcript.pdf", courseName: "BSc" }],
  },
});
const qSubmit = await api(clientToken, "POST", "/questionnaire/submit");
record("02.intake", q.status === 200 && qSubmit.status === 200, `save=${q.status} submit=${qSubmit.status}`);

const opened = await api(consultantToken, "GET", `/consultant/clients/${profileId}/case-file`);
record("02.case_opened", opened.status === 200 && Boolean(opened.json.case_file?.id), `HTTP ${opened.status}`);
const caseFileId = opened.json.case_file?.id;

const skip = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/consultation/skip`, {
  reason: "Prior consult already completed last week.",
});
record("03.consultation_skip", skip.status === 200 && skip.json.assessment?.consultation?.satisfied === true, `HTTP ${skip.status}`);

const review = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/profile-review`);
record("04.profile_review", review.status === 200 && review.json.assessment?.profile_review?.can_review === true, `HTTP ${review.status}`);

const assess = await api(consultantToken, "GET", `/consultant/clients/${profileId}/case-file/assessment?family=study`);
record("05.06.assessment", assess.status === 200 && assess.json.assessment?.can_select_pathway === true && Boolean(assess.json.calculator), `family=${assess.json.calculator?.family ?? "n/a"}`);

const maple = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/maple-recommendation`);
const afterMaple = await api(consultantToken, "GET", `/consultant/clients/${profileId}/case-file`);
record("07.maple_recommend_only", maple.status === 200 && maple.json.pathway_auto_selected === false && !afterMaple.json.case_file?.immigration_pathway, `auto=${maple.json.pathway_auto_selected}`);

const select = await api(consultantToken, "PATCH", `/consultant/clients/${profileId}/case-file/select-pathway`, {
  immigration_pathway: "Study Permit",
  pathway_code: "study",
  selection_reason: "LOA and program start date support a study permit.",
});
const plan = select.json.requirement_plan ?? {};
const forms = (select.json.assignment?.forms ?? []).map((f) => f.code);
const docs = (select.json.assignment?.documents ?? []).map((d) => d.id);
record("08.09.select_snapshot", select.status === 200 && plan.plan_version === 1 && Boolean(plan.id || plan.plan_version), `v=${plan.plan_version} key=${plan.registry_key}`);
record("10.generated_requirements", forms.includes("IMM 1294") && docs.includes("acceptance_letter") && select.json.representative?.requirement === "required", `forms=${forms.join(",")} docs=${docs.join(",")} rep=${select.json.representative?.requirement}`);

const send = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/send-agreement`, {
  agreement_config: { totalFee: 3000, currency: "CAD", milestone1Pct: 30, milestone2Pct: 40, milestone3Pct: 30, taxEnabled: false },
});
const token = (await api(consultantToken, "GET", `/consultant/clients/${profileId}/case-file`)).json.case_file?.agreement_token;
const signed = await api(null, "POST", `/case-file/agreement/${token}/sign`, { signature_name: "RC Journey Client" });
record("11.12.retainer", send.status === 200 && signed.status === 200, `send=${send.status} sign=${signed.status}`);

const rep = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/representative`, { action: "complete" });
record("13.14.representative_activation", rep.status === 200 && rep.json.activation?.activated === true, `HTTP ${rep.status} activated=${rep.json.activation?.activated}`);

const assignment = await api(consultantToken, "GET", `/consultant/clients/${profileId}/case-file/assignment`);
const answers = {};
for (const field of assignment.json.assignment?.extra_fields?.ask ?? []) {
  answers[field.key] = field.key === "dli_number" ? "O19339613182" : "Release readiness answer";
}
const extra = Object.keys(answers).length
  ? await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/extra-data`, { answers })
  : { status: 200, json: { skipped: true } };
record("15.extra_data", extra.status === 200, `HTTP ${extra.status} keys=${Object.keys(answers).join(",") || "none"}`);

const formsIndex = await api(consultantToken, "GET", `/consultant/clients/${profileId}/interactive-forms`);
const govForms = await api(consultantToken, "GET", `/consultant/clients/${profileId}/government-forms`);
let unlock = await api(consultantToken, "GET", `/consultant/clients/${profileId}/interactive-forms/verification-status`);
if (!unlock.json.verification?.case_management_unlocked && (formsIndex.json.forms ?? []).length) {
  for (const form of formsIndex.json.forms) {
    await api(clientToken, "POST", `/client/interactive-forms/${form.id}/submit`, { response_data: {} });
  }
  await api(consultantToken, "PATCH", `/consultant/clients/${profileId}/interactive-forms/review-all-submitted`, { consultant_notes: "Release readiness review." });
  unlock = await api(consultantToken, "GET", `/consultant/clients/${profileId}/interactive-forms/verification-status`);
}
record("18.forms_prep", formsIndex.status === 200 && govForms.status < 500, `interactive=${formsIndex.status} gov=${govForms.status} unlocked=${unlock.json.verification?.case_management_unlocked}`);

const pdf = new Blob(["%PDF-1.4 release"], { type: "application/pdf" });
const formData = new FormData();
formData.append("document_type", "passport");
formData.append("document_label", "Passport");
formData.append("file", pdf, "passport.pdf");
const upload = await api(clientToken, "POST", "/client/documents/upload", formData);
let docId = upload.json.document?.id;
if (!docId) {
  record("16.17.documents", false, `upload HTTP ${upload.status} ${upload.json.message ?? ""}`);
} else {
  const corr = await api(consultantToken, "PATCH", `/consultant/clients/${profileId}/documents/${docId}/review`, {
    action: "request_correction",
    rejection_comment: "Please upload a clearer bio page.",
  });
  const resub = await api(consultantToken, "PATCH", `/consultant/clients/${profileId}/documents/${docId}/review`, { action: "request_resubmission" });
  const verify = await api(consultantToken, "PATCH", `/consultant/clients/${profileId}/documents/${docId}/review`, { action: "verify" });
  record("16.17.documents", corr.status === 200 && resub.status === 200 && verify.status === 200, `corr=${corr.status} resub=${resub.status} verify=${verify.status}`);
}

const checklist = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/final-review/checklist`, {
  items: {
    forms_complete: true,
    names_dates_consistent: true,
    history_complete: true,
    required_documents_verified: true,
    inconsistencies_reviewed: true,
  },
  notes: "Highlights reviewed. Support only.",
});
const readyClient = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/final-review/ready-for-client`);
record("19.20.final_review", checklist.status === 200 && readyClient.status === 200 && checklist.json.final_review?.automatic_approval === false, `checklist=${checklist.status} ready=${readyClient.status}`);

const ack403 = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/final-review/acknowledge`);
const sign403 = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/final-review/sign`, { signature: "Consultant" });
record("audit.consultant_cannot_ack_sign", ack403.status === 403 && sign403.status === 403, `ack=${ack403.status} sign=${sign403.status}`);

const ack = await api(clientToken, "POST", "/client/final-review/acknowledge");
const clientReview = await api(clientToken, "GET", "/client/final-review");
let signedDecl = { status: 200, json: { skipped: true } };
if (clientReview.json.final_review?.signature_required) {
  signedDecl = await api(clientToken, "POST", "/client/final-review/sign", { signature: "RC Journey Client" });
}
record("21.22.client_ack_sign", ack.status === 200 && signedDecl.status === 200, `ack=${ack.status} sign=${signedDecl.status} required=${clientReview.json.final_review?.signature_required}`);

const portal = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/requirement-plan/confirm-portal`, {
  portal: "ircc_rep",
  note: "Consultant confirmed IRCC representative portal.",
});
const rts = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/final-review/ready-to-submit`);
record("23.24.portal_ready", portal.status === 200 && portal.json.auto_submitted === false && rts.status === 200 && rts.json.auto_submitted === false, `portal=${portal.status} rts=${rts.status}`);

const submit = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/submission`, {
  submission_date: "2026-09-13",
  application_number: "W555111222",
  confirmation_number: "CONF-RC-LIVE",
  government_fees: 150,
  payment_confirmation: "PAY-RC-LIVE",
});
const overwrite = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/submission`, {
  submission_date: "2026-09-14",
  application_number: "CHANGED",
});
record("25.submitted_immutable", submit.status === 200 && submit.json.auto_submitted === false && overwrite.status === 422, `submit=${submit.status} overwrite=${overwrite.status}`);

const due = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const gov = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/government-requests`, {
  type: "biometrics",
  due_at: due,
  notes: "Book biometrics.",
});
const calTo = new Date();
calTo.setDate(calTo.getDate() + 14);
const cal = await api(consultantToken, "GET", `/consultant/calendar?from=${new Date().toISOString().slice(0, 10)}&to=${calTo.toISOString().slice(0, 10)}&timezone=America/Toronto`);
const govEvent = (cal.json.events ?? []).find((e) => e.source === "government_request" && String(e.client_profile_id) === String(profileId));
const clientGov = await api(clientToken, "GET", "/client/post-submission");
const notifs = await api(clientToken, "GET", "/notifications?per_page=20");
record("26.27.gov_request_visible", gov.status === 201 && Boolean(govEvent?.href) && clientGov.json.government_requests?.requests?.[0]?.type === "biometrics", `cal=${Boolean(govEvent)} client=${clientGov.json.government_requests?.requests?.[0]?.type}`);
record("cross.notifications", (notifs.json.data ?? []).some((n) => String(n.action_url ?? "").includes("government-requests")), `count=${(notifs.json.data ?? []).length}`);

const requestId = gov.json.request?.id;
const inProg = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/government-requests/${requestId}/in-progress`);
const answered = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/government-requests/${requestId}/answered`, { notes: "Biometrics completed." });
record("28.request_lifecycle", inProg.status === 200 && answered.status === 200, `prog=${inProg.status} ans=${answered.status}`);

const decisionFd = new FormData();
decisionFd.append("decision_status", "approved");
decisionFd.append("decision_note", "Study permit approved.");
decisionFd.append("next_step_note", "Prepare landing documents.");
decisionFd.append("letter", new Blob(["%PDF-1.4 letter"], { type: "application/pdf" }), "decision.pdf");
const decision = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/decision`, decisionFd);
const decisionAgain = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/decision`, { decision_status: "refused" });
record("29.decision_once", decision.status === 200 && decisionAgain.status === 422, `first=${decision.status} second=${decisionAgain.status}`);

const closeList = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/closure/checklist`, {
  items: {
    final_docs_saved: true,
    final_client_message: true,
    no_open_tasks: true,
    payments_noted: true,
    gov_requests_done: true,
    record_complete: true,
  },
});
const closed = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/closure/close`, {
  action: "close",
  note: "Closed after approval.",
});
const row = await pipelineRow(consultantToken, profileId);
record("30.31.closure", closeList.status === 200 && closed.status === 200 && row?.is_closed === true, `close=${closed.status} closed=${row?.is_closed}`);

const history = await api(consultantToken, "GET", `/consultant/clients/${profileId}/case-file/case-history`);
const events = history.json.events ?? history.json.data ?? [];
const types = events.map((e) => e.event_type);
const uniqueSubmit = types.filter((t) => t === "application_submitted").length;
record("audit.history_no_dup_submit", uniqueSubmit <= 1, `application_submitted=${uniqueSubmit} total=${types.length}`);

const browser = await chromium.launch({ headless: true });
const consultantCtx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const clientCtx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await consultantCtx.newPage();
const clientPage = await clientCtx.newPage();
const mobile = await mobileCtx.newPage();

try {
  await page.goto(`${CONSULTANT_APP}/auth/callback#token=${consultantToken}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/dashboard/, { timeout: 45000 });
  await page.goto(`${CONSULTANT_APP}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.getByText("Pending actions").first().waitFor({ timeout: 20000 });
  await shot(page, "01-dashboard");
  record("ui.dashboard", await page.getByText("Needs attention").first().isVisible(), "Dashboard counts and pending actions visible");

  await page.goto(`${CONSULTANT_APP}/dashboard/clients/${profileId}/workspace`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("Loading workspace…").first().waitFor({ state: "hidden", timeout: 60000 }).catch(() => {});
  await page.getByText("Post-submission").first().waitFor({ timeout: 60000 });
  await shot(page, "02-rail");
  record("ui.consultant_rail", await page.getByText("Assessment").first().isVisible() && await page.getByText("Post-submission").first().isVisible(), "5-stage rail visible on closed/submitted case");

  await page.goto(`${CONSULTANT_APP}/dashboard/case-pipeline`, { waitUntil: "domcontentloaded" });
  await page.getByText("Submission / Post-Submission").first().waitFor({ timeout: 20000 });
  await shot(page, "03-board");
  record("ui.progress_board", await page.getByText("Pre-Engagement / Assessment").isVisible() && await page.getByText("RC Journey Client").first().isVisible(), "Board shows the journey case in grouped columns");

  await clientPage.goto(`${CLIENT_APP}/auth/callback#token=${clientToken}`, { waitUntil: "domcontentloaded" });
  await clientPage.waitForURL(/user-dashboard/, { timeout: 45000 });
  await clientPage.goto(`${CLIENT_APP}/user-dashboard`, { waitUntil: "domcontentloaded" });
  await clientPage.getByText("Profile & Assessment").first().waitFor({ timeout: 20000 });
  const body = await clientPage.locator("body").innerText();
  await shot(clientPage, "04-client-journey");
  record("ui.client_journey", await clientPage.getByText("Government Processing / Decision").first().isVisible(), "Client 5-stage journey visible");
  record("ui.no_internal_codes", !/APPLICATION_SUBMITTED|GOVERNMENT_REQUEST_RECEIVED|CLIENT_REVIEW|READY_TO_SUBMIT/.test(body), "No internal codes on client home");

  await mobile.goto(`${CONSULTANT_APP}/auth/callback#token=${consultantToken}`, { waitUntil: "domcontentloaded" });
  await mobile.waitForURL(/dashboard/, { timeout: 45000 });
  await mobile.goto(`${CONSULTANT_APP}/dashboard`, { waitUntil: "domcontentloaded" });
  await mobile.getByText("Pending actions").first().waitFor({ timeout: 20000 });
  await shot(mobile, "05-mobile");
  record("ui.mobile", await mobile.getByText("Needs attention").first().isVisible(), "Mobile dashboard usable");
} catch (error) {
  record("ui.uncaught", false, error instanceof Error ? error.message : String(error));
  try { await shot(page, "zz-error"); } catch {}
} finally {
  await browser.close();
}

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
writeFileSync(STAGES, JSON.stringify({ email: EMAIL, profileId, caseFileId, password: PASSWORD, results }, null, 2));
writeFileSync(REPORT, `# Final journey live walk\n\nDate: ${new Date().toISOString()}\nClient: ${EMAIL} (profile ${profileId}, case ${caseFileId})\nResult: ${failed === 0 ? "PASS" : "FAIL"} (${passed} passed, ${failed} failed)\n\n| Stage | Result | Detail |\n|-------|--------|--------|\n${results.map((r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail.replaceAll("|", "/")} |`).join("\n")}\n`);
console.log(`\nJOURNEY ${failed === 0 ? "PASS" : "FAIL"} ${passed}/${results.length}`);
process.exit(failed === 0 ? 0 : 1);
