
## Goal
Keep every piece of information the current `EnergyFlow` shows (solar, battery SoC, grid import/export, house load, heat pump, EV, current price, live status headline), but drop the busy animated SVG and glow effects so the Home screen feels calm and scannable.

## Approach
Replace the animated orbital SVG in `src/components/EnergyFlow.tsx` with a quieter card-based "Home right now" panel. Same data, same brand tokens (navy surface, grass green for production, red for consumption, CTA yellow for the house total), but no moving dashes, no ambient glow blobs, no pulsing live dot.

## New layout (single component, same props — no data/aggregation changes)

```text
┌─ Home right now ───────────────────── €0.28/kWh ─┐
│  Running on your own solar                       │
│                                                  │
│  ┌──────────── House load ────────────┐          │
│  │   2.4 kW   ▓▓▓▓▓▓░░░  of 6 kW peak │  ← hero  │
│  └────────────────────────────────────┘          │
│                                                  │
│  ┌────────┬────────┬────────┬────────┐           │
│  │ ☀ Solar│ 🔋 Batt│ ⚡ Grid │ 🔥 HP  │           │
│  │ 3.1 kW │ 78%    │ +0.4kW │ 0.8 kW │           │
│  │ produc.│ charg. │ export │ on     │           │
│  └────────┴────────┴────────┴────────┘           │
│  ┌────────┐                                      │
│  │ 🚗 EV  │  (only when active, otherwise muted) │
│  └────────┘                                      │
└──────────────────────────────────────────────────┘
```

- Header row: small "Live" pill (static dot, no ping), status headline colored by state, current price on the right.
- Hero row: house load as the big number with a thin progress bar vs. the household's peak (fallback: max of recent load).
- Tile grid: one tile per asset with icon, value+unit, and a one-word state (producing / charging / discharging / importing / exporting / idle). Tone (green/red/muted) comes from state, but it's a static colored border + label — no animation.
- Direction is conveyed with a tiny arrow glyph (↑ export, ↓ import, → discharge, ← charge) instead of moving dashes.

## What gets removed
- `<Flow>` animated `<path>` with `stroke-dashoffset` animate.
- Ambient radial-gradient glow divs.
- Pulsing "Live" ping.
- SVG `viewBox` + `foreignObject` node layout.

## What stays
- File path and export name (`EnergyFlow`, `EnergyFlowSnapshot`) so `src/routes/index.tsx` keeps working with no other edits.
- All values currently shown (pv_kw, battery_soc_pct + charge/discharge state, grid import/export, house_load_kw, heatpump_kw, ev_kw, price_eur_per_kwh) and the derived headline.
- Brand palette (`#072543` surface, `#76BE74`, `#FF6B6B`, `#FFD233`).

## Files touched
- `src/components/EnergyFlow.tsx` — rewrite render; keep props.

No changes to data, aggregations, routes, or other components.
