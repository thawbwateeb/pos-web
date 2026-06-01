'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

export default function BrandingForm({ initial }: { initial: any }) {
  const [f, setF] = useState({
    brandName: initial?.brandName ?? '',
    tagline: initial?.tagline ?? '',
    posPrimary: initial?.posPrimary ?? '#2A4858',
    posAccent: initial?.posAccent ?? '#C4A572',
    appPrimary: initial?.appPrimary ?? '#2A4858',
    appAccent: initial?.appAccent ?? '#C4A572',
    appBg: initial?.appBg ?? '#F5F1E8',
    currency: initial?.currency ?? 'AED',
    receiptFooter: initial?.receiptFooter ?? '',
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    try {
      await api('/branding', { method: 'PATCH', body: f });
      toast.show('Branding saved');
    } finally { setBusy(false); }
  }

  return (
    <div className="set-sec">
      <h2>Branding</h2>
      <p className="ssub">How your business appears on the POS, customer app, and receipts.</p>

      <div className="set-card">
        <div className="field"><label>Brand name</label><input className="input" value={f.brandName} onChange={(e) => setF({ ...f, brandName: e.target.value })} /></div>
        <div className="field"><label>Tagline</label><input className="input" value={f.tagline ?? ''} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></div>
        <div className="field-2">
          <div className="field"><label>Currency</label><input className="input" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} /></div>
          <div className="field"><label>Receipt footer</label><input className="input" value={f.receiptFooter} onChange={(e) => setF({ ...f, receiptFooter: e.target.value })} /></div>
        </div>
      </div>

      <div className="set-card">
        <div className="ch"><h3>POS colors</h3><div className="csub">Used in the staff POS interface.</div></div>
        <div className="brand-logo-row">
          <ColorField label="Primary" value={f.posPrimary} onChange={(v) => setF({ ...f, posPrimary: v })} />
          <ColorField label="Accent" value={f.posAccent} onChange={(v) => setF({ ...f, posAccent: v })} />
        </div>
      </div>

      <div className="set-card">
        <div className="ch"><h3>Customer app colors</h3><div className="csub">Used by the customer-facing app.</div></div>
        <div className="brand-logo-row">
          <ColorField label="Primary" value={f.appPrimary} onChange={(v) => setF({ ...f, appPrimary: v })} />
          <ColorField label="Accent" value={f.appAccent} onChange={(v) => setF({ ...f, appAccent: v })} />
          <ColorField label="Background" value={f.appBg} onChange={(v) => setF({ ...f, appBg: v })} />
        </div>
      </div>

      <div className="set-card">
        <div className="ch"><h3>Live preview</h3></div>
        <div className="brand-livepreview">
          <div className="blp-row">
            <div className="blp-pos" style={{ ['--c' as any]: f.posPrimary, ['--a' as any]: f.posAccent }}>
              <div className="blp-tag">POS</div>
              <div className="blp-rail"><div className="blp-mark">TT</div></div>
              <div className="blp-body">
                <div className="blp-h" />
                <div className="blp-chip">{f.brandName || 'Brand'}</div>
                <div className="blp-btn">Charge</div>
              </div>
            </div>
            <div className="blp-app" style={{ ['--c' as any]: f.appPrimary, ['--a' as any]: f.appAccent, background: f.appBg }}>
              <div className="blp-tag">App</div>
              <div className="blp-appbar">{f.brandName || 'Brand'}</div>
              <div className="blp-appbody">
                <div className="blp-card" />
                <div className="blp-appbtn">Book pickup</div>
                <div className="blp-badge">{f.tagline}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} onClick={save}>Save changes</button>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="color" className="brand-color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }} />
      </div>
    </div>
  );
}
