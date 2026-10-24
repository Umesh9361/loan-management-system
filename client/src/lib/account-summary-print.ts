import { accountSummaryPrintRows, escapeSummaryHtml } from "../../../shared/account-summary";
import type { SummaryRow } from "../../../shared/account-summary";

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
@page { size: A4 portrait; margin: 10mm 8mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font: 10px/1.5 'Noto Sans Devanagari', Arial, sans-serif; color: #241d3f; }
.summary-document-header { border-bottom: 2px solid #7050ca; padding-bottom: 7px; margin-bottom: 10px; text-align: center; }
.summary-document-header h1 { font-size: 16px; margin: 0 0 2px; }
.summary-document-header h2 { font-size: 12px; margin: 0 0 3px; }
.summary-document-header p { margin: 2px 0; font-size: 9px; overflow-wrap: anywhere; }
.summary-document-notes { font-size: 9px; margin: 8px 0; color: #514964; }
table { width: 100%; table-layout: fixed; border-collapse: collapse; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { border: 1px solid #81758f; padding: 6px 3px 7px; text-align: center; font-size: 10px; overflow-wrap: anywhere; vertical-align: middle; }
th { background: #f0ebfa; font-weight: 700; }
td:first-child { text-align: left; }
.total-row td { background: #ece5fb; font-weight: 700; border-top: 2px solid #7050ca; }
.summary-document-closing { break-inside: avoid; page-break-inside: avoid; }
.summary-document-signature td { border: 0; padding: 14px 0 0; text-align: right; font-size: 10px; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>
<header class="summary-document-header">
<h1>${safe(options.company)}</h1><h2>${safe(options.title)}</h2>
<p>${safe(options.period)} · ${safe(options.scope)}</p>
<p>${safe(options.interest)}</p>
</header>
${options.includeOverview ? options.overviewHTML : ""}
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
  Object.assign(iframe.style, { position: "fixed", left: "-10000px", top: "0", width: "794px", height: "1123px", border: "0" });
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
