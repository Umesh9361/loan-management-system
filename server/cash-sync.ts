// CRITICAL FIX: Completely disabled cash-sync to prevent duplicate generation
// All loan disbursements and closures are handled through unified-transaction-sync.ts

// ACCOUNT_TYPES not needed in disabled cash-sync module

// Helper function for date formatting
const formatDateForDB = (date: string | Date): string => {
  if (!date) return new Date().toISOString().split('T')[0];
  
  if (typeof date === 'string') {
    if (date.includes('/')) {
      const [day, month, year] = date.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return date.split('T')[0];
  }
  
  return date.toISOString().split('T')[0];
};

// DISABLED: No cash transactions created from this module
const syncLoanDisbursement = async (loanId: string, tenantId: string) => {
  // Cash sync disabled - using unified system
  // All loan operations handled by unified-transaction-sync.ts
  return;
};

// DISABLED: No cash transactions created from this module  
const syncLoanClosure = async (loanId: string, closureData: any, tenantId: string) => {
  // Cash sync disabled - using unified system
  // All loan operations handled by unified-transaction-sync.ts
  return;
};

// DISABLED: No cash transactions created from this module
const syncLoanReopen = async (loanId: string, tenantId: string) => {
  // Cash sync disabled - using unified system
  // All loan operations handled by unified-transaction-sync.ts
  return;
};

export { syncLoanDisbursement, syncLoanClosure, syncLoanReopen };