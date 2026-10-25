import { escapeSummaryHtml } from "../../../shared/account-summary";
import {
  englishSummaryDigits,
  formatSummaryCount,
  formatSummaryCurrency,
} from "../../../shared/account-summary-format";

type OverviewTotals = {
  totalLoans: number;
  activeLoans: number;
  closedLoans: number;
  totalAmount: number;
  closedAmount: number;
  activeBalance: number;
  totalInterest: number;
};

type Metric = {
  label: string;
  value: number;
  color: string;
};

const colors = {
  principal: "#5147b8",
  closures: "#168578",
  interest: "#c17a16",
  balance: "#3977a5",
  accounts: "#6a63a8",
};

function finite(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function compactCurrency(value: number) {
  const amount = finite(value);
  const formatted = (number: number) =>
    englishSummaryDigits(
      number.toLocaleString("en-IN", { maximumFractionDigits: 1 }),
    );
  const sign = amount < 0 ? "−" : "";
  const absolute = Math.abs(amount);
  if (absolute >= 10_000_000) return `${sign}₹${formatted(absolute / 10_000_000)} कोटी`;
  if (absolute >= 100_000) return `${sign}₹${formatted(absolute / 100_000)} लाख`;
  if (absolute >= 1_000) return `${sign}₹${formatted(absolute / 1_000)} ह.`;
  return `${sign}₹${formatted(absolute)}`;
}

function renderMetric(metric: Metric) {
  return `<div class="summary-overview-metric" style="--metric-color:${metric.color}">
    <span>${escapeSummaryHtml(metric.label)}</span>
    <strong>${escapeSummaryHtml(formatSummaryCurrency(finite(metric.value)))}</strong>
  </div>`;
}

function renderChart(
  title: string,
  items: Metric[],
  unit: "currency" | "count",
) {
  const values = items.map(item => finite(item.value));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const zero = ((0 - min) / span) * 100;
  const format = unit === "currency" ? formatSummaryCurrency : formatSummaryCount;
  const axisFormat = unit === "currency"
    ? compactCurrency
    : (value: number) => formatSummaryCount(value);
  const rows = items.map(item => {
    const value = finite(item.value);
    const endpoint = ((value - min) / span) * 100;
    const left = Math.min(zero, endpoint);
    const width = Math.max(0, Math.abs(endpoint - zero));
    const bar = width > 0
      ? `<span class="summary-overview-bar" style="left:${left}%;width:${width}%;--metric-color:${item.color}"></span>`
      : "";
    return `<div class="summary-overview-chart-row">
      <div class="summary-overview-row-heading">
        <span class="summary-overview-row-label">${escapeSummaryHtml(item.label)}</span>
        <strong>${escapeSummaryHtml(format(value))}</strong>
      </div>
      <div class="summary-overview-track" aria-hidden="true">
        <span class="summary-overview-zero" style="left:${zero}%"></span>${bar}
      </div>
    </div>`;
  }).join("");

  return `<section class="summary-overview-chart">
    <h3>${escapeSummaryHtml(title)}</h3>
    <div class="summary-overview-rows">${rows}</div>
    <div class="summary-overview-axis">
      <span>${escapeSummaryHtml(axisFormat(min))}</span>
      ${min < 0 && max > 0 ? `<span class="summary-overview-axis-zero" style="left:${zero}%">0</span>` : ""}
      <span>${escapeSummaryHtml(axisFormat(max))}</span>
    </div>
  </section>`;
}

/** Compact, print-first account summary. Inputs are already calculated by the report. */
export function accountSummaryPrintOverview(
  totals: OverviewTotals,
  mode: "cumulative" | "period" = "cumulative",
) {
  const cumulative = mode === "cumulative";
  const amountMetrics: Metric[] = [
    { label: "वाटप केलेले मुद्दल", value: totals.totalAmount, color: colors.principal },
    { label: "बंद खात्यांतून परत आलेले मुद्दल", value: totals.closedAmount, color: colors.closures },
    { label: "प्रत्यक्ष मिळालेले व्याज", value: totals.totalInterest, color: colors.interest },
  ];
  const accountMetrics: Metric[] = [
    { label: "दिलेली कर्जखाती", value: totals.totalLoans, color: colors.accounts },
    { label: "बंद झालेली खाती", value: totals.closedLoans, color: colors.closures },
  ];
  const keyMetrics: Metric[] = [
    amountMetrics[0],
    amountMetrics[1],
    amountMetrics[2],
  ];

  if (cumulative) {
    keyMetrics.push({
      label: "आजची मुद्दल शिल्लक",
      value: totals.activeBalance,
      color: colors.balance,
    });
    amountMetrics.push({
      label: "आजची मुद्दल शिल्लक",
      value: totals.activeBalance,
      color: colors.balance,
    });
    accountMetrics.push({
      label: "आज सक्रिय खाती",
      value: totals.activeLoans,
      color: colors.balance,
    });
  }

  return `<section class="summary-overview${cumulative ? "" : " summary-overview-period"}" aria-label="खाते सारांश: मुद्दल आणि वसुली">
    <div class="summary-overview-heading">
      <div>
        <p class="summary-overview-kicker">खाते सारांश</p>
        <h2>मुद्दल आणि वसुली</h2>
      </div>
      <p class="summary-overview-mode">${cumulative ? "एकूण हिशोब" : "निवडलेल्या कालावधीतील व्यवहार"}</p>
    </div>
    <div class="summary-overview-metrics">${keyMetrics.map(renderMetric).join("")}</div>
    <div class="summary-overview-charts">
      ${renderChart("रकमेची तुलना", amountMetrics, "currency")}
      ${renderChart("खात्यांची तुलना", accountMetrics, "count")}
    </div>
    <p class="summary-overview-note">${cumulative
      ? "बंद खात्यांतून परत आलेले मुद्दल आणि प्रत्यक्ष मिळालेले व्याज स्वतंत्र दाखवले आहे. शिल्लक ही आजची संचयी स्थिती आहे."
      : "बंद मुद्दल आणि प्रत्यक्ष मिळालेले व्याज हे निवडलेल्या कालावधीतील प्राप्ती आहेत."}</p>
  </section>`;
}

export const accountSummaryPrintOverviewStyles = `
  .summary-overview {
    margin: 0 0 9px;
    color: #24243b;
    border: 1px solid #d9d8eb;
    padding: 4mm;
    background: #fff;
  }
  .summary-overview-heading {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 5mm;
    padding-bottom: 2mm;
    border-bottom: 1px solid #e6e5f0;
  }
  .summary-overview-kicker {
    margin: 0 0 1px;
    color: #5147b8;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: .04em;
  }
  .summary-overview-heading h2 {
    margin: 0;
    font-size: 13pt;
    line-height: 1.3;
    font-weight: 700;
  }
  .summary-overview-mode {
    margin: 0;
    color: #5c5b70;
    font-size: 8.5pt;
    text-align: right;
  }
  .summary-overview-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2.5mm;
    padding: 3mm 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .summary-overview-metric {
    min-width: 0;
    padding: 2mm 2.2mm;
    border-left: 2px solid var(--metric-color);
    background: #f7f6fc;
  }
  .summary-overview-period .summary-overview-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .summary-overview-metric span {
    display: block;
    color: #55546a;
    font-size: 8pt;
    line-height: 1.35;
  }
  .summary-overview-metric strong {
    display: block;
    margin-top: 1mm;
    color: #282744;
    font-size: 11pt;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .summary-overview-charts {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr);
    gap: 3mm;
    align-items: start;
  }
  .summary-overview-chart {
    min-width: 0;
    padding: 2.5mm;
    border: 1px solid #e2e1ee;
    background: #fff;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .summary-overview-chart h3 {
    margin: 0 0 2mm;
    color: #35334f;
    font-size: 9pt;
    line-height: 1.3;
  }
  .summary-overview-rows {
    display: grid;
    gap: 2mm;
  }
  .summary-overview-chart-row { min-width: 0; }
  .summary-overview-row-heading {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 2mm;
    color: #454458;
    font-size: 8.5pt;
    line-height: 1.7;
    padding-bottom: 1mm;
  }
  .summary-overview-row-label {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .summary-overview-row-heading strong {
    flex: 0 1 60%;
    min-width: 0;
    max-width: 60%;
    color: #29283f;
    font-size: 9pt;
    font-variant-numeric: tabular-nums;
    text-align: right;
    overflow-wrap: anywhere;
  }
  .summary-overview-track {
    position: relative;
    height: 2.4mm;
    margin-top: 2mm;
    background: #f0eff5;
  }
  .summary-overview-zero {
    position: absolute;
    z-index: 1;
    top: -1mm;
    bottom: -1mm;
    width: .3mm;
    background: #77758a;
  }
  .summary-overview-bar {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--metric-color);
  }
  .summary-overview-axis {
    position: relative;
    display: flex;
    justify-content: space-between;
    margin-top: 1.5mm;
    color: #69687b;
    font-size: 7pt;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }
  .summary-overview-axis-zero {
    position: absolute;
    transform: translateX(-50%);
    color: #5147b8;
  }
  .summary-overview-note {
    margin: 2.5mm 0 0;
    color: #5b5a6c;
    font-size: 7.5pt;
    line-height: 1.4;
  }
  @media (max-width: 700px) {
    .summary-overview-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .summary-overview-charts { grid-template-columns: minmax(0, 1fr); }
  }
  @media print {
    .summary-overview { margin-bottom: 2.5mm; }
    .summary-overview-metrics, .summary-overview-chart { break-inside: avoid; page-break-inside: avoid; }
  }
`;
