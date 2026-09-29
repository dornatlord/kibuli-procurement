import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { Official } from "../lib/officials";
import { useAuth } from "../lib/auth";
import PageHeader from "../components/PageHeader";
import { ListSkeleton } from "../components/Loading";
import { PlusIcon, XIcon } from "../components/icons";

interface NewOfficial {
  label: string;
  usedFor: string;
  name: string;
}

const EMPTY_NEW: NewOfficial = { label: "", usedFor: "", name: "" };

/**
 * The people who sign the school's forms, entered once. Whatever is here is
 * printed wherever that office appears, so nobody retypes a name per form.
 * The school can add offices of its own, such as a Bursar.
 */
export default function OfficialsPage() {
  const { can } = useAuth();
  const canEdit = can("system.settings");
  const [officials, setOfficials] = useState<Official[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<NewOfficial | null>(null);

  useEffect(() => {
    api
      .get<Official[]>("/settings/officials")
      .then(setOfficials)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the officials"));
  }, []);

  function update(key: string, patch: Partial<Official>) {
    setSaved("");
    setOfficials((rows) => rows && rows.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  }

  async function save(rows: Official[], message = "Saved") {
    setSaving(true);
    setSaved("");
    setError("");
    try {
      const builtIn = rows.filter((o) => !o.custom);
      const added = rows.filter((o) => o.custom);
      const result = await api.put<Official[]>("/settings/officials", {
        officials: Object.fromEntries(builtIn.map((o) => [o.key, { name: o.name, title: o.title }])),
        custom: added.map((o) => ({
          // New offices get their key from the server.
          key: o.key.startsWith("custom-") ? o.key : undefined,
          label: o.label,
          usedFor: o.usedFor,
          name: o.name,
          title: o.title,
        })),
      });
      setOfficials(result);
      setSaved(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the officials");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addOfficial(e: FormEvent) {
    e.preventDefault();
    if (!officials || !adding) return;
    const label = adding.label.trim().toUpperCase();
    if (!label) return;
    const next: Official = {
      key: `new-${Date.now()}`,
      label,
      defaultTitle: label,
      usedFor: adding.usedFor.trim(),
      name: adding.name.trim(),
      title: label,
      custom: true,
    };
    if (await save([...officials, next], `Added ${label}`)) setAdding(null);
  }

  async function removeOfficial(o: Official) {
    if (!officials) return;
    if (!window.confirm(`Remove ${o.label}${o.name ? ` (${o.name})` : ""} from the officials?`)) return;
    await save(
      officials.filter((x) => x.key !== o.key),
      `Removed ${o.label}`
    );
  }

  const filled = (officials ?? []).filter((o) => o.name.trim()).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Officials"
        subtitle="The people who sign the school's forms. Enter a name once and it prints wherever that office signs."
        actions={
          canEdit &&
          officials &&
          !adding && (
            <button type="button" onClick={() => setAdding(EMPTY_NEW)} className="btn btn-primary">
              <PlusIcon className="h-4 w-4" />
              Add official
            </button>
          )
        }
      />

      {adding && (
        <form onSubmit={addOfficial} className="card space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add an official</h2>
            <p className="mt-0.5 text-sm text-gray-500">For an office that isn't listed, such as the Bursar or the Storekeeper.</p>
          </div>
          <div>
            <label className="label" htmlFor="new-official-title">
              Title
            </label>
            <input
              id="new-official-title"
              className="input uppercase"
              value={adding.label}
              onChange={(e) => setAdding((a) => a && { ...a, label: e.target.value.toUpperCase() })}
              placeholder="e.g. BURSAR"
              maxLength={60}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="new-official-duty">
              Responsible for
            </label>
            <input
              id="new-official-duty"
              className="input"
              value={adding.usedFor}
              onChange={(e) => setAdding((a) => a && { ...a, usedFor: e.target.value })}
              placeholder="e.g. Receives invoices and pays suppliers"
              maxLength={160}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-official-name">
              Name
            </label>
            <input
              id="new-official-name"
              className="input"
              value={adding.name}
              onChange={(e) => setAdding((a) => a && { ...a, name: e.target.value })}
              placeholder="e.g. Nakato Sarah"
              maxLength={120}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !adding.label.trim()} className="btn btn-primary">
              {saving ? "Adding…" : "Add official"}
            </button>
            <button type="button" onClick={() => setAdding(null)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

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
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{o.label}</div>
                    {o.usedFor && <p className="mt-0.5 text-xs text-gray-500">{o.usedFor}</p>}
                  </div>
                  {o.custom && canEdit && (
                    <button
                      type="button"
                      onClick={() => removeOfficial(o)}
                      disabled={saving}
                      className="btn btn-ghost btn-sm shrink-0 text-gray-500"
                      aria-label={`Remove ${o.label}`}
                    >
                      <XIcon className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>
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
                  <button type="button" onClick={() => save(officials)} disabled={saving} className="btn btn-primary">
                    {saving ? "Saving…" : "Save officials"}
                  </button>
                  {saved && <span className="text-sm font-medium text-green-700">{saved}</span>}
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
