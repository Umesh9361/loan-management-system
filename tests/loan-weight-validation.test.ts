import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import {
  normalizeLoanWeightInput, normalizeLoanWeight, loanWeightError, loanWeightWarning,
} from "../shared/loan-weight-validation";
import { insertLoanSchema } from "../shared/schema";

test("decimal whitespace and Marathi digits normalize without moving the decimal", () => {
  for (const input of ["1 .490", "1. 490", " 1 \t. 490 ", "१ .४९०", "1\u00a0.\u202f490"]) {
    assert.equal(normalizeLoanWeight(input), "1.490");
    assert.equal(loanWeightError(input, true), "");
    assert.equal(insertLoanSchema.shape.weight.parse(input), "1.490");
  }
  assert.equal(normalizeLoanWeight("1490"), "1490");
  assert.equal(normalizeLoanWeight(".490"), ".490");
  assert.equal(normalizeLoanWeight("1.4900"), "1.4900");
});

test("typing whitespace must not silently concatenate separate digits", () => {
  let input = "";
  for (const character of "1 490") input = normalizeLoanWeightInput(input + character);
  assert.equal(input, "1 490");
  assert.ok(loanWeightError(input, true));
  input = "";
  for (const character of "1 .490") input = normalizeLoanWeightInput(input + character);
  assert.equal(input, "1.490");
});

test("malformed, ambiguous, negative, nonfinite and zero weights fail on client and API schemas", () => {
  for (const input of ["0", "0.000", "-1.490", "+1", "1..490", "1.4.90", "1,490", "1 490", "1 4 .90", "1kg", "1e3", "NaN", "Infinity", ".", "9".repeat(51)]) {
    assert.ok(loanWeightError(input, true), input);
    assert.equal(insertLoanSchema.shape.weight.safeParse(input).success, false, input);
    assert.equal(insertLoanSchema.partial().safeParse({ weight: input }).success, false, input);
  }
  for (const input of ["1.490", "1490", ".490", "0.001", "1."]) {
    assert.equal(loanWeightError(input, true), "");
  }
  assert.equal(loanWeightError(""), "");
  assert.ok(loanWeightError("", true));
  assert.equal(insertLoanSchema.partial().safeParse({}).success, true);
  assert.equal(insertLoanSchema.partial().parse({ weight: "1 .490" }).weight, "1.490");
});

const base = { weight: "1.490", principal: 10000, purity: 82, metalType: "gold", loanType: "तारण", ratePerGram: 10000 };
test("1490 vs 1.490 is warned about, never automatically divided", () => {
  assert.equal(loanWeightWarning(base), null);
  const warning = loanWeightWarning({ ...base, weight: "1490" });
  assert.match(warning!, /1,490 ग्राम/);
  assert.match(warning!, /5%/);
  assert.match(warning!, /₹1,22,18,000/);
  assert.match(warning!, /1.490 ऐवजी 1490/);
  assert.equal(normalizeLoanWeight("1490"), "1490");
});

test("silver uses its independent per-gram price and purity, not the gold price or entered market value", () => {
  const silver = { ...base, weight: "1490", principal: 1000, metalType: "silver", purity: 99.9, ratePerGram: 100 };
  assert.match(loanWeightWarning(silver)!, /चांदी वजन/);
  assert.match(loanWeightWarning(silver)!, /₹1,48,851/);
  assert.equal(loanWeightWarning({ ...silver, principal: 100000 }), null);
});

test("missing data, unsecured loans and unavailable rates never produce fabricated valuations", () => {
  assert.equal(loanWeightWarning({ ...base, loanType: "विनातारण", weight: "1490" }), null);
  assert.equal(loanWeightWarning({ ...base, weight: "bad" }), null);
  for (const ratePerGram of [0, NaN, Infinity, -1]) {
    assert.equal(loanWeightWarning({ ...base, ratePerGram }), null);
    const warning = loanWeightWarning({ ...base, weight: "1490", ratePerGram });
    assert.match(warning!, /दर उपलब्ध झाल्यावर/);
    assert.doesNotMatch(warning!, /अंदाजे मूल्य/);
  }
  assert.equal(loanWeightWarning({ ...base, principal: "", weight: "1.490" }), null);
  assert.equal(loanWeightWarning({ ...base, purity: "bad" }), null);
  assert.equal(loanWeightWarning({ ...base, weight: "100", principal: 5000, purity: 100, ratePerGram: 1000 }), null); // exactly 5%
  assert.ok(loanWeightWarning({ ...base, weight: "100", principal: 4999, purity: 100, ratePerGram: 1000 }));
});

