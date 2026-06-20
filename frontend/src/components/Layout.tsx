import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const isAdmin = user?.role === "accounting_officer" || user?.role === "head_of_dept";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-green-800 text-white px-6 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">Kibuli SS</span>
          <span className="text-green-300 text-sm">Procurement System</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-200">{user?.name}</span>
          <span className="bg-green-700 px-2 py-0.5 rounded text-xs capitalize">
            {user?.role?.replace(/_/g, " ")}
          </span>
          <button onClick={handleLogout} className="underline text-green-300 hover:text-white">
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-52 bg-white border-r border-gray-200 py-4 flex flex-col gap-1 px-2">
          <NavItem to="/dashboard">Dashboard</NavItem>
          <NavItem to="/requests">All Requests</NavItem>
          <NavItem to="/requests/new">+ New Request</NavItem>
          {isAdmin && (
            <>
              <div className="mt-4 px-2 text-xs text-gray-400 uppercase font-semibold">Admin</div>
              <NavItem to="/admin/budget">Budget Amounts</NavItem>
              {user?.role === "accounting_officer" && (
                <NavItem to="/admin/users">Users</NavItem>
              )}
            </>
          )}
        </nav>
        <main className="flex-1 p-6 overflow-auto">
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
