import { useEffect, useState, type ReactNode } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";

/** Fade + slight upward slide page transition between routes (200ms, ease-out). */
export function PageTransition({ children }: { children?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // On the server and first client render, output plain content (no opacity:0
  // wrapper) so SSR markup matches and content is never stuck invisible.
  if (!mounted) {
    return <>{children ?? <Outlet />}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {children ?? <Outlet />}
      </motion.div>
    </AnimatePresence>
  );
}
