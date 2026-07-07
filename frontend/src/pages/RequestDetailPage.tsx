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
  const isMacro = request.procurementSize === "macro";

  // Pad items to at least 15 rows to match official form
  const itemRows = [...request.items];
  while (itemRows.length < 15) itemRows.push({ id: 0, itemNo: itemRows.length + 1, description: "", quantity: "", unitOfMeasure: "", estimatedUnitCost: "", marketPrice: "", totalCost: "" });

  const itemRowsHtml = itemRows.map((it, i) => `
    <tr style="height:16px;">
      <td class="c" style="font-size:8px;">${it.description ? i + 1 : ""}</td>
      <td style="font-size:8px;">${it.description || ""}</td>
      <td class="c" style="font-size:8px;">${it.quantity || ""}</td>
      <td class="c" style="font-size:8px;">${it.unitOfMeasure || ""}</td>
      <td class="r" style="font-size:8px;">${it.estimatedUnitCost ? Number(it.estimatedUnitCost).toLocaleString("en-UG") : ""}</td>
      <td class="r" style="font-size:8px;">${it.totalCost ? Number(it.totalCost).toLocaleString("en-UG") : ""}</td>
    </tr>`).join("");

  const totalCost = request.items.reduce((s, it) => s + Number(it.totalCost || 0), 0);
  const userSig = sigOf("user_dept");
  const hodSig  = sigOf("head_of_dept");
  const aoSig   = sigOf("accounting_officer");

  const dotLine = (label: string, value = "") =>
    `<div style="margin-top:5px;">${label} <span style="border-bottom:1px solid #000;display:inline-block;min-width:160px;padding-bottom:1px;">${value}</span></div>`;

  const refParts = request.referenceNumber.split("/");
  const seqNo   = refParts[refParts.length - 1] || "";
  const finYear = refParts[2] || String(request.year);

  // Macro-only pages (4 & 5)
  const macroPages = isMacro ? `

<!-- PAGE 4: Part II Contracts Committee table — landscape -->
<div class="pg">
  <div style="text-align:center;font-weight:bold;font-size:10px;margin-bottom:10px;">
    PART II: REQUEST BY PROCUREMENT AND DISPOSAL UNIT TO CONTRACTS COMMITTEE FOR APPROVAL OF PROCUREMENT METHOD
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:5%;border:1px solid #000;padding:3px;"></td>
      <td style="width:45%;border:1px solid #000;padding:4px;font-weight:bold;text-align:center;">Submission by the Procurement<br/>and Disposal Unit</td>
      <td style="width:25%;border:1px solid #000;padding:4px;font-weight:bold;text-align:center;">Decision of the<br/>Contracts Committee</td>
      <td style="width:25%;border:1px solid #000;padding:4px;font-weight:bold;text-align:center;">Conditions/<br/>Justification for Decision</td>
    </tr>
    <tr>
      <td style="border:1px solid #000;padding:3px;"></td>
      <td style="border:1px solid #000;padding:4px;font-weight:bold;">Date of Submission to Contracts Committee:</td>
      <td style="border:1px solid #000;padding:4px;font-weight:bold;">Date/Reference of Contracts<br/>Committee Meeting:</td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr style="height:55px;">
      <td style="border:1px solid #000;padding:3px;vertical-align:top;">1.</td>
      <td style="border:1px solid #000;padding:3px;vertical-align:top;font-size:9px;">Recommended method of procurement and justification</td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr style="height:55px;">
      <td style="border:1px solid #000;padding:3px;vertical-align:top;">2.</td>
      <td style="border:1px solid #000;padding:3px;vertical-align:top;font-size:9px;">Names of shortlisted provider (s) and justification for selection</td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr style="height:55px;">
      <td style="border:1px solid #000;padding:3px;vertical-align:top;">3.</td>
      <td style="border:1px solid #000;padding:3px;vertical-align:top;font-size:9px;">Bidding document. Persons involved in preparation of proposal document <em>(Names and positions)</em></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr style="height:55px;">
      <td style="border:1px solid #000;padding:3px;vertical-align:top;">4.</td>
      <td style="border:1px solid #000;padding:3px;vertical-align:top;font-size:9px;">Names of persons recommended to constitute the Evaluation Committee and the justification <em>(Names and positions)</em></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr style="height:35px;">
      <td style="border:1px solid #000;padding:3px;vertical-align:top;">5.</td>
      <td style="border:1px solid #000;padding:3px;vertical-align:top;font-size:9px;">Cost of the bidding document, if any</td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr style="height:35px;">
      <td style="border:1px solid #000;padding:3px;vertical-align:top;">6.</td>
      <td style="border:1px solid #000;padding:3px;vertical-align:top;font-size:9px;">Any other information</td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
  </table>
</div>

<!-- PAGE 5: Documents Attached + Declarations — portrait -->
<div class="pg">

  <div style="font-size:9px;margin-bottom:16px;">
    <div><em><strong>Documents attached:</strong></em></div>
    <div style="margin-left:20px;margin-top:4px;">Bidding Document</div>
  </div>

  <div style="font-size:9px;margin-bottom:24px;">
    <div style="font-weight:bold;">Declaration by Procurement and Disposal Unit</div>
    <div style="margin-top:4px;">The information contained in this form and the attached documents is complete, true and accurate and in accordance with the Public Procurement and Disposal of Public Assets Act, 2003.</div>
    <table style="width:100%;border-collapse:collapse;border:none;margin-top:18px;">
      <tr>
        <td style="border:none;width:50%;padding-bottom:8px;">${dotLine("Signature:", "")}</td>
        <td style="border:none;width:50%;padding-bottom:8px;">${dotLine("Name:", "")}</td>
      </tr>
      <tr>
        <td style="border:none;">${dotLine("Position:", "")}</td>
        <td style="border:none;">${dotLine("Date:", "")}</td>
      </tr>
    </table>
  </div>

  <div style="font-size:9px;">
    <div style="font-weight:bold;">Declaration by Contracts Committee</div>
    <div style="margin-top:4px;">The information contained in this form is a true and accurate record of the decision of the Contracts Committee meeting held on the above date.</div>

    <table style="width:100%;border-collapse:collapse;border:none;margin-top:18px;">
      <tr>
        <td style="border:none;width:50%;padding-bottom:8px;">${dotLine("Signature:", "")}</td>
        <td style="border:none;width:50%;padding-bottom:8px;">${dotLine("Name:", "")}</td>
      </tr>
      <tr>
        <td style="border:none;">Position: &nbsp;<strong>Chairperson Contracts Committee</strong></td>
        <td style="border:none;">${dotLine("Date:", "")}</td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;border:none;margin-top:24px;">
      <tr>
        <td style="border:none;width:50%;padding-bottom:8px;">${dotLine("Signature:", "")}</td>
        <td style="border:none;width:50%;padding-bottom:8px;">${dotLine("Name:", "")}</td>
      </tr>
      <tr>
        <td style="border:none;">Position: &nbsp;<strong>Secretary Contracts Committee</strong></td>
        <td style="border:none;">${dotLine("Date:", "")}</td>
      </tr>
    </table>
  </div>

</div>` : "";

  const pageHeader = `
<div style="text-align:right;font-size:9px;font-weight:bold;">FORM 5</div>
<div style="text-align:right;font-size:8.5px;font-style:italic;">Regulation 3(1), 13(3), 15(3), 17(3) 24(2), 53(6), 54(5)</div>
<div style="text-align:center;font-size:10px;margin-top:6px;">THE PUBLIC PROCUREMENT AND DISPOSAL OF PUBLIC ASSETS ACT, 2003</div>
<div style="text-align:center;font-size:10.5px;font-weight:bold;margin-top:4px;">REQUEST FOR APPROVAL OF PROCUREMENT</div>
<div style="text-align:center;font-size:10px;font-weight:bold;margin-top:4px;">PART I: REQUEST BY USER DEPARTMENT FOR APPROVAL OF PROCUREMENT</div>`;

  const page1Content = `
${pageHeader}

<table style="width:100%;border-collapse:collapse;margin-top:8px;">
  <tr><td colspan="4" style="border:1px solid #000;padding:4px;text-align:center;font-weight:bold;">Procurement Reference Number</td></tr>
  <tr>
    <td style="width:30%;border:1px solid #000;padding:3px;text-align:center;">Code of Procuring and Disposing Entity</td>
    <td style="width:30%;border:1px solid #000;padding:3px;text-align:center;">Supplies/Works/Non-consultancy<br/>services</td>
    <td style="width:20%;border:1px solid #000;padding:3px;text-align:center;">Financial Year</td>
    <td style="width:20%;border:1px solid #000;padding:3px;text-align:center;">Sequence Number</td>
  </tr>
  <tr style="height:22px;">
    <td style="border:1px solid #000;padding:3px;">Kibuli Secondary School</td>
    <td style="border:1px solid #000;padding:3px;text-align:center;">${request.category || ""}</td>
    <td style="border:1px solid #000;padding:3px;text-align:center;">${finYear}</td>
    <td style="border:1px solid #000;padding:3px;text-align:center;">${seqNo}</td>
  </tr>
</table>

<div style="margin-top:8px;font-size:9px;">Category of procurement and budget</div>
<table style="width:100%;border-collapse:collapse;margin-top:2px;">
  <tr>
    <td style="width:25%;border:1px solid #000;padding:3px;text-align:center;">Recurrent Budget</td>
    <td style="width:25%;border:1px solid #000;padding:3px;text-align:center;">Development Budget</td>
    <td style="width:25%;border:1px solid #000;padding:3px;text-align:center;">Project Code</td>
    <td style="width:25%;border:1px solid #000;padding:3px;text-align:center;">Project Title</td>
  </tr>
  <tr style="height:22px;">
    <td style="border:1px solid #000;padding:3px;text-align:center;">${request.budgetCategory === "recurrent" ? "✓" : ""}</td>
    <td style="border:1px solid #000;padding:3px;text-align:center;">${request.budgetCategory === "development" ? "✓" : ""}</td>
    <td style="border:1px solid #000;padding:3px;text-align:center;">${(request as any).voteCode || ""}</td>
    <td style="border:1px solid #000;padding:3px;">${(request as any).budgetItemName || ""}</td>
  </tr>
</table>

<div style="margin-top:8px;font-size:9px;">Is procurement going to result into multiyear contracting?</div>
<table style="width:100%;border-collapse:collapse;margin-top:2px;">
  <tr>
    <td style="width:25%;border:1px solid #000;padding:3px;text-align:center;">Required Resources (UGX Bn) Year One</td>
    <td style="width:25%;border:1px solid #000;padding:3px;text-align:center;">Required Resources (UGX Bn) Year Two</td>
    <td style="width:25%;border:1px solid #000;padding:3px;text-align:center;">Required Resources (UGX Bn) Year Three</td>
    <td style="width:25%;border:1px solid #000;padding:3px;text-align:center;">Required Resources (UGX Bn) Year Four</td>
  </tr>
  <tr style="height:22px;"><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
</table>`;

  const page2Content = `
<table style="width:100%;border-collapse:collapse;">
  <tr><td colspan="2" style="border:1px solid #000;padding:4px;font-weight:bold;">Particulars of Procurement</td></tr>
  <tr><td style="width:35%;border:1px solid #000;padding:3px;">Subject of Procurement</td><td style="border:1px solid #000;padding:3px;">${request.subjectOfProcurement || ""}</td></tr>
  <tr><td style="border:1px solid #000;padding:3px;">Procurement Plan Reference</td><td style="border:1px solid #000;padding:3px;">${request.procurementPlanReference || ""}</td></tr>
  <tr><td style="border:1px solid #000;padding:3px;">Location for Delivery</td><td style="border:1px solid #000;padding:3px;">${request.locationForDelivery || ""}</td></tr>
  <tr><td style="border:1px solid #000;padding:3px;">Date Required</td><td style="border:1px solid #000;padding:3px;">${request.dateRequired || ""}</td></tr>
</table>

<table style="width:100%;border-collapse:collapse;margin-top:6px;">
  <tr><td colspan="6" style="border:1px solid #000;padding:4px;text-align:center;font-weight:bold;">Details Relating to the Procurement</td></tr>
  <tr>
    <th style="width:5%;border:1px solid #000;padding:3px;text-align:center;">Item<br/>No.</th>
    <th style="width:40%;border:1px solid #000;padding:3px;text-align:center;">Description<br/><em>(Attach specifications, terms of reference or scope of works)</em></th>
    <th style="width:8%;border:1px solid #000;padding:3px;text-align:center;">Quantity</th>
    <th style="width:10%;border:1px solid #000;padding:3px;text-align:center;">Unit of<br/>Measure</th>
    <th style="width:18%;border:1px solid #000;padding:3px;text-align:center;">Estimated<br/>Unit Cost</th>
    <th style="width:19%;border:1px solid #000;padding:3px;text-align:center;">Estimated Cost</th>
  </tr>
  ${itemRowsHtml}
  <tr>
    <td colspan="4" style="border:none;"></td>
    <td colspan="2" style="border:1px solid #000;padding:3px;font-weight:bold;text-align:right;">
      Estimated Total Cost: (Ug: x)&nbsp;&nbsp;${totalCost ? totalCost.toLocaleString("en-UG") : ""}
    </td>
  </tr>
</table>`;

  const page3Content = `
<table style="width:100%;border-collapse:collapse;border:none;">
  <tr>
    <td style="width:50%;border:none;vertical-align:top;padding-right:16px;">
      <div style="font-size:9px;"><strong>(1)&nbsp; Request for Procurement</strong><br/><em>(Member of user department)</em></div>
      <div style="margin-top:10px;">${dotLine("Signature:", "")}</div>
      <div style="margin-top:4px;">${dotLine("Name:", userSig ? userSig.name : "")}</div>
      <div style="margin-top:4px;">${dotLine("Title:", userSig ? (userSig.title || "") : "")}</div>
      <div style="margin-top:4px;">${dotLine("Date:", userSig ? new Date(userSig.signedAt).toLocaleDateString("en-UG") : "")}</div>
    </td>
    <td style="width:50%;border:none;vertical-align:top;padding-left:16px;">
      <div style="font-size:9px;"><strong>(2)&nbsp; Confirmation of Request</strong><br/><em>(Head of user department)</em></div>
      <div style="margin-top:10px;">${dotLine("Signature:", "")}</div>
      <div style="margin-top:4px;">${dotLine("Name:", hodSig ? hodSig.name : "")}</div>
      <div style="margin-top:4px;">${dotLine("Title:", hodSig ? (hodSig.title || "") : "")}</div>
      <div style="margin-top:4px;">${dotLine("Date:", hodSig ? new Date(hodSig.signedAt).toLocaleDateString("en-UG") : "")}</div>
    </td>
  </tr>
</table>

<div style="margin-top:16px;font-size:8.5px;font-style:italic;">Availability of funds to be confirmed prior to approval by Accounting Officer/ Head teacher:</div>
<table style="width:100%;border-collapse:collapse;margin-top:4px;">
  <tr>
    <th style="width:20%;border:1px solid #000;padding:3px;text-align:center;">Vote/head No</th>
    <th style="width:25%;border:1px solid #000;padding:3px;text-align:center;">Programme</th>
    <th style="width:25%;border:1px solid #000;padding:3px;text-align:center;">Sub-programme</th>
    <th style="width:15%;border:1px solid #000;padding:3px;text-align:center;">Item</th>
    <th style="width:15%;border:1px solid #000;padding:3px;text-align:center;">Balance remaining</th>
  </tr>
  <tr style="height:24px;">
    <td style="border:1px solid #000;padding:3px;text-align:center;">${(request as any).voteCode || ""}</td>
    <td style="border:1px solid #000;padding:3px;">${(request as any).voteName || ""}</td>
    <td style="border:1px solid #000;padding:3px;">${(request as any).subProgrammeName || ""}</td>
    <td style="border:1px solid #000;padding:3px;">${(request as any).budgetItemName || ""}</td>
    <td style="border:1px solid #000;padding:3px;text-align:right;">${(request as any).balanceRemainingManual ? Number((request as any).balanceRemainingManual).toLocaleString("en-UG") : ""}</td>
  </tr>
</table>

<table style="width:100%;border-collapse:collapse;border:none;margin-top:16px;">
  <tr>
    <td style="width:50%;border:none;vertical-align:top;">
      <div style="font-size:9px;"><strong>(3)&nbsp; Confirmation of Funding and Approval to Procure</strong><br/><em>(Accounting Officer)</em></div>
      <div style="margin-top:10px;">${dotLine("Signature:", "")}</div>
      <div style="margin-top:4px;">${dotLine("Title:", aoSig ? (aoSig.title || "Accounting Officer") : "")}</div>
    </td>
    <td style="width:50%;border:none;vertical-align:top;padding-left:16px;">
      <div style="font-size:9px;">&nbsp;</div>
      <div style="margin-top:10px;">${dotLine("Name:", aoSig ? aoSig.name : "")}</div>
      <div style="margin-top:4px;">${dotLine("Date:", aoSig ? new Date(aoSig.signedAt).toLocaleDateString("en-UG") : "")}</div>
    </td>
  </tr>
</table>

<div style="margin-top:12px;font-size:7.5px;color:#777;text-align:right;border-top:1px solid #ccc;padding-top:3px;">
  Printed: ${new Date().toLocaleString("en-UG")} &mdash; Kibuli Secondary School Procurement System
</div>`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>FORM 5 &mdash; ${request.referenceNumber}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Times New Roman", serif; font-size: 9px; color: #000; background: #fff; }

