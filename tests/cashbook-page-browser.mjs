// Start cashbook-page-preview.tsx and Chromium (--remote-debugging-port=9222).
import assert from "node:assert/strict";
import WebSocket from "ws";
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const target = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.on("open", resolve));
let id = 0;
const pending = new Map();
socket.on("message", raw => {
  const message = JSON.parse(raw), item = pending.get(message.id);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    console.error("Browser:", message.params.args.map(arg => arg.description || arg.value).join(" "));
  }
  if (message.method === "Runtime.exceptionThrown") console.error("Browser exception:", message.params.exceptionDetails);
  if (message.method === "Page.javascriptDialogOpening") {
    console.error("Browser dialog:", message.params.message);
    call("Page.handleJavaScriptDialog", { accept: true });
  }
  if (!item) return;
  pending.delete(message.id);
  message.error ? item.reject(Error(JSON.stringify(message.error))) : item.resolve(message.result);
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
async function waitFor(expression) {
  for (let n = 0; n < 500; n++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Timed out: ${expression}`);
}
const click = label => evaluate(`[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===${JSON.stringify(label)}).click()`);
const out = "generated-artifacts/cashbook-loan-date";
await mkdir(out, { recursive: true });
const downloadDir = `${out}/downloads-${Date.now()}`;
await mkdir(downloadDir, { recursive: true });
try {
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: resolve(downloadDir) });
  await call("Page.addScriptToEvaluateOnNewDocument", { source: "window.print=()=>{};" });
  for (const width of [360, 1280]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 360 });
    for (const page of ["mobile", "report"]) {
      await call("Page.navigate", { url: `http://127.0.0.1:5003/${page}` });
      await waitFor("document.body?.innerText.includes('कर्ज दिनांक: 15/06/2019')");
      const text = await evaluate("document.body.innerText");
      assert(text.includes("व्याज: ₹1200.50 · कर्ज दिनांक: 15/06/2019"));
      assert(text.includes("कर्ज दिनांक: उपलब्ध नाही"));
      assert(text.includes("मॅन्युअल रोकड जमा"));
      assert(!text.includes("hidden"));
      const clipped = await evaluate(`Array.from(document.querySelectorAll('td,div.text-xs.text-gray-500')).filter(n=>n.textContent.includes('कर्ज दिनांक:')).filter(n=>n.scrollHeight>n.clientHeight+2||n.scrollWidth>n.clientWidth+2).length`);
      assert.equal(clipped, 0, `${width}px ${page}: date text stays within its detail cell`);
      if (page === "report") {
        assert.equal(await evaluate("document.querySelectorAll('tbody tr').length"), 30, "28 transactions, closing and total retained");
      }
      const image = await call("Page.captureScreenshot", { format: "png" });
      await writeFile(`${out}/${page}-${width}.png`, Buffer.from(image.data, "base64"));
      console.log(`${width}px ${page}: inline dates, missing-date entry, unchanged manual row, no clipped details`);
    }
  }
  // Inspect the actual print HTML before its temporary frame is removed.
  await evaluate("[...document.querySelectorAll('button')].find(n=>n.querySelector('.lucide-printer')).click()");
  await waitFor("document.querySelector('iframe')?.contentDocument?.body.innerText.includes('कर्ज दिनांक: 15/06/2019')");
  const printHTML = await evaluate("document.querySelector('iframe').contentDocument.documentElement.outerHTML");
  assert(printHTML.includes("व्याज: ₹1200.50 · कर्ज दिनांक: 15/06/2019"));
  assert(printHTML.includes("page-break-inside: avoid"));
  await writeFile(`${out}/namuna7-print.html`, printHTML);
  // Exercise real html2canvas + jsPDF on the mobile download path.
  await call("Emulation.setDeviceMetricsOverride", { width: 360, height: 900, deviceScaleFactor: 1, mobile: true });
  await call("Page.navigate", { url: "http://127.0.0.1:5003/report" });
  await waitFor("document.body?.innerText.includes('कर्ज दिनांक: 15/06/2019')");
  await evaluate("[...document.querySelectorAll('button')].find(n=>n.textContent.includes('PDF')).click()");
  let downloaded;
  for (let n = 0; n < 300; n++) {
    downloaded = (await readdir(downloadDir)).find(file => file.endsWith(".pdf"));
    if (downloaded) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(downloaded, "actual mobile PDF download completed");
  await writeFile(`${out}/namuna7-mobile.pdf`, await readFile(`${downloadDir}/${downloaded}`));
  // Vertical preview uses the same full description.
  await evaluate("document.querySelector('[role=combobox]').click()");
  await waitFor("!!document.querySelector('[role=option]')");
  await evaluate("[...document.querySelectorAll('[role=option]')].find(n=>n.textContent.includes('Vertical')).click()");
  await waitFor("document.querySelector('tbody').innerText.includes('कर्ज दिनांक: 15/06/2019')");
  assert((await evaluate("document.querySelector('tbody').innerText")).includes("व्याज: ₹1200.50 · कर्ज दिनांक: 15/06/2019"));
  const writes = await (await fetch("http://127.0.0.1:5003/api/fixture-writes")).json();
  assert.equal(writes.writes, 0);
  const { frameTree } = await call("Page.getFrameTree");
  await call("Page.setDocumentContent", { frameId: frameTree.frame.id, html: printHTML });
  await evaluate("document.fonts.ready");
  const printed = await call("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  await writeFile(`${out}/namuna7-laptop-print.pdf`, Buffer.from(printed.data, "base64"));
  console.log("Print HTML, mobile A4 PDF, vertical preview, laptop print PDF, and zero financial writes passed");
} finally {
  await call("Page.close").catch(() => {});
  socket.close();
}
