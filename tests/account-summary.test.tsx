import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import {
  createSummaryRanges, updateSummaryRange, initializeSummaryRanges,
  firstSummaryLoanDate, summaryRangeError, validSummaryDate, summaryDataState,
  buildAccountSummaryRow, accountSummaryTotals, accountSummaryContext,
  accountSummaryExcelRows, accountSummaryPrintRows, checkedSummaryLoans, checkedSummaryClosures,
  createSummaryInterestSettings, rankAccountSummaryCustomers,
  accountSummaryPosition, accountSummaryYearlyProgress,
} from '../shared/account-summary';
import { uniqueBorrowerNames, formatWeight } from '../shared/report-weights';
import { AccountSummaryOverview } from '../client/src/components/reports/account-summary-overview';
import { exportAccountSummaryToExcel } from '../client/src/utils/excel-export';

const today = '2026-10-24';
const loans = [
  { id: 'old-closed', loanDate: '2025-02-01', principalAmount: '10000', status: 'closed', groupId: 'A', borrowerName: ' Customer A ' },
  { id: 'new-active', loanDate: '2026-04-01', principalAmount: '5000', status: 'active', groupId: 'A', borrowerName: 'customer a' },
  { id: 'later-closed', loanDate: '2026-04-30', principalAmount: '3000', status: 'closed', groupId: 'B', borrowerName: 'Customer B' },
  { id: 'old-active', loanDate: '2025-03-31', principalAmount: '2000', status: 'active', groupId: 'missing', borrowerName: 'Customer C' },
  { id: 'new-closed', loanDate: '2026-06-30', principalAmount: '4000', status: 'closed', groupId: 'B', borrowerName: 'Customer B' },
  { id: 'future', loanDate: '2027-04-01', principalAmount: '99999', status: 'active', groupId: 'A', borrowerName: 'Customer A' },
].map((loan, i) => ({ ...loan, tenantId: 'fixture', weight: i === 1 ? '1.111' : i === 3 ? '2.222' : '1', metalType: i === 3 ? 'silver' : 'gold', loanType: 'तारण', purity: '82' }));
const closures = [
  { id: 'c1', loanId: 'old-closed', closureDate: '2026-05-15', principalPaid: '10000', interestPaid: '1200', calculatedInterest: '2000' },
  { id: 'c2', loanId: 'later-closed', closureDate: '2026-08-01', principalPaid: '3000', interestPaid: '300', calculatedInterest: '500' },
  { id: 'c3', loanId: 'new-closed', closureDate: '2026-06-30', principalPaid: '4000', interestPaid: '0', calculatedInterest: '999' },
];
const row = (mode: 'cumulative' | 'period', input = loans, from = '2026-04-01', to = '2026-06-30', events = closures) =>
  buildAccountSummaryRow('fixture', input, events, mode, from, to, today);

test('four independent ranges retain mode and group/customer selections when switching', () => {
  let state = initializeSummaryRanges(createSummaryRanges(today), '2025-02-01');
  const untouched = state.customer;
  state = updateSummaryRange(state, 'group', 'period', 'from', '2024-04-01');
  state = updateSummaryRange(state, 'group', 'period', 'to', '2025-03-31');
  state = updateSummaryRange(state, 'group', 'cumulative', 'from', '2023-01-01');
  state = updateSummaryRange(state, 'customer', 'period', 'from', '2026-06-01');
  for (let i = 0; i < 10; i++) {
    assert.equal(state.group.period.from, '2024-04-01');
    assert.equal(state.group.period.to, '2025-03-31');
    assert.equal(state.group.cumulative.from, '2023-01-01');
    assert.equal(state.customer.period.from, '2026-06-01');
    assert.equal(state.customer.cumulative.from, '2025-02-01');
    assert.strictEqual(initializeSummaryRanges(state, '1990-01-01'), state);
  }
  assert.equal(untouched.period.from, '2026-04-01'); // immutable updates
});

test('first-loan default, empty data, FY boundary and initialization never reset edited dates', () => {
  assert.equal(firstSummaryLoanDate(loans, today), '2025-02-01');
  assert.equal(firstSummaryLoanDate([], today), today);
  assert.equal(createSummaryRanges('2026-03-31').group.period.from, '2025-04-01');
  assert.equal(createSummaryRanges('2026-04-01').group.period.from, '2026-04-01');
  assert.equal(createSummaryRanges(today).group.cumulative.to, today);
  const edited = updateSummaryRange(createSummaryRanges(today), 'group', 'cumulative', 'from', '');
  assert.equal(initializeSummaryRanges(edited, '2000-01-01').group.cumulative.from, '');
});

