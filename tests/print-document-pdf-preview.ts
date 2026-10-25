// Synthetic-only direct PDF harness. No auth bypass, app routes, or database.
import { createServer } from "node:http";
import { build } from "esbuild";
import { pledgeFormsDocument } from "../client/src/lib/pledge-forms";
import { DEFAULT_PLEDGE_MATTER } from "../shared/pledge-form-editor";
import { accountSummaryPrintDocument } from "../client/src/lib/account-summary-print";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { AccountSummaryOverview } from "../client/src/components/reports/account-summary-overview";

const bundle = await build({
  stdin: { contents: `
    import {downloadPrintDocumentPdf} from './client/src/lib/print-document-pdf';
    import {jsPDF} from 'jspdf';
    jsPDF.API.save=function(){window.pdfResult={pages:this.getNumberOfPages(),data:this.output('datauristring')};return this};
    window.runPdf=async()=>{try{
      const kind=new URLSearchParams(location.search).get('kind')||'compact';
      const html=await (await fetch('/document?kind='+kind)).text();
      await downloadPrintDocumentPdf(html,'test.pdf',kind.startsWith('summary')?undefined:'.pf-page');
    }catch(e){window.pdfError=e.message}};
  `, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, write: false, format: "esm",
});
const row = { name: "नमुना ग्राहक", totalLoans: 10, activeLoans: 6, closedLoans: 4, totalAmount: 100000, closedAmount: 40000, activeBalance: 60000, totalInterest: 3210 };
createServer((req, res) => {
  const url = new URL(req.url!, "http://localhost");
  if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); return; }
  if (url.pathname === "/document") {
    const kind = url.searchParams.get("kind") || "compact";
    res.setHeader("Content-Type", "text/html;charset=utf-8");
    const overviewHTML = renderToStaticMarkup(React.createElement(AccountSummaryOverview, {
      totals: row, mode: "cumulative", periodText: "01/04/2026 ते 25/10/2026",
    }));
    res.end(kind.startsWith("summary") ? accountSummaryPrintDocument({
      company: "नमुना फायनान्स", title: "खाते सारांश", label: "गटाचे नाव",
      rows: Array.from({ length: kind === "summary-long" ? 100 : 3 }, (_, index) => ({ ...row, name: `नमुना ${index + 1}` })),
      totals: row, period: "01/04/2026 ते 25/10/2026", scope: "सर्व", interest: "व्याज",
      notes: "नमुना", overviewHTML, includeOverview: kind === "summary-full", includeNotes: kind === "summary-full",
    }) : pledgeFormsDocument({
      company: "नमुना फायनान्स", companyAddress: "नमुना गाव, महाराष्ट्र", companyContactNumber: "1234567890", companyLicenseNumber: "123",
      borrowerName: "नमुना रामचंद्र पाटील", borrowerAddress: "नमुना गाव, महाराष्ट्र",
      accountNumber: "621", principalAmount: "25000", loanDate: "2026-10-25",
    }, kind === "single" ? ["receipt"] : "all", DEFAULT_PLEDGE_MATTER, kind === "spacious" ? "spacious" : "compact"));
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end('<!doctype html><html><body><h1>Direct A4 PDF test</h1><script type="module" src="/bundle.js"></script></body></html>');
}).listen(5002, "0.0.0.0", () => console.log("Direct A4 PDF fixture on 5002"));
