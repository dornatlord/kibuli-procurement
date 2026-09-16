import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { MODULES, MODULE_GROUPS, ProcurementModule } from "../lib/modules";
import PageHeader from "../components/PageHeader";
import {
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  ProgressIcon,
} from "../components/icons";

interface Request {
  id: number;
  referenceNumber: string;
  subjectOfProcurement: string;
  status: string;
  category: string;
  estimatedTotalCost: string;
  createdAt: string;
}

/**
 * Which statuses each permission puts on your plate. A user sees the union of
 * the buckets for every approval permission they hold.
 */
const PERMISSION_QUEUE: Record<string, string[]> = {
  "requests.submit": ["draft"],
  "requests.approve.hod": ["pending_hod"],
  "requests.approve.accounting_officer": ["pending_accounting_officer"],
  "requests.approve.committee": ["pending_contracts_committee"],
};

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  // Offline or unreachable: show a dash rather than a zero that looks like "nothing waiting".
  const [failed, setFailed] = useState(false);

  const myQueue = Object.entries(PERMISSION_QUEUE)
    .filter(([permission]) => can(permission))
    .flatMap(([, statuses]) => statuses);

  useEffect(() => {
    api
      .get<Request[]>("/requests")
      .then((rows) => {
        setRequests(rows);
        setFailed(false);
      })
      .catch(() => {
        setRequests([]);
        setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const waitingOnMe = requests.filter((r) => myQueue.includes(r.status)).length;
  const inProgress = requests.filter((r) => r.status.startsWith("pending_")).length;
  const approved = requests.filter((r) => r.status === "approved").length;

  const visible = MODULES.filter((m) => can(...m.permissions));
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}${user?.name ? `, ${user.name}` : ""}`}
        subtitle={today}
        actions={
          can("requests.create") && (
            <Link to="/requests/new" className="btn btn-primary">
              <PlusIcon className="h-4 w-4" />
              New request
            </Link>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={myQueue.length ? "Waiting on you" : "Your requests"}
          hint={myQueue.length ? "At a step you approve" : "Raised so far"}
          value={loading ? null : failed ? "—" : myQueue.length ? waitingOnMe : requests.length}
          tone="amber"
          icon={<ClockIcon />}
          to="/requests"
        />
        <StatCard
          label="In progress"
          hint="Moving through approvals"
          value={loading ? null : failed ? "—" : inProgress}
          tone="blue"
          icon={<ProgressIcon />}
          to="/requests"
        />
        <StatCard
          label="Approved"
          hint="Ready to order"
          value={loading ? null : failed ? "—" : approved}
          tone="green"
          icon={<CheckCircleIcon />}
          to="/requests"
        />
      </div>

      <section className="card">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Quick actions</h2>
          <p className="text-sm text-gray-500">Everything in the procurement cycle, end to end.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {MODULE_GROUPS.map((group) => {
            const tiles = visible.filter((m) => m.group === group);
            if (!tiles.length) return null;
            return (
              <div
                key={group}
                className="grid gap-2 px-5 py-4 lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-center"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{group}</div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {tiles.map((m) => (
                    <Tile key={m.key} module={m} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Tile({ module: m }: { module: ProcurementModule }) {
  const live = m.status === "live";
  const inner = (
    <>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition [&>svg]:h-5 [&>svg]:w-5 ${
          live
            ? "bg-green-50 text-green-700 ring-green-600/10 group-hover:bg-green-100"
            : "bg-gray-50 text-gray-400 ring-gray-500/10"
        }`}
      >
        {m.icon}
      </span>
      <span className={`text-sm font-medium ${live ? "text-gray-700 group-hover:text-gray-900" : "text-gray-400"}`}>
        {m.label}
        {!live && <span className="ml-1.5 text-xs font-normal text-amber-600">Soon</span>}
      </span>
    </>
  );

  if (!live) {
    return (
      <div className="flex cursor-not-allowed items-center gap-3 rounded-lg p-2" title={`${m.description} — coming soon`}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={m.to}
      title={m.description}
      className="group flex items-center gap-3 rounded-lg p-2 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
    >
      {inner}
    </Link>
  );
}

function StatCard({
  label,
  hint,
  value,
  tone,
  icon,
  to,
}: {
  label: string;
  hint: string;
  value: number | string | null;
  tone: "amber" | "green" | "blue";
  icon: ReactNode;
  to: string;
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-600 ring-amber-600/15",
    blue: "bg-blue-50 text-blue-600 ring-blue-600/15",
    green: "bg-green-50 text-green-700 ring-green-600/15",
  };
  return (
    <Link
      to={to}
      className="card flex items-start justify-between gap-4 p-5 transition hover:border-gray-300 hover:shadow-raised"
    >
      <div>
        <div className="text-sm font-medium text-gray-500">{label}</div>
        <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-gray-900">
          {value === null ? <span className="inline-block h-8 w-10 animate-pulse rounded-md bg-gray-100" /> : value}
        </div>
        <div className="mt-1 text-xs text-gray-400">{hint}</div>
      </div>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${tones[tone]}`}>
        {icon}
      </span>
    </Link>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
