/** Actual print templates with synthetic values; no app auth or production data. */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { formatWeight, weightGrams } from "../shared/report-weights";
import { build } from "esbuild";

const loadingSource = readFileSync("client/src/pages/reports/loading-report.tsx", "utf8");
const profitSource = readFileSync("client/src/pages/reports/profit-loss.tsx", "utf8");
const balanceSource = readFileSync("client/src/pages/reports/balance-sheet.tsx", "utf8");
function find(source: string, predicate: (node: ts.Node, file: ts.SourceFile) => boolean) {
  const file = ts.createSourceFile("report.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let text = "";
  function visit(node: ts.Node) {
    if (predicate(node, file)) text = node.getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!text) throw Error("Report template not found");
  return text;
}
const loading = find(loadingSource, node => ts.isVariableDeclaration(node) && node.name.getText() === "printHTML");
const profitBuilder = find(profitSource, node => ts.isFunctionDeclaration(node) && node.name?.text === "buildProfitLossHTML");
const profitDocument = find(profitSource, node => ts.isTemplateExpression(node) && node.getText().startsWith("`<!DOCTYPE html>"));
const balanceBuilder = find(balanceSource, node => ts.isFunctionDeclaration(node) && node.name?.text === "buildBalanceSheetHTML");
const balanceDocument = find(balanceSource, node => ts.isTemplateExpression(node) && node.getText().startsWith("`<!DOCTYPE html>"));
const run = (code: string, context: object) => vm.runInNewContext(
  ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
const amount = (value: number) => value.toLocaleString("en-IN");
const plData = {
  income: { interestIncome: 1234567, totalIncome: 1234567, otherIncomeItems: [] },
  expenses: { items: [{ name: "नमुना खर्च", amount: 123456 }], totalExpenses: 123456 },
  netProfit: 1111111, isProfit: true,
};
const balanceSheet = {
  assets: { loansAndAdvances: { total: 900000, loanCount: 100, principalTotal: 900000 },
    cashBalance: 100000, bankAccounts: [], fixedAssets: [], debtors: [], totalAssets: 1000000 },
  liabilities: { capitalAccount: { openingCapital: 900000, capitalAdded: 0, capitalWithdrawn: 0,
    netProfit: 100000, closingCapital: 1000000 }, creditors: [], totalLiabilities: 1000000 },
  isTallied: true, difference: 0,
};
const bundles = new Map<string, string>();
for (const [kind, source, builder] of [["profit", profitSource, profitBuilder], ["balance", balanceSource, balanceBuilder]]) {
  const variable = (name: string) => find(source, node => ts.isVariableDeclaration(node) && node.name.getText() === name);
  const result = await build({
    stdin: { loader: "ts", resolveDir: process.cwd(), contents: `
      import {jsPDF} from 'jspdf';
      const plData=${JSON.stringify(plData)},balanceSheet=${JSON.stringify(balanceSheet)};
      const company={name:'कृत्रिम फायनान्स'},dateFrom='2026-04-01',dateTo='2027-03-31',fyStartDate=dateFrom,asOfDate=dateTo;
      const setIsGeneratingPDF=()=>{};
      ${builder}
      const ${variable("createOffscreenRendered")};
      const ${variable("downloadAsPDF")};
      jsPDF.API.save=function(){window.fixturePDF=this;return this;};
      window.runDirectPDF=downloadAsPDF;` },
    bundle: true, write: false, format: "esm",
  });
  bundles.set(kind, result.outputFiles[0].text);
}
createServer((req, res) => {
  const url = new URL(req.url || "/", "http://fixture");
  const count = url.searchParams.has("long") ? 100 : 5;
  if (url.pathname === "/export.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.end(bundles.get(url.searchParams.get("kind") || "profit"));
    return;
  }
  let html: string;
  if (url.pathname === "/loading") {
    html = run(`${loading}; printHTML;`, {
      summary: { totalLoans: 12345, overloadedCount: 1234, highCount: 123, mediumCount: 456,
        slightCount: 655, suspectCount: 12, totalOverloadAmount: 123456789, goldRateUsed: 10000, avgLTV: 85 },
      silverRateInput: "125", formatWeight, weightGrams, formatCurrency: amount,
      formatDate: () => "25/10/2026",
      printItems: Array.from({ length: count }, (_, i) => ({
        borrowerName: "कृत्रिम कर्जदार लांब नाव आडनाव", accountNumber: i + 600,
        loanDate: "2026-10-25", groupName: "नमुना गट", metalType: i % 2 ? "silver" : "gold",
        weight: "7.083", purityLabel: "82%", interestRate: 1.5, marketValue: 70000,
        totalWithInterest: 65000, standard80Loan: 56000, principalAmount: 60000,
        loadingAmount: 4000, ltvPercent: 85, category: "high", categoryLabel: "उच्च", purityUsed: 82,
      })),
    });
  } else if (url.pathname === "/balance") {
    const body = run(`${balanceBuilder}; buildBalanceSheetHTML(balanceSheet,{name:"कृत्रिम फायनान्स"},"2026-04-01","2027-03-31");`, { balanceSheet });
    html = run(balanceDocument, { html: body });
  } else {
    const body = run(`${profitBuilder}; buildProfitLossHTML(plData,{name:"कृत्रिम फायनान्स"},"2026-04-01","2027-03-31");`, { plData });
    html = run(profitDocument, { html: body });
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (url.searchParams.has("direct")) {
    html = html.replace("</body>", `<script type="module" src="/export.js?kind=${url.pathname === "/balance" ? "balance" : "profit"}"></script></body>`);
  }
  res.end(html);
}).listen(5002, "0.0.0.0", () => console.log("Synthetic loading/profit print templates on 5002"));
