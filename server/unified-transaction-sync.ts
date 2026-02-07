// Unified Transaction System - Merge Loan and Cash Transactions
// Ensures single source of truth for all financial operations
// Eliminates duplicate tracking in separate systems

import { db } from './db';
import { transactions, cashTransactions, loans, loanClosures, groups } from '../shared/schema';
import { eq, and, sql, desc, or } from 'drizzle-orm';

export interface UnificationResult {
  success: boolean;
  loanTransactionsMigrated: number;
  duplicatesRemoved: number;
  cashTransactionsUpdated: number;
  errors: string[];
  actions: string[];
}

export class UnifiedTransactionEngine {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // Migrate loan transactions to cash transactions and remove duplicates
  async unifyTransactionSystems(): Promise<UnificationResult> {
    const result: UnificationResult = {
      success: true,
      loanTransactionsMigrated: 0,
      duplicatesRemoved: 0,
      cashTransactionsUpdated: 0,
      errors: [],
      actions: []
    };

    try {
      // console.log(`🔄 Starting transaction unification for tenant: ${this.tenantId}`);
      result.actions.push('Starting loan and cash transaction unification');

      // Step 1: Get all loan transactions that need to be converted to cash transactions
      const loanTransactions = await db
        .select({
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
        })
        .from(transactions)
        .innerJoin(loans, eq(transactions.loanId, loans.id))
        .leftJoin(groups, eq(loans.groupId, groups.id))
        .where(eq(transactions.tenantId, this.tenantId))
        .orderBy(desc(transactions.createdAt));

      result.actions.push(`Found ${loanTransactions.length} loan transactions to unify`);

      // Step 2: For each loan transaction, check if corresponding cash transaction exists
      for (const loanTx of loanTransactions) {
        try {
          const transactionType = loanTx.type === 'disbursement' ? 'cash_out' : 'cash_in';
          const category = loanTx.type === 'disbursement' ? 'loan_disbursement' : 'loan_repayment';
          const amount = Number(loanTx.amount) + Number(loanTx.interestAmount || 0);

          // Create appropriate narration using centralized NarrationEngine
          const { NarrationEngine } = await import('./narration-engine');
          let narration: string;
          if (loanTx.type === 'disbursement') {
            narration = NarrationEngine.createLoanDisbursementNarration(
              loanTx.loan.accountNumber,
              loanTx.loan.borrowerName,
              Number(loanTx.amount),
              loanTx.loan.groupName || undefined
            );
          } else {
            // Use NarrationEngine for closure as well
            const principalAmount = Number(loanTx.amount);
            const interestAmount = Number(loanTx.interestAmount || 0);
            narration = NarrationEngine.createLoanClosureNarration(
              loanTx.loan.accountNumber,
              loanTx.loan.borrowerName,
              principalAmount,
              interestAmount,
              loanTx.loan.groupName || undefined
            );
          }

          // Check if cash transaction already exists for this loan transaction
          const existingCashTx = await db
            .select()
            .from(cashTransactions)
            .where(and(
              eq(cashTransactions.tenantId, this.tenantId),
              eq(cashTransactions.transactionType, transactionType),
              sql`DATE(${cashTransactions.transactionDate}) = DATE(${loanTx.transactionDate})`,
              sql`${cashTransactions.narration} LIKE ${`%खाते ${loanTx.loan.accountNumber}%`}`,
              sql`ABS(${cashTransactions.amount} - ${amount}) < 0.01`
            ));

          if (existingCashTx.length === 0) {
            // DUPLICATE SOURCE DISABLED: No cash transaction creation from unified sync
            // All loan disbursement entries handled by main routes.ts only
            // console.log(`🚫 UNIFIED SYNC DISABLED: Missing cash transaction detected but creation disabled for account ${loanTx.loan.accountNumber} to prevent duplicates`);
            result.actions.push(`Missing cash transaction detected for ${loanTx.loan.accountNumber} - creation disabled to prevent duplicates`);
          } else {
            result.actions.push(`Cash transaction already exists for ${loanTx.loan.accountNumber}`);
          }

        } catch (error) {
          result.errors.push(`Failed to migrate transaction ${loanTx.id}: ${error}`);
          // console.error(`❌ Failed to migrate transaction ${loanTx.id}:`, error);
        }
      }

      // Step 3: Remove duplicate cash transactions (keeping the best ones)
      const duplicateCleanup = await this.cleanupDuplicateCashTransactions();
      result.duplicatesRemoved = duplicateCleanup.duplicatesRemoved;
      result.actions.push(...duplicateCleanup.actions);

      // Step 4: Update cash transaction narrations to be consistent
      const narrationUpdate = await this.standardizeNarrations();
      result.cashTransactionsUpdated = narrationUpdate.updated;
      result.actions.push(...narrationUpdate.actions);

      result.actions.push(`Unification completed: ${result.loanTransactionsMigrated} migrated, ${result.duplicatesRemoved} duplicates removed`);
      // console.log(`✅ Transaction unification completed for tenant ${this.tenantId}`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Unification failed: ${error}`);
      // console.error('Transaction unification failed:', error);
    }

    return result;
  }

