import { overdueMetalWeightTotals } from "../../../shared/overdue-weights";
import { formatWeight } from "../../../shared/report-weights";

export interface OverduePrintRow {
  loanId: string;
  accountNumber: string;
  borrowerName: string;
  borrowerPhone?: string;
  groupName: string;
  loanDate: string;
  goldItem?: string;
  principalAmount: number;
  interestToDate: number;
  totalAmount: number;
  goldWeight: number;
  fineGoldWeight?: number;
  purityUsed?: number;
  currentGoldValue: number;
  lossAmount: number;
  daysOverdue: number;
  loanType?: string;
  metalType?: string;
  securityLabel: string;
}

export type OverduePrintOptions = {
  rows: OverduePrintRow[];
  company?: string;
  companyAddress?: string;
  title: string;
  reportDate: string;
  context: Array<[string, string]>;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] as string);

const currency = (value: number): string =>
  `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)}`;

function displayDate(value: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnly) return `${dateOnly[3]}-${dateOnly[2]}-${dateOnly[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

const isUnsecured = (row: OverduePrintRow) => row.loanType === "विनातारण";

function loanIdentity(row: OverduePrintRow): string {
  const details = [
    `<strong class="borrower-name">${escapeHtml(row.borrowerName)}</strong>`,
    row.borrowerPhone ? `<span>फोन: ${escapeHtml(row.borrowerPhone)}</span>` : "",
    row.goldItem ? `<span>वस्तू: ${escapeHtml(row.goldItem)}</span>` : "",
  ].filter(Boolean).join("");
  return `<div class="identity">${details}</div>`;
}

function securityMarkup(label: string, loss: number): string {
  const riskClass = loss > 0 ? "risk-loss" : label.includes("पूर्ण") ? "risk-safe" : label.includes("मध्यम") ? "risk-medium" : "risk-low";
  return `<div class="risk ${riskClass}"><strong>${escapeHtml(label)}</strong>${loss > 0 ? `<span>${currency(loss)}</span>` : ""}</div>`;
}

function securedRow(row: OverduePrintRow): string {
  const weight = formatWeight(row.goldWeight);
  const fineWeight = row.fineGoldWeight !== undefined
    ? formatWeight(row.fineGoldWeight)
    : null;
  const metal = row.metalType === "silver" ? "चांदी" : "सोने";
  return `<tr>
    <td class="center">${escapeHtml(row.accountNumber)}</td>
    <td class="identity-cell">${loanIdentity(row)}</td>
    <td>${escapeHtml(row.groupName)}</td>
    <td class="center">${escapeHtml(displayDate(row.loanDate))}</td>
    <td class="money">${currency(row.principalAmount)}</td>
    <td class="money">${currency(row.interestToDate)}</td>
    <td class="weight">${escapeHtml(metal)} ${escapeHtml(weight)} ग्रॅम</td>
    <td class="weight fine-weight">${fineWeight !== null ? `<strong>${escapeHtml(fineWeight)} ग्रॅम</strong>` : "—"}<span class="subline">${escapeHtml(metal)}${row.purityUsed !== undefined ? ` (${escapeHtml(row.purityUsed)}%)` : ""}</span></td>
    <td class="money">${currency(row.currentGoldValue)}</td>
    <td class="money obligation">${currency(row.totalAmount)}</td>
    <td>${securityMarkup(row.securityLabel, row.lossAmount)}</td>
    <td class="center">${escapeHtml(row.daysOverdue)} दिवस</td>
  </tr>`;
}

function unsecuredRow(row: OverduePrintRow): string {
  return `<tr>
    <td class="center">${escapeHtml(row.accountNumber)}</td>
    <td class="identity-cell">${loanIdentity(row)}</td>
    <td>${escapeHtml(row.groupName)}</td>
    <td class="center">${escapeHtml(displayDate(row.loanDate))}</td>
    <td class="money">${currency(row.principalAmount)}</td>
    <td class="money">${currency(row.interestToDate)}</td>
    <td class="money obligation">${currency(row.totalAmount)}</td>
    <td>${securityMarkup(row.securityLabel, row.lossAmount)}</td>
    <td class="center">${escapeHtml(row.daysOverdue)} दिवस</td>
  </tr>`;
}

function sums(rows: OverduePrintRow[]) {
  return rows.reduce((total, row) => ({
    principal: total.principal + row.principalAmount,
    interest: total.interest + row.interestToDate,
    obligation: total.obligation + row.totalAmount,
    collateral: total.collateral + (isUnsecured(row) ? 0 : row.currentGoldValue),
    loss: total.loss + row.lossAmount,
  }), { principal: 0, interest: 0, obligation: 0, collateral: 0, loss: 0 });
}

function sectionTotals(rows: OverduePrintRow[], secured: boolean): string {
  const total = sums(rows);
  return `<div class="section-totals">
    <strong>विभागाची बेरीज</strong>
    <span>मुद्दल: ${currency(total.principal)}</span>
    <span>व्याज: ${currency(total.interest)}</span>
    <span>एकूण देय: ${currency(total.obligation)}</span>
    ${secured ? `<span>तारणाचे बाजारमूल्य: ${currency(total.collateral)}</span>` : ""}
    <span>एकूण नुकसान: ${currency(total.loss)}</span>
  </div>`;
}

function securedSection(rows: OverduePrintRow[]): string {
  if (!rows.length) return "";
  const weights = overdueMetalWeightTotals(rows);
  const hasGold = rows.some(row => row.metalType !== "silver");
  const hasSilver = rows.some(row => row.metalType === "silver");
  const weightSummary = [
    hasGold ? `<span>सोने वजन: ${escapeHtml(formatWeight(weights.gold.gross))} ग्रॅम</span><span>शुद्ध सोने: ${escapeHtml(formatWeight(weights.gold.fine))} ग्रॅम</span>` : "",
    hasSilver ? `<span>चांदी वजन: ${escapeHtml(formatWeight(weights.silver.gross))} ग्रॅम</span><span>शुद्ध चांदी: ${escapeHtml(formatWeight(weights.silver.fine))} ग्रॅम</span>` : "",
  ].filter(Boolean).join("");
  return `<section class="loss-section">
    <h2 class="loss-section-title">तारण असलेली कर्जे <span>${rows.length} खाते</span></h2>
    <div class="table-wrap"><table class="loss-print-table secured-table">
      <colgroup><col style="width:4%"><col style="width:20%"><col style="width:5%"><col style="width:7%"><col style="width:8%"><col style="width:7%"><col style="width:7%"><col style="width:8%"><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:5%"></colgroup>
      <thead><tr><th>खाते</th><th>कर्जदार / तपशील</th><th>गट</th><th>तारीख</th><th>मुद्दल</th><th>व्याज</th><th>धातू व वजन</th><th>शुद्ध वजन</th><th>तारण बाजारमूल्य</th><th>एकूण देय</th><th>नुकसान / सुरक्षा स्थिती</th><th>दिवस</th></tr></thead>
      <tbody>${rows.map(securedRow).join("")}</tbody>
    </table></div>
    <div class="weight-totals">${weightSummary}</div>
    ${sectionTotals(rows, true)}
  </section>`;
}

function unsecuredSection(rows: OverduePrintRow[]): string {
  if (!rows.length) return "";
  return `<section class="loss-section">
    <h2 class="loss-section-title">विनातारण कर्जे <span>${rows.length} खाते</span></h2>
    <div class="table-wrap"><table class="loss-print-table unsecured-table">
      <colgroup><col style="width:7%"><col style="width:25%"><col style="width:9%"><col style="width:9%"><col style="width:10%"><col style="width:10%"><col style="width:12%"><col style="width:13%"><col style="width:5%"></colgroup>
      <thead><tr><th>खाते</th><th>कर्जदार / तपशील</th><th>गट</th><th>तारीख</th><th>मुद्दल</th><th>व्याज</th><th>एकूण देय</th><th>नुकसान / सुरक्षा स्थिती</th><th>दिवस</th></tr></thead>
      <tbody>${rows.map(unsecuredRow).join("")}</tbody>
    </table></div>
    ${sectionTotals(rows, false)}
  </section>`;
}

export function overduePrintDocument(options: OverduePrintOptions): string {
  for (const row of options.rows) {
    const amounts = [row.principalAmount, row.interestToDate, row.totalAmount, row.lossAmount];
    if (!isUnsecured(row)) amounts.push(row.goldWeight, row.currentGoldValue);
    if (amounts.some(value => !Number.isFinite(value))) {
      throw new Error("रिपोर्टमधील रक्कम किंवा वजन अवैध आहे. माहिती तपासून पुन्हा रिपोर्ट तयार करा.");
    }
  }
  const secured = options.rows.filter(row => !isUnsecured(row));
  const unsecured = options.rows.filter(isUnsecured);
  const allTotals = sums(options.rows);
  const context = options.context.map(([label, value]) =>
    `<div class="context-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
  ).join("");
  const emptyState = `<div class="empty-state">या अहवालासाठी कोणतीही थकीत कर्जे उपलब्ध नाहीत.</div>`;

  return `<!doctype html>
<html lang="mr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(options.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4 landscape; margin: 5mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { width: 287mm; max-width: 287mm; margin: 0 auto; color: #24243a; background: #fff; font: 9pt/1.55 "Noto Sans Devanagari", sans-serif; }
.loss-document-header { border-bottom: 2px solid #38346f; padding: 0 0 2mm; margin-bottom: 2mm; text-align: center; }
.loss-document-header h1 { margin: 0 0 1mm; font-size: 14pt; line-height: 1.4; color: #302d66; overflow-wrap: anywhere; }
.loss-document-header h2 { margin: 0; font-size: 12pt; line-height: 1.45; color: #24243a; overflow-wrap: anywhere; }
.company-address { margin: 1mm 0 0; font-size: 8.5pt; overflow-wrap: anywhere; }
.report-date { margin: 1mm 0 0; font-size: 8.5pt; }
.company-meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 0 4mm; }
.loss-report-context { display: flex; flex-wrap: wrap; justify-content: center; gap: 1mm 5mm; padding: 1.5mm 2mm; margin-bottom: 2.5mm; border: 1px solid #b8b7ce; background: #f4f3fa; }
.context-item { display: flex; gap: 1.5mm; overflow-wrap: anywhere; }
.context-item span { color: #4c4b61; }
.loss-document-totals { display: flex; flex-wrap: wrap; gap: 1mm 5mm; padding: 1.5mm 2mm; margin: 0 0 2.5mm; border: 1px solid #85839f; background: #fbfaff; }
.loss-document-totals strong { color: #302d66; }
.loss-section { margin: 0 0 2mm; }
.loss-section-title { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 1.5mm; padding: 1mm 1.5mm; border-left: 3px solid #38346f; border-bottom: 1px solid #aaa8c1; color: #302d66; font-size: 11pt; line-height: 1.45; }
.loss-section-title span { font-size: 8.5pt; color: #3f3e52; }
.table-wrap { width: 100%; }
.loss-print-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
.loss-print-table thead { display: table-header-group; }
.loss-print-table tr { break-inside: avoid; page-break-inside: avoid; }
.loss-print-table th, .loss-print-table td { border: 1px solid #85849a; padding: 1.5mm 1mm; text-align: left; vertical-align: middle; font-size: 9pt; line-height: 1.5; overflow-wrap: anywhere; word-break: normal; }
.loss-print-table th { color: #292846; background: #e9e8f3; font-weight: 700; }
.loss-print-table td.money { text-align: right; white-space: normal; font-variant-numeric: tabular-nums; }
.loss-print-table td.center { text-align: center; }
.loss-print-table td.obligation { font-weight: 700; color: #3730a3; }
.identity { display: flex; flex-direction: column; gap: .35mm; }
.borrower-name { font-size: 9.5pt; line-height: 1.55; color: #25233e; }
.subline { display: block; font-size: 8pt; }
.weight { text-align: center !important; }
.risk { display: flex; flex-direction: column; line-height: 1.5; }
.risk strong { font-weight: 700; }
.risk-loss strong { font-weight: 700; }
.risk-loss { color: #991b1b; }
.risk-safe { color: #166534; }
.risk-medium { color: #854d0e; }
.risk-low { color: #9a3412; }
.weight-totals, .section-totals { display: flex; flex-wrap: wrap; gap: 1mm 5mm; padding: 1.3mm 2mm; border: 1px solid #aaa8bd; border-top: 0; font-size: 8.5pt; }
.weight-totals { background: #f8f7fc; }
.section-totals { border-top: 1px solid #85839f; margin-top: 1mm; background: #eeedf6; }
.section-totals strong { color: #302d66; }
.empty-state { padding: 10mm; border: 1px solid #85839f; text-align: center; font-size: 11pt; }
.loss-document-closing { margin-top: 2mm; padding-right: 12mm; padding-bottom: 2mm; display: flex; flex-direction: column; align-items: flex-end; break-inside: avoid; page-break-inside: avoid; }
.signature { width: 52mm; padding-top: 5mm; border-bottom: 1px solid #4a4960; text-align: center; }
.signature-label { width: 52mm; margin-top: 1mm; text-align: center; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print {
  body { margin: 0; }
  .loss-print-table th { background: #e9e8f3 !important; }
}
@media screen {
  body { padding: 5mm; }
}
@media print and (monochrome) {
  .loss-report-context, .loss-document-totals, .loss-section-title,
  .loss-print-table th, .weight-totals, .section-totals { background: #fff !important; }
}
</style></head><body>
<header class="loss-document-header">
  ${options.company ? `<h1>${escapeHtml(options.company)}</h1>` : ""}
  <h2>${escapeHtml(options.title)}</h2>
  <div class="company-meta">${options.companyAddress ? `<p class="company-address">${escapeHtml(options.companyAddress)}</p>` : ""}
  <p class="report-date">अहवाल दिनांक: ${escapeHtml(displayDate(options.reportDate))}</p></div>
</header>
<div class="loss-report-context">${context}</div>
<div class="loss-document-totals">
  <strong>अहवाल सारांश · ${options.rows.length} खाती</strong>
  <span>एकूण देय: ${currency(allTotals.obligation)}</span>
  <span>एकूण नुकसान: ${currency(allTotals.loss)}</span>
</div>
${securedSection(secured)}
${unsecuredSection(unsecured)}
${options.rows.length ? "" : emptyState}
<footer class="loss-document-closing"><div class="signature"></div><div class="signature-label">सावकाराची सही</div></footer>
</body></html>`;
}
