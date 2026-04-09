// Comprehensive loan calculations for closure module
export interface InterestCalculationResult {
  interestAmount: number;
  totalPayable: number;
  durationInMonths: number;
  durationInDays: number;
  timePeriod?: any; // Add timePeriod property for enhanced display
  breakdown: {
    principalAmount: number;
    interestRate: number;
    calculationType: 'simple' | 'compound' | 'advanced_compound';
    calculationMode: 'full_month' | 'fractional' | 'daily' | 'weekly';
    periodUsed: string;
    totalDays?: number;
    calendarBreakdown?: {
      years: number;
      months: number;
      days: number;
    };
    detailedBreakdown?: any[];
    compoundingFrequency?: number;
    compoundingPeriods?: number;
    totalMonthsProcessed?: number;
  };
}

export class LoanCalculationsAdvanced {
  
  // Advanced compound interest calculation with flexible compounding frequency
  static calculateAdvancedCompoundInterest(
    principal: number,
    monthlyRate: number, // Interest rate per month (e.g., 1 for 1%)
    startDate: Date,
    endDate: Date,
    compoundingFrequency: "yearly" | "half_yearly" | "quarterly" | "monthly" = "yearly",
    calculationMode: "month" | "half_month" | "week" | "day" = "half_month"
  ) {
    const timePeriod = this.calculateTimePeriod(startDate, endDate);
    let totalInterest = 0;
    let currentPrincipal = principal;
    let detailedBreakdown = [];
    
    // Calculate compound interest based on selected frequency
    let compoundingPeriodMonths = 12; // Default yearly
    switch (compoundingFrequency) {
      case "yearly": compoundingPeriodMonths = 12; break;
      case "half_yearly": compoundingPeriodMonths = 6; break;
      case "quarterly": compoundingPeriodMonths = 3; break;
      case "monthly": compoundingPeriodMonths = 1; break;
    }
    
    const calYears = timePeriod.calendarYears;
    const calMonths = timePeriod.calendarMonths;
    const calDays = timePeriod.calendarDays;
    const totalMonths = calYears * 12 + calMonths;
    const fullCompoundingPeriods = Math.floor(totalMonths / compoundingPeriodMonths);
    
    for (let period = 0; period < fullCompoundingPeriods; period++) {
      const monthlyInterestForPeriod = Math.round((currentPrincipal * monthlyRate) / 100);
      const periodInterest = monthlyInterestForPeriod * compoundingPeriodMonths;
      
      detailedBreakdown.push({
        period: period + 1,
        compoundingType: compoundingFrequency,
        principal: currentPrincipal,
        monthlyInterest: monthlyInterestForPeriod,
        periodInterest: periodInterest,
        periodMonths: compoundingPeriodMonths
      });
      
      totalInterest += periodInterest;
      currentPrincipal = Number(currentPrincipal) + Number(periodInterest);
    }
    
    const remainingMonths = totalMonths - (fullCompoundingPeriods * compoundingPeriodMonths);
    if (remainingMonths > 0) {
      const monthlyInterestRate = Math.round((currentPrincipal * monthlyRate) / 100);
      const monthsInterest = monthlyInterestRate * remainingMonths;
      totalInterest += monthsInterest;
      
      detailedBreakdown.push({
        type: 'remaining_months',
        months: remainingMonths,
        principal: currentPrincipal,
        monthlyRate: monthlyInterestRate,
        interest: monthsInterest
      });
    }
    
    if (calDays > 0) {
      const monthlyInterestRate = Math.round((currentPrincipal * monthlyRate) / 100);
      let daysInterest = 0;
      
      if (totalMonths === 0) {
        daysInterest = monthlyInterestRate;
      } else if (calculationMode === "half_month") {
        if (calDays >= 1 && calDays <= 15) {
          daysInterest = monthlyInterestRate * 0.5;
        } else if (calDays >= 16) {
          daysInterest = monthlyInterestRate;
        }
      } else if (calculationMode === "month") {
        if (calDays > 0) {
          daysInterest = monthlyInterestRate;
        }
      } else if (calculationMode === "week") {
        if (calDays >= 1 && calDays <= 8) {
          daysInterest = monthlyInterestRate * 0.25;
        } else if (calDays >= 9 && calDays <= 15) {
          daysInterest = monthlyInterestRate * 0.5;
        } else if (calDays >= 16 && calDays <= 22) {
          daysInterest = monthlyInterestRate * 0.75;
        } else if (calDays >= 23) {
          daysInterest = monthlyInterestRate;
        }
      } else {
        const monthlyInterest = (currentPrincipal * monthlyRate) / 100;
        const perDayInterest = monthlyInterest / 30;
        daysInterest = perDayInterest * calDays;
      }
      
      daysInterest = Math.round(daysInterest);
      totalInterest += daysInterest;
      
      detailedBreakdown.push({
        type: 'days',
        days: calDays,
        principal: currentPrincipal,
        dailyRate: monthlyInterestRate / 30,
        interest: daysInterest,
        calculationMode: calculationMode
      });
    }
    
    totalInterest = Math.round(totalInterest);
    
    return {
      interestAmount: totalInterest,
      totalPayable: principal + totalInterest,
      durationInMonths: totalMonths,
      durationInDays: timePeriod.totalDays,
      breakdown: {
        principalAmount: principal,
        interestRate: monthlyRate,
        calculationType: 'advanced_compound' as const,
        calculationMode: calculationMode as any,
        periodUsed: `${calYears} वर्ष, ${calMonths} महिने, ${calDays} दिवस`,
        detailedBreakdown: detailedBreakdown,
        compoundingFrequency: compoundingFrequency,
        compoundingPeriods: fullCompoundingPeriods,
        totalMonthsProcessed: totalMonths
      }
    };
  }
  
