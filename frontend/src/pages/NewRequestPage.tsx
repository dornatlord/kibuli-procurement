import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import ItemPickerModal, { itemKey } from "../components/ItemPickerModal";
import type { PriceListItem } from "../components/ItemPickerModal";
import PartTwoTable, { EMPTY_SUBMISSION } from "../components/PartTwoForm";
import type { PartTwoSubmission } from "../components/PartTwoForm";
import { basketLineKey, lineIds } from "../lib/baskets";
import type { BasketDetail, BasketSummary } from "../lib/baskets";

interface Vote { id: number; code: string; name: string; }
interface SubProgramme { id: number; romanNumeral: string | null; name: string; priceCategories: string[] | null; supplyCode: string | null; }
interface BudgetItem { id: number; name: string; budgetedAmount: string | null; priceCategories: string[] | null; supplyCode: string | null; }
interface SavedItem { id: number; description: string; unitOfMeasure: string | null; lastUnitCost: string | null; }
interface ReservePriceItem { id: number; category: string; itemName: string; unitOfMeasure: string | null; currentPrice: string | null; maximumPrice: string | null; }

interface Suggestion {
  source: "saved" | "reserve";
  id: number;
  description: string;
  unitOfMeasure: string | null;
  price: string | null;
  maxPrice: string | null;
  category?: string;
}

interface LineItem {
  key: string;
  savedItemId: number | null;
  /** The price-list entry the row came from, so a saved basket stays linked to it. */
  reservePriceItemId: number | null;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  estimatedUnitCost: string;
  marketPrice: string;
  totalCost: string;
  reserveMaxPrice: string | null;
  suggestions: Suggestion[];
  showSuggestions: boolean;
}

function makeItem(): LineItem {
  return {
    key: Math.random().toString(36).slice(2),
    savedItemId: null,
    reservePriceItemId: null,
    description: "",
    quantity: "",
    unitOfMeasure: "",
    estimatedUnitCost: "",
    marketPrice: "",
    totalCost: "",
    reserveMaxPrice: null,
    suggestions: [],
    showSuggestions: false,
  };
}

function lineTotal(quantity: string, unitCost: string) {
  const q = Number(quantity) || 0;
  const c = Number(unitCost) || 0;
  return q && c ? String(q * c) : "";
}

/** A row the user has started filling in (the blank starter row has not). */
const hasContent = (it: LineItem) => !!(it.description.trim() || it.quantity || it.estimatedUnitCost);

/** "4500.00" → "4500" for number inputs. */
const plain = (v: string | null) => (v ? String(Number(v)) : "");

