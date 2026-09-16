import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";

interface GRNItem {
  id: number;
  description: string | null;
  unitOfMeasure: string | null;
  orderedQuantity: string | null;
  quantityReceived: string;
  quantityAccepted: string;
  condition: string | null;
  remarks: string | null;
}
interface GRNDetail {
  id: number;
  grnNumber: string;
  status: string;
  receivedDate: string;
  notes: string | null;
  poNumber: string | null;
  supplierName: string | null;
  receivedByName: string | null;
  items: GRNItem[];
}

export default function GoodsReceivedDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [grn, setGrn] = useState<GRNDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  function load() {
    setLoading(true);
    api.get<GRNDetail>(`/goods-received/${id}`).then(setGrn).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [id]);

  async function inspect(status: string) {
    setActing(true);
    try {
      await api.patch(`/goods-received/${id}/inspect`, { status });
      load();
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading…</div>;
  if (!grn) return <div className="text-center py-12 text-gray-500">Not found.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title font-mono">{grn.grnNumber}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {grn.poNumber} · {grn.supplierName}
          </p>
        </div>
        <Badge tone={STATUS_TONES.grn[grn.status] ?? "gray"} label={statusLabel(grn.status)} />
      </div>

      {can("goods_received.inspect") && grn.status === "pending_inspection" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-sm text-amber-800 font-medium">Inspection:</span>
          <button onClick={() => inspect("accepted")} disabled={acting} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-green-700 text-white hover:bg-green-800 disabled:opacity-60">Accept</button>
          <button onClick={() => inspect("partial")} disabled={acting} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">Partial</button>
          <button onClick={() => inspect("rejected")} disabled={acting} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">Reject</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Received Date</span><div>{grn.receivedDate}</div></div>
        <div><span className="text-gray-500">Received By</span><div>{grn.receivedByName || "—"}</div></div>
        {grn.notes && <div className="col-span-2"><span className="text-gray-500">Notes</span><div>{grn.notes}</div></div>}
      </div>

      <div className="card overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Items</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-right">Ordered</th>
              <th className="px-4 py-2 text-right">Received</th>
              <th className="px-4 py-2 text-right">Accepted</th>
              <th className="px-4 py-2 text-left">Condition</th>
              <th className="px-4 py-2 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {grn.items.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-2">{it.description}</td>
                <td className="px-4 py-2 text-right text-gray-500">{it.orderedQuantity} {it.unitOfMeasure}</td>
                <td className="px-4 py-2 text-right">{it.quantityReceived}</td>
                <td className="px-4 py-2 text-right font-medium">{it.quantityAccepted}</td>
                <td className="px-4 py-2 capitalize">{it.condition || "—"}</td>
                <td className="px-4 py-2 text-gray-500">{it.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
