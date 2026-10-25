import { accountSummaryPrintRows, escapeSummaryHtml } from "../../../shared/account-summary";
import type { SummaryRow } from "../../../shared/account-summary";
import { englishSummaryDigits } from "../../../shared/account-summary-format";
import {
  accountSummaryPrintOverview,
  accountSummaryPrintOverviewStyles,
} from "./account-summary-print-overview";

export type SummaryPrintOptions = {
  company: string;
  title: string;
  period: string;
  scope: string;
  interest: string;
  notes: string;
  label: string;
  rows: SummaryRow[];
  totals: Parameters<typeof accountSummaryPrintRows>[1];
  showRank: boolean;
  includeOverview: boolean;
  includeNotes: boolean;
  overviewHTML: string;
  overviewMode?: "cumulative" | "period";
};

/** One document for desktop print and Android's Save as PDF. */
export function accountSummaryPrintDocument(options: SummaryPrintOptions) {
  const { showRank, rows, totals } = options;
  const safe = escapeSummaryHtml;
  const widths = showRank ? [4, 18, 7, 7, 6, 15, 14, 15, 14] : [20, 8, 8, 7, 16, 14, 14, 13];
  const tableRows = accountSummaryPrintRows(rows, totals, showRank);
  const totalStart = tableRows.lastIndexOf('<tr class="total-row">');
  return `<!doctype html><html lang="mr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safe(options.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4 portrait; margin: 5mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { width: 200mm; max-width: 200mm; margin: 5mm auto; }
@media print { body { margin: 0; } }
body { font: 10px/1.5 'Noto Sans Devanagari', sans-serif; color: #282744; }
.summary-document-header { border-bottom: 2px solid #5147b8; padding: 0 0 2mm; margin-bottom: 3mm; text-align: center; break-inside: avoid; page-break-inside: avoid; }
.summary-document-header h1 { font-size: 14pt; line-height: 1.35; margin: 0 0 1mm; overflow-wrap: anywhere; }
.summary-document-header h2 { font-size: 11pt; margin: 0 0 1mm; }
.summary-document-header p { margin: 1mm 0 0; font-size: 8.5pt; line-height: 1.35; overflow-wrap: anywhere; }
.summary-document-notes { font-size: 8.5pt; margin: 2mm 0; color: #4f4e62; overflow-wrap: anywhere; }
table { width: 100%; table-layout: fixed; border-collapse: collapse; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { border: 1px solid #aaa9bd; padding: 2mm 1mm; text-align: center; font-size: 8.5pt; line-height: 1.35; overflow-wrap: anywhere; vertical-align: middle; }
th { background: #eeedf8; color: #343252; font-weight: 700; }
td:first-child { text-align: left; }
.total-row td { background: #eeedf8; font-weight: 700; border-top: 2px solid #5147b8; }
.summary-document-closing { break-inside: avoid; page-break-inside: avoid; }
.summary-document-signature td { border: 0; padding: 14px 15mm 0 0; text-align: right; font-size: 9pt; }
${accountSummaryPrintOverviewStyles}
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>
<header class="summary-document-header">
<h1>${safe(options.company)}</h1><h2>${safe(options.title)}</h2>
<p>${safe(englishSummaryDigits(options.period))} · ${safe(englishSummaryDigits(options.scope))}</p>
<p>${safe(englishSummaryDigits(options.interest))}</p>
</header>
${options.includeOverview && !showRank ? accountSummaryPrintOverview(totals, options.overviewMode ?? "cumulative") : ""}
${options.includeNotes ? `<p class="summary-document-notes">${safe(options.notes)}</p>` : ""}
<table><colgroup>${widths.map(width => `<col style="width:${width}%">`).join("")}</colgroup>
<thead><tr>${showRank ? "<th>#</th>" : ""}<th>${safe(options.label)}</th><th>एकूण कर्ज</th><th>सक्रिय</th><th>बंद</th><th>एकूण वाटप</th><th>बंद रक्कम</th><th>सक्रिय शिल्लक</th><th>एकूण व्याज</th></tr></thead>
<tbody>${tableRows.slice(0, totalStart)}</tbody>
<tbody class="summary-document-closing">${tableRows.slice(totalStart)}
<tr class="summary-document-signature"><td colspan="${widths.length}">सावकाराची सही</td></tr></tbody></table>
</body></html>`;
}

export async function printAccountSummary(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", left: "-10000px", top: "0", width: "210mm", height: "297mm", border: "0" });
  const remove = () => iframe.remove();
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("प्रिंट तयार होण्यास वेळ लागत आहे. पुन्हा प्रयत्न करा.")), 30000);
      iframe.onload = () => { clearTimeout(timeout); resolve(); };
      iframe.srcdoc = html;
      document.body.appendChild(iframe);
    });
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) throw new Error("प्रिंट उघडता आली नाही.");
    await Promise.all([400, 600, 700].map(weight => doc.fonts.load(`${weight} 12px "Noto Sans Devanagari"`)));
    await doc.fonts.ready;
    // Wait until loaded fonts have been laid out before opening Android print.
    await new Promise<void>(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve())));
    win.addEventListener("afterprint", remove, { once: true });
    win.focus();
    win.print();
    // Retain the source while mobile print preview is open, including PDF saving.
    window.setTimeout(remove, 10 * 60 * 1000);
  } catch (error) {
    remove();
    throw error;
  }
}
