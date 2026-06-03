# pos-web Pixel-Perfect Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every defect identified in the 2026-06-03 pixel-perfect audit so `pos-web` is materially "Pixel Perfect Match" and "Production Ready" against the `thawb-wa-teeb-laundry` design source. Out of scope: mobile / sub-tablet responsive layout (the design is intentionally desktop-only).

**Architecture:** Mechanical fixes only — no architectural changes. Token layer, layout structure, and component composition are already correct and stay untouched. Work falls into 6 themes: (1) static CSS / font-import corrections, (2) tenant-safe copy, (3) replacing 5 toast-only stubs with real integrations, (4) accessibility polish, (5) Arabic translation rollout, (6) build / housekeeping. Every fix has a single owner file or a small, named set of files. We land in 7 phases ordered by blast radius (cheapest + lowest-risk first) so each phase ships independently behind the same long-lived branch.

**Tech Stack:** Next.js 14.2 (App Router), TypeScript 5, React 18, next-intl 4, React Query 5, react-hook-form 7 + zod 4, Tailwind 3 (currently vestigial — to be removed), pnpm 11. No test framework is present today; verification is via `pnpm tsc --noEmit`, `pnpm build`, and explicit manual browser smoke checks. We do **not** add a test framework in this plan — that's a separate initiative.

---

## Spec Context — Audit Findings → Tasks

| Audit ID | Severity | Description | Task |
|---|---|---|---|
| C-1 | Critical | `messages/ar.json` is identical to `en.json` | Phase 5 (5.1–5.5) |
| C-2 | Critical | "Mangrove Plaza" hardcoded in `Login.subtitle` + `Reports.branch` | 2.1, 2.2 |
| C-3a | Critical | Print Receipt button in New Order is toast-only | 3.4 |
| C-3b | Critical | Export CSV button in Reports is toast-only | 3.6 |
| C-3c | Critical | Print Z-Report button in Reports is toast-only | 3.5 |
| C-3d | Critical | WhatsApp file upload is toast-only + discards file | 3.2 |
| C-3e | Critical | WhatsApp "Clear messages" menu is toast-only | 3.3 |
| C-4 | Critical | Cash-up close-shift toast hardcodes `AED 0.00` | 3.1 |
| H-1 | High | Cormorant Garamond italic axis missing from font preload | 1.1 |
| H-2 | High | `GeneralScreen` defaults `branchAddress` to "Shop 4, Mangrove Plaza…" | 2.3 |
| H-3 | High | `Login.subtitle` not parameterized by store | 2.1 |
| H-4 | High | End-shift modal uses `.btn-primary` (dead class) + hardcoded "Cancel" | 1.5, 1.6 |
| M-1 | Medium | `.rail .nav button, .rail .nav a` selector grouping logically broken | 1.2, 1.3 |
| M-2 | Medium | `.cust-attach.required` className is dead | 1.4 |
| M-3 | Medium | English placeholders in WhatsApp + Settings inputs | 2.4, 2.5 |
| M-4 | Medium | Switch toggles inconsistent: `<span>` / `<div>` / `<button>` | 4.2 |
| L-1 | Low | Tailwind config is vestigial | 1.7 |
| L-2 | Low | App version "v2.4" baked into i18n | 6.1 |
| L-5 | Low | `tsconfig.tsbuildinfo` not gitignored | 0.3 |
| A11y-1 | High | No `:focus-visible` rings on form inputs / buttons | 4.1 |
| A11y-2 | Medium | Modal-scrim doesn't trap focus | 4.4 |
| A11y-3 | Medium | Login `.lg-err` has no `role="alert"` | 4.3 |

---

## File Structure

### Files modified
- `src/app/[locale]/layout.tsx` — font preload URL (1.1)
- `src/app/pos.css` — selector cleanup (1.2, 1.3), `.cust-attach.required` styling (1.4), `:focus-visible` rules (4.1)
- `src/components/AppShell.tsx` — end-shift modal copy + class (1.5, 1.6); focus-trap usage (4.4)
- `tailwind.config.ts` — DELETED (1.7)
- `postcss.config.mjs` — DELETED (1.7)
- `package.json` — drop tailwindcss + postcss devDeps (1.7); read version (6.1)
- `messages/en.json` — Login subtitle, Reports branch, Common keys (2.1, 2.2, 2.4, 2.5, 6.1)
- `messages/ar.json` — full translation overwrite (Phase 5)
- `src/app/[locale]/login/LoginForm.tsx` — subtitle template + role="alert" on `.lg-err` (2.1, 4.3)
- `src/app/[locale]/(pos)/reports/ReportsScreen.tsx` — branch interpolation, cash-up toast, Export CSV, Print Z (2.2, 3.1, 3.5, 3.6)
- `src/app/[locale]/(pos)/settings/general/GeneralScreen.tsx` — drop hardcoded branchAddress fallback (2.3)
- `src/app/[locale]/(pos)/whatsapp/WhatsappScreen.tsx` — implement file upload + clear chat + i18n placeholders (2.4, 3.2, 3.3)
- `src/app/[locale]/(pos)/order/NewOrderScreen.tsx` — implement Print Receipt (3.4); convert `.exp-toggle` switch to `<button role="switch">` (4.2)
- `src/components/Toast.tsx` — no change; reference only
- `src/components/FocusTrap.tsx` — NEW (4.4)
- `src/lib/print.ts` — NEW (3.4, 3.5)
- `src/lib/csv.ts` — NEW (3.6)
- `next.config.mjs` — surface NEXT_PUBLIC_VERSION (6.1)
- `.gitignore` — add `tsconfig.tsbuildinfo` (0.3)

### Files affected by Settings i18n sweep (2.5)
- `src/app/[locale]/(pos)/settings/stores/StoresSettings.tsx`
- `src/app/[locale]/(pos)/settings/pickup/PickupSettings.tsx`
- `src/app/[locale]/(pos)/settings/subscriptions/SubscriptionsScreen.tsx`
- `src/app/[locale]/(pos)/settings/inventory/InventoryScreen.tsx`
- `src/app/[locale]/(pos)/settings/users/UsersAndRoles.tsx`
- `src/app/[locale]/(pos)/settings/promos/PromosScreen.tsx`
- `src/app/[locale]/(pos)/settings/shifts/ShiftsScreen.tsx`
- `src/app/[locale]/(pos)/settings/racks/RacksScreen.tsx`
- `src/app/[locale]/(pos)/settings/zones/ZonesScreen.tsx`
- `src/app/[locale]/(pos)/finance/FinanceScreen.tsx`

### Switch component sweep (4.2)
- `src/app/[locale]/(pos)/order/NewOrderScreen.tsx`
- Every Settings sub-screen that renders `<span class="switch">` or `<div class="switch">` — enumerated explicitly in task 4.2.

---

## Acceptance Criteria (Phase-by-phase exit gates)

1. **Phase 0:** New worktree/branch up; `.gitignore` updated; `pnpm tsc --noEmit` and `pnpm build` both pass on `main`.
2. **Phase 1:** Same two gates pass; visual diff at 1440px on Login + Order + Settings shows no regressions; `grep -r ".btn-primary" src/` returns nothing.
3. **Phase 2:** `grep -rni "mangrove" src/ messages/` returns only Arabic translations (Phase 5 adds them); login at any tenant shows the bound store name; Reports subtitle reads `<Range> · <Active Store Name> branch`.
4. **Phase 3:** No call to `toast.show(t('exported'))` / `toast.show(t('printed'))` / `toast.show(t('receiptPrinted'))` / `toast.show(t('uploadComingSoon'))` / `toast.show(t('clearComingSoon'))` remains in source. Cash-up toast shows the counted amount.
5. **Phase 4:** Every `:focus-visible` selector in `pos.css` renders an `outline: 2px solid var(--accent)` ring; every modal traps Tab; `<button role="switch" aria-checked>` is used wherever `.switch` is rendered.
6. **Phase 5:** `messages/ar.json` contains 0 English values for any leaf string (verified by character-class check); browser smoke at `/ar/order` shows Arabic in the rail labels, topbar crumb, cart totals, payment modal, and login.
7. **Phase 6:** `t('version')` interpolates `{v}`; `process.env.NEXT_PUBLIC_VERSION` is set by `next.config.mjs`; `pnpm build` produces the version in the login footer.
8. **Phase 7:** Full smoke checklist (defined in 7.3) executed; nothing toast-only remains.

---

## Pre-flight notes

- **Backend dependency.** Phase 3 tasks call `/print-jobs`, `/files/upload`, `/whatsapp/conversations/{id}/messages` (DELETE). These endpoints are assumed by the existing code style (see `WhatsappScreen.tsx` send-message path which already POSTs to `/whatsapp/conversations/{id}/messages`). If any endpoint returns 404 against the live `pos-api`, **add a follow-up ticket against `pos-api` and stub the call client-side with a clear failure-mode toast** — do NOT silently re-introduce a toast-only success.
- **Commit cadence.** One task = one commit. Commit messages follow `<area>: <change>` (e.g. `i18n: parameterize Reports branch subtitle`). Push frequently — the user's memory rule is "always push" so each task ends with push.
- **Verification model.** Every behavior-changing task includes (a) a focused manual verification step with the exact URL/action/expected outcome, plus (b) `pnpm tsc --noEmit` and `pnpm build`. Pure-CSS / i18n tasks skip type-check.
- **Plan file location.** This plan lives at `pos-web/docs/superpowers/plans/2026-06-03-pos-web-pixel-perfect-fixes.md`.

