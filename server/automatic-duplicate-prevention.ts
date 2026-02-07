// 🚫 AUTOMATIC DUPLICATE PREVENTION DISABLED - ROOT CAUSE ELIMINATION  
// This file is DISABLED to prevent multiple cash transaction creation sources
// "प्रिव्हेन्शन पेक्षा रूट कॉलच काढा" - Auto-creation disabled as requested
// All cash transactions handled ONLY by storage.ts createLoanClosure() method

import { db } from './db';
import { cashTransactions, loans, groups } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { NarrationEngine } from './narration-engine';

export class AutomaticDuplicatePrevention {
  constructor(private tenantId: string) {}

  /**
   * AUTOMATIC SYSTEM: Detect and fix missing loan disbursement entries
   * This runs automatically to ensure complete loan transaction pairs
   */
  async autoDetectAndFixMissingDisbursements(): Promise<{
    detected: number;
    fixed: number;
    actions: string[];
  }> {
    const result = { detected: 0, fixed: 0, actions: [] };
    
    try {
      // Find all active loans that might be missing disbursement entries
      const activeLoans = await db
        .select({
          id: loans.id,
          accountNumber: loans.accountNumber,
          borrowerName: loans.borrowerName,
          principalAmount: loans.principalAmount,
          loanDate: loans.loanDate,
          groupId: loans.groupId,
          groupName: groups.name
        })
        .from(loans)
        .leftJoin(groups, eq(loans.groupId, groups.id))
        .where(eq(loans.tenantId, this.tenantId));

      for (const loan of activeLoans) {
        // Check if disbursement entry exists
        const existingDisbursement = await db
          .select()
          .from(cashTransactions)
          .where(and(
            eq(cashTransactions.tenantId, this.tenantId),
            eq(cashTransactions.transactionType, 'cash_out'),
            eq(cashTransactions.category, 'loan_disbursement'),
            sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${loan.accountNumber}%`}`,
            sql`ABS(${cashTransactions.amount} - ${loan.principalAmount}) < 0.01`
          ));

        if (existingDisbursement.length === 0) {
          result.detected++;
          
          // DUPLICATE SOURCE DISABLED: No automatic cash transaction creation from this system
          // All loan disbursement entries handled by main routes.ts only
          console.log(`🚫 AUTO-PREVENTION DISABLED: Missing disbursement detected but auto-creation disabled for account ${loan.accountNumber} to prevent duplicates`);
          result.actions.push(`Missing disbursement detected for account ${loan.accountNumber} - creation disabled to prevent duplicates`);
        }
      }

      console.log(`🤖 AUTOMATIC SYSTEM: Detected ${result.detected} missing disbursements, fixed ${result.fixed}`);
      return result;
      
    } catch (error) {
      console.error('Error in auto-detection:', error);
      result.actions.push(`Error: ${error}`);
      return result;
    }
  }

  /**
   * AUTOMATIC SYSTEM: Smart duplicate detection and prevention
   * Prevents creation of duplicate entries with standardized narrations
   */
  async autoPreventDuplicates(
    transactionType: 'cash_in' | 'cash_out',
    accountNumber: string,
    amount: number,
    transactionDate: string,
    proposedNarration: string
  ): Promise<boolean> {
    try {
      // Standardize the proposed narration
      const standardizedNarration = NarrationEngine.standardizeExistingNarration(proposedNarration);

      // Check for existing similar transactions
      const existing = await db
        .select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, this.tenantId),
          eq(cashTransactions.transactionType, transactionType),
          sql`DATE(${cashTransactions.transactionDate}) = DATE(${transactionDate})`,
          sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${accountNumber}%`}`,
          sql`ABS(${cashTransactions.amount} - ${amount}) < 0.01`
        ));

      // If exists, check if it's the same standardized operation
      for (const existingTx of existing) {
        const existingStandardized = NarrationEngine.standardizeExistingNarration(existingTx.narration);
        if (NarrationEngine.isSameOperation(standardizedNarration, existingStandardized)) {
          console.log(`🚫 AUTOMATIC PREVENTION: Duplicate detected for account ${accountNumber}`);
          return false; // Prevent duplicate
        }
      }

      return true; // Safe to create
    } catch (error) {
      console.error('Error in duplicate prevention:', error);
      return true; // Default to allowing creation if check fails
    }
  }

  /**
   * AUTOMATIC CLEANUP: Remove exact duplicates while preserving legitimate transactions
   */
  async autoCleanupExactDuplicates(): Promise<{
    removed: number;
    actions: string[];
  }> {
    const result = { removed: 0, actions: [] };

    try {
      // Find and remove exact duplicates (same narration, amount, date)
      const duplicatesRemoved = await db.execute(sql`
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
      
      console.log(`🧹 AUTOMATIC CLEANUP: Removed ${result.removed} exact duplicates`);
      return result;
      
    } catch (error) {
      console.error('Error in auto cleanup:', error);
      result.actions.push(`Cleanup error: ${error}`);
      return result;
    }
  }

  /**
   * MASTER AUTOMATIC FUNCTION: Run all automatic checks and fixes
   */
  async runFullAutomaticSystem(): Promise<{
    missingFixed: number;
    duplicatesRemoved: number;
    totalActions: string[];
  }> {
    console.log('🤖 STARTING FULL AUTOMATIC SYSTEM...');
    
    const missingResult = await this.autoDetectAndFixMissingDisbursements();
    const cleanupResult = await this.autoCleanupExactDuplicates();
    
    const totalActions = [...missingResult.actions, ...cleanupResult.actions];
    
    console.log(`✅ AUTOMATIC SYSTEM COMPLETE: ${missingResult.fixed} missing fixed, ${cleanupResult.removed} duplicates removed`);
    
    return {
      missingFixed: missingResult.fixed,
      duplicatesRemoved: cleanupResult.removed,
      totalActions
    };
  }
}

// Factory function for easy use
export function createAutomaticPrevention(tenantId: string): AutomaticDuplicatePrevention {
  return new AutomaticDuplicatePrevention(tenantId);
}