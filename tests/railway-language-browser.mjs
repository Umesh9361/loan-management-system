import assert from "node:assert/strict";
import WebSocket from "ws";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const target = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.on("open", resolve));
let id = 0;
const pending = new Map(), errors = [];
socket.on("message", raw => {
  const msg = JSON.parse(raw), waiter = pending.get(msg.id);
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (waiter) {
    pending.delete(msg.id);
    msg.error ? waiter.reject(Error(JSON.stringify(msg.error))) : waiter.resolve(msg.result);
  }
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
  for (let i = 0; i < 180; i++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Timed out: ${expression}\nVisible: ${await evaluate("document.body.innerText.slice(0,1200)")}`);
}
const catalog = JSON.parse(await readFile("shared/ui-catalog.en.json", "utf8"));
const output = "generated-artifacts/railway-language";
await mkdir(output, { recursive: true });
async function image(name) {
  const result = await call("Page.captureScreenshot", { format: "png" });
  await writeFile(`${output}/${name}.png`, Buffer.from(result.data, "base64"));
}
async function login(language) {
  await waitFor("!!document.getElementById('tenantId')");
  await evaluate(`[...document.querySelectorAll('button[aria-pressed]')][${language === "en" ? 1 : 0}].click()`);
  for (const [field, text] of [["tenantId", "language-test"], ["username", "fixture"], ["password", "test-only-value"]]) {
    await evaluate(`document.getElementById(${JSON.stringify(field)}).focus()`);
    await call("Input.insertText", { text });
  }
  await evaluate("document.querySelector('button[type=submit]').click()");
  await waitFor(`document.body.innerText.toLowerCase().includes(${JSON.stringify((language === "en" ? catalog["झटपट कामे"] : "झटपट कामे").toLowerCase())})`);
  assert.equal(await evaluate("localStorage.getItem('language')"), language);
}
try {
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable");
  await call("Network.setBypassServiceWorker", { bypass: true });
  await call("Storage.clearDataForOrigin", { origin: "http://127.0.0.1:5003", storageTypes: "all" });
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await call("Page.navigate", { url: "http://127.0.0.1:5003/" });
  await login("en");
  assert(!(await evaluate("document.body.innerText")).includes("झटपट कामे"));
  assert(!/[\u0900-\u097f]/.test(await evaluate("document.body.innerText")), "Dashboard and real mobile navigation must be English");
  await image("production-dashboard-en-mobile");
  for (const [path, title] of [["/loans", "कर्ज नोंदणी"], ["/reports/account-summary", "खाते सारांश अहवाल"]]) {
    await call("Page.navigate", { url: `http://127.0.0.1:5003${path}` });
    await waitFor(`document.body.innerText.toLowerCase().includes(${JSON.stringify(catalog[title].toLowerCase())})`);
    assert.equal(await evaluate("localStorage.getItem('language')"), "en");
    await image(path.includes("account-summary") ? "production-summary-en-mobile" : "production-loans-en-mobile");
  }
  await call("Page.navigate", { url: "http://127.0.0.1:5003/" });
  await waitFor(`document.body.innerText.toLowerCase().includes(${JSON.stringify(catalog["झटपट कामे"].toLowerCase())})`);
  await evaluate("[...document.querySelectorAll('button')].find(n=>/log\\s*out/i.test(n.textContent)).click()");
  await login("mr");
  await image("production-dashboard-mr-mobile");
  // A subsequent explicit EN login must still switch this same user back.
  await evaluate("[...document.querySelectorAll('button')].find(n=>/log\\s*out/i.test(n.textContent)).click()");
  await login("en");
  await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  assert(!/[\u0900-\u097f]/.test((await evaluate("document.body.innerText")).replaceAll("नमुना फायनान्स", "")), "Real desktop sidebar must be English");
  await image("production-dashboard-en-desktop");
  assert.equal(errors.length, 0, errors.join("\n"));
  await writeFile(`${output}/result.json`, JSON.stringify({ productionBundle: true, loginRoundTrip: "EN -> MR -> EN", pages: ["dashboard", "loans", "account-summary"], exceptions: errors }, null, 2));
  console.log("PASS: actual Railway production bundle, EN -> MR -> EN login/reload, dashboard, loans, account summary, mobile/desktop.");
} finally {
  await call("Page.close").catch(() => {});
  socket.close();
}