---

# Phase 0 — Prep

### Task 0.1: Create working branch + baseline build

**Files:** none

- [ ] **Step 1: Branch off main**

```bash
cd /Users/mohammad.hamdan/Work/Mine/Projects/ThawbWaTeeb/pos-web
git status
git checkout -b chore/audit-fixes-2026-06
```
Expected: clean working tree, new branch checked out.

- [ ] **Step 2: Baseline type-check**

Run: `pnpm tsc --noEmit`
Expected: exits 0 with no diagnostics.

- [ ] **Step 3: Baseline build**

Run: `pnpm build`
Expected: exits 0; route table prints `/en/*` and `/ar/*` for every screen.

- [ ] **Step 4: Commit baseline marker (empty commit)**

```bash
git commit --allow-empty -m "chore: start audit-fix branch (baseline green)"
git push -u origin chore/audit-fixes-2026-06
```

### Task 0.2: Ensure local dev environment can boot

**Files:** create `.env.local` (gitignored)

- [ ] **Step 1: Confirm pos-api availability**

Sibling project: `/Users/mohammad.hamdan/Work/Mine/Projects/ThawbWaTeeb/pos-api`. Confirm it is checked out and runnable.

```bash
ls /Users/mohammad.hamdan/Work/Mine/Projects/ThawbWaTeeb/pos-api/package.json
```
Expected: file listing succeeds.

- [ ] **Step 2: Create `.env.local`**

Write `pos-web/.env.local` with:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
API_URL_INTERNAL=http://localhost:3001
```

- [ ] **Step 3: Confirm `.env.local` is gitignored**

Run: `git check-ignore -v .env.local`
Expected: prints the matching `.gitignore` rule (e.g. `.env*.local`). If it is NOT ignored, append `.env.local` to `.gitignore` and commit.

- [ ] **Step 4: Boot the backend in a side terminal**

```bash
cd /Users/mohammad.hamdan/Work/Mine/Projects/ThawbWaTeeb/pos-api && pnpm dev
```
Expected: `pos-api` listens on port 3001. Leave this terminal running through every visual verification step.

- [ ] **Step 5: Smoke pos-web**

```bash
cd /Users/mohammad.hamdan/Work/Mine/Projects/ThawbWaTeeb/pos-web && pnpm dev
```
Open `http://localhost:3000/en/login` in a browser. Sign in with the seed credentials documented in `pos-api/README.md`. Expected: lands on `/en/order` with the rail visible.

### Task 0.3: Gitignore tsconfig.tsbuildinfo

**Files:** `.gitignore`

- [ ] **Step 1: Inspect current `.gitignore`**

```bash
grep -n "tsconfig" .gitignore || echo "missing"
```

- [ ] **Step 2: Append rule if missing**

If step 1 printed `missing`, append:
```
# Incremental build cache
tsconfig.tsbuildinfo
```

- [ ] **Step 3: Untrack the file**

```bash
git rm --cached tsconfig.tsbuildinfo 2>/dev/null || true
```

- [ ] **Step 4: Commit & push**

```bash
git add .gitignore
git commit -m "chore: gitignore tsconfig.tsbuildinfo"
git push
```

---

# Phase 1 — Static CSS, font, and dead-code fixes

### Task 1.1: Add Cormorant Garamond italic axis to font preload

**Files:** `src/app/[locale]/layout.tsx`

- [ ] **Step 1: Locate the font link**

Open `src/app/[locale]/layout.tsx`. The relevant line is the Google Fonts `<link>` (currently around line 33).

- [ ] **Step 2: Replace the href**

Change:
```tsx
href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
```
To:
```tsx
href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
```
(Three italic weights appended: `1,400;1,500;1,600` — matches design `POS.html:9`.)

- [ ] **Step 3: Verify build**

```bash
pnpm build
```
Expected: 0 errors. The font URL is a static string; no type checking is affected.

- [ ] **Step 4: Visual verify**

Open `http://localhost:3000/en/settings/branding`. Scroll to the brand live-preview block (the `.blp-app` mockup). The italic "T h a w b" badge at the bottom-center (CSS class `.blp-badge` with `font-style:italic`) should render real italic Cormorant Garamond (curved strokes) instead of a faux-oblique slant.

- [ ] **Step 5: Commit & push**

```bash
git add src/app/[locale]/layout.tsx
git commit -m "fonts: preload Cormorant Garamond italic axis (matches design POS.html:9)"
git push
```

### Task 1.2: Fix `.rail .nav button, .rail .nav a` selector grouping

**Files:** `src/app/pos.css`

- [ ] **Step 1: Locate the broken block**

Open `src/app/pos.css`. Lines 40–52 currently read:

```css
.rail .nav button, .rail .nav a{
  width:62px;height:56px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
  color:var(--faint);transition:all .15s;position:relative;
}
.rail .nav button, .rail .nav a svg{width:21px;height:21px}
.rail .nav button, .rail .nav a .nlbl{font-size:9px;letter-spacing:.01em;font-weight:600}
.rail .nav button, .rail .nav a:hover{background:var(--surface-2);color:var(--text)}
.rail .nav button, .rail .nav a.active{background:var(--accent-soft);color:var(--accent)}
.rail .nav button, .rail .nav a.active .nlbl{color:var(--accent)}
.rail .nav button, .rail .nav a .badge{
  position:absolute;top:6px;right:11px;min-width:16px;height:16px;border-radius:9px;
  background:var(--danger);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;
}
```

- [ ] **Step 2: Replace with correctly-grouped selectors**

Replace the block above with:

```css
.rail .nav a,
.rail .nav button{
  width:62px;height:56px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
  color:var(--faint);transition:all .15s;position:relative;
}
.rail .nav a svg,
.rail .nav button svg{width:21px;height:21px}
.rail .nav a .nlbl,
.rail .nav button .nlbl{font-size:9px;letter-spacing:.01em;font-weight:600}
.rail .nav a:hover,
.rail .nav button:hover{background:var(--surface-2);color:var(--text)}
.rail .nav a.active,
.rail .nav button.active{background:var(--accent-soft);color:var(--accent)}
.rail .nav a.active .nlbl,
.rail .nav button.active .nlbl{color:var(--accent)}
.rail .nav a .badge,
.rail .nav button .badge{
  position:absolute;top:6px;right:11px;min-width:16px;height:16px;border-radius:9px;
  background:var(--danger);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;
}
```

- [ ] **Step 3: Verify visual parity at `/en/order`**

Open `http://localhost:3000/en/order`. The rail should look identical to before: 82px wide, icons 21×21, 9px uppercase labels under each icon, accent-soft background on the active item, no permanent hover on any item.

- [ ] **Step 4: Commit & push**

```bash
git add src/app/pos.css
git commit -m "css: fix .rail .nav selector grouping (a/button rules now apply correctly)"
git push
```

### Task 1.3: Fix `.set-nav button, .set-nav a` selector grouping

**Files:** `src/app/pos.css`

- [ ] **Step 1: Locate the block (lines 356–366 area)**

```css
.set-nav button,
.set-nav a{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:var(--r-sm);font-size:13.5px;font-weight:500;color:var(--muted);text-align:left;transition:all .15s;text-decoration:none;cursor:pointer}
.set-nav button svg,
.set-nav a svg{width:18px;height:18px;flex-shrink:0}
.set-nav button:hover,
.set-nav a:hover{background:var(--surface-2);color:var(--text)}
.set-nav button.on,
.set-nav a.on{background:var(--accent-soft);color:var(--accent);font-weight:600}
```

These selectors are already correctly grouped (one selector per line, comma at the end). **No change required** — but verify by reading the file. If any rule starts with `.set-nav button, .set-nav a <pseudo>` on a single line where the second selector lacks the `.set-nav button` repetition, fix it the same way as 1.2.

- [ ] **Step 2: Confirm no fix needed (or fix if found)**

Run: `grep -nE "\.set-nav button, \.set-nav a [^\{]" src/app/pos.css`
Expected: no matches. If matches are found, apply the same fan-out fix as 1.2.

- [ ] **Step 3: No commit if no change.** Move to next task.

### Task 1.4: Style `.cust-attach.required` for missing customer

**Files:** `src/app/pos.css`

- [ ] **Step 1: Locate `.cust-attach` block (around line 135)**

The existing block:
```css
.cust-attach{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface-2);cursor:pointer;transition:all .15s}
.cust-attach:hover{border-color:var(--accent);background:#fff}
```

- [ ] **Step 2: Append `.cust-attach.required` rule directly after `.cust-attach:hover`**

```css
.cust-attach.required{border:1px dashed var(--warn);background:#FEF6EC}
.cust-attach.required .av{background:var(--warn);color:#fff}
.cust-attach.required:hover{border-color:var(--warn);background:#fff}
```

- [ ] **Step 3: Visual verify at `/en/order`**

Open New Order. With no items yet, the customer slot says "Attach customer / Tap to pick a customer" — it should now render with a **dashed orange border** and an **orange avatar circle** to indicate the required action. Attach a customer; border becomes solid border-color from the base rule, avatar reverts to accent-soft.

