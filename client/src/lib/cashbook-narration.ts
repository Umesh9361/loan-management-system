import { displayNarration } from "./utils";

type CashbookDetails = {
  narration?: string | null;
  category?: string | null;
  transactionType?: string | null;
  loanDate?: string | null;
};

function formatLoanDate(value: string | null | undefined): string {
  // Parse a calendar date without converting it through the device timezone.
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) return "उपलब्ध नाही";
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) {
    return "उपलब्ध नाही";
  }
  return `${day}/${month}/${year}`;
}

/**
 * Read-only presentation shared by the mobile cashbook and Namuna 7.
 * Never save this string back to narration or use it for transaction identity.
 */
export function cashbookNarration(transaction: CashbookDetails): string {
  const narration = displayNarration(transaction.narration);
  const isClosure = transaction.transactionType === "cash_in" &&
    (transaction.category === "loan_repayment" ||
      transaction.category === "loan_closure");
  if (!isClosure) return narration;
  return `${narration}${narration ? " · " : ""}कर्ज दिनांक: ${formatLoanDate(transaction.loanDate)}`;
}

// HTML print/PDF routes interpolate descriptions into standalone documents.
// Keep borrower-entered text literal, including when the date is appended.
export function cashbookDescriptionHtml(description: string): string {
  return description.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;",
  })[character]!);
}
