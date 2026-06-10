import axios from "axios";
import { cacheGet, cacheSet } from "../middleware/cache";

// Using the CORS-enabled Jolpica mirror of the Ergast API
const BASE = "https://api.jolpi.ca/ergast/f1";
const DEFAULT_TTL = 300; // 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

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
  points: string;
  grid: string;
  status: string;
  Driver: ErgastDriver;
  Constructor: ErgastConstructor;
  Time?: { time: string };
  FastestLap?: { Time?: { time: string }; rank?: string; lap?: string };
}

export interface ErgastQualifyingResult {
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
    Location?: { locality?: string; country?: string };
  };
  date: string;
  time?: string;
  Results?: ErgastResult[];
  QualifyingResults?: ErgastQualifyingResult[];
}

export interface ErgastDriverStanding {
  position: string;
  points: string;
  wins: string;
  Driver: ErgastDriver;
  Constructors: ErgastConstructor[];
}

export interface ErgastConstructorStanding {
  position: string;
  points: string;
  wins: string;
  Constructor: ErgastConstructor;
}

interface ErgastEnvelope {
  MRData: {
    RaceTable?: { Races: ErgastRace[] };
    DriverTable?: { Drivers: ErgastDriver[] };
    StandingsTable?: {
      StandingsLists: Array<{
        season: string;
        round: string;
        DriverStandings?: ErgastDriverStanding[];
        ConstructorStandings?: ErgastConstructorStanding[];
      }>;
    };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchErgast<T extends ErgastEnvelope>(
  path: string,
  ttl: number = DEFAULT_TTL,
): Promise<T> {
  const url = `${BASE}${path}`;
  const cacheKey = `ergast:${url}`;

  const hit = cacheGet<T>(cacheKey);
  if (hit !== undefined) {
    console.log("[ergast] cache hit:", url);
    return hit;
  }

  const res = await axios.get<T>(url, { timeout: 10_000 });
  cacheSet(cacheKey, res.data, ttl);
  return res.data;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export const ergast = {
  /** All drivers for a season. */
  drivers: async (year = 2025) => {
    const data = await fetchErgast<ErgastEnvelope>(`/${year}/drivers.json`);
    return data.MRData.DriverTable?.Drivers ?? [];
  },

  /** Drivers for a specific round. */
  driversByRound: async (year: number, round: number) => {
    const data = await fetchErgast<ErgastEnvelope>(`/${year}/${round}/drivers.json`);
    return data.MRData.DriverTable?.Drivers ?? [];
  },

  /** Race results for a specific year + round. */
  raceResults: async (year: number, round: number) => {
    const data = await fetchErgast<ErgastEnvelope>(`/${year}/${round}/results.json`);
    return data.MRData.RaceTable?.Races ?? [];
  },

  /** All race results for a driver in a season. */
  driverResults: async (driverId: string, year = 2025) => {
    const data = await fetchErgast<ErgastEnvelope>(
      `/${year}/drivers/${driverId}/results.json`,
    );
    return data.MRData.RaceTable?.Races ?? [];
  },

  /** Qualifying results for a driver in a season. */
  driverQualifying: async (driverId: string, year = 2025) => {
    const data = await fetchErgast<ErgastEnvelope>(
      `/${year}/drivers/${driverId}/qualifying.json`,
    );
    return data.MRData.RaceTable?.Races ?? [];
  },

  /** Lap times for a specific race round. */
  lapTimes: async (year: number, round: number) => {
    const data = await fetchErgast<ErgastEnvelope>(
      `/${year}/${round}/laps.json?limit=2000`,
    );
    return data.MRData.RaceTable?.Races ?? [];
  },

  /** Driver standings for a season (end-of-season or current). */
  driverStandings: async (year = 2025) => {
    const data = await fetchErgast<ErgastEnvelope>(`/${year}/driverStandings.json`);
    return (
      data.MRData.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []
    );
  },

  /** Constructor standings for a season. */
  constructorStandings: async (year = 2025) => {
    const data = await fetchErgast<ErgastEnvelope>(
      `/${year}/constructorStandings.json`,
    );
    return (
      data.MRData.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? []
    );
  },

  /** Full season race schedule. */
  schedule: async (year = 2025) => {
    const data = await fetchErgast<ErgastEnvelope>(`/${year}.json`);
    return data.MRData.RaceTable?.Races ?? [];
  },
};
