import { useState } from "react";
import { Link, ClientOnly } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { useLiveSession } from "@/hooks/use-live-session";

const navLinks = [
  { to: "/live", label: "Live" },
  { to: "/drivers", label: "Drivers" },
  { to: "/teams", label: "Teams" },
  { to: "/calendar", label: "Calendar" },
  { to: "/strategy", label: "Strategy" },
  { to: "/insights", label: "Insights" },
];

function LiveBadge() {
  const live = useLiveSession();
  if (!live) return null;
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#E8002D]/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
      <span className="h-2 w-2 rounded-full bg-[#E8002D] animate-pit-pulse" />
      Live
    </span>
  );
}

function AuthControls() {
  return (
    <ClientOnly
      fallback={
        <button className="rounded-md border border-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[#E8002D]">
          Sign In
        </button>
      }
    >
      <SignedOut>
        <SignInButton mode="modal">
          <button className="rounded-md border border-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[#E8002D] transition-colors hover:bg-white/10">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <div className="flex items-center gap-3">
          <Link
            to="/strategy"
            className="text-xs font-bold uppercase tracking-wide text-[#A0A0B0] transition-colors hover:text-white"
          >
            My PitWall
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </SignedIn>
    </ClientOnly>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#15151E]">
      <nav className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 lg:px-6">
        <Link to="/" className="flex items-center md:gap-0" onClick={() => setOpen(false)}>
          <span className="text-xl font-extrabold uppercase tracking-tight text-white">PIT</span>
          <span className="mx-[3px] h-1.5 w-1.5 rounded-full bg-[#E8002D]" />
          <span className="text-xl font-extrabold uppercase tracking-tight text-white">WALL</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="relative px-4 py-[18px] text-sm font-semibold uppercase tracking-wide text-[#A0A0B0] transition-colors hover:text-white"
              activeProps={{
                className:
                  "relative px-4 py-[18px] text-sm font-semibold uppercase tracking-wide text-white border-b-[3px] border-[#E8002D]",
              }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <LiveBadge />
          <AuthControls />
        </div>

        <button
          className="text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile slide-in drawer from the right */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[55] md:hidden">
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="absolute right-0 top-0 flex h-full w-72 max-w-[80vw] flex-col bg-[#15151E] shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
                <span className="flex items-center">
                  <span className="text-lg font-extrabold uppercase tracking-tight text-white">PIT</span>
                  <span className="mx-[3px] h-1.5 w-1.5 rounded-full bg-[#E8002D]" />
                  <span className="text-lg font-extrabold uppercase tracking-tight text-white">WALL</span>
                </span>
                <button className="text-white" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X size={22} />
                </button>
              </div>

              <div className="flex flex-1 flex-col px-4 py-2">
                {navLinks.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="border-b border-white/5 py-3 text-sm font-semibold uppercase tracking-wide text-[#A0A0B0]"
                    activeProps={{
                      className:
                        "border-b border-white/5 py-3 text-sm font-semibold uppercase tracking-wide text-white",
                    }}
                    activeOptions={{ exact: l.to === "/" }}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-white/10 px-4 py-4">
                <LiveBadge />
                <div onClick={() => setOpen(false)}>
                  <AuthControls />
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}
