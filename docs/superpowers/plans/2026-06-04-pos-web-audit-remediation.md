# POS Web — Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `pos-web/` from "Requires Significant Work" to "Production Ready" by closing every finding in the 2026-06-04 design/behavior audit (P0 blockers, P1 honesty/data-loss, P2 polish).

**Architecture:** `pos-web` is a Next.js 14 App Router POS (next-intl i18n, hand-rolled `useState` forms, `api`/`apiServer` HTTP clients, inline `.modal-scrim` modals with a `FocusTrap`, a global `ToastHost`). Fixes are surgical edits to existing files plus three shared-primitive upgrades (Toast a11y, a reusable `Modal` dialog wrapper, i18n CI). No architectural rewrite. Design source of truth is the prototype at `../thawb-wa-teeb-laundry/project/POS/` (`app.js`, `pos.css`, `*.js`).

**Tech Stack:** Next.js 14.2, React 18, TypeScript 5, next-intl 4, pnpm.

**Decisions locked in (from user):** Full scope P0+P1+P2 · Match the design for both product calls (walk-in checkout allowed; restore interactive rack assignment) · Translate all 933 Arabic keys in-house.

**No test runner exists** in this repo (package.json has `dev/build/start/lint/i18n:check`, no test framework). Verification gates used throughout are: `npx tsc --noEmit` (must stay exit 0), `pnpm lint`, `pnpm i18n:check`, `pnpm build`, and targeted `grep` assertions. Where behavior must be eyeballed, a manual check step is included.

**Per project memory the user wants every verified change committed AND pushed.** Each task ends with a commit; push after each (`git push`) unless batching is requested.

---

## File Structure (what gets created / modified)

**Created**
- `src/components/Modal.tsx` — reusable accessible dialog wrapper (scrim + FocusTrap + `role="dialog"` + labelled title + `×`). Replaces the copy-pasted `.modal-scrim > FocusTrap > .modal` blocks.
- `src/components/ConfirmDialog.tsx` — in-app confirm (replaces native `confirm()`), promise-based.
- `scripts/find-untranslated.ts` — lists `ar.json` leaves still equal to `en.json` (drives the Arabic task + a stricter CI check).

**Modified (high-traffic)**
- `messages/ar.json` — translate 933 keys.
- `messages/en.json` + `messages/ar.json` — new keys for strings currently hardcoded in components.
- `src/components/Toast.tsx` — `aria-live`; success/error variants.
- `src/app/[locale]/layout.tsx` — remove dead portal roots; `generateMetadata` + `noindex`.
- `src/components/GenericCRUDList.tsx`, `src/components/StoreSyncControls.tsx` — route literals through i18n; use `ConfirmDialog`.
- `package.json` — remove unused deps; tighten `i18n:check`.

