import React from "react";
import { formatWeight } from "@shared/report-weights";

export type BorrowerListTotalsProps = {
  totals: {
    count: number;
    totalAmount: number;
    goldWeight: number;
    silverWeight: number;
    totalWeight: number;
    totalInterest: number | null;
  } | null;
  status: "ready" | "loading" | "error";
  errorMessage?: string;
};

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

export function BorrowerListTotals({
  totals,
  status,
  errorMessage,
}: BorrowerListTotalsProps) {
  if (status === "loading") {
    return (
      <section className="borrower-totals borrower-totals-status" aria-label="सर्व शोध निकालांची एकूण" aria-live="polite">
        <p>एकूण माहिती लोड होत आहे…</p>
        <style>{styles}</style>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="borrower-totals borrower-totals-status" role="alert" aria-label="सर्व शोध निकालांची एकूण">
        <p>{errorMessage || "एकूण माहिती दाखवता आली नाही."}</p>
        <style>{styles}</style>
      </section>
    );
  }

  if (!totals || totals.count === 0) return null;

  return (
    <section className="borrower-totals" aria-labelledby="borrower-totals-title">
      <style>{styles}</style>
      <header className="borrower-totals-header">
        <h2 id="borrower-totals-title">सर्व शोध निकालांची एकूण</h2>
        <p>ही बेरीज सर्व फिल्टर केलेल्या नोंदींची आहे; सध्याच्या पानापुरती नाही.</p>
      </header>
      <dl className="borrower-totals-list">
        <div className="borrower-total borrower-total-primary">
          <dt>एकूण कर्जनोंदी</dt>
          <dd>{totals.count.toLocaleString("en-IN")}</dd>
        </div>
        <div className="borrower-total borrower-total-primary">
          <dt>एकूण मुद्दल</dt>
          <dd>₹{rupeeFormatter.format(totals.totalAmount)}</dd>
        </div>
        <div className="borrower-total">
          <dt>एकूण तारण वजन</dt>
          <dd>{formatWeight(totals.totalWeight)} ग्रॅम</dd>
        </div>
        <div className="borrower-total">
          <dt>सोने</dt>
          <dd>{formatWeight(totals.goldWeight)} ग्रॅम</dd>
        </div>
        <div className="borrower-total">
          <dt>चांदी</dt>
          <dd>{formatWeight(totals.silverWeight)} ग्रॅम</dd>
        </div>
        {totals.totalInterest !== null && (
          <div className="borrower-total">
            <dt>एकूण व्याज</dt>
            <dd>₹{rupeeFormatter.format(totals.totalInterest)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

const styles = `
  .borrower-totals {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    margin: 12px 0 0;
    padding: 12px;
    border: 1px solid #c7d2fe;
    border-radius: 10px;
    background: #f5f6ff;
    color: #252b55;
    font-family: 'Noto Sans Devanagari', 'Mukta', sans-serif;
  }
  .borrower-totals-header { margin-bottom: 8px; }
  .borrower-totals-header h2 {
    margin: 0;
    color: #3730a3;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.45;
  }
  .borrower-totals-header p {
    margin: 3px 0 0;
    color: #5b6080;
    font-size: 11px;
    line-height: 1.5;
  }
  .borrower-totals-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    margin: 0;
  }
  .borrower-total {
    display: flex;
    min-width: 0;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
    padding: 7px 8px;
    border: 1px solid #e0e4fa;
    border-radius: 7px;
    background: #fff;
  }
  .borrower-total dt {
    min-width: 0;
    color: #5b6080;
    font-size: 11px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .borrower-total dd {
    min-width: 0;
    margin: 0;
    color: #292e5e;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    line-height: 1.35;
    text-align: right;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .borrower-total-primary {
    border-color: #c7d2fe;
    background: #eef0ff;
  }
  .borrower-total-primary dd { color: #3730a3; }
  .borrower-totals-status { padding: 10px 12px; }
  .borrower-totals-status p {
    margin: 0;
    color: #3730a3;
    font-size: 12px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  @media (min-width: 640px) {
    .borrower-totals { padding: 14px 16px; }
    .borrower-totals-list { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .borrower-total { padding: 9px 10px; }
    .borrower-total dt { font-size: 12px; }
    .borrower-total dd { font-size: 13px; }
  }
`;
