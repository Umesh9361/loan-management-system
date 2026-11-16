import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("PDF font-metric image reset stays restricted to hidden measurement nodes", () => {
  const css = readFileSync("client/src/index.css", "utf8");
  assert.match(css, /body > div\[style\*="visibility: hidden"\]\[style\*="font-family:"\]\[style\*="white-space: nowrap"\] > img\[width="1"\]\[height="1"\]\s*\{\s*display: inline !important;\s*\}/);
});