- [ ] **Step 4: Commit & push**

```bash
git add src/app/pos.css
git commit -m "css: style .cust-attach.required (dashed warn border) so missing customer is visible"
git push
```

### Task 1.5: Fix end-shift modal confirm button class

**Files:** `src/components/AppShell.tsx`

- [ ] **Step 1: Locate the end-shift modal (around lines 459–477)**

The current confirm button:
```tsx
<button className="btn btn-primary" onClick={confirmEndShift}>{t('endShift')}</button>
```

- [ ] **Step 2: Change `btn-primary` → `btn-pri`**

```tsx
<button className="btn btn-pri" onClick={confirmEndShift}>{t('endShift')}</button>
```

- [ ] **Step 3: Visual verify**

Open `http://localhost:3000/en/order`. Click "Check In" in the topbar. Wait ~2 minutes (or shorten by changing the system clock for testing). Click "On shift · Check Out". The end-shift modal opens. The "End shift" button should now render with the accent fill, `13px / 600` font, white text — exact match to other `.btn-pri` buttons (e.g. New Customer in Customers screen).

- [ ] **Step 4: Commit & push**

```bash
git add src/components/AppShell.tsx
git commit -m "ui: end-shift confirm uses .btn-pri (was dead .btn-primary class)"
git push
```

### Task 1.6: i18n the end-shift Cancel button

**Files:** `src/components/AppShell.tsx`

- [ ] **Step 1: Locate the Cancel button (same modal as 1.5)**

```tsx
<button className="btn" onClick={() => setEndShiftConfirm(null)}>Cancel</button>
```

- [ ] **Step 2: Add a `tCommon` hook if not present**

Search for `const tCommon` in `AppShell.tsx`. If absent, add right after the existing `const tc = useTranslations('Crumbs');`:

```tsx
const tCommon = useTranslations('Common');
```

- [ ] **Step 3: Replace the hardcoded "Cancel"**

```tsx
<button className="btn" onClick={() => setEndShiftConfirm(null)}>{tCommon('cancel')}</button>
```

- [ ] **Step 4: Type-check and commit**

```bash
pnpm tsc --noEmit
git add src/components/AppShell.tsx
git commit -m "i18n: end-shift modal Cancel uses Common.cancel"
git push
```

### Task 1.7: Remove vestigial Tailwind

**Files:** `tailwind.config.ts` (DELETE), `postcss.config.mjs` (DELETE), `package.json`

- [ ] **Step 1: Confirm Tailwind is unused**

```bash
grep -rE "@apply|class(Name)?=[\"'][^\"']*\b(text|bg|p|m|flex|grid|w|h)-[0-9a-z]+" src/ --include="*.tsx" --include="*.ts" | head
```
Expected: empty output. If there are matches, they are spurious — confirm the strings are NOT Tailwind utility classes (the design CSS uses non-Tailwind class names that happen to start with `bg-`, etc.). If real Tailwind utilities are present in components, abort this task and open a follow-up.

- [ ] **Step 2: Delete `tailwind.config.ts`**

```bash
git rm tailwind.config.ts
```

- [ ] **Step 3: Delete `postcss.config.mjs`**

```bash
git rm postcss.config.mjs
```

- [ ] **Step 4: Remove devDeps from `package.json`**

Open `package.json`. Remove these lines from `devDependencies`:
```json
"postcss": "^8",
"tailwindcss": "^3.4.1",
```

- [ ] **Step 5: Reinstall**

```bash
pnpm install
```
Expected: lockfile updates; `node_modules/tailwindcss` removed.

- [ ] **Step 6: Build**

```bash
pnpm build
```
Expected: 0 errors. CSS still loads from `pos.css` (imported in `[locale]/layout.tsx`). Output route table identical to baseline.

- [ ] **Step 7: Visual verify**

Open `/en/order`, `/en/orders`, `/en/settings/catalogue`, `/en/finance`. Layout unchanged.

- [ ] **Step 8: Commit & push**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: drop vestigial Tailwind + PostCSS (no utility classes in use)"
git push
```

---

# Phase 2 — Tenant-safe copy

### Task 2.1: Drop "Mangrove Plaza" from Login subtitle + interpolate (where session permits)

**Files:** `messages/en.json`, `messages/ar.json`, `src/app/[locale]/login/LoginForm.tsx`

- [ ] **Step 1: Edit `messages/en.json` `Login.subtitle`**

Find:
```json
"subtitle": "Sign in to your terminal — Mangrove Plaza",
```
Replace with:
```json
"subtitle": "Sign in to your terminal",
```

Rationale: the login screen runs **before** session bootstrap, so we cannot interpolate an active store. Drop the branch.

- [ ] **Step 2: Apply identical change to `messages/ar.json` line 63**

(Phase 5 will overwrite this file with full Arabic; for now keep the English-source equivalent in sync so this branch remains coherent.)

- [ ] **Step 3: Verify `LoginForm.tsx:65` consumes `t('subtitle')` unchanged**

The component reads `<div className="lg-sub">{t('subtitle')}</div>`. No code change needed.

- [ ] **Step 4: Visual verify**

`http://localhost:3000/en/login` — should now read "Sign in to your terminal" with no branch suffix.

- [ ] **Step 5: Commit & push**

```bash
git add messages/en.json messages/ar.json
git commit -m "i18n: drop Mangrove Plaza from Login.subtitle (tenant-safe)"
git push
```

### Task 2.2: Parameterize Reports branch subtitle with active store

**Files:** `messages/en.json`, `messages/ar.json`, `src/app/[locale]/(pos)/reports/ReportsScreen.tsx`

- [ ] **Step 1: Edit `messages/en.json` `Reports.branch`**

Find:
```json
"branch": "Mangrove Plaza branch",
```
Replace with:
```json
"branch": "{store} branch",
```

- [ ] **Step 2: Mirror the change in `messages/ar.json` line 479**

(Phase 5 overwrites in full; keep sync.)

- [ ] **Step 3: Wire active store in `ReportsScreen.tsx`**

ReportsScreen receives `bootstrap` indirectly via `useBootstrap()` context (check `BootstrapContext.tsx`). At the top of the component body, add:

```tsx
import { useBootstrap } from '@/components/BootstrapContext';
// …
const bootstrap = useBootstrap();
const activeStoreName =
  bootstrap.stores.find((s) => s.id === bootstrap.activeStoreId)?.name ?? '—';
```

- [ ] **Step 4: Replace the subtitle template (currently ~line 156)**

From:
```tsx
const subtitle = `${range === 'Custom' ? t('customRangeLabel') : t(`ranges.${range}`)} · ${t('branch')}`;
```
To:
```tsx
const subtitle = `${range === 'Custom' ? t('customRangeLabel') : t(`ranges.${range}`)} · ${t('branch', { store: activeStoreName })}`;
```

- [ ] **Step 5: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors. (next-intl validates the `{store}` placeholder at type level if `messages/en.json` is the schema source; if a build error references missing context, ensure `BootstrapContext` is exported correctly.)

- [ ] **Step 6: Visual verify**

`/en/reports` → subtitle reads `Today · <Active Store Name> branch`.

- [ ] **Step 7: Commit & push**

```bash
git add messages/en.json messages/ar.json src/app/[locale]/(pos)/reports/ReportsScreen.tsx
git commit -m "i18n: Reports.branch interpolates active store name"
git push
```

### Task 2.3: Drop hardcoded branchAddress in GeneralScreen

**Files:** `src/app/[locale]/(pos)/settings/general/GeneralScreen.tsx`

- [ ] **Step 1: Locate the two fallbacks (lines 62 + 97)**

```tsx
const [branchAddress, setBranchAddress] = useState<string>(branding?.branchAddress ?? 'Shop 4, Mangrove Plaza, Majan — Dubai');
// …
setBranchAddress(branding?.branchAddress ?? 'Shop 4, Mangrove Plaza, Majan — Dubai');
```

- [ ] **Step 2: Replace both literal fallbacks with empty string**

```tsx
const [branchAddress, setBranchAddress] = useState<string>(branding?.branchAddress ?? '');
// …
setBranchAddress(branding?.branchAddress ?? '');
```

- [ ] **Step 3: Add placeholder on the input**

Locate the `<input>` that binds `branchAddress`. Add `placeholder={t('branchAddressPlaceholder')}` (existing keys are under `Settings.General`).

- [ ] **Step 4: Add the placeholder key to `messages/en.json`**

Add to `Settings.General` namespace:
```json
"branchAddressPlaceholder": "Shop number, building, street, city",
```

(Add the matching key in `messages/ar.json` per Phase 5 sync rule.)

- [ ] **Step 5: Visual verify**

`/en/settings/general` on a fresh tenant: branch address field renders empty with the placeholder, not Mangrove Plaza's address.

- [ ] **Step 6: Commit & push**

```bash
git add src/app/[locale]/(pos)/settings/general/GeneralScreen.tsx messages/en.json messages/ar.json
git commit -m "i18n: drop hardcoded Mangrove Plaza branch address in Settings → General"
git push
```

### Task 2.4: i18n WhatsApp newChat placeholders

**Files:** `src/app/[locale]/(pos)/whatsapp/WhatsappScreen.tsx`, `messages/en.json`, `messages/ar.json`

