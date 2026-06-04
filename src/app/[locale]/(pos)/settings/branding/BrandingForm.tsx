'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, apiUploadUrl } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { Icon, LOGO_ICON } from '@/components/Icons';

/* Design app.js:1547-1597 — Branding & Theme:
   - .set-sec h2 'Branding & Theme' + .ssub 'Your logo, brand identity and
     colors — applied across the POS, receipts and mobile app' (closes
     before the first card).
   - .set-card with .brand-logo-row: .brand-logo-prev (logo or LOGO_ICON) +
     right column 'Brand logo' label + ssub + Upload/Remove buttons. Plus
     a .field-2 below for Brand name / Tagline inputs.
   - .set-sec margin-top:8 'POS theme' h3 + .set-card with two .set-row:
     Primary color + Accent color, each with .brand-pick (swatches +
     <input type=color>).
   - .set-sec margin-top:8 'Mobile app theme' h3 + .set-card with three
     .set-row: App primary / App accent / App background.
   - .brand-livepreview > .blp-label 'Live preview' + .blp-row .blp-pos
     and .blp-app cards.
   - Bottom flex/gap:10: 'Save Branding' (id='brand-save') + 'Reset to
     default' (id='brand-reset'). */

const POS_PRESETS = ['#2A4858', '#1E3A5F', '#0F766E', '#7C3AED', '#B91C1C', '#C2410C', '#111827'];
const ACC_PRESETS = ['#C4A572', '#D4AF37', '#16A34A', '#2563EB', '#DB2777', '#0891B2', '#64748B'];
const APP_BGS    = ['#F5F1E8', '#FFFFFF', '#F4F5F7', '#0F172A', '#FAF7F2'];

const DEFAULTS = {
  brandName: 'Thawb Wa Teeb',
  tagline: 'The Art of Clean',
  posPrimary: '#2A4858',
  posAccent: '#C4A572',
  appPrimary: '#2A4858',
  appAccent: '#C4A572',
  appBg: '#F5F1E8',
  currency: 'AED',
  receiptFooter: 'Thank you — see you soon',
};

