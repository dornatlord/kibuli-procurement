import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";

interface PORow {
  id: number;
  poNumber: string;
  status: string;
  issueDate: string | null;
  expectedDeliveryDate: string | null;
  totalAmount: string | null;
  supplierName: string | null;
  referenceNumber: string | null;
}

export default function PurchaseOrdersListPage() {
  const { can } = useAuth();
  const [orders, setOrders] = useState<PORow[]>([]);
  const [loading, setLoading] = useState(true);

  if (!can("purchase_orders.view")) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    api.get<PORow[]>("/purchase-orders").then(setOrders).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Orders issued to suppliers against approved requests.</p>
        </div>
        {can("purchase_orders.create") && (
          <Link to="/purchase-orders/new" className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800">
            + New Purchase Order
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No purchase orders yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">PO Number</th>
                <th className="px-4 py-2 text-left">Supplier</th>
                <th className="px-4 py-2 text-left">Request</th>
                <th className="px-4 py-2 text-right">Amount (UGX)</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{po.poNumber}</td>
                  <td className="px-4 py-2">{po.supplierName || "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{po.referenceNumber || "—"}</td>
                  <td className="px-4 py-2 text-right">
                    {po.totalAmount ? Number(po.totalAmount).toLocaleString("en-UG") : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={STATUS_TONES.po[po.status] ?? "gray"} label={statusLabel(po.status)} />
                  </td>
                  <td className="px-4 py-2">
                    <Link to={`/purchase-orders/${po.id}`} className="text-green-700 hover:underline text-xs">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