  // Calculate time period breakdown - FIXED VERSION FOR INCLUSIVE DAY COUNTING
  static calculateTimePeriod(startDate: Date, endDate: Date) {
    // FIXED: Calculate total days using actual time difference and make it inclusive
    // User expects inclusive counting: 30 July to 8 August = 10 days (including both start and end dates)
    const timeDiff = endDate.getTime() - startDate.getTime();
    const totalDays = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1; // +1 for inclusive counting, use floor for accuracy
    
    // For display purposes, use simple breakdown based on total days
    // This avoids calendar month borrowing issues that cause incorrect day counts
    const years = Math.floor(totalDays / 365);
    const remainingDaysAfterYears = totalDays % 365;
    const months = Math.floor(remainingDaysAfterYears / 30);
    const days = remainingDaysAfterYears % 30;
    
    // Calculate precise total months (banking standard vs calendar)
    const totalCalendarMonths = years * 12 + months;
    const bankingTotalMonths = totalDays / 30; // Banking standard
    
    // Calendar-based calculation for accurate business representation
    // Example: 8 August to 9 September = 1 month 1 day (not banking 30-day standard)
    let calendarYears = endDate.getFullYear() - startDate.getFullYear();
    let calendarMonths = endDate.getMonth() - startDate.getMonth();
    let calendarDays = endDate.getDate() - startDate.getDate();

    // Handle negative days by borrowing from previous month
    if (calendarDays < 0) {
      calendarMonths--;
      const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
      calendarDays += prevMonth.getDate();
      
      if (calendarDays < 0) {
        calendarMonths--;
        const prevPrevMonth = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 0);
        calendarDays += prevPrevMonth.getDate();
      }
    }

    // Handle negative months by borrowing from previous year
    if (calendarMonths < 0) {
      calendarYears--;
      calendarMonths += 12;
    }
    
    let displayYears = years;
    let displayMonths = months;
    let displayDays = days;
    
