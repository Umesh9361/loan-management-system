import { escapeSummaryHtml } from "../../../shared/account-summary";
import type { SummaryPosition, SummaryYearProgress } from "../../../shared/account-summary";
import { formatSummaryCount, formatSummaryCurrency } from "../../../shared/account-summary-format";
import { formatWeight } from "../../../shared/report-weights";

/** Optional analysis only. The original transaction table is authored elsewhere. */
export function accountSummaryPositionPrint(position: SummaryPosition, years: SummaryYearProgress[] = []) {
  const safe = escapeSummaryHtml;
  const metrics = [
    ["सक्रिय खाती", formatSummaryCount(position.activeLoans)],
    ["बाकी मुद्दल", formatSummaryCurrency(position.activeBalance)],
    ["सोने तारण", `${formatWeight(position.goldWeight)} ग्रॅम`],
    ["चांदी तारण", `${formatWeight(position.silverWeight)} ग्रॅम`],
    ["प्रत्यक्ष मिळालेले व्याज", formatSummaryCurrency(position.totalInterest)],
  ];
  const maxDisbursed = Math.max(1, ...years.map(year => year.disbursed));
  const maxInterest = Math.max(1, ...years.map(year => year.interest));
  const bar = (amount: number, max: number, color: string) =>
    `<div class="summary-position-track"><span style="width:${Math.max(0, amount / max * 100)}%;background:${color}"></span></div>`;
  return `<section class="summary-position-print" aria-label="आजची स्थिती">
    <h2>आजची स्थिती</h2>
    <div class="summary-position-metrics">${metrics.map(([label, value]) =>
      `<div><span>${safe(label)}</span><strong>${safe(value)}</strong></div>`).join("")}</div>
    ${years.length ? `<h3>आर्थिक वर्षनिहाय प्रगती</h3>
    <div class="summary-position-year-head"><span>आर्थिक वर्ष</span><span>कर्जवाटप · ₹</span><span>मिळालेले व्याज · ₹</span></div>
    ${years.map(year => `<div class="summary-position-year">
      <div><strong>${safe(year.label)}</strong>${year.partial ? "<small>आजपर्यंत</small>" : ""}</div>
      <div><strong>${safe(formatSummaryCurrency(year.disbursed))}</strong>${bar(year.disbursed, maxDisbursed, "#5147b8")}
        <small>${year.disbursementChange === null ? "तुलनेसाठी आधार उपलब्ध नाही" :
          `${year.disbursementChange > 0 ? "+" : ""}${year.disbursementChange.toLocaleString("en-IN", { maximumFractionDigits: 1 })}% ${year.partial ? "मागील वर्षाच्या समान कालावधीपेक्षा" : "मागील वर्षापेक्षा"}`}</small></div>
      <div><strong>${safe(formatSummaryCurrency(year.interest))}</strong>${bar(year.interest, maxInterest, "#168578")}</div>
    </div>`).join("")}
    <p class="summary-position-footnote">नोंदवलेल्या व्यवहारांवर आधारित. चालू वर्षाची वाढ मागील वर्षाच्या समान कालावधीशी; इतर वर्षांची पूर्ण वर्षाशी तुलना. दोन्ही आलेखांचे प्रमाण स्वतंत्र आहे.</p>` : ""}
  </section>`;
}

export const accountSummaryPositionPrintStyles = `
.summary-position-print { margin: 0 0 3mm; padding: 3mm; border: 1px solid #d9d8eb; }
.summary-position-print h2 { font-size: 12pt; line-height: 1.7; margin: 0 0 2mm; color: #343252; }
.summary-position-print h3 { font-size: 10pt; line-height: 1.7; margin: 3mm 0 2mm; }
.summary-position-metrics { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 2mm; break-inside: avoid; }
.summary-position-metrics > div { padding: 2mm; border-left: 2px solid #5147b8; background: #f7f6fc; }
.summary-position-metrics > div:nth-child(2) { border-color: #3977a5; }
.summary-position-metrics > div:last-child { border-color: #168578; }
.summary-position-metrics span { display: block; font-size: 8pt; line-height: 1.8; color: #55546a; }
.summary-position-metrics strong { display: block; font-size: 10pt; line-height: 1.8; overflow-wrap: anywhere; }
.summary-position-year-head, .summary-position-year { display: grid; grid-template-columns: 22mm minmax(0,1fr) minmax(0,1fr); gap: 3mm; }
.summary-position-year-head { color: #55546a; font-size: 8pt; padding-bottom: 2mm; }
.summary-position-year { padding: 1.2mm 0; border-top: 1px solid #e6e5f0; break-inside: avoid; page-break-inside: avoid; }
.summary-position-year strong { display: block; font-size: 8.5pt; line-height: 1.8; padding-bottom: 1mm; overflow-wrap: anywhere; }
.summary-position-year small { display: block; font-size: 7pt; line-height: 1.8; color: #55546a; padding-top: 1mm; }
.summary-position-track { height: 2mm; margin-top: 2mm; background: #f0eff5; position: relative; }
.summary-position-track span { height: 100%; display: block; }
.summary-position-footnote { font-size: 7pt; line-height: 1.8; margin: 2mm 0 0; color: #55546a; }
`;
