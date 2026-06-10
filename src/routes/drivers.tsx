import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import { teamColorByName } from "@/lib/api-live";
import { getDrivers, getDriverSeasonStats, type ErgastDriver } from "@/lib/api-live";

export const Route = createFileRoute("/drivers")({
  head: () => ({
    meta: [
      { title: "Driver Analytics — PitWall" },
      { name: "description", content: "Compare F1 drivers head-to-head: pace, qualifying, points and reliability." },
      { property: "og:title", content: "Driver Analytics — PitWall" },
    ],
  }),
  component: DriversPage,
});

// ---------- helpers ----------
function teamColor(constructorName: string): string {
  return teamColorByName(constructorName);
}

function lapToSec(t?: string): number | null {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  return parseFloat(t) || null;
}

interface DriverData {
  driver: ErgastDriver | null;
  team: string;
  color: string;
  number: string;
  wins: number;
  podiums: number;
  poles: number;
  points: number;
  podiumPct: number;
  dnfRate: number;
  avgRace: string;
  avgQuali: string;
  progression: { round: number; points: number }[];
  pace: { round: number; quali: number | null; race: number | null }[];
  loading: boolean;
  error: boolean;
}

const EMPTY: DriverData = {
  driver: null, team: "", color: "#888", number: "—",
  wins: 0, podiums: 0, poles: 0, points: 0, podiumPct: 0, dnfRate: 0,
  avgRace: "—", avgQuali: "—", progression: [], pace: [], loading: true, error: false,
};

function useDriverData(driverId: string | null): DriverData {
  const [data, setData] = useState<DriverData>(EMPTY);

  useEffect(() => {
    if (!driverId) return;
    let active = true;
    setData((d) => ({ ...d, loading: true, error: false }));
    (async () => {
      try {
        const stats = await getDriverSeasonStats(2026, driverId);
        if (!active) return;

        // Get driver metadata from the driver list fetch
        const drivers = await getDrivers(2026);
        const driverMeta = drivers.find((d) => d.driverId === driverId);
        const team = driverMeta ? "" : ""; // team comes from constructor in results
        // Extract team from paceByRound context — use stats for display
        const raceSecs = stats.paceByRound.map((r) => r.race).filter((v): v is number => v !== null);
        const qualiSecs = stats.paceByRound.map((r) => r.quali).filter((v): v is number => v !== null);

        const avg = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
        const fmt = (sec: number | null) => {
          if (sec == null) return "—";
          const m = Math.floor(sec / 60);
          const s = sec - m * 60;
          return `${m}:${s.toFixed(3).padStart(6, "0")}`;
        };

        setData({
          driver: driverMeta ?? null,
          team: driverMeta ? `${driverMeta.givenName} ${driverMeta.familyName}` : driverId,
          color: "#E8002D", // will be overridden when team is known
          number: driverMeta?.permanentNumber ?? driverMeta?.code ?? "—",
          wins: stats.wins,
          podiums: stats.podiums,
          poles: stats.poles,
          points: stats.points,
          podiumPct: stats.podiumPct,
          dnfRate: stats.dnfRate,
          avgRace: fmt(avg(raceSecs)),
          avgQuali: fmt(avg(qualiSecs)),
          progression: stats.progression,
          pace: stats.paceByRound,
          loading: false,
          error: false,
        });
      } catch (e) {
        console.warn("[PitWall][drivers] failed", driverId, e);
        if (active) setData((d) => ({ ...d, loading: false, error: true }));
      }
    })();
    return () => { active = false; };
  }, [driverId]);

  return data;
}

