import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { loadOnboarding, type OnboardingAnswers } from "@/lib/onboarding";

export interface AuthUser {
  id: string; // household_id (demo)
  name: string;
}

const USER_KEY = "enpal_pulse_user";
const ONBOARDING_KEY = "enpal_pulse_onboarding";

interface AuthContextValue {
  user: AuthUser | null;
  onboarding: OnboardingAnswers | null;
  ready: boolean;
  signIn: (user: AuthUser) => void;
  signOut: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingAnswers | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setUser(loadUser());
    setOnboarding(loadOnboarding());
  }, []);

  useEffect(() => {
    refresh();
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_KEY || e.key === ONBOARDING_KEY || e.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const signIn = useCallback((next: AuthUser) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
    setUser(next);
    setOnboarding(loadOnboarding());
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ONBOARDING_KEY);
    } catch {
      /* noop */
    }
    setUser(null);
    setOnboarding(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, onboarding, ready, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
