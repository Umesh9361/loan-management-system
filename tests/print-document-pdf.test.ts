import assert from "node:assert/strict";
import { test } from "node:test";
import { pdfPageEnd } from "../client/src/lib/print-document-pdf";

test("PDF keeps complete rows and closing total with signature", () => {
  assert.equal(pdfPageEnd(0, 100, 250, [{ top: 90, bottom: 110 }]), 90);
  assert.equal(pdfPageEnd(90, 100, 250, [{ top: 180, bottom: 220 }]), 180);
  assert.equal(pdfPageEnd(180, 100, 250, [{ top: 180, bottom: 220 }]), 250);
});
test("PDF handles overlapping protected blocks and refuses oversized content", () => {
  assert.equal(pdfPageEnd(0, 100, 250, [{ top: 80, bottom: 120 }, { top: 60, bottom: 90 }]), 60);
  assert.throws(() => pdfPageEnd(0, 100, 250, [{ top: 0, bottom: 120 }]), /A4/);
});
test("fractional adjacent table rows do not appear to overlap after pixel rounding", () => {
  assert.equal(pdfPageEnd(0, 100, 250, [
    { top: 0, bottom: 29.625 }, { top: 29.625, bottom: 60.25 },
    { top: 60.25, bottom: 90.875 }, { top: 90.875, bottom: 121.5 },
  ]), 90.875);
});
