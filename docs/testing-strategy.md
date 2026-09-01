# DigiStayBook — Manual & Automated Testing Strategy

**Version:** 1.0
**Branch under test:** `codex/implementation-foundation`
**Date:** 2026-08-12
**Test email address (single known recipient):** `clb.bertram@googlemail.com`

---

## 0. Read this first — what is actually testable

This document is written against the code that exists, not against the product
specification. Three capabilities named in the spec are **not implemented yet**, so
they cannot be tested. They are listed in Part D with the precondition each one needs,
rather than being written as steps that would fail for the wrong reason.

| Capability | State in code | Evidence |
|---|---|---|
| Host login | **Not implemented** | No `signInWith*`, `createUserWith*` or `onAuthStateChanged` call exists anywhere in `src/`. The sign-in form's buttons are hard-coded `disabled`. |
| Outbound email | **Not implemented** | `functions/src/index.ts` exports only `health`. No mail provider dependency, no send call. `src/domain/marketing.ts` is a classification/consent policy module only. |
| Guest post persistence | **Not implemented** | `StayWallPage` validates the form locally and displays "nothing is sent to a host yet". Walls read from `src/ui/wall/demoWall.ts`. |

**Consequence for the "known email address" requirement:** there is no send path to
point at a test address. The routing convention is defined in Part D.1 so it is settled
before the first email is ever wired up. Until then, zero emails can be produced by any
step in this document.

### Result codes used throughout

| Code | Meaning |
|---|---|
| **PASS** | Observed outcome matches the expected outcome exactly. |
| **FAIL** | Observed outcome contradicts the expected outcome. |
| **BLOCKED** | Step could not run — a precondition is missing or the feature is unbuilt. |

---

## Part A — Environment setup

These steps run once per test session. Every later part assumes they passed.

### A.1 — Confirm toolchain

**Action:** run

```bash
node --version
```

**Expected outcome:** version is `v22.x` or higher. `package.json` declares
`"engines": { "node": ">=22" }`; a lower version invalidates the rest of the run.

---

### A.2 — Confirm the working tree is the branch under test

**Action:** run

```bash
git rev-parse --abbrev-ref HEAD
```

**Expected outcome:** exactly `codex/implementation-foundation`. Any other branch means
the results do not describe the intended code.

---

### A.3 — Confirm dependencies are installed

**Action:** run

```bash
npm ls react vite vitest --depth=0
```

**Expected outcome:** `react@19.x`, `vite@8.x`, `vitest@4.x` all resolve with no
`UNMET DEPENDENCY` line. If unmet, run `npm install` and repeat.

---

### A.4 — Record the Firebase configuration state

This determines the expected behaviour of the two host routes, so it must be recorded
before Part C runs, not guessed afterwards.

**Action:** check whether a `.env` or `.env.local` file exists in the repository root
and whether all six `VITE_FIREBASE_*` values are non-empty.

**Expected outcome:** one of two states, recorded explicitly in the results:

- **State UNCONFIGURED** — no `.env`, or any of the six values empty. `firebaseConfigured`
  evaluates `false`. Host routes must fail closed (Part C.6, C.7 expect the closed variant).
- **State CONFIGURED** — all six present. Host routes render their shell variant.

`src/lib/firebaseConfig.ts` derives `firebaseConfigured` via
`Object.values(firebaseConfig).every(Boolean)`, so a single blank value produces State
UNCONFIGURED.

---

## Part B — Automated gates

These are the repository's own verification commands. Run them before touching the UI:
a red gate here explains any UI symptom found later.

### B.1 — Implementation-status validator

**Action:**

```bash
npm run status:check
```

**Expected outcome:** exit code `0`. This validates `docs/implementation-status.json`
against the ledger rules — it does not test application behaviour.

---

### B.2 — TypeScript compilation (application)

**Action:**

```bash
npm run typecheck
```

**Expected outcome:** exit code `0` and no diagnostic output. `tsc --noEmit` prints
nothing on success.

---

### B.3 — Unit and UI test suite

**Action:**

```bash
npm test
```

