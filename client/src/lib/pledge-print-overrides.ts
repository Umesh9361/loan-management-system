import type { PledgeFormData } from "@shared/pledge-form-editor";

/** Local form state only: these edits must never update the original loan. */
export function applyPledgePrintPatch(previous: PledgeFormData, patch: Partial<PledgeFormData>): PledgeFormData {
  const next = { ...previous, ...patch };
  const components = ["receiptPrincipal", "receiptInterest", "receiptFees"] as const;
  if (components.some(key => Object.prototype.hasOwnProperty.call(patch, key)) &&
      !Object.prototype.hasOwnProperty.call(patch, "receiptTotal")) {
    const values = components.map(key => {
      const text = (next[key] || "").replace(/[०-९]/g, digit => String(digit.charCodeAt(0) - 0x966)).replace(/,/g, "").trim();
      return text === "" ? 0 : /^\d+(?:\.\d*)?$/.test(text) ? Number(text) : NaN;
    });
    // Do not silently print an outdated total while a component is invalid.
    next.receiptTotal = values.every(Number.isFinite)
      ? String(Number(values.reduce((sum, value) => sum + value, 0).toFixed(2))) : "";
  }
  return next;
}
