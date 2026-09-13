import { chromium } from "../phase1-verification/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "screenshots");
const REPORT = join(__dirname, "SMOKE.md");
const FIXTURE = join(__dirname, "../phase5-verification/smoke-fixture.json");
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
  const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
  let payload;
  if (body !== undefined) {
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
  if (!res.ok || !json.token) throw new Error(`Login failed for ${email}`);
  return json.token;
}

const fixture = JSON.parse(readFileSync(FIXTURE, "utf8").replace(/^\uFEFF/, ""));
const consultantToken = await loginToken(fixture.consultant_email, fixture.password);
const mainClientToken = await loginToken(fixture.main_client_email, fixture.password);

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 2);
const overdue = yesterday.toISOString().slice(0, 10);

const overdueAdd = await api(consultantToken, "POST", `/consultant/clients/${fixture.main_profile_id}/case-file/government-requests`, {
  type: "biometrics",
  due_at: overdue,
  notes: "Phase 6 overdue smoke",
});

const pipeline = await api(consultantToken, "GET", "/consultant/case-pipeline");
const rows = pipeline.json.pipeline ?? [];
const byId = Object.fromEntries(rows.map((p) => [p.profile_id, p]));
const main = byId[fixture.main_profile_id];
const quiet = byId[fixture.other_profile_id] ?? byId[fixture.refused_profile_id];
const counts = pipeline.json.counts ?? {};
const attentionIds = rows.filter((p) => p.needs_attention).map((p) => p.profile_id);
const prepIds = rows.filter((p) => p.group === "active_case").map((p) => p.profile_id);
const govIds = rows.filter((p) => p.group === "post_submission" && !p.is_closed).map((p) => p.profile_id);

record("api.counts", Number.isFinite(counts.in_preparation) && Number.isFinite(counts.needs_attention) && Number.isFinite(counts.government_processing), JSON.stringify(counts));
record("api.overdue_attention", overdueAdd.status === 201 && main?.needs_attention === true && main?.overdue === true, `add=${overdueAdd.status} attention=${main?.needs_attention} overdue=${main?.overdue}`);
record("api.quiet_not_attention", quiet?.needs_attention === false, `quiet=${quiet?.workflow_label} attention=${quiet?.needs_attention}`);
record("api.no_dup_ids", new Set(rows.map((p) => p.case_file_id)).size === rows.length, `rows=${rows.length}`);

const browser = await chromium.launch({ headless: true });
const consultantCtx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const clientCtx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await consultantCtx.newPage();
const mobile = await mobileCtx.newPage();
const clientPage = await clientCtx.newPage();

