import axios from "axios";
import { cacheGet, cacheSet } from "../middleware/cache";

const BASE = "https://api.openf1.org/v1";
const DEFAULT_TTL = 300; // 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OF1Session {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  country_name: string;
  circuit_short_name: string;
  date_start: string;
  date_end: string;
  year: number;
}

export interface OF1Meeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name: string;
  country_name: string;
  circuit_short_name: string;
  date_start: string;
  year: number;
}

export interface OF1Position {
  session_key: number;
  driver_number: number;
  position: number;
  date: string;
}

export interface OF1Driver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  country_code: string;
}

export interface OF1Interval {
  driver_number: number;
  gap_to_leader: number | string | null;
  interval: number | string | null;
  date: string;
}

export interface OF1Stint {
  driver_number: number;
  compound: string;
  stint_number: number;
  lap_start: number;
  lap_end: number;
}

export interface OF1Pit {
  driver_number: number;
  lap_number: number;
  pit_duration?: number | null;
}

export interface OF1Lap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  duration_sector_1?: number | null;
  duration_sector_2?: number | null;
  duration_sector_3?: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchOf1<T>(
  path: string,
  ttl: number = DEFAULT_TTL,
): Promise<T> {
  const url = `${BASE}${path}`;
  const cacheKey = `of1:${url}`;

  const hit = cacheGet<T>(cacheKey);
  if (hit !== undefined) {
    console.log("[openf1] cache hit:", url);
    return hit;
  }

  const res = await axios.get<T>(url, { timeout: 10_000 });
  cacheSet(cacheKey, res.data, ttl);
  return res.data;
}

/** Sleep for `ms` milliseconds — used to rate-limit OpenF1 calls. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Returns the latest race session sorted by date_start, or null. */
export function latestRaceSession(sessions: OF1Session[]): OF1Session | null {
  if (!sessions?.length) return null;
  return [...sessions].sort(
    (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime(),
  )[0];
}

/** Is a session currently live (between start and end)? */
export function isSessionLive(s: OF1Session | null): boolean {
  if (!s) return false;
  const now = Date.now();
  return (
    now >= new Date(s.date_start).getTime() &&
    now <= new Date(s.date_end).getTime()
  );
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export const openf1 = {
  /** Race sessions for a given year. */
  raceSessions: (year = 2025) =>
    fetchOf1<OF1Session[]>(`/sessions?year=${year}&session_type=Race`),

  /** All meetings (race weekends) for a given year. */
  meetings: (year = 2025) =>
    fetchOf1<OF1Meeting[]>(`/meetings?year=${year}`),

  /** Live positions — TTL 0 during active session. */
  positions: (sessionKey: number | "latest", live = false) =>
    fetchOf1<OF1Position[]>(
      `/position?session_key=${sessionKey}`,
      live ? 0 : DEFAULT_TTL,
    ),

  /** Drivers registered for a session. */
  drivers: (sessionKey: number | "latest") =>
    fetchOf1<OF1Driver[]>(`/drivers?session_key=${sessionKey}`),

  /** Gap-to-leader / interval data — TTL 0 during live session. */
  intervals: (sessionKey: number | "latest", live = false) =>
    fetchOf1<OF1Interval[]>(
      `/intervals?session_key=${sessionKey}`,
      live ? 0 : DEFAULT_TTL,
    ),

  /** Tire stint data. */
  stints: (sessionKey: number | "latest", live = false) =>
    fetchOf1<OF1Stint[]>(
      `/stints?session_key=${sessionKey}`,
      live ? 0 : DEFAULT_TTL,
    ),

  /** Pit stop data. */
  pits: (sessionKey: number | "latest", live = false) =>
    fetchOf1<OF1Pit[]>(
      `/pit?session_key=${sessionKey}`,
      live ? 0 : DEFAULT_TTL,
    ),

  /** Lap time data including sector splits. */
  laps: (sessionKey: number | "latest", live = false) =>
    fetchOf1<OF1Lap[]>(
      `/laps?session_key=${sessionKey}`,
      live ? 0 : DEFAULT_TTL,
    ),
};
