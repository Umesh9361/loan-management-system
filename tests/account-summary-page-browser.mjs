// Run synthetic account-summary-page-preview.tsx on 5001 and Chromium CDP on 9222.
import assert from "node:assert/strict";
import WebSocket from "ws";
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
const outsideCharts = `(()=>{const root=document.getElementById('root').cloneNode(true);
 root.querySelectorAll('.aso,#group-performance-section,style,svg').forEach(node=>node.remove());
 return root.innerText||root.textContent;})()`;
// Check visible responsive totals separately: both desktop and mobile remain in the DOM.
const totals = `(()=>{
 const table=[...document.querySelectorAll('table')].find(node=>node.getBoundingClientRect().width>0);
 if(table)return (table.querySelector('tfoot tr')||[...table.querySelectorAll('tr')].at(-1)).innerText;
 return [...document.querySelectorAll('div')].find(node=>node.firstElementChild?.textContent==='एकूण योग').innerText;
})()`;
const click = expression => evaluate(`(async()=>{${expression};await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()`);
const waitFor = async expression => {
  for (let n = 0; n < 100; n++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Timed out: ${expression}`);
};
const button = label => `[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===${JSON.stringify(label)}).click()`;
const positionText = "document.querySelector('[data-testid=\"account-summary-current-position\"] .aso-position').innerText";
const setInput = (selector, value) => click(`{
 const input=document.querySelector(${JSON.stringify(selector)});
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
 input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
}`);
try {
  for (const width of [360, 1280]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
    await call("Page.navigate", { url: "http://127.0.0.1:5001/" });
    await waitFor("!!document.querySelector('[data-testid=\"account-summary-current-position\"]')");
    assert.equal(await evaluate("document.querySelectorAll('.aso-total').length"), 0);
    assert.equal(await evaluate("document.querySelectorAll('input[type=date]').length"), 0, "today has no date pickers");
    assert.equal(await evaluate("document.querySelector('[data-testid=\"account-summary-recorded-transactions\"]').open"), false);
    assert.equal(await evaluate("document.querySelectorAll('fieldset input[type=checkbox]').length"), 1, "one unified print option");
    let values = await evaluate(positionText);
    for (const amount of ["7,000", "1,500", "1.25"]) assert.ok(values.includes(amount), `${width}: today ${amount}`);
    assert.ok(values.includes("2 सक्रिय खाती"));
    assert.ok(!values.includes("25,000") && !values.includes("18,000"), "no lifetime turnover in current position");
    const before = values;
    await click("[...document.querySelectorAll('label')].find(n=>n.textContent.includes('आजपर्यंतचे सर्व व्याज')).querySelector('input').click()");
    values = await evaluate(positionText);
    assert.ok(values.includes("1,600"), "lifetime interest includes previous FY");
    for (const amount of ["7,000", "1.25"]) assert.ok(values.includes(amount), "principal and weights unaffected");
    await click("[...document.querySelectorAll('label')].find(n=>n.textContent.includes('आजपर्यंतचे सर्व व्याज')).querySelector('input').click()");
    assert.equal(await evaluate(positionText), before, "FY interest restored");
    const years = await evaluate("[...document.querySelectorAll('[data-testid=\"account-summary-year\"]')].map(n=>n.innerText)");
    assert.equal(years.length, 3, "years without activity remain visible, not silently skipped");
    assert.ok(years.at(-1).includes("12,000") && years.at(-1).includes("1,500"), "annual flow independent of stock");
    await click("document.querySelector('[data-testid=\"account-summary-recorded-transactions\"] summary').click()");
    values = await evaluate(totals);
    for (const amount of ["25,000", "18,000", "7,000", "1,500"]) assert.ok(values.includes(amount), "original historical transaction totals retained");
    if (width === 360) {
      assert.ok(values.includes("सक्रिय सोने वजन") && values.includes("सक्रिय चांदी"), "weight scope is explicit");
      assert.equal((values.match(/1\.25/g) || []).length, 2, "grand-total raw gold and silver weights match current position, excluding closed loans");
    }
    await click(button("कालावधी हिशोब"));
    assert.equal(await evaluate("document.querySelectorAll('input[type=date]').length"), 2);
    const periodDates = await evaluate("[...document.querySelectorAll('input[type=date]')].map(n=>n.value)");
    values = await evaluate(totals);
    for (const amount of ["12,000", "17,000", "5,000", "1,500"]) assert.ok(values.includes(amount), `period independently calculated: ${amount}`);
    const priorStart = `${Number(periodDates[0].slice(0, 4)) - 2}-04-01`;
    await setInput("#fromDate", priorStart);
    await click(button("आजची स्थिती"));
    assert.equal(await evaluate("document.querySelectorAll('input[type=date]').length"), 0);
    assert.equal(await evaluate(positionText), before, "period custom dates never affect today's FY interest");
    await click(button("कालावधी हिशोब"));
    assert.equal(await evaluate("document.querySelector('#fromDate').value"), priorStart, "custom period retained");
    await click(button("कस्टमर नावाप्रमाणे"));
    assert.deepEqual(await evaluate("[...document.querySelectorAll('input[type=date]')].map(n=>n.value)"), periodDates, "customer period independent");
    await click(button("आजची स्थिती"));
    await setInput("#customerSearch", "नमुना");
    await waitFor("[...document.querySelectorAll('button')].some(n=>n.textContent.trim()==='नमुना ग्राहक 2')");
    await click(button("नमुना ग्राहक 2"));
    values = await evaluate(positionText);
    assert.ok(values.includes("5,000") && values.includes("1 सक्रिय खाती"), "specific customer snapshot scoped correctly");
    assert.ok(!values.includes("7,000"), "all-business amounts do not leak into customer view");
    await click("document.querySelector('fieldset input[type=checkbox]').click()");
    await click(button("टॉप 50 व्यवहार"));
    assert.equal(await evaluate("document.querySelectorAll('.aso').length"), 0, "no summary or annual overview for top50");
    assert.equal(await evaluate("document.querySelector('[data-testid=\"account-summary-recorded-transactions\"]').open"), true, "top50 table immediately available");
    assert.equal(await evaluate("document.querySelectorAll('fieldset input[type=checkbox]').length"), 0, "top50 cannot add unsupported summary charts");
    assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "no horizontal overflow");
    assert.ok((await evaluate(outsideCharts)).includes("आजपर्यंतचे सर्व व्याज"));
    console.log(`${width}px: current stock, annual flows, FY/lifetime, legacy table, period isolation, customer scope and top50 passed`);
    await call("Page.navigate", { url: "http://127.0.0.1:5001/?history=century" });
    await waitFor("document.querySelectorAll('[data-testid=\"account-summary-year\"]').length===5");
    const currentYear = Number(await evaluate("[...document.querySelectorAll('[data-testid=\"account-summary-year\"] h4')].at(-1).textContent.slice(0,4)"));
    const centuryPosition = await evaluate(positionText);
    await click(button("मागील 10 वर्षे"));
    assert.equal(await evaluate("document.querySelectorAll('[data-testid=\"account-summary-year\"]').length"), 10);
    assert.equal(await evaluate(positionText), centuryPosition, "comparison preset leaves current position untouched");
    await click(button("वर्षे निवडा"));
    await setInput('input[aria-label="पासूनचे आर्थिक वर्ष"]', String(currentYear - 2));
    await setInput('input[aria-label="पर्यंतचे आर्थिक वर्ष"]', String(currentYear - 1));
    assert.equal(await evaluate("document.querySelectorAll('[data-testid=\"account-summary-year\"]').length"), 2);
    assert.equal(await evaluate("document.querySelectorAll('.aso-partial').length"), 0, "completed-year custom range excludes current partial year");
    assert.equal(await evaluate(positionText), centuryPosition, "custom range does not filter stock or interest");
    await setInput('input[aria-label="पासूनचे आर्थिक वर्ष"]', String(currentYear));
    assert.ok(await evaluate("!!document.querySelector('.aso-year-error[role=alert]')"), "reversed selection has explicit error");
    assert.equal(await evaluate("document.querySelectorAll('[data-testid=\"account-summary-year\"]').length"), 0, "invalid range never leaves stale bars");
    await click("document.querySelector('fieldset input[type=checkbox]').click()");
    await evaluate("window.alert=message=>window.lastSummaryAlert=message");
    await click(button("PDF डाउनलोड"));
    assert.ok((await evaluate("window.lastSummaryAlert")).includes("वैध आर्थिक वर्षे"), "invalid comparison cannot be exported as valid analysis");
    await setInput('input[aria-label="पासूनचे आर्थिक वर्ष"]', String(currentYear - 2));
    await click(button("कस्टमर नावाप्रमाणे"));
    await setInput("#customerSearch", "नमुना");
    await waitFor("[...document.querySelectorAll('button')].some(n=>n.textContent.trim()==='नमुना ग्राहक 2')");
    await click(button("नमुना ग्राहक 2"));
    assert.equal(await evaluate("[...document.querySelectorAll('.aso-year-choice[aria-pressed=true]')][0].textContent"), "मागील 5 वर्षे", "customer comparison independent");
    await click(button("मागील 10 वर्षे"));
    await click(button("गट प्रमाणे"));
    assert.equal(await evaluate("document.querySelector('input[aria-label=\"पासूनचे आर्थिक वर्ष\"]').value"), String(currentYear - 2), "group custom years restored");
    assert.equal(await evaluate("document.querySelector('input[aria-label=\"पर्यंतचे आर्थिक वर्ष\"]').value"), String(currentYear - 1));
    assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "custom-year controls have no horizontal overflow");
    console.log(`${width}px: century-old history bounded to 5/10/custom FYs, validation and independent selections passed`);
  }
} finally {
  socket.close();
  await fetch(`http://127.0.0.1:9222/json/close/${target.id}`);
}
