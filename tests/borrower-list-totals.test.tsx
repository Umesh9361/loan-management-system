import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { borrowerScreenTotals, borrowerTotalsState, borrowerReportArray } from '../shared/borrower-list-totals';
import { BorrowerListTotals } from '../client/src/components/reports/borrower-list-totals';
import { formatWeight } from '../shared/report-weights';

const tabs = ['date-wise', 'closing-wise', 'name-wise', 'maturity-wise'] as const;
const loans = Array.from({ length: 100 }, (_, index) => ({
  id: `loan-${index}`, tenantId: 'fixture', accountNumber: '1',
  principalAmount: '1000.4', weight: index === 99 ? '3.631' : '4.900',
  loanType: 'तारण', metalType: 'gold', purity: index % 2 ? '99.5' : '82',
}));

test('every borrower tab uses the same accurate full-filter totals, not current page', () => {
  for (const tab of tabs) {
    const total = borrowerScreenTotals(loans, tab, [])!;
    assert.equal(total.count, 100);
    assert.equal(total.totalAmount, 100000);
    assert.equal(total.goldWeight, 488.731);
    assert.equal(formatWeight(total.totalWeight), '488.73');
    assert.equal(total.totalInterest, tab === 'closing-wise' ? 0 : null);
    for (const pageSize of [1, 20, 50]) {
      assert.equal(loans.slice(0, pageSize).length, pageSize);
      assert.deepEqual(borrowerScreenTotals(loans, tab, []), total);
    }
  }
});

test('different filter subsets update amount/count/weight; empty never retains previous totals', () => {
  const selected = loans.filter((_, i) => i % 2 === 0);
  const total = borrowerScreenTotals(selected, 'name-wise', [])!;
  assert.equal(total.count, 50);
  assert.equal(total.totalAmount, 50000);
  assert.equal(total.totalWeight, 245);
  for (const tab of tabs) assert.equal(borrowerScreenTotals([], tab, []), null);
});

test('duplicate joins deduplicate all measures by tenant/loan, not account number', () => {
  assert.deepEqual(borrowerScreenTotals(loans.concat(loans), 'date-wise', []), borrowerScreenTotals(loans, 'date-wise', []));
  assert.equal(borrowerScreenTotals([{ ...loans[0], tenantId: 'a' }, { ...loans[0], tenantId: 'b' }], 'date-wise', [])!.count, 2);
});

test('secured gold and silver remain separate; unsecured stray weights are excluded', () => {
  const selected = [
    { ...loans[0], id: 'gold', weight: '1.2349' },
    { ...loans[0], id: 'silver', metalType: 'silver', weight: '1.2349' },
    { ...loans[0], id: 'unsecured-gold', loanType: 'विनातारण', weight: '999' },
    { ...loans[0], id: 'unsecured-silver', loanType: 'विनातारण', metalType: 'silver', weight: '999' },
  ];
  const result = borrowerScreenTotals(selected, 'date-wise', [])!;
  assert.equal(result.count, 4);
  assert.equal(result.totalAmount, 4000);
  assert.equal(result.goldWeight, 1.2349);
  assert.equal(result.silverWeight, 1.2349);
  assert.equal(result.totalWeight, 2.4698);
  assert.equal(formatWeight(result.totalWeight), '2.47'); // not 1.23 + 1.23
});

test('closing interest preserves actual zero/manual values and existing first-closure/per-row rounding policy', () => {
  const events = [
    { loanId: 'loan-0', interestPaid: '0', calculatedInterest: '999' },
    { loanId: 'loan-1', interestPaid: '45.6', calculatedInterest: '999' },
    { loanId: 'loan-1', interestPaid: '9000' },
    { loanId: 'loan-2', interestPaid: null },
  ];
  assert.equal(borrowerScreenTotals(loans, 'closing-wise', events)!.totalInterest, 46);
  assert.equal(borrowerScreenTotals(loans, 'name-wise', events)!.totalInterest, null);
});

