import SettingsNav from './SettingsNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="settings-grid">
      <div className="set-side">
        <div className="sh">Settings</div>
        <SettingsNav />
      </div>
      <div className="set-body">{children}</div>
    </div>
  );
}
