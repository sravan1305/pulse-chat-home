// Server-side aggregations over the raw 15-minute timeseries.
// Everything is computed on-demand from getTimeseries() then cached at the
// server-function layer.

import {
  getContractFor,
  getHousehold,
  getInsightsFor,
  getMonthlyBillsFor,
  getTariff,
  getTimeseries,
  type InsightEvent,
  type MonthlyBill,
  type TimeseriesRecord,
} from "./data-loader.server";
import { DEMO_NOW_HOUR, DEMO_TODAY } from "./demo-config";

// Each 15-minute interval = 0.25 h
const STEP_H = 0.25;

function dateKey(ts: string) {
  return ts.slice(0, 10);
}

function hourFromTs(ts: string) {
  return Number(ts.slice(11, 13));
}

function recordsForDate(records: TimeseriesRecord[], date: string) {
  return records.filter((r) => dateKey(r.timestamp) === date);
}

function recordsBetween(records: TimeseriesRecord[], startDate: string, endDate: string) {
  return records.filter((r) => {
    const d = dateKey(r.timestamp);
    return d >= startDate && d <= endDate;
  });
}

function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type HourlyAggregate = {
  hour: number;
  pv_kwh: number;
  consumption_kwh: number;
  heatpump_kwh: number;
  ev_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  battery_soc_pct_end: number;
  price_eur_per_kwh: number;
};

export type DailySummary = {
  date: string;
  pv_kwh: number;
  consumption_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  heatpump_kwh: number;
  ev_kwh: number;
  energy_cost_eur: number;
  self_sufficiency_pct: number;
  battery_soc_pct_current: number;
};

export type LiveSnapshot = {
  timestamp: string;
  pv_kw: number;
  house_load_kw: number;
  heatpump_kw: number;
  ev_kw: number;
  battery_charge_kw: number;
  battery_discharge_kw: number;
  battery_soc_pct: number;
  grid_import_kw: number;
  grid_export_kw: number;
  price_eur_per_kwh: number;
  outdoor_temp_c: number;
};

export type TodayView = {
  date: string;
  summary: DailySummary;
  hourly: HourlyAggregate[];
  cheapest_3h_window: { start_hour: number; end_hour: number; avg_price_eur_per_kwh: number };
  now: LiveSnapshot;
};

function aggregateHourly(records: TimeseriesRecord[]): HourlyAggregate[] {
  const buckets = new Map<number, HourlyAggregate>();
  for (const r of records) {
    const h = hourFromTs(r.timestamp);
    const b =
      buckets.get(h) ??
      ({
        hour: h,
        pv_kwh: 0,
        consumption_kwh: 0,
        heatpump_kwh: 0,
        ev_kwh: 0,
        grid_import_kwh: 0,
        grid_export_kwh: 0,
        battery_soc_pct_end: 0,
        price_eur_per_kwh: 0,
      } as HourlyAggregate);
    b.pv_kwh += r.pv_production_kw * STEP_H;
    b.consumption_kwh += r.total_consumption_kw * STEP_H;
    b.heatpump_kwh += r.heatpump_kw * STEP_H;
    b.ev_kwh += r.ev_charging_kw * STEP_H;
    b.grid_import_kwh += r.grid_import_kw * STEP_H;
    b.grid_export_kwh += r.grid_export_kw * STEP_H;
    b.battery_soc_pct_end = r.battery_soc_pct; // last write wins -> end of hour
    b.price_eur_per_kwh = r.price_eur_per_kwh; // representative (same for the hour)
    buckets.set(h, b);
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.hour - b.hour)
    .map((h) => ({
      ...h,
      pv_kwh: round(h.pv_kwh, 3),
      consumption_kwh: round(h.consumption_kwh, 3),
      heatpump_kwh: round(h.heatpump_kwh, 3),
      ev_kwh: round(h.ev_kwh, 3),
      grid_import_kwh: round(h.grid_import_kwh, 3),
      grid_export_kwh: round(h.grid_export_kwh, 3),
      battery_soc_pct_end: round(h.battery_soc_pct_end, 1),
      price_eur_per_kwh: round(h.price_eur_per_kwh, 4),
    }));
}

