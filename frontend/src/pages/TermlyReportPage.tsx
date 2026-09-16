import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import PageHeader from "../components/PageHeader";
import ReportTabs from "../components/ReportTabs";
import { PlusIcon, PrinterIcon, SpinnerIcon, XIcon } from "../components/icons";
import { termFor, termMonths, type SchoolTerm } from "../lib/terms";

type Row = Record<string, string>;

interface Parts {
  partI: Row[];
  partII: Row[];
  partIII: Row[];
  partIV: Row[];
  partV: Row[];
}
type PartKey = keyof Parts;

interface Declaration {
  name: string;
  title: string;
  date: string;
}

interface SavedReport {
  parts: Parts;
  declaration: Declaration | null;
  updatedAt: string;
  updatedByName: string | null;
}

interface ReportResponse {
  year: number;
  term: number;
  generated: Parts;
  saved: SavedReport | null;
  lastDeclaration: Declaration | null;
}

interface Column {
  key: string;
  /** Worded as on the printed FORM 27. */
  label: string;
  money?: boolean;
  /** Sizes the column: references and subjects need room, dates don't. */
  kind?: "ref" | "date" | "wide";
}

interface PartDef {
  key: PartKey;
  title: string;
  /** The part's heading as printed on FORM 27. */
  printTitle: string;
  columns: Column[];
  /** Part IV numbers its rows in a "No" column. */
  numbered?: boolean;
  /** The totals row: its label, how many columns the label spans, and the columns that add up. */
  total?: { label: string; span: number; keys: string[] };
}

const PARTS: PartDef[] = [
  {
    key: "partI",
    title: "Part I — Procurement contracts awarded (except micro procurement)",
    printTitle: "PART I: PROCUREMENT CONTRACTS AWARDED (except Micro Procurement)",
    columns: [
      { key: "reference", label: "Procurement Reference Number", kind: "ref" },
      { key: "subject", label: "Subject of procurement", kind: "wide" },
      { key: "method", label: "Method of procurement" },
      { key: "provider", label: "Provider" },
      { key: "awardDate", label: "Date of award of contract", kind: "date" },
      { key: "marketPrice", label: "Market price of the procurement", money: true },
      { key: "contractValue", label: "Contract value (Currency and amount)", money: true },
    ],
    total: { label: "TOTAL", span: 5, keys: ["marketPrice", "contractValue"] },
  },
  {
    key: "partII",
    title: "Part II — Procurement contracts amended or varied",
    printTitle: "PART II: PROCUREMENT CONTRACTS AMENDED OR VARIED",
    columns: [
      { key: "reference", label: "Procurement Reference Number", kind: "ref" },
      { key: "subject", label: "Subject of procurement", kind: "wide" },
      { key: "change", label: "Indicate Amendment or variation" },
      { key: "provider", label: "Provider" },
      { key: "date", label: "Date of amendment or variation", kind: "date" },
      { key: "value", label: "Value of amendment or variation (currency and amount if applicable)", money: true },
      { key: "revisedValue", label: "Revised contract value and currency if applicable", money: true },
    ],
  },
  {
    key: "partIII",
    title: "Part III — Procurement contracts completed",
    printTitle: "PART III: PROCUREMENT CONTRACTS COMPLETED",
    columns: [
      { key: "reference", label: "Procurement Reference Number", kind: "ref" },
      { key: "subject", label: "Subject of procurement", kind: "wide" },
      { key: "provider", label: "Provider" },
      { key: "completionDate", label: "Date of completion", kind: "date" },
      { key: "amountPaid", label: "Total amount paid and currency", money: true },
      { key: "contractValue", label: "Contract value (Currency and amount)", money: true },
    ],
    total: { label: "TOTAL", span: 4, keys: ["amountPaid", "contractValue"] },
  },
  {
    key: "partIV",
    title: "Part IV — Report on micro procurements",
    printTitle: "PART IV: REPORT ON MICRO PROCUREMENTS",
    numbered: true,
    columns: [
      { key: "reference", label: "Procurement reference number", kind: "ref" },
      { key: "subject", label: "Subject of procurement", kind: "wide" },
      { key: "provider", label: "Provider" },
      { key: "invoiceAndDate", label: "Invoice and date of delivery/completion" },
      { key: "contractValue", label: "Contract value (Currency and amount)", money: true },
    ],
    total: {
      label: "Total value of micro procurements of the Procuring and Disposing Entity",
      span: 5,
      keys: ["contractValue"],
    },
  },
  {
    key: "partV",
    title: "Part V — Quarterly report on disposal",
    printTitle: "PART V: QUARTERLY REPORT ON DISPOSAL",
    columns: [
      { key: "reference", label: "Disposal reference number", kind: "ref" },
      { key: "subject", label: "Subject of disposal", kind: "wide" },
      { key: "method", label: "Method of disposal" },
      { key: "buyer", label: "Name of buyer" },
      { key: "awardDate", label: "Date of award", kind: "date" },
      { key: "reservePrice", label: "Reserve price", money: true },
      { key: "contractPrice", label: "Contract price (Currency and amount)", money: true },
    ],
    total: { label: "TOTAL", span: 5, keys: ["reservePrice", "contractPrice"] },
  },
];

