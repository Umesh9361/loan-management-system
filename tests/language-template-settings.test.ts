import test from "node:test";
import assert from "node:assert/strict";
import { createNoticeSettingsHandlers } from "../server/notice-settings";
import { createPledgeSettingsHandlers } from "../server/pledge-form-settings";

for (const [name, create] of [["notice", createNoticeSettingsHandlers], ["pledge", createPledgeSettingsHandlers]] as const) {
  test(`${name}: English save/reset cannot change Marathi matter or another tenant`, async () => {
    const records = new Map<string, string>();
    const handlers = create({
      read: async (tenant: string, language: any) => records.get(`${tenant}:${language}`),
      write: async (tenant: string, matter: any, language: any) => { records.set(`${tenant}:${language}`, JSON.stringify(matter)); },
      reset: async (tenant: string, language: any) => { records.delete(`${tenant}:${language}`); },
      canRead: async () => true,
    });
    async function request(action: "read" | "write" | "reset", language: string, body?: any, tenant = "A") {
      const result = { code: 200, body: null as any };
      const res: any = { status(code: number) { result.code = code; return this; }, json(body: any) { result.body = body; return this; }, setHeader() {} };
      await (handlers[action] as any)({ session: { userId: "admin", tenantId: tenant, role: "admin" }, query: { language }, body }, res);
      return result;
    }
    const mr = (await request("read", "mr")).body.matter;
    const en = (await request("read", "en")).body.matter;
    assert.notDeepEqual(mr, en);
    const field = name === "notice" ? "title" : "loanTitle";
    const mrCustom = { ...mr, [field]: "संस्थेचा मराठी मजकूर" };
    const enCustom = { ...en, [field]: "Organization English wording" };
    assert.equal((await request("write", "mr", { matter: mrCustom })).code, 200);
    assert.equal((await request("write", "en", { matter: enCustom })).code, 200);
    assert.deepEqual((await request("read", "mr")).body.matter, mrCustom);
    assert.deepEqual((await request("read", "en")).body.matter, enCustom);
    assert.deepEqual((await request("read", "en", undefined, "B")).body.matter, en);
    await request("reset", "en");
    assert.deepEqual((await request("read", "en")).body.matter, en);
    assert.deepEqual((await request("read", "mr")).body.matter, mrCustom);
    await request("reset", "mr");
    assert.deepEqual((await request("read", "mr")).body.matter, mr);
    assert.equal((await request("reset", "invalid")).code, 400);
  });
}
