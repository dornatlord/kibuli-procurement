import { useState, FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { roleLabel, roleBadgeClass, ROLE_DESCRIPTIONS, Role } from "../lib/permissions";

export default function AccountPage() {
  const { user, refresh } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("The new passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: current,
        newPassword: next,
      });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="page-title">My Account</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <Row label="Name" value={user?.name ?? "—"} />
        <Row label="Email" value={user?.email ?? "—"} />
        <Row label="Department" value={user?.department || "—"} />
        <div className="flex justify-between items-start text-sm">
          <span className="text-gray-500">Access Level</span>
          <div className="text-right max-w-xs">
            <span
              className={`text-xs px-2 py-0.5 rounded border ${roleBadgeClass(
                user?.role
              )}`}
            >
              {roleLabel(user?.role)}
            </span>
            <p className="text-xs text-gray-400 mt-1 leading-snug">
              {ROLE_DESCRIPTIONS[user?.role as Role]}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-sm mb-1">Change Password</h2>
        {user?.mustChangePassword && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            Your password was set by the administrator. Please choose your own now.
          </p>
        )}
        {done && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
            Password changed successfully.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="input"
              required
              minLength={8}
            />
            <p className="text-xs text-gray-400 mt-1">At least 8 characters.</p>
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
              required
              minLength={8}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? "Saving…" : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );
}
