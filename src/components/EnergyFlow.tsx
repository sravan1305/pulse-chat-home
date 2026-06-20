import { Battery, Car, Flame, Home, Sun, Zap, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

export type EnergyFlowSnapshot = {
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
};

const C = {
  produce: "#76BE74",
  consume: "#FF6B6B",
  cta: "#FFD233",
  border: "rgba(255,255,255,0.10)",
  text: "rgba(255,255,255,0.65)",
  muted: "rgba(255,255,255,0.45)",
} as const;

function fmt(kw: number) {
  return kw < 0.05 ? "0.0" : kw.toFixed(1);
}

type Tone = "produce" | "consume" | "idle";

function Tile({
  icon,
  label,
  value,
  unit,
  state,
  tone,
  arrow,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  state: string;
  tone: Tone;
  arrow?: React.ReactNode;
}) {
  const accent = tone === "produce" ? C.produce : tone === "consume" ? C.consume : "rgba(255,255,255,0.20)";
  const valueColor = tone === "produce" ? C.produce : tone === "consume" ? C.consume : "#fff";
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${tone === "idle" ? C.border : accent + "55"}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.05)", color: tone === "produce" ? C.produce : tone === "consume" ? C.consume : "#fff" }}
        >
          {icon}
        </div>
        {arrow && <div style={{ color: accent }}>{arrow}</div>}
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] font-semibold" style={{ color: C.muted }}>
        {label}
      </div>
      <div className="leading-none">
        <span className="text-xl font-semibold" style={{ color: valueColor }}>
          {value}
        </span>
        <span className="text-[11px] ml-1" style={{ color: C.text }}>
          {unit}
        </span>
      </div>
      <div className="text-[11px] font-medium" style={{ color: tone === "idle" ? C.muted : accent }}>
        {state}
      </div>
    </div>
  );
}

export function EnergyFlow({
  snapshot,
  baselineSnapshot,
  baselineDate,
}: {
  snapshot: EnergyFlowSnapshot;
  baselineSnapshot?: EnergyFlowSnapshot & { outdoor_temp_c?: number };
  baselineDate?: string;
}) {
  const s = snapshot;
  const exporting = s.grid_export_kw > 0.05;
  const importing = s.grid_import_kw > 0.05;
  const charging = s.battery_charge_kw > 0.05;
  const discharging = s.battery_discharge_kw > 0.05;
  const pvOn = s.pv_kw > 0.05;
  const hpOn = s.heatpump_kw > 0.05;
  const evOn = s.ev_kw > 0.05;

  const headline = exporting
    ? "Exporting clean energy"
    : pvOn && !importing
      ? "Running on your own solar"
      : importing
        ? "Importing from grid"
        : discharging
          ? "Running on your battery"
          : "Idle";
  const headlineColor = exporting || (pvOn && !importing) || discharging ? C.produce : importing ? C.consume : C.text;

  // Hero house bar — scale against a sensible peak (6 kW) or actual if higher.
  const peak = Math.max(6, s.house_load_kw);
  const pct = Math.min(100, Math.round((s.house_load_kw / peak) * 100));

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border"
      style={{
        background: "linear-gradient(135deg, #072543 0%, #0a2d52 100%)",
        borderColor: C.border,
      }}
    >
      <div className="px-6 pt-6 md:px-8 md:pt-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full" style={{ background: C.produce }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: C.muted }}>
              Home right now
            </span>
          </div>
          <h2 className="mt-1" style={{ color: headlineColor }}>
            {headline}
          </h2>
        </div>
        {s.price_eur_per_kwh > 0 && (
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: C.muted }}>
              Current price
            </div>
            <div className="text-base font-semibold text-white">€{s.price_eur_per_kwh.toFixed(2)}<span className="text-xs font-medium" style={{ color: C.text }}>/kWh</span></div>
          </div>
        )}
      </div>

      {/* Hero: house load */}
      <div className="px-6 md:px-8 mt-6">
        <div
          className="rounded-2xl p-5 flex items-center gap-5"
          style={{ background: "rgba(255,210,51,0.06)", border: `1px solid ${C.cta}33` }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,210,51,0.12)", color: C.cta, border: `1px solid ${C.cta}55` }}
          >
            <Home className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: C.muted }}>
                House load
              </div>
              <div className="text-[11px]" style={{ color: C.muted }}>
                of {peak.toFixed(0)} kW peak
              </div>
            </div>
            <div className="mt-1 leading-none">
              <span className="text-3xl font-semibold" style={{ color: C.cta }}>{fmt(s.house_load_kw)}</span>
              <span className="text-sm ml-1.5" style={{ color: C.text }}>kW</span>
            </div>
            <div className="mt-3 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.cta }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tiles */}
      <div className="px-6 md:px-8 pb-7 mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile
          icon={<Sun className="w-4 h-4" />}
          label="Solar"
          value={fmt(s.pv_kw)}
          unit="kW"
          state={pvOn ? "Producing" : "Idle"}
          tone={pvOn ? "produce" : "idle"}
          arrow={pvOn ? <ArrowUp className="w-4 h-4" /> : null}
        />
        <Tile
          icon={<Battery className="w-4 h-4" />}
          label="Battery"
          value={`${Math.round(s.battery_soc_pct)}`}
          unit="%"
          state={discharging ? `Discharging ${fmt(s.battery_discharge_kw)} kW` : charging ? `Charging ${fmt(s.battery_charge_kw)} kW` : "Idle"}
          tone={discharging ? "produce" : charging ? "consume" : "idle"}
          arrow={discharging ? <ArrowRight className="w-4 h-4" /> : charging ? <ArrowLeft className="w-4 h-4" /> : null}
        />
        <Tile
          icon={<Zap className="w-4 h-4" />}
          label="Grid"
          value={fmt(exporting ? s.grid_export_kw : s.grid_import_kw)}
          unit="kW"
          state={exporting ? "Exporting" : importing ? "Importing" : "Idle"}
          tone={exporting ? "produce" : importing ? "consume" : "idle"}
          arrow={exporting ? <ArrowUp className="w-4 h-4" /> : importing ? <ArrowDown className="w-4 h-4" /> : null}
        />
        <Tile
          icon={<Flame className="w-4 h-4" />}
          label="Heat pump"
          value={fmt(s.heatpump_kw)}
          unit="kW"
          state={hpOn ? "Heating" : "Off"}
          tone={hpOn ? "consume" : "idle"}
        />
        <Tile
          icon={<Car className="w-4 h-4" />}
          label="EV"
          value={fmt(s.ev_kw)}
          unit="kW"
          state={evOn ? "Charging" : "Not plugged in"}
          tone={evOn ? "consume" : "idle"}
        />
      </div>
    </section>
  );
}
