## Goal

Make `/` the single entry point. Unauthenticated visitors immediately see the onboarding chat there; finishing the chat reveals the home dashboard on the same route. The in-product `/chat` (customer-support chat) stays as its own page — it's not merged with onboarding. "Edit setup" becomes a tabular form on a dedicated `/settings` route.

## Behavior

- **Signed out** (`loadOnboarding()?.household_id` missing) on `/` → render `<OnboardingChat>` in place. No redirect.
- **Finish onboarding** → call `saveOnboarding(...)`, then swap the page contents to the dashboard (no navigation). A short success toast/banner is fine.
- **Signed in** on `/` → render the dashboard directly (current Home content).
- **`/welcome` and `/welcome/dashboard`** → deleted. `/welcome` becomes a redirect to `/` for any old bookmarks.
- **AppShell header menu**:
  - "Edit setup" → `navigate({ to: "/settings" })`
  - "Sign out" → clear `enpal_pulse_onboarding`, stay on `/` (which will now show onboarding again).
- **`/chat`** unchanged — it's the support chat, reached from the existing "Ask a question" card and nav.

## Changes

### 1. `src/routes/index.tsx` — gate inline, not via redirect
- Remove the `useEffect(() => navigate("/welcome"))`.
- Add a client-only `hasOnboarding` state (`useState(false)` + `useEffect` reading `loadOnboarding()`), so SSR renders a neutral shell and the client decides.
- If `!hasOnboarding`: render `<OnboardingChat onComplete={() => setHasOnboarding(true)} />` inside `<AppShell>` (or a minimal shell — see §3).
- If `hasOnboarding`: render the current dashboard JSX as-is.
- Skip the suspense query until `hasOnboarding` is true (guard `useSuspenseQuery` behind a child component that only mounts once setup exists, so the loader doesn't run for brand-new users).

### 2. `src/components/onboarding/OnboardingChat.tsx` — accept `onComplete`
- Add an optional `onComplete?: () => void` prop.
- Where the flow currently navigates to `/welcome/dashboard`, instead:
  - `saveOnboarding({ ...answers, completed_at: new Date().toISOString() })`
  - Call `onComplete?.()` (parent flips state → dashboard renders).
  - If no `onComplete` provided (legacy callers), fall back to `navigate({ to: "/" })`.
- Keep the existing rebranded navy header so onboarding still feels like Enpal Pulse when shown standalone.

### 3. Shell for onboarding
- When onboarding renders on `/`, wrap it in a minimal version of `AppShell` (navy header with the Enpal Pulse wordmark, no account chip yet, no nav links). Reuse `AppShell` with a new `variant="onboarding"` prop that hides the account menu and nav — simpler than a second shell component.

### 4. New `/settings` route — tabular edit form
- New file: `src/routes/settings.tsx`.
- Loads current `loadOnboarding()` on mount; if missing, redirect to `/`.
- Renders a single `<Table>` (shadcn) with one row per setting group:
  | Setting | Current value | Edit |
  |---|---|---|
  | Household | "Müller family — Berlin" | inline `<Select>` of households |
  | Appliances | chips list ("Dishwasher · Washing machine") | opens an inline editor (checkbox list + smart/frequency selects per appliance) |
  | Overnight preference | "Only while home" | `<RadioGroup>` |
  | Deadlines | "Dishwasher 07:00, EV 06:30" | list editor (add/remove rows with type + time) |
  | Priority | "Save money" | `<RadioGroup>` |
  | Notifications | "Notify me" | `<RadioGroup>` |
- Save button persists via `saveOnboarding(...)` and shows a toast. Cancel returns to `/`.
- Page uses `AppShell` (full shell, account menu visible).

### 5. AppShell menu
- "Edit setup" item: `navigate({ to: "/settings" })` (currently goes to `/welcome`).
- "Sign out": clear localStorage, then `navigate({ to: "/" })` (currently `/welcome`). The `/` route will detect missing onboarding and render the chat.

### 6. Delete / redirect old routes
- Delete `src/routes/welcome/dashboard.tsx`.
- Replace `src/routes/welcome/index.tsx` with a route that, in its `beforeLoad`, throws `redirect({ to: "/" })`. (Keeps inbound links from breaking.)
- TanStack regenerates `routeTree.gen.ts`.

## Out of scope

- Real authentication. "Signed in" still means localStorage has an onboarding record.
- Changing what `/chat` does — it remains the customer-support chat.
- Persisting per-household onboarding (still a single record).
- Visual redesign of the dashboard or chat.

## Technical notes

- The `/` route's loader currently calls `getHomeComparisonFn` unconditionally. To avoid running it for brand-new users, move the `useSuspenseQuery` into a child `<DashboardView>` component that only mounts when `hasOnboarding` is true, and drop the route's `loader` (or keep it — `ensureQueryData` is harmless, just wasted on first paint). Recommended: keep the loader for returning users; the brief duplicate fetch on first signup is acceptable.
- `OnboardingChat` already writes to localStorage at the end; we just swap the post-save navigation for a callback.
- `/settings` form state: local `useState` seeded from `loadOnboarding()`; save writes the whole record back (merge-style) so partially-edited fields don't get wiped.
