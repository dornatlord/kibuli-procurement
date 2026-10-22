import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import PageHeader from "../components/PageHeader";
import Badge from "../components/Badge";
import { ChevronLeftIcon, PrinterIcon, SpinnerIcon } from "../components/icons";
import { money } from "../lib/print";
import { ATTENDEE_LABELS, DECISION_LABELS, clock, longDate, printMinutes } from "../lib/forms/minutesForms";
import type { AttendeeStatus, Decision, Meeting } from "../lib/forms/minutesForms";

const DECISION_TONE: Record<Decision, "green" | "red" | "amber" | "gray"> = {
  approved: "green",
  rejected: "red",
  deferred: "amber",
  noted: "gray",
};

const GROUPS: AttendeeStatus[] = ["present", "apology", "absent", "in_attendance"];

/** A paragraph of typed text, keeping its line breaks. */
const Text = ({ children }: { children: string | null }) =>
  children ? <p className="whitespace-pre-line text-sm leading-6 text-gray-800">{children}</p> : null;

export default function MinutesDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const saved = !!(useLocation().state as { saved?: boolean } | null)?.saved;
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");

  function load() {
    return api
      .get<Meeting>(`/meetings/${id}`)
      .then(setMeeting)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the minutes"))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
  }, [id]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <SpinnerIcon className="h-6 w-6 text-green-700" />
      </div>
    );
  if (!meeting)
    return (
      <div className="card mx-auto max-w-md px-6 py-12 text-center">
        <p className="text-sm font-medium text-gray-900">{error || "Minutes not found"}</p>
        <Link to="/minutes" className="btn btn-secondary btn-sm mt-4">
          Back to the minutes
        </Link>
      </div>
    );

  const m = meeting;
  const manage = can("meetings.manage");
  const draft = m.status === "draft";
  const section = "border-b border-gray-200 px-5 py-3.5 text-sm font-semibold text-gray-900";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to="/minutes" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900">
          <ChevronLeftIcon className="h-4 w-4" />
          Committee minutes
        </Link>
        <div className="mt-3">
          <PageHeader
            title={
              <span className="flex flex-wrap items-center gap-3">
                {m.meetingType === "special" ? "Special" : "Ordinary"} meeting
                <Badge tone={draft ? "amber" : "green"} label={draft ? "Draft" : "Final"} />
              </span>
            }
            subtitle={
              <>
                <span className="font-mono">{m.referenceNumber}</span> · {longDate(m.meetingDate)}
                {m.venue ? ` · ${m.venue}` : ""}
                {m.startTime ? ` · ${clock(m.startTime)}${m.endTime ? ` to ${clock(m.endTime)}` : ""}` : ""}
              </>
            }
            actions={
              <>
                <button type="button" className="btn btn-secondary" onClick={() => printMinutes(m)}>
                  <PrinterIcon className="h-4 w-4" />
                  Print
                </button>
                {manage && draft && (
                  <Link to={`/minutes/${m.id}/edit`} className="btn btn-secondary">
                    Edit
                  </Link>
                )}
                {manage && draft && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => act(() => api.post(`/meetings/${m.id}/finalize`, {}))}
                  >
                    Finalise minutes
                  </button>
                )}
                {!draft && can("records.correct") && !reopening && (
                  <button type="button" className="btn btn-secondary" onClick={() => setReopening(true)}>
                    Reopen
                  </button>
                )}
              </>
            }
          />
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saved && !error && (
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Saved. {draft ? "Keep editing until the minutes are right, then finalise them." : ""}
        </p>
      )}
      {!draft && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Final
          {m.finalizedAt ? ` since ${new Date(m.finalizedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}
          {m.finalizedByName ? `, finalised by ${m.finalizedByName}` : ""}. These minutes are locked.
        </p>
      )}
      {reopening && (
        <div className="card space-y-3 p-4">
          <label className="label" htmlFor="reopen-reason">Why are these minutes being reopened? *</label>
          <textarea id="reopen-reason" className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || reason.trim().length < 3}
              onClick={() =>
                act(async () => {
                  await api.post(`/meetings/${m.id}/reopen`, { reason });
                  setReopening(false);
                  setReason("");
                })
              }
            >
              Reopen the minutes
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReopening(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <section className="card overflow-hidden">
        <h2 className={section}>Attendance</h2>
        <div className="grid gap-px bg-gray-100 sm:grid-cols-2">
          {GROUPS.map((g) => {
            const rows = m.attendees.filter((a) => a.status === g);
            return (
              <div key={g} className="bg-white px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{ATTENDEE_LABELS[g]}</p>
                {rows.length === 0 ? (
                  <p className="mt-1 text-sm text-gray-400">—</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-sm text-gray-900">
                    {rows.map((a, i) => (
                      <li key={i}>
                        {a.name}
                        {a.title && <span className="text-gray-500"> · {a.title}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {(m.opening || m.previousMinutes || m.mattersArising) && (
        <section className="card overflow-hidden">
          <h2 className={section}>Opening and the last minutes</h2>
          <div className="space-y-4 p-5">
            {m.opening && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Call to order and opening</p><Text>{m.opening}</Text></div>}
            {m.previousMinutes && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Previous minutes</p><Text>{m.previousMinutes}</Text></div>}
            {m.mattersArising && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Matters arising</p><Text>{m.mattersArising}</Text></div>}
          </div>
        </section>
      )}

      <section className="card overflow-hidden">
        <h2 className={section}>Matters before the committee</h2>
        {m.items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">No matters were recorded.</p>
        ) : (
          <ol className="divide-y divide-gray-100">
            {m.items.map((it, i) => (
              <li key={it.id ?? i} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {i + 1}. {it.title}
                  </span>
                  {it.decision && <Badge tone={DECISION_TONE[it.decision]} label={DECISION_LABELS[it.decision]} />}
                </div>
                {it.requestId && (
                  <p className="text-xs text-gray-600">
                    <Link to={`/requests/${it.requestId}`} className="font-mono text-green-700 hover:underline">
                      {it.referenceNumber}
                    </Link>
                    {it.total ? ` · UGX ${money(it.total)}` : ""}
                    {it.recommendedMethod ? ` · method recommended: ${it.recommendedMethod}` : ""}
                  </p>
                )}
                <Text>{it.discussion}</Text>
                {it.resolution && <p className="whitespace-pre-line text-sm font-medium leading-6 text-gray-900">{it.resolution}</p>}
                {it.conditions && <p className="whitespace-pre-line text-sm leading-6 text-gray-700"><i>Conditions:</i> {it.conditions}</p>}
                {it.requestId && it.requestStatus === "pending_contracts_committee" && it.decision && (
                  <p className="text-xs text-amber-700">
                    The request is still waiting for its approval.{" "}
                    <Link to={`/requests/${it.requestId}`} className="font-medium underline">
                      Record the decision on the request
                    </Link>
                    .
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {(m.otherBusiness || m.nextMeetingDate) && (
        <section className="card overflow-hidden">
          <h2 className={section}>Closing</h2>
          <div className="space-y-3 p-5">
            {m.otherBusiness && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Any other business</p><Text>{m.otherBusiness}</Text></div>}
            {m.nextMeetingDate && <p className="text-sm text-gray-800">Next meeting: <b>{longDate(m.nextMeetingDate)}</b></p>}
          </div>
        </section>
      )}

      <section className="card grid gap-px overflow-hidden bg-gray-100 sm:grid-cols-2">
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Chairperson</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{m.chairName || "—"}</p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Secretary</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{m.secretaryName || "—"}</p>
        </div>
      </section>

      {manage && draft && (
        <div className="flex justify-end">
          <button
            type="button"
            className="text-sm text-red-600 hover:underline"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Delete the draft minutes ${m.referenceNumber}? This can't be undone.`)) return;
              setBusy(true);
              api
                .delete(`/meetings/${m.id}`)
                .then(() => navigate("/minutes"))
                .catch((e) => {
                  setError(e instanceof Error ? e.message : "Could not delete the draft");
                  setBusy(false);
                });
            }}
          >
            Delete this draft
          </button>
        </div>
      )}
    </div>
  );
}
