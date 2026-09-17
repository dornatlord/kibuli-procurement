import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ReportTabs from "../components/ReportTabs";
import { PrinterIcon } from "../components/icons";
import { PageLoading } from "../components/Loading";

interface PartI {
  referenceNumber: string;
  subject: string | null;
  category: string;
  dateOfAward: string;
  marketPrice: string | null;
  contractValue: string | null;
  providerName: string | null;
  providerCategory: string | null;
  targetGroup: string | null;
  ownerNames: string | null;
}
interface PartII {
  contractNumber: string;
  subject: string;
  providerName: string | null;
  amendmentDate: string;
  valueChange: string | null;
  revisedContractValue: string | null;
  referenceNumber: string | null;
}
interface PartIII {
  contractNumber: string;
  subject: string;
  providerName: string | null;
  providerCategory: string | null;
  contractValue: string | null;
  referenceNumber: string | null;
}
interface PartIV {
  referenceNumber: string;
  subject: string | null;
  dateOfAward: string;
  estimatedTotalCost: string | null;
  itemDescription: string | null;
}
interface ReportData {
  year: number;
  month: number;
  partI: PartI[];
  partII: PartII[];
  partIII: PartIII[];
  partIV: PartIV[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmt(v: string | null) {
  return v ? Number(v).toLocaleString("en-UG") : "";
}

export default function MonthlyReportPage() {
  const { can } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  if (!can("reports.view")) return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    setLoading(true);
    api.get<ReportData>(`/monthly-report?year=${year}&month=${month}`).then(setData).finally(() => setLoading(false));
  }, [year, month]);

