"use client";

import { useCallback, useEffect, useState } from "react";
import { CLIENT_API, clientAuthHeaders } from "@/lib/client-api";

export function useClientUnreadMessages(enabled = true) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      const res = await fetch(`${CLIENT_API}/client/messages/unread-count`, {
        headers: clientAuthHeaders(false),
      });
      if (!res.ok) return;
      const json = await res.json();
      setCount(json.count ?? 0);
    } catch {
      /* ignore */
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { count, refresh };
}
