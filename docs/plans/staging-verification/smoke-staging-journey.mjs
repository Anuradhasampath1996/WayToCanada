/**
 * API-only reduced staging smoke. Talks to the isolated staging API (default :8010).
 * Never uses product db_cws (:5432) or production AWS.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = process.env.STAGING_API_URL || "http://127.0.0.1:8010/api/v1";
const REPORT = join(__dirname, "STAGING-JOURNEY.md");
const STAGES = join(__dirname, "stages.json");
const PASSWORD = "StagingSmoke123!";
const CONSULTANT_EMAIL = "staging.rcic@example.test";
const EMAIL = `staging.journey.${Date.now()}@example.test`;
const BACKEND = join(__dirname, "../../../backend");

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail: String(detail) });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

async function api(token, method, path, body) {
  const headers = { Accept: "application/json" };
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
putenv('APP_ENV=staging');
$_ENV['APP_ENV'] = 'staging';
$_SERVER['APP_ENV'] = 'staging';
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
$port = (string) config('database.connections.cws.port');
$db = (string) config('database.connections.cws.database');
if ($port === '5432' || $db === 'db_cws' || !str_contains($db, 'staging')) {
  fwrite(STDERR, "Refusing password reset on $db:$port\\n");
  exit(1);
}
$user = App\\Models\\User::where('email', ${JSON.stringify(email)})->first();
if (!$user) { fwrite(STDERR, 'user missing'); exit(1); }
$user->update(['password' => Illuminate\\Support\\Facades\\Hash::make(${JSON.stringify(PASSWORD)})]);
echo 'ok';
`;
  const script = join(__dirname, "_set-password.php");
  writeFileSync(script, php);
  execFileSync("php", [script], { cwd: BACKEND, stdio: "inherit" });
}

async function pipelineRow(token, profileId) {
  const pipe = await api(token, "GET", "/consultant/case-pipeline");
  return (pipe.json.pipeline ?? []).find((p) => Number(p.profile_id) === Number(profileId));
}

const consultantToken = await loginToken(CONSULTANT_EMAIL, PASSWORD);
const created = await api(consultantToken, "POST", "/consultant/clients", {
  name: "Staging Journey Client",
  email: EMAIL,
  phone: "4165550199",
  send_invite: true,
});
record("01.invite", created.status === 201 && Boolean(created.json.client?.id), `HTTP ${created.status}`);
const profileId = created.json.client?.id;
if (!profileId) {
  writeFileSync(STAGES, JSON.stringify({ email: EMAIL, results }, null, 2));
  process.exit(1);
}
setClientPassword(EMAIL);
const clientToken = await loginToken(EMAIL, PASSWORD);
record("02.profile", Boolean(clientToken), "Client logged in after invite");

const q = await api(clientToken, "PUT", "/questionnaire", {
  step1_data: { email: EMAIL, fullName: "Staging Journey Client" },
  main_data: {
    passportFullName: "Staging Journey Client",
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
const caseFileId = opened.json.case_file?.id;
record("02.case_opened", opened.status === 200 && Boolean(caseFileId), `HTTP ${opened.status}`);

const skip = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/consultation/skip`, {
  reason: "Prior consult already completed last week.",
});
record("03.consultation_skip", skip.status === 200 && skip.json.assessment?.consultation?.satisfied === true, `HTTP ${skip.status}`);

const review = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/profile-review`);
record("04.profile_review", review.status === 200 && review.json.assessment?.profile_review?.can_review === true, `HTTP ${review.status}`);

const assess = await api(consultantToken, "GET", `/consultant/clients/${profileId}/case-file/assessment?family=study`);
record("05.assessment", assess.status === 200 && assess.json.assessment?.can_select_pathway === true, `HTTP ${assess.status}`);

const maple = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/maple-recommendation`);
const afterMaple = await api(consultantToken, "GET", `/consultant/clients/${profileId}/case-file`);
record("06.maple_recommend_only", maple.status === 200 && maple.json.pathway_auto_selected === false && !afterMaple.json.case_file?.immigration_pathway, `auto=${maple.json.pathway_auto_selected}`);

const select = await api(consultantToken, "PATCH", `/consultant/clients/${profileId}/case-file/select-pathway`, {
  immigration_pathway: "Study Permit",
  pathway_code: "study",
  selection_reason: "LOA and program start date support a study permit.",
});
record("07.pathway_selection", select.status === 200 && select.json.requirement_plan?.plan_version === 1, `v=${select.json.requirement_plan?.plan_version}`);

const send = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/send-agreement`, {
  agreement_config: { totalFee: 3000, currency: "CAD", milestone1Pct: 30, milestone2Pct: 40, milestone3Pct: 30, taxEnabled: false },
});
const token = (await api(consultantToken, "GET", `/consultant/clients/${profileId}/case-file`)).json.case_file?.agreement_token;
const signed = await api(null, "POST", `/case-file/agreement/${token}/sign`, { signature_name: "Staging Journey Client" });
record("08.retainer", send.status === 200 && signed.status === 200, `send=${send.status} sign=${signed.status}`);

const rep = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/representative`, { action: "complete" });
record("09.representative", rep.status === 200 && rep.json.activation?.activated === true, `activated=${rep.json.activation?.activated}`);

const assignment = await api(consultantToken, "GET", `/consultant/clients/${profileId}/case-file/assignment`);
const answers = {};
for (const field of assignment.json.assignment?.extra_fields?.ask ?? []) {
  answers[field.key] = field.key === "dli_number" ? "O19339613182" : "Staging smoke answer";
}
const extra = Object.keys(answers).length
  ? await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/extra-data`, { answers })
  : { status: 200 };
record("10.additional_info", extra.status === 200, `HTTP ${extra.status}`);

const pdf = new Blob(["%PDF-1.4 staging"], { type: "application/pdf" });
const formData = new FormData();
formData.append("document_type", "passport");
formData.append("document_label", "Passport");
formData.append("file", pdf, "passport.pdf");
const upload = await api(clientToken, "POST", "/client/documents/upload", formData);
let docId = upload.json.document?.id;
if (!docId) {
  record("11.documents", false, `upload HTTP ${upload.status} ${upload.json.message ?? ""}`);
} else {
  const corr = await api(consultantToken, "PATCH", `/consultant/clients/${profileId}/documents/${docId}/review`, {
    action: "request_correction",
    rejection_comment: "Please upload a clearer bio page.",
  });
  const resub = await api(consultantToken, "PATCH", `/consultant/clients/${profileId}/documents/${docId}/review`, { action: "request_resubmission" });
  const verify = await api(consultantToken, "PATCH", `/consultant/clients/${profileId}/documents/${docId}/review`, { action: "verify" });
  record("11.documents", corr.status === 200 && resub.status === 200 && verify.status === 200, `corr=${corr.status} verify=${verify.status}`);
}

const checklist = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/final-review/checklist`, {
  items: {
    forms_complete: true,
    names_dates_consistent: true,
    history_complete: true,
    required_documents_verified: true,
    inconsistencies_reviewed: true,
  },
  notes: "Staging smoke review.",
});
const readyClient = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/final-review/ready-for-client`);
record("12.final_consultant_review", checklist.status === 200 && readyClient.status === 200 && checklist.json.final_review?.automatic_approval === false, `checklist=${checklist.status}`);

const ack403 = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/final-review/acknowledge`);
const ack = await api(clientToken, "POST", "/client/final-review/acknowledge");
const clientReview = await api(clientToken, "GET", "/client/final-review");
let signedDecl = { status: 200 };
if (clientReview.json.final_review?.signature_required) {
  signedDecl = await api(clientToken, "POST", "/client/final-review/sign", { signature: "Staging Journey Client" });
}
record("13.client_final_review", ack403.status === 403 && ack.status === 200 && signedDecl.status === 200, `consultant_ack=${ack403.status} client_ack=${ack.status}`);

const portal = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/requirement-plan/confirm-portal`, {
  portal: "ircc_rep",
  note: "Consultant confirmed IRCC representative portal.",
});
record("14.portal_confirmation", portal.status === 200 && portal.json.auto_submitted === false, `auto=${portal.json.auto_submitted}`);

const rts = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/final-review/ready-to-submit`);
const submit = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/submission`, {
  submission_date: "2026-09-13",
  application_number: "W555111333",
  confirmation_number: "CONF-STAGING",
  government_fees: 150,
  payment_confirmation: "PAY-STAGING",
});
const overwrite = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/submission`, {
  submission_date: "2026-09-14",
  application_number: "CHANGED",
});
record("15.submission_record", submit.status === 200 && submit.json.auto_submitted === false && overwrite.status === 422 && rts.json.auto_submitted === false, `submit=${submit.status} overwrite=${overwrite.status}`);

const due = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const gov = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/government-requests`, {
  type: "biometrics",
  due_at: due,
  notes: "Book biometrics.",
});
record("16.government_request", gov.status === 201, `HTTP ${gov.status}`);

const calTo = new Date();
calTo.setDate(calTo.getDate() + 14);
const calBeforeAnswer = await api(consultantToken, "GET", `/consultant/calendar?from=${new Date().toISOString().slice(0, 10)}&to=${calTo.toISOString().slice(0, 10)}&timezone=America/Toronto`);
const govEvent = (calBeforeAnswer.json.events ?? []).find((e) => e.source === "government_request" && String(e.client_profile_id) === String(profileId));

const requestId = gov.json.request?.id;
const inProg = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/government-requests/${requestId}/in-progress`);
const answered = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/government-requests/${requestId}/answered`, { notes: "Biometrics completed." });
record("17.response", inProg.status === 200 && answered.status === 200, `prog=${inProg.status} ans=${answered.status}`);

const decisionFd = new FormData();
decisionFd.append("decision_status", "approved");
decisionFd.append("decision_note", "Study permit approved.");
decisionFd.append("next_step_note", "Prepare landing documents.");
decisionFd.append("letter", new Blob(["%PDF-1.4 letter"], { type: "application/pdf" }), "decision.pdf");
const decision = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/decision`, decisionFd);
const decisionAgain = await api(consultantToken, "POST", `/consultant/clients/${profileId}/case-file/decision`, { decision_status: "refused" });
record("18.decision", decision.status === 200 && decisionAgain.status === 422, `first=${decision.status} second=${decisionAgain.status}`);

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
record("19.closure", closeList.status === 200 && closed.status === 200 && row?.is_closed === true, `closed=${row?.is_closed}`);

const pipe = await api(consultantToken, "GET", "/consultant/case-pipeline");
const notifs = await api(clientToken, "GET", "/notifications?per_page=20");
const history = await api(consultantToken, "GET", `/consultant/clients/${profileId}/case-file/case-history`);
const events = history.json.events ?? history.json.data ?? [];
const types = events.map((e) => e.event_type);
const uniqueSubmit = types.filter((t) => t === "application_submitted").length;
const clientHub = await api(clientToken, "GET", "/client/dashboard");
const counts = pipe.json.counts ?? {};
const closedNotAttention = row?.is_closed === true && (row.needs_attention !== true);

record("sync.dashboard", pipe.status === 200 && counts.in_preparation !== undefined && counts.needs_attention !== undefined, `prep=${counts.in_preparation} attention=${counts.needs_attention} gov=${counts.government_processing} closed_not_attention=${closedNotAttention}`);
record("sync.pending_or_pipeline", pipe.status === 200 && Boolean(row), `pipeline=${pipe.status}`);
record("sync.calendar", Boolean(govEvent?.href), `href=${govEvent?.href ?? "missing"}`);
record("sync.notifications", (notifs.json.data ?? []).some((n) => String(n.action_url ?? "").includes("government-requests")), `count=${(notifs.json.data ?? []).length}`);
record("sync.case_history", history.status === 200 && uniqueSubmit === 1, `application_submitted=${uniqueSubmit} total=${types.length}`);
record("sync.client_journey", clientHub.status === 200, `HTTP ${clientHub.status}`);
record("audit.no_auto_submit", submit.json.auto_submitted === false, `auto_submitted=${submit.json.auto_submitted}`);
record("audit.no_dup_history", uniqueSubmit === 1, `application_submitted=${uniqueSubmit}`);

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
writeFileSync(STAGES, JSON.stringify({ email: EMAIL, profileId, caseFileId, api: API, results }, null, 2));
writeFileSync(REPORT, `# Isolated staging journey\n\nDate: ${new Date().toISOString()}\nAPI: ${API}\nClient: ${EMAIL} (profile ${profileId}, case ${caseFileId})\nResult: ${failed === 0 ? "PASS" : "FAIL"} (${passed} passed, ${failed} failed)\n\n| Stage | Result | Detail |\n|-------|--------|--------|\n${results.map((r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail.replaceAll("|", "/")} |`).join("\n")}\n`);
console.log(`\nSTAGING JOURNEY ${failed === 0 ? "PASS" : "FAIL"} ${passed}/${results.length}`);
process.exit(failed === 0 ? 0 : 1);
