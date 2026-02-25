import { db } from "./db";
import { createHash } from "crypto";
import { 
  loans, loanClosures, cashTransactions, parties, borrowers, groups, transactions,
  companies, users, userPermissions, userActivityLogs, journalEntries, journalEntryLines,
  loanPhotos, tenantStorageSettings, type Loan, type LoanClosure, type CashTransaction 
} from "@shared/schema";
import { eq, and, sql, desc, asc, ne, or, inArray } from "drizzle-orm";
import { storage } from "./storage";
import { NarrationEngine } from "./narration-engine";
import { PhotoService } from "./photo-service";

export interface DataManagementResult {
  success: boolean;
  message: string;
  affectedRecords: number;
  details: any[];
  backupCreated?: boolean;
  backupId?: string;
  backupData?: any;
}

export interface LoanCleanupOptions {
  dateFrom?: string;
  dateTo?: string;
  includeAssociatedTransactions: boolean;
  createBackup: boolean;
  borrowerIds?: string[];
  accountNumbers?: string[];
}

export class DataManagementService {
  
  /**
   * Rearrange account numbers for a group by loan disbursement date
   */
  async previewRearrangeAccountNumbers(tenantId: string, groupId: string, upToDate?: string): Promise<any> {
    try {
      console.log(`🔢 REARRANGE PREVIEW: Generating preview for group ${groupId} in tenant ${tenantId}, upToDate: ${upToDate || 'all'}`);

      const conditions = [
        eq(loans.tenantId, tenantId),
        eq(loans.groupId, groupId),
        eq(loans.status, 'active')
      ];

      if (upToDate) {
        conditions.push(sql`DATE(${loans.loanDate}) <= DATE(${upToDate})`);
      }

      const loansInGroup = await db.select()
        .from(loans)
        .where(and(...conditions))
        .orderBy(asc(loans.loanDate));

      if (loansInGroup.length === 0) {
        return {
          success: false,
          message: "या ग्रुप मध्ये कोणते सक्रिय कर्ज नाहीत" + (upToDate ? ` (${upToDate} पर्यंत)` : ""),
          mapping: []
        };
      }

      const mapping = loansInGroup.map((loan: any, i: number) => ({
        loanId: loan.id,
        loanDate: loan.loanDate,
        borrowerName: loan.borrowerName,
        oldAccountNumber: loan.accountNumber || '-',
        newAccountNumber: (i + 1).toString()
      }));

      const checksumData = loansInGroup.map((l: any) => `${l.id}:${l.loanDate}:${l.accountNumber}`).join('|');
      const checksum = createHash('sha256').update(checksumData).digest('hex').substring(0, 16);

      return {
        success: true,
        message: `${loansInGroup.length} कर्ज सापडले`,
        totalLoans: loansInGroup.length,
        checksum,
        mapping
      };

    } catch (error) {
      console.error("❌ Rearrange preview failed:", error);
      return {
        success: false,
        message: "Preview अयशस्वी: " + (error as Error).message,
        mapping: []
      };
    }
  }

  async confirmRearrangeAccountNumbers(tenantId: string, groupId: string, upToDate?: string, checksum?: string): Promise<DataManagementResult> {
    try {
      console.log(`🔢 REARRANGE CONFIRM: Applying changes for group ${groupId} in tenant ${tenantId}, upToDate: ${upToDate || 'all'}`);
      console.log(`⚠️ SAFETY: Only updating manual accountNumber field, NOT system IDs (id, loanNumber)`);

      const conditions = [
        eq(loans.tenantId, tenantId),
        eq(loans.groupId, groupId),
        eq(loans.status, 'active')
      ];

      if (upToDate) {
        conditions.push(sql`DATE(${loans.loanDate}) <= DATE(${upToDate})`);
      }

      const loansInGroup = await db.select()
        .from(loans)
        .where(and(...conditions))
        .orderBy(asc(loans.loanDate));

      if (loansInGroup.length === 0) {
        return {
          success: false,
          message: "या ग्रुप मध्ये कोणते सक्रिय कर्ज नाहीत",
          affectedRecords: 0,
          details: []
        };
      }

      if (checksum) {
        const currentChecksumData = loansInGroup.map((l: any) => `${l.id}:${l.loanDate}:${l.accountNumber}`).join('|');
        const currentChecksum = createHash('sha256').update(currentChecksumData).digest('hex').substring(0, 16);
        if (currentChecksum !== checksum) {
          return {
            success: false,
            message: "Preview नंतर डेटा बदलला आहे. कृपया पुन्हा Preview बघा.",
            affectedRecords: 0,
            details: [{ reason: 'checksum_mismatch' }]
          };
        }
      }

      let updatedCount = 0;
      for (let i = 0; i < loansInGroup.length; i++) {
        const loan = loansInGroup[i];
        const newAccountNumber = (i + 1).toString();

        if (loan.accountNumber !== newAccountNumber) {
          await db.update(loans)
            .set({ 
              accountNumber: newAccountNumber,
              updatedAt: sql`now()`
            })
            .where(and(
              eq(loans.tenantId, tenantId),
              eq(loans.id, loan.id)
            ));

          console.log(`✅ MANUAL ACCOUNT UPDATE: ${loan.accountNumber} → ${newAccountNumber} (${loan.borrowerName})`);
          updatedCount++;
        }
      }

      return {
        success: true,
        message: `${loansInGroup.length} कर्जांचे खाते क्रमांक यशस्वीपणे रिअरेंज केले (${updatedCount} बदल)`,
        affectedRecords: updatedCount,
        details: [{ 
          totalLoans: loansInGroup.length, 
          updatedLoans: updatedCount,
          groupId: groupId 
        }]
      };

    } catch (error) {
      console.error("❌ Account rearrangement failed:", error);
      return {
        success: false,
        message: "खाते क्रमांक रिअरेंज करण्यात अयशस्वी: " + (error as Error).message,
        affectedRecords: 0,
        details: []
      };
    }
  }

  async rearrangeAccountNumbers(tenantId: string, groupId: string): Promise<DataManagementResult> {
    return this.confirmRearrangeAccountNumbers(tenantId, groupId);
  }
  
  /**
   * संपूर्ण loan closure data cleanup with proper accounting integration
   */
  async cleanupClosedLoansData(tenantId: string, options: LoanCleanupOptions): Promise<DataManagementResult> {
    try {
      const results: any[] = [];
      let totalAffected = 0;

      // Step 1: Create comprehensive backup if requested
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

      // Step 2: Get all closed loans with comprehensive filters using closure date
      const closedLoansQuery = db.select({
        loan: loans,
        closure: loanClosures
      }).from(loans)
        .innerJoin(loanClosures, eq(loans.id, loanClosures.loanId))
        .where(and(
          eq(loans.tenantId, tenantId),
          eq(loans.status, 'closed')
        ));

      const closedLoansWithClosure = await closedLoansQuery;
      
      // Apply date filters based on closure date (not loan date)
      let filteredLoans = closedLoansWithClosure.map(row => row.loan);
      
      if (options.dateFrom || options.dateTo) {
        filteredLoans = closedLoansWithClosure
          .filter(row => {
            const closureDate = new Date(row.closure.closureDate);
            if (options.dateFrom && closureDate < new Date(options.dateFrom)) return false;
            if (options.dateTo && closureDate > new Date(options.dateTo)) return false;
            return true;
          })
          .map(row => row.loan);
      }

      if (options.borrowerIds?.length) {
        filteredLoans = filteredLoans.filter(loan => 
          options.borrowerIds!.includes(loan.borrowerId!)
        );
      }

      // Step 3: For each closed loan, perform comprehensive cleanup
      for (const loan of filteredLoans) {
        const loanCleanupResult = await this.cleanupSingleLoanData(
          tenantId, 
          loan, 
          options.includeAssociatedTransactions
        );
        
        results.push(loanCleanupResult);
        totalAffected += loanCleanupResult.affectedRecords;
      }

      // Step 4: Verify data integrity after cleanup
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
        message: "Data cleanup failed: " + (error as Error).message,
        affectedRecords: 0,
        details: []
      };
    }
  }

  /**
   * Single loan comprehensive cleanup with precise data targeting
   * Only removes data specifically related to the closed loan - no other entries affected
   */
  private async cleanupSingleLoanData(
    tenantId: string, 
    loan: Loan, 
    includeTransactions: boolean
  ): Promise<DataManagementResult> {
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

      console.log(`🧹 CLEANUP: Starting cleanup for loan ${loan.accountNumber} (${loan.borrowerName})`);

      // Photo cleanup first (file system operations cannot be rolled back by DB transaction)
      console.log(`📸 PHOTO CLEANUP: Starting photo deletion for loan ${loan.accountNumber}`);
      try {
        const photoCleanupResult = await PhotoService.deletePhotosForLoan(db, loan.id, tenantId);
        affectedRecords.loanPhotos = photoCleanupResult.deletedRecords;
        console.log(`✅ Deleted ${photoCleanupResult.deletedFiles} photo files and ${photoCleanupResult.deletedRecords} photo records`);
      } catch (photoError) {
        console.warn(`⚠️ Photo cleanup warning for loan ${loan.accountNumber}:`, photoError);
      }

      // All DB operations wrapped in transaction for atomicity
      await db.transaction(async (tx) => {
        // Delete loan closure records
        const deletedClosures = await tx.delete(loanClosures)
          .where(and(
            eq(loanClosures.tenantId, tenantId),
            eq(loanClosures.loanId, loan.id)
          ));
        affectedRecords.loanClosures = deletedClosures.rowCount || 0;

        // Delete transactions table entries
        const deletedTransactions = await tx.delete(transactions)
          .where(and(
            eq(transactions.tenantId, tenantId),
            eq(transactions.loanId, loan.id)
          ));
        affectedRecords.transactions = deletedTransactions.rowCount || 0;

        // Delete associated cash transactions and journal entries if requested
        if (includeTransactions) {
          const deletedCashTx = await tx.delete(cashTransactions)
            .where(and(
              eq(cashTransactions.tenantId, tenantId),
              or(
                sql`${cashTransactions.narration} LIKE '%खाते क्र. ${loan.accountNumber}%'`,
                sql`${cashTransactions.narration} LIKE '%Account ${loan.accountNumber}%'`,
                sql`${cashTransactions.narration} LIKE '%A/c ${loan.accountNumber}%'`,
                sql`${cashTransactions.narration} LIKE '%कर्ज वितरण%' AND ${cashTransactions.narration} LIKE '%${loan.borrowerName}%'`,
                sql`${cashTransactions.narration} LIKE '%कर्ज जमा%' AND ${cashTransactions.narration} LIKE '%${loan.borrowerName}%'`,
                sql`${cashTransactions.narration} LIKE '%कर्ज बंद%' AND ${cashTransactions.narration} LIKE '%${loan.borrowerName}%'`
              )
            ));
          affectedRecords.cashTransactions = deletedCashTx.rowCount || 0;

          // Find journal entries to delete their lines first
          const loanRelatedJournalEntries = await tx.select()
            .from(journalEntries)
            .where(and(
              eq(journalEntries.tenantId, tenantId),
              or(
                sql`${journalEntries.description} LIKE '%खाते क्र. ${loan.accountNumber}%'`,
                sql`${journalEntries.description} LIKE '%Account ${loan.accountNumber}%'`,
                sql`${journalEntries.description} LIKE '%${loan.borrowerName}%' AND ${journalEntries.description} LIKE '%कर्ज%'`
              )
            ));

          if (loanRelatedJournalEntries.length > 0) {
            for (const entry of loanRelatedJournalEntries) {
              await tx.delete(journalEntryLines)
                .where(and(
                  eq(journalEntryLines.tenantId, tenantId),
                  eq(journalEntryLines.journalEntryId, entry.id)
                ));
            }

            await tx.delete(journalEntries)
              .where(and(
                eq(journalEntries.tenantId, tenantId),
                or(
                  sql`${journalEntries.description} LIKE '%खाते क्र. ${loan.accountNumber}%'`,
                  sql`${journalEntries.description} LIKE '%Account ${loan.accountNumber}%'`,
                  sql`${journalEntries.description} LIKE '%${loan.borrowerName}%' AND ${journalEntries.description} LIKE '%कर्ज%'`
                )
              ));
            affectedRecords.journalEntries = loanRelatedJournalEntries.length;
          }
        }

        // Delete activity logs
        const deletedActivityLogs = await tx.delete(userActivityLogs)
          .where(and(
            eq(userActivityLogs.tenantId, tenantId),
            or(
              sql`${userActivityLogs.description} LIKE '%खाते क्र. ${loan.accountNumber}%'`,
              sql`${userActivityLogs.description} LIKE '%Account ${loan.accountNumber}%'`,
              sql`${userActivityLogs.description} LIKE '%${loan.borrowerName}%'`,
              sql`${userActivityLogs.metadata} LIKE '%"loanId":"${loan.id}"%'`,
              sql`${userActivityLogs.metadata} LIKE '%"accountNumber":"${loan.accountNumber}"%'`
            )
          ));
        affectedRecords.activityLogs = deletedActivityLogs.rowCount || 0;

        // Delete loan photo DB records (files already deleted above)
        await tx.delete(loanPhotos)
          .where(and(
            eq(loanPhotos.tenantId, tenantId),
            eq(loanPhotos.loanId, loan.id)
          ));

        // Check if borrower has other active loans
        const otherActiveLoans = await tx.select()
          .from(loans)
          .where(and(
            eq(loans.tenantId, tenantId),
            eq(loans.borrowerId, loan.borrowerId!),
            ne(loans.id, loan.id),
            eq(loans.status, 'active')
          ));

        // Delete the loan record
        await tx.delete(loans)
          .where(and(
            eq(loans.tenantId, tenantId),
            eq(loans.id, loan.id)
          ));
        affectedRecords.loanRecord = 1;

        // Delete borrower only if no other active loans
        if (otherActiveLoans.length === 0 && loan.borrowerId) {
          await tx.delete(borrowers)
            .where(and(
              eq(borrowers.tenantId, tenantId),
              eq(borrowers.id, loan.borrowerId)
            ));
          affectedRecords.borrowerRecord = 1;
        }
      });

      const totalAffected = affectedRecords.loanClosures + affectedRecords.cashTransactions + 
                           affectedRecords.journalEntries + affectedRecords.transactions + 
                           affectedRecords.loanPhotos + affectedRecords.activityLogs +
                           affectedRecords.loanRecord + affectedRecords.borrowerRecord;

      console.log(`🎯 CLEANUP COMPLETE: ${totalAffected} total records cleaned for loan ${loan.accountNumber}`);

      return {
        success: true,
        message: `Successfully cleaned loan ${loan.accountNumber} (${loan.borrowerName}) - ${totalAffected} records removed`,
        affectedRecords: totalAffected,
        details: [affectedRecords]
      };

    } catch (error) {
      console.error(`❌ CLEANUP FAILED for loan ${loan.accountNumber}:`, error);
      return {
        success: false,
        message: `Failed to cleanup loan ${loan.accountNumber}: ${(error as Error).message}`,
        affectedRecords: 0,
        details: []
      };
    }
  }

  /**
   * Create comprehensive system backup - Updated August 2025
   */
  async createComprehensiveBackup(tenantId: string): Promise<DataManagementResult> {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fullTimestamp = new Date().toISOString();
      
      // Fetch all tenant data from all tables
      const backupData = {
        timestamp: fullTimestamp,
        tenantId,
        version: "2.0",
        schema: "comprehensive_backup_aug_2025",
        data: {
          // Core business tables
          companies: await db.select().from(companies).where(eq(companies.tenantId, tenantId)),
          groups: await db.select().from(groups).where(eq(groups.tenantId, tenantId)),
          borrowers: await db.select().from(borrowers).where(eq(borrowers.tenantId, tenantId)),
          loans: await db.select().from(loans).where(eq(loans.tenantId, tenantId)),
          transactions: await db.select().from(transactions).where(eq(transactions.tenantId, tenantId)),
          loanClosures: await db.select().from(loanClosures).where(eq(loanClosures.tenantId, tenantId)),
          loanPhotos: await db.select().from(loanPhotos).where(eq(loanPhotos.tenantId, tenantId)),
          
          // Financial system tables
          parties: await db.select().from(parties).where(eq(parties.tenantId, tenantId)),
          cashTransactions: await db.select().from(cashTransactions).where(eq(cashTransactions.tenantId, tenantId)),
          journalEntries: await db.select().from(journalEntries).where(eq(journalEntries.tenantId, tenantId)),
          journalEntryLines: await db.select().from(journalEntryLines).where(eq(journalEntryLines.tenantId, tenantId)),
          
          // User management tables (except for SUPER_ADMIN tenant to preserve user data)
          users: tenantId !== 'SUPER_ADMIN' ? await db.select().from(users).where(eq(users.tenantId, tenantId)) : [],
          userPermissions: tenantId !== 'SUPER_ADMIN' ? await db.select().from(userPermissions).where(eq(userPermissions.tenantId, tenantId)) : [],
          userActivityLogs: tenantId !== 'SUPER_ADMIN' ? await db.select().from(userActivityLogs).where(eq(userActivityLogs.tenantId, tenantId)) : [],
          
          // Storage settings
          tenantStorageSettings: await db.select().from(tenantStorageSettings).where(eq(tenantStorageSettings.tenantId, tenantId))
        }
      };

      const totalRecords = Object.values(backupData.data).reduce((sum, table) => sum + table.length, 0);
      const backupId = `backup_${tenantId}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`📦 COMPREHENSIVE BACKUP: Created for ${tenantId} on ${timestamp}`);
      console.log(`📊 BACKUP STATS: ${totalRecords} records across ${Object.keys(backupData.data).length} tables`);
      
      const backupFile = JSON.stringify(backupData, null, 2);
      console.log(`💾 BACKUP SIZE: ${(backupFile.length / 1024 / 1024).toFixed(2)} MB`);

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
      console.error("❌ BACKUP FAILED:", error);
      return {
        success: false,
        message: "Backup creation failed: " + (error as Error).message,
        affectedRecords: 0,
        details: []
      };
    }
  }

  /**
   * Comprehensive data restore system - Updated August 2025
   */
  async restoreFromBackup(tenantId: string, backupData: any): Promise<DataManagementResult> {
    try {
      console.log(`🔄 RESTORE: Starting comprehensive restore for ${tenantId}`);
      
      // Validate backup data structure
      if (!backupData || !backupData.data || !backupData.version) {
        throw new Error("Invalid backup data format");
      }

      if (backupData.tenantId !== tenantId) {
        throw new Error("Backup tenant ID does not match current tenant");
      }

      let restoredRecords = 0;
      const restoreResults: any[] = [];

      // Step 1: Clear existing data (in reverse dependency order) - wrapped in transaction for safety
      console.log("🧹 STEP 1: Clearing existing data...");
      
      await db.transaction(async (tx) => {
        // Clear dependent tables first
        await tx.delete(journalEntryLines).where(eq(journalEntryLines.tenantId, tenantId));
        await tx.delete(journalEntries).where(eq(journalEntries.tenantId, tenantId));
        await tx.delete(cashTransactions).where(eq(cashTransactions.tenantId, tenantId));
        await tx.delete(loanClosures).where(eq(loanClosures.tenantId, tenantId));
        await tx.delete(transactions).where(eq(transactions.tenantId, tenantId));
        await tx.delete(loanPhotos).where(eq(loanPhotos.tenantId, tenantId));
        await tx.delete(loans).where(eq(loans.tenantId, tenantId));
        await tx.delete(borrowers).where(eq(borrowers.tenantId, tenantId));
        await tx.delete(parties).where(eq(parties.tenantId, tenantId));
        await tx.delete(groups).where(eq(groups.tenantId, tenantId));
        await tx.delete(companies).where(eq(companies.tenantId, tenantId));
        await tx.delete(tenantStorageSettings).where(eq(tenantStorageSettings.tenantId, tenantId));
        
        // Clear user data only for non-SUPER_ADMIN tenants
        if (tenantId !== 'SUPER_ADMIN') {
          await tx.delete(userActivityLogs).where(eq(userActivityLogs.tenantId, tenantId));
          await tx.delete(userPermissions).where(eq(userPermissions.tenantId, tenantId));
          await tx.delete(users).where(eq(users.tenantId, tenantId));
        }

        console.log("✅ STEP 1 COMPLETE: Existing data cleared");

        // Step 2: Restore data in dependency order
        console.log("📥 STEP 2: Restoring data...");

        if (backupData.data.companies?.length > 0) {
          await tx.insert(companies).values(backupData.data.companies);
          restoredRecords += backupData.data.companies.length;
          restoreResults.push({ table: 'companies', records: backupData.data.companies.length });
        }

        if (backupData.data.groups?.length > 0) {
          await tx.insert(groups).values(backupData.data.groups);
          restoredRecords += backupData.data.groups.length;
          restoreResults.push({ table: 'groups', records: backupData.data.groups.length });
        }

        if (backupData.data.borrowers?.length > 0) {
          await tx.insert(borrowers).values(backupData.data.borrowers);
          restoredRecords += backupData.data.borrowers.length;
          restoreResults.push({ table: 'borrowers', records: backupData.data.borrowers.length });
        }

        if (backupData.data.parties?.length > 0) {
          await tx.insert(parties).values(backupData.data.parties);
          restoredRecords += backupData.data.parties.length;
          restoreResults.push({ table: 'parties', records: backupData.data.parties.length });
        }

        if (backupData.data.loans?.length > 0) {
          await tx.insert(loans).values(backupData.data.loans);
          restoredRecords += backupData.data.loans.length;
          restoreResults.push({ table: 'loans', records: backupData.data.loans.length });
        }

        if (backupData.data.loanPhotos?.length > 0) {
          await tx.insert(loanPhotos).values(backupData.data.loanPhotos);
          restoredRecords += backupData.data.loanPhotos.length;
          restoreResults.push({ table: 'loanPhotos', records: backupData.data.loanPhotos.length });
        }

        if (backupData.data.transactions?.length > 0) {
          await tx.insert(transactions).values(backupData.data.transactions);
          restoredRecords += backupData.data.transactions.length;
          restoreResults.push({ table: 'transactions', records: backupData.data.transactions.length });
        }

        if (backupData.data.loanClosures?.length > 0) {
          await tx.insert(loanClosures).values(backupData.data.loanClosures);
          restoredRecords += backupData.data.loanClosures.length;
          restoreResults.push({ table: 'loanClosures', records: backupData.data.loanClosures.length });
        }

        if (backupData.data.cashTransactions?.length > 0) {
          await tx.insert(cashTransactions).values(backupData.data.cashTransactions);
          restoredRecords += backupData.data.cashTransactions.length;
          restoreResults.push({ table: 'cashTransactions', records: backupData.data.cashTransactions.length });
        }

        if (backupData.data.journalEntries?.length > 0) {
          await tx.insert(journalEntries).values(backupData.data.journalEntries);
          restoredRecords += backupData.data.journalEntries.length;
          restoreResults.push({ table: 'journalEntries', records: backupData.data.journalEntries.length });
        }

        if (backupData.data.journalEntryLines?.length > 0) {
          await tx.insert(journalEntryLines).values(backupData.data.journalEntryLines);
          restoredRecords += backupData.data.journalEntryLines.length;
          restoreResults.push({ table: 'journalEntryLines', records: backupData.data.journalEntryLines.length });
        }

        // Restore user data for non-SUPER_ADMIN tenants
        if (tenantId !== 'SUPER_ADMIN') {
          if (backupData.data.users?.length > 0) {
            await tx.insert(users).values(backupData.data.users);
            restoredRecords += backupData.data.users.length;
            restoreResults.push({ table: 'users', records: backupData.data.users.length });
          }

          if (backupData.data.userPermissions?.length > 0) {
            await tx.insert(userPermissions).values(backupData.data.userPermissions);
            restoredRecords += backupData.data.userPermissions.length;
            restoreResults.push({ table: 'userPermissions', records: backupData.data.userPermissions.length });
          }

          if (backupData.data.userActivityLogs?.length > 0) {
            await tx.insert(userActivityLogs).values(backupData.data.userActivityLogs);
            restoredRecords += backupData.data.userActivityLogs.length;
            restoreResults.push({ table: 'userActivityLogs', records: backupData.data.userActivityLogs.length });
          }
        }

        // Restore tenant storage settings
        if (backupData.data.tenantStorageSettings?.length > 0) {
          await tx.insert(tenantStorageSettings).values(backupData.data.tenantStorageSettings);
          restoredRecords += backupData.data.tenantStorageSettings.length;
          restoreResults.push({ table: 'tenantStorageSettings', records: backupData.data.tenantStorageSettings.length });
        }
      });

      console.log(`✅ RESTORE COMPLETE: ${restoredRecords} records restored across ${restoreResults.length} tables (transaction committed)`);

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
          restoreTimestamp: new Date().toISOString()
        }]
      };

    } catch (error) {
      console.error("❌ RESTORE FAILED:", error);
      return {
        success: false,
        message: "Data restore failed: " + (error as Error).message,
        affectedRecords: 0,
        details: []
      };
    }
  }

  /**
   * Comprehensive data integrity verification
   */
  async performIntegrityCheck(tenantId: string): Promise<DataManagementResult> {
    try {
      const issues: string[] = [];
      let totalChecks = 0;

      // Check 1: Orphaned loan closures
      const orphanedClosures = await db.select()
        .from(loanClosures)
        .leftJoin(loans, eq(loanClosures.loanId, loans.id))
        .where(and(
          eq(loanClosures.tenantId, tenantId),
          sql`${loans.id} IS NULL`
        ));

      if (orphanedClosures.length > 0) {
        issues.push(`Found ${orphanedClosures.length} orphaned loan closures`);
      }
      totalChecks++;

      // Check 2: Inconsistent loan status
      const inconsistentLoans = await db.select()
        .from(loans)
        .leftJoin(loanClosures, eq(loans.id, loanClosures.loanId))
        .where(and(
          eq(loans.tenantId, tenantId),
          sql`(${loans.status} = 'closed' AND ${loanClosures.id} IS NULL) OR (${loans.status} != 'closed' AND ${loanClosures.id} IS NOT NULL)`
        ));

      if (inconsistentLoans.length > 0) {
        issues.push(`Found ${inconsistentLoans.length} loans with inconsistent status`);
      }
      totalChecks++;

      // Check 3: Cash transaction balance verification
      const balanceVerification = await storage.getProfessionalCashBalance(tenantId);
      if (!balanceVerification.isValid) {
        issues.push(`Cash balance verification failed: ${balanceVerification.errors.join(', ')}`);
      }
      totalChecks++;

      // Check 4: Duplicate prevention verification
      const duplicateCheck = await this.checkForDuplicateTransactions(tenantId);
      if (duplicateCheck.duplicatesFound > 0) {
        issues.push(`Found ${duplicateCheck.duplicatesFound} potential duplicate transactions`);
      }
      totalChecks++;

      return {
        success: issues.length === 0,
        message: issues.length === 0 ? 
          `All ${totalChecks} integrity checks passed` : 
          `Found ${issues.length} integrity issues`,
        affectedRecords: issues.length,
        details: issues.map(issue => ({ issue }))
      };

    } catch (error) {
      return {
        success: false,
        message: "Integrity verification failed: " + (error as Error).message,
        affectedRecords: 0,
        details: []
      };
    }
  }

  /**
   * Check for duplicate transactions
   */
  private async checkForDuplicateTransactions(tenantId: string): Promise<{duplicatesFound: number, details: any[]}> {
    try {
      const transactions = await db.select()
        .from(cashTransactions)
        .where(eq(cashTransactions.tenantId, tenantId))
        .orderBy(asc(cashTransactions.transactionDate));

      const seenTransactions = new Map<string, any[]>();
      let duplicatesFound = 0;
      const duplicateDetails: any[] = [];

      transactions.forEach(transaction => {
        const key = `${transaction.transactionDate}_${transaction.amount}_${transaction.transactionType}_${transaction.narration}`;
        
        if (!seenTransactions.has(key)) {
          seenTransactions.set(key, []);
        }
        
        seenTransactions.get(key)!.push(transaction);
      });

      seenTransactions.forEach((transactions, key) => {
        if (transactions.length > 1) {
          duplicatesFound += transactions.length - 1;
          duplicateDetails.push({
            key,
            count: transactions.length,
            transactions: transactions.map(t => ({
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
  async reconcileAccountingData(tenantId: string, options: { force?: boolean; createBackup?: boolean } = {}): Promise<DataManagementResult> {
    try {
      const results: any[] = [];
      
      // Step 1: Reconcile loan disbursements with cash transactions
      const disbursementReconciliation = await this.reconcileLoanDisbursements(tenantId);
      results.push(disbursementReconciliation);

      // Step 2: Reconcile loan closures with cash transactions
      const closureReconciliation = await this.reconcileLoanClosures(tenantId);
      results.push(closureReconciliation);

      // Step 3: Verify opening balances consistency
      const balanceReconciliation = await this.reconcileOpeningBalances(tenantId);
      results.push(balanceReconciliation);

      const totalAffected = results.reduce((sum, result) => sum + result.affectedRecords, 0);

      return {
        success: results.every(r => r.success),
        message: `Accounting reconciliation completed`,
        affectedRecords: totalAffected,
        details: results
      };

    } catch (error) {
      return {
        success: false,
        message: "Reconciliation failed: " + (error as Error).message,
        affectedRecords: 0,
        details: []
      };
    }
  }

  private async reconcileLoanDisbursements(tenantId: string): Promise<DataManagementResult> {
    const loansData = await db.select().from(loans).where(eq(loans.tenantId, tenantId));
    let reconciledCount = 0;
    
    for (const loan of loansData) {
      const disbursementTransaction = await db.select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, tenantId),
          sql`${cashTransactions.narration} LIKE '%${loan.accountNumber}%'`,
          eq(cashTransactions.transactionType, 'cash_out'),
          sql`${cashTransactions.amount} = ${loan.principalAmount}`
        ))
        .limit(1);

      if (disbursementTransaction.length === 0) {
        console.log(`🚫 DATA-MANAGEMENT DISABLED: Cash transaction creation disabled for account ${loan.accountNumber} to prevent duplicates`);
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

  async getMissingDisbursementEntries(tenantId: string): Promise<{
    success: boolean;
    missingCount: number;
    totalMissingAmount: number;
    loans: Array<{ id: number; accountNumber: string; borrowerName: string; groupName: string; loanDate: string; principalAmount: number }>;
    mismatches: Array<{ id: number; accountNumber: string; borrowerName: string; groupName: string; loanDate: string; principalAmount: number; cashEntryId: string; cashEntryAmount: number }>;
    duplicates: Array<{ id: number; accountNumber: string; borrowerName: string; loanDate: string; principalAmount: number; cashEntryIds: string[]; cashEntryAmounts: number[] }>;
    summary: { missingCount: number; mismatchCount: number; duplicateCount: number; totalDiscrepancy: number };
  }> {
    try {
      const loansData = await db.select().from(loans).where(eq(loans.tenantId, tenantId));
      const missingLoans: any[] = [];
      const mismatches: any[] = [];
      const duplicates: any[] = [];

      // Load ALL disbursement entries ONCE for this tenant (avoid N+1 queries)
      const allDisbursements = await db.select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, tenantId),
          eq(cashTransactions.transactionType, 'cash_out'),
          eq(cashTransactions.category, 'loan_disbursement')
        ));

      // GROUP loans by account number — critical for handling multiple loans sharing same account
      // Per-loan processing caused INFINITE CYCLE: each loan deleted the other's entry then recreated it
      const loansByAccount = new Map<string, typeof loansData>();
      for (const loan of loansData) {
        const acct = loan.accountNumber || '';
        if (!loansByAccount.has(acct)) loansByAccount.set(acct, []);
        loansByAccount.get(acct)!.push(loan);
      }

      for (const [accountNum, accountLoans] of loansByAccount) {
        if (!accountNum) continue;

        // Find all disbursement entries for this account number (exact boundary match)
        // Spaces in account numbers (e.g. "232 A") are made optional to match "232A" format too
        const escapedNum = accountNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flexibleNum = escapedNum.replace(/\s+/g, '\\s*');
        // Boundary: accounts ending in letter need stricter boundary to avoid "232AB" matching "232A"
        const lastChar = accountNum.trim().slice(-1);
        const boundary = /[a-zA-Z]/.test(lastChar) ? '([^0-9a-zA-Z]|$)' : '([^0-9]|$)';
        const accountPattern = new RegExp('खाते क्र\\.[ ]?' + flexibleNum + boundary);
        const allEntries = allDisbursements.filter(e =>
          e.narration && accountPattern.test(e.narration)
        );

        // Greedily match each loan to its best available cash entry (no entry reused)
        // Loans with exact matches get priority so they claim their entry first
        const usedEntryIds = new Set<string>();
        const sortedLoans = [...accountLoans].sort((a, b) => {
          const amtA = Number(a.principalAmount);
          const amtB = Number(b.principalAmount);
          const exactA = allEntries.some(e => Math.abs(Number(e.amount) - amtA) < 0.01);
          const exactB = allEntries.some(e => Math.abs(Number(e.amount) - amtB) < 0.01);
          if (exactA && !exactB) return -1;
          if (!exactA && exactB) return 1;
          return 0;
        });

        for (const loan of sortedLoans) {
          const loanAmount = Number(loan.principalAmount) || 0;
          const available = allEntries.filter(e => !usedEntryIds.has(e.id));

          // Find best match: exact (< ₹0.01) first, then within ₹1 for decimal precision issues
          const matchingEntry = available.find(e => Math.abs(Number(e.amount) - loanAmount) < 0.01)
            || available.find(e => Math.abs(Number(e.amount) - loanAmount) < 1.0);

          if (!matchingEntry) {
            // This loan has no matching cash entry → MISSING
            missingLoans.push({
              id: loan.id,
              accountNumber: accountNum,
              borrowerName: loan.borrowerName || '',
              groupName: loan.groupName || '',
              loanDate: loan.loanDate || '',
              principalAmount: loanAmount
            });
          } else {
            usedEntryIds.add(matchingEntry.id);
            // Check if matched entry has wrong amount
            if (Math.abs(Number(matchingEntry.amount) - loanAmount) > 0.01) {
              mismatches.push({
                id: loan.id,
                accountNumber: accountNum,
                borrowerName: loan.borrowerName || '',
                groupName: loan.groupName || '',
                loanDate: loan.loanDate || '',
                principalAmount: loanAmount,
                cashEntryId: matchingEntry.id,
                cashEntryAmount: Number(matchingEntry.amount)
              });
            }
            // else: exact match → HEALTHY, no action needed
          }
        }

        // Entries not matched to any loan = TRUE orphan duplicates (safe to delete)
        const unusedEntries = allEntries.filter(e => !usedEntryIds.has(e.id));
        if (unusedEntries.length > 0) {
          const repLoan = accountLoans[0];
          duplicates.push({
            id: repLoan.id,
            accountNumber: accountNum,
            borrowerName: accountLoans.map(l => l.borrowerName || '').join(' / '),
            loanDate: repLoan.loanDate || '',
            principalAmount: Number(repLoan.principalAmount) || 0,
            cashEntryIds: allEntries.map(e => e.id),
            cashEntryAmounts: allEntries.map(e => Number(e.amount)),
            keepEntryIds: [...usedEntryIds],
            keepEntryId: usedEntryIds.size === 1 ? [...usedEntryIds][0] : undefined
          });
        }
      }

      const mismatchDiscrepancy = mismatches.reduce((sum, m) => sum + Math.abs(m.principalAmount - m.cashEntryAmount), 0);
      const missingDiscrepancy = missingLoans.reduce((sum, l) => sum + l.principalAmount, 0);
      const duplicateDiscrepancy = duplicates.reduce((sum, d) => {
        const totalCash = d.cashEntryAmounts.reduce((s: number, a: number) => s + a, 0);
        return sum + Math.abs(totalCash - d.principalAmount);
      }, 0);

      return {
        success: true,
        missingCount: missingLoans.length,
        totalMissingAmount: missingDiscrepancy,
        loans: missingLoans,
        mismatches,
        duplicates,
        summary: {
          missingCount: missingLoans.length,
          mismatchCount: mismatches.length,
          duplicateCount: duplicates.length,
          totalDiscrepancy: missingDiscrepancy + mismatchDiscrepancy + duplicateDiscrepancy
        }
      };
    } catch (error) {
      console.error("getMissingDisbursementEntries error:", error);
      return { success: false, missingCount: 0, totalMissingAmount: 0, loans: [], mismatches: [], duplicates: [], summary: { missingCount: 0, mismatchCount: 0, duplicateCount: 0, totalDiscrepancy: 0 } };
    }
  }

  async fixMissingDisbursementEntries(tenantId: string): Promise<{
    success: boolean;
    fixedCount: number;
    totalFixedAmount: number;
    message: string;
    details: { created: number; updated: number; duplicatesRemoved: number };
  }> {
    try {
      const diagnostic = await this.getMissingDisbursementEntries(tenantId);
      if (!diagnostic.success) throw new Error("Diagnostic failed");

      let created = 0;
      let updated = 0;
      let duplicatesRemoved = 0;

      for (const loan of diagnostic.loans) {
        try {
          // DIRECT DB INSERT: bypasses all duplicate-prevention in storage.createCashTransaction
          // The diagnostic has already confirmed this loan has NO cashbook entry — safe to create directly
          const narration = NarrationEngine.createLoanDisbursementNarration(
            loan.accountNumber,
            loan.borrowerName,
            loan.principalAmount,
            loan.groupName || ''
          );
          await db.insert(cashTransactions).values({
            tenantId,
            transactionDate: loan.loanDate as any,
            transactionType: 'cash_out',
            amount: loan.principalAmount.toString() as any,
            narration,
            category: 'loan_disbursement',
            isSystemGenerated: true,
            createdAt: new Date(),
            updatedAt: new Date()
          } as any);
          created++;
          console.log(`✅ CASH-FIX: Created entry for account ${loan.accountNumber} ₹${loan.principalAmount} on ${loan.loanDate}`);
        } catch (createErr) {
          console.error(`❌ CASH-FIX: Failed to create entry for account ${loan.accountNumber}:`, createErr);
        }
      }

      for (const mismatch of diagnostic.mismatches) {
        // Fix amount AND standardize narration to "कर्ज वितरण" format
        const standardNarration = `कर्ज वितरण - खाते क्र. ${mismatch.accountNumber} ${mismatch.borrowerName} - मुद्दल: ₹${mismatch.principalAmount}`;
        await db.update(cashTransactions)
          .set({
            amount: mismatch.principalAmount.toString(),
            narration: standardNarration,
            updatedAt: new Date()
          } as any)
          .where(and(
            eq(cashTransactions.id, mismatch.cashEntryId),
            eq(cashTransactions.tenantId, tenantId)
          ));
        updated++;
        console.log(`✅ CASH-FIX: Updated amount+narration for account ${mismatch.accountNumber}: ₹${mismatch.cashEntryAmount} → ₹${mismatch.principalAmount}`);
      }

      // SAFE duplicate cleanup — uses keepEntryIds (array) from group-based algorithm
      // Only truly orphaned entries (not matched to any loan) are deleted
      let skippedDuplicates = 0;
      for (const dup of diagnostic.duplicates) {
        // Support both keepEntryIds (array, new) and keepEntryId (single, backward compat)
        const keepIds: string[] = (dup as any).keepEntryIds ||
          ((dup as any).keepEntryId ? [(dup as any).keepEntryId] : []);
        console.log(`🔍 CASH-FIX DUPLICATE: account ${dup.accountNumber}, entries=[${dup.cashEntryAmounts.join(',')}], keepIds=[${keepIds.join(',')}]`);
        if (keepIds.length === 0) {
          skippedDuplicates++;
          console.log(`⚠️ CASH-FIX: Skipping account ${dup.accountNumber} — no entries matched to any loan`);
          continue;
        }
        const toDelete = dup.cashEntryIds.filter((id: string) => !keepIds.includes(id));
        console.log(`🗑️ CASH-FIX: Will delete ${toDelete.length} orphaned entries for account ${dup.accountNumber}`);
        for (const deleteId of toDelete) {
          try {
            const deleted = await storage.deleteCashTransaction(deleteId, tenantId);
            if (deleted) {
              duplicatesRemoved++;
              console.log(`✅ CASH-FIX: Deleted orphan entry ${deleteId} for account ${dup.accountNumber}`);
            } else {
              console.log(`⚠️ CASH-FIX: Delete returned false for ${deleteId} (account ${dup.accountNumber})`);
            }
          } catch (delErr) {
            console.error(`❌ CASH-FIX: Delete failed for ${deleteId} (account ${dup.accountNumber}):`, delErr);
          }
        }
      }

      const fixedCount = created + updated + duplicatesRemoved;
      return {
        success: true,
        fixedCount,
        totalFixedAmount: diagnostic.loans.reduce((s, l) => s + l.principalAmount, 0),
        message: `दुरुस्ती यशस्वी: ${created} नव्या नोंदी, ${updated} रक्कम दुरुस्त, ${duplicatesRemoved} डुप्लिकेट हटवल्या${skippedDuplicates > 0 ? `. ${skippedDuplicates} डुप्लिकेट वगळल्या (कर्ज Edit → Save करा)` : ''}.`,
        details: { created, updated, duplicatesRemoved }
      };
    } catch (error) {
      console.error("fixMissingDisbursementEntries error:", error);
      return {
        success: false,
        fixedCount: 0,
        totalFixedAmount: 0,
        message: "दुरुस्ती अयशस्वी: " + (error as Error).message,
        details: { created: 0, updated: 0, duplicatesRemoved: 0 }
      };
    }
  }

  private async reconcileLoanClosures(tenantId: string): Promise<DataManagementResult> {
    // Implementation for loan closure reconciliation
    const closures = await db.select()
      .from(loanClosures)
      .innerJoin(loans, eq(loanClosures.loanId, loans.id))
      .where(eq(loanClosures.tenantId, tenantId));

    let reconciledCount = 0;

    for (const closure of closures) {
      const principalPaid = Number(closure.loan_closures.principalPaid) || 0;
      const interestPaid = Number(closure.loan_closures.interestPaid) || 0;  
      const totalAmount = principalPaid + interestPaid;
      
      // Check if corresponding cash transaction exists
      const closureTransaction = await db.select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, tenantId),
          sql`${cashTransactions.narration} LIKE '%${closure.loans.accountNumber}%'`,
          eq(cashTransactions.transactionType, 'cash_in'),
          sql`${cashTransactions.amount} = ${totalAmount}`
        ))
        .limit(1);

      if (closureTransaction.length === 0) {
        // Create missing closure transaction
        await storage.createCashTransaction({
          tenantId,
          transactionDate: closure.loan_closures.closureDate,
          transactionType: 'cash_in',
          amount: totalAmount,
          narration: `कर्ज बंद - खाते क्र. ${closure.loans.accountNumber} - ${closure.loans.borrowerName}`,
          category: 'loan_closure',
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

  private async reconcileOpeningBalances(tenantId: string): Promise<DataManagementResult> {
    // Implementation for opening balance reconciliation
    const partyAccounts = await db.select().from(parties).where(eq(parties.tenantId, tenantId));
    let reconciledCount = 0;

    for (const party of partyAccounts) {
      if (party.openingBalance && Number(party.openingBalance) > 0 && party.openingBalanceDate) {
        // Check if opening balance transaction exists
        const openingTransaction = await db.select()
          .from(cashTransactions)
          .where(and(
            eq(cashTransactions.tenantId, tenantId),
            eq(cashTransactions.partyId, party.id),
            sql`${cashTransactions.narration} LIKE '%प्रारंभिक शिल्लक%'`
          ))
          .limit(1);

        if (openingTransaction.length === 0) {
          // Create opening balance transaction
          await storage.createCashTransaction({
            tenantId,
            transactionDate: party.openingBalanceDate,
            transactionType: party.openingBalanceType === 'credit' ? 'cash_in' : 'cash_out',
            amount: Number(party.openingBalance),
            narration: `प्रारंभिक शिल्लक - ${party.name}`,
            category: 'opening_balance',
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
  async restoreAllSystemData(tenantId: string, options: { createBackup: boolean }): Promise<DataManagementResult> {
    try {
      console.log(`🔄 RESTORE: Starting complete system data restore for tenant ${tenantId}`);
      
      const results: any[] = [];
      let totalAffected = 0;

      // Step 1: Create backup before restore if requested
      if (options.createBackup) {
        console.log(`💾 RESTORE: Creating safety backup before restore`);
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

      // Step 2: Clean all data in transaction for safety
      console.log(`🗑️ RESTORE: Cleaning all existing data`);
      
      await db.transaction(async (tx) => {
        if (tenantId !== 'SUPER_ADMIN') {
          await tx.delete(userActivityLogs).where(eq(userActivityLogs.tenantId, tenantId));
          await tx.delete(userPermissions).where(eq(userPermissions.tenantId, tenantId));
        }
        const deletedJournalLines = await tx.delete(journalEntryLines).where(eq(journalEntryLines.tenantId, tenantId));
        const deletedJournalEntries = await tx.delete(journalEntries).where(eq(journalEntries.tenantId, tenantId));
        const deletedClosures = await tx.delete(loanClosures).where(eq(loanClosures.tenantId, tenantId));
        const deletedTransactions = await tx.delete(transactions).where(eq(transactions.tenantId, tenantId));
        const deletedCashTransactions = await tx.delete(cashTransactions).where(eq(cashTransactions.tenantId, tenantId));
        const deletedPhotos = await tx.delete(loanPhotos).where(eq(loanPhotos.tenantId, tenantId));
        const deletedLoans = await tx.delete(loans).where(eq(loans.tenantId, tenantId));
        const deletedParties = await tx.delete(parties).where(eq(parties.tenantId, tenantId));
        const deletedBorrowers = await tx.delete(borrowers).where(eq(borrowers.tenantId, tenantId));
        const deletedGroups = await tx.delete(groups).where(eq(groups.tenantId, tenantId));
        const deletedCompanies = await tx.delete(companies).where(eq(companies.tenantId, tenantId));
        const deletedStorageSettings = await tx.delete(tenantStorageSettings).where(eq(tenantStorageSettings.tenantId, tenantId));

        totalAffected = (deletedJournalLines.rowCount || 0) + (deletedJournalEntries.rowCount || 0) +
                       (deletedClosures.rowCount || 0) + (deletedTransactions.rowCount || 0) + 
                       (deletedCashTransactions.rowCount || 0) + (deletedPhotos.rowCount || 0) + 
                       (deletedLoans.rowCount || 0) + (deletedParties.rowCount || 0) + 
                       (deletedBorrowers.rowCount || 0) + (deletedGroups.rowCount || 0) +
                       (deletedCompanies.rowCount || 0) + (deletedStorageSettings.rowCount || 0);
      });

      console.log(`✅ RESTORE: Successfully cleaned ${totalAffected} records`);

      // Step 3: Reset system to clean state message
      results.push({
        operation: "complete_data_cleanup",
        affected: totalAffected,
        message: "सर्व डेटा साफ केला गेला आणि system clean state मध्ये reset केले गेले"
      });

      return {
        success: true,
        message: `सर्व सिस्टम डेटा यशस्वीपणे रिस्टोर केला गेला. ${totalAffected} records साफ केले गेले.`,
        affectedRecords: totalAffected,
        details: results
      };

    } catch (error) {
      console.error("System restore error:", error);
      return {
        success: false,
        message: `System restore failed: ${(error as Error).message}`,
        affectedRecords: 0,
        details: [{ error: (error as Error).message }]
      };
    }
  }

  private readonly LOAN_PROTECTED_CATEGORIES = ['loan_disbursement', 'loan_repayment', 'loan_closure', 'opening_balance'];
  
  private readonly LOAN_NARRATION_KEYWORDS = [
    'कर्ज वितरण', 'कर्ज बंद', 'कर्ज वसूली', 'कर्ज रक्कम अपडेट',
    'खाते क्र.', 'मुद्दल', 'व्याज', 'प्रारंभिक शिल्लक',
    'loan disbursement', 'loan closure', 'loan repayment', 'opening balance'
  ];

  private buildLoanProtectionCondition(): any {
    const categoryProtection = sql`${cashTransactions.category} NOT IN ('loan_disbursement', 'loan_repayment', 'loan_closure', 'opening_balance')`;
    const systemGeneratedProtection = sql`${cashTransactions.isSystemGenerated} = false`;
    const narrationConditions = this.LOAN_NARRATION_KEYWORDS.map(keyword =>
      sql`COALESCE(${cashTransactions.narration}, '') NOT ILIKE ${`%${keyword}%`}`
    );
    return sql`(${categoryProtection} AND ${systemGeneratedProtection} AND ${sql.join(narrationConditions, sql` AND `)})`;
  }

  async previewCashBookCleanup(tenantId: string, options: { dateFrom: string; dateTo: string }): Promise<{
    success: boolean;
    deletableCount: number;
    protectedCount: number;
    deletableJournalCount: number;
    protectedJournalCount: number;
    details: { category: string; count: number }[];
    balanceImpact: {
      totalCashInDeleted: number;
      totalCashOutDeleted: number;
      netImpact: number;
      adjustmentType: 'cash_in' | 'cash_out' | 'none';
      adjustmentAmount: number;
      partyWiseImpact: { partyName: string; partyId: string; cashIn: number; cashOut: number; net: number }[];
    };
  }> {
    try {
      const dateConditions = sql`${cashTransactions.tenantId} = ${tenantId} AND ${cashTransactions.transactionDate} >= ${options.dateFrom} AND ${cashTransactions.transactionDate} <= ${options.dateTo}`;

      const allInRange = await db.select({ id: cashTransactions.id })
        .from(cashTransactions)
        .where(sql`${dateConditions}`);

      const protectedEntries = await db.select({ id: cashTransactions.id })
        .from(cashTransactions)
        .where(sql`${dateConditions} AND NOT ${this.buildLoanProtectionCondition()}`);

      const deletableEntries = allInRange.length - protectedEntries.length;

      const categoryBreakdown = await db.select({
        category: cashTransactions.category,
        count: sql<number>`count(*)::int`
      })
        .from(cashTransactions)
        .where(sql`${dateConditions} AND ${this.buildLoanProtectionCondition()}`)
        .groupBy(cashTransactions.category);

      const deletableTxDetails = await db.select({
        id: cashTransactions.id,
        transactionType: cashTransactions.transactionType,
        amount: cashTransactions.amount,
        partyId: cashTransactions.partyId,
        narration: cashTransactions.narration,
      })
        .from(cashTransactions)
        .where(sql`${dateConditions} AND ${this.buildLoanProtectionCondition()}`);

      let totalCashInDeleted = 0;
      let totalCashOutDeleted = 0;
      const partyMap = new Map<string, { partyId: string; cashIn: number; cashOut: number }>();

      for (const tx of deletableTxDetails) {
        const amount = Number(tx.amount) || 0;
        if (tx.transactionType === 'cash_in') {
          totalCashInDeleted += amount;
        } else {
          totalCashOutDeleted += amount;
        }
        if (tx.partyId) {
          const existing = partyMap.get(tx.partyId) || { partyId: tx.partyId, cashIn: 0, cashOut: 0 };
          if (tx.transactionType === 'cash_in') {
            existing.cashIn += amount;
          } else {
            existing.cashOut += amount;
          }
          partyMap.set(tx.partyId, existing);
        }
      }

      const partyIds = Array.from(partyMap.keys());
      let partyNames = new Map<string, string>();
      if (partyIds.length > 0) {
        const partyRecords = await db.select({ id: parties.id, name: parties.name })
          .from(parties)
          .where(and(eq(parties.tenantId, tenantId), inArray(parties.id, partyIds)));
        partyRecords.forEach((p: any) => partyNames.set(p.id, p.name));
      }

      const partyWiseImpact = Array.from(partyMap.entries()).map(([pid, data]) => ({
        partyName: partyNames.get(pid) || `Party #${pid}`,
        partyId: pid,
        cashIn: data.cashIn,
        cashOut: data.cashOut,
        net: data.cashIn - data.cashOut
      })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

      const netImpact = totalCashInDeleted - totalCashOutDeleted;
      let adjustmentType: 'cash_in' | 'cash_out' | 'none' = 'none';
      let adjustmentAmount = 0;
      if (netImpact > 0) {
        adjustmentType = 'cash_in';
        adjustmentAmount = netImpact;
      } else if (netImpact < 0) {
        adjustmentType = 'cash_out';
        adjustmentAmount = Math.abs(netImpact);
      }

      const journalDateConditions = sql`${journalEntries.tenantId} = ${tenantId} AND ${journalEntries.transactionDate} >= ${options.dateFrom} AND ${journalEntries.transactionDate} <= ${options.dateTo}`;

      const allJournals = await db.select({ id: journalEntries.id })
        .from(journalEntries)
        .where(sql`${journalDateConditions}`);

      const loanJournalKeywords = ['कर्ज वितरण', 'कर्ज बंद', 'कर्ज वसूली', 'खाते क्र.', 'मुद्दल', 'व्याज', 'प्रारंभिक शिल्लक', 'loan disbursement', 'loan closure', 'opening balance'];
      const journalDescConditions = loanJournalKeywords.map(keyword =>
        sql`(COALESCE(${journalEntries.description}, '') ILIKE ${`%${keyword}%`} OR COALESCE(${journalEntries.narration}, '') ILIKE ${`%${keyword}%`})`
      );
      const protectedJournals = await db.select({ id: journalEntries.id })
        .from(journalEntries)
        .where(sql`${journalDateConditions} AND (${journalEntries.sourceType} IN ('loan_disbursement', 'loan_closure', 'loan_repayment', 'opening_balance') OR ${sql.join(journalDescConditions, sql` OR `)})`);

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
          adjustmentType: 'none',
          adjustmentAmount: 0,
          partyWiseImpact: []
        }
      };
    }
  }

  async cleanupCashBookEntries(tenantId: string, options: {
    dateFrom: string;
    dateTo: string;
    cleanCashTransactions: boolean;
    cleanJournalEntries: boolean;
    createBackup: boolean;
  }): Promise<DataManagementResult> {
    try {
      const results: any[] = [];
      let totalAffected = 0;

      if (options.createBackup) {
        const backupResult = await this.createComprehensiveBackup(tenantId);
        if (!backupResult.success) {
          return {
            success: false,
            message: "Backup तयार करण्यात अयशस्वी",
            affectedRecords: 0,
            details: [backupResult]
          };
        }
        results.push({ step: 'backup', message: 'Backup यशस्वी' });
      }

      await db.transaction(async (tx: any) => {
        if (options.cleanCashTransactions) {
          const dateConditions = sql`${cashTransactions.tenantId} = ${tenantId} AND ${cashTransactions.transactionDate} >= ${options.dateFrom} AND ${cashTransactions.transactionDate} <= ${options.dateTo}`;

          const deletableCashTx = await tx.select({ id: cashTransactions.id })
            .from(cashTransactions)
            .where(sql`${dateConditions} AND ${this.buildLoanProtectionCondition()}`);

          if (deletableCashTx.length > 0) {
            const deletableIds = deletableCashTx.map((r: any) => r.id);
            
            for (const id of deletableIds) {
              await tx.delete(cashTransactions)
                .where(and(
                  eq(cashTransactions.id, id),
                  eq(cashTransactions.tenantId, tenantId)
                ));
            }

            totalAffected += deletableCashTx.length;
            results.push({
              step: 'cash_transactions',
              deleted: deletableCashTx.length,
              message: `${deletableCashTx.length} सामान्य कॅश एन्ट्री हटवल्या`
            });
          }
        }

        if (options.cleanJournalEntries) {
          const journalDateConditions = sql`${journalEntries.tenantId} = ${tenantId} AND ${journalEntries.transactionDate} >= ${options.dateFrom} AND ${journalEntries.transactionDate} <= ${options.dateTo}`;

          const loanJournalKeywords = ['कर्ज वितरण', 'कर्ज बंद', 'कर्ज वसूली', 'खाते क्र.', 'मुद्दल', 'व्याज', 'प्रारंभिक शिल्लक', 'loan disbursement', 'loan closure', 'opening balance'];
          const journalDescConditions = loanJournalKeywords.map(keyword =>
            sql`(COALESCE(${journalEntries.description}, '') ILIKE ${`%${keyword}%`} OR COALESCE(${journalEntries.narration}, '') ILIKE ${`%${keyword}%`})`
          );

          const deletableJournals = await tx.select({ id: journalEntries.id })
            .from(journalEntries)
            .where(sql`${journalDateConditions} AND ${journalEntries.sourceType} NOT IN ('loan_disbursement', 'loan_closure', 'loan_repayment', 'opening_balance') AND NOT (${sql.join(journalDescConditions, sql` OR `)})`);

          if (deletableJournals.length > 0) {
            const journalIds = deletableJournals.map((r: any) => r.id);
            
            for (const jId of journalIds) {
              await tx.delete(journalEntryLines)
                .where(and(
                  eq(journalEntryLines.journalEntryId, jId),
                  eq(journalEntryLines.tenantId, tenantId)
                ));
              await tx.delete(journalEntries)
                .where(and(
                  eq(journalEntries.id, jId),
                  eq(journalEntries.tenantId, tenantId)
                ));
            }

            totalAffected += deletableJournals.length;
            results.push({
              step: 'journal_entries',
              deleted: deletableJournals.length,
              message: `${deletableJournals.length} सामान्य जर्नल एन्ट्री हटवल्या`
            });
          }
        }
      });

      return {
        success: true,
        message: `कॅशबुक क्लीनअप यशस्वी - ${totalAffected} एन्ट्री हटवल्या (कर्जाच्या सर्व एन्ट्री सुरक्षित)`,
        affectedRecords: totalAffected,
        details: results
      };

    } catch (error) {
      console.error("Cashbook cleanup error:", error);
      return {
        success: false,
        message: "कॅशबुक क्लीनअप अयशस्वी: " + (error as Error).message,
        affectedRecords: 0,
        details: []
      };
    }
  }
}

export const dataManagementService = new DataManagementService();