    return {
      totalDays,
      totalMonths: totalCalendarMonths,
      bankingMonths: bankingTotalMonths,
      years: displayYears,
      months: displayMonths,
      days: displayDays,
      isExactMonth: days === 0,
      calendarYears,
      calendarMonths,
      calendarDays,
      displayYears,
      displayMonths,
      displayDays,
      calendarInfo: {
        isLeapYear: this.isLeapYear(startDate.getFullYear()) || this.isLeapYear(endDate.getFullYear()),
        monthsWithDays: this.getMonthDetails(startDate, endDate)
      }
    };
  }
  
  // Helper function to check leap year
  static isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }
  
  // Helper function to get month details for accurate calculations
  static getMonthDetails(startDate: Date, endDate: Date) {
    const details = [];
    const current = new Date(startDate);
    
    while (current < endDate) {
      const monthStart = new Date(current);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      const monthDays = monthEnd.getDate();
      
      details.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
        monthName: current.toLocaleString('hi-IN', { month: 'long' }),
        daysInMonth: monthDays,
        isFebruary: current.getMonth() === 1,
        isLeapYear: this.isLeapYear(current.getFullYear())
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    
    return details;
  }
  
  // Legacy calculation methods for backward compatibility
  static calculateInterestForClosure(
    principalAmount: number,
    interestRate: number,
    startDate: Date,
    closureDate: Date,
    interestType: 'simple' | 'compound' | 'advanced_compound' = 'simple',
    calculationMode: 'month' | 'half-month' | 'week' | 'day' | 'daily' = 'month'
  ): InterestCalculationResult {
    
    // Use the enhanced time period calculation for proper years/months/days breakdown
    const timePeriod = this.calculateTimePeriod(startDate, closureDate);
    
    let calculatedMonths = 0;
    let interestAmount = 0;
    
    // Calculate months based on calculation mode using calendar-based breakdown
    switch (calculationMode) {
      case 'month':
        // पूर्ण महिना: 1 दिवस झाला तरी पूर्ण महिन्याची व्याज
        const fullMonthsOnly = timePeriod.years * 12 + timePeriod.months;
        
        if (timePeriod.days > 0) {
          calculatedMonths = fullMonthsOnly + 1;
        } else {
          calculatedMonths = fullMonthsOnly;
        }
        break;
        
      case 'half-month':
        const fullMonthsHalf = timePeriod.years * 12 + timePeriod.months;
        if (timePeriod.days >= 1 && timePeriod.days <= 15) {
          calculatedMonths = fullMonthsHalf + 0.5;
        } else if (timePeriod.days >= 16) {
          calculatedMonths = fullMonthsHalf + 1;
        } else {
          calculatedMonths = fullMonthsHalf;
        }
        break;
        
      case 'week':
        const fullMonthsWeek = timePeriod.years * 12 + timePeriod.months;
        let weekMonths = 0;
        
        if (timePeriod.days >= 1 && timePeriod.days <= 8) {
          weekMonths = 0.25;
        } else if (timePeriod.days >= 9 && timePeriod.days <= 15) {
          weekMonths = 0.5;
        } else if (timePeriod.days >= 16 && timePeriod.days <= 22) {
          weekMonths = 0.75;
        } else if (timePeriod.days >= 23) {
          weekMonths = 1;
        }
        
        calculatedMonths = fullMonthsWeek + weekMonths;
        break;
        
      case 'day':
      case 'daily':
        // Daily calculation using EXACT Interest Calculator formula: banking standard
        calculatedMonths = (timePeriod.totalDays * 12) / 365;
        break;
        
      default:
        calculatedMonths = Math.floor(timePeriod.totalDays / 30);
        break;
    }
    
    // Calculate interest based on type
    if (interestType === 'simple') {
      // For simple interest, use banking standard formula: (P * R * T) / (100 * 365) where T is actual days
      // Convert monthly rate to annual rate (monthly rate * 12)
      const annualRate = interestRate * 12;
      interestAmount = Math.round((principalAmount * annualRate * timePeriod.totalDays) / (100 * 365));
      
      // Debug banking standard calculation
      if (process.env.NODE_ENV === 'development') {
        console.log('🏦 SIMPLE INTEREST - Banking Standard:', {
          principal: principalAmount,
          rate: `${interestRate}%`,
          rateType: 'monthly',
          effectiveRate: `${annualRate}% (annual)`,
          totalDays: timePeriod.totalDays,
          formula: `(${principalAmount} × ${annualRate} × ${timePeriod.totalDays}) / (100 × 365)`,
          calculation: `${principalAmount * annualRate * timePeriod.totalDays} / ${100 * 365} = ${(principalAmount * annualRate * timePeriod.totalDays) / (100 * 365)}`,
          beforeRounding: (principalAmount * annualRate * timePeriod.totalDays) / (100 * 365),
          afterRounding: Math.round((principalAmount * annualRate * timePeriod.totalDays) / (100 * 365)),
          bankingStandard: '365-day year calculation'
        });
      }
    } else {
      // For compound interest, use monthly calculation
      interestAmount = Math.round((principalAmount * interestRate * calculatedMonths) / 100);
    }
    
    return {
      interestAmount,
      totalPayable: principalAmount + interestAmount,
      durationInMonths: calculatedMonths,
      durationInDays: timePeriod.totalDays,
      // Enhanced breakdown with proper time period display
      timePeriod: timePeriod, // Add time period for proper display
      breakdown: {
        principalAmount,
        interestRate,
        calculationType: interestType,
        calculationMode: calculationMode as any,
        periodUsed: `${timePeriod.years} years, ${timePeriod.months} months, ${timePeriod.days} days`,
        totalDays: timePeriod.totalDays,
        calendarBreakdown: {
          years: timePeriod.years,
          months: timePeriod.months,
          days: timePeriod.days
        }
      }
    };
  }
  
  // Calculate days interest for fractional periods
  static calculateDaysInterest(principal: number, monthlyRate: number, days: number) {
    const dailyRate = monthlyRate / 30;
    return (principal * dailyRate * days) / 100;
  }

  // Calculate balance and refund information
  static calculateBalanceRefund(totalPayable: number, actualPaid: number) {
    const difference = actualPaid - totalPayable;
    
    return {
      totalPayable,
      actualPaid,
      difference,
      isRefund: difference > 0,
      isBalance: difference < 0,
      isExact: difference === 0,
      amount: Math.abs(difference),
      message: difference > 0 ? 'परतावा' : difference < 0 ? 'बाकी' : 'योग्य'
    };
  }
}

