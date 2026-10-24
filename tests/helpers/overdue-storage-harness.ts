import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { and, desc, eq, getTableColumns, gte, lte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { groups, loanClosures, loans } from '../../shared/schema';
import { reportLoanWeight } from '../../shared/report-weights';

type Row = Record<string, any>;

// Load the actual storage methods without importing server/db or connecting to
// any database. Real Drizzle query generation runs against a synthetic client.
export function overdueHarness(
  inputLoans: Row[], inputClosures: Row[] = [],
  source = readFileSync('server/storage.ts', 'utf8'),
) {
  function section(start: string, end: string) {
    const a = source.indexOf(start), b = source.indexOf(end, a);
    assert(a >= 0 && b > a, 'Storage method boundaries must still exist');
    return source.slice(a, b);
  }
  const methods = section('  async getLoanClosures(', '  async deleteLoanClosure(')
    + section('  // Helper function to calculate time period', '  async deleteTenantData(');
  const queries: { sql: string; params: any[] }[] = [];
  const logs: any[][] = [];
  const errors: any[][] = [];
  let failure: Error | undefined;
  const loanColumns = getTableColumns(loans);
  const closureColumns = getTableColumns(loanClosures);
  function property(column: string, closures: boolean) {
    const entry = Object.entries(closures ? closureColumns : loanColumns)
      .find(([, definition]) => definition.name === column);
    assert(entry, `Unknown fixture column: ${column}`);
    return entry[0];
  }
  const client = {
    async query(config: { text: string }, params: any[]) {
      const sql = config.text;
      queries.push({ sql, params });
      if (failure) throw failure;
      const closures = sql.includes('from "loan_closures"');
      assert(closures || sql.includes('from "loans"'), 'Unexpected fixture query');
      const filters = [...sql.matchAll(/"(?:loans|loan_closures)"\."(\w+)" (=|>=|<=) \$(\d+)/g)];
      let rows = (closures ? inputClosures : inputLoans).filter(row =>
        filters.every(([, column, op, index]) => {
          const actual = row[property(column, closures)], expected = params[Number(index) - 1];
          return op === '=' ? actual === expected : op === '>=' ? actual >= expected : actual <= expected;
        }));
      rows = rows.slice().sort((a, b) => closures
        ? b.closureDate.localeCompare(a.closureDate)
        : a.loanDate.localeCompare(b.loanDate));
      const columns = sql.slice(0, sql.indexOf(' from '));
      const selected = closures
        ? Object.keys(closureColumns)
        : [...columns.matchAll(/"(loans|groups)"\."(\w+)"/g)]
          .map(([, table, name]) => table === 'groups' ? 'groupName' : property(name, false));
      return { rows: rows.map(row => selected.map(key => row[key] ?? null)) };
    },
  };
  const db = drizzle({ client: client as any });
  // Fix both today's date and calendar construction in UTC, independent of CI TZ.
  class FixedDate extends Date {
    constructor(...args: any[]) {
      if (args.length === 0) super('2026-10-24T12:00:00Z');
      else if (args.length === 1) super(args[0]);
      else super(Date.UTC(...args as [number, number, ...number[]]));
    }
    getFullYear() { return this.getUTCFullYear(); }
    getMonth() { return this.getUTCMonth(); }
    getDate() { return this.getUTCDate(); }
  }
  const compiled = ts.transpileModule(`class ReportStorage { ${methods} }`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const storage = new Function(
    'db', 'loans', 'groups', 'loanClosures', 'eq', 'and', 'gte', 'lte', 'desc',
    'reportLoanWeight', 'Date', 'console',
    `${compiled}; return new ReportStorage();`,
  )(db, loans, groups, loanClosures, eq, and, gte, lte, desc, reportLoanWeight, FixedDate, {
    log: (...args: any[]) => logs.push(args),
    error: (...args: any[]) => errors.push(args),
  });
  return {
    storage, queries, logs, errors,
    failWith(error: Error) { failure = error; },
  };
}

export const defaultFilters = {
  dateFrom: '', dateTo: '', groupId: 'all',
  currentGoldRate: 7500, currentSilverRate: 95,
  finePurityPercentage: 82, monthlyInterestRate: 2,
  purityMode: 'loan-wise', interestRateMode: 'manual',
  projectionMode: 'current', futureProjectionPeriod: '3months',
};

export function fixtureLoan(id: string, overrides: Row = {}): Row {
  return {
    id, tenantId: 'tenant-A', groupId: 'group-A', groupName: 'Fixture group',
    accountNumber: id, borrowerName: 'Fixture borrower', borrowerMobile: null,
    loanDate: '2015-01-31', principalAmount: '10000.00', interestRate: '1.75',
    interestRateType: 'monthly', collateralDetails: 'पाटली',
    weight: '4.900', purity: '82.00', status: 'active', loanType: 'तारण',
    metalType: 'gold', specialConditions: '—', documentDetails: '—', otherInfo: '—',
    ...overrides,
  };
}

export const fixtureLoans = [
  fixtureLoan('gold'),
  fixtureLoan('silver', { metalType: 'silver', weight: '22.123', purity: '60',
    principalAmount: '2000.00', interestRateType: 'yearly', interestRate: '18',
    loanDate: '2024-02-29', collateralDetails: 'चांदी', groupId: 'group-B' }),
  fixtureLoan('unsecured', { loanType: 'विनातारण', weight: 'invalid',
    specialConditions: 'Fixture condition', documentDetails: 'Fixture document',
    loanDate: '2026-10-01', borrowerMobile: '0000000000' }),
  fixtureLoan('fine', { purity: null, collateralDetails: 'gold coin', weight: '1.111',
    loanDate: '2025-10-24', principalAmount: '5000', interestRate: '0' }),
  fixtureLoan('vedan', { purity: '0', collateralDetails: 'वेडण', weight: '2.222',
    loanDate: '2026-10-24', principalAmount: '100.50' }),
  fixtureLoan('default-purity', { purity: null, collateralDetails: null, weight: '0.001',
    loanDate: '2026-01-31', principalAmount: '0.00', borrowerName: 'Other fixture' }),
  fixtureLoan('closed', { status: 'closed' }),
  fixtureLoan('foreign', { tenantId: 'tenant-B', borrowerName: 'Foreign fixture' }),
];

export const fixtureClosures = [
  { id: 'payment-1', tenantId: 'tenant-A', loanId: 'gold', closureDate: '2026-01-01', totalAmount: '0.10' },
  { id: 'payment-2', tenantId: 'tenant-A', loanId: 'gold', closureDate: '2026-05-01', totalAmount: '0.20' },
  { id: 'payment-3', tenantId: 'tenant-A', loanId: 'gold', closureDate: '2026-02-01', totalAmount: '1250.35' },
  { id: 'payment-4', tenantId: 'tenant-A', loanId: 'silver', closureDate: '2026-03-15', totalAmount: '500.00' },
  { id: 'payment-5', tenantId: 'tenant-A', loanId: 'fine', closureDate: '2026-05-01', totalAmount: '5000.00' },
  { id: 'foreign-payment', tenantId: 'tenant-B', loanId: 'gold', closureDate: '2026-06-01', totalAmount: '999999.99' },
  { id: 'closed-payment', tenantId: 'tenant-A', loanId: 'closed', closureDate: '2026-04-01', totalAmount: '10000.00' },
];
