"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Video, Loader2, Calendar, Clock, ExternalLink, AlertCircle, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type MeetingData = {
  title: string;
  description: string | null;
  scheduled_display: string;
  duration_minutes: number;
  provider: string;
  provider_label: string;
  meeting_url: string | null;
  status: string;
  google_calendar_url: string | null;
  consultant: { name: string; company_name: string | null };
  client_name: string | null;
};

const PROVIDER_STYLE: Record<string, string> = {
  google_meet: "from-green-600 to-emerald-700",
  zoom: "from-blue-600 to-blue-800",
  teams: "from-violet-600 to-indigo-700",
};

export function MeetTokenClient({ token }: { token: string }) {
  const [data, setData] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`${API}/meeting/${token}`);
    if (!res.ok) {
      setError("Meeting not found or link has expired.");
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading meeting…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <p className="font-medium">{error ?? "Meeting not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cancelled = data.status === "cancelled";
  const gradient = PROVIDER_STYLE[data.provider] ?? "from-slate-700 to-slate-900";

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-50 via-background to-blue-50/30 dark:from-slate-950 dark:to-background">
      <Card className="w-full max-w-lg shadow-xl border-0 overflow-hidden">
        <div className={cn("bg-gradient-to-r px-6 py-8 text-white", gradient)}>
          <div className="flex items-center gap-2 mb-3">
            <Video className="h-5 w-5 opacity-90" />
            <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
              {data.provider_label}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold leading-tight">{data.title}</h1>
          <p className="text-sm text-white/80 mt-2">
            with {data.consultant.company_name || data.consultant.name}
          </p>
        </div>

        <CardContent className="p-6 md:p-8 space-y-6">
          {cancelled ? (
            <div className="text-center py-4 text-muted-foreground">
              <XCircle className="h-10 w-10 mx-auto mb-2 text-red-400" />
              <p className="font-medium">This meeting has been cancelled.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4">
                  <Calendar className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date & time</p>
                    <p className="font-semibold mt-0.5">{data.scheduled_display}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4">
                  <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</p>
                    <p className="font-semibold mt-0.5">{data.duration_minutes} minutes</p>
                  </div>
                </div>
              </div>

              {data.description && (
                <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-emerald-500/40 pl-4">
                  {data.description}
                </p>
              )}

              <div className="space-y-3 pt-2">
                {data.meeting_url && (
                  <Button className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700" asChild>
                    <a href={data.meeting_url} target="_blank" rel="noreferrer">
                      <Video className="h-4 w-4 mr-2" />
                      Join {data.provider_label} meeting
                      <ExternalLink className="h-4 w-4 ml-2 opacity-70" />
                    </a>
                  </Button>
                )}
                {data.google_calendar_url && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={data.google_calendar_url} target="_blank" rel="noreferrer">
                      <Calendar className="h-4 w-4 mr-2" />
                      Add to Google Calendar
                    </a>
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Secure invitation from your immigration consultant
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