**Modified (per-screen, surgical)**
- `settings/catalogue/CatalogueEditor.tsx` (3 stubs), `settings/hardware/HardwareForm.tsx` (Configure stub), `settings/finance/FinanceSettingsPanel.tsx` (persist), `settings/hours/HoursForm.tsx` (cutoff), `settings/users/UsersAndRoles.tsx` (remove no-op), `order/NewOrderScreen.tsx` (walk-in, order#, promo clamp, cancel-modal), `orders/OrdersBoardScreen.tsx` (rack assign, tagging chip), `payments/PaymentsScreen.tsx` + `reports/ReportsScreen.tsx` (kill fake trends), `whatsapp/WhatsappScreen.tsx` (delete dead panel; menu label), `requests/RequestsScreen.tsx` (error toasts; copy), `settings/SettingsNav.tsx` (icons, orphan routes), `components/AppShell.tsx` (copy, a11y), `lib/types.ts` (Bootstrap.nextOrderNumber).

**Deleted**
- `src/app/[locale]/(pos)/whatsapp/WhatsappSettingsPanel.tsx` — dead, unreachable.

---

# PHASE 0 — Release Blockers (C1, H1, H2, H3, M13)

## Task 1: i18n tooling — list untranslated keys + tighten the CI gate

**Files:**
- Create: `scripts/find-untranslated.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write the helper that prints every `ar.json` leaf still identical to `en.json`**

Create `scripts/find-untranslated.ts`:

```ts
/* Lists ar.json leaves whose value is still byte-identical to en.json (i.e. untranslated),
   plus any leaf that contains no Arabic script. Exits 1 if any are found. */
import en from '../messages/en.json';
import ar from '../messages/ar.json';

type J = Record<string, unknown>;
const AR = /[؀-ۿݐ-ݿ]/;
const out: string[] = [];

function walk(e: J, a: J, path: string) {
  for (const k of Object.keys(e)) {
    const ev = e[k];
    const av = (a ?? {})[k];
    const p = path ? `${path}.${k}` : k;
    if (ev && typeof ev === 'object') {
      walk(ev as J, (av as J) ?? {}, p);
    } else if (typeof ev === 'string') {
      const same = av === ev;
      const noArabic = typeof av === 'string' && !AR.test(av) && /[A-Za-z]/.test(av);
      // A pure-symbol/number value (e.g. "{v}", "▲") legitimately has no Arabic — skip those.
      if (same || noArabic) out.push(`${p}  =  ${JSON.stringify(av)}`);
    }
  }
}

walk(en as J, ar as J, '');
if (out.length) {
  console.error(`UNTRANSLATED (${out.length}):\n` + out.join('\n'));
  process.exit(1);
}
console.log('All ar.json leaves are translated.');
```

- [ ] **Step 2: Add scripts to `package.json`**

In the `"scripts"` block add:

```json
    "i18n:untranslated": "tsx scripts/find-untranslated.ts",
```

Keep the existing `"i18n:check"`.

- [ ] **Step 3: Run it to confirm it reports the backlog**

Run: `pnpm i18n:untranslated`
Expected: FAIL (exit 1), `UNTRANSLATED (≈933): ...` long list.

- [ ] **Step 4: Commit**

```bash
git add scripts/find-untranslated.ts package.json
git commit -m "chore(i18n): add untranslated-key detector script"
git push
```

---

## Task 2: Translate the Arabic locale (C1 — Critical)

**Files:**
- Modify: `messages/ar.json` (all 933 untranslated leaves)

**Approach:** `ar.json` already has perfect key + ICU-placeholder parity with `en.json` (994 leaves, 11 translated). Only the *values* need translating. Do NOT add/remove/rename keys. Preserve every `{placeholder}`, ICU `{count, plural, ...}` form, leading symbols (`▲`, `#`, `×`, `⛿`, `▦`), and `\n`. Translate to Modern Standard Arabic with UAE laundry-domain terms (e.g. كي = press/iron, غسيل = wash, تنظيف جاف = dry clean, طلب = order, عميل = customer).

- [ ] **Step 1: Generate the working list of keys to translate**

Run: `pnpm i18n:untranslated > /tmp/ar-todo.txt; wc -l /tmp/ar-todo.txt`
Expected: ~933 lines. This is the checklist.

- [ ] **Step 2: Translate values, section by section, editing `messages/ar.json` in place**

Translate the top-level namespaces in this order (commit after each to keep diffs reviewable): `Common`, `Nav`, `Login`, `Order`, `OrderStatus`, `Crumbs`, `Customers`, `Payments`, `Reports`, `Finance`, `Requests`, `WhatsApp`, `Settings` (+ all sub-objects), `Hardware`, `Errors`. Representative examples (showing the exact value transformation — keep keys/placeholders intact):

```jsonc
// Common
"save": "حفظ",
"cancel": "إلغاء",
"delete": "حذف",
"edit": "تعديل",
"loading": "جارٍ التحميل…",
"items": "عناصر",
// Login
"welcome": "مرحبًا بعودتك",
"subtitle": "سجّل الدخول إلى نقطة البيع",
"signIn": "تسجيل الدخول",
// Order (note preserved placeholders/symbols)
"empty": "السلة فارغة",
"customerRequired": "يرجى إرفاق عميل أولًا",
"grand": "الإجمالي",
// Reports — a number stays numeric; only words translate
"newCustomers": "عملاء جدد",
// ICU plural example — keep the ICU skeleton, translate the words
"bagsCount": "{count, plural, one {حقيبة واحدة} other {# حقائب}}"
```

> The three "fake trend" values (`Payments.collectedTrendPct`, `Reports.grossTrendPct`, `Reports.newCustomersTrendPct`) are being **removed** in Task 5/6 — do not spend effort translating them; they'll be deleted from both locale files.

- [ ] **Step 3: Verify Arabic coverage is complete**

Run:
```bash
pnpm i18n:untranslated
pnpm i18n:check
```
Expected: both exit 0 ("All ar.json leaves are translated." / no POSSIBLY UNTRANSLATED).

- [ ] **Step 4: Verify JSON + types still valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/ar.json','utf8'));console.log('ok')" && npx tsc --noEmit`
Expected: `ok`, tsc exit 0.

- [ ] **Step 5: Manual RTL spot-check**

Run `pnpm dev`, open `/ar/order`, `/ar/orders`, `/ar/settings/general`. Confirm: text is Arabic, layout is RTL, no clipped/overflowing labels, numbers/currency still render. Note any layout breaks as follow-up (do not fix copy here).

- [ ] **Step 6: Commit (one commit per namespace batch, or squashed)**

```bash
git add messages/ar.json
git commit -m "feat(i18n): translate Arabic locale (933 keys)"
git push
```

---

## Task 3: Add the i18n gate to CI

**Files:**
- Modify: CI workflow (e.g. `.github/workflows/ci.yml`) — **check if one exists first**

- [ ] **Step 1: Detect CI**

Run: `ls .github/workflows 2>/dev/null || echo "NO CI"`

- [ ] **Step 2a: If a workflow exists**, add a step after `pnpm install`:

```yaml
      - name: i18n parity & coverage
        run: |
          pnpm i18n:check
          pnpm i18n:untranslated
```

- [ ] **Step 2b: If "NO CI"**, create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm i18n:check
      - run: pnpm i18n:untranslated
      - run: npx tsc --noEmit
      - run: pnpm lint
      - run: pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: gate on i18n parity, types, lint, build"
git push
```

---

## Task 4: Toast accessibility — announce to screen readers (H2)

**Files:**
- Modify: `src/components/Toast.tsx`

- [ ] **Step 1: Add `aria-live` + role, and an error/success variant**

Replace the `ToastHost` body and `ToastCtx` in `src/components/Toast.tsx`:

```tsx
interface ToastCtx { show: (msg: string, kind?: 'success' | 'error') => void }
const Ctx = createContext<ToastCtx | null>(null);

export function ToastHost({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState<'success' | 'error'>('success');
  const [open, setOpen] = useState(false);
  const t = useRef<any>();
  const show = useCallback((m: string, k: 'success' | 'error' = 'success') => {
    setMsg(m);
    setKind(k);
    setOpen(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setOpen(false), 2200);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        className={`toast${open ? ' show' : ''}${kind === 'error' ? ' toast-error' : ''}`}
        role="status"
        aria-live={kind === 'error' ? 'assertive' : 'polite'}
      >
        <Icon.check size={18} />
        <span>{msg}</span>
      </div>
    </Ctx.Provider>
  );
}
```

And update the fallback so `kind` is accepted:

```tsx
export function useToast() {
  return useContext(Ctx) ?? { show: () => {} };
}
```

- [ ] **Step 2: Add the error style** to `src/app/pos.css` (next to the existing `.toast` rule):

```css
.toast-error{background:var(--danger);color:#fff}
.toast-error svg{display:none}
```

- [ ] **Step 3: Verify types + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: exit 0. (`show(msg)` calls remain valid since `kind` is optional.)

- [ ] **Step 4: Manual check**

`pnpm dev`, trigger any save toast; confirm with VoiceOver/Narrator it is announced. Visually confirm normal toasts unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/Toast.tsx src/app/pos.css
git commit -m "fix(a11y): announce toasts via role=status/aria-live"
git push
```

---

## Task 5: Reusable accessible Modal wrapper + dialog semantics on all modals (H3, M13)

**Files:**
- Create: `src/components/Modal.tsx`
- Modify: every file containing `modal-scrim` (see Step 4 list)

- [ ] **Step 1: Create the wrapper**

Create `src/components/Modal.tsx`:

```tsx
'use client';

import { ReactNode, useId } from 'react';
import FocusTrap from './FocusTrap';
import { useTranslations } from 'next-intl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Extra class on the inner `.modal` (e.g. width modifiers). */
  className?: string;
}

/** Accessible dialog: scrim + FocusTrap + role="dialog" + labelled title + named close. */
export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  const t = useTranslations('Common');
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <FocusTrap active onEscape={onClose}>
        <div
          className={`modal${className ? ' ' + className : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-head">
            <h3 id={titleId}>{title}</h3>
            <button className="x" aria-label={t('close')} onClick={onClose}>×</button>
          </div>
          {children}
        </div>
      </FocusTrap>
    </div>
  );
}
```

- [ ] **Step 2: Add the `close` key** to `messages/en.json` `Common` (`"close": "Close"`) and `messages/ar.json` `Common` (`"close": "إغلاق"`).

- [ ] **Step 3: Migrate one modal as the reference (AppShell user menu)**

In `src/components/AppShell.tsx`, replace the `userMenuOpen &&` block (the `modal-scrim`→`FocusTrap`→`modal` wrapper shown in audit at ~430-470) so the outer scaffolding comes from `<Modal>`:

```tsx
{userMenuOpen && (
  <Modal open onClose={() => setUserMenuOpen(false)} title={t('userMenu')}>
    <div className="modal-body">
      {/* ...existing modal-body contents unchanged... */}
    </div>
  </Modal>
)}
```

Add `import Modal from '@/components/Modal';` at the top. Remove the now-redundant inner `modal-head`/`x` for this modal (Modal renders them).

- [ ] **Step 4: Migrate the remaining modals** the same way. Find every site:

Run: `grep -rln "modal-scrim" src`
Expected sites include: `components/AppShell.tsx`, `components/GenericCRUDList.tsx`, `order/NewOrderScreen.tsx`, `orders/OrdersBoardScreen.tsx`, `customers/CustomersScreen.tsx`, `whatsapp/WhatsappScreen.tsx`, `settings/zones/ZonesScreen.tsx`, `settings/shifts/ShiftsScreen.tsx`, `settings/pickup/PickupSettings.tsx`, `settings/subscriptions/SubscriptionsScreen.tsx`, `settings/users/UsersAndRoles.tsx`, `settings/gift-cards/GiftCardsScreen.tsx`, `settings/promos/PromosScreen.tsx`, `settings/mobile-ordering/BagTypeModal.tsx`, `settings/stores/StoresSettings.tsx`, `settings/catalogue/CatalogueEditor.tsx`.

For each: replace the `<div className="modal-scrim ...">` + `<FocusTrap>` + `<div className="modal">` + `modal-head` + `x` scaffolding with `<Modal open onClose={...} title={...} className={...}>` wrapping the existing `modal-body`/footers. Preserve any width-modifier class via `className`. Modals that are confirm-style (Yes/No) can stay or move to `ConfirmDialog` in Task 16 — leave them as `Modal` for now.

- [ ] **Step 5: Verify no bare modals remain and types pass**

Run:
```bash
grep -rn "modal-scrim" src | grep -v "Modal.tsx" || echo "all migrated"
grep -rn 'role="dialog"' src/components/Modal.tsx
npx tsc --noEmit && pnpm lint
```
Expected: "all migrated" (or only Modal.tsx hits), tsc/lint exit 0.

- [ ] **Step 6: Manual check** — open 3–4 different modals; confirm focus trap, Escape close, screen-reader announces "dialog", `×` reads "Close".

- [ ] **Step 7: Commit**

```bash
git add src/components/Modal.tsx messages/en.json messages/ar.json src
git commit -m "fix(a11y): role=dialog + labelled title/close via shared Modal"
git push
```

---

## Task 6: Remove the three fabricated "trend" statistics (H1)

**Files:**
- Modify: `src/app/[locale]/(pos)/payments/PaymentsScreen.tsx`
- Modify: `src/app/[locale]/(pos)/reports/ReportsScreen.tsx`
- Modify: `messages/en.json`, `messages/ar.json`

**Decision:** No real day-over-day comparison data is fetched, so **remove** the badges (do not invent numbers). If product later wants real trends, that's a backend + new task.

- [ ] **Step 1: Payments — remove the static trend badge**

In `PaymentsScreen.tsx` around line 99, delete the element rendering `t('collectedTrendPct')` + its "vs yesterday" sibling. Confirm current markup first:

Run: `grep -n "collectedTrendPct\|vs yesterday\|trend" src/app/\[locale\]/\(pos\)/payments/PaymentsScreen.tsx`

Remove the `<b className="up">…</b>` / trend `<span>` for the Collected KPI. Keep the KPI value itself.

- [ ] **Step 2: Reports — remove both static trend badges**

In `ReportsScreen.tsx`, lines ~280 (Gross Sales `grossTrendPct` + `grossTrendSub`) and ~320 (New Customers `newCustomersTrendPct`). Delete the trend `<b>`/`<span>` elements; keep the real KPI numbers (`overview.newCustomers`, gross value).

- [ ] **Step 3: Delete the now-unused keys** from both locale files: `Payments.collectedTrendPct`, `Reports.grossTrendPct`, `Reports.grossTrendSub`, `Reports.newCustomersTrendPct`.

- [ ] **Step 4: Verify no dangling references**

Run:
```bash
grep -rn "collectedTrendPct\|grossTrendPct\|grossTrendSub\|newCustomersTrendPct" src messages || echo "clean"
npx tsc --noEmit && pnpm i18n:check
```
Expected: "clean"; tsc/i18n exit 0.

- [ ] **Step 5: Commit**

```bash
git add src messages
git commit -m "fix(reports,payments): remove fabricated trend statistics"
git push
```

---

# PHASE 1 — Honesty & Data-Loss (H4, H5, M1–M9)

## Task 7: Remove unused production dependencies (H4)

**Files:**
- Modify: `package.json`, `src/app/[locale]/layout.tsx`
- Delete: `src/components/QueryProvider.tsx`

- [ ] **Step 1: Confirm zero usage (guard against regressions since audit)**

Run:
```bash
grep -rE "useQuery|useMutation|QueryClient" src | grep -v QueryProvider.tsx || echo "react-query unused"
grep -rl "react-hook-form\|@hookform" src || echo "rhf unused"
grep -rl "from 'zod'\|from \"zod\"" src || echo "zod unused"
```
Expected: all three "unused".

- [ ] **Step 2: Remove `QueryProvider` from layout**

In `src/app/[locale]/layout.tsx`: delete the `import { QueryProvider }` line and unwrap it:

```tsx
        <NextIntlClientProvider>
          {children}
        </NextIntlClientProvider>
```

- [ ] **Step 3: Delete the provider file**

```bash
git rm src/components/QueryProvider.tsx
```

- [ ] **Step 4: Drop deps from `package.json`** — remove `@tanstack/react-query`, `@tanstack/react-query-devtools`, `react-hook-form`, `@hookform/resolvers`, `zod`. Then:

Run: `pnpm install`
Expected: lockfile updates, install succeeds.

- [ ] **Step 5: Verify build still clean**

Run: `npx tsc --noEmit && pnpm build`
Expected: exit 0 both.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src
git commit -m "chore: drop unused deps (react-query, react-hook-form, zod)"
git push
```

---

## Task 8: Delete the dead WhatsApp settings panel (H5)

**Files:**
- Delete: `src/app/[locale]/(pos)/whatsapp/WhatsappSettingsPanel.tsx`
- Modify: `src/app/[locale]/(pos)/whatsapp/WhatsappScreen.tsx`

- [ ] **Step 1: Confirm it is unreachable**

Run: `grep -n "setSettingsOpen(true)" src/app/\[locale\]/\(pos\)/whatsapp/WhatsappScreen.tsx || echo "never opened"`
Expected: "never opened".

- [ ] **Step 2: Remove the plumbing in `WhatsappScreen.tsx`** — delete: the `import ... WhatsappSettingsPanel`, the `settingsOpen` state + its `setSettingsOpen(false)` usage, the `onSettingsSaved` handler, and the `{settingsOpen && <WhatsappSettingsPanel .../>}` block (~634-640).

- [ ] **Step 3: Delete the file**

```bash
git rm src/app/[locale]/(pos)/whatsapp/WhatsappSettingsPanel.tsx
```

- [ ] **Step 4: Verify no references remain**

Run: `grep -rn "WhatsappSettingsPanel\|settingsOpen" src/app/\[locale\]/\(pos\)/whatsapp || echo "clean"; npx tsc --noEmit`
Expected: "clean"; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "chore(whatsapp): remove dead unreachable settings panel"
git push
```

---

## Task 9: Remove dead portal roots + add metadata/noindex (M12, L9)

**Files:**
- Modify: `src/app/[locale]/layout.tsx`

- [ ] **Step 1: Confirm no `createPortal` targets them**

Run: `grep -rn "createPortal\|getElementById('modal-root')\|getElementById('toast-root')" src || echo "no portals"`
Expected: "no portals".

- [ ] **Step 2: Remove the two dead divs** (`<div id="modal-root" />`, `<div id="toast-root" />`) from layout.

- [ ] **Step 3: Replace static `metadata` with localized `generateMetadata` + noindex:**

```tsx
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Meta' });
  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
  };
}
```

Delete the old `export const metadata = {...}`.

- [ ] **Step 4: Add the `Meta` namespace** to both locale files. `en.json`: `"Meta": { "title": "Thawb Wa Teeb — POS", "description": "Point-of-sale terminal for Thawb Wa Teeb Laundry." }`. `ar.json`: `"Meta": { "title": "ثوب وطيب — نقطة البيع", "description": "نقطة بيع لمغسلة ثوب وطيب." }`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && pnpm i18n:check && pnpm build`
Expected: exit 0. In built output, `/ar` page `<title>` is Arabic and `<meta name="robots" content="noindex">` present.

- [ ] **Step 6: Commit**

```bash
git add src messages
git commit -m "fix: remove dead portal roots; localized noindex metadata"
git push
```

---

## Task 10: Catalogue — implement Edit product, Import CSV, Download Template (M4, plus H-stub Edit)

**Files:**
- Modify: `src/app/[locale]/(pos)/settings/catalogue/CatalogueEditor.tsx`
- Modify: `src/lib/csv.ts` (reuse existing `toCsv`/`downloadCsv`)

**Design ref:** `app.js:1777-1781` (`downloadCSV('products-template.csv', productsCSV())`, `importProductsCSV`, `openProductModal`).

- [ ] **Step 1: Download Template — generate a real CSV**

Replace the stub button handler (currently `onClick={() => toast.show('Template downloaded')}`):

```tsx
function downloadTemplate() {
  const header = ['sku', 'name', 'category', 'dryClean', 'wash', 'press', 'cost', 'turnaround'];
  const sample = ['TSHIRT01', 'T-Shirt', cats[0]?.title ?? 'General', '12', '8', '5', '3', '24h'];
  downloadCsv('products-template.csv', toCsv([header, sample]));
}
```

Wire: `onClick={downloadTemplate}`. Import `toCsv, downloadCsv` from `@/lib/csv`.

- [ ] **Step 2: Import CSV — parse + bulk upsert via API**

Replace the hidden input `onChange` (currently `toast.show('CSV import coming soon')`):

```tsx
async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const [head, ...body] = lines.map((l) => l.split(','));
  const idx = (k: string) => head.indexOf(k);
  try {
    await api('/catalogue/items/bulk', {
      method: 'POST',
      body: body.map((c) => ({
        sku: c[idx('sku')], name: c[idx('name')], category: c[idx('category')],
        prices: { DRY_CLEAN: +c[idx('dryClean')], WASH: +c[idx('wash')], PRESS: +c[idx('press')] },
        cost: +c[idx('cost')], turnover: c[idx('turnaround')],
      })),
    });
    reload();
    toast.show(t('imported', { n: body.length }));
  } catch (err: any) {
    toast.show(err?.detail?.message ?? t('importFailed'), 'error');
  } finally {
    e.target.value = '';
  }
}
```

Wire: `onChange={importCsv}`. **Verify the endpoint** `/catalogue/items/bulk` exists in `pos-api`; if not, create it (one-line task: accept an array and upsert by sku) — see Step 5.

- [ ] **Step 3: Edit product — real modal hitting `PATCH /catalogue/items/:id`**

Replace the per-row Edit stub (`onClick={() => toast.show('Edit product (coming soon)')}`) with `onClick={() => setEditing(it)}`, and add an editing modal using the Task-5 `<Modal>`:

```tsx
{editing && (
  <Modal open onClose={() => setEditing(null)} title={t('editProduct')}>
    <form className="modal-body" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      await api(`/catalogue/items/${editing.id}`, { method: 'PATCH', body: {
        name: f.get('name'),
        cost: Number(f.get('cost')),
        turnover: String(f.get('turnover')),
        prices: {
          DRY_CLEAN: Number(f.get('dry')), WASH: Number(f.get('wash')), PRESS: Number(f.get('press')),
        },
      }});
      setEditing(null); reload(); toast.show(t('saved'));
    }}>
      <label>{t('name')}<input name="name" defaultValue={editing.name} /></label>
      <label>{t('dryClean')}<input name="dry" type="number" defaultValue={editing.prices?.DRY_CLEAN ?? ''} /></label>
      <label>{t('wash')}<input name="wash" type="number" defaultValue={editing.prices?.WASH ?? ''} /></label>
      <label>{t('press')}<input name="press" type="number" defaultValue={editing.prices?.PRESS ?? ''} /></label>
      <label>{t('cost')}<input name="cost" type="number" defaultValue={editing.cost ?? ''} /></label>
      <label>{t('turnaround')}<input name="turnover" defaultValue={editing.turnover ?? ''} /></label>
      <div className="modal-foot"><button className="btn btn-pri" type="submit">{t('save')}</button></div>
    </form>
  </Modal>
)}
```

Add `const [editing, setEditing] = useState<CatalogueItem | null>(null);` and the new i18n keys (`editProduct`, `imported`, `importFailed`, and reuse `dryClean/wash/press/cost/turnaround/name/save/saved`) in both locale files. Use the screen's real `externalKey` mapping if prices are keyed by `externalKey` rather than `DRY_CLEAN` — confirm against `tierByKey`/`it.prices` usage already in the file.

- [ ] **Step 4: Verify front-end**

Run: `npx tsc --noEmit && pnpm i18n:check && pnpm lint`
Expected: exit 0.

- [ ] **Step 5: Verify/أdd backend endpoints**

Run: `grep -rn "items/bulk\|@Patch('items/:id')\|items/:id" ../pos-api/src 2>/dev/null || echo "check pos-api"`
If `PATCH /catalogue/items/:id` or `/catalogue/items/bulk` are missing, add them in `pos-api` (controller + service upsert by sku/id). Keep this a sub-commit. If backend changes are out of scope for this pass, gate the Import button behind the endpoint's existence and leave Edit (single PATCH) which is the daily-use path.

- [ ] **Step 6: Manual check** — edit a product price; confirm it persists after reload. Import the downloaded template; confirm rows upsert.

- [ ] **Step 7: Commit**

```bash
git add src messages
git commit -m "feat(catalogue): real edit/import/template (remove coming-soon stubs)"
git push
```

---

## Task 11: Hardware — implement Configure (M5)

**Files:**
- Modify: `src/app/[locale]/(pos)/settings/hardware/HardwareForm.tsx`

**Design ref:** `app.js:1772` (`openHardwareConfig` — brand/receipt/printing).

- [ ] **Step 1: Replace the Configure stub** (`onClick={() => toast.show(`${d.name} configuration (coming soon)`)}`) with `onClick={() => setConfig(d.key)}` and add a `<Modal>` editing the device's brand + config, persisting via the same `PUT /hardware/:store` path the toggle already uses:

```tsx
{config && (
  <Modal open onClose={() => setConfig(null)} title={t('configureDevice', { name: DEVICES.find(x=>x.key===config)!.name })}>
    <form className="modal-body" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const next = { ...hw, [config]: { ...hw[config], brand: String(f.get('brand')), model: String(f.get('model')) } };
      try {
        await api(`/hardware/${storeId}`, { method: 'PUT', body: next });
        setHw(next); setConfig(null); toast.show(t('saved'));
      } catch (err: any) { toast.show(err?.detail?.message ?? t('saveFailed'), 'error'); }
    }}>
      <label>{t('brand')}<input name="brand" defaultValue={hw[config].brand ?? ''} /></label>
      <label>{t('model')}<input name="model" defaultValue={hw[config].model ?? ''} /></label>
      <div className="modal-foot"><button className="btn btn-pri" type="submit">{t('save')}</button></div>
    </form>
  </Modal>
)}
```

Add `const [config, setConfig] = useState<string | null>(null);`. Confirm the existing toggle's `PUT` URL + `storeId` variable name and reuse them verbatim. Add i18n keys `configureDevice`, `brand`, `model`, `saveFailed`.

- [ ] **Step 2: Route the remaining hardcoded English** (`Connected`/`Offline`/`Configure`/`Test`) through `t(...)` — add keys `connected`, `offline`, `configure`, `test` to `Hardware` namespace in both locales.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && pnpm i18n:check`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src messages
git commit -m "feat(hardware): real device configure modal; i18n labels"
git push
```

---

## Task 12: Finance settings — persist (M7)

**Files:**
- Modify: `src/app/[locale]/(pos)/settings/finance/FinanceSettingsPanel.tsx`
- Modify: `src/app/[locale]/(pos)/settings/finance/page.tsx`

**Note:** Backend persistence endpoint required. Confirm `GET/PUT /finance/settings` exists in `pos-api`.

- [ ] **Step 1: Backend check**

Run: `grep -rn "finance/settings\|finance/config" ../pos-api/src 2>/dev/null || echo "need endpoint"`
If missing, add `GET /finance/settings` + `PUT /finance/settings` to `pos-api` (store the JSON blob). Sub-commit.

- [ ] **Step 2: Load real settings in `page.tsx`** via `apiServer('/finance/settings')` and pass as a prop (mirror how other settings pages hydrate).

- [ ] **Step 3: Replace the toast-only save** (`onClick={() => toast.show('Finance settings saved')}`) with a real mutation:

```tsx
async function save() {
  setBusy(true);
  try {
    await api('/finance/settings', { method: 'PUT', body: settings });
    toast.show(t('saved'));
  } catch (e: any) {
    toast.show(e?.detail?.message ?? t('saveFailed'), 'error');
  } finally { setBusy(false); }
}
```

Initialize state from the prop (not the hardcoded defaults), keeping the defaults only as a fallback when the API returns null.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Manual check** — change Stripe %, save, reload; value persists.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(settings/finance): persist finance settings via API"
git push
```

---

## Task 13: Business Hours — persist express cutoff (M8)

**Files:**
- Modify: `src/app/[locale]/(pos)/settings/hours/HoursForm.tsx`

- [ ] **Step 1: Include `cutoff` in the save payload**

In `save()` (~line 81), change the `PUT /business-hours` body from `{ rows }` to include the cutoff:

```tsx
await api('/business-hours', { method: 'PUT', body: { rows, expressCutoff: cutoff } });
```

- [ ] **Step 2: Confirm backend accepts `expressCutoff`**

Run: `grep -rn "expressCutoff\|business-hours" ../pos-api/src 2>/dev/null || echo "check pos-api"`
Add the field to the DTO/entity if missing (sub-commit), and ensure `page.tsx` hydrates `cutoff` from the API on load.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "fix(settings/hours): persist same-day express cutoff"
git push
```

---

## Task 14: Users — remove the vestigial "Save permissions" no-op (M9)

**Files:**
- Modify: `src/app/[locale]/(pos)/settings/users/UsersAndRoles.tsx`

- [ ] **Step 1: Confirm per-toggle auto-save exists** (`PATCH /roles/:id/permissions` in `togglePerm`).

Run: `grep -n "roles/.*permissions\|togglePerm" src/app/\[locale\]/\(pos\)/settings/users/UsersAndRoles.tsx`
Expected: real PATCH present.

- [ ] **Step 2: Delete the no-op button** at ~line 237 (`onClick={() => toast.show('Permissions saved')}`) and any "unsaved changes" affordance tied to it. Add a small helper caption instead: `<span className="muted">{t('permsAutoSave')}</span>` (key: en "Changes save automatically", ar "تُحفظ التغييرات تلقائيًا").

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && pnpm i18n:check`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src messages
git commit -m "fix(settings/users): remove no-op save; permissions auto-save"
git push
```

---

## Task 15: New Order — walk-in checkout, order number, promo clamp, cancel modal (M1, M2, L1, L5)

**Files:**
- Modify: `src/app/[locale]/(pos)/order/NewOrderScreen.tsx`
- Modify: `src/lib/types.ts`

**Design ref:** `app.js:417` (clamp), `app.js:439` (`#${state.nextId}`), `app.js:924-931` (walk-in `cust:null`), `app.js:480` (cancel copy + danger button).

- [ ] **Step 1: Walk-in checkout (M1) — make customer optional**

In `charge()` (~217-219) and `save()` (~191-193), remove the `if (!customer) { toast(customerRequired); setCustPicker(true); return; }` guards. Ensure the POST body sends `customerId: customer?.id ?? null`. Remove the `required` class on `cust-attach` (~424) and the `customerRequiredHint` text (~432). Keep the "Attach customer / Walk-in guest" affordance.

- [ ] **Step 2: Order number (M2) — type the field**

In `src/lib/types.ts`, add to the `Bootstrap.business` interface:

```ts
  nextOrderNumber?: string;
```

In `NewOrderScreen.tsx` (~386-388) remove the `as any` cast and read `bootstrap.business.nextOrderNumber ?? ''`. Confirm the API returns it:

Run: `grep -rn "nextOrderNumber" ../pos-api/src 2>/dev/null || echo "API must add nextOrderNumber to bootstrap.business"`
If absent, add it to the bootstrap/session response in `pos-api` (compute next sequence for the active store). Sub-commit.

- [ ] **Step 3: Promo clamp (L1)**

At ~126-130 change the fixed-amount branch to clamp:

```tsx
const discountAmount = appliedPromo.kind === 'PERCENT'
  ? +(subtotal * Number(appliedPromo.value) / 100)
  : Math.min(Number(appliedPromo.value), subtotal);
```

- [ ] **Step 4: Cancel modal (L5)**

In the cancel-confirm modal (~573-591): swap the confirm button class from `btn-pri` to a danger style (`btn btn-danger` — add the rule to `pos.css` if absent: `.btn-danger{background:var(--danger);color:#fff}`), give it `flex:2` and the keep button `flex:1`, and align labels to design ("No, keep it" / "Yes, cancel") via i18n keys.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && pnpm i18n:check`
Expected: exit 0.

- [ ] **Step 6: Manual check** — create a walk-in order with no customer, charge cash → succeeds; header shows a real `#number`; apply a flat promo larger than subtotal → total floors at 0, not negative.

- [ ] **Step 7: Commit**

```bash
git add src messages
git commit -m "fix(order): walk-in checkout, real order number, promo clamp, cancel modal"
git push
```

---

## Task 16: Orders board — restore interactive rack assignment + live tagging chip (M3, L7)

**Files:**
- Modify: `src/app/[locale]/(pos)/orders/OrdersBoardScreen.tsx`

**Design ref:** `app.js:1209-1224` (assign-rack modal from `GET /racks`, persists `o.rack`), `app.js:596` (`linked/total tagged`).

- [ ] **Step 1: Rack assign (M3)** — turn the read-only span (~670-674, `<span className="rack-btn">▦ {order.rackCode}</span>`) into a button opening a rack picker:

```tsx
<button className="rack-btn" onClick={() => setRackFor(order)}>
  ▦ {order.rackCode ?? t('assignRack')}
</button>
```

Add state + modal (reuse `<Modal>` and the `GET /racks` list already used by `RacksScreen`):

```tsx
const [rackFor, setRackFor] = useState<Order | null>(null);
const [racks, setRacks] = useState<Rack[]>([]);
useEffect(() => { api<Rack[]>('/racks').then(setRacks).catch(() => {}); }, []);

{rackFor && (
  <Modal open onClose={() => setRackFor(null)} title={t('assignRack')}>
    <div className="modal-body">
      <select defaultValue={rackFor.rackId ?? ''} onChange={async (e) => {
        const rackId = e.target.value || null;
        try {
          await api(`/orders/${rackFor.id}`, { method: 'PATCH', body: { rackId } });
          setRackFor(null); refresh(); toast.show(t('rackAssigned'));
        } catch (err: any) { toast.show(err?.detail?.message ?? tCommon('saveFailed'), 'error'); }
      }}>
        <option value="">{t('noRack')}</option>
        {racks.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
      </select>
    </div>
  </Modal>
)}
```

Confirm the order PATCH accepts `rackId` (check `pos-api`); if it expects `rackCode`, send that instead. Add `Rack` to `types.ts` if not present, and i18n keys `assignRack`, `rackAssigned`, `noRack`.

- [ ] **Step 2: Live tagging chip (L7)** — replace the static `⛿ {t('tagging')}` (~456-463) with the real progress (the TaggingModal already computes tagged/total):

```tsx
⛿ {order._taggedCount ?? 0}/{order.itemCount ?? order.items?.length ?? 0} {t('tagged')}
```

Use the actual field names present on the order object (inspect the TaggingModal to see how it derives the count). Add key `tagged`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && pnpm i18n:check`
Expected: exit 0.

- [ ] **Step 4: Manual check** — open an order detail, assign a rack, reload → rack persists and shows on the card; tagging chip shows e.g. "2/9 tagged".

- [ ] **Step 5: Commit**

```bash
git add src messages
git commit -m "feat(orders): interactive rack assignment + live tagging count"
git push
```

---

## Task 17: Wire orphan settings routes into nav; fix nav icons (M-orphan, L3)

**Files:**
- Modify: `src/app/[locale]/(pos)/settings/SettingsNav.tsx`

- [ ] **Step 1: Add `drivers` and `areas` nav entries** under the Operations group (both are real CRUD pages reachable only by URL today). Use existing label keys or add `drivers`/`areas` to the `Settings` namespace in both locales.

- [ ] **Step 2: Fix the two icon swaps** — Mobile Ordering: use a phone icon (add `Icon.phone` if missing) instead of `Icon.bag`; Subscriptions: use a repeat/cycle icon instead of `Icon.users`. If the icons don't exist in `Icons.tsx`, add the design's SVG paths (`app.js` `I.phone`, `I.repeat`).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && pnpm i18n:check`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src messages
git commit -m "fix(settings): nav entries for drivers/areas; correct nav icons"
git push
```

---

# PHASE 2 — Polish (M6, M10, M11, L2–L10)

## Task 18: ConfirmDialog component — replace native `confirm()` (M10)

**Files:**
- Create: `src/components/ConfirmDialog.tsx`
- Modify: the 7 `confirm()` call sites

- [ ] **Step 1: Create a promise-based confirm built on `<Modal>`**

```tsx
'use client';
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import Modal from './Modal';
import { useTranslations } from 'next-intl';

type Opts = { title: string; message: string; danger?: boolean; confirmLabel?: string };
const Ctx = createContext<(o: Opts) => Promise<boolean>>(() => Promise.resolve(false));

export function ConfirmHost({ children }: { children: ReactNode }) {
  const t = useTranslations('Common');
  const [opts, setOpts] = useState<Opts | null>(null);
  const resolver = useRef<(v: boolean) => void>();
  const confirm = useCallback((o: Opts) => new Promise<boolean>((res) => { resolver.current = res; setOpts(o); }), []);
  const close = (v: boolean) => { resolver.current?.(v); setOpts(null); };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && (
        <Modal open onClose={() => close(false)} title={opts.title}>
          <div className="modal-body"><p>{opts.message}</p></div>
          <div className="modal-foot">
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close(false)}>{t('cancel')}</button>
            <button className={`btn ${opts.danger ? 'btn-danger' : 'btn-pri'}`} style={{ flex: 2 }} onClick={() => close(true)}>{opts.confirmLabel ?? t('confirm')}</button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}
export function useConfirm() { return useContext(Ctx); }
```

- [ ] **Step 2: Mount `ConfirmHost`** inside `ToastHost` in `layout.tsx` (wrap `{children}`). Add `Common.confirm` key to both locales.

- [ ] **Step 3: Replace each `confirm()`** (`BrandingForm.tsx:89`, `ZonesScreen.tsx:56`, `PickupSettings.tsx:88`, `StoreSyncControls.tsx:41`, `GenericCRUDList.tsx:41`, and the other two from `grep -rn "confirm(" src`):

```tsx
const confirm = useConfirm();
// ...
if (!(await confirm({ title: t('deleteTitle'), message: t('deleteMsg'), danger: true, confirmLabel: t('delete') }))) return;
```

- [ ] **Step 4: Verify none remain**

Run: `grep -rn "[^.]confirm(" src | grep -v ConfirmDialog || echo "clean"; npx tsc --noEmit`
Expected: "clean"; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src messages
git commit -m "feat(a11y): in-app ConfirmDialog replacing native confirm()"
git push
```

---

## Task 19: Route remaining hardcoded English through i18n (M11)

**Files:**
- Modify: `src/components/GenericCRUDList.tsx`, `src/components/StoreSyncControls.tsx`, `src/components/AppShell.tsx` (`Active` pill), `settings/shifts/ShiftsScreen.tsx`, `settings/pickup/PickupSettings.tsx`, `settings/users/UsersAndRoles.tsx`

- [ ] **Step 1: GenericCRUDList** — accept translated labels via props (it's generic) OR call `useTranslations('Common')` for the shared verbs. Replace literals: `'Saved'`→`t('saved')`, `'Deleted'`→`t('deleted')`, `+ Add`/`Edit`/`Delete`/`Cancel`/`Save`, the `No {x}s yet` empty, the delete-confirm message (now via `useConfirm`). Add `saved`/`deleted`/`add`/`noneYet` to `Common`.

- [ ] **Step 2: StoreSyncControls** — replace all literals (`Copied to N stores`, confirm text, default labels) with `t(...)`; add a `StoreSync` namespace to both locales.

- [ ] **Step 3: The stragglers** — `AppShell.tsx:413` `Active` pill, `ShiftsScreen` `Open shift`/`Add movement`, `PickupSettings` `Add slot`/`Save`, `UsersAndRoles` `Create role`. Add keys to the relevant namespaces.

- [ ] **Step 4: Verify nothing user-facing is a bare literal in these files**

Run: `npx tsc --noEmit && pnpm i18n:check && pnpm i18n:untranslated`
Expected: exit 0 all three (translate any new keys in `ar.json` as part of this task).

- [ ] **Step 5: Commit**

```bash
git add src messages
git commit -m "fix(i18n): route shared-component strings through next-intl"
git push
```

---

## Task 20: Error feedback on silent catches; misc copy/data fixes (L2, M6, M14, L6, L8, L4)

**Files:**
- Modify: `RequestsScreen.tsx`, `MobileOrderingSettings.tsx`, settings save paths, `WhatsappScreen.tsx`, `AppShell.tsx`, `LoginForm.tsx`, table components

- [ ] **Step 1: Error toasts (L2)** — in `RequestsScreen.tsx` (`399-448`) and `MobileOrderingSettings.tsx` (`121-130`) and the silent settings saves (GeneralScreen, TaxForm, BrandingForm, PickupSettings, GiftCards, Subscriptions, Stores), add a `catch` that calls `toast.show(e?.detail?.message ?? tCommon('saveFailed'), 'error')`. Add `Common.saveFailed`.

- [ ] **Step 2: WhatsApp menu (M6)** — either relabel the "Create order" menu item to "View customer" (matching its `viewOrders → /customers` behavior) or rewire it to open New Order prefilled. Pick relabel for this pass; update `WhatsApp.viewOrders` key text. Decide on "Clear messages" with product (leave out for now; note in PR).

- [ ] **Step 3: Copy parity (M14)** — Requests breadcrumb → "Order Requests" (`Crumbs.requestsInbox`); login subtitle restore store suffix or confirm intentional removal; set `NEXT_PUBLIC_VERSION` in `.env.example` + deployment env so the login version footer renders (e.g. `v2.4`).

- [ ] **Step 4: WhatsApp attach kind (L6)** — in `WhatsappScreen.tsx:238` emit `'DOCUMENT'` instead of out-of-union `'FILE'` (or add `'FILE'` to the `WaKind` union and the `isFile` check at `:481`). Prefer emitting `'DOCUMENT'`.

- [ ] **Step 5: Picker SKU search + express % (L8)** — in `NewOrderScreen.tsx:118` drop the SKU clause to match design (name-only), OR keep as an intentional enhancement and note it. Move `expressPct = 30` to read from business settings/`meta` if available; otherwise leave the existing TODO.

- [ ] **Step 6: Table a11y (L4)** — add `scope="col"` to `<th>` in Customers/Payments/Reports/Finance tables; `scope="row"` to Finance row-header `<td className="ln">` (convert to `<th scope="row">`).

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && pnpm i18n:check && pnpm i18n:untranslated && pnpm lint`
Expected: exit 0 all.

- [ ] **Step 8: Commit**

```bash
git add src messages .env.example
git commit -m "fix: error toasts, copy parity, whatsapp kind, table scope a11y"
git push
```

---

## Task 21: Search results keyboard access + active-nav semantics (a11y leftovers)

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Global search results** (~325-352) — render each `gs-row` as a `<button>` (or `role="option"` in a `role="listbox"`) with `tabIndex`, Enter/Space handlers, and arrow-key navigation between results.

- [ ] **Step 2: Active nav semantics** — add `aria-current={isOn ? 'page' : undefined}` to the active `<Link>` (~278-291); promote the topbar page title `<span class="t">` to an `<h1>` (CSS unchanged); add `aria-label` to badge counts (e.g. `aria-label={t('pendingCount', { n: badge })}`).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && pnpm i18n:check`
Expected: exit 0.

- [ ] **Step 4: Manual check** — Tab to search, type, arrow-key through results, Enter selects; SR announces active nav as current page; `h1` present.

- [ ] **Step 5: Commit**

```bash
git add src messages
git commit -m "fix(a11y): keyboard-navigable search; aria-current; h1 page title"
git push
```

---

## Task 22: Final full-suite verification + sign-off

**Files:** none (verification only)

- [ ] **Step 1: Run every gate**

```bash
npx tsc --noEmit
pnpm lint
pnpm i18n:check
pnpm i18n:untranslated
pnpm build
```
Expected: all exit 0.

- [ ] **Step 2: Dead-code/fake-action sweep (must be empty)**

```bash
grep -rniE "coming soon|not implemented|TODO|FIXME" src --include="*.tsx" --include="*.ts" | grep -v "// " || echo "no stubs"
grep -rn "=> ?{}}" src --include="*.tsx" | grep -v "DeliveryScreen" || echo "no noop handlers (delivery DONE is intentional)"
grep -rn "modal-scrim" src | grep -v Modal.tsx || echo "all modals use Modal"
```
Expected: "no stubs", "no noop handlers", "all modals use Modal".

- [ ] **Step 3: Manual regression pass** of the primary flows: login → new order (walk-in + with customer) → board move/rack/tagging → inspection → delivery → payments → reports CSV → a settings save in each cluster, in both `/en` and `/ar`.

- [ ] **Step 4: Open the integration PR**

```bash
git push
gh pr create --title "POS web audit remediation (P0+P1+P2)" --body "Closes all findings in docs/superpowers/plans/2026-06-04-pos-web-audit-remediation.md"
```

---

## Self-Review notes (coverage map → audit findings)

| Audit finding | Task |
|---|---|
| C1 Arabic locale | 1, 2, 3 |
| H1 fake trends | 6 |
| H2 toast a11y | 4 |
| H3 modal dialog a11y | 5 |
| H4 unused deps | 7 |
| H5 dead WhatsApp panel | 8 |
| M1 walk-in / M2 order# / L1 clamp / L5 cancel | 15 |
| M3 rack assign / L7 tagging chip | 16 |
| M4 catalogue stubs | 10 |
| M5 hardware configure | 11 |
| M6 whatsapp menu | 20 |
| M7 finance persist | 12 |
| M8 hours cutoff | 13 |
| M9 users no-op | 14 |
| M10 native confirm | 18 |
| M11 hardcoded strings | 19 |
| M12 portal roots / L9 metadata | 9 |
| M13 × labels | 5 |
| M14 copy parity | 20 |
| L2 error toasts | 20 |
| L3 nav icons / orphan routes | 17 |
| L4 table scope | 20 |
| L6 whatsapp kind / L8 sku search | 20 |
| L10 reports range labels | covered by Arabic/i18n review in 2 (verify labels) |
| a11y: search keyboard, aria-current, h1 | 21 |

**Backend dependencies flagged (may need `pos-api` sub-commits):** catalogue bulk/PATCH (T10), finance settings (T12), hours expressCutoff (T13), bootstrap `nextOrderNumber` (T15), order `rackId` PATCH (T16). Verify each endpoint before the front-end edit; if absent, add it as a sub-commit in the same task.
