import { useEffect, useMemo, useState, FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";

interface ReservePriceItem {
  id: number;
  category: string;
  itemName: string;
  unitOfMeasure: string | null;
  currentPrice: string | null;
  maximumPrice: string | null;
  year: number;
  isActive: boolean;
}

const EMPTY_FORM = {
  category: "",
  itemName: "",
  unitOfMeasure: "",
  currentPrice: "",
  maximumPrice: "",
};

export default function ReservePricesPage() {
  const { can } = useAuth();
  const [items, setItems] = useState<ReservePriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<ReservePriceItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!can("reserve_prices.view")) return <Navigate to="/dashboard" replace />;
  const canManage = can("reserve_prices.manage");

  function load() {
    setLoading(true);
    api
      .get<ReservePriceItem[]>("/reserve-prices")
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category))).sort(),
    [items]
  );

  const filtered = items.filter((i) => {
    if (category && i.category !== category) return false;
    if (query && !i.itemName.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, ReservePriceItem[]>();
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return map;
  }, [filtered]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/reserve-prices", form);
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add item");
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
      await api.patch(`/reserve-prices/${editing.id}`, {
        category: editing.category,
        itemName: editing.itemName,
        unitOfMeasure: editing.unitOfMeasure,
        currentPrice: editing.currentPrice,
        maximumPrice: editing.maximumPrice,
      });
      setEditing(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: ReservePriceItem) {
    if (!confirm(`${item.isActive ? "Deactivate" : "Reactivate"} "${item.itemName}"?`)) return;
    try {
      await api.patch(`/reserve-prices/${item.id}/status`, { isActive: !item.isActive });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  const fmt = (v: string | null) => (v ? Number(v).toLocaleString("en-UG") : "—");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Reserve Prices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Approved price ceilings the Contracts Committee reviews annually. Used
            to check unit costs when raising a request.
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
            + Add Item
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
          <h2 className="font-semibold text-sm mb-4">New Reserve Price Item</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <input
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="input"
                list="category-options"
                required
              />
              <datalist id="category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">Item Name *</label>
              <input
                value={form.itemName}
                onChange={(e) => setForm((p) => ({ ...p, itemName: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Unit of Measure</label>
              <input
                value={form.unitOfMeasure}
                onChange={(e) => setForm((p) => ({ ...p, unitOfMeasure: e.target.value }))}
                className="input"
                placeholder="Kgs, Pcs, Ltrs…"
              />
            </div>
            <div />
            <div>
              <label className="label">Current Price (UGX)</label>
              <input
                type="number"
                value={form.currentPrice}
                onChange={(e) => setForm((p) => ({ ...p, currentPrice: e.target.value }))}
                className="input"
                min="0"
              />
            </div>
            <div>
              <label className="label">Maximum Price (UGX)</label>
              <input
                type="number"
                value={form.maximumPrice}
                onChange={(e) => setForm((p) => ({ ...p, maximumPrice: e.target.value }))}
                className="input"
                min="0"
              />
            </div>
            <div className="col-span-2 flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? "Adding…" : "Add Item"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Edit {editing.itemName}</h2>
              <button
                onClick={() => setEditing(null)}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="label">Item Name</label>
                <input
                  value={editing.itemName}
                  onChange={(e) => setEditing({ ...editing, itemName: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Category</label>
                <input
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Unit of Measure</label>
                <input
                  value={editing.unitOfMeasure ?? ""}
                  onChange={(e) => setEditing({ ...editing, unitOfMeasure: e.target.value })}
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Current Price</label>
                  <input
                    type="number"
                    value={editing.currentPrice ?? ""}
                    onChange={(e) => setEditing({ ...editing, currentPrice: e.target.value })}
                    className="input"
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Maximum Price</label>
                  <input
                    type="number"
                    value={editing.maximumPrice ?? ""}
                    onChange={(e) => setEditing({ ...editing, maximumPrice: e.target.value })}
                    className="input"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items…"
          className="input max-w-xs"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input max-w-xs">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="ml-auto text-sm text-gray-400 self-center">
          {filtered.length} of {items.length} items
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
          Loading…
        </div>
      ) : grouped.size === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
          No items match.
        </div>
      ) : (
        Array.from(grouped.entries()).map(([cat, catItems]) => (
          <div key={cat} className="card overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 font-semibold text-sm text-gray-700">
              {cat}
              <span className="text-gray-400 font-normal ml-2 text-xs">
                {catItems.length} items
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-left">Unit</th>
                  <th className="px-4 py-2 text-right">Current Price</th>
                  <th className="px-4 py-2 text-right">Maximum Price</th>
                  {canManage && <th className="px-4 py-2 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {catItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 ${!item.isActive ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-2">
                      {item.itemName}
                      {!item.isActive && (
                        <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{item.unitOfMeasure || "—"}</td>
                    <td className="px-4 py-2 text-right">{fmt(item.currentPrice)}</td>
                    <td className="px-4 py-2 text-right font-medium">{fmt(item.maximumPrice)}</td>
                    {canManage && (
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => setEditing(item)}
                          className="text-xs text-green-700 hover:underline mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(item)}
                          className={`text-xs hover:underline ${
                            item.isActive ? "text-red-600" : "text-green-700"
                          }`}
                        >
                          {item.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
