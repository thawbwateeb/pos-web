'use client';

import { useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { initials } from '@/lib/format';
import type { PermissionAction, Role, Store, UserRow } from '@/lib/types';

const ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: 'TAKE_ORDERS', label: 'Take new orders' },
  { key: 'EDIT_ORDERS', label: 'Edit orders & status' },
  { key: 'REFUND', label: 'Issue refunds' },
  { key: 'PAYMENTS', label: 'Take payments' },
  { key: 'CASH_DRAWER', label: 'Open cash drawer & end-of-day' },
  { key: 'VIEW_REPORTS', label: 'View reports' },
  { key: 'VIEW_FINANCE', label: 'View finance' },
  { key: 'MANAGE_CATALOG', label: 'Manage catalogue' },
  { key: 'MANAGE_PROMOS', label: 'Manage promos' },
  { key: 'WHATSAPP', label: 'Use WhatsApp inbox' },
  { key: 'MANAGE_STAFF', label: 'Manage staff & permissions' },
  { key: 'SETTINGS', label: 'Edit settings' },
];

export default function UsersAndRoles({ initialUsers, initialRoles, stores }: { initialUsers: UserRow[]; initialRoles: Role[]; stores: Store[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [roles, setRoles] = useState(initialRoles);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingRole, setAddingRole] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const t = useTranslations('Settings.users');
  const toast = useToast();

  // Re-sync from the server props on store switch / router.refresh.
  useEffect(() => { setUsers(initialUsers); }, [initialUsers]);
  useEffect(() => { setRoles(initialRoles); }, [initialRoles]);

  function reloadAll() {
    Promise.all([api<UserRow[]>('/users'), api<Role[]>('/roles')]).then(([u, r]) => { setUsers(u); setRoles(r); });
  }

  async function togglePerm(role: Role, action: PermissionAction, allowed: boolean) {
    if (role.isSystemManager) return;
    await api(`/roles/${role.id}/permissions`, {
      method: 'PATCH',
      body: { permissions: [{ action, allowed }] },
    });
    setRoles((rs) => rs.map((r) => r.id !== role.id ? r : { ...r, permissions: r.permissions.map((p) => p.action === action ? { ...p, allowed } : p) }));
  }

  async function createRole(name: string) {
    if (roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      toast.show('That role already exists');
      return;
    }
    await api('/roles', { method: 'POST', body: { name } });
    setAddingRole(false);
    reloadAll();
    toast.show(`Role "${name}" created`);
  }

  async function confirmDeleteUser() {
    if (!deletingUser) return;
    await api(`/users/${deletingUser.id}`, { method: 'DELETE' });
    setDeletingUser(null);
    reloadAll();
    toast.show('User removed');
  }

  async function confirmDeleteRole() {
    if (!deletingRole) return;
    const usersUsing = users.filter((u) => u.role.id === deletingRole.id).length;
    if (usersUsing > 0) {
      const reassignTo = roles.find((r) => !r.isSystemManager && r.id !== deletingRole.id)?.id;
      await api(`/roles/${deletingRole.id}`, { method: 'DELETE', body: { reassignTo } });
    } else {
      await api(`/roles/${deletingRole.id}`, { method: 'DELETE' });
    }
    setDeletingRole(null);
    reloadAll();
    toast.show('Role removed');
  }

  /* Design ops.js:217-248 — renderRoles:
     - .fin wrapper, NO outer h2/ssub.
     - .card.flush Users card with .ch h3 'Users' + csub
       'Create staff accounts, assign a role, and choose which stores each
       can access' + .btn.btn-pri.btn-sm '+ Add user' id='usr-add'.
       Row Status uses .pill.ok|mut 'Active'|'Disabled'. Actions: Edit
       (data-uedit), Enable/Disable (data-utog), Delete (data-udel).
     - .card.flush Roles & permissions with .ch h3 + csub
       'Create roles and choose what each can do. Manager always has full
       access.' + .btn.btn-pri.btn-sm '+ Add role' id='role-add'.
       Permission cells auto-save on click (togglePerm → PATCH
       /roles/:id/permissions); no separate save button. */
  return (
    <div className="fin">
      <div className="card flush" style={{ marginBottom: 16 }}>
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>Users</h3>
            <div className="csub" style={{ margin: '2px 0 0' }}>
              Create staff accounts, assign a role, and choose which stores each can access
            </div>
          </div>
          <button className="btn btn-pri btn-sm" id="usr-add" onClick={() => setAdding(true)}>+ Add user</button>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Stores</th><th>Status</th><th className="num">Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const granted = u.userStores.map((us) => us.storeId);
              const all = stores.length === granted.length;
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        className="odl-av"
                        style={{ width: 32, height: 32, fontSize: 12 }}
                      >
                        {initials(u.fullName)}
                      </span>
                      <b>{u.fullName}</b>
                    </div>
                  </td>
                  <td className="muted">{u.email}</td>
                  <td>
                    <select
                      className="inp"
                      style={{ width: 130, padding: '6px 10px' }}
                      data-urole={i}
                      value={u.role.id}
                      onChange={async (e) => {
                        await api(`/users/${u.id}`, { method: 'PATCH', body: { roleId: e.target.value } });
                        reloadAll();
                      }}
                    >
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="usr-store-tags">
                      {all ? <span className="st-tag all">All stores</span>
                        : granted.length === 0 ? <span className="st-tag none">No access</span>
                        : granted.map((sid) => <span key={sid} className="st-tag">{stores.find((s) => s.id === sid)?.name ?? sid}</span>)}
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${u.active ? 'ok' : 'mut'}`}>
                      {u.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="num">
                    <button className="btn btn-ghost btn-sm" data-uedit={i} onClick={() => setEditing(u)}>Edit</button>{' '}
                    <button
                      className="btn btn-ghost btn-sm"
                      data-utog={i}
                      onClick={async () => { await api(`/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }); reloadAll(); }}
                    >
                      {u.active ? 'Disable' : 'Enable'}
                    </button>{' '}
                    <button className="btn btn-ghost btn-sm" data-udel={i} onClick={() => setDeletingUser(u)}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card flush">
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>Roles &amp; permissions</h3>
            <div className="csub" style={{ margin: '2px 0 0' }}>
              Create roles and choose what each can do. Manager always has full access.
            </div>
            <span className="muted" style={{ fontSize: 12 }}>{t('permsAutoSave')}</span>
          </div>
          <button className="btn btn-pri btn-sm" id="role-add" onClick={() => setAddingRole(true)}>+ Add role</button>
        </div>
        <table className="tbl perm-tbl">
          <thead>
            <tr>
              <th>Action</th>
              {roles.map((r) => (
                <th key={r.id} className="num">
                  <span className="perm-col">
                    {r.name}
                    {!r.isSystemManager && (
                      <button className="perm-del" data-roledel={r.name} onClick={() => setDeletingRole(r)} title="Delete role">×</button>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map((a) => (
              <tr key={a.key}>
                <td>{a.label}</td>
                {roles.map((r) => {
                  const allowed = r.isSystemManager || !!r.permissions.find((p) => p.action === a.key)?.allowed;
                  return (
                    <td key={r.id} className="num">
                      <button
                        className={`perm${allowed ? ' on' : ''}`}
                        data-perm={`${r.name}.${a.key.toLowerCase()}`}
                        disabled={r.isSystemManager}
                        onClick={() => togglePerm(r, a.key, !allowed)}
                        aria-label={allowed ? 'Allowed' : 'Denied'}
                      >
                        {allowed ? (
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12l5 5L20 6" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(adding || editing) && (
        <UserModal
          users={users}
          stores={stores}
          roles={roles}
          editing={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); reloadAll(); }}
        />
      )}

      {addingRole && <AddRoleModal onClose={() => setAddingRole(false)} onCreate={createRole} />}

      {deletingUser && (
        <ConfirmModal
          title="Remove user?"
          body={`Remove ${deletingUser.fullName} (${deletingUser.email})? They'll no longer be able to sign in.`}
          confirmLabel="Remove"
          onCancel={() => setDeletingUser(null)}
          onConfirm={confirmDeleteUser}
        />
      )}

      {deletingRole && (() => {
        const usersUsing = users.filter((u) => u.role.id === deletingRole.id).length;
        const fallback = roles.find((r) => !r.isSystemManager && r.id !== deletingRole.id);
        const body = usersUsing > 0
          ? `${usersUsing} user(s) currently assigned to "${deletingRole.name}" will be moved to "${fallback?.name ?? 'another role'}".`
          : `Delete role "${deletingRole.name}"?`;
        return (
          <ConfirmModal
            title="Delete role?"
            body={body}
            confirmLabel="Delete role"
            onCancel={() => setDeletingRole(null)}
            onConfirm={confirmDeleteRole}
          />
        );
      })()}
    </div>
  );
}

function AddRoleModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const t = useTranslations('Settings.users');
  const [name, setName] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
  }

  return (
    <Modal open onClose={onClose} title="Add role">
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="field">
              <label>Role name</label>
              <input ref={ref} className="input" placeholder={t('rolePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="note" style={{ marginTop: 7 }}>
              New roles start with no permissions. Toggle them on in the table below.
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-pri" style={{ flex: 2 }} disabled={!name.trim()}>Create role</button>
          </div>
        </form>
    </Modal>
  );
}

function ConfirmModal({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal open onClose={onCancel} title={title}>
        <div className="modal-body">
          <p style={{ padding: '8px 12px', fontSize: 14, color: 'var(--muted)' }}>{body}</p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-pri" style={{ flex: 1 }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
    </Modal>
  );
}

function UserModal({ stores, roles, editing, onClose, onSaved }: { users: UserRow[]; stores: Store[]; roles: Role[]; editing: UserRow | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('Settings.users');
  const isEdit = !!editing;
  const [f, setF] = useState({
    fullName: editing?.fullName ?? '',
    email: editing?.email ?? '',
    roleId: editing?.role.id ?? roles[0]?.id ?? '',
    password: '',
    storeIds: editing?.userStores.map((us) => us.storeId) ?? [],
  });
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => { nameRef.current?.focus(); }, []);

  function toggleStore(id: string) {
    setF((cur) => ({
      ...cur,
      storeIds: cur.storeIds.includes(id) ? cur.storeIds.filter((s) => s !== id) : [...cur.storeIds, id],
    }));
  }

  function toggleAllStores() {
    setF((cur) => ({
      ...cur,
      storeIds: cur.storeIds.length === stores.length ? [] : stores.map((s) => s.id),
    }));
  }

  async function save() {
    // Auto-generate email if blank (matches design ops.js:295).
    let email = f.email.trim();
    if (!email && f.fullName) {
      email = f.fullName.toLowerCase().replace(/\s+/g, '.') + '@thawbwateeb.com';
    }
    if (!f.fullName) return toast.show('Name required');
    if (!email) return toast.show('Email required');
    if (!isEdit && !f.password) return toast.show('Password required');
    if (f.storeIds.length === 0) return toast.show('Select at least one store');
    setBusy(true);
    try {
      if (isEdit) {
        await api(`/users/${editing!.id}`, { method: 'PATCH', body: { fullName: f.fullName, email, roleId: f.roleId, storeIds: f.storeIds, ...(f.password ? { password: f.password } : {}) } });
      } else {
        await api('/users', { method: 'POST', body: { ...f, email } });
      }
      onSaved();
    } catch (e: any) {
      toast.show(e?.detail?.message || 'Failed');
    } finally { setBusy(false); }
  }

  const allSelected = f.storeIds.length === stores.length && stores.length > 0;

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit user' : 'Add user'}>
        <div className="modal-body fin">
          <div className="field">
            <label>Full name</label>
            <input ref={nameRef} className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
          </div>
          <div className="field-2">
            <div className="field">
              <label>Email</label>
              <input type="email" className="input" placeholder={t('emailPlaceholder')} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div className="field">
              <label>{isEdit ? 'Reset password' : 'Password'}</label>
              <input
                type="text"
                className="input"
                placeholder={isEdit ? t('passwordKeepHint') : t('passwordSetHint')}
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Role</label>
            <select className="input" value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value })}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>Store access</label>
              <button type="button" className="t-btn ghost" onClick={toggleAllStores}>
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="store-access">
              {stores.map((s) => (
                <label key={s.id} className={`sa-row${s.active === false ? ' dis' : ''}`}>
                  <input type="checkbox" checked={f.storeIds.includes(s.id)} onChange={() => toggleStore(s.id)} />
                  <div className="sa-nm">{s.name}<em>{s.area ?? s.address ?? ''}{s.active === false ? ' · Closed' : ''}</em></div>
                </label>
              ))}
            </div>
            <div className="note" style={{ marginTop: 7 }}>This user can only sign into the branches selected here.</div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className={`btn btn-pri${busy ? ' btn-loading' : ''}`} style={{ flex: 2 }} onClick={save}>{isEdit ? 'Save changes' : 'Create user'}</button>
        </div>
    </Modal>
  );
}
