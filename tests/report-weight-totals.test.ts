import assert from 'node:assert/strict';
import test from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { latestLoanClosureDate } from '../server/loan-closure-projection';
import {
  weightGrams, sumWeightGrams, formatWeight, uniqueLoansById,
  loanWeightTotals, uniqueBorrowerNames, checkedReportLoans, WeightFormatError,
} from '../shared/report-weights';

const entries = Array.from({ length: 100 }, (_, index) => ({
  id: `loan-${index}`, tenantId: 'fixture', groupId: `group-${index % 4}`,
  accountNumber: '1', // Account number is not a unique loan identity across groups/FYs.
  borrowerName: index % 2 ? ' Customer A ' : 'customer a',
  weight: index === 99 ? '3.631' : '4.900',
  loanType: 'तारण', metalType: 'gold', purity: index % 2 ? '82' : '99.50',
}));

test('100 loans: reference 488.731 is not 4887.31, irrespective of purity', () => {
  const totals = loanWeightTotals(entries);
  assert.equal(totals.goldWeight, 488.731);
  assert.equal(totals.totalWeight, 488.731);
  assert.equal(formatWeight(totals.goldWeight), '488.73');
  assert.equal(loanWeightTotals(entries.map(l => ({ ...l, purity: '10' }))).goldWeight, 488.731);
});

test('ten closure join rows reproduce the reported tenfold total, but count each ID once', () => {
  const joined = entries.flatMap(loan => Array.from({ length: 10 }, () => ({ ...loan })));
  assert.equal(sumWeightGrams(joined.map(l => l.weight)), 4887.31);
  assert.equal(uniqueLoansById(joined).length, 100);
  assert.equal(loanWeightTotals(joined).goldWeight, 488.731);
});

test('group grand total equals full-list total; pagination does not change the source', () => {
  const rows = Array.from({ length: 4 }, (_, i) =>
    loanWeightTotals(entries.filter(l => l.groupId === `group-${i}`)));
  assert.equal(sumWeightGrams(rows.map(row => row.goldWeight)), 488.731);
  for (const pageSize of [1, 20, 50, 100]) {
    assert.equal(entries.slice(0, pageSize).length, pageSize);
    assert.equal(loanWeightTotals(entries).goldWeight, 488.731);
  }
});

test('customer case/outer-space variants form one summary, not repeated totals', () => {
  const names = uniqueBorrowerNames(entries);
  assert.equal(names.length, 1);
  const rows = names.map(name => loanWeightTotals(entries.filter(loan =>
    loan.borrowerName.trim().toLowerCase() === name.trim().toLowerCase())));
  assert.equal(sumWeightGrams(rows.map(row => row.goldWeight)), 488.731);
  assert.deepEqual(uniqueBorrowerNames([{ borrowerName: '  ' }, {}, { borrowerName: 'नाव' }]), ['नाव']);
});

test('gold, silver and unsecured retain their existing classifications', () => {
  const loans = [
    { id: 'a', weight: '1.111', metalType: 'gold', loanType: 'तारण' },
    { id: 'b', weight: '2.222', metalType: 'silver', loanType: 'तारण' },
    { id: 'c', weight: '3.333', metalType: 'gold', loanType: 'विनातारण' },
    { id: 'd', weight: '4.444', loanType: 'तारण' },
  ];
  assert.deepEqual(loanWeightTotals(loans), { totalWeight: 11.11, goldWeight: 5.555, silverWeight: 2.222 });
});

test('filter first: date/status subsets and repeated payloads have identical scoped totals', () => {
  const loans = entries.map((l, i) => ({ ...l, status: i < 50 ? 'active' : 'closed',
    loanDate: i < 50 ? '2026-04-01' : '2025-03-31' }));
  for (const status of ['active', 'closed']) {
    const selected = loans.filter(l => l.status === status);
    assert.deepEqual(loanWeightTotals(selected.concat(selected)), loanWeightTotals(selected));
  }
  const currentFY = loans.filter(l => l.loanDate >= '2026-04-01');
  assert.equal(loanWeightTotals(currentFY).goldWeight, 245);
});

test('grams text, thousands separators, nulls and three decimals retain the decimal point', () => {
  for (const value of [488.731, '488.731', '488.731 ग्रॅम', ' 488.731 g ']) {
    assert.equal(weightGrams(value), 488.731);
  }
  assert.equal(weightGrams('1,234.567'), 1234.567);
  assert.equal(weightGrams('25 '), 25);
  assert.equal(weightGrams(null), 0);
  assert.equal(weightGrams(''), 0);
  assert.equal(weightGrams('—'), 0);
  assert.equal(sumWeightGrams(Array(1000).fill('0.001')), 1);
  assert.equal(sumWeightGrams(['0.0004', '0.0004', '0.0004']), 0.0012);
  assert.equal(formatWeight(0), '0.00');
});

test('only display is rounded to TWO decimals; totals never sum rounded row labels', () => {
  const raw = ['1.2349', '1.2349'];
  assert.equal(sumWeightGrams(raw), 2.4698);
  assert.equal(formatWeight(sumWeightGrams(raw)), '2.47');
  assert.equal(sumWeightGrams(raw.map(value => formatWeight(weightGrams(value)))), 2.46);
  assert.equal(formatWeight(488.735), '488.74');
  assert.equal(formatWeight(1.005), '1.01');
  assert.equal(formatWeight(10.075), '10.08');
  assert.equal(formatWeight(4.5), '4.50');
});

test('numeric text is NOT stripped and joined into an inflated contribution', () => {
  for (const text of ['4 G450', '4 ग्रॅम 450', '4,450', '4.4.50', '1 234', '-4', 'abc', '4kg']) {
    assert.throws(() => weightGrams(text), WeightFormatError, text);
  }
  assert.equal(weightGrams('4.450 g'), 4.45);
  assert.equal(weightGrams('G 4.450'), 4.45);
  assert.equal(weightGrams('४.४५० ग्रॅम'), 4.45);
  assert.equal(weightGrams('1,23,456.789'), 123456.789);
  assert.throws(() => weightGrams(Number.NaN), WeightFormatError);
  assert.throws(() => weightGrams(Infinity), WeightFormatError);
});

test('an ambiguous record blocks the report explicitly and identifies the account', () => {
  const data = [{ id: 'bad', accountNumber: '145', weight: '4 G450' }];
  assert.throws(() => checkedReportLoans(data), /खाते 145/);
  assert.throws(() => loanWeightTotals(data), WeightFormatError);
  assert.deepEqual(checkedReportLoans(entries.concat(entries)), entries);
});

test('identity includes tenant and never deduplicates different loans by account number', () => {
  assert.equal(uniqueLoansById(entries).length, 100);
  assert.equal(uniqueLoansById([
    { id: '1', tenantId: 'a' }, { id: '1', tenantId: 'b' },
    { weight: '1' }, { weight: '1' },
  ]).length, 4);
});

test('closure projection is scalar, tenant-scoped and latest-date based', () => {
  const { sql } = new PgDialect().sqlToQuery(latestLoanClosureDate);
  assert.match(sql, /MAX\("loan_closures"\."closure_date"\)/);
  assert.match(sql, /"loan_closures"\."loan_id" = "loans"\."id"/);
  assert.match(sql, /"loan_closures"\."tenant_id" = "loans"\."tenant_id"/);
  assert.doesNotMatch(sql, /JOIN/);
});
