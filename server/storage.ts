import { 
  users, companies, groups, borrowers, loans, transactions, loanClosures,
  parties, cashTransactions, journalEntries, journalEntryLines, userPermissions, userActivityLogs,
  loanPhotos, passwordResetRequests,
  type User, type InsertUser,
  type Company, type InsertCompany,
  type Group, type InsertGroup,
  type Borrower, type InsertBorrower,
  type Loan, type InsertLoan,
  type Transaction, type InsertTransaction,
  type LoanClosure, type InsertLoanClosure,
  type Party, type InsertParty,
  type CashTransaction, type InsertCashTransaction,
  type JournalEntry, type InsertJournalEntry,
  type JournalEntryLine, type InsertJournalEntryLine,
  type UserPermissions, type InsertUserPermissions,
  type UserActivityLog, type InsertUserActivityLog,
  type LoanPhoto, type InsertLoanPhoto
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, gte, lte, sum, count, sql, like, not, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import { performanceCache, memoizedCalculations, cacheWarming } from "./performance-cache";
import { getNameTranslations, normalizeMarathiVowels } from "./name-translations";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByCredentials(tenantId: string, username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // User management operations
  getUsersForTenant(tenantId: string): Promise<(User & { permissions: UserPermissions | null; creator: User | null })[]>;
  createUserWithPermissions(user: InsertUser, permissions: InsertUserPermissions): Promise<User>;
  updateUserStatus(userId: string, tenantId: string, isActive: boolean, isTemporaryDisabled?: boolean): Promise<User | undefined>;
  updateUserPassword(userId: string, tenantId: string, newPassword: string): Promise<boolean>;
  
  // User permissions operations
  getUserPermissions(userId: string, tenantId: string): Promise<UserPermissions | undefined>;
  createUserPermissions(permissions: InsertUserPermissions): Promise<UserPermissions>;
  updateUserPermissions(userId: string, tenantId: string, permissions: Partial<InsertUserPermissions>): Promise<UserPermissions | undefined>;
  
  // User activity operations
  logUserActivity(activity: InsertUserActivityLog): Promise<UserActivityLog>;
  getUserActivityLogs(userId: string, tenantId: string, limit?: number): Promise<UserActivityLog[]>;
  updateUserLoginInfo(userId: string): Promise<void>;
  
  // Company operations
  getCompany(tenantId: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(tenantId: string, company: Partial<InsertCompany>): Promise<Company | undefined>;
  
  // Group operations
  getGroups(tenantId: string): Promise<Group[]>;
  createGroup(group: InsertGroup): Promise<Group>;
  updateGroup(id: string, tenantId: string, group: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: string, tenantId: string): Promise<boolean>;
  
  
  // Loan operations
  getLoans(tenantId: string, filters?: { groupId?: string; borrowerId?: string; status?: string }): Promise<(Loan & { borrower: Borrower | null; group: Group })[]>;
  createLoan(loan: InsertLoan): Promise<Loan>;
  updateLoan(id: string, tenantId: string, loan: Partial<InsertLoan>): Promise<Loan | undefined>;
  deleteLoan(id: string, tenantId: string): Promise<boolean>;
  
  // Transaction operations
  getTransactions(tenantId: string, loanId?: string, dateFrom?: string, dateTo?: string): Promise<(Transaction & { loan: Loan & { borrower: Borrower | null; group: Group } })[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  
  // Loan closure operations
  createLoanClosure(closure: InsertLoanClosure): Promise<LoanClosure>;
  getAllLoanClosures(tenantId: string): Promise<LoanClosure[]>;
  getLoanClosures(tenantId: string, loanId?: string): Promise<LoanClosure[]>;
  deleteLoanClosure(id: string, tenantId: string): Promise<boolean>;
  
  // Dashboard statistics
  getDashboardStats(tenantId: string): Promise<{
    totalDisbursed: number;
    totalRepaid: number;
    outstanding: number;
    activeBorrowers: number;
  }>;
  
  // Reports
  getCashBookReport(tenantId: string, dateFrom: string, dateTo: string): Promise<any[]>;
  getCapitalAccountReport(tenantId: string, dateFrom: string, dateTo: string): Promise<any[]>;
  getLoanLedger(tenantId: string, loanId: string): Promise<any>;
  
  // Party operations
  getParties(tenantId: string, search?: string): Promise<Party[]>;
  createParty(party: InsertParty): Promise<Party>;
  updateParty(id: string, tenantId: string, party: Partial<InsertParty>): Promise<Party | undefined>;
  deleteParty(id: string, tenantId: string): Promise<boolean>;
  
  // Cash transaction operations
  getCashTransactions(tenantId: string, filters?: { dateFrom?: string; dateTo?: string; partyId?: string; transactionType?: string }): Promise<(CashTransaction & { party: Party | null })[]>;
  createCashTransaction(transaction: InsertCashTransaction): Promise<CashTransaction>;
  updateCashTransaction(id: string, tenantId: string, transaction: Partial<InsertCashTransaction>): Promise<CashTransaction | undefined>;
  deleteCashTransaction(id: string, tenantId: string): Promise<boolean>;
  getCashBalance(tenantId: string): Promise<number>;
  getCashBalanceBeforeDate(tenantId: string, beforeDate: string): Promise<number>;
  getDateWiseCashBalance(tenantId: string, forDate: string): Promise<{
    openingBalance: number;
    closingBalance: number;
    dayTransactions: { cashIn: number; cashOut: number; netDifference: number };
    totalBalance: number;
  }>;

  // Mobile cashbook balance methods
  getMobileCashbookDailyBalance(tenantId: string, forDate: string): Promise<any>;
  getMobileCashbookUniversalBalance(tenantId: string, startDate: string, endDate: string, viewPeriod: string): Promise<any>;
  
  // Account-to-Account transfer
  createAccountTransfer(tenantId: string, data: { fromPartyId: string; toPartyId: string; amount: string; transactionDate: string; narration: string; category?: string }): Promise<{ cashInTransaction: CashTransaction; cashOutTransaction: CashTransaction }>;
  
  // Dual-entry accounting operations
  createCashTransactionWithJournal(transaction: InsertCashTransaction): Promise<{cashTransaction: CashTransaction, journalEntry: JournalEntry}>;
  getJournalEntries(tenantId: string, filters?: { dateFrom?: string; dateTo?: string; sourceType?: string }): Promise<(JournalEntry & { lines: JournalEntryLine[] })[]>;
  getPartyLedger(tenantId: string, partyId: string, dateFrom?: string, dateTo?: string): Promise<any[]>;
  getTrialBalance(tenantId: string, asOfDate?: string): Promise<any[]>;
  getBalanceSheet(tenantId: string, asOfDate: string, fyStartDate: string): Promise<any>;
  getProfitLoss(tenantId: string, dateFrom: string, dateTo: string): Promise<any>;
  getProfessionalCashBalance(tenantId: string): Promise<{
    currentBalance: number;
    openingBalance: number;
    totalCashIn: number;
    totalCashOut: number;
    totalLoanDisbursements: number;
    totalLoanClosures: number;
    transactionCount: number;
    lastUpdated: Date;
    isValid: boolean;
    errors: string[];
  }>;
  
  // Data Management operations
  getUsers(tenantId: string): Promise<User[]>;
  getCompanies(tenantId: string): Promise<Company[]>;
  restoreFromBackup(tenantId: string, backupData: any): Promise<void>;
  deleteAllTenantData(tenantId: string): Promise<void>;
  deleteClosedLoansBeforeDate(tenantId: string, beforeDate: string): Promise<{
    deletedLoans: number;
    deletedTransactions: number;
    deletedCashEntries: number;
  }>;

  // Super Admin operations
  getAllSystemUsers(): Promise<User[]>;
  getAllSystemTenants(): Promise<{ tenantId: string; companyName: string; adminCount: number; userCount: number; totalLoans: number }[]>;
  getUsersByTenant(tenantId: string): Promise<User[]>;
  getUserById(userId: string): Promise<User | undefined>;
  findUserByTenantAndUsername(tenantId: string, username: string): Promise<User | undefined>;
  
  // Tenant management
  toggleTenantActive(tenantId: string, isActive: boolean): Promise<void>;
  getAllTenantsForManagement(): Promise<any[]>;
  
  // Password reset requests
  createPasswordResetRequest(data: { tenantId: string; username: string; adminId?: string; userRole?: string; reason?: string }): Promise<any>;
  getPendingPasswordResetRequests(): Promise<any[]>;
  getPasswordResetRequestById(requestId: string): Promise<any>;
  completePasswordResetRequest(requestId: string, completedBy: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByCredentials(tenantId: string, username: string): Promise<User | undefined> {
    // TRIM whitespace to fix space character issues
    const cleanTenantId = tenantId.trim();
    const cleanUsername = username.trim();
    
    
    try {
      const [user] = await db.select().from(users)
        .where(and(eq(users.tenantId, cleanTenantId), eq(users.username, cleanUsername), eq(users.isActive, true)));
      
      if (!user) {
        // Debug: Check what users actually exist
        const allUsers = await db.select({ 
          username: users.username, 
          tenantId: users.tenantId, 
          isActive: users.isActive 
        }).from(users);
      }
      
      return user || undefined;
    } catch (error) {
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const [newUser] = await db
      .insert(users)
      .values({ ...user, password: hashedPassword })
      .returning();
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    // WARNING: This function returns ALL users across ALL tenants
    // Only use for super admin operations with proper authorization
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    // WARNING: This function updates users without tenant_id check
    // Only use for super admin operations or password changes with proper authorization
    const [updatedUser] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      await db.transaction(async (tx) => {
        // First delete user permissions (references user)
        await tx.delete(userPermissions).where(eq(userPermissions.userId, id));
        
        // Delete user activity logs (references user)
        await tx.delete(userActivityLogs).where(eq(userActivityLogs.userId, id));
        
        // Finally delete the user
        const [deletedUser] = await tx
          .delete(users)
          .where(eq(users.id, id))
          .returning();
          
        if (!deletedUser) {
          throw new Error('User not found');
        }
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async getCompany(tenantId: string): Promise<Company | undefined> {
    // 🚀 PERFORMANCE: Check cache first
    const cacheKey = `company:${tenantId}`;
    const cached = performanceCache.getQuery<Company>(cacheKey);
    if (cached) {
      return cached;
    }

    const [company] = await db.select().from(companies).where(eq(companies.tenantId, tenantId));
    
    if (company) {
      // Cache for 10 minutes - company data rarely changes
      performanceCache.setQuery(cacheKey, company, 600);
    }
    return company || undefined;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    try {
      const [newCompany] = await db
        .insert(companies)
        .values(company)
        .returning();
      return newCompany;
    } catch (error) {
      throw error;
    }
  }

  async updateCompany(tenantId: string, company: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updatedCompany] = await db
      .update(companies)
      .set({ ...company, updatedAt: new Date() })
      .where(eq(companies.tenantId, tenantId))
      .returning();
    performanceCache.invalidatePattern(`company:${tenantId}`);
    return updatedCompany || undefined;
  }

  async getGroups(tenantId: string): Promise<Group[]> {
    // 🚀 PERFORMANCE: Check cache first
    const cacheKey = `groups:${tenantId}`;
    const cached = performanceCache.getQuery<Group[]>(cacheKey);
    if (cached) {

      return cached;
    }


    const result = await db.select().from(groups)
      .where(and(eq(groups.tenantId, tenantId), eq(groups.isActive, true)))
      .orderBy(asc(groups.name));
    
    // Cache for 5 minutes
    performanceCache.setQuery(cacheKey, result, 300);
    return result;
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    // Check for duplicate group name within the same tenant (case-insensitive)
    const existingGroup = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(and(
        eq(groups.tenantId, group.tenantId),
        sql`LOWER(${groups.name}) = LOWER(${group.name})`
      ))
      .limit(1);

    if (existingGroup.length > 0) {
      throw new Error(`ग्रुप नाव "${group.name}" आधीच अस्तित्वात आहे. कृपया वेगळे नाव निवडा. / Group name "${group.name}" already exists. Please choose a different name.`);
    }

    const [newGroup] = await db
      .insert(groups)
      .values(group)
      .returning();
    return newGroup;
  }

  async updateGroup(id: string, tenantId: string, group: Partial<InsertGroup>): Promise<Group | undefined> {
    // Check for duplicate group name if name is being updated
    if (group.name) {
      const existingGroup = await db
        .select({ id: groups.id, name: groups.name })
        .from(groups)
        .where(and(
          eq(groups.tenantId, tenantId),
          sql`LOWER(${groups.name}) = LOWER(${group.name})`,
          not(eq(groups.id, id)) // Exclude current group from check
        ))
        .limit(1);

      if (existingGroup.length > 0) {
        throw new Error(`ग्रुप नाव "${group.name}" आधीच अस्तित्वात आहे. कृपया वेगळे नाव निवडा. / Group name "${group.name}" already exists. Please choose a different name.`);
      }
    }

    const [updatedGroup] = await db
      .update(groups)
      .set({ ...group, updatedAt: new Date() })
      .where(and(eq(groups.id, id), eq(groups.tenantId, tenantId)))
      .returning();
    return updatedGroup || undefined;
  }

  async deleteGroup(id: string, tenantId: string): Promise<boolean> {
    const [updatedGroup] = await db
      .update(groups)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(groups.id, id), eq(groups.tenantId, tenantId)))
      .returning();
    return !!updatedGroup;
  }


  async getLoans(tenantId: string, filters?: { groupId?: string; borrowerId?: string; status?: string }): Promise<(Loan & { borrower: Borrower | null; group: Group })[]> {
    // 🚀 PERFORMANCE: Cache key with filters
    const cacheKey = `loans:${tenantId}:${JSON.stringify(filters || {})}`;
    const cached = performanceCache.getQuery<(Loan & { borrower: Borrower | null; group: Group })[]>(cacheKey);
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
      borrower: sql`CASE WHEN ${borrowers.id} IS NOT NULL THEN json_build_object(
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
      ) ELSE NULL END`.as('borrower'),
      group: sql`json_build_object(
        'id', ${groups.id},
        'tenantId', ${groups.tenantId},
        'name', ${groups.name},
        'description', ${groups.description},
        'isActive', ${groups.isActive},
        'createdAt', ${groups.createdAt},
        'updatedAt', ${groups.updatedAt}
      )`.as('group'),
    })
    .from(loans)
    .leftJoin(borrowers, eq(loans.borrowerId, borrowers.id))
    .leftJoin(loanClosures, eq(loans.id, loanClosures.loanId))
    .innerJoin(groups, eq(loans.groupId, groups.id))
    .where(and(...conditions));

    const result = await query.orderBy(desc(loans.createdAt)) as any;
    
    // 🚀 PERFORMANCE: Cache for 2 minutes - loans data changes frequently
    performanceCache.setQuery(cacheKey, result, 120);
    return result;
  }

  async createLoan(loan: InsertLoan): Promise<Loan> {
    // Create loan without requiring borrowerId
    const [newLoan] = await db
      .insert(loans)
      .values({
        ...loan,
        borrowerId: loan.borrowerId || null,
        // Ensure proper type conversion for decimal fields
        principalAmount: loan.principalAmount ? String(loan.principalAmount) : "0",
        interestRate: loan.interestRate ? String(loan.interestRate) : "0",
        marketValue: loan.marketValue ? String(loan.marketValue) : null
      })
      .returning();

    // CRITICAL FIX: Removed automatic cash transaction creation here
    // Cash transactions will be created only via cash-sync.ts to prevent duplicates
    
    // 🚀 PERFORMANCE: Invalidate related caches
    performanceCache.invalidatePattern(`loans:${loan.tenantId}`);
    performanceCache.invalidatePattern(`borrowers:${loan.tenantId}`);
    
    return newLoan;
  }

  async updateLoan(id: string, tenantId: string, loan: Partial<InsertLoan>): Promise<Loan | undefined> {
    const updateData = {
      ...loan,
      updatedAt: new Date(),
      // Ensure proper type conversion for decimal fields
      principalAmount: loan.principalAmount ? String(loan.principalAmount) : undefined,
      interestRate: loan.interestRate ? String(loan.interestRate) : undefined,
      marketValue: loan.marketValue ? String(loan.marketValue) : undefined
    };
    
    const [updatedLoan] = await db
      .update(loans)
      .set(updateData)
      .where(and(eq(loans.id, id), eq(loans.tenantId, tenantId)))
      .returning();
    
    // 🚀 PERFORMANCE: Invalidate related caches
    if (updatedLoan) {
      performanceCache.invalidatePattern(`loans:${tenantId}`);
    }
    
    return updatedLoan || undefined;
  }

  async getLoanById(id: string, tenantId: string): Promise<any | undefined> {
    const [loanWithDetails] = await db
      .select({
        id: loans.id,
        accountNumber: loans.accountNumber,
        borrowerName: loans.borrowerName,
        principalAmount: loans.principalAmount,
        interestRate: loans.interestRate,
        interestRateType: loans.interestRateType,
        loanDate: loans.loanDate,
        groupId: loans.groupId,
        groupName: groups.name
      })
      .from(loans)
      .leftJoin(groups, eq(loans.groupId, groups.id))
      .where(and(eq(loans.id, id), eq(loans.tenantId, tenantId)))
      .limit(1);
    
    return loanWithDetails || undefined;
  }

  async deleteLoan(id: string, tenantId: string): Promise<boolean> {
    const [loanToDelete] = await db
      .select()
      .from(loans)
      .where(and(eq(loans.id, id), eq(loans.tenantId, tenantId)));

    if (loanToDelete) {
      // NOTE: cashbook (loan_disbursement) deletion is handled by handleLoanDeletion in the sync engine
      // (called via triggerLoanSync before this function). Do NOT duplicate deletion here — causes double deletion.
      // Only do structural DB cleanup here: closures + journal transactions.

      await db
        .delete(loanClosures)
        .where(and(
          eq(loanClosures.tenantId, tenantId),
          eq(loanClosures.loanId, id)
        ));

      await db
        .delete(transactions)
        .where(and(
          eq(transactions.tenantId, tenantId),
          eq(transactions.loanId, id)
        ));
    }

    const result = await db
      .delete(loans)
      .where(and(eq(loans.id, id), eq(loans.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  async getTransactions(tenantId: string, loanId?: string, dateFrom?: string, dateTo?: string): Promise<(Transaction & { loan: Loan & { borrower: Borrower | null; group: Group } })[]> {
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
        borrower: sql`CASE WHEN ${borrowers.id} IS NOT NULL THEN json_build_object(
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
        ) ELSE NULL END`.as('borrower'),
        group: sql`json_build_object(
          'id', ${groups.id},
          'tenantId', ${groups.tenantId},
          'name', ${groups.name},
          'description', ${groups.description},
          'isActive', ${groups.isActive},
          'createdAt', ${groups.createdAt},
          'updatedAt', ${groups.updatedAt}
        )`.as('group'),
      }
    })
    .from(transactions)
    .innerJoin(loans, eq(transactions.loanId, loans.id))
    .leftJoin(borrowers, eq(loans.borrowerId, borrowers.id))
    .innerJoin(groups, eq(loans.groupId, groups.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.transactionDate));

    return results as any;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async createLoanClosure(closure: InsertLoanClosure): Promise<LoanClosure> {
    // 🔒 CRITICAL DUPLICATE PREVENTION: Check if loan is already closed
    const existingClosure = await db
      .select({ id: loanClosures.id })
      .from(loanClosures)
      .where(and(
        eq(loanClosures.loanId, closure.loanId),
        eq(loanClosures.tenantId, closure.tenantId)
      ))
      .limit(1);

    if (existingClosure.length > 0) {
      throw new Error(`Loan already closed. Cannot create duplicate closure for loan ID: ${closure.loanId}`);
    }

    // 🔒 SECONDARY CHECK: Verify loan status in loans table
    const [loanStatus] = await db
      .select({ status: loans.status })
      .from(loans)
      .where(and(
        eq(loans.id, closure.loanId),
        eq(loans.tenantId, closure.tenantId)
      ));

    if (!loanStatus) {
      throw new Error(`Loan not found: ${closure.loanId}`);
    }

    if (loanStatus.status === 'closed') {
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
    
    const [newClosure] = await db
      .insert(loanClosures)
      .values(closureData)
      .returning();

    // Get loan details with group name for cash transaction and update loan status
    const [loanDetails] = await db
      .select({
        id: loans.id,
        accountNumber: loans.accountNumber,
        borrowerName: loans.borrowerName,
        principalAmount: loans.principalAmount,
        groupId: loans.groupId,
        groupName: groups.name
      })
      .from(loans)
      .leftJoin(groups, eq(loans.groupId, groups.id))
      .where(eq(loans.id, closure.loanId));
    
    if (loanDetails) {
      // Update loan status to closed
      await db.update(loans).set({ 
        status: 'closed',
        updatedAt: new Date(),
      }).where(eq(loans.id, closure.loanId));

      // CENTRALIZED NARRATION ENGINE: Single source of truth for all narrations
      try {
        // Use centralized NarrationEngine to prevent different formats
        const { NarrationEngine } = await import('./narration-engine');
        const standardizedNarration = NarrationEngine.createLoanClosureNarration(
          loanDetails.accountNumber,
          loanDetails.borrowerName,
          Number(closure.principalPaid),
          Number(closure.interestPaid),
          loanDetails.groupName || undefined
        );
        
        // ENHANCED DUPLICATE PREVENTION: Multiple checks to prevent any cash transaction duplication
        const existingCashEntries = await db.select()
          .from(cashTransactions)
          .where(and(
            eq(cashTransactions.tenantId, closure.tenantId),
            eq(cashTransactions.transactionDate, closure.closureDate),
            or(
              // Check by account number pattern
              sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${loanDetails.accountNumber}%`}`,
              // Check by borrower name pattern  
              sql`${cashTransactions.narration} LIKE ${`%${loanDetails.borrowerName}%`}`,
              // Check by exact amount match
              sql`ABS(${cashTransactions.amount} - ${closure.totalAmount}) < 0.01`
            )
          ));

        // ADDITIONAL TIME-BASED CHECK: Prevent rapid duplicate creation (within 10 minutes)
        const recentEntries = await db.select()
          .from(cashTransactions)
          .where(and(
            eq(cashTransactions.tenantId, closure.tenantId),
            eq(cashTransactions.transactionType, 'cash_in'),
            sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${loanDetails.accountNumber}%`}`,
            sql`${cashTransactions.createdAt} > NOW() - INTERVAL '10 minutes'`
          ));
          

        // 🚫 PERMANENT FIX: First delete ALL manual entries (income/capital) that match this closure
        const manualEntriesToDelete = existingCashEntries.filter(entry => 
          (entry.isSystemGenerated === false) && 
          (entry.category === 'income' || entry.category === 'capital')
        );
        
        if (manualEntriesToDelete.length > 0) {
          for (const manualEntry of manualEntriesToDelete) {
            await db.delete(cashTransactions).where(eq(cashTransactions.id, manualEntry.id));
          }
        }
        
        // Also delete recent manual entries within 10 minutes
        const recentManualEntries = recentEntries.filter(entry => 
          (entry.isSystemGenerated === false) && 
          (entry.category === 'income' || entry.category === 'capital')
        );
        
        if (recentManualEntries.length > 0) {
          for (const recentManual of recentManualEntries) {
            await db.delete(cashTransactions).where(eq(cashTransactions.id, recentManual.id));
          }
        }
        
        // Now check for system-generated entries only
        const systemGeneratedExistingEntries = existingCashEntries.filter(entry => 
          entry.isSystemGenerated === true && entry.category === 'loan_repayment'
        );
        
        const systemGeneratedRecentEntries = recentEntries.filter(entry => 
          entry.isSystemGenerated === true && entry.category === 'loan_repayment'
        );
        
        if (systemGeneratedExistingEntries.length === 0 && systemGeneratedRecentEntries.length === 0) {
          await db.insert(cashTransactions).values({
            tenantId: closure.tenantId,
            transactionDate: closure.closureDate,
            transactionType: 'cash_in',
            amount: closure.totalAmount.toString(),
            category: 'loan_repayment',
            narration: standardizedNarration,
            isSystemGenerated: true,  // System generated - only editable through proper closure forms
            loanId: closure.loanId    // Link to loan UUID — enables reliable reopen/delete sync
          });
        } else {
        }
      } catch (error) {
        throw error; // Re-throw to ensure closure fails if cash sync fails
      }
    }
      
    return newClosure;
  }

  async getAllLoanClosures(tenantId: string): Promise<LoanClosure[]> {
    return await db
      .select()
      .from(loanClosures)
      .where(eq(loanClosures.tenantId, tenantId))
      .orderBy(desc(loanClosures.closureDate));
  }

  async getLoanClosures(tenantId: string, loanId?: string): Promise<LoanClosure[]> {
    const conditions = [eq(loanClosures.tenantId, tenantId)];
    if (loanId) {
      conditions.push(eq(loanClosures.loanId, loanId));
    }
    
    const query = db.select().from(loanClosures).where(and(...conditions));

    return await query.orderBy(desc(loanClosures.closureDate));
  }

  async deleteLoanClosure(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(loanClosures)
      .where(and(eq(loanClosures.id, id), eq(loanClosures.tenantId, tenantId)));
    return result.rowCount! > 0;
  }

  async getDashboardStats(tenantId: string): Promise<any> {
    
    // Current month dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    // Previous month dates  
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const currentDate = new Date();
    const threeMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

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
      threeMonthCashStats,
    ] = await Promise.all([
      db.select({ count: count(), totalAmount: sum(loans.principalAmount) })
        .from(loans)
        .where(and(eq(loans.tenantId, tenantId), gte(loans.loanDate, currentMonthStart), lte(loans.loanDate, currentMonthEnd))),
      db.select({ count: count(), totalAmount: sum(loans.principalAmount) })
        .from(loans)
        .where(and(eq(loans.tenantId, tenantId), gte(loans.loanDate, prevMonthStart), lte(loans.loanDate, prevMonthEnd))),
      db.select({ count: count(), totalAmount: sum(loanClosures.totalAmount) })
        .from(loanClosures)
        .where(and(eq(loanClosures.tenantId, tenantId), gte(loanClosures.closureDate, currentMonthStart), lte(loanClosures.closureDate, currentMonthEnd))),
      db.select({ count: count(), totalAmount: sum(loanClosures.totalAmount) })
        .from(loanClosures)
        .where(and(eq(loanClosures.tenantId, tenantId), gte(loanClosures.closureDate, prevMonthStart), lte(loanClosures.closureDate, prevMonthEnd))),
      db.select({
        count: count(),
        totalIn: sum(sql`CASE WHEN ${cashTransactions.transactionType} = 'cash_in' THEN ${cashTransactions.amount} ELSE 0 END`),
        totalOut: sum(sql`CASE WHEN ${cashTransactions.transactionType} = 'cash_out' THEN ${cashTransactions.amount} ELSE 0 END`)
      }).from(cashTransactions)
        .where(and(eq(cashTransactions.tenantId, tenantId), gte(cashTransactions.transactionDate, currentMonthStart), lte(cashTransactions.transactionDate, currentMonthEnd))),
      db.select({
        count: count(),
        totalIn: sum(sql`CASE WHEN ${cashTransactions.transactionType} = 'cash_in' THEN ${cashTransactions.amount} ELSE 0 END`),
        totalOut: sum(sql`CASE WHEN ${cashTransactions.transactionType} = 'cash_out' THEN ${cashTransactions.amount} ELSE 0 END`)
      }).from(cashTransactions)
        .where(and(eq(cashTransactions.tenantId, tenantId), gte(cashTransactions.transactionDate, prevMonthStart), lte(cashTransactions.transactionDate, prevMonthEnd))),
      db.select({ total: sum(loans.principalAmount), count: count() })
        .from(loans)
        .where(and(eq(loans.tenantId, tenantId), eq(loans.status, "active"))),
      db.select({ total: sum(loans.principalAmount) })
        .from(loans)
        .where(and(eq(loans.tenantId, tenantId), eq(loans.status, "closed"))),
      db.selectDistinct({ borrowerId: loans.borrowerId })
        .from(loans)
        .where(and(eq(loans.tenantId, tenantId), eq(loans.status, "active"))),
      db.select({ count: count(), totalAmount: sum(loans.principalAmount) })
        .from(loans)
        .where(and(eq(loans.tenantId, tenantId), gte(loans.loanDate, threeMonthsAgoStr), lte(loans.loanDate, currentMonthEnd))),
      db.select({ count: count(), totalAmount: sum(loanClosures.actualPaidAmount) })
        .from(loanClosures)
        .where(and(eq(loanClosures.tenantId, tenantId), gte(loanClosures.closureDate, threeMonthsAgoStr), lte(loanClosures.closureDate, currentMonthEnd))),
      db.select({
        count: count(),
        totalIn: sum(sql`CASE WHEN ${cashTransactions.transactionType} = 'cash_in' THEN ${cashTransactions.amount} ELSE 0 END`),
        totalOut: sum(sql`CASE WHEN ${cashTransactions.transactionType} = 'cash_out' THEN ${cashTransactions.amount} ELSE 0 END`)
      }).from(cashTransactions)
        .where(and(eq(cashTransactions.tenantId, tenantId), gte(cashTransactions.transactionDate, threeMonthsAgoStr), lte(cashTransactions.transactionDate, currentMonthEnd))),
    ]);

    const totalDisbursed = Number(activeLoans[0]?.total || 0) + Number(closedLoans[0]?.total || 0);
    const totalRepaid = Number(closedLoans[0]?.total || 0);
    const outstanding = Number(activeLoans[0]?.total || 0);
    const activeBorrowers = borrowersResult.length;

    // Calculate three month performance data
    const threeMonthDisbursementCount = Number(threeMonthDisbursements[0]?.count || 0);
    const threeMonthClosureCount = Number(threeMonthClosures[0]?.count || 0);
    const threeMonthTotalAmount = Number(threeMonthCashStats[0]?.totalIn || 0) + Number(threeMonthCashStats[0]?.totalOut || 0);
    const threeMonthSuccessRate = threeMonthDisbursementCount > 0 ? Math.round((threeMonthClosureCount / threeMonthDisbursementCount) * 100) : 0;

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

  async getCashBookReport(tenantId: string, dateFrom: string, dateTo: string): Promise<any[]> {
    // Get cash transactions instead of loan transactions for cash book
    const conditions = [eq(cashTransactions.tenantId, tenantId)];
    
    if (dateFrom) {
      conditions.push(gte(cashTransactions.transactionDate, dateFrom));
    }
    
    if (dateTo) {
      conditions.push(lte(cashTransactions.transactionDate, dateTo));
    }
    
    const transactions = await db.select({
      id: cashTransactions.id,
      transactionDate: cashTransactions.transactionDate,
      transactionType: cashTransactions.transactionType,
      amount: cashTransactions.amount,
      narration: cashTransactions.narration,
      partyName: parties.name,
      // loanId: cashTransactions.loanId, // Remove this field as it doesn't exist in schema
    })
    .from(cashTransactions)
    .leftJoin(parties, eq(cashTransactions.partyId, parties.id))
    .where(and(...conditions))
    .orderBy(asc(cashTransactions.transactionDate));
    
    return transactions;
  }

  async getCapitalAccountReport(tenantId: string, dateFrom: string, dateTo: string): Promise<any[]> {
    return await this.getTransactions(tenantId, undefined, dateFrom, dateTo);
  }

  async getLoanLedger(tenantId: string, loanId: string): Promise<any> {
    const loanTransactions = await this.getTransactions(tenantId, loanId);
    return loanTransactions;
  }
  
  // Party operations implementation
  async getParties(tenantId: string, search?: string): Promise<Party[]> {
    const conditions = [eq(parties.tenantId, tenantId)];
    
    if (search) {
      conditions.push(sql`(${parties.name} ILIKE ${`%${search}%`} OR ${parties.mobile} ILIKE ${`%${search}%`})`);
    }
    
    return await db.select()
      .from(parties)
      .where(and(...conditions))
      .orderBy(asc(parties.name));
  }
  
  async createParty(party: InsertParty): Promise<Party> {
    // Prepare party data with proper type conversion for opening balance
    const partyData = {
      ...party,
      openingBalance: party.openingBalance ? party.openingBalance.toString() : "0",
      openingBalanceType: party.openingBalanceType || "credit",
      openingBalanceDate: party.openingBalanceDate || new Date().toISOString().split('T')[0],
      openingBalanceNarration: party.openingBalanceNarration || "Opening Balance"
    };
    
    const [newParty] = await db.insert(parties).values(partyData).returning();
    return newParty;
  }
  
  async updateParty(id: string, tenantId: string, party: Partial<InsertParty>): Promise<Party | undefined> {
    // Prepare party update data with proper type conversion
    const updateData: any = {
      ...party,
      updatedAt: new Date()
    };
    
    // Convert opening balance to string if provided
    if (party.openingBalance !== undefined) {
      updateData.openingBalance = party.openingBalance.toString();
    }
    
    const [updatedParty] = await db
      .update(parties)
      .set(updateData)
      .where(and(eq(parties.id, id), eq(parties.tenantId, tenantId)))
      .returning();
    return updatedParty || undefined;
  }

  async deleteParty(id: string, tenantId: string): Promise<boolean> {
    try {
      console.log(`Storage: Checking party deletion for id=${id}, tenantId=${tenantId}`);
      
      // Check if party has any related cash transactions
      const relatedTransactions = await db.select()
        .from(cashTransactions)
        .where(and(eq(cashTransactions.partyId, id), eq(cashTransactions.tenantId, tenantId)))
        .limit(1);
      
      console.log(`Storage: Found ${relatedTransactions.length} related transactions`);
      
      if (relatedTransactions.length > 0) {
        // Can't delete party with transactions - for data integrity
        console.log('Storage: Cannot delete party - has related transactions');
        return false;
      }
      
      // Hard delete if no related transactions
      const deletedParty = await db
        .delete(parties)
        .where(and(eq(parties.id, id), eq(parties.tenantId, tenantId)))
        .returning();
      
      console.log(`Storage: Deletion result - ${deletedParty.length} rows affected`);
      return deletedParty.length > 0;
    } catch (error) {
      console.error('Storage: Error deleting party:', error);
      return false;
    }
  }
  
  // Cash transaction operations implementation
  async getCashTransactions(
    tenantId: string, 
    filters?: { 
      dateFrom?: string; 
      dateTo?: string; 
      partyId?: string; 
      transactionType?: string; 
      search?: string; 
      amount?: string;
      includeAll?: string;
    }
  ): Promise<(CashTransaction & { party: Party | null })[]> {
    // CRITICAL DEBUG: Date filtering for mobile cashbook daily view
    
    const conditions = [eq(cashTransactions.tenantId, tenantId)];
    
    // 🔧 FIX: Proper date filtering for YYYY-MM-DD format
    if (filters?.dateFrom) {
      // Convert date string to proper date range for timestamp comparison
      const fromDateTime = `${filters.dateFrom} 00:00:00`;
      conditions.push(gte(cashTransactions.transactionDate, fromDateTime));
    }
    if (filters?.dateTo) {
      // Convert date string to end of day for timestamp comparison  
      const toDateTime = `${filters.dateTo} 23:59:59`;
      conditions.push(lte(cashTransactions.transactionDate, toDateTime));
    }
    if (filters?.partyId) {
      conditions.push(eq(cashTransactions.partyId, filters.partyId));
    }
    if (filters?.transactionType) {
      if (filters.transactionType === 'transfer') {
        conditions.push(eq(cashTransactions.category, 'transfer'));
      } else {
        conditions.push(eq(cashTransactions.transactionType, filters.transactionType));
      }
    }
    
    // 🧠 FACEBOOK-STYLE UNIFIED SMART SEARCH - One search box for everything!
    if (filters?.search) {
      const searchTerm = filters.search.trim();
      const isAmountSearch = !isNaN(Number(searchTerm)) && searchTerm.length > 0;
      
      
      let searchConditions = [];
      
      if (isAmountSearch) {
        // 💰 SMART AMOUNT DETECTION: User typed numbers - prioritize amount matching
        const amount = Number(searchTerm);
        
        // Primary: Exact and fuzzy amount matching
        searchConditions.push(
          sql`${cashTransactions.amount} = ${amount}`,
          sql`${cashTransactions.amount} >= ${amount * 0.99} AND ${cashTransactions.amount} <= ${amount * 1.01}`
        );
        
        // Secondary: Search amount as text in narration and party names (account numbers)
        const amountPatterns = [
          `%${searchTerm}%`,                    // Partial number match in text
          `${searchTerm}%`,                     // Starts with number
          `%${searchTerm}`,                     // Ends with number
        ];
        
        amountPatterns.forEach(pattern => {
          searchConditions.push(
            sql`${parties.name} ILIKE ${pattern}`,
            sql`${cashTransactions.narration} ILIKE ${pattern}`,
            sql`${parties.mobile} ILIKE ${pattern}`
          );
        });
        
      } else {
        const normalizedTerm = normalizeMarathiVowels(searchTerm);
        
        const vowelFrom = 'ीूैौॅॉआईऊऐऔ';
        const vowelTo   = 'िुेोेोअइउएओ';
        if (normalizedTerm !== searchTerm) {
          searchConditions.push(
            sql`translate(${parties.name}, ${vowelFrom}, ${vowelTo}) ILIKE ${`%${normalizedTerm}%`}`,
            sql`translate(${cashTransactions.narration}, ${vowelFrom}, ${vowelTo}) ILIKE ${`%${normalizedTerm}%`}`
          );
        }
        
        const searchQueries = getNameTranslations(searchTerm);
        if (normalizedTerm !== searchTerm) {
          const normalizedVariations = getNameTranslations(normalizedTerm);
          normalizedVariations.forEach(v => {
            if (!searchQueries.includes(v)) searchQueries.push(v);
          });
        }
        
        searchQueries.forEach(query => {
          const queryPatterns = [
            `%${query}%`,
            `${query}%`,
            `% ${query}%`,
            `%${query.toLowerCase()}%`,
            `%${query.toUpperCase()}%`,
          ];
          
          queryPatterns.forEach(pattern => {
            searchConditions.push(
              sql`${parties.name} ILIKE ${pattern}`,
              sql`${cashTransactions.narration} ILIKE ${pattern}`,
              sql`${cashTransactions.category} ILIKE ${pattern}`,
              sql`${parties.mobile} ILIKE ${pattern}`,
              sql`${parties.address} ILIKE ${pattern}`
            );
          });
        });
        
        if (searchTerm.length >= 2) {
          const fuzzyPatterns = [
            `%${searchTerm.slice(0, -1)}%`,
            `%${searchTerm.slice(1)}%`,
          ];
          
          if (searchTerm.length >= 3) {
            fuzzyPatterns.push(
              `%${searchTerm.slice(0, 2)}%`,
              `%${searchTerm.slice(-2)}%`,
              `${searchTerm.slice(0, 3)}%`,
            );
          }
          
          for (let i = 0; i < searchTerm.length - 1; i++) {
            const partial = searchTerm.slice(i, i + 2);
            fuzzyPatterns.push(`%${partial}%`);
          }
          
          fuzzyPatterns.forEach(pattern => {
            searchConditions.push(
              sql`${parties.name} ILIKE ${pattern}`,
              sql`${cashTransactions.narration} ILIKE ${pattern}`
            );
          });
        }
      }
      
      // Apply unified search conditions with OR logic
      if (searchConditions.length > 0) {
        conditions.push(or(...searchConditions) as any);
        // console.log('🔍 UNIFIED SEARCH APPLIED:', { 
        //   searchType: isAmountSearch ? 'AMOUNT' : 'TEXT',
        //   conditionCount: searchConditions.length,
        //   totalConditions: conditions.length 
        // });
      }
    }
    
    // Amount filter
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
      party: sql`CASE WHEN ${parties.id} IS NOT NULL THEN json_build_object(
        'id', ${parties.id},
        'tenantId', ${parties.tenantId},
        'name', ${parties.name},
        'mobile', ${parties.mobile},
        'address', ${parties.address},
        'createdAt', ${parties.createdAt},
        'updatedAt', ${parties.updatedAt}
      ) ELSE NULL END`.as('party'),
    })
    .from(cashTransactions)
    .leftJoin(parties, eq(cashTransactions.partyId, parties.id))
    .where(and(...conditions))
    .orderBy(asc(cashTransactions.transactionDate));

    // OPTIMIZED: Ensure data uniqueness without excessive logging
    const uniqueMap = new Map();
    rawResults.forEach(result => {
      if (!uniqueMap.has(result.id)) {
        uniqueMap.set(result.id, result);
      }
    });

    const finalResults = Array.from(uniqueMap.values());

    console.log('✅ STORAGE RESULT:', {
      totalFound: rawResults.length,
      afterDedup: finalResults.length,
      dates: finalResults.map(r => r.transactionDate).slice(0, 5),
      amounts: finalResults.map(r => Number(r.amount)).slice(0, 5)
    });

    return finalResults;
  }

  // Mobile Cashbook Daily Balance - Critical for proper balance carry-forward
  async getMobileCashbookDailyBalance(tenantId: string, forDate: string): Promise<{
    date: string;
    openingBalance: number;
    closingBalance: number;
    dayTransactions: {
      cashIn: number;
      cashOut: number;
      count: number;
      transactions: any[];
    };
    netDifference: number;
  }> {
    try {
      const openingBalance = await this.getCashBalanceBeforeDate(tenantId, forDate);

      // Get transactions for the specific date
      const dayTransactions = await db.select()
        .from(cashTransactions)
        .where(
          and(
            eq(cashTransactions.tenantId, tenantId),
            sql`DATE(${cashTransactions.transactionDate}) = ${forDate}`
          )
        )
        .orderBy(asc(cashTransactions.transactionDate));

      // Calculate day's cash flow
      let dayCashIn = 0;
      let dayCashOut = 0;

      dayTransactions.forEach(transaction => {
        const amount = Number(transaction.amount) || 0;
        if (transaction.transactionType === 'cash_in') {
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
  async getMobileCashbookUniversalBalance(tenantId: string, startDate: string, endDate: string, viewPeriod: string): Promise<{
    startDate: string;
    endDate: string;
    viewPeriod: string;
    openingBalance: number;
    closingBalance: number;
    periodTransactions: {
      cashIn: number;
      cashOut: number;
      count: number;
      transactions: any[];
    };
    netDifference: number;
    method: string;
  }> {
    try {
      // Get opening balance using centralized function for consistency across all views
      const openingBalance = await this.getCashBalanceBeforeDate(tenantId, startDate);

      // Get all transactions within the period (startDate to endDate inclusive)
      const periodTransactions = await db.select()
        .from(cashTransactions)
        .where(
          and(
            eq(cashTransactions.tenantId, tenantId),
            sql`DATE(${cashTransactions.transactionDate}) >= ${startDate}`,
            sql`DATE(${cashTransactions.transactionDate}) <= ${endDate}`
          )
        )
        .orderBy(asc(cashTransactions.transactionDate));

      // Calculate period's cash flow
      let periodCashIn = 0;
      let periodCashOut = 0;

      periodTransactions.forEach(transaction => {
        const amount = Number(transaction.amount) || 0;
        if (transaction.transactionType === 'cash_in') {
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
        method: 'universal-period-balance'
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
        method: 'universal-period-balance-error'
      };
    }
  }
  
  async createCashTransaction(transaction: InsertCashTransaction): Promise<CashTransaction> {
    // 🔒 ABSOLUTE PREVENTION: Block ALL manual entries with loan keywords (disbursement + closure)
    if (!transaction.isSystemGenerated && transaction.narration) {
      const loanDisbursementKeywords = ['कर्ज वितरण', 'खाते क्र.', 'loan disbursement', 'मुद्दल', 'कर्ज'];
      const loanClosureKeywords = ['कर्ज बंद', 'कर्ज वसूली', 'loan closure', 'वसूली', 'बंद', 'loan_repayment'];
      
      const hasLoanDisbursementKeywords = loanDisbursementKeywords.some(keyword => 
        transaction.narration!.toLowerCase().includes(keyword.toLowerCase())
      );
      
      const hasLoanClosureKeywords = loanClosureKeywords.some(keyword => 
        transaction.narration!.toLowerCase().includes(keyword.toLowerCase())
      );
      
      // Block manual expense entries with loan disbursement keywords
      if (transaction.category === 'expense' && hasLoanDisbursementKeywords) {
        throw new Error('LOAN_DISBURSEMENT_MANUAL_ENTRY_BLOCKED: कर्ज वितरण entries फक्त loan forms मधूनच करता येतात');
      }
      
      // Block manual income/capital entries with loan closure keywords  
      if ((transaction.category === 'income' || transaction.category === 'capital' || transaction.category === 'loan_repayment') && hasLoanClosureKeywords) {
        throw new Error('LOAN_CLOSURE_MANUAL_ENTRY_BLOCKED: कर्ज बंद entries फक्त loan closure forms मधूनच करता येतात');
      }
    }

    // 🔒 ULTIMATE DUPLICATE PREVENTION: Enhanced with category-aware detection
    // First check: Recent transactions with similar amount (10-minute window for broader detection)
    const recentSimilarTransactions = await db.select()
      .from(cashTransactions)
      .where(and(
        eq(cashTransactions.tenantId, transaction.tenantId),
        sql`ABS(${cashTransactions.amount} - ${transaction.amount}) < 0.01`,
        eq(cashTransactions.transactionType, transaction.transactionType),
        // 🚫 CRITICAL: 10-minute window to catch all potential duplicates
        sql`${cashTransactions.createdAt} > NOW() - INTERVAL '10 minutes'`
      ))
      .orderBy(sql`${cashTransactions.createdAt} DESC`)
      .limit(10);

    // Second check: If this is a system-generated loan transaction, check for ANY manual entries with similar amounts
    // Key fix: Check for expense vs loan_disbursement AND income vs loan_repayment category differences
    if (transaction.isSystemGenerated && (transaction.category === 'loan_repayment' || transaction.category === 'loan_disbursement')) {
      const manualEntriesWithSameAmount = recentSimilarTransactions.filter(existing => {
        // Check for manual entries with different categories but same amount
        if (!existing.isSystemGenerated) {
          // Loan disbursement system entry vs expense manual entry
          if (transaction.category === 'loan_disbursement' && existing.category === 'expense') {
            return true;
          }
          // Loan repayment system entry vs income/capital manual entry
          if (transaction.category === 'loan_repayment' && 
              (existing.category === 'income' || existing.category === 'capital')) {
            return true;
          }
        }
        return false;
      });
      
      if (manualEntriesWithSameAmount.length > 0) {
        console.log(`🚫 DEEP DUPLICATE DETECTION: Found ${manualEntriesWithSameAmount.length} manual entries with amount ₹${transaction.amount}`);
        
        // Delete ALL matching manual entries
        for (const manualEntry of manualEntriesWithSameAmount) {
          console.log(`🗑️ DEEP CLEANUP: Removing manual entry [${manualEntry.category}]: ${manualEntry.id} - ₹${manualEntry.amount}`);
          await db.delete(cashTransactions).where(eq(cashTransactions.id, manualEntry.id));
        }
        
        console.log(`✅ SYSTEM ENTRY PROCEEDING: Creating proper loan transaction after deep cleanup`);
        // Continue with system entry creation
      }
    }

    // Third check: Extract account number for loan-specific matching with enhanced detection
    const accountNumberMatch = transaction.narration?.match(/खाते क्र\.\s*(\d+)/);
    const accountNumber = accountNumberMatch ? accountNumberMatch[1] : null;
    
    if (accountNumber) {
      // Enhanced: Check for duplicates with same account number regardless of category
      const accountSpecificDuplicates = await db.select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, transaction.tenantId),
          eq(cashTransactions.transactionDate, transaction.transactionDate),
          sql`ABS(${cashTransactions.amount} - ${transaction.amount}) < 0.01`,
          eq(cashTransactions.transactionType, transaction.transactionType),
          sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${accountNumber}%`}`,
          sql`${cashTransactions.createdAt} > NOW() - INTERVAL '10 minutes'`
        ));

      // If system entry, delete any manual entries with same account number
      if (transaction.isSystemGenerated && accountSpecificDuplicates.length > 0) {
        for (const duplicate of accountSpecificDuplicates) {
          if (!duplicate.isSystemGenerated) {
            console.log(`🗑️ ACCOUNT CLEANUP: Removing manual entry for account ${accountNumber}: ${duplicate.id}`);
            await db.delete(cashTransactions).where(eq(cashTransactions.id, duplicate.id));
          }
        }
      } else if (accountSpecificDuplicates.length > 0) {
        console.log(`🚫 ACCOUNT DUPLICATE PREVENTED: Account ${accountNumber} transaction already exists`);
        return accountSpecificDuplicates[0] as CashTransaction;
      }
    }

    // Clean narration to prevent duplicate patterns before storing
    const cleanedTransaction = {
      ...transaction,
      narration: transaction.narration ? this.cleanNarrationText(transaction.narration) : transaction.narration
    };
    
    // Convert amount to string for database compatibility
    const dbCompatibleTransaction = {
      ...cleanedTransaction,
      amount: cleanedTransaction.amount.toString()
    };
    
    // Create main transaction entry
    const [newTransaction] = await db.insert(cashTransactions).values(dbCompatibleTransaction).returning();

    // OPTIMIZED: Single transaction entry to prevent confusion in reports
    
    return newTransaction;
  }
  
  async updateCashTransaction(id: string, tenantId: string, transaction: Partial<InsertCashTransaction>): Promise<CashTransaction | undefined> {
    const [updatedTransaction] = await db
      .update(cashTransactions)
      .set({ 
        ...transaction, 
        amount: transaction.amount ? transaction.amount.toString() : undefined,
        updatedAt: new Date() 
      })
      .where(and(eq(cashTransactions.id, id), eq(cashTransactions.tenantId, tenantId)))
      .returning();

    if (updatedTransaction && updatedTransaction.partyId && updatedTransaction.partyId !== 'cash') {
      await db
        .update(cashTransactions)
        .set({
          amount: transaction.amount ? transaction.amount.toString() : undefined,
          transactionDate: transaction.transactionDate,
          narration: `${transaction.narration || ''} (Auto-linked)`,
          updatedAt: new Date()
        })
        .where(eq(cashTransactions.linkedTransactionId, id));
    }

    if (updatedTransaction && (transaction.amount || transaction.transactionDate)) {
      try {
        const relatedJournals = await db
          .select()
          .from(journalEntries)
          .where(and(
            eq(journalEntries.tenantId, tenantId),
            eq(journalEntries.sourceId, id),
            eq(journalEntries.sourceType, 'cash_transaction')
          ));

        if (relatedJournals.length > 0) {
          const newAmount = transaction.amount ? transaction.amount.toString() : updatedTransaction.amount;

          for (const journal of relatedJournals) {
            const updateFields: any = { updatedAt: new Date() };
            if (transaction.amount) {
              updateFields.totalAmount = newAmount;
            }
            if (transaction.transactionDate) {
              updateFields.transactionDate = transaction.transactionDate;
            }
            if (transaction.narration) {
              updateFields.narration = transaction.narration;
            }

            await db
              .update(journalEntries)
              .set(updateFields)
              .where(eq(journalEntries.id, journal.id));

            if (transaction.amount) {
              const lines = await db
                .select()
                .from(journalEntryLines)
                .where(eq(journalEntryLines.journalEntryId, journal.id));

              for (const line of lines) {
                const lineUpdate: any = {};
                lineUpdate.amount = newAmount;
                if (line.type === 'debit') {
                  lineUpdate.debitAmount = newAmount;
                  lineUpdate.creditAmount = "0";
                } else {
                  lineUpdate.creditAmount = newAmount;
                  lineUpdate.debitAmount = "0";
                }
                await db
                  .update(journalEntryLines)
                  .set(lineUpdate)
                  .where(eq(journalEntryLines.id, line.id));
              }
            }
          }
          console.log(`✅ Journal entries synced for transaction ${id}: ${relatedJournals.length} journal(s) updated`);
        }
      } catch (journalError) {
        console.error(`⚠️ Journal sync warning for transaction ${id}:`, journalError);
      }
    }
    
    return updatedTransaction || undefined;
  }
  
  async deleteCashTransaction(id: string, tenantId: string): Promise<boolean> {
    console.log('🗑️ STORAGE DELETE START:', {
      transactionId: id,
      tenantId,
      timestamp: new Date().toISOString()
    });

    try {
      // First, check if transaction exists
      const existingTransaction = await db
        .select()
        .from(cashTransactions)
        .where(and(eq(cashTransactions.id, id), eq(cashTransactions.tenantId, tenantId)))
        .limit(1);

      console.log('🔍 TRANSACTION CHECK:', {
        transactionId: id,
        exists: existingTransaction.length > 0,
        transaction: existingTransaction[0] || null
      });

      if (existingTransaction.length === 0) {
        console.log('❌ TRANSACTION NOT FOUND');
        return false;
      }

      // Check for related journal entries
      const relatedJournalEntries = await db
        .select()
        .from(journalEntries)
        .where(and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.sourceId, id),
          eq(journalEntries.sourceType, 'cash_transaction')
        ));

      console.log('📖 JOURNAL ENTRIES CHECK:', {
        transactionId: id,
        journalEntriesCount: relatedJournalEntries.length,
        entries: relatedJournalEntries
      });

      // Check for linked transactions
      const linkedTransactions = await db
        .select()
        .from(cashTransactions)
        .where(eq(cashTransactions.linkedTransactionId, id));

      console.log('🔗 LINKED TRANSACTIONS CHECK:', {
        transactionId: id,
        linkedCount: linkedTransactions.length,
        linked: linkedTransactions
      });

      // Delete related journal entry lines first
      if (relatedJournalEntries.length > 0) {
        console.log('🗑️ DELETING JOURNAL ENTRY LINES...');
        const journalLinesDeleted = await db
          .delete(journalEntryLines)
          .where(
            inArray(
              journalEntryLines.journalEntryId,
              db.select({ id: journalEntries.id })
                .from(journalEntries)
                .where(and(
                  eq(journalEntries.tenantId, tenantId),
                  eq(journalEntries.sourceId, id),
                  eq(journalEntries.sourceType, 'cash_transaction')
                ))
            )
          )
          .returning();

        console.log('✅ JOURNAL LINES DELETED:', {
          transactionId: id,
          deletedCount: journalLinesDeleted.length
        });

        // Delete related journal entries
        console.log('🗑️ DELETING JOURNAL ENTRIES...');
        const journalEntriesDeleted = await db
          .delete(journalEntries)
          .where(and(
            eq(journalEntries.tenantId, tenantId),
            eq(journalEntries.sourceId, id),
            eq(journalEntries.sourceType, 'cash_transaction')
          ))
          .returning();

        console.log('✅ JOURNAL ENTRIES DELETED:', {
          transactionId: id,
          deletedCount: journalEntriesDeleted.length
        });
      }

      // Delete linked transactions first (cascade will handle this, but explicit for safety)
      if (linkedTransactions.length > 0) {
        console.log('🗑️ DELETING LINKED TRANSACTIONS...');
        const linkedDeleted = await db
          .delete(cashTransactions)
          .where(eq(cashTransactions.linkedTransactionId, id))
          .returning();

        console.log('✅ LINKED TRANSACTIONS DELETED:', {
          transactionId: id,
          deletedCount: linkedDeleted.length
        });
      }

      // Delete main transaction
      console.log('🗑️ DELETING MAIN TRANSACTION...');
      const result = await db
        .delete(cashTransactions)
        .where(and(eq(cashTransactions.id, id), eq(cashTransactions.tenantId, tenantId)))
        .returning();
      
      console.log('✅ MAIN TRANSACTION DELETION RESULT:', {
        transactionId: id,
        success: result.length > 0,
        deletedTransaction: result[0] || null
      });

      return result.length > 0;

    } catch (error) {
      console.error('❌ STORAGE DELETE ERROR:', {
        transactionId: id,
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
  
  // Helper method to clean narration text and prevent duplicates
  private cleanNarrationText(narration: string): string {
    // Remove duplicate words (e.g., "रोहित शर्मा रोहित शर्मा" -> "रोहित शर्मा")
    let cleaned = narration.replace(/\b(\S+)\s+\1\b/g, '$1');
    
    // Clean specific duplicate patterns
    cleaned = cleaned
      .replace(/रोकड आली.*रोकड आली/gi, 'पेमेंट मिळाले')
      .replace(/रोकड दिली.*रोकड दिली/gi, 'पेमेंट केले')
      .replace(/रोकड घेतली.*रोकड दिली/gi, 'पेमेंट केले')
      .replace(/रोकड आली.*रोकड घेतली/gi, 'व्यवहार झाले');
    
    return cleaned.trim();
  }
  
  async getCashBalance(tenantId: string): Promise<number> {
    // Use professional calculation method
    const professionalBalance = await this.getProfessionalCashBalance(tenantId);
    return professionalBalance.currentBalance;
  }

  // Cache for account opening balance to prevent repeated DB queries
  private accountOpeningCache = new Map<string, {openingBalance: number, openingDate: string | null, timestamp: number}>();
  
  async getCashBalanceBeforeDate(tenantId: string, beforeDate: string): Promise<number> {
    try {
      // OPTIMIZED: Calculate balance with efficient caching
      
      // Check cache first (5 minute TTL)
      const cacheKey = `${tenantId}:account_opening`;
      const cached = this.accountOpeningCache.get(cacheKey);
      const now = Date.now();
      
      let baseOpeningBalance = 0;
      let openingBalanceDate = null;
      
      if (cached && (now - cached.timestamp) < 300000) { // 5 minutes
        baseOpeningBalance = cached.openingBalance;
        openingBalanceDate = cached.openingDate;
      } else {
        // Get Cash account opening balance details
        const cashAccounts = await db.select()
          .from(parties)
          .where(
            and(
              eq(parties.tenantId, tenantId),
              or(
                like(parties.name, '%Cash%'),
                like(parties.name, '%रोकड%'),
                like(parties.name, '%cash%'),
                like(parties.name, '%CASH%')
              )
            )
          );

        cashAccounts.forEach(account => {
          const accountOpeningBalance = Number(account.openingBalance) || 0;
          const accountOpeningBalanceDate = account.openingBalanceDate;
          
          if (account.openingBalanceType === 'credit') {
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

        // Cache the result
        this.accountOpeningCache.set(cacheKey, {
          openingBalance: baseOpeningBalance,
          openingDate: openingBalanceDate,
          timestamp: now
        });
      }

      // Account details calculated efficiently

      // FAST LOGIC: Optimized opening balance calculation
      
      // Case 1: Exact opening date match
      if (openingBalanceDate && beforeDate === openingBalanceDate) {
        return baseOpeningBalance;
      }
      
      // Case 2: If beforeDate is before opening balance date  
      // Return the opening balance as no transactions could have occurred yet
      if (openingBalanceDate && openingBalanceDate !== null && beforeDate < openingBalanceDate) {
        return baseOpeningBalance;
      }

      // Case 3: If beforeDate is after opening balance date
      // Start with base opening balance + all transactions from opening date to before date
      if (openingBalanceDate && openingBalanceDate !== null && beforeDate > openingBalanceDate) {
        
        const transactionsFromOpeningToBeforeDate = await db.select()
          .from(cashTransactions)
          .where(
            and(
              eq(cashTransactions.tenantId, tenantId),
              sql`DATE(${cashTransactions.transactionDate}) >= ${openingBalanceDate}`,
              sql`DATE(${cashTransactions.transactionDate}) < ${beforeDate}`
            )
          );

        let totalCashIn = 0;
        let totalCashOut = 0;

        transactionsFromOpeningToBeforeDate.forEach(transaction => {
          const amount = Number(transaction.amount) || 0;
          if (transaction.transactionType === 'cash_in') {
            totalCashIn += amount;
          } else {
            totalCashOut += amount;
          }
        });

        const result = baseOpeningBalance + totalCashIn - totalCashOut;
        return result;
      }

      // Case 4: No opening balance date - calculate from transactions before date
      const allTransactionsBeforeDate = await db.select()
        .from(cashTransactions)
        .where(
          and(
            eq(cashTransactions.tenantId, tenantId),
            sql`DATE(${cashTransactions.transactionDate}) < ${beforeDate}`
          )
        );

      if (allTransactionsBeforeDate.length === 0) {
        return baseOpeningBalance;
      }

      let totalCashIn = 0;
      let totalCashOut = 0;

      allTransactionsBeforeDate.forEach(transaction => {
        const amount = Number(transaction.amount) || 0;
        if (transaction.transactionType === 'cash_in') {
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
  async getDateWiseCashBalance(tenantId: string, forDate: string): Promise<{
    openingBalance: number;
    closingBalance: number;
    dayTransactions: { cashIn: number; cashOut: number; netDifference: number };
    totalBalance: number;
  }> {
    try {
      // Get opening balance (previous day closing)
      const openingBalance = await this.getCashBalanceBeforeDate(tenantId, forDate);
      
      // Get transactions for the specific date
      const dayTransactions = await db.select()
        .from(cashTransactions)
        .where(
          and(
            eq(cashTransactions.tenantId, tenantId),
            sql`DATE(${cashTransactions.transactionDate}) = ${forDate}`
          )
        )
        .orderBy(asc(cashTransactions.transactionDate));

      let dayCashIn = 0;
      let dayCashOut = 0;

      dayTransactions.forEach(transaction => {
        const amount = Number(transaction.amount) || 0;
        if (transaction.transactionType === 'cash_in') {
          dayCashIn += amount;
        } else {
          dayCashOut += amount;
        }
      });

      const netDifference = dayCashIn - dayCashOut;
      const closingBalance = openingBalance + netDifference;
      
      // Get total overall balance for निव्वळ शिल्लक
      const professionalBalance = await this.getProfessionalCashBalance(tenantId);

      return {
        openingBalance,
        closingBalance,
        dayTransactions: {
          cashIn: dayCashIn,
          cashOut: dayCashOut,
          netDifference
        },
        totalBalance: closingBalance // Use date-specific closing balance instead of overall balance
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

  async getProfessionalCashBalance(tenantId: string): Promise<{
    currentBalance: number;
    openingBalance: number;
    totalCashIn: number;
    totalCashOut: number;
    totalLoanDisbursements: number;
    totalLoanClosures: number;
    transactionCount: number;
    lastUpdated: Date;
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let isValid = true;

    try {
      // Fetch all cash transactions chronologically
      const allCashTransactions = await db.select()
        .from(cashTransactions)
        .where(eq(cashTransactions.tenantId, tenantId))
        .orderBy(asc(cashTransactions.transactionDate));

      // Fetch all loans chronologically
      const allLoans = await db.select()
        .from(loans)
        .where(eq(loans.tenantId, tenantId))
        .orderBy(asc(loans.createdAt));

      // Calculate cash transactions totals
      let totalCashIn = 0;
      let totalCashOut = 0;
      let cashTransactionCount = 0;

      allCashTransactions.forEach(transaction => {
        const amount = Number(transaction.amount) || 0;
        if (amount <= 0) {
          errors.push(`Invalid cash transaction amount: ${amount} for transaction ${transaction.id}`);
          return;
        }

        cashTransactionCount++;
        if (transaction.transactionType === 'cash_in') {
          totalCashIn += amount;
        } else {
          totalCashOut += amount;
        }
      });

      // Calculate loan impact on cash flow
      let totalLoanDisbursements = 0;
      let totalLoanClosures = 0;
      let loanTransactionCount = 0;

      allLoans.forEach(loan => {
        const loanAmount = Number(loan.principalAmount) || 0;

        if (loanAmount <= 0) {
          errors.push(`Invalid loan amount: ${loanAmount} for loan ${loan.id}`);
          return;
        }

        // Loan disbursement (cash goes out)
        totalLoanDisbursements += loanAmount;
        loanTransactionCount++;

        // Loan closure (cash comes in) - only if actually closed
        if (loan.status === 'closed') {
          // For now, use principal amount as closure amount
          // In reality, this should come from loan closure records
          totalLoanClosures += loanAmount;
          loanTransactionCount++;
        }
      });

      // Professional balance calculation with bulletproof logic
      // Get opening balance from Cash account in parties table + any additional cash transactions marked as 'opening_balance'
      let openingBalance = 0;
      
      // First, get opening balance from Cash account in parties table
      try {
        const cashAccounts = await db.select()
          .from(parties)
          .where(
            and(
              eq(parties.tenantId, tenantId),
              or(
                like(parties.name, '%Cash%'),
                like(parties.name, '%रोकड%'),
                like(parties.name, '%cash%'),
                like(parties.name, '%CASH%')
              )
            )
          );
        
        cashAccounts.forEach(account => {
          const accountOpeningBalance = Number(account.openingBalance) || 0;
          if (account.openingBalanceType === 'credit') {
            openingBalance += accountOpeningBalance;
          } else {
            openingBalance -= accountOpeningBalance;
          }
        });
      } catch (partiesError) {
        console.error('Error fetching cash account opening balance:', partiesError);
        errors.push('Failed to fetch cash account opening balance from parties table');
      }
      
      // Note: We no longer double-count opening balance from cash_transactions table
      // Opening balance should be managed only through parties table (Cash account)
      // This prevents duplicate opening balance calculations
      
      // Current balance = Opening + Cash In - Cash Out - Loan Disbursements + Loan Closures
      const currentBalance = openingBalance + totalCashIn - totalCashOut - totalLoanDisbursements + totalLoanClosures;

      // Validation checks
      if (isNaN(currentBalance)) {
        errors.push("Current balance calculation resulted in NaN");
        isValid = false;
      }

      // Cross-verification with separate calculation (including opening balance)
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
        lastUpdated: new Date(),
        isValid,
        errors
      };

    } catch (error) {
      console.error("Professional cash balance calculation error:", error);
      errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        currentBalance: 0,
        openingBalance: 0,
        totalCashIn: 0,
        totalCashOut: 0,
        totalLoanDisbursements: 0,
        totalLoanClosures: 0,
        transactionCount: 0,
        lastUpdated: new Date(),
        isValid: false,
        errors
      };
    }
  }



  async getTenantStatistics(): Promise<any[]> {
    const tenantStats = await db
      .select({
        tenantId: users.tenantId,
        userCount: sql<number>`count(${users.id})`,
        activeUsers: sql<number>`count(case when ${users.isActive} = true then 1 end)`,
        loanCount: sql<number>`coalesce((select count(*) from ${loans} where ${loans.tenantId} = ${users.tenantId}), 0)`,
        groupCount: sql<number>`coalesce((select count(*) from ${groups} where ${groups.tenantId} = ${users.tenantId}), 0)`,
        borrowerCount: sql<number>`coalesce((select count(*) from ${borrowers} where ${borrowers.tenantId} = ${users.tenantId}), 0)`,
        cashTransactionCount: sql<number>`coalesce((select count(*) from ${cashTransactions} where ${cashTransactions.tenantId} = ${users.tenantId}), 0)`,
        lastActivity: sql<string>`max(${users.updatedAt})`
      })
      .from(users)
      .where(not(eq(users.tenantId, 'SUPER_ADMIN')))
      .groupBy(users.tenantId)
      .orderBy(users.tenantId);

    return tenantStats;
  }

  // Helper function to calculate time period between dates
  private calculateTimePeriod(startDate: Date, endDate: Date) {
    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();
    let days = endDate.getDate() - startDate.getDate();

    // Handle negative days
    if (days < 0) {
      const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
      days += prevMonth.getDate();
      months--;
    }

    // Handle negative months
    if (months < 0) {
      months += 12;
      years--;
    }

    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const isExactMonth = days === 0;

    return { years, months, days, totalDays, isExactMonth };
  }

  // Advanced compound interest calculation (Server Implementation)
  private calculateAdvancedCompoundInterest(
    principal: number,
    monthlyRate: number,
    startDate: Date,
    endDate: Date,
    compoundingFrequency: "yearly" | "monthly" = "yearly"
  ): number {
    const timePeriod = this.calculateTimePeriod(startDate, endDate);
    let totalInterest = 0;
    let currentPrincipal = principal;
    
    // Calculate compound interest based on frequency
    const compoundingPeriodMonths = compoundingFrequency === "yearly" ? 12 : 1;
    const totalMonths = timePeriod.years * 12 + timePeriod.months + (timePeriod.days > 0 ? 1 : 0); // Any day = full month
    const fullCompoundingPeriods = Math.floor(totalMonths / compoundingPeriodMonths);
    
    console.log(`🔧 COMPOUND SETUP: ${totalMonths} total months, ${fullCompoundingPeriods} compounding periods`);
    
    // Calculate compound interest for full periods
    for (let period = 0; period < fullCompoundingPeriods; period++) {
      const monthlyInterestForPeriod = Math.round((currentPrincipal * monthlyRate) / 100);
      const periodInterest = monthlyInterestForPeriod * compoundingPeriodMonths;
      
      console.log(`🔧 COMPOUND Period ${period + 1}:`, {
        principal: currentPrincipal,
        monthlyRate: `${monthlyRate}%`,
        periodInterest,
        formula: `${currentPrincipal} × ${monthlyRate}% × ${compoundingPeriodMonths} = ${periodInterest}`
      });
      
      totalInterest += periodInterest;
      currentPrincipal += periodInterest; // Add to principal for compounding
    }
    
    // Calculate remaining months as simple interest on compounded principal
    const remainingMonths = totalMonths - (fullCompoundingPeriods * compoundingPeriodMonths);
    if (remainingMonths > 0) {
      const monthlyInterestRate = Math.round((currentPrincipal * monthlyRate) / 100);
      const remainingInterest = monthlyInterestRate * remainingMonths;
      totalInterest += remainingInterest;
      
      console.log(`🔧 REMAINING: ${remainingMonths} months on principal ${currentPrincipal} = ${remainingInterest}`);
    }
    
    console.log(`🔧 TOTAL COMPOUND INTEREST: ${totalInterest} (vs simple: ${(principal * monthlyRate * totalMonths) / 100})`);
    
    return totalInterest;
  }

  // Helper function to calculate future projection date
  private getProjectionDate(period: string): Date {
    const today = new Date();
    switch(period) {
      case '1month':
        return new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
      case '3months':
        return new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
      case '6months':
        return new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
      case '1year':
        return new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
      default:
        return today;
    }
  }

  async getOverdueReportWithCorrectMath(
    tenantId: string,
    filters: {
      dateFrom: string;
      dateTo: string;
      groupId: string;
      currentGoldRate: number;
      finePurityPercentage: number;
      monthlyInterestRate: number;
      interestRateMode?: string;
      projectionMode?: string;
      futureProjectionPeriod?: string;
      customerName?: string;
    }
  ): Promise<any[]> {
    console.log(`🔍 OVERDUE STORAGE START: tenant=${tenantId}`);
    
    try {
      // Build query conditions
      const conditions = [eq(loans.tenantId, tenantId)];
      if (filters.groupId && filters.groupId !== 'all') {
        conditions.push(eq(loans.groupId, filters.groupId));
      }
      if (filters.customerName) {
        conditions.push(eq(loans.borrowerName, filters.customerName));
      }
      if (filters.dateFrom) {
        conditions.push(gte(loans.loanDate, filters.dateFrom));
      }
      if (filters.dateTo) {
        conditions.push(lte(loans.loanDate, filters.dateTo));
      }
      console.log(`📅 DATE FILTER: ${filters.dateFrom} to ${filters.dateTo}`);

      console.log('📋 Fetching active loans with group info...');
      const activeLoans = await db
        .select({
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
          purity: loans.purity,
          status: loans.status,
        })
        .from(loans)
        .leftJoin(groups, eq(loans.groupId, groups.id))
        .where(and(...conditions, eq(loans.status, 'active')))
        .orderBy(loans.loanDate);

      console.log(`📊 Found ${activeLoans.length} active loans`);
      
      if (activeLoans.length === 0) {
        return [];
      }

      const overdueResults = [];
      
      // CRITICAL FIX: Calculate projection date based on mode
      const calculationDate = filters.projectionMode === 'future' 
        ? this.getProjectionDate(filters.futureProjectionPeriod || '3months')
        : new Date();
      
      console.log(`🔮 CALCULATION MODE: ${filters.projectionMode} | DATE: ${calculationDate.toISOString().split('T')[0]}`);

      for (const loan of activeLoans) {
        console.log(`💼 Processing loan: ${loan.borrowerName}`);
        
        const principal = parseFloat(loan.principalAmount.toString());
        const loanDate = new Date(loan.loanDate);
        const daysDiff = Math.floor((calculationDate.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));

        // Get loan payments
        const loanPayments = await this.getLoanClosures(tenantId, loan.loanId);
        const totalPaid = loanPayments.reduce((sum: number, closure: any) => sum + parseFloat(closure.totalAmount || '0'), 0);

        // CRITICAL FIX: Calculate interest based on projection mode AND rate mode
        let monthlyRate: number;
        
        // DEEP FIX: Handle interest rate mode properly
        console.log(`🔧 RATE MODE DEBUG: ${loan.borrowerName} | Mode: "${filters.interestRateMode}" | Loan Rate: ${loan.interestRate}% ${loan.interestRateType} | Form Rate: ${filters.monthlyInterestRate}%`);
        
        if (filters.interestRateMode === 'loan-wise') {
          // Use individual loan's interest rate
          const loanInterestRate = parseFloat(loan.interestRate?.toString() || '0');
          monthlyRate = loan.interestRateType === 'monthly' ? loanInterestRate : loanInterestRate / 12;
          console.log(`✏️ LOAN-WISE RATE: ${loan.borrowerName} | Rate: ${loanInterestRate}% ${loan.interestRateType} → ${monthlyRate}% monthly`);
        } else {
          // Use manual rate from form
          monthlyRate = filters.monthlyInterestRate;
          console.log(`📊 MANUAL RATE: ${loan.borrowerName} | Rate: ${monthlyRate}% monthly from form`);
        }
        
        let totalMonths: number;
        let interestToDate: number;
        
        if (filters.projectionMode === 'future') {
          // FUTURE PROJECTION: Calculate from loan date to future projection date
          const totalDays = daysDiff; // This is now calculated using projection date
          const fullMonths = Math.floor(totalDays / 30);
          const remainingDays = totalDays % 30;
          totalMonths = fullMonths + (remainingDays > 0 ? 1 : 0);
          
          console.log(`🔮 FUTURE CALC: ${loan.borrowerName} | Days: ${totalDays} | Months: ${totalMonths}`);
        } else {
          // CURRENT ANALYSIS: Calculate from loan date to today only
          const currentDate = new Date();
          const currentDaysDiff = Math.floor((currentDate.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
          const fullMonths = Math.floor(currentDaysDiff / 30);
          const remainingDays = currentDaysDiff % 30;
          totalMonths = fullMonths + (remainingDays > 0 ? 1 : 0);
          
          console.log(`📊 CURRENT CALC: ${loan.borrowerName} | Days: ${currentDaysDiff} | Months: ${totalMonths}`);
        }

        // FIXED: Compound yearly interest calculation
        interestToDate = this.calculateAdvancedCompoundInterest(
          principal,
          monthlyRate,
          loanDate,
          calculationDate
        );
        const totalAmountDue = principal + interestToDate;
        const outstandingAmount = totalAmountDue - totalPaid;

        // Gold value calculation — DB purity first, filter fallback
        const goldWeightNum = parseFloat(loan.weight?.toString() || '0');
        const dbPurity = loan.purity ? parseFloat(loan.purity.toString()) : 0;
        const purityPercentage = dbPurity > 0 ? dbPurity : filters.finePurityPercentage;
        const goldRate = filters.currentGoldRate;
        const fineGoldWeight = goldWeightNum * (purityPercentage / 100);
        const currentGoldValue = fineGoldWeight * goldRate;

        // Loss calculation
        const lossAmount = outstandingAmount > currentGoldValue ? outstandingAmount - currentGoldValue : 0;

        // Risk level
        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        const lossPercentage = principal > 0 ? (lossAmount / principal) * 100 : 0;
        if (lossPercentage > 50) riskLevel = 'high';
        else if (lossPercentage > 20) riskLevel = 'medium';

        // Include all active loans (not just overdue ones)
        overdueResults.push({
          loanId: loan.loanId,
          accountNumber: loan.accountNumber,
          borrowerName: loan.borrowerName,
          borrowerPhone: loan.borrowerPhone || 'N/A',
          groupName: loan.groupName || 'सर्व गट',
          loanDate: loan.loanDate,
          goldItem: loan.collateralDetails || 'N/A',
          principalAmount: principal,
          interestToDate: interestToDate,
          totalAmount: totalAmountDue,
          totalPaid: totalPaid,
          outstandingAmount: outstandingAmount,
          goldWeight: goldWeightNum,
          fineGoldWeight: fineGoldWeight,
          currentGoldValue: currentGoldValue,
          lossAmount: lossAmount,
          lossPercentage: lossPercentage,
          riskLevel: riskLevel,
          daysOverdue: daysDiff,
        });
      }

      console.log(`✅ OVERDUE COMPLETED: ${overdueResults.length} results generated`);
      return overdueResults;
      
    } catch (error) {
      console.error('❌ OVERDUE STORAGE ERROR:', error);
      throw error;
    }
  }

  async deleteTenantData(tenantId: string): Promise<any> {
    // Delete all tenant data in proper order (respecting foreign keys)
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
      // Delete in reverse dependency order - critical fix for complete tenant cleanup
      
      // First delete user activity logs (references users)
      const activityResult = await db.delete(userActivityLogs).where(eq(userActivityLogs.tenantId, tenantId)).returning();
      deletedRecords.userActivityLogs = activityResult.length || 0;

      // Delete user permissions (references users)
      const permissionsResult = await db.delete(userPermissions).where(eq(userPermissions.tenantId, tenantId)).returning();
      deletedRecords.userPermissions = permissionsResult.length || 0;

      // Delete cash transactions
      const cashTxResult = await db.delete(cashTransactions).where(eq(cashTransactions.tenantId, tenantId)).returning();
      deletedRecords.cashTransactions = cashTxResult.length || 0;

      // Delete loan closures (references loans)
      const closuresResult = await db.delete(loanClosures).where(eq(loanClosures.tenantId, tenantId)).returning();
      deletedRecords.loanClosures = closuresResult.length || 0;

      // Delete transactions (references loans)
      const transactionsResult = await db.delete(transactions).where(eq(transactions.tenantId, tenantId)).returning();
      deletedRecords.transactions = transactionsResult.length || 0;

      // Delete loans (references borrowers and groups)
      const loansResult = await db.delete(loans).where(eq(loans.tenantId, tenantId)).returning();
      deletedRecords.loans = loansResult.length || 0;

      // Delete borrowers (references groups)
      const borrowersResult = await db.delete(borrowers).where(eq(borrowers.tenantId, tenantId)).returning();
      deletedRecords.borrowers = borrowersResult.length || 0;

      // Delete groups
      const groupsResult = await db.delete(groups).where(eq(groups.tenantId, tenantId)).returning();
      deletedRecords.groups = groupsResult.length || 0;

      // Delete companies
      const companiesResult = await db.delete(companies).where(eq(companies.tenantId, tenantId)).returning();
      deletedRecords.companies = companiesResult.length || 0;

      // Delete users (after all dependent data is cleaned)
      const usersResult = await db.delete(users).where(eq(users.tenantId, tenantId)).returning();
      deletedRecords.users = usersResult.length || 0;

      // Clean up sessions for deleted users
      const sessionCleanupResult = await db.execute(sql`
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
  async getUsers(tenantId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.tenantId, tenantId));
  }

  async getCompanies(tenantId: string): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.tenantId, tenantId));
  }

  async restoreFromBackup(tenantId: string, backupData: any): Promise<void> {
    await db.transaction(async (tx) => {
      // Delete existing data for tenant
      await tx.delete(cashTransactions).where(eq(cashTransactions.tenantId, tenantId));
      await tx.delete(loanClosures).where(eq(loanClosures.tenantId, tenantId));
      await tx.delete(transactions).where(eq(transactions.tenantId, tenantId));
      await tx.delete(loans).where(eq(loans.tenantId, tenantId));
      await tx.delete(borrowers).where(eq(borrowers.tenantId, tenantId));
      await tx.delete(groups).where(eq(groups.tenantId, tenantId));
      await tx.delete(parties).where(eq(parties.tenantId, tenantId));
      await tx.delete(companies).where(eq(companies.tenantId, tenantId));
      
      // Restore from backup (skip users for security)
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

  async deleteAllTenantData(tenantId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Delete in correct order to maintain referential integrity
      await tx.delete(cashTransactions).where(eq(cashTransactions.tenantId, tenantId));
      await tx.delete(loanClosures).where(eq(loanClosures.tenantId, tenantId));
      await tx.delete(transactions).where(eq(transactions.tenantId, tenantId));
      await tx.delete(loans).where(eq(loans.tenantId, tenantId));
      await tx.delete(borrowers).where(eq(borrowers.tenantId, tenantId));
      await tx.delete(groups).where(eq(groups.tenantId, tenantId));
      await tx.delete(parties).where(eq(parties.tenantId, tenantId));
      await tx.delete(companies).where(eq(companies.tenantId, tenantId));
      // Note: Users are NOT deleted for security reasons
    });
  }

  async deleteClosedLoansBeforeDate(tenantId: string, beforeDate: string): Promise<{
    deletedLoans: number;
    deletedTransactions: number;
    deletedCashEntries: number;
  }> {
    let deletedLoans = 0;
    let deletedTransactions = 0;
    let deletedCashEntries = 0;

    await db.transaction(async (tx) => {
      const closedLoansList = await tx
        .select({ id: loans.id, accountNumber: loans.accountNumber })
        .from(loans)
        .where(
          and(
            eq(loans.tenantId, tenantId),
            eq(loans.status, 'closed'),
            lte(loans.loanDate, beforeDate)
          )
        );

      if (closedLoansList.length === 0) {
        return;
      }

      const loanIds = closedLoansList.map(loan => loan.id);
      const accountNumbers = closedLoansList.map(loan => loan.accountNumber);

      for (const accNum of accountNumbers) {
        const deletedCashResult = await tx
          .delete(cashTransactions)
          .where(
            and(
              eq(cashTransactions.tenantId, tenantId),
              sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${accNum}%`}`
            )
          )
          .returning({ id: cashTransactions.id });
        deletedCashEntries += deletedCashResult.length;
      }

      await tx
        .delete(loanClosures)
        .where(
          and(
            eq(loanClosures.tenantId, tenantId),
            sql`${loanClosures.loanId} = ANY(${loanIds})`
          )
        );

      const deletedTransResult = await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.tenantId, tenantId),
            sql`${transactions.loanId} = ANY(${loanIds})`
          )
        )
        .returning({ id: transactions.id });

      deletedTransactions = deletedTransResult.length;

      const deletedLoanResult = await tx
        .delete(loans)
        .where(
          and(
            eq(loans.tenantId, tenantId),
            eq(loans.status, 'closed'),
            lte(loans.loanDate, beforeDate)
          )
        )
        .returning({ id: loans.id });

      deletedLoans = deletedLoanResult.length;
    });

    return {
      deletedLoans,
      deletedTransactions,
      deletedCashEntries
    };
  }

  // User Management Operations

  async getUsersForTenant(tenantId: string): Promise<(User & { permissions: UserPermissions | null; creator: User | null })[]> {
    const tenantUsers = await db
      .select({
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
          id: sql<string>`creator.id`,
          username: sql<string>`creator.username`,
          fullName: sql<string>`creator.full_name`,
        }
      })
      .from(users)
      .leftJoin(userPermissions, eq(users.id, userPermissions.userId))
      .leftJoin(sql`${users} as creator`, sql`${users.createdBy} = creator.id`)
      .where(and(
        eq(users.tenantId, tenantId),
        or(eq(users.role, 'user'), eq(users.role, 'clerk'))  // Don't include admins in user management
      ))
      .orderBy(desc(users.createdAt));

    return tenantUsers as any;
  }

  async createUserWithPermissions(user: InsertUser, permissions: InsertUserPermissions): Promise<User> {
    return await db.transaction(async (tx) => {
      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      // Create user
      const [newUser] = await tx
        .insert(users)
        .values({
          ...user,
          password: hashedPassword
        })
        .returning();

      // Create permissions
      await tx
        .insert(userPermissions)
        .values({
          ...permissions,
          userId: newUser.id,
          tenantId: user.tenantId
        });

      return newUser;
    });
  }

  async updateUserStatus(userId: string, tenantId: string, isActive: boolean, isTemporaryDisabled?: boolean): Promise<User | undefined> {
    const updateData: any = { 
      isActive, 
      updatedAt: new Date() 
    };
    
    if (isTemporaryDisabled !== undefined) {
      updateData.isTemporaryDisabled = isTemporaryDisabled;
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(and(
        eq(users.id, userId), 
        eq(users.tenantId, tenantId)
      ))
      .returning();
      
    return updatedUser || undefined;
  }



  // Simple disable/enable admin access by Super Admin (no time limit)
  async temporaryDisableAdmin(adminUserId: string, hours: number, disabledBy: string): Promise<void> {
    await db
      .update(users)
      .set({
        isTemporaryDisabled: true,
        temporaryDisabledUntil: null, // No time limit
        temporaryDisabledBy: disabledBy,
        updatedAt: new Date()
      })
      .where(eq(users.id, adminUserId));
  }

  async temporaryEnableAdmin(adminUserId: string): Promise<void> {
    await db
      .update(users)
      .set({
        isTemporaryDisabled: false,
        temporaryDisabledUntil: null,
        temporaryDisabledBy: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, adminUserId));
  }

  async checkTemporaryDisableStatus(userId: string): Promise<boolean> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0]) return false;

    const currentUser = user[0];
    
    // Simple check - no automatic re-enabling
    return currentUser.isTemporaryDisabled;
  }

  // Password reset functionality for admin users
  async resetUserPassword(userId: string, tenantId: string, newPassword: string, resetBy: string): Promise<User | undefined> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const [updatedUser] = await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .returning();

    // Log password reset activity
    if (updatedUser) {
      await this.logUserActivity({
        userId: updatedUser.id,
        tenantId: updatedUser.tenantId,
        activityType: 'password_reset',
        description: `Password reset by ${resetBy}`,
        metadata: JSON.stringify({ resetBy })
      });
    }

    return updatedUser || undefined;
  }

  // Get all admin users across tenants for Super Admin management
  async getAllAdminUsers(): Promise<any[]> {
    try {
      const adminUsers = await db
        .select({
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
          companyName: sql<string>`COALESCE(${companies.name}, ${users.tenantId})`.as('companyName')
        })
        .from(users)
        .leftJoin(companies, eq(users.tenantId, companies.tenantId))
        .where(
          and(
            eq(users.role, 'admin'),
            not(eq(users.tenantId, 'SUPER_ADMIN'))
          )
        )
        .orderBy(desc(users.createdAt));

      return adminUsers || [];
    } catch (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }
  }

  async updateUserPassword(userId: string, tenantId: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const [updatedUser] = await db
        .update(users)
        .set({ 
          password: hashedPassword, 
          updatedAt: new Date() 
        })
        .where(and(
          eq(users.id, userId), 
          eq(users.tenantId, tenantId),
          or(eq(users.role, 'user'), eq(users.role, 'clerk'), eq(users.role, 'admin'), eq(users.role, 'super_admin'))
        ))
        .returning();
      
      return !!updatedUser;
    } catch (error) {
      console.error('Password update error:', error);
      return false;
    }
  }

  async getUserPermissions(userId: string, tenantId: string): Promise<UserPermissions | undefined> {
    const [permissions] = await db
      .select()
      .from(userPermissions)
      .where(and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.tenantId, tenantId)
      ));
      
    return permissions || undefined;
  }

  async createUserPermissions(permissions: InsertUserPermissions): Promise<UserPermissions> {
    const [newPermissions] = await db
      .insert(userPermissions)
      .values(permissions)
      .returning();
      
    return newPermissions;
  }

  async updateUserPermissions(userId: string, tenantId: string, permissions: Partial<InsertUserPermissions>): Promise<UserPermissions | undefined> {
    const [updatedPermissions] = await db
      .update(userPermissions)
      .set({
        ...permissions,
        updatedAt: new Date()
      })
      .where(and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.tenantId, tenantId)
      ))
      .returning();
      
    return updatedPermissions || undefined;
  }

  async logUserActivity(activity: InsertUserActivityLog): Promise<UserActivityLog> {
    const [newActivity] = await db
      .insert(userActivityLogs)
      .values(activity)
      .returning();
      
    return newActivity;
  }

  async getUserActivityLogs(userId: string, tenantId: string, limit: number = 100): Promise<UserActivityLog[]> {
    return await db
      .select()
      .from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        eq(userActivityLogs.tenantId, tenantId)
      ))
      .orderBy(desc(userActivityLogs.createdAt))
      .limit(limit);
  }

  async updateUserLoginInfo(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        loginCount: sql`${users.loginCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async createAccountTransfer(tenantId: string, data: { fromPartyId: string; toPartyId: string; amount: string; transactionDate: string; narration: string; category?: string }): Promise<{ cashInTransaction: CashTransaction; cashOutTransaction: CashTransaction }> {
    return await db.transaction(async (tx) => {
      const transferId = crypto.randomUUID();
      const category = data.category || 'transfer';

      const [cashInTx] = await tx
        .insert(cashTransactions)
        .values({
          tenantId,
          transactionDate: data.transactionDate,
          transactionType: 'cash_in',
          amount: data.amount,
          category,
          narration: data.narration,
          partyId: data.fromPartyId,
          fromAccount: data.fromPartyId,
          toAccount: 'cash',
          linkedTransactionId: transferId,
          isSystemGenerated: false,
        })
        .returning();

      const [cashOutTx] = await tx
        .insert(cashTransactions)
        .values({
          tenantId,
          transactionDate: data.transactionDate,
          transactionType: 'cash_out',
          amount: data.amount,
          category,
          narration: data.narration,
          partyId: data.toPartyId,
          fromAccount: 'cash',
          toAccount: data.toPartyId,
          linkedTransactionId: transferId,
          isSystemGenerated: false,
        })
        .returning();

      const jeNum1 = `JE-${Date.now()}-IN`;
      const [je1] = await tx.insert(journalEntries).values({
        tenantId, journalNumber: jeNum1, transactionDate: data.transactionDate,
        description: data.narration, totalAmount: data.amount,
        sourceId: cashInTx.id, sourceType: 'cash_transaction',
      }).returning();
      await tx.insert(journalEntryLines).values({
        tenantId, journalEntryId: je1.id, type: 'debit',
        accountType: 'cash', accountId: null, accountName: 'Cash',
        amount: data.amount, debitAmount: data.amount, creditAmount: '0',
        description: `ट्रान्सफर जमा - ${data.narration}`,
      });
      await tx.insert(journalEntryLines).values({
        tenantId, journalEntryId: je1.id, type: 'credit',
        accountType: 'party', accountId: data.fromPartyId, accountName: 'Party Account',
        amount: data.amount, debitAmount: '0', creditAmount: data.amount,
        description: `ट्रान्सफर स्रोत - ${data.narration}`,
      });

      const jeNum2 = `JE-${Date.now()}-OUT`;
      const [je2] = await tx.insert(journalEntries).values({
        tenantId, journalNumber: jeNum2, transactionDate: data.transactionDate,
        description: data.narration, totalAmount: data.amount,
        sourceId: cashOutTx.id, sourceType: 'cash_transaction',
      }).returning();
      await tx.insert(journalEntryLines).values({
        tenantId, journalEntryId: je2.id, type: 'debit',
        accountType: 'party', accountId: data.toPartyId, accountName: 'Party Account',
        amount: data.amount, debitAmount: data.amount, creditAmount: '0',
        description: `ट्रान्सफर गंतव्य - ${data.narration}`,
      });
      await tx.insert(journalEntryLines).values({
        tenantId, journalEntryId: je2.id, type: 'credit',
        accountType: 'cash', accountId: null, accountName: 'Cash',
        amount: data.amount, debitAmount: '0', creditAmount: data.amount,
        description: `ट्रान्सफर नावे - ${data.narration}`,
      });

      return { cashInTransaction: cashInTx, cashOutTransaction: cashOutTx };
    });
  }

  // Dual-entry accounting operations
  async createCashTransactionWithJournal(transaction: InsertCashTransaction): Promise<{cashTransaction: CashTransaction, journalEntry: JournalEntry}> {
    return await db.transaction(async (tx) => {
      // Convert amount to string for database compatibility
      const dbCompatibleTransaction = {
        ...transaction,
        amount: transaction.amount.toString()
      };
      
      // Create cash transaction
      const [cashTransaction] = await tx
        .insert(cashTransactions)
        .values(dbCompatibleTransaction)
        .returning();

      // Generate journal number
      const journalNumber = `JE-${Date.now()}`;
      
      // Create journal entry
      const [journalEntry] = await tx
        .insert(journalEntries)
        .values({
          tenantId: transaction.tenantId,
          journalNumber,
          transactionDate: transaction.transactionDate,
          description: transaction.narration || `${transaction.transactionType} - ${transaction.category}`,
          totalAmount: transaction.amount.toString(),
          sourceId: cashTransaction.id,
          sourceType: 'cash_transaction'
        })
        .returning();

      // Create journal entry lines (dual-entry) - Fixed to match schema with all required fields
      if (transaction.transactionType === 'cash_in') {
        // Cash In: Cash (Debit) + Party/Income (Credit)
        // Insert debit entry
        await tx.insert(journalEntryLines).values({
          tenantId: transaction.tenantId,
          journalEntryId: journalEntry.id,
          type: 'debit',
          accountType: 'cash',
          accountId: null,
          accountName: 'Cash',
          amount: transaction.amount.toString(),
          debitAmount: transaction.amount.toString(),
          creditAmount: '0',
          description: `Cash received - ${transaction.narration}`
        });
        
        // Insert credit entry
        await tx.insert(journalEntryLines).values({
          tenantId: transaction.tenantId,
          journalEntryId: journalEntry.id,
          type: 'credit',
          accountType: 'party',
          accountId: transaction.partyId,
          accountName: transaction.partyId ? 'Party Account' : 'Income Account',
          amount: transaction.amount.toString(),
          debitAmount: '0',
          creditAmount: transaction.amount.toString(),
          description: `Source of cash - ${transaction.narration}`
        });
      } else {
        // Cash Out: Party/Expense (Debit) + Cash (Credit)
        // Insert debit entry
        await tx.insert(journalEntryLines).values({
          tenantId: transaction.tenantId,
          journalEntryId: journalEntry.id,
          type: 'debit',
          accountType: 'party',
          accountId: transaction.partyId,
          accountName: transaction.partyId ? 'Party Account' : 'Expense Account',
          amount: transaction.amount.toString(),
          debitAmount: transaction.amount.toString(),
          creditAmount: '0',
          description: `Cash paid to - ${transaction.narration}`
        });
        
        // Insert credit entry
        await tx.insert(journalEntryLines).values({
          tenantId: transaction.tenantId,
          journalEntryId: journalEntry.id,
          type: 'credit',
          accountType: 'cash',
          accountId: null,
          accountName: 'Cash',
          amount: transaction.amount.toString(),
          debitAmount: '0',
          creditAmount: transaction.amount.toString(),
          description: `Cash paid out - ${transaction.narration}`
        });
      }

      return { cashTransaction, journalEntry };
    });
  }

  async getJournalEntries(tenantId: string, filters?: { dateFrom?: string; dateTo?: string; sourceType?: string }): Promise<any[]> {
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
      
      const entries = await db.select()
        .from(journalEntries)
        .where(and(...conditions))
        .orderBy(desc(journalEntries.transactionDate));

      // Get lines for each entry
      const entriesWithLines = await Promise.all(
        entries.map(async (entry) => {
          const lines = await db
            .select({
              id: journalEntryLines.id,
              type: sql`CASE WHEN ${journalEntryLines.debitAmount} > 0 THEN 'debit' ELSE 'credit' END`,
              accountName: journalEntryLines.accountName,
              accountId: journalEntryLines.accountId,
              debitAmount: journalEntryLines.debitAmount,
              creditAmount: journalEntryLines.creditAmount,
              amount: sql`CASE WHEN ${journalEntryLines.debitAmount} > 0 THEN ${journalEntryLines.debitAmount} ELSE ${journalEntryLines.creditAmount} END`
            })
            .from(journalEntryLines)
            .where(eq(journalEntryLines.journalEntryId, entry.id));
          
          return { 
            ...entry, 
            entries: lines // Use 'entries' instead of 'lines' for frontend compatibility
          };
        })
      );

      return entriesWithLines;
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      return []; // Return empty array on error
    }
  }

  async getPartyLedger(tenantId: string, partyId: string, dateFrom?: string, dateTo?: string): Promise<any[]> {
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
    })
    .from(journalEntryLines)
    .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
    .where(and(...conditions))
    .orderBy(asc(journalEntries.transactionDate));
  }

  async getTrialBalance(tenantId: string, asOfDate?: string): Promise<any[]> {
    const conditions = [eq(journalEntryLines.tenantId, tenantId)];
    if (asOfDate) {
      conditions.push(lte(journalEntries.transactionDate, asOfDate));
    }
    
    return await db.select({
      accountType: journalEntryLines.accountType,
      accountName: journalEntryLines.accountName,
      totalDebit: sum(journalEntryLines.debitAmount),
      totalCredit: sum(journalEntryLines.creditAmount)
    })
    .from(journalEntryLines)
    .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
    .where(and(...conditions))
    .groupBy(journalEntryLines.accountType, journalEntryLines.accountName)
    .orderBy(journalEntryLines.accountType, journalEntryLines.accountName);
  }

  async getBalanceSheet(tenantId: string, asOfDate: string, fyStartDate: string): Promise<any> {
    const profitLoss = await this.getProfitLoss(tenantId, fyStartDate, asOfDate);

    const activeLoanRows = await db.select({
      totalPrincipal: sum(loans.principalAmount),
      loanCount: count(),
    }).from(loans).where(and(eq(loans.tenantId, tenantId), eq(loans.status, 'active'), lte(loans.loanDate, asOfDate)));
    const totalLoanPrincipal = Number(activeLoanRows[0]?.totalPrincipal || 0);
    const activeLoanCount = Number(activeLoanRows[0]?.loanCount || 0);

    const collectedOnActiveLoans = await db.select({
      totalCollected: sum(transactions.amount),
    }).from(transactions)
      .innerJoin(loans, eq(transactions.loanId, loans.id))
      .where(and(
        eq(loans.tenantId, tenantId),
        eq(loans.status, 'active'),
        eq(transactions.type, 'payment'),
        lte(transactions.transactionDate, asOfDate)
      ));
    const totalCollectedOnActive = Number(collectedOnActiveLoans[0]?.totalCollected || 0);
    const loansAndAdvances = totalLoanPrincipal - totalCollectedOnActive;

    const allLoanPayments = await db.select({
      totalPayments: sum(transactions.amount),
    }).from(transactions)
      .innerJoin(loans, eq(transactions.loanId, loans.id))
      .where(and(
        eq(loans.tenantId, tenantId),
        eq(transactions.type, 'payment'),
        lte(transactions.transactionDate, asOfDate)
      ));
    const totalAllLoanPayments = Number(allLoanPayments[0]?.totalPayments || 0);

    const cashInRows = await db.select({
      total: sum(cashTransactions.amount),
    }).from(cashTransactions).where(and(
      eq(cashTransactions.tenantId, tenantId),
      eq(cashTransactions.transactionType, 'cash_in'),
      lte(cashTransactions.transactionDate, asOfDate)
    ));
    const cashOutRows = await db.select({
      total: sum(cashTransactions.amount),
    }).from(cashTransactions).where(and(
      eq(cashTransactions.tenantId, tenantId),
      eq(cashTransactions.transactionType, 'cash_out'),
      lte(cashTransactions.transactionDate, asOfDate)
    ));
    const cashBookBalance = Number(cashInRows[0]?.total || 0) - Number(cashOutRows[0]?.total || 0);
    const cashBalance = cashBookBalance + totalAllLoanPayments;

    const allParties = await db.select({
      id: parties.id,
      name: parties.name,
      accountType: parties.accountType,
      openingBalance: parties.openingBalance,
      openingBalanceType: parties.openingBalanceType,
    }).from(parties).where(eq(parties.tenantId, tenantId));

    const partyTransactions = await db.select({
      partyId: cashTransactions.partyId,
      transactionType: cashTransactions.transactionType,
      totalAmount: sum(cashTransactions.amount),
    }).from(cashTransactions).where(and(
      eq(cashTransactions.tenantId, tenantId),
      lte(cashTransactions.transactionDate, asOfDate),
      sql`${cashTransactions.partyId} IS NOT NULL`
    )).groupBy(cashTransactions.partyId, cashTransactions.transactionType);

    const partyBalanceMap = new Map<string, { name: string; accountType: string; balance: number }>();
    for (const p of allParties) {
      const ob = Number(p.openingBalance || 0);
      const obSign = p.openingBalanceType === 'debit' ? ob : -ob;
      partyBalanceMap.set(p.id, { name: p.name, accountType: p.accountType, balance: obSign });
    }
    for (const pt of partyTransactions) {
      if (!pt.partyId) continue;
      const existing = partyBalanceMap.get(pt.partyId);
      if (existing) {
        const amt = Number(pt.totalAmount || 0);
        if (pt.transactionType === 'cash_out') {
          existing.balance += amt;
        } else {
          existing.balance -= amt;
        }
      }
    }

    const bankAccounts: { name: string; balance: number }[] = [];
    const fixedAssets: { name: string; balance: number }[] = [];
    const debtors: { name: string; balance: number }[] = [];
    const creditors: { name: string; balance: number }[] = [];

    for (const [, p] of partyBalanceMap) {
      if (p.balance === 0) continue;
      switch (p.accountType) {
        case 'bank':
          bankAccounts.push({ name: p.name, balance: p.balance });
          break;
        case 'asset':
        case 'current_asset':
          fixedAssets.push({ name: p.name, balance: p.balance });
          break;
        case 'customer':
          if (p.balance > 0) debtors.push({ name: p.name, balance: p.balance });
          else creditors.push({ name: p.name, balance: Math.abs(p.balance) });
          break;
        case 'supplier':
          if (p.balance > 0) debtors.push({ name: p.name, balance: p.balance });
          else creditors.push({ name: p.name, balance: Math.abs(p.balance) });
          break;
        case 'income':
          break;
        case 'expense':
          break;
        case 'liability':
        case 'current_liability':
        case 'long_term_liability':
          if (p.balance > 0) debtors.push({ name: p.name, balance: p.balance });
          else creditors.push({ name: p.name, balance: Math.abs(p.balance) });
          break;
        default:
          if (p.balance > 0) debtors.push({ name: p.name, balance: p.balance });
          else if (p.balance < 0) creditors.push({ name: p.name, balance: Math.abs(p.balance) });
          break;
      }
    }

    const capitalBeforeFY_In = await db.select({
      total: sum(cashTransactions.amount),
    }).from(cashTransactions).where(and(
      eq(cashTransactions.tenantId, tenantId),
      eq(cashTransactions.category, 'capital'),
      eq(cashTransactions.transactionType, 'cash_in'),
      sql`${cashTransactions.transactionDate} < ${fyStartDate}`
    ));
    const capitalBeforeFY_Out = await db.select({
      total: sum(cashTransactions.amount),
    }).from(cashTransactions).where(and(
      eq(cashTransactions.tenantId, tenantId),
      eq(cashTransactions.category, 'capital'),
      eq(cashTransactions.transactionType, 'cash_out'),
      sql`${cashTransactions.transactionDate} < ${fyStartDate}`
    ));
    const capitalContributed = Number(capitalBeforeFY_In[0]?.total || 0) - Number(capitalBeforeFY_Out[0]?.total || 0);

    const fyStartDateObj = new Date(fyStartDate);
    fyStartDateObj.setDate(fyStartDateObj.getDate() - 1);
    const dayBeforeFY = fyStartDateObj.toISOString().split('T')[0];
    const priorPL = await this.getProfitLoss(tenantId, '1900-01-01', dayBeforeFY);
    const accumulatedPriorProfit = priorPL.netProfit;

    const openingCapital = capitalContributed + accumulatedPriorProfit;

    const capitalInFY_In = await db.select({
      total: sum(cashTransactions.amount),
    }).from(cashTransactions).where(and(
      eq(cashTransactions.tenantId, tenantId),
      eq(cashTransactions.category, 'capital'),
      eq(cashTransactions.transactionType, 'cash_in'),
      gte(cashTransactions.transactionDate, fyStartDate),
      lte(cashTransactions.transactionDate, asOfDate)
    ));
    const capitalInFY_Out = await db.select({
      total: sum(cashTransactions.amount),
    }).from(cashTransactions).where(and(
      eq(cashTransactions.tenantId, tenantId),
      eq(cashTransactions.category, 'capital'),
      eq(cashTransactions.transactionType, 'cash_out'),
      gte(cashTransactions.transactionDate, fyStartDate),
      lte(cashTransactions.transactionDate, asOfDate)
    ));
    const capitalAdded = Number(capitalInFY_In[0]?.total || 0);
    const capitalWithdrawn = Number(capitalInFY_Out[0]?.total || 0);
    const netProfit = profitLoss.netProfit;
    const closingCapital = openingCapital + capitalAdded - capitalWithdrawn + netProfit;

    const totalBankBalance = bankAccounts.reduce((s, a) => s + a.balance, 0);
    const totalFixedAssets = fixedAssets.reduce((s, a) => s + a.balance, 0);
    const totalDebtors = debtors.reduce((s, a) => s + a.balance, 0);
    const totalCreditors = creditors.reduce((s, a) => s + a.balance, 0);

    const totalAssets = loansAndAdvances + cashBalance + totalBankBalance + totalFixedAssets + totalDebtors;
    const totalLiabilities = closingCapital + totalCreditors;
    const difference = totalAssets - totalLiabilities;

    return {
      asOfDate,
      fyStartDate,
      assets: {
        loansAndAdvances: { total: loansAndAdvances, loanCount: activeLoanCount, principalTotal: totalLoanPrincipal, collected: totalCollectedOnActive },
        cashBalance,
        bankAccounts,
        totalBankBalance,
        fixedAssets,
        totalFixedAssets,
        debtors,
        totalDebtors,
        totalAssets,
      },
      liabilities: {
        capitalAccount: {
          openingCapital,
          capitalAdded,
          capitalWithdrawn,
          netProfit,
          closingCapital,
        },
        creditors,
        totalCreditors,
        totalLiabilities,
      },
      difference,
      isTallied: Math.abs(difference) < 0.01,
    };
  }

  async getProfitLoss(tenantId: string, dateFrom: string, dateTo: string): Promise<any> {
    const interestFromClosures = await db.select({
      totalInterest: sum(loanClosures.interestPaid),
    }).from(loanClosures)
      .innerJoin(loans, eq(loanClosures.loanId, loans.id))
      .where(and(
        eq(loans.tenantId, tenantId),
        gte(loanClosures.closureDate, dateFrom),
        lte(loanClosures.closureDate, dateTo)
      ));
    const interestIncome = Number(interestFromClosures[0]?.totalInterest || 0);

    const allParties = await db.select({
      id: parties.id,
      name: parties.name,
      accountType: parties.accountType,
    }).from(parties).where(and(
      eq(parties.tenantId, tenantId),
      or(eq(parties.accountType, 'income'), eq(parties.accountType, 'expense'))
    ));

    const incomePartyIds = allParties.filter(p => p.accountType === 'income').map(p => p.id);
    const expensePartyIds = allParties.filter(p => p.accountType === 'expense').map(p => p.id);

    const incomeItems: { name: string; amount: number }[] = [];
    const expenseItems: { name: string; amount: number }[] = [];

    if (incomePartyIds.length > 0) {
      const incomeTransactions = await db.select({
        partyId: cashTransactions.partyId,
        transactionType: cashTransactions.transactionType,
        totalAmount: sum(cashTransactions.amount),
      }).from(cashTransactions).where(and(
        eq(cashTransactions.tenantId, tenantId),
        gte(cashTransactions.transactionDate, dateFrom),
        lte(cashTransactions.transactionDate, dateTo),
        inArray(cashTransactions.partyId, incomePartyIds)
      )).groupBy(cashTransactions.partyId, cashTransactions.transactionType);

      const incomeMap = new Map<string, number>();
      for (const t of incomeTransactions) {
        if (!t.partyId) continue;
        const current = incomeMap.get(t.partyId) || 0;
        const amt = Number(t.totalAmount || 0);
        incomeMap.set(t.partyId, current + (t.transactionType === 'cash_in' ? amt : -amt));
      }
      for (const [partyId, amount] of incomeMap) {
        const party = allParties.find(p => p.id === partyId);
        if (party && amount > 0) incomeItems.push({ name: party.name, amount });
      }
    }

    if (expensePartyIds.length > 0) {
      const expenseTransactions = await db.select({
        partyId: cashTransactions.partyId,
        transactionType: cashTransactions.transactionType,
        totalAmount: sum(cashTransactions.amount),
      }).from(cashTransactions).where(and(
        eq(cashTransactions.tenantId, tenantId),
        gte(cashTransactions.transactionDate, dateFrom),
        lte(cashTransactions.transactionDate, dateTo),
        inArray(cashTransactions.partyId, expensePartyIds)
      )).groupBy(cashTransactions.partyId, cashTransactions.transactionType);

      const expenseMap = new Map<string, number>();
      for (const t of expenseTransactions) {
        if (!t.partyId) continue;
        const current = expenseMap.get(t.partyId) || 0;
        const amt = Number(t.totalAmount || 0);
        expenseMap.set(t.partyId, current + (t.transactionType === 'cash_out' ? amt : -amt));
      }
      for (const [partyId, amount] of expenseMap) {
        const party = allParties.find(p => p.id === partyId);
        if (party && amount > 0) expenseItems.push({ name: party.name, amount });
      }
    }

    const generalExpenses = await db.select({
      totalAmount: sum(cashTransactions.amount),
    }).from(cashTransactions).where(and(
      eq(cashTransactions.tenantId, tenantId),
      eq(cashTransactions.category, 'expense'),
      eq(cashTransactions.transactionType, 'cash_out'),
      gte(cashTransactions.transactionDate, dateFrom),
      lte(cashTransactions.transactionDate, dateTo),
      sql`${cashTransactions.partyId} IS NULL`
    ));
    const miscExpenses = Number(generalExpenses[0]?.totalAmount || 0);
    if (miscExpenses > 0) {
      expenseItems.push({ name: 'इतर खर्च', amount: miscExpenses });
    }

    const generalIncome = await db.select({
      totalAmount: sum(cashTransactions.amount),
    }).from(cashTransactions).where(and(
      eq(cashTransactions.tenantId, tenantId),
      eq(cashTransactions.category, 'income'),
      eq(cashTransactions.transactionType, 'cash_in'),
      gte(cashTransactions.transactionDate, dateFrom),
      lte(cashTransactions.transactionDate, dateTo),
      sql`${cashTransactions.partyId} IS NULL`
    ));
    const miscIncome = Number(generalIncome[0]?.totalAmount || 0);
    if (miscIncome > 0) {
      incomeItems.push({ name: 'इतर उत्पन्न', amount: miscIncome });
    }

    const totalIncome = interestIncome + incomeItems.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenseItems.reduce((s, i) => s + i.amount, 0);
    const netProfit = totalIncome - totalExpenses;

    return {
      dateFrom,
      dateTo,
      income: {
        interestIncome,
        otherIncomeItems: incomeItems,
        totalIncome,
      },
      expenses: {
        items: expenseItems,
        totalExpenses,
      },
      netProfit,
      isProfit: netProfit >= 0,
    };
  }

  // Get all users with company details for password reset management
  async getAllUsersWithCompanyDetails(): Promise<any[]> {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        tenantId: users.tenantId,
        lastLoginAt: users.lastLoginAt,
        isActive: users.isActive,
        companyName: companies.name,
      })
      .from(users)
      .leftJoin(companies, eq(users.tenantId, companies.tenantId))
      .orderBy(users.tenantId, users.role, users.username);
    
    return allUsers;
  }

  // Reset user password by user ID (for super admin) - using different signature to avoid duplicate
  async resetUserPasswordBySuperAdmin(userId: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const result = await db
        .update(users)
        .set({ 
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error resetting user password:", error);
      return false;
    }
  }

  // Get storage usage analytics for all tenants (for super admin)
  async getTenantStorageAnalytics(): Promise<any[]> {
    try {
      // Calculate storage usage for each tenant by table
      const storageStats = await db.execute(sql`
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
      
      // Convert bytes to human readable format and add metadata
      const analytics = storageStats.rows.map((row: any) => {
        const totalBytes = parseInt(row.total_storage_bytes) || 0;
        const totalMB = totalBytes / (1024 * 1024);
        const totalGB = totalMB / 1024;
        
        return {
          tenantId: row.tenant_id,
          companyName: row.company_name || 'Unknown Company',
          
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
            parties: parseInt(row.party_count) || 0,
          },
          
          // Storage breakdown
          storage: {
            totalBytes: totalBytes,
            totalMB: Math.round(totalMB * 100) / 100,
            totalGB: Math.round(totalGB * 1000) / 1000,
            formattedSize: totalGB > 1 
              ? `${Math.round(totalGB * 100) / 100} GB`
              : `${Math.round(totalMB)} MB`,
              
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
              parties: Math.round((parseInt(row.parties_storage_bytes) || 0) / (1024 * 1024) * 100) / 100,
            }
          }
        };
      });
      
      return analytics;
    } catch (error) {
      console.error('Error fetching tenant storage analytics:', error);
      return [];
    }
  }

  // Complete tenant deletion with all related data (for super admin)
  async deleteTenantCompletely(tenantId: string): Promise<{success: boolean, deletedRecords: any, errors: string[]}> {
    try {
      if (tenantId === 'SUPER_ADMIN') {
        return {
          success: false,
          deletedRecords: {},
          errors: ['SUPER_ADMIN tenant cannot be deleted']
        };
      }

      const deletedRecords: any = {};
      const errors: string[] = [];

      // Start transaction for complete deletion
      return await db.transaction(async (tx) => {
        try {
          // 1. Delete all loan closures first (has foreign key dependencies)
          const loanClosuresResult = await tx
            .delete(loanClosures)
            .where(eq(loanClosures.tenantId, tenantId));
          deletedRecords.loanClosures = loanClosuresResult.rowCount || 0;

          // 2. Delete all transactions
          const transactionsResult = await tx
            .delete(transactions)
            .where(eq(transactions.tenantId, tenantId));
          deletedRecords.transactions = transactionsResult.rowCount || 0;

          // 3. Delete all cash transactions  
          const cashTransactionsResult = await tx
            .delete(cashTransactions)
            .where(eq(cashTransactions.tenantId, tenantId));
          deletedRecords.cashTransactions = cashTransactionsResult.rowCount || 0;

          // 4. Delete all journal entry lines
          const journalLinesResult = await tx
            .delete(journalEntryLines)
            .where(eq(journalEntryLines.tenantId, tenantId));
          deletedRecords.journalLines = journalLinesResult.rowCount || 0;

          // 5. Delete all journal entries
          const journalEntriesResult = await tx
            .delete(journalEntries)
            .where(eq(journalEntries.tenantId, tenantId));
          deletedRecords.journalEntries = journalEntriesResult.rowCount || 0;

          // 6. Delete all loans
          const loansResult = await tx
            .delete(loans)
            .where(eq(loans.tenantId, tenantId));
          deletedRecords.loans = loansResult.rowCount || 0;

          // 7. Delete all borrowers
          const borrowersResult = await tx
            .delete(borrowers)
            .where(eq(borrowers.tenantId, tenantId));
          deletedRecords.borrowers = borrowersResult.rowCount || 0;

          // 8. Delete all groups
          const groupsResult = await tx
            .delete(groups)
            .where(eq(groups.tenantId, tenantId));
          deletedRecords.groups = groupsResult.rowCount || 0;

          // 9. Delete all parties
          const partiesResult = await tx
            .delete(parties)
            .where(eq(parties.tenantId, tenantId));
          deletedRecords.parties = partiesResult.rowCount || 0;

          // 10. Delete password reset requests (if any exist in future)
          // const resetRequestsResult = await tx
          //   .delete(passwordResetRequests)
          //   .where(eq(passwordResetRequests.tenantId, tenantId));
          // deletedRecords.passwordResetRequests = resetRequestsResult.rowCount || 0;
          deletedRecords.passwordResetRequests = 0;

          // 11. Delete all users (except super admins)
          const usersResult = await tx
            .delete(users)
            .where(
              and(
                eq(users.tenantId, tenantId),
                not(eq(users.role, 'super_admin'))
              )
            );
          deletedRecords.users = usersResult.rowCount || 0;

          // 12. Finally delete the company record
          const companyResult = await tx
            .delete(companies)
            .where(eq(companies.tenantId, tenantId));
          deletedRecords.company = companyResult.rowCount || 0;

          // Calculate total deleted records
          const totalDeleted = Object.values(deletedRecords).reduce((sum: number, count: any) => sum + (count || 0), 0);

          console.log(`🗑️ TENANT DELETION COMPLETE: ${tenantId}`);
          console.log(`📊 Total records deleted: ${totalDeleted}`);
          console.log(`📋 Breakdown:`, deletedRecords);

          return {
            success: true,
            deletedRecords: {
              ...deletedRecords,
              totalDeleted
            },
            errors: []
          };

        } catch (txError) {
          console.error('Transaction error during tenant deletion:', txError);
          errors.push(`Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`);
          throw txError; // This will rollback the transaction
        }
      });

    } catch (error) {
      console.error('Error in complete tenant deletion:', error);
      return {
        success: false,
        deletedRecords: {},
        errors: [`Failed to delete tenant: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  // Get all tenants with basic info for deletion management
  async getAllTenantsForManagement(): Promise<any[]> {
    try {
      const tenantList = await db
        .select({
          tenantId: companies.tenantId,
          companyName: companies.name,
          address: companies.address,
          createdAt: companies.createdAt,
          isActive: companies.isActive,
          subscriptionType: companies.subscriptionType,
          subscriptionStartDate: companies.subscriptionStartDate,
          subscriptionEndDate: companies.subscriptionEndDate,
          subscriptionMonths: companies.subscriptionMonths,
          userCount: sql<number>`(
            SELECT COUNT(*)::int 
            FROM ${users} 
            WHERE ${users.tenantId} = ${companies.tenantId}
          )`,
          activeUserCount: sql<number>`(
            SELECT COUNT(*)::int 
            FROM ${users} 
            WHERE ${users.tenantId} = ${companies.tenantId} 
            AND ${users.isActive} = true
          )`,
          loanCount: sql<number>`(
            SELECT COUNT(*)::int 
            FROM ${loans} 
            WHERE ${loans.tenantId} = ${companies.tenantId}
          )`,
          lastActivity: sql<Date>`(
            SELECT MAX(${users.lastLoginAt}) 
            FROM ${users} 
            WHERE ${users.tenantId} = ${companies.tenantId}
          )`
        })
        .from(companies)
        .where(not(eq(companies.tenantId, 'SUPER_ADMIN')))
        .orderBy(desc(companies.createdAt));

      return tenantList.map(tenant => ({
        ...tenant,
        lastActivity: tenant.lastActivity || tenant.createdAt,
        daysSinceLastActivity: tenant.lastActivity 
          ? Math.floor((Date.now() - new Date(tenant.lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((Date.now() - new Date(tenant.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        isInactive: tenant.lastActivity 
          ? Math.floor((Date.now() - new Date(tenant.lastActivity).getTime()) / (1000 * 60 * 60 * 24)) > 30
          : true
      }));

    } catch (error) {
      console.error('Error fetching tenants for management:', error);
      return [];
    }
  }

  // Super Admin operations implementation
  async getAllSystemUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async getAllSystemTenants(): Promise<{ tenantId: string; companyName: string; adminCount: number; userCount: number; totalLoans: number }[]> {
    // Get all companies with their statistics
    const tenantStats = await db
      .select({
        tenantId: companies.tenantId,
        companyName: companies.name,
      })
      .from(companies)
      .where(not(eq(companies.tenantId, 'SUPER_ADMIN')))
      .orderBy(companies.name);

    const enhancedStats = [];
    for (const tenant of tenantStats) {
      // Count users by role
      const userStats = await db
        .select({
          totalUsers: sql<number>`count(*)`,
          adminCount: sql<number>`count(case when ${users.role} = 'admin' then 1 end)`,
        })
        .from(users)
        .where(eq(users.tenantId, tenant.tenantId));

      // Count loans
      const loanStats = await db
        .select({
          totalLoans: sql<number>`count(*)`
        })
        .from(loans)
        .where(eq(loans.tenantId, tenant.tenantId));

      enhancedStats.push({
        tenantId: tenant.tenantId,
        companyName: tenant.companyName,
        adminCount: userStats[0]?.adminCount || 0,
        userCount: userStats[0]?.totalUsers || 0,
        totalLoans: loanStats[0]?.totalLoans || 0,
      });
    }

    return enhancedStats;
  }

  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(users.username);
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    return user || undefined;
  }

  async findUserByTenantAndUsername(tenantId: string, username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.username, username)
      ));
    return user || undefined;
  }

  // Photo operations implementation
  async saveLoanPhoto(photoData: InsertLoanPhoto): Promise<LoanPhoto> {
    const [savedPhoto] = await db.insert(loanPhotos).values(photoData).returning();
    return savedPhoto;
  }

  async getLoanPhotos(loanId: string, tenantId: string): Promise<LoanPhoto[]> {
    console.log(`🔍 STORAGE DEBUG: getLoanPhotos called with loanId="${loanId}", tenantId="${tenantId}"`);
    
    const result = await db.select().from(loanPhotos).where(
      and(
        eq(loanPhotos.loanId, loanId),
        eq(loanPhotos.tenantId, tenantId),
        eq(loanPhotos.isActive, true)
      )
    );
    
    console.log(`📊 STORAGE RESULT: Found ${result.length} photos for loan ${loanId}`);
    if (result.length > 0) {
      console.log(`📸 FIRST PHOTO: ${JSON.stringify(result[0], null, 2)}`);
    }
    
    return result;
  }

  async deleteLoanPhotos(loanId: string, tenantId: string): Promise<boolean> {
    const result = await db.update(loanPhotos)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(loanPhotos.loanId, loanId),
          eq(loanPhotos.tenantId, tenantId)
        )
      );
    return true;
  }

  async updatePhotoStatus(photoId: string, tenantId: string, isActive: boolean): Promise<boolean> {
    const result = await db.update(loanPhotos)
      .set({ isActive, updatedAt: new Date() })
      .where(
        and(
          eq(loanPhotos.id, photoId),
          eq(loanPhotos.tenantId, tenantId)
        )
      );
    return true;
  }

  async toggleTenantActive(tenantId: string, isActive: boolean): Promise<void> {
    await db.update(companies)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(companies.tenantId, tenantId));
  }

  async createPasswordResetRequest(data: {
    tenantId: string;
    username: string;
    adminId?: string;
    userRole?: string;
    reason?: string;
  }): Promise<any> {
    const [request] = await db.insert(passwordResetRequests)
      .values({
        tenantId: data.tenantId,
        username: data.username,
        adminId: data.adminId || null,
        userRole: data.userRole || null,
        reason: data.reason || null,
        status: 'pending',
      })
      .returning();
    return request;
  }

  async getPendingPasswordResetRequests(): Promise<any[]> {
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
      companyName: sql<string>`(
        SELECT ${companies.name} FROM ${companies} 
        WHERE ${companies.tenantId} = ${passwordResetRequests.tenantId}
        LIMIT 1
      )`,
    })
    .from(passwordResetRequests)
    .where(eq(passwordResetRequests.status, 'pending'))
    .orderBy(desc(passwordResetRequests.createdAt));
    return requests;
  }

  async getPasswordResetRequestById(requestId: string): Promise<any> {
    const [request] = await db.select()
      .from(passwordResetRequests)
      .where(eq(passwordResetRequests.id, requestId));
    return request || null;
  }

  async completePasswordResetRequest(requestId: string, completedBy: string): Promise<void> {
    await db.update(passwordResetRequests)
      .set({ 
        status: 'completed', 
        completedBy, 
        completedAt: new Date() 
      })
      .where(eq(passwordResetRequests.id, requestId));
  }
}

export const storage = new DatabaseStorage();
