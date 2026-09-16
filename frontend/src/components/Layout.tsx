import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { roleLabel } from "../lib/permissions";
import { MODULES, MODULE_GROUPS } from "../lib/modules";
import BrandMark from "./BrandMark";
import { useOnline } from "../lib/online";
import { useInstallPrompt } from "../lib/install";
import { DownloadIcon, HomeIcon, KeyIcon, LogoutIcon, MenuIcon, PlusIcon, WifiOffIcon, XIcon } from "./icons";

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const online = useOnline();
  const { available: canInstall, install } = useInstallPrompt();

  // Moving to another page closes the mobile menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch {
      // Logging out has to reach the server; the offline notice already says so.
    }
  }

  const groups = MODULE_GROUPS.map((group) => ({
    group,
    items: MODULES.filter((m) => m.group === group && m.status === "live" && can(...m.permissions)),
  })).filter((g) => g.items.length > 0);

  // The most specific link wins, so /reports/monthly lights "Monthly Report"
  // and /requests/12 lights "Requests".
  const navPaths = [
    "/dashboard",
    "/requests/new",
    ...groups.flatMap((g) => g.items.map((m) => m.to)),
  ];
  const activePath = navPaths
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];

  const sidebar = (
    <div className="flex h-full flex-col bg-green-900">
      <Link to="/dashboard" className="flex h-16 shrink-0 items-center gap-2.5 px-4">
        <BrandMark tone="light" />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold text-white">Kibuli Secondary School</div>
          <div className="truncate text-xs text-green-300">Procurement System</div>
        </div>
      </Link>

      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          <SideLink to="/dashboard" icon={<HomeIcon />} label="Dashboard" active={activePath === "/dashboard"} />
          {can("requests.create") && (
            <SideLink
              to="/requests/new"
              icon={<PlusIcon />}
              label="New request"
              active={activePath === "/requests/new"}
            />
          )}
        </div>

        {groups.map(({ group, items }) => (
          <div key={group}>
            <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-green-300/70">
              {group}
            </div>
            <div className="space-y-0.5">
              {items.map((m) => (
                <SideLink key={m.key} to={m.to} icon={m.icon} label={m.label} active={activePath === m.to} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <Avatar name={user?.name ?? ""} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-white">{user?.name}</div>
            <div className="truncate text-xs text-green-300">
              {roleLabel(user?.role)}
              {user?.department ? ` · ${user.department}` : ""}
            </div>
          </div>
        </div>
        {canInstall && (
          <button
            type="button"
            onClick={install}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
          >
            <DownloadIcon className="h-4 w-4" />
            Install the app
          </button>
        )}
        <div className="mt-2 grid grid-cols-2 gap-1">
          <NavLink
            to="/account"
            className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-green-200 transition hover:bg-white/10 hover:text-white"
          >
            <KeyIcon className="h-3.5 w-3.5" />
            Password
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            disabled={!online}
            title={online ? undefined : "Connect to the internet to log out"}
            className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-green-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-green-200"
          >
            <LogoutIcon className="h-3.5 w-3.5" />
            Log out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-gray-950/50" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            {sidebar}
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-4 rounded-md p-1.5 text-green-200 hover:bg-white/10 hover:text-white"
            >
              <XIcon />
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="-ml-1.5 rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
          >
            <MenuIcon />
          </button>
          <BrandMark size="sm" />
          <span className="truncate text-sm font-semibold text-gray-900">Kibuli Procurement</span>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {!online && (
            <div
              role="status"
              className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <WifiOffIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                <span className="font-semibold">You're offline.</span> The app still opens, but loading and saving
                need the internet. Reconnect to carry on.
              </p>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SideLink({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-white/[0.12] text-white" : "text-green-100/80 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center [&>svg]:h-[18px] [&>svg]:w-[18px] ${
          active ? "text-green-300" : "text-green-300/60 group-hover:text-green-200"
        }`}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function Avatar({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "?";
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-700 text-xs font-semibold text-white ring-2 ring-white/10">
      {initials}
    </span>
  );
}
