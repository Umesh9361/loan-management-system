import assert from "node:assert/strict";
import WebSocket from "ws";
import { mkdir, writeFile } from "node:fs/promises";
const target = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.on("open", resolve));
let id = 0;
const pending = new Map();
const errors = [];
socket.on("message", raw => {
  const message = JSON.parse(raw), item = pending.get(message.id);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
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
async function waitFor(expression, limit = 150) {
  for (let n = 0; n < limit; n++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Timed out: ${expression}`);
}
const out = "generated-artifacts/language";
await mkdir(out, { recursive: true });
try {
  await call("Page.enable"); await call("Runtime.enable");
  const audit = [];
  for (const width of [360, 1280]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 360 });
    for (const page of await (await fetch("http://127.0.0.1:5003/fixture-pages")).json()) {
      await call("Page.navigate", { url: `http://127.0.0.1:5003/?page=${page}&language=en` });
      await waitFor("document.getElementById('root')?.textContent.length>3", 30).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 300));
       const texts = await evaluate(`(()=>{const out=[],w=document.createTreeWalker(document.getElementById('root'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const p=n.parentElement;if(p&&!p.closest('script,style,noscript')&&p.getClientRects().length&&/[\\u0900-\\u097f]/.test(n.textContent))out.push(n.textContent.trim());}return out;})()`);
      const fixtureError = await evaluate("document.querySelector('[data-fixture-error]')?.textContent||(!document.getElementById('root')?.textContent.trim()?'This utility needs route-specific inputs':null)");
      audit.push({ width, page, fixtureError, remaining: [...new Set(texts)] });
      if (["login", "reports/pledge-forms", "reports/account-summary", "mobile-cashbook"].includes(page)) {
        const image = await call("Page.captureScreenshot", { format: "png" });
        await writeFile(`${out}/${page.replaceAll("/", "-")}-${width}.png`, Buffer.from(image.data, "base64"));
      }
      console.log(`${width} ${page}:`, fixtureError || [...new Set(texts)].slice(0, 8));
    }
  }
  await writeFile(`${out}/screen-audit.json`, JSON.stringify(audit, null, 2));
  assert(!audit.some(entry => entry.fixtureError), "A page needs a complete synthetic API fixture; see screen-audit.json");
  assert.equal(errors.length, 0, errors.join("\n"));
   const originalData = ["नमुना फायनान्स","नमुना गाव","नमुना गट","नमुना मालक","राम पाटील","ठुशी"];
   const remainingUi = audit.flatMap(entry => entry.remaining
     .filter(text => /[\u0900-\u097f]/.test(originalData.reduce((value, marker) => value.replaceAll(marker, ""), text)))
     .map(text => ({page:entry.page,width:entry.width,text})));
   assert.deepEqual(remainingUi, [], "Untranslated application text remains beyond original customer/company data");
  // The very same customer values must survive document language changes.
  const forms = await evaluate(`window.localeTools.pledgeFormsDocument({
    company:"नमुना फायनान्स",borrowerName:"राम पाटील",borrowerAddress:"नमुना गाव",
    accountNumber:"621",loanDate:"2024-06-15",principalAmount:"10000",
    loanItems:[{description:"ठुशी",purity:"80",weight:"20",value:"100000"}]
  },"all",window.localeTools.defaultPledgeMatter("en"),"spacious")`);
  assert(forms.includes("राम पाटील")); assert(forms.includes("ठुशी"));
  assert(!forms.includes("तारण कर्ज व्यवहार नोंद व पावती"));
  await writeFile(`${out}/english-forms.html`, forms);
  const { frameTree } = await call("Page.getFrameTree");
  await call("Page.setDocumentContent", { frameId: frameTree.frame.id, html: forms });
  await evaluate("document.fonts.ready");
  const untranslatedDocument = await evaluate(`document.body.innerText.replaceAll("नमुना फायनान्स","").replaceAll("राम पाटील","").replaceAll("नमुना गाव","").replaceAll("ठुशी","").match(/[\\u0900-\\u097f][^\\n]*/g)||[]`);
  assert.deepEqual(untranslatedDocument, [], "only original customer/company data may remain Marathi");
  const pdf = await call("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  await writeFile(`${out}/english-forms-print.pdf`, Buffer.from(pdf.data, "base64"));
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: `${process.cwd()}/${out}` });
  await evaluate(`window.localeTools.downloadPrintDocumentPdf(${JSON.stringify(forms)}, "english-forms-download.pdf", ".pf-page")`);
  await writeFile(`${out}/screen-audit.json`, JSON.stringify(audit, null, 2));
  // Explicit reverse selection on the login screen.
  await call("Page.navigate", { url: "http://127.0.0.1:5003/?page=login&language=en" });
  await waitFor("!!document.querySelector('input')");
  await evaluate("[...document.querySelectorAll('button[aria-pressed]')].find(n=>n.textContent.includes('Marathi')||n.textContent.includes('मराठी')).click()");
  assert.equal(await evaluate("localStorage.getItem('language')"), "mr");
  assert((await evaluate("document.body.innerText")).includes("कंपनी ओळखकर्ता"));
  console.log("English/Marathi reverse selection and English A4 forms with original customer data passed");
} finally { await call("Page.close").catch(() => {}); socket.close(); }
