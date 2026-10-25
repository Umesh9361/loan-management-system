// Synthetic, isolated page harness: never accesses application auth or customer data.
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { build } from "esbuild";
import { createSummaryRanges, localISODate } from "../shared/account-summary";

const fy = createSummaryRanges(localISODate()).group.period.from!;
const year = Number(fy.slice(0, 4));
const oldDate = `${year - 1}-02-01`;
const loans = [
  ["old", "A", oldDate, 10000, "closed"],
  ["new", "A", fy, 5000, "active"],
  ["closed1", "B", fy, 3000, "closed"],
  ["closed2", "B", fy, 4000, "closed"],
  ["ungrouped", null, oldDate, 2000, "active"],
  ["legacy", null, oldDate, 1000, "closed"],
].map(([id, groupId, loanDate, principalAmount, status], index) => ({
  id, groupId, loanDate, principalAmount, status, tenantId: "fixture",
  borrowerName: `नमुना ग्राहक ${index + 1}`, accountNumber: String(index + 1),
  weight: "1.25", purity: "82", metalType: index === 4 ? "silver" : "gold", loanType: "तारण",
}));
const closures = [
  ["old", fy, 10000, 1200], ["closed1", fy, 3000, 300],
  ["closed2", fy, 4000, 0], ["legacy", oldDate, 1000, 100],
].map(([loanId, closureDate, principalPaid, interestPaid], index) => ({
  id: `closure-${index}`, loanId, closureDate, principalPaid, interestPaid,
}));
const result = await build({
  stdin: { contents: `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import Page from './client/src/pages/reports/account-summary';
    const client=new QueryClient({defaultOptions:{queries:{retry:false,queryFn:async({queryKey})=>{
      const r=await fetch(queryKey[0]+(location.search.includes('century')?'?history=century':''));if(!r.ok)throw Error('Fixture request failed');return r.json();
    }}}});
    createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><Page/></QueryClientProvider>);
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "esm", jsx: "automatic",
  plugins: [{ name: "fixture-navigation", setup(build) {
    build.onResolve({ filter: /^@\/components\/ui\/(sidebar|mobile-nav)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const Sidebar=()=>null;export const MobileNav=()=>null;", loader: "js" }));
  } }],
});
createServer((req, res) => {
  const url = new URL(req.url!, "http://fixture");
  const path = url.pathname;
  const data: Record<string, unknown> = {
    "/api/company": { name: "नमुना फायनान्स" },
    "/api/groups": [{ id: "A", name: "गट A" }, { id: "B", name: "गट B" }],
    "/api/loans": url.searchParams.get("history") === "century"
      ? [...loans, { ...loans[0], id: "century", loanDate: `${year - 100}-04-01`, principalAmount: 0, weight: "0", status: "closed" }]
      : loans,
    "/api/loan-closures": closures,
    "/api/borrowers/autocomplete": loans.map(loan => ({ borrowerName: loan.borrowerName })),
  };
  if (path in data) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data[path])); return; }
  if (path === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(result.outputFiles[0].text); return; }
  if (path === "/style.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(readFileSync(`dist/public/assets/${readdirSync("dist/public/assets").find(file => file.endsWith(".css"))}`)); return;
  }
  res.setHeader("Content-Type", "text/html;charset=utf-8");
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
}).listen(5001, "0.0.0.0", () => console.log("Synthetic account summary page on 5001"));
