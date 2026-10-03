import { useEffect, useMemo, useState, FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate, useSearchParams } from "react-router-dom";
import { ListSkeleton } from "../components/Loading";
import YearSelect from "../components/YearSelect";
import PrequalifiedView from "../components/PrequalifiedView";
import { thisYear, yearChoices } from "../lib/years";

interface Supplier {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tinNumber: string | null;
  registrationNumber: string | null;
  category: string | null;
  providerCategory: string;
  ownerNames: string | null;
  targetGroup: string | null;
  isPrequalified: boolean;
  isActive: boolean;
  notes: string | null;
  /** The years' supplier lists it's on. */
  years?: number[];
}

const EMPTY_FORM = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  tinNumber: "",
  registrationNumber: "",
  category: "supplies",
  providerCategory: "national",
  ownerNames: "",
  targetGroup: "",
  isPrequalified: false,
  notes: "",
};

const onList = (s: Supplier, year: number) => (s.years ?? []).includes(year);

/**
 * The year's pre-qualified list, laid out as the school's own (numbered
 * categories with their suppliers), and the provider register behind it, kept
 * as a list for each year. At the start of a year the school carries last
 * year's register forward, picks who to keep, or starts afresh; "All years"
 * shows every supplier the school has had.
 */
export default function SuppliersPage() {
  const { can } = useAuth();
  const allowed = can("suppliers.view");
  const canManage = can("suppliers.manage");
  // Which view: the pre-qualified list (the default) or the whole register.
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "register" ? "register" : "prequalified";
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | "all">(thisYear());
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  // Starting a year's list: carry everyone, choose, or start afresh.
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [starting, setStarting] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<Supplier[]>(`/suppliers?includeInactive=${showInactive}`)
      .then(setSuppliers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (allowed) load();
  }, [showInactive, allowed]);

  useEffect(() => {
    setChoosing(false);
  }, [year]);

  const years = useMemo(() => yearChoices(suppliers.flatMap((s) => s.years ?? []), thisYear() + 1), [suppliers]);

  if (!allowed) return <Navigate to="/dashboard" replace />;

  const listed = year === "all" ? suppliers : suppliers.filter((s) => onList(s, year));
  const filtered = listed.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  // The latest earlier year with a list, to start this year's from.
  const earlier =
    year === "all" ? undefined : years.filter((y) => y < year && suppliers.some((s) => onList(s, y))).sort((a, b) => b - a)[0];
  const carryable = earlier ? suppliers.filter((s) => onList(s, earlier)) : [];
  const offerStart = canManage && year !== "all" && !loading && listed.length === 0 && !!earlier && !fresh.has(year);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/suppliers", { ...form, year: year === "all" ? thisYear() : year });
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add supplier");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    setSaving(true);
    try {
      await api.patch(`/suppliers/${editing.id}`, editing);
      setEditing(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update supplier");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Supplier) {
    if (!confirm(`${s.isActive ? "Deactivate" : "Reactivate"} ${s.name}?`)) return;
    try {
      await api.patch(`/suppliers/${s.id}/status`, { isActive: !s.isActive });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function addToList(s: Supplier, y: number) {
    setError("");
    try {
      await api.post(`/suppliers/${s.id}/years/${y}`, {});
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add to the list");
    }
  }

  async function takeOffList(s: Supplier, y: number) {
    if (!confirm(`Take ${s.name} off ${y}'s list? Its LPOs and contracts stay as they are.`)) return;
    setError("");
    try {
      await api.delete(`/suppliers/${s.id}/years/${y}`);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update the list");
    }
  }

  async function startList(ids?: number[]) {
    if (year === "all" || !earlier) return;
    setStarting(true);
    setError("");
    try {
      await api.post(`/suppliers/lists/${year}/start`, ids ? { from: earlier, supplierIds: ids } : { from: earlier });
      setChoosing(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start the list");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">
            {view === "prequalified"
              ? "The pre-qualified list of suppliers, service providers and works, by category, as the Contracts Committee approved it."
              : "The provider register, kept as a list for each year. Taking a supplier off a year's list never touches its LPOs or contracts."}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setShowForm(true);
              setError("");
            }}
            className="btn btn-primary"
          >
            + Add Supplier
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Suppliers" className="flex gap-1 border-b border-gray-200">
        {(
          [
            ["prequalified", "Pre-qualified list"],
            ["register", "All suppliers"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setParams(key === "register" ? { view: "register" } : {}, { replace: true })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              view === key ? "border-green-700 text-green-800" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-4">
            New Supplier, on {year === "all" ? thisYear() : year}'s list
          </h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Supplier Name *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="input" required />
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">TIN Number</label>
              <input value={form.tinNumber} onChange={(e) => setForm((p) => ({ ...p, tinNumber: e.target.value }))} className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Category</label>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="input">
                <option value="supplies">Supplies</option>
                <option value="works">Works</option>
                <option value="non_consultancy">Non-Consultancy Services</option>
              </select>
            </div>
            <div>
              <label className="label">Provider Category</label>
              <select value={form.providerCategory} onChange={(e) => setForm((p) => ({ ...p, providerCategory: e.target.value }))} className="input">
                <option value="national">National</option>
                <option value="foreign">Foreign</option>
                <option value="resident">Resident</option>
                <option value="eac">EAC</option>
              </select>
            </div>
            <div>
              <label className="label">Target Group (if applicable)</label>
              <input value={form.targetGroup} onChange={(e) => setForm((p) => ({ ...p, targetGroup: e.target.value }))} className="input" placeholder="Women / Youth / PWD" />
            </div>
            <div>
              <label className="label flex items-center gap-2 mt-2">
                <input type="checkbox" checked={form.isPrequalified} onChange={(e) => setForm((p) => ({ ...p, isPrequalified: e.target.checked }))} className="rounded" />
                Prequalified
              </label>
            </div>
            <div className="col-span-2">
              <label className="label">Beneficial Ownership (Names)</label>
              <input value={form.ownerNames} onChange={(e) => setForm((p) => ({ ...p, ownerNames: e.target.value }))} className="input" />
            </div>
            <div className="col-span-2 flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Saving…" : "Add Supplier"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Edit {editing.name}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="label">Contact Person</label>
                <input value={editing.contactPerson ?? ""} onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">TIN Number</label>
                <input value={editing.tinNumber ?? ""} onChange={(e) => setEditing({ ...editing, tinNumber: e.target.value })} className="input" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === "prequalified" ? (
        <>
          <YearSelect
            id="prequalified-year"
            value={year === "all" ? thisYear() : year}
            years={years}
            onChange={(y) => setYear(y)}
          />
          <PrequalifiedView year={year === "all" ? thisYear() : year} />
        </>
      ) : (
      <>
      {offerStart && earlier && (
        <div className="card border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Start {year}'s supplier list</h2>
          <p className="mt-1 text-sm text-amber-900/80">
            {earlier}'s list has {carryable.length} supplier{carryable.length === 1 ? "" : "s"}. Carry them all into {year}, choose
            who to keep, or start afresh and add suppliers one by one.
          </p>
          {choosing ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <button type="button" className="text-green-700 hover:underline" onClick={() => setChosen(new Set(carryable.map((s) => s.id)))}>
                  Tick all
                </button>
                <button type="button" className="text-green-700 hover:underline" onClick={() => setChosen(new Set())}>
                  Untick all
                </button>
                <span className="text-amber-900/70">{chosen.size} ticked</span>
              </div>
              <div className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border border-amber-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
                {carryable.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={chosen.has(s.id)}
                      onChange={(e) =>
                        setChosen((c) => {
                          const n = new Set(c);
                          if (e.target.checked) n.add(s.id);
                          else n.delete(s.id);
                          return n;
                        })
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm" disabled={starting || chosen.size === 0} onClick={() => startList([...chosen])}>
                  {starting ? "Carrying…" : `Carry the ${chosen.size} ticked into ${year}`}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setChoosing(false)}>
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={starting} onClick={() => startList()}>
                {starting ? "Carrying…" : `Carry all ${carryable.length} forward`}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setChosen(new Set(carryable.map((s) => s.id)));
                  setChoosing(true);
                }}
              >
                Choose who to carry
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFresh((f) => new Set(f).add(year as number))}>
                Start a fresh list
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <YearSelect id="supplier-year" value={year} years={years} onChange={setYear} allowAll />
        <div>
          <label htmlFor="supplier-find" className="label">
            Find
          </label>
          <input id="supplier-find" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search suppliers…" className="input w-64" />
        </div>
        <label className="mb-2 flex items-center gap-2 text-xs text-gray-500">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show deactivated
        </label>
        <div className="mb-2 ml-auto text-sm text-gray-400">
          {filtered.length} supplier{filtered.length === 1 ? "" : "s"}
          {year === "all" ? " in all" : ` on ${year}'s list`}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            {query ? "No supplier matches that." : year === "all" ? "No suppliers yet." : `Nobody is on ${year}'s list yet.`}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Contact</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">Prequalified</th>
                {year === "all" && <th className="px-4 py-2 text-left">Years</th>}
                {canManage && <th className="px-4 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50 ${!s.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2 font-medium">
                    {s.name}
                    {!s.isActive && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">inactive</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {s.contactPerson || "—"} {s.phone && <span className="text-gray-400">· {s.phone}</span>}
                  </td>
                  <td className="px-4 py-2 capitalize text-xs">{s.category?.replace("_", " ") || "—"}</td>
                  <td className="px-4 py-2 capitalize text-xs">{s.providerCategory}</td>
                  <td className="px-4 py-2 text-xs">{s.isPrequalified ? "Yes" : "No"}</td>
                  {year === "all" && (
                    <td className="px-4 py-2 text-xs text-gray-500">{(s.years ?? []).join(", ") || "—"}</td>
                  )}
                  {canManage && (
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(s)} className="text-xs text-green-700 hover:underline mr-3">Edit</button>
                      {year === "all" ? (
                        !onList(s, thisYear()) && (
                          <button onClick={() => addToList(s, thisYear())} className="text-xs text-green-700 hover:underline mr-3">
                            Add to {thisYear()}
                          </button>
                        )
                      ) : (
                        <button onClick={() => takeOffList(s, year)} className="text-xs text-gray-500 hover:underline mr-3">
                          Take off {year}'s list
                        </button>
                      )}
                      <button onClick={() => toggleActive(s)} className={`text-xs hover:underline ${s.isActive ? "text-red-600" : "text-green-700"}`}>
                        {s.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}
    </div>
  );
}
