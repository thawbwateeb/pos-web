# Arabic Translation Brief — pos-web 2026-06 batch

## Audience

Internal POS terminal operators at Thawb Wa Teeb Laundry stores in Dubai
(English- and Arabic-speaking staff). The Arabic locale of the application
will be used by staff who prefer Arabic UI; customer-facing surfaces (the
mobile customer app, WhatsApp chatbot) are out of scope of this brief.

## Source file

`messages/en.json` — the canonical English source. The frontmatter-free
deeply nested JSON tree you see is the schema for the Arabic file. **Do
not modify keys.** Translate values only.

## Deliverable

A single `ar.json` file with byte-identical key tree and structure to
`messages/en.json`. UTF-8, no BOM. Same indentation as the source. The
file will be saved at `messages/ar.json`.

## Voice + register

- Modern Standard Arabic, customer-service register.
- Friendly but professional. The English voice is "The Art of Clean" —
  match that warmth, not a formal-archaic tone.
- Address staff in the second-person plural (المخاطب الجمع) where the
  English is imperative.

## Domain glossary

| English | Arabic | Notes |
|---|---|---|
| Order | طلب | |
| New Order | طلب جديد | |
| Walk-in | حضور مباشر | NOT "زائر" |
| Pickup & Delivery | الاستلام والتوصيل | |
| Express | خدمة سريعة | NOT "مستعجل" |
| Dry Clean | تنظيف جاف | |
| Wash | غسيل | |
| Press | كي | |
| Tagging | وسم | machine-side process |
| Cleaning | تنظيف | |
| Ready | جاهز | |
| Driver | سائق | |
| Cash | نقدًا | |
| Card | بطاقة | |
| Apple Pay | Apple Pay | KEEP IN ENGLISH |
| On Delivery | عند التوصيل | |
| Receipt | إيصال | |
| Z-Report | تقرير الإغلاق | |
| Shift | وردية | |
| Check In / Check Out | بدء / إنهاء الوردية | |
| Tax / VAT | ضريبة / ضريبة القيمة المضافة | |
| Loyalty | الولاء | |
| Subscription | اشتراك | |
| Gift Card | بطاقة هدية | |
| Rack | رف | |
| Customer | عميل | |
| Customer Directory | دليل العملاء | |
| Promo Code | رمز ترويجي | |

## Formatting rules (mandatory)

1. **Placeholders** like `{store}`, `{number}`, `{amount}`, `{pct}`, `{h}`,
   `{m}`, `{name}`, `{date}`, `{v}` must appear in the Arabic translation
   exactly — same identifier, same braces. Re-order them as Arabic grammar
   requires.

2. **Middle-dot separator** `· ` (U+00B7) — keep as a layout separator.
   Don't translate it.

3. **Currency code** "AED" stays in Latin. Don't transliterate.

4. **Brand names** "Thawb Wa Teeb", "WhatsApp", "WhatsApp Business",
   "Apple Pay", "Stripe" stay in Latin.

5. **Phone-number examples** like `+971 50 123 4567` are illustrative,
   not real PII. Keep them as Latin numerals.

6. **Ellipsis** `…` (U+2026, single char) — keep as a single character,
   not three dots.

7. **Quotation marks** — use Arabic guillemets «» or curly quotes "" as
   the typographic context calls for. The source mostly uses ASCII ".

## Acceptance test

A validator script will run on the returned file:

```
pnpm i18n:check
```

The validator checks:
- key-by-key equivalence with `en.json` (no extra/missing keys)
- placeholder parity (every `{name}` in en.json present in ar.json for
  the same key)
- "still English" heuristic: any leaf value containing 4+ consecutive
  ASCII letters AND zero Arabic codepoints is flagged. The allowlist
  for known-Latin values (currency codes, brand names) is documented in
  `scripts/check-i18n-parity.ts`.

A returned file with zero validator warnings is accepted.

## Turnaround

Estimate: ~1,200 leaf strings. Working day target: 1–2 days. Please send
the file back as `ar.json` (not an attachment with a different name).
