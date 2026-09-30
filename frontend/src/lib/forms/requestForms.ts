import { KSS_BADGE } from "../badge";
import { shillingsInWords } from "../words";
import type { Officials } from "../officials";
import { DEFAULT_JUSTIFICATION } from "../../components/PartTwoForm";
import { cornerBadge, dayFirst, esc, money, openPrint, sheetCss, tableSheets } from "../print";

export interface RequestLineItem {
  id: number;
  itemNo: number;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  estimatedUnitCost: string;
  marketPrice: string;
  totalCost: string;
}

export interface RequestSignature {
  id: number;
  role: string;
  name: string;
  title: string;
  signedAt: string;
}

export interface CommitteeDecision {
  id: number;
  submissionDate: string | null;
  committeeMeetingDate: string | null;
  meetingReference: string | null;
  recommendedMethod: string | null;
  methodJustification: string | null;
  shortlistedProviders: string | null;
  biddingDocumentTeam: string | null;
  evaluationCommittee: string | null;
  biddingDocumentCost: string | null;
  otherInformation: string | null;
  /** The committee's decision and conditions for each Part II row, keyed "1"–"6". */
  rowDecisions: Record<string, { decision: string | null; conditions: string | null }> | null;
  decision: string | null;
  decisionJustification: string | null;
}

/** When each approval step happened (ISO timestamps or YYYY-MM-DD dates). */
export interface StepDates {
  requested: string | null;
  headOfDepartment: string | null;
  accountingOfficer: string | null;
  submittedToCommittee: string | null;
  committeeMeeting: string | null;
  chairperson: string | null;
  secretary: string | null;
}

export interface RequestRecord {
  id: number;
  referenceNumber: string;
  /** Code of the budget line being spent — the fourth part of the reference. */
  supplyCode: string | null;
  category: string;
  yearType: string;
  year: number;
  weekNumber: number;
  budgetCategory: string;
  procurementSize: string;
  subjectOfProcurement: string;
  procurementPlanReference: string;
  locationForDelivery: string;
  /** Also the delivery date wherever one is asked for. */
  dateRequired: string;
  estimatedTotalCost: string;
  isMultiyear: boolean;
  multiyearYearOne?: string | null;
  multiyearYearTwo?: string | null;
  multiyearYearThree?: string | null;
  multiyearYearFour?: string | null;
  balanceRemainingManual?: string | null;
  voteCode?: string | null;
  voteName?: string | null;
  subProgrammeName?: string | null;
  budgetItemName?: string | null;
  /** The budget line's number within its sub-programme (or vote): the 4 in 2212-4. */
  budgetLineNumber?: number | null;
  /** TFORM 5's Project Code and Title, e.g. 2212-4 and "Civil works". */
  projectCode?: string | null;
  projectTitle?: string | null;
  status: string;
  createdAt: string;
  items: RequestLineItem[];
  /** When it was corrected, by whom and why. */
  corrections?: { at: string; by: string | null; reason: string | null }[];
  signatures: RequestSignature[];
  decision: CommitteeDecision | null;
  stepDates?: StepDates;
}

const CATEGORY_NAMES: Record<string, string> = {
  supplies: "Supplies",
  works: "Works",
  non_consultancy: "Non-consultancy services",
};

