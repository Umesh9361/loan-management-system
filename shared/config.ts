// Professional Accounting Configuration
// Centralized settings for consistent accounting standards across all reports

export const ACCOUNTING_CONFIG = {
  // Professional accounting standard - business starts with 0 balance
  OPENING_BALANCE: 0,
  
  // Date format consistency for Indian locale
  DATE_FORMAT: 'DD/MM/YYYY',
  
  // Currency formatting
  CURRENCY_LOCALE: 'en-IN',
  CURRENCY_SYMBOL: '₹',
  
  // Professional accounting principles
  ACCOUNTING_PRINCIPLES: {
    // Use dual-entry accounting when enabled
    DUAL_ENTRY_ENABLED: true,
    
    // Cash book can be simple or dual-entry based
    SIMPLE_CASH_BOOK_MODE: true,
    
    // Always maintain data integrity
    ENFORCE_BALANCE_VERIFICATION: true,
    
    // Professional reporting standards
    PROFESSIONAL_FORMATTING: true
  }
} as const;

// Helper functions for consistent formatting
export class AccountingUtils {
  static formatCurrency(amount: number): string {
    return `${ACCOUNTING_CONFIG.CURRENCY_SYMBOL}${amount.toLocaleString(ACCOUNTING_CONFIG.CURRENCY_LOCALE)}`;
  }
  
  static formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  
  static getOpeningBalance(): number {
    return ACCOUNTING_CONFIG.OPENING_BALANCE;
  }
  
  static validateBalance(calculated: number, expected: number, tolerance: number = 0.01): boolean {
    return Math.abs(calculated - expected) <= tolerance;
  }
}