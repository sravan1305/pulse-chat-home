import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Lightbulb, Sparkles } from "lucide-react";
import { z } from "zod";

import { AppShell, useActiveHouseholdId } from "@/components/AppShell";
import { getWeeklyViewFn } from "@/lib/data-functions";
import { DEFAULT_HOUSEHOLD_ID } from "@/lib/demo-config";

const searchSchema = z.object({ hh: z.string().optional() });

function weeklyQueryOptions(householdId: string) {
  return queryOptions({
    queryKey: ["weekly-view", householdId],
    queryFn: () => getWeeklyViewFn({ data: { householdId } }),
    staleTime: 60_000,
  });
}

export const Route = createFileRoute("/insights")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ hh: search.hh ?? DEFAULT_HOUSEHOLD_ID }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(weeklyQueryOptions(deps.hh)),
  head: () => ({
    meta: [
      { title: "Insights — Enpal Pulse" },
      { name: "description", content: "Recommendations tailored to your home." },
    ],
  }),
  component: InsightsPage,
});

const SEVERITY_ORDER: Record<string, number> = { high: 0, info: 1 };

function InsightsPage() {
  const householdId = useActiveHouseholdId();
  const { data } = useSuspenseQuery(weeklyQueryOptions(householdId));
  const { weekly: w, insights } = data;
  const isSaved = w.week_saved_eur > 0;
  const maxCost = Math.max(...w.days.map((d) => d.energy_cost_eur), 1);

  const sorted = [...insights].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2),
  );

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <p className="text-stone font-semibold text-sm uppercase tracking-wider">Insights</p>
          <h1 className="text-navy mt-2">Recommendations for your home</h1>
          <p className="text-stone mt-1">
            Tailored from your meter data, contract and appliances.
          </p>
        </div>

        {sorted.length > 0 ? (
          <section className="space-y-3">
            {sorted.map((i, idx) => {
              const high = i.severity === "high";
              const Icon = high ? AlertTriangle : i.type === "nudge" ? Sparkles : Lightbulb;
              return (
                <article key={idx} className="card-soft p-5 md:p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        high ? "bg-destructive/10 text-destructive" : "bg-cta/30 text-navy"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone">
                          {i.type}
                        </span>
                        <span className="text-xs text-stone">·</span>
                        <span className="text-xs text-stone">{i.period}</span>
                        {high && (
                          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-destructive/10 text-destructive">
                            Action needed
                          </span>
                        )}
                      </div>
                      <h3 className="text-navy text-lg md:text-xl">{i.title}</h3>
                      <p className="text-stone mt-2 leading-relaxed">{i.detail}</p>
                      <div className="mt-4">
                        <Link
                          to="/chat"
                          search={{ q: i.suggested_action }}
                          className="inline-flex items-center gap-2 text-navy font-semibold text-sm hover:underline"
                        >
                          {i.suggested_action}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="card-soft p-8 text-center">
            <p className="text-stone">Nothing to flag right now — your home is humming along.</p>
          </section>
        )}

        {/* Compact weekly retrospective */}
        <section className="card-soft p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2 className="text-navy text-lg font-semibold">This week</h2>
              <p className="text-stone text-sm">
                {w.loads_shifted_count} loads shifted to cheaper hours
              </p>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                isSaved ? "bg-grass/15 text-grass" : "bg-cta/30 text-navy"
              }`}
            >
              {isSaved ? (
                <ArrowDownRight className="w-5 h-5" />
              ) : (
                <ArrowUpRight className="w-5 h-5" />
              )}
              <span className="font-display text-xl">
                {isSaved ? "€" : "−€"}
                {Math.abs(w.week_saved_eur).toFixed(2)}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider">
                {isSaved ? "saved" : "over baseline"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 items-end h-28">
            {w.days.map((d) => (
              <div key={d.date} className="flex flex-col items-center justify-end h-full">
                <div className="text-[10px] font-semibold text-navy mb-1">
                  €{d.energy_cost_eur.toFixed(1)}
                </div>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-navy to-dodger"
                  style={{ height: `${(d.energy_cost_eur / maxCost) * 80}%` }}
                />
                <div className="text-[10px] text-stone mt-1.5">
                  {new Date(d.date).toLocaleDateString("en-GB", { weekday: "short" })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
