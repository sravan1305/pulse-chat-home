## Goal

Three connected problems to fix on `/`:

1. **Sign out is broken** — clicking it clears localStorage and navigates to `/`, but we're already on `/`, so `HomeGate`'s mount-only `useEffect` never re-runs and the dashboard keeps rendering.
2. **No login step** — onboarding fires immediately for a "signed out" user. The user wants a tiny dummy sign-in screen first, then onboarding, then dashboard.
3. **Onboarding feels like a different product than the in-app chat** — different bubbles, different chrome, different composer. It should reuse the same chat surface as `/chat` so users don't perceive two apps stitched together.

## New auth + gate flow on `/`

Three states, evaluated reactively (not just on mount):

```
signed out          →  <SignIn />            (new dummy login screen)
signed in, no setup →  <OnboardingChat />    (rebuilt on the chat surface)
signed in, set up   →  <HomePage />          (current dashboard)
```

Storage keys:
- `enpal_pulse_user` — `{ id: string, name: string }`. Presence = signed in.
- `enpal_pulse_onboarding` — existing onboarding record. Presence = setup complete.

Reactive gate (fixes sign-out):
- Lift the gate into a small `AuthContext` in `src/routes/__root.tsx` exposing `{ user, onboarding, signIn, signOut, refresh }`.
- `signOut()` clears both keys and updates context state → `HomeGate` immediately re-renders into `<SignIn />` without needing a navigation or remount.
- `signIn(user)` sets `enpal_pulse_user` and updates context → gate flips to onboarding.
- `OnboardingChat.onComplete` writes onboarding + calls `refresh()` → gate flips to dashboard.
- Also wire a `window` `storage` listener so sign-out from another tab works too.

## 1. Dummy sign-in screen

New file: `src/components/auth/SignIn.tsx`.

- Full-screen, same navy header band as `AppShell` (Enpal Pulse wordmark only — no nav, no account chip).
- Below: a centered card titled "Sign in to Enpal Pulse" with a short subtitle ("Demo — pick a household to continue").
- Lists the demo households from `src/data/raw/households.json` as buttons (`Familie Becker · Berlin`, etc.). Clicking one calls `signIn({ id: household_id, name })`.
- Visually consistent with the dashboard: `card-soft`, `btn-cta`, navy/cta tokens. No new design language.

This replaces the prior behavior where landing on `/` dropped you straight into onboarding.

## 2. Sign-out fix

In `AppShell`:
- Replace the current `signOut` (which only clears the onboarding key + navigates) with a call to `useAuth().signOut()`.
- `useAuth().signOut()` clears both `enpal_pulse_user` and `enpal_pulse_onboarding`, then sets context state → `HomeGate` instantly renders `<SignIn />`.
- Also navigate to `/` (no-op if already there) so signing out from `/chat`, `/settings`, etc. lands on the sign-in screen.

## 3. Unify the onboarding chat with the in-app chat

The visual shell must match `/chat`. Refactor `OnboardingChat` so it renders inside the same chat layout, with the same bubbles, the same suggestion-chip styling, the same composer placement, and the same `AppShell`-style page header.

### Shared chat shell

Extract the common chrome from `src/routes/chat.tsx` into a small reusable component: `src/components/chat/ChatSurface.tsx`.

Exports:
- `<ChatSurface header={…}>{children}</ChatSurface>` — wraps `AppShell` + the "Ask Enpal Pulse" title block + the scrollable `card-soft` message area + the bottom composer slot.
- `<AssistantBubble>` and `<UserBubble>` — the exact bubble styles from `/chat`'s `MessageBubble` (assistant: `bg-secondary/70 text-navy rounded-bl-md`, user: `bg-navy text-white rounded-br-md`). Used by both `/chat` and onboarding.
- `<ChoiceChip>` — the same yellow suggestion-chip style currently used for `/chat`'s "Try one of these" (`bg-cta/20 hover:bg-cta/40 rounded-2xl`). Onboarding answer chips use this instead of the bespoke `Chip` from `chat-primitives.tsx`.
- `<Composer disabled placeholder onSubmit />` — the textarea + arrow button block.

Refactor `/chat`'s `ChatPage` to render through `ChatSurface` (no behavior change, just consume the shared shell so it stays in sync).

### Onboarding rendered through `ChatSurface`

Rewrite `OnboardingChat.tsx` to:
- Wrap content in `<ChatSurface header={{ title: "Welcome to Enpal Pulse", subtitle: "A minute of setup so we can tailor tips to your home." }}>`. (Title varies by step is optional — keep one for simplicity.)
- Inside the message area, render the scripted assistant/user turns as `<AssistantBubble>` / `<UserBubble>` — same look as `/chat`.
- Below the latest assistant message, render the active step's input as `<ChoiceChip>` rows (households, appliances, smart/freq, overnight, deadline, priority, notification) instead of the current `Chip` primitive.
- Disable the bottom composer (`disabled placeholder="Tap an option above to continue…"`) so the composer is visible (same placement as `/chat`) but the user is guided through chips. This keeps the page structure identical to in-app chat — same composer footprint, same scroll behavior, same bubble grammar.
- Show step progress as a thin one-line `text-stone text-xs` "Step 3 of 8" under the subtitle, replacing the bespoke `ProgressDots`.
- Keep the existing answer logic, snapshot/undo system, and `saveOnboarding(...)` + `onComplete()` call at the end — only the presentation layer changes.
- On the final "done" step, swap the chips for a single `btn-cta` "Open my dashboard →" that calls `onComplete?.()`.

Delete or shrink `src/components/onboarding/chat-primitives.tsx` (its `ChatBubble`/`Chip`/`TypingBubble`/`ChatScroller`/`PrimaryButton` are superseded by `ChatSurface` exports). Keep only what `OnboardingChat` still imports, or remove the file if nothing remains.

### Result

- Same navy `AppShell` header on sign-in, onboarding, dashboard, chat, settings.
- Same chat bubble visuals + composer in onboarding and in `/chat` — onboarding just drives the conversation with tappable chips and a disabled composer.

## Files

- New: `src/contexts/AuthContext.tsx` (provider + `useAuth`).
- New: `src/components/auth/SignIn.tsx`.
- New: `src/components/chat/ChatSurface.tsx` (shell + bubbles + chip + composer).
- Edit: `src/routes/__root.tsx` — wrap `<Outlet />` in `<AuthProvider>`.
- Edit: `src/routes/index.tsx` — `HomeGate` reads `useAuth()`; renders `SignIn` / `OnboardingChat` / `HomePage`.
- Edit: `src/components/AppShell.tsx` — `signOut` calls `useAuth().signOut()`.
- Edit: `src/routes/chat.tsx` — use `ChatSurface` + shared bubbles/chips.
- Edit: `src/components/onboarding/OnboardingChat.tsx` — render through `ChatSurface`, use shared bubbles/chips, drop bespoke chrome.
- Edit/remove: `src/components/onboarding/chat-primitives.tsx`.

## Out of scope

- Real auth (still localStorage-only, dummy users from `households.json`).
- Changing the onboarding script or questions.
- Restyling `/chat`, `/settings`, `/insights`.
- Persisting per-user onboarding (still a single record).
