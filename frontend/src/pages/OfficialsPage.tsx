import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Official } from "../lib/officials";
import { useAuth } from "../lib/auth";
import PageHeader from "../components/PageHeader";
import { ListSkeleton } from "../components/Loading";

/**
 * The people who sign the school's forms, entered once. Whatever is here is
 * printed wherever that office appears, so nobody retypes a name per form.
 */
export default function OfficialsPage() {
  const { can } = useAuth();
  const canEdit = can("system.settings");
  const [officials, setOfficials] = useState<Official[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Official[]>("/settings/officials")
      .then(setOfficials)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the officials"));
  }, []);

  function update(key: string, patch: Partial<Official>) {
    setSaved(false);
    setOfficials((rows) => rows && rows.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  }

  async function save() {
    if (!officials) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const body = Object.fromEntries(officials.map((o) => [o.key, { name: o.name, title: o.title }]));
      setOfficials(await api.put<Official[]>("/settings/officials", { officials: body }));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the officials");
    } finally {
      setSaving(false);
    }
  }

  const filled = (officials ?? []).filter((o) => o.name.trim()).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Officials"
        subtitle="The people who sign the school's forms. Enter a name once and it prints wherever that office signs."
      />

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Who holds each office</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              The title is what prints under the signature line. Leave a name blank to keep that line empty for
              writing by hand.
            </p>
          </div>
          {officials && (
            <span className="text-sm text-gray-500">
              {filled} of {officials.length} filled in
            </span>
          )}
        </div>

        {!officials ? (
          error ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">{error}</div>
          ) : (
            <ListSkeleton rows={5} />
          )
        ) : (
          <div className="divide-y divide-gray-100">
            {officials.map((o) => (
              <div key={o.key} className="p-5">
                <div className="text-sm font-semibold text-gray-900">{o.label}</div>
                <p className="mt-0.5 text-xs text-gray-500">{o.usedFor}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor={`${o.key}-name`}>
                      Name
                    </label>
                    <input
                      id={`${o.key}-name`}
                      className="input"
                      value={o.name}
                      disabled={!canEdit}
                      placeholder="e.g. Ssemakadde Ibrahim"
                      onChange={(e) => update(o.key, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`${o.key}-title`}>
                      Title on the form
                    </label>
                    <input
                      id={`${o.key}-title`}
                      className="input"
                      value={o.title}
                      disabled={!canEdit}
                      placeholder={o.defaultTitle}
                      onChange={(e) => update(o.key, { title: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="space-y-3 p-5">
              <p className="text-sm text-gray-500">
                The member of the user department and their head of department aren't here: those names come from the
                request itself, so each form shows whoever raised and confirmed it.
              </p>
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
              )}
              {canEdit ? (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
                    {saving ? "Saving…" : "Save officials"}
                  </button>
                  {saved && <span className="text-sm font-medium text-green-700">Saved</span>}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Only an administrator can change these.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
