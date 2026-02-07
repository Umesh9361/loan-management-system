// 🚫 COMPREHENSIVE SYNC DISABLED - ROOT CAUSE ELIMINATION
// This file is DISABLED to prevent multiple cash transaction creation sources
// All cash transactions handled ONLY by storage.ts - Single source of truth
// "प्रिव्हेन्शन पेक्षा रूट कॉलच काढा" - Source eliminated as requested

import { db } from './db';
import { cashTransactions } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface ComprehensiveSyncResult {
  success: boolean;
  duplicatesRemoved: number;
  narrationUpdated: number;
  groupNamesAdded: number;
  errors: string[];
  actions: string[];
}

export class ComprehensiveCashSync {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // Complete sync with group names and duplicate removal
  async performComprehensiveSync(): Promise<ComprehensiveSyncResult> {
    const result: ComprehensiveSyncResult = {
      success: true,
      duplicatesRemoved: 0,
      narrationUpdated: 0,
      groupNamesAdded: 0,
      errors: [],
      actions: []
    };

    try {
      console.log(`🔄 Starting comprehensive cash sync for tenant: ${this.tenantId}`);
      result.actions.push('Starting comprehensive cash sync with group names');

      // Step 1: Remove exact duplicates first
      const duplicateRemoval = await this.removeExactDuplicates();
      result.duplicatesRemoved = duplicateRemoval.removed;
      result.actions.push(...duplicateRemoval.actions);

      // Step 2: Update narrations to include group names consistently
      const narrationUpdate = await this.updateNarrationsWithGroupNames();
      result.narrationUpdated = narrationUpdate.updated;
      result.groupNamesAdded = narrationUpdate.groupNamesAdded;
      result.actions.push(...narrationUpdate.actions);

      // Step 3: Final cleanup after standardization
      const finalCleanup = await this.finalDuplicateCleanup();
      result.duplicatesRemoved += finalCleanup.removed;
      result.actions.push(...finalCleanup.actions);

      result.actions.push(
        `Comprehensive sync completed: ${result.duplicatesRemoved} duplicates removed, ${result.narrationUpdated} narrations updated, ${result.groupNamesAdded} group names added`
      );
      console.log(`✅ Comprehensive cash sync completed for tenant ${this.tenantId}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Comprehensive sync failed: ${error}`);
      console.error('Comprehensive sync failed:', error);
    }

    return result;
  }