test('malformed weights/amounts and non-array payloads fail explicitly, not NaN/partial sums', () => {
  assert.throws(() => borrowerScreenTotals([{ ...loans[0], weight: '4 G450' }], 'date-wise', []));
  for (const principalAmount of ['bad', '', null, undefined, Infinity]) {
    assert.throws(() => borrowerScreenTotals([{ ...loans[0], principalAmount }], 'date-wise', []), /मुद्दल/);
  }
  assert.throws(() => borrowerScreenTotals(loans, 'closing-wise', [{ loanId: 'loan-0', interestPaid: 'bad' }]), /व्याज/);
  assert.throws(() => borrowerReportArray(null as any), /अपूर्ण/);
});

test('query state blocks cached totals during initial fetch, refetch or any required error', () => {
  const ready = { isSuccess: true, isFetching: false, isError: false };
  assert.equal(borrowerTotalsState([ready, ready]), 'ready');
  assert.equal(borrowerTotalsState([ready, { ...ready, isFetching: true }]), 'loading');
  assert.equal(borrowerTotalsState([{ ...ready, isSuccess: false }]), 'loading');
  assert.equal(borrowerTotalsState([ready, { ...ready, isError: true }]), 'error');
});

test('actual responsive component displays scope, two-decimal weights and closing interest including zero', () => {
  for (const tab of tabs) {
    const html = renderToStaticMarkup(<BorrowerListTotals status="ready" totals={borrowerScreenTotals(loans, tab, [])} />);
    assert.match(html, /सर्व शोध निकालांची एकूण/);
    assert.match(html, /सध्याच्या पानापुरती नाही/);
    assert.match(html, /₹1,00,000/);
    assert.match(html, /488\.73 ग्रॅम/);
    assert.match(html, /<dt>सोने<\/dt>/);
    assert.match(html, /<dt>चांदी<\/dt>/);
    assert.equal(html.includes('<dt>एकूण व्याज</dt>'), tab === 'closing-wise');
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
});

test('actual component hides stale numeric values for loading/error and empty results', () => {
  const totals = borrowerScreenTotals(loans, 'date-wise', []);
  for (const status of ['loading', 'error'] as const) {
    const html = renderToStaticMarkup(<BorrowerListTotals status={status} totals={totals} errorMessage="माहिती मिळाली नाही" />);
    assert.doesNotMatch(html, /488\.73|₹1,00,000|<dl/);
    assert.match(html, status === 'loading' ? /aria-live="polite"/ : /role="alert"/);
  }
  assert.equal(renderToStaticMarkup(<BorrowerListTotals status="ready" totals={null} />), '');
});

test('page wiring uses full filtered data, a single summary outside horizontal scrolling and safe bottom clearance', () => {
  const source = readFileSync('client/src/pages/reports/borrower-list.tsx', 'utf8');
  assert.match(source, /borrowerScreenTotals\(getFilteredLoans, activeTab, loanClosures\)/);
  assert.doesNotMatch(source, /borrowerScreenTotals\(getPaginatedData/);
  assert.equal((source.match(/<BorrowerListTotals /g) || []).length, 1);
  assert.doesNotMatch(source, /closingWiseScreenTotals/);
  assert(source.lastIndexOf('<BorrowerListTotals') > source.lastIndexOf('</table>'));
  assert.match(source, /env\(safe-area-inset-bottom,0px\)/);
  assert.match(source, /activeTab === 'closing-wise' \? \[closuresQuery\] : \[\]/);
  assert.match(source, /screenSummary.status === 'ready' \? \(/);
  const component = readFileSync('client/src/components/reports/borrower-list-totals.tsx', 'utf8');
  assert.match(component, /minmax\(0, 1fr\)/);
  assert.match(component, /overflow-wrap: anywhere/);
  assert.doesNotMatch(component, /position:\s*(fixed|sticky)/);
});
