import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", [
  "administrator",
  "user_dept_member",
  "head_of_dept",
  "accounting_officer",
  "procurement_unit",
  "contracts_chair",
  "contracts_secretary",
  "viewer",
]);

export const categoryEnum = pgEnum("procurement_category", [
  "supplies",
  "works",
  "non_consultancy",
]);

export const yearTypeEnum = pgEnum("year_type", ["calendar", "financial"]);

export const budgetCategoryEnum = pgEnum("budget_category", [
  "recurrent",
  "development",
]);

export const procurementSizeEnum = pgEnum("procurement_size", [
  "micro",
  "macro",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "draft",
  "pending_hod",
  "pending_accounting_officer",
  "pending_contracts_committee",
  "approved",
  "rejected",
]);

export const signatureRoleEnum = pgEnum("signature_role", [
  "user_dept",
  "head_of_dept",
  "accounting_officer",
]);

export const committeeDecisionEnum = pgEnum("committee_decision", [
  "approved",
  "rejected",
  "deferred",
]);

export const providerCategoryEnum = pgEnum("provider_category", [
  "national",
  "foreign",
  "resident",
  "eac",
]);

export const poStatusEnum = pgEnum("po_status", [
  "draft",
  "issued",
  "acknowledged",
  "completed",
  "cancelled",
]);

export const grnStatusEnum = pgEnum("grn_status", [
  "pending_inspection",
  "accepted",
  "rejected",
  "partial",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "approved",
  "paid",
  "rejected",
]);

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "active",
  "completed",
  "terminated",
]);

export const assetConditionEnum = pgEnum("asset_condition", [
  "new",
  "good",
  "fair",
  "poor",
  "disposed",
]);

export const planStatusEnum = pgEnum("plan_status", [
  "planned",
  "in_progress",
  "completed",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
  department: text("department"),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull(),
});

export const subProgrammes = pgTable("sub_programmes", {
  id: serial("id").primaryKey(),
  voteId: integer("vote_id")
    .notNull()
    .references(() => votes.id),
  romanNumeral: text("roman_numeral"),
  name: text("name").notNull(),
  displayOrder: integer("display_order"),
  // Price-list categories the request item picker suggests. Only needed for
  // sub-programmes with no budget items of their own (vote 2202 departments).
  priceCategories: text("price_categories").array(),
  // Code of this line in reference numbers, again only for the sub-programmes
  // that are a budget line in their own right.
  supplyCode: text("supply_code"),
});

export const budgetItems = pgTable("budget_items", {
  id: serial("id").primaryKey(),
  subProgrammeId: integer("sub_programme_id").references(
    () => subProgrammes.id
  ),
  voteId: integer("vote_id")
    .notNull()
    .references(() => votes.id),
  name: text("name").notNull(),
  budgetedAmount: numeric("budgeted_amount", { precision: 15, scale: 2 }),
  displayOrder: integer("display_order"),
  // Price-list categories the request item picker suggests for this line.
  priceCategories: text("price_categories").array(),
  // 3-digit code of this line, the fourth part of a request's reference number.
  supplyCode: text("supply_code"),
});

