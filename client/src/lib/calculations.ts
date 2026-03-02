export interface LoanCalculation {
  principalAmount: number;
  interestRate: number;
  durationMonths: number;
  startDate: Date;
  endDate?: Date;
}

export interface InterestCalculation {
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  monthlyInterest: number;
  dailyInterest: number;
}

export class LoanCalculations {
  /**
   * Calculate simple interest for a loan
   */
  static calculateSimpleInterest(
    principal: number,
    rate: number,
    timeInDays: number
  ): number {
    // Banking Simple Interest: 365-day standard calculation 
    // I = (P * R * T) / (100 * 365) where T is in days
    return Math.round((principal * rate * timeInDays) / (100 * 365));
  }

  /**
   * Calculate interest for a specific date range
   */
  static calculateInterestForPeriod(
    principal: number,
    rate: number,
    startDate: Date,
    endDate: Date
  ): InterestCalculation {
    const timeDiff = endDate.getTime() - startDate.getTime();
    const timeInDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    const interestAmount = this.calculateSimpleInterest(principal, rate, timeInDays);
    const totalAmount = principal + interestAmount;
    
    const monthlyInterest = (principal * rate) / (100 * 12);
    const dailyInterest = (principal * rate) / (100 * 365);

    return {
      principalAmount: principal,
      interestAmount: Math.round(interestAmount),
      totalAmount: Math.round(totalAmount),
      monthlyInterest: Math.round(monthlyInterest),
      dailyInterest: Math.round(dailyInterest),
    };
  }

  /**
   * Calculate EMI for equal monthly installments
   */
  static calculateEMI(
    principal: number,
    rate: number,
    durationMonths: number
  ): number {
    const monthlyRate = rate / (100 * 12);
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, durationMonths)) /
                (Math.pow(1 + monthlyRate, durationMonths) - 1);
    
    return Math.round(emi);
  }

  /**
   * Calculate loan maturity date
   */
  static calculateMaturityDate(startDate: Date, durationMonths: number): Date {
    const maturityDate = new Date(startDate);
    maturityDate.setMonth(maturityDate.getMonth() + durationMonths);
    return maturityDate;
  }

  /**
   * Calculate outstanding amount for a loan
   */
  static calculateOutstanding(
    principal: number,
    paymentsReceived: number,
    interestAccrued: number
  ): number {
    return principal + interestAccrued - paymentsReceived;
  }

  /**
   * Format currency in Indian Rupees
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Format currency without symbol
   */
  static formatAmount(amount: number): string {
    return new Intl.NumberFormat('hi-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Interest variance analysis for loan closures
  static analyzeInterestVariance(calculatedInterest: number, actualInterest: number, interestType: string = 'simple'): {
    variance: number;
    varianceType: 'positive' | 'negative' | 'none';
    description: string;
    reason: string;
  } {
    const variance = actualInterest - calculatedInterest;
    const absVariance = Math.abs(variance);
    
    // Determine variance type
    let varianceType: 'positive' | 'negative' | 'none';
    if (absVariance < 0.01) { // Less than 1 paisa
      varianceType = 'none';
    } else if (variance > 0) {
      varianceType = 'positive';
    } else {
      varianceType = 'negative';
    }

    // Generate description and reason
    let description = '';
    let reason = '';
    
    switch (varianceType) {
      case 'positive':
        description = `अतिरिक्त व्याज: ₹${Math.round(absVariance).toLocaleString('en-IN')}`;
        reason = interestType === 'manual' ? 'हस्तचलित वाढ - अतिरिक्त शुल्क' : 'गैर मानक व्याज दर';
        break;
      case 'negative':
        description = `कमी व्याज: ₹${Math.round(absVariance).toLocaleString('en-IN')}`;
        reason = interestType === 'advance' ? 'आगाऊ व्याज - कमी दर लागू' : 'माफी/सवलत दिली';
        break;
      case 'none':
        description = 'गणना प्रमाणे';
        reason = 'कोणता फरक नाही';
        break;
    }

    return {
      variance,
      varianceType,
      description,
      reason
    };
  }

  // Format closure summary with variance details
  static formatClosureSummary(closure: any): string {
    const calculatedInterest = Number(closure.calculatedInterest || 0);
    const actualInterest = Number(closure.interestPaid || 0);
    const analysis = this.analyzeInterestVariance(calculatedInterest, actualInterest, closure.interestType);
    
    return `कर्ज बंद - मुद्दल: ₹${this.formatAmount(Number(closure.principalPaid))} + व्याज: ₹${this.formatAmount(actualInterest)} (${analysis.description})`;
  }
}
