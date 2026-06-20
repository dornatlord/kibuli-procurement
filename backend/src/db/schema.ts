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
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", [
  "user_dept_member",
  "head_of_dept",
  "accounting_officer",
  "procurement_unit",
  "contracts_chair",
  "contracts_secretary",
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

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
  department: text("department"),
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
    recommendedMethod: text("recommended_method"),
    methodJustification: text("method_justification"),
    shortlistedProviders: jsonb("shortlisted_providers"),
    evaluationCommittee: jsonb("evaluation_committee"),
    biddingDocumentTeam: jsonb("bidding_document_team"),
    biddingDocumentCost: numeric("bidding_document_cost", {
      precision: 15,
      scale: 2,
    }),
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

export type User = typeof users.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type SubProgramme = typeof subProgrammes.$inferSelect;
export type BudgetItem = typeof budgetItems.$inferSelect;
export type ProcurementRequest = typeof procurementRequests.$inferSelect;
export type ProcurementItem = typeof procurementItems.$inferSelect;
export type SavedItem = typeof savedItems.$inferSelect;
export type RequestSignature = typeof requestSignatures.$inferSelect;
export type ContractsCommitteeDecision =
  typeof contractsCommitteeDecisions.$inferSelect;
