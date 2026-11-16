import { and, eq, sql } from "drizzle-orm";
import { cashTransactions, loans } from "@shared/schema";

// Keep every cash row, including legacy null/invalid loan IDs. Casting the UUID
// side to text avoids failing the whole report on a malformed historical link.
// A loan from another tenant must never supply metadata for this transaction.
export const cashbookLoanLink = and(
  eq(cashTransactions.loanId, sql`${loans.id}::text`),
  eq(cashTransactions.tenantId, loans.tenantId),
);
