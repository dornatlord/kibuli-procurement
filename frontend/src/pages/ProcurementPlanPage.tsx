import { useEffect, useState, FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";
import { ListSkeleton } from "../components/Loading";

interface PlanItem {
  id: number;
  year: number;
  subjectOfProcurement: string;
  estimatedCost: string | null;
  sourceOfFunding: string | null;
  procurementMethod: string | null;
  procurementCategory: string | null;
  contractType: string | null;
  bidInvitationDate: string | null;
  contractSigningDate: string | null;
  completionDate: string | null;
  status: string;
}

const EMPTY_FORM = {
  subjectOfProcurement: "",
  estimatedCost: "",
  sourceOfFunding: "Internally Generated Funds",
  procurementMethod: "Quotations Method",
  procurementCategory: "supplies",
  contractType: "Lumpsum Contracts",
  bidInvitationDate: "",
  bidClosingDate: "",
  contractSigningDate: "",
  completionDate: "",
};

export default function ProcurementPlanPage() {
  const { can } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!can("procurement_plan.view")) return <Navigate to="/dashboard" replace />;
  const canManage = can("procurement_plan.manage");

  function load() {
    setLoading(true);
    api.get<PlanItem[]>(`/procurement-plan?year=${year}`).then(setItems).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [year]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/procurement-plan", { ...form, year });
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add plan item");
    } finally {
      setSaving(false);
    }
  }

  const totalEstimated = items.reduce((s, i) => s + Number(i.estimatedCost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Procurement Plan</h1>
          <p className="text-sm text-gray-500 mt-1">The annual plan for goods, works and non-consultancy services.</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input">
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {canManage && (
            <button onClick={() => { setShowForm(true); setError(""); }} className="btn btn-primary">
              + Add Item
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4">New Plan Item — {year}</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Subject of Procurement *</label>
              <input value={form.subjectOfProcurement} onChange={(e) => setForm((p) => ({ ...p, subjectOfProcurement: e.target.value }))} className="input" required />
            </div>
            <div>
              <label className="label">Estimated Cost (UGX)</label>
              <input type="number" value={form.estimatedCost} onChange={(e) => setForm((p) => ({ ...p, estimatedCost: e.target.value }))} className="input" min="0" />
            </div>
            <div>
              <label className="label">Source of Funding</label>
              <input value={form.sourceOfFunding} onChange={(e) => setForm((p) => ({ ...p, sourceOfFunding: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Procurement Method</label>
              <select value={form.procurementMethod} onChange={(e) => setForm((p) => ({ ...p, procurementMethod: e.target.value }))} className="input">
                <option>Micro Procurement</option>
                <option>Quotations Method</option>
                <option>Direct Procurement</option>
                <option>Open Domestic Bidding</option>
                <option>Restricted International Bidding (RIB)</option>
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select value={form.procurementCategory} onChange={(e) => setForm((p) => ({ ...p, procurementCategory: e.target.value }))} className="input">
                <option value="supplies">Supplies</option>
                <option value="works">Works</option>
                <option value="non_consultancy">Non-Consultancy Services</option>
              </select>
            </div>
            <div>
              <label className="label">Contract Type</label>
              <select value={form.contractType} onChange={(e) => setForm((p) => ({ ...p, contractType: e.target.value }))} className="input">
                <option>Lumpsum Contracts</option>
                <option>Time-based Contracts</option>
                <option>Ad Measurement Contracts</option>
              </select>
            </div>
            <div>
              <label className="label">Bid Invitation Date</label>
              <input type="date" value={form.bidInvitationDate} onChange={(e) => setForm((p) => ({ ...p, bidInvitationDate: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Contract Signing Date</label>
              <input type="date" value={form.contractSigningDate} onChange={(e) => setForm((p) => ({ ...p, contractSigningDate: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Completion Date</label>
              <input type="date" value={form.completionDate} onChange={(e) => setForm((p) => ({ ...p, completionDate: e.target.value }))} className="input" />
            </div>
            <div className="col-span-2 flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Saving…" : "Add to Plan"}</button>
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">No plan items for {year} yet.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Subject</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">Method</th>
                  <th className="px-4 py-2 text-right">Est. Cost</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-2">{it.subjectOfProcurement}</td>
                    <td className="px-4 py-2 capitalize text-xs">{it.procurementCategory?.replace("_", " ") || "—"}</td>
                    <td className="px-4 py-2 text-xs">{it.procurementMethod || "—"}</td>
                    <td className="px-4 py-2 text-right">{it.estimatedCost ? Number(it.estimatedCost).toLocaleString("en-UG") : "—"}</td>
                    <td className="px-4 py-2"><Badge tone={STATUS_TONES.plan[it.status] ?? "gray"} label={statusLabel(it.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 text-right text-sm font-semibold border-t border-gray-100">
              Total Estimated: UGX {totalEstimated.toLocaleString("en-UG")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
