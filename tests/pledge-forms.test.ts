import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PLEDGE_FORM_OPTIONS, pledgeFormsDocument, getSelectedPledgeForms, getPledgePageGroups, type PledgeFormKey } from "../client/src/lib/pledge-forms";
import { DEFAULT_PLEDGE_MATTER, PLEDGE_FIELD_GROUPS, emptyPledgeItems } from "../shared/pledge-form-editor";

test("all six independent cut-apart templates fit the intended A4 print grid", () => {
  const html = pledgeFormsDocument({});
  assert.equal((html.match(/data-form="/g) || []).length, 6);
  assert.equal((html.match(/class="pf-cut"/g) || []).length, 4);
  assert.match(html, /size: A4 portrait; margin: 8mm/);
  assert.match(html, /border-left:.2mm dashed/);
  assert.match(html, /border-top:.2mm dashed/);
  assert.doesNotMatch(html, /WhatsApp|SMS|FORM\s*-?\s*[1-6]|करार/i);
  assert.match(html, /शिल्लक आपल्याला दिली जाईल/);
  assert.match(html, /15 दिवसांत/);
  assert.match(html, /साक्षीदाराची सही/);
});
test("selected borrower is populated on every piece without HTML injection or non-English numbers", () => {
  const html = pledgeFormsDocument({
    company: 'नमुना & संस्था', borrowerName: 'नमुना <script>alert("x")</script>',
    borrowerAddress: 'पत्ता "गाव" & रस्ता', borrowerMobile: '९८७६५४३२१०',
    accountNumber: '१२३', principalAmount: '१२३४.००', loanDate: '2026-10-25', printDate: '2026-10-26',
  });
  assert.equal((html.match(/नमुना &lt;script&gt;/g) || []).length, 6);
  assert.doesNotMatch(html, /<script>|[०-९]/);
  assert.match(html, /नमुना &amp; संस्था/);
  assert.match(html, /पत्ता &quot;गाव&quot; &amp; रस्ता/);
  assert.match(html, /9876543210/);
  assert.match(html, />1,234<\/span>/);
  assert.match(html, /25\/10\/2026/);
  assert.match(html, /26\/10\/2026/);
});
test("each individual template prints only that piece and supports handwriting on blank copies", () => {
  for (const option of PLEDGE_FORM_OPTIONS.filter(option => option.value !== "all")) {
    const html = pledgeFormsDocument({}, option.value);
    assert.equal((html.match(/data-form="/g) || []).length, 1, option.value);
    assert.match(html, new RegExp(`data-form="${option.value}"`));
    assert.match(html, /pf-single/);
    assert.doesNotMatch(html, /class="pf-cut"/);
    assert.match(html, /____\/____\/________/);
  }
  assert.throws(() => pledgeFormsDocument({}, "invalid" as any), /चुकीचा/);
});

test("every fillable financial, date and identification field reaches the printable document", () => {
  const fields = PLEDGE_FIELD_GROUPS.flatMap(group => group.fields);
  for (const [index, field] of fields.entries()) {
    const value = field.type === "date" ? "2026-10-27" : field.type === "money" || field.type === "number" ? String(70000 + index) : `unique-${field.key}`;
    const html = pledgeFormsDocument({ [field.key]: value });
    const expected = field.type === "date" ? "27/10/2026" : field.type === "money" ? Number(value).toLocaleString("en-IN") : value;
    assert.ok(html.includes(expected), `missing printed field ${field.key}: ${expected}`);
  }
  for (const key of ["loanItems", "saleItems"] as const) {
    const rows = emptyPledgeItems();
    rows[1] = { description: "विशेष वस्तू", purity: "91.6", weight: "12.75", value: "50000" };
    const html = pledgeFormsDocument({ [key]: rows });
    for (const value of ["विशेष वस्तू", "91.6", "12.75", "50,000"]) assert.ok(html.includes(value));
  }
});
test("temporary wording is escaped text, substitutes only known dates, and cannot mutate factory defaults", () => {
  const modified = { ...DEFAULT_PLEDGE_MATTER, finalText1: '<img src=x onerror="bad()"> दिनांक {{loanDate}}\nतात्पुरता बदल' };
  const html = pledgeFormsDocument({ loanDate: "2026-10-27" }, "final", modified);
  assert.match(html, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt;/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /27\/10\/2026<br>तात्पुरता बदल/);
  assert.doesNotMatch(pledgeFormsDocument({}, "final"), /तात्पुरता बदल/);
  assert.equal(DEFAULT_PLEDGE_MATTER.finalText1.includes("तात्पुरता बदल"), false);
});
test("one and two page choices keep all six intact and remove duplicate signature dates", () => {
  for (const layout of ["compact", "spacious"] as const) {
    const html = pledgeFormsDocument({ printDate: "2026-10-28" }, "all", DEFAULT_PLEDGE_MATTER, layout);
    assert.equal((html.match(/class="pf-page"/g) || []).length, layout === "compact" ? 1 : 2);
    assert.equal((html.match(/data-form="/g) || []).length, 6);
    assert.equal((html.match(/class="pf-date"/g) || []).length, 6);
    for (const block of html.matchAll(/<div class="pf-signatures">([\s\S]*?)<\/div>/g)) assert.doesNotMatch(block[1], /दिनांक|<small>/);
    if (layout === "spacious") {
      const pages = html.split('<div class="pf-page">').slice(1);
      assert.equal((pages[0].match(/data-form="/g) || []).length, 3);
      assert.equal((pages[1].match(/data-form="/g) || []).length, 3);
      assert.match(pages[0], /data-form="interim"/);
      assert.match(pages[1], /data-form="final"/);
    }
  }
  assert.equal((pledgeFormsDocument({}, "final", DEFAULT_PLEDGE_MATTER, "spacious").match(/class="pf-page"/g) || []).length, 1);
});
test("all 63 nonempty combinations print only the chosen complete forms in stable order", () => {
  const keys = getSelectedPledgeForms("all");
  for (let mask = 1; mask < 64; mask++) {
    const selected = keys.filter((_key, index) => mask & (1 << index));
    for (const layout of ["compact", "spacious"] as const) {
      const html = pledgeFormsDocument({}, [...selected].reverse(), DEFAULT_PLEDGE_MATTER, layout);
      const actual = Array.from(html.matchAll(/data-form="([^"]+)"/g), match => match[1]);
      assert.deepEqual(actual, selected);
      assert.equal((html.match(/class="pf-page"/g) || []).length, getPledgePageGroups(selected, layout).length);
      assert.equal(new Set(actual).size, selected.length);
    }
  }
  assert.deepEqual(getPledgePageGroups(["interim", "final"], "spacious"), [["interim", "final"]]);
  assert.deepEqual(getSelectedPledgeForms(["final", "loan", "loan"]), ["loan", "final"]);
  assert.deepEqual(getSelectedPledgeForms([]), []);
  assert.throws(() => pledgeFormsDocument({}, []), /किमान एक/);
  assert.throws(() => pledgeFormsDocument({}, ["bad"] as unknown as PledgeFormKey[]), /चुकीचा/);
});
test("release undertaking records the customer's own inspection without photos or blanket future waiver", () => {
  const html = pledgeFormsDocument({ borrowerName: "नमुना ग्राहक", printDate: "2026-10-28", releaseDate: "2026-10-29", conditionNote: "कडी सैल असल्याची नोंद", itemCount: "2" }, "receipt");
  const matter = html.match(/<p class="pf-release">([\s\S]*?)<\/p>/)?.[1] || "";
  for (const phrase of ["स्वतः तपासल्या", "माझ्याच वस्तू", "समाधानाने", "स्वीकारताना", "तूटफूट", "अदलाबदल", "बनावटपणाबाबत", "माझी कोणतीही तक्रार नाही", "वरील मजकूर वाचून व समजून खाली सही केली आहे."]) assert.ok(matter.includes(phrase), phrase);
  assert.doesNotMatch(matter, /दिनांक|संख्या|29\/10\/2026/);
  assert.doesNotMatch(html, /सोपवलेल्या वस्तूंची संख्या/);
  assert.equal((html.match(/कर्जदाराची सही \/ अंगठा/g) || []).length, 1);
  assert.equal((html.match(/28\/10\/2026/g) || []).length, 1);
  const editableKeys = PLEDGE_FIELD_GROUPS.flatMap(group => group.fields.map(field => field.key));
  assert.ok(!editableKeys.some(key => ["releaseDate", "itemCount", "conditionNote"].includes(String(key))));
  assert.doesNotMatch(matter, /फोटो|photo|पुढे कोणतीही तक्रार|हक्क सोड|दावा करणार नाही/i);
  assert.doesNotMatch(html, /कडी सैल असल्याची नोंद|नोंद वगळता|तफावत|नसल्यास ‘नाही’/);
  assert.match(html, /ग्राहकाची तपासणी व स्वीकृती घोषणा/);
  assert.match(html, /कर्जदाराची सही \/ अंगठा/);
  assert.doesNotMatch(pledgeFormsDocument({}, "loan"), /ग्राहकाची तपासणी व स्वीकृती घोषणा/);
});

const page = readFileSync("client/src/pages/reports/pledge-forms.tsx", "utf8");
const source = ts.createSourceFile("page.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function initializer(name: string) {
  let expression = "";
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) expression = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(expression, `real page declaration exists: ${name}`);
  return expression;
}
function execute(expression: string, context: Record<string, unknown>) {
  return vm.runInNewContext(ts.transpile(`(${expression})`, { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 }), context);
}
test("switching blank/new borrower clears previous personal and loan data in the actual page handlers", () => {
  const emptyPersonal = { borrowerName: "", borrowerAddress: "", borrowerMobile: "" };
  const emptyDetails = { accountNumber: "", principalAmount: "", loanDate: "", interestRate: "", printDate: "" };
  const state: Record<string, unknown> = {};
  const context: Record<string, unknown> = { emptyPersonal, emptyDetails };
  for (const key of ["Mode", "Search", "DebouncedSearch", "OpenSuggestions", "Selected", "Personal", "Details"]) context[`set${key}`] = (value: unknown) => { state[key] = value; };
  context.clearBorrower = execute(initializer("clearBorrower"), context);
  const changeMode = execute(initializer("changeMode"), context);
  changeMode("blank");
  assert.equal(state.Mode, "blank");
  assert.equal(state.Selected, null);
  assert.deepEqual(state.Personal, emptyPersonal);
  assert.deepEqual(state.Details, emptyDetails);
  state.Personal = { borrowerName: "पूर्वीचा ग्राहक" };
  state.Details = { accountNumber: "पूर्वीचे खाते" };
  execute(initializer("changeSearch"), context)("नवीन");
  assert.equal(state.Selected, null);
  assert.deepEqual(state.Personal, emptyPersonal);
  assert.deepEqual(state.Details, emptyDetails);
});
test("selecting a real suggestion fills the actual editable profile and closes suggestions", () => {
  const state: Record<string, unknown> = {};
  const context: Record<string, unknown> = {};
  for (const key of ["Selected", "Personal", "Search", "OpenSuggestions"]) context[`set${key}`] = (value: unknown) => { state[key] = value; };
  const borrower = { borrowerName: "नमुना", borrowerAddress: "पत्ता", borrowerMobile: "1234567890" };
  execute(initializer("chooseBorrower"), context)(borrower);
  assert.equal(state.Selected, borrower);
  assert.equal(JSON.stringify(state.Personal), JSON.stringify(borrower));
  assert.equal(state.OpenSuggestions, false);
});
test("all authenticated role routes and sidebar use existing notice permission, not a new unguarded route", () => {
  const app = readFileSync("client/src/App.tsx", "utf8");
  const sidebar = readFileSync("client/src/components/ui/sidebar.tsx", "utf8");
  assert.equal((app.match(/path="\/reports\/pledge-forms"/g) || []).length, 3);
  assert.match(app, /perms\.canViewNoticeGenerator && <Route path="\/reports\/pledge-forms"/);
  assert.match(sidebar, /'\/reports\/pledge-forms': 'canViewNoticeGenerator'/);
});