test('date-only validation handles leap days, empty, reversed and inclusive same-day ranges', () => {
  assert.equal(validSummaryDate('2024-02-29'), true);
  for (const date of ['', '2026-02-29', '2026-13-01', '24/10/2026']) assert.equal(validSummaryDate(date), false);
  assert.ok(summaryRangeError('', today));
  assert.ok(summaryRangeError('2026-10-25', today));
  assert.equal(summaryRangeError(today, today), '');
  assert.throws(() => row('period', loans, '', today), /वैध तारखा/);
  assert.equal(row('period', loans, '2026-06-30', '2026-06-30').closedLoans, 1);
});

test('all-time cumulative to today includes prior FY activity but not future dated loans', () => {
  const summary = row('cumulative', loans, firstSummaryLoanDate(loans, today), today);
  assert.deepEqual(
    [summary.totalLoans, summary.totalAmount, summary.closedLoans, summary.closedAmount, summary.activeLoans, summary.activeBalance, summary.totalInterest],
    [5, 24000, 3, 17000, 2, 7000, 1500],
  );
  assert.equal(summary.totalWeight, 6.333);
  assert.equal(formatWeight(summary.totalWeight), '6.33');
});

test('period activity includes older loans closed in range without negative subtraction balance', () => {
  const summary = row('period');
  assert.deepEqual(
    [summary.totalLoans, summary.totalAmount, summary.closedLoans, summary.closedAmount, summary.totalInterest],
    [3, 12000, 2, 14000, 1200],
  );
  assert.equal(summary.activeBalance, 5000);
  assert.equal(summary.activeLoans, 1); // not a historical June closing balance
  assert.notEqual(summary.activeBalance, summary.totalAmount - summary.closedAmount);
});

test('cumulative narrowed start retains current whole-book active balance, clearly disclosed', () => {
  const summary = row('cumulative');
  assert.equal(summary.activeBalance, 7000);
  assert.equal(summary.totalAmount, 12000);
  assert.match(accountSummaryContext('cumulative', '2026-04-01', today, 'all').balanceNote, /आजची सर्व चालू/);
  assert.match(accountSummaryContext('period', '2026-04-01', today, 'all').balanceNote, /कालावधीअखेरची शिल्लक नव्हे/);
});

test('cumulative interest defaults to FY only; lifetime toggle changes no principal/count/weight data', () => {
  const input = [...loans, { ...loans[0], id: 'previous-year', loanDate: '2024-01-01', principalAmount: '6000' }];
  const events = [...closures, {
    id: 'previous-closure', loanId: 'previous-year', closureDate: '2025-05-01',
    principalPaid: '6000', interestPaid: '600', calculatedInterest: '999',
  }];
  const settings = createSummaryInterestSettings(today);
  assert.deepEqual(settings.group, { allTime: false, from: '2026-04-01', to: '2027-03-31' });
  assert.notStrictEqual(settings.group, settings.customer);
  const fy = buildAccountSummaryRow('all', input, events, 'cumulative', '2024-01-01', today, today, settings.group);
  const lifetime = buildAccountSummaryRow('all', input, events, 'cumulative', '2024-01-01', today, today, { from: '2024-01-01', to: today });
  assert.equal(fy.totalInterest, 1500);
  assert.equal(lifetime.totalInterest, 2100);
  const { totalInterest: fyInterest, ...fyRest } = fy;
  const { totalInterest: lifeInterest, ...lifeRest } = lifetime;
  assert.deepEqual(fyRest, lifeRest);
  assert.equal(fy.totalAmount, 30000);
  assert.equal(fy.closedAmount, 23000);
  assert.equal(fy.activeBalance, 7000);
});

