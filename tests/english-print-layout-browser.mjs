// Real component print actions + original generators; synthetic data only.
import WebSocket from "ws";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const out = "generated-artifacts/english-print-audit";
await mkdir(out, { recursive: true });
const target = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.on("open", resolve));
let id = 0; const requests = new Map();
ws.on("message", raw => {
  const msg = JSON.parse(raw), request = requests.get(msg.id);
  if (request) { requests.delete(msg.id); msg.error ? request.reject(Error(JSON.stringify(msg.error))) : request.resolve(msg.result); }
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  requests.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function paperWidth(html) {
  const rules=[...html.matchAll(/@page\s*\{([^}]+)}/g)].map(m=>m[1]);
  const css=rules.join(";"), landscape=/size:\s*A4\s+landscape/i.test(css);
  const width=/size:\s*A5/i.test(css)?148:landscape?297:210;
  const margins=[...css.matchAll(/(?:^|[;{])\s*margin:\s*([^;!}]+)/g)].at(-1)?.[1].match(/[\d.]+mm/g)?.map(v=>parseFloat(v))||[5];
  const right=margins[1]??margins[0],left=margins[3]??right;
  return Math.round((width-left-right)*96/25.4);
}
const capture = `(() => {
  window.__prints=[];
  const capture=w=>{try{window.__prints.push('<!doctype html>'+w.document.documentElement.outerHTML)}catch{}};
  window.print=()=>capture(window);
  const open=window.open.bind(window);
  window.open=(...args)=>{const w=open(...args);if(w){
    w.print=()=>capture(w);w.close=()=>{};
    const close=w.document.close.bind(w.document);w.document.close=()=>{close();capture(w)};
  }return w};
  const descriptor=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'contentWindow');
  Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{...descriptor,get(){const w=descriptor.get.call(this);try{w.print=()=>capture(w)}catch{}return w}});
  window.alert=message=>{window.__lastAlert=String(message)};
  window.confirm=()=>true;
})();`;
const geometry = `(() => {
  const body=document.body.getBoundingClientRect(), cells=[...document.querySelectorAll('td,th,p,label,h1,h2,h3')].filter(e=>e.getBoundingClientRect().height>0);
  const overflow=cells.filter(e=>e.scrollWidth>e.clientWidth+3).map(e=>({tag:e.tagName,text:e.innerText.slice(0,100),width:e.clientWidth,scroll:e.scrollWidth}));
  const small=cells.filter(e=>e.childNodes.length&&parseFloat(getComputedStyle(e).fontSize)<10).map(e=>({tag:e.tagName,text:e.innerText.slice(0,65),px:getComputedStyle(e).fontSize}));
  const sections=[...document.querySelectorAll('.pf-section')].map(e=>({class:e.className,overflow:e.scrollHeight-e.clientHeight}));
  return {language:document.documentElement.lang,bodyWidth:body.width,scrollWidth:document.body.scrollWidth,overflow,small,sections,text:document.body.innerText.slice(0,240)};
})()`;
const audit = [];
try {
  await call("Page.enable"); await call("Runtime.enable");
  if(!process.env.PURE_ONLY) await call("Page.addScriptToEvaluateOnNewDocument", { source: capture });
  await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const pages = process.env.PURE_ONLY ? [] : (await (await fetch("http://127.0.0.1:5003/fixture-pages")).json())
    .filter(p => p.startsWith("reports/") || p.startsWith("receipt/") || ["loans", "closure"].includes(p))
    .filter(p=>!process.env.PRINT_PAGES||process.env.PRINT_PAGES.split(",").includes(p));
  for (const page of pages) {
    await call("Emulation.setEmulatedMedia", { media: "screen" });
    await call("Page.navigate", { url: `http://127.0.0.1:5003/?page=${page}&language=en&loanId=fixture-loan` });
    await pause(1200);
    await evaluate(`(() => {
      const dates=[...document.querySelectorAll('input[type=date]')];
      for(const [i,input] of dates.entries()){
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, dates.length===1||i%2?'2030-11-16':'2020-04-01');
        input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
      }
      for(const input of document.querySelectorAll('input[type=number]'))if(!input.value){
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, Number(input.max)>0&&Number(input.max)<=100?'80':'1000');
        input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
      }
    })()`);
    for(let round=0;round<3;round++){
    const comboboxes=await evaluate("document.querySelectorAll('button[role=combobox]').length");
    for(let i=0;i<comboboxes;i++){
      const choose=await evaluate(`(()=>{const b=document.querySelectorAll('button[role=combobox]')[${i}];if(b&&!b.disabled&&/select/i.test(b.innerText)){b.click();return true}return false})()`);
      if(choose){await pause(100);await evaluate("(()=>{const opts=[...document.querySelectorAll('[role=option]:not([data-disabled])')];(opts.find(o=>/राम|621|borrower/i.test(o.innerText))||opts[0])?.click()})()");await pause(100)}
    }
    }
    await evaluate(`(()=>{
      for(const input of document.querySelectorAll('input[type=text]'))if(!input.value&&/proprietor|owner/i.test(input.placeholder+' '+input.id+' '+input.name+' '+input.closest('div')?.innerText)){
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Sample Proprietor');
        input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
      }
    })()`);
    let buttons = await evaluate("[...document.querySelectorAll('button')].filter(b=>!b.disabled).map(b=>b.innerText.trim())");
    const generate = buttons.find(t => /^(generate|search|show|view report|create report)/i.test(t));
    if (generate) {
      await evaluate(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===${JSON.stringify(generate)})?.click()`);
      await pause(600);
    }
    buttons = await evaluate("[...document.querySelectorAll('button')].filter(b=>!b.disabled).map(b=>b.innerText.trim())");
    const print = buttons.find(t => /print/i.test(t) && !/settings|preview|pdf/i.test(t));
    if (print) {
      await evaluate(`[...document.querySelectorAll('button')].find(b=>!b.disabled&&b.innerText.trim()===${JSON.stringify(print)})?.click()`);
      for (let n = 0; n < 100 && !(await evaluate("window.__prints.length")); n++) await pause(100);
    } else {
      await evaluate("[...document.querySelectorAll('button')].find(b=>!b.disabled&&b.querySelector('svg.lucide-printer'))?.click()");
      await pause(1200);
    }
    const raw = await evaluate("window.__prints[0]||[...document.querySelectorAll('iframe')].map(f=>f.contentDocument).find(d=>d?.body?.querySelector('table'))?.documentElement.outerHTML||null");
    const html = raw?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    const name = page.replaceAll("/", "-");
    if (!html) {
      const reason = await evaluate("document.querySelector('[data-fixture-error]')?.textContent||window.__lastAlert||document.body.innerText.slice(-220)");
      audit.push({ page, captured: false, buttons, reason });
      console.log("NEEDS INPUT", page, reason?.slice(0,100));
      continue;
    }
    await writeFile(`${out}/${name}.html`, html);
    await call("Emulation.setDeviceMetricsOverride", { width: paperWidth(html), height: 1085, deviceScaleFactor: 1, mobile: false });
    const { frameTree } = await call("Page.getFrameTree");
    await call("Page.setDocumentContent", { frameId: frameTree.frame.id, html });
    await evaluate("document.fonts.ready");
    await call("Emulation.setEmulatedMedia", { media: "print" });
    const result = await evaluate(geometry);
    const pdf = await call("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    await writeFile(`${out}/${name}.pdf`, Buffer.from(pdf.data, "base64"));
    audit.push({ page, captured: true, ...result });
    console.log("PRINT", page, "overflow", result.overflow.length, "small", result.small.length);
    await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  }
  await call("Emulation.setEmulatedMedia", { media: "screen" });
  await call("Page.navigate", {url:"http://127.0.0.1:5003/?page=reports/pledge-forms&language=en"});
  for(let n=0;n<100&&!(await evaluate("!!window.localeTools?.englishPrintSamples"));n++)await pause(100);
  const samples=process.env.NO_SAMPLES?[]:await evaluate("window.localeTools.englishPrintSamples()");
  await call("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:`${process.cwd()}/${out}`});
  const direct=[];
  for(const name of process.env.SKIP_DIRECT||process.env.NO_SAMPLES?[]:["en-forms-compact","en-forms-spacious","en-summary-overview","en-loss-long","en-notice-filled"]){
    const sample=samples.find(s=>s.name===name);
    try{
      console.log("DIRECT",name);
      const args = name.includes("notice") ? "" : `,${sample.pageSelector?JSON.stringify(sample.pageSelector):"undefined"},${JSON.stringify(/size:\s*A4\s+landscape/i.test(sample.html)?"landscape":"portrait")}`;
      await evaluate(`window.localeTools.${name.includes("notice")?"downloadNoticePdf":"downloadPrintDocumentPdf"}(${JSON.stringify(sample.html)},${JSON.stringify("direct-"+name+".pdf")}${args})`);
      direct.push({name,success:true});
      console.log("DIRECT PASS",name);
    }catch(error){direct.push({name,success:false,error:String(error)});}
  }
  for(const sample of process.env.DIRECT_ONLY?[]:samples){
    await call("Emulation.setDeviceMetricsOverride",{width:paperWidth(sample.html),height:1085,deviceScaleFactor:1,mobile:false});
    const {frameTree}=await call("Page.getFrameTree");
    await call("Page.setDocumentContent",{frameId:frameTree.frame.id,html:sample.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")});
    await evaluate("document.fonts.ready");
    await call("Emulation.setEmulatedMedia",{media:"print"});
    const result=await evaluate(geometry);
    const pdf=await call("Page.printToPDF",{preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
    await writeFile(`${out}/${sample.name}.pdf`,Buffer.from(pdf.data,"base64"));
    await writeFile(`${out}/${sample.name}.html`,sample.html);
    const info=execFileSync("pdfinfo",[`${out}/${sample.name}.pdf`],{encoding:"utf8"});
    const pages=Number(info.match(/Pages:\s+(\d+)/)?.[1]);
    audit.push({page:sample.name,captured:true,pages,...result});
    console.log("DOCUMENT",sample.name,"overflow",result.overflow.length,"sections",result.sections.filter(s=>s.overflow>2));
  }
  await writeFile(`${out}/audit${process.env.PURE_ONLY?"-samples":process.env.NO_SAMPLES?"-pages":""}.json`, JSON.stringify(audit, null, 2));
  if(direct.length)await writeFile(`${out}/direct-pdf-audit.json`,JSON.stringify(direct,null,2));
  const critical=audit.filter(r=>r.page.startsWith("en-")&&r.captured&&(r.overflow.length||r.sections.some(s=>s.overflow>2)||(r.page==="en-forms-compact"&&r.pages!==1)||(r.page==="en-forms-spacious"&&r.pages!==2)));
  if(critical.length||direct.some(r=>!r.success))throw Error(`English print/PDF failures: ${JSON.stringify({critical:critical.map(r=>r.page),direct})}`);
  console.log("Captured", audit.filter(a=>a.captured).length, "of", audit.length);
} finally { await call("Page.close").catch(()=>{}); ws.close(); }
