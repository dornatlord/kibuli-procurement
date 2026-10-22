import { useState } from "react";
import Combobox from "./Combobox";
import type { CheckSection } from "./PrintCheck";
import { PrinterIcon } from "./icons";

export interface FormTab {
  key: string;
  label: string;
  sections: CheckSection[];
  /** Everything the form would print, with the saved details over the suggestions. */
  values: Record<string, string>;
  /** Whether anything has been changed since it was last saved. */
  dirty: boolean;
  /** Whether it has ever been saved. */
  saved: boolean;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  onSave: () => Promise<void>;
  onPrint: () => Promise<void>;
  /** The reason it can't print yet, if any. */
  blocked?: string;
}

/**
 * The names, titles and dates a request's forms print, kept beside the request
 * instead of asked about at print time. What's entered here is saved with the
 * request and printed exactly as saved, however many times it is printed.
 */
export default function FormDetailsPanel({
  tabs,
  savedAt,
  savedBy,
  canEdit,
}: {
  tabs: FormTab[];
  savedAt: string | null;
  savedBy: string | null;
  canEdit: boolean;
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const [busy, setBusy] = useState<"save" | "print" | null>(null);
  const [error, setError] = useState("");
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!tab) return null;

  async function run(kind: "save" | "print", fn: () => Promise<void>) {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the details");
    } finally {
      setBusy(null);
    }
  }

  const when = savedAt
    ? new Date(savedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <aside className="card overflow-hidden" aria-label="Details printed on this request's forms">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Details printed on the forms</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Saved with this request, and printed exactly as saved.
        </p>
      </div>

      {tabs.length > 1 && (
        <div role="tablist" className="flex border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={t.key === tab.key}
              onClick={() => setActive(t.key)}
              className={`flex-1 px-3 py-2.5 text-sm font-medium ${
                t.key === tab.key ? "border-b-2 border-green-700 text-green-800" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
              {t.dirty && <span className="ml-1 text-amber-600" title="Not saved yet">•</span>}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4 p-4">
        <p className={`rounded-lg px-3 py-2 text-xs ${tab.saved ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
          {tab.dirty
            ? "You've changed something. Save it to keep it with this request."
            : tab.saved
            ? `Saved${when ? ` ${when}` : ""}${savedBy ? ` by ${savedBy}` : ""}.`
            : "Suggested from the request and the school's officials. Save once they're right."}
        </p>

        {tab.sections.map((s) => (
          <fieldset key={s.title} disabled={!canEdit}>
            <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{s.title}</legend>
            <div className="grid grid-cols-2 gap-2">
              {s.fields.map((f, i) => {
                const whole = f.wide || s.fields.length === 1 || (s.fields.length === 3 && i === 0);
                return (
                  <div key={f.key} className={whole ? "col-span-2" : ""}>
                    <label htmlFor={`fd-${tab.key}-${f.key}`} className="label">
                      {f.label}
                    </label>
                    {f.type === "date" ? (
                      <input
                        id={`fd-${tab.key}-${f.key}`}
                        type="date"
                        value={tab.values[f.key] ?? ""}
                        onChange={(e) => tab.onChange(f.key, e.target.value)}
                        className="input"
                      />
                    ) : (
                      <Combobox
                        id={`fd-${tab.key}-${f.key}`}
                        value={tab.values[f.key] ?? ""}
                        onChange={(v) => tab.onChange(f.key, v)}
                        options={typeof f.options === "function" ? f.options(tab.values) : f.options ?? []}
                        onRemove={f.onRemove ? (o) => f.onRemove!(o.value, tab.values) : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {tab.blocked && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{tab.blocked}</p>}

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!tab.dirty || busy !== null}
              onClick={() => run("save", tab.onSave)}
            >
              {busy === "save" ? "Saving…" : "Save details"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!!tab.blocked || busy !== null}
            onClick={() => run("print", tab.onPrint)}
          >
            <PrinterIcon className="h-4 w-4" />
            {busy === "print" ? "Printing…" : "Print"}
          </button>
          {canEdit && (
            <button type="button" className="btn btn-ghost btn-sm ml-auto" disabled={busy !== null} onClick={tab.onReset}>
              Reset to suggested
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
