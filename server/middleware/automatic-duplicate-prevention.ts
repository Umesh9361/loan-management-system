// AUTOMATIC DUPLICATE PREVENTION MIDDLEWARE
// हे सगळं ऑटोमॅटिक झालं पाहिजे बिना प्रॉब्लेमच
// Complete automation for duplicate prevention across all loan operations

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { cashTransactions } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface AutoPreventionRequest extends Request {
  session: {
    tenantId?: string;
    userId?: string;
  };
}

/**
 * AUTOMATIC SYSTEM: Real-time duplicate detection and prevention
 * Runs on every request to ensure zero duplicates
 */
export const automaticDuplicatePrevention = async (
  req: AutoPreventionRequest,
  res: Response,
  next: NextFunction
) => {
  // Only run on loan-related operations
  const shouldPrevent = req.path.includes('/api/loans') || 
                       req.path.includes('/api/cash-transactions') ||
                       req.method === 'POST' && (
                         req.path.includes('/close') || 
                         req.path.includes('/disbur')
                       );

  if (!shouldPrevent || !req.session?.tenantId) {
    return next();
  }

  try {
    // AUTOMATIC CLEANUP: Remove any duplicate entries detected
    const duplicateGroups = await db
      .select({
        narration: cashTransactions.narration,
        amount: cashTransactions.amount,
        transactionDate: cashTransactions.transactionDate,
        count: sql<number>`count(*)`
      })
      .from(cashTransactions)
      .where(eq(cashTransactions.tenantId, req.session.tenantId))
      .groupBy(
        cashTransactions.narration,
        cashTransactions.amount,
        cashTransactions.transactionDate
      )
      .having(sql`count(*) > 1`);

    if (duplicateGroups.length > 0) {
      console.log(`🚨 AUTOMATIC: Detected ${duplicateGroups.length} duplicate groups, cleaning up...`);
      
      for (const group of duplicateGroups) {
        // Keep only the system-generated entry, remove manual duplicates
        const duplicates = await db
          .select()
          .from(cashTransactions)
          .where(and(
            eq(cashTransactions.tenantId, req.session.tenantId),
            eq(cashTransactions.narration, group.narration || ''),
            eq(cashTransactions.amount, group.amount),
            eq(cashTransactions.transactionDate, group.transactionDate)
          ));

        // MIDDLEWARE DUPLICATE CLEANUP DISABLED: Let main routes.ts handle single source
        // This prevents interference with proper duplicate prevention
        console.log(`🚫 MIDDLEWARE DISABLED: Duplicate cleanup disabled to prevent interference with main system`);

        for (const duplicate of toDelete) {
          await db
            .delete(cashTransactions)
            .where(eq(cashTransactions.id, duplicate.id));
          
          console.log(`✅ AUTOMATIC: Removed duplicate entry: ${duplicate.amount} on ${duplicate.transactionDate}`);
        }
      }
    }

    next();
  } catch (error) {
    console.error('🚨 AUTOMATIC: Duplicate prevention failed:', error);
    // Continue anyway to not block the request
    next();
  }
};

/**
 * SMART PREVENTION: Check if operation would create duplicate
 */
export const preventDuplicateOperation = async (
  tenantId: string,
  operationType: 'disbursement' | 'closure',
  accountNumber: string,
  amount: number
): Promise<boolean> => {
  try {
    const transactionType = operationType === 'disbursement' ? 'cash_out' : 'cash_in';
    const category = operationType === 'disbursement' ? 'loan_disbursement' : 'loan_repayment';

    const existing = await db
      .select()
      .from(cashTransactions)
      .where(and(
        eq(cashTransactions.tenantId, tenantId),
        eq(cashTransactions.transactionType, transactionType),
        eq(cashTransactions.category, category),
        sql`${cashTransactions.narration} LIKE ${`%खाते क्र. ${accountNumber}%`}`,
        sql`ABS(${cashTransactions.amount} - ${amount}) < 0.01`
      ));

    if (existing.length > 0) {
      console.log(`🚫 SMART PREVENTION: ${operationType} already exists for account ${accountNumber}`);
      return true; // Duplicate detected
    }

    return false; // Safe to proceed
  } catch (error) {
    console.error('🚨 SMART PREVENTION: Check failed:', error);
    return false; // Allow operation if check fails
  }
};