test('FY default handles Jan-March, selected interest ranges are inclusive and future receipts excluded', () => {
  assert.equal(createSummaryInterestSettings('2026-03-31').customer.from, '2025-04-01');
  assert.equal(createSummaryInterestSettings('2026-04-01').customer.from, '2026-04-01');
  const events = [...closures, { ...closures[0], id: 'future-event', closureDate: '2026-12-01', interestPaid: '9999' }];
  const fy = buildAccountSummaryRow('all', loans, events, 'cumulative', '2025-01-01', today, today, { from: '2026-04-01', to: '2027-03-31' });
  assert.equal(fy.totalInterest, 1500);
  const sameDay = buildAccountSummaryRow('all', loans, events, 'cumulative', '2025-01-01', today, today, { from: '2026-05-15', to: '2026-05-15' });
  assert.equal(sameDay.totalInterest, 1200);
  assert.equal(sameDay.closedAmount, fy.closedAmount);
  assert.throws(() => buildAccountSummaryRow('all', loans, events, 'cumulative', '2025-01-01', today, today, { from: '', to: today }));
  assert.deepEqual(
    buildAccountSummaryRow('period', loans, closures, 'period', '2026-04-01', '2026-06-30', today, { from: '', to: '' }),
    buildAccountSummaryRow('period', loans, closures, 'period', '2026-04-01', '2026-06-30', today),
  );
});

test('changing displayed interest does not change top-50 membership, scores or other grand totals', () => {
  const base = row('cumulative', loans, '2025-01-01', today);
  const customers = Array.from({ length: 55 }, (_, i) => ({ ...base, name: `customer-${i}`, rankingInterest: i + 1, totalInterest: i % 2 ? 0 : 2000 }));
  const withLifetime = customers.map(customer => ({ ...customer, totalInterest: customer.rankingInterest }));
  const first = rankAccountSummaryCustomers(customers);
  const second = rankAccountSummaryCustomers(withLifetime);
  assert.deepEqual(first.map(row => [row.name, row.score]), second.map(row => [row.name, row.score]));
  assert.equal(accountSummaryTotals(first).totalAmount, accountSummaryTotals(second).totalAmount);
});

test('interest selection is labelled in actual overview, print context and Excel metadata', () => {
  const fy = accountSummaryContext('cumulative', '2025-01-01', today, 'सर्व गट', createSummaryInterestSettings(today).group);
  const lifetime = accountSummaryContext('cumulative', '2025-01-01', today, 'सर्व गट', { allTime: true, from: '2025-01-01', to: today });
  assert.match(fy.interestText, /01\/04\/2026 ते 31\/03\/2027/);
  assert.match(lifetime.interestText, /सुरुवातीपासून आजपर्यंतचे सर्व/);
  assert.match(fy.balanceNote, /वाटप व बंद:/);
  assert.match(fy.periodText, /मिळालेले व्याज:/);
  const html = renderToStaticMarkup(<AccountSummaryOverview totals={row('cumulative')} mode="cumulative" periodText={fy.periodText} interestLabel={fy.interestText} />);
  assert.match(html, /निवडलेल्या आर्थिक वर्षातील/);
  const data = accountSummaryExcelRows([row('cumulative')], lifetime);
  assert.match(JSON.stringify(data), /व्याजाचा स्वतंत्र कालावधी/);
  assert.match(JSON.stringify(data), /सुरुवातीपासून आजपर्यंतचे सर्व/);
});

test('paid overrides including zero are authoritative, and unchanged closure fallbacks remain supported', () => {
  const result = row('period', loans, '2026-06-30', '2026-06-30', [
    { ...closures[2], principalPaid: '0', principalAmount: '777', interestPaid: '0' },
  ]);
  assert.equal(result.closedAmount, 0);
  assert.equal(result.totalInterest, 0);
});

test('duplicate payload identity does not inflate totals, different closure events keep event semantics', () => {
  assert.deepEqual(row('period', loans.concat(loans), '2026-04-01', '2026-06-30', closures.concat(closures)), row('period'));
  const distinct = row('period', loans, '2026-04-01', '2026-06-30', [...closures, { ...closures[0], id: 'different-event' }]);
  assert.equal(distinct.closedLoans, 2);
  assert.equal(distinct.closedAmount, 24000); // audit warns: no unapproved loan-ID collapse
});

test('reopened loan without retained closure matches existing backend reversal semantics', () => {
  const reopened = loans.map(loan => loan.id === 'old-closed' ? { ...loan, status: 'active' } : loan);
  const remaining = closures.filter(closure => closure.loanId !== 'old-closed');
  const summary = row('cumulative', reopened, '2025-01-01', today, remaining);
  assert.equal(summary.closedLoans, 2);
  assert.equal(summary.totalInterest, 300);
  assert.equal(summary.activeBalance, 17000);
});

