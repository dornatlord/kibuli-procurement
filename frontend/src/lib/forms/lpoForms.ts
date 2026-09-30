import { KSS_BADGE } from "../badge";
import { shillingsInWords } from "../words";
import type { Officials } from "../officials";
import { cornerBadge, dayFirst, esc, money, openPrint, sheetCss, tableSheets } from "../print";

export interface LpoItem {
  id: number;
  description: string;
  quantity: string;
  unitOfMeasure: string | null;
  unitPrice: string;
  totalPrice: string;
}

export interface LpoRecord {
  id: number;
  poNumber: string;
  /** Numbers start again at 1 each year; the year tells LPO 1 of 2025 from LPO 1 of 2026. */
  year?: number | null;
  status: string;
  issueDate: string | null;
  expectedDeliveryDate: string | null;
  deliveryLocation: string | null;
  totalAmount: string | null;
  termsAndConditions: string | null;
  createdAt: string;
  supplierId?: number;
  supplierName: string | null;
  supplierAddress: string | null;
  supplierPhone: string | null;
  procurementRequestId: number | null;
  referenceNumber: string | null;
  requestStatus: string | null;
  /** The request's date required, the delivery date when the LPO has none of its own. */
  requestDateRequired: string | null;
  requestSubject: string | null;
  /** The department of whoever raised the request. */
  requestDepartment: string | null;
  preparedByName: string | null;
  items: LpoItem[];
  /** When it was corrected, by whom and why. */
  corrections?: { at: string; by: string | null; reason: string | null }[];
}

/** The date goods are due: the LPO's own, or else the date the request needs them by. */
export const deliveryDateOf = (po: LpoRecord) => po.expectedDeliveryDate || po.requestDateRequired || null;

/**
 * How the system names an LPO: "3/2026". Numbers start again at 1 each year,
 * like the LPO books, so the year is what tells LPO 1 of 2025 from LPO 1 of
 * 2026. The printed LPO keeps just its red number, as in the book.
 */
export const lpoNumber = (po: { poNumber: string | null; year?: number | null }) =>
  po.poNumber ? (po.year ? `${po.poNumber}/${po.year}` : po.poNumber) : "";

// ── The LPO ─────────────────────────────────────────────────────────────

/** Item rows on the first page of the LPO book, and on each continuation page. */
const LPO_FIRST_PAGE = 13;
const LPO_LATER_PAGES = 20;

const LPO_CSS = `
${sheetCss("portrait", "11mm 16mm 8mm 16mm")}
body { font-family: "Times New Roman", Times, serif; font-size: 14px; }
.head { display: flex; align-items: center; gap: 14px; }
.head img { width: 80px; height: 88px; }
.name { font-size: 29px; font-weight: bold; letter-spacing: 0.5px; }
.addr { font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; margin-top: 2px; }
.bar-wrap { text-align: center; margin-top: 14px; }
.bar { display: inline-block; background: #111; color: #fff; font-family: "Arial Black", Arial, Helvetica, sans-serif; font-weight: 900; font-size: 17px; letter-spacing: 1.5px; padding: 7px 30px; }
.row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 16px; font-weight: bold; }
.no { font-size: 16px; }
.no .red { color: #c0392b; font-size: 30px; font-weight: normal; letter-spacing: 1px; margin-left: 6px; }
.fill { font-family: Arial, Helvetica, sans-serif; font-weight: normal; }
.dots { display: inline-block; min-width: 170px; border-bottom: 2px dotted #000; padding: 0 6px 2px; }
.line { border-bottom: 2px dotted #000; min-height: 26px; padding: 4px 6px 2px; }
.to { margin-top: 18px; font-weight: bold; }
.to-first { display: flex; gap: 8px; align-items: flex-end; }
.to-first .line { flex: 1; }
.to-rest { margin-left: 44px; }
.delivery { display: flex; gap: 8px; align-items: flex-end; margin-top: 12px; font-weight: bold; }
.delivery .line { min-width: 220px; }
.lead { font-weight: bold; font-size: 15px; margin-top: 18px; }
.continued { display: flex; align-items: center; gap: 12px; font-weight: bold; font-size: 15px; }
.continued img { width: 44px; height: 48px; }
table { width: 100%; border-collapse: collapse; margin-top: 3px; }
th, td { border: 2px solid #000; padding: 3px 8px; height: 28px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; }
th { font-size: 16px; }
.c { text-align: center; }
.r { text-align: right; white-space: nowrap; }
.total { text-align: right; font-weight: bold; font-size: 16px; }
.pto { font-size: 11px; font-weight: bold; font-style: italic; letter-spacing: 1px; }
.quote { text-align: center; font-weight: bold; font-size: 15px; margin-top: 14px; }
.words { display: flex; gap: 8px; align-items: flex-end; margin-top: 16px; font-weight: bold; font-size: 15px; }
.words .line { flex: 1; font-size: 14px; }
.sign { display: flex; justify-content: space-between; margin-top: 22px; font-weight: bold; font-size: 15px; }
.sign > div { width: 40%; text-align: center; }
.sign .dots { display: block; min-width: 0; margin: 26px 0 8px; }
.sign .who { font-family: Arial, Helvetica, sans-serif; font-weight: normal; font-size: 13px; margin-top: 3px; }
`;

