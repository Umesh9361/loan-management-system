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
try {
  for (const width of [360, 1280]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
    await call("Page.navigate", { url: "http://127.0.0.1:5001/" });
    for (let n = 0; n < 100; n++) {
      if (await evaluate("!!document.querySelector('.aso')")) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(await evaluate("document.querySelectorAll('.aso-total').length"), 0);
    assert.equal(await evaluate("document.querySelectorAll('#group-performance-section .grid.grid-cols-2.lg\\\\:grid-cols-4').length"), 0);
    let values = await evaluate(totals);
    for (const amount of ["25,000", "18,000", "7,000", "1,500"]) assert.ok(values.includes(amount), `${width}: ${amount} in canonical totals`);
    const visibleMain = await evaluate(`(()=>{
      const walker=document.createTreeWalker(document.getElementById('root'),NodeFilter.SHOW_TEXT);
      let text='',node;while(node=walker.nextNode()){
        const parent=node.parentElement;
        if(parent&&!parent.closest('.aso,#group-performance-section,style,svg')&&parent.getBoundingClientRect().width>0)text+=node.textContent+' ';
      }return text;
    })()`);
    assert.equal((visibleMain.match(/25,000/g)||[]).length, 1, "grand disbursement shown once outside charts");
    const before = values;
    const dates = await evaluate("[...document.querySelectorAll('input[type=date]')].map(n=>n.value)");
    await click("[...document.querySelectorAll('label')].find(n=>n.textContent.includes('आजपर्यंतचे सर्व व्याज')).querySelector('input').click()");
    values = await evaluate(totals);
    assert.ok(values.includes("1,600"), "lifetime interest includes previous FY");
    for (const amount of ["25,000", "18,000", "7,000"]) assert.ok(values.includes(amount), "principal unaffected");
    await click("[...document.querySelectorAll('label')].find(n=>n.textContent.includes('आजपर्यंतचे सर्व व्याज')).querySelector('input').click()");
    assert.equal(await evaluate(totals), before, "FY interest restored");
    await click("[...document.querySelectorAll('button')].find(n=>n.textContent.trim()==='कालावधी हिशोब').click()");
    values = await evaluate(totals);
    for (const amount of ["12,000", "17,000", "5,000", "1,500"]) assert.ok(values.includes(amount), `period independently calculated: ${amount}`);
    await click("[...document.querySelectorAll('button')].find(n=>n.textContent.trim()==='एकूण हिशोब').click()");
    assert.deepEqual(await evaluate("[...document.querySelectorAll('input[type=date]')].map(n=>n.value)"), dates);
    assert.equal(await evaluate(totals), before);
    assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "no horizontal overflow");
    assert.ok((await evaluate(outsideCharts)).includes("आजपर्यंतचे सर्व व्याज"));
    console.log(`${width}px: single summary presentation, FY/lifetime/period calculations and date isolation passed`);
  }
} finally {
  socket.close();
  await fetch(`http://127.0.0.1:9222/json/close/${target.id}`);
}
