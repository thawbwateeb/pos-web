'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

const LABEL: Record<string, string> = {
  SMS_READY: 'SMS · Order ready',
  SMS_OUT: 'SMS · Out for delivery',
  EMAIL_INVOICE: 'Email · Invoice',
  WA_CONFIRM: 'WhatsApp · Pickup confirmation',
  MARKETING: 'Marketing broadcasts',
  LOW_STOCK: 'Low stock alerts',
};

export default function NotificationsForm({ initial }: { initial: { templates: any[]; toggles: any[] } }) {
  const [templates, setTemplates] = useState(initial.templates);
  const [toggles, setToggles] = useState(initial.toggles);
  const toast = useToast();

  async function saveTemplates() {
    await api('/notifications/templates', { method: 'PATCH', body: templates.map((t) => ({ key: t.key, body: t.body })) });
    toast.show('Templates saved');
  }
  async function flipToggle(key: string, enabled: boolean) {
    setToggles((cur) => cur.map((t) => (t.key === key ? { ...t, enabled } : t)));
    await api('/notifications/toggles', { method: 'PATCH', body: [{ key, enabled }] });
  }

  return (
    <div className="set-sec">
      <h2>Notifications</h2>
      <p className="ssub">When and what messages get sent to customers automatically.</p>
      <div className="set-card">
        <h3>Channels</h3>
        {toggles.map((t) => (
          <div className="set-row" key={t.key}>
            <div className="l"><b>{LABEL[t.key] ?? t.key}</b></div>
            <div className="r"><span className={`switch${t.enabled ? ' on' : ''}`} onClick={() => flipToggle(t.key, !t.enabled)} /></div>
          </div>
        ))}
      </div>
      <div className="set-card">
        <h3>Templates</h3>
        <p className="ssub">Use placeholders like &#123;name&#125;, &#123;order&#125;, &#123;total&#125;, &#123;driver&#125;, &#123;eta&#125;.</p>
        {templates.map((t, i) => (
          <div className="field" key={t.key}>
            <label>{LABEL[t.key] ?? t.key}</label>
            <textarea
              className="input"
              rows={2}
              value={t.body}
              onChange={(e) => setTemplates((cur) => cur.map((x, idx) => (idx === i ? { ...x, body: e.target.value } : x)))}
            />
          </div>
        ))}
        <button className="btn btn-pri" onClick={saveTemplates}>Save templates</button>
      </div>
    </div>
  );
}
