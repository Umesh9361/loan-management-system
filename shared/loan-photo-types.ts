export type LoanPhotoType = "collateral" | "borrower";
export function parseLoanPhotoType(value: unknown): LoanPhotoType | null {
  if (value === undefined || value === "collateral") return "collateral";
  return value === "borrower" ? "borrower" : null;
}
/** Old unclassified/document pictures stay in the existing item gallery. */
export function isPhotoOfType(photo: { photoType?: string | null }, type: LoanPhotoType) {
  return type === "borrower" ? photo.photoType === "borrower" : photo.photoType !== "borrower";
}
