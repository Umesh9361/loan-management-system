import test from "node:test";
import assert from "node:assert/strict";
import { createReceiptSettingsStore, parseReceiptSettings, RECEIPT_SETTINGS_KEY } from "../client/src/lib/receipt-print-settings";

function fixture(initial: string | null = null) {
  let value = initial;
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    removeItem: () => { value = null; },
  };
  const events = new EventTarget();
  return { storage, events, store: createReceiptSettingsStore(storage, events) };
}

test("old saved settings preserve custom values, QR, and fill missing fields", () => {
  const settings = parseReceiptSettings(JSON.stringify({ standard: { name: { fontSize: 19, bold: false } }, thermal: { colAccount: { fontSize: 33, bold: false }, showQrCode: true } }));
  assert.deepEqual(settings.standard.name, { fontSize: 19, bold: false });
  assert.deepEqual(settings.thermal.colAccount, { fontSize: 33, bold: false });
  assert.equal(settings.thermal.showQrCode, true);
  assert.equal(settings.thermal.grandTotal.fontSize, 32);
  assert.equal(Object.keys(settings.standard).length, 7);
  assert.equal(Object.keys(settings.thermal).length, 19);
});
test("corrupt preferences and out-of-range sizes cannot break print rendering", () => {
  for (const raw of ["bad json", "null", "[]"]) assert.equal(parseReceiptSettings(raw).standard.name.fontSize, 13);
  const settings = parseReceiptSettings('{"thermal":{"name":{"fontSize":900,"bold":"false"},"date":{"fontSize":-2}}}');
  assert.equal(settings.thermal.name.fontSize, 50);
  assert.equal(settings.thermal.date.fontSize, 6);
  assert.equal(settings.thermal.name.bold, true);
});
test("sidebar and closure share updates immediately, persist after reload and reset together", () => {
  const { store, storage, events } = fixture();
  const other = createReceiptSettingsStore(storage, events);
  let notified = 0;
  const unsubscribe = other.subscribe(() => notified++);
  const original = store.getSnapshot();
  assert.equal(original, store.getSnapshot(), "snapshot must be stable for useSyncExternalStore");
  store.update(previous => ({ ...previous, thermal: { ...previous.thermal, showQrCode: true, name: { fontSize: 31, bold: false } } }));
  assert.equal(notified, 1);
  assert.equal(other.getSnapshot().thermal.name.fontSize, 31);
  assert.equal(other.getSnapshot().thermal.showQrCode, true);
  assert.equal(original.thermal.name.fontSize, 26);
  assert.equal(createReceiptSettingsStore(storage, new EventTarget()).getSnapshot().thermal.name.fontSize, 31);
  other.reset();
  assert.equal(store.getSnapshot().thermal.name.fontSize, 26);
  assert.equal(store.getSnapshot().thermal.showQrCode, false);
  assert.equal(notified, 2);
  unsubscribe();
  store.reset();
  assert.equal(notified, 2);
});
test("cross-tab storage updates notify only for this key or browser storage clear", () => {
  const { store, storage, events } = fixture();
  let count = 0;
  store.subscribe(() => count++);
  const emit = (key: string | null) => {
    const event = new Event("storage");
    Object.defineProperty(event, "key", { value: key });
    events.dispatchEvent(event);
  };
  emit("other-setting");
  assert.equal(count, 0);
  storage.setItem(RECEIPT_SETTINGS_KEY, '{"standard":{"name":{"fontSize":28,"bold":false}}}');
  emit(RECEIPT_SETTINGS_KEY);
  assert.equal(count, 1);
  assert.equal(store.getSnapshot().standard.name.fontSize, 28);
  storage.removeItem();
  emit(null);
  assert.equal(count, 2);
  assert.equal(store.getSnapshot().standard.name.fontSize, 13);
});
test("failed saves/resets do not announce successful changes or corrupt cached snapshot", () => {
  const events = new EventTarget();
  const store = createReceiptSettingsStore({
    getItem: () => null,
    setItem: () => { throw new Error("storage full"); },
    removeItem: () => { throw new Error("storage blocked"); },
  }, events);
  let count = 0;
  store.subscribe(() => count++);
  const before = store.getSnapshot();
  assert.throws(() => store.update(previous => ({ ...previous, thermal: { ...previous.thermal, showQrCode: true } })), /storage full/);
  assert.throws(store.reset, /storage blocked/);
  assert.equal(count, 0);
  assert.equal(store.getSnapshot(), before);
});
