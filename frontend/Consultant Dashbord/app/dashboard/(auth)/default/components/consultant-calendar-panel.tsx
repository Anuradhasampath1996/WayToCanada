"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import {
  CalendarDays, ChevronRight, ExternalLink, Loader2, Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import "./consultant-calendar-panel.css";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";
const CALENDAR_HEIGHT = 500;

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  all_day: boolean;
  source: "client_meeting" | "google_calendar" | "retainer_signed";
  client_profile_id: number | null;
  meeting_url: string | null;
  provider: string | null;
};

type RetainerItem = {
  profile_id: number;
  client_name: string;
  status: string;
  agreement_signed_at: string;
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function eventOverlapsDay(event: CalendarEvent, day: Date) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  return start <= endOfLocalDay(day) && end >= startOfLocalDay(day);
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sourceLabel(source: CalendarEvent["source"]) {
  if (source === "client_meeting") return "Client meeting";
  if (source === "google_calendar") return "Google Calendar";
  return "Retainer signed";
}

export function ConsultantCalendarPanel({
  retainerSignings = [],
}: {
  retainerSignings?: RetainerItem[];
}) {
  const router = useRouter();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto";
  const today = useMemo(() => new Date(), []);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const loadEvents = useCallback(async (from: Date, to: Date) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        timezone,
      });
      const res = await fetch(`${API}/consultant/calendar?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to load calendar");

      const apiEvents: CalendarEvent[] = data.events ?? [];
      const retainerEvents: CalendarEvent[] = retainerSignings
        .filter((r) => r.agreement_signed_at)
        .map((r) => {
          const signed = new Date(r.agreement_signed_at);
          const dayStart = startOfLocalDay(signed);
          const dayEnd = endOfLocalDay(signed);
          return {
            id: `retainer-${r.profile_id}-${r.agreement_signed_at}`,
            title: `Retainer signed · ${r.client_name}`,
            start: dayStart.toISOString(),
            end: dayEnd.toISOString(),
            all_day: true,
            source: "retainer_signed" as const,
            client_profile_id: r.profile_id,
            meeting_url: null,
            provider: null,
          };
        });

      setEvents([...apiEvents, ...retainerEvents]);
      setGoogleConnected(Boolean(data.google_connected));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [retainerSignings, timezone]);

  const calendarEvents = useMemo<EventInput[]>(() => {
    return events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.all_day,
      classNames: [
        e.source === "client_meeting"
          ? "fc-event-client-meeting"
          : e.source === "google_calendar"
            ? "fc-event-google"
            : "fc-event-retainer",
      ],
      extendedProps: e,
    }));
  }, [events]);

  const dayEvents = useMemo(() => {
    return events
      .filter((e) => eventOverlapsDay(e, selectedDate))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events, selectedDate]);

  const todayEvents = useMemo(
    () => events.filter((e) => eventOverlapsDay(e, today)),
    [events, today],
  );

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => new Date(e.end).getTime() >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 4);
  }, [events]);

  function handleDatesSet(arg: DatesSetArg) {
    void loadEvents(arg.start, arg.end);
  }

  function handleEventClick(arg: EventClickArg) {
    const event = arg.event.extendedProps as CalendarEvent;
    setSelectedDate(startOfLocalDay(arg.event.start ?? selectedDate));

    if (event.source === "client_meeting" && event.client_profile_id) {
      router.push(`/dashboard/clients/${event.client_profile_id}/workspace`);
      return;
    }
    if (event.source === "retainer_signed" && event.client_profile_id) {
      router.push(`/dashboard/clients/${event.client_profile_id}/workspace`);
      return;
    }
    if (event.meeting_url) {
      window.open(event.meeting_url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-background via-background to-primary/[0.04] shadow-md">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border/60 bg-card/50 px-5 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Your schedule</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Google Calendar, client meetings, and retainer milestones — synced in one place.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-lg px-2.5 py-1 font-normal">
            {todayEvents.length} today
          </Badge>
          <Badge variant="outline" className="rounded-lg px-2.5 py-1 font-normal">
            {events.length} this month
          </Badge>
          {!googleConnected ? (
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link href="/dashboard/account#meetings">Connect Google</Link>
            </Button>
          ) : (
            <Badge className="rounded-lg bg-emerald-600/90 font-normal hover:bg-emerald-600">
              Google synced
            </Badge>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 border-b border-border/50 bg-muted/20 px-5 py-2.5">
        <Badge variant="outline" className="gap-1.5 rounded-md border-primary/20 bg-background/80 font-normal">
          <span className="size-2 rounded-full bg-primary" />
          Client meetings
        </Badge>
        <Badge variant="outline" className="gap-1.5 rounded-md bg-background/80 font-normal">
          <span className="size-2 rounded-full bg-slate-500" />
          Google Calendar
        </Badge>
        <Badge variant="outline" className="gap-1.5 rounded-md bg-background/80 font-normal">
          <span className="size-2 rounded-full bg-emerald-500" />
          Retainer signed
        </Badge>
      </div>

      {/* Body */}
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative border-b p-4 lg:border-b-0 lg:border-r">
          {loading && (
            <div className="absolute right-6 top-6 z-10 inline-flex items-center gap-1.5 rounded-full border bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              <Loader2 className="size-3.5 animate-spin" />
              Syncing…
            </div>
          )}
          <div className="consultant-dashboard-calendar overflow-hidden rounded-xl border bg-card p-3 shadow-sm">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek",
              }}
              height={CALENDAR_HEIGHT}
              events={calendarEvents}
              datesSet={handleDatesSet}
              dateClick={(info) => setSelectedDate(startOfLocalDay(info.date))}
              eventClick={handleEventClick}
              dayCellClassNames={(arg) =>
                isSameLocalDay(arg.date, selectedDate) ? ["fc-day-selected"] : []
              }
              nowIndicator
              dayMaxEvents={3}
              moreLinkClick="popover"
            />
          </div>
        </div>

        {/* Agenda sidebar */}
        <div className="flex min-h-0 flex-col bg-muted/10">
          <div className="border-b px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Selected day
            </p>
            <p className="mt-1 text-base font-semibold">
              {selectedDate.toLocaleDateString("en-CA", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {dayEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-background/60 px-4 py-6 text-center">
                <p className="text-sm font-medium text-foreground/80">No events this day</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click another date on the calendar or switch to week view.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {dayEvents.map((event) => (
                  <AgendaItem key={event.id} event={event} />
                ))}
              </ul>
            )}

            {upcomingEvents.length > 0 && (
              <div className="space-y-2.5 border-t pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Coming up
                </p>
                <ul className="space-y-2">
                  {upcomingEvents.map((event) => (
                    <li key={`up-${event.id}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedDate(startOfLocalDay(new Date(event.start)))}
                        className="flex w-full items-center gap-2 rounded-lg border bg-background/80 px-3 py-2 text-left text-sm transition-colors hover:border-primary/25 hover:bg-primary/5"
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            event.source === "client_meeting" && "bg-primary",
                            event.source === "google_calendar" && "bg-slate-500",
                            event.source === "retainer_signed" && "bg-emerald-500",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{event.title}</span>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AgendaItem({ event }: { event: CalendarEvent }) {
  return (
    <li>
      <div
        className={cn(
          "rounded-xl border px-3.5 py-3 text-sm shadow-sm",
          event.source === "client_meeting" && "border-primary/25 bg-primary/[0.06]",
          event.source === "google_calendar" && "border-slate-300/40 bg-slate-500/[0.06]",
          event.source === "retainer_signed" && "border-emerald-300/40 bg-emerald-500/[0.06]",
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              event.source === "client_meeting" && "bg-primary",
              event.source === "google_calendar" && "bg-slate-500",
              event.source === "retainer_signed" && "bg-emerald-500",
            )}
          />
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {sourceLabel(event.source)}
          </span>
        </div>
        <p className="mt-1.5 font-semibold leading-snug">{event.title}</p>
        {!event.all_day && (
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(event.start).toLocaleTimeString("en-CA", {
              hour: "numeric",
              minute: "2-digit",
            })}
            {" – "}
            {new Date(event.end).toLocaleTimeString("en-CA", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {event.client_profile_id && (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link href={`/dashboard/clients/${event.client_profile_id}/workspace`}>
                Workspace
              </Link>
            </Button>
          )}
          {event.meeting_url && (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <a href={event.meeting_url} target="_blank" rel="noreferrer">
                <Video className="mr-1 size-3" />
                Join
                <ExternalLink className="ml-1 size-3 opacity-60" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
