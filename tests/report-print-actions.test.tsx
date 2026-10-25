import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportPrintActions, type ReportPrintAction } from "../client/src/components/report-print-actions";

for (const pending of [null, "pdf", "print"] as ReportPrintAction[]) {
  test(`export action ${pending ?? "idle"} keeps the other label unchanged`, () => {
    const html = renderToStaticMarkup(<ReportPrintActions pending={pending} onPdf={() => {}} onPrint={() => {}} />);
    const buttons = html.match(/<button[\s\S]*?<\/button>/g)!;
    assert.equal(buttons.length, 2);
    assert.match(buttons[0], new RegExp(pending === "pdf" ? "PDF तयार होत आहे…" : "PDF डाउनलोड"));
    assert.match(buttons[1], new RegExp(pending === "print" ? "प्रिंट तयार होत आहे…" : "प्रिंट करा"));
    assert.equal(buttons[0].includes('aria-busy="true"'), pending === "pdf");
    assert.equal(buttons[1].includes('aria-busy="true"'), pending === "print");
    for (const button of buttons) {
      assert.equal(button.includes('disabled=""'), pending !== null);
      assert.match(button, /h-12 w-full min-w-0/);
    }
    assert.match(html, /grid-cols-2/);
    assert.match(buttons[0], /disabled:text-indigo-900/);
    assert.match(buttons[1], /disabled:text-white/);
    for (const button of buttons) assert.match(button, /disabled:opacity-100/);
  });
}
