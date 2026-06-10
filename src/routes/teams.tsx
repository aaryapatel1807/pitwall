import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { SectionLabel, LoadingSkeleton, EmptyState } from "@/components/Shared";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { teamColorByName, getConstructorStandings, getConstructorStandingsByRound, getSeason, type ErgastConstructorStanding, type ErgastRace } from "@/lib/api-live";
import { of1, latestRaceSession } from "@/lib/api";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "PitWall — Constructor Dashboard" },
      { name: "description", content: "F1 constructor standings, points progression, pit efficiency and reliability." },
      { property: "og:title", content: "PitWall — Constructor Dashboard" },
    ],
  }),
  component: TeamsPageWrapper,
});

// Local alias kept for minimal diff
type ErgastRaceFull = ErgastRace;

function teamColorFor(name: string): string {
  return teamColorByName(name);
}

type Pill = "W" | "P" | "DNF" | "—";

interface TeamRow {
  pos: number;
  name: string;
  color: string;
  points: number;
  wins: number;
  podiums: number;
  dnfs: number;
  reliability: number;
  last5: Pill[];
  trend: number[];
  nationality: string;
}

interface ProgressionPoint {
  round: number;
  label: string;
  [team: string]: number | string;
}

interface PitTeam {
  team: string;
  color: string;
  avg: number;
  best: number;
  std: number;
  count: number;
}

interface TeamsData {
  rows: TeamRow[];
  progression: ProgressionPoint[];
  pit: PitTeam[];
  loading: boolean;
  error: boolean;
}

function abbrev(r: ErgastRaceFull): string {
  const c = r.Circuit?.Location?.country ?? r.Circuit?.circuitName ?? "";
  return c.slice(0, 3).toUpperCase();
}

function classify(delta: number): Pill {
  if (delta >= 25) return "W";
  if (delta >= 10) return "P";
  if (delta <= 0) return "DNF";
  return "—";
}

