import React, { useId } from "react";

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

const currency = new Intl.NumberFormat("mr-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const countFormat = new Intl.NumberFormat("mr-IN", {
  maximumFractionDigits: 0,
});

function formatRupees(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

function formatCount(value: number) {
  return countFormat.format(Number.isFinite(value) ? value : 0);
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
      <p className="aso-zero-note">प्रमाण दाखवण्यासाठी अक्ष ₹० / ० खात्यांपासून सुरू होतो.</p>
    </section>
  );
}

function compactCurrency(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toLocaleString("mr-IN", { maximumFractionDigits: 1 })} कोटी`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toLocaleString("mr-IN", { maximumFractionDigits: 1 })} लाख`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toLocaleString("mr-IN", { maximumFractionDigits: 1 })} ह.`;
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

  const rupeeItems: BarDatum[] = [
    { label: "वाटप केलेले मुद्दल", value: totals.totalAmount, color: "#61A9BD" },
    { label: "बंद कर्जातून परत आलेले मुद्दल", value: totals.closedAmount, color: "#CED14E" },
    { label: "प्रत्यक्ष मिळालेले व्याज", value: totals.totalInterest, color: "#44986D" },
  ];
  if (isCumulative) {
    rupeeItems.push({
      label: "आजची सक्रिय मुद्दल शिल्लक",
      value: totals.activeBalance,
      color: "#DD83C9",
    });
  }

  const accountItems: BarDatum[] = [
    { label: "दिलेली कर्जखाती", value: totals.totalLoans, color: "#61A9BD" },
    { label: "बंद झालेली खाती", value: totals.closedLoans, color: "#CED14E" },
  ];
  if (isCumulative) {
    accountItems.push({
      label: "आज सक्रिय खाती",
      value: totals.activeLoans,
      color: "#DD83C9",
    });
  }

  return (
    <section className="aso" aria-labelledby={`${id}-heading`}>
      <style>{styles}</style>
      <header className="aso-header">
        <div className="aso-title-block">
          <span className="aso-eyebrow">खाते सारांश</span>
          <h2 id={`${id}-heading`}>मुद्दल, परतावा आणि खाती</h2>
          <p>
            {isCumulative
              ? "एकूण व्यवहार आणि आजची सक्रिय स्थिती वेगवेगळी दाखवली आहे."
              : "या कालावधीत वाटप, बंद खात्यांतून आलेले मुद्दल आणि मिळालेले व्याज."}
          </p>
        </div>
        <div className="aso-scope" aria-label={`अहवाल व्याप्ती: ${periodText}${subsetLabel ? `, ${subsetLabel}` : ""}`}>
          <span>{isCumulative ? "संचयी अहवाल" : "कालावधी अहवाल"}</span>
          <strong>{periodText}</strong>
          {subsetLabel && <small>{subsetLabel}</small>}
        </div>
      </header>

      <div className="aso-key-totals" aria-label="मुख्य एकूण">
        <article className="aso-total aso-total-primary">
          <span>वाटप केलेले मुद्दल</span>
          <strong>{formatRupees(totals.totalAmount)}</strong>
          <small>दिलेल्या कर्जांचे मुद्दल</small>
        </article>
        <article className="aso-total">
          <span>बंद कर्जातून परत आलेले मुद्दल</span>
          <strong>{formatRupees(totals.closedAmount)}</strong>
          <small>बंद खात्यांच्या मुद्दलाची वसुली</small>
        </article>
        <article className="aso-total">
          <span>प्रत्यक्ष मिळालेले व्याज</span>
          <strong>{formatRupees(totals.totalInterest)}</strong>
          <small>{interestLabel || 'व्याजाची प्राप्ती — बाकी मुद्दल नव्हे'}</small>
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
          description="मुद्दल आणि प्रत्यक्ष मिळालेले व्याज स्वतंत्र मोजमाप."
          items={rupeeItems}
          id={`${id}-rupees`}
          unit="rupees"
        />
        <HorizontalBars
          title="खात्यांची तुलना"
          description={isCumulative ? "कर्जखात्यांची संख्या; रकमेपासून स्वतंत्र." : "या कालावधीत दिलेली आणि बंद झालेली खाती."}
          items={accountItems}
          id={`${id}-accounts`}
          unit="count"
        />
      </div>

      <p className="aso-footnote">
        {isCumulative
          ? "बंद खात्यांतून परत आलेले मुद्दल हे सक्रिय शिल्लक नाही; व्याजाची प्राप्तीही मुद्दलापासून वेगळी आहे."
          : "कालावधीतील बंद मुद्दल आणि व्याज हे प्राप्तीचे मोजमाप आहे. ऐतिहासिक सक्रिय शिल्लक दाखवलेली नाही."}
      </p>
    </section>
  );
}

const styles = `
  .aso {
    --aso-ink: #263c36;
    --aso-muted: #66756c;
    --aso-paper: #f7f7f0;
    --aso-line: #dce2d7;
    color: var(--aso-ink);
    background: var(--aso-paper);
    border: 1px solid var(--aso-line);
    border-radius: 16px;
    padding: clamp(16px, 3vw, 28px);
    margin: 0 0 24px;
    font-family: inherit;
    break-inside: avoid;
  }
  .aso * { box-sizing: border-box; }
  .aso-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
    margin-bottom: 22px;
  }
  .aso-eyebrow {
    display: block;
    color: #788866;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .11em;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .aso-title-block h2 {
    margin: 0;
    font-size: clamp(20px, 3vw, 27px);
    line-height: 1.25;
    letter-spacing: -.025em;
    color: var(--aso-ink);
  }
  .aso-title-block p {
    color: var(--aso-muted);
    font-size: 13px;
    line-height: 1.5;
    margin: 7px 0 0;
  }
  .aso-scope {
    flex: 1 1 280px;
    display: grid;
    gap: 3px;
    min-width: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
    border-left: 2px solid #bd7c3c;
    padding: 2px 0 2px 12px;
    color: var(--aso-muted);
    font-size: 12px;
  }
  .aso-scope span { font-weight: 700; color: #9a6536; }
  .aso-scope strong { color: var(--aso-ink); font-size: 13px; }
  .aso-scope small { font-size: 11px; }
  .aso-key-totals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
    gap: 10px;
    margin-bottom: 18px;
  }
  .aso-total {
    min-width: 0;
    border: 1px solid var(--aso-line);
    border-radius: 11px;
    padding: 14px 15px 13px;
    background: #fffef9;
  }
  .aso-total-primary { background: #e8eee6; border-color: #cbd8ca; }
  .aso-total-current { background: #f1eee2; border-color: #ddd5bd; }
  .aso-total > span {
    display: block;
    color: var(--aso-muted);
    font-size: 12px;
    font-weight: 650;
    line-height: 1.45;
    min-height: 34px;
  }
  .aso-total strong {
    display: block;
    margin-top: 5px;
    color: var(--aso-ink);
    font-size: clamp(20px, 3.5vw, 27px);
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .aso-total small { display: block; margin-top: 6px; color: var(--aso-muted); font-size: 11px; }
  .aso-charts {
    display: grid;
    grid-template-columns: minmax(0, 1.18fr) minmax(0, .82fr);
    gap: 12px;
    align-items: stretch;
  }
  .aso-chart {
    min-width: 0;
    padding: 16px 14px 12px;
    border: 1px solid var(--aso-line);
    border-radius: 12px;
    background: #fffef9;
  }
  .aso-chart-heading { display: flex; justify-content: space-between; gap: 8px; }
  .aso-chart-heading h3 { margin: 0; font-size: 15px; color: var(--aso-ink); }
  .aso-chart-heading p { margin: 4px 0 0; color: var(--aso-muted); font-size: 11px; line-height: 1.4; }
  .aso-chart-unit {
    display: grid;
    place-items: center;
    align-self: flex-start;
    width: 27px;
    height: 27px;
    flex: 0 0 27px;
    border-radius: 50%;
    color: #526c5d;
    background: #edf1e9;
    font-size: 12px;
    font-weight: 800;
  }
  .aso-visual { width: 100%; margin-top: 9px; }
  .aso-bars { display: block; width: 100%; height: auto; overflow: visible; }
  .aso-axis-label { fill: #788078; font-size: 10px; }
  .aso-row-label { fill: #47574f; font-size: 11px; font-weight: 650; }
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
    color: #59675f;
    font-size: 11px;
    line-height: 1.4;
  }
  .aso-swatch { width: 8px; height: 8px; border-radius: 3px; margin-top: 3px; }
  .aso-values strong { color: var(--aso-ink); font-size: 11px; font-variant-numeric: tabular-nums; text-align: right; }
  .aso-zero-note { color: #879087; font-size: 10px; margin: 9px 0 0; }
  .aso-footnote {
    margin: 13px 1px 0;
    color: #59675f;
    font-size: 11px;
    line-height: 1.5;
  }
  @media (max-width: 700px) {
    .aso-header { display: block; }
    .aso-scope { margin-top: 13px; }
    .aso-charts { grid-template-columns: minmax(0, 1fr); }
    .aso-key-totals { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .aso-total { padding: 12px; }
    .aso-total > span { min-height: 0; }
  }
  @media (max-width: 380px) {
    .aso-key-totals { grid-template-columns: minmax(0, 1fr); }
    .aso-chart { padding: 13px 10px 11px; }
    .aso-axis-label { font-size: 9px; }
    .aso-row-label { font-size: 10px; }
    .aso-values li { font-size: 10px; }
  }
  @media print {
    .aso { background: #fff; border: 1px solid #9aa59b; padding: 14px; margin-bottom: 12px; }
    .aso-chart, .aso-total { background: #fff; break-inside: avoid; }
    .aso-charts { grid-template-columns: 1fr 1fr; }
    .aso-bars { max-height: 190px; }
    .aso-footnote, .aso-values, .aso-axis-label, .aso-row-label { color: #222; }
  }
`;