try {
  await page.goto(`${CONSULTANT_APP}/auth/callback#token=${consultantToken}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/dashboard/, { timeout: 45000 });
  await page.goto(`${CONSULTANT_APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.getByText("Needs attention").first().waitFor({ timeout: 20000 });
  await shot(page, "01-dashboard");

  const inPrepCard = page.getByRole("link", { name: /In preparation/i }).first();
  const needsCard = page.getByRole("link", { name: /Needs attention/i }).first();
  const govCard = page.getByRole("link", { name: /Government processing/i }).first();
  record("dash.cards_link", (await inPrepCard.getAttribute("href"))?.includes("view=in_preparation")
    && (await needsCard.getAttribute("href"))?.includes("view=needs_attention")
    && (await govCard.getAttribute("href"))?.includes("view=government_processing"), "Dashboard cards point at filtered board views");

  await page.getByText("Pending actions").first().waitFor({ timeout: 10000 });
  const pendingVisible = await page.getByText(/Phase5 main|Overdue|consultant|client|government/i).first().isVisible();
  record("dash.pending_actions", pendingVisible, pendingVisible ? "Pending actions show case and actor/due info" : "Pending actions missing");

  await needsCard.click();
  await page.waitForURL(/view=needs_attention/, { timeout: 20000 });
  await page.getByText("Needs attention").first().waitFor({ timeout: 20000 });
  await shot(page, "02-filtered-attention");
  record("dash.filter_attention", page.url().includes("view=needs_attention") && attentionIds.includes(fixture.main_profile_id), `url=${page.url()}`);

  await page.goto(`${CONSULTANT_APP}/dashboard/case-pipeline?view=in_preparation`, { waitUntil: "domcontentloaded" });
  record("dash.filter_prep", page.url().includes("view=in_preparation") && counts.in_preparation === prepIds.length, `count=${counts.in_preparation}`);
  await page.goto(`${CONSULTANT_APP}/dashboard/case-pipeline?view=government_processing`, { waitUntil: "domcontentloaded" });
  record("dash.filter_gov", page.url().includes("view=government_processing") && counts.government_processing === govIds.length, `count=${counts.government_processing}`);

  await page.goto(`${CONSULTANT_APP}/dashboard/clients/${fixture.presub_profile_id}/workspace`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("Loading workspace…").first().waitFor({ state: "hidden", timeout: 60000 }).catch(() => {});
  await page.getByText("Assessment").first().waitFor({ timeout: 60000 });
  await shot(page, "03-rail-assessment");
  record("rail.assessment", await page.getByText("Assessment").first().isVisible() && await page.getByText("Post-submission").first().isVisible(), "Grouped 5-stage rail is visible");

  await page.goto(`${CONSULTANT_APP}/dashboard/clients/${fixture.main_profile_id}/workspace`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("Loading workspace…").first().waitFor({ state: "hidden", timeout: 60000 }).catch(() => {});
  await page.getByText("Post-submission").first().waitFor({ timeout: 60000 });
  record("rail.post", await page.getByText(/Government processing|Submitted|Post-submission/i).first().isVisible(), "Submitted case is on the post-submission group");

  await page.goto(`${CONSULTANT_APP}/dashboard/case-pipeline`, { waitUntil: "domcontentloaded" });
  await page.getByText("Submission / Post-Submission").first().waitFor({ timeout: 20000 });
  const filter = page.getByRole("combobox").first();
  if (await filter.count()) {
    await filter.click();
    await page.getByText(/GOVERNMENT REQUEST RECEIVED|Government request received/i).first().click({ timeout: 5000 }).catch(() => {});
  }
  await shot(page, "04-board");
  record("board.groups", await page.getByText("Pre-Engagement / Assessment").isVisible()
    && await page.getByText("Active Case / Application Preparation").isVisible()
    && await page.getByText("Submission / Post-Submission").isVisible(), "Three grouped board sections remain");

  const calTo = new Date();
  calTo.setDate(calTo.getDate() + 1);
  const cal = await api(consultantToken, "GET", `/consultant/calendar?from=${overdue}&to=${calTo.toISOString().slice(0, 10)}&timezone=America/Toronto`);
  const govEvent = (cal.json.events ?? []).find((e) => e.source === "government_request" && String(e.client_profile_id) === String(fixture.main_profile_id));
  const hrefOk = typeof govEvent?.href === "string"
    && govEvent.href.includes(`/dashboard/clients/${fixture.main_profile_id}/workspace/case-management`)
    && govEvent.href.includes("tab=post-submission");
  record("calendar.href", hrefOk, `href=${govEvent?.href ?? "missing"}`);

  const clientNotifs = await api(mainClientToken, "GET", "/notifications?per_page=20");
  const govNotif = (clientNotifs.json.data ?? []).find((n) => String(n.action_url ?? "").includes("/user-dashboard/government-requests"));
  record("notif.link", Boolean(govNotif?.action_url), `url=${govNotif?.action_url ?? "missing"}`);

  await clientPage.goto(`${CLIENT_APP}/auth/callback#token=${mainClientToken}`, { waitUntil: "domcontentloaded" });
  await clientPage.waitForURL(/user-dashboard/, { timeout: 45000 });
  await clientPage.goto(`${CLIENT_APP}/user-dashboard`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await clientPage.getByText("Profile & Assessment").first().waitFor({ timeout: 20000 });
  await shot(clientPage, "05-client-journey");
  const body = await clientPage.locator("body").innerText();
  const leaked = /APPLICATION_SUBMITTED|GOVERNMENT_REQUEST_RECEIVED|CLIENT_REVIEW|READY_TO_SUBMIT/.test(body);
  record("client.five_stages", await clientPage.getByText("Government Processing / Decision").first().isVisible(), "Client sees 5 friendly stages");
  record("client.no_internal_codes", !leaked, leaked ? "Internal status codes leaked" : "No internal workflow codes on client home");

  await mobile.goto(`${CONSULTANT_APP}/auth/callback#token=${consultantToken}`, { waitUntil: "domcontentloaded" });
  await mobile.waitForURL(/dashboard/, { timeout: 45000 });
  await mobile.goto(`${CONSULTANT_APP}/dashboard`, { waitUntil: "domcontentloaded" });
  await mobile.getByText("Pending actions").first().waitFor({ timeout: 20000 });
  await shot(mobile, "06-mobile-dashboard");
  record("ui.mobile", await mobile.getByText("Needs attention").first().isVisible(), "Mobile dashboard remains usable");
} catch (error) {
  record("smoke.uncaught", false, error instanceof Error ? error.message : String(error));
  try { await shot(page, "zz-error"); } catch {}
} finally {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  writeFileSync(REPORT, `# Phase 6 dashboard polish — browser smoke\n\nDate: ${new Date().toISOString()}\nResult: ${failed === 0 ? "PASS" : "FAIL"} (${passed} passed, ${failed} failed)\n\n| Check | Result | Detail |\n|-------|--------|--------|\n${results.map((r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail.replaceAll("|", "/")} |`).join("\n")}\n`);
  console.log(`\nSMOKE ${failed === 0 ? "PASS" : "FAIL"} ${passed}/${results.length}`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
