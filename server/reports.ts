import { db } from "./db";
import { loans, borrowers, groups, transactions } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

// Helper function to safely get borrower info
export async function getLoanWithBorrowerInfo(loanId: string, tenantId: string) {
  const [loan] = await db
    .select({
      loan: loans,
      borrower: borrowers,
      group: groups,
    })
    .from(loans)
    .leftJoin(borrowers, eq(loans.borrowerId, borrowers.id))
    .innerJoin(groups, eq(loans.groupId, groups.id))
    .where(and(eq(loans.id, loanId), eq(loans.tenantId, tenantId)));

  if (!loan) return null;

  // Return loan with guaranteed borrower info (from loan fields if no borrower record)
  return {
    ...loan.loan,
    borrowerInfo: {
      id: loan.borrower?.id || null,
      name: loan.borrower?.name || loan.loan.borrowerName,
      mobile: loan.borrower?.mobile || loan.loan.borrowerMobile || "",
      address: loan.borrower?.address || loan.loan.borrowerAddress || "",
    },
    group: loan.group,
  };
}

// Function to link orphaned loans to borrowers
export async function linkOrphanedLoans(tenantId: string) {
  // Find loans without borrowerId but with borrower name
  const orphanedLoans = await db
    .select()
    .from(loans)
    .where(
      and(
        eq(loans.tenantId, tenantId),
        sql`${loans.borrowerId} IS NULL`,
        sql`${loans.borrowerName} IS NOT NULL`
      )
    );

  for (const loan of orphanedLoans) {
    // Try to find existing borrower with same name and group
    const [existingBorrower] = await db
      .select()
      .from(borrowers)
      .where(
        and(
          eq(borrowers.tenantId, tenantId),
          eq(borrowers.groupId, loan.groupId),
          eq(borrowers.name, loan.borrowerName)
        )
      );

    if (existingBorrower) {
      // Link the loan to existing borrower
      await db
        .update(loans)
        .set({ borrowerId: existingBorrower.id })
        .where(eq(loans.id, loan.id));
    }
  }
}

// Function to get borrower transaction summary
export async function getBorrowerTransactionSummary(borrowerName: string, tenantId: string) {
  // Get all loans for this borrower (by name, handling multiple borrowers with same name)
  const borrowerLoans = await db
    .select({
      loanId: loans.id,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      status: loans.status,
    })
    .from(loans)
    .where(
      and(
        eq(loans.tenantId, tenantId),
        eq(loans.borrowerName, borrowerName)
      )
    );

  // Get all transactions for these loans
  const loanIds = borrowerLoans.map(l => l.loanId);
  
  if (loanIds.length === 0) {
    return {
      totalLoans: 0,
      activeLoans: 0,
      totalPrincipal: 0,
      totalTransactions: 0,
    };
  }

  const transactionSummary = await db
    .select({
      totalAmount: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      transactionCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.tenantId, tenantId),
        sql`${transactions.loanId} = ANY(${loanIds})`
      )
    );

  return {
    totalLoans: borrowerLoans.length,
    activeLoans: borrowerLoans.filter(l => l.status === 'active').length,
    totalPrincipal: borrowerLoans.reduce((sum, l) => sum + Number(l.principalAmount), 0),
    totalTransactions: Number(transactionSummary[0]?.totalAmount || 0),
    transactionCount: Number(transactionSummary[0]?.transactionCount || 0),
  };
}