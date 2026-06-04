'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { AED } from '@/lib/format';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { useTranslations } from 'next-intl';

/* Design app.js:1520-1535 — Gift Cards section.
   - .set-sec > h2 'Gift Cards' + .ssub 'Sell and redeem store gift cards'
   - .set-card:
     - Enable gift cards (sub: 'Sell gift cards at the POS') + switch
       data-tog='giftcards.enabled'
     - Preset denominations (AED) (sub 'Comma-separated values') + input
       id='gc-denoms' width:200
     - Allow custom amount + switch data-tog='giftcards.custom'
     - Last row border:none: Validity + select id='gc-exp' options
       '12 months' / '24 months' / 'No expiry'
   - .set-card (single .set-row border:none padding:0):
     'Check gift card balance' (sub 'Enter a card number to look up its
     balance') + input id='gc-num' placeholder='GC-XXXX-XXXX' width:160 +
     .t-btn[data-gccheck] 'Check'
   - .set-card padding:0 overflow:hidden:
     header flex justify-between padding:14 16: <b>Issued gift cards</b> +
     .btn.btn-pri[data-issuegc] '+ Issue Gift Card' padding:9 14
     table.tbl rows: .t-id code / to / .t-amt AED(balance) + ' / AED(amount)'
     11px muted / .pill.paid|muted Active|Used
   - Save 'Save Gift Card Settings' (data-save) */

const VALIDITY_OPTIONS = ['12 months', '24 months', 'No expiry'] as const;

function monthsToValidity(m?: number): string {
  if (m == null || m === 0) return 'No expiry';
  if (m === 12) return '12 months';
  return '24 months';
}
function validityToMonths(v: string): number {
  if (v === 'No expiry') return 0;
  if (v === '12 months') return 12;
  return 24;
}

