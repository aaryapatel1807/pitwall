// ============================================================================
// PitWall data layer — OpenF1 + Ergast API helpers with localStorage TTL cache
// ============================================================================

const OPENF1 = "https://api.openf1.org/v1";
// Ergast-compatible API. ergast.com itself sends no CORS headers (browser-blocked),
// so we use the maintained, CORS-enabled jolpica mirror with the identical schema.
const ERGAST = "https://api.jolpi.ca/ergast/f1";

const TTL_MS = 5 * 60 * 1000; // 5-minute cache

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function cacheKey(url: string) {
  return `pitwall:cache:${url}`;
}

export function readCache<T>(url: string): { data: T; ts: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    return { data: parsed.data, ts: parsed.ts };
  } catch {
    return null;
  }
}

function writeCache<T>(url: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(url), JSON.stringify({ data, ts: Date.now() } satisfies CacheEntry<T>));
  } catch {
    /* quota / disabled — ignore */
  }
}

export interface FetchResult<T> {
  data: T;
  ts: number;
  stale: boolean; // served from cache after a network failure
  cached: boolean; // served from a fresh cache hit
}

/**
 * Fetch JSON with a 5-minute localStorage cache.
 * - Fresh cache hit (< TTL) returns immediately, no network call.
 * - On network failure, falls back to any cached value (marked stale).
 */
export async function cachedFetch<T>(url: string, opts?: { ttl?: number }): Promise<FetchResult<T>> {
  const ttl = opts?.ttl ?? TTL_MS;
  const hit = readCache<T>(url);
  if (hit && Date.now() - hit.ts < ttl) {
    console.log("[PitWall][cache-hit]", url, hit.data);
    return { data: hit.data, ts: hit.ts, stale: false, cached: true };
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = (await res.json()) as T;
    console.log("[PitWall][fetch]", url, data);
    writeCache(url, data);
    return { data, ts: Date.now(), stale: false, cached: false };
  } catch (err) {
    console.warn("[PitWall][fetch-error]", url, err);
    if (hit) {
      return { data: hit.data, ts: hit.ts, stale: true, cached: true };
    }
    throw err;
  }
}

// "UPDATED 2m ago" helper
export function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m === 1) return "1m ago";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h === 1 ? "1h ago" : `${h}h ago`;
}

// ============================================================================
// OpenF1 types + endpoints
// ============================================================================

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

export const of1 = {
  raceSessions: (year = 2025) =>
    cachedFetch<OF1Session[]>(`${OPENF1}/sessions?year=${year}&session_type=Race`),
  meetings: (year = 2025) => cachedFetch<OF1Meeting[]>(`${OPENF1}/meetings?year=${year}`),
  positions: (sessionKey: number | "latest", ttl = 0) =>
    cachedFetch<OF1Position[]>(`${OPENF1}/position?session_key=${sessionKey}`, { ttl }),
  drivers: (sessionKey: number | "latest") =>
    cachedFetch<OF1Driver[]>(`${OPENF1}/drivers?session_key=${sessionKey}`),
  intervals: (sessionKey: number | "latest", ttl = 0) =>
    cachedFetch<OF1Interval[]>(`${OPENF1}/intervals?session_key=${sessionKey}`, { ttl }),
  stints: (sessionKey: number | "latest", ttl = 0) =>
    cachedFetch<OF1Stint[]>(`${OPENF1}/stints?session_key=${sessionKey}`, { ttl }),
  pits: (sessionKey: number | "latest", ttl = 0) =>
    cachedFetch<OF1Pit[]>(`${OPENF1}/pit?session_key=${sessionKey}`, { ttl }),
  laps: (sessionKey: number | "latest", ttl = 0) =>
    cachedFetch<OF1Lap[]>(`${OPENF1}/laps?session_key=${sessionKey}`, { ttl }),
};

/** Returns the latest race session by date_start, or null. */
export function latestRaceSession(sessions: OF1Session[]): OF1Session | null {
  if (!sessions?.length) return null;
  return [...sessions].sort(
    (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime(),
  )[0];
}

/** Is a session active right now (between start and end)? */
export function isSessionLive(s: OF1Session | null): boolean {
  if (!s) return false;
  const now = Date.now();
  return now >= new Date(s.date_start).getTime() && now <= new Date(s.date_end).getTime();
}

/** Next upcoming meeting (date_start in the future). */
export function nextMeeting(meetings: OF1Meeting[]): OF1Meeting | null {
  const now = Date.now();
  const upcoming = (meetings ?? [])
    .filter((m) => new Date(m.date_start).getTime() > now)
    .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
  return upcoming[0] ?? null;
}

// ============================================================================
// Ergast types + endpoints
// ============================================================================

export interface ErgastDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  givenName: string;
  familyName: string;
  nationality: string;
}

