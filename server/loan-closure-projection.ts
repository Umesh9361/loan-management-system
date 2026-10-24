import { sql } from "drizzle-orm";
import { loans, loanClosures } from "@shared/schema";

// A scalar aggregate preserves one row per loan, including loans with no closure.
// Joining the history table directly multiplies every amount/weight by its row count.
export const latestLoanClosureDate = sql<string | null>`(
  SELECT MAX(${loanClosures.closureDate})
  FROM ${loanClosures}
  WHERE ${loanClosures.loanId} = ${loans.id}
    AND ${loanClosures.tenantId} = ${loans.tenantId}
)`;