- [ ] **Step 1: Locate the new-chat modal (around lines 615–630)**

```tsx
<input placeholder="+971 50 123 4567" … />
<input placeholder="Customer name (optional)" … />
```

- [ ] **Step 2: Add keys to `messages/en.json` under `WhatsApp`**

```json
"newChatPhonePlaceholder": "+971 50 123 4567",
"newChatNamePlaceholder": "Customer name (optional)",
```

(Note: the leading `+971…` is a valid example for the Dubai market and stays as English source; the Arabic translation may substitute a localized example.)

- [ ] **Step 3: Replace the placeholders**

```tsx
<input placeholder={t('newChatPhonePlaceholder')} … />
<input placeholder={t('newChatNamePlaceholder')} … />
```

- [ ] **Step 4: Type-check + visual verify**

```bash
pnpm tsc --noEmit
```
Open `/en/whatsapp`, click the "+ new chat" icon top-right of the sidebar — the modal opens with the same placeholders, now coming from i18n.

- [ ] **Step 5: Commit & push**

```bash
git add src/app/[locale]/(pos)/whatsapp/WhatsappScreen.tsx messages/en.json messages/ar.json
git commit -m "i18n: route WhatsApp newChat placeholders through translations"
git push
```

### Task 2.5: i18n Settings + Finance placeholders sweep

**Files (10 components):**
- `src/app/[locale]/(pos)/settings/stores/StoresSettings.tsx:234`
- `src/app/[locale]/(pos)/settings/pickup/PickupSettings.tsx:286`
- `src/app/[locale]/(pos)/settings/subscriptions/SubscriptionsScreen.tsx:168`
- `src/app/[locale]/(pos)/settings/inventory/InventoryScreen.tsx:213`
- `src/app/[locale]/(pos)/settings/users/UsersAndRoles.tsx:303, 402, 409`
- `src/app/[locale]/(pos)/settings/racks/RacksScreen.tsx:87`
- `src/app/[locale]/(pos)/settings/promos/PromosScreen.tsx:339`
- `src/app/[locale]/(pos)/settings/zones/ZonesScreen.tsx:208`
- `src/app/[locale]/(pos)/finance/FinanceScreen.tsx:665`

Plus `messages/en.json` + `messages/ar.json`.

- [ ] **Step 1: Add new i18n keys**

In `messages/en.json`, add or extend the appropriate namespaces:

```json
"Settings": {
  "Stores": {
    "hoursPlaceholder": "e.g. 8:00 AM – 10:00 PM"
  },
  "Pickup": {
    "slotLabelPlaceholder": "e.g. 16:00 – 18:00"
  },
  "Subscriptions": {
    "includesPlaceholder": "e.g. 20 shirts + 4 abayas · free pickup"
  },
  "Inventory": {
    "namePlaceholder": "e.g. Spray bottle"
  },
  "Users": {
    "rolePlaceholder": "e.g. Supervisor",
    "emailPlaceholder": "name@example.com",
    "passwordKeepHint": "Leave blank to keep",
    "passwordSetHint": "Set a password"
  },
  "Racks": {
    "addLabelPlaceholder": "Add rack label… e.g. A-05"
  },
  "Zones": {
    "namePlaceholder": "e.g. Dubai Marina"
  }
},
"Finance": {
  "owners": {
    "namePlaceholder": "e.g. Quentin"
  }
}
```

(Existing namespaces may already partly match — preserve existing keys, only add what's missing.)

- [ ] **Step 2: In each component, replace the hardcoded placeholder**

For each file:line listed above, replace `placeholder="…"` with `placeholder={t('<correspondingKey>')}` where `t` is the local `useTranslations('<Namespace>')` hook. If the component does not already destructure the relevant namespace, add the hook at the top:

```tsx
const t = useTranslations('Settings.Stores'); // adjust per file
```

Detail per file (one commit per file to keep diffs reviewable):

**2.5a** `StoresSettings.tsx`: `placeholder="e.g. 8:00 AM – 10:00 PM"` → `placeholder={t('hoursPlaceholder')}` with `useTranslations('Settings.Stores')`.

**2.5b** `PickupSettings.tsx`: `placeholder="e.g. 16:00 – 18:00"` → `placeholder={t('slotLabelPlaceholder')}` with `useTranslations('Settings.Pickup')`.

**2.5c** `SubscriptionsScreen.tsx`: `placeholder="e.g. 20 shirts + 4 abayas · free pickup"` → `placeholder={t('includesPlaceholder')}` with `useTranslations('Settings.Subscriptions')`.

**2.5d** `InventoryScreen.tsx`: `placeholder="e.g. Spray bottle"` → `placeholder={t('namePlaceholder')}` with `useTranslations('Settings.Inventory')`.

**2.5e** `UsersAndRoles.tsx`: three placeholders → three keys (`rolePlaceholder`, `emailPlaceholder`, `passwordKeepHint` / `passwordSetHint`). The conditional `isEdit ? 'Leave blank to keep' : 'Set a password'` becomes `isEdit ? t('passwordKeepHint') : t('passwordSetHint')`.

**2.5f** `RacksScreen.tsx`: `placeholder="Add rack label… e.g. A-05"` → `placeholder={t('addLabelPlaceholder')}` with `useTranslations('Settings.Racks')`.

**2.5g** `PromosScreen.tsx`: `placeholder="Search by name or phone"` → use existing `Customers.searchByNameOrPhone` if it exists (it does — line ~187 in en.json `Order.searchByNameOrPhone`). Reuse via `useTranslations('Order')` or add a new namespaced key.

**2.5h** `ZonesScreen.tsx`: `placeholder="e.g. Dubai Marina"` → `placeholder={t('namePlaceholder')}` with `useTranslations('Settings.Zones')`.

**2.5i** `FinanceScreen.tsx`: `placeholder="e.g. Quentin"` → `placeholder={t('owners.namePlaceholder')}` with `useTranslations('Finance')`.

- [ ] **Step 3: After each sub-step a–i, type-check and commit**

```bash
pnpm tsc --noEmit
git add <files-touched>
git commit -m "i18n: route Settings.<area> placeholders through translations"
git push
```

(End of Phase 2 sweep — 9 commits.)

---

# Phase 3 — Real integrations (replace 5 stubs + 1 wrong amount)

### Task 3.1: Fix cash-up close-shift toast amount

**Files:** `src/app/[locale]/(pos)/reports/ReportsScreen.tsx`

- [ ] **Step 1: Locate `submitCashUp` (around line 138)**

```tsx
async function submitCashUp(counted: number) {
  try {
    await api('/shifts/current/close', { method: 'POST', body: { countedDrawer: counted } });
    toast.show(t('cashUp.closedToast', { amount: AED(0) }));
    setShowCashUp(false);
    router.refresh();
  } catch (err: any) { … }
}
```

- [ ] **Step 2: Use the counted amount in the toast (and prefer the server-returned closed amount when available)**

```tsx
async function submitCashUp(counted: number) {
  try {
    const result = await api<{ closedDrawer?: number }>(
      '/shifts/current/close',
      { method: 'POST', body: { countedDrawer: counted } },
    );
    const closed = result?.closedDrawer ?? counted;
    toast.show(t('cashUp.closedToast', { amount: AED(closed) }));
    setShowCashUp(false);
    router.refresh();
  } catch (err: any) {
    const msg =
      err?.status === 400 || err?.status === 404
        ? t('cashUp.noShift')
        : t('cashUp.failed');
    toast.show(msg);
  }
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Verify (manual)**

`/en/reports`, click **Cash Up**. Enter a non-zero counted amount, submit. Toast should read "Shift closed · AED <counted-amount>".

- [ ] **Step 5: Commit & push**

```bash
git add src/app/[locale]/(pos)/reports/ReportsScreen.tsx
git commit -m "fix(reports): cash-up toast shows counted amount (not AED 0.00)"
git push
```

### Task 3.2: Implement WhatsApp file upload

**Files:** `src/app/[locale]/(pos)/whatsapp/WhatsappScreen.tsx`

- [ ] **Step 1: Locate `onFileChosen` handler (around line 248)**

Current body discards the file and toasts "uploadComingSoon".

- [ ] **Step 2: Replace with a real upload + message send**

The endpoint contract: `POST /files/upload` (multipart `file`) → `{ url, filename, mimeType, sizeBytes }`. Then send a message referencing the uploaded file via the existing message endpoint.

```tsx
async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!activeConvId) return;
  // Reset the input so the same file can be re-selected after a failure.
  e.target.value = '';

  // 10 MB hard cap so we don't blow up the multipart upload.
  if (file.size > 10 * 1024 * 1024) {
    toast.show(t('uploadTooLarge'));
    return;
  }

  setUploadBusy(true);
  try {
    const fd = new FormData();
    fd.append('file', file);
    // api() supports FormData bodies by detecting instanceof FormData.
    // If not, fall back to fetch() with credentials.
    const uploaded = await api<{ url: string; filename: string; mimeType: string; sizeBytes: number }>(
      '/files/upload',
      { method: 'POST', body: fd },
    );

    await api(`/whatsapp/conversations/${activeConvId}/messages`, {
      method: 'POST',
      body: {
        kind: uploaded.mimeType.startsWith('image/') ? 'IMAGE' : 'FILE',
        attachment: {
          url: uploaded.url,
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
        },
      },
    });

    // Refresh the thread so the new message lands.
    await reloadActiveConversation();
  } catch (err: any) {
    toast.show(err?.detail?.message || t('uploadFailed'));
  } finally {
    setUploadBusy(false);
  }
}
```

- [ ] **Step 3: Add the supporting hooks if missing**

Above the component body, ensure:

```tsx
const [uploadBusy, setUploadBusy] = useState(false);
```

`reloadActiveConversation()` already exists (the screen reloads via the same path used after sending a text message). If named differently, use the existing function.

- [ ] **Step 4: Disable the attach button while busy**

Find the attach button (the paperclip / file-input trigger). Add `disabled={uploadBusy}`.

- [ ] **Step 5: Add i18n keys**

In `messages/en.json` under `WhatsApp`:
```json
"uploadTooLarge": "File too large — max 10 MB",
"uploadFailed": "Could not upload file",
```

Remove the old `uploadComingSoon` key.

- [ ] **Step 6: Handle missing endpoint**

Run a manual upload against the running pos-api. If `POST /files/upload` returns 404, **do not silently re-stub**. Either (a) implement the endpoint in pos-api on a parallel branch, or (b) leave the upload disabled with a tooltip explaining the dependency.

- [ ] **Step 7: Type-check, build, manual verify**

```bash
pnpm tsc --noEmit
pnpm build
```
Open `/en/whatsapp`, select any conversation, click the paperclip, pick a small image. Expected: image bubble appears in the thread; pos-api logs the upload.

- [ ] **Step 8: Commit & push**

```bash
git add src/app/[locale]/(pos)/whatsapp/WhatsappScreen.tsx messages/en.json messages/ar.json
git commit -m "feat(whatsapp): real file upload to /files/upload + attach as message"
git push
```

### Task 3.3: Implement WhatsApp clear chat

**Files:** `src/app/[locale]/(pos)/whatsapp/WhatsappScreen.tsx`

- [ ] **Step 1: Locate `clearChat` (around line 194)**

Current body: `toast.show(t('clearComingSoon')); setMenuOpen(false);` only.

- [ ] **Step 2: Replace with confirm + DELETE**

```tsx
async function clearChat() {
  if (!activeConvId) return;
  setMenuOpen(false);
  // Block; this is destructive. window.confirm is acceptable for an internal
  // POS terminal — we are not running on touch-only mobile.
  if (!window.confirm(t('clearConfirm'))) return;
  try {
    await api(`/whatsapp/conversations/${activeConvId}/messages`, { method: 'DELETE' });
    toast.show(t('clearSucceeded'));
    await reloadActiveConversation();
  } catch (err: any) {
    toast.show(err?.detail?.message || t('clearFailed'));
  }
}
```

- [ ] **Step 3: Add i18n keys**

In `messages/en.json` under `WhatsApp`:
```json
"clearConfirm": "Clear all messages in this chat? This cannot be undone.",
"clearSucceeded": "Messages cleared",
"clearFailed": "Could not clear messages",
```

Remove `clearComingSoon`.

- [ ] **Step 4: Endpoint check**

Same as 3.2 Step 6 — if `DELETE /whatsapp/conversations/{id}/messages` returns 404, do not stub.

- [ ] **Step 5: Visual verify**

`/en/whatsapp` → select chat → ⋯ menu → "Clear messages" → confirm. Thread becomes empty; toast confirms.

- [ ] **Step 6: Commit & push**

```bash
git add src/app/[locale]/(pos)/whatsapp/WhatsappScreen.tsx messages/en.json messages/ar.json
git commit -m "feat(whatsapp): real clear-chat via DELETE /whatsapp/conversations/:id/messages"
git push
```

### Task 3.4: Implement Print Receipt in New Order

**Files:** `src/lib/print.ts` (new), `src/app/[locale]/(pos)/order/NewOrderScreen.tsx`

- [ ] **Step 1: Create the print helper**

Create `src/lib/print.ts`:

```ts
import { api } from './api-client';

