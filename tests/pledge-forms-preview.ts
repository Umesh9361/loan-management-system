/**
 * Temporary synthetic-only visual/interaction harness, no application auth or database.
 * Run: node --import tsx tests/pledge-forms-preview.ts
 */
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { build } from "esbuild";
import { pledgeFormsDocument } from "../client/src/lib/pledge-forms";
import { DEFAULT_PLEDGE_MATTER, PLEDGE_FIELD_GROUPS, pledgeDefaultsRequestSchema, type PledgeFormMatter } from "../shared/pledge-form-editor";

const bundle = await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
      import Page from './client/src/pages/reports/pledge-forms';
      import NoticePage from './client/src/pages/reports/notice-generator';
      import {Switch,Route} from 'wouter';
      import {Toaster} from './client/src/components/ui/toaster';
      const client=new QueryClient({defaultOptions:{queries:{retry:false,queryFn:async({queryKey})=>{const r=await fetch(queryKey[0]);if(!r.ok)throw Error('fixture error');return r.json();}}}});
      createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><Switch><Route path="/notice-ui" component={NoticePage}/><Route path="/reports/notice-generator" component={NoticePage}/><Route component={Page}/></Switch><Toaster/></QueryClientProvider>);`,
    resolveDir: process.cwd(), loader: "tsx",
  },
  bundle: true, write: false, format: "esm", jsx: "automatic",
  plugins: [{
    name: "fixture-only-navigation",
    setup(build) {
      build.onResolve({ filter: /^@\/components\/ui\/(sidebar|mobile-nav)$/ }, args => ({ path: args.path, namespace: "fixture-nav" }));
      build.onLoad({ filter: /.*/, namespace: "fixture-nav" }, () => ({
        contents: "export const Sidebar=()=>null; export const MobileNav=()=>null;",
        loader: "js",
      }));
    },
  }],
});
const fixture = { company: "नमुना संस्था", borrowerName: "नमुना कर्जदार", borrowerAddress: "नमुना गाव, नमुना रस्ता", borrowerMobile: "1234567890" };
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
  if (url.pathname === "/api/company") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ name: fixture.company })); return; }
  if (url.pathname === "/api/loans") { res.setHeader("Content-Type", "application/json"); res.end("[]"); return; }
  if (url.pathname === "/api/borrowers/autocomplete") {
    res.setHeader("Content-Type", "application/json");
    if (url.searchParams.get("search") === "error") { res.statusCode = 500; res.end("{}"); return; }
    res.end(JSON.stringify([fixture])); return;
  }
  res.setHeader("Content-Type", "text/html;charset=utf-8");
  if (["/ui", "/notice-ui", "/reports/notice-generator", "/reports/pledge-forms"].includes(url.pathname)) { res.end('<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>'); return; }
  const allFields = Object.fromEntries(PLEDGE_FIELD_GROUPS.flatMap(group => group.fields).map(field => [
    field.key, field.type === "date" ? "2026-10-28" : field.type === "money" || field.type === "number" ? "1000" : "1234",
  ]));
  const data = url.pathname === "/all-filled" ? { ...fixture, ...allFields, loanItems: [{ description: "अंगठी", purity: "91.6", weight: "1.49", value: "12000" }], saleItems: [{ description: "अंगठी", purity: "91.6", weight: "1.49", value: "13000" }] }
    : url.pathname === "/filled" ? fixture
    : url.pathname === "/realistic" ? { ...fixture, borrowerName: "नमुना रामचंद्र भास्कर पाटील", borrowerAddress: "मु.पो. नमुना गाव, तालुका नमुना, जिल्हा नमुना, मुख्य रस्ता" }
    : url.pathname === "/long" ? { ...fixture, borrowerAddress: "फार मोठा पत्ता ".repeat(120) } : {};
  const choice = url.searchParams.has("forms") ? url.searchParams.get("forms")!.split(",") as import("../client/src/lib/pledge-forms").PledgeFormKey[] : url.pathname === "/final" ? "final" : "all";
  res.end(pledgeFormsDocument(data, choice, DEFAULT_PLEDGE_MATTER, url.searchParams.get("layout") === "spacious" ? "spacious" : "compact"));
}).listen(5001, "0.0.0.0", () => console.log("Synthetic pledge forms preview listening on 5001"));
