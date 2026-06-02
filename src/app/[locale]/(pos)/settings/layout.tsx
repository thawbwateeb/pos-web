import SettingsNav from './SettingsNav';

/* Design app.js:1652-1657 — the Settings shell is just .settings-grid >
   .set-side > .set-nav. No '.sh' heading slot (that .sh slot is only used
   by Finance, app.js shows it inside .fin via the FinanceModule render). */
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
