'use client';

import { ReactNode, useId } from 'react';
import FocusTrap from './FocusTrap';
import { useTranslations } from 'next-intl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Extra class on the inner `.modal` (e.g. width modifiers like "wide"). */
  className?: string;
}

/** Accessible dialog: scrim + FocusTrap + role="dialog" + labelled title + named close. */
export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  const t = useTranslations('Common');
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="modal-scrim show" onClick={onClose}>
      <FocusTrap active onEscape={onClose}>
        <div
          className={`modal${className ? ' ' + className : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-head">
            <h3 id={titleId}>{title}</h3>
            <button className="x" aria-label={t('close')} onClick={onClose}>×</button>
          </div>
          {children}
        </div>
      </FocusTrap>
    </div>
  );
}
