'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import FocusTrap from '@/components/FocusTrap';

/**
 * Polygon vertices are stored as `[[x, y], ...]` in the design's normalized
 * coordinate space (x: 0..100, y: 0..71 — matches the SVG viewBox the legacy
 * app uses). Storing percentages keeps the shape resolution-independent.
 */
export type ZonePoint = [number, number];

export interface Zone {
  id: string;
  name: string;
  color: string | null;
  polygon: ZonePoint[] | unknown;
  baseFee: number | string;
  capacity: number;
  active: boolean;
}

const VB_W = 100;
const VB_H = 71;
// Design app.js:184 — ZONE_PAL, same order; first entry is the default new-zone colour.
const ZONE_PALETTE = ['#2A4858', '#16A34A', '#D97706', '#DC2626', '#0EA5E9', '#8FA88B'];

function asPoints(p: unknown): ZonePoint[] {
  if (!Array.isArray(p)) return [];
  return p
    .filter((v): v is ZonePoint => Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number')
    .map(([x, y]) => [x, y] as ZonePoint);
}

function toFee(v: number | string): number {
  return typeof v === 'string' ? parseFloat(v) || 0 : v;
}

export default function ZonesScreen({ initial }: { initial: Zone[] }) {
  const [rows, setRows] = useState<Zone[]>(initial);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [viewing, setViewing] = useState<Zone | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const tz = useTranslations('Zones');

  // Re-sync from the server prop on store switch / router.refresh.
  useEffect(() => { setRows(initial); }, [initial]);

  async function reload() {
    setRows(await api<Zone[]>('/delivery-zones'));
  }

  async function remove(z: Zone) {
    if (!(await confirm({ title: tz('deleteTitle'), message: tz('deleteConfirm', { name: z.name }), danger: true }))) return;
    await api(`/delivery-zones/${z.id}`, { method: 'DELETE' });
    toast.show('Zone deleted');
    reload();
  }

  /* Design app.js:1374-1387 — Service Zones:
     - .set-sec max-width:none > .page-head h2 'Service Zones' + sub
       '\${n} zone\${s} · used by the mobile app to restrict ordering to your
       coverage' + .actions '+ New Zone' (data-zonenew).
     - .card > table.tbl with 5 cols: (color swatch) / Zone / Points /
       Preview / (action).
     - Row: 14px color swatch / .t-name name / '\${n} points' /
       <svg> polygon thumbnail / .r flex/gap:8/justify-end with View
       (data-zoneview), Edit (data-zoneedit), Delete (data-zdel). */
  return (
    <div className="set-sec" style={{ maxWidth: 'none' }}>
      <div className="page-head">
        <div className="ph-l">
          <h2>Service Zones</h2>
          <span className="sub">
            {rows.length} zone{rows.length !== 1 ? 's' : ''} · used by the mobile app to restrict ordering to your coverage
          </span>
        </div>
        <div className="actions">
          <button className="btn btn-pri" data-zonenew onClick={() => setAdding(true)}>+ New Zone</button>
        </div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th></th>
              <th>Zone</th>
              <th>Points</th>
              <th>Preview</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ color: 'var(--muted)', fontSize: 13, padding: 16 }}>No zones yet — create one.</td></tr>
            )}
            {rows.map((z, i) => {
              const pts = asPoints(z.polygon);
              const color = z.color || ZONE_PALETTE[0];
              return (
                <tr key={z.id}>
                  <td>
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: color, display: 'inline-block', verticalAlign: 'middle' }} />
                  </td>
                  <td className="t-name">{z.name}</td>
                  <td>{pts.length} points</td>
                  <td><ZoneThumbnail points={pts} color={color} /></td>
                  <td>
                    <div className="r" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="t-btn ghost" data-zoneview={i} onClick={() => setViewing(z)}>View</button>
                      <button className="t-btn ghost" data-zoneedit={i} onClick={() => setEditing(z)}>Edit</button>
                      <button className="t-btn ghost" data-zdel={i} onClick={() => remove(z)}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {viewing && (
        <ZoneForm
          initial={viewing}
          existingCount={rows.length}
          view
          onClose={() => setViewing(null)}
          onSaved={() => setViewing(null)}
        />
      )}
      {(adding || editing) && (
        <ZoneForm
          initial={editing}
          existingCount={rows.length}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            toast.show('Zone saved');
            reload();
          }}
        />
      )}
    </div>
  );
}

function ZoneThumbnail({ points, color }: { points: ZonePoint[]; color: string }) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      style={{ width: 84, height: 42, border: '1px solid var(--border)', borderRadius: 6, background: '#eef1f4' }}
    >
      {points.length >= 3 && (
        <polygon
          points={points.map((p) => p.join(',')).join(' ')}
          fill={color}
          fillOpacity={0.2}
          stroke={color}
          strokeWidth={1}
        />
      )}
    </svg>
  );
}

