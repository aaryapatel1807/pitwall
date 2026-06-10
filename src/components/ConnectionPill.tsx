import { AnimatePresence, motion } from "framer-motion";
import type { ConnMode } from "@/hooks/use-race-socket";

const CONFIG: Record<ConnMode, { label: string; dot: string; bg: string; text: string }> = {
  socket: { label: "LIVE — Socket connected", dot: "#39B54A", bg: "#0E2A14", text: "#39B54A" },
  polling: { label: "POLLING — 5s refresh", dot: "#FFB020", bg: "#2A2110", text: "#FFB020" },
  disconnected: { label: "DISCONNECTED — Reconnecting", dot: "#E8002D", bg: "#2A0E14", text: "#FF6B81" },
};

/** Floating connection status pill, bottom-left of /live. */
export function ConnectionPill({ mode }: { mode: ConnMode }) {
  const c = CONFIG[mode];
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50">
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide shadow-lg"
          style={{ backgroundColor: c.bg, color: c.text }}
        >
          <span
            className={`h-2 w-2 rounded-full ${mode !== "polling" ? "animate-pit-pulse" : ""}`}
            style={{ backgroundColor: c.dot }}
          />
          {c.label}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
