import { useEffect, useMemo, useRef, useState } from "react";

import {
  AssistantBubble,
  ChatSurface,
  ChoiceChip,
  Composer,
  UserBubble,
} from "@/components/chat/ChatSurface";
import { useAuth } from "@/contexts/AuthContext";
import {
  APPLIANCE_LABEL,
  type ApplianceAnswer,
  type ApplianceType,
  type DeadlineEntry,
  type Frequency,
  type NotificationPref,
  type OnboardingAnswers,
  type OvernightPref,
  type Priority,
  type SmartState,
  saveOnboarding,
} from "@/lib/onboarding";
import householdsRaw from "@/data/raw/households.json";
import { DEFAULT_HOUSEHOLD_ID } from "@/lib/demo-config";

type HouseholdLite = { household_id: string; name: string; city: string };
const HOUSEHOLDS = householdsRaw as HouseholdLite[];

// Mock — in a real app these come from the account.
const ACCOUNT_HAS_EV_CHARGER = true;

type Msg =
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "user"; text: string; snapshotIndex?: number };

const APPLIANCE_OPTIONS: { type: ApplianceType; label: string }[] = [
  { type: "dishwasher", label: "Dishwasher" },
  { type: "washing_machine", label: "Washing machine" },
  { type: "tumble_dryer", label: "Tumble dryer" },
  { type: "water_heater", label: "Electric water heater" },
  { type: "pool_pump", label: "Pool pump" },
];

const SMART_LABEL: Record<SmartState, string> = {
  smart: "Smart / connected",
  regular: "Regular",
  not_sure: "Not sure",
};
const FREQ_LABEL: Record<Frequency, string> = {
  daily: "Daily",
  few_times_week: "A few times a week",
  rarely: "Rarely",
};
const OVERNIGHT_LABEL: Record<OvernightPref, string> = {
  anytime: "Yes, anytime is fine",
  only_while_home: "Only while someone's home",
  not_overnight: "Prefer not overnight",
};
const PRIORITY_LABEL: Record<Priority, string> = {
  save_money: "Mainly save money",
  reduce_co2: "Mainly reduce CO₂",
  both_equally: "Both equally",
};
const NOTIF_LABEL: Record<NotificationPref, string> = {
  notify_me: "Send me a notification",
  automatic: "Just do it automatically",
  check_app: "I'll check the app myself",
};

type Step =
  | { kind: "welcome" }
  | { kind: "appliances" }
  | { kind: "smart"; idx: number }
  | { kind: "frequency"; idx: number }
  | { kind: "overnight" }
  | { kind: "deadline_ask" }
  | { kind: "deadline_pick" }
  | { kind: "priority" }
  | { kind: "notification" }
  | { kind: "done" };

const TOTAL_STEPS = 7;

function stepProgress(step: Step): number {
  switch (step.kind) {
    case "welcome":
      return 0;
    case "appliances":
      return 1;
    case "smart":
    case "frequency":
      return 2;
    case "overnight":
      return 3;
    case "deadline_ask":
    case "deadline_pick":
      return 4;
    case "priority":
      return 5;
    case "notification":
      return 6;
    case "done":
      return 7;
  }
}