function useTeamsData(): TeamsData {
  const [data, setData] = useState<TeamsData>({
    rows: [], progression: [], pit: [], loading: true, error: false,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [season, currentStandings] = await Promise.all([
          getSeason(2026),
          getConstructorStandings(2026),
        ]);
        const now = Date.now();
        const completed = season.filter((r) => {
          const t = new Date(`${r.date}T${r.time ?? "12:00:00Z"}`).getTime();
          return t < now && t > 0;
        });
        const rounds = completed.map((r) => parseInt(r.round, 10)).sort((a, b) => a - b);

        const standings = currentStandings.length ? currentStandings : [];
        if (!active) return;

        const baseRows: TeamRow[] = standings.map((s: ErgastConstructorStanding, i) => ({
          pos: parseInt(s.position, 10) || i + 1,
          name: s.Constructor.name,
          color: teamColorFor(s.Constructor.name),
          points: parseFloat(s.points) || 0,
          wins: parseInt(s.wins, 10) || 0,
          podiums: 0, dnfs: 0, reliability: 100, last5: [],
          trend: [parseFloat(s.points) || 0],
          nationality: s.Constructor.nationality ?? "—",
        }));
        setData((d) => ({ ...d, rows: baseRows, loading: false, error: baseRows.length === 0 }));

        // Per-round standings with 3-worker concurrency
        const perRound: { round: number; list: ErgastConstructorStanding[] }[] = [];
        const queue = [...rounds];
        const worker = async () => {
          while (queue.length) {
            const rd = queue.shift()!;
            try {
              const list = await getConstructorStandingsByRound(2026, rd);
              perRound.push({ round: rd, list });
            } catch { /* skip */ }
          }
        };
        await Promise.all([worker(), worker(), worker()]);
        perRound.sort((a, b) => a.round - b.round);
        if (!active) return;

        const cumByTeam = new Map<string, number[]>();
        const progression: ProgressionPoint[] = perRound.map(({ round, list }) => {
          const found = completed.find((c) => +c.round === round);
          const point: ProgressionPoint = {
            round,
            label: found ? `R${round} ${abbrev(found)}` : `R${round}`,
          };
          for (const s of list) {
            const name = s.Constructor.name;
            point[name] = parseFloat(s.points) || 0;
            const arr = cumByTeam.get(name) ?? [];
            arr.push(parseFloat(s.points) || 0);
            cumByTeam.set(name, arr);
          }
          return point;
        });
        const roundCount = perRound.length;

        const rows: TeamRow[] = standings.map((s: ErgastConstructorStanding, i) => {
          const name = s.Constructor.name;
          const cum = cumByTeam.get(name) ?? [];
          const deltas = cum.map((v, idx) => (idx === 0 ? v : v - cum[idx - 1]));
          const last5 = deltas.slice(-5).map(classify);
          const dnfs = deltas.filter((d) => d <= 0).length;
          const podiums = deltas.filter((d) => d >= 15).length;
          return {
            pos: parseInt(s.position, 10) || i + 1, name,
            color: teamColorFor(name),
            points: parseFloat(s.points) || 0,
            wins: parseInt(s.wins, 10) || 0,
            podiums, dnfs,
            reliability: roundCount ? Math.round((1 - dnfs / roundCount) * 100) : 100,
            last5,
            trend: cum.slice(-5).length ? cum.slice(-5) : [parseFloat(s.points) || 0],
            nationality: s.Constructor.nationality ?? "—",
          };
        });

        // Pit efficiency from latest OpenF1 session
        let pit: PitTeam[] = [];
        try {
          const sessions = await of1.raceSessions(2026);
          const session = latestRaceSession(sessions.data);
          if (session) {
            const [pits, drv] = await Promise.all([
              of1.pits(session.session_key, 5 * 60 * 1000),
              of1.drivers(session.session_key),
            ]);
            const teamByNum = new Map<number, string>();
            for (const d of drv.data) teamByNum.set(d.driver_number, d.team_name);
            const byTeam = new Map<string, number[]>();
            for (const p of pits.data) {
              const dur = p.pit_duration;
              if (dur == null || dur <= 0 || dur > 60) continue;
              const team = teamByNum.get(p.driver_number);
              if (!team) continue;
              const arr = byTeam.get(team) ?? [];
              arr.push(dur);
              byTeam.set(team, arr);
            }
            pit = [...byTeam.entries()].map(([team, durs]) => {
              const avg = durs.reduce((a, b) => a + b, 0) / durs.length;
              const variance = durs.reduce((a, b) => a + (b - avg) ** 2, 0) / durs.length;
              return { team, color: teamColorFor(team), avg, best: Math.min(...durs), std: Math.sqrt(variance), count: durs.length };
            }).sort((a, b) => a.avg - b.avg);
          }
        } catch (e) {
          console.warn("[PitWall][teams] pit data failed", e);
        }

        setData({ rows, progression, pit, loading: false, error: rows.length === 0 });
      } catch (e) {
        console.warn("[PitWall][teams] load failed", e);
        if (active) setData((d) => ({ ...d, loading: false, error: true }));
      }
    })();
    return () => { active = false; };
  }, []);

  return data;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chart = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const PILL_STYLE: Record<Pill, string> = {
  W: "bg-[#39B54A] text-white",
  P: "bg-[#FFD700] text-[#15151E]",
  DNF: "bg-[#E8002D] text-white",
  "—": "bg-[#E5E5E5] text-[#6B6B6B]",
};

function ResultPills({ pills }: { pills: Pill[] }) {
  return (
    <div className="flex gap-1">
      {pills.length === 0 && <span className="text-xs text-[#A0A0B0]">—</span>}
      {pills.map((p, i) => (
        <span
          key={i}
          className={`grid h-5 w-6 place-items-center rounded text-[9px] font-bold ${PILL_STYLE[p]}`}
        >
          {p}
        </span>
      ))}
    </div>
  );
}

