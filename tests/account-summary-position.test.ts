import assert from "node:assert/strict";
import test from "node:test";
import { accountSummaryPosition, accountSummaryYearlyProgress, buildAccountSummaryRow, accountSummaryTotals, createSummaryYearSelections, summaryYearRange } from "../shared/account-summary";
import { formatWeight } from "../shared/report-weights";
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

test("a century-old first loan never expands the default 5-year or selected 10-year comparison", () => {
  const records = [
    { ...loans[0], id: "century", loanDate: "1926-04-01" },
    ...Array.from({ length: 12 }, (_, i) => ({
      ...loans[0], id: `year-${2015 + i}`, loanDate: `${2015 + i}-05-01`, principalAmount: (i + 1) * 1000,
    })),
  ];
  const settings = createSummaryYearSelections(today);
  assert.notStrictEqual(settings.group, settings.customer);
  assert.deepEqual(summaryYearRange(settings.group, today), { fromYear: 2022, toYear: 2026, error: "" });
  const five = accountSummaryYearlyProgress(records, [], today);
  assert.deepEqual(five.map(row => row.year), [2022, 2023, 2024, 2025, 2026]);
  assert.equal(five[0].previousComparableDisbursed, 7000, "baseline before visible window still used");
  assert.ok(Math.abs(five[0].disbursementChange! - (8000 - 7000) / 7000 * 100) < 1e-10);
  const tenRange = summaryYearRange({ ...settings.group, preset: "10" }, today);
  const ten = accountSummaryYearlyProgress(records, [], today, tenRange);
  assert.equal(ten.length, 10);
  assert.equal(ten[0].year, 2017);
  assert.deepEqual(ten.slice(-5), five, "preset changes neither annual figures nor comparison baseline");
  const custom = accountSummaryYearlyProgress(records, [], today, { fromYear: 2020, toYear: 2022 });
  assert.deepEqual(custom.map(row => row.year), [2020, 2021, 2022]);
  assert.equal(custom.at(-1)?.disbursed, five[0].disbursed);
  assert.equal(custom.at(-1)?.disbursementChange, five[0].disbursementChange);
  assert.deepEqual(accountSummaryYearlyProgress(records, [], today, { fromYear: 1900, toYear: 1905 }), []);
  assert.deepEqual(summaryYearRange(createSummaryYearSelections("2026-03-31").group, "2026-03-31"),
    { fromYear: 2021, toYear: 2025, error: "" });
});

