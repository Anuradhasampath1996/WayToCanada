const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(accept = "application/json") {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: accept,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type CompliancePacketPreview = {
  report_ref: string;
  generated_at: string;
  case_status: string | null;
  pathway: string | null;
  agreement: {
    signed_at: string | null;
    sent_at: string | null;
    total_fee: number;
    currency: string;
  } | null;
  trust: {
    balance_held: number;
    total_deposited: number;
    ledger_entries: number;
    milestones: number;
  };
  documents_count: number;
  activity_events: number;
  activity_in_packet: number;
  activity_truncated: boolean;
  compliance_note: string;
};

export async function fetchCompliancePacketPreview(clientId: number): Promise<CompliancePacketPreview> {
  const res = await fetch(`${API}/consultant/clients/${clientId}/compliance-packet`, {
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message ?? "Failed to load compliance packet preview.");
  }
  return json as CompliancePacketPreview;
}

export async function downloadCompliancePacketPdf(clientId: number): Promise<void> {
  const res = await fetch(`${API}/consultant/clients/${clientId}/compliance-packet/pdf`, {
    headers: authHeaders("application/pdf"),
  });
  const contentType = res.headers.get("Content-Type") ?? "";
  if (!res.ok) {
    let message = "Failed to generate compliance packet.";
    if (contentType.includes("application/json")) {
      const json = await res.json().catch(() => null);
      if (json?.message) message = String(json.message);
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
  if (!blob.size || (!contentType.includes("pdf") && !isPdf)) {
    throw new Error("Server did not return a valid PDF file.");
  }
  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^";\n]+)"?/);
  const filename = match?.[1] ?? `compliance-packet-${clientId}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
