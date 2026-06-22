import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import StatusBadge from "../components/StatusBadge";

interface LineItem {
  id: number;
  itemNo: number;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  estimatedUnitCost: string;
  marketPrice: string;
  totalCost: string;
}

interface Signature {
  id: number;
  role: string;
  name: string;
  title: string;
  signedAt: string;
}

interface Request {
  id: number;
  referenceNumber: string;
  category: string;
  yearType: string;
  year: number;
  weekNumber: number;
  budgetCategory: string;
  procurementSize: string;
  subjectOfProcurement: string;
  procurementPlanReference: string;
  locationForDelivery: string;
  dateRequired: string;
  estimatedTotalCost: string;
  isMultiyear: boolean;
  status: string;
  createdAt: string;
  items: LineItem[];
  signatures: Signature[];
  decision: unknown;
}

const NEXT_STATUS: Record<string, { role: string; label: string; next: string }[]> = {
  draft: [{ role: "user_dept_member", label: "Submit to HoD", next: "pending_hod" }],
  pending_hod: [
    { role: "head_of_dept", label: "Approve → Accounting Officer", next: "pending_accounting_officer" },
    { role: "head_of_dept", label: "Reject", next: "rejected" },
  ],
  pending_accounting_officer: [
    { role: "accounting_officer", label: "Approve → Contracts Committee", next: "pending_contracts_committee" },
    { role: "accounting_officer", label: "Reject", next: "rejected" },
  ],
  pending_contracts_committee: [
    { role: "contracts_chair", label: "Approve", next: "approved" },
    { role: "contracts_chair", label: "Reject", next: "rejected" },
  ],
};

function fmt(n: string | number | null | undefined) {
  if (!n) return "—";
  return Number(n).toLocaleString("en-UG");
}

