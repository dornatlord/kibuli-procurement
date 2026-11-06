import { useState } from "react";
import { PlusIcon, XIcon } from "./icons";

export type Row = Record<string, string>;

export interface Column {
  key: string;
  /** Worded as on the printed form. */
  label: string;
  money?: boolean;
  /** Sizes the column: references and subjects need room, dates don't. */
  kind?: "ref" | "date" | "wide";
  /** The form's own dropdown, where it has one. */
  options?: string[];
}

export interface PartDef<K extends string = string> {
  key: K;
  title: string;
  /** The part's heading as printed on the form. */
  printTitle: string;
  columns: Column[];
  /** Part IV numbers its rows in a "No" column. */
  numbered?: boolean;
  /** The totals row: its label, how many columns the label spans, and the columns that add up. */
  total?: { label: string; span: number; keys: string[] };
}


export const toNumber = (v: string) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
export const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + toNumber(r[key] ?? ""), 0);

/** A column's total, left blank while nothing in the column is filled in. */
export const columnTotal = (rows: Row[], key: string) =>
  rows.some((r) => String(r[key] ?? "").trim()) ? formatMoney(String(sum(rows, key))) : "";

const widthClass = (c: Column) =>
  c.money
    ? "min-w-[8rem] text-right"
    : c.kind === "ref" || c.kind === "wide"
    ? "min-w-[12rem]"
    : c.kind === "date"
    ? "min-w-[7rem]"
    : "min-w-[9rem]";

/** "82926000" → "82,926,000"; text that isn't a number is left as typed. */
export const formatMoney = (v: string) => {
  const t = String(v ?? "").replace(/,/g, "").trim();
  if (!t) return "";
  const n = Number(t);
  return Number.isFinite(n) ? n.toLocaleString("en-UG", { maximumFractionDigits: 2 }) : v;
};

export const blankRow = (def: PartDef): Row => Object.fromEntries(def.columns.map((c) => [c.key, ""]));
export const today = () => new Date().toLocaleDateString("en-GB");
export const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The columns after the totals label: the label spans "No" too where the part has it. */
export const totalColumns = (def: PartDef) => def.columns.slice(def.total!.span - (def.numbered ? 1 : 0));

const cellClass =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-gray-900 transition hover:border-gray-200 focus:border-green-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/15";


export function PartEditor({
  def,
  rows,
  period,
  editable,
  onCell,
  onAdd,
  onRemove,
}: {
  def: PartDef;
  rows: Row[];
  /** "term" or "month", for the empty message. */
  period: string;
  editable: boolean;
  onCell: (index: number, key: string, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{def.title}</h2>
          <p className="text-xs text-gray-500">
            {rows.length ? `${rows.length} row${rows.length === 1 ? "" : "s"}` : `Nothing recorded for this ${period}`}
          </p>
        </div>
        {editable && (
          <button type="button" onClick={onAdd} className="btn btn-secondary btn-sm">
            <PlusIcon className="h-3.5 w-3.5" />
            Add row
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                {def.numbered && <th className="w-12 px-3 py-2.5 align-bottom">No</th>}
                {def.columns.map((c) => (
                  <th key={c.key} className={`px-3 py-2.5 align-bottom ${widthClass(c)}`}>
                    {c.label}
                  </th>
                ))}
                {editable && (
                  <th className="w-10 px-2 py-2.5">
                    <span className="sr-only">Remove</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={i} className="group">
                  {def.numbered && <td className="px-3 py-2 text-gray-400">{i + 1}</td>}
                  {def.columns.map((c) => (
                    <td key={c.key} className="px-1.5 py-1">
                      {!editable ? (
                        <div className={`px-2 py-1.5 ${c.money ? "text-right tabular-nums" : ""}`}>
                          {c.money ? formatMoney(row[c.key] ?? "") : row[c.key]}
                        </div>
                      ) : c.money ? (
                        <MoneyCell value={row[c.key] ?? ""} onChange={(v) => onCell(i, c.key, v)} label={c.label} />
                      ) : c.options ? (
                        <select
                          aria-label={c.label}
                          className={cellClass}
                          value={row[c.key] ?? ""}
                          onChange={(e) => onCell(i, c.key, e.target.value)}
                        >
                          <option value="" />
                          {[...c.options, ...(row[c.key] && !c.options.includes(row[c.key]) ? [row[c.key]] : [])].map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          aria-label={c.label}
                          className={cellClass}
                          value={row[c.key] ?? ""}
                          onChange={(e) => onCell(i, c.key, e.target.value)}
                        />
                      )}
                    </td>
                  ))}
                  {editable && (
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(i)}
                        aria-label={`Remove row ${i + 1}`}
                        className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {def.total && (
              <tfoot className="border-t border-gray-200 bg-gray-50/60">
                <tr>
                  <td
                    colSpan={def.total.span}
                    className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {def.total.label}
                  </td>
                  {totalColumns(def).map((c) => (
                    <td key={c.key} className="px-3.5 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                      {def.total!.keys.includes(c.key) ? columnTotal(rows, c.key) : ""}
                    </td>
                  ))}
                  {editable && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}

/** An amount cell: plain digits while typing, thousands separators otherwise. */
function MoneyCell({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      className={`${cellClass} text-right tabular-nums`}
      value={focused ? value : formatMoney(value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
    />
  );
}

