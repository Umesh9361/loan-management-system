import test from "node:test";
import assert from "node:assert/strict";
import { cashbookNarration, cashbookDescriptionHtml } from "../client/src/lib/cashbook-narration";

const closure = {
  id: "cash-1", tenantId: "tenant-A", loanId: "loan-1",
  category: "loan_repayment", transactionType: "cash_in",
  transactionDate: "2026-11-09", amount: "11200.50",
  narration: "कर्ज बंद - खाते क्र. 621 नमुना ग्राहक (गट) - मुद्दल: ₹10000 + व्याज: ₹1200.50 | hidden",
  loanDate: "2024-06-15",
};

test("date is inline after interest, outside hidden fingerprint, without mutating the record", () => {
  const before = structuredClone(closure);
  const text = cashbookNarration(Object.freeze(closure));
  assert.equal(text, "कर्ज बंद - खाते क्र. 621 नमुना ग्राहक (गट) - मुद्दल: ₹10000 + व्याज: ₹1200.50 · कर्ज दिनांक: 15/06/2024");
  assert(!text.includes("\n"));
  assert.deepEqual(closure, before);
  for (let i = 0; i < 10; i++) assert.equal(cashbookNarration(closure), text);
});

test("both closure categories work, missing/invalid dates keep the entry visible", () => {
  assert.match(cashbookNarration({ ...closure, category: "loan_closure" }), /15\/06\/2024$/);
  for (const loanDate of [null, "", "not-a-date", "2025-02-29", "2026-13-01"]) {
    const text = cashbookNarration({ ...closure, loanDate });
    assert.match(text, /मुद्दल: ₹10000/);
    assert.match(text, /व्याज: ₹1200.50 · कर्ज दिनांक: उपलब्ध नाही$/);
  }
});

test("manual, transfer, disbursement and unrelated income remain unchanged", () => {
  for (const category of ["income", "transfer", "loan_disbursement", null]) {
    assert.equal(cashbookNarration({ ...closure, category }), closure.narration.split(" | ")[0]);
  }
  assert.equal(cashbookNarration({ ...closure, transactionType: "cash_out" }), closure.narration.split(" | ")[0]);
  assert.equal(cashbookNarration({}), "");
});

test("calendar dates use English digits without device timezone conversion", () => {
  assert.match(cashbookNarration({ ...closure, loanDate: "2024-02-29T00:00:00.000Z" }), /29\/02\/2024$/);
});

test("standalone print and PDF descriptions escape user text, retaining the full date", () => {
  const text = cashbookNarration({ ...closure, narration: 'नाव <script> & "ग्राहक"' });
  assert.equal(cashbookDescriptionHtml(text), "नाव &lt;script&gt; &amp; &quot;ग्राहक&quot; · कर्ज दिनांक: 15/06/2024");
});
