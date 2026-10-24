import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { AccountSummaryOverview } from '../client/src/components/reports/account-summary-overview';
import {
  englishSummaryDigits, formatSummaryCount, formatSummaryCurrency, formatSummaryDate,
} from '../shared/account-summary-format';
import { formatWeight } from '../shared/report-weights';
import { accountSummaryContext, createSummaryInterestSettings } from '../shared/account-summary';

test('summary currency uses English Indian grouping with no unnecessary .00 and preserves paise', () => {
  assert.equal(formatSummaryCurrency(3087700), '₹30,87,700');
  assert.equal(formatSummaryCurrency(0), '₹0');
  assert.equal(formatSummaryCurrency(1234567.89), '₹12,34,567.89');
  assert.equal(formatSummaryCurrency(12.50), '₹12.5');
  assert.equal(formatSummaryCurrency(-1000.25), '-₹1,000.25');
  assert.equal(formatSummaryCurrency(999999999999.99), '₹9,99,99,99,99,999.99');
  assert.equal(formatWeight(488.731), '488.73'); // unchanged weight precision
  assert.equal(formatWeight(10), '10.00');
});

test('summary counts, scope numerals and dates are English without timezone conversion', () => {
  assert.equal(formatSummaryCount(12345), '12,345');
  assert.equal(englishSummaryDigits('टॉप ५० | २४/१०/२०२६'), 'टॉप 50 | 24/10/2026');
  assert.equal(formatSummaryDate('2026-10-24'), '24/10/2026');
  assert.equal(formatSummaryDate(''), '—');
});

const totals = {
  totalLoans: 100, activeLoans: 40, closedLoans: 60,
  totalAmount: 1234567890.12, closedAmount: 734567, activeBalance: 500000,
  totalInterest: 98765.43,
};

test('all summary metric/chart/scope text uses English digits, with full values retained', () => {
  const html = renderToStaticMarkup(<AccountSummaryOverview totals={totals} mode="cumulative"
    periodText="०१/०४/२०२६ ते २४/१०/२०२६" subsetLabel="फक्त टॉप ५०" />);
  assert.doesNotMatch(html, /[०-९]/);
  assert.match(html, /₹1,23,45,67,890\.12/);
  assert.match(html, /₹7,34,567</);
  assert.match(html, /₹5,00,000</);
  assert.match(html, /01\/04\/2026 ते 24\/10\/2026/);
  assert.match(html, /फक्त टॉप 50/);
  assert.equal((html.match(/<svg/g) || []).length, 2);
  assert.match(html, /white-space: nowrap/);
});

test('concise interest caption retains dates and expandable full FY/lifetime meanings', () => {
  const fy = createSummaryInterestSettings('2026-10-24').group;
  for (const interest of [fy, { allTime: true, from: '2020-01-01', to: '2026-10-24' }]) {
    const context = accountSummaryContext('cumulative', '2020-01-01', '2026-10-24', 'सर्व गट', interest);
    const html = renderToStaticMarkup(<AccountSummaryOverview totals={totals} mode="cumulative"
      periodText="01/01/2020 ते 24/10/2026" interestLabel={context.interestText} />);
    assert.match(html, /<details/);
    assert.match(html, /आजनंतरचे व्यवहार वगळले आहेत/);
    assert.match(html, interest.allTime ? /सुरुवातीपासून/ : /निवडलेल्या आर्थिक वर्षातील/);
    assert.match(html, interest.allTime ? /01\/01\/2020 ते 24\/10\/2026/ : /01\/04\/2026 ते 31\/03\/2027/);
  }
  const period = renderToStaticMarkup(<AccountSummaryOverview totals={totals}
    mode="period" periodText="01/04/2026 ते 24/10/2026" />);
  assert.doesNotMatch(period, /आज सक्रिय मुद्दल शिल्लक/);
});

test('group and customer views share formatter and short scope without changing accounting code', () => {
  const page = readFileSync('client/src/pages/reports/account-summary.tsx', 'utf8');
  assert.match(page, /const formatCurrency = formatSummaryCurrency/);
  assert.equal((page.match(/periodText=\{overviewPeriodText\}/g) || []).length, 3);
  assert.equal((page.match(/type="date" lang="en-GB"/g) || []).length, 4);
  assert.doesNotMatch(page, /new Intl\.NumberFormat\('(?:mr|hi)-IN'/);
  assert.doesNotMatch(page, /[०-९]/);
});

test('chart metrics have distinct semantic colors shared between cards, both charts and legends', () => {
  const html = renderToStaticMarkup(<AccountSummaryOverview totals={totals} mode="cumulative" periodText="01/04/2026 ते 24/10/2026" />);
  const charts = [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(match => match[0]);
  const fills = (svg: string) => [...svg.matchAll(/fill="var\((--aso-[^)]+)\)"/g)].map(match => match[1]);
  const money = fills(charts[0]);
  const accounts = fills(charts[1]);
  assert.deepEqual(money, ['--aso-disbursements', '--aso-closures', '--aso-interest', '--aso-balance']);
  assert.equal(new Set(money).size, 4);
  assert.deepEqual(accounts, ['--aso-disbursements', '--aso-closures', '--aso-balance']);
  for (const token of money) {
    assert.match(html, new RegExp(`background-color:var\\(${token}\\)`));
  }
  const colors = money.map(token => html.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]);
  assert.equal(new Set(colors).size, 4);
  assert.ok(colors.every(Boolean));
});

test('very large metric amounts expand the mobile grid rather than clipping or truncating values', () => {
  const html = renderToStaticMarkup(<AccountSummaryOverview totals={totals} mode="cumulative" periodText="" />);
  assert.match(html, /class="aso-key-totals aso-key-totals-long"/);
  assert.match(html, /₹1,23,45,67,890\.12/);
});
