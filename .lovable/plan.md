# Date-aware Home with "vs baseline" comparison

Turn the Home view into a time-travel dashboard: pick any date in the 2025 dataset, pick a baseline (1 week / 1 month / synthetic "last year"), and see the live snapshot and day totals next to the baseline with deltas.

## UX

Home header (replaces the static date line):

```text
Good day, Müller Family
┌─────────────────────────────────────────────────────────────┐
│ [📅 Sun, 15 Jun 2025 ▾]   compare to:  (1w) (1mo) (1y)*    │
│ Munich · 22 °C  ·  baseline: Sun 8 Jun 2025 · 18 °C ☁       │
└─────────────────────────────────────────────────────────────┘
```

- Date picker = shadcn `Calendar` in a `Popover`, constrained to the dates available in the active household's timeseries.
- Baseline toggle = 3-option segmented control. `1y` is a synthetic shift (same calendar day, label says "vs last year" but pulls from the same 2025 dataset shifted by ±N days — see Technical).
- Whole Home view (live tiles, chips, insight) reflects the **selected** date/hour.
- A new compact **"vs baseline" strip** sits under the EnergyFlow panel.

The strip shows 4 metrics with delta arrows and color (grass = better, red = worse):

```text
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Solar today  │ Used today   │ Self-suff.   │ Day cost     │
│ 32.4 kWh     │ 21.8 kWh     │ 78 %         │ € 1.42       │
│ ↑ +4.1 kWh   │ ↓ −2.0 kWh   │ ↑ +9 pp      │ ↓ −€0.61     │
│ vs 8 Jun     │ vs 8 Jun     │ vs 8 Jun     │ vs 8 Jun     │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

Live tile panel (`EnergyFlow`) gains a one-line footer:

> *At 14:00 on 8 Jun: 4.1 kW solar, 1.2 kW grid import, 12 °C cloudier.*

Existing chips (Solar today / Used today / Saved vs last mo / etc.) stay; the Insight card stays.

## Data model & technical details

State lives in URL search params on `/`:

- `hh` (existing) — household id
- `date` — `YYYY-MM-DD`, defaults to `DEMO_TODAY` (2025-06-15)
- `hour` — `0-23`, defaults to `DEMO_NOW_HOUR` (14). Reserved for a future hour slider; for now set via picker quick-actions.
- `cmp` — `"1w" | "1mo" | "1y"`, default `"1w"`

Validated via `zodValidator` + `fallback`. Declared in `loaderDeps` so the loader re-runs on change.

New server function `getHomeComparisonFn({ householdId, date, hour, cmp })` in `src/lib/data-functions.ts`:

1. Load the household timeseries (existing `getTimeseries`).
2. Build `TodayView` for `date` (refactor `buildTodayView` in `src/lib/aggregations.server.ts` to accept a `date` + `hour` instead of hardcoded `DEMO_TODAY` / `DEMO_NOW_HOUR`; pass defaults from current constants for backward compat).
3. Compute baseline date:
   - `1w` → date − 7 days
   - `1mo` → date − 30 days (or same day-of-month if available)
   - `1y` → date − 365 days; if outside the dataset range (it will be, since data is 2025-only), fall back to the same calendar date in the dataset and **label** as "vs last year" — note in tooltip: "Demo: synthesized from 2025 data."
4. Build a second `TodayView` for the baseline date.
5. Return `{ today: TodayView, baseline: TodayView, baselineDate, cmp, weatherDelta }`.

`weatherDelta` = `{ today_temp_c, baseline_temp_c, label }` derived from `outdoor_temp_c` at the selected hour on each date.

Home route (`src/routes/index.tsx`):

- Add `validateSearch`, `loaderDeps`, swap to `getHomeComparisonFn`.
- New `<HomeHeader />` component with date popover + cmp segmented control; updates URL via `useNavigate({ search: prev => ({...prev, date, cmp}) })`.
- New `<ComparisonStrip today={...} baseline={...} />` component rendered between `<EnergyFlow>` and the chips grid.
- `<EnergyFlow snapshot={today.now}>` extended with optional `baselineSnapshot` prop to render the one-line baseline footer (no animation changes).

Date-picker bounds: derive min/max from the timeseries (first/last record). Disable days outside.

## Files

- `src/routes/index.tsx` — add search schema, loaderDeps, header & strip, swap fn.
- `src/lib/aggregations.server.ts` — parameterize `buildTodayView(hh, date, hour)`; keep existing callers working with default args.
- `src/lib/data-functions.ts` — add `getHomeComparisonFn`.
- `src/components/HomeHeader.tsx` *(new)* — date popover + cmp toggle.
- `src/components/ComparisonStrip.tsx` *(new)* — 4-metric delta strip.
- `src/components/EnergyFlow.tsx` — optional `baselineSnapshot` footer line.

## Out of scope

- Hour scrubber (URL key reserved, UI deferred).
- Persisting last-picked date across sessions.
- Charts overlay (today vs baseline curves) — could be a follow-up.
- New routes; everything stays on `/`.
