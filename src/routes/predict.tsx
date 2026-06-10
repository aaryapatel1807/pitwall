import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/clerk-react";

import { SectionLabel } from "@/components/Shared";
import { teamColorByName, getDrivers, getSeason, type ErgastDriver } from "@/lib/api-live";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/predict")({
  head: () => ({
    meta: [
      { title: "Predict — PitWall" },
      { name: "description", content: "Submit your F1 podium prediction and compete on the global leaderboard." },
      { property: "og:title", content: "Predict — PitWall" },
    ],
  }),
  component: PredictPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_ROUND = 12;
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

// Fallback 2026 driver list used when API is unavailable
const FALLBACK_DRIVERS = [
  { id: "max_verstappen",    name: "Max Verstappen",    team: "Red Bull Racing" },
  { id: "lando_norris",      name: "Lando Norris",      team: "McLaren" },
  { id: "charles_leclerc",   name: "Charles Leclerc",   team: "Ferrari" },
  { id: "lewis_hamilton",    name: "Lewis Hamilton",    team: "Mercedes" },
  { id: "carlos_sainz",      name: "Carlos Sainz",      team: "Ferrari" },
  { id: "george_russell",    name: "George Russell",    team: "Mercedes" },
  { id: "oscar_piastri",     name: "Oscar Piastri",     team: "McLaren" },
  { id: "fernando_alonso",   name: "Fernando Alonso",   team: "Aston Martin" },
  { id: "pierre_gasly",      name: "Pierre Gasly",      team: "Alpine" },
  { id: "lance_stroll",      name: "Lance Stroll",      team: "Aston Martin" },
  { id: "alex_albon",        name: "Alex Albon",        team: "Williams" },
  { id: "yuki_tsunoda",      name: "Yuki Tsunoda",      team: "RB" },
  { id: "nico_hulkenberg",   name: "Nico Hülkenberg",   team: "Haas" },
  { id: "kevin_magnussen",   name: "Kevin Magnussen",   team: "Haas" },
  { id: "valtteri_bottas",   name: "Valtteri Bottas",   team: "Kick Sauber" },
  { id: "guanyu_zhou",       name: "Guanyu Zhou",       team: "Kick Sauber" },
  { id: "esteban_ocon",      name: "Esteban Ocon",      team: "Alpine" },
  { id: "logan_sargeant",    name: "Logan Sargeant",    team: "Williams" },
  { id: "daniel_ricciardo",  name: "Daniel Ricciardo",  team: "RB" },
  { id: "sergio_perez",      name: "Sergio Pérez",      team: "Red Bull Racing" },
];

// Mock leaderboard — 10 realistic F1 fan usernames
const MOCK_LEADERBOARD = [
  { rank: 1,  username: "undercut_king",    points: 147, streak: 4, lastRace: "+7" },
  { rank: 2,  username: "DRS_Hunter99",     points: 139, streak: 2, lastRace: "+4" },
  { rank: 3,  username: "PirelliBoss",      points: 131, streak: 3, lastRace: "+6" },
  { rank: 4,  username: "VerstappenFan1",   points: 128, streak: 1, lastRace: "+3" },
  { rank: 5,  username: "SafetyCarSam",     points: 119, streak: 0, lastRace: "+1" },
  { rank: 6,  username: "tifosi_forever",   name: "You", points: 112, streak: 2, lastRace: "+4", isMe: true },
  { rank: 7,  username: "McLaren_Mafia",    points: 108, streak: 1, lastRace: "+3" },
  { rank: 8,  username: "PitLanePhil",      points:  99, streak: 0, lastRace: "+0" },
  { rank: 9,  username: "SectorThree",      points:  88, streak: 0, lastRace: "+1" },
  { rank: 10, username: "FlatOutFelix",     points:  74, streak: 0, lastRace: "+0" },
] as const;