/** The LPO laid out like a page from the school's LPO book, number in red. */
export function printLpo(po: LpoRecord, officials: Officials) {
  // The Head Teacher authorises LPOs; some schools name the Accounting Officer instead.
  const authorises = officials.head_teacher ?? officials.accounting_officer;
  const total = po.items.reduce((s, it) => s + Number(it.totalPrice || 0), 0);
  const date = dayFirst(po.issueDate) || new Date(po.createdAt).toLocaleDateString("en-GB");

  const itemRow = (it: LpoItem) => {
    const qty = `${Number(it.quantity).toLocaleString("en-UG")}${it.unitOfMeasure ? ` ${esc(it.unitOfMeasure)}` : ""}`;
    return `<tr><td class="c">${qty}</td><td>${esc(it.description)}</td><td class="r">${money(it.unitPrice)}</td><td class="r">${money(it.totalPrice)}</td></tr>`;
  };

  const sheet = (rows: string, { first, last }: { first: boolean; last: boolean }) => {
    const top = first
      ? `<div class="head">
  <img src="${KSS_BADGE}" alt="" />
  <div>
    <div class="name">KIBULI SECONDARY SCHOOL</div>
    <div class="addr">P.O Box 4216 Kampala - Uganda Tel: 0414 257339</div>
  </div>
</div>
<div class="bar-wrap"><span class="bar">LOCAL PURCHASE ORDER</span></div>
<div class="row">
  <div class="no">No. <span class="red">${esc(po.poNumber)}</span></div>
  <div>Date: <span class="dots fill">${esc(date)}</span></div>
</div>
<div class="to">
  <div class="to-first"><span>To:</span><div class="line fill">${esc(po.supplierName)}</div></div>
  <div class="to-rest">
    <div class="line fill">${esc(po.supplierAddress)}</div>
    <div class="line fill"></div>
  </div>
</div>
<div class="delivery"><span>Delivery date:</span><div class="line fill">${esc(dayFirst(deliveryDateOf(po)))}</div></div>
<div class="lead">Please supply / render the following goods / services:</div>`
      : `<div class="continued"><img src="${KSS_BADGE}" alt="" /><span>LOCAL PURCHASE ORDER No. ${esc(po.poNumber)} (continued)</span></div>`;

    const bottom = last
      ? `<div class="quote">Please quote our Order number on your Invoice</div>
<div class="words"><span>Amount in words :</span><div class="line fill">${esc(shillingsInWords(total))}</div></div>
<div class="line" style="margin-top:10px;"></div>
<div class="sign">
  <div>Prepared by<span class="dots"></span>Signature &amp; Title</div>
  <div>Authorised by<span class="dots"></span>Headteacher${authorises ? `<div class="who">${esc(authorises.name)}</div>` : ""}</div>
</div>`
      : "";

    return `<div class="sheet">
${top}
<table>
  <thead><tr><th style="width:17%">Quantity</th><th>Description</th><th style="width:17%">Unit Price</th><th style="width:21%">Amount</th></tr></thead>
  <tbody>
    ${rows}
    <tr><td></td><td colspan="2" class="total">TOTAL</td><td class="r">${
      last ? `<strong>${money(total)}</strong>` : `<span class="pto">P.T.O</span>`
    }</td></tr>
  </tbody>
</table>
${bottom}
</div>`;
  };

  const sheets = tableSheets({
    css: LPO_CSS,
    paper: "portrait",
    items: po.items,
    row: itemRow,
    blankRow: "<tr><td></td><td></td><td></td><td></td></tr>",
    sheet,
    most: { first: LPO_FIRST_PAGE, rest: LPO_LATER_PAGES },
  });

  openPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>LPO No. ${esc(lpoNumber(po))}</title>
<style>${LPO_CSS}</style></head><body>${sheets}</body></html>`);
}

// ── Completion certificate ───────────────────────────────────────────────

export interface CompletionDetails {
  date: string;
  department: string;
  service: string;
  /** What the provider completed, written on the certificate's three lines. */
  completed: string;
  submittedBy: string;
  verifiedBy: string;
  approvedBy: string;
}

/** Starting values for the certificate, from the LPO and the officials. */
export function completionDefaults(po: LpoRecord, officials: Officials): CompletionDetails {
  const service = po.requestSubject || po.items.map((it) => it.description).slice(0, 3).join(", ");
  return {
    date: new Date().toLocaleDateString("en-CA"),
    department: po.requestDepartment ?? "",
    service,
    completed: po.items.length
      ? `${po.items.map((it) => it.description).join(", ")} as per LPO No. ${lpoNumber(po)}`
      : "",
    submittedBy: officials.contract_manager?.name ?? "",
    verifiedBy: officials.deputy_head_teacher?.name ?? "",
    approvedBy: officials.head_teacher?.name ?? officials.accounting_officer?.name ?? "",
  };
}

/** Kibuli's Completion Certificate, signed by the contract manager, deputy and head teacher. */
export function printCompletionCertificate(po: LpoRecord, details: CompletionDetails) {
  const dotted = (value: string, grow = true) =>
    `<span class="dotted${grow ? " grow" : ""}">${esc(value)}</span>`;
  const signer = (n: number, verb: string, name: string, role: string) => `
  <div class="signer">
    <div class="row"><span class="num">${n})</span><span>${verb} by:</span>${dotted(name)}<span class="side">Date :</span>${dotted("", false)}</div>
    <div class="row sub"><span class="num"></span><span class="role">${role}</span><span class="spacer"></span><span class="side">Sign :</span>${dotted("", false)}</div>
  </div>`;

  openPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Completion Certificate — LPO No. ${esc(lpoNumber(po))}</title>
<style>
${sheetCss("portrait", "18mm 18mm 14mm 26mm")}
body { font-family: Calibri, Carlito, Arial, Helvetica, sans-serif; font-size: 13pt; }
h1 { text-align: center; font-size: 24pt; font-weight: normal; margin: 6mm 0 3mm; letter-spacing: 0.5px; }
h2 { text-align: center; font-size: 14pt; font-weight: bold; margin: 0 0 12mm; }
.row { display: flex; align-items: flex-end; gap: 2mm; margin-top: 6mm; }
.row.sub { margin-top: 5mm; }
.label { font-weight: bold; white-space: nowrap; }
.dotted { border-bottom: 1.5px dotted #000; min-height: 6mm; padding: 0 1mm 0.5mm; }
.dotted.grow { flex: 1; }
.dotted:not(.grow) { width: 52mm; }
.side { white-space: nowrap; margin-left: 4mm; }
.confirm { margin-top: 9mm; }
.lines .dotted { display: block; width: auto; margin-top: 6mm; min-height: 6mm; }
.satisfaction { margin-top: 8mm; }
.signer { margin-top: 5mm; }
.num { width: 8mm; flex: none; }
.role { white-space: nowrap; }
.spacer { flex: 1; }
</style></head><body>
<div class="sheet">
  ${cornerBadge}
  <h1>KIBULI SECONDARY SCHOOL</h1>
  <h2>COMPLETION CERTIFICATE</h2>

  <div class="row"><span class="label">Date:</span>${dotted(dayFirst(details.date), false)}<span class="label side">Order No:</span>${dotted(lpoNumber(po))}</div>
  <div class="row"><span class="label">Department :</span>${dotted(details.department)}</div>
  <div class="row"><span class="label">Service :</span>${dotted(details.service)}</div>
  <div class="row"><span class="label">Procurement Ref NO:</span>${dotted(po.referenceNumber ?? "")}</div>
  <div class="row"><span class="label">Service Provider:</span>${dotted(po.supplierName ?? "")}</div>

  <div class="confirm">This is to confirm that the above supplier/ service provider has completed the:</div>
  <div class="lines">${completedLines(details.completed)}</div>
  <div class="satisfaction">To my &nbsp;satisfaction.</div>

  ${signer(1, "Submitted", details.submittedBy, "Contract Manager :")}
  ${signer(2, "Verified", details.verifiedBy, "Deputy Headteacher")}
  ${signer(3, "Approved", details.approvedBy, "Headteacher")}
</div>
</body></html>`);

  /** The description written across the certificate's three dotted lines. */
  function completedLines(text: string) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lines = ["", "", ""];
    // Roughly the characters that fit on one dotted line at this size.
    const perLine = 70;
    let current = 0;
    for (const word of words) {
      if (current < 2 && (lines[current] + " " + word).trim().length > perLine) current++;
      lines[current] = (lines[current] + " " + word).trim();
    }
    return lines.map((l) => `<span class="dotted">${esc(l)}</span>`).join("");
  }
}
