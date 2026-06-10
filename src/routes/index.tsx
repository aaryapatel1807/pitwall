import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ArrowRight } from "lucide-react";
import { SectionLabel } from "@/components/Shared";
import { recentRaces } from "@/lib/mock-data";
import {
  of1,
  latestRaceSession,
  nextMeeting,
  timeAgo,
  type OF1Session,
  type OF1Meeting,
} from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PitWall — F1 Race Intelligence Hub" },
      {
        name: "description",
        content: "Real-time F1 data, AI insights, and strategy simulation in one race intelligence hub.",
      },
      { property: "og:title", content: "PitWall — F1 Race Intelligence Hub" },
      {
        property: "og:description",
        content: "Real-time F1 data, AI insights, and strategy simulation.",
      },
    ],
  }),
  component: Index,
});

const stats = [
  { label: "Race Leader", value: "Max Verstappen" },
  { label: "Fastest Lap", value: "L. Norris 1:12.345" },
  { label: "Last Pit", value: "C. Leclerc Lap 28" },
  { label: "Safety Car", value: "None" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ---------- Hooks ----------

interface HomeData {
  latest: OF1Session | null;
  latestRound: number;
  next: OF1Meeting | null;
  top3: { pos: number; name: string }[];
  ts: number;
  loading: boolean;
  error: boolean;
  stale: boolean;
}

function useHomeData(): HomeData {
  const [state, setState] = useState<HomeData>({
    latest: null,
    latestRound: 0,
    next: null,
    top3: [],
    ts: Date.now(),
    loading: true,
    error: false,
    stale: false,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sessionsRes, meetingsRes] = await Promise.all([
          of1.raceSessions(2025),
          of1.meetings(2025),
        ]);
        const sorted = [...sessionsRes.data].sort(
          (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime(),
        );
        const latest = latestRaceSession(sessionsRes.data);
        const latestRound = latest ? sorted.findIndex((s) => s.session_key === latest.session_key) + 1 : 0;
        const next = nextMeeting(meetingsRes.data);

        let top3: { pos: number; name: string }[] = [];
        if (latest) {
          try {
            const [posRes, drvRes] = await Promise.all([
              of1.positions(latest.session_key),
              of1.drivers(latest.session_key),
            ]);
            const nameByNum = new Map(drvRes.data.map((d) => [d.driver_number, d.full_name]));
            // final position per driver = latest dated entry
            const finalByDriver = new Map<number, { position: number; date: string }>();
            for (const p of posRes.data) {
              const prev = finalByDriver.get(p.driver_number);
              if (!prev || new Date(p.date) > new Date(prev.date)) {
                finalByDriver.set(p.driver_number, { position: p.position, date: p.date });
              }
            }
            top3 = [...finalByDriver.entries()]
              .map(([num, v]) => ({ pos: v.position, name: nameByNum.get(num) ?? `#${num}` }))
              .filter((r) => r.pos >= 1 && r.pos <= 3)
              .sort((a, b) => a.pos - b.pos);
          } catch {
            /* keep top3 empty -> fall back to mock card */
          }
        }

        if (!active) return;
        setState({
          latest,
          latestRound,
          next,
          top3,
          ts: Math.min(sessionsRes.ts, meetingsRes.ts),
          loading: false,
          error: false,
          stale: sessionsRes.stale || meetingsRes.stale,
        });
      } catch (e) {
        console.warn("[PitWall][home] failed", e);
        if (active) setState((s) => ({ ...s, loading: false, error: true }));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}

function useCountdown(target: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  let diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  diff -= d * 86400000;
  const h = Math.floor(diff / 3600000);
  diff -= h * 3600000;
  const m = Math.floor(diff / 60000);
  diff -= m * 60000;
  const s = Math.floor(diff / 1000);
  return { d, h, m, s };
}

// ---------- UI pieces ----------

function Pulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/10 ${className}`} />;
}

function ErrorCard() {
  return (
    <div className="rounded-md border border-[#E8002D]/50 bg-[#E8002D]/5 px-4 py-3 text-xs font-semibold text-[#E8002D]">
      Unable to fetch live data — showing cached results
    </div>
  );
}

function UpdatedBadge({ ts, stale }: { ts: number; stale?: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A0A0B0]">
      {stale ? "Cached · " : "Updated "}
      {timeAgo(ts)}
    </span>
  );
}

function NextRaceCard({ data }: { data: HomeData }) {
  const targetTs = data.next ? new Date(data.next.date_start).getTime() : null;
  const cd = useCountdown(targetTs);

  const parts = [
    { v: pad(cd?.d ?? 0), l: "Days" },
    { v: pad(cd?.h ?? 0), l: "Hrs" },
    { v: pad(cd?.m ?? 0), l: "Min" },
    { v: pad(cd?.s ?? 0), l: "Sec" },
  ];

  return (
    <div className="pit-fade-up rounded-xl bg-white p-6 shadow-2xl" style={{ animationDelay: "0.15s" }}>
      <div className="flex items-center justify-between">
        <SectionLabel>Next Race</SectionLabel>
        {!data.loading && !data.error && <UpdatedBadge ts={data.ts} stale={data.stale} />}
      </div>

      {data.loading ? (
        <div className="mt-3 space-y-3">
          <div className="h-7 w-2/3 animate-pulse rounded bg-[#E5E5E5]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[#E5E5E5]" />
          <div className="grid grid-cols-4 gap-2">
            {parts.map((p) => (
              <div key={p.l} className="h-14 animate-pulse rounded bg-[#E5E5E5]" />
            ))}
          </div>
        </div>
      ) : data.next ? (
        <>
          <h2 className="mt-2 text-2xl font-extrabold uppercase tracking-tight text-[#15151E]">
            {data.next.meeting_name}
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#6B6B6B]">
            {data.next.country_name} ·{" "}
            {new Date(data.next.date_start).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <div className="mt-5 flex gap-2">
            {parts.map((p) => (
              <div key={p.l} className="flex-1 rounded-md bg-[#15151E] px-2 py-2 text-center">
                <div className="tabular text-2xl font-extrabold text-white">{p.v}</div>
                <div className="text-[10px] uppercase tracking-wide text-[#A0A0B0]">{p.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between rounded-md bg-[#F5F5F5] px-4 py-3">
            <span className="text-xs font-semibold uppercase text-[#6B6B6B]">Circuit</span>
            <span className="tabular text-sm font-bold text-[#15151E]">
              {data.next.circuit_short_name}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-3">
          <h2 className="text-2xl font-extrabold uppercase tracking-tight text-[#15151E]">
            Season Complete
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#6B6B6B]">No upcoming races scheduled</p>
        </div>
      )}
    </div>
  );
}

function Index() {
  const data = useHomeData();

  // Featured latest-race card data (falls back to first mock race)
  const featured = useMemo(() => {
    if (data.latest && data.top3.length === 3) {
      return {
        circuit: `${data.latest.country_name} Grand Prix`,
        flag: "🏁",
        round: data.latestRound,
        date: new Date(data.latest.date_start).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        p1: data.top3[0].name,
        p2: data.top3[1].name,
        p3: data.top3[2].name,
        live: true as const,
      };
    }
    return null;
  }, [data]);

  const cards = featured ? [featured, ...recentRaces.slice(0, 2)] : recentRaces;

  return (
    <main>
      {/* HERO */}
      <section className="bg-[#15151E]">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-16 lg:grid-cols-[1.4fr_1fr] lg:px-6 lg:py-20">
          <div className="pit-fade-up">
            <SectionLabel dark>2025 FIA Formula One World Championship</SectionLabel>
            <h1 className="mt-3 text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-white md:text-7xl">
              Race Intelligence
              <br />
              Hub
            </h1>
            <div className="mt-5 h-1 w-40 bg-[#E8002D]" />
            <p className="mt-5 max-w-md text-lg text-[#A0A0B0]">
              Real-time F1 data, AI insights, strategy simulation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/live"
                className="inline-flex items-center gap-2 rounded-md bg-[#E8002D] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#CC0027]"
              >
                Go to Live Center <ArrowRight size={16} />
              </Link>
              <Link
                to="/strategy"
                className="inline-flex items-center gap-2 rounded-md border border-white/20 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10"
              >
                Strategy Simulator
              </Link>
            </div>
            {data.error && (
              <div className="mt-6 max-w-md">
                <ErrorCard />
              </div>
            )}
          </div>

          <NextRaceCard data={data} />
        </div>

        {/* STATS STRIP */}
        <div className="border-t border-white/10">
          <div className="mx-auto grid max-w-[1400px] grid-cols-2 divide-x divide-white/10 px-4 lg:grid-cols-4 lg:px-6">
            {stats.map((s) => (
              <div key={s.label} className="px-4 py-5">
                <SectionLabel dark>{s.label}</SectionLabel>
                <p className="mt-1 text-lg font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECENT RACES */}
      <section className="mx-auto max-w-[1400px] px-4 py-14 lg:px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <SectionLabel>Latest Results</SectionLabel>
            <h2 className="mt-1 text-3xl font-extrabold uppercase tracking-tight text-[#15151E]">
              Recent Races
            </h2>
          </div>
          {!data.loading && !data.error && featured && <UpdatedBadge ts={data.ts} stale={data.stale} />}
        </div>

        {data.loading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
                <div className="h-11 animate-pulse bg-[#15151E]" />
                <div className="space-y-3 p-5">
                  <div className="h-6 animate-pulse rounded bg-[#E5E5E5]" />
                  <div className="h-6 animate-pulse rounded bg-[#E5E5E5]" />
                  <div className="h-6 animate-pulse rounded bg-[#E5E5E5]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {cards.map((r, i) => (
              <div
                key={r.circuit}
                className="pit-fade-up overflow-hidden rounded-xl border border-[#E5E5E5] bg-white"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="flex items-center justify-between bg-[#15151E] px-5 py-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-white">
                    {r.circuit}
                    {"live" in r && r.live && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8002D]/20 px-2 py-0.5 text-[9px] font-bold text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#E8002D]" /> LIVE
                      </span>
                    )}
                  </h3>
                  <span className="text-lg">{r.flag}</span>
                </div>
                <div className="p-5">
                  <div className="space-y-2">
                    {[
                      { p: "1", n: r.p1, c: "#FFD700" },
                      { p: "2", n: r.p2, c: "#C0C0C0" },
                      { p: "3", n: r.p3, c: "#CD7F32" },
                    ].map((row) => (
                      <div key={row.p} className="flex items-center gap-3">
                        <span
                          className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-[#15151E]"
                          style={{ backgroundColor: row.c }}
                        >
                          {row.p}
                        </span>
                        <span className="text-sm font-semibold text-[#15151E]">{row.n}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#E5E5E5] pt-3">
                    <span className="text-xs font-semibold text-[#6B6B6B]">
                      Round {r.round} · {r.date}
                    </span>
                    <Link
                      to="/live"
                      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#E8002D] hover:text-[#CC0027]"
                    >
                      View Race <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
