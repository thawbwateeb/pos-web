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

  const missing = Array.from(enKeys).filter((k) => !arKeys.has(k));
  const extra = Array.from(arKeys).filter((k) => !enKeys.has(k));
  if (missing.length) {
    console.error(`MISSING in ar.json (${missing.length}):`);
    missing.forEach((k) => console.error('  ' + k));
  }
  if (extra.length) {
    console.error(`EXTRA in ar.json (${extra.length}):`);
    extra.forEach((k) => console.error('  ' + k));
  }

  const phMismatch: string[] = [];
  for (const k of Array.from(enKeys)) {
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

  // Allowlist: known Latin-as-source tokens (currency codes, brand names,
  // phone-number examples, monospace-font names).
  const allow = new Set([
    'AED', 'WhatsApp', 'POS', 'WhatsApp Business', 'Apple Pay',
    'Thawb Wa Teeb', 'Cormorant Garamond', 'Inter', 'JetBrains Mono',
    'Stripe',
  ]);
  // "Still English" heuristic: any leaf value containing 4+ consecutive
  // ASCII letters AND zero Arabic codepoints is suspicious.
  const stillEnglish: string[] = [];
  const englishRe = /[A-Za-z]{4,}/;
  const arabicRe = /[؀-ۿ]/;
  for (const [k, v] of Object.entries(ar)) {
    if (!englishRe.test(v)) continue;
    if (arabicRe.test(v)) continue;
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
