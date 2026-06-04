'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';

/* Design app.js:1348 (NT array) + 1418-1420 (notify body):
   - .set-sec h2 'Notifications' + .ssub 'Automated messages to customers
     & staff'
   - .set-card with one .set-row per notification type. Each row:
     .l <b>name</b><span>description</span> + .r flex/gap:10 align:center
     with optional 'Template' button (data-tmpledit=\${key}) — only when a
     template exists — and a switch (data-tog='notify.\${key}'). */

interface ToggleRow { key: string; enabled: boolean }
interface TemplateRow { key: string; body: string }

// Design ordering: 6 notification types from NT[] in app.js:1348.
const ROWS: { key: string; name: string; desc: string; hasTemplate: boolean }[] = [
  { key: 'SMS_READY',     name: 'SMS when order is ready',     desc: 'Sent to customer mobile',     hasTemplate: true },
  { key: 'SMS_OUT',       name: 'SMS when out for delivery',   desc: 'With driver name & ETA',      hasTemplate: true },
  { key: 'EMAIL_INVOICE', name: 'Email invoice on payment',    desc: 'PDF attached',                hasTemplate: true },
  { key: 'WA_CONFIRM',    name: 'WhatsApp booking confirmation', desc: 'On pickup scheduled',       hasTemplate: true },
  { key: 'MARKETING',     name: 'Marketing & promo blasts',    desc: 'Opt-in customers only',       hasTemplate: false },
  { key: 'LOW_STOCK',     name: 'Low supplies alert',          desc: 'Notify manager',              hasTemplate: false },
];

/* Map design's lowercase 'notify.X' key suffix to the backend uppercase key. */
const TOG_KEY: Record<string, string> = {
  SMS_READY: 'smsReady',
  SMS_OUT: 'smsOut',
  EMAIL_INVOICE: 'emailInvoice',
  WA_CONFIRM: 'waConfirm',
  MARKETING: 'marketing',
  LOW_STOCK: 'lowStock',
};

export default function NotificationsForm({ initial }: { initial: { templates: TemplateRow[]; toggles: ToggleRow[] } }) {
  const [toggles, setToggles] = useState<ToggleRow[]>(initial.toggles);
  const [templates, setTemplates] = useState<TemplateRow[]>(initial.templates);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const toast = useToast();

  const togByKey = useMemo(() => Object.fromEntries(toggles.map((t) => [t.key, t])) as Record<string, ToggleRow>, [toggles]);
  const tmplByKey = useMemo(() => Object.fromEntries(templates.map((t) => [t.key, t])) as Record<string, TemplateRow>, [templates]);

  async function flip(key: string) {
    const cur = togByKey[key];
    const enabled = !(cur?.enabled ?? false);
    setToggles((all) => {
      if (all.some((t) => t.key === key)) return all.map((t) => (t.key === key ? { ...t, enabled } : t));
      return [...all, { key, enabled }];
    });
    try {
      await api('/notifications/toggles', { method: 'PATCH', body: [{ key, enabled }] });
    } catch {
      toast.show('Failed');
    }
  }

  async function saveTemplate(key: string, body: string) {
    setTemplates((all) => {
      if (all.some((t) => t.key === key)) return all.map((t) => (t.key === key ? { ...t, body } : t));
      return [...all, { key, body }];
    });
    try {
      await api('/notifications/templates', { method: 'PATCH', body: [{ key, body }] });
      toast.show('Template saved');
    } catch {
      toast.show('Failed');
    }
    setEditingKey(null);
  }

  return (
    <>
      <div className="set-sec">
        <h2>Notifications</h2>
        <div className="ssub">Automated messages to customers &amp; staff</div>
        <div className="set-card">
          {ROWS.map((r) => {
            const togKey = TOG_KEY[r.key] ?? r.key;
            const on = togByKey[r.key]?.enabled ?? false;
            return (
              <div className="set-row" key={r.key}>
                <div className="l"><b id={`notify-lbl-${r.key}`}>{r.name}</b><span>{r.desc}</span></div>
                <div className="r" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {r.hasTemplate && (
                    <button className="t-btn ghost" data-tmpledit={togKey} onClick={() => setEditingKey(r.key)}>
                      Template
                    </button>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-labelledby={`notify-lbl-${r.key}`}
                    className={`switch${on ? ' on' : ''}`}
                    data-tog={`notify.${togKey}`}
                    onClick={() => flip(r.key)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {editingKey && (
        <TemplateModal
          label={ROWS.find((r) => r.key === editingKey)?.name ?? editingKey}
          body={tmplByKey[editingKey]?.body ?? ''}
          onClose={() => setEditingKey(null)}
          onSave={(body) => saveTemplate(editingKey, body)}
        />
      )}
    </>
  );
}

/* Design app.js:1786-1796 — Template modal (opened via data-tmpledit):
   single textarea labelled 'Message template' with placeholder-aware copy.
   Save button text 'Save template'. Cancel button closes the modal. */
function TemplateModal({ label, body, onClose, onSave }: { label: string; body: string; onClose: () => void; onSave: (b: string) => void }) {
  const [text, setText] = useState<string>(body);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try { await onSave(text); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={label}>
        <div className="modal-body">
          <div className="field">
            <label>Message template</label>
            <textarea
              className="input"
              id="tmpl-text"
              style={{ minHeight: 120, resize: 'vertical', font: 'inherit' }}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} id="tmpl-save" style={{ flex: 2 }} onClick={submit} disabled={busy}>
            Save template
          </button>
        </div>
    </Modal>
  );
}
