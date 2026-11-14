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

test("screen fine-weight display is unchanged, while PDF shows numeric fine grams without units or percentage", () => {
  const fine = 20 * (80 / 100);
  const cell = renderToStaticMarkup(React.createElement(OverdueFineWeight, { weight: fine, purity: 80 }));
  assert.match(cell, />16\.00 ग्रॅम<\/span>/);
  assert.ok(cell.includes("(80%)"), "existing screen percentage remains untouched");
  const row = { ...sevenLossRows[0], goldWeight: 20, fineGoldWeight: fine, purityUsed: 80 };
  const html = overduePrintDocument({ ...lossPrintFixture(), rows: [row] });
  assert.match(html, /<th>शुद्ध वजन<\/th>/);
  assert.match(html, /class="weight fine-weight"><strong>16\.00<\/strong>/);
  assert.match(html, /<td class="weight">20\.00<\/td>/);
  assert.ok(!html.includes("80%") && !html.includes("धातू व वजन"));
  assert.equal(overdueMetalWeightTotals([row]).gold.fine, 16);
  const unknown = renderToStaticMarkup(React.createElement(OverdueFineWeight, { weight: NaN }));
  assert.ok(unknown.includes("—") && !unknown.includes("NaN"));
});

test("standalone landscape loss document includes every visible detail, original values and readable textual risk", () => {
  const options = lossPrintFixture();
  const before = JSON.stringify(options);
  const html = overduePrintDocument(options);
  for (const value of ["नमुना फायनान्स", "महाराष्ट्र", "लॉस रिपोर्ट", "15/11/2026", "नमुना ग्राहक 1", "+1 202-555-0143", "बोरमाळ 30 मणी", "नमुना गट", "09-04-2026", "₹45,000", "₹6,304", "₹51,304", "4.50", "3.69", "₹49,915", "₹1,389", "7 महिने", "5 दिवस", "कमी सुरक्षित"]) assert.ok(html.includes(value), value);
  assert.match(html, /@page\s*{\s*size: A4 landscape/);
  assert.equal((html.match(/class="borrower-name"/g) || []).length, 7);
  assert.ok(!html.includes("fixture-"), "internal identifiers are not printed");
  assert.equal(JSON.stringify(options), before, "export never alters financial data");
  assert.match(html, /font: 9pt\/1\.55/);
  assert.ok(!html.includes("✓"), "risk must remain understandable without colored checkmarks");
});
test("collateral market values show whole rupees without altering source figures or exact loss sums", () => {
  const options = { ...lossPrintFixture(), rows: [{ ...sevenLossRows[0], currentGoldValue: 49914.63, lossAmount: 1389.37 }] };
  const before = JSON.stringify(options);
  const html = overduePrintDocument(options);
  assert.match(html, /<td class="money">₹49,915<\/td>/);
  assert.match(html, /तारणाचे बाजारमूल्य: ₹49,915/);
  assert.ok(!html.includes("₹49,914.63") && !html.includes("₹49,915.00"));
  assert.ok(html.includes("₹1,389.37"), "do not change other exact amounts when formatting collateral");
  assert.equal(JSON.stringify(options), before, "presentation never changes financial source values");
  for (const match of Array.from(html.matchAll(/<colgroup>(.*?)<\/colgroup>/g))) {
    const widths = Array.from(match[1].matchAll(/width:(\d+)%/g), value => Number(value[1]));
    assert.equal(widths.reduce((a, b) => a + b), 100);
    assert.ok(widths[1] >= 24 && widths[2] >= 9, "give names and groups more room");
    if (widths.length === 12) assert.ok(widths[6] === 5 && widths[7] === 5 && widths[10] === 7 && widths[11] === 6);
  }
});
test("gold and silver remain separate, fine weights use the same shared calculation and unsecured has no pretend collateral", () => {
  const options = lossPrintFixture("mixed");
  const html = overduePrintDocument(options);
  const weights = overdueMetalWeightTotals(options.rows);
  for (const [label, amount] of [["सोने वजन:", weights.gold.gross], ["शुद्ध सोने:", weights.gold.fine], ["चांदी वजन:", weights.silver.gross], ["शुद्ध चांदी:", weights.silver.fine]] as const) {
    assert.ok(html.includes(`${label} ${formatWeight(amount)}</span>`));
  }
  assert.match(html, /विनातारण कर्जे/);
  assert.equal((html.match(/<th>कालावधी<\/th>/g) || []).length, 2, "both secured and unsecured tables show calendar periods");
  assert.ok(!html.includes("<th>दिवस</th>"));
  assert.ok(html.indexOf("एकूण धातू वजन (ग्रॅम)") > html.indexOf("विनातारण कर्जे"));
  assert.equal((html.match(/एकूण धातू वजन \(ग्रॅम\)/g) || []).length, 1);
  const unsecured = overduePrintDocument({ ...options, rows: [unsecuredLossRow] });
  assert.ok(!unsecured.includes('<td class="weight">'));
  assert.ok(!unsecured.includes("तारण बाजारमूल्य</th>"));
  assert.ok(!unsecured.includes("सोने वजन:"));
});
test("absent or whitespace-only phone adds no empty line, long descriptions remain complete and money has no artificial .00", () => {
  const description = "अंगठी बांगडी आणि जुनी सोन्याची बोरमाळ ".repeat(5);
  for (const borrowerPhone of [undefined, "", "   ", "N/A", " n/a ", "N.A.", "NA", "-", "—", "null", "undefined", "0", "0000000000"]) {
    const html = overduePrintDocument({ ...lossPrintFixture(), rows: [{ ...sevenLossRows[0], borrowerPhone, goldItem: description }] });
    assert.ok(!html.includes("फोन:"));
    assert.ok(html.includes(description.trim()));
    assert.ok(html.includes("₹45,000") && !html.includes("₹45,000.00"));
    assert.match(html, /white-space: pre-line/);
    assert.match(html, /height: auto/);
  }
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
  assert.ok(!source.includes("OverdueMetalTotals"), "no duplicate metal summary is added to the main view");
  assert.match(source, /purity={item\.purityUsed}/, "existing view details are preserved");
});
