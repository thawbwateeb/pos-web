'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';

/* Design app.js:1599-1612 / 1673-1687 — Stores:
   - .set-sec h2 'Stores' + ssub 'Manage every branch — switch the active
     store from the top bar'.
   - .set-card padding:0 overflow:hidden:
     - Custom header: <b 14px>${n} stores</b> + .btn.btn-pri '+ Add Store'.
     - table.tbl thead 6 cols: Store / Area / Phone / Hours / Status / (action).
     - Row: .t-name + optional .pill.paid 'Active' / area / .mono phone /
       storeHoursCell (.hrs-cell with .hrs-now open|shut + .hrs-sub) /
       .pill.paid|muted Open|Closed / Edit + View + Delete.
   - Modal (app.js:1369-1407): per-day hours editor (.hrs-edit-row: full day
     name, .hr-pill Open/Closed toggle, two <input type=time>, live #s-status
     .hrs-now badge, 'Copy Monday to all days' .hrs-copy), read-only
     .hrs-week list in View mode, and an 'Open for business' active toggle. */

/* Per-day opening-hours model — same shape HoursForm uses against the API
   (day key + open flag + [open,close] slots). Persisted on the store's
   `hours` field via the existing /stores update endpoint. */
const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
type DayKey = (typeof DAY_KEYS)[number];
type Slot = [string, string];
interface DayHours { day: DayKey; open: boolean; slots: Slot[] }

interface Store {
  id: string;
  name: string;
  area?: string | null;
  address?: string | null;
  phone?: string | null;
  trn?: string | null;
  hours?: DayHours[] | string | null;
  active: boolean;
}

function defaultStoreHours(): DayHours[] {
  return DAY_KEYS.map((day) => ({ day, open: true, slots: [['08:00', '22:00'] as Slot] }));
}

/* The `hours` field was historically free text; coerce anything that isn't a
   valid structured array to sensible defaults so the editor always works. */
function normalizeHours(hours: Store['hours']): DayHours[] {
  const byDay: Record<string, DayHours> = {};
  if (Array.isArray(hours)) {
    for (const h of hours) {
      if (h && typeof h === 'object' && DAY_KEYS.includes(h.day)) {
        byDay[h.day] = {
          day: h.day,
          open: !!h.open,
          slots: Array.isArray(h.slots) && h.slots.length
            ? h.slots.map((s) => [s[0] ?? '08:00', s[1] ?? '22:00'] as Slot)
            : [['08:00', '22:00']],
        };
      }
    }
  }
  return DAY_KEYS.map((d) => byDay[d] ?? { day: d, open: true, slots: [['08:00', '22:00']] });
}

// ---- 12-hour formatting + live open/closed status (mirrors design) ----
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
function hr12(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return { ap, txt: m ? `${h12}:${String(m).padStart(2, '0')}` : `${h12}` };
}
const fmtHr = (t: string) => { const x = hr12(t); return `${x.txt} ${x.ap}`; };
function fmtRange(o: string, c: string) {
  const a = hr12(o); const b = hr12(c);
  return `${a.ap === b.ap ? a.txt : `${a.txt} ${a.ap}`}–${b.txt} ${b.ap}`;
}
function dayText(d: DayHours | undefined, closedLabel: string) {
  return d && d.open && d.slots.length ? d.slots.map((s) => fmtRange(s[0], s[1])).join(', ') : closedLabel;
}
const todayIdx = () => (new Date().getDay() + 6) % 7;

interface StatusLabels {
  opens: (time: string) => string;
  opensWhen: (time: string, when: string) => string;
  closes: (time: string) => string;
  closed: string;
  tomorrow: string;
}
function storeStatus(H: DayHours[], dayShort: (k: DayKey) => string, L: StatusLabels) {
  const di = todayIdx();
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const d = H[di];
  if (d && d.open) {
    for (const sl of d.slots) {
      if (cur >= toMin(sl[0]) && cur < toMin(sl[1])) return { open: true, label: L.closes(fmtHr(sl[1])) };
    }
    const next = d.slots.find((sl) => cur < toMin(sl[0]));
    if (next) return { open: false, label: L.opens(fmtHr(next[0])) };
  }
  for (let k = 1; k <= 7; k++) {
    const j = (di + k) % 7;
    const dd = H[j];
    if (dd && dd.open && dd.slots.length) {
      const when = k === 1 ? L.tomorrow : dayShort(DAY_KEYS[j]);
      return { open: false, label: L.opensWhen(fmtHr(dd.slots[0][0]), when) };
    }
  }
  return { open: false, label: L.closed };
}

