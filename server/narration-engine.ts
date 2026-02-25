// 🎯 CENTRALIZED NARRATION ENGINE - SINGLE SOURCE OF TRUTH
// This prevents multiple modules from creating different narration formats

export class NarrationEngine {
  
  /**
   * MASTER FUNCTION - Loan Disbursement Narration
   * ALL modules must use this function for कर्ज वितरण operations
   */
  static createLoanDisbursementNarration(
    accountNumber: string, 
    borrowerName: string, 
    principalAmount: number,
    groupName?: string,
    loanType?: string,
    collateralDetails?: string,
    weight?: string | number,
    loanDate?: string
  ): string {
    const group = groupName ? ` (${groupName})` : '';
    const cleanAmount = this.formatAmountWithoutDecimals(principalAmount);
    let base = `कर्ज वितरण - खाते क्र. ${accountNumber} ${borrowerName}${group} - मुद्दल: ₹${cleanAmount}`;

    const parts: string[] = [];

    const isBlank = (v?: string | number) =>
      v === undefined || v === null || String(v).trim() === '' || String(v).trim() === '—';

    if (!isBlank(loanType)) parts.push(String(loanType).trim());
    if (!isBlank(collateralDetails)) parts.push(String(collateralDetails).trim());
    if (!isBlank(weight)) parts.push(`${String(weight).trim()}g`);

    if (loanDate && String(loanDate).trim() !== '') {
      const d = new Date(String(loanDate) + 'T00:00:00Z');
      if (!isNaN(d.getTime())) {
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = d.getUTCFullYear();
        parts.push(`${dd}/${mm}/${yyyy}`);
      }
    }

    if (parts.length > 0) {
      base += ' | ' + parts.join(' | ');
    }

    return base;
  }

  /**
   * MASTER FUNCTION - Loan Closure Narration  
   * ALL modules must use this function for कर्ज बंद operations
   */
  static createLoanClosureNarration(
    accountNumber: string,
    borrowerName: string,
    principalAmount: number,
    interestAmount: number,
    groupName?: string
  ): string {
    const group = groupName ? ` (${groupName})` : '';
    const cleanPrincipal = this.formatAmountWithoutDecimals(principalAmount);
    const cleanInterest = this.formatAmountWithoutDecimals(interestAmount);
    return `कर्ज बंद - खाते क्र. ${accountNumber} ${borrowerName}${group} - मुद्दल: ₹${cleanPrincipal} + व्याज: ₹${cleanInterest}`;
  }

  /**
   * MASTER FUNCTION - Loan Amount Update Narration
   * Used specifically when loan amounts are updated/modified
   */
  static createLoanAmountUpdateNarration(
    accountNumber: string,
    borrowerName: string,
    newAmount: number,
    groupName?: string
  ): string {
    const group = groupName ? ` (${groupName})` : '';
    const cleanAmount = this.formatAmountWithoutDecimals(newAmount);
    return `कर्ज रक्कम अपडेट - खाते क्र. ${accountNumber} ${borrowerName}${group} - मुद्दल: ₹${cleanAmount}`;
  }

  /**
   * UTILITY FUNCTION - Format amount without unnecessary decimals
   * Removes ".00" from whole numbers, keeps necessary decimals
   */
  static formatAmountWithoutDecimals(amount: number): string {
    return Number(amount) % 1 === 0 ? 
      Number(amount).toString() : 
      Number(amount).toFixed(2).replace(/\.?0+$/, '');
  }

  /**
   * STANDARDIZATION FUNCTION - Clean existing narrations to match standard format
   */
  static standardizeExistingNarration(narration: string): string {
    if (!narration) return narration;

    // Extract key components
    const accountMatch = narration.match(/(?:खाते\s*(?:क्र\.?)?\s*)(\d+)/);
    const amountMatch = narration.match(/₹?(\d+(?:\.\d{1,2})?)/);
    
    if (!accountMatch || !amountMatch) return narration;
    
    const accountNumber = accountMatch[1];
    const amount = amountMatch[1];
    
    // Detect operation type
    if (narration.includes('वितरण') || narration.includes('दिले')) {
      // Standardize disbursement
      const nameMatch = narration.match(/(?:खाते.*?\d+\s+)([^-₹(]+?)(?:\s*[-₹(]|$)/);
      const borrowerName = nameMatch ? nameMatch[1].trim() : 'उधारकर्ता';
      const groupMatch = narration.match(/\(([^)]+)\)/);
      const groupName = groupMatch ? groupMatch[1] : undefined;
      
      return this.createLoanDisbursementNarration(accountNumber, borrowerName, Number(amount), groupName);
    }
    
    if (narration.includes('बंद') || narration.includes('कर्जबंद')) {
      // Standardize closure
      const nameMatch = narration.match(/(?:खाते.*?\d+\s+)([^-₹(]+?)(?:\s*[-₹(]|$)/);
      const borrowerName = nameMatch ? nameMatch[1].trim() : 'उधारकर्ता';
      const groupMatch = narration.match(/\(([^)]+)\)/);
      const groupName = groupMatch ? groupMatch[1] : undefined;
      
      // Extract interest if available
      const interestMatch = narration.match(/व्याज:?\s*₹?(\d+(?:\.\d{1,2})?)/);
      const interestAmount = interestMatch ? Number(interestMatch[1]) : 0;
      const principalAmount = Number(amount) - interestAmount;
      
      return this.createLoanClosureNarration(accountNumber, borrowerName, principalAmount, interestAmount, groupName);
    }
    
    return narration; // Return unchanged if not a loan operation
  }

  /**
   * SMART DUPLICATE DETECTION - Check if two narrations represent same operation
   */
  static isSameOperation(narration1: string, narration2: string): boolean {
    if (!narration1 || !narration2) return false;
    
    // Standardize both and compare
    const std1 = this.standardizeExistingNarration(narration1);
    const std2 = this.standardizeExistingNarration(narration2);
    
    return std1 === std2;
  }

  /**
   * EXTRACT LOAN IDENTIFIERS - Get account number and borrower from narration
   */
  static extractLoanIdentifiers(narration: string): {
    accountNumber?: string;
    borrowerName?: string;
    amount?: number;
    operationType?: 'disbursement' | 'closure';
  } {
    if (!narration) return {};
    
    const accountMatch = narration.match(/(?:खाते\s*(?:क्र\.?)?\s*)(\d+)/);
    const amountMatch = narration.match(/₹(\d+(?:\.\d{1,2})?)/);
    const nameMatch = narration.match(/(?:खाते.*?\d+\s+)([^-₹(]+?)(?:\s*[-₹(]|$)/);
    
    let operationType: 'disbursement' | 'closure' | undefined;
    if (narration.includes('वितरण') || narration.includes('दिले')) {
      operationType = 'disbursement';
    } else if (narration.includes('बंद') || narration.includes('कर्जबंद')) {
      operationType = 'closure';
    }
    
    return {
      accountNumber: accountMatch ? accountMatch[1] : undefined,
      borrowerName: nameMatch ? nameMatch[1].trim() : undefined,
      amount: amountMatch ? Number(amountMatch[1]) : undefined,
      operationType
    };
  }
}

export default NarrationEngine;