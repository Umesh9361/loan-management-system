// Date utility functions for consistent DD/MM/YYYY formatting
export class DateUtils {
  
  // Convert Date object to DD/MM/YYYY format
  static formatToIndianDate(date: Date): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return new Date().toLocaleDateString('en-GB');
    }
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  // Convert ISO string to DD/MM/YYYY format
  static formatISOToIndianDate(isoString: string): string {
    if (!isoString) return this.getCurrentIndianDate();
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return this.getCurrentIndianDate();
    return this.formatToIndianDate(date);
  }
  
  // Convert DD/MM/YYYY to Date object
  static parseIndianDate(indianDate: string): Date {
    const [day, month, year] = indianDate.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Convert DD/MM/YYYY to ISO string (YYYY-MM-DD) for database storage
  static indianDateToISO(indianDate: string): string {
    if (!indianDate || !indianDate.includes('/')) return indianDate;
    const [day, month, year] = indianDate.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Convert ISO string (YYYY-MM-DD) to DD/MM/YYYY for display
  static isoToIndianDate(isoDate: string | Date): string {
    if (!isoDate) return this.getCurrentIndianDate();
    
    // Handle Date object
    if (isoDate instanceof Date) {
      if (isNaN(isoDate.getTime())) return this.getCurrentIndianDate();
      const day = isoDate.getDate().toString().padStart(2, '0');
      const month = (isoDate.getMonth() + 1).toString().padStart(2, '0');
      const year = isoDate.getFullYear().toString();
      return `${day}/${month}/${year}`;
    }
    
    // Handle string - ensure it's actually a string
    const dateStr = typeof isoDate === 'string' ? isoDate : String(isoDate);
    if (!dateStr || typeof dateStr !== 'string' || !dateStr.includes('-')) {
      return this.getCurrentIndianDate();
    }
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return this.getCurrentIndianDate();
    return `${day}/${month}/${year}`;
  }
  
  // Get current date in DD/MM/YYYY format
  static getCurrentIndianDate(): string {
    return this.formatToIndianDate(new Date());
  }
  
  // Get current date in DD/MM/YY format (short year)
  static getCurrentShortDate(): string {
    const date = new Date();
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2); // Last 2 digits of year
    return `${day}/${month}/${year}`;
  }
  
  // Convert Date object to DD/MM/YY format (short year)
  static formatToShortDate(date: Date): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return this.getCurrentShortDate();
    }
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  }
  
  // Convert ISO string to DD/MM/YY format (short year)
  static isoToShortDate(isoDate: string | Date): string {
    if (!isoDate) return this.getCurrentIndianDate();
    
    // Handle Date object
    if (isoDate instanceof Date) {
      return this.formatToIndianDate(isoDate);
    }
    
    // Handle string
    const dateStr = typeof isoDate === 'string' ? isoDate : String(isoDate);
    if (!dateStr || !dateStr.includes('-')) {
      return this.getCurrentIndianDate();
    }
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return this.getCurrentIndianDate();
    return `${day}/${month}/${year}`;
  }
  
  // Format date for input fields (YYYY-MM-DD)
  static formatForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Convert input date (YYYY-MM-DD) to display format (DD/MM/YYYY)
  static inputToDisplay(inputDate: string): string {
    if (!inputDate) return '';
    const date = new Date(inputDate);
    return this.formatToIndianDate(date);
  }
  
  // Get localized date string in Marathi/Hindi format
  static getLocalizedDate(date: Date): string {
    return date.toLocaleDateString('hi-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  
  // Legacy method names for backward compatibility
  static getCurrentDate(): string {
    return this.formatForInput(new Date());
  }
  
  static formatForDisplay(dateString: string): string {
    return this.inputToDisplay(dateString);
  }
  
  static addMonths(dateString: string, months: number): string {
    const date = new Date(dateString);
    const originalDay = date.getDate();
    
    // Add months properly without day shifting
    let newMonth = date.getMonth() + months;
    let newYear = date.getFullYear();
    
    // Handle year overflow/underflow
    while (newMonth > 11) {
      newMonth -= 12;
      newYear++;
    }
    while (newMonth < 0) {
      newMonth += 12;
      newYear--;
    }
    
    // Create new date with proper month/year
    const resultDate = new Date(newYear, newMonth, originalDay);
    
    // Handle cases where the day doesn't exist in the target month
    // e.g., Jan 31 + 1 month should be Feb 28/29, not Mar 3
    if (resultDate.getMonth() !== newMonth) {
      // Day overflowed, set to last day of target month
      const lastDayOfMonth = new Date(newYear, newMonth + 1, 0).getDate();
      resultDate.setDate(lastDayOfMonth);
    }
    
    return this.formatForInput(resultDate);
  }

  // Add months to Indian date format (DD/MM/YYYY)
  static addMonthsToIndianDate(indianDate: string, months: number): string {
    if (!indianDate || !indianDate.includes('/')) return indianDate;
    
    const [day, month, year] = indianDate.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const originalDay = date.getDate();
    
    // Add months properly without day shifting
    let newMonth = date.getMonth() + months;
    let newYear = date.getFullYear();
    
    // Handle year overflow/underflow
    while (newMonth > 11) {
      newMonth -= 12;
      newYear++;
    }
    while (newMonth < 0) {
      newMonth += 12;
      newYear--;
    }
    
    // Create new date with proper month/year
    const resultDate = new Date(newYear, newMonth, originalDay);
    
    // Handle cases where the day doesn't exist in the target month
    if (resultDate.getMonth() !== newMonth) {
      // Day overflowed, set to last day of target month
      const lastDayOfMonth = new Date(newYear, newMonth + 1, 0).getDate();
      resultDate.setDate(lastDayOfMonth);
    }
    
    return this.formatToIndianDate(resultDate);
  }

  // Format date function for general use
  static formatDate(dateInput: string | Date): string {
    if (!dateInput) return this.getCurrentIndianDate();
    
    if (dateInput instanceof Date) {
      return this.formatToIndianDate(dateInput);
    }
    
    // If it's a string, convert to Date first
    const date = new Date(dateInput);
    return this.formatToIndianDate(date);
  }

  // Get today's date in ISO format (YYYY-MM-DD)
  static todayISO(): string {
    return this.formatForInput(new Date());
  }

  // Convert ISO date (YYYY-MM-DD) to DD/MM/YYYY for display
  static isoToDDMMYYYY(isoDate: string): string {
    return this.isoToIndianDate(isoDate);
  }

  // Validate Indian date format (DD/MM/YYYY)
  static isValidIndianDate(dateString: string): boolean {
    if (!dateString || typeof dateString !== 'string') return false;
    
    const datePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateString.match(datePattern);
    
    if (!match) return false;
    
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    // Basic validation
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
      return false;
    }
    
    // Check if date is valid by creating Date object
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  }

  // Auto format various date inputs to DD/MM/YYYY
  static autoFormatIndianDate(input: string): string | null {
    if (!input) return null;
    
    // Remove any non-digit and non-slash characters
    const cleaned = input.replace(/[^\d\/]/g, '');
    
    // Try different patterns
    if (cleaned.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      // Already in DD/MM/YYYY format
      if (this.isValidIndianDate(cleaned)) return cleaned;
    }
    
    if (cleaned.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
      // DD/MM/YY format - convert to full year
      const [day, month, year] = cleaned.split('/');
      const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
      const formatted = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${fullYear}`;
      if (this.isValidIndianDate(formatted)) return formatted;
    }
    
    if (cleaned.match(/^\d{8}$/)) {
      // DDMMYYYY format
      const day = cleaned.substring(0, 2);
      const month = cleaned.substring(2, 4);
      const year = cleaned.substring(4, 8);
      const formatted = `${day}/${month}/${year}`;
      if (this.isValidIndianDate(formatted)) return formatted;
    }
    
    if (cleaned.match(/^\d{6}$/)) {
      // DDMMYY format
      const day = cleaned.substring(0, 2);
      const month = cleaned.substring(2, 4);
      const year = cleaned.substring(4, 6);
      const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
      const formatted = `${day}/${month}/${fullYear}`;
      if (this.isValidIndianDate(formatted)) return formatted;
    }
    
    return null;
  }
}