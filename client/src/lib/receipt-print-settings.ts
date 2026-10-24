export interface ReceiptFieldSetting { fontSize: number; bold: boolean }
export interface ReceiptPrintSettings {
  standard: Record<"name" | "date" | "title" | "tableHeader" | "tableData" | "total" | "grandTotal", ReceiptFieldSetting>;
  thermal: Record<"name" | "date" | "title" | "colSerial" | "colAccount" | "colDate" | "colRate" | "colDetails" | "colMonths" | "colPrincipal" | "colCharges" | "hdrSerial" | "hdrAccount" | "hdrDate" | "hdrPrincipal" | "hdrCharges" | "total" | "grandTotal", ReceiptFieldSetting> & { showQrCode?: boolean };
}
export const RECEIPT_SETTINGS_KEY = "lms_receipt_print_settings";
const CHANGE_EVENT = "receipt-print-settings-changed";
export const DEFAULT_RECEIPT_SETTINGS: ReceiptPrintSettings = {
  standard: {
    name: { fontSize: 13, bold: true }, date: { fontSize: 12, bold: true },
    title: { fontSize: 13, bold: true }, tableHeader: { fontSize: 12, bold: true },
    tableData: { fontSize: 12, bold: true }, total: { fontSize: 12, bold: true },
    grandTotal: { fontSize: 13, bold: true },
  },
  thermal: {
    name: { fontSize: 26, bold: true }, date: { fontSize: 22, bold: true },
    title: { fontSize: 24, bold: true }, colSerial: { fontSize: 16, bold: true },
    colAccount: { fontSize: 22, bold: true }, colDate: { fontSize: 22, bold: true },
    colRate: { fontSize: 20, bold: true }, colDetails: { fontSize: 18, bold: false },
    colMonths: { fontSize: 18, bold: false }, colPrincipal: { fontSize: 22, bold: true },
    colCharges: { fontSize: 22, bold: true }, hdrSerial: { fontSize: 22, bold: true },
    hdrAccount: { fontSize: 22, bold: true }, hdrDate: { fontSize: 22, bold: true },
    hdrPrincipal: { fontSize: 22, bold: true }, hdrCharges: { fontSize: 22, bold: true },
    total: { fontSize: 22, bold: true }, grandTotal: { fontSize: 32, bold: true },
  },
};

export function parseReceiptSettings(raw: string | null): ReceiptPrintSettings {
  let parsed: any = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch { /* Recover corrupt old preferences. */ }
  const result = { standard: {}, thermal: {} } as ReceiptPrintSettings;
  for (const mode of ["standard", "thermal"] as const) {
    for (const [key, fallback] of Object.entries(DEFAULT_RECEIPT_SETTINGS[mode])) {
      const saved = parsed?.[mode]?.[key];
      (result[mode] as any)[key] = {
        fontSize: typeof saved?.fontSize === "number" && Number.isFinite(saved.fontSize)
          ? Math.min(50, Math.max(6, saved.fontSize)) : (fallback as ReceiptFieldSetting).fontSize,
        bold: typeof saved?.bold === "boolean" ? saved.bold : (fallback as ReceiptFieldSetting).bold,
      };
    }
  }
  result.thermal.showQrCode = parsed?.thermal?.showQrCode === true;
  return result;
}

type SettingsStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function createReceiptSettingsStore(storage: SettingsStorage, events: EventTarget) {
  let previousRaw: string | null | undefined;
  let snapshot = DEFAULT_RECEIPT_SETTINGS;
  const getSnapshot = () => {
    let raw: string | null;
    try { raw = storage.getItem(RECEIPT_SETTINGS_KEY); } catch { return snapshot; }
    if (raw !== previousRaw) {
      previousRaw = raw;
      snapshot = parseReceiptSettings(raw);
    }
    return snapshot;
  };
  const subscribe = (listener: () => void) => {
    const onStorage = (event: Event) => {
      const key = (event as StorageEvent).key;
      if (key === RECEIPT_SETTINGS_KEY || key === null) listener();
    };
    events.addEventListener(CHANGE_EVENT, listener);
    events.addEventListener("storage", onStorage);
    return () => {
      events.removeEventListener(CHANGE_EVENT, listener);
      events.removeEventListener("storage", onStorage);
    };
  };
  const update = (updater: (previous: ReceiptPrintSettings) => ReceiptPrintSettings) => {
    const next = parseReceiptSettings(JSON.stringify(updater(getSnapshot())));
    // Do not announce success or update the snapshot if persistence fails.
    storage.setItem(RECEIPT_SETTINGS_KEY, JSON.stringify(next));
    events.dispatchEvent(new Event(CHANGE_EVENT));
  };
  const reset = () => {
    storage.removeItem(RECEIPT_SETTINGS_KEY);
    events.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return { getSnapshot, subscribe, update, reset };
}

export const receiptSettingsStore = createReceiptSettingsStore({
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: key => window.localStorage.removeItem(key),
}, typeof window !== "undefined" ? window : new EventTarget());
