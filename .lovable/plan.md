## Goal

Make "which house" a consequence of being signed in, not a header dropdown. The onboarding flow at `/welcome` becomes the sign-in. The main app reads the active household from the saved onboarding, and a header menu lets the user sign out (back to `/welcome`). Rebrand `/welcome` to match the main app.

## Behavior

- **Signed in** = `loadOnboarding()` returns a record with a `household_id`.
- **Signed out** = no onboarding in localStorage. Home page redirects to `/welcome`.
- **Sign out** = clear `enpal_pulse_onboarding` from localStorage and navigate to `/welcome`.
- The `?hh=` URL param goes away as a user-facing control. Active household is derived from onboarding.

## Changes

### 1. `src/components/AppShell.tsx` — remove dropdown, add account menu
- Delete the `<select>` household picker and the `onChange` handler.
- Replace `useActiveHouseholdId` so it reads `loadOnboarding()?.household_id` (client-only via `useEffect` + state, falling back to `DEFAULT_HOUSEHOLD_ID` during SSR / first paint to avoid hydration mismatch). Keep the export name and signature so callers don't change.
- Add an account chip on the right side of the navy header: small avatar circle + the household's `name`. Clicking it opens a lightweight shadcn `DropdownMenu` with two items:
  - **Edit setup** → `navigate("/welcome")`
  - **Sign out** → clears onboarding from localStorage and `navigate("/welcome")`
- Mobile (sub-`sm`) shows the same chip in the header row; no separate "Viewing as" line.
- Remove the `?hh=` query param everywhere it's written from this shell (Link search props become `{}` / dropped). Link `to`s remain typed.

### 2. New gate on `/` — redirect to onboarding when signed out
In `src/routes/index.tsx`:
- Add a small client-only effect: on mount, if `loadOnboarding()?.household_id` is missing, `navigate({ to: "/welcome" })`.
- Keep `?hh=` accepted in the search schema for backwards compatibility, but remove it from `<Link>` props on this page; pass through nothing.

### 3. `/welcome` onboarding rebrand — match Enpal Pulse
In `src/components/onboarding/OnboardingChat.tsx`:
- Replace the white sticky header with the same navy bar used by `AppShell`: `bg-navy text-white`, cta-yellow rounded `E` tile, "Enpal Pulse" wordmark in `font-display`, optional "Smart energy companion" subtitle on ≥sm.
- Progress dots and "Skip" stay in the same row, restyled for the dark header (white/cta dots, white-70 skip link).
- Body container: bump max width from `480px` to match the app (`max-w-5xl` for the page, inner chat column stays comfortable around `max-w-[560px]`), and switch hard-coded `var(--brand-*)` colors to the same Tailwind tokens used elsewhere (`text-navy`, `text-stone`, `bg-cta`, `card-soft`) so chips, bubbles, and primary buttons read as part of the same product.
- `chat-primitives.tsx`: align `PrimaryButton` to use the existing `.btn-cta` style, `Chip` to use cta/navy tokens (selected = cta yellow + navy text; idle = white + navy border) instead of raw `--brand-*` vars.

### 4. Welcome page wording
- Update the bootstrap message to "Let's set up Enpal Pulse for your home — takes about a minute." so the brand name appears.
- Keep the household step as-is (already implemented).

### 5. Remove `?hh=` from internal links
In `src/routes/index.tsx`, `src/routes/welcome/dashboard.tsx`, and onboarding navigation, drop the `search: { hh: … }` props now that household is derived from onboarding. Loaders still use `loaderDeps` but default to `DEFAULT_HOUSEHOLD_ID` until the client hydrates the real ID, then `router.invalidate()` once on first hydration if the active ID differs.

## Out of scope

- Real authentication (no Lovable Cloud / Supabase). "Sign in" remains localStorage-based.
- No per-household onboarding records. One record, swapped on re-setup.
- No changes to `/chat` or `/insights` beyond what AppShell drives.
- No new routes.
