/**
 * Reads an uploaded .xlsx or .csv into rows of text, so a page can offer to
 * import it. Only values are read (a formula's last calculated value);
 * formatting, merged cells and the like are ignored.
 */

export interface Sheet {
  name: string;
  rows: string[][];
}

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const parseXml = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("This file could not be read.");
  return doc;
};

/** "AB12" → column index 27 (zero based). */
function columnIndex(ref: string) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  return letters.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

const textOf = (el: Element) =>
  Array.from(el.getElementsByTagNameNS(MAIN, "t"))
    .map((t) => t.textContent ?? "")
    .join("");

/** Excel stores a number as it is; trims the noise a float leaves (0.1 + 0.2). */
const plainNumber = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : v;
};

async function readXlsx(file: File): Promise<Sheet[]> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const read = async (path: string) => {
    const f = zip.file(path);
    return f ? parseXml(await f.async("string")) : null;
  };

  const shared: string[] = [];
  const ss = await read("xl/sharedStrings.xml");
  if (ss) for (const si of Array.from(ss.getElementsByTagNameNS(MAIN, "si"))) shared.push(textOf(si));

  const workbook = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("This doesn't look like an Excel file.");
  const target = new Map<string, string>();
  for (const r of Array.from(rels.getElementsByTagName("Relationship"))) {
    target.set(r.getAttribute("Id") ?? "", (r.getAttribute("Target") ?? "").replace(/^\/?(xl\/)?/, "xl/"));
  }

  const sheets: Sheet[] = [];
  for (const s of Array.from(workbook.getElementsByTagNameNS(MAIN, "sheet"))) {
    const path = target.get(s.getAttributeNS(REL, "id") ?? "");
    const doc = path ? await read(path) : null;
    if (!doc) continue;
    const rows: string[][] = [];
    for (const row of Array.from(doc.getElementsByTagNameNS(MAIN, "row"))) {
      const r = Math.max(0, Number(row.getAttribute("r") ?? rows.length + 1) - 1);
      const cells: string[] = [];
      for (const c of Array.from(row.getElementsByTagNameNS(MAIN, "c"))) {
        const type = c.getAttribute("t");
        const v = c.getElementsByTagNameNS(MAIN, "v")[0]?.textContent ?? "";
        let value = "";
        if (type === "s") value = shared[Number(v)] ?? "";
        else if (type === "inlineStr") value = textOf(c);
        else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
        else if (type === "str" || type === "e") value = v;
        else value = v === "" ? "" : plainNumber(v);
        cells[columnIndex(c.getAttribute("r") ?? "A1")] = value.trim();
      }
      while (rows.length < r) rows.push([]);
      rows[r] = Array.from(cells, (x) => x ?? "");
    }
    sheets.push({ name: s.getAttribute("name") ?? `Sheet ${sheets.length + 1}`, rows });
  }
  return sheets;
}

/** Comma, semicolon or tab separated text, with "quoted, fields". */
function readCsv(text: string): Sheet[] {
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field.trim());
    rows.push(row);
  }
  return [{ name: "CSV", rows }];
}

/** The sheets of an uploaded spreadsheet. Throws a plain message if it can't be read. */
export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) {
    throw new Error("This is an old .xls file. Open it in Excel, choose Save As, and pick Excel Workbook (.xlsx) or CSV.");
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) return readCsv(await file.text());
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    try {
      return await readXlsx(file);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "This file could not be read.");
    }
  }
  throw new Error("Choose an Excel (.xlsx) or CSV file.");
}

/** "UGX 1,250,000" → 1250000; text that isn't an amount → null. */
export function amountOf(cell: string | undefined): number | null {
  if (cell === undefined) return null;
  const t = cell.replace(/UGX|USH|SHS?/gi, "").replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
