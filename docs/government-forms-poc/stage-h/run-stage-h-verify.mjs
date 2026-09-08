#!/usr/bin/env node
/** Stage H verification — IMM 5406 UI-parity API flow. */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.STAGE_H_API_URL ?? "http://127.0.0.1:8000/api/v1";
const CONSULTANT_EMAIL = process.env.STAGE_H_CONSULTANT_EMAIL ?? "stageh.consultant@rcicmaster.test";
const CONSULTANT_PASSWORD = process.env.STAGE_H_CONSULTANT_PASSWORD ?? "StageHTest123!";
const PROFILE_ID = process.env.STAGE_H_PROFILE_ID ?? "14";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "artifacts");
const REPORT_PATH = join(__dirname, "STAGE_H_VERIFY_RESULT.json");

const log = [];
function record(step, data) {
  log.push({ step, at: new Date().toISOString(), ...data });
  console.log(`[${step}]`, data.ok === false ? "FAIL" : "OK", JSON.stringify(data).slice(0, 240));
}

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email: CONSULTANT_EMAIL, password: CONSULTANT_PASSWORD }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "login failed");
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
  return { res, json: await res.json().catch(() => null) };
}

function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const token = await login();
  record("login", { ok: true });

  const base = `/consultant/clients/${PROFILE_ID}/government-forms`;
  await api(token, `${base}/application-info/review`, { method: "POST", body: "{}" });

  const { res: indexRes, json: indexJson } = await api(token, base);
  const form = indexJson?.forms?.find((f) => f.form_code === "IMM5406");
  record("readiness", {
    ok: Boolean(form?.readiness?.ready),
    percentage: form?.readiness?.percentage,
    overflow: form?.readiness?.overflow_warnings ?? [],
  });
  if (!form?.readiness?.ready) {
    throw new Error(`IMM5406 not ready: ${JSON.stringify(form?.readiness?.missing_fields)}`);
  }

  const gen = await api(token, `${base}/IMM5406/generate`, { method: "POST", body: "{}" });
  if (gen.res.status !== 201) throw new Error(gen.json?.message ?? "generate failed");
  const submission = gen.json.submission;
  record("generate", { ok: true, submission_id: submission.id, output_sha256: submission.output_sha256 });

  const downloadUrl = `${API}${base}/generations/${submission.id}/download?download=1`;
  const dlRes = await fetch(downloadUrl, {
    headers: { Accept: "application/pdf,*/*", Authorization: `Bearer ${token}` },
  });
  if (!dlRes.ok) throw new Error(`download failed: ${dlRes.status}`);
  const pdfBytes = Buffer.from(await dlRes.arrayBuffer());
  const downloadedSha = sha256Buffer(pdfBytes);
  const downloadPath = join(OUTPUT_DIR, `IMM5406-StageH-${submission.id}.pdf`);
  await writeFile(downloadPath, pdfBytes);

  record("secure_download", {
    ok: downloadedSha === submission.output_sha256,
    downloaded_sha256: downloadedSha,
    db_output_sha256: submission.output_sha256,
    path: downloadPath,
  });

  const report = { profile_id: PROFILE_ID, submission_id: submission.id, download_path: downloadPath, downloaded_sha256: downloadedSha, log };
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log("\nDownload for Adobe:", downloadPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
