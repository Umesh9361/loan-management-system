import test from "node:test";
import assert from "node:assert/strict";
import { createPledgeSettingsHandlers } from "../server/pledge-form-settings";
import { DEFAULT_PLEDGE_MATTER, pledgeDefaultsRequestSchema } from "../shared/pledge-form-editor";

const records = new Map<string, string>();
const handlers = createPledgeSettingsHandlers({
  read: async tenant => records.get(tenant),
  write: async (tenant, matter) => { records.set(tenant, JSON.stringify(matter)); },
  reset: async tenant => { records.delete(tenant); },
  canRead: async user => user === "allowed-user",
});
async function request(handler: any, session: any, body: any = undefined) {
  const result = { status: 200, body: null as any };
  const res = { status(code: number) { result.status = code; return this; }, json(body: any) { result.body = body; return this; }, setHeader() {} };
  await handler({ session, body }, res);
  return result;
}
test("settings endpoints reject unauthenticated access and users without notice permission", async () => {
  for (const handler of Object.values(handlers)) assert.equal((await request(handler, {})).status, 401);
  assert.equal((await request(handlers.read, { userId: "blocked-user", tenantId: "A", role: "user" })).status, 403);
  assert.equal((await request(handlers.read, { userId: "allowed-user", tenantId: "A", role: "user" })).status, 200);
  for (const handler of [handlers.write, handlers.reset]) assert.equal((await request(handler, { userId: "allowed-user", tenantId: "A", role: "user" }, { matter: DEFAULT_PLEDGE_MATTER })).status, 403);
});
test("admin defaults persist by session tenant only, reset cannot alter another company", async () => {
  records.clear();
  const adminA = { userId: "admin", tenantId: "A", role: "admin" };
  const adminB = { userId: "admin", tenantId: "B", role: "admin" };
  const matter = { ...DEFAULT_PLEDGE_MATTER, finalTitle: "संस्थेचा खास नमुना" };
  assert.equal((await request(handlers.write, adminA, { matter })).status, 200);
  assert.equal((await request(handlers.read, adminA)).body.matter.finalTitle, matter.finalTitle);
  assert.equal((await request(handlers.read, adminB)).body.matter.finalTitle, DEFAULT_PLEDGE_MATTER.finalTitle);
  assert.equal((await request(handlers.reset, adminB)).status, 200);
  assert.equal((await request(handlers.read, adminA)).body.matter.finalTitle, matter.finalTitle);
  assert.equal((await request(handlers.reset, adminA)).status, 200);
  assert.equal((await request(handlers.read, adminA)).body.customized, false);
});
test("only complete validated matter is saved, never client-selected tenant or transaction fields", async () => {
  const session = { userId: "admin", tenantId: "A", role: "admin" };
  for (const body of [
    { matter: DEFAULT_PLEDGE_MATTER, tenantId: "B" },
    { matter: DEFAULT_PLEDGE_MATTER, borrowerName: "private" },
    { matter: { ...DEFAULT_PLEDGE_MATTER, borrowerName: "private" } },
    { matter: { ...DEFAULT_PLEDGE_MATTER, finalTitle: "" } },
    { matter: { ...DEFAULT_PLEDGE_MATTER, finalText1: "x".repeat(2501) } },
    { matter: { finalTitle: "missing fields" } },
  ]) assert.equal((await request(handlers.write, session, body)).status, 400);
  assert.deepEqual(pledgeDefaultsRequestSchema.parse({ matter: DEFAULT_PLEDGE_MATTER }), { matter: DEFAULT_PLEDGE_MATTER });
});
test("persistence errors return failure without falsely claiming a saved or reset default", async () => {
  const broken = createPledgeSettingsHandlers({
    read: async () => { throw Error("read"); }, write: async () => { throw Error("write"); },
    reset: async () => { throw Error("reset"); }, canRead: async () => true,
  });
  const admin = { userId: "admin", tenantId: "A", role: "admin" };
  for (const handler of Object.values(broken)) assert.equal((await request(handler, admin, { matter: DEFAULT_PLEDGE_MATTER })).status, 500);
});