function TeamDrawer({ row, onClose }: { row: TeamRow | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {row && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.aside
            className="pit-noise fixed right-0 top-0 z-[61] flex h-full w-full flex-col overflow-y-auto bg-[#15151E] shadow-2xl sm:w-[420px]"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{ borderLeft: `4px solid ${row.color}` }}
          >
            <div className="flex items-start justify-between p-6">
              <div>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color, display: "inline-block" }} />
                <h2 className="mt-2 text-2xl font-extrabold uppercase tracking-tight text-white">{row.name}</h2>
                <p className="mt-1 text-sm text-[#A0A0B0]">{row.nationality}</p>
              </div>
              <button
                onClick={onClose}
                className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-xs font-bold uppercase text-[#A0A0B0] hover:text-white"
              >
                Close <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 px-6">
              {[
                { l: "Points", v: row.points },
                { l: "Wins", v: row.wins },
                { l: "Podiums", v: row.podiums },
              ].map((x) => (
                <div key={x.l} className="rounded-lg bg-[#1E1E2E] p-3 text-center">
                  <div className="tabular text-xl font-extrabold text-white">{x.v}</div>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-[#A0A0B0]">{x.l}</p>
                </div>
              ))}
            </div>

            <div className="px-6 pb-8 pt-6">
              <SectionLabel dark>Last 5 Rounds</SectionLabel>
              <div className="mt-3">
                <ResultPills pills={row.last5} />
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function TeamsPage() {
  const data = useTeamsData();
  const [selected, setSelected] = useState<TeamRow | null>(null);

  const teamLines = useMemo(() => data.rows.slice(0, 5).map((r) => r.name), [data.rows]);
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  const fastest = data.pit[0];
  const consistent = useMemo(
    () => [...data.pit].sort((a, b) => a.std - b.std)[0],
    [data.pit],
  );

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
      <SectionLabel>Team Dashboard</SectionLabel>
      <h1 className="mt-1 text-3xl font-extrabold uppercase tracking-tight text-[#15151E]">
        Constructor Standings
      </h1>

      {/* STANDINGS TABLE */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-[#E5E5E5] bg-white">
        {data.loading ? (
          <div className="p-4">
            <LoadingSkeleton rows={10} />
          </div>
        ) : data.error ? (
          <div className="p-6">
            <EmptyState title="No standings" message="Constructor data is unavailable right now." />
          </div>
        ) : (
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="bg-[#15151E] text-left text-[11px] font-bold uppercase tracking-wide text-[#A0A0B0]">
                <th className="px-4 py-3">Pos</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-right">Wins</th>
                <th className="px-4 py-3 text-right">Podiums</th>
                <th className="px-4 py-3">Last 5</th>
                <th className="px-4 py-3">Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((c, i) => (
                <tr
                  key={c.name}
                  onClick={() => setSelected(c)}
                  className={`pit-fade cursor-pointer transition-colors hover:bg-[#F5F5F5] ${i % 2 ? "bg-[#F9F9F9]" : "bg-white"}`}
                  style={{ animationDelay: `${i * 0.03}s`, borderLeft: `4px solid ${c.color}` }}
                >
                  <td className="px-4 py-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#15151E] text-xs font-bold text-white tabular">
                      {c.pos}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-bold uppercase tracking-tight text-[#15151E]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular text-base font-extrabold text-[#15151E]">{c.points}</td>
                  <td className="px-4 py-3 text-right tabular text-[#6B6B6B]">{c.wins}</td>
                  <td className="px-4 py-3 text-right tabular text-[#6B6B6B]">{c.podiums}</td>
                  <td className="px-4 py-3">
                    <ResultPills pills={c.last5} />
                  </td>
                  <td className="px-4 py-3">
                    <Sparkline data={c.trend.length ? c.trend : [0, 0]} color={c.color} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* POINTS PROGRESSION */}
      <div className="mt-5 rounded-xl border border-[#E5E5E5] bg-white p-6">
        <SectionLabel>Points Progression</SectionLabel>
        <h3 className="mt-1 mb-4 text-lg font-bold uppercase tracking-tight text-[#15151E]">
          Cumulative Points · Top 5
        </h3>
        {data.loading ? (
          <LoadingSkeleton rows={4} />
        ) : data.progression.length === 0 ? (
          <EmptyState title="No data" message="Progression appears after the first race." />
        ) : (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.progression} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="label" stroke="#6B6B6B" fontSize={10} />
                  <YAxis stroke="#6B6B6B" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#15151E", border: "none", borderRadius: 8, color: "#fff" }} />
                  {teamLines
                    .filter((t) => !hiddenLines.has(t))
                    .map((t) => (
                      <Line
                        key={t}
                        type="monotone"
                        dataKey={t}
                        stroke={teamColorFor(t)}
                        strokeWidth={2.5}
                        dot={false}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {teamLines.map((t) => {
                const off = hiddenLines.has(t);
                return (
                  <button
                    key={t}
                    onClick={() =>
                      setHiddenLines((h) => {
                        const n = new Set(h);
                        n.has(t) ? n.delete(t) : n.add(t);
                        return n;
                      })
                    }
                    className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-opacity"
                    style={{ borderColor: teamColorFor(t), opacity: off ? 0.4 : 1, color: "#15151E" }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: teamColorFor(t) }} /> {t}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* PIT EFFICIENCY */}
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {[
          { l: "Fastest Pit Stop", t: fastest?.team, v: fastest ? `${fastest.best.toFixed(2)}s` : "—" },
          { l: "Most Consistent", t: consistent?.team, v: consistent ? `σ ${consistent.std.toFixed(2)}s` : "—" },
          { l: "Average Pit Time", t: fastest?.team, v: fastest ? `${fastest.avg.toFixed(2)}s` : "—" },
        ].map((x) => (
          <div
            key={x.l}
            className="rounded-xl border border-[#E5E5E5] bg-white p-6"
            style={{ borderTop: `4px solid ${x.t ? teamColorFor(x.t) : "#E8002D"}` }}
          >
            <SectionLabel>{x.l}</SectionLabel>
            <div className="mt-2 flex items-end justify-between">
              <span className="text-lg font-bold uppercase tracking-tight text-[#15151E]">{x.t ?? "—"}</span>
              <span className="tabular text-3xl font-extrabold text-[#E8002D]">{x.v}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-[#E5E5E5] bg-white p-6">
        <SectionLabel>Average Pit Time Per Team</SectionLabel>
        {data.pit.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No pit data" message="Pit efficiency appears after a race session." />
          </div>
        ) : (
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={data.pit} margin={{ top: 5, right: 20, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis type="number" stroke="#6B6B6B" fontSize={11} unit="s" />
                <YAxis type="category" dataKey="team" stroke="#6B6B6B" fontSize={10} width={80} />
                <Tooltip contentStyle={{ background: "#15151E", border: "none", borderRadius: 8, color: "#fff" }} cursor={{ fill: "#F5F5F5" }} />
                <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                  {data.pit.map((p) => (
                    <Cell key={p.team} fill={p.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* RELIABILITY */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-6">
          <SectionLabel>Reliability</SectionLabel>
          <h3 className="mt-1 mb-4 text-lg font-bold uppercase tracking-tight text-[#15151E]">
            DNFs Per Team
          </h3>
          {data.loading ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.rows} margin={{ top: 5, right: 10, left: -18, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="name" stroke="#6B6B6B" fontSize={9} interval={0} angle={-35} textAnchor="end" height={60} />
                  <YAxis stroke="#6B6B6B" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#15151E", border: "none", borderRadius: 8, color: "#fff" }} cursor={{ fill: "#F5F5F5" }} />
                  <Bar dataKey="dnfs" radius={[4, 4, 0, 0]} fill="#E8002D" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-6">
          <SectionLabel>Reliability %</SectionLabel>
          <h3 className="mt-1 mb-4 text-lg font-bold uppercase tracking-tight text-[#15151E]">
            Finishing Rate
          </h3>
          {data.loading ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={{ background: "#15151E", border: "none", borderRadius: 8, color: "#fff" }} />
                  <Pie
                    data={data.rows}
                    dataKey="reliability"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={1}
                  >
                    {data.rows.map((r) => (
                      <Cell key={r.name} fill={r.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <TeamDrawer row={selected} onClose={() => setSelected(null)} />
    </main>
  );
}

function TeamsPageWrapper() {
  return (
    <ErrorBoundary label="teams_page">
      <TeamsPage />
    </ErrorBoundary>
  );
}