function summarizeDay(records: TimeseriesRecord[], date: string): DailySummary {
  let pv = 0,
    cons = 0,
    gi = 0,
    ge = 0,
    hp = 0,
    ev = 0,
    cost = 0;
  let lastSoc = 0;
  for (const r of records) {
    pv += r.pv_production_kw * STEP_H;
    cons += r.total_consumption_kw * STEP_H;
    gi += r.grid_import_kw * STEP_H;
    ge += r.grid_export_kw * STEP_H;
    hp += r.heatpump_kw * STEP_H;
    ev += r.ev_charging_kw * STEP_H;
    cost += r.grid_import_kw * STEP_H * r.price_eur_per_kwh;
    lastSoc = r.battery_soc_pct;
  }
  const selfSuff = cons > 0 ? Math.max(0, Math.min(100, ((cons - gi) / cons) * 100)) : 0;
  return {
    date,
    pv_kwh: round(pv, 2),
    consumption_kwh: round(cons, 2),
    grid_import_kwh: round(gi, 2),
    grid_export_kwh: round(ge, 2),
    heatpump_kwh: round(hp, 2),
    ev_kwh: round(ev, 2),
    energy_cost_eur: round(cost, 2),
    self_sufficiency_pct: round(selfSuff, 1),
    battery_soc_pct_current: round(lastSoc, 1),
  };
}

function cheapestWindow(hourly: HourlyAggregate[], duration = 3) {
  if (hourly.length === 0) {
    return { start_hour: 0, end_hour: duration, avg_price_eur_per_kwh: 0 };
  }
  let bestStart = 0;
  let bestAvg = Infinity;
  for (let i = 0; i <= hourly.length - duration; i++) {
    const slice = hourly.slice(i, i + duration);
    const avg = slice.reduce((s, h) => s + h.price_eur_per_kwh, 0) / duration;
    if (avg < bestAvg) {
      bestAvg = avg;
      bestStart = i;
    }
  }
  return {
    start_hour: hourly[bestStart].hour,
    end_hour: hourly[bestStart + duration - 1].hour + 1,
    avg_price_eur_per_kwh: round(bestAvg, 4),
  };
}

