import SettingsNav from './SettingsNav';

/* Design app.js:1652-1657 — settings shell is
   <div class="settings-grid">
     <div class="set-side"><div class="set-nav">…groups + buttons…</div></div>
     <div class="set-body">…</div>
   </div>
   The .set-side has NO .sh heading (that is Finance-only). */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="settings-grid">
      <div className="set-side">
        <SettingsNav />
      </div>
      <div className="set-body">{children}</div>
    </div>
  );
}
