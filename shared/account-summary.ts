import { checkedReportLoans, loanWeightTotals, sumWeightGrams, uniqueLoansById, weightGrams } from './report-weights';
import type { WeightedLoan } from './report-weights';

export type SummaryMode = 'cumulative' | 'period';
export type SummaryView = 'group' | 'customer';
export interface SummaryInterestSettings { allTime: boolean; from: string; to: string }
export function createSummaryInterestSettings(today: string): Record<SummaryView, SummaryInterestSettings> {
  const fy = createSummaryRanges(today).group.period;
  return {
    group: { allTime: false, from: fy.from!, to: fy.to },
    customer: { allTime: false, from: fy.from!, to: fy.to },
  };
}
export interface SummaryRange { from: string | null; to: string }
export type SummaryRanges = Record<SummaryView, Record<SummaryMode, SummaryRange>>;
export interface SummaryRow {
  name: string;
  totalLoans: number; activeLoans: number; closedLoans: number;
  totalWeight: number; totalFineWeight: number;
  goldWeight: number; goldFineWeight: number;
  silverWeight: number; silverFineWeight: number;
  totalAmount: number; closedAmount: number; activeBalance: number; totalInterest: number;
  score?: number;
  rankingInterest?: number;
}
export interface SummaryLoan extends WeightedLoan {
  id: string; loanDate: string; status: string; principalAmount: string | number;
  purity?: string | number | null;
}
export interface SummaryClosure {
  id?: string; tenantId?: string; loanId: string; closureDate: string;
  principalPaid?: string | number | null; principalAmount?: string | number | null;
  interestPaid?: string | number | null; calculatedInterest?: string | number | null;
  interestAmount?: string | number | null;
}

export interface SummaryPosition {
  activeLoans: number;
  activeBalance: number;
  goldWeight: number;
  silverWeight: number;
  totalInterest: number;
}
export interface SummaryYearProgress {
  year: number;
  label: string;
  from: string;
  to: string;
  partial: boolean;
  disbursed: number;
  interest: number;
  loanCount: number;
  previousComparableDisbursed: number | null;
  disbursementChange: number | null;
}
export interface SummaryYearSelection {
  preset: '5' | '10' | 'custom';
  fromYear: number;
  toYear: number;
}
export function createSummaryYearSelections(today: string): Record<SummaryView, SummaryYearSelection> {
  const current = Number(createSummaryRanges(today).group.period.from!.slice(0, 4));
  return {
    group: { preset: '5', fromYear: current - 4, toYear: current },
    customer: { preset: '5', fromYear: current - 4, toYear: current },
  };
}
export function summaryYearRange(selection: SummaryYearSelection, today: string) {
  const current = Number(createSummaryRanges(today).group.period.from!.slice(0, 4));
  const fromYear = selection.preset === 'custom' ? selection.fromYear : current - (selection.preset === '10' ? 9 : 4);
  const toYear = selection.preset === 'custom' ? selection.toYear : current;
  const error = !Number.isInteger(fromYear) || !Number.isInteger(toYear) ||
    fromYear < 1 || toYear > current || fromYear > toYear
    ? 'सुरुवात व शेवटची वैध आर्थिक वर्षे निवडा; शेवटचे वर्ष चालू आर्थिक वर्षापुढे नसावे.' : '';
  return { fromYear, toYear, error };
}

/** Today's stock and received-interest flow are deliberately separate from turnover. */
export function accountSummaryPosition(
  inputLoans: SummaryLoan[], closures: SummaryClosure[], today: string,
  interestRange: { from: string; to: string },
): SummaryPosition {
  const loans = checkedSummaryLoans(inputLoans);
  checkedSummaryClosures(closures);
  const summary = buildAccountSummaryRow('position', loans, closures, 'cumulative',
    firstSummaryLoanDate(loans, today), today, today, interestRange);
  return {
    activeLoans: summary.activeLoans,
    activeBalance: summary.activeBalance,
    goldWeight: summary.goldWeight,
    silverWeight: summary.silverWeight,
    totalInterest: summary.totalInterest,
  };
}