function round(n: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

// ---- View builders ----

function buildTodayViewFromRecords(
  records: TimeseriesRecord[],
  date: string,
  hour: number,
): TodayView {
  const day = recordsForDate(records, date);
  const hourly = aggregateHourly(day);
  const summary = summarizeDay(day, date);

  const target = `${date}T${String(hour).padStart(2, "0")}:00`;
  const live =
    day.find((r) => r.timestamp.startsWith(target)) ??
    day[Math.min(hour * 4, day.length - 1)] ??
    day[day.length - 1] ??
    records[records.length - 1];

  const now: LiveSnapshot = {
    timestamp: live.timestamp,
    pv_kw: round(live.pv_production_kw, 2),
    house_load_kw: round(live.house_load_kw, 2),
    heatpump_kw: round(live.heatpump_kw, 2),
    ev_kw: round(live.ev_charging_kw, 2),
    battery_charge_kw: round(live.battery_charge_kw, 2),
    battery_discharge_kw: round(live.battery_discharge_kw, 2),
    battery_soc_pct: round(live.battery_soc_pct, 1),
    grid_import_kw: round(live.grid_import_kw, 2),
    grid_export_kw: round(live.grid_export_kw, 2),
    price_eur_per_kwh: round(live.price_eur_per_kwh, 4),
    outdoor_temp_c: round(live.outdoor_temp_c, 1),
  };

  return {
    date,
    summary,
    hourly,
    cheapest_3h_window: cheapestWindow(hourly, 3),
    now,
  };
}

export async function buildTodayView(
  householdId: string,
  origin: string,
  date: string = DEMO_TODAY,
  hour: number = DEMO_NOW_HOUR,
): Promise<TodayView> {
  const records = await getTimeseries(householdId, origin);
  return buildTodayViewFromRecords(records, date, hour);
}

export type ComparisonMode = "1w" | "1mo" | "1y";

export type ComparisonView = {
  today: TodayView;
  baseline: TodayView;
  baselineDate: string;
  cmp: ComparisonMode;
  synthetic: boolean; // true when baseline was clamped to dataset bounds
  dateRange: { min: string; max: string };
};

function clampDate(date: string, min: string, max: string) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export async function buildComparisonView(
  householdId: string,
  origin: string,
  date: string,
  hour: number,
  cmp: ComparisonMode,
): Promise<ComparisonView> {
  const records = await getTimeseries(householdId, origin);
  const minDate = dateKey(records[0].timestamp);
  const maxDate = dateKey(records[records.length - 1].timestamp);

  const safeDate = clampDate(date, minDate, maxDate);
  const offsetDays = cmp === "1w" ? -7 : cmp === "1mo" ? -30 : -365;
  const rawBaseline = addDays(safeDate, offsetDays);
  const baselineDate = clampDate(rawBaseline, minDate, maxDate);
  const synthetic = baselineDate !== rawBaseline;

  const today = buildTodayViewFromRecords(records, safeDate, hour);
  const baseline = buildTodayViewFromRecords(records, baselineDate, hour);

  return {
    today,
    baseline,
    baselineDate,
    cmp,
    synthetic,
    dateRange: { min: minDate, max: maxDate },
  };
}

export type WeeklyView = {
  week_actual_cost_eur: number;
  week_baseline_cost_eur: number;
  week_saved_eur: number;
  week_consumption_kwh: number;
  loads_shifted_count: number;
  loads_shifted_savings_eur: number;
  days: DailySummary[];
};

export async function buildWeeklyView(householdId: string, origin: string): Promise<WeeklyView> {
  const records = await getTimeseries(householdId, origin);
  const tariff = getTariff(getHousehold(householdId).tariff_id);
  const start = addDays(DEMO_TODAY, -6);
  const days: DailySummary[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    days.push(summarizeDay(recordsForDate(records, d), d));
  }
  const weekActual = days.reduce((s, d) => s + d.energy_cost_eur, 0);
  const weekConsumption = days.reduce((s, d) => s + d.consumption_kwh, 0);

  // baseline = if 100% of consumption was bought from grid at average price
  const window = recordsBetween(records, start, DEMO_TODAY);
  const avgPrice =
    window.length > 0
      ? window.reduce((s, r) => s + r.price_eur_per_kwh, 0) / window.length
      : tariff.type === "fixed_rate"
        ? tariff.energy_rate_eur_per_kwh
        : 0.45;
  const weekBaseline = weekConsumption * avgPrice;

  // synthetic: pretend any hour where grid_export>0 AND consumption>0.5 was a shift
  let shifts = 0;
  let shiftsSavings = 0;
  for (const d of days) {
    if (d.grid_export_kwh > 5) {
      shifts += 1;
      shiftsSavings += Math.max(0, (avgPrice - 0.15) * Math.min(d.grid_export_kwh, 5));
    }
  }

  return {
    week_actual_cost_eur: round(weekActual, 2),
    week_baseline_cost_eur: round(weekBaseline, 2),
    week_saved_eur: round(weekBaseline - weekActual, 2),
    week_consumption_kwh: round(weekConsumption, 1),
    loads_shifted_count: shifts,
    loads_shifted_savings_eur: round(shiftsSavings, 2),
    days,
  };
}

export async function buildLast30Days(
  householdId: string,
  origin: string,
): Promise<{ days: DailySummary[] }> {
  const records = await getTimeseries(householdId, origin);
  const start = addDays(DEMO_TODAY, -29);
  const days: DailySummary[] = [];
  for (let i = 0; i < 30; i++) {
    const d = addDays(start, i);
    days.push(summarizeDay(recordsForDate(records, d), d));
  }
  return { days };
}

export type EnergyDaySegment = {
  start_hour: number;
  end_hour: number;
  kind: "solar" | "battery" | "cheap" | "peak";
};

export type EnergyDayMetric = {
  label: string;
  value: string;
  sub: string;
};

export type EnergyDayRecommendation = {
  title: string;
  body: string;
  cta: string;
  icon: "car" | "thermometer" | "spark";
  tone: "red" | "amber" | "blue";
  estimated_savings_eur: number;
};

export type EnergyDayView = {
  household: ReturnType<typeof getHouseholdView>["household"];
  tariff: ReturnType<typeof getHouseholdView>["tariff"];
  date: string;
  season: "summer" | "winter";
  summary: DailySummary;
  segments: EnergyDaySegment[];
  metrics: EnergyDayMetric[];
  recommendations: EnergyDayRecommendation[];
};

function fallbackDayRecords(householdId: string, date: string): TimeseriesRecord[] {
  const household = getHousehold(householdId);
  const tariff = getTariff(household.tariff_id);
  const month = getMonthlyBillsFor(householdId).find((b) => b.month === date.slice(0, 7));
  const dailyConsumption = (month?.consumption_kwh ?? 450) / 30;
  const dailyPv = (month?.pv_production_kwh ?? household.pv_kwp * 80) / 30;
  const feedPrice = tariff.type === "fixed_rate" ? tariff.energy_rate_eur_per_kwh : 0.42;
  const records: TimeseriesRecord[] = [];

  for (let i = 0; i < 96; i++) {
    const hour = Math.floor(i / 4);
    const minute = (i % 4) * 15;
    const sun = Math.max(0, Math.sin(((hour + minute / 60 - 6) / 12) * Math.PI));
    const pvKw = (dailyPv * sun) / 3.8;
    const evening = hour >= 18 && hour <= 21 ? 1.45 : 1;
    const baseLoad = (dailyConsumption / 24) * evening;
    const heatpump = household.heat_pump && date < "2025-03-01" ? 1.2 + (hour >= 18 ? 0.8 : 0) : 0;
    const ev = household.ev_charger && hour >= 0 && hour < 2 ? 5.5 : 0;
    const total = baseLoad + heatpump + ev;
    const price =
      tariff.type === "fixed_rate"
        ? tariff.energy_rate_eur_per_kwh
        : feedPrice + (hour >= 18 && hour <= 20 ? 0.1 : hour >= 11 && hour <= 14 ? -0.06 : 0);
    const surplus = pvKw - total;
    const batteryDischarge =
      surplus < 0 && hour >= 17 && household.battery_kwh > 0
        ? Math.min(-surplus, household.battery_power_kw, 2.5)
        : 0;
    const gridImport = Math.max(0, total - pvKw - batteryDischarge);
    const gridExport = Math.max(0, surplus);
    records.push({
      timestamp: `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
      outdoor_temp_c: date < "2025-03-01" ? 4 : 24,
      pv_production_kw: pvKw,
      house_load_kw: baseLoad,
      heatpump_kw: heatpump,
      ev_charging_kw: ev,
      total_consumption_kw: total,
      battery_charge_kw: gridExport > 0 ? Math.min(gridExport, household.battery_power_kw) : 0,
      battery_discharge_kw: batteryDischarge,
      battery_soc_kwh: household.battery_kwh * (hour < 17 ? 0.7 : 0.35),
      battery_soc_pct: household.battery_kwh > 0 ? (hour < 17 ? 70 : 35) : 0,
      grid_import_kw: gridImport,
      grid_export_kw: gridExport,
      price_eur_per_kwh: price,
    });
  }
  return records;
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function mergeSegments(hours: EnergyDaySegment[]): EnergyDaySegment[] {
  return hours.reduce<EnergyDaySegment[]>((acc, segment) => {
    const last = acc[acc.length - 1];
    if (last && last.kind === segment.kind && last.end_hour === segment.start_hour) {
      last.end_hour = segment.end_hour;
    } else {
      acc.push({ ...segment });
    }
    return acc;
  }, []);
}

export async function buildEnergyDayView(
  householdId: string,
  origin: string,
  season: "summer" | "winter" = "summer",
): Promise<EnergyDayView> {
  const household = getHousehold(householdId);
  const tariff = getTariff(household.tariff_id);
  const date = season === "summer" ? DEMO_TODAY : "2025-01-15";
  const records = await getTimeseries(householdId, origin).catch(() =>
    fallbackDayRecords(householdId, date),
  );
  const day = recordsForDate(records, date);
  const hourly = aggregateHourly(day);
  const summary = summarizeDay(day, date);
  const feedIn = "feed_in_eur_per_kwh" in tariff ? tariff.feed_in_eur_per_kwh : 0.081;
  const prices = hourly.map((h) => h.price_eur_per_kwh);
  const cheapest = hourly.reduce(
    (best, h) => (h.price_eur_per_kwh < best.price_eur_per_kwh ? h : best),
    hourly[0],
  );
  const expensive = hourly.reduce(
    (best, h) => (h.price_eur_per_kwh > best.price_eur_per_kwh ? h : best),
    hourly[0],
  );
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const peakThreshold = sortedPrices[Math.max(0, Math.floor(sortedPrices.length * 0.75))] ?? 0.5;

  const segments = mergeSegments(
    hourly.map((h) => {
      const kind =
        h.price_eur_per_kwh >= peakThreshold && h.grid_import_kwh > 0.2
          ? "peak"
          : h.pv_kwh >= h.consumption_kwh * 0.65
            ? "solar"
            : h.battery_soc_pct_end > 35 && h.grid_import_kwh < h.consumption_kwh * 0.45
              ? "battery"
              : "cheap";
      return { start_hour: h.hour, end_hour: h.hour + 1, kind };
    }),
  );

  const exported = summary.grid_export_kwh;
  const evGridKwh = day.reduce(
    (sum, r) => sum + Math.min(r.ev_charging_kw, r.grid_import_kw) * STEP_H,
    0,
  );
  const evGridCost = day.reduce(
    (sum, r) => sum + Math.min(r.ev_charging_kw, r.grid_import_kw) * STEP_H * r.price_eur_per_kwh,
    0,
  );
  const peakLoadKwh = hourly
    .filter((h) => h.hour >= 18 && h.hour < 21)
    .reduce((sum, h) => sum + h.grid_import_kwh, 0);
  const peakAvg = hourly
    .filter((h) => h.hour >= 18 && h.hour < 21)
    .reduce((sum, h, _, arr) => sum + h.price_eur_per_kwh / Math.max(arr.length, 1), 0);

  const recs: EnergyDayRecommendation[] = [
    {
      title: household.ev_charger
        ? `Move EV charging to ${hourLabel(cheapest.hour)}`
        : `Run flexible appliances at ${hourLabel(cheapest.hour)}`,
      body: household.ev_charger
        ? `Your EV uses ${round(evGridKwh, 1)} kWh from the grid today. Moving it from costly hours toward ${hourLabel(cheapest.hour)} at €${cheapest.price_eur_per_kwh.toFixed(2)}/kWh and available solar export can save about €${round(Math.max(0, evGridCost - evGridKwh * Math.max(feedIn, cheapest.price_eur_per_kwh - 0.08)), 2).toFixed(2)}.`
        : `Your cheapest flexible-load window is ${hourLabel(cheapest.hour)} at €${cheapest.price_eur_per_kwh.toFixed(2)}/kWh. Shift dishwasher, laundry, or drying away from peak grid hours.`,
      cta: household.ev_charger ? "Why can't the battery cover it?" : "Plan flexible loads",
      icon: "car",
      tone: "red",
      estimated_savings_eur: round(
        Math.max(0, evGridCost - evGridKwh * Math.max(feedIn, cheapest.price_eur_per_kwh - 0.08)),
        2,
      ),
    },
    {
      title: household.heat_pump
        ? `Pre-heat the house at ${hourLabel(cheapest.hour)}`
        : `Use solar surplus around ${hourLabel(cheapest.hour)}`,
      body: household.heat_pump
        ? `The cheapest hour is ${hourLabel(cheapest.hour)} (€${cheapest.price_eur_per_kwh.toFixed(2)}/kWh) while peak hits ${hourLabel(expensive.hour)} (€${expensive.price_eur_per_kwh.toFixed(2)}/kWh). Pre-heating with cheap solar/grid energy avoids roughly €${round(Math.max(0, (expensive.price_eur_per_kwh - cheapest.price_eur_per_kwh) * Math.max(2, summary.heatpump_kwh * 0.18)), 2).toFixed(2)}.`
        : `You export ${exported.toFixed(1)} kWh today at €${feedIn.toFixed(2)}/kWh. Use that surplus locally instead of buying later at €${expensive.price_eur_per_kwh.toFixed(2)}/kWh.`,
      cta: household.heat_pump ? "Set up a pre-heat schedule" : "Use solar locally",
      icon: "thermometer",
      tone: "amber",
      estimated_savings_eur: round(
        Math.max(
          0,
          (expensive.price_eur_per_kwh - cheapest.price_eur_per_kwh) *
            Math.max(2, summary.heatpump_kwh * 0.18),
        ),
        2,
      ),
    },
    {
      title: "Avoid heavy loads 18:00–20:00",
      body: `Evening peak averages €${peakAvg.toFixed(2)}/kWh with little solar left. Holding ${round(Math.min(peakLoadKwh, 4), 1)} kWh of discretionary load until a cheaper period could save about €${round(Math.max(0, (peakAvg - cheapest.price_eur_per_kwh) * Math.min(peakLoadKwh, 4)), 2).toFixed(2)}.`,
      cta: "Show peak-hour plan",
      icon: "spark",
      tone: "blue",
      estimated_savings_eur: round(
        Math.max(0, (peakAvg - cheapest.price_eur_per_kwh) * Math.min(peakLoadKwh, 4)),
        2,
      ),
    },
  ].sort((a, b) => b.estimated_savings_eur - a.estimated_savings_eur);

  return {
    household,
    tariff,
    date,
    season,
    summary,
    segments,
    metrics: [
      {
        label: "Solar given away today",
        value: `${exported.toFixed(0)} kWh`,
        sub: `sold at €${feedIn.toFixed(2)}`,
      },
      {
        label: "Cheapest hour",
        value: `€${cheapest.price_eur_per_kwh.toFixed(2)}`,
        sub: `${hourLabel(cheapest.hour)} solar dip`,
      },
      {
        label: "Most expensive hour",
        value: `€${expensive.price_eur_per_kwh.toFixed(2)}`,
        sub: `${hourLabel(expensive.hour)} peak`,
      },
      {
        label: household.ev_charger ? "Car charged from grid" : "Grid imported today",
        value: `${(household.ev_charger ? evGridKwh : summary.grid_import_kwh).toFixed(0)} kWh`,
        sub: `cost €${(household.ev_charger ? evGridCost : summary.energy_cost_eur).toFixed(2)}`,
      },
    ],
    recommendations: recs.slice(0, 3),
  };
}

// ---- Reference passthroughs ----

export function getMonthlyBillsView(householdId: string): MonthlyBill[] {
  return getMonthlyBillsFor(householdId);
}

export function getInsightsView(householdId: string): InsightEvent[] {
  return getInsightsFor(householdId);
}

export function getContractView(householdId: string) {
  return getContractFor(householdId);
}

export function getHouseholdView(householdId: string) {
  const hh = getHousehold(householdId);
  const tariff = getTariff(hh.tariff_id);
  return { household: hh, tariff };
}
