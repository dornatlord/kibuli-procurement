import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  categoryHint,
  lineSuppliers,
  providerSource,
  usePrequalifiedList,
  useRequestProviders,
  type SupplierCategoryRef,
} from "../lib/suppliers";

interface Supplier { id: number; name: string; onThisYearsList?: boolean; categories?: SupplierCategoryRef[]; }

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
  // The box has the cursor: while it's empty, it lists the pre-qualified suppliers.
  const [focused, setFocused] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // From a request: its provider (the supplier on its LPO, or Part II's first
  // shortlisted provider) and subject fill in, and the suppliers pre-qualified
  // for its budget line are offered first.
  const providers = useRequestProviders(requestId);
  const prequalified = usePrequalifiedList(providers?.request.year, !!providers?.line);
  const forLine = useMemo(() => lineSuppliers(prequalified, providers?.line?.key), [prequalified, providers?.line?.key]);
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  const prefilled = useRef(false);

  const searchSuppliers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const results = await api.get<Supplier[]>(`/suppliers/search?q=${encodeURIComponent(q)}`);
    setSuggestions(results);
    setShowSuggestions(results.length > 0);
  }, []);

  // Once, when the request is known, unless something was typed or chosen meanwhile.
  useEffect(() => {
    if (!providers || prefilled.current) return;
    prefilled.current = true;
    setTitle((t) => t || providers.request.subjectOfProcurement || "");
    const p = providers.provider;
    if (!p || supplierId || supplierQuery.trim()) return;
    setSupplierQuery(p.name);
    if (p.supplierId) setSupplierId(p.supplierId);
    else void searchSuppliers(p.name);
    setFilledFrom(providerSource(p));
  }, [providers]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleQueryChange(val: string) {
    setSupplierQuery(val);
    setSupplierId("");
    setFilledFrom(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchSuppliers(val), 250);
  }

  function choose(id: number, name: string) {
    setSupplierId(id);
    setSupplierQuery(name);
    setShowSuggestions(false);
    setFilledFrom(null);
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
      <div>
        <h1 className="page-title">New Contract</h1>
        {providers && (
          <p className="page-subtitle">
            From request <span className="font-mono">{providers.request.referenceNumber}</span>
            {providers.request.subjectOfProcurement ? ` — ${providers.request.subjectOfProcurement}` : ""}
          </p>
        )}
      </div>

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
            onFocus={() => setFocused(true)}
            onBlur={() =>
              setTimeout(() => {
                setShowSuggestions(false);
                setFocused(false);
              }, 150)
            }
            className="input"
            placeholder={forLine.length ? "Pick a pre-qualified supplier, or type a name" : "Type to search suppliers…"}
            required={!supplierId}
            autoComplete="off"
          />
          {focused && !supplierId && !supplierQuery.trim() && forLine.length > 0 && (
            <div
              role="listbox"
              aria-label="Pre-qualified suppliers"
              className="absolute left-0 right-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto mt-1 py-1"
            >
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Pre-qualified for {providers?.line?.label}
              </p>
              {forLine.map((s) => (
                <button
                  key={s.supplierId}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={() => choose(s.supplierId, s.name)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-green-50"
                >
                  <span className="block font-medium text-gray-900">{s.name}</span>
                  <span className="block text-gray-500">{s.hint}</span>
                </button>
              ))}
            </div>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
              {suggestions.map((s) => (
                <button key={s.id} type="button" onMouseDown={() => choose(s.id, s.name)} className="w-full text-left px-3 py-2 text-xs hover:bg-green-50">
                  {s.name}
                  {s.onThisYearsList === false && (
                    <span className="ml-2 text-amber-700">not on this year’s list yet: joins it with this contract</span>
                  )}
                  {categoryHint(s.categories) && <span className="block text-gray-500">{categoryHint(s.categories)}</span>}
                </button>
              ))}
            </div>
          )}
          {filledFrom && (
            <p className="mt-1.5 text-xs text-gray-500">
              {supplierId
                ? `Filled in from ${filledFrom}.`
                : `Filled in from ${filledFrom}, but that name isn’t in the supplier register: pick a supplier from the list.`}
            </p>
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
        <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={submitting} className="btn btn-primary px-6">
          {submitting ? "Saving…" : "Create Contract"}
        </button>
      </div>
    </form>
  );
}
