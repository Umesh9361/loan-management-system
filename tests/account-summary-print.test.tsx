import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { accountSummaryPrintDocument, type SummaryPrintOptions } from '../client/src/lib/account-summary-print';
import { AccountSummaryOverview } from '../client/src/components/reports/account-summary-overview';
import { accountSummaryTotals } from '../shared/account-summary';

const rows = [{
  name: 'नमुना & <गट>', totalLoans: 100, activeLoans: 40, closedLoans: 60,
  totalAmount: 3087700, closedAmount: 2178500, activeBalance: 1850200, totalInterest: 138846.25,
}];
const totals = accountSummaryTotals(rows);
const options: SummaryPrintOptions = {
  company: 'कंपनी & <नाव>', title: 'खाते सारांश अहवाल', period: '01/04/2026 ते 24/10/2026',
  scope: 'सर्व गट', interest: 'व्याज: आर्थिक वर्ष 01/04/2026 ते 31/03/2027',
  notes: 'सविस्तर हिशोबाचे स्पष्टीकरण', label: 'गटाचे नाव', rows, totals,
  showRank: false, includeOverview: false, includeNotes: false,
  overviewHTML: renderToStaticMarkup(<AccountSummaryOverview totals={totals} mode="cumulative" periodText="01/04/2026 ते 24/10/2026" />),
};

test('top 50 print/PDF omits overview cards and charts even if previously selected', () => {
  const html = accountSummaryPrintDocument({ ...options, showRank: true, includeOverview: true });
  assert.doesNotMatch(html, /<svg|class="aso"/);
  assert.match(html, /<th>#<\/th>/);
  assert.match(html, /नमुना &amp; &lt;गट&gt;/);
});

test('default print contains original table and concise context, no added summary/notes', () => {
  const html = accountSummaryPrintDocument(options);
  assert.match(html, /₹30,87,700/);
  assert.match(html, /₹1,38,846\.25/);
  assert.match(html, /31\/03\/2027/);
  assert.doesNotMatch(html, /<svg|class="aso"|सविस्तर हिशोबाचे स्पष्टीकरण/);
  assert.doesNotMatch(html, /[०-९]/);
  assert.equal((html.match(/<col style/g) || []).length, 8);
  assert.match(html, /कंपनी &amp; &lt;नाव&gt;/);
  assert.match(html, /नमुना &amp; &lt;गट&gt;/);
});

test('summary and explanation independently optional for print and Save as PDF', () => {
  for (const includeOverview of [false, true]) {
    for (const includeNotes of [false, true]) {
      const html = accountSummaryPrintDocument({ ...options, includeOverview, includeNotes });
      assert.equal((html.match(/<svg/g) || []).length, includeOverview ? 2 : 0);
      assert.equal(html.includes('सविस्तर हिशोबाचे स्पष्टीकरण'), includeNotes);
      assert.match(html, /₹30,87,700/);
      assert.match(html, /दर्शवलेल्या ओळींची एकूण टोटल/);
    }
  }
});

test('ranked customer print retains all nine original columns and repeating table headers', () => {
  const html = accountSummaryPrintDocument({ ...options, showRank: true });
  assert.equal((html.match(/<col style/g) || []).length, 9);
  assert.match(html, /<th>#<\/th>/);
  assert.match(html, /display: table-header-group/);
  assert.match(html, /size: A4 portrait/);
  assert.match(html, /<tbody class="summary-document-closing"><tr class="total-row">/);
  assert.match(html, /colspan="9">सावकाराची सही/);
  assert.match(html, /\.summary-document-signature td \{[^}]*padding: 14px 15mm 0 0;/);
  assert.doesNotMatch(html, /margin-top: 50px|padding: 3mm 5mm 3mm 20mm/);
});

test('group and customer print share options and await fonts/layout before opening print', () => {
  const page = readFileSync('client/src/pages/reports/account-summary.tsx', 'utf8');
  const helper = readFileSync('client/src/lib/account-summary-print.ts', 'utf8');
  assert.match(page, /includePrintOverview.*useState\(false\)/);
  assert.match(page, /includePrintNotes.*useState\(false\)/);
  assert.equal((page.match(/onClick=\{handlePrint\}/g) || []).length, 2);
  assert.match(helper, /doc\.fonts\.load/);
  assert.match(helper, /await doc\.fonts\.ready/);
  assert.match(helper, /afterprint/);
  assert.doesNotMatch(helper, /window\.print\(\)/);
});
