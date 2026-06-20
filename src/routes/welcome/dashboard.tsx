import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import householdsRaw from "@/data/raw/households.json";
import { APPLIANCE_LABEL, loadOnboarding, type OnboardingAnswers } from "@/lib/onboarding";

type HouseholdLite = { household_id: string; name: string; city: string };
const HOUSEHOLDS = householdsRaw as HouseholdLite[];

const searchSchema = z.object({
  hh: z.string().optional(),
});

export const Route = createFileRoute("/welcome/dashboard")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Your Pulse setup" },
      { name: "description", content: "Personalized energy tips based on your setup." },
    ],
  }),
  component: WelcomeDashboardPage,
});

function WelcomeDashboardPage() {
  const search = Route.useSearch();
  const [data, setData] = useState<OnboardingAnswers | null>(null);

  useEffect(() => {
    setData(loadOnboarding());
  }, []);

  const hhId = search.hh ?? data?.household_id;
  const household = hhId ? HOUSEHOLDS.find((h) => h.household_id === hhId) : undefined;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-[color:var(--border)] bg-white">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-5 py-4">
          <Link to="/" search={{ hh: hhId }} className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-navy)] text-[12px] font-bold text-white">
              P
            </div>
            <span className="text-[14px] font-semibold text-[var(--brand-navy)]">Pulse</span>
          </Link>
          <Link
            to="/welcome"
            search={{ hh: hhId }}
            className="text-[14px] font-medium text-[var(--brand-stone)] underline-offset-4 hover:underline"
          >
            Redo setup
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 py-8">
        <h1 className="text-[24px] font-semibold text-[var(--brand-navy)]">You're all set</h1>
        <p className="mt-1 text-[15px] font-medium text-[var(--brand-stone)]">
          Here's what we stored. Recommendations will appear here next.
        </p>

        <section className="mt-6 rounded-[14px] border border-[color:var(--border)] bg-white p-5">
          <h2 className="text-[14px] font-semibold uppercase tracking-wide text-[var(--brand-stone)]">
            Onboarding answers
          </h2>
          {!data ? (
            <p className="mt-3 text-[15px] text-[var(--brand-navy)]">
              No answers yet —{" "}
              <Link to="/welcome" search={{ hh: hhId }} className="font-semibold underline">
                start setup
              </Link>
              .
            </p>
          ) : (
            <div className="mt-4 space-y-4 text-[15px] text-[var(--brand-navy)]">
              {household && <Row label="Home" value={`${household.name} · ${household.city}`} />}
              <div>
                <div className="font-semibold">Appliances</div>
                {data.appliances.length === 0 ? (
                  <div className="text-[var(--brand-stone)]">None</div>
                ) : (
                  <ul className="mt-1 list-disc pl-5">
                    {data.appliances.map((a) => (
                      <li key={a.type}>
                        {APPLIANCE_LABEL[a.type]} — {a.smart}, {a.frequency.replace("_", " ")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Row label="Overnight" value={data.overnight_preference ?? "—"} />
              <Row
                label="Deadlines"
                value={
                  data.deadlines.length === 0
                    ? "—"
                    : data.deadlines.map((d) => `${d.type} @ ${d.time}`).join(", ")
                }
              />
              <Row label="Priority" value={data.priority ?? "—"} />
              <Row label="Notifications" value={data.notification_preference ?? "—"} />

              <details className="mt-4">
                <summary className="cursor-pointer text-[13px] font-semibold text-[var(--brand-stone)]">
                  Raw JSON
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-[10px] bg-[color:var(--muted)] p-3 text-[12px] text-[var(--brand-navy)]">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold">{label}</div>
      <div className="text-[var(--brand-stone)]">{String(value)}</div>
    </div>
  );
}
