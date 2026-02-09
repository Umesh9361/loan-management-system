/**
 * Professional Cash Balance Engine
 * Real-time balance calculation with bulletproof carry forward logic
 * Handles all transaction modifications, deletions, and data integrity
 */

export interface TransactionRecord {
  id: string;
  date: Date;
  type: 'cash' | 'loan';
  subType: 'in' | 'out' | 'disbursement' | 'closure';
  amount: number;
  description: string;
  partyName?: string;
  groupName?: string;
  loanId?: string;
  transactionId?: string;
  originalData: any;
}

export interface BalanceSnapshot {
  date: Date;
  openingBalance: number;
  closingBalance: number;
  totalIn: number;
  totalOut: number;
  netMovement: number;
  transactionCount: number;
  isValid: boolean;
}

export class CashBalanceEngine {
  private transactions: TransactionRecord[] = [];
  private balanceSnapshots: Map<string, BalanceSnapshot> = new Map();

  constructor(cashTransactions: any[], loans: any[]) {
    this.processAllTransactions(cashTransactions, loans);
  }

  /**
   * Process all transactions chronologically for accurate balance calculation
   */
  private processAllTransactions(cashTransactions: any[], loans: any[]) {
    this.transactions = [];

    // Process cash transactions with validation
    if (Array.isArray(cashTransactions)) {
      cashTransactions.forEach((transaction: any) => {
        if (!this.isValidTransaction(transaction)) return;
        
        this.transactions.push({
          id: transaction.id || `cash_${Date.now()}_${Math.random()}`,
          date: new Date(transaction.date || transaction.transactionDate),
          type: 'cash',
          subType: transaction.type === 'in' || transaction.transactionType === 'cash_in' ? 'in' : 'out',
          amount: Number(transaction.amount) || 0,
          description: transaction.description || transaction.narration || 'रोकड व्यवहार',
          partyName: transaction.partyName || transaction.party?.name || 'अज्ञात',
          transactionId: transaction.id,
          originalData: transaction
        });
      });
    }

    // Process loan transactions with validation
    if (Array.isArray(loans)) {
      loans.forEach((loan: any) => {
        if (!this.isValidLoan(loan)) return;
        
        const loanAmount = Number(loan.amount) || 0;
        const interest = Number(loan.interest) || 0;
        
        // Loan disbursement (cash out)
        this.transactions.push({
          id: `loan_disbursement_${loan.id}`,
          date: new Date(loan.createdAt || loan.date),
          type: 'loan',
          subType: 'disbursement',
          amount: loanAmount,
          description: `कर्ज वितरण (खाते क्र. ${loan.id} ${loan.borrowerName})`,
          groupName: loan.groupName || '',
          loanId: loan.id,
          originalData: loan
        });

        // Loan closure (cash in) - only if actually closed
        if (loan.status === 'closed' && loan.closedAt) {
          const totalRepayment = loanAmount + interest;
          this.transactions.push({
            id: `loan_closure_${loan.id}`,
            date: new Date(loan.closedAt),
            type: 'loan',
            subType: 'closure',
            amount: totalRepayment,
            description: `कर्ज जमा (खाते क्र. ${loan.id} ${loan.borrowerName} मुद्दल: ₹${loanAmount.toLocaleString('hi-IN')} व्याज: ₹${interest.toLocaleString('hi-IN')})`,
            groupName: loan.groupName || '',
            loanId: loan.id,
            originalData: loan
          });
        }
      });
    }

    // Sort all transactions chronologically for accurate carry forward
    this.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Generate balance snapshots for quick access
    this.generateBalanceSnapshots();
  }

  /**
   * Validate transaction data integrity
   */
  private isValidTransaction(transaction: any): boolean {
    return transaction && 
           (transaction.date || transaction.transactionDate) && 
           !isNaN(Number(transaction.amount)) && 
           Number(transaction.amount) > 0;
  }

  /**
   * Validate loan data integrity
   */
  private isValidLoan(loan: any): boolean {
    return loan && 
           (loan.createdAt || loan.date) && 
           !isNaN(Number(loan.amount)) && 
           Number(loan.amount) > 0;
  }

  /**
   * Generate balance snapshots for efficient querying
   */
  private generateBalanceSnapshots() {
    this.balanceSnapshots.clear();
    let runningBalance = 0;

    this.transactions.forEach((transaction, index) => {
      const dateKey = transaction.date.toISOString().split('T')[0];
      
      // Calculate balance change
      let balanceChange = 0;
      if (transaction.type === 'cash') {
        balanceChange = transaction.subType === 'in' ? transaction.amount : -transaction.amount;
      } else if (transaction.type === 'loan') {
        balanceChange = transaction.subType === 'disbursement' ? -transaction.amount : transaction.amount;
      }

      runningBalance += balanceChange;

      // Update or create snapshot for this date
      const existing = this.balanceSnapshots.get(dateKey);
      if (existing) {
        existing.closingBalance = runningBalance;
        existing.transactionCount++;
        if (balanceChange > 0) {
          existing.totalIn += Math.abs(balanceChange);
        } else {
          existing.totalOut += Math.abs(balanceChange);
        }
        existing.netMovement = existing.totalIn - existing.totalOut;
      } else {
        this.balanceSnapshots.set(dateKey, {
          date: transaction.date,
          openingBalance: runningBalance - balanceChange,
          closingBalance: runningBalance,
          totalIn: balanceChange > 0 ? Math.abs(balanceChange) : 0,
          totalOut: balanceChange < 0 ? Math.abs(balanceChange) : 0,
          netMovement: balanceChange,
          transactionCount: 1,
          isValid: true
        });
      }
    });
  }

