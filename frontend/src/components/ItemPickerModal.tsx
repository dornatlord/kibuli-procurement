import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { basketLineKey, basketLineLabel } from "../lib/baskets";
import type { BasketSummary } from "../lib/baskets";

export interface PriceListItem {
  id: number;
  category: string;
  itemName: string;
  unitOfMeasure: string | null;
  currentPrice: string | null;
  maximumPrice: string | null;
}

type Tab = "items" | "baskets";

interface Props {
  open: boolean;
  /** The budget line the suggestions are for, e.g. "Food expenses". */
  title: string;
  /** Price-list categories suggested for that budget line. Empty = show everything. */
  categories: string[];
  /** Items already on the request, keyed by itemKey(); shown ticked and locked. */
  addedKeys: Set<string>;
  onClose: () => void;
  onConfirm: (items: PriceListItem[]) => void;
  /** Saved baskets, offered on a second tab. Leave out to hide the tab. */
  baskets?: BasketSummary[];
  /** The chosen budget line ("bi:108", "sp:26"); its baskets are listed first. */
  lineKey?: string | null;
  /** Tab to show when the picker opens. */
  startTab?: Tab;
  onLoadBasket?: (basket: BasketSummary) => void;
}

// Kept between openings so the list shows instantly; refreshed when stale.
let cache: PriceListItem[] | null = null;
let fetchedAt = 0;

export function itemKey(name: string, unit: string | null | undefined) {
  return `${name.trim().toLowerCase()}|${(unit ?? "").trim().toLowerCase()}`;
}

function prettyCategory(c: string) {
  return c
    .toLowerCase()
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace("Stationary", "Stationery");
}

const fmt = (v: string | null) => (v ? Number(v).toLocaleString("en-UG") : "—");

const groupHeading =
  "bg-gray-50 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-100";