type PickerTab = "items" | "baskets";
interface PickerState { title: string; categories: string[]; lineKey: string | null; tab: PickerTab; }
interface Notice { tone: "ok" | "error" | "info"; text: string; }

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
  const { can } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
  const [isMultiyear, setIsMultiyear] = useState(false);
  const [myYears, setMyYears] = useState({ one: "", two: "", three: "", four: "" });
  const [voteId, setVoteId] = useState<number | "">("");
  const [subProgrammeId, setSubProgrammeId] = useState<number | "">("");
  const [budgetItemId, setBudgetItemId] = useState<number | "">("");
  const [balanceManual, setBalanceManual] = useState("");
  const [items, setItems] = useState<LineItem[]>([makeItem()]);
  // Latest rows, for async handlers that finish after a re-render.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Part II (macro only): the Procurement and Disposal Unit's submission to the
  // Contracts Committee, which the PDU can draft while raising the request.
  const [partTwo, setPartTwo] = useState<PartTwoSubmission>(EMPTY_SUBMISSION);

  // Item picker — opens on the price-list categories matching the budget line
  // chosen in Part III, so users tick items instead of typing them.
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  // Saved baskets — reusable item lists, loaded from the picker's second tab.
  const [baskets, setBaskets] = useState<BasketSummary[]>([]);
  const [basketForm, setBasketForm] = useState<{
    name: string;
    linkToLine: boolean;
    saveQuantities: boolean;
  } | null>(null);
  const [savingBasket, setSavingBasket] = useState(false);
  const [basketError, setBasketError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  // Lookup data
  const [votes, setVotes] = useState<Vote[]>([]);
  const [subProgrammes, setSubProgrammes] = useState<SubProgramme[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [selectedBudgetItem, setSelectedBudgetItem] = useState<BudgetItem | null>(null);
  const selectedSubProgramme = subProgrammes.find((sp) => sp.id === subProgrammeId) ?? null;

  // The budget line chosen in Part III, keyed the way baskets are linked.
  const lineKey = budgetItemId
    ? `bi:${budgetItemId}`
    : subProgrammeId && budgetItems.length === 0
    ? `sp:${subProgrammeId}`
    : null;
  const lineName = budgetItemId
    ? selectedBudgetItem?.name ?? null
    : lineKey
    ? selectedSubProgramme?.name ?? null
    : null;

  const now = new Date();
  const { year } = yearType === "financial" ? getFinancialWeek(now) : getCalendarWeek(now);

  useEffect(() => {
    api.get<Vote[]>("/lookup/votes").then(setVotes);
  }, []);

  useEffect(() => {
    api.get<BasketSummary[]>("/baskets").then(setBaskets).catch(() => setBaskets([]));
  }, []);

  useEffect(() => {
    setSubProgrammeId("");
    setBudgetItemId("");
    setSubProgrammes([]);
    setBudgetItems([]);
    setSelectedBudgetItem(null);
    if (!voteId) return;
    // Ignore replies for a vote the user has already moved past (e.g. arrowing
    // through the list), or the sub-programmes shown can belong to another vote.
    let cancelled = false;
    api.get<SubProgramme[]>(`/lookup/votes/${voteId}/sub-programmes`).then((sps) => {
      if (cancelled) return;
      setSubProgrammes(sps);
      if (sps.length === 0) {
        api.get<BudgetItem[]>(`/lookup/votes/${voteId}/items`).then((rows) => {
          if (!cancelled) setBudgetItems(rows);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [voteId]);

  useEffect(() => {
    setBudgetItemId("");
    setBudgetItems([]);
    setSelectedBudgetItem(null);
    if (!subProgrammeId) return;
    let cancelled = false;
    const sp = subProgrammes.find((s) => s.id === subProgrammeId);
    api.get<BudgetItem[]>(`/lookup/sub-programmes/${subProgrammeId}/items`).then((rows) => {
      if (cancelled) return;
      setBudgetItems(rows);
      // Tuition Stores departments have no budget items, so choosing the
      // sub-programme is the last step of the fund availability check.
      if (rows.length === 0 && sp) offerPicker(sp.name, sp.priceCategories, `sp:${sp.id}`);
    });
    return () => {
      cancelled = true;
    };
  }, [subProgrammeId]);

  useEffect(() => {
    const found = budgetItems.find((b) => b.id === budgetItemId);
    setSelectedBudgetItem(found || null);
  }, [budgetItemId, budgetItems]);

  // After the picker adds rows, put the cursor in the first new quantity box.
  useEffect(() => {
    if (!focusKey) return;
    qtyRefs.current[focusKey]?.focus();
    setFocusKey(null);
  }, [focusKey]);

  const addedKeys = useMemo(
    () =>
      new Set(
        items
          .filter((it) => it.description.trim())
          .map((it) => itemKey(it.description, it.unitOfMeasure))
      ),
    [items]
  );

  const searchSuggestions = useCallback(async (key: string, q: string) => {
    if (q.length < 2) return;

    const [saved, reserve] = await Promise.all([
      procurementSize === "micro"
        ? api.get<SavedItem[]>(`/saved-items/search?q=${encodeURIComponent(q)}`).catch(() => [])
        : Promise.resolve([]),
      api
        .get<ReservePriceItem[]>(`/reserve-prices/search?q=${encodeURIComponent(q)}`)
        .catch(() => []),
    ]);

    const results: Suggestion[] = [
      ...saved.map((s): Suggestion => ({
        source: "saved",
        id: s.id,
        description: s.description,
        unitOfMeasure: s.unitOfMeasure,
        price: s.lastUnitCost,
        maxPrice: null,
      })),
      ...reserve.map((r): Suggestion => ({
        source: "reserve",
        id: r.id,
        description: r.itemName,
        unitOfMeasure: r.unitOfMeasure,
        price: r.currentPrice,
        maxPrice: r.maximumPrice,
        category: r.category,
      })),
    ];

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
          updated.totalCost = lineTotal(updated.quantity, updated.estimatedUnitCost);
        }
        return updated;
      })
    );
  }

  function handleDescriptionChange(key: string, val: string) {
    updateItem(key, { description: val, savedItemId: null, reservePriceItemId: null, reserveMaxPrice: null });
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => searchSuggestions(key, val), 300);
  }

  function selectSuggestion(key: string, s: Suggestion) {
    updateItem(key, {
      savedItemId: s.source === "saved" ? s.id : null,
      reservePriceItemId: s.source === "reserve" ? s.id : null,
      description: s.description,
      unitOfMeasure: s.unitOfMeasure || "",
      estimatedUnitCost: s.price || "",
      reserveMaxPrice: s.source === "reserve" ? s.maxPrice : null,
      suggestions: [],
      showSuggestions: false,
    });
  }

  /** Open the picker once a budget line is chosen, if there is anything to offer. */
  function offerPicker(title: string, categories: string[] | null | undefined, key: string) {
    const hasBaskets = baskets.some((b) => basketLineKey(b) === key);
    if (!categories?.length && !hasBaskets) return;
    setPicker({ title, categories: categories ?? [], lineKey: key, tab: hasBaskets ? "baskets" : "items" });
  }

  function addPickedItems(picked: PriceListItem[]) {
    const rows = picked.map((p): LineItem => ({
      ...makeItem(),
      reservePriceItemId: p.id,
      description: p.itemName,
      unitOfMeasure: p.unitOfMeasure ?? "",
      estimatedUnitCost: plain(p.currentPrice),
      reserveMaxPrice: p.maximumPrice,
    }));
    // Drop the untouched starter row so picked items start at #1.
    setItems((prev) => [...prev.filter(hasContent), ...rows]);
    setFocusKey(rows[0]?.key ?? null);
    setPicker(null);
  }

  async function loadBasket(b: BasketSummary) {
    setPicker(null);
    setNotice({ tone: "info", text: `Loading “${b.name}”…` });
    try {
      const detail = await api.get<BasketDetail>(`/baskets/${b.id}`);
      const current = itemsRef.current;
      const have = new Set(
        current
          .filter((it) => it.description.trim())
          .map((it) => itemKey(it.description, it.unitOfMeasure))
      );
      const rows = detail.items
        .filter((it) => !have.has(itemKey(it.description, it.unitOfMeasure)))
        .map((it): LineItem => {
          const quantity = plain(it.defaultQuantity);
          const estimatedUnitCost = plain(it.unitCost);
          return {
            ...makeItem(),
            reservePriceItemId: it.reservePriceItemId,
            description: it.description,
            unitOfMeasure: it.unitOfMeasure ?? "",
            quantity,
            estimatedUnitCost,
            totalCost: lineTotal(quantity, estimatedUnitCost),
            reserveMaxPrice: it.maximumPrice,
          };
        });
      const skipped = detail.items.length - rows.length;
      if (rows.length) {
        setItems([...current.filter(hasContent), ...rows]);
        setFocusKey(rows[0].key);
      }
      setNotice({
        tone: "ok",
        text:
          `Loaded “${detail.name}”: ${rows.length} item${rows.length === 1 ? "" : "s"} added` +
          (skipped ? `, ${skipped} already on the list` : "") +
          ". Check the quantities before saving.",
      });
    } catch (err: unknown) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Could not load the basket" });
    }
  }

  async function saveBasket(e: React.FormEvent) {
    e.preventDefault();
    if (!basketForm) return;
    setBasketError("");
    setSavingBasket(true);
    try {
      const created = await api.post<{ id: number; name: string; itemCount: number }>("/baskets", {
        name: basketForm.name,
        ...lineIds(basketForm.linkToLine ? lineKey : null),
        items: items
          .filter((it) => it.description.trim())
          .map((it) => ({
            reservePriceItemId: it.reservePriceItemId,
            description: it.description,
            unitOfMeasure: it.unitOfMeasure || null,
            unitCost: it.estimatedUnitCost || null,
            defaultQuantity: basketForm.saveQuantities ? it.quantity || null : null,
          })),
      });
      setBasketForm(null);
      setNotice({
        tone: "ok",
        text: `Saved basket “${created.name}” with ${created.itemCount} item${created.itemCount === 1 ? "" : "s"}.`,
      });
      api.get<BasketSummary[]>("/baskets").then(setBaskets).catch(() => {});
    } catch (err: unknown) {
      setBasketError(err instanceof Error ? err.message : "Could not save the basket");
    } finally {
      setSavingBasket(false);
    }
  }

  // What the buttons under the items table open the picker on.
  const pickerScope = {
    title: lineName ?? "",
    categories:
      (budgetItemId
        ? selectedBudgetItem?.priceCategories ?? selectedSubProgramme?.priceCategories
        : lineKey
        ? selectedSubProgramme?.priceCategories
        : null) ?? [],
    lineKey,
  };
  const filledCount = items.filter((it) => it.description.trim()).length;

  const itemsTotal =
    Math.round(items.reduce((sum, it) => sum + (Number(it.totalCost) || 0), 0) * 100) / 100;

  // Part II belongs to macro procurements and is the PDU's to fill.
  const showPartTwo = procurementSize === "macro" && can("requests.prepare.committee");

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
        estimatedTotalCost: itemsTotal ? String(itemsTotal) : null,
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
        partTwo: showPartTwo ? partTwo : undefined,
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
  const catCode = category === "supplies" ? "SUPLS" : category === "works" ? "WORKS" : "SERVS";
  // Reference numbers carry two digits of the year, and a financial year spans two.
  const yearCode =
    yearType === "financial"
      ? `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`
      : String(year).slice(-2);
  // Fourth part of the reference: the code of the budget line being spent.
  const supplyCode =
    (budgetItemId ? selectedBudgetItem?.supplyCode : null) ??
    (budgetItems.length === 0 ? selectedSubProgramme?.supplyCode : null) ??
    null;

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
    <>
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
            <label className="label">Code of Procuring and Disposing Entity</label>
            <input
              value="Kibuli Secondary School"
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
            <label className="label">Supply Code</label>
            <input
              value={supplyCode ?? ""}
              readOnly
              placeholder="From the budget line in Part III"
              className="input bg-gray-50"
            />
          </div>

          <div className="col-span-2">
            <label className="label">Reference Number (auto-generated)</label>
            <input
              value={`KSS/${catCode}/${yearCode}/${supplyCode ?? "(###)"}/(#####)`}
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
              value={itemsTotal ? itemsTotal.toLocaleString("en-UG") : ""}
              readOnly
              placeholder="Calculated from the items below"
              className="input bg-gray-50 cursor-not-allowed"
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
                    {sp.supplyCode ? ` — code ${sp.supplyCode}` : ""}
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
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : "";
                  setBudgetItemId(id);
                  const bi = budgetItems.find((b) => b.id === id);
                  if (bi) {
                    offerPicker(bi.name, bi.priceCategories ?? selectedSubProgramme?.priceCategories, `bi:${bi.id}`);
                  }
                }}
                className="input"
              >
                <option value="">— Select Budget Item —</option>
                {budgetItems.map((bi) => (
                  <option key={bi.id} value={bi.id}>
                    {bi.name}
                    {bi.supplyCode ? ` — code ${bi.supplyCode}` : ""}
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
                <th className="px-2 py-2 text-right w-32">Estimated Cost</th>
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
                      <div className="absolute left-0 right-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto mt-1">
                        {item.suggestions.map((s) => (
                          <button
                            key={`${s.source}-${s.id}`}
                            type="button"
                            onMouseDown={() => selectSuggestion(item.key, s)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 flex items-center justify-between gap-2"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              {s.source === "reserve" && (
                                <span className="shrink-0 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                  reserve
                                </span>
                              )}
                              <span className="truncate">{s.description}</span>
                            </span>
                            <span className="text-gray-400 shrink-0">
                              {s.price ? Number(s.price).toLocaleString("en-UG") : "—"} / {s.unitOfMeasure || "—"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      ref={(el) => {
                        qtyRefs.current[item.key] = el;
                      }}
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                      className="input text-xs text-right"
                      placeholder="Qty"
                      min="0"
                      step="0.01"
                      required
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
                      className={`input text-xs text-right ${
                        item.reserveMaxPrice &&
                        Number(item.estimatedUnitCost) > Number(item.reserveMaxPrice)
                          ? "border-amber-400 bg-amber-50"
                          : ""
                      }`}
                      min="0"
                      step="1"
                    />
                    {item.reserveMaxPrice &&
                      Number(item.estimatedUnitCost) > Number(item.reserveMaxPrice) && (
                        <div className="text-[10px] text-amber-700 mt-0.5 text-right">
                          Above reserve price ceiling of{" "}
                          {Number(item.reserveMaxPrice).toLocaleString("en-UG")}
                        </div>
                      )}
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
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={5} className="px-2 py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                  Total
                </td>
                <td className="px-2 py-2 text-right text-sm font-semibold text-gray-800">
                  {itemsTotal ? itemsTotal.toLocaleString("en-UG") : "—"}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPicker({ ...pickerScope, tab: "items" })}
              className="border border-green-700 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-50"
            >
              Pick from price list
            </button>
            {baskets.length > 0 && (
              <button
                type="button"
                onClick={() => setPicker({ ...pickerScope, tab: "baskets" })}
                className="border border-green-700 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-50"
              >
                Load a basket
              </button>
            )}
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, makeItem()])}
              className="text-sm text-green-700 hover:text-green-900 font-medium"
            >
              + Add Item
            </button>
            {filledCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBasketError("");
                  setBasketForm({ name: "", linkToLine: !!lineKey, saveQuantities: true });
                }}
                className="ml-auto text-sm text-gray-600 hover:text-green-800 font-medium"
              >
                Save these items as a basket
              </button>
            )}
          </div>
          {notice && (
            <div
              className={`text-xs ${
                notice.tone === "ok"
                  ? "text-green-700"
                  : notice.tone === "error"
                  ? "text-red-600"
                  : "text-gray-500"
              }`}
            >
              {notice.text}
            </div>
          )}
          {!lineKey && (
            <div className="text-xs text-gray-400">
              Tip: choose the budget item in Part III first — the price list then opens on matching items.
            </div>
          )}
        </div>
      </section>

      {/* ── FORM 5 PART II: SUBMISSION TO THE CONTRACTS COMMITTEE (macro) ── */}
      {showPartTwo && (
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-green-800 text-white px-4 py-2 text-sm font-semibold">
            PART II — REQUEST BY PROCUREMENT AND DISPOSAL UNIT TO CONTRACTS COMMITTEE
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-500">
              Filled by the Procurement and Disposal Unit. The date of submission fills in by itself when
              the request reaches the Contracts Committee, and the committee records its decision for each
              row on the request's page.
            </p>
            <PartTwoTable
              submission={partTwo}
              onSubmissionChange={(patch) => setPartTwo((p) => ({ ...p, ...patch }))}
            />
          </div>
        </section>
      )}

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

    <ItemPickerModal
      open={picker !== null}
      title={picker?.title ?? ""}
      categories={picker?.categories ?? []}
      addedKeys={addedKeys}
      onClose={() => setPicker(null)}
      onConfirm={addPickedItems}
      baskets={baskets}
      lineKey={picker?.lineKey ?? null}
      startTab={picker?.tab}
      onLoadBasket={loadBasket}
    />

    {basketForm && (
      <div
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setBasketForm(null);
        }}
      >
        <form
          onSubmit={saveBasket}
          onKeyDown={(e) => {
            if (e.key === "Escape") setBasketForm(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-basket-title"
          className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4"
        >
          <div>
            <h2 id="save-basket-title" className="font-semibold text-gray-800">
              Save as a basket
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Keep these {filledCount} item{filledCount === 1 ? "" : "s"} so a future request can load
              them in one click.
            </p>
          </div>
          <div>
            <label className="label">Basket name *</label>
            <input
              autoFocus
              value={basketForm.name}
              onChange={(e) => setBasketForm({ ...basketForm, name: e.target.value })}
              className="input"
              placeholder="e.g. Staff meals — weekly"
              required
            />
          </div>
          {lineKey && lineName && (
            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={basketForm.linkToLine}
                onChange={(e) => setBasketForm({ ...basketForm, linkToLine: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-green-700"
              />
              <span>
                Offer this basket whenever <strong>{lineName}</strong> is chosen
              </span>
            </label>
          )}
          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={basketForm.saveQuantities}
              onChange={(e) => setBasketForm({ ...basketForm, saveQuantities: e.target.checked })}
              className="mt-0.5 w-4 h-4 accent-green-700"
            />
            <span>Save the quantities too, so they fill in when the basket is loaded</span>
          </label>
          {basketError && <div className="text-sm text-red-600">{basketError}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setBasketForm(null)}
              className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingBasket}
              className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
            >
              {savingBasket ? "Saving…" : "Save basket"}
            </button>
          </div>
        </form>
      </div>
    )}
    </>
  );
}
