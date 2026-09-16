/**
 * The module registry that drives the Quick Actions hub on the dashboard.
 *
 * Each entry declares the permissions needed to see it. Modules still being
 * built are marked `status: "soon"` — they render dimmed and are not clickable.
 */

export type ModuleStatus = "live" | "soon";

export interface ProcurementModule {
  key: string;
  label: string;
  to: string;
  group: string;
  status: ModuleStatus;
  /** Any one of these permissions reveals the tile. Empty = everyone. */
  permissions: string[];
  icon: JSX.Element;
  description: string;
}

const s = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <g {...s}>{children}</g>
  </svg>
);

export const MODULES: ProcurementModule[] = [
  // ---------------------------------------------------------------- Procurement
  {
    key: "requests",
    label: "Requests",
    to: "/requests",
    group: "Procurement",
    status: "live",
    permissions: ["requests.view.own", "requests.view.department", "requests.view.all"],
    description: "Raise and track TFORM 5 procurement requests",
    icon: (
      <Svg>
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </Svg>
    ),
  },
  {
    key: "baskets",
    label: "Saved Baskets",
    to: "/baskets",
    group: "Procurement",
    status: "live",
    permissions: ["requests.create", "reserve_prices.manage"],
    description: "Reusable item lists that load into a request in one click",
    icon: (
      <Svg>
        <path d="M3 10h18l-2 10H5L3 10Z" />
        <path d="m8 10 4-6 4 6" />
        <path d="M9 14v3M12 14v3M15 14v3" />
      </Svg>
    ),
  },
  {
    key: "plan",
    label: "Procurement Plan",
    to: "/plan",
    group: "Procurement",
    status: "live",
    permissions: ["procurement_plan.view"],
    description: "Annual PPDA procurement plan for the calendar year",
    icon: (
      <Svg>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
        <path d="M7 13h4M7 17h8M14 13h3" />
      </Svg>
    ),
  },
  {
    key: "tenders",
    label: "Bids & Tenders",
    to: "/tenders",
    group: "Procurement",
    status: "live",
    permissions: ["requests.prepare.committee", "requests.approve.committee", "requests.view.all"],
    description: "Contracts Committee submissions and decisions",
    icon: (
      <Svg>
        <path d="M4 20h16" />
        <path d="M12 16V8" />
        <path d="m6 8 6-4 6 4" />
        <path d="M4 8h16v3a4 4 0 0 1-8 0 4 4 0 0 1-8 0V8Z" />
      </Svg>
    ),
  },
  {
    key: "orders",
    label: "LPOs",
    to: "/purchase-orders",
    group: "Procurement",
    status: "live",
    permissions: ["purchase_orders.view"],
    description: "Local purchase orders issued to suppliers",
    icon: (
      <Svg>
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 2-1.55L20.5 8H6" />
        <circle cx="10" cy="20" r="1.3" />
        <circle cx="17" cy="20" r="1.3" />
      </Svg>
    ),
  },

  // ------------------------------------------------- Providers & Contracts
  {
    key: "suppliers",
    label: "Suppliers",
    to: "/suppliers",
    group: "Providers & Contracts",
    status: "live",
    permissions: ["suppliers.view"],
    description: "Provider register, prequalification and performance",
    icon: (
      <Svg>
        <path d="M3 21V9l5-3 5 3v12" />
        <path d="M13 21V13l4-2 4 2v8" />
        <path d="M2 21h20" />
        <path d="M6.5 12h1M6.5 15.5h1M16.5 16h1" />
      </Svg>
    ),
  },
  {
    key: "contracts",
    label: "Contracts",
    to: "/contracts",
    group: "Providers & Contracts",
    status: "live",
    permissions: ["contracts.view"],
    description: "Signed contracts, amendments and completion",
    icon: (
      <Svg>
        <path d="M8 3h8l4 4v14H4V3h4Z" />
        <path d="M16 3v4h4" />
        <path d="M8 12h8" />
        <path d="M8 16c2 0 2-1.5 4-1.5S14 16 16 16" />
      </Svg>
    ),
  },

  // ------------------------------------------------- Receiving & Payment
  {
    key: "grn",
    label: "Goods Received",
    to: "/goods-received",
    group: "Receiving & Payment",
    status: "live",
    permissions: ["goods_received.view"],
    description: "Delivery notes, inspection and acceptance",
    icon: (
      <Svg>
        <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z" />
        <path d="M3 8.5 12 13l9-4.5M12 13v7" />
      </Svg>
    ),
  },
  {
    key: "invoices",
    label: "Invoices",
    to: "/invoices",
    group: "Receiving & Payment",
    status: "live",
    permissions: ["invoices.view"],
    description: "Match invoices to orders and deliveries, then pay",
    icon: (
      <Svg>
        <path d="M5 3h14v18l-2.5-1.6L14 21l-2-1.6L10 21l-2.5-1.6L5 21V3Z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </Svg>
    ),
  },
  {
    key: "inventory",
    label: "Inventory & Assets",
    to: "/inventory",
    group: "Receiving & Payment",
    status: "live",
    permissions: ["inventory.view"],
    description: "Stock levels and the school asset register",
    icon: (
      <Svg>
        <rect x="3" y="10" width="7" height="11" rx="1" />
        <rect x="14" y="10" width="7" height="11" rx="1" />
        <rect x="8.5" y="3" width="7" height="7" rx="1" />
      </Svg>
    ),
  },
  {
    key: "disposals",
    label: "Disposals",
    to: "/disposals",
    group: "Receiving & Payment",
    status: "live",
    permissions: ["disposals.view"],
    description: "Assets sold, auctioned or written off — FORM 27 Part V",
    icon: (
      <Svg>
        <path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10" />
        <path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8" />
      </Svg>
    ),
  },

  // ---------------------------------------------------------- Reference
  {
    key: "reserve-prices",
    label: "Reserve Prices",
    to: "/reserve-prices",
    group: "Reference",
    status: "live",
    permissions: ["reserve_prices.view"],
    description: "Approved price ceilings used to check unit costs",
    icon: (
      <Svg>
        <path d="M4 7V5a1 1 0 0 1 1-1h5.2a2 2 0 0 1 1.4.6l8.4 8.4a1.4 1.4 0 0 1 0 2l-5.4 5.4a1.4 1.4 0 0 1-2 0L4.6 12A2 2 0 0 1 4 10.6V7Z" />
        <circle cx="8" cy="8" r="1.3" />
      </Svg>
    ),
  },
  {
    key: "budget",
    label: "Budget",
    to: "/admin/budget",
    group: "Reference",
    status: "live",
    permissions: ["budget.edit"],
    description: "Vote, sub-programme and budget item amounts",
    icon: (
      <Svg>
        <path d="M3 20h18" />
        <rect x="5" y="12" width="3.5" height="8" rx="1" />
        <rect x="10.2" y="8" width="3.5" height="12" rx="1" />
        <rect x="15.5" y="4" width="3.5" height="16" rx="1" />
      </Svg>
    ),
  },

  // ------------------------------------------------------ Reports & Admin
  {
    key: "monthly-report",
    label: "Monthly Report",
    to: "/reports/monthly",
    group: "Reports & Administration",
    status: "live",
    permissions: ["reports.view"],
    description: "PPDA FORM 2 monthly return, Parts I to IV",
    icon: (
      <Svg>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 15V11M12 15V7M17 15v-3" />
      </Svg>
    ),
  },
  {
    key: "termly-report",
    label: "Termly Report",
    to: "/reports/termly",
    group: "Reports & Administration",
    status: "live",
    permissions: ["reports.view"],
    description: "PPDA FORM 27 — the termly return, Parts I to V",
    icon: (
      <Svg>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
        <path d="M8 17v-3M12 17v-5M16 17v-2" />
      </Svg>
    ),
  },
  {
    key: "reports",
    label: "Reports",
    to: "/reports",
    group: "Reports & Administration",
    status: "live",
    permissions: ["reports.view"],
    description: "Spending by department, category and provider",
    icon: (
      <Svg>
        <path d="M21 12a9 9 0 1 1-9-9v9h9Z" />
        <path d="M15.5 3.5A9 9 0 0 1 20.5 8.5L14 11V4Z" />
      </Svg>
    ),
  },
  {
    key: "users",
    label: "Users & Roles",
    to: "/admin/users",
    group: "Reports & Administration",
    status: "live",
    permissions: ["users.view"],
    description: "Create accounts and set what each person can do",
    icon: (
      <Svg>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M17 11h4M19 9v4" />
      </Svg>
    ),
  },
  {
    key: "audit",
    label: "Audit Trail",
    to: "/admin/audit",
    group: "Reports & Administration",
    status: "live",
    permissions: ["audit.view"],
    description: "Every action recorded, for PPDA compliance",
    icon: (
      <Svg>
        <path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </Svg>
    ),
  },
  {
    key: "settings",
    label: "Settings",
    to: "/admin/settings",
    group: "Reports & Administration",
    status: "live",
    permissions: ["system.settings"],
    description: "School term months and other system settings",
    icon: (
      <Svg>
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
        <path d="M1 14h6M9 8h6M17 16h6" />
      </Svg>
    ),
  },
];

/** Groups in the order they should appear on the hub. */
export const MODULE_GROUPS = [
  "Procurement",
  "Providers & Contracts",
  "Receiving & Payment",
  "Reference",
  "Reports & Administration",
];
