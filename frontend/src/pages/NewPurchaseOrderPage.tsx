import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import PageHeader from "../components/PageHeader";
import { PlusIcon, XIcon } from "../components/icons";

interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
}

interface LpoItem {
  key: string;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  unitPrice: string;
}

interface SourceRequest {
  referenceNumber: string;
  subjectOfProcurement: string | null;
  status: string;
}

interface NewSupplier {
  name: string;
  phone: string;
  address: string;
  tinNumber: string;
}

const newKey = () => Math.random().toString(36).slice(2);
const makeItem = (): LpoItem => ({ key: newKey(), description: "", quantity: "", unitOfMeasure: "", unitPrice: "" });
/** "24.00" → "24" for number inputs. */
const plain = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));

export default function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("requestId");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [suggestions, setSuggestions] = useState<Supplier[]>([]);
  const [searched, setSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newSupplier, setNewSupplier] = useState<NewSupplier | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);

  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("Kibuli Secondary School");
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [items, setItems] = useState<LpoItem[]>([makeItem()]);
  const [request, setRequest] = useState<SourceRequest | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Filled from the request, so nothing is typed twice.
  useEffect(() => {
    if (!requestId) return;
    api
      .get<{ request: SourceRequest; items: Record<string, unknown>[] }>(`/purchase-orders/from-request/${requestId}`)
      .then(({ request: r, items: reqItems }) => {
        setRequest(r);
        if (reqItems.length) {
          setItems(
            reqItems.map((it) => ({
              key: newKey(),
              description: String(it.description ?? ""),
              quantity: plain(it.quantity),
              unitOfMeasure: String(it.unitOfMeasure ?? ""),
              unitPrice: plain(it.estimatedUnitCost),
            }))
          );
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the request"));
  }, [requestId]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setSearched(false);
      return;
    }
    const results = await api.get<Supplier[]>(`/suppliers/search?q=${encodeURIComponent(q.trim())}`);
    setSuggestions(results);
    setSearched(true);
    setShowSuggestions(true);
  }, []);

  function onSupplierInput(value: string) {
    setSupplierQuery(value);
    setSupplier(null);
    setNewSupplier(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 250);
  }

  function chooseSupplier(s: Supplier) {
    setSupplier(s);
    setSupplierQuery(s.name);
    setShowSuggestions(false);
    setNewSupplier(null);
  }

  async function saveNewSupplier() {
    if (!newSupplier?.name.trim()) return;
    setSavingSupplier(true);
    setError("");
    try {
      const created = await api.post<Supplier>("/suppliers", {
        name: newSupplier.name.trim(),
        phone: newSupplier.phone.trim(),
        address: newSupplier.address.trim(),
        tinNumber: newSupplier.tinNumber.trim(),
      });
      chooseSupplier(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the supplier");
    } finally {
      setSavingSupplier(false);
    }
  }

  const updateItem = (key: string, patch: Partial<LpoItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const lineTotal = (it: LpoItem) => (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
  const total = items.reduce((s, it) => s + lineTotal(it), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!supplier) {
      setError("Choose the supplier, or add them as a new supplier.");
      return;
    }
    const filled = items.filter((it) => it.description.trim());
    if (!filled.length) {
      setError("Add at least one item.");
      return;
    }
    setSubmitting(true);
    try {
      const po = await api.post<{ id: number }>("/purchase-orders", {
        supplierId: supplier.id,
        procurementRequestId: requestId ? Number(requestId) : null,
        issueDate,
        expectedDeliveryDate: expectedDeliveryDate || null,
        deliveryLocation,
        termsAndConditions: termsAndConditions || null,
        items: filled.map((it) => ({
          description: it.description.trim(),
          quantity: it.quantity,
          unitOfMeasure: it.unitOfMeasure,
          unitPrice: it.unitPrice,
        })),
      });
      navigate(`/purchase-orders/${po.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the LPO");
    } finally {
      setSubmitting(false);
    }
  }

  const query = supplierQuery.trim();

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="New LPO"
        subtitle={
          request ? (
            <>
              From request <span className="font-mono">{request.referenceNumber}</span>
              {request.subjectOfProcurement ? ` — ${request.subjectOfProcurement}` : ""}
            </>
          ) : (
            "A local purchase order to a supplier. It takes the next LPO number when you save it."
          )
        }
      />

      {request && request.status !== "approved" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          This request isn't approved yet. You can prepare the LPO now, but it can't be issued to the supplier until the
          request is approved.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="card space-y-5 p-5">
        <div className="relative">
          <label className="label" htmlFor="supplier">
            To (supplier) *
          </label>
          <input
            id="supplier"
            value={supplierQuery}
            onChange={(e) => onSupplierInput(e.target.value)}
            onFocus={() => suggestions.length > 0 && !supplier && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="input"
            placeholder="Start typing the supplier's name"
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && !supplier && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-raised">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => chooseSupplier(s)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-green-50"
                >
                  <span className="font-medium text-gray-900">{s.name}</span>
                  {s.phone && <span className="ml-2 text-gray-500">{s.phone}</span>}
                </button>
              ))}
            </div>
          )}
          {supplier && (
            <p className="mt-1.5 text-sm text-green-700">
              Selected: {supplier.name}
              {supplier.phone ? `, ${supplier.phone}` : ""}
            </p>
          )}
          {!supplier && searched && query.length >= 2 && !newSupplier &&
            (can("suppliers.manage") ? (
              <button
                type="button"
                onClick={() => setNewSupplier({ name: query, phone: "", address: "", tinNumber: "" })}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800"
              >
                <PlusIcon className="h-4 w-4" />
                {suggestions.length ? `Not listed? Add “${query}” as a new supplier` : `Add “${query}” as a new supplier`}
              </button>
            ) : (
              suggestions.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  No supplier by that name. Ask the Procurement Unit to add them.
                </p>
              )
            ))}
        </div>

        {newSupplier && (
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-sm font-semibold text-gray-900">New supplier</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="ns-name">
                  Name *
                </label>
                <input
                  id="ns-name"
                  className="input"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="ns-phone">
                  Phone
                </label>
                <input
                  id="ns-phone"
                  className="input"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="ns-tin">
                  TIN
                </label>
                <input
                  id="ns-tin"
                  className="input"
                  value={newSupplier.tinNumber}
                  onChange={(e) => setNewSupplier({ ...newSupplier, tinNumber: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="ns-address">
                  Address
                </label>
                <input
                  id="ns-address"
                  className="input"
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={saveNewSupplier}
                disabled={savingSupplier || !newSupplier.name.trim()}
                className="btn btn-primary btn-sm"
              >
                {savingSupplier ? "Saving…" : "Save supplier"}
              </button>
              <button type="button" onClick={() => setNewSupplier(null)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="lpo-date">
              Date
            </label>
            <input id="lpo-date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="lpo-delivery">
              Expected delivery
            </label>
            <input
              id="lpo-delivery"
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="lpo-location">
              Deliver to
            </label>
            <input
              id="lpo-location"
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="lpo-terms">
            Terms and conditions
          </label>
          <textarea
            id="lpo-terms"
            value={termsAndConditions}
            onChange={(e) => setTermsAndConditions(e.target.value)}
            className="input"
            rows={2}
          />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-gray-900">Goods and services</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2.5">Description</th>
                <th className="w-24 px-3 py-2.5">Quantity</th>
                <th className="w-28 px-3 py-2.5">Unit</th>
                <th className="w-36 px-3 py-2.5 text-right">Unit price</th>
                <th className="w-36 px-3 py-2.5 text-right">Amount</th>
                <th className="w-10 px-2 py-2.5">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it) => (
                <tr key={it.key}>
                  <td className="px-3 py-2">
                    <input
                      aria-label="Description"
                      value={it.description}
                      onChange={(e) => updateItem(it.key, { description: e.target.value })}
                      className="input"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      aria-label="Quantity"
                      type="number"
                      min="0"
                      step="any"
                      value={it.quantity}
                      onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                      className="input text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      aria-label="Unit"
                      value={it.unitOfMeasure}
                      onChange={(e) => updateItem(it.key, { unitOfMeasure: e.target.value })}
                      className="input"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      aria-label="Unit price"
                      type="number"
                      min="0"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(it.key, { unitPrice: e.target.value })}
                      className="input text-right"
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-gray-900">
                    {lineTotal(it).toLocaleString("en-UG")}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((i) => i.key !== it.key))}
                        aria-label="Remove item"
                        className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, makeItem()])}
            className="btn btn-ghost btn-sm text-green-700"
          >
            <PlusIcon className="h-4 w-4" />
            Add item
          </button>
          <p className="text-sm font-semibold text-gray-900">Total: UGX {total.toLocaleString("en-UG")}</p>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="btn btn-primary px-6">
          {submitting ? "Creating…" : "Create LPO"}
        </button>
      </div>
    </form>
  );
}
