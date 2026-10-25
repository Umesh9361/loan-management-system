// Requires synthetic print-document-pdf-preview.ts on 5002 and Chromium CDP9222.
import WebSocket from "ws";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const target = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.on("open", resolve));
let id = 0;
const pending = new Map();
socket.on("message", raw => {
  const message = JSON.parse(raw);
  if (!pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
await mkdir("generated-artifacts/direct-a4", { recursive: true });
try {
  for (const kind of ["compact", "spacious", "single", "summary", "summary-full", "summary-long"]) {
    await call("Page.navigate", { url: `http://127.0.0.1:5002/?kind=${kind}` });
    for (let i = 0; i < 100 && !await evaluate("typeof window.runPdf==='function'"); i++) await new Promise(resolve => setTimeout(resolve, 100));
    await evaluate("window.runPdf()");
    assert.equal(await evaluate("window.pdfError||null"), null, `${kind} export error`);
    const result = await evaluate("window.pdfResult");
    assert.ok(result?.data, `${kind} produced a downloadable PDF`);
    if (kind !== "summary-long") assert.equal(result.pages, kind === "spacious" ? 2 : 1, kind);
    else assert.ok(result.pages >= 3, "long summary spans multiple complete pages");
    const file = `generated-artifacts/direct-a4/${kind}.pdf`;
    await writeFile(file, Buffer.from(result.data.split(",")[1], "base64"));
    const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
    assert.match(info, /Page size:\s+595\.\d+ x 841\.\d+ pts \(A4\)/);
    assert.equal(await evaluate("document.querySelectorAll('iframe').length"), 0, "export frame cleaned up");
    console.log(`${kind}: direct A4 PDF, ${result.pages} page(s)`);
  }
} finally {
  socket.close();
  await fetch(`http://127.0.0.1:9222/json/close/${target.id}`);
}