export default function ItemPickerModal({
  open,
  title,
  categories,
  addedKeys,
  onClose,
  onConfirm,
  baskets,
  lineKey,
  startTab,
  onLoadBasket,
}: Props) {
  const [all, setAll] = useState<PriceListItem[] | null>(cache);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"suggested" | "all">("suggested");
  const [tab, setTab] = useState<Tab>("items");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const hasSuggestions = categories.length > 0;
  const basketsEnabled = !!baskets && !!onLoadBasket;

  function load() {
    setError("");
    fetchedAt = Date.now();
    api
      .get<PriceListItem[]>("/reserve-prices")
      .then((rows) => {
        cache = rows;
        setAll(rows);
      })
      .catch((e) => {
        fetchedAt = 0; // let the next open retry
        setError(e instanceof Error ? e.message : "Could not load the price list");
      });
  }

  // Fetch as soon as the request form renders, so the first open is instant.
  useEffect(() => {
    if (!fetchedAt) load();
  }, []);

  // Start fresh every time the picker opens — before paint, so the right tab
  // shows straight away — and refresh a list more than a minute old so price
  // edits appear without a page reload.
  useLayoutEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(new Set());
    setScope(hasSuggestions ? "suggested" : "all");
    setTab(basketsEnabled && startTab === "baskets" ? "baskets" : "items");
    if (Date.now() - fetchedAt > 60000) load();
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const visible = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    return all.filter(
      (it) =>
        (scope === "all" || categories.includes(it.category)) &&
        (!q || it.itemName.toLowerCase().includes(q))
    );
  }, [all, scope, categories, query]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, PriceListItem[]>();
    for (const it of visible) {
      if (!byCategory.has(it.category)) byCategory.set(it.category, []);
      byCategory.get(it.category)!.push(it);
    }
    return Array.from(byCategory.entries());
  }, [visible]);

  // Baskets for the chosen budget line first, then the rest.
  const { lineBaskets, otherBaskets } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = (baskets ?? []).filter((b) => !q || b.name.toLowerCase().includes(q));
    const forLine = lineKey ? matching.filter((b) => basketLineKey(b) === lineKey) : [];
    return { lineBaskets: forLine, otherBaskets: matching.filter((b) => !forLine.includes(b)) };
  }, [baskets, lineKey, query]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    if (!all || selected.size === 0) return;
    onConfirm(all.filter((it) => selected.has(it.id)));
  }

  if (!open) return null;

  const basketRow = (b: BasketSummary, showLine: boolean) => {
    const line = showLine ? basketLineLabel(b) : null;
    return (
      <div key={b.id} className="flex items-center gap-3 px-5 py-2.5 text-sm border-b border-gray-50">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-800 truncate">{b.name}</div>
          <div className="text-xs text-gray-500 truncate">
            {b.itemCount} item{b.itemCount === 1 ? "" : "s"}
            {Number(b.estimatedValue) > 0 && ` · about UGX ${fmt(b.estimatedValue)}`}
            {line && ` · ${line}`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onLoadBasket?.(b)}
          className="border border-green-700 text-green-700 px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-50 shrink-0"
        >
          Load
        </button>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[85vh]"
      >
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="picker-title" className="font-semibold text-gray-800">
                Choose items
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {tab === "baskets" ? (
                  "Load a saved basket to add all of its items at once."
                ) : (
                  <>
                    {hasSuggestions && (
                      <>
                        Showing the price list for <strong>{title}</strong>.{" "}
                      </>
                    )}
                    Tick what you need — the unit and price fill in for you.
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {basketsEnabled && (
            <div role="tablist" className="flex gap-5 mt-3 border-b border-gray-100 text-sm">
              {(["items", "baskets"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`-mb-px pb-2 border-b-2 font-medium ${
                    tab === t
                      ? "border-green-700 text-green-800"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t === "items" ? "Price list" : `Saved baskets (${(baskets ?? []).length})`}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder={tab === "baskets" ? "Search baskets…" : "Search items…"}
              className="input flex-1"
            />
            {tab === "items" && hasSuggestions && (
              <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs shrink-0">
                {(["suggested", "all"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={`px-3 py-1.5 rounded-md font-medium ${
                      scope === s ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {s === "suggested" ? "Suggested" : "All items"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 min-h-[12rem]">
          {tab === "baskets" ? (
            lineBaskets.length + otherBaskets.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                {(baskets ?? []).length > 0 ? (
                  `No baskets match “${query}”.`
                ) : (
                  <>
                    No saved baskets yet. Tick items on the Price list tab and press Confirm,
                    then use <strong>Save these items as a basket</strong> under the items table.
                  </>
                )}
              </div>
            ) : (
              <>
                {lineBaskets.length > 0 && (
                  <>
                    <div className={groupHeading}>For {title}</div>
                    {lineBaskets.map((b) => basketRow(b, false))}
                  </>
                )}
                {otherBaskets.length > 0 && (
                  <>
                    <div className={groupHeading}>
                      {lineBaskets.length > 0 ? "Other baskets" : "All baskets"}
                    </div>
                    {otherBaskets.map((b) => basketRow(b, true))}
                  </>
                )}
              </>
            )
          ) : !all ? (
            error ? (
              <div className="p-6 text-center text-sm text-red-600">
                {error}{" "}
                <button type="button" onClick={load} className="underline">
                  Try again
                </button>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-gray-400">Loading price list…</div>
            )
          ) : visible.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No items match{query ? ` “${query}”` : ""}
              {scope === "suggested" ? ` in the list for ${title}` : ""}.
              {scope === "suggested" && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setScope("all")}
                    className="text-green-700 hover:underline"
                  >
                    Search all items
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 h-7 bg-white flex items-center gap-3 px-5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold border-b border-gray-100">
                <span className="w-4" />
                <span className="flex-1">Item</span>
                <span className="w-24">Unit</span>
                <span className="w-24 text-right">Price (UGX)</span>
              </div>
              {groups.map(([category, rows]) => (
                <div key={category}>
                  <div className="sticky top-7 bg-gray-50 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    {prettyCategory(category)}
                  </div>
                  {rows.map((it) => {
                    const added = addedKeys.has(itemKey(it.itemName, it.unitOfMeasure));
                    return (
                      <label
                        key={it.id}
                        className={`flex items-center gap-3 px-5 py-2 text-sm border-b border-gray-50 ${
                          added ? "opacity-60" : "cursor-pointer hover:bg-green-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={added || selected.has(it.id)}
                          disabled={added}
                          onChange={() => toggle(it.id)}
                          className="w-4 h-4 accent-green-700"
                        />
                        <span className="flex-1 min-w-0 truncate">{it.itemName}</span>
                        {added && (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
                            Added
                          </span>
                        )}
                        <span className="w-24 text-xs text-gray-500 truncate">{it.unitOfMeasure || "—"}</span>
                        <span className="w-24 text-xs text-gray-800 text-right tabular-nums">
                          {fmt(it.currentPrice)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            {selected.size} selected
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="ml-2 text-xs text-gray-400 hover:text-gray-700 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={selected.size === 0}
              className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
            >
              Confirm{selected.size ? ` (${selected.size})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