export default function BrandingForm({ initial }: { initial: any }) {
  const [f, setF] = useState({
    brandName: initial?.brandName ?? DEFAULTS.brandName,
    tagline: initial?.tagline ?? DEFAULTS.tagline,
    logoFileKey: initial?.logoFileKey ?? (null as string | null),
    posPrimary: initial?.posPrimary ?? DEFAULTS.posPrimary,
    posAccent: initial?.posAccent ?? DEFAULTS.posAccent,
    appPrimary: initial?.appPrimary ?? DEFAULTS.appPrimary,
    appAccent: initial?.appAccent ?? DEFAULTS.appAccent,
    appBg: initial?.appBg ?? DEFAULTS.appBg,
    currency: initial?.currency ?? DEFAULTS.currency,
    receiptFooter: initial?.receiptFooter ?? DEFAULTS.receiptFooter,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const t = useTranslations('Settings.branding');

  const logoUrl = f.logoFileKey ? apiUploadUrl(`/files/${f.logoFileKey}`) : null;

  async function save() {
    setBusy(true);
    try {
      await api('/branding', { method: 'PATCH', body: f });
      toast.show('Branding saved');
    } finally { setBusy(false); }
  }

  async function uploadLogo(file: File) {
    if (!file.type.startsWith('image/')) { toast.show('Pick an image file'); return; }
    if (file.size > 1024 * 1024) { toast.show('Logo must be under 1 MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(apiUploadUrl('/files/upload'), { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error('upload failed');
      const json = await res.json();
      setF((prev) => ({ ...prev, logoFileKey: json.id }));
      toast.show('Logo updated');
    } catch {
      toast.show('Could not upload logo');
    } finally {
      setUploading(false);
    }
  }

  async function resetToDefault() {
    if (!(await confirm({ title: t('resetTitle'), message: t('resetMsg'), danger: true, confirmLabel: t('reset') }))) return;
    setF({ ...DEFAULTS, logoFileKey: null });
    toast.show('Reset to default');
  }

  function setColor(group: 'posPrimary' | 'posAccent' | 'appPrimary' | 'appAccent' | 'appBg', value: string) {
    setF((prev) => ({ ...prev, [group]: value }));
  }

  function Swatch({ value, current, onPick }: { value: string; current: string; onPick: () => void }) {
    return (
      <button
        type="button"
        className={`brand-sw ${current === value ? 'on' : ''}`}
        style={{ background: value }}
        onClick={onPick}
        title={value}
      />
    );
  }

  return (
    <>
      <div className="set-sec">
        <h2>Branding &amp; Theme</h2>
        <div className="ssub">
          Your logo, brand identity and colors — applied across the POS, receipts and mobile app
        </div>
      </div>

      <div className="set-card">
        <div className="brand-logo-row">
          <div className="brand-logo-prev" id="brand-logo-prev">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="logo" />
            ) : (
              LOGO_ICON
            )}
          </div>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 14 }}>Brand logo</b>
            <div className="ssub" style={{ margin: '2px 0 10px' }}>PNG or SVG, square works best (max 1 MB)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={fileRef}
                type="file"
                id="brand-logo-file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadLogo(file); }}
              />
              <button
                className={`btn btn-ghost${uploading ? ' btn-loading' : ''}`}
                id="brand-logo-btn"
                style={{ padding: '9px 14px' }}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Icon.print size={15} /> Upload logo
              </button>
              {logoUrl && (
                <button
                  className="btn btn-ghost"
                  id="brand-logo-rm"
                  style={{ padding: '9px 14px', color: 'var(--danger)' }}
                  onClick={() => setF((prev) => ({ ...prev, logoFileKey: null }))}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="field-2" style={{ marginTop: 14 }}>
          <div className="field">
            <label>Brand name</label>
            <input
              className="input"
              id="brand-name"
              value={f.brandName}
              onChange={(e) => setF({ ...f, brandName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Tagline</label>
            <input
              className="input"
              id="brand-tag"
              value={f.tagline ?? ''}
              onChange={(e) => setF({ ...f, tagline: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="set-sec" style={{ marginTop: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>POS theme</h3>
      </div>
      <div className="set-card">
        <div className="set-row">
          <div className="l"><b>Primary color</b><span>Sidebar, buttons &amp; highlights</span></div>
          <div className="r brand-pick">
            <span className="brand-sws">
              {POS_PRESETS.map((v) => (
                <Swatch key={v} value={v} current={f.posPrimary} onPick={() => setColor('posPrimary', v)} />
              ))}
            </span>
            <input
              type="color"
              className="brand-color"
              data-bsw="pos.primary"
              value={f.posPrimary}
              onChange={(e) => setColor('posPrimary', e.target.value)}
            />
          </div>
        </div>
        <div className="set-row" style={{ border: 'none' }}>
          <div className="l"><b>Accent color</b><span>Gold/secondary touches</span></div>
          <div className="r brand-pick">
            <span className="brand-sws">
              {ACC_PRESETS.map((v) => (
                <Swatch key={v} value={v} current={f.posAccent} onPick={() => setColor('posAccent', v)} />
              ))}
            </span>
            <input
              type="color"
              className="brand-color"
              data-bsw="pos.accent"
              value={f.posAccent}
              onChange={(e) => setColor('posAccent', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="set-sec" style={{ marginTop: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Mobile app theme</h3>
      </div>
      <div className="set-card">
        <div className="set-row">
          <div className="l"><b>App primary</b><span>Headers &amp; primary buttons</span></div>
          <div className="r brand-pick">
            <span className="brand-sws">
              {POS_PRESETS.map((v) => (
                <Swatch key={v} value={v} current={f.appPrimary} onPick={() => setColor('appPrimary', v)} />
              ))}
            </span>
            <input
              type="color"
              className="brand-color"
              data-bsw="app.primary"
              value={f.appPrimary}
              onChange={(e) => setColor('appPrimary', e.target.value)}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l"><b>App accent</b><span>Badges &amp; links</span></div>
          <div className="r brand-pick">
            <span className="brand-sws">
              {ACC_PRESETS.map((v) => (
                <Swatch key={v} value={v} current={f.appAccent} onPick={() => setColor('appAccent', v)} />
              ))}
            </span>
            <input
              type="color"
              className="brand-color"
              data-bsw="app.accent"
              value={f.appAccent}
              onChange={(e) => setColor('appAccent', e.target.value)}
            />
          </div>
        </div>
        <div className="set-row" style={{ border: 'none' }}>
          <div className="l"><b>App background</b><span>Screen base color</span></div>
          <div className="r brand-pick">
            <span className="brand-sws">
              {APP_BGS.map((v) => (
                <Swatch key={v} value={v} current={f.appBg} onPick={() => setColor('appBg', v)} />
              ))}
            </span>
            <input
              type="color"
              className="brand-color"
              data-bsw="app.bg"
              value={f.appBg}
              onChange={(e) => setColor('appBg', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="brand-livepreview">
        <div className="blp-label">Live preview</div>
        <div className="blp-row">
          <div
            className="blp-pos"
            style={{ ['--c' as any]: f.posPrimary, ['--a' as any]: f.posAccent }}
          >
            <div className="blp-rail">
              <div className="blp-mark">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" />
                ) : (
                  LOGO_ICON
                )}
              </div>
            </div>
            <div className="blp-body">
              <div className="blp-h" />
              <div className="blp-btn">Primary button</div>
              <div className="blp-chip">Accent</div>
            </div>
            <span className="blp-tag">POS</span>
          </div>
          <div
            className="blp-app"
            style={{ ['--c' as any]: f.appPrimary, ['--a' as any]: f.appAccent, ['--bg' as any]: f.appBg }}
          >
            <div className="blp-appbar">{f.brandName}</div>
            <div className="blp-appbody">
              <div className="blp-card" />
              <div className="blp-appbtn">Book pickup</div>
              <span className="blp-badge">{f.tagline}</span>
            </div>
            <span className="blp-tag">App</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button
          className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
          id="brand-save"
          onClick={save}
          disabled={busy}
        >
          Save Branding
        </button>
        <button className="btn btn-ghost" id="brand-reset" onClick={resetToDefault}>
          Reset to default
        </button>
      </div>
    </>
  );
}
