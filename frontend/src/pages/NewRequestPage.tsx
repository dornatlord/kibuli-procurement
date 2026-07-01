import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Vote { id: number; code: string; name: string; }
interface SubProgramme { id: number; romanNumeral: string | null; name: string; }
interface BudgetItem { id: number; name: string; budgetedAmount: string | null; }
interface SavedItem { id: number; description: string; unitOfMeasure: string | null; lastUnitCost: string | null; }

interface LineItem {
  key: string;
  savedItemId: number | null;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  estimatedUnitCost: string;
  marketPrice: string;
  totalCost: string;
  suggestions: SavedItem[];
  showSuggestions: boolean;
}

function makeItem(): LineItem {
  return {
    key: Math.random().toString(36).slice(2),
    savedItemId: null,
    description: "",
    quantity: "",
    unitOfMeasure: "",
    estimatedUnitCost: "",
    marketPrice: "",
    totalCost: "",
    suggestions: [],
    showSuggestions: false,
  };
}

function getCalendarWeek(date: Date): { year: number; week: number } {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const week = Math.ceil((diff / 86400000 + 1) / 7);
  return { year: date.getFullYear(), week };
}

function getFinancialWeek(date: Date): { year: number; week: number } {
  const fy = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  const start = new Date(fy, 6, 1);
  const diff = date.getTime() - start.getTime();
  const week = Math.ceil((diff / 86400000 + 1) / 7);
  return { year: fy, week };
}

