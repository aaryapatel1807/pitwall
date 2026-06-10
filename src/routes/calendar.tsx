import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SectionLabel, LoadingSkeleton, EmptyState } from "@/components/Shared";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAutoRefresh, useUpdatedBadge, getSeason, getRaceResult, flagFor, teamColorByName, type ErgastRace, TTL } from "@/lib/api-live";

// Local alias so the rest of the file keeps minimal changes
type ErgastRaceFull = ErgastRace;

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "PitWall — Race Calendar" },
      { name: "description", content: "The full 2025 FIA Formula One World Championship race calendar." },
      { property: "og:title", content: "PitWall — Race Calendar" },
    ],
  }),
  component: CalendarWrapper,
});

const FLAGS: Record<string, string> = {
  Bahrain: "🇧🇭", "Saudi Arabia": "🇸🇦", Australia: "🇦🇺", Japan: "🇯🇵", China: "🇨🇳",
  USA: "🇺🇸", "United States": "🇺🇸", Italy: "🇮🇹", Monaco: "🇲🇨", Canada: "🇨🇦",
  Spain: "🇪🇸", Austria: "🇦🇹", UK: "🇬🇧", "United Kingdom": "🇬🇧", Hungary: "🇭🇺",
  Belgium: "🇧🇪", Netherlands: "🇳🇱", Azerbaijan: "🇦🇿", Singapore: "🇸🇬", Mexico: "🇲🇽",
  Brazil: "🇧🇷", Qatar: "🇶🇦", UAE: "🇦🇪", "United Arab Emirates": "🇦🇪", France: "🇫🇷",
  Germany: "🇩🇪", Portugal: "🇵🇹", Turkey: "🇹🇷", Russia: "🇷🇺", "Saudi": "🇸🇦",
};

function flagFor(country?: string): string {
  return (country && FLAGS[country]) || "🏁";
}

function raceTime(r: ErgastRaceFull): number {
  return new Date(`${r.date}T${r.time ?? "13:00:00Z"}`).getTime();
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  let diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000); diff -= d * 86400000;
  const h = Math.floor(diff / 3600000); diff -= h * 3600000;
  const m = Math.floor(diff / 60000); diff -= m * 60000;
  const s = Math.floor(diff / 1000);
  return { d, h, m, s };
}

