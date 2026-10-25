// Synthetic fixture server: tests/account-summary-preview.tsx (5001), Chromium CDP (9222).
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import WebSocket from "ws";

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
  const value = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails));
  return value.result.value;
};
await mkdir("generated-artifacts/summary-margin", { recursive: true });
try {
  for (const [name, query] of [
    ["table", ""], ["overview", "&overview"], ["notes", "&notes"],
    ["full", "&overview&notes"], ["ranked", "&rank&overview"],
    ["long", "&rows=50"], ["period", "&period&overview&notes"],
  ]) {
    await call("Page.navigate", { url: `http://127.0.0.1:5001/print?fixture=1${query}` });
    // Await the new document rather than the previous navigation's ready state.
    await new Promise(resolve => setTimeout(resolve, 150));
    await evaluate(`(async()=>{await document.fonts.ready;await Promise.all([400,600,700].map(w=>document.fonts.load(w+' 12px "Noto Sans Devanagari"')));})()`);
    const geometry = await evaluate(`({
      width:document.body.getBoundingClientRect().width,
      overflow:document.body.scrollWidth-document.body.clientWidth,
      cells:[...document.querySelectorAll('td,th')].every(c=>c.scrollWidth<=c.clientWidth+2)
    })`);
    assert.ok(Math.abs(geometry.width - 200 / 25.4 * 96) < 1, JSON.stringify(geometry));
    assert.ok(geometry.overflow < 2 && geometry.cells, JSON.stringify(geometry));
    const result = await call("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    const path = `generated-artifacts/summary-margin/${name}.pdf`;
    await writeFile(path, Buffer.from(result.data, "base64"));
    const info = execFileSync("pdfinfo", [path], { encoding: "utf8" });
    assert.match(info, /Page size:\s+59[45]\.\d+ x 841\.\d+ pts \(A4\)/);
    if (name !== "long") assert.match(info, /Pages:\s+1\b/);
    console.log(`${name}: A4, no horizontal clipping${name === "long" ? ", multipage table" : ", one page"}`);
  }
} finally {
  await call("Target.closeTarget", { targetId: target.id });
  socket.close();
}
