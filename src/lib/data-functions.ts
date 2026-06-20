import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  buildComparisonView,
  buildEnergyDayView,
  buildLast30Days,
  buildTodayView,
  buildWeeklyView,
  getContractView,
  getHouseholdView,
  getInsightsView,
  getMonthlyBillsView,
} from "./aggregations.server";
import { listHouseholds } from "./data-loader.server";
import { DEMO_NOW_HOUR, DEMO_TODAY } from "./demo-config";

const householdInput = z.object({ householdId: z.string() });
const energyDayInput = z.object({
  householdId: z.string(),
  season: z.enum(["summer", "winter"]).default("summer"),
});

const homeInput = z.object({
  householdId: z.string(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default(DEMO_TODAY),
  hour: z.number().int().min(0).max(23).default(DEMO_NOW_HOUR),
  cmp: z.enum(["1w", "1mo", "1y"]).default("1w"),
});

function origin() {
  return getRequestUrl().origin;
}

export const listHouseholdsFn = createServerFn({ method: "GET" }).handler(async () => {
  return listHouseholds();
});

export const getHouseholdSummaryFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => householdInput.parse(input))
  .handler(async ({ data }) => {
    const [view, today, bills, insights] = await Promise.all([
      Promise.resolve(getHouseholdView(data.householdId)),
      buildTodayView(data.householdId, origin()),
      Promise.resolve(getMonthlyBillsView(data.householdId)),
      Promise.resolve(getInsightsView(data.householdId)),
    ]);
    return { ...view, today, bills, insights };
  });

export const getHomeComparisonFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => homeInput.parse(input))
  .handler(async ({ data }) => {
    const [view, comparison, bills, insights] = await Promise.all([
      Promise.resolve(getHouseholdView(data.householdId)),
      buildComparisonView(data.householdId, origin(), data.date, data.hour, data.cmp),
      Promise.resolve(getMonthlyBillsView(data.householdId)),
      Promise.resolve(getInsightsView(data.householdId)),
    ]);
    return { ...view, comparison, bills, insights };
  });

export const getWeeklyViewFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => householdInput.parse(input))
  .handler(async ({ data }) => {
    const [weekly, insights, bills] = await Promise.all([
      buildWeeklyView(data.householdId, origin()),
      Promise.resolve(getInsightsView(data.householdId)),
      Promise.resolve(getMonthlyBillsView(data.householdId)),
    ]);
    return { weekly, insights, bills };
  });

export const getEnergyDayFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => energyDayInput.parse(input))
  .handler(async ({ data }) => buildEnergyDayView(data.householdId, origin(), data.season));

export const getContractFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => householdInput.parse(input))
  .handler(async ({ data }) => getContractView(data.householdId));

export const getLast30Fn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => householdInput.parse(input))
  .handler(async ({ data }) => buildLast30Days(data.householdId, origin()));
