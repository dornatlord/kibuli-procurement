import { useState, type FormEvent } from "react";
import Combobox, { type ComboOption } from "./Combobox";
import { PrinterIcon, XIcon } from "./icons";

export interface CheckField {
  key: string;
  label: string;
  type?: "text" | "date";
  /**
   * Choices to pick from; the box still takes whatever is typed. A function
   * gets the values as they stand, so a name's choices can follow its title.
   */
  options?: (string | ComboOption)[] | ((values: Record<string, string>) => (string | ComboOption)[]);
  /**
   * Takes a choice marked `removable` off the list for good (a name that was
   * kept once and won't sign again), given the values as they stand.
   */
  onRemove?: (value: string, values: Record<string, string>) => void;
  /** Takes the whole row, for something long like a plan reference. */
  wide?: boolean;
}

export interface CheckSection {
  title: string;
  fields: CheckField[];
}

/**
 * The names, titles and dates a form is about to print, already filled in
 * and open to change: a name that isn't the right one can be typed over or
 * picked from the others in that office. The changes shape this printout;
 * `onPrint` gets the starting values too, to tell what was changed.
 */
export default function PrintCheck<T extends Record<string, string>>({
  title,
  sections,
  initial,
  onPrint,
  onClose,
}: {
  title: string;
  sections: CheckSection[];
  initial: T;
  onPrint: (values: T, start: T) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<T>(initial);
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    onPrint(values, initial);
  }

  return (
    <form onSubmit={submit} className="card overflow-hidden border-green-300" aria-label={title}>
      <div className="flex items-start justify-between gap-3 border-b border-green-200 bg-green-50 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-green-900">{title}</h2>
          <p className="text-sm text-green-900/80">
            These fill themselves in. Change any that aren't right, then print. Changes here go on this printout only.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close without printing"
          className="rounded p-1 text-green-900/70 hover:bg-green-100"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        {sections.map((s) => (
          <fieldset key={s.title}>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.title}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {s.fields.map((f) => (
                <div key={f.key} className={f.wide ? "sm:col-span-3" : ""}>
                  <label htmlFor={`check-${f.key}`} className="label">
                    {f.label}
                  </label>
                  {f.type === "date" ? (
                    <input
                      id={`check-${f.key}`}
                      type="date"
                      value={values[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      className="input"
                    />
                  ) : (
                    <Combobox
                      id={`check-${f.key}`}
                      value={values[f.key] ?? ""}
                      onChange={(v) => set(f.key, v)}
                      options={typeof f.options === "function" ? f.options(values) : f.options ?? []}
                      onRemove={f.onRemove ? (o) => f.onRemove!(o.value, values) : undefined}
                    />
                  )}
                </div>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">
            <PrinterIcon className="h-4 w-4" />
            Print
          </button>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
