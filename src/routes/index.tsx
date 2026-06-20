import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowRight, FileText, MessageCircle, Settings } from "lucide-react";
import { z } from "zod";

import { AppShell, useActiveHouseholdId } from "@/components/AppShell";
import { EnergyFlow } from "@/components/EnergyFlow";
import { getHouseholdSummaryFn } from "@/lib/data-functions";
import { DEFAULT_HOUSEHOLD_ID } from "@/lib/demo-config";

const searchSchema = z.object({ hh: z.string().optional() });

function summaryQueryOptions(householdId: string) {
  return queryOptions({
    queryKey: ["household-summary", householdId],
    queryFn: () => getHouseholdSummaryFn({ data: { householdId } }),
    staleTime: 60_000,
  });
}

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ hh: search.hh ?? DEFAULT_HOUSEHOLD_ID }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(summaryQueryOptions(deps.hh)),
  head: () => ({
    meta: [
      { title: "Enpal Pulse — Your home energy at a glance" },
      {
        name: "description",
        content: "Today's solar, battery, consumption and savings for your Enpal home.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const householdId = useActiveHouseholdId();
  const { data } = useSuspenseQuery(summaryQueryOptions(householdId));
  const { household, today, bills, insights } = data;
  const s = today.summary;

  const monthKey = today.date.slice(0, 7); // YYYY-MM
  const prev = (() => {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();
  const thisMonth = bills.find((b) => b.month === monthKey);
  const lastMonth = bills.find((b) => b.month === prev);
  const delta = thisMonth && lastMonth ? thisMonth.total_bill_eur - lastMonth.total_bill_eur : 0;
  const savedVsLast = -delta;
  const monthLabel = new Date(today.date).toLocaleDateString("en-GB", { month: "long" });

  const featured = insights.find((i) => i.severity === "high") ?? insights[0];

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <p className="text-stone font-semibold text-sm uppercase tracking-wider">
            Good day, {household.name}
          </p>
          <h1 className="mt-2 text-navy">Your home today</h1>
          <p className="text-stone mt-1">
            {new Date(today.date).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            · {household.city}
          </p>
        </div>

        <EnergyFlow snapshot={today.now} />

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Chip label="Solar today" value={`${s.pv_kwh.toFixed(1)} kWh`} tone="grass" />
          <Chip label="Used today" value={`${s.consumption_kwh.toFixed(1)} kWh`} />
          <Chip label="Self-sufficient" value={`${s.self_sufficiency_pct}%`} tone="grass" />
          <Chip
            label={savedVsLast >= 0 ? "Saved vs last mo." : "vs last month"}
            value={`${savedVsLast >= 0 ? "↓" : "↑"} €${Math.abs(savedVsLast).toFixed(2)}`}
            tone={savedVsLast >= 0 ? "grass" : "stone"}
          />
          <Chip label="Exported to grid" value={`${s.grid_export_kwh.toFixed(1)} kWh`} />
          <Chip label="Bought from grid" value={`${s.grid_import_kwh.toFixed(1)} kWh`} />
          <Chip
            label={`${monthLabel} bill so far`}
            value={`€${thisMonth?.total_bill_eur.toFixed(2) ?? "—"}`}
          />
          <Chip
            label="Cheapest 3h today"
            value={`${today.cheapest_3h_window.start_hour}:00–${today.cheapest_3h_window.end_hour}:00`}
            tone="cta"
          />
        </section>

        {featured && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-navy">Today's insight</h2>
              <span className="text-xs font-semibold uppercase tracking-wider text-stone">
                Powered by your data
              </span>
            </div>
            <article className="card-soft p-6 md:p-7">
              <div className="flex items-start gap-4">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    featured.severity === "high"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-cta/30 text-navy"
                  }`}
                >
                  {featured.type === "anomaly" ? "!" : featured.type === "nudge" ? "★" : "i"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone">
                      {featured.type}
                    </span>
                    <span className="text-xs text-stone">·</span>
                    <span className="text-xs text-stone">{featured.period}</span>
                  </div>
                  <h3 className="text-navy text-xl">{featured.title}</h3>
                  <p className="text-stone mt-2 leading-relaxed">{featured.detail}</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      to="/chat"
                      search={{ hh: householdId, q: featured.suggested_action }}
                      className="btn-cta"
                    >
                      {featured.suggested_action}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          </section>
        )}

        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/chat"
            search={{ hh: householdId }}
            className="card-soft p-5 flex items-center justify-between hover:shadow-lg transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cta/30 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-navy" />
              </div>
              <div>
                <div className="font-display text-navy">Ask a question</div>
                <div className="text-sm text-stone">Chat with your energy data</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-stone group-hover:text-navy transition" />
          </Link>
          <Link
            to="/chat"
            search={{ hh: householdId, q: "Show me my contract details" }}
            className="card-soft p-5 flex items-center justify-between hover:shadow-lg transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cta/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-navy" />
              </div>
              <div>
                <div className="font-display text-navy">View contract</div>
                <div className="text-sm text-stone">Tariff, term, maintenance</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-stone group-hover:text-navy transition" />
          </Link>
          <Link
            to="/welcome"
            className="card-soft p-5 flex items-center justify-between hover:shadow-lg transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cta/30 flex items-center justify-center">
                <Settings className="w-5 h-5 text-navy" />
              </div>
              <div>
                <div className="font-display text-navy">Personalize setup</div>
                <div className="text-sm text-stone">Tailor tips to your home</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-stone group-hover:text-navy transition" />
          </Link>
        </section>
      </div>
    </AppShell>
  );
}

function Chip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "grass" | "cta" | "stone";
}) {
  const valueColor =
    tone === "grass"
      ? "text-grass"
      : tone === "cta"
        ? "text-navy"
        : tone === "stone"
          ? "text-stone"
          : "text-navy";
  const bg = tone === "cta" ? "bg-cta/20" : "bg-white";
  return (
    <div className={`card-soft px-4 py-3 ${bg}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone">
        {label}
      </div>
      <div className={`mt-1 font-display text-lg ${valueColor}`}>{value}</div>
    </div>
  );
}
