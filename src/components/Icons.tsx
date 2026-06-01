/**
 * SVG path library — verbatim translation of `I` in POS/app.js so the
 * design's exact strokes/curves render in our React components.
 */
export const LOGO_PATH = (
  <path d="M862.869 599.53L590.556 485.965L577.113 518.226L849.426 631.774C865.948 638.678 876.643 654.696 876.643 672.591C876.643 684.417 872.035 695.513 863.687 703.861C855.322 712.226 844.226 716.835 832.417 716.835H670.939V627.078H695.53V592.122H610.817V627.078H635.983V716.835H599.27L599.53 592.122H564.591L564.313 715.548L511.53 651.878L458.817 715.443L459.096 592.122H424.087L423.878 716.835H387.617V627.078H412.765V592.122H327.53V627.078H352.678V716.835H191.2C166.817 716.835 146.974 696.991 146.974 672.609V671.548C146.974 654.104 157.252 638.243 173.183 631.148L579.443 450.035C612.956 435.113 634.609 401.757 634.609 365.061C634.609 340.243 624.939 316.87 607.356 299.252C589.739 281.67 566.383 272 541.565 272H464.991C423.235 272 389.27 305.983 389.27 347.757C389.27 389.513 423.235 423.478 464.991 423.478H471.948V388.522H464.991C442.504 388.522 424.209 370.226 424.209 347.722C424.209 325.252 442.504 306.957 464.991 306.957H541.565C557.061 306.957 571.652 312.991 582.626 323.965C593.6 334.957 599.635 349.548 599.635 365.043C599.635 387.965 586.122 408.783 565.2 418.104L158.939 599.217C130.417 611.913 112 640.296 112 671.53V672.591C112 716.243 147.513 751.774 191.183 751.774H474.087L511.513 706.626L548.939 751.774H745.391H752.348H832.383C853.513 751.774 873.391 743.53 888.348 728.591C903.322 713.652 911.565 693.774 911.565 672.609C911.583 640.557 892.452 611.878 862.869 599.53Z" />
);

export const LOGO_ICON = (
  // Design POS.html line 18 uses 26x20 in the rail logo slot, not 23x18.
  <svg width="26" height="20" viewBox="112 272 800 480" fill="currentColor">
    {LOGO_PATH}
  </svg>
);

export const LOGO_LG = (
  <svg width="26" height="20" viewBox="112 272 800 480" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    {LOGO_PATH}
  </svg>
);

interface IconProps { size?: number; className?: string }
const wrap = (paths: React.ReactNode, w = 22) => ({ size, className }: IconProps) => (
  <svg width={size ?? w} height={size ?? w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    {paths}
  </svg>
);

// Verbatim from POS/app.js `I`
export const Icon = {
  hanger: wrap(<><path d="M12 4c0-1 .8-1.8 1.8-1.8S15.6 3 15.6 4M12 5L4 13c-.6.5-.3 1.5.5 1.5h15c.8 0 1.1-1 .5-1.5L15 9.5"/></>),
  whatsapp: wrap(<><path d="M3 21l1.6-4.4A8 8 0 1 1 8 19.4z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5"/></>),
  trend: wrap(<><path d="M3 3v18h18"/><path d="M6 16l3.5-4 3 2 4-6"/></>),
  receipt: wrap(<><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21z"/><path d="M8 7.5h8M8 11h8M8 14.5h5"/></>),
  board: wrap(<><rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/></>),
  card: wrap(<><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 9.5h19"/></>),
  users: wrap(<><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.5a3 3 0 0 1 0 5.8M21 20c0-2.6-1.5-4.5-3.8-5.2"/></>),
  truck: wrap(<><path d="M2 17V6h12v11M14 9h4l3 3.5V17h-3"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></>),
  tag: wrap(<><path d="M3 11.5V4.5A1.5 1.5 0 0 1 4.5 3h7l8.5 8.5a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0L3 11.5z"/><circle cx="7.5" cy="7.5" r="1.3"/></>),
  chart: wrap(<><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/></>),
  search: wrap(<><circle cx="10" cy="10" r="6.5"/><path d="M15 15l5 5"/></>),
  plus: wrap(<><path d="M12 5v14M5 12h14"/></>),
  bag: wrap(<><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>),
  cash: wrap(<><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/></>),
  wallet: wrap(<><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/></>),
  apple: wrap(<><path d="M17.6 12.4c0-2.7 2.2-4 2.3-4-1.3-1.8-3.2-2.1-3.9-2.1-1.7-.2-3.3 1-4.1 1-.9 0-2.2-1-3.6-1-1.9 0-3.6 1.1-4.6 2.8-2 3.4-.5 8.4 1.4 11.1.9 1.3 2 2.8 3.4 2.7 1.4-.1 1.9-.9 3.5-.9s2.1.9 3.6.9c1.5 0 2.4-1.3 3.3-2.7.7-1 1.2-2 1.6-3-1.7-.6-3-2.3-2.9-4.8z" fill="currentColor" stroke="none"/></>),
  clock: wrap(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  check: wrap(<><path d="M4 12l5 5L20 6"/></>),
  print: wrap(<><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v6H8z"/></>),
  mail: wrap(<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>),
  gear: wrap(<><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>),
  shop: wrap(<><path d="M4 9l1.5-5h13L20 9M4 9h16M4 9v11h16V9M9 20v-6h6v6"/></>),
  chevd: wrap(<><path d="M6 9l6 6 6-6"/></>),
  palette: wrap(<><circle cx="12" cy="12" r="9"/><circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="16.5" cy="10.5" r="1.2" fill="currentColor" stroke="none"/><path d="M12 21c1.5 0 2-1 2-2s-.8-2-2-2-2 .8-2 2 .8 2 2 2z"/></>),
  percent: wrap(<><path d="M19 5 5 19"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/></>),
  loyal: wrap(<><path d="M12 4l2.3 4.7 5.2.8-3.7 3.6.9 5.1L12 15.8 7 18l.9-5.1L4.2 9.5l5.2-.8z"/></>),
  gift: wrap(<><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M3 12h18M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/></>),
  zone: wrap(<><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>),
  bell: wrap(<><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></>),
  box: wrap(<><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></>),
  ticket: wrap(<><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><path d="M14 6v12" strokeDasharray="2 2"/></>),
  plug: wrap(<><path d="M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-12 0zM12 18v3"/></>),
  eye: wrap(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>),
  arrowRight: wrap(<><path d="M5 12h14M13 6l6 6-6 6"/></>),
};
