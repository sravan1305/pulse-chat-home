import { useMemo, useState } from "react";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type CmpMode = "1w" | "1mo" | "1y";

const CMP_LABEL: Record<CmpMode, string> = {
  "1w": "1 week ago",
  "1mo": "1 month ago",
  "1y": "1 year ago",
};

function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtLong(s: string) {
  return parseISODate(s).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtShort(s: string) {
  return parseISODate(s).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function HomeHeader({
  date,
  cmp,
  baselineDate,
  synthetic,
  range,
  todayTemp,
  baselineTemp,
  city,
}: {
  date: string;
  cmp: CmpMode;
  baselineDate: string;
  synthetic: boolean;
  range: { min: string; max: string };
  todayTemp: number;
  baselineTemp: number;
  city: string;
}) {
  const navigate = useNavigate({ from: "/" });
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => parseISODate(date), [date]);
  const minDate = useMemo(() => parseISODate(range.min), [range.min]);
  const maxDate = useMemo(() => parseISODate(range.max), [range.max]);

  const setDate = (d: Date | undefined) => {
    if (!d) return;
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, date: toISODate(d) }) });
    setOpen(false);
  };
  const setCmp = (next: CmpMode) => {
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, cmp: next }) });
  };

  const tempDelta = todayTemp - baselineTemp;
  const tempLabel =
    Math.abs(tempDelta) < 0.5
      ? "similar weather"
      : `${tempDelta > 0 ? "+" : ""}${tempDelta.toFixed(1)}°C vs baseline`;

  return (
    <div className="card-soft p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 font-display text-navy h-10">
              <CalendarIcon className="w-4 h-4" />
              {fmtLong(date)}
              <ChevronDown className="w-4 h-4 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={setDate}
              defaultMonth={selected}
              disabled={{ before: minDate, after: maxDate }}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone">
            Compare to
          </span>
          <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
            {(["1w", "1mo", "1y"] as CmpMode[]).map((m) => {
              const active = cmp === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCmp(m)}
                  className={cn(
                    "px-3 h-8 text-xs font-semibold rounded-md transition",
                    active
                      ? "bg-navy text-white"
                      : "text-stone hover:text-navy",
                  )}
                  aria-pressed={active}
                  title={CMP_LABEL[m]}
                >
                  {m === "1w" ? "1W" : m === "1mo" ? "1M" : "1Y"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone">
        <span>{city}</span>
        <span className="opacity-40">·</span>
        <span>{Math.round(todayTemp)}°C today</span>
        <span className="opacity-40">·</span>
        <span>
          Baseline: <span className="text-navy font-medium">{fmtShort(baselineDate)}</span>
          {" "}
          <span className="opacity-70">({Math.round(baselineTemp)}°C, {tempLabel})</span>
        </span>
        {synthetic && (
          <span
            className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-cta/30 text-navy"
            title="The demo dataset only covers 2025, so the baseline was clamped to the earliest available date."
          >
            Synthetic
          </span>
        )}
      </div>
    </div>
  );
}
