import { KSS_BADGE } from "./badge";

/** Anything a person typed is escaped before it goes into printed HTML. */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "2026-09-09" or an ISO timestamp → "09/09/2026", the way the school's forms write dates. */
export function dayFirst(value: string | null | undefined): string {
  if (!value) return "";
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB");
}

/** The day in Kampala, as YYYY-MM-DD, for a timestamp; a plain date passes through. */
export function kampalaDay(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(at);
}

/** "4075000" → "4,075,000"; blank stays blank. */
export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-UG") : "";
}

/**
 * Page set-up for a printout made of separate sheets.
 *
 * Browsers print their own header and footer — the date and time, the page
 * title, "about:blank", page numbers — in the page margin. Setting that margin
 * to nothing leaves them no room, so they don't print, and each sheet makes its
 * own margin with padding instead. The wider left padding holds the badge.
 */
export function sheetCss(orientation: "portrait" | "landscape", padding = "11mm 14mm 9mm 24mm"): string {
  const [width, height] = orientation === "landscape" ? ["297mm", "210mm"] : ["210mm", "297mm"];
  return `
@page { size: A4 ${orientation}; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
.sheet { position: relative; width: ${width}; padding: ${padding}; break-after: page; page-break-after: always; }
.sheet:last-child { break-after: auto; page-break-after: auto; }
.corner-badge { position: absolute; top: 5mm; left: 5mm; width: 15mm; height: 16.5mm; }
@media screen {
  body { background: #7a7a7a; padding: 8mm 0; }
  .sheet { background: #fff; min-height: ${height}; margin: 0 auto 8mm; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35); }
}`;
}

/**
 * Page set-up for a printout that flows over as many pages as it needs, such
 * as the PPDA returns. The margin is zero for the same reason as above; the
 * repeating header and footer rows of a frame table put space at the top and
 * bottom of every page instead. Wrap the content with frameOpen / frameClose.
 */
export function flowCss(orientation: "portrait" | "landscape"): string {
  return `
@page { size: A4 ${orientation}; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
table.frame { width: 100%; border-collapse: collapse; margin: 0; }
table.frame > tbody > tr { break-inside: auto; page-break-inside: auto; }
table.frame > thead > tr > td, table.frame > tfoot > tr > td, table.frame > tbody > tr > td.page { border: 0; padding: 0; }
table.frame > thead > tr > td { height: 11mm; }
table.frame > tfoot > tr > td { height: 9mm; }
table.frame > tbody > tr > td.page { padding: 0 14mm 0 24mm; }
.corner-badge { position: absolute; top: 5mm; left: 5mm; width: 15mm; height: 16.5mm; }
@media screen { body { padding-bottom: 8mm; } }`;
}

export const frameOpen = `<table class="frame"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td class="page">`;
export const frameClose = `</td></tr></tbody></table>`;

/** The school badge in a sheet's top-left corner: small, but there, to show whose form it is. */
export const cornerBadge = `<img class="corner-badge" src="${KSS_BADGE}" alt="" />`;

/** Splits rows into pages: the first page holds `first` rows, every later one `rest`. */
export function paginate<T>(rows: T[], first: number, rest: number): T[][] {
  const pages: T[][] = [rows.slice(0, first)];
  for (let i = first; i < rows.length; i += rest) pages.push(rows.slice(i, i + rest));
  return pages;
}

/** A printout built of sheets around one table that may run over several pages. */
export interface TableSheets<T> {
  /** The printout's own styles, so the rows are measured exactly as they print. */
  css: string;
  paper: "portrait" | "landscape";
  items: T[];
  /** An item's table row (starting `<tr`); `index` counts across the whole table from 0. */
  row: (item: T, index: number) => string;
  /** An empty ruled row. The first sheet is filled out with these, as on the paper form. */
  blankRow?: string;
  /** A whole sheet with `rows` in its table. The last sheet carries the totals and signatures. */
  sheet: (rows: string, page: { first: boolean; last: boolean }) => string;
  /** The most rows a sheet takes: the form's own ruled lines. */
  most: { first: number; rest: number };
}

/**
 * Lays a table's rows out over sheets by how tall they print, not just how many
 * there are.
 *
 * A form's ruled lines say how many rows a sheet takes, but a description long
 * enough to wrap makes its row taller, and at a fixed count the sheet would then
 * run past the bottom of the paper: onto an extra page, with every page after it
 * out of step. So the sheets are first laid out out of sight, with the printout's
 * own styles, and each takes only the rows that fit, keeping room on the last
 * one for what follows the table.
 */
export function tableSheets<T>(spec: TableSheets<T>): string {
  const pages = splitRows(spec);
  return pages
    .map((page, p) => {
      const rows = page.rows.map((i) => spec.row(spec.items[i], i)).join("") + (spec.blankRow ?? "").repeat(page.blanks);
      return spec.sheet(rows, { first: p === 0, last: p === pages.length - 1 });
    })
    .join("");
}

