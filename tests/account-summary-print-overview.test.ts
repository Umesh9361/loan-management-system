import test from "node:test";
import assert from "node:assert/strict";
import { accountSummaryPrintOverview } from "../client/src/lib/account-summary-print-overview";

const totals = {
  totalLoans: 843, activeLoans: 532, closedLoans: 311,
  totalAmount: 31115363, closedAmount: 12900500,
  activeBalance: 18214863, totalInterest: 1530024,
};
test("print overview uses exact values without stretched dashboard SVG or a duplicate legend", () => {
  const html = accountSummaryPrintOverview(totals);
  for (const amount of ["₹3,11,15,363", "₹1,29,00,500", "₹1,82,14,863", "₹15,30,024"]) assert.ok(html.includes(amount));
  assert.doesNotMatch(html, /<svg|aso-|[०-९]|\.00/);
  assert.doesNotMatch(html, /class="summary-overview-metrics"/);
  assert.equal((html.match(/<section class="summary-overview-chart">/g) || []).length, 2);
  assert.match(html, /width:100%/);
  assert.doesNotMatch(html, /summary-overview-axis-zero/); // zero already has an endpoint label
});
test("period overview omits current balances/accounts, without changing provided totals", () => {
  const original = { ...totals };
  const html = accountSummaryPrintOverview(totals, "period");
  assert.doesNotMatch(html, /आजची मुद्दल शिल्लक|आज सक्रिय खाती|₹1,82,14,863/);
  assert.match(html, /₹15,30,024/);
  assert.deepEqual(totals, original);
});
test("zero and negative values render finite truthful proportional bars", () => {
  const zero = accountSummaryPrintOverview(Object.fromEntries(Object.keys(totals).map(key => [key, 0])) as typeof totals);
  assert.doesNotMatch(zero, /NaN|Infinity|class="summary-overview-bar"/);
  const mixed = accountSummaryPrintOverview({ ...totals, totalAmount: 100, closedAmount: 50, totalInterest: -25, activeBalance: 0 });
  assert.match(mixed, /left:0%;width:20%/);
  assert.match(mixed, /left:20%;width:80%/);
  assert.match(mixed, /summary-overview-axis-zero/);
});
