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
import { lossDocumentFixture } from "./overdue-print-fixtures";
import { ReportPrintActions } from "../client/src/components/report-print-actions";
import { OverdueFineWeight } from "../client/src/components/reports/overdue-fine-weight";
import { readFileSync, readdirSync } from "node:fs";

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
      await downloadPrintDocumentPdf(html,'test.pdf',kind.startsWith('summary')||kind.startsWith('loss-')?undefined:'.pf-page',kind.startsWith('loss-')?'landscape':'portrait');
    }catch(e){window.pdfError=e.message}};
  `, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, write: false, format: "esm",
});
const row = { name: "नमुना ग्राहक", totalLoans: 843, activeLoans: 532, closedLoans: 311, totalAmount: 31115363, closedAmount: 12900500, activeBalance: 18214863, totalInterest: 1530024 };
createServer((req, res) => {
  const url = new URL(req.url!, "http://localhost");
  if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); return; }
  if (url.pathname === "/fixture.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(readFileSync(`dist/public/assets/${readdirSync("dist/public/assets").find(name => name.endsWith(".css"))}`)); return;
  }
  if (url.pathname === "/loss-controls") {
    const pending = url.searchParams.get("pending");
    const actions = renderToStaticMarkup(React.createElement(ReportPrintActions, {
      pending: pending === "pdf" || pending === "print" ? pending : null, onPdf: () => {}, onPrint: () => {},
      className: "max-w-md [&>button]:rounded-lg [&>button]:text-sm [&>button]:font-semibold",
    }));
    const fine = renderToStaticMarkup(React.createElement(OverdueFineWeight, { weight: 16 }));
    res.setHeader("Content-Type", "text/html;charset=utf-8");
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><main class="mx-auto max-w-xl space-y-4 p-4"><h1 class="font-bold text-indigo-800">लॉस रिपोर्ट — नमुना</h1><div class="rounded-xl border bg-white p-4"><div class="grid grid-cols-2 gap-4"><div>वजन<strong class="block">20.00</strong></div><div class="text-blue-700">शुद्ध सोने${fine}</div></div></div><div class="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-3 rounded-xl border border-indigo-100 bg-white p-2 sm:flex-row">${actions}</div></main></body></html>`); return;
  }
  if (url.pathname === "/document") {
    const kind = url.searchParams.get("kind") || "compact";
    if (kind.startsWith("loss-")) { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(lossDocumentFixture(kind.slice(5))); return; }
    const summaryRows = Array.from({ length: kind.includes("long") ? 100 : 3 }, (_, index) => ({ ...row, name: `नमुना ${index + 1}` }));
    const mode = kind === "summary-period" ? "period" : "cumulative";
    const progressYearCount = kind.includes("ten") ? 10 : kind.includes("custom") ? 3 : 5;
    const progressFirstYear = kind.includes("ten") ? 2017 : kind.includes("custom") ? 2020 : 2022;
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
        yearlyPeriod: kind.includes("ten") ? "2017–18 ते 2026–27" : kind.includes("custom") ? "2020–21 ते 2022–23" : "2022–23 ते 2026–27",
        yearlyProgress: Array.from({ length: progressYearCount }, (_, i) => ({
          year: progressFirstYear + i,
          label: `${progressFirstYear + i}–${String(progressFirstYear + i + 1).slice(-2)}`,
          from: `${progressFirstYear + i}-04-01`,
          to: !kind.includes("custom") && i === progressYearCount - 1 ? "2026-10-25" : `${progressFirstYear + i + 1}-03-31`,
          partial: !kind.includes("custom") && i === progressYearCount - 1, disbursed: (i + 1) * 1111536, interest: (i + 1) * 110024,
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
