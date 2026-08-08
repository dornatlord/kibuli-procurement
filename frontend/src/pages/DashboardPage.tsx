import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { MODULES, MODULE_GROUPS, ProcurementModule } from "../lib/modules";

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

  const myQueue = Object.entries(PERMISSION_QUEUE)
    .filter(([permission]) => can(permission))
    .flatMap(([, statuses]) => statuses);

  useEffect(() => {
    api
      .get<Request[]>("/requests")
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [user]);

  const waitingOnMe = requests.filter((r) => myQueue.includes(r.status)).length;
  const inProgress = requests.filter((r) => r.status.startsWith("pending_")).length;
  const approved = requests.filter((r) => r.status === "approved").length;

  const visible = MODULES.filter((m) => can(...m.permissions));
  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-7 max-w-6xl">
      {/* Greeting */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kibuli Secondary School &mdash; Procurement &amp; Disposal Unit
          </p>
        </div>
        {can("requests.create") && (
          <Link
            to="/requests/new"
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800"
          >
            + New Procurement Request
          </Link>
        )}
      </div>

      {/* At-a-glance */}
      <div className="grid grid-cols-3 gap-4">
        <Stat
          label={myQueue.length ? "Waiting on you" : "Your requests"}
          value={loading ? null : myQueue.length ? waitingOnMe : requests.length}
          tone="amber"
          to="/requests"
        />
        <Stat label="In progress" value={loading ? null : inProgress} tone="blue" to="/requests" />
        <Stat label="Approved" value={loading ? null : approved} tone="green" to="/requests" />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-1">Quick Actions</h2>
        <p className="text-xs text-gray-500 mb-5">
          Everything in the procurement cycle. Tiles marked <SoonPill /> are being
          built next.
        </p>

        <div className="space-y-7">
          {MODULE_GROUPS.map((group) => {
            const tiles = visible.filter((m) => m.group === group);
            if (!tiles.length) return null;
            return (
              <div key={group}>
                <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-3">
                  {group}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3 gap-y-6">
                  {tiles.map((m) => (
                    <Tile key={m.key} module={m} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Tile({ module: m }: { module: ProcurementModule }) {
  const live = m.status === "live";

  const inner = (
    <>
      <div
        className={`relative h-14 w-14 rounded-2xl flex items-center justify-center mb-2 transition ${
          live
            ? "bg-green-50 text-green-700 group-hover:bg-green-100 group-hover:scale-105"
            : "bg-gray-100 text-gray-400"
        }`}
      >
        {m.icon}
        {!live && (
          <span className="absolute -top-1.5 -right-1.5">
            <SoonPill />
          </span>
        )}
      </div>
      <span
        className={`text-xs text-center leading-tight ${
          live ? "text-gray-700 font-medium" : "text-gray-400"
        }`}
      >
        {m.label}
      </span>
    </>
  );

  if (!live) {
    return (
      <div
        className="flex flex-col items-center cursor-not-allowed"
        title={`${m.description} — coming soon`}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={m.to}
      title={m.description}
      className="group flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 rounded-xl"
    >
      {inner}
    </Link>
  );
}

function SoonPill() {
  return (
    <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
      Soon
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
  to,
}: {
  label: string;
  value: number | null;
  tone: "amber" | "green" | "blue";
  to: string;
}) {
  const tones = {
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    green: "bg-green-50 border-green-200 text-green-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
  };
  return (
    <Link
      to={to}
      className={`rounded-xl border p-4 block hover:brightness-[0.98] transition ${tones[tone]}`}
    >
      <div className="text-2xl font-bold tabular-nums">
        {value === null ? "—" : value}
      </div>
      <div className="text-sm mt-1">{label}</div>
    </Link>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