  /**
   * Get opening balance for a specific date
   */
  getOpeningBalance(date: Date): number {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    let balance = 0;
    
    this.transactions.forEach(transaction => {
      if (transaction.date < targetDate) {
        if (transaction.type === 'cash') {
          balance += transaction.subType === 'in' ? transaction.amount : -transaction.amount;
        } else if (transaction.type === 'loan') {
          balance += transaction.subType === 'disbursement' ? -transaction.amount : transaction.amount;
        }
      }
    });

    return balance;
  }

  /**
   * Get closing balance for a specific date
   */
  getClosingBalance(date: Date): number {
    const targetDate = new Date(date);
    targetDate.setHours(23, 59, 59, 999);
    
    let balance = 0;
    
    this.transactions.forEach(transaction => {
      if (transaction.date <= targetDate) {
        if (transaction.type === 'cash') {
          balance += transaction.subType === 'in' ? transaction.amount : -transaction.amount;
        } else if (transaction.type === 'loan') {
          balance += transaction.subType === 'disbursement' ? -transaction.amount : transaction.amount;
        }
      }
    });

    return balance;
  }

  /**
   * Get transactions for a date range
   */
  getTransactionsForRange(fromDate: Date, toDate: Date): TransactionRecord[] {
    return this.transactions.filter(transaction => 
      transaction.date >= fromDate && transaction.date <= toDate
    );
  }

  /**
   * Validate balance integrity across date range
   */
  validateBalanceIntegrity(fromDate: Date, toDate: Date): {
    isValid: boolean;
    openingBalance: number;
    closingBalance: number;
    calculatedClosing: number;
    totalTransactions: number;
    errors: string[];
  } {
    const errors: string[] = [];
    const openingBalance = this.getOpeningBalance(fromDate);
    const actualClosingBalance = this.getClosingBalance(toDate);
    
    // Calculate expected closing balance
    const rangeTransactions = this.getTransactionsForRange(fromDate, toDate);
    let calculatedClosing = openingBalance;
    
    rangeTransactions.forEach(transaction => {
      if (transaction.type === 'cash') {
        calculatedClosing += transaction.subType === 'in' ? transaction.amount : -transaction.amount;
      } else if (transaction.type === 'loan') {
        calculatedClosing += transaction.subType === 'disbursement' ? -transaction.amount : transaction.amount;
      }
    });

    // Validate calculation
    const tolerance = 0.01; // Allow for floating point precision
    const isValid = Math.abs(actualClosingBalance - calculatedClosing) < tolerance;
    
    if (!isValid) {
      errors.push(`Balance mismatch: Expected ₹${calculatedClosing.toFixed(2)}, Found ₹${actualClosingBalance.toFixed(2)}`);
    }

    return {
      isValid,
      openingBalance,
      closingBalance: actualClosingBalance,
      calculatedClosing,
      totalTransactions: rangeTransactions.length,
      errors
    };
  }

  /**
   * Get current cash balance
   */
  getCurrentBalance(): number {
    return this.getClosingBalance(new Date());
  }

  /**
   * Get all transactions chronologically
   */
  getAllTransactions(): TransactionRecord[] {
    return [...this.transactions];
  }

  /**
   * Simulate transaction deletion impact
   */
  simulateTransactionDeletion(transactionId: string): {
    impactedBalance: number;
    affectedDates: string[];
    recalculatedBalance: number;
  } {
    const transaction = this.transactions.find(t => t.id === transactionId || t.transactionId === transactionId || t.loanId === transactionId);
    
    if (!transaction) {
      return {
        impactedBalance: 0,
        affectedDates: [],
        recalculatedBalance: this.getCurrentBalance()
      };
    }

    // Calculate impact
    let impact = 0;
    if (transaction.type === 'cash') {
      impact = transaction.subType === 'in' ? -transaction.amount : transaction.amount;
    } else if (transaction.type === 'loan') {
      impact = transaction.subType === 'disbursement' ? transaction.amount : -transaction.amount;
    }

    // Find affected dates (all dates after this transaction)
    const affectedDates = this.transactions
      .filter(t => t.date >= transaction.date)
      .map(t => t.date.toISOString().split('T')[0])
      .filter((date, index, array) => array.indexOf(date) === index);

    return {
      impactedBalance: impact,
      affectedDates,
      recalculatedBalance: this.getCurrentBalance() + impact
    };
  }
}

/**
 * Factory function to create balance engine instance
 */
export function createCashBalanceEngine(cashTransactions: any[], loans: any[]): CashBalanceEngine {
  return new CashBalanceEngine(cashTransactions, loans);
}

/**
 * Utility function for real-time balance validation
 */
export function validateRealTimeBalance(
  cashTransactions: any[], 
  loans: any[], 
  fromDate: Date, 
  toDate: Date
): {
  isValid: boolean;
  openingBalance: number;
  closingBalance: number;
  errors: string[];
  engine: CashBalanceEngine;
} {
  const engine = createCashBalanceEngine(cashTransactions, loans);
  const validation = engine.validateBalanceIntegrity(fromDate, toDate);
  
  return {
    isValid: validation.isValid,
    openingBalance: validation.openingBalance,
    closingBalance: validation.closingBalance,
    errors: validation.errors,
    engine
  };
}