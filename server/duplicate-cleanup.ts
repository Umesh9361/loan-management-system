// Comprehensive Duplicate Entry Prevention and Cleanup System
// Permanent solution for loan management duplicate entries
// Ensures single source of truth for all cash transactions

import { db } from './db';
import { cashTransactions, loans, loanClosures, groups } from '../shared/schema';
import { eq, and, sql, desc, or, gte, lte } from 'drizzle-orm';

export interface DuplicateCleanupResult {
  success: boolean;
  duplicatesFound: number;
  duplicatesRemoved: number;
  preservedEntries: number;
  errors: string[];
  actions: string[];
}

export class DuplicateCleanupEngine {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // Enhanced duplicate detection with multiple pattern matching
  private async findDuplicatePatterns(): Promise<{
    disbursementDuplicates: any[];
    closureDuplicates: any[];
  }> {
    // Find duplicate disbursement entries
    const disbursementDuplicates = await db
      .select({
        id: cashTransactions.id,
        amount: cashTransactions.amount,
        transactionDate: cashTransactions.transactionDate,
        narration: cashTransactions.narration,
        createdAt: cashTransactions.createdAt,
        accountNumber: sql`SUBSTRING(${cashTransactions.narration} FROM 'खाते [^\s]*')`.as('account_number'),
        duplicateGroup: sql`
          CONCAT(
            DATE(${cashTransactions.transactionDate}),
            '-',
            ${cashTransactions.amount},
            '-',
            SUBSTRING(${cashTransactions.narration} FROM 'खाते [^\s]*')
          )
        `.as('duplicate_group')
      })
      .from(cashTransactions)
      .where(and(
        eq(cashTransactions.tenantId, this.tenantId),
        eq(cashTransactions.transactionType, 'cash_out'),
        or(
          sql`${cashTransactions.narration} LIKE '%कर्ज वितरण%'`,
          sql`${cashTransactions.narration} LIKE '%loan disbursement%'`
        )
      ))
      .orderBy(desc(cashTransactions.createdAt));

    // Find duplicate closure entries
    const closureDuplicates = await db
      .select({
        id: cashTransactions.id,
        amount: cashTransactions.amount,
        transactionDate: cashTransactions.transactionDate,
        narration: cashTransactions.narration,
        createdAt: cashTransactions.createdAt,
        accountNumber: sql`SUBSTRING(${cashTransactions.narration} FROM 'खाते [^\s]*')`.as('account_number'),
        duplicateGroup: sql`
          CONCAT(
            DATE(${cashTransactions.transactionDate}),
            '-',
            ${cashTransactions.amount},
            '-',
            SUBSTRING(${cashTransactions.narration} FROM 'खाते [^\s]*')
          )
        `.as('duplicate_group')
      })
      .from(cashTransactions)
      .where(and(
        eq(cashTransactions.tenantId, this.tenantId),
        eq(cashTransactions.transactionType, 'cash_in'),
        eq(cashTransactions.category, 'loan_repayment'),
        sql`${cashTransactions.narration} LIKE '%कर्जबंद%'`
      ))
      .orderBy(desc(cashTransactions.createdAt));

    return { disbursementDuplicates, closureDuplicates };
  }