export const reservePriceItems = pgTable("reserve_price_items", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  itemName: text("item_name").notNull(),
  unitOfMeasure: text("unit_of_measure"),
  currentPrice: numeric("current_price", { precision: 15, scale: 2 }),
  maximumPrice: numeric("maximum_price", { precision: 15, scale: 2 }),
  year: integer("year").notNull().default(2026),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const savedItems = pgTable("saved_items", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  unitOfMeasure: text("unit_of_measure"),
  lastUnitCost: numeric("last_unit_cost", { precision: 15, scale: 2 }),
  timesUsed: integer("times_used").default(1),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const procurementRequests = pgTable("procurement_requests", {
  id: serial("id").primaryKey(),
  referenceNumber: text("reference_number").unique().notNull(),
  category: categoryEnum("category").notNull(),
  yearType: yearTypeEnum("year_type").default("calendar").notNull(),
  year: integer("year").notNull(),
  weekNumber: integer("week_number").notNull(),
  sequenceNumber: integer("sequence_number").notNull(),
  // Code of the budget line this request spends, as used in its reference number.
  supplyCode: text("supply_code"),
  budgetCategory: budgetCategoryEnum("budget_category").notNull(),
  procurementSize: procurementSizeEnum("procurement_size").notNull(),
  subjectOfProcurement: text("subject_of_procurement"),
  procurementPlanReference: text("procurement_plan_reference"),
  locationForDelivery: text("location_for_delivery"),
  dateRequired: date("date_required"),
  estimatedTotalCost: numeric("estimated_total_cost", {
    precision: 15,
    scale: 2,
  }),
  isMultiyear: boolean("is_multiyear").default(false),
  multiyearYearOne: numeric("multiyear_year_one", { precision: 15, scale: 2 }),
  multiyearYearTwo: numeric("multiyear_year_two", { precision: 15, scale: 2 }),
  multiyearYearThree: numeric("multiyear_year_three", {
    precision: 15,
    scale: 2,
  }),
  multiyearYearFour: numeric("multiyear_year_four", {
    precision: 15,
    scale: 2,
  }),
  voteId: integer("vote_id").references(() => votes.id),
  subProgrammeId: integer("sub_programme_id").references(() => subProgrammes.id),
  budgetItemId: integer("budget_item_id").references(() => budgetItems.id),
  balanceRemainingManual: numeric("balance_remaining_manual", {
    precision: 15,
    scale: 2,
  }),
  status: requestStatusEnum("status").default("draft").notNull(),
  // Set by the browser when the request was filled in (possibly offline), so
  // sending it twice can't create two requests. Unique when present.
  clientRef: uuid("client_ref"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const procurementItems = pgTable("procurement_items", {
  id: serial("id").primaryKey(),
  procurementRequestId: integer("procurement_request_id")
    .notNull()
    .references(() => procurementRequests.id, { onDelete: "cascade" }),
  itemNo: integer("item_no").notNull(),
  savedItemId: integer("saved_item_id").references(() => savedItems.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }),
  unitOfMeasure: text("unit_of_measure"),
  estimatedUnitCost: numeric("estimated_unit_cost", {
    precision: 15,
    scale: 2,
  }),
  marketPrice: numeric("market_price", { precision: 15, scale: 2 }),
  totalCost: numeric("total_cost", { precision: 15, scale: 2 }),
});

export const requestSignatures = pgTable("request_signatures", {
  id: serial("id").primaryKey(),
  procurementRequestId: integer("procurement_request_id")
    .notNull()
    .references(() => procurementRequests.id),
  role: signatureRoleEnum("role").notNull(),
  signedByUserId: integer("signed_by_user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  title: text("title").notNull(),
  signedAt: timestamp("signed_at").defaultNow(),
});

export const contractsCommitteeDecisions = pgTable(
  "contracts_committee_decisions",
  {
    id: serial("id").primaryKey(),
    procurementRequestId: integer("procurement_request_id")
      .notNull()
      .references(() => procurementRequests.id),
    submissionDate: date("submission_date"),
    committeeMeetingDate: date("committee_meeting_date"),
    meetingReference: text("meeting_reference"),
    // Part II rows 1–6: the Procurement and Disposal Unit's submission.
    recommendedMethod: text("recommended_method"),
    methodJustification: text("method_justification"),
    shortlistedProviders: text("shortlisted_providers"),
    biddingDocumentTeam: text("bidding_document_team"),
    evaluationCommittee: text("evaluation_committee"),
    biddingDocumentCost: numeric("bidding_document_cost", {
      precision: 15,
      scale: 2,
    }),
    otherInformation: text("other_information"),
    // The Contracts Committee's decision and conditions for each row, keyed
    // "1"–"6": { decision, conditions }.
    rowDecisions: jsonb("row_decisions"),
    decision: committeeDecisionEnum("decision"),
    decisionJustification: text("decision_justification"),
    chairpersonUserId: integer("chairperson_user_id").references(
      () => users.id
    ),
    chairpersonSignedAt: timestamp("chairperson_signed_at"),
    secretaryUserId: integer("secretary_user_id").references(() => users.id),
    secretarySignedAt: timestamp("secretary_signed_at"),
  }
);

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  tinNumber: text("tin_number"),
  registrationNumber: text("registration_number"),
  category: categoryEnum("category"),
  providerCategory: providerCategoryEnum("provider_category").default("national"),
  ownerNames: text("owner_names"),
  targetGroup: text("target_group"),
  isPrequalified: boolean("is_prequalified").default(false),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").unique().notNull(),
  procurementRequestId: integer("procurement_request_id").references(
    () => procurementRequests.id
  ),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  status: poStatusEnum("status").default("draft").notNull(),
  issueDate: date("issue_date"),
  expectedDeliveryDate: date("expected_delivery_date"),
  deliveryLocation: text("delivery_location"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }),
  termsAndConditions: text("terms_and_conditions"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  itemNo: integer("item_no").notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }),
  unitOfMeasure: text("unit_of_measure"),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }),
  totalPrice: numeric("total_price", { precision: 15, scale: 2 }),
});

