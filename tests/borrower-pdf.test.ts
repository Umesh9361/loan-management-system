import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { borrowerPrintCss, borrowerPdfSlices, BORROWER_PDF_PAGE } from '../client/src/lib/borrower-list-pdf';

const css = (text: string) => ({ type: 1, cssText: text }) as CSSRule;
const media = (query: string, rules: CSSRule[]) => ({
  type: 4, media: { mediaText: query }, cssRules: rules,
}) as unknown as CSSRule;

test('PDF uses all print blocks in source order and omits every screen block', () => {
  const rules = [
    css('td { padding: 1px; }'),
    media('print', [css('td { border-right: 1px solid black; }')]),
    media('screen', [css('td { width: 250px; }')]),
    css('td { color: black; }'),
    media('print', [css('.total-row td { padding-bottom: 10px; }')]),
    media('screen and (max-width: 768px)', [css('.mobile-hide { display: none; }')]),
    media('print', [css('td { height: auto; }')]),
    { type: 6, cssText: '@page { size: A4; }' } as CSSRule,
  ];
  const result = borrowerPrintCss(rules, query => query.trim() === 'all');
  assert.match(result, /border-right: 1px solid black/);
  assert.match(result, /padding-bottom: 10px/);
  assert.match(result, /height: auto/);
  assert.doesNotMatch(result, /250px|display: none|@page/);
  assert(result.indexOf('border-right') < result.indexOf('color: black'));
  assert(result.indexOf('color: black') < result.indexOf('padding-bottom'));
});

test('multi-page PDF keeps every row and total whole, repeats headings and loses no pixels', () => {
  const bottoms = [160, ...Array.from({ length: 69 }, (_, i) => 240 + i * 85), 6240];
  const pages = borrowerPdfSlices(6242, 1490, bottoms, { top: 90, bottom: 160 });
  assert(pages.length > 2);
  assert.equal(pages[0].sourceY, 0);
  assert.equal(pages[0].repeatedHeaderHeight, 0);
  const mmPerPixel = (210 - 5 - 5) / 1490;
  for (const [i, page] of pages.entries()) {
    if (i) {
      assert.equal(page.sourceY, pages[i - 1].sourceY + pages[i - 1].sourceHeight);
      assert.equal(page.repeatedHeaderHeight, 70);
    }
    assert(Number.isInteger(page.sourceY) && Number.isInteger(page.sourceHeight));
    assert((page.sourceHeight + page.repeatedHeaderHeight) * mmPerPixel
      <= 297 - 5 - 5);
    if (i < pages.length - 1) assert(bottoms.includes(page.sourceY + page.sourceHeight));
  }
  assert.equal(pages.reduce((sum, page) => sum + page.sourceHeight, 0), 6242);
  const last = pages.at(-1)!;
  assert(last.sourceY <= bottoms.at(-2)!); // total is on one page, not across two.
});

test('fractional DOM measurements cannot create skipped pixels or blank trailing pages', () => {
  const pages = borrowerPdfSlices(4301, 1490, [130.5, 2050.2, 4100.2, 4300.2], { top: 90, bottom: 131 });
  assert.equal(pages.reduce((n, page) => n + page.sourceHeight, 0), 4301);
  assert(pages.every(page => page.sourceHeight > 0));
});

test('an oversized row fails clearly instead of silently cutting its text', () => {
  assert.throws(() => borrowerPdfSlices(8000, 1490, [100, 8000], { top: 0, bottom: 100 }), /A4/);
});

test('mobile and native print share HTML, grid styling and total padding for all report types', () => {
  const source = readFileSync('client/src/pages/reports/borrower-list.tsx', 'utf8');
  assert.match(source, /createBorrowerListPdf\(reportHTML\)/);
  assert.doesNotMatch(source, /printStartIdx|borrower-mobile-pdf/);
  assert.match(source, /body\[data-report-type\] tr\.total-row > td/);
  assert.match(source, /padding: 8px 4px 10px !important/);
  assert.match(source, /body\[data-report-type="maturity-wise"\] tr\.total-row > td:nth-child\(7\)/);
  assert.equal(BORROWER_PDF_PAGE.width - BORROWER_PDF_PAGE.left - BORROWER_PDF_PAGE.right, 200);
  assert.match(source, /@page \{ size: A4 portrait; margin: 5mm; \}/);
  assert.deepEqual([BORROWER_PDF_PAGE.left, BORROWER_PDF_PAGE.right, BORROWER_PDF_PAGE.top, BORROWER_PDF_PAGE.firstTop, BORROWER_PDF_PAGE.bottom], [5, 5, 5, 5, 5]);
  const helper = readFileSync('client/src/lib/borrower-list-pdf.ts', 'utf8');
  assert.match(helper, /querySelectorAll\('style'\)/);
  assert.match(helper, /doc\.fonts\.ready/);
  assert.match(helper, /image\/png/);
  assert.match(helper, /contentHeight \* scale/);
  assert.match(helper, /y: slice\.sourceY \/ scale, height: slice\.sourceHeight \/ scale/);
  assert.match(helper, /finally\s*\{\s*frame\.remove\(\)/);
  assert.doesNotMatch(helper, /border-(?:left|right): none/);
});
