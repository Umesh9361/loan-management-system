/**
 * Centralized loan sorting utilities for consistent ordering across all borrower list reports
 * Fixes the core issue where timestamp-based date comparison prevented account number sorting
 */

export interface LoanSortData {
  loanDate?: string;
  closureDate?: string;
  createdAt?: string;
  loanNumber?: string;
  accountNumber?: string;
  accountNo?: string;
  loanNo?: string;
  acNo?: string;
  account?: string;
  account_number?: string;
  borrowerName?: string;
  loanAmount?: string | number;
  principalAmount?: string | number;
  groupId?: string;
}

/**
 * Parse date strings in multiple formats and normalize to calendar day
 * Supports: ISO (YYYY-MM-DD), DD/MM/YYYY, DD/MM/YY formats
 * This ensures loans on the same calendar day are considered equal for date comparison
 */
function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try ISO format first (YYYY-MM-DD or full timestamp)
  if (dateStr.includes('-')) {
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }
  }
  
  // Try DD/MM/YYYY or DD/MM/YY format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      let year = parseInt(parts[2], 10);
      
      // Convert 2-digit year to 4-digit (25 -> 2025)
      if (year < 100) {
        year += 2000;
      }
      
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date;
      }
    }
  }
  
  return null;
}

/**
 * Normalize date to calendar day (remove time component)
 * This ensures loans on the same calendar day are considered equal for date comparison
 */
export function normalizeDateKey(primaryDate?: string, secondaryDate?: string): number {
  // Try primary date first
  if (primaryDate) {
    const date = parseFlexibleDate(primaryDate);
    if (date) {
      // Set to midnight to remove time component, ensuring same-day comparison works
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    }
  }
  
  // Try secondary date if primary fails
  if (secondaryDate) {
    const date = parseFlexibleDate(secondaryDate);
    if (date) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    }
  }
  
  // Return a large number to put invalid dates at the end
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Check if a value looks like a UUID pattern
 */
function isUuidLike(value: string | number): boolean {
  if (typeof value !== 'string') return false;
  // UUID pattern: 8-4-4-4-12 hexadecimal characters
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Extract account number from loan object checking multiple field aliases
 * Common field names: accountNumber, loanNumber, accountNo, loanNo, acNo, account, account_number
 */
function extractAccountNumber(loan: LoanSortData): string | number | undefined {
  // Check all possible account number fields in order of preference
  const accountFields = [
    loan.accountNumber,
    loan.loanNumber, 
    loan.accountNo,
    loan.loanNo,
    loan.acNo,
    loan.account,
    loan.account_number
  ];
  
  // Return the first non-empty, non-UUID value
  for (const field of accountFields) {
    if (field !== undefined && field !== null && field !== '') {
      // Skip UUID-like values (common in loanNumber field)
      if (!isUuidLike(field.toString())) {
        return field;
      }
    }
  }
  
  return undefined;
}

/**
 * Normalize account/loan number for numeric comparison
 * Handles Marathi digits (०-९), whitespace, and mixed alphanumeric codes
 */
export function normalizeAccountNumber(loan: LoanSortData): number {
  const accountNum = extractAccountNumber(loan);
  
  if (!accountNum) return Number.MAX_SAFE_INTEGER; // Put empty values at end
  
  let numStr = accountNum.toString().trim();
  
  // Convert Marathi digits to English digits
  const marathiToEnglish: { [key: string]: string } = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
  };
  
  for (const [marathi, english] of Object.entries(marathiToEnglish)) {
    numStr = numStr.replace(new RegExp(marathi, 'g'), english);
  }
  
  // Extract only digits
  const digitsOnly = numStr.replace(/\D/g, '');
  
  if (digitsOnly === '') {
    return Number.MAX_SAFE_INTEGER; // Put non-numeric values at end
  }
  
  return parseInt(digitsOnly, 10);
}

export interface SortOptions {
  dateOrder?: 'asc' | 'desc';
  sortByClosureDate?: boolean;
}

/**
 * Centralized loan comparator for consistent sorting across all borrower list tabs
 * Order: Calendar Day → Account Number → Borrower Name → Loan Amount
 * Supports selective date ordering while keeping other tiers ascending
 */
export function createLoanComparator(groups?: any[], options: SortOptions = {}) {
  const { dateOrder = 'asc', sortByClosureDate = false } = options; // Default to oldest dates first
  
  return (a: LoanSortData, b: LoanSortData): number => {
    // 1. Sort by Calendar Day (with selective ordering)
    // When sortByClosureDate is on, use the closure date as the primary key
    // (falling back to loan date when a closure date is missing).
    const aDateKey = sortByClosureDate
      ? normalizeDateKey(a.closureDate, a.loanDate)
      : normalizeDateKey(a.loanDate, a.createdAt);
    const bDateKey = sortByClosureDate
      ? normalizeDateKey(b.closureDate, b.loanDate)
      : normalizeDateKey(b.loanDate, b.createdAt);
    if (aDateKey !== bDateKey) {
      const dateComparison = aDateKey - bDateKey;
      return dateOrder === 'desc' ? -dateComparison : dateComparison;
    }
    
    // 2. Sort by Account Number (always ascending within same date) - REMOVED GROUP TIEBREAKER
    const aAccountNum = normalizeAccountNumber(a);
    const bAccountNum = normalizeAccountNumber(b);
    if (aAccountNum !== bAccountNum) {
      return aAccountNum - bAccountNum;
    }
    
    // 3. Sort by Borrower Name (always ascending within same date)
    const aBorrowerName = a.borrowerName || '';
    const bBorrowerName = b.borrowerName || '';
    if (aBorrowerName !== bBorrowerName) {
      return aBorrowerName.localeCompare(bBorrowerName, 'mr-IN', { numeric: true });
    }
    
    // 4. Sort by Loan Amount (always ascending within same date)
    const aAmount = parseFloat((a.loanAmount || a.principalAmount || 0).toString());
    const bAmount = parseFloat((b.loanAmount || b.principalAmount || 0).toString());
    return aAmount - bAmount;
  };
}

/**
 * Apply consistent sorting to loan array
 */
export function sortLoans(loans: LoanSortData[], groups?: any[], options: SortOptions = {}): LoanSortData[] {
  return [...loans].sort(createLoanComparator(groups, options));
}