// ---------- UI ----------
function ChartSkeleton() {
  return (
    <div className="flex h-64 items-end gap-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 animate-pulse rounded-t bg-[#E5E5E5]"
          style={{ height: `${30 + ((i * 37) % 60)}%`, animationDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  );
}

function DriverCard({ d, name }: { d: DriverData; name: string }) {
  if (d.loading) {
    return (
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-[#E5E5E5]" />
        <div className="mt-3 h-8 w-2/3 animate-pulse rounded bg-[#E5E5E5]" />
        <div className="mt-6 grid grid-cols-4 gap-2 border-t border-[#E5E5E5] pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-[#E5E5E5]" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div
      className="pit-fade-up rounded-xl border border-[#E5E5E5] bg-white p-6"
      style={{ borderLeft: `4px solid ${d.color}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <SectionLabel>{d.team || "—"}</SectionLabel>
          <h3 className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-[#15151E]">
            {d.driver ? `${d.driver.givenName} ${d.driver.familyName}` : name}
          </h3>
          <p className="mt-1 text-sm text-[#6B6B6B]">{d.driver?.nationality ?? ""}</p>
        </div>
        <span className="tabular text-[64px] font-extrabold leading-none" style={{ color: d.color }}>
          {d.number}
        </span>
      </div>
      <div className="mt-6 grid grid-cols-4 gap-2 border-t border-[#E5E5E5] pt-4">
        {[
          { l: "Wins", v: d.wins },
          { l: "Podiums", v: d.podiums },
          { l: "Poles", v: d.poles },
          { l: "Points", v: d.points },
        ].map((s) => (
          <div key={s.l}>
            <div className="tabular text-2xl font-extrabold text-[#15151E]">{s.v}</div>
            <SectionLabel>{s.l}</SectionLabel>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBar({
  label,
  aLabel,
  bLabel,
  aPct,
  aColor,
  bColor,
}: {
  label: string;
  aLabel: string;
  bLabel: string;
  aPct: number;
  aColor: string;
  bColor: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-bold tabular text-[#15151E]">{aLabel}</span>
        <SectionLabel>{label}</SectionLabel>
        <span className="font-bold tabular text-[#15151E]">{bLabel}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[#E5E5E5]">
        <div className="pit-grow h-full" style={{ width: `${aPct}%`, backgroundColor: aColor }} />
        <div className="pit-grow h-full" style={{ width: `${100 - aPct}%`, backgroundColor: bColor }} />
      </div>
    </div>
  );
}

const pct = (a: number, b: number) => (a + b === 0 ? 50 : Math.round((a / (a + b)) * 100));

function DriversPage() {
  const [list, setList] = useState<ErgastDriver[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [d1, setD1] = useState<string | null>(null);
  const [d2, setD2] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const drivers = await getDrivers(2026);
        if (!active) return;
        setList(drivers);
        const find = (...ids: string[]) =>
          drivers.find((d) => ids.includes(d.driverId))?.driverId;
        setD1(find("max_verstappen", "verstappen") ?? drivers[0]?.driverId ?? null);
        setD2(find("norris", "lando_norris") ?? drivers[1]?.driverId ?? null);
      } catch (e) {
        console.warn("[PitWall][drivers] list failed", e);
      } finally {
        if (active) setListLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const a = useDriverData(d1);
  const b = useDriverData(d2);

  const nameOf = (id: string | null) => {
    const d = list.find((x) => x.driverId === id);
    return d ? `${d.givenName} ${d.familyName}` : "Driver";
  };

  // combined charts
  const paceData = useMemo(() => {
    const rounds = Array.from(
      new Set([...a.pace.map((p) => p.round), ...b.pace.map((p) => p.round)]),
    ).sort((x, y) => x - y);
    const aMap = new Map(a.pace.map((p) => [p.round, p]));
    const bMap = new Map(b.pace.map((p) => [p.round, p]));
    return rounds.map((round) => ({
      round,
      a_quali: aMap.get(round)?.quali ?? null,
      a_race: aMap.get(round)?.race ?? null,
      b_quali: bMap.get(round)?.quali ?? null,
      b_race: bMap.get(round)?.race ?? null,
    }));
  }, [a.pace, b.pace]);

  const pointsData = useMemo(() => {
    const rounds = Array.from(
      new Set([...a.progression.map((p) => p.round), ...b.progression.map((p) => p.round)]),
    ).sort((x, y) => x - y);
    const aMap = new Map(a.progression.map((p) => [p.round, p.points]));
    const bMap = new Map(b.progression.map((p) => [p.round, p.points]));
    return rounds.map((round) => ({
      round,
      a: aMap.get(round) ?? null,
      b: bMap.get(round) ?? null,
    }));
  }, [a.progression, b.progression]);

  const chartsLoading = a.loading || b.loading;
  const aColor = a.color || "#E8002D";
  const bColor = b.color || "#3671C6";
  const aShort = nameOf(d1);
  const bShort = nameOf(d2);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
      <SectionLabel>Driver Analytics · 2026 Season</SectionLabel>
      <h1 className="mt-1 text-3xl font-extrabold uppercase tracking-tight text-[#15151E]">
        Head To Head
      </h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <SectionLabel>Select Driver 1</SectionLabel>
          <Select value={d1 ?? undefined} onValueChange={setD1} disabled={listLoading}>
            <SelectTrigger className="mt-1.5 h-11 bg-white">
              <SelectValue placeholder={listLoading ? "Loading drivers…" : "Select a driver"} />
            </SelectTrigger>
            <SelectContent>
              {list.map((d) => (
                <SelectItem key={d.driverId} value={d.driverId}>
                  {d.givenName} {d.familyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <SectionLabel>Select Driver 2</SectionLabel>
          <Select value={d2 ?? undefined} onValueChange={setD2} disabled={listLoading}>
            <SelectTrigger className="mt-1.5 h-11 bg-white">
              <SelectValue placeholder={listLoading ? "Loading drivers…" : "Select a driver"} />
            </SelectTrigger>
            <SelectContent>
              {list.map((d) => (
                <SelectItem key={d.driverId} value={d.driverId}>
                  {d.givenName} {d.familyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <DriverCard d={a} name={aShort} />
        <DriverCard d={b} name={bShort} />
      </div>

      <div className="mt-5 rounded-xl border border-[#E5E5E5] bg-white p-6">
        <SectionLabel>Head-To-Head</SectionLabel>
        {chartsLoading ? (
          <div className="mt-4 space-y-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-7 animate-pulse rounded bg-[#E5E5E5]" />
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            <StatBar label="Wins" aLabel={`${a.wins}`} bLabel={`${b.wins}`} aPct={pct(a.wins, b.wins)} aColor={aColor} bColor={bColor} />
            <StatBar label="Podiums" aLabel={`${a.podiums}`} bLabel={`${b.podiums}`} aPct={pct(a.podiums, b.podiums)} aColor={aColor} bColor={bColor} />
            <StatBar label="Points" aLabel={`${a.points}`} bLabel={`${b.points}`} aPct={pct(a.points, b.points)} aColor={aColor} bColor={bColor} />
            <StatBar label="Podium %" aLabel={`${a.podiumPct}%`} bLabel={`${b.podiumPct}%`} aPct={pct(a.podiumPct, b.podiumPct)} aColor={aColor} bColor={bColor} />
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-6">
          <SectionLabel>Qualifying vs Race Pace</SectionLabel>
          <h3 className="mt-1 mb-4 text-lg font-bold uppercase tracking-tight text-[#15151E]">
            Pace by Round (sec)
          </h3>
          {chartsLoading ? (
            <ChartSkeleton />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={paceData} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="round" stroke="#6B6B6B" fontSize={11} />
                  <YAxis domain={["auto", "auto"]} stroke="#6B6B6B" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#15151E", border: "none", borderRadius: 8, color: "#fff" }} />
                  <Legend />
                  <Line type="monotone" dataKey="a_quali" name={`${aShort} Quali`} stroke={aColor} strokeWidth={2.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="a_race" name={`${aShort} Race`} stroke={aColor} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                  <Line type="monotone" dataKey="b_quali" name={`${bShort} Quali`} stroke={bColor} strokeWidth={2.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="b_race" name={`${bShort} Race`} stroke={bColor} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-6">
          <SectionLabel>Season Points Progression</SectionLabel>
          <h3 className="mt-1 mb-4 text-lg font-bold uppercase tracking-tight text-[#15151E]">
            Cumulative Points
          </h3>
          {chartsLoading ? (
            <ChartSkeleton />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pointsData} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={aColor} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={aColor} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={bColor} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={bColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="round" stroke="#6B6B6B" fontSize={11} />
                  <YAxis stroke="#6B6B6B" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#15151E", border: "none", borderRadius: 8, color: "#fff" }} />
                  <Legend />
                  <Area type="monotone" dataKey="a" name={aShort} stroke={aColor} strokeWidth={2.5} fill="url(#g1)" connectNulls />
                  <Area type="monotone" dataKey="b" name={bShort} stroke={bColor} strokeWidth={2.5} fill="url(#g2)" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