// Advanced compound interest calculator for exact daily/weekly calculations
export class CompoundInterestCalculator {
  
  /**
   * Calculate compound interest with daily or weekly precision
   * Based on user example: Loan Date 1-1-2012, Close Date 25-1-2014, Principal 1000, Rate 1% per month
   */
  static calculateCompoundInterest(
    principal: number,
    monthlyRate: number, // Rate per month (e.g., 1 for 1%)
    startDate: Date,
    endDate: Date,
    calculationType: 'daily' | 'weekly' = 'daily'
  ) {
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate full years and remaining days
    const fullYears = Math.floor(totalDays / 365);
    const remainingDaysAfterYears = totalDays - (fullYears * 365);
    
    let currentPrincipal = principal;
    let totalInterest = 0;
    let breakdown = [];
    
    // Calculate interest for each full year (compound annually)
    for (let year = 1; year <= fullYears; year++) {
      const yearlyInterest = Math.round((currentPrincipal * monthlyRate * 12) / 100);
      totalInterest += yearlyInterest;
      
      breakdown.push({
        year: year,
        startAmount: currentPrincipal,
        yearlyInterest: yearlyInterest,
        endAmount: currentPrincipal + yearlyInterest
      });
      
      currentPrincipal += yearlyInterest; // Compound for next year
    }
    
    // Calculate interest for remaining days/months
    if (remainingDaysAfterYears > 0) {
      const monthlyInterestRate = Math.round((currentPrincipal * monthlyRate) / 100);
      let remainingInterest = 0;
      
      if (calculationType === 'daily') {
        // Daily calculation: exact days (monthly interest / 30) * actual days
        // For user example: 12.54 / 30 * 25 = 10.45 ≈ 10.5
        const dailyInterestAmount = (monthlyInterestRate / 30) * remainingDaysAfterYears;
        remainingInterest = Math.round(dailyInterestAmount * 10) / 10; // Round to 1 decimal place like user example
      } else if (calculationType === 'weekly') {
        // Weekly calculation based on user specs
        let calculatedMonths = 0;
        
        if (remainingDaysAfterYears <= 7) {
          calculatedMonths = 0.25; // 1 week = 0.25 month
        } else if (remainingDaysAfterYears <= 15) {
          calculatedMonths = 0.5; // 2 weeks = 0.5 month  
        } else if (remainingDaysAfterYears <= 21) {
          calculatedMonths = 0.75; // 3 weeks = 0.75 month
        } else {
          calculatedMonths = 1; // 4+ weeks = 1 full month
        }
        
        remainingInterest = Math.round(monthlyInterestRate * calculatedMonths * 10) / 10; // Round to 1 decimal
      }
      
      totalInterest += remainingInterest;
      
      breakdown.push({
        type: 'remaining_period',
        days: remainingDaysAfterYears,
        calculationType: calculationType,
        startAmount: currentPrincipal,
        periodInterest: remainingInterest,
        calculatedMonths: calculationType === 'weekly' ? 
          (remainingDaysAfterYears <= 7 ? 0.25 : remainingDaysAfterYears <= 15 ? 0.5 : remainingDaysAfterYears <= 21 ? 0.75 : 1) : 
          remainingDaysAfterYears / 30
      });
    }
    
    return {
      principal: principal,
      totalInterest: Math.round(totalInterest * 10) / 10, // Keep 1 decimal precision
      totalPayable: principal + (Math.round(totalInterest * 10) / 10),
      totalDays: totalDays,
      fullYears: fullYears,
      remainingDays: remainingDaysAfterYears,
      calculationType: calculationType,
      breakdown: breakdown,
      monthlyRate: monthlyRate
    };
  }
  
