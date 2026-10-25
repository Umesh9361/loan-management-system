import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("loading print uses landscape A4, equal margins and only real summary fields", () => {
  const source = readFileSync("client/src/pages/reports/loading-report.tsx", "utf8");
  assert.match(source, /@page \{ size: A4 landscape; margin: 5mm; \}/);
  assert.match(source, /width: 287mm/);
  assert.match(source, /flex-wrap: wrap/);
  assert.match(source, /इनपुट तपासा: \$\{summary\?\.suspectCount\}/);
  assert.doesNotMatch(source, /summary\?\.safeCount/);
  assert.doesNotMatch(source, /Paper size: A4|Letter नाही|headers\/footers/);
});

for (const report of ["profit-loss", "balance-sheet"]) {
test(`${report} native print and direct A4 PDF do not add asymmetric or viewport padding`, () => {
  const source = readFileSync(`client/src/pages/reports/${report}.tsx`, "utf8");
  assert.match(source, /@page \{ size: A4 portrait; margin: 5mm; \}/);
  assert.match(source, /width: 200mm; margin: 0; padding: 0;/);
  assert.match(source, /format: 'a4'/);
  assert.match(source, /const margin = 5;/);
  assert.doesNotMatch(source, /minHeight|3mm 5mm 3mm 20mm/);
  assert.match(source, /doc\.fonts\.ready/);
  assert.doesNotMatch(source, /Paper size: A4|Letter नाही|headers\/footers/);
});
}
