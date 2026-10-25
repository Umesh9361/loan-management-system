import type { PledgeFormData } from "@shared/pledge-form-editor";

type StoredValue = string | number | null;
export type PledgeLoanRecord = {
  id: string;
  accountNumber: string;
  borrowerName: string;
  borrowerAddress?: string | null;
  borrowerMobile?: string | null;
  principalAmount?: StoredValue;
  loanDate?: string | null;
  maturityDate?: string | null;
  calculatedMaturityDate?: string | null;
  hasMaturity?: boolean;
  interestRate?: StoredValue;
  interestRateType?: string | null;
  collateralDetails?: string | null;
  weight?: StoredValue;
  purity?: StoredValue;
  marketValue?: StoredValue;
  status?: string;
  group?: { name?: string } | null;
};
export type PledgeClosureRecord = {
  loanId: string;
  isClosed?: boolean;
  closureDate?: string | null;
  createdAt?: string | null;
  principalPaid?: StoredValue;
  interestPaid?: StoredValue;
  totalAmount?: StoredValue;
  actualPaidAmount?: StoredValue;
};

const text = (value: StoredValue | undefined) => value == null ? "" : String(value);
const date = (value?: string | null) => value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";

/** Exact account numbers precede partial/name matches; never auto-select a result. */
export function sortPledgeLoanMatches(loans: PledgeLoanRecord[], query: string) {
  const exact = query.trim().toLowerCase();
  return [...loans].sort((a, b) =>
    Number(b.accountNumber.toLowerCase() === exact) - Number(a.accountNumber.toLowerCase() === exact));
}

export function latestPledgeClosure(loanId: string, closures: PledgeClosureRecord[]) {
  return closures.filter(row => row.loanId === loanId && row.isClosed === true)
    .sort((a, b) => (b.closureDate || "").localeCompare(a.closureDate || "") ||
      (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
}

/** Copies recorded facts only: no calculated interest, invented notice dates or sale data. */
export function mapLoanToPledgeForm(loan: PledgeLoanRecord, closure?: PledgeClosureRecord): PledgeFormData {
  const data: PledgeFormData = {
    borrowerName: loan.borrowerName,
    borrowerAddress: loan.borrowerAddress || "",
    borrowerMobile: loan.borrowerMobile || "",
    accountNumber: loan.accountNumber,
    principalAmount: text(loan.principalAmount),
    loanDate: date(loan.loanDate),
    interestRate: text(loan.interestRate),
    ratePeriod: loan.interestRateType === "monthly" ? "मासिक" : loan.interestRateType === "yearly" ? "वार्षिक" : "",
    repaymentDate: loan.hasMaturity ? date(loan.calculatedMaturityDate) || date(loan.maturityDate) : "",
    loanItems: [{
      description: loan.collateralDetails || "",
      purity: text(loan.purity),
      weight: text(loan.weight),
      value: text(loan.marketValue),
    }],
  };
  // Only a recorded, current closure of this exact loan can populate received money.
  if (loan.status === "closed" && closure?.loanId === loan.id && closure.isClosed === true) {
    data.receiptPrincipal = text(closure.principalPaid);
    data.receiptInterest = text(closure.interestPaid);
    data.receiptTotal = text(closure.actualPaidAmount ?? closure.totalAmount);
    data.printDate = date(closure.closureDate);
  }
  return data;
}
