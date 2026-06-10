export type Compound = "Soft" | "Medium" | "Hard" | "Inter" | "Wet";

export const teamColors: Record<string, string> = {
  "Red Bull": "#3671C6",
  Ferrari: "#E8002D",
  McLaren: "#FF8000",
  Mercedes: "#27F4D2",
  "Aston Martin": "#229971",
  Alpine: "#FF87BC",
  Williams: "#64C4FF",
  Haas: "#B6BABD",
  Sauber: "#52E252",
  RB: "#6692FF",
};

// Resolve a team color from any Ergast/OpenF1 constructor name variant.
export function teamColorFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("red bull")) return teamColors["Red Bull"];
  if (n.includes("ferrari")) return teamColors.Ferrari;
  if (n.includes("mclaren")) return teamColors.McLaren;
  if (n.includes("mercedes")) return teamColors.Mercedes;
  if (n.includes("aston")) return teamColors["Aston Martin"];
  if (n.includes("alpine")) return teamColors.Alpine;
  if (n.includes("williams")) return teamColors.Williams;
  if (n.includes("haas")) return teamColors.Haas;
  if (n.includes("sauber") || n.includes("kick")) return teamColors.Sauber;
  if (n.includes("rb") || n.includes("racing bull") || n.includes("alphatauri")) return teamColors.RB;
  return "#999999";
}

export const compoundColor: Record<Compound, { bg: string; text: string; border?: string }> = {
  Soft: { bg: "#FF1E00", text: "#FFFFFF" },
  Medium: { bg: "#FFD700", text: "#15151E" },
  Hard: { bg: "#FFFFFF", text: "#15151E", border: "#333333" },
  Inter: { bg: "#39B54A", text: "#FFFFFF" },
  Wet: { bg: "#0067FF", text: "#FFFFFF" },
};

export interface DriverRow {
  pos: number;
  code: string;
  first: string;
  last: string;
  team: string;
  gap: string;
  lastLap: string;
  tyre: Compound;
  pits: number;
  change: number; // + gained, - lost, 0 none
  flag: string;
}

export const leaderboard: DriverRow[] = [
  { pos: 1, code: "VER", first: "Max", last: "Verstappen", team: "Red Bull", gap: "LEADER", lastLap: "1:14.238", tyre: "Medium", pits: 2, change: 0, flag: "🇳🇱" },
  { pos: 2, code: "NOR", first: "Lando", last: "Norris", team: "McLaren", gap: "+2.341", lastLap: "1:14.102", tyre: "Soft", pits: 2, change: 1, flag: "🇬🇧" },
  { pos: 3, code: "LEC", first: "Charles", last: "Leclerc", team: "Ferrari", gap: "+5.123", lastLap: "1:14.560", tyre: "Medium", pits: 2, change: 0, flag: "🇲🇨" },
  { pos: 4, code: "HAM", first: "Lewis", last: "Hamilton", team: "Mercedes", gap: "+8.456", lastLap: "1:14.781", tyre: "Hard", pits: 1, change: 0, flag: "🇬🇧" },
  { pos: 5, code: "SAI", first: "Carlos", last: "Sainz", team: "Ferrari", gap: "+11.234", lastLap: "1:14.690", tyre: "Medium", pits: 2, change: -1, flag: "🇪🇸" },
  { pos: 6, code: "RUS", first: "George", last: "Russell", team: "Mercedes", gap: "+14.567", lastLap: "1:14.920", tyre: "Hard", pits: 1, change: 0, flag: "🇬🇧" },
  { pos: 7, code: "PIA", first: "Oscar", last: "Piastri", team: "McLaren", gap: "+18.901", lastLap: "1:14.345", tyre: "Soft", pits: 3, change: 2, flag: "🇦🇺" },
  { pos: 8, code: "ALO", first: "Fernando", last: "Alonso", team: "Aston Martin", gap: "+22.345", lastLap: "1:15.102", tyre: "Medium", pits: 2, change: 0, flag: "🇪🇸" },
  { pos: 9, code: "GAS", first: "Pierre", last: "Gasly", team: "Alpine", gap: "+25.678", lastLap: "1:15.340", tyre: "Hard", pits: 1, change: 1, flag: "🇫🇷" },
  { pos: 10, code: "STR", first: "Lance", last: "Stroll", team: "Aston Martin", gap: "+28.991", lastLap: "1:15.420", tyre: "Medium", pits: 2, change: -1, flag: "🇨🇦" },
  { pos: 11, code: "ALB", first: "Alex", last: "Albon", team: "Williams", gap: "+31.204", lastLap: "1:15.560", tyre: "Hard", pits: 1, change: 0, flag: "🇹🇭" },
  { pos: 12, code: "OCO", first: "Esteban", last: "Ocon", team: "Alpine", gap: "+34.512", lastLap: "1:15.610", tyre: "Soft", pits: 2, change: 2, flag: "🇫🇷" },
  { pos: 13, code: "TSU", first: "Yuki", last: "Tsunoda", team: "RB", gap: "+37.889", lastLap: "1:15.700", tyre: "Medium", pits: 2, change: 0, flag: "🇯🇵" },
  { pos: 14, code: "HUL", first: "Nico", last: "Hülkenberg", team: "Haas", gap: "+41.023", lastLap: "1:15.880", tyre: "Hard", pits: 1, change: -1, flag: "🇩🇪" },
  { pos: 15, code: "RIC", first: "Daniel", last: "Ricciardo", team: "RB", gap: "+44.567", lastLap: "1:15.920", tyre: "Medium", pits: 2, change: 0, flag: "🇦🇺" },
  { pos: 16, code: "BOT", first: "Valtteri", last: "Bottas", team: "Sauber", gap: "+48.110", lastLap: "1:16.010", tyre: "Soft", pits: 2, change: 1, flag: "🇫🇮" },
  { pos: 17, code: "MAG", first: "Kevin", last: "Magnussen", team: "Haas", gap: "+51.334", lastLap: "1:16.200", tyre: "Hard", pits: 1, change: 0, flag: "🇩🇰" },
  { pos: 18, code: "ZHO", first: "Guanyu", last: "Zhou", team: "Sauber", gap: "+54.789", lastLap: "1:16.250", tyre: "Medium", pits: 2, change: -1, flag: "🇨🇳" },
  { pos: 19, code: "SAR", first: "Logan", last: "Sargeant", team: "Williams", gap: "+58.012", lastLap: "1:16.440", tyre: "Hard", pits: 1, change: 0, flag: "🇺🇸" },
  { pos: 20, code: "PER", first: "Sergio", last: "Pérez", team: "Red Bull", gap: "+1 LAP", lastLap: "1:16.560", tyre: "Soft", pits: 3, change: -2, flag: "🇲🇽" },
];

