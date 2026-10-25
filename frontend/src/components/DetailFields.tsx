import Combobox from "./Combobox";
import type { CheckSection } from "./PrintCheck";

/**
 * The names, titles and dates a form prints, as boxes: a name or title box
 * takes whatever is typed and offers the names kept for that office to pick
 * from; a date box is a date. Used where they're first filled in (the new
 * request) and where they're reviewed (beside the saved request).
 */
export default function DetailFields({
  sections,
  values,
  onChange,
  idPrefix,
  disabled = false,
  needed,
}: {
  sections: CheckSection[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  idPrefix: string;
  disabled?: boolean;
  /** Boxes to outline in red: left empty though the form needs them. */
  needed?: Set<string>;
}) {
  return (
    <>
      {sections.map((s) => (
        <fieldset key={s.title} disabled={disabled}>
          <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{s.title}</legend>
          <div className="grid grid-cols-2 gap-2">
            {s.fields.map((f, i) => {
              const whole = f.wide || s.fields.length === 1 || (s.fields.length === 3 && i === 0);
              const flagged = needed?.has(f.key) ? "rounded-lg border-red-400 ring-2 ring-red-200" : "";
              return (
                <div key={f.key} className={whole ? "col-span-2" : ""}>
                  <label htmlFor={`${idPrefix}-${f.key}`} className="label">
                    {f.label}
                  </label>
                  {f.type === "date" ? (
                    <input
                      id={`${idPrefix}-${f.key}`}
                      type="date"
                      value={values[f.key] ?? ""}
                      onChange={(e) => onChange(f.key, e.target.value)}
                      className={`input ${flagged}`}
                    />
                  ) : (
                    <div className={needed?.has(f.key) ? "rounded-lg ring-2 ring-red-200" : ""}>
                      <Combobox
                        id={`${idPrefix}-${f.key}`}
                        value={values[f.key] ?? ""}
                        onChange={(v) => onChange(f.key, v)}
                        options={typeof f.options === "function" ? f.options(values) : f.options ?? []}
                        onRemove={f.onRemove ? (o) => f.onRemove!(o.value, values) : undefined}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </>
  );
}
