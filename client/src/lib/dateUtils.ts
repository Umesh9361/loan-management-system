// Date utility functions for DD/MM/YYYY format

export const DateUtils = {
  // Convert DD/MM/YYYY to YYYY-MM-DD for database
  formatForDatabase: (dateStr: string): string => {
    if (!dateStr) return "";
    
    // Check if already in YYYY-MM-DD format
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    
    // Handle DD/MM/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return dateStr;
  },

  // Convert YYYY-MM-DD to DD/MM/YYYY for display
  formatForDisplay: (dateStr: string): string => {
    if (!dateStr) return "";
    
    // Check if in YYYY-MM-DD format
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    
    // Already in DD/MM/YYYY or other format
    return dateStr;
  },

  // Get current date in YYYY-MM-DD format (for date inputs)
  getCurrentDate: (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Add months to a date (YYYY-MM-DD format)
  addMonths: (dateStr: string, months: number): string => {
    if (!dateStr) return "";
    
    const date = new Date(dateStr);
    date.setMonth(date.getMonth() + months);
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  },

  // Validate DD/MM/YYYY format
  isValidDateFormat: (dateStr: string): boolean => {
    if (!dateStr) return false;
    
    const ddmmyyyyPattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    if (!ddmmyyyyPattern.test(dateStr)) return false;
    
    const [day, month, year] = dateStr.split('/');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    return date.getDate() === parseInt(day) &&
           date.getMonth() === parseInt(month) - 1 &&
           date.getFullYear() === parseInt(year);
  },

  // Convert ISO date to HTML date input format (YYYY-MM-DD)
  isoToIndianDate: (isoDateStr: string): string => {
    if (!isoDateStr) return "";
    
    // Handle ISO timestamp format (2025-01-15T00:00:00.000Z)
    if (isoDateStr.includes('T')) {
      return isoDateStr.split('T')[0];
    }
    
    // If already in YYYY-MM-DD format, return as is
    if (isoDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return isoDateStr;
    }
    
    // Handle DD/MM/YYYY format - convert to YYYY-MM-DD for HTML date inputs
    if (isoDateStr.includes('/')) {
      const parts = isoDateStr.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    
    return isoDateStr;
  }
};