import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Home, LogOut, MessageCircle, Settings, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import households from "@/data/raw/households.json";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_HOUSEHOLD_ID } from "@/lib/demo-config";
import { loadOnboarding } from "@/lib/onboarding";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/insights", label: "Insights", icon: Sparkles },
] as const;

type HouseholdLite = { household_id: string; name: string; city: string };

const HOUSEHOLDS = households as HouseholdLite[];

const ONBOARDING_KEY = "enpal_pulse_onboarding";

/** Returns the household id derived from saved onboarding (sign-in).
 *  During SSR / first paint it returns the default so the page renders without a flash. */
export function useActiveHouseholdId(): string {
  const [id, setId] = useState<string>(DEFAULT_HOUSEHOLD_ID);
  useEffect(() => {
    const saved = loadOnboarding()?.household_id;
    if (saved && HOUSEHOLDS.some((h) => h.household_id === saved)) setId(saved);
  }, []);
  return id;
}

export function AppShell({ children }: { children: ReactNode }) {
  const activeId = useActiveHouseholdId();
  const active = useMemo(
    () => HOUSEHOLDS.find((h) => h.household_id === activeId) ?? HOUSEHOLDS[0],
    [activeId],
  );
  const navigate = useNavigate();

  const signOut = () => {
    try {
      localStorage.removeItem(ONBOARDING_KEY);
    } catch {
      /* noop */
    }
    navigate({ to: "/" });
  };

  const initials = active?.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-cta flex items-center justify-center">
              <span className="text-navy font-display text-lg">E</span>
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg text-white">Enpal Pulse</div>
              <div className="text-xs text-white/60 -mt-0.5 hidden sm:block">
                Smart energy companion
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden sm:flex items-center gap-1 mr-2">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="px-3 py-2 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition"
                  activeProps={{
                    className: "px-3 py-2 rounded-xl text-sm font-semibold text-navy bg-cta",
                  }}
                  activeOptions={{ exact: true }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 transition pl-1.5 pr-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-cta">
                <div className="w-7 h-7 rounded-lg bg-cta text-navy font-display text-xs flex items-center justify-center">
                  {initials || "U"}
                </div>
                <span className="hidden sm:inline text-sm font-semibold text-white">
                  {active?.name ?? "Account"}
                </span>
                <ChevronDown className="w-4 h-4 text-white/70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-display text-navy text-sm leading-tight">{active?.name}</div>
                  <div className="text-xs text-stone font-medium">{active?.city}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  <Settings className="w-4 h-4" /> Edit setup
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-8 pb-28 sm:pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-border z-50">
        <div className="mx-auto max-w-5xl grid grid-cols-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-1 py-3 text-stone"
                activeProps={{ className: "flex flex-col items-center gap-1 py-3 text-navy" }}
                activeOptions={{ exact: true }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
