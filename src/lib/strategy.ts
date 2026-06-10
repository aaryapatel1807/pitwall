import type { Compound } from "@/lib/mock-data";

export interface SimStint {
  compound: "SOFT" | "MEDIUM" | "HARD" | "INTER" | "WET";
  lapStart: number;
  lapEnd: number;
}

export interface SimRequest {
  year: number;
  round: number;
  driverId: string;
  stints: SimStint[];
}

export interface SimResponse {
  predictedPosition: number;
  totalRaceTime: string;
  timeDeltaVsActual: string;
  lapTimes: number[];
  degradationCurve: { lap: number; time: number; compound: string }[];
  actualStrategy: { compound: string; lapStart: number; lapEnd: number }[];
  actualPosition: number;
  demo?: boolean;
}

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

const BASE: Record<SimStint["compound"], { start: number; deg: number }> = {
  SOFT: { start: 74.2, deg: 0.08 },
  MEDIUM: { start: 74.8, deg: 0.05 },
  HARD: { start: 75.4, deg: 0.03 },
  INTER: { start: 78.5, deg: 0.06 },
  WET: { start: 82.0, deg: 0.05 },
};

const PIT_COST = 22;

export function compoundLabel(c: string): Compound {
  switch (c.toUpperCase()) {
    case "SOFT":
      return "Soft";
    case "MEDIUM":
      return "Medium";
    case "HARD":
      return "Hard";
    case "INTER":
    case "INTERMEDIATE":
      return "Inter";
    case "WET":
      return "Wet";
    default:
      return "Medium";
  }
}

function totalToString(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

/** Deterministic client-side simulation used when FastAPI is unavailable. */
export function runMockSim(req: SimRequest): SimResponse {
  const lapTimes: number[] = [];
  const degradationCurve: { lap: number; time: number; compound: string }[] = [];
  let total = 0;

  req.stints.forEach((st, i) => {
    if (i > 0) total += PIT_COST;
    const cfg = BASE[st.compound] ?? BASE.MEDIUM;
    for (let lap = st.lapStart; lap <= st.lapEnd; lap++) {
      const t = +(cfg.start + (lap - st.lapStart) * cfg.deg).toFixed(3);
      lapTimes.push(t);
      degradationCurve.push({ lap, time: t, compound: st.compound });
      total += t;
    }
  });

  const totalLaps = lapTimes.length;
  // "Actual" reference: a clean 2-stop on mediums/hards.
  const actualStrategy = [
    { compound: "MEDIUM", lapStart: 1, lapEnd: Math.round(totalLaps * 0.45) },
    { compound: "HARD", lapStart: Math.round(totalLaps * 0.45) + 1, lapEnd: totalLaps },
  ];
  let actualTotal = PIT_COST;
  actualStrategy.forEach((st, i) => {
    if (i > 0) actualTotal += 0;
    const cfg = BASE[st.compound as SimStint["compound"]];
    for (let lap = st.lapStart; lap <= st.lapEnd; lap++) {
      actualTotal += cfg.start + (lap - st.lapStart) * cfg.deg;
    }
  });

  const delta = total - actualTotal;
  const predictedPosition = Math.max(1, Math.min(20, Math.round(3 + delta / 8)));

  return {
    predictedPosition,
    totalRaceTime: totalToString(total),
    timeDeltaVsActual: `${delta >= 0 ? "+" : "-"}${Math.abs(delta).toFixed(3)}`,
    lapTimes,
    degradationCurve,
    actualStrategy,
    actualPosition: 3,
    demo: true,
  };
}

/** Call FastAPI; fall back to mock simulation on any failure. */
export async function simulateStrategy(req: SimRequest): Promise<SimResponse> {
  if (!API_URL) return runMockSim(req);
  try {
    const res = await fetch(`${API_URL}/api/strategy/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as SimResponse;
    console.log("[PitWall][strategy] FastAPI response", data);
    return { ...data, demo: false };
  } catch (e) {
    console.warn("[PitWall][strategy] FastAPI unreachable — using mock", e);
    return runMockSim(req);
  }
}
