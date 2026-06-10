import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Plus, X, Play, Save, Trash2, AlertTriangle } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionLabel } from "@/components/Shared";
import { AuthGate } from "@/components/AuthGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { compoundColor, type Compound } from "@/lib/mock-data";
import { teamColorByName, getSeason, getDrivers, type ErgastDriver, type ErgastRace } from "@/lib/api-live";
import { formatLapTime } from "@/lib/format";
import {
  simulateStrategy,
  compoundLabel,
  type SimResponse,
  type SimStint,
} from "@/lib/strategy";

export const Route = createFileRoute("/strategy")({
  head: () => ({
    meta: [
      { title: "PitWall — Strategy Simulator" },
      { name: "description", content: "Build a custom F1 tire strategy and simulate your race result." },
      { property: "og:title", content: "PitWall — Strategy Simulator" },
    ],
  }),
  component: StrategyPageWrapper,
});

interface Stint {
  id: number;
  compound: Compound;
  from: number;
  to: number;
}

interface SavedStrategy {
  id: string;
  userId: string;
  raceName: string;
  driverName: string;
  stints: { compound: Compound; lapStart: number; lapEnd: number }[];
  predictedFinish: number;
  timeDelta: string;
  savedAt: number;
}

const compounds: Compound[] = ["Soft", "Medium", "Hard", "Inter", "Wet"];

// Fallback race list used while real season data loads
const RACES_FALLBACK = [
  { label: "Bahrain GP", round: 1 },
  { label: "Saudi Arabian GP", round: 2 },
  { label: "Australian GP", round: 3 },
  { label: "Japanese GP", round: 4 },
  { label: "Chinese GP", round: 5 },
  { label: "Miami GP", round: 6 },
  { label: "Monaco GP", round: 8 },
  { label: "Canadian GP", round: 9 },
  { label: "Spanish GP", round: 10 },
  { label: "British GP", round: 12 },
  { label: "Belgian GP", round: 14 },
  { label: "Italian GP", round: 16 },
];

const SIM_MESSAGES = [
  "Calculating tire degradation...",
  "Modeling pit stop windows...",
  "Predicting race pace...",
  "Finalizing result...",
];

function toUpperCompound(c: Compound): SimStint["compound"] {
  switch (c) {
    case "Soft":
      return "SOFT";
    case "Medium":
      return "MEDIUM";
    case "Hard":
      return "HARD";
    case "Inter":
      return "INTER";
    case "Wet":
      return "WET";
  }
}

function driverColor(d?: ErgastDriver, constructorName?: string): string {
  if (constructorName) return teamColorByName(constructorName);
  if (!d) return "#E8002D";
  return "#E8002D";
}

function strategiesKey(userId: string) {
  return `pitwall:strategies:${userId}`;
}
function loadStrategies(userId: string): SavedStrategy[] {
  try {
    return JSON.parse(localStorage.getItem(strategiesKey(userId)) ?? "[]");
  } catch {
    return [];
  }
}
function saveStrategies(userId: string, list: SavedStrategy[]) {
  localStorage.setItem(strategiesKey(userId), JSON.stringify(list));
}

