import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_SETTINGS, generatePacketLabelHtml, generatePacketPrintPage,
} from '../client/src/components/label-print-dialog';
import {
  checkedReportLoans, reportLoanWeight, sumWeightGrams, formatWeight, WeightFormatError,
} from '../shared/report-weights';

const loans = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1, accountNumber: String(i + 1), borrowerName: 'Fixture',
  principalAmount: '100', loanDate: '2026-04-01',
  weight: i === 99 ? '3.631' : '4.900', metalType: i % 2 ? 'silver' : 'gold',
}));
const settings = { ...DEFAULT_SETTINGS, printMode: 'packet' as const };

test('actual packet HTML prints 488.73, retaining source weights and counting duplicate loans once', () => {
  const before = JSON.stringify(loans);
  const html = generatePacketLabelHtml(loans.concat(loans), settings);
  assert.match(html, /488\.73g/);
  assert.doesNotMatch(html, /977\.46g|4887\.31g/);
  assert.equal(JSON.stringify(loans), before);
  const page = generatePacketPrintPage(loans.concat(loans), settings);
  assert.match(page, /488\.73g/);
  assert.doesNotMatch(page, /977\.46g/);
});

test('packet chunks use raw weights, not rounded individual labels or a repeated global total', () => {
  const small = loans.slice(0, 4).map((loan, i) => ({ ...loan, weight: i < 2 ? '1.2349' : '0.0049' }));
  const page = generatePacketPrintPage(small.concat(small), { ...settings, perPacket: 2 });
  assert.equal((page.match(/2\.47g/g) || []).length, 1);
  assert.equal((page.match(/0\.01g/g) || []).length, 1);
  assert.doesNotMatch(page, /2\.46g/);
});

test('packet entry points reject ambiguous records before producing a plausible partial total', () => {
  const bad = [...loans, { ...loans[0], id: 999, accountNumber: 'TEST-BAD', weight: '4 G450' }];
  assert.throws(() => generatePacketLabelHtml(bad, settings), /खाते TEST-BAD/);
  assert.throws(() => generatePacketPrintPage(bad, settings), WeightFormatError);
  assert.throws(() => reportLoanWeight(bad[100]), /खाते TEST-BAD/);
});

test('overdue mapping preserves precision, eligibility and loan identity before totals', () => {
  const payload = loans.map(loan => ({
    ...loan, loanId: String(loan.id), goldWeight: reportLoanWeight(loan),
    loanType: loan.id === 1 ? 'विनातारण' : 'तारण',
  }));
  const checked = checkedReportLoans(payload.concat(payload).map(item => ({
    ...item, id: item.loanId, weight: item.goldWeight,
  })));
  assert.equal(checked.length, 100);
  assert.equal(sumWeightGrams(checked.map(item => item.weight)), 488.731);
  const secured = checked.filter(item => item.loanType !== 'विनातारण');
  assert.equal(formatWeight(sumWeightGrams(secured.map(item => item.goldWeight))), '483.83');
});

test('weight failures reach API/UI and failed full exports do not silently use only one page', () => {
  const routes = readFileSync('server/routes.ts', 'utf8');
  for (const path of ['/api/overdue-report', '/api/loading-report']) {
    const start = routes.indexOf(`app.get("${path}"`);
    const end = routes.indexOf('\n  });', start);
    assert.match(routes.slice(start, end), /error instanceof WeightFormatError/);
    assert.match(routes.slice(start, end), /status\(422\)/);
  }
  const loading = readFileSync('client/src/pages/reports/loading-report.tsx', 'utf8');
  assert.match(loading, /error: reportError/);
  assert.match(loading, /role="alert"/);
  assert.doesNotMatch(loading, /catch\s*\{\s*\}/);
  const overdue = readFileSync('client/src/pages/reports/overdue.tsx', 'utf8');
  assert.match(overdue, /overdueMetalWeightTotals\(securedLoans\)/);
  assert.match(overdue, /const overdueData = reportError \? \[\] : reportItems/);
});
