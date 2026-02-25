/**
 * COMPREHENSIVE REAL-TIME SYNCHRONIZATION ENGINE
 * Ensures ALL loan operations automatically sync with ALL cashbook forms
 * सर्व कर्ज व्यवहार ऑटोमॅटिक रोकडबुक सिंक्रोनाइझेशन
 */

import { db } from "./db";
import { loans, cashTransactions, loanClosures, groups } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "./storage";
import { NarrationEngine } from "./narration-engine";

export interface LoanSyncOperation {
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'CLOSE' | 'REOPEN';
  loanId: string;
  tenantId: string;
  oldData?: any;
  newData?: any;
  metadata?: {
    performedBy: string;
    timestamp: Date;
    reason?: string;
  };
}

export interface SyncResult {
  success: boolean;
  operationsPerformed: string[];
  cashTransactionsAffected: number;
  errors: string[];
  timeTaken: number;
}

export class RealTimeSyncEngine {
  private static instance: RealTimeSyncEngine;
  
  static getInstance(): RealTimeSyncEngine {
    if (!RealTimeSyncEngine.instance) {
      RealTimeSyncEngine.instance = new RealTimeSyncEngine();
    }
    return RealTimeSyncEngine.instance;
  }

  /**
   * Main sync orchestrator - handles ALL loan operations
   */
  async syncLoanOperation(operation: LoanSyncOperation): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      operationsPerformed: [],
      cashTransactionsAffected: 0,
      errors: [],
      timeTaken: 0
    };

    try {
      switch (operation.type) {
        case 'CREATE':
          await this.handleLoanCreation(operation, result);
          break;
        case 'UPDATE':
          await this.handleLoanUpdate(operation, result);
          break;
        case 'DELETE':
          await this.handleLoanDeletion(operation, result);
          break;
        case 'CLOSE':
          await this.handleLoanClosure(operation, result);
          break;
        case 'REOPEN':
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
  private async handleLoanCreation(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { loanId, tenantId, newData } = operation;
    
    if (!newData || Number(newData.principalAmount) <= 0) {
      // console.log('🚫 SYNC: No disbursement needed for zero amount loan');
      return;
    }

    // Check if disbursement cash transaction already exists
    const existingDisbursement = await this.findDisbursementTransaction(tenantId, newData.accountNumber, newData.principalAmount, newData.loanDate);
    
    if (existingDisbursement) {
      // console.log('🚫 SYNC: Disbursement transaction already exists, skipping creation');
      result.operationsPerformed.push('SKIP_EXISTING_DISBURSEMENT');
      return;
    }

    // Create disbursement cash transaction
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
      transactionType: 'cash_out',
      amount: Number(newData.principalAmount),
      category: 'loan_disbursement',
      narration: standardNarration,
      isSystemGenerated: true
    });

    result.operationsPerformed.push('CREATE_DISBURSEMENT_TRANSACTION');
    result.cashTransactionsAffected += 1;
    // console.log(`💰 SYNC: Created disbursement transaction for ₹${newData.principalAmount}`);
  }

  /**
   * Handle loan updates - sync amount/date changes with existing cash transactions
   */
  private async handleLoanUpdate(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { tenantId, oldData, newData } = operation;
    
    if (!oldData || !newData) {
      // console.log('🚫 SYNC: Missing old or new data for update operation');
      return;
    }

    // Check for disbursement transaction updates
    const statusChanged = oldData.status !== newData.status;

    // Always call updateDisbursementTransaction on any loan edit:
    // - Updates amount/date if they changed
    // - Also cleans up any duplicate disbursement entries for this account (idempotent)
    if (newData.status !== 'closed') {
      await this.updateDisbursementTransaction(operation, result);
    }

    if (statusChanged) {
      await this.handleStatusChange(operation, result);
    }
  }

  /**
   * Update disbursement transaction when loan amount or date changes
   * Also cleans up any extra duplicate entries for the same account
   */
  private async updateDisbursementTransaction(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { tenantId, oldData, newData } = operation;

    // Find the FIRST disbursement entry for this account (any narration format)
    const disbursementTransaction = await this.findDisbursementTransaction(
      tenantId,
      oldData.accountNumber,
      oldData.principalAmount,
      oldData.loanDate
    );

    if (!disbursementTransaction) {
      result.operationsPerformed.push('NO_DISBURSEMENT_TO_UPDATE');
      return;
    }

    // Prepare update data — only update amount and/or date, NEVER change original narration
    const updateData: any = {};

    if (Number(oldData.principalAmount) !== Number(newData.principalAmount)) {
      updateData.amount = Number(newData.principalAmount);
      result.operationsPerformed.push(`UPDATE_AMOUNT_${oldData.principalAmount}_TO_${newData.principalAmount}`);
    }

    if (oldData.loanDate !== newData.loanDate) {
      updateData.transactionDate = newData.loanDate;
      result.operationsPerformed.push(`UPDATE_DATE_${oldData.loanDate}_TO_${newData.loanDate}`);
    }

    // NOTE: narration is intentionally NOT updated — original narration is preserved as-is
    // Only amount and date are synced when a loan is edited

    if (Object.keys(updateData).length > 0) {
      await storage.updateCashTransaction(disbursementTransaction.id, tenantId, updateData);
      result.cashTransactionsAffected += 1;
      result.operationsPerformed.push('UPDATED_DISBURSEMENT_AMOUNT_DATE');
    }

    // Clean up any OTHER disbursement entries for the same account (old duplicates)
    const allEntries = await this.findAllDisbursementTransactions(tenantId, newData.accountNumber);
    for (const extra of allEntries) {
      if (extra.id !== disbursementTransaction.id) {
        await storage.deleteCashTransaction(extra.id, tenantId);
        result.cashTransactionsAffected += 1;
        result.operationsPerformed.push(`DELETED_DUPLICATE_DISBURSEMENT_${extra.id}`);
        console.log(`🗑️ SYNC: Deleted old duplicate disbursement for account ${newData.accountNumber}: ${extra.narration?.substring(0, 40)}`);
      }
    }
  }

  /**
   * Handle loan deletion - remove all related cash transactions
   */
  private async handleLoanDeletion(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { tenantId, oldData } = operation;
    
    if (!oldData) {
      // console.log('🚫 SYNC: No old data provided for deletion');
      return;
    }

    // Find and delete all related cash transactions
    const relatedTransactions = await this.findAllRelatedTransactions(tenantId, oldData.accountNumber, oldData.borrowerName);
    
    for (const transaction of relatedTransactions) {
      await storage.deleteCashTransaction(transaction.id, tenantId);
      result.cashTransactionsAffected += 1;
      result.operationsPerformed.push(`DELETE_TRANSACTION_${transaction.category}`);
    }

    // console.log(`🗑️ SYNC: Deleted ${relatedTransactions.length} related cash transactions`);
  }

  /**
   * Handle loan closure - create closure cash transaction
   */
  private async handleLoanClosure(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { tenantId, newData } = operation;
    
    if (!newData) {
      // console.log('🚫 SYNC: No closure data provided');
      return;
    }

    // Check if closure transaction already exists
    const existingClosure = await this.findClosureTransaction(tenantId, newData.accountNumber, newData.totalAmount, newData.closureDate);
    
    if (existingClosure) {
      // console.log('🚫 SYNC: Closure transaction already exists');
      result.operationsPerformed.push('SKIP_EXISTING_CLOSURE');
      return;
    }

    // Create closure cash transaction
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
      transactionType: 'cash_in',
      amount: Number(newData.totalAmount),
      category: 'loan_repayment',
      narration: standardNarration,
      isSystemGenerated: true
    });

    result.operationsPerformed.push('CREATE_CLOSURE_TRANSACTION');
    result.cashTransactionsAffected += 1;
    // console.log(`💰 SYNC: Created closure transaction for ₹${newData.totalAmount}`);
  }

  /**
   * Handle loan reopen - remove closure transactions
   */
  private async handleLoanReopen(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { tenantId, oldData } = operation;
    
    if (!oldData) {
      // console.log('🚫 SYNC: No data provided for reopen');
      return;
    }

    // Find and delete closure transactions
    const closureTransactions = await this.findClosureTransactions(tenantId, oldData.accountNumber, oldData.borrowerName);
    
    for (const transaction of closureTransactions) {
      await storage.deleteCashTransaction(transaction.id, tenantId);
      result.cashTransactionsAffected += 1;
      result.operationsPerformed.push('DELETE_CLOSURE_TRANSACTION');
    }

    // console.log(`🔄 SYNC: Removed ${closureTransactions.length} closure transactions for reopen`);
  }

  /**
   * Handle status change between active/closed
   */
  private async handleStatusChange(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { oldData, newData } = operation;
    
    if (oldData.status === 'active' && newData.status === 'closed') {
      // Handle automatic closure
      await this.handleLoanClosure(operation, result);
    } else if (oldData.status === 'closed' && newData.status === 'active') {
      // Handle automatic reopen
      await this.handleLoanReopen(operation, result);
    }
  }

  // Helper: build exact account number regex (e.g. "461" → matches "461 " or "461-" or "461" at end, NOT "4610")
  private buildAccountPattern(accountNumber: string): RegExp {
    const escaped = accountNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('खाते क्र\\.[ ]?' + escaped + '([^0-9]|$)');
  }

  // Helper methods for finding transactions
  private async findDisbursementTransaction(tenantId: string, accountNumber: string, amount: number, date: string): Promise<any> {
    const transactions = await storage.getCashTransactions(tenantId);
    const pattern = this.buildAccountPattern(accountNumber);
    // Match ANY narration format: "कर्ज वितरण", "कर्ज वाटप", "कर्ज रकम अपडेट", etc.
    // Do NOT filter by amount — find by account+category so ALL formats are found
    return transactions.find((ct: any) =>
      ct.category === 'loan_disbursement' &&
      ct.transactionType === 'cash_out' &&
      ct.narration && pattern.test(ct.narration)
    );
  }

  private async findAllDisbursementTransactions(tenantId: string, accountNumber: string): Promise<any[]> {
    const transactions = await storage.getCashTransactions(tenantId);
    const pattern = this.buildAccountPattern(accountNumber);
    return transactions.filter((ct: any) =>
      ct.category === 'loan_disbursement' &&
      ct.transactionType === 'cash_out' &&
      ct.narration && pattern.test(ct.narration)
    );
  }

  private async findClosureTransaction(tenantId: string, accountNumber: string, amount: number, date: string): Promise<any> {
    const transactions = await storage.getCashTransactions(tenantId);
    const pattern = this.buildAccountPattern(accountNumber);
    return transactions.find((ct: any) =>
      ct.category === 'loan_repayment' &&
      ct.transactionType === 'cash_in' &&
      ct.narration && pattern.test(ct.narration) &&
      Math.abs(Number(ct.amount) - Number(amount)) < 0.01
    );
  }

  private async findAllRelatedTransactions(tenantId: string, accountNumber: string, borrowerName: string): Promise<any[]> {
    const transactions = await storage.getCashTransactions(tenantId);
    const pattern = this.buildAccountPattern(accountNumber);
    return transactions.filter((ct: any) =>
      ct.narration && (
        pattern.test(ct.narration) ||
        ct.narration.includes(borrowerName)
      )
    );
  }

  private async findClosureTransactions(tenantId: string, accountNumber: string, borrowerName: string): Promise<any[]> {
    const transactions = await storage.getCashTransactions(tenantId);
    const pattern = this.buildAccountPattern(accountNumber);
    return transactions.filter((ct: any) =>
      ct.category === 'loan_repayment' &&
      ct.narration && (
        pattern.test(ct.narration) ||
        ct.narration.includes(borrowerName)
      )
    );
  }

  // Helper methods for data processing
  private async getGroupName(tenantId: string, groupId?: string): Promise<string> {
    if (!groupId) return '';
    const groups = await storage.getGroups(tenantId);
    const group = groups.find(g => g.id === groupId);
    return group?.name || '';
  }

  private createDisbursementNarration(accountNumber: string, borrowerName: string, amount: number, groupName?: string): string {
    // CRITICAL FIX: Use standardized NarrationEngine to preserve full borrower names
    const { NarrationEngine } = require('./narration-engine');
    return NarrationEngine.createLoanDisbursementNarration(accountNumber, borrowerName, amount, groupName);
  }

  private createClosureNarration(accountNumber: string, borrowerName: string, amount: number, groupName?: string): string {
    // CRITICAL FIX: Use standardized NarrationEngine to preserve full borrower names
    const { NarrationEngine } = require('./narration-engine');
    return NarrationEngine.createLoanClosureNarration(accountNumber, borrowerName, amount, 0, groupName);
  }
}

