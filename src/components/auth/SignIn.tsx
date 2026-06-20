import { ArrowRight } from "lucide-react";

import households from "@/data/raw/households.json";
import { useAuth } from "@/contexts/AuthContext";

type HouseholdLite = { household_id: string; name: string; city: string };
const HOUSEHOLDS = households as HouseholdLite[];

export function SignIn() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-5 py-4 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cta flex items-center justify-center">
            <span className="text-navy font-display text-lg">E</span>
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg text-white">Enpal Pulse</div>
            <div className="text-xs text-white/60 -mt-0.5">Smart energy companion</div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-5 py-12 flex flex-col justify-center">
        <div className="mb-6">
          <p className="text-stone font-semibold text-sm uppercase tracking-wider">Welcome back</p>
          <h1 className="mt-2 text-navy text-3xl sm:text-4xl">Sign in to Enpal Pulse</h1>
          <p className="text-stone mt-2">
            Demo — pick a household to continue. We'll set up tips tailored to that home.
          </p>
        </div>

        <div className="card-soft p-2 space-y-1">
          {HOUSEHOLDS.map((h) => {
            const initials = h.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <button
                key={h.household_id}
                onClick={() => signIn({ id: h.household_id, name: h.name })}
                className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 hover:bg-secondary/60 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cta text-navy font-display text-sm flex items-center justify-center">
                    {initials}
                  </div>
                  <div>
                    <div className="font-display text-navy">{h.name}</div>
                    <div className="text-sm text-stone">{h.city}</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-stone group-hover:text-navy transition" />
              </button>
            );
          })}
        </div>

        <p className="text-xs text-stone mt-6 text-center">
          This is a demo. No password required.
        </p>
      </main>
    </div>
  );
}
