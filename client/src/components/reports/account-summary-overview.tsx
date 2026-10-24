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
                  stroke="#ded9eb"
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
                  fill="#eeeaf5"
                />
                {barWidth > 0 && (
                  <rect
                    x={item.value < 0 ? zeroX - barWidth : zeroX}
                    y={y + 17}
                    width={barWidth}
                    height={12}
                    rx={6}
                    fill={item.value < 0 ? "#D8524F" : item.color}
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
    { label: "वाटप केलेले मुद्दल", value: totals.totalAmount, color: "#6546a5" },
    { label: "बंद खात्यांतून परत आलेले मुद्दल", value: totals.closedAmount, color: "#a17acb" },
    { label: "प्रत्यक्ष मिळालेले व्याज", value: totals.totalInterest, color: "#c06f9b" },
  ];
  if (isCumulative) {
    rupeeItems.push({
      label: "आजची मुद्दल शिल्लक",
      value: totals.activeBalance,
      color: "#805db6",
    });
  }

  const accountItems: BarDatum[] = [
    { label: "दिलेली कर्जखाती", value: totals.totalLoans, color: "#6546a5" },
    { label: "बंद झालेली खाती", value: totals.closedLoans, color: "#c06f9b" },
  ];
  if (isCumulative) {
    accountItems.push({
      label: "आज सक्रिय खाती",
      value: totals.activeLoans,
      color: "#a17acb",
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

      <div className="aso-key-totals" aria-label="मुख्य एकूण">
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
    --aso-ink: #30234a;
    --aso-muted: #716781;
    --aso-paper: #f7f4fb;
    --aso-line: #e3dced;
    --aso-primary: #6546a5;
    --aso-secondary: #a17acb;
    --aso-accent: #c06f9b;
    color: var(--aso-ink);
    background: var(--aso-paper);
    border: 1px solid var(--aso-line);
    border-radius: 16px;
    padding: clamp(14px, 2.5vw, 24px);
    margin: 0 0 24px;
    font-family: inherit;
    box-shadow: 0 5px 20px rgb(57 37 91 / 6%);
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
    border-left: 3px solid var(--aso-secondary);
    border-radius: 0 9px 9px 0;
    padding: 6px 10px 6px 12px;
    color: var(--aso-ink);
    font-size: 11px;
    background: #eee8f7;
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
  .aso-total-primary { background: #eee8f7; border-color: #d9ccea; }
  .aso-total-current { background: #f8edf3; border-color: #ead3df; }
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
    font-size: clamp(15px, 2.3vw, 23px);
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    letter-spacing: -.045em;
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
    border-radius: 12px;
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
    background: #eee8f7;
    font-size: 12px;
    font-weight: 800;
  }
  .aso-visual { width: 100%; margin-top: 9px; }
  .aso-bars { display: block; width: 100%; height: auto; overflow: visible; }
  .aso-axis-label { fill: #716781; font-size: 10px; }
  .aso-row-label { fill: #493666; font-size: 11px; font-weight: 700; }
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
    color: #655c73;
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
  .aso-zero-note { color: #81768f; font-size: 10px; margin: 7px 0 0; }
  .aso-footnote {
    margin: 13px 1px 0;
    color: #655c73;
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
    .aso-axis-label { font-size: 14px; }
    .aso-row-label { font-size: 15px; }
  }
  @media (max-width: 460px) {
    .aso { padding: 13px 11px; }
    .aso-key-totals { grid-template-columns: minmax(0, 1fr); gap: 7px; }
    .aso-total { padding: 10px 9px; }
    .aso-total > span { font-size: 10px; }
    .aso-total strong { font-size: clamp(18px, 6vw, 25px); letter-spacing: -.04em; }
    .aso-total small { font-size: 9px; }
    .aso-chart { padding: 13px 11px 11px; }
    .aso-values li { font-size: 11px; }
    .aso-values strong { font-size: 11px; }
  }
  @media print {
    .aso { color: #30234a; background: #fff; border: 1px solid #c9bfd7; border-radius: 0; padding: 7px 8px; margin: 0 0 5px; box-shadow: none; font-size: 9pt; }
    .aso-header { gap: 6px; margin-bottom: 6px; align-items: center; }
    .aso-eyebrow { margin-bottom: 1px; font-size: 8pt; }
    .aso-title-block h2 { font-size: 13pt; }
    .aso-title-block p { display: none; }
    .aso-scope { flex: 0 1 auto; margin: 0; padding: 3px 6px; font-size: 7pt; border-left-width: 2px; }
    .aso-scope strong { font-size: 8pt; }
    .aso-scope small { font-size: 7pt; }
    .aso-key-totals { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; margin-bottom: 5px; }
    .aso-total, .aso-chart { background: #fff; break-inside: avoid; }
    .aso-total { padding: 5px 7px; border-radius: 0; }
    .aso-total > span { min-height: 0; font-size: 7pt; }
    .aso-total strong { margin-top: 2px; font-size: 10pt; }
    .aso-total small { display: none; }
    .aso-charts { grid-template-columns: 1fr 1fr; }
    .aso-chart { padding: 5px 6px; border-radius: 0; }
    .aso-chart-heading h3 { font-size: 9pt; }
    .aso-chart-heading p, .aso-chart-unit, .aso-values, .aso-zero-note, .aso-footnote { display: none; }
    .aso-visual { margin-top: 2px; }
    .aso-bars { max-height: 125px; }
    .aso-axis-label { fill: #493666; font-size: 9px; }
    .aso-row-label { fill: #30234a; font-size: 10px; }
  }
`;