export default function GiftCardsScreen({ settings, initialCards }: { settings: any; initialCards: any[] }) {
  const src = settings ?? {};
  const [enabled, setEnabled] = useState<boolean>(src.enabled ?? true);
  const [denoms, setDenoms] = useState<string>(src.denoms ?? '50, 100, 200, 500');
  const [customAllowed, setCustomAllowed] = useState<boolean>(src.customAllowed ?? true);
  const [validity, setValidity] = useState<string>(monthsToValidity(src.expiryMonths));
  const [checkNum, setCheckNum] = useState<string>('');
  const [cards, setCards] = useState<any[]>(initialCards);
  const [busy, setBusy] = useState(false);
  const [issuing, setIssuing] = useState<{ amount: number } | null>(null);
  const toast = useToast();

  async function reload() {
    setCards(await api<any[]>('/gift-cards'));
  }

  async function save() {
    setBusy(true);
    try {
      await api('/gift-cards/settings', {
        method: 'PATCH',
        body: {
          enabled,
          denoms,
          customAllowed,
          expiryMonths: validityToMonths(validity),
        },
      });
      toast.show('Saved');
    } finally {
      setBusy(false);
    }
  }

  async function checkBalance() {
    const code = checkNum.trim();
    if (!code) return;
    try {
      const r = await api<any>(`/gift-cards/${encodeURIComponent(code)}`);
      toast.show(`${code}: ${AED(r.balance ?? 0)} balance`);
    } catch {
      toast.show('Card not found');
    }
  }

  function issueCard() {
    // Amount + recipient are both collected in the styled modal (no native prompts).
    const first = denoms.split(',').map((s) => Number(s.trim())).find((n) => n > 0) ?? 0;
    setIssuing({ amount: first });
  }

  async function confirmIssue(amount: number, recipientName: string) {
    if (!amount) return;
    await api('/gift-cards', { method: 'POST', body: { amount, recipientName } });
    setIssuing(null);
    reload();
    toast.show('Gift card issued');
  }

  return (
    <div className="set-sec">
      <h2>Gift Cards</h2>
      <div className="ssub">Sell and redeem store gift cards</div>

      <div className="set-card">
        <div className="set-row">
          <div className="l"><b id="gc-enabled-label">Enable gift cards</b><span>Sell gift cards at the POS</span></div>
          <div className="r">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-labelledby="gc-enabled-label"
              className={`switch${enabled ? ' on' : ''}`}
              data-tog="giftcards.enabled"
              onClick={() => setEnabled(!enabled)}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="l"><b>Preset denominations (AED)</b><span>Comma-separated values</span></div>
          <div className="r">
            <input className="input" id="gc-denoms" style={{ width: 200 }} value={denoms} onChange={(e) => setDenoms(e.target.value)} />
          </div>
        </div>
        <div className="set-row">
          <div className="l"><b id="gc-custom-label">Allow custom amount</b></div>
          <div className="r">
            <button
              type="button"
              role="switch"
              aria-checked={customAllowed}
              aria-labelledby="gc-custom-label"
              className={`switch${customAllowed ? ' on' : ''}`}
              data-tog="giftcards.custom"
              onClick={() => setCustomAllowed(!customAllowed)}
            />
          </div>
        </div>
        <div className="set-row" style={{ border: 'none' }}>
          <div className="l"><b>Validity</b></div>
          <div className="r">
            <select className="input" id="gc-exp" value={validity} onChange={(e) => setValidity(e.target.value)}>
              {VALIDITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="set-card">
        <div className="set-row" style={{ border: 'none', padding: 0 }}>
          <div className="l"><b>Check gift card balance</b><span>Enter a card number to look up its balance</span></div>
          <div className="r">
            <input className="input" id="gc-num" placeholder="GC-XXXX-XXXX" style={{ width: 160 }} value={checkNum} onChange={(e) => setCheckNum(e.target.value)} />
            <button className="t-btn" data-gccheck onClick={checkBalance} style={{ marginInlineStart: 8 }}>Check</button>
          </div>
        </div>
      </div>

      <div className="set-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <b style={{ fontSize: 14 }}>Issued gift cards</b>
          <button className="btn btn-pri" data-issuegc style={{ padding: '9px 14px' }} onClick={issueCard}>+ Issue Gift Card</button>
        </div>
        <table className="tbl">
          <tbody>
            {cards.map((g) => (
              <tr key={g.id}>
                <td className="t-id">{g.code}</td>
                <td>{g.recipientName || g.to || ''}</td>
                <td className="t-amt">
                  {AED(g.balance ?? 0)}{' '}
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>/ {AED(g.initialAmount ?? g.amount ?? 0)}</span>
                </td>
                <td>
                  <span className={`pill ${g.active ? 'paid' : 'muted'}`}>
                    {g.active ? 'Active' : 'Used'}
                  </span>
                </td>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr><td style={{ color: 'var(--muted)', fontSize: 13, padding: '14px 16px' }}>No gift cards issued yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} data-save onClick={save} disabled={busy}>
          Save Gift Card Settings
        </button>
      </div>

      {issuing && (
        <IssueGiftCardModal
          amount={issuing.amount}
          onClose={() => setIssuing(null)}
          onConfirm={confirmIssue}
        />
      )}
    </div>
  );
}

function IssueGiftCardModal({
  amount: initialAmount,
  onClose,
  onConfirm,
}: {
  amount: number;
  onClose: () => void;
  onConfirm: (amount: number, recipientName: string) => void | Promise<void>;
}) {
  const t = useTranslations('Settings.giftCards');
  const tCommon = useTranslations('Common');
  const [amount, setAmount] = useState(initialAmount || 0);
  const [recipientName, setRecipientName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!amount) return;
    setBusy(true);
    try {
      await onConfirm(Number(amount), recipientName.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t('issue')}>
      <div className="modal-body">
        <div className="field" style={{ marginBottom: 12 }}>
          <label>{t('amountPrompt')}</label>
          <input
            className="input"
            type="number"
            min={1}
            autoFocus
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
        </div>
        <div className="field">
          <label>{t('recipientPrompt')}</label>
          <input
            className="input"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose} disabled={busy}>
          {tCommon('cancel')}
        </button>
        <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={submit} disabled={busy}>
          {t('issue')}
        </button>
      </div>
    </Modal>
  );
}
