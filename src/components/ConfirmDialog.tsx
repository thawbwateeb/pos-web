'use client';
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import Modal from './Modal';
import { useTranslations } from 'next-intl';

type Opts = { title: string; message: string; danger?: boolean; confirmLabel?: string };
const Ctx = createContext<(o: Opts) => Promise<boolean>>(() => Promise.resolve(false));

export function ConfirmHost({ children }: { children: ReactNode }) {
  const t = useTranslations('Common');
  const [opts, setOpts] = useState<Opts | null>(null);
  const resolver = useRef<(v: boolean) => void>();
  const confirm = useCallback((o: Opts) => new Promise<boolean>((res) => { resolver.current = res; setOpts(o); }), []);
  const close = (v: boolean) => { resolver.current?.(v); setOpts(null); };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && (
        <Modal open onClose={() => close(false)} title={opts.title}>
          <div className="modal-body"><p>{opts.message}</p></div>
          <div className="modal-foot">
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close(false)}>{t('cancel')}</button>
            <button className={`btn ${opts.danger ? 'btn-danger' : 'btn-pri'}`} style={{ flex: 2 }} onClick={() => close(true)}>{opts.confirmLabel ?? t('confirm')}</button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}
export function useConfirm() { return useContext(Ctx); }
