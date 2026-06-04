'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import Modal from './Modal';

type Field = { key: string; label: string; required?: boolean; type?: 'text' | 'number' | 'select'; options?: string[] };
type Column = { key: string; label: string; align?: 'right' | 'left'; render?: (row: any) => React.ReactNode };

/**
 * Tiny CRUD-list component used for the simple settings tables (areas,
 * drivers, etc.). Shows a table + add/edit modal driven by a fields[]
 * schema, hitting REST endpoints `{endpoint}` and `{endpoint}/:id`.
 */
export default function GenericCRUDList({
  endpoint, initial, columns, fields, title, labelSingular,
}: {
  endpoint: string; initial: any[]; columns: Column[]; fields: Field[];
  title: string; labelSingular: string;
}) {
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const t = useTranslations('Crud');
  const tc = useTranslations('Common');

  // Re-sync from the server prop on store switch / router.refresh.
  useEffect(() => { setRows(initial); }, [initial]);

  async function reload() { setRows(await api<any[]>(endpoint)); }

  async function save(payload: any) {
    if (editing) await api(`${endpoint}/${editing.id}`, { method: 'PATCH', body: payload });
    else await api(endpoint, { method: 'POST', body: payload });
    setAdding(false); setEditing(null);
    reload();
    toast.show(tc('saved'));
  }

  async function remove(id: string) {
    if (!(await confirm({ title: t('deleteTitle'), message: t('deleteConfirm', { item: labelSingular }), danger: true }))) return;
    await api(`${endpoint}/${id}`, { method: 'DELETE' });
    reload();
    toast.show(tc('deleted'));
  }

  return (
    <div className="set-card">
      <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button className="btn btn-pri btn-sm" onClick={() => setAdding(true)}>+ {tc('add')}</button>
      </div>
      <table className="tbl">
        <thead><tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.label}</th>)}<th className="num"></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.render ? c.render(r) : String(r[c.key] ?? '—')}</td>
              ))}
              <td className="num">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(r)}>{tc('edit')}</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => remove(r.id)}>{tc('delete')}</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>{t('noneYet', { item: labelSingular })}</td></tr>}
        </tbody>
      </table>
      {(adding || editing) && <EditModal fields={fields} initial={editing} onSave={save} onClose={() => { setAdding(false); setEditing(null); }} title={editing ? t('editTitle', { item: labelSingular }) : t('addTitle', { item: labelSingular })} />}
    </div>
  );
}

function EditModal({ fields, initial, onSave, onClose, title }: { fields: Field[]; initial: any | null; onSave: (payload: any) => void; onClose: () => void; title: string }) {
  const [form, setForm] = useState<any>(() =>
    Object.fromEntries(fields.map((f) => [f.key, initial?.[f.key] ?? (f.type === 'number' ? 0 : '')])),
  );
  const toast = useToast();
  const tc = useTranslations('Common');
  const [busy, setBusy] = useState(false);

  async function submit() {
    for (const f of fields) {
      if (f.required && !form[f.key]) return toast.show(`${f.label} is required`);
    }
    setBusy(true);
    try { await onSave(form); } catch (e: any) { toast.show(e?.detail?.message || tc('failed')); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={title}>
        <div className="modal-body">
          {fields.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}{f.required ? ' *' : ''}</label>
              {f.type === 'select' ? (
                <select className="input" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                  <option value="">—</option>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input className="input" type={f.type === 'number' ? 'number' : 'text'} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tc('cancel')}</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={submit}>{tc('save')}</button>
        </div>
    </Modal>
  );
}
