import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import catalog from "../shared/ui-catalog.en.json";
import { uiText, uiTemplate, setUiLanguage, uiNarration, resolveUiPreference } from "../shared/ui-language";
import { localizeUiSource } from "../scripts/ui-localization";
import { defaultNoticeMatter, DEFAULT_NOTICE_MATTER, renderNoticeContent } from "../shared/notice-matter";
import { defaultPledgeMatter, DEFAULT_PLEDGE_MATTER } from "../shared/pledge-form-editor";

test("source transform translates literals, not customer data, enum values, comparisons or payloads", () => {
  const source = `
    const name = customer.borrowerName;
    const enumValue = "सोने";
    const payload = { narration: "कर्ज बंद", value: "सोने" };
    const menu = {label:"कर्ज नोंदणी",value:"सोने"};
    export const View=()=> <div><h1>कर्जदाराचे नाव</h1><p>{name}</p>
      <p>{customer.description}</p>
      <input value={name} placeholder="नाव टाका" />
      <input value={loan.metalType || "सोने"} />
      <p>{loan.metalType==="सोने"?"सोने":"चांदी"}</p></div>;
  `;
  const output = localizeUiSource(source, "/app/client/src/pages/fixture.tsx");
  assert(output.includes('__uiText("कर्जदाराचे नाव")'));
  assert(output.includes("{name}"));
  assert(output.includes("{customer.description}"));
  assert(output.includes('metalType==="सोने"'));
  assert(output.includes('const enumValue = "सोने"'));
  assert(output.includes('narration: "कर्ज बंद"'));
  assert(output.includes('value:"सोने"'));
  assert(output.includes('value={loan.metalType || "सोने"}'));
  const result = ts.transpileModule(output, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
  assert.equal(result.diagnostics?.length, 0);
});

test("HTML literals localize while names/items/photos/money and embedded CSS remain untouched", () => {
  setUiLanguage("en");
  const name = "कर्जदाराचे नाव", item = "ठुशी";
  const html = uiTemplate`<html lang="mr"><style>.a{color:red}/* कर्ज */</style><h1>कर्जदाराचे नाव</h1><p>${name}</p><p>${item}</p><b>${"10000.50"}</b></html>`;
  assert(html.includes('<html lang="en">'));
  assert(html.includes("<h1>Borrower Name</h1>"));
  assert(html.includes(`<p>${name}</p>`), "even a customer value matching a catalog key is not translated");
  assert(html.includes("<p>ठुशी</p>"));
  assert(html.includes("10000.50"));
  assert(html.includes(".a{color:red}/* कर्ज */"));
  setUiLanguage("mr");
});

test("notice and six form defaults have complete English copies without altering Marathi originals", () => {
  const originalNotice = structuredClone(DEFAULT_NOTICE_MATTER);
  const originalForms = structuredClone(DEFAULT_PLEDGE_MATTER);
  const notice = defaultNoticeMatter("en");
  const forms = defaultPledgeMatter("en");
  for (const value of [...Object.values(notice), ...Object.values(forms)]) {
    assert(!/[\u0900-\u097f]/.test(value), `Untranslated default: ${value}`);
  }
  assert.deepEqual(defaultNoticeMatter("mr"), originalNotice);
  assert.deepEqual(defaultPledgeMatter("mr"), originalForms);
  const data = { borrowerName: "राम पाटील", borrowerAddress: "नमुना गाव", accountNumber: "621", principalAmount: "10000", loanDate: "2026-01-02" };
  const snapshot = structuredClone(data);
  const html = renderNoticeContent(data, notice);
  assert(html.includes("राम पाटील"));
  assert(html.includes("02/01/2026"));
  assert.deepEqual(data, snapshot);
  assert.deepEqual(DEFAULT_NOTICE_MATTER, originalNotice);
  assert.deepEqual(DEFAULT_PLEDGE_MATTER, originalForms);
});

test("all translated placeholders stay intact and catalog entries have nonempty translations", () => {
  const tokens = (value: string) => [...value.matchAll(/\{#\d+\}|\{\{[^{}]+\}\}|\{[A-Za-z][^{}]*\}/g)].map(m => m[0]).sort();
  for (const [source, translated] of Object.entries(catalog)) {
    assert(translated.trim() || /^[\u093a-\u094f]+$/.test(source), source);
    assert.deepEqual(tokens(translated), tokens(source), source);
  }
});

test("English to Marathi to English is presentation-only and reversible", () => {
  const userData = Object.freeze({ borrowerName: "राम", item: "ठुशी", amount: "488.731" });
  for (const language of ["en", "mr", "en", "mr"] as const) {
    setUiLanguage(language);
    assert.equal(uiText("कर्जदाराचे नाव"), language === "en" ? "Borrower Name" : "कर्जदाराचे नाव");
    assert.deepEqual(userData, { borrowerName: "राम", item: "ठुशी", amount: "488.731" });
  }
});

test("explicit login choice wins, otherwise the user preference wins over a shared device", () => {
  assert.equal(resolveUiPreference("en", "mr", "en"), "mr");
  assert.equal(resolveUiPreference("mr", "en", "mr"), "en");
  assert.equal(resolveUiPreference("en", undefined, "mr"), "en");
  assert.equal(resolveUiPreference("mr", undefined, "en"), "mr");
  assert.equal(resolveUiPreference(null, undefined, "en"), "en");
  assert.equal(resolveUiPreference("invalid", undefined), "mr");
});

test("standard financial narration is English only at render time and keeps the person's exact name", () => {
  const text = "कर्ज बंद - खाते क्र. 621 राम पाटील (नमुना गट) - मुद्दल: ₹10000 + व्याज: ₹1200 · कर्ज दिनांक: 15/06/2024";
  setUiLanguage("en");
  const translated = uiNarration(text);
  assert.equal(translated, "Loan Closed - Account No. 621 राम पाटील (नमुना गट) - Principal: ₹10000 + Interest: ₹1200 · Loan Dt.: 15/06/2024");
  assert.equal(uiNarration("ठुशी"), "ठुशी");
  assert.equal(uiNarration("मागील शिल्लक पुढे (कमतरता)"), "Balance B/F (Deficit)");
  assert.equal(uiNarration("शिल्लक खाली"), "Balance C/D");
  setUiLanguage("mr");
  assert.equal(uiNarration(text), text);
});
