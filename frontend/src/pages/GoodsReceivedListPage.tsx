import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";

interface GRNRow {
  id: number;
  grnNumber: string;
  status: string;
  receivedDate: string;
  poNumber: string | null;
  supplierName: string | null;
  receivedByName: string | null;
}

export default function GoodsReceivedListPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<GRNRow[]>([]);
  const [loading, setLoading] = useState(true);

  if (!can("goods_received.view")) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    api.get<GRNRow[]>("/goods-received").then(setRows).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Goods Received</h1>
        <p className="text-sm text-gray-500 mt-1">Delivery notes recorded against purchase orders.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">
            No deliveries recorded yet. Record one from an acknowledged purchase order.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">GRN Number</th>
                <th className="px-4 py-2 text-left">PO Number</th>
                <th className="px-4 py-2 text-left">Supplier</th>
                <th className="px-4 py-2 text-left">Received</th>
                <th className="px-4 py-2 text-left">By</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{g.grnNumber}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{g.poNumber || "—"}</td>
                  <td className="px-4 py-2">{g.supplierName || "—"}</td>
                  <td className="px-4 py-2 text-xs">{g.receivedDate}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{g.receivedByName || "—"}</td>
                  <td className="px-4 py-2"><Badge tone={STATUS_TONES.grn[g.status] ?? "gray"} label={statusLabel(g.status)} /></td>
                  <td className="px-4 py-2"><Link to={`/goods-received/${g.id}`} className="text-green-700 hover:underline text-xs">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
