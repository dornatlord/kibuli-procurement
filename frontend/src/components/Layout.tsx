import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { roleLabel, roleBadgeClass } from "../lib/permissions";

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const showAdmin = can("budget.edit", "users.view", "system.settings");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-green-800 text-white px-6 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">Kibuli Secondary School</span>
          <span className="text-green-300 text-sm">Procurement System</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right leading-tight">
            <div className="text-green-100">{user?.name}</div>
            {user?.department && (
              <div className="text-green-400 text-xs">{user.department}</div>
            )}
          </div>
          <span
            className={`px-2 py-0.5 rounded text-xs border ${roleBadgeClass(
              user?.role
            )}`}
          >
            {roleLabel(user?.role)}
          </span>
          <button
            onClick={handleLogout}
            className="underline text-green-300 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-56 bg-white border-r border-gray-200 py-4 flex flex-col gap-1 px-2">
          <NavItem to="/dashboard">Dashboard</NavItem>

          {can(
            "requests.view.own",
            "requests.view.department",
            "requests.view.all"
          ) && <NavItem to="/requests">Requests</NavItem>}

          {can("requests.create") && (
            <NavItem to="/requests/new">+ New Request</NavItem>
          )}

          {showAdmin && (
            <>
              <div className="mt-4 px-2 text-xs text-gray-400 uppercase font-semibold">
                Administration
              </div>
              {can("budget.edit") && (
                <NavItem to="/admin/budget">Budget Amounts</NavItem>
              )}
              {can("users.view") && (
                <NavItem to="/admin/users">Users &amp; Roles</NavItem>
              )}
            </>
          )}

          <div className="mt-auto px-2 pt-4">
            <NavLink
              to="/account"
              className="block text-xs text-gray-400 hover:text-gray-700"
            >
              Change password
            </NavLink>
          </div>
        </nav>
        <main className="flex-1 p-6 overflow-auto bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/requests"}
      className={({ isActive }) =>
        `block px-3 py-2 rounded text-sm font-medium transition-colors ${
          isActive
            ? "bg-green-50 text-green-800"
            : "text-gray-700 hover:bg-gray-100"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
