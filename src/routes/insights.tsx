import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/clerk-react";

import { AuthGate } from "@/components/AuthGate";
import { InsightCard } from "@/components/InsightCard";
import { PodiumGraphic, type PodiumPrediction } from "@/components/PodiumGraphic";
import { ChatInterface, type ChatMessage } from "@/components/ChatInterface";
import { SectionLabel } from "@/components/Shared";
import { teamColorByName } from "@/lib/api-live";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "AI Insights — PitWall" },
      { name: "description", content: "AI-powered F1 race insights, strategy analysis and predictions." },
      { property: "og:title", content: "AI Insights — PitWall" },
    ],
  }),
  component: InsightsPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";
const RACE_CONTEXT = "2026 Season";

const PRESET_PROMPTS = [
  {
    id: "race_summary",
    icon: "🏁",
    title: "RACE SUMMARY",
    prompt:
      "Give me a concise race summary for the most recent 2026 F1 race: winner, key moments, and overtake count.",
  },
  {
    id: "driver_of_day",
    icon: "⭐",
    title: "DRIVER OF THE DAY",
    prompt:
      "Who was the standout driver in the most recent 2026 F1 race and why? Include their team and the key reason for their performance.",
  },
  {
    id: "strategy_breakdown",
    icon: "🔧",
    title: "STRATEGY BREAKDOWN",
    prompt:
      "Analyse the best and worst tyre strategies from the most recent 2026 F1 race. Include any undercut or overcut moves.",
  },
];

const QUESTION_CHIPS = [
  "Who had the best race pace?",
  "Explain the Safety Car impact",
  "Who made the best strategy call?",
  "Predict next race podium",
];

// Mock insight content shown when the API is unavailable
const MOCK_INSIGHTS: Record<string, React.ReactNode> = {
  race_summary: (
    <>
      <strong className="text-white">Max Verstappen</strong> claimed victory at the Monaco Grand Prix after a dominant 57-lap display. Key moments included a bold undercut by Norris on lap 31 and a dramatic Safety Car on lap 44 that reshuffled positions. The race featured{" "}
      <strong className="text-white">14 overtakes</strong> — above the circuit average.
    </>
  ),
  driver_of_day: (
    <>
      <strong className="text-white">Lando Norris</strong> (McLaren) was the standout performer. Starting P5, he carved through the field on a brilliant one-stop hard strategy, delivered the fastest lap of the race (1:14.082), and pressured the leader throughout the final stint.
    </>
  ),
  strategy_breakdown: (
    <>
      <strong className="text-white">Best:</strong> Norris's undercut on lap 31 — pitting just before the Safety Car window — gained 2.3s net. <br />
      <strong className="text-white">Worst:</strong> Ferrari's late call to stay out on worn mediums cost Leclerc two positions in the final 8 laps. The overcut window closed earlier than the pit wall anticipated.
    </>
  ),
};

const MOCK_DRIVER_COLORS: Record<string, string> = {
  driver_of_day: teamColorByName("McLaren"),
};

// Mock chat responses
const MOCK_RESPONSES: Record<string, string> = {
  "who had the best race pace?":
    "Lando Norris posted the quickest average lap time across all 57 laps at 1:14.8s, edging Verstappen by 0.2s on the medium compound in the second stint.",
  "explain the safety car impact":
    "The Safety Car on lap 44 compressed the field by ~18 seconds, negating Verstappen's gap and forcing all remaining runners onto fresh tyres. Teams on a 1-stop strategy lost the most ground.",
  "who made the best strategy call?":
    "McLaren's call to pit Norris on lap 31 — just before the Virtual Safety Car was triggered — was the move of the race. It brought him out on fresh softs ahead of the Ferrari of Leclerc.",
  "predict next race podium":
    "For the Canadian Grand Prix: P1 Norris (McLaren — strong street circuit form), P2 Verstappen (Red Bull — reliable pace), P3 Russell (Mercedes — Montreal historically suits the W-car's high-downforce config).",
};

