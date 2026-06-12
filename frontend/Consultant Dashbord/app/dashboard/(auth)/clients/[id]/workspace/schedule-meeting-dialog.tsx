"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, DatesSetArg, EventInput } from "@fullcalendar/core";
import {
  Loader2, Send, CalendarDays, Clock, AlertCircle, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import "./schedule-meeting-calendar.css";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";
const CALENDAR_HEIGHT = 440;

const PROVIDER_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
};

type BusyPeriod = {
  start: string;
  end: string;
  source: "client_meeting" | "google_calendar";
  title: string | null;
};

type MeetingAccount = {
  preferred_provider: "google_meet" | "zoom" | "teams";
  google_meet_ready: boolean;
  zoom_ready: boolean;
  teams_ready: boolean;
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeInputValue(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

function slotConflicts(start: Date, durationMinutes: number, busy: BusyPeriod[]) {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return busy.some((b) => rangesOverlap(start, end, new Date(b.start), new Date(b.end)));
}

function formatSelectedSlot(start: Date, durationMinutes: number) {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const date = start.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const time = `${start.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}`;
  return { date, time };
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  clientId,
  account,
  onScheduled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  account: MeetingAccount | null;
  onScheduled: () => void;
}) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto";
  const [busy, setBusy] = useState<BusyPeriod[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loadingBusy, setLoadingBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    duration: "60",
    provider: "google_meet",
  });

  const readyProviders = account
    ? (["google_meet", "zoom", "teams"] as const).filter((p) => {
        if (p === "google_meet") return account.google_meet_ready;
        if (p === "zoom") return account.zoom_ready;
        return account.teams_ready;
      })
    : [];

  const durationMinutes = Number(form.duration);
  const selectedSlot = selectedStart ? formatSelectedSlot(selectedStart, durationMinutes) : null;

  const loadAvailability = useCallback(async (from: Date, to: Date) => {
    setLoadingBusy(true);
    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        timezone,
      });
      const res = await fetch(
        `${API}/consultant/clients/${clientId}/meetings/availability?${params}`,
        { headers: authHeaders() },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not load calendar");
      setBusy(data.busy ?? []);
      setGoogleConnected(Boolean(data.google_connected));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load calendar");
    } finally {
      setLoadingBusy(false);
    }
  }, [clientId, timezone]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedStart(null);
    setForm({
      title: "",
      description: "",
      duration: "60",
      provider: account?.preferred_provider ?? "google_meet",
    });
  }, [open, account?.preferred_provider]);

  const calendarEvents = useMemo<EventInput[]>(() => {
    return busy.map((b, i) => ({
      id: `busy-${i}`,
      start: b.start,
      end: b.end,
      title: b.title ?? (b.source === "client_meeting" ? "Client meeting" : "Busy"),
      display: "background",
      classNames: [b.source === "client_meeting" ? "fc-busy-client" : "fc-busy-google"],
      overlap: false,
    }));
  }, [busy]);

  function handleDatesSet(arg: DatesSetArg) {
    void loadAvailability(arg.start, arg.end);
  }

  function handleSelect(arg: DateSelectArg) {
    const start = arg.start;
    const now = new Date();

    if (start < now) {
      setError("Pick a future time slot.");
      arg.view.calendar.unselect();
      return;
    }

    if (slotConflicts(start, durationMinutes, busy)) {
      setError("This time is blocked — choose a free slot on the calendar.");
      arg.view.calendar.unselect();
      return;
    }

    setSelectedStart(start);
    setError(null);
    arg.view.calendar.unselect();
  }

  useEffect(() => {
    if (!selectedStart) return;
    if (slotConflicts(selectedStart, durationMinutes, busy)) {
      setError("Selected time no longer fits — pick another slot.");
      setSelectedStart(null);
    }
  }, [durationMinutes, busy, selectedStart]);

  async function scheduleMeeting() {
    if (!form.title.trim() || !selectedStart) {
      setError("Add a title and pick a time on the calendar.");
      return;
    }

    if (slotConflicts(selectedStart, durationMinutes, busy)) {
      setError("This time overlaps a blocked slot. Pick another time.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const scheduled_at = `${toDateInputValue(selectedStart)}T${toTimeInputValue(selectedStart)}:00`;
      const res = await fetch(`${API}/consultant/clients/${clientId}/meetings`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          scheduled_at,
          timezone,
          duration_minutes: durationMinutes,
          provider: form.provider,
          send_email: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to schedule meeting");
      onOpenChange(false);
      onScheduled();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to schedule");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,860px)] w-[min(96vw,920px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="shrink-0 space-y-3 border-b bg-muted/20 px-5 py-4 pr-12">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <div className="min-w-0 space-y-1 text-left">
              <DialogTitle className="text-lg">Schedule video meeting</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                Drag on a free slot in the calendar, then complete the meeting details.
                {googleConnected
                  ? " Striped areas show Google Calendar busy times and existing client meetings."
                  : " Striped areas show existing meetings with this client."}
              </DialogDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 rounded-md bg-background/80 font-normal">
              <span className="size-2 rounded-sm bg-amber-400" />
              Client meeting
            </Badge>
            {googleConnected && (
              <Badge variant="outline" className="gap-1.5 rounded-md bg-background/80 font-normal">
                <span className="size-2 rounded-sm bg-slate-400" />
                Google Calendar busy
              </Badge>
            )}
            <Badge variant="outline" className="ml-auto rounded-md bg-background/80 font-normal text-muted-foreground">
              {timezone.replace(/_/g, " ")}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Calendar panel */}
          <div className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">Step 1 — Pick a time</p>
              {loadingBusy && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Syncing calendar…
                </span>
              )}
            </div>

            <div className="relative min-h-0 flex-1 px-4 pb-4">
              <div
                className="schedule-meeting-calendar h-full overflow-hidden rounded-xl border bg-card shadow-sm"
                style={{ height: CALENDAR_HEIGHT }}
              >
                <FullCalendar
                  plugins={[timeGridPlugin, interactionPlugin]}
                  initialView="timeGridWeek"
                  headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "timeGridWeek,timeGridDay",
                  }}
                  height={CALENDAR_HEIGHT - 16}
                  allDaySlot={false}
                  slotMinTime="07:00:00"
                  slotMaxTime="21:00:00"
                  slotDuration="00:30:00"
                  nowIndicator
                  selectable
                  selectMirror
                  unselectAuto
                  weekends
                  events={calendarEvents}
                  datesSet={handleDatesSet}
                  select={handleSelect}
                  selectAllow={(selectInfo) => {
                    if (selectInfo.start < new Date()) return false;
                    return !slotConflicts(selectInfo.start, durationMinutes, busy);
                  }}
                  eventOverlap={false}
                  selectOverlap={false}
                  longPressDelay={0}
                  eventLongPressDelay={0}
                />
              </div>
            </div>
          </div>

          {/* Details panel */}
          <div className="flex min-h-0 flex-col bg-muted/10">
            <div className="shrink-0 px-4 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">Step 2 — Meeting details</p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
              <div
                className={cn(
                  "rounded-xl border px-3.5 py-3 transition-colors",
                  selectedStart
                    ? "border-primary/25 bg-primary/5"
                    : "border-dashed border-border/80 bg-background/60",
                )}
              >
                {selectedStart && selectedSlot ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <CheckCircle2 className="size-3.5" />
                      Time selected
                    </div>
                    <p className="text-sm font-semibold leading-snug">{selectedSlot.date}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="size-3.5 shrink-0" />
                      {selectedSlot.time}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground/80">No time selected</p>
                    <p className="text-xs leading-relaxed">
                      Click and drag on the calendar to choose an available slot.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting-title" className="text-xs">Meeting title</Label>
                <Input
                  id="meeting-title"
                  placeholder="e.g. Initial consultation"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Duration</Label>
                  <Select
                    value={form.duration}
                    onValueChange={(v) => setForm({ ...form, duration: v })}
                  >
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Platform</Label>
                  <Select
                    value={form.provider}
                    onValueChange={(v) => setForm({ ...form, provider: v })}
                  >
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {readyProviders.map((p) => (
                        <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting-agenda" className="text-xs">Agenda (optional)</Label>
                <Textarea
                  id="meeting-agenda"
                  placeholder="Notes or topics for the client…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="min-h-[96px] resize-none bg-background"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200/80 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-muted/10 px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="gap-2"
            onClick={scheduleMeeting}
            disabled={sending || !selectedStart || !form.title.trim()}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
