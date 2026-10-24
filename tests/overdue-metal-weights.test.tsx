import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { overdueMetalWeightTotals } from '../shared/overdue-weights';
import { formatWeight } from '../shared/report-weights';
import { OverdueWeightSummary } from '../client/src/components/reports/overdue-weight-summary';
import { readFileSync } from 'node:fs';

const rows = [
  { loanId: 'g1', goldWeight: 4.900, metalType: 'gold', purityUsed: 82, group: 'A', loss: true },
  { loanId: 'g2', goldWeight: 3.631, metalType: 'gold', purityUsed: 99.5, group: 'B', loss: false },
  { loanId: 's1', goldWeight: 2.222, metalType: 'silver', purityUsed: 60, group: 'A', loss: true },
];

test('legacy goldWeight is classified by metal, with full-precision gross and separate fine totals', () => {
  const original = JSON.stringify(rows);
  const totals = overdueMetalWeightTotals(rows);
  assert.equal(totals.gold.gross, 8.531);
  assert.equal(totals.silver.gross, 2.222);
  assert.equal(formatWeight(totals.gold.gross), '8.53');
  assert.equal(formatWeight(totals.silver.gross), '2.22');
  assert.ok(Math.abs(totals.gold.fine - (4.9 * .82 + 3.631 * .995)) < 1e-12);
  assert.ok(Math.abs(totals.silver.fine - 2.222 * .6) < 1e-12);
  assert.equal(JSON.stringify(rows), original);
});

test('only-gold, only-silver and empty results show zero for the absent metal', () => {
  assert.deepEqual(overdueMetalWeightTotals([]), {
    gold: { gross: 0, fine: 0 }, silver: { gross: 0, fine: 0 },
  });
  assert.equal(overdueMetalWeightTotals(rows.slice(0, 2)).silver.gross, 0);
  assert.equal(overdueMetalWeightTotals(rows.slice(2)).gold.gross, 0);
  const html = renderToStaticMarkup(<OverdueWeightSummary totals={overdueMetalWeightTotals([])} kind="gross" />);
  assert.match(html, /सोने वजन: 0\.00 ग्रॅम/);
  assert.match(html, /चांदी वजन: 0\.00 ग्रॅम/);
});

test('duplicates, both unsecured metals and tenant identity preserve eligible totals', () => {
  const extras = rows.map(row => ({ ...row, loanId: 'u-' + row.loanId, loanType: 'विनातारण' }));
  assert.deepEqual(overdueMetalWeightTotals([...rows, ...rows, ...extras]), overdueMetalWeightTotals(rows));
  assert.equal(overdueMetalWeightTotals([
    { ...rows[0], tenantId: 'A' }, { ...rows[0], tenantId: 'B' },
  ]).gold.gross, 9.8);
  assert.equal(overdueMetalWeightTotals([{ ...rows[0], metalType: undefined }]).gold.gross, 4.9);
});

test('selected subsets and fractional rows are summed before rounding', () => {
  const selected = rows.filter(row => row.group === 'A' && row.loss);
  const totals = overdueMetalWeightTotals(selected);
  assert.equal(totals.gold.gross, 4.9);
  assert.equal(totals.silver.gross, 2.222);
  const fractional = rows.slice(0, 2).map(row => ({ ...row, goldWeight: 1.2349 }));
  assert.equal(overdueMetalWeightTotals(fractional).gold.gross, 2.4698);
  assert.equal(formatWeight(overdueMetalWeightTotals(fractional).gold.gross), '2.47');
});

test('shared screen/print markup uses separate labelled lines, never the combined gold total', () => {
  const totals = overdueMetalWeightTotals(rows);
  const gross = renderToStaticMarkup(<OverdueWeightSummary totals={totals} kind="gross" />);
  const fine = renderToStaticMarkup(<OverdueWeightSummary totals={totals} kind="fine" />);
  assert.match(gross, /सोने वजन: 8\.53 ग्रॅम/);
  assert.match(gross, /चांदी वजन: 2\.22 ग्रॅम/);
  assert.doesNotMatch(gross, /10\.75/);
  assert.match(fine, new RegExp(`शुद्ध सोने: ${formatWeight(totals.gold.fine)} ग्रॅम`));
  assert.match(fine, /शुद्ध चांदी: 1\.33 ग्रॅम/);
  assert.match(gross, /white-space:normal/);
  const page = readFileSync('client/src/pages/reports/overdue.tsx', 'utf8');
  assert.match(page, /overdueMetalWeightTotals\(securedLoans\)/);
  assert.equal((page.match(/<OverdueWeightSummary totals=\{metalWeightTotals\} kind="gross"/g) || []).length, 2);
  assert.equal((page.match(/<OverdueWeightSummary totals=\{metalWeightTotals\} kind="fine"/g) || []).length, 2);
  assert.doesNotMatch(page, /securedTotalGoldWeight|securedTotalPureGold/);
});
