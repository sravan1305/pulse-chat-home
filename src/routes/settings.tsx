import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import households from "@/data/raw/households.json";
import {
  APPLIANCE_LABEL,
  loadOnboarding,
  saveOnboarding,
  type ApplianceAnswer,
  type ApplianceType,
  type DeadlineEntry,
  type Frequency,
  type NotificationPref,
  type OnboardingAnswers,
  type OvernightPref,
  type Priority,
  type SmartState,
} from "@/lib/onboarding";

type HouseholdLite = { household_id: string; name: string; city: string };
const HOUSEHOLDS = households as HouseholdLite[];

const APPLIANCE_TYPES: ApplianceType[] = [
  "dishwasher",
  "washing_machine",
  "tumble_dryer",
  "water_heater",
  "pool_pump",
];

const SMART_LABEL: Record<SmartState, string> = {
  smart: "Smart",
  regular: "Regular",
  not_sure: "Not sure",
};
const FREQ_LABEL: Record<Frequency, string> = {
  daily: "Daily",
  few_times_week: "A few times a week",
  rarely: "Rarely",
};
const OVERNIGHT_LABEL: Record<OvernightPref, string> = {
  anytime: "Anytime is fine",
  only_while_home: "Only while someone's home",
  not_overnight: "Not overnight",
};
const PRIORITY_LABEL: Record<Priority, string> = {
  save_money: "Save money",
  reduce_co2: "Reduce CO₂",
  both_equally: "Both equally",
};
const NOTIF_LABEL: Record<NotificationPref, string> = {
  notify_me: "Notify me",
  automatic: "Automatic",
  check_app: "Check the app",
};