**Expected outcome:** exit code `0`. All test files pass, zero failures. The suite
covers the domain modules (`billing`, `featureFlags`, `marketing`, `moderation`,
`property`, `retention`) and the UI (`pages.test.tsx`, `shell.test.tsx`).
The Firestore rules test is deliberately excluded here — it needs the emulator and runs
in B.6. Record the exact file and test counts reported.

---

### B.4 — Production build

**Action:**

```bash
npm run build
```

**Expected outcome:** exit code `0`; Vite writes to `dist/` and prints a bundle summary.
Record the main chunk size. The recorded baseline in `docs/implementation-status.md` is
approximately 260 kB raw / 79 kB gzipped — a large deviation is a finding worth noting
even though it is not a failure.

---

### B.5 — Cloud Functions compilation

**Action:**

```bash
npm run functions:build
```

**Expected outcome:** exit code `0`. Compiles `functions/src/index.ts` to
`functions/lib/`. Only the `health` endpoint exists, so this proves compilation, not
behaviour.

---

### B.6 — Firestore security rules (emulator)

This is the highest-value automated gate in the repository: it is the only place where
real access-control behaviour is exercised.

**Action:**

```bash
npm run test:emulators
```

**Expected outcome:** exit code `0`; the Firestore emulator starts on port `8080` under
project `demo-digistaybook`, the rules suite passes, and the emulator shuts down cleanly.

**If it fails to start:** the most likely causes are (a) Java not installed — the
Firestore emulator requires a JRE, and (b) port `8080` already in use. Both are
environment faults, recorded as **BLOCKED**, not **FAIL**.

**What passing proves,** per `firestore.rules`:
- A public wall is readable only when the property is `mode == 'live'` **and**
  `lifecycle` is one of `trialing`, `active`, `grace_period`.
- A host can read and update only properties where `ownerUid` matches their own UID.
- A host **cannot** self-assign `ownerUid`, `lifecycle`, `billing` or `retentionState` —
  those are server-owned.
- Guests **cannot** write posts directly (`allow write: if false` on the posts
  subcollection). Persistence must go through a server endpoint, which is why Part D.3
  is blocked rather than broken.
- The catch-all `match /{document=**}` denies everything not explicitly allowed.

---

## Part C — Browser journeys

Start the dev server once for all of Part C:

```bash
npm run dev
```

Vite serves on `http://localhost:5173` by default. Record the actual URL printed.

For each step, also record any **browser console error**. A clean console is part of the
expected outcome for every step in this part, and is not repeated in each one.

---

### C.1 — Landing page

**Action:** navigate to `http://localhost:5173/`

**Expected outcome:**
1. Hero headline reads **"Every guest signs the same book."** with "same book"
   emphasised. *(Marketing copy is volatile — see the Copy-drift note at the end of
   Part C. Assert the structure and the emphasis, and treat a changed sentence as a
   doc-refresh item, not an application failure.)*
2. Two hero buttons: **"See a live guest wall"** → `/wall/demo-cottage`, and
   **"Host sign in"** → `/host/sign-in`.
3. Hero bullet points include "No app download", "No guest accounts", "28-day free trial".
4. Header navigation shows exactly four links: How it works, Pricing, See a live wall,
   Privacy & Safety — plus a "Host sign in" button.
5. Footer shows three columns (brand blurb, Product, Support & legal) and a copyright
   line ending **"Working implementation — not yet released."**
6. No image or font is fetched from an external host — all icons are inline SVG and all
   imagery is CSS. Check the Network tab: every request is same-origin.

---

### C.2 — Public Guest Wall

**Action:** navigate to `/wall/demo-cottage`

**Expected outcome:**
1. A **Demo** ribbon appears at the top reading "A public wall, ready to share or embed
   on your own site." with a link to `/stay/demo-cottage`.
2. Property header: monogram **SC**, title **Seabreeze Cottage**, location
   **St Anthony's Head, Cornwall**, host byline **Ana & Tom** with "Hosting here since 2019".
3. The wall heading reads **"8 memories left here"** and exactly **8** memory cards render.
4. Memory authors, in order: Mia & Sam, The Aldridges, Priya, Ellis, Jonah & Rae,
   The Okonjos, Cathy, Marek & family.
