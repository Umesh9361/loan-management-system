// Isolated fixtures only. Never installed as an application route/auth bypass.
import express from "express";
import { build } from "esbuild";
import { readFileSync, readdirSync } from "node:fs";
import { localizeUiSource } from "../scripts/ui-localization";
const app = express();
const names = ["", "reports/"].flatMap(directory => readdirSync(`client/src/pages/${directory}`)
  .filter(file => file.endsWith(".tsx"))
  .map(file => directory + file.replace(/\.tsx$/, ""))
  .filter(name => !["qr-scan", "reports/capital-print"].includes(name))
  .filter(name => /\bexport\s+default\b/.test(readFileSync(`client/src/pages/${name}.tsx`, "utf8"))));
app.get("/fixture-pages", (_req, res) => res.json(names));
app.get("/api/auth/me", (req, res) => {
  const referer = req.get("referer") || "";
  if (referer.includes("page=login")) return res.status(401).json({ message: "Unauthorized" });
  return res.json({ id: "fixture-user", username: "fixture", tenantId: "fixture", role: referer.includes("super-admin") ? "super_admin" : "admin" });
});
const fixtureLoan = {
  id: "fixture-loan", tenantId: "fixture", borrowerName: "राम पाटील",
  borrowerAddress: "नमुना गाव", borrowerMobile: "", accountNumber: "621",
  groupId: "fixture-group", group: { id: "fixture-group", name: "नमुना गट" },
  loanDate: "2024-06-15", principalAmount: "10000", interestRate: "2",
  interestRateType: "monthly", weight: "20", purity: "80", metalType: "gold",
  collateralDetails: "ठुशी", goldItem: "ठुशी", loanType: "तारण", status: "active",
};
const company = { name: "नमुना फायनान्स", address: "नमुना गाव", tenantId: "fixture", bottomNavEnabled: false };
app.get("/api/company", (_req, res) => res.json(company));
app.get("/api/loans", (_req, res) => res.json([fixtureLoan]));
app.get("/api/loans/search", (_req, res) => res.json({ loans: [fixtureLoan], total: 1, hasMore: false }));
app.get("/api/groups", (_req, res) => res.json([{ id: "fixture-group", name: "नमुना गट" }]));
app.get("/api/cash-transactions", (_req, res) => res.json([{
  id: "cash-1", loanId: "fixture-loan", category: "loan_repayment", transactionType: "cash_in",
  amount: "11200", transactionDate: new Date().toISOString().slice(0, 10), loanDate: "2024-06-15",
  narration: "कर्ज बंद - खाते क्र. 621 राम पाटील (नमुना गट) - मुद्दल: ₹10000 + व्याज: ₹1200",
}]));
app.get("/api/cash-balance", (_req, res) => res.json({ openingBalance: 0 }));
app.get("/api/reports/balance-sheet", (_req, res) => res.json(null));
app.get("/api/reports/profit-loss", (_req, res) => res.json(null));
app.get("/api/mobile-cashbook/:kind", (_req, res) => res.json({ openingBalance: 0, closingBalance: 11200, currentBalance: 11200, totalCashIn: 11200, totalCashOut: 0 }));
app.get("/api/*", (_req, res) => res.json([]));
const bundle = await build({
  stdin: { contents: `
    import React from 'react';import{createRoot}from'react-dom/client';
    import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
    import{I18nProvider}from'./client/src/providers/I18nProvider';
    import{pledgeFormsDocument}from'./client/src/lib/pledge-forms';
    import{downloadPrintDocumentPdf}from'./client/src/lib/print-document-pdf';
    import{defaultPledgeMatter}from'./shared/pledge-form-editor';
    import{defaultNoticeMatter,renderNoticeContent}from'./shared/notice-matter';
    import{lossDocumentFixture}from'./tests/overdue-print-fixtures';
    import{setUiLanguage,getUiLanguage}from'./shared/ui-language';
    ${names.map((name, index) => `import Page${index} from './client/src/pages/${name}';`).join("\n")}
    const pages={${names.map((name, index) => `${JSON.stringify(name)}:Page${index}`).join(",")}};
    const client=new QueryClient({defaultOptions:{queries:{retry:false,queryFn:async({queryKey})=>{
      const r=await fetch(queryKey[0]);if(!r.ok)throw Error('fixture');return r.json();
    }}}});
    window.localeTools={pledgeFormsDocument,defaultPledgeMatter,defaultNoticeMatter,renderNoticeContent,downloadPrintDocumentPdf,lossDocumentFixture};
    const Page=pages[new URLSearchParams(location.search).get('page')||'login'];
    class Boundary extends React.Component {
      state={error:null};
      static getDerivedStateFromError(error){return{error:String(error)}}
      render(){return this.state.error?<div data-fixture-error>{this.state.error}</div>:this.props.children}
    }
    createRoot(document.getElementById('root')).render(<Boundary><QueryClientProvider client={client}><I18nProvider><Page/></I18nProvider></QueryClientProvider></Boundary>);
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "esm", jsx: "automatic",
  plugins: [{ name: "source-ui-and-fixture-context", setup(build) {
    build.onResolve({ filter: /^@\/components\/ui\/(sidebar|mobile-nav)$/ }, args => ({ path: args.path, namespace: "fixture-nav" }));
    build.onLoad({ filter: /.*/, namespace: "fixture-nav" }, () => ({ contents: "export const Sidebar=()=>null;export const MobileNav=()=>null;" }));
    build.onResolve({ filter: /^@\/hooks\/use-current-user$/ }, args => ({ path: args.path, namespace: "fixture-user" }));
    build.onLoad({ filter: /.*/, namespace: "fixture-user" }, () => ({ contents: "export const useCurrentUser=()=>({user:{id:'fixture-user',tenantId:'fixture',role:'admin'},isLoading:false});" }));
    build.onResolve({ filter: /^@\/hooks\/use-real-time-sync$/ }, args => ({ path: args.path, namespace: "fixture-sync" }));
    build.onLoad({ filter: /.*/, namespace: "fixture-sync" }, () => ({ contents: "export const useRealTimeSync=()=>({triggerCompleteSync:()=>{},isEnabled:false});" }));
    build.onLoad({ filter: /\/(?:client\/src\/.*\.(ts|tsx)|shared\/account-summary(?:-format)?\.ts)$/ }, args => ({
      contents: localizeUiSource(readFileSync(args.path, "utf8"), args.path),
      loader: args.path.endsWith("tsx") ? "tsx" : "ts",
    }));
  } }],
});
app.get("/bundle.js", (_req, res) => res.type("js").send(bundle.outputFiles[0].text));
app.get("/style.css", (_req, res) => res.type("css").send(readFileSync(`dist/public/assets/${readdirSync("dist/public/assets").find(file => file.endsWith(".css"))}`)));
app.use(express.static("dist/public", { index: false }));
app.get("*", (_req, res) => res.type("html").send('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><script>localStorage.setItem("language",new URLSearchParams(location.search).get("language")==="en"?"en":"mr")</script></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>'));
app.listen(5003, "0.0.0.0", () => console.log("Isolated bilingual fixtures on 5003"));