interface ZoneFormProps {
  initial: Zone | null;
  existingCount: number;
  view?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function ZoneForm({ initial, existingCount, view = false, onClose, onSaved }: ZoneFormProps) {
  const t = useTranslations('Settings.zones');
  const tCommon = useTranslations('Common');
  const titleId = useId();
  const isEdit = !!initial && !view;
  const defaultColor = initial?.color || ZONE_PALETTE[existingCount % ZONE_PALETTE.length];
  const [name, setName] = useState<string>(initial?.name ?? '');
  const [color, setColor] = useState<string>(defaultColor);
  const [baseFee, setBaseFee] = useState<number>(initial ? toFee(initial.baseFee) : 0);
  const [capacity, setCapacity] = useState<number>(initial?.capacity ?? 0);
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [points, setPoints] = useState<ZonePoint[]>(initial ? asPoints(initial.polygon) : []);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    if (!name.trim()) return toast.show('Zone name is required');
    if (points.length < 3) return toast.show('Add at least 3 boundary points');
    setBusy(true);
    try {
      const body = { name: name.trim(), color, polygon: points, baseFee, capacity, active };
      if (isEdit && initial) {
        await api(`/delivery-zones/${initial.id}`, { method: 'PATCH', body });
      } else {
        await api('/delivery-zones', { method: 'POST', body });
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <FocusTrap active onEscape={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-head">
          <h3 id={titleId}>{view ? t('viewTitle') : isEdit ? t('editTitle') : t('newTitle')}</h3>
          <button className="x" aria-label={tCommon('close')} onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {view ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
              <b style={{ color: 'var(--text)' }}>{name}</b> · {t('pointsCount', { n: points.length })}
            </div>
          ) : (
            <>
              <div className="field">
                <label>{t('nameLabel')}</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  autoFocus
                />
              </div>
              <div className="field-2">
                <div className="field">
                  <label>{t('baseFeeLabel')}</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={0.5}
                    value={baseFee}
                    onChange={(e) => setBaseFee(+e.target.value || 0)}
                  />
                </div>
                <div className="field">
                  <label>{t('capacityLabel')}</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={1}
                    value={capacity}
                    onChange={(e) => setCapacity(+e.target.value || 0)}
                  />
                </div>
              </div>
              <div className="field-2">
                <div className="field">
                  <label>{t('colourLabel')}</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ZONE_PALETTE.map((c) => (
                      <button
                        type="button"
                        key={c}
                        aria-label={t('useColour', { color: c })}
                        onClick={() => setColor(c)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: c,
                          border: c === color ? '2px solid var(--text)' : '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label id="zone-active-label">{tCommon('active')}</label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    aria-labelledby="zone-active-label"
                    className={`switch${active ? ' on' : ''}`}
                    onClick={() => setActive((a) => !a)}
                  />
                </div>
              </div>
            </>
          )}
          <div className="field" style={{ marginTop: view ? 0 : 8 }}>
            {!view && <label>{t('drawLabel')}</label>}
            <PolygonEditor points={points} setPoints={setPoints} color={color} readOnly={view} />
            {!view && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t('drawHint')}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPoints([])}>{t('clearPolygon')}</button>
              </div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          {view ? (
            <button className="btn btn-pri" style={{ flex: 1 }} onClick={onClose}>{tCommon('close')}</button>
          ) : (
            <>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{tCommon('cancel')}</button>
              <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={save}>
                {isEdit ? t('saveZone') : t('createZone')}
              </button>
            </>
          )}
        </div>
      </div>
      </FocusTrap>
    </div>
  );
}

interface PolygonEditorProps {
  points: ZonePoint[];
  setPoints: (next: ZonePoint[] | ((prev: ZonePoint[]) => ZonePoint[])) => void;
  color: string;
  readOnly?: boolean;
}

function PolygonEditor({ points, setPoints, color, readOnly = false }: PolygonEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  function clientToViewBox(clientX: number, clientY: number): ZonePoint {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VB_W;
    const y = ((clientY - rect.top) / rect.height) * VB_H;
    const clampedX = Math.max(0, Math.min(VB_W, x));
    const clampedY = Math.max(0, Math.min(VB_H, y));
    return [+clampedX.toFixed(1), +clampedY.toFixed(1)];
  }

  function onCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    // Ignore the click that ends a drag — onMouseUp clears dragIdx, but the
    // click event still fires on the SVG. We avoid adding a stray vertex by
    // checking the target: clicks on a circle bubble up but originate from
    // the vertex, not the empty canvas.
    if ((e.target as Element).tagName === 'circle') return;
    const pt = clientToViewBox(e.clientX, e.clientY);
    setPoints((prev) => [...prev, pt]);
  }

  function onVertexMouseDown(idx: number, e: React.MouseEvent) {
    e.stopPropagation();
    setDragIdx(idx);
  }

  useEffect(() => {
    if (dragIdx == null) return;
    function onMove(ev: MouseEvent) {
      const pt = clientToViewBox(ev.clientX, ev.clientY);
      setPoints((prev) => prev.map((p, i) => (i === dragIdx ? pt : p)));
    }
    function onUp() {
      setDragIdx(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragIdx]);

  const gridBg = 'linear-gradient(var(--border-2) 1px, transparent 1px), linear-gradient(90deg, var(--border-2) 1px, transparent 1px)';
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${VB_W} / ${VB_H}`,
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#eef1f4',
        backgroundImage: gridBg,
        backgroundSize: '26px 26px',
        cursor: readOnly ? 'default' : dragIdx == null ? 'crosshair' : 'grabbing',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        onClick={readOnly ? undefined : onCanvasClick}
      >
        {points.length >= 3 && (
          <polygon
            points={points.map((p) => p.join(',')).join(' ')}
            fill={color}
            fillOpacity={0.18}
            stroke={color}
            strokeWidth={0.6}
            pointerEvents="none"
          />
        )}
        {points.length === 2 && (
          <line
            x1={points[0][0]}
            y1={points[0][1]}
            x2={points[1][0]}
            y2={points[1][1]}
            stroke={color}
            strokeWidth={0.6}
            pointerEvents="none"
          />
        )}
        {points.map((p, i) =>
          readOnly ? (
            <circle key={i} cx={p[0]} cy={p[1]} r={0.9} fill={color} pointerEvents="none" />
          ) : (
            <circle
              key={i}
              cx={p[0]}
              cy={p[1]}
              r={1.4}
              fill={color}
              stroke="#fff"
              strokeWidth={0.4}
              style={{ cursor: 'grab' }}
              onMouseDown={(e) => onVertexMouseDown(i, e)}
            />
          ),
        )}
      </svg>
    </div>
  );
}
