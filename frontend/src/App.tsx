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
import SuppliersPage from "./pages/SuppliersPage";
import PurchaseOrdersListPage from "./pages/PurchaseOrdersListPage";
import NewPurchaseOrderPage from "./pages/NewPurchaseOrderPage";
import PurchaseOrderDetailPage from "./pages/PurchaseOrderDetailPage";
import GoodsReceivedListPage from "./pages/GoodsReceivedListPage";
import NewGoodsReceivedPage from "./pages/NewGoodsReceivedPage";
import GoodsReceivedDetailPage from "./pages/GoodsReceivedDetailPage";
import InvoicesListPage from "./pages/InvoicesListPage";
import NewInvoicePage from "./pages/NewInvoicePage";
import ContractsListPage from "./pages/ContractsListPage";
import NewContractPage from "./pages/NewContractPage";
import ContractDetailPage from "./pages/ContractDetailPage";
import ProcurementPlanPage from "./pages/ProcurementPlanPage";
import InventoryPage from "./pages/InventoryPage";
import AuditTrailPage from "./pages/AuditTrailPage";
import MonthlyReportPage from "./pages/MonthlyReportPage";
import ReportsPage from "./pages/ReportsPage";
import BidsAndTendersPage from "./pages/BidsAndTendersPage";
import BasketsPage from "./pages/BasketsPage";
import BasketEditorPage from "./pages/BasketEditorPage";
import TermlyReportPage from "./pages/TermlyReportPage";
import DisposalsPage from "./pages/DisposalsPage";
import SettingsPage from "./pages/SettingsPage";
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
  const useBaskets = ["requests.create", "reserve_prices.manage"];

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
          path="baskets"
          element={
            <Guard permissions={useBaskets}>
              <BasketsPage />
            </Guard>
          }
        />
        <Route
          path="baskets/:id"
          element={
            <Guard permissions={useBaskets}>
              <BasketEditorPage />
            </Guard>
          }
        />

        <Route
          path="tenders"
          element={
            <Guard permissions={["requests.prepare.committee", "requests.approve.committee", "requests.view.all"]}>
              <BidsAndTendersPage />
            </Guard>
          }
        />

        <Route
          path="suppliers"
          element={
            <Guard permissions={["suppliers.view"]}>
              <SuppliersPage />
            </Guard>
          }
        />

        <Route
          path="purchase-orders"
          element={
            <Guard permissions={["purchase_orders.view"]}>
              <PurchaseOrdersListPage />
            </Guard>
          }
        />
        <Route
          path="purchase-orders/new"
          element={
            <Guard permissions={["purchase_orders.create"]}>
              <NewPurchaseOrderPage />
            </Guard>
          }
        />
        <Route
          path="purchase-orders/:id"
          element={
            <Guard permissions={["purchase_orders.view"]}>
              <PurchaseOrderDetailPage />
            </Guard>
          }
        />

        <Route
          path="goods-received"
          element={
            <Guard permissions={["goods_received.view"]}>
              <GoodsReceivedListPage />
            </Guard>
          }
        />
        <Route
          path="goods-received/new"
          element={
            <Guard permissions={["goods_received.create"]}>
              <NewGoodsReceivedPage />
            </Guard>
          }
        />
        <Route
          path="goods-received/:id"
          element={
            <Guard permissions={["goods_received.view"]}>
              <GoodsReceivedDetailPage />
            </Guard>
          }
        />

        <Route
          path="invoices"
          element={
            <Guard permissions={["invoices.view"]}>
              <InvoicesListPage />
            </Guard>
          }
        />
        <Route
          path="invoices/new"
          element={
            <Guard permissions={["invoices.create"]}>
              <NewInvoicePage />
            </Guard>
          }
        />

        <Route
          path="contracts"
          element={
            <Guard permissions={["contracts.view"]}>
              <ContractsListPage />
            </Guard>
          }
        />
        <Route
          path="contracts/new"
          element={
            <Guard permissions={["contracts.manage"]}>
              <NewContractPage />
            </Guard>
          }
        />
        <Route
          path="contracts/:id"
          element={
            <Guard permissions={["contracts.view"]}>
              <ContractDetailPage />
            </Guard>
          }
        />

        <Route
          path="plan"
          element={
            <Guard permissions={["procurement_plan.view"]}>
              <ProcurementPlanPage />
            </Guard>
          }
        />

        <Route
          path="inventory"
          element={
            <Guard permissions={["inventory.view"]}>
              <InventoryPage />
            </Guard>
          }
        />

        <Route
          path="reports/monthly"
          element={
            <Guard permissions={["reports.view"]}>
              <MonthlyReportPage />
            </Guard>
          }
        />
        <Route
          path="reports/termly"
          element={
            <Guard permissions={["reports.view"]}>
              <TermlyReportPage />
            </Guard>
          }
        />
        <Route
          path="reports"
          element={
            <Guard permissions={["reports.view"]}>
              <ReportsPage />
            </Guard>
          }
        />
        <Route
          path="disposals"
          element={
            <Guard permissions={["disposals.view"]}>
              <DisposalsPage />
            </Guard>
          }
        />
        <Route
          path="admin/settings"
          element={
            <Guard permissions={["system.settings"]}>
              <SettingsPage />
            </Guard>
          }
        />

        <Route
          path="admin/audit"
          element={
            <Guard permissions={["audit.view"]}>
              <AuditTrailPage />
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