const toNumber = (v: string) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + toNumber(r[key] ?? ""), 0);

/** A column's total, left blank while nothing in the column is filled in. */
const columnTotal = (rows: Row[], key: string) =>
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
const formatMoney = (v: string) => {
  const t = String(v ?? "").replace(/,/g, "").trim();
  if (!t) return "";
  const n = Number(t);
  return Number.isFinite(n) ? n.toLocaleString("en-UG", { maximumFractionDigits: 2 }) : v;
};

const blankRow = (def: PartDef): Row => Object.fromEntries(def.columns.map((c) => [c.key, ""]));
const today = () => new Date().toLocaleDateString("en-GB");
const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The columns after the totals label: the label spans "No" too where the part has it. */
const totalColumns = (def: PartDef) => def.columns.slice(def.total!.span - (def.numbered ? 1 : 0));

const cellClass =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-gray-900 transition hover:border-gray-200 focus:border-green-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/15";

export default function TermlyReportPage() {
  const { can } = useAuth();
  const canPrepare = can("reports.prepare");
  const thisYear = new Date().getFullYear();

  const [terms, setTerms] = useState<SchoolTerm[] | null>(null);
  const [year, setYear] = useState(thisYear);
  const [term, setTerm] = useState<number | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [parts, setParts] = useState<Parts | null>(null);
  const [declaration, setDeclaration] = useState<Declaration>({ name: "", title: "ACCOUNTING OFFICER", date: today() });
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refilling, setRefilling] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Open on the term we're in.
  useEffect(() => {
    api
      .get<SchoolTerm[]>("/settings/terms")
      .then((ts) => {
        setTerms(ts);
        setTerm(termFor(ts, new Date().getMonth() + 1)?.term ?? 1);
      })
      .catch((e) => {
        setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load the terms" });
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (term === null) return;
    let cancelled = false;
    setLoading(true);
    setNotice(null);
    api
      .get<ReportResponse>(`/termly-report?year=${year}&term=${term}`)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setParts(r.saved?.parts ?? r.generated);
        setDeclaration(
          r.saved?.declaration ?? {
            name: r.lastDeclaration?.name ?? "",
            title: r.lastDeclaration?.title || "ACCOUNTING OFFICER",
            date: today(),
          }
        );
        setDirty(false);
      })
      .catch((e) => {
        if (!cancelled) setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load the report" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, term]);

  function choose(next: { year?: number; term?: number }) {
    if (dirty && !window.confirm("This report has unsaved changes. Leave them?")) return;
    if (next.year !== undefined) setYear(next.year);
    if (next.term !== undefined) setTerm(next.term);
  }

  function updateCell(part: PartKey, index: number, key: string, value: string) {
    setParts((p) => p && { ...p, [part]: p[part].map((row, i) => (i === index ? { ...row, [key]: value } : row)) });
    setDirty(true);
  }

  function addRow(def: PartDef) {
    setParts((p) => p && { ...p, [def.key]: [...p[def.key], blankRow(def)] });
    setDirty(true);
  }

  function removeRow(part: PartKey, index: number) {
    setParts((p) => p && { ...p, [part]: p[part].filter((_, i) => i !== index) });
    setDirty(true);
  }

  async function refill() {
    if (term === null) return;
    if (
      (dirty || report?.saved) &&
      !window.confirm(
        "Replace every row with what the system has recorded for this term? Anything typed by hand will be lost."
      )
    ) {
      return;
    }
    setRefilling(true);
    setNotice(null);
    try {
      const r = await api.get<ReportResponse>(`/termly-report?year=${year}&term=${term}`);
      setReport(r);
      setParts(r.generated);
      setDirty(true);
      setNotice({ tone: "ok", text: "Rows filled from the system's records. Save to keep them." });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not load the records" });
    } finally {
      setRefilling(false);
    }
  }

  async function save() {
    if (!parts || term === null) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await api.put<{ updatedAt: string; updatedByName: string | null }>("/termly-report", {
        year,
        term,
        parts,
        declaration,
      });
      setReport((r) => r && { ...r, saved: { parts, declaration, ...res } });
      setDirty(false);
      setNotice({ tone: "ok", text: "Report saved." });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not save the report" });
    } finally {
      setSaving(false);
    }
  }

  function print() {
    if (!parts || term === null) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(form27Html(year, term, parts, declaration));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  const current = terms?.find((t) => t.term === term) ?? null;
  const years = Array.from(new Set([thisYear - 1, thisYear, thisYear + 1, year])).sort();
  const saved = report?.saved;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Termly report"
        subtitle="PPDA FORM 27 — the quarterly report on procurement and disposal contracts, one for each term."
        actions={<ReportTabs />}
      />

      <div className="card flex flex-wrap items-end justify-between gap-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="fy">
              Financial year
            </label>
            <select id="fy" className="input w-28" value={year} onChange={(e) => choose({ year: Number(e.target.value) })}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="quarter">
              Quarter of reporting
            </label>
            <select
              id="quarter"
              className="input w-full sm:w-72"
              value={term ?? ""}
              onChange={(e) => choose({ term: Number(e.target.value) })}
              disabled={!terms}
            >
              {(terms ?? []).map((t) => (
                <option key={t.term} value={t.term}>
                  Term {t.term} · {termMonths(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="pb-2 text-sm text-gray-500">
            {loading
              ? "Loading…"
              : saved
              ? `Saved ${new Date(saved.updatedAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}${saved.updatedByName ? ` by ${saved.updatedByName}` : ""}`
              : "Not saved yet — filled from the system's records"}
            {dirty && !loading && <span className="font-medium text-amber-700"> · unsaved changes</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPrepare && (
            <button type="button" onClick={refill} disabled={loading || refilling} className="btn btn-secondary">
              {refilling && <SpinnerIcon />}
              Fill from system records
            </button>
          )}
          <button type="button" onClick={print} disabled={!parts || loading} className="btn btn-secondary">
            <PrinterIcon className="h-4 w-4" />
            Print FORM 27
          </button>
          {canPrepare && (
            <button
              type="button"
              onClick={save}
              disabled={saving || loading || !parts || (!dirty && !!saved)}
              className="btn btn-primary"
            >
              {saving ? "Saving…" : "Save report"}
            </button>
          )}
        </div>
      </div>

      {current && can("system.settings") && (
        <p className="-mt-3 text-sm text-gray-500">
          Term {current.term} covers {termMonths(current)}.{" "}
          <Link to="/admin/settings" className="font-medium text-green-700 hover:text-green-800">
            Change term months
          </Link>
        </p>
      )}

      {notice && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.tone === "ok" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading || !parts ? (
        <div className="card flex justify-center py-20">
          <SpinnerIcon className="h-6 w-6 text-green-700" />
        </div>
      ) : (
        <>
          {PARTS.map((def) => (
            <PartEditor
              key={def.key}
              def={def}
              rows={parts[def.key]}
              editable={canPrepare}
              onCell={(i, key, value) => updateCell(def.key, i, key, value)}
              onAdd={() => addRow(def)}
              onRemove={(i) => removeRow(def.key, i)}
            />
          ))}

          <section className="card overflow-hidden">
            <div className="border-b border-gray-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-gray-900">Declaration</h2>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm leading-6 text-gray-600">
                I hereby certify that the above information is a true and accurate record of the procurement and
                disposal contracts undertaken by Kibuli Secondary School within the quarter.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ["name", "Name"],
                    ["title", "Title"],
                    ["date", "Date"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="label" htmlFor={`decl-${key}`}>
                      {label}
                    </label>
                    <input
                      id={`decl-${key}`}
                      className="input"
                      value={declaration[key]}
                      disabled={!canPrepare}
                      onChange={(e) => {
                        setDeclaration((d) => ({ ...d, [key]: e.target.value }));
                        setDirty(true);
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">The Accounting Officer signs the printed copy.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PartEditor({
  def,
  rows,
  editable,
  onCell,
  onAdd,
  onRemove,
}: {
  def: PartDef;
  rows: Row[];
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
            {rows.length ? `${rows.length} row${rows.length === 1 ? "" : "s"}` : "Nothing recorded for this term"}
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

/** FORM 27 laid out as the printed return: header, Parts I–V with totals, declaration. */
function form27Html(year: number, term: number, parts: Parts, declaration: Declaration) {
  const table = (def: PartDef) => {
    const rows = parts[def.key];
    const width = def.columns.length + (def.numbered ? 1 : 0);
    const shown = rows.length ? rows : [blankRow(def), blankRow(def)];
    const body = shown
      .map(
        (row, i) =>
          `<tr>${def.numbered ? `<td class="c">${rows.length ? i + 1 : ""}</td>` : ""}${def.columns
            .map((c) => `<td${c.money ? ' class="r"' : ""}>${esc(c.money ? formatMoney(row[c.key] ?? "") : row[c.key] ?? "")}</td>`)
            .join("")}</tr>`
      )
      .join("");
    const total = def.total
      ? `<tr class="total"><td colspan="${def.total.span}" class="r">${esc(def.total.label)}</td>${totalColumns(def)
          .map(
            (c) => `<td class="r">${def.total!.keys.includes(c.key) ? columnTotal(rows, c.key) : ""}</td>`
          )
          .join("")}</tr>`
      : "";
    return `<table>
  <thead>
    <tr><th colspan="${width}" class="part">${esc(def.printTitle)}</th></tr>
    <tr>${def.numbered ? "<th>No</th>" : ""}${def.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>
  </thead>
  <tbody>${body}${total}</tbody>
</table>`;
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>FORM 27 — Term ${term} ${year}</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #000; margin: 0; }
.c { text-align: center; }
.r { text-align: right; }
td.r { white-space: nowrap; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #000; padding: 3px 4px; vertical-align: top; }
th { font-weight: bold; text-align: left; }
th.part { font-size: 9.5px; background: #e5e5e5; }
tr.total td { font-weight: bold; }
.meta { width: 40%; margin-top: 8px; }
.meta td:first-child { font-weight: bold; width: 50%; }
.declaration { margin-top: 16px; page-break-inside: avoid; }
.declaration p { margin: 6px 0; }
.line { display: inline-block; min-width: 240px; border-bottom: 1px solid #000; padding: 0 4px 1px; }
</style></head><body>
<div class="r" style="font-weight:bold;font-size:10px;">FORM 27</div>
<div class="r" style="font-style:italic;">Regulation 5(2)</div>
<div class="c" style="font-size:10px;margin-top:4px;">THE PUBLIC PROCUREMENT AND DISPOSAL OF PUBLIC ASSETS ACT, 2003</div>
<div class="c" style="font-size:11px;font-weight:bold;margin-top:3px;">QUARTERLY REPORT ON PROCUREMENT AND DISPOSAL CONTRACTS</div>
<div class="c" style="font-size:10px;font-weight:bold;margin-top:3px;">KIBULI SECONDARY SCHOOL</div>
<table class="meta">
  <tr><td>Quarter of Reporting</td><td>TERM ${term}</td></tr>
  <tr><td>Financial year</td><td>${year}</td></tr>
</table>
${PARTS.map(table).join("\n")}
<div class="declaration">
  <div style="font-weight:bold;">Declaration</div>
  <p>I hereby certify that the above information is a true and accurate record of the procurement and disposal contracts undertaken by Kibuli Secondary School within the quarter.</p>
  <p>Name: <span class="line">${esc(declaration.name)}</span> &nbsp;&nbsp; Signature: <span class="line"></span></p>
  <p>Title: <span class="line">${esc(declaration.title)}</span></p>
  <p>Date: <span class="line">${esc(declaration.date)}</span></p>
</div>
</body></html>`;
}