function CountdownStrip({ target }: { target: number }) {
  const { d, h, m, s } = useCountdown(target);
  const parts = [
    { v: d, l: "Days" }, { v: h, l: "Hrs" }, { v: m, l: "Min" }, { v: s, l: "Sec" },
  ];
  return (
    <div className="mt-3 flex gap-2">
      {parts.map((p) => (
        <div key={p.l} className="flex-1 rounded-md bg-[#15151E] px-2 py-2 text-center">
          <div className="tabular text-xl font-extrabold text-white">{String(p.v).padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-wide text-[#A0A0B0]">{p.l}</div>
        </div>
      ))}
    </div>
  );
}

type Status = "completed" | "upcoming" | "next" | "live";

const CIRCUIT_PATH =
  "M20 80 C20 40 60 30 100 35 C150 42 160 20 200 25 C250 30 260 70 230 85 C200 100 150 80 110 90 C70 100 20 100 20 80 Z";

function CircuitPanel({ race }: { race: ErgastRaceFull }) {
  return (
    <div className="pit-fade mt-6 rounded-xl border border-[#E5E5E5] bg-white p-6">
      <SectionLabel>Circuit</SectionLabel>
      <div className="mt-2 grid gap-6 md:grid-cols-[260px_1fr] md:items-center">
        <svg viewBox="0 0 260 120" className="w-full">
          <path d={CIRCUIT_PATH} fill="none" stroke="#15151E" strokeWidth={4} strokeLinejoin="round" />
          <circle cx="20" cy="80" r="5" fill="#E8002D" />
        </svg>
        <div>
          <h3 className="text-2xl font-extrabold uppercase tracking-tight text-[#15151E]">
            {race.Circuit.circuitName}
          </h3>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            {race.Circuit.Location?.locality}, {race.Circuit.Location?.country}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { l: "Laps", v: "—" },
              { l: "Lap Record", v: "—" },
              { l: "DRS Zones", v: "—" },
            ].map((x) => (
              <div key={x.l} className="rounded-lg bg-[#F5F5F5] p-3 text-center">
                <div className="tabular text-lg font-extrabold text-[#15151E]">{x.v}</div>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-[#6B6B6B]">{x.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const BADGE: Record<Status, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-[#E5E5E5] text-[#15151E]" },
  upcoming: { label: "Upcoming", cls: "border border-[#A0A0B0] text-[#6B6B6B]" },
  next: { label: "Next Race", cls: "bg-[#E8002D] text-white" },
  live: { label: "Live Now", cls: "bg-[#E8002D] text-white" },
};

function CalendarPage() {
  const [races, setRaces] = useState<ErgastRaceFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [active, setActive] = useState<ErgastRaceFull | null>(null);
  // Fetch winner for completed races lazily
  const [winners, setWinners] = useState<Record<string, string>>({});

  const { data: season, loading: seasonLoading, error: seasonError, lastUpdated } =
    useAutoRefresh(() => getSeason(2026), [], TTL.CALENDAR);

  useEffect(() => {
    if (season) { setRaces(season); setLoading(false); setError(false); }
    else if (!seasonLoading) { setError(true); setLoading(false); }
    else { setLoading(seasonLoading); }
  }, [season, seasonLoading, seasonError]);

  // Fetch P1 driver for completed rounds (lazy, non-blocking)
  useEffect(() => {
    if (!races.length) return;
    const now = Date.now();
    const completed = races.filter((r) => raceTime(r) < now);
    let active = true;
    (async () => {
      for (const r of completed) {
        const rnd = parseInt(r.round, 10);
        if (winners[r.round]) continue;
        const result = await getRaceResult(2026, rnd);
        if (!active) return;
        const p1 = result?.Results?.[0];
        if (p1) {
          setWinners((prev) => ({
            ...prev,
            [r.round]: `${p1.Driver.givenName[0]}. ${p1.Driver.familyName}`,
          }));
        }
      }
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [races]);

  const updatedText = useUpdatedBadge(lastUpdated);

  const now = Date.now();
  const { nextRound, completedCount } = useMemo(() => {
    const upcoming = races.filter((r) => raceTime(r) > now).sort((a, b) => raceTime(a) - raceTime(b));
    const completed = races.filter((r) => raceTime(r) <= now);
    return { nextRound: upcoming[0]?.round, completedCount: completed.length };
  }, [races, now]);

  const statusOf = (r: ErgastRaceFull): Status => {
    const t = raceTime(r);
    const end = t + 2 * 3600 * 1000;
    if (now >= t && now <= end) return "live";
    if (r.round === nextRound) return "next";
    if (t <= now) return "completed";
    return "upcoming";
  };

  return (
    <main>
      <div className="pit-noise bg-[#15151E]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
          <h1 className="text-xl font-extrabold uppercase tracking-tight text-white md:text-2xl">
            2025 FIA Formula One World Championship
          </h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-[#A0A0B0]">
            {races.length && completedCount >= races.length
              ? `Season Complete · ${races.length} Rounds`
              : `Round ${Math.min(completedCount + 1, races.length || 24)} of ${races.length || 24}`}
          </p>
        </div>
      </div>
      {/* spacer end */}

      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
        {loading ? (
          <LoadingSkeleton rows={8} />
        ) : error || races.length === 0 ? (
          <EmptyState title="No calendar data" message="The 2025 schedule is unavailable right now." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {races.map((r) => {
              const status = statusOf(r);
              const t = raceTime(r);
              const isNext = status === "next";
              const completed = status === "completed";
              const daysUntil = Math.ceil((t - now) / 86400000);
              const badge = BADGE[status];
              return (
                <div
                  key={r.round}
                  onMouseEnter={() => setActive(r)}
                  onClick={() => setActive(r)}
                  className={`pit-fade flex cursor-pointer items-stretch justify-between gap-4 rounded-xl border bg-white p-5 transition-shadow hover:shadow-md ${
                    isNext ? "border-l-4 border-[#E8002D] md:p-6" : "border-[#E5E5E5]"
                  } ${status === "upcoming" ? "opacity-80" : ""}`}
                >
                  <div>
                    <div className="tabular text-3xl font-extrabold text-[#E5E5E5]">
                      {String(r.round).padStart(2, "0")}
                    </div>
                    <h3 className="mt-1 text-base font-extrabold uppercase tracking-tight text-[#15151E]">
                      {r.Circuit.circuitName}
                    </h3>
                    <p className="mt-0.5 text-sm text-[#6B6B6B]">
                      {flagFor(r.Circuit.Location?.country)} {r.Circuit.Location?.country}
                    </p>
                    <p className="text-xs text-[#A0A0B0]">{r.Circuit.Location?.locality}</p>

                    {completed ? (
                      <Link
                        to="/live"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#E8002D] hover:text-[#CC0027]"
                      >
                        View Results <ArrowRight size={13} />
                      </Link>
                    ) : (
                      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">
                        In {Math.max(0, daysUntil)} days
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end justify-between text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}
                    >
                      {(status === "next" || status === "live") && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pit-pulse" />
                      )}
                      {badge.label}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#15151E]">{fmtDate(t)}</p>
                      {isNext && <CountdownStrip target={t} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {active && <CircuitPanel race={active} />}
      </div>
    </main>
  );
}

function CalendarWrapper() {
  return (
    <ErrorBoundary label="calendar_page">
      <CalendarPage />
    </ErrorBoundary>
  );
}
