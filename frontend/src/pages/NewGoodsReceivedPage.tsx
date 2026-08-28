import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

interface POItem {
  id: number;
  description: string;
  quantity: string;
  unitOfMeasure: string | null;
}
interface PODetail {
  id: number;
  poNumber: string;
  supplierName: string | null;
  items: POItem[];
}

interface ReceiptRow {
  purchaseOrderItemId: number;
  description: string;
  orderedQuantity: string;
  unitOfMeasure: string | null;
  quantityReceived: string;
  quantityAccepted: string;
  condition: string;
  remarks: string;
}

export default function NewGoodsReceivedPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poId = searchParams.get("poId");

  const [po, setPo] = useState<PODetail | null>(null);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!poId) return;
    api.get<PODetail>(`/purchase-orders/${poId}`).then((data) => {
      setPo(data);
      setRows(
        data.items.map((it) => ({
          purchaseOrderItemId: it.id,
          description: it.description,
          orderedQuantity: it.quantity,
          unitOfMeasure: it.unitOfMeasure,
          quantityReceived: it.quantity,
          quantityAccepted: it.quantity,
          condition: "good",
          remarks: "",
        }))
      );
    });
  }, [poId]);

  function updateRow(i: number, patch: Partial<ReceiptRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!poId) {
      setError("No purchase order selected");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const grn = await api.post<{ id: number }>("/goods-received", {
        purchaseOrderId: Number(poId),
        receivedDate,
        notes: notes || null,
        items: rows.map((r) => ({
          purchaseOrderItemId: r.purchaseOrderItemId,
          quantityReceived: r.quantityReceived,
          quantityAccepted: r.quantityAccepted,
          condition: r.condition,
          remarks: r.remarks || null,
        })),
      });
      navigate(`/goods-received/${grn.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record delivery");
    } finally {
      setSubmitting(false);
    }
  }

  if (!poId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 text-gray-500">
        Open an acknowledged purchase order and click "Record Goods Received" to start a delivery note.
      </div>
    );
  }
  if (!po) return <div className="text-center py-12 text-gray-400">Loading…</div>;

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Record Goods Received</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Against <span className="font-mono">{po.poNumber}</span> — {po.supplierName}
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <section className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 gap-4">
        <div>
          <label className="label">Date Received</label>
          <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="label">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Optional" />
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-green-800 text-white px-4 py-2 text-sm font-semibold">Items</div>
        <div className="p-4">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right w-20">Ordered</th>
                <th className="px-2 py-2 text-right w-24">Received</th>
                <th className="px-2 py-2 text-right w-24">Accepted</th>
                <th className="px-2 py-2 text-left w-28">Condition</th>
                <th className="px-2 py-2 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={r.purchaseOrderItemId}>
                  <td className="px-2 py-2">{r.description}</td>
                  <td className="px-2 py-2 text-right text-xs text-gray-500">{r.orderedQuantity} {r.unitOfMeasure}</td>
                  <td className="px-2 py-2">
                    <input type="number" value={r.quantityReceived} onChange={(e) => updateRow(i, { quantityReceived: e.target.value })} className="input text-xs text-right" min="0" step="0.01" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" value={r.quantityAccepted} onChange={(e) => updateRow(i, { quantityAccepted: e.target.value })} className="input text-xs text-right" min="0" step="0.01" />
                  </td>
                  <td className="px-2 py-2">
                    <select value={r.condition} onChange={(e) => updateRow(i, { condition: e.target.value })} className="input text-xs">
                      <option value="good">Good</option>
                      <option value="damaged">Damaged</option>
                      <option value="short">Short delivery</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input value={r.remarks} onChange={(e) => updateRow(i, { remarks: e.target.value })} className="input text-xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={submitting} className="px-6 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-60">
          {submitting ? "Saving…" : "Save Delivery Note"}
        </button>
      </div>
    </form>
  );
}
