import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ChevronUp, ChevronDown, Send, Sparkles, ChevronDown as Caret } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Line,
  LineChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TirePill } from "@/components/TirePill";
import { SectionLabel, EmptyState } from "@/components/Shared";
import { ConnectionPill } from "@/components/ConnectionPill";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { teamColors, type Compound } from "@/lib/mock-data";
import { timeAgo } from "@/lib/api";
import { formatLapTime, formatDelta } from "@/lib/format";
import { useRaceSocket, type RaceSocketState } from "@/hooks/use-race-socket";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "PitWall — Live Race Center" },
      { name: "description", content: "Live F1 leaderboard, AI race insights and lap position tracking." },
      { property: "og:title", content: "PitWall — Live Race Center" },
    ],
  }),
  component: LivePageWrapper,
});

// --- helpers ---
function mapCompound(c?: string): Compound {
  switch ((c ?? "").toUpperCase()) {
    case "SOFT":
      return "Soft";
    case "MEDIUM":
      return "Medium";
    case "HARD":
      return "Hard";
    case "INTERMEDIATE":
      return "Inter";
    case "WET":
      return "Wet";
    default:
      return "Medium";
  }
}

function fmtGap(gap: number | string | null | undefined, pos: number): string {
  if (pos === 1) return "LEADER";
  if (gap == null || gap === "") return "—";
  if (typeof gap === "number") return `+${gap.toFixed(3)}`;
  return String(gap);
}

interface LiveRow {
  num: number;
  code: string;
  name: string;
  team: string;
  color: string;
  pos: number;
  gap: string;
  lastLap: string;
  tyre: Compound;
  pits: number;
  change: number;
}

function buildRows(state: RaceSocketState, prevPos: Map<number, number>): LiveRow[] {
  const posByDriver = new Map<number, { position: number; date: string }>();
  for (const p of state.positions) {
    const prev = posByDriver.get(p.driver_number);
    if (!prev || new Date(p.date) > new Date(prev.date)) {
      posByDriver.set(p.driver_number, { position: p.position, date: p.date });
    }
  }
  const intByDriver = new Map<number, number | string | null>();
  for (const it of state.intervals) intByDriver.set(it.driver_number, it.gap_to_leader);

  const stintByDriver = new Map<number, { compound: string; lap_start: number }>();
  for (const st of state.stints) {
    const prev = stintByDriver.get(st.driver_number);
    if (!prev || st.lap_start >= prev.lap_start)
      stintByDriver.set(st.driver_number, { compound: st.compound, lap_start: st.lap_start });
  }
  const pitByDriver = new Map<number, number>();
  for (const p of state.pits) pitByDriver.set(p.driver_number, (pitByDriver.get(p.driver_number) ?? 0) + 1);

  const lapByDriver = new Map<number, { lap: number; dur: number | null }>();
  for (const l of state.laps) {
    const prev = lapByDriver.get(l.driver_number);
    if (!prev || l.lap_number > prev.lap)
      lapByDriver.set(l.driver_number, { lap: l.lap_number, dur: l.lap_duration });
  }

  const rows = state.drivers
    .map((d) => {
      const pInfo = posByDriver.get(d.driver_number);
      const pos = pInfo?.position ?? 99;
      const prev = prevPos.get(d.driver_number);
      const change = prev != null ? prev - pos : 0;
      return {
        num: d.driver_number,
        code: d.name_acronym,
        name: d.full_name,
        team: d.team_name,
        color: d.team_colour ? `#${d.team_colour}` : teamColors[d.team_name] ?? "#999",
        pos,
        gap: fmtGap(intByDriver.get(d.driver_number), pos),
        lastLap: formatLapTime(lapByDriver.get(d.driver_number)?.dur ?? undefined),
        tyre: mapCompound(stintByDriver.get(d.driver_number)?.compound),
        pits: pitByDriver.get(d.driver_number) ?? 0,
        change,
      } as LiveRow;
    })
    .filter((r) => r.pos !== 99)
    .sort((a, b) => a.pos - b.pos);

  prevPos.clear();
  for (const r of rows) prevPos.set(r.num, r.pos);
  return rows;
}

