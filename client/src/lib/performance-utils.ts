// Performance optimization utilities

// Memoized calculation functions
const calculationCache = new Map<string, any>();

export class PerformanceUtils {
  // Debounced function factory
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(null, args), wait);
    };
  }

  // Throttled function factory
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(null, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Memoized amount formatting
  static formatAmount = (() => {
    const cache = new Map<number, string>();
    const formatter = new Intl.NumberFormat('en-IN');
    
    return (amount: number): string => {
      const key = Math.floor(amount);
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      
      const formatted = formatter.format(key);
      cache.set(key, formatted);
      
      // Limit cache size to prevent memory leaks
      if (cache.size > 1000) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      return formatted;
    };
  })();

  // Memoized date formatting
  static formatDate = (() => {
    const cache = new Map<string, string>();
    
    return (dateString: string): string => {
      if (cache.has(dateString)) {
        return cache.get(dateString)!;
      }
      
      const date = new Date(dateString);
      const formatted = date.toLocaleDateString('en-GB');
      cache.set(dateString, formatted);
      
      // Limit cache size
      if (cache.size > 500) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      return formatted;
    };
  })();

  // Fast array chunk function for pagination
  static chunkArray<T>(array: T[], size: number): T[][] {
    if (!Array.isArray(array) || array.length === 0) return [];
    
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Fast deep equality check for objects
  static fastDeepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.fastDeepEqual(a[key], b[key])) return false;
      }
    }
    
    return true;
  }

  // Memory-efficient search with priority sorting
  static optimizedSearch<T extends Record<string, any>>(
    items: T[],
    query: string,
    searchFields: (keyof T)[],
    maxResults: number = 100
  ): T[] {
    if (!query.trim() || !Array.isArray(items)) return items.slice(0, maxResults);
    
    const searchLower = query.toLowerCase().trim();
    const exactMatches: T[] = [];
    const partialMatches: T[] = [];
    const containsMatches: T[] = [];
    
    for (const item of items) {
      let found = false;
      let matchType = 0; // 0: no match, 1: contains, 2: partial, 3: exact
      
      for (const field of searchFields) {
        const value = String(item[field] || '').toLowerCase();
        
        if (value === searchLower) {
          matchType = Math.max(matchType, 3);
        } else if (value.startsWith(searchLower)) {
          matchType = Math.max(matchType, 2);
        } else if (value.includes(searchLower)) {
          matchType = Math.max(matchType, 1);
        }
      }
      
      switch (matchType) {
        case 3:
          exactMatches.push(item);
          break;
        case 2:
          partialMatches.push(item);
          break;
        case 1:
          containsMatches.push(item);
          break;
      }
      
      // Early exit if we have enough results
      if (exactMatches.length + partialMatches.length + containsMatches.length >= maxResults * 2) {
        break;
      }
    }
    
    return [
      ...exactMatches,
      ...partialMatches,
      ...containsMatches
    ].slice(0, maxResults);
  }

  // Clear all performance caches
  static clearAllCaches(): void {
    calculationCache.clear();
    console.log('🧹 Performance caches cleared');
  }
}