  // Group entries by duplicate patterns and keep only the latest/best one
  private groupAndFilterDuplicates(entries: any[]): {
    toKeep: any[];
    toRemove: any[];
  } {
    const grouped = new Map<string, any[]>();
    
    // Group by duplicate pattern
    entries.forEach(entry => {
      const key = entry.duplicateGroup;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(entry);
    });

    const toKeep: any[] = [];
    const toRemove: any[] = [];

    // For each group, keep the best entry and mark others for removal
    grouped.forEach((groupEntries, key) => {
      if (groupEntries.length <= 1) {
        // No duplicates
        toKeep.push(...groupEntries);
        return;
      }

      // Sort by priority: system-generated first, then by creation date (latest first)
      groupEntries.sort((a, b) => {
        // Prefer system-generated entries
        const aIsSystem = a.narration?.includes('मुद्दल') || a.narration?.includes('व्याज');
        const bIsSystem = b.narration?.includes('मुद्दल') || b.narration?.includes('व्याज');
        
        if (aIsSystem && !bIsSystem) return -1;
        if (!aIsSystem && bIsSystem) return 1;
        
        // Then by creation date (latest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Keep the best one, remove others
      toKeep.push(groupEntries[0]);
      toRemove.push(...groupEntries.slice(1));
    });

    return { toKeep, toRemove };
  }

  // Comprehensive duplicate cleanup
  async cleanupDuplicates(): Promise<DuplicateCleanupResult> {
    const result: DuplicateCleanupResult = {
      success: true,
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      preservedEntries: 0,
      errors: [],
      actions: []
    };

    try {
      console.log(`🔄 Starting duplicate cleanup for tenant: ${this.tenantId}`);
      result.actions.push('Starting duplicate detection and cleanup process');

      // Find all potential duplicates
      const { disbursementDuplicates, closureDuplicates } = await this.findDuplicatePatterns();
      
      result.actions.push(`Found ${disbursementDuplicates.length} disbursement entries to check`);
      result.actions.push(`Found ${closureDuplicates.length} closure entries to check`);

      // Process disbursement duplicates
      const disbursementResult = this.groupAndFilterDuplicates(disbursementDuplicates);
      result.duplicatesFound += disbursementResult.toRemove.length;
      result.preservedEntries += disbursementResult.toKeep.length;

      // Process closure duplicates
      const closureResult = this.groupAndFilterDuplicates(closureDuplicates);
      result.duplicatesFound += closureResult.toRemove.length;
      result.preservedEntries += closureResult.toKeep.length;

      // Remove duplicate entries
      const allToRemove = [...disbursementResult.toRemove, ...closureResult.toRemove];
      
      for (const entry of allToRemove) {
        try {
          await db
            .delete(cashTransactions)
            .where(eq(cashTransactions.id, entry.id));
          
          result.duplicatesRemoved++;
          result.actions.push(`Removed duplicate: ${entry.narration} (${entry.amount})`);
          console.log(`✅ Removed duplicate entry: ${entry.id} - ${entry.narration}`);
        } catch (error) {
          result.errors.push(`Failed to remove entry ${entry.id}: ${error}`);
          console.error(`❌ Failed to remove duplicate ${entry.id}:`, error);
        }
      }

      result.actions.push(`Cleanup completed: ${result.duplicatesRemoved} duplicates removed`);
      console.log(`✅ Duplicate cleanup completed: ${result.duplicatesRemoved} removed, ${result.preservedEntries} preserved`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Cleanup failed: ${error}`);
      console.error('Duplicate cleanup failed:', error);
    }

    return result;
  }

  // Prevent future duplicates by checking before creation
  async preventDuplicateCreation(
    transactionType: 'cash_in' | 'cash_out',
    amount: number,
    accountNumber: string,
    transactionDate: string,
    narration: string
  ): Promise<boolean> {
    try {
      // Check for existing transaction with same pattern
      const existing = await db
        .select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, this.tenantId),
          eq(cashTransactions.transactionType, transactionType),
          sql`ABS(${cashTransactions.amount} - ${amount}) < 0.01`,
          sql`DATE(${cashTransactions.transactionDate}) = DATE(${transactionDate})`,
          sql`${cashTransactions.narration} LIKE ${`%खाते ${accountNumber}%`}`
        ));

      if (existing.length > 0) {
        console.log(`⚠️ Duplicate prevention: Similar transaction already exists for account ${accountNumber}`);
        return false; // Prevent creation
      }

      return true; // Allow creation
    } catch (error) {
      console.error('Error in duplicate prevention check:', error);
      return true; // Default to allowing creation if check fails
    }
  }

  // Validate system integrity after cleanup
  async validateIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    stats: {
      totalLoans: number;
      totalClosures: number;
      disbursementEntries: number;
      closureEntries: number;
      orphanedEntries: number;
    };
  }> {
    const issues: string[] = [];
    
    try {
      // Get counts
      const [totalLoans] = await db.select({ count: sql`COUNT(*)` }).from(loans).where(eq(loans.tenantId, this.tenantId));
      const [totalClosures] = await db.select({ count: sql`COUNT(*)` }).from(loanClosures).where(eq(loanClosures.tenantId, this.tenantId));
      
      const [disbursementEntries] = await db
        .select({ count: sql`COUNT(*)` })
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, this.tenantId),
          eq(cashTransactions.transactionType, 'cash_out'),
          sql`${cashTransactions.narration} LIKE '%कर्ज वितरण%'`
        ));

      const [closureEntries] = await db
        .select({ count: sql`COUNT(*)` })
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, this.tenantId),
          eq(cashTransactions.transactionType, 'cash_in'),
          eq(cashTransactions.category, 'loan_repayment')
        ));

      const [orphanedEntries] = await db
        .select({ count: sql`COUNT(*)` })
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, this.tenantId),
          sql`${cashTransactions.narration} LIKE '%खाते%'`,
          sql`NOT EXISTS (
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

      // Check for issues
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
}

// Export factory function
export function createDuplicateCleanupEngine(tenantId: string): DuplicateCleanupEngine {
  return new DuplicateCleanupEngine(tenantId);
}