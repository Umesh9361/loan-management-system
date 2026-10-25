import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import sharp from "sharp";
import ts from "typescript";

// Actual storage/processing/media-handler code, real Sharp and temporary files.
// Only DB and Cloudinary transport are faked; never use live keys or accounts.
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "loan-photo-integration-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const providerSource = await fs.readFile("server/photo-storage-provider.ts", "utf8");
  const source = ts.createSourceFile("provider.ts", providerSource, ts.ScriptTarget.Latest, true);
  const classes: string[] = [];
  source.forEachChild(node => {
    if (ts.isClassDeclaration(node)) classes.push(node.getText(source).replace(/^export\s+/, ""));
  });
  const serviceSource = ts.createSourceFile("service.ts", await fs.readFile("server/photo-service.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const serviceMethods: string[] = [];
  serviceSource.forEachChild(node => {
    if (!ts.isClassDeclaration(node) || node.name?.text !== "PhotoService") return;
    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) && ["processAndSavePhoto", "getAbsolutePath", "getPhotoUrl", "validatePhotoIntegrity"].includes(member.name.getText(serviceSource))) serviceMethods.push(member.getText(serviceSource));
    }
  });
  const configs = new Map<string, any>();
  const assets = new Map<string, Buffer>();
  const operations: { name: string; cloud: string; publicId?: string }[] = [];
  const photos: any[] = [];
  const cloudinary = {
    config() { throw new Error("Global Cloudinary credentials must never be mutated"); },
    url(publicId: string, options: any) {
      return `https://res.cloudinary.com/${options.cloud_name}/image/upload/${publicId}.png`;
    },
    uploader: {
      upload_stream(options: any, callback: any) {
        operations.push({ name: "upload", cloud: options.cloud_name, publicId: options.public_id });
        return { end(buffer: Buffer) {
          if (options.cloud_name === "rejected-fixture") return callback(new Error("Cloudinary fixture rejected upload"));
          const url = `https://res.cloudinary.com/${options.cloud_name}/image/upload/v1/${options.public_id}.png`;
          assets.set(url, buffer);
          sharp(buffer).metadata().then(metadata => callback(null, {
            public_id: options.public_id, secure_url: url, bytes: buffer.length,
            width: metadata.width, height: metadata.height,
          }), callback);
        } };
      },
      async destroy(publicId: string, options: any) {
        operations.push({ name: "delete", cloud: options.cloud_name, publicId });
        return { result: "ok" };
      },
    },
    api: { async ping(options: any) {
      operations.push({ name: "ping", cloud: options.cloud_name });
      return { status: "ok" };
    } },
  };
  const columns = Object.fromEntries(["id", "loanId", "tenantId", "isActive"].map(name => [name, name]));
  const db = { select: () => ({ from: (table: any) => ({ where: async (predicate: any) => {
    if (table.name === "tenant") return configs.has(predicate.value) ? [configs.get(predicate.value)] : [];
    if (table.name === "system") return [];
    return photos.filter(photo => predicate.every((p: any) => photo[p.key] === p.value));
  } }) }) };
  const context = vm.createContext({
    fs, path, sharp, uuidv4: randomUUID, cloudinary, db, Buffer, URL, AbortSignal, Error,
    process: { cwd: () => root }, console: { log() {}, warn() {}, error() {} },
    providerCache: new Map(), CACHE_TTL: 300000,
    tenantStorageSettings: { name: "tenant", tenantId: "tenantId" },
    systemSettings: { name: "system", settingKey: "settingKey" }, loanPhotos: columns,
    eq: (key: string, value: any) => ({ key, value }), and: (...predicates: any[]) => predicates,
    fetch: async (url: URL) => assets.has(String(url))
      ? new Response(assets.get(String(url)), { headers: { "content-type": "image/png" } })
      : new Response(null, { status: 404 }),
  });
  const code = `${classes.join("\n")}
    class PhotoService {${serviceMethods.join("\n")}}
    ({LocalStorageProvider, CloudinaryStorageProvider, PhotoProviderResolver, PhotoStorageFactory, PhotoService});`;
  const api = vm.runInContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022 }), context);
  const routeSource = ts.createSourceFile("routes.ts", await fs.readFile("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let handlerText = "";
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "get" && node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "/api/loans/:loanId/photos/:photoId/image") {
      handlerText = node.arguments[node.arguments.length - 1].getText(routeSource);
    }
    ts.forEachChild(node, visit);
  }
  visit(routeSource);
  assert.ok(handlerText);
  const handler = vm.runInContext(ts.transpile(`(${handlerText})`, { target: ts.ScriptTarget.ES2022 }), context);
  async function media(photoId: string, tenantId = "tenant-A") {
    const response: any = {
      code: 200, body: undefined,
      set() { return this; }, type() { return this; },
      status(code: number) { this.code = code; return this; },
      sendStatus(code: number) { this.code = code; return this; },
      json(body: any) { this.body = body; return this; },
      send(body: any) { this.body = body; return this; },
      async sendFile(file: string) { this.body = await fs.readFile(file); return this; },
    };
    await handler({ params: { loanId: "loan-A", photoId }, session: { tenantId } }, response);
    return response;
  }
  const image = await sharp({ create: { width: 120, height: 180, channels: 3, background: "#7354ab" } }).png().toBuffer();
  const cloudConfig = (cloud: string) => ({
    provider: "cloudinary", storageProvider: "cloudinary", isConfigured: true,
    cloudinaryCloudName: cloud, cloudinaryApiKey: "fixture-only-key", cloudinaryApiSecret: "fixture-only-secret",
  });
  return { ...api, root, configs, operations, image, photos, media, cloudConfig };
}
test("no cloud account: real borrower image and thumbnail save locally, decode, fetch privately and delete", async t => {
  const f = await fixture(t);
  const photo = await f.PhotoService.processAndSavePhoto(f.image, "borrower.png", "tenant-A", "loan-A");
  assert.equal(photo.storageProvider, "local");
  const main = await fs.readFile(path.join(f.root, "server", photo.storagePath));
  const thumb = await sharp(path.join(f.root, "server", photo.thumbnailPath)).metadata();
  assert.equal((await sharp(main).metadata()).format, "png");
  assert.equal(thumb.width, 300);
  assert.equal(photo.size, main.length);
  f.photos.push({ ...photo, id: "person", loanId: "loan-A", tenantId: "tenant-A", isActive: true });
  assert.deepEqual((await f.media("person")).body, main);
  assert.equal((await f.media("person", "another-tenant")).code, 404);
  assert.equal((await f.media("missing")).code, 404);
  assert.equal((await f.PhotoService.validatePhotoIntegrity(photo.storagePath, "png")).isValid, true);
  const provider = await f.PhotoStorageFactory.getProvider("tenant-A");
  await provider.delete(photo.storagePath, photo.thumbnailPath);
  await assert.rejects(fs.access(path.join(f.root, "server", photo.storagePath)));
});
test("incomplete cloud settings produce a correctly labelled, retrievable local photo", async t => {
  const f = await fixture(t);
  f.configs.set("tenant-A", { isConfigured: true, storageProvider: "cloudinary" });
  const photo = await f.PhotoService.processAndSavePhoto(f.image, "borrower.png", "tenant-A", "loan-A");
  assert.equal(photo.storageProvider, "local");
  f.photos.push({ ...photo, id: "person", loanId: "loan-A", tenantId: "tenant-A", isActive: true });
  assert.equal((await f.media("person")).code, 200);
  assert.equal(f.operations.length, 0);
  // Older rows may have been labelled Cloudinary despite a local fallback.
  f.photos[0].storageProvider = "cloudinary";
  assert.equal((await f.media("person")).code, 200);
  assert.match(f.PhotoService.getPhotoUrl({ protocol: "https", get: () => "fixture.invalid" }, f.photos[0]), /^https:\/\/fixture.invalid\/uploads\/photos\//);
  const originalProvider = await f.PhotoProviderResolver.getProviderForPhoto(f.photos[0], "tenant-A");
  assert.ok(originalProvider instanceof f.LocalStorageProvider);
});
test("interleaved tenant uploads, thumbnail URLs, connection tests and deletion never share global credentials", async t => {
  const f = await fixture(t);
  f.configs.set("tenant-A", f.cloudConfig("cloud-a"));
  f.configs.set("tenant-B", f.cloudConfig("cloud-b"));
  for (const tenant of ["tenant-A", "tenant-B", "tenant-A"]) {
    const photo = await f.PhotoService.processAndSavePhoto(f.image, "borrower.png", tenant, "loan-A");
    const cloud = tenant === "tenant-A" ? "cloud-a" : "cloud-b";
    assert.equal(photo.storageProvider, "cloudinary");
    assert.ok(photo.storagePath.includes(`/${cloud}/`));
    assert.ok(photo.thumbnailPath.includes(`/${cloud}/`));
    f.photos.splice(0, f.photos.length, { ...photo, id: "person", loanId: "loan-A", tenantId: tenant, isActive: true });
    assert.equal((await f.media("person", tenant)).code, 200);
    if (tenant === "tenant-A") {
      assert.equal((await f.CloudinaryStorageProvider.testConnection(f.cloudConfig("cloud-b"))).success, true);
      await (await f.PhotoStorageFactory.getProvider(tenant)).delete(photo.storagePath);
    }
  }
  assert.deepEqual(f.operations.filter(op => op.name === "upload").map(op => op.cloud), ["cloud-a", "cloud-b", "cloud-a"]);
  assert.ok(f.operations.filter(op => op.name === "delete").every(op => op.cloud === "cloud-a"));
});
test("failed Cloudinary upload reports an error, never claims success or silently saves elsewhere", async t => {
  const f = await fixture(t);
  f.configs.set("tenant-A", f.cloudConfig("rejected-fixture"));
  await assert.rejects(f.PhotoService.processAndSavePhoto(f.image, "borrower.png", "tenant-A", "loan-A"), /rejected upload/);
  await assert.rejects(fs.access(path.join(f.root, "server", "uploads", "photos")));
});
test("phone EXIF orientation is applied to the saved portrait and real compressed size is returned", async t => {
  const f = await fixture(t);
  const rotated = await sharp({ create: { width: 60, height: 40, channels: 3, background: "#7354ab" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const photo = await f.PhotoService.processAndSavePhoto(rotated, "borrower.jpg", "tenant-A", "loan-A");
  assert.equal(photo.width, 40);
  assert.equal(photo.height, 60);
  const metadata = await sharp(path.join(f.root, "server", photo.storagePath)).metadata();
  assert.equal(metadata.orientation, undefined);
  assert.equal(photo.size, (await fs.stat(path.join(f.root, "server", photo.storagePath))).size);
});
test("local thumbnail failure cleans up only that new incomplete upload; corrupt input leaves no files", async t => {
  const f = await fixture(t);
  const provider = await f.PhotoStorageFactory.getProvider("tenant-A");
  provider.createThumbnail = async () => { throw new Error("fixture disk error"); };
  await assert.rejects(f.PhotoService.processAndSavePhoto(f.image, "borrower.png", "tenant-A", "loan-A"), /fixture disk error/);
  assert.deepEqual(await fs.readdir(path.join(f.root, "server", "uploads", "photos")), []);
  await assert.rejects(f.PhotoService.processAndSavePhoto(Buffer.from("broken image"), "borrower.png", "tenant-A", "loan-A"));
  assert.deepEqual(await fs.readdir(path.join(f.root, "server", "uploads", "photos")), []);
});