export const goodsReceivedNotes = pgTable("goods_received_notes", {
  id: serial("id").primaryKey(),
  grnNumber: text("grn_number").unique().notNull(),
  purchaseOrderId: integer("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  receivedDate: date("received_date").notNull(),
  receivedByUserId: integer("received_by_user_id")
    .notNull()
    .references(() => users.id),
  inspectedByUserId: integer("inspected_by_user_id").references(() => users.id),
  status: grnStatusEnum("status").default("pending_inspection").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const goodsReceivedItems = pgTable("goods_received_items", {
  id: serial("id").primaryKey(),
  grnId: integer("grn_id")
    .notNull()
    .references(() => goodsReceivedNotes.id, { onDelete: "cascade" }),
  purchaseOrderItemId: integer("purchase_order_item_id")
    .notNull()
    .references(() => purchaseOrderItems.id),
  quantityReceived: numeric("quantity_received", { precision: 10, scale: 2 }),
  quantityAccepted: numeric("quantity_accepted", { precision: 10, scale: 2 }),
  condition: text("condition"),
  remarks: text("remarks"),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  invoiceDate: date("invoice_date").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").default("pending").notNull(),
  paidDate: date("paid_date"),
  notes: text("notes"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  contractNumber: text("contract_number").unique().notNull(),
  procurementRequestId: integer("procurement_request_id").references(
    () => procurementRequests.id
  ),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  title: text("title").notNull(),
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  signedDate: date("signed_date"),
  status: contractStatusEnum("status").default("draft").notNull(),
  documentReference: text("document_reference"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contractAmendments = pgTable("contract_amendments", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  amendmentDate: date("amendment_date").notNull(),
  description: text("description").notNull(),
  valueChange: numeric("value_change", { precision: 15, scale: 2 }),
  revisedContractValue: numeric("revised_contract_value", {
    precision: 15,
    scale: 2,
  }),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const procurementPlanItems = pgTable("procurement_plan_items", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  subjectOfProcurement: text("subject_of_procurement").notNull(),
  currency: text("currency").default("UGX"),
  estimatedCost: numeric("estimated_cost", { precision: 15, scale: 2 }),
  sourceOfFunding: text("source_of_funding"),
  procurementMethod: text("procurement_method"),
  procurementCategory: categoryEnum("procurement_category"),
  contractType: text("contract_type"),
  isPrequalificationRequired: boolean("is_prequalification_required").default(false),
  applyReservationScheme: boolean("apply_reservation_scheme").default(false),
  reservationSchemeType: text("reservation_scheme_type"),
  bidInvitationDate: date("bid_invitation_date"),
  bidClosingDate: date("bid_closing_date"),
  evaluationReportDate: date("evaluation_report_date"),
  awardNotificationDate: date("award_notification_date"),
  contractSigningDate: date("contract_signing_date"),
  completionDate: date("completion_date"),
  linkedRequestId: integer("linked_request_id").references(() => procurementRequests.id),
  status: planStatusEnum("status").default("planned").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  assetTag: text("asset_tag").unique().notNull(),
  name: text("name").notNull(),
  category: text("category"),
  description: text("description"),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1"),
  unitOfMeasure: text("unit_of_measure"),
  unitValue: numeric("unit_value", { precision: 15, scale: 2 }),
  totalValue: numeric("total_value", { precision: 15, scale: 2 }),
  location: text("location"),
  condition: assetConditionEnum("condition").default("new"),
  acquisitionDate: date("acquisition_date"),
  acquisitionSource: text("acquisition_source"),
  goodsReceivedItemId: integer("goods_received_item_id").references(
    () => goodsReceivedItems.id
  ),
  isDisposed: boolean("is_disposed").notNull().default(false),
  disposalDate: date("disposal_date"),
  disposalReason: text("disposal_reason"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const itemBaskets = pgTable("item_baskets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  // The budget line the basket is offered for in the request item picker.
  // Tuition Stores departments have no budget items, so they link by
  // sub-programme instead; a basket has at most one of the two.
  budgetItemId: integer("budget_item_id").references(() => budgetItems.id),
  subProgrammeId: integer("sub_programme_id").references(() => subProgrammes.id),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const itemBasketItems = pgTable("item_basket_items", {
  id: serial("id").primaryKey(),
  basketId: integer("basket_id")
    .notNull()
    .references(() => itemBaskets.id, { onDelete: "cascade" }),
  itemNo: integer("item_no").notNull(),
  // Linked items take their name, unit and price from the live price list;
  // the copies below serve hand-typed items or a deactivated price entry.
  reservePriceItemId: integer("reserve_price_item_id").references(
    () => reservePriceItems.id
  ),
  description: text("description").notNull(),
  unitOfMeasure: text("unit_of_measure"),
  defaultQuantity: numeric("default_quantity", { precision: 10, scale: 2 }),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }),
});

export type ItemBasket = typeof itemBaskets.$inferSelect;
export type ItemBasketItem = typeof itemBasketItems.$inferSelect;
export type User = typeof users.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type SubProgramme = typeof subProgrammes.$inferSelect;
export type BudgetItem = typeof budgetItems.$inferSelect;
export type ProcurementRequest = typeof procurementRequests.$inferSelect;
export type ProcurementItem = typeof procurementItems.$inferSelect;
export type SavedItem = typeof savedItems.$inferSelect;
export type ReservePriceItem = typeof reservePriceItems.$inferSelect;
export type RequestSignature = typeof requestSignatures.$inferSelect;
export type ContractsCommitteeDecision =
  typeof contractsCommitteeDecisions.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type GoodsReceivedNote = typeof goodsReceivedNotes.$inferSelect;
export type GoodsReceivedItem = typeof goodsReceivedItems.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type ContractAmendment = typeof contractAmendments.$inferSelect;
export type ProcurementPlanItem = typeof procurementPlanItems.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

/** Settings the school changes without a code release, such as term months. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Disposals of public assets, reported in FORM 27 Part V. */
export const disposals = pgTable("disposals", {
  id: serial("id").primaryKey(),
  referenceNumber: text("reference_number").unique().notNull(),
  subject: text("subject").notNull(),
  method: text("method"),
  buyerName: text("buyer_name"),
  awardDate: date("award_date"),
  reservePrice: numeric("reserve_price", { precision: 15, scale: 2 }),
  contractPrice: numeric("contract_price", { precision: 15, scale: 2 }),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** A term's FORM 27 as saved: filled from the records, then corrected by hand. */
export const termlyReports = pgTable(
  "termly_reports",
  {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    term: integer("term").notNull(),
    parts: jsonb("parts").notNull(),
    declaration: jsonb("declaration"),
    createdBy: integer("created_by").references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [unique().on(t.year, t.term)]
);
