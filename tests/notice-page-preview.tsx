// Synthetic session/loans only; does not bypass authentication in the real app.
import express from "express";
import { build } from "esbuild";
import { readFileSync, readdirSync } from "node:fs";
import { createNoticeSettingsHandlers } from "../server/notice-settings";
const app = express();
app.use(express.json());
const records = new Map<string, string>();
const handlers = createNoticeSettingsHandlers({
  read: async tenant => records.get(tenant),
  write: async (tenant, matter) => { records.set(tenant, JSON.stringify(matter)); },
  reset: async tenant => { records.delete(tenant); },
  canRead: async () => true,
});
app.use((req: any, _res, next) => {
  const params = new URL(req.headers.referer || "http://fixture").searchParams;
  req.session = { userId: "fixture-user", tenantId: "fixture", role: params.get("role") || "admin" };
  next();
});
app.all("/api/notice-settings", (req: any, res, next) => {
  if ((req.headers.referer || "").includes("settingsError")) { res.status(500).json({ message: "जतन केलेला मजकूर लोड झाला नाही" }); return; }
  if ((req.headers.referer || "").includes("writeError") && req.method !== "GET") { res.status(500).json({ message: "जतन झाले नाही" }); return; }
  const handler = req.method === "GET" ? handlers.read : req.method === "PUT" ? handlers.write : handlers.reset;
  return handler(req, res, next);
});
app.get("/api/loans", (_req, res) => res.json([{ id: "loan1", borrowerName: "नमुना ग्राहक", borrowerAddress: "नमुना गाव", accountNumber: "621", loanDate: "2026-10-31", principalAmount: "25000", durationInMonths: "6", status: "active" }]));
app.get("/api/company", (_req, res) => res.json({ name: "नमुना फायनान्स", address: "नमुना गाव" }));
const result = await build({
  stdin: { contents: `
    import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
    import Page,{fullNoticeHTML}from'./client/src/pages/reports/notice-generator';
    import{DEFAULT_NOTICE_MATTER,renderNoticeContent}from'./shared/notice-matter';
    import{downloadNoticePdf,noticeImageData}from'./client/src/lib/notice-export';
    window.noticeTools={fullNoticeHTML,DEFAULT_NOTICE_MATTER,renderNoticeContent,downloadNoticePdf,noticeImageData};
    const client=new QueryClient({defaultOptions:{queries:{retry:false,queryFn:async({queryKey})=>{const r=await fetch(queryKey[0]);if(!r.ok)throw Error('fixture');return r.json()}}}});
    createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><Page/></QueryClientProvider>);
    if(location.search.includes('showEditor'))setTimeout(()=>document.querySelector('[aria-controls=\"notice-matter-editor-content\"]')?.click(),250);
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "esm", jsx: "automatic",
  plugins: [{ name: "synthetic-navigation-session", setup(build) {
    build.onResolve({ filter: /^@\/components\/ui\/(sidebar|mobile-nav)$/ }, args => ({ path: args.path, namespace: "fixture-nav" }));
    build.onLoad({ filter: /.*/, namespace: "fixture-nav" }, () => ({ contents: "export const Sidebar=()=>null;export const MobileNav=()=>null;" }));
    build.onResolve({ filter: /^@\/hooks\/use-current-user$/ }, args => ({ path: args.path, namespace: "fixture-user" }));
    build.onLoad({ filter: /.*/, namespace: "fixture-user" }, () => ({ contents: "export const useCurrentUser=()=>({user:{id:'fixture-user',tenantId:'fixture',role:new URLSearchParams(location.search).get('role')||'admin'}});" }));
  } }],
});
app.get("/bundle.js", (_req, res) => res.type("js").send(result.outputFiles[0].text));
app.get("/style.css", (_req, res) => res.type("css").send(readFileSync(`dist/public/assets/${readdirSync("dist/public/assets").find(file => file.endsWith(".css"))}`)));
app.get("*", (_req, res) => res.type("html").send('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>'));
app.listen(5003, "0.0.0.0", () => console.log("Synthetic notice editor fixture on 5003"));
