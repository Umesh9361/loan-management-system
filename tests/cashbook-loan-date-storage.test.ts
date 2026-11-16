import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { and, asc, eq, getTableColumns, gte, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { cashTransactions, loans, parties } from "../shared/schema";
import { cashbookLoanLink } from "../server/cashbook-loan-link";

// Executes the actual read methods and real Drizzle SQL generation. No server
// import, live database, financial writes, or authentication bypass is involved.
function harness() {
  const source = readFileSync("server/storage.ts", "utf8");
  const section = (start: string, end: string) => {
    const a = source.indexOf(start), b = source.indexOf(end, a);
    assert(a >= 0 && b > a);
    return source.slice(a, b);
  };
  const methods = section("  async getCashBookReport(", "  async getCapitalAccountReport(") +
    section("  async getCashTransactions(", "  async getMobileCashbookDailyBalance(");
  const fixtures = [
    { id: "known", tenantId: "tenant-A", loanId: "loan-A", category: "loan_repayment" },
    { id: "foreign-link", tenantId: "tenant-A", loanId: "loan-B", category: "loan_repayment" },
    { id: "invalid-link", tenantId: "tenant-A", loanId: "not-a-uuid", category: "loan_closure" },
    { id: "legacy", tenantId: "tenant-A", loanId: null, category: "loan_repayment" },
    { id: "manual", tenantId: "tenant-A", loanId: null, category: "income" },
    { id: "foreign-row", tenantId: "tenant-B", loanId: "loan-B", category: "loan_repayment" },
  ].map(row => ({
    transactionDate: "2026-11-09", transactionType: "cash_in", amount: "11200.50",
    narration: "कर्ज बंद - खाते क्र. 621 नमुना - मुद्दल: ₹10000 + व्याज: ₹1200.50",
    isSystemGenerated: row.id !== "manual", ...row,
  }));
  const loanRows = [
    { id: "loan-A", tenantId: "tenant-A", loanDate: "2019-06-15", accountNumber: "621" },
    { id: "loan-B", tenantId: "tenant-B", loanDate: "2025-01-01", accountNumber: "621" },
  ];
  const queries: string[] = [];
  const cashColumns = getTableColumns(cashTransactions);
  const property = (name: string) => Object.entries(cashColumns).find(([, col]) => col.name === name)?.[0];
  const db = drizzle({ client: { async query(config: { text: string }, params: any[]) {
    const text = config.text;
    queries.push(text);
    assert.match(text, /^select /i, "read-only operation");
    assert.match(text, /left join "loans" on \("cash_transactions"\."loan_id" = "loans"\."id"::text and "cash_transactions"\."tenant_id" = "loans"\."tenant_id"\)/);
    assert(!text.includes('"loan_id"::uuid'), "malformed historical links must not abort the list");
    assert(!/where.*"loans"\."loan_date"/s.test(text), "original date must not filter cash transactions");
    const tenantParam = text.match(/where.*?"cash_transactions"\."tenant_id" = \$(\d+)/s);
    assert(tenantParam, "cash tenant filter retained");
    const tenant = params[Number(tenantParam[1]) - 1];
    const projection = text.slice(0, text.indexOf(" from "));
    const columns = [...projection.split("CASE WHEN")[0].matchAll(/"(cash_transactions|loans|parties)"\."(\w+)"/g)];
    const rows = fixtures.filter(row => row.tenantId === tenant).map(row => {
      const loan = loanRows.find(loan => loan.id === row.loanId && loan.tenantId === row.tenantId);
      const selected = columns.map(([, table, column]) => table === "loans"
        ? loan?.loanDate ?? null : table === "parties" ? null : (row as any)[property(column)!] ?? null);
      if (projection.includes("CASE WHEN")) selected.push(null);
      return selected;
    });
    return { rows };
  } } as any });
  const compiled = ts.transpileModule(`class ReadStorage {${methods}}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const storage = new Function(
    "db", "cashTransactions", "loans", "parties", "cashbookLoanLink",
    "eq", "and", "or", "asc", "gte", "lte", "sql", "console",
    `${compiled}; return new ReadStorage()`,
  )(db, cashTransactions, loans, parties, cashbookLoanLink, eq, and, or, asc, gte, lte, sql, { log() {}, error() {} });
  return { storage, queries, fixtures };
}

test("actual cash read adds tenant-safe metadata, retaining old/missing/invalid links and money", async () => {
  const { storage, queries, fixtures } = harness();
  const filters = { dateFrom: "2026-11-01", dateTo: "2026-11-30" };
  const rows = await storage.getCashTransactions("tenant-A", filters);
  assert.deepEqual(rows.map((row: any) => row.id), ["known", "foreign-link", "invalid-link", "legacy", "manual"]);
  assert.equal(rows[0].loanDate, "2019-06-15", "loan date outside the report period is still available");
  for (const row of rows.slice(1)) assert.equal(row.loanDate, null);
  for (const row of rows) {
    const original = fixtures.find(fixture => fixture.id === row.id)!;
    for (const key of ["id", "tenantId", "loanId", "narration", "amount", "category", "transactionDate", "transactionType"]) {
      assert.equal(row[key], (original as any)[key], key);
    }
  }
  assert.equal(rows.reduce((sum: number, row: any) => sum + Number(row.amount), 0), 56002.5);
  assert.deepEqual(await storage.getCashTransactions("tenant-A", filters), rows, "refresh does not rebook or duplicate");
  assert.equal(queries.length, 2, "one read per list, no per-row queries");
});

test("standalone cashbook report uses the same safe metadata without removing original rows", async () => {
  const { storage, queries } = harness();
  const rows = await storage.getCashBookReport("tenant-A", "2026-11-01", "2026-11-30");
  assert.equal(rows.length, 5);
  assert.equal(rows[0].loanDate, "2019-06-15");
  assert.equal(queries.length, 1);
});
