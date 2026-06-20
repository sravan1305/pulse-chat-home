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

export async function buildLast30Days(householdId: string, origin: string): Promise<{ days: DailySummary[] }> {
  const records = await getTimeseries(householdId, origin);
  const start = addDays(DEMO_TODAY, -29);
  const days: DailySummary[] = [];
  for (let i = 0; i < 30; i++) {
    const d = addDays(start, i);
    days.push(summarizeDay(recordsForDate(records, d), d));
  }
  return { days };
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

export type YearTotals = {
  year: string;
  months_counted: number;
  consumption_kwh: number;
  pv_production_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  energy_cost_eur: number;
  base_fee_eur: number;
  feed_in_credit_eur: number;
  total_bill_eur: number;
  self_sufficiency_pct: number;
};

export function summarizeYear(bills: MonthlyBill[], year: string): YearTotals {
  const inYear = bills.filter((b) => b.month.startsWith(year));
  const sum = (key: keyof MonthlyBill) =>
    inYear.reduce((acc, b) => acc + (typeof b[key] === "number" ? (b[key] as number) : 0), 0);
  const cons = sum("consumption_kwh");
  const gi = sum("grid_import_kwh");
  return {
    year,
    months_counted: inYear.length,
    consumption_kwh: round(cons, 1),
    pv_production_kwh: round(sum("pv_production_kwh"), 1),
    grid_import_kwh: round(gi, 1),
    grid_export_kwh: round(sum("grid_export_kwh"), 1),
    energy_cost_eur: round(sum("energy_cost_eur"), 2),
    base_fee_eur: round(sum("base_fee_eur"), 2),
    feed_in_credit_eur: round(sum("feed_in_credit_eur"), 2),
    total_bill_eur: round(sum("total_bill_eur"), 2),
    self_sufficiency_pct: cons > 0 ? round(((cons - gi) / cons) * 100, 1) : 0,
  };
}

