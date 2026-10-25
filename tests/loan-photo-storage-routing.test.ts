import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Real routing methods, mocked storage/DB only. No keys from the environment,
// live Cloudinary calls, customer uploads, or application DB writes.
function methods(path: string, className: string, names: string[]) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const found = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node) && node.name?.text === className) {
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name) found.set(member.name.getText(source), member.getText(source));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names.map(name => { assert.ok(found.has(name), `${className}.${name} exists`); return found.get(name); }).join("\n");
}
function fixture() {
  const tenantConfigs = new Map<string, any>();
  const state = { defaultConfig: { provider: "local" } as any };
  const calls: { provider: string; originalName: string; tenantId: string; loanId: string }[] = [];
  class Local {
    async upload(_buffer: Buffer, originalName: string, tenantId: string, loanId: string) {
      calls.push({ provider: "local", originalName, tenantId, loanId });
      return { storageProvider: "local", filename: "test.png", storagePath: "uploads/photos/test.png",
        thumbnailPath: "uploads/photos/test_thumb.png", format: "png", size: 100 };
    }
  }
  class Cloud {
    constructor(_config: unknown) {}
    async upload(_buffer: Buffer, originalName: string, tenantId: string, loanId: string) {
      calls.push({ provider: "cloudinary", originalName, tenantId, loanId });
      return { storageProvider: "cloudinary", filename: "test.png", storagePath: "https://res.cloudinary.com/fixture/image/upload/test.png",
        thumbnailPath: "https://res.cloudinary.com/fixture/image/upload/w_300/test.png",
        cloudinaryPublicId: "fixture/test", format: "png", size: 100 };
    }
  }
  const code = `class PhotoStorageFactory {${methods("server/photo-storage-provider.ts", "PhotoStorageFactory",
    ["getProvider", "getStorageConfig", "clearCache"])}}
    class PhotoService {${methods("server/photo-service.ts", "PhotoService",
      ["processAndSavePhoto", "getPhotoUrl", "getPhotoThumbnailUrl"])}}
    ({PhotoStorageFactory,PhotoService});`;
  const api = vm.runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022 }), {
    providerCache: new Map(), CACHE_TTL: 300000, LocalStorageProvider: Local, CloudinaryStorageProvider: Cloud,
    tenantStorageSettings: { name: "tenant", tenantId: "tenantId" },
    systemSettings: { name: "system", settingKey: "settingKey" },
    eq: (_column: unknown, value: string) => value,
    db: { select: () => ({ from: (table: any) => ({ where: async (value: string) =>
      table.name === "tenant" ? (tenantConfigs.has(value) ? [tenantConfigs.get(value)] : []) :
        [{ settingValue: JSON.stringify(state.defaultConfig) }] }) }) },
    console: { log() {}, warn() {}, error() {} },
  });
  return { ...api, calls, tenantConfigs, state };
}
const configuredCloud = {
  provider: "cloudinary", storageProvider: "cloudinary", isConfigured: true,
  cloudinaryCloudName: "fixture-only", cloudinaryApiKey: "not-a-real-key", cloudinaryApiSecret: "not-a-real-secret",
};
test("borrower and collateral uploads reuse the same tenant-selected Cloudinary pipeline", async () => {
  const { PhotoService, tenantConfigs, calls } = fixture();
  tenantConfigs.set("tenant-A", configuredCloud);
  for (const name of ["item-1.png", "item-2.png", "borrower.png"]) {
    const photo = await PhotoService.processAndSavePhoto(Buffer.from("fixture"), name, "tenant-A", "loan-A");
    assert.equal(photo.storageProvider, "cloudinary");
    assert.equal(photo.cloudinaryPublicId, "fixture/test");
    assert.match(photo.storagePath, /^https:\/\/res.cloudinary.com\//);
  }
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => call.provider === "cloudinary" && call.tenantId === "tenant-A" && call.loanId === "loan-A"));
});
test("local selection applies equally to borrower and item uploads", async () => {
  const { PhotoService, tenantConfigs, calls } = fixture();
  tenantConfigs.set("tenant-A", { isConfigured: true, storageProvider: "local" });
  for (const name of ["item.png", "borrower.png"]) {
    const photo = await PhotoService.processAndSavePhoto(Buffer.from("fixture"), name, "tenant-A", "loan-A");
    assert.equal(photo.storageProvider, "local");
    assert.equal(photo.storagePath, "uploads/photos/test.png");
  }
  assert.ok(calls.every(call => call.provider === "local"));
});
test("default settings apply without an override; explicit local settings take precedence and cache clears on switch", async () => {
  const { PhotoStorageFactory, PhotoService, tenantConfigs, state } = fixture();
  state.defaultConfig = configuredCloud;
  assert.equal((await PhotoService.processAndSavePhoto(Buffer.from("fixture"), "borrower.png", "tenant-A", "loan-A")).storageProvider, "cloudinary");
  tenantConfigs.set("tenant-A", { isConfigured: true, storageProvider: "local" });
  PhotoStorageFactory.clearCache("tenant-A");
  assert.equal((await PhotoService.processAndSavePhoto(Buffer.from("fixture"), "borrower.png", "tenant-A", "loan-A")).storageProvider, "local");
});
test("stored photo location, not today's provider selection, determines display URLs", async () => {
  const { PhotoService } = fixture();
  const req = { protocol: "https", get: () => "fixture.invalid" };
  assert.equal(PhotoService.getPhotoUrl(req, { storageProvider: "local", storagePath: "uploads/photos/borrower.png" }), "https://fixture.invalid/uploads/photos/borrower.png");
  const cloud = { storageProvider: "cloudinary", storagePath: "https://res.cloudinary.com/fixture/person.png", thumbnailPath: "https://res.cloudinary.com/fixture/person-thumb.png" };
  assert.equal(PhotoService.getPhotoUrl(req, cloud), cloud.storagePath);
  assert.equal(PhotoService.getPhotoThumbnailUrl(req, cloud), cloud.thumbnailPath);
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.match(routes, /PhotoService\.processAndSavePhoto\(file.buffer, file.originalname, tenantId, loanId\)/);
  assert.match(routes, /PhotoStorageFactory.clearCache\(tenantId\)/);
});
test("missing Cloudinary configuration falls back to local and records the actual local provider", async () => {
  const { PhotoService, tenantConfigs } = fixture();
  tenantConfigs.set("tenant-A", { isConfigured: true, storageProvider: "cloudinary" });
  const photo = await PhotoService.processAndSavePhoto(Buffer.from("fixture"), "borrower.png", "tenant-A", "loan-A");
  assert.equal(photo.storageProvider, "local");
  assert.equal(photo.storagePath, "uploads/photos/test.png");
});
