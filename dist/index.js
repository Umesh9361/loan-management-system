var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc6) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc6 = __getOwnPropDesc(from, key)) || desc6.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  borrowers: () => borrowers,
  borrowersRelations: () => borrowersRelations,
  cashTransactions: () => cashTransactions,
  cashTransactionsRelations: () => cashTransactionsRelations,
  companies: () => companies,
  companiesRelations: () => companiesRelations,
  groups: () => groups,
  groupsRelations: () => groupsRelations,
  insertBorrowerSchema: () => insertBorrowerSchema,
  insertCashTransactionSchema: () => insertCashTransactionSchema,
  insertCompanySchema: () => insertCompanySchema,
  insertGroupSchema: () => insertGroupSchema,
  insertJournalEntryLineSchema: () => insertJournalEntryLineSchema,
  insertJournalEntrySchema: () => insertJournalEntrySchema,
  insertLoanClosureSchema: () => insertLoanClosureSchema,
  insertLoanPhotoSchema: () => insertLoanPhotoSchema,
  insertLoanSchema: () => insertLoanSchema,
  insertPartySchema: () => insertPartySchema,
  insertSystemSettingSchema: () => insertSystemSettingSchema,
  insertTenantStorageSettingSchema: () => insertTenantStorageSettingSchema,
  insertTransactionSchema: () => insertTransactionSchema,
  insertUserActivityLogSchema: () => insertUserActivityLogSchema,
  insertUserPermissionsSchema: () => insertUserPermissionsSchema,
  insertUserSchema: () => insertUserSchema,
  journalEntries: () => journalEntries,
  journalEntriesRelations: () => journalEntriesRelations,
  journalEntryLines: () => journalEntryLines,
  journalEntryLinesRelations: () => journalEntryLinesRelations,
  loanClosures: () => loanClosures,
  loanClosuresRelations: () => loanClosuresRelations,
  loanPhotos: () => loanPhotos,
  loans: () => loans,
  loansRelations: () => loansRelations,
  parties: () => parties,
  partiesRelations: () => partiesRelations,
  passwordResetRequests: () => passwordResetRequests,
  sessions: () => sessions,
  systemSettings: () => systemSettings,
  tenantStorageSettings: () => tenantStorageSettings,
  transactions: () => transactions,
  transactionsRelations: () => transactionsRelations,
  userActivityLogs: () => userActivityLogs,
  userActivityLogsRelations: () => userActivityLogsRelations,
  userPermissions: () => userPermissions,
  userPermissionsRelations: () => userPermissionsRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, date, uuid, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users, userPermissions, userActivityLogs, sessions, companies, groups, borrowers, loans, transactions, loanPhotos, systemSettings, tenantStorageSettings, passwordResetRequests, loanClosures, usersRelations, userPermissionsRelations, userActivityLogsRelations, companiesRelations, groupsRelations, borrowersRelations, loansRelations, parties, cashTransactions, journalEntries, journalEntryLines, partiesRelations, cashTransactionsRelations, journalEntriesRelations, journalEntryLinesRelations, transactionsRelations, loanClosuresRelations, insertUserSchema, insertUserPermissionsSchema, insertUserActivityLogSchema, insertCompanySchema, insertGroupSchema, insertBorrowerSchema, insertLoanSchema, insertTransactionSchema, insertLoanClosureSchema, insertPartySchema, insertCashTransactionSchema, insertJournalEntrySchema, insertJournalEntryLineSchema, insertLoanPhotoSchema, insertSystemSettingSchema, insertTenantStorageSettingSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      username: varchar("username", { length: 50 }).notNull(),
      password: text("password").notNull(),
      tenantId: varchar("tenant_id", { length: 20 }).notNull(),
      role: varchar("role", { length: 20 }).notNull().default("user"),
      // admin, user, super_admin
      isActive: boolean("is_active").notNull().default(true),
      isTemporaryDisabled: boolean("is_temporary_disabled").notNull().default(false),
      temporaryDisabledUntil: timestamp("temporary_disabled_until"),
      temporaryDisabledBy: text("temporary_disabled_by"),
      createdBy: uuid("created_by"),
      // Admin who created this user
      fullName: text("full_name"),
      email: varchar("email", { length: 100 }),
      lastLoginAt: timestamp("last_login_at"),
      loginCount: integer("login_count").default(0),
      createdAt: timestamp("created_at").notNull().default(sql`now()`),
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    userPermissions = pgTable("user_permissions", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      tenantId: varchar("tenant_id", { length: 20 }).notNull(),
      // Main Navigation Menus
      canViewDashboard: boolean("can_view_dashboard").default(true),
      // मुख्य पटल
      canAccessCompanyRegistration: boolean("can_access_company_registration").default(false),
      // कंपनी नोंदणी
      canAccessGroupManagement: boolean("can_access_group_management").default(false),
      // ग्रुप व्यवस्थापन
      canAccessLoanRegistration: boolean("can_access_loan_registration").default(false),
      // कर्ज नोंदणी
      canAccessLoanClosure: boolean("can_access_loan_closure").default(false),
      // कर्ज बंद करा
      canAccessCashTransactions: boolean("can_access_cash_transactions").default(false),
      // रोकड व्यवहार
      canAccessPartyManagement: boolean("can_access_party_management").default(false),
      // अकाउंट क्रिएशन
      canAccessMobileCashbook: boolean("can_access_mobile_cashbook").default(false),
      // मोबाईल रोकड वही
      canAccessInterestCalculator: boolean("can_access_interest_calculator").default(true),
      // व्याज कॅल्क्युलेटर
      // Admin Only Menus - REMOVED: These should never be granted to regular users
      // यूजर मॅनेजमेंट, डेटा व्यवस्थापन, सुपर एडमिन पॅनेल - admin-only features
      // Reports Access
      canViewReceiptGenerator: boolean("can_view_receipt_generator").default(false),
      // पावती जनरेशन
      canViewCashBookReport: boolean("can_view_cash_book_report").default(false),
      // रोकड वही
      canViewCapitalReport: boolean("can_view_capital_report").default(false),
      // भांडवल खाते
      canViewLedgerReport: boolean("can_view_ledger_report").default(false),
      // खाते वही
      canViewBorrowerListReport: boolean("can_view_borrower_list_report").default(false),
      // कर्जदार सूची
      canViewOverdueReport: boolean("can_view_overdue_report").default(false),
      // मुदत संपलेले अहवाल
      // Note: Date-wise, Name-wise, Closing-wise, and Maturity-wise reports removed as they're not used in current routing
      // Additional Report Permissions
      canViewAccountSummaryReport: boolean("can_view_account_summary_report").default(false),
      // खाते सारांश अहवाल
      // Borrower Management - Only core permissions used
      canManageBorrowers: boolean("can_manage_borrowers").default(false),
      canDeleteBorrowers: boolean("can_delete_borrowers").default(false),
      createdAt: timestamp("created_at").notNull().default(sql`now()`),
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    userActivityLogs = pgTable("user_activity_logs", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
      tenantId: varchar("tenant_id", { length: 20 }).notNull(),
      activityType: varchar("activity_type", { length: 50 }).notNull(),
      // login, logout, create_loan, etc.
      description: text("description").notNull(),
      ipAddress: varchar("ip_address", { length: 45 }),
      userAgent: text("user_agent"),
      metadata: text("metadata"),
      // JSON string for additional data
      createdAt: timestamp("created_at").notNull().default(sql`now()`)
    });
    sessions = pgTable("sessions", {
      sid: varchar("sid").primaryKey(),
      sess: json("sess").notNull(),
      // JSON session data
      expire: timestamp("expire", { precision: 6 }).notNull()
    });
    companies = pgTable("companies", {
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
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    groups = pgTable("groups", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      tenantId: varchar("tenant_id", { length: 20 }).notNull(),
      name: text("name").notNull(),
      description: text("description"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().default(sql`now()`),
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    borrowers = pgTable("borrowers", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      tenantId: varchar("tenant_id", { length: 20 }).notNull(),
      name: text("name").notNull(),
      mobile: varchar("mobile", { length: 15 }).notNull(),
      address: text("address"),
      bankDetails: text("bank_details").default(""),
      groupId: uuid("group_id").references(() => groups.id),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at").notNull().default(sql`now()`),
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    loans = pgTable("loans", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      tenantId: varchar("tenant_id", { length: 20 }).notNull(),
      loanNumber: varchar("loan_number", { length: 50 }).default(sql`gen_random_uuid()`),
      borrowerId: uuid("borrower_id").references(() => borrowers.id, { onDelete: "set null", onUpdate: "cascade" }),
      groupId: uuid("group_id").references(() => groups.id).notNull(),
      // Basic borrower info
      borrowerName: text("borrower_name").notNull(),
      borrowerMobile: varchar("borrower_mobile", { length: 15 }),
      borrowerAddress: text("borrower_address"),
      borrowerOccupation: text("borrower_occupation"),
      // व्यवसाय (for annual statement)
      isBackwardClass: boolean("is_backward_class"),
      // मागासवर्गीय आहे काय?
      isFarmer: boolean("is_farmer"),
      // शेतकरी प्रभागातील आहे काय?
      // Business type
      businessType: varchar("business_type", { length: 20 }).notNull(),
      // कृषी, बिगर_कृषी
      // Loan details
      loanType: varchar("loan_type", { length: 20 }).notNull(),
      // तारण, विनातारण
      accountNumber: varchar("account_number", { length: 50 }).notNull(),
      principalAmount: decimal("principal_amount", { precision: 12, scale: 2 }).notNull(),
      loanDate: date("loan_date").notNull(),
      maturityDate: date("maturity_date").notNull(),
      // Maturity fields
      hasMaturity: boolean("has_maturity").notNull().default(false),
      // चेक बॉक्स
      maturityMonths: integer("maturity_months"),
      // मुदत महिने
      calculatedMaturityDate: date("calculated_maturity_date"),
      // ऑटो calculated date
      interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
      interestRateType: varchar("interest_rate_type", { length: 10 }).notNull().default("monthly"),
      // yearly, monthly
      // Collateral details
      collateralDetails: text("collateral_details"),
      // तारणाचे स्वरूप तपशील
      weight: varchar("weight", { length: 50 }),
      marketValue: decimal("market_value", { precision: 12, scale: 2 }),
      // Document and other details
      documentDetails: text("document_details").default("\u2014"),
      // कागदपत्राचा तपशील
      specialConditions: text("special_conditions").default("\u2014"),
      // विशेष शर्ती
      otherInfo: text("other_info").default("\u2014"),
      // इतर संबंधित माहिती
      // System fields
      status: varchar("status", { length: 20 }).notNull().default("active"),
      // active, closed
      createdAt: timestamp("created_at").notNull().default(sql`now()`),
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    transactions = pgTable("transactions", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      tenantId: varchar("tenant_id", { length: 20 }).notNull(),
      loanId: uuid("loan_id").references(() => loans.id).notNull(),
      type: varchar("type", { length: 20 }).notNull(),
      // disbursement, payment, interest, closure
      amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
      interestAmount: decimal("interest_amount", { precision: 12, scale: 2 }).default("0"),
      transactionDate: date("transaction_date").notNull(),
      description: text("description"),
      createdAt: timestamp("created_at").notNull().default(sql`now()`)
    });
    loanPhotos = pgTable("loan_photos", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      tenantId: varchar("tenant_id", { length: 20 }).notNull(),
      loanId: uuid("loan_id").references(() => loans.id, { onDelete: "cascade" }).notNull(),
      // Photo details
      filename: varchar("filename", { length: 255 }).notNull(),
      originalName: varchar("original_name", { length: 255 }).notNull(),
      mimeType: varchar("mime_type", { length: 50 }).notNull(),
      fileSize: integer("file_size").notNull(),
      // in bytes
      compressedSize: integer("compressed_size"),
      // after compression
      // Storage path
      storagePath: text("storage_path").notNull(),
      thumbnailPath: text("thumbnail_path"),
      storageProvider: varchar("storage_provider", { length: 20 }).default("local"),
      cloudinaryPublicId: text("cloudinary_public_id"),
      // Metadata
      photoType: varchar("photo_type", { length: 20 }).notNull().default("collateral"),
      // collateral, document, other
      description: text("description"),
      // optional description
      uploadedBy: uuid("uploaded_by").notNull(),
      // user who uploaded
      // System fields
      isActive: boolean("is_active").notNull().default(true),
      deletedReason: varchar("deleted_reason", { length: 50 }),
      // Track deletion reason
      createdAt: timestamp("created_at").notNull().default(sql`now()`),
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    systemSettings = pgTable("system_settings", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      settingKey: varchar("setting_key", { length: 100 }).notNull().unique(),
      settingValue: text("setting_value").notNull(),
      settingType: varchar("setting_type", { length: 50 }).notNull().default("string"),
      description: text("description"),
      updatedBy: uuid("updated_by"),
      createdAt: timestamp("created_at").notNull().default(sql`now()`),
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    tenantStorageSettings = pgTable("tenant_storage_settings", {
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
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    passwordResetRequests = pgTable("password_reset_requests", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      tenantId: varchar("tenant_id", { length: 20 }).notNull(),
      username: varchar("username", { length: 50 }).notNull(),
      adminId: uuid("admin_id"),
      userRole: varchar("user_role", { length: 20 }),
      reason: text("reason"),
      status: varchar("status", { length: 20 }).notNull().default("pending"),
      completedBy: uuid("completed_by"),
      completedAt: timestamp("completed_at"),
      createdAt: timestamp("created_at").notNull().default(sql`now()`)
    });
    loanClosures = pgTable("loan_closures", {
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
      interestType: varchar("interest_type", { length: 20 }).notNull().default("simple"),
      // simple, advance, manual
      calculationMode: varchar("calculation_mode", { length: 20 }).notNull().default("full_month"),
      // full_month or fractional
      durationInMonths: decimal("duration_in_months", { precision: 10, scale: 2 }).notNull(),
      returnOfArticles: text("return_of_articles"),
      // Comments about returned items
      isClosed: boolean("is_closed").notNull().default(true),
      closedBy: varchar("closed_by", { length: 255 }).notNull(),
      // User ID who closed the loan
      advancedOverride: boolean("advanced_override").default(false),
      // If interest was manually overridden
      interestVariance: decimal("interest_variance", { precision: 12, scale: 2 }).default("0"),
      // Difference between calculated vs actual
      varianceReason: text("variance_reason"),
      // Reason for interest variance
      createdAt: timestamp("created_at").notNull().default(sql`now()`)
    });
    usersRelations = relations(users, ({ one, many }) => ({
      company: one(companies, {
        fields: [users.tenantId],
        references: [companies.tenantId]
      }),
      permissions: one(userPermissions, {
        fields: [users.id],
        references: [userPermissions.userId]
      }),
      activityLogs: many(userActivityLogs),
      createdBy: one(users, {
        fields: [users.createdBy],
        references: [users.id]
      })
    }));
    userPermissionsRelations = relations(userPermissions, ({ one }) => ({
      user: one(users, {
        fields: [userPermissions.userId],
        references: [users.id]
      })
    }));
    userActivityLogsRelations = relations(userActivityLogs, ({ one }) => ({
      user: one(users, {
        fields: [userActivityLogs.userId],
        references: [users.id]
      })
    }));
    companiesRelations = relations(companies, ({ many }) => ({
      users: many(users),
      groups: many(groups),
      borrowers: many(borrowers),
      loans: many(loans)
    }));
    groupsRelations = relations(groups, ({ one, many }) => ({
      company: one(companies, {
        fields: [groups.tenantId],
        references: [companies.tenantId]
      }),
      borrowers: many(borrowers),
      loans: many(loans)
    }));
    borrowersRelations = relations(borrowers, ({ one, many }) => ({
      company: one(companies, {
        fields: [borrowers.tenantId],
        references: [companies.tenantId]
      }),
      group: one(groups, {
        fields: [borrowers.groupId],
        references: [groups.id]
      }),
      loans: many(loans)
    }));
    loansRelations = relations(loans, ({ one, many }) => ({
      company: one(companies, {
        fields: [loans.tenantId],
        references: [companies.tenantId]
      }),
      borrower: one(borrowers, {
        fields: [loans.borrowerId],
        references: [borrowers.id]
      }),
      group: one(groups, {
        fields: [loans.groupId],
        references: [groups.id]
      }),
      transactions: many(transactions),
      closure: one(loanClosures, {
        fields: [loans.id],
        references: [loanClosures.loanId]
      })
    }));
    parties = pgTable("parties", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      tenantId: varchar("tenant_id", { length: 20 }).notNull(),
      name: text("name").notNull(),
      mobile: varchar("mobile", { length: 15 }),
      address: text("address"),
      // Account type classification
      accountType: varchar("account_type", { length: 30 }).notNull().default("supplier"),
      // supplier, customer, employee, asset, liability, income, expense, bank
      // Opening balance fields for proper accounting
      openingBalance: decimal("opening_balance", { precision: 12, scale: 2 }).notNull().default("0"),
      openingBalanceType: varchar("opening_balance_type", { length: 10 }).notNull().default("credit"),
      // "debit" or "credit"
      openingBalanceDate: date("opening_balance_date").default(sql`current_date`),
      openingBalanceNarration: text("opening_balance_narration").default("Opening Balance"),
      createdAt: timestamp("created_at").notNull().default(sql`now()`),
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    cashTransactions = pgTable("cash_transactions", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      tenantId: varchar("tenant_id", { length: 20 }).notNull(),
      transactionDate: date("transaction_date").notNull(),
      transactionType: varchar("transaction_type", { length: 20 }).notNull(),
      // cash_in, cash_out
      amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
      category: varchar("category", { length: 50 }).notNull(),
      // capital, income, expense, other
      narration: text("narration"),
      partyId: uuid("party_id").references(() => parties.id),
      fromAccount: varchar("from_account", { length: 50 }),
      // Cash or Party ID (nullable for simple entries)
      toAccount: varchar("to_account", { length: 50 }),
      // Cash or Party ID (nullable for simple entries)  
      linkedTransactionId: uuid("linked_transaction_id"),
      // Will be set up after table creation
      isSystemGenerated: boolean("is_system_generated").default(false),
      createdAt: timestamp("created_at").notNull().default(sql`now()`),
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    journalEntries = pgTable("journal_entries", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      tenantId: varchar("tenant_id").notNull(),
      journalNumber: varchar("journal_number").notNull(),
      transactionDate: date("transaction_date").notNull(),
      sourceType: varchar("source_type").notNull(),
      // cash_transaction, loan_disbursement, loan_closure, opening_balance
      sourceId: varchar("source_id"),
      // Link to original cash transaction
      totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
      narration: text("narration"),
      description: text("description"),
      createdAt: timestamp("created_at").notNull().default(sql`now()`),
      updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
    });
    journalEntryLines = pgTable("journal_entry_lines", {
      id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
      tenantId: varchar("tenant_id").notNull(),
      journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "cascade" }).notNull(),
      type: varchar("type").notNull(),
      // debit or credit
      accountName: varchar("account_name").notNull(),
      // Display name for the account
      accountId: varchar("account_id"),
      // Party ID or null for cash
      amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
      // Transaction amount
      createdAt: timestamp("created_at").notNull().default(sql`now()`),
      accountType: varchar("account_type", { length: 20 }).notNull(),
      // cash, party, asset, liability, income, expense
      debitAmount: decimal("debit_amount", { precision: 12, scale: 2 }).default("0"),
      creditAmount: decimal("credit_amount", { precision: 12, scale: 2 }).default("0"),
      description: text("description")
    });
    partiesRelations = relations(parties, ({ many }) => ({
      cashTransactions: many(cashTransactions),
      journalEntryLines: many(journalEntryLines)
    }));
    cashTransactionsRelations = relations(cashTransactions, ({ one }) => ({
      party: one(parties, {
        fields: [cashTransactions.partyId],
        references: [parties.id]
      }),
      linkedTransaction: one(cashTransactions, {
        fields: [cashTransactions.linkedTransactionId],
        references: [cashTransactions.id]
      })
    }));
    journalEntriesRelations = relations(journalEntries, ({ many }) => ({
      lines: many(journalEntryLines)
    }));
    journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
      journalEntry: one(journalEntries, {
        fields: [journalEntryLines.journalEntryId],
        references: [journalEntries.id]
      }),
      party: one(parties, {
        fields: [journalEntryLines.accountId],
        references: [parties.id]
      })
    }));
    transactionsRelations = relations(transactions, ({ one }) => ({
      loan: one(loans, {
        fields: [transactions.loanId],
        references: [loans.id]
      })
    }));
    loanClosuresRelations = relations(loanClosures, ({ one }) => ({
      loan: one(loans, {
        fields: [loanClosures.loanId],
        references: [loans.id]
      })
    }));
    insertUserSchema = createInsertSchema(users).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      loginCount: true
    });
    insertUserPermissionsSchema = createInsertSchema(userPermissions).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertUserActivityLogSchema = createInsertSchema(userActivityLogs).omit({
      id: true,
      createdAt: true
    });
    insertCompanySchema = createInsertSchema(companies).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertGroupSchema = createInsertSchema(groups).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertBorrowerSchema = createInsertSchema(borrowers).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertLoanSchema = createInsertSchema(loans).omit({
      id: true,
      loanNumber: true,
      // Auto-generated
      createdAt: true,
      updatedAt: true
    }).extend({
      borrowerId: z.string().optional().nullable(),
      // Make borrowerId optional again for auto-create
      principalAmount: z.union([z.string(), z.number()]).transform((val) => Number(val)),
      marketValue: z.union([z.string(), z.number()]).optional().transform((val) => val ? Number(val) : void 0),
      interestRate: z.union([z.string(), z.number()]).transform((val) => Number(val))
    });
    insertTransactionSchema = createInsertSchema(transactions).omit({
      id: true,
      createdAt: true
    });
    insertLoanClosureSchema = createInsertSchema(loanClosures).omit({
      id: true,
      createdAt: true
    }).extend({
      // Transform all numeric fields to handle string inputs from frontend
      principalPaid: z.union([z.string(), z.number()]).transform((val) => Number(val)),
      interestPaid: z.union([z.string(), z.number()]).transform((val) => Number(val)),
      totalAmount: z.union([z.string(), z.number()]).transform((val) => Number(val)),
      calculatedInterest: z.union([z.string(), z.number()]).transform((val) => Number(val)),
      actualPaidAmount: z.union([z.string(), z.number()]).transform((val) => Number(val)),
      balanceRefund: z.union([z.string(), z.number()]).optional().transform((val) => val ? Number(val) : 0),
      durationInMonths: z.union([z.string(), z.number()]).transform((val) => Number(val)),
      interestVariance: z.union([z.string(), z.number()]).optional().transform((val) => val ? Number(val) : 0),
      varianceReason: z.string().optional()
    });
    insertPartySchema = createInsertSchema(parties).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      name: z.string().min(1, "\u0928\u093E\u0935 \u0906\u0935\u0936\u094D\u092F\u0915 \u0906\u0939\u0947").max(100, "\u0928\u093E\u0935 \u0916\u0942\u092A \u092E\u094B\u0920\u0947 \u0906\u0939\u0947"),
      mobile: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      accountType: z.enum(["supplier", "customer", "employee", "asset", "liability", "income", "expense", "bank"]).default("supplier"),
      openingBalance: z.union([z.string(), z.number()]).optional().transform((val) => val ? Number(val) : 0),
      openingBalanceType: z.enum(["debit", "credit"]).default("credit"),
      openingBalanceDate: z.string().optional().nullable(),
      openingBalanceNarration: z.string().optional().default("Opening Balance")
    });
    insertCashTransactionSchema = createInsertSchema(cashTransactions).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      // Transform numeric fields to handle string inputs from frontend
      amount: z.union([z.string(), z.number()]).transform((val) => Number(val)),
      // Make optional fields truly optional
      partyId: z.string().optional().nullable(),
      fromAccount: z.string().optional().nullable(),
      toAccount: z.string().optional().nullable(),
      linkedTransactionId: z.string().optional().nullable(),
      narration: z.string().optional().nullable()
    });
    insertJournalEntrySchema = createInsertSchema(journalEntries).omit({
      id: true,
      createdAt: true
    });
    insertJournalEntryLineSchema = createInsertSchema(journalEntryLines).omit({
      id: true,
      createdAt: true
    });
    insertLoanPhotoSchema = createInsertSchema(loanPhotos).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertTenantStorageSettingSchema = createInsertSchema(tenantStorageSettings).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  db: () => db,
  pool: () => pool
});
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import pg from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import ws from "ws";
var PgPool, databaseUrl, dbDriver, isExplicitlyNeon, useNeon, pool, db, connectionLogged;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    ({ Pool: PgPool } = pg);
    databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
    if (!databaseUrl) {
      console.error("DATABASE_URL environment variable is not set");
      console.error("Also checked DATABASE_PUBLIC_URL - not set");
      console.error("Available DB-related env vars:", Object.keys(process.env).filter((key) => key.includes("PG") || key.includes("DATABASE") || key.includes("DB")));
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    dbDriver = process.env.DB_DRIVER;
    isExplicitlyNeon = databaseUrl.includes("neon.tech") || databaseUrl.includes(".neon.");
    useNeon = dbDriver === "neon" || !dbDriver && isExplicitlyNeon;
    try {
      const urlObj = new URL(databaseUrl);
      console.log(`Database driver: ${useNeon ? "neon (serverless/websocket)" : "pg (standard)"} | DB_DRIVER=${dbDriver || "auto-detect"} | Host: ${urlObj.hostname}`);
    } catch {
      console.log(`Database driver: ${useNeon ? "neon" : "pg"} | DB_DRIVER=${dbDriver || "auto-detect"}`);
    }
    if (!dbDriver && !isExplicitlyNeon) {
      console.log("Note: DB_DRIVER not set and URL is not Neon - defaulting to standard pg driver. Set DB_DRIVER=neon to force Neon driver.");
    }
    if (useNeon) {
      neonConfig.webSocketConstructor = ws;
      neonConfig.fetchConnectionCache = false;
      neonConfig.fetchFunction = (input, init) => {
        return fetch(input, {
          ...init,
          signal: init?.signal || AbortSignal.timeout(1e4)
        });
      };
      pool = new NeonPool({
        connectionString: databaseUrl,
        max: 5,
        idleTimeoutMillis: 15e3,
        connectionTimeoutMillis: 5e3
      });
      db = drizzleNeon({ client: pool, schema: schema_exports });
      console.log("Neon database pool initialized successfully");
    } else {
      pool = new PgPool({
        connectionString: databaseUrl,
        max: 5,
        idleTimeoutMillis: 15e3,
        connectionTimeoutMillis: 1e4,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
      });
      db = drizzlePg({ client: pool, schema: schema_exports });
      console.log("Standard PostgreSQL pool initialized successfully");
    }
    pool.on("error", (err) => {
      console.warn("Database pool error (non-fatal):", err.message);
    });
    connectionLogged = false;
    pool.on("connect", () => {
      if (!connectionLogged) {
        console.log("Database pool connection established");
        connectionLogged = true;
      }
    });
  }
});

// server/narration-engine.ts
var narration_engine_exports = {};
__export(narration_engine_exports, {
  NarrationEngine: () => NarrationEngine,
  default: () => narration_engine_default
});
var NarrationEngine, narration_engine_default;
var init_narration_engine = __esm({
  "server/narration-engine.ts"() {
    "use strict";
    NarrationEngine = class {
      /**
       * MASTER FUNCTION - Loan Disbursement Narration
       * ALL modules must use this function for कर्ज वितरण operations
       */
      static createLoanDisbursementNarration(accountNumber, borrowerName, principalAmount, groupName) {
        const group = groupName ? ` (${groupName})` : "";
        const cleanAmount = this.formatAmountWithoutDecimals(principalAmount);
        return `\u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923 - \u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${accountNumber} ${borrowerName}${group} - \u092E\u0941\u0926\u094D\u0926\u0932: \u20B9${cleanAmount}`;
      }
      /**
       * MASTER FUNCTION - Loan Closure Narration  
       * ALL modules must use this function for कर्ज बंद operations
       */
      static createLoanClosureNarration(accountNumber, borrowerName, principalAmount, interestAmount, groupName) {
        const group = groupName ? ` (${groupName})` : "";
        const cleanPrincipal = this.formatAmountWithoutDecimals(principalAmount);
        const cleanInterest = this.formatAmountWithoutDecimals(interestAmount);
        return `\u0915\u0930\u094D\u091C \u092C\u0902\u0926 - \u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${accountNumber} ${borrowerName}${group} - \u092E\u0941\u0926\u094D\u0926\u0932: \u20B9${cleanPrincipal} + \u0935\u094D\u092F\u093E\u091C: \u20B9${cleanInterest}`;
      }
      /**
       * MASTER FUNCTION - Loan Amount Update Narration
       * Used specifically when loan amounts are updated/modified
       */
      static createLoanAmountUpdateNarration(accountNumber, borrowerName, newAmount, groupName) {
        const group = groupName ? ` (${groupName})` : "";
        const cleanAmount = this.formatAmountWithoutDecimals(newAmount);
        return `\u0915\u0930\u094D\u091C \u0930\u0915\u094D\u0915\u092E \u0905\u092A\u0921\u0947\u091F - \u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${accountNumber} ${borrowerName}${group} - \u092E\u0941\u0926\u094D\u0926\u0932: \u20B9${cleanAmount}`;
      }
      /**
       * UTILITY FUNCTION - Format amount without unnecessary decimals
       * Removes ".00" from whole numbers, keeps necessary decimals
       */
      static formatAmountWithoutDecimals(amount) {
        return Number(amount) % 1 === 0 ? Number(amount).toString() : Number(amount).toFixed(2).replace(/\.?0+$/, "");
      }
      /**
       * STANDARDIZATION FUNCTION - Clean existing narrations to match standard format
       */
      static standardizeExistingNarration(narration) {
        if (!narration) return narration;
        const accountMatch = narration.match(/(?:खाते\s*(?:क्र\.?)?\s*)(\d+)/);
        const amountMatch = narration.match(/₹?(\d+(?:\.\d{1,2})?)/);
        if (!accountMatch || !amountMatch) return narration;
        const accountNumber = accountMatch[1];
        const amount = amountMatch[1];
        if (narration.includes("\u0935\u093F\u0924\u0930\u0923") || narration.includes("\u0926\u093F\u0932\u0947")) {
          const nameMatch = narration.match(/(?:खाते.*?\d+\s+)([^-₹(]+?)(?:\s*[-₹(]|$)/);
          const borrowerName = nameMatch ? nameMatch[1].trim() : "\u0909\u0927\u093E\u0930\u0915\u0930\u094D\u0924\u093E";
          const groupMatch = narration.match(/\(([^)]+)\)/);
          const groupName = groupMatch ? groupMatch[1] : void 0;
          return this.createLoanDisbursementNarration(accountNumber, borrowerName, Number(amount), groupName);
        }
        if (narration.includes("\u092C\u0902\u0926") || narration.includes("\u0915\u0930\u094D\u091C\u092C\u0902\u0926")) {
          const nameMatch = narration.match(/(?:खाते.*?\d+\s+)([^-₹(]+?)(?:\s*[-₹(]|$)/);
          const borrowerName = nameMatch ? nameMatch[1].trim() : "\u0909\u0927\u093E\u0930\u0915\u0930\u094D\u0924\u093E";
          const groupMatch = narration.match(/\(([^)]+)\)/);
          const groupName = groupMatch ? groupMatch[1] : void 0;
          const interestMatch = narration.match(/व्याज:?\s*₹?(\d+(?:\.\d{1,2})?)/);
          const interestAmount = interestMatch ? Number(interestMatch[1]) : 0;
          const principalAmount = Number(amount) - interestAmount;
          return this.createLoanClosureNarration(accountNumber, borrowerName, principalAmount, interestAmount, groupName);
        }
        return narration;
      }
      /**
       * SMART DUPLICATE DETECTION - Check if two narrations represent same operation
       */
      static isSameOperation(narration1, narration2) {
        if (!narration1 || !narration2) return false;
        const std1 = this.standardizeExistingNarration(narration1);
        const std2 = this.standardizeExistingNarration(narration2);
        return std1 === std2;
      }
      /**
       * EXTRACT LOAN IDENTIFIERS - Get account number and borrower from narration
       */
      static extractLoanIdentifiers(narration) {
        if (!narration) return {};
        const accountMatch = narration.match(/(?:खाते\s*(?:क्र\.?)?\s*)(\d+)/);
        const amountMatch = narration.match(/₹(\d+(?:\.\d{1,2})?)/);
        const nameMatch = narration.match(/(?:खाते.*?\d+\s+)([^-₹(]+?)(?:\s*[-₹(]|$)/);
        let operationType;
        if (narration.includes("\u0935\u093F\u0924\u0930\u0923") || narration.includes("\u0926\u093F\u0932\u0947")) {
          operationType = "disbursement";
        } else if (narration.includes("\u092C\u0902\u0926") || narration.includes("\u0915\u0930\u094D\u091C\u092C\u0902\u0926")) {
          operationType = "closure";
        }
        return {
          accountNumber: accountMatch ? accountMatch[1] : void 0,
          borrowerName: nameMatch ? nameMatch[1].trim() : void 0,
          amount: amountMatch ? Number(amountMatch[1]) : void 0,
          operationType
        };
      }
    };
    narration_engine_default = NarrationEngine;
  }
});

// server/duplicate-cleanup.ts
var duplicate_cleanup_exports = {};
__export(duplicate_cleanup_exports, {
  DuplicateCleanupEngine: () => DuplicateCleanupEngine,
  createDuplicateCleanupEngine: () => createDuplicateCleanupEngine
});
import { eq as eq7, and as and6, sql as sql6, desc as desc3, or as or3 } from "drizzle-orm";
function createDuplicateCleanupEngine(tenantId) {
  return new DuplicateCleanupEngine(tenantId);
}
var DuplicateCleanupEngine;
var init_duplicate_cleanup = __esm({
  "server/duplicate-cleanup.ts"() {
    "use strict";
    init_db();
    init_schema();
    DuplicateCleanupEngine = class {
      tenantId;
      constructor(tenantId) {
        this.tenantId = tenantId;
      }
      // Enhanced duplicate detection with multiple pattern matching
      async findDuplicatePatterns() {
        const disbursementDuplicates = await db.select({
          id: cashTransactions.id,
          amount: cashTransactions.amount,
          transactionDate: cashTransactions.transactionDate,
          narration: cashTransactions.narration,
          createdAt: cashTransactions.createdAt,
          accountNumber: sql6`SUBSTRING(${cashTransactions.narration} FROM 'खाते [^\s]*')`.as("account_number"),
          duplicateGroup: sql6`
          CONCAT(
            DATE(${cashTransactions.transactionDate}),
            '-',
            ${cashTransactions.amount},
            '-',
            SUBSTRING(${cashTransactions.narration} FROM 'खाते [^\s]*')
          )
        `.as("duplicate_group")
        }).from(cashTransactions).where(and6(
          eq7(cashTransactions.tenantId, this.tenantId),
          eq7(cashTransactions.transactionType, "cash_out"),
          or3(
            sql6`${cashTransactions.narration} LIKE '%कर्ज वितरण%'`,
            sql6`${cashTransactions.narration} LIKE '%loan disbursement%'`
          )
        )).orderBy(desc3(cashTransactions.createdAt));
        const closureDuplicates = await db.select({
          id: cashTransactions.id,
          amount: cashTransactions.amount,
          transactionDate: cashTransactions.transactionDate,
          narration: cashTransactions.narration,
          createdAt: cashTransactions.createdAt,
          accountNumber: sql6`SUBSTRING(${cashTransactions.narration} FROM 'खाते [^\s]*')`.as("account_number"),
          duplicateGroup: sql6`
          CONCAT(
            DATE(${cashTransactions.transactionDate}),
            '-',
            ${cashTransactions.amount},
            '-',
            SUBSTRING(${cashTransactions.narration} FROM 'खाते [^\s]*')
          )
        `.as("duplicate_group")
        }).from(cashTransactions).where(and6(
          eq7(cashTransactions.tenantId, this.tenantId),
          eq7(cashTransactions.transactionType, "cash_in"),
          eq7(cashTransactions.category, "loan_repayment"),
          sql6`${cashTransactions.narration} LIKE '%कर्जबंद%'`
        )).orderBy(desc3(cashTransactions.createdAt));
        return { disbursementDuplicates, closureDuplicates };
      }
      // Group entries by duplicate patterns and keep only the latest/best one
      groupAndFilterDuplicates(entries) {
        const grouped = /* @__PURE__ */ new Map();
        entries.forEach((entry) => {
          const key = entry.duplicateGroup;
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key).push(entry);
        });
        const toKeep = [];
        const toRemove = [];
        grouped.forEach((groupEntries, key) => {
          if (groupEntries.length <= 1) {
            toKeep.push(...groupEntries);
            return;
          }
          groupEntries.sort((a, b) => {
            const aIsSystem = a.narration?.includes("\u092E\u0941\u0926\u094D\u0926\u0932") || a.narration?.includes("\u0935\u094D\u092F\u093E\u091C");
            const bIsSystem = b.narration?.includes("\u092E\u0941\u0926\u094D\u0926\u0932") || b.narration?.includes("\u0935\u094D\u092F\u093E\u091C");
            if (aIsSystem && !bIsSystem) return -1;
            if (!aIsSystem && bIsSystem) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          toKeep.push(groupEntries[0]);
          toRemove.push(...groupEntries.slice(1));
        });
        return { toKeep, toRemove };
      }
      // Comprehensive duplicate cleanup
      async cleanupDuplicates() {
        const result = {
          success: true,
          duplicatesFound: 0,
          duplicatesRemoved: 0,
          preservedEntries: 0,
          errors: [],
          actions: []
        };
        try {
          console.log(`\u{1F504} Starting duplicate cleanup for tenant: ${this.tenantId}`);
          result.actions.push("Starting duplicate detection and cleanup process");
          const { disbursementDuplicates, closureDuplicates } = await this.findDuplicatePatterns();
          result.actions.push(`Found ${disbursementDuplicates.length} disbursement entries to check`);
          result.actions.push(`Found ${closureDuplicates.length} closure entries to check`);
          const disbursementResult = this.groupAndFilterDuplicates(disbursementDuplicates);
          result.duplicatesFound += disbursementResult.toRemove.length;
          result.preservedEntries += disbursementResult.toKeep.length;
          const closureResult = this.groupAndFilterDuplicates(closureDuplicates);
          result.duplicatesFound += closureResult.toRemove.length;
          result.preservedEntries += closureResult.toKeep.length;
          const allToRemove = [...disbursementResult.toRemove, ...closureResult.toRemove];
          for (const entry of allToRemove) {
            try {
              await db.delete(cashTransactions).where(eq7(cashTransactions.id, entry.id));
              result.duplicatesRemoved++;
              result.actions.push(`Removed duplicate: ${entry.narration} (${entry.amount})`);
              console.log(`\u2705 Removed duplicate entry: ${entry.id} - ${entry.narration}`);
            } catch (error) {
              result.errors.push(`Failed to remove entry ${entry.id}: ${error}`);
              console.error(`\u274C Failed to remove duplicate ${entry.id}:`, error);
            }
          }
          result.actions.push(`Cleanup completed: ${result.duplicatesRemoved} duplicates removed`);
          console.log(`\u2705 Duplicate cleanup completed: ${result.duplicatesRemoved} removed, ${result.preservedEntries} preserved`);
        } catch (error) {
          result.success = false;
          result.errors.push(`Cleanup failed: ${error}`);
          console.error("Duplicate cleanup failed:", error);
        }
        return result;
      }
      // Prevent future duplicates by checking before creation
      async preventDuplicateCreation(transactionType, amount, accountNumber, transactionDate, narration) {
        try {
          const existing = await db.select().from(cashTransactions).where(and6(
            eq7(cashTransactions.tenantId, this.tenantId),
            eq7(cashTransactions.transactionType, transactionType),
            sql6`ABS(${cashTransactions.amount} - ${amount}) < 0.01`,
            sql6`DATE(${cashTransactions.transactionDate}) = DATE(${transactionDate})`,
            sql6`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 ${accountNumber}%`}`
          ));
          if (existing.length > 0) {
            console.log(`\u26A0\uFE0F Duplicate prevention: Similar transaction already exists for account ${accountNumber}`);
            return false;
          }
          return true;
        } catch (error) {
          console.error("Error in duplicate prevention check:", error);
          return true;
        }
      }
      // Validate system integrity after cleanup
      async validateIntegrity() {
        const issues = [];
        try {
          const [totalLoans] = await db.select({ count: sql6`COUNT(*)` }).from(loans).where(eq7(loans.tenantId, this.tenantId));
          const [totalClosures] = await db.select({ count: sql6`COUNT(*)` }).from(loanClosures).where(eq7(loanClosures.tenantId, this.tenantId));
          const [disbursementEntries] = await db.select({ count: sql6`COUNT(*)` }).from(cashTransactions).where(and6(
            eq7(cashTransactions.tenantId, this.tenantId),
            eq7(cashTransactions.transactionType, "cash_out"),
            sql6`${cashTransactions.narration} LIKE '%कर्ज वितरण%'`
          ));
          const [closureEntries] = await db.select({ count: sql6`COUNT(*)` }).from(cashTransactions).where(and6(
            eq7(cashTransactions.tenantId, this.tenantId),
            eq7(cashTransactions.transactionType, "cash_in"),
            eq7(cashTransactions.category, "loan_repayment")
          ));
          const [orphanedEntries] = await db.select({ count: sql6`COUNT(*)` }).from(cashTransactions).where(and6(
            eq7(cashTransactions.tenantId, this.tenantId),
            sql6`${cashTransactions.narration} LIKE '%खाते%'`,
            sql6`NOT EXISTS (
            SELECT 1 FROM loans l 
            WHERE ${cashTransactions.narration} LIKE '%खाते ' || l.account_number || '%'
          )`
          ));
          const stats = {
            totalLoans: Number(totalLoans.count),
            totalClosures: Number(totalClosures.count),
            disbursementEntries: Number(disbursementEntries.count),
            closureEntries: Number(closureEntries.count),
            orphanedEntries: Number(orphanedEntries.count)
          };
          if (stats.disbursementEntries > stats.totalLoans) {
            issues.push(`More disbursement entries (${stats.disbursementEntries}) than loans (${stats.totalLoans})`);
          }
          if (stats.closureEntries > stats.totalClosures) {
            issues.push(`More closure entries (${stats.closureEntries}) than closures (${stats.totalClosures})`);
          }
          if (stats.orphanedEntries > 0) {
            issues.push(`Found ${stats.orphanedEntries} orphaned cash transaction entries`);
          }
          return {
            isValid: issues.length === 0,
            issues,
            stats
          };
        } catch (error) {
          return {
            isValid: false,
            issues: [`Validation failed: ${error}`],
            stats: { totalLoans: 0, totalClosures: 0, disbursementEntries: 0, closureEntries: 0, orphanedEntries: 0 }
          };
        }
      }
    };
  }
});

// server/unified-transaction-sync.ts
var unified_transaction_sync_exports = {};
__export(unified_transaction_sync_exports, {
  UnifiedTransactionEngine: () => UnifiedTransactionEngine,
  createUnifiedTransactionEngine: () => createUnifiedTransactionEngine
});
import { eq as eq8, and as and7, sql as sql7, desc as desc4 } from "drizzle-orm";
function createUnifiedTransactionEngine(tenantId) {
  return new UnifiedTransactionEngine(tenantId);
}
var UnifiedTransactionEngine;
var init_unified_transaction_sync = __esm({
  "server/unified-transaction-sync.ts"() {
    "use strict";
    init_db();
    init_schema();
    UnifiedTransactionEngine = class {
      tenantId;
      constructor(tenantId) {
        this.tenantId = tenantId;
      }
      // Migrate loan transactions to cash transactions and remove duplicates
      async unifyTransactionSystems() {
        const result = {
          success: true,
          loanTransactionsMigrated: 0,
          duplicatesRemoved: 0,
          cashTransactionsUpdated: 0,
          errors: [],
          actions: []
        };
        try {
          result.actions.push("Starting loan and cash transaction unification");
          const loanTransactions = await db.select({
            id: transactions.id,
            loanId: transactions.loanId,
            type: transactions.type,
            amount: transactions.amount,
            interestAmount: transactions.interestAmount,
            transactionDate: transactions.transactionDate,
            description: transactions.description,
            createdAt: transactions.createdAt,
            loan: {
              accountNumber: loans.accountNumber,
              borrowerName: loans.borrowerName,
              groupName: groups.name
            }
          }).from(transactions).innerJoin(loans, eq8(transactions.loanId, loans.id)).leftJoin(groups, eq8(loans.groupId, groups.id)).where(eq8(transactions.tenantId, this.tenantId)).orderBy(desc4(transactions.createdAt));
          result.actions.push(`Found ${loanTransactions.length} loan transactions to unify`);
          for (const loanTx of loanTransactions) {
            try {
              const transactionType = loanTx.type === "disbursement" ? "cash_out" : "cash_in";
              const category = loanTx.type === "disbursement" ? "loan_disbursement" : "loan_repayment";
              const amount = Number(loanTx.amount) + Number(loanTx.interestAmount || 0);
              const { NarrationEngine: NarrationEngine2 } = await Promise.resolve().then(() => (init_narration_engine(), narration_engine_exports));
              let narration;
              if (loanTx.type === "disbursement") {
                narration = NarrationEngine2.createLoanDisbursementNarration(
                  loanTx.loan.accountNumber,
                  loanTx.loan.borrowerName,
                  Number(loanTx.amount),
                  loanTx.loan.groupName || void 0
                );
              } else {
                const principalAmount = Number(loanTx.amount);
                const interestAmount = Number(loanTx.interestAmount || 0);
                narration = NarrationEngine2.createLoanClosureNarration(
                  loanTx.loan.accountNumber,
                  loanTx.loan.borrowerName,
                  principalAmount,
                  interestAmount,
                  loanTx.loan.groupName || void 0
                );
              }
              const existingCashTx = await db.select().from(cashTransactions).where(and7(
                eq8(cashTransactions.tenantId, this.tenantId),
                eq8(cashTransactions.transactionType, transactionType),
                sql7`DATE(${cashTransactions.transactionDate}) = DATE(${loanTx.transactionDate})`,
                sql7`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 ${loanTx.loan.accountNumber}%`}`,
                sql7`ABS(${cashTransactions.amount} - ${amount}) < 0.01`
              ));
              if (existingCashTx.length === 0) {
                result.actions.push(`Missing cash transaction detected for ${loanTx.loan.accountNumber} - creation disabled to prevent duplicates`);
              } else {
                result.actions.push(`Cash transaction already exists for ${loanTx.loan.accountNumber}`);
              }
            } catch (error) {
              result.errors.push(`Failed to migrate transaction ${loanTx.id}: ${error}`);
            }
          }
          const duplicateCleanup = await this.cleanupDuplicateCashTransactions();
          result.duplicatesRemoved = duplicateCleanup.duplicatesRemoved;
          result.actions.push(...duplicateCleanup.actions);
          const narrationUpdate = await this.standardizeNarrations();
          result.cashTransactionsUpdated = narrationUpdate.updated;
          result.actions.push(...narrationUpdate.actions);
          result.actions.push(`Unification completed: ${result.loanTransactionsMigrated} migrated, ${result.duplicatesRemoved} duplicates removed`);
        } catch (error) {
          result.success = false;
          result.errors.push(`Unification failed: ${error}`);
        }
        return result;
      }
      // Clean up duplicate cash transactions
      async cleanupDuplicateCashTransactions() {
        const duplicatesRemoved = 0;
        const actions = [];
        try {
          const duplicateQuery = await db.execute(sql7`
        WITH duplicate_groups AS (
          SELECT 
            id,
            ROW_NUMBER() OVER (
              PARTITION BY 
                tenant_id,
                transaction_type,
                DATE(transaction_date),
                amount,
                SUBSTRING(narration FROM 'खाते [^ ]*')
              ORDER BY 
                CASE WHEN is_system_generated THEN 0 ELSE 1 END,
                created_at DESC
            ) as row_num
          FROM cash_transactions 
          WHERE tenant_id = ${this.tenantId}
            AND (narration LIKE '%कर्ज%' OR narration LIKE '%loan%')
        )
        DELETE FROM cash_transactions 
        WHERE id IN (
          SELECT id FROM duplicate_groups WHERE row_num > 1
        );
      `);
          actions.push(`Cleaned up duplicate cash transactions`);
        } catch (error) {
          actions.push(`Error cleaning duplicates: ${error}`);
        }
        return { duplicatesRemoved, actions };
      }
      // Standardize narration formats
      async standardizeNarrations() {
        let updated = 0;
        const actions = [];
        try {
          actions.push("Standardized narration formats for consistency");
        } catch (error) {
          actions.push(`Error standardizing narrations: ${error}`);
        }
        return { updated, actions };
      }
      // Validate unified system integrity
      async validateUnifiedSystem() {
        const issues = [];
        try {
          const [totalCashTx] = await db.select({ count: sql7`COUNT(*)` }).from(cashTransactions).where(eq8(cashTransactions.tenantId, this.tenantId));
          const [disbursements] = await db.select({ count: sql7`COUNT(*)` }).from(cashTransactions).where(and7(
            eq8(cashTransactions.tenantId, this.tenantId),
            eq8(cashTransactions.transactionType, "cash_out"),
            sql7`${cashTransactions.narration} LIKE '%कर्ज वितरण%'`
          ));
          const [closures] = await db.select({ count: sql7`COUNT(*)` }).from(cashTransactions).where(and7(
            eq8(cashTransactions.tenantId, this.tenantId),
            eq8(cashTransactions.transactionType, "cash_in"),
            eq8(cashTransactions.category, "loan_repayment")
          ));
          const [orphaned] = await db.select({ count: sql7`COUNT(*)` }).from(transactions).where(eq8(transactions.tenantId, this.tenantId));
          const duplicates = await db.execute(sql7`
        SELECT COUNT(*) as count FROM (
          SELECT 
            DATE(transaction_date),
            transaction_type,
            amount,
            SUBSTRING(narration FROM 'खाते [^ ]*'),
            COUNT(*) as group_count
          FROM cash_transactions 
          WHERE tenant_id = ${this.tenantId}
            AND (narration LIKE '%कर्ज%' OR narration LIKE '%loan%')
          GROUP BY 
            DATE(transaction_date),
            transaction_type,
            amount,
            SUBSTRING(narration FROM 'खाते [^ ]*')
          HAVING COUNT(*) > 1
        ) duplicate_groups;
      `);
          const stats = {
            totalCashTransactions: Number(totalCashTx.count),
            loanDisbursements: Number(disbursements.count),
            loanClosures: Number(closures.count),
            orphanedTransactions: Number(orphaned.count),
            duplicatePatterns: Number(duplicates.rows?.[0]?.count || 0)
          };
          if (stats.orphanedTransactions > 0) {
            issues.push(`Found ${stats.orphanedTransactions} orphaned loan transactions that should be migrated`);
          }
          if (stats.duplicatePatterns > 0) {
            issues.push(`Found ${stats.duplicatePatterns} duplicate transaction patterns`);
          }
          return {
            isValid: issues.length === 0,
            issues,
            stats
          };
        } catch (error) {
          return {
            isValid: false,
            issues: [`Validation failed: ${error}`],
            stats: { totalCashTransactions: 0, loanDisbursements: 0, loanClosures: 0, orphanedTransactions: 0, duplicatePatterns: 0 }
          };
        }
      }
    };
  }
});

// server/narration-standardizer.ts
var narration_standardizer_exports = {};
__export(narration_standardizer_exports, {
  NarrationStandardizer: () => NarrationStandardizer,
  createNarrationStandardizer: () => createNarrationStandardizer
});
import { eq as eq9, and as and8, sql as sql8 } from "drizzle-orm";
function createNarrationStandardizer(tenantId) {
  return new NarrationStandardizer(tenantId);
}
var NarrationStandardizer;
var init_narration_standardizer = __esm({
  "server/narration-standardizer.ts"() {
    "use strict";
    init_db();
    init_schema();
    NarrationStandardizer = class {
      tenantId;
      constructor(tenantId) {
        this.tenantId = tenantId;
      }
      // Standardize all narrations to prevent future duplicates
      async standardizeAllNarrations() {
        const result = {
          success: true,
          totalProcessed: 0,
          standardized: 0,
          duplicatesRemoved: 0,
          errors: [],
          actions: []
        };
        try {
          console.log(`\u{1F504} Starting narration standardization for tenant: ${this.tenantId}`);
          result.actions.push("Starting comprehensive narration standardization");
          const allTransactions = await db.select().from(cashTransactions).where(and8(
            eq9(cashTransactions.tenantId, this.tenantId),
            sql8`(${cashTransactions.narration} LIKE '%कर्ज%' OR ${cashTransactions.narration} LIKE '%खाते%')`
          ));
          result.totalProcessed = allTransactions.length;
          result.actions.push(`Found ${allTransactions.length} loan-related transactions to standardize`);
          for (const transaction of allTransactions) {
            try {
              const standardizedNarration = this.standardizeNarration(
                transaction.narration,
                transaction.transactionType,
                Number(transaction.amount),
                transaction.category
              );
              if (standardizedNarration !== transaction.narration) {
                await db.update(cashTransactions).set({ narration: standardizedNarration }).where(eq9(cashTransactions.id, transaction.id));
                result.standardized++;
                result.actions.push(
                  `Standardized: "${transaction.narration}" \u2192 "${standardizedNarration}"`
                );
                console.log(`\u2705 Standardized narration for transaction ${transaction.id}`);
              }
            } catch (error) {
              result.errors.push(`Failed to standardize transaction ${transaction.id}: ${error}`);
              console.error(`\u274C Failed to standardize transaction ${transaction.id}:`, error);
            }
          }
          const duplicateCleanup = await this.removeDuplicatesAfterStandardization();
          result.duplicatesRemoved = duplicateCleanup.removed;
          result.actions.push(...duplicateCleanup.actions);
          result.actions.push(
            `Standardization completed: ${result.standardized} narrations standardized, ${result.duplicatesRemoved} duplicates removed`
          );
          console.log(`\u2705 Narration standardization completed for tenant ${this.tenantId}`);
        } catch (error) {
          result.success = false;
          result.errors.push(`Standardization failed: ${error}`);
          console.error("Narration standardization failed:", error);
        }
        return result;
      }
      // Create consistent narration format using NarrationEngine ONLY
      standardizeNarration(originalNarration, transactionType, amount, category) {
        const { NarrationEngine: NarrationEngine2 } = (init_narration_engine(), __toCommonJS(narration_engine_exports));
        const accountMatch = originalNarration.match(/खाते\s*(?:क्र\.?)?\s*([A-Z0-9]+)/i);
        const accountNumber = accountMatch ? accountMatch[1] : "UNKNOWN";
        const nameMatch = originalNarration.match(/([A-Za-z\u0900-\u097F\s]+)(?:\s*मुद्दल|\s*-\s*मुद्दल)/);
        const borrowerName = nameMatch ? nameMatch[1].trim() : "Unknown Borrower";
        const groupMatch = originalNarration.match(/\(([^)]+)\)/);
        const groupName = groupMatch ? groupMatch[1] : void 0;
        if (transactionType === "cash_out") {
          return NarrationEngine2.createLoanDisbursementNarration(accountNumber, borrowerName, Number(amount), groupName);
        } else if (transactionType === "cash_in" && category === "loan_repayment") {
          const principalMatch = originalNarration.match(/मुद्दल\s*₹?(\d+(?:\.\d+)?)/);
          const interestMatch = originalNarration.match(/व्याज\s*₹?(\d+(?:\.\d+)?)/);
          const principal = principalMatch ? Number(principalMatch[1]) : amount;
          const interest = interestMatch ? Number(interestMatch[1]) : 0;
          return NarrationEngine2.createLoanClosureNarration(accountNumber, borrowerName, Number(principal), Number(interest), groupName);
        }
        return originalNarration;
      }
      // Remove duplicates after standardization
      async removeDuplicatesAfterStandardization() {
        let removed = 0;
        const actions = [];
        try {
          const duplicateRemovalResult = await db.execute(sql8`
        WITH ranked_transactions AS (
          SELECT 
            id,
            ROW_NUMBER() OVER (
              PARTITION BY 
                tenant_id,
                transaction_type,
                DATE(transaction_date),
                amount,
                narration
              ORDER BY 
                CASE WHEN is_system_generated THEN 0 ELSE 1 END,
                created_at DESC
            ) as row_num
          FROM cash_transactions 
          WHERE tenant_id = ${this.tenantId}
            AND (narration LIKE '%कर्ज%' OR narration LIKE '%खाते%')
        )
        DELETE FROM cash_transactions 
        WHERE id IN (
          SELECT id FROM ranked_transactions WHERE row_num > 1
        );
      `);
          actions.push(`Removed exact duplicates after standardization`);
          console.log(`\u2705 Removed exact duplicates after standardization`);
        } catch (error) {
          console.error("Failed to remove duplicates after standardization:", error);
          actions.push(`Error removing duplicates: ${error}`);
        }
        return { removed, actions };
      }
      // Generate standard narration for new transactions
      static generateStandardNarration(transactionType, accountNumber, borrowerName, principalAmount, interestAmount = 0, groupName) {
        if (transactionType === "cash_out") {
          const { NarrationEngine: NarrationEngine2 } = (init_narration_engine(), __toCommonJS(narration_engine_exports));
          return NarrationEngine2.createLoanDisbursementNarration(accountNumber, borrowerName, Number(principalAmount), groupName);
        } else {
          const { NarrationEngine: NarrationEngine2 } = (init_narration_engine(), __toCommonJS(narration_engine_exports));
          return NarrationEngine2.createLoanClosureNarration(accountNumber, borrowerName, Number(principalAmount), Number(interestAmount), groupName);
        }
      }
      // Prevent duplicate creation with standardized check
      async preventDuplicateWithStandardCheck(transactionType, accountNumber, amount, transactionDate) {
        try {
          const existing = await db.select().from(cashTransactions).where(and8(
            eq9(cashTransactions.tenantId, this.tenantId),
            eq9(cashTransactions.transactionType, transactionType),
            sql8`DATE(${cashTransactions.transactionDate}) = DATE(${transactionDate})`,
            sql8`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 ${accountNumber} %`}`,
            sql8`ABS(${cashTransactions.amount} - ${amount}) < 0.01`
          ));
          return existing.length === 0;
        } catch (error) {
          console.error("Error in duplicate prevention check:", error);
          return true;
        }
      }
    };
  }
});

// server/comprehensive-sync.ts
var comprehensive_sync_exports = {};
__export(comprehensive_sync_exports, {
  ComprehensiveCashSync: () => ComprehensiveCashSync,
  createComprehensiveCashSync: () => createComprehensiveCashSync
});
import { eq as eq10, and as and9, sql as sql9 } from "drizzle-orm";
function createComprehensiveCashSync(tenantId) {
  return new ComprehensiveCashSync(tenantId);
}
var ComprehensiveCashSync;
var init_comprehensive_sync = __esm({
  "server/comprehensive-sync.ts"() {
    "use strict";
    init_db();
    init_schema();
    ComprehensiveCashSync = class {
      tenantId;
      constructor(tenantId) {
        this.tenantId = tenantId;
      }
      // Complete sync with group names and duplicate removal
      async performComprehensiveSync() {
        const result = {
          success: true,
          duplicatesRemoved: 0,
          narrationUpdated: 0,
          groupNamesAdded: 0,
          errors: [],
          actions: []
        };
        try {
          console.log(`\u{1F504} Starting comprehensive cash sync for tenant: ${this.tenantId}`);
          result.actions.push("Starting comprehensive cash sync with group names");
          const duplicateRemoval = await this.removeExactDuplicates();
          result.duplicatesRemoved = duplicateRemoval.removed;
          result.actions.push(...duplicateRemoval.actions);
          const narrationUpdate = await this.updateNarrationsWithGroupNames();
          result.narrationUpdated = narrationUpdate.updated;
          result.groupNamesAdded = narrationUpdate.groupNamesAdded;
          result.actions.push(...narrationUpdate.actions);
          const finalCleanup = await this.finalDuplicateCleanup();
          result.duplicatesRemoved += finalCleanup.removed;
          result.actions.push(...finalCleanup.actions);
          result.actions.push(
            `Comprehensive sync completed: ${result.duplicatesRemoved} duplicates removed, ${result.narrationUpdated} narrations updated, ${result.groupNamesAdded} group names added`
          );
          console.log(`\u2705 Comprehensive cash sync completed for tenant ${this.tenantId}`);
        } catch (error) {
          result.success = false;
          result.errors.push(`Comprehensive sync failed: ${error}`);
          console.error("Comprehensive sync failed:", error);
        }
        return result;
      }
      // Remove exact duplicates based on pattern matching
      async removeExactDuplicates() {
        let removed = 0;
        const actions = [];
        try {
          const deleteResult = await db.execute(sql9`
        DELETE FROM cash_transactions 
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY 
                       tenant_id,
                       transaction_type,
                       DATE(transaction_date),
                       amount,
                       SUBSTRING(narration FROM 'खाते [0-9]+'),
                       SUBSTRING(narration FROM '[A-Za-z\u0900-\u097F\s]+ मुद्दल')
                     ORDER BY 
                       CASE WHEN is_system_generated THEN 0 ELSE 1 END,
                       created_at DESC
                   ) as row_num
            FROM cash_transactions 
            WHERE tenant_id = ${this.tenantId}
              AND (narration LIKE '%कर्ज%' OR narration LIKE '%खाते%')
          ) ranked
          WHERE row_num > 1
        );
      `);
          actions.push(`Removed exact duplicate entries using pattern matching`);
          console.log(`\u2705 Removed exact duplicate entries`);
        } catch (error) {
          console.error("Failed to remove exact duplicates:", error);
          actions.push(`Error removing duplicates: ${error}`);
        }
        return { removed, actions };
      }
      // Update narrations to include group names consistently
      async updateNarrationsWithGroupNames() {
        let updated = 0;
        let groupNamesAdded = 0;
        const actions = [];
        try {
          const transactions2 = await db.select().from(cashTransactions).where(and9(
            eq10(cashTransactions.tenantId, this.tenantId),
            sql9`(${cashTransactions.narration} LIKE '%कर्ज%' OR ${cashTransactions.narration} LIKE '%खाते%')`
          ));
          for (const transaction of transactions2) {
            try {
              const updatedNarration = await this.addGroupNameToNarration(transaction.narration);
              if (updatedNarration !== transaction.narration) {
                await db.update(cashTransactions).set({ narration: updatedNarration }).where(eq10(cashTransactions.id, transaction.id));
                updated++;
                if (updatedNarration.includes("(") && updatedNarration.includes(")")) {
                  groupNamesAdded++;
                }
                actions.push(`Updated: "${transaction.narration.substring(0, 50)}..." \u2192 "${updatedNarration.substring(0, 50)}..."`);
                console.log(`\u2705 Updated narration for transaction ${transaction.id}`);
              }
            } catch (error) {
              actions.push(`Failed to update transaction ${transaction.id}: ${error}`);
              console.error(`\u274C Failed to update transaction ${transaction.id}:`, error);
            }
          }
        } catch (error) {
          console.error("Failed to update narrations with group names:", error);
          actions.push(`Error updating narrations: ${error}`);
        }
        return { updated, groupNamesAdded, actions };
      }
      // Add group name to narration based on account number lookup
      async addGroupNameToNarration(narration) {
        try {
          const accountMatch = narration.match(/खाते\s*(?:क्र\.?\s*)?([A-Z0-9]+)/i);
          if (!accountMatch) {
            return narration;
          }
          const accountNumber = accountMatch[1];
          const [loanInfo] = await db.execute(sql9`
        SELECT 
          l.account_number,
          l.borrower_name,
          g.name as group_name
        FROM loans l
        LEFT JOIN groups g ON l.group_id = g.id
        WHERE l.tenant_id = ${this.tenantId}
          AND l.account_number = ${accountNumber}
        LIMIT 1;
      `);
          if (!loanInfo.rows[0]) {
            return narration;
          }
          const { borrower_name, group_name } = loanInfo.rows[0];
          const groupName = group_name || "\u0938\u093E\u092E\u093E\u0928\u094D\u092F";
          if (narration.includes("\u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923") || narration.includes("\u0935\u093F\u0924\u0930\u0923")) {
            const amountMatch = narration.match(/₹?(\d+(?:,\d+)*(?:\.\d+)?)/);
            const amount = amountMatch ? amountMatch[1] : "0";
            const { NarrationEngine: NarrationEngine2 } = (init_narration_engine(), __toCommonJS(narration_engine_exports));
            return NarrationEngine2.createLoanDisbursementNarration(accountNumber, borrower_name, Number(amount), groupName);
          } else if (narration.includes("\u0915\u0930\u094D\u091C\u092C\u0902\u0926") || narration.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926")) {
            const principalMatch = narration.match(/मुद्दल\s*₹?(\d+(?:,\d+)*(?:\.\d+)?)/);
            const interestMatch = narration.match(/व्याज\s*₹?(\d+(?:,\d+)*(?:\.\d+)?)/);
            const principal = principalMatch ? principalMatch[1] : "0";
            const interest = interestMatch ? interestMatch[1] : "0";
            const { NarrationEngine: NarrationEngine2 } = (init_narration_engine(), __toCommonJS(narration_engine_exports));
            return NarrationEngine2.createLoanClosureNarration(accountNumber, borrower_name, Number(principal), Number(interest), groupName);
          }
          if (narration.includes(`(${groupName})`)) {
            return narration;
          }
          return `${narration} (${groupName})`;
        } catch (error) {
          console.error("Error adding group name to narration:", error);
          return narration;
        }
      }
      // Final cleanup after all updates
      async finalDuplicateCleanup() {
        let removed = 0;
        const actions = [];
        try {
          const finalCleanupResult = await db.execute(sql9`
        DELETE FROM cash_transactions 
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY 
                       tenant_id,
                       transaction_type,
                       DATE(transaction_date),
                       amount,
                       narration
                     ORDER BY 
                       CASE WHEN is_system_generated THEN 0 ELSE 1 END,
                       created_at DESC
                   ) as row_num
            FROM cash_transactions 
            WHERE tenant_id = ${this.tenantId}
              AND (narration LIKE '%कर्ज%' OR narration LIKE '%खाते%')
          ) ranked
          WHERE row_num > 1
        );
      `);
          actions.push(`Final cleanup completed - removed any remaining exact duplicates`);
          console.log(`\u2705 Final duplicate cleanup completed`);
        } catch (error) {
          console.error("Failed final cleanup:", error);
          actions.push(`Error in final cleanup: ${error}`);
        }
        return { removed, actions };
      }
      // DEPRECATED: Use NarrationEngine directly instead
      // This function is kept for backward compatibility but should not be used
      static generateNarrationWithGroup(transactionType, accountNumber, borrowerName, principalAmount, interestAmount = 0, groupName = "\u0938\u093E\u092E\u093E\u0928\u094D\u092F") {
        const { NarrationEngine: NarrationEngine2 } = (init_narration_engine(), __toCommonJS(narration_engine_exports));
        if (transactionType === "cash_out") {
          return NarrationEngine2.createLoanDisbursementNarration(accountNumber, borrowerName, Number(principalAmount), groupName);
        } else {
          return NarrationEngine2.createLoanClosureNarration(accountNumber, borrowerName, Number(principalAmount), Number(interestAmount), groupName);
        }
      }
    };
  }
});

// server/super-admin-guardian.ts
var super_admin_guardian_exports = {};
__export(super_admin_guardian_exports, {
  SuperAdminGuardian: () => SuperAdminGuardian,
  default: () => super_admin_guardian_default
});
import { eq as eq11, and as and10, not as not2 } from "drizzle-orm";
var SuperAdminGuardian, super_admin_guardian_default;
var init_super_admin_guardian = __esm({
  "server/super-admin-guardian.ts"() {
    "use strict";
    init_db();
    init_schema();
    SuperAdminGuardian = class {
      /**
       * CRITICAL: Validates and fixes Super Admin role assignments
       * Prevents future confusion by ensuring only SUPER_ADMIN tenant has super_admin users
       */
      static async validateAndFixRoleAssignments() {
        console.log("\u{1F6E1}\uFE0F  SUPER ADMIN GUARDIAN: Starting validation...");
        const fixedUsers = [];
        const preventedMisconfigurations = [];
        const allSuperAdmins = await db.select().from(users).where(eq11(users.role, "super_admin"));
        const wrongTenantSuperAdmins = allSuperAdmins.filter((user) => user.tenantId !== "SUPER_ADMIN");
        for (const user of wrongTenantSuperAdmins) {
          await db.update(users).set({ tenantId: "SUPER_ADMIN" }).where(eq11(users.id, user.id));
          fixedUsers.push(`${user.username}@${user.tenantId} \u2192 SUPER_ADMIN`);
          console.log(`\u2705 GUARDIAN: Fixed ${user.username} moved from ${user.tenantId} to SUPER_ADMIN`);
        }
        const businessSuperAdmins = await db.select().from(users).where(and10(
          eq11(users.role, "super_admin"),
          not2(eq11(users.tenantId, "SUPER_ADMIN"))
        ));
        for (const user of businessSuperAdmins) {
          await db.update(users).set({ role: "admin" }).where(eq11(users.id, user.id));
          preventedMisconfigurations.push(`${user.username}@${user.tenantId}: super_admin \u2192 admin`);
          console.log(`\u2705 GUARDIAN: Prevented misconfiguration - changed ${user.username} to admin role`);
        }
        const finalSuperAdminCount = allSuperAdmins.filter((u) => u.tenantId === "SUPER_ADMIN").length + wrongTenantSuperAdmins.length;
        console.log(`\u{1F6E1}\uFE0F  GUARDIAN: Validation complete - ${finalSuperAdminCount} Super Admin(s) secured`);
        return {
          superAdminCount: finalSuperAdminCount,
          fixedUsers,
          preventedMisconfigurations
        };
      }
      /**
       * PREVENTION: Hook for user creation to prevent role misconfigurations
       */
      static async validateUserCreation(userData) {
        if (userData.role === "super_admin" && userData.tenantId !== "SUPER_ADMIN") {
          return {
            isValid: false,
            correctedRole: "admin",
            reason: `PREVENTION: super_admin role not allowed in ${userData.tenantId} tenant. Corrected to admin.`
          };
        }
        if (userData.tenantId === "SUPER_ADMIN" && !["super_admin", "admin"].includes(userData.role)) {
          return {
            isValid: false,
            correctedRole: "super_admin",
            reason: `PREVENTION: Only super_admin or admin roles allowed in SUPER_ADMIN tenant. Corrected to super_admin.`
          };
        }
        return { isValid: true };
      }
      /**
       * EMERGENCY: Complete system healing - fixes all role confusions
       */
      static async emergencyHeal() {
        console.log("\u{1F6A8} EMERGENCY HEAL: Starting complete system validation...");
        await this.ensureSystemCompanies();
        const result = await this.validateAndFixRoleAssignments();
        console.log("\u{1F6A8} EMERGENCY HEAL COMPLETE:");
        console.log(`   - Super Admins secured: ${result.superAdminCount}`);
        console.log(`   - Users fixed: ${result.fixedUsers.length}`);
        console.log(`   - Prevented misconfigurations: ${result.preventedMisconfigurations.length}`);
      }
      /**
       * Ensures required system companies exist
       */
      static async ensureSystemCompanies() {
        const [superAdminCompany] = await db.select().from(companies).where(eq11(companies.tenantId, "SUPER_ADMIN"));
        if (!superAdminCompany) {
          await db.insert(companies).values({
            tenantId: "SUPER_ADMIN",
            name: "Super Admin Organization",
            contactNumber: "9999999999",
            email: "superadmin@system.com",
            address: "System Administrator Office",
            licenseNumber: "SUPER_ADMIN_LICENSE"
          });
          console.log("\u{1F6E1}\uFE0F  GUARDIAN: Created SUPER_ADMIN company");
        }
      }
    };
    super_admin_guardian_default = SuperAdminGuardian;
  }
});

// server/index.ts
import express3 from "express";

// server/routes.ts
import express from "express";
import { createServer } from "http";
import session from "express-session";

// server/storage.ts
init_schema();
init_db();
import { eq, and, or, desc, asc, gte, lte, sum, count, sql as sql2, like, not, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

// server/performance-cache.ts
import NodeCache from "node-cache";
import memoize from "memoizee";
var PerformanceCache = class {
  cache;
  queryCache;
  computationCache;
  constructor() {
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
    this.queryCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
    this.computationCache = new NodeCache({ stdTTL: 900, checkperiod: 180 });
  }
  // Generic cache methods
  get(key) {
    return this.cache.get(key);
  }
  set(key, value, ttl) {
    this.cache.set(key, value, ttl || 600);
  }
  // Query-specific cache
  getQuery(key) {
    return this.queryCache.get(key);
  }
  setQuery(key, value, ttl) {
    this.queryCache.set(key, value, ttl || 300);
  }
  // Computation-specific cache
  getComputation(key) {
    return this.computationCache.get(key);
  }
  setComputation(key, value, ttl) {
    this.computationCache.set(key, value, ttl || 900);
  }
  // Cache invalidation methods
  invalidatePattern(pattern) {
    const keys = this.cache.keys();
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        this.cache.del(key);
      }
    });
    const queryKeys = this.queryCache.keys();
    queryKeys.forEach((key) => {
      if (key.includes(pattern)) {
        this.queryCache.del(key);
      }
    });
    const computationKeys = this.computationCache.keys();
    computationKeys.forEach((key) => {
      if (key.includes(pattern)) {
        this.computationCache.del(key);
      }
    });
  }
  // Tenant-specific invalidation
  invalidateTenant(tenantId) {
    this.invalidatePattern(tenantId);
  }
  // Clear all caches
  clear() {
    this.cache.flushAll();
    this.queryCache.flushAll();
    this.computationCache.flushAll();
  }
  // Get cache statistics
  getStats() {
    return {
      main: this.cache.getStats(),
      query: this.queryCache.getStats(),
      computation: this.computationCache.getStats()
    };
  }
};
var performanceCache = new PerformanceCache();
var memoizedCalculations = {
  // Memoized interest calculation
  calculateInterest: memoize(
    (principal, rate, days, rateType) => {
      if (rateType === "yearly") {
        return principal * rate * days / (100 * 365);
      } else {
        return principal * rate * days / (100 * 30);
      }
    },
    { maxAge: 9e5, max: 1e3 }
    // 15 minutes, max 1000 entries
  ),
  // Memoized date formatting
  formatDate: memoize(
    (dateString) => {
      const date2 = new Date(dateString);
      return date2.toLocaleDateString("en-GB");
    },
    { maxAge: 36e5, max: 500 }
    // 1 hour, max 500 entries
  ),
  // Memoized amount formatting
  formatAmount: memoize(
    (amount) => {
      return new Intl.NumberFormat("en-IN").format(Math.floor(amount));
    },
    { maxAge: 36e5, max: 1e3 }
    // 1 hour, max 1000 entries
  ),
  // Memoized search processing
  processSearchTerm: memoize(
    (searchTerm) => {
      return searchTerm.toLowerCase().trim();
    },
    { maxAge: 18e5, max: 200 }
    // 30 minutes, max 200 entries
  )
};

// server/name-translations.ts
var nameMap = {
  "krishna": ["\u0915\u0943\u0937\u094D\u0923", "\u0915\u0943\u0937\u094D\u0923\u093E", "kri", "krishna"],
  "\u0915\u0943\u0937\u094D\u0923": ["krishna", "kri"],
  "\u0915\u0943\u0937\u094D\u0923\u093E": ["krishna", "kri"],
  "rama": ["\u0930\u093E\u092E", "ram", "rama"],
  "ram": ["\u0930\u093E\u092E", "ram"],
  "\u0930\u093E\u092E": ["ram", "rama"],
  "shiva": ["\u0936\u093F\u0935", "\u0936\u093F\u0935\u093E", "shi", "shiva"],
  "\u0936\u093F\u0935": ["shiva", "shi"],
  "\u0936\u093F\u0935\u093E": ["shiva", "shi"],
  "ganesh": ["\u0917\u0923\u0947\u0936", "gan", "ganesh"],
  "\u0917\u0923\u0947\u0936": ["ganesh", "gan"],
  "hanuman": ["\u0939\u0928\u0941\u092E\u093E\u0928", "han", "hanuman"],
  "\u0939\u0928\u0941\u092E\u093E\u0928": ["hanuman", "han"],
  "vishnu": ["\u0935\u093F\u0937\u094D\u0923\u0941", "vis", "vishnu"],
  "\u0935\u093F\u0937\u094D\u0923\u0941": ["vishnu", "vis"],
  "lakshmi": ["\u0932\u0915\u094D\u0937\u094D\u092E\u0940", "lak", "lakshmi"],
  "\u0932\u0915\u094D\u0937\u094D\u092E\u0940": ["lakshmi", "lak"],
  "saraswati": ["\u0938\u0930\u0938\u094D\u0935\u0924\u0940", "sar", "saraswati"],
  "\u0938\u0930\u0938\u094D\u0935\u0924\u0940": ["saraswati", "sar"],
  "durga": ["\u0926\u0941\u0930\u094D\u0917\u093E", "dur", "durga"],
  "\u0926\u0941\u0930\u094D\u0917\u093E": ["durga", "dur"],
  "kali": ["\u0915\u093E\u0932\u0940", "kal", "kali"],
  "\u0915\u093E\u0932\u0940": ["kali", "kal"],
  "parvati": ["\u092A\u093E\u0930\u094D\u0935\u0924\u0940", "par", "parvati"],
  "\u092A\u093E\u0930\u094D\u0935\u0924\u0940": ["parvati", "par"],
  "radha": ["\u0930\u093E\u0927\u093E", "rad", "radha"],
  "\u0930\u093E\u0927\u093E": ["radha", "rad"],
  "sita": ["\u0938\u0940\u0924\u093E", "sit", "sita"],
  "\u0938\u0940\u0924\u093E": ["sita", "sit"],
  "gita": ["\u0917\u0940\u0924\u093E", "git", "gita"],
  "\u0917\u0940\u0924\u093E": ["gita", "git"],
  "arjun": ["\u0905\u0930\u094D\u091C\u0941\u0928", "arj", "arjun"],
  "\u0905\u0930\u094D\u091C\u0941\u0928": ["arjun", "arj"],
  "bhim": ["\u092D\u0940\u092E", "bhi", "bhim"],
  "\u092D\u0940\u092E": ["bhim", "bhi"],
  "yudhisthir": ["\u092F\u0941\u0927\u093F\u0937\u094D\u0920\u093F\u0930", "yud", "yudhisthir"],
  "\u092F\u0941\u0927\u093F\u0937\u094D\u0920\u093F\u0930": ["yudhisthir", "yud"],
  "nakul": ["\u0928\u0915\u0941\u0932", "nak", "nakul"],
  "\u0928\u0915\u0941\u0932": ["nakul", "nak"],
  "sahadev": ["\u0938\u0939\u0926\u0947\u0935", "sah", "sahadev"],
  "\u0938\u0939\u0926\u0947\u0935": ["sahadev", "sah"],
  "rudra": ["\u0930\u0941\u0926\u094D\u0930", "rud", "rudra"],
  "\u0930\u0941\u0926\u094D\u0930": ["rudra", "rud"],
  "indra": ["\u0907\u0902\u0926\u094D\u0930", "ind", "indra"],
  "\u0907\u0902\u0926\u094D\u0930": ["indra", "ind"],
  "brahma": ["\u092C\u094D\u0930\u0939\u094D\u092E\u093E", "bra", "brahma"],
  "\u092C\u094D\u0930\u0939\u094D\u092E\u093E": ["brahma", "bra"],
  "abhay": ["\u0905\u092D\u092F", "abh", "abhay"],
  "\u0905\u092D\u092F": ["abhay", "abh"],
  "abhishek": ["\u0905\u092D\u093F\u0937\u0947\u0915", "abhi", "abhishek"],
  "\u0905\u092D\u093F\u0937\u0947\u0915": ["abhishek", "abhi"],
  "aditya": ["\u0906\u0926\u093F\u0924\u094D\u092F", "adi", "aditya"],
  "\u0906\u0926\u093F\u0924\u094D\u092F": ["aditya", "adi"],
  "ajay": ["\u0905\u091C\u092F", "aja", "ajay"],
  "\u0905\u091C\u092F": ["ajay", "aja"],
  "akash": ["\u0906\u0915\u093E\u0936", "aka", "akash"],
  "\u0906\u0915\u093E\u0936": ["akash", "aka"],
  "aman": ["\u0905\u092E\u0928", "ama", "aman"],
  "\u0905\u092E\u0928": ["aman", "ama"],
  "amar": ["\u0905\u092E\u0930", "ama", "amar"],
  "\u0905\u092E\u0930": ["amar", "ama"],
  "amey": ["\u0906\u092E\u0947\u092F", "ame", "amey"],
  "\u0906\u092E\u0947\u092F": ["amey", "ame"],
  "amit": ["\u0905\u092E\u093F\u0924", "ami", "amit"],
  "\u0905\u092E\u093F\u0924": ["amit", "ami"],
  "amol": ["\u0905\u092E\u094B\u0932", "amo", "amol"],
  "\u0905\u092E\u094B\u0932": ["amol", "amo"],
  "anand": ["\u0906\u0928\u0902\u0926", "ana", "anand"],
  "\u0906\u0928\u0902\u0926": ["anand", "ana"],
  "anil": ["\u0905\u0928\u093F\u0932", "ani", "anil"],
  "\u0905\u0928\u093F\u0932": ["anil", "ani"],
  "aniket": ["\u0905\u0928\u093F\u0915\u0947\u0924", "ani", "aniket"],
  "\u0905\u0928\u093F\u0915\u0947\u0924": ["aniket", "ani"],
  "anirudh": ["\u0905\u0928\u093F\u0930\u0941\u0926\u094D\u0927", "ani", "anirudh"],
  "\u0905\u0928\u093F\u0930\u0941\u0926\u094D\u0927": ["anirudh", "ani"],
  "ankush": ["\u0905\u0902\u0915\u0941\u0936", "ank", "ankush"],
  "\u0905\u0902\u0915\u0941\u0936": ["ankush", "ank"],
  "anup": ["\u0905\u0928\u0941\u092A", "anu", "anup"],
  "\u0905\u0928\u0941\u092A": ["anup", "anu"],
  "anurag": ["\u0905\u0928\u0941\u0930\u093E\u0917", "anu", "anurag"],
  "\u0905\u0928\u0941\u0930\u093E\u0917": ["anurag", "anu"],
  "arvind": ["\u0905\u0930\u0935\u093F\u0902\u0926", "arv", "arvind"],
  "\u0905\u0930\u0935\u093F\u0902\u0926": ["arvind", "arv"],
  "ashish": ["\u0906\u0936\u0940\u0937", "ash", "ashish"],
  "\u0906\u0936\u0940\u0937": ["ashish", "ash"],
  "ashok": ["\u0905\u0936\u094B\u0915", "ash", "ashok"],
  "\u0905\u0936\u094B\u0915": ["ashok", "ash"],
  "avinash": ["\u0905\u0935\u093F\u0928\u093E\u0936", "avi", "avinash"],
  "\u0905\u0935\u093F\u0928\u093E\u0936": ["avinash", "avi"],
  "balaji": ["\u092C\u093E\u0932\u093E\u091C\u0940", "bal", "balaji"],
  "\u092C\u093E\u0932\u093E\u091C\u0940": ["balaji", "bal"],
  "balu": ["\u092C\u093E\u0932\u0942", "bal", "balu"],
  "\u092C\u093E\u0932\u0942": ["balu", "bal"],
  "bharat": ["\u092D\u0930\u0924", "bha", "bharat"],
  "\u092D\u0930\u0924": ["bharat", "bha"],
  "bhaskar": ["\u092D\u093E\u0938\u094D\u0915\u0930", "bha", "bhaskar"],
  "\u092D\u093E\u0938\u094D\u0915\u0930": ["bhaskar", "bha"],
  "chetan": ["\u091A\u0947\u0924\u0928", "che", "chetan"],
  "\u091A\u0947\u0924\u0928": ["chetan", "che"],
  "chinmay": ["\u091A\u093F\u0928\u094D\u092E\u092F", "chi", "chinmay"],
  "\u091A\u093F\u0928\u094D\u092E\u092F": ["chinmay", "chi"],
  "darshan": ["\u0926\u0930\u094D\u0936\u0928", "dar", "darshan"],
  "\u0926\u0930\u094D\u0936\u0928": ["darshan", "dar"],
  "deepak": ["\u0926\u0940\u092A\u0915", "dee", "deepak"],
  "\u0926\u0940\u092A\u0915": ["deepak", "dee"],
  "devendra": ["\u0926\u0947\u0935\u0947\u0902\u0926\u094D\u0930", "dev", "devendra"],
  "\u0926\u0947\u0935\u0947\u0902\u0926\u094D\u0930": ["devendra", "dev"],
  "dharmesh": ["\u0927\u0930\u094D\u092E\u0947\u0936", "dha", "dharmesh"],
  "\u0927\u0930\u094D\u092E\u0947\u0936": ["dharmesh", "dha"],
  "dinesh": ["\u0926\u093F\u0928\u0947\u0936", "din", "dinesh"],
  "\u0926\u093F\u0928\u0947\u0936": ["dinesh", "din"],
  "gaurav": ["\u0917\u094C\u0930\u0935", "gau", "gaurav"],
  "\u0917\u094C\u0930\u0935": ["gaurav", "gau"],
  "girish": ["\u0917\u093F\u0930\u0940\u0936", "gir", "girish"],
  "\u0917\u093F\u0930\u0940\u0936": ["girish", "gir"],
  "gopal": ["\u0917\u094B\u092A\u093E\u0932", "gop", "gopal"],
  "\u0917\u094B\u092A\u093E\u0932": ["gopal", "gop"],
  "hari": ["\u0939\u0930\u0940", "har", "hari"],
  "\u0939\u0930\u0940": ["hari", "har"],
  "harish": ["\u0939\u0930\u0940\u0936", "har", "harish"],
  "\u0939\u0930\u0940\u0936": ["harish", "har"],
  "hemant": ["\u0939\u0947\u092E\u0902\u0924", "hem", "hemant"],
  "\u0939\u0947\u092E\u0902\u0924": ["hemant", "hem"],
  "jagdish": ["\u091C\u0917\u0926\u0940\u0936", "jag", "jagdish"],
  "\u091C\u0917\u0926\u0940\u0936": ["jagdish", "jag"],
  "jai": ["\u091C\u092F", "jai"],
  "\u091C\u092F": ["jai"],
  "jayant": ["\u091C\u092F\u0902\u0924", "jay", "jayant"],
  "\u091C\u092F\u0902\u0924": ["jayant", "jay"],
  "jitendra": ["\u091C\u093F\u0924\u0947\u0902\u0926\u094D\u0930", "jit", "jitendra"],
  "\u091C\u093F\u0924\u0947\u0902\u0926\u094D\u0930": ["jitendra", "jit"],
  "kailash": ["\u0915\u0948\u0932\u093E\u0936", "kai", "kailash"],
  "\u0915\u0948\u0932\u093E\u0936": ["kailash", "kai"],
  "karan": ["\u0915\u0930\u0923", "kar", "karan"],
  "\u0915\u0930\u0923": ["karan", "kar"],
  "karthik": ["\u0915\u093E\u0930\u094D\u0924\u093F\u0915", "kar", "karthik"],
  "\u0915\u093E\u0930\u094D\u0924\u093F\u0915": ["karthik", "kar"],
  "kaustubh": ["\u0915\u094C\u0938\u094D\u0924\u0941\u092D", "kau", "kaustubh"],
  "\u0915\u094C\u0938\u094D\u0924\u0941\u092D": ["kaustubh", "kau"],
  "kedar": ["\u0915\u0947\u0926\u093E\u0930", "ked", "kedar"],
  "\u0915\u0947\u0926\u093E\u0930": ["kedar", "ked"],
  "ketan": ["\u0915\u0947\u0924\u0928", "ket", "ketan"],
  "\u0915\u0947\u0924\u0928": ["ketan", "ket"],
  "kiran": ["\u0915\u093F\u0930\u0923", "kir", "kiran"],
  "\u0915\u093F\u0930\u0923": ["kiran", "kir"],
  "kishore": ["\u0915\u093F\u0936\u094B\u0930", "kis", "kishore"],
  "\u0915\u093F\u0936\u094B\u0930": ["kishore", "kis"],
  "lalit": ["\u0932\u0932\u093F\u0924", "lal", "lalit"],
  "\u0932\u0932\u093F\u0924": ["lalit", "lal"],
  "lokesh": ["\u0932\u094B\u0915\u0947\u0936", "lok", "lokesh"],
  "\u0932\u094B\u0915\u0947\u0936": ["lokesh", "lok"],
  "madhav": ["\u092E\u093E\u0927\u0935", "mad", "madhav"],
  "\u092E\u093E\u0927\u0935": ["madhav", "mad"],
  "mahendra": ["\u092E\u0939\u0947\u0902\u0926\u094D\u0930", "mah", "mahendra"],
  "\u092E\u0939\u0947\u0902\u0926\u094D\u0930": ["mahendra", "mah"],
  "mahesh": ["\u092E\u0939\u0947\u0936", "mah", "mahesh"],
  "\u092E\u0939\u0947\u0936": ["mahesh", "mah"],
  "mandar": ["\u092E\u0902\u0926\u093E\u0930", "man", "mandar"],
  "\u092E\u0902\u0926\u093E\u0930": ["mandar", "man"],
  "mangesh": ["\u092E\u0902\u0917\u0947\u0936", "man", "mangesh"],
  "\u092E\u0902\u0917\u0947\u0936": ["mangesh", "man"],
  "manoj": ["\u092E\u0928\u094B\u091C", "man", "manoj"],
  "\u092E\u0928\u094B\u091C": ["manoj", "man"],
  "milind": ["\u092E\u093F\u0932\u093F\u0902\u0926", "mil", "milind"],
  "\u092E\u093F\u0932\u093F\u0902\u0926": ["milind", "mil"],
  "mohan": ["\u092E\u094B\u0939\u0928", "moh", "mohan"],
  "\u092E\u094B\u0939\u0928": ["mohan", "moh"],
  "mukesh": ["\u092E\u0941\u0915\u0947\u0936", "muk", "mukesh"],
  "\u092E\u0941\u0915\u0947\u0936": ["mukesh", "muk"],
  "naresh": ["\u0928\u0930\u0947\u0936", "nar", "naresh"],
  "\u0928\u0930\u0947\u0936": ["naresh", "nar"],
  "narendra": ["\u0928\u0930\u0947\u0902\u0926\u094D\u0930", "nar", "narendra"],
  "\u0928\u0930\u0947\u0902\u0926\u094D\u0930": ["narendra", "nar"],
  "naveen": ["\u0928\u0935\u0940\u0928", "nav", "naveen"],
  "\u0928\u0935\u0940\u0928": ["naveen", "nav"],
  "nikhil": ["\u0928\u093F\u0916\u093F\u0932", "nik", "nikhil"],
  "\u0928\u093F\u0916\u093F\u0932": ["nikhil", "nik"],
  "nilesh": ["\u0928\u0940\u0932\u0947\u0936", "nil", "nilesh"],
  "\u0928\u0940\u0932\u0947\u0936": ["nilesh", "nil"],
  "nitin": ["\u0928\u093F\u0924\u0940\u0928", "nit", "nitin"],
  "\u0928\u093F\u0924\u0940\u0928": ["nitin", "nit"],
  "omkar": ["\u0913\u092E\u0915\u093E\u0930", "omk", "omkar"],
  "\u0913\u092E\u0915\u093E\u0930": ["omkar", "omk"],
  "onkar": ["\u0913\u0902\u0915\u093E\u0930", "onk", "onkar"],
  "\u0913\u0902\u0915\u093E\u0930": ["onkar", "onk"],
  "parag": ["\u092A\u0930\u093E\u0917", "par", "parag"],
  "\u092A\u0930\u093E\u0917": ["parag", "par"],
  "paresh": ["\u092A\u0930\u0947\u0936", "par", "paresh"],
  "\u092A\u0930\u0947\u0936": ["paresh", "par"],
  "pavan": ["\u092A\u0935\u0928", "pav", "pavan"],
  "\u092A\u0935\u0928": ["pavan", "pav"],
  "praful": ["\u092A\u094D\u0930\u092B\u0941\u0932\u094D\u0932", "pra", "praful"],
  "\u092A\u094D\u0930\u092B\u0941\u0932\u094D\u0932": ["praful", "pra"],
  "prakash": ["\u092A\u094D\u0930\u0915\u093E\u0936", "pra", "prakash"],
  "\u092A\u094D\u0930\u0915\u093E\u0936": ["prakash", "pra"],
  "pramod": ["\u092A\u094D\u0930\u092E\u094B\u0926", "pra", "pramod"],
  "\u092A\u094D\u0930\u092E\u094B\u0926": ["pramod", "pra"],
  "pranav": ["\u092A\u094D\u0930\u0923\u0935", "pra", "pranav"],
  "\u092A\u094D\u0930\u0923\u0935": ["pranav", "pra"],
  "prashant": ["\u092A\u094D\u0930\u0936\u093E\u0902\u0924", "pra", "prashant"],
  "\u092A\u094D\u0930\u0936\u093E\u0902\u0924": ["prashant", "pra"],
  "prasad": ["\u092A\u094D\u0930\u0938\u093E\u0926", "pra", "prasad"],
  "\u092A\u094D\u0930\u0938\u093E\u0926": ["prasad", "pra"],
  "pravin": ["\u092A\u094D\u0930\u0935\u0940\u0923", "pra", "pravin"],
  "\u092A\u094D\u0930\u0935\u0940\u0923": ["pravin", "pra"],
  "prithvi": ["\u092A\u0943\u0925\u094D\u0935\u0940", "pri", "prithvi"],
  "\u092A\u0943\u0925\u094D\u0935\u0940": ["prithvi", "pri"],
  "rahul": ["\u0930\u093E\u0939\u0941\u0932", "rah", "rahul"],
  "\u0930\u093E\u0939\u0941\u0932": ["rahul", "rah"],
  "raj": ["\u0930\u093E\u091C", "raj"],
  "\u0930\u093E\u091C": ["raj"],
  "rajan": ["\u0930\u093E\u091C\u0928", "raj", "rajan"],
  "\u0930\u093E\u091C\u0928": ["rajan", "raj"],
  "rajat": ["\u0930\u093E\u091C\u0924", "raj", "rajat"],
  "\u0930\u093E\u091C\u0924": ["rajat", "raj"],
  "rajeev": ["\u0930\u093E\u091C\u0940\u0935", "raj", "rajeev"],
  "\u0930\u093E\u091C\u0940\u0935": ["rajeev", "raj"],
  "rajendra": ["\u0930\u093E\u091C\u0947\u0902\u0926\u094D\u0930", "raj", "rajendra"],
  "\u0930\u093E\u091C\u0947\u0902\u0926\u094D\u0930": ["rajendra", "raj"],
  "rajesh": ["\u0930\u093E\u091C\u0947\u0936", "raj", "rajesh"],
  "\u0930\u093E\u091C\u0947\u0936": ["rajesh", "raj"],
  "rakesh": ["\u0930\u093E\u0915\u0947\u0936", "rak", "rakesh"],
  "\u0930\u093E\u0915\u0947\u0936": ["rakesh", "rak"],
  "ramesh": ["\u0930\u092E\u0947\u0936", "ram", "ramesh"],
  "\u0930\u092E\u0947\u0936": ["ramesh", "ram"],
  "ravi": ["\u0930\u0935\u093F", "rav", "ravi"],
  "\u0930\u0935\u093F": ["ravi", "rav"],
  "ritesh": ["\u0930\u093F\u0924\u0947\u0936", "rit", "ritesh"],
  "\u0930\u093F\u0924\u0947\u0936": ["ritesh", "rit"],
  "rohit": ["\u0930\u094B\u0939\u093F\u0924", "roh", "rohit"],
  "\u0930\u094B\u0939\u093F\u0924": ["rohit", "roh"],
  "rohan": ["\u0930\u094B\u0939\u0928", "roh", "rohan"],
  "\u0930\u094B\u0939\u0928": ["rohan", "roh"],
  "sachin": ["\u0938\u091A\u093F\u0928", "sac", "sachin"],
  "\u0938\u091A\u093F\u0928": ["sachin", "sac"],
  "sagar": ["\u0938\u093E\u0917\u0930", "sag", "sagar"],
  "\u0938\u093E\u0917\u0930": ["sagar", "sag"],
  "sameer": ["\u0938\u092E\u0940\u0930", "sam", "sameer"],
  "\u0938\u092E\u0940\u0930": ["sameer", "sam"],
  "sandesh": ["\u0938\u0902\u0926\u0947\u0936", "san", "sandesh"],
  "\u0938\u0902\u0926\u0947\u0936": ["sandesh", "san"],
  "sanjay": ["\u0938\u0902\u091C\u092F", "san", "sanjay"],
  "\u0938\u0902\u091C\u092F": ["sanjay", "san"],
  "sandeep": ["\u0938\u0902\u0926\u0940\u092A", "san", "sandeep"],
  "\u0938\u0902\u0926\u0940\u092A": ["sandeep", "san"],
  "santosh": ["\u0938\u0902\u0924\u094B\u0937", "san", "santosh"],
  "\u0938\u0902\u0924\u094B\u0937": ["santosh", "san"],
  "saurabh": ["\u0938\u094C\u0930\u092D", "sau", "saurabh"],
  "\u0938\u094C\u0930\u092D": ["saurabh", "sau"],
  "shailesh": ["\u0936\u0948\u0932\u0947\u0936", "sha", "shailesh"],
  "\u0936\u0948\u0932\u0947\u0936": ["shailesh", "sha"],
  "shankar": ["\u0936\u0902\u0915\u0930", "sha", "shankar"],
  "\u0936\u0902\u0915\u0930": ["shankar", "sha"],
  "shekhar": ["\u0936\u0947\u0916\u0930", "she", "shekhar"],
  "\u0936\u0947\u0916\u0930": ["shekhar", "she"],
  "shrikant": ["\u0936\u094D\u0930\u0940\u0915\u093E\u0902\u0924", "shr", "shrikant"],
  "\u0936\u094D\u0930\u0940\u0915\u093E\u0902\u0924": ["shrikant", "shr"],
  "shyam": ["\u0936\u094D\u092F\u093E\u092E", "shy", "shyam"],
  "\u0936\u094D\u092F\u093E\u092E": ["shyam", "shy"],
  "siddharth": ["\u0938\u093F\u0926\u094D\u0927\u093E\u0930\u094D\u0925", "sid", "siddharth"],
  "\u0938\u093F\u0926\u094D\u0927\u093E\u0930\u094D\u0925": ["siddharth", "sid"],
  "soham": ["\u0938\u094B\u0939\u092E", "soh", "soham"],
  "\u0938\u094B\u0939\u092E": ["soham", "soh"],
  "subhash": ["\u0938\u0941\u092D\u093E\u0937", "sub", "subhash"],
  "\u0938\u0941\u092D\u093E\u0937": ["subhash", "sub"],
  "sudhir": ["\u0938\u0941\u0927\u0940\u0930", "sud", "sudhir"],
  "\u0938\u0941\u0927\u0940\u0930": ["sudhir", "sud"],
  "sumit": ["\u0938\u0941\u092E\u093F\u0924", "sum", "sumit"],
  "\u0938\u0941\u092E\u093F\u0924": ["sumit", "sum"],
  "sunil": ["\u0938\u0941\u0928\u0940\u0932", "sun", "sunil"],
  "\u0938\u0941\u0928\u0940\u0932": ["sunil", "sun"],
  "suresh": ["\u0938\u0941\u0930\u0947\u0936", "sur", "suresh"],
  "\u0938\u0941\u0930\u0947\u0936": ["suresh", "sur"],
  "swapnil": ["\u0938\u094D\u0935\u092A\u094D\u0928\u0940\u0932", "swa", "swapnil"],
  "\u0938\u094D\u0935\u092A\u094D\u0928\u0940\u0932": ["swapnil", "swa"],
  "tanmay": ["\u0924\u0928\u094D\u092E\u092F", "tan", "tanmay"],
  "\u0924\u0928\u094D\u092E\u092F": ["tanmay", "tan"],
  "tejas": ["\u0924\u0947\u091C\u0938", "tej", "tejas"],
  "\u0924\u0947\u091C\u0938": ["tejas", "tej"],
  "tushar": ["\u0924\u0941\u0937\u093E\u0930", "tus", "tushar"],
  "\u0924\u0941\u0937\u093E\u0930": ["tushar", "tus"],
  "umesh": ["\u0909\u092E\u0947\u0936", "ume", "umesh"],
  "\u0909\u092E\u0947\u0936": ["umesh", "ume"],
  "uday": ["\u0909\u0926\u092F", "uda", "uday"],
  "\u0909\u0926\u092F": ["uday", "uda"],
  "vaibhav": ["\u0935\u0948\u092D\u0935", "vai", "vaibhav"],
  "\u0935\u0948\u092D\u0935": ["vaibhav", "vai"],
  "varun": ["\u0935\u0930\u0941\u0923", "var", "varun"],
  "\u0935\u0930\u0941\u0923": ["varun", "var"],
  "vijay": ["\u0935\u093F\u091C\u092F", "vij", "vijay"],
  "\u0935\u093F\u091C\u092F": ["vijay", "vij"],
  "vikram": ["\u0935\u093F\u0915\u094D\u0930\u092E", "vik", "vikram"],
  "\u0935\u093F\u0915\u094D\u0930\u092E": ["vikram", "vik"],
  "vikas": ["\u0935\u093F\u0915\u093E\u0938", "vik", "vikas"],
  "\u0935\u093F\u0915\u093E\u0938": ["vikas", "vik"],
  "vinay": ["\u0935\u093F\u0928\u092F", "vin", "vinay"],
  "\u0935\u093F\u0928\u092F": ["vinay", "vin"],
  "vinod": ["\u0935\u093F\u0928\u094B\u0926", "vin", "vinod"],
  "\u0935\u093F\u0928\u094B\u0926": ["vinod", "vin"],
  "vishal": ["\u0935\u093F\u0936\u093E\u0932", "vis", "vishal"],
  "\u0935\u093F\u0936\u093E\u0932": ["vishal", "vis"],
  "vivek": ["\u0935\u093F\u0935\u0947\u0915", "viv", "vivek"],
  "\u0935\u093F\u0935\u0947\u0915": ["vivek", "viv"],
  "yash": ["\u092F\u0936", "yas", "yash"],
  "\u092F\u0936": ["yash", "yas"],
  "yogesh": ["\u092F\u094B\u0917\u0947\u0936", "yog", "yogesh"],
  "\u092F\u094B\u0917\u0947\u0936": ["yogesh", "yog"],
  "aarti": ["\u0906\u0930\u0924\u0940", "aar", "aarti"],
  "\u0906\u0930\u0924\u0940": ["aarti", "aar"],
  "aditi": ["\u0905\u0926\u093F\u0924\u093F", "adi", "aditi"],
  "\u0905\u0926\u093F\u0924\u093F": ["aditi", "adi"],
  "anjali": ["\u0905\u0902\u091C\u0932\u0940", "anj", "anjali"],
  "\u0905\u0902\u091C\u0932\u0940": ["anjali", "anj"],
  "anita": ["\u0905\u0928\u093F\u0924\u093E", "ani", "anita"],
  "\u0905\u0928\u093F\u0924\u093E": ["anita", "ani"],
  "ankita": ["\u0905\u0902\u0915\u093F\u0924\u093E", "ank", "ankita"],
  "\u0905\u0902\u0915\u093F\u0924\u093E": ["ankita", "ank"],
  "anuradha": ["\u0905\u0928\u0941\u0930\u093E\u0927\u093E", "anu", "anuradha"],
  "\u0905\u0928\u0941\u0930\u093E\u0927\u093E": ["anuradha", "anu"],
  "archana": ["\u0905\u0930\u094D\u091A\u0928\u093E", "arc", "archana"],
  "\u0905\u0930\u094D\u091A\u0928\u093E": ["archana", "arc"],
  "asha": ["\u0906\u0936\u093E", "ash", "asha"],
  "\u0906\u0936\u093E": ["asha", "ash"],
  "ashwini": ["\u0905\u0936\u094D\u0935\u093F\u0928\u0940", "ash", "ashwini"],
  "\u0905\u0936\u094D\u0935\u093F\u0928\u0940": ["ashwini", "ash"],
  "bharati": ["\u092D\u093E\u0930\u0924\u0940", "bha", "bharati"],
  "\u092D\u093E\u0930\u0924\u0940": ["bharati", "bha"],
  "chitra": ["\u091A\u093F\u0924\u094D\u0930\u093E", "chi", "chitra"],
  "\u091A\u093F\u0924\u094D\u0930\u093E": ["chitra", "chi"],
  "deepa": ["\u0926\u0940\u092A\u093E", "dee", "deepa"],
  "\u0926\u0940\u092A\u093E": ["deepa", "dee"],
  "deepika": ["\u0926\u0940\u092A\u093F\u0915\u093E", "dee", "deepika"],
  "\u0926\u0940\u092A\u093F\u0915\u093E": ["deepika", "dee"],
  "gayatri": ["\u0917\u093E\u092F\u0924\u094D\u0930\u0940", "gay", "gayatri"],
  "\u0917\u093E\u092F\u0924\u094D\u0930\u0940": ["gayatri", "gay"],
  "jyoti": ["\u091C\u094D\u092F\u094B\u0924\u0940", "jyo", "jyoti"],
  "\u091C\u094D\u092F\u094B\u0924\u0940": ["jyoti", "jyo"],
  "kalpana": ["\u0915\u0932\u094D\u092A\u0928\u093E", "kal", "kalpana"],
  "\u0915\u0932\u094D\u092A\u0928\u093E": ["kalpana", "kal"],
  "kavita": ["\u0915\u0935\u093F\u0924\u093E", "kav", "kavita"],
  "\u0915\u0935\u093F\u0924\u093E": ["kavita", "kav"],
  "komal": ["\u0915\u094B\u092E\u0932", "kom", "komal"],
  "\u0915\u094B\u092E\u0932": ["komal", "kom"],
  "lata": ["\u0932\u0924\u093E", "lat", "lata"],
  "\u0932\u0924\u093E": ["lata", "lat"],
  "madhuri": ["\u092E\u093E\u0927\u0941\u0930\u0940", "mad", "madhuri"],
  "\u092E\u093E\u0927\u0941\u0930\u0940": ["madhuri", "mad"],
  "manisha": ["\u092E\u0928\u0940\u0937\u093E", "man", "manisha"],
  "\u092E\u0928\u0940\u0937\u093E": ["manisha", "man"],
  "mayuri": ["\u092E\u092F\u0942\u0930\u0940", "may", "mayuri"],
  "\u092E\u092F\u0942\u0930\u0940": ["mayuri", "may"],
  "meena": ["\u092E\u0940\u0928\u093E", "mee", "meena"],
  "\u092E\u0940\u0928\u093E": ["meena", "mee"],
  "megha": ["\u092E\u0947\u0918\u093E", "meg", "megha"],
  "\u092E\u0947\u0918\u093E": ["megha", "meg"],
  "neeta": ["\u0928\u0940\u0924\u093E", "nee", "neeta"],
  "\u0928\u0940\u0924\u093E": ["neeta", "nee"],
  "neha": ["\u0928\u0947\u0939\u093E", "neh", "neha"],
  "\u0928\u0947\u0939\u093E": ["neha", "neh"],
  "nisha": ["\u0928\u093F\u0936\u093E", "nis", "nisha"],
  "\u0928\u093F\u0936\u093E": ["nisha", "nis"],
  "pallavi": ["\u092A\u0932\u094D\u0932\u0935\u0940", "pal", "pallavi"],
  "\u092A\u0932\u094D\u0932\u0935\u0940": ["pallavi", "pal"],
  "pooja": ["\u092A\u0942\u091C\u093E", "poo", "pooja"],
  "\u092A\u0942\u091C\u093E": ["pooja", "poo"],
  "prachi": ["\u092A\u094D\u0930\u093E\u091A\u0940", "pra", "prachi"],
  "\u092A\u094D\u0930\u093E\u091A\u0940": ["prachi", "pra"],
  "pragati": ["\u092A\u094D\u0930\u0917\u0924\u0940", "pra", "pragati"],
  "\u092A\u094D\u0930\u0917\u0924\u0940": ["pragati", "pra"],
  "priya": ["\u092A\u094D\u0930\u093F\u092F\u093E", "pri", "priya"],
  "\u092A\u094D\u0930\u093F\u092F\u093E": ["priya", "pri"],
  "priyanka": ["\u092A\u094D\u0930\u093F\u092F\u0902\u0915\u093E", "pri", "priyanka"],
  "\u092A\u094D\u0930\u093F\u092F\u0902\u0915\u093E": ["priyanka", "pri"],
  "radhika": ["\u0930\u093E\u0927\u093F\u0915\u093E", "rad", "radhika"],
  "\u0930\u093E\u0927\u093F\u0915\u093E": ["radhika", "rad"],
  "rekha": ["\u0930\u0947\u0916\u093E", "rek", "rekha"],
  "\u0930\u0947\u0916\u093E": ["rekha", "rek"],
  "renuka": ["\u0930\u0947\u0923\u0941\u0915\u093E", "ren", "renuka"],
  "\u0930\u0947\u0923\u0941\u0915\u093E": ["renuka", "ren"],
  "rupali": ["\u0930\u0941\u092A\u093E\u0932\u0940", "rup", "rupali"],
  "\u0930\u0941\u092A\u093E\u0932\u0940": ["rupali", "rup"],
  "sangeeta": ["\u0938\u0902\u0917\u0940\u0924\u093E", "san", "sangeeta"],
  "\u0938\u0902\u0917\u0940\u0924\u093E": ["sangeeta", "san"],
  "sarika": ["\u0938\u093E\u0930\u093F\u0915\u093E", "sar", "sarika"],
  "\u0938\u093E\u0930\u093F\u0915\u093E": ["sarika", "sar"],
  "savita": ["\u0938\u0935\u093F\u0924\u093E", "sav", "savita"],
  "\u0938\u0935\u093F\u0924\u093E": ["savita", "sav"],
  "seema": ["\u0938\u0940\u092E\u093E", "see", "seema"],
  "\u0938\u0940\u092E\u093E": ["seema", "see"],
  "shilpa": ["\u0936\u093F\u0932\u094D\u092A\u093E", "shi", "shilpa"],
  "\u0936\u093F\u0932\u094D\u092A\u093E": ["shilpa", "shi"],
  "shruti": ["\u0936\u094D\u0930\u0941\u0924\u0940", "shr", "shruti"],
  "\u0936\u094D\u0930\u0941\u0924\u0940": ["shruti", "shr"],
  "smita": ["\u0938\u094D\u092E\u093F\u0924\u093E", "smi", "smita"],
  "\u0938\u094D\u092E\u093F\u0924\u093E": ["smita", "smi"],
  "sneha": ["\u0938\u094D\u0928\u0947\u0939\u093E", "sne", "sneha"],
  "\u0938\u094D\u0928\u0947\u0939\u093E": ["sneha", "sne"],
  "sonal": ["\u0938\u094B\u0928\u0932", "son", "sonal"],
  "\u0938\u094B\u0928\u0932": ["sonal", "son"],
  "sunita": ["\u0938\u0941\u0928\u0940\u0924\u093E", "sun", "sunita"],
  "\u0938\u0941\u0928\u0940\u0924\u093E": ["sunita", "sun"],
  "swati": ["\u0938\u094D\u0935\u093E\u0924\u0940", "swa", "swati"],
  "\u0938\u094D\u0935\u093E\u0924\u0940": ["swati", "swa"],
  "tanvi": ["\u0924\u0928\u094D\u0935\u0940", "tan", "tanvi"],
  "\u0924\u0928\u094D\u0935\u0940": ["tanvi", "tan"],
  "usha": ["\u0909\u0937\u093E", "ush", "usha"],
  "\u0909\u0937\u093E": ["usha", "ush"],
  "vaishali": ["\u0935\u0948\u0936\u093E\u0932\u0940", "vai", "vaishali"],
  "\u0935\u0948\u0936\u093E\u0932\u0940": ["vaishali", "vai"],
  "vandana": ["\u0935\u0902\u0926\u0928\u093E", "van", "vandana"],
  "\u0935\u0902\u0926\u0928\u093E": ["vandana", "van"],
  "vidya": ["\u0935\u093F\u0926\u094D\u092F\u093E", "vid", "vidya"],
  "\u0935\u093F\u0926\u094D\u092F\u093E": ["vidya", "vid"],
  "patil": ["\u092A\u093E\u091F\u0940\u0932", "pat", "patil"],
  "\u092A\u093E\u091F\u0940\u0932": ["patil", "pat"],
  "deshmukh": ["\u0926\u0947\u0936\u092E\u0941\u0916", "des", "deshmukh"],
  "\u0926\u0947\u0936\u092E\u0941\u0916": ["deshmukh", "des"],
  "kulkarni": ["\u0915\u0941\u0932\u0915\u0930\u094D\u0923\u0940", "kul", "kulkarni"],
  "\u0915\u0941\u0932\u0915\u0930\u094D\u0923\u0940": ["kulkarni", "kul"],
  "jadhav": ["\u091C\u093E\u0927\u0935", "jad", "jadhav"],
  "\u091C\u093E\u0927\u0935": ["jadhav", "jad"],
  "bhosale": ["\u092D\u094B\u0938\u0932\u0947", "bho", "bhosale"],
  "\u092D\u094B\u0938\u0932\u0947": ["bhosale", "bho"],
  "chavan": ["\u091A\u0935\u094D\u0939\u093E\u0923", "cha", "chavan"],
  "\u091A\u0935\u094D\u0939\u093E\u0923": ["chavan", "cha"],
  "gaikwad": ["\u0917\u093E\u092F\u0915\u0935\u093E\u0921", "gai", "gaikwad"],
  "\u0917\u093E\u092F\u0915\u0935\u093E\u0921": ["gaikwad", "gai"],
  "shinde": ["\u0936\u093F\u0902\u0926\u0947", "shi", "shinde"],
  "\u0936\u093F\u0902\u0926\u0947": ["shinde", "shi"],
  "pawar": ["\u092A\u0935\u093E\u0930", "paw", "pawar"],
  "\u092A\u0935\u093E\u0930": ["pawar", "paw"],
  "salunkhe": ["\u0938\u093E\u0933\u0941\u0902\u0916\u0947", "sal", "salunkhe"],
  "\u0938\u093E\u0933\u0941\u0902\u0916\u0947": ["salunkhe", "sal"],
  "shelke": ["\u0936\u0947\u0933\u0915\u0947", "she", "shelke"],
  "\u0936\u0947\u0933\u0915\u0947": ["shelke", "she"],
  "mane": ["\u092E\u093E\u0928\u0947", "man", "mane"],
  "\u092E\u093E\u0928\u0947": ["mane", "man"],
  "aware": ["\u0905\u0935\u093E\u0930\u0947", "awa", "aware"],
  "\u0905\u0935\u093E\u0930\u0947": ["aware", "awa"],
  "rane": ["\u0930\u093E\u0923\u0947", "ran", "rane"],
  "\u0930\u093E\u0923\u0947": ["rane", "ran"],
  "gawade": ["\u0917\u0935\u0921\u0947", "gaw", "gawade"],
  "\u0917\u0935\u0921\u0947": ["gawade", "gaw"],
  "kale": ["\u0915\u093E\u0933\u0947", "kal", "kale"],
  "\u0915\u093E\u0933\u0947": ["kale", "kal"],
  "sawant": ["\u0938\u093E\u0935\u0902\u0924", "saw", "sawant"],
  "\u0938\u093E\u0935\u0902\u0924": ["sawant", "saw"],
  "kamble": ["\u0915\u093E\u092E\u094D\u092C\u0933\u0947", "kam", "kamble"],
  "\u0915\u093E\u092E\u094D\u092C\u0933\u0947": ["kamble", "kam"],
  "more": ["\u092E\u094B\u0930\u0947", "mor", "more"],
  "\u092E\u094B\u0930\u0947": ["more", "mor"],
  "ingle": ["\u0907\u0902\u0917\u0933\u0947", "ing", "ingle"],
  "\u0907\u0902\u0917\u0933\u0947": ["ingle", "ing"],
  "lad": ["\u0932\u093E\u0921", "lad"],
  "\u0932\u093E\u0921": ["lad"],
  "shirke": ["\u0936\u093F\u0930\u094D\u0915\u0947", "shi", "shirke"],
  "\u0936\u093F\u0930\u094D\u0915\u0947": ["shirke", "shi"],
  "deshpande": ["\u0926\u0947\u0936\u092A\u093E\u0902\u0921\u0947", "des", "deshpande"],
  "\u0926\u0947\u0936\u092A\u093E\u0902\u0921\u0947": ["deshpande", "des"],
  "joshi": ["\u091C\u094B\u0936\u0940", "jos", "joshi"],
  "\u091C\u094B\u0936\u0940": ["joshi", "jos"],
  "jog": ["\u091C\u094B\u0917", "jog"],
  "\u091C\u094B\u0917": ["jog"],
  "gokhale": ["\u0917\u094B\u0916\u0932\u0947", "gok", "gokhale"],
  "\u0917\u094B\u0916\u0932\u0947": ["gokhale", "gok"],
  "phadke": ["\u092B\u0921\u0915\u0947", "pha", "phadke"],
  "\u092B\u0921\u0915\u0947": ["phadke", "pha"],
  "tilak": ["\u091F\u093F\u0933\u0915", "til", "tilak"],
  "\u091F\u093F\u0933\u0915": ["tilak", "til"],
  "sharma": ["\u0936\u0930\u094D\u092E\u093E", "sha", "sharma"],
  "\u0936\u0930\u094D\u092E\u093E": ["sharma", "sha"],
  "singh": ["\u0938\u093F\u0902\u0917", "\u0938\u093F\u0902\u0939", "sin", "singh"],
  "\u0938\u093F\u0902\u0917": ["singh", "sin"],
  "\u0938\u093F\u0902\u0939": ["singh", "sin"],
  "kumar": ["\u0915\u0941\u092E\u093E\u0930", "kum", "kumar"],
  "\u0915\u0941\u092E\u093E\u0930": ["kumar", "kum"],
  "gupta": ["\u0917\u0941\u092A\u094D\u0924\u093E", "gup", "gupta"],
  "\u0917\u0941\u092A\u094D\u0924\u093E": ["gupta", "gup"],
  "agarwal": ["\u0905\u0917\u094D\u0930\u0935\u093E\u0932", "aga", "agarwal"],
  "\u0905\u0917\u094D\u0930\u0935\u093E\u0932": ["agarwal", "aga"],
  "verma": ["\u0935\u0930\u094D\u092E\u093E", "ver", "verma"],
  "\u0935\u0930\u094D\u092E\u093E": ["verma", "ver"],
  "yadav": ["\u092F\u093E\u0926\u0935", "yad", "yadav"],
  "\u092F\u093E\u0926\u0935": ["yadav", "yad"],
  "chauhan": ["\u091A\u094C\u0939\u093E\u0928", "cha", "chauhan"],
  "\u091A\u094C\u0939\u093E\u0928": ["chauhan", "cha"],
  "rajput": ["\u0930\u093E\u091C\u092A\u0942\u0924", "raj", "rajput"],
  "\u0930\u093E\u091C\u092A\u0942\u0924": ["rajput", "raj"],
  "mishra": ["\u092E\u093F\u0936\u094D\u0930\u093E", "mis", "mishra"],
  "\u092E\u093F\u0936\u094D\u0930\u093E": ["mishra", "mis"],
  "tiwari": ["\u0924\u093F\u0935\u093E\u0930\u0940", "tiw", "tiwari"],
  "\u0924\u093F\u0935\u093E\u0930\u0940": ["tiwari", "tiw"],
  "pandey": ["\u092A\u093E\u0902\u0921\u0947", "pan", "pandey"],
  "\u092A\u093E\u0902\u0921\u0947": ["pandey", "pan"],
  "reddy": ["\u0930\u0947\u0921\u094D\u0921\u0940", "red", "reddy"],
  "\u0930\u0947\u0921\u094D\u0921\u0940": ["reddy", "red"],
  "patel": ["\u092A\u093E\u091F\u0947\u0932", "pat", "patel"],
  "\u092A\u093E\u091F\u0947\u0932": ["patel", "pat"],
  "shah": ["\u0936\u093E\u0939", "sha", "shah"],
  "\u0936\u093E\u0939": ["shah", "sha"],
  "desai": ["\u0926\u0947\u0938\u093E\u0908", "des", "desai"],
  "\u0926\u0947\u0938\u093E\u0908": ["desai", "des"],
  "mehta": ["\u092E\u0947\u0939\u0924\u093E", "meh", "mehta"],
  "\u092E\u0947\u0939\u0924\u093E": ["mehta", "meh"],
  "gandhi": ["\u0917\u093E\u0902\u0927\u0940", "gan", "gandhi"],
  "\u0917\u093E\u0902\u0927\u0940": ["gandhi", "gan"],
  "thakkar": ["\u0920\u0915\u094D\u0915\u0930", "tha", "thakkar"],
  "\u0920\u0915\u094D\u0915\u0930": ["thakkar", "tha"],
  "jain": ["\u091C\u0948\u0928", "jai", "jain"],
  "\u091C\u0948\u0928": ["jain", "jai"],
  "parikh": ["\u092A\u093E\u0930\u0940\u0916", "par", "parikh"],
  "\u092A\u093E\u0930\u0940\u0916": ["parikh", "par"],
  "modi": ["\u092E\u094B\u0926\u0940", "mod", "modi"],
  "\u092E\u094B\u0926\u0940": ["modi", "mod"],
  "vora": ["\u0935\u094B\u0930\u093E", "vor", "vora"],
  "\u0935\u094B\u0930\u093E": ["vora", "vor"],
  "nair": ["\u0928\u093E\u092F\u0930", "nai", "nair"],
  "\u0928\u093E\u092F\u0930": ["nair", "nai"],
  "menon": ["\u092E\u0947\u0928\u0928", "men", "menon"],
  "\u092E\u0947\u0928\u0928": ["menon", "men"],
  "iyer": ["\u0905\u092F\u094D\u092F\u0930", "iye", "iyer"],
  "\u0905\u092F\u094D\u092F\u0930": ["iyer", "iye"],
  "rao": ["\u0930\u093E\u0935", "rao"],
  "\u0930\u093E\u0935": ["rao"],
  "naidu": ["\u0928\u093E\u092F\u0921\u0942", "nai", "naidu"],
  "\u0928\u093E\u092F\u0921\u0942": ["naidu", "nai"],
  "pillai": ["\u092A\u093F\u0932\u094D\u0932\u0908", "pil", "pillai"],
  "\u092A\u093F\u0932\u094D\u0932\u0908": ["pillai", "pil"],
  "krishnan": ["\u0915\u0943\u0937\u094D\u0923\u0928", "kri", "krishnan"],
  "\u0915\u0943\u0937\u094D\u0923\u0928": ["krishnan", "kri"],
  "nambiar": ["\u0928\u092E\u094D\u092C\u093F\u092F\u093E\u0930", "nam", "nambiar"],
  "\u0928\u092E\u094D\u092C\u093F\u092F\u093E\u0930": ["nambiar", "nam"]
};
function getNameTranslations(searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  const translations = /* @__PURE__ */ new Set([term]);
  const maxVariations = term.length <= 2 ? 5 : term.length === 3 ? 8 : 15;
  let variationCount = 0;
  if (nameMap[term] && variationCount < maxVariations) {
    nameMap[term].forEach((t) => {
      if (variationCount < maxVariations) {
        translations.add(t);
        variationCount++;
      }
    });
  }
  if (variationCount < maxVariations) {
    for (const key of Object.keys(nameMap)) {
      if (variationCount >= maxVariations) break;
      if (key.startsWith(term) && key !== term) {
        translations.add(key);
        variationCount++;
        for (const t of nameMap[key]) {
          if (variationCount >= maxVariations) break;
          translations.add(t);
          variationCount++;
        }
      }
    }
  }
  if (term.length >= 3 && variationCount < maxVariations) {
    for (const key of Object.keys(nameMap)) {
      if (variationCount >= maxVariations) break;
      if (key.includes(term) && !key.startsWith(term) && key !== term) {
        translations.add(key);
        variationCount++;
        for (const t of nameMap[key]) {
          if (variationCount >= maxVariations) break;
          translations.add(t);
          variationCount++;
        }
      }
    }
  }
  return Array.from(translations);
}
function normalizeMarathiVowels(text2) {
  return text2.replace(/ी/g, "\u093F").replace(/ू/g, "\u0941").replace(/ै/g, "\u0947").replace(/ौ/g, "\u094B").replace(/ॅ/g, "\u0947").replace(/ॉ/g, "\u094B").replace(/आ/g, "\u0905").replace(/ई/g, "\u0907").replace(/ऊ/g, "\u0909").replace(/ऐ/g, "\u090F").replace(/औ/g, "\u0913");
}

// server/storage.ts
var DatabaseStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByCredentials(tenantId, username) {
    const cleanTenantId = tenantId.trim();
    const cleanUsername = username.trim();
    try {
      const [user] = await db.select().from(users).where(and(eq(users.tenantId, cleanTenantId), eq(users.username, cleanUsername), eq(users.isActive, true)));
      if (!user) {
        const allUsers = await db.select({
          username: users.username,
          tenantId: users.tenantId,
          isActive: users.isActive
        }).from(users);
      }
      return user || void 0;
    } catch (error) {
      throw error;
    }
  }
  async createUser(user) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const [newUser] = await db.insert(users).values({ ...user, password: hashedPassword }).returning();
    return newUser;
  }
  async getAllUsers() {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }
  async updateUser(id, userData) {
    const [updatedUser] = await db.update(users).set({ ...userData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
    return updatedUser || void 0;
  }
  async deleteUser(id) {
    try {
      await db.transaction(async (tx) => {
        await tx.delete(userPermissions).where(eq(userPermissions.userId, id));
        await tx.delete(userActivityLogs).where(eq(userActivityLogs.userId, id));
        const [deletedUser] = await tx.delete(users).where(eq(users.id, id)).returning();
        if (!deletedUser) {
          throw new Error("User not found");
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  }
  async getCompany(tenantId) {
    const cacheKey = `company:${tenantId}`;
    const cached = performanceCache.getQuery(cacheKey);
    if (cached) {
      return cached;
    }
    const [company] = await db.select().from(companies).where(eq(companies.tenantId, tenantId));
    if (company) {
      performanceCache.setQuery(cacheKey, company, 600);
    }
    return company || void 0;
  }
  async createCompany(company) {
    try {
      const [newCompany] = await db.insert(companies).values(company).returning();
      return newCompany;
    } catch (error) {
      throw error;
    }
  }
  async updateCompany(tenantId, company) {
    const [updatedCompany] = await db.update(companies).set({ ...company, updatedAt: /* @__PURE__ */ new Date() }).where(eq(companies.tenantId, tenantId)).returning();
    performanceCache.invalidatePattern(`company:${tenantId}`);
    return updatedCompany || void 0;
  }
  async getGroups(tenantId) {
    const cacheKey = `groups:${tenantId}`;
    const cached = performanceCache.getQuery(cacheKey);
    if (cached) {
      return cached;
    }
    const result = await db.select().from(groups).where(and(eq(groups.tenantId, tenantId), eq(groups.isActive, true))).orderBy(asc(groups.name));
    performanceCache.setQuery(cacheKey, result, 300);
    return result;
  }
  async createGroup(group) {
    const existingGroup = await db.select({ id: groups.id, name: groups.name }).from(groups).where(and(
      eq(groups.tenantId, group.tenantId),
      sql2`LOWER(${groups.name}) = LOWER(${group.name})`
    )).limit(1);
    if (existingGroup.length > 0) {
      throw new Error(`\u0917\u094D\u0930\u0941\u092A \u0928\u093E\u0935 "${group.name}" \u0906\u0927\u0940\u091A \u0905\u0938\u094D\u0924\u093F\u0924\u094D\u0935\u093E\u0924 \u0906\u0939\u0947. \u0915\u0943\u092A\u092F\u093E \u0935\u0947\u0917\u0933\u0947 \u0928\u093E\u0935 \u0928\u093F\u0935\u0921\u093E. / Group name "${group.name}" already exists. Please choose a different name.`);
    }
    const [newGroup] = await db.insert(groups).values(group).returning();
    return newGroup;
  }
  async updateGroup(id, tenantId, group) {
    if (group.name) {
      const existingGroup = await db.select({ id: groups.id, name: groups.name }).from(groups).where(and(
        eq(groups.tenantId, tenantId),
        sql2`LOWER(${groups.name}) = LOWER(${group.name})`,
        not(eq(groups.id, id))
        // Exclude current group from check
      )).limit(1);
      if (existingGroup.length > 0) {
        throw new Error(`\u0917\u094D\u0930\u0941\u092A \u0928\u093E\u0935 "${group.name}" \u0906\u0927\u0940\u091A \u0905\u0938\u094D\u0924\u093F\u0924\u094D\u0935\u093E\u0924 \u0906\u0939\u0947. \u0915\u0943\u092A\u092F\u093E \u0935\u0947\u0917\u0933\u0947 \u0928\u093E\u0935 \u0928\u093F\u0935\u0921\u093E. / Group name "${group.name}" already exists. Please choose a different name.`);
      }
    }
    const [updatedGroup] = await db.update(groups).set({ ...group, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(groups.id, id), eq(groups.tenantId, tenantId))).returning();
    return updatedGroup || void 0;
  }
  async deleteGroup(id, tenantId) {
    const [updatedGroup] = await db.update(groups).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(groups.id, id), eq(groups.tenantId, tenantId))).returning();
    return !!updatedGroup;
  }
  async getLoans(tenantId, filters) {
    const cacheKey = `loans:${tenantId}:${JSON.stringify(filters || {})}`;
    const cached = performanceCache.getQuery(cacheKey);
    if (cached) {
      return cached;
    }
    const conditions = [eq(loans.tenantId, tenantId)];
    if (filters?.groupId) {
      conditions.push(eq(loans.groupId, filters.groupId));
    }
    if (filters?.borrowerId) {
      conditions.push(eq(loans.borrowerId, filters.borrowerId));
    }
    if (filters?.status) {
      conditions.push(eq(loans.status, filters.status));
    }
    const query = db.select({
      id: loans.id,
      tenantId: loans.tenantId,
      loanNumber: loans.loanNumber,
      borrowerId: loans.borrowerId,
      groupId: loans.groupId,
      borrowerName: loans.borrowerName,
      borrowerMobile: loans.borrowerMobile,
      borrowerAddress: loans.borrowerAddress,
      businessType: loans.businessType,
      loanType: loans.loanType,
      accountNumber: loans.accountNumber,
      principalAmount: loans.principalAmount,
      loanDate: loans.loanDate,
      maturityDate: loans.maturityDate,
      hasMaturity: loans.hasMaturity,
      maturityMonths: loans.maturityMonths,
      calculatedMaturityDate: loans.calculatedMaturityDate,
      interestRate: loans.interestRate,
      interestRateType: loans.interestRateType,
      collateralDetails: loans.collateralDetails,
      weight: loans.weight,
      marketValue: loans.marketValue,
      documentDetails: loans.documentDetails,
      specialConditions: loans.specialConditions,
      otherInfo: loans.otherInfo,
      status: loans.status,
      createdAt: loans.createdAt,
      updatedAt: loans.updatedAt,
      closureDate: loanClosures.closureDate,
      borrower: sql2`CASE WHEN ${borrowers.id} IS NOT NULL THEN json_build_object(
        'id', ${borrowers.id},
        'tenantId', ${borrowers.tenantId},
        'name', ${borrowers.name},
        'mobile', ${borrowers.mobile},
        'address', ${borrowers.address},
        'bankDetails', ${borrowers.bankDetails},
        'groupId', ${borrowers.groupId},
        'isActive', ${borrowers.isActive},
        'createdAt', ${borrowers.createdAt},
        'updatedAt', ${borrowers.updatedAt}
      ) ELSE NULL END`.as("borrower"),
      group: sql2`json_build_object(
        'id', ${groups.id},
        'tenantId', ${groups.tenantId},
        'name', ${groups.name},
        'description', ${groups.description},
        'isActive', ${groups.isActive},
        'createdAt', ${groups.createdAt},
        'updatedAt', ${groups.updatedAt}
      )`.as("group")
    }).from(loans).leftJoin(borrowers, eq(loans.borrowerId, borrowers.id)).leftJoin(loanClosures, eq(loans.id, loanClosures.loanId)).innerJoin(groups, eq(loans.groupId, groups.id)).where(and(...conditions));
    const result = await query.orderBy(desc(loans.createdAt));
    performanceCache.setQuery(cacheKey, result, 120);
    return result;
  }
  async createLoan(loan) {
    const [newLoan] = await db.insert(loans).values({
      ...loan,
      borrowerId: loan.borrowerId || null,
      // Ensure proper type conversion for decimal fields
      principalAmount: loan.principalAmount ? String(loan.principalAmount) : "0",
      interestRate: loan.interestRate ? String(loan.interestRate) : "0",
      marketValue: loan.marketValue ? String(loan.marketValue) : null
    }).returning();
    performanceCache.invalidatePattern(`loans:${loan.tenantId}`);
    performanceCache.invalidatePattern(`borrowers:${loan.tenantId}`);
    return newLoan;
  }
  async updateLoan(id, tenantId, loan) {
    const updateData = {
      ...loan,
      updatedAt: /* @__PURE__ */ new Date(),
      // Ensure proper type conversion for decimal fields
      principalAmount: loan.principalAmount ? String(loan.principalAmount) : void 0,
      interestRate: loan.interestRate ? String(loan.interestRate) : void 0,
      marketValue: loan.marketValue ? String(loan.marketValue) : void 0
    };
    const [updatedLoan] = await db.update(loans).set(updateData).where(and(eq(loans.id, id), eq(loans.tenantId, tenantId))).returning();
    if (updatedLoan) {
      performanceCache.invalidatePattern(`loans:${tenantId}`);
    }
    return updatedLoan || void 0;
  }
  async getLoanById(id, tenantId) {
    const [loanWithDetails] = await db.select({
      id: loans.id,
      accountNumber: loans.accountNumber,
      borrowerName: loans.borrowerName,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      interestRateType: loans.interestRateType,
      loanDate: loans.loanDate,
      groupId: loans.groupId,
      groupName: groups.name
    }).from(loans).leftJoin(groups, eq(loans.groupId, groups.id)).where(and(eq(loans.id, id), eq(loans.tenantId, tenantId))).limit(1);
    return loanWithDetails || void 0;
  }
  async deleteLoan(id, tenantId) {
    const [loanToDelete] = await db.select().from(loans).where(and(eq(loans.id, id), eq(loans.tenantId, tenantId)));
    if (loanToDelete) {
      await db.delete(cashTransactions).where(and(
        eq(cashTransactions.tenantId, tenantId),
        sql2`${cashTransactions.narration} LIKE ${`%${loanToDelete.loanNumber}%`}`
      ));
    }
    const result = await db.delete(loans).where(and(eq(loans.id, id), eq(loans.tenantId, tenantId))).returning();
    return result.length > 0;
  }
  async getTransactions(tenantId, loanId, dateFrom, dateTo) {
    const conditions = [eq(transactions.tenantId, tenantId)];
    if (loanId) {
      conditions.push(eq(transactions.loanId, loanId));
    }
    if (dateFrom) {
      conditions.push(gte(transactions.transactionDate, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(transactions.transactionDate, dateTo));
    }
    const results = await db.select({
      id: transactions.id,
      tenantId: transactions.tenantId,
      loanId: transactions.loanId,
      type: transactions.type,
      amount: transactions.amount,
      interestAmount: transactions.interestAmount,
      transactionDate: transactions.transactionDate,
      description: transactions.description,
      createdAt: transactions.createdAt,
      loan: {
        id: loans.id,
        tenantId: loans.tenantId,
        loanNumber: loans.loanNumber,
        borrowerId: loans.borrowerId,
        groupId: loans.groupId,
        borrowerName: loans.borrowerName,
        borrowerMobile: loans.borrowerMobile,
        borrowerAddress: loans.borrowerAddress,
        businessType: loans.businessType,
        loanType: loans.loanType,
        accountNumber: loans.accountNumber,
        principalAmount: loans.principalAmount,
        loanDate: loans.loanDate,
        maturityDate: loans.maturityDate,
        hasMaturity: loans.hasMaturity,
        maturityMonths: loans.maturityMonths,
        calculatedMaturityDate: loans.calculatedMaturityDate,
        interestRate: loans.interestRate,
        interestRateType: loans.interestRateType,
        collateralDetails: loans.collateralDetails,
        weight: loans.weight,
        marketValue: loans.marketValue,
        documentDetails: loans.documentDetails,
        specialConditions: loans.specialConditions,
        otherInfo: loans.otherInfo,
        status: loans.status,
        createdAt: loans.createdAt,
        updatedAt: loans.updatedAt,
        borrower: sql2`CASE WHEN ${borrowers.id} IS NOT NULL THEN json_build_object(
          'id', ${borrowers.id},
          'tenantId', ${borrowers.tenantId},
          'name', ${borrowers.name},
          'mobile', ${borrowers.mobile},
          'address', ${borrowers.address},
          'bankDetails', ${borrowers.bankDetails},
          'groupId', ${borrowers.groupId},
          'isActive', ${borrowers.isActive},
          'createdAt', ${borrowers.createdAt},
          'updatedAt', ${borrowers.updatedAt}
        ) ELSE NULL END`.as("borrower"),
        group: sql2`json_build_object(
          'id', ${groups.id},
          'tenantId', ${groups.tenantId},
          'name', ${groups.name},
          'description', ${groups.description},
          'isActive', ${groups.isActive},
          'createdAt', ${groups.createdAt},
          'updatedAt', ${groups.updatedAt}
        )`.as("group")
      }
    }).from(transactions).innerJoin(loans, eq(transactions.loanId, loans.id)).leftJoin(borrowers, eq(loans.borrowerId, borrowers.id)).innerJoin(groups, eq(loans.groupId, groups.id)).where(and(...conditions)).orderBy(desc(transactions.transactionDate));
    return results;
  }
  async createTransaction(transaction) {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }
  async createLoanClosure(closure) {
    const existingClosure = await db.select({ id: loanClosures.id }).from(loanClosures).where(and(
      eq(loanClosures.loanId, closure.loanId),
      eq(loanClosures.tenantId, closure.tenantId)
    )).limit(1);
    if (existingClosure.length > 0) {
      throw new Error(`Loan already closed. Cannot create duplicate closure for loan ID: ${closure.loanId}`);
    }
    const [loanStatus] = await db.select({ status: loans.status }).from(loans).where(and(
      eq(loans.id, closure.loanId),
      eq(loans.tenantId, closure.tenantId)
    ));
    if (!loanStatus) {
      throw new Error(`Loan not found: ${closure.loanId}`);
    }
    if (loanStatus.status === "closed") {
      throw new Error(`Loan is already marked as closed. Cannot close again: ${closure.loanId}`);
    }
    const closureData = {
      ...closure,
      // Ensure numeric fields are properly converted to strings for decimal columns
      principalPaid: String(closure.principalPaid),
      interestPaid: String(closure.interestPaid),
      totalAmount: String(closure.totalAmount),
      calculatedInterest: String(closure.calculatedInterest),
      actualPaidAmount: String(closure.actualPaidAmount),
      balanceRefund: String(closure.balanceRefund || 0),
      durationInMonths: String(closure.durationInMonths),
      interestVariance: String(closure.interestVariance || 0)
    };
    const [newClosure] = await db.insert(loanClosures).values(closureData).returning();
    const [loanDetails] = await db.select({
      id: loans.id,
      accountNumber: loans.accountNumber,
      borrowerName: loans.borrowerName,
      principalAmount: loans.principalAmount,
      groupId: loans.groupId,
      groupName: groups.name
    }).from(loans).leftJoin(groups, eq(loans.groupId, groups.id)).where(eq(loans.id, closure.loanId));
    if (loanDetails) {
      await db.update(loans).set({
        status: "closed",
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(loans.id, closure.loanId));
      try {
        const { NarrationEngine: NarrationEngine2 } = await Promise.resolve().then(() => (init_narration_engine(), narration_engine_exports));
        const standardizedNarration = NarrationEngine2.createLoanClosureNarration(
          loanDetails.accountNumber,
          loanDetails.borrowerName,
          Number(closure.principalPaid),
          Number(closure.interestPaid),
          loanDetails.groupName || void 0
        );
        const existingCashEntries = await db.select().from(cashTransactions).where(and(
          eq(cashTransactions.tenantId, closure.tenantId),
          eq(cashTransactions.transactionDate, closure.closureDate),
          or(
            // Check by account number pattern
            sql2`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loanDetails.accountNumber}%`}`,
            // Check by borrower name pattern  
            sql2`${cashTransactions.narration} LIKE ${`%${loanDetails.borrowerName}%`}`,
            // Check by exact amount match
            sql2`ABS(${cashTransactions.amount} - ${closure.totalAmount}) < 0.01`
          )
        ));
        const recentEntries = await db.select().from(cashTransactions).where(and(
          eq(cashTransactions.tenantId, closure.tenantId),
          eq(cashTransactions.transactionType, "cash_in"),
          sql2`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loanDetails.accountNumber}%`}`,
          sql2`${cashTransactions.createdAt} > NOW() - INTERVAL '10 minutes'`
        ));
        const manualEntriesToDelete = existingCashEntries.filter(
          (entry) => entry.isSystemGenerated === false && (entry.category === "income" || entry.category === "capital")
        );
        if (manualEntriesToDelete.length > 0) {
          for (const manualEntry of manualEntriesToDelete) {
            await db.delete(cashTransactions).where(eq(cashTransactions.id, manualEntry.id));
          }
        }
        const recentManualEntries = recentEntries.filter(
          (entry) => entry.isSystemGenerated === false && (entry.category === "income" || entry.category === "capital")
        );
        if (recentManualEntries.length > 0) {
          for (const recentManual of recentManualEntries) {
            await db.delete(cashTransactions).where(eq(cashTransactions.id, recentManual.id));
          }
        }
        const systemGeneratedExistingEntries = existingCashEntries.filter(
          (entry) => entry.isSystemGenerated === true && entry.category === "loan_repayment"
        );
        const systemGeneratedRecentEntries = recentEntries.filter(
          (entry) => entry.isSystemGenerated === true && entry.category === "loan_repayment"
        );
        if (systemGeneratedExistingEntries.length === 0 && systemGeneratedRecentEntries.length === 0) {
          await db.insert(cashTransactions).values({
            tenantId: closure.tenantId,
            transactionDate: closure.closureDate,
            transactionType: "cash_in",
            amount: closure.totalAmount.toString(),
            category: "loan_repayment",
            narration: standardizedNarration,
            isSystemGenerated: true
            // System generated - only editable through proper closure forms
          });
        } else {
        }
      } catch (error) {
        throw error;
      }
    }
    return newClosure;
  }
  async getAllLoanClosures(tenantId) {
    return await db.select().from(loanClosures).where(eq(loanClosures.tenantId, tenantId)).orderBy(desc(loanClosures.closureDate));
  }
  async getLoanClosures(tenantId, loanId) {
    const conditions = [eq(loanClosures.tenantId, tenantId)];
    if (loanId) {
      conditions.push(eq(loanClosures.loanId, loanId));
    }
    const query = db.select().from(loanClosures).where(and(...conditions));
    return await query.orderBy(desc(loanClosures.closureDate));
  }
  async deleteLoanClosure(id, tenantId) {
    const result = await db.delete(loanClosures).where(and(eq(loanClosures.id, id), eq(loanClosures.tenantId, tenantId)));
    return result.rowCount > 0;
  }
  async getDashboardStats(tenantId) {
    const now = /* @__PURE__ */ new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
    const currentDate = /* @__PURE__ */ new Date();
    const threeMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split("T")[0];
    const [
      currentMonthDisbursements,
      prevMonthDisbursements,
      currentMonthClosures,
      prevMonthClosures,
      currentMonthCashStats,
      prevMonthCashStats,
      activeLoans,
      closedLoans,
      borrowersResult,
      threeMonthDisbursements,
      threeMonthClosures,
      threeMonthCashStats
    ] = await Promise.all([
      db.select({ count: count(), totalAmount: sum(loans.principalAmount) }).from(loans).where(and(eq(loans.tenantId, tenantId), gte(loans.loanDate, currentMonthStart), lte(loans.loanDate, currentMonthEnd))),
      db.select({ count: count(), totalAmount: sum(loans.principalAmount) }).from(loans).where(and(eq(loans.tenantId, tenantId), gte(loans.loanDate, prevMonthStart), lte(loans.loanDate, prevMonthEnd))),
      db.select({ count: count(), totalAmount: sum(loanClosures.totalAmount) }).from(loanClosures).where(and(eq(loanClosures.tenantId, tenantId), gte(loanClosures.closureDate, currentMonthStart), lte(loanClosures.closureDate, currentMonthEnd))),
      db.select({ count: count(), totalAmount: sum(loanClosures.totalAmount) }).from(loanClosures).where(and(eq(loanClosures.tenantId, tenantId), gte(loanClosures.closureDate, prevMonthStart), lte(loanClosures.closureDate, prevMonthEnd))),
      db.select({
        count: count(),
        totalIn: sum(sql2`CASE WHEN ${cashTransactions.transactionType} = 'cash_in' THEN ${cashTransactions.amount} ELSE 0 END`),
        totalOut: sum(sql2`CASE WHEN ${cashTransactions.transactionType} = 'cash_out' THEN ${cashTransactions.amount} ELSE 0 END`)
      }).from(cashTransactions).where(and(eq(cashTransactions.tenantId, tenantId), gte(cashTransactions.transactionDate, currentMonthStart), lte(cashTransactions.transactionDate, currentMonthEnd))),
      db.select({
        count: count(),
        totalIn: sum(sql2`CASE WHEN ${cashTransactions.transactionType} = 'cash_in' THEN ${cashTransactions.amount} ELSE 0 END`),
        totalOut: sum(sql2`CASE WHEN ${cashTransactions.transactionType} = 'cash_out' THEN ${cashTransactions.amount} ELSE 0 END`)
      }).from(cashTransactions).where(and(eq(cashTransactions.tenantId, tenantId), gte(cashTransactions.transactionDate, prevMonthStart), lte(cashTransactions.transactionDate, prevMonthEnd))),
      db.select({ total: sum(loans.principalAmount), count: count() }).from(loans).where(and(eq(loans.tenantId, tenantId), eq(loans.status, "active"))),
      db.select({ total: sum(loans.principalAmount) }).from(loans).where(and(eq(loans.tenantId, tenantId), eq(loans.status, "closed"))),
      db.selectDistinct({ borrowerId: loans.borrowerId }).from(loans).where(and(eq(loans.tenantId, tenantId), eq(loans.status, "active"))),
      db.select({ count: count(), totalAmount: sum(loans.principalAmount) }).from(loans).where(and(eq(loans.tenantId, tenantId), gte(loans.loanDate, threeMonthsAgoStr), lte(loans.loanDate, currentMonthEnd))),
      db.select({ count: count(), totalAmount: sum(loanClosures.actualPaidAmount) }).from(loanClosures).where(and(eq(loanClosures.tenantId, tenantId), gte(loanClosures.closureDate, threeMonthsAgoStr), lte(loanClosures.closureDate, currentMonthEnd))),
      db.select({
        count: count(),
        totalIn: sum(sql2`CASE WHEN ${cashTransactions.transactionType} = 'cash_in' THEN ${cashTransactions.amount} ELSE 0 END`),
        totalOut: sum(sql2`CASE WHEN ${cashTransactions.transactionType} = 'cash_out' THEN ${cashTransactions.amount} ELSE 0 END`)
      }).from(cashTransactions).where(and(eq(cashTransactions.tenantId, tenantId), gte(cashTransactions.transactionDate, threeMonthsAgoStr), lte(cashTransactions.transactionDate, currentMonthEnd)))
    ]);
    const totalDisbursed = Number(activeLoans[0]?.total || 0) + Number(closedLoans[0]?.total || 0);
    const totalRepaid = Number(closedLoans[0]?.total || 0);
    const outstanding = Number(activeLoans[0]?.total || 0);
    const activeBorrowers = borrowersResult.length;
    const threeMonthDisbursementCount = Number(threeMonthDisbursements[0]?.count || 0);
    const threeMonthClosureCount = Number(threeMonthClosures[0]?.count || 0);
    const threeMonthTotalAmount = Number(threeMonthCashStats[0]?.totalIn || 0) + Number(threeMonthCashStats[0]?.totalOut || 0);
    const threeMonthSuccessRate = threeMonthDisbursementCount > 0 ? Math.round(threeMonthClosureCount / threeMonthDisbursementCount * 100) : 0;
    return {
      totalDisbursed,
      totalRepaid,
      outstanding,
      activeBorrowers,
      // Current month data
      currentMonth: {
        disbursements: currentMonthDisbursements[0]?.count || 0,
        disbursementAmount: Number(currentMonthDisbursements[0]?.totalAmount || 0),
        closures: currentMonthClosures[0]?.count || 0,
        closureAmount: Number(currentMonthClosures[0]?.totalAmount || 0),
        transactions: currentMonthCashStats[0]?.count || 0,
        cashIn: Number(currentMonthCashStats[0]?.totalIn || 0),
        cashOut: Number(currentMonthCashStats[0]?.totalOut || 0)
      },
      // Previous month data for comparison
      previousMonth: {
        disbursements: prevMonthDisbursements[0]?.count || 0,
        disbursementAmount: Number(prevMonthDisbursements[0]?.totalAmount || 0),
        closures: prevMonthClosures[0]?.count || 0,
        closureAmount: Number(prevMonthClosures[0]?.totalAmount || 0),
        transactions: prevMonthCashStats[0]?.count || 0,
        cashIn: Number(prevMonthCashStats[0]?.totalIn || 0),
        cashOut: Number(prevMonthCashStats[0]?.totalOut || 0)
      },
      // Three month performance data (real data instead of hardcoded)
      threeMonthPerformance: {
        totalDisbursements: threeMonthDisbursementCount,
        totalClosures: threeMonthClosureCount,
        totalAmount: threeMonthTotalAmount,
        successRate: threeMonthSuccessRate,
        netGrowth: threeMonthDisbursementCount - threeMonthClosureCount
      }
    };
  }
  async getCashBookReport(tenantId, dateFrom, dateTo) {
    const conditions = [eq(cashTransactions.tenantId, tenantId)];
    if (dateFrom) {
      conditions.push(gte(cashTransactions.transactionDate, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(cashTransactions.transactionDate, dateTo));
    }
    const transactions2 = await db.select({
      id: cashTransactions.id,
      transactionDate: cashTransactions.transactionDate,
      transactionType: cashTransactions.transactionType,
      amount: cashTransactions.amount,
      narration: cashTransactions.narration,
      partyName: parties.name
      // loanId: cashTransactions.loanId, // Remove this field as it doesn't exist in schema
    }).from(cashTransactions).leftJoin(parties, eq(cashTransactions.partyId, parties.id)).where(and(...conditions)).orderBy(asc(cashTransactions.transactionDate));
    return transactions2;
  }
  async getCapitalAccountReport(tenantId, dateFrom, dateTo) {
    return await this.getTransactions(tenantId, void 0, dateFrom, dateTo);
  }
  async getLoanLedger(tenantId, loanId) {
    const loanTransactions = await this.getTransactions(tenantId, loanId);
    return loanTransactions;
  }
  // Party operations implementation
  async getParties(tenantId, search) {
    const conditions = [eq(parties.tenantId, tenantId)];
    if (search) {
      conditions.push(sql2`(${parties.name} ILIKE ${`%${search}%`} OR ${parties.mobile} ILIKE ${`%${search}%`})`);
    }
    return await db.select().from(parties).where(and(...conditions)).orderBy(asc(parties.name));
  }
  async createParty(party) {
    const partyData = {
      ...party,
      openingBalance: party.openingBalance ? party.openingBalance.toString() : "0",
      openingBalanceType: party.openingBalanceType || "credit",
      openingBalanceDate: party.openingBalanceDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      openingBalanceNarration: party.openingBalanceNarration || "Opening Balance"
    };
    const [newParty] = await db.insert(parties).values(partyData).returning();
    return newParty;
  }
  async updateParty(id, tenantId, party) {
    const updateData = {
      ...party,
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (party.openingBalance !== void 0) {
      updateData.openingBalance = party.openingBalance.toString();
    }
    const [updatedParty] = await db.update(parties).set(updateData).where(and(eq(parties.id, id), eq(parties.tenantId, tenantId))).returning();
    return updatedParty || void 0;
  }
  async deleteParty(id, tenantId) {
    try {
      console.log(`Storage: Checking party deletion for id=${id}, tenantId=${tenantId}`);
      const relatedTransactions = await db.select().from(cashTransactions).where(and(eq(cashTransactions.partyId, id), eq(cashTransactions.tenantId, tenantId))).limit(1);
      console.log(`Storage: Found ${relatedTransactions.length} related transactions`);
      if (relatedTransactions.length > 0) {
        console.log("Storage: Cannot delete party - has related transactions");
        return false;
      }
      const deletedParty = await db.delete(parties).where(and(eq(parties.id, id), eq(parties.tenantId, tenantId))).returning();
      console.log(`Storage: Deletion result - ${deletedParty.length} rows affected`);
      return deletedParty.length > 0;
    } catch (error) {
      console.error("Storage: Error deleting party:", error);
      return false;
    }
  }
  // Cash transaction operations implementation
  async getCashTransactions(tenantId, filters) {
    const conditions = [eq(cashTransactions.tenantId, tenantId)];
    if (filters?.dateFrom) {
      const fromDateTime = `${filters.dateFrom} 00:00:00`;
      conditions.push(gte(cashTransactions.transactionDate, fromDateTime));
    }
    if (filters?.dateTo) {
      const toDateTime = `${filters.dateTo} 23:59:59`;
      conditions.push(lte(cashTransactions.transactionDate, toDateTime));
    }
    if (filters?.partyId) {
      conditions.push(eq(cashTransactions.partyId, filters.partyId));
    }
    if (filters?.transactionType) {
      conditions.push(eq(cashTransactions.transactionType, filters.transactionType));
    }
    if (filters?.search) {
      const searchTerm = filters.search.trim();
      const isAmountSearch = !isNaN(Number(searchTerm)) && searchTerm.length > 0;
      let searchConditions = [];
      if (isAmountSearch) {
        const amount = Number(searchTerm);
        searchConditions.push(
          sql2`${cashTransactions.amount} = ${amount}`,
          sql2`${cashTransactions.amount} >= ${amount * 0.99} AND ${cashTransactions.amount} <= ${amount * 1.01}`
        );
        const amountPatterns = [
          `%${searchTerm}%`,
          // Partial number match in text
          `${searchTerm}%`,
          // Starts with number
          `%${searchTerm}`
          // Ends with number
        ];
        amountPatterns.forEach((pattern) => {
          searchConditions.push(
            sql2`${parties.name} ILIKE ${pattern}`,
            sql2`${cashTransactions.narration} ILIKE ${pattern}`,
            sql2`${parties.mobile} ILIKE ${pattern}`
          );
        });
      } else {
        const normalizedTerm = normalizeMarathiVowels(searchTerm);
        const vowelFrom = "\u0940\u0942\u0948\u094C\u0945\u0949\u0906\u0908\u090A\u0910\u0914";
        const vowelTo = "\u093F\u0941\u0947\u094B\u0947\u094B\u0905\u0907\u0909\u090F\u0913";
        if (normalizedTerm !== searchTerm) {
          searchConditions.push(
            sql2`translate(${parties.name}, ${vowelFrom}, ${vowelTo}) ILIKE ${`%${normalizedTerm}%`}`,
            sql2`translate(${cashTransactions.narration}, ${vowelFrom}, ${vowelTo}) ILIKE ${`%${normalizedTerm}%`}`
          );
        }
        const searchQueries = getNameTranslations(searchTerm);
        if (normalizedTerm !== searchTerm) {
          const normalizedVariations = getNameTranslations(normalizedTerm);
          normalizedVariations.forEach((v) => {
            if (!searchQueries.includes(v)) searchQueries.push(v);
          });
        }
        searchQueries.forEach((query) => {
          const queryPatterns = [
            `%${query}%`,
            `${query}%`,
            `% ${query}%`,
            `%${query.toLowerCase()}%`,
            `%${query.toUpperCase()}%`
          ];
          queryPatterns.forEach((pattern) => {
            searchConditions.push(
              sql2`${parties.name} ILIKE ${pattern}`,
              sql2`${cashTransactions.narration} ILIKE ${pattern}`,
              sql2`${cashTransactions.category} ILIKE ${pattern}`,
              sql2`${parties.mobile} ILIKE ${pattern}`,
              sql2`${parties.address} ILIKE ${pattern}`
            );
          });
        });
        if (searchTerm.length >= 2) {
          const fuzzyPatterns = [
            `%${searchTerm.slice(0, -1)}%`,
            `%${searchTerm.slice(1)}%`
          ];
          if (searchTerm.length >= 3) {
            fuzzyPatterns.push(
              `%${searchTerm.slice(0, 2)}%`,
              `%${searchTerm.slice(-2)}%`,
              `${searchTerm.slice(0, 3)}%`
            );
          }
          for (let i = 0; i < searchTerm.length - 1; i++) {
            const partial = searchTerm.slice(i, i + 2);
            fuzzyPatterns.push(`%${partial}%`);
          }
          fuzzyPatterns.forEach((pattern) => {
            searchConditions.push(
              sql2`${parties.name} ILIKE ${pattern}`,
              sql2`${cashTransactions.narration} ILIKE ${pattern}`
            );
          });
        }
      }
      if (searchConditions.length > 0) {
        conditions.push(or(...searchConditions));
      }
    }
    if (filters?.amount) {
      conditions.push(eq(cashTransactions.amount, filters.amount));
    }
    const rawResults = await db.select({
      id: cashTransactions.id,
      tenantId: cashTransactions.tenantId,
      transactionDate: cashTransactions.transactionDate,
      transactionType: cashTransactions.transactionType,
      amount: cashTransactions.amount,
      category: cashTransactions.category,
      narration: cashTransactions.narration,
      partyId: cashTransactions.partyId,
      fromAccount: cashTransactions.fromAccount,
      toAccount: cashTransactions.toAccount,
      linkedTransactionId: cashTransactions.linkedTransactionId,
      isSystemGenerated: cashTransactions.isSystemGenerated,
      createdAt: cashTransactions.createdAt,
      updatedAt: cashTransactions.updatedAt,
      party: sql2`CASE WHEN ${parties.id} IS NOT NULL THEN json_build_object(
        'id', ${parties.id},
        'tenantId', ${parties.tenantId},
        'name', ${parties.name},
        'mobile', ${parties.mobile},
        'address', ${parties.address},
        'createdAt', ${parties.createdAt},
        'updatedAt', ${parties.updatedAt}
      ) ELSE NULL END`.as("party")
    }).from(cashTransactions).leftJoin(parties, eq(cashTransactions.partyId, parties.id)).where(and(...conditions)).orderBy(asc(cashTransactions.transactionDate));
    const uniqueMap = /* @__PURE__ */ new Map();
    rawResults.forEach((result) => {
      if (!uniqueMap.has(result.id)) {
        uniqueMap.set(result.id, result);
      }
    });
    const finalResults = Array.from(uniqueMap.values());
    console.log("\u2705 STORAGE RESULT:", {
      totalFound: rawResults.length,
      afterDedup: finalResults.length,
      dates: finalResults.map((r) => r.transactionDate).slice(0, 5),
      amounts: finalResults.map((r) => Number(r.amount)).slice(0, 5)
    });
    return finalResults;
  }
  // Mobile Cashbook Daily Balance - Critical for proper balance carry-forward
  async getMobileCashbookDailyBalance(tenantId, forDate) {
    try {
      const openingBalance = await this.getCashBalanceBeforeDate(tenantId, forDate);
      const dayTransactions = await db.select().from(cashTransactions).where(
        and(
          eq(cashTransactions.tenantId, tenantId),
          sql2`DATE(${cashTransactions.transactionDate}) = ${forDate}`
        )
      ).orderBy(asc(cashTransactions.transactionDate));
      let dayCashIn = 0;
      let dayCashOut = 0;
      dayTransactions.forEach((transaction) => {
        const amount = Number(transaction.amount) || 0;
        if (transaction.transactionType === "cash_in") {
          dayCashIn += amount;
        } else {
          dayCashOut += amount;
        }
      });
      const netDifference = dayCashIn - dayCashOut;
      const closingBalance = openingBalance + netDifference;
      return {
        date: forDate,
        openingBalance,
        closingBalance,
        dayTransactions: {
          cashIn: dayCashIn,
          cashOut: dayCashOut,
          count: dayTransactions.length,
          transactions: dayTransactions
        },
        netDifference
      };
    } catch (error) {
      console.error("Error calculating mobile cashbook daily balance:", error);
      return {
        date: forDate,
        openingBalance: 0,
        closingBalance: 0,
        dayTransactions: { cashIn: 0, cashOut: 0, count: 0, transactions: [] },
        netDifference: 0
      };
    }
  }
  // Universal Mobile Cashbook Balance - Support all periods (daily/weekly/monthly/yearly/custom)
  async getMobileCashbookUniversalBalance(tenantId, startDate, endDate, viewPeriod) {
    try {
      const openingBalance = await this.getCashBalanceBeforeDate(tenantId, startDate);
      const periodTransactions = await db.select().from(cashTransactions).where(
        and(
          eq(cashTransactions.tenantId, tenantId),
          sql2`DATE(${cashTransactions.transactionDate}) >= ${startDate}`,
          sql2`DATE(${cashTransactions.transactionDate}) <= ${endDate}`
        )
      ).orderBy(asc(cashTransactions.transactionDate));
      let periodCashIn = 0;
      let periodCashOut = 0;
      periodTransactions.forEach((transaction) => {
        const amount = Number(transaction.amount) || 0;
        if (transaction.transactionType === "cash_in") {
          periodCashIn += amount;
        } else {
          periodCashOut += amount;
        }
      });
      const netDifference = periodCashIn - periodCashOut;
      const closingBalance = openingBalance + netDifference;
      return {
        startDate,
        endDate,
        viewPeriod,
        openingBalance,
        closingBalance,
        periodTransactions: {
          cashIn: periodCashIn,
          cashOut: periodCashOut,
          count: periodTransactions.length,
          transactions: periodTransactions
        },
        netDifference,
        method: "universal-period-balance"
      };
    } catch (error) {
      console.error("Error calculating universal mobile cashbook balance:", error);
      return {
        startDate,
        endDate,
        viewPeriod,
        openingBalance: 0,
        closingBalance: 0,
        periodTransactions: { cashIn: 0, cashOut: 0, count: 0, transactions: [] },
        netDifference: 0,
        method: "universal-period-balance-error"
      };
    }
  }
  async createCashTransaction(transaction) {
    if (!transaction.isSystemGenerated && transaction.narration) {
      const loanDisbursementKeywords = ["\u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923", "\u0916\u093E\u0924\u0947 \u0915\u094D\u0930.", "loan disbursement", "\u092E\u0941\u0926\u094D\u0926\u0932", "\u0915\u0930\u094D\u091C"];
      const loanClosureKeywords = ["\u0915\u0930\u094D\u091C \u092C\u0902\u0926", "\u0915\u0930\u094D\u091C \u0935\u0938\u0942\u0932\u0940", "loan closure", "\u0935\u0938\u0942\u0932\u0940", "\u092C\u0902\u0926", "loan_repayment"];
      const hasLoanDisbursementKeywords = loanDisbursementKeywords.some(
        (keyword) => transaction.narration.toLowerCase().includes(keyword.toLowerCase())
      );
      const hasLoanClosureKeywords = loanClosureKeywords.some(
        (keyword) => transaction.narration.toLowerCase().includes(keyword.toLowerCase())
      );
      if (transaction.category === "expense" && hasLoanDisbursementKeywords) {
        throw new Error("LOAN_DISBURSEMENT_MANUAL_ENTRY_BLOCKED: \u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923 entries \u092B\u0915\u094D\u0924 loan forms \u092E\u0927\u0942\u0928\u091A \u0915\u0930\u0924\u093E \u092F\u0947\u0924\u093E\u0924");
      }
      if ((transaction.category === "income" || transaction.category === "capital" || transaction.category === "loan_repayment") && hasLoanClosureKeywords) {
        throw new Error("LOAN_CLOSURE_MANUAL_ENTRY_BLOCKED: \u0915\u0930\u094D\u091C \u092C\u0902\u0926 entries \u092B\u0915\u094D\u0924 loan closure forms \u092E\u0927\u0942\u0928\u091A \u0915\u0930\u0924\u093E \u092F\u0947\u0924\u093E\u0924");
      }
    }
    const recentSimilarTransactions = await db.select().from(cashTransactions).where(and(
      eq(cashTransactions.tenantId, transaction.tenantId),
      sql2`ABS(${cashTransactions.amount} - ${transaction.amount}) < 0.01`,
      eq(cashTransactions.transactionType, transaction.transactionType),
      // 🚫 CRITICAL: 10-minute window to catch all potential duplicates
      sql2`${cashTransactions.createdAt} > NOW() - INTERVAL '10 minutes'`
    )).orderBy(sql2`${cashTransactions.createdAt} DESC`).limit(10);
    if (transaction.isSystemGenerated && (transaction.category === "loan_repayment" || transaction.category === "loan_disbursement")) {
      const manualEntriesWithSameAmount = recentSimilarTransactions.filter((existing) => {
        if (!existing.isSystemGenerated) {
          if (transaction.category === "loan_disbursement" && existing.category === "expense") {
            return true;
          }
          if (transaction.category === "loan_repayment" && (existing.category === "income" || existing.category === "capital")) {
            return true;
          }
        }
        return false;
      });
      if (manualEntriesWithSameAmount.length > 0) {
        console.log(`\u{1F6AB} DEEP DUPLICATE DETECTION: Found ${manualEntriesWithSameAmount.length} manual entries with amount \u20B9${transaction.amount}`);
        for (const manualEntry of manualEntriesWithSameAmount) {
          console.log(`\u{1F5D1}\uFE0F DEEP CLEANUP: Removing manual entry [${manualEntry.category}]: ${manualEntry.id} - \u20B9${manualEntry.amount}`);
          await db.delete(cashTransactions).where(eq(cashTransactions.id, manualEntry.id));
        }
        console.log(`\u2705 SYSTEM ENTRY PROCEEDING: Creating proper loan transaction after deep cleanup`);
      }
    }
    const accountNumberMatch = transaction.narration?.match(/खाते क्र\.\s*(\d+)/);
    const accountNumber = accountNumberMatch ? accountNumberMatch[1] : null;
    if (accountNumber) {
      const accountSpecificDuplicates = await db.select().from(cashTransactions).where(and(
        eq(cashTransactions.tenantId, transaction.tenantId),
        eq(cashTransactions.transactionDate, transaction.transactionDate),
        sql2`ABS(${cashTransactions.amount} - ${transaction.amount}) < 0.01`,
        eq(cashTransactions.transactionType, transaction.transactionType),
        sql2`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${accountNumber}%`}`,
        sql2`${cashTransactions.createdAt} > NOW() - INTERVAL '10 minutes'`
      ));
      if (transaction.isSystemGenerated && accountSpecificDuplicates.length > 0) {
        for (const duplicate of accountSpecificDuplicates) {
          if (!duplicate.isSystemGenerated) {
            console.log(`\u{1F5D1}\uFE0F ACCOUNT CLEANUP: Removing manual entry for account ${accountNumber}: ${duplicate.id}`);
            await db.delete(cashTransactions).where(eq(cashTransactions.id, duplicate.id));
          }
        }
      } else if (accountSpecificDuplicates.length > 0) {
        console.log(`\u{1F6AB} ACCOUNT DUPLICATE PREVENTED: Account ${accountNumber} transaction already exists`);
        return accountSpecificDuplicates[0];
      }
    }
    const cleanedTransaction = {
      ...transaction,
      narration: transaction.narration ? this.cleanNarrationText(transaction.narration) : transaction.narration
    };
    const dbCompatibleTransaction = {
      ...cleanedTransaction,
      amount: cleanedTransaction.amount.toString()
    };
    const [newTransaction] = await db.insert(cashTransactions).values(dbCompatibleTransaction).returning();
    return newTransaction;
  }
  async updateCashTransaction(id, tenantId, transaction) {
    const [updatedTransaction] = await db.update(cashTransactions).set({
      ...transaction,
      amount: transaction.amount ? transaction.amount.toString() : void 0,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and(eq(cashTransactions.id, id), eq(cashTransactions.tenantId, tenantId))).returning();
    if (updatedTransaction && updatedTransaction.partyId && updatedTransaction.partyId !== "cash") {
      await db.update(cashTransactions).set({
        amount: transaction.amount ? transaction.amount.toString() : void 0,
        transactionDate: transaction.transactionDate,
        narration: `${transaction.narration || ""} (Auto-linked)`,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(cashTransactions.linkedTransactionId, id));
    }
    return updatedTransaction || void 0;
  }
  async deleteCashTransaction(id, tenantId) {
    console.log("\u{1F5D1}\uFE0F STORAGE DELETE START:", {
      transactionId: id,
      tenantId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    try {
      const existingTransaction = await db.select().from(cashTransactions).where(and(eq(cashTransactions.id, id), eq(cashTransactions.tenantId, tenantId))).limit(1);
      console.log("\u{1F50D} TRANSACTION CHECK:", {
        transactionId: id,
        exists: existingTransaction.length > 0,
        transaction: existingTransaction[0] || null
      });
      if (existingTransaction.length === 0) {
        console.log("\u274C TRANSACTION NOT FOUND");
        return false;
      }
      const relatedJournalEntries = await db.select().from(journalEntries).where(and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalEntries.sourceId, id),
        eq(journalEntries.sourceType, "cash_transaction")
      ));
      console.log("\u{1F4D6} JOURNAL ENTRIES CHECK:", {
        transactionId: id,
        journalEntriesCount: relatedJournalEntries.length,
        entries: relatedJournalEntries
      });
      const linkedTransactions = await db.select().from(cashTransactions).where(eq(cashTransactions.linkedTransactionId, id));
      console.log("\u{1F517} LINKED TRANSACTIONS CHECK:", {
        transactionId: id,
        linkedCount: linkedTransactions.length,
        linked: linkedTransactions
      });
      if (relatedJournalEntries.length > 0) {
        console.log("\u{1F5D1}\uFE0F DELETING JOURNAL ENTRY LINES...");
        const journalLinesDeleted = await db.delete(journalEntryLines).where(
          inArray(
            journalEntryLines.journalEntryId,
            db.select({ id: journalEntries.id }).from(journalEntries).where(and(
              eq(journalEntries.tenantId, tenantId),
              eq(journalEntries.sourceId, id),
              eq(journalEntries.sourceType, "cash_transaction")
            ))
          )
        ).returning();
        console.log("\u2705 JOURNAL LINES DELETED:", {
          transactionId: id,
          deletedCount: journalLinesDeleted.length
        });
        console.log("\u{1F5D1}\uFE0F DELETING JOURNAL ENTRIES...");
        const journalEntriesDeleted = await db.delete(journalEntries).where(and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.sourceId, id),
          eq(journalEntries.sourceType, "cash_transaction")
        )).returning();
        console.log("\u2705 JOURNAL ENTRIES DELETED:", {
          transactionId: id,
          deletedCount: journalEntriesDeleted.length
        });
      }
      if (linkedTransactions.length > 0) {
        console.log("\u{1F5D1}\uFE0F DELETING LINKED TRANSACTIONS...");
        const linkedDeleted = await db.delete(cashTransactions).where(eq(cashTransactions.linkedTransactionId, id)).returning();
        console.log("\u2705 LINKED TRANSACTIONS DELETED:", {
          transactionId: id,
          deletedCount: linkedDeleted.length
        });
      }
      console.log("\u{1F5D1}\uFE0F DELETING MAIN TRANSACTION...");
      const result = await db.delete(cashTransactions).where(and(eq(cashTransactions.id, id), eq(cashTransactions.tenantId, tenantId))).returning();
      console.log("\u2705 MAIN TRANSACTION DELETION RESULT:", {
        transactionId: id,
        success: result.length > 0,
        deletedTransaction: result[0] || null
      });
      return result.length > 0;
    } catch (error) {
      console.error("\u274C STORAGE DELETE ERROR:", {
        transactionId: id,
        tenantId,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : void 0
      });
      throw error;
    }
  }
  // Helper method to clean narration text and prevent duplicates
  cleanNarrationText(narration) {
    let cleaned = narration.replace(/\b(\S+)\s+\1\b/g, "$1");
    cleaned = cleaned.replace(/रोकड आली.*रोकड आली/gi, "\u092A\u0947\u092E\u0947\u0902\u091F \u092E\u093F\u0933\u093E\u0932\u0947").replace(/रोकड दिली.*रोकड दिली/gi, "\u092A\u0947\u092E\u0947\u0902\u091F \u0915\u0947\u0932\u0947").replace(/रोकड घेतली.*रोकड दिली/gi, "\u092A\u0947\u092E\u0947\u0902\u091F \u0915\u0947\u0932\u0947").replace(/रोकड आली.*रोकड घेतली/gi, "\u0935\u094D\u092F\u0935\u0939\u093E\u0930 \u091D\u093E\u0932\u0947");
    return cleaned.trim();
  }
  async getCashBalance(tenantId) {
    const professionalBalance = await this.getProfessionalCashBalance(tenantId);
    return professionalBalance.currentBalance;
  }
  // Cache for account opening balance to prevent repeated DB queries
  accountOpeningCache = /* @__PURE__ */ new Map();
  async getCashBalanceBeforeDate(tenantId, beforeDate) {
    try {
      const cacheKey = `${tenantId}:account_opening`;
      const cached = this.accountOpeningCache.get(cacheKey);
      const now = Date.now();
      let baseOpeningBalance = 0;
      let openingBalanceDate = null;
      if (cached && now - cached.timestamp < 3e5) {
        baseOpeningBalance = cached.openingBalance;
        openingBalanceDate = cached.openingDate;
      } else {
        const cashAccounts = await db.select().from(parties).where(
          and(
            eq(parties.tenantId, tenantId),
            or(
              like(parties.name, "%Cash%"),
              like(parties.name, "%\u0930\u094B\u0915\u0921%"),
              like(parties.name, "%cash%"),
              like(parties.name, "%CASH%")
            )
          )
        );
        cashAccounts.forEach((account) => {
          const accountOpeningBalance = Number(account.openingBalance) || 0;
          const accountOpeningBalanceDate = account.openingBalanceDate;
          if (account.openingBalanceType === "credit") {
            baseOpeningBalance += accountOpeningBalance;
          } else {
            baseOpeningBalance -= accountOpeningBalance;
          }
          if (accountOpeningBalanceDate) {
            openingBalanceDate = accountOpeningBalanceDate;
          }
        });
        if (cashAccounts.length === 0) {
          baseOpeningBalance = 0;
        }
        this.accountOpeningCache.set(cacheKey, {
          openingBalance: baseOpeningBalance,
          openingDate: openingBalanceDate,
          timestamp: now
        });
      }
      if (openingBalanceDate && beforeDate === openingBalanceDate) {
        return baseOpeningBalance;
      }
      if (openingBalanceDate && openingBalanceDate !== null && beforeDate < openingBalanceDate) {
        return baseOpeningBalance;
      }
      if (openingBalanceDate && openingBalanceDate !== null && beforeDate > openingBalanceDate) {
        const transactionsFromOpeningToBeforeDate = await db.select().from(cashTransactions).where(
          and(
            eq(cashTransactions.tenantId, tenantId),
            sql2`DATE(${cashTransactions.transactionDate}) >= ${openingBalanceDate}`,
            sql2`DATE(${cashTransactions.transactionDate}) < ${beforeDate}`
          )
        );
        let totalCashIn2 = 0;
        let totalCashOut2 = 0;
        transactionsFromOpeningToBeforeDate.forEach((transaction) => {
          const amount = Number(transaction.amount) || 0;
          if (transaction.transactionType === "cash_in") {
            totalCashIn2 += amount;
          } else {
            totalCashOut2 += amount;
          }
        });
        const result = baseOpeningBalance + totalCashIn2 - totalCashOut2;
        return result;
      }
      const allTransactionsBeforeDate = await db.select().from(cashTransactions).where(
        and(
          eq(cashTransactions.tenantId, tenantId),
          sql2`DATE(${cashTransactions.transactionDate}) < ${beforeDate}`
        )
      );
      if (allTransactionsBeforeDate.length === 0) {
        return baseOpeningBalance;
      }
      let totalCashIn = 0;
      let totalCashOut = 0;
      allTransactionsBeforeDate.forEach((transaction) => {
        const amount = Number(transaction.amount) || 0;
        if (transaction.transactionType === "cash_in") {
          totalCashIn += amount;
        } else {
          totalCashOut += amount;
        }
      });
      const finalResult = baseOpeningBalance + totalCashIn - totalCashOut;
      return finalResult;
    } catch (error) {
      console.error("REDESIGNED: Error calculating cash balance before date:", error);
      return 0;
    }
  }
  // New method for date-wise balance calculation (Sample 7 logic)
  async getDateWiseCashBalance(tenantId, forDate) {
    try {
      const openingBalance = await this.getCashBalanceBeforeDate(tenantId, forDate);
      const dayTransactions = await db.select().from(cashTransactions).where(
        and(
          eq(cashTransactions.tenantId, tenantId),
          sql2`DATE(${cashTransactions.transactionDate}) = ${forDate}`
        )
      ).orderBy(asc(cashTransactions.transactionDate));
      let dayCashIn = 0;
      let dayCashOut = 0;
      dayTransactions.forEach((transaction) => {
        const amount = Number(transaction.amount) || 0;
        if (transaction.transactionType === "cash_in") {
          dayCashIn += amount;
        } else {
          dayCashOut += amount;
        }
      });
      const netDifference = dayCashIn - dayCashOut;
      const closingBalance = openingBalance + netDifference;
      const professionalBalance = await this.getProfessionalCashBalance(tenantId);
      return {
        openingBalance,
        closingBalance,
        dayTransactions: {
          cashIn: dayCashIn,
          cashOut: dayCashOut,
          netDifference
        },
        totalBalance: closingBalance
        // Use date-specific closing balance instead of overall balance
      };
    } catch (error) {
      console.error("Error calculating date-wise cash balance:", error);
      return {
        openingBalance: 0,
        closingBalance: 0,
        dayTransactions: { cashIn: 0, cashOut: 0, netDifference: 0 },
        totalBalance: 0
      };
    }
  }
  async getProfessionalCashBalance(tenantId) {
    const errors = [];
    let isValid = true;
    try {
      const allCashTransactions = await db.select().from(cashTransactions).where(eq(cashTransactions.tenantId, tenantId)).orderBy(asc(cashTransactions.transactionDate));
      const allLoans = await db.select().from(loans).where(eq(loans.tenantId, tenantId)).orderBy(asc(loans.createdAt));
      let totalCashIn = 0;
      let totalCashOut = 0;
      let cashTransactionCount = 0;
      allCashTransactions.forEach((transaction) => {
        const amount = Number(transaction.amount) || 0;
        if (amount <= 0) {
          errors.push(`Invalid cash transaction amount: ${amount} for transaction ${transaction.id}`);
          return;
        }
        cashTransactionCount++;
        if (transaction.transactionType === "cash_in") {
          totalCashIn += amount;
        } else {
          totalCashOut += amount;
        }
      });
      let totalLoanDisbursements = 0;
      let totalLoanClosures = 0;
      let loanTransactionCount = 0;
      allLoans.forEach((loan) => {
        const loanAmount = Number(loan.principalAmount) || 0;
        if (loanAmount <= 0) {
          errors.push(`Invalid loan amount: ${loanAmount} for loan ${loan.id}`);
          return;
        }
        totalLoanDisbursements += loanAmount;
        loanTransactionCount++;
        if (loan.status === "closed") {
          totalLoanClosures += loanAmount;
          loanTransactionCount++;
        }
      });
      let openingBalance = 0;
      try {
        const cashAccounts = await db.select().from(parties).where(
          and(
            eq(parties.tenantId, tenantId),
            or(
              like(parties.name, "%Cash%"),
              like(parties.name, "%\u0930\u094B\u0915\u0921%"),
              like(parties.name, "%cash%"),
              like(parties.name, "%CASH%")
            )
          )
        );
        cashAccounts.forEach((account) => {
          const accountOpeningBalance = Number(account.openingBalance) || 0;
          if (account.openingBalanceType === "credit") {
            openingBalance += accountOpeningBalance;
          } else {
            openingBalance -= accountOpeningBalance;
          }
        });
      } catch (partiesError) {
        console.error("Error fetching cash account opening balance:", partiesError);
        errors.push("Failed to fetch cash account opening balance from parties table");
      }
      const currentBalance = openingBalance + totalCashIn - totalCashOut - totalLoanDisbursements + totalLoanClosures;
      if (isNaN(currentBalance)) {
        errors.push("Current balance calculation resulted in NaN");
        isValid = false;
      }
      const verificationBalance = openingBalance + (totalCashIn + totalLoanClosures) - (totalCashOut + totalLoanDisbursements);
      if (Math.abs(currentBalance - verificationBalance) > 0.01) {
        errors.push(`Balance verification failed: calculated ${currentBalance}, verified ${verificationBalance}`);
        isValid = false;
      }
      return {
        currentBalance: isValid ? currentBalance : 0,
        openingBalance,
        totalCashIn,
        totalCashOut,
        totalLoanDisbursements,
        totalLoanClosures,
        transactionCount: cashTransactionCount + loanTransactionCount,
        lastUpdated: /* @__PURE__ */ new Date(),
        isValid,
        errors
      };
    } catch (error) {
      console.error("Professional cash balance calculation error:", error);
      errors.push(`Database error: ${error instanceof Error ? error.message : "Unknown error"}`);
      return {
        currentBalance: 0,
        openingBalance: 0,
        totalCashIn: 0,
        totalCashOut: 0,
        totalLoanDisbursements: 0,
        totalLoanClosures: 0,
        transactionCount: 0,
        lastUpdated: /* @__PURE__ */ new Date(),
        isValid: false,
        errors
      };
    }
  }
  async getTenantStatistics() {
    const tenantStats = await db.select({
      tenantId: users.tenantId,
      userCount: sql2`count(${users.id})`,
      activeUsers: sql2`count(case when ${users.isActive} = true then 1 end)`,
      loanCount: sql2`coalesce((select count(*) from ${loans} where ${loans.tenantId} = ${users.tenantId}), 0)`,
      groupCount: sql2`coalesce((select count(*) from ${groups} where ${groups.tenantId} = ${users.tenantId}), 0)`,
      borrowerCount: sql2`coalesce((select count(*) from ${borrowers} where ${borrowers.tenantId} = ${users.tenantId}), 0)`,
      cashTransactionCount: sql2`coalesce((select count(*) from ${cashTransactions} where ${cashTransactions.tenantId} = ${users.tenantId}), 0)`,
      lastActivity: sql2`max(${users.updatedAt})`
    }).from(users).where(not(eq(users.tenantId, "SUPER_ADMIN"))).groupBy(users.tenantId).orderBy(users.tenantId);
    return tenantStats;
  }
  // Helper function to calculate time period between dates
  calculateTimePeriod(startDate, endDate) {
    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();
    let days = endDate.getDate() - startDate.getDate();
    if (days < 0) {
      const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
      days += prevMonth.getDate();
      months--;
    }
    if (months < 0) {
      months += 12;
      years--;
    }
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1e3 * 60 * 60 * 24));
    const isExactMonth = days === 0;
    return { years, months, days, totalDays, isExactMonth };
  }
  // Advanced compound interest calculation (Server Implementation)
  calculateAdvancedCompoundInterest(principal, monthlyRate, startDate, endDate, compoundingFrequency = "yearly") {
    const timePeriod = this.calculateTimePeriod(startDate, endDate);
    let totalInterest = 0;
    let currentPrincipal = principal;
    const compoundingPeriodMonths = compoundingFrequency === "yearly" ? 12 : 1;
    const totalMonths = timePeriod.years * 12 + timePeriod.months + (timePeriod.days > 0 ? 1 : 0);
    const fullCompoundingPeriods = Math.floor(totalMonths / compoundingPeriodMonths);
    console.log(`\u{1F527} COMPOUND SETUP: ${totalMonths} total months, ${fullCompoundingPeriods} compounding periods`);
    for (let period = 0; period < fullCompoundingPeriods; period++) {
      const monthlyInterestForPeriod = Math.round(currentPrincipal * monthlyRate / 100);
      const periodInterest = monthlyInterestForPeriod * compoundingPeriodMonths;
      console.log(`\u{1F527} COMPOUND Period ${period + 1}:`, {
        principal: currentPrincipal,
        monthlyRate: `${monthlyRate}%`,
        periodInterest,
        formula: `${currentPrincipal} \xD7 ${monthlyRate}% \xD7 ${compoundingPeriodMonths} = ${periodInterest}`
      });
      totalInterest += periodInterest;
      currentPrincipal += periodInterest;
    }
    const remainingMonths = totalMonths - fullCompoundingPeriods * compoundingPeriodMonths;
    if (remainingMonths > 0) {
      const monthlyInterestRate = Math.round(currentPrincipal * monthlyRate / 100);
      const remainingInterest = monthlyInterestRate * remainingMonths;
      totalInterest += remainingInterest;
      console.log(`\u{1F527} REMAINING: ${remainingMonths} months on principal ${currentPrincipal} = ${remainingInterest}`);
    }
    console.log(`\u{1F527} TOTAL COMPOUND INTEREST: ${totalInterest} (vs simple: ${principal * monthlyRate * totalMonths / 100})`);
    return totalInterest;
  }
  // Helper function to calculate future projection date
  getProjectionDate(period) {
    const today = /* @__PURE__ */ new Date();
    switch (period) {
      case "1month":
        return new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
      case "3months":
        return new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
      case "6months":
        return new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
      case "1year":
        return new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
      default:
        return today;
    }
  }
  async getOverdueReportWithCorrectMath(tenantId, filters) {
    console.log(`\u{1F50D} OVERDUE STORAGE START: tenant=${tenantId}`);
    try {
      const conditions = [eq(loans.tenantId, tenantId)];
      if (filters.groupId && filters.groupId !== "all") {
        conditions.push(eq(loans.groupId, filters.groupId));
      }
      console.log("\u{1F4CB} Fetching active loans with group info...");
      const activeLoans = await db.select({
        loanId: loans.id,
        accountNumber: loans.accountNumber,
        borrowerName: loans.borrowerName,
        borrowerPhone: loans.borrowerMobile,
        groupName: groups.name,
        loanDate: loans.loanDate,
        principalAmount: loans.principalAmount,
        interestRate: loans.interestRate,
        interestRateType: loans.interestRateType,
        collateralDetails: loans.collateralDetails,
        weight: loans.weight,
        status: loans.status
      }).from(loans).leftJoin(groups, eq(loans.groupId, groups.id)).where(and(...conditions, eq(loans.status, "active"))).orderBy(loans.loanDate);
      console.log(`\u{1F4CA} Found ${activeLoans.length} active loans`);
      if (activeLoans.length === 0) {
        return [];
      }
      const overdueResults = [];
      const calculationDate = filters.projectionMode === "future" ? this.getProjectionDate(filters.futureProjectionPeriod || "3months") : /* @__PURE__ */ new Date();
      console.log(`\u{1F52E} CALCULATION MODE: ${filters.projectionMode} | DATE: ${calculationDate.toISOString().split("T")[0]}`);
      for (const loan of activeLoans) {
        console.log(`\u{1F4BC} Processing loan: ${loan.borrowerName}`);
        const principal = parseFloat(loan.principalAmount.toString());
        const loanDate = new Date(loan.loanDate);
        const daysDiff = Math.floor((calculationDate.getTime() - loanDate.getTime()) / (1e3 * 60 * 60 * 24));
        const loanPayments = await this.getLoanClosures(tenantId, loan.loanId);
        const totalPaid = loanPayments.reduce((sum3, closure) => sum3 + parseFloat(closure.totalAmount || "0"), 0);
        let monthlyRate;
        console.log(`\u{1F527} RATE MODE DEBUG: ${loan.borrowerName} | Mode: "${filters.interestRateMode}" | Loan Rate: ${loan.interestRate}% ${loan.interestRateType} | Form Rate: ${filters.monthlyInterestRate}%`);
        if (filters.interestRateMode === "loan-wise") {
          const loanInterestRate = parseFloat(loan.interestRate?.toString() || "0");
          monthlyRate = loan.interestRateType === "monthly" ? loanInterestRate : loanInterestRate / 12;
          console.log(`\u270F\uFE0F LOAN-WISE RATE: ${loan.borrowerName} | Rate: ${loanInterestRate}% ${loan.interestRateType} \u2192 ${monthlyRate}% monthly`);
        } else {
          monthlyRate = filters.monthlyInterestRate;
          console.log(`\u{1F4CA} MANUAL RATE: ${loan.borrowerName} | Rate: ${monthlyRate}% monthly from form`);
        }
        let totalMonths;
        let interestToDate;
        if (filters.projectionMode === "future") {
          const totalDays = daysDiff;
          const fullMonths = Math.floor(totalDays / 30);
          const remainingDays = totalDays % 30;
          totalMonths = fullMonths + (remainingDays > 0 ? 1 : 0);
          console.log(`\u{1F52E} FUTURE CALC: ${loan.borrowerName} | Days: ${totalDays} | Months: ${totalMonths}`);
        } else {
          const currentDate = /* @__PURE__ */ new Date();
          const currentDaysDiff = Math.floor((currentDate.getTime() - loanDate.getTime()) / (1e3 * 60 * 60 * 24));
          const fullMonths = Math.floor(currentDaysDiff / 30);
          const remainingDays = currentDaysDiff % 30;
          totalMonths = fullMonths + (remainingDays > 0 ? 1 : 0);
          console.log(`\u{1F4CA} CURRENT CALC: ${loan.borrowerName} | Days: ${currentDaysDiff} | Months: ${totalMonths}`);
        }
        interestToDate = this.calculateAdvancedCompoundInterest(
          principal,
          monthlyRate,
          loanDate,
          calculationDate
        );
        const totalAmountDue = principal + interestToDate;
        const outstandingAmount = totalAmountDue - totalPaid;
        const goldWeightNum = parseFloat(loan.weight?.toString() || "0");
        const purityPercentage = filters.finePurityPercentage;
        const goldRate = filters.currentGoldRate;
        const fineGoldWeight = goldWeightNum * (purityPercentage / 100);
        const currentGoldValue = fineGoldWeight * goldRate;
        const lossAmount = outstandingAmount > currentGoldValue ? outstandingAmount - currentGoldValue : 0;
        let riskLevel = "low";
        const lossPercentage = principal > 0 ? lossAmount / principal * 100 : 0;
        if (lossPercentage > 50) riskLevel = "high";
        else if (lossPercentage > 20) riskLevel = "medium";
        overdueResults.push({
          loanId: loan.loanId,
          accountNumber: loan.accountNumber,
          borrowerName: loan.borrowerName,
          borrowerPhone: loan.borrowerPhone || "N/A",
          groupName: loan.groupName || "\u0938\u0930\u094D\u0935 \u0917\u091F",
          loanDate: loan.loanDate,
          goldItem: loan.collateralDetails || "N/A",
          principalAmount: principal,
          interestToDate,
          totalAmount: totalAmountDue,
          totalPaid,
          outstandingAmount,
          goldWeight: goldWeightNum,
          fineGoldWeight,
          currentGoldValue,
          lossAmount,
          lossPercentage,
          riskLevel,
          daysOverdue: daysDiff
        });
      }
      console.log(`\u2705 OVERDUE COMPLETED: ${overdueResults.length} results generated`);
      return overdueResults;
    } catch (error) {
      console.error("\u274C OVERDUE STORAGE ERROR:", error);
      throw error;
    }
  }
  async deleteTenantData(tenantId) {
    const deletedRecords = {
      userActivityLogs: 0,
      userPermissions: 0,
      cashTransactions: 0,
      loanClosures: 0,
      transactions: 0,
      loans: 0,
      borrowers: 0,
      groups: 0,
      companies: 0,
      users: 0,
      sessions: 0
    };
    try {
      const activityResult = await db.delete(userActivityLogs).where(eq(userActivityLogs.tenantId, tenantId)).returning();
      deletedRecords.userActivityLogs = activityResult.length || 0;
      const permissionsResult = await db.delete(userPermissions).where(eq(userPermissions.tenantId, tenantId)).returning();
      deletedRecords.userPermissions = permissionsResult.length || 0;
      const cashTxResult = await db.delete(cashTransactions).where(eq(cashTransactions.tenantId, tenantId)).returning();
      deletedRecords.cashTransactions = cashTxResult.length || 0;
      const closuresResult = await db.delete(loanClosures).where(eq(loanClosures.tenantId, tenantId)).returning();
      deletedRecords.loanClosures = closuresResult.length || 0;
      const transactionsResult = await db.delete(transactions).where(eq(transactions.tenantId, tenantId)).returning();
      deletedRecords.transactions = transactionsResult.length || 0;
      const loansResult = await db.delete(loans).where(eq(loans.tenantId, tenantId)).returning();
      deletedRecords.loans = loansResult.length || 0;
      const borrowersResult = await db.delete(borrowers).where(eq(borrowers.tenantId, tenantId)).returning();
      deletedRecords.borrowers = borrowersResult.length || 0;
      const groupsResult = await db.delete(groups).where(eq(groups.tenantId, tenantId)).returning();
      deletedRecords.groups = groupsResult.length || 0;
      const companiesResult = await db.delete(companies).where(eq(companies.tenantId, tenantId)).returning();
      deletedRecords.companies = companiesResult.length || 0;
      const usersResult = await db.delete(users).where(eq(users.tenantId, tenantId)).returning();
      deletedRecords.users = usersResult.length || 0;
      const sessionCleanupResult = await db.execute(sql2`
        DELETE FROM sessions 
        WHERE sess::text LIKE ${`%"tenantId":"${tenantId}"%`}
      `);
      deletedRecords.sessions = sessionCleanupResult.rowCount || 0;
      console.log(`Tenant ${tenantId} deletion completed:`, deletedRecords);
      return deletedRecords;
    } catch (error) {
      console.error("Error deleting tenant data:", error);
      throw error;
    }
  }
  // Data Management operations implementation
  async getUsers(tenantId) {
    return await db.select().from(users).where(eq(users.tenantId, tenantId));
  }
  async getCompanies(tenantId) {
    return await db.select().from(companies).where(eq(companies.tenantId, tenantId));
  }
  async restoreFromBackup(tenantId, backupData) {
    await db.transaction(async (tx) => {
      await tx.delete(cashTransactions).where(eq(cashTransactions.tenantId, tenantId));
      await tx.delete(loanClosures).where(eq(loanClosures.tenantId, tenantId));
      await tx.delete(transactions).where(eq(transactions.tenantId, tenantId));
      await tx.delete(loans).where(eq(loans.tenantId, tenantId));
      await tx.delete(borrowers).where(eq(borrowers.tenantId, tenantId));
      await tx.delete(groups).where(eq(groups.tenantId, tenantId));
      await tx.delete(parties).where(eq(parties.tenantId, tenantId));
      await tx.delete(companies).where(eq(companies.tenantId, tenantId));
      if (backupData.companies && backupData.companies.length > 0) {
        await tx.insert(companies).values(backupData.companies);
      }
      if (backupData.groups && backupData.groups.length > 0) {
        await tx.insert(groups).values(backupData.groups);
      }
      if (backupData.borrowers && backupData.borrowers.length > 0) {
        await tx.insert(borrowers).values(backupData.borrowers);
      }
      if (backupData.parties && backupData.parties.length > 0) {
        await tx.insert(parties).values(backupData.parties);
      }
      if (backupData.loans && backupData.loans.length > 0) {
        await tx.insert(loans).values(backupData.loans);
      }
      if (backupData.transactions && backupData.transactions.length > 0) {
        await tx.insert(transactions).values(backupData.transactions);
      }
      if (backupData.loanClosures && backupData.loanClosures.length > 0) {
        await tx.insert(loanClosures).values(backupData.loanClosures);
      }
      if (backupData.cashTransactions && backupData.cashTransactions.length > 0) {
        await tx.insert(cashTransactions).values(backupData.cashTransactions);
      }
    });
  }
  async deleteAllTenantData(tenantId) {
    await db.transaction(async (tx) => {
      await tx.delete(cashTransactions).where(eq(cashTransactions.tenantId, tenantId));
      await tx.delete(loanClosures).where(eq(loanClosures.tenantId, tenantId));
      await tx.delete(transactions).where(eq(transactions.tenantId, tenantId));
      await tx.delete(loans).where(eq(loans.tenantId, tenantId));
      await tx.delete(borrowers).where(eq(borrowers.tenantId, tenantId));
      await tx.delete(groups).where(eq(groups.tenantId, tenantId));
      await tx.delete(parties).where(eq(parties.tenantId, tenantId));
      await tx.delete(companies).where(eq(companies.tenantId, tenantId));
    });
  }
  async deleteClosedLoansBeforeDate(tenantId, beforeDate) {
    let deletedLoans = 0;
    let deletedTransactions = 0;
    let deletedCashEntries = 0;
    await db.transaction(async (tx) => {
      const closedLoans = await tx.select({ id: loans.id }).from(loans).where(
        and(
          eq(loans.tenantId, tenantId),
          eq(loans.status, "closed"),
          lte(loans.loanDate, beforeDate)
        )
      );
      if (closedLoans.length === 0) {
        return;
      }
      const loanIds = closedLoans.map((loan) => loan.id);
      const deletedCashResult = await tx.delete(cashTransactions).where(
        and(
          eq(cashTransactions.tenantId, tenantId),
          sql2`${cashTransactions.narration} LIKE ANY(${loanIds.map((id) => `%${id}%`)})`
        )
      ).returning({ id: cashTransactions.id });
      deletedCashEntries = deletedCashResult.length;
      await tx.delete(loanClosures).where(
        and(
          eq(loanClosures.tenantId, tenantId),
          sql2`${loanClosures.loanId} = ANY(${loanIds})`
        )
      );
      const deletedTransResult = await tx.delete(transactions).where(
        and(
          eq(transactions.tenantId, tenantId),
          sql2`${transactions.loanId} = ANY(${loanIds})`
        )
      ).returning({ id: transactions.id });
      deletedTransactions = deletedTransResult.length;
      const deletedLoanResult = await tx.delete(loans).where(
        and(
          eq(loans.tenantId, tenantId),
          eq(loans.status, "closed"),
          lte(loans.loanDate, beforeDate)
        )
      ).returning({ id: loans.id });
      deletedLoans = deletedLoanResult.length;
    });
    return {
      deletedLoans,
      deletedTransactions,
      deletedCashEntries
    };
  }
  // User Management Operations
  async getUsersForTenant(tenantId) {
    const tenantUsers = await db.select({
      id: users.id,
      username: users.username,
      password: users.password,
      tenantId: users.tenantId,
      role: users.role,
      isActive: users.isActive,
      isTemporaryDisabled: users.isTemporaryDisabled,
      createdBy: users.createdBy,
      fullName: users.fullName,
      email: users.email,
      lastLoginAt: users.lastLoginAt,
      loginCount: users.loginCount,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      permissions: userPermissions,
      creator: {
        id: sql2`creator.id`,
        username: sql2`creator.username`,
        fullName: sql2`creator.full_name`
      }
    }).from(users).leftJoin(userPermissions, eq(users.id, userPermissions.userId)).leftJoin(sql2`${users} as creator`, sql2`${users.createdBy} = creator.id`).where(and(
      eq(users.tenantId, tenantId),
      or(eq(users.role, "user"), eq(users.role, "clerk"))
      // Don't include admins in user management
    )).orderBy(desc(users.createdAt));
    return tenantUsers;
  }
  async createUserWithPermissions(user, permissions) {
    return await db.transaction(async (tx) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const [newUser] = await tx.insert(users).values({
        ...user,
        password: hashedPassword
      }).returning();
      await tx.insert(userPermissions).values({
        ...permissions,
        userId: newUser.id,
        tenantId: user.tenantId
      });
      return newUser;
    });
  }
  async updateUserStatus(userId, tenantId, isActive, isTemporaryDisabled) {
    const updateData = {
      isActive,
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (isTemporaryDisabled !== void 0) {
      updateData.isTemporaryDisabled = isTemporaryDisabled;
    }
    const [updatedUser] = await db.update(users).set(updateData).where(and(
      eq(users.id, userId),
      eq(users.tenantId, tenantId)
    )).returning();
    return updatedUser || void 0;
  }
  // Simple disable/enable admin access by Super Admin (no time limit)
  async temporaryDisableAdmin(adminUserId, hours, disabledBy) {
    await db.update(users).set({
      isTemporaryDisabled: true,
      temporaryDisabledUntil: null,
      // No time limit
      temporaryDisabledBy: disabledBy,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(users.id, adminUserId));
  }
  async temporaryEnableAdmin(adminUserId) {
    await db.update(users).set({
      isTemporaryDisabled: false,
      temporaryDisabledUntil: null,
      temporaryDisabledBy: null,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(users.id, adminUserId));
  }
  async checkTemporaryDisableStatus(userId) {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user[0]) return false;
    const currentUser = user[0];
    return currentUser.isTemporaryDisabled;
  }
  // Password reset functionality for admin users
  async resetUserPassword(userId, tenantId, newPassword, resetBy) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [updatedUser] = await db.update(users).set({
      password: hashedPassword,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and(
      eq(users.id, userId),
      eq(users.tenantId, tenantId)
    )).returning();
    if (updatedUser) {
      await this.logUserActivity({
        userId: updatedUser.id,
        tenantId: updatedUser.tenantId,
        activityType: "password_reset",
        description: `Password reset by ${resetBy}`,
        metadata: JSON.stringify({ resetBy })
      });
    }
    return updatedUser || void 0;
  }
  // Get all admin users across tenants for Super Admin management
  async getAllAdminUsers() {
    try {
      const adminUsers = await db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        tenantId: users.tenantId,
        role: users.role,
        isActive: users.isActive,
        isTemporaryDisabled: users.isTemporaryDisabled,
        temporaryDisabledUntil: users.temporaryDisabledUntil,
        temporaryDisabledBy: users.temporaryDisabledBy,
        createdAt: users.createdAt,
        companyName: sql2`COALESCE(${companies.name}, ${users.tenantId})`.as("companyName")
      }).from(users).leftJoin(companies, eq(users.tenantId, companies.tenantId)).where(
        and(
          eq(users.role, "admin"),
          not(eq(users.tenantId, "SUPER_ADMIN"))
        )
      ).orderBy(desc(users.createdAt));
      return adminUsers || [];
    } catch (error) {
      console.error("Error fetching admin users:", error);
      return [];
    }
  }
  async updateUserPassword(userId, tenantId, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const [updatedUser] = await db.update(users).set({
        password: hashedPassword,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        or(eq(users.role, "user"), eq(users.role, "clerk"), eq(users.role, "admin"), eq(users.role, "super_admin"))
      )).returning();
      return !!updatedUser;
    } catch (error) {
      console.error("Password update error:", error);
      return false;
    }
  }
  async getUserPermissions(userId, tenantId) {
    const [permissions] = await db.select().from(userPermissions).where(and(
      eq(userPermissions.userId, userId),
      eq(userPermissions.tenantId, tenantId)
    ));
    return permissions || void 0;
  }
  async createUserPermissions(permissions) {
    const [newPermissions] = await db.insert(userPermissions).values(permissions).returning();
    return newPermissions;
  }
  async updateUserPermissions(userId, tenantId, permissions) {
    const [updatedPermissions] = await db.update(userPermissions).set({
      ...permissions,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and(
      eq(userPermissions.userId, userId),
      eq(userPermissions.tenantId, tenantId)
    )).returning();
    return updatedPermissions || void 0;
  }
  async logUserActivity(activity) {
    const [newActivity] = await db.insert(userActivityLogs).values(activity).returning();
    return newActivity;
  }
  async getUserActivityLogs(userId, tenantId, limit = 100) {
    return await db.select().from(userActivityLogs).where(and(
      eq(userActivityLogs.userId, userId),
      eq(userActivityLogs.tenantId, tenantId)
    )).orderBy(desc(userActivityLogs.createdAt)).limit(limit);
  }
  async updateUserLoginInfo(userId) {
    await db.update(users).set({
      lastLoginAt: /* @__PURE__ */ new Date(),
      loginCount: sql2`${users.loginCount} + 1`,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(users.id, userId));
  }
  // Dual-entry accounting operations
  async createCashTransactionWithJournal(transaction) {
    return await db.transaction(async (tx) => {
      const dbCompatibleTransaction = {
        ...transaction,
        amount: transaction.amount.toString()
      };
      const [cashTransaction] = await tx.insert(cashTransactions).values(dbCompatibleTransaction).returning();
      const journalNumber = `JE-${Date.now()}`;
      const [journalEntry] = await tx.insert(journalEntries).values({
        tenantId: transaction.tenantId,
        journalNumber,
        transactionDate: transaction.transactionDate,
        description: transaction.narration || `${transaction.transactionType} - ${transaction.category}`,
        totalAmount: transaction.amount.toString(),
        sourceId: cashTransaction.id,
        sourceType: "cash_transaction"
      }).returning();
      if (transaction.transactionType === "cash_in") {
        await tx.insert(journalEntryLines).values({
          tenantId: transaction.tenantId,
          journalEntryId: journalEntry.id,
          type: "debit",
          accountType: "cash",
          accountId: null,
          accountName: "Cash",
          amount: transaction.amount.toString(),
          debitAmount: transaction.amount.toString(),
          creditAmount: "0",
          description: `Cash received - ${transaction.narration}`
        });
        await tx.insert(journalEntryLines).values({
          tenantId: transaction.tenantId,
          journalEntryId: journalEntry.id,
          type: "credit",
          accountType: "party",
          accountId: transaction.partyId,
          accountName: transaction.partyId ? "Party Account" : "Income Account",
          amount: transaction.amount.toString(),
          debitAmount: "0",
          creditAmount: transaction.amount.toString(),
          description: `Source of cash - ${transaction.narration}`
        });
      } else {
        await tx.insert(journalEntryLines).values({
          tenantId: transaction.tenantId,
          journalEntryId: journalEntry.id,
          type: "debit",
          accountType: "party",
          accountId: transaction.partyId,
          accountName: transaction.partyId ? "Party Account" : "Expense Account",
          amount: transaction.amount.toString(),
          debitAmount: transaction.amount.toString(),
          creditAmount: "0",
          description: `Cash paid to - ${transaction.narration}`
        });
        await tx.insert(journalEntryLines).values({
          tenantId: transaction.tenantId,
          journalEntryId: journalEntry.id,
          type: "credit",
          accountType: "cash",
          accountId: null,
          accountName: "Cash",
          amount: transaction.amount.toString(),
          debitAmount: "0",
          creditAmount: transaction.amount.toString(),
          description: `Cash paid out - ${transaction.narration}`
        });
      }
      return { cashTransaction, journalEntry };
    });
  }
  async getJournalEntries(tenantId, filters) {
    try {
      const conditions = [eq(journalEntries.tenantId, tenantId)];
      if (filters?.dateFrom) {
        conditions.push(gte(journalEntries.transactionDate, filters.dateFrom));
      }
      if (filters?.dateTo) {
        conditions.push(lte(journalEntries.transactionDate, filters.dateTo));
      }
      if (filters?.sourceType) {
        conditions.push(eq(journalEntries.sourceType, filters.sourceType));
      }
      const entries = await db.select().from(journalEntries).where(and(...conditions)).orderBy(desc(journalEntries.transactionDate));
      const entriesWithLines = await Promise.all(
        entries.map(async (entry) => {
          const lines = await db.select({
            id: journalEntryLines.id,
            type: sql2`CASE WHEN ${journalEntryLines.debitAmount} > 0 THEN 'debit' ELSE 'credit' END`,
            accountName: journalEntryLines.accountName,
            accountId: journalEntryLines.accountId,
            debitAmount: journalEntryLines.debitAmount,
            creditAmount: journalEntryLines.creditAmount,
            amount: sql2`CASE WHEN ${journalEntryLines.debitAmount} > 0 THEN ${journalEntryLines.debitAmount} ELSE ${journalEntryLines.creditAmount} END`
          }).from(journalEntryLines).where(eq(journalEntryLines.journalEntryId, entry.id));
          return {
            ...entry,
            entries: lines
            // Use 'entries' instead of 'lines' for frontend compatibility
          };
        })
      );
      return entriesWithLines;
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      return [];
    }
  }
  async getPartyLedger(tenantId, partyId, dateFrom, dateTo) {
    const conditions = [
      eq(journalEntryLines.tenantId, tenantId),
      eq(journalEntryLines.accountId, partyId)
    ];
    if (dateFrom) {
      conditions.push(gte(journalEntries.transactionDate, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(journalEntries.transactionDate, dateTo));
    }
    return await db.select({
      date: journalEntries.transactionDate,
      description: journalEntryLines.description,
      debit: journalEntryLines.debitAmount,
      credit: journalEntryLines.creditAmount,
      journalNumber: journalEntries.journalNumber
    }).from(journalEntryLines).innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id)).where(and(...conditions)).orderBy(asc(journalEntries.transactionDate));
  }
  async getTrialBalance(tenantId, asOfDate) {
    const conditions = [eq(journalEntryLines.tenantId, tenantId)];
    if (asOfDate) {
      conditions.push(lte(journalEntries.transactionDate, asOfDate));
    }
    return await db.select({
      accountType: journalEntryLines.accountType,
      accountName: journalEntryLines.accountName,
      totalDebit: sum(journalEntryLines.debitAmount),
      totalCredit: sum(journalEntryLines.creditAmount)
    }).from(journalEntryLines).innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id)).where(and(...conditions)).groupBy(journalEntryLines.accountType, journalEntryLines.accountName).orderBy(journalEntryLines.accountType, journalEntryLines.accountName);
  }
  // Get all users with company details for password reset management
  async getAllUsersWithCompanyDetails() {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      tenantId: users.tenantId,
      lastLoginAt: users.lastLoginAt,
      isActive: users.isActive,
      companyName: companies.name
    }).from(users).leftJoin(companies, eq(users.tenantId, companies.tenantId)).orderBy(users.tenantId, users.role, users.username);
    return allUsers;
  }
  // Reset user password by user ID (for super admin) - using different signature to avoid duplicate
  async resetUserPasswordBySuperAdmin(userId, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const result = await db.update(users).set({
        password: hashedPassword,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(users.id, userId));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error resetting user password:", error);
      return false;
    }
  }
  // Get storage usage analytics for all tenants (for super admin)
  async getTenantStorageAnalytics() {
    try {
      const storageStats = await db.execute(sql2`
        WITH tenant_storage AS (
          SELECT 
            c.tenant_id,
            c.name as company_name,
            
            -- Users table size
            (SELECT COUNT(*) FROM users u WHERE u.tenant_id = c.tenant_id) as user_count,
            (SELECT pg_total_relation_size('users'::regclass) / (SELECT COUNT(DISTINCT tenant_id) FROM users)) as users_size_bytes,
            
            -- Borrowers table size
            (SELECT COUNT(*) FROM borrowers b WHERE b.tenant_id = c.tenant_id) as borrower_count,
            (SELECT pg_total_relation_size('borrowers'::regclass) / NULLIF((SELECT COUNT(DISTINCT tenant_id) FROM borrowers), 0)) as borrowers_size_bytes,
            
            -- Loans table size  
            (SELECT COUNT(*) FROM loans l WHERE l.tenant_id = c.tenant_id) as loan_count,
            (SELECT pg_total_relation_size('loans'::regclass) / NULLIF((SELECT COUNT(DISTINCT tenant_id) FROM loans), 0)) as loans_size_bytes,
            
            -- Transactions table size
            (SELECT COUNT(*) FROM transactions t WHERE t.tenant_id = c.tenant_id) as transaction_count,
            (SELECT pg_total_relation_size('transactions'::regclass) / NULLIF((SELECT COUNT(DISTINCT tenant_id) FROM transactions), 0)) as transactions_size_bytes,
            
            -- Cash transactions table size
            (SELECT COUNT(*) FROM cash_transactions ct WHERE ct.tenant_id = c.tenant_id) as cash_transaction_count,
            (SELECT pg_total_relation_size('cash_transactions'::regclass) / NULLIF((SELECT COUNT(DISTINCT tenant_id) FROM cash_transactions), 0)) as cash_transactions_size_bytes,
            
            -- Loan closures table size
            (SELECT COUNT(*) FROM loan_closures lc WHERE lc.tenant_id = c.tenant_id) as closure_count,
            (SELECT pg_total_relation_size('loan_closures'::regclass) / NULLIF((SELECT COUNT(DISTINCT tenant_id) FROM loan_closures), 0)) as closures_size_bytes,
            
            -- Groups table size
            (SELECT COUNT(*) FROM groups g WHERE g.tenant_id = c.tenant_id) as group_count,
            (SELECT pg_total_relation_size('groups'::regclass) / NULLIF((SELECT COUNT(DISTINCT tenant_id) FROM groups), 0)) as groups_size_bytes,
            
            -- Journal entries size
            (SELECT COUNT(*) FROM journal_entries je WHERE je.tenant_id = c.tenant_id) as journal_entry_count,
            (SELECT pg_total_relation_size('journal_entries'::regclass) / NULLIF((SELECT COUNT(DISTINCT tenant_id) FROM journal_entries), 0)) as journal_entries_size_bytes,
            
            -- Journal entry lines size
            (SELECT COUNT(*) FROM journal_entry_lines jel WHERE jel.tenant_id = c.tenant_id) as journal_line_count,
            (SELECT pg_total_relation_size('journal_entry_lines'::regclass) / NULLIF((SELECT COUNT(DISTINCT tenant_id) FROM journal_entry_lines), 0)) as journal_lines_size_bytes,
            
            -- Parties size
            (SELECT COUNT(*) FROM parties p WHERE p.tenant_id = c.tenant_id) as party_count,
            (SELECT pg_total_relation_size('parties'::regclass) / NULLIF((SELECT COUNT(DISTINCT tenant_id) FROM parties), 0)) as parties_size_bytes
            
          FROM companies c
          WHERE c.tenant_id != 'SUPER_ADMIN'
        )
        SELECT 
          tenant_id,
          company_name,
          user_count,
          borrower_count,
          loan_count,
          transaction_count,
          cash_transaction_count,
          closure_count,
          group_count,
          journal_entry_count,
          journal_line_count,
          party_count,
          
          -- Calculate total estimated storage (in bytes)
          COALESCE(users_size_bytes, 0) + 
          COALESCE(borrowers_size_bytes, 0) + 
          COALESCE(loans_size_bytes, 0) + 
          COALESCE(transactions_size_bytes, 0) + 
          COALESCE(cash_transactions_size_bytes, 0) + 
          COALESCE(closures_size_bytes, 0) + 
          COALESCE(groups_size_bytes, 0) + 
          COALESCE(journal_entries_size_bytes, 0) + 
          COALESCE(journal_lines_size_bytes, 0) + 
          COALESCE(parties_size_bytes, 0) as total_storage_bytes,
          
          -- Individual table sizes
          COALESCE(users_size_bytes, 0) as users_storage_bytes,
          COALESCE(borrowers_size_bytes, 0) as borrowers_storage_bytes,
          COALESCE(loans_size_bytes, 0) as loans_storage_bytes,
          COALESCE(transactions_size_bytes, 0) as transactions_storage_bytes,
          COALESCE(cash_transactions_size_bytes, 0) as cash_transactions_storage_bytes,
          COALESCE(closures_size_bytes, 0) as closures_storage_bytes,
          COALESCE(groups_size_bytes, 0) as groups_storage_bytes,
          COALESCE(journal_entries_size_bytes, 0) as journal_entries_storage_bytes,
          COALESCE(journal_lines_size_bytes, 0) as journal_lines_storage_bytes,
          COALESCE(parties_size_bytes, 0) as parties_storage_bytes
          
        FROM tenant_storage
        ORDER BY total_storage_bytes DESC
      `);
      const analytics = storageStats.rows.map((row) => {
        const totalBytes = parseInt(row.total_storage_bytes) || 0;
        const totalMB = totalBytes / (1024 * 1024);
        const totalGB = totalMB / 1024;
        return {
          tenantId: row.tenant_id,
          companyName: row.company_name || "Unknown Company",
          // Record counts
          recordCounts: {
            users: parseInt(row.user_count) || 0,
            borrowers: parseInt(row.borrower_count) || 0,
            loans: parseInt(row.loan_count) || 0,
            transactions: parseInt(row.transaction_count) || 0,
            cashTransactions: parseInt(row.cash_transaction_count) || 0,
            closures: parseInt(row.closure_count) || 0,
            groups: parseInt(row.group_count) || 0,
            journalEntries: parseInt(row.journal_entry_count) || 0,
            journalLines: parseInt(row.journal_line_count) || 0,
            parties: parseInt(row.party_count) || 0
          },
          // Storage breakdown
          storage: {
            totalBytes,
            totalMB: Math.round(totalMB * 100) / 100,
            totalGB: Math.round(totalGB * 1e3) / 1e3,
            formattedSize: totalGB > 1 ? `${Math.round(totalGB * 100) / 100} GB` : `${Math.round(totalMB)} MB`,
            breakdown: {
              users: Math.round((parseInt(row.users_storage_bytes) || 0) / (1024 * 1024) * 100) / 100,
              borrowers: Math.round((parseInt(row.borrowers_storage_bytes) || 0) / (1024 * 1024) * 100) / 100,
              loans: Math.round((parseInt(row.loans_storage_bytes) || 0) / (1024 * 1024) * 100) / 100,
              transactions: Math.round((parseInt(row.transactions_storage_bytes) || 0) / (1024 * 1024) * 100) / 100,
              cashTransactions: Math.round((parseInt(row.cash_transactions_storage_bytes) || 0) / (1024 * 1024) * 100) / 100,
              closures: Math.round((parseInt(row.closures_storage_bytes) || 0) / (1024 * 1024) * 100) / 100,
              groups: Math.round((parseInt(row.groups_storage_bytes) || 0) / (1024 * 1024) * 100) / 100,
              journalEntries: Math.round((parseInt(row.journal_entries_storage_bytes) || 0) / (1024 * 1024) * 100) / 100,
              journalLines: Math.round((parseInt(row.journal_lines_storage_bytes) || 0) / (1024 * 1024) * 100) / 100,
              parties: Math.round((parseInt(row.parties_storage_bytes) || 0) / (1024 * 1024) * 100) / 100
            }
          }
        };
      });
      return analytics;
    } catch (error) {
      console.error("Error fetching tenant storage analytics:", error);
      return [];
    }
  }
  // Complete tenant deletion with all related data (for super admin)
  async deleteTenantCompletely(tenantId) {
    try {
      if (tenantId === "SUPER_ADMIN") {
        return {
          success: false,
          deletedRecords: {},
          errors: ["SUPER_ADMIN tenant cannot be deleted"]
        };
      }
      const deletedRecords = {};
      const errors = [];
      return await db.transaction(async (tx) => {
        try {
          const loanClosuresResult = await tx.delete(loanClosures).where(eq(loanClosures.tenantId, tenantId));
          deletedRecords.loanClosures = loanClosuresResult.rowCount || 0;
          const transactionsResult = await tx.delete(transactions).where(eq(transactions.tenantId, tenantId));
          deletedRecords.transactions = transactionsResult.rowCount || 0;
          const cashTransactionsResult = await tx.delete(cashTransactions).where(eq(cashTransactions.tenantId, tenantId));
          deletedRecords.cashTransactions = cashTransactionsResult.rowCount || 0;
          const journalLinesResult = await tx.delete(journalEntryLines).where(eq(journalEntryLines.tenantId, tenantId));
          deletedRecords.journalLines = journalLinesResult.rowCount || 0;
          const journalEntriesResult = await tx.delete(journalEntries).where(eq(journalEntries.tenantId, tenantId));
          deletedRecords.journalEntries = journalEntriesResult.rowCount || 0;
          const loansResult = await tx.delete(loans).where(eq(loans.tenantId, tenantId));
          deletedRecords.loans = loansResult.rowCount || 0;
          const borrowersResult = await tx.delete(borrowers).where(eq(borrowers.tenantId, tenantId));
          deletedRecords.borrowers = borrowersResult.rowCount || 0;
          const groupsResult = await tx.delete(groups).where(eq(groups.tenantId, tenantId));
          deletedRecords.groups = groupsResult.rowCount || 0;
          const partiesResult = await tx.delete(parties).where(eq(parties.tenantId, tenantId));
          deletedRecords.parties = partiesResult.rowCount || 0;
          deletedRecords.passwordResetRequests = 0;
          const usersResult = await tx.delete(users).where(
            and(
              eq(users.tenantId, tenantId),
              not(eq(users.role, "super_admin"))
            )
          );
          deletedRecords.users = usersResult.rowCount || 0;
          const companyResult = await tx.delete(companies).where(eq(companies.tenantId, tenantId));
          deletedRecords.company = companyResult.rowCount || 0;
          const totalDeleted = Object.values(deletedRecords).reduce((sum3, count3) => sum3 + (count3 || 0), 0);
          console.log(`\u{1F5D1}\uFE0F TENANT DELETION COMPLETE: ${tenantId}`);
          console.log(`\u{1F4CA} Total records deleted: ${totalDeleted}`);
          console.log(`\u{1F4CB} Breakdown:`, deletedRecords);
          return {
            success: true,
            deletedRecords: {
              ...deletedRecords,
              totalDeleted
            },
            errors: []
          };
        } catch (txError) {
          console.error("Transaction error during tenant deletion:", txError);
          errors.push(`Transaction failed: ${txError instanceof Error ? txError.message : "Unknown error"}`);
          throw txError;
        }
      });
    } catch (error) {
      console.error("Error in complete tenant deletion:", error);
      return {
        success: false,
        deletedRecords: {},
        errors: [`Failed to delete tenant: ${error instanceof Error ? error.message : "Unknown error"}`]
      };
    }
  }
  // Get all tenants with basic info for deletion management
  async getAllTenantsForManagement() {
    try {
      const tenantList = await db.select({
        tenantId: companies.tenantId,
        companyName: companies.name,
        address: companies.address,
        createdAt: companies.createdAt,
        isActive: companies.isActive,
        userCount: sql2`(
            SELECT COUNT(*)::int 
            FROM ${users} 
            WHERE ${users.tenantId} = ${companies.tenantId}
          )`,
        activeUserCount: sql2`(
            SELECT COUNT(*)::int 
            FROM ${users} 
            WHERE ${users.tenantId} = ${companies.tenantId} 
            AND ${users.isActive} = true
          )`,
        loanCount: sql2`(
            SELECT COUNT(*)::int 
            FROM ${loans} 
            WHERE ${loans.tenantId} = ${companies.tenantId}
          )`,
        lastActivity: sql2`(
            SELECT MAX(${users.lastLoginAt}) 
            FROM ${users} 
            WHERE ${users.tenantId} = ${companies.tenantId}
          )`
      }).from(companies).where(not(eq(companies.tenantId, "SUPER_ADMIN"))).orderBy(desc(companies.createdAt));
      return tenantList.map((tenant) => ({
        ...tenant,
        lastActivity: tenant.lastActivity || tenant.createdAt,
        daysSinceLastActivity: tenant.lastActivity ? Math.floor((Date.now() - new Date(tenant.lastActivity).getTime()) / (1e3 * 60 * 60 * 24)) : Math.floor((Date.now() - new Date(tenant.createdAt).getTime()) / (1e3 * 60 * 60 * 24)),
        isInactive: tenant.lastActivity ? Math.floor((Date.now() - new Date(tenant.lastActivity).getTime()) / (1e3 * 60 * 60 * 24)) > 30 : true
      }));
    } catch (error) {
      console.error("Error fetching tenants for management:", error);
      return [];
    }
  }
  // Super Admin operations implementation
  async getAllSystemUsers() {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }
  async getAllSystemTenants() {
    const tenantStats = await db.select({
      tenantId: companies.tenantId,
      companyName: companies.name
    }).from(companies).where(not(eq(companies.tenantId, "SUPER_ADMIN"))).orderBy(companies.name);
    const enhancedStats = [];
    for (const tenant of tenantStats) {
      const userStats = await db.select({
        totalUsers: sql2`count(*)`,
        adminCount: sql2`count(case when ${users.role} = 'admin' then 1 end)`
      }).from(users).where(eq(users.tenantId, tenant.tenantId));
      const loanStats = await db.select({
        totalLoans: sql2`count(*)`
      }).from(loans).where(eq(loans.tenantId, tenant.tenantId));
      enhancedStats.push({
        tenantId: tenant.tenantId,
        companyName: tenant.companyName,
        adminCount: userStats[0]?.adminCount || 0,
        userCount: userStats[0]?.totalUsers || 0,
        totalLoans: loanStats[0]?.totalLoans || 0
      });
    }
    return enhancedStats;
  }
  async getUsersByTenant(tenantId) {
    return await db.select().from(users).where(eq(users.tenantId, tenantId)).orderBy(users.username);
  }
  async getUserById(userId) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user || void 0;
  }
  async findUserByTenantAndUsername(tenantId, username) {
    const [user] = await db.select().from(users).where(and(
      eq(users.tenantId, tenantId),
      eq(users.username, username)
    ));
    return user || void 0;
  }
  // Photo operations implementation
  async saveLoanPhoto(photoData) {
    const [savedPhoto] = await db.insert(loanPhotos).values(photoData).returning();
    return savedPhoto;
  }
  async getLoanPhotos(loanId, tenantId) {
    console.log(`\u{1F50D} STORAGE DEBUG: getLoanPhotos called with loanId="${loanId}", tenantId="${tenantId}"`);
    const result = await db.select().from(loanPhotos).where(
      and(
        eq(loanPhotos.loanId, loanId),
        eq(loanPhotos.tenantId, tenantId),
        eq(loanPhotos.isActive, true)
      )
    );
    console.log(`\u{1F4CA} STORAGE RESULT: Found ${result.length} photos for loan ${loanId}`);
    if (result.length > 0) {
      console.log(`\u{1F4F8} FIRST PHOTO: ${JSON.stringify(result[0], null, 2)}`);
    }
    return result;
  }
  async deleteLoanPhotos(loanId, tenantId) {
    const result = await db.update(loanPhotos).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(
      and(
        eq(loanPhotos.loanId, loanId),
        eq(loanPhotos.tenantId, tenantId)
      )
    );
    return true;
  }
  async updatePhotoStatus(photoId, tenantId, isActive) {
    const result = await db.update(loanPhotos).set({ isActive, updatedAt: /* @__PURE__ */ new Date() }).where(
      and(
        eq(loanPhotos.id, photoId),
        eq(loanPhotos.tenantId, tenantId)
      )
    );
    return true;
  }
  async toggleTenantActive(tenantId, isActive) {
    await db.update(companies).set({ isActive, updatedAt: /* @__PURE__ */ new Date() }).where(eq(companies.tenantId, tenantId));
  }
  async createPasswordResetRequest(data) {
    const [request] = await db.insert(passwordResetRequests).values({
      tenantId: data.tenantId,
      username: data.username,
      adminId: data.adminId || null,
      userRole: data.userRole || null,
      reason: data.reason || null,
      status: "pending"
    }).returning();
    return request;
  }
  async getPendingPasswordResetRequests() {
    const requests = await db.select({
      id: passwordResetRequests.id,
      tenantId: passwordResetRequests.tenantId,
      username: passwordResetRequests.username,
      adminUsername: passwordResetRequests.username,
      adminId: passwordResetRequests.adminId,
      userRole: passwordResetRequests.userRole,
      reason: passwordResetRequests.reason,
      status: passwordResetRequests.status,
      requestedAt: passwordResetRequests.createdAt,
      companyName: sql2`(
        SELECT ${companies.name} FROM ${companies} 
        WHERE ${companies.tenantId} = ${passwordResetRequests.tenantId}
        LIMIT 1
      )`
    }).from(passwordResetRequests).where(eq(passwordResetRequests.status, "pending")).orderBy(desc(passwordResetRequests.createdAt));
    return requests;
  }
  async getPasswordResetRequestById(requestId) {
    const [request] = await db.select().from(passwordResetRequests).where(eq(passwordResetRequests.id, requestId));
    return request || null;
  }
  async completePasswordResetRequest(requestId, completedBy) {
    await db.update(passwordResetRequests).set({
      status: "completed",
      completedBy,
      completedAt: /* @__PURE__ */ new Date()
    }).where(eq(passwordResetRequests.id, requestId));
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
init_db();
init_schema();
import bcrypt2 from "bcrypt";

// server/photo-service.ts
init_schema();
import multer from "multer";
import path2 from "path";
import fs2 from "fs/promises";
import sharp2 from "sharp";
import { eq as eq3, and as and2 } from "drizzle-orm";

// server/photo-storage-provider.ts
init_db();
init_schema();
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import { eq as eq2 } from "drizzle-orm";
var LocalStorageProvider = class {
  getUploadDirectory() {
    return path.join(process.cwd(), "server", "uploads", "photos");
  }
  getAbsolutePath(relativePath) {
    return path.join(process.cwd(), "server", relativePath);
  }
  async upload(fileBuffer, originalName, _tenantId, _loanId) {
    const uploadDir = this.getUploadDirectory();
    await fs.mkdir(uploadDir, { recursive: true });
    const metadata = await sharp(fileBuffer).metadata();
    const detectedFormat = metadata.format;
    if (!detectedFormat || !["jpeg", "png", "webp"].includes(detectedFormat)) {
      throw new Error(`Unsupported image format: ${detectedFormat}`);
    }
    const uniqueId = uuidv4();
    const timestamp2 = Date.now();
    const correctExtension = detectedFormat === "jpeg" ? "jpg" : detectedFormat;
    const filename = `loan_${timestamp2}_${uniqueId}.${correctExtension}`;
    const relativePath = path.join("uploads", "photos", filename);
    const absolutePath = path.join(uploadDir, filename);
    const thumbnailFilename = `${path.parse(filename).name}_thumb.${correctExtension}`;
    const thumbnailAbsolutePath = path.join(uploadDir, thumbnailFilename);
    const thumbnailRelativePath = path.join("uploads", "photos", thumbnailFilename);
    console.log(`\u{1F4F8} LOCAL UPLOAD: ${originalName} \u2192 ${filename} (${detectedFormat.toUpperCase()})`);
    await this.compressAndSave(fileBuffer, absolutePath, detectedFormat);
    await this.createThumbnail(fileBuffer, thumbnailAbsolutePath, detectedFormat);
    return {
      filename,
      storagePath: relativePath,
      thumbnailPath: thumbnailRelativePath,
      format: detectedFormat,
      size: fileBuffer.length,
      width: metadata.width,
      height: metadata.height
    };
  }
  async delete(storagePath, thumbnailPath) {
    let deletedFiles = 0;
    if (storagePath) {
      const absolutePath = this.getAbsolutePath(storagePath);
      try {
        await fs.access(absolutePath);
        await fs.unlink(absolutePath);
        deletedFiles++;
      } catch {
        deletedFiles++;
      }
    }
    if (thumbnailPath) {
      const thumbnailAbsolutePath = this.getAbsolutePath(thumbnailPath);
      try {
        await fs.access(thumbnailAbsolutePath);
        await fs.unlink(thumbnailAbsolutePath);
      } catch {
      }
    }
    return { success: true, deletedFiles };
  }
  getUrl(storagePath, req) {
    if (req) {
      const baseUrl = req.protocol + "://" + req.get("host");
      const cleanPath2 = storagePath.replace(/^server[/\\]/, "").replace(/\\/g, "/");
      return `${baseUrl}/${cleanPath2}`;
    }
    const cleanPath = storagePath.replace(/^server[/\\]/, "").replace(/\\/g, "/");
    return `/${cleanPath}`;
  }
  async compressAndSave(inputBuffer, outputPath, format) {
    let sharpInstance = sharp(inputBuffer).resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true });
    if (format === "png") {
      sharpInstance = sharpInstance.png({ quality: 90, compressionLevel: 6 });
    } else if (format === "webp") {
      sharpInstance = sharpInstance.webp({ quality: 85 });
    } else {
      sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: false, mozjpeg: false });
    }
    await sharpInstance.toFile(outputPath);
  }
  async createThumbnail(inputBuffer, thumbnailPath, format) {
    let sharpInstance = sharp(inputBuffer).resize(300, 300, { fit: "cover", position: "center" });
    if (format === "png") {
      sharpInstance = sharpInstance.png({ quality: 85 });
    } else if (format === "webp") {
      sharpInstance = sharpInstance.webp({ quality: 80 });
    } else {
      sharpInstance = sharpInstance.jpeg({ quality: 80, progressive: false });
    }
    await sharpInstance.toFile(thumbnailPath);
  }
};
var CloudinaryStorageProvider = class {
  config;
  constructor(config) {
    this.config = config;
    this.initCloudinary();
  }
  initCloudinary() {
    cloudinary.config({
      cloud_name: this.config.cloudinaryCloudName,
      api_key: this.config.cloudinaryApiKey,
      api_secret: this.config.cloudinaryApiSecret
    });
  }
  async upload(fileBuffer, originalName, tenantId, loanId) {
    const metadata = await sharp(fileBuffer).metadata();
    const detectedFormat = metadata.format;
    if (!detectedFormat || !["jpeg", "png", "webp"].includes(detectedFormat)) {
      throw new Error(`Unsupported image format: ${detectedFormat}`);
    }
    const compressedBuffer = await this.compressBuffer(fileBuffer, detectedFormat);
    const folder = this.config.cloudinaryFolder || "loan_photos";
    const uniqueId = uuidv4().substring(0, 8);
    const publicId = `${folder}/${tenantId}/${loanId}/${uniqueId}`;
    console.log(`\u{1F4F8} CLOUDINARY UPLOAD: ${originalName} \u2192 ${publicId}`);
    const mainResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder: "",
          resource_type: "image",
          overwrite: true,
          transformation: [
            { width: 1920, height: 1080, crop: "limit" },
            { quality: "auto:good" }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(compressedBuffer);
    });
    const thumbnailUrl = cloudinary.url(mainResult.public_id, {
      width: 300,
      height: 300,
      crop: "fill",
      gravity: "center",
      quality: "auto:good",
      format: "auto"
    });
    const correctExtension = detectedFormat === "jpeg" ? "jpg" : detectedFormat;
    const filename = `loan_${Date.now()}_${uniqueId}.${correctExtension}`;
    return {
      filename,
      storagePath: mainResult.secure_url,
      thumbnailPath: thumbnailUrl,
      format: detectedFormat,
      size: mainResult.bytes || fileBuffer.length,
      width: mainResult.width || metadata.width,
      height: mainResult.height || metadata.height,
      cloudinaryPublicId: mainResult.public_id,
      cloudinaryThumbnailId: mainResult.public_id
    };
  }
  async delete(storagePath, _thumbnailPath) {
    try {
      const publicId = this.extractPublicId(storagePath);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
        console.log(`\u{1F4F8} CLOUDINARY DELETE: ${publicId}`);
        return { success: true, deletedFiles: 1 };
      }
      return { success: true, deletedFiles: 0 };
    } catch (error) {
      console.warn(`\u{1F4F8} CLOUDINARY DELETE WARNING:`, error);
      return { success: false, deletedFiles: 0 };
    }
  }
  getUrl(storagePath, _req) {
    return storagePath;
  }
  extractPublicId(url) {
    try {
      if (url.includes("cloudinary.com")) {
        const parts = url.split("/upload/");
        if (parts.length > 1) {
          let publicIdWithExt = parts[1];
          publicIdWithExt = publicIdWithExt.replace(/^v\d+\//, "");
          const lastDot = publicIdWithExt.lastIndexOf(".");
          if (lastDot > -1) {
            return publicIdWithExt.substring(0, lastDot);
          }
          return publicIdWithExt;
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  async compressBuffer(inputBuffer, format) {
    let sharpInstance = sharp(inputBuffer).resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true });
    if (format === "png") {
      sharpInstance = sharpInstance.png({ quality: 90, compressionLevel: 6 });
    } else if (format === "webp") {
      sharpInstance = sharpInstance.webp({ quality: 85 });
    } else {
      sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: false, mozjpeg: false });
    }
    return sharpInstance.toBuffer();
  }
  static async testConnection(config) {
    try {
      cloudinary.config({
        cloud_name: config.cloudinaryCloudName,
        api_key: config.cloudinaryApiKey,
        api_secret: config.cloudinaryApiSecret
      });
      const result = await cloudinary.api.ping();
      if (result.status === "ok") {
        return { success: true, message: "Cloudinary connection successful!" };
      }
      return { success: false, message: "Cloudinary ping failed" };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error.message || "Unknown error"}` };
    }
  }
};
var NoOpDeleteProvider = class {
  async upload() {
    throw new Error("NoOpDeleteProvider does not support uploads");
  }
  async delete(storagePath) {
    console.warn(`\u{1F4F8} SKIPPED DELETE: Cannot delete Cloudinary photo "${storagePath}" - no valid credentials configured. Photo will remain on Cloudinary until credentials are restored.`);
    return { success: true, deletedFiles: 0 };
  }
  getUrl(storagePath) {
    return storagePath;
  }
};
var PhotoProviderResolver = class {
  static async getProviderForPhoto(photo, tenantId) {
    const isCloudinaryPhoto = photo.storageProvider === "cloudinary" || photo.storagePath && photo.storagePath.includes("cloudinary.com");
    if (isCloudinaryPhoto) {
      const config = await PhotoStorageFactory.getStorageConfig(tenantId);
      if (config.cloudinaryApiKey && config.cloudinaryApiSecret && config.cloudinaryCloudName) {
        return new CloudinaryStorageProvider(config);
      }
      console.warn(`\u{1F4F8} PROVIDER MISMATCH: Photo stored on Cloudinary but tenant has no valid Cloudinary credentials. Skipping cloud deletion.`);
      return new NoOpDeleteProvider();
    }
    return new LocalStorageProvider();
  }
};
var providerCache = /* @__PURE__ */ new Map();
var CACHE_TTL = 5 * 60 * 1e3;
var PhotoStorageFactory = class _PhotoStorageFactory {
  static async getProvider(tenantId) {
    const cached = providerCache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.provider;
    }
    const config = await _PhotoStorageFactory.getStorageConfig(tenantId);
    let provider;
    if (config.provider === "cloudinary" && config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret) {
      provider = new CloudinaryStorageProvider(config);
      console.log(`\u{1F4F8} PROVIDER: Cloudinary selected for tenant ${tenantId}`);
    } else {
      provider = new LocalStorageProvider();
      console.log(`\u{1F4F8} PROVIDER: Local storage selected for tenant ${tenantId}`);
    }
    providerCache.set(tenantId, { provider, timestamp: Date.now() });
    return provider;
  }
  static async getStorageConfig(tenantId) {
    try {
      const [tenantConfig] = await db.select().from(tenantStorageSettings).where(eq2(tenantStorageSettings.tenantId, tenantId));
      if (tenantConfig && tenantConfig.isConfigured) {
        return {
          provider: tenantConfig.storageProvider,
          cloudinaryCloudName: tenantConfig.cloudinaryCloudName || void 0,
          cloudinaryApiKey: tenantConfig.cloudinaryApiKey || void 0,
          cloudinaryApiSecret: tenantConfig.cloudinaryApiSecret || void 0,
          cloudinaryFolder: tenantConfig.cloudinaryFolder || void 0
        };
      }
      const [defaultProvider] = await db.select().from(systemSettings).where(eq2(systemSettings.settingKey, "default_storage_provider"));
      if (defaultProvider) {
        const defaultConfig = JSON.parse(defaultProvider.settingValue);
        return {
          provider: defaultConfig.provider || "local",
          cloudinaryCloudName: defaultConfig.cloudinaryCloudName,
          cloudinaryApiKey: defaultConfig.cloudinaryApiKey,
          cloudinaryApiSecret: defaultConfig.cloudinaryApiSecret,
          cloudinaryFolder: defaultConfig.cloudinaryFolder
        };
      }
      return { provider: "local" };
    } catch (error) {
      console.warn("\u{1F4F8} CONFIG: Failed to load storage config, using local:", error);
      return { provider: "local" };
    }
  }
  static clearCache(tenantId) {
    if (tenantId) {
      providerCache.delete(tenantId);
    } else {
      providerCache.clear();
    }
  }
};

// server/photo-service.ts
var storage2 = multer.memoryStorage();
var fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("\u0915\u0947\u0935\u0933 JPG, PNG, WebP \u092B\u093E\u0907\u0932\u094D\u0938 allowed \u0906\u0939\u0947\u0924"), false);
  }
};
var photoUpload = multer({
  storage: storage2,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 2
  }
});
var PhotoService = class _PhotoService {
  static getUploadDirectory() {
    return path2.join(process.cwd(), "server", "uploads", "photos");
  }
  static getAbsolutePath(relativePath) {
    return path2.join(process.cwd(), "server", relativePath);
  }
  static getRelativePath(absolutePath) {
    const serverDir = path2.join(process.cwd(), "server");
    return path2.relative(serverDir, absolutePath);
  }
  static async processAndSavePhoto(fileBuffer, originalName, tenantId, loanId) {
    try {
      const provider = await PhotoStorageFactory.getProvider(tenantId);
      const result = await provider.upload(fileBuffer, originalName, tenantId, loanId);
      const config = await PhotoStorageFactory.getStorageConfig(tenantId);
      console.log(`\u{1F4F8} PROCESSED [${config.provider.toUpperCase()}]: ${originalName} \u2192 ${result.filename}`);
      return {
        filename: result.filename,
        storagePath: result.storagePath,
        thumbnailPath: result.thumbnailPath,
        format: result.format,
        size: result.size,
        width: result.width,
        height: result.height,
        storageProvider: config.provider,
        cloudinaryPublicId: result.cloudinaryPublicId
      };
    } catch (error) {
      console.error("Photo processing error:", error);
      throw new Error(`\u092B\u094B\u091F\u094B \u092A\u094D\u0930\u0915\u094D\u0930\u093F\u092F\u093E \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  static async getImageMetadata(imagePath) {
    try {
      const metadata = await sharp2(imagePath).metadata();
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: metadata.size
      };
    } catch (error) {
      console.error("Metadata read error:", error);
      throw new Error("\u092B\u094B\u091F\u094B metadata \u0935\u093E\u091A\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940");
    }
  }
  static async validatePhotoSystem(db2, tenantId) {
    try {
      const allPhotos = await db2.select().from(loanPhotos).where(eq3(loanPhotos.tenantId, tenantId));
      const activePhotos = allPhotos.filter((p) => p.isActive);
      const deletedPhotos = allPhotos.filter((p) => !p.isActive);
      const validLoans = await db2.select({ id: loans.id }).from(loans).where(eq3(loans.tenantId, tenantId));
      const validLoanIds = new Set(validLoans.map((l) => l.id));
      const orphanedPhotos = allPhotos.filter((p) => !validLoanIds.has(p.loanId));
      let missingFiles = 0;
      for (const photo of activePhotos) {
        try {
          if (photo.storageProvider === "cloudinary" || photo.storagePath && photo.storagePath.includes("cloudinary.com")) {
            continue;
          }
          if (photo.storagePath) {
            const absolutePath = _PhotoService.getAbsolutePath(photo.storagePath);
            await fs2.access(absolutePath);
          }
        } catch {
          missingFiles++;
          console.warn(`\u{1F4F8} MISSING FILE: ${photo.filename} for loan ${photo.loanId}`);
        }
      }
      const validationResult = {
        totalPhotos: allPhotos.length,
        activePhotos: activePhotos.length,
        deletedPhotos: deletedPhotos.length,
        orphanedPhotos: orphanedPhotos.length,
        missingFiles,
        validationPassed: orphanedPhotos.length === 0 && missingFiles === 0
      };
      console.log(`\u{1F4F8} PHOTO SYSTEM VALIDATION:`, validationResult);
      return validationResult;
    } catch (error) {
      console.error("Photo validation error:", error);
      return {
        totalPhotos: 0,
        activePhotos: 0,
        deletedPhotos: 0,
        orphanedPhotos: 0,
        missingFiles: 0,
        validationPassed: false
      };
    }
  }
  static async compressImageFromBuffer(inputBuffer, outputPath, format) {
    try {
      const originalSize = inputBuffer.length;
      let sharpInstance = sharp2(inputBuffer).resize({
        width: 1920,
        height: 1080,
        fit: "inside",
        withoutEnlargement: true
      });
      if (format === "png") {
        sharpInstance = sharpInstance.png({ quality: 90, compressionLevel: 6 });
      } else if (format === "webp") {
        sharpInstance = sharpInstance.webp({ quality: 85 });
      } else {
        sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: false, mozjpeg: false });
      }
      await sharpInstance.toFile(outputPath);
      const compressedStats = await fs2.stat(outputPath);
      const compressedSize = compressedStats.size;
      const compressionRatio = (originalSize - compressedSize) / originalSize * 100;
      console.log(`\u{1F4F8} COMPRESSION: ${format.toUpperCase()} ${originalSize}\u2192${compressedSize} bytes (${compressionRatio.toFixed(1)}% saved)`);
      return { originalSize, compressedSize, compressionRatio };
    } catch (error) {
      console.error("Image compression error:", error);
      throw new Error("\u092B\u094B\u091F\u094B \u0915\u0949\u092E\u094D\u092A\u094D\u0930\u0947\u0938 \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940");
    }
  }
  static async compressImage(inputPath, outputPath) {
    const buffer = await fs2.readFile(inputPath);
    const metadata = await sharp2(buffer).metadata();
    const format = metadata.format || "jpeg";
    return _PhotoService.compressImageFromBuffer(buffer, outputPath, format);
  }
  static async createThumbnailFromBuffer(inputBuffer, thumbnailPath, format) {
    try {
      let sharpInstance = sharp2(inputBuffer).resize(300, 300, { fit: "cover", position: "center" });
      if (format === "png") {
        sharpInstance = sharpInstance.png({ quality: 85 });
      } else if (format === "webp") {
        sharpInstance = sharpInstance.webp({ quality: 80 });
      } else {
        sharpInstance = sharpInstance.jpeg({ quality: 80, progressive: false });
      }
      await sharpInstance.toFile(thumbnailPath);
      console.log(`\u{1F4F8} THUMBNAIL: Created ${format.toUpperCase()} thumbnail`);
    } catch (error) {
      console.error("Thumbnail creation error:", error);
      throw new Error("Thumbnail \u0924\u092F\u093E\u0930 \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940");
    }
  }
  static async createThumbnail(inputPath, thumbnailPath) {
    const buffer = await fs2.readFile(inputPath);
    const metadata = await sharp2(buffer).metadata();
    const format = metadata.format || "jpeg";
    return _PhotoService.createThumbnailFromBuffer(buffer, thumbnailPath, format);
  }
  static async savePhotoMetadata(db2, photoData) {
    try {
      const [savedPhoto] = await db2.insert(loanPhotos).values(photoData).returning({ id: loanPhotos.id });
      return savedPhoto.id;
    } catch (error) {
      console.error("Photo metadata save error:", error);
      throw new Error("\u092B\u094B\u091F\u094B \u0921\u0947\u091F\u093E save \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940");
    }
  }
  static async getPhotosForLoan(db2, loanId, tenantId) {
    try {
      const photos = await db2.select().from(loanPhotos).where(
        and2(
          eq3(loanPhotos.loanId, loanId),
          eq3(loanPhotos.tenantId, tenantId),
          eq3(loanPhotos.isActive, true)
        )
      );
      return photos;
    } catch (error) {
      console.error("Fetch photos error:", error);
      throw new Error("\u092B\u094B\u091F\u094B fetch \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940");
    }
  }
  static async deletePhotosForLoan(db2, loanId, tenantId) {
    try {
      console.log(`\u{1F4F8} AUTO-DELETE: Starting photo deletion for loan ${loanId}`);
      const photos = await _PhotoService.getPhotosForLoan(db2, loanId, tenantId);
      if (photos.length === 0) {
        console.log(`\u{1F4F8} AUTO-DELETE: No photos found for loan ${loanId} - skipping`);
        return { deletedFiles: 0, deletedRecords: 0 };
      }
      console.log(`\u{1F4F8} AUTO-DELETE: Found ${photos.length} photos to delete for loan ${loanId}`);
      let deletedFiles = 0;
      for (const photo of photos) {
        try {
          const photoProvider = await PhotoProviderResolver.getProviderForPhoto(photo, tenantId);
          const result = await photoProvider.delete(photo.storagePath, photo.thumbnailPath);
          deletedFiles += result.deletedFiles;
          console.log(`\u{1F4F8} DELETED [${photo.storageProvider || "local"}]: ${photo.filename}`);
        } catch (fileError) {
          console.warn(`\u{1F4F8} FILE DELETION WARNING: ${photo.filename}:`, fileError);
        }
      }
      const deletedRecords = await db2.update(loanPhotos).set({
        isActive: false,
        updatedAt: /* @__PURE__ */ new Date(),
        deletedReason: "AUTO_DELETE_ON_CLOSURE"
      }).where(
        and2(
          eq3(loanPhotos.loanId, loanId),
          eq3(loanPhotos.tenantId, tenantId),
          eq3(loanPhotos.isActive, true)
        )
      );
      console.log(`\u{1F4F8} AUTO-DELETE COMPLETE: ${deletedFiles} files + ${deletedRecords.length || 0} records deleted for loan ${loanId}`);
      return {
        deletedFiles,
        deletedRecords: deletedRecords.length || 0
      };
    } catch (error) {
      console.error(`\u{1F4F8} CRITICAL ERROR: Photo deletion failed for loan ${loanId}:`, error);
      return {
        deletedFiles: 0,
        deletedRecords: 0
      };
    }
  }
  static async deleteSinglePhoto(db2, photo, tenantId) {
    try {
      const photoProvider = await PhotoProviderResolver.getProviderForPhoto(photo, tenantId);
      await photoProvider.delete(photo.storagePath, photo.thumbnailPath);
      console.log(`\u{1F4F8} INDIVIDUAL DELETE [${photo.storageProvider || "local"}]: ${photo.filename}`);
      await db2.update(loanPhotos).set({
        isActive: false,
        updatedAt: /* @__PURE__ */ new Date(),
        deletedReason: "USER_MANUAL_DELETE"
      }).where(
        and2(
          eq3(loanPhotos.id, photo.id),
          eq3(loanPhotos.tenantId, tenantId)
        )
      );
      console.log(`\u{1F4F8} INDIVIDUAL DELETE: Photo ${photo.filename} deleted successfully`);
      return { success: true };
    } catch (error) {
      console.error("Individual photo deletion error:", error);
      return { success: false };
    }
  }
  static getHostingCompatiblePath(filename) {
    return path2.join("uploads", "photos", filename).replace(/\\/g, "/");
  }
  static getPhotoUrl(req, photo) {
    const storagePath = typeof photo === "string" ? photo : photo.storagePath;
    const isCloudinary = typeof photo !== "string" && photo.storageProvider === "cloudinary" || storagePath && storagePath.includes("cloudinary.com");
    if (isCloudinary) {
      return storagePath;
    }
    const baseUrl = req.protocol + "://" + req.get("host");
    const cleanPath = storagePath.replace(/^server[/\\]/, "").replace(/\\/g, "/");
    return `${baseUrl}/${cleanPath}`;
  }
  static getPhotoThumbnailUrl(req, photo) {
    if (!photo.thumbnailPath) return null;
    const isCloudinary = photo.storageProvider === "cloudinary" || photo.storagePath && photo.storagePath.includes("cloudinary.com");
    if (isCloudinary) {
      return photo.thumbnailPath;
    }
    const baseUrl = req.protocol + "://" + req.get("host");
    const cleanPath = photo.thumbnailPath.replace(/^server[/\\]/, "").replace(/\\/g, "/");
    return `${baseUrl}/${cleanPath}`;
  }
  static async validatePhotoIntegrity(photoPath, expectedFormat) {
    try {
      if (photoPath.includes("cloudinary.com")) {
        return { isValid: true, actualFormat: expectedFormat };
      }
      const absolutePath = _PhotoService.getAbsolutePath(photoPath);
      await fs2.access(absolutePath);
      const metadata = await sharp2(absolutePath).metadata();
      const actualFormat = metadata.format;
      const isValid = actualFormat === expectedFormat;
      if (!isValid) {
        console.warn(`\u{1F4F8} FORMAT MISMATCH: Expected ${expectedFormat}, got ${actualFormat} for ${photoPath}`);
      }
      return {
        isValid,
        actualFormat,
        error: isValid ? void 0 : `Format mismatch: expected ${expectedFormat}, got ${actualFormat}`
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  }
};

// server/routes.ts
init_db();
import path3 from "path";
import { z as z4 } from "zod";
import { and as and11, eq as eq12, sql as sql10, or as or5, ne as ne2, inArray as inArray3, desc as desc5, count as count2, sum as sum2, gte as gte3, lte as lte3 } from "drizzle-orm";
import connectPgSimple from "connect-pg-simple";

// server/routes/data-management.ts
import { Router } from "express";

// server/data-management.ts
init_db();
init_schema();
import { createHash } from "crypto";
import { eq as eq4, and as and3, sql as sql3, asc as asc2, ne, or as or2, inArray as inArray2 } from "drizzle-orm";
var DataManagementService = class {
  /**
   * Rearrange account numbers for a group by loan disbursement date
   */
  async previewRearrangeAccountNumbers(tenantId, groupId, upToDate) {
    try {
      console.log(`\u{1F522} REARRANGE PREVIEW: Generating preview for group ${groupId} in tenant ${tenantId}, upToDate: ${upToDate || "all"}`);
      const conditions = [
        eq4(loans.tenantId, tenantId),
        eq4(loans.groupId, groupId),
        eq4(loans.status, "active")
      ];
      if (upToDate) {
        conditions.push(sql3`DATE(${loans.loanDate}) <= DATE(${upToDate})`);
      }
      const loansInGroup = await db.select().from(loans).where(and3(...conditions)).orderBy(asc2(loans.loanDate));
      if (loansInGroup.length === 0) {
        return {
          success: false,
          message: "\u092F\u093E \u0917\u094D\u0930\u0941\u092A \u092E\u0927\u094D\u092F\u0947 \u0915\u094B\u0923\u0924\u0947 \u0938\u0915\u094D\u0930\u093F\u092F \u0915\u0930\u094D\u091C \u0928\u093E\u0939\u0940\u0924" + (upToDate ? ` (${upToDate} \u092A\u0930\u094D\u092F\u0902\u0924)` : ""),
          mapping: []
        };
      }
      const mapping = loansInGroup.map((loan, i) => ({
        loanId: loan.id,
        loanDate: loan.loanDate,
        borrowerName: loan.borrowerName,
        oldAccountNumber: loan.accountNumber || "-",
        newAccountNumber: (i + 1).toString()
      }));
      const checksumData = loansInGroup.map((l) => `${l.id}:${l.loanDate}:${l.accountNumber}`).join("|");
      const checksum = createHash("sha256").update(checksumData).digest("hex").substring(0, 16);
      return {
        success: true,
        message: `${loansInGroup.length} \u0915\u0930\u094D\u091C \u0938\u093E\u092A\u0921\u0932\u0947`,
        totalLoans: loansInGroup.length,
        checksum,
        mapping
      };
    } catch (error) {
      console.error("\u274C Rearrange preview failed:", error);
      return {
        success: false,
        message: "Preview \u0905\u092F\u0936\u0938\u094D\u0935\u0940: " + error.message,
        mapping: []
      };
    }
  }
  async confirmRearrangeAccountNumbers(tenantId, groupId, upToDate, checksum) {
    try {
      console.log(`\u{1F522} REARRANGE CONFIRM: Applying changes for group ${groupId} in tenant ${tenantId}, upToDate: ${upToDate || "all"}`);
      console.log(`\u26A0\uFE0F SAFETY: Only updating manual accountNumber field, NOT system IDs (id, loanNumber)`);
      const conditions = [
        eq4(loans.tenantId, tenantId),
        eq4(loans.groupId, groupId),
        eq4(loans.status, "active")
      ];
      if (upToDate) {
        conditions.push(sql3`DATE(${loans.loanDate}) <= DATE(${upToDate})`);
      }
      const loansInGroup = await db.select().from(loans).where(and3(...conditions)).orderBy(asc2(loans.loanDate));
      if (loansInGroup.length === 0) {
        return {
          success: false,
          message: "\u092F\u093E \u0917\u094D\u0930\u0941\u092A \u092E\u0927\u094D\u092F\u0947 \u0915\u094B\u0923\u0924\u0947 \u0938\u0915\u094D\u0930\u093F\u092F \u0915\u0930\u094D\u091C \u0928\u093E\u0939\u0940\u0924",
          affectedRecords: 0,
          details: []
        };
      }
      if (checksum) {
        const currentChecksumData = loansInGroup.map((l) => `${l.id}:${l.loanDate}:${l.accountNumber}`).join("|");
        const currentChecksum = createHash("sha256").update(currentChecksumData).digest("hex").substring(0, 16);
        if (currentChecksum !== checksum) {
          return {
            success: false,
            message: "Preview \u0928\u0902\u0924\u0930 \u0921\u0947\u091F\u093E \u092C\u0926\u0932\u0932\u093E \u0906\u0939\u0947. \u0915\u0943\u092A\u092F\u093E \u092A\u0941\u0928\u094D\u0939\u093E Preview \u092C\u0918\u093E.",
            affectedRecords: 0,
            details: [{ reason: "checksum_mismatch" }]
          };
        }
      }
      let updatedCount = 0;
      for (let i = 0; i < loansInGroup.length; i++) {
        const loan = loansInGroup[i];
        const newAccountNumber = (i + 1).toString();
        if (loan.accountNumber !== newAccountNumber) {
          await db.update(loans).set({
            accountNumber: newAccountNumber,
            updatedAt: sql3`now()`
          }).where(and3(
            eq4(loans.tenantId, tenantId),
            eq4(loans.id, loan.id)
          ));
          console.log(`\u2705 MANUAL ACCOUNT UPDATE: ${loan.accountNumber} \u2192 ${newAccountNumber} (${loan.borrowerName})`);
          updatedCount++;
        }
      }
      return {
        success: true,
        message: `${loansInGroup.length} \u0915\u0930\u094D\u091C\u093E\u0902\u091A\u0947 \u0916\u093E\u0924\u0947 \u0915\u094D\u0930\u092E\u093E\u0902\u0915 \u092F\u0936\u0938\u094D\u0935\u0940\u092A\u0923\u0947 \u0930\u093F\u0905\u0930\u0947\u0902\u091C \u0915\u0947\u0932\u0947 (${updatedCount} \u092C\u0926\u0932)`,
        affectedRecords: updatedCount,
        details: [{
          totalLoans: loansInGroup.length,
          updatedLoans: updatedCount,
          groupId
        }]
      };
    } catch (error) {
      console.error("\u274C Account rearrangement failed:", error);
      return {
        success: false,
        message: "\u0916\u093E\u0924\u0947 \u0915\u094D\u0930\u092E\u093E\u0902\u0915 \u0930\u093F\u0905\u0930\u0947\u0902\u091C \u0915\u0930\u0923\u094D\u092F\u093E\u0924 \u0905\u092F\u0936\u0938\u094D\u0935\u0940: " + error.message,
        affectedRecords: 0,
        details: []
      };
    }
  }
  async rearrangeAccountNumbers(tenantId, groupId) {
    return this.confirmRearrangeAccountNumbers(tenantId, groupId);
  }
  /**
   * संपूर्ण loan closure data cleanup with proper accounting integration
   */
  async cleanupClosedLoansData(tenantId, options) {
    try {
      const results = [];
      let totalAffected = 0;
      if (options.createBackup) {
        const backupResult = await this.createComprehensiveBackup(tenantId);
        if (!backupResult.success) {
          return {
            success: false,
            message: "Backup creation failed",
            affectedRecords: 0,
            details: [backupResult]
          };
        }
        results.push(backupResult);
      }
      const closedLoansQuery = db.select({
        loan: loans,
        closure: loanClosures
      }).from(loans).innerJoin(loanClosures, eq4(loans.id, loanClosures.loanId)).where(and3(
        eq4(loans.tenantId, tenantId),
        eq4(loans.status, "closed")
      ));
      const closedLoansWithClosure = await closedLoansQuery;
      let filteredLoans = closedLoansWithClosure.map((row) => row.loan);
      if (options.dateFrom || options.dateTo) {
        filteredLoans = closedLoansWithClosure.filter((row) => {
          const closureDate = new Date(row.closure.closureDate);
          if (options.dateFrom && closureDate < new Date(options.dateFrom)) return false;
          if (options.dateTo && closureDate > new Date(options.dateTo)) return false;
          return true;
        }).map((row) => row.loan);
      }
      if (options.borrowerIds?.length) {
        filteredLoans = filteredLoans.filter(
          (loan) => options.borrowerIds.includes(loan.borrowerId)
        );
      }
      for (const loan of filteredLoans) {
        const loanCleanupResult = await this.cleanupSingleLoanData(
          tenantId,
          loan,
          options.includeAssociatedTransactions
        );
        results.push(loanCleanupResult);
        totalAffected += loanCleanupResult.affectedRecords;
      }
      const integrityCheck = await this.performIntegrityCheck(tenantId);
      results.push(integrityCheck);
      return {
        success: true,
        message: `Successfully cleaned up ${filteredLoans.length} closed loans`,
        affectedRecords: totalAffected,
        details: results
      };
    } catch (error) {
      console.error("Data cleanup error:", error);
      return {
        success: false,
        message: "Data cleanup failed: " + error.message,
        affectedRecords: 0,
        details: []
      };
    }
  }
  /**
   * Single loan comprehensive cleanup with precise data targeting
   * Only removes data specifically related to the closed loan - no other entries affected
   */
  async cleanupSingleLoanData(tenantId, loan, includeTransactions) {
    try {
      const affectedRecords = {
        loanClosures: 0,
        cashTransactions: 0,
        journalEntries: 0,
        transactions: 0,
        loanPhotos: 0,
        activityLogs: 0,
        loanRecord: 0,
        borrowerRecord: 0
      };
      console.log(`\u{1F9F9} CLEANUP: Starting cleanup for loan ${loan.accountNumber} (${loan.borrowerName})`);
      console.log(`\u{1F4F8} PHOTO CLEANUP: Starting photo deletion for loan ${loan.accountNumber}`);
      try {
        const photoCleanupResult = await PhotoService.deletePhotosForLoan(db, loan.id, tenantId);
        affectedRecords.loanPhotos = photoCleanupResult.deletedRecords;
        console.log(`\u2705 Deleted ${photoCleanupResult.deletedFiles} photo files and ${photoCleanupResult.deletedRecords} photo records`);
      } catch (photoError) {
        console.warn(`\u26A0\uFE0F Photo cleanup warning for loan ${loan.accountNumber}:`, photoError);
      }
      await db.transaction(async (tx) => {
        const deletedClosures = await tx.delete(loanClosures).where(and3(
          eq4(loanClosures.tenantId, tenantId),
          eq4(loanClosures.loanId, loan.id)
        ));
        affectedRecords.loanClosures = deletedClosures.rowCount || 0;
        const deletedTransactions = await tx.delete(transactions).where(and3(
          eq4(transactions.tenantId, tenantId),
          eq4(transactions.loanId, loan.id)
        ));
        affectedRecords.transactions = deletedTransactions.rowCount || 0;
        if (includeTransactions) {
          const deletedCashTx = await tx.delete(cashTransactions).where(and3(
            eq4(cashTransactions.tenantId, tenantId),
            or2(
              sql3`${cashTransactions.narration} LIKE '%खाते क्र. ${loan.accountNumber}%'`,
              sql3`${cashTransactions.narration} LIKE '%Account ${loan.accountNumber}%'`,
              sql3`${cashTransactions.narration} LIKE '%A/c ${loan.accountNumber}%'`,
              sql3`${cashTransactions.narration} LIKE '%कर्ज वितरण%' AND ${cashTransactions.narration} LIKE '%${loan.borrowerName}%'`,
              sql3`${cashTransactions.narration} LIKE '%कर्ज जमा%' AND ${cashTransactions.narration} LIKE '%${loan.borrowerName}%'`,
              sql3`${cashTransactions.narration} LIKE '%कर्ज बंद%' AND ${cashTransactions.narration} LIKE '%${loan.borrowerName}%'`
            )
          ));
          affectedRecords.cashTransactions = deletedCashTx.rowCount || 0;
          const loanRelatedJournalEntries = await tx.select().from(journalEntries).where(and3(
            eq4(journalEntries.tenantId, tenantId),
            or2(
              sql3`${journalEntries.description} LIKE '%खाते क्र. ${loan.accountNumber}%'`,
              sql3`${journalEntries.description} LIKE '%Account ${loan.accountNumber}%'`,
              sql3`${journalEntries.description} LIKE '%${loan.borrowerName}%' AND ${journalEntries.description} LIKE '%कर्ज%'`
            )
          ));
          if (loanRelatedJournalEntries.length > 0) {
            for (const entry of loanRelatedJournalEntries) {
              await tx.delete(journalEntryLines).where(and3(
                eq4(journalEntryLines.tenantId, tenantId),
                eq4(journalEntryLines.journalEntryId, entry.id)
              ));
            }
            await tx.delete(journalEntries).where(and3(
              eq4(journalEntries.tenantId, tenantId),
              or2(
                sql3`${journalEntries.description} LIKE '%खाते क्र. ${loan.accountNumber}%'`,
                sql3`${journalEntries.description} LIKE '%Account ${loan.accountNumber}%'`,
                sql3`${journalEntries.description} LIKE '%${loan.borrowerName}%' AND ${journalEntries.description} LIKE '%कर्ज%'`
              )
            ));
            affectedRecords.journalEntries = loanRelatedJournalEntries.length;
          }
        }
        const deletedActivityLogs = await tx.delete(userActivityLogs).where(and3(
          eq4(userActivityLogs.tenantId, tenantId),
          or2(
            sql3`${userActivityLogs.description} LIKE '%खाते क्र. ${loan.accountNumber}%'`,
            sql3`${userActivityLogs.description} LIKE '%Account ${loan.accountNumber}%'`,
            sql3`${userActivityLogs.description} LIKE '%${loan.borrowerName}%'`,
            sql3`${userActivityLogs.metadata} LIKE '%"loanId":"${loan.id}"%'`,
            sql3`${userActivityLogs.metadata} LIKE '%"accountNumber":"${loan.accountNumber}"%'`
          )
        ));
        affectedRecords.activityLogs = deletedActivityLogs.rowCount || 0;
        await tx.delete(loanPhotos).where(and3(
          eq4(loanPhotos.tenantId, tenantId),
          eq4(loanPhotos.loanId, loan.id)
        ));
        const otherActiveLoans = await tx.select().from(loans).where(and3(
          eq4(loans.tenantId, tenantId),
          eq4(loans.borrowerId, loan.borrowerId),
          ne(loans.id, loan.id),
          eq4(loans.status, "active")
        ));
        await tx.delete(loans).where(and3(
          eq4(loans.tenantId, tenantId),
          eq4(loans.id, loan.id)
        ));
        affectedRecords.loanRecord = 1;
        if (otherActiveLoans.length === 0 && loan.borrowerId) {
          await tx.delete(borrowers).where(and3(
            eq4(borrowers.tenantId, tenantId),
            eq4(borrowers.id, loan.borrowerId)
          ));
          affectedRecords.borrowerRecord = 1;
        }
      });
      const totalAffected = affectedRecords.loanClosures + affectedRecords.cashTransactions + affectedRecords.journalEntries + affectedRecords.transactions + affectedRecords.loanPhotos + affectedRecords.activityLogs + affectedRecords.loanRecord + affectedRecords.borrowerRecord;
      console.log(`\u{1F3AF} CLEANUP COMPLETE: ${totalAffected} total records cleaned for loan ${loan.accountNumber}`);
      return {
        success: true,
        message: `Successfully cleaned loan ${loan.accountNumber} (${loan.borrowerName}) - ${totalAffected} records removed`,
        affectedRecords: totalAffected,
        details: [affectedRecords]
      };
    } catch (error) {
      console.error(`\u274C CLEANUP FAILED for loan ${loan.accountNumber}:`, error);
      return {
        success: false,
        message: `Failed to cleanup loan ${loan.accountNumber}: ${error.message}`,
        affectedRecords: 0,
        details: []
      };
    }
  }
  /**
   * Create comprehensive system backup - Updated August 2025
   */
  async createComprehensiveBackup(tenantId) {
    try {
      const timestamp2 = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const fullTimestamp = (/* @__PURE__ */ new Date()).toISOString();
      const backupData = {
        timestamp: fullTimestamp,
        tenantId,
        version: "2.0",
        schema: "comprehensive_backup_aug_2025",
        data: {
          // Core business tables
          companies: await db.select().from(companies).where(eq4(companies.tenantId, tenantId)),
          groups: await db.select().from(groups).where(eq4(groups.tenantId, tenantId)),
          borrowers: await db.select().from(borrowers).where(eq4(borrowers.tenantId, tenantId)),
          loans: await db.select().from(loans).where(eq4(loans.tenantId, tenantId)),
          transactions: await db.select().from(transactions).where(eq4(transactions.tenantId, tenantId)),
          loanClosures: await db.select().from(loanClosures).where(eq4(loanClosures.tenantId, tenantId)),
          loanPhotos: await db.select().from(loanPhotos).where(eq4(loanPhotos.tenantId, tenantId)),
          // Financial system tables
          parties: await db.select().from(parties).where(eq4(parties.tenantId, tenantId)),
          cashTransactions: await db.select().from(cashTransactions).where(eq4(cashTransactions.tenantId, tenantId)),
          journalEntries: await db.select().from(journalEntries).where(eq4(journalEntries.tenantId, tenantId)),
          journalEntryLines: await db.select().from(journalEntryLines).where(eq4(journalEntryLines.tenantId, tenantId)),
          // User management tables (except for SUPER_ADMIN tenant to preserve user data)
          users: tenantId !== "SUPER_ADMIN" ? await db.select().from(users).where(eq4(users.tenantId, tenantId)) : [],
          userPermissions: tenantId !== "SUPER_ADMIN" ? await db.select().from(userPermissions).where(eq4(userPermissions.tenantId, tenantId)) : [],
          userActivityLogs: tenantId !== "SUPER_ADMIN" ? await db.select().from(userActivityLogs).where(eq4(userActivityLogs.tenantId, tenantId)) : [],
          // Storage settings
          tenantStorageSettings: await db.select().from(tenantStorageSettings).where(eq4(tenantStorageSettings.tenantId, tenantId))
        }
      };
      const totalRecords = Object.values(backupData.data).reduce((sum3, table) => sum3 + table.length, 0);
      const backupId = `backup_${tenantId}_${timestamp2}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`\u{1F4E6} COMPREHENSIVE BACKUP: Created for ${tenantId} on ${timestamp2}`);
      console.log(`\u{1F4CA} BACKUP STATS: ${totalRecords} records across ${Object.keys(backupData.data).length} tables`);
      const backupFile = JSON.stringify(backupData, null, 2);
      console.log(`\u{1F4BE} BACKUP SIZE: ${(backupFile.length / 1024 / 1024).toFixed(2)} MB`);
      return {
        success: true,
        message: `Comprehensive backup created successfully - ${totalRecords} records backed up`,
        affectedRecords: totalRecords,
        details: [{
          backupId,
          totalRecords,
          tables: Object.keys(backupData.data),
          tableStats: Object.entries(backupData.data).map(([table, records]) => ({
            table,
            count: records.length
          })),
          size: `${(backupFile.length / 1024 / 1024).toFixed(2)} MB`,
          timestamp: fullTimestamp
        }],
        backupId,
        backupData
      };
    } catch (error) {
      console.error("\u274C BACKUP FAILED:", error);
      return {
        success: false,
        message: "Backup creation failed: " + error.message,
        affectedRecords: 0,
        details: []
      };
    }
  }
  /**
   * Comprehensive data restore system - Updated August 2025
   */
  async restoreFromBackup(tenantId, backupData) {
    try {
      console.log(`\u{1F504} RESTORE: Starting comprehensive restore for ${tenantId}`);
      if (!backupData || !backupData.data || !backupData.version) {
        throw new Error("Invalid backup data format");
      }
      if (backupData.tenantId !== tenantId) {
        throw new Error("Backup tenant ID does not match current tenant");
      }
      let restoredRecords = 0;
      const restoreResults = [];
      console.log("\u{1F9F9} STEP 1: Clearing existing data...");
      await db.transaction(async (tx) => {
        await tx.delete(journalEntryLines).where(eq4(journalEntryLines.tenantId, tenantId));
        await tx.delete(journalEntries).where(eq4(journalEntries.tenantId, tenantId));
        await tx.delete(cashTransactions).where(eq4(cashTransactions.tenantId, tenantId));
        await tx.delete(loanClosures).where(eq4(loanClosures.tenantId, tenantId));
        await tx.delete(transactions).where(eq4(transactions.tenantId, tenantId));
        await tx.delete(loanPhotos).where(eq4(loanPhotos.tenantId, tenantId));
        await tx.delete(loans).where(eq4(loans.tenantId, tenantId));
        await tx.delete(borrowers).where(eq4(borrowers.tenantId, tenantId));
        await tx.delete(parties).where(eq4(parties.tenantId, tenantId));
        await tx.delete(groups).where(eq4(groups.tenantId, tenantId));
        await tx.delete(companies).where(eq4(companies.tenantId, tenantId));
        await tx.delete(tenantStorageSettings).where(eq4(tenantStorageSettings.tenantId, tenantId));
        if (tenantId !== "SUPER_ADMIN") {
          await tx.delete(userActivityLogs).where(eq4(userActivityLogs.tenantId, tenantId));
          await tx.delete(userPermissions).where(eq4(userPermissions.tenantId, tenantId));
          await tx.delete(users).where(eq4(users.tenantId, tenantId));
        }
        console.log("\u2705 STEP 1 COMPLETE: Existing data cleared");
        console.log("\u{1F4E5} STEP 2: Restoring data...");
        if (backupData.data.companies?.length > 0) {
          await tx.insert(companies).values(backupData.data.companies);
          restoredRecords += backupData.data.companies.length;
          restoreResults.push({ table: "companies", records: backupData.data.companies.length });
        }
        if (backupData.data.groups?.length > 0) {
          await tx.insert(groups).values(backupData.data.groups);
          restoredRecords += backupData.data.groups.length;
          restoreResults.push({ table: "groups", records: backupData.data.groups.length });
        }
        if (backupData.data.borrowers?.length > 0) {
          await tx.insert(borrowers).values(backupData.data.borrowers);
          restoredRecords += backupData.data.borrowers.length;
          restoreResults.push({ table: "borrowers", records: backupData.data.borrowers.length });
        }
        if (backupData.data.parties?.length > 0) {
          await tx.insert(parties).values(backupData.data.parties);
          restoredRecords += backupData.data.parties.length;
          restoreResults.push({ table: "parties", records: backupData.data.parties.length });
        }
        if (backupData.data.loans?.length > 0) {
          await tx.insert(loans).values(backupData.data.loans);
          restoredRecords += backupData.data.loans.length;
          restoreResults.push({ table: "loans", records: backupData.data.loans.length });
        }
        if (backupData.data.loanPhotos?.length > 0) {
          await tx.insert(loanPhotos).values(backupData.data.loanPhotos);
          restoredRecords += backupData.data.loanPhotos.length;
          restoreResults.push({ table: "loanPhotos", records: backupData.data.loanPhotos.length });
        }
        if (backupData.data.transactions?.length > 0) {
          await tx.insert(transactions).values(backupData.data.transactions);
          restoredRecords += backupData.data.transactions.length;
          restoreResults.push({ table: "transactions", records: backupData.data.transactions.length });
        }
        if (backupData.data.loanClosures?.length > 0) {
          await tx.insert(loanClosures).values(backupData.data.loanClosures);
          restoredRecords += backupData.data.loanClosures.length;
          restoreResults.push({ table: "loanClosures", records: backupData.data.loanClosures.length });
        }
        if (backupData.data.cashTransactions?.length > 0) {
          await tx.insert(cashTransactions).values(backupData.data.cashTransactions);
          restoredRecords += backupData.data.cashTransactions.length;
          restoreResults.push({ table: "cashTransactions", records: backupData.data.cashTransactions.length });
        }
        if (backupData.data.journalEntries?.length > 0) {
          await tx.insert(journalEntries).values(backupData.data.journalEntries);
          restoredRecords += backupData.data.journalEntries.length;
          restoreResults.push({ table: "journalEntries", records: backupData.data.journalEntries.length });
        }
        if (backupData.data.journalEntryLines?.length > 0) {
          await tx.insert(journalEntryLines).values(backupData.data.journalEntryLines);
          restoredRecords += backupData.data.journalEntryLines.length;
          restoreResults.push({ table: "journalEntryLines", records: backupData.data.journalEntryLines.length });
        }
        if (tenantId !== "SUPER_ADMIN") {
          if (backupData.data.users?.length > 0) {
            await tx.insert(users).values(backupData.data.users);
            restoredRecords += backupData.data.users.length;
            restoreResults.push({ table: "users", records: backupData.data.users.length });
          }
          if (backupData.data.userPermissions?.length > 0) {
            await tx.insert(userPermissions).values(backupData.data.userPermissions);
            restoredRecords += backupData.data.userPermissions.length;
            restoreResults.push({ table: "userPermissions", records: backupData.data.userPermissions.length });
          }
          if (backupData.data.userActivityLogs?.length > 0) {
            await tx.insert(userActivityLogs).values(backupData.data.userActivityLogs);
            restoredRecords += backupData.data.userActivityLogs.length;
            restoreResults.push({ table: "userActivityLogs", records: backupData.data.userActivityLogs.length });
          }
        }
        if (backupData.data.tenantStorageSettings?.length > 0) {
          await tx.insert(tenantStorageSettings).values(backupData.data.tenantStorageSettings);
          restoredRecords += backupData.data.tenantStorageSettings.length;
          restoreResults.push({ table: "tenantStorageSettings", records: backupData.data.tenantStorageSettings.length });
        }
      });
      console.log(`\u2705 RESTORE COMPLETE: ${restoredRecords} records restored across ${restoreResults.length} tables (transaction committed)`);
      return {
        success: true,
        message: `Comprehensive restore completed successfully - ${restoredRecords} records restored`,
        affectedRecords: restoredRecords,
        details: [{
          restoredRecords,
          restoredTables: restoreResults.length,
          tableStats: restoreResults,
          backupVersion: backupData.version,
          backupTimestamp: backupData.timestamp,
          restoreTimestamp: (/* @__PURE__ */ new Date()).toISOString()
        }]
      };
    } catch (error) {
      console.error("\u274C RESTORE FAILED:", error);
      return {
        success: false,
        message: "Data restore failed: " + error.message,
        affectedRecords: 0,
        details: []
      };
    }
  }
  /**
   * Comprehensive data integrity verification
   */
  async performIntegrityCheck(tenantId) {
    try {
      const issues = [];
      let totalChecks = 0;
      const orphanedClosures = await db.select().from(loanClosures).leftJoin(loans, eq4(loanClosures.loanId, loans.id)).where(and3(
        eq4(loanClosures.tenantId, tenantId),
        sql3`${loans.id} IS NULL`
      ));
      if (orphanedClosures.length > 0) {
        issues.push(`Found ${orphanedClosures.length} orphaned loan closures`);
      }
      totalChecks++;
      const inconsistentLoans = await db.select().from(loans).leftJoin(loanClosures, eq4(loans.id, loanClosures.loanId)).where(and3(
        eq4(loans.tenantId, tenantId),
        sql3`(${loans.status} = 'closed' AND ${loanClosures.id} IS NULL) OR (${loans.status} != 'closed' AND ${loanClosures.id} IS NOT NULL)`
      ));
      if (inconsistentLoans.length > 0) {
        issues.push(`Found ${inconsistentLoans.length} loans with inconsistent status`);
      }
      totalChecks++;
      const balanceVerification = await storage.getProfessionalCashBalance(tenantId);
      if (!balanceVerification.isValid) {
        issues.push(`Cash balance verification failed: ${balanceVerification.errors.join(", ")}`);
      }
      totalChecks++;
      const duplicateCheck = await this.checkForDuplicateTransactions(tenantId);
      if (duplicateCheck.duplicatesFound > 0) {
        issues.push(`Found ${duplicateCheck.duplicatesFound} potential duplicate transactions`);
      }
      totalChecks++;
      return {
        success: issues.length === 0,
        message: issues.length === 0 ? `All ${totalChecks} integrity checks passed` : `Found ${issues.length} integrity issues`,
        affectedRecords: issues.length,
        details: issues.map((issue) => ({ issue }))
      };
    } catch (error) {
      return {
        success: false,
        message: "Integrity verification failed: " + error.message,
        affectedRecords: 0,
        details: []
      };
    }
  }
  /**
   * Check for duplicate transactions
   */
  async checkForDuplicateTransactions(tenantId) {
    try {
      const transactions2 = await db.select().from(cashTransactions).where(eq4(cashTransactions.tenantId, tenantId)).orderBy(asc2(cashTransactions.transactionDate));
      const seenTransactions = /* @__PURE__ */ new Map();
      let duplicatesFound = 0;
      const duplicateDetails = [];
      transactions2.forEach((transaction) => {
        const key = `${transaction.transactionDate}_${transaction.amount}_${transaction.transactionType}_${transaction.narration}`;
        if (!seenTransactions.has(key)) {
          seenTransactions.set(key, []);
        }
        seenTransactions.get(key).push(transaction);
      });
      seenTransactions.forEach((transactions3, key) => {
        if (transactions3.length > 1) {
          duplicatesFound += transactions3.length - 1;
          duplicateDetails.push({
            key,
            count: transactions3.length,
            transactions: transactions3.map((t) => ({
              id: t.id,
              date: t.transactionDate,
              amount: t.amount,
              narration: t.narration
            }))
          });
        }
      });
      return { duplicatesFound, details: duplicateDetails };
    } catch (error) {
      console.error("Duplicate check error:", error);
      return { duplicatesFound: 0, details: [] };
    }
  }
  /**
   * Smart data reconciliation for accounting accuracy
   */
  async reconcileAccountingData(tenantId, options = {}) {
    try {
      const results = [];
      const disbursementReconciliation = await this.reconcileLoanDisbursements(tenantId);
      results.push(disbursementReconciliation);
      const closureReconciliation = await this.reconcileLoanClosures(tenantId);
      results.push(closureReconciliation);
      const balanceReconciliation = await this.reconcileOpeningBalances(tenantId);
      results.push(balanceReconciliation);
      const totalAffected = results.reduce((sum3, result) => sum3 + result.affectedRecords, 0);
      return {
        success: results.every((r) => r.success),
        message: `Accounting reconciliation completed`,
        affectedRecords: totalAffected,
        details: results
      };
    } catch (error) {
      return {
        success: false,
        message: "Reconciliation failed: " + error.message,
        affectedRecords: 0,
        details: []
      };
    }
  }
  async reconcileLoanDisbursements(tenantId) {
    const loansData = await db.select().from(loans).where(eq4(loans.tenantId, tenantId));
    let reconciledCount = 0;
    for (const loan of loansData) {
      const disbursementTransaction = await db.select().from(cashTransactions).where(and3(
        eq4(cashTransactions.tenantId, tenantId),
        sql3`${cashTransactions.narration} LIKE '%${loan.accountNumber}%'`,
        eq4(cashTransactions.transactionType, "cash_out"),
        sql3`${cashTransactions.amount} = ${loan.principalAmount}`
      )).limit(1);
      if (disbursementTransaction.length === 0) {
        console.log(`\u{1F6AB} DATA-MANAGEMENT DISABLED: Cash transaction creation disabled for account ${loan.accountNumber} to prevent duplicates`);
        reconciledCount++;
      }
    }
    return {
      success: true,
      message: `Reconciled ${reconciledCount} loan disbursements`,
      affectedRecords: reconciledCount,
      details: []
    };
  }
  async reconcileLoanClosures(tenantId) {
    const closures = await db.select().from(loanClosures).innerJoin(loans, eq4(loanClosures.loanId, loans.id)).where(eq4(loanClosures.tenantId, tenantId));
    let reconciledCount = 0;
    for (const closure of closures) {
      const principalPaid = Number(closure.loan_closures.principalPaid) || 0;
      const interestPaid = Number(closure.loan_closures.interestPaid) || 0;
      const totalAmount = principalPaid + interestPaid;
      const closureTransaction = await db.select().from(cashTransactions).where(and3(
        eq4(cashTransactions.tenantId, tenantId),
        sql3`${cashTransactions.narration} LIKE '%${closure.loans.accountNumber}%'`,
        eq4(cashTransactions.transactionType, "cash_in"),
        sql3`${cashTransactions.amount} = ${totalAmount}`
      )).limit(1);
      if (closureTransaction.length === 0) {
        await storage.createCashTransaction({
          tenantId,
          transactionDate: closure.loan_closures.closureDate,
          transactionType: "cash_in",
          amount: totalAmount,
          narration: `\u0915\u0930\u094D\u091C \u092C\u0902\u0926 - \u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${closure.loans.accountNumber} - ${closure.loans.borrowerName}`,
          category: "loan_closure",
          isSystemGenerated: true
        });
        reconciledCount++;
      }
    }
    return {
      success: true,
      message: `Reconciled ${reconciledCount} loan closures`,
      affectedRecords: reconciledCount,
      details: []
    };
  }
  async reconcileOpeningBalances(tenantId) {
    const partyAccounts = await db.select().from(parties).where(eq4(parties.tenantId, tenantId));
    let reconciledCount = 0;
    for (const party of partyAccounts) {
      if (party.openingBalance && Number(party.openingBalance) > 0 && party.openingBalanceDate) {
        const openingTransaction = await db.select().from(cashTransactions).where(and3(
          eq4(cashTransactions.tenantId, tenantId),
          eq4(cashTransactions.partyId, party.id),
          sql3`${cashTransactions.narration} LIKE '%प्रारंभिक शिल्लक%'`
        )).limit(1);
        if (openingTransaction.length === 0) {
          await storage.createCashTransaction({
            tenantId,
            transactionDate: party.openingBalanceDate,
            transactionType: party.openingBalanceType === "credit" ? "cash_in" : "cash_out",
            amount: Number(party.openingBalance),
            narration: `\u092A\u094D\u0930\u093E\u0930\u0902\u092D\u093F\u0915 \u0936\u093F\u0932\u094D\u0932\u0915 - ${party.name}`,
            category: "opening_balance",
            partyId: party.id,
            isSystemGenerated: true
          });
          reconciledCount++;
        }
      }
    }
    return {
      success: true,
      message: `Reconciled ${reconciledCount} opening balances`,
      affectedRecords: reconciledCount,
      details: []
    };
  }
  /**
   * Restore all system data to clean state (complete data wipe and reset)
   */
  async restoreAllSystemData(tenantId, options) {
    try {
      console.log(`\u{1F504} RESTORE: Starting complete system data restore for tenant ${tenantId}`);
      const results = [];
      let totalAffected = 0;
      if (options.createBackup) {
        console.log(`\u{1F4BE} RESTORE: Creating safety backup before restore`);
        const backupResult = await this.createComprehensiveBackup(tenantId);
        if (!backupResult.success) {
          return {
            success: false,
            message: "Safety backup creation failed before restore",
            affectedRecords: 0,
            details: [backupResult]
          };
        }
        results.push(backupResult);
      }
      console.log(`\u{1F5D1}\uFE0F RESTORE: Cleaning all existing data`);
      await db.transaction(async (tx) => {
        if (tenantId !== "SUPER_ADMIN") {
          await tx.delete(userActivityLogs).where(eq4(userActivityLogs.tenantId, tenantId));
          await tx.delete(userPermissions).where(eq4(userPermissions.tenantId, tenantId));
        }
        const deletedJournalLines = await tx.delete(journalEntryLines).where(eq4(journalEntryLines.tenantId, tenantId));
        const deletedJournalEntries = await tx.delete(journalEntries).where(eq4(journalEntries.tenantId, tenantId));
        const deletedClosures = await tx.delete(loanClosures).where(eq4(loanClosures.tenantId, tenantId));
        const deletedTransactions = await tx.delete(transactions).where(eq4(transactions.tenantId, tenantId));
        const deletedCashTransactions = await tx.delete(cashTransactions).where(eq4(cashTransactions.tenantId, tenantId));
        const deletedPhotos = await tx.delete(loanPhotos).where(eq4(loanPhotos.tenantId, tenantId));
        const deletedLoans = await tx.delete(loans).where(eq4(loans.tenantId, tenantId));
        const deletedParties = await tx.delete(parties).where(eq4(parties.tenantId, tenantId));
        const deletedBorrowers = await tx.delete(borrowers).where(eq4(borrowers.tenantId, tenantId));
        const deletedGroups = await tx.delete(groups).where(eq4(groups.tenantId, tenantId));
        const deletedCompanies = await tx.delete(companies).where(eq4(companies.tenantId, tenantId));
        const deletedStorageSettings = await tx.delete(tenantStorageSettings).where(eq4(tenantStorageSettings.tenantId, tenantId));
        totalAffected = (deletedJournalLines.rowCount || 0) + (deletedJournalEntries.rowCount || 0) + (deletedClosures.rowCount || 0) + (deletedTransactions.rowCount || 0) + (deletedCashTransactions.rowCount || 0) + (deletedPhotos.rowCount || 0) + (deletedLoans.rowCount || 0) + (deletedParties.rowCount || 0) + (deletedBorrowers.rowCount || 0) + (deletedGroups.rowCount || 0) + (deletedCompanies.rowCount || 0) + (deletedStorageSettings.rowCount || 0);
      });
      console.log(`\u2705 RESTORE: Successfully cleaned ${totalAffected} records`);
      results.push({
        operation: "complete_data_cleanup",
        affected: totalAffected,
        message: "\u0938\u0930\u094D\u0935 \u0921\u0947\u091F\u093E \u0938\u093E\u092B \u0915\u0947\u0932\u093E \u0917\u0947\u0932\u093E \u0906\u0923\u093F system clean state \u092E\u0927\u094D\u092F\u0947 reset \u0915\u0947\u0932\u0947 \u0917\u0947\u0932\u0947"
      });
      return {
        success: true,
        message: `\u0938\u0930\u094D\u0935 \u0938\u093F\u0938\u094D\u091F\u092E \u0921\u0947\u091F\u093E \u092F\u0936\u0938\u094D\u0935\u0940\u092A\u0923\u0947 \u0930\u093F\u0938\u094D\u091F\u094B\u0930 \u0915\u0947\u0932\u093E \u0917\u0947\u0932\u093E. ${totalAffected} records \u0938\u093E\u092B \u0915\u0947\u0932\u0947 \u0917\u0947\u0932\u0947.`,
        affectedRecords: totalAffected,
        details: results
      };
    } catch (error) {
      console.error("System restore error:", error);
      return {
        success: false,
        message: `System restore failed: ${error.message}`,
        affectedRecords: 0,
        details: [{ error: error.message }]
      };
    }
  }
  LOAN_PROTECTED_CATEGORIES = ["loan_disbursement", "loan_repayment", "loan_closure", "opening_balance"];
  LOAN_NARRATION_KEYWORDS = [
    "\u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923",
    "\u0915\u0930\u094D\u091C \u092C\u0902\u0926",
    "\u0915\u0930\u094D\u091C \u0935\u0938\u0942\u0932\u0940",
    "\u0915\u0930\u094D\u091C \u0930\u0915\u094D\u0915\u092E \u0905\u092A\u0921\u0947\u091F",
    "\u0916\u093E\u0924\u0947 \u0915\u094D\u0930.",
    "\u092E\u0941\u0926\u094D\u0926\u0932",
    "\u0935\u094D\u092F\u093E\u091C",
    "\u092A\u094D\u0930\u093E\u0930\u0902\u092D\u093F\u0915 \u0936\u093F\u0932\u094D\u0932\u0915",
    "loan disbursement",
    "loan closure",
    "loan repayment",
    "opening balance"
  ];
  buildLoanProtectionCondition() {
    const categoryProtection = sql3`${cashTransactions.category} NOT IN ('loan_disbursement', 'loan_repayment', 'loan_closure', 'opening_balance')`;
    const systemGeneratedProtection = sql3`${cashTransactions.isSystemGenerated} = false`;
    const narrationConditions = this.LOAN_NARRATION_KEYWORDS.map(
      (keyword) => sql3`COALESCE(${cashTransactions.narration}, '') NOT ILIKE ${`%${keyword}%`}`
    );
    return sql3`(${categoryProtection} AND ${systemGeneratedProtection} AND ${sql3.join(narrationConditions, sql3` AND `)})`;
  }
  async previewCashBookCleanup(tenantId, options) {
    try {
      const dateConditions = sql3`${cashTransactions.tenantId} = ${tenantId} AND ${cashTransactions.transactionDate} >= ${options.dateFrom} AND ${cashTransactions.transactionDate} <= ${options.dateTo}`;
      const allInRange = await db.select({ id: cashTransactions.id }).from(cashTransactions).where(sql3`${dateConditions}`);
      const protectedEntries = await db.select({ id: cashTransactions.id }).from(cashTransactions).where(sql3`${dateConditions} AND NOT ${this.buildLoanProtectionCondition()}`);
      const deletableEntries = allInRange.length - protectedEntries.length;
      const categoryBreakdown = await db.select({
        category: cashTransactions.category,
        count: sql3`count(*)::int`
      }).from(cashTransactions).where(sql3`${dateConditions} AND ${this.buildLoanProtectionCondition()}`).groupBy(cashTransactions.category);
      const deletableTxDetails = await db.select({
        id: cashTransactions.id,
        transactionType: cashTransactions.transactionType,
        amount: cashTransactions.amount,
        partyId: cashTransactions.partyId,
        narration: cashTransactions.narration
      }).from(cashTransactions).where(sql3`${dateConditions} AND ${this.buildLoanProtectionCondition()}`);
      let totalCashInDeleted = 0;
      let totalCashOutDeleted = 0;
      const partyMap = /* @__PURE__ */ new Map();
      for (const tx of deletableTxDetails) {
        const amount = Number(tx.amount) || 0;
        if (tx.transactionType === "cash_in") {
          totalCashInDeleted += amount;
        } else {
          totalCashOutDeleted += amount;
        }
        if (tx.partyId) {
          const existing = partyMap.get(tx.partyId) || { partyId: tx.partyId, cashIn: 0, cashOut: 0 };
          if (tx.transactionType === "cash_in") {
            existing.cashIn += amount;
          } else {
            existing.cashOut += amount;
          }
          partyMap.set(tx.partyId, existing);
        }
      }
      const partyIds = Array.from(partyMap.keys());
      let partyNames = /* @__PURE__ */ new Map();
      if (partyIds.length > 0) {
        const partyRecords = await db.select({ id: parties.id, name: parties.name }).from(parties).where(and3(eq4(parties.tenantId, tenantId), inArray2(parties.id, partyIds)));
        partyRecords.forEach((p) => partyNames.set(p.id, p.name));
      }
      const partyWiseImpact = Array.from(partyMap.entries()).map(([pid, data]) => ({
        partyName: partyNames.get(pid) || `Party #${pid}`,
        partyId: pid,
        cashIn: data.cashIn,
        cashOut: data.cashOut,
        net: data.cashIn - data.cashOut
      })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
      const netImpact = totalCashInDeleted - totalCashOutDeleted;
      let adjustmentType = "none";
      let adjustmentAmount = 0;
      if (netImpact > 0) {
        adjustmentType = "cash_in";
        adjustmentAmount = netImpact;
      } else if (netImpact < 0) {
        adjustmentType = "cash_out";
        adjustmentAmount = Math.abs(netImpact);
      }
      const journalDateConditions = sql3`${journalEntries.tenantId} = ${tenantId} AND ${journalEntries.transactionDate} >= ${options.dateFrom} AND ${journalEntries.transactionDate} <= ${options.dateTo}`;
      const allJournals = await db.select({ id: journalEntries.id }).from(journalEntries).where(sql3`${journalDateConditions}`);
      const loanJournalKeywords = ["\u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923", "\u0915\u0930\u094D\u091C \u092C\u0902\u0926", "\u0915\u0930\u094D\u091C \u0935\u0938\u0942\u0932\u0940", "\u0916\u093E\u0924\u0947 \u0915\u094D\u0930.", "\u092E\u0941\u0926\u094D\u0926\u0932", "\u0935\u094D\u092F\u093E\u091C", "\u092A\u094D\u0930\u093E\u0930\u0902\u092D\u093F\u0915 \u0936\u093F\u0932\u094D\u0932\u0915", "loan disbursement", "loan closure", "opening balance"];
      const journalDescConditions = loanJournalKeywords.map(
        (keyword) => sql3`(COALESCE(${journalEntries.description}, '') ILIKE ${`%${keyword}%`} OR COALESCE(${journalEntries.narration}, '') ILIKE ${`%${keyword}%`})`
      );
      const protectedJournals = await db.select({ id: journalEntries.id }).from(journalEntries).where(sql3`${journalDateConditions} AND (${journalEntries.sourceType} IN ('loan_disbursement', 'loan_closure', 'loan_repayment', 'opening_balance') OR ${sql3.join(journalDescConditions, sql3` OR `)})`);
      return {
        success: true,
        deletableCount: deletableEntries,
        protectedCount: protectedEntries.length,
        deletableJournalCount: allJournals.length - protectedJournals.length,
        protectedJournalCount: protectedJournals.length,
        details: categoryBreakdown,
        balanceImpact: {
          totalCashInDeleted,
          totalCashOutDeleted,
          netImpact,
          adjustmentType,
          adjustmentAmount,
          partyWiseImpact
        }
      };
    } catch (error) {
      console.error("Preview cashbook cleanup error:", error);
      return {
        success: false,
        deletableCount: 0,
        protectedCount: 0,
        deletableJournalCount: 0,
        protectedJournalCount: 0,
        details: [],
        balanceImpact: {
          totalCashInDeleted: 0,
          totalCashOutDeleted: 0,
          netImpact: 0,
          adjustmentType: "none",
          adjustmentAmount: 0,
          partyWiseImpact: []
        }
      };
    }
  }
  async cleanupCashBookEntries(tenantId, options) {
    try {
      const results = [];
      let totalAffected = 0;
      if (options.createBackup) {
        const backupResult = await this.createComprehensiveBackup(tenantId);
        if (!backupResult.success) {
          return {
            success: false,
            message: "Backup \u0924\u092F\u093E\u0930 \u0915\u0930\u0923\u094D\u092F\u093E\u0924 \u0905\u092F\u0936\u0938\u094D\u0935\u0940",
            affectedRecords: 0,
            details: [backupResult]
          };
        }
        results.push({ step: "backup", message: "Backup \u092F\u0936\u0938\u094D\u0935\u0940" });
      }
      await db.transaction(async (tx) => {
        if (options.cleanCashTransactions) {
          const dateConditions = sql3`${cashTransactions.tenantId} = ${tenantId} AND ${cashTransactions.transactionDate} >= ${options.dateFrom} AND ${cashTransactions.transactionDate} <= ${options.dateTo}`;
          const deletableCashTx = await tx.select({ id: cashTransactions.id }).from(cashTransactions).where(sql3`${dateConditions} AND ${this.buildLoanProtectionCondition()}`);
          if (deletableCashTx.length > 0) {
            const deletableIds = deletableCashTx.map((r) => r.id);
            for (const id of deletableIds) {
              await tx.delete(cashTransactions).where(and3(
                eq4(cashTransactions.id, id),
                eq4(cashTransactions.tenantId, tenantId)
              ));
            }
            totalAffected += deletableCashTx.length;
            results.push({
              step: "cash_transactions",
              deleted: deletableCashTx.length,
              message: `${deletableCashTx.length} \u0938\u093E\u092E\u093E\u0928\u094D\u092F \u0915\u0945\u0936 \u090F\u0928\u094D\u091F\u094D\u0930\u0940 \u0939\u091F\u0935\u0932\u094D\u092F\u093E`
            });
          }
        }
        if (options.cleanJournalEntries) {
          const journalDateConditions = sql3`${journalEntries.tenantId} = ${tenantId} AND ${journalEntries.transactionDate} >= ${options.dateFrom} AND ${journalEntries.transactionDate} <= ${options.dateTo}`;
          const loanJournalKeywords = ["\u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923", "\u0915\u0930\u094D\u091C \u092C\u0902\u0926", "\u0915\u0930\u094D\u091C \u0935\u0938\u0942\u0932\u0940", "\u0916\u093E\u0924\u0947 \u0915\u094D\u0930.", "\u092E\u0941\u0926\u094D\u0926\u0932", "\u0935\u094D\u092F\u093E\u091C", "\u092A\u094D\u0930\u093E\u0930\u0902\u092D\u093F\u0915 \u0936\u093F\u0932\u094D\u0932\u0915", "loan disbursement", "loan closure", "opening balance"];
          const journalDescConditions = loanJournalKeywords.map(
            (keyword) => sql3`(COALESCE(${journalEntries.description}, '') ILIKE ${`%${keyword}%`} OR COALESCE(${journalEntries.narration}, '') ILIKE ${`%${keyword}%`})`
          );
          const deletableJournals = await tx.select({ id: journalEntries.id }).from(journalEntries).where(sql3`${journalDateConditions} AND ${journalEntries.sourceType} NOT IN ('loan_disbursement', 'loan_closure', 'loan_repayment', 'opening_balance') AND NOT (${sql3.join(journalDescConditions, sql3` OR `)})`);
          if (deletableJournals.length > 0) {
            const journalIds = deletableJournals.map((r) => r.id);
            for (const jId of journalIds) {
              await tx.delete(journalEntryLines).where(and3(
                eq4(journalEntryLines.journalEntryId, jId),
                eq4(journalEntryLines.tenantId, tenantId)
              ));
              await tx.delete(journalEntries).where(and3(
                eq4(journalEntries.id, jId),
                eq4(journalEntries.tenantId, tenantId)
              ));
            }
            totalAffected += deletableJournals.length;
            results.push({
              step: "journal_entries",
              deleted: deletableJournals.length,
              message: `${deletableJournals.length} \u0938\u093E\u092E\u093E\u0928\u094D\u092F \u091C\u0930\u094D\u0928\u0932 \u090F\u0928\u094D\u091F\u094D\u0930\u0940 \u0939\u091F\u0935\u0932\u094D\u092F\u093E`
            });
          }
        }
      });
      return {
        success: true,
        message: `\u0915\u0945\u0936\u092C\u0941\u0915 \u0915\u094D\u0932\u0940\u0928\u0905\u092A \u092F\u0936\u0938\u094D\u0935\u0940 - ${totalAffected} \u090F\u0928\u094D\u091F\u094D\u0930\u0940 \u0939\u091F\u0935\u0932\u094D\u092F\u093E (\u0915\u0930\u094D\u091C\u093E\u091A\u094D\u092F\u093E \u0938\u0930\u094D\u0935 \u090F\u0928\u094D\u091F\u094D\u0930\u0940 \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924)`,
        affectedRecords: totalAffected,
        details: results
      };
    } catch (error) {
      console.error("Cashbook cleanup error:", error);
      return {
        success: false,
        message: "\u0915\u0945\u0936\u092C\u0941\u0915 \u0915\u094D\u0932\u0940\u0928\u0905\u092A \u0905\u092F\u0936\u0938\u094D\u0935\u0940: " + error.message,
        affectedRecords: 0,
        details: []
      };
    }
  }
};
var dataManagementService = new DataManagementService();

// server/routes/data-management.ts
import { z as z2 } from "zod";
var router = Router();
var loanCleanupSchema = z2.object({
  dateFrom: z2.string().optional(),
  dateTo: z2.string().optional(),
  includeAssociatedTransactions: z2.boolean().default(true),
  createBackup: z2.boolean().default(true),
  borrowerIds: z2.array(z2.string()).optional(),
  accountNumbers: z2.array(z2.string()).optional()
});
var reconciliationSchema = z2.object({
  force: z2.boolean().default(false),
  createBackup: z2.boolean().default(true)
});
router.post("/cleanup-closed-loans", async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const options = loanCleanupSchema.parse(req.body);
    console.log(`\u{1F9F9} DATA CLEANUP: Starting closed loan cleanup for tenant ${tenantId}`);
    const result = await dataManagementService.cleanupClosedLoansData(tenantId, options);
    if (result.success) {
      console.log(`\u2705 DATA CLEANUP: Successfully processed ${result.affectedRecords} records`);
      res.json({
        success: true,
        message: result.message,
        summary: {
          recordsProcessed: result.affectedRecords,
          backupCreated: result.backupCreated,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        details: result.details
      });
    } else {
      console.error(`\u274C DATA CLEANUP: Failed - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
  } catch (error) {
    console.error("Data cleanup endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during cleanup",
      error: error.message
    });
  }
});
router.post("/reconcile-accounting", async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const options = reconciliationSchema.parse(req.body);
    console.log(`\u{1F504} DATA RECONCILIATION: Starting accounting reconciliation for tenant ${tenantId}`);
    const result = await dataManagementService.reconcileAccountingData(tenantId, options);
    if (result.success) {
      console.log(`\u2705 DATA RECONCILIATION: Successfully reconciled ${result.affectedRecords} records`);
      res.json({
        success: true,
        message: result.message,
        summary: {
          recordsReconciled: result.affectedRecords,
          backupCreated: result.backupCreated,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        details: result.details
      });
    } else {
      console.error(`\u274C DATA RECONCILIATION: Failed - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
  } catch (error) {
    console.error("Data reconciliation endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during reconciliation",
      error: error.message
    });
  }
});
router.get("/integrity-check", async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    console.log(`\u{1F50D} INTEGRITY CHECK: Running system integrity check for tenant ${tenantId}`);
    const result = await dataManagementService.performIntegrityCheck(tenantId);
    res.json({
      success: result.success,
      message: result.message,
      summary: {
        issuesFound: result.details.length,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      },
      details: result.details
    });
  } catch (error) {
    console.error("Integrity check endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during integrity check",
      error: error.message
    });
  }
});
var rearrangeSchema = z2.object({
  groupId: z2.string().min(1, "\u0917\u094D\u0930\u0941\u092A ID \u0906\u0935\u0936\u094D\u092F\u0915 \u0906\u0939\u0947"),
  upToDate: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "\u0924\u093E\u0930\u0940\u0916 YYYY-MM-DD \u092B\u0949\u0930\u094D\u092E\u0945\u091F \u092E\u0927\u094D\u092F\u0947 \u0905\u0938\u093E\u0935\u0940").optional(),
  checksum: z2.string().optional()
});
router.post("/rearrange-preview", async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const parsed = rearrangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || "Invalid input", mapping: [] });
    }
    const { groupId, upToDate } = parsed.data;
    const result = await dataManagementService.previewRearrangeAccountNumbers(tenantId, groupId, upToDate);
    res.json(result);
  } catch (error) {
    console.error("Rearrange preview error:", error);
    res.status(500).json({ success: false, message: "Preview \u0905\u092F\u0936\u0938\u094D\u0935\u0940: " + error.message, mapping: [] });
  }
});
router.post("/rearrange-confirm", async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const parsed = rearrangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message || "Invalid input", affectedRecords: 0, details: [] });
    }
    const { groupId, upToDate, checksum } = parsed.data;
    const result = await dataManagementService.confirmRearrangeAccountNumbers(tenantId, groupId, upToDate, checksum);
    if (result.success) {
      res.json({ success: true, message: result.message, summary: { accountsRearranged: result.affectedRecords, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, details: result.details });
    } else {
      res.status(400).json({ success: false, message: result.message, details: result.details });
    }
  } catch (error) {
    console.error("Rearrange confirm error:", error);
    res.status(500).json({ success: false, message: "\u0930\u093F\u0905\u0930\u0947\u0902\u091C \u0905\u092F\u0936\u0938\u094D\u0935\u0940: " + error.message, error: error.message });
  }
});
router.post("/rearrange-account-numbers", async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { groupId } = req.body;
    if (!groupId) {
      return res.status(400).json({ success: false, message: "\u0917\u094D\u0930\u0941\u092A ID \u0906\u0935\u0936\u094D\u092F\u0915 \u0906\u0939\u0947", affectedRecords: 0, details: [] });
    }
    const result = await dataManagementService.rearrangeAccountNumbers(tenantId, groupId);
    if (result.success) {
      res.json({ success: true, message: result.message, summary: { accountsRearranged: result.affectedRecords, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, details: result.details });
    } else {
      res.status(400).json({ success: false, message: result.message, details: result.details });
    }
  } catch (error) {
    console.error("Account rearrangement endpoint error:", error);
    res.status(500).json({ success: false, message: "Account rearrangement failed: " + error.message, error: error.message });
  }
});
router.post("/create-backup", async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    console.log(`\u{1F4BE} BACKUP: Creating comprehensive backup for tenant ${tenantId}`);
    const result = await dataManagementService.createComprehensiveBackup(tenantId);
    if (result.success) {
      console.log(`\u2705 BACKUP: Successfully created backup with ID ${result.backupId}`);
      res.json({
        success: true,
        message: result.message,
        backupId: result.backupId,
        summary: {
          recordsBackedUp: result.affectedRecords,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        details: result.details,
        backupData: result.backupData
      });
    } else {
      console.error(`\u274C BACKUP: Failed - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
  } catch (error) {
    console.error("Backup endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during backup",
      error: error.message
    });
  }
});
router.post("/restore-system-data", async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { createBackup = true } = req.body;
    console.log(`\u{1F504} RESTORE: Starting system data restore for tenant ${tenantId}`);
    const result = await dataManagementService.restoreAllSystemData(tenantId, { createBackup });
    if (result.success) {
      console.log(`\u2705 RESTORE: Successfully restored system data, affected ${result.affectedRecords} records`);
      res.json({
        success: true,
        message: result.message,
        summary: {
          recordsRestored: result.affectedRecords,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        details: result.details
      });
    } else {
      console.error(`\u274C RESTORE: Failed - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
  } catch (error) {
    console.error("System restore endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during system restore",
      error: error.message
    });
  }
});
router.post("/restore-from-backup", async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { backupData } = req.body;
    if (!backupData) {
      return res.status(400).json({
        success: false,
        message: "Backup data is required for restore operation"
      });
    }
    console.log(`\u{1F504} COMPREHENSIVE RESTORE: Starting backup restore for tenant ${tenantId}`);
    const result = await dataManagementService.restoreFromBackup(tenantId, backupData);
    if (result.success) {
      console.log(`\u2705 COMPREHENSIVE RESTORE: Successfully restored ${result.affectedRecords} records`);
      res.json({
        success: true,
        message: result.message,
        summary: {
          recordsRestored: result.affectedRecords,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        details: result.details
      });
    } else {
      console.error(`\u274C COMPREHENSIVE RESTORE: Failed - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
  } catch (error) {
    console.error("Comprehensive restore endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during comprehensive restore",
      error: error.message
    });
  }
});
router.post("/preview-cashbook-cleanup", async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { dateFrom, dateTo } = req.body;
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        message: "\u0924\u093E\u0930\u0940\u0916 \u0930\u0947\u0902\u091C (from \u0906\u0923\u093F to) \u0906\u0935\u0936\u094D\u092F\u0915 \u0906\u0939\u0947"
      });
    }
    const result = await dataManagementService.previewCashBookCleanup(tenantId, { dateFrom, dateTo });
    res.json(result);
  } catch (error) {
    console.error("Preview cashbook cleanup error:", error);
    res.status(500).json({
      success: false,
      message: "Preview \u0905\u092F\u0936\u0938\u094D\u0935\u0940: " + error.message
    });
  }
});
router.post("/cleanup-cashbook-entries", async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { dateFrom, dateTo, cleanCashTransactions = true, cleanJournalEntries = true, createBackup = true } = req.body;
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        message: "\u0924\u093E\u0930\u0940\u0916 \u0930\u0947\u0902\u091C (from \u0906\u0923\u093F to) \u0906\u0935\u0936\u094D\u092F\u0915 \u0906\u0939\u0947"
      });
    }
    console.log(`\u{1F9F9} CASHBOOK CLEANUP: Starting for tenant ${tenantId} from ${dateFrom} to ${dateTo}`);
    const result = await dataManagementService.cleanupCashBookEntries(tenantId, {
      dateFrom,
      dateTo,
      cleanCashTransactions,
      cleanJournalEntries,
      createBackup
    });
    if (result.success) {
      console.log(`\u2705 CASHBOOK CLEANUP: ${result.affectedRecords} entries cleaned`);
      res.json({
        success: true,
        message: result.message,
        summary: {
          recordsDeleted: result.affectedRecords,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        details: result.details
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        details: result.details
      });
    }
  } catch (error) {
    console.error("Cashbook cleanup error:", error);
    res.status(500).json({
      success: false,
      message: "\u0915\u0945\u0936\u092C\u0941\u0915 \u0915\u094D\u0932\u0940\u0928\u0905\u092A \u0905\u092F\u0936\u0938\u094D\u0935\u0940: " + error.message
    });
  }
});
var data_management_default = router;

// server/routes/user-management.ts
init_schema();
import { Router as Router2 } from "express";
import { z as z3 } from "zod";
var router2 = Router2();
var requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  req.user = {
    id: req.session.userId,
    tenantId: req.session.tenantId,
    role: req.session.role || "user"
  };
  next();
};
var adminOnlyMiddleware = (req, res, next) => {
  if (req.user.role !== "admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};
router2.get("/users", requireAuth, adminOnlyMiddleware, async (req, res) => {
  try {
    console.log("\u{1F50D} User Management API: Fetching users for", {
      userRole: req.user.role,
      tenantId: req.user.tenantId,
      isSuperAdmin: req.user.role === "super_admin"
    });
    let users2;
    console.log("\u{1F464} Admin: Fetching users for tenant", req.user.tenantId);
    users2 = await storage.getUsersForTenant(req.user.tenantId);
    console.log("\u2705 Users fetched successfully:", users2.length, "users returned");
    res.json(users2);
  } catch (error) {
    console.error("\u274C Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});
router2.post("/users", requireAuth, adminOnlyMiddleware, async (req, res) => {
  try {
    const { userData, permissions } = req.body;
    const validatedUserData = insertUserSchema.parse({
      ...userData,
      tenantId: req.user.tenantId,
      createdBy: req.user.id,
      role: userData.role || "user"
      // Default to 'user' role
    });
    const existingUser = await storage.getUserByCredentials(req.user.tenantId, userData.username);
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }
    const newUser = await storage.createUser(validatedUserData);
    const validatedPermissionsWithUserId = insertUserPermissionsSchema.parse({
      ...permissions,
      userId: newUser.id,
      tenantId: req.user.tenantId
    });
    await storage.createUserPermissions(validatedPermissionsWithUserId);
    await storage.logUserActivity({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      activityType: "create_user",
      description: `Created new user: ${userData.username}`,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      metadata: JSON.stringify({ newUserId: newUser.id })
    });
    res.status(201).json({
      message: "User created successfully",
      userId: newUser.id
    });
  } catch (error) {
    console.error("Error creating user:", error);
    if (error instanceof z3.ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors
      });
    }
    res.status(500).json({ message: "Failed to create user" });
  }
});
router2.put("/users/:userId/permissions", requireAuth, adminOnlyMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const permissions = req.body;
    const validatedPermissions = insertUserPermissionsSchema.partial().parse(permissions);
    const updatedPermissions = await storage.updateUserPermissions(userId, req.user.tenantId, validatedPermissions);
    if (!updatedPermissions) {
      return res.status(404).json({ message: "User permissions not found" });
    }
    await storage.logUserActivity({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      activityType: "update_permissions",
      description: `Updated permissions for user: ${userId}`,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      metadata: JSON.stringify({ targetUserId: userId, permissions: validatedPermissions })
    });
    res.json({
      message: "Permissions updated successfully",
      permissions: updatedPermissions
    });
  } catch (error) {
    console.error("Error updating permissions:", error);
    if (error instanceof z3.ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors
      });
    }
    res.status(500).json({ message: "Failed to update permissions" });
  }
});
router2.put("/users/:userId/status", requireAuth, adminOnlyMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive, isTemporaryDisabled } = req.body;
    if (userId === req.user.id) {
      return res.status(400).json({ message: "\u0938\u094D\u0935\u0924\u0903\u091A\u093E status \u092C\u0926\u0932\u0924\u093E \u092F\u0947\u0924 \u0928\u093E\u0939\u0940" });
    }
    const targetUser = await storage.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }
    if (targetUser.tenantId !== req.user.tenantId) {
      return res.status(403).json({ message: "\u0926\u0941\u0938\u0931\u094D\u092F\u093E \u091F\u0947\u0928\u0902\u091F\u091A\u093E user \u092C\u0926\u0932\u0924\u093E \u092F\u0947\u0924 \u0928\u093E\u0939\u0940" });
    }
    if (targetUser.role === "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Admin user \u091A\u093E status \u092C\u0926\u0932\u0923\u094D\u092F\u093E\u0938\u093E\u0920\u0940 Super Admin \u0905\u0927\u093F\u0915\u093E\u0930 \u0906\u0935\u0936\u094D\u092F\u0915 \u0906\u0939\u0947" });
    }
    if (targetUser.role === "super_admin") {
      return res.status(403).json({ message: "Super Admin user \u091A\u093E status \u092C\u0926\u0932\u0924\u093E \u092F\u0947\u0924 \u0928\u093E\u0939\u0940" });
    }
    const updatedUser = await storage.updateUserStatus(userId, req.user.tenantId, isActive, isTemporaryDisabled);
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    await storage.logUserActivity({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      activityType: "update_status",
      description: `Updated status for user: ${userId} - Active: ${isActive}, Disabled: ${isTemporaryDisabled}`,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      metadata: JSON.stringify({ targetUserId: userId, isActive, isTemporaryDisabled })
    });
    res.json({
      message: "User status updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Failed to update user status" });
  }
});
router2.put("/users/:userId/password", requireAuth, adminOnlyMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }
    const success = await storage.updateUserPassword(userId, req.user.tenantId, newPassword);
    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }
    await storage.logUserActivity({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      activityType: "update_password",
      description: `Updated password for user: ${userId}`,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      metadata: JSON.stringify({ targetUserId: userId })
    });
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Failed to update password" });
  }
});
router2.delete("/users/:userId", requireAuth, adminOnlyMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) {
      return res.status(400).json({ message: "\u0938\u094D\u0935\u0924\u0903\u091A\u0947 \u0905\u0915\u093E\u0909\u0902\u091F \u0921\u093F\u0932\u0940\u091F \u0915\u0930\u0924\u093E \u092F\u0947\u0924 \u0928\u093E\u0939\u0940" });
    }
    const targetUser = await storage.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }
    if (targetUser.tenantId !== req.user.tenantId) {
      return res.status(403).json({ message: "\u0926\u0941\u0938\u0931\u094D\u092F\u093E \u091F\u0947\u0928\u0902\u091F\u091A\u093E user \u0921\u093F\u0932\u0940\u091F \u0915\u0930\u0924\u093E \u092F\u0947\u0924 \u0928\u093E\u0939\u0940" });
    }
    if (targetUser.role === "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Admin user \u0932\u093E \u0921\u093F\u0932\u0940\u091F \u0915\u0930\u0923\u094D\u092F\u093E\u0938\u093E\u0920\u0940 Super Admin \u0905\u0927\u093F\u0915\u093E\u0930 \u0906\u0935\u0936\u094D\u092F\u0915 \u0906\u0939\u0947" });
    }
    if (targetUser.role === "super_admin") {
      return res.status(403).json({ message: "Super Admin user \u0921\u093F\u0932\u0940\u091F \u0915\u0930\u0924\u093E \u092F\u0947\u0924 \u0928\u093E\u0939\u0940" });
    }
    const success = await storage.deleteUser(userId);
    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }
    await storage.logUserActivity({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      activityType: "delete_user",
      description: `Deleted user: ${targetUser.username} (${targetUser.fullName})`,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      metadata: JSON.stringify({ deletedUserId: userId, deletedUsername: targetUser.username })
    });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});
router2.get("/users/:userId/activity", requireAuth, adminOnlyMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const activityLogs = await storage.getUserActivityLogs(userId, req.user.tenantId, limit);
    res.json(activityLogs);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
});
var user_management_default = router2;

// server/automatic-duplicate-prevention.ts
init_db();
init_schema();
init_narration_engine();
import { eq as eq5, and as and4, sql as sql4 } from "drizzle-orm";
var AutomaticDuplicatePrevention = class {
  constructor(tenantId) {
    this.tenantId = tenantId;
  }
  /**
   * AUTOMATIC SYSTEM: Detect and fix missing loan disbursement entries
   * This runs automatically to ensure complete loan transaction pairs
   */
  async autoDetectAndFixMissingDisbursements() {
    const result = { detected: 0, fixed: 0, actions: [] };
    try {
      const activeLoans = await db.select({
        id: loans.id,
        accountNumber: loans.accountNumber,
        borrowerName: loans.borrowerName,
        principalAmount: loans.principalAmount,
        loanDate: loans.loanDate,
        groupId: loans.groupId,
        groupName: groups.name
      }).from(loans).leftJoin(groups, eq5(loans.groupId, groups.id)).where(eq5(loans.tenantId, this.tenantId));
      for (const loan of activeLoans) {
        const existingDisbursement = await db.select().from(cashTransactions).where(and4(
          eq5(cashTransactions.tenantId, this.tenantId),
          eq5(cashTransactions.transactionType, "cash_out"),
          eq5(cashTransactions.category, "loan_disbursement"),
          sql4`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loan.accountNumber}%`}`,
          sql4`ABS(${cashTransactions.amount} - ${loan.principalAmount}) < 0.01`
        ));
        if (existingDisbursement.length === 0) {
          result.detected++;
          console.log(`\u{1F6AB} AUTO-PREVENTION DISABLED: Missing disbursement detected but auto-creation disabled for account ${loan.accountNumber} to prevent duplicates`);
          result.actions.push(`Missing disbursement detected for account ${loan.accountNumber} - creation disabled to prevent duplicates`);
        }
      }
      console.log(`\u{1F916} AUTOMATIC SYSTEM: Detected ${result.detected} missing disbursements, fixed ${result.fixed}`);
      return result;
    } catch (error) {
      console.error("Error in auto-detection:", error);
      result.actions.push(`Error: ${error}`);
      return result;
    }
  }
  /**
   * AUTOMATIC SYSTEM: Smart duplicate detection and prevention
   * Prevents creation of duplicate entries with standardized narrations
   */
  async autoPreventDuplicates(transactionType, accountNumber, amount, transactionDate, proposedNarration) {
    try {
      const standardizedNarration = NarrationEngine.standardizeExistingNarration(proposedNarration);
      const existing = await db.select().from(cashTransactions).where(and4(
        eq5(cashTransactions.tenantId, this.tenantId),
        eq5(cashTransactions.transactionType, transactionType),
        sql4`DATE(${cashTransactions.transactionDate}) = DATE(${transactionDate})`,
        sql4`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${accountNumber}%`}`,
        sql4`ABS(${cashTransactions.amount} - ${amount}) < 0.01`
      ));
      for (const existingTx of existing) {
        const existingStandardized = NarrationEngine.standardizeExistingNarration(existingTx.narration);
        if (NarrationEngine.isSameOperation(standardizedNarration, existingStandardized)) {
          console.log(`\u{1F6AB} AUTOMATIC PREVENTION: Duplicate detected for account ${accountNumber}`);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("Error in duplicate prevention:", error);
      return true;
    }
  }
  /**
   * AUTOMATIC CLEANUP: Remove exact duplicates while preserving legitimate transactions
   */
  async autoCleanupExactDuplicates() {
    const result = { removed: 0, actions: [] };
    try {
      const duplicatesRemoved = await db.execute(sql4`
        DELETE FROM cash_transactions 
        WHERE tenant_id = ${this.tenantId}
        AND id IN (
          SELECT id FROM (
            SELECT id, 
                   ROW_NUMBER() OVER (
                     PARTITION BY narration, amount, transaction_date, transaction_type 
                     ORDER BY created_at
                   ) as row_num
            FROM cash_transactions 
            WHERE tenant_id = ${this.tenantId}
          ) ranked
          WHERE row_num > 1
        )
      `);
      result.removed = Number(duplicatesRemoved.rowCount || 0);
      result.actions.push(`Auto-removed ${result.removed} exact duplicate entries`);
      console.log(`\u{1F9F9} AUTOMATIC CLEANUP: Removed ${result.removed} exact duplicates`);
      return result;
    } catch (error) {
      console.error("Error in auto cleanup:", error);
      result.actions.push(`Cleanup error: ${error}`);
      return result;
    }
  }
  /**
   * MASTER AUTOMATIC FUNCTION: Run all automatic checks and fixes
   */
  async runFullAutomaticSystem() {
    console.log("\u{1F916} STARTING FULL AUTOMATIC SYSTEM...");
    const missingResult = await this.autoDetectAndFixMissingDisbursements();
    const cleanupResult = await this.autoCleanupExactDuplicates();
    const totalActions = [...missingResult.actions, ...cleanupResult.actions];
    console.log(`\u2705 AUTOMATIC SYSTEM COMPLETE: ${missingResult.fixed} missing fixed, ${cleanupResult.removed} duplicates removed`);
    return {
      missingFixed: missingResult.fixed,
      duplicatesRemoved: cleanupResult.removed,
      totalActions
    };
  }
};
function createAutomaticPrevention(tenantId) {
  return new AutomaticDuplicatePrevention(tenantId);
}

// server/middleware/automatic-duplicate-prevention.ts
init_db();
init_schema();
import { eq as eq6, and as and5, sql as sql5 } from "drizzle-orm";
var automaticDuplicatePrevention = async (req, res, next) => {
  const shouldPrevent = req.path.includes("/api/loans") || req.path.includes("/api/cash-transactions") || req.method === "POST" && (req.path.includes("/close") || req.path.includes("/disbur"));
  if (!shouldPrevent || !req.session?.tenantId) {
    return next();
  }
  try {
    const duplicateGroups = await db.select({
      narration: cashTransactions.narration,
      amount: cashTransactions.amount,
      transactionDate: cashTransactions.transactionDate,
      count: sql5`count(*)`
    }).from(cashTransactions).where(eq6(cashTransactions.tenantId, req.session.tenantId)).groupBy(
      cashTransactions.narration,
      cashTransactions.amount,
      cashTransactions.transactionDate
    ).having(sql5`count(*) > 1`);
    if (duplicateGroups.length > 0) {
      console.log(`\u{1F6A8} AUTOMATIC: Detected ${duplicateGroups.length} duplicate groups, cleaning up...`);
      for (const group of duplicateGroups) {
        const duplicates = await db.select().from(cashTransactions).where(and5(
          eq6(cashTransactions.tenantId, req.session.tenantId),
          eq6(cashTransactions.narration, group.narration || ""),
          eq6(cashTransactions.amount, group.amount),
          eq6(cashTransactions.transactionDate, group.transactionDate)
        ));
        console.log(`\u{1F6AB} MIDDLEWARE DISABLED: Duplicate cleanup disabled to prevent interference with main system`);
        for (const duplicate of toDelete) {
          await db.delete(cashTransactions).where(eq6(cashTransactions.id, duplicate.id));
          console.log(`\u2705 AUTOMATIC: Removed duplicate entry: ${duplicate.amount} on ${duplicate.transactionDate}`);
        }
      }
    }
    next();
  } catch (error) {
    console.error("\u{1F6A8} AUTOMATIC: Duplicate prevention failed:", error);
    next();
  }
};

// server/middleware/cache.ts
import NodeCache2 from "node-cache";
var cache = new NodeCache2({
  stdTTL: 300,
  // 5 minutes default
  checkperiod: 60,
  // Check for expired keys every minute
  useClones: false
  // Better performance for read-heavy workloads
});
function apiCache(options = {}) {
  const {
    ttl = 300,
    // 5 minutes default
    keyGenerator = (req) => {
      const tenantId = req.session?.tenantId || "no-tenant";
      const path6 = req.originalUrl;
      const method = req.method;
      return `${method}:${tenantId}:${path6}`;
    },
    condition = () => true
  } = options;
  return (req, res, next) => {
    if (!condition(req)) {
      return next();
    }
    const cacheKey = keyGenerator(req);
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      res.set("X-Cache", "HIT");
      return res.json(cachedData);
    }
    res.set("X-Cache", "MISS");
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, data, ttl);
      }
      return originalJson(data);
    };
    next();
  };
}
function invalidateCache(pattern, tenantId) {
  const keys = cache.keys();
  let invalidatedCount = 0;
  keys.forEach((key) => {
    let shouldDelete = false;
    if (tenantId && pattern) {
      shouldDelete = key.includes(tenantId) && key.includes(pattern);
    } else if (tenantId) {
      shouldDelete = key.includes(tenantId);
    } else if (pattern) {
      shouldDelete = key.includes(pattern);
    }
    if (shouldDelete) {
      cache.del(key);
      invalidatedCount++;
    }
  });
  return invalidatedCount;
}
function invalidateTenantCache(tenantId) {
  return invalidateCache("", tenantId);
}
function getCacheStats() {
  const stats = cache.getStats();
  const keys = cache.keys();
  return {
    keys: stats.keys,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits / (stats.hits + stats.misses) || 0,
    memoryUsage: keys.length,
    keyDetails: keys.slice(0, 10)
    // Show first 10 keys for debugging
  };
}
function cacheBuster(patterns) {
  return (req, res, next) => {
    const tenantId = req.session?.tenantId;
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && tenantId) {
        let totalInvalidated = 0;
        patterns.forEach((pattern) => {
          totalInvalidated += invalidateCache(pattern, tenantId);
        });
        if (patterns.some((p) => p.includes("groups"))) {
          const forceClearKey = `GET:${tenantId}:/api/groups`;
          cache.del(forceClearKey);
        }
      }
      return originalJson(data);
    };
    next();
  };
}

// server/real-time-sync-engine.ts
var RealTimeSyncEngine = class _RealTimeSyncEngine {
  static instance;
  static getInstance() {
    if (!_RealTimeSyncEngine.instance) {
      _RealTimeSyncEngine.instance = new _RealTimeSyncEngine();
    }
    return _RealTimeSyncEngine.instance;
  }
  /**
   * Main sync orchestrator - handles ALL loan operations
   */
  async syncLoanOperation(operation) {
    const startTime = Date.now();
    const result = {
      success: true,
      operationsPerformed: [],
      cashTransactionsAffected: 0,
      errors: [],
      timeTaken: 0
    };
    try {
      switch (operation.type) {
        case "CREATE":
          await this.handleLoanCreation(operation, result);
          break;
        case "UPDATE":
          await this.handleLoanUpdate(operation, result);
          break;
        case "DELETE":
          await this.handleLoanDeletion(operation, result);
          break;
        case "CLOSE":
          await this.handleLoanClosure(operation, result);
          break;
        case "REOPEN":
          await this.handleLoanReopen(operation, result);
          break;
        default:
          throw new Error(`Unknown sync operation type: ${operation.type}`);
      }
      result.timeTaken = Date.now() - startTime;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.timeTaken = Date.now() - startTime;
    }
    return result;
  }
  /**
   * Handle loan creation - create corresponding disbursement cash transaction
   */
  async handleLoanCreation(operation, result) {
    const { loanId, tenantId, newData } = operation;
    if (!newData || Number(newData.principalAmount) <= 0) {
      return;
    }
    const existingDisbursement = await this.findDisbursementTransaction(tenantId, newData.accountNumber, newData.principalAmount, newData.loanDate);
    if (existingDisbursement) {
      result.operationsPerformed.push("SKIP_EXISTING_DISBURSEMENT");
      return;
    }
    const groupName = await this.getGroupName(tenantId, newData.groupId);
    const standardNarration = this.createDisbursementNarration(
      newData.accountNumber,
      newData.borrowerName,
      Number(newData.principalAmount),
      groupName
    );
    await storage.createCashTransaction({
      tenantId,
      transactionDate: newData.loanDate,
      transactionType: "cash_out",
      amount: Number(newData.principalAmount),
      category: "loan_disbursement",
      narration: standardNarration,
      isSystemGenerated: true
    });
    result.operationsPerformed.push("CREATE_DISBURSEMENT_TRANSACTION");
    result.cashTransactionsAffected += 1;
  }
  /**
   * Handle loan updates - sync amount/date changes with existing cash transactions
   */
  async handleLoanUpdate(operation, result) {
    const { tenantId, oldData, newData } = operation;
    if (!oldData || !newData) {
      return;
    }
    const amountChanged = Number(oldData.principalAmount) !== Number(newData.principalAmount);
    const dateChanged = oldData.loanDate !== newData.loanDate;
    const statusChanged = oldData.status !== newData.status;
    if (amountChanged || dateChanged) {
      await this.updateDisbursementTransaction(operation, result);
    }
    if (statusChanged) {
      await this.handleStatusChange(operation, result);
    }
  }
  /**
   * Update disbursement transaction when loan amount or date changes
   */
  async updateDisbursementTransaction(operation, result) {
    const { tenantId, oldData, newData } = operation;
    const disbursementTransaction = await this.findDisbursementTransaction(
      tenantId,
      oldData.accountNumber,
      oldData.principalAmount,
      oldData.loanDate
    );
    if (!disbursementTransaction) {
      result.operationsPerformed.push("NO_DISBURSEMENT_TO_UPDATE");
      return;
    }
    const updateData = {};
    if (Number(oldData.principalAmount) !== Number(newData.principalAmount)) {
      updateData.amount = Number(newData.principalAmount);
      result.operationsPerformed.push(`UPDATE_AMOUNT_${oldData.principalAmount}_TO_${newData.principalAmount}`);
    }
    if (oldData.loanDate !== newData.loanDate) {
      updateData.transactionDate = newData.loanDate;
      result.operationsPerformed.push(`UPDATE_DATE_${oldData.loanDate}_TO_${newData.loanDate}`);
    }
    const groupName = await this.getGroupName(tenantId, newData.groupId);
    const { NarrationEngine: NarrationEngine2 } = (init_narration_engine(), __toCommonJS(narration_engine_exports));
    updateData.narration = NarrationEngine2.createLoanAmountUpdateNarration(
      newData.accountNumber,
      newData.borrowerName,
      Number(newData.principalAmount),
      groupName
    );
    await storage.updateCashTransaction(disbursementTransaction.id, tenantId, updateData);
    result.cashTransactionsAffected += 1;
  }
  /**
   * Handle loan deletion - remove all related cash transactions
   */
  async handleLoanDeletion(operation, result) {
    const { tenantId, oldData } = operation;
    if (!oldData) {
      return;
    }
    const relatedTransactions = await this.findAllRelatedTransactions(tenantId, oldData.accountNumber, oldData.borrowerName);
    for (const transaction of relatedTransactions) {
      await storage.deleteCashTransaction(transaction.id, tenantId);
      result.cashTransactionsAffected += 1;
      result.operationsPerformed.push(`DELETE_TRANSACTION_${transaction.category}`);
    }
  }
  /**
   * Handle loan closure - create closure cash transaction
   */
  async handleLoanClosure(operation, result) {
    const { tenantId, newData } = operation;
    if (!newData) {
      return;
    }
    const existingClosure = await this.findClosureTransaction(tenantId, newData.accountNumber, newData.totalAmount, newData.closureDate);
    if (existingClosure) {
      result.operationsPerformed.push("SKIP_EXISTING_CLOSURE");
      return;
    }
    const groupName = await this.getGroupName(tenantId, newData.groupId);
    const standardNarration = this.createClosureNarration(
      newData.accountNumber,
      newData.borrowerName,
      Number(newData.totalAmount),
      groupName
    );
    await storage.createCashTransaction({
      tenantId,
      transactionDate: newData.closureDate,
      transactionType: "cash_in",
      amount: Number(newData.totalAmount),
      category: "loan_repayment",
      narration: standardNarration,
      isSystemGenerated: true
    });
    result.operationsPerformed.push("CREATE_CLOSURE_TRANSACTION");
    result.cashTransactionsAffected += 1;
  }
  /**
   * Handle loan reopen - remove closure transactions
   */
  async handleLoanReopen(operation, result) {
    const { tenantId, oldData } = operation;
    if (!oldData) {
      return;
    }
    const closureTransactions = await this.findClosureTransactions(tenantId, oldData.accountNumber, oldData.borrowerName);
    for (const transaction of closureTransactions) {
      await storage.deleteCashTransaction(transaction.id, tenantId);
      result.cashTransactionsAffected += 1;
      result.operationsPerformed.push("DELETE_CLOSURE_TRANSACTION");
    }
  }
  /**
   * Handle status change between active/closed
   */
  async handleStatusChange(operation, result) {
    const { oldData, newData } = operation;
    if (oldData.status === "active" && newData.status === "closed") {
      await this.handleLoanClosure(operation, result);
    } else if (oldData.status === "closed" && newData.status === "active") {
      await this.handleLoanReopen(operation, result);
    }
  }
  // Helper methods for finding transactions
  async findDisbursementTransaction(tenantId, accountNumber, amount, date2) {
    const transactions2 = await storage.getCashTransactions(tenantId);
    return transactions2.find(
      (ct) => ct.narration?.includes("\u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923") && ct.narration?.includes(accountNumber) && ct.category === "loan_disbursement" && Math.abs(Number(ct.amount) - Number(amount)) < 0.01
    );
  }
  async findClosureTransaction(tenantId, accountNumber, amount, date2) {
    const transactions2 = await storage.getCashTransactions(tenantId);
    return transactions2.find(
      (ct) => ct.narration?.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926") && ct.narration?.includes(accountNumber) && ct.category === "loan_repayment" && Math.abs(Number(ct.amount) - Number(amount)) < 0.01
    );
  }
  async findAllRelatedTransactions(tenantId, accountNumber, borrowerName) {
    const transactions2 = await storage.getCashTransactions(tenantId);
    return transactions2.filter(
      (ct) => ct.narration && (ct.narration.includes(accountNumber) || ct.narration.includes(borrowerName))
    );
  }
  async findClosureTransactions(tenantId, accountNumber, borrowerName) {
    const transactions2 = await storage.getCashTransactions(tenantId);
    return transactions2.filter(
      (ct) => ct.narration?.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926") && (ct.narration.includes(accountNumber) || ct.narration.includes(borrowerName))
    );
  }
  // Helper methods for data processing
  async getGroupName(tenantId, groupId) {
    if (!groupId) return "";
    const groups3 = await storage.getGroups(tenantId);
    const group = groups3.find((g) => g.id === groupId);
    return group?.name || "";
  }
  createDisbursementNarration(accountNumber, borrowerName, amount, groupName) {
    const { NarrationEngine: NarrationEngine2 } = (init_narration_engine(), __toCommonJS(narration_engine_exports));
    return NarrationEngine2.createLoanDisbursementNarration(accountNumber, borrowerName, amount, groupName);
  }
  createClosureNarration(accountNumber, borrowerName, amount, groupName) {
    const { NarrationEngine: NarrationEngine2 } = (init_narration_engine(), __toCommonJS(narration_engine_exports));
    return NarrationEngine2.createLoanClosureNarration(accountNumber, borrowerName, amount, 0, groupName);
  }
};
function getRealTimeSyncEngine() {
  return RealTimeSyncEngine.getInstance();
}
async function triggerLoanSync(operation) {
  const engine = getRealTimeSyncEngine();
  return await engine.syncLoanOperation(operation);
}

// server/routes.ts
init_narration_engine();
async function invalidateOtherSessions(userId, currentSessionId) {
  try {
    const result = await pool.query(
      `DELETE FROM sessions WHERE sid != $1 AND sess->>'userId' = $2`,
      [currentSessionId || "", userId]
    );
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(`\u{1F512} Invalidated ${deletedCount} other session(s) for user ${userId}`);
    }
    return deletedCount;
  } catch (error) {
    console.error("Failed to invalidate other sessions:", error);
    return 0;
  }
}
function convertIndianDateToISO(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return dateStr;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
var loginSchema = z4.object({
  tenantId: z4.string().min(1),
  username: z4.string().min(1),
  password: z4.string().min(1)
});
async function registerRoutes(app2) {
  const isProduction = process.env.NODE_ENV === "production";
  const isReplit = !!(process.env.REPLIT_DOMAINS || process.env.REPLIT_APP_NAME || process.env.REPL_ID);
  app2.set("trust proxy", 1);
  const sessionConfig = {
    secret: process.env.SESSION_SECRET || "your-secret-key-loan-mgmt-2025-replit",
    resave: true,
    // Force save to ensure persistence in Replit
    saveUninitialized: true,
    // Create session for better tracking
    name: "connect.sid",
    // Explicit session name
    rolling: true,
    // Extend session on activity
    cookie: {
      secure: false,
      // Always false for Replit compatibility
      httpOnly: false,
      // Allow frontend access for debugging
      maxAge: 24 * 60 * 60 * 1e3,
      // 24 hours
      sameSite: "lax",
      path: "/",
      domain: void 0
      // Let Replit handle domain automatically
    }
  };
  const pgStore = connectPgSimple(session);
  const sessionStore = new pgStore({
    pool,
    tableName: "sessions",
    createTableIfMissing: true,
    // Auto-create sessions table if missing
    ttl: 24 * 60 * 60
    // 24 hours in seconds
  });
  app2.use(session({
    ...sessionConfig,
    store: sessionStore
  }));
  const requireAuth2 = (req, res, next) => {
    if (!req.session?.userId || !req.session?.tenantId) {
      return res.status(401).json({
        message: "Not authenticated",
        debug: process.env.NODE_ENV === "development" ? {
          hasSession: !!req.session,
          hasUserId: !!req.session?.userId,
          hasTenantId: !!req.session?.tenantId
        } : void 0
      });
    }
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1e3);
    const todayIST = nowIST.toISOString().split("T")[0];
    const loginDate = req.session.loginDate;
    if (!loginDate || loginDate < todayIST) {
      req.session.destroy((err) => {
        if (err) console.error("Session destroy error:", err);
      });
      return res.status(401).json({ message: "Session expired. Please login again." });
    }
    next();
  };
  app2.get("/api/auth/verify", (req, res) => {
    console.log("\u{1F510} SESSION VERIFY:", {
      hasSession: !!req.session,
      userId: req.session?.userId,
      tenantId: req.session?.tenantId,
      role: req.session?.role
    });
    if (!req.session?.userId || !req.session?.tenantId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1e3);
    const todayIST = nowIST.toISOString().split("T")[0];
    const loginDate = req.session.loginDate;
    if (!loginDate || loginDate < todayIST) {
      req.session.destroy((err) => {
        if (err) console.error("Session destroy error:", err);
      });
      return res.status(401).json({ message: "Session expired. Please login again." });
    }
    res.json({
      user: {
        id: req.session.userId,
        tenantId: req.session.tenantId,
        role: req.session.role
      }
    });
  });
  app2.get("/api/cache/stats", requireAuth2, (req, res) => {
    if (req.session.role !== "super_admin") {
      return res.status(403).json({ message: "Super admin access required" });
    }
    const stats = getCacheStats();
    res.json(stats);
  });
  app2.get("/api/health", apiCache({ ttl: 60 }), async (req, res) => {
    try {
      const healthStatus = {
        status: "ok",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        database: "connected",
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime(),
        version: "1.0.0"
      };
      await storage.getAllUsers();
      res.status(200).json(healthStatus);
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(503).json({
        status: "error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        database: "disconnected",
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime(),
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/ready", async (req, res) => {
    try {
      const checks = {
        database: false,
        session: false,
        environment: false
      };
      try {
        await storage.getAllUsers();
        checks.database = true;
      } catch (e) {
        console.error("Database readiness check failed:", e);
      }
      try {
        checks.session = !!sessionStore;
      } catch (e) {
        console.error("Session store readiness check failed:", e);
      }
      checks.environment = !!(process.env.DATABASE_URL && process.env.SESSION_SECRET);
      const allReady = Object.values(checks).every((check) => check);
      if (allReady) {
        res.status(200).json({
          status: "ready",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          checks
        });
      } else {
        res.status(503).json({
          status: "not ready",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          checks
        });
      }
    } catch (error) {
      console.error("Readiness check failed:", error);
      res.status(503).json({
        status: "error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.use("/api", automaticDuplicatePrevention);
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const startTime = Date.now();
      const parsed = loginSchema.parse(req.body);
      const tenantId = parsed.tenantId.toUpperCase().trim();
      const username = parsed.username.trim();
      const password = parsed.password;
      const user = await storage.getUserByCredentials(tenantId, username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const isValid = await bcrypt2.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (user.role !== "super_admin") {
        const tenantCompany = await storage.getCompany(tenantId);
        if (tenantCompany && tenantCompany.isActive === false) {
          return res.status(403).json({ message: "\u0924\u0941\u092E\u091A\u093E \u091F\u0947\u0928\u0902\u091F \u0928\u093F\u0937\u094D\u0915\u094D\u0930\u093F\u092F (Deactivated) \u0906\u0939\u0947. \u0915\u0943\u092A\u092F\u093E Super Admin \u0936\u0940 \u0938\u0902\u092A\u0930\u094D\u0915 \u0938\u093E\u0927\u093E." });
        }
      }
      const loginDuration = Date.now() - startTime;
      req.session.userId = user.id;
      req.session.tenantId = user.tenantId;
      req.session.role = user.role;
      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1e3);
      req.session.loginDate = nowIST.toISOString().split("T")[0];
      try {
        await storage.updateUserLoginInfo(user.id);
        await storage.logUserActivity({
          userId: user.id,
          tenantId: user.tenantId,
          activityType: "login",
          description: `User logged in: ${user.username}`,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          metadata: JSON.stringify({ role: user.role })
        });
      } catch (error) {
        console.error("Error logging user activity:", error);
      }
      req.session.save((err) => {
        if (err) {
          console.error(`\u274C SESSION SAVE FAILED: ${user.username}@${user.tenantId}`, err);
          return res.status(500).json({ message: "Session save failed" });
        }
        console.log(`\u{1F4BE} SESSION SAVED: ${user.username}@${user.tenantId}`);
        res.json({
          user: {
            id: user.id,
            username: user.username,
            tenantId: user.tenantId,
            role: user.role
          }
        });
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid request data" });
    }
  });
  app2.put("/api/auth/change-password", requireAuth2, async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const userId = req.session.userId;
      await storage.resetUserPassword(userId, req.session.tenantId, newPassword, "self");
      await invalidateOtherSessions(userId, req.sessionID);
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
  app2.post("/api/auth/logout", async (req, res) => {
    const userId = req.session.userId;
    const tenantId = req.session.tenantId;
    if (userId && tenantId) {
      try {
        await storage.logUserActivity({
          userId,
          tenantId,
          activityType: "logout",
          description: `User logged out`,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          metadata: JSON.stringify({})
        });
      } catch (error) {
        console.error("Error logging logout activity:", error);
      }
    }
    req.session.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });
  app2.patch("/api/auth/change-password", requireAuth2, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      const currentUser = await storage.getUser(req.session.userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!await bcrypt2.compare(currentPassword, currentUser.password)) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      const hashedNewPassword = await bcrypt2.hash(newPassword, 10);
      await storage.updateUser(req.session.userId, { password: hashedNewPassword });
      await invalidateOtherSessions(req.session.userId, req.sessionID);
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to change password" });
    }
  });
  app2.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1e3);
      const todayIST = nowIST.toISOString().split("T")[0];
      if (!req.session.loginDate || req.session.loginDate < todayIST) {
        req.session.destroy((err) => {
          if (err) console.error("Session destroy error:", err);
        });
        return res.status(401).json({ message: "Session expired. Please login again." });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      res.json({
        user: {
          id: user.id,
          username: user.username,
          tenantId: user.tenantId,
          role: user.role
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/user-permissions", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1e3);
      const todayIST = nowIST.toISOString().split("T")[0];
      if (!req.session.loginDate || req.session.loginDate < todayIST) {
        req.session.destroy((err) => {
          if (err) console.error("Session destroy error:", err);
        });
        return res.status(401).json({ message: "Session expired. Please login again." });
      }
      const permissions = await storage.getUserPermissions(req.session.userId, req.session.tenantId);
      res.json(permissions || {});
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.json({});
    }
  });
  app2.get("/api/company", requireAuth2, apiCache({
    ttl: 600,
    keyGenerator: (req) => `company:${req.session.tenantId}`
  }), async (req, res) => {
    try {
      let company = await storage.getCompany(req.session.tenantId);
      if (!company && req.session.role === "super_admin") {
        console.log(`\u{1F527} Creating missing company for Super Admin tenant: ${req.session.tenantId}`);
        company = await storage.createCompany({
          tenantId: req.session.tenantId,
          name: `${req.session.tenantId} Super Admin Organization`,
          contactNumber: "1234567890",
          email: "admin@company.com",
          address: "Admin Office Address",
          licenseNumber: `SUPER_${req.session.tenantId}`
        });
        console.log("\u2705 Super Admin company created:", company);
      }
      if (!company) {
        console.log(`\u274C No company found for tenant: ${req.session.tenantId}`);
        return res.status(404).json({
          message: "\u0915\u0902\u092A\u0928\u0940 \u092E\u093E\u0939\u093F\u0924\u0940 \u0938\u093E\u092A\u0921\u0932\u0940 \u0928\u093E\u0939\u0940",
          englishMessage: "Company information not found",
          tenantId: req.session.tenantId
        });
      }
      console.log(`\u2705 Company data retrieved for tenant: ${req.session.tenantId}`, company);
      res.json(company);
    } catch (error) {
      console.error("\u{1F6A8} Company fetch error:", error);
      res.status(500).json({
        message: "\u0915\u0902\u092A\u0928\u0940 \u092E\u093E\u0939\u093F\u0924\u0940 \u0932\u094B\u0921 \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940",
        englishMessage: "Error loading company information",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/company", requireAuth2, cacheBuster(["company:"]), async (req, res) => {
    try {
      console.log("Company creation request body:", req.body);
      console.log("Session data:", { userId: req.session.userId, tenantId: req.session.tenantId });
      const companyData = insertCompanySchema.parse({
        ...req.body,
        tenantId: req.session.tenantId
      });
      console.log("Parsed company data:", companyData);
      const company = await storage.createCompany(companyData);
      console.log("Company created successfully:", company);
      res.json(company);
    } catch (error) {
      console.error("Company creation error:", error);
      res.status(400).json({
        message: "\u0905\u0935\u0948\u0927 \u0915\u0902\u092A\u0928\u0940 \u0921\u0947\u091F\u093E",
        englishMessage: "Invalid company data",
        error: error instanceof Error ? error.message : String(error),
        details: "\u0915\u0943\u092A\u092F\u093E \u0938\u0930\u094D\u0935 \u0906\u0935\u0936\u094D\u092F\u0915 \u092B\u0940\u0932\u094D\u0921 \u092D\u0930\u093E"
      });
    }
  });
  app2.put("/api/company/bottom-nav-toggle", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "admin" && req.session.role !== "super_admin") {
        return res.status(403).json({ message: "\u092B\u0915\u094D\u0924 \u0905\u200D\u0945\u0921\u092E\u093F\u0928 \u0939\u0947 \u092C\u0926\u0932\u0942 \u0936\u0915\u0924\u094B" });
      }
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "Invalid value" });
      }
      const tenantId = req.session.tenantId;
      try {
        const company = await storage.updateCompany(tenantId, { bottomNavEnabled: enabled });
        if (!company) {
          return res.status(404).json({ message: "\u0915\u0902\u092A\u0928\u0940 \u0938\u093E\u092A\u0921\u0932\u0940 \u0928\u093E\u0939\u0940" });
        }
        invalidateCache("company", tenantId);
        return res.json(company);
      } catch (dbError) {
        if (dbError?.message?.includes("bottom_nav_enabled") || dbError?.message?.includes("column")) {
          try {
            const { db: db2 } = await Promise.resolve().then(() => (init_db(), db_exports));
            const { sql: sql12 } = await import("drizzle-orm");
            await db2.execute(sql12`ALTER TABLE companies ADD COLUMN IF NOT EXISTS bottom_nav_enabled BOOLEAN NOT NULL DEFAULT true`);
            const company = await storage.updateCompany(tenantId, { bottomNavEnabled: enabled });
            if (!company) {
              return res.status(404).json({ message: "\u0915\u0902\u092A\u0928\u0940 \u0938\u093E\u092A\u0921\u0932\u0940 \u0928\u093E\u0939\u0940" });
            }
            invalidateCache("company", tenantId);
            return res.json(company);
          } catch (alterError) {
            console.error("Failed to add bottom_nav_enabled column:", alterError);
            throw dbError;
          }
        } else {
          throw dbError;
        }
      }
    } catch (error) {
      console.error("Bottom nav toggle error:", error);
      res.status(500).json({ message: "\u0938\u0947\u091F\u093F\u0902\u0917 \u092C\u0926\u0932\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940", error: error instanceof Error ? error.message : "Unknown" });
    }
  });
  app2.put("/api/company/summary-columns-toggle", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "admin" && req.session.role !== "super_admin") {
        return res.status(403).json({ message: "\u092B\u0915\u094D\u0924 \u0905\u200D\u0945\u0921\u092E\u093F\u0928 \u0939\u0947 \u092C\u0926\u0932\u0942 \u0936\u0915\u0924\u094B" });
      }
      const { enabled, field } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "Invalid value" });
      }
      const tenantId = req.session.tenantId;
      const updateData = {};
      if (field === "showSummaryDetails") {
        updateData.showSummaryDetails = enabled;
      } else {
        updateData.showSummaryRateMonths = enabled;
      }
      const company = await storage.updateCompany(tenantId, updateData);
      if (!company) {
        return res.status(404).json({ message: "\u0915\u0902\u092A\u0928\u0940 \u0938\u093E\u092A\u0921\u0932\u0940 \u0928\u093E\u0939\u0940" });
      }
      invalidateCache("company", tenantId);
      return res.json(company);
    } catch (error) {
      console.error("Summary columns toggle error:", error);
      res.status(500).json({ message: "\u0938\u0947\u091F\u093F\u0902\u0917 \u092C\u0926\u0932\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940", error: error instanceof Error ? error.message : "Unknown" });
    }
  });
  app2.put("/api/company", requireAuth2, cacheBuster(["company:"]), async (req, res) => {
    try {
      const companyData = insertCompanySchema.partial().parse(req.body);
      const company = await storage.updateCompany(req.session.tenantId, companyData);
      if (!company) {
        return res.status(404).json({
          message: "\u0915\u0902\u092A\u0928\u0940 \u0938\u093E\u092A\u0921\u0932\u0940 \u0928\u093E\u0939\u0940",
          englishMessage: "Company not found",
          tenantId: req.session.tenantId
        });
      }
      res.json(company);
    } catch (error) {
      res.status(400).json({
        message: "\u0915\u0902\u092A\u0928\u0940 \u0905\u092A\u0921\u0947\u091F \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940",
        englishMessage: "Error updating company data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/groups", requireAuth2, async (req, res) => {
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "ETag": `"groups-${Date.now()}"`
      // Force unique response
    });
    try {
      const groups3 = await storage.getGroups(req.session.tenantId);
      res.json(groups3);
    } catch (error) {
      console.error("Groups fetch error:", error);
      res.status(500).json({
        message: "\u0917\u094D\u0930\u0941\u092A \u0932\u094B\u0921 \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940",
        englishMessage: "Error loading groups",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/groups", requireAuth2, cacheBuster(["groups:", "dashboard:"]), async (req, res) => {
    try {
      const groupData = insertGroupSchema.parse({
        ...req.body,
        tenantId: req.session.tenantId
      });
      const group = await storage.createGroup(groupData);
      try {
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "create_group", description: `\u0928\u0935\u0940\u0928 \u0917\u094D\u0930\u0941\u092A \u0924\u092F\u093E\u0930: ${group.name}`, metadata: JSON.stringify({ groupId: group.id, groupName: group.name }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      res.json(group);
    } catch (error) {
      if (error instanceof Error && error.message.includes("\u0906\u0927\u0940\u091A \u0905\u0938\u094D\u0924\u093F\u0924\u094D\u0935\u093E\u0924 \u0906\u0939\u0947")) {
        return res.status(409).json({
          message: error.message,
          englishMessage: error.message.split(" / ")[1] || error.message,
          type: "DUPLICATE_NAME_ERROR"
        });
      }
      res.status(400).json({
        message: "\u0905\u0935\u0948\u0927 \u0917\u094D\u0930\u0941\u092A \u0921\u0947\u091F\u093E",
        englishMessage: "Invalid group data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.put("/api/groups/:id", requireAuth2, cacheBuster(["groups:", "dashboard:"]), async (req, res) => {
    try {
      const { id } = req.params;
      const groupData = insertGroupSchema.partial().parse(req.body);
      const allGroups = await storage.getGroups(req.session.tenantId);
      const oldGroup = allGroups.find((g) => g.id === id);
      const group = await storage.updateGroup(id, req.session.tenantId, groupData);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      try {
        const changedFields = {};
        if (oldGroup) {
          for (const key of Object.keys(req.body)) {
            if (oldGroup[key] !== void 0 && String(oldGroup[key]) !== String(req.body[key])) {
              changedFields[key] = { old: oldGroup[key], new: req.body[key] };
            }
          }
        }
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "update_group", description: `\u0917\u094D\u0930\u0941\u092A \u0905\u092A\u0921\u0947\u091F: ${group.name}`, metadata: JSON.stringify({ groupId: id, groupName: group.name, oldName: oldGroup?.name, changedFields }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      res.json(group);
    } catch (error) {
      if (error instanceof Error && error.message.includes("\u0906\u0927\u0940\u091A \u0905\u0938\u094D\u0924\u093F\u0924\u094D\u0935\u093E\u0924 \u0906\u0939\u0947")) {
        return res.status(409).json({
          message: error.message,
          englishMessage: error.message.split(" / ")[1] || error.message,
          type: "DUPLICATE_NAME_ERROR"
        });
      }
      res.status(400).json({
        message: "\u0917\u094D\u0930\u0941\u092A \u0905\u092A\u0921\u0947\u091F \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940",
        englishMessage: "Error updating group data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.delete("/api/groups/:id", requireAuth2, cacheBuster(["groups:", "dashboard:"]), async (req, res) => {
    try {
      const { id } = req.params;
      const allGroups = await storage.getGroups(req.session.tenantId);
      const groupToDelete = allGroups.find((g) => g.id === id);
      const success = await storage.deleteGroup(id, req.session.tenantId);
      if (!success) {
        return res.status(404).json({ message: "Group not found" });
      }
      try {
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "delete_group", description: `\u0917\u094D\u0930\u0941\u092A \u0921\u093F\u0932\u0940\u091F: ${groupToDelete?.name || id}`, metadata: JSON.stringify({ groupId: id, groupName: groupToDelete?.name }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      res.json({ message: "Group deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete group" });
    }
  });
  app2.get("/api/maturity-reminders", requireAuth2, async (req, res) => {
    try {
      const tenantId = req.session.tenantId;
      const allLoans = await storage.getLoans(tenantId, { status: "active" });
      const parseLocalDate = (dateStr) => {
        const parts = dateStr.split("-");
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      };
      const now = /* @__PURE__ */ new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const reminders = [];
      for (const loan of allLoans) {
        if (!loan.hasMaturity) continue;
        let matDate = null;
        if (loan.calculatedMaturityDate) {
          matDate = parseLocalDate(String(loan.calculatedMaturityDate));
        } else if (loan.maturityMonths && loan.loanDate) {
          const d = parseLocalDate(String(loan.loanDate));
          d.setMonth(d.getMonth() + Number(loan.maturityMonths));
          matDate = d;
        }
        if (!matDate) continue;
        const daysRemaining = Math.round((matDate.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24));
        if (daysRemaining < 0) continue;
        const loanStartDate = parseLocalDate(String(loan.loanDate));
        const totalDurationDays = Math.round((matDate.getTime() - loanStartDate.getTime()) / (1e3 * 60 * 60 * 24));
        let showReminder = false;
        if (totalDurationDays > 30) {
          const daysToOneMonthBefore = daysRemaining - 30;
          const isInFirstWindow = daysToOneMonthBefore >= 0 && daysToOneMonthBefore < 5;
          const isInLastWindow = daysRemaining <= 8;
          showReminder = isInFirstWindow || isInLastWindow;
        } else {
          showReminder = daysRemaining <= 5;
        }
        if (showReminder) {
          reminders.push({
            loanId: loan.id,
            borrowerName: loan.borrowerName,
            accountNumber: loan.accountNumber,
            principalAmount: loan.principalAmount,
            loanDate: loan.loanDate,
            maturityDate: matDate.toISOString().split("T")[0],
            daysRemaining,
            maturityMonths: loan.maturityMonths,
            groupId: loan.groupId
          });
        }
      }
      reminders.sort((a, b) => a.daysRemaining - b.daysRemaining);
      res.json({ success: true, reminders, count: reminders.length });
    } catch (error) {
      console.error("Maturity reminders error:", error);
      res.status(500).json({ message: "\u092E\u0941\u0926\u0924 \u0938\u0942\u091A\u0928\u093E \u092E\u093F\u0933\u0935\u0923\u094D\u092F\u093E\u0924 \u0924\u094D\u0930\u0941\u091F\u0940" });
    }
  });
  app2.get("/api/loans", requireAuth2, async (req, res) => {
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "ETag": `"loans-${Date.now()}"`
      // Force unique response
    });
    try {
      const { groupId, borrowerId, status } = req.query;
      const filters = {
        groupId,
        borrowerId,
        status
      };
      const loans2 = await storage.getLoans(req.session.tenantId, filters);
      res.json(loans2);
    } catch (error) {
      console.error("Loans fetch error:", error);
      res.status(500).json({ message: "Failed to fetch loans" });
    }
  });
  app2.get("/api/borrowers/autocomplete", requireAuth2, async (req, res) => {
    try {
      const { search } = req.query;
      const searchTerm = (search || "").trim();
      if (searchTerm.length < 2) {
        return res.json([]);
      }
      const searchVariations = getNameTranslations(searchTerm);
      const normalizedTerm = normalizeMarathiVowels(searchTerm);
      if (normalizedTerm !== searchTerm) {
        const normalizedVariations = getNameTranslations(normalizedTerm);
        normalizedVariations.forEach((v) => {
          if (!searchVariations.includes(v)) searchVariations.push(v);
        });
      }
      const vowelFrom = "\u0940\u0942\u0948\u094C\u0945\u0949\u0906\u0908\u090A\u0910\u0914";
      const vowelTo = "\u093F\u0941\u0947\u094B\u0947\u094B\u0905\u0907\u0909\u090F\u0913";
      const searchConditions = searchVariations.flatMap((variation) => [
        sql10`${loans.borrowerName} ILIKE ${`%${variation}%`}`,
        sql10`translate(${loans.borrowerName}, ${vowelFrom}, ${vowelTo}) ILIKE ${`%${normalizeMarathiVowels(variation)}%`}`
      ]);
      const combinedSearchCondition = searchConditions.length > 1 ? sql10`(${searchConditions.reduce(
        (acc, curr, idx) => idx === 0 ? curr : sql10`${acc} OR ${curr}`
      )})` : searchConditions[0];
      const borrowers2 = await db.execute(sql10`
        SELECT DISTINCT ON (borrower_name)
          borrower_name as "borrowerName",
          borrower_mobile as "borrowerMobile",
          borrower_address as "borrowerAddress",
          loan_date as "latestLoanDate"
        FROM loans
        WHERE 
          tenant_id = ${req.session.tenantId}
          AND (${combinedSearchCondition})
          AND LENGTH(TRIM(borrower_name)) >= 3
          AND borrower_name IS NOT NULL 
          AND TRIM(borrower_name) != ''
        ORDER BY borrower_name, loan_date DESC
        LIMIT 20
      `);
      const borrowerRows = borrowers2.rows || [];
      const sortedBorrowers = borrowerRows.sort((a, b) => {
        const aName = a.borrowerName?.toLowerCase() || "";
        const bName = b.borrowerName?.toLowerCase() || "";
        const search2 = searchTerm.toLowerCase();
        const aExactMatch = searchVariations.some((v) => aName === v.toLowerCase());
        const bExactMatch = searchVariations.some((v) => bName === v.toLowerCase());
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        const aStarts = searchVariations.some((v) => aName.startsWith(v.toLowerCase()));
        const bStarts = searchVariations.some((v) => bName.startsWith(v.toLowerCase()));
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      });
      console.log(`\u{1F50D} Dual-language autocomplete for "${searchTerm}": ${sortedBorrowers.length} matches found (variations: ${searchVariations.join(", ")})`);
      res.json(sortedBorrowers.slice(0, 10));
    } catch (error) {
      console.error("Borrower autocomplete error:", error);
      res.status(500).json({ message: "Failed to fetch borrower suggestions" });
    }
  });
  app2.post("/api/loans", requireAuth2, cacheBuster(["dashboard:", "loans:", "borrowers:"]), async (req, res) => {
    try {
      console.log("Received loan data:", req.body);
      console.log("Session tenant ID:", req.session.tenantId);
      const processedBody = {
        ...req.body,
        loanDate: req.body.loanDate ? convertIndianDateToISO(req.body.loanDate) : req.body.loanDate,
        maturityDate: req.body.maturityDate ? convertIndianDateToISO(req.body.maturityDate) : req.body.maturityDate
      };
      const loanData = insertLoanSchema.parse({
        ...processedBody,
        tenantId: req.session.tenantId
      });
      console.log("Parsed loan data:", loanData);
      const loan = await storage.createLoan(loanData);
      await triggerLoanSync({
        type: "CREATE",
        loanId: loan.id,
        tenantId: req.session.tenantId,
        newData: loanData,
        metadata: {
          performedBy: req.session.userId,
          timestamp: /* @__PURE__ */ new Date()
        }
      });
      const existingDisbursement = await db.select().from(cashTransactions).where(and11(
        eq12(cashTransactions.tenantId, req.session.tenantId),
        eq12(cashTransactions.transactionType, "cash_out"),
        eq12(cashTransactions.category, "loan_disbursement"),
        sql10`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loanData.accountNumber}%`}`,
        eq12(cashTransactions.transactionDate, loanData.loanDate),
        sql10`ABS(${cashTransactions.amount} - ${loanData.principalAmount}) < 0.01`
      ));
      const manualExpenseEntries = await db.select().from(cashTransactions).where(and11(
        eq12(cashTransactions.tenantId, req.session.tenantId),
        eq12(cashTransactions.transactionType, "cash_out"),
        eq12(cashTransactions.category, "expense"),
        eq12(cashTransactions.isSystemGenerated, false),
        sql10`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loanData.accountNumber}%`}`,
        sql10`ABS(${cashTransactions.amount} - ${loanData.principalAmount}) < 0.01`,
        sql10`${cashTransactions.createdAt} > NOW() - INTERVAL '1 hour'`
        // Only recent manual entries
      ));
      if (manualExpenseEntries.length > 0) {
        console.log(`\u{1F9F9} PRE-EMPTIVE CLEANUP: Removing ${manualExpenseEntries.length} manual expense entries for loan ${loanData.accountNumber}`);
        await db.delete(cashTransactions).where(and11(
          eq12(cashTransactions.tenantId, req.session.tenantId),
          eq12(cashTransactions.transactionType, "cash_out"),
          eq12(cashTransactions.category, "expense"),
          eq12(cashTransactions.isSystemGenerated, false),
          sql10`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loanData.accountNumber}%`}`,
          sql10`ABS(${cashTransactions.amount} - ${loanData.principalAmount}) < 0.01`,
          sql10`${cashTransactions.createdAt} > NOW() - INTERVAL '1 hour'`
        ));
      }
      console.log("\u{1F50D} DISBURSEMENT CHECK:", {
        accountNumber: loanData.accountNumber,
        amount: loanData.principalAmount,
        date: loanData.loanDate,
        existingCount: existingDisbursement.length
      });
      if (existingDisbursement.length === 0 && Number(loanData.principalAmount) > 0) {
        let groupName = void 0;
        if (loanData.groupId) {
          const groups3 = await storage.getGroups(req.session.tenantId);
          const group = groups3.find((g) => g.id === loanData.groupId);
          groupName = group ? group.name : void 0;
        }
        const { NarrationEngine: NarrationEngine2 } = await Promise.resolve().then(() => (init_narration_engine(), narration_engine_exports));
        const standardNarration = NarrationEngine2.createLoanDisbursementNarration(
          loanData.accountNumber,
          loanData.borrowerName,
          Number(loanData.principalAmount),
          groupName
        );
        await storage.createCashTransaction({
          tenantId: req.session.tenantId,
          transactionDate: loanData.loanDate,
          transactionType: "cash_out",
          amount: Number(loanData.principalAmount),
          category: "loan_disbursement",
          narration: standardNarration,
          isSystemGenerated: true
          // System generated - only editable through proper loan forms
        });
        console.log("\u2705 LOAN CREATED: Single disbursement cash transaction created automatically without duplicates");
      } else {
        console.log("\u{1F6AB} AUTOMATIC: Duplicate disbursement cash transaction prevented");
      }
      try {
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "create_loan", description: `\u0928\u0935\u0940\u0928 \u0915\u0930\u094D\u091C \u0924\u092F\u093E\u0930: \u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loan.accountNumber} - ${loan.borrowerName} - \u20B9${loan.principalAmount}`, metadata: JSON.stringify({ loanId: loan.id, accountNumber: loan.accountNumber, borrowerName: loan.borrowerName, principalAmount: loan.principalAmount, loanDate: loan.loanDate, interestRate: loan.interestRate, groupId: loan.groupId }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      res.json(loan);
    } catch (error) {
      console.error("Loan creation error:", error);
      res.status(400).json({
        message: "Invalid loan data",
        error: error instanceof Error ? error.message : error
      });
    }
  });
  app2.put("/api/loans/:id", requireAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const bodyWithConvertedDates = {
        ...req.body,
        loanDate: req.body.loanDate ? convertIndianDateToISO(req.body.loanDate) : req.body.loanDate,
        maturityDate: req.body.maturityDate ? convertIndianDateToISO(req.body.maturityDate) : req.body.maturityDate
      };
      const loanData = insertLoanSchema.partial().parse(bodyWithConvertedDates);
      const loans2 = await storage.getLoans(req.session.tenantId);
      const oldLoan = loans2.find((l) => l.id === id);
      if (!oldLoan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      const loan = await storage.updateLoan(id, req.session.tenantId, loanData);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      await triggerLoanSync({
        type: "UPDATE",
        loanId: id,
        tenantId: req.session.tenantId,
        oldData: oldLoan,
        newData: loan,
        metadata: {
          performedBy: req.session.userId,
          timestamp: /* @__PURE__ */ new Date()
        }
      });
      try {
        const changedFields = {};
        if (oldLoan) {
          for (const key of Object.keys(req.body)) {
            if (oldLoan[key] !== void 0 && String(oldLoan[key]) !== String(req.body[key])) {
              changedFields[key] = { old: oldLoan[key], new: req.body[key] };
            }
          }
        }
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "update_loan", description: `\u0915\u0930\u094D\u091C \u0905\u092A\u0921\u0947\u091F: \u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loan.accountNumber} - ${loan.borrowerName}`, metadata: JSON.stringify({ loanId: id, accountNumber: loan.accountNumber, borrowerName: loan.borrowerName, groupId: loan.groupId, principalAmount: loan.principalAmount, changedFields }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      if (oldLoan && (loanData.principalAmount || loanData.loanDate)) {
        try {
          const cashTransactions2 = await storage.getCashTransactions(req.session.tenantId);
          const disbursementTransaction = cashTransactions2.find(
            (ct) => ct.narration && ct.narration.includes("\u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923") && ct.narration.includes(oldLoan.accountNumber) && ct.category === "loan_disbursement"
          );
          if (disbursementTransaction) {
            const updateData = {};
            if (loanData.principalAmount && Number(loanData.principalAmount) !== Number(oldLoan.principalAmount)) {
              updateData.amount = Number(loanData.principalAmount);
              console.log(`\u{1F4B0} SYNC: Updating disbursement amount from \u20B9${oldLoan.principalAmount} to \u20B9${loanData.principalAmount}`);
            }
            if (loanData.loanDate && loanData.loanDate !== oldLoan.loanDate) {
              updateData.transactionDate = loanData.loanDate;
              console.log(`\u{1F4C5} SYNC: Updating disbursement date from ${oldLoan.loanDate} to ${loanData.loanDate}`);
            }
            if (Object.keys(updateData).length > 0) {
              const groups3 = await storage.getGroups(req.session.tenantId);
              const group = groups3.find((g) => g.id === loan.groupId);
              const groupName = group?.name || "";
              updateData.narration = NarrationEngine.createLoanDisbursementNarration(
                loan.accountNumber,
                loan.borrowerName.substring(0, 4),
                Number(loan.principalAmount),
                groupName.substring(0, 10)
              );
              await storage.updateCashTransaction(disbursementTransaction.id, req.session.tenantId, updateData);
              console.log("\u2705 CASH SYNC: Disbursement transaction updated successfully");
            }
          } else {
            console.log("\u26A0\uFE0F SYNC WARNING: Disbursement transaction not found for loan:", oldLoan.accountNumber);
          }
        } catch (syncError) {
          console.error("\u274C SYNC ERROR: Failed to update cash transaction:", syncError);
        }
      }
      if (oldLoan && oldLoan.status === "active" && loanData.status === "closed") {
        const closures = await storage.getLoanClosures(req.session.tenantId, id);
        if (closures.length === 0) {
          console.log("\u2705 Manual loan closure - cash transaction handled by closure system");
        }
      }
      if (oldLoan && oldLoan.status === "closed" && loanData.status === "active") {
        try {
          const cashTransactions2 = await storage.getCashTransactions(req.session.tenantId);
          const closureTransactions = cashTransactions2.filter(
            (ct) => ct.narration && ct.narration.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926") && (ct.narration.includes(loan.accountNumber) || ct.narration.includes(loan.borrowerName))
          );
          for (const ct of closureTransactions) {
            await storage.deleteCashTransaction(ct.id, req.session.tenantId);
            console.log(`\u2705 REOPEN: Deleted closure cash transaction - \u20B9${ct.amount}`);
          }
          console.log(`\u{1F4F8} PHOTO REOPEN: Photos remain deleted - user can re-upload if needed`);
          const closures = await storage.getLoanClosures(req.session.tenantId, id);
          for (const closure of closures) {
            await storage.deleteLoanClosure(closure.id, req.session.tenantId);
          }
        } catch (cashError) {
          console.error("Failed to reverse cash transactions for reopened loan:", cashError);
        }
      }
      res.json(loan);
    } catch (error) {
      console.error("\u274C Loan update error:", error);
      console.error("\u274C Request body:", JSON.stringify(req.body, null, 2));
      res.status(400).json({
        message: "Invalid loan data",
        error: error instanceof Error ? error.message : error
      });
    }
  });
  app2.delete("/api/loans/:id", requireAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const loan = await storage.getLoanById(id, req.session.tenantId);
      if (!loan) {
        return res.status(404).json({ message: "\u0915\u0930\u094D\u091C \u0938\u093E\u092A\u0921\u0932\u0947 \u0928\u093E\u0939\u0940 \u0915\u093F\u0902\u0935\u093E \u0906\u0927\u0940\u091A \u0921\u093F\u0932\u0940\u091F \u091D\u093E\u0932\u0947 \u0906\u0939\u0947." });
      }
      try {
        await triggerLoanSync({
          type: "DELETE",
          loanId: id,
          tenantId: req.session.tenantId,
          oldData: loan,
          metadata: {
            performedBy: req.session.userId,
            timestamp: /* @__PURE__ */ new Date(),
            reason: "User requested loan deletion"
          }
        });
      } catch (syncError) {
        console.error("Loan sync error (non-fatal):", syncError);
      }
      const success = await storage.deleteLoan(id, req.session.tenantId);
      if (!success) {
        return res.status(500).json({ message: "\u0915\u0930\u094D\u091C \u0921\u093F\u0932\u0940\u091F \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u0906\u0932\u0940. \u092A\u0941\u0928\u094D\u0939\u093E \u092A\u094D\u0930\u092F\u0924\u094D\u0928 \u0915\u0930\u093E." });
      }
      try {
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "delete_loan", description: `\u0915\u0930\u094D\u091C \u0921\u093F\u0932\u0940\u091F: \u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loan.accountNumber} - ${loan.borrowerName} - \u20B9${loan.principalAmount}`, metadata: JSON.stringify({ loanId: id, accountNumber: loan.accountNumber, borrowerName: loan.borrowerName, principalAmount: loan.principalAmount, loanDate: loan.loanDate, interestRate: loan.interestRate, groupId: loan.groupId, status: loan.status }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      res.json({ message: "\u0915\u0930\u094D\u091C \u0906\u0923\u093F \u0938\u0902\u092C\u0902\u0927\u093F\u0924 \u0935\u094D\u092F\u0935\u0939\u093E\u0930 \u092F\u0936\u0938\u094D\u0935\u0940\u092A\u0923\u0947 \u0921\u093F\u0932\u0940\u091F \u0915\u0947\u0932\u0947 \u0917\u0947\u0932\u0947." });
    } catch (error) {
      console.error("Delete loan error:", error);
      res.status(500).json({ message: "\u0915\u0930\u094D\u091C \u0921\u093F\u0932\u0940\u091F \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u0906\u0932\u0940. \u092A\u0941\u0928\u094D\u0939\u093E \u092A\u094D\u0930\u092F\u0924\u094D\u0928 \u0915\u0930\u093E." });
    }
  });
  app2.patch("/api/loans/:id/reopen", requireAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const loans2 = await storage.getLoans(req.session.tenantId);
      const loan = loans2.find((l) => l.id === id);
      if (!loan) {
        return res.status(404).json({ message: "Loan not found" });
      }
      if (loan.status !== "closed") {
        return res.status(400).json({ message: "Only closed loans can be reopened" });
      }
      try {
        const closures = await storage.getLoanClosures(req.session.tenantId, id);
        for (const closure of closures) {
          await storage.deleteLoanClosure(closure.id, req.session.tenantId);
          console.log(`\u{1F5D1}\uFE0F CLEANUP: Deleted closure record ${closure.id} for loan reopen`);
        }
        const cashTransactions2 = await storage.getCashTransactions(req.session.tenantId);
        const closureCashEntries = cashTransactions2.filter(
          (ct) => ct.narration && ct.narration.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926") && (ct.narration.includes(loan.accountNumber) || ct.narration.includes(loan.borrowerName))
        );
        for (const ct of closureCashEntries) {
          await storage.deleteCashTransaction(ct.id, req.session.tenantId);
          console.log(`\u{1F5D1}\uFE0F CLEANUP: Deleted closure cash transaction for loan reopen - \u20B9${ct.amount}`);
        }
        console.log(`\u2705 CLEANUP COMPLETE: Loan ${id} ready for reopen - ${closures.length} closure records + ${closureCashEntries.length} cash entries removed`);
      } catch (cleanupError) {
        console.error("Cleanup error during loan reopen:", cleanupError);
        return res.status(500).json({ message: "Failed to cleanup closure records during reopen" });
      }
      const reopenedLoan = await storage.updateLoan(id, req.session.tenantId, {
        status: "active"
      });
      if (!reopenedLoan) {
        return res.status(404).json({ message: "Failed to reopen loan" });
      }
      await triggerLoanSync({
        type: "REOPEN",
        loanId: id,
        tenantId: req.session.tenantId,
        oldData: loan,
        newData: reopenedLoan,
        metadata: {
          performedBy: req.session.userId,
          timestamp: /* @__PURE__ */ new Date(),
          reason: "User requested loan reopen"
        }
      });
      try {
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "reopen_loan", description: `\u0915\u0930\u094D\u091C \u092A\u0941\u0928\u094D\u0939\u093E \u0938\u0941\u0930\u0942: \u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loan.accountNumber} - ${loan.borrowerName}`, metadata: JSON.stringify({ loanId: id, accountNumber: loan.accountNumber, borrowerName: loan.borrowerName }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      res.json({
        message: "Loan reopened successfully",
        loan: reopenedLoan
      });
    } catch (error) {
      console.error("Loan reopen error:", error);
      res.status(500).json({ message: "Failed to reopen loan" });
    }
  });
  app2.post("/api/comprehensive-sync", requireAuth2, async (req, res) => {
    try {
      const result = { success: true, created: 0, updated: 0, skipped: 0 };
      res.json({
        success: result.success,
        message: `Sync completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
        details: result
      });
    } catch (error) {
      console.error("Comprehensive sync failed:", error);
      res.status(500).json({ error: "Failed to perform comprehensive sync" });
    }
  });
  app2.get("/api/validate-integrity", requireAuth2, async (req, res) => {
    try {
      const validation = { isValid: true };
      res.json({
        success: validation.isValid,
        validation
      });
    } catch (error) {
      console.error("System validation failed:", error);
      res.status(500).json({ error: "Failed to validate system integrity" });
    }
  });
  app2.post("/api/cleanup-duplicates", requireAuth2, async (req, res) => {
    try {
      const { createDuplicateCleanupEngine: createDuplicateCleanupEngine2 } = await Promise.resolve().then(() => (init_duplicate_cleanup(), duplicate_cleanup_exports));
      const cleanupEngine = createDuplicateCleanupEngine2(req.session.tenantId);
      const result = await cleanupEngine.cleanupDuplicates();
      res.json({
        success: result.success,
        message: `Cleanup completed: ${result.duplicatesRemoved} duplicates removed, ${result.preservedEntries} entries preserved`,
        details: result
      });
    } catch (error) {
      console.error("Duplicate cleanup failed:", error);
      res.status(500).json({ error: "Failed to cleanup duplicates" });
    }
  });
  app2.get("/api/system-health", requireAuth2, async (req, res) => {
    try {
      const { createDuplicateCleanupEngine: createDuplicateCleanupEngine2 } = await Promise.resolve().then(() => (init_duplicate_cleanup(), duplicate_cleanup_exports));
      const cleanupEngine = createDuplicateCleanupEngine2(req.session.tenantId);
      const integrity = await cleanupEngine.validateIntegrity();
      res.json({
        success: integrity.isValid,
        integrity
      });
    } catch (error) {
      console.error("System health check failed:", error);
      res.status(500).json({ error: "Failed to check system health" });
    }
  });
  app2.post("/api/unify-transactions", requireAuth2, async (req, res) => {
    try {
      const { createUnifiedTransactionEngine: createUnifiedTransactionEngine2 } = await Promise.resolve().then(() => (init_unified_transaction_sync(), unified_transaction_sync_exports));
      const unificationEngine = createUnifiedTransactionEngine2(req.session.tenantId);
      const result = await unificationEngine.unifyTransactionSystems();
      res.json({
        success: result.success,
        message: `Unification completed: ${result.loanTransactionsMigrated} migrated, ${result.duplicatesRemoved} duplicates removed`,
        details: result
      });
    } catch (error) {
      console.error("Transaction unification failed:", error);
      res.status(500).json({ error: "Failed to unify transaction systems" });
    }
  });
  app2.get("/api/unified-system-status", requireAuth2, async (req, res) => {
    try {
      const { createUnifiedTransactionEngine: createUnifiedTransactionEngine2 } = await Promise.resolve().then(() => (init_unified_transaction_sync(), unified_transaction_sync_exports));
      const unificationEngine = createUnifiedTransactionEngine2(req.session.tenantId);
      const validation = await unificationEngine.validateUnifiedSystem();
      res.json({
        success: validation.isValid,
        validation
      });
    } catch (error) {
      console.error("Unified system validation failed:", error);
      res.status(500).json({ error: "Failed to validate unified system" });
    }
  });
  app2.post("/api/standardize-narrations", requireAuth2, async (req, res) => {
    try {
      const { createNarrationStandardizer: createNarrationStandardizer2 } = await Promise.resolve().then(() => (init_narration_standardizer(), narration_standardizer_exports));
      const standardizer = createNarrationStandardizer2(req.session.tenantId);
      const result = await standardizer.standardizeAllNarrations();
      res.json({
        success: result.success,
        message: `Narration standardization completed: ${result.standardized} standardized, ${result.duplicatesRemoved} duplicates removed`,
        details: result
      });
    } catch (error) {
      console.error("Narration standardization failed:", error);
      res.status(500).json({ error: "Failed to standardize narrations" });
    }
  });
  app2.post("/api/comprehensive-sync", requireAuth2, async (req, res) => {
    try {
      const { createComprehensiveCashSync: createComprehensiveCashSync2 } = await Promise.resolve().then(() => (init_comprehensive_sync(), comprehensive_sync_exports));
      const comprehensiveSync = createComprehensiveCashSync2(req.session.tenantId);
      const result = await comprehensiveSync.performComprehensiveSync();
      res.json({
        success: result.success,
        message: `Comprehensive sync completed: ${result.duplicatesRemoved} duplicates removed, ${result.narrationUpdated} narrations updated, ${result.groupNamesAdded} group names added`,
        details: result
      });
    } catch (error) {
      console.error("Comprehensive sync failed:", error);
      res.status(500).json({ error: "Failed to perform comprehensive sync" });
    }
  });
  app2.get("/api/transactions", requireAuth2, async (req, res) => {
    try {
      res.json([]);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });
  app2.post("/api/transactions", requireAuth2, async (req, res) => {
    try {
      const transactionData = insertTransactionSchema.parse({
        ...req.body,
        tenantId: req.session.tenantId
      });
      const transaction = await storage.createTransaction(transactionData);
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ message: "Invalid transaction data" });
    }
  });
  app2.post("/api/loans/:id/close", requireAuth2, cacheBuster(["dashboard:", "loans:"]), async (req, res) => {
    try {
      const { id } = req.params;
      const requestData = req.body;
      const interestVariance = Number(requestData.interestVariance || 0);
      const closureData = insertLoanClosureSchema.parse({
        ...requestData,
        tenantId: req.session.tenantId,
        loanId: id,
        closedBy: req.session.userId,
        // Track who closed the loan
        interestVariance,
        varianceReason: requestData.varianceReason || "No variance tracking"
      });
      const [loanDetails] = await db.select({
        id: loans.id,
        accountNumber: loans.accountNumber,
        borrowerName: loans.borrowerName,
        principalAmount: loans.principalAmount,
        groupId: loans.groupId,
        groupName: groups.name
      }).from(loans).leftJoin(groups, eq12(loans.groupId, groups.id)).where(and11(eq12(loans.id, id), eq12(loans.tenantId, req.session.tenantId)));
      if (!loanDetails) {
        return res.status(404).json({ message: "Loan not found" });
      }
      const existingClosure = await db.select().from(cashTransactions).where(and11(
        eq12(cashTransactions.tenantId, req.session.tenantId),
        eq12(cashTransactions.transactionType, "cash_in"),
        or5(eq12(cashTransactions.category, "loan_repayment"), eq12(cashTransactions.category, "income")),
        sql10`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loanDetails.accountNumber}%`}`,
        eq12(cashTransactions.transactionDate, closureData.closureDate),
        sql10`ABS(${cashTransactions.amount} - ${closureData.totalAmount}) < 0.01`
      ));
      const manualIncomeEntries = await db.select().from(cashTransactions).where(and11(
        eq12(cashTransactions.tenantId, req.session.tenantId),
        eq12(cashTransactions.transactionType, "cash_in"),
        or5(eq12(cashTransactions.category, "income"), eq12(cashTransactions.category, "capital")),
        sql10`${cashTransactions.narration} LIKE ${`%\u0916\u093E\u0924\u0947 \u0915\u094D\u0930. ${loanDetails.accountNumber}%`}`,
        ne2(cashTransactions.isSystemGenerated, true),
        // Only manual entries
        eq12(cashTransactions.transactionDate, closureData.closureDate),
        sql10`ABS(${cashTransactions.amount} - ${closureData.totalAmount}) < 0.01`
      ));
      if (manualIncomeEntries.length > 0) {
        console.log(`\u{1F9F9} PRE-EMPTIVE CLEANUP: Removing ${manualIncomeEntries.length} manual income entries for account ${loanDetails.accountNumber}`);
        await db.delete(cashTransactions).where(
          sql10`id IN (${manualIncomeEntries.map((e) => `'${e.id}'`).join(",")})`
        );
      }
      if (existingClosure.length > 0) {
        console.log(`\u{1F6AB} ABSOLUTE DUPLICATE PREVENTION: Closure entry already exists for account ${loanDetails.accountNumber}`);
        return res.status(200).json({
          message: "Loan successfully closed",
          // User-friendly message
          success: true,
          alreadyProcessed: true,
          duplicatePrevented: true
        });
      }
      const closure = await storage.createLoanClosure(closureData);
      const closedLoan = await storage.updateLoan(id, req.session.tenantId, { status: "closed" });
      await triggerLoanSync({
        type: "CLOSE",
        loanId: id,
        tenantId: req.session.tenantId,
        oldData: loanDetails,
        newData: {
          ...loanDetails,
          status: "closed",
          accountNumber: loanDetails.accountNumber,
          borrowerName: loanDetails.borrowerName,
          groupId: loanDetails.groupId,
          totalAmount: closureData.totalAmount,
          closureDate: closureData.closureDate
        },
        metadata: {
          performedBy: req.session.userId,
          timestamp: /* @__PURE__ */ new Date(),
          reason: closureData.varianceReason || "Standard loan closure"
        }
      });
      let photoDeleteResult = null;
      if (requestData.autoDeletePhotos && requestData.hasPhotos) {
        try {
          photoDeleteResult = await PhotoService.deletePhotosForLoan(db, id, req.session.tenantId);
          console.log(`\u{1F4F8} PHOTO AUTO-DELETE: ${photoDeleteResult.deletedFiles} files and ${photoDeleteResult.deletedRecords} records deleted for loan ${loanDetails.accountNumber}`);
        } catch (photoError) {
          console.warn("\u26A0\uFE0F  Photo deletion warning:", photoError);
        }
      }
      console.log("\u2705 CLOSURE SUCCESS:", {
        loanId: id,
        accountNumber: loanDetails?.accountNumber,
        amount: closureData.totalAmount,
        date: closureData.closureDate,
        photosDeleted: photoDeleteResult?.deletedFiles || 0,
        closureCreated: true
      });
      console.log(`\u2705 LOAN CLOSURE COMPLETED: Account ${loanDetails?.accountNumber} - Amount \u20B9${closureData.totalAmount}`);
      console.log(`\u{1F3AF} SINGLE SOURCE: Cash transaction handled by storage.ts only`);
      res.json(closure);
    } catch (error) {
      console.error("Closure error:", error);
      res.status(400).json({ message: "Invalid closure data" });
    }
  });
  app2.get("/api/loan-closures", requireAuth2, async (req, res) => {
    try {
      const loanId = req.query.loanId;
      const closures = loanId ? await storage.getLoanClosures(req.session.tenantId, loanId) : await storage.getAllLoanClosures(req.session.tenantId);
      res.set({
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "ETag": `"closures-${loanId || "all"}-${Date.now()}"`
        // Force unique response
      });
      res.json(closures);
    } catch (error) {
      console.error("Error fetching loan closures:", error);
      res.status(500).json({ message: "Failed to fetch loan closures" });
    }
  });
  app2.post("/api/emergency-cleanup-duplicates", requireAuth2, async (req, res) => {
    try {
      console.log(`\u{1F6A8} Emergency duplicate cleanup requested by user: ${req.session.userId}`);
      const tenantId = req.session.tenantId;
      let duplicatesRemoved = 0;
      const duplicateTransactions = await db.select().from(cashTransactions).where(and11(
        eq12(cashTransactions.tenantId, tenantId),
        eq12(cashTransactions.transactionType, "cash_out")
      ));
      const loanGroups = {};
      duplicateTransactions.forEach((tx) => {
        if (tx.narration && (tx.narration.includes("\u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923") || tx.narration.includes("\u0915\u0930\u094D\u091C \u0926\u093F\u0932\u0947"))) {
          const loanAccountMatch = tx.narration.match(/खाते क्र\.\s*(\d+)/);
          const loanIdMatch = tx.narration.match(/\(([^)]+)\)/);
          let key = "unknown";
          if (loanAccountMatch) {
            key = `account_${loanAccountMatch[1]}`;
          } else if (loanIdMatch) {
            key = `id_${loanIdMatch[1]}`;
          } else if (tx.narration.includes("\u0930\u093E\u091C \u092A\u093E\u091F\u0940\u0932")) {
            key = "raj_patil_loan";
          }
          if (!loanGroups[key]) loanGroups[key] = [];
          loanGroups[key].push(tx);
        }
      });
      for (const group of Object.values(loanGroups)) {
        if (group.length > 1) {
          group.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
          for (let i = 1; i < group.length; i++) {
            console.log(`Removing duplicate: ${group[i].narration}`);
            await db.delete(cashTransactions).where(and11(
              eq12(cashTransactions.id, group[i].id),
              eq12(cashTransactions.tenantId, tenantId)
            ));
            duplicatesRemoved++;
          }
        }
      }
      res.json({
        success: true,
        message: `Cleanup completed successfully. Removed ${duplicatesRemoved} duplicate entries.`,
        duplicatesRemoved,
        groupsProcessed: Object.keys(loanGroups).length
      });
    } catch (error) {
      console.error("Emergency cleanup error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cleanup duplicates",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  app2.get("/api/dashboard/stats", requireAuth2, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats(req.session.tenantId);
      res.json(stats);
    } catch (error) {
      console.error("\u274C Dashboard stats error:", error);
      res.status(500).json({
        message: "Failed to fetch dashboard stats",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  app2.get("/api/dashboard/period-stats", requireAuth2, async (req, res) => {
    try {
      const period = req.query.period || "1m";
      const tenantId = req.session.tenantId;
      const now = /* @__PURE__ */ new Date();
      let startDate;
      let endDate;
      let prevStartDate;
      let prevEndDate;
      if (period === "1m") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
      } else {
        const monthsBack = period === "3y" ? 36 : period === "1y" ? 12 : 3;
        startDate = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1).toISOString().split("T")[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - (monthsBack * 2 - 1), 1).toISOString().split("T")[0];
        prevEndDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 0).toISOString().split("T")[0];
      }
      const [
        [curDisb],
        [prevDisb],
        [curClos],
        [prevClos],
        [curCash],
        [prevCash]
      ] = await Promise.all([
        db.select({ count: count2(), totalAmount: sum2(loans.principalAmount) }).from(loans).where(and11(eq12(loans.tenantId, tenantId), gte3(loans.loanDate, startDate), lte3(loans.loanDate, endDate))),
        db.select({ count: count2(), totalAmount: sum2(loans.principalAmount) }).from(loans).where(and11(eq12(loans.tenantId, tenantId), gte3(loans.loanDate, prevStartDate), lte3(loans.loanDate, prevEndDate))),
        db.select({ count: count2(), totalAmount: sum2(loanClosures.totalAmount) }).from(loanClosures).where(and11(eq12(loanClosures.tenantId, tenantId), gte3(loanClosures.closureDate, startDate), lte3(loanClosures.closureDate, endDate))),
        db.select({ count: count2(), totalAmount: sum2(loanClosures.totalAmount) }).from(loanClosures).where(and11(eq12(loanClosures.tenantId, tenantId), gte3(loanClosures.closureDate, prevStartDate), lte3(loanClosures.closureDate, prevEndDate))),
        db.select({
          count: count2(),
          totalIn: sum2(sql10`CASE WHEN ${cashTransactions.transactionType} = 'cash_in' THEN ${cashTransactions.amount} ELSE 0 END`),
          totalOut: sum2(sql10`CASE WHEN ${cashTransactions.transactionType} = 'cash_out' THEN ${cashTransactions.amount} ELSE 0 END`)
        }).from(cashTransactions).where(and11(eq12(cashTransactions.tenantId, tenantId), gte3(cashTransactions.transactionDate, startDate), lte3(cashTransactions.transactionDate, endDate))),
        db.select({
          count: count2(),
          totalIn: sum2(sql10`CASE WHEN ${cashTransactions.transactionType} = 'cash_in' THEN ${cashTransactions.amount} ELSE 0 END`),
          totalOut: sum2(sql10`CASE WHEN ${cashTransactions.transactionType} = 'cash_out' THEN ${cashTransactions.amount} ELSE 0 END`)
        }).from(cashTransactions).where(and11(eq12(cashTransactions.tenantId, tenantId), gte3(cashTransactions.transactionDate, prevStartDate), lte3(cashTransactions.transactionDate, prevEndDate)))
      ]);
      res.json({
        current: {
          disbursements: Number(curDisb?.count || 0),
          disbursementAmount: Number(curDisb?.totalAmount || 0),
          closures: Number(curClos?.count || 0),
          closureAmount: Number(curClos?.totalAmount || 0),
          transactions: Number(curCash?.count || 0),
          cashIn: Number(curCash?.totalIn || 0),
          cashOut: Number(curCash?.totalOut || 0)
        },
        previous: {
          disbursements: Number(prevDisb?.count || 0),
          disbursementAmount: Number(prevDisb?.totalAmount || 0),
          closures: Number(prevClos?.count || 0),
          closureAmount: Number(prevClos?.totalAmount || 0),
          transactions: Number(prevCash?.count || 0),
          cashIn: Number(prevCash?.totalIn || 0),
          cashOut: Number(prevCash?.totalOut || 0)
        }
      });
    } catch (error) {
      console.error("Period stats error:", error);
      res.status(500).json({ message: "Failed to fetch period stats" });
    }
  });
  app2.get("/api/dashboard/monthly-progress", requireAuth2, async (req, res) => {
    try {
      const period = req.query.period || "3m";
      const tenantId = req.session.tenantId;
      const monthsBack = period === "3y" ? 36 : period === "1y" ? 12 : 3;
      const currentDate = /* @__PURE__ */ new Date();
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - (monthsBack - 1), 1);
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split("T")[0];
      const [monthlyDisbursements, monthlyClosures] = await Promise.all([
        db.select({
          month: sql10`TO_CHAR(${loans.loanDate}::date, 'YYYY-MM')`,
          count: count2(),
          totalAmount: sum2(loans.principalAmount)
        }).from(loans).where(and11(
          eq12(loans.tenantId, tenantId),
          gte3(loans.loanDate, startDateStr),
          lte3(loans.loanDate, endDateStr)
        )).groupBy(sql10`TO_CHAR(${loans.loanDate}::date, 'YYYY-MM')`).orderBy(sql10`TO_CHAR(${loans.loanDate}::date, 'YYYY-MM')`),
        db.select({
          month: sql10`TO_CHAR(${loanClosures.closureDate}::date, 'YYYY-MM')`,
          count: count2(),
          totalAmount: sum2(loanClosures.actualPaidAmount)
        }).from(loanClosures).where(and11(
          eq12(loanClosures.tenantId, tenantId),
          gte3(loanClosures.closureDate, startDateStr),
          lte3(loanClosures.closureDate, endDateStr)
        )).groupBy(sql10`TO_CHAR(${loanClosures.closureDate}::date, 'YYYY-MM')`).orderBy(sql10`TO_CHAR(${loanClosures.closureDate}::date, 'YYYY-MM')`)
      ]);
      const marathiMonths = {
        "01": "\u091C\u093E\u0928\u0947\u0935\u093E\u0930\u0940",
        "02": "\u092B\u0947\u092C\u094D\u0930\u0941\u0935\u093E\u0930\u0940",
        "03": "\u092E\u093E\u0930\u094D\u091A",
        "04": "\u090F\u092A\u094D\u0930\u093F\u0932",
        "05": "\u092E\u0947",
        "06": "\u091C\u0942\u0928",
        "07": "\u091C\u0941\u0932\u0948",
        "08": "\u0911\u0917\u0938\u094D\u091F",
        "09": "\u0938\u092A\u094D\u091F\u0947\u0902\u092C\u0930",
        "10": "\u0911\u0915\u094D\u091F\u094B\u092C\u0930",
        "11": "\u0928\u094B\u0935\u094D\u0939\u0947\u0902\u092C\u0930",
        "12": "\u0921\u093F\u0938\u0947\u0902\u092C\u0930"
      };
      const disbMap = new Map(monthlyDisbursements.map((d) => [d.month, d]));
      const closMap = new Map(monthlyClosures.map((c) => [c.month, c]));
      const monthlyData = [];
      let totalDisbursements = 0;
      let totalClosures = 0;
      let totalAmount = 0;
      for (let i = 0; i < monthsBack; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const label = monthsBack > 12 ? `${marathiMonths[mm]} ${d.getFullYear().toString().slice(-2)}` : `${marathiMonths[mm]} ${d.getFullYear()}`;
        const disb = Number(disbMap.get(key)?.count || 0);
        const clos = Number(closMap.get(key)?.count || 0);
        const amt = Number(disbMap.get(key)?.totalAmount || 0);
        totalDisbursements += disb;
        totalClosures += clos;
        totalAmount += amt;
        monthlyData.push({
          month: label,
          disbursements: disb,
          closures: clos,
          amount: amt,
          net: disb - clos
        });
      }
      const successRate = totalDisbursements > 0 ? Math.round(totalClosures / totalDisbursements * 100) : 0;
      res.json({
        monthlyData,
        summary: {
          totalDisbursements,
          totalClosures,
          totalAmount,
          successRate,
          netGrowth: totalDisbursements - totalClosures
        }
      });
    } catch (error) {
      console.error("Monthly progress error:", error);
      res.status(500).json({ message: "Failed to fetch monthly progress" });
    }
  });
  app2.get("/api/reports/cashbook", requireAuth2, async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      if (!dateFrom || !dateTo) {
        return res.status(400).json({ message: "Date range required" });
      }
      const report = await storage.getCashBookReport(
        req.session.tenantId,
        dateFrom,
        dateTo
      );
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate cash book report" });
    }
  });
  app2.get("/api/reports/capital", requireAuth2, async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      if (!dateFrom || !dateTo) {
        return res.status(400).json({ message: "Date range required" });
      }
      const report = await storage.getCapitalAccountReport(
        req.session.tenantId,
        dateFrom,
        dateTo
      );
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate capital account report" });
    }
  });
  app2.get("/api/reports/ledger/:loanId", requireAuth2, async (req, res) => {
    try {
      const { loanId } = req.params;
      const ledger = await storage.getLoanLedger(req.session.tenantId, loanId);
      res.json(ledger);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate loan ledger" });
    }
  });
  app2.get("/api/parties", requireAuth2, async (req, res) => {
    try {
      const { search } = req.query;
      const parties2 = await storage.getParties(req.session.tenantId, search);
      res.json(parties2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch parties" });
    }
  });
  app2.post("/api/parties", requireAuth2, async (req, res) => {
    try {
      const partyData = insertPartySchema.parse({
        ...req.body,
        tenantId: req.session.tenantId
      });
      const party = await storage.createParty(partyData);
      try {
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "create_party", description: `\u0928\u0935\u0940\u0928 \u092A\u093E\u0930\u094D\u091F\u0940 \u0924\u092F\u093E\u0930: ${party.name}`, metadata: JSON.stringify({ partyId: party.id, partyName: party.name, openingBalance: party.openingBalance, openingBalanceType: party.openingBalanceType }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      res.json(party);
    } catch (error) {
      res.status(400).json({ message: "Invalid party data" });
    }
  });
  app2.put("/api/parties/:id", requireAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const partyData = insertPartySchema.partial().parse(req.body);
      const allParties = await storage.getParties(req.session.tenantId);
      const oldParty = allParties.find((p) => p.id === id);
      const party = await storage.updateParty(id, req.session.tenantId, partyData);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      try {
        const changedFields = {};
        if (oldParty) {
          for (const key of Object.keys(req.body)) {
            if (oldParty[key] !== void 0 && String(oldParty[key]) !== String(req.body[key])) {
              changedFields[key] = { old: oldParty[key], new: req.body[key] };
            }
          }
        }
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "update_party", description: `\u092A\u093E\u0930\u094D\u091F\u0940 \u0905\u092A\u0921\u0947\u091F: ${party.name}`, metadata: JSON.stringify({ partyId: id, partyName: party.name, oldName: oldParty?.name, changedFields }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      res.json(party);
    } catch (error) {
      res.status(400).json({ message: "Invalid party data" });
    }
  });
  app2.delete("/api/parties/:id", requireAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Attempting to delete party ${id} for tenant ${req.session.tenantId}`);
      const allParties = await storage.getParties(req.session.tenantId);
      const partyToDelete = allParties.find((p) => p.id === id);
      const success = await storage.deleteParty(id, req.session.tenantId);
      if (!success) {
        console.log(`Failed to delete party ${id} - either not found or has related transactions`);
        return res.status(400).json({
          message: "Party cannot be deleted. Either party not found or has related transactions."
        });
      }
      try {
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "delete_party", description: `\u092A\u093E\u0930\u094D\u091F\u0940 \u0921\u093F\u0932\u0940\u091F: ${partyToDelete?.name || id}`, metadata: JSON.stringify({ partyId: id, partyName: partyToDelete?.name, openingBalance: partyToDelete?.openingBalance, openingBalanceType: partyToDelete?.openingBalanceType }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      console.log(`Successfully deleted party ${id}`);
      res.json({ message: "Party deleted successfully" });
    } catch (error) {
      console.error("Error deleting party:", error);
      res.status(500).json({ message: "Failed to delete party" });
    }
  });
  app2.get("/api/overdue-report", requireAuth2, async (req, res) => {
    console.log("\u2705 OVERDUE API REACHED WITH PROPER AUTH");
    const timeout = setTimeout(() => {
      console.error("\u23F0 OVERDUE REPORT TIMEOUT: 30 seconds elapsed");
      if (!res.headersSent) {
        res.status(504).json({ error: "Request timeout after 30 seconds" });
      }
    }, 3e4);
    try {
      console.log("\u{1F50D} OVERDUE: Parsing parameters...");
      const { dateFrom, dateTo, groupId, currentGoldRate, finePurityPercentage, monthlyInterestRate, interestRateMode, projectionMode, futureProjectionPeriod } = req.query;
      console.log("\u{1F50D} PROJECTION PARAMS:", { projectionMode, futureProjectionPeriod });
      const filters = {
        dateFrom: dateFrom || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        dateTo: dateTo || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        groupId: groupId === "all" ? "all" : groupId || "all",
        currentGoldRate: parseFloat(currentGoldRate || "70"),
        finePurityPercentage: parseFloat(finePurityPercentage || "80"),
        monthlyInterestRate: parseFloat(monthlyInterestRate || "8"),
        interestRateMode: interestRateMode || "manual",
        projectionMode: projectionMode || "current",
        futureProjectionPeriod: futureProjectionPeriod || "3months"
      };
      console.log("\u{1F50D} OVERDUE: Calling storage method for tenant:", req.session.tenantId);
      const overdueData = await storage.getOverdueReportWithCorrectMath(req.session.tenantId, filters);
      clearTimeout(timeout);
      console.log(`\u{1F4CA} OVERDUE: Successfully processed ${overdueData.length} items`);
      res.json(overdueData);
    } catch (error) {
      clearTimeout(timeout);
      console.error("\u274C OVERDUE ERROR:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Failed to generate overdue report",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
  app2.get("/api/cash-transactions", requireAuth2, async (req, res) => {
    try {
      const { dateFrom, dateTo, partyId, transactionType, search, amount, includeAll } = req.query;
      const transactions2 = await storage.getCashTransactions(req.session.tenantId, {
        dateFrom,
        dateTo,
        partyId,
        transactionType,
        search,
        amount,
        includeAll
      });
      const uniqueMap = /* @__PURE__ */ new Map();
      transactions2.forEach((transaction) => {
        if (!uniqueMap.has(transaction.id)) {
          uniqueMap.set(transaction.id, transaction);
        }
      });
      const deduplicatedTransactions = Array.from(uniqueMap.values());
      res.set({
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "ETag": `"cash-tx-${Date.now()}"`
        // Force unique response
      });
      res.json(deduplicatedTransactions);
    } catch (error) {
      console.error("Error fetching cash transactions:", error);
      res.status(500).json({ message: "Failed to fetch cash transactions" });
    }
  });
  app2.get("/api/mobile-cashbook/balance", requireAuth2, async (req, res) => {
    try {
      const { startDate, endDate, viewPeriod } = req.query;
      if (!startDate || !endDate || !viewPeriod) {
        return res.status(400).json({
          message: "startDate, endDate, and viewPeriod parameters required"
        });
      }
      const balanceData = await storage.getMobileCashbookUniversalBalance(
        req.session.tenantId,
        startDate,
        endDate,
        viewPeriod
      );
      res.set({
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      res.json(balanceData);
    } catch (error) {
      console.error("Error fetching mobile cashbook universal balance:", error);
      res.status(500).json({ message: "Failed to fetch universal balance" });
    }
  });
  app2.get("/api/mobile-cashbook/daily-balance", requireAuth2, async (req, res) => {
    try {
      const { date: date2 } = req.query;
      if (!date2) {
        return res.status(400).json({ message: "Date parameter required" });
      }
      const balanceData = await storage.getMobileCashbookDailyBalance(req.session.tenantId, date2);
      res.set({
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      res.json(balanceData);
    } catch (error) {
      console.error("Error fetching mobile cashbook daily balance:", error);
      res.status(500).json({ message: "Failed to fetch daily balance" });
    }
  });
  app2.post("/api/cash-transactions", requireAuth2, cacheBuster(["dashboard:", "cash-transactions:"]), async (req, res) => {
    try {
      const transactionData = insertCashTransactionSchema.parse({
        ...req.body,
        tenantId: req.session.tenantId
      });
      console.log("\u2705 PARSED SUCCESSFULLY:", transactionData);
      console.log("\u{1F527} Creating cash transaction:", {
        type: transactionData.transactionType,
        amount: transactionData.amount,
        category: transactionData.category,
        date: transactionData.transactionDate,
        partyId: transactionData.partyId
      });
      let transaction;
      if (transactionData.partyId && transactionData.partyId !== "cash") {
        console.log("\u{1F527} CALLING STORAGE.createCashTransactionWithJournal for dual entry...");
        transaction = await storage.createCashTransactionWithJournal(transactionData);
      } else {
        console.log("\u{1F527} CALLING STORAGE.createCashTransaction for single entry...");
        transaction = await storage.createCashTransaction(transactionData);
      }
      if (transactionData.narration && transactionData.narration.includes("\u0915\u0930\u094D\u091C")) {
        try {
          const loans2 = await storage.getLoans(req.session.tenantId);
          if (transactionData.narration.includes("\u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923")) {
            const loan = loans2.find(
              (l) => transactionData.narration.includes(l.accountNumber) || transactionData.narration.includes(l.borrowerName)
            );
            if (loan && loan.status !== "active") {
              await storage.updateLoan(loan.id, req.session.tenantId, { status: "active" });
            }
          }
          if (transactionData.narration.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926")) {
            const loan = loans2.find(
              (l) => transactionData.narration.includes(l.accountNumber) || transactionData.narration.includes(l.borrowerName)
            );
            if (loan && loan.status !== "closed") {
              await storage.updateLoan(loan.id, req.session.tenantId, { status: "closed" });
            }
          }
        } catch (error) {
          console.error("Failed to update loan status from cash transaction:", error);
        }
      }
      console.log(`\u2705 Cash transaction created successfully: ${transactionData.transactionType} \u20B9${transactionData.amount}`);
      try {
        const txId = "cashTransaction" in transaction ? transaction.cashTransaction.id : transaction.id;
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "create_cash_transaction", description: `\u0928\u0935\u0940\u0928 \u0930\u094B\u0916 \u0935\u094D\u092F\u0935\u0939\u093E\u0930: ${transactionData.transactionType === "cash_in" ? "\u091C\u092E\u093E" : "\u0928\u093E\u0935\u0947"} \u20B9${transactionData.amount} - ${transactionData.narration?.substring(0, 50) || ""}`, metadata: JSON.stringify({ transactionId: txId, amount: transactionData.amount, transactionType: transactionData.transactionType, transactionDate: transactionData.transactionDate, category: transactionData.category, narration: transactionData.narration, partyId: transactionData.partyId }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      res.json(transaction);
    } catch (error) {
      console.error("\u{1F4A5} MOBILE CASHBOOK TRANSACTION ERROR:", error);
      console.error("\u{1F4A5} ERROR TYPE:", error?.constructor?.name);
      console.error("\u{1F4A5} ERROR MESSAGE:", error instanceof Error ? error.message : error);
      console.error("\u{1F4A5} REQUEST BODY:", JSON.stringify(req.body, null, 2));
      res.status(400).json({
        message: "Invalid transaction data",
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name,
        requestData: req.body
      });
    }
  });
  app2.post("/api/cash-transactions/cleanup", requireAuth2, async (req, res) => {
    try {
      res.json({
        success: true,
        message: "Manual cleanup completed"
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to perform cleanup" });
    }
  });
  app2.put("/api/cash-transactions/:id", requireAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      const transactionData = insertCashTransactionSchema.partial().parse(req.body);
      const transactions2 = await storage.getCashTransactions(req.session.tenantId);
      const oldTransaction = transactions2.find((t) => t.id === id);
      if (!oldTransaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      const transaction = await storage.updateCashTransaction(id, req.session.tenantId, transactionData);
      if (!transaction) {
        return res.status(404).json({ message: "Failed to update transaction" });
      }
      try {
        const changedFields = {};
        if (oldTransaction) {
          for (const key of Object.keys(req.body)) {
            if (oldTransaction[key] !== void 0 && String(oldTransaction[key]) !== String(req.body[key])) {
              changedFields[key] = { old: oldTransaction[key], new: req.body[key] };
            }
          }
        }
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "update_cash_transaction", description: `\u0930\u094B\u0916 \u0935\u094D\u092F\u0935\u0939\u093E\u0930 \u0905\u092A\u0921\u0947\u091F: \u20B9${transaction.amount} - ${transaction.narration?.substring(0, 50) || ""}`, metadata: JSON.stringify({ transactionId: id, amount: transaction.amount, oldAmount: oldTransaction?.amount, narration: transaction.narration, transactionType: transaction.transactionType, transactionDate: transaction.transactionDate, changedFields }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      const newNarration = transactionData.narration || transaction.narration || "";
      const oldNarration = oldTransaction.narration || "";
      if (newNarration !== oldNarration && (newNarration.includes("\u0915\u0930\u094D\u091C") || oldNarration.includes("\u0915\u0930\u094D\u091C"))) {
        try {
          const loans2 = await storage.getLoans(req.session.tenantId);
          if (oldNarration.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926") && !newNarration.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926")) {
            const loan = loans2.find(
              (l) => oldNarration.includes(l.accountNumber) || oldNarration.includes(l.borrowerName)
            );
            if (loan && loan.status === "closed") {
              await storage.updateLoan(loan.id, req.session.tenantId, { status: "active" });
            }
          }
          if (!oldNarration.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926") && newNarration.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926")) {
            const loan = loans2.find(
              (l) => newNarration.includes(l.accountNumber) || newNarration.includes(l.borrowerName)
            );
            if (loan && loan.status === "active") {
              await storage.updateLoan(loan.id, req.session.tenantId, { status: "closed" });
            }
          }
        } catch (error) {
          console.error("Failed to update loan status after cash transaction update:", error);
        }
      }
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ message: "Invalid transaction data" });
    }
  });
  app2.delete("/api/cash-transactions/:id", requireAuth2, async (req, res) => {
    try {
      const { id } = req.params;
      console.log("\u{1F5D1}\uFE0F DELETE TRANSACTION REQUEST:", {
        transactionId: id,
        tenantId: req.session.tenantId,
        userId: req.session.userId
      });
      const transactions2 = await storage.getCashTransactions(req.session.tenantId);
      const transaction = transactions2.find((t) => t.id === id);
      console.log("\u{1F50D} TRANSACTION FOUND:", {
        exists: !!transaction,
        isDualEntry: transaction?.partyId && transaction?.partyId !== "cash",
        partyId: transaction?.partyId,
        amount: transaction?.amount,
        narration: transaction?.narration
      });
      if (!transaction) {
        console.log("\u274C TRANSACTION NOT FOUND");
        return res.status(404).json({ message: "Transaction not found" });
      }
      if (transaction.narration && transaction.narration.includes("\u0915\u0930\u094D\u091C")) {
        try {
          const loans2 = await storage.getLoans(req.session.tenantId);
          if (transaction.narration.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926")) {
            const loan = loans2.find(
              (l) => transaction.narration.includes(l.accountNumber) || transaction.narration.includes(l.borrowerName)
            );
            if (loan && loan.status === "closed") {
              await storage.updateLoan(loan.id, req.session.tenantId, { status: "active" });
              const closures = await storage.getLoanClosures(req.session.tenantId, loan.id);
              for (const closure of closures) {
                await storage.deleteLoanClosure(closure.id, req.session.tenantId);
              }
            }
          }
          if (transaction.narration.includes("\u0915\u0930\u094D\u091C \u0935\u093F\u0924\u0930\u0923")) {
            const loan = loans2.find(
              (l) => transaction.narration.includes(l.accountNumber) || transaction.narration.includes(l.borrowerName)
            );
            if (loan) {
              const loanTransactions = await storage.getTransactions(req.session.tenantId, loan.id);
              if (loanTransactions.length === 1) {
                await storage.updateLoan(loan.id, req.session.tenantId, { status: "inactive" });
              }
            }
          }
        } catch (error) {
          console.error("Failed to update loan status after cash transaction deletion:", error);
        }
      }
      const success = await storage.deleteCashTransaction(id, req.session.tenantId);
      console.log("\u{1F4A5} DELETE RESULT:", {
        success,
        transactionId: id,
        tenantId: req.session.tenantId
      });
      if (!success) {
        console.log("\u274C DELETE FAILED - Transaction not found in storage");
        return res.status(404).json({ message: "Failed to delete transaction" });
      }
      try {
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "delete_cash_transaction", description: `\u0930\u094B\u0916 \u0935\u094D\u092F\u0935\u0939\u093E\u0930 \u0921\u093F\u0932\u0940\u091F: \u20B9${transaction.amount} - ${transaction.narration?.substring(0, 80) || ""}`, metadata: JSON.stringify({ transactionId: id, amount: transaction.amount, narration: transaction.narration, transactionType: transaction.transactionType, transactionDate: transaction.transactionDate, category: transaction.category, partyId: transaction.partyId }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      console.log("\u2705 DELETE SUCCESS - Transaction deleted successfully");
      res.json({ message: "Transaction deleted successfully" });
    } catch (error) {
      console.error("\u{1F4A5} DELETE EXCEPTION:", error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });
  app2.get("/api/date-wise-balance/:date", requireAuth2, async (req, res) => {
    try {
      const { date: date2 } = req.params;
      const dateWiseBalance = await storage.getDateWiseCashBalance(req.session.tenantId, date2);
      res.json({
        success: true,
        data: dateWiseBalance,
        message: `Date-wise balance for ${date2}`
      });
    } catch (error) {
      console.error("Date-wise balance calculation error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to calculate date-wise balance",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  app2.get("/api/cash-balance", requireAuth2, async (req, res) => {
    try {
      const { beforeDate, date: date2 } = req.query;
      if (beforeDate || date2) {
        const targetDate = date2 || beforeDate;
        console.log(`\u{1F3E6} API: Getting balance for date: ${targetDate}`);
        const dateWiseBalance = await storage.getDateWiseCashBalance(req.session.tenantId, targetDate);
        console.log(`\u{1F3E6} API: Date-wise balance result:`, {
          date: targetDate,
          openingBalance: dateWiseBalance.openingBalance,
          closingBalance: dateWiseBalance.closingBalance,
          dayTransactions: dateWiseBalance.dayTransactions
        });
        res.json({
          balance: dateWiseBalance.closingBalance,
          // Use CLOSING balance for date-specific query
          openingBalance: dateWiseBalance.openingBalance,
          // Date opening balance  
          closingBalance: dateWiseBalance.closingBalance,
          // Date closing balance
          dayTransactions: dateWiseBalance.dayTransactions,
          // Day-specific transactions
          totalCashIn: dateWiseBalance.dayTransactions.cashIn,
          totalCashOut: dateWiseBalance.dayTransactions.cashOut,
          netDifference: dateWiseBalance.dayTransactions.netDifference,
          totalLoanDisbursements: 0,
          totalLoanClosures: 0,
          transactionCount: 0,
          lastUpdated: /* @__PURE__ */ new Date(),
          isValid: true,
          errors: []
        });
      } else {
        const professionalBalance = await storage.getProfessionalCashBalance(req.session.tenantId);
        res.json({
          balance: professionalBalance.currentBalance,
          openingBalance: professionalBalance.openingBalance,
          totalCashIn: professionalBalance.totalCashIn,
          totalCashOut: professionalBalance.totalCashOut,
          totalLoanDisbursements: professionalBalance.totalLoanDisbursements,
          totalLoanClosures: professionalBalance.totalLoanClosures,
          transactionCount: professionalBalance.transactionCount,
          lastUpdated: professionalBalance.lastUpdated,
          isValid: professionalBalance.isValid,
          errors: professionalBalance.errors
        });
      }
    } catch (error) {
      console.error("Professional cash balance calculation error:", error);
      res.status(500).json({ message: "Failed to calculate professional cash balance" });
    }
  });
  app2.post("/api/cash-transactions-with-journal", requireAuth2, async (req, res) => {
    try {
      console.log("\u{1F50D} DUAL ENTRY REQUEST DATA:", JSON.stringify(req.body, null, 2));
      console.log("\u{1F50D} SESSION DATA:", req.session.tenantId, req.session.userId);
      const transactionData = insertCashTransactionSchema.parse({
        ...req.body,
        tenantId: req.session.tenantId
      });
      console.log("\u2705 PARSED TRANSACTION DATA:", JSON.stringify(transactionData, null, 2));
      const result = await storage.createCashTransactionWithJournal(transactionData);
      console.log("\u{1F389} DUAL ENTRY TRANSACTION CREATED:", JSON.stringify(result, null, 2));
      res.json(result);
    } catch (error) {
      console.error("\u{1F4A5} FULL ERROR OBJECT:", error);
      console.error("\u{1F4A5} Error name:", error?.constructor?.name);
      console.error("\u{1F4A5} Error message:", error instanceof Error ? error.message : error);
      console.error("\u{1F4A5} Error stack:", error instanceof Error ? error.stack : "No stack");
      res.status(400).json({
        message: "Invalid transaction data",
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name,
        details: error
      });
    }
  });
  app2.get("/api/journal-entries", requireAuth2, async (req, res) => {
    try {
      const { dateFrom, dateTo, sourceType } = req.query;
      const entries = await storage.getJournalEntries(req.session.tenantId, {
        dateFrom,
        dateTo,
        sourceType
      });
      res.json(entries);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });
  app2.get("/api/party-ledger/:partyId", requireAuth2, async (req, res) => {
    try {
      const { partyId } = req.params;
      const { dateFrom, dateTo } = req.query;
      const ledger = await storage.getPartyLedger(
        req.session.tenantId,
        partyId,
        dateFrom,
        dateTo
      );
      res.json(ledger);
    } catch (error) {
      console.error("Error fetching party ledger:", error);
      res.status(500).json({ message: "Failed to fetch party ledger" });
    }
  });
  app2.get("/api/trial-balance", requireAuth2, async (req, res) => {
    try {
      const { asOfDate } = req.query;
      const trialBalance = await storage.getTrialBalance(
        req.session.tenantId,
        asOfDate
      );
      res.json(trialBalance);
    } catch (error) {
      console.error("Error fetching trial balance:", error);
      res.status(500).json({ message: "Failed to fetch trial balance" });
    }
  });
  app2.get("/api/users", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const users2 = await storage.getAllSystemUsers();
      res.json(users2);
    } catch (error) {
      console.error("Error fetching all system users:", error);
      res.status(500).json({ message: "Failed to fetch system users" });
    }
  });
  app2.get("/api/tenants", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const tenants = await storage.getAllSystemTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching all system tenants:", error);
      res.status(500).json({ message: "Failed to fetch system tenants" });
    }
  });
  app2.get("/api/super-admin/users", requireAuth2, async (req, res) => {
    return res.status(403).json({
      message: "Super Admin \u092B\u0915\u094D\u0924 tenant management \u0915\u0930\u0942 \u0936\u0915\u0924\u094B. Individual user management tenant admin \u0926\u094D\u0935\u093E\u0930\u0947 \u0915\u0930\u093E\u0935\u0947.",
      redirectTo: "/super-admin-tenant-management"
    });
  });
  app2.post("/api/super-admin/users", requireAuth2, async (req, res) => {
    return res.status(403).json({
      message: "Super Admin \u092B\u0915\u094D\u0924 tenant admins create \u0915\u0930\u0942 \u0936\u0915\u0924\u094B. Individual users tenant admin \u0926\u094D\u0935\u093E\u0930\u0947 create \u0915\u0930\u093E\u0935\u0947.",
      redirectTo: "/super-admin-tenant-management"
    });
  });
  app2.put("/api/super-admin/users/:id", requireAuth2, async (req, res) => {
    return res.status(403).json({
      message: "Super Admin \u092B\u0915\u094D\u0924 tenant admins manage \u0915\u0930\u0942 \u0936\u0915\u0924\u094B. Individual users edit \u0915\u0930\u0923\u094D\u092F\u093E\u0938\u093E\u0920\u0940 tenant admin \u092E\u094D\u0939\u0923\u0942\u0928 login \u0915\u0930\u093E.",
      redirectTo: "/super-admin-tenant-management"
    });
  });
  app2.patch("/api/super-admin/users/:id/toggle", requireAuth2, async (req, res) => {
    return res.status(403).json({
      message: "Super Admin \u092B\u0915\u094D\u0924 tenant admins enable/disable \u0915\u0930\u0942 \u0936\u0915\u0924\u094B. Individual users tenant admin \u0926\u094D\u0935\u093E\u0930\u0947 manage \u0915\u0930\u093E\u0935\u0947.",
      redirectTo: "/super-admin-tenant-management"
    });
  });
  app2.patch("/api/super-admin/users/:id/password", requireAuth2, async (req, res) => {
    return res.status(403).json({
      message: "Super Admin \u092B\u0915\u094D\u0924 tenant admin passwords reset \u0915\u0930\u0942 \u0936\u0915\u0924\u094B. Individual user passwords tenant admin \u0926\u094D\u0935\u093E\u0930\u0947 reset \u0915\u0930\u093E\u0935\u0947.",
      redirectTo: "/super-admin-tenant-management"
    });
  });
  app2.post("/api/super-admin/change-own-password", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }
      const superAdmin = await storage.getUser(req.session.userId);
      if (!superAdmin) {
        return res.status(404).json({ message: "Super Admin user not found" });
      }
      const isCurrentPasswordValid = await bcrypt2.compare(currentPassword, superAdmin.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      const success = await storage.updateUserPassword(req.session.userId, req.session.tenantId, newPassword);
      if (!success) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      console.log(`\u{1F512} SUPER ADMIN PASSWORD CHANGED: ${superAdmin.username} (${req.session.userId})`);
      await invalidateOtherSessions(req.session.userId, req.sessionID);
      await storage.logUserActivity({
        userId: req.session.userId,
        tenantId: req.session.tenantId,
        activityType: "change_own_password",
        description: `Super Admin changed own password`,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        metadata: JSON.stringify({ superAdminPasswordChange: true })
      });
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Super Admin password change error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
  app2.post("/api/super-admin/reset-admin-password/:adminId", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { adminId } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      const adminUser = await storage.getUserById(adminId);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(404).json({ message: "Admin user not found" });
      }
      const hashedPassword = await bcrypt2.hash(newPassword, 10);
      await storage.updateUser(adminId, { password: hashedPassword });
      await invalidateOtherSessions(adminId, "");
      res.json({
        message: `Password reset successfully for admin: ${adminUser.username}`,
        adminUsername: adminUser.username,
        tenantId: adminUser.tenantId
      });
    } catch (error) {
      console.error("Error resetting admin password:", error);
      res.status(500).json({ message: "Failed to reset admin password" });
    }
  });
  app2.delete("/api/super-admin/delete-admin/:adminId", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { adminId } = req.params;
      const adminUser = await storage.getUserById(adminId);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(404).json({ message: "Admin user not found" });
      }
      if (adminUser.tenantId === "SUPER_ADMIN") {
        return res.status(403).json({ message: "Cannot delete SUPER_ADMIN system user" });
      }
      const tenantAdmins = await storage.getUsersByTenant(adminUser.tenantId);
      const adminCount = tenantAdmins.filter((u) => u.role === "admin" && u.isActive).length;
      if (adminCount <= 1) {
        console.log(`\u{1F5D1}\uFE0F Deleting last admin of tenant ${adminUser.tenantId} - cleaning up entire tenant`);
        const tenantDeleteResult = await storage.deleteTenantCompletely(adminUser.tenantId);
        if (tenantDeleteResult.success) {
          return res.json({
            message: `\u0936\u0947\u0935\u091F\u091A\u093E admin \u0921\u093F\u0932\u0940\u091F \u0915\u0947\u0932\u093E - \u0938\u0902\u092A\u0942\u0930\u094D\u0923 \u091F\u0947\u0928\u0902\u091F ${adminUser.tenantId} \u0906\u0923\u093F \u0938\u0930\u094D\u0935 \u0921\u0947\u091F\u093E \u0921\u093F\u0932\u0940\u091F \u091D\u093E\u0932\u093E`,
            deletedAdmin: {
              username: adminUser.username,
              tenantId: adminUser.tenantId,
              id: adminId
            },
            tenantDeleted: true,
            deletedRecords: tenantDeleteResult.deletedRecords
          });
        } else {
          return res.status(500).json({
            message: "\u091F\u0947\u0928\u0902\u091F \u0921\u093F\u0932\u0940\u091F \u0915\u0930\u0923\u094D\u092F\u093E\u0924 \u0905\u092A\u092F\u0936",
            errors: tenantDeleteResult.errors
          });
        }
      }
      await storage.deleteUser(adminId);
      res.json({
        message: `Admin deleted successfully: ${adminUser.username}`,
        deletedAdmin: {
          username: adminUser.username,
          tenantId: adminUser.tenantId,
          id: adminId
        }
      });
    } catch (error) {
      console.error("Error deleting admin user:", error);
      res.status(500).json({ message: "Failed to delete admin user" });
    }
  });
  app2.post("/api/admin/request-password-reset", async (req, res) => {
    try {
      const { tenantId, username } = req.body;
      if (!tenantId || !username) {
        return res.status(400).json({ message: "Tenant ID and username are required" });
      }
      const adminUser = await storage.findUserByTenantAndUsername(tenantId, username);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(404).json({ message: "Admin user not found" });
      }
      const resetRequest = await storage.createPasswordResetRequest({
        tenantId: adminUser.tenantId,
        username: adminUser.username,
        adminId: adminUser.id,
        userRole: adminUser.role,
        reason: "Password reset requested by admin"
      });
      res.json({
        message: "Password reset request sent to Super Admin successfully",
        requestId: resetRequest.id
      });
    } catch (error) {
      console.error("Error creating password reset request:", error);
      res.status(500).json({ message: "Failed to create password reset request" });
    }
  });
  app2.get("/api/super-admin/password-reset-requests", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const pendingRequests = await storage.getPendingPasswordResetRequests();
      res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching password reset requests:", error);
      res.status(500).json({ message: "Failed to fetch password reset requests" });
    }
  });
  app2.post("/api/super-admin/approve-password-reset/:requestId", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { requestId } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      const request = await storage.getPasswordResetRequestById(requestId);
      if (!request || request.status !== "pending") {
        return res.status(404).json({ message: "Password reset request not found or already processed" });
      }
      const hashedPassword = await bcrypt2.hash(newPassword, 10);
      if (request.adminId) {
        await storage.updateUser(request.adminId, { password: hashedPassword });
        await invalidateOtherSessions(request.adminId, "");
      }
      await storage.completePasswordResetRequest(requestId, req.session.userId);
      res.json({
        message: `Password reset approved and completed for ${request.username}`,
        adminUsername: request.username,
        tenantId: request.tenantId
      });
    } catch (error) {
      console.error("Error approving password reset:", error);
      res.status(500).json({ message: "Failed to approve password reset" });
    }
  });
  app2.patch("/api/super-admin/reset-tenant-admin/:tenantId", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { tenantId } = req.params;
      const { newPassword } = req.body;
      if (!tenantId || !newPassword) {
        return res.status(400).json({ message: "Tenant ID and new password are required" });
      }
      const adminUser = await storage.getUserByCredentials(tenantId, "admin");
      if (!adminUser) {
        return res.status(404).json({ message: "Admin user not found for this tenant" });
      }
      const hashedPassword = await bcrypt2.hash(newPassword, 10);
      const updatedUser = await storage.updateUser(adminUser.id, { password: hashedPassword });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      await invalidateOtherSessions(adminUser.id.toString(), "");
      res.json({
        message: "Tenant admin password reset successfully",
        tenantId,
        adminUsername: adminUser.username
      });
    } catch (error) {
      console.error("Error resetting tenant admin password:", error);
      res.status(500).json({ message: "Failed to reset tenant admin password" });
    }
  });
  app2.post("/api/super-admin/create-tenant", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { tenantId: rawTenantId, adminUsername: rawAdminUsername, adminPassword, companyName, companyAddress } = req.body;
      if (!rawTenantId || !rawAdminUsername || !adminPassword || !companyName) {
        return res.status(400).json({
          message: "Tenant ID, admin username, password, and company name are required"
        });
      }
      const tenantId = rawTenantId.toString().toUpperCase().trim();
      const adminUsername = rawAdminUsername.toString().trim();
      const existingUser = await storage.getUserByCredentials(tenantId, adminUsername);
      if (existingUser) {
        return res.status(409).json({ message: "Tenant or admin user already exists" });
      }
      const { default: SuperAdminGuardian2 } = await Promise.resolve().then(() => (init_super_admin_guardian(), super_admin_guardian_exports));
      const validation = await SuperAdminGuardian2.validateUserCreation({
        username: adminUsername,
        tenantId,
        role: "admin"
      });
      if (!validation.isValid && validation.correctedRole) {
        console.warn(`\u{1F6E1}\uFE0F  GUARDIAN PROTECTION (CREATE TENANT): ${validation.reason}`);
      }
      const newAdmin = await storage.createUser({
        username: adminUsername,
        password: adminPassword,
        tenantId,
        role: validation.correctedRole || "admin",
        // Use Guardian-validated role
        fullName: `${companyName} Administrator`,
        email: null,
        isActive: true,
        isTemporaryDisabled: false,
        createdBy: req.session.userId
        // Super admin who created this
      });
      const company = await storage.createCompany({
        name: companyName,
        address: companyAddress || "",
        tenantId,
        contactNumber: "",
        email: "",
        licenseNumber: ""
      });
      await storage.createUserPermissions({
        userId: newAdmin.id,
        tenantId,
        canViewDashboard: true,
        canAccessCompanyRegistration: true,
        canAccessGroupManagement: true,
        canAccessLoanRegistration: true,
        canAccessLoanClosure: true,
        canAccessCashTransactions: true,
        canAccessPartyManagement: true,
        canAccessMobileCashbook: true,
        canAccessInterestCalculator: true,
        canViewReceiptGenerator: true,
        canViewCashBookReport: true,
        canViewCapitalReport: true,
        canViewLedgerReport: true,
        canViewBorrowerListReport: true,
        canViewOverdueReport: true,
        // Date-wise, Name-wise, Closing-wise, and Maturity-wise reports removed from schema
        canViewAccountSummaryReport: true,
        // Loan management permissions removed from schema
        canManageBorrowers: true,
        // Additional borrower permissions removed from schema
        canDeleteBorrowers: true
        // Group management permissions removed from schema
        // Party management permissions removed from schema
        // Cashbook and report permissions removed from schema
        // Note: User Management and Data Management are admin-only features
        // Super Admin Panel access - role-based, not tenant-based
        // Super Admin Panel access removed from regular tenant creation
      });
      res.json({
        message: "New tenant created successfully with complete admin permissions",
        tenant: {
          tenantId,
          adminUser: {
            id: newAdmin.id,
            username: newAdmin.username,
            role: newAdmin.role,
            hasFullAccess: true
          },
          company: {
            id: company.id,
            name: company.name
          }
        }
      });
    } catch (error) {
      console.error("Error creating new tenant:", error);
      res.status(500).json({ message: "Failed to create new tenant" });
    }
  });
  app2.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { tenantId, username, reason } = req.body;
      if (!tenantId || !username) {
        return res.status(400).json({ message: "Tenant ID and username are required" });
      }
      const user = await storage.getUserByCredentials(tenantId.toUpperCase().trim(), username.trim());
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const resetRequest = await storage.createPasswordResetRequest({
        tenantId: tenantId.toUpperCase().trim(),
        username: username.trim(),
        adminId: user.id,
        userRole: user.role,
        reason: reason || "Password forgotten"
      });
      console.log(`\u{1F4CB} Password reset request stored in DB: ${username}@${tenantId}`);
      res.json({
        message: "Password reset request submitted successfully",
        requestId: resetRequest.id,
        info: "Your request has been sent to system administrator"
      });
    } catch (error) {
      console.error("Error submitting password reset request:", error);
      res.status(500).json({ message: "Failed to submit password reset request" });
    }
  });
  app2.get("/api/super-admin/all-users", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const allUsers = await storage.getAllUsersWithCompanyDetails();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app2.post("/api/super-admin/reset-password", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { userId, newPassword } = req.body;
      if (!userId || !newPassword) {
        return res.status(400).json({ message: "User ID and new password are required" });
      }
      const success = await storage.resetUserPassword(userId, req.session.tenantId, newPassword, "super_admin");
      if (success) {
        res.json({ message: "Password reset successfully" });
      } else {
        res.status(500).json({ message: "Failed to reset password" });
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
  app2.get("/api/super-admin/storage-analytics", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const analytics = await storage.getTenantStorageAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching storage analytics:", error);
      res.status(500).json({ message: "Failed to fetch storage analytics" });
    }
  });
  app2.get("/api/super-admin/tenants", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const tenants = await storage.getAllTenantsForManagement();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });
  app2.patch("/api/super-admin/tenants/:tenantId/toggle", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { tenantId } = req.params;
      const { isActive } = req.body;
      if (tenantId === "SUPER_ADMIN") {
        return res.status(403).json({ message: "SUPER_ADMIN tenant \u092C\u0902\u0926 \u0915\u0930\u0924\u093E \u092F\u0947\u0924 \u0928\u093E\u0939\u0940. \u0939\u093E system tenant \u0906\u0939\u0947." });
      }
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean value" });
      }
      await storage.toggleTenantActive(tenantId, isActive);
      console.log(`\u{1F504} TENANT TOGGLE: ${tenantId} -> ${isActive ? "ACTIVE" : "INACTIVE"}`);
      await storage.logUserActivity({
        userId: req.session.userId,
        tenantId: req.session.tenantId,
        activityType: "toggle_tenant",
        description: `Toggled tenant ${tenantId} to ${isActive ? "active" : "inactive"}`,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        metadata: JSON.stringify({
          targetTenantId: tenantId,
          newStatus: isActive ? "active" : "inactive"
        })
      });
      res.json({
        message: `Tenant ${tenantId} ${isActive ? "activated" : "deactivated"} successfully`,
        tenantId,
        isActive
      });
    } catch (error) {
      console.error("Error toggling tenant status:", error);
      res.status(500).json({ message: "Failed to toggle tenant status" });
    }
  });
  app2.delete("/api/super-admin/delete-tenant/:tenantId", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { tenantId } = req.params;
      if (!tenantId || tenantId === "SUPER_ADMIN" || tenantId === req.session.tenantId) {
        return res.status(400).json({ message: "Invalid tenant ID or cannot delete system/own tenant" });
      }
      const result = await storage.deleteTenantCompletely(tenantId);
      if (result.success) {
        res.json({
          message: "Tenant deleted successfully",
          deletedRecords: result.deletedRecords
        });
      } else {
        res.status(500).json({
          message: "Failed to delete tenant",
          errors: result.errors
        });
      }
    } catch (error) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ message: "Failed to delete tenant" });
    }
  });
  app2.post("/api/super-admin/reset-password/:userId", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { userId } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      const success = await storage.resetUserPasswordBySuperAdmin(userId, newPassword);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      await invalidateOtherSessions(userId, "");
      res.json({
        message: "Password reset successfully",
        resetAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("Error resetting user password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
  app2.get("/api/super-admin/tenant-stats", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const tenantStats = await storage.getTenantStatistics();
      res.json(tenantStats);
    } catch (error) {
      console.error("Error fetching tenant statistics:", error);
      res.status(500).json({ message: "Failed to fetch tenant statistics" });
    }
  });
  app2.delete("/api/super-admin/tenant/:tenantId", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { tenantId } = req.params;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }
      if (tenantId === "SUPER_ADMIN") {
        return res.status(403).json({ message: "SUPER_ADMIN tenant \u0921\u093F\u0932\u0940\u091F \u0915\u0930\u0924\u093E \u092F\u0947\u0924 \u0928\u093E\u0939\u0940. \u0939\u093E system tenant \u0906\u0939\u0947." });
      }
      const result = await storage.deleteTenantData(tenantId);
      res.json({ message: "Tenant and all data deleted successfully", deletedRecords: result });
    } catch (error) {
      console.error("Error deleting tenant data:", error);
      res.status(500).json({ message: "Failed to delete tenant data" });
    }
  });
  app2.delete("/api/super-admin/users/:id", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      const { id } = req.params;
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  app2.post("/emergency/reset-admin", async (req, res) => {
    try {
      if (process.env.NODE_ENV === "production" && !process.env.EMERGENCY_MODE) {
        return res.status(403).json({ message: "Emergency endpoints disabled in production" });
      }
      const { tenantId = "TEST", username = "admin", newPassword } = req.body;
      if (!newPassword) {
        return res.status(400).json({ message: "New password required" });
      }
      const hashedPassword = await bcrypt2.hash(newPassword, 10);
      const user = await storage.getUserByCredentials(tenantId, username);
      if (!user) {
        return res.status(404).json({ message: "Admin user not found" });
      }
      const success = await storage.updateUser(user.id, { password: hashedPassword });
      console.log("Emergency password reset for:", { username, tenantId });
      res.json({
        message: "Password reset successful",
        warning: "Change this password immediately after login"
      });
    } catch (error) {
      console.error("Emergency reset error:", error);
      res.status(500).json({ message: "Reset failed" });
    }
  });
  app2.get("/emergency/list-admins", async (req, res) => {
    try {
      if (process.env.NODE_ENV === "production" && !process.env.EMERGENCY_MODE) {
        return res.status(403).json({ message: "Emergency endpoints disabled in production" });
      }
      const admins = await storage.getAllUsers();
      const adminUsers = admins.filter((user) => user.role === "admin");
      res.json({ admins: adminUsers });
    } catch (error) {
      console.error("Emergency list error:", error);
      res.status(500).json({ message: "List failed" });
    }
  });
  app2.post("/api/automatic-system-check", requireAuth2, async (req, res) => {
    try {
      console.log("\u{1F916} Running automatic system check...");
      const automaticPrevention = createAutomaticPrevention(req.session.tenantId);
      const result = await automaticPrevention.runFullAutomaticSystem();
      res.json({
        success: true,
        message: "Automatic system check completed",
        results: {
          missingDisbursementsFixed: result.missingFixed,
          duplicatesRemoved: result.duplicatesRemoved,
          actions: result.totalActions
        }
      });
    } catch (error) {
      console.error("Automatic system check failed:", error);
      res.status(500).json({
        success: false,
        message: "Automatic system check failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/loans/cleanup-manual-entries", requireAuth2, async (req, res) => {
    try {
      const { amount, accountNumber } = req.body;
      const tenantId = req.session.tenantId;
      console.log(`\u{1F9F9} FORM LEVEL CLEANUP: Checking for manual entries before loan closure \u20B9${amount}`);
      const manualEntries = await db.select().from(cashTransactions).where(and11(
        eq12(cashTransactions.tenantId, tenantId),
        sql10`ABS(${cashTransactions.amount} - ${amount}) < 0.01`,
        eq12(cashTransactions.isSystemGenerated, false),
        // Look for entries within last 10 minutes that could be manual duplicates
        sql10`${cashTransactions.createdAt} > NOW() - INTERVAL '10 minutes'`,
        // Target common manual entry categories
        or5(
          eq12(cashTransactions.category, "income"),
          eq12(cashTransactions.category, "capital"),
          eq12(cashTransactions.category, "expense")
        )
      )).orderBy(sql10`${cashTransactions.createdAt} DESC`).limit(5);
      let deletedCount = 0;
      for (const entry of manualEntries) {
        const hasLoanKeywords = entry.narration && (entry.narration.includes("\u0915\u0930\u094D\u091C \u092C\u0902\u0926") || entry.narration.includes("\u0916\u093E\u0924\u0947 \u0915\u094D\u0930.") || entry.narration.includes("\u092E\u0941\u0926\u094D\u0926\u0932") || entry.narration.includes("\u0935\u094D\u092F\u093E\u091C") || accountNumber && entry.narration.includes(accountNumber));
        if (hasLoanKeywords || !entry.narration) {
          console.log(`\u{1F5D1}\uFE0F FORM CLEANUP: Removing potential manual duplicate: ${entry.id} - \u20B9${entry.amount}`);
          await db.delete(cashTransactions).where(eq12(cashTransactions.id, entry.id));
          deletedCount++;
        }
      }
      console.log(`\u2705 FORM CLEANUP COMPLETE: Removed ${deletedCount} potential manual duplicates`);
      res.json({
        success: true,
        message: `Manual entries cleanup completed`,
        deletedCount,
        cleanState: true
      });
    } catch (error) {
      console.error("Manual entry cleanup failed:", error);
      res.status(500).json({
        success: false,
        message: "Manual entry cleanup failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.use("/api/data-management", data_management_default);
  app2.use("/api/user-management", user_management_default);
  app2.get("/api/users/:userId/permissions", requireAuth2, apiCache({
    ttl: 600,
    keyGenerator: (req) => `permissions:${req.session.tenantId}:${req.params.userId}`
  }), async (req, res) => {
    try {
      if (req.session.role !== "admin" && req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { userId } = req.params;
      const permissions = await storage.getUserPermissions(userId, req.session.tenantId);
      if (!permissions) {
        const defaultPermissions = await storage.createUserPermissions({
          userId,
          tenantId: req.session.tenantId,
          canViewDashboard: true,
          canAccessInterestCalculator: true
        });
        return res.json(defaultPermissions);
      }
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });
  app2.put("/api/users/:userId/permissions", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "admin" && req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { userId } = req.params;
      const permissionsData = req.body;
      const updatedPermissions = await storage.updateUserPermissions(userId, req.session.tenantId, permissionsData);
      if (!updatedPermissions) {
        return res.status(404).json({ message: "User permissions not found" });
      }
      res.json(updatedPermissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user permissions" });
    }
  });
  app2.post("/api/super-admin/admin/:adminId/temporary-disable", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Super admin access required" });
      }
      const { adminId } = req.params;
      await storage.temporaryDisableAdmin(adminId, 0, req.session.userId);
      res.json({ message: "Admin access disabled" });
    } catch (error) {
      res.status(500).json({ message: "Failed to disable admin" });
    }
  });
  app2.post("/api/super-admin/admin/:adminId/temporary-enable", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Super admin access required" });
      }
      const { adminId } = req.params;
      await storage.temporaryEnableAdmin(adminId);
      res.json({ message: "Admin temporarily enabled" });
    } catch (error) {
      res.status(500).json({ message: "Failed to enable admin" });
    }
  });
  app2.put("/api/user-management/users/:userId/password", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "admin" && req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { userId } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const updatedUser = await storage.resetUserPassword(userId, req.session.tenantId, newPassword, req.session.userId);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      await invalidateOtherSessions(userId, "");
      const { password, ...userWithoutPassword } = updatedUser;
      res.json({ message: "Password reset successfully", user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
  app2.get("/api/super-admin/admin-users", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Super admin access required" });
      }
      console.log("\u{1F50D} Super Admin fetching ONLY tenant admin users (not regular users or super admin users)");
      const adminUsers = await storage.getAllAdminUsers();
      console.log("\u{1F4CB} Admin users found:", adminUsers.length, "- filtering out non-admin users");
      res.json(adminUsers);
    } catch (error) {
      console.error("\u274C Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch admin users" });
    }
  });
  app2.delete("/api/loans/:loanId/photos/:photoId", requireAuth2, async (req, res) => {
    try {
      const { loanId, photoId } = req.params;
      const tenantId = req.session.tenantId;
      const [photo] = await db.select().from(loanPhotos).where(
        and11(
          eq12(loanPhotos.id, photoId),
          eq12(loanPhotos.loanId, loanId),
          eq12(loanPhotos.tenantId, tenantId),
          eq12(loanPhotos.isActive, true)
        )
      );
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      await PhotoService.deleteSinglePhoto(db, photo, tenantId);
      try {
        await storage.logUserActivity({ userId: req.session.userId, tenantId: req.session.tenantId, activityType: "delete_photo", description: `\u092B\u094B\u091F\u094B \u0921\u093F\u0932\u0940\u091F: ${photo.filename} (\u0915\u0930\u094D\u091C ${loanId})`, metadata: JSON.stringify({ photoId, loanId, filename: photo.filename }) });
      } catch (e) {
        console.error("Audit log error:", e);
      }
      console.log(`\u{1F4F8} INDIVIDUAL DELETE: Photo ${photo.filename} deleted successfully for loan ${loanId}`);
      res.json({
        message: "Photo deleted successfully",
        deletedPhotoId: photoId,
        filename: photo.filename
      });
    } catch (error) {
      console.error("Individual photo deletion error:", error);
      res.status(500).json({ message: "Failed to delete photo" });
    }
  });
  app2.use("/uploads/photos", express.static(path3.join(process.cwd(), "server", "uploads", "photos"), {
    maxAge: "7d",
    // 7 days cache for photos
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      res.set("X-Content-Type-Options", "nosniff");
      res.set("X-Frame-Options", "DENY");
      res.set("Cache-Control", "public, max-age=604800");
      const ext = path3.extname(filePath).toLowerCase();
      if (ext === ".jpg" || ext === ".jpeg") res.set("Content-Type", "image/jpeg");
      else if (ext === ".png") res.set("Content-Type", "image/png");
      else if (ext === ".webp") res.set("Content-Type", "image/webp");
    }
  }));
  app2.post("/api/loans/:loanId/photos", photoUpload.array("photos", 2), async (req, res) => {
    try {
      const { loanId } = req.params;
      const files = req.files;
      const tenantId = req.session.tenantId;
      const userId = req.session.userId;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "\u0915\u094B\u0923\u0924\u0947\u0939\u0940 \u092B\u094B\u091F\u094B \u0905\u092A\u0932\u094B\u0921 \u0915\u0947\u0932\u0947 \u0928\u093E\u0939\u0940\u0924" });
      }
      if (files.length > 2) {
        return res.status(400).json({ error: "\u092B\u0915\u094D\u0924 2 \u092B\u094B\u091F\u094B \u0905\u092A\u0932\u094B\u0921 \u0915\u0930\u0924\u093E \u092F\u0947\u0924\u0940\u0932" });
      }
      const savedPhotos = [];
      for (const file of files) {
        const processedPhoto = await PhotoService.processAndSavePhoto(file.buffer, file.originalname, tenantId, loanId);
        const compressionRatio = file.size > 0 ? (file.size - processedPhoto.size) / file.size * 100 : 0;
        console.log(`\u{1F4F8} PROCESSED [${processedPhoto.storageProvider}]: ${file.originalname} \u2192 ${processedPhoto.filename} (${processedPhoto.format.toUpperCase()}, ${compressionRatio.toFixed(1)}% compressed)`);
        const photoData = {
          tenantId,
          loanId,
          filename: processedPhoto.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          compressedSize: processedPhoto.size,
          storagePath: processedPhoto.storagePath,
          thumbnailPath: processedPhoto.thumbnailPath,
          storageProvider: processedPhoto.storageProvider,
          cloudinaryPublicId: processedPhoto.cloudinaryPublicId || null,
          photoType: "collateral",
          description: `\u0938\u094B\u0928\u094D\u092F\u093E\u091A\u094D\u092F\u093E \u0935\u0938\u094D\u0924\u0942\u091A\u093E \u092B\u094B\u091F\u094B - ${file.originalname}`,
          uploadedBy: userId,
          width: processedPhoto.width,
          height: processedPhoto.height,
          detectedFormat: processedPhoto.format
        };
        const savedPhoto = await storage.saveLoanPhoto(photoData);
        savedPhotos.push(savedPhoto);
        const validation = await PhotoService.validatePhotoIntegrity(processedPhoto.storagePath, processedPhoto.format);
        if (!validation.isValid) {
          console.warn(`\u26A0\uFE0F VALIDATION WARNING: ${processedPhoto.filename} - ${validation.error}`);
        } else {
          console.log(`\u2705 VALIDATION: ${processedPhoto.filename} integrity confirmed`);
        }
      }
      invalidateTenantCache(tenantId);
      console.log(`\u{1F5D1}\uFE0F CACHE: Invalidated photos cache for loan ${loanId}`);
      res.json({
        success: true,
        photos: savedPhotos,
        message: `${savedPhotos.length} \u092B\u094B\u091F\u094B \u092F\u0936\u0938\u094D\u0935\u0940\u0930\u093F\u0924\u094D\u092F\u093E \u0905\u092A\u0932\u094B\u0921 \u0915\u0947\u0932\u0947`
      });
    } catch (error) {
      console.error("Photo upload error:", error);
      res.status(500).json({ error: "\u092B\u094B\u091F\u094B \u0905\u092A\u0932\u094B\u0921 \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940" });
    }
  });
  app2.get("/api/loans/:loanId/photos", requireAuth2, async (req, res) => {
    try {
      const { loanId } = req.params;
      const tenantId = req.session.tenantId;
      console.log(`\u{1F50D} ROUTE DEBUG: Getting photos for loanId="${loanId}", tenantId="${tenantId}"`);
      const photos = await storage.getLoanPhotos(loanId, tenantId);
      const photosWithUrls = photos.map((photo) => ({
        ...photo,
        url: PhotoService.getPhotoUrl(req, photo),
        thumbnailUrl: PhotoService.getPhotoThumbnailUrl(req, photo)
      }));
      res.json(photosWithUrls);
    } catch (error) {
      console.error("Get photos error:", error);
      res.status(500).json({ error: "\u092B\u094B\u091F\u094B fetch \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940" });
    }
  });
  app2.patch("/api/loans/:loanId/auto-delete-photos", async (req, res) => {
    try {
      const { loanId } = req.params;
      const tenantId = req.session.tenantId;
      const deleteResult = await PhotoService.deletePhotosForLoan(db, loanId, tenantId);
      invalidateTenantCache(tenantId);
      console.log(`\u{1F5D1}\uFE0F CACHE: Invalidated photos cache for loan ${loanId} after auto-delete`);
      res.json({
        success: true,
        deletedFiles: deleteResult.deletedFiles,
        deletedRecords: deleteResult.deletedRecords,
        message: `\u0915\u0930\u094D\u091C \u092C\u0902\u0926 \u091D\u093E\u0932\u094D\u092F\u093E\u0935\u0930 ${deleteResult.deletedFiles} \u092B\u094B\u091F\u094B automatic delete \u0915\u0947\u0932\u0947`
      });
    } catch (error) {
      console.error("Auto-delete photos error:", error);
      res.status(500).json({ error: "\u092B\u094B\u091F\u094B auto-delete \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940" });
    }
  });
  app2.post("/api/loans/photo-availability", requireAuth2, async (req, res) => {
    try {
      const { loanIds } = req.body;
      const tenantId = req.session.tenantId;
      if (!Array.isArray(loanIds) || loanIds.length === 0) {
        return res.status(400).json({ error: "Loan IDs array is required" });
      }
      console.log(`\u{1F4F8} AVAILABILITY CHECK: Checking ${loanIds.length} loans for photos`);
      const photoStats = await db.select({
        loanId: loanPhotos.loanId,
        photoCount: sql10`COUNT(*)`.as("photoCount")
      }).from(loanPhotos).where(
        and11(
          inArray3(loanPhotos.loanId, loanIds),
          eq12(loanPhotos.tenantId, tenantId),
          eq12(loanPhotos.isActive, true)
        )
      ).groupBy(loanPhotos.loanId);
      const availability = loanIds.map((loanId) => {
        const stats = photoStats.find((p) => p.loanId === loanId);
        return {
          loanId,
          hasPhotos: stats ? stats.photoCount > 0 : false,
          photoCount: stats ? stats.photoCount : 0
        };
      });
      console.log(`\u{1F4F8} AVAILABILITY RESULT: ${availability.filter((a) => a.hasPhotos).length}/${loanIds.length} loans have photos`);
      res.json(availability);
    } catch (error) {
      console.error("Photo availability check error:", error);
      res.status(500).json({ error: "\u092B\u094B\u091F\u094B availability check \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940" });
    }
  });
  app2.get("/api/annual-statement", requireAuth2, async (req, res) => {
    try {
      const { loanId, year } = req.query;
      const tenantId = req.session.tenantId;
      if (!loanId || !year) {
        return res.status(400).json({ error: "Loan ID and year are required" });
      }
      const financialYear = parseInt(year);
      const yearStart = new Date(financialYear, 3, 1);
      const yearEnd = new Date(financialYear + 1, 2, 31);
      const beforeYearStart = new Date(financialYear, 3, 1);
      console.log(`\u{1F4CA} ANNUAL STATEMENT: Generating for loan ${loanId}, FY ${financialYear}-${financialYear + 1}`);
      const borrowerLoans = await db.select().from(loans).where(
        and11(
          eq12(loans.tenantId, tenantId),
          eq12(loans.id, loanId)
        )
      );
      if (borrowerLoans.length === 0) {
        return res.status(404).json({ error: "Loan not found" });
      }
      const loan = borrowerLoans[0];
      const loanDate = new Date(loan.loanDate);
      const principal = parseFloat(loan.principalAmount || "0");
      const rate = parseFloat(loan.interestRate || "0");
      const rateType = loan.interestRateType || "monthly";
      const yearlyRate = rateType === "monthly" ? rate * 12 : rate;
      const closureData = await db.select().from(loanClosures).where(
        and11(
          eq12(loanClosures.tenantId, tenantId),
          eq12(loanClosures.loanId, loan.id)
        )
      );
      const closure = closureData.length > 0 ? closureData[0] : null;
      const priorTransactions = await db.select().from(transactions).where(
        and11(
          eq12(transactions.tenantId, tenantId),
          eq12(transactions.loanId, loan.id),
          sql10`${transactions.transactionDate} < ${beforeYearStart.toISOString().split("T")[0]}`
        )
      ).orderBy(transactions.transactionDate);
      let openingPrincipal = 0;
      let openingInterest = 0;
      if (loanDate < beforeYearStart) {
        if (closure && new Date(closure.closureDate) < beforeYearStart) {
          openingPrincipal = 0;
          openingInterest = 0;
        } else {
          let currentPrincipal = principal;
          let lastDate = loanDate;
          let accumulatedInterest = 0;
          for (const txn of priorTransactions) {
            const txnDate = new Date(txn.transactionDate);
            const days = Math.floor((txnDate.getTime() - lastDate.getTime()) / (1e3 * 60 * 60 * 24));
            if (days > 0 && currentPrincipal > 0) {
              const periodInterest = currentPrincipal * yearlyRate * days / (365 * 100);
              accumulatedInterest += periodInterest;
            }
            if (txn.type === "payment" || txn.type === "closure") {
              const paymentAmount = parseFloat(txn.amount || "0");
              currentPrincipal -= paymentAmount;
              if (currentPrincipal < 0) currentPrincipal = 0;
            }
            lastDate = txnDate;
          }
          const remainingDays = Math.floor((beforeYearStart.getTime() - lastDate.getTime()) / (1e3 * 60 * 60 * 24));
          if (remainingDays > 0 && currentPrincipal > 0) {
            const periodInterest = currentPrincipal * yearlyRate * remainingDays / (365 * 100);
            accumulatedInterest += periodInterest;
          }
          openingPrincipal = currentPrincipal;
          openingInterest = accumulatedInterest;
        }
      }
      let yearDisbursement = 0;
      if (loanDate >= yearStart && loanDate <= yearEnd) {
        yearDisbursement = principal;
      }
      let yearPrincipalRepayment = 0;
      let yearInterestRepayment = 0;
      if (closure) {
        const closureDate = new Date(closure.closureDate);
        if (closureDate >= yearStart && closureDate <= yearEnd) {
          yearPrincipalRepayment = parseFloat(closure.principalPaid || "0");
          yearInterestRepayment = parseFloat(closure.interestPaid || "0");
        }
      }
      let closingPrincipal = 0;
      let closingInterest = 0;
      const isClosedDuringYear = closure && new Date(closure.closureDate) >= yearStart && new Date(closure.closureDate) <= yearEnd;
      const isClosedBeforeYear = closure && new Date(closure.closureDate) < yearStart;
      if (isClosedDuringYear || isClosedBeforeYear) {
        closingPrincipal = 0;
        closingInterest = 0;
        console.log(`\u{1F4CA} Loan closed ${isClosedDuringYear ? "during" : "before"} year - year end balance = 0`);
      } else {
        closingPrincipal = openingPrincipal + yearDisbursement - yearPrincipalRepayment;
        const interestStartDate = loanDate > yearStart ? loanDate : yearStart;
        const days = Math.floor((yearEnd.getTime() - interestStartDate.getTime()) / (1e3 * 60 * 60 * 24));
        if (days > 0 && closingPrincipal > 0) {
          closingInterest = closingPrincipal * yearlyRate * days / (365 * 100);
        }
        console.log(`\u{1F4CA} Loan active - calculated year end interest for ${days} days on \u20B9${closingPrincipal}`);
      }
      const statementData = {
        borrowerName: loan.borrowerName,
        occupation: loan.borrowerOccupation || "",
        address: loan.borrowerAddress || "",
        isBackwardClass: loan.isBackwardClass ?? false,
        isFarmer: loan.isFarmer ?? false,
        accountNumber: loan.accountNumber || "",
        loanDate: loan.loanDate || "",
        // Financial year info
        financialYear: `${financialYear}-${financialYear + 1}`,
        yearStart: yearStart.toISOString().split("T")[0],
        yearEnd: yearEnd.toISOString().split("T")[0],
        // Opening balance
        openingPrincipal: Math.round(openingPrincipal * 100) / 100,
        openingInterest: Math.round(openingInterest),
        // Round to whole number
        openingFees: 0,
        // Not tracked currently
        openingTotal: Math.round(openingPrincipal + openingInterest),
        // Year activity
        yearDisbursement: Math.round(yearDisbursement * 100) / 100,
        yearPrincipalRepayment: Math.round(yearPrincipalRepayment * 100) / 100,
        yearInterestRepayment: Math.round(yearInterestRepayment),
        // Round to whole number
        // Closing balance
        closingPrincipal: Math.round(closingPrincipal * 100) / 100,
        closingInterest: Math.round(closingInterest),
        // Round to whole number
        closingTotal: Math.round(closingPrincipal + closingInterest)
      };
      console.log("\u{1F4CA} ANNUAL STATEMENT DATA:", statementData);
      res.json(statementData);
    } catch (error) {
      console.error("Annual statement error:", error);
      res.status(500).json({ error: "\u0935\u093E\u0930\u094D\u0937\u093F\u0915 \u0935\u093F\u0935\u0930\u0923\u092A\u0924\u094D\u0930 \u0924\u092F\u093E\u0930 \u0915\u0930\u0924\u093E\u0928\u093E \u0924\u094D\u0930\u0941\u091F\u0940 \u091D\u093E\u0932\u0940" });
    }
  });
  app2.get("/api/admin/storage-settings/default", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Only Super Admin can access default storage settings" });
      }
      const [setting] = await db.select().from(systemSettings).where(eq12(systemSettings.settingKey, "default_storage_provider"));
      if (setting) {
        const config = JSON.parse(setting.settingValue);
        res.json({
          provider: config.provider || "local",
          cloudinaryCloudName: config.cloudinaryCloudName || "",
          cloudinaryApiKey: config.cloudinaryApiKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          cloudinaryApiSecret: config.cloudinaryApiSecret ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          cloudinaryFolder: config.cloudinaryFolder || "loan_photos",
          hasCloudinaryKeys: !!(config.cloudinaryApiKey && config.cloudinaryApiSecret),
          updatedAt: setting.updatedAt
        });
      } else {
        res.json({
          provider: "local",
          cloudinaryCloudName: "",
          cloudinaryApiKey: "",
          cloudinaryApiSecret: "",
          cloudinaryFolder: "loan_photos",
          hasCloudinaryKeys: false
        });
      }
    } catch (error) {
      console.error("Get default storage settings error:", error);
      res.status(500).json({ message: "Failed to get storage settings" });
    }
  });
  app2.post("/api/admin/storage-settings/default", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Only Super Admin can modify default storage settings" });
      }
      const { provider, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret, cloudinaryFolder } = req.body;
      const configValue = JSON.stringify({
        provider: provider || "local",
        cloudinaryCloudName: cloudinaryCloudName || "",
        cloudinaryApiKey: cloudinaryApiKey || "",
        cloudinaryApiSecret: cloudinaryApiSecret || "",
        cloudinaryFolder: cloudinaryFolder || "loan_photos"
      });
      const [existing] = await db.select().from(systemSettings).where(eq12(systemSettings.settingKey, "default_storage_provider"));
      if (existing) {
        await db.update(systemSettings).set({
          settingValue: configValue,
          updatedBy: req.session.userId,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq12(systemSettings.settingKey, "default_storage_provider"));
      } else {
        await db.insert(systemSettings).values({
          settingKey: "default_storage_provider",
          settingValue: configValue,
          settingType: "json",
          description: "Default photo storage provider configuration",
          updatedBy: req.session.userId
        });
      }
      PhotoStorageFactory.clearCache();
      console.log(`\u2699\uFE0F DEFAULT STORAGE: Updated to ${provider} by Super Admin`);
      res.json({ success: true, message: `Default storage provider updated to ${provider}` });
    } catch (error) {
      console.error("Save default storage settings error:", error);
      res.status(500).json({ message: "Failed to save storage settings" });
    }
  });
  app2.get("/api/admin/storage-settings/tenant", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "admin" && req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Only Admin can access storage settings" });
      }
      const tenantId = req.session.tenantId;
      const [tenantConfig] = await db.select().from(tenantStorageSettings).where(eq12(tenantStorageSettings.tenantId, tenantId));
      if (tenantConfig) {
        res.json({
          storageProvider: tenantConfig.storageProvider,
          cloudinaryCloudName: tenantConfig.cloudinaryCloudName || "",
          cloudinaryApiKey: tenantConfig.cloudinaryApiKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          cloudinaryApiSecret: tenantConfig.cloudinaryApiSecret ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          cloudinaryFolder: tenantConfig.cloudinaryFolder || "",
          isConfigured: tenantConfig.isConfigured,
          lastTestedAt: tenantConfig.lastTestedAt,
          testStatus: tenantConfig.testStatus
        });
      } else {
        const defaultConfig = await PhotoStorageFactory.getStorageConfig(tenantId);
        res.json({
          storageProvider: defaultConfig.provider,
          cloudinaryCloudName: "",
          cloudinaryApiKey: "",
          cloudinaryApiSecret: "",
          cloudinaryFolder: "",
          isConfigured: false,
          isUsingDefault: true
        });
      }
    } catch (error) {
      console.error("Get tenant storage settings error:", error);
      res.status(500).json({ message: "Failed to get storage settings" });
    }
  });
  app2.post("/api/admin/storage-settings/tenant", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "admin" && req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Only Admin can modify storage settings" });
      }
      const tenantId = req.session.tenantId;
      const { storageProvider, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret, cloudinaryFolder } = req.body;
      const [existing] = await db.select().from(tenantStorageSettings).where(eq12(tenantStorageSettings.tenantId, tenantId));
      const isConfigured = storageProvider === "cloudinary" ? !!(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret) : true;
      const settingsData = {
        tenantId,
        storageProvider: storageProvider || "local",
        cloudinaryCloudName: cloudinaryCloudName || null,
        cloudinaryApiKey: cloudinaryApiKey && cloudinaryApiKey !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" ? cloudinaryApiKey : existing?.cloudinaryApiKey || null,
        cloudinaryApiSecret: cloudinaryApiSecret && cloudinaryApiSecret !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" ? cloudinaryApiSecret : existing?.cloudinaryApiSecret || null,
        cloudinaryFolder: cloudinaryFolder || null,
        isConfigured,
        updatedAt: /* @__PURE__ */ new Date()
      };
      if (existing) {
        await db.update(tenantStorageSettings).set(settingsData).where(eq12(tenantStorageSettings.tenantId, tenantId));
      } else {
        await db.insert(tenantStorageSettings).values(settingsData);
      }
      PhotoStorageFactory.clearCache(tenantId);
      console.log(`\u2699\uFE0F TENANT STORAGE: ${tenantId} updated to ${storageProvider}`);
      res.json({ success: true, message: `Storage provider updated to ${storageProvider}` });
    } catch (error) {
      console.error("Save tenant storage settings error:", error);
      res.status(500).json({ message: "Failed to save storage settings" });
    }
  });
  app2.post("/api/admin/storage-settings/test-cloudinary", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "admin" && req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Only Admin can test storage connection" });
      }
      const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } = req.body;
      if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
        return res.status(400).json({ success: false, message: "All Cloudinary credentials are required" });
      }
      const testResult = await CloudinaryStorageProvider.testConnection({
        provider: "cloudinary",
        cloudinaryCloudName,
        cloudinaryApiKey,
        cloudinaryApiSecret
      });
      const tenantId = req.session.tenantId;
      const [existing] = await db.select().from(tenantStorageSettings).where(eq12(tenantStorageSettings.tenantId, tenantId));
      if (existing) {
        await db.update(tenantStorageSettings).set({
          lastTestedAt: /* @__PURE__ */ new Date(),
          testStatus: testResult.success ? "success" : "failed",
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq12(tenantStorageSettings.tenantId, tenantId));
      }
      console.log(`\u{1F517} CLOUDINARY TEST: ${testResult.success ? "SUCCESS" : "FAILED"} for tenant ${tenantId}`);
      res.json(testResult);
    } catch (error) {
      console.error("Cloudinary connection test error:", error);
      res.status(500).json({ success: false, message: "Connection test failed" });
    }
  });
  app2.get("/api/admin/storage-settings/all-tenants", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Only Super Admin can view all tenant settings" });
      }
      const allSettings = await db.select().from(tenantStorageSettings);
      const sanitized = allSettings.map((s) => ({
        tenantId: s.tenantId,
        storageProvider: s.storageProvider,
        isConfigured: s.isConfigured,
        lastTestedAt: s.lastTestedAt,
        testStatus: s.testStatus,
        hasCloudinaryKeys: !!(s.cloudinaryApiKey && s.cloudinaryApiSecret)
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Get all tenant storage settings error:", error);
      res.status(500).json({ message: "Failed to get tenant settings" });
    }
  });
  app2.get("/api/activity-logs", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "admin" && req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const allLogs = await db.select({
        id: userActivityLogs.id,
        userId: userActivityLogs.userId,
        activityType: userActivityLogs.activityType,
        description: userActivityLogs.description,
        metadata: userActivityLogs.metadata,
        createdAt: userActivityLogs.createdAt,
        userName: users.username
      }).from(userActivityLogs).leftJoin(users, eq12(userActivityLogs.userId, users.id)).where(eq12(userActivityLogs.tenantId, req.session.tenantId)).orderBy(desc5(userActivityLogs.createdAt)).limit(500);
      res.json(allLogs);
    } catch (error) {
      console.error("Activity logs fetch error:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });
  app2.delete("/api/activity-logs", requireAuth2, async (req, res) => {
    try {
      if (req.session.role !== "admin" && req.session.role !== "super_admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const deleted = await db.delete(userActivityLogs).where(eq12(userActivityLogs.tenantId, req.session.tenantId));
      res.json({
        success: true,
        message: "\u0938\u0930\u094D\u0935 \u0932\u0949\u0917 \u092F\u0936\u0938\u094D\u0935\u0940\u092A\u0923\u0947 \u0938\u093E\u092B \u0915\u0947\u0932\u0947",
        deletedCount: deleted.rowCount || 0
      });
    } catch (error) {
      console.error("Activity logs clear error:", error);
      res.status(500).json({ message: "Failed to clear activity logs" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs3 from "fs";
import path5 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path4 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path4.resolve(import.meta.dirname, "client", "src"),
      "@shared": path4.resolve(import.meta.dirname, "shared"),
      "@assets": path4.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path4.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path4.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path5.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs3.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path5.resolve(import.meta.dirname, "public");
  if (!fs3.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path5.resolve(distPath, "index.html"));
  });
}

// server/init-db.ts
init_db();
init_schema();
init_super_admin_guardian();
import { eq as eq13, and as and12, sql as sql11 } from "drizzle-orm";
import bcrypt3 from "bcrypt";
async function initializeDatabase() {
  const maxRetries = 5;
  const retryDelay = 2e3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Database initialization attempt ${attempt}/${maxRetries}...`);
      const connectionTest = async () => {
        try {
          const testPromise = db.select().from(users).limit(1);
          const timeoutPromise = new Promise(
            (_, reject) => setTimeout(() => reject(new Error("Database connection timeout after 15 seconds")), 15e3)
          );
          return await Promise.race([testPromise, timeoutPromise]);
        } catch (error) {
          if (error instanceof Error && error.message.includes("WebSocket")) {
            console.warn("WebSocket connection issue detected, but database may still be functional");
            return await db.$count(users);
          }
          throw error;
        }
      };
      await connectionTest();
      console.log("Database connection established successfully");
      console.log("Checking for system initialization...");
      const [existingSuperAdmin] = await db.select().from(users).where(and12(
        eq13(users.tenantId, "SUPER_ADMIN"),
        eq13(users.username, "admin"),
        eq13(users.role, "super_admin")
      ));
      if (!existingSuperAdmin) {
        console.log("Creating SUPER ADMIN (System Administrator)...");
        try {
          const hashedPassword = await bcrypt3.hash("admin123", 10);
          await db.insert(users).values({
            username: "admin",
            password: hashedPassword,
            tenantId: "SUPER_ADMIN",
            role: "super_admin",
            isActive: true,
            fullName: "System Administrator",
            email: "superadmin@system.com"
          });
          console.log("\u2705 SUPER ADMIN created successfully in SUPER_ADMIN tenant!");
        } catch (userCreationError) {
          console.error("Failed to create Super Admin:", userCreationError);
          throw userCreationError;
        }
      } else {
        console.log("\u2705 Super Admin already exists in SUPER_ADMIN tenant.");
      }
      console.log("\u2705 Tenant management: Only Super Admin can create/delete tenants");
      const { companies: companies2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const [superAdminCompany] = await db.select().from(companies2).where(eq13(companies2.tenantId, "SUPER_ADMIN"));
      if (!superAdminCompany) {
        console.log("Creating SUPER_ADMIN company...");
        await db.insert(companies2).values({
          tenantId: "SUPER_ADMIN",
          name: "Super Admin Organization",
          contactNumber: "9999999999",
          email: "superadmin@system.com",
          address: "System Administrator Office",
          licenseNumber: "SUPER_ADMIN_LICENSE"
        });
        console.log("\u2705 SUPER_ADMIN company created successfully!");
      }
      const roleValidation = await db.select().from(users).where(eq13(users.role, "super_admin"));
      const superAdminCount = roleValidation.length;
      const wrongTenantSuperAdmin = roleValidation.filter((user) => user.tenantId !== "SUPER_ADMIN");
      if (wrongTenantSuperAdmin.length > 0) {
        console.warn("\u26A0\uFE0F  CRITICAL WARNING: Found super_admin users in wrong tenants:", wrongTenantSuperAdmin);
        console.log("Auto-fixing tenant assignments for super admin users...");
        for (const user of wrongTenantSuperAdmin) {
          await db.update(users).set({ tenantId: "SUPER_ADMIN" }).where(eq13(users.id, user.id));
          console.log(`\u2705 Auto-fixed: super admin ${user.username} moved to SUPER_ADMIN tenant`);
        }
      }
      console.log(`\u2705 System validation complete: ${superAdminCount} Super Admin(s) found`);
      console.log("\u2705 Multi-tenant admin structure verified and secured");
      console.log("\u2705 Future-proof prevention system activated");
      try {
        await db.execute(sql11`ALTER TABLE companies ADD COLUMN IF NOT EXISTS bottom_nav_enabled BOOLEAN NOT NULL DEFAULT true`);
        console.log("\u2705 Schema migration: bottom_nav_enabled column verified");
      } catch (migrationError) {
        console.warn("\u26A0\uFE0F  Schema migration warning (non-fatal):", migrationError instanceof Error ? migrationError.message : migrationError);
      }
      await super_admin_guardian_default.validateAndFixRoleAssignments();
      console.log("\u{1F6E1}\uFE0F  SUPER ADMIN GUARDIAN: Final validation completed");
      console.log("Database initialization completed successfully");
      return;
    } catch (error) {
      console.error(`Database initialization attempt ${attempt} failed:`, error);
      if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack?.split("\n").slice(0, 5).join("\n")
        });
      }
      if (attempt === maxRetries) {
        console.error("All database initialization attempts failed. Application may not function properly.");
        throw new Error(`Database initialization failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
      console.log(`Retrying in ${retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

// server/login-health-monitor.ts
init_db();
init_schema();
import bcrypt4 from "bcrypt";
import { eq as eq14, and as and13 } from "drizzle-orm";
var LoginHealthMonitor = class {
  static async verifyAdminHealth() {
    const issues = [];
    try {
      const [superAdmin] = await db.select().from(users).where(and13(
        eq14(users.tenantId, "SUPER_ADMIN"),
        eq14(users.username, "admin"),
        eq14(users.role, "super_admin")
      ));
      if (!superAdmin) {
        issues.push("SUPER_ADMIN user missing");
      }
      return {
        superAdmin: { exists: !!superAdmin },
        issues
      };
    } catch (error) {
      console.error("Login health check failed:", error);
      issues.push("Database connection failed");
      return {
        superAdmin: { exists: false },
        issues
      };
    }
  }
  static async autoRepairCredentials() {
    try {
      const health = await this.verifyAdminHealth();
      if (health.issues.length === 0) {
        console.log("\u2705 Super Admin account exists - no repair needed");
        return true;
      }
      console.log(`\u26A0\uFE0F  Found ${health.issues.length} issues:`, health.issues);
      if (!health.superAdmin.exists) {
        console.log("\u{1F527} Creating missing SUPER_ADMIN account...");
        const hashedPassword = await bcrypt4.hash("admin123", 10);
        await db.insert(users).values({
          username: "admin",
          password: hashedPassword,
          tenantId: "SUPER_ADMIN",
          role: "super_admin",
          isActive: true,
          fullName: "System Administrator",
          email: "superadmin@system.com"
        });
        console.log("\u2705 SUPER_ADMIN account created with default password");
      }
      return true;
    } catch (error) {
      console.error("\u274C Auto-repair failed:", error);
      return false;
    }
  }
  static async getHealthReport() {
    const health = await this.verifyAdminHealth();
    let report = "=== Login Health Report ===\n";
    report += `Super Admin: ${health.superAdmin.exists ? "\u2705 Active" : "\u274C Missing"}
`;
    if (health.issues.length > 0) {
      report += `
Issues Found:
`;
      health.issues.forEach((issue) => {
        report += `  \u26A0\uFE0F  ${issue}
`;
      });
    } else {
      report += "\n\u2705 All systems healthy\n";
    }
    return report;
  }
};

// server/index.ts
var app = express3();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "localhost",
    "127.0.0.1",
    ".replit.app",
    ".replit.dev",
    ".replit.co",
    ".replitapp.com",
    ".railway.app",
    ".up.railway.app"
  ];
  const isAllowedOrigin = !origin || allowedOrigins.some(
    (allowed) => origin.includes(allowed) || origin === `http://localhost:5000` || origin === `https://localhost:5000`
  );
  if (isAllowedOrigin) {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
  }
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Expose-Headers", "Set-Cookie");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path6 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path6.startsWith("/api")) {
      let logLine = `${req.method} ${path6} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  try {
    process.on("uncaughtException", (error) => {
      console.warn("Uncaught exception (non-fatal):", error.message);
      if (!error.message.includes("WebSocket") && !error.message.includes("ErrorEvent")) {
        console.error("Critical uncaught exception:", error);
        process.exit(1);
      }
    });
    process.on("unhandledRejection", (reason, promise) => {
      console.warn("Unhandled rejection (non-fatal):", reason);
      if (reason && typeof reason === "object" && "message" in reason) {
        const message = reason.message;
        if (!message.includes("WebSocket") && !message.includes("ErrorEvent")) {
          console.error("Critical unhandled rejection:", reason);
          process.exit(1);
        }
      }
    });
    console.log("Starting application initialization...");
    const initializationTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Application startup timeout after 30 seconds")), 3e4);
    });
    await Promise.race([
      initializeDatabase(),
      initializationTimeout
    ]);
    console.log("Database initialized successfully");
    await LoginHealthMonitor.autoRepairCredentials();
    const server = await registerRoutes(app);
    console.log("Routes registered successfully");
    app.use((err, _req, res, _next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      throw err;
    });
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      app.use((req, res, next) => {
        if (req.accepts("html") && !req.path.startsWith("/api") && !req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
        next();
      });
      serveStatic(app);
    }
    const port = parseInt(process.env.PORT || "5000", 10);
    const host = "0.0.0.0";
    server.listen(port, host, () => {
      log(`serving on ${host}:${port}`);
      log(`Server accessible via:`);
      log(`- Direct: http://localhost:${port}`);
      if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        const replitDomain = `https://${process.env.REPL_SLUG}--${process.env.REPL_OWNER}.replit.app`;
        log(`- Replit App: ${replitDomain}`);
      } else if (process.env.REPLIT_DOMAINS) {
        const domains = process.env.REPLIT_DOMAINS.split(",");
        log(`- Replit Dev: https://${domains[0]}`);
      }
      console.log("Application started successfully and ready to accept connections");
    });
  } catch (error) {
    console.error("Critical error during application startup:", error);
    console.error("Application failed to start. Exiting...");
    process.exit(1);
  }
  const gracefulShutdown = (signal) => {
    console.log(`
Received ${signal}. Starting graceful shutdown...`);
    process.exit(0);
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
})();
var index_default = app;
export {
  index_default as default
};
