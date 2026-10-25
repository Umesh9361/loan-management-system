import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getPledgeFormEntry } from "../client/src/lib/pledge-form-navigation";

test("form deep links remain compatible without forcing customer registration", () => {
  assert.deepEqual(getPledgeFormEntry(""), { selection: "all", mode: "blank" });
  assert.deepEqual(getPledgeFormEntry("?form=receipt"), { selection: "receipt", mode: "blank" });
  assert.deepEqual(getPledgeFormEntry("?mode=manual"), { selection: "all", mode: "manual" });
  assert.deepEqual(getPledgeFormEntry("?form=final&mode=manual"), { selection: "final", mode: "manual" });
  assert.deepEqual(getPledgeFormEntry("?form=unknown&mode=admin"), { selection: "all", mode: "blank" });
});
test("legal notices and editable forms have independent sidebar destinations", () => {
  const notice = readFileSync("client/src/pages/reports/notice-generator.tsx", "utf8");
  assert.doesNotMatch(notice, /NoticeFormsLauncher|हाताने माहिती भरा|नोंदणीपूर्वी ग्राहकाची माहिती/);
  assert.match(notice, /कर्जदार शोधा/);
  const forms = readFileSync("client/src/pages/reports/pledge-forms.tsx", "utf8");
  assert.doesNotMatch(forms, /नोटीसकडे परत/);
  assert.match(forms, /टाइप करून भरा/);
  const sidebar = readFileSync("client/src/components/ui/sidebar.tsx", "utf8");
  assert.match(sidebar, /name: "कायदेशीर नोटीस",\s*href: "\/reports\/notice-generator"/);
  assert.match(sidebar, /name: "तारण कर्ज फॉर्म",\s*href: "\/reports\/pledge-forms"/);
  assert.doesNotMatch(sidebar, /name: "नोटीस व फॉर्म"/);
  for (const route of ["/reports/notice-generator", "/reports/pledge-forms"]) assert.ok(sidebar.includes(`'${route}': 'canViewNoticeGenerator'`));
  const mobile = readFileSync("client/src/components/ui/mobile-nav.tsx", "utf8");
  assert.match(mobile, /<Sidebar/);
});
