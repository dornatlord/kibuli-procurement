import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import Badge, { STATUS_TONES, statusLabel } from "../components/Badge";

interface POItem {
  id: number;
  description: string;
  quantity: string;
  unitOfMeasure: string | null;
  unitPrice: string;
  totalPrice: string;
}

interface PODetail {
  id: number;
  poNumber: string;
  status: string;
  issueDate: string | null;
  expectedDeliveryDate: string | null;
  deliveryLocation: string | null;
  totalAmount: string | null;
  termsAndConditions: string | null;
  supplierName: string | null;
  supplierAddress: string | null;
  supplierPhone: string | null;
  procurementRequestId: number | null;
  referenceNumber: string | null;
  items: POItem[];
}

const NEXT: Record<string, { next: string; label: string }[]> = {
  draft: [{ next: "issued", label: "Issue to Supplier" }, { next: "cancelled", label: "Cancel" }],
  issued: [{ next: "acknowledged", label: "Mark Acknowledged" }, { next: "cancelled", label: "Cancel" }],
  acknowledged: [{ next: "completed", label: "Mark Completed" }, { next: "cancelled", label: "Cancel" }],
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [po, setPo] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  function load() {
    setLoading(true);
    api.get<PODetail>(`/purchase-orders/${id}`).then(setPo).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [id]);

  async function transition(next: string) {
    setActing(true);
    try {
      await api.patch(`/purchase-orders/${id}/status`, { status: next });
      load();
    } finally {
      setActing(false);
    }
  }

  function printPO() {
    if (!po) return;
    const rows = po.items
      .map(
        (it, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td>${it.description}</td>
        <td style="text-align:center;">${it.quantity}</td>
        <td style="text-align:center;">${it.unitOfMeasure || ""}</td>
        <td style="text-align:right;">${Number(it.unitPrice).toLocaleString("en-UG")}</td>
        <td style="text-align:right;">${Number(it.totalPrice).toLocaleString("en-UG")}</td>
      </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${po.poNumber}</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family: Arial, sans-serif; font-size:12px; color:#000; padding:15mm; }
table { width:100%; border-collapse:collapse; margin-top:8px; }
td,th { border:1px solid #000; padding:4px 6px; }
h1 { font-size:18px; }
@page { size:A4 portrait; margin:0; }
</style></head><body>
  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
    <div>
      <h1>Kibuli Secondary School</h1>
      <div style="font-size:11px; color:#555;">Procurement &amp; Disposal Unit</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:16px; font-weight:bold;">PURCHASE ORDER</div>
      <div style="font-family:monospace;">${po.poNumber}</div>
    </div>
  </div>

  <table style="margin-top:16px;">
    <tr><td style="width:20%;font-weight:bold;">Supplier</td><td>${po.supplierName || ""}</td>
        <td style="width:20%;font-weight:bold;">Issue Date</td><td>${po.issueDate || ""}</td></tr>
    <tr><td style="font-weight:bold;">Address</td><td>${po.supplierAddress || ""}</td>
        <td style="font-weight:bold;">Expected Delivery</td><td>${po.expectedDeliveryDate || ""}</td></tr>
    <tr><td style="font-weight:bold;">Phone</td><td>${po.supplierPhone || ""}</td>
        <td style="font-weight:bold;">Delivery Location</td><td>${po.deliveryLocation || ""}</td></tr>
    ${po.referenceNumber ? `<tr><td style="font-weight:bold;">Request Ref.</td><td colspan="3" style="font-family:monospace;">${po.referenceNumber}</td></tr>` : ""}
  </table>

  <table>
    <tr>
      <th style="width:6%;">#</th><th>Description</th><th style="width:10%;">Qty</th>
      <th style="width:12%;">Unit</th><th style="width:16%;">Unit Price</th><th style="width:16%;">Total</th>
    </tr>
    ${rows}
    <tr><td colspan="5" style="text-align:right;font-weight:bold;">Total (UGX)</td>
        <td style="text-align:right;font-weight:bold;">${po.totalAmount ? Number(po.totalAmount).toLocaleString("en-UG") : ""}</td></tr>
  </table>

  ${po.termsAndConditions ? `<div style="margin-top:12px;"><strong>Terms and Conditions</strong><div style="margin-top:4px;">${po.termsAndConditions}</div></div>` : ""}

  <div style="display:flex; justify-content:space-between; margin-top:40px;">
    <div>Authorized Signature: ................................</div>
    <div>Date: ................................</div>
  </div>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading…</div>;
  if (!po) return <div className="text-center py-12 text-gray-500">Not found.</div>;

  const actions = NEXT[po.status] || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title font-mono">{po.poNumber}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{po.supplierName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={printPO} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-green-700 text-green-700 text-sm font-medium hover:bg-green-50 transition">
            🖨 Print
          </button>
          <Badge tone={STATUS_TONES.po[po.status] ?? "gray"} label={statusLabel(po.status)} />
        </div>
      </div>

      {can("purchase_orders.manage") && actions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-sm text-amber-800 font-medium">Action:</span>
          {actions.map((a) => (
            <button
              key={a.next}
              onClick={() => transition(a.next)}
              disabled={acting}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-60 ${a.next === "cancelled" ? "bg-red-600 text-white hover:bg-red-700" : "bg-green-700 text-white hover:bg-green-800"}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {po.referenceNumber && (
        <div className="text-sm text-gray-500">
          Linked request: <Link to={`/requests/${po.procurementRequestId}`} className="text-green-700 hover:underline font-mono">{po.referenceNumber}</Link>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Issue Date</span><div>{po.issueDate || "—"}</div></div>
        <div><span className="text-gray-500">Expected Delivery</span><div>{po.expectedDeliveryDate || "—"}</div></div>
        <div><span className="text-gray-500">Delivery Location</span><div>{po.deliveryLocation || "—"}</div></div>
        <div><span className="text-gray-500">Total Amount</span><div className="font-semibold">{po.totalAmount ? Number(po.totalAmount).toLocaleString("en-UG") : "—"}</div></div>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Items</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <tr><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-left">Unit</th><th className="px-4 py-2 text-right">Unit Price</th><th className="px-4 py-2 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {po.items.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-2">{it.description}</td>
                <td className="px-4 py-2 text-right">{it.quantity}</td>
                <td className="px-4 py-2">{it.unitOfMeasure || "—"}</td>
                <td className="px-4 py-2 text-right">{Number(it.unitPrice).toLocaleString("en-UG")}</td>
                <td className="px-4 py-2 text-right font-medium">{Number(it.totalPrice).toLocaleString("en-UG")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {po.status === "acknowledged" && can("goods_received.create") && (
        <Link to={`/goods-received/new?poId=${po.id}`} className="inline-block bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800">
          + Record Goods Received
        </Link>
      )}
    </div>
  );
}
