import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import WebSocket from "ws";
const tab = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => socket.once("open", resolve));
let id = 0;
const pending = new Map();
socket.on("message", raw => {
  const message = JSON.parse(raw);
  if (pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(Error(JSON.stringify(message.error))) : resolve(message.result);
  }
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const waitFor = async expression => {
  for (let n = 0; n < 120; n++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Timed out: ${expression}`);
};
await mkdir("generated-artifacts/photo-print", { recursive: true });
try {
  await call("Page.enable");
  await call("Page.bringToFront");
  for (const kind of ["photos-compact", "photos-spacious", "photos-single", "compact", "single"]) {
    await call("Page.navigate", { url: `http://127.0.0.1:5002/?kind=${kind}` });
    await waitFor("typeof window.runPdf==='function'");
    await evaluate("window.runPdf()");
    assert.equal(await evaluate("window.pdfError||null"), null, `${kind}: direct PDF`);
    const result = await evaluate("window.pdfResult");
    assert.equal(result.pages, kind.includes("spacious") ? 2 : 1);
    await writeFile(`generated-artifacts/photo-print/${kind}-download.pdf`, Buffer.from(result.data.split(",")[1], "base64"));
    await call("Page.navigate", { url: `http://127.0.0.1:5002/document?kind=${kind}` });
    await waitFor("document.querySelectorAll('.pf-section').length>0");
    await evaluate("document.fonts.ready");
    await waitFor("[...document.images].every(i=>i.complete && i.naturalWidth>0)");
    const geometry = await evaluate(`({
      images:[...document.images].map(i=>({src:i.src,fit:getComputedStyle(i).objectFit})),
      overflow:[...document.querySelectorAll('.pf-section')].filter(s=>
        s.scrollHeight>s.clientHeight+2 || s.scrollWidth>s.clientWidth+2 ||
        s.lastElementChild.getBoundingClientRect().bottom>s.getBoundingClientRect().bottom-3).length
    })`);
    assert.equal(geometry.overflow, 0, `${kind}: signatures and photos stay inside cut lines`);
    assert.equal(geometry.images.length, kind.startsWith("photos") ? (kind.endsWith("single") ? 3 : 5) : 0);
    for (const image of geometry.images) {
      assert.match(image.src, /^data:image\/png;base64,/);
      assert.equal(image.fit, "contain");
    }
    const pdf = await call("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    const file = `generated-artifacts/photo-print/${kind}-print.pdf`;
    await writeFile(file, Buffer.from(pdf.data, "base64"));
    const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
    assert.match(info, /Page size:\s+59[45]\.\d+ x 841\.\d+ pts \(A4\)/);
    assert.match(info, kind.includes("spacious") ? /Pages:\s+2\b/ : /Pages:\s+1\b/);
    console.log(`${kind}: photos fit without cropping; A4 native print and direct PDF verified`);
  }
} finally {
  socket.close();
  await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`);
}
