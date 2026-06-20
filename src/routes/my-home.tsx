import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  Battery,
  Car,
  Flame,
  Sun,
  FileText,
  Settings as SettingsIcon,
  Zap,
} from "lucide-react";
import { z } from "zod";

import { AppShell, useActiveHouseholdId } from "@/components/AppShell";
import { getMyHomeFn } from "@/lib/data-functions";
import { DEFAULT_HOUSEHOLD_ID, DEMO_TODAY } from "@/lib/demo-config";

const searchSchema = z.object({ hh: z.string().optional() });

function myHomeQueryOptions(householdId: string) {
  return queryOptions({
    queryKey: ["my-home", householdId],
    queryFn: () => getMyHomeFn({ data: { householdId } }),
    staleTime: 60_000,
  });
}

export const Route = createFileRoute("/my-home")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ hh: search.hh ?? DEFAULT_HOUSEHOLD_ID }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(myHomeQueryOptions(deps.hh)),
  head: () => ({
    meta: [
      { title: "My Home — Enpal Pulse" },
      {
        name: "description",
        content: "Your energy system, contract, tariff and yearly totals.",
      },
    ],
  }),
  component: MyHomePage,
});

function fmtDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function weeksFromNow(targetISO: string, todayISO: string) {
  const [ty, tm, td] = targetISO.split("-").map(Number);
  const [cy, cm, cd] = todayISO.split("-").map(Number);
  const target = Date.UTC(ty, tm - 1, td);
  const today = Date.UTC(cy, cm - 1, cd);
  return Math.round((target - today) / (7 * 24 * 60 * 60 * 1000));
}

