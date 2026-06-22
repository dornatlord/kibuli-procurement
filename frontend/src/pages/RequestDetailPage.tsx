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
  const sig = (role: string) => request.signatures.find((s) => s.role === role);

  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";

  // Pad items to at least 5 rows for the table
  const itemRows = [...request.items];
  while (itemRows.length < 5) itemRows.push({ id: 0, itemNo: itemRows.length + 1, description: "", quantity: "", unitOfMeasure: "", estimatedUnitCost: "", marketPrice: "", totalCost: "" });

  const rows = itemRows.map((it, i) => `
    <tr style="height:22px;">
      <td style="border:1px solid #000;padding:3px 5px;text-align:center;">${it.description ? i + 1 : ""}</td>
      <td style="border:1px solid #000;padding:3px 5px;">${it.description || ""}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center;">${it.quantity || ""}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center;">${it.unitOfMeasure || ""}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:right;">${it.estimatedUnitCost ? Number(it.estimatedUnitCost).toLocaleString("en-UG") : ""}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:right;">${it.marketPrice ? Number(it.marketPrice).toLocaleString("en-UG") : ""}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:right;font-weight:bold;">${it.totalCost ? Number(it.totalCost).toLocaleString("en-UG") : ""}</td>
    </tr>`).join("");

  const totalCost = request.items.reduce((s, it) => s + Number(it.totalCost || 0), 0);

  const cell = (label: string, value: string, colspan = 1, rowspan = 1) =>
    `<td colspan="${colspan}" rowspan="${rowspan}" style="border:1px solid #000;padding:0;vertical-align:top;">
      <div style="font-size:8px;font-weight:bold;color:#333;padding:2px 4px 0;text-transform:uppercase;">${label}</div>
      <div style="font-size:11px;padding:2px 4px 4px;">${value}</div>
    </td>`;

  const sigCell = (label: string, role: string) => {
    const s = sig(role);
    return `<td style="border:1px solid #000;padding:6px;vertical-align:top;width:33%;">
      <div style="font-size:8px;font-weight:bold;text-transform:uppercase;margin-bottom:2px;">${label}</div>
      <div style="font-size:10px;font-weight:bold;min-height:16px;">${s ? s.name : ""}</div>
      <div style="border-top:1px solid #000;margin:18px 0 2px;"></div>
      <div style="font-size:8px;color:#555;">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: ${s ? new Date(s.signedAt).toLocaleDateString("en-UG") : "___________"}</div>
    </td>`;
  };

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>TFORM5 — ${request.referenceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 12mm 14mm; }
  .header { text-align: center; margin-bottom: 8px; }
  .header h1 { font-size: 15px; font-weight: bold; letter-spacing: 0.5px; }
  .header p { font-size: 10px; margin-top: 2px; }
  .ref-row { display: flex; justify-content: space-between; align-items: center; margin: 8px 0; }
  .ref-num { font-size: 13px; font-weight: bold; letter-spacing: 1px; }
  .status-badge { border: 2px solid #000; padding: 3px 14px; font-weight: bold; font-size: 12px; }
  .part-header { background: #1a5c2a; color: #fff; padding: 4px 8px; font-weight: bold; font-size: 10px; margin: 8px 0 0; }
  table.form { width: 100%; border-collapse: collapse; }
  table.form td { border: 1px solid #000; padding: 0; vertical-align: top; }
  table.items { width: 100%; border-collapse: collapse; margin: 0; }
  table.items th { border: 1px solid #000; padding: 4px 5px; background: #1a5c2a; color: #fff; font-size: 9px; text-align: left; }
  table.items td { border: 1px solid #000; padding: 3px 5px; font-size: 10px; }
  table.items tfoot td { font-weight: bold; background: #f0f0f0; }
  .fl { font-size: 8px; font-weight: bold; color: #333; padding: 2px 4px 0; text-transform: uppercase; display: block; }
  .fv { font-size: 11px; padding: 2px 4px 5px; display: block; min-height: 18px; }
  @media print { body { padding: 8mm 10mm; } @page { size: A4; margin: 0; } }
</style>
</head>
<body>

<div class="header">
  <h1>KIBULI SECONDARY SCHOOL</h1>
  <p>Procurement Management System &mdash; PPDA Act 2003 &nbsp;|&nbsp; <strong>TFORM 5</strong></p>
</div>

<div class="ref-row">
  <span class="ref-num">${request.referenceNumber}</span>
  <span class="status-badge">${request.status.replace(/_/g," ").toUpperCase()}</span>
</div>

<!-- PART I -->
<div class="part-header">PART I &mdash; IDENTIFICATION</div>
<table class="form">
  <tr>
    ${cell("Entity Code", "Kibuli Secondary School")}
    ${cell("Sequence No.", request.referenceNumber.split("/").pop() || "—")}
    ${cell("Category", cap(request.category))}
    ${cell("Year Type", cap(request.yearType || "Calendar"))}
  </tr>
  <tr>
    ${cell("Year", String(request.year))}
    ${cell("Week No.", "W" + request.weekNumber)}
    ${cell("Budget Category", cap(request.budgetCategory))}
    ${cell("Procurement Size", cap(request.procurementSize))}
  </tr>
</table>

<!-- PART II -->
<div class="part-header">PART II &mdash; PROCUREMENT DETAILS</div>
<table class="form">
  <tr>
    <td colspan="4" style="border:1px solid #000;padding:0;vertical-align:top;">
      <span class="fl">Subject of Procurement</span>
      <span class="fv" style="font-size:12px;font-weight:bold;">${request.subjectOfProcurement || "—"}</span>
    </td>
  </tr>
  <tr>
    ${cell("Procurement Plan Reference", request.procurementPlanReference || "—", 2)}
    ${cell("Location for Delivery", request.locationForDelivery || "—", 2)}
  </tr>
  <tr>
    ${cell("Date Required", request.dateRequired || "—", 2)}
    ${cell("Estimated Total Cost (UGX)", Number(request.estimatedTotalCost || 0).toLocaleString("en-UG"), 2)}
  </tr>
  <tr>
    <td colspan="4" style="border:1px solid #000;padding:0;vertical-align:top;">
      <span class="fl">Multi-year Procurement</span>
      <span class="fv">${request.isMultiyear ? "Yes" : "No"}</span>
    </td>
  </tr>
</table>

<!-- ITEMS TABLE -->
<div class="part-header">DETAILS RELATING TO PROCUREMENT</div>
<table class="items">
  <thead>
    <tr>
      <th style="width:4%;text-align:center;">#</th>
      <th style="width:36%;">Description of Goods / Works / Services</th>
      <th style="width:7%;text-align:center;">Qty</th>
      <th style="width:8%;text-align:center;">Unit</th>
      <th style="width:15%;text-align:right;">Unit Cost (UGX)</th>
      <th style="width:15%;text-align:right;">Market Price (UGX)</th>
      <th style="width:15%;text-align:right;">Total Cost (UGX)</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr>
      <td colspan="6" style="border:1px solid #000;padding:3px 5px;text-align:right;font-weight:bold;background:#f0f0f0;">GRAND TOTAL (UGX)</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:right;font-weight:bold;background:#f0f0f0;">${totalCost.toLocaleString("en-UG")}</td>
    </tr>
  </tfoot>
</table>

<!-- PART III -->
<div class="part-header">PART III &mdash; FUND AVAILABILITY CHECK</div>
<table class="form">
  <tr>
    ${cell("Vote", (request as any).voteName || "—", 2)}
    ${cell("Sub-Programme", (request as any).subProgrammeName || "—", 2)}
  </tr>
  <tr>
    ${cell("Budget Item", (request as any).budgetItemName || "—", 2)}
    ${cell("Balance Remaining (UGX)", (request as any).balanceRemaining ? Number((request as any).balanceRemaining).toLocaleString("en-UG") : "—", 2)}
  </tr>
  <tr>
    <td colspan="4" style="border:1px solid #000;padding:0;">
      <span class="fl">Certification: I certify that funds are available for this procurement</span>
      <span class="fv" style="min-height:14px;"></span>
    </td>
  </tr>
</table>

<!-- SIGNATURES -->
<div class="part-header">APPROVAL CHAIN &mdash; AUTHORISATION SIGNATURES</div>
<table style="width:100%;border-collapse:collapse;">
  <tr>
    ${sigCell("User Dept Member", "user_dept")}
    ${sigCell("Head of Department", "head_of_dept")}
    ${sigCell("Accounting Officer", "accounting_officer")}
  </tr>
</table>

<div style="margin-top:8px;font-size:8px;color:#777;text-align:right;border-top:1px solid #ccc;padding-top:4px;">
  Printed: ${new Date().toLocaleString("en-UG")} &nbsp;|&nbsp; Kibuli SS Procurement System &nbsp;|&nbsp; PPDA Act 2003 — TFORM 5
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
