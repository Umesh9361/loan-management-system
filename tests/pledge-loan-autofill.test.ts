import test from "node:test";
import assert from "node:assert/strict";
import { latestPledgeClosure, mapLoanToPledgeForm, sortPledgeLoanMatches, type PledgeLoanRecord } from "../client/src/lib/pledge-loan-autofill";

const loan: PledgeLoanRecord = {
  id: "loan-a", accountNumber: "621", borrowerName: "नमुना ग्राहक",
  borrowerAddress: "नमुना पत्ता", borrowerMobile: "9000000000",
  principalAmount: "25000", loanDate: "2026-04-05", interestRate: "1.5",
  interestRateType: "monthly", collateralDetails: "अंगठी व साखळी",
  weight: "4.731", purity: "91.6", marketValue: "42000", status: "active",
  hasMaturity: true, maturityDate: "2027-04-05",
};

test("loan autofill copies recorded details without converting weight or inventing transactions", () => {
  const data = mapLoanToPledgeForm(loan);
  assert.equal(data.accountNumber, "621");
  assert.equal(data.borrowerName, loan.borrowerName);
  assert.equal(data.principalAmount, "25000");
  assert.equal(data.loanDate, "2026-04-05");
  assert.equal(data.ratePeriod, "मासिक");
  assert.equal(data.repaymentDate, "2027-04-05");
  assert.deepEqual(data.loanItems, [{ description: "अंगठी व साखळी", weight: "4.731", purity: "91.6", value: "42000" }]);
  for (const key of ["receiptInterest", "receiptTotal", "noticeDate", "finalNoticeDate", "saleDate", "dueInterest", "aadhaarLast4", "printDate"]) {
    assert.equal(data[key as keyof typeof data], undefined);
  }
  assert.equal(mapLoanToPledgeForm({ ...loan, hasMaturity: false }).repaymentDate, "");
});

test("closed loan uses actual received values and only its own current closure", () => {
  const closure = { loanId: loan.id, isClosed: true, closureDate: "2026-10-25", principalPaid: "25000", interestPaid: "2000", totalAmount: "28000", actualPaidAmount: "27000" };
  const data = mapLoanToPledgeForm({ ...loan, status: "closed" }, closure);
  assert.equal(data.receiptPrincipal, "25000");
  assert.equal(data.receiptInterest, "2000");
  assert.equal(data.receiptTotal, "27000");
  assert.equal(data.printDate, "2026-10-25");
  assert.equal(mapLoanToPledgeForm(loan, closure).receiptTotal, undefined);
  assert.equal(mapLoanToPledgeForm({ ...loan, status: "closed" }, { ...closure, loanId: "other" }).receiptTotal, undefined);
  assert.equal(mapLoanToPledgeForm({ ...loan, status: "closed" }, { ...closure, isClosed: false }).receiptTotal, undefined);
  assert.equal(mapLoanToPledgeForm({ ...loan, status: "closed" }, { ...closure, actualPaidAmount: 0 }).receiptTotal, "0");
});

test("exact account ranked first, source records not mutated, same-name accounts remain separate", () => {
  const records = [{ ...loan, id: "other", accountNumber: "1621" }, loan];
  const sorted = sortPledgeLoanMatches(records, " 621 ");
  assert.equal(sorted[0].id, loan.id);
  assert.equal(sorted.length, 2);
  assert.equal(records[0].accountNumber, "1621");
  assert.equal(latestPledgeClosure(loan.id, [
    { loanId: "other", isClosed: true, closureDate: "2026-12-01" },
    { loanId: loan.id, isClosed: false, closureDate: "2026-12-01" },
    { loanId: loan.id, isClosed: true, closureDate: "2026-10-01" },
    { loanId: loan.id, isClosed: true, closureDate: "2026-10-25" },
  ])?.closureDate, "2026-10-25");
});