test('group/unassigned and normalized customer sums reconcile; subset totals are not full book totals', () => {
  const summaries = ['A', 'B', 'missing'].map(group => row('period', loans.filter(loan => loan.groupId === group)));
  const grouped = accountSummaryTotals(summaries);
  assert.equal(grouped.totalAmount, row('period').totalAmount);
  assert.equal(grouped.closedAmount, row('period').closedAmount);
  const customers = uniqueBorrowerNames(loans).map(name =>
    row('period', loans.filter(loan => loan.borrowerName.trim().toLowerCase() === name.trim().toLowerCase())));
  assert.equal(customers.length, 3);
  assert.equal(accountSummaryTotals(customers).totalInterest, grouped.totalInterest);
  assert.notEqual(accountSummaryTotals(customers.slice(0, 1)).totalAmount, grouped.totalAmount);
});

test('loading, refetch, cached failure, malformed financial values and genuine empty results are distinct', () => {
  const ready = { isSuccess: true, isFetching: false, isError: false };
  assert.equal(summaryDataState([ready, ready, ready]), 'ready');
  assert.equal(summaryDataState([ready, { ...ready, isFetching: true }]), 'loading');
  assert.equal(summaryDataState([ready, { ...ready, isSuccess: false }]), 'loading');
  assert.equal(summaryDataState([ready, { ...ready, isError: true }]), 'error');
  assert.deepEqual(checkedSummaryLoans([]), []);
  assert.deepEqual(checkedSummaryClosures([]), []);
  assert.throws(() => checkedSummaryLoans([{ ...loans[0], principalAmount: 'not money' }]), /मुद्दल अवैध/);
  assert.throws(() => checkedSummaryClosures([{ ...closures[0], interestPaid: 'NaN' }]), /रक्कम अवैध/);
  assert.throws(() => checkedSummaryLoans([{ ...loans[0], weight: '4 G450' }]), /वजन/);
  assert.equal(row('period', []).totalLoans, 0);
});

test('real Excel worksheet retains mode/date/scope, zeros, raw amounts and displayed-row totals', () => {
  const summary = row('period');
  const context = accountSummaryContext('period', '2026-04-01', '2026-06-30', 'फक्त दर्शवलेले टॉप ५०');
  const data = accountSummaryExcelRows([summary], context);
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Summary');
  const reopened = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
  const roundtrip = XLSX.utils.sheet_to_json<(string | number)[]>(reopened.Sheets.Summary, { header: 1 });
  assert.deepEqual(roundtrip[1], ['सुरुवात', '2026-04-01', 'शेवट', '2026-06-30']);
  assert.match(JSON.stringify(roundtrip), /फक्त दर्शवलेले टॉप ५०/);
  assert.match(JSON.stringify(roundtrip), /कालावधी हिशोब/);
  assert.equal(roundtrip[6][5], 12000);
  assert.equal(roundtrip[7][6], 14000);
  const zero = accountSummaryExcelRows([row('period', [])], context);
  assert.equal(zero[6][8], 0);
});

