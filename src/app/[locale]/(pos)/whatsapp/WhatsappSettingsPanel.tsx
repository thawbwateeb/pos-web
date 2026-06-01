'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

export interface WhatsappSettings {
  botEnabled: boolean;
  botName: string;
  botPrompt?: string;
  greeting?: string;
  awayMsg?: string;
  handoffMsg?: string;
  pauseMinutes: number;
  handoffKeywords?: string;
  workingHours?: string;
  afterHoursMsg?: string;
}

interface Template {
  id: string;
  body: string;
}

export default function WhatsappSettingsPanel({
  initial,
  onClose,
  onSaved,
}: {
  initial: WhatsappSettings | null;
  onClose: () => void;
  onSaved: (next: WhatsappSettings) => void;
}) {
  const t = useTranslations('WhatsApp');
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean>(initial?.botEnabled ?? true);
  const [name, setName] = useState<string>(initial?.botName ?? 'Teeb Assistant');
  const [pauseMins, setPauseMins] = useState<number>(initial?.pauseMinutes ?? 15);
  const [greeting, setGreeting] = useState<string>(initial?.greeting ?? '');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const next: WhatsappSettings = {
      ...(initial ?? { botEnabled: true, botName: 'Teeb Assistant', pauseMinutes: 15 }),
      botEnabled: enabled,
      botName: name,
      pauseMinutes: pauseMins,
      greeting,
    };
    try {
      await api('/whatsapp/settings', { method: 'PATCH', body: next });
      onSaved(next);
    } catch (e: any) {
      toast.show(e?.detail?.message || 'Failed to save');
      setSaving(false);
    }
  }

  function addTemplate() {
    setTemplates((cur) => [...cur, { id: `tpl-${Date.now()}`, body: '' }]);
  }

  function updateTemplate(id: string, body: string) {
    setTemplates((cur) => cur.map((x) => (x.id === id ? { ...x, body } : x)));
  }

  function removeTemplate(id: string) {
    setTemplates((cur) => cur.filter((x) => x.id !== id));
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: 'min(640px, 95vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 20,
          background: 'var(--card, #fff)',
          borderRadius: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>{t('settingsTitle')}</h3>

        <div
          className="set-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 0',
          }}
        >
          <div>
            <b>{t('botEnabled')}</b>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          </label>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>{t('botName')}</label>
          <input className="inp" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>{t('pauseMinutes')}</label>
          <input
            className="inp"
            type="number"
            min={0}
            value={pauseMins}
            onChange={(e) => setPauseMins(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>{t('greeting')}</label>
          <textarea
            className="inp"
            rows={3}
            style={{ resize: 'vertical' }}
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
          />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>{t('autoReplies')}</label>
          {templates.map((tpl) => (
            <div key={tpl.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                className="inp"
                value={tpl.body}
                onChange={(e) => updateTemplate(tpl.id, e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-ghost" onClick={() => removeTemplate(tpl.id)}>
                ×
              </button>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={addTemplate} style={{ marginTop: 4 }}>
            + {t('addTemplate')}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button className="btn btn-pri" onClick={save} disabled={saving}>
            {t('saved')}
          </button>
        </div>
      </div>
    </div>
  );
}
