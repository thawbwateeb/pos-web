import Link from 'next/link';
import SettingsNav from './SettingsNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="settings-grid">
      <aside className="set-side">
        <div className="sh">Settings</div>
        <SettingsNav />
      </aside>
      <div className="set-body">{children}</div>
    </div>
  );
}
