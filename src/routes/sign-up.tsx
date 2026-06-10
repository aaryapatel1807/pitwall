import { createFileRoute } from "@tanstack/react-router";
import { SignUp } from "@clerk/clerk-react";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Sign Up — PitWall" },
      { name: "description", content: "Create a free PitWall account to save strategies and unlock AI insights." },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-[#15151E] px-4 py-16">
      <div className="mb-6 flex flex-col items-center">
        <div className="flex items-center">
          <span className="text-3xl font-extrabold uppercase tracking-tight text-white">PIT</span>
          <span className="mx-1 h-2.5 w-2.5 rounded-full bg-[#E8002D]" />
          <span className="text-3xl font-extrabold uppercase tracking-tight text-white">WALL</span>
        </div>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#A0A0B0]">
          Race Intelligence Hub
        </p>
      </div>
      <SignUp routing="hash" signInUrl="/sign-in" forceRedirectUrl="/strategy" />
    </main>
  );
}
