import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useOfficials } from "../lib/officials";
import { kampalaDay, money } from "../lib/print";
import Combobox from "../components/Combobox";
import PageHeader from "../components/PageHeader";
import { PlusIcon } from "../components/icons";
import { ATTENDEE_LABELS, DECISION_LABELS, suggestResolution } from "../lib/forms/minutesForms";
import type { Attendee, AttendeeStatus, Decision, Meeting, MeetingItem } from "../lib/forms/minutesForms";

interface Template {
  attendees: Attendee[];
  venue: string | null;
  chairName: string | null;
  secretaryName: string | null;
  lastMeetingDate: string | null;
}

interface Pending {
  id: number;
  referenceNumber: string;
  subject: string | null;
  total: string | null;
  recommendedMethod: string | null;
  shortlistedProviders: string | null;
}

/** The minutes as they're edited: text boxes hold strings, never null. */
interface Draft {
  meetingType: "ordinary" | "special";
  meetingDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  attendees: Attendee[];
  opening: string;
  previousMinutes: string;
  mattersArising: string;
  otherBusiness: string;
  nextMeetingDate: string;
  chairName: string;
  secretaryName: string;
  items: Item[];
}
type Item = Omit<MeetingItem, "discussion" | "resolution" | "conditions"> & {
  key: string;
  discussion: string;
  resolution: string;
  conditions: string;
};

let counter = 0;
const nextKey = () => `i${++counter}`;
const toItem = (it: Partial<MeetingItem> & { title: string }): Item => ({
  requestId: null,
  decision: null,
  ...it,
  key: nextKey(),
  discussion: it.discussion ?? "",
  resolution: it.resolution ?? "",
  conditions: it.conditions ?? "",
});

const emptyDraft = (): Draft => ({
  meetingType: "ordinary",
  meetingDate: kampalaDay(new Date().toISOString()),
  startTime: "",
  endTime: "",
  venue: "",
  attendees: [],
  opening: "",
  previousMinutes: "",
  mattersArising: "",
  otherBusiness: "",
  nextMeetingDate: "",
  chairName: "",
  secretaryName: "",
  items: [],
});

const STATUSES = Object.keys(ATTENDEE_LABELS) as AttendeeStatus[];

