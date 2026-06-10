import json, re

p = r'c:\Users\anura\AppData\Roaming\Code\User\workspaceStorage\972fca9b2b094675e96eb4387c5a7430\GitHub.copilot-chat\transcripts\215e5a0f-bfe5-400b-b212-ffb80e6e57fc.jsonl'
with open(p, encoding='utf-8') as f:
    transcript_lines = f.readlines()

obj = json.loads(transcript_lines[4074])
args = obj.get('data', {}).get('arguments', {})
cmd = args.get('command', '')

start_marker = "@'\n"
end_marker = "\n'@"
start = cmd.find(start_marker)
end = cmd.rfind(end_marker)
original = cmd[start + len(start_marker):end]

# ── Replace DocumentFieldRow with DocCard ──────────────────────────────────

doc_field_row_start = original.find("// --- Document Field Row ---")
doc_field_row_end   = original.find("\n// --- Text Field Row ---")

if doc_field_row_start == -1:
    print("ERROR: Could not find // --- Document Field Row ---")
    exit(1)

doc_card = '''// --- Document Card ---

function DocCard({
  label, value, fieldKey, verified, onVerify, onUpdate, verifySaving,
}: {
  label: string; value: unknown; fieldKey: string; verified: boolean;
  onVerify: (key: string) => void;
  onUpdate: (path: string, value: string) => Promise<void>;
  verifySaving: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef     = useRef<HTMLInputElement>(null);
  const currentPath = typeof value === "string" && value ? value : null;
  const displayName = currentPath ? fileBasename(currentPath) : "";
  const isPdf       = /\\.pdf$/i.test(displayName);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "client-document");
      const res  = await fetch(`${API}/documents/upload`, {
        method: "POST",
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Upload failed");
      await onUpdate(fieldKey, json.path as string);
    } catch {
      // error surfaced via parent toast
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{label}</p>
          {verified && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700">
              <ShieldCheck className="h-3 w-3" />Verified &amp; locked
            </span>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div className={cn(
        "rounded-lg border-2 border-dashed transition-colors",
        uploading     ? "border-primary/40 bg-primary/5"
        : currentPath ? "border-green-400 bg-green-50"
        :               "border-amber-300 bg-amber-50/40"
      )}>
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-primary p-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploading\u2026</span>
          </div>
        ) : currentPath ? (
          <div className="relative">
            <div className="w-full h-36 overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center select-none">
              {isPdf ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-14 w-14 text-red-400" />
                  <span className="text-xs font-medium text-red-400">PDF Document</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-14 w-14 text-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground text-center px-2 break-all">{displayName}</span>
                </div>
              )}
            </div>
            {/* Uploaded badge \u2014 bottom-left */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-green-600/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full shadow">
              <CheckCircle2 className="h-3 w-3" />
              Uploaded
            </div>
            {/* Verified badge \u2014 top-right */}
            {verified && (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-700/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full shadow">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </div>
            )}
          </div>
        ) : (
          <div
            className={cn("p-5 text-center space-y-1.5", !verified && "cursor-pointer")}
            onClick={() => !verified && fileRef.current?.click()}
          >
            <Upload className="h-7 w-7 text-amber-400/70 mx-auto" />
            <p className="text-xs font-medium text-amber-600">Not uploaded yet</p>
            <p className="text-[11px] text-muted-foreground/60">PDF, JPG, PNG \u2014 up to 10 MB</p>
          </div>
        )}
      </div>

      {/* Filename */}
      {displayName && (
        <p className="text-[11px] text-muted-foreground truncate" title={currentPath ?? ""}>{displayName}</p>
      )}

      {/* Actions */}
      {!verified && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-3.5 w-3.5" />
            {currentPath ? "Re-upload" : "Upload"}
          </Button>
          {currentPath && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs text-green-700 border-green-200 hover:bg-green-50"
              onClick={() => onVerify(fieldKey)}
              disabled={verifySaving}
            >
              {verifySaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Verify
            </Button>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}'''

new_content = original[:doc_field_row_start] + doc_card + original[doc_field_row_end:]

# ── Replace SectionGroup + PersonTab ────────────────────────────────────────

section_group_start = new_content.find("// --- Section Group ---")
person_tab_end_marker = "\n// --- Count verified/total ---"
person_tab_end = new_content.find(person_tab_end_marker)

if section_group_start == -1:
    print("ERROR: Could not find // --- Section Group ---")
    exit(1)
if person_tab_end == -1:
    print("ERROR: Could not find // --- Count verified/total ---")
    exit(1)

person_tab = '''// --- Person Tab ---

function PersonTab({
  fields, data, prefix, verifiedFields, onVerify, onUpdate, savingKey,
}: {
  fields: FieldDef[];
  data: Record<string, unknown> | null;
  prefix: string;
  verifiedFields: Record<string, boolean>;
  onVerify: (key: string) => void;
  onUpdate: (path: string, value: string) => Promise<void>;
  savingKey: string | null;
}) {
  const safeData = data ?? {};
  const sections = new Map<string, FieldDef[]>();
  for (const f of fields) {
    const list = sections.get(f.section) ?? [];
    list.push(f);
    sections.set(f.section, list);
  }

  return (
    <div>
      {Array.from(sections.entries()).map(([section, sectionFields]) => {
        const textFields = sectionFields.filter((f) => (f.type ?? "text") !== "document");
        const docFields  = sectionFields.filter((f) => f.type === "document");
        return (
          <div key={section} className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">{section}</p>

            {textFields.length > 0 && (
              <div className={cn("space-y-2", docFields.length > 0 && "mb-3")}>
                {textFields.map((f) => {
                  const fk         = `${prefix}.${f.key}`;
                  const isVerified = !!verifiedFields[fk];
                  const ft         = f.type ?? "text";
                  return (
                    <TextFieldRow
                      key={fk}
                      label={f.label}
                      value={safeData[f.key]}
                      fieldKey={fk}
                      verified={isVerified}
                      onVerify={onVerify}
                      onUpdate={onUpdate}
                      verifySaving={savingKey === fk}
                      type={ft === "textarea" ? "textarea" : ft === "date" ? "date" : "text"}
                    />
                  );
                })}
              </div>
            )}

            {docFields.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docFields.map((f) => {
                  const fk         = `${prefix}.${f.key}`;
                  const isVerified = !!verifiedFields[fk];
                  return (
                    <DocCard
                      key={fk}
                      label={f.label}
                      value={safeData[f.key]}
                      fieldKey={fk}
                      verified={isVerified}
                      onVerify={onVerify}
                      onUpdate={onUpdate}
                      verifySaving={savingKey === fk}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}'''

new_content = new_content[:section_group_start] + person_tab + new_content[person_tab_end:]

# Verify no old references remain
if 'DocumentFieldRow' in new_content:
    print("WARNING: DocumentFieldRow still present!")
if 'SectionGroup' in new_content:
    print("WARNING: SectionGroup still present!")

# ── Write the file ───────────────────────────────────────────────────────────
out = r'e:\WayToCanada\WayToCanada\frontend\Consultant Dashbord\app\dashboard\(auth)\clients\[id]\workspace\questionnaire-review\questionnaire-review-client.tsx'
with open(out, 'w', encoding='utf-8', newline='\n') as fout:
    fout.write(new_content)

line_count = new_content.count('\n') + 1
print(f"Written {len(new_content)} chars, {line_count} lines")
print("Done!")