function printTForm(request: Request) {
  const sigBlock = (label: string, role: string) => {
    const sig = request.signatures.find((s) => s.role === role);
    return `
      <div class="sig-block">
        <div class="sig-label">${label}</div>
        <div class="sig-name">${sig ? sig.name : ""}</div>
        <div class="sig-line"></div>
        <div class="sig-date">${sig ? new Date(sig.signedAt).toLocaleDateString("en-UG") : ""}</div>
      </div>`;
  };

  const rows = request.items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${it.description}</td>
      <td>${it.quantity || ""}</td>
      <td>${it.unitOfMeasure || ""}</td>
      <td class="num">${fmt(it.estimatedUnitCost)}</td>
      <td class="num">${fmt(it.marketPrice)}</td>
      <td class="num"><strong>${fmt(it.totalCost)}</strong></td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>TFORM5 — ${request.referenceNumber}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 20mm; }
  h2 { text-align: center; font-size: 14px; margin: 0; }
  .subtitle { text-align: center; font-size: 11px; margin-bottom: 12px; }
  .ref { text-align: center; font-size: 12px; font-weight: bold; margin-bottom: 16px; letter-spacing: 1px; }
  .part-header { background: #1a5c2a; color: #fff; padding: 4px 8px; font-weight: bold; font-size: 11px; margin: 12px 0 6px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 8px; }
  .field { border-bottom: 1px solid #555; padding-bottom: 2px; }
  .field label { display: block; font-size: 9px; text-transform: uppercase; color: #555; }
  .field span { font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #1a5c2a; color: #fff; padding: 4px 6px; text-align: left; font-size: 10px; }
  td { border-bottom: 1px solid #ccc; padding: 4px 6px; font-size: 10px; }
  .num { text-align: right; }
  .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 16px; }
  .sig-block { border: 1px solid #555; padding: 8px; min-height: 60px; }
  .sig-label { font-size: 9px; text-transform: uppercase; font-weight: bold; margin-bottom: 20px; }
  .sig-name { font-size: 10px; font-weight: bold; }
  .sig-line { border-top: 1px solid #000; margin: 4px 0; }
  .sig-date { font-size: 9px; color: #555; }
  .status-box { border: 2px solid #1a5c2a; display: inline-block; padding: 2px 10px; font-weight: bold; font-size: 12px; float: right; margin-top: -8px; }
  @media print { body { margin: 10mm 15mm; } }
</style>
</head>
<body>
<h2>KIBULI SECONDARY SCHOOL</h2>
<div class="subtitle">Procurement Management System — PPDA Act 2003 (TFORM 5)</div>
<div class="ref">${request.referenceNumber} <span class="status-box">${request.status.replace(/_/g," ").toUpperCase()}</span></div>

<div class="part-header">PART I — IDENTIFICATION</div>
<div class="grid">
  <div class="field"><label>Entity Code</label><span>Kibuli SS</span></div>
  <div class="field"><label>Category</label><span>${request.category}</span></div>
  <div class="field"><label>Year Type</label><span>${request.yearType || "Calendar Year"}</span></div>
  <div class="field"><label>Year / Week</label><span>${request.year} / W${request.weekNumber}</span></div>
  <div class="field"><label>Budget Category</label><span>${request.budgetCategory}</span></div>
  <div class="field"><label>Procurement Size</label><span>${request.procurementSize}</span></div>
</div>

<div class="part-header">PART II — PROCUREMENT DETAILS</div>
<div class="grid">
  <div class="field" style="grid-column:span 2"><label>Subject of Procurement</label><span>${request.subjectOfProcurement || "—"}</span></div>
  <div class="field"><label>Procurement Plan Reference</label><span>${request.procurementPlanReference || "—"}</span></div>
  <div class="field"><label>Location for Delivery</label><span>${request.locationForDelivery || "—"}</span></div>
  <div class="field"><label>Date Required</label><span>${request.dateRequired || "—"}</span></div>
  <div class="field"><label>Estimated Total Cost (UGX)</label><span><strong>${fmt(request.estimatedTotalCost)}</strong></span></div>
  <div class="field"><label>Multi-year Procurement</label><span>${request.isMultiyear ? "Yes" : "No"}</span></div>
</div>

<div class="part-header">DETAILS RELATING TO PROCUREMENT</div>
<table>
  <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th class="num">Unit Cost</th><th class="num">Market Price</th><th class="num">Total</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="part-header">PART III — FUND AVAILABILITY CHECK</div>
<div class="grid">
  <div class="field"><label>Vote</label><span>${(request as any).voteName || "—"}</span></div>
  <div class="field"><label>Sub-Programme</label><span>${(request as any).subProgrammeName || "—"}</span></div>
  <div class="field"><label>Budget Item</label><span>${(request as any).budgetItemName || "—"}</span></div>
  <div class="field"><label>Balance Remaining (UGX)</label><span>${fmt((request as any).balanceRemaining)}</span></div>
</div>

<div class="part-header">APPROVAL CHAIN — SIGNATURES</div>
<div class="sig-row">
  ${sigBlock("User Dept Member", "user_dept")}
  ${sigBlock("Head of Department", "head_of_dept")}
  ${sigBlock("Accounting Officer", "accounting_officer")}
</div>

<div style="margin-top:10px;font-size:9px;color:#777;text-align:right;">
  Printed: ${new Date().toLocaleString("en-UG")} — Kibuli SS Procurement System
</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export default function RequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<Request>(`/requests/${id}`)
      .then(setRequest)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function transition(next: string) {
    setActing(true);
    try {
      await api.patch(`/requests/${id}/status`, { status: next });
      load();
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading…</div>;
  if (!request) return <div className="text-center py-12 text-gray-500">Not found.</div>;

  const actions = (NEXT_STATUS[request.status] || []).filter((a) => a.role === user?.role);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{request.referenceNumber}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{request.subjectOfProcurement || "—"}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => printTForm(request)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-green-700 text-green-700 text-sm font-medium hover:bg-green-50 transition"
          >
            🖨 Print TFORM 5
          </button>
          <StatusBadge status={request.status} />
        </div>
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-sm text-amber-800 font-medium">Action required:</span>
          {actions.map((a) => (
            <button
              key={a.next}
              onClick={() => transition(a.next)}
              disabled={acting}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-60 ${
                a.next === "rejected"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-green-700 text-white hover:bg-green-800"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card label="Category">{request.category?.replace("_", " ")}</Card>
        <Card label="Budget Category">{request.budgetCategory}</Card>
        <Card label="Procurement Size">{request.procurementSize}</Card>
        <Card label="Year / Week">{request.year} / W{request.weekNumber}</Card>
        <Card label="Location">{request.locationForDelivery || "—"}</Card>
        <Card label="Date Required">{request.dateRequired || "—"}</Card>
        <Card label="Plan Reference">{request.procurementPlanReference || "—"}</Card>
        <Card label="Estimated Total">
          {request.estimatedTotalCost
            ? `UGX ${Number(request.estimatedTotalCost).toLocaleString("en-UG")}`
            : "—"}
        </Card>
      </div>

      {/* Items */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 text-sm font-semibold border-b border-gray-200">
          Procurement Items
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-left">Unit</th>
              <th className="px-4 py-2 text-right">Unit Cost</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {request.items.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-2 text-gray-400">{it.itemNo}</td>
                <td className="px-4 py-2">{it.description}</td>
                <td className="px-4 py-2 text-right">{it.quantity || "—"}</td>
                <td className="px-4 py-2">{it.unitOfMeasure || "—"}</td>
                <td className="px-4 py-2 text-right">
                  {it.estimatedUnitCost ? Number(it.estimatedUnitCost).toLocaleString("en-UG") : "—"}
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {it.totalCost ? Number(it.totalCost).toLocaleString("en-UG") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Approval chain */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 text-sm font-semibold border-b border-gray-200">
          Approval Chain
        </div>
        <div className="p-4 space-y-2">
          {["user_dept", "head_of_dept", "accounting_officer"].map((role) => {
            const sig = request.signatures.find((s) => s.role === role);
            return (
              <div key={role} className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    sig ? "bg-green-600 text-white" : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {sig ? "✓" : "○"}
                </div>
                <div>
                  <span className="text-sm font-medium capitalize">{role.replace(/_/g, " ")}</span>
                  {sig && (
                    <span className="text-xs text-gray-500 ml-2">
                      {sig.name} — {new Date(sig.signedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="text-xs text-gray-400 uppercase font-semibold mb-0.5">{label}</div>
      <div className="text-sm capitalize">{children}</div>
    </div>
  );
}
