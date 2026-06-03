'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { LOGO_PATH } from '@/components/Icons';

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
  const pwRef = useRef<HTMLInputElement>(null);

  // Match design login.js:28 — focus password on mount.
  useEffect(() => { pwRef.current?.focus(); }, []);

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
        {/* Design login.js:4 — LOGO svg has NO width/height attrs (CSS .lg-logo svg
            sets 28×18 in pos.css:591). */}
        <div className="lg-brand">
          <span className="lg-logo">
            <svg viewBox="112 272 800 480" fill="currentColor">{LOGO_PATH}</svg>
          </span>
          <div className="lg-name">
            {t('brand')}<span>{t('tagline')}</span>
          </div>
        </div>
        <div className="lg-welcome">{t('welcome')}</div>
        <div className="lg-sub">{t('subtitle')}</div>

        <form onSubmit={submit}>
          <label className="lg-field">
            <span>{t('email')}</span>
            <input
              id="lg-email"
              type="email"
              value={email}
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  pwRef.current?.focus();
                }
              }}
            />
          </label>

          <label className="lg-field">
            <span>{t('password')}</span>
            <div className="lg-pin">
              <input
                ref={pwRef}
                id="lg-pin"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {/* Design login.js:19 — eye SVG inline, no width/height (CSS sets 19×19),
                  stroke-width=1.8 (NOT 1.6 like the generic Icon set). */}
              <button type="button" id="lg-eye" title={t('showPassword')} onClick={() => setShowPw((v) => !v)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
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

          <div className="lg-row">
            <label className="lg-remember">
              <input type="checkbox" id="lg-remember" defaultChecked />
              <span>{t('remember')}</span>
            </label>
            <button
              id="lg-forgot"
              type="button"
              onClick={async () => {
                if (!email) { setErr({ kind: 'err', text: t('missingEmail') }); return; }
                try {
                  const r = await api<{ code: string; tokenIssued: boolean; mailDelivered: boolean }>('/auth/password/reset-request', {
                    method: 'POST',
                    body: { email, businessSlug },
                  });
                  // Always show success — backend deliberately doesn't
                  // leak whether the email exists. mailDelivered=false
                  // when no mail provider is configured; in that case
                  // an admin must check server logs for the reset link.
                  setErr({
                    kind: 'info',
                    text: r.mailDelivered ? t('resetLinkSent') : t('resetLinkNoMail'),
                  });
                } catch {
                  // Even hard failures shouldn't leak. Show the generic
                  // success message so the form behaves identically.
                  setErr({ kind: 'info', text: t('resetLinkSent') });
                }
              }}
            >
              {t('forgot')}
            </button>
          </div>

          {/* Design login.js:24 — .lg-err is always present in DOM; the `hidden`
              attribute toggles visibility so the surrounding margin stays. */}
          <div
            className={`lg-err ${err?.kind === 'info' ? 'info' : ''}`}
            id="lg-err"
            role={err?.kind === 'info' ? 'status' : 'alert'}
            aria-live={err?.kind === 'info' ? 'polite' : 'assertive'}
            hidden={!err}
          >
            {err?.text ?? ''}
          </div>

          {/* Design login.js:25 — arrow SVG inline, no width/height (CSS sets
              18×18 in pos.css:623), stroke-width=2 (NOT 1.6 like generic Icons). */}
          <button className={`lg-submit${busy ? ' btn-loading' : ''}`} id="lg-go" type="submit" disabled={busy}>
            {busy ? <span className="lg-spin" /> : null}
            {busy ? t('signingIn') : t('signIn')}
            {!busy && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
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
