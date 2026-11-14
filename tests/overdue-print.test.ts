import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { overduePrintDocument } from "../client/src/lib/overdue-print";
import { lossPrintFixture, sevenLossRows, unsecuredLossRow, silverLossRow } from "./overdue-print-fixtures";
import { overdueMetalWeightTotals } from "../shared/overdue-weights";
import { formatWeight } from "../shared/report-weights";
import { printPdfLayout } from "../client/src/lib/print-document-pdf";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OverdueFineWeight } from "../client/src/components/reports/overdue-fine-weight";

test("20 gross grams at 80% shows 16 fine grams prominently in mobile/table and PDF, with percent only as context", () => {
  const fine = 20 * (80 / 100);
  const cell = renderToStaticMarkup(React.createElement(OverdueFineWeight, { weight: fine, purity: 80 }));
  assert.match(cell, /16\.00 ग्रॅम/);
  assert.match(cell, /\(80%\)/);
  assert.ok(!cell.includes("20.00 ग्रॅम"));
  const row = { ...sevenLossRows[0], goldWeight: 20, fineGoldWeight: fine, purityUsed: 80 };
  const html = overduePrintDocument({ ...lossPrintFixture(), rows: [row] });
  assert.match(html, /<th>शुद्ध वजन<\/th>/);
  assert.match(html, /class="weight fine-weight"><strong>16\.00 ग्रॅम<\/strong>/);
  assert.match(html, /सोने \(80%\)/);
  assert.equal(overdueMetalWeightTotals([row]).gold.fine, 16);
  const unknown = renderToStaticMarkup(React.createElement(OverdueFineWeight, { weight: NaN }));
  assert.ok(unknown.includes("—") && !unknown.includes("NaN"));
});

test("standalone landscape loss document includes every visible detail, original values and readable textual risk", () => {
  const options = lossPrintFixture();
  const before = JSON.stringify(options);
  const html = overduePrintDocument(options);
  for (const value of ["नमुना फायनान्स", "महाराष्ट्र", "लॉस रिपोर्ट", "15/11/2026", "नमुना ग्राहक 1", "0000000000", "बोरमाळ 30 मणी", "नमुना गट", "09-04-2026", "₹45,000", "₹6,304", "₹51,304", "4.50", "82%", "₹49,915", "₹1,389", "219", "कमी सुरक्षित"]) assert.ok(html.includes(value), value);
  assert.match(html, /@page\s*{\s*size: A4 landscape/);
  assert.equal((html.match(/class="borrower-name"/g) || []).length, 7);
  assert.ok(!html.includes("fixture-"), "internal identifiers are not printed");
  assert.equal(JSON.stringify(options), before, "export never alters financial data");
  assert.match(html, /font: 9pt\/1\.55/);
  assert.ok(!html.includes("✓"), "risk must remain understandable without colored checkmarks");
});
test("gold and silver remain separate, fine weights use the same shared calculation and unsecured has no pretend collateral", () => {
  const options = lossPrintFixture("mixed");
  const html = overduePrintDocument(options);
  const weights = overdueMetalWeightTotals(options.rows);
  for (const [label, amount] of [["सोने वजन:", weights.gold.gross], ["शुद्ध सोने:", weights.gold.fine], ["चांदी वजन:", weights.silver.gross], ["शुद्ध चांदी:", weights.silver.fine]] as const) {
    assert.ok(html.includes(`${label} ${formatWeight(amount)} ग्रॅम`));
  }
  assert.match(html, /विनातारण कर्जे/);
  const unsecured = overduePrintDocument({ ...options, rows: [unsecuredLossRow] });
  assert.ok(!unsecured.includes('<td class="weight">'));
  assert.ok(!unsecured.includes("तारण बाजारमूल्य</th>"));
  assert.ok(!unsecured.includes("सोने वजन:"));
});
test("selection contains exactly passed rows and escaped text cannot hide or execute borrower names", () => {
  const subset = overduePrintDocument({ ...lossPrintFixture(), rows: [silverLossRow] });
  assert.ok(subset.includes("नमुना चांदी खाते") && !subset.includes("नमुना ग्राहक 1"));
  const hostile = overduePrintDocument({
    ...lossPrintFixture(), company: "<script>alert(1)</script>",
    rows: [{ ...sevenLossRows[0], borrowerName: '<img src=x onerror="alert(1)">', goldItem: "अंगठी & माळ" }],
  });
  assert.ok(!hostile.includes("<script>") && !hostile.includes("<img"));
  assert.ok(hostile.includes("&lt;img") && hostile.includes("अंगठी &amp; माळ"));
  assert.match(overduePrintDocument(lossPrintFixture("empty")), /कोणतीही थकीत कर्जे उपलब्ध नाहीत/);
  assert.match(overduePrintDocument(lossPrintFixture("future")), /पुढील 3 महिने/);
  assert.throws(() => overduePrintDocument({ ...lossPrintFixture(), rows: [{ ...sevenLossRows[0], totalAmount: NaN }] }), /अवैध/);
});
test("A4 portrait defaults stay identical and optional landscape exchanges only the two axes", () => {
  assert.deepEqual(printPdfLayout(), { orientation: "portrait", pageWidth: 210, pageHeight: 297, contentWidth: 200, contentHeight: 287 });
  assert.deepEqual(printPdfLayout("landscape"), { orientation: "landscape", pageWidth: 297, pageHeight: 210, contentWidth: 287, contentHeight: 200 });
});
test("page exports currently filtered sorted rows with one busy action and never prints app HTML directly", () => {
  const source = readFileSync("client/src/pages/reports/overdue.tsx", "utf8");
  assert.match(source, /rows: sortedOverdueData\.map/);
  assert.match(source, /securityLabel: getSecurityLevel\(item\)\.label/);
  assert.match(source, /ReportPrintActions pending={pendingPrintAction}/);
  assert.match(source, /undefined, "landscape"/);
  assert.ok(!source.includes("onClick={() => window.print()}"));
});
