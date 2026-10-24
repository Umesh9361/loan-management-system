/**
 * Local-only visual regression harness. Synthetic fixtures, no app auth/data/routes.
 * Run explicitly with: node --import tsx tests/account-summary-preview.tsx
 */
import React from 'react';
import { createServer } from 'node:http';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountSummaryOverview } from '../client/src/components/reports/account-summary-overview';
import { accountSummaryContext } from '../shared/account-summary';

const fixtures = {
  cumulative: {
    totalLoans: 100, activeLoans: 40, closedLoans: 60,
    totalAmount: 1234567.89, closedAmount: 734567.89, activeBalance: 500000, totalInterest: 98765.43,
  },
  period: {
    totalLoans: 3, activeLoans: 1, closedLoans: 2,
    totalAmount: 12000, closedAmount: 14000, activeBalance: 5000, totalInterest: 1200,
  },
};
createServer((req, res) => {
  const mode = req.url === '/period' ? 'period' : 'cumulative';
  const context = accountSummaryContext(mode, '2026-04-01', '2026-06-30', 'कृत्रिम चाचणी डेटा — ग्राहकांची वास्तविक माहिती नाही');
  const body = renderToStaticMarkup(<AccountSummaryOverview totals={fixtures[mode]} mode={mode} periodText={context.periodText} />);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="mr"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet"><style>body{margin:0;padding:16px;font-family:'Noto Sans Devanagari',sans-serif;background:#f9fafb;max-width:1100px;margin:auto}</style><body>${body}</body></html>`);
}).listen(5001, '0.0.0.0', () => console.log('Synthetic account summary preview on 5001'));