5. **Critical privacy assertion — no house guidance appears.** The strings
   `SEABREEZE-5G`, `Tuesday night`, `fridge magnet` and the checkout time must **not**
   be present anywhere on this page. This is the public/private split the product depends
   on; find-in-page for `SEABREEZE-5G` must return zero matches.
6. **No contribution form** is present on this route — the public wall is read-only.
7. A "Staying here soon?" panel explains guidance lives behind the QR display.
8. Footer aside reads "Loved your stay? Powered by DigiStayBook…".

---

### C.3 — In-stay wall (the QR display destination)

**Action:** navigate to `/stay/demo-cottage`

**Expected outcome:**
1. Demo ribbon reads "What your guests see after scanning the QR display." and links back
   to `/wall/demo-cottage`.
2. Host welcome: heading **"Welcome to the cottage"**, two paragraphs, a favourite tip
   mentioning the bakery behind the lighthouse, signed **Ana & Tom**.
3. **"The essentials"** section renders exactly four items, and this is the route where
   guidance is *expected* to be visible — the inverse of C.2.5:
   - Wi-Fi — **SEABREEZE-5G** — "Password is on the fridge magnet"
   - Bins — **Tuesday night** — "Green bin, by the side gate"
   - Checkout — **10am** — "Keys in the drawer. No need to strip the beds."
   - Heating — **Dial in the hall** — "It clunks for a minute, then settles"
4. The same 8 memories render, under the heading "Memories from people who stayed here".
5. A contribution form titled **"Add your own"** is present, with an optional name field,
   a message textarea, a consent checkbox and a Continue button.

---

### C.4 — Contribution form validation (negative path)

**Action:** on `/stay/demo-cottage`, leave the message empty, leave the consent checkbox
unticked, and click **Continue**.

**Expected outcome:** the form does **not** clear, and a status message appears reading
exactly:
**"Add a message and accept the content consent before continuing."**

The message is announced via `role="status"`. No network request is made.

**Repeat with a message typed but consent unticked.** Expected: the same rejection —
consent is mandatory, not advisory.

---

### C.5 — Contribution form happy path (and its honest limit)

**Action:** type a name (`Test Guest`), type a message (e.g. `Testing the wall - 12 Aug`),
tick the consent checkbox, click **Continue**.

**Expected outcome:** a status message reads
**"Your message is validated locally. This is a demo wall, so nothing is sent to a host yet."**

**Explicitly expected NOT to happen** — these are correct absences, not failures:
- No network request is issued.
- No post is added to the wall above.
- **No email is sent to anyone**, including the test address.
- Nothing appears in any host dashboard.

Also verify the character counter: the message field is capped at 1200 characters and the
hint counts down from `1200 characters remaining`.

---

### C.6 — Host sign-in route

**Action:** navigate to `/host/sign-in`

**Expected outcome depends on the state recorded in A.4.**

**State UNCONFIGURED:**
1. Heading **"Sign in to manage your properties"**.
2. A notice whose bold line reads **"Local configuration required."**
3. Body text: "Host authentication remains closed until a Firebase environment is
   configured. No development bypass grants dashboard access."
4. The email and password inputs are **disabled**.

**State CONFIGURED:**
1. Same heading.
2. The notice bold line instead reads **"Authentication configuration detected."**
3. Email and password inputs are **enabled**.

**In both states — this is the point of the test:**
- The **"Continue with Google"** button is `disabled`.
- The **"Sign in"** button is `disabled` and is `type="button"`, so it does not submit.
- **Clicking either button does nothing.** No navigation, no network request, no error.
- **It is not possible to log in.** This is the current, intended fail-closed state.
  Record it as **PASS** if login is impossible, and **FAIL** only if some path grants
  dashboard access without authentication.

---

### C.7 — Host dashboard route (direct access attempt)

**Action:** navigate directly to `/host` without signing in.

**Expected outcome depends on A.4:**

**State UNCONFIGURED** — the route fails closed:
1. Heading **"Dashboard unavailable"**, eyebrow "Protected host area".
2. Notice: **"No Firebase environment is configured."** followed by "The implementation
   deliberately fails closed instead of providing a local authentication bypass."
