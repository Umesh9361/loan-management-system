import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { loanClosures, loans } from '../shared/schema';
import {
  defaultFilters, fixtureClosures, fixtureLoan, fixtureLoans, overdueHarness,
} from './helpers/overdue-storage-harness';

// Captured from the unmodified storage methods with the same synthetic inputs
// and fixed clock. Hash the entire serialized output, not just selected totals.
const referenceHashes = [
  '0bb8f72f5415e4f6791ea8023221129ba62e9e676e7ed4fd856d592af439083b',
  '1772275e9996ce1d86aa1d7cf3b7ade41218ace4ebcd3f3daf5cf41425e6d211',
  '6aeb8df00757bbedd8a0727e44c26ed013b55a99dfe2f6aee4ca581590852d78',
  '06b0ddc2eaca2632777524c4634bea04a16fbfa2dbc21dddd290d99d2376800c',
  '87e6a2f57141e22f4ec3a3b87a1297f092963e162eed1d3ba58c7eec7c4b09fe',
  'ccd6c20904f961dd9451e0a37c59c7c1228c43d9c2df66240f1d6d4a7729ed9b',
  'b943c9fe98ca80c10b8ac5506c393050028b8efaa2dd4d6db3907513a8d7b64e',
  'dd47ea54e782edfce3bfbd89dd2cf17e05f680fefb964d69887ac9f7076980b4',
];
let reference = 0;
for (const projectionMode of ['current', 'future']) {
  for (const interestRateMode of ['manual', 'loan-wise']) {
    for (const purityMode of ['manual', 'loan-wise']) {
      const expectedHash = referenceHashes[reference++];
      test(`unchanged full report: ${projectionMode}, ${interestRateMode} rate, ${purityMode} purity`, async () => {
        const h = overdueHarness(fixtureLoans, fixtureClosures);
        const rows = await h.storage.getOverdueReportWithCorrectMath('tenant-A', {
          ...defaultFilters, projectionMode, interestRateMode, purityMode,
        });
        assert.equal(rows.length, 6);
        assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'), expectedHash);
        assert.equal(h.queries.length, 2);
        assert.equal(h.logs.length, 2);
        assert.equal(h.errors.length, 0);
        // Query two is scoped to the tenant, not repeatedly to individual loans.
        assert.match(h.queries[1].sql, /"loan_closures"\."tenant_id" = \$1/);
        assert.deepEqual(h.queries[1].params, ['tenant-A']);
        assert.match(h.queries[1].sql, /order by "loan_closures"\."closure_date" desc/);
        const gold = rows.find((r: any) => r.loanId === 'gold');
        assert.equal(gold.totalPaid, [0.20, 1250.35, 0.10].reduce((sum, n) => sum + n, 0));
        assert(!rows.some((r: any) => ['closed', 'foreign'].includes(r.loanId)));
      });
    }
  }
}

test('date, group, borrower and tenant filters are preserved in the actual SQL', async () => {
  const h = overdueHarness(fixtureLoans, fixtureClosures);
  const rows = await h.storage.getOverdueReportWithCorrectMath('tenant-A', {
    ...defaultFilters, groupId: 'group-B', customerName: 'Fixture borrower',
    dateFrom: '2024-01-01', dateTo: '2024-12-31',
  });
  assert.deepEqual(rows.map((r: any) => r.loanId), ['silver']);
  assert.deepEqual(h.queries[0].params, [
    'tenant-A', 'group-B', 'Fixture borrower', '2024-01-01', '2024-12-31', 'active',
  ]);
  assert.equal(rows[0].totalPaid, 500);
  assert.equal(h.queries.length, 2);
});

test('no eligible loans uses one query and does not fetch any closures', async () => {
  const h = overdueHarness(fixtureLoans, fixtureClosures);
  assert.deepEqual(await h.storage.getOverdueReportWithCorrectMath('missing-tenant', defaultFilters), []);
  assert.equal(h.queries.length, 1);
  assert.equal(h.logs.length, 2);
});

