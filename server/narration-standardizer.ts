// Narration Standardization Engine - Root Cause Fix
// Ensures consistent narration formats to prevent duplicate detection failures
// This is the core issue causing separate entries

import { db } from './db';
import { cashTransactions } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface NarrationStandardizationResult {
  success: boolean;
  totalProcessed: number;
  standardized: number;
  duplicatesRemoved: number;
  errors: string[];
  actions: string[];
}

export class NarrationStandardizer {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // Standardize all narrations to prevent future duplicates
  async standardizeAllNarrations(): Promise<NarrationStandardizationResult> {
    const result: NarrationStandardizationResult = {
      success: true,
      totalProcessed: 0,
      standardized: 0,
      duplicatesRemoved: 0,
      errors: [],
      actions: []
    };

    try {
      console.log(`🔄 Starting narration standardization for tenant: ${this.tenantId}`);
      result.actions.push('Starting comprehensive narration standardization');

      // Get all loan-related cash transactions
      const allTransactions = await db
        .select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, this.tenantId),
          sql`(${cashTransactions.narration} LIKE '%कर्ज%' OR ${cashTransactions.narration} LIKE '%खाते%')`
        ));

      result.totalProcessed = allTransactions.length;
      result.actions.push(`Found ${allTransactions.length} loan-related transactions to standardize`);

      // Process each transaction to standardize narration
      for (const transaction of allTransactions) {
        try {
          const standardizedNarration = this.standardizeNarration(
            transaction.narration,
            transaction.transactionType,
            Number(transaction.amount),
            transaction.category
          );

          if (standardizedNarration !== transaction.narration) {
            await db
              .update(cashTransactions)
              .set({ narration: standardizedNarration })
              .where(eq(cashTransactions.id, transaction.id));

            result.standardized++;
            result.actions.push(
              `Standardized: "${transaction.narration}" → "${standardizedNarration}"`
            );
            console.log(`✅ Standardized narration for transaction ${transaction.id}`);
          }
        } catch (error) {
          result.errors.push(`Failed to standardize transaction ${transaction.id}: ${error}`);
          console.error(`❌ Failed to standardize transaction ${transaction.id}:`, error);
        }
      }

      // Remove duplicates after standardization
      const duplicateCleanup = await this.removeDuplicatesAfterStandardization();
      result.duplicatesRemoved = duplicateCleanup.removed;
      result.actions.push(...duplicateCleanup.actions);

      result.actions.push(
        `Standardization completed: ${result.standardized} narrations standardized, ${result.duplicatesRemoved} duplicates removed`
      );
      console.log(`✅ Narration standardization completed for tenant ${this.tenantId}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Standardization failed: ${error}`);
      console.error('Narration standardization failed:', error);
    }

    return result;
  }

  // Create consistent narration format using NarrationEngine ONLY
  private standardizeNarration(
    originalNarration: string,
    transactionType: string,
    amount: number,
    category?: string
  ): string {
    const { NarrationEngine } = require('./narration-engine');
    
    // Extract account number from narration
    const accountMatch = originalNarration.match(/खाते\s*(?:क्र\.?)?\s*([A-Z0-9]+)/i);
    const accountNumber = accountMatch ? accountMatch[1] : 'UNKNOWN';

    // Extract borrower name
    const nameMatch = originalNarration.match(/([A-Za-z\u0900-\u097F\s]+)(?:\s*मुद्दल|\s*-\s*मुद्दल)/);
    const borrowerName = nameMatch ? nameMatch[1].trim() : 'Unknown Borrower';

    // Extract group name if present
    const groupMatch = originalNarration.match(/\(([^)]+)\)/);
    const groupName = groupMatch ? groupMatch[1] : undefined;

    if (transactionType === 'cash_out') {
      // Use NarrationEngine for disbursement
      return NarrationEngine.createLoanDisbursementNarration(accountNumber, borrowerName, Number(amount), groupName);
    } else if (transactionType === 'cash_in' && category === 'loan_repayment') {
      // Use NarrationEngine for closure
      const principalMatch = originalNarration.match(/मुद्दल\s*₹?(\d+(?:\.\d+)?)/);
      const interestMatch = originalNarration.match(/व्याज\s*₹?(\d+(?:\.\d+)?)/);
      
      const principal = principalMatch ? Number(principalMatch[1]) : amount;
      const interest = interestMatch ? Number(interestMatch[1]) : 0;
      
      return NarrationEngine.createLoanClosureNarration(accountNumber, borrowerName, Number(principal), Number(interest), groupName);
    }

    // Return original if no pattern matches
    return originalNarration;
  }

  // Remove duplicates after standardization
  private async removeDuplicatesAfterStandardization(): Promise<{
    removed: number;
    actions: string[];
  }> {
    let removed = 0;
    const actions: string[] = [];

    try {
      // Find and remove exact duplicates after standardization
      const duplicateRemovalResult = await db.execute(sql`
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
      console.log(`✅ Removed exact duplicates after standardization`);

    } catch (error) {
      console.error('Failed to remove duplicates after standardization:', error);
      actions.push(`Error removing duplicates: ${error}`);
    }

    return { removed, actions };
  }

  // Generate standard narration for new transactions
  static generateStandardNarration(
    transactionType: 'cash_in' | 'cash_out',
    accountNumber: string,
    borrowerName: string,
    principalAmount: number,
    interestAmount: number = 0,
    groupName?: string
  ): string {
    if (transactionType === 'cash_out') {
      // Disbursement narration
      const { NarrationEngine } = require('./narration-engine');
      return NarrationEngine.createLoanDisbursementNarration(accountNumber, borrowerName, Number(principalAmount), groupName);
    } else {
      // Closure narration
      const { NarrationEngine } = require('./narration-engine');
      return NarrationEngine.createLoanClosureNarration(accountNumber, borrowerName, Number(principalAmount), Number(interestAmount), groupName);
    }
  }

  // Prevent duplicate creation with standardized check
  async preventDuplicateWithStandardCheck(
    transactionType: 'cash_in' | 'cash_out',
    accountNumber: string,
    amount: number,
    transactionDate: string
  ): Promise<boolean> {
    try {
      // Check using standardized pattern
      const existing = await db
        .select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, this.tenantId),
          eq(cashTransactions.transactionType, transactionType),
          sql`DATE(${cashTransactions.transactionDate}) = DATE(${transactionDate})`,
          sql`${cashTransactions.narration} LIKE ${`%खाते ${accountNumber} %`}`,
          sql`ABS(${cashTransactions.amount} - ${amount}) < 0.01`
        ));

      return existing.length === 0; // Return true if no duplicates found (safe to create)
    } catch (error) {
      console.error('Error in duplicate prevention check:', error);
      return true; // Default to allowing creation if check fails
    }
  }
}

// Export factory function
export function createNarrationStandardizer(tenantId: string): NarrationStandardizer {
  return new NarrationStandardizer(tenantId);
}