// Last-5 prediction history for the current user
const MOCK_HISTORY = [
  { round: 11, prediction: ["Norris", "Verstappen", "Leclerc"],   actual: ["Norris", "Verstappen", "Leclerc"],   points: 9, accuracy: "exact" as const },
  { round: 10, prediction: ["Verstappen", "Norris", "Russell"],   actual: ["Norris", "Verstappen", "Russell"],   points: 7, accuracy: "partial" as const },
  { round:  9, prediction: ["Leclerc", "Sainz", "Russell"],       actual: ["Hamilton", "Russell", "Piastri"],    points: 1, accuracy: "partial" as const },
  { round:  8, prediction: ["Verstappen", "Norris", "Leclerc"],   actual: ["Verstappen", "Hamilton", "Norris"],  points: 4, accuracy: "partial" as const },
  { round:  7, prediction: ["Norris", "Piastri", "Verstappen"],   actual: ["Sainz", "Alonso", "Leclerc"],        points: 0, accuracy: "miss" as const },
];

const ACCURACY_STYLE = {
  exact:   { bg: "bg-[#39B54A]/10", border: "border-[#39B54A]/30", dot: "#39B54A",  label: "Perfect" },
  partial: { bg: "bg-[#FFB020]/10", border: "border-[#FFB020]/30", dot: "#FFB020",  label: "Partial" },
  miss:    { bg: "bg-[#E8002D]/10", border: "border-[#E8002D]/30", dot: "#E8002D",  label: "Miss" },
};

const POINTS_RULES = [
  { icon: "✅", text: "Exact position",              pts: "3 pts" },
  { icon: "✅", text: "Right driver, wrong position", pts: "1 pt" },
  { icon: "❌", text: "Wrong driver",                  pts: "0 pts" },
];

// ─── Prediction storage ───────────────────────────────────────────────────────

function predictionKey(userId: string) {
  return `pitwall:prediction:${userId}:round:${CURRENT_ROUND}`;
}

interface Prediction { p1: string; p2: string; p3: string }

function loadPrediction(userId: string): Prediction | null {
  try {
    const raw = localStorage.getItem(predictionKey(userId));
    return raw ? (JSON.parse(raw) as Prediction) : null;
  } catch { return null; }
}

function savePrediction(userId: string, pred: Prediction) {
  localStorage.setItem(predictionKey(userId), JSON.stringify(pred));
}

// ─── Driver selector ─────────────────────────────────────────────────────────

interface Driver { id: string; name: string; team: string }

