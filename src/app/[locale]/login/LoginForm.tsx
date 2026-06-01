'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { LOGO_LG, Icon } from '@/components/Icons';

interface BusinessOption { slug: string; name: string }

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';
  const t = useTranslations('Login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessSlug, setBusinessSlug] = useState<string | undefined>();
  const [businessChoices, setBusinessChoices] = useState<BusinessOption[]>([]);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ kind: 'err' | 'info'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email) return setErr({ kind: 'err', text: t('missingEmail') });
    if (!password) return setErr({ kind: 'err', text: t('missingPassword') });
    setBusy(true);
    try {
      const r = await api<any>('/auth/login', { method: 'POST', body: { email, password, businessSlug } });
      if (r.code === 'MULTIPLE_BUSINESSES') {
        setBusinessChoices(r.businesses);
        setBusy(false);
        return;
      }
      router.replace(next || `/${locale}/order`);
      router.refresh();
    } catch (e: any) {
      setBusy(false);
      setErr({ kind: 'err', text: e?.detail?.message || t('invalidCredentials') });
    }
  }

  return (
    <div id="login-overlay">
      <div className="lg-bg" />
      <div className="lg-card" id="lg-card">
        <div className="lg-brand">
          <span className="lg-logo">{LOGO_LG}</span>
          <div className="lg-name">
            {t('brand')}<span>{t('tagline')}</span>
          </div>
        </div>
        <div className="lg-welcome">{t('welcome')}</div>
        <div className="lg-sub">{t('subtitle')}</div>

        <form onSubmit={submit}>
          <label className="lg-field">
            <span>{t('email')}</span>
            <input type="email" value={email} autoComplete="username" onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label className="lg-field">
            <span>{t('password')}</span>
            <div className="lg-pin">
              <input type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" id="lg-eye" title={t('showPassword')} onClick={() => setShowPw((v) => !v)}>
                <Icon.eye />
              </button>
            </div>
          </label>

          {businessChoices.length > 0 && (
            <label className="lg-field">
              <span>{t('business')}</span>
              <select className="input" value={businessSlug ?? ''} onChange={(e) => setBusinessSlug(e.target.value || undefined)}>
                <option value="">{t('businessPlaceholder')}</option>
                {businessChoices.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
              </select>
            </label>
          )}

          {err && <div className={`lg-err ${err.kind === 'info' ? 'info' : ''}`}>{err.text}</div>}

          <button className={`lg-submit${busy ? ' btn-loading' : ''}`} type="submit" disabled={busy}>
            {busy ? <span className="lg-spin" /> : null}
            {busy ? t('signingIn') : t('signIn')} <Icon.arrowRight />
          </button>
          <div className="lg-foot">
            <span>{t('roleHint')}</span>
            <span>{t('version')}</span>
          </div>
        </form>
      </div>
    </div>
  );
}
