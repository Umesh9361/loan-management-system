// Presentation-only formatting, scoped to the account summary report.
const currency = new Intl.NumberFormat('en-IN-u-nu-latn', {
  style: 'currency', currency: 'INR',
  minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const count = new Intl.NumberFormat('en-IN-u-nu-latn', {
  maximumFractionDigits: 0,
});

export function formatSummaryCurrency(value: number): string {
  return currency.format(Number.isFinite(value) ? value : 0);
}

export function formatSummaryCount(value: number): string {
  return count.format(Number.isFinite(value) ? value : 0);
}

export function englishSummaryDigits(text: string): string {
  return text.replace(/[०-९]/g, digit => String(digit.charCodeAt(0) - 0x0966));
}

export function formatSummaryDate(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '—';
}
