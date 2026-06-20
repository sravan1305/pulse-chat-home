import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { BatteryCharging, Car, ExternalLink, Sparkles, Sun, Thermometer } from "lucide-react";
import { z } from "zod";

import { AppShell, useActiveHouseholdId } from "@/components/AppShell";
import { getEnergyDayFn } from "@/lib/data-functions";
import { DEFAULT_HOUSEHOLD_ID } from "@/lib/demo-config";

const searchSchema = z.object({
  hh: z.string().optional(),
  season: z.enum(["summer", "winter"]).optional(),
});

type Season = "summer" | "winter";

function energyDayQueryOptions(householdId: string, season: Season) {
  return queryOptions({
    queryKey: ["energy-day", householdId, season],
    queryFn: () => getEnergyDayFn({ data: { householdId, season } }),
    staleTime: 60_000,
  });
}

export const Route = createFileRoute("/insights")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    hh: search.hh ?? DEFAULT_HOUSEHOLD_ID,
    season: search.season ?? "summer",
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(energyDayQueryOptions(deps.hh, deps.season)),
  head: () => ({
    meta: [
      { title: "Insights — Enpal Pulse" },
      { name: "description", content: "Your highest-saving energy moves for today." },
    ],
  }),
  component: InsightsPage,
});

const LEGEND = [
  { label: "Free — your solar", className: "bg-grass" },
  { label: "Free — your battery", className: "bg-dodger/65" },
  { label: "Cheaper grid", className: "bg-cta/70" },
  { label: "Avoid — peak", className: "bg-red-500" },
] as const;

const SEGMENT_CLASS = {
  solar: "bg-grass",
  battery: "bg-dodger/65",
  cheap: "bg-cta/70",
  peak: "bg-red-500",
} as const;

const TONE_CLASS = {
  red: "border-l-red-500 text-red-700",
  amber: "border-l-yellow text-yellow-700",
  blue: "border-l-dodger text-dodger",
} as const;

function InsightsPage() {
  const householdId = useActiveHouseholdId();
  const search = Route.useSearch();
  const season = search.season ?? "summer";
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(energyDayQueryOptions(householdId, season));
  const { household, tariff, segments, metrics, recommendations } = data;
  const tariffLabel = tariff.type === "dynamic_hourly" ? "dynamic tariff" : "fixed tariff";

  const setSeason = (next: Season) => {
    navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, season: next }) });
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <section className="space-y-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-navy text-4xl md:text-[46px]">
                Your energy day — {household.name}
              </h1>
              <p className="mt-1 text-lg text-stone md:text-xl">
                {household.city} · {household.pv_kwp} kWp solar · {household.battery_kwh} kWh
                battery · {household.ev_charger ? "EV" : "no EV"} · {tariffLabel}
              </p>
            </div>

            <div className="inline-flex self-start overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setSeason("summer")}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition md:text-base ${
                  season === "summer" ? "bg-secondary text-navy" : "text-stone hover:text-navy"
                }`}
              >
                Summer day
              </button>
              <button
                type="button"
                onClick={() => setSeason("winter")}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition md:text-base ${
                  season === "winter" ? "bg-dodger/20 text-dodger" : "text-stone hover:text-navy"
                }`}
              >
                Winter day
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-7 gap-y-3">
            {LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-stone">
                <span className={`h-4 w-4 rounded-md ${item.className}`} />
                <span className="text-base font-semibold">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex h-20 overflow-hidden rounded-2xl bg-secondary shadow-inner md:h-24">
              {segments.map((segment) => (
                <div
                  key={`${segment.start_hour}-${segment.kind}`}
                  className={`${SEGMENT_CLASS[segment.kind]} transition-all`}
                  style={{ width: `${((segment.end_hour - segment.start_hour) / 24) * 100}%` }}
                  title={`${segment.start_hour}:00–${segment.end_hour}:00`}
                />
              ))}
            </div>
            <div className="grid grid-cols-8 px-3 text-sm font-semibold text-stone/80">
              {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
                <span key={hour}>{String(hour).padStart(2, "0")}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-2xl bg-secondary/70 p-5 md:p-6">
              <p className="text-lg font-semibold text-stone">{metric.label}</p>
              <div className="mt-3 font-display text-4xl text-navy">{metric.value}</div>
              <p className="mt-1 text-sm font-semibold text-stone/85">{metric.sub}</p>
            </article>
          ))}
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-stone font-semibold text-sm uppercase tracking-wider">
              AI + household data
            </p>
            <h2 className="mt-1 text-navy text-3xl">What to do today</h2>
            <p className="mt-1 text-stone">
              Ranked by estimated savings from your 15-minute consumption, solar, battery and tariff
              data.
            </p>
          </div>

          <div className="space-y-4">
            {recommendations.map((recommendation) => {
              const Icon =
                recommendation.icon === "car"
                  ? Car
                  : recommendation.icon === "thermometer"
                    ? Thermometer
                    : Sparkles;
              return (
                <article
                  key={recommendation.title}
                  className={`card-soft border-l-4 p-5 md:p-7 ${TONE_CLASS[recommendation.tone]}`}
                >
                  <div className="flex gap-4">
                    <div className="pt-1">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <h3 className="text-2xl text-navy">{recommendation.title}</h3>
                        <span className="w-fit rounded-full bg-grass/15 px-3 py-1 text-sm font-semibold text-grass">
                          ~€{recommendation.estimated_savings_eur.toFixed(2)} saving
                        </span>
                      </div>
                      <p className="mt-2 text-lg leading-relaxed text-stone">
                        {recommendation.body}
                      </p>
                      <button className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-navy transition hover:bg-secondary">
                        {recommendation.cta}
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-stone">
          <Sun className="h-4 w-4 text-yellow" />
          <span>
            Mapped from the selected household’s day profile, contract feed-in rate and hourly
            prices.
          </span>
          <BatteryCharging className="h-4 w-4 text-dodger" />
        </div>
      </div>
    </AppShell>
  );
}
