import { useEffect, useState, FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import {
  ROLE_ORDER,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  roleLabel,
  roleBadgeClass,
  Role,
} from "../lib/permissions";

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  department: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "user_dept_member" as Role,
  department: "",
};

export default function UsersAdminPage() {
  const { user: me, can } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  if (!can("users.view")) return <Navigate to="/dashboard" replace />;

  function load() {
    setLoading(true);
    api
      .get<User[]>("/users")
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/users", form);
      setShowForm(false);
      setForm(EMPTY_FORM);
      flash(`Account created for ${form.name}. They must change the password on first login.`);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    setSaving(true);
    try {
      await api.patch(`/users/${editing.id}`, {
        name: editing.name,
        role: editing.role,
        department: editing.department,
      });
      setEditing(null);
      flash("User updated.");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    const action = u.isActive ? "deactivate" : "reactivate";
    if (!confirm(`${u.isActive ? "Deactivate" : "Reactivate"} ${u.name}? ${u.isActive ? "They will be signed out and unable to log in." : "They will be able to log in again."}`))
      return;
    setError("");
    try {
      await api.patch(`/users/${u.id}/status`, { isActive: !u.isActive });
      flash(`${u.name} was ${action}d.`);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${action} user`);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    if (!resetting) return;
    const pwd = (e.target as HTMLFormElement).newPassword.value;
    setError("");
    setSaving(true);
    try {
      await api.post(`/users/${resetting.id}/reset-password`, { newPassword: pwd });
      setResetting(null);
      flash("Password reset. The user must change it at next login.");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSaving(false);
    }
  }

  const visible = showInactive ? users : users.filter((u) => u.isActive);
  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Users &amp; Roles</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount} active {activeCount === 1 ? "account" : "accounts"} of{" "}
            {users.length}. Each account&rsquo;s role decides what it can see and do.
          </p>
        </div>
        {can("users.create") && (
          <button
            onClick={() => {
              setShowForm(true);
              setError("");
            }}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800"
          >
            + Add User
          </button>
        )}
      </div>

      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-2 text-sm">
          {notice}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4">New User Account</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Temporary Password *</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="input font-mono"
                required
                minLength={8}
                placeholder="min 8 characters"
              />
              <p className="text-xs text-gray-400 mt-1">
                Share this with the user. They must change it at first login.
              </p>
            </div>
            <div>
              <label className="label">Department</label>
              <input
                value={form.department}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                className="input"
                placeholder="e.g. Mathematics"
              />
            </div>
            <div className="col-span-2">
              <label className="label">Access Level *</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {ROLE_ORDER.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, role: r }))}
                    className={`text-left border rounded-lg px-3 py-2 transition ${
                      form.role === r
                        ? "border-green-600 bg-green-50 ring-1 ring-green-600"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-xs font-semibold text-gray-800">
                      {ROLE_LABELS[r]}
                    </div>
                    <div className="text-[11px] text-gray-500 leading-snug mt-0.5">
                      {ROLE_DESCRIPTIONS[r]}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2 flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create Account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
                className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Department</label>
              <input
                value={editing.department ?? ""}
                onChange={(e) => setEditing({ ...editing, department: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Access Level</label>
              <select
                value={editing.role}
                onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                className="input"
              >
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {ROLE_DESCRIPTIONS[editing.role as Role]}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset password modal */}
      {resetting && (
        <Modal
          title={`Reset password — ${resetting.name}`}
          onClose={() => setResetting(null)}
        >
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="label">New Temporary Password</label>
              <input
                name="newPassword"
                type="text"
                className="input font-mono"
                required
                minLength={8}
                placeholder="min 8 characters"
              />
              <p className="text-xs text-gray-400 mt-1">
                Share it with {resetting.name}. They must change it at next login.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
              >
                {saving ? "Resetting…" : "Reset Password"}
              </button>
              <button
                type="button"
                onClick={() => setResetting(null)}
                className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* User table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <span className="text-xs text-gray-500 uppercase font-semibold">
            Accounts
          </span>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show deactivated
          </label>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No users.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Access Level</th>
                <th className="px-4 py-2 text-left">Department</th>
                <th className="px-4 py-2 text-left">Last Login</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((u) => (
                <tr
                  key={u.id}
                  className={`hover:bg-gray-50 ${!u.isActive ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-2 font-medium">
                    {u.name}
                    {u.id === me?.id && (
                      <span className="ml-2 text-xs text-gray-400">(you)</span>
                    )}
                    {!u.isActive && (
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                        deactivated
                      </span>
                    )}
                    {u.mustChangePassword && u.isActive && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                        must set password
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{u.email}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${roleBadgeClass(
                        u.role
                      )}`}
                    >
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{u.department || "—"}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString("en-UG")
                      : "never"}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {can("users.edit") && (
                      <button
                        onClick={() => setEditing(u)}
                        className="text-xs text-green-700 hover:underline mr-3"
                      >
                        Edit
                      </button>
                    )}
                    {can("users.reset_password") && (
                      <button
                        onClick={() => setResetting(u)}
                        className="text-xs text-blue-700 hover:underline mr-3"
                      >
                        Reset password
                      </button>
                    )}
                    {can("users.deactivate") && u.id !== me?.id && (
                      <button
                        onClick={() => toggleActive(u)}
                        className={`text-xs hover:underline ${
                          u.isActive ? "text-red-600" : "text-green-700"
                        }`}
                      >
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Role reference */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-sm mb-3">What each access level can do</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {ROLE_ORDER.map((r) => (
            <div key={r} className="flex gap-3">
              <span
                className={`h-fit text-xs px-2 py-0.5 rounded border shrink-0 ${roleBadgeClass(
                  r
                )}`}
              >
                {ROLE_LABELS[r]}
              </span>
              <span className="text-xs text-gray-500 leading-snug">
                {ROLE_DESCRIPTIONS[r]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