export function OnboardingChat({ onComplete }: { onComplete?: () => void } = {}) {
  const { user } = useAuth();
  const selectedHouseholdId = user?.id ?? DEFAULT_HOUSEHOLD_ID;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>({ kind: "welcome" });
  const [typing, setTyping] = useState(false);

  // Answers
  const [appliances, setAppliances] = useState<ApplianceType[]>([]);
  const [smartByAppliance, setSmartByAppliance] = useState<
    Partial<Record<ApplianceType, SmartState>>
  >({});
  const [freqByAppliance, setFreqByAppliance] = useState<Partial<Record<ApplianceType, Frequency>>>(
    {},
  );
  const [overnight, setOvernight] = useState<OvernightPref | undefined>();
  const [hasDeadline, setHasDeadline] = useState<boolean | null>(null);
  const [deadlines, setDeadlines] = useState<DeadlineEntry[]>([]);
  const [priority, setPriority] = useState<Priority | undefined>();
  const [notif, setNotif] = useState<NotificationPref | undefined>();

  // Multi-select draft for appliances step
  const [draftAppliances, setDraftAppliances] = useState<Set<ApplianceType | "none">>(new Set());

  // Undo / rewind
  type Snapshot = {
    step: Step;
    messages: Msg[];
    appliances: ApplianceType[];
    smartByAppliance: Partial<Record<ApplianceType, SmartState>>;
    freqByAppliance: Partial<Record<ApplianceType, Frequency>>;
    overnight: OvernightPref | undefined;
    hasDeadline: boolean | null;
    deadlines: DeadlineEntry[];
    priority: Priority | undefined;
    notif: NotificationPref | undefined;
    draftAppliances: Set<ApplianceType | "none">;
  };
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [rewindNonce, setRewindNonce] = useState(0);
  const suppressInitialAskRef = useRef(false);

  const hasAnySmart = useMemo(
    () => Object.values(smartByAppliance).some((s) => s === "smart"),
    [smartByAppliance],
  );

  const deadlineDevices = useMemo(() => {
    const list: (ApplianceType | "ev_charger")[] = [];
    if (ACCOUNT_HAS_EV_CHARGER) list.push("ev_charger");
    if (appliances.includes("dishwasher")) list.push("dishwasher");
    if (appliances.includes("washing_machine")) list.push("washing_machine");
    return list;
  }, [appliances]);

  const shouldAskDeadline = deadlineDevices.length > 0;

  function ask(text: string) {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: crypto.randomUUID(), kind: "assistant", text }]);
    }, 400);
  }

  function reply(text: string) {
    const snap: Snapshot = {
      step,
      messages,
      appliances,
      smartByAppliance,
      freqByAppliance,
      overnight,
      hasDeadline,
      deadlines,
      priority,
      notif,
      draftAppliances: new Set(draftAppliances),
    };
    const snapshotIndex = history.length;
    setHistory((h) => [...h, snap]);
    setMessages((m) => [...m, { id: crypto.randomUUID(), kind: "user", text, snapshotIndex }]);
  }

  function rewindTo(snapshotIndex: number) {
    const snap = history[snapshotIndex];
    if (!snap) return;
    setHistory((h) => h.slice(0, snapshotIndex));
    setMessages(snap.messages);
    setAppliances(snap.appliances);
    setSmartByAppliance(snap.smartByAppliance);
    setFreqByAppliance(snap.freqByAppliance);
    setOvernight(snap.overnight);
    setHasDeadline(snap.hasDeadline);
    setDeadlines(snap.deadlines);
    setPriority(snap.priority);
    setNotif(snap.notif);
    setDraftAppliances(new Set(snap.draftAppliances));
    suppressInitialAskRef.current = true;
    setStep(snap.step);
    setRewindNonce((n) => n + 1);
  }

  // Bootstrap
  useEffect(() => {
    const greeting = user?.name
      ? `Hi ${user.name} — welcome to Enpal Pulse. A minute of setup so we can tailor tips to your home. You can skip anything.`
      : "Welcome to Enpal Pulse. A minute of setup so we can tailor tips to your home. You can skip anything.";
    ask(greeting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (suppressInitialAskRef.current) {
      suppressInitialAskRef.current = false;
      return;
    }
    if (step.kind === "appliances") {
      ask("Which of these do you have at home?");
    } else if (step.kind === "smart") {
      const t = appliances[step.idx];
      if (t)
        ask(
          `Is your ${APPLIANCE_LABEL[t].toLowerCase()} a smart/WiFi-connected model, or a regular one?`,
        );
    } else if (step.kind === "frequency") {
      const t = appliances[step.idx];
      if (t) ask(`How often do you usually use your ${APPLIANCE_LABEL[t].toLowerCase()}?`);
    } else if (step.kind === "overnight") {
      ask("Is it okay for these to run while you're out or asleep?");
    } else if (step.kind === "deadline_ask") {
      ask(
        "Do you ever need something ready by a specific time? Like your car charged before you leave, or dishes clean before guests arrive.",
      );
    } else if (step.kind === "deadline_pick") {
      ask("Pick a time for each — or skip any you don't need.");
    } else if (step.kind === "priority") {
      ask("Do you care more about saving money, or reducing your environmental impact?");
    } else if (step.kind === "notification") {
      ask("How do you want to hear about tips like this?");
    } else if (step.kind === "done") {
      ask(
        "Thanks — we'll start tailoring tips based on this. You can change these anytime in Settings.",
      );
      const payload: OnboardingAnswers = {
        household_id: selectedHouseholdId,
        appliances: appliances.map<ApplianceAnswer>((type) => ({
          type,
          smart: smartByAppliance[type] ?? "not_sure",
          frequency: freqByAppliance[type] ?? "rarely",
        })),
        overnight_preference: overnight,
        deadlines,
        priority,
        notification_preference: notif,
        completed_at: new Date().toISOString(),
      };
      saveOnboarding(payload);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, rewindNonce]);

  function advanceAfterAppliances(selected: ApplianceType[]) {
    setAppliances(selected);
    if (selected.length === 0) {
      setStep({ kind: "overnight" });
    } else {
      setStep({ kind: "smart", idx: 0 });
    }
  }

  function nextPerApplianceAfterFreq(idx: number) {
    const next = idx + 1;
    if (next < appliances.length) {
      setStep({ kind: "smart", idx: next });
    } else {
      setStep({ kind: "overnight" });
    }
  }

  // ---------- Controls renderers ----------

  function renderControls() {
    if (typing) return null;
    switch (step.kind) {
      case "welcome":
        return (
          <div>
            <button
              type="button"
              onClick={() => setStep({ kind: "appliances" })}
              className="btn-cta"
            >
              Let's go →
            </button>
          </div>
        );
      case "appliances": {
        const noneSelected = draftAppliances.has("none");
        const realSelected = [...draftAppliances].filter((x) => x !== "none") as ApplianceType[];
        const canContinue = noneSelected || realSelected.length > 0;
        const toggle = (key: ApplianceType | "none") => {
          const next = new Set(draftAppliances);
          if (key === "none") {
            if (next.has("none")) next.delete("none");
            else {
              next.clear();
              next.add("none");
            }
          } else {
            next.delete("none");
            if (next.has(key)) next.delete(key);
            else next.add(key);
          }
          setDraftAppliances(next);
        };
        return (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-2.5">
              {APPLIANCE_OPTIONS.map((o) => (
                <ChoiceChip
                  key={o.type}
                  selected={draftAppliances.has(o.type)}
                  onClick={() => toggle(o.type)}
                >
                  {o.label}
                </ChoiceChip>
              ))}
              <ChoiceChip selected={noneSelected} onClick={() => toggle("none")}>
                None of these
              </ChoiceChip>
            </div>
            {canContinue && (
              <button
                type="button"
                className="btn-cta"
                onClick={() => {
                  const label = noneSelected
                    ? "None of these"
                    : realSelected.map((t) => APPLIANCE_LABEL[t]).join(", ");
                  reply(label);
                  advanceAfterAppliances(noneSelected ? [] : realSelected);
                }}
              >
                Continue →
              </button>
            )}
          </div>
        );
      }
      case "smart": {
        const t = appliances[step.idx];
        if (!t) return null;
        const choose = (val: SmartState) => {
          setSmartByAppliance((p) => ({ ...p, [t]: val }));
          reply(SMART_LABEL[val]);
          setStep({ kind: "frequency", idx: step.idx });
        };
        return (
          <div className="grid sm:grid-cols-3 gap-2.5">
            {(["smart", "regular", "not_sure"] as SmartState[]).map((v) => (
              <ChoiceChip key={v} onClick={() => choose(v)}>
                {SMART_LABEL[v]}
              </ChoiceChip>
            ))}
          </div>
        );
      }
      case "frequency": {
        const t = appliances[step.idx];
        if (!t) return null;
        const choose = (val: Frequency) => {
          setFreqByAppliance((p) => ({ ...p, [t]: val }));
          reply(FREQ_LABEL[val]);
          nextPerApplianceAfterFreq(step.idx);
        };
        return (
          <div className="grid sm:grid-cols-3 gap-2.5">
            {(["daily", "few_times_week", "rarely"] as Frequency[]).map((v) => (
              <ChoiceChip key={v} onClick={() => choose(v)}>
                {FREQ_LABEL[v]}
              </ChoiceChip>
            ))}
          </div>
        );
      }
      case "overnight": {
        const choose = (val: OvernightPref) => {
          setOvernight(val);
          reply(OVERNIGHT_LABEL[val]);
          setStep(shouldAskDeadline ? { kind: "deadline_ask" } : { kind: "priority" });
        };
        return (
          <div className="grid sm:grid-cols-3 gap-2.5">
            {(["anytime", "only_while_home", "not_overnight"] as OvernightPref[]).map((v) => (
              <ChoiceChip key={v} onClick={() => choose(v)}>
                {OVERNIGHT_LABEL[v]}
              </ChoiceChip>
            ))}
          </div>
        );
      }
      case "deadline_ask":
        return (
          <div className="grid sm:grid-cols-2 gap-2.5">
            <ChoiceChip
              onClick={() => {
                setHasDeadline(true);
                reply("Yes");
                setStep({ kind: "deadline_pick" });
              }}
            >
              Yes
            </ChoiceChip>
            <ChoiceChip
              onClick={() => {
                setHasDeadline(false);
                reply("No, no fixed deadline");
                setStep({ kind: "priority" });
              }}
            >
              No, no fixed deadline
            </ChoiceChip>
          </div>
        );
      case "deadline_pick": {
        const labelFor = (d: ApplianceType | "ev_charger") =>
          d === "ev_charger" ? "EV charger" : APPLIANCE_LABEL[d];
        const setTime = (d: ApplianceType | "ev_charger", time: string) => {
          setDeadlines((prev) => {
            const others = prev.filter((x) => x.type !== d);
            return time ? [...others, { type: d, time }] : others;
          });
        };
        const current = (d: ApplianceType | "ev_charger") =>
          deadlines.find((x) => x.type === d)?.time ?? "";
        return (
          <div className="space-y-3">
            <div className="rounded-2xl bg-cta/10 p-4 space-y-3">
              {deadlineDevices.map((d) => (
                <label key={d} className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-medium text-navy">{labelFor(d)}</span>
                  <input
                    type="time"
                    value={current(d)}
                    onChange={(e) => setTime(d, e.target.value)}
                    className="min-h-[44px] rounded-xl border border-border bg-white px-3 py-2 text-[15px] font-semibold text-navy focus:border-navy focus:outline-none"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn-cta"
              onClick={() => {
                if (deadlines.length > 0) {
                  reply(
                    deadlines
                      .map(
                        (d) =>
                          `${d.type === "ev_charger" ? "EV" : APPLIANCE_LABEL[d.type as ApplianceType]} by ${d.time}`,
                      )
                      .join(" · "),
                  );
                } else {
                  reply("No times set");
                }
                setStep({ kind: "priority" });
              }}
            >
              Continue →
            </button>
          </div>
        );
      }
      case "priority": {
        const choose = (val: Priority) => {
          setPriority(val);
          reply(PRIORITY_LABEL[val]);
          setStep({ kind: "notification" });
        };
        return (
          <div className="grid sm:grid-cols-3 gap-2.5">
            {(["save_money", "reduce_co2", "both_equally"] as Priority[]).map((v) => (
              <ChoiceChip key={v} onClick={() => choose(v)}>
                {PRIORITY_LABEL[v]}
              </ChoiceChip>
            ))}
          </div>
        );
      }
      case "notification": {
        const automaticDisabled = !hasAnySmart;
        const choose = (val: NotificationPref) => {
          setNotif(val);
          reply(NOTIF_LABEL[val]);
          setStep({ kind: "done" });
        };
        return (
          <div className="space-y-2">
            <div className="grid sm:grid-cols-3 gap-2.5">
              <ChoiceChip onClick={() => choose("notify_me")}>{NOTIF_LABEL.notify_me}</ChoiceChip>
              <ChoiceChip
                disabled={automaticDisabled}
                onClick={() => !automaticDisabled && choose("automatic")}
              >
                {NOTIF_LABEL.automatic}
              </ChoiceChip>
              <ChoiceChip onClick={() => choose("check_app")}>{NOTIF_LABEL.check_app}</ChoiceChip>
            </div>
            {automaticDisabled && (
              <p className="text-[13px] text-stone">
                Automatic scheduling needs a smart device — you can still get notifications.
              </p>
            )}
          </div>
        );
      }
      case "done":
        return (
          <button
            type="button"
            className="btn-cta"
            onClick={() => onComplete?.()}
          >
            Open my dashboard →
          </button>
        );
    }
  }

  // Last user message index — for inline undo affordance
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].kind === "user") {
      lastUserIdx = i;
      break;
    }
  }

  const messagesNode = (
    <>
      {messages.map((m, i) => {
        if (m.kind === "assistant") {
          return <AssistantBubble key={m.id}>{m.text}</AssistantBubble>;
        }
        const canEdit = typeof m.snapshotIndex === "number";
        const isLastUser = i === lastUserIdx;
        return (
          <div key={m.id} className="space-y-1">
            <UserBubble
              onClick={canEdit ? () => rewindTo(m.snapshotIndex!) : undefined}
              title={canEdit ? "Tap to change this answer" : undefined}
            >
              {m.text}
            </UserBubble>
            {isLastUser && canEdit && !typing && (
              <div className="flex justify-end pr-1">
                <button
                  type="button"
                  onClick={() => rewindTo(m.snapshotIndex!)}
                  className="text-[12px] font-semibold text-stone hover:text-navy underline-offset-4 hover:underline"
                >
                  Undo
                </button>
              </div>
            )}
          </div>
        );
      })}
      {typing && (
        <AssistantBubble>
          <span className="inline-flex gap-1 items-center text-stone">
            <span className="h-1.5 w-1.5 rounded-full bg-stone/60 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-stone/60 animate-pulse [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-stone/60 animate-pulse [animation-delay:240ms]" />
          </span>
        </AssistantBubble>
      )}
    </>
  );

  return (
    <ChatSurface
      title="Welcome to Enpal Pulse"
      subtitle="A minute of setup so we can tailor tips to your home."
      meta={`Step ${stepProgress(step)} of ${TOTAL_STEPS}`}
      messages={messagesNode}
      controls={renderControls()}
      scrollKey={messages.length + (typing ? 1 : 0) + step.kind}
      composer={
        <Composer
          value=""
          onChange={() => {}}
          onSubmit={() => {}}
          disabled
          placeholder="Tap an option above to continue…"
        />
      }
    />
  );
}
