import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { longDate, when } from "../lib/dates";
import { PERMISSION_GROUPS, ROLE_DESCRIPTIONS, roleBadgeClass, type Role } from "../lib/permissions";
import Badge from "../components/Badge";
import PageHeader from "../components/PageHeader";
import { ListSkeleton, PageLoading } from "../components/Loading";
import { CheckIcon, ChevronRightIcon, DocumentIcon, KeyIcon, MonitorIcon, ShieldIcon } from "../components/icons";

interface Profile {
  id: number;
  email: string;
  name: string;
  role: string;
  roleLabel: string;
  department: string | null;
  mustChangePassword: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  permissions: string[];
  activity: { requestsRaised: number; requestSteps: number; lposPrepared: number; actionsRecorded: number };
  recent: {
    id: number;
    action: string;
    entityType: string;
    entityId: number | null;
    details: Record<string, unknown> | null;
    createdAt: string;
  }[];
}

interface Device {
  current: boolean;
  device: string;
  signedInAt: string | null;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Profile>("/auth/profile")
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your profile"));
  }, []);

  if (error && !profile) {
    return (
      <div className="card mx-auto max-w-md px-6 py-12 text-center text-sm text-gray-600">{error}</div>
    );
  }
  if (!profile) return <PageLoading label="Loading your profile…" />;

  const isAdmin = profile.role === "administrator";
  const held = new Set(profile.permissions);
  const groups = PERMISSION_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(([permission]) => isAdmin || held.has(permission)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your profile"
        subtitle="Your account, what your role lets you do, and where you're signed in."
      />

      {/* Who you are */}
      <section className="card overflow-hidden">
        <div
          aria-hidden="true"
          className="h-24 bg-green-900"
          style={{
            backgroundImage:
              "radial-gradient(circle at 85% 0%, rgb(22 163 74 / 0.45), transparent 50%), radial-gradient(rgb(255 255 255 / 0.08) 1px, transparent 1px)",
            backgroundSize: "auto, 20px 20px",
          }}
        />
        <div className="px-6 pb-6">
          {/* Only the initials overlap the banner; the name sits below it. */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <span className="-mt-10 grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-green-700 text-2xl font-semibold text-white shadow-sm ring-4 ring-white">
                {initials(profile.name)}
              </span>
              <div className="min-w-0 pt-3">
                <h2 className="truncate text-xl font-semibold text-gray-900">{profile.name}</h2>
                <p className="truncate text-sm text-gray-500">{profile.email}</p>
              </div>
            </div>
            <span className={`mt-4 rounded-full border px-2.5 py-1 text-xs font-medium ${roleBadgeClass(profile.role)}`}>
              {profile.roleLabel}
            </span>
          </div>
          <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-gray-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Role" value={profile.roleLabel} />
            <Detail label="Department" value={profile.department || "—"} />
            <Detail label="Member since" value={profile.createdAt ? longDate(profile.createdAt) : "—"} />
            <Detail label="Last signed in" value={profile.lastLoginAt ? capitalise(when(profile.lastLoginAt)) : "—"} />
          </dl>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* What you've done */}
          <Card title="Your activity" subtitle="Everything you do is recorded in the audit trail.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Requests raised" value={profile.activity.requestsRaised} />
              <Stat label="Approvals & submissions" value={profile.activity.requestSteps} />
              <Stat label="LPOs prepared" value={profile.activity.lposPrepared} />
              <Stat label="Actions recorded" value={profile.activity.actionsRecorded} />
            </div>
            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">Recent</h3>
            {profile.recent.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Nothing yet. What you do in the system will show here.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100">
                {profile.recent.map((entry) => {
                  const target = linkFor(entry);
                  const body = (
                    <>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/10">
                        <DocumentIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-gray-900">{describe(entry)}</span>
                        <span className="block text-xs text-gray-500">{capitalise(when(entry.createdAt))}</span>
                      </span>
                      {target && <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-gray-500" />}
                    </>
                  );
                  return (
                    <li key={entry.id}>
                      {target ? (
                        <Link to={target} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-gray-50">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 py-2.5">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* What you may do */}
          <Card
            title="What you can do"
            subtitle={ROLE_DESCRIPTIONS[profile.role as Role] ?? "Your access is set by your role."}
          >
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {groups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.title}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {group.items.map(([permission, label]) => (
                      <li key={permission} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-gray-500">
              Your role is set by the system administrator. Ask them if you need access to something else.
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          <PasswordCard mustChange={profile.mustChangePassword || !!user?.mustChangePassword} />
          <DevicesCard />
          <Card title="Your data" icon={<ShieldIcon className="h-5 w-5" />}>
            <p className="text-sm leading-6 text-gray-600">
              How the school handles your information, and the rules for using the system.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/privacy" className="btn btn-secondary btn-sm justify-between">
                Privacy Policy
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
              <Link to="/terms" className="btn btn-secondary btn-sm justify-between">
                Terms of Use
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PasswordCard({ mustChange }: { mustChange: boolean }) {
  const { refresh } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { currentPassword: current, newPassword: next });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't change your password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Password" icon={<KeyIcon className="h-5 w-5" />}>
      {mustChange && !done && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your password was set by the administrator. Choose your own now.
        </p>
      )}
      {done && (
        <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
          Password changed. Use the new one next time you sign in.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="current-password" className="label">
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label htmlFor="new-password" className="label">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="input"
            required
            minLength={8}
          />
          <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="confirm-password" className="label">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
            required
            minLength={8}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary w-full">
          {saving ? "Saving…" : "Change password"}
        </button>
      </form>
    </Card>
  );
}

function DevicesCard() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");

  function load() {
    api
      .get<Device[]>("/auth/sessions")
      .then((rows) => {
        setDevices(rows);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your devices"));
  }

  useEffect(load, []);

  const others = devices?.filter((d) => !d.current).length ?? 0;

  async function signOutOthers() {
    const which = others === 1 ? "the other device" : `the ${others} other devices`;
    if (!window.confirm(`Sign out of ${which}? Anyone using the app there will have to sign in again.`)) return;
    setWorking(true);
    setNotice("");
    try {
      const { signedOut } = await api.post<{ signedOut: number }>("/auth/sessions/sign-out-others", {});
      setNotice(`Signed out of ${signedOut} other device${signedOut === 1 ? "" : "s"}.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign out the other devices");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card
      title="Where you're signed in"
      icon={<MonitorIcon className="h-5 w-5" />}
      subtitle="Sign-ins last 30 days unless you sign out."
    >
      {notice && (
        <p role="status" className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
          {notice}
        </p>
      )}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {devices === null ? (
        !error && (
          <div className="-mx-4">
            <ListSkeleton rows={2} />
          </div>
        )
      ) : devices.length === 0 ? (
        <p className="text-sm text-gray-500">No sign-ins found.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {devices.map((d, i) => (
            <li key={i} className="flex items-center gap-3 py-3 first:pt-0">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500">
                <MonitorIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
                  {d.device}
                  {d.current && <Badge tone="green" label="This device" />}
                </div>
                <div className="text-xs text-gray-500">
                  {d.signedInAt ? `Signed in ${when(d.signedInAt)}` : "Signed in before devices were recorded"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {others > 0 && (
        <button type="button" onClick={signOutOthers} disabled={working} className="btn btn-secondary btn-sm mt-4 w-full">
          {working ? "Signing out…" : `Sign out of ${others === 1 ? "the other device" : `${others} other devices`}`}
        </button>
      )}
      <p className="mt-4 text-xs leading-5 text-gray-500">
        Lost a laptop, or left the app signed in on a shared computer? Sign out of the other devices, then change your
        password.
      </p>
    </Card>
  );
}

function Card({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        {icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/10">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{value.toLocaleString("en-GB")}</div>
      <div className="mt-0.5 text-xs text-gray-500">{label}</div>
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("") || "?";

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Entry = Profile["recent"][number];

const ACTIONS: Record<string, string> = {
  "request.created": "Raised a request",
  "committee_decision.recorded": "Recorded a Contracts Committee decision",
  "purchase_order.created": "Prepared an LPO",
  "grn.created": "Recorded a delivery",
  "grn.inspected": "Inspected a delivery",
  "invoice.created": "Recorded an invoice",
  "invoice.status_changed": "Updated an invoice",
  "invoice.paid": "Marked an invoice paid",
  "contract.created": "Created a contract",
  "contract.amended": "Amended a contract",
  "contract.status_changed": "Updated a contract",
  "supplier.created": "Added a supplier",
  "supplier.updated": "Updated a supplier",
  "supplier.deactivated": "Deactivated a supplier",
  "supplier.reactivated": "Reactivated a supplier",
  "basket.created": "Saved a basket",
  "basket.updated": "Updated a basket",
  "basket.removed": "Removed a basket",
  "disposal.created": "Recorded a disposal",
  "disposal.updated": "Updated a disposal",
  "disposal.deleted": "Deleted a disposal",
  "asset.created": "Added an asset",
  "asset.updated": "Updated an asset",
  "asset.disposed": "Disposed of an asset",
  "plan_item.created": "Added to the procurement plan",
  "plan_item.updated": "Updated the procurement plan",
  "termly_report.saved": "Saved a termly PPDA return",
  "settings.terms_updated": "Changed the school terms",
  "user.created": "Added a user",
  "user.updated": "Updated a user",
  "user.deactivated": "Deactivated a user",
  "user.reactivated": "Reactivated a user",
  "user.password_changed": "Changed your password",
  "user.signed_out_other_devices": "Signed out of other devices",
};

const REQUEST_MOVES: Record<string, string> = {
  pending_hod: "Submitted a request for approval",
  pending_accounting_officer: "Approved a request as Head of Department",
  pending_contracts_committee: "Approved a request as Accounting Officer",
  approved: "Approved a request",
  rejected: "Rejected a request",
  draft: "Returned a request to draft",
};

const LPO_MOVES: Record<string, string> = {
  issued: "Issued an LPO",
  acknowledged: "Marked an LPO acknowledged",
  completed: "Completed an LPO",
  cancelled: "Cancelled an LPO",
};

/** "Approved a request · KSS/SUPLS/26/017/00015" */
function describe(entry: Entry) {
  const d = entry.details ?? {};
  const to = typeof d.to === "string" ? d.to : "";
  const what =
    entry.action === "request.status_changed"
      ? REQUEST_MOVES[to] ?? "Updated a request"
      : entry.action === "purchase_order.status_changed"
      ? LPO_MOVES[to] ?? "Updated an LPO"
      : ACTIONS[entry.action] ?? capitalise(entry.action.replace(/[._]/g, " "));
  const ref =
    d.referenceNumber ??
    (d.poNumber ? `LPO ${d.poNumber}` : null) ??
    d.grnNumber ??
    d.invoiceNumber ??
    d.contractNumber ??
    d.name ??
    d.subject ??
    (d.term && d.year ? `Term ${d.term}, ${d.year}` : null);
  return ref ? `${what} · ${String(ref)}` : what;
}

function linkFor(entry: Entry): string | null {
  const id = entry.entityId;
  const gone = /\.(removed|deleted)$/.test(entry.action);
  switch (entry.entityType) {
    case "procurement_request":
      return id ? `/requests/${id}` : null;
    case "purchase_order":
      return id ? `/purchase-orders/${id}` : null;
    case "contract":
      return id ? `/contracts/${id}` : null;
    case "goods_received_note":
      return id ? `/goods-received/${id}` : null;
    case "item_basket":
      return id && !gone ? `/baskets/${id}` : "/baskets";
    case "supplier":
      return "/suppliers";
    case "invoice":
      return "/invoices";
    case "disposal":
      return "/disposals";
    case "asset":
      return "/inventory";
    case "procurement_plan_item":
      return "/plan";
    case "termly_report":
      return "/reports/termly";
    default:
      return null;
  }
}
