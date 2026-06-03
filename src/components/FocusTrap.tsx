'use client';

import { ReactNode, useEffect, useRef } from 'react';

interface FocusTrapProps {
  /** True when the trap is mounted/active. */
  active: boolean;
  /** Called on Escape — typically closes the modal. */
  onEscape?: () => void;
  children: ReactNode;
}

/**
 * Keyboard focus trap for our `.modal` content. Saves the previously-focused
 * element on mount, focuses the first focusable inside on mount, cycles Tab
 * within the container, and restores focus on unmount.
 *
 * pos-web only ever renders one modal at a time and the scrim is
 * `position:fixed inset:0`, so background interaction is already blocked
 * visually. We do NOT polyfill the `inert` attribute on background content.
 */
export default function FocusTrap({ active, onEscape, children }: FocusTrapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreToRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    restoreToRef.current = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        ref.current!.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    const list = focusables();
    list[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreToRef.current?.focus();
    };
  }, [active, onEscape]);

  return <div ref={ref}>{children}</div>;
}
