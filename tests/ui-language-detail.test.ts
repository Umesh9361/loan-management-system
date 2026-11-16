import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import catalog from "../shared/ui-catalog.en.json";
import { setUiLanguage, uiText, uiMonthLabel, uiTemplate } from "../shared/ui-language";
import { localizeUiSource } from "../scripts/ui-localization";
import { overdueDurationParts } from "../client/src/lib/overdue-duration";
import { pledgeCollateralPhotoLabels } from "../client/src/lib/pledge-loan-photos";

function formatter(file: string, name: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) expression = node.initializer!.getText(tree);
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = node.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert(expression, name);
  const js = ts.transpileModule(`const result = (${expression});`, { compilerOptions: {target: ts.ScriptTarget.ES2020} }).outputText;
  return new Function(...Object.keys(dependencies), `${js}; return result;`)(...Object.values(dependencies)) as (value: number) => string;
}

test("dashboard and both summary axes translate units without changing numbers", () => {
  const deps = {uiText, finite: (n: number) => n, englishSummaryDigits: (n: string) => n, formatCount: (n: number) => n.toLocaleString("en-IN")};
  const dashboard = formatter("client/src/pages/dashboard.tsx", "formatCompact", deps);
  const screen = formatter("client/src/components/reports/account-summary-overview.tsx", "compactCurrency", deps);
  const print = formatter("client/src/lib/account-summary-print-overview.ts", "compactCurrency", deps);
  try {
    setUiLanguage("en");
    assert.equal(dashboard(4500000), "45.0 Lakh");
    assert.equal(dashboard(-580000), "-5.8 Lakh");
    assert.equal(dashboard(1230), "1.2 K");
    assert.equal(dashboard(10000000), "1.0 Cr");
    for (const fn of [screen, print]) {
      assert.equal(fn(4500000), "₹45 Lakh");
      assert.equal(fn(10000000), "₹1 Cr");
      assert.equal(fn(1200), "₹1.2 K");
      assert.equal(fn(0), "₹0");
    }
    setUiLanguage("mr");
    assert.equal(dashboard(4500000), "45.0 लाख");
    assert.equal(screen(4500000), "₹45 लाख");
    assert.equal(print(1200), "₹1.2 ह.");
  } finally { setUiLanguage("mr"); }
});

test("calendar duration and numbered photo labels follow language, not stored photo values", () => {
  const photos = [{id:"a",photoType:"collateral"},{id:"b",photoType:"collateral"},{id:"c",photoType:"borrower"}];
  const before = structuredClone(photos);
  try {
    for (const daysOverdue of [0, 30, 365, 470]) {
      setUiLanguage("mr");
      const marathi = overdueDurationParts({loanDate:"2024-01-15", daysOverdue});
      setUiLanguage("en");
      const english = overdueDurationParts({loanDate:"2024-01-15", daysOverdue});
      assert(!/[\u0900-\u097f]/.test(english.join(" ")));
      assert.deepEqual(english.join(" ").match(/\d+/g), marathi.join(" ").match(/\d+/g));
    }
    assert.deepEqual(pledgeCollateralPhotoLabels(photos), ["Item photo 1", "Item photo 2"]);
    assert.deepEqual(photos, before);
    setUiLanguage("mr");
    assert.deepEqual(pledgeCollateralPhotoLabels(photos), ["वस्तूचा फोटो 1", "वस्तूचा फोटो 2"]);
  } finally { setUiLanguage("mr"); }
});

test("validation and displayed API messages localize but request messages stay canonical", () => {
  const source = `const schema=z.string().refine(valid,{message:"पासवर्ड जुळत नाहीत"});
    ctx.addIssue({code:"custom",message:"पासवर्ड जुळत नाही"});
    toast({title:"त्रुटी",description:error.message});
    const request={message:"ग्राहक",borrowerName:customer.name};
    const option=<SelectItem value="cash" textValue="रोकड खाते">रोकड खाते</SelectItem>;`;
  const transformed = localizeUiSource(source, "/app/client/src/pages/example.tsx");
  assert(transformed.includes('__uiText("पासवर्ड जुळत नाहीत")'));
  assert(transformed.includes('__uiText("पासवर्ड जुळत नाही")'));
  assert(transformed.includes("__uiMessage(error.message)"));
  assert(transformed.includes('message:"ग्राहक",borrowerName:customer.name'));
  assert(transformed.includes('value="cash"'));
  assert(transformed.includes('textValue={__uiText("रोकड खाते")}'));
});

test("timeline months translate only their explicit month-year display grammar", () => {
  try {
    setUiLanguage("en");
    assert.equal(uiMonthLabel("सप्टेंबर 2026"), "Sep 2026");
    assert.equal(uiMonthLabel("नोव्हेंबर 26"), "Nov 26");
    assert.equal(uiMonthLabel("मे पाटील"), "मे पाटील");
    assert.equal(uiMonthLabel("15/11/2026"), "15/11/2026");
    setUiLanguage("mr");
    assert.equal(uiMonthLabel("सप्टेंबर 2026"), "सप्टेंबर 2026");
  } finally { setUiLanguage("mr"); }
});

test("generated folios and split cashbook narration translate only at display/export boundaries", () => {
  try {
    setUiLanguage("en");
    assert.equal(uiTemplate`पान-${1}`, "Page-1");
    const source = `const write={narration:"कर्ज बंद",amount:100};
      export const View=()=> <td>{entry.creditNarration}{entry.debitNarration}</td>;`;
    const output = localizeUiSource(source, "/app/client/src/pages/reports/cashbook-ledger.tsx");
    assert(output.includes("__uiNarration(entry.creditNarration)"));
    assert(output.includes("__uiNarration(entry.debitNarration)"));
    assert(output.includes('narration:"कर्ज बंद",amount:100'));
    setUiLanguage("mr");
    assert.equal(uiTemplate`पान-${1}`, "पान-1");
  } finally { setUiLanguage("mr"); }
});

test("every source UI key recognized by the production transform has an English entry", () => {
  const missing = new Set<string>();
  const dictionary: Record<string, string> = catalog;
  let total = 0;
  function inspect(file: string) {
    localizeUiSource(readFileSync(file, "utf8"), `/app/${file}`, key => {
      total++;
      if (!(key in dictionary)) missing.add(key);
    });
  }
  function walk(directory: string) {
    for (const entry of readdirSync(directory, {withFileTypes:true})) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.tsx?$/.test(file)) inspect(file);
    }
  }
  walk("client/src");
  inspect("shared/account-summary.ts");
  inspect("shared/account-summary-format.ts");
  // These source-owned lookup maps are deliberately translated at their
  // display boundary, not rewritten as canonical object/route values.
  for (const [file, map] of [
    ["client/src/pages/activity-log.tsx", "fieldLabels"],
    ["client/src/pages/party-management.tsx", "labels"],
    ["client/src/components/cash-report-widget.tsx", ""],
  ]) {
    const tree = ts.createSourceFile(file, readFileSync(file,"utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function collect(node: ts.Node) {
      if (ts.isStringLiteral(node) && /[\u0900-\u097f]/.test(node.text) && !(node.text in dictionary)) missing.add(node.text);
      ts.forEachChild(node, collect);
    }
    function visit(node: ts.Node) {
      if (map && ts.isVariableDeclaration(node) && node.name.getText(tree) === map && node.initializer) collect(node.initializer);
      if (!map && ts.isPropertyAssignment(node) && node.name.getText(tree) === "description") collect(node.initializer);
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  assert(total > 3000);
  assert.deepEqual([...missing], []);
});