test('actual account-summary export keeps numeric zeros through the generic Excel writer', () => {
  const previous = process.cwd();
  const temporary = mkdtempSync(join(tmpdir(), 'account-summary-xlsx-'));
  try {
    process.chdir(temporary);
    const context = accountSummaryContext('period', '2026-04-01', '2026-06-30', 'रिकामा गट');
    assert.equal(exportAccountSummaryToExcel([row('period', [])], context.modeLabel, context), true);
    const file = readdirSync(temporary).find(file => file.endsWith('.xlsx'))!;
    assert.match(file, /2026-04-01_2026-06-30/);
    const workbook = XLSX.read(readFileSync(join(temporary, file)), { type: 'buffer' });
    const cells = XLSX.utils.sheet_to_json<(number | string)[]>(workbook.Sheets['Account Summary'], { header: 1 });
    assert.equal(cells[6][8], 0);
    assert.equal(cells[7][8], 0);
    assert.equal(cells[1][1], '2026-04-01');
  } finally {
    process.chdir(previous);
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('actual print rows preserve matching sums, distinct subset total and escaped names', () => {
  const summary = { ...row('period'), name: '<img src=x onerror=alert(1)>' };
  const html = accountSummaryPrintRows([summary], accountSummaryTotals([summary]), true);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.match(html, /₹12,000/);
  assert.match(html, /₹14,000/);
  assert.match(html, /₹1,200/);
  assert.equal((html.match(/<td/g) || []).length, 18); // 9 columns each
});

test('both mode overview renders real rupee/count charts without claiming a historical balance', () => {
  for (const mode of ['cumulative', 'period'] as const) {
    const html = renderToStaticMarkup(<AccountSummaryOverview totals={row(mode)} mode={mode} periodText="2026-04-01 ते 2026-06-30" subsetLabel="चाचणी गट" />);
    assert.equal((html.match(/<svg/g) || []).length, 2);
    assert.match(html, /रकमेची तुलना/);
    assert.match(html, /खात्यांची तुलना/);
    assert.match(html, /2026-04-01/);
    assert.match(html, /चाचणी गट/);
    assert.match(html, /प्रत्यक्ष मिळालेले व्याज/);
    assert.doesNotMatch(html, /<article class="aso-total|aria-label="मुख्य एकूण"/);
    if (mode === 'period') assert.doesNotMatch(html, /आज सक्रिय मुद्दल शिल्लक/);
  }
  const zero = renderToStaticMarkup(<AccountSummaryOverview totals={row('period', [])} mode="period" periodText="रिकामा कालावधी" />);
  assert.doesNotMatch(zero, /NaN|Infinity/);
  const signed = renderToStaticMarkup(<AccountSummaryOverview totals={{ ...row('period'), totalInterest: -1200 }} mode="period" periodText="परतावा" />);
  assert.match(signed, /fill="var\(--aso-danger\)"/); // signed values are not silently flattened to zero
  assert.match(signed, /--aso-danger: #D8524F/);
});

test('screen financial totals have a single canonical table/mobile location outside charts', () => {
  const source = readFileSync('client/src/pages/reports/account-summary.tsx', 'utf8');
  const performance = source.slice(source.indexOf('<div id="group-performance-section"'));
  assert.doesNotMatch(performance, /formatCurrency\(groupGrandTotals\./);
  assert.match(source, /आजपर्यंतचे सर्व व्याज/);
  assert.doesNotMatch(source, /बंद असताना खालील आर्थिक वर्षाच्या|वाटप व बंद खाती सुरुवातीपासून आजपर्यंतची/);
});

test('today overview renders real scoped active stock and FY progress without lifetime turnover cards', () => {
  const position = accountSummaryPosition(loans, closures, today, createSummaryInterestSettings(today).group);
  const html = renderToStaticMarkup(<AccountSummaryOverview totals={row('cumulative')} mode="cumulative"
    periodText={today} position={position} yearlyProgress={accountSummaryYearlyProgress(loans, closures, today)} />);
  assert.match(html, /account-summary-current-position/);
  assert.match(html, /2 सक्रिय खाती/);
  assert.match(html, /₹7,000/);
  assert.match(html, /1\.11/);
  assert.match(html, /2\.22/);
  assert.match(html, /आर्थिक वर्षनिहाय प्रगती/);
  assert.doesNotMatch(html, /NaN|Infinity|class="aso-total /);
});

test('page wires guarded exports, shared context, independent date updates and both print overviews', () => {
  const source = readFileSync('client/src/pages/reports/account-summary.tsx', 'utf8');
  assert.match(source, /if \(!reportReady\) \{ alert\(reportProblem\); return; \}/);
  assert.match(source, /exportAccountSummaryToExcel\(cleanReportData, modeLabel, reportContext\)/);
  assert.match(source, /const html = accountSummaryPrintDocument/);
  assert.match(source, /printAccountSummary\(html\)/);
  assert.match(source, /downloadPrintDocumentPdf\(html/);
  assert.match(source, /overviewMode: calcMode/);
  const printHelper = readFileSync('client/src/lib/account-summary-print.ts', 'utf8');
  assert.match(printHelper, /accountSummaryPrintRows\(rows, totals, showRank\)/);
  assert.match(printHelper, /await doc.fonts.ready/);
  assert.match(source, /\.account-summary-print \{ display: block !important/);
  assert.match(source, /checked=\{interestSettings\[activeTab\]\.allTime\}/);
  assert.match(source, /calcMode === "period" \? <>/);
  assert.match(source, /accountSummaryPosition\(positionLoans/);
  assert.match(source, /accountSummaryYearlyProgress\(positionLoans/);
  assert.match(source, /queryState === 'ready' && dateRanges\[activeTab\]\.cumulative\.from === null/);
  assert.equal((source.match(/<AccountSummaryOverview/g) || []).length, 3);
  assert.doesNotMatch(source, /queryKey: \["\/api\/transactions"\]/);
});