/** Recorded FY activity, with like-for-like elapsed-period comparison for this FY. */
export function accountSummaryYearlyProgress(
  inputLoans: SummaryLoan[], closures: SummaryClosure[], today: string,
  range?: { fromYear: number; toYear: number },
): SummaryYearProgress[] {
  if (!validSummaryDate(today)) throw new Error('आजची तारीख अवैध आहे.');
  const selected = summaryYearRange(range
    ? { preset: 'custom', ...range }
    : createSummaryYearSelections(today).group, today);
  if (selected.error) throw new Error(selected.error);
  const loans = checkedSummaryLoans(inputLoans).filter(loan => loan.loanDate <= today);
  const ids = new Set(loans.map(loan => loan.id));
  const events = checkedSummaryClosures(closures).filter(event =>
    ids.has(event.loanId) && event.closureDate <= today);
  if (!loans.length) return [];
  const financialYear = (date: string) => Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 4 ? 1 : 0);
  const current = financialYear(today);
  const first = events.reduce((year, event) => Math.min(year, financialYear(event.closureDate)),
    loans.reduce((year, loan) => Math.min(year, financialYear(loan.loanDate)), current));
  const rows: SummaryYearProgress[] = [];
  const fyDate = (year: number, suffix: string) => `${String(year).padStart(4, '0')}${suffix}`;
  // Same calendar cutoff in the previous year; clamp 29 February to 28 February.
  let previousCutoff = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  if (!validSummaryDate(previousCutoff)) previousCutoff = `${Number(today.slice(0, 4)) - 1}-02-28`;
  for (let year = Math.max(first, selected.fromYear); year <= selected.toYear; year++) {
    const from = fyDate(year, '-04-01');
    const yearEnd = fyDate(year + 1, '-03-31');
    const to = year === current ? today : yearEnd;
    const summary = buildAccountSummaryRow('year', loans, events, 'period', from, to, today);
    // The baseline may be outside the visible window; never compare the
    // first displayed year with zero merely because the prior row is hidden.
    const previousComparableDisbursed = first < year
      ? buildAccountSummaryRow('previous comparable', loans, events, 'period',
        fyDate(year - 1, '-04-01'),
        year === current && to < yearEnd ? previousCutoff : fyDate(year, '-03-31'), today).totalAmount
      : null;
    rows.push({
      year, label: `${year}–${String(year + 1).slice(-2)}`, from, to,
      partial: to < yearEnd, disbursed: summary.totalAmount, interest: summary.totalInterest,
      loanCount: summary.totalLoans, previousComparableDisbursed,
      disbursementChange: previousComparableDisbursed !== null && previousComparableDisbursed > 0
        ? ((summary.totalAmount - previousComparableDisbursed) / previousComparableDisbursed) * 100
        : null,
    });
  }
  return rows;
}

export function localISODate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function validSummaryDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function summaryRangeError(from: string | null, to: string) {
  if (!validSummaryDate(from) || !validSummaryDate(to)) return 'कृपया सुरुवात व शेवटच्या वैध तारखा निवडा.';
  if (from > to) return 'सुरुवातीची तारीख शेवटच्या तारखेनंतर असू शकत नाही.';
  return '';
}
export function createSummaryRanges(today: string): SummaryRanges {
  const year = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 4 ? 1 : 0);
  const forView = () => ({
    cumulative: { from: null, to: today },
    period: { from: `${year}-04-01`, to: `${year + 1}-03-31` },
  });
  return { group: forView(), customer: forView() };
}
export function initializeSummaryRanges(state: SummaryRanges, firstLoanDate: string): SummaryRanges {
  if (state.group.cumulative.from !== null && state.customer.cumulative.from !== null) return state;
  const initialize = (view: SummaryView) => state[view].cumulative.from !== null ? state[view] : {
    ...state[view], cumulative: { ...state[view].cumulative, from: firstLoanDate },
  };
  return { group: initialize('group'), customer: initialize('customer') };
}
export function updateSummaryRange(state: SummaryRanges, view: SummaryView, mode: SummaryMode, field: 'from' | 'to', value: string): SummaryRanges {
  return { ...state, [view]: { ...state[view], [mode]: { ...state[view][mode], [field]: value } } };
}
export function firstSummaryLoanDate(loans: { loanDate: string }[], today: string) {
  return loans.reduce((first, loan) =>
    validSummaryDate(loan.loanDate) && loan.loanDate < first ? loan.loanDate : first, today);
}
export function summaryDataState(queries: { isSuccess: boolean; isFetching: boolean; isError: boolean }[]) {
  if (queries.some(query => query.isError)) return 'error';
  if (queries.some(query => !query.isSuccess || query.isFetching)) return 'loading';
  return 'ready';
}

export function summaryArray<T>(data: T[]): T[] {
  if (!Array.isArray(data)) throw new Error('रिपोर्टचा डेटा अपूर्ण किंवा अवैध आहे.');
  return data;
}
function validMoney(value: unknown) {
  return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
}
export function checkedSummaryLoans<T extends SummaryLoan>(data: T[]): T[] {
  const loans = checkedReportLoans(summaryArray(data));
  for (const loan of loans) {
    if (!validSummaryDate(loan.loanDate) || !validMoney(loan.principalAmount)) {
      throw new Error(`खाते ${loan.id}: कर्जाची तारीख किंवा मुद्दल अवैध आहे.`);
    }
  }
  return loans;
}
export function checkedSummaryClosures<T extends SummaryClosure>(data: T[]): T[] {
  for (const closure of summaryArray(data)) {
    if (!validSummaryDate(closure.closureDate) ||
        !validMoney(closure.principalPaid ?? closure.principalAmount ?? 0) ||
        !validMoney(closure.interestPaid ?? closure.calculatedInterest ?? closure.interestAmount ?? 0)) {
      throw new Error(`बंद खाते ${closure.loanId}: तारीख किंवा मिळालेली रक्कम अवैध आहे.`);
    }
  }
  return data;
}

export function buildAccountSummaryRow(name: string, inputLoans: SummaryLoan[], closures: SummaryClosure[], mode: SummaryMode, from: string, to: string, today: string, interestRange?: { from: string; to: string }): SummaryRow {
  if (summaryRangeError(from, to)) throw new Error(summaryRangeError(from, to));
  if (mode === 'cumulative' && interestRange && summaryRangeError(interestRange.from, interestRange.to)) {
    throw new Error(summaryRangeError(interestRange.from, interestRange.to));
  }
  const entityLoans = uniqueLoansById(inputLoans);
  const loanIds = new Set(entityLoans.map(loan => loan.id));
  const seenClosures = new Set<string>();
  const entityClosures = closures.filter(closure => {
    if (!loanIds.has(closure.loanId)) return false;
    // Repeated payload records count once; different closure IDs retain existing event semantics.
    if (!closure.id) return true;
    const key = JSON.stringify([closure.tenantId, closure.id]);
    if (seenClosures.has(key)) return false;
    seenClosures.add(key);
    return true;
  });
  const inRangeClosures = entityClosures.filter(closure => closure.closureDate >= from && closure.closureDate <= to);
  const interestClosures = mode === 'cumulative' && interestRange
    ? entityClosures.filter(closure => closure.closureDate >= interestRange.from &&
      closure.closureDate <= interestRange.to && closure.closureDate <= today)
    : inRangeClosures;
  const rowLoans = entityLoans.filter(loan => loan.loanDate >= from && loan.loanDate <= to);
  const active = (mode === 'cumulative' ? entityLoans : rowLoans)
    .filter(loan => loan.status === 'active' && loan.loanDate <= today);
  const sumPrincipal = (loans: SummaryLoan[]) => loans.reduce((sum, loan) => sum + Number(loan.principalAmount || 0), 0);
  const fine = (loans: SummaryLoan[]) => loans.reduce((sum, loan) =>
    sum + weightGrams(loan.weight) * (parseFloat(String(loan.purity || '82')) || 82) / 100, 0);
  // Weight is the current pledged stock, not lifetime turnover. Use the same
  // active set as the balance in both the overview and every summary row.
  const gold = active.filter(loan => loan.metalType !== 'silver' && loan.loanType !== 'विनातारण');
  const silver = active.filter(loan => loan.metalType === 'silver');
  return {
    name, totalLoans: rowLoans.length, activeLoans: active.length,
    closedLoans: new Set(inRangeClosures.map(closure => closure.loanId)).size,
    ...loanWeightTotals(active), totalFineWeight: fine(active),
    goldFineWeight: fine(gold), silverFineWeight: fine(silver),
    totalAmount: sumPrincipal(rowLoans), activeBalance: sumPrincipal(active),
    closedAmount: inRangeClosures.reduce((sum, closure) => sum + Number(closure.principalPaid ?? closure.principalAmount ?? 0), 0),
    totalInterest: interestClosures.reduce((sum, closure) => sum + Number(closure.interestPaid ?? closure.calculatedInterest ?? closure.interestAmount ?? 0), 0),
    // Keep the top-50 membership stable when only the displayed interest scope changes.
    rankingInterest: inRangeClosures.reduce((sum, closure) => sum + Number(closure.interestPaid ?? closure.calculatedInterest ?? closure.interestAmount ?? 0), 0),
  };
}

export function rankAccountSummaryCustomers(rows: SummaryRow[]) {
  const maxTransactions = Math.max(1, ...rows.map(row => row.totalLoans + row.closedLoans));
  const maxTurnover = Math.max(1, ...rows.map(row => row.totalAmount + row.closedAmount));
  const maxInterest = Math.max(1, ...rows.map(row => row.rankingInterest ?? row.totalInterest));
  return rows.map(row => ({
    ...row,
    score: ((row.totalLoans + row.closedLoans) / maxTransactions) * 40 +
      ((row.totalAmount + row.closedAmount) / maxTurnover) * 30 +
      ((row.rankingInterest ?? row.totalInterest) / maxInterest) * 20 +
      (row.totalLoans > 0 ? (row.closedLoans / row.totalLoans) * 10 : 0),
  })).sort((a, b) => b.score - a.score).slice(0, 50);
}

export function accountSummaryTotals(rows: SummaryRow[]) {
  const keys = ['totalLoans', 'activeLoans', 'closedLoans', 'totalWeight', 'totalFineWeight', 'goldWeight', 'goldFineWeight', 'silverWeight', 'silverFineWeight', 'totalAmount', 'closedAmount', 'activeBalance', 'totalInterest'] as const;
  const totals = Object.fromEntries(keys.map(key => [key, rows.reduce((sum, row) => sum + row[key], 0)])) as Omit<SummaryRow, 'name' | 'score'>;
  for (const key of ['totalWeight', 'goldWeight', 'silverWeight'] as const) {
    totals[key] = sumWeightGrams(rows.map(row => row[key]));
  }
  return totals;
}