const EMPTY: OnboardingAnswers = {
  household_id: undefined,
  appliances: [],
  overnight_preference: undefined,
  deadlines: [],
  priority: undefined,
  notification_preference: undefined,
};

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Enpal Pulse" },
      { name: "description", content: "Edit your Enpal Pulse setup." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<OnboardingAnswers>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = loadOnboarding();
    if (!saved?.household_id) {
      navigate({ to: "/" });
      return;
    }
    setDraft(saved);
    setLoaded(true);
  }, [navigate]);

  if (!loaded) {
    return (
      <AppShell>
        <div className="text-stone">Loading…</div>
      </AppShell>
    );
  }


  const toggleAppliance = (t: ApplianceType) => {
    setDraft((d) => {
      const has = d.appliances.find((a) => a.type === t);
      if (has) {
        return { ...d, appliances: d.appliances.filter((a) => a.type !== t) };
      }
      const fresh: ApplianceAnswer = { type: t, smart: "not_sure", frequency: "rarely" };
      return { ...d, appliances: [...d.appliances, fresh] };
    });
  };

  const updateAppliance = (t: ApplianceType, patch: Partial<ApplianceAnswer>) => {
    setDraft((d) => ({
      ...d,
      appliances: d.appliances.map((a) => (a.type === t ? { ...a, ...patch } : a)),
    }));
  };

  const upsertDeadline = (entry: DeadlineEntry) => {
    setDraft((d) => {
      const others = d.deadlines.filter((x) => x.type !== entry.type);
      return entry.time
        ? { ...d, deadlines: [...others, entry] }
        : { ...d, deadlines: others };
    });
  };

  const onSave = () => {
    saveOnboarding({ ...draft, completed_at: new Date().toISOString() });
    toast.success("Setup saved");
    navigate({ to: "/" });
  };

  const onCancel = () => navigate({ to: "/" });

  const selectedHh = HOUSEHOLDS.find((h) => h.household_id === draft.household_id);

  const Row = ({
    label,
    hint,
    children,
  }: {
    label: string;
    hint?: string;
    children: React.ReactNode;
  }) => (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 md:gap-6 py-5 border-b border-border last:border-b-0">
      <div>
        <div className="text-navy font-semibold">{label}</div>
        {hint && <div className="text-stone text-sm mt-1">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-stone font-semibold text-sm uppercase tracking-wider">Settings</p>
            <h1 className="mt-2 text-navy">Edit your setup</h1>
            <p className="text-stone mt-2">
              Update any of these — we'll re-tailor recommendations next time you open the app.
            </p>
          </div>
          {selectedHh && (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-wider text-stone font-semibold">
                Signed in as
              </div>
              <div className="text-navy font-semibold mt-1">{selectedHh.name}</div>
              <div className="text-stone text-sm">{selectedHh.city}</div>
            </div>
          )}
        </div>

        <section className="card-soft p-6">
          <h2 className="text-navy text-lg font-semibold mb-2">Appliances</h2>
          <p className="text-stone text-sm mb-4">
            Which appliances you use, and how often.
          </p>
          <div className="space-y-3">
            {APPLIANCE_TYPES.map((t) => {
              const a = draft.appliances.find((x) => x.type === t);
              const enabled = Boolean(a);
              return (
                <div
                  key={t}
                  className="flex flex-wrap items-center gap-3 border-b border-border last:border-b-0 pb-3 last:pb-0"
                >
                  <label className="flex items-center gap-2 min-w-[200px]">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleAppliance(t)}
                      className="h-4 w-4 accent-navy"
                    />
                    <span className="text-navy font-medium">{APPLIANCE_LABEL[t]}</span>
                  </label>
                  {enabled && a && (
                    <div className="flex gap-2 flex-wrap">
                      <Select
                        value={a.smart}
                        onValueChange={(v) => updateAppliance(t, { smart: v as SmartState })}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(SMART_LABEL) as SmartState[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {SMART_LABEL[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={a.frequency}
                        onValueChange={(v) => updateAppliance(t, { frequency: v as Frequency })}
                      >
                        <SelectTrigger className="w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(FREQ_LABEL) as Frequency[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {FREQ_LABEL[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="card-soft p-6">
          <h2 className="text-navy text-lg font-semibold mb-4">Preferences</h2>
          <div>
            <Row label="Overnight runs" hint="When are noisy appliances OK to run?">
              <Select
                value={draft.overnight_preference ?? ""}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, overnight_preference: v as OvernightPref }))
                }
              >
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(OVERNIGHT_LABEL) as OvernightPref[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {OVERNIGHT_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>

            <Row label="Priority" hint="What should we optimise for?">
              <Select
                value={draft.priority ?? ""}
                onValueChange={(v) => setDraft((d) => ({ ...d, priority: v as Priority }))}
              >
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PRIORITY_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>

            <Row label="Notifications" hint="How should we let you know about recommendations?">
              <Select
                value={draft.notification_preference ?? ""}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, notification_preference: v as NotificationPref }))
                }
              >
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(NOTIF_LABEL) as NotificationPref[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {NOTIF_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </div>
        </section>

        <section className="card-soft p-6">
          <h2 className="text-navy text-lg font-semibold mb-2">Deadlines</h2>
          <p className="text-stone text-sm mb-4">
            By when do these need to be ready each day?
          </p>
          <div className="space-y-2">
            {(["ev_charger", "dishwasher", "washing_machine"] as const).map((d) => {
              const cur = draft.deadlines.find((x) => x.type === d)?.time ?? "";
              const label = d === "ev_charger" ? "EV charger" : APPLIANCE_LABEL[d];
              return (
                <div key={d} className="flex items-center justify-between gap-3 max-w-sm">
                  <span className="text-navy">{label}</span>
                  <input
                    type="time"
                    value={cur}
                    onChange={(e) => upsertDeadline({ type: d, time: e.target.value })}
                    className="h-10 rounded-lg border border-border px-3 text-navy font-semibold focus:border-navy focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button onClick={onSave} className="bg-cta text-navy hover:bg-cta/90">
            Save changes
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

