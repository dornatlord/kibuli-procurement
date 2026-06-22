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
  const sigOf = (role: string) => request.signatures.find((s) => s.role === role);

  // Pad items to at least 6 rows
  const itemRows = [...request.items];
  while (itemRows.length < 6) itemRows.push({ id: 0, itemNo: itemRows.length + 1, description: "", quantity: "", unitOfMeasure: "", estimatedUnitCost: "", marketPrice: "", totalCost: "" });

  const itemRowsHtml = itemRows.map((it, i) => `
    <tr>
      <td class="c">${it.description ? i + 1 : ""}</td>
      <td>${it.description || ""}</td>
      <td class="c">${it.quantity || ""}</td>
      <td class="c">${it.unitOfMeasure || ""}</td>
      <td class="r">${it.estimatedUnitCost ? Number(it.estimatedUnitCost).toLocaleString("en-UG") : ""}</td>
      <td class="r">${it.marketPrice ? Number(it.marketPrice).toLocaleString("en-UG") : ""}</td>
    </tr>`).join("");

  const totalCost = request.items.reduce((s, it) => s + Number(it.totalCost || 0), 0);
  const userSig   = sigOf("user_dept");
  const hodSig    = sigOf("head_of_dept");
  const aoSig     = sigOf("accounting_officer");

  const sigLine = (s: ReturnType<typeof sigOf>) => `
    <div style="margin-top:4px;">Name:&nbsp;&nbsp;&nbsp;${s ? s.name : "................................................"}</div>
    <div style="margin-top:4px;">Title:&nbsp;&nbsp;&nbsp;&nbsp;${s ? (s.title || "") : "................................................"}</div>
    <div style="margin-top:4px;">Signature: ................................................</div>
    <div style="margin-top:4px;">Date:&nbsp;&nbsp;&nbsp;&nbsp;${s ? new Date(s.signedAt).toLocaleDateString("en-UG") : "................................................"}</div>`;

  const refParts = request.referenceNumber.split("/");
  const seqNo    = refParts[refParts.length - 1] || "";
  const finYear  = refParts[2] || String(request.year);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>TFORM 5 &mdash; ${request.referenceNumber}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 9.5px; color: #000; padding: 10mm 12mm; }
