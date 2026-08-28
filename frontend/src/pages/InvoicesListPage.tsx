import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";

interface InvoiceRow {
  id: number;
  invoiceNumber: string;
  amount: string;
  invoiceDate: string;
  status: string;
  paidDate: string | null;
  poNumber: string | null;
  supplierName: string | null;
  poMatched: boolean | null;
  goodsReceived: boolean | null;
}

export default function InvoicesListPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);

  if (!can("invoices.view")) return <Navigate to="/dashboard" replace />;

  function load() {
    setLoading(true);
    api.get<InvoiceRow[]>("/invoices").then(setRows).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function act(id: number, path: string, body?: object) {
    setActing(id);
    try {
      await api.patch(`/invoices/${id}${path}`, body ?? {});
      load();
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Match badges compare the invoice to its purchase order and delivery record.
          </p>
        </div>
        {can("invoices.create") && (
          <Link to="/invoices/new" className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800">
            + New Invoice
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No invoices recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Invoice #</th>
                <th className="px-4 py-2 text-left">Supplier</th>
                <th className="px-4 py-2 text-left">PO</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-left">3-Way Match</th>
                <th className="px-4 py-2 text-left">Status</th>
                {can("invoices.approve") && <th className="px-4 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{r.invoiceNumber}</td>
                  <td className="px-4 py-2">{r.supplierName || "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.poNumber || "—"}</td>
                  <td className="px-4 py-2 text-right">{Number(r.amount).toLocaleString("en-UG")}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      <Badge tone={r.poMatched === null ? "gray" : r.poMatched ? "green" : "red"} label={r.poMatched === null ? "No PO" : r.poMatched ? "PO ✓" : "PO ✗"} />
                      <Badge tone={r.goodsReceived === null ? "gray" : r.goodsReceived ? "green" : "amber"} label={r.goodsReceived ? "Received ✓" : "Not received"} />
                    </div>
                  </td>
                  <td className="px-4 py-2"><Badge tone={STATUS_TONES.invoice[r.status] ?? "gray"} label={statusLabel(r.status)} /></td>
                  {can("invoices.approve") && (
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {r.status === "pending" && (
                        <>
                          <button disabled={acting === r.id} onClick={() => act(r.id, "/status", { status: "approved" })} className="text-xs text-green-700 hover:underline mr-3">Approve</button>
                          <button disabled={acting === r.id} onClick={() => act(r.id, "/status", { status: "rejected" })} className="text-xs text-red-600 hover:underline">Reject</button>
                        </>
                      )}
                      {r.status === "approved" && can("invoices.pay") && (
                        <button disabled={acting === r.id} onClick={() => act(r.id, "/pay")} className="text-xs text-blue-700 hover:underline">Mark Paid</button>
                      )}
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