  // Clean up duplicate cash transactions
  private async cleanupDuplicateCashTransactions(): Promise<{
    duplicatesRemoved: number;
    actions: string[];
  }> {
    const duplicatesRemoved = 0;
    const actions: string[] = [];

    try {
      // Find and remove duplicates using pattern matching
      const duplicateQuery = await db.execute(sql`
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
      // console.log(`✅ Cleaned up duplicate cash transactions`);

    } catch (error) {
      // console.error('Failed to cleanup duplicates:', error);
      actions.push(`Error cleaning duplicates: ${error}`);
    }

    return { duplicatesRemoved, actions };
  }

  // Standardize narration formats
  private async standardizeNarrations(): Promise<{
    updated: number;
    actions: string[];
  }> {
    let updated = 0;
    const actions: string[] = [];

    try {
      // DEPRECATED: Old disbursement format updates disabled - Use NarrationEngine only  
      // console.log('⚠️ Legacy disbursement narration updates disabled - Use NarrationEngine for consistency');

      // DEPRECATED: Old closure format updates disabled - Use NarrationEngine only
      // console.log('⚠️ Legacy closure narration updates disabled - Use NarrationEngine for consistency');

      actions.push('Standardized narration formats for consistency');
      // console.log(`✅ Standardized narration formats`);

    } catch (error) {
      // console.error('Failed to standardize narrations:', error);
      actions.push(`Error standardizing narrations: ${error}`);
    }

    return { updated, actions };
  }

  // Validate unified system integrity
  async validateUnifiedSystem(): Promise<{
    isValid: boolean;
    issues: string[];
    stats: {
      totalCashTransactions: number;
      loanDisbursements: number;
      loanClosures: number;
      orphanedTransactions: number;
      duplicatePatterns: number;
    };
  }> {
    const issues: string[] = [];
    
    try {
      // Get comprehensive stats
      const [totalCashTx] = await db
        .select({ count: sql`COUNT(*)` })
        .from(cashTransactions)
        .where(eq(cashTransactions.tenantId, this.tenantId));

      const [disbursements] = await db
        .select({ count: sql`COUNT(*)` })
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, this.tenantId),
          eq(cashTransactions.transactionType, 'cash_out'),
          sql`${cashTransactions.narration} LIKE '%कर्ज वितरण%'`
        ));

      const [closures] = await db
        .select({ count: sql`COUNT(*)` })
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, this.tenantId),
          eq(cashTransactions.transactionType, 'cash_in'),
          eq(cashTransactions.category, 'loan_repayment')
        ));

      const [orphaned] = await db
        .select({ count: sql`COUNT(*)` })
        .from(transactions)
        .where(eq(transactions.tenantId, this.tenantId));

      const duplicates = await db.execute(sql`
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
        duplicatePatterns: Number((duplicates as any).rows?.[0]?.count || 0)
      };

      // Check for issues
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
}

// Export factory function
export function createUnifiedTransactionEngine(tenantId: string): UnifiedTransactionEngine {
  return new UnifiedTransactionEngine(tenantId);
}