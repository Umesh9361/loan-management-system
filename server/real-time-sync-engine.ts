/**
 * REAL-TIME SYNCHRONIZATION ENGINE — 3-TIER ARCHITECTURE
 *
 * Tier 1: loan_id UUID  — primary source of truth (new entries, post-Rebuild)
 * Tier 2: NULL loan_id + exact amount + exact date — safe fallback for old entries
 * Tier 3: Startup auto-backfill — migrates old entries to Tier 1 automatically
 *
 * Narration is DISPLAY-ONLY. Never used for lookup/matching.
 * UUID collision is mathematically impossible → no false matches across loans.
 */

import { db } from "./db";
import { loans, cashTransactions, loanClosures, groups } from "@shared/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
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

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 1 HELPER: Find disbursement entry by loanId (UUID) — 100% reliable
  // ─────────────────────────────────────────────────────────────────────────
  private async findDisbursementByLoanId(tenantId: string, loanId: string): Promise<any> {
    try {
      const [row] = await db.select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, tenantId),
          eq(cashTransactions.loanId, loanId),
          eq(cashTransactions.category, 'loan_disbursement'),
          eq(cashTransactions.transactionType, 'cash_out')
        ));
      return row || null;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NARRATION DATE VERIFIER — confirms loanId entry truly belongs to this loan
  //
  // Old narrations (no ' | ') → trust loanId fully (return true)
  // New narrations (has ' | ') → check if DD/MM/YYYY of loanDate appears in narration
  //   Match  → correct entry ✅
  //   No match → corrupt loanId (unlikely but safe) ❌ → caller uses Tier 2
  //
  // Replace for the earlier 180-day arbitrary range check.
  // ─────────────────────────────────────────────────────────────────────────
  private verifyEntryBelongsToLoan(entry: any, loanDate: string): boolean {
    // Compare entry's transactionDate with the loan's current date.
    // transactionDate is always kept in sync with loanDate by updateDisbursementTransaction.
    // This is more reliable than narration date (narration is never updated after creation).
    //
    // If corrupt loanId: entry belongs to a different loan → its transactionDate ≠ this loan's date → false ✅
    // If correct loanId: transactionDate was synced on every date update → matches ✅
    //
    // Edge case: transactionDate unavailable → trust loanId (can't verify, don't block)
    const entryDate = entry?.transactionDate;
    if (!entryDate || !loanDate) return true;
    return String(entryDate) === String(loanDate);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 2 HELPER: Find old disbursement entry (loan_id IS NULL) by exact
  // amount + exact date. Returns ONLY when exactly 1 match exists — never
  // guesses when ambiguous (0 or 2+ matches → returns null, user runs Rebuild)
  // ─────────────────────────────────────────────────────────────────────────
  private async findOrphanDisbursement(
    tenantId: string,
    amount: number,
    date: string
  ): Promise<any> {
    try {
      const rows = await db.select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, tenantId),
          eq(cashTransactions.category, 'loan_disbursement'),
          eq(cashTransactions.transactionType, 'cash_out'),
          isNull(cashTransactions.loanId),
          eq(cashTransactions.transactionDate, date),
          sql`ABS(${cashTransactions.amount} - ${amount}) < 0.01`
        ));
      return rows.length === 1 ? rows[0] : null;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE — loan नवीन बनवणे
  // ─────────────────────────────────────────────────────────────────────────
  private async handleLoanCreation(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { loanId, tenantId, newData } = operation;

    if (!newData || Number(newData.principalAmount) <= 0) return;

    // Tier 1: Check by loanId — already has an entry?
    const byLoanId = await this.findDisbursementByLoanId(tenantId, loanId);
    if (byLoanId) {
      result.operationsPerformed.push('SKIP_EXISTS_BY_LOANID');
      return;
    }

    // Tier 2: Check for an orphan entry (loan_id IS NULL) with exact amount + date.
    // If found and unambiguous → claim it by assigning this loan's loanId (avoid duplicate).
    const orphan = await this.findOrphanDisbursement(tenantId, Number(newData.principalAmount), newData.loanDate);
    if (orphan) {
      await db.update(cashTransactions)
        .set({ loanId })
        .where(eq(cashTransactions.id, orphan.id));
      result.operationsPerformed.push('CLAIMED_ORPHAN_ENTRY');
      result.cashTransactionsAffected += 1;
      return;
    }

    // Neither found → create fresh entry
    const groupName = await this.getGroupName(tenantId, newData.groupId);
    const narration = this.createDisbursementNarration(
      newData.accountNumber,
      newData.borrowerName,
      Number(newData.principalAmount),
      groupName,
      newData.loanType,
      newData.collateralDetails,
      newData.weight,
      newData.loanDate
    );

    await storage.createCashTransaction({
      tenantId,
      transactionDate: newData.loanDate,
      transactionType: 'cash_out',
      amount: Number(newData.principalAmount),
      category: 'loan_disbursement',
      narration,
      isSystemGenerated: true,
      loanId
    } as any);

    result.operationsPerformed.push('CREATED_DISBURSEMENT');
    result.cashTransactionsAffected += 1;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE — loan edit करणे
  // ─────────────────────────────────────────────────────────────────────────
  private async handleLoanUpdate(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { oldData, newData } = operation;
    if (!oldData || !newData) return;

    const statusChanged = oldData.status !== newData.status;

    if (newData.status !== 'closed') {
      await this.updateDisbursementTransaction(operation, result);
    }

    if (statusChanged) {
      await this.handleStatusChange(operation, result);
    }
  }

  private async updateDisbursementTransaction(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { loanId, tenantId, oldData, newData } = operation;

    // Tier 1: Find by loanId
    let entry: any = await this.findDisbursementByLoanId(tenantId, loanId);

    // Verify narration date matches (guards against corrupt loanId on new-format entries)
    if (entry && !this.verifyEntryBelongsToLoan(entry, oldData.loanDate)) {
      console.warn(`⚠️ SYNC UPDATE: loanId ${loanId} found entry but narration date mismatch → falling back to Tier 2`);
      entry = null;
    }

    // Tier 2: If not found by loanId, try orphan (loan_id IS NULL + old amount + old date)
    if (!entry) {
      const orphan = await this.findOrphanDisbursement(tenantId, Number(oldData.principalAmount), oldData.loanDate);
      if (orphan) {
        // Backfill loanId so future ops use Tier 1
        await db.update(cashTransactions)
          .set({ loanId })
          .where(eq(cashTransactions.id, orphan.id));
        entry = { ...orphan, loanId };
        result.operationsPerformed.push('BACKFILLED_LOANID');
      }
    }

    if (!entry) {
      // Entry not found — warn only, do not create (Rebuild handles missing entries)
      console.warn(`⚠️ SYNC UPDATE: No disbursement entry found for loanId ${loanId}. Run Rebuild to fix.`);
      result.operationsPerformed.push('NO_ENTRY_FOUND_FOR_UPDATE');
      return;
    }

    // Update amount and/or date — narration is NEVER changed
    const updateData: any = {};

    if (Math.abs(Number(oldData.principalAmount) - Number(newData.principalAmount)) > 0.001) {
      updateData.amount = Number(newData.principalAmount);
      result.operationsPerformed.push(`AMOUNT_${oldData.principalAmount}→${newData.principalAmount}`);
    }

    if (oldData.loanDate !== newData.loanDate) {
      updateData.transactionDate = newData.loanDate;
      result.operationsPerformed.push(`DATE_${oldData.loanDate}→${newData.loanDate}`);
    }

    if (Object.keys(updateData).length > 0) {
      await storage.updateCashTransaction(entry.id, tenantId, updateData);
      result.cashTransactionsAffected += 1;
      result.operationsPerformed.push('UPDATED_AMOUNT_DATE');
    }

    // Cleanup: delete true duplicates (same loanId, different entry id)
    // Only by loanId — never by narration — never touches other loans
    const duplicates = await db.select({ id: cashTransactions.id })
      .from(cashTransactions)
      .where(and(
        eq(cashTransactions.tenantId, tenantId),
        eq(cashTransactions.loanId, loanId),
        eq(cashTransactions.category, 'loan_disbursement'),
        sql`${cashTransactions.id} != ${entry.id}`
      ));

    for (const dup of duplicates) {
      await storage.deleteCashTransaction(dup.id, tenantId);
      result.cashTransactionsAffected += 1;
      result.operationsPerformed.push(`DELETED_DUPLICATE_${dup.id}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE — loan डिलीट करणे
  // ─────────────────────────────────────────────────────────────────────────
  private async handleLoanDeletion(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { tenantId, loanId, oldData } = operation;

    if (!oldData) return;

    // ── STEP 1: Delete disbursement (cash_out) entry ──────────────────────────
    // Tier 1: Delete all entries with this loanId (UUID — guaranteed to belong to this loan)
    const byLoanId = await db.select()
      .from(cashTransactions)
      .where(and(
        eq(cashTransactions.tenantId, tenantId),
        eq(cashTransactions.loanId, loanId),
        eq(cashTransactions.category, 'loan_disbursement')
      ));

    let disbursementDeleted = false;

    if (byLoanId.length > 0) {
      let deletedCount = 0;
      for (const entry of byLoanId) {
        // Narration date verification: if new-format narration date doesn't match loan date,
        // the loanId may have been corrupted → skip to avoid deleting the wrong loan's entry
        if (!this.verifyEntryBelongsToLoan(entry, oldData.loanDate)) {
          console.warn(`⚠️ DELETE: Entry ${entry.id} has loanId=${loanId} but narration date mismatch — skipping (corrupt loanId)`);
          continue;
        }
        await storage.deleteCashTransaction(entry.id, tenantId);
        result.cashTransactionsAffected += 1;
        deletedCount++;
      }
      if (deletedCount > 0) {
        result.operationsPerformed.push(`DELETED_BY_LOANID_COUNT_${deletedCount}`);
        disbursementDeleted = true;
      }
      // If all loanId entries failed narration verification → fall through to Tier 2
    }

    if (!disbursementDeleted) {
      // Tier 2: loanId not found — try orphan with exact amount + exact date
      // Safe: loan_id IS NULL condition ensures other loans' entries are never touched
      const orphan = await this.findOrphanDisbursement(tenantId, Number(oldData.principalAmount), oldData.loanDate);
      if (orphan) {
        await storage.deleteCashTransaction(orphan.id, tenantId);
        result.cashTransactionsAffected += 1;
        result.operationsPerformed.push('DELETED_ORPHAN_BY_AMOUNT_DATE');
        disbursementDeleted = true;
      }
    }

    if (!disbursementDeleted) {
      console.warn(`⚠️ SYNC DELETE: No disbursement entry found for loanId ${loanId}. Already deleted or run Rebuild.`);
      result.operationsPerformed.push('NOTHING_TO_DELETE');
    }

    // ── STEP 2: If loan was closed, also delete closure (loan_repayment) entry ──
    // Critical: When user closes a loan then directly deletes it (without reopening first),
    // the closure cash_in entry becomes an orphan if not cleaned up here.
    if (oldData.status === 'closed') {
      await this.deleteClosureEntriesOnLoanDelete(tenantId, loanId, oldData.accountNumber, result);
    }
  }

  private async deleteClosureEntriesOnLoanDelete(
    tenantId: string,
    loanId: string,
    accountNumber: string,
    result: SyncResult
  ): Promise<void> {
    // Tier 1: loanId-based (reliable — works if closure entry was created with loanId linked)
    const closureByLoanId = await db.select()
      .from(cashTransactions)
      .where(and(
        eq(cashTransactions.tenantId, tenantId),
        eq(cashTransactions.loanId, loanId),
        eq(cashTransactions.category, 'loan_repayment'),
        eq(cashTransactions.transactionType, 'cash_in')
      ));

    if (closureByLoanId.length > 0) {
      for (const entry of closureByLoanId) {
        await storage.deleteCashTransaction(entry.id, tenantId);
        result.cashTransactionsAffected += 1;
        result.operationsPerformed.push('DELETED_CLOSURE_BY_LOANID');
      }
      return;
    }

    // Tier 2: account number pattern match (fallback for old entries without loanId)
    const pattern = this.buildAccountPattern(accountNumber);
    const allTransactions = await storage.getCashTransactions(tenantId);
    const closureMatches = allTransactions.filter((ct: any) =>
      ct.category === 'loan_repayment' &&
      ct.transactionType === 'cash_in' &&
      ct.narration && pattern.test(ct.narration)
    );

    for (const entry of closureMatches) {
      await storage.deleteCashTransaction(entry.id, tenantId);
      result.cashTransactionsAffected += 1;
      result.operationsPerformed.push('DELETED_CLOSURE_BY_ACCOUNT_PATTERN');
    }

    if (closureMatches.length === 0) {
      console.warn(`⚠️ DELETE CLOSED LOAN: No closure entry found for account ${accountNumber}. May have already been cleaned up.`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLOSURE
  // ─────────────────────────────────────────────────────────────────────────
  private async handleLoanClosure(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { tenantId, loanId, newData } = operation;

    if (!newData) return;

    const existing = await this.findClosureTransaction(tenantId, newData.accountNumber, newData.totalAmount, newData.closureDate);
    if (existing) {
      result.operationsPerformed.push('SKIP_EXISTING_CLOSURE');
      return;
    }

    const groupName = await this.getGroupName(tenantId, newData.groupId);
    const narration = this.createClosureNarration(
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
      narration,
      isSystemGenerated: true,
      loanId: loanId || null
    } as any);

    result.operationsPerformed.push('CREATED_CLOSURE');
    result.cashTransactionsAffected += 1;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REOPEN
  // ─────────────────────────────────────────────────────────────────────────
  private async handleLoanReopen(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { tenantId, loanId, oldData } = operation;

    if (!oldData) return;

    // Try loanId-based closure entry first
    let closureEntries: any[] = [];
    if (loanId) {
      closureEntries = await db.select()
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.tenantId, tenantId),
          eq(cashTransactions.loanId, loanId),
          eq(cashTransactions.category, 'loan_repayment'),
          eq(cashTransactions.transactionType, 'cash_in')
        ));
    }

    // Fallback: narration-based for old entries without loanId
    if (closureEntries.length === 0) {
      closureEntries = await this.findClosureTransactions(tenantId, oldData.accountNumber, oldData.borrowerName);
    }

    for (const entry of closureEntries) {
      await storage.deleteCashTransaction(entry.id, tenantId);
      result.cashTransactionsAffected += 1;
      result.operationsPerformed.push('DELETED_CLOSURE_ENTRY');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATUS CHANGE
  // ─────────────────────────────────────────────────────────────────────────
  private async handleStatusChange(operation: LoanSyncOperation, result: SyncResult): Promise<void> {
    const { oldData, newData } = operation;
    if (oldData.status === 'active' && newData.status === 'closed') {
      await this.handleLoanClosure(operation, result);
    } else if (oldData.status === 'closed' && newData.status === 'active') {
      await this.handleLoanReopen(operation, result);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLOSURE HELPERS (narration-based — safe for closures, unique amounts)
  // ─────────────────────────────────────────────────────────────────────────
  private buildAccountPattern(accountNumber: string): RegExp {
    const escaped = accountNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('खाते क्र\\.[ ]?' + escaped + '([^0-9]|$)');
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

  private async findClosureTransactions(tenantId: string, accountNumber: string, _borrowerName: string): Promise<any[]> {
    const transactions = await storage.getCashTransactions(tenantId);
    const pattern = this.buildAccountPattern(accountNumber);
    // Only match by account number pattern — borrowerName fallback removed
    // because same borrowerName can exist in multiple groups → wrong delete risk
    return transactions.filter((ct: any) =>
      ct.category === 'loan_repayment' &&
      ct.narration &&
      pattern.test(ct.narration)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────
  private async getGroupName(tenantId: string, groupId?: string): Promise<string> {
    if (!groupId) return '';
    const grps = await storage.getGroups(tenantId);
    const g = grps.find((g: any) => g.id === groupId);
    return g?.name || '';
  }

  private createDisbursementNarration(
    accountNumber: string,
    borrowerName: string,
    amount: number,
    groupName?: string,
    loanType?: string,
    collateralDetails?: string,
    weight?: string | number,
    loanDate?: string
  ): string {
    return NarrationEngine.createLoanDisbursementNarration(
      accountNumber, borrowerName, amount, groupName, loanType, collateralDetails, weight, loanDate
    );
  }

  private createClosureNarration(accountNumber: string, borrowerName: string, amount: number, groupName?: string): string {
    return NarrationEngine.createLoanClosureNarration(accountNumber, borrowerName, amount, 0, groupName);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY & TRIGGER
// ─────────────────────────────────────────────────────────────────────────────
export function getRealTimeSyncEngine(): RealTimeSyncEngine {
  return RealTimeSyncEngine.getInstance();
}

export async function triggerLoanSync(operation: LoanSyncOperation): Promise<SyncResult> {
  return RealTimeSyncEngine.getInstance().syncLoanOperation(operation);
}

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP REPAIR + AUTO-BACKFILL
// Runs on every server start (index.ts line 138).
// ─────────────────────────────────────────────────────────────────────────────
export async function repairMissingCashEntries(): Promise<{
  closuresRepaired: number;
  disbursementsRepaired: number;
  backfillAssigned: number;
}> {
  let closuresRepaired = 0;
  let disbursementsRepaired = 0;
  let backfillAssigned = 0;

  try {
    // ── STEP A: Repair missing closure cash_in entries (existing logic) ──────
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

      // Check closure cash_in
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

      // Check disbursement cash_out for closed loans
      let existingDisbursement: any[] = [];
      try {
        existingDisbursement = await db.select({ id: cashTransactions.id })
          .from(cashTransactions)
          .where(and(
            eq(cashTransactions.tenantId, tenantId),
            eq(cashTransactions.loanId, closure.loanId),
            eq(cashTransactions.category, 'loan_disbursement')
          ));
      } catch { /* loan_id column may not exist on very old Railway DB */ }

      if (existingDisbursement.length === 0) {
        existingDisbursement = await db.select({ id: cashTransactions.id })
          .from(cashTransactions)
          .where(and(
            eq(cashTransactions.tenantId, tenantId),
            eq(cashTransactions.transactionType, 'cash_out'),
            eq(cashTransactions.category, 'loan_disbursement'),
            sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${accountNumber}%`}`,
            sql`ABS(${cashTransactions.amount} - ${Number(closure.principalAmount)}) < 0.01`
          ));
      }

      if (existingDisbursement.length === 0) {
        let groupName = '';
        if (closure.groupId) {
          const [grp] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, closure.groupId));
          groupName = grp?.name || '';
        }
        const narration = NarrationEngine.createLoanDisbursementNarration(
          accountNumber, closure.borrowerName, Number(closure.principalAmount), groupName
        );
        await storage.createCashTransaction({
          tenantId,
          transactionDate: closure.loanDate,
          transactionType: 'cash_out',
          amount: Number(closure.principalAmount),
          category: 'loan_disbursement',
          narration,
          isSystemGenerated: true,
          loanId: closure.loanId
        } as any);
        disbursementsRepaired++;
        console.log(`🔧 REPAIR: Created missing disbursement cash_out for account ${accountNumber} - ₹${closure.principalAmount}`);
      }
    }

    // ── STEP B: Auto-backfill loanId for old entries (loan_id IS NULL) ───────
    // For each orphan entry, find a loan with exact amount + exact date.
    // Assign loanId ONLY when exactly 1 loan matches — never guess with 2+.
    try {
      const orphanEntries = await db.select({
        id: cashTransactions.id,
        tenantId: cashTransactions.tenantId,
        amount: cashTransactions.amount,
        transactionDate: cashTransactions.transactionDate,
      })
        .from(cashTransactions)
        .where(and(
          eq(cashTransactions.category, 'loan_disbursement'),
          eq(cashTransactions.transactionType, 'cash_out'),
          isNull(cashTransactions.loanId)
        ));

      for (const entry of orphanEntries) {
        const matchingLoans = await db.select({ id: loans.id })
          .from(loans)
          .where(and(
            eq(loans.tenantId, entry.tenantId),
            eq(loans.loanDate, entry.transactionDate as string),
            sql`ABS(${loans.principalAmount} - ${Number(entry.amount)}) < 0.01`
          ));

        if (matchingLoans.length === 1) {
          await db.update(cashTransactions)
            .set({ loanId: matchingLoans[0].id })
            .where(eq(cashTransactions.id, entry.id));
          backfillAssigned++;
        }
        // 0 or 2+ matches → skip safely (Rebuild will fix if needed)
      }

      if (backfillAssigned > 0) {
        console.log(`✅ BACKFILL: ${backfillAssigned} orphan cashbook entries assigned loanId`);
      }
    } catch (backfillErr) {
      console.warn('⚠️ BACKFILL: Skipped (loan_id column may be unavailable):', backfillErr);
    }

    if (closuresRepaired > 0 || disbursementsRepaired > 0) {
      console.log(`🔧 CASH ENTRY REPAIR: ${closuresRepaired} closures, ${disbursementsRepaired} disbursements repaired`);
    } else if (backfillAssigned === 0) {
      console.log(`✅ CASH ENTRY CHECK: All loan cash entries are in sync`);
    }

  } catch (error) {
    console.error('❌ REPAIR ERROR:', error);
  }

  return { closuresRepaired, disbursementsRepaired, backfillAssigned };
}
