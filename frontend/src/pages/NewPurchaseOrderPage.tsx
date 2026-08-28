import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

interface Supplier { id: number; name: string; }
interface POItem {
  key: string;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  unitPrice: string;
}

function makeItem(): POItem {
  return { key: Math.random().toString(36).slice(2), description: "", quantity: "", unitOfMeasure: "", unitPrice: "" };
}

export default function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [supplierSuggestions, setSupplierSuggestions] = useState<Supplier[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("Kibuli Secondary School");
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [items, setItems] = useState<POItem[]>([makeItem()]);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!requestId) return;
    api
      .get<{ request: { referenceNumber: string }; items: any[] }>(`/purchase-orders/from-request/${requestId}`)
      .then(({ request, items: reqItems }) => {
        setReferenceNumber(request.referenceNumber);
        if (reqItems.length) {
          setItems(
            reqItems.map((it) => ({
              key: Math.random().toString(36).slice(2),
              description: it.description,
              quantity: String(it.quantity ?? ""),
              unitOfMeasure: it.unitOfMeasure ?? "",
              unitPrice: String(it.estimatedUnitCost ?? ""),
            }))
          );
        }
      })
      .catch(() => {});
  }, [requestId]);

  const searchSuppliers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSupplierSuggestions([]);
      return;
    }
    const results = await api.get<Supplier[]>(`/suppliers/search?q=${encodeURIComponent(q)}`);
    setSupplierSuggestions(results);
    setShowSuggestions(results.length > 0);
  }, []);

  function handleSupplierQueryChange(val: string) {
    setSupplierQuery(val);
    setSupplierId("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchSuppliers(val), 250);
  }

  function updateItem(key: string, patch: Partial<POItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!supplierId) {
      setError("Select a supplier from the search results");
      return;
    }
    setSubmitting(true);
    try {
      const po = await api.post<{ id: number }>("/purchase-orders", {
        supplierId,
        procurementRequestId: requestId ? Number(requestId) : null,
        issueDate,
        expectedDeliveryDate: expectedDeliveryDate || null,
        deliveryLocation,
        termsAndConditions: termsAndConditions || null,
        items: items
          .filter((it) => it.description)
          .map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unitOfMeasure: it.unitOfMeasure,
            unitPrice: it.unitPrice,
          })),
      });
      navigate(`/purchase-orders/${po.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create purchase order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">New Purchase Order</h1>
        {referenceNumber && (
          <div className="text-xs text-gray-500 font-mono">from {referenceNumber}</div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="relative">
          <label className="label">Supplier *</label>
          <input
            value={supplierQuery}
            onChange={(e) => handleSupplierQueryChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="input"
            placeholder="Type to search suppliers…"
            required={!supplierId}
          />
          {showSuggestions && supplierSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
              {supplierSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => {
                    setSupplierId(s.id);
                    setSupplierQuery(s.name);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-green-50"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {supplierId && <p className="text-xs text-green-700 mt-1">Selected.</p>}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Issue Date</label>
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Expected Delivery</label>
            <input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Delivery Location</label>
            <input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} className="input" />
          </div>
        </div>

        <div>
          <label className="label">Terms and Conditions</label>
          <textarea value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} className="input" rows={2} />
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-green-800 text-white px-4 py-2 text-sm font-semibold">Items</div>
        <div className="p-4 space-y-2">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-left w-24">Qty</th>
                <th className="px-2 py-2 text-left w-24">Unit</th>
                <th className="px-2 py-2 text-right w-32">Unit Price</th>
                <th className="px-2 py-2 text-right w-32">Total</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it) => (
                <tr key={it.key}>
                  <td className="px-2 py-2">
                    <input value={it.description} onChange={(e) => updateItem(it.key, { description: e.target.value })} className="input text-xs" required />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: e.target.value })} className="input text-xs text-right" min="0" step="0.01" />
                  </td>
                  <td className="px-2 py-2">
                    <input value={it.unitOfMeasure} onChange={(e) => updateItem(it.key, { unitOfMeasure: e.target.value })} className="input text-xs" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" value={it.unitPrice} onChange={(e) => updateItem(it.key, { unitPrice: e.target.value })} className="input text-xs text-right" min="0" />
                  </td>
                  <td className="px-2 py-2 text-right text-xs font-medium">
                    {((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)).toLocaleString("en-UG")}
                  </td>
                  <td className="px-2 py-2">
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems((prev) => prev.filter((i) => i.key !== it.key))} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setItems((prev) => [...prev, makeItem()])} className="text-sm text-green-700 hover:text-green-900 font-medium">
            + Add Item
          </button>
          <div className="text-right text-sm font-semibold pt-2 border-t border-gray-100">
            Total: UGX {total.toLocaleString("en-UG")}
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="px-6 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-60">
          {submitting ? "Creating…" : "Create Purchase Order"}
        </button>
      </div>
    </form>
  );
}