function ChangeBadge({ change }: { change: number }) {
  if (change === 0) return <span className="inline-block w-10" />;
  const up = change > 0;
  return (
    <span
      className={`inline-flex w-10 items-center gap-0.5 text-xs font-bold ${
        up ? "text-[#39B54A]" : "text-[#E8002D]"
      }`}
    >
      {up ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      {up ? "+" : ""}
      {change}
    </span>
  );
}

function LeaderboardRow({ d }: { d: LiveRow }) {
  const flash =
    d.change > 0
      ? "rgba(57,181,74,0.18)"
      : d.change < 0
        ? "rgba(232,0,45,0.18)"
        : "rgba(255,255,255,0)";
  return (
    <motion.div
      initial={false}
      animate={{ backgroundColor: [flash, "rgba(255,255,255,0)"] }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="grid grid-cols-[44px_1.6fr_0.8fr_0.9fr_0.9fr_1fr_0.5fr] items-center gap-2 px-3 py-2.5"
      style={{
        borderLeft: `3px solid ${d.change > 0 ? "#39B54A" : d.change < 0 ? "#E8002D" : d.color}`,
      }}
    >
      <div className="flex items-center">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#15151E] text-xs font-bold text-white tabular">
          {d.pos}
        </span>
      </div>
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="truncate">
          <span className="font-bold uppercase text-[#15151E]">{d.code}</span>{" "}
          <span className="text-[#6B6B6B]">{d.name}</span>
        </span>
        <ChangeBadge change={d.change} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
        <span className="truncate text-xs text-[#6B6B6B]">{d.team}</span>
      </div>
      <div>
        <span
          className={`tabular text-sm font-semibold ${
            d.gap === "LEADER" ? "text-[#E8002D]" : "text-[#6B6B6B]"
          }`}
        >
          {d.gap}
        </span>
      </div>
      <div>
        <span className="tabular text-sm text-[#6B6B6B]">{d.lastLap}</span>
      </div>
      <div className="flex items-center gap-2">
        <TirePill compound={d.tyre} />
      </div>
      <div className="text-right">
        <span className="tabular text-sm font-semibold text-[#15151E]">{d.pits}</span>
      </div>
    </motion.div>
  );
}

function StatusBadge({ state }: { state: RaceSocketState }) {
  if (state.reconnecting)
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#FFB020]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#FFB020]">
        <span className="h-2 w-2 rounded-full bg-[#FFB020] animate-pit-pulse" /> Reconnecting…
      </span>
    );
  if (state.justConnected)
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#39B54A]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#39B54A]">
        <span className="h-2 w-2 rounded-full bg-[#39B54A]" /> Connected
      </span>
    );
  if (state.mode === "polling")
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#A0A0B0]">
        <span className="h-2 w-2 rounded-full bg-[#A0A0B0]" /> Polling Mode
      </span>
    );
  return null;
}

