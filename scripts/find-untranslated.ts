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
      // Skip intrinsically non-translatable leaves: strip ICU placeholders {…} and all
      // non-letter symbols from the English value; if no Latin letters remain there is
      // nothing to translate (e.g. "{v}", "▲ 12%"), so it can't be flagged.
      const translatable = /[A-Za-z]/.test(ev.replace(/\{[^}]*\}/g, '').replace(/[^A-Za-z]/g, ''));
      if (!translatable) continue;
      const same = av === ev;
      const noArabic = typeof av === 'string' && !AR.test(av) && /[A-Za-z]/.test(av);
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
