import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import PageHeader from "../components/PageHeader";
import { InboxIcon, PlusIcon } from "../components/icons";

interface Disposal {
  id: number;
  referenceNumber: string;
  subject: string;
  method: string | null;
  buyerName: string | null;
  awardDate: string | null;
  reservePrice: string | null;
  contractPrice: string | null;
  notes: string | null;
}

interface Draft {
  subject: string;
  method: string;
  buyerName: string;
  awardDate: string;
  reservePrice: string;
  contractPrice: string;
  notes: string;
}

const EMPTY: Draft = {
  subject: "",
  method: "",
  buyerName: "",
  awardDate: "",
  reservePrice: "",
  contractPrice: "",
  notes: "",
};

/** Disposal methods under the PPDA disposal regulations; another can be typed. */
const METHODS = [
  "Public auction",
  "Public bidding",
  "Direct negotiation",
  "Sale to public officers",
  "Destruction",
  "Conversion or classification",
  "Trade-in",
  "Transfer to another entity",
  "Donation",
];

const money = (v: string | null) => (v ? Number(v).toLocaleString("en-UG") : "—");
const dayFirst = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const plain = (v: string | null) => (v ? String(Number(v)) : "");

export default function DisposalsPage() {
  const { can } = useAuth();
  const canManage = can("disposals.manage");
  const [rows, setRows] = useState<Disposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: number | null; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    api
      .get<Disposal[]>("/disposals")
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load disposals"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const set = (patch: Partial<Draft>) => setEditing((e) => e && { ...e, draft: { ...e.draft, ...patch } });

  function startEdit(d: Disposal) {
    setError("");
    setEditing({
      id: d.id,
      draft: {
        subject: d.subject,
        method: d.method ?? "",
        buyerName: d.buyerName ?? "",
        awardDate: d.awardDate ?? "",
        reservePrice: plain(d.reservePrice),
        contractPrice: plain(d.contractPrice),
        notes: d.notes ?? "",
      },
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      if (editing.id === null) await api.post("/disposals", editing.draft);
      else await api.put(`/disposals/${editing.id}`, editing.draft);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the disposal");
    } finally {
      setSaving(false);
    }
  }

  async function remove(d: Disposal) {
    if (!window.confirm(`Delete ${d.referenceNumber} — ${d.subject}? This can't be undone.`)) return;
    setError("");
    try {
      await api.delete(`/disposals/${d.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the disposal");
    }
  }

  const draft = editing?.draft;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disposals"
        subtitle="School assets sold, auctioned or otherwise disposed of. Each appears in FORM 27 Part V for its term."
        actions={
          canManage &&
          !editing && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setEditing({ id: null, draft: EMPTY });
              }}
              className="btn btn-primary"
            >
              <PlusIcon className="h-4 w-4" />
              Record disposal
            </button>
          )
        }
      />

      {editing && draft && (
        <form onSubmit={save} className="card overflow-hidden">
          <div className="border-b border-gray-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-gray-900">
              {editing.id === null ? "Record a disposal" : "Edit disposal"}
            </h2>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="d-subject">
                Subject of disposal *
              </label>
              <input
                id="d-subject"
                className="input"
                required
                value={draft.subject}
                onChange={(e) => set({ subject: e.target.value })}
                placeholder="e.g. Obsolete desktop computers"
              />
            </div>
            <div>
              <label className="label" htmlFor="d-method">
                Method of disposal
              </label>
              <input
                id="d-method"
                className="input"
                list="disposal-methods"
                value={draft.method}
                onChange={(e) => set({ method: e.target.value })}
                placeholder="e.g. Public auction"
              />
            </div>
            <div>
              <label className="label" htmlFor="d-buyer">
                Name of buyer
              </label>
              <input
                id="d-buyer"
                className="input"
                value={draft.buyerName}
                onChange={(e) => set({ buyerName: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="d-date">
                Date of award
              </label>
              <input
                id="d-date"
                type="date"
                className="input"
                value={draft.awardDate}
                onChange={(e) => set({ awardDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="d-reserve">
                  Reserve price (UGX)
                </label>
                <input
                  id="d-reserve"
                  type="number"
                  min="0"
                  step="1"
                  className="input"
                  value={draft.reservePrice}
                  onChange={(e) => set({ reservePrice: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="d-price">
                  Contract price (UGX)
                </label>
                <input
                  id="d-price"
                  type="number"
                  min="0"
                  step="1"
                  className="input"
                  value={draft.contractPrice}
                  onChange={(e) => set({ contractPrice: e.target.value })}
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="d-notes">
                Notes
              </label>
              <textarea
                id="d-notes"
                className="input"
                rows={2}
                value={draft.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </div>
            <datalist id="disposal-methods">
              {METHODS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          {error && (
            <div className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
            <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving…" : "Save disposal"}
            </button>
          </div>
        </form>
      )}

      {!editing && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 text-gray-400">
              <InboxIcon className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-medium text-gray-900">No disposals recorded yet</p>
            <p className="mt-1 text-sm text-gray-500">When the school sells or writes off an asset, record it here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Disposal</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Date of award</th>
                  <th className="px-4 py-3 text-right">Reserve price</th>
                  <th className="px-4 py-3 text-right">Contract price</th>
                  {canManage && (
                    <th className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((d) => (
                  <tr key={d.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{d.subject}</div>
                      <div className="mt-0.5 font-mono text-xs text-gray-500">{d.referenceNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{d.method || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{d.buyerName || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{dayFirst(d.awardDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(d.reservePrice)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(d.contractPrice)}</td>
                    {canManage && (
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        <button type="button" onClick={() => startEdit(d)} className="btn btn-ghost btn-sm">
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(d)}
                          className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