export default function NewRequestPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Procurement type gate — must be chosen before form is shown
  const [procurementSize, setProcurementSize] = useState<"micro" | "macro" | "">("");

  // Form state
  const [yearType, setYearType] = useState<"calendar" | "financial">("calendar");
  const [category, setCategory] = useState("supplies");
  const [budgetCategory, setBudgetCategory] = useState("recurrent");
  const [subject, setSubject] = useState("");
  const [planRef, setPlanRef] = useState("");
  const [location, setLocation] = useState("Kibuli Secondary School");
  const [dateRequired, setDateRequired] = useState("");
  const [estimatedTotal, setEstimatedTotal] = useState("");
  const [isMultiyear, setIsMultiyear] = useState(false);
  const [myYears, setMyYears] = useState({ one: "", two: "", three: "", four: "" });
  const [voteId, setVoteId] = useState<number | "">("");
  const [subProgrammeId, setSubProgrammeId] = useState<number | "">("");
  const [budgetItemId, setBudgetItemId] = useState<number | "">("");
  const [balanceManual, setBalanceManual] = useState("");
  const [items, setItems] = useState<LineItem[]>([makeItem()]);

  // Lookup data
  const [votes, setVotes] = useState<Vote[]>([]);
  const [subProgrammes, setSubProgrammes] = useState<SubProgramme[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [selectedBudgetItem, setSelectedBudgetItem] = useState<BudgetItem | null>(null);

  const now = new Date();
  const { year, week } = yearType === "financial" ? getFinancialWeek(now) : getCalendarWeek(now);

  useEffect(() => {
    api.get<Vote[]>("/lookup/votes").then(setVotes);
  }, []);

  useEffect(() => {
    setSubProgrammeId("");
    setBudgetItemId("");
    setSubProgrammes([]);
    setBudgetItems([]);
    setSelectedBudgetItem(null);
    if (!voteId) return;
    api.get<SubProgramme[]>(`/lookup/votes/${voteId}/sub-programmes`).then((sps) => {
      setSubProgrammes(sps);
      if (sps.length === 0) {
        api.get<BudgetItem[]>(`/lookup/votes/${voteId}/items`).then(setBudgetItems);
      }
    });
  }, [voteId]);

  useEffect(() => {
    setBudgetItemId("");
    setBudgetItems([]);
    setSelectedBudgetItem(null);
    if (!subProgrammeId) return;
    api.get<BudgetItem[]>(`/lookup/sub-programmes/${subProgrammeId}/items`).then(setBudgetItems);
  }, [subProgrammeId]);

  useEffect(() => {
    const found = budgetItems.find((b) => b.id === budgetItemId);
    setSelectedBudgetItem(found || null);
  }, [budgetItemId, budgetItems]);

  const searchSavedItems = useCallback(async (key: string, q: string) => {
    if (q.length < 2 || procurementSize !== "micro") return;
    const results = await api.get<SavedItem[]>(`/saved-items/search?q=${encodeURIComponent(q)}`);
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, suggestions: results, showSuggestions: results.length > 0 } : it))
    );
  }, [procurementSize]);

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const updated = { ...it, ...patch };
        if ("quantity" in patch || "estimatedUnitCost" in patch) {
          const q = Number(updated.quantity) || 0;
          const c = Number(updated.estimatedUnitCost) || 0;
          updated.totalCost = q && c ? String(q * c) : "";
        }
        return updated;
      })
    );
  }

  function handleDescriptionChange(key: string, val: string) {
    updateItem(key, { description: val, savedItemId: null });
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => searchSavedItems(key, val), 300);
  }

  function selectSuggestion(key: string, s: SavedItem) {
    updateItem(key, {
      savedItemId: s.id,
      description: s.description,
      unitOfMeasure: s.unitOfMeasure || "",
      estimatedUnitCost: s.lastUnitCost || "",
      suggestions: [],
      showSuggestions: false,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        category,
        yearType,
        budgetCategory,
        procurementSize,
        subjectOfProcurement: subject,
        procurementPlanReference: planRef,
        locationForDelivery: location,
        dateRequired: dateRequired || null,
        estimatedTotalCost: estimatedTotal || null,
        isMultiyear,
        multiyearYearOne: myYears.one || null,
        multiyearYearTwo: myYears.two || null,
        multiyearYearThree: myYears.three || null,
        multiyearYearFour: myYears.four || null,
        voteId: voteId || null,
        subProgrammeId: subProgrammeId || null,
        budgetItemId: budgetItemId || null,
        balanceRemainingManual: balanceManual || null,
        items: items.map((it, i) => ({
          itemNo: i + 1,
          savedItemId: it.savedItemId,
          description: it.description,
          quantity: it.quantity || null,
          unitOfMeasure: it.unitOfMeasure || null,
          estimatedUnitCost: it.estimatedUnitCost || null,
          marketPrice: it.marketPrice || null,
        })),
      };
      const req = await api.post<{ id: number }>("/requests", payload);
      navigate(`/requests/${req.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  const isMicro = procurementSize === "micro";
  const catCode = category === "supplies" ? "SUPPLIES" : category === "works" ? "WORKS" : "NONCONSULT";

  // Gate: must choose procurement type first
  if (!procurementSize) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">New Procurement Request</h1>
          <p className="text-gray-500 mt-2">Select the procurement type to continue</p>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <button
            onClick={() => setProcurementSize("micro")}
            className="border-2 border-green-700 rounded-2xl p-8 text-left hover:bg-green-50 transition group"
          >
            <div className="text-3xl mb-3">📋</div>
            <div className="text-lg font-bold text-green-800">Micro Procurement</div>
            <div className="text-sm text-gray-500 mt-1">Below UGX 1,000,000</div>
            <div className="text-xs text-gray-400 mt-3">Direct procurement, approved by Head of Department and Accounting Officer</div>
          </button>
          <button
            onClick={() => setProcurementSize("macro")}
            className="border-2 border-gray-300 rounded-2xl p-8 text-left hover:bg-gray-50 transition group"
          >
            <div className="text-3xl mb-3">📑</div>
            <div className="text-lg font-bold text-gray-800">Macro Procurement</div>
            <div className="text-sm text-gray-500 mt-1">UGX 1,000,000 and above</div>
            <div className="text-xs text-gray-400 mt-3">Goes to Contracts Committee for approval of procurement method</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">New Procurement Request</h1>
        <div className="text-xs text-gray-500">PPDA Act 2003 — TFORM 5</div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* ── PART I: IDENTIFICATION ─────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-green-800 text-white px-4 py-2 text-sm font-semibold">PART I — IDENTIFICATION</div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="label">Entity Code</label>
            <input
              value="Kibuli SS"
              readOnly
              className="input bg-gray-50 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="label">Sequence Number</label>
            <input
              value=""
              readOnly
              placeholder="(System generated on save)"
              className="input bg-gray-50 cursor-not-allowed text-gray-400"
            />
          </div>

          <div>
            <label className="label">Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input" required>
              <option value="supplies">Supplies</option>
              <option value="works">Works</option>
              <option value="non_consultancy">Non-Consultancy Services</option>
            </select>
          </div>

          <div>
            <label className="label">Year Type</label>
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setYearType("calendar")}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${yearType === "calendar" ? "bg-green-700 text-white border-green-700" : "border-gray-300 text-gray-700"}`}
              >
                Calendar Year
              </button>
              <button
                type="button"
                onClick={() => setYearType("financial")}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${yearType === "financial" ? "bg-green-700 text-white border-green-700" : "border-gray-300 text-gray-700"}`}
              >
                Financial Year
              </button>
            </div>
          </div>

          <div>
            <label className="label">Year</label>
            <input value={year} readOnly className="input bg-gray-50" />
          </div>
          <div>
            <label className="label">Week Number</label>
            <input value={`W${week}`} readOnly className="input bg-gray-50" />
          </div>

          <div className="col-span-2">
            <label className="label">Reference Number (auto-generated)</label>
            <input
              value={`KIBULI-SS/${catCode}/${year}/W${week}/(####)`}
              readOnly
              className="input bg-gray-50 font-mono text-xs"
            />
          </div>

          <div>
            <label className="label">Budget Category *</label>
            <select value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)} className="input" required>
              <option value="recurrent">Recurrent</option>
              <option value="development">Development</option>
            </select>
          </div>

          <div>
            <label className="label">Procurement Size *</label>
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setProcurementSize("micro")}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${isMicro ? "bg-green-700 text-white border-green-700" : "border-gray-300 text-gray-700"}`}
              >
                Micro (&lt; 1,000,000 UGX)
              </button>
              <button
                type="button"
                onClick={() => setProcurementSize("macro")}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${!isMicro ? "bg-green-700 text-white border-green-700" : "border-gray-300 text-gray-700"}`}
              >
                Macro (&ge; 1,000,000 UGX)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── PART II: PROCUREMENT DETAILS ──────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-green-800 text-white px-4 py-2 text-sm font-semibold">PART II — PROCUREMENT DETAILS</div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Subject of Procurement *</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Procurement Plan Reference</label>
            <input value={planRef} onChange={(e) => setPlanRef(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Location for Delivery</label>
            <input value={location} readOnly className="input bg-gray-100 cursor-not-allowed" />
          </div>
          <div>
            <label className="label">Date Required</label>
            <input type="date" value={dateRequired} onChange={(e) => setDateRequired(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Estimated Total Cost (UGX)</label>
            <input
              type="number"
              value={estimatedTotal}
              onChange={(e) => setEstimatedTotal(e.target.value)}
              className="input"
              min="0"
              step="1"
            />
          </div>

          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isMultiyear}
                onChange={(e) => setIsMultiyear(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Multi-year Procurement</span>
            </label>
          </div>

          {isMultiyear && (
            <>
              {(["one", "two", "three", "four"] as const).map((k, i) => (
                <div key={k}>
                  <label className="label">Year {i + 1} (UGX)</label>
                  <input
                    type="number"
                    value={myYears[k]}
                    onChange={(e) => setMyYears((prev) => ({ ...prev, [k]: e.target.value }))}
                    className="input"
                    min="0"
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* ── PART III: FUND AVAILABILITY ───────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-green-800 text-white px-4 py-2 text-sm font-semibold">PART III — FUND AVAILABILITY CHECK</div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="label">Vote</label>
            <select
              value={voteId}
              onChange={(e) => setVoteId(e.target.value ? Number(e.target.value) : "")}
              className="input"
            >
              <option value="">— Select Vote —</option>
              {votes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} — {v.name}
                </option>
              ))}
            </select>
          </div>

          {subProgrammes.length > 0 && (
            <div>
              <label className="label">Sub-Programme</label>
              <select
                value={subProgrammeId}
                onChange={(e) => setSubProgrammeId(e.target.value ? Number(e.target.value) : "")}
                className="input"
              >
                <option value="">— Select Sub-Programme —</option>
                {subProgrammes.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.romanNumeral ? `${sp.romanNumeral} ` : ""}{sp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {budgetItems.length > 0 && (
            <div>
              <label className="label">Budget Item</label>
              <select
                value={budgetItemId}
                onChange={(e) => setBudgetItemId(e.target.value ? Number(e.target.value) : "")}
                className="input"
              >
                <option value="">— Select Budget Item —</option>
                {budgetItems.map((bi) => (
                  <option key={bi.id} value={bi.id}>
                    {bi.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedBudgetItem && (
            <div>
              <label className="label">Budgeted Amount (UGX)</label>
              <input
                value={
                  selectedBudgetItem.budgetedAmount
                    ? Number(selectedBudgetItem.budgetedAmount).toLocaleString("en-UG")
                    : "Not set"
                }
                readOnly
                className="input bg-gray-50"
              />
            </div>
          )}

          <div>
            <label className="label">Balance Remaining (manual, if budget not digitized)</label>
            <input
              type="number"
              value={balanceManual}
              onChange={(e) => setBalanceManual(e.target.value)}
              className="input"
              min="0"
            />
          </div>
        </div>
      </section>

      {/* ── ITEMS TABLE ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-green-800 text-white px-4 py-2 text-sm font-semibold">
          DETAILS RELATING TO PROCUREMENT
        </div>
        <div className="p-4 space-y-2">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left w-8">#</th>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-left w-20">Qty</th>
                <th className="px-2 py-2 text-left w-24">Unit</th>
                <th className="px-2 py-2 text-right w-32">Unit Cost</th>
                <th className="px-2 py-2 text-right w-32">Market Price</th>
                <th className="px-2 py-2 text-right w-32">Total</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <tr key={item.key}>
                  <td className="px-2 py-2 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-2 py-2 relative">
                    <input
                      value={item.description}
                      onChange={(e) => handleDescriptionChange(item.key, e.target.value)}
                      onBlur={() =>
                        setTimeout(
                          () => updateItem(item.key, { showSuggestions: false }),
                          150
                        )
                      }
                      className="input text-xs"
                      placeholder={isMicro ? "Type to search catalog…" : "Description"}
                      required
                    />
                    {item.showSuggestions && item.suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                        {item.suggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onMouseDown={() => selectSuggestion(item.key, s)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 flex items-center justify-between"
                          >
                            <span>{s.description}</span>
                            <span className="text-gray-400 ml-2">
                              {s.lastUnitCost ? Number(s.lastUnitCost).toLocaleString("en-UG") : "—"} / {s.unitOfMeasure || "—"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                      className="input text-xs text-right"
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={item.unitOfMeasure}
                      onChange={(e) => updateItem(item.key, { unitOfMeasure: e.target.value })}
                      className="input text-xs"
                      placeholder="pcs / kg…"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={item.estimatedUnitCost}
                      onChange={(e) => updateItem(item.key, { estimatedUnitCost: e.target.value })}
                      className="input text-xs text-right"
                      min="0"
                      step="1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={item.marketPrice}
                      onChange={(e) => updateItem(item.key, { marketPrice: e.target.value })}
                      className="input text-xs text-right"
                      min="0"
                      step="1"
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-xs text-gray-700 font-medium">
                    {item.totalCost ? Number(item.totalCost).toLocaleString("en-UG") : "—"}
                  </td>
                  <td className="px-2 py-2">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, makeItem()])}
            className="mt-2 text-sm text-green-700 hover:text-green-900 font-medium"
          >
            + Add Item
          </button>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save Request"}
        </button>
      </div>
    </form>
  );
}