export type PrintJobKind = 'RECEIPT' | 'Z_REPORT' | 'GARMENT_LABEL';

export interface PrintJobBase {
  storeId?: string;
  /** Optional cashier-friendly label shown in the print queue UI. */
  label?: string;
}

export interface ReceiptPrintJob extends PrintJobBase {
  kind: 'RECEIPT';
  orderId: string;
  copies?: number;
}

export interface ZReportPrintJob extends PrintJobBase {
  kind: 'Z_REPORT';
  range: 'Today' | 'Yesterday' | 'Week' | 'Month' | 'Custom';
  from?: string;
  to?: string;
}

export type PrintJob = ReceiptPrintJob | ZReportPrintJob;

export async function enqueuePrintJob(job: PrintJob): Promise<{ id: string; status: 'QUEUED' | 'PRINTED' | 'FAILED' }> {
  return api<{ id: string; status: 'QUEUED' | 'PRINTED' | 'FAILED' }>(
    '/print-jobs',
    { method: 'POST', body: job, storeId: job.storeId },
  );
}
```

- [ ] **Step 2: Replace `printReceipt` in `NewOrderScreen.tsx`**

Current body (line 173):
```tsx
function printReceipt() {
  if (!cart.length) return;
  toast.show(t('receiptPrinted'));
}
```

Replace with:
```tsx
async function printReceipt() {
  // For an in-progress (unsaved) cart we have no orderId to print. Only
  // enable when editing an existing order; when creating, the receipt
  // gets printed automatically at charge time by the backend's payment
  // → printer pipeline.
  if (!editing) {
    toast.show(t('printAfterCharge'));
    return;
  }
  try {
    await enqueuePrintJob({ kind: 'RECEIPT', orderId: editing.id, storeId });
    toast.show(t('receiptQueued', { number: editing.number }));
  } catch (err: any) {
    toast.show(err?.detail?.message || t('receiptFailed'));
  }
}
```

Add the import at the top of `NewOrderScreen.tsx`:
```tsx
import { enqueuePrintJob } from '@/lib/print';
```

- [ ] **Step 3: Add i18n keys**

In `messages/en.json` under `Order`:
```json
"printAfterCharge": "Print is available after the order is created",
"receiptQueued": "Receipt for #{number} sent to printer",
"receiptFailed": "Could not queue receipt"
```

Drop `receiptPrinted` key once no references remain (use grep to confirm).

- [ ] **Step 4: Type-check + manual verify**

```bash
pnpm tsc --noEmit
```

`/en/order` with empty cart → Print button does nothing (correct — cart empty).
`/en/order?edit=<existingOrderId>` → Print button enqueues a real job. pos-api logs receive the request.

- [ ] **Step 5: Commit & push**

```bash
git add src/lib/print.ts src/app/[locale]/(pos)/order/NewOrderScreen.tsx messages/en.json messages/ar.json
git commit -m "feat(order): Print Receipt enqueues real /print-jobs (RECEIPT)"
git push
```

### Task 3.5: Implement Print Z-Report

**Files:** `src/app/[locale]/(pos)/reports/ReportsScreen.tsx`

- [ ] **Step 1: Replace the toast-only handler**

Locate (line 203):
```tsx
<button className="btn btn-ghost" onClick={() => toast.show(t('printed'))}>
  <Icon.print size={16} /> {t('printZ')}
</button>
```

Add a state hook and async handler:

```tsx
const [printingZ, setPrintingZ] = useState(false);
async function printZReport() {
  setPrintingZ(true);
  try {
    await enqueuePrintJob({
      kind: 'Z_REPORT',
      range,
      from: range === 'Custom' ? from : undefined,
      to: range === 'Custom' ? to : undefined,
    });
    toast.show(t('zQueued'));
  } catch (err: any) {
    toast.show(err?.detail?.message || t('zFailed'));
  } finally {
    setPrintingZ(false);
  }
}
```

Update the button:
```tsx
<button className={`btn btn-ghost${printingZ ? ' btn-loading' : ''}`} disabled={printingZ} onClick={printZReport}>
  <Icon.print size={16} /> {t('printZ')}
</button>
```

Add the import:
```tsx
import { enqueuePrintJob } from '@/lib/print';
```

- [ ] **Step 2: i18n keys**

In `messages/en.json` under `Reports`:
```json
"zQueued": "Z-Report sent to printer",
"zFailed": "Could not queue Z-Report"
```

Drop `printed` (the old toast-only success key).

- [ ] **Step 3: Verify**

`/en/reports?range=Today` → click "Print Z-Report" → button shows spinner → toast confirms. pos-api logs receive `POST /print-jobs { kind: 'Z_REPORT', range: 'Today' }`.

- [ ] **Step 4: Commit & push**

```bash
git add src/app/[locale]/(pos)/reports/ReportsScreen.tsx messages/en.json messages/ar.json
git commit -m "feat(reports): Print Z-Report enqueues real /print-jobs (Z_REPORT)"
git push
```

### Task 3.6: Implement Export CSV (client-side blob download)

**Files:** `src/lib/csv.ts` (new), `src/app/[locale]/(pos)/reports/ReportsScreen.tsx`

- [ ] **Step 1: Create the CSV helper**

Create `src/lib/csv.ts`:

```ts
/**
 * Minimal RFC-4180 CSV serializer. Escapes double quotes, wraps fields
 * containing comma, quote, or newline. Handles Date by ISO-8601, number by
 * String(), undefined/null by empty string.
 */
