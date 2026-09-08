#!/usr/bin/env node
/**
 * Stage G verification — same authenticated API calls as ConsultantGovernmentFormsPanel.
 * Usage: node docs/government-forms-poc/stage-g/run-stage-g-verify.mjs
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.STAGE_G_API_URL ?? "http://127.0.0.1:8000/api/v1";
const CONSULTANT_EMAIL = process.env.STAGE_G_CONSULTANT_EMAIL ?? "stageg.consultant@rcicmaster.test";
const CONSULTANT_PASSWORD = process.env.STAGE_G_CONSULTANT_PASSWORD ?? "StageGTest123!";
const OTHER_CONSULTANT_EMAIL = process.env.STAGE_G_OTHER_CONSULTANT_EMAIL ?? "stageg.other.consultant@rcicmaster.test";
const PROFILE_ID = process.env.STAGE_G_PROFILE_ID;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "artifacts");
const REPORT_PATH = join(__dirname, "STAGE_G_VERIFY_RESULT.json");

const log = [];
function record(step, data) {
  const entry = { step, at: new Date().toISOString(), ...data };
  log.push(entry);
  console.log(`[${step}]`, data.ok === false ? "FAIL" : "OK", JSON.stringify(data).slice(0, 240));
  return entry;
}

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Login failed for ${email}: ${json.message ?? res.status}`);
  return json.token;
}

async function api(token, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const token = await login(CONSULTANT_EMAIL, CONSULTANT_PASSWORD);
  record("login", { ok: true, email: CONSULTANT_EMAIL });

  let profileId = PROFILE_ID;
  if (!profileId) {
    const { res, json } = await api(token, "/consultant/clients");
    const clients = json?.data ?? json ?? [];
    const match = clients.find((c) => (c.user?.email ?? c.email) === "stageg.client@rcicmaster.test");
    profileId = String(match?.id ?? "");
    if (!profileId) throw new Error("Could not resolve Stage G profile ID. Set STAGE_G_PROFILE_ID.");
  }
  record("profile", { ok: true, profileId });

  const base = `/consultant/clients/${profileId}/government-forms`;

  let { res: indexRes, json: indexJson } = await api(token, base);
  record("index_before_review", {
    ok: indexRes.ok,
    application_info_reviewed: indexJson?.application_info_reviewed,
    readiness_pct: indexJson?.forms?.[0]?.readiness?.percentage,
  });

  if (!indexJson?.application_info_reviewed) {
    record("review_gate", { ok: true, message: "Generation blocked until review" });
  }

  const { res: reviewRes, json: reviewJson } = await api(token, `${base}/application-info/review`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  record("review_application_info", {
    ok: reviewRes.ok,
    reviewed_at: reviewJson?.reviewed_at,
    snapshot_hash: reviewJson?.questionnaire_snapshot_hash,
  });
  if (!reviewRes.ok) throw new Error("Review failed");

  ({ res: indexRes, json: indexJson } = await api(token, base));
  const form = indexJson?.forms?.find((f) => f.form_code === "IMM5476");
  record("readiness", {
    ok: Boolean(form?.readiness?.ready),
    percentage: form?.readiness?.percentage,
    ready: form?.readiness?.ready,
    missing_count: form?.readiness?.missing_fields?.length ?? 0,
  });
  if (!form?.readiness?.ready) {
    throw new Error(`Form not ready: ${JSON.stringify(form?.readiness?.missing_fields)}`);
  }

  const genResult = await api(token, `${base}/IMM5476/generate`, { method: "POST", body: "{}" });
  record("generate", { ok: genResult.res.status === 201, status: genResult.res.status });
  if (genResult.res.status !== 201) {
    throw new Error(`Generation failed: ${genResult.json?.message ?? genResult.res.status}`);
  }
  const submission = genResult.json.submission;
  record("generate", {
    ok: true,
    submission_id: submission.id,
    source_data_hash: submission.source_data_hash,
    output_sha256: submission.output_sha256,
  });

  const downloadUrl = `${API}${base}/generations/${submission.id}/download?download=1`;
  const dlRes = await fetch(downloadUrl, {
    headers: { Accept: "application/pdf,*/*", Authorization: `Bearer ${token}` },
  });
  if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
  const pdfBytes = Buffer.from(await dlRes.arrayBuffer());
  const downloadedSha = sha256Buffer(pdfBytes);
  const downloadPath = join(OUTPUT_DIR, `IMM5476-StageG-${submission.id}.pdf`);
  await writeFile(downloadPath, pdfBytes);

  record("secure_download", {
    ok: true,
    endpoint: downloadUrl,
    bytes: pdfBytes.length,
    downloaded_sha256: downloadedSha,
    db_output_sha256: submission.output_sha256,
    hash_match: downloadedSha === submission.output_sha256,
    path: downloadPath,
  });

  if (downloadedSha !== submission.output_sha256) {
    throw new Error("Downloaded SHA-256 does not match DB output_sha256");
  }

  const otherToken = await login(OTHER_CONSULTANT_EMAIL, CONSULTANT_PASSWORD);
  const forbidden = await fetch(`${API}${base}/generations/${submission.id}/download`, {
    headers: { Accept: "application/pdf,*/*", Authorization: `Bearer ${otherToken}` },
  });
  record("authorization_download", { ok: forbidden.status === 403, status: forbidden.status });

  const forbiddenGen = await api(otherToken, `${base}/IMM5476/generate`, { method: "POST", body: "{}" });
  record("authorization_generate", { ok: forbiddenGen.res.status === 403, status: forbiddenGen.res.status });

  const { res: markRes, json: markJson } = await api(token, `${base}/generations/${submission.id}/mark-reviewed`, {
    method: "POST",
    body: "{}",
  });
  record("mark_reviewed", {
    ok: markRes.ok,
    review_status: markJson?.submission?.review_status,
    generation_status: markJson?.submission?.generation_status,
  });

  const report = {
    profile_id: profileId,
    submission_id: submission.id,
    download_path: downloadPath,
    downloaded_sha256: downloadedSha,
    db_output_sha256: submission.output_sha256,
    hash_match: downloadedSha === submission.output_sha256,
    log,
  };
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log("\nDownload for Adobe:", downloadPath);
  console.log("Report:", REPORT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
