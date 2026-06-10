import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  of1,
  latestRaceSession,
  isSessionLive,
  type OF1Session,
  type OF1Position,
  type OF1Interval,
  type OF1Stint,
  type OF1Pit,
  type OF1Driver,
  type OF1Lap,
} from "@/lib/api";

export type ConnMode = "socket" | "polling" | "disconnected";

export interface RaceSocketState {
  positions: OF1Position[];
  intervals: OF1Interval[];
  stints: OF1Stint[];
  pits: OF1Pit[];
  drivers: OF1Driver[];
  laps: OF1Lap[];
  session: OF1Session | null;
  isConnected: boolean;
  isLive: boolean;
  mode: ConnMode;
  reconnecting: boolean;
  justConnected: boolean;
  loading: boolean;
  error: boolean;
  ts: number;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL as string | undefined;
const POLL_MS = 5000;

/**
 * Real-time race data engine.
 * Uses Socket.io when VITE_SOCKET_URL is configured, with automatic
 * reconnection. Falls back to 5-second OpenF1 polling when the socket
 * is unavailable. Socket and polling never run simultaneously.
 */
export function useRaceSocket(): RaceSocketState {
  const [state, setState] = useState<RaceSocketState>({
    positions: [],
    intervals: [],
    stints: [],
    pits: [],
    drivers: [],
    laps: [],
    session: null,
    isConnected: false,
    isLive: false,
    mode: SOCKET_URL ? "disconnected" : "polling",
    reconnecting: false,
    justConnected: false,
    loading: true,
    error: false,
    ts: Date.now(),
  });

  const sessionRef = useRef<OF1Session | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    const stopPolling = () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };

    const poll = async () => {
      const session = sessionRef.current;
      if (!session) return;
      try {
        const ttl = isSessionLive(session) ? 0 : 5 * 60 * 1000;
        const [pos, drv, intervals, stints, pits, laps] = await Promise.all([
          of1.positions(session.session_key, ttl),
          of1.drivers(session.session_key),
          of1.intervals(session.session_key, ttl),
          of1.stints(session.session_key, ttl),
          of1.pits(session.session_key, ttl),
          of1.laps(session.session_key, ttl),
        ]);
        if (!active) return;
        console.log("[PitWall][poll] refreshed live data", { positions: pos.data.length });
        setState((s) => ({
          ...s,
          positions: pos.data,
          drivers: drv.data,
          intervals: intervals.data,
          stints: stints.data,
          pits: pits.data,
          laps: laps.data,
          loading: false,
          error: false,
          ts: Date.now(),
        }));
      } catch (e) {
        console.warn("[PitWall][poll] failed", e);
        if (active) setState((s) => ({ ...s, loading: false, error: s.positions.length === 0 }));
      }
    };

    const startPolling = () => {
      stopPolling();
      setState((s) => ({ ...s, mode: "polling" }));
      poll();
      pollTimer.current = setInterval(poll, POLL_MS);
    };

    let socket: Socket | null = null;

    const startSocket = (session: OF1Session) => {
      if (!SOCKET_URL) {
        startPolling();
        return;
      }
      socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 3000,
        reconnectionDelayMax: 3000,
        transports: ["websocket"],
      });

      socket.on("connect", () => {
        if (!active) return;
        console.log("[PitWall][socket] connected");
        stopPolling();
        socket?.emit("join_race", { sessionKey: "latest" });
        setState((s) => ({
          ...s,
          isConnected: true,
          mode: "socket",
          reconnecting: false,
          justConnected: true,
          loading: false,
          error: false,
        }));
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => {
          if (active) setState((s) => ({ ...s, justConnected: false }));
        }, 2000);
      });

      socket.on("position_update", (data: OF1Position[]) => {
        console.log("[PitWall][socket] position_update", data);
        if (active) setState((s) => ({ ...s, positions: data, ts: Date.now() }));
      });
      socket.on("interval_update", (data: OF1Interval[]) => {
        if (active) setState((s) => ({ ...s, intervals: data, ts: Date.now() }));
      });
      socket.on("stint_update", (data: OF1Stint[]) => {
        if (active) setState((s) => ({ ...s, stints: data, ts: Date.now() }));
      });
      socket.on("pit_update", (data: OF1Pit[]) => {
        if (active) setState((s) => ({ ...s, pits: data, ts: Date.now() }));
      });
      socket.on("session_status", (data: { live?: boolean }) => {
        if (active) setState((s) => ({ ...s, isLive: !!data?.live }));
      });

      socket.on("disconnect", () => {
        if (!active) return;
        console.warn("[PitWall][socket] disconnected — reconnecting + polling fallback");
        setState((s) => ({ ...s, isConnected: false, mode: "disconnected", reconnecting: true }));
        startPolling();
      });

      socket.io.on("reconnect_attempt", () => {
        if (active) setState((s) => ({ ...s, reconnecting: true }));
      });
    };

    (async () => {
      try {
        const sessions = await of1.raceSessions(2025);
        if (!active) return;
        const session = latestRaceSession(sessions.data);
        sessionRef.current = session;
        const live = isSessionLive(session);
        setState((s) => ({ ...s, session, isLive: live }));
        if (!session) {
          setState((s) => ({ ...s, loading: false, error: true }));
          return;
        }
        // Always seed an initial snapshot via REST so the UI has data.
        await poll();
        if (SOCKET_URL) startSocket(session);
        else startPolling();
      } catch (e) {
        console.warn("[PitWall][socket] init failed", e);
        if (active) setState((s) => ({ ...s, loading: false, error: true }));
      }
    })();

    return () => {
      active = false;
      stopPolling();
      if (flashTimer.current) clearTimeout(flashTimer.current);
      socket?.disconnect();
    };
  }, []);

  return state;
}
