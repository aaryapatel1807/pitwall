/**
 * PitWall — Central live-data API module
 *
 * Every fetch goes through here. All functions:
 *   1. Check localStorage cache (key + timestamp)
 *   2. Return cached data if fresh
 *   3. Fetch fresh on stale/miss, update cache
 *   4. On error: return stale cache if exists, else return null (never throw)
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Base URLs ────────────────────────────────────────────────────────────────

const ERGAST = "https://api.jolpi.ca/ergast/f1";
const OPENF1 = "https://api.openf1.org/v1";

// ─── TTL constants (ms) ───────────────────────────────────────────────────────

export const TTL = {
  LIVE:         30_000,       // 30 s
  RACE_RESULT:  3_600_000,    // 1 h
  STANDINGS:    3_600_000,    // 1 h
  CALENDAR:     21_600_000,   // 6 h
  DRIVER_META:  86_400_000,   // 24 h
} as const;

// ─── Cache helpers ────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttl: number;
}

export function getCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`pitwall:live:${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.fetchedAt < entry.ttl) return entry.data;
    return null; // stale — caller will re-fetch
  } catch {
    return null;
  }
}

function getStale<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`pitwall:live:${key}`);
    if (!raw) return null;
    return (JSON.parse(raw) as CacheEntry<T>).data;
  } catch {
    return null;
  }
}

function getCacheAge(key: string): number {
  if (typeof window === "undefined") return Infinity;
  try {
    const raw = localStorage.getItem(`pitwall:live:${key}`);
    if (!raw) return Infinity;
    return Date.now() - (JSON.parse(raw) as CacheEntry<unknown>).fetchedAt;
  } catch {
    return Infinity;
  }
}

export function setCache<T>(key: string, data: T, ttl: number): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = { data, fetchedAt: Date.now(), ttl };
    localStorage.setItem(`pitwall:live:${key}`, JSON.stringify(entry));
  } catch {
    // quota exceeded — ignore
  }
}

// Safe JSON fetch — never throws
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    console.warn("[api-live] fetch failed:", url, e);
    return null;
  }
}

// Cache-first fetch utility
async function cachedFetch<T>(key: string, url: string, ttl: number): Promise<T | null> {
  const hit = getCache<T>(key);
  if (hit !== null) return hit;
  const data = await fetchJson<T>(url);
  if (data !== null) { setCache(key, data, ttl); return data; }
  return getStale<T>(key); // fall back to stale on network error
}

// ─── Race weekend detection ───────────────────────────────────────────────────

export function isRaceWeekend(): boolean {
  try {
    const stale = getStale<ErgastScheduleEnvelope>(`season:2026`);
    const races = stale?.MRData?.RaceTable?.Races ?? [];
    const now = Date.now();
    return races.some((r) => {
      const raceTs = new Date(`${r.date}T${r.time ?? "13:00:00Z"}`).getTime();
      const fridayTs = raceTs - 2 * 86_400_000;
      return now >= fridayTs && now <= raceTs + 4 * 3_600_000;
    });
  } catch {
    return false;
  }
}

// Dynamic TTL — shorten during race weekends
export function effectiveTtl(base: number): number {
  if (isRaceWeekend() && base >= TTL.STANDINGS) return Math.min(base, 5 * 60_000);
  return base;
}

// ─── Ergast envelope types ────────────────────────────────────────────────────

export interface ErgastDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  givenName: string;
  familyName: string;
  nationality: string;
  dateOfBirth?: string;
}

export interface ErgastConstructor {
  constructorId: string;
  name: string;
  nationality?: string;
}

export interface ErgastResult {
  number: string;
  position: string;
  positionText: string;
  points: string;
  grid: string;
  laps: string;
  status: string;
  Driver: ErgastDriver;
  Constructor: ErgastConstructor;
  Time?: { millis?: string; time: string };
  FastestLap?: { rank?: string; lap?: string; Time?: { time: string }; AverageSpeed?: { units: string; speed: string } };
}

export interface ErgastQualResult {
  position: string;
  Driver: ErgastDriver;
  Constructor: ErgastConstructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

export interface ErgastRace {
  season: string;
  round: string;
  raceName: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location?: { lat?: string; long?: string; locality?: string; country?: string };
  };
  date: string;
  time?: string;
  Results?: ErgastResult[];
  QualifyingResults?: ErgastQualResult[];
  PitStops?: ErgastPitStop[];
}

export interface ErgastPitStop {
  driverId: string;
  lap: string;
  stop: string;
  time: string;
  duration: string;
}

export interface ErgastDriverStanding {
  position: string;
  positionText?: string;
  points: string;
  wins: string;
  Driver: ErgastDriver;
  Constructors: ErgastConstructor[];
}

export interface ErgastConstructorStanding {
  position: string;
  positionText?: string;
  points: string;
  wins: string;
  Constructor: ErgastConstructor;
}

interface ErgastScheduleEnvelope {
  MRData: { RaceTable?: { season?: string; Races: ErgastRace[] } };
}
interface ErgastResultsEnvelope {
  MRData: { RaceTable?: { Races: ErgastRace[] }; total?: string };
}
interface ErgastDriverStandingsEnvelope {
  MRData: { StandingsTable?: { StandingsLists: Array<{ DriverStandings: ErgastDriverStanding[] }> } };
}
interface ErgastConstructorStandingsEnvelope {
  MRData: { StandingsTable?: { StandingsLists: Array<{ ConstructorStandings: ErgastConstructorStanding[] }> } };
}
interface ErgastDriversEnvelope {
  MRData: { DriverTable?: { Drivers: ErgastDriver[] } };
}
interface ErgastPitStopsEnvelope {
  MRData: { RaceTable?: { Races: ErgastRace[] } };
}

// ─── OpenF1 types ─────────────────────────────────────────────────────────────

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

// ─── Calendar ─────────────────────────────────────────────────────────────────

export async function getSeason(year = 2026): Promise<ErgastRace[]> {
  const key = `season:${year}`;
  const data = await cachedFetch<ErgastScheduleEnvelope>(key, `${ERGAST}/${year}.json`, TTL.CALENDAR);
  return data?.MRData?.RaceTable?.Races ?? [];
}

// ─── Standings ────────────────────────────────────────────────────────────────

export async function getDriverStandings(year = 2026): Promise<ErgastDriverStanding[]> {
  const key = `driver-standings:${year}`;
  const ttl = effectiveTtl(TTL.STANDINGS);
  const data = await cachedFetch<ErgastDriverStandingsEnvelope>(
    key, `${ERGAST}/${year}/driverStandings.json`, ttl,
  );
  return data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
}

export async function getConstructorStandings(year = 2026): Promise<ErgastConstructorStanding[]> {
  const key = `constructor-standings:${year}`;
  const ttl = effectiveTtl(TTL.STANDINGS);
  const data = await cachedFetch<ErgastConstructorStandingsEnvelope>(
    key, `${ERGAST}/${year}/constructorStandings.json`, ttl,
  );
  return data?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
}

// ─── Race results ─────────────────────────────────────────────────────────────

export async function getLastNRaceResults(year = 2026, n = 3): Promise<ErgastRace[]> {
  const key = `last-${n}-results:${year}`;
  // Ergast returns results in chronological order; we need the most recent
  // completed rounds. Fetch all and slice from the end.
  const data = await cachedFetch<ErgastResultsEnvelope>(
    key, `${ERGAST}/${year}/results.json?limit=100`, TTL.RACE_RESULT,
  );
  const all = data?.MRData?.RaceTable?.Races ?? [];
  const completed = all.filter((r) => (r.Results?.length ?? 0) > 0);
  return completed.slice(-n);
}

export async function getRaceResult(year: number, round: number): Promise<ErgastRace | null> {
  const key = `race-result:${year}:${round}`;
  const data = await cachedFetch<ErgastResultsEnvelope>(
    key, `${ERGAST}/${year}/${round}/results.json`, TTL.RACE_RESULT,
  );
  return data?.MRData?.RaceTable?.Races?.[0] ?? null;
}

export async function getQualifyingResult(year: number, round: number): Promise<ErgastRace | null> {
  const key = `quali-result:${year}:${round}`;
  const data = await cachedFetch<ErgastResultsEnvelope>(
    key, `${ERGAST}/${year}/${round}/qualifying.json`, TTL.RACE_RESULT,
  );
  return data?.MRData?.RaceTable?.Races?.[0] ?? null;
}

// ─── Drivers ──────────────────────────────────────────────────────────────────

export async function getDrivers(year = 2026): Promise<ErgastDriver[]> {
  const key = `drivers:${year}`;
  const data = await cachedFetch<ErgastDriversEnvelope>(
    key, `${ERGAST}/${year}/drivers.json`, TTL.DRIVER_META,
  );
  return data?.MRData?.DriverTable?.Drivers ?? [];
}

export async function getDriverResults(year: number, driverId: string): Promise<ErgastRace[]> {
  const key = `driver-results:${year}:${driverId}`;
  const data = await cachedFetch<ErgastResultsEnvelope>(
    key, `${ERGAST}/${year}/drivers/${driverId}/results.json`, TTL.RACE_RESULT,
  );
  return data?.MRData?.RaceTable?.Races ?? [];
}

export interface DriverSeasonStats {
  wins: number;
  podiums: number;
  poles: number;
  points: number;
  dnfs: number;
  races: number;
  podiumPct: number;
  dnfRate: number;
  progression: { round: number; points: number }[];
  paceByRound: { round: number; race: number | null; quali: number | null }[];
}

export async function getDriverSeasonStats(year: number, driverId: string): Promise<DriverSeasonStats> {
  const [resultsRaces, qualiRaces] = await Promise.all([
    getDriverResults(year, driverId),
    (async () => {
      const key = `driver-quali:${year}:${driverId}`;
      const data = await cachedFetch<ErgastResultsEnvelope>(
        key, `${ERGAST}/${year}/drivers/${driverId}/qualifying.json`, TTL.RACE_RESULT,
      );
      return data?.MRData?.RaceTable?.Races ?? [];
    })(),
  ]);

  let wins = 0, podiums = 0, poles = 0, points = 0, dnfs = 0;
  let cumulative = 0;
  const progression: { round: number; points: number }[] = [];
  const lapToSec = (t?: string) => {
    if (!t) return null;
    const p = t.split(":");
    if (p.length === 2) return parseInt(p[0], 10) * 60 + parseFloat(p[1]);
    return parseFloat(t) || null;
  };
  const paceMap = new Map<number, { race: number | null }>();

  for (const race of resultsRaces) {
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
    const fl = lapToSec(res.FastestLap?.Time?.time);
    const rnd = parseInt(race.round, 10);
    paceMap.set(rnd, { race: fl });
    const isFinished = /finish|\+\d/i.test(res.status);
    if (!isFinished) dnfs++;
  }

  const qualiMap = new Map<number, number | null>();
  for (const race of qualiRaces) {
    const q = race.QualifyingResults?.[0];
    const best = lapToSec(q?.Q3) ?? lapToSec(q?.Q2) ?? lapToSec(q?.Q1);
    qualiMap.set(parseInt(race.round, 10), best);
  }

  const allRounds = Array.from(new Set([...paceMap.keys(), ...qualiMap.keys()])).sort((a, b) => a - b);
  const paceByRound = allRounds.map((r) => ({
    round: r,
    race: paceMap.get(r)?.race ?? null,
    quali: qualiMap.get(r) ?? null,
  }));

  const races = resultsRaces.length;
  return {
    wins, podiums, poles, points, dnfs, races,
    podiumPct: races ? Math.round((podiums / races) * 100) : 0,
    dnfRate: races ? Math.round((dnfs / races) * 100) : 0,
    progression,
    paceByRound,
  };
}

// ─── Constructors ─────────────────────────────────────────────────────────────

export async function getConstructorStandingsByRound(
  year: number,
  round: number,
): Promise<ErgastConstructorStanding[]> {
  const key = `constructor-standings:${year}:${round}`;
  const data = await cachedFetch<ErgastConstructorStandingsEnvelope>(
    key, `${ERGAST}/${year}/${round}/constructorStandings.json`, TTL.RACE_RESULT,
  );
  return data?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
}

// ─── Pit stops ────────────────────────────────────────────────────────────────

export async function getPitStops(year: number, round: number): Promise<ErgastPitStop[]> {
  const key = `pitstops:${year}:${round}`;
  const data = await cachedFetch<ErgastPitStopsEnvelope>(
    key, `${ERGAST}/${year}/${round}/pitstops.json?limit=200`, TTL.RACE_RESULT,
  );
  return data?.MRData?.RaceTable?.Races?.[0]?.PitStops ?? [];
}

// ─── Live session (OpenF1) ────────────────────────────────────────────────────

export async function getLiveSessionKey(): Promise<number | null> {
  const key = "live-session-key:2026";
  const data = await cachedFetch<OF1Session[]>(
    key, `${OPENF1}/sessions?year=2026&session_type=Race`, TTL.LIVE,
  );
  if (!data) return null;
  const now = Date.now();
  const live = data.find(
    (s) =>
      now >= new Date(s.date_start).getTime() &&
      now <= new Date(s.date_end).getTime(),
  );
  return live?.session_key ?? null;
}

export async function getLatestRaceSession(): Promise<OF1Session | null> {
  const key = "latest-race-session:2026";
  const data = await cachedFetch<OF1Session[]>(
    key, `${OPENF1}/sessions?year=2026&session_type=Race`, TTL.LIVE,
  );
  if (!data?.length) return null;
  return [...data].sort(
    (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime(),
  )[0];
}

// ─── "Last updated" badge helpers ─────────────────────────────────────────────

export function cacheAgeMs(key: string): number {
  return getCacheAge(key);
}

export function formatCacheAge(ageMs: number): { text: string; color: "gray" | "amber" | "red" } {
  const mins = Math.floor(ageMs / 60_000);
  const hours = Math.floor(ageMs / 3_600_000);
  if (ageMs === Infinity || ageMs > 86_400_000)
    return { text: "Stale data", color: "red" };
  if (ageMs > 7_200_000)
    return { text: `Cached ${hours}h ago`, color: "amber" };
  if (mins < 1) return { text: "Updated just now", color: "gray" };
  if (mins < 60) return { text: `Updated ${mins}m ago`, color: "gray" };
  return { text: `Updated ${hours}h ago`, color: "gray" };
}

// ─── useAutoRefresh hook ──────────────────────────────────────────────────────

export function useAutoRefresh<T>(
  fetchFn: () => Promise<T | null>,
  deps: unknown[],
  intervalMs: number,
): { data: T | null; loading: boolean; error: boolean; lastUpdated: Date | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stable ref so the interval callback always calls the latest fetchFn
  const fnRef = useRef(fetchFn);
  fnRef.current = fetchFn;

  const effectiveInterval = isRaceWeekend() ? Math.min(intervalMs, 5 * 60_000) : intervalMs;

  const run = useCallback(async () => {
    try {
      const result = await fnRef.current();
      if (result !== null) {
        setData(result);
        setError(false);
        setLastUpdated(new Date());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    run();
    timer.current = setInterval(run, effectiveInterval);
    return () => { if (timer.current) clearInterval(timer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, effectiveInterval]);

  return { data, loading, error, lastUpdated };
}

// ─── UpdatedBadge component data ──────────────────────────────────────────────

export function useUpdatedBadge(lastUpdated: Date | null): string {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!lastUpdated) return "";
  const { text } = formatCacheAge(Date.now() - lastUpdated.getTime());
  return text;
}

// ─── Country flag lookup ──────────────────────────────────────────────────────

const FLAGS: Record<string, string> = {
  Bahrain: "🇧🇭", "Saudi Arabia": "🇸🇦", Australia: "🇦🇺", Japan: "🇯🇵", China: "🇨🇳",
  USA: "🇺🇸", "United States": "🇺🇸", Italy: "🇮🇹", Monaco: "🇲🇨", Canada: "🇨🇦",
  Spain: "🇪🇸", Austria: "🇦🇹", UK: "🇬🇧", "United Kingdom": "🇬🇧", Hungary: "🇭🇺",
  Belgium: "🇧🇪", Netherlands: "🇳🇱", Azerbaijan: "🇦🇿", Singapore: "🇸🇬", Mexico: "🇲🇽",
  Brazil: "🇧🇷", Qatar: "🇶🇦", UAE: "🇦🇪", "United Arab Emirates": "🇦🇪", France: "🇫🇷",
  Germany: "🇩🇪", Portugal: "🇵🇹", Turkey: "🇹🇷", Russia: "🇷🇺",
  "Saudi": "🇸🇦", Miami: "🇺🇸", "Abu Dhabi": "🇦🇪",
};

export function flagFor(country?: string): string {
  return (country && FLAGS[country]) || "🏁";
}

// ─── Team color map ───────────────────────────────────────────────────────────
// Keyed by constructorId (Ergast) — lowercase with underscores.

export const TEAM_COLORS: Record<string, string> = {
  red_bull:     "#3671C6",
  ferrari:      "#E8002D",
  mclaren:      "#FF8000",
  mercedes:     "#27F4D2",
  aston_martin: "#229971",
  alpine:       "#FF87BC",
  williams:     "#64C4FF",
  haas:         "#B6BABD",
  kick_sauber:  "#52E252",
  sauber:       "#52E252",
  rb:           "#6692FF",
  alphatauri:   "#6692FF",
};

export function teamColorById(constructorId: string): string {
  const id = constructorId.toLowerCase().replace(/\s+/g, "_");
  return TEAM_COLORS[id] ?? teamColorByName(constructorId);
}

/** Name-based fallback matching (same logic as mock-data.teamColorFor). */
export function teamColorByName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("red bull"))    return TEAM_COLORS.red_bull;
  if (n.includes("ferrari"))     return TEAM_COLORS.ferrari;
  if (n.includes("mclaren"))     return TEAM_COLORS.mclaren;
  if (n.includes("mercedes"))    return TEAM_COLORS.mercedes;
  if (n.includes("aston"))       return TEAM_COLORS.aston_martin;
  if (n.includes("alpine"))      return TEAM_COLORS.alpine;
  if (n.includes("williams"))    return TEAM_COLORS.williams;
  if (n.includes("haas"))        return TEAM_COLORS.haas;
  if (n.includes("sauber") || n.includes("kick")) return TEAM_COLORS.sauber;
  if (n.includes("rb") || n.includes("racing bull") || n.includes("alphatauri"))
    return TEAM_COLORS.rb;
  return "#999999";
}
