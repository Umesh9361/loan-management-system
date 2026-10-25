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
  padding: 1.25mm 2mm;
  min-width: 0;
}
.pf-organization {
  display: flex;
  align-items: center;
  gap: 1.2mm;
  margin: 0 0 .35mm;
  color: #46596b;
  line-height: 1.22;
  overflow-wrap: anywhere;
}
.pf-organization-name {
  flex: 0 1 42%;
  min-width: 0;
  color: #273b68;
  font-size: 8.8pt;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  overflow-wrap: anywhere;
}
.pf-organization-details {
  display: flex;
  flex: 1 1 56%;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  column-gap: 1.2mm;
  color: #526274;
  font-size: 6.1pt;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.pf-organization-details > span {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.pf-organization-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  column-gap: 1.2mm;
  color: #46596b;
  font-size: inherit;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.pf-organization-meta > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.pf-heading {
  align-items: center;
  gap: 2.5mm;
  margin-bottom: .7mm;
  padding-bottom: .45mm;
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
  padding: 0 4mm;
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
  margin-bottom: 1mm;
  padding-bottom: .6mm;
}
.pf-spacious .pf-organization {
  margin-bottom: .5mm;
}
.pf-spacious .pf-organization-name {
  font-size: 13pt;
}
.pf-spacious .pf-organization-details {
  font-size: 7.1pt;
  line-height: 1.28;
}
.pf-spacious .pf-organization-meta {
  font-size: inherit;
}
.pf-spacious .pf-heading h2 {
  font-size: 10.5pt;
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
  line-height: 1.48;
}
.pf-spacious .pf-notice-body {
  line-height: 1.52;
}
.pf-spacious .pf-signatures {
  margin-top: 3.2mm;
  font-size: 9pt;
}
.pf-single .pf-signatures {
  margin-top: 4mm;
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
/* Full institution details must fit every cut section without reducing body type. */
.pf-organization-name:only-child {
  flex-basis: 100%;
}
.pf-all.pf-compact .pf-section {
  padding-top: 1mm;
  padding-bottom: 1mm;
}
.pf-all.pf-compact .pf-organization {
  margin-bottom: .05mm;
}
.pf-all.pf-compact .pf-organization-name {
  font-size: 10pt;
}
.pf-all.pf-compact .pf-heading {
  margin-bottom: .2mm;
  padding-bottom: .2mm;
}
.pf-all.pf-compact .pf-heading h2 {
  font-size: 9.2pt;
}
.pf-all.pf-compact .pf-signatures > div {
  padding-top: 1mm;
}
.pf-all.pf-compact .pf-disposal .pf-heading {
  margin-bottom: .2mm;
  padding-bottom: .2mm;
}
.pf-all.pf-compact .pf-disposal .pf-signatures {
  margin-top: 1.6mm;
}
.pf-all.pf-compact .pf-notice-body {
  margin-top: .7mm;
  margin-bottom: .7mm;
}
.pf-all.pf-compact .pf-disposal .pf-box {
  padding-top: .4mm;
  padding-bottom: .4mm;
}
/*
 * The six-form sheet is packed to the printable A4 height, then its spare
 * millimetres are shared by the actual receipts (not left as a bottom void).
 * Single-form selection deliberately keeps its own receipt-sized dimensions.
 */
.pf-all.pf-compact .pf-page,
.pf-spacious.pf-all .pf-page {
  display: flex;
  flex-direction: column;
  height: 287mm;
}
.pf-all.pf-compact .pf-page > .pf-section,
.pf-all.pf-compact .pf-page > .pf-notices,
.pf-spacious.pf-all .pf-page > .pf-section,
.pf-spacious.pf-all .pf-page > .pf-notices {
  flex: 1 1 auto;
  min-height: 0;
}
.pf-all.pf-spacious .pf-section {
  display: flex;
  flex-direction: column;
}
.pf-all.pf-spacious .pf-section > .pf-signatures {
  margin-top: 3.2mm;
  padding-top: 0;
  flex-shrink: 0;
}
.pf-all.pf-compact .pf-notices .pf-section {
  height: 100%;
}
.pf-all.pf-compact .pf-page > .pf-cut {
  flex: 0 0 1.6mm;
}
.pf-spacious.pf-all .pf-page > .pf-cut {
  flex: 0 0 2mm;
}
.pf-spacious.pf-all .pf-notices .pf-section {
  height: auto;
}
.pf-spacious.pf-all .pf-notices {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: stretch;
}
/* Use space for readable writing rows and content, not a blank push to the footer. */
.pf-all.pf-compact .pf-line {
  min-height: 3.8mm;
}
.pf-all.pf-compact .pf-table th,
.pf-all.pf-compact .pf-table td {
  height: 4.3mm;
  padding-top: .55mm;
  padding-bottom: .55mm;
}
.pf-spacious .pf-line {
  min-height: 5.5mm;
}
.pf-spacious .pf-fill {
  min-height: 5mm;
}
.pf-spacious .pf-table th,
.pf-spacious .pf-table td {
  height: 6.2mm;
  padding: .8mm .8mm;
}
.pf-spacious .pf-signatures {
  padding-right: 5mm;
  padding-left: 5mm;
}
.pf-spacious .pf-declaration .pf-terms {
  margin-top: 1.4mm;
  font-size: 10.5pt;
  line-height: 1.75;
}
.pf-spacious .pf-declaration .pf-terms li {
  margin-bottom: 2mm;
}
.pf-spacious .pf-notice-body {
  font-size: 11.5pt;
  line-height: 1.85;
  margin-top: 2.2mm;
  margin-bottom: 1.2mm;
}
.pf-spacious .pf-notice-body p {
  margin-bottom: 1.6mm;
}
.pf-spacious .pf-release {
  line-height: 1.48;
}
.pf-spacious .pf-disposal-text {
  line-height: 1.48;
  margin-top: 1mm;
  margin-bottom: 1.5mm;
}
.pf-spacious .pf-signatures > div {
  min-height: 8mm;
  padding-top: 1.5mm;
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