/** "50.00" → "50", "2.5" → "2.5". */
const quantity = (v: string | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("en-UG", { maximumFractionDigits: 2 });

/** Typed text keeps its line breaks on the form. */
const escLines = (s: string | null | undefined) => esc(s).replace(/\n/g, "<br/>");

/** A signature line: the label, then a ruled line carrying whatever the system knows. */
const line = (label: string, value = "") =>
  `<div class="line"><span class="line-label">${label}</span><span class="line-value">${esc(value)}</span></div>`;

/** KSS/SUPLS/26/029/00246 → procurement reference KSS/SUPLS/26/029 and call-off order 246. */
export function splitReference(referenceNumber: string) {
  const parts = referenceNumber.split("/");
  if (parts.length < 2) return { procurementRef: referenceNumber, callOff: "" };
  const last = parts[parts.length - 1];
  return {
    procurementRef: parts.slice(0, -1).join("/"),
    callOff: /^\d+$/.test(last) ? String(Number(last)) : last,
  };
}

// ── TFORM 5 ──────────────────────────────────────────────────────────────

/** Item rows on the first items page (the form's own fifteen), and on each page after it. */
const ITEMS_FIRST_PAGE = 15;
const ITEMS_LATER_PAGES = 22;

const TFORM_CSS = `
${sheetCss("landscape")}
body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.25; }
table { width: 100%; border-collapse: collapse; }
.grid td, .grid th { border: 1px solid #000; padding: 1.3mm 2mm; vertical-align: top; text-align: left; font-size: 12pt; }
.grid th { font-weight: bold; text-align: center; vertical-align: middle; }
.c { text-align: center !important; }
.r { text-align: right !important; white-space: nowrap; }
.b { font-weight: bold; }
.caption { margin: 5mm 0 1.5mm; }
.tall td { height: 11mm; vertical-align: middle; }
.head { margin-bottom: 5mm; }
.head td { border: 0; padding: 0; vertical-align: middle; }
.head .badge, .head .balance { width: 38mm; }
.head .badge img { display: block; width: 32mm; height: 35.2mm; }
.head .text { text-align: center; }
.form-no { font-weight: bold; }
.regulation { font-style: italic; font-size: 11pt; }
.act { margin-top: 3mm; }
.title { font-weight: bold; font-size: 13pt; margin-top: 1.5mm; }
.items td { height: 6.8mm; padding-top: 0.8mm; padding-bottom: 0.8mm; }
.items th { font-size: 11pt; }
.items .section { text-align: center; font-weight: bold; }
.items .total td { font-weight: bold; vertical-align: middle; }
.continued { font-weight: bold; margin-bottom: 3mm; }
.pto { text-align: right; font-size: 10pt; font-style: italic; margin-top: 2mm; }
.pair { display: flex; gap: 16mm; }
.pair > div { flex: 1; }
.block-title { font-weight: bold; }
.block-sub { font-style: italic; font-size: 11pt; }
.line { display: flex; align-items: flex-end; gap: 2mm; margin-top: 4.5mm; }
.line-label { white-space: nowrap; }
.line-value { flex: 1; border-bottom: 1px solid #000; min-height: 6.5mm; padding: 0 1mm 0.5mm; }
.funds-note { font-style: italic; margin: 7mm 0 1.5mm; }
.part2-title { text-align: center; font-weight: bold; font-size: 13pt; margin: 0 18mm 5mm; }
.part2 .high td { height: 22mm; }
.part2 .low td { height: 10mm; }
.answer { margin-top: 1.5mm; }
.declaration { margin-top: 7mm; }
.declaration-title { font-weight: bold; }
`;

/** PPDA FORM 5 as the school prints it: landscape A4, 12 point, one part per page. */
export function printTForm(request: RequestRecord, officials: Officials) {
  const held = (key: string) => officials[key];
  const sigOf = (role: string) => request.signatures.find((s) => s.role === role);
  const isMacro = request.procurementSize === "macro";
  const total = request.items.reduce((s, it) => s + Number(it.totalCost || 0), 0);

  const userSig = sigOf("user_dept");
  const hodSig = sigOf("head_of_dept");
  const aoSig = sigOf("accounting_officer");

  // Every Date line fills itself from when that step happened. A step that
  // hasn't happened yet stays blank.
  const steps = request.stepDates;
  const dateOf = {
    requested: dayFirst(steps?.requested ?? userSig?.signedAt),
    headOfDepartment: dayFirst(steps?.headOfDepartment ?? hodSig?.signedAt),
    accountingOfficer: dayFirst(steps?.accountingOfficer ?? aoSig?.signedAt),
    submittedToCommittee: dayFirst(steps?.submittedToCommittee ?? request.decision?.submissionDate),
    committeeMeeting: dayFirst(steps?.committeeMeeting ?? request.decision?.committeeMeetingDate),
    chairperson: dayFirst(steps?.chairperson),
    secretary: dayFirst(steps?.secretary),
  };

  const refParts = request.referenceNumber.split("/");
  const seqNo = refParts[refParts.length - 1] || "";

  // ── Page 1: Part I heading, reference, budget, multiyear
  const yearCells = request.isMultiyear
    ? [request.multiyearYearOne, request.multiyearYearTwo, request.multiyearYearThree, request.multiyearYearFour].map(money)
    : ["✓", "", "", ""]; // a single-year procurement needs its resources in year one
  const page1 = `
<div class="sheet">
  <table class="head"><tr>
    <td class="badge"><img src="${KSS_BADGE}" alt="" /></td>
    <td class="text">
      <div class="form-no">FORM 5</div>
      <div class="regulation">Regulation 3(1), 13(3), 15(3), 17(3) 24(2), 53(6), 54(5)</div>
      <div class="act">THE PUBLIC PROCUREMENT AND DISPOSAL OF PUBLIC ASSETS ACT, 2003</div>
      <div class="title">REQUEST FOR APPROVAL OF PROCUREMENT</div>
      <div class="title">PART I: REQUEST BY USER DEPARTMENT FOR APPROVAL OF PROCUREMENT</div>
    </td>
    <td class="balance"></td>
  </tr></table>

  <table class="grid">
    <tr><th colspan="4">Procurement Reference Number</th></tr>
    <tr>
      <td class="c" style="width:30%">Code of Procuring and Disposing Entity</td>
      <td class="c" style="width:30%">Supplies/Works/Non-consultancy services</td>
      <td class="c" style="width:20%">Financial Year</td>
      <td class="c" style="width:20%">Sequence Number</td>
    </tr>
    <tr class="tall">
      <td class="c">Kibuli Secondary School</td>
      <td class="c">${esc(CATEGORY_NAMES[request.category] ?? request.category)}</td>
      <td class="c">${esc(String(request.year))}</td>
      <td class="c">${esc(request.supplyCode ? `${request.supplyCode}/${seqNo}` : seqNo)}</td>
    </tr>
  </table>

  <div class="caption">Category of procurement and budget</div>
  <table class="grid">
    <tr>
      <td class="c" style="width:25%">Recurrent Budget</td>
      <td class="c" style="width:25%">Development Budget</td>
      <td class="c" style="width:25%">Project Code</td>
      <td class="c" style="width:25%">Project Title</td>
    </tr>
    <tr class="tall">
      <td class="c">${request.budgetCategory === "recurrent" ? "✓" : ""}</td>
      <td class="c">${request.budgetCategory === "development" ? "✓" : ""}</td>
      <td class="c">${esc(request.projectCode ?? request.voteCode)}</td>
      <td>${esc(request.projectTitle ?? request.budgetItemName)}</td>
    </tr>
  </table>

  <div class="caption">Is procurement going to result into multiyear contracting?</div>
  <table class="grid">
    <tr>
      <td class="c" style="width:25%">Required Resources (UGX Bn) Year One</td>
      <td class="c" style="width:25%">Required Resources (UGX Bn) Year Two</td>
      <td class="c" style="width:25%">Required Resources (UGX Bn) Year Three</td>
      <td class="c" style="width:25%">Required Resources (UGX Bn) Year Four</td>
    </tr>
    <tr class="tall">${yearCells.map((v) => `<td class="c">${esc(v)}</td>`).join("")}</tr>
  </table>
</div>`;

  // ── Page 2 (and more if the items don't fit): particulars and items
  const itemHeader = `<tr>
      <th style="width:6%">Item No.</th>
      <th style="width:42%">Description<br/><em>(Attach specifications, terms of reference or scope of works)</em></th>
      <th style="width:10%">Quantity</th>
      <th style="width:12%">Unit of Measure</th>
      <th style="width:15%">Estimated Unit Cost</th>
      <th style="width:15%">Estimated Cost</th>
    </tr>`;
  const particulars = `<table class="grid">
    <tr><td colspan="2" class="b">Particulars of Procurement</td></tr>
    <tr><td style="width:35%">Subject of Procurement</td><td>${esc(request.subjectOfProcurement)}</td></tr>
    <tr><td>Procurement Plan Reference</td><td>${esc(request.procurementPlanReference)}</td></tr>
    <tr><td>Location for Delivery</td><td>${esc(request.locationForDelivery)}</td></tr>
    <tr><td>Date Required</td><td>${esc(dayFirst(request.dateRequired))}</td></tr>
  </table>`;
  const page2 = tableSheets({
    css: TFORM_CSS,
    paper: "landscape",
    items: request.items,
    row: (it, i) =>
      `<tr><td class="c">${i + 1}</td><td>${esc(it.description)}</td><td class="c">${esc(
        quantity(it.quantity)
      )}</td><td class="c">${esc(it.unitOfMeasure)}</td><td class="r">${money(it.estimatedUnitCost)}</td><td class="r">${money(
        it.totalCost
      )}</td></tr>`,
    // The first page keeps the form's fifteen ruled rows even when fewer are used.
    blankRow: "<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>",
    most: { first: ITEMS_FIRST_PAGE, rest: ITEMS_LATER_PAGES },
    sheet: (rows, { first, last }) => `
<div class="sheet">
  ${cornerBadge}
  ${first ? particulars : `<div class="continued">Details Relating to the Procurement (continued)</div>`}
  <table class="grid items" style="margin-top:${first ? "4mm" : "0"}">
    ${first ? `<tr><td colspan="6" class="section">Details Relating to the Procurement</td></tr>` : ""}
    ${itemHeader}
    ${rows}
    ${
      last
        ? `<tr class="total"><td colspan="4"></td><td>Estimated Total Cost</td><td class="r">${money(total)}</td></tr>`
        : ""
    }
  </table>
  ${last ? "" : `<div class="pto">P.T.O.</div>`}
</div>`,
  });

  // ── Page 3: requester, head of department, funds, Accounting Officer
  const signer = (sig: RequestSignature | undefined, date: string) =>
    `${line("Signature:")}${line("Name:", sig?.name ?? "")}${line("Title:", sig?.title ?? "")}${line("Date:", date)}`;
  const page3 = `
<div class="sheet">
  ${cornerBadge}
  <div class="pair">
    <div>
      <div class="block-title">(1)&nbsp; Request for Procurement</div>
      <div class="block-sub">(Member of user department)</div>
      ${signer(userSig, dateOf.requested)}
    </div>
    <div>
      <div class="block-title">(2)&nbsp; Confirmation of Request</div>
      <div class="block-sub">(Head of user department)</div>
      ${signer(hodSig, dateOf.headOfDepartment)}
    </div>
  </div>

  <div class="funds-note">Availability of funds to be confirmed prior to approval by Accounting Officer/ Head teacher:</div>
  <table class="grid">
    <tr>
      <th style="width:15%">Vote/head No</th>
      <th style="width:25%">Programme</th>
      <th style="width:25%">Sub-programme</th>
      <th style="width:20%">Item</th>
      <th style="width:15%">Balance remaining</th>
    </tr>
    <tr class="tall">
      <td></td>
      <td>${esc(request.voteName)}</td>
      <td>${esc(request.subProgrammeName)}</td>
      <td class="c">${esc(request.budgetLineNumber)}</td>
      <td class="r">${money(request.balanceRemainingManual)}</td>
    </tr>
  </table>

  <div style="margin-top:7mm">
    <div class="block-title">(3)&nbsp; Confirmation of Funding and Approval to Procure</div>
    <div class="block-sub">(Accounting Officer)</div>
    <div class="pair">
      <div>
        ${line("Signature:")}
        ${line("Title:", aoSig ? aoSig.title || "Accounting Officer" : held("accounting_officer")?.title ?? "")}
      </div>
      <div>
        ${line("Name:", aoSig ? aoSig.name : held("accounting_officer")?.name ?? "")}
        ${line("Date:", dateOf.accountingOfficer)}
      </div>
    </div>
  </div>
</div>`;

  // ── Pages 4 and 5 (macro only): Part II and the declarations
  let macroPages = "";
  if (isMacro) {
    const part2 = request.decision;
    const meetingDateRef = [dateOf.committeeMeeting, part2?.meetingReference].filter(Boolean).join(" / ");
    const rows = [
      {
        key: "1",
        size: "high",
        label: "Recommended method of procurement and justification",
        answer: [part2?.recommendedMethod, part2?.methodJustification || DEFAULT_JUSTIFICATION]
          .filter(Boolean)
          .map(escLines)
          .join("<br/>"),
      },
      {
        key: "2",
        size: "high",
        label: "Names of shortlisted provider (s) and justification for selection",
        answer: escLines(part2?.shortlistedProviders),
      },
      {
        key: "3",
        size: "high",
        label: "Bidding document. Persons involved in preparation of proposal document <em>(Names and positions)</em>",
        answer: escLines(part2?.biddingDocumentTeam),
      },
      {
        key: "4",
        size: "high",
        label:
          "Names of persons recommended to constitute the Evaluation Committee and the justification <em>(Names and positions)</em>",
        answer: escLines(part2?.evaluationCommittee),
      },
      {
        key: "5",
        size: "low",
        label: "Cost of the bidding document, if any",
        answer: part2?.biddingDocumentCost ? `UGX ${money(part2.biddingDocumentCost)}` : "",
      },
      { key: "6", size: "low", label: "Any other information", answer: escLines(part2?.otherInformation) },
    ]
      .map((r) => {
        const decided = part2?.rowDecisions?.[r.key];
        return `<tr class="${r.size}">
      <td>${r.key}.</td>
      <td>${r.label}${r.answer ? `<div class="answer">${r.answer}</div>` : ""}</td>
      <td>${escLines(decided?.decision)}</td>
      <td>${escLines(decided?.conditions)}</td>
    </tr>`;
      })
      .join("");

    macroPages = `
<div class="sheet">
  ${cornerBadge}
  <div class="part2-title">PART II: REQUEST BY PROCUREMENT AND DISPOSAL UNIT TO CONTRACTS COMMITTEE FOR APPROVAL OF PROCUREMENT METHOD</div>
  <table class="grid part2">
    <tr>
      <th style="width:9%"></th>
      <th style="width:44%">Submission by the Procurement<br/>and Disposal Unit</th>
      <th style="width:23%">Decision of the<br/>Contracts Committee</th>
      <th style="width:24%">Conditions/<br/>Justification for Decision</th>
    </tr>
    <tr>
      <td></td>
      <td class="b c">Date of Submission to Contracts Committee:${
        dateOf.submittedToCommittee ? ` <span style="font-weight:normal">${esc(dateOf.submittedToCommittee)}</span>` : ""
      }</td>
      <td class="b">Date/Reference of Contracts Committee Meeting:${
        meetingDateRef ? ` <span style="font-weight:normal">${esc(meetingDateRef)}</span>` : ""
      }</td>
      <td></td>
    </tr>
    ${rows}
  </table>
</div>

<div class="sheet">
  ${cornerBadge}
  <div><em><strong>Documents attached:</strong></em></div>
  <div style="margin:1.5mm 0 0 8mm">Bidding Document</div>

  <div class="declaration">
    <div class="declaration-title">Declaration by Procurement and Disposal Unit</div>
    <div>The information contained in this form and the attached documents is complete, true and accurate and in accordance with the Public Procurement and Disposal of Public Assets Act, 2003.</div>
    <div class="pair">
      <div>${line("Signature:")}${line("Position:", held("pdu_head")?.title ?? "")}</div>
      <div>${line("Name:", held("pdu_head")?.name ?? "")}${line("Date:", dateOf.submittedToCommittee)}</div>
    </div>
  </div>

  <div class="declaration">
    <div class="declaration-title">Declaration by Contracts Committee</div>
    <div>The information contained in this form is a true and accurate record of the decision of the Contracts Committee meeting held on the above date.</div>
    <div class="pair">
      <div>${line("Signature:")}<div class="line"><span class="line-label">Position:</span><span class="b">&nbsp;Chairperson Contracts Committee</span></div></div>
      <div>${line("Name:", held("committee_chairperson")?.name ?? "")}${line("Date:", dateOf.chairperson)}</div>
    </div>
    <div class="pair" style="margin-top:4mm">
      <div>${line("Signature:")}<div class="line"><span class="line-label">Position:</span><span class="b">&nbsp;Secretary Contracts Committee</span></div></div>
      <div>${line("Name:", held("committee_secretary")?.name ?? "")}${line("Date:", dateOf.secretary)}</div>
    </div>
  </div>
</div>`;
  }

  openPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>FORM 5 — ${esc(request.referenceNumber)}</title>
<style>${TFORM_CSS}</style></head><body>${page1}${page2}${page3}${macroPages}</body></html>`);
}

// ── List of Supplies and Price Schedule ────────────────────────────────────

const SCHEDULE_FIRST_PAGE = 25;
const SCHEDULE_LATER_PAGES = 30;

const SCHEDULE_CSS = `
${sheetCss("portrait", "14mm 14mm 10mm 24mm")}
body { font-family: "Times New Roman", Times, serif; font-size: 13px; }
h1 { text-align: center; font-size: 21px; margin: 0 0 16px; }
.refs { text-align: center; font-weight: bold; font-size: 14px; line-height: 2; }
.refs .v { font-family: Arial, Helvetica, sans-serif; margin-left: 36px; }
.continued { font-weight: bold; font-size: 14px; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; }
.items { margin-top: 16px; }
.items th, .items td { border: 1.5px solid #000; padding: 2px 6px; height: 22px; }
.items th { background: #d9d9d9; text-align: left; vertical-align: top; font-size: 14px; height: 50px; }
.items td { font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
.c { text-align: center; }
.r { text-align: right; white-space: nowrap; }
.totals { width: 44%; margin-left: auto; margin-top: -1.5px; }
.totals td { border: 1.5px solid #000; padding: 4px 6px; height: 30px; }
.totals .label { text-align: right; font-weight: bold; font-size: 14px; width: 68%; }
.totals .v { font-family: Arial, Helvetica, sans-serif; }
.pto { text-align: right; font-size: 11px; font-style: italic; margin-top: 6px; }
`;

/**
 * The school's "List of Supplies and Price Schedule". Its references split the
 * request's number the way the school's own do: KSS/SUPLS/26/029 as the
 * procurement reference, and the running number (246) as the call-off order.
 */
export function printPriceSchedule(request: RequestRecord) {
  const { procurementRef, callOff } = splitReference(request.referenceNumber);
  const total = request.items.reduce((s, it) => s + Number(it.totalCost || 0), 0);

  const sheets = tableSheets({
    css: SCHEDULE_CSS,
    paper: "portrait",
    items: request.items,
    row: (it, i) =>
      `<tr><td class="c">${i + 1}</td><td>${esc(it.description)}</td><td class="c">${esc(
        quantity(it.quantity)
      )}</td><td class="c">${esc(it.unitOfMeasure)}</td><td class="r">${money(it.estimatedUnitCost)}</td><td class="r">${money(
        it.totalCost
      )}</td></tr>`,
    blankRow: "<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>",
    most: { first: SCHEDULE_FIRST_PAGE, rest: SCHEDULE_LATER_PAGES },
    sheet: (rows, { first, last }) => `
<div class="sheet">
  ${cornerBadge}
  ${
    first
      ? `<h1>List of Supplies and Price Schedule</h1>
  <div class="refs">
    <div>Procurement Reference No:<span class="v">${esc(procurementRef)}</span></div>
    <div>Call-Off Order Reference No:<span class="v">${esc(callOff)}</span></div>
  </div>`
      : `<div class="continued">List of Supplies and Price Schedule (continued)</div>`
  }
  <table class="items">
    <thead><tr>
      <th style="width:6%">Item No</th><th style="width:27%">Description of Supplies</th><th style="width:10%">Quantity</th>
      <th style="width:13%">Unit of Measure</th><th style="width:30%">Unit Price</th><th style="width:14%">Total Price</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${
    last
      ? `<table class="totals">
    <tr><td class="label">Other additional costs</td><td></td></tr>
    <tr><td class="label">Subtotal</td><td></td></tr>
    <tr><td class="label">VAT @ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; %</td><td></td></tr>
    <tr><td class="label">Total Price</td><td class="r v">${money(total)}</td></tr>
  </table>`
      : `<div class="pto">P.T.O.</div>`
  }
</div>`,
  });

  openPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Price schedule — ${esc(request.referenceNumber)}</title>
<style>${SCHEDULE_CSS}</style></head><body>${sheets}</body></html>`);
}

// ── Call-Off Order ─────────────────────────────────────────────────────────

/** "Four Million Seventy-Five Thousand Shillings Only" → "Four million seventy five thousand shillings only". */
function sentenceWords(amount: number) {
  const words = shillingsInWords(amount).replace(/-/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface CallOffDetails {
  /** The supplier on the request's LPO, if there is one. */
  provider: string | null;
  /** The LPO's issue date, or today. */
  date: string | null;
}

/** The Call-Off Order that goes out with the price schedule under a framework contract. */
export function printCallOffOrder(request: RequestRecord, officials: Officials, details: CallOffDetails) {
  const { procurementRef, callOff } = splitReference(request.referenceNumber);
  const total = request.items.reduce((s, it) => s + Number(it.totalCost || 0), 0);
  const officer = officials.accounting_officer;
  const date = dayFirst(details.date) || new Date().toLocaleDateString("en-GB");

  openPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Call-Off Order — ${esc(request.referenceNumber)}</title>
<style>
${sheetCss("portrait", "22mm 20mm 14mm 26mm")}
body { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.35; }
h1 { text-align: center; font-size: 21pt; margin: 0; }
h2 { text-align: center; font-size: 14pt; margin: 1mm 0 10mm; }
.fields { border-collapse: collapse; margin-bottom: 4mm; }
.fields td { padding: 1.4mm 0; vertical-align: top; }
.fields td:first-child { font-weight: bold; width: 74mm; }
.fields td:last-child { font-weight: bold; }
p { margin: 0 0 3.5mm; text-align: justify; }
.auth { width: 100%; border-collapse: collapse; margin-top: 4mm; }
.auth td, .auth th { border: 1px solid #000; padding: 2.5mm 3mm; text-align: left; }
.auth th { font-weight: bold; }
.auth td:first-child { width: 30mm; }
.auth .sign td { height: 11mm; }
</style></head><body>
<div class="sheet">
  ${cornerBadge}
  <h1>Call-Off Order</h1>
  <h2>Under a Framework Contract</h2>
  <table class="fields">
    <tr><td>Procurement Reference No:</td><td>${esc(procurementRef)}</td></tr>
    <tr><td>Call-Off Order Reference No:</td><td>${esc(callOff)}</td></tr>
    <tr><td>Procuring and Disposing Entity:</td><td>KIBULI SECONDARY SCHOOL</td></tr>
    <tr><td>Provider:</td><td>${esc((details.provider ?? "").toUpperCase())}</td></tr>
    <tr><td>Date of Call-Off Order:</td><td>${esc(date)}</td></tr>
  </table>
  <p>The Procuring and Disposing Entity indicated above issues this call-off order under the framework contract referenced above.</p>
  <p>This call-off order is subject to the terms and conditions of the framework contract referenced above. In the event of a conflict, between this call-off order and the contract, the contract shall prevail.</p>
  <p>Please proceed with delivery of the Supplies <strong>OR</strong> Services detailed on the attached List of Supplies and Price Schedule, in accordance with the response times specified in the contract.</p>
  <p>The total value of this call-off order is <strong>(${money(total)})</strong> ${esc(sentenceWords(total))}.</p>
  <p>Please confirm your receipt of this call-off order and that you are proceeding with delivery of the Supplies, in accordance with the terms and conditions of the contract.</p>
  <table class="auth">
    <tr><th colspan="2">Authorised by:</th></tr>
    <tr class="sign"><td>Signature:</td><td></td></tr>
    <tr><td>Name:</td><td>${esc((officer?.name ?? "").toUpperCase())}</td></tr>
    <tr><td>Position:</td><td>${esc(officer?.title ?? "Accounting Officer")}</td></tr>
  </table>
</div>
</body></html>`);
}
