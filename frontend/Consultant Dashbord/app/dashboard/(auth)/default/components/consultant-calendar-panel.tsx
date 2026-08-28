"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

import "./consultant-calendar-panel.css";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";
const CALENDAR_HEIGHT_DESKTOP = 680;
const CALENDAR_HEIGHT_MOBILE = 440;

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  all_day: boolean;
  source: "client_meeting" | "google_calendar" | "retainer_signed";
  client_profile_id: number | null;
  client_name?: string | null;
  client_avatar?: string | null;
  description?: string | null;
  duration_minutes?: number | null;
  meeting_url: string | null;
  provider: string | null;
};

type RetainerItem = {
  profile_id: number;
  client_name: string;
  client_avatar?: string | null;
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayTitle(event: CalendarEvent) {
  if (event.source === "client_meeting" && event.client_name) {
    const suffix = ` · ${event.client_name}`;
    if (event.title.endsWith(suffix)) {
      return event.title.slice(0, -suffix.length);
    }
  }
  if (event.source === "retainer_signed" && event.client_name) {
    const suffix = ` · ${event.client_name}`;
    if (event.title.endsWith(suffix)) {
      return "Retainer signed";
    }
  }
  return event.title;
}

function initials(name: string | null | undefined) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function ClientAvatar({
  name,
  src,
  size = "sm",
  tone = "onColor",
}: {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "md";
  tone?: "onColor" | "onLight";
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  const showImage = Boolean(src) && !broken;

  return (
    <span
      className={cn(
        "fc-client-avatar relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-1",
        size === "sm" ? "size-5 text-[8px]" : "size-8 text-[11px]",
        tone === "onColor"
          ? "bg-white/25 text-white ring-white/35"
          : "bg-primary/10 text-primary ring-primary/15",
      )}
      aria-hidden
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src ?? "none"}
          src={src!}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );
}

function CalendarEventChip({ arg }: { arg: EventContentArg }) {
  const event = arg.event.extendedProps as CalendarEvent;
  const title = displayTitle(event);
  const isMonth = arg.view.type === "dayGridMonth";
  const timeLabel = event.all_day ? "All day" : arg.timeText || formatTime(event.start);

  return (
    <div
      className={cn(
        "fc-day-event-chip",
        event.source === "client_meeting" && "is-meeting",
        event.source === "google_calendar" && "is-google",
        event.source === "retainer_signed" && "is-retainer",
      )}
    >
      <ClientAvatar name={event.client_name} src={event.client_avatar} size="sm" tone="onLight" />
      <div className="fc-day-event-chip__body">
        <span className="fc-day-event-chip__time">{timeLabel}</span>
        <span className="fc-day-event-chip__title">{title}</span>
        {isMonth && event.client_name ? (
          <span className="fc-day-event-chip__client">{event.client_name}</span>
        ) : null}
      </div>
    </div>
  );
}

export function ConsultantCalendarPanel({
  retainerSignings = [],
}: {
  retainerSignings?: RetainerItem[];
}) {
  const isMobile = useIsMobile();
  const calendarRef = useRef<FullCalendar>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto";
  const today = useMemo(() => new Date(), []);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [calendarView, setCalendarView] = useState<"dayGridMonth" | "timeGridWeek">("dayGridMonth");

  const headerToolbar = useMemo(
    () =>
      isMobile
        ? { left: "prev,next", center: "title", right: "today" }
        : { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" },
    [isMobile],
  );

  const switchView = (view: "dayGridMonth" | "timeGridWeek") => {
    setCalendarView(view);
    calendarRef.current?.getApi().changeView(view);
  };

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
            client_name: r.client_name,
            client_avatar: r.client_avatar ?? null,
            description: "Client signed the retainer agreement.",
            duration_minutes: null,
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
        "fc-event-stack",
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

  const isSelectedToday = isSameLocalDay(selectedDate, today);

  function handleDatesSet(arg: DatesSetArg) {
    const viewType = arg.view.type;
    if (viewType === "dayGridMonth" || viewType === "timeGridWeek") {
      setCalendarView(viewType);
    }
    void loadEvents(arg.start, arg.end);
  }

  function handleEventClick(arg: EventClickArg) {
    arg.jsEvent.preventDefault();
    setSelectedDate(startOfLocalDay(arg.event.start ?? selectedDate));
  }

  return (
    <section className="consultant-calendar-shell overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      <div className="consultant-calendar-header relative border-b border-border/50 px-4 py-4 sm:px-5 sm:py-5">
        <div className="relative z-[1] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm sm:size-11">
              <CalendarDays className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight sm:text-xl">Your Schedule</h2>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Pick a date to see meetings, Google events, and retainer milestones.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Badge variant="secondary" className="rounded-lg px-2.5 py-1 font-normal">
              {todayEvents.length} today
            </Badge>
            <Badge variant="outline" className="rounded-lg bg-background/70 px-2.5 py-1 font-normal">
              {events.length} in view
            </Badge>
            {!googleConnected ? (
              <Button asChild size="sm" variant="outline" className="h-8 bg-background/80">
                <Link href="/dashboard/account#meetings">Connect Google</Link>
              </Button>
            ) : (
              <Badge className="rounded-lg bg-emerald-600/90 font-normal hover:bg-emerald-600">
                Google synced
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border/40 bg-muted/15 px-4 py-2 sm:gap-2 sm:px-5 sm:py-2.5">
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

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative border-b p-3 sm:p-4 lg:border-b-0 lg:border-r lg:border-border/50">
          {loading && (
            <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border bg-background/95 px-2.5 py-1 text-xs text-muted-foreground shadow-sm sm:right-6 sm:top-6 sm:px-3">
              <Loader2 className="size-3.5 animate-spin" />
              Syncing…
            </div>
          )}
          <div className="consultant-dashboard-calendar overflow-hidden rounded-xl border border-border/60 bg-background/80 p-2 shadow-sm sm:p-3">
            {isMobile && (
              <div className="mb-2 flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={calendarView === "dayGridMonth" ? "default" : "outline"}
                  className="h-8 flex-1 rounded-lg text-xs"
                  onClick={() => switchView("dayGridMonth")}
                >
                  Month
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={calendarView === "timeGridWeek" ? "default" : "outline"}
                  className="h-8 flex-1 rounded-lg text-xs"
                  onClick={() => switchView("timeGridWeek")}
                >
                  Week
                </Button>
              </div>
            )}
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={headerToolbar}
              titleFormat={
                isMobile
                  ? { month: "short", year: "numeric" }
                  : { month: "long", year: "numeric" }
              }
              dayHeaderFormat={isMobile ? { weekday: "narrow" } : { weekday: "short" }}
              height={isMobile ? CALENDAR_HEIGHT_MOBILE : CALENDAR_HEIGHT_DESKTOP}
              events={calendarEvents}
              eventContent={(arg) => <CalendarEventChip arg={arg} />}
              datesSet={handleDatesSet}
              dateClick={(info) => setSelectedDate(startOfLocalDay(info.date))}
              eventClick={handleEventClick}
              dayCellClassNames={(arg) =>
                isSameLocalDay(arg.date, selectedDate) ? ["fc-day-selected"] : []
              }
              nowIndicator
              dayMaxEvents={isMobile ? 2 : 3}
              moreLinkClick="popover"
              eventDisplay="block"
            />
          </div>
        </div>

        <aside className="consultant-day-panel flex min-h-0 flex-col">
          <div className="border-b border-border/50 px-4 py-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isSelectedToday ? "Today" : "Selected day"}
                </p>
                <p className="mt-1 text-lg font-semibold leading-tight tracking-tight">
                  {selectedDate.toLocaleDateString("en-CA", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 px-2.5 py-1.5 text-center shadow-sm">
                <p className="text-lg font-bold leading-none tabular-nums">{dayEvents.length}</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {dayEvents.length === 1 ? "event" : "events"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {dayEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 px-4 py-8 text-center">
                <Sparkles className="mx-auto size-5 text-muted-foreground/70" />
                <p className="mt-3 text-sm font-medium text-foreground/85">No events this day</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click another date on the calendar to inspect its schedule.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {dayEvents.map((event) => (
                  <AgendaItem key={event.id} event={event} />
                ))}
              </ul>
            )}

            {upcomingEvents.length > 0 && (
              <div className="space-y-2.5 border-t border-border/50 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Coming up
                </p>
                <ul className="space-y-2">
                  {upcomingEvents.map((event) => (
                    <li key={`up-${event.id}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedDate(startOfLocalDay(new Date(event.start)))}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
                      >
                        <ClientAvatar
                          name={event.client_name}
                          src={event.client_avatar}
                          size="sm"
                          tone="onLight"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{displayTitle(event)}</span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {new Date(event.start).toLocaleDateString("en-CA", {
                              month: "short",
                              day: "numeric",
                            })}
                            {!event.all_day && ` · ${formatTime(event.start)}`}
                            {event.client_name ? ` · ${event.client_name}` : ""}
                          </span>
                        </span>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function AgendaItem({ event }: { event: CalendarEvent }) {
  const title = displayTitle(event);
  const timeLabel = event.all_day
    ? "All day"
    : `${formatTime(event.start)} – ${formatTime(event.end)}`;
  const startDate = new Date(event.start);
  const hour24 = startDate.getHours();
  const hour12 = hour24 % 12 || 12;
  const minutes = String(startDate.getMinutes()).padStart(2, "0");
  const meridiem = hour24 >= 12 ? "PM" : "AM";

  return (
    <li>
      <article
        className={cn(
          "consultant-day-card overflow-hidden rounded-2xl border shadow-sm",
          event.source === "client_meeting" && "border-primary/20 bg-primary/[0.04]",
          event.source === "google_calendar" && "border-slate-300/50 bg-slate-500/[0.05]",
          event.source === "retainer_signed" && "border-emerald-300/45 bg-emerald-500/[0.05]",
        )}
      >
        <div className="flex gap-0">
          <div
            className={cn(
              "flex w-[4.5rem] shrink-0 flex-col items-center justify-center border-r px-2 py-3 text-center",
              event.source === "client_meeting" && "border-primary/15 bg-primary/[0.07]",
              event.source === "google_calendar" && "border-slate-300/40 bg-slate-500/[0.08]",
              event.source === "retainer_signed" && "border-emerald-300/40 bg-emerald-500/[0.08]",
            )}
          >
            {event.all_day ? (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                All day
              </span>
            ) : (
              <>
                <span className="text-sm font-bold tabular-nums leading-none">
                  {hour12}:{minutes}
                </span>
                <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {meridiem}
                </span>
              </>
            )}
          </div>

          <div className="min-w-0 flex-1 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  event.source === "client_meeting" && "bg-primary/15 text-primary",
                  event.source === "google_calendar" && "bg-slate-500/15 text-slate-700 dark:text-slate-300",
                  event.source === "retainer_signed" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                )}
              >
                {sourceLabel(event.source)}
              </span>
              {event.duration_minutes ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="size-3" />
                  {event.duration_minutes} min
                </span>
              ) : null}
            </div>

            <div className="mt-2 flex items-start gap-2.5">
              <ClientAvatar name={event.client_name} src={event.client_avatar} size="md" tone="onLight" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold leading-snug tracking-tight">{title}</h3>
                {event.client_name ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserRound className="size-3.5 shrink-0" />
                    <span className="truncate">{event.client_name}</span>
                  </p>
                ) : null}
              </div>
            </div>

            {!event.all_day && (
              <p className="mt-2 text-xs text-muted-foreground">{timeLabel}</p>
            )}

            {event.description ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground/90">
                {event.description}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {event.client_profile_id && (
                <Button asChild size="sm" variant="outline" className="h-7 rounded-lg text-xs">
                  <Link href={`/dashboard/clients/${event.client_profile_id}/workspace`}>
                    Workspace
                  </Link>
                </Button>
              )}
              {event.meeting_url && (
                <Button asChild size="sm" className="h-7 rounded-lg text-xs">
                  <a href={event.meeting_url} target="_blank" rel="noreferrer">
                    <Video className="mr-1 size-3" />
                    Join
                    <ExternalLink className="ml-1 size-3 opacity-70" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}
