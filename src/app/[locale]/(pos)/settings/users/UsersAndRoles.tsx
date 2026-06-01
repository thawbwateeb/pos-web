'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
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
  const toast = useToast();

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

  async function addRole() {
    const name = prompt('Role name (e.g. Supervisor)');
    if (!name) return;
    await api('/roles', { method: 'POST', body: { name } });
    reloadAll();
    toast.show(`Role "${name}" created`);
  }

  async function delRole(role: Role) {
    if (role.isSystemManager) return;
    const usersUsing = users.filter((u) => u.role.id === role.id).length;
    if (usersUsing > 0) {
      if (!confirm(`${usersUsing} user(s) use this role. Reassign to "${roles.find((r) => !r.isSystemManager && r.id !== role.id)?.name}" and delete?`)) return;
      const reassignTo = roles.find((r) => !r.isSystemManager && r.id !== role.id)?.id;
      await api(`/roles/${role.id}`, { method: 'DELETE', body: { reassignTo } });
    } else {
      if (!confirm(`Delete role "${role.name}"?`)) return;
      await api(`/roles/${role.id}`, { method: 'DELETE' });
    }
    reloadAll();
  }

  return (
    <div className="set-sec" style={{ maxWidth: 1100 }}>
      <h2>Users & Roles</h2>
      <p className="ssub">Create staff accounts, assign a role, and choose which stores each can access.</p>

      <div className="set-card">
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><h3 style={{ margin: 0 }}>Users</h3></div>
          <button className="btn btn-pri btn-sm" onClick={() => setAdding(true)}>+ Add user</button>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Stores</th><th>Status</th><th className="num">Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const granted = u.userStores.map((us) => us.storeId);
              const all = stores.length === granted.length;
              return (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td className="muted">{u.email}</td>
                  <td>
                    <select className="input" style={{ width: 130, padding: '6px 10px' }} value={u.role.id}
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
                  <td><span className={`switch${u.active ? ' on' : ''}`} role="button" onClick={async () => { await api(`/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }); reloadAll(); }} /></td>
                  <td className="num">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={async () => { if (confirm(`Remove ${u.fullName}?`)) { await api(`/users/${u.id}`, { method: 'DELETE' }); reloadAll(); } }}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="set-card fin">
        <div className="ch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>Roles & permissions</h3>
            <div className="csub" style={{ marginTop: 2 }}>Create roles and choose what each can do. Manager always has full access.</div>
          </div>
          <button className="btn btn-pri btn-sm" onClick={addRole}>+ Add role</button>
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
                      <button className="perm-del" onClick={() => delRole(r)} title="Delete role">×</button>
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
                        disabled={r.isSystemManager}
                        onClick={() => togglePerm(r, a.key, !allowed)}
                      >
                        {allowed ? '✓' : '×'}
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
    </div>
  );
}

function UserModal({ stores, roles, editing, onClose, onSaved }: { users: UserRow[]; stores: Store[]; roles: Role[]; editing: UserRow | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editing;
  const [f, setF] = useState({
    fullName: editing?.fullName ?? '',
    email: editing?.email ?? '',
    roleId: editing?.role.id ?? roles[0]?.id ?? '',
    password: '',
    storeIds: editing?.userStores.map((us) => us.storeId) ?? [],
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function toggleStore(id: string) {
    setF((cur) => ({
      ...cur,
      storeIds: cur.storeIds.includes(id) ? cur.storeIds.filter((s) => s !== id) : [...cur.storeIds, id],
    }));
  }

  async function save() {
    if (!f.fullName || !f.email) return toast.show('Name and email required');
    if (!isEdit && !f.password) return toast.show('Password required');
    if (f.storeIds.length === 0) return toast.show('Select at least one store');
    setBusy(true);
    try {
      if (isEdit) {
        await api(`/users/${editing!.id}`, { method: 'PATCH', body: { fullName: f.fullName, email: f.email, roleId: f.roleId, storeIds: f.storeIds, ...(f.password ? { password: f.password } : {}) } });
      } else {
        await api('/users', { method: 'POST', body: f });
      }
      onSaved();
    } catch (e: any) {
      toast.show(e?.detail?.message || 'Failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-scrim show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{isEdit ? 'Edit user' : 'Add user'}</h3><button className="x" onClick={onClose}>×</button></div>
        <div className="modal-body fin">
          <div className="field"><label>Full name</label><input className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
          <div className="field"><label>Email</label><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="field"><label>Password{isEdit ? ' (leave blank to keep)' : ''}</label><input type="password" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <div className="field"><label>Role</label>
            <select className="input" value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value })}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Store access ({f.storeIds.length}/{stores.length})</label>
            <div className="store-access">
              {stores.map((s) => (
                <label key={s.id} className="sa-row">
                  <input type="checkbox" checked={f.storeIds.includes(s.id)} onChange={() => toggleStore(s.id)} />
                  <div className="sa-nm">{s.name}<em>{s.area ?? s.address ?? ''}</em></div>
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
      </div>
    </div>
  );
}
