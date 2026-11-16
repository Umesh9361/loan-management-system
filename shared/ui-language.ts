import english from "./ui-catalog.en.json";

export type UiLanguage = "mr" | "en";
let currentLanguage: UiLanguage = "mr";
try {
  if (typeof window !== "undefined" && window.localStorage.getItem("language") === "en") currentLanguage = "en";
} catch { /* Private-mode storage must not prevent login. */ }
export function getUiLanguage(): UiLanguage { return currentLanguage; }
export function setUiLanguage(language: UiLanguage) { currentLanguage = language; }
/** Only application-generated timeline labels; never customer names or stored dates. */
export function uiMonthLabel(value: unknown): string {
  const text = String(value ?? "");
  if (currentLanguage !== "en") return text;
  const months: Record<string, string> = {
    जानेवारी: "Jan", फेब्रुवारी: "Feb", मार्च: "Mar", एप्रिल: "Apr",
    मे: "May", जून: "Jun", जुलै: "Jul", ऑगस्ट: "Aug",
    सप्टेंबर: "Sep", ऑक्टोबर: "Oct", नोव्हेंबर: "Nov", डिसेंबर: "Dec",
  };
  const match = text.match(/^(\S+)\s+(\d{2}|\d{4})$/);
  return match && months[match[1]] ? `${months[match[1]]} ${match[2]}` : text;
}
export function normalizeUiText(text: string) { return text.replace(/\s+/g, " ").trim(); }
export function uiText(text: string, language = currentLanguage): string {
  if (language !== "en" || !text) return text;
  const key = normalizeUiText(text);
  const translated = (english as Record<string, string>)[key];
  if (translated === undefined) return text;
  const leading = text.match(/^\s*/)?.[0] || "";
  const trailing = text.match(/\s*$/)?.[0] || "";
  return leading + translated + trailing;
}
/** Translate only template-authored text, then substitute values unchanged. */
export function uiTemplate(strings: TemplateStringsArray, ...values: unknown[]): string {
  const source = strings.map((part, index) => part + (index < values.length ? `{#${index}}` : "")).join("");
  const protectedBlocks: string[] = [];
  const content = source.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, block => {
    const safeBlock = currentLanguage === "en" && /^<script/i.test(block)
      ? block.replace(/\b(alert|confirm|showDownloadNotification)\(\s*(['"])([^'"\r\n]*)\2/g,
        (_, name, _quote, message) => `${name}(${JSON.stringify(uiText(message))}`)
      : block;
    protectedBlocks.push(safeBlock); return `{!block${protectedBlocks.length - 1}}`;
  });
  const translated = content.split(/(<[^>]*>)/g).map(part =>
    part.startsWith("<") ? part.replace(/^<html\b([^>]*)>/i, (_, attrs) =>
      `<html${String(attrs).replace(/\s+lang=["'][^"']*["']/i, "")} lang="${currentLanguage === "en" ? "en" : "mr"}">`)
      .replace(/\b(alt|title|aria-label)="([^"]*)"/g,
      (_, name, value) => `${name}="${uiText(value)}"`) : uiText(part)).join("")
    .replace(/\{!block(\d+)\}/g, (_, index) => protectedBlocks[Number(index)]);
  return translated.replace(/\{#(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ""));
}
export function storedUiLanguage(): UiLanguage {
  try { return localStorage.getItem("language") === "en" ? "en" : "mr"; }
  catch { return "mr"; }
}
export function rememberUiLanguage(language: UiLanguage) {
  setUiLanguage(language);
  try { localStorage.setItem("language", language); } catch { /* Session still works. */ }
}
export function resolveUiPreference(saved: unknown, explicit: unknown, device: UiLanguage = "mr"): UiLanguage {
  if (explicit === "mr" || explicit === "en") return explicit;
  if (saved === "mr" || saved === "en") return saved;
  return device;
}
export function uiMessage<T>(value: T): T {
  return (typeof value === "string" ? uiText(value) : value) as T;
}
export function uiEnum<T>(value: T): T {
  if (currentLanguage !== "en" || typeof value !== "string") return value;
  const labels: Record<string, string> = {
    "तारण": "Secured", "विनातारण": "Unsecured",
    "सोने": "Gold", "चांदी": "Silver", gold: "Gold", silver: "Silver",
    active: "Active", closed: "Closed", monthly: "Monthly", yearly: "Yearly",
    cash_in: "Cash In", cash_out: "Cash Out",
  };
  return (labels[value] ?? value) as T;
}
/** Recognize only the application's standard financial grammar, never names/items. */
export function uiNarration<T>(value: T): T {
  if (currentLanguage !== "en" || typeof value !== "string") return value;
  const balance = value.match(/^(मागील शिल्लक पुढे|शिल्लक पुढे नेले|मागील शिल्लक|शिल्लक खाली)(?:\s*\((कमतरता|अधिक|डेबिट|क्रेडिट)\))?$/);
  if (balance) {
    const base = balance[1] === "शिल्लक खाली" ? "Balance C/D" :
      balance[1] === "शिल्लक पुढे नेले" ? "Balance C/F" : "Balance B/F";
    const suffix: Record<string, string> = { कमतरता: "Deficit", अधिक: "Surplus", डेबिट: "Dr.", क्रेडिट: "Cr." };
    return `${base}${balance[2] ? ` (${suffix[balance[2]]})` : ""}` as T;
  }
  if (["प्रारंभिक शिल्लक", "मागील शिल्लक", "शिल्लक पुढे नेले", "शिल्लक पुढे", "मागील शिल्लक पुढे", "कर्ज वाटप"].includes(value)) {
    return uiText(value) as T;
  }
  const match = value.match(/^(?:(जमा|नावे):\s*)?(कर्ज बंद|कर्ज वितरण)\s*-\s*खाते\s*क्र[.॰]?\s*(\S+)\s+(.+?)\s*-\s*मुद्दल:\s*₹([\d,]+(?:\.\d+)?)(?:\s*\+\s*व्याज:\s*₹([\d,]+(?:\.\d+)?))?(?:\s*·\s*कर्ज दिनांक:\s*(.*))?$/);
  if (!match) return value;
  const [, side, operation, account, name, principal, interest, loanDate] = match;
  return `${side ? (side === "जमा" ? "Receipt: " : "Payment: ") : ""}${operation === "कर्ज बंद" ? "Loan Closed" : "Loan Disbursement"} - Account No. ${account} ${name} - Principal: ₹${principal}${interest !== undefined ? ` + Interest: ₹${interest}` : ""}${loanDate !== undefined ? ` · Loan Dt.: ${loanDate === "उपलब्ध नाही" ? "Not available" : loanDate}` : ""}` as T;
}
