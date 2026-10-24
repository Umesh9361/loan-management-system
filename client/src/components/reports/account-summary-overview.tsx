import React, { useId } from "react";
import { englishSummaryDigits, formatSummaryCount, formatSummaryCurrency } from "@shared/account-summary-format";

type AccountSummaryTotals = {
  totalLoans: number;
  activeLoans: number;
  closedLoans: number;
  totalAmount: number;
  closedAmount: number;
  activeBalance: number;
  totalInterest: number;
};

export type AccountSummaryOverviewProps = {
  totals: AccountSummaryTotals;
  mode: "cumulative" | "period";
  periodText: string;
  subsetLabel?: string;
  interestLabel?: string;
};

function formatRupees(value: number) {
  return formatSummaryCurrency(Number.isFinite(value) ? value : 0);
}

function formatCount(value: number) {
  return formatSummaryCount(Number.isFinite(value) ? value : 0);
}

type BarDatum = {
  label: string;
  value: number;
  color: string;
};

function HorizontalBars({
  title,
  description,
  items,
  id,
  unit,
}: {
  title: string;
  description: string;
  items: BarDatum[];
  id: string;
  unit: "rupees" | "count";
}) {
  const max = Math.max(...items.map((item) => item.value), 0);
  const min = Math.min(...items.map((item) => item.value), 0);
  const scaleSpan = max - min || 1;
  const axisLabels = min < 0 ? [min, 0, max] : [0, max / 2, max];
  const format = unit === "rupees" ? formatRupees : formatCount;
  const width = 520;
  const chartLeft = 8;
  const chartRight = 8;
  const plotWidth = width - chartLeft - chartRight;
  const zeroX = chartLeft + (-min / scaleSpan) * plotWidth;
  const rowHeight = 44;
  const top = 12;
  const chartHeight = top + items.length * rowHeight + 24;

  return (
    <section className="aso-chart" aria-labelledby={`${id}-title`}>
      <div className="aso-chart-heading">
        <div>
          <h3 id={`${id}-title`}>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="aso-chart-unit">{unit === "rupees" ? "₹" : "खाती"}</span>
      </div>
      <div className="aso-visual">
        <svg
          className="aso-bars"
          viewBox={`0 0 ${width} ${chartHeight}`}
          role="img"
          aria-labelledby={`${id}-svg-title ${id}-svg-desc`}
          preserveAspectRatio="none"
        >
          <title id={`${id}-svg-title`}>{title}</title>
          <desc id={`${id}-svg-desc`}>
            {items.map((item) => `${item.label}: ${format(item.value)}`).join(" · ")}
            . अक्ष शून्यापासून सुरू होतो.
          </desc>
          {axisLabels.map((value, index) => {
            const x = chartLeft + ((value - min) / scaleSpan) * plotWidth;
            return (
              <g key={index}>
                <line
                  x1={x}
                  y1={top - 3}
                  x2={x}
                  y2={chartHeight - 18}
                  stroke="#e2e8f0"
                  strokeDasharray={index === 0 ? undefined : "3 5"}
                />
                <text
                  x={x}
                  y={chartHeight - 3}
                  textAnchor={index === 0 ? "start" : index === 2 ? "end" : "middle"}
                  className="aso-axis-label"
                >
                  {unit === "rupees" ? compactCurrency(value) : formatCount(value)}
                </text>
              </g>
            );
          })}
          {items.map((item, index) => {
            const y = top + index * rowHeight;
            const barWidth = Math.abs(item.value) / scaleSpan * plotWidth;
            return (
              <g key={item.label}>
                <text x={chartLeft} y={y + 11} className="aso-row-label">
                  {item.label}
                </text>
                <rect
                  x={chartLeft}
                  y={y + 17}
                  width={plotWidth}
                  height={12}
                  rx={6}
                  fill="#f1f5f9"
                />
                {barWidth > 0 && (
                  <rect
                    x={item.value < 0 ? zeroX - barWidth : zeroX}
                    y={y + 17}
                    width={barWidth}
                    height={12}
                    rx={6}
                    fill={item.value < 0 ? "var(--aso-danger)" : item.color}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="aso-values" aria-label={`${title} — अचूक मूल्ये`}>
        {items.map((item) => (
          <li key={item.label}>
            <span className="aso-swatch" style={{ backgroundColor: item.color }} aria-hidden="true" />
            <span>{item.label}</span>
            <strong>{format(item.value)}</strong>
          </li>
        ))}
      </ul>
      <p className="aso-zero-note">प्रमाणरेषा शून्यापासून.</p>
    </section>
  );
}

function compactCurrency(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  const compact = (number: number) => englishSummaryDigits(number.toLocaleString("en-IN", { maximumFractionDigits: 1 }));
  if (amount >= 10_000_000) return `₹${compact(amount / 10_000_000)} कोटी`;
  if (amount >= 100_000) return `₹${compact(amount / 100_000)} लाख`;
  if (amount >= 1_000) return `₹${compact(amount / 1_000)} ह.`;
  return `₹${formatCount(amount)}`;
}

export function AccountSummaryOverview({
  totals,
  mode,
  periodText,
  subsetLabel,
  interestLabel,
}: AccountSummaryOverviewProps) {
  const id = useId().replace(/:/g, "");
  const isCumulative = mode === "cumulative";
  const interestDates = interestLabel?.match(/\(([^)]+)\)/)?.[1];
  const shortInterestLabel = interestDates
    ? `${interestLabel?.includes("सुरुवातीपासून") ? "सुरुवातीपासून" : "व्याजाचा कालावधी"}: ${englishSummaryDigits(interestDates)}`
    : interestLabel ? englishSummaryDigits(interestLabel) : "प्रत्यक्ष मिळालेले; बाकी व्याज नाही";

  const rupeeItems: BarDatum[] = [
    { label: "वाटप केलेले मुद्दल", value: totals.totalAmount, color: "var(--aso-disbursements)" },
    { label: "बंद खात्यांतून परत आलेले मुद्दल", value: totals.closedAmount, color: "var(--aso-closures)" },
    { label: "प्रत्यक्ष मिळालेले व्याज", value: totals.totalInterest, color: "var(--aso-interest)" },
  ];
  if (isCumulative) {
    rupeeItems.push({
      label: "आजची मुद्दल शिल्लक",
      value: totals.activeBalance,
      color: "var(--aso-balance)",
    });
  }

  const accountItems: BarDatum[] = [
    { label: "दिलेली कर्जखाती", value: totals.totalLoans, color: "var(--aso-disbursements)" },
    { label: "बंद झालेली खाती", value: totals.closedLoans, color: "var(--aso-closures)" },
  ];
  if (isCumulative) {
    accountItems.push({
      label: "आज सक्रिय खाती",
      value: totals.activeLoans,
      color: "var(--aso-balance)",
    });
  }

  return (
    <section className="aso" aria-labelledby={`${id}-heading`}>
      <style>{styles}</style>
      <header className="aso-header">
        <div className="aso-title-block">
          <span className="aso-eyebrow">खाते सारांश</span>
          <h2 id={`${id}-heading`}>मुद्दल आणि वसुली</h2>
          <p>
            {isCumulative
              ? "एकूण व्यवहार; शिल्लक आजची."
              : "या कालावधीतील वाटप आणि प्राप्ती."}
          </p>
        </div>
        <div className="aso-scope" aria-label={`अहवाल व्याप्ती: ${englishSummaryDigits(periodText)}${subsetLabel ? `, ${englishSummaryDigits(subsetLabel)}` : ""}`}>
          <span>{isCumulative ? "एकूण हिशोब" : "कालावधी हिशोब"}</span>
          <strong>{englishSummaryDigits(periodText)}</strong>
          {subsetLabel && <small>{englishSummaryDigits(subsetLabel)}</small>}
        </div>
      </header>

      <div className={`aso-key-totals${[totals.totalAmount, totals.closedAmount, totals.totalInterest, ...(isCumulative ? [totals.activeBalance] : [])].some(value => formatRupees(value).length > 14) ? " aso-key-totals-long" : ""}`} aria-label="मुख्य एकूण">
        <article className="aso-total aso-total-primary">
          <span>वाटप केलेले मुद्दल</span>
          <strong>{formatRupees(totals.totalAmount)}</strong>
          <small>एकूण कर्जवाटप</small>
        </article>
        <article className="aso-total">
          <span>परत आलेले मुद्दल</span>
          <strong>{formatRupees(totals.closedAmount)}</strong>
          <small>बंद कर्जांतून</small>
        </article>
        <article className="aso-total">
          <span>प्रत्यक्ष मिळालेले व्याज</span>
          <strong>{formatRupees(totals.totalInterest)}</strong>
          <small>{shortInterestLabel}</small>
        </article>
        {isCumulative && (
          <article className="aso-total aso-total-current">
            <span>आज सक्रिय मुद्दल शिल्लक</span>
            <strong>{formatRupees(totals.activeBalance)}</strong>
            <small>{formatCount(totals.activeLoans)} सक्रिय खाती</small>
          </article>
        )}
      </div>

      <div className="aso-charts">
        <HorizontalBars
          title="रकमेची तुलना"
          description="मुद्दल व प्रत्यक्ष मिळालेले व्याज."
          items={rupeeItems}
          id={`${id}-rupees`}
          unit="rupees"
        />
        <HorizontalBars
          title="खात्यांची तुलना"
          description={isCumulative ? "खात्यांची संख्या." : "या कालावधीत दिलेली व बंद खाती."}
          items={accountItems}
          id={`${id}-accounts`}
          unit="count"
        />
      </div>

      <details className="aso-footnote">
        <summary>अहवाल समजून घ्या</summary>
        {interestLabel && <p>{englishSummaryDigits(interestLabel)}</p>}
        <p>{isCumulative
          ? "परत आलेले मुद्दल व प्रत्यक्ष व्याज स्वतंत्र आहेत. सक्रिय शिल्लक फक्त आजची संचयी स्थिती आहे."
          : "कालावधीतील बंद मुद्दल व प्रत्यक्ष व्याज प्राप्ती म्हणून दाखवले आहेत; ऐतिहासिक शिल्लक दाखवलेली नाही."}</p>
      </details>
    </section>
  );
}

const styles = `
  .aso {
    --aso-ink: #1e293b;
    --aso-muted: #64748b;
    --aso-paper: #ffffff;
    --aso-line: #e2e8f0;
    --aso-primary: #4f46e5;
    --aso-disbursements: #4f46e5;
    --aso-closures: #0d9488;
    --aso-interest: #f59e0b;
    --aso-balance: #0284c7;
    --aso-danger: #D8524F;
    color: var(--aso-ink);
    background: var(--aso-paper);
    border: 1px solid var(--aso-line);
    border-top: 3px solid var(--aso-primary);
    border-radius: 12px;
    padding: clamp(14px, 2.5vw, 24px);
    margin: 0 0 24px;
    font-family: inherit;
    box-shadow: 0 2px 8px rgb(15 23 42 / 5%);
  }
  .aso * { box-sizing: border-box; }
  .aso-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 19px;
  }
  .aso-eyebrow {
    display: block;
    color: var(--aso-primary);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .08em;
    margin-bottom: 6px;
  }
  .aso-title-block h2 {
    margin: 0;
    font-size: clamp(21px, 3vw, 28px);
    line-height: 1.25;
    letter-spacing: -.035em;
    color: var(--aso-ink);
  }
  .aso-title-block p {
    color: var(--aso-muted);
    font-size: 12px;
    line-height: 1.5;
    margin: 6px 0 0;
  }
  .aso-scope {
    flex: 1 1 260px;
    display: grid;
    gap: 4px;
    min-width: 0;
    max-width: 100%;
    border-left: 3px solid var(--aso-primary);
    border-radius: 0 9px 9px 0;
    padding: 6px 10px 6px 12px;
    color: var(--aso-ink);
    font-size: 11px;
    background: #eef2ff;
  }
  .aso-scope span { font-weight: 800; color: var(--aso-primary); }
  .aso-scope strong { color: var(--aso-ink); font-size: 12px; line-height: 1.4; }
  .aso-scope small { color: var(--aso-muted); font-size: 10px; line-height: 1.4; }
  .aso-key-totals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }
  .aso-total {
    min-width: 0;
    border: 1px solid var(--aso-line);
    border-radius: 11px;
    padding: 11px 12px 10px;
    background: #fff;
  }
  .aso-total-primary { background: #eef2ff; border-color: #c7d2fe; border-left: 3px solid var(--aso-disbursements); }
  .aso-total:nth-child(2) { border-left: 3px solid var(--aso-closures); }
  .aso-total:nth-child(3) { border-left: 3px solid var(--aso-interest); }
  .aso-total-current { background: #f0f9ff; border-color: #bae6fd; border-left: 3px solid var(--aso-balance); }
  .aso-total > span {
    display: block;
    color: var(--aso-muted);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.45;
    min-height: 31px;
  }
  .aso-total strong {
    display: block;
    margin-top: 7px;
    color: var(--aso-ink);
    font-size: clamp(14px, 2.3vw, 23px);
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    letter-spacing: -.035em;
  }
  .aso-total small { display: block; margin-top: 7px; color: var(--aso-muted); font-size: 10px; line-height: 1.4; }
  .aso-charts {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 9px;
    align-items: stretch;
  }
  .aso-chart {
    min-width: 0;
    padding: 12px 12px 10px;
    border: 1px solid var(--aso-line);
    border-radius: 10px;
    background: #fff;
  }
  .aso-chart-heading { display: flex; justify-content: space-between; gap: 8px; }
  .aso-chart-heading h3 { margin: 0; font-size: 15px; color: var(--aso-ink); }
  .aso-chart-heading p { margin: 4px 0 0; color: var(--aso-muted); font-size: 11px; line-height: 1.4; }
  .aso-chart-unit {
    display: grid;
    place-items: center;
    align-self: flex-start;
    min-width: 32px;
    min-height: 28px;
    padding: 3px 7px;
    flex: 0 0 auto;
    border-radius: 9px;
    color: var(--aso-primary);
    background: #eef2ff;
    font-size: 12px;
    font-weight: 800;
  }
  .aso-visual { width: 100%; margin-top: 9px; }
  .aso-bars { display: block; width: 100%; height: auto; overflow: visible; }
  .aso-axis-label { fill: #64748b; font-size: 10px; }
  .aso-row-label { fill: #334155; font-size: 11px; font-weight: 700; }
  .aso-values {
    list-style: none;
    margin: 2px 0 0;
    padding: 0;
    display: grid;
    gap: 7px;
  }
  .aso-values li {
    display: grid;
    grid-template-columns: 9px minmax(0, 1fr) auto;
    align-items: start;
    gap: 7px;
    color: #475569;
    font-size: 11px;
    line-height: 1.4;
  }
  .aso-swatch { width: 8px; height: 8px; border-radius: 3px; margin-top: 3px; }
  .aso-values strong {
    color: var(--aso-ink);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }
  .aso-zero-note { color: #64748b; font-size: 10px; margin: 7px 0 0; }
  .aso-footnote {
    margin: 13px 1px 0;
    color: #475569;
    font-size: 11px;
    line-height: 1.5;
  }
  .aso-footnote summary { cursor: pointer; font-weight: 650; }
  .aso-footnote p { margin: 7px 0 0; }
  @media (max-width: 700px) {
    .aso-header { display: block; }
    .aso-scope { margin-top: 13px; }
    .aso-charts { grid-template-columns: minmax(0, 1fr); }
    .aso-key-totals { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .aso-total > span { min-height: 0; }
    .aso-axis-label { font-size: 12px; }
    .aso-row-label { font-size: 13px; }
  }
  @media (max-width: 460px) {
    .aso { padding: 13px 11px; }
    .aso-key-totals { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
    .aso-key-totals-long { grid-template-columns: minmax(0, 1fr); }
    .aso-total { padding: 10px 8px; }
    .aso-total > span { font-size: 10px; }
    .aso-total strong { font-size: clamp(12px, 3.8vw, 17px); letter-spacing: -.035em; }
    .aso-key-totals-long .aso-total strong { font-size: clamp(18px, 6vw, 25px); }
    .aso-total small { font-size: 9px; overflow-wrap: anywhere; }
    .aso-chart { padding: 13px 11px 11px; }
    .aso-values li { font-size: 11px; }
    .aso-values strong { font-size: 11px; }
  }
  @media print {
    .aso { color: #1e293b; background: #fff; border: 1px solid #cbd5e1; border-top: 2px solid var(--aso-primary); border-radius: 0; padding: 7px 8px; margin: 0 0 5px; box-shadow: none; font-size: 9pt; }
    .aso-header { gap: 6px; margin-bottom: 6px; align-items: center; }
    .aso-eyebrow { margin-bottom: 1px; font-size: 8pt; }
    .aso-title-block h2 { font-size: 13pt; }
    .aso-title-block p { display: none; }
    .aso-scope { flex: 0 1 auto; margin: 0; padding: 3px 6px; font-size: 7pt; border-left-width: 2px; }
    .aso-scope strong { font-size: 8pt; }
    .aso-scope small { font-size: 7pt; }
    .aso-key-totals, .aso-key-totals-long { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; margin-bottom: 5px; }
    .aso-total, .aso-chart { background: #fff; break-inside: avoid; }
    .aso-total { padding: 5px 7px; border-radius: 0; }
    .aso-total > span { min-height: 0; font-size: 7pt; }
    .aso-total strong, .aso-key-totals-long .aso-total strong { margin-top: 2px; font-size: 10pt; }
    .aso-total small { display: none; }
    .aso-charts { grid-template-columns: 1fr 1fr; }
    .aso-chart { padding: 5px 6px; border-radius: 0; }
    .aso-chart-heading h3 { font-size: 9pt; }
    .aso-chart-heading p, .aso-chart-unit, .aso-zero-note, .aso-footnote { display: none; }
    .aso-visual { margin-top: 2px; }
    .aso-bars { max-height: 125px; }
    .aso-values { gap: 2px; margin-top: 1px; }
    .aso-values li { font-size: 7pt; line-height: 1.2; gap: 4px; }
    .aso-values strong { font-size: 7pt; }
    .aso-swatch { width: 7px; height: 7px; margin-top: 1px; }
    .aso-axis-label { fill: #475569; font-size: 9px; }
    .aso-row-label { fill: #1e293b; font-size: 10px; }
  }
`;

