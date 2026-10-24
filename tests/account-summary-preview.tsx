/**
 * Local-only visual regression harness. Synthetic fixtures, no app auth/data/routes.
 * Run explicitly with: node --import tsx tests/account-summary-preview.tsx
 */
import React from 'react';
import { createServer } from 'node:http';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountSummaryOverview } from '../client/src/components/reports/account-summary-overview';
import { accountSummaryContext, createSummaryInterestSettings } from '../shared/account-summary';
import { formatSummaryDate } from '../shared/account-summary-format';
import { accountSummaryPrintDocument } from '../client/src/lib/account-summary-print';
import { accountSummaryTotals } from '../shared/account-summary';
import type { SummaryRow } from '../shared/account-summary';

const fixtures = {
  cumulative: {
    totalLoans: 100, activeLoans: 40, closedLoans: 60,
    totalAmount: 3087700, closedAmount: 2178500, activeBalance: 909200, totalInterest: 138846,
  },
  period: {
    totalLoans: 3, activeLoans: 1, closedLoans: 2,
    totalAmount: 12000, closedAmount: 14000, activeBalance: 5000, totalInterest: 1200,
  },
};
createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://fixture');
  const mode = url.pathname === '/period' || url.searchParams.has('period') ? 'period' : 'cumulative';
  const context = accountSummaryContext(mode, mode === 'cumulative' ? '2020-01-01' : '2026-04-01',
    '2026-06-30', 'कृत्रिम चाचणी डेटा',
    mode === 'cumulative' ? createSummaryInterestSettings('2026-06-30').group : undefined);
  const values = { ...fixtures[mode], ...(url.searchParams.has('large') ? { totalAmount: 1234567890.12 } : {}) };
  const body = renderToStaticMarkup(<AccountSummaryOverview totals={values} mode={mode}
    periodText={`${formatSummaryDate(context.from)} ते ${formatSummaryDate(context.to)}`}
    subsetLabel={context.scope} interestLabel={context.interestText} />);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (url.pathname === '/print') {
    const count = Math.min(50, Number(url.searchParams.get('rows') || 1));
    const rows: SummaryRow[] = Array.from({ length: count }, (_, index) => ({
      ...values, name: `नमुना गट ${index + 1}`,
      totalWeight: 0, totalFineWeight: 0, goldWeight: 0, goldFineWeight: 0, silverWeight: 0, silverFineWeight: 0,
    }));
    const totals = accountSummaryTotals(rows);
    const printOverview = renderToStaticMarkup(<AccountSummaryOverview totals={totals} mode={mode}
      periodText={`${formatSummaryDate(context.from)} ते ${formatSummaryDate(context.to)}`}
      subsetLabel={context.scope} interestLabel={context.interestText} />);
    res.end(accountSummaryPrintDocument({
      company: 'नमुना फायनान्स — कृत्रिम डेटा', title: 'खाते सारांश अहवाल',
      period: `${formatSummaryDate(context.from)} ते ${formatSummaryDate(context.to)}`, scope: context.scope,
      interest: 'व्याज: आर्थिक वर्ष 01/04/2026 ते 31/03/2027',
      notes: context.balanceNote, label: 'गटाचे नाव', rows, totals,
      showRank: url.searchParams.has('rank'), includeOverview: url.searchParams.has('overview'),
      includeNotes: url.searchParams.has('notes'), overviewHTML: printOverview,
    }));
    return;
  }
  res.end(`<!doctype html><html lang="mr"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet"><style>body{margin:0;padding:16px;font-family:'Noto Sans Devanagari',sans-serif;background:#f9fafb;max-width:1100px;margin:auto}</style><body>${body}</body></html>`);
}).listen(5001, '0.0.0.0', () => console.log('Synthetic account summary preview on 5001'));
