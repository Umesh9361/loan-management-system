import test from "node:test";
import assert from "node:assert/strict";
import { createNoticeSettingsHandlers } from "../server/notice-settings";
import { DEFAULT_NOTICE_MATTER, noticeDefaultsRequestSchema, renderNoticeContent } from "../shared/notice-matter";

const rows = new Map<string, string>();
const handlers = createNoticeSettingsHandlers({
  read: async tenant => rows.get(tenant),
  write: async (tenant, matter) => { rows.set(tenant, JSON.stringify(matter)); },
  reset: async tenant => { rows.delete(tenant); },
  canRead: async user => user === "permitted",
});
async function request(handler: any, session: any, body?: any) {
  const result = { status: 200, body: null as any };
  await handler({ session, body }, {
    status(code: number) { result.status = code; return this; },
    json(body: any) { result.body = body; return this; }, setHeader() {},
  });
  return result;
}
const admin = (tenantId: string) => ({ userId: "admin", role: "admin", tenantId });
test("notice read/write/reset enforce authentication, notice permission and admin-only shared defaults", async () => {
  for (const handler of Object.values(handlers)) assert.equal((await request(handler, {})).status, 401);
  assert.equal((await request(handlers.read, { userId: "blocked", role: "user", tenantId: "A" })).status, 403);
  assert.equal((await request(handlers.read, { userId: "permitted", role: "user", tenantId: "A" })).status, 200);
  for (const handler of [handlers.write, handlers.reset]) {
    assert.equal((await request(handler, { userId: "permitted", role: "user", tenantId: "A" }, { matter: DEFAULT_NOTICE_MATTER })).status, 403);
  }
});
test("all notice fields persist through reload and reset restores original only for session tenant", async () => {
  rows.clear();
  const custom = { ...DEFAULT_NOTICE_MATTER, title: "सुधारित नोटीस", dateLine: "तारीख: {noticeDate}", recipient: "{borrowerName}\n{borrowerAddress}", subject: "{companyName}: खाते {accountNumber}", body: "माझा संपूर्ण बदललेला मजकूर.\n\nदुसरा परिच्छेद.", signature: "संस्थेचा अधिकारी" };
  assert.equal((await request(handlers.write, admin("A"), { matter: custom })).status, 200);
  assert.deepEqual((await request(handlers.read, admin("A"))).body, { matter: custom, customized: true });
  assert.deepEqual((await request(handlers.read, admin("B"))).body.matter, DEFAULT_NOTICE_MATTER);
  await request(handlers.reset, admin("B"));
  assert.deepEqual((await request(handlers.read, admin("A"))).body.matter, custom);
  await request(handlers.reset, admin("A"));
  assert.deepEqual((await request(handlers.read, admin("A"))).body, { matter: DEFAULT_NOTICE_MATTER, customized: false });
  assert.ok(Object.isFrozen(DEFAULT_NOTICE_MATTER));
});
test("strict notice schema rejects incomplete, oversized, unknown-token and client-selected-tenant requests", async () => {
  for (const body of [
    { matter: DEFAULT_NOTICE_MATTER, tenantId: "B" },
    { matter: { ...DEFAULT_NOTICE_MATTER, tenantId: "B" } },
    { matter: { title: "missing" } },
    { matter: { ...DEFAULT_NOTICE_MATTER, body: "" } },
    { matter: { ...DEFAULT_NOTICE_MATTER, body: "x".repeat(15001) } },
    { matter: { ...DEFAULT_NOTICE_MATTER, body: "{incorrectPlaceholder}" } },
  ]) assert.equal((await request(handlers.write, admin("A"), body)).status, 400);
  assert.deepEqual(noticeDefaultsRequestSchema.parse({ matter: DEFAULT_NOTICE_MATTER }).matter, DEFAULT_NOTICE_MATTER);
});
test("notice rendering applies every edited field to filled and blank copies without mutating loan or saved original", () => {
  const loan = { id: "1", borrowerName: "नमुना ग्राहक", borrowerAddress: "नमुना गाव", borrowerPhone: "1234567890", accountNumber: "621", loanDate: "2026-10-31", principalAmount: "25000", interestRate: "12", durationInMonths: "6" };
  const before = JSON.stringify(loan);
  const matter = { ...DEFAULT_NOTICE_MATTER, title: "नवे शीर्षक", signature: "नवी सही", body: "खाते {accountNumber}\nदिनांक {loanDate}\n\nरक्कम {principalAmount}; मुदत {loanPeriod}; दर {interestRate}" };
  const filled = renderNoticeContent(loan, matter, { name: "नमुना संस्था" });
  for (const value of ["नवे शीर्षक", "नवी सही", "खाते 621", "31/10/2026", "25,000", "6 महिने", "नमुना ग्राहक"]) assert.ok(filled.includes(value), value);
  assert.equal(JSON.stringify(loan), before);
  const blank = renderNoticeContent(null, matter);
  assert.ok(blank.includes("नवे शीर्षक") && blank.includes("नवी सही") && blank.includes("________________"));
  assert.ok(!blank.includes("नमुना ग्राहक") && !blank.includes("621"));
  assert.match(renderNoticeContent(loan, { ...DEFAULT_NOTICE_MATTER }), /सदर नोटीसची गंभीर दखल घ्यावी/);
});
test("plain text templates and account fields cannot inject scripts or markup into preview or exports", () => {
  const html = renderNoticeContent({ borrowerName: '<img src=x onerror="alert(1)">', accountNumber: "{companyName}" },
    { ...DEFAULT_NOTICE_MATTER, body: "<script>alert(1)</script>\n\nखाते {accountNumber}" });
  assert.ok(html.includes("&lt;script&gt;") && html.includes("&lt;img"));
  assert.ok(!html.includes("<script>") && !html.includes("<img"));
  assert.ok(html.includes("{companyName}"), "replacement values are not recursively interpreted");
});
test("database failures never falsely report saved or reset wording; corrupt saved data does not silently become original", async () => {
  const broken = createNoticeSettingsHandlers({
    read: async () => "{broken", write: async () => { throw Error("write"); },
    reset: async () => { throw Error("reset"); }, canRead: async () => true,
  });
  for (const handler of Object.values(broken)) assert.equal((await request(handler, admin("A"), { matter: DEFAULT_NOTICE_MATTER })).status, 500);
});
