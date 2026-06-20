## Goal

Add a "Which home is this for?" step at the start of the `/welcome` onboarding flow, so the household is chosen as part of onboarding instead of only via the header dropdown. Also fix the current `/` 500 error (stale `summaryQueryOptions` reference in the loader) that's blocking the page.

## Changes

### 1. Fix `/` runtime 500 (blocker)
`src/routes/index.tsx` loader still calls `summaryQueryOptions(deps.hh)`, which no longer exists after the comparison refactor. Replace with `homeQueryOptions({ householdId, date: DEMO_TODAY, hour: DEMO_NOW_HOUR, cmp: "1w" })` using the same defaults the component uses, and include `date`/`cmp` in `loaderDeps`.

### 2. New first onboarding step: `household`
In `src/components/onboarding/OnboardingChat.tsx`:
- Add `{ kind: "household" }` to the `Step` union and insert it right after `welcome` (before `appliances`).
- Add `selectedHouseholdId` state, defaulting to the current `?hh=` search param if present, else `DEFAULT_HOUSEHOLD_ID`.
- Render the question as a normal chat bubble: "Which home are we setting up?" with one option button per household from `src/data/raw/households.json` (`Name · City`). Reuse the existing `ChoiceButton` / `PrimaryButton` primitives — no new UI components.
- Selecting a household: advances to `appliances`, and immediately updates the URL with `?hh=<id>` via `navigate({ to: "/welcome", search: { hh: id } })` so the rest of the flow (and the header) reflects the choice.
- Bump `TOTAL_DOTS` to 8 and shift `stepProgress` numbers down by 1 for every later step so the progress dots stay accurate.

### 3. Persist household with onboarding answers
- Extend `OnboardingAnswers` in `src/lib/onboarding.ts` with `household_id?: string`, and write it in the final `saveOnboarding` call inside `OnboardingChat`.
- On the `done` step, "Go to dashboard" already navigates to `/welcome/dashboard`; update that navigation (and the dashboard's "Redo setup" link) to carry `?hh=<selectedHouseholdId>` so the chosen home survives the handoff back to Home.

### 4. Welcome route accepts `?hh=`
`src/routes/welcome/index.tsx`: add a `validateSearch` accepting `{ hh?: string }` so the step can read/write it without TanStack stripping the param. No UI change here.

### 5. Show the chosen household on the dashboard
`src/routes/welcome/dashboard.tsx`: when `data.household_id` is set, look up the matching entry in `households.json` and show it as a `Row` ("Home: Müller · Berlin") above "Appliances". Pure presentation, no logic changes elsewhere.

## Out of scope

- No first-visit redirect / gating (that's option 1, not requested).
- No per-household keyed answers (that's option 2). Onboarding remains a single shared record; we just record which home it was completed for.
- No changes to `AppShell`'s header household picker — it keeps working as today.