function MyHomePage() {
  const householdId = useActiveHouseholdId();
  const { data } = useSuspenseQuery(myHomeQueryOptions(householdId));
  const { household, tariff, contract, bills, last30, yearTotals } = data;

  const today = DEMO_TODAY;
  const [cy, cm, cd] = today.split("-").map(Number);
  const todayMs = Date.UTC(cy, cm - 1, cd);
  const [sy, sm, sd] = contract.contract_start.split("-").map(Number);
  const [ey, em, ed] = contract.contract_end.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  const termPct = Math.max(
    0,
    Math.min(100, Math.round(((todayMs - startMs) / (endMs - startMs)) * 100)),
  );
  // Notice deadline = end − notice_period_weeks
  const noticeMs = endMs - contract.notice_period_weeks * 7 * 24 * 60 * 60 * 1000;
  const noticeISO = new Date(noticeMs).toISOString().slice(0, 10);
  const noticeWeeks = weeksFromNow(noticeISO, today);

  const currentRate =
    tariff.type === "fixed_rate"
      ? tariff.energy_rate_eur_per_kwh
      : contract.energy_pricing.spot_adder_eur_per_kwh; // adder + spot — display the adder

  const maxBill = Math.max(...bills.map((b) => b.total_bill_eur), 1);
  const maxPv = Math.max(...bills.map((b) => b.pv_production_kwh), 1);

  const maxLast30 = Math.max(...last30.days.map((d) => d.energy_cost_eur), 1);

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <p className="text-stone font-semibold text-sm uppercase tracking-wider">My Home</p>
          <h1 className="text-navy mt-2">{household.name}</h1>
          <p className="text-stone mt-1">
            {household.city} · {household.residents} residents
          </p>
        </div>

        {/* Energy assets */}
        <section className="card-soft p-6">
          <h2 className="text-navy text-lg font-semibold mb-4">Energy system</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AssetTile
              icon={<Sun className="w-4 h-4" />}
              label="Solar PV"
              value={`${contract.assets.pv_kwp.toFixed(1)} kWp`}
              sub="rooftop array"
              on
            />
            <AssetTile
              icon={<Battery className="w-4 h-4" />}
              label="Battery"
              value={
                contract.assets.battery_kwh > 0
                  ? `${contract.assets.battery_kwh.toFixed(1)} kWh`
                  : "—"
              }
              sub={
                contract.assets.battery_kwh > 0
                  ? `${contract.assets.battery_power_kw.toFixed(1)} kW peak`
                  : "Not installed"
              }
              on={contract.assets.battery_kwh > 0}
            />
            <AssetTile
              icon={<Flame className="w-4 h-4" />}
              label="Heat pump"
              value={contract.assets.heat_pump ? `${contract.assets.heat_pump_kw.toFixed(1)} kW` : "—"}
              sub={contract.assets.heat_pump ? "Heating + hot water" : "Not installed"}
              on={contract.assets.heat_pump}
            />
            <AssetTile
              icon={<Car className="w-4 h-4" />}
              label="EV charger"
              value={
                contract.assets.ev_charger
                  ? `${contract.assets.ev_battery_kwh} kWh EV`
                  : "—"
              }
              sub={contract.assets.ev_charger ? "Wallbox installed" : "Not installed"}
              on={contract.assets.ev_charger}
            />
          </div>
        </section>

        {/* Tariff & contract */}
        <section className="card-soft p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2 className="text-navy text-lg font-semibold">Tariff &amp; contract</h2>
              <p className="text-stone text-sm">{contract.provider} · {tariff.name}</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-cta/30 text-navy">
              {tariff.type === "fixed_rate" ? "Fixed rate" : "Dynamic hourly"}
            </span>
          </div>

          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
            <Field
              label={tariff.type === "fixed_rate" ? "Energy rate" : "Spot adder"}
              value={`€${currentRate.toFixed(3)}/kWh`}
            />
            <Field label="Base fee" value={`€${contract.base_fee_eur_per_month.toFixed(2)}/mo`} />
            <Field label="Feed-in" value={`€${contract.feed_in_eur_per_kwh.toFixed(3)}/kWh`} />
            <Field
              label="Minimum term"
              value={`${contract.minimum_term_months} months`}
            />
          </dl>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-stone mb-2">
              <span>{fmtDate(contract.contract_start)}</span>
              <span className="text-navy font-semibold">{termPct}% through</span>
              <span>{fmtDate(contract.contract_end)}</span>
            </div>
            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-navy"
                style={{ width: `${termPct}%` }}
              />
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4 flex items-start gap-3">
            <FileText className="w-4 h-4 text-navy mt-0.5 shrink-0" />
            <div className="text-sm text-stone leading-relaxed">
              <span className="text-navy font-semibold">Notice deadline:</span>{" "}
              {fmtDate(noticeISO)}{" "}
              <span className="opacity-70">
                ({noticeWeeks >= 0 ? `in ${noticeWeeks} weeks` : `${-noticeWeeks} weeks ago`})
              </span>
              . If you don't give notice {contract.notice_period_weeks} weeks before
              the term ends, the contract auto-renews for{" "}
              {contract.auto_renew_months} months.
            </div>
          </div>
        </section>

        {/* Year totals */}
        <section className="card-soft p-6">
          <h2 className="text-navy text-lg font-semibold mb-1">
            {yearTotals.year} in numbers
          </h2>
          <p className="text-stone text-sm mb-4">
            {yearTotals.months_counted} months of bills
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Energy used" value={`${yearTotals.consumption_kwh.toFixed(0)} kWh`} />
            <Stat label="Solar produced" value={`${yearTotals.pv_production_kwh.toFixed(0)} kWh`} tone="grass" />
            <Stat label="Self-sufficient" value={`${yearTotals.self_sufficiency_pct.toFixed(0)}%`} tone="grass" />
            <Stat label="Total spent" value={`€${yearTotals.total_bill_eur.toFixed(0)}`} />
            <Stat label="From grid" value={`${yearTotals.grid_import_kwh.toFixed(0)} kWh`} />
            <Stat label="To grid" value={`${yearTotals.grid_export_kwh.toFixed(0)} kWh`} tone="grass" />
            <Stat label="Feed-in earned" value={`€${yearTotals.feed_in_credit_eur.toFixed(2)}`} tone="grass" />
            <Stat label="Base fees" value={`€${yearTotals.base_fee_eur.toFixed(2)}`} />
          </div>
        </section>

        {/* Monthly bills chart */}
        <section className="card-soft p-6">
          <h2 className="text-navy text-lg font-semibold mb-1">Monthly bills</h2>
          <p className="text-stone text-sm mb-5">Total bill vs solar produced</p>
          <div className="grid grid-cols-12 gap-1.5 items-end h-44">
            {bills.map((b) => (
              <div key={b.month} className="flex flex-col items-center justify-end h-full">
                <div className="text-[10px] font-semibold text-navy mb-1">
                  €{b.total_bill_eur.toFixed(0)}
                </div>
                <div className="relative w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-navy to-dodger"
                    style={{ height: `${(b.total_bill_eur / maxBill) * 100}%` }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-md bg-grass/60"
                    style={{
                      height: `${(b.pv_production_kwh / maxPv) * 100}%`,
                      mixBlendMode: "multiply",
                      opacity: 0.45,
                    }}
                    title={`${b.pv_production_kwh.toFixed(0)} kWh solar`}
                  />
                </div>
                <div className="text-[10px] text-stone mt-1.5">
                  {b.month.slice(5)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-stone">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-navy" /> Total bill (€)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-grass/60" /> Solar produced (kWh)
            </span>
          </div>
        </section>

        {/* Last 30 days */}
        <section className="card-soft p-6">
          <h2 className="text-navy text-lg font-semibold mb-1">Last 30 days</h2>
          <p className="text-stone text-sm mb-4">Daily energy cost from your meter</p>
          <div className="flex items-end gap-1 h-28">
            {last30.days.map((d) => (
              <div
                key={d.date}
                className="flex-1 rounded-t bg-navy/80"
                style={{ height: `${Math.max(4, (d.energy_cost_eur / maxLast30) * 100)}%` }}
                title={`${d.date}: €${d.energy_cost_eur.toFixed(2)}`}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-stone">
            <span>{fmtDate(last30.days[0]?.date ?? today)}</span>
            <span className="inline-flex items-center gap-1">
              <Zap className="w-3 h-3" />
              avg €{(last30.days.reduce((s, d) => s + d.energy_cost_eur, 0) / Math.max(1, last30.days.length)).toFixed(2)}/day
            </span>
            <span>{fmtDate(last30.days[last30.days.length - 1]?.date ?? today)}</span>
          </div>
        </section>

        <div className="flex justify-end">
          <Link to="/settings" className="btn-cta">
            <SettingsIcon className="w-4 h-4" />
            Edit setup
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function AssetTile({
  icon,
  label,
  value,
  sub,
  on,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  on: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 border ${on ? "border-border bg-white" : "border-dashed border-border bg-muted/30"}`}>
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${
          on ? "bg-cta/30 text-navy" : "bg-muted text-stone"
        }`}
      >
        {icon}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone">{label}</div>
      <div className={`mt-1 font-display text-lg ${on ? "text-navy" : "text-stone"}`}>{value}</div>
      <div className="text-xs text-stone mt-0.5">{sub}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone">
        {label}
      </dt>
      <dd className="mt-1 font-display text-navy text-base">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "grass";
}) {
  return (
    <div className="rounded-2xl bg-secondary/60 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone">
        {label}
      </div>
      <div className={`mt-1 font-display text-lg ${tone === "grass" ? "text-grass" : "text-navy"}`}>
        {value}
      </div>
    </div>
  );
}
