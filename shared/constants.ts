// Account Management Constants for Cash Transaction System
// Professional Accounting Standards Implementation

export const ACCOUNT_TYPES = {
  // Primary cash account
  CASH: 'Cash',
  
  // External sources and destinations  
  EXTERNAL: 'External',
  
  // Customer/borrower accounts
  CUSTOMER: 'Customer',
  
  // Party accounts (individuals)
  PARTY: 'Party',
  
  // Bank related
  BANK: 'Bank',
  
  // Business accounts
  BUSINESS: 'Business',
  
  // Capital account
  CAPITAL: 'Capital'
} as const;

export const TRANSACTION_SOURCES = {
  // Cash IN sources (जमा बाजू)
  CASH_IN: {
    PARTY_PAYMENT: 'Party',        // Party कडून payment
    EXTERNAL_INCOME: 'External',   // External income sources
    LOAN_REPAYMENT: 'Customer',    // Loan repayment
    BANK_WITHDRAWAL: 'Bank',       // Bank withdrawal
    CAPITAL_INVESTMENT: 'Capital', // Capital investment
    BUSINESS_INCOME: 'Business'    // Business income
  },
  
  // Cash OUT destinations (नावे बाजू)  
  CASH_OUT: {
    PARTY_PAYMENT: 'Party',        // Party ला payment
    EXTERNAL_EXPENSE: 'External',  // External expenses
    LOAN_DISBURSEMENT: 'Customer', // Loan disbursement
    BANK_DEPOSIT: 'Bank',          // Bank deposit
    CAPITAL_WITHDRAWAL: 'Capital', // Capital withdrawal
    BUSINESS_EXPENSE: 'Business'   // Business expenses
  }
} as const;

export const CASH_CATEGORIES = {
  // Income categories
  INCOME: {
    LOAN_REPAYMENT: 'कर्ज परतफेड',
    BUSINESS_INCOME: 'व्यापारी कमाई', 
    PERSONAL_LOAN: 'वैयक्तिक उसने',
    CAPITAL_INVESTMENT: 'भांडवल गुंतवणूक',
    OTHER_INCOME: 'इतर कमाई'
  },
  
  // Expense categories
  EXPENSE: {
    LOAN_DISBURSEMENT: 'कर्ज वितरण',
    BUSINESS_EXPENSE: 'व्यापारी खर्च',
    PERSONAL_LOAN: 'वैयक्तिक उसने',
    OFFICE_EXPENSE: 'कार्यालयीन खर्च',
    OTHER_EXPENSE: 'इतर खर्च'
  }
} as const;

// Helper functions for account determination
export function getCashInAccount(hasParty: boolean, category: string): string {
  if (hasParty) {
    return ACCOUNT_TYPES.PARTY;
  }
  
  // Determine source based on category
  switch (category) {
    case CASH_CATEGORIES.INCOME.LOAN_REPAYMENT:
      return TRANSACTION_SOURCES.CASH_IN.LOAN_REPAYMENT;
    case CASH_CATEGORIES.INCOME.BUSINESS_INCOME:
      return TRANSACTION_SOURCES.CASH_IN.BUSINESS_INCOME;
    case CASH_CATEGORIES.INCOME.CAPITAL_INVESTMENT:
      return TRANSACTION_SOURCES.CASH_IN.CAPITAL_INVESTMENT;
    default:
      return TRANSACTION_SOURCES.CASH_IN.EXTERNAL_INCOME;
  }
}

export function getCashOutAccount(hasParty: boolean, category: string): string {
  if (hasParty) {
    return ACCOUNT_TYPES.PARTY;
  }
  
  // Determine destination based on category
  switch (category) {
    case CASH_CATEGORIES.EXPENSE.LOAN_DISBURSEMENT:
      return TRANSACTION_SOURCES.CASH_OUT.LOAN_DISBURSEMENT;
    case CASH_CATEGORIES.EXPENSE.BUSINESS_EXPENSE:
      return TRANSACTION_SOURCES.CASH_OUT.BUSINESS_EXPENSE;
    case CASH_CATEGORIES.EXPENSE.OFFICE_EXPENSE:
      return TRANSACTION_SOURCES.CASH_OUT.BUSINESS_EXPENSE;
    default:
      return TRANSACTION_SOURCES.CASH_OUT.EXTERNAL_EXPENSE;
  }
}

// Account name validation
export function validateAccountName(accountName: string): boolean {
  const validAccounts = Object.values(ACCOUNT_TYPES);
  return validAccounts.includes(accountName as any);
}

// Professional account mapping for reports
export const ACCOUNT_DISPLAY_NAMES = {
  [ACCOUNT_TYPES.CASH]: 'रोकड खाते',
  [ACCOUNT_TYPES.EXTERNAL]: 'बाह्य व्यवहार',
  [ACCOUNT_TYPES.CUSTOMER]: 'ग्राहक खाते', 
  [ACCOUNT_TYPES.PARTY]: 'पार्टी खाते',
  [ACCOUNT_TYPES.BANK]: 'बँक खाते',
  [ACCOUNT_TYPES.BUSINESS]: 'व्यापार खाते',
  [ACCOUNT_TYPES.CAPITAL]: 'भांडवल खाते'
} as const;