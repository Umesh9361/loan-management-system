/**
 * Temporary synthetic-only visual/interaction harness, no application auth or database.
 * Run: node --import tsx tests/pledge-forms-preview.ts
 */
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { build } from "esbuild";
import { pledgeFormsDocument } from "../client/src/lib/pledge-forms";
import { DEFAULT_PLEDGE_MATTER, PLEDGE_FIELD_GROUPS, pledgeDefaultsRequestSchema, getPledgeOrganization, type PledgeFormMatter } from "../shared/pledge-form-editor";
import sharp from "sharp";
const fixturePhotoBytes = await sharp({ create: { width: 160, height: 120, channels: 3, background: "#4f46e5" } }).png().toBuffer();
const fixturePhotos = [
  { id: "borrower-photo", photoType: "borrower" },
  ...[1, 2, 3].map(index => ({ id: `item-photo-${index}`, photoType: "collateral" })),
  { id: "document-photo", photoType: "document" },
].map(photo => ({ ...photo, filename: `${photo.id}.png`, originalName: `${photo.id}.png`,
  fileSize: 2048, compressedSize: 1024, createdAt: "2026-10-25T00:00:00Z",
  url: `/api/loans/fixture-loan-621/photos/${photo.id}/image` }));

const bundle = await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
      import Page from './client/src/pages/reports/pledge-forms';
      import NoticePage from './client/src/pages/reports/notice-generator';
      import {PhotoViewer} from './client/src/components/ui/photo-viewer';
      import {Switch,Route} from 'wouter';
      import {Toaster} from './client/src/components/ui/toaster';
      const client=new QueryClient({defaultOptions:{queries:{retry:false,queryFn:async({queryKey})=>{const url=queryKey[0]==='/api/loans'&&queryKey[2]==='photos'?queryKey.slice(0,3).join('/'):queryKey[0];const r=await fetch(url);if(!r.ok)throw Error('fixture error');return r.json();}}}});
      createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}>{new URLSearchParams(location.search).has('viewer')?<div className="mx-auto max-w-3xl p-4"><PhotoViewer loanId="fixture-loan-621" loanAccountNumber="621" readonly/></div>:<Switch><Route path="/notice-ui" component={NoticePage}/><Route path="/reports/notice-generator" component={NoticePage}/><Route component={Page}/></Switch>}<Toaster/></QueryClientProvider>);`,
    resolveDir: process.cwd(), loader: "tsx",
  },
  bundle: true, write: false, format: "esm", jsx: "automatic",
  plugins: [{
    name: "fixture-only-navigation",
    setup(build) {
      build.onResolve({ filter: /^@\/lib\/print-document-pdf$/ }, args => ({ path: args.path, namespace: "fixture-pdf" }));
      build.onLoad({ filter: /.*/, namespace: "fixture-pdf" }, () => ({
        contents: "export const downloadPrintDocumentPdf=(html)=>new Promise((resolve,reject)=>{window.__lastPDFHTML=html;window.__resolvePDF=resolve;window.__rejectPDF=reject;});",
        loader: "js",
      }));
      build.onResolve({ filter: /^@\/components\/ui\/(sidebar|mobile-nav)$/ }, args => ({ path: args.path, namespace: "fixture-nav" }));
      build.onLoad({ filter: /.*/, namespace: "fixture-nav" }, () => ({
        contents: "export const Sidebar=()=>null; export const MobileNav=()=>null;",
        loader: "js",
      }));
    },
  }],
});
const fixtureProfile = { name: "नमुना फायनान्स", address: "मुख्य रस्ता, नमुना गाव", contactNumber: "9000000000", licenseNumber: "TEST-123/2026" };
const fixture = { ...getPledgeOrganization(fixtureProfile), borrowerName: "नमुना कर्जदार", borrowerAddress: "नमुना गाव, नमुना रस्ता", borrowerMobile: "1234567890" };
const fixtureLoan = {
  id: "fixture-loan-621", accountNumber: "621", borrowerName: "नमुना कर्जदार",
  borrowerAddress: "नमुना गाव", borrowerMobile: "9000000000",
  principalAmount: "25000", loanDate: "2026-04-05", interestRate: "1.5",
  interestRateType: "monthly", collateralDetails: "नमुना अंगठी", weight: "4.731",
  purity: "91.6", marketValue: "42000", status: "active", hasMaturity: true,
  maturityDate: "2027-04-05", group: { name: "नमुना गट" },
};
const savedDefaults = new Map<string, PledgeFormMatter>();
let fixtureTenant = "fixture-A", fixtureRole = "admin";
let lastDefaultsPayload: unknown = null;
createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1:5001");
  if (url.pathname === "/fixture/session") {
    fixtureTenant = url.searchParams.get("tenant") || "fixture-A";
    fixtureRole = url.searchParams.get("role") || "admin";
    res.end("ok"); return;
  }
  if (url.pathname === "/fixture/defaults-payload") {
    res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(lastDefaultsPayload)); return;
  }
  if (url.pathname === "/api/auth/me") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ user: { id: "fixture-user", tenantId: fixtureTenant, username: "fixture", role: fixtureRole } })); return;
  }
  if (url.pathname === "/api/pledge-form-settings") {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "PUT" || req.method === "DELETE") {
      if (fixtureRole !== "admin") { res.statusCode = 403; res.end('{"message":"admin only"}'); return; }
      if (req.method === "DELETE") savedDefaults.delete(fixtureTenant);
      else {
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
          lastDefaultsPayload = JSON.parse(body);
          savedDefaults.set(fixtureTenant, pledgeDefaultsRequestSchema.parse(lastDefaultsPayload).matter);
        } catch { res.statusCode = 400; res.end('{"message":"invalid"}'); return; }
      }
    }
    res.end(JSON.stringify({ matter: savedDefaults.get(fixtureTenant) || DEFAULT_PLEDGE_MATTER, customized: savedDefaults.has(fixtureTenant) })); return;
  }
  if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].contents); return; }
  if (url.pathname === "/style.css") {
    res.setHeader("Content-Type", "text/css");
    const file = readdirSync("dist/public/assets").find(file => /^index-.*\.css$/.test(file))!;
    res.end(readFileSync(`dist/public/assets/${file}`)); return;
  }
  if (url.pathname === "/api/company") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(fixtureProfile)); return; }
  if (url.pathname === "/api/loans/search") {
    res.setHeader("Content-Type", "application/json");
    const q = url.searchParams.get("q");
    if (q === "error") { res.statusCode = 500; res.end("{}"); return; }
    res.end(JSON.stringify(q === "none" ? [] : [
      { ...fixtureLoan, id: "fixture-loan-1621", accountNumber: "1621" },
      fixtureLoan,
      { ...fixtureLoan, id: "fixture-loan-closed", accountNumber: "622", status: "closed" },
      { ...fixtureLoan, id: "fixture-loan-failed", accountNumber: "623", status: "closed" },
    ])); return;
  }
  if (/^\/api\/loans\/[^/]+\/photos$/.test(url.pathname)) {
    res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(url.pathname.includes("fixture-loan-621") ? fixturePhotos : [])); return;
  }
  if (/^\/api\/loans\/fixture-loan-621\/photos\/[^/]+\/image$/.test(url.pathname)) {
    res.setHeader("Content-Type", "image/png"); res.end(fixturePhotoBytes); return;
  }
  if (url.pathname === "/api/loan-closures") {
    res.setHeader("Content-Type", "application/json");
    if (url.searchParams.get("loanId") === "fixture-loan-failed") { res.statusCode = 500; res.end("{}"); return; }
    await new Promise(resolve => setTimeout(resolve, 350));
    res.end(JSON.stringify([{ loanId: "fixture-loan-closed", isClosed: true, closureDate: "2026-10-25", principalPaid: "25000", interestPaid: "2000", totalAmount: "27000", actualPaidAmount: "27000" }])); return;
  }
  if (url.pathname === "/api/loans") { res.setHeader("Content-Type", "application/json"); res.end("[]"); return; }
  if (url.pathname === "/api/borrowers/autocomplete") {
    res.setHeader("Content-Type", "application/json");
    if (url.searchParams.get("search") === "error") { res.statusCode = 500; res.end("{}"); return; }
    res.end(JSON.stringify([fixture])); return;
  }
  res.setHeader("Content-Type", "text/html;charset=utf-8");
  if (["/ui", "/notice-ui", "/reports/notice-generator", "/reports/pledge-forms"].includes(url.pathname)) { res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>'); return; }
  const allFields = Object.fromEntries(PLEDGE_FIELD_GROUPS.flatMap(group => group.fields).map(field => [
    field.key, field.type === "date" ? "2026-10-28" : field.type === "money" || field.type === "number" ? "1000" : "1234",
  ]));
  const data = url.pathname === "/all-filled" ? { ...fixture, ...allFields, loanItems: [{ description: "अंगठी", purity: "91.6", weight: "1.49", value: "12000" }], saleItems: [{ description: "अंगठी", purity: "91.6", weight: "1.49", value: "13000" }] }
    : url.pathname === "/profile-blank" ? getPledgeOrganization(fixtureProfile)
    : url.pathname === "/filled" ? fixture
    : url.pathname === "/realistic" ? { ...fixture, borrowerName: "नमुना रामचंद्र भास्कर पाटील", borrowerAddress: "मु.पो. नमुना गाव, तालुका नमुना, जिल्हा नमुना, मुख्य रस्ता" }
    : url.pathname === "/long" ? { ...fixture, borrowerAddress: "फार मोठा पत्ता ".repeat(120) } : {};
  const choice = url.searchParams.has("forms") ? url.searchParams.get("forms")!.split(",") as import("../client/src/lib/pledge-forms").PledgeFormKey[] : url.pathname === "/final" ? "final" : "all";
  res.end(pledgeFormsDocument(data, choice, DEFAULT_PLEDGE_MATTER, url.searchParams.get("layout") === "spacious" ? "spacious" : "compact"));
}).listen(5001, "0.0.0.0", () => console.log("Synthetic pledge forms preview listening on 5001"));
