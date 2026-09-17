import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { MONTHS, type SchoolTerm } from "../lib/terms";
import { ListSkeleton } from "../components/Loading";

export default function SettingsPage() {
  const [terms, setTerms] = useState<SchoolTerm[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<SchoolTerm[]>("/settings/terms")
      .then(setTerms)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the terms"));
  }, []);

  function update(index: number, patch: Partial<SchoolTerm>) {
    setSaved(false);
    setTerms((ts) => ts && ts.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  async function save() {
    if (!terms) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      setTerms(await api.put<SchoolTerm[]>("/settings/terms", { terms }));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the terms");
    } finally {
      setSaving(false);
    }
  }

  const covered = new Set(
    (terms ?? []).flatMap((t) =>
      Array.from({ length: Math.max(0, t.endMonth - t.startMonth + 1) }, (_, k) => t.startMonth + k)
    )
  );
  const leftOut = MONTHS.filter((_, i) => !covered.has(i + 1));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="School-wide settings. Changes apply to everyone." />

      <section className="card overflow-hidden">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">School terms</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            The months each term covers. The termly report (FORM 27) uses them as its reporting quarter.
          </p>
        </div>

        {!terms ? (
          error ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">{error}</div>
        ) : (
          <ListSkeleton rows={3} />
        )
        ) : (
          <div className="space-y-4 p-5">
            {terms.map((t, i) => (
              <div key={t.term} className="grid items-end gap-3 sm:grid-cols-[6rem_1fr_1fr]">
                <div className="text-sm font-semibold text-gray-900 sm:pb-2.5">Term {t.term}</div>
                <div>
                  <label className="label" htmlFor={`term-${t.term}-from`}>
                    From the start of
                  </label>
                  <select
                    id={`term-${t.term}-from`}
                    className="input"
                    value={t.startMonth}
                    onChange={(e) => update(i, { startMonth: Number(e.target.value) })}
                  >
                    {MONTHS.map((m, k) => (
                      <option key={m} value={k + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`term-${t.term}-to`}>
                    To the end of
                  </label>
                  <select
                    id={`term-${t.term}-to`}
                    className="input"
                    value={t.endMonth}
                    onChange={(e) => update(i, { endMonth: Number(e.target.value) })}
                  >
                    {MONTHS.map((m, k) => (
                      <option key={m} value={k + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {leftOut.length > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                Not in any term: {leftOut.join(", ")}. Anything bought in those months won't appear in a termly
                report.
              </p>
            )}
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
                {saving ? "Saving…" : "Save terms"}
              </button>
              {saved && <span className="text-sm font-medium text-green-700">Saved</span>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