3. A "Back to home" button.
4. **No property data of any kind is rendered.**

**State CONFIGURED** — and this is a finding to record carefully:
1. Heading **"Your properties"** with three static panels: Property setup, Moderation, Billing.
2. **The panels are hardcoded presentational content.** No property is loaded, no user is
   identified, no Firestore query runs.
3. **Note the security observation:** in this state the dashboard shell renders for an
   unauthenticated visitor, because the route is gated on *configuration*, not on
   *authentication*. No real data leaks — there is no data layer — but the gate is not an
   auth gate. Record this as an observation for when Part D.2 is built.

---

### C.8 — Public legal and safety routes

**Action:** visit `/privacy-safety`, then `/terms`, then `/privacy`.

**Expected outcome:**
1. All three render without error and are reachable **without any authentication**.
2. `/privacy-safety` preserves the support boundary — it must not direct a guest with a
   safety concern solely to a host inbox.
3. `/terms` and `/privacy` render the draft legal content and are clearly identifiable as
   drafts rather than executed policy.
4. All three are linked from the footer's "Support & legal" column and those links work.

---

### C.9 — Unknown route

**Action:** navigate to `/this-route-does-not-exist`

**Expected outcome:** the Not Found page renders inside the normal app shell — header and
footer still present, navigation still usable. No blank page, no unhandled error, no
console exception.

---

### C.10 — Client-side routing limitation

**Action:** from the landing page, click the header link **"See a live wall"**, then use
the browser **Back** button.

**Expected outcome:** navigation works, because `src/App.tsx` resolves the page from
`window.location.pathname` on each full page load and every link is a real `<a href>`.

**Known characteristic to record, not a bug:** there is no client-side router and no
history listener. Each navigation is a **full page load**. In production this depends on
the hosting rewrite in `firebase.json` (`"source": "**" → "/index.html"`), so deep links
resolve. Confirm the dev server also serves `/wall/demo-cottage` correctly on a hard
refresh (F5) — not just on in-app click.

---

### C.11 — Mobile viewport

**Action:** set the viewport to **375 × 812** and reload `/`, `/wall/demo-cottage`,
`/stay/demo-cottage` and `/host/sign-in`.

**Expected outcome:**
1. **No horizontal overflow on any of the four routes.** Verify numerically:
   `document.documentElement.scrollWidth <= window.innerWidth` must hold.
2. The header collapses to a **Menu** button.
3. Clicking **Menu** expands the navigation and the button label changes to **Close**;
   `aria-expanded` flips `false` → `true`. Clicking again collapses it.
4. Memory cards stack in a single column and no text is clipped.

---

### C.12 — Dark colour scheme

**Action:** set the browser to `prefers-color-scheme: dark` and reload `/` and
`/wall/demo-cottage`.

**Expected outcome:** both routes render in a dark palette with legible contrast. No
element renders dark-on-dark or light-on-light. No layout shift versus light mode.

---

### C.13 — Keyboard accessibility

**Action:** load `/`, press `Tab` once.

**Expected outcome:**
1. The first focusable element is the **"Skip to content"** link, and it becomes visible
   on focus.
2. Activating it moves focus to `#main`.
3. Continued tabbing reaches every header link and the "Host sign in" button in visual
   order, with a visible focus indicator at each stop.

---

---

### Copy-drift note (added after the first execution, 2026-08-12)

During the first run of this plan the working tree was **modified concurrently by another
process**. Observed mid-run: `src/styles.css` was briefly deleted (causing a transient
blank page unrelated to application code), "placard" was renamed to "QR display" across
the wall pages, the landing hero was rewritten, and `docs/demo-photo-credits.md` appeared.

Two consequences for anyone using this document:

1. **Run the plan against a clean, stationary tree.** Run `git status --short` before
   Part C and again after; if the two differ, the results describe no single revision and
   should be discarded. Ideally test a committed revision, not a live working tree.
2. **Marketing copy assertions are the fragile part of this plan.** Where an exact string
   is quoted for *presentational* copy, a mismatch is a documentation-refresh item, not an
   application failure. The assertions that genuinely matter — and that must be treated as
   hard failures — are the behavioural ones: C.2.5 (no house guidance on the public wall),
   C.4/C.5 (validation and no silent send), C.6 (login impossible), C.7 (`/host` does not
   leak data), C.11.1 (no horizontal overflow) and all of Part B.

