import { useEffect, useState, FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate, Link } from "react-router-dom";
import { ListSkeleton } from "../components/Loading";

interface Supplier {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tinNumber: string | null;
  registrationNumber: string | null;
  category: string | null;
  providerCategory: string;
  ownerNames: string | null;
  targetGroup: string | null;
  isPrequalified: boolean;
  isActive: boolean;
  notes: string | null;
}

const EMPTY_FORM = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  tinNumber: "",
  registrationNumber: "",
  category: "supplies",
  providerCategory: "national",
  ownerNames: "",
  targetGroup: "",
  isPrequalified: false,
  notes: "",
};

export default function SuppliersPage() {
  const { can } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  if (!can("suppliers.view")) return <Navigate to="/dashboard" replace />;
  const canManage = can("suppliers.manage");

  function load() {
    setLoading(true);
    api
      .get<Supplier[]>(`/suppliers?includeInactive=${showInactive}`)
      .then(setSuppliers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [showInactive]);

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/suppliers", form);
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add supplier");
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
      await api.patch(`/suppliers/${editing.id}`, editing);
      setEditing(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update supplier");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Supplier) {
    if (!confirm(`${s.isActive ? "Deactivate" : "Reactivate"} ${s.name}?`)) return;
    try {
      await api.patch(`/suppliers/${s.id}/status`, { isActive: !s.isActive });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">
            The provider register — used when issuing purchase orders and contracts.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setShowForm(true);
              setError("");
            }}
            className="btn btn-primary"
          >
            + Add Supplier
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4">New Supplier</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Supplier Name *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="input" required />
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">TIN Number</label>
              <input value={form.tinNumber} onChange={(e) => setForm((p) => ({ ...p, tinNumber: e.target.value }))} className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Category</label>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="input">
                <option value="supplies">Supplies</option>
                <option value="works">Works</option>
                <option value="non_consultancy">Non-Consultancy Services</option>
              </select>
            </div>
            <div>
              <label className="label">Provider Category</label>
              <select value={form.providerCategory} onChange={(e) => setForm((p) => ({ ...p, providerCategory: e.target.value }))} className="input">
                <option value="national">National</option>
                <option value="foreign">Foreign</option>
                <option value="resident">Resident</option>
                <option value="eac">EAC</option>
              </select>
            </div>
            <div>
              <label className="label">Target Group (if applicable)</label>
              <input value={form.targetGroup} onChange={(e) => setForm((p) => ({ ...p, targetGroup: e.target.value }))} className="input" placeholder="Women / Youth / PWD" />
            </div>
            <div>
              <label className="label flex items-center gap-2 mt-2">
                <input type="checkbox" checked={form.isPrequalified} onChange={(e) => setForm((p) => ({ ...p, isPrequalified: e.target.checked }))} className="rounded" />
                Prequalified
              </label>
            </div>
            <div className="col-span-2">
              <label className="label">Beneficial Ownership (Names)</label>
              <input value={form.ownerNames} onChange={(e) => setForm((p) => ({ ...p, ownerNames: e.target.value }))} className="input" />
            </div>
            <div className="col-span-2 flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Saving…" : "Add Supplier"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Edit {editing.name}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="label">Contact Person</label>
                <input value={editing.contactPerson ?? ""} onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Email</label>
                <input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">TIN Number</label>
                <input value={editing.tinNumber ?? ""} onChange={(e) => setEditing({ ...editing, tinNumber: e.target.value })} className="input" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex gap-3 items-center">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search suppliers…" className="input max-w-xs" />
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show deactivated
        </label>
        <div className="ml-auto text-sm text-gray-400">{filtered.length} suppliers</div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">No suppliers yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Contact</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">Prequalified</th>
                {canManage && <th className="px-4 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50 ${!s.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2 font-medium">
                    {s.name}
                    {!s.isActive && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">inactive</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {s.contactPerson || "—"} {s.phone && <span className="text-gray-400">· {s.phone}</span>}
                  </td>
                  <td className="px-4 py-2 capitalize text-xs">{s.category?.replace("_", " ") || "—"}</td>
                  <td className="px-4 py-2 capitalize text-xs">{s.providerCategory}</td>
                  <td className="px-4 py-2 text-xs">{s.isPrequalified ? "Yes" : "No"}</td>
                  {canManage && (
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(s)} className="text-xs text-green-700 hover:underline mr-3">Edit</button>
                      <button onClick={() => toggleActive(s)} className={`text-xs hover:underline ${s.isActive ? "text-red-600" : "text-green-700"}`}>
                        {s.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
