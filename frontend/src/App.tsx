import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NewRequestPage from "./pages/NewRequestPage";
import RequestDetailPage from "./pages/RequestDetailPage";
import RequestsListPage from "./pages/RequestsListPage";
import BudgetAdminPage from "./pages/BudgetAdminPage";
import ReservePricesPage from "./pages/ReservePricesPage";
import UsersAdminPage from "./pages/UsersAdminPage";
import AccountPage from "./pages/AccountPage";
import Layout from "./components/Layout";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Blocks a route unless the user holds one of the listed permissions. */
function Guard({
  permissions,
  children,
}: {
  permissions: string[];
  children: React.ReactNode;
}) {
  const { can } = useAuth();
  if (!can(...permissions)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  const viewRequests = [
    "requests.view.own",
    "requests.view.department",
    "requests.view.all",
  ];

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="account" element={<AccountPage />} />

        <Route
          path="requests"
          element={
            <Guard permissions={viewRequests}>
              <RequestsListPage />
            </Guard>
          }
        />
        <Route
          path="requests/new"
          element={
            <Guard permissions={["requests.create"]}>
              <NewRequestPage />
            </Guard>
          }
        />
        <Route
          path="requests/:id"
          element={
            <Guard permissions={viewRequests}>
              <RequestDetailPage />
            </Guard>
          }
        />

        <Route
          path="admin/budget"
          element={
            <Guard permissions={["budget.edit"]}>
              <BudgetAdminPage />
            </Guard>
          }
        />
        <Route
          path="reserve-prices"
          element={
            <Guard permissions={["reserve_prices.view"]}>
              <ReservePricesPage />
            </Guard>
          }
        />
        <Route
          path="admin/users"
          element={
            <Guard permissions={["users.view"]}>
              <UsersAdminPage />
            </Guard>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