const source = readFileSync("client/src/pages/loans.tsx", "utf8");
const ast = ts.createSourceFile("loans.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function declaration(name: string) {
  let initializer: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(initializer, name);
  return ts.transpileModule(`(${initializer!.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
}

test("actual registration schema normalizes weights and rejects invalid principal amounts", () => {
  const schema = vm.runInNewContext(declaration("loanSchema"), { z, normalizeLoanWeight, loanWeightError });
  assert.equal(schema.shape.weight.parse("१ .४९०"), "1.490");
  for (const weight of ["-1", "0", "1 490", "1,490", "1.4.90"]) {
    assert.equal(schema.shape.weight.safeParse(weight).success, false);
  }
  for (const amount of ["0", "-10", "Infinity", "NaN", ""]) {
    assert.equal(schema.shape.principalAmount.safeParse(amount).success, false);
  }
  assert.equal(schema.shape.principalAmount.safeParse("10000").success, true);
});

test("actual submit handler blocks invalid/required weights and gates suspicious save before LTV", async () => {
  const saves: any[] = [];
  const warnings: any[] = [];
  const errors: any[] = [];
  const context = {
    createdLoanId: null, handlePhotoUpload: async () => {}, toast: () => {},
    form: { setValue: () => {}, setError: (...args: any[]) => errors.push(args), setFocus: () => {} },
    liveGoldRate: 10000, liveSilverRate: 100, company: { ltvWarningEnabled: false },
    setWeightWarningDialog: (value: any) => warnings.push(value), setLtvWarningDialog: () => {},
    createLoanMutation: { mutate: (value: any) => saves.push(value) },
    normalizeLoanWeight, loanWeightError, loanWeightWarning,
  };
  const submit = vm.runInNewContext(declaration("onSubmit"), context);
  const data = { loanType: "तारण", collateralDetails: "अंगठी", weight: "1 .490", principalAmount: "10000", purity: "82", metalType: "gold" };
  await submit(data);
  assert.equal(saves[0].weight, "1.490");
  await submit({ ...data, weight: "0" });
  await submit({ ...data, weight: "" });
  assert.equal(saves.length, 1);
  assert.equal(errors.length, 2);
  await submit({ ...data, weight: "1490" });
  assert.equal(warnings.length, 1);
  assert.equal(saves.length, 1);
  await submit({ ...warnings[0].formData, weightWarningConfirmed: true });
  assert.equal(saves.length, 2);
  assert.equal(saves[1].weight, "1490");
  // Confirmation is per submission, not a permanent bypass after editing.
  await submit({ ...data, weight: "1490" });
  assert.equal(warnings.length, 2);
  await submit({ ...data, loanType: "विनातारण", weight: "" });
  assert.equal(saves.length, 3);
});

test("existing LTV check still runs after confirming weight; form wires live warnings and both save paths", async () => {
  let saved = false;
  let ltv = false;
  const submit = vm.runInNewContext(declaration("onSubmit"), {
    createdLoanId: null, form: { setValue: () => {}, setError: () => {}, setFocus: () => {} },
    liveGoldRate: 10000, liveSilverRate: 100, company: {},
    setWeightWarningDialog: () => {}, setLtvWarningDialog: () => { ltv = true; },
    createLoanMutation: { mutate: () => { saved = true; } },
    normalizeLoanWeight, loanWeightError, loanWeightWarning,
  });
  await submit({ loanType: "तारण", collateralDetails: "अंगठी", weight: "1490", principalAmount: "10000", purity: "82", metalType: "gold", marketValue: "1000", weightWarningConfirmed: true });
  assert.equal(ltv, true);
  assert.equal(saved, false);
  assert.match(source, /inputMode="decimal"/);
  assert.match(source, /field\.onChange\(normalize|normalizeLoanWeightInput\(e.target.value\)/);
  assert.match(source, /वजन बरोबर आहे, पुढे जा/);
  assert.match(source, /वजन दुरुस्त करा/);
  assert.match(source, /ratePerGram: data.metalType === 'silver' \? liveSilverRate : liveGoldRate/);
  assert.match(source, /if \(editingLoan\)[\s\S]*apiRequest\(`\/api\/loans\/\$\{editingLoan.id\}`/);
});