export default function MinutesEditorPage() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const officials = useOfficials();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(!editing);
  const [pending, setPending] = useState<Pending[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  // Editing: the saved minutes. A new meeting starts from the last one's members and venue.
  useEffect(() => {
    if (editing) {
      api
        .get<Meeting>(`/meetings/${id}`)
        .then((m) => {
          if (m.status === "final") {
            setError("These minutes are final. Ask someone allowed to correct records to reopen them.");
            return;
          }
          setReference(m.referenceNumber);
          setDraft({
            meetingType: m.meetingType,
            meetingDate: m.meetingDate.slice(0, 10),
            startTime: m.startTime ?? "",
            endTime: m.endTime ?? "",
            venue: m.venue ?? "",
            attendees: m.attendees,
            opening: m.opening ?? "",
            previousMinutes: m.previousMinutes ?? "",
            mattersArising: m.mattersArising ?? "",
            otherBusiness: m.otherBusiness ?? "",
            nextMeetingDate: m.nextMeetingDate?.slice(0, 10) ?? "",
            chairName: m.chairName ?? "",
            secretaryName: m.secretaryName ?? "",
            items: m.items.map((it) => toItem(it)),
          });
          setLoaded(true);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Could not load the minutes"));
    } else {
      api
        .get<Template>("/meetings/template")
        .then((t) => {
          // Only what the last meeting had: an empty reply mustn't wipe what Officials already filled in.
          setDraft((d) => ({
            ...d,
            attendees: t.attendees.length ? t.attendees : d.attendees,
            venue: t.venue ?? d.venue,
            chairName: t.chairName ?? d.chairName,
            secretaryName: t.secretaryName ?? d.secretaryName,
          }));
        })
        .catch(() => {});
    }
    api.get<Pending[]>("/meetings/pending-requests").then(setPending).catch(() => setPending([]));
  }, [id]);

  // A first meeting has no earlier one to copy: start from the school's officials.
  useEffect(() => {
    if (editing || draft.attendees.length || Object.keys(officials).length === 0) return;
    const rows: Attendee[] = [];
    const add = (key: string, status: AttendeeStatus, fallbackTitle: string) => {
      const o = officials[key];
      if (o?.name) rows.push({ name: o.name, title: o.title || fallbackTitle, status });
    };
    add("committee_chairperson", "present", "Chairperson, Contracts Committee");
    add("committee_secretary", "present", "Secretary, Contracts Committee");
    add("pdu_head", "in_attendance", "Head, Procurement and Disposal Unit");
    if (rows.length) setDraft((d) => (d.attendees.length ? d : { ...d, attendees: rows, chairName: d.chairName || officials.committee_chairperson?.name || "", secretaryName: d.secretaryName || officials.committee_secretary?.name || "" }));
  }, [officials, editing]);

  const names = useMemo(() => [...new Set(draft.attendees.filter((a) => a.status !== "absent").map((a) => a.name).filter(Boolean))], [draft.attendees]);
  const onAgenda = new Set(draft.items.map((i) => i.requestId).filter(Boolean));
  const waiting = pending.filter((p) => !onAgenda.has(p.id));

  const setAttendee = (i: number, patch: Partial<Attendee>) =>
    set({ attendees: draft.attendees.map((a, n) => (n === i ? { ...a, ...patch } : a)) });
  const setItem = (key: string, patch: Partial<Item>) =>
    set({ items: draft.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) });
  const move = (i: number, by: number) => {
    const items = [...draft.items];
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    set({ items });
  };

  function addRequest(p: Pending) {
    set({
      items: [
        ...draft.items,
        toItem({
          requestId: p.id,
          title: p.subject || p.referenceNumber,
          referenceNumber: p.referenceNumber,
          requestSubject: p.subject,
          total: p.total,
          recommendedMethod: p.recommendedMethod,
          shortlistedProviders: p.shortlistedProviders,
        }),
      ],
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!draft.meetingDate) return setError("Enter the date of the meeting.");
    if (draft.attendees.some((a) => !a.name.trim())) return setError("Every attendee needs a name.");
    if (draft.items.some((it) => !it.title.trim())) return setError("Every matter needs a title.");
    setSaving(true);
    try {
      const body = {
        ...draft,
        items: draft.items.map(({ key, referenceNumber, requestSubject, total, requestStatus, recommendedMethod, shortlistedProviders, ...it }) => it),
      };
      const saved = editing
        ? await api.put<{ ok: true }>(`/meetings/${id}`, body).then(() => ({ id: Number(id) }))
        : await api.post<{ id: number }>("/meetings", body);
      navigate(`/minutes/${saved.id}`, { state: { saved: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the minutes");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-center text-sm text-gray-500">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div> : "Loading the minutes…"}
      </div>
    );
  }

  const heading = "bg-green-800 px-4 py-2 text-sm font-semibold text-white";

  return (
    <form onSubmit={save} className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={editing ? `Edit minutes ${reference}` : "New committee meeting"}
        subtitle="Saved as a draft you can keep editing. Finalise the minutes when they're complete."
      />
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="card overflow-hidden">
        <div className={heading}>THE MEETING</div>
        <div className="grid gap-4 p-4 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="m-type">Type</label>
            <select id="m-type" className="input" value={draft.meetingType} onChange={(e) => set({ meetingType: e.target.value as Draft["meetingType"] })}>
              <option value="ordinary">Ordinary</option>
              <option value="special">Special</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="m-date">Date *</label>
            <input id="m-date" type="date" className="input" required value={draft.meetingDate} onChange={(e) => set({ meetingDate: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="m-start">Started</label>
            <input id="m-start" type="time" className="input" value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="m-end">Ended</label>
            <input id="m-end" type="time" className="input" value={draft.endTime} onChange={(e) => set({ endTime: e.target.value })} />
          </div>
          <div className="sm:col-span-4">
            <label className="label" htmlFor="m-venue">Venue</label>
            <input id="m-venue" className="input" value={draft.venue} onChange={(e) => set({ venue: e.target.value })} placeholder="e.g. The school boardroom" />
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className={heading}>WHO WAS THERE</div>
        <div className="space-y-3 p-4">
          {draft.attendees.length === 0 && <p className="text-sm text-gray-500">Add the committee's members, and anyone else who attended.</p>}
          {draft.attendees.map((a, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1.4fr_1.4fr_10rem_auto]">
              <input aria-label="Name" className="input" placeholder="Name" value={a.name} onChange={(e) => setAttendee(i, { name: e.target.value })} />
              <input aria-label="Title" className="input" placeholder="Title, e.g. Member" value={a.title} onChange={(e) => setAttendee(i, { title: e.target.value })} />
              <select aria-label="Status" className="input" value={a.status} onChange={(e) => setAttendee(i, { status: e.target.value as AttendeeStatus })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{ATTENDEE_LABELS[s]}</option>
                ))}
              </select>
              <button type="button" className="text-sm text-red-500 hover:text-red-700" onClick={() => set({ attendees: draft.attendees.filter((_, n) => n !== i) })} aria-label={`Remove ${a.name || "attendee"}`}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="text-sm font-medium text-green-700 hover:text-green-900" onClick={() => set({ attendees: [...draft.attendees, { name: "", title: "", status: "present" }] })}>
            + Add a person
          </button>
          <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="m-chair">Chairperson (signs the minutes) *</label>
              <Combobox id="m-chair" value={draft.chairName} onChange={(v) => set({ chairName: v })} options={names} />
            </div>
            <div>
              <label className="label" htmlFor="m-sec">Secretary (signs the minutes) *</label>
              <Combobox id="m-sec" value={draft.secretaryName} onChange={(v) => set({ secretaryName: v })} options={names} />
            </div>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className={heading}>OPENING AND THE LAST MINUTES</div>
        <div className="grid gap-4 p-4">
          <div>
            <label className="label" htmlFor="m-open">Call to order and opening</label>
            <textarea id="m-open" className="input" rows={2} value={draft.opening} onChange={(e) => set({ opening: e.target.value })} placeholder="e.g. The chairperson called the meeting to order at 10:00 AM. The secretary led the opening prayer." />
          </div>
          <div>
            <label className="label" htmlFor="m-prev">Confirmation of the previous minutes</label>
            <textarea id="m-prev" className="input" rows={2} value={draft.previousMinutes} onChange={(e) => set({ previousMinutes: e.target.value })} placeholder="e.g. The minutes of the last meeting were read and confirmed as a true record. Proposed by …, seconded by …" />
          </div>
          <div>
            <label className="label" htmlFor="m-arising">Matters arising</label>
            <textarea id="m-arising" className="input" rows={2} value={draft.mattersArising} onChange={(e) => set({ mattersArising: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className={heading}>MATTERS BEFORE THE COMMITTEE</div>
        <div className="space-y-4 p-4">
          {draft.items.length === 0 && <p className="text-sm text-gray-500">Add the requests the committee considered, or any other matter.</p>}
          {draft.items.map((it, i) => (
            <div key={it.key} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Matter {i + 1}</p>
                <div className="flex items-center gap-1 text-sm">
                  <button type="button" className="rounded px-2 py-0.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                  <button type="button" className="rounded px-2 py-0.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30" disabled={i === draft.items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                  <button type="button" className="rounded px-2 py-0.5 text-red-500 hover:bg-red-50" onClick={() => set({ items: draft.items.filter((x) => x.key !== it.key) })}>Remove</button>
                </div>
              </div>
              <input aria-label="Title of the matter" className="input mt-1 font-medium" value={it.title} onChange={(e) => setItem(it.key, { title: e.target.value })} placeholder="What was considered" />
              {it.requestId && (
                <p className="mt-2 text-xs text-gray-600">
                  <Link to={`/requests/${it.requestId}`} className="font-mono text-green-700 hover:underline">{it.referenceNumber}</Link>
                  {it.total ? ` · UGX ${money(it.total)}` : ""}
                  {it.recommendedMethod ? ` · method recommended: ${it.recommendedMethod}` : ""}
                  {it.shortlistedProviders ? ` · shortlisted: ${it.shortlistedProviders.replace(/\n/g, "; ")}` : ""}
                </p>
              )}
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="label" htmlFor={`d-${it.key}`}>Discussion</label>
                  <textarea id={`d-${it.key}`} className="input" rows={3} value={it.discussion} onChange={(e) => setItem(it.key, { discussion: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
                  <div>
                    <label className="label" htmlFor={`dec-${it.key}`}>Decision</label>
                    <select
                      id={`dec-${it.key}`}
                      className="input"
                      value={it.decision ?? ""}
                      onChange={(e) => {
                        const decision = (e.target.value || null) as Decision | null;
                        // A resolution nobody has typed yet starts from the decision.
                        const untouched = !it.resolution.trim() || it.resolution.startsWith("RESOLVED that");
                        setItem(it.key, { decision, ...(untouched ? { resolution: suggestResolution(it, decision) } : {}) });
                      }}
                    >
                      <option value="">— Decision —</option>
                      {(Object.keys(DECISION_LABELS) as Decision[]).map((d) => (
                        <option key={d} value={d}>{DECISION_LABELS[d]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`res-${it.key}`}>Resolution</label>
                    <textarea id={`res-${it.key}`} className="input" rows={2} value={it.resolution} onChange={(e) => setItem(it.key, { resolution: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor={`cond-${it.key}`}>Conditions</label>
                  <textarea id={`cond-${it.key}`} className="input" rows={2} value={it.conditions} onChange={(e) => setItem(it.key, { conditions: e.target.value })} placeholder="Anything the approval depends on (optional)" />
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            {waiting.length > 0 && (
              <select
                aria-label="Add a request waiting on the committee"
                className="input w-auto max-w-full"
                value=""
                onChange={(e) => {
                  const p = waiting.find((x) => x.id === Number(e.target.value));
                  if (p) addRequest(p);
                }}
              >
                <option value="">+ Add a request waiting on the committee ({waiting.length})</option>
                {waiting.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.referenceNumber} — {p.subject}
                    {p.total ? ` (UGX ${money(p.total)})` : ""}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ items: [...draft.items, toItem({ title: "" })] })}>
              <PlusIcon className="h-4 w-4" />
              Another matter
            </button>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className={heading}>CLOSING</div>
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="label" htmlFor="m-aob">Any other business</label>
            <textarea id="m-aob" className="input" rows={2} value={draft.otherBusiness} onChange={(e) => set({ otherBusiness: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="m-next">Next meeting</label>
            <input id="m-next" type="date" className="input" value={draft.nextMeetingDate} onChange={(e) => set({ nextMeetingDate: e.target.value })} />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => navigate(editing ? `/minutes/${id}` : "/minutes")}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn btn-primary px-6">
          {saving ? "Saving…" : "Save draft"}
        </button>
      </div>
    </form>
  );
}