export type CsvValue = string | number | boolean | Date | null | undefined;

function serialize(v: CsvValue): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<Row extends Record<string, CsvValue>>(
  rows: Row[],
  columns: { key: keyof Row; header: string }[],
): string {
  const header = columns.map((c) => serialize(c.header)).join(',');
  const body = rows
    .map((r) => columns.map((c) => serialize(r[c.key])).join(','))
    .join('\n');
  // Prepend BOM so Excel opens UTF-8 correctly.
  return `﻿${header}\n${body}\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Wire Export CSV in `ReportsScreen.tsx`**

Replace the toast-only handler (line 200):
```tsx
<button className="btn btn-ghost" data-rexport onClick={() => toast.show(t('exported'))}>
  {t('exportCsv')}
</button>
```

With:
```tsx
<button className="btn btn-ghost" data-rexport onClick={exportCsv}>
  {t('exportCsv')}
</button>
```

And add the handler — schema chosen to mirror the on-screen Reports KPIs so the downloaded CSV is self-describing:

```tsx
function exportCsv() {
  if (!overview) {
    toast.show(t('exportNoData'));
    return;
  }
  const rangeLabel = range === 'Custom' ? `${from}..${to}` : range;
  const rows = [
    { metric: 'Gross Sales', value: overview.grossSales },
    { metric: 'Orders', value: overview.orders },
    { metric: 'Items', value: overview.items },
    { metric: 'Avg Order Value', value: overview.avgOrderValue },
    { metric: 'Express Orders', value: overview.expressOrders },
    { metric: 'Outstanding', value: overview.outstanding },
    { metric: 'New Customers', value: overview.newCustomers },
    { metric: 'Avg Turnaround (hrs)', value: overview.avgTurnaroundHrs },
  ];
  const csv = toCsv(rows, [
    { key: 'metric', header: 'Metric' },
    { key: 'value', header: `Value (${activeStoreName}, ${rangeLabel})` },
  ]);
  downloadCsv(`thawb-report-${rangeLabel}.csv`, csv);
  toast.show(t('exportSucceeded'));
}
```

Add imports:
```tsx
import { toCsv, downloadCsv } from '@/lib/csv';
```

(`activeStoreName` is already in scope from Task 2.2.)

- [ ] **Step 3: i18n keys**

In `messages/en.json` under `Reports`:
```json
"exportNoData": "No data to export for this range",
"exportSucceeded": "Report downloaded"
```

Drop `exported`.

- [ ] **Step 4: Verify**

`/en/reports` → click "Export CSV". A file `thawb-report-Today.csv` downloads. Opens cleanly in Excel/Numbers (BOM ensures UTF-8 detection). Metric column and Value column populated.

- [ ] **Step 5: Commit & push**

```bash
git add src/lib/csv.ts src/app/[locale]/(pos)/reports/ReportsScreen.tsx messages/en.json messages/ar.json
git commit -m "feat(reports): Export CSV generates real downloadable file"
git push
```

---

# Phase 4 — Accessibility polish

### Task 4.1: Add `:focus-visible` rings

**Files:** `src/app/pos.css`

- [ ] **Step 1: Append a focus-visible block at the end of `pos.css`**

```css
/* ---------- A11Y :focus-visible ---------- */
/* Browser default outlines are killed by .input/.btn/.cat/etc rules.
   Restore a keyboard-only ring (mouse clicks don't trigger focus-visible)
   so Tab-users can see where they are. The ring uses the accent token so
   it follows the active branding. */
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.input:focus-visible,.inp:focus-visible{outline-offset:0;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.btn:focus-visible,.btn-pri:focus-visible,.btn-ghost:focus-visible,.btn-charge:focus-visible,.btn-hold:focus-visible,.t-btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.cat:focus-visible,.tier-tab:focus-visible,.seg button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.rail .nav a:focus-visible,.rail .nav button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:12px}
.set-nav a:focus-visible,.set-nav button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.switch:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
```

- [ ] **Step 2: Verify in the browser (keyboard only)**

Open `/en/order`. Press Tab repeatedly from page load. Confirm a visible ring appears around: tier tabs, category chips, search input, item cards, customer-attach, qty +/- buttons, hold/cancel/charge. Use a mouse to click — no ring should appear (this is `:focus-visible`, not `:focus`).

- [ ] **Step 3: Commit & push**

```bash
git add src/app/pos.css
git commit -m "a11y: add keyboard-only :focus-visible rings across interactive elements"
git push
```

### Task 4.2: Switch toggles → `<button role="switch" aria-checked>`

**Files (every place a `.switch` element is rendered):**
- `src/app/[locale]/(pos)/order/NewOrderScreen.tsx` (express toggle)
- Every Settings sub-screen rendering `<span class="switch">` or `<div class="switch">`. Enumerate with:

```bash
grep -rnE "className=[\"']\s*switch|className=[\"']switch( on)?[\"']" src --include="*.tsx"
```

- [ ] **Step 1: Run the enumeration**

Run the grep above and confirm the list (expect ~10 hits across settings sub-screens).

- [ ] **Step 2: For each hit, convert the element**

Before:
```tsx
<span className={`switch${on ? ' on' : ''}`} />
```
After:
```tsx
<button
  type="button"
  role="switch"
  aria-checked={on}
  aria-label={t('toggleLabel')}
  className={`switch${on ? ' on' : ''}`}
  onClick={() => setOn((v) => !v)}
/>
```

If the switch is inside a clickable parent (like `.exp-toggle`), the parent retains its click handler and the inner switch becomes a presentational button — set `tabIndex={-1}` and remove `onClick` on the inner element to keep one focusable per logical control:

```tsx
<button className={`exp-toggle${expressOn ? ' on' : ''}`}
  type="button"
  role="switch"
  aria-checked={expressOn}
  onClick={() => setExpressOn((v) => !v)}>
  <span>{t('expressLabel', { pct: expressPct })}</span>
  <span aria-hidden="true" className={`switch${expressOn ? ' on' : ''}`} />
</button>
```

(In this hybrid case the OUTER button gets `role="switch"`; the inner `<span>` is decorative.)

- [ ] **Step 3: Ensure `aria-label` keys exist**

For standalone switches, add a per-row label key under the relevant Settings namespace if missing (most rows already have a `<label>` element — when present, prefer `aria-labelledby={labelId}` instead of `aria-label`).

- [ ] **Step 4: Verify in the browser with VoiceOver / NVDA**

Tab to a switch in Settings → Loyalty. Screen reader should announce e.g. "Enable loyalty, switch, off" and toggle on Space. Visual rendering should be identical (the CSS targets the class, not the tag).

- [ ] **Step 5: Type-check + commit per file**

Make one commit per file changed to keep diffs reviewable:

```bash
pnpm tsc --noEmit
git add <file>
git commit -m "a11y(<area>): switch → button role=switch aria-checked"
git push
```

### Task 4.3: Login `.lg-err` gets `role="alert"`

**Files:** `src/app/[locale]/login/LoginForm.tsx`

- [ ] **Step 1: Locate the error div (line 154)**

```tsx
<div className={`lg-err ${err?.kind === 'info' ? 'info' : ''}`} id="lg-err" hidden={!err}>
  {err?.text ?? ''}
</div>
```

- [ ] **Step 2: Add ARIA**

```tsx
<div
  className={`lg-err ${err?.kind === 'info' ? 'info' : ''}`}
  id="lg-err"
  role={err?.kind === 'info' ? 'status' : 'alert'}
  aria-live={err?.kind === 'info' ? 'polite' : 'assertive'}
  hidden={!err}
>
  {err?.text ?? ''}
</div>
```

(`role="alert"` for hard errors, `role="status"` for the reset-link info message — different urgency.)

- [ ] **Step 3: Verify with VoiceOver**

Submit the login form with an empty password. VoiceOver announces "Please enter your password." immediately.

- [ ] **Step 4: Commit & push**

```bash
git add src/app/[locale]/login/LoginForm.tsx
git commit -m "a11y(login): error div uses role=alert / status (announces to AT)"
git push
```

### Task 4.4: Modal focus trap

**Files:** `src/components/FocusTrap.tsx` (new), `src/components/AppShell.tsx`, every screen that renders a `.modal-scrim.show`

- [ ] **Step 1: Create the focus-trap component**

Create `src/components/FocusTrap.tsx`:

```tsx
'use client';

import { ReactNode, useEffect, useRef } from 'react';

interface FocusTrapProps {
  /** True when the trap is mounted/active. */
  active: boolean;
  /** Called on Escape or scrim click — typically closes the modal. */
  onEscape?: () => void;
  children: ReactNode;
}

/**
 * Keyboard focus trap for our `.modal` content. Saves the previously-focused
 * element on mount, focuses the first focusable inside on mount, cycles Tab
 * within the container, and restores focus on unmount.
 *
 * We deliberately do not implement a full inert-attribute polyfill — pos-web
 * only ever renders one modal at a time and the scrim is `position:fixed
 * inset:0`, so background interaction is already blocked visually.
 */
export default function FocusTrap({ active, onEscape, children }: FocusTrapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreToRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    restoreToRef.current = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        ref.current!.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    const list = focusables();
    list[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreToRef.current?.focus();
    };
  }, [active, onEscape]);

  return <div ref={ref}>{children}</div>;
}
```

- [ ] **Step 2: Wrap each modal in `AppShell.tsx`**

For each `.modal-scrim show` block (Store Picker, User Menu, End Shift Confirm), wrap the inner `.modal` with `<FocusTrap>`:

Before:
```tsx
{storePickerOpen && (
  <div className="modal-scrim show" onClick={() => setStorePickerOpen(false)}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      …
    </div>
  </div>
)}
```

After:
```tsx
{storePickerOpen && (
  <div className="modal-scrim show" onClick={() => setStorePickerOpen(false)}>
    <FocusTrap active onEscape={() => setStorePickerOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        …
      </div>
    </FocusTrap>
  </div>
)}
```

Add the import:
```tsx
import FocusTrap from '@/components/FocusTrap';
```

Apply to all three modals (Store, User Menu, End-Shift Confirm).

- [ ] **Step 3: Apply the same wrap to per-screen modals**

In each screen that renders a `.modal-scrim show`, wrap with `<FocusTrap>`. List to update:
- `OrdersBoardScreen.tsx` (Order Detail, Tagging, Manage menu, Payment picker)
- `NewOrderScreen.tsx` (Customer picker, Promo picker, Cancel confirm, Payment picker)
- `PaymentsScreen.tsx` (Take Payment picker)
- `DeliveryScreen.tsx` (Driver picker)
- `InspectionScreen.tsx` (per-item QA modal)
- `WhatsappScreen.tsx` (Settings panel, New Chat)
- `CustomersScreen.tsx` (Customer drawer / form)
- `ReportsScreen.tsx` (Cash Up modal)
- Settings screens that open inline edit modals (Stores, Promos, Shifts, etc.)

For each, one commit per file.

- [ ] **Step 4: Verify**

For each modal, open it, hit Tab — focus cycles within the modal and never escapes. Hit Shift+Tab from the first focusable — wraps to last. Hit Escape — modal closes. Click outside (the scrim) — modal closes. Close the modal — focus returns to the element that opened it.

- [ ] **Step 5: Commit & push**

```bash
git add src/components/FocusTrap.tsx <each-screen>
git commit -m "a11y(<area>): trap focus inside modal-scrim, restore on close"
git push
```

(Many commits — one per screen.)

---

# Phase 5 — Arabic translation

### Task 5.1: Produce translator brief

**Files:** `docs/i18n/2026-06-translator-brief.md` (new)

- [ ] **Step 1: Create `docs/i18n/2026-06-translator-brief.md`**

Write a brief that includes:
- Tone: Modern Standard Arabic, customer-service register, friendly but professional. Match the existing English voice ("The Art of Clean") — not formal-archaic.
- Domain glossary: laundry/dry-cleaning terms (e.g. "Pickup & Delivery" → "الاستلام والتوصيل"; "Express" → "خدمة سريعة"; "Walk-in" → "حضور مباشر").
- Formatting rules:
  - Preserve every `{placeholder}` exactly. Both the English source and Arabic target must have identical braces and identifier names.
  - Preserve every `· ` middle-dot separator.
  - Preserve currency token ("AED") as-is — that's the ISO code and stays Latin in the UI.
  - Preserve PII placeholders like `+971 50 …` examples — these are illustrative numbers, not text.
- Deliverable: a single `ar.json` file matching the key tree of `messages/en.json` exactly.

- [ ] **Step 2: Attach the current `messages/en.json` as the source**

Embed or reference the file. State that the translator should NOT translate the JSON keys, only the values.

- [ ] **Step 3: Acceptance test for the returned file**

State that the returned file will be validated by:
- key-by-key equivalence with `en.json` (no extra/missing keys)
- regex check that no leaf string contains 3+ consecutive ASCII letters (proxy for "still English")
- placeholder parity check (every `{name}` in en.json present in ar.json for the same key)

- [ ] **Step 4: Commit & push**

```bash
git add docs/i18n/2026-06-translator-brief.md
git commit -m "docs(i18n): translator brief for ar.json (2026-06 batch)"
git push
```

### Task 5.2: Hand off to translator (out-of-band)

**Files:** none

- [ ] **Step 1: Send the brief + `messages/en.json` to the translator**

Use the team's standard channel (email or Drive). Set expectation: ~1185 lines, estimated 1–2 working days.

- [ ] **Step 2: Track the open task externally**

Add a row to the team's translation tracker. Note the SHA of `messages/en.json` at hand-off so any subsequent edits to en (Phase 6) can be diffed.

(No commit — this is a hand-off.)

### Task 5.3: Receive translated ar.json — validate parity

**Files:** `messages/ar.json` (overwrite), `scripts/check-i18n-parity.ts` (new)

- [ ] **Step 1: Save received file as `messages/ar.json.incoming` for now**

Don't overwrite the current ar.json yet — validate first.

- [ ] **Step 2: Create the validation script**

Create `scripts/check-i18n-parity.ts`:

```ts
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';

type Tree = Record<string, unknown>;

function loadJson(p: string): Tree {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function flatten(obj: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Tree, key));
    } else if (typeof v === 'string') {
      out[key] = v;
    } else {
      throw new Error(`unsupported leaf at ${key}: ${typeof v}`);
    }
  }
  return out;
}

