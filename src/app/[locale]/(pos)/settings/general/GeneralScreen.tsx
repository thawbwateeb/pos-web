'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';

/* Design app.js:1614-1623 — General:
   - .set-sec h2 'General' + .ssub 'Store details, tax & currency'
   - .set-card with five fields in this exact order:
     - 'Store name' input
     - 'Currency' <select> with 10 design-listed options
     - 'Express surcharge (%)' input id='gen-express' value=\${expressPct}
     - 'Branch address' input
     - .field-2 'Contact phone' input + 'Receipt footer' input
   - flex/gap:10 buttons: .btn.btn-pri 'Save Changes' (data-save) +
     .btn.btn-ghost 'Cancel' */

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
  expressSurcharge?: number;
  branchAddress?: string;
}

const CURRENCIES: { code: string; label: string }[] = [
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SAR', label: 'SAR — Saudi Riyal' },
  { code: 'QAR', label: 'QAR — Qatari Riyal' },
  { code: 'KWD', label: 'KWD — Kuwaiti Dinar' },
  { code: 'BHD', label: 'BHD — Bahraini Dinar' },
  { code: 'OMR', label: 'OMR — Omani Rial' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'INR', label: 'INR — Indian Rupee' },
];

export default function GeneralScreen({ business, branding }: { business: BusinessRecord; branding: BrandingRecord | null }) {
  const t = useTranslations('Settings.general');
  const [storeName, setStoreName] = useState<string>(business.name ?? '');
  const [currency, setCurrency] = useState<string>(branding?.currency ?? 'AED');
  const [expressPct, setExpressPct] = useState<number>(branding?.expressSurcharge ?? 30);
  const [branchAddress, setBranchAddress] = useState<string>(branding?.branchAddress ?? '');
  const [contactPhone, setContactPhone] = useState<string>(business.contactPhone ?? '+971 56 830 6804');
  const [receiptFooter, setReceiptFooter] = useState<string>(branding?.receiptFooter ?? 'Thank you — see you soon');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    if (!storeName.trim()) return toast.show('Store name required');
    setBusy(true);
    try {
      await Promise.all([
        api('/business', {
          method: 'PATCH',
          body: { name: storeName.trim(), contactPhone },
        }),
        api('/branding', {
          method: 'PATCH',
          body: {
            currency: currency.trim() || 'AED',
            receiptFooter,
            expressSurcharge: expressPct,
            branchAddress,
          },
        }),
      ]);
      toast.show('Settings saved');
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setStoreName(business.name ?? '');
    setCurrency(branding?.currency ?? 'AED');
    setExpressPct(branding?.expressSurcharge ?? 30);
    setBranchAddress(branding?.branchAddress ?? '');
    setContactPhone(business.contactPhone ?? '+971 56 830 6804');
    setReceiptFooter(branding?.receiptFooter ?? 'Thank you — see you soon');
  }

  return (
    <div className="set-sec">
      <h2>General</h2>
      <div className="ssub">Store details, tax &amp; currency</div>

      <div className="set-card">
        <div className="field">
          <label>Store name</label>
          <input
            className="input"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Currency</label>
          <select
            className="input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
            {CURRENCIES.every((c) => c.code !== currency) && (
              <option value={currency}>{currency}</option>
            )}
          </select>
        </div>
        <div className="field">
          <label>Express surcharge (%)</label>
          <input
            className="input"
            id="gen-express"
            type="number"
            min={0}
            value={expressPct}
            onChange={(e) => setExpressPct(+e.target.value || 0)}
          />
        </div>
        <div className="field">
          <label>Branch address</label>
          <input
            className="input"
            placeholder={t('branchAddressPlaceholder')}
            value={branchAddress}
            onChange={(e) => setBranchAddress(e.target.value)}
          />
        </div>
        <div className="field-2">
          <div className="field">
            <label>Contact phone</label>
            <input
              className="input"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Receipt footer</label>
            <input
              className="input"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
          data-save
          onClick={save}
          disabled={busy}
        >
          Save Changes
        </button>
        <button className="btn btn-ghost" onClick={cancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
