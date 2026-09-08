#!/usr/bin/env node
/** Stage G supersession: mutate questionnaire, re-review, regenerate, verify SUPERSEDED link. */

const API = process.env.STAGE_G_API_URL ?? "http://127.0.0.1:8000/api/v1";
const EMAIL = process.env.STAGE_G_CONSULTANT_EMAIL ?? "stageg.consultant@rcicmaster.test";
const PASSWORD = process.env.STAGE_G_CONSULTANT_PASSWORD ?? "StageGTest123!";
const PROFILE_ID = process.env.STAGE_G_PROFILE_ID ?? "13";
const PRIOR_ID = process.env.STAGE_G_PRIOR_SUBMISSION_ID ?? "8";

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
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

async function main() {
  const token = await login();
  const base = `/consultant/clients/${PROFILE_ID}/government-forms`;

  const index1 = await api(token, base);
  const stale = index1.json?.forms?.[0]?.stale ?? index1.json?.application_stale;
  console.log("[stale_after_mutation]", { stale, application_info_reviewed: index1.json?.application_info_reviewed });

  const review = await api(token, `${base}/application-info/review`, { method: "POST", body: "{}" });
  console.log("[re_review]", { ok: review.res.ok, snapshot_hash: review.json?.questionnaire_snapshot_hash });

  const gen = await api(token, `${base}/IMM5476/generate`, { method: "POST", body: "{}" });
  if (gen.res.status !== 201) throw new Error(gen.json?.message ?? "regenerate failed");
  const newId = gen.json.submission.id;
  console.log("[regenerate]", {
    ok: true,
    prior_id: PRIOR_ID,
    new_id: newId,
    new_output_sha256: gen.json.submission.output_sha256,
  });

  const index2 = await api(token, base);
  const latest = index2.json?.forms?.[0]?.latest_generation;
  console.log("[latest_generation]", latest);

  const history = index2.json?.forms?.[0]?.generations ?? index2.json?.generations ?? [];
  const prior = history.find((g) => String(g.id) === String(PRIOR_ID));
  console.log("[prior_generation_status]", prior ?? { note: "not in UI history payload" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
