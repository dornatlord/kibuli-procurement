import { useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

interface Supplier { id: number; name: string; }

export default function NewContractPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [title, setTitle] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [signedDate, setSignedDate] = useState(new Date().toISOString().slice(0, 10));
  const [documentReference, setDocumentReference] = useState("");

  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [suggestions, setSuggestions] = useState<Supplier[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const searchSuppliers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const results = await api.get<Supplier[]>(`/suppliers/search?q=${encodeURIComponent(q)}`);
    setSuggestions(results);
    setShowSuggestions(results.length > 0);
  }, []);

  function handleQueryChange(val: string) {
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
      const contract = await api.post<{ id: number }>("/contracts", {
        supplierId,
        procurementRequestId: requestId ? Number(requestId) : null,
        title,
        contractValue: contractValue || null,
        startDate: startDate || null,
        endDate: endDate || null,
        signedDate: signedDate || null,
        documentReference: documentReference || null,
      });
      navigate(`/contracts/${contract.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create contract");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">New Contract</h1>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div>
          <label className="label">Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
        </div>

        <div className="relative">
          <label className="label">Supplier *</label>
          <input
            value={supplierQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="input"
            placeholder="Type to search suppliers…"
            required={!supplierId}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
              {suggestions.map((s) => (
                <button key={s.id} type="button" onMouseDown={() => { setSupplierId(s.id); setSupplierQuery(s.name); setShowSuggestions(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-green-50">
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label">Contract Value (UGX)</label>
          <input type="number" value={contractValue} onChange={(e) => setContractValue(e.target.value)} className="input" min="0" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
          </div>
        </div>

        <div>
          <label className="label">Signed Date</label>
          <input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className="input" />
        </div>

        <div>
          <label className="label">Document Reference</label>
          <input value={documentReference} onChange={(e) => setDocumentReference(e.target.value)} className="input" placeholder="Filing reference / physical location" />
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={submitting} className="px-6 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-60">
          {submitting ? "Saving…" : "Create Contract"}
        </button>
      </div>
    </form>
  );
}
