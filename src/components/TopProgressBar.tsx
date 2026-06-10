import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";

/** Thin red progress bar at the top of the page, YouTube-style, on route change. */
export function TopProgressBar() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isLoading = useRouterState({
    select: (s) => s.status === "pending" || s.isLoading || s.isTransitioning,
  });

  // Client-only to avoid SSR hydration mismatch.
  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed left-0 top-0 z-[60] h-[3px] bg-[#E8002D]"
          initial={{ width: "0%", opacity: 1 }}
          animate={{ width: "90%" }}
          exit={{ width: "100%", opacity: 0 }}
          transition={{ width: { duration: 0.4, ease: "easeOut" }, opacity: { duration: 0.2 } }}
        />
      )}
    </AnimatePresence>
  );
}