function DriverSelect({
  position,
  value,
  drivers,
  onChange,
  excluded,
}: {
  position: "P1" | "P2" | "P3";
  value: string;
  drivers: Driver[];
  onChange: (v: string) => void;
  excluded: string[];
}) {
  const available = drivers.filter((d) => !excluded.includes(d.id) || d.id === value);
  const selected = drivers.find((d) => d.id === value);

  return (
    <div className="rounded-xl border border-white/10 bg-[#1E1E2E] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="grid h-6 w-6 place-items-center rounded-full text-xs font-extrabold"
          style={{
            backgroundColor:
              position === "P1" ? "#FFD700" : position === "P2" ? "#C0C0C0" : "#CD7F32",
            color: "#15151E",
          }}
        >
          {position[1]}
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-[#A0A0B0]">
          {position}
        </span>
      </div>

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="border-white/10 bg-[#15151E] text-white hover:border-[#E8002D]/50">
          <SelectValue placeholder="Select driver…">
            {selected && (
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: teamColorByName(selected.team) }}
                />
                <span className="font-semibold">{selected.name}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="border-white/10 bg-[#1E1E2E]">
          {available.map((d) => (
            <SelectItem key={d.id} value={d.id} className="text-white focus:bg-white/10">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: teamColorByName(d.team) }}
                />
                <span className="font-medium">{d.name}</span>
                <span className="text-[10px] text-[#A0A0B0]">{d.team}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function PredictPage() {
  const { user } = useUser();
  const userId = user?.id ?? "guest";

  const [drivers, setDrivers] = useState<Driver[]>(FALLBACK_DRIVERS);
  const [p1, setP1] = useState(FALLBACK_DRIVERS[0].id);
  const [p2, setP2] = useState(FALLBACK_DRIVERS[1].id);
  const [p3, setP3] = useState(FALLBACK_DRIVERS[2].id);
  const [locked, setLocked] = useState(false);
  const [nextRaceName, setNextRaceName] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState(CURRENT_ROUND);

  // Load saved prediction + real driver list + next race name
  useEffect(() => {
    const saved = loadPrediction(userId);
    if (saved) { setP1(saved.p1); setP2(saved.p2); setP3(saved.p3); setLocked(true); }

    // Real driver list from api-live
    getDrivers(2026).then((list) => {
      if (list.length > 0) {
        setDrivers(list.map((d: ErgastDriver) => ({
          id: d.driverId,
          name: `${d.givenName} ${d.familyName}`,
          team: "", // team not in driver endpoint — color fallback is fine
        })));
        // Reset selections to first real drivers if not already locked
        if (!saved) {
          setP1(list[0]?.driverId ?? FALLBACK_DRIVERS[0].id);
          setP2(list[1]?.driverId ?? FALLBACK_DRIVERS[1].id);
          setP3(list[2]?.driverId ?? FALLBACK_DRIVERS[2].id);
        }
      }
    }).catch(() => {/* keep fallback */});

    // Real next race name from calendar
    getSeason(2026).then((races) => {
      const now = Date.now();
      const next = races
        .filter((r) => new Date(`${r.date}T${r.time ?? "13:00:00Z"}`).getTime() > now)
        .sort((a, b) => +a.round - +b.round)[0];
      if (next) {
        setNextRaceName(next.raceName);
        setCurrentRound(parseInt(next.round, 10));
      }
    }).catch(() => {/* keep fallback */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleLock = useCallback(() => {
    savePrediction(userId, { p1, p2, p3 });
    setLocked(true);
  }, [userId, p1, p2, p3]);

  const handleEdit = () => setLocked(false);

  return (
    <main>
      {/* Header strip */}
      <div className="bg-[#15151E]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
          <h1 className="flex items-center gap-2 text-xl font-extrabold uppercase tracking-tight text-white md:text-2xl">
            <Trophy size={22} className="text-[#E8002D]" />
            Race Prediction Contest
          </h1>
          <p className="mt-1 text-sm text-[#A0A0B0]">
            Submit before lights out · {nextRaceName ?? `Round ${currentRound}`}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 lg:grid-cols-[1fr_1.2fr] lg:px-6">
        {/* ── Left: submission panel ──────────────────────────────────────── */}
        <div className="space-y-5">
          <div>
            <SectionLabel>Round {currentRound}</SectionLabel>
            <h2 className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-[#15151E]">
              Your Podium Prediction
            </h2>
          </div>

          <AnimatePresence mode="wait">
            {locked ? (
              <motion.div
                key="locked"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border border-[#39B54A]/30 bg-[#39B54A]/5 p-6 text-center"
              >
                <CheckCircle2 size={40} className="mx-auto text-[#39B54A]" />
                <h3 className="mt-3 text-lg font-extrabold uppercase tracking-tight text-[#15151E]">
                  Prediction Locked ✓
                </h3>
                <p className="mt-1 text-sm text-[#6B6B6B]">Round {currentRound} prediction saved</p>

                <div className="mt-4 space-y-2">
                  {[{ pos: "P1", id: p1 }, { pos: "P2", id: p2 }, { pos: "P3", id: p3 }].map(
                    ({ pos, id }) => {
                      const d = drivers.find((dr) => dr.id === id);
                      return (
                        <div
                          key={pos}
                          className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5"
                        >
                          <span className="text-xs font-bold uppercase text-[#6B6B6B]">{pos}</span>
                          <span className="flex items-center gap-2 text-sm font-bold text-[#15151E]">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: teamColorByName(d?.team ?? "") }}
                            />
                            {d?.name ?? id}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>

                <button
                  onClick={handleEdit}
                  className="mt-5 text-xs font-bold uppercase tracking-wide text-[#E8002D] hover:text-[#CC0027]"
                >
                  Edit prediction
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <DriverSelect
                  position="P1"
                  value={p1}
                  drivers={drivers}
                  onChange={setP1}
                  excluded={[p2, p3]}
                />
                <DriverSelect
                  position="P2"
                  value={p2}
                  drivers={drivers}
                  onChange={setP2}
                  excluded={[p1, p3]}
                />
                <DriverSelect
                  position="P3"
                  value={p3}
                  drivers={drivers}
                  onChange={setP3}
                  excluded={[p1, p2]}
                />

                <button
                  onClick={handleLock}
                  className="mt-2 w-full rounded-md bg-[#E8002D] py-3 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#CC0027]"
                >
                  Lock In Prediction
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Points rules */}
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
            <SectionLabel>Scoring System</SectionLabel>
            <div className="mt-3 space-y-2">
              {POINTS_RULES.map((r) => (
                <div key={r.text} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-[#15151E]">
                    <span>{r.icon}</span>
                    {r.text}
                  </span>
                  <span className="tabular text-sm font-bold text-[#15151E]">{r.pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: leaderboard ──────────────────────────────────────────── */}
        <div className="space-y-5">
          <div>
            <SectionLabel>Global</SectionLabel>
            <h2 className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-[#15151E]">
              Prediction Leaderboard
            </h2>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
            {/* Table header */}
            <div className="grid grid-cols-[2rem_1fr_4rem_4rem_4.5rem] gap-2 bg-[#15151E] px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#A0A0B0]">
              <span>RNK</span>
              <span>USER</span>
              <span className="text-center">PTS</span>
              <span className="text-center">STREAK</span>
              <span className="text-center">LAST</span>
            </div>

            {MOCK_LEADERBOARD.map((row) => (
              <div
                key={row.username}
                className={`grid grid-cols-[2rem_1fr_4rem_4rem_4.5rem] items-center gap-2 border-b border-[#E5E5E5] px-4 py-3 last:border-0 ${
                  "isMe" in row && row.isMe ? "border-l-4 border-l-[#E8002D] bg-[#E8002D]/4" : ""
                }`}
              >
                <span className="tabular text-sm font-bold text-[#15151E]">
                  {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#15151E]">
                    {"isMe" in row && row.isMe ? (
                      <span className="flex items-center gap-1">
                        {row.username}
                        <span className="rounded bg-[#E8002D] px-1 py-px text-[9px] font-bold uppercase text-white">
                          You
                        </span>
                      </span>
                    ) : (
                      row.username
                    )}
                  </p>
                </div>
                <span className="tabular text-center text-sm font-bold text-[#15151E]">
                  {row.points}
                </span>
                <span className="text-center text-sm text-[#6B6B6B]">
                  {row.streak > 0 ? `🔥 ${row.streak}` : "—"}
                </span>
                <span
                  className={`text-center text-xs font-bold tabular ${
                    row.lastRace.startsWith("+") && row.lastRace !== "+0"
                      ? "text-[#39B54A]"
                      : "text-[#6B6B6B]"
                  }`}
                >
                  {row.lastRace}
                </span>
              </div>
            ))}
          </div>

          {/* Past predictions */}
          <div>
            <SectionLabel>Your History</SectionLabel>
            <h3 className="mt-1 mb-3 text-lg font-extrabold uppercase tracking-tight text-[#15151E]">
              Last 5 Predictions
            </h3>
            <div className="space-y-2.5">
              {MOCK_HISTORY.map((h) => {
                const s = ACCURACY_STYLE[h.accuracy];
                return (
                  <div
                    key={h.round}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${s.bg} ${s.border}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.dot }} />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[#15151E]">
                          Round {h.round} · {s.label}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[#6B6B6B]">
                          Predicted: {h.prediction.join(" · ")}
                        </p>
                        <p className="text-[10px] text-[#6B6B6B]">
                          Actual: {h.actual.join(" · ")}
                        </p>
                      </div>
                    </div>
                    <span className="tabular text-lg font-extrabold text-[#15151E]">
                      +{h.points}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