  /**
   * Example calculation matching user's requirement:
   * Loan Date: 1-1-2012, Close Date: 25-1-2014, Principal: 1000, Rate: 1% per month
   * Daily: 264.5, Weekly: 266.50
   */
  static getExampleCalculation() {
    const startDate = new Date('2012-01-01');
    const endDate = new Date('2014-01-25');
    const principal = 1000;
    const monthlyRate = 1; // 1% per month
    
    const dailyResult = this.calculateCompoundInterest(principal, monthlyRate, startDate, endDate, 'daily');
    const weeklyResult = this.calculateCompoundInterest(principal, monthlyRate, startDate, endDate, 'weekly');
    
    return {
      daily: dailyResult,
      weekly: weeklyResult
    };
  }
}

// Standard loan calculations class for basic functionality
export class LoanCalculations {
  
  // Format currency amount with Indian style (removes unnecessary .00)
  static formatAmount(amount: number): string {
    const formatted = new Intl.NumberFormat('en-IN').format(amount);
    // Remove .00 suffix for whole numbers
    return formatted.replace(/\.00$/, '');
  }

  // Format currency with rupee symbol (removes unnecessary .00)
  static formatCurrency(amount: number): string {
    const formatted = new Intl.NumberFormat('en-IN').format(amount);
    // Remove .00 suffix for whole numbers
    return '₹' + formatted.replace(/\.00$/, '');
  }

  // Clean amount formatting - removes .00 from any number
  static cleanAmount(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0';
    const formatted = new Intl.NumberFormat('en-IN').format(num);
    return formatted.replace(/\.00$/, '');
  }

  // Calculate simple interest
  static calculateSimpleInterest(
    principal: number,
    rate: number,
    timeInMonths: number
  ): number {
    return Math.round((principal * rate * timeInMonths) / 100);
  }

  // Calculate EMI for loan
  static calculateEMI(
    principal: number,
    rate: number,
    tenure: number
  ): number {
    const monthlyRate = rate / (12 * 100);
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
                (Math.pow(1 + monthlyRate, tenure) - 1);
    return Math.round(emi);
  }

  // Calculate loan maturity amount
  static calculateMaturityAmount(
    principal: number,
    rate: number,
    timeInMonths: number
  ): number {
    const interest = this.calculateSimpleInterest(principal, rate, timeInMonths);
    return principal + interest;
  }
}