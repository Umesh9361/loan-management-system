export class WeightFormatError extends Error {}

/** Parse one explicit gram value, never concatenate numeric fragments in free text. */
export function weightGrams(value: unknown): number {
  if (typeof value === 'number') {
    if (Number.isFinite(value) && value >= 0) return value;
    throw new WeightFormatError('वजन शून्य किंवा धन संख्या असणे आवश्यक आहे.');
  }
  let text = String(value ?? '').trim()
    .replace(/[०-९]/g, digit => String('०१२३४५६७८९'.indexOf(digit)));
  if (!text || /^(?:—|–|-)$/.test(text)) return 0;
  const unit = '(?:grams?|gms?|g|ग्रॅम|ग्राम|ग्रा\\.?|ग्रॅ\\.?)';
  text = text.replace(new RegExp(`^${unit}\\s*`, 'i'), '')
    .replace(new RegExp(`\\s*${unit}$`, 'i'), '').trim();
  // Grouped thousands with a decimal point are unambiguous. A lone comma
  // (e.g. 4,450) could mean 4.450 or 4450; do not guess the stored unit.
  if (/^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})\.\d+$/.test(text)) {
    text = text.replace(/,/g, '');
  }
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    throw new WeightFormatError('वजन अस्पष्ट आहे. ग्रॅममध्ये दशांश बिंदूसह एकच संख्या लिहा (उदा. 4.450).');
  }
  const weight = Number(text);
  if (!Number.isFinite(weight)) throw new WeightFormatError('वजनाची संख्या अवैध आहे.');
  return weight;
}

/** Add decimal representations exactly; binary float noise must not alter rounding. */
export function sumWeightGrams(values: unknown[]): number {
  let total = BigInt(0), scale = 0;
  const shift = (value: bigint, places: number) => {
    for (let i = 0; i < places; i++) value *= BigInt(10);
    return value;
  };
  for (const value of values) {
    const [coefficient, exponent = '0'] = weightGrams(value).toString().split('e');
    const [whole, fraction = ''] = coefficient.split('.');
    let units = BigInt(whole + fraction);
    let places = fraction.length - Number(exponent);
    if (places < 0) {
      units = shift(units, -places);
      places = 0;
    }
    if (places > scale) {
      total = shift(total, places - scale);
      scale = places;
    }
    total += shift(units, scale - places);
  }
  const digits = total.toString().padStart(scale + 1, '0');
  const result = Number(scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits);
  if (!Number.isFinite(result)) throw new WeightFormatError('एकूण वजनाची संख्या खूप मोठी आहे.');
  return result;
}

const weightFormatter = new Intl.NumberFormat('en-US', {
  useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function formatWeight(weight: number): string {
  return weightFormatter.format(weight);
}

export interface WeightedLoan {
  id?: string | number;
  tenantId?: string;
  weight?: unknown;
  metalType?: string;
  loanType?: string;
}

/** A loan is one report entry even if an older cached join repeated its ID. */
export function uniqueLoansById<T extends WeightedLoan>(loans: T[]): T[] {
  const seen = new Set<string>();
  return loans.filter(loan => {
    if (!loan.id) return true;
    const key = JSON.stringify([loan.tenantId, loan.id]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Keep invalid records visible as an error, not a plausible but incorrect total. */
export function reportLoanWeight(loan: WeightedLoan & { accountNumber?: string }): number {
  try {
    return weightGrams(loan.weight);
  } catch (error) {
    throw new WeightFormatError(
      `खाते ${loan.accountNumber || loan.id || '—'}: वजन "${String(loan.weight)}". ${
        error instanceof Error ? error.message : 'वजन तपासा.'
      } अचूक टोटलसाठी या कर्जाचे वजन संपादित करा.`
    );
  }
}

export function checkedReportLoans<T extends WeightedLoan & { accountNumber?: string }>(loans: T[]): T[] {
  const entries = uniqueLoansById(loans);
  for (const loan of entries) reportLoanWeight(loan);
  return entries;
}

export function loanWeightTotals(loans: WeightedLoan[]) {
  const entries = uniqueLoansById(loans);
  return {
    totalWeight: sumWeightGrams(entries.map(loan => loan.weight)),
    goldWeight: sumWeightGrams(entries.filter(loan =>
      loan.metalType !== 'silver' && loan.loanType !== 'विनातारण'
    ).map(loan => loan.weight)),
    // Preserve the existing silver classification used by both reports.
    silverWeight: sumWeightGrams(entries.filter(loan =>
      loan.metalType === 'silver'
    ).map(loan => loan.weight)),
  };
}

/** Use the same identity as customer-summary matching (trim + case-insensitive). */
export function uniqueBorrowerNames(loans: { borrowerName?: string }[]): string[] {
  const names = new Map<string, string>();
  for (const loan of loans) {
    const name = (loan.borrowerName || '').trim();
    if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  return Array.from(names.values());
}
