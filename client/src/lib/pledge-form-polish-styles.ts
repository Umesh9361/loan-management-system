/**
 * Print-first finishing layer for pledge forms. Append after PLEDGE_FORMS_STYLES
 * so the renderer keeps ownership of page packing and fixed section dimensions.
 */
export const PLEDGE_FORM_POLISH_STYLES = `
/* A restrained ink-and-slate palette keeps the Marathi originals formal and legible. */
.pf-sheet {
  color: #202c38;
  font-family: "Noto Sans Devanagari", "Mangal", sans-serif;
  font-variant-numeric: lining-nums tabular-nums;
}
.pf-section {
  border-color: #546575;
  background: #fff;
  padding: 1.45mm 2.1mm;
}
.pf-heading {
  align-items: center;
  gap: 2.5mm;
  margin-bottom: 1.35mm;
  padding-bottom: .75mm;
  border-bottom: .22mm solid #9aa8b4;
}
.pf-heading > div {
  min-width: 0;
}
.pf-heading h2 {
  color: #1d3446;
  font-size: 10.2pt;
  font-weight: 700;
  line-height: 1.28;
  letter-spacing: .01em;
}
.pf-brand {
  margin-top: .35mm;
  color: #526778;
  font-size: 7.1pt;
  font-weight: 600;
  line-height: 1.28;
}
.pf-date {
  flex: 0 0 auto;
  color: #344d5f;
  font-size: 7.1pt;
  font-weight: 600;
  text-align: right;
}
.pf-line {
  color: #293746;
  font-size: 7.45pt;
  line-height: 1.38;
}
.pf-line > span:first-child {
  color: #34495a;
  font-weight: 600;
}
.pf-fill {
  border-bottom-color: #8393a0;
}
.pf-subtitle {
  color: #203c4d;
  background: #eaf0f2;
  border-bottom-color: #8598a5;
  font-weight: 700;
  letter-spacing: .01em;
}
.pf-table {
  color: #293746;
  font-size: 7.05pt;
}
.pf-table th,
.pf-table td {
  border-color: #667986;
  padding: .45mm .65mm;
  line-height: 1.24;
}
.pf-table th {
  color: #263f50;
  background: #eaf0f2;
  font-weight: 700;
}
.pf-table td:first-child {
  color: #425767;
  font-weight: 600;
}
.pf-table th:last-child,
.pf-table td:last-child {
  text-align: right;
  padding-right: 1.1mm;
  font-variant-numeric: tabular-nums;
}
.pf-box {
  border-color: #83939d;
  border-radius: .35mm;
  background: #fbfcfc;
  padding: 1mm 1.4mm;
}
.pf-box .pf-subtitle {
  margin-top: 0;
}
.pf-terms {
  color: #303e49;
  line-height: 1.38;
}
.pf-terms li {
  padding-left: .25mm;
}
.pf-notice-body {
  color: #293746;
  line-height: 1.47;
}
.pf-release,
.pf-disposal-text {
  color: #293746;
}
.pf-receipt-body {
  grid-template-columns: minmax(0, .85fr) minmax(0, 1.35fr);
}
.pf-photo {
  color: #566b79;
  border-color: #758895;
  border-radius: .35mm;
  background: #fbfcfc;
}
.pf-signatures {
  align-items: flex-end;
  margin-top: 3.6mm;
  padding: 0 2.2mm;
  color: #34495a;
  font-size: 7pt;
}
.pf-signatures > div {
  position: relative;
  min-width: 27mm;
  padding-top: 1.3mm;
  border-top: .18mm solid #7c8d99;
  text-align: center;
}
.pf-signatures > div:last-child {
  text-align: center;
}
.pf-signatures strong {
  font-weight: 600;
}
.pf-cut:after,
.pf-notices:after {
  border-color: #8797a2;
}
.pf-spacious .pf-section {
  padding: 2.65mm 3.1mm;
}
.pf-spacious .pf-heading {
  margin-bottom: 2mm;
  padding-bottom: 1mm;
}
.pf-spacious .pf-heading h2 {
  font-size: 12.2pt;
}
.pf-spacious .pf-brand,
.pf-spacious .pf-date {
  font-size: 8.5pt;
}
.pf-spacious .pf-line {
  font-size: 9pt;
}
.pf-spacious .pf-subtitle {
  font-size: 9pt;
}
.pf-spacious .pf-table {
  font-size: 8.8pt;
}
.pf-spacious .pf-terms {
  line-height: 1.56;
}
.pf-spacious .pf-notice-body {
  line-height: 1.68;
}
.pf-spacious .pf-signatures {
  margin-top: 5.7mm;
  font-size: 9pt;
}
.pf-single .pf-signatures {
  margin-top: 6.5mm;
}
.pf-all.pf-compact .pf-heading > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .3mm 2mm;
}
.pf-all.pf-compact .pf-brand {
  margin-top: 0;
}
.pf-all.pf-compact .pf-disposal .pf-heading {
  padding-bottom: .35mm;
  margin-bottom: .7mm;
}
.pf-all.pf-compact .pf-disposal .pf-signatures {
  margin-top: 2.4mm;
}
@media print {
  .pf-section,
  .pf-box,
  .pf-photo,
  .pf-table th {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
