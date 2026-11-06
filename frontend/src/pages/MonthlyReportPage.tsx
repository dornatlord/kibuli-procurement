import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { namesIn, useOfficials } from "../lib/officials";
import Combobox from "../components/Combobox";
import PageHeader from "../components/PageHeader";
import ReportTabs from "../components/ReportTabs";
import { DownloadIcon, PrinterIcon, SpinnerIcon } from "../components/icons";
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
import { cornerBadge, flowCss, frameClose, frameOpen, openPrint } from "../lib/print";
import {
  TEMPLATE_CAPACITY,
  buildMonthlyWorkbook,
  downloadBlob,
  financialYear,
  overflowMessage,
} from "../lib/forms/monthlyExcel";

interface Parts {
  partI: Row[];
  partII: Row[];
  partIII: Row[];
  partIV: Row[];
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
  month: number;
  generated: Parts;
  saved: SavedReport | null;
  lastDeclaration: Declaration | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const METHODS = [
  "Direct Procurement",
  "Open Domestic Bidding",
  "Open International Bidding(OIB)",
  "Quotations Method",
  "Restricted Domestic Bidding (RDB)",
  "Restricted International Bidding (RIB)",
  "Micro Procurement",
];
const YES_NO = ["Yes", "No"];
const CATEGORIES = ["Foreign", "National", "Resident", "EAC"];
const TARGET_GROUPS = ["Women", "Youth", "Person With Disability (PWD)"];

/** FORM 2's four parts, worded as in PPDA's Excel template. */
const PARTS: PartDef<PartKey>[] = [
  {
    key: "partI",
    title: "Part I — Contracts awarded (except micro procurement)",
    printTitle: "PART I A: CONTRACTS AWARDED (except Micro Procurement)",
    columns: [
      { key: "reference", label: "Procurement Reference Number", kind: "ref" },
      { key: "subject", label: "Subject of procurement", kind: "wide" },
      { key: "method", label: "Method of procurement", options: METHODS },
      { key: "provider", label: "Provider" },
      { key: "reserved", label: "Reservation/Preference Schemes (Yes/No)", options: YES_NO },
      { key: "providerCategory", label: "Category of Provider (Foreign/National/Resident/EAC)", options: CATEGORIES },
      { key: "targetGroup", label: "Target Group (Women/Youth/Persons with Disability)", options: TARGET_GROUPS },
      { key: "awardDate", label: "Date of Award", kind: "date" },
      { key: "marketPrice", label: "Market Price of the Procurement", money: true },
      { key: "bidPrice", label: "Bid price at Opening", money: true },
      { key: "contractValue", label: "Contract value (Currency and amount)", money: true },
      { key: "ownership", label: "Beneficial Ownership (Names and Address)" },
    ],
    total: { label: "TOTAL", span: 10, keys: ["contractValue"] },
  },
  {
    key: "partII",
    title: "Part II — Contracts amended",
    printTitle: "PART II: CONTRACTS AMENDED",
    columns: [
      { key: "reference", label: "Procurement Reference Number", kind: "ref" },
      { key: "subject", label: "Subject of procurement", kind: "wide" },
      { key: "provider", label: "Provider" },
      { key: "date", label: "Date of Amendment", kind: "date" },
      { key: "value", label: "Value of Amendment (Currency and Amount if Applicable)", money: true },
      { key: "revisedValue", label: "Revised Contract Value and (Currency if Applicable)", money: true },
    ],
  },
  {
    key: "partIII",
    title: "Part III — Contracts completed",
    printTitle: "PART III: CONTRACTS COMPLETED",
    columns: [
      { key: "reference", label: "Procurement Reference Number", kind: "ref" },
      { key: "subject", label: "Subject of Procurement", kind: "wide" },
      { key: "provider", label: "Provider" },
      { key: "reserved", label: "Reservation or Preference Schemes (Yes/No)", options: YES_NO },
      { key: "providerCategory", label: "Category of Provider (Foreign or National Resident or EAC)", options: CATEGORIES },
      { key: "completionDate", label: "Date of Completion", kind: "date" },
      { key: "amountPaid", label: "Total amount Paid and Currency", money: true },
      { key: "contractValue", label: "Contract Value (Currency and amount)", money: true },
    ],
    total: { label: "TOTAL", span: 6, keys: ["amountPaid", "contractValue"] },
  },
  {
    key: "partIV",
    title: "Part IV — Micro procurements",
    printTitle: "PART IV 4A and 4B: MICRO PROCUREMENTS & MICRO PROCUREMENTS TO TARGET GROUPS",
    columns: [
      { key: "reference", label: "Procurement Reference Number", kind: "ref" },
      { key: "subject", label: "Subject of Procurement", kind: "wide" },
      { key: "method", label: "Method of Procurement", options: METHODS },
      { key: "provider", label: "Provider" },
      { key: "targetGroup", label: "Target Group (Women, Youth or Persons with Disability)", options: TARGET_GROUPS },
      { key: "awardDate", label: "Date of Award", kind: "date" },
      { key: "invoiceAndDate", label: "Invoice and Date of Completion" },
      { key: "marketPrice", label: "Market Price of the Procurement", money: true },
      { key: "contractValue", label: "Contract Value (Currency and Amount)", money: true },
      { key: "ownership", label: "Beneficial Ownership (Names and Address)" },
    ],
    total: { label: "TOTAL", span: 8, keys: ["contractValue"] },
  },
];

export default function MonthlyReportPage() {
  const { can } = useAuth();
  const canPrepare = can("reports.prepare");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const officials = useOfficials();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [parts, setParts] = useState<Parts | null>(null);
  const [declaration, setDeclaration] = useState<Declaration>({ name: "", title: "ACCOUNTING OFFICER", date: today() });
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refilling, setRefilling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // The office holders load after the report; fill an empty declaration then.
  useEffect(() => {
    const ao = officials.accounting_officer;
    if (!ao || report?.saved?.declaration) return;
    setDeclaration((d) => (d.name ? d : { ...d, name: ao.name, title: ao.title }));
  }, [officials.accounting_officer, report]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotice(null);
    api
      .get<ReportResponse>(`/monthly-report?year=${year}&month=${month}`)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setParts(r.saved?.parts ?? r.generated);
        setDeclaration(
          r.saved?.declaration ?? {
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
  }, [year, month]);

  if (!can("reports.view")) return <Navigate to="/dashboard" replace />;

  function choose(next: { year?: number; month?: number }) {
    if (dirty && !window.confirm("This report has unsaved changes. Leave them?")) return;
    if (next.year !== undefined) setYear(next.year);
    if (next.month !== undefined) setMonth(next.month);
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
    if (
      (dirty || report?.saved) &&
      !window.confirm(
        "Replace every row with what the system has recorded for this month? Anything typed by hand will be lost."
      )
    ) {
      return;
    }
    setRefilling(true);
    setNotice(null);
    try {
      const r = await api.get<ReportResponse>(`/monthly-report?year=${year}&month=${month}`);
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
    if (!parts) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await api.put<{ updatedAt: string; updatedByName: string | null }>("/monthly-report", {
        year,
        month,
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

  /** PPDA takes this return as its Excel template, filled in as it stands on screen: all four parts in one file. */
  async function exportExcel() {
    if (!parts) return;
    setExporting(true);
    setNotice(null);
    try {
      const blob = await buildMonthlyWorkbook({
        year,
        month,
        entity: "Kibuli Secondary School",
        parts,
        declaration,
      });
      downloadBlob(blob, `FORM 2 Monthly Report - ${MONTHS[month - 1]} ${year}.xlsx`);
      setNotice({
        tone: "ok",
        text: dirty
          ? "Excel file downloaded, with the changes on screen. They aren't saved yet."
          : "Excel file downloaded: all four parts are in it. Open it, check it, and send it to PPDA.",
      });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Could not make the Excel file" });
    } finally {
      setExporting(false);
    }
  }

  function print() {
    if (!parts) return;
    openPrint(form2Html(year, month, parts, declaration));
  }

  const years = Array.from(new Set([now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, year])).sort();
  const saved = report?.saved;
  const tooLong = parts ? overflowMessage(parts) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly report"
        subtitle="PPDA FORM 2 — the monthly procurement return. Filled from the system's records; correct anything, then export it as the Excel file PPDA asks for."
        actions={<ReportTabs />}
      />

      <div className="card flex flex-wrap items-end justify-between gap-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="month">
              Month of reporting
            </label>
            <select id="month" value={month} onChange={(e) => choose({ month: Number(e.target.value) })} className="input w-40">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="year">
              Year
            </label>
            <select id="year" value={year} onChange={(e) => choose({ year: Number(e.target.value) })} className="input w-28">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
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
            Print FORM 2
          </button>
          <button type="button" onClick={exportExcel} disabled={!parts || loading || exporting} className="btn btn-secondary">
            {exporting ? <SpinnerIcon /> : <DownloadIcon className="h-4 w-4" />}
            Export to Excel
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

      <p className="-mt-3 text-sm text-gray-500">
        Financial year {financialYear(year, month)}. The Excel file is PPDA's own template, filled in. Its parts hold{" "}
        {TEMPLATE_CAPACITY.partI}, {TEMPLATE_CAPACITY.partII}, {TEMPLATE_CAPACITY.partIII} and {TEMPLATE_CAPACITY.partIV} rows.
      </p>

      {notice && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.tone === "ok" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}
      {tooLong && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {tooLong}. The Excel file can't be made until the extra rows are removed.
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
              period="month"
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
                I hereby certify that the above information is a true and accurate record of the procurements undertaken by
                Kibuli Secondary School within the month.
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
              <p className="text-xs text-gray-400">
                The Accounting Officer signs the printed copy. In the Excel file these fill the declaration under Part IV.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** A name, title or date as words, with no line under it; left blank, a line to write on. */
const written = (value: string) =>
  value.trim() ? `<span class="text">${esc(value.trim())}</span>` : `<span class="line"></span>`;

/** FORM 2 laid out as the printed return: header, Parts I–IV, declaration. */
function form2Html(year: number, month: number, parts: Parts, declaration: Declaration) {
  const table = (def: PartDef<PartKey>) => {
    const rows = parts[def.key];
    const shown = rows.length ? rows : [blankRow(def), blankRow(def)];
    const body = shown
      .map(
        (row) =>
          `<tr>${def.columns
            .map((c) => `<td${c.money ? ' class="r"' : ""}>${esc(c.money ? formatMoney(row[c.key] ?? "") : row[c.key] ?? "")}</td>`)
            .join("")}</tr>`
      )
      .join("");
    const total = def.total
      ? `<tr class="total"><td colspan="${def.total.span}" class="r">${esc(def.total.label)}</td>${totalColumns(def)
          .map((c) => `<td class="r">${def.total!.keys.includes(c.key) ? columnTotal(rows, c.key) : ""}</td>`)
          .join("")}</tr>`
      : "";
    return `<table>
  <thead>
    <tr><th colspan="${def.columns.length}" class="part">${esc(def.printTitle)}</th></tr>
    <tr>${def.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>
  </thead>
  <tbody>${body}${total}</tbody>
</table>`;
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>FORM 2 — ${MONTHS[month - 1]} ${year}</title>
<style>
${flowCss("landscape")}
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; }
.c { text-align: center; }
.r { text-align: right; }
td.r { white-space: nowrap; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #000; padding: 3px 4px; vertical-align: top; }
th { font-weight: bold; text-align: left; }
th.part { font-size: 11pt; background: #e5e5e5; }
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
<div class="r" style="font-weight:bold;">FORM 2</div>
<div class="r" style="font-style:italic;">Regulation 15(1)</div>
<div class="c" style="margin-top:4px;">THE PUBLIC PROCUREMENT AND DISPOSAL OF PUBLIC ASSETS ACT, 2003</div>
<div class="c" style="font-size:12.5pt;font-weight:bold;margin-top:3px;">MONTHLY REPORT ON PROCUREMENT</div>
<div class="c" style="font-weight:bold;margin-top:3px;">KIBULI SECONDARY SCHOOL</div>
<table class="meta">
  <tr><td>Month of Reporting</td><td>${MONTHS[month - 1].toUpperCase()}</td></tr>
  <tr><td>Financial Year</td><td>${financialYear(year, month)}</td></tr>
</table>
${PARTS.map(table).join("\n")}
<div class="declaration">
  <div style="font-weight:bold;">Declaration</div>
  <p>I hereby certify that the above information is a true and accurate record of the procurements undertaken by the Entity within the month.</p>
  <p>Name: ${written(declaration.name)} &nbsp;&nbsp; Signature: <span class="line"></span></p>
  <p>Title: ${written(declaration.title)}</p>
  <p>Date: ${written(declaration.date)}</p>
  <p style="margin-top:12px;">Attach relevant minutes of the Contracts Committee<br/>Copy: Contracts Committee</p>
</div>
${frameClose}
</body></html>`;
}
