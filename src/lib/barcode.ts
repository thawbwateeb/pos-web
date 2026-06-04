/**
 * Minimal Code 128-B barcode → SVG renderer for garment tag labels.
 *
 * Code 128-B covers all printable ASCII (space..~), which is plenty for the
 * alphanumeric tag ids the API issues (e.g. "TWT-10423-3"). We render to SVG
 * so it prints crisply at any DPI through QZ Tray's HTML pipeline.
 */

// Canonical Code 128 element-width patterns, symbol values 0..106.
// Each entry is 6 module widths (bar,space,bar,space,bar,space); index 106 is
// the stop pattern (7 widths, includes the terminating bar).
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

const START_B = 104;
const STOP = 106;

/** Encode `value` to a Code 128-B SVG string `width`×`height` px. */
export function code128Svg(value: string, width = 220, height = 56): string {
  const clean = (value || '').replace(/[^\x20-\x7e]/g, '');
  const codes: number[] = [START_B];
  for (const ch of clean) codes.push(ch.charCodeAt(0) - 32);

  // Checksum: (start + Σ value·position) mod 103.
  let sum = START_B;
  for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
  codes.push(sum % 103);
  codes.push(STOP);

  // Expand to a module string, then walk it emitting bar rects.
  const modules = codes.map((c) => PATTERNS[c]).join('');
  const totalUnits = modules.split('').reduce((n, d) => n + Number(d), 0);
  const unit = width / totalUnits;

  let x = 0;
  let bar = true; // patterns always start with a bar
  const rects: string[] = [];
  for (const d of modules) {
    const w = Number(d) * unit;
    if (bar) rects.push(`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}"/>`);
    x += w;
    bar = !bar;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">` +
    `<rect width="${width}" height="${height}" fill="#fff"/>` +
    `<g fill="#000">${rects.join('')}</g></svg>`
  );
}
