import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SectionLabel } from "@/components/Shared";
import {
  useAutoRefresh,
  useUpdatedBadge,
  getLastNRaceResults,
  getDriverStandings,
  getConstructorStandings,
  flagFor,
  teamColorByName,
  type ErgastRace,
  type ErgastDriverStanding,
  type ErgastConstructorStanding,
  TTL,
} from "@/lib/api-live";
import { of1, latestRaceSession, nextMeeting, type OF1Session, type OF1Meeting } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PitWall — F1 Race Intelligence Hub" },
      { name: "description", content: "Real-time F1 data, AI insights, and strategy simulation in one race intelligence hub." },
      { property: "og:title", content: "PitWall — F1 Race Intelligence Hub" },
      { property: "og:description", content: "Real-time F1 data, AI insights, and strategy simulation." },
    ],
  }),
  component: Index,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }

function useCountdown(target: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  let diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000); diff -= d * 86400000;
  const h = Math.floor(diff / 3600000);  diff -= h * 3600000;
  const m = Math.floor(diff / 60000);    diff -= m * 60000;
  const s = Math.floor(diff / 1000);
  return { d, h, m, s };
}

// ─── Last-updated badge ───────────────────────────────────────────────────────

function UpdatedBadge({ lastUpdated }: { lastUpdated: Date | null }) {
  const text = useUpdatedBadge(lastUpdated);
  if (!text) return null;
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A0A0B0]">
      {text}
    </span>
  );
}

// ─── OpenF1 next-race + session hook ─────────────────────────────────────────

interface OpenF1Data {
  latest: OF1Session | null;
  next: OF1Meeting | null;
  loading: boolean;
}