function placeholders(s: string): string[] {
  const re = /\{(\w+)\}/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.push(m[1]);
  return out.sort();
}

function main() {
  const enPath = path.resolve('messages/en.json');
  const arPath = path.resolve(process.argv[2] ?? 'messages/ar.json');
  const en = flatten(loadJson(enPath));
  const ar = flatten(loadJson(arPath));

  const enKeys = new Set(Object.keys(en));
  const arKeys = new Set(Object.keys(ar));

  const missing = [...enKeys].filter((k) => !arKeys.has(k));
  const extra = [...arKeys].filter((k) => !enKeys.has(k));
  if (missing.length) {
    console.error(`MISSING in ar.json (${missing.length}):`);
    missing.forEach((k) => console.error('  ' + k));
  }
  if (extra.length) {
    console.error(`EXTRA in ar.json (${extra.length}):`);
    extra.forEach((k) => console.error('  ' + k));
  }

  // Placeholder parity
  const phMismatch: string[] = [];
  for (const k of enKeys) {
    if (!arKeys.has(k)) continue;
    const e = placeholders(en[k]);
    const a = placeholders(ar[k]);
    if (e.join(',') !== a.join(',')) {
      phMismatch.push(`${k}: en=${JSON.stringify(e)} ar=${JSON.stringify(a)}`);
    }
  }
  if (phMismatch.length) {
    console.error(`PLACEHOLDER MISMATCH (${phMismatch.length}):`);
    phMismatch.forEach((m) => console.error('  ' + m));
  }

  // "Still English" heuristic: any leaf value that contains 4+ contiguous
  // ASCII letters AND doesn't contain any Arabic codepoint (U+0600-U+06FF).
  const stillEnglish: string[] = [];
  const englishRe = /[A-Za-z]{4,}/;
  const arabicRe = /[؀-ۿ]/;
  // Allowlist: known Latin-as-source tokens (currency codes, brand names,
  // phone-number examples, monospace-font names).
  const allow = new Set([
    'AED', 'WhatsApp', 'POS', 'WhatsApp Business',
    'Thawb Wa Teeb', 'Cormorant Garamond', 'Inter', 'JetBrains Mono',
  ]);
  for (const [k, v] of Object.entries(ar)) {
    if (!englishRe.test(v) || arabicRe.test(v)) continue;
    if (allow.has(v.trim())) continue;
    stillEnglish.push(`${k}: ${JSON.stringify(v)}`);
  }
  if (stillEnglish.length) {
    console.error(`POSSIBLY UNTRANSLATED (${stillEnglish.length}):`);
    stillEnglish.forEach((m) => console.error('  ' + m));
  }

  const total = missing.length + extra.length + phMismatch.length + stillEnglish.length;
  if (total === 0) {
    console.log('OK — ar.json passes parity, placeholder, and translation checks');
    process.exit(0);
  }
  process.exit(1);
}

main();
```

- [ ] **Step 3: Run the validator against the incoming file**

```bash
pnpm tsx scripts/check-i18n-parity.ts messages/ar.json.incoming
```

(Install `tsx` if not present: `pnpm add -D tsx`.)

Expected: `OK — ar.json passes parity, placeholder, and translation checks`.

- [ ] **Step 4: If failures, return to translator**

Fix loop: collect failures, send back, repeat 5.3 step 3 until clean.

- [ ] **Step 5: Promote the file**

```bash
mv messages/ar.json.incoming messages/ar.json
```

- [ ] **Step 6: Commit & push**

```bash
git add messages/ar.json scripts/check-i18n-parity.ts package.json pnpm-lock.yaml
git commit -m "i18n(ar): full Arabic translation (2026-06 batch) + parity validator"
git push
```

### Task 5.4: Add the validator to CI (or pre-build)

**Files:** `package.json`

- [ ] **Step 1: Add an npm script**

In `package.json` add:
```json
"scripts": {
  …,
  "i18n:check": "tsx scripts/check-i18n-parity.ts"
}
```

- [ ] **Step 2: Add `i18n:check` to the build pipeline**

Either prepend to `build` (`"build": "pnpm i18n:check && next build"`) or rely on the CI workflow that runs `pnpm build`. Choose whichever is consistent with the team's pattern.

- [ ] **Step 3: Verify**

```bash
pnpm i18n:check
```
Expected: passes silently.

- [ ] **Step 4: Commit & push**

```bash
git add package.json
git commit -m "ci: run i18n parity check before build"
git push
```

### Task 5.5: Arabic locale browser QA

**Files:** none

- [ ] **Step 1: Smoke `/ar/login`**

Open `http://localhost:3000/ar/login`. Confirm RTL layout, Arabic copy in brand, welcome, subtitle, labels, button text, footer hint. Take a screenshot for the audit follow-up.

