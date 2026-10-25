import assert from "node:assert/strict";
import test from "node:test";
import { accountSummaryPosition, accountSummaryYearlyProgress, buildAccountSummaryRow } from "../shared/account-summary";
import { accountSummaryPrintDocument } from "../client/src/lib/account-summary-print";

const loans = [
  { id: "closed", loanDate: "2024-04-01", status: "closed", principalAmount: 10000, metalType: "gold", weight: "100.123" },
  { id: "gold", loanDate: "2025-04-01", status: "active", principalAmount: 5000, metalType: "gold", weight: "1.111" },
  { id: "silver", loanDate: "2026-04-01", status: "active", principalAmount: 2000, metalType: "silver", weight: "2.222" },
  { id: "later", loanDate: "2025-12-01", status: "closed", principalAmount: 9000, metalType: "gold", weight: "9" },
  { id: "future", loanDate: "2027-01-01", status: "active", principalAmount: 999999, metalType: "gold", weight: "999" },
];
const closures = [
  { id: "a", loanId: "closed", closureDate: "2025-05-01", principalPaid: 10000, interestPaid: 100 },
  { id: "b", loanId: "later", closureDate: "2026-05-01", principalPaid: 9000, interestPaid: 200 },
  { id: "future", loanId: "gold", closureDate: "2026-12-01", interestPaid: 9999 },
  { id: "other", loanId: "outside-scope", closureDate: "2026-05-01", interestPaid: 9999 },
];
const today = "2026-10-25";
const range = { from: "2026-04-01", to: "2027-03-31" };

test("today's stock includes only active, nonfuture loans; interest includes older closed loans in FY", () => {
  const position = accountSummaryPosition(loans, closures, today, range);
  assert.deepEqual(position, { activeLoans: 2, activeBalance: 7000, goldWeight: 1.111, silverWeight: 2.222, totalInterest: 200 });
  const lifetime = accountSummaryPosition(loans, closures, today, { from: "2024-04-01", to: today });
  assert.deepEqual(lifetime, { ...position, totalInterest: 300 });
  assert.deepEqual(accountSummaryPosition(loans.concat(loans), closures.concat(closures), today, range), position);
});

test("yearly growth uses same elapsed prior FY, not previous entire-year turnover", () => {
  const rows = accountSummaryYearlyProgress(loans, closures, today);
  assert.deepEqual(rows.map(row => [row.label, row.disbursed, row.interest]), [
    ["2024–25", 10000, 0], ["2025–26", 14000, 100], ["2026–27", 2000, 200],
  ]);
  assert.equal(rows[0].disbursementChange, null);
  assert.equal(rows[1].disbursementChange, 40);
  assert.equal(rows[2].partial, true);
  assert.equal(rows[2].to, today);
  assert.equal(rows[2].previousComparableDisbursed, 5000);
  assert.equal(rows[2].disbursementChange, -60);
  assert.deepEqual(accountSummaryYearlyProgress(loans.concat(loans), closures.concat(closures), today), rows);
});

test("FY progress handles leap day, March/April boundaries, gaps, zero base and empty scope", () => {
  const entries = [
    { ...loans[0], id: "old", loanDate: "2022-04-01", principalAmount: 100 },
    { ...loans[0], id: "new", loanDate: "2024-02-29", principalAmount: 50 },
  ];
  const leap = accountSummaryYearlyProgress(entries, [], "2024-02-29");
  assert.equal(leap.at(-1)?.previousComparableDisbursed, 100);
  assert.equal(leap.at(-1)?.disbursementChange, -50);
  assert.equal(leap[1].partial, true);
  const march = accountSummaryYearlyProgress(entries, [], "2024-03-31");
  assert.equal(march.at(-1)?.partial, false);
  const april = accountSummaryYearlyProgress(entries, [], "2024-04-01");
  assert.equal(april.at(-1)?.label, "2024–25");
  assert.equal(april.at(-1)?.disbursementChange, null);
  const gap = accountSummaryYearlyProgress(entries, [], "2025-10-25");
  assert.equal(gap.find(row => row.year === 2024)?.disbursed, 0);
  assert.equal(gap.at(-1)?.disbursementChange, null);
  assert.deepEqual(accountSummaryYearlyProgress([], closures, today), []);
  assert.deepEqual(accountSummaryPosition([], closures, today, range), {
    activeLoans: 0, activeBalance: 0, goldWeight: 0, silverWeight: 0, totalInterest: 0,
  });
  assert.throws(() => accountSummaryYearlyProgress(entries, [], "invalid"), /तारीख/);
});

test("customer scope does not leak other accounts or closure receipts", () => {
  const scoped = loans.filter(loan => loan.id === "gold");
  assert.deepEqual(accountSummaryPosition(scoped, closures, today, range), {
    activeLoans: 1, activeBalance: 5000, goldWeight: 1.111, silverWeight: 0, totalInterest: 0,
  });
  assert.equal(accountSummaryYearlyProgress(scoped, closures, today).at(-1)?.interest, 0);
});

test("optional current analysis changes neither original print table markup nor its financial values", () => {
  const row = buildAccountSummaryRow("नमुना", loans, closures, "cumulative", "2024-04-01", today, today, range);
  const options = {
    company: "नमुना", title: "सारांश", label: "गट", period: today, scope: "सर्व", interest: "आर्थिक वर्ष",
    notes: "नोंदवलेले व्यवहार", rows: [row], totals: row, showRank: false, includeOverview: false, includeNotes: false,
    overviewHTML: "", overviewMode: "cumulative" as const,
    position: accountSummaryPosition(loans, closures, today, range),
    yearlyProgress: accountSummaryYearlyProgress(loans, closures, today),
  };
  const plain = accountSummaryPrintDocument(options);
  const detailed = accountSummaryPrintDocument({ ...options, includeOverview: true, includeNotes: true });
  assert.equal(plain.slice(plain.indexOf("<table>")), detailed.slice(detailed.indexOf("<table>")));
  assert.doesNotMatch(plain, /<section class="summary-position-print"/);
  assert.match(detailed, /<section class="summary-position-print"/);
  assert.match(detailed, /आर्थिक वर्षनिहाय प्रगती/);
  assert.match(detailed, /1\.11 ग्रॅम/);
  assert.match(detailed, /2\.22 ग्रॅम/);
  assert.doesNotMatch(detailed, /[०-९]/);
  const ranked = accountSummaryPrintDocument({ ...options, includeOverview: true, showRank: true });
  assert.doesNotMatch(ranked, /<section class="summary-position-print"/);
});