function useOpenF1Data(): OpenF1Data {
  const [state, setState] = useState<OpenF1Data>({ latest: null, next: null, loading: true });
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const [sessionsRes, meetingsRes] = await Promise.all([
          of1.raceSessions(2026),
          of1.meetings(2026),
        ]);
        await delay(0);
        if (!active) return;
        setState({
          latest: latestRaceSession(sessionsRes.data),
          next: nextMeeting(meetingsRes.data),
          loading: false,
        });
      } catch {
        if (active) setState((s) => ({ ...s, loading: false }));
      }
    })();
    return () => { active = false; };
  }, []);
  return state;
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatsStrip({
  driverStandings,
  constructorStandings,
  recentRaces,
}: {
  driverStandings: ErgastDriverStanding[] | null;
  constructorStandings: ErgastConstructorStanding[] | null;
  recentRaces: ErgastRace[] | null;
}) {
  const leader = driverStandings?.[0];
  const topConstructor = constructorStandings?.[0];
  const lastRace = recentRaces?.[recentRaces.length - 1];

  const stats = [
    { label: "Championship Leader", value: leader ? `${leader.Driver.givenName[0]}. ${leader.Driver.familyName}` : "—" },
    { label: "Leader Points", value: leader?.points ?? "—" },
    { label: "Top Constructor", value: topConstructor?.Constructor.name ?? "—" },
    { label: "Last Race", value: lastRace?.raceName ?? "—" },
  ];

  return (
    <div className="border-t border-white/10">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 divide-x divide-white/10 px-4 lg:grid-cols-4 lg:px-6">
        {stats.map((s) => (
          <div key={s.label} className="px-4 py-5">
            <SectionLabel dark>{s.label}</SectionLabel>
            <p className="mt-1 text-lg font-bold text-white">{String(s.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Next Race card ───────────────────────────────────────────────────────────

function NextRaceCard({ of1Data, lastUpdated }: { of1Data: OpenF1Data; lastUpdated: Date | null }) {
  const targetTs = of1Data.next ? new Date(of1Data.next.date_start).getTime() : null;
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
        <UpdatedBadge lastUpdated={lastUpdated} />
      </div>

      {of1Data.loading ? (
        <div className="mt-3 space-y-3">
          <div className="h-7 w-2/3 animate-pulse rounded bg-[#E5E5E5]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[#E5E5E5]" />
          <div className="grid grid-cols-4 gap-2">
            {parts.map((p) => <div key={p.l} className="h-14 animate-pulse rounded bg-[#E5E5E5]" />)}
          </div>
        </div>
      ) : of1Data.next ? (
        <>
          <h2 className="mt-2 text-2xl font-extrabold uppercase tracking-tight text-[#15151E]">
            {of1Data.next.meeting_name}
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#6B6B6B]">
            {of1Data.next.country_name} ·{" "}
            {new Date(of1Data.next.date_start).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
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
            <span className="tabular text-sm font-bold text-[#15151E]">{of1Data.next.circuit_short_name}</span>
          </div>
        </>
      ) : (
        <div className="mt-3">
          <h2 className="text-2xl font-extrabold uppercase tracking-tight text-[#15151E]">Season Complete</h2>
          <p className="mt-1 text-sm font-semibold text-[#6B6B6B]">No upcoming races scheduled</p>
        </div>
      )}
    </div>
  );
}

// ─── Recent race cards ────────────────────────────────────────────────────────

function RaceCards({
  races,
  loading,
  lastUpdated,
}: {
  races: ErgastRace[] | null;
  loading: boolean;
  lastUpdated: Date | null;
}) {
  if (loading) {
    return (
      <div className="grid gap-5 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
            <div className="h-11 animate-pulse bg-[#15151E]" />
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((j) => <div key={j} className="h-6 animate-pulse rounded bg-[#E5E5E5]" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const cards = races && races.length > 0 ? races : [];

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-[#F5F5F5] px-6 py-10 text-center">
        <p className="text-sm text-[#6B6B6B]">No completed races yet for this season.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {[...cards].reverse().map((r, i) => {
        const top3 = (r.Results ?? []).slice(0, 3);
        const country = r.Circuit.Location?.country;
        const flag = flagFor(country);
        return (
          <div
            key={r.round}
            className="pit-fade-up overflow-hidden rounded-xl border border-[#E5E5E5] bg-white"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="flex items-center justify-between bg-[#15151E] px-5 py-3">
              <h3 className="text-sm font-bold uppercase tracking-tight text-white">{r.raceName}</h3>
              <span className="text-lg">{flag}</span>
            </div>
            <div className="p-5">
              <div className="space-y-2">
                {top3.length > 0 ? top3.map((res, idx) => (
                  <div key={res.Driver.driverId} className="flex items-center gap-3">
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-[#15151E]"
                      style={{ backgroundColor: idx === 0 ? "#FFD700" : idx === 1 ? "#C0C0C0" : "#CD7F32" }}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: teamColorByName(res.Constructor.name) }}
                    />
                    <span className="text-sm font-semibold text-[#15151E]">
                      {res.Driver.givenName[0]}. {res.Driver.familyName}
                    </span>
                  </div>
                )) : (
                  <p className="text-xs text-[#A0A0B0]">Results pending</p>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#E5E5E5] pt-3">
                <span className="text-xs font-semibold text-[#6B6B6B]">
                  Round {r.round} · {new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <Link
                  to="/live"
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#E8002D] hover:text-[#CC0027]"
                >
                  View <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function Index() {
  const of1Data = useOpenF1Data();

  const { data: recentRaces, loading: racesLoading, lastUpdated: racesUpdated } =
    useAutoRefresh(() => getLastNRaceResults(2026, 3), [], TTL.RACE_RESULT);

  const { data: driverStandings, lastUpdated: standingsUpdated } =
    useAutoRefresh(() => getDriverStandings(2026), [], TTL.STANDINGS);

  const { data: constructorStandings } =
    useAutoRefresh(() => getConstructorStandings(2026), [], TTL.STANDINGS);

  const lastUpdated = useMemo(
    () => racesUpdated ?? standingsUpdated,
    [racesUpdated, standingsUpdated],
  );

  return (
    <main>
      {/* HERO */}
      <section className="bg-[#15151E]">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-16 lg:grid-cols-[1.4fr_1fr] lg:px-6 lg:py-20">
          <div className="pit-fade-up">
            <SectionLabel dark>2026 FIA Formula One World Championship</SectionLabel>
            <h1 className="mt-3 text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-white md:text-7xl">
              Race Intelligence
              <br />Hub
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
          </div>

          <NextRaceCard of1Data={of1Data} lastUpdated={lastUpdated} />
        </div>

        <StatsStrip
          driverStandings={driverStandings}
          constructorStandings={constructorStandings}
          recentRaces={recentRaces}
        />
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
          <UpdatedBadge lastUpdated={racesUpdated} />
        </div>
        <RaceCards races={recentRaces} loading={racesLoading} lastUpdated={racesUpdated} />
      </section>
    </main>
  );
}