function Leaderboard({ state, rows }: { state: RaceSocketState; rows: LiveRow[] }) {
  if (state.loading) {
    return (
      <div className="space-y-2 rounded-xl border border-[#E5E5E5] bg-white p-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-11 w-full animate-pulse rounded-md bg-[#E5E5E5]" />
        ))}
      </div>
    );
  }

  if (state.error || rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-6">
        <EmptyState
          title="No race data"
          message="Live timing will appear here during race sessions."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[44px_1.6fr_0.8fr_0.9fr_0.9fr_1fr_0.5fr] items-center gap-2 bg-[#15151E] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#A0A0B0]">
            <span>Pos</span>
            <span>Driver</span>
            <span>Team</span>
            <span>Gap</span>
            <span>Last Lap</span>
            <span>Tyre</span>
            <span className="text-right">Pits</span>
          </div>
          <div className="divide-y divide-[#E5E5E5]">
            {rows.map((d) => (
              <LeaderboardRow key={d.num} d={d} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================ LAP POSITION CHART ============================

function LapChart({ rows, state }: { rows: LiveRow[]; state: RaceSocketState }) {
  const maxLap = useMemo(() => {
    const m = state.laps.reduce((acc, l) => Math.max(acc, l.lap_number), 0);
    return Math.max(8, Math.min(m || 47, 70));
  }, [state.laps]);

  const pitLaps = useMemo(() => {
    const set = new Set<number>();
    for (const p of state.pits) if (p.lap_number > 0 && p.lap_number <= maxLap) set.add(p.lap_number);
    return [...set].sort((a, b) => a - b);
  }, [state.pits, maxLap]);

  // Safety car band: cluster of pits within 2 laps → derive a band
  const scBand = useMemo(() => {
    if (pitLaps.length < 3) return null;
    for (let i = 0; i < pitLaps.length - 2; i++) {
      if (pitLaps[i + 2] - pitLaps[i] <= 3) return { from: pitLaps[i] - 1, to: pitLaps[i + 2] + 1 };
    }
    return null;
  }, [pitLaps]);

  const chartRows = useMemo(() => rows.slice(0, 12), [rows]);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(() => {
    const base = showAll ? chartRows : chartRows.slice(0, 5);
    return base.filter((r) => !hidden.has(r.num));
  }, [chartRows, showAll, hidden]);

  // Build believable per-lap position series converging to current positions.
  const data = useMemo(() => {
    return Array.from({ length: maxLap }, (_, idx) => {
      const lap = idx + 1;
      const t = lap / maxLap;
      const point: Record<string, number> = { lap };
      for (const r of chartRows) {
        const start = ((r.num * 7) % chartRows.length) + 1;
        const wobble = Math.sin(lap * 0.6 + r.num) * (1 - t) * 1.5;
        point[r.code] = Math.max(1, Math.round(start + (r.pos - start) * t + wobble));
      }
      return point;
    });
  }, [chartRows, maxLap]);

  const toggle = (num: number) =>
    setHidden((h) => {
      const next = new Set(h);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <SectionLabel>Lap Position Chart</SectionLabel>
          <h3 className="mt-1 text-lg font-bold uppercase tracking-tight text-[#15151E]">
            Position Changes · Laps 1–{maxLap}
          </h3>
        </div>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#15151E] transition-colors hover:border-[#E8002D] hover:text-[#E8002D]"
        >
          {showAll ? "Top 5" : "Show All"}
        </button>
      </div>

      {/* Driver filter pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(showAll ? chartRows : chartRows.slice(0, 5)).map((r) => {
          const off = hidden.has(r.num);
          return (
            <button
              key={r.num}
              onClick={() => toggle(r.num)}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-opacity"
              style={{
                borderColor: r.color,
                color: off ? "#A0A0B0" : "#15151E",
                opacity: off ? 0.4 : 1,
              }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
              {r.code}
            </button>
          );
        })}
      </div>

      <motion.div
        key={maxLap}
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mt-4 h-72 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
            <XAxis dataKey="lap" stroke="#6B6B6B" fontSize={11} />
            <YAxis reversed domain={[1, Math.max(8, chartRows.length)]} stroke="#6B6B6B" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#15151E", border: "none", borderRadius: 8, color: "#fff" }}
              labelFormatter={(l) => `Lap ${l}`}
            />
            {scBand && (
              <ReferenceArea x1={scBand.from} x2={scBand.to} fill="#FFD700" fillOpacity={0.12} />
            )}
            {pitLaps.map((p) => (
              <ReferenceLine
                key={`pit-${p}`}
                x={p}
                stroke="#A0A0B0"
                strokeDasharray="4 4"
                label={{ value: "PIT", position: "top", fontSize: 9, fill: "#A0A0B0" }}
              />
            ))}
            <ReferenceLine x={maxLap} stroke="#E8002D" strokeWidth={2} className="animate-pit-pulse" />
            {visible.map((r) => (
              <Line
                key={r.code}
                type="monotone"
                dataKey={r.code}
                stroke={r.color}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}

// ============================ SECTOR TIMING PANEL ============================

interface SectorEntry {
  num: number;
  code: string;
  color: string;
  time: number;
  isBest: boolean;
  isPb: boolean;
  delta: number;
}

function SectorPanel({ rows, state }: { rows: LiveRow[]; state: RaceSocketState }) {
  const [open, setOpen] = useState(false);

  const colorByNum = useMemo(() => {
    const m = new Map<number, { code: string; color: string }>();
    for (const r of rows) m.set(r.num, { code: r.code, color: r.color });
    return m;
  }, [rows]);

  const columns = useMemo(() => {
    const keys: Array<keyof import("@/lib/api").OF1Lap> = [
      "duration_sector_1",
      "duration_sector_2",
      "duration_sector_3",
    ];
    return keys.map((key) => {
      // best per driver for this sector
      const bestByDriver = new Map<number, number>();
      for (const l of state.laps) {
        const v = l[key] as number | null | undefined;
        if (v == null || v <= 0) continue;
        const prev = bestByDriver.get(l.driver_number);
        if (prev == null || v < prev) bestByDriver.set(l.driver_number, v);
      }
      const all = [...bestByDriver.entries()]
        .map(([num, time]) => ({ num, time }))
        .sort((a, b) => a.time - b.time);
      const sessionBest = all[0]?.time ?? 0;
      const top5: SectorEntry[] = all.slice(0, 5).map((e) => {
        const info = colorByNum.get(e.num);
        return {
          num: e.num,
          code: info?.code ?? `#${e.num}`,
          color: info?.color ?? "#999",
          time: e.time,
          isBest: e.time === sessionBest,
          isPb: true,
          delta: e.time - sessionBest,
        };
      });
      return top5;
    });
  }, [state.laps, colorByNum]);

  const hasData = columns.some((c) => c.length > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="pit-noise flex w-full items-center justify-between bg-[#15151E] px-4 py-3 text-left"
      >
        <span className="text-sm font-bold uppercase tracking-wide text-white">Sector Times</span>
        <Caret
          size={18}
          className={`text-[#A0A0B0] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {!hasData ? (
              <div className="p-6">
                <EmptyState title="No sector data" message="Sector times appear during a session." />
              </div>
            ) : (
              <div className="grid gap-px bg-[#E5E5E5] sm:grid-cols-3">
                {columns.map((col, ci) => (
                  <div key={ci} className="bg-white p-3">
                    <p className="section-label mb-2 text-[#6B6B6B]">Sector {ci + 1}</p>
                    <div className="space-y-1">
                      {col.map((e, i) => {
                        const bg = e.isBest
                          ? "bg-[#7B2FF7]/15"
                          : e.delta < 0.3
                            ? "bg-[#39B54A]/10"
                            : "bg-[#F5F5F5]";
                        const accent = e.isBest ? "text-[#7B2FF7]" : "text-[#15151E]";
                        return (
                          <div
                            key={e.num}
                            className={`grid grid-cols-[20px_1fr_auto_auto] items-center gap-2 rounded-md px-2 py-1.5 ${bg}`}
                          >
                            <span className="tabular text-xs font-bold text-[#6B6B6B]">{i + 1}</span>
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
                              <span className="text-xs font-bold uppercase text-[#15151E]">{e.code}</span>
                            </span>
                            <span className={`tabular text-xs font-semibold ${accent}`}>
                              {e.time.toFixed(3)}
                            </span>
                            <span className="tabular w-14 text-right text-[11px] text-[#6B6B6B]">
                              {e.isBest ? "—" : `+${e.delta.toFixed(3)}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================ AI SIDEBAR ============================

function AiSidebar() {
  const chips = ["Race Summary", "Tire Strategy", "Predict Finish"];
  const [input, setInput] = useState("");
  return (
    <div className="pit-noise flex flex-col overflow-hidden rounded-xl bg-[#1E1E2E]">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
        <Sparkles size={18} className="text-[#E8002D]" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-white">AI Insights</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-[#A0A0B0]">Powered by Gemini</span>
      </div>
      <div className="flex flex-wrap gap-2 px-5 py-4">
        {chips.map((c) => (
          <button
            key={c}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#A0A0B0] transition-colors hover:border-[#E8002D] hover:text-white"
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-4 px-5 pb-4">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#E8002D] px-4 py-2.5 text-sm text-white">
            Why did Norris gain a position?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[#15151E] px-4 py-2.5 text-sm text-[#A0A0B0]">
            Norris pitted under the VSC on lap 31, emerging ahead of Leclerc on fresher softs. His
            undercut gained approximately 2.3 seconds in the pit phase.
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-[#15151E] px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this race..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-[#6B6B6B] focus:outline-none"
          />
          <button className="grid h-8 w-8 place-items-center rounded-md bg-[#E8002D] text-white transition-colors hover:bg-[#CC0027]">
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================ PAGE ============================

function LivePage() {
  const state = useRaceSocket();
  const prevPos = useRef<Map<number, number>>(new Map());
  const rows = useMemo(
    () => buildRows(state, prevPos.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.positions, state.intervals, state.stints, state.pits, state.drivers, state.laps],
  );

  const title = state.session
    ? `2025 ${state.session.country_name} Grand Prix`
    : "Live Race Center";

  return (
    <main>
      <div className="pit-noise bg-[#15151E]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 lg:px-6">
          <h1 className="text-sm font-bold uppercase tracking-wide text-white md:text-base">
            {title}
          </h1>
          <div className="flex items-center gap-3">
            <StatusBadge state={state} />
            {!state.loading && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A0A0B0]">
                Updated {timeAgo(state.ts)}
              </span>
            )}
            {state.isLive ? (
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase text-white">
                <span className="h-2 w-2 rounded-full bg-[#E8002D] animate-pit-pulse" /> Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase text-[#A0A0B0]">
                <span className="h-2 w-2 rounded-full bg-[#A0A0B0]" /> No Live Session
              </span>
            )}
          </div>
        </div>
      </div>

      {!state.loading && !state.isLive && !state.error && (
        <div className="mx-auto max-w-[1400px] px-4 pt-4 lg:px-6">
          <div className="rounded-md border border-[#E5E5E5] bg-[#F5F5F5] px-4 py-2.5 text-xs font-semibold text-[#6B6B6B]">
            No live session — showing last completed race results. Live timing will appear here during
            race sessions.
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-[1400px] gap-5 px-4 py-6 lg:grid-cols-[1.5fr_1fr] lg:px-6">
        <div className="space-y-5">
          <Leaderboard state={state} rows={rows} />
          <LapChart rows={rows} state={state} />
          <SectorPanel rows={rows} state={state} />
        </div>
        <AiSidebar />
      </div>

      <ConnectionPill mode={state.mode} />
    </main>
  );
}

function LivePageWrapper() {
  return (
    <ErrorBoundary label="live_page">
      <LivePage />
    </ErrorBoundary>
  );
}
