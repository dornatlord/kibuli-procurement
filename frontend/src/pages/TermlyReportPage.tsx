import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { namesIn, useOfficials } from "../lib/officials";
import Combobox from "../components/Combobox";
import { cornerBadge, flowCss, frameClose, frameOpen, openPrint } from "../lib/print";
import { useAuth } from "../lib/auth";
import PageHeader from "../components/PageHeader";
import ReportTabs from "../components/ReportTabs";
import { PrinterIcon, SpinnerIcon } from "../components/icons";
import {
  PartEditor,
  blankRow,
  columnTotal,
  esc,
  formatMoney,
  today,
  totalColumns,
  type PartDef,
  type Row,
} from "../components/ReportPartEditor";
import { termFor, termMonths, type SchoolTerm } from "../lib/terms";

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

const PARTS: PartDef<PartKey>[] = [
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

export default function TermlyReportPage() {
  const { can } = useAuth();
  const canPrepare = can("reports.prepare");
  const thisYear = new Date().getFullYear();

  const officials = useOfficials();
  const [terms, setTerms] = useState<SchoolTerm[] | null>(null);
  // A link (from Search, say) can open a given return: ?year=2026&term=1.
  const [params] = useSearchParams();
  const askedYear = Number(params.get("year")) || null;
  const askedTerm = Number(params.get("term")) || null;
  const [year, setYear] = useState(() => askedYear ?? thisYear);
  const [term, setTerm] = useState<number | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [parts, setParts] = useState<Parts | null>(null);
  const [declaration, setDeclaration] = useState<Declaration>({ name: "", title: "ACCOUNTING OFFICER", date: today() });
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refilling, setRefilling] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // The office holders load after the report; fill an empty declaration then.
  useEffect(() => {
    const ao = officials.accounting_officer;
    if (!ao || report?.saved?.declaration) return;
    setDeclaration((d) => (d.name ? d : { ...d, name: ao.name, title: ao.title }));
  }, [officials.accounting_officer, report]);

  // Open on the term we're in.
  useEffect(() => {
    api
      .get<SchoolTerm[]>("/settings/terms")
      .then((ts) => {
        setTerms(ts);
        setTerm(
          ts.some((t) => t.term === askedTerm) ? askedTerm : termFor(ts, new Date().getMonth() + 1)?.term ?? 1
        );
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
            // Falls back to the Accounting Officer entered under Officials.
            name: r.lastDeclaration?.name || officials.accounting_officer?.name || "",
            title: r.lastDeclaration?.title || officials.accounting_officer?.title || "ACCOUNTING OFFICER",
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

  function addRow(def: PartDef<PartKey>) {
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
    openPrint(form27Html(year, term, parts, declaration));
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
              period="term"
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
                    {key === "name" ? (
                      <Combobox
                        id="decl-name"
                        value={declaration.name}
                        disabled={!canPrepare}
                        options={namesIn(officials, "accounting_officer", "head_teacher")}
                        onChange={(v) => {
                          setDeclaration((d) => ({ ...d, name: v }));
                          setDirty(true);
                        }}
                      />
                    ) : (
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
                    )}
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

/** FORM 27 laid out as the printed return: header, Parts I–V with totals, declaration. */
/** A name, title or date as words, with no line under it; left blank, a line to write on. */
const written = (value: string) =>
  value.trim() ? `<span class="text">${esc(value.trim())}</span>` : `<span class="line"></span>`;

function form27Html(year: number, term: number, parts: Parts, declaration: Declaration) {
  const table = (def: PartDef<PartKey>) => {
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
${flowCss("landscape")}
body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; }
.c { text-align: center; }
.r { text-align: right; }
td.r { white-space: nowrap; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #000; padding: 3px 4px; vertical-align: top; }
th { font-weight: bold; text-align: left; }
th.part { font-size: 11.5pt; background: #e5e5e5; }
tr.total td { font-weight: bold; }
.meta { width: 40%; margin-top: 8px; }
.meta td:first-child { font-weight: bold; width: 50%; }
.declaration { margin-top: 16px; page-break-inside: avoid; }
.declaration p { margin: 6px 0; }
.line { display: inline-block; min-width: 240px; border-bottom: 1px solid #000; padding: 0 4px 1px; }
.text { display: inline-block; min-width: 240px; padding: 0 4px 1px; }
</style></head><body>
${cornerBadge}
${frameOpen}
<div class="r" style="font-weight:bold;">FORM 27</div>
<div class="r" style="font-style:italic;">Regulation 5(2)</div>
<div class="c" style="margin-top:4px;">THE PUBLIC PROCUREMENT AND DISPOSAL OF PUBLIC ASSETS ACT, 2003</div>
<div class="c" style="font-size:12.5pt;font-weight:bold;margin-top:3px;">QUARTERLY REPORT ON PROCUREMENT AND DISPOSAL CONTRACTS</div>
<div class="c" style="font-weight:bold;margin-top:3px;">KIBULI SECONDARY SCHOOL</div>
<table class="meta">
  <tr><td>Quarter of Reporting</td><td>TERM ${term}</td></tr>
  <tr><td>Financial year</td><td>${year}</td></tr>
</table>
${PARTS.map(table).join("\n")}
<div class="declaration">
  <div style="font-weight:bold;">Declaration</div>
  <p>I hereby certify that the above information is a true and accurate record of the procurement and disposal contracts undertaken by Kibuli Secondary School within the quarter.</p>
  <p>Name: ${written(declaration.name)} &nbsp;&nbsp; Signature: <span class="line"></span></p>
  <p>Title: ${written(declaration.title)}</p>
  <p>Date: ${written(declaration.date)}</p>
</div>
${frameClose}
</body></html>`;
}
