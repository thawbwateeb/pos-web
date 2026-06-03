/* Shown by Next while the tapped settings tab's server component is
   running its apiServer fetch + render. The grid keeps the SettingsNav
   visible from the parent layout — only the .set-body region shows the
   skeleton, so the nav stays responsive immediately.

   The shimmer mirrors the standard settings page layout exactly:
     .set-sec h2 + .ssub  (heading + subtitle)
     .set-card with .ch (header + sub) and 3 .set-row placeholders
     .set-card with 2 more rows
   So when real content streams in it slots into the same visual rhythm
   instead of jumping. */

function Bar({ w, h = 14, mt = 0, mb = 0 }: { w: number | string; h?: number; mt?: number; mb?: number }) {
  return (
    <div
      className="shimmer"
      style={{ width: w, height: h, marginTop: mt, marginBottom: mb, borderRadius: h <= 12 ? 4 : 6 }}
      aria-hidden
    />
  );
}

function RowSkeleton() {
  return (
    <div className="set-row" style={{ borderBottom: '1px solid var(--border-2)' }}>
      <div className="l" style={{ flex: 1 }}>
        <Bar w={160} h={15} />
        <Bar w={240} h={11} mt={6} />
      </div>
      <div className="r">
        <Bar w={96} h={32} />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="set-sec">
        {/* Matches .set-sec h2 (22px) + .ssub (13px, margin 3/0/18) */}
        <Bar w={220} h={26} />
        <div style={{ height: 3 }} />
        <Bar w={340} h={13} mb={18} />
      </div>

      <div className="set-card">
        <div className="ch" style={{ marginBottom: 12 }}>
          <Bar w={160} h={16} />
          <Bar w={260} h={11} mt={6} />
        </div>
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>

      <div className="set-card">
        <div className="ch" style={{ marginBottom: 12 }}>
          <Bar w={140} h={16} />
          <Bar w={220} h={11} mt={6} />
        </div>
        <RowSkeleton />
        <RowSkeleton />
      </div>
    </div>
  );
}
