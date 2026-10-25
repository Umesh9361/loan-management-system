import { DEFAULT_PLEDGE_MATTER, type PledgeFormData, type PledgeFormMatter, type PledgeItem } from "@shared/pledge-form-editor";
import { PLEDGE_FORM_POLISH_STYLES } from "./pledge-form-polish-styles";
export type { PledgeFormData } from "@shared/pledge-form-editor";
export type PledgeFormKey = "loan" | "declaration" | "interim" | "final" | "receipt" | "disposal";
export type PledgeFormSelection = "all" | PledgeFormKey;
export type PledgeFormChoice = PledgeFormSelection | readonly PledgeFormKey[];
export type PledgeFormLayout = "compact" | "spacious";
export const PLEDGE_FORM_OPTIONS: readonly { value: PledgeFormSelection; label: string }[] = [
  { value: "all", label: "सर्व सहा नमुने" },
  { value: "loan", label: "तारण कर्ज नोंद व पावती" },
  { value: "declaration", label: "मालकी व व्यवहाराचे घोषणापत्र" },
  { value: "interim", label: "अंतरिम पूर्वसूचना" },
  { value: "final", label: "अंतिम नोटीस" },
  { value: "receipt", label: "परतफेड व वस्तू परत मिळाल्याची पावती" },
  { value: "disposal", label: "तारण वस्तू विक्री / निपटारा पावती" },
];
const formOrder = PLEDGE_FORM_OPTIONS.filter(option => option.value !== "all").map(option => option.value as PledgeFormKey);
export function getSelectedPledgeForms(choice: PledgeFormChoice): PledgeFormKey[] {
  const values = choice === "all" ? formOrder : typeof choice === "string" ? [choice] : choice;
  if (!Array.isArray(values) || values.some(value => !formOrder.includes(value as PledgeFormKey))) throw new Error("चुकीचा फॉर्म पर्याय.");
  return formOrder.filter(key => values.includes(key));
}
/** Pack complete fixed-size pieces; no extra blank pages or split receipts. */
export function getPledgePageGroups(choice: PledgeFormChoice, layout: PledgeFormLayout): PledgeFormKey[][] {
  const keys = getSelectedPledgeForms(choice);
  if (!keys.length) return [];
  if (layout === "compact" || keys.length === 1) return [keys];
  const heights: Record<PledgeFormKey, number> = { loan: 100, declaration: 76, interim: 98, final: 88, receipt: 96, disposal: 90 };
  const groups: PledgeFormKey[][] = [];
  let group: PledgeFormKey[] = [], height = 0;
  for (const key of keys) {
    const nextHeight = heights[key] + (group.length ? 2 : 0);
    if (height + nextHeight > 280) { groups.push(group); group = []; height = 0; }
    height += heights[key] + (group.length ? 2 : 0);
    group.push(key);
  }
  if (group.length) groups.push(group);
  return groups;
}
export const englishFormDigits = (value = "") => value.replace(/[०-९]/g, digit => String("०१२३४५६७८९".indexOf(digit)));
const safe = (value = "") => englishFormDigits(String(value)).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const date = (value?: string) => {
  const normalized = englishFormDigits(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized.split("-").reverse().join("/") : normalized;
};
const amount = (value?: string) => {
  const raw = englishFormDigits(value).trim().replace(/,/g, "");
  const number = Number(raw);
  return raw && Number.isFinite(number) && number >= 0 ? number.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : raw;
};
const blankDate = "____/____/________";
const line = (label: string, value = "", extra = "") => `<div class="pf-line ${extra}"><span>${safe(label)}</span><span class="pf-fill">${value ? safe(value) : "&nbsp;"}</span></div>`;
const moneyLines = (rows: [string, string?][]) => rows.map(([label, value]) => line(label, amount(value))).join("");
const signatures = (middle = false) => `<div class="pf-signatures">${[
  "कर्जदाराची सही / अंगठा", ...(middle ? ["साक्षीदाराची सही"] : []), "सावकाराची सही",
].map(label => `<div><strong>${label}</strong></div>`).join("")}</div>`;
const goodsTable = (items?: PledgeItem[], disposal = false) => `<table class="pf-table"><colgroup><col style="width:7%"><col style="width:35%"><col style="width:18%"><col style="width:18%"><col style="width:22%"></colgroup><thead><tr><th>अ.क्र.</th><th>वस्तूचे वर्णन</th><th>शुद्धता / कॅरेट</th><th>वजन (ग्रॅम)</th><th>${disposal ? "विक्री रक्कम (₹)" : "अंदाजे किंमत (₹)"}</th></tr></thead><tbody>${[0, 1, 2].map(index => {
  const item = items?.[index];
  return `<tr><td>${index + 1}</td><td>${safe(item?.description)}</td><td>${safe(item?.purity)}</td><td>${safe(item?.weight)}</td><td>${safe(amount(item?.value))}</td></tr>`;
}).join("")}</tbody></table>`;

/** Templates are text, never executable HTML; only known date placeholders are substituted. */
export function renderPledgeMatter(text: string, data: PledgeFormData): string {
  return safe(text.replace(/\{\{(loanDate|releaseDate|noticeDate|finalNoticeDate)\}\}/g,
    (_match, key: "loanDate" | "releaseDate" | "noticeDate" | "finalNoticeDate") => date(data[key]) || blankDate)).replace(/\r?\n/g, "<br>");
}

export const PLEDGE_FORMS_STYLES = `
@page { size: A4 portrait; margin: 5mm; }
* { box-sizing: border-box; }
html,body { margin:0; padding:0; color:#111827; background:#fff; }
body { font-family:"Noto Sans Devanagari","Mangal",sans-serif; font-size:8pt; line-height:1.4; }
.pf-sheet { width:200mm; margin:5mm auto; }
.pf-page { width:200mm; break-inside:avoid; page-break-inside:avoid; }
.pf-page + .pf-page { margin-top:16mm; }
.pf-section { border:.25mm solid #475569; padding:1.3mm 2mm; position:relative; break-inside:avoid; page-break-inside:avoid; overflow:visible; }
.pf-heading { display:flex; align-items:start; justify-content:space-between; gap:2mm; margin:0 0 1.2mm; }
.pf-heading h2 { font-size:10pt; line-height:1.3; margin:0; font-weight:700; }
.pf-brand { font-size:7pt; line-height:1.3; overflow-wrap:anywhere; }
.pf-date { font-size:7pt; white-space:nowrap; }
.pf-loan { height:68mm; } .pf-declaration { height:40mm; }
.pf-notices { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:1.8mm; position:relative; }
.pf-notices .pf-section { height:54mm; }
.pf-notices:after { content:""; position:absolute; top:0; bottom:0; left:50%; border-left:.2mm dashed #64748b; }
.pf-receipt { height:57mm; } .pf-disposal { height:60mm; }
.pf-cut { height:1.6mm; position:relative; }
.pf-cut:after { content:""; position:absolute; top:50%; left:0; right:0; border-top:.2mm dashed #64748b; }
.pf-columns { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:3mm; }
.pf-line { display:flex; align-items:baseline; gap:1.3mm; min-height:3.6mm; font-size:7.4pt; line-height:1.35; }
.pf-line>span:first-child { flex-shrink:0; }
.pf-fill { flex:1; min-width:0; min-height:3mm; border-bottom:.15mm solid #94a3b8; overflow-wrap:anywhere; white-space:pre-wrap; }
.pf-person { display:grid; grid-template-columns:minmax(0,1fr) 18mm; gap:2mm; }
.pf-photo { width:18mm; height:23mm; border:.2mm solid #64748b; border-radius:1mm; display:flex; align-items:center; justify-content:center; text-align:center; font-size:7pt; }
.pf-subtitle { font-weight:700; background:#eef2ff; padding:.5mm 1mm; text-align:center; font-size:7.4pt; margin:1mm 0 .5mm; border-bottom:.15mm solid #64748b; }
.pf-table { width:100%; border-collapse:collapse; table-layout:fixed; margin:.4mm 0; font-size:7pt; }
.pf-table th,.pf-table td { border:.2mm solid #475569; padding:.4mm .7mm; height:4mm; text-align:center; line-height:1.2; overflow-wrap:anywhere; }
.pf-table th { background:#eef2ff; font-weight:700; }
.pf-signatures { display:flex; justify-content:space-between; gap:4mm; margin-top:4mm; padding:0 2mm; font-size:7pt; }
.pf-signatures>div { min-width:26mm; }
.pf-signatures>div:last-child { text-align:right; }
.pf-terms { padding-left:4mm; margin:.5mm 0; font-size:7pt; line-height:1.35; }
.pf-terms li { margin-bottom:.35mm; }
.pf-declaration-body { display:grid; grid-template-columns:minmax(0,1fr) 18mm; gap:3mm; }
.pf-declaration .pf-photo { height:18mm; }
.pf-declaration .pf-signatures { margin-top:3mm; }
.pf-notice-to { margin-bottom:1mm; }
.pf-notice-body { font-size:7.5pt; line-height:1.45; margin:1.3mm 0; text-align:justify; }
.pf-notice-body p { margin:0 0 1mm; }
.pf-notices .pf-signatures { justify-content:flex-end; margin-top:3mm; }
.pf-interim .pf-signatures,.pf-final .pf-signatures { justify-content:flex-end; }
.pf-box { border:.2mm solid #64748b; border-radius:.7mm; padding:1mm 1.5mm; }
.pf-release { margin:0; font-size:7.3pt; line-height:1.4; }
.pf-disposal-text { font-size:7.2pt; margin:.6mm 0 1mm; line-height:1.4; }
.pf-spacious .pf-section { padding:2.5mm 3mm; }
.pf-spacious .pf-heading { margin-bottom:2mm; }
.pf-spacious .pf-heading h2 { font-size:12pt; }
.pf-spacious .pf-brand,.pf-spacious .pf-date { font-size:8.5pt; }
.pf-spacious .pf-loan { height:100mm; }
.pf-spacious .pf-declaration { height:76mm; }
.pf-spacious .pf-interim { height:98mm; }
.pf-spacious .pf-final { height:88mm; }
.pf-spacious .pf-receipt { height:96mm; }
.pf-spacious .pf-disposal { height:90mm; }
.pf-spacious .pf-cut { height:2mm; }
.pf-spacious .pf-line { font-size:9pt; min-height:4.8mm; line-height:1.5; }
.pf-spacious .pf-fill { min-height:4mm; }
.pf-spacious .pf-columns { gap:4mm; }
.pf-spacious .pf-person { grid-template-columns:minmax(0,1fr) 21mm; }
.pf-spacious .pf-photo { width:21mm; height:28mm; font-size:8.5pt; }
.pf-spacious .pf-declaration .pf-photo { height:26mm; }
.pf-spacious .pf-declaration-body { grid-template-columns:minmax(0,1fr) 21mm; }
.pf-spacious .pf-subtitle { font-size:9pt; padding:1mm; margin:2mm 0 1mm; }
.pf-spacious .pf-table { font-size:8.8pt; }
.pf-spacious .pf-table th,.pf-spacious .pf-table td { height:5.8mm; padding:.7mm; }
.pf-spacious .pf-terms { font-size:9pt; line-height:1.6; padding-left:5mm; }
.pf-spacious .pf-terms li { margin-bottom:1mm; }
.pf-spacious .pf-notice-body { font-size:10pt; line-height:1.7; margin:2mm 0; }
.pf-spacious .pf-notice-body p { margin-bottom:2mm; }
.pf-spacious .pf-signatures { font-size:9pt; margin-top:6mm; }
.pf-spacious .pf-release,.pf-spacious .pf-disposal-text { font-size:9pt; line-height:1.6; }
.pf-single .pf-section { height:auto; min-height:65mm; }
.pf-single .pf-notice-body { font-size:10pt; line-height:1.8; }
.pf-single .pf-line { font-size:9pt; min-height:5mm; }
.pf-single .pf-signatures { margin-top:7mm; }
@media print {
  html,body,.pf-sheet { width:200mm; }
 .pf-sheet { margin:0; }
 .pf-page + .pf-page { margin-top:0; break-before:page; page-break-before:always; }
 body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}
`;

/** Same page groups and typography are used for preview, native print and downloaded PDF. */
export function pledgeFormsDocument(data: PledgeFormData, selection: PledgeFormChoice = "all", matter: PledgeFormMatter = DEFAULT_PLEDGE_MATTER, layout: PledgeFormLayout = "compact"): string {
  const keys = getSelectedPledgeForms(selection);
  if (!keys.length) throw new Error("किमान एक फॉर्म निवडा.");
  if (layout !== "compact" && layout !== "spacious") throw new Error("चुकीची पान मांडणी.");
  const organization = `<div class="pf-organization"><div class="pf-organization-name">${data.company?.trim() ? safe(data.company) : "संस्था / फर्मचे नाव: ____________________"}</div>${data.companyAddress?.trim() || data.companyContactNumber?.trim() || data.companyLicenseNumber?.trim() ? `<div class="pf-organization-details">${data.companyAddress?.trim() ? `<span class="pf-organization-address">${safe(data.companyAddress).replace(/\r?\n/g, "<br>")}</span>` : ""}${data.companyContactNumber?.trim() || data.companyLicenseNumber?.trim() ? `<span class="pf-organization-meta">${data.companyContactNumber?.trim() ? `<span>संपर्क: ${safe(data.companyContactNumber)}</span>` : ""}${data.companyLicenseNumber?.trim() ? `<span>परवाना क्र.: ${safe(data.companyLicenseNumber)}</span>` : ""}</span>` : ""}</div>` : ""}</div>`;
  const heading = (title: string) => `${organization}<header class="pf-heading"><div><h2>${safe(title)}</h2></div><span class="pf-date">दिनांक: ${safe(date(data.printDate) || blankDate)}</span></header>`;
  const profile = () => `${line("कर्जदाराचे नाव:", data.borrowerName)}${line("पत्ता:", data.borrowerAddress)}`;
  const text = (key: keyof PledgeFormMatter) => renderPledgeMatter(matter[key], data);
  const notice = (final: boolean) => `<section class="pf-section pf-${final ? "final" : "interim"}" data-form="${final ? "final" : "interim"}">
    ${heading(final ? matter.finalTitle : matter.interimTitle)}
    <div class="pf-notice-to">${profile()}${line("कर्ज खाते क्र.:", data.accountNumber)}</div>
    <div class="pf-notice-body">${final
      ? `<p>${text("finalText1")}</p><p>${text("finalText2")}</p>`
      : `<p>${text("interimText1")}</p><p>${text("interimText2")}</p>`}
    </div><div class="pf-signatures"><div><strong>सावकाराची सही</strong></div></div>
  </section>`;
  const sections: Record<Exclude<PledgeFormSelection, "all">, string> = {
    loan: `<section class="pf-section pf-loan" data-form="loan">${heading(matter.loanTitle)}
      <div class="pf-columns"><div class="pf-person"><div>${profile()}${line("मोबाईल:", data.borrowerMobile)}${line("आधार क्र. (शेवटचे 4 अंक):", data.aadhaarLast4)}${line("पॅन क्र. (असल्यास):", data.panNumber)}</div><div class="pf-photo">फोटो<br>(कर्जदार)</div></div>
      <div>${line("कर्ज खाते क्र.:", data.accountNumber)}${line("कर्ज रक्कम (₹):", amount(data.principalAmount))}${line("व्याजदर (%):", data.interestRate)}${line("दराचा कालावधी:", data.ratePeriod || "मासिक / वार्षिक")}${line("कर्ज दिनांक:", date(data.loanDate))}${line("मुदत / परतफेड दिनांक:", date(data.repaymentDate))}</div></div>
      <div class="pf-subtitle">तारण वस्तूंचा तपशील</div>${goodsTable(data.loanItems)}${signatures()}
    </section>`,
    declaration: `<section class="pf-section pf-declaration" data-form="declaration">${heading(matter.declarationTitle)}
      <div class="pf-declaration-body"><div>${line("कर्जदाराचे नाव:", data.borrowerName)}
      <ol class="pf-terms">${(["declaration1", "declaration2", "declaration3", "declaration4"] as const).map(key => `<li>${text(key)}</li>`).join("")}</ol></div><div class="pf-photo">फोटो<br>(कर्जदार)</div></div>${signatures()}
    </section>`,
    interim: notice(false), final: notice(true),
    receipt: `<section class="pf-section pf-receipt" data-form="receipt">${heading(matter.receiptTitle)}
      <div class="pf-columns"><div>${profile()}</div><div>${line("कर्ज खाते क्र.:", data.accountNumber)}${line("कर्ज दिनांक:", date(data.loanDate))}</div></div>
      <div class="pf-columns pf-receipt-body"><div class="pf-box"><div class="pf-subtitle">रकमेचा तपशील</div>${moneyLines([["मुद्दल रक्कम (₹):", data.receiptPrincipal], ["व्याज (₹):", data.receiptInterest], ["मान्य इतर शुल्क (₹):", data.receiptFees], ["एकूण प्राप्त रक्कम (₹):", data.receiptTotal]])}${line("प्राप्तीचा प्रकार:", data.paymentMethod)}</div>
      <div class="pf-box"><div class="pf-subtitle">ग्राहकाची तपासणी व स्वीकृती घोषणा</div><p class="pf-release">${text("releaseText")}</p></div></div>${signatures()}
    </section>`,
    disposal: `<section class="pf-section pf-disposal" data-form="disposal">${heading(matter.disposalTitle)}
      <div class="pf-columns"><div>${profile()}</div><div>${line("कर्ज खाते क्र.:", data.accountNumber)}${line("विक्री दिनांक:", date(data.saleDate))}</div></div>
      <p class="pf-disposal-text">${text("disposalText")}</p>
      <div class="pf-columns"><div>${goodsTable(data.saleItems, true)}${line("खरेदीदाराचे नाव / पावती क्र.:", data.buyerDetails)}</div><div class="pf-box">${moneyLines([["एकूण विक्री रक्कम (₹):", data.saleTotal], ["बाकी मुद्दल (₹):", data.outstandingPrincipal], ["देय व्याज (₹):", data.dueInterest], ["मान्य विक्री खर्च (₹):", data.saleExpenses], ["एकूण देय रक्कम (₹):", data.totalDue], ["कर्जदारास परत / तूट (₹):", data.balanceReturn]])}</div></div>${signatures(true)}
    </section>`,
  };
  const page = (content: string) => `<div class="pf-page">${content}</div>`;
  const cut = '<div class="pf-cut"></div>';
  const content = getPledgePageGroups(selection, layout).map(group => {
    const pieces: string[] = [];
    for (const key of group) {
      if (layout === "compact" && keys.length > 1 && group.includes("interim") && group.includes("final")) {
        if (key === "final") continue;
        if (key === "interim") { pieces.push(`<div class="pf-notices">${sections.interim}${sections.final}</div>`); continue; }
      }
      pieces.push(sections[key]);
    }
    return page(pieces.join(cut));
  }).join("");
  return `<!doctype html><html lang="mr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>तारण फॉर्म व नोटीस नमुने</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet">
    <style>${PLEDGE_FORMS_STYLES}\n${PLEDGE_FORM_POLISH_STYLES}</style></head><body><main class="pf-sheet ${keys.length === 1 ? "pf-single" : "pf-all"} pf-${layout}" data-layout="${layout}">${content}</main></body></html>`;
}

/** Browser print and Android Save as PDF use precisely the previewed document. */
export async function preparePledgeForms(html: string) {
  const iframe = document.createElement("iframe");
  iframe.title = "A4 फॉर्म प्रिंट";
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0";
  const remove = () => iframe.remove();
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("प्रिंट तयार झाली नाही. इंटरनेट व फॉन्ट लोड होणे तपासा.")), 30000);
      iframe.onload = () => { window.clearTimeout(timeout); resolve(); };
      iframe.srcdoc = html;
      document.body.appendChild(iframe);
    });
    const win = iframe.contentWindow, doc = iframe.contentDocument;
    if (!win || !doc) throw new Error("प्रिंट उघडता आली नाही.");
    await Promise.all([400, 600, 700].map(weight => doc.fonts.load(`${weight} 10px "Noto Sans Devanagari"`)));
    await doc.fonts.ready;
    await new Promise<void>(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve())));
    const overflowing = Array.from(doc.querySelectorAll<HTMLElement>(".pf-section")).some(section =>
      section.scrollHeight > section.clientHeight + 2 || section.scrollWidth > section.clientWidth + 2 ||
      (section.lastElementChild?.getBoundingClientRect().bottom ?? 0) > section.getBoundingClientRect().bottom - 3
    );
    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".pf-page"));
    const overPage = !pages.length || pages.some(page => page.getBoundingClientRect().height > 287 / 25.4 * 96 + 1);
    if (overflowing || overPage) throw new Error("मजकूर A4 नमुन्याच्या जागेपेक्षा मोठा आहे. 2 पानांची मांडणी / स्वतंत्र फॉर्म निवडा किंवा मजकूर कमी करा.");
    return { iframe, win, doc, pages, remove };
  } catch (error) {
    remove();
    throw error;
  }
}

export async function printPledgeForms(html: string): Promise<void> {
  const prepared = await preparePledgeForms(html);
  let timer: number | undefined;
  const remove = () => { if (timer) window.clearTimeout(timer); prepared.remove(); };
  try {
    prepared.win.addEventListener("afterprint", remove, { once: true });
    prepared.win.focus();
    prepared.win.print();
    // Android's print service may continue reading after print() returns.
    timer = window.setTimeout(remove, 300000);
  } catch (error) { remove(); throw error; }
}
