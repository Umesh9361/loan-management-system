// Local-only synthetic fixture. Does not create an app route or bypass authentication.
// Run explicitly with: node --import tsx tests/borrower-list-totals-preview.tsx
import React from 'react';
import { createServer } from 'node:http';
import { renderToStaticMarkup } from 'react-dom/server';
import { BorrowerListTotals } from '../client/src/components/reports/borrower-list-totals';
const totals = { count: 114, totalAmount: 12345678, goldWeight: 488.731, silverWeight: 250.125,
  totalWeight: 738.856, totalInterest: 0 };
createServer((request, response) => {
  const large = request.url === '/large';
  const html = renderToStaticMarkup(<BorrowerListTotals status="ready" totals={
    large ? { ...totals, totalAmount: 1234567890123, goldWeight: 12345678.12, totalWeight: 12345928.25 } : totals
  } />);
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><html lang="mr"><meta name="viewport" content="width=device-width,initial-scale=1">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet">
    <style>body{margin:0;background:#f9fafb;font-family:sans-serif}main{max-width:1120px;margin:auto;padding:16px 24px 100px}p{font-size:12px;color:#555}</style>
    <main><p>कृत्रिम चाचणी डेटा — वास्तविक ग्राहकांचा रिपोर्ट नाही</p>${html}</main></html>`);
}).listen(5001, '0.0.0.0', () => console.log('Synthetic borrower total fixture on port 5001'));