---

## Part D — Blocked journeys

Each item below is what you asked to test. None can run against current code. Each names
the single precondition that unblocks it, so this section becomes the acceptance test the
day the feature lands.

### D.1 — Email delivery to a known address

**Status:** BLOCKED — no send path exists in the codebase.

**Routing convention, agreed now so it is settled before the first email is wired:**

| Environment | Where mail goes |
|---|---|
| Local / emulator | Firebase Auth emulator UI at `http://127.0.0.1:4000` — verification and reset links are captured in the emulator log and never leave the machine. |
| Staging / test builds | **Every** recipient overridden to `clb.bertram@googlemail.com`, regardless of the address on the account. The override belongs in the send adapter, not in per-call sites. |
| Production | The real recipient. |

**Test once built:** trigger each transactional type in `emailCatalogue`
(`accountConfirmation`, `propertyActivation`, `moderationAlert`, `billingNotice`,
`securityAlert`), confirm each arrives at the known address exactly once, and confirm
`assertTransactionalContent` holds — no promotional block in a transactional email.
Separately confirm `canSendMarketing` blocks all five marketing types when consent is
absent or suppression is not `clear`.

**Precondition:** a mail adapter in `functions/`, with the staging recipient override.

---

### D.2 — Host login and authenticated dashboard

**Status:** BLOCKED — no authentication code exists.

**Test once built:** create a host account against the Auth emulator; sign in; confirm
the dashboard loads **only** for the signed-in user; confirm signing out revokes access;
confirm direct navigation to `/host` while signed out redirects to sign-in rather than
rendering the shell (see the C.7 observation); confirm one host cannot read another
host's property.

**Precondition:** Firebase Auth wired into `HostSignInPage`, an auth-state guard on
`/host`, and `IMP-3002` complete per `docs/implementation-status.md`.

---

### D.3 — Guest post persistence and moderation

**Status:** BLOCKED — `firestore.rules` denies all direct guest writes by design, and no
server endpoint exists to accept them.

**Test once built:** submit a post from `/stay/<slug>`; confirm it persists; confirm it
does **not** appear on the public wall until screened/approved; confirm the host sees it
pending; confirm hide/pin/delete each take effect on the public wall.

**Precondition:** `IMP-2002` server-controlled contribution persistence.

---

### D.4 — Real property walls

**Status:** BLOCKED — both wall routes ignore the slug for content and always render
`demoProperty` from `demoWall.ts`.

Note that `/wall/anything-at-all` renders Seabreeze Cottage identically; only the demo
ribbon is slug-sensitive. This is expected of the current build and is worth confirming
during C.2 so the limitation is documented rather than discovered later.

**Precondition:** Firestore-backed property and post loading on both wall routes.

---

## Part E — Results template

| Step | Expected | Observed | Result |
|---|---|---|---|
| A.1 | Node ≥ 22 | | |
| A.2 | On branch under test | | |
| A.3 | Deps resolve | | |
| A.4 | Config state recorded | | |
| B.1 | Status validator exit 0 | | |
| B.2 | Typecheck exit 0 | | |
| B.3 | Tests exit 0 | | |
| B.4 | Build exit 0 | | |
| B.5 | Functions build exit 0 | | |
| B.6 | Rules suite passes | | |
| C.1 | Landing renders | | |
| C.2 | Public wall, 8 memories, **no** Wi-Fi | | |
| C.3 | Stay wall, essentials **present** | | |
| C.4 | Validation rejects | | |
| C.5 | Local-only confirmation, no send | | |
| C.6 | Login impossible | | |
| C.7 | `/host` behaviour per config state | | |
| C.8 | Legal routes public | | |
| C.9 | 404 in shell | | |
| C.10 | Deep link + refresh | | |
| C.11 | No overflow at 375 px | | |
| C.12 | Dark mode legible | | |
| C.13 | Skip link first | | |
| D.1–D.4 | — | Not implemented | BLOCKED |
