import { sumWeightGrams, uniqueLoansById, weightGrams } from './report-weights';

interface OverdueWeightItem {
  loanId: string;
  tenantId?: string;
  goldWeight: number;
  purityUsed?: number;
  metalType?: string;
  loanType?: string;
}

/** goldWeight is a legacy API field containing either metal's gross grams. */
export function overdueMetalWeightTotals(items: OverdueWeightItem[]) {
  const entries = uniqueLoansById(items.map(item => ({ ...item, id: item.loanId })))
    .filter(item => item.loanType !== 'विनातारण');
  const sumMetal = (silver: boolean) => {
    const loans = entries.filter(item => (item.metalType === 'silver') === silver);
    return {
      gross: sumWeightGrams(loans.map(item => item.goldWeight)),
      // Same per-loan purity formula as before; do not round individual weights.
      fine: sumWeightGrams(loans.map(item =>
        weightGrams(item.goldWeight) * ((Number(item.purityUsed) || 0) / 100))),
    };
  };
  return { gold: sumMetal(false), silver: sumMetal(true) };
}

export type OverdueMetalWeightTotals = ReturnType<typeof overdueMetalWeightTotals>;
