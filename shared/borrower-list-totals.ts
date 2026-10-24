import { loanWeightTotals, sumWeightGrams, uniqueLoansById } from './report-weights';
import type { WeightedLoan } from './report-weights';

export type BorrowerListTab = 'date-wise' | 'closing-wise' | 'name-wise' | 'maturity-wise';
interface TotalsLoan extends WeightedLoan { principalAmount?: unknown }
interface TotalsClosure { loanId: string | number; interestPaid?: unknown }
export interface BorrowerScreenTotals {
  count: number; totalAmount: number; goldWeight: number; silverWeight: number;
  totalWeight: number; totalInterest: number | null;
}
export function borrowerTotalsState(queries: { isSuccess: boolean; isFetching: boolean; isError: boolean }[]) {
  if (queries.some(query => query.isError)) return 'error';
  if (queries.some(query => !query.isSuccess || query.isFetching)) return 'loading';
  return 'ready';
}
export function borrowerReportArray<T>(data: T[]): T[] {
  if (!Array.isArray(data)) throw new Error('रिपोर्टची माहिती अपूर्ण किंवा अवैध आहे.');
  return data;
}
function roundedScreenAmount(value: unknown, label: string) {
  if (value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(Number(value))) {
    throw new Error(`${label} अवैध आहे; अचूक टोटलसाठी नोंद तपासा.`);
  }
  // Preserve the existing on-screen/print convention: each loan is shown in whole rupees.
  return Math.round(Number(value));
}
/** Receive the ENTIRE filtered list, never a pagination slice. No source mutation. */
export function borrowerScreenTotals(loans: TotalsLoan[], tab: BorrowerListTab, closures: TotalsClosure[]): BorrowerScreenTotals | null {
  const entries = uniqueLoansById(borrowerReportArray(loans));
  if (!entries.length) return null;
  const collateral = entries.filter(loan => loan.loanType !== 'विनातारण');
  const weights = loanWeightTotals(collateral);
  let totalAmount = 0;
  let totalInterest: number | null = tab === 'closing-wise' ? 0 : null;
  for (const loan of entries) {
    totalAmount += roundedScreenAmount(loan.principalAmount, `खाते ${loan.id ?? '—'}: मुद्दल`);
    if (tab === 'closing-wise') {
      // Match existing rows and exports: first matching closure, actual interestPaid only.
      const closure = closures.find(closure => closure.loanId === loan.id);
      if (closure?.interestPaid) {
        totalInterest! += roundedScreenAmount(closure.interestPaid, `खाते ${loan.id ?? '—'}: मिळालेले व्याज`);
      }
    }
  }
  if (!Number.isFinite(totalAmount) || (totalInterest !== null && !Number.isFinite(totalInterest))) {
    throw new Error('टोटल रक्कम अवैध आहे; नोंदी तपासा.');
  }
  return {
    count: entries.length, totalAmount, totalInterest,
    goldWeight: weights.goldWeight, silverWeight: weights.silverWeight,
    totalWeight: sumWeightGrams([weights.goldWeight, weights.silverWeight]),
  };
}