h1  { font-size: 11px; font-weight: bold; text-align: center; }
.sub { font-size: 9px; text-align: center; }
.title-block { text-align: center; margin: 6px 0 4px; }
t, table { width: 100%; border-collapse: collapse; }
td, th { border: 1px solid #000; padding: 2px 4px; vertical-align: top; font-size: 9px; }
.lbl { font-size: 7.5px; font-style: italic; color: #333; display: block; }
.val { font-size: 9.5px; display: block; min-height: 13px; }
.c   { text-align: center; }
.r   { text-align: right; }
.sec { font-weight: bold; text-align: center; background: #e8e8e8; font-size: 9px; }
.no-border { border: none; }
.sig-outer { border: 1px solid #000; padding: 4px 6px; font-size: 9px; }
@media print { body { padding: 6mm 8mm; } @page { size: A4 portrait; margin: 0; } }
</style>
</head>
<body>

<!-- Header -->
<div style="text-align:center;margin-bottom:3px;">
  <div style="font-size:9px;">†FORM 5</div>
  <div style="font-size:8px;font-style:italic;">Regulation 3(1), 13(3), 15(1), 17(3) 24(2), 53(6), 54(3)</div>
  <div style="font-size:9px;font-weight:bold;margin-top:2px;">THE PUBLIC PROCUREMENT AND DISPOSAL OF PUBLIC ASSETS ACT, 2003</div>
  <div style="font-size:9.5px;font-weight:bold;">REQUEST FOR APPROVAL OF PROCUREMENT</div>
</div>

<!-- PART I -->
<table>
  <tr>
    <td colspan="6" class="sec">PART I: REQUEST BY USER DEPARTMENT FOR APPROVAL OF PROCUREMENT</td>
  </tr>
  <tr>
    <td colspan="3"><span class="lbl">PROCUREMENT REFERENCE NUMBER</span></td>
    <td colspan="1"><span class="lbl">Financial year</span><span class="val">${finYear}</span></td>
    <td colspan="2"><span class="lbl">Sequence Number</span><span class="val">${seqNo}</span></td>
  </tr>
  <tr>
    <td style="width:6%;"><span class="lbl">No.</span><span class="val">1</span></td>
    <td colspan="2"><span class="lbl">Code of Procuring and Disposing Entity</span><span class="val">Kibuli SS</span></td>
    <td colspan="2"><span class="lbl">Supplies/ works/ Non Consultancy services</span><span class="val">${request.category || ""}</span></td>
    <td><span class="lbl">Week</span><span class="val">W${request.weekNumber}</span></td>
  </tr>
  <tr>
    <td colspan="6"><span class="lbl">Category of procurement and budget</span>
      <table style="margin-top:2px;border:none;">
        <tr>
          <td style="border:1px solid #000;padding:2px 6px;width:25%;"><span class="lbl">Recurrent Budget</span><span class="val">${request.budgetCategory === "recurrent" ? "✓" : ""}</span></td>
          <td style="border:1px solid #000;padding:2px 6px;width:25%;"><span class="lbl">Development Budget</span><span class="val">${request.budgetCategory === "development" ? "✓" : ""}</span></td>
          <td style="border:1px solid #000;padding:2px 6px;width:25%;"><span class="lbl">Project Code</span><span class="val"></span></td>
          <td style="border:1px solid #000;padding:2px 6px;width:25%;"><span class="lbl">Project Title</span><span class="val"></span></td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td colspan="6">
      <span class="lbl">Is procurement going to result into multiyear contracting?&nbsp;&nbsp;&nbsp;${request.isMultiyear ? "<strong>YES</strong>" : "No"}</span>
      <table style="margin-top:2px;border:none;">
        <tr>
          <td style="border:1px solid #000;padding:2px 4px;width:25%;"><span class="lbl">Required Resources (UGX Bn) Year One</span><span class="val"></span></td>
          <td style="border:1px solid #000;padding:2px 4px;width:25%;"><span class="lbl">Required Resources (UGX Bn) Year Two</span><span class="val"></span></td>
          <td style="border:1px solid #000;padding:2px 4px;width:25%;"><span class="lbl">Required Resources (UGX Bn) Year Three</span><span class="val"></span></td>
          <td style="border:1px solid #000;padding:2px 4px;width:25%;"><span class="lbl">Required Resources (UGX Bn) Year Four</span><span class="val"></span></td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- Particulars -->
<table style="margin-top:4px;">
  <tr><td colspan="4" class="sec">Particulars of procurement</td></tr>
  <tr>
    <td style="width:30%;"><span class="lbl">Subject of procurement</span></td>
    <td colspan="3"><span class="val">${request.subjectOfProcurement || ""}</span></td>
  </tr>
  <tr>
    <td><span class="lbl">Procurement plan reference</span></td>
    <td colspan="3"><span class="val">${request.procurementPlanReference || ""}</span></td>
  </tr>
  <tr>
    <td><span class="lbl">Location for Delivery</span></td>
    <td colspan="3"><span class="val">${request.locationForDelivery || ""}</span></td>
  </tr>
  <tr>
    <td><span class="lbl">Date Required</span></td>
    <td colspan="3"><span class="val">${request.dateRequired || ""}</span></td>
  </tr>
</table>

<!-- Details / Items -->
<table style="margin-top:4px;">
  <tr><td colspan="6" class="sec">Details Relating to the Procurement</td></tr>
  <tr>
    <th style="width:5%;" class="c">Item<br/>No</th>
    <th style="width:38%;">Description (attach sections, terms of<br/>reference or scope of works)</th>
    <th style="width:7%;" class="c">Qty</th>
    <th style="width:10%;" class="c">Unit of<br/>measure</th>
    <th style="width:20%;" class="r">Estimated<br/>unit cost</th>
    <th style="width:20%;" class="r">Market price of<br/>the procurement</th>
  </tr>
  ${itemRowsHtml}
  <tr>
    <td colspan="4" style="border:none;"></td>
    <td colspan="2" style="text-align:right;font-weight:bold;background:#f5f5f5;">
      Estimated Total Cost:&nbsp;&nbsp;&nbsp;${totalCost ? totalCost.toLocaleString("en-UG") : ""}
    </td>
  </tr>
</table>

<!-- Signatures row: User Dept left, HoD right -->
<table style="margin-top:4px;border:1px solid #000;">
  <tr>
    <td style="width:50%;border:1px solid #000;padding:6px;vertical-align:top;">
      <div style="font-weight:bold;margin-bottom:4px;">Request for Procurement<br/>(User Department)</div>
      ${sigLine(userSig)}
    </td>
    <td style="width:50%;border:1px solid #000;padding:6px;vertical-align:top;">
      <div style="font-weight:bold;margin-bottom:4px;">Confirmation of Request<br/>(Head of User Department)</div>
      ${sigLine(hodSig)}
    </td>
  </tr>
</table>

<!-- Fund availability -->
<table style="margin-top:4px;">
  <tr>
    <td colspan="5" style="font-size:9px;font-style:italic;border:1px solid #000;padding:3px 4px;">
      Availability of funds to be confirmed prior to approval by Accounting officer/ Head teacher
    </td>
  </tr>
  <tr>
    <th style="width:20%;">Vote</th>
    <th style="width:20%;">Programme</th>
    <th style="width:20%;">Sub-Programme</th>
    <th style="width:20%;">Item</th>
    <th style="width:20%;">Balance remaining</th>
  </tr>
  <tr>
    <td><span class="val">${(request as any).voteName || ""}</span></td>
    <td><span class="val"></span></td>
    <td><span class="val">${(request as any).subProgrammeName || ""}</span></td>
    <td><span class="val">${(request as any).budgetItemName || ""}</span></td>
    <td class="r"><span class="val">${(request as any).balanceRemaining ? Number((request as any).balanceRemaining).toLocaleString("en-UG") : ""}</span></td>
  </tr>
</table>

<!-- Accounting Officer confirmation -->
<table style="margin-top:4px;border:1px solid #000;">
  <tr>
    <td style="padding:6px;vertical-align:top;">
      <div style="font-weight:bold;margin-bottom:4px;">Confirmation of Funding and Approval to Procure<br/>(Accounting Officer/ Head teacher)</div>
      <table style="border:none;width:100%;">
        <tr>
          <td style="border:none;width:50%;padding:2px 0;">
            ${sigLine(aoSig)}
          </td>
          <td style="border:none;width:50%;padding:2px 0;"></td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<div style="margin-top:6px;font-size:7.5px;color:#777;text-align:right;">
  Printed: ${new Date().toLocaleString("en-UG")} &mdash; Kibuli SS Procurement System
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
