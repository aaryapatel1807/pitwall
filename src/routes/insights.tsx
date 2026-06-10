import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Send, Sparkles } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { SectionLabel } from "@/components/Shared";

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

const sampleConversation = [
  { role: "user", text: "Why did Norris gain a position?" },
  {
    role: "ai",
    text: "Norris pitted under the VSC on lap 31, emerging ahead of Leclerc on fresher softs. His undercut gained approximately 2.3 seconds in the pit phase.",
  },
  { role: "user", text: "Who has the best tire strategy right now?" },
  {
    role: "ai",
    text: "Hamilton is on a one-stop hard strategy with strong degradation numbers. If the gap holds, he could undercut Sainz in the final 12 laps.",
  },
];

function InsightsContent() {
  const chips = ["Race Summary", "Tire Strategy", "Predict Finish", "Pit Window"];
  const [input, setInput] = useState("");

  return (
    <main>
      <div className="bg-[#15151E]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
          <h1 className="flex items-center gap-2 text-xl font-extrabold uppercase tracking-tight text-white md:text-2xl">
            <Sparkles size={22} className="text-[#E8002D]" /> AI Race Insights
          </h1>
          <p className="mt-1 text-sm text-[#A0A0B0]">
            Ask anything about the race — strategy, pace, and predictions
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[900px] px-4 py-8 lg:px-6">
        <div className="flex flex-col overflow-hidden rounded-xl bg-[#1E1E2E]">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
            <Sparkles size={18} className="text-[#E8002D]" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">AI Insights</h3>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-[#A0A0B0]">
              Powered by Gemini
            </span>
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
            {sampleConversation.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#E8002D] px-4 py-2.5 text-sm text-white">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[#15151E] px-4 py-2.5 text-sm text-[#A0A0B0]">
                    {m.text}
                  </div>
                </div>
              ),
            )}
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

        <div className="mt-5">
          <SectionLabel>Tip</SectionLabel>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            Insights are generated from live timing, tire data and historical pace.
          </p>
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
