import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getPledgeFormEntry } from "../client/src/lib/pledge-form-navigation";

test("notice shortcuts open the requested form without forcing customer registration", () => {
  assert.deepEqual(getPledgeFormEntry(""), { selection: "all", mode: "blank" });
  assert.deepEqual(getPledgeFormEntry("?form=receipt"), { selection: "receipt", mode: "blank" });
  assert.deepEqual(getPledgeFormEntry("?mode=manual"), { selection: "all", mode: "manual" });
  assert.deepEqual(getPledgeFormEntry("?form=final&mode=manual"), { selection: "final", mode: "manual" });
  assert.deepEqual(getPledgeFormEntry("?form=unknown&mode=admin"), { selection: "all", mode: "blank" });
});
test("notice entry remains above notice preview and preserves the existing loan search", () => {
  const launcher = readFileSync("client/src/components/notice-forms-launcher.tsx", "utf8");
  assert.doesNotMatch(launcher, /form=receipt|title: "परतफेड पावती"/);
  assert.match(launcher, /sm:grid-cols-2/);
  const notice = readFileSync("client/src/pages/reports/notice-generator.tsx", "utf8");
  assert.ok(notice.indexOf("<NoticeFormsLauncher />") > notice.indexOf("<main"));
  assert.ok(notice.indexOf("<NoticeFormsLauncher />") < notice.indexOf("{showInlinePreview &&", notice.indexOf("<main")));
  const sidebar = readFileSync("client/src/components/ui/sidebar.tsx", "utf8");
  assert.match(sidebar, /name: "नोटीस व फॉर्म"/);
  for (const route of ["/reports/notice-generator", "/reports/pledge-forms"]) assert.ok(sidebar.includes(`'${route}': 'canViewNoticeGenerator'`));
});
