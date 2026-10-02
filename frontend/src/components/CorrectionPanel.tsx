import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { PlusIcon, XIcon } from "./icons";

/** An item line while it's being corrected. `id` is set for a line already saved. */
export interface EditLine {
  key: string;
  id?: number;
  description: string;
  quantity: string;
  unitOfMeasure: string;
  unitPrice: string;
}

export interface CorrectionField {
  key: string;
  label: string;
  type?: "text" | "date" | "textarea";
}

/** Saved lines, ready to edit. */
export function toEditLines(
  rows: { id: number; description: string; quantity: string | null; unitOfMeasure: string | null; price: string | null }[]
): EditLine[] {
  const plain = (v: string | null) => (v === null || v === "" ? "" : String(Number(v)));
  return rows.map((r) => ({
    key: `line-${r.id}`,
    id: r.id,
    description: r.description,
    quantity: plain(r.quantity),
    unitOfMeasure: r.unitOfMeasure ?? "",
    unitPrice: plain(r.price),
  }));
}

const money = (n: number) => n.toLocaleString("en-UG", { maximumFractionDigits: 2 });

/**
 * Correcting a saved record: its details and item lines, with the reason,
 * which the audit trail keeps with what changed. Only shown to the people
 * allowed to correct records.
 */
export default function CorrectionPanel({
  title,
  fields,
  initial,
  lines: startLines,
  priceLabel = "Unit price",
  extra,
  onSave,
  onClose,
}: {
  title: string;
  fields: CorrectionField[];
  initial: Record<string, string>;
  lines: EditLine[];
  priceLabel?: string;
  /** More fields of the page's own, such as a supplier picker. */
  extra?: ReactNode;
  onSave: (body: { values: Record<string, string>; items: Omit<EditLine, "key">[]; reason: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [lines, setLines] = useState(startLines);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const newKey = useRef(0);

  const setLine = (key: string, patch: Partial<EditLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Say what was wrong, so the audit trail records why it was corrected.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ values, items: lines.map(({ key: _key, ...line }) => line), reason: reason.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the correction");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card overflow-hidden border-amber-300" aria-label={title}>
      <div className="flex items-start justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-900">{title}</h2>
          <p className="text-sm text-amber-900/80">
            Change what's wrong and say why. The Audit Trail keeps what changed and who changed it; printing shows the
            corrected version.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close without saving" className="rounded p-1 text-amber-900/70 hover:bg-amber-100">
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <label htmlFor={`fix-${f.key}`} className="label">
                {f.label}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  id={`fix-${f.key}`}
                  rows={3}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="input"
                />
              ) : (
                <input
                  id={`fix-${f.key}`}
                  type={f.type === "date" ? "date" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="input"
                />
              )}
            </div>
          ))}
          {extra}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-2">Description</th>
                <th className="w-28 px-2 py-2">Quantity</th>
                <th className="w-28 px-2 py-2">Unit</th>
                <th className="w-36 px-2 py-2">{priceLabel}</th>
                <th className="w-32 px-2 py-2 text-right">Total</th>
                <th className="w-8 py-2">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.key} className="align-top">
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Item ${i + 1} description`}
                      value={l.description}
                      onChange={(e) => setLine(l.key, { description: e.target.value })}
                      className="input"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      aria-label={`Item ${i + 1} quantity`}
                      type="number"
                      min="0"
                      step="any"
                      value={l.quantity}
                      onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                      className="input text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      aria-label={`Item ${i + 1} unit`}
                      autoCapitalize="off"
                      value={l.unitOfMeasure}
                      onChange={(e) => setLine(l.key, { unitOfMeasure: e.target.value })}
                      className="input"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      aria-label={`Item ${i + 1} ${priceLabel.toLowerCase()}`}
                      type="number"
                      min="0"
                      step="any"
                      value={l.unitPrice}
                      onChange={(e) => setLine(l.key, { unitPrice: e.target.value })}
                      className="input text-right"
                    />
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-gray-700">
                    {money((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0))}
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      disabled={lines.length === 1}
                      aria-label={`Remove item ${i + 1}`}
                      className="mt-1.5 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setLines((ls) => [
                        ...ls,
                        { key: `new-${++newKey.current}`, description: "", quantity: "1", unitOfMeasure: "", unitPrice: "" },
                      ])
                    }
                    className="btn btn-ghost btn-sm"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Add item
                  </button>
                </td>
                <td className="px-2 pt-3 text-right font-semibold tabular-nums text-gray-900">UGX {money(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div>
          <label htmlFor="fix-reason" className="label">
            What was wrong? (kept in the Audit Trail)
          </label>
          <textarea
            id="fix-reason"
            rows={2}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError("");
            }}
            placeholder="e.g. The quantity of balls was typed as 30 instead of 3"
            className="input"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Saving…" : "Save correction"}
          </button>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

export interface Correction {
  at: string;
  by: string | null;
  reason: string | null;
}

/** When a record was corrected, by whom and why. */
export function CorrectionHistory({ corrections }: { corrections?: Correction[] }) {
  if (!corrections?.length) return null;
  return (
    <section className="card overflow-hidden" aria-label="Corrections">
      <div className="border-b border-gray-100 bg-gray-50/80 px-5 py-2.5">
        <h2 className="text-sm font-semibold text-gray-900">Corrections</h2>
        <p className="text-xs text-gray-500">The Audit Trail shows exactly what each one changed.</p>
      </div>
      <ul className="divide-y divide-gray-100">
        {corrections.map((c, i) => (
          <li key={i} className="px-5 py-3 text-sm">
            <span className="font-medium text-gray-900">{new Date(c.at).toLocaleDateString("en-GB")}</span>
            <span className="text-gray-500"> · {c.by ?? "Someone"}</span>
            {c.reason && <p className="mt-0.5 text-gray-700">{c.reason}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
