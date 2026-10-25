import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { getTableConfig } from "drizzle-orm/pg-core";
import { loanPhotos } from "../shared/schema";

// Exercise the real backup/restore methods in an isolated in-memory database.
// Never import the application DB, call live endpoints, or restore customer data.
const source = ts.createSourceFile("data-management.ts",
  readFileSync("server/data-management.ts", "utf8"), ts.ScriptTarget.Latest, true);
const methods = new Map<string, string>();
function collect(node: ts.Node) {
  if (ts.isMethodDeclaration(node) && node.name) methods.set(node.name.getText(source), node.getText(source));
  ts.forEachChild(node, collect);
}
collect(source);
const tableNames = ["companies", "groups", "borrowers", "loans", "transactions", "loanClosures",
  "loanPhotos", "parties", "cashTransactions", "journalEntries", "journalEntryLines",
  "users", "userPermissions", "userActivityLogs", "tenantStorageSettings", "estimateCodes"];
const makeFixture = () => {
  const rows: Record<string, any[]> = Object.fromEntries(tableNames.map(name => [name, []]));
  rows.loans = [{ id: "loan-A", tenantId: "source", accountNumber: "621" }];
  rows.loanPhotos = [
    { id: "item-1", photoType: "collateral" }, { id: "item-2", photoType: "collateral" },
    { id: "person-1", photoType: "borrower" },
  ].map(row => ({ ...row, loanId: "loan-A", tenantId: "source", uploadedBy: "operator-A",
    storageProvider: "local", storagePath: `uploads/photos/${row.id}.png`,
    thumbnailPath: `uploads/photos/${row.id}_thumb.png`, createdAt: "2026-10-25T00:00:00Z" }));
  const tableRefs = Object.fromEntries(tableNames.map(name => [name, { name, tenantId: { table: name, field: "tenantId" } }]));
  const fakeDb: any = {
    select: () => ({ from: (table: any) => ({ where: (predicate: any) => Promise.resolve(
      structuredClone(rows[table.name].filter(row => row[predicate.field] === predicate.value))) }) }),
    delete: (table: any) => ({ where: async (predicate: any) => {
      rows[table.name] = rows[table.name].filter(row => row[predicate.field] !== predicate.value);
    } }),
    insert: (table: any) => ({ values: async (data: any[]) => { rows[table.name].push(...structuredClone(data)); } }),
    execute: async () => {},
  };
  fakeDb.transaction = async (callback: (db: any) => unknown) => callback(fakeDb);
  const code = ts.transpile(`class BackupUnderTest {
    ${["createComprehensiveBackup", "convertDateFields", "restoreFromBackup"].map(name => {
      assert.ok(methods.has(name), `real method exists: ${name}`); return methods.get(name);
    }).join("\n")}
  }; new BackupUnderTest();`, { target: ts.ScriptTarget.ES2022 });
  const service = vm.runInNewContext(code, {
    ...tableRefs, db: fakeDb, crypto: { randomUUID }, console: { log() {}, error() {} },
    eq: (column: any, value: unknown) => ({ field: column.field, value }), sql: () => "",
  });
  return { service, rows };
};

test("existing database photo_type supports borrower without a new table, enum or column", () => {
  const config = getTableConfig(loanPhotos);
  const type = config.columns.find(column => column.name === "photo_type")!;
  assert.equal(config.name, "loan_photos");
  assert.equal(type.getSQLType(), "varchar(20)");
  assert.equal(type.default, "collateral");
  assert.ok(config.columns.find(column => column.name === "loan_id")?.notNull);
});
test("normal backup/restore retains two item photos plus independent borrower metadata", async () => {
  const { service, rows } = makeFixture();
  const backup = await service.createComprehensiveBackup("source");
  assert.equal(backup.success, true, backup.message);
  const saved = JSON.parse(JSON.stringify(backup.backupData));
  assert.deepEqual(saved.data.loanPhotos.map((photo: any) => photo.photoType), ["collateral", "collateral", "borrower"]);
  rows.loanPhotos = [];
  const result = await service.restoreFromBackup("source", saved);
  assert.equal(result.success, true, result.message);
  assert.equal(rows.loanPhotos.length, 3);
  assert.ok(rows.loanPhotos.every(photo => photo.loanId === rows.loans[0].id));
  assert.equal(rows.loanPhotos[2].photoType, "borrower");
  assert.equal(rows.loanPhotos[2].storagePath, "uploads/photos/person-1.png");
});
test("portable restore remaps photo/loan ownership but preserves types and external file references, not image bytes", async () => {
  const { service, rows } = makeFixture();
  const backup = await service.createComprehensiveBackup("source", { portable: true });
  assert.equal(backup.success, true, backup.message);
  const saved = JSON.parse(JSON.stringify(backup.backupData));
  assert.equal(saved.portable, true);
  const oldPhotoId = saved.data.loanPhotos[2].id;
  const result = await service.restoreFromBackup("destination", saved);
  assert.equal(result.success, true, result.message);
  const restored = rows.loanPhotos.filter(row => row.tenantId === "destination");
  const loan = rows.loans.find(row => row.tenantId === "destination");
  assert.equal(restored.length, 3);
  assert.ok(restored.every(photo => photo.loanId === loan.id && photo.loanId !== "loan-A"));
  assert.notEqual(restored[2].id, oldPhotoId);
  assert.equal(restored[2].photoType, "borrower");
  assert.equal(restored[2].storagePath, "uploads/photos/person-1.png", "portable backup does not copy or relocate files");
  assert.ok(!JSON.stringify(saved).includes("data:image/"), "database JSON is metadata, not a photo archive");
});
test("older backups without a photo section still restore and wrong-tenant backups are rejected before deletion", async () => {
  const { service, rows } = makeFixture();
  const backup = await service.createComprehensiveBackup("source");
  const wrong = await service.restoreFromBackup("destination", JSON.parse(JSON.stringify(backup.backupData)));
  assert.equal(wrong.success, false);
  assert.equal(rows.loanPhotos.length, 3);
  const old = JSON.parse(JSON.stringify(backup.backupData));
  delete old.data.loanPhotos;
  assert.equal((await service.restoreFromBackup("source", old)).success, true);
});
