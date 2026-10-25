import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseLoanPhotoType, isPhotoOfType } from "../shared/loan-photo-types";
import { pledgeFormsDocument } from "../client/src/lib/pledge-forms";
import { loadPledgeLoanPhotos, selectPledgeCollateralPhotos, pledgeCollateralPhotoLabels } from "../client/src/lib/pledge-loan-photos";
import { photosToFormData } from "../client/src/lib/photo-utils";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
test("legacy item photos and borrower photos remain separate, with a backwards-compatible default", () => {
  assert.equal(parseLoanPhotoType(undefined), "collateral");
  assert.equal(parseLoanPhotoType("borrower"), "borrower");
  assert.equal(parseLoanPhotoType("unknown"), null);
  assert.equal(parseLoanPhotoType(["borrower"]), null);
  assert.equal(isPhotoOfType({}, "collateral"), true);
  assert.equal(isPhotoOfType({ photoType: "borrower" }, "collateral"), false);
  assert.equal(isPhotoOfType({ photoType: "collateral" }, "borrower"), false);
  assert.equal(photosToFormData([], "loan").get("photoType"), "collateral");
  assert.equal(photosToFormData([], "loan", "borrower").get("photoType"), "borrower");
});
test("starting form and declaration use borrower photo; repayment shows labelled item and borrower photos without stretching", () => {
  const data = { borrowerPhoto: png, collateralPhotos: [png, png] };
  assert.equal((pledgeFormsDocument(data, "loan").match(/<img /g) || []).length, 1);
  assert.equal((pledgeFormsDocument(data, "declaration").match(/<img /g) || []).length, 1);
  const receipt = pledgeFormsDocument(data, "receipt");
  assert.equal((receipt.match(/<img /g) || []).length, 3);
  assert.match(receipt, /तारण वस्तू 1/);
  assert.match(receipt, /तारण वस्तू 2/);
  assert.match(receipt, /object-fit:contain/);
  assert.doesNotMatch(pledgeFormsDocument({}, "all"), /<img /);
  assert.doesNotMatch(pledgeFormsDocument({ borrowerPhoto: 'https://evil.example/" onerror="alert(1)' }, "loan"), /<img /);
  assert.doesNotMatch(pledgeFormsDocument({ collateralPhotos: ["data:image/svg+xml;base64,bad"] }, "receipt"), /<img /);
});
test("loan-specific photo lookup embeds images; errors are explicit and empty accounts clear old photos", async () => {
  const oldFetch = globalThis.fetch;
  const oldReader = globalThis.FileReader;
  globalThis.FileReader = class {
    result = ""; onload?: () => void; onerror?: () => void;
    readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(bytes => {
      this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`; this.onload?.();
    }); }
  } as any;
  const calls: string[] = [];
  const images = [{ id: "item1", photoType: "collateral" }, { id: "customer1", photoType: "borrower" }, { id: "document1", photoType: "document" }];
  try {
    globalThis.fetch = (async (url: any, init: any) => {
      calls.push(String(url));
      assert.equal(init.credentials, "include");
      return String(url).endsWith("/image") ? new Response(new Blob(["png"], { type: "image/png" })) : Response.json(images);
    }) as typeof fetch;
    const result = await loadPledgeLoanPhotos("loan1");
    assert.match(result.borrowerPhoto, /^data:image\/png;base64,/);
    assert.equal(result.collateralPhotos.length, 1);
    assert.ok(calls.every(url => url.startsWith("/api/loans/loan1/photos")));
    assert.ok(!calls.some(url => url.includes("document1")));
    globalThis.fetch = (async () => Response.json([])) as typeof fetch;
    assert.deepEqual(await loadPledgeLoanPhotos("loan2"), { borrowerPhoto: "", collateralPhotos: [], collateralPhotoLabels: [] });
    globalThis.fetch = (async () => new Response("", { status: 403 })) as typeof fetch;
    await assert.rejects(loadPledgeLoanPhotos("another-tenant"), /फोटो मिळाले नाहीत/);
  } finally { globalThis.fetch = oldFetch; globalThis.FileReader = oldReader; }
});
test("any two saved item photos can be selected in order, never borrower/documents; printing none is allowed", () => {
  const photos = [{ id: "borrower", photoType: "borrower" }, ...["one", "two", "three"].map(id => ({ id, photoType: "collateral" })), { id: "doc", photoType: "document" }];
  assert.deepEqual(selectPledgeCollateralPhotos(photos).map(p => p.id), ["one", "two"]);
  assert.deepEqual(selectPledgeCollateralPhotos(photos, ["three", "one"]).map(p => p.id), ["three", "one"]);
  assert.deepEqual(pledgeCollateralPhotoLabels(photos, ["three", "one"]), ["वस्तूचा फोटो 3", "वस्तूचा फोटो 1"]);
  assert.deepEqual(selectPledgeCollateralPhotos(photos, []), []);
  for (const ids of [["one", "two", "three"], ["one", "one"], ["borrower"], ["doc"], ["unknown"]]) {
    assert.throws(() => selectPledgeCollateralPhotos(photos, ids));
  }
  const html = pledgeFormsDocument({ collateralPhotos: [png], collateralPhotoLabels: ["वस्तूचा फोटो 3"] }, "receipt");
  assert.match(html, /वस्तूचा फोटो 3/);
});
test("media stays authenticated/tenant-scoped, borrower uploads lock the existing loan, and closure deletion settings are preserved", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const media = routes.slice(routes.indexOf("app.get('/api/loans/:loanId/photos/:photoId/image'"), routes.indexOf("app.get('/api/loans/:loanId/photos',"));
  assert.match(media, /requireAuth/);
  assert.match(media, /loanOwnershipGuard/);
  assert.match(media, /eq\(loanPhotos.tenantId, req.session.tenantId!\)/);
  assert.match(media, /private, no-store/);
  assert.match(media, /res.cloudinary.com/);
  assert.match(media, /filename.startsWith\(root \+ path.sep\)/);
  assert.match(routes, /\.for\("update"\)/);
  assert.match(routes, /requestData.autoDeletePhotos && requestData.hasPhotos/);
});
