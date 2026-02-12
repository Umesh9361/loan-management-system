import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, date, uuid, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 50 }).notNull(),
  password: text("password").notNull(),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("user"), // admin, user, super_admin
  isActive: boolean("is_active").notNull().default(true),
  isTemporaryDisabled: boolean("is_temporary_disabled").notNull().default(false),
  temporaryDisabledUntil: timestamp("temporary_disabled_until"),
  temporaryDisabledBy: text("temporary_disabled_by"),
  createdBy: uuid("created_by"), // Admin who created this user
  fullName: text("full_name"),
  email: varchar("email", { length: 100 }),
  lastLoginAt: timestamp("last_login_at"),
  loginCount: integer("login_count").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// User permissions table - Updated with current menu items (August 2025)
export const userPermissions = pgTable("user_permissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  
  // Main Navigation Menus
  canViewDashboard: boolean("can_view_dashboard").default(true), // मुख्य पटल
  canAccessCompanyRegistration: boolean("can_access_company_registration").default(false), // कंपनी नोंदणी
  canAccessGroupManagement: boolean("can_access_group_management").default(false), // ग्रुप व्यवस्थापन
  canAccessLoanRegistration: boolean("can_access_loan_registration").default(false), // कर्ज नोंदणी
  canAccessLoanClosure: boolean("can_access_loan_closure").default(false), // कर्ज बंद करा
  canAccessCashTransactions: boolean("can_access_cash_transactions").default(false), // रोकड व्यवहार
  canAccessPartyManagement: boolean("can_access_party_management").default(false), // अकाउंट क्रिएशन
  canAccessMobileCashbook: boolean("can_access_mobile_cashbook").default(false), // मोबाईल रोकड वही
  canAccessInterestCalculator: boolean("can_access_interest_calculator").default(true), // व्याज कॅल्क्युलेटर
  
  // Admin Only Menus - REMOVED: These should never be granted to regular users
  // यूजर मॅनेजमेंट, डेटा व्यवस्थापन, सुपर एडमिन पॅनेल - admin-only features
  
  // Reports Access
  canViewReceiptGenerator: boolean("can_view_receipt_generator").default(false), // पावती जनरेशन
  canViewCashBookReport: boolean("can_view_cash_book_report").default(false), // रोकड वही
  canViewCapitalReport: boolean("can_view_capital_report").default(false), // भांडवल खाते
  canViewLedgerReport: boolean("can_view_ledger_report").default(false), // खाते वही
  canViewBorrowerListReport: boolean("can_view_borrower_list_report").default(false), // कर्जदार सूची
  canViewOverdueReport: boolean("can_view_overdue_report").default(false), // मुदत संपलेले अहवाल
  // Note: Date-wise, Name-wise, Closing-wise, and Maturity-wise reports removed as they're not used in current routing
  
  // Additional Report Permissions
  canViewAccountSummaryReport: boolean("can_view_account_summary_report").default(false), // खाते सारांश अहवाल
  
  // Borrower Management - Only core permissions used
  canManageBorrowers: boolean("can_manage_borrowers").default(false),
  canDeleteBorrowers: boolean("can_delete_borrowers").default(false),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// User activity log table
export const userActivityLogs = pgTable("user_activity_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  activityType: varchar("activity_type", { length: 50 }).notNull(), // login, logout, create_loan, etc.
  description: text("description").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Sessions table for express-session (managed by connect-pg-simple)
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(), // JSON session data
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

// Companies/Tenants table
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  licenseNumber: varchar("license_number", { length: 50 }),
  address: text("address"),
  contactNumber: varchar("contact_number", { length: 15 }),
  email: varchar("email", { length: 100 }),
  isActive: boolean("is_active").notNull().default(true),
  bottomNavEnabled: boolean("bottom_nav_enabled").notNull().default(true),
  showSummaryRateMonths: boolean("show_summary_rate_months").notNull().default(true),
  showSummaryDetails: boolean("show_summary_details").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Groups table
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Borrowers table
export const borrowers = pgTable("borrowers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  name: text("name").notNull(),
  mobile: varchar("mobile", { length: 15 }).notNull(),
  address: text("address"),
  bankDetails: text("bank_details").default(""),
  groupId: uuid("group_id").references(() => groups.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Loans table
export const loans = pgTable("loans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  loanNumber: varchar("loan_number", { length: 50 }).default(sql`gen_random_uuid()`),
  borrowerId: uuid("borrower_id").references(() => borrowers.id, { onDelete: "set null", onUpdate: "cascade" }),
  groupId: uuid("group_id").references(() => groups.id).notNull(),
  
  // Basic borrower info
  borrowerName: text("borrower_name").notNull(),
  borrowerMobile: varchar("borrower_mobile", { length: 15 }),
  borrowerAddress: text("borrower_address"),
  borrowerOccupation: text("borrower_occupation"), // व्यवसाय (for annual statement)
  isBackwardClass: boolean("is_backward_class"), // मागासवर्गीय आहे काय?
  isFarmer: boolean("is_farmer"), // शेतकरी प्रभागातील आहे काय?
  
  // Business type
  businessType: varchar("business_type", { length: 20 }).notNull(), // कृषी, बिगर_कृषी
  
  // Loan details
  loanType: varchar("loan_type", { length: 20 }).notNull(), // तारण, विनातारण
  accountNumber: varchar("account_number", { length: 50 }).notNull(),
  principalAmount: decimal("principal_amount", { precision: 12, scale: 2 }).notNull(),
  loanDate: date("loan_date").notNull(),
  maturityDate: date("maturity_date").notNull(),
  
  // Maturity fields
  hasMaturity: boolean("has_maturity").notNull().default(false), // चेक बॉक्स
  maturityMonths: integer("maturity_months"), // मुदत महिने
  calculatedMaturityDate: date("calculated_maturity_date"), // ऑटो calculated date
  
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  interestRateType: varchar("interest_rate_type", { length: 10 }).notNull().default("monthly"), // yearly, monthly
  
  // Collateral details
  collateralDetails: text("collateral_details"), // तारणाचे स्वरूप तपशील
  weight: varchar("weight", { length: 50 }),
  marketValue: decimal("market_value", { precision: 12, scale: 2 }),
  
  // Document and other details
  documentDetails: text("document_details").default("—"), // कागदपत्राचा तपशील
  specialConditions: text("special_conditions").default("—"), // विशेष शर्ती
  otherInfo: text("other_info").default("—"), // इतर संबंधित माहिती
  
  // System fields
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, closed
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Transactions table for all financial transactions
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  loanId: uuid("loan_id").references(() => loans.id).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // disbursement, payment, interest, closure
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  interestAmount: decimal("interest_amount", { precision: 12, scale: 2 }).default("0"),
  transactionDate: date("transaction_date").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Loan Photos table - Professional photo storage for gold items
export const loanPhotos = pgTable("loan_photos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  loanId: uuid("loan_id").references(() => loans.id, { onDelete: "cascade" }).notNull(),
  
  // Photo details
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 50 }).notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  compressedSize: integer("compressed_size"), // after compression
  
  // Storage path
  storagePath: text("storage_path").notNull(),
  thumbnailPath: text("thumbnail_path"),
  storageProvider: varchar("storage_provider", { length: 20 }).default("local"),
  cloudinaryPublicId: text("cloudinary_public_id"),
  
  // Metadata
  photoType: varchar("photo_type", { length: 20 }).notNull().default("collateral"), // collateral, document, other
  description: text("description"), // optional description
  uploadedBy: uuid("uploaded_by").notNull(), // user who uploaded
  
  // System fields
  isActive: boolean("is_active").notNull().default(true),
  deletedReason: varchar("deleted_reason", { length: 50 }), // Track deletion reason
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// System Settings table - Global defaults (Super Admin controlled)
export const systemSettings = pgTable("system_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: varchar("setting_key", { length: 100 }).notNull().unique(),
  settingValue: text("setting_value").notNull(),
  settingType: varchar("setting_type", { length: 50 }).notNull().default("string"),
  description: text("description"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Tenant Storage Settings - Per-tenant photo storage configuration
export const tenantStorageSettings = pgTable("tenant_storage_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 20 }).notNull().unique(),
  storageProvider: varchar("storage_provider", { length: 20 }).notNull().default("local"),
  cloudinaryCloudName: text("cloudinary_cloud_name"),
  cloudinaryApiKey: text("cloudinary_api_key"),
  cloudinaryApiSecret: text("cloudinary_api_secret"),
  cloudinaryFolder: varchar("cloudinary_folder", { length: 100 }),
  isConfigured: boolean("is_configured").notNull().default(false),
  lastTestedAt: timestamp("last_tested_at"),
  testStatus: varchar("test_status", { length: 20 }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Password Reset Requests table - persisted across server restarts
export const passwordResetRequests = pgTable("password_reset_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  username: varchar("username", { length: 50 }).notNull(),
  adminId: uuid("admin_id"),
  userRole: varchar("user_role", { length: 20 }),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  completedBy: uuid("completed_by"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Loan closures table
export const loanClosures = pgTable("loan_closures", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  loanId: uuid("loan_id").references(() => loans.id).notNull(),
  closureDate: date("closure_date").notNull(),
  principalPaid: decimal("principal_paid", { precision: 12, scale: 2 }).notNull(),
  interestPaid: decimal("interest_paid", { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  calculatedInterest: decimal("calculated_interest", { precision: 12, scale: 2 }).notNull(),
  actualPaidAmount: decimal("actual_paid_amount", { precision: 12, scale: 2 }).notNull(),
  balanceRefund: decimal("balance_refund", { precision: 12, scale: 2 }).default("0"),
  interestType: varchar("interest_type", { length: 20 }).notNull().default("simple"), // simple, advance, manual
  calculationMode: varchar("calculation_mode", { length: 20 }).notNull().default("full_month"), // full_month or fractional
  durationInMonths: decimal("duration_in_months", { precision: 10, scale: 2 }).notNull(),
  returnOfArticles: text("return_of_articles"), // Comments about returned items
  isClosed: boolean("is_closed").notNull().default(true),
  closedBy: varchar("closed_by", { length: 255 }).notNull(), // User ID who closed the loan
  advancedOverride: boolean("advanced_override").default(false), // If interest was manually overridden
  interestVariance: decimal("interest_variance", { precision: 12, scale: 2 }).default("0"), // Difference between calculated vs actual
  varianceReason: text("variance_reason"), // Reason for interest variance
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.tenantId],
    references: [companies.tenantId],
  }),
  permissions: one(userPermissions, {
    fields: [users.id],
    references: [userPermissions.userId],
  }),
  activityLogs: many(userActivityLogs),
  createdBy: one(users, {
    fields: [users.createdBy],
    references: [users.id],
  }),
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userPermissions.userId],
    references: [users.id],
  }),
}));

export const userActivityLogsRelations = relations(userActivityLogs, ({ one }) => ({
  user: one(users, {
    fields: [userActivityLogs.userId],
    references: [users.id],
  }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  groups: many(groups),
  borrowers: many(borrowers),
  loans: many(loans),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  company: one(companies, {
    fields: [groups.tenantId],
    references: [companies.tenantId],
  }),
  borrowers: many(borrowers),
  loans: many(loans),
}));

export const borrowersRelations = relations(borrowers, ({ one, many }) => ({
  company: one(companies, {
    fields: [borrowers.tenantId],
    references: [companies.tenantId],
  }),
  group: one(groups, {
    fields: [borrowers.groupId],
    references: [groups.id],
  }),
  loans: many(loans),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  company: one(companies, {
    fields: [loans.tenantId],
    references: [companies.tenantId],
  }),
  borrower: one(borrowers, {
    fields: [loans.borrowerId],
    references: [borrowers.id],
  }),
  group: one(groups, {
    fields: [loans.groupId],
    references: [groups.id],
  }),
  transactions: many(transactions),
  closure: one(loanClosures, {
    fields: [loans.id],
    references: [loanClosures.loanId],
  }),
}));

// Cash Transaction tables
export const parties = pgTable("parties", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  name: text("name").notNull(),
  mobile: varchar("mobile", { length: 15 }),
  address: text("address"),
  // Account type classification
  accountType: varchar("account_type", { length: 30 }).notNull().default("supplier"), // supplier, customer, employee, asset, liability, income, expense, bank
  // Opening balance fields for proper accounting
  openingBalance: decimal("opening_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  openingBalanceType: varchar("opening_balance_type", { length: 10 }).notNull().default("credit"), // "debit" or "credit"
  openingBalanceDate: date("opening_balance_date").default(sql`current_date`),
  openingBalanceNarration: text("opening_balance_narration").default("Opening Balance"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const cashTransactions = pgTable("cash_transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 20 }).notNull(),
  transactionDate: date("transaction_date").notNull(),
  transactionType: varchar("transaction_type", { length: 20 }).notNull(), // cash_in, cash_out
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(), // capital, income, expense, other
  narration: text("narration"),
  partyId: uuid("party_id").references(() => parties.id),
  fromAccount: varchar("from_account", { length: 50 }), // Cash or Party ID (nullable for simple entries)
  toAccount: varchar("to_account", { length: 50 }), // Cash or Party ID (nullable for simple entries)  
  linkedTransactionId: uuid("linked_transaction_id"), // Will be set up after table creation
  isSystemGenerated: boolean("is_system_generated").default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Journal Entries table for dual-entry accounting
export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  journalNumber: varchar("journal_number").notNull(),
  transactionDate: date("transaction_date").notNull(),
  sourceType: varchar("source_type").notNull(), // cash_transaction, loan_disbursement, loan_closure, opening_balance
  sourceId: varchar("source_id"), // Link to original cash transaction
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  narration: text("narration"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Journal Entry Lines for dual-entry details
export const journalEntryLines = pgTable("journal_entry_lines", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type").notNull(), // debit or credit
  accountName: varchar("account_name").notNull(), // Display name for the account
  accountId: varchar("account_id"), // Party ID or null for cash
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // Transaction amount
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  accountType: varchar("account_type", { length: 20 }).notNull(), // cash, party, asset, liability, income, expense
  debitAmount: decimal("debit_amount", { precision: 12, scale: 2 }).default("0"),
  creditAmount: decimal("credit_amount", { precision: 12, scale: 2 }).default("0"),
  description: text("description"),
});

// Relations for cash transactions and journal entries
export const partiesRelations = relations(parties, ({ many }) => ({
  cashTransactions: many(cashTransactions),
  journalEntryLines: many(journalEntryLines),
}));

export const cashTransactionsRelations = relations(cashTransactions, ({ one }) => ({
  party: one(parties, {
    fields: [cashTransactions.partyId],
    references: [parties.id],
  }),
  linkedTransaction: one(cashTransactions, {
    fields: [cashTransactions.linkedTransactionId],
    references: [cashTransactions.id],
  }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ many }) => ({
  lines: many(journalEntryLines),
}));

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalEntryLines.journalEntryId],
    references: [journalEntries.id],
  }),
  party: one(parties, {
    fields: [journalEntryLines.accountId],
    references: [parties.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  loan: one(loans, {
    fields: [transactions.loanId],
    references: [loans.id],
  }),
}));

export const loanClosuresRelations = relations(loanClosures, ({ one }) => ({
  loan: one(loans, {
    fields: [loanClosures.loanId],
    references: [loans.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  loginCount: true,
});

export const insertUserPermissionsSchema = createInsertSchema(userPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBorrowerSchema = createInsertSchema(borrowers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanSchema = createInsertSchema(loans).omit({
  id: true,
  loanNumber: true, // Auto-generated
  createdAt: true,
  updatedAt: true,
}).extend({
  borrowerId: z.string().optional().nullable(), // Make borrowerId optional again for auto-create
  principalAmount: z.union([z.string(), z.number()]).transform(val => Number(val)),
  marketValue: z.union([z.string(), z.number()]).optional().transform(val => val ? Number(val) : undefined),
  interestRate: z.union([z.string(), z.number()]).transform(val => Number(val)),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertLoanClosureSchema = createInsertSchema(loanClosures).omit({
  id: true,
  createdAt: true,
}).extend({
  // Transform all numeric fields to handle string inputs from frontend
  principalPaid: z.union([z.string(), z.number()]).transform(val => Number(val)),
  interestPaid: z.union([z.string(), z.number()]).transform(val => Number(val)),
  totalAmount: z.union([z.string(), z.number()]).transform(val => Number(val)),
  calculatedInterest: z.union([z.string(), z.number()]).transform(val => Number(val)),
  actualPaidAmount: z.union([z.string(), z.number()]).transform(val => Number(val)),
  balanceRefund: z.union([z.string(), z.number()]).optional().transform(val => val ? Number(val) : 0),
  durationInMonths: z.union([z.string(), z.number()]).transform(val => Number(val)),
  interestVariance: z.union([z.string(), z.number()]).optional().transform(val => val ? Number(val) : 0),
  varianceReason: z.string().optional(),
});

export const insertPartySchema = createInsertSchema(parties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "नाव आवश्यक आहे").max(100, "नाव खूप मोठे आहे"),
  mobile: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  accountType: z.enum(["supplier", "customer", "employee", "asset", "liability", "income", "expense", "bank"]).default("supplier"),
  openingBalance: z.union([z.string(), z.number()]).optional().transform(val => val ? Number(val) : 0),
  openingBalanceType: z.enum(["debit", "credit"]).default("credit"),
  openingBalanceDate: z.string().optional().nullable(),
  openingBalanceNarration: z.string().optional().default("Opening Balance"),
});

export const insertCashTransactionSchema = createInsertSchema(cashTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Transform numeric fields to handle string inputs from frontend
  amount: z.union([z.string(), z.number()]).transform(val => Number(val)),
  // Make optional fields truly optional
  partyId: z.string().optional().nullable(),
  fromAccount: z.string().optional().nullable(),
  toAccount: z.string().optional().nullable(),
  linkedTransactionId: z.string().optional().nullable(),
  narration: z.string().optional().nullable(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({
  id: true,
  createdAt: true,
});

export const insertJournalEntryLineSchema = createInsertSchema(journalEntryLines).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserPermissions = typeof userPermissions.$inferSelect;
export type InsertUserPermissions = z.infer<typeof insertUserPermissionsSchema>;
export type UserActivityLog = typeof userActivityLogs.$inferSelect;
export type InsertUserActivityLog = z.infer<typeof insertUserActivityLogSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Borrower = typeof borrowers.$inferSelect;
export type InsertBorrower = z.infer<typeof insertBorrowerSchema>;
export type Loan = typeof loans.$inferSelect;
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type LoanClosure = typeof loanClosures.$inferSelect;
export type InsertLoanClosure = z.infer<typeof insertLoanClosureSchema>;
export type Party = typeof parties.$inferSelect;
export type InsertParty = z.infer<typeof insertPartySchema>;
export type CashTransaction = typeof cashTransactions.$inferSelect;
export type InsertCashTransaction = z.infer<typeof insertCashTransactionSchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type InsertJournalEntryLine = z.infer<typeof insertJournalEntryLineSchema>;

// Photo schema and types
export const insertLoanPhotoSchema = createInsertSchema(loanPhotos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LoanPhoto = typeof loanPhotos.$inferSelect & {
  url?: string; // Photo URL added by server API
  thumbnailUrl?: string; // Thumbnail URL added by server API  
};
export type InsertLoanPhoto = z.infer<typeof insertLoanPhotoSchema>;

// Storage settings schemas and types
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;

export const insertTenantStorageSettingSchema = createInsertSchema(tenantStorageSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TenantStorageSetting = typeof tenantStorageSettings.$inferSelect;
export type InsertTenantStorageSetting = z.infer<typeof insertTenantStorageSettingSchema>;
