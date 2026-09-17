import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useOnline } from "../lib/online";
import { discardQueued, onOutboxChange, queuedRequests, sendQueued } from "../lib/outbox";
import type { QueuedRequest } from "../lib/outbox";
import Badge from "../components/Badge";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { CheckCircleIcon, ChevronRightIcon, InboxIcon, PlusIcon, SearchIcon } from "../components/icons";

interface Request {
  id: number;
  referenceNumber: string;
  subjectOfProcurement: string;
  status: string;
  category: string;
  budgetCategory: string;
  year: number;
  weekNumber: number;
  estimatedTotalCost: string;
  createdAt: string;
}

export default function RequestsListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can, user } = useAuth();
  const online = useOnline();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [queued, setQueued] = useState<QueuedRequest[]>(() => (user ? queuedRequests(user.id) : []));
  const [sending, setSending] = useState(false);
  const justQueued = (location.state as { queued?: string } | null)?.queued;

  function loadRequests() {
    api
      .get<Request[]>("/requests")
      .then((rows) => {
        setRequests(rows);
        setLoadError("");
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load requests"))
      .finally(() => setLoading(false));
  }

  useEffect(loadRequests, []);

  // Requests waiting on this computer; reload the list once one has been sent.
  useEffect(() => {
    if (!user) return;
    let waiting = queuedRequests(user.id).length;
    return onOutboxChange(() => {
      const now = queuedRequests(user.id);
      setQueued(now);
      if (now.length < waiting) loadRequests();
      waiting = now.length;
    });
  }, [user?.id]);

  async function sendNow() {
    if (!user) return;
    setSending(true);
    await sendQueued(user.id);
    setSending(false);
  }

  function discard(q: QueuedRequest) {
    if (!user) return;
    if (!window.confirm(`Remove “${q.summary.subject}”? It hasn't been sent, so it will be lost.`)) return;
    discardQueued(user.id, q.clientRef);
  }

  const q = query.trim().toLowerCase();
  const filtered = requests.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterCategory && r.category !== filterCategory) return false;
    if (filterYear && String(r.year) !== filterYear) return false;
    if (
      q &&
      !r.referenceNumber.toLowerCase().includes(q) &&
      !(r.subjectOfProcurement ?? "").toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });
  const filtering = !!(q || filterStatus || filterCategory || filterYear);

  function clearFilters() {
    setQuery("");
    setFilterStatus("");
    setFilterCategory("");
    setFilterYear("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement requests"
        subtitle="Every TFORM 5 request you can see, newest first."
        actions={
          can("requests.create") && (
            <Link to="/requests/new" className="btn btn-primary">
              <PlusIcon className="h-4 w-4" />
              New request
            </Link>
          )
        }
      />

      {justQueued && queued.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
        >
          <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <span className="font-semibold">“{justQueued}” is saved on this computer.</span> It will be sent
            automatically when you're back online, and get its reference number then.
          </p>
        </div>
      )}

      {queued.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Waiting to send</h2>
              <p className="text-xs text-gray-500">
                Filled in without internet. They go to the server when this computer is back online, as drafts.
              </p>
            </div>
            {online && (
              <button type="button" onClick={sendNow} disabled={sending} className="btn btn-secondary btn-sm">
                {sending ? "Sending…" : "Send now"}
              </button>
            )}
          </div>
          <ul className="divide-y divide-gray-100">
            {queued.map((item) => (
              <li key={item.clientRef} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{item.summary.subject}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    <span className="capitalize">{item.summary.procurementSize}</span> ·{" "}
                    {item.summary.itemCount} item{item.summary.itemCount === 1 ? "" : "s"}
                    {item.summary.total ? ` · UGX ${item.summary.total.toLocaleString("en-UG")}` : ""} · filled in{" "}
                    {new Date(item.queuedAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {item.error && <div className="mt-1 text-xs text-red-700">Couldn't send: {item.error}</div>}
                </div>
                <Badge
                  tone={item.error ? "red" : online ? "blue" : "amber"}
                  label={item.error ? "Needs attention" : online ? "Sending" : "Waiting for internet"}
                />
                <button type="button" onClick={() => discard(item)} className="btn btn-ghost btn-sm self-start sm:self-auto">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by reference or subject"
              className="input pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:flex">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input md:w-44">
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_hod">Pending HoD</option>
              <option value="pending_accounting_officer">Pending AO</option>
              <option value="pending_contracts_committee">Pending Committee</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="input md:w-44"
            >
              <option value="">All categories</option>
              <option value="supplies">Supplies</option>
              <option value="works">Works</option>
              <option value="non_consultancy">Non-consultancy</option>
            </select>
            <input
              type="number"
              placeholder="Year"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="input col-span-2 sm:col-span-1 md:w-24"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : loadError ? (
          <div className="px-6 py-16 text-center text-sm text-gray-500">{loadError}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 text-gray-400">
              <InboxIcon className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-medium text-gray-900">
              {filtering ? "No requests match these filters" : "No requests yet"}
            </p>
            {filtering ? (
              <button type="button" onClick={clearFilters} className="btn btn-secondary btn-sm mt-4">
                Clear filters
              </button>
            ) : (
              can("requests.create") && (
                <Link to="/requests/new" className="btn btn-primary btn-sm mt-4">
                  <PlusIcon className="h-3.5 w-3.5" />
                  Raise the first request
                </Link>
              )
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Request</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Est. cost (UGX)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="w-10 px-4 py-3">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/requests/${r.id}`)}
                      className="group cursor-pointer transition hover:bg-gray-50"
                    >
                      <td className="max-w-md px-4 py-3">
                        <Link
                          to={`/requests/${r.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate font-medium text-gray-900 group-hover:text-green-800"
                        >
                          {r.subjectOfProcurement || "Untitled request"}
                        </Link>
                        <div className="mt-0.5 font-mono text-xs text-gray-500">{r.referenceNumber}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="capitalize text-gray-700">{r.category?.replace("_", "-")}</div>
                        <div className="text-xs capitalize text-gray-400">{r.budgetCategory}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-900">
                        {r.estimatedTotalCost ? Number(r.estimatedTotalCost).toLocaleString("en-UG") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                        {new Date(r.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-300 group-hover:text-gray-500">
                        <ChevronRightIcon className="h-4 w-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
              Showing {filtered.length} of {requests.length} request{requests.length === 1 ? "" : "s"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