test('loan without payments still has zero paid; risk boundaries and overpayment stay unchanged', async () => {
  const weights = ['0.8000', '0.7999', '0.5000', '0.4999', '2.0000'];
  const h = overdueHarness(weights.map((weight, i) => fixtureLoan('risk-' + i, {
    weight, loanDate: '2026-10-24', principalAmount: '100.00', purity: '100',
  })));
  const rows = await h.storage.getOverdueReportWithCorrectMath('tenant-A', {
    ...defaultFilters, currentGoldRate: 100, monthlyInterestRate: 0,
  });
  assert.deepEqual(rows.map((r: any) => r.riskLevel), ['low', 'medium', 'medium', 'high', 'low']);
  assert(rows.every((r: any) => r.totalPaid === 0 && r.interestToDate === 0));
  const paid = overdueHarness([fixtureLoan('paid', {
    loanDate: '2026-10-24', principalAmount: '100.00',
  })], [{ tenantId: 'tenant-A', loanId: 'paid', closureDate: '2026-10-24', totalAmount: '150.00' }]);
  const [overpaid] = await paid.storage.getOverdueReportWithCorrectMath('tenant-A', {
    ...defaultFilters, monthlyInterestRate: 0,
  });
  assert.equal(overpaid.outstandingAmount, -50);
  assert.equal(overpaid.lossAmount, 0);
});

test('database failure rejects instead of returning an empty or partial report', async () => {
  const h = overdueHarness(fixtureLoans, fixtureClosures);
  h.failWith(new Error('synthetic database failure'));
  await assert.rejects(h.storage.getOverdueReportWithCorrectMath('tenant-A', defaultFilters),
    /synthetic database failure/);
  assert.equal(h.errors.length, 1);
});

test('ten thousand aged loans still use two queries and two log lines', { timeout: 15000 }, async t => {
  const count = 10000;
  const input = Array.from({ length: count }, (_, i) =>
    fixtureLoan('large-' + i, { loanDate: '1980-01-31' }));
  const payments = input.flatMap(loan => [
    { tenantId: 'tenant-A', loanId: loan.id, closureDate: '2025-01-01', totalAmount: '12.34' },
    { tenantId: 'tenant-A', loanId: loan.id, closureDate: '2026-01-01', totalAmount: '56.78' },
  ]);
  const h = overdueHarness(input, payments);
  const start = performance.now();
  const rows = await h.storage.getOverdueReportWithCorrectMath('tenant-A', defaultFilters);
  const elapsedMs = performance.now() - start;
  assert.equal(rows.length, count);
  assert(rows.every((r: any) => r.totalPaid === 56.78 + 12.34 && Number.isFinite(r.interestToDate)));
  assert.equal(h.queries.length, 2);
  assert.equal(h.logs.length, 2);
  t.diagnostic(`${count} loans / ${payments.length} payments: ${elapsedMs.toFixed(0)}ms with synthetic DB; not a live-database benchmark`);
});

test('indexes cover all-group dates, selected-group dates and tenant loan closures', () => {
  const loanIndexes = getTableConfig(loans).indexes.map(index =>
    index.config.columns.map(column => 'name' in column ? column.name : undefined));
  const closureIndexes = getTableConfig(loanClosures).indexes.map(index =>
    index.config.columns.map(column => 'name' in column ? column.name : undefined));
  assert(loanIndexes.some(columns => JSON.stringify(columns) ===
    JSON.stringify(['tenant_id', 'status', 'loan_date'])));
  assert(loanIndexes.some(columns => JSON.stringify(columns) ===
    JSON.stringify(['tenant_id', 'status', 'group_id', 'loan_date'])));
  assert(closureIndexes.some(columns => JSON.stringify(columns) ===
    JSON.stringify(['tenant_id', 'loan_id'])));
});
