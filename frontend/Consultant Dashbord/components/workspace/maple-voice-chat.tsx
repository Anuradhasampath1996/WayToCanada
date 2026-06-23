"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Paperclip, Send, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MAPLE_ASSISTANT } from "@/lib/workspace-ai-character";
import { MapleAvatar } from "@/components/workspace/maple-avatar";
import {
  createSpeechRecognition,
  speakMaple,
  speechRecognitionSupported,
  speechSynthesisSupported,
  stopSpeaking,
} from "@/lib/maple-voice";
import { LegislationLinkChips, type LegislationLink } from "@/components/legislation/legislation-link-chips";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  aiPowered?: boolean;
  intelligenceMode?: string;
  legislationLinks?: LegislationLink[];
};

type MapleDocument = {
  id: number;
  original_filename: string;
  char_count: number;
  page_count?: number | null;
  extraction_method?: string | null;
  status: "ready" | "failed" | string;
  error_message?: string | null;
  created_at?: string;
};

function authHeadersJson(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function authHeadersMultipart(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function MapleVoiceToggle({
  voiceOn,
  speaking,
  onClick,
}: {
  voiceOn: boolean;
  speaking: boolean;
  onClick: () => void;
}) {
  const isPlaying = speaking && voiceOn;

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn(
        "relative h-8 w-8 overflow-visible",
        isPlaying && "bg-emerald-500/10 hover:bg-emerald-500/15",
      )}
      title={voiceOn ? (isPlaying ? "Maple is speaking" : "Maple speaks replies") : "Text only"}
      onClick={onClick}
      aria-pressed={voiceOn}
      aria-live="polite"
    >
      {isPlaying && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border border-emerald-500/45 animate-maple-sound-ring"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border border-emerald-400/35 animate-maple-sound-ring [animation-delay:0.55s]"
          />
        </>
      )}

      <span className={cn("relative z-10", isPlaying && "animate-maple-sound-icon")}>
        {voiceOn ? (
          <Volume2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <VolumeX className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
    </Button>
  );
}

export function MapleVoiceChat({
  clientId,
  openAiAvailable = true,
  onLegislationLinkClick,
}: {
  clientId: number;
  openAiAvailable?: boolean;
  onLegislationLinkClick?: (link: LegislationLink) => void;
}) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<MapleDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stopSpeakRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canListen = speechRecognitionSupported();
  const canSpeak = speechSynthesisSupported();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, loading]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      stopSpeakRef.current?.();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`${API}/consultant/clients/${clientId}/ai-advisor/state`, {
          headers: authHeadersJson(),
        });
        if (!res.ok) return;
        const json = await res.json();
        const rows = (json.data?.chat_messages ?? []) as Array<{
          role: string;
          content: string;
          openai_used?: boolean | null;
          metadata?: { legislation_links?: LegislationLink[] } | null;
        }>;
        setHistory(
          rows.map((row) => ({
            role: row.role === "assistant" ? "assistant" : "user",
            content: row.content,
            aiPowered: row.role === "assistant" ? row.openai_used === true : undefined,
            intelligenceMode:
              row.role === "assistant"
                ? row.openai_used
                  ? "ai_enhanced"
                  : "rules_engine"
                : undefined,
            legislationLinks:
              row.role === "assistant" ? row.metadata?.legislation_links : undefined,
          })),
        );
        setDocuments((json.data?.documents ?? []) as MapleDocument[]);
      } catch {
        // ignore
      }
    }
    void loadHistory();
  }, [clientId]);

  const uploadDocument = useCallback(
    async (file: File) => {
      setUploading(true);
      setError("");
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${API}/consultant/clients/${clientId}/ai-advisor/documents`, {
          method: "POST",
          headers: authHeadersMultipart(),
          body: form,
        });
        let json: { message?: string; data?: MapleDocument } = {};
        try {
          json = await res.json();
        } catch {
          throw new Error(
            res.status === 404
              ? "Upload API not found — restart the Laravel backend."
              : `Upload failed (${res.status}).`,
          );
        }
        if (!res.ok) throw new Error(json?.message ?? "Upload failed.");

        const doc = json.data as MapleDocument;
        setDocuments((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);
        if (doc.status !== "ready") {
          setError(doc.error_message ?? json.message ?? "Could not read text from this file.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [clientId],
  );

  const removeDocument = useCallback(
    async (docId: number) => {
      setError("");
      try {
        const res = await fetch(`${API}/consultant/clients/${clientId}/ai-advisor/documents/${docId}`, {
          method: "DELETE",
          headers: authHeadersJson(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? "Could not remove file.");
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove file.");
      }
    },
    [clientId],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || loading) return;

      setError("");
      setInput("");
      setHistory((h) => [...h, { role: "user", content: message }]);
      setLoading(true);

      try {
        const res = await fetch(`${API}/consultant/clients/${clientId}/ai-advisor/chat`, {
          method: "POST",
          headers: authHeadersJson(),
          body: JSON.stringify({ message }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message ?? "Maple could not reply.");

        const reply = String(json.data?.reply ?? "");
        const aiPowered = Boolean(json.data?.openai_used);
        const intelligenceMode = String(json.data?.intelligence_mode ?? (aiPowered ? "ai_enhanced" : "rules_engine"));
        const legislationLinks = (json.data?.legislation_links ?? []) as LegislationLink[];
        setHistory((h) => [
          ...h,
          { role: "assistant", content: reply, aiPowered, intelligenceMode, legislationLinks },
        ]);

        if (voiceOn && canSpeak && reply) {
          setSpeaking(true);
          stopSpeakRef.current?.();
          stopSpeakRef.current = speakMaple(reply, () => setSpeaking(false));
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Chat failed.");
      } finally {
        setLoading(false);
      }
    },
    [clientId, loading, voiceOn, canSpeak],
  );

  function toggleListen() {
    if (!canListen) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge, or type your question.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    setError("");
    const rec = createSpeechRecognition();
    if (!rec) return;

    recognitionRef.current = rec;
    let finalText = "";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput(finalText || interim);
    };

    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) void sendMessage(finalText.trim());
    };

    rec.onerror = () => {
      setListening(false);
      setError("Could not hear you. Check your microphone and try again.");
    };

    setListening(true);
    rec.start();
  }

  function toggleVoiceReplies() {
    if (speaking) {
      stopSpeakRef.current?.();
      stopSpeaking();
      setSpeaking(false);
    }
    setVoiceOn((v) => !v);
  }

  return (
    <section className="rounded-xl border border-border/70 bg-background">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground">
          Ask {MAPLE_ASSISTANT.name} anything about this client
        </p>
        <div className="flex items-center gap-2">
          {!openAiAvailable && (
            <Badge variant="secondary" className="text-[10px]">Rules mode</Badge>
          )}
          {canSpeak && (
            <MapleVoiceToggle voiceOn={voiceOn} speaking={speaking} onClick={toggleVoiceReplies} />
          )}
        </div>
      </div>

      <div className="border-b border-border/60 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-muted-foreground">Attached files for Q&amp;A</p>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,application/pdf,image/*,text/plain"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadDocument(file);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 rounded-lg text-[11px]"
              disabled={uploading || loading || documents.filter((d) => d.status === "ready").length >= 5}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
              Upload file
            </Button>
          </div>
        </div>
        {documents.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-[11px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{doc.original_filename}</p>
                  <p className="text-muted-foreground">
                    {doc.status === "ready"
                      ? `${doc.char_count.toLocaleString()} chars${doc.page_count ? ` · ${doc.page_count} pg` : ""}`
                      : (doc.error_message ?? "Text extraction failed") + " — remove and upload again."}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  title="Remove file"
                  onClick={() => void removeDocument(doc.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            PDF, image, or .txt — then ask Maple about what&apos;s inside (e.g. expiry date, refusal reason).
          </p>
        )}
      </div>

      <div ref={scrollRef} className="max-h-[min(28rem,50vh)] space-y-3 overflow-y-auto px-3 py-3">
        {history.length === 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {MAPLE_ASSISTANT.voiceHint}
          </p>
        )}
        {history.map((turn, i) => (
          <div
            key={`${turn.role}-${i}`}
            className={cn(
              "flex gap-2 text-sm",
              turn.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {turn.role === "assistant" && <MapleAvatar size="sm" className="h-7 w-7 rounded-lg text-sm" />}
            <div className="max-w-[85%] space-y-1">
              <div
                className={cn(
                  "rounded-2xl px-3 py-2 leading-relaxed whitespace-pre-line",
                  turn.role === "user"
                    ? "bg-primary text-primary-foreground text-sm"
                    : "bg-muted text-foreground text-[13px]",
                )}
              >
                {turn.content}
              </div>
              {turn.role === "assistant" && (
                <>
                  <LegislationLinkChips
                    links={turn.legislationLinks ?? []}
                    compact
                    onLinkClick={onLegislationLinkClick}
                  />
                  <p className="px-1 text-[10px] text-muted-foreground">
                    {turn.intelligenceMode === "ai_enhanced" || turn.aiPowered
                      ? "AI-enhanced reply"
                      : "Rules engine reply"}
                  </p>
                </>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {MAPLE_ASSISTANT.thinkingLabel}
          </div>
        )}
      </div>

      <div className="border-t border-border/60 p-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Listening…" : "Type or tap the mic…"}
            className="h-10 rounded-xl text-sm"
            disabled={loading}
          />
          <Button
            type="button"
            size="icon"
            variant={listening ? "default" : "outline"}
            className={cn("h-10 w-10 shrink-0 rounded-xl", listening && "bg-red-600 hover:bg-red-700")}
            onClick={toggleListen}
            disabled={loading}
            title={canListen ? "Speak your question" : "Voice not supported"}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {speaking && (
          <p className="mt-1.5 text-center text-[10px] text-emerald-700">
            {MAPLE_ASSISTANT.name} is speaking…
          </p>
        )}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    </section>
  );
}
