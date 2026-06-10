$src = 'e:\WayToCanada\WayToCanada\frontend\Consultant Dashbord\app\dashboard\(auth)\account\account-client.tsx'
$orig = [System.IO.File]::ReadAllLines($src, [System.Text.Encoding]::UTF8)

# ── SignaturePad component to insert after line 141 (0-indexed) ──────────────
$sigPad = @'
function SignaturePad({
  onSave, onClear, isSaving,
}: {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  isSaving: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const lastPos   = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const c    = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const sx   = c.width  / rect.width;
    const sy   = c.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * sx,
      y: ((e as React.MouseEvent).clientY - rect.top)  * sy,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current || !lastPos.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
    lastPos.current = pos;
    setIsEmpty(false);
  }

  function endDraw() { drawing.current = false; lastPos.current = null; }

  function clearCanvas() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setIsEmpty(true);
    onClear();
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full rounded-lg border-2 border-dashed border-input bg-white cursor-crosshair"
          style={{ touchAction: "none" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {isEmpty && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none select-none">
            Draw your signature here
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button" size="sm"
          onClick={() => onSave(canvasRef.current!.toDataURL("image/png"))}
          disabled={isEmpty || isSaving}
          className="gap-1.5"
        >
          {isSaving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <CloudCheck className="h-3.5 w-3.5" />}
          {isSaving ? "Saving..." : "Save Signature"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} className="text-muted-foreground">
          Clear
        </Button>
      </div>
    </div>
  );
}

'@

# ── Signature handler functions to insert before "  // -- Render" ─────────────
$handlers = @'

  async function handleSaveSignature(dataUrl: string) {
    setSigSaving(true);
    setSigStatus("idle");
    try {
      const res  = await fetch(`${API}/consultant/profile/signature`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ signature: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) { setSigStatus("error"); return; }
      setSigSaved(json.digital_signature);
      setSigStatus("saved");
      setShowSigPad(false);
      setTimeout(() => setSigStatus(s => s === "saved" ? "idle" : s), 3000);
    } catch {
      setSigStatus("error");
    } finally {
      setSigSaving(false);
    }
  }

  async function handleClearSignature() {
    setSigSaving(true);
    try {
      await fetch(`${API}/consultant/profile/signature`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ signature: null }),
      });
      setSigSaved(null);
      setSigStatus("idle");
      setShowSigPad(false);
    } finally {
      setSigSaving(false);
    }
  }
'@

$sigPadLines   = $sigPad   -split "`r?`n"
$handlerLines  = $handlers -split "`r?`n"

$out = [System.Collections.Generic.List[string]]::new()

# Phase 1: copy lines 0..141 (1-based: lines 1-142), insert sigPad after index 141 (line 142 = empty)
for ($i = 0; $i -lt $orig.Length; $i++) {
    $out.Add($orig[$i])

    # Insert SignaturePad after the empty line following SavePill closing }
    # orig[140] = "}" and orig[141] = "" (empty)
    if ($i -eq 141) {
        foreach ($ln in $sigPadLines) { $out.Add($ln) }
    }

    # Insert handler functions after orig[301] = "" (empty line before Render comment)
    # Note: we use original index so shifts don't matter here
    if ($i -eq 301) {
        foreach ($ln in $handlerLines) { $out.Add($ln) }
    }
}

[System.IO.File]::WriteAllLines($src, $out, [System.Text.Encoding]::UTF8)
Write-Host "Done. Output lines: $($out.Count)"