function genericMockResponse(question: string): string {
  return `Based on the 2026 season data, ${question.endsWith("?") ? question.slice(0, -1) : question} relates to a broader trend of McLaren's resurgence. Their upgraded floor introduced in Round 9 gave them a consistent 0.3s advantage in sector 2, which has been the decisive factor in recent rounds.`;
}

// ─── Mock podium data ─────────────────────────────────────────────────────────

const MOCK_PODIUM: PodiumPrediction[] = [
  { pos: 1, driver: "L. Norris",     team: "McLaren",   teamColor: teamColorByName("McLaren"),   confidence: 68 },
  { pos: 2, driver: "M. Verstappen", team: "Red Bull",  teamColor: teamColorByName("Red Bull"),  confidence: 71 },
  { pos: 3, driver: "G. Russell",    team: "Mercedes",  teamColor: teamColorByName("Mercedes"),  confidence: 54 },
];

const PODIUM_FACTORS = [
  { icon: "📊", label: "Recent Form",      detail: "Last 5 races pace average" },
  { icon: "⏱",  label: "Qualifying Pace", detail: "Grid position correlation" },
  { icon: "🔧", label: "Tire Strategy",   detail: "Optimal compound window" },
  { icon: "🏟", label: "Circuit Type",    detail: "High-speed vs technical" },
];

// ─── API helpers ──────────────────────────────────────────────────────────────

async function askInsightApi(
  question: string,
  token: string | null,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/insights/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question, raceContext: RACE_CONTEXT }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { answer?: string };
    return data.answer ?? null;
  } catch {
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PulseDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8002D] opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E8002D]" />
    </span>
  );
}

// ─── Main content (auth-gated) ────────────────────────────────────────────────