/**
 * Factory function to get the singleton instance
 */
export function getRealTimeSyncEngine(): RealTimeSyncEngine {
  return RealTimeSyncEngine.getInstance();
}

/**
 * Convenience function for triggering sync operations
 */
export async function triggerLoanSync(operation: LoanSyncOperation): Promise<SyncResult> {
  const engine = getRealTimeSyncEngine();
  return await engine.syncLoanOperation(operation);
}

/**
 * REPAIR FUNCTION: Backfill missing closure cash_in entries
 * Finds all loan closures that don't have a matching cash_in in cash_transactions
 * and creates them. Also backfills missing disbursement cash_out entries.
 * Run on server startup to ensure data integrity.
 */
export async function repairMissingCashEntries(): Promise<{ closuresRepaired: number; disbursementsRepaired: number }> {
  let closuresRepaired = 0;
  let disbursementsRepaired = 0;

  try {
    const allClosures = await db.select({
      closureId: loanClosures.id,
      loanId: loanClosures.loanId,
      tenantId: loanClosures.tenantId,
      totalAmount: loanClosures.totalAmount,
      interestPaid: loanClosures.interestPaid,
      closureDate: loanClosures.closureDate,
      accountNumber: loans.accountNumber,
      borrowerName: loans.borrowerName,
      principalAmount: loans.principalAmount,
      groupId: loans.groupId,
      loanDate: loans.loanDate,
    }).from(loanClosures)
      .innerJoin(loans, eq(loanClosures.loanId, loans.id));

    for (const closure of allClosures) {
      const tenantId = closure.tenantId;
      const accountNumber = closure.accountNumber;

      const existingClosureCashIn = await db.select({ id: cashTransactions.id })
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, tenantId),
          eq(cashTransactions.transactionType, 'cash_in'),
          eq(cashTransactions.category, 'loan_repayment'),
          sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${accountNumber}%`}`,
          sql`ABS(${cashTransactions.amount} - ${Number(closure.totalAmount)}) < 0.01`
        ));

      if (existingClosureCashIn.length === 0) {
        let groupName = '';
        if (closure.groupId) {
          const [grp] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, closure.groupId));
          groupName = grp?.name || '';
        }
        const narration = NarrationEngine.createLoanClosureNarration(
          accountNumber, closure.borrowerName,
          Number(closure.totalAmount), Number(closure.interestPaid), groupName
        );

        await storage.createCashTransaction({
          tenantId,
          transactionDate: closure.closureDate,
          transactionType: 'cash_in',
          amount: Number(closure.totalAmount),
          category: 'loan_repayment',
          narration,
          isSystemGenerated: true
        });
        closuresRepaired++;
        console.log(`🔧 REPAIR: Created missing closure cash_in for account ${accountNumber} - ₹${closure.totalAmount}`);
      }

      const existingDisbursement = await db.select({ id: cashTransactions.id })
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, tenantId),
          eq(cashTransactions.transactionType, 'cash_out'),
          eq(cashTransactions.category, 'loan_disbursement'),
          sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${accountNumber}%`}`,
          sql`ABS(${cashTransactions.amount} - ${Number(closure.principalAmount)}) < 0.01`
        ));

      if (existingDisbursement.length === 0) {
        let groupName = '';
        if (closure.groupId) {
          const [grp] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, closure.groupId));
          groupName = grp?.name || '';
        }
        const narration = NarrationEngine.createLoanDisbursementNarration(
          accountNumber, closure.borrowerName,
          Number(closure.principalAmount), groupName
        );

        await storage.createCashTransaction({
          tenantId,
          transactionDate: closure.loanDate,
          transactionType: 'cash_out',
          amount: Number(closure.principalAmount),
          category: 'loan_disbursement',
          narration,
          isSystemGenerated: true
        });
        disbursementsRepaired++;
        console.log(`🔧 REPAIR: Created missing disbursement cash_out for account ${accountNumber} - ₹${closure.principalAmount}`);
      }
    }

    if (closuresRepaired > 0 || disbursementsRepaired > 0) {
      console.log(`🔧 CASH ENTRY REPAIR COMPLETE: ${closuresRepaired} closures, ${disbursementsRepaired} disbursements backfilled`);
    } else {
      console.log(`✅ CASH ENTRY CHECK: All loan cash entries are in sync`);
    }
  } catch (error) {
    console.error('❌ REPAIR ERROR:', error);
  }

  return { closuresRepaired, disbursementsRepaired };
}