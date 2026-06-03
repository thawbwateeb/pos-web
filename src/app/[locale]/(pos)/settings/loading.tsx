/* Shown by Next while the tapped settings tab's server component is
   running its apiServer fetch + render. Without this, the previous
   tab's content stays frozen until the new RSC payload streams in,
   which feels like the app has hung. The grid keeps the SettingsNav
   visible from the parent layout — only the .set-body region shows
   the skeleton, so the nav is responsive immediately. */
export default function Loading() {
  return (
    <div className="set-body-loading" style={{ padding: 22, color: 'var(--muted)' }}>
      <div style={{ height: 28, width: 180, background: 'var(--surface-2)', borderRadius: 6, marginBottom: 14 }} />
      <div style={{ height: 14, width: 320, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 22, opacity: 0.7 }} />
      <div style={{ height: 220, background: 'var(--surface-2)', borderRadius: 12, opacity: 0.6 }} />
    </div>
  );
}
