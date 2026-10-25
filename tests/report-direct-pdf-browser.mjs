// Requires report-a4-preview.ts on 5002 and Chromium CDP on 9222.
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
await mkdir("generated-artifacts/financial-a4", { recursive: true });
try {
  for (const name of ["profit", "balance"]) {
    await call("Page.navigate", { url: `http://127.0.0.1:5002/${name}?direct` });
    await new Promise(resolve => setTimeout(resolve, 800));
    await evaluate("document.fonts.ready");
    assert.equal(await evaluate('document.body.textContent.includes("undefined") || document.body.textContent.includes("NaN")'), false);
    const pdf = await call("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    const file = `generated-artifacts/financial-a4/${name}-print.pdf`;
    await writeFile(file, Buffer.from(pdf.data, "base64"));
    const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
    assert.match(info, /59[45]\.\d+ x 841\.\d+ pts/);
    assert.match(info, /Pages:\s+1\b/);
    await evaluate("window.runDirectPDF()");
    const direct = await evaluate(`({
      pages:window.fixturePDF.getNumberOfPages(),
      width:window.fixturePDF.internal.pageSize.getWidth(),
      height:window.fixturePDF.internal.pageSize.getHeight(),
      data:window.fixturePDF.output("datauristring").split(",")[1]
    })`);
    assert.equal(direct.pages, 1, `${name} direct PDF should not contain a viewport-sized blank page`);
    assert.ok(Math.abs(direct.width - 210) < .1 && Math.abs(direct.height - 297) < .1);
    await writeFile(`generated-artifacts/financial-a4/${name}-direct.pdf`, Buffer.from(direct.data, "base64"));
    console.log(`${name}: native print and actual direct PDF both A4, one page`);
  }
} finally {
  await call("Target.closeTarget", { targetId: target.id });
  socket.close();
}
