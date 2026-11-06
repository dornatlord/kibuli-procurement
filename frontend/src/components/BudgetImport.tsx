import { useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { amountOf, readSpreadsheet, type Sheet } from "../lib/spreadsheet";
import { downloadBlob } from "../lib/forms/monthlyExcel";
import { SpinnerIcon } from "./icons";

interface Vote { id: number; code: string; name: string }
interface SubProgramme { id: number; voteId: number; romanNumeral: string | null; name: string }
interface Item { id: number; voteId: number; subProgrammeId: number | null; name: string; amount: string | null }

const money = (v: number | string) => Number(v).toLocaleString("en-UG");

/** A line's name as compared: case, spacing, punctuation and a leading number or code ignored. */
const normal = (s: string) =>
  s
    .toLowerCase()
    .replace(/^[\d.\-\s)]+(?=[a-z])/, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const columnName = (i: number) => {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/**
 * Imports a year's budget from a spreadsheet: each row's name is matched to a
 * budget line and its amount becomes that line's amount for the year. Nothing
 * changes until the preview is confirmed.
 */
export default function BudgetImport({
  year,
  votes,
  subProgrammes,
  items,
  onDone,
}: {
  year: number;
  votes: Vote[];
  subProgrammes: SubProgramme[];
  items: Item[];
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetNo, setSheetNo] = useState(0);
  const [nameCol, setNameCol] = useState(0);
  const [amountCol, setAmountCol] = useState(1);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [applying, setApplying] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const byName = useMemo(() => new Map(items.map((i) => [normal(i.name), i])), [items]);
  const rows = sheets[sheetNo]?.rows ?? [];
  const width = Math.max(0, ...rows.map((r) => r.length));

  /** A column's heading: its first cell on a row that has more than one cell filled in (skips a title line). */
  const heading = (c: number) => rows.find((r) => r[c] && r.filter(Boolean).length > 1)?.[c] ?? "";

  /** The columns most likely to hold the line names and their amounts. */
  function guess(list: string[][]) {
    const w = Math.max(0, ...list.map((r) => r.length));
    let name = 0;
    let best = -1;
    for (let c = 0; c < w; c++) {
      const hits = list.filter((r) => r[c] && byName.has(normal(r[c]))).length;
      if (hits > best) {
        best = hits;
        name = c;
      }
    }
    let amount = name === 0 ? 1 : 0;
    let most = -1;
    for (let c = 0; c < w; c++) {
      if (c === name) continue;
      const hits = list.filter((r) => r[name] && byName.has(normal(r[name])) && amountOf(r[c]) !== null).length;
      if (hits >= most && hits > 0) {
        most = hits;
        amount = c;
      }
    }
    return { name, amount };
  }

  function choose(list: Sheet[], no: number) {
    setSheetNo(no);
    const g = guess(list[no]?.rows ?? []);
    setNameCol(g.name);
    setAmountCol(g.amount);
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    setReading(true);
    try {
      const list = (await readSpreadsheet(file)).filter((s) => s.rows.length);
      if (!list.length) throw new Error("There is nothing in this file.");
      setSheets(list);
      setFileName(file.name);
      // Open on the sheet that matches the most budget lines.
      const score = (s: Sheet) => s.rows.filter((r) => r.some((c) => c && byName.has(normal(c)))).length;
      const best = list.reduce((b, s, i) => (score(s) > score(list[b]) ? i : b), 0);
      choose(list, best);
    } catch (e) {
      setSheets([]);
      setError(e instanceof Error ? e.message : "This file could not be read.");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }

  const preview = useMemo(() => {
    const seen = new Map<number, { item: Item; next: number }>();
    const skipped: { text: string; amount: number }[] = [];
    let repeated = 0;
    for (const r of rows) {
      const text = r[nameCol]?.trim();
      const amount = amountOf(r[amountCol]);
      if (!text || amount === null) continue;
      const item = byName.get(normal(text));
      if (!item) {
        // Headings and totals have a name and an amount too; show them, don't import them.
        skipped.push({ text, amount });
        continue;
      }
      if (seen.has(item.id)) repeated++;
      seen.set(item.id, { item, next: amount });
    }
    const matched = [...seen.values()];
    return { matched, skipped, repeated, total: matched.reduce((s, m) => s + m.next, 0) };
  }, [rows, nameCol, amountCol, byName]);

  const changed = preview.matched.filter((m) => Number(m.item.amount ?? NaN) !== m.next);
  const notInFile = items.length - preview.matched.length;

  async function apply() {
    if (!preview.matched.length) return;
    if (
      !window.confirm(
        `Set ${preview.matched.length} budget lines for ${year}? ${changed.length} of them change. Amounts already entered for those lines are replaced.`
      )
    ) {
      return;
    }
    setApplying(true);
    setError("");
    try {
      const res = await api.post<{ imported: number; changed: number }>("/budget/import", {
        year,
        lines: preview.matched.map((m) => ({ itemId: m.item.id, amount: m.next })),
      });
      setSheets([]);
      setFileName("");
      setOpen(false);
      onDone(`Imported ${res.imported} budget lines for ${year} (${res.changed} changed).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import the budget");
    } finally {
      setApplying(false);
    }
  }

  /** Every line with this year's amount, to fill in and bring back. */
  function template() {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = ["Vote,Sub-programme,Budget line,Amount"];
    for (const v of votes) {
      for (const i of items.filter((x) => x.voteId === v.id)) {
        const sp = subProgrammes.find((s) => s.id === i.subProgrammeId);
        lines.push(
          [q(`${v.code} ${v.name}`), q(sp ? `${sp.romanNumeral ? sp.romanNumeral + " " : ""}${sp.name}` : ""), q(i.name), i.amount ? String(Number(i.amount)) : ""].join(",")
        );
      }
    }
    downloadBlob(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `Budget ${year} - lines to fill in.csv`);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
        Import a budget
      </button>
    );
  }

  return (
    <section className="card w-full space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Import the {year} budget</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Choose an Excel (.xlsx) or CSV file with a column of budget line names and a column of amounts. Each row is matched to a
            budget line by its name, and you see what will change before anything is saved.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">
          Close
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".xlsx,.xlsm,.csv,.txt" onChange={(e) => pick(e.target.files?.[0])} className="text-sm" aria-label="Budget file" />
        {reading && <SpinnerIcon className="h-4 w-4 text-green-700" />}
        <button type="button" onClick={template} className="text-sm font-medium text-green-700 hover:text-green-800">
          Download the budget lines to fill in
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {sheets.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            {sheets.length > 1 && (
              <div>
                <label className="label" htmlFor="bi-sheet">
                  Sheet
                </label>
                <select id="bi-sheet" className="input w-48" value={sheetNo} onChange={(e) => choose(sheets, Number(e.target.value))}>
                  {sheets.map((s, i) => (
                    <option key={s.name} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(
              [
                ["Budget line names are in", nameCol, setNameCol, "bi-name"],
                ["Amounts are in", amountCol, setAmountCol, "bi-amount"],
              ] as const
            ).map(([label, value, set, id]) => (
              <div key={id}>
                <label className="label" htmlFor={id}>
                  {label}
                </label>
                <select id={id} className="input w-56" value={value} onChange={(e) => set(Number(e.target.value))}>
                  {Array.from({ length: width }, (_, c) => (
                    <option key={c} value={c}>
                      Column {columnName(c)}
                      {heading(c) ? ` — ${heading(c).slice(0, 24)}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <p className="pb-2 text-xs text-gray-500">{fileName}</p>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Stat label="Matched to a budget line" value={String(preview.matched.length)} />
            <Stat label="Will change" value={String(changed.length)} />
            <Stat label={`${year} total after import`} value={`UGX ${money(preview.total)}`} />
          </div>
          {preview.repeated > 0 && (
            <p className="text-sm text-amber-700">
              {preview.repeated} budget line{preview.repeated === 1 ? " appears" : "s appear"} more than once in the file; the last amount is used.
            </p>
          )}

          {preview.matched.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No row matched a budget line. Check the two columns above, or use "Download the budget lines to fill in" so the names match exactly.
            </p>
          ) : (
            <div className="max-h-80 overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Budget line</th>
                    <th className="px-3 py-2 text-right">Now</th>
                    <th className="px-3 py-2 text-right">After import</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.matched.map(({ item, next }) => {
                    const same = Number(item.amount ?? NaN) === next;
                    return (
                      <tr key={item.id} className={same ? "text-gray-400" : ""}>
                        <td className="px-3 py-1.5">{item.name}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{item.amount ? money(item.amount) : "—"}</td>
                        <td className={`px-3 py-1.5 text-right tabular-nums ${same ? "" : "font-medium text-gray-900"}`}>{money(next)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {preview.skipped.length > 0 && (
            <details className="text-sm text-gray-600">
              <summary className="cursor-pointer font-medium">
                {preview.skipped.length} row{preview.skipped.length === 1 ? "" : "s"} with an amount didn't match a budget line and will be left out
              </summary>
              <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto pl-4">
                {preview.skipped.map((s, i) => (
                  <li key={i}>
                    {s.text} — {money(s.amount)}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {preview.matched.length > 0 && notInFile > 0 && (
            <p className="text-xs text-gray-500">{notInFile} budget lines aren't in the file and keep their current amounts.</p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSheets([])} className="btn btn-secondary">
              Choose another file
            </button>
            <button type="button" onClick={apply} disabled={applying || preview.matched.length === 0} className="btn btn-primary">
              {applying ? "Importing…" : `Import ${preview.matched.length} lines into ${year}`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{value}</div>
    </div>
  );
}
