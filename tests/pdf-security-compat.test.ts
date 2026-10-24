import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import sharp from "sharp";
import { generateTextBasedReceiptPDF } from "../client/src/lib/pdf-text-generator";

test("patched PDF library retains embedded Devanagari receipts for every receipt type", () => {
  for (const receiptType of ["combined", "disbursement", "closure", "blank"] as const) {
    const doc = generateTextBasedReceiptPDF({
      companyName: "चाचणी संस्था", licenseNumber: "TEST", borrowerName: "चाचणी कर्जदार",
      address: "चाचणी", loanNumber: "TEST-1", loanDate: "24/10/2026",
      principal: "10000", interestRate: "12", collateralDetails: "सोने",
      collateralWeight: "488.73", collateralValue: "20000",
      closureDate: "24/10/2026", closurePrincipal: "10000", closureInterest: "100",
      closureTotal: "10100", closureTotalWords: "चाचणी", receiptType,
    });
    assert.ok(doc.getFontList().NotoDevanagari?.includes("normal"));
    const pdf = doc.output();
    assert.ok(pdf.startsWith("%PDF-"));
    assert.ok(pdf.includes("/FontFile2"), "embedded font must be retained");
    assert.ok(pdf.includes("%%EOF"));
  }
});

test("A4 tables, legacy autoTable calls and thermal image output remain supported", async () => {
  applyPlugin(jsPDF);
  const doc = new jsPDF();
  (doc as any).autoTable({ head: [["Account", "Amount", "Weight"]],
    body: [["TEST", "10000", "488.73"]], foot: [["TOTAL", "10000", "488.73"]] });
  assert.match(doc.output(), /488\.73/);
  const thermal = new jsPDF({ unit: "mm", format: [80, 150] });
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#ffffff" } }).png().toBuffer();
  thermal.addImage(new Uint8Array(png), "PNG", 5, 5, 30, 30);
  assert.ok(Math.abs(thermal.internal.pageSize.getWidth() - 80) < 0.01);
  assert.ok(thermal.output("arraybuffer").byteLength > 1000);
});

test("PDF Node local filesystem reads are disabled by default", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "pdf-fs-security-"));
  try {
    const filename = path.join(dir, "synthetic.txt");
    await writeFile(filename, "synthetic test content, not a real secret");
    const doc = new jsPDF();
    assert.throws(() => doc.loadFile(filename), /file system|filesystem|allowFsRead|permission/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("external deployment lockfile has no internal package service URLs", async () => {
  const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
  for (const [name, pkg] of Object.entries(lock.packages) as [string, { resolved?: string; integrity?: string }][]) {
    if (!pkg.resolved) continue;
    const url = new URL(pkg.resolved);
    assert.equal(url.protocol, "https:", `${name} requires HTTPS`);
    assert.ok(!url.hostname.endsWith(".internal"), `${name} cannot use an internal registry`);
    assert.ok(pkg.integrity, `${name} must keep its integrity hash`);
  }
});