interface SheetRows {
  rows: number[];
  blanks: number;
}

/** Room left at the foot of each sheet, for differences between screen and printer. */
const SPARE_MM = 4;
const PX_PER_MM = 96 / 25.4;

function splitRows<T>(spec: TableSheets<T>): SheetRows[] {
  const measured = measureRows(spec);
  const indexes = spec.items.map((_, i) => i);
  if (!measured) {
    // Nowhere to measure (not in a browser): by count alone.
    const pages = paginate(indexes, spec.most.first, spec.most.rest);
    return pages.map((rows) => ({
      rows,
      blanks: pages.length === 1 && spec.blankRow ? spec.most.first - rows.length : 0,
    }));
  }

  const { heights, blank, room } = measured;
  const pages: (SheetRows & { used: number })[] = [];
  let i = 0;
  while (true) {
    const first = pages.length === 0;
    const space = first ? room.first : room.rest;
    const most = first ? spec.most.first : spec.most.rest;
    const rows: number[] = [];
    let used = 0;
    // A row taller than a whole sheet still goes somewhere.
    while (i < heights.length && rows.length < most && (rows.length === 0 || used + heights[i] <= space.more)) {
      used += heights[i];
      rows.push(i++);
    }
    if (i < heights.length) {
      pages.push({ rows, blanks: 0, used });
      continue;
    }
    if (used <= space.last || rows.length < 2) {
      pages.push({ rows, blanks: 0, used });
      break;
    }
    // Everything left fits, but not with the totals and signatures as well: the
    // sheet carries on overleaf, and its last row starts the final sheet.
    const moved = rows.pop()!;
    pages.push({ rows, blanks: 0, used: used - heights[moved] });
    pages.push({ rows: [moved], blanks: 0, used: heights[moved] });
    break;
  }

  // When everything fits on one sheet, it keeps the form's empty ruled lines, as
  // many as there is room for. A sheet that carries on overleaf has none: a gap
  // above "P.T.O" would read as an item left out.
  const only = pages[0];
  if (pages.length === 1 && spec.blankRow && blank > 0) {
    const fit = Math.floor((room.first.last - only.used) / blank);
    only.blanks = Math.max(0, Math.min(spec.most.first - only.rows.length, fit));
  }
  return pages;
}

/** Each row's printed height, and the room for rows on each kind of sheet, in CSS pixels. */
function measureRows<T>(spec: TableSheets<T>) {
  if (typeof document === "undefined" || !document.body) return null;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0;visibility:hidden;";
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    const view = frame.contentWindow;
    if (!doc || !view) return null;
    const mark = (tr: string, key: string) => tr.replace(/^\s*<tr/, `<tr data-measure="${key}"`);
    const allRows =
      spec.items.map((item, i) => mark(spec.row(item, i), String(i))).join("") +
      (spec.blankRow ? mark(spec.blankRow, "blank") : "");
    // The table with every row in it, then each kind of sheet with no rows at all.
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${spec.css}</style></head><body>
${spec.sheet(allRows, { first: true, last: false })}
${spec.sheet("", { first: true, last: false })}
${spec.sheet("", { first: true, last: true })}
${spec.sheet("", { first: false, last: false })}
${spec.sheet("", { first: false, last: true })}
</body></html>`);
    doc.close();

    const heightOf = (key: string) => {
      const row = doc.querySelector(`[data-measure="${key}"]`);
      return row ? row.getBoundingClientRect().height : 0;
    };
    const sheets = Array.from(doc.querySelectorAll<HTMLElement>(".sheet"));
    if (sheets.length < 5) return null;
    // How far down its sheet the content reaches, the sheet's bottom padding included.
    const used = (sheet: HTMLElement) => {
      const top = sheet.getBoundingClientRect().top;
      let bottom = top;
      for (const child of Array.from(sheet.children)) {
        bottom = Math.max(bottom, child.getBoundingClientRect().bottom + parseFloat(view.getComputedStyle(child).marginBottom || "0"));
      }
      return bottom - top + parseFloat(view.getComputedStyle(sheet).paddingBottom || "0");
    };
    const paper = (spec.paper === "portrait" ? 297 : 210) * PX_PER_MM - SPARE_MM * PX_PER_MM;
    const [, firstMore, firstLast, restMore, restLast] = sheets.map((s) => paper - used(s));
    return {
      heights: spec.items.map((_, i) => heightOf(String(i))),
      blank: spec.blankRow ? heightOf("blank") : 0,
      room: { first: { more: firstMore, last: firstLast }, rest: { more: restMore, last: restLast } },
    };
  } finally {
    frame.remove();
  }
}

/** Opens a printout in its own window and brings up the print dialog. */
export function openPrint(html: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
