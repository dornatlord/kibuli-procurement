/**
 * FORM 2 as PPDA's Excel template. The template is opened as a zip and only
 * its cells are filled in, so its tables, dropdowns and layout stay exactly as
 * PPDA issued them. Rows keep the template's own styles; sample rows are cleared.
 */
import { MONTHLY_TEMPLATE_BASE64 } from "./monthlyTemplate";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

type Row = Record<string, string>;
export type MonthlyParts = { partI: Row[]; partII: Row[]; partIII: Row[]; partIV: Row[] };
type PartKey = keyof MonthlyParts;
type Kind = "text" | "num" | "date";

interface SheetDef {
  file: string;
  label: string;
  /** The template's first and last data rows. */
  first: number;
  last: number;
  /** Column letter, the row field it holds, and how it is written. */
  cols: [letter: string, key: string, kind: Kind][];
  /** The row of the template's TOTAL line, and the columns that add up. */
  total?: { row: number; sums: [letter: string, key: string][] };
}

/** Where each part sits in the template (PART 1A and 1B, PART 2 …). */
const SHEETS: Record<PartKey, SheetDef> = {
  partI: {
    file: "xl/worksheets/sheet1.xml",
    label: "Part I",
    first: 12,
    last: 76,
    cols: [
      ["B", "reference", "text"],
      ["C", "subject", "text"],
      ["D", "method", "text"],
      ["E", "provider", "text"],
      ["F", "reserved", "text"],
      ["G", "providerCategory", "text"],
      ["H", "targetGroup", "text"],
      ["I", "awardDate", "date"],
      ["J", "marketPrice", "num"],
      ["K", "bidPrice", "num"],
      ["L", "contractValue", "num"],
      ["M", "ownership", "text"],
    ],
    total: { row: 77, sums: [["L", "contractValue"]] },
  },
  partII: {
    file: "xl/worksheets/sheet2.xml",
    label: "Part II",
    first: 12,
    last: 40,
    cols: [
      ["B", "reference", "text"],
      ["C", "subject", "text"],
      ["D", "provider", "text"],
      ["E", "date", "date"],
      ["F", "value", "num"],
      ["G", "revisedValue", "num"],
    ],
  },
  partIII: {
    file: "xl/worksheets/sheet3.xml",
    label: "Part III",
    first: 12,
    last: 60,
    cols: [
      ["B", "reference", "text"],
      ["C", "subject", "text"],
      ["D", "provider", "text"],
      ["E", "reserved", "text"],
      ["F", "providerCategory", "text"],
      ["G", "completionDate", "date"],
      ["H", "amountPaid", "num"],
      ["I", "contractValue", "num"],
    ],
    total: {
      row: 61,
      sums: [
        ["H", "amountPaid"],
        ["I", "contractValue"],
      ],
    },
  },
  partIV: {
    file: "xl/worksheets/sheet4.xml",
    label: "Part IV",
    first: 12,
    last: 69,
    cols: [
      ["B", "reference", "text"],
      ["C", "subject", "text"],
      ["D", "method", "text"],
      ["E", "provider", "text"],
      ["F", "targetGroup", "text"],
      ["G", "awardDate", "date"],
      ["H", "invoiceAndDate", "text"],
      ["I", "marketPrice", "num"],
      ["J", "contractValue", "num"],
      ["K", "ownership", "text"],
    ],
    total: { row: 70, sums: [["J", "contractValue"]] },
  },
};

/** How many rows each part of the template holds. */
export const TEMPLATE_CAPACITY: Record<PartKey, number> = {
  partI: SHEETS.partI.last - SHEETS.partI.first + 1,
  partII: SHEETS.partII.last - SHEETS.partII.first + 1,
  partIII: SHEETS.partIII.last - SHEETS.partIII.first + 1,
  partIV: SHEETS.partIV.last - SHEETS.partIV.first + 1,
};

/** The parts too long for the template, e.g. "Part I has 80 rows but the template holds 65". */
export function overflowMessage(parts: MonthlyParts): string | null {
  const over = (Object.keys(SHEETS) as PartKey[])
    .filter((k) => parts[k].length > TEMPLATE_CAPACITY[k])
    .map((k) => `${SHEETS[k].label} has ${parts[k].length} rows but the template holds ${TEMPLATE_CAPACITY[k]}`);
  return over.length ? over.join("; ") : null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Uganda's financial year runs July to June: November 2026 is 2026/27, March 2026 is 2025/26. */
export function financialYear(year: number, month: number) {
  const start = month >= 7 ? year : year - 1;
  return `${start}/${String(start + 1).slice(2)}`;
}

/** "05/01/2026" → Excel's day number; anything else stays as typed text. */
function excelDate(v: string): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCDate() !== d || back.getUTCMonth() !== mo - 1) return null;
  return Math.round(ms / 86400000) + 25569;
}

