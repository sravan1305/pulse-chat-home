export type ApplianceType =
  | "dishwasher"
  | "washing_machine"
  | "tumble_dryer"
  | "water_heater"
  | "pool_pump";

export type SmartState = "smart" | "regular" | "not_sure";
export type Frequency = "daily" | "few_times_week" | "rarely";
export type OvernightPref = "anytime" | "only_while_home" | "not_overnight";
export type Priority = "save_money" | "reduce_co2" | "both_equally";
export type NotificationPref = "notify_me" | "automatic" | "check_app";

export interface ApplianceAnswer {
  type: ApplianceType;
  smart: SmartState;
  frequency: Frequency;
}

export interface DeadlineEntry {
  type: ApplianceType | "ev_charger";
  time: string; // HH:MM
}

export interface OnboardingAnswers {
  household_id?: string;
  appliances: ApplianceAnswer[];
  overnight_preference?: OvernightPref;
  deadlines: DeadlineEntry[];
  priority?: Priority;
  notification_preference?: NotificationPref;
  completed_at?: string;
}

export const APPLIANCE_LABEL: Record<ApplianceType, string> = {
  dishwasher: "Dishwasher",
  washing_machine: "Washing machine",
  tumble_dryer: "Tumble dryer",
  water_heater: "Electric water heater",
  pool_pump: "Pool pump",
};

const KEY = "enpal_pulse_onboarding";

export function saveOnboarding(data: OnboardingAnswers) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* noop */
  }
}

export function loadOnboarding(): OnboardingAnswers | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingAnswers) : null;
  } catch {
    return null;
  }
}