function SimLoading() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % SIM_MESSAGES.length), 800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mt-5 rounded-md bg-[#15151E] p-4">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full bg-[#E8002D]"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: "60%" }}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-3 text-center text-sm font-bold uppercase tracking-wide text-white"
        >
          {SIM_MESSAGES[idx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function StrategyContent() {
  const { user } = useUser();
  const [race, setRace] = useState("1");
  const [driverId, setDriverId] = useState("");
  const [driverList, setDriverList] = useState<ErgastDriver[]>([]);
  const [stints, setStints] = useState<Stint[]>([
    { id: 1, compound: "Soft", from: 1, to: 18 },
    { id: 2, compound: "Medium", from: 19, to: 45 },
    { id: 3, compound: "Soft", from: 46, to: 57 },
  ]);
  const nextId = useRef(4);
  const [result, setResult] = useState<SimResponse | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [saved, setSaved] = useState<SavedStrategy[]>([]);

  useEffect(() => {
    if (user?.id) setSaved(loadStrategies(user.id));
  }, [user?.id]);

  // Fetch drivers for the selected race round.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const round = parseInt(race, 10);
        const { list } = await ergast.driversByRound(2024, round);
        if (!active) return;
        setDriverList(list);
        setDriverId((prev) => (list.some((d) => d.driverId === prev) ? prev : list[0]?.driverId ?? ""));
      } catch (e) {
        console.warn("[PitWall][strategy] driver fetch failed", e);
      }
    })();
    return () => {
      active = false;
    };
  }, [race]);

  const selectedDriver = driverList.find((d) => d.driverId === driverId);
  const color = driverColor(selectedDriver);

  const update = (id: number, patch: Partial<Stint>) =>
    setStints((s) => s.map((st) => (st.id === id ? { ...st, ...patch } : st)));
  const remove = (id: number) => setStints((s) => s.filter((st) => st.id !== id));
  const add = () =>
    setStints((s) => [
      ...s,
      { id: nextId.current++, compound: "Medium", from: (s.at(-1)?.to ?? 0) + 1, to: (s.at(-1)?.to ?? 0) + 15 },
    ]);

  const handleSimulate = async () => {
    setSimulating(true);
    setResult(null);
    const start = Date.now();
    const res = await simulateStrategy({
      year: 2024,
      round: parseInt(race, 10),
      driverId,
      stints: stints.map((s) => ({ compound: toUpperCompound(s.compound), lapStart: s.from, lapEnd: s.to })),
    });
    // Keep the loading sequence visible briefly so messages can cycle.
    const elapsed = Date.now() - start;
    if (elapsed < 2400) await new Promise((r) => setTimeout(r, 2400 - elapsed));
    setResult(res);
    setSimulating(false);
  };

  const handleSave = () => {
    if (!user?.id || !result) return;
    const entry: SavedStrategy = {
      id: `${Date.now()}`,
      userId: user.id,
      raceName: `2024 ${RACES_2024.find((r) => r.round === parseInt(race, 10))?.label ?? race}`,
      driverName: selectedDriver ? `${selectedDriver.givenName} ${selectedDriver.familyName}` : driverId,
      stints: stints.map((s) => ({ compound: s.compound, lapStart: s.from, lapEnd: s.to })),
      predictedFinish: result.predictedPosition,
      timeDelta: result.timeDeltaVsActual,
      savedAt: Date.now(),
    };
    const next = [entry, ...saved];
    setSaved(next);
    saveStrategies(user.id, next);
  };

  const handleDelete = (id: string) => {
    if (!user?.id) return;
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    saveStrategies(user.id, next);
  };

  // Degradation chart data with per-stint colored areas.
  const degData = useMemo(() => {
    if (!result) return [] as Record<string, number | null>[];
    const stintByLap = new Map<number, number>();
    let si = 0;
    const stintRanges = stints.map((s) => ({ from: s.from, to: s.to }));
    return result.degradationCurve.map((d) => {
      // find stint index for this lap
      const idx = stintRanges.findIndex((r) => d.lap >= r.from && d.lap <= r.to);
      const point: Record<string, number | null> = { lap: d.lap, time: d.time };
      stints.forEach((_, i) => (point[`stint${i}`] = i === idx ? d.time : null));
      void stintByLap;
      void si;
      return point;
    });
  }, [result, stints]);

  const pitBoundaries = stints.slice(0, -1).map((s) => s.to);
  const betterThanActual = result ? parseFloat(result.timeDeltaVsActual) < 0 : false;

  return (
    <main>
      <div className="pit-noise bg-[#15151E]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
          <h1 className="text-xl font-extrabold uppercase tracking-tight text-white md:text-2xl">
            Tire Strategy Simulator
          </h1>
          <p className="mt-1 text-sm text-[#A0A0B0]">
            Build a custom strategy and simulate your race result
          </p>
        </div>
      </div>

      {result?.demo && (
        <div className="mx-auto max-w-[1400px] px-4 pt-4 lg:px-6">
          <div className="flex items-center gap-2 rounded-md border border-[#FFB020]/40 bg-[#FFB020]/10 px-4 py-2.5 text-xs font-semibold text-[#9A6A00]">
            <AlertTriangle size={15} />
            Demo Mode — Connect FastAPI for real predictions
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-[1400px] gap-5 px-4 py-8 lg:grid-cols-2 lg:px-6">
        {/* BUILDER */}
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-6">
          <SectionLabel>Strategy Builder</SectionLabel>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <SectionLabel>Race (2024)</SectionLabel>
              <Select value={race} onValueChange={setRace}>
                <SelectTrigger className="mt-1.5 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RACES_2024.map((r) => (
                    <SelectItem key={r.round} value={String(r.round)}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <SectionLabel>Driver</SectionLabel>
              <Select value={driverId} onValueChange={setDriverId} disabled={driverList.length === 0}>
                <SelectTrigger className="mt-1.5 bg-white">
                  <SelectValue placeholder="Loading…" />
                </SelectTrigger>
                <SelectContent>
                  {driverList.map((d) => (
                    <SelectItem key={d.driverId} value={d.driverId}>
                      {d.givenName} {d.familyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {stints.map((s, i) => (
              <div key={s.id} className="pit-fade flex flex-col gap-3 rounded-lg bg-[#F5F5F5] p-3 sm:flex-row sm:flex-wrap sm:items-end">
                <span
                  className="self-start rounded px-2 py-1 text-[11px] font-bold uppercase"
                  style={{ backgroundColor: compoundColor[s.compound].bg, color: compoundColor[s.compound].text }}
                >
                  Stint {i + 1}
                </span>
                <div>
                  <SectionLabel>Compound</SectionLabel>
                  <Select value={s.compound} onValueChange={(v) => update(s.id, { compound: v as Compound })}>
                    <SelectTrigger className="mt-1 h-9 w-28 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {compounds.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <SectionLabel>From</SectionLabel>
                  <input
                    type="number"
                    value={s.from}
                    onChange={(e) => update(s.id, { from: +e.target.value })}
                    className="mt-1 h-9 w-16 rounded-md border border-[#E5E5E5] bg-white px-2 text-sm tabular"
                  />
                </div>
                <div>
                  <SectionLabel>To</SectionLabel>
                  <input
                    type="number"
                    value={s.to}
                    onChange={(e) => update(s.id, { to: +e.target.value })}
                    className="mt-1 h-9 w-16 rounded-md border border-[#E5E5E5] bg-white px-2 text-sm tabular"
                  />
                </div>
                <button
                  onClick={() => remove(s.id)}
                  className="grid h-9 w-9 place-items-center rounded-md border border-[#E5E5E5] bg-white text-[#6B6B6B] hover:border-[#E8002D] hover:text-[#E8002D] sm:ml-auto"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={add}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-[#E8002D] hover:text-[#CC0027]"
          >
            <Plus size={16} /> Add Stint
          </button>

          {simulating ? (
            <SimLoading />
          ) : (
            <button
              onClick={handleSimulate}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-[#E8002D] py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#CC0027]"
            >
              <Play size={16} /> Simulate Strategy
            </button>
          )}

          {result && !simulating && (
            <button
              onClick={handleSave}
              className="pit-fade mt-3 flex w-full items-center justify-center gap-2 rounded-md border-2 border-[#E8002D] bg-white py-3 text-sm font-bold uppercase tracking-wide text-[#E8002D] transition-colors hover:bg-[#E8002D] hover:text-white"
            >
              <Save size={16} /> Save Strategy
            </button>
          )}
        </div>

        {/* RESULTS */}
        <div className="space-y-5">
          <div className="pit-noise rounded-xl bg-[#1E1E2E] p-6">
            <SectionLabel dark>Predicted Finish</SectionLabel>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <div className="tabular text-5xl font-extrabold leading-none" style={{ color: result ? color : "#3A3A4A" }}>
                  {result ? `P${result.predictedPosition}` : "—"}
                </div>
                {result && (
                  <span
                    className={`mt-3 inline-block rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      betterThanActual ? "bg-[#39B54A] text-white" : "bg-[#E8002D] text-white"
                    }`}
                  >
                    {betterThanActual ? "Better than actual" : "Slower than actual"}
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-[#A0A0B0]">Δ vs Actual</p>
                <p className={`tabular text-2xl font-extrabold ${betterThanActual ? "text-[#39B54A]" : "text-[#E8002D]"}`}>
                  {result ? result.timeDeltaVsActual : "—"}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-[#A0A0B0]">Total Time</p>
                <p className="tabular text-sm font-bold text-white">{result ? result.totalRaceTime : "—"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E5E5] bg-white p-6">
            <SectionLabel>Tire Degradation</SectionLabel>
            <h3 className="mt-1 mb-4 text-lg font-bold uppercase tracking-tight text-[#15151E]">
              Lap Time by Stint
            </h3>
            <div className="h-64">
              {result ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={degData} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                    <XAxis dataKey="lap" stroke="#6B6B6B" fontSize={11} />
                    <YAxis domain={["auto", "auto"]} stroke="#6B6B6B" fontSize={11} />
                    <Tooltip
                      contentStyle={{ background: "#15151E", border: "none", borderRadius: 8, color: "#fff" }}
                      formatter={(v: number) => [formatLapTime(v), "Lap time"]}
                    />
                    {stints.map((s, i) => (
                      <Area
                        key={s.id}
                        dataKey={`stint${i}`}
                        stroke="none"
                        fill={compoundColor[s.compound].bg}
                        fillOpacity={0.4}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                    <Line type="monotone" dataKey="time" stroke="#E8002D" strokeWidth={2.5} dot={false} />
                    {pitBoundaries.map((p) => (
                      <ReferenceLine key={p} x={p} stroke="#E8002D" strokeDasharray="3 3" />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center text-sm text-[#A0A0B0]">
                  Run a simulation to view degradation
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
            <div className="grid grid-cols-2 bg-[#15151E] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#A0A0B0]">
              <span>Your Strategy</span>
              <span>Actual Strategy</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#E5E5E5]">
              <div className="space-y-1.5 p-3">
                {stints.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                      style={{ backgroundColor: compoundColor[s.compound].bg, color: compoundColor[s.compound].text }}
                    >
                      {s.compound}
                    </span>
                    <span className="tabular text-[#6B6B6B]">L{s.from}–{s.to}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 p-3">
                {(result?.actualStrategy ?? []).map((s, i) => {
                  const c = compoundLabel(s.compound);
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{ backgroundColor: compoundColor[c].bg, color: compoundColor[c].text }}
                      >
                        {c}
                      </span>
                      <span className="tabular text-[#6B6B6B]">L{s.lapStart}–{s.lapEnd}</span>
                    </div>
                  );
                })}
                {!result && <span className="text-xs text-[#A0A0B0]">—</span>}
              </div>
            </div>
            {result && (
              <div className="flex items-center justify-between border-t border-[#E5E5E5] px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-wide text-[#15151E]">Total Time</span>
                <span className={`tabular text-sm font-extrabold ${betterThanActual ? "text-[#39B54A]" : "text-[#E8002D]"}`}>
                  {result.timeDeltaVsActual}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MY STRATEGIES */}
      <div className="mx-auto max-w-[1400px] px-4 pb-12 lg:px-6">
        <div className="mb-4">
          <SectionLabel>Your Account</SectionLabel>
          <h2 className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-[#15151E]">
            My Strategies
          </h2>
        </div>

        {saved.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#E5E5E5] bg-[#F5F5F5] px-6 py-12 text-center">
            <p className="text-sm font-semibold text-[#6B6B6B]">
              No saved strategies yet — run a simulation above
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {saved.map((s) => (
              <div key={s.id} className="pit-fade rounded-xl border border-[#E5E5E5] bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-tight text-[#15151E]">{s.raceName}</h3>
                    <p className="mt-0.5 text-xs text-[#6B6B6B]">{s.driverName}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="grid h-8 w-8 place-items-center rounded-md border border-[#E5E5E5] text-[#6B6B6B] hover:border-[#E8002D] hover:text-[#E8002D]"
                    aria-label="Delete strategy"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.stints.map((st, i) => (
                    <span
                      key={i}
                      className="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{ backgroundColor: compoundColor[st.compound].bg, color: compoundColor[st.compound].text }}
                    >
                      {st.compound} {st.lapStart}-{st.lapEnd}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[#E5E5E5] pt-3">
                  <span className="text-xs font-semibold text-[#6B6B6B]">Predicted P{s.predictedFinish}</span>
                  <span className="tabular text-xs font-bold text-[#15151E]">{s.timeDelta}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StrategyPageWrapper() {
  return (
    <ErrorBoundary label="strategy_page">
      <AuthGate>
        <StrategyContent />
      </AuthGate>
    </ErrorBoundary>
  );
}
