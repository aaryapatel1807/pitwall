import { useEffect, useState } from "react";
import { of1, latestRaceSession, isSessionLive } from "@/lib/api";

/** Polls OpenF1 every 60s to detect whether a race session is currently live. */
export function useLiveSession(pollMs = 60000) {
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const { data } = await of1.raceSessions(2025);
        if (!active) return;
        setLive(isSessionLive(latestRaceSession(data)));
      } catch {
        if (active) setLive(false);
      }
    };
    check();
    const id = setInterval(check, pollMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return live;
}