export interface ErgastResult {
  number: string;
  position: string;
  points: string;
  grid: string;
  status: string;
  Driver: ErgastDriver;
  Constructor: { constructorId: string; name: string };
  Time?: { time: string };
  FastestLap?: { Time?: { time: string }; rank?: string };
}

export interface ErgastRace {
  round: string;
  raceName: string;
  Circuit: { circuitId: string; circuitName: string };
  date: string;
  Results?: ErgastResult[];
  QualifyingResults?: Array<{
    position: string;
    Driver: ErgastDriver;
    Q1?: string;
    Q2?: string;
    Q3?: string;
  }>;
}

export interface ErgastConstructorStanding {
  position: string;
  points: string;
  wins: string;
  Constructor: { constructorId: string; name: string; nationality?: string };
}

export interface ErgastRaceFull extends ErgastRace {
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location?: { locality?: string; country?: string };
  };
  time?: string;
}

interface ErgastEnvelope {
  MRData: {
    RaceTable?: { Races: ErgastRace[] };
    DriverTable?: { Drivers: ErgastDriver[] };
    StandingsTable?: {
      StandingsLists: Array<{
        round: string;
        ConstructorStandings?: ErgastConstructorStanding[];
      }>;
    };
  };
}

export const ergast = {
  drivers: async (year = 2025) => {
    const r = await cachedFetch<ErgastEnvelope>(`${ERGAST}/${year}/drivers.json`);
    return { ...r, list: r.data.MRData.DriverTable?.Drivers ?? [] };
  },
  driversByRound: async (year: number, round: number) => {
    const r = await cachedFetch<ErgastEnvelope>(`${ERGAST}/${year}/${round}/drivers.json`);
    return { ...r, list: r.data.MRData.DriverTable?.Drivers ?? [] };
  },
  results: async (driverId: string, year = 2025) => {
    const r = await cachedFetch<ErgastEnvelope>(`${ERGAST}/${year}/drivers/${driverId}/results.json`);
    return { ...r, races: r.data.MRData.RaceTable?.Races ?? [] };
  },
  qualifying: async (driverId: string, year = 2025) => {
    const r = await cachedFetch<ErgastEnvelope>(
      `${ERGAST}/${year}/drivers/${driverId}/qualifying.json`,
    );
    return { ...r, races: r.data.MRData.RaceTable?.Races ?? [] };
  },
  constructorStandings: async (year = 2025) => {
    const r = await cachedFetch<ErgastEnvelope>(`${ERGAST}/${year}/constructorStandings.json`);
    return {
      ...r,
      list: r.data.MRData.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [],
    };
  },
  constructorStandingsByRound: async (year: number, round: number) => {
    const r = await cachedFetch<ErgastEnvelope>(
      `${ERGAST}/${year}/${round}/constructorStandings.json`,
    );
    return {
      ...r,
      list: r.data.MRData.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [],
    };
  },
  schedule: async (year = 2025) => {
    const r = await cachedFetch<ErgastEnvelope>(`${ERGAST}/${year}.json`);
    return { ...r, races: (r.data.MRData.RaceTable?.Races ?? []) as ErgastRaceFull[] };
  },
};

// Aggregate season stats from a driver's race results
export function seasonStats(races: ErgastRace[]) {
  let wins = 0,
    podiums = 0,
    poles = 0,
    points = 0;
  const progression: { round: number; points: number }[] = [];
  let cumulative = 0;
  for (const race of races) {
    const res = race.Results?.[0];
    if (!res) continue;
    const pos = parseInt(res.position, 10);
    const grid = parseInt(res.grid, 10);
    const pts = parseFloat(res.points) || 0;
    if (pos === 1) wins++;
    if (pos <= 3) podiums++;
    if (grid === 1) poles++;
    points += pts;
    cumulative += pts;
    progression.push({ round: parseInt(race.round, 10), points: cumulative });
  }
  return { wins, podiums, poles, points, progression };
}
