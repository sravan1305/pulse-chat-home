import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import type { TodayView } from "@/lib/aggregations.server";

type Direction = "up" | "down" | "flat";

function fmtSigned(n: number, decimals: number, unit: string) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(decimals)} ${unit}`;
}

function fmtDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Cell({
  label,
  value,
  delta,
  direction,
  betterWhen,
  baselineLabel,
}: {
  label: string;
  value: string;
  delta: string;
  direction: Direction;
  betterWhen: "up" | "down";
  baselineLabel: string;
}) {
  const isFlat = direction === "flat";
  const isBetter = !isFlat && direction === betterWhen;
  const color = isFlat ? "text-stone" : isBetter ? "text-grass" : "text-destructive";
  const Icon = isFlat ? Minus : direction === "up" ? ArrowUp : ArrowDown;
  return (
    <div className="card-soft p-4 bg-white">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone">{label}</div>
      <div className="mt-1 font-display text-xl text-navy">{value}</div>
      <div className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{delta}</span>
      </div>
      <div className="mt-0.5 text-[10px] text-stone">vs {baselineLabel}</div>
    </div>
  );
}

function direction(diff: number, eps = 0.05): Direction {
  if (Math.abs(diff) < eps) return "flat";
  return diff > 0 ? "up" : "down";
}

export function ComparisonStrip({
  today,
  baseline,
}: {
  today: TodayView;
  baseline: TodayView;
}) {
  const t = today.summary;
  const b = baseline.summary;
  const baselineLabel = fmtDate(baseline.date);

  const pvDiff = t.pv_kwh - b.pv_kwh;
  const consDiff = t.consumption_kwh - b.consumption_kwh;
  const ssDiff = t.self_sufficiency_pct - b.self_sufficiency_pct;
  const costDiff = t.energy_cost_eur - b.energy_cost_eur;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-navy text-lg">Compared to {baselineLabel}</h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-stone">
          Same household, same hour
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Cell
          label="Solar produced"
          value={`${t.pv_kwh.toFixed(1)} kWh`}
          delta={fmtSigned(pvDiff, 1, "kWh")}
          direction={direction(pvDiff)}
          betterWhen="up"
          baselineLabel={baselineLabel}
        />
        <Cell
          label="Energy used"
          value={`${t.consumption_kwh.toFixed(1)} kWh`}
          delta={fmtSigned(consDiff, 1, "kWh")}
          direction={direction(consDiff)}
          betterWhen="down"
          baselineLabel={baselineLabel}
        />
        <Cell
          label="Self-sufficient"
          value={`${t.self_sufficiency_pct.toFixed(0)}%`}
          delta={fmtSigned(ssDiff, 1, "pp")}
          direction={direction(ssDiff, 0.5)}
          betterWhen="up"
          baselineLabel={baselineLabel}
        />
        <Cell
          label="Day energy cost"
          value={`€${t.energy_cost_eur.toFixed(2)}`}
          delta={`${costDiff >= 0 ? "+" : "−"}€${Math.abs(costDiff).toFixed(2)}`}
          direction={direction(costDiff, 0.01)}
          betterWhen="down"
          baselineLabel={baselineLabel}
        />
      </div>
    </section>
  );
}