export interface DriverProfile {
  code: string;
  number: number;
  first: string;
  last: string;
  team: string;
  flag: string;
  country: string;
  wins: number;
  podiums: number;
  poles: number;
  points: number;
  avgQuali: string;
  avgRace: string;
  dnfRate: number;
  podiumPct: number;
}

export const drivers: DriverProfile[] = [
  { code: "VER", number: 1, first: "Max", last: "Verstappen", team: "Red Bull", flag: "🇳🇱", country: "Netherlands", wins: 4, podiums: 6, poles: 3, points: 169, avgQuali: "1:10.234", avgRace: "1:14.123", dnfRate: 5, podiumPct: 72 },
  { code: "NOR", number: 4, first: "Lando", last: "Norris", team: "McLaren", flag: "🇬🇧", country: "United Kingdom", wins: 2, podiums: 5, poles: 2, points: 145, avgQuali: "1:10.891", avgRace: "1:14.456", dnfRate: 8, podiumPct: 61 },
  { code: "LEC", number: 16, first: "Charles", last: "Leclerc", team: "Ferrari", flag: "🇲🇨", country: "Monaco", wins: 2, podiums: 5, poles: 4, points: 138, avgQuali: "1:10.456", avgRace: "1:14.301", dnfRate: 6, podiumPct: 58 },
  { code: "HAM", number: 44, first: "Lewis", last: "Hamilton", team: "Mercedes", flag: "🇬🇧", country: "United Kingdom", wins: 1, podiums: 3, poles: 1, points: 109, avgQuali: "1:11.012", avgRace: "1:14.610", dnfRate: 4, podiumPct: 40 },
  { code: "SAI", number: 55, first: "Carlos", last: "Sainz", team: "Ferrari", flag: "🇪🇸", country: "Spain", wins: 1, podiums: 4, poles: 1, points: 116, avgQuali: "1:10.720", avgRace: "1:14.420", dnfRate: 7, podiumPct: 50 },
  { code: "PIA", number: 81, first: "Oscar", last: "Piastri", team: "McLaren", flag: "🇦🇺", country: "Australia", wins: 1, podiums: 3, poles: 1, points: 99, avgQuali: "1:10.980", avgRace: "1:14.520", dnfRate: 9, podiumPct: 38 },
];

export interface RaceResult {
  circuit: string;
  country: string;
  flag: string;
  round: number;
  date: string;
  p1: string;
  p2: string;
  p3: string;
}

export const recentRaces: RaceResult[] = [
  { circuit: "Miami Grand Prix", country: "USA", flag: "🇺🇸", round: 7, date: "May 04 2025", p1: "L. Norris", p2: "M. Verstappen", p3: "C. Leclerc" },
  { circuit: "Chinese Grand Prix", country: "China", flag: "🇨🇳", round: 6, date: "Apr 20 2025", p1: "M. Verstappen", p2: "L. Norris", p3: "S. Pérez" },
  { circuit: "Japanese Grand Prix", country: "Japan", flag: "🇯🇵", round: 5, date: "Apr 06 2025", p1: "M. Verstappen", p2: "S. Pérez", p3: "C. Sainz" },
];