  // Remove exact duplicates based on pattern matching
  private async removeExactDuplicates(): Promise<{
    removed: number;
    actions: string[];
  }> {
    let removed = 0;
    const actions: string[] = [];

    try {
      // Remove exact duplicates using advanced pattern matching
      const deleteResult = await db.execute(sql`
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
      console.log(`✅ Removed exact duplicate entries`);

    } catch (error) {
      console.error('Failed to remove exact duplicates:', error);
      actions.push(`Error removing duplicates: ${error}`);
    }

    return { removed, actions };
  }

  // Update narrations to include group names consistently
  private async updateNarrationsWithGroupNames(): Promise<{
    updated: number;
    groupNamesAdded: number;
    actions: string[];
  }> {
    let updated = 0;
    let groupNamesAdded = 0;
    const actions: string[] = [];

    try {
      // Get all loan-related transactions that need group name updates
      const transactions = await db
        .select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, this.tenantId),
          sql`(${cashTransactions.narration} LIKE '%कर्ज%' OR ${cashTransactions.narration} LIKE '%खाते%')`
        ));

      for (const transaction of transactions) {
        try {
          const updatedNarration = await this.addGroupNameToNarration(transaction.narration);
          
          if (updatedNarration !== transaction.narration) {
            await db
              .update(cashTransactions)
              .set({ narration: updatedNarration })
              .where(eq(cashTransactions.id, transaction.id));

            updated++;
            if (updatedNarration.includes('(') && updatedNarration.includes(')')) {
              groupNamesAdded++;
            }
            
            actions.push(`Updated: "${transaction.narration.substring(0, 50)}..." → "${updatedNarration.substring(0, 50)}..."`);
            console.log(`✅ Updated narration for transaction ${transaction.id}`);
          }
        } catch (error) {
          actions.push(`Failed to update transaction ${transaction.id}: ${error}`);
          console.error(`❌ Failed to update transaction ${transaction.id}:`, error);
        }
      }

    } catch (error) {
      console.error('Failed to update narrations with group names:', error);
      actions.push(`Error updating narrations: ${error}`);
    }

    return { updated, groupNamesAdded, actions };
  }

  // Add group name to narration based on account number lookup
  private async addGroupNameToNarration(narration: string): Promise<string> {
    try {
      // Extract account number from narration
      const accountMatch = narration.match(/खाते\s*(?:क्र\.?\s*)?([A-Z0-9]+)/i);
      if (!accountMatch) {
        return narration;
      }

      const accountNumber = accountMatch[1];

      // Look up group name from loans table
      const [loanInfo] = await db.execute(sql`
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

      const { borrower_name, group_name } = loanInfo.rows[0] as any;
      const groupName = group_name || 'सामान्य';

      // Standardize narration format with group name
      if (narration.includes('कर्ज वितरण') || narration.includes('वितरण')) {
        // Disbursement format
        const amountMatch = narration.match(/₹?(\d+(?:,\d+)*(?:\.\d+)?)/);
        const amount = amountMatch ? amountMatch[1] : '0';
        const { NarrationEngine } = require('./narration-engine');
        return NarrationEngine.createLoanDisbursementNarration(accountNumber, borrower_name, Number(amount), groupName);
      } else if (narration.includes('कर्जबंद') || narration.includes('कर्ज बंद')) {
        // Closure format
        const principalMatch = narration.match(/मुद्दल\s*₹?(\d+(?:,\d+)*(?:\.\d+)?)/);
        const interestMatch = narration.match(/व्याज\s*₹?(\d+(?:,\d+)*(?:\.\d+)?)/);
        
        const principal = principalMatch ? principalMatch[1] : '0';
        const interest = interestMatch ? interestMatch[1] : '0';
        
        const { NarrationEngine } = require('./narration-engine');
        return NarrationEngine.createLoanClosureNarration(accountNumber, borrower_name, Number(principal), Number(interest), groupName);
      }

      // If already has group name in parentheses, return as is
      if (narration.includes(`(${groupName})`)) {
        return narration;
      }

      // Add group name to existing narration
      return `${narration} (${groupName})`;

    } catch (error) {
      console.error('Error adding group name to narration:', error);
      return narration;
    }
  }

  // Final cleanup after all updates
  private async finalDuplicateCleanup(): Promise<{
    removed: number;
    actions: string[];
  }> {
    let removed = 0;
    const actions: string[] = [];

    try {
      // Final cleanup using exact narration matching
      const finalCleanupResult = await db.execute(sql`
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
      console.log(`✅ Final duplicate cleanup completed`);

    } catch (error) {
      console.error('Failed final cleanup:', error);
      actions.push(`Error in final cleanup: ${error}`);
    }

    return { removed, actions };
  }

  // DEPRECATED: Use NarrationEngine directly instead
  // This function is kept for backward compatibility but should not be used
  static generateNarrationWithGroup(
    transactionType: 'cash_in' | 'cash_out',
    accountNumber: string,
    borrowerName: string,
    principalAmount: number,
    interestAmount: number = 0,
    groupName: string = 'सामान्य'
  ): string {
    const { NarrationEngine } = require('./narration-engine');
    
    if (transactionType === 'cash_out') {
      return NarrationEngine.createLoanDisbursementNarration(accountNumber, borrowerName, Number(principalAmount), groupName);
    } else {
      return NarrationEngine.createLoanClosureNarration(accountNumber, borrowerName, Number(principalAmount), Number(interestAmount), groupName);
    }
  }
}

// Export factory function
export function createComprehensiveCashSync(tenantId: string): ComprehensiveCashSync {
  return new ComprehensiveCashSync(tenantId);
}