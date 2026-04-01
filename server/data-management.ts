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
          // Build safe account number regex boundary — same pattern as getMissingDisbursementEntries
          // LIKE '%50%' would match account 500, 501, 5000 — regex boundary prevents false matches
          const escapedAcct = (loan.accountNumber || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const acctBoundary = /[a-zA-Z]/.test((loan.accountNumber || '').trim().slice(-1))
            ? '([^0-9a-zA-Z]|$)' : '([^0-9]|$)';
          const acctPattern = `खाते क्र\\.[ ]?${escapedAcct}${acctBoundary}`;

          const deletedCashTx = await tx.delete(cashTransactions)
            .where(and(
              eq(cashTransactions.tenantId, tenantId),
              or(
                // PRIMARY: UUID match — reliable for new entries (loanId set on CREATE/Rebuild/Fix)
                eq(cashTransactions.loanId, loan.id),
                // FALLBACK: narration-based — for old entries without loanId
                // Uses regex boundary to prevent account 50 matching 500, 501, etc.
                sql`${cashTransactions.narration} ~ ${acctPattern}`,
                sql`${cashTransactions.narration} LIKE ${'%Account ' + loan.accountNumber + ' %'}`,
                sql`${cashTransactions.narration} LIKE ${'%A/c ' + loan.accountNumber + ' %'}`,
                sql`${cashTransactions.narration} LIKE ${'%कर्ज वितरण%'} AND ${cashTransactions.narration} LIKE ${'%' + loan.borrowerName + '%'}`,
                sql`${cashTransactions.narration} LIKE ${'%कर्ज जमा%'} AND ${cashTransactions.narration} LIKE ${'%' + loan.borrowerName + '%'}`,
                sql`${cashTransactions.narration} LIKE ${'%कर्ज बंद%'} AND ${cashTransactions.narration} LIKE ${'%' + loan.borrowerName + '%'}`
              )
            ));
          affectedRecords.cashTransactions = deletedCashTx.rowCount || 0;

          // Find journal entries to delete their lines first
          const loanRelatedJournalEntries = await tx.select()
            .from(journalEntries)
            .where(and(
              eq(journalEntries.tenantId, tenantId),
              or(
                // Regex boundary for account number — prevents 50 matching 500, 501
                sql`${journalEntries.description} ~ ${acctPattern}`,
                sql`${journalEntries.description} LIKE ${'%Account ' + loan.accountNumber + ' %'}`,
                sql`${journalEntries.description} LIKE ${'%' + loan.borrowerName + '%'} AND ${journalEntries.description} LIKE '%कर्ज%'`
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
                  sql`${journalEntries.description} ~ ${acctPattern}`,
                  sql`${journalEntries.description} LIKE ${'%Account ' + loan.accountNumber + ' %'}`,
                  sql`${journalEntries.description} LIKE ${'%' + loan.borrowerName + '%'} AND ${journalEntries.description} LIKE '%कर्ज%'`
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
  async createComprehensiveBackup(tenantId: string, options?: { portable?: boolean }): Promise<DataManagementResult> {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fullTimestamp = new Date().toISOString();
      const isPortable = options?.portable === true;
      
      const backupData: any = {
        timestamp: fullTimestamp,
        tenantId: isPortable ? "PORTABLE" : tenantId,
        originalTenantId: tenantId,
        version: "2.0",
        portable: isPortable,
        schema: "comprehensive_backup_aug_2025",
        data: {
          companies: await db.select().from(companies).where(eq(companies.tenantId, tenantId)),
          groups: await db.select().from(groups).where(eq(groups.tenantId, tenantId)),
          borrowers: await db.select().from(borrowers).where(eq(borrowers.tenantId, tenantId)),
          loans: await db.select().from(loans).where(eq(loans.tenantId, tenantId)),
          transactions: await db.select().from(transactions).where(eq(transactions.tenantId, tenantId)),
          loanClosures: await db.select().from(loanClosures).where(eq(loanClosures.tenantId, tenantId)),
          loanPhotos: await db.select().from(loanPhotos).where(eq(loanPhotos.tenantId, tenantId)),
          
          parties: await db.select().from(parties).where(eq(parties.tenantId, tenantId)),
          cashTransactions: await db.select().from(cashTransactions).where(eq(cashTransactions.tenantId, tenantId)),
          journalEntries: await db.select().from(journalEntries).where(eq(journalEntries.tenantId, tenantId)),
          journalEntryLines: await db.select().from(journalEntryLines).where(eq(journalEntryLines.tenantId, tenantId)),
          
          users: (!isPortable && tenantId !== 'SUPER_ADMIN') ? await db.select().from(users).where(eq(users.tenantId, tenantId)) : [],
          userPermissions: (!isPortable && tenantId !== 'SUPER_ADMIN') ? await db.select().from(userPermissions).where(eq(userPermissions.tenantId, tenantId)) : [],
          userActivityLogs: (!isPortable && tenantId !== 'SUPER_ADMIN') ? await db.select().from(userActivityLogs).where(eq(userActivityLogs.tenantId, tenantId)) : [],
          
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
  private convertDateFields(records: any[], timestampFields: string[], dateFields: string[] = []): any[] {
    return records.map(record => {
      const converted = { ...record };
      for (const field of timestampFields) {
        if (converted[field] && typeof converted[field] === 'string') {
          converted[field] = new Date(converted[field]);
        }
      }
      return converted;
    });
  }

  async restoreFromBackup(tenantId: string, backupData: any): Promise<DataManagementResult> {
    try {
      console.log(`🔄 RESTORE: Starting comprehensive restore for ${tenantId}`);
      
      if (!backupData || !backupData.data || !backupData.version) {
        throw new Error("Invalid backup data format");
      }

      const isPortableBackup = backupData.portable === true || backupData.tenantId === "PORTABLE";
      
      if (!isPortableBackup && backupData.tenantId !== tenantId) {
        throw new Error("Backup tenant ID does not match current tenant. सार्वत्रिक बॅकअप वापरा किंवा योग्य टेनंट मधून रिस्टोर करा.");
      }

      if (isPortableBackup) {
        console.log(`🌐 PORTABLE RESTORE: Remapping tenant from ${backupData.originalTenantId || 'unknown'} → ${tenantId}`);
        
        const idMap = new Map<string, string>();
        const genNewId = (oldId: string): string => {
          if (!oldId) return oldId;
          if (idMap.has(oldId)) return idMap.get(oldId)!;
          const newId = crypto.randomUUID();
          idMap.set(oldId, newId);
          return newId;
        };
        const remapId = (oldId: string | null | undefined): string | null | undefined => {
          if (!oldId) return oldId;
          return idMap.get(oldId) || oldId;
        };

        for (const comp of (backupData.data.companies || [])) {
          genNewId(comp.id);
        }
        for (const g of (backupData.data.groups || [])) {
          genNewId(g.id);
        }
        for (const b of (backupData.data.borrowers || [])) {
          genNewId(b.id);
        }
        for (const p of (backupData.data.parties || [])) {
          genNewId(p.id);
        }
        for (const l of (backupData.data.loans || [])) {
          genNewId(l.id);
        }
        for (const lc of (backupData.data.loanClosures || [])) {
          genNewId(lc.id);
        }
        for (const lp of (backupData.data.loanPhotos || [])) {
          genNewId(lp.id);
        }
        for (const ct of (backupData.data.cashTransactions || [])) {
          genNewId(ct.id);
        }
        for (const t of (backupData.data.transactions || [])) {
          genNewId(t.id);
        }
        for (const je of (backupData.data.journalEntries || [])) {
          genNewId(je.id);
        }
        for (const jl of (backupData.data.journalEntryLines || [])) {
          genNewId(jl.id);
        }
        for (const ts of (backupData.data.tenantStorageSettings || [])) {
          genNewId(ts.id);
        }

        backupData.data.companies = (backupData.data.companies || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId
        }));
        backupData.data.groups = (backupData.data.groups || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId, companyId: remapId(r.companyId)
        }));
        backupData.data.borrowers = (backupData.data.borrowers || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId
        }));
        backupData.data.parties = (backupData.data.parties || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId
        }));
        backupData.data.loans = (backupData.data.loans || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId, groupId: remapId(r.groupId), borrowerId: remapId(r.borrowerId)
        }));
        backupData.data.loanClosures = (backupData.data.loanClosures || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId, loanId: remapId(r.loanId)
        }));
        backupData.data.loanPhotos = (backupData.data.loanPhotos || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId, loanId: remapId(r.loanId), uploadedBy: remapId(r.uploadedBy)
        }));
        backupData.data.cashTransactions = (backupData.data.cashTransactions || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId, partyId: remapId(r.partyId), loanId: remapId(r.loanId), linkedTransactionId: remapId(r.linkedTransactionId)
        }));
        backupData.data.transactions = (backupData.data.transactions || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId, loanId: remapId(r.loanId)
        }));
        backupData.data.journalEntries = (backupData.data.journalEntries || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId, cashTransactionId: remapId(r.cashTransactionId)
        }));
        backupData.data.journalEntryLines = (backupData.data.journalEntryLines || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId, journalEntryId: remapId(r.journalEntryId)
        }));
        backupData.data.tenantStorageSettings = (backupData.data.tenantStorageSettings || []).map((r: any) => ({
          ...r, id: remapId(r.id), tenantId
        }));

        backupData.data.users = [];
        backupData.data.userPermissions = [];
        backupData.data.userActivityLogs = [];

        console.log(`🔑 PORTABLE RESTORE: ${idMap.size} UUIDs remapped`);
      }

      const tsFields: Record<string, string[]> = {
        companies: ['createdAt', 'updatedAt', 'subscriptionStartDate', 'subscriptionEndDate'],
        groups: ['createdAt', 'updatedAt'],
        borrowers: ['createdAt', 'updatedAt'],
        loans: ['createdAt', 'updatedAt'],
        transactions: ['createdAt'],
        loanClosures: ['createdAt'],
        loanPhotos: ['createdAt', 'updatedAt'],
        parties: ['createdAt', 'updatedAt'],
        cashTransactions: ['createdAt', 'updatedAt'],
        journalEntries: ['createdAt', 'updatedAt', 'completedAt'],
        journalEntryLines: [],
        users: ['createdAt', 'updatedAt', 'temporaryDisabledUntil', 'lastLoginAt'],
        userPermissions: ['createdAt', 'updatedAt'],
        userActivityLogs: ['createdAt'],
        tenantStorageSettings: ['createdAt', 'updatedAt', 'lastTestedAt'],
      };

      for (const [table, fields] of Object.entries(tsFields)) {
        if (backupData.data[table]?.length > 0 && fields.length > 0) {
          backupData.data[table] = this.convertDateFields(backupData.data[table], fields);
        }
      }

      let restoredRecords = 0;
      const restoreResults: any[] = [];

      // Step 1: Clear existing data (in reverse dependency order) - wrapped in transaction for safety
      console.log("🧹 STEP 1: Clearing existing data...");
      
      await db.transaction(async (tx) => {
        await tx.execute(sql`ALTER TABLE loans DISABLE TRIGGER ALL`);
        await tx.execute(sql`ALTER TABLE loan_closures DISABLE TRIGGER ALL`);

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

        await tx.execute(sql`ALTER TABLE loans ENABLE TRIGGER ALL`);
        await tx.execute(sql`ALTER TABLE loan_closures ENABLE TRIGGER ALL`);
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
      // RELIABLE DUPLICATE CHECK: Only detect loan_disbursement entries with the same loanId
      // This eliminates false positives from legitimate same-narration manual entries
      // Old entries without loanId are excluded (they'll get loanId after Rebuild)
      let disbursements: any[] = [];
      try {
        disbursements = await db.select()
          .from(cashTransactions)
          .where(and(
            eq(cashTransactions.tenantId, tenantId),
            eq(cashTransactions.category, 'loan_disbursement'),
            sql`${cashTransactions.loanId} IS NOT NULL`
          ));
      } catch {
        // loan_id column may not exist yet — skip check entirely
        return { duplicatesFound: 0, details: [] };
      }

      const byLoanId = new Map<string, any[]>();
      disbursements.forEach(t => {
        const lid = t.loanId as string;
        if (!byLoanId.has(lid)) byLoanId.set(lid, []);
        byLoanId.get(lid)!.push(t);
      });

      let duplicatesFound = 0;
      const duplicateDetails: any[] = [];
      byLoanId.forEach((entries, loanId) => {
        if (entries.length > 1) {
          duplicatesFound += entries.length - 1;
          duplicateDetails.push({
            loanId,
            count: entries.length,
            transactions: entries.map(t => ({ id: t.id, date: t.transactionDate, amount: t.amount }))
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
    loans: Array<{ id: number; accountNumber: string; borrowerName: string; groupName: string; loanDate: string; principalAmount: number; status?: string }>;
    mismatches: Array<{ id: number; accountNumber: string; borrowerName: string; groupName: string; loanDate: string; principalAmount: number; cashEntryId: string; cashEntryAmount: number; status?: string }>;
    duplicates: Array<{ id: number; accountNumber: string; borrowerName: string; loanDate: string; principalAmount: number; cashEntryIds: string[]; cashEntryAmounts: number[] }>;
    summary: { missingCount: number; mismatchCount: number; duplicateCount: number; totalDiscrepancy: number };
  }> {
    try {
      // ─── STEP 0: ACTUAL BALANCE CHECK ──────────────────────────────────────
      // If SUM(cashbook disbursements) = SUM(all loan principals), everything is in sync.
      // Skip the slow narration-based algorithm and return All Clear immediately.
      // This is the "source of truth" — matches what Balance Sheet shows.
      const [cashSumRow] = await db.select({
        total: sql<string>`COALESCE(SUM(${cashTransactions.amount}), 0)`
      }).from(cashTransactions).where(and(
        eq(cashTransactions.tenantId, tenantId),
        eq(cashTransactions.transactionType, 'cash_out'),
        eq(cashTransactions.category, 'loan_disbursement')
      ));
      const [loanSumRow] = await db.select({
        total: sql<string>`COALESCE(SUM(${loans.principalAmount}), 0)`
      }).from(loans).where(eq(loans.tenantId, tenantId));

      const cashTotal = Number(cashSumRow?.total || 0);
      const loanTotal = Number(loanSumRow?.total || 0);
      const actualDiff = Math.abs(cashTotal - loanTotal);

      if (actualDiff < 1) {
        // Totals match within ₹1 tolerance → All Clear (same as what Balance Sheet shows)
        return {
          success: true,
          missingCount: 0,
          totalMissingAmount: 0,
          loans: [],
          mismatches: [],
          duplicates: [],
          summary: { missingCount: 0, mismatchCount: 0, duplicateCount: 0, totalDiscrepancy: 0 }
        };
      }
      // ────────────────────────────────────────────────────────────────────────
      // Totals differ → run full narration-based diagnostic to find which loans/entries cause the gap

      // Fetch ALL loans with group name (join) + status for richer matching and UI display
      const loansData = await db.select({
        id: loans.id,
        accountNumber: loans.accountNumber,
        borrowerName: loans.borrowerName,
        principalAmount: loans.principalAmount,
        loanDate: loans.loanDate,
        groupId: loans.groupId,
        status: loans.status,
        groupName: groups.name
      })
        .from(loans)
        .leftJoin(groups, eq(loans.groupId, groups.id))
        .where(eq(loans.tenantId, tenantId));

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
        const acct = (loan.accountNumber || '').trim();  // trim spaces to avoid '602 ' ≠ '602' mismatch
        if (!loansByAccount.has(acct)) loansByAccount.set(acct, []);
        loansByAccount.get(acct)!.push(loan);
      }

      // Global set of entry IDs already claimed by an account-number group
      // Used to find unclaimed entries for loans with empty account numbers
      const globalUsedEntryIds = new Set<string>();

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
        let allEntries = allDisbursements.filter(e =>
          e.narration && accountPattern.test(e.narration)
        );

        // EXCLUSION STEP: For purely numeric accounts (e.g. "232"), exclude entries that belong
        // to an alphanumeric extension account (e.g. "232 A", "232B") if that loan exists in DB.
        // This correctly separates "232" and "232 A" without blocking borrowers named "M J" etc.
        // "232 A" is detected as nextChar = ' ' or letter (alpha suffix), NOT a digit extension.
        if (/^\d+$/.test(accountNum.trim())) {
          const alphaExtensions = Array.from(loansByAccount.keys()).filter(acct => {
            if (acct === accountNum) return false;
            if (!acct.startsWith(accountNum)) return false;
            const nextChar = acct[accountNum.length]; // char right after accountNum in extension
            return nextChar === ' ' || /[a-zA-Z]/.test(nextChar); // space-then-letter or direct letter
          });
          if (alphaExtensions.length > 0) {
            allEntries = allEntries.filter(entry => {
              return !alphaExtensions.some(specific => {
                const specEscaped = specific.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const specFlexible = specEscaped.replace(/\s+/g, '\\s*');
                const specLastChar = specific.trim().slice(-1);
                const specBoundary = /[a-zA-Z]/.test(specLastChar) ? '([^0-9a-zA-Z]|$)' : '([^0-9]|$)';
                const specPattern = new RegExp('खाते क्र\\.[ ]?' + specFlexible + specBoundary);
                return specPattern.test(entry.narration);
              });
            });
          }
        }

        // Greedily match each loan to its best available cash entry (no entry reused)
        // Priority: 1) Amount + Group + Date (perfect), 2) Amount + Date, 3) Amount only
        // This correctly handles: same account number in multiple groups (each group independent numbering)
        const usedEntryIds = new Set<string>();

        // Sort: loans with most-specific match get priority to claim their entry first
        const sortedLoans = [...accountLoans].sort((a, b) => {
          const amtA = Number(a.principalAmount);
          const amtB = Number(b.principalAmount);
          const loanDateA = String(a.loanDate || '').split('T')[0];
          const loanDateB = String(b.loanDate || '').split('T')[0];
          const groupA = (a.groupName || '').trim();
          const groupB = (b.groupName || '').trim();

          // Priority 1 wins: amount + date + group all match
          const p1A = allEntries.some(e =>
            Math.abs(Number(e.amount) - amtA) < 0.01 &&
            String(e.transactionDate || '').split('T')[0] === loanDateA &&
            groupA && e.narration && e.narration.includes(groupA)
          );
          const p1B = allEntries.some(e =>
            Math.abs(Number(e.amount) - amtB) < 0.01 &&
            String(e.transactionDate || '').split('T')[0] === loanDateB &&
            groupB && e.narration && e.narration.includes(groupB)
          );
          if (p1A && !p1B) return -1;
          if (p1B && !p1A) return 1;
          return 0;
        });

        for (const loan of sortedLoans) {
          const loanAmount = Number(loan.principalAmount) || 0;
          const loanDate = String(loan.loanDate || '').split('T')[0];
          const groupName = (loan.groupName || '').trim();
          const available = allEntries.filter(e => !usedEntryIds.has(e.id));

          // Priority 1: Amount + Date + Group Name all match (perfect — handles same account in multiple groups)
          let matchingEntry = groupName
            ? available.find(e =>
                Math.abs(Number(e.amount) - loanAmount) < 0.01 &&
                String(e.transactionDate || '').split('T')[0] === loanDate &&
                e.narration && e.narration.includes(groupName)
              )
            : undefined;

          // Priority 2: Amount + Date match (no group in narration or group not found)
          if (!matchingEntry) {
            matchingEntry = available.find(e =>
              Math.abs(Number(e.amount) - loanAmount) < 0.01 &&
              String(e.transactionDate || '').split('T')[0] === loanDate
            );
          }

          // Priority 3: Amount only (last resort — old entries without date match)
          if (!matchingEntry) {
            matchingEntry = available.find(e => Math.abs(Number(e.amount) - loanAmount) < 0.01)
              || available.find(e => Math.abs(Number(e.amount) - loanAmount) < 1.0);
          }

          if (!matchingEntry) {
            // This loan has no matching cash entry → MISSING
            missingLoans.push({
              id: loan.id,
              accountNumber: accountNum,
              borrowerName: loan.borrowerName || '',
              groupName: loan.groupName || '',
              loanDate: loan.loanDate || '',
              principalAmount: loanAmount,
              status: loan.status || 'active'
            });
          } else {
            usedEntryIds.add(matchingEntry.id);
            globalUsedEntryIds.add(matchingEntry.id); // track globally for empty-account loans
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
                cashEntryAmount: Number(matchingEntry.amount),
                status: loan.status || 'active'
              });
            }
            // else: exact match → HEALTHY, no action needed
          }
        }

        // NOTE: Entries not matched to any loan are NOT flagged as duplicates.
        // Same account number can have multiple valid loans across different years.
        // "Duplicate" means narration+date+amount are IDENTICAL — not "no matching loan".
        // Extra unclaimed entries here are valid historical disbursements for older/closed loans.
      }

      // HANDLE LOANS WITH EMPTY ACCOUNT NUMBERS
      // These loans are counted in "loans outstanding" (balance sheet) but skipped in account-based matching above.
      // They cause balance sheet to show Cash > Loans when their cashbook entries are missing.
      // Strategy: match against unclaimed disbursement entries (not yet claimed by any account-number group) by amount.
      const emptyAccountLoans = loansByAccount.get('') || [];
      for (const loan of emptyAccountLoans) {
        const loanAmount = Number(loan.principalAmount) || 0;
        if (!loanAmount) continue;
        // Find unclaimed entries matching this loan's amount
        const unclaimedMatch = allDisbursements.find(e =>
          !globalUsedEntryIds.has(e.id) &&
          Math.abs(Number(e.amount) - loanAmount) < 0.01
        );
        if (unclaimedMatch) {
          globalUsedEntryIds.add(unclaimedMatch.id); // claim it
          // HEALTHY — entry exists, no action needed
        } else {
          // No matching entry found → MISSING (causes balance sheet discrepancy)
          missingLoans.push({
            id: loan.id,
            accountNumber: '',
            borrowerName: loan.borrowerName || '',
            groupName: loan.groupName || '',
            loanDate: loan.loanDate || '',
            principalAmount: loanAmount,
            status: loan.status || 'active'
          });
        }
      }

      // TRUE DUPLICATE DETECTION: narration + date + amount all match → accidentally created twice
      // This is the only valid definition of "duplicate" per business rules.
      // Same account number with different years/amounts = VALID separate loans, NOT duplicates.
      const seenKeys = new Map<string, typeof allDisbursements[0]>();
      for (const entry of allDisbursements) {
        const key = `${(entry.narration || '').trim()}|${entry.transactionDate}|${Number(entry.amount).toFixed(2)}`;
        if (seenKeys.has(key)) {
          // Found a TRUE duplicate pair (identical narration + date + amount)
          const original = seenKeys.get(key)!;
          // Check if this pair is already recorded
          const alreadyRecorded = duplicates.some(d =>
            d.cashEntryIds.includes(original.id) || d.cashEntryIds.includes(entry.id)
          );
          if (!alreadyRecorded) {
            duplicates.push({
              id: 0, // no loan ID — this is entry-based duplicate
              accountNumber: '',
              borrowerName: (entry.narration || '').substring(0, 50),
              loanDate: entry.transactionDate as string || '',
              principalAmount: Number(entry.amount),
              cashEntryIds: [original.id, entry.id],
              cashEntryAmounts: [Number(original.amount), Number(entry.amount)],
              keepEntryIds: [original.id],   // keep first, delete second
              keepEntryId: original.id
            });
          }
        } else {
          seenKeys.set(key, entry);
        }
      }

      const mismatchDiscrepancy = mismatches.reduce((sum, m) => sum + Math.abs(m.principalAmount - m.cashEntryAmount), 0);
      const missingDiscrepancy = missingLoans.reduce((sum, l) => sum + l.principalAmount, 0);
      const duplicateDiscrepancy = duplicates.reduce((sum, d) => {
        // Each true duplicate adds exactly one extra copy of the amount
        return sum + Number(d.principalAmount);
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
            loan.groupName || '',
            (loan as any).loanType,
            (loan as any).collateralDetails,
            (loan as any).weight,
            loan.loanDate
          );
          await db.insert(cashTransactions).values({
            tenantId,
            transactionDate: loan.loanDate as any,
            transactionType: 'cash_out',
            amount: loan.principalAmount.toString() as any,
            narration,
            category: 'loan_disbursement',
            isSystemGenerated: true,
            loanId: loan.id,
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
        const standardNarration = NarrationEngine.createLoanDisbursementNarration(
          mismatch.accountNumber,
          mismatch.borrowerName,
          mismatch.principalAmount,
          (mismatch as any).groupName || '',
          (mismatch as any).loanType,
          (mismatch as any).collateralDetails,
          (mismatch as any).weight,
          (mismatch as any).loanDate
        );
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

      // TRUE DUPLICATE CLEANUP — deletes the second copy of entries with identical narration+date+amount
      // keepEntryIds = [first/original entry] → delete = [second/accidental copy]
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
            // DIRECT DB DELETE: bypasses storage checks (journal entries, linked txn cleanup)
            // Safe because: orphan entries created by fix have no journal entries or linked txns
            const deleteResult = await db.delete(cashTransactions)
              .where(and(
                eq(cashTransactions.id, deleteId),
                eq(cashTransactions.tenantId, tenantId),
                eq(cashTransactions.category, 'loan_disbursement')
              ))
              .returning();
            if (deleteResult.length > 0) {
              duplicatesRemoved++;
              console.log(`✅ CASH-FIX: Deleted orphan entry ${deleteId} ₹${deleteResult[0].amount} for account ${dup.accountNumber}`);
            } else {
              // Fallback: try storage delete (entry may have journal entries from older system)
              const deleted = await storage.deleteCashTransaction(deleteId, tenantId);
              if (deleted) {
                duplicatesRemoved++;
                console.log(`✅ CASH-FIX: Storage-deleted orphan ${deleteId} for account ${dup.accountNumber}`);
              } else {
                console.log(`⚠️ CASH-FIX: Could not delete ${deleteId} for account ${dup.accountNumber}`);
              }
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

  /**
   * REBUILD DISBURSEMENT ENTRIES — Clean-slate reset
   * 1. Delete ALL loan_disbursement cashTransactions for this tenant
   * 2. Recreate one fresh entry per loan (active + closed) from loans DB
   * Safe: only touches loan_disbursement entries, leaves all other cashbook entries intact
   */
  async rebuildDisbursementEntries(tenantId: string): Promise<{
    success: boolean;
    deleted: number;
    created: number;
    message: string;
  }> {
    try {
      // STEP 1: Delete ALL existing loan_disbursement entries for this tenant
      const deleteResult = await db.delete(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, tenantId),
          eq(cashTransactions.category, 'loan_disbursement')
        ))
        .returning({ id: cashTransactions.id });
      const deleted = deleteResult.length;
      console.log(`🗑️ REBUILD: Deleted ${deleted} old loan_disbursement entries for tenant ${tenantId}`);

      // STEP 2: Fetch ALL loans (active + closed) with group names + collateral details
      const allLoans = await db.select({
        id: loans.id,
        accountNumber: loans.accountNumber,
        borrowerName: loans.borrowerName,
        principalAmount: loans.principalAmount,
        loanDate: loans.loanDate,
        loanType: loans.loanType,
        collateralDetails: loans.collateralDetails,
        weight: loans.weight,
        groupName: groups.name
      })
        .from(loans)
        .leftJoin(groups, eq(loans.groupId, groups.id))
        .where(eq(loans.tenantId, tenantId));

      console.log(`📋 REBUILD: Found ${allLoans.length} loans to recreate entries for`);

      // STEP 3: Create one fresh entry per loan
      let created = 0;
      for (const loan of allLoans) {
        try {
          const narration = NarrationEngine.createLoanDisbursementNarration(
            (loan.accountNumber || '').trim(),
            loan.borrowerName || '',
            Number(loan.principalAmount) || 0,
            loan.groupName || '',
            loan.loanType || undefined,
            loan.collateralDetails || undefined,
            loan.weight || undefined,
            loan.loanDate
          );
          await db.insert(cashTransactions).values({
            tenantId,
            transactionDate: loan.loanDate as any,
            transactionType: 'cash_out',
            amount: loan.principalAmount.toString() as any,
            narration,
            category: 'loan_disbursement',
            isSystemGenerated: true,
            loanId: loan.id,
            createdAt: new Date(),
            updatedAt: new Date()
          } as any);
          created++;
        } catch (insertErr) {
          console.error(`❌ REBUILD: Failed to create entry for loan ${loan.accountNumber}:`, insertErr);
        }
      }

      console.log(`✅ REBUILD: Created ${created} fresh loan_disbursement entries`);
      return {
        success: true,
        deleted,
        created,
        message: `${deleted} जुन्या entries हटवल्या, ${created} नव्या entries तयार झाल्या`
      };
    } catch (error) {
      console.error("Rebuild disbursement entries error:", error);
      return {
        success: false,
        deleted: 0,
        created: 0,
        message: "Rebuild अयशस्वी: " + (error as Error).message
      };
    }
  }

  /**
   * Preview closed loan cleanup — shows exact cashbook impact BEFORE deletion.
   * Returns: loanCount, totalDisbursed (cash_out), totalRepaid (cash_in), netCashbookImpact
   * netCashbookImpact = disbursed - repaid → usually negative (interest amount removed from history)
   */
  async previewClosedLoanCleanup(tenantId: string, options: { dateFrom?: string; dateTo?: string }): Promise<{
    success: boolean;
    loanCount: number;
    totalDisbursed: number;
    totalRepaid: number;
    netCashbookImpact: number;
    interestAmount: number;
    loans: { accountNumber: string; borrowerName: string; disbursed: number; repaid: number; net: number }[];
    message: string;
  }> {
    try {
      const closedLoansWithClosure = await db.select({
        loan: loans,
        closure: loanClosures
      }).from(loans)
        .innerJoin(loanClosures, eq(loans.id, loanClosures.loanId))
        .where(and(eq(loans.tenantId, tenantId), eq(loans.status, 'closed')));

      let filteredRows = closedLoansWithClosure;
      if (options.dateFrom || options.dateTo) {
        filteredRows = closedLoansWithClosure.filter(row => {
          const closureDate = new Date(row.closure.closureDate);
          if (options.dateFrom && closureDate < new Date(options.dateFrom)) return false;
          if (options.dateTo && closureDate > new Date(options.dateTo)) return false;
          return true;
        });
      }

      const filteredLoans = filteredRows.map(r => r.loan);

      if (filteredLoans.length === 0) {
        return { success: true, loanCount: 0, totalDisbursed: 0, totalRepaid: 0, netCashbookImpact: 0, interestAmount: 0, loans: [], message: "या तारखांमध्ये बंद झालेली कर्जे नाहीत" };
      }

      const loanRows: { accountNumber: string; borrowerName: string; disbursed: number; repaid: number; net: number }[] = [];
      let totalDisbursed = 0;
      let totalRepaid = 0;

      for (const loan of filteredLoans) {
        const escapedAcct = (loan.accountNumber || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const acctBoundary = /[a-zA-Z]/.test((loan.accountNumber || '').trim().slice(-1)) ? '([^0-9a-zA-Z]|$)' : '([^0-9]|$)';
        const acctPattern = `खाते क्र\\.[ ]?${escapedAcct}${acctBoundary}`;

        const entries = await db.select({
          id: cashTransactions.id,
          transactionType: cashTransactions.transactionType,
          amount: cashTransactions.amount
        }).from(cashTransactions).where(and(
          eq(cashTransactions.tenantId, tenantId),
          or(
            eq(cashTransactions.loanId, loan.id),
            sql`${cashTransactions.narration} ~ ${acctPattern}`,
            sql`${cashTransactions.narration} LIKE ${'%कर्ज वितरण%'} AND ${cashTransactions.narration} LIKE ${'%' + loan.borrowerName + '%'}`,
            sql`${cashTransactions.narration} LIKE ${'%कर्ज जमा%'} AND ${cashTransactions.narration} LIKE ${'%' + loan.borrowerName + '%'}`,
            sql`${cashTransactions.narration} LIKE ${'%कर्ज बंद%'} AND ${cashTransactions.narration} LIKE ${'%' + loan.borrowerName + '%'}`
          )
        ));

        const seen = new Set<string>();
        let disbursed = 0;
        let repaid = 0;
        for (const e of entries) {
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          const amt = Number(e.amount) || 0;
          if (e.transactionType === 'cash_out') disbursed += amt;
          else if (e.transactionType === 'cash_in') repaid += amt;
        }

        totalDisbursed += disbursed;
        totalRepaid += repaid;
        loanRows.push({ accountNumber: loan.accountNumber || '', borrowerName: loan.borrowerName || '', disbursed, repaid, net: disbursed - repaid });
      }

      const netCashbookImpact = totalDisbursed - totalRepaid;

      return {
        success: true,
        loanCount: filteredLoans.length,
        totalDisbursed,
        totalRepaid,
        netCashbookImpact,
        interestAmount: Math.abs(netCashbookImpact),
        loans: loanRows,
        message: `${filteredLoans.length} बंद कर्जे सापडली`
      };
    } catch (error) {
      console.error("Preview closed loan cleanup error:", error);
      return { success: false, loanCount: 0, totalDisbursed: 0, totalRepaid: 0, netCashbookImpact: 0, interestAmount: 0, loans: [], message: "Preview अयशस्वी: " + (error as Error).message };
    }
  }

  /**
   * Simple SUM balance check — the definitive, false-positive-free check.
   * Compares: SUM(cashbook loan_disbursement cash_out) vs SUM(all loans.principalAmount)
   * If diff < ₹1 → allClear = true. No narration matching, no complex algorithm.
   */
  async getBalanceCheck(tenantId: string): Promise<{
    cashTotal: number;
    loanTotal: number;
    diff: number;
    allClear: boolean;
  }> {
    const [cashRow] = await db.select({
      total: sql<string>`COALESCE(SUM(${cashTransactions.amount}), 0)`
    }).from(cashTransactions).where(and(
      eq(cashTransactions.tenantId, tenantId),
      eq(cashTransactions.transactionType, 'cash_out'),
      eq(cashTransactions.category, 'loan_disbursement')
    ));

    const [loanRow] = await db.select({
      total: sql<string>`COALESCE(SUM(${loans.principalAmount}), 0)`
    }).from(loans).where(eq(loans.tenantId, tenantId));

    const cashTotal = Number(cashRow?.total || 0);
    const loanTotal = Number(loanRow?.total || 0);
    const diff = Math.abs(cashTotal - loanTotal);

    return { cashTotal, loanTotal, diff, allClear: diff < 1 };
  }
}

export const dataManagementService = new DataManagementService();