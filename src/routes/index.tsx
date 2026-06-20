import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { z } from "zod";

import { AppShell, useActiveHouseholdId } from "@/components/AppShell";
import { SignIn } from "@/components/auth/SignIn";
import { EnergyFlow } from "@/components/EnergyFlow";
import { OnboardingChat } from "@/components/onboarding/OnboardingChat";
import { useAuth } from "@/contexts/AuthContext";
import { getHomeComparisonFn } from "@/lib/data-functions";
import { DEFAULT_HOUSEHOLD_ID, DEMO_NOW_HOUR, DEMO_TODAY } from "@/lib/demo-config";

type CmpMode = "1w" | "1mo" | "1y";

const searchSchema = z.object({
  hh: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hour: z.number().int().min(0).max(23).optional(),
  cmp: z.enum(["1w", "1mo", "1y"]).optional(),
});

function homeQueryOptions(input: {
  householdId: string;
  date: string;
  hour: number;
  cmp: CmpMode;
}) {
  return queryOptions({
    queryKey: ["home-comparison", input.householdId, input.date, input.hour, input.cmp],
    queryFn: () => getHomeComparisonFn({ data: input }),
    staleTime: 60_000,
  });
}

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    hh: search.hh ?? DEFAULT_HOUSEHOLD_ID,
    date: search.date ?? DEMO_TODAY,
    hour: search.hour ?? DEMO_NOW_HOUR,
    cmp: (search.cmp ?? "1w") as CmpMode,
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      homeQueryOptions({ householdId: deps.hh, date: deps.date, hour: deps.hour, cmp: deps.cmp }),
    ),
  head: () => ({
    meta: [
      { title: "Enpal Pulse — Your home energy at a glance" },
      {
        name: "description",
        content: "A calm, live view of your home's energy right now.",
      },
    ],
  }),
  component: HomeGate,
});

function HomeGate() {
  const { user, onboarding, ready, refresh } = useAuth();

  if (!ready) return <div className="min-h-screen bg-background" />;
  if (!user) return <SignIn />;
  if (!onboarding?.household_id) return <OnboardingChat onComplete={refresh} />;
  return <HomePage />;
}

function greeting(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function HomePage() {
  const householdId = useActiveHouseholdId();
  const search = Route.useSearch();
  const date = search.date ?? DEMO_TODAY;
  const hour = search.hour ?? DEMO_NOW_HOUR;
  const cmp = (search.cmp ?? "1w") as CmpMode;

  const { data } = useSuspenseQuery(homeQueryOptions({ householdId, date, hour, cmp }));
  const { household, comparison } = data;
  const today = comparison.today;
  const s = today.summary;

  const dateLabel = new Date(today.date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <p className="text-stone font-semibold text-sm uppercase tracking-wider">
            {greeting(hour)}, {household.name}
          </p>
          <h1 className="mt-2 text-navy">Here's your home, right now.</h1>
          <p className="text-stone mt-2 text-sm">
            {dateLabel} · {household.city}
          </p>
        </div>

        <EnergyFlow snapshot={today.now} compact />

        <p className="text-stone text-sm leading-relaxed text-center">
          Today: <span className="text-navy font-semibold">{s.pv_kwh.toFixed(1)} kWh</span> solar ·{" "}
          <span className="text-navy font-semibold">{s.consumption_kwh.toFixed(1)} kWh</span> used ·{" "}
          <span className="text-navy font-semibold">{s.self_sufficiency_pct.toFixed(0)}%</span> self-sufficient ·{" "}
          <span className="text-navy font-semibold">€{s.energy_cost_eur.toFixed(2)}</span> so far
        </p>

        <div className="flex justify-center pt-2">
          <Link to="/chat" className="btn-cta">
            <Sparkles className="w-4 h-4" />
            Ask Pulse anything
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
