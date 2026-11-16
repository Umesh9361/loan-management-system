// Isolated rendering of the actual pages against synthetic, read-only data.
// Never mounted in the application or used as an authentication bypass.
import express from "express";
import { build } from "esbuild";
import { readFileSync, readdirSync } from "node:fs";
const app = express();
let writes = 0;
app.use("/api", (req, res, next) => {
  if (req.method !== "GET") { writes++; res.status(405).end(); return; }
  next();
});
app.get("/api/fixture-writes", (_req, res) => res.json({ writes }));
app.get("/api/cash-transactions", (req, res) => {
  const mobile = req.headers.referer?.includes("mobile");
  const today = new Date().toISOString().slice(0, 10);
  res.json(Array.from({ length: mobile ? 4 : 28 }, (_, i) => ({
    id: `cash-${i}`, tenantId: "fixture", loanId: `loan-${i}`,
    transactionDate: today, transactionType: "cash_in", amount: "11200.50",
    category: i === 1 ? "income" : "loan_repayment", isSystemGenerated: i !== 1,
    narration: i === 1 ? "मॅन्युअल रोकड जमा" : `कर्ज बंद - खाते क्र. ${621 + i} नमुना दीर्घ ग्राहकाचे नाव आणि आडनाव (नमुना गट) - मुद्दल: ₹10000 + व्याज: ₹1200.50 | hidden`,
    loanDate: i === 2 ? null : "2019-06-15",
  })));
});
app.get("/api/company", (_req, res) => res.json({ name: "नमुना फायनान्स" }));
app.get("/api/cash-balance", (_req, res) => res.json({ openingBalance: 0 }));
app.get("/api/mobile-cashbook/:kind", (_req, res) => res.json({
  openingBalance: 0, totalCashIn: 44802, totalCashOut: 0,
  closingBalance: 44802, currentBalance: 44802, balance: 44802,
}));
app.get("/api/*", (_req, res) => res.json([]));
const result = await build({
  stdin: { contents: `
    import React from 'react';import{createRoot}from'react-dom/client';
    import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
    import Mobile from './client/src/pages/mobile-cashbook';
    import Report from './client/src/pages/reports/cashbook';
    const client=new QueryClient({defaultOptions:{queries:{retry:false,queryFn:async({queryKey})=>{
      const r=await fetch(queryKey[0]);if(!r.ok)throw Error('fixture read failed');return r.json();
    }}}});
    createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}>
      {location.pathname.includes('mobile')?<Mobile/>:<Report/>}
    </QueryClientProvider>);
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "esm", jsx: "automatic",
  plugins: [{ name: "isolate-navigation-and-sync", setup(build) {
    build.onResolve({ filter: /^@\/components\/ui\/(sidebar|mobile-nav)$/ }, args => ({ path: args.path, namespace: "fixture-nav" }));
    build.onLoad({ filter: /.*/, namespace: "fixture-nav" }, () => ({ contents: "export const Sidebar=()=>null;export const MobileNav=()=>null;" }));
    build.onResolve({ filter: /^@\/hooks\/use-real-time-sync$/ }, args => ({ path: args.path, namespace: "fixture-sync" }));
    build.onLoad({ filter: /.*/, namespace: "fixture-sync" }, () => ({ contents: "export const useRealTimeSync=()=>({triggerCompleteSync:()=>{},isEnabled:false});" }));
  } }],
});
app.get("/bundle.js", (_req, res) => res.type("js").send(result.outputFiles[0].text));
app.get("/style.css", (_req, res) => res.type("css").send(readFileSync(`dist/public/assets/${readdirSync("dist/public/assets").find(file => file.endsWith(".css"))}`)));
app.get("*", (_req, res) => res.type("html").send('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>'));
app.listen(5003, "0.0.0.0", () => console.log("Synthetic cashbook fixture on 5003"));