  function printReport() {
    if (!data) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Monthly Report — ${MONTHS[month - 1]} ${year}</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family: Arial, sans-serif; font-size:9px; color:#000; padding:12mm 15mm; }
table { width:100%; border-collapse:collapse; margin-top:6px; margin-bottom:14px; }
td,th { border:1px solid #000; padding:3px 4px; }
.hdr { text-align:center; }
.part { font-weight:bold; background:#eee; text-align:center; padding:4px; margin-top:14px; }
@page { size:A4 landscape; margin:0; }
</style></head><body>
  <div class="hdr" style="font-size:11px;font-weight:bold;">FORM 2 — Regulation 15(1)</div>
  <div class="hdr" style="font-size:10px;">THE PUBLIC PROCUREMENT AND DISPOSAL OF PUBLIC ASSETS ACT, 2003</div>
  <div class="hdr" style="font-size:11px;font-weight:bold;">MONTHLY REPORT ON PROCUREMENT</div>
  <div class="hdr">KIBULI SECONDARY SCHOOL — ${MONTHS[month - 1]} ${year}</div>

  <div class="part">PART I: CONTRACTS AWARDED (except Micro Procurements)</div>
  <table>
    <tr><th>Ref No</th><th>Subject</th><th>Category</th><th>Provider</th><th>Provider Category</th><th>Target Group</th><th>Date of Award</th><th>Market Price</th><th>Contract Value</th><th>Beneficial Ownership</th></tr>
    ${data.partI.map((r) => `<tr><td>${r.referenceNumber}</td><td>${r.subject || ""}</td><td>${r.category}</td><td>${r.providerName || ""}</td><td>${r.providerCategory || ""}</td><td>${r.targetGroup || ""}</td><td>${new Date(r.dateOfAward).toLocaleDateString("en-UG")}</td><td style="text-align:right;">${fmt(r.marketPrice)}</td><td style="text-align:right;">${fmt(r.contractValue)}</td><td>${r.ownerNames || ""}</td></tr>`).join("") || `<tr><td colspan="10" style="text-align:center;color:#888;">No contracts awarded this month</td></tr>`}
  </table>

  <div class="part">PART II: CONTRACTS AMENDED</div>
  <table>
    <tr><th>Ref No</th><th>Contract No</th><th>Subject</th><th>Provider</th><th>Date of Amendment</th><th>Value of Amendment</th><th>Revised Contract Value</th></tr>
    ${data.partII.map((r) => `<tr><td>${r.referenceNumber || ""}</td><td>${r.contractNumber}</td><td>${r.subject}</td><td>${r.providerName || ""}</td><td>${new Date(r.amendmentDate).toLocaleDateString("en-UG")}</td><td style="text-align:right;">${fmt(r.valueChange)}</td><td style="text-align:right;">${fmt(r.revisedContractValue)}</td></tr>`).join("") || `<tr><td colspan="7" style="text-align:center;color:#888;">No amendments this month</td></tr>`}
  </table>

  <div class="part">PART III: CONTRACTS COMPLETED</div>
  <table>
    <tr><th>Ref No</th><th>Contract No</th><th>Subject</th><th>Provider</th><th>Category</th><th>Contract Value</th></tr>
    ${data.partIII.map((r) => `<tr><td>${r.referenceNumber || ""}</td><td>${r.contractNumber}</td><td>${r.subject}</td><td>${r.providerName || ""}</td><td>${r.providerCategory || ""}</td><td style="text-align:right;">${fmt(r.contractValue)}</td></tr>`).join("") || `<tr><td colspan="6" style="text-align:center;color:#888;">No contracts completed this month</td></tr>`}
  </table>

  <div class="part">PART IV: MICRO PROCUREMENTS</div>
  <table>
    <tr><th>Ref No</th><th>Subject</th><th>Item</th><th>Date of Award</th><th>Value</th></tr>
    ${data.partIV.map((r) => `<tr><td>${r.referenceNumber}</td><td>${r.subject || ""}</td><td>${r.itemDescription || ""}</td><td>${new Date(r.dateOfAward).toLocaleDateString("en-UG")}</td><td style="text-align:right;">${fmt(r.estimatedTotalCost)}</td></tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:#888;">No micro procurements this month</td></tr>`}
  </table>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly report"
        subtitle="PPDA FORM 2 — the monthly procurement return."
        actions={<ReportTabs />}
      />

      <div className="card flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="month">Month</label>
            <select id="month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="input w-40">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="year">Year</label>
            <select id="year" value={year} onChange={(e) => setYear(Number(e.target.value))} className="input w-28">
              {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <button type="button" onClick={printReport} className="btn btn-secondary">
          <PrinterIcon className="h-4 w-4" />
          Print FORM 2
        </button>
      </div>

      {loading ? (
        <div className="card">
          <PageLoading label="Putting the report together…" />
        </div>
      ) : data && (
        <div className="space-y-6">
          <ReportSection title="Part I — Contracts Awarded (except Micro)" empty={data.partI.length === 0}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr><th className="px-3 py-2 text-left">Ref No</th><th className="px-3 py-2 text-left">Subject</th><th className="px-3 py-2 text-left">Provider</th><th className="px-3 py-2 text-right">Contract Value</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.partI.map((r, i) => (
                  <tr key={i}><td className="px-3 py-2 font-mono text-xs">{r.referenceNumber}</td><td className="px-3 py-2">{r.subject}</td><td className="px-3 py-2">{r.providerName || "—"}</td><td className="px-3 py-2 text-right">{fmt(r.contractValue)}</td></tr>
                ))}
              </tbody>
            </table>
          </ReportSection>

          <ReportSection title="Part II — Contracts Amended" empty={data.partII.length === 0}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr><th className="px-3 py-2 text-left">Contract No</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Revised Value</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.partII.map((r, i) => (
                  <tr key={i}><td className="px-3 py-2 font-mono text-xs">{r.contractNumber}</td><td className="px-3 py-2">{r.subject}</td><td className="px-3 py-2 text-right">{fmt(r.revisedContractValue)}</td></tr>
                ))}
              </tbody>
            </table>
          </ReportSection>

          <ReportSection title="Part III — Contracts Completed" empty={data.partIII.length === 0}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr><th className="px-3 py-2 text-left">Contract No</th><th className="px-3 py-2 text-left">Subject</th><th className="px-3 py-2 text-right">Value</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.partIII.map((r, i) => (
                  <tr key={i}><td className="px-3 py-2 font-mono text-xs">{r.contractNumber}</td><td className="px-3 py-2">{r.subject}</td><td className="px-3 py-2 text-right">{fmt(r.contractValue)}</td></tr>
                ))}
              </tbody>
            </table>
          </ReportSection>

          <ReportSection title="Part IV — Micro Procurements" empty={data.partIV.length === 0}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr><th className="px-3 py-2 text-left">Ref No</th><th className="px-3 py-2 text-left">Subject</th><th className="px-3 py-2 text-right">Value</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.partIV.map((r, i) => (
                  <tr key={i}><td className="px-3 py-2 font-mono text-xs">{r.referenceNumber}</td><td className="px-3 py-2">{r.subject}</td><td className="px-3 py-2 text-right">{fmt(r.estimatedTotalCost)}</td></tr>
                ))}
              </tbody>
            </table>
          </ReportSection>
        </div>
      )}
    </div>
  );
}

function ReportSection({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-gray-200 px-5 py-3.5 text-sm font-semibold text-gray-900">{title}</div>
      {empty ? <div className="px-5 py-8 text-center text-sm text-gray-400">Nothing to report.</div> : children}
    </div>
  );
}
