# Rethink the dashboard — minimal Home, energy-infra "My Home", focused Insights

## 0. Naming

`/settings` stays as the **editable setup form** (preferences, deadlines, appliances) — reachable from the avatar menu.

The new descriptive page about the house's energy infrastructure needs a name distinct from "Profile" (which sounds like a user account). Suggestions, in order of preference:

1. **My Home** — friendly, matches the product voice ("Enpal Pulse — your home energy").
2. **System** — accurate (PV + battery + heat pump + tariff = the energy system), short.
3. **House** — minimal, but slightly ambiguous.
4. **Energy setup** — descriptive but collides with the word "setup" used for `/settings`.

Plan below uses **My Home** at route `/home-details` (URL kept neutral so we can rename the label without a route migration). Tell me if you prefer one of the others and I'll swap the label.

## 1. Anchor the demo to Dec 31, 2025

Change `src/lib/demo-config.ts`:

- `DEMO_TODAY = "2025-12-31"` — full 12 months of bills, winter "now".
- `DEMO_NOW_HOUR = 18` — dark, heating active, EV charging.

Everything reads from this constant, so the whole app time-travels in one edit. The calendar in `HomeHeader` still lets the user move within the dataset range.

## 2. New IA

| Tab | Purpose |
|---|---|
| Home | Minimal live snapshot of the home right now |
| My Home | Descriptive view of the energy infrastructure: assets, contract, tariff, yearly totals, bills |
| Insights | Recommendations + anomalies to act on |
| Chat | (unchanged) |

Avatar menu keeps **Edit setup → `/settings`** and **Sign out**.

Nav order in `AppShell.NAV`: Home · My Home · Insights · Chat. Mobile bottom-nav grid grows from 3 to 4.

## 3. Home — minimalistic

Three blocks, no chip grid:

1. **Greeting**: "Good evening, {name}" + small line "Wed, 31 Dec 2025 · {city}".
2. **Live state hero** — `EnergyFlow` in a new `compact` mode:
   - Headline ("Running on your battery" / "Importing from grid") + current grid price.
   - House-load bar.
   - 3 tiles only: Solar, Battery, Grid.
   - Hide heat-pump + EV tiles and the baseline footer.
3. **One-line today summary**: `Today: 4.2 kWh solar · 18.6 kWh used · 41% self-sufficient · €5.20 so far`.
4. **Single CTA**: "Ask Pulse →" → `/chat`.

Remove from Home: `ComparisonStrip`, 8-chip section, featured insight card, 3-card action grid. Comparison + insights live in `/insights`; assets/contract/bills live in `/home-details`.

## 4. My Home — `/home-details`

New route `src/routes/home-details.tsx`. New combined server fn `getMyHomeFn` returning `{ household, tariff, contract, bills, last30, yearTotals }`.

Sections, top to bottom:

1. **Household**: name, city, residents.
2. **Energy assets** (icon tiles from `contract.assets`): PV kWp, battery kWh + power kW, heat pump kW (if present), EV charger + EV battery kWh.
3. **Tariff & contract**:
   - Tariff name + model (dynamic/fixed), current effective rate, base fee, feed-in rate.
   - Contract start/end with a **term-progress bar** (start → end, today marker).
   - **Next notice deadline** (end − notice period weeks).
   - Minimum term, auto-renew window.
4. **2025 in numbers** (from `monthly_bills.json`, summed): total kWh consumed, produced, self-sufficiency avg, grid import/export kWh, total spend €, total feed-in credit €.
5. **Monthly bills chart**: 12 bars of `total_bill_eur` with `pv_production_kwh` overlay, plus a compact table.
6. **Last 30 days**: sparkline of daily energy cost from `buildLast30Days`.
7. **Edit setup** button → `/settings`.

Read-only page; nothing here writes back.

## 5. Insights — recommendations focus

Rewrite `src/routes/insights.tsx`:

1. **Recommendations** lead: all entries from `insight_events.json` for the household, grouped High → Info. Each card: type · period · title · detail · "Ask about this" → `/chat?q=…`.
2. **Compact weekly strip** below: 7-day cost bars + "saved this week" number as one secondary card.
3. Drop the duplicate "Recent insights" tail and the footer line.

## 6. Files touched

- `src/lib/demo-config.ts` — date + hour.
- `src/components/AppShell.tsx` — NAV + mobile bottom-nav.
- `src/routes/index.tsx` — strip Home down.
- `src/components/EnergyFlow.tsx` — add `compact` prop.
- `src/routes/home-details.tsx` — new.
- `src/lib/data-functions.ts` — add `getMyHomeFn`.
- `src/lib/aggregations.server.ts` — add `summarizeYear(bills)` helper.
- `src/routes/insights.tsx` — recommendations-first.

`src/routeTree.gen.ts` regenerates automatically.

## Out of scope

- No onboarding, chat, settings-form, or auth changes.
- No new data files.
- No design-token changes.
