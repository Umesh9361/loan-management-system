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
