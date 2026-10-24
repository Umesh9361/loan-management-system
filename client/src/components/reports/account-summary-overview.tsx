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
                  stroke="#d9ded5"
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
                  fill="#e9ece5"
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
    { label: "वाटप केलेले मुद्दल", value: totals.totalAmount, color: "#61A9BD" },
    { label: "बंद खात्यांतून परत आलेले मुद्दल", value: totals.closedAmount, color: "#C29B36" },
    { label: "प्रत्यक्ष मिळालेले व्याज", value: totals.totalInterest, color: "#278778" },
  ];
  if (isCumulative) {
    rupeeItems.push({
      label: "आजची मुद्दल शिल्लक",
      value: totals.activeBalance,
      color: "#D09142",
    });
  }

  const accountItems: BarDatum[] = [
    { label: "दिलेली कर्जखाती", value: totals.totalLoans, color: "#328E91" },
    { label: "बंद झालेली खाती", value: totals.closedLoans, color: "#C29B36" },
  ];
  if (isCumulative) {
    accountItems.push({
      label: "आज सक्रिय खाती",
      value: totals.activeLoans,
      color: "#D09142",
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
    --aso-ink: #183a3d;
    --aso-muted: #607574;
    --aso-paper: #f2f7f4;
    --aso-line: #d5e2dc;
    --aso-teal: #176e68;
    --aso-gold: #b5822f;
    color: var(--aso-ink);
    background: var(--aso-paper);
    border: 1px solid var(--aso-line);
    border-radius: 20px;
    padding: clamp(16px, 3vw, 28px);
    margin: 0 0 24px;
    font-family: inherit;
    break-inside: avoid;
    box-shadow: 0 8px 26px rgb(30 72 67 / 5%);
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
    color: var(--aso-teal);
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
    border-left: 3px solid var(--aso-gold);
    border-radius: 0 10px 10px 0;
    padding: 3px 10px 4px 12px;
    color: var(--aso-ink);
    font-size: 11px;
    background: #e8f0eb;
  }
  .aso-scope span { font-weight: 800; color: #906321; }
  .aso-scope strong { color: var(--aso-ink); font-size: 12px; line-height: 1.4; }
  .aso-scope small { color: var(--aso-muted); font-size: 10px; line-height: 1.4; }
  .aso-key-totals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    margin-bottom: 16px;
  }
  .aso-total {
    min-width: 0;
    border: 1px solid var(--aso-line);
    border-radius: 14px;
    padding: 13px 14px 12px;
    background: #fbfdfb;
  }
  .aso-total-primary { background: #e1f0eb; border-color: #c5ddd4; }
  .aso-total-current { background: #f4efdf; border-color: #e5d8b6; }
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
    font-size: clamp(16px, 4.2vw, 25px);
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    letter-spacing: -.045em;
  }
  .aso-total small { display: block; margin-top: 7px; color: var(--aso-muted); font-size: 10px; line-height: 1.4; }
  .aso-charts {
    display: grid;
    grid-template-columns: minmax(0, 1.18fr) minmax(0, .82fr);
    gap: 10px;
    align-items: stretch;
  }
  .aso-chart {
    min-width: 0;
    padding: 15px 14px 12px;
    border: 1px solid var(--aso-line);
    border-radius: 15px;
    background: #fbfdfb;
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
    color: var(--aso-teal);
    background: #e5f0ec;
    font-size: 12px;
    font-weight: 800;
  }
  .aso-visual { width: 100%; margin-top: 9px; }
  .aso-bars { display: block; width: 100%; height: auto; overflow: visible; }
  .aso-axis-label { fill: #647a76; font-size: 10px; }
  .aso-row-label { fill: #274b49; font-size: 11px; font-weight: 700; }
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
    color: #526b68;
    font-size: 12px;
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
  .aso-zero-note { color: #7a8c88; font-size: 10px; margin: 9px 0 0; }
  .aso-footnote {
    margin: 13px 1px 0;
    color: #526b68;
    font-size: 11px;
    line-height: 1.5;
  }
  .aso-footnote summary { cursor: pointer; font-weight: 650; }
  .aso-footnote p { margin: 7px 0 0; }
  @media (max-width: 700px) {
    .aso-header { display: block; }
    .aso-scope { margin-top: 13px; }
    .aso-charts { grid-template-columns: minmax(0, 1fr); }
    .aso-key-totals { grid-template-columns: minmax(0, 1fr); }
    .aso-total > span { min-height: 0; }
    .aso-axis-label { font-size: 17px; }
    .aso-row-label { font-size: 18px; }
  }
  @media (max-width: 460px) {
    .aso-key-totals { grid-template-columns: minmax(0, 1fr); }
    .aso-total { padding: 12px 14px; }
    .aso-total strong { font-size: clamp(18px, 6vw, 25px); }
    .aso-chart { padding: 13px 11px 11px; }
    .aso-values li { font-size: 11px; }
  }
  @media print {
    .aso { color: #183a3d; background: #fff; border: 1px solid #9aa59b; padding: 14px; margin-bottom: 12px; box-shadow: none; }
    .aso-chart, .aso-total { background: #fff; break-inside: avoid; }
    .aso-charts { grid-template-columns: 1fr 1fr; }
    .aso-bars { max-height: 190px; }
    .aso-footnote, .aso-values, .aso-axis-label, .aso-row-label { color: #222; }
  }
`;

