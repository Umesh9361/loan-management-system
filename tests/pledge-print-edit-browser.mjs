import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import WebSocket from "ws";

const tab = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => socket.once("open", resolve));
let sequence = 0;
const pending = new Map();
const mutations = [];
socket.on("message", raw => {
  const message = JSON.parse(raw);
  if (message.method === "Network.requestWillBeSent" && /POST|PUT|PATCH|DELETE/.test(message.params.request.method)) mutations.push(message.params.request.url);
  if (pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    message.error ? reject(Error(JSON.stringify(message.error))) : resolve(message.result);
  }
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++sequence, { resolve, reject }); socket.send(JSON.stringify({ id: sequence, method, params }));
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
const setInput = (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const doc = "document.querySelector('iframe')?.contentDocument";
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
try {
  await call("Network.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 320, height: 874, deviceScaleFactor: 1, mobile: true });
  await call("Page.navigate", { url: "http://127.0.0.1:5001/ui" });
  await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='कर्ज खाते')");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='कर्ज खाते').click()");
  await waitFor("!!document.getElementById('pledge-loan-search')");
  await setInput("#pledge-loan-search", "621");
  await waitFor("document.querySelectorAll('.max-h-64 button').length>0");
  await click(".max-h-64 button");
  await waitFor(`${doc}?.querySelectorAll('img').length===5`);
  await waitFor("document.querySelector('[data-testid=\"pledge-edit-toggle\"]')?.disabled===false");
  assert.equal(await evaluate("document.querySelector('[data-testid=\"pledge-field-receiptInterest\"]').disabled"), true);
  await click('[data-testid="pledge-edit-toggle"]');
  await waitFor("document.querySelector('[data-testid=\"pledge-field-receiptInterest\"]').disabled===false");
  await setInput('[data-testid="pledge-field-receiptPrincipal"]', "25000");
  await setInput('[data-testid="pledge-field-receiptInterest"]', "1234");
  await waitFor("document.querySelector('[data-testid=\"pledge-field-receiptTotal\"]').value==='26234'");
  await setInput('[data-testid="pledge-loan-items-0-value"]', "42000");
  await waitFor(`${doc}?.querySelector('[data-form="receipt"]')?.textContent.includes('1,234')`);
  await waitFor(`${doc}?.querySelector('[data-form="loan"]')?.textContent.includes('42,000')`);
  await click('[data-testid="pledge-edit-toggle"]');
  await waitFor("document.querySelector('[data-testid=\"pledge-field-receiptInterest\"]').disabled");
  await click('[data-testid="pledge-photo-borrower"]');
  await waitFor(`${doc}?.querySelectorAll('img').length===2`);
  await click('[data-testid="pledge-photo-collateral"]');
  await waitFor(`${doc}?.querySelectorAll('img').length===0`);
  assert.equal(await evaluate(`${doc}.querySelectorAll('.pf-photo').length`), 0);
  await click('[data-testid="pledge-photo-borrower"]');
  await waitFor(`${doc}?.querySelectorAll('img').length===3`);
  await click('[data-testid="pledge-photo-collateral"]');
  await waitFor(`${doc}?.querySelectorAll('img').length===5`);
  assert.equal(await evaluate("document.querySelector('[data-testid=\"pledge-field-receiptInterest\"]').value"), "1234");
  assert.equal(await evaluate("document.documentElement.scrollWidth<=window.innerWidth"), true);
  await click('[data-testid="pledge-photo-borrower"]');
  await click('[data-testid="pledge-photo-collateral"]');
  await waitFor(`${doc}?.querySelectorAll('img').length===0`);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('PDF डाउनलोड')).click()");
  await waitFor("typeof window.__lastPDFHTML==='string'");
  assert.equal(await evaluate("(window.__lastPDFHTML.match(/<img /g)||[]).length"), 0);
  assert.equal(await evaluate("window.__lastPDFHTML.includes('1,234')&&window.__lastPDFHTML.includes('42,000')"), true);
  await evaluate("window.__resolvePDF()");
  assert.deepEqual(mutations, [], "temporary photo/data edits never mutate saved loans/photos/defaults");
  await evaluate("document.querySelector('[data-testid=\"pledge-photo-borrower\"]').closest('section').scrollIntoView()");
  const image = await call("Page.captureScreenshot", { format: "png" });
  mkdirSync("generated-artifacts", { recursive: true });
  writeFileSync("generated-artifacts/pledge-print-edit-mobile.png", Buffer.from(image.data, "base64"));
  console.log("PASS: 320px auto-fill edit/lock, interest/valuation edits, totals, reversible photo visibility and direct PDF snapshot; no mutating API calls.");
} finally {
  socket.close();
  await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`);
}
