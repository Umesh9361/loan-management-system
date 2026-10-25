import test from "node:test";
import assert from "node:assert/strict";
import { applyPledgePrintPatch } from "../client/src/lib/pledge-print-overrides";
import { pledgeFormsDocument } from "../client/src/lib/pledge-forms";
import type { PledgeFormData } from "../shared/pledge-form-editor";

test("print-only photo choices hide either group, remove photo boxes and retain originals for showing again", () => {
  const image = "data:image/png;base64,aGVsbG8=";
  const original: PledgeFormData = { borrowerPhoto: image, collateralPhotos: [image, image],
    collateralPhotoLabels: ["वस्तूचा फोटो 2", "वस्तूचा फोटो 3"] };
  const saved = JSON.stringify(original);
  for (const [borrower, collateral, expected] of [[true, true, 5], [false, true, 2], [true, false, 3], [false, false, 0]] as const) {
    const html = pledgeFormsDocument({ ...original, includeBorrowerPhoto: borrower, includeCollateralPhotos: collateral });
    assert.equal((html.match(/<img /g) || []).length, expected);
    if (!borrower) assert.doesNotMatch(html, /class="pf-photo"/);
    if (!collateral) assert.doesNotMatch(html, /<figcaption>वस्तूचा फोटो/);
  }
  assert.equal(JSON.stringify(original), saved);
  assert.equal((pledgeFormsDocument(original).match(/<img /g) || []).length, 5);
  assert.doesNotMatch(pledgeFormsDocument({ includeBorrowerPhoto: false }), /class="pf-photo"/);
});
test("financial edits affect local form only; receipt total follows principal, interest and fees", () => {
  const original: PledgeFormData = { receiptPrincipal: "25,000", receiptInterest: "500", receiptFees: "50", receiptTotal: "25550" };
  const edited = applyPledgePrintPatch(original, { receiptInterest: "750.25" });
  assert.equal(edited.receiptTotal, "25800.25");
  assert.equal(original.receiptInterest, "500");
  assert.equal(original.receiptTotal, "25550");
  assert.equal(applyPledgePrintPatch(edited, { receiptFees: "" }).receiptTotal, "25750.25");
  assert.equal(applyPledgePrintPatch(edited, { receiptTotal: "26000" }).receiptTotal, "26000");
  assert.equal(applyPledgePrintPatch(edited, { receiptFees: "२०" }).receiptTotal, "25770.25");
  assert.equal(applyPledgePrintPatch(edited, { borrowerName: "बदललेले नाव" }).receiptTotal, edited.receiptTotal);
  const html = pledgeFormsDocument(edited, "receipt");
  assert.match(html, /750.25/);
  assert.match(html, /25,800.25/);
});
