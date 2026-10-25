// Synthetic-only browser checks. Requires pledge-forms-preview.ts on 5001 and CDP on 9222.
import WebSocket from "ws";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";

const target = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.on("open", resolve));
let nextId = 0;
const pending = new Map();
ws.on("message", raw => {
  const data = JSON.parse(raw);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result);
  }
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const waitFor = async expression => {
  let lastError;
  for (let i = 0; i < 100; i++) {
    try { if (await evaluate(expression)) return; } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${expression}${lastError ? `; ${lastError.message}` : ""}`);
};
const navigate = async path => {
  await call("Page.navigate", { url: `http://127.0.0.1:5001${path}` });
  await waitFor(`location.pathname===${JSON.stringify(path.split("?")[0])}&&location.search===${JSON.stringify(path.includes("?") ? "?" + path.split("?")[1] : "")}&&document.readyState==='complete'`);
  await evaluate("document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))");
};
const setInput = async (id, value) => evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const clickText = async text => evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!button)throw Error('Button missing');button.click();})()`);
await call("Page.enable");
await fs.mkdir("generated-artifacts/pledge-forms", { recursive: true });
const results = [];
for (const [path, name, expectedPages] of [
  ["/profile-blank", "institution-six-forms", 1],
  ["/profile-blank?layout=spacious", "institution-six-forms-spacious", 2],
  ["/filled?forms=receipt&layout=spacious", "institution-return-receipt", 1],
  ["/?forms=receipt&layout=spacious", "customer-inspection-undertaking", 1],
  ["/", "blank", 1], ["/filled", "filled", 1], ["/all-filled", "all-fields-filled", 1], ["/realistic", "long-name-address", 1], ["/final", "final", 1],
  ["/?layout=spacious", "blank-two-pages", 2], ["/all-filled?layout=spacious", "all-filled-two-pages", 2], ["/realistic?layout=spacious", "long-name-two-pages", 2], ["/final?layout=spacious", "single-final-spacious", 1],
  ["/all-filled?forms=interim,final&layout=spacious", "selected-notices", 1],
  ["/all-filled?forms=loan,final,receipt&layout=spacious", "selected-three-two-pages", 2],
  ...["loan", "declaration", "interim", "receipt", "disposal"].map(form => [`/all-filled?forms=${form}`, `single-${form}`, 1]),
]) {
  await navigate(path);
  const sizes = await evaluate(`({sections:[...document.querySelectorAll('.pf-section')].map(s=>({form:s.dataset.form,height:s.clientHeight,scroll:s.scrollHeight,width:s.clientWidth,scrollWidth:s.scrollWidth,signatureClearance:s.getBoundingClientRect().bottom-s.lastElementChild.getBoundingClientRect().bottom})),pageHeights:[...document.querySelectorAll('.pf-page')].map(p=>p.getBoundingClientRect().height)})`);
  assert.ok(sizes.sections.every(s => s.scroll <= s.height + 2 && s.scrollWidth <= s.width + 2), JSON.stringify({name,...sizes}));
  assert.ok(sizes.sections.every(s => s.signatureClearance >= 3), `Signatures must leave a quiet gap before the cutting border: ${JSON.stringify(sizes)}`);
  assert.ok(sizes.pageHeights.every(height => height <= 287 / 25.4 * 96 + 1), JSON.stringify(sizes));
  assert.equal(sizes.pageHeights.length, expectedPages);
  const geometry = await evaluate(`({
    widths:[...document.querySelectorAll('.pf-page')].map(p=>p.getBoundingClientRect().width),
    formCount:document.querySelectorAll('.pf-section').length,
    bottomGaps:[...document.querySelectorAll('.pf-page')].map(p=>p.getBoundingClientRect().bottom-p.lastElementChild.getBoundingClientRect().bottom)
  })`);
  assert.ok(geometry.widths.every(width => Math.abs(width - 200 / 25.4 * 96) < 1), "A4 must use the 200mm area inside equal 5mm margins");
  if (geometry.formCount === 6) {
    assert.ok(sizes.pageHeights.every(height => Math.abs(height - 287 / 25.4 * 96) < 1), "all-six layouts must use the full A4 content height on every page");
    assert.ok(geometry.bottomGaps.every(gap => Math.abs(gap) < 1), "last receipt must reach the bottom content margin without an unused page gap");
  }
  assert.equal(await evaluate("[...document.querySelectorAll('.pf-signatures')].some(s=>s.textContent.includes('दिनांक'))"), false);
  const pdf = await call("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  const file = `generated-artifacts/pledge-forms/${name}-A4.pdf`;
  await fs.writeFile(file, Buffer.from(pdf.data, "base64"));
  const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
  assert.match(info, new RegExp(`Pages:\\s+${expectedPages}\\b`));
  assert.match(info, /Page size:\s+59[45]\.\d+ x 841\.\d+ pts \(A4\)/);
  results.push({ name, ...sizes, pages: expectedPages });
}
await call("Emulation.setDeviceMetricsOverride", { width: 402, height: 874, deviceScaleFactor: 1, mobile: true });
await navigate("/ui");
await waitFor("!!document.getElementById('borrower-search')||document.body.textContent.includes('कोरा फॉर्म')");
await waitFor("![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='प्रिंट / PDF')?.disabled");
assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='PDF तयार करा')"), false, "separate duplicate PDF action must be removed");
assert.equal(await evaluate("!!document.getElementById('pledge-field-releaseDate')||!!document.getElementById('pledge-field-itemCount')||!!document.getElementById('pledge-field-conditionNote')"), false, "receipt must not request removed date/count/complaint-note fields");
await evaluate(`(()=>{
  window.__pdfDialogCalls=0;
  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
    if(node.tagName==='IFRAME'&&node.title==='A4 फॉर्म प्रिंट') node.addEventListener('load',()=>{node.contentWindow.print=()=>{window.__pdfDialogCalls++;window.__pdfPages=node.contentDocument.querySelectorAll('.pf-page').length;setTimeout(()=>node.contentWindow?.dispatchEvent(new Event('afterprint')),0);};});
  }))).observe(document.body,{childList:true});
})()`);
for (const layout of ["compact", "spacious"]) {
  await evaluate(`document.querySelector('input[value="${layout}"]').click()`);
  await waitFor(`document.querySelector('iframe').contentDocument.querySelector('main')?.dataset.layout==='${layout}'`);
  await clickText("प्रिंट / PDF");
  const expected = layout === "compact" ? 1 : 2;
  await waitFor(`window.__pdfDialogCalls===${expected}`);
  assert.equal(await evaluate("window.__pdfPages"), expected);
  await waitFor("document.body.textContent.includes('Save as PDF')");
  await waitFor("![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='प्रिंट / PDF')?.disabled");
}
await evaluate("document.querySelector('input[value=\"compact\"]').click()");
await evaluate("window.confirm=()=>true");
await setInput("pledge-matter-releaseText", "जुना जतन केलेला मजकूर");
await setInput("pledge-matter-finalTitle", "अंतिम नोटीस कायम");
await evaluate("document.querySelector('[data-testid=\"pledge-use-release-undertaking\"]').click()");
await waitFor("document.getElementById('pledge-matter-releaseText').value.includes('स्वतः तपासल्या')");
assert.equal(await evaluate("document.getElementById('pledge-matter-finalTitle').value"), "अंतिम नोटीस कायम", "new undertaking must not discard other custom wording");
assert.equal(await evaluate("document.getElementById('pledge-matter-releaseText').value.includes('फोटो')"), false);
await setInput("pledge-matter-finalTitle", "अंतिम नोटीस");
await clickText("अनेक");
await clickText("निवड पुसा");
await waitFor("!document.querySelector('iframe')");
assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='प्रिंट / PDF').disabled"), true);
for (const text of ["अंतरिम पूर्वसूचना", "अंतिम नोटीस"]) {
  await evaluate(`[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===${JSON.stringify(text)}).querySelector('input').click()`);
  await waitFor(`[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===${JSON.stringify(text)}).querySelector('input').checked`);
}
await waitFor("document.querySelector('iframe')?.contentDocument.querySelectorAll('[data-form]').length===2");
assert.deepEqual(await evaluate("[...document.querySelector('iframe').contentDocument.querySelectorAll('[data-form]')].map(s=>s.dataset.form)"), ["interim", "final"]);
await evaluate("document.querySelector('input[value=\"spacious\"]').click()");
await waitFor("document.querySelector('iframe').contentDocument.querySelector('main')?.dataset.layout==='spacious'");
assert.equal(await evaluate("document.querySelector('iframe').contentDocument.querySelectorAll('.pf-page').length"), 1);
await clickText("प्रिंट / PDF");
await waitFor("window.__pdfDialogCalls===3");
assert.equal(await evaluate("window.__pdfPages"), 1);
await clickText("सर्व");
await evaluate("document.querySelector('input[value=\"compact\"]').click()");
assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
await clickText("कर्जदार निवडा");
await setInput("borrower-search", "नमुना");
await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('नमुना कर्जदार'))");
await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('नमुना कर्जदार')).click()");
await waitFor("document.getElementById('borrower-name')?.value==='नमुना कर्जदार'");
await waitFor("document.querySelector('iframe')?.contentDocument?.body.textContent.includes('नमुना कर्जदार')");
assert.equal(await evaluate("document.querySelector('iframe').contentDocument.querySelectorAll('[data-form]').length"), 6);
await setInput("pledge-field-accountNumber", "777");
await waitFor("document.querySelector('iframe').contentDocument.body.textContent.includes('777')");
await evaluate(`window.__printCalls=0;new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
  if(node.tagName==='IFRAME'&&node.title==='A4 फॉर्म प्रिंट') node.addEventListener('load',()=>{node.contentWindow.print=()=>{window.__printCalls++;window.__printedText=node.contentDocument.body.textContent;};});
}))).observe(document.body,{childList:true});`);
await clickText("प्रिंट / PDF");
await waitFor("window.__printCalls===1");
await clickText("कोरी प्रत प्रिंट");
await waitFor("window.__printCalls===2");
assert.equal(await evaluate("window.__printedText.includes('नमुना कर्जदार')||window.__printedText.includes('777')"), false);
assert.equal(await evaluate("document.getElementById('borrower-name').value"), "नमुना कर्जदार", "blank-copy printing must not erase the working filled form");
await setInput("borrower-address", "फार मोठा पत्ता ".repeat(120));
await clickText("प्रिंट / PDF");
await waitFor("document.body.textContent.includes('मजकूर A4 नमुन्याच्या जागेपेक्षा मोठा आहे')");
assert.equal(await evaluate("window.__printCalls"), 2, "oversized form must not silently clip or print");
await setInput("borrower-search", "दुसरा");
await waitFor("document.getElementById('borrower-name').value===''");
assert.equal(await evaluate("document.getElementById('pledge-field-accountNumber').value"), "");
assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='प्रिंट / PDF').disabled"), true);
await clickText("कोरा फॉर्म");
await waitFor("!document.querySelector('iframe').contentDocument.body.textContent.includes('नमुना कर्जदार')");
await clickText("एक");
await evaluate("document.getElementById('form-selection').click()");
await waitFor("document.querySelectorAll('[role=option]').length===6");
await evaluate("[...document.querySelectorAll('[role=option]')].find(o=>o.textContent==='अंतिम नोटीस').click()");
await waitFor("document.querySelector('iframe').contentDocument.querySelectorAll('[data-form]').length===1");
assert.equal(await evaluate("document.querySelector('iframe').contentDocument.querySelector('[data-form]').dataset.form"), "final");
await evaluate("window.confirm=()=>true");
await clickText("टाइप करून भरा");
await setInput("borrower-name", "टाइप केलेले नाव");
await setInput("borrower-address", "टाइप केलेला पत्ता");
await setInput("pledge-field-accountNumber", "12345");
await setInput("pledge-matter-finalTitle", "तात्पुरती सूचना");
await waitFor("document.querySelector('iframe').contentDocument.body.textContent.includes('तात्पुरती सूचना')");
await navigate("/ui");
await waitFor("!!document.getElementById('pledge-matter-finalTitle')&&!document.getElementById('pledge-matter-finalTitle').disabled");
assert.equal(await evaluate("document.getElementById('pledge-matter-finalTitle').value"), "अंतिम नोटीस", "temporary edits must not auto-persist");
await evaluate("window.confirm=()=>true");
await setInput("pledge-matter-finalTitle", "जतन केलेली सूचना");
await clickText("डीफॉल्ट जतन करा");
await waitFor("document.body.textContent.includes('संस्थेचा डिफॉल्ट मजकूर अद्ययावत झाला')");
const payload = await evaluate("fetch('/fixture/defaults-payload').then(r=>r.json())");
assert.deepEqual(Object.keys(payload), ["matter"]);
assert.equal(payload.matter.borrowerName, undefined);
await navigate("/ui");
await waitFor("document.getElementById('pledge-matter-finalTitle')?.value==='जतन केलेली सूचना'");
await evaluate("fetch('/fixture/session?tenant=fixture-B').then(r=>r.text())");
await navigate("/ui");
await waitFor("!!document.getElementById('pledge-matter-finalTitle')&&!document.getElementById('pledge-matter-finalTitle').disabled");
assert.equal(await evaluate("document.getElementById('pledge-matter-finalTitle').value"), "अंतिम नोटीस");
await evaluate("fetch('/fixture/session?tenant=fixture-A').then(r=>r.text())");
await navigate("/ui");
await waitFor("document.getElementById('pledge-matter-finalTitle')?.value==='जतन केलेली सूचना'");
await evaluate("window.confirm=()=>true");
await setInput("pledge-matter-finalTitle", "वेगळा तात्पुरता मजकूर");
await clickText("जतन केलेला मजकूर वापरा");
await waitFor("document.getElementById('pledge-matter-finalTitle').value==='जतन केलेली सूचना'");
await clickText("मूळ मजकूर तात्पुरता वापरा");
await waitFor("document.getElementById('pledge-matter-finalTitle').value==='अंतिम नोटीस'");
await navigate("/ui");
await waitFor("document.getElementById('pledge-matter-finalTitle')?.value==='जतन केलेली सूचना'");
await evaluate("window.confirm=()=>true");
await clickText("कंपनीचा डीफॉल्ट मूळ करा");
await waitFor("document.getElementById('pledge-matter-finalTitle').value==='अंतिम नोटीस'");
await evaluate("fetch('/fixture/session?tenant=fixture-A&role=user').then(r=>r.text())");
await call("Emulation.setDeviceMetricsOverride", { width: 320, height: 874, deviceScaleFactor: 1, mobile: true });
await navigate("/ui");
await waitFor("!!document.getElementById('pledge-matter-finalTitle')&&!document.getElementById('pledge-matter-finalTitle').disabled");
assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='डीफॉल्ट जतन करा')"), false);
await setInput("pledge-matter-finalTitle", "वापरकर्त्याची तात्पुरती नोटीस");
await waitFor("document.querySelector('iframe').contentDocument.body.textContent.includes('वापरकर्त्याची तात्पुरती नोटीस')");
assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
results.push({ mobileUI: "pass", selectedBorrower: "pass", typedManualMode: "pass", blankCopyWithoutErasingData: "pass", independentForm: "pass", printHelper: "pass", oversizedTextBlocked: "pass", temporaryMatterNotPersisted: "pass", defaultSaveReloadReset: "pass", tenantIsolation: "pass", regularUserTemporaryOnly: "pass", mobile320px: "pass" });
await navigate("/notice-ui");
await waitFor("!!document.querySelector('input[placeholder^=\"कर्जदार शोधा\"]')");
assert.equal(await evaluate("!!document.querySelector('a[href^=\"/reports/pledge-forms\"]')"), false);
assert.equal(await evaluate("document.body.textContent.includes('नोंदणीपूर्वी ग्राहकाची माहिती टाइप करा')"), false);
assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
await navigate("/reports/pledge-forms");
await waitFor("location.pathname==='/reports/pledge-forms'&&document.querySelector('iframe')?.contentDocument.querySelectorAll('[data-form]').length===6");
assert.equal(await evaluate("document.body.textContent.includes('नोटीसकडे परत')"), false);
await clickText("एक");
await evaluate("document.getElementById('form-selection').click()");
await waitFor("document.querySelectorAll('[role=option]').length===6");
await evaluate("[...document.querySelectorAll('[role=option]')].find(o=>o.textContent.includes('परतफेड')).click()");
await waitFor("document.querySelector('iframe').contentDocument.querySelectorAll('[data-form]').length===1");
assert.equal(await evaluate("document.querySelector('iframe').contentDocument.querySelector('[data-form]').dataset.form"), "receipt");
await clickText("टाइप करून भरा");
await clickText("सर्व");
await waitFor("!!document.getElementById('borrower-name')&&!document.getElementById('borrower-name').disabled");
assert.equal(await evaluate("!!document.getElementById('borrower-search')"), false);
await waitFor("![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='प्रिंट / PDF')?.disabled");
assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
results.push({ independentNoticePage: "pass", independentFormsPage: "pass", receiptViaFormSelection: "pass", internalManualWithoutRegistration: "pass", noticeMobile320px: "pass" });
await waitFor("document.getElementById('pledge-company')?.value==='नमुना फायनान्स'");
await setInput("pledge-company", "टाइप केलेली संस्था");
await setInput("pledge-companyAddress", "प्रिंटसाठी वेगळा पत्ता");
await setInput("pledge-companyContactNumber", "9001112222");
await setInput("pledge-companyLicenseNumber", "PRINT-99");
await waitFor("[...document.querySelector('iframe').contentDocument.querySelectorAll('.pf-organization')].length===6&&[...document.querySelector('iframe').contentDocument.querySelectorAll('.pf-organization')].every(h=>['टाइप केलेली संस्था','प्रिंटसाठी वेगळा पत्ता','9001112222','PRINT-99'].every(v=>h.textContent.includes(v)))");
await clickText("कोरा फॉर्म");
await waitFor("document.querySelector('iframe').contentDocument.querySelector('.pf-organization-name').textContent==='टाइप केलेली संस्था'");
assert.equal(await evaluate("fetch('/api/company').then(r=>r.json()).then(p=>p.name)"), "नमुना फायनान्स");
await setInput("pledge-company", "");
await waitFor("document.querySelector('iframe').contentDocument.querySelector('.pf-organization-name').textContent.includes('संस्था / फर्मचे नाव:')");
await clickText("प्रोफाइलमधील माहिती वापरा");
await waitFor("document.getElementById('pledge-company').value==='नमुना फायनान्स'&&document.getElementById('pledge-companyAddress').value==='मुख्य रस्ता, नमुना गाव'");
assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
results.push({ organizationProfileHeaderOnEachCut: "pass", organizationTypedOverrides: "pass", organizationBlankCopyKeepsHeader: "pass", organizationProfileNotChanged: "pass", organizationReset: "pass" });
await clickText("कर्ज खाते");
await waitFor("!!document.getElementById('pledge-loan-search')");
assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='प्रिंट / PDF').disabled"), true);
await setInput("pledge-loan-search", "621");
await waitFor("document.querySelectorAll('[data-loan-id]').length===4");
assert.equal(await evaluate("document.querySelector('[data-loan-id]').dataset.loanId"), "fixture-loan-621");
await evaluate("document.querySelector('[data-loan-id=\"fixture-loan-621\"]').click()");
await waitFor("document.getElementById('pledge-field-accountNumber').value==='621'&&!document.querySelector('button[data-loan-id]').disabled");
assert.equal(await evaluate("document.getElementById('borrower-name').value"), "नमुना कर्जदार");
assert.equal(await evaluate("document.getElementById('pledge-field-principalAmount').value"), "25000");
assert.equal(await evaluate("document.getElementById('pledge-field-loanDate').value"), "2026-04-05");
assert.equal(await evaluate("document.getElementById('pledge-field-receiptInterest').value"), "");
await waitFor("document.querySelector('iframe').contentDocument.body.textContent.includes('नमुना अंगठी')");
assert.equal(await evaluate("document.getElementById('pledge-company').value"), "नमुना फायनान्स");
await setInput("pledge-field-principalAmount", "26000");
await evaluate("window.__confirmCount=0;window.confirm=()=>{window.__confirmCount++;return false}");
await evaluate("document.querySelector('[data-loan-id=\"fixture-loan-1621\"]').click()");
await waitFor("window.__confirmCount===1");
assert.equal(await evaluate("document.getElementById('pledge-field-accountNumber').value"), "621");
assert.equal(await evaluate("document.getElementById('pledge-field-principalAmount').value"), "26000");
await evaluate("window.confirm=()=>true");
await evaluate("document.querySelector('[data-loan-id=\"fixture-loan-closed\"]').click()");
await waitFor("document.getElementById('pledge-field-accountNumber').value==='622'");
assert.equal(await evaluate("document.getElementById('pledge-field-principalAmount').value"), "25000");
assert.equal(await evaluate("document.getElementById('pledge-field-receiptInterest').value"), "2000");
assert.equal(await evaluate("document.getElementById('pledge-field-receiptTotal').value"), "27000");
await evaluate("document.querySelector('[data-loan-id=\"fixture-loan-failed\"]').click()");
await waitFor("document.body.textContent.includes('बंद खात्याची समाप्ती माहिती मिळाली नाही')");
assert.equal(await evaluate("document.getElementById('pledge-field-accountNumber').value"), "622", "failed closure lookup must not replace selected account");
await evaluate("document.querySelector('[data-loan-id=\"fixture-loan-621\"]').click()");
await waitFor("document.getElementById('pledge-field-accountNumber').value==='621'");
assert.equal(await evaluate("document.getElementById('pledge-field-receiptInterest').value"), "", "active account must clear prior closure money");
await evaluate("document.querySelector('[data-loan-id=\"fixture-loan-closed\"]').click()");
await waitFor("document.body.textContent.includes('खात्याची संपूर्ण माहिती तपासत आहोत')");
await setInput("pledge-loan-search", "none");
await waitFor("document.body.textContent.includes('या शोधासाठी खाते सापडले नाही')");
await evaluate("new Promise(resolve=>setTimeout(resolve,450))");
assert.equal(await evaluate("document.getElementById('pledge-field-accountNumber').value"), "621", "stale closure response must not replace account after changing search");
await setInput("pledge-loan-search", "error");
await waitFor("document.body.textContent.includes('खात्यांचा शोध पूर्ण झाला नाही')");
await setInput("pledge-loan-search", "6");
await waitFor("document.querySelectorAll('[data-loan-id]').length===4");
assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
await clickText("टाइप करून भरा");
await waitFor("!document.getElementById('pledge-loan-search')");
await setInput("borrower-name", "हाताने भरलेले नाव");
assert.equal(await evaluate("document.getElementById('borrower-name').value"), "हाताने भरलेले नाव");
await evaluate("window.confirm=()=>false");
await clickText("कर्ज खाते");
assert.equal(await evaluate("!!document.getElementById('pledge-loan-search')"), false);
assert.equal(await evaluate("document.getElementById('borrower-name').value"), "हाताने भरलेले नाव");
await evaluate("window.confirm=()=>true");
await clickText("कर्ज खाते");
await waitFor("!!document.getElementById('pledge-loan-search')");
await clickText("कर्जदार निवडा");
await waitFor("!!document.getElementById('borrower-search')");
await clickText("कोरा फॉर्म");
await waitFor("!document.getElementById('borrower-search')");
results.push({ loanExactAccountFirst: "pass", loanAutoFill: "pass", closureAutoFill: "pass", overwriteConfirmCancel: "pass", noStaleClosureMoney: "pass", closureFailurePreservesForm: "pass", loanSearchEmptyErrorOneDigit: "pass", originalModesPreserved: "pass", loanMobile320px: "pass" });
console.log(JSON.stringify(results, null, 2));
await call("Page.close");
ws.close();
