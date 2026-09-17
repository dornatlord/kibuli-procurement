import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";
import { PageLoading } from "../components/Loading";

interface Amendment {
  id: number;
  amendmentDate: string;
  description: string;
  valueChange: string | null;
  revisedContractValue: string | null;
}
interface ContractDetail {
  id: number;
  contractNumber: string;
  title: string;
  contractValue: string | null;
  currentValue: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  signedDate: string | null;
  documentReference: string | null;
  supplierName: string | null;
  procurementRequestId: number | null;
  referenceNumber: string | null;
  amendments: Amendment[];
}

export default function ContractDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showAmend, setShowAmend] = useState(false);
  const [amendForm, setAmendForm] = useState({ amendmentDate: new Date().toISOString().slice(0, 10), description: "", valueChange: "", revisedContractValue: "" });
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api.get<ContractDetail>(`/contracts/${id}`).then(setContract).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [id]);

  async function setStatus(status: string) {
    setActing(true);
    try {
      await api.patch(`/contracts/${id}/status`, { status });
      load();
    } finally {
      setActing(false);
    }
  }

  async function submitAmendment(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post(`/contracts/${id}/amendments`, amendForm);
      setShowAmend(false);
      setAmendForm({ amendmentDate: new Date().toISOString().slice(0, 10), description: "", valueChange: "", revisedContractValue: "" });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add amendment");
    }
  }

  if (loading) return <PageLoading />;
  if (!contract) return <div className="text-center py-12 text-gray-500">Not found.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title font-mono">{contract.contractNumber}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contract.title} · {contract.supplierName}</p>
        </div>
        <Badge tone={STATUS_TONES.contract[contract.status] ?? "gray"} label={statusLabel(contract.status)} />
      </div>

      {contract.referenceNumber && (
        <div className="text-sm text-gray-500">
          Linked request: <Link to={`/requests/${contract.procurementRequestId}`} className="text-green-700 hover:underline font-mono">{contract.referenceNumber}</Link>
        </div>
      )}

      {can("contracts.manage") && (
        <div className="flex gap-2">
          {contract.status === "draft" && (
            <button onClick={() => setStatus("active")} disabled={acting} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-green-700 text-white hover:bg-green-800 disabled:opacity-60">Activate</button>
          )}
          {contract.status === "active" && (
            <button onClick={() => setStatus("completed")} disabled={acting} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-green-700 text-white hover:bg-green-800 disabled:opacity-60">Mark Completed</button>
          )}
          {["draft", "active"].includes(contract.status) && (
            <button onClick={() => setStatus("terminated")} disabled={acting} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">Terminate</button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Original Value</span><div>{contract.contractValue ? Number(contract.contractValue).toLocaleString("en-UG") : "—"}</div></div>
        <div><span className="text-gray-500">Current Value</span><div className="font-semibold">{contract.currentValue ? Number(contract.currentValue).toLocaleString("en-UG") : "—"}</div></div>
        <div><span className="text-gray-500">Start Date</span><div>{contract.startDate || "—"}</div></div>
        <div><span className="text-gray-500">End Date</span><div>{contract.endDate || "—"}</div></div>
        <div><span className="text-gray-500">Signed Date</span><div>{contract.signedDate || "—"}</div></div>
        <div><span className="text-gray-500">Document Reference</span><div>{contract.documentReference || "—"}</div></div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
          <span className="text-xs font-semibold text-gray-600 uppercase">Amendments</span>
          {can("contracts.manage") && (
            <button onClick={() => setShowAmend(true)} className="text-xs text-green-700 hover:underline">+ Add Amendment</button>
          )}
        </div>
        {contract.amendments.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">No amendments recorded.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-right">Value Change</th><th className="px-4 py-2 text-right">Revised Value</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contract.amendments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 text-xs">{a.amendmentDate}</td>
                  <td className="px-4 py-2">{a.description}</td>
                  <td className="px-4 py-2 text-right">{a.valueChange ? Number(a.valueChange).toLocaleString("en-UG") : "—"}</td>
                  <td className="px-4 py-2 text-right font-medium">{a.revisedContractValue ? Number(a.revisedContractValue).toLocaleString("en-UG") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAmend && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Add Amendment</h2>
              <button onClick={() => setShowAmend(false)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs mb-3">{error}</div>}
            <form onSubmit={submitAmendment} className="space-y-4">
              <div>
                <label className="label">Amendment Date</label>
                <input type="date" value={amendForm.amendmentDate} onChange={(e) => setAmendForm((p) => ({ ...p, amendmentDate: e.target.value }))} className="input" required />
              </div>
              <div>
                <label className="label">Description *</label>
                <textarea value={amendForm.description} onChange={(e) => setAmendForm((p) => ({ ...p, description: e.target.value }))} className="input" rows={2} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Value Change</label>
                  <input type="number" value={amendForm.valueChange} onChange={(e) => setAmendForm((p) => ({ ...p, valueChange: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">Revised Total Value</label>
                  <input type="number" value={amendForm.revisedContractValue} onChange={(e) => setAmendForm((p) => ({ ...p, revisedContractValue: e.target.value }))} className="input" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm">Save Amendment</button>
                <button type="button" onClick={() => setShowAmend(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
