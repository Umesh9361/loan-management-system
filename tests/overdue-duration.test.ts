import test from "node:test";
import assert from "node:assert/strict";
import { overdueDurationParts } from "../client/src/lib/overdue-duration";
import { LoanCalculationsAdvanced } from "../client/src/lib/loan-calculations";

const elapsed = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const duration = (from: string, to: string) => overdueDurationParts({ loanDate: from, daysOverdue: elapsed(from, to) });

test("under twelve calendar months displays months and days, without converting days into thirty-day months", () => {
  assert.deepEqual(duration("2026-04-09", "2026-11-14"), ["7 महिने", "5 दिवस"]);
  assert.deepEqual(duration("2026-01-01", "2026-12-31"), ["11 महिने", "30 दिवस"]);
  assert.deepEqual(duration("2026-01-15", "2026-02-15"), ["1 महिना"]);
  assert.deepEqual(duration("2026-01-15", "2026-01-20"), ["5 दिवस"]);
  assert.deepEqual(duration("2026-01-15", "2026-01-15"), ["0 दिवस"]);
});
test("twelve months or more displays completed years and months, without zero fields", () => {
  assert.deepEqual(duration("2025-01-15", "2026-01-15"), ["1 वर्ष"]);
  assert.deepEqual(duration("2024-01-15", "2026-04-20"), ["2 वर्षे", "3 महिने"]);
});
test("month ends and leap dates use the closure form's exact calendar breakdown", () => {
  for (const [from, to] of [["2026-01-31", "2026-03-01"], ["2024-02-29", "2025-02-28"], ["2024-02-29", "2025-03-01"]]) {
    const reference = LoanCalculationsAdvanced.calculateTimePeriod(new Date(`${from}T12:00:00`), new Date(`${to}T12:00:00`));
    const monthPart = `${reference.calendarMonths} ${reference.calendarMonths === 1 ? "महिना" : "महिने"}`;
    const expected = reference.calendarYears > 0
      ? [`${reference.calendarYears} ${reference.calendarYears === 1 ? "वर्ष" : "वर्षे"}`, ...(reference.calendarMonths ? [monthPart] : [])]
      : [...(reference.calendarMonths ? [monthPart] : []), ...(reference.calendarDays ? [`${reference.calendarDays} दिवस`] : [])];
    assert.deepEqual(duration(from, to), expected);
  }
});
test("API elapsed days, not print date or search dates, determine current and projected periods", () => {
  assert.deepEqual(overdueDurationParts({ loanDate: "2026-04-09T00:00:00.000Z", daysOverdue: 219 }), ["7 महिने", "5 दिवस"]);
  assert.deepEqual(overdueDurationParts({ loanDate: "2026-04-09", daysOverdue: elapsed("2026-04-09", "2027-02-14") }), ["10 महिने", "5 दिवस"]);
});
test("invalid dates and impossible elapsed days fail explicitly", () => {
  for (const input of [{ loanDate: "bad", daysOverdue: 1 }, { loanDate: "2026-02-31", daysOverdue: 1 }, { loanDate: "2026-01-01", daysOverdue: -1 }, { loanDate: "2026-01-01", daysOverdue: NaN }]) {
    assert.throws(() => overdueDurationParts(input), /अवैध/);
  }
});
