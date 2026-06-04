'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';

/* Design app.js:1444-1487 — Pickup & Delivery settings.
   - .set-sec h2 'Pickup & Delivery' + .ssub 'Time slots, capacity, fees &
     scheduling rules' (section closes here, before the slot table).
   - .set-card Time slots: .pk-h <b>Time slots</b> + .btn.btn-pri.btn-sm
     '+ Add slot' id='pk-add'.
     table.tbl.pk-tbl thead: Slot / Type / Capacity (num) / Status (num) /
     (action). Each row: .t-id label / span.pk-kind.both|pickup|delivery /
     '{cap} orders' / switch[data-pkt=i] / Edit[data-pke=i] + ✕[data-pkd=i]
     flex/gap:6/justify-end.
   - .cols-2b margin-top:14 of two .set-card:
     - 'Scheduling rules' (7 .set-row with .setr-field inputs + unit chips).
     - 'Fees & charges' (5 .set-row, last two border:none with .data-pkflag
       switches for autoAssignDriver / notifyOnDispatch).
   - .set-card margin-top:14: 'Operating days' .ch + .pk-days with 7
     buttons data-pkday=Mon|...|Sun.
   - Save button id='pk-save' 'Save Pickup Settings'. */

type Kind = 'BOTH' | 'PICKUP' | 'DELIVERY';
const KIND_LABEL: Record<Kind, string> = {
  BOTH: 'Pickup + Delivery',
  PICKUP: 'Pickup only',
  DELIVERY: 'Delivery only',
};
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface Slot {
  id: string;
  label: string;
  capacity: number;
  kind: Kind;
  active: boolean;
}

interface Settings {
  defaultCap?: number;
  leadHours?: number;
  minGapNormalHrs?: number;
  minGapExpressHrs?: number;
  advanceDays?: number;
  sameDayCutoff?: string;
  deliveryFee?: number;
  freeOver?: number;
  minOrder?: number;
  slotBufferMins?: number;
  autoAssignDriver?: boolean;
  notifyOnDispatch?: boolean;
  daysEnabled?: Record<string, boolean>;
}