test("invalid custom financial-year selection fails explicitly without changing principal or interest scopes", () => {
  for (const [fromYear, toYear] of [[2026, 2025], [2020, 2027], [0, 2025], [2020.5, 2025], [NaN, 2026]]) {
    assert.ok(summaryYearRange({ preset: "custom", fromYear, toYear }, today).error);
    assert.throws(() => accountSummaryYearlyProgress(loans, closures, today, { fromYear, toYear }), /वैध आर्थिक वर्षे/);
  }
  const before = accountSummaryPosition(loans, closures, today, range);
  accountSummaryYearlyProgress(loans, closures, today, { fromYear: 2025, toYear: 2025 });
  assert.deepEqual(accountSummaryPosition(loans, closures, today, range), before);
  assert.equal(accountSummaryYearlyProgress(loans, closures, today, { fromYear: 2025, toYear: 2025 })[0].partial, false);
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

test("summary rows, grand total and today's position use the same active-only gold/silver stock", () => {
  const records = [
    { ...loans[0], id: "ga", groupId: "A", status: "active", weight: "1.111", purity: "75" },
    { ...loans[0], id: "gc", groupId: "B", status: "closed", weight: "2.222", purity: "91.6" },
    { ...loans[0], id: "sa", groupId: null, status: "active", metalType: "silver", weight: "3.333", purity: "99.9" },
    { ...loans[0], id: "sc", groupId: "B", status: "closed", metalType: "silver", weight: "4.444", purity: "80" },
    { ...loans[0], id: "unsecured", groupId: "A", status: "active", loanType: "विनातारण", weight: "100" },
    { ...loans[0], id: "future-active", groupId: "A", status: "active", loanDate: "2027-01-01", weight: "999" },
  ];
  const history = buildAccountSummaryRow("all", records.concat(records), [], "cumulative", "2024-04-01", today, today, range);
  const active = accountSummaryPosition(records.concat(records), [], today, range);
  const closed = buildAccountSummaryRow("closed", records.filter(loan => loan.status === "closed"), [],
    "cumulative", "2024-04-01", today, today, range);
  assert.equal(history.goldWeight, 1.111);
  assert.equal(history.silverWeight, 3.333);
  assert.equal(active.goldWeight, 1.111);
  assert.equal(active.silverWeight, 3.333);
  assert.equal(history.goldWeight, active.goldWeight);
  assert.equal(history.silverWeight, active.silverWeight);
  assert.equal(closed.goldWeight, 0);
  assert.equal(closed.silverWeight, 0);
  assert.equal(closed.totalFineWeight, 0);
  assert.equal(history.goldFineWeight, 1.111 * 75 / 100);
  assert.equal(history.silverFineWeight, 3.333 * 99.9 / 100);
  assert.equal(history.totalLoans, 5, "historical loan count remains unchanged");
  assert.equal(history.totalAmount, 50000, "historical principal remains unchanged");
  assert.notEqual(history.goldWeight, history.goldFineWeight);
  const groups = ["A", "B", null].map(groupId => buildAccountSummaryRow("group",
    records.filter(loan => loan.groupId === groupId), [], "cumulative", "2024-04-01", today, today, range));
  assert.equal(accountSummaryTotals(groups).goldWeight, history.goldWeight);
  assert.equal(accountSummaryTotals(groups).silverWeight, history.silverWeight);
  assert.equal(formatWeight(history.goldWeight), "1.11");
  const period = buildAccountSummaryRow("period", records, [], "period", "2024-04-01", "2025-03-31", today);
  assert.equal(period.goldWeight, active.goldWeight);
  assert.equal(period.silverWeight, active.silverWeight);
  const outsidePeriod = buildAccountSummaryRow("period", records, [], "period", "2026-04-01", today, today);
  assert.equal(outsidePeriod.goldWeight, 0, "period stock only includes active loans originated in that period");
  assert.equal(outsidePeriod.silverWeight, 0);
});

test("optional current analysis changes neither original print table markup nor its financial values", () => {
  const row = buildAccountSummaryRow("नमुना", loans, closures, "cumulative", "2024-04-01", today, today, range);
  const options = {
    company: "नमुना", title: "सारांश", label: "गट", period: today, scope: "सर्व", interest: "आर्थिक वर्ष",
    notes: "नोंदवलेले व्यवहार", rows: [row], totals: row, showRank: false, includeOverview: false, includeNotes: false,
    overviewHTML: "", overviewMode: "cumulative" as const,
    position: accountSummaryPosition(loans, closures, today, range),
    yearlyProgress: accountSummaryYearlyProgress(loans, closures, today),
    yearlyPeriod: "2022–23 ते 2026–27",
  };
  const plain = accountSummaryPrintDocument(options);
  const detailed = accountSummaryPrintDocument({ ...options, includeOverview: true, includeNotes: true });
  assert.equal(plain.slice(plain.indexOf("<table>")), detailed.slice(detailed.indexOf("<table>")));
  assert.doesNotMatch(plain, /<section class="summary-position-print"/);
  assert.match(detailed, /<section class="summary-position-print"/);
  assert.match(detailed, /आर्थिक वर्षनिहाय प्रगती/);
  assert.match(detailed, /तुलनेची आर्थिक वर्षे: 2022–23 ते 2026–27/);
  assert.match(detailed, /1\.11 ग्रॅम/);
  assert.match(detailed, /2\.22 ग्रॅम/);
  assert.doesNotMatch(detailed, /[०-९]/);
  const ranked = accountSummaryPrintDocument({ ...options, includeOverview: true, showRank: true });
  assert.doesNotMatch(ranked, /<section class="summary-position-print"/);
});