export default function StoresSettings({ initial, activeStoreId }: { initial: Store[]; activeStoreId: string }) {
  const t = useTranslations('Settings.stores');
  const [stores, setStores] = useState<Store[]>(initial);
  const [editing, setEditing] = useState<Store | null>(null);
  const [viewing, setViewing] = useState<Store | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Store | null>(null);
  const toast = useToast();

  // Re-sync from the server prop on store switch / router.refresh.
  useEffect(() => { setStores(initial); }, [initial]);

  async function reload() {
    setStores(await api<Store[]>('/stores'));
  }

  async function doDelete(store: Store) {
    await api(`/stores/${store.id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    reload();
    toast.show(t('deleted'));
  }

  return (
    <>
      <div className="set-sec">
        <h2>Stores</h2>
        <div className="ssub">Manage every branch — switch the active store from the top bar</div>
      </div>

      <div className="set-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <b style={{ fontSize: 14 }}>{stores.length} stores</b>
          <button
            className="btn btn-pri"
            id="store-add"
            style={{ padding: '9px 14px' }}
            onClick={() => setAdding(true)}
          >
            + Add Store
          </button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Store</th>
              <th>Area</th>
              <th>Phone</th>
              <th>Hours</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s, i) => (
              <tr key={s.id}>
                <td className="t-name">
                  {s.name}
                  {s.id === activeStoreId && (
                    <span className="pill paid" style={{ marginLeft: 4 }}>Active</span>
                  )}
                </td>
                <td>{s.area ?? '—'}</td>
                <td className="mono" style={{ fontSize: 12 }}>{s.phone ?? '—'}</td>
                <td><StoreHoursCell hours={s.hours} /></td>
                <td>
                  <span className={`pill ${s.active ? 'paid' : 'muted'}`}>
                    {s.active ? 'Open' : 'Closed'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="t-btn" data-storeedit={i} onClick={() => setEditing(s)}>Edit</button>{' '}
                  <button className="t-btn" data-storeview={i} onClick={() => setViewing(s)}>View</button>{' '}
                  <button
                    className="t-btn"
                    data-storedel={i}
                    style={{ color: 'var(--danger)' }}
                    onClick={() => setConfirmDelete(s)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {stores.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--muted)', fontSize: 13, padding: 16 }}>
                  No stores yet — add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(adding || editing) && (
        <StoreForm
          initial={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { reload(); setAdding(false); setEditing(null); }}
        />
      )}
      {viewing && <StoreViewModal store={viewing} isActive={viewing.id === activeStoreId} onClose={() => setViewing(null)} />}
      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} title="Remove store?">
            <div className="modal-body">
              <p style={{ padding: '8px 12px', color: 'var(--muted)' }}>
                Delete <b>{confirmDelete.name}</b>? Orders attached to this store will remain but won't have a current location.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-pri" style={{ flex: 1 }} onClick={() => doDelete(confirmDelete)}>Delete</button>
            </div>
        </Modal>
      )}
    </>
  );
}

// ---- shared status-label hook (translated) ----
function useStatusLabels() {
  const t = useTranslations('Settings.stores');
  const labels: StatusLabels = {
    opens: (time) => t('status.opens', { time }),
    opensWhen: (time, when) => t('status.opensWhen', { time, when }),
    closes: (time) => t('status.closes', { time }),
    closed: t('status.closed'),
    tomorrow: t('status.tomorrow'),
  };
  return labels;
}

// ---- store list "Hours" column ----
function StoreHoursCell({ hours }: { hours: Store['hours'] }) {
  const t = useTranslations('Settings.stores');
  const dShort = useTranslations('DayOfWeekShort');
  const labels = useStatusLabels();
  const H = useMemo(() => normalizeHours(hours), [hours]);
  const st = storeStatus(H, (k) => dShort(k), labels);
  const today = H[todayIdx()];
  return (
    <div className="hrs-cell">
      <span className={`hrs-now ${st.open ? 'open' : 'shut'}`}>{st.open ? t('open') : t('closed')}</span>
      <span className="hrs-sub">{st.label} · {dayText(today, t('closedAllDay'))}</span>
    </div>
  );
}

function StoreViewModal({ store, isActive, onClose }: { store: Store; isActive: boolean; onClose: () => void }) {
  const t = useTranslations('Settings.stores');
  const dFull = useTranslations('DayOfWeek');
  const H = useMemo(() => normalizeHours(store.hours), [store.hours]);
  const di = todayIdx();
  return (
    <Modal
      open
      onClose={onClose}
      title={<>{store.name}{isActive && <span className="pill paid" style={{ marginLeft: 8 }}>Active</span>}</>}
    >
        <div className="modal-body">
          <div className="odl-meta" style={{ flexWrap: 'wrap' }}>
            <span><b>{t('fields.area')}:</b> {store.area ?? '—'}</span>
            <span>·</span>
            <span><b>{t('fields.phone')}:</b> {store.phone ?? '—'}</span>
            <span>·</span>
            <span><b>{t('fields.trn')}:</b> {store.trn ?? '—'}</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'grid', gap: 10, fontSize: 13 }}>
            <div><span style={{ color: 'var(--muted)' }}>{t('fields.address')}: </span>{store.address ?? '—'}</div>
            <div className="field hrs-field" style={{ marginBottom: 0 }}>
              <label>{t('openingHours')}</label>
              <div className="hrs-week">
                {H.map((d, i) => (
                  <div key={d.day} className={`hrs-row ${i === di ? 'today' : ''}`}>
                    <span className="hd">{dFull(d.day)}</span>
                    <span className="ht">{dayText(d, t('closedAllDay'))}</span>
                  </div>
                ))}
              </div>
            </div>
            <div><span style={{ color: 'var(--muted)' }}>{t('fields.status')}: </span>{store.active ? t('open') : t('closed')}</div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-pri" style={{ flex: 1 }} onClick={onClose}>Close</button>
        </div>
    </Modal>
  );
}

function StoreForm({ initial, onClose, onSaved }: { initial: Store | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('Settings.stores');
  const dFull = useTranslations('DayOfWeek');
  const dShort = useTranslations('DayOfWeekShort');
  const labels = useStatusLabels();
  const isEdit = !!initial;
  const [f, setF] = useState({
    name: initial?.name ?? '',
    area: initial?.area ?? '',
    address: initial?.address ?? '',
    phone: initial?.phone ?? '',
    trn: initial?.trn ?? '',
  });
  const [hours, setHours] = useState<DayHours[]>(() => (initial ? normalizeHours(initial.hours) : defaultStoreHours()));
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const st = storeStatus(hours, (k) => dShort(k), labels);

  function toggleDay(idx: number) {
    setHours((cur) => cur.map((r, i) => {
      if (i !== idx) return r;
      const open = !r.open;
      return { ...r, open, slots: open && r.slots.length === 0 ? [['08:00', '22:00']] : r.slots };
    }));
  }
  function updateSlot(idx: number, k: 0 | 1, val: string) {
    setHours((cur) => cur.map((r, i) => {
      if (i !== idx) return r;
      const first: Slot = [...(r.slots[0] ?? ['08:00', '22:00'])] as Slot;
      first[k] = val;
      return { ...r, slots: [first, ...r.slots.slice(1)] };
    }));
  }
  function copyMondayToAll() {
    setHours((cur) => {
      const m = cur[0];
      return cur.map((r) => ({ ...r, open: m.open, slots: m.slots.map((s) => [...s] as Slot) }));
    });
    toast.show(t('copiedMonday'));
  }

  async function save() {
    if (!f.name.trim()) return toast.show(t('nameRequired'));
    setBusy(true);
    try {
      const body = { ...f, name: f.name.trim(), hours, active };
      if (isEdit && initial) await api(`/stores/${initial.id}`, { method: 'PATCH', body });
      else await api('/stores', { method: 'POST', body });
      onSaved();
      toast.show(t('saved'));
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? t('editModalTitle') : t('addModalTitle')}>
        <div className="modal-body">
          <div className="field"><label>{t('fields.name')}</label><input className="input" value={f.name} placeholder={t('namePlaceholder')} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field-2">
            <div className="field"><label>{t('fields.area')}</label><input className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></div>
            <div className="field"><label>{t('fields.phone')}</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div className="field"><label>{t('fields.address')}</label><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div className="field"><label>{t('fields.trn')}</label><input className="input" value={f.trn} onChange={(e) => setF({ ...f, trn: e.target.value })} /></div>

          <div className="field hrs-field">
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {t('openingHours')}
              <span className={`hrs-now ${st.open ? 'open' : 'shut'}`} id="s-status">
                {st.open ? t('open') : t('closed')} · {st.label}
              </span>
            </label>
            <div id="s-hours">
              {hours.map((d, i) => (
                <div key={d.day} className="hrs-edit-row">
                  <span className="hd">{dFull(d.day)}</span>
                  <button
                    type="button"
                    className={`hr-pill ${d.open ? 'on' : ''}`}
                    data-sh-open={i}
                    onClick={() => toggleDay(i)}
                  >
                    {d.open ? t('open') : t('closed')}
                  </button>
                  <div className="hrs-times">
                    {d.open ? (
                      <>
                        <input
                          type="time"
                          className="input time"
                          value={d.slots[0]?.[0] ?? '08:00'}
                          data-sh-time={`${i}.0`}
                          onChange={(e) => updateSlot(i, 0, e.target.value)}
                        />
                        <span className="muted">–</span>
                        <input
                          type="time"
                          className="input time"
                          value={d.slots[0]?.[1] ?? '22:00'}
                          data-sh-time={`${i}.1`}
                          onChange={(e) => updateSlot(i, 1, e.target.value)}
                        />
                      </>
                    ) : (
                      <span className="muted" style={{ fontSize: 13 }}>{t('closedAllDay')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="hrs-copy" id="s-hours-copy" onClick={copyMondayToAll}>
              {t('copyMondayToAll')}
            </button>
          </div>

          <div className="set-row" style={{ border: 'none', padding: '6px 0 0' }}>
            <div className="l">
              <b>{t('openForBusiness')}</b>
              <span>{t('openForBusinessSub')}</span>
            </div>
            <div className="r">
              <button
                type="button"
                className={`switch ${active ? 'on' : ''}`}
                id="s-active"
                aria-pressed={active}
                onClick={() => setActive((v) => !v)}
              />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} id="s-save" style={{ flex: 2 }} onClick={save}>
            {isEdit ? t('saveChanges') : t('addStore')}
          </button>
        </div>
    </Modal>
  );
}
