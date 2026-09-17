import { useEffect, useState, FormEvent, useMemo } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import { ListSkeleton } from "../components/Loading";

interface Asset {
  id: number;
  assetTag: string;
  name: string;
  category: string | null;
  quantity: string;
  unitOfMeasure: string | null;
  unitValue: string | null;
  totalValue: string | null;
  location: string | null;
  condition: string | null;
  isDisposed: boolean;
}

const EMPTY_FORM = {
  name: "",
  category: "",
  quantity: "1",
  unitOfMeasure: "",
  unitValue: "",
  location: "",
  condition: "new",
  acquisitionDate: "",
  acquisitionSource: "",
};

const CONDITION_TONE: Record<string, string> = {
  new: "bg-green-100 text-green-800",
  good: "bg-blue-100 text-blue-800",
  fair: "bg-amber-100 text-amber-800",
  poor: "bg-red-100 text-red-800",
  disposed: "bg-gray-100 text-gray-500",
};

export default function InventoryPage() {
  const { can } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!can("inventory.view")) return <Navigate to="/dashboard" replace />;
  const canManage = can("inventory.manage");

  function load() {
    setLoading(true);
    api.get<Asset[]>("/inventory").then(setAssets).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const filtered = assets.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));
  const totalValue = useMemo(() => filtered.reduce((s, a) => s + Number(a.totalValue || 0), 0), [filtered]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/inventory", form);
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add asset");
    } finally {
      setSaving(false);
    }
  }

  async function dispose(a: Asset) {
    const reason = prompt(`Reason for disposing "${a.name}"?`);
    if (reason === null) return;
    try {
      await api.patch(`/inventory/${a.id}/dispose`, { disposalReason: reason });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to dispose asset");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Inventory &amp; Assets</h1>
          <p className="text-sm text-gray-500 mt-1">Stock levels and the school asset register.</p>
        </div>
        {canManage && (
          <button onClick={() => { setShowForm(true); setError(""); }} className="btn btn-primary">
            + Add Asset
          </button>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4">New Asset</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Name *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="input" required />
            </div>
            <div>
              <label className="label">Category</label>
              <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="input" placeholder="Furniture, Electronics…" />
            </div>
            <div>
              <label className="label">Location</label>
              <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} className="input" placeholder="Which room / department" />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input type="number" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} className="input" min="0" />
            </div>
            <div>
              <label className="label">Unit of Measure</label>
              <input value={form.unitOfMeasure} onChange={(e) => setForm((p) => ({ ...p, unitOfMeasure: e.target.value }))} className="input" placeholder="pcs, sets…" />
            </div>
            <div>
              <label className="label">Unit Value (UGX)</label>
              <input type="number" value={form.unitValue} onChange={(e) => setForm((p) => ({ ...p, unitValue: e.target.value }))} className="input" min="0" />
            </div>
            <div>
              <label className="label">Condition</label>
              <select value={form.condition} onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))} className="input">
                <option value="new">New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="label">Acquisition Date</label>
              <input type="date" value={form.acquisitionDate} onChange={(e) => setForm((p) => ({ ...p, acquisitionDate: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Acquisition Source</label>
              <input value={form.acquisitionSource} onChange={(e) => setForm((p) => ({ ...p, acquisitionSource: e.target.value }))} className="input" placeholder="PO number / donation / opening balance" />
            </div>
            <div className="col-span-2 flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Saving…" : "Add Asset"}</button>
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-3 items-center">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assets…" className="input max-w-xs" />
        <div className="ml-auto text-sm text-gray-500">
          {filtered.length} assets · Total value UGX {totalValue.toLocaleString("en-UG")}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">No assets recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Tag</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Location</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Value</th>
                <th className="px-4 py-2 text-left">Condition</th>
                {canManage && <th className="px-4 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => (
                <tr key={a.id} className={a.isDisposed ? "opacity-50" : ""}>
                  <td className="px-4 py-2 font-mono text-xs">{a.assetTag}</td>
                  <td className="px-4 py-2 font-medium">{a.name}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{a.category || "—"}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{a.location || "—"}</td>
                  <td className="px-4 py-2 text-right">{a.quantity} {a.unitOfMeasure}</td>
                  <td className="px-4 py-2 text-right">{a.totalValue ? Number(a.totalValue).toLocaleString("en-UG") : "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${CONDITION_TONE[a.condition ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
                      {a.condition}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-2 text-right">
                      {!a.isDisposed && <button onClick={() => dispose(a)} className="text-xs text-red-600 hover:underline">Dispose</button>}
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
