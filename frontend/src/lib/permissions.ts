/**
 * Frontend mirror of the backend permission list.
 *
 * This only drives what the UI shows — the backend enforces the real rules on
 * every request. Keep the labels in sync with backend/src/lib/permissions.ts.
 */

export type Role =
  | "administrator"
  | "user_dept_member"
  | "head_of_dept"
  | "accounting_officer"
  | "procurement_unit"
  | "contracts_chair"
  | "contracts_secretary"
  | "viewer";

export const ROLE_LABELS: Record<Role, string> = {
  administrator: "Administrator",
  user_dept_member: "User Department Member",
  head_of_dept: "Head of Department",
  accounting_officer: "Accounting Officer",
  procurement_unit: "Procurement & Disposal Unit",
  contracts_chair: "Contracts Committee Chairperson",
  contracts_secretary: "Contracts Committee Secretary",
  viewer: "Viewer (Read-only)",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  administrator:
    "Full access. Manages users, roles, budgets and every procurement request.",
  user_dept_member:
    "Raises procurement requests for their department and tracks their own.",
  head_of_dept:
    "Reviews and approves requests raised within their own department.",
  accounting_officer:
    "Confirms funding availability and gives approval to procure.",
  procurement_unit:
    "Prepares submissions to the Contracts Committee for macro procurements.",
  contracts_chair:
    "Chairs the Contracts Committee and records approval decisions.",
  contracts_secretary:
    "Records Contracts Committee decisions and maintains the minutes.",
  viewer: "Can view requests and reports. Cannot create or change anything.",
};

/** Roles ordered for display in the admin UI — most privileged first. */
export const ROLE_ORDER: Role[] = [
  "administrator",
  "accounting_officer",
  "head_of_dept",
  "procurement_unit",
  "contracts_chair",
  "contracts_secretary",
  "user_dept_member",
  "viewer",
];

export function roleLabel(role: string | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role as Role] ?? role.replace(/_/g, " ");
}

/** Colour chip per role, so roles are recognisable at a glance in tables. */
export function roleBadgeClass(role: string | undefined): string {
  switch (role) {
    case "administrator":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "accounting_officer":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "head_of_dept":
      return "bg-green-100 text-green-800 border-green-200";
    case "procurement_unit":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "contracts_chair":
    case "contracts_secretary":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "viewer":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

/** Every permission in plain words, grouped the way the sidebar groups the work. */
export const PERMISSION_GROUPS: { title: string; items: [permission: string, label: string][] }[] = [
  {
    title: "Requests",
    items: [
      ["requests.view.own", "See the requests you raised"],
      ["requests.view.department", "See your department's requests"],
      ["requests.view.all", "See every request"],
      ["requests.create", "Raise requests"],
      ["requests.edit.own", "Edit your own draft requests"],
      ["requests.submit", "Submit requests for approval"],
      ["requests.approve.hod", "Approve as Head of Department"],
      ["requests.approve.accounting_officer", "Approve as Accounting Officer"],
      ["requests.prepare.committee", "Prepare Contracts Committee submissions"],
      ["requests.approve.committee", "Record Contracts Committee decisions"],
      ["requests.print", "Print TFORM 5"],
      ["requests.delete", "Delete requests"],
    ],
  },
  {
    title: "Budget and prices",
    items: [
      ["budget.view", "See budget lines"],
      ["budget.edit", "Edit budget lines"],
      ["reserve_prices.view", "See the price list"],
      ["reserve_prices.manage", "Manage the price list"],
    ],
  },
  {
    title: "Suppliers and LPOs",
    items: [
      ["suppliers.view", "See suppliers"],
      ["suppliers.manage", "Add and edit suppliers"],
      ["purchase_orders.view", "See LPOs"],
      ["purchase_orders.create", "Prepare LPOs"],
      ["purchase_orders.manage", "Issue and manage LPOs"],
      ["contracts.view", "See contracts"],
      ["contracts.manage", "Manage contracts"],
    ],
  },
  {
    title: "Receiving and payment",
    items: [
      ["goods_received.view", "See deliveries"],
      ["goods_received.create", "Record deliveries"],
      ["goods_received.inspect", "Inspect deliveries"],
      ["invoices.view", "See invoices"],
      ["invoices.create", "Record invoices"],
      ["invoices.approve", "Approve invoices"],
      ["invoices.pay", "Mark invoices paid"],
      ["inventory.view", "See inventory and assets"],
      ["inventory.manage", "Manage inventory and assets"],
      ["disposals.view", "See disposals"],
      ["disposals.manage", "Record disposals"],
    ],
  },
  {
    title: "Planning and reports",
    items: [
      ["procurement_plan.view", "See the procurement plan"],
      ["procurement_plan.manage", "Edit the procurement plan"],
      ["reports.view", "See reports"],
      ["reports.prepare", "Prepare and save PPDA returns"],
    ],
  },
  {
    title: "Administration",
    items: [
      ["audit.view", "See the audit trail"],
      ["users.view", "See user accounts"],
      ["users.create", "Add users"],
      ["users.edit", "Change users' roles and details"],
      ["users.deactivate", "Deactivate users"],
      ["users.reset_password", "Reset passwords"],
      ["system.settings", "Change system settings"],
    ],
  },
];
