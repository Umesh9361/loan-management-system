// Run tests/notice-page-preview.tsx on 5003 and Chromium with CDP on 9222.
import assert from "node:assert/strict";
import WebSocket from "ws";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const target = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.on("open", resolve));
let id = 0;
const pending = new Map();
socket.on("message", raw => {
  const message = JSON.parse(raw), item = pending.get(message.id);
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
  for (let n = 0; n < 100; n++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Timed out: ${expression}`);
}
const click = async expression => {
  await evaluate(expression);
  await new Promise(resolve => setTimeout(resolve, 80));
};
const button = label => `[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===${JSON.stringify(label)}).click()`;
const setField = (id, value) => click(`{const input=document.getElementById(${JSON.stringify(id)});
 Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
 input.dispatchEvent(new Event('input',{bubbles:true}));}`);
const open = async (query = "") => {
  await call("Page.navigate", { url: `http://127.0.0.1:5003/${query}` });
  await waitFor("!!document.querySelector('[aria-controls=\"notice-matter-editor-content\"]')");
  await evaluate("window.confirm=()=>true");
  await click("document.querySelector('[aria-controls=\"notice-matter-editor-content\"]').click()");
};
try {
  for (const width of [360, 1280]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
    await open();
    await waitFor("!!document.querySelector('textarea')&&!document.querySelector('textarea').disabled");
    const fieldIds = await evaluate("[...document.querySelectorAll('[id^=\"notice-matter-\"]')].filter(n=>['INPUT','TEXTAREA'].includes(n.tagName)).map(n=>n.id)");
    const original = await evaluate(`document.getElementById(${JSON.stringify(fieldIds[0])}).value`);
    assert.equal(fieldIds.length, 6, "every printed section is editable");
    await setField(fieldIds[0], "संपादित नोटीस");
    await setField(fieldIds[4], "खाते {accountNumber}\n\nमाझा पूर्ण बदललेला मुख्य मजकूर.");
    await click(button("संस्थेसाठी हा मजकूर जतन करा"));
    await waitFor("!document.body.innerText.includes('तात्पुरते बदल')");
    await open();
    await waitFor(`document.getElementById(${JSON.stringify(fieldIds[0])})?.value==='संपादित नोटीस'`);
    assert.ok((await evaluate(`document.getElementById(${JSON.stringify(fieldIds[4])}).value`)).includes("माझा पूर्ण"));
    assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "mobile editor has no horizontal overflow");
    // Filled and blank previews must use this same saved template.
    await click("document.querySelector('[role=combobox]').click()");
    await waitFor("!!document.querySelector('[role=option]')");
    await click("[...document.querySelectorAll('[role=option]')].find(n=>n.textContent.includes('621')).click()");
    await click(button("नोटीस तयार करा"));
    await waitFor("!!document.querySelector('.notice-container')");
    assert.ok((await evaluate("document.querySelector('.notice-container').innerText")).includes("खाते 621"));
    assert.ok((await evaluate("document.querySelector('.notice-container').innerText")).includes("संपादित नोटीस"));
    await open();
    await click("document.querySelector('#blank').click()");
    await click(button("नोटीस तयार करा"));
    await waitFor("!!document.querySelector('.notice-container')");
    assert.ok((await evaluate("document.querySelector('.notice-container').innerText")).includes("संपादित नोटीस"));
    assert.ok(!(await evaluate("document.querySelector('.notice-container').innerText")).includes("621"));
    await open();
    await click(button("मूळ मजकूर तात्पुरता वापरा"));
    assert.equal(await evaluate(`document.getElementById(${JSON.stringify(fieldIds[0])}).value`), original);
    await open();
    await waitFor(`document.getElementById(${JSON.stringify(fieldIds[0])})?.value==='संपादित नोटीस'`);
    await click(button("संस्थेचा जतन केलेला मजकूर मूळ करा"));
    await waitFor(`document.getElementById(${JSON.stringify(fieldIds[0])})?.value===${JSON.stringify(original)}`);
    await open();
    await waitFor(`document.getElementById(${JSON.stringify(fieldIds[0])})?.value===${JSON.stringify(original)}`);
    await open("?role=user");
    await waitFor("!!document.querySelector('textarea')&&!document.querySelector('textarea').disabled");
    assert.ok(!(await evaluate("document.body.innerText")).includes("संस्थेसाठी हा मजकूर जतन करा"), "ordinary users cannot save/reset organization defaults");
    await open("?settingsError=1");
    await waitFor("document.body.innerText.includes('जतन केलेला मजकूर लोड झाला नाही')");
    assert.ok(await evaluate("[...document.querySelectorAll('button')].find(n=>n.textContent.trim()==='नोटीस तयार करा').disabled"), "read failure never silently prints original");
    console.log(`${width}px: all sections edit/save/reload, filled/blank, temporary original, persistent reset, permissions and read-error blocking passed`);
  }
  await open("?writeError=1");
  await waitFor("!!document.querySelector('textarea')&&!document.querySelector('textarea').disabled");
  await setField("notice-matter-title", "न सेव्ह झालेली नोटीस");
  await click(button("संस्थेसाठी हा मजकूर जतन करा"));
  await waitFor("document.body.innerText.includes('तात्पुरते बदल')");
  assert.equal((await (await fetch("http://127.0.0.1:5003/api/notice-settings")).json()).customized, false, "failed save never persists");
  await open();
  await mkdir("generated-artifacts/notice-editor", { recursive: true });
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: `${process.cwd()}/generated-artifacts/notice-editor` });
  for (const long of [false, true]) {
    const file = `notice-${long ? "long" : "original"}.pdf`;
    const result = await evaluate(`(async()=>{
      const t=window.noticeTools;
      const matter={...t.DEFAULT_NOTICE_MATTER,body:${long ? "'संपादित मजकूर खाते {accountNumber}. '.repeat(160)" : "t.DEFAULT_NOTICE_MATTER.body"}};
      const html=t.fullNoticeHTML(t.renderNoticeContent({accountNumber:'621',borrowerName:'नमुना ग्राहक',loanDate:'2026-10-31'},matter));
      window.lastNoticeHtml=html;
      return await t.downloadNoticePdf(html,${JSON.stringify(file)});
    })()`);
    assert.ok(result.pages >= (long ? 2 : 1));
    await new Promise(resolve => setTimeout(resolve, 200));
    const info = execFileSync("pdfinfo", [`generated-artifacts/notice-editor/${file}`], { encoding: "utf8" });
    assert.match(info, /Page size:\s+419\.\d+ x 595\.\d+ pts/);
    assert.equal(await evaluate("document.querySelectorAll('iframe').length"), 0);
    console.log(`${file}: ${result.pages} A5 pages; no clipped oversized paragraph and export frame cleaned up`);
  }
  const imageHeight = await evaluate(`(async()=>{
    const data=await window.noticeTools.noticeImageData(window.lastNoticeHtml);
    const img=new Image();img.src=data;await img.decode();return img.naturalHeight;
  })()`);
  assert.ok(imageHeight>1588, "long edited notice image includes full height, not just first A5 page");
  const html = await evaluate("window.lastNoticeHtml");
  await call("Page.navigate", { url: "data:text/html;charset=utf-8," + encodeURIComponent(html) });
  await new Promise(resolve => setTimeout(resolve, 200));
  const native = await call("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  await writeFile("generated-artifacts/notice-editor/notice-long-native.pdf", Buffer.from(native.data, "base64"));
  const nativeText = execFileSync("pdftotext", ["generated-artifacts/notice-editor/notice-long-native.pdf", "-"], { encoding: "utf8" });
  assert.ok(nativeText.length>500, "native print includes long text across pages");
  console.log(`Long image full-height (${imageHeight}px) and native A5 print passed`);
} finally {
  socket.close();
  await fetch(`http://127.0.0.1:9222/json/close/${target.id}`);
}