export function accountSummaryContext(mode: SummaryMode, from: string, to: string, scope: string, interest?: SummaryInterestSettings) {
  const modeLabel = mode === 'cumulative' ? 'एकूण हिशोब' : 'कालावधी हिशोब';
  const dateLabel = (value: string) => validSummaryDate(value) ? value.split('-').reverse().join('/') : '—';
  const interestText = mode === 'cumulative' && interest
    ? `मिळालेले व्याज: ${interest.allTime ? 'सुरुवातीपासून आजपर्यंतचे सर्व' : 'निवडलेल्या आर्थिक वर्षातील / कालावधीतील'} (${dateLabel(interest.from)} ते ${dateLabel(interest.to)}); आजनंतरचे व्यवहार वगळले आहेत.`
    : '';
  const balanceNote = mode === 'cumulative'
    ? `सक्रिय खाती व शिल्लक: आजची सर्व चालू कर्जे. ${interestText ? 'वाटप व बंद' : 'वाटप, बंद व व्याज'}: दाखवलेल्या तारखांतील.`
    : 'वाटप: या काळात दिलेली कर्जे. बंद व व्याज: या काळातील बंद व्यवहार, पूर्वी दिलेल्या कर्जांसह. सक्रिय/शिल्लक: या काळात दिलेली व आजही चालू कर्जे; कालावधीअखेरची शिल्लक नव्हे.';
  return { modeLabel, from, to, scope, interestText, balanceNote: `${balanceNote}${interestText ? ` ${interestText}` : ''}`, periodText: `${modeLabel} | ${dateLabel(from)} ते ${dateLabel(to)} | ${scope}${interestText ? ` | ${interestText}` : ''}` };
}

type ExportRow = Pick<SummaryRow, 'totalLoans' | 'activeLoans' | 'closedLoans' | 'totalAmount' | 'closedAmount' | 'activeBalance' | 'totalInterest'> & {
  accountName?: string; groupName?: string; name?: string;
};
export function accountSummaryExcelRows(rows: ExportRow[], context: ReturnType<typeof accountSummaryContext>) {
  const values = (row: ExportRow) => [row.totalLoans, row.activeLoans, row.closedLoans, row.totalAmount, row.closedAmount, row.activeBalance, row.totalInterest];
  const total = (key: keyof Pick<ExportRow, 'totalLoans' | 'activeLoans' | 'closedLoans' | 'totalAmount' | 'closedAmount' | 'activeBalance' | 'totalInterest'>) => rows.reduce((sum, row) => sum + row[key], 0);
  return [
    ['खाते सारांश अहवाल', context.modeLabel],
    ['सुरुवात', context.from, 'शेवट', context.to],
    ['व्याप्ती', context.scope],
    ['गणनेचा आधार', context.balanceNote],
    ...(context.interestText ? [['व्याजाचा स्वतंत्र कालावधी', context.interestText]] : []),
    [],
    ['अ.क्र.', 'गट / कर्जदार नाव', 'एकूण कर्जे', 'सक्रिय खाती (आज)', 'बंद खाती', 'वाटप मुद्दल (₹)', 'बंद खात्यांतून मुद्दल (₹)', 'सक्रिय मुद्दल (आज) (₹)', 'मिळालेले व्याज (₹)'],
    ...rows.map((row, index) => [index + 1, row.accountName || row.groupName || row.name || '', ...values(row)]),
    ['', 'दर्शवलेल्या ओळींची एकूण टोटल', ...(['totalLoans', 'activeLoans', 'closedLoans', 'totalAmount', 'closedAmount', 'activeBalance', 'totalInterest'] as const).map(total)],
  ];
}

export function escapeSummaryHtml(value: unknown) {
  return String(value).replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}
export function accountSummaryPrintRows(rows: SummaryRow[], totals: ReturnType<typeof accountSummaryTotals>, showRank: boolean) {
  const cells = (row: typeof totals) => [
    row.totalLoans, row.activeLoans, row.closedLoans,
    ...[row.totalAmount, row.closedAmount, row.activeBalance, row.totalInterest].map(value =>
      `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`),
  ].map(value => `<td>${value}</td>`).join('');
  return rows.map((row, index) => `<tr>${showRank ? `<td>${index + 1}</td>` : ''}<td style="text-align:left">${escapeSummaryHtml(row.name)}</td>${cells(row)}</tr>`).join('') +
    `<tr class="total-row">${showRank ? '<td>—</td>' : ''}<td style="text-align:left">दर्शवलेल्या ओळींची एकूण टोटल</td>${cells(totals)}</tr>`;
}
