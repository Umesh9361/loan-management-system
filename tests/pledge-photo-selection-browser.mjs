import assert from "node:assert/strict";
import WebSocket from "ws";
const tab = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => socket.once("open", resolve));
let id = 0;
const pending = new Map();
socket.on("message", raw => {
  const message = JSON.parse(raw);
  if (pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
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
  for (let n = 0; n < 150; n++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Timed out: ${expression}`);
};
const photoPanel = "document.querySelector('[aria-label=\"प्रिंटसाठी फोटो निवड\"]')";
const preview = "document.querySelector('iframe')?.contentDocument";
try {
  await call("Page.enable"); await call("Page.bringToFront");
  await call("Emulation.setDeviceMetricsOverride", { width: 402, height: 874, deviceScaleFactor: 1, mobile: true });
  await call("Page.navigate", { url: "http://127.0.0.1:5001/ui" });
  await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='कर्ज खाते')");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='कर्ज खाते').click()");
  await waitFor("!!document.getElementById('pledge-loan-search')");
  await evaluate(`(()=>{const input=document.getElementById('pledge-loan-search');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'621');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor("document.querySelectorAll('.max-h-64 button').length>0");
  await evaluate("document.querySelector('.max-h-64 button').click()");
  await waitFor(`${photoPanel}?.querySelectorAll('input').length===3`);
  await waitFor(`${photoPanel}.querySelectorAll('input:checked').length===2`);
  await waitFor(`${preview}?.querySelectorAll('img').length===5`);
  assert.equal(await evaluate(`${photoPanel}.querySelectorAll('img').length`), 4, "all three item choices and separate borrower photo visible");
  await evaluate(`${photoPanel}.querySelectorAll('input')[2].click()`);
  await waitFor(`${photoPanel}.querySelector('[role="alert"]')?.textContent.includes('कमाल 2')`);
  assert.equal(await evaluate(`${photoPanel}.querySelectorAll('input:checked').length`), 2);
  await evaluate(`${photoPanel}.querySelectorAll('input')[0].click()`);
  await waitFor(`${photoPanel}.querySelectorAll('input:checked').length===1`);
  await evaluate(`${photoPanel}.querySelectorAll('input')[2].click()`);
  await waitFor(`${photoPanel}.querySelectorAll('input:checked').length===2`);
  await waitFor(`${preview}?.querySelector('[data-form="receipt"]')?.textContent.includes('वस्तूचा फोटो 3')`);
  assert.equal(await evaluate(`${preview}.querySelector('[data-form="receipt"]').textContent.includes('वस्तूचा फोटो 1')`), false);
  assert.ok(await evaluate(`${preview}.body.textContent.includes('25,000')`), "photo changes preserve loan fields");
  assert.equal(await evaluate(`${preview}.querySelectorAll('[data-form="loan"] img').length`), 1, "borrower photo retained");
  await call("Emulation.setDeviceMetricsOverride", { width: 320, height: 874, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate(`${photoPanel}.scrollWidth<=${photoPanel}.clientWidth+1`), "choice panel fits a narrow phone");
  for (const index of [1, 2]) {
    await evaluate(`${photoPanel}.querySelectorAll('input')[${index}].click()`);
    await waitFor(`!${photoPanel}.querySelector('input:disabled')`);
  }
  await waitFor(`${photoPanel}.querySelectorAll('input:checked').length===0`);
  assert.equal(await evaluate(`${preview}.querySelectorAll('.pf-photo-thumb').length`), 1, "no selected item photos leaves only borrower");
  console.log("Form: three saved choices, maximum two, selecting third, deselecting all, original numbers, borrower/loan fields and 320px layout verified");
  await call("Page.navigate", { url: "http://127.0.0.1:5001/ui?viewer=1" });
  await waitFor("document.querySelectorAll('section[aria-label]').length===3");
  assert.equal(await evaluate("document.querySelector('section[aria-label=\"कर्जदाराचा फोटो\"]').querySelectorAll('img').length"), 1);
  assert.equal(await evaluate("document.querySelector('section[aria-label=\"तारण वस्तूंचे फोटो\"]').querySelectorAll('img').length"), 3);
  assert.equal(await evaluate("document.querySelector('section[aria-label=\"इतर फोटो / कागदपत्रे\"]').querySelectorAll('img').length"), 1);
  await evaluate("document.querySelector('button[aria-label=\"कर्जदाराचा फोटो 1 मोठा पहा\"]').click()");
  await waitFor("!!document.querySelector('[role=\"dialog\"]')");
  assert.ok(await evaluate("document.querySelector('[role=\"dialog\"]').textContent.includes('कर्जदाराचा फोटो · खाते 621')"));
  const dialog = await evaluate("(()=>{const r=document.querySelector('[role=\"dialog\"]').getBoundingClientRect();return {left:r.left,right:r.right}})()");
  assert.ok(dialog.left >= 0 && dialog.right <= 321, "borrower preview fits mobile");
  assert.ok(await evaluate("document.querySelector('[role=\"dialog\"]').textContent.includes('1 KB')"), "image size shown in KB, not raw bytes");
  console.log("Details gallery: borrower, all three items, documents, labelled enlarged borrower preview and mobile fit verified");
} finally {
  socket.close(); await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`);
}
