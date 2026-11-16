import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import development from "../vite.config";
import production from "../vite.config.prod";
import { uiLocalizationPlugin } from "../scripts/ui-localization";

test("Railway and development both register the source localization plugin", () => {
  for (const config of [development, production]) {
    assert(config.plugins?.flat().some(plugin => plugin && "name" in plugin && plugin.name === "source-authored-ui-language"));
  }
  const docker = readFileSync("Dockerfile", "utf8");
  assert(docker.includes("npx vite build --config vite.config.prod.ts"));
  assert(!/>\s*vite\.config\.prod\.ts/.test(docker), "Docker must not overwrite the checked-in production config");
});

test("the shared plugin handles Railway paths without touching API values", async () => {
  const plugin = uiLocalizationPlugin();
  const transform = typeof plugin.transform === "function" ? plugin.transform : plugin.transform!.handler;
  const result: any = await (transform as any).call({}, `export const Dashboard=()=> <div>झटपट कामे<span>{customer.borrowerName}</span></div>`, "/app/client/src/pages/dashboard.tsx");
  assert(result.code.includes('__uiText("झटपट कामे")'));
  assert(result.code.includes("{customer.borrowerName}"));
});