export default function PickupSettings({ initialSettings, initialSlots }: { initialSettings: any; initialSlots: any[] }) {
  const init = (initialSettings ?? {}) as Settings;
  const [s, setS] = useState<Settings>({
    defaultCap: init.defaultCap ?? 8,
    leadHours: init.leadHours ?? 2,
    minGapNormalHrs: init.minGapNormalHrs ?? 24,
    minGapExpressHrs: init.minGapExpressHrs ?? 12,
    advanceDays: init.advanceDays ?? 7,
    sameDayCutoff: init.sameDayCutoff ?? '14:00',
    deliveryFee: Number(init.deliveryFee ?? 15),
    freeOver: Number(init.freeOver ?? 50),
    minOrder: Number(init.minOrder ?? 0),
    slotBufferMins: init.slotBufferMins ?? 15,
    autoAssignDriver: init.autoAssignDriver ?? true,
    notifyOnDispatch: init.notifyOnDispatch ?? true,
    daysEnabled: (init.daysEnabled as Record<string, boolean>) ?? {},
  });
  const [slots, setSlots] = useState<Slot[]>(initialSlots as Slot[]);
  const [busy, setBusy] = useState(false);
  const [slotEdit, setSlotEdit] = useState<Slot | null>(null);
  const [slotAdd, setSlotAdd] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const tp = useTranslations('Pickup');
  const t = useTranslations('Settings.pickup');

  async function reloadSlots() { setSlots(await api<Slot[]>('/pickup/slots')); }

  async function toggleSlot(slot: Slot) {
    await api(`/pickup/slots/${slot.id}`, { method: 'PATCH', body: { active: !slot.active } });
    reloadSlots();
  }
  async function deleteSlot(slot: Slot) {
    if (!(await confirm({ title: tp('deleteSlotTitle'), message: tp('deleteSlotConfirm'), danger: true }))) return;
    await api(`/pickup/slots/${slot.id}`, { method: 'DELETE' });
    reloadSlots();
  }

  function toggleDay(d: string) {
    const cur = s.daysEnabled ?? {};
    setS({ ...s, daysEnabled: { ...cur, [d]: !cur[d] } });
  }

  async function save() {
    setBusy(true);
    try {
      await api('/pickup/settings', { method: 'PATCH', body: s });
      toast.show('Pickup settings saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="set-sec">
        <h2>Pickup &amp; Delivery</h2>
        <div className="ssub">Time slots, capacity, fees &amp; scheduling rules</div>
      </div>

      {/* Time slots */}
      <div className="set-card">
        <div className="pk-h">
          <b>Time slots</b>
          <button className="btn btn-pri btn-sm" id="pk-add" onClick={() => setSlotAdd(true)}>{t('addSlot')}</button>
        </div>
        <table className="tbl pk-tbl">
          <thead>
            <tr>
              <th>Slot</th>
              <th>Type</th>
              <th className="num">Capacity</th>
              <th className="num">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, i) => (
              <tr key={slot.id}>
                <td className="t-id">{slot.label}</td>
                <td>
                  <span className={`pk-kind ${slot.kind.toLowerCase()}`}>
                    {KIND_LABEL[slot.kind]}
                  </span>
                </td>
                <td className="num">{slot.capacity} orders</td>
                <td className="num">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={slot.active}
                    aria-label={`Toggle slot ${slot.label}`}
                    className={`switch ${slot.active ? 'on' : ''}`}
                    data-pkt={i}
                    onClick={() => toggleSlot(slot)}
                  />
                </td>
                <td className="num">
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="t-btn ghost" data-pke={i} onClick={() => setSlotEdit(slot)}>Edit</button>
                    <button className="t-btn ghost" data-pkd={i} onClick={() => deleteSlot(slot)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {slots.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 18, color: 'var(--muted)' }}>No slots configured yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Scheduling rules + Fees & charges */}
      <div className="cols-2b" style={{ marginTop: 14 }}>
        <div className="set-card">
          <div className="ch"><h3 style={{ margin: 0 }}>Scheduling rules</h3></div>
          <SchedRow label="Minimum lead time" sub="Earliest a slot can be booked" id="pk-lead" unit="hrs" value={s.leadHours ?? 0} onChange={(v) => setS({ ...s, leadHours: v })} />
          <SchedRow label="Pickup→delivery gap · standard" sub="Min hours between pickup & delivery" id="pk-gapn" unit="hrs" value={s.minGapNormalHrs ?? 0} onChange={(v) => setS({ ...s, minGapNormalHrs: v })} />
          <SchedRow label="Pickup→delivery gap · express" sub="Min hours for express orders" id="pk-gapx" unit="hrs" value={s.minGapExpressHrs ?? 0} onChange={(v) => setS({ ...s, minGapExpressHrs: v })} />
          <SchedRow label="Advance booking window" sub="How far ahead customers can book" id="pk-adv" unit="days" value={s.advanceDays ?? 0} onChange={(v) => setS({ ...s, advanceDays: v })} />
          <div className="set-row">
            <div className="l"><b>Same-day cutoff</b><span>Orders after this go next day</span></div>
            <div className="setr-field">
              <input className="inp sm" id="pk-cut" type="time" value={s.sameDayCutoff ?? '14:00'} onChange={(e) => setS({ ...s, sameDayCutoff: e.target.value })} />
            </div>
          </div>
          <SchedRow label="Default slot capacity" sub="For newly created slots" id="pk-dcap" unit="orders" value={s.defaultCap ?? 0} onChange={(v) => setS({ ...s, defaultCap: v })} />
          <SchedRow label="Buffer between stops" sub="Driver travel allowance" id="pk-buf" unit="min" value={s.slotBufferMins ?? 0} onChange={(v) => setS({ ...s, slotBufferMins: v })} />
        </div>
        <div className="set-card">
          <div className="ch"><h3 style={{ margin: 0 }}>Fees &amp; charges</h3></div>
          <FeeRow label="Delivery fee" sub="Standard pickup & delivery" id="pk-fee" value={s.deliveryFee ?? 0} onChange={(v) => setS({ ...s, deliveryFee: v })} />
          <FeeRow label="Free delivery over" sub="Waive fee above this total" id="pk-free" value={s.freeOver ?? 0} onChange={(v) => setS({ ...s, freeOver: v })} />
          <FeeRow label="Minimum order" sub="Below this, pickup unavailable" id="pk-min" value={s.minOrder ?? 0} onChange={(v) => setS({ ...s, minOrder: v })} />
          <div className="set-row" style={{ border: 'none' }}>
            <div className="l"><b id="pk-auto-assign-label">Auto-assign driver</b><span>Route by zone on dispatch</span></div>
            <button
              type="button"
              role="switch"
              aria-checked={s.autoAssignDriver ?? false}
              aria-labelledby="pk-auto-assign-label"
              className={`switch ${s.autoAssignDriver ? 'on' : ''}`}
              data-pkflag="autoAssignDriver"
              onClick={() => setS({ ...s, autoAssignDriver: !s.autoAssignDriver })}
            />
          </div>
          <div className="set-row" style={{ border: 'none', paddingTop: 0 }}>
            <div className="l"><b id="pk-notify-dispatch-label">Notify on dispatch</b><span>SMS customer with driver & ETA</span></div>
            <button
              type="button"
              role="switch"
              aria-checked={s.notifyOnDispatch ?? false}
              aria-labelledby="pk-notify-dispatch-label"
              className={`switch ${s.notifyOnDispatch ? 'on' : ''}`}
              data-pkflag="notifyOnDispatch"
              onClick={() => setS({ ...s, notifyOnDispatch: !s.notifyOnDispatch })}
            />
          </div>
        </div>
      </div>

      {/* Operating days */}
      <div className="set-card" style={{ marginTop: 14 }}>
        <div className="ch">
          <h3 style={{ margin: 0 }}>Operating days</h3>
          <div className="csub" style={{ margin: '2px 0 0' }}>Days pickup &amp; delivery runs</div>
        </div>
        <div className="pk-days">
          {DAYS.map((d) => (
            <button
              key={d}
              className={`pk-day ${s.daysEnabled?.[d] ? 'on' : ''}`}
              data-pkday={d}
              onClick={() => toggleDay(d)}
              type="button"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} id="pk-save" onClick={save} disabled={busy}>
          {t('saveSettings')}
        </button>
      </div>

      {(slotAdd || slotEdit) && (
        <SlotModal
          initial={slotEdit}
          defaultCap={s.defaultCap ?? 8}
          onClose={() => { setSlotAdd(false); setSlotEdit(null); }}
          onSaved={() => { setSlotAdd(false); setSlotEdit(null); reloadSlots(); toast.show('Slot saved'); }}
        />
      )}
    </>
  );
}

function SchedRow({ label, sub, id, unit, value, onChange }: { label: string; sub?: string; id: string; unit: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="set-row">
      <div className="l">
        <b>{label}</b>
        {sub && <span>{sub}</span>}
      </div>
      <div className="setr-field">
        <input className="inp sm" id={id} type="number" value={value} onChange={(e) => onChange(+e.target.value || 0)} />
        <span className="unit">{unit}</span>
      </div>
    </div>
  );
}

function FeeRow({ label, sub, id, value, onChange }: { label: string; sub?: string; id: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="set-row">
      <div className="l">
        <b>{label}</b>
        {sub && <span>{sub}</span>}
      </div>
      <div className="setr-field">
        <span className="unit">AED</span>
        <input className="inp sm" id={id} type="number" value={value} onChange={(e) => onChange(+e.target.value || 0)} />
      </div>
    </div>
  );
}

function SlotModal({ initial, defaultCap, onClose, onSaved }: { initial: Slot | null; defaultCap: number; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('Settings.pickup');
  const tc = useTranslations('Common');
  const [label, setLabel] = useState<string>(initial?.label ?? '');
  const [capacity, setCapacity] = useState<number>(initial?.capacity ?? defaultCap);
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'BOTH');
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit() {
    if (!label.trim()) { toast.show('Enter a slot label'); return; }
    setBusy(true);
    try {
      const body = { label, capacity, kind, active };
      if (initial) await api(`/pickup/slots/${initial.id}`, { method: 'PATCH', body });
      else await api('/pickup/slots', { method: 'POST', body });
      onSaved();
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={initial ? 'Edit slot' : 'New slot'}>
        <div className="modal-body">
          <div className="field"><label>Label</label><input className="input" placeholder={t('slotLabelPlaceholder')} value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div className="field-2">
            <div className="field"><label>Type</label>
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option value="BOTH">Pickup + Delivery</option>
                <option value="PICKUP">Pickup only</option>
                <option value="DELIVERY">Delivery only</option>
              </select>
            </div>
            <div className="field"><label>Capacity</label><input className="input" type="number" value={capacity} onChange={(e) => setCapacity(+e.target.value || 0)} /></div>
          </div>
          <div className="field"><label id="pk-slot-active-label">Active</label>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-labelledby="pk-slot-active-label"
              className={`switch ${active ? 'on' : ''}`}
              onClick={() => setActive(!active)}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={submit} disabled={busy}>{initial ? tc('save') : t('addSlotShort')}</button>
        </div>
    </Modal>
  );
}
