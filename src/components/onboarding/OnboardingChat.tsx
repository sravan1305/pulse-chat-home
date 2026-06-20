import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChatBubble,
  ChatScroller,
  Chip,
  PrimaryButton,
  ProgressDots,
  SkipLink,
  TypingBubble,
  UndoLink,
} from "@/components/onboarding/chat-primitives";
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

// Mock — in real app these come from the account.
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

const TOTAL_DOTS = 7;

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

export function OnboardingChat() {
  const navigate = useNavigate();
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

  // Multi-select local state for appliances step
  const [draftAppliances, setDraftAppliances] = useState<Set<ApplianceType | "none">>(new Set());

  // ---- Rewind / undo system ----
  // Each user reply pushes a Snapshot of the state RIGHT BEFORE that reply.
  // Tap any user bubble (or the inline "Undo" link) to restore that snapshot.
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
  // When we rewind, we want the assistant to re-ask the question. The step-watch
  // effect only fires on step-reference changes — bump this nonce to force a re-ask
  // when restoring to the same step kind.
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

  // Push assistant message with a brief typing indicator
  function ask(text: string) {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: crypto.randomUUID(), kind: "assistant", text }]);
    }, 450);
  }

  // Snapshot current state, then push the user reply tagged with that snapshot index.
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
    // Suppress the next step-watch ask (it already lives in snap.messages),
    // then force a re-ask via rewindNonce so the user sees the question again.
    suppressInitialAskRef.current = true;
    setStep(snap.step);
    setRewindNonce((n) => n + 1);
  }

  // Bootstrap welcome message
  useEffect(() => {
    ask(
      "A few quick questions so we can give you the right tips — not generic ones. Takes about a minute. You can skip anything.",
    );
  }, []);

  // When a step changes, push the appropriate assistant question.
  // On rewind, the original question bubble is already restored via snap.messages,
  // so we suppress the duplicate ask().
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
      // Persist
      const payload: OnboardingAnswers = {
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
      // "None of these" → skip appliance subflow
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

  // ---------- Renderers ----------

  function WelcomeControls() {
    return (
      <PrimaryButton onClick={() => setStep({ kind: "appliances" })}>Let's go →</PrimaryButton>
    );
  }

  function AppliancesControls() {
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {APPLIANCE_OPTIONS.map((o) => (
            <Chip
              key={o.type}
              selected={draftAppliances.has(o.type)}
              onClick={() => toggle(o.type)}
            >
              {o.label}
            </Chip>
          ))}
          <Chip selected={noneSelected} onClick={() => toggle("none")}>
            None of these
          </Chip>
        </div>
        {canContinue && (
          <PrimaryButton
            onClick={() => {
              const label = noneSelected
                ? "None of these"
                : realSelected.map((t) => APPLIANCE_LABEL[t]).join(", ");
              reply(label);
              advanceAfterAppliances(noneSelected ? [] : realSelected);
            }}
          >
            Continue →
          </PrimaryButton>
        )}
      </div>
    );
  }

  function SmartControls({ idx }: { idx: number }) {
    const t = appliances[idx];
    if (!t) return null;
    const choose = (val: SmartState) => {
      setSmartByAppliance((p) => ({ ...p, [t]: val }));
      reply(SMART_LABEL[val]);
      setStep({ kind: "frequency", idx });
    };
    return (
      <div className="flex flex-wrap gap-2">
        {(["smart", "regular", "not_sure"] as SmartState[]).map((v) => (
          <Chip key={v} onClick={() => choose(v)}>
            {SMART_LABEL[v]}
          </Chip>
        ))}
      </div>
    );
  }

  function FrequencyControls({ idx }: { idx: number }) {
    const t = appliances[idx];
    if (!t) return null;
    const choose = (val: Frequency) => {
      setFreqByAppliance((p) => ({ ...p, [t]: val }));
      reply(FREQ_LABEL[val]);
      nextPerApplianceAfterFreq(idx);
    };
    return (
      <div className="flex flex-wrap gap-2">
        {(["daily", "few_times_week", "rarely"] as Frequency[]).map((v) => (
          <Chip key={v} onClick={() => choose(v)}>
            {FREQ_LABEL[v]}
          </Chip>
        ))}
      </div>
    );
  }

  function OvernightControls() {
    const choose = (val: OvernightPref) => {
      setOvernight(val);
      reply(OVERNIGHT_LABEL[val]);
      setStep(shouldAskDeadline ? { kind: "deadline_ask" } : { kind: "priority" });
    };
    return (
      <div className="flex flex-wrap gap-2">
        {(["anytime", "only_while_home", "not_overnight"] as OvernightPref[]).map((v) => (
          <Chip key={v} onClick={() => choose(v)}>
            {OVERNIGHT_LABEL[v]}
          </Chip>
        ))}
      </div>
    );
  }

  function DeadlineAskControls() {
    return (
      <div className="flex flex-wrap gap-2">
        <Chip
          onClick={() => {
            setHasDeadline(true);
            reply("Yes");
            setStep({ kind: "deadline_pick" });
          }}
        >
          Yes
        </Chip>
        <Chip
          onClick={() => {
            setHasDeadline(false);
            reply("No, no fixed deadline");
            setStep({ kind: "priority" });
          }}
        >
          No, no fixed deadline
        </Chip>
      </div>
    );
  }

  function DeadlinePickControls() {
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
      <div className="flex flex-col gap-3 rounded-[14px] border border-[color:var(--border)] bg-white p-4">
        {deadlineDevices.map((d) => (
          <label key={d} className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-medium text-[var(--brand-navy)]">{labelFor(d)}</span>
            <input
              type="time"
              value={current(d)}
              onChange={(e) => setTime(d, e.target.value)}
              className="min-h-[44px] rounded-[14px] border border-[color:var(--border)] px-3 py-2 text-[16px] font-semibold text-[var(--brand-navy)] focus:border-[var(--brand-navy)] focus:outline-none"
              style={{ borderRadius: 14 }}
            />
          </label>
        ))}
        <PrimaryButton
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
        </PrimaryButton>
      </div>
    );
  }

  function PriorityControls() {
    const choose = (val: Priority) => {
      setPriority(val);
      reply(PRIORITY_LABEL[val]);
      setStep({ kind: "notification" });
    };
    return (
      <div className="flex flex-wrap gap-2">
        {(["save_money", "reduce_co2", "both_equally"] as Priority[]).map((v) => (
          <Chip key={v} onClick={() => choose(v)}>
            {PRIORITY_LABEL[v]}
          </Chip>
        ))}
      </div>
    );
  }

  function NotificationControls() {
    const automaticDisabled = !hasAnySmart;
    const choose = (val: NotificationPref) => {
      setNotif(val);
      reply(NOTIF_LABEL[val]);
      setStep({ kind: "done" });
    };
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Chip onClick={() => choose("notify_me")}>{NOTIF_LABEL.notify_me}</Chip>
          <Chip
            disabled={automaticDisabled}
            onClick={() => !automaticDisabled && choose("automatic")}
          >
            {NOTIF_LABEL.automatic}
          </Chip>
          <Chip onClick={() => choose("check_app")}>{NOTIF_LABEL.check_app}</Chip>
        </div>
        {automaticDisabled && (
          <p className="text-[13px] font-medium text-[var(--brand-stone)]">
            Automatic scheduling needs a smart/connected device — you can still get notifications.
          </p>
        )}
      </div>
    );
  }

  function DoneControls() {
    return (
      <PrimaryButton onClick={() => navigate({ to: "/welcome/dashboard" })}>
        Go to my dashboard →
      </PrimaryButton>
    );
  }

  // Generic skip behavior per step
  function skip() {
    switch (step.kind) {
      case "welcome":
        setStep({ kind: "appliances" });
        break;
      case "appliances":
        reply("Skipped");
        advanceAfterAppliances([]);
        break;
      case "smart": {
        const t = appliances[step.idx];
        if (t) setSmartByAppliance((p) => ({ ...p, [t]: "not_sure" }));
        reply("Skipped");
        setStep({ kind: "frequency", idx: step.idx });
        break;
      }
      case "frequency": {
        const t = appliances[step.idx];
        if (t) setFreqByAppliance((p) => ({ ...p, [t]: "rarely" }));
        reply("Skipped");
        nextPerApplianceAfterFreq(step.idx);
        break;
      }
      case "overnight":
        reply("Skipped");
        setStep(shouldAskDeadline ? { kind: "deadline_ask" } : { kind: "priority" });
        break;
      case "deadline_ask":
      case "deadline_pick":
        reply("Skipped");
        setStep({ kind: "priority" });
        break;
      case "priority":
        reply("Skipped");
        setStep({ kind: "notification" });
        break;
      case "notification":
        reply("Skipped");
        setStep({ kind: "done" });
        break;
      case "done":
        navigate({ to: "/welcome/dashboard" });
        break;
    }
  }

  const showSkip = step.kind !== "welcome" && step.kind !== "done";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[480px] items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-navy)] text-[12px] font-bold text-white">
              P
            </div>
            <span className="text-[14px] font-semibold text-[var(--brand-navy)]">Pulse</span>
          </div>
          <div className="flex-1 px-6">
            <ProgressDots total={TOTAL_DOTS} current={stepProgress(step)} />
          </div>
          <div className="w-12 text-right">{showSkip && <SkipLink onClick={skip} />}</div>
        </div>
      </header>

      {/* Chat thread */}
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-5 py-6">
        <ChatScroller>
          {(() => {
            // Find the most recent user message that can be undone.
            let lastUserIdx = -1;
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i].kind === "user") {
                lastUserIdx = i;
                break;
              }
            }
            return messages.map((m, i) => {
              if (m.kind === "assistant") {
                return (
                  <ChatBubble key={m.id} role="assistant">
                    {m.text}
                  </ChatBubble>
                );
              }
              const canEdit = typeof m.snapshotIndex === "number";
              const isLastUser = i === lastUserIdx;
              return (
                <div key={m.id} className="flex flex-col gap-1">
                  <ChatBubble
                    role="user"
                    onEdit={canEdit ? () => rewindTo(m.snapshotIndex!) : undefined}
                  >
                    {m.text}
                  </ChatBubble>
                  {isLastUser && canEdit && !typing && (
                    <UndoLink onClick={() => rewindTo(m.snapshotIndex!)} />
                  )}
                </div>
              );
            });
          })()}
          {typing && <TypingBubble />}
        </ChatScroller>

        {!typing && (
          <div className="pulse-enter mt-2">
            {step.kind === "welcome" && <WelcomeControls />}
            {step.kind === "appliances" && <AppliancesControls />}
            {step.kind === "smart" && <SmartControls idx={step.idx} />}
            {step.kind === "frequency" && <FrequencyControls idx={step.idx} />}
            {step.kind === "overnight" && <OvernightControls />}
            {step.kind === "deadline_ask" && <DeadlineAskControls />}
            {step.kind === "deadline_pick" && <DeadlinePickControls />}
            {step.kind === "priority" && <PriorityControls />}
            {step.kind === "notification" && <NotificationControls />}
            {step.kind === "done" && <DoneControls />}
          </div>
        )}
      </main>
    </div>
  );
}
