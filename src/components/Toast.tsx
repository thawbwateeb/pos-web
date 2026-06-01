'use client';

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

interface ToastCtx { show: (msg: string) => void }
const Ctx = createContext<ToastCtx | null>(null);

export function ToastHost({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const t = useRef<any>();
  const show = useCallback((m: string) => {
    setMsg(m);
    setOpen(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setOpen(false), 2200);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className={`toast${open ? ' show' : ''}`}>{msg}</div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx) ?? { show: () => {} };
}
