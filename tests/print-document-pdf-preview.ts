// Synthetic-only direct PDF harness. No auth bypass, app routes, or database.
import { createServer } from "node:http";
import { build } from "esbuild";
import { pledgeFormsDocument } from "../client/src/lib/pledge-forms";
import { DEFAULT_PLEDGE_MATTER } from "../shared/pledge-form-editor";
import { accountSummaryPrintDocument } from "../client/src/lib/account-summary-print";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { AccountSummaryOverview } from "../client/src/components/reports/account-summary-overview";
import { accountSummaryTotals } from "../shared/account-summary";
import sharp from "sharp";

const samplePhoto = async (width: number, height: number, fill: string) => "data:image/png;base64," +
  (await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f8fafc"/><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 3}" ry="${height / 3}" fill="${fill}"/></svg>`)).png().toBuffer()).toString("base64");
const photoFixture = {
  borrowerPhoto: await samplePhoto(180, 240, "#4f46e5"),
  collateralPhotos: [await samplePhoto(320, 160, "#eab308"), await samplePhoto(180, 180, "#b45309")],
};

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
const row = { name: "नमुना ग्राहक", totalLoans: 843, activeLoans: 532, closedLoans: 311, totalAmount: 31115363, closedAmount: 12900500, activeBalance: 18214863, totalInterest: 1530024 };
createServer((req, res) => {
  const url = new URL(req.url!, "http://localhost");
  if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); return; }
  if (url.pathname === "/document") {
    const kind = url.searchParams.get("kind") || "compact";
    const summaryRows = Array.from({ length: kind.includes("long") ? 100 : 3 }, (_, index) => ({ ...row, name: `नमुना ${index + 1}` }));
    const mode = kind === "summary-period" ? "period" : "cumulative";
    res.setHeader("Content-Type", "text/html;charset=utf-8");
    const overviewHTML = renderToStaticMarkup(React.createElement(AccountSummaryOverview, {
      totals: row, mode: "cumulative", periodText: "01/04/2026 ते 25/10/2026",
    }));
    res.end(kind.startsWith("summary") ? accountSummaryPrintDocument({
      company: "नमुना फायनान्स", title: "खाते सारांश", label: "गटाचे नाव",
      rows: summaryRows,
      totals: accountSummaryTotals(summaryRows), period: "01/04/2026 ते 25/10/2026", scope: "सर्व", interest: "व्याज",
      notes: "नमुना", overviewHTML, overviewMode: mode, includeOverview: kind !== "summary" && kind !== "summary-long", includeNotes: kind.includes("full"),
      ...(kind.includes("position") ? {
        position: { activeLoans: 532, activeBalance: 18214863, goldWeight: 7181.62, silverWeight: 1245, totalInterest: 1530024 },
        yearlyProgress: Array.from({ length: 7 }, (_, i) => ({
          year: 2020 + i, label: `${2020 + i}–${String(2021 + i).slice(-2)}`,
          from: `${2020 + i}-04-01`, to: i === 6 ? "2026-10-25" : `${2021 + i}-03-31`,
          partial: i === 6, disbursed: (i + 1) * 1111536, interest: (i + 1) * 110024,
          loanCount: 100 + i, previousComparableDisbursed: i ? i * 1111536 : null,
          disbursementChange: i ? 15.4 : null,
        })),
      } : {}),
    }) : pledgeFormsDocument({
      company: "नमुना फायनान्स", companyAddress: "नमुना गाव, महाराष्ट्र", companyContactNumber: "1234567890", companyLicenseNumber: "123",
      borrowerName: "नमुना रामचंद्र पाटील", borrowerAddress: "नमुना गाव, महाराष्ट्र",
      accountNumber: "621", principalAmount: "25000", loanDate: "2026-10-25",
      ...(kind.startsWith("photos") ? photoFixture : {}),
    }, kind.endsWith("single") ? ["receipt"] : "all", DEFAULT_PLEDGE_MATTER, kind.includes("spacious") ? "spacious" : "compact"));
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end('<!doctype html><html><body><h1>Direct A4 PDF test</h1><script type="module" src="/bundle.js"></script></body></html>');
}).listen(5002, "0.0.0.0", () => console.log("Direct A4 PDF fixture on 5002"));
