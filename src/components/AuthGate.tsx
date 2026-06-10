import type { ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";

/**
 * Wraps protected page content. Signed-in users see the page.
 * Signed-out users see a dark overlay card over a blurred preview of the page.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <ClientOnly fallback={<div className="pointer-events-none select-none blur-md" aria-hidden="true">{children}</div>}>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="relative">
          {/* Blurred background showing the page behind */}
          <div className="pointer-events-none select-none blur-md" aria-hidden="true">
            {children}
          </div>

          {/* Dark overlay card */}
          <div className="absolute inset-0 z-10 flex items-start justify-center bg-[#15151E]/40 px-4 pt-24">
            <div className="pit-fade-up w-full max-w-md rounded-xl border border-white/10 bg-[#15151E] p-8 text-center shadow-2xl">
              <div className="mx-auto flex items-center justify-center">
                <span className="text-2xl font-extrabold uppercase tracking-tight text-white">PIT</span>
                <span className="mx-[3px] h-2 w-2 rounded-full bg-[#E8002D]" />
                <span className="text-2xl font-extrabold uppercase tracking-tight text-white">WALL</span>
              </div>
              <h2 className="mt-6 text-lg font-extrabold uppercase tracking-tight text-white">
                Create a free account to access this feature
              </h2>
              <p className="mt-2 text-sm text-[#A0A0B0]">
                Sign in to save strategies and unlock AI race insights.
              </p>
              <div className="mt-6">
                <SignInButton mode="modal">
                  <button className="w-full rounded-md bg-[#E8002D] py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#CC0027]">
                    Sign In
                  </button>
                </SignInButton>
              </div>
            </div>
          </div>
        </div>
      </SignedOut>
    </ClientOnly>
  );
}