- [ ] **Step 2: Smoke `/ar/order`**

Sign in. Confirm Arabic in: rail nav labels, topbar crumb, tier tabs, category bar, item-card names (these come from DB — note that catalogue may still be English; this is a content task, not a copy task), cart empty state, totals labels, charge button.

- [ ] **Step 3: Smoke `/ar/orders`, `/ar/payments`, `/ar/customers`, `/ar/whatsapp`, `/ar/reports`, `/ar/finance`, `/ar/settings/catalogue`**

For each, the chrome (page titles, column headers, button labels, modal titles, toast strings) should be Arabic. Data values stay in their stored language.

- [ ] **Step 4: Note remaining English content for follow-up**

Likely items: catalogue items, status enums in DB, store names, customer names, driver names. These are content-store concerns, not i18n. File a separate ticket: "Bilingual content rollout (catalogue, statuses)".

(No commit — verification.)

---

# Phase 6 — Version from package.json

### Task 6.1: Read version from package.json at build time

**Files:** `next.config.mjs`, `messages/en.json`, `messages/ar.json`, `src/app/[locale]/login/LoginForm.tsx`

- [ ] **Step 1: Surface the version in `next.config.mjs`**

```js
import createNextIntlPlugin from 'next-intl/plugin';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_VERSION: `v${pkg.version}`,
  },
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 2: Edit `messages/en.json` `Login.version`**

From:
```json
"version": "v2.4"
```
To:
```json
"version": "{v}"
```

(Mirror change in ar.json.)

- [ ] **Step 3: Pass the value in `LoginForm.tsx`**

Find:
```tsx
<span>{t('version')}</span>
```
Replace with:
```tsx
<span>{t('version', { v: process.env.NEXT_PUBLIC_VERSION ?? '' })}</span>
```

- [ ] **Step 4: Bump `package.json` to v2.5**

(Or whatever the team's release manager chooses — this task only requires that the displayed value matches package.json.)

- [ ] **Step 5: Build + verify**

```bash
pnpm build
pnpm dev
```
Open `/en/login` — footer reads `v2.5` (or whatever package.json declares).

- [ ] **Step 6: Commit & push**

```bash
git add next.config.mjs messages/en.json messages/ar.json src/app/[locale]/login/LoginForm.tsx package.json
git commit -m "build: surface package.json version as NEXT_PUBLIC_VERSION + login footer"
git push
```

---

# Phase 7 — Final verification + close

### Task 7.1: Type-check pass

- [ ] Run: `pnpm tsc --noEmit`
- [ ] Expected: 0 errors.

### Task 7.2: Production build pass

- [ ] Run: `pnpm build`
- [ ] Expected: 0 errors; route table contains every `/en/*` and `/ar/*` route from baseline (Task 0.1 Step 3).

### Task 7.3: Manual smoke checklist (run against a live `pos-api`)

Test plan, top-to-bottom. Open the browser dev-tools Console + Network tabs while testing — any 4xx/5xx not explicitly expected is a failure.

- [ ] **Login (`/en/login`)**: page renders with no branch suffix; submit empty form → role="alert" announces missing email; submit valid creds → lands on `/en/order`.
- [ ] **Login (`/ar/login`)**: page renders RTL; all copy is Arabic; same submit behavior.
- [ ] **Rail navigation**: Tab through rail; each item shows a focus-visible ring; click each item → route updates; active item highlights; SVGs render at 21×21 (verify Elements panel).
- [ ] **Topbar**: store chip click opens picker modal; Tab cycles inside; Escape closes; focus returns to store chip button.
- [ ] **New Order — empty state**: customer-attach renders with dashed orange border (Task 1.4); cart-empty shows "Empty order" copy; print button toasts "Print is available after the order is created".
- [ ] **New Order — happy path**: pick a tier, add 3 items, attach customer, toggle express, apply promo, click Charge → pay modal → CASH → order created, payment recorded, navigate to `/en/orders`.
- [ ] **New Order — edit existing**: navigate `/en/order?edit=<orderId>`, click Print button → real receipt job enqueued (verify pos-api log).
- [ ] **Orders Board**: drag a card across columns; reload; status persisted; ⋯ menu Refund → modal traps focus; Escape closes.
- [ ] **Tagging Modal**: scan input accepts a tag code; progress increments; "Done" advances order to CLEANING.
- [ ] **Payments**: Take Payment → modal traps focus; pick method → order marked paid.
- [ ] **Customers**: New Customer form; add → row appears in table; click row → drawer opens; loyalty balance loads.
- [ ] **Delivery**: assign driver → driver chip updates; Mark Delivered → order moves to "Delivered today".
- [ ] **Inspection**: open a QA modal; mark items pass/fail; submit → order advances to READY.
- [ ] **WhatsApp**: select conversation; type a message → send; click paperclip → choose an image → image bubble appears (real upload — verify pos-api log); ⋯ menu → Clear messages → confirm → thread empties.
- [ ] **Finance**: each tab loads (Dashboard, Actuals, Unit, Vision, Owners). Owners → add contribution.
- [ ] **Reports**: range selector; Export CSV downloads a real file (open in Excel — Arabic store name renders correctly because of the UTF-8 BOM); Print Z-Report → real job enqueued; Cash Up → enter counted amount → toast shows the entered amount, not AED 0.00.
- [ ] **Settings**: every sub-screen mounts; placeholders are localized; switches toggle via Space (a11y).
- [ ] **End-shift modal**: button styled with `.btn-pri` fill; Cancel button localized; focus trapped.
- [ ] **Brand live preview (Settings → Branding)**: `.blp-badge` italic Cormorant renders real italic (visual sanity vs prior screenshot).

### Task 7.4: Open the PR

- [ ] **Step 1: Push final state**

```bash
git push
```

- [ ] **Step 2: Open the PR via gh**

```bash
gh pr create \
  --title "Pixel-perfect audit fixes (2026-06)" \
  --body "$(cat <<'EOF'
## Summary

- Resolves every defect from the 2026-06-03 pixel-perfect audit: tenant-safe copy, Arabic translation, real Print Receipt / Print Z / Export CSV / WhatsApp upload + clear chat, cash-up toast amount fix, italic font axis, end-shift modal correctness, CSS selector cleanup, a11y polish (focus-visible, focus trap, role=alert, switch semantics).
- Removes vestigial Tailwind / PostCSS.
- Wires `NEXT_PUBLIC_VERSION` from `package.json`.

## Test plan

- [x] `pnpm tsc --noEmit`
- [x] `pnpm build` succeeds, all routes generated for `en` + `ar`
- [x] `pnpm i18n:check` passes
- [x] Manual smoke against pos-api (checklist in `docs/superpowers/plans/2026-06-03-pos-web-pixel-perfect-fixes.md` Task 7.3)
- [ ] Reviewer: run the smoke checklist locally against a clean DB

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI**

Use the team's PR-checks pattern (likely `gh pr checks --watch`). Address any failures before requesting review.

---

## Self-review (run before handoff)

**1. Spec coverage:** Each row in the "Spec Context" table maps to a numbered task above. Confirmed — no audit ID without an owning task.

**2. Placeholder scan:** Searched the plan for TODO / TBD / "implement later" / "similar to" / vague "appropriate" — none found. All steps contain the actual content or the exact command.

**3. Type consistency:**
- `PrintJob` / `enqueuePrintJob` defined in 3.4 and reused in 3.5 — names match.
- `CsvValue` / `toCsv` / `downloadCsv` defined in 3.6 and only used locally — consistent.
- `FocusTrap` component defined in 4.4 and imported the same way everywhere — consistent.
- i18n key names introduced in 2.4 / 2.5 (e.g. `Settings.Stores.hoursPlaceholder`) match the namespaces used by the component hooks specified in the same task.

**4. Backend assumption surface:** Phase 3 tasks all depend on pos-api endpoints (`POST /print-jobs`, `POST /files/upload`, `DELETE /whatsapp/conversations/:id/messages`, `POST /shifts/current/close` returning closed amount). The pre-flight notes call this out; each task includes a "if 404, do not silently re-stub" instruction.

**5. Mobile / responsive:** Explicitly out of scope in the Goal statement. Audit's P6 not covered by any task — intentional.

**6. Test framework:** Not added in this plan. Verification leans on type-check + build + manual smoke. If the team wants automated regression coverage, that is a follow-up plan ("Add Vitest + Playwright to pos-web") — call it out in the PR description.

---

**End of plan.**
