import React from 'react';
import { formatWeight } from '@shared/report-weights';
import type { OverdueMetalWeightTotals } from '@shared/overdue-weights';

/** Shared screen and print labels prevent one metal being mistaken for another. */
export function OverdueWeightSummary({ totals, kind }: {
  totals: OverdueMetalWeightTotals;
  kind: 'gross' | 'fine';
}) {
  return (
    <div style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.6 }}>
      <div>{kind === 'fine' ? 'शुद्ध सोने' : 'सोने वजन'}: {formatWeight(totals.gold[kind])} ग्रॅम</div>
      <div>{kind === 'fine' ? 'शुद्ध चांदी' : 'चांदी वजन'}: {formatWeight(totals.silver[kind])} ग्रॅम</div>
    </div>
  );
}

/** Units are stated once, after the report rows rather than repeated in each cell. */
export function OverdueMetalTotals({ totals }: { totals: OverdueMetalWeightTotals }) {
  const values: Array<[string, number]> = [
    ["सोने वजन", totals.gold.gross], ["चांदी वजन", totals.silver.gross],
    ["शुद्ध सोने", totals.gold.fine], ["शुद्ध चांदी", totals.silver.fine],
  ];
  return <section className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
    <h3 className="mb-2 text-sm font-semibold text-indigo-900">एकूण धातू वजन (ग्रॅम)</h3>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {values.map(([label, value]) => <div key={label}>
        <div className="text-xs text-gray-600">{label}</div>
        <strong className="text-sm text-indigo-900">{formatWeight(value)}</strong>
      </div>)}
    </div>
  </section>;
}
