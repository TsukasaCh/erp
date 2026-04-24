'use client';
import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import { deleteRequest, fetcher, patchJSON, postJSON } from '@/lib/api';
import { getUser, hasPermission } from '@/lib/auth';

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  userCount?: number;
}

interface User {
  id: string;
  username: string;
  fullName: string | null;
  isSuperAdmin: boolean;
  active: boolean;
  role: { id: string; name: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface PermissionDef { code: string; label: string }

type Tab = 'users' | 'roles';

export default function UsersPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [allowed, setAllowed] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    const u = getUser();
    setAllowed(!!u && (u.isSuperAdmin || hasPermission('users:manage')));
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!allowed) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-red-50 border border-red-200 rounded p-6 text-sm text-red-700">
        Akses ditolak. Anda tidak memiliki izin <code>users:manage</code>.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users &amp; Roles</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola user aplikasi dan role beserta izinnya.</p>
        </div>
        <div className="flex bg-white border border-slate-200 rounded overflow-hidden">
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'users' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setTab('roles')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'roles' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Roles
          </button>
        </div>
      </header>

      {tab === 'users' ? <UsersTab /> : <RolesTab />}
    </div>
  );
}

/* ---------------- Users tab ---------------- */

function UsersTab() {
  const { data: users, mutate } = useSWR<User[]>('/api/users', fetcher);
  const { data: roles } = useSWR<Role[]>('/api/roles', fetcher);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setAdding(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded px-4 py-2"
        >
          + Tambah User
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Username</th>
              <th className="text-left px-4 py-3">Nama</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Last Login</th>
              <th className="text-right px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {!users && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Memuat…</td></tr>
            )}
            {users?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Belum ada user.</td></tr>
            )}
            {users?.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3 text-slate-600">{u.fullName ?? '—'}</td>
                <td className="px-4 py-3">
                  {u.isSuperAdmin ? (
                    <span className="inline-flex items-center text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">
                      Super Admin
                    </span>
                  ) : u.role ? (
                    <span className="inline-flex items-center text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded px-2 py-0.5">
                      {u.role.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.active ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" /> Nonaktif
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('id-ID') : '—'}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => setEditing(u)}
                    className="text-xs text-teal-700 hover:underline"
                  >
                    Edit
                  </button>
                  {!u.isSuperAdmin && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Hapus user "${u.username}"?`)) return;
                        try {
                          await deleteRequest(`/api/users/${u.id}`);
                          mutate();
                        } catch (e) {
                          alert(`Gagal: ${(e as Error).message}`);
                        }
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Hapus
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <UserFormModal
          roles={roles ?? []}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); mutate(); }}
        />
      )}
      {editing && (
        <UserFormModal
          user={editing}
          roles={roles ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); mutate(); }}
        />
      )}
    </section>
  );
}

function UserFormModal({
  user, roles, onClose, onSaved,
}: {
  user?: User;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [username, setUsername] = useState(user?.username ?? '');
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<string>(user?.role?.id ?? '');
  const [active, setActive] = useState<boolean>(user?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isEdit) {
        const body: Record<string, unknown> = {
          fullName: fullName || null,
          roleId: roleId || null,
          active,
        };
        if (password) body.password = password;
        await patchJSON(`/api/users/${user!.id}`, body);
      } else {
        if (password.length < 6) throw new Error('Password minimal 6 karakter.');
        await postJSON('/api/users', {
          username: username.trim(),
          password,
          fullName: fullName || null,
          roleId: roleId || null,
        });
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? `Edit user: ${user!.username}` : 'Tambah user'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isEdit}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
          />
        </Field>
        <Field label="Nama lengkap">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </Field>
        <Field label={isEdit ? 'Password baru (kosongkan jika tidak diubah)' : 'Password (min. 6 karakter)'}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!isEdit}
            minLength={isEdit ? 0 : 6}
            autoComplete="new-password"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Role">
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
          >
            <option value="">— Tidak ada role —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </Field>
        {isEdit && !user!.isSuperAdmin && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            User aktif
          </label>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-slate-900 text-white rounded hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Roles tab ---------------- */

function RolesTab() {
  const { data: roles, mutate } = useSWR<Role[]>('/api/roles', fetcher);
  const { data: perms } = useSWR<PermissionDef[]>('/api/roles/permissions', fetcher);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setAdding(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded px-4 py-2"
        >
          + Tambah Role
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!roles && (
          <div className="text-slate-400 text-sm">Memuat…</div>
        )}
        {roles?.map((r) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">{r.name}</div>
                {r.description && (
                  <div className="text-xs text-slate-500 mt-0.5">{r.description}</div>
                )}
                <div className="text-[11px] text-slate-400 mt-1">
                  {r.userCount ?? 0} user · {r.permissions.length} izin
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEditing(r)}
                  className="text-xs text-teal-700 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Hapus role "${r.name}"?`)) return;
                    try {
                      await deleteRequest(`/api/roles/${r.id}`);
                      mutate();
                    } catch (e) {
                      alert(`Gagal: ${(e as Error).message}`);
                    }
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Hapus
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.permissions.length === 0 ? (
                <span className="text-[11px] text-slate-400 italic">Tidak ada izin.</span>
              ) : (
                r.permissions.map((p) => (
                  <span
                    key={p}
                    className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 rounded px-2 py-0.5"
                  >
                    {p}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <RoleFormModal
          perms={perms ?? []}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); mutate(); }}
        />
      )}
      {editing && (
        <RoleFormModal
          role={editing}
          perms={perms ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); mutate(); }}
        />
      )}
    </section>
  );
}

function RoleFormModal({
  role, perms, onClose, onSaved,
}: {
  role?: Role;
  perms: PermissionDef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!role;
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(role?.permissions ?? []),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description || null,
        permissions: Array.from(selected),
      };
      if (isEdit) {
        await patchJSON(`/api/roles/${role!.id}`, body);
      } else {
        await postJSON('/api/roles', body);
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? `Edit role: ${role!.name}` : 'Tambah role'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nama role">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Deskripsi">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </Field>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-600 mb-2">Izin</div>
          <div className="border border-slate-200 rounded divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {perms.length === 0 && (
              <div className="text-sm text-slate-400 px-3 py-2">Memuat izin…</div>
            )}
            {perms.map((p) => {
              const checked = selected.has(p.code);
              return (
                <label
                  key={p.code}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.code)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-800">{p.label}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{p.code}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-slate-900 text-white rounded hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- shared primitives ---------------- */

function Modal({
  children, onClose, title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