function InsightsContent() {
  const { getToken } = useAuth();

  // ── Auto-generated insight cards ─────────────────────────────────────────
  const [cardContents, setCardContents] = useState<Record<string, React.ReactNode>>({});
  const [cardLoading, setCardLoading] = useState<Record<string, boolean>>({
    race_summary: true,
    driver_of_day: true,
    strategy_breakdown: true,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getToken().catch(() => null);
      for (const preset of PRESET_PROMPTS) {
        const answer = await askInsightApi(preset.prompt, token);
        if (!active) return;
        setCardContents((prev) => ({
          ...prev,
          [preset.id]: answer ? <>{answer}</> : MOCK_INSIGHTS[preset.id],
        }));
        setCardLoading((prev) => ({ ...prev, [preset.id]: false }));
      }
    })();
    return () => { active = false; };
  }, [getToken]);

  // ── Chat ──────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const msgIdRef = useRef(0);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || chatLoading) return;
      const userMsg: ChatMessage = { id: `${++msgIdRef.current}`, role: "user", text };
      setMessages((m) => [...m, userMsg]);
      setChatInput("");
      setChatLoading(true);

      const token = await getToken().catch(() => null);
      const answer = await askInsightApi(text, token);
      const aiText =
        answer ??
        MOCK_RESPONSES[text.toLowerCase()] ??
        genericMockResponse(text);

      setMessages((m) => [
        ...m,
        { id: `${++msgIdRef.current}`, role: "ai", text: aiText },
      ]);
      setChatLoading(false);
    },
    [chatLoading, getToken],
  );

  const handleChip = (chip: string) => handleSend(chip);

  // ── Podium predictor ──────────────────────────────────────────────────────
  const [podiumKey, setPodiumKey] = useState(0);

  return (
    <main>
      {/* Page header */}
      <div className="bg-[#15151E]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
          <h1 className="flex items-center gap-2 text-xl font-extrabold uppercase tracking-tight text-white md:text-2xl">
            <Sparkles size={22} className="text-[#E8002D]" />
            AI Race Insights
          </h1>
          <p className="mt-1 text-sm text-[#A0A0B0]">
            AI-powered analysis of race strategy, pace, and predictions
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
        {/* ── Auto-insight cards ─────────────────────────────────────────── */}
        <div className="mb-6">
          <SectionLabel>AI Generated</SectionLabel>
          <h2 className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-[#15151E]">
            Race Analysis
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PRESET_PROMPTS.map((preset) => (
            <InsightCard
              key={preset.id}
              icon={preset.icon}
              title={preset.title}
              content={cardContents[preset.id]}
              loading={cardLoading[preset.id]}
              teamColor={MOCK_DRIVER_COLORS[preset.id]}
            />
          ))}
        </div>

        {/* ── Chat interface ─────────────────────────────────────────────── */}
        <div className="mt-8 overflow-hidden rounded-xl bg-[#1E1E2E]">
          {/* Chat header */}
          <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
            <Sparkles size={17} className="text-[#E8002D]" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">
              Ask PitWall AI
            </h3>
            <PulseDot />
            <span className="ml-auto text-[10px] uppercase tracking-wide text-[#A0A0B0]">
              Powered by Gemini
            </span>
          </div>

          {/* Quick-question chips */}
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {QUESTION_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChip(chip)}
                disabled={chatLoading}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#A0A0B0] transition-colors hover:border-[#E8002D] hover:text-white disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages + input */}
          <div className="px-5 pb-5">
            {messages.length === 0 && !chatLoading ? (
              <p className="py-4 text-center text-sm text-[#6B6B6B]">
                Select a question above or type your own below
              </p>
            ) : (
              <ChatInterface
                messages={messages}
                loading={chatLoading}
                inputValue={chatInput}
                onInputChange={setChatInput}
                onSend={handleSend}
                placeholder="Ask anything about this race..."
              />
            )}

            {/* Standalone input when no messages yet */}
            {messages.length === 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#0D0D1A] px-3 py-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && chatInput.trim()) handleSend(chatInput.trim());
                  }}
                  placeholder="Ask anything about this race..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-[#6B6B6B] focus:outline-none"
                />
                <button
                  onClick={() => chatInput.trim() && handleSend(chatInput.trim())}
                  disabled={!chatInput.trim() || chatLoading}
                  className="grid h-8 w-8 place-items-center rounded-md bg-[#E8002D] text-white transition-colors hover:bg-[#CC0027] disabled:opacity-40"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Podium Predictor ───────────────────────────────────────────── */}
        <div className="mt-10">
          <div className="overflow-hidden rounded-xl bg-[#1E1E2E]">
            {/* Strip header */}
            <div className="bg-[#15151E] px-5 py-4">
              <SectionLabel dark>AI Analysis</SectionLabel>
              <h2 className="mt-1 text-lg font-extrabold uppercase tracking-tight text-white">
                Podium Predictor
              </h2>
              <p className="mt-0.5 text-xs text-[#A0A0B0]">
                Based on last 5 races + qualifying pace
              </p>
            </div>

            <div className="px-5 pb-6 pt-2">
              {/* Podium graphic */}
              <motion.div key={podiumKey}>
                <PodiumGraphic predictions={MOCK_PODIUM} />
              </motion.div>

              {/* Factor cards */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PODIUM_FACTORS.map((f) => (
                  <div
                    key={f.label}
                    className="rounded-lg bg-[#15151E] px-3 py-3 text-center"
                  >
                    <span className="text-xl">{f.icon}</span>
                    <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {f.label}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#A0A0B0]">{f.detail}</p>
                  </div>
                ))}
              </div>

              {/* Regenerate button */}
              <div className="mt-5 flex justify-center">
                <button
                  onClick={() => setPodiumKey((k) => k + 1)}
                  className="inline-flex items-center gap-2 rounded-md border border-[#E8002D] px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-[#E8002D] transition-colors hover:bg-[#E8002D] hover:text-white"
                >
                  <RefreshCw size={13} />
                  Regenerate Prediction
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function InsightsPage() {
  return (
    <AuthGate>
      <InsightsContent />
    </AuthGate>
  );
}
