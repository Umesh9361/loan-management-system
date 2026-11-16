import { getUiLanguage } from "@shared/ui-language";
import { pdfPageEnd } from "./print-document-pdf";

/** Keep financial rows and signatures intact when an A4 PDF needs more pages. */
export function financialCanvasSlices(root: HTMLElement, width: number, height: number) {
  const rect = root.getBoundingClientRect();
  const scale = width / rect.width;
  const blocks = Array.from(root.querySelectorAll("tr,p,.financial-print-document > div:last-child")).map(node => {
    const box = node.getBoundingClientRect();
    return { top: (box.top - rect.top) * scale, bottom: (box.bottom - rect.top) * scale };
  });
  const slices: Array<{srcY:number;srcH:number}> = [];
  for (let start = 0; start < height;) {
    const end = pdfPageEnd(start, Math.floor(width * 287 / 200), height, blocks);
    slices.push({srcY:start,srcH:end-start});
    start = end;
  }
  return slices;
}

// Only mounted by the relevant legacy ledger page; never changes packet labels,
// thermal printing, detachable forms, or the Marathi print layout.
export const englishLedgerDocumentCss = `
html:lang(en) body table th, html:lang(en) body table td {
  font-family: Arial, "Noto Sans Devanagari", sans-serif !important;
  font-size: 8.5pt !important;
  line-height: 1.4 !important;
  white-space: normal !important;
  overflow-wrap: anywhere;
  word-break: normal;
}
`;
export const englishLedgerPrintCss = `@media print { ${englishLedgerDocumentCss} }`;

/** Embedded in the same HTML for native print and direct PDF. */
export function englishFinancialPrintStyle(): string {
  if (getUiLanguage() !== "en") return "";
  return `<style>
.financial-print-document { font-family: Arial, "Noto Sans Devanagari", sans-serif !important; }
.financial-print-document th, .financial-print-document td {
  font-size: 9.5pt !important; line-height: 1.45 !important;
  vertical-align: top; overflow-wrap: anywhere; word-break: normal;
}
.financial-print-document p { font-size: 9pt !important; line-height: 1.45; }
.financial-print-document > div:first-child p:first-child { font-size: 14pt !important; }
.financial-print-document > div:first-child p:nth-child(2) { font-size: 12pt !important; }
</style>`;
}