export interface ConstructorRow {
  pos: number;
  team: string;
  car: string;
  points: number;
  wins: number;
  podiums: number;
  trend: number[];
  dnfs: number;
  avgPit: number;
}

export const constructors: ConstructorRow[] = [
  { pos: 1, team: "McLaren", car: "MCL39", points: 279, wins: 3, podiums: 8, trend: [180, 205, 228, 250, 279], dnfs: 1, avgPit: 2.34 },
  { pos: 2, team: "Ferrari", car: "SF-25", points: 256, wins: 3, podiums: 9, trend: [190, 210, 225, 242, 256], dnfs: 3, avgPit: 2.51 },
  { pos: 3, team: "Red Bull", car: "RB21", points: 234, wins: 4, podiums: 7, trend: [200, 215, 222, 228, 234], dnfs: 2, avgPit: 2.42 },
  { pos: 4, team: "Mercedes", car: "W16", points: 198, wins: 1, podiums: 4, trend: [120, 145, 168, 185, 198], dnfs: 2, avgPit: 2.48 },
  { pos: 5, team: "Aston Martin", car: "AMR25", points: 87, wins: 0, podiums: 1, trend: [40, 55, 66, 78, 87], dnfs: 4, avgPit: 2.66 },
  { pos: 6, team: "Williams", car: "FW47", points: 54, wins: 0, podiums: 0, trend: [20, 30, 38, 47, 54], dnfs: 3, avgPit: 2.71 },
  { pos: 7, team: "Alpine", car: "A525", points: 41, wins: 0, podiums: 0, trend: [10, 18, 26, 34, 41], dnfs: 5, avgPit: 2.74 },
  { pos: 8, team: "RB", car: "VCARB02", points: 36, wins: 0, podiums: 0, trend: [12, 19, 25, 31, 36], dnfs: 2, avgPit: 2.69 },
  { pos: 9, team: "Haas", car: "VF-25", points: 27, wins: 0, podiums: 0, trend: [6, 12, 18, 23, 27], dnfs: 4, avgPit: 2.83 },
  { pos: 10, team: "Sauber", car: "C45", points: 12, wins: 0, podiums: 0, trend: [2, 4, 7, 10, 12], dnfs: 6, avgPit: 2.91 },
];

// chart data
export const rounds = [1, 2, 3, 4, 5, 6, 7, 8];

// lap position chart for top 5 across 47 laps (sampled)
export const lapPositions = Array.from({ length: 48 }, (_, lap) => ({
  lap,
  VER: 1 + (lap > 20 && lap < 24 ? 1 : 0),
  NOR: 3 - (lap > 30 ? 1 : 0),
  LEC: 2 + (lap > 30 ? 1 : 0),
  HAM: 4,
  SAI: 5 + (lap > 35 ? 0 : 0),
}));

export const pitLaps = [14, 28, 31, 36];

// cumulative points progression per top driver
export const driverPointsProgression = rounds.map((r) => ({
  round: r,
  VER: Math.round((169 / 8) * r),
  NOR: Math.round((145 / 8) * r),
}));

// quali vs race pace per round (seconds)
export const paceData = rounds.map((r) => ({
  round: r,
  VER_quali: 70.2 + Math.sin(r) * 0.3,
  VER_race: 74.1 + Math.sin(r) * 0.3,
  NOR_quali: 70.9 + Math.cos(r) * 0.3,
  NOR_race: 74.5 + Math.cos(r) * 0.3,
}));

// constructor points progression top 5
export const teamPointsProgression = rounds.map((r, i) => ({
  round: r,
  McLaren: constructors[0].trend[Math.min(i, 4)] ?? Math.round((279 / 8) * r),
  Ferrari: Math.round((256 / 8) * r),
  "Red Bull": Math.round((234 / 8) * r),
  Mercedes: Math.round((198 / 8) * r),
  "Aston Martin": Math.round((87 / 8) * r),
}));

// tire degradation per lap for a 3-stint strategy
export function buildDegradation() {
  const stints = [
    { compound: "Soft" as Compound, from: 1, to: 18, base: 73.5, deg: 0.07 },
    { compound: "Medium" as Compound, from: 19, to: 45, base: 74.2, deg: 0.04 },
    { compound: "Soft" as Compound, from: 46, to: 57, base: 73.8, deg: 0.08 },
  ];
  const data: { lap: number; lapTime: number; compound: Compound }[] = [];
  for (const s of stints) {
    for (let lap = s.from; lap <= s.to; lap++) {
      data.push({ lap, lapTime: +(s.base + (lap - s.from) * s.deg).toFixed(3), compound: s.compound });
    }
  }
  return data;
}