${isMacro
  ? `@page { size: A4 landscape; margin: 12mm 15mm; }
.pg { width:267mm; min-height:171mm; page-break-after:always; page-break-inside:avoid; display:block; }
.pg:last-of-type { page-break-after:auto; }`
  : `@page { size: A4 portrait; margin: 10mm 12mm; }`
}

@media screen {
  body { background: #888; }
  ${isMacro
    ? `.pg { background:#fff; margin:8mm auto; padding:12mm 15mm; box-shadow:0 2px 10px rgba(0,0,0,.4); }`
    : `.micro-page { background:#fff; width:190mm; margin:8mm auto; padding:10mm 12mm; box-shadow:0 2px 10px rgba(0,0,0,.4); }`
  }
}
@media print {
  body { background:#fff; }
  .pg, .micro-page { margin:0; padding:0; box-shadow:none; }
}
table { width:100%; border-collapse:collapse; }
td, th { border:1px solid #000; padding:2px 4px; vertical-align:top; font-size:8.5px; }
</style>
</head>
<body>

${isMacro ? `
<div class="pg">${page1Content}</div>
<div class="pg">${page2Content}</div>
<div class="pg">${page3Content}</div>
${macroPages}
` : `
<div class="micro-page">
  ${page1Content}
  <div style="margin-top:10px;">${page2Content}</div>
  <div style="margin-top:10px;">${page3Content}</div>
</div>
`}

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
