'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

export interface BusinessRecord {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  countryCode: string;
  timezone: string;
}

export interface BrandingRecord {
  businessId: string;
  brandName: string;
  tagline: string | null;
  currency: string;
  receiptFooter: string;
  posPrimary?: string;
  posAccent?: string;
  appPrimary?: string;
  appAccent?: string;
  appBg?: string;
  logoFileKey?: string | null;
}

interface FormState {
  businessName: string;
  brandName: string;
  tagline: string;
  countryCode: string;
  timezone: string;
  currency: string;
  receiptFooter: string;
}

const TIMEZONES = [
  'Asia/Dubai',
  'Asia/Muscat',
  'Asia/Qatar',
  'Asia/Riyadh',
  'Asia/Bahrain',
  'Asia/Kuwait',
  'Europe/London',
  'UTC',
];

export default function GeneralScreen({ business, branding }: { business: BusinessRecord; branding: BrandingRecord | null }) {
  const [f, setF] = useState<FormState>({
    businessName: business.name ?? '',
    brandName: branding?.brandName ?? '',
    tagline: branding?.tagline ?? '',
    countryCode: business.countryCode ?? 'AE',
    timezone: business.timezone ?? 'Asia/Dubai',
    currency: branding?.currency ?? 'AED',
    receiptFooter: branding?.receiptFooter ?? '',
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    if (!f.businessName.trim()) return toast.show('Business name required');
    setBusy(true);
    try {
      await Promise.all([
        api('/business', {
          method: 'PATCH',
          body: {
            name: f.businessName.trim(),
            countryCode: f.countryCode.trim().toUpperCase() || 'AE',
            timezone: f.timezone.trim() || 'Asia/Dubai',
          },
        }),
        api('/branding', {
          method: 'PATCH',
          body: {
            brandName: f.brandName.trim(),
            tagline: f.tagline,
            currency: f.currency.trim() || 'AED',
            receiptFooter: f.receiptFooter,
          },
        }),
      ]);
      toast.show('Settings saved');
    } finally { setBusy(false); }
  }

  return (
    <div className="set-sec">
      <h2>General</h2>
      <p className="ssub">Business name, currency, address, receipt footer.</p>

      <div className="set-card">
        <div className="field">
          <label>Business name</label>
          <input className="input" value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} />
        </div>
        <div className="field-2">
          <div className="field">
            <label>Brand name</label>
            <input className="input" value={f.brandName} onChange={(e) => setF({ ...f, brandName: e.target.value })} />
          </div>
          <div className="field">
            <label>Tagline</label>
            <input className="input" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} />
          </div>
        </div>
        <div className="field-2">
          <div className="field">
            <label>Country code</label>
            <input
              className="input"
              value={f.countryCode}
              maxLength={2}
              placeholder="AE"
              onChange={(e) => setF({ ...f, countryCode: e.target.value.toUpperCase() })}
              style={{ width: 100, fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
          <div className="field">
            <label>Timezone</label>
            <select
              className="input"
              value={f.timezone}
              onChange={(e) => setF({ ...f, timezone: e.target.value })}
            >
              {TIMEZONES.includes(f.timezone) ? null : <option value={f.timezone}>{f.timezone}</option>}
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-2">
          <div className="field">
            <label>Currency</label>
            <input
              className="input"
              value={f.currency}
              maxLength={3}
              onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })}
              style={{ width: 100, fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
          <div className="field" />
        </div>
        <div className="field">
          <label>Receipt footer</label>
          <textarea
            className="input"
            rows={3}
            value={f.receiptFooter}
            placeholder="Thank you — see you soon"
            onChange={(e) => setF({ ...f, receiptFooter: e.target.value })}
          />
        </div>
      </div>

      <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} onClick={save}>Save changes</button>
    </div>
  );
}
