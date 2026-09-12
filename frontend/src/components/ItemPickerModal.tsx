import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";

export interface PriceListItem {
  id: number;
  category: string;
  itemName: string;
  unitOfMeasure: string | null;
  currentPrice: string | null;
  maximumPrice: string | null;
}

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
}

// Kept between openings so the list appears instantly; refreshed on each open.
let cache: PriceListItem[] | null = null;

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

export default function ItemPickerModal({ open, title, categories, addedKeys, onClose, onConfirm }: Props) {
  const [all, setAll] = useState<PriceListItem[] | null>(cache);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"suggested" | "all">("suggested");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const hasSuggestions = categories.length > 0;

  function load() {
    setError("");
    api
      .get<PriceListItem[]>("/reserve-prices")
      .then((rows) => {
        cache = rows;
        setAll(rows);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the price list"));
  }

  // Start fresh every time the picker opens. The cached list shows at once and
  // is refreshed in the background, so price edits appear without a reload.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(new Set());
    setScope(hasSuggestions ? "suggested" : "all");
    load();
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
                {hasSuggestions && (
                  <>
                    Showing the price list for <strong>{title}</strong>.{" "}
                  </>
                )}
                Tick what you need — the unit and price fill in for you.
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

          <div className="flex items-center gap-2 mt-3">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="Search items…"
              className="input flex-1"
            />
            {hasSuggestions && (
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
          {!all ? (
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