const toNumber = (v: string): number | null => {
  const t = String(v ?? "").replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** The template's own dropdown wording for Part IV's target group (it spells these differently from Part I). */
const PART_IV_TARGET: Record<string, string> = {
  Youth: "Yourth",
  "Person With Disability (PWD)": "Persons With Disability (PWD)",
};

const colNo = (letter: string) => letter.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const lettersOf = (ref: string) => /^[A-Z]+/.exec(ref)![0];

function rowEl(doc: Document, sheetData: Element, r: number): Element {
  const rows = Array.from(sheetData.getElementsByTagNameNS(NS, "row"));
  const found = rows.find((el) => Number(el.getAttribute("r")) === r);
  if (found) return found;
  const el = doc.createElementNS(NS, "row");
  el.setAttribute("r", String(r));
  const after = rows.find((x) => Number(x.getAttribute("r")) > r) ?? null;
  sheetData.insertBefore(el, after);
  return el;
}

function cellEl(doc: Document, row: Element, ref: string): Element {
  const cells = Array.from(row.getElementsByTagNameNS(NS, "c"));
  const found = cells.find((c) => c.getAttribute("r") === ref);
  if (found) return found;
  const el = doc.createElementNS(NS, "c");
  el.setAttribute("r", ref);
  const after = cells.find((c) => colNo(lettersOf(c.getAttribute("r")!)) > colNo(lettersOf(ref))) ?? null;
  row.insertBefore(el, after);
  return el;
}

function clearCell(cell: Element) {
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  cell.removeAttribute("t");
}

function putText(doc: Document, cell: Element, text: string) {
  clearCell(cell);
  if (!text) return;
  cell.setAttribute("t", "inlineStr");
  const is = doc.createElementNS(NS, "is");
  const t = doc.createElementNS(NS, "t");
  t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  t.textContent = text;
  is.appendChild(t);
  cell.appendChild(is);
}

function putNumber(doc: Document, cell: Element, n: number) {
  clearCell(cell);
  const v = doc.createElementNS(NS, "v");
  v.textContent = String(n);
  cell.appendChild(v);
}

/** Fills a cell as the column asks: dates and amounts as numbers, anything else as text. */
function put(doc: Document, cell: Element, value: string, kind: Kind) {
  const text = String(value ?? "").trim();
  if (kind === "date") {
    const n = excelDate(text);
    return n === null ? putText(doc, cell, text) : putNumber(doc, cell, n);
  }
  if (kind === "num") {
    const n = toNumber(text);
    return n === null ? putText(doc, cell, text) : putNumber(doc, cell, n);
  }
  putText(doc, cell, text);
}

export interface MonthlyExport {
  year: number;
  month: number;
  entity: string;
  parts: MonthlyParts;
  declaration: { name: string; title: string; date: string };
}

/** Builds the filled workbook and returns it as an .xlsx blob. */
export async function buildMonthlyWorkbook({ year, month, entity, parts, declaration }: MonthlyExport): Promise<Blob> {
  const tooLong = overflowMessage(parts);
  if (tooLong) throw new Error(`${tooLong}. Remove or split the extra rows, then export again.`);

  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(MONTHLY_TEMPLATE_BASE64, { base64: true });
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const keys = Object.keys(SHEETS) as PartKey[];
  for (const key of keys) {
    const def = SHEETS[key];
    const xml = await zip.file(def.file)!.async("string");
    const doc = parser.parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("The Excel template could not be read.");
    const sheetData = doc.getElementsByTagNameNS(NS, "sheetData")[0];

    // Header lines: the reporting entity, month and financial year.
    putText(doc, cellEl(doc, rowEl(doc, sheetData, 6), "E6"), entity.toUpperCase());
    putText(doc, cellEl(doc, rowEl(doc, sheetData, 7), "C7"), MONTHS[month - 1]);
    putText(doc, cellEl(doc, rowEl(doc, sheetData, 8), "C8"), financialYear(year, month));

    // Clear the template's sample rows, then fill ours.
    for (let r = def.first; r <= def.last; r++) {
      const row = rowEl(doc, sheetData, r);
      for (const [letter] of def.cols) clearCell(cellEl(doc, row, `${letter}${r}`));
    }
    parts[key].forEach((data, i) => {
      const r = def.first + i;
      const row = rowEl(doc, sheetData, r);
      for (const [letter, field, kind] of def.cols) {
        let value = data[field] ?? "";
        if (key === "partIV" && field === "targetGroup") value = PART_IV_TARGET[value] ?? value;
        put(doc, cellEl(doc, row, `${letter}${r}`), value, kind);
      }
    });

    // The TOTAL line, where the part has one.
    if (def.total) {
      const row = rowEl(doc, sheetData, def.total.row);
      for (const [letter, field] of def.total.sums) {
        const nums = parts[key].map((d) => toNumber(d[field] ?? "")).filter((n): n is number => n !== null);
        const cell = cellEl(doc, row, `${letter}${def.total.row}`);
        if (nums.length) putNumber(doc, cell, Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100);
        else clearCell(cell);
      }
    }

    // Part IV ends with the Accounting Officer's declaration.
    if (key === "partIV") {
      const name = cellEl(doc, rowEl(doc, sheetData, 77), "B77");
      putText(doc, name, `Name: ${declaration.name || "________________________________"}`);
      const title = cellEl(doc, rowEl(doc, sheetData, 77), "E77");
      putText(doc, title, declaration.title || "__________________________________");
      const date = cellEl(doc, rowEl(doc, sheetData, 78), "D78");
      putText(doc, date, `Date: ${declaration.date || "_______________________________"}`);
    }

    // Open on the first sheet, scrolled to the top.
    const view = doc.getElementsByTagNameNS(NS, "sheetView")[0];
    if (view) {
      view.removeAttribute("topLeftCell");
      if (key === "partI") view.setAttribute("tabSelected", "1");
      else view.removeAttribute("tabSelected");
    }

    const out = serializer.serializeToString(doc);
    zip.file(def.file, out.startsWith("<?xml") ? out : XML_HEAD + out);
  }

  // The template opens on its second sheet; open on the first.
  const workbook = await zip.file("xl/workbook.xml")!.async("string");
  zip.file("xl/workbook.xml", workbook.replace(/activeTab="\d+"/, 'activeTab="0"'));

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
}

/** Offers the blob as a download. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
