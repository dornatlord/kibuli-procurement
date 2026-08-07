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
  | "requests.print"
  // Budget
  | "budget.view"
  | "budget.edit"
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
  "requests.print",
  "budget.view",
  "budget.edit",
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

  // Creates requests for their department
  user_dept_member: [
    "requests.view.own",
    "requests.create",
    "requests.edit.own",
    "requests.submit",
    "requests.print",
    "budget.view",
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
    "reports.view",
  ],

  // Confirms funding and approves to procure
  accounting_officer: [
    "requests.view.all",
    "requests.approve.accounting_officer",
    "requests.print",
    "budget.view",
    "budget.edit",
    "reports.view",
  ],

  // Prepares submissions to the Contracts Committee
  procurement_unit: [
    "requests.view.all",
    "requests.print",
    "budget.view",
    "reports.view",
  ],

  // Records committee decisions on macro procurements
  contracts_chair: [
    "requests.view.all",
    "requests.approve.committee",
    "requests.print",
    "reports.view",
  ],

  contracts_secretary: [
    "requests.view.all",
    "requests.approve.committee",
    "requests.print",
    "reports.view",
  ],

  // Read-only
  viewer: ["requests.view.all", "reports.view"],
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
