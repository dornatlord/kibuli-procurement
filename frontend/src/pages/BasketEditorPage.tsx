import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import ItemPickerModal, { itemKey } from "../components/ItemPickerModal";
import type { PriceListItem } from "../components/ItemPickerModal";
import { basketLineKey, lineIds, money } from "../lib/baskets";
import type { BasketDetail, BudgetLine } from "../lib/baskets";
import { PageLoading } from "../components/Loading";

interface Row {
  key: string;
  reservePriceItemId: number | null;
  /** Name, unit and price come from the live price list and aren't edited here. */
  fromPriceList: boolean;
  description: string;
  unitOfMeasure: string;
  unitCost: string;
  defaultQuantity: string;
}

const newKey = () => Math.random().toString(36).slice(2);
/** "4500.00" → "4500" for number inputs. */
const plain = (v: string | null) => (v ? String(Number(v)) : "");
const emptyRow = (): Row => ({
  key: newKey(),
  reservePriceItemId: null,
  fromPriceList: false,
  description: "",
  unitOfMeasure: "",
  unitCost: "",
  defaultQuantity: "",
});

export default function BasketEditorPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [lineKey, setLineKey] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    api.get<BudgetLine[]>("/lookup/budget-lines").then(setLines).catch(() => setLines([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api
      .get<BasketDetail>(`/baskets/${id}`)
      .then((b) => {
        setName(b.name);
        setDescription(b.description ?? "");
        setLineKey(basketLineKey(b) ?? "");
        setCanEdit(b.canEdit);
        setRows(
          b.items.map((it) => ({
            key: newKey(),
            reservePriceItemId: it.reservePriceItemId,
            fromPriceList: it.fromPriceList,
            description: it.description,
            unitOfMeasure: it.unitOfMeasure ?? "",
            unitCost: plain(it.unitCost),
            defaultQuantity: plain(it.defaultQuantity),
          }))
        );
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const line = lines.find((l) => l.key === lineKey) ?? null;

  // Budget lines grouped under their vote for the <select>.
  const voteGroups = useMemo(() => {
    const groups: { label: string; lines: BudgetLine[] }[] = [];
    for (const l of lines) {
      const label = `${l.voteCode} — ${l.voteName}`;
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.lines.push(l);
      else groups.push({ label, lines: [l] });
    }
    return groups;
  }, [lines]);

  const addedKeys = useMemo(
    () =>
      new Set(
        rows
          .filter((r) => r.description.trim())
          .map((r) => itemKey(r.description, r.unitOfMeasure))
      ),
    [rows]
  );

  const total = rows.reduce(
    (sum, r) => sum + (Number(r.defaultQuantity) || 0) * (Number(r.unitCost) || 0),
    0
  );

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addPicked(picked: PriceListItem[]) {
    setRows((prev) => [
      ...prev,
      ...picked.map((p): Row => ({
        key: newKey(),
        reservePriceItemId: p.id,
        fromPriceList: true,
        description: p.itemName,
        unitOfMeasure: p.unitOfMeasure ?? "",
        unitCost: plain(p.currentPrice),
        defaultQuantity: "",
      })),
    ]);
    setPickerOpen(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body = {
      name,
      description,
      ...lineIds(lineKey || null),
      items: rows
        .filter((r) => r.description.trim())
        .map((r) => ({
          reservePriceItemId: r.reservePriceItemId,
          description: r.description,
          unitOfMeasure: r.unitOfMeasure || null,
          unitCost: r.unitCost || null,
          defaultQuantity: r.defaultQuantity || null,
        })),
    };
    try {
      if (isNew) await api.post("/baskets", body);
      else await api.put(`/baskets/${id}`, body);
      navigate("/baskets");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save the basket");
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove the basket “${name}”? Requests already made from it are not affected.`)) {
      return;
    }
    try {
      await api.delete(`/baskets/${id}`);
      navigate("/baskets");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not remove the basket");
    }
  }

  if (loading) return <PageLoading />;

  if (notFound) {
    return (
      <div className="space-y-3">
        <Link to="/baskets" className="text-sm text-green-700 hover:underline">
          ← Saved Baskets
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-500">
          This basket doesn't exist or has been removed.
        </div>
      </div>
    );
  }

  const readOnly = !canEdit;

  return (
    <>
      <form onSubmit={save} className="max-w-4xl space-y-6">
        <div>
          <Link to="/baskets" className="text-xs text-green-700 hover:underline">
            ← Saved Baskets
          </Link>
          <h1 className="page-title mt-1">
            {isNew ? "New Basket" : name || "Basket"}
          </h1>
        </div>

        {readOnly && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2 text-sm">
            Only the person who made this basket, or the procurement unit, can change it. You can
            still load it into a request.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="label">Basket name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="e.g. Staff meals — weekly"
              required
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="label">Offer it when this budget line is chosen</label>
            <select
              value={lineKey}
              onChange={(e) => setLineKey(e.target.value)}
              className="input"
              disabled={readOnly}
            >
              <option value="">— Any budget line —</option>
              {voteGroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.lines.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.subProgrammeName ? `${l.subProgrammeName} › ${l.name}` : l.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              placeholder="Optional — e.g. one week of breakfast for 40 staff"
              disabled={readOnly}
            />
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="bg-green-800 text-white px-4 py-2 text-sm font-semibold">ITEMS</div>
          <div className="p-4 space-y-2">
            {rows.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">
                No items yet — add them from the price list.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-2 py-2 text-left w-8">#</th>
                      <th className="px-2 py-2 text-left">Item</th>
                      <th className="px-2 py-2 text-left w-28">Unit</th>
                      <th className="px-2 py-2 text-right w-24">Usual qty</th>
                      <th className="px-2 py-2 text-right w-32">Unit price</th>
                      <th className="px-2 py-2 text-right w-32">Value</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, i) => {
                      const value = (Number(r.defaultQuantity) || 0) * (Number(r.unitCost) || 0);
                      return (
                        <tr key={r.key}>
                          <td className="px-2 py-2 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-2 py-2">
                            {r.fromPriceList ? (
                              <span className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{r.description}</span>
                                <span className="shrink-0 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                  price list
                                </span>
                              </span>
                            ) : (
                              <input
                                value={r.description}
                                onChange={(e) => update(r.key, { description: e.target.value })}
                                className="input text-xs"
                                placeholder="Item description"
                                required
                                disabled={readOnly}
                              />
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {r.fromPriceList ? (
                              <span className="text-xs text-gray-600">{r.unitOfMeasure || "—"}</span>
                            ) : (
                              <input
                                value={r.unitOfMeasure}
                                onChange={(e) => update(r.key, { unitOfMeasure: e.target.value })}
                                className="input text-xs"
                                placeholder="pcs / kg…"
                                disabled={readOnly}
                              />
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={r.defaultQuantity}
                              onChange={(e) => update(r.key, { defaultQuantity: e.target.value })}
                              className="input text-xs text-right"
                              placeholder="—"
                              min="0"
                              step="0.01"
                              disabled={readOnly}
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            {r.fromPriceList ? (
                              <span className="text-xs text-gray-700">{money(r.unitCost || null)}</span>
                            ) : (
                              <input
                                type="number"
                                value={r.unitCost}
                                onChange={(e) => update(r.key, { unitCost: e.target.value })}
                                className="input text-xs text-right"
                                min="0"
                                step="1"
                                disabled={readOnly}
                              />
                            )}
                          </td>
                          <td className="px-2 py-2 text-right text-xs text-gray-700 font-medium">
                            {value ? money(value) : "—"}
                          </td>
                          <td className="px-2 py-2">
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                                aria-label={`Remove ${r.description || "item"}`}
                                className="text-red-400 hover:text-red-600 text-xs"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td colSpan={5} className="px-2 py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                        Estimated value
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-semibold text-gray-800">
                        {total ? money(total) : "—"}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {!readOnly && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="border border-green-700 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-50"
                >
                  Add from price list
                </button>
                <button
                  type="button"
                  onClick={() => setRows((prev) => [...prev, emptyRow()])}
                  className="text-sm text-green-700 hover:text-green-900 font-medium"
                >
                  + Add an item that isn't on the price list
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400">
              Items marked “price list” always use the current price when the basket is loaded.
              Leave the usual quantity blank if it changes every time.
            </p>
          </div>
        </section>

        {!readOnly && (
          <div className="flex items-center gap-3">
            {!isNew && (
              <button type="button" onClick={remove} className="text-sm text-red-600 hover:underline">
                Remove basket
              </button>
            )}
            <div className="ml-auto flex gap-3">
              <button
                type="button"
                onClick={() => navigate("/baskets")}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary px-6"
              >
                {saving ? "Saving…" : "Save basket"}
              </button>
            </div>
          </div>
        )}
      </form>

      <ItemPickerModal
        open={pickerOpen}
        title={line?.name ?? ""}
        categories={line?.priceCategories ?? []}
        addedKeys={addedKeys}
        onClose={() => setPickerOpen(false)}
        onConfirm={addPicked}
      />
    </>
  );
}
