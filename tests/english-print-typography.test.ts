import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { englishFinancialPrintStyle, englishLedgerDocumentCss, englishLedgerPrintCss, financialCanvasSlices } from "../client/src/lib/english-print-typography";
import { getUiLanguage, setUiLanguage } from "../shared/ui-language";

test("financial typography is English-only and never hides content", () => {
  const original = getUiLanguage();
  try {
    setUiLanguage("mr");
    assert.equal(englishFinancialPrintStyle(), "");
    setUiLanguage("en");
    const css = englishFinancialPrintStyle();
    assert(css.includes("9.5pt"));
    assert(css.includes("overflow-wrap: anywhere"));
    assert(!/overflow:\s*hidden|display:\s*none/.test(css));
  } finally { setUiLanguage(original); }
});
test("dense ledgers have readable print sizes for both English language tags", () => {
  assert(englishLedgerDocumentCss.includes("html:lang(en)"));
  assert(englishLedgerDocumentCss.includes("8.5pt"));
  assert(englishLedgerPrintCss.startsWith("@media print"));
  assert(!englishLedgerDocumentCss.includes("width:"));
});
test("legacy ledger injects CSS as text rather than HTML line breaks", () => {
  const source = readFileSync("client/src/pages/reports/cashbook-ledger.tsx", "utf8");
  assert(source.includes("styleSheet.textContent = printStyles"));
  assert(!source.includes("styleSheet.innerText = printStyles"));
});
test("long financial PDFs break between rows, with no missing or duplicated pixels", () => {
  const rows = [[0,90],[90,180],[180,310],[310,420],[420,540],[540,650]];
  const root = {
    getBoundingClientRect: () => ({top:0,width:200}),
    querySelectorAll: () => rows.map(([top,bottom])=>({getBoundingClientRect:()=>({top,bottom})})),
  } as unknown as HTMLElement;
  const slices=financialCanvasSlices(root,200,650);
  assert(slices.length>1);
  assert.equal(slices.reduce((sum,s)=>sum+s.srcH,0),650);
  for(let i=0;i<slices.length;i++){
    const slice=slices[i],end=slice.srcY+slice.srcH;
    assert(slice.srcH<=287);
    assert(!rows.some(([top,bottom])=>top<end&&end<bottom));
    if(i)assert.equal(slice.srcY,slices[i-1].srcY+slices[i-1].srcH);
  }
});
