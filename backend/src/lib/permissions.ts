/**
 * Central permission definitions.
 *
 * Every role maps to an explicit list of permissions. The administrator is the
 * only role that implicitly has everything — every other role only gets what is
 * listed here.
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

export type Permission =
  // Requests
  | "requests.view.own"
  | "requests.view.department"
  | "requests.view.all"
  | "requests.create"
  | "requests.edit.own"
  | "requests.delete"
  | "requests.submit"
  | "requests.approve.hod"
  | "requests.approve.accounting_officer"
  | "requests.approve.committee"
  | "requests.prepare.committee"
  | "requests.print"
  // Budget
  | "budget.view"
  | "budget.edit"
  // Reserve prices
  | "reserve_prices.view"
  | "reserve_prices.manage"
  // Suppliers
  | "suppliers.view"
  | "suppliers.manage"
  // Purchase orders
  | "purchase_orders.view"
  | "purchase_orders.create"
  | "purchase_orders.manage"
  // Goods received
  | "goods_received.view"
  | "goods_received.create"
  | "goods_received.inspect"
  // Invoices
  | "invoices.view"
  | "invoices.create"
  | "invoices.approve"
  | "invoices.pay"
  // Contracts
  | "contracts.view"
  | "contracts.manage"
  // Procurement plan
  | "procurement_plan.view"
  | "procurement_plan.manage"
  // Inventory & assets
  | "inventory.view"
  | "inventory.manage"
  // Audit trail
  | "audit.view"
  // Users
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.deactivate"
  | "users.reset_password"
  // Reports
  | "reports.view"
  // System
  | "system.settings";

const ALL_PERMISSIONS: Permission[] = [
  "requests.view.own",
  "requests.view.department",
  "requests.view.all",
  "requests.create",
  "requests.edit.own",
  "requests.delete",
  "requests.submit",
  "requests.approve.hod",
  "requests.approve.accounting_officer",
  "requests.approve.committee",
  "requests.prepare.committee",
  "requests.print",
  "budget.view",
  "budget.edit",
  "reserve_prices.view",
  "reserve_prices.manage",
  "suppliers.view",
  "suppliers.manage",
  "purchase_orders.view",
  "purchase_orders.create",
  "purchase_orders.manage",
  "goods_received.view",
  "goods_received.create",
  "goods_received.inspect",
  "invoices.view",
  "invoices.create",
  "invoices.approve",
  "invoices.pay",
  "contracts.view",
  "contracts.manage",
  "procurement_plan.view",
  "procurement_plan.manage",
  "inventory.view",
  "inventory.manage",
  "audit.view",
  "users.view",
  "users.create",
  "users.edit",
  "users.deactivate",
  "users.reset_password",
  "reports.view",
  "system.settings",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Full access — no restrictions
  administrator: ALL_PERMISSIONS,

  // Creates requests for their department; receives goods they ordered
  user_dept_member: [
    "requests.view.own",
    "requests.create",
    "requests.edit.own",
    "requests.submit",
    "requests.print",
    "budget.view",
    "reserve_prices.view",
    "goods_received.view",
    "goods_received.create",
  ],

  // Approves requests from their own department
  head_of_dept: [
    "requests.view.own",
    "requests.view.department",
    "requests.create",
    "requests.edit.own",
    "requests.submit",
    "requests.approve.hod",
    "requests.print",
    "budget.view",
    "reserve_prices.view",
    "goods_received.view",
    "goods_received.inspect",
    "procurement_plan.view",
    "inventory.view",
    "reports.view",
  ],

  // Confirms funding and approves to procure; financial oversight
  accounting_officer: [
    "requests.view.all",
    "requests.approve.accounting_officer",
    "requests.print",
    "budget.view",
    "budget.edit",
    "reserve_prices.view",
    "suppliers.view",
    "purchase_orders.view",
    "goods_received.view",
    "invoices.view",
    "invoices.create",
    "invoices.approve",
    "invoices.pay",
    "contracts.view",
    "procurement_plan.view",
    "inventory.view",
    "reports.view",
  ],

  // The PDU — operates suppliers, POs, receiving, contracts and the plan
  procurement_unit: [
    "requests.view.all",
    "requests.prepare.committee",
    "requests.print",
    "budget.view",
    "reserve_prices.view",
    "reserve_prices.manage",
    "suppliers.view",
    "suppliers.manage",
    "purchase_orders.view",
    "purchase_orders.create",
    "purchase_orders.manage",
    "goods_received.view",
    "goods_received.create",
    "goods_received.inspect",
    "invoices.view",
    "invoices.create",
    "contracts.view",
    "contracts.manage",
    "procurement_plan.view",
    "procurement_plan.manage",
    "inventory.view",
    "inventory.manage",
    "reports.view",
  ],

  // Records committee decisions on macro procurements
  contracts_chair: [
    "requests.view.all",
    "requests.approve.committee",
    "requests.prepare.committee",
    "requests.print",
    "reserve_prices.view",
    "suppliers.view",
    "contracts.view",
    "procurement_plan.view",
    "reports.view",
  ],

  contracts_secretary: [
    "requests.view.all",
    "requests.approve.committee",
    "requests.prepare.committee",
    "requests.print",
    "reserve_prices.view",
    "suppliers.view",
    "contracts.view",
    "procurement_plan.view",
    "reports.view",
  ],

  // Read-only across everything reasonable
  viewer: [
    "requests.view.all",
    "reserve_prices.view",
    "suppliers.view",
    "purchase_orders.view",
    "goods_received.view",
    "invoices.view",
    "contracts.view",
    "procurement_plan.view",
    "inventory.view",
    "reports.view",
  ],
};

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

export function permissionsFor(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] ?? [];
}

export function hasPermission(role: string, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}
