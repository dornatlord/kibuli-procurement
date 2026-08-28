import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Supplier { id: number; name: string; }
interface PORow { id: number; poNumber: string; supplierId: number; supplierName: string | null; }

export default function NewInvoicePage() {
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [supplierSuggestions, setSupplierSuggestions] = useState<Supplier[]>([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);

  const [pos, setPos] = useState<PORow[]>([]);
  const [purchaseOrderId, setPurchaseOrderId] = useState<number | "">("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supplierId) {
      setPos([]);
      return;
    }
    api.get<PORow[]>("/purchase-orders").then((all) =>
      setPos(all.filter((p) => p.supplierId === supplierId))
    );
  }, [supplierId]);

  const searchSuppliers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSupplierSuggestions([]);
      return;
    }
    const results = await api.get<Supplier[]>(`/suppliers/search?q=${encodeURIComponent(q)}`);
    setSupplierSuggestions(results);
    setShowSupplierSuggestions(results.length > 0);
  }, []);

  function handleSupplierQueryChange(val: string) {
    setSupplierQuery(val);
    setSupplierId("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchSuppliers(val), 250);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!supplierId) {
      setError("Select a supplier from the search results");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/invoices", {
        invoiceNumber,
        supplierId,
        purchaseOrderId: purchaseOrderId || null,
        invoiceDate,
        amount,
        notes: notes || null,
      });
      navigate("/invoices");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">New Invoice</h1>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div>
          <label className="label">Invoice Number *</label>
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input" required />
        </div>

        <div className="relative">
          <label className="label">Supplier *</label>
          <input
            value={supplierQuery}
            onChange={(e) => handleSupplierQueryChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 150)}
            className="input"
            placeholder="Type to search suppliers…"
            required={!supplierId}
          />
          {showSupplierSuggestions && supplierSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
              {supplierSuggestions.map((s) => (
                <button key={s.id} type="button" onMouseDown={() => { setSupplierId(s.id); setSupplierQuery(s.name); setShowSupplierSuggestions(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-green-50">
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {pos.length > 0 && (
          <div>
            <label className="label">Purchase Order (optional, for 3-way match)</label>
            <select value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value ? Number(e.target.value) : "")} className="input">
              <option value="">— No PO —</option>
              {pos.map((p) => (
                <option key={p.id} value={p.id}>{p.poNumber}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Invoice Date *</label>
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Amount (UGX) *</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" min="0" required />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={submitting} className="px-6 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-60">
          {submitting ? "Saving…" : "Save Invoice"}
        </button>
      </div>
    </form>
  );
}
