import NodeCache from "node-cache";
import memoize from "memoizee";

// Performance-optimized cache system
export class PerformanceCache {
  private cache: NodeCache;
  private queryCache: NodeCache;
  private computationCache: NodeCache;

  constructor() {
    // Main cache - 10 minutes TTL, check period 2 minutes
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
    
    // Query cache - 5 minutes TTL for database results
    this.queryCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
    
    // Computation cache - 15 minutes TTL for expensive calculations
    this.computationCache = new NodeCache({ stdTTL: 900, checkperiod: 180 });
  }

  // Generic cache methods
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttl?: number): void {
    this.cache.set(key, value, ttl || 600);
  }

  // Query-specific cache
  getQuery<T>(key: string): T | undefined {
    return this.queryCache.get<T>(key);
  }

  setQuery<T>(key: string, value: T, ttl?: number): void {
    this.queryCache.set(key, value, ttl || 300);
  }

  // Computation-specific cache
  getComputation<T>(key: string): T | undefined {
    return this.computationCache.get<T>(key);
  }

  setComputation<T>(key: string, value: T, ttl?: number): void {
    this.computationCache.set(key, value, ttl || 900);
  }

  // Cache invalidation methods
  invalidatePattern(pattern: string): void {
    const keys = this.cache.keys();
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.del(key);
      }
    });

    const queryKeys = this.queryCache.keys();
    queryKeys.forEach(key => {
      if (key.includes(pattern)) {
        this.queryCache.del(key);
      }
    });

    const computationKeys = this.computationCache.keys();
    computationKeys.forEach(key => {
      if (key.includes(pattern)) {
        this.computationCache.del(key);
      }
    });
  }

  // Tenant-specific invalidation
  invalidateTenant(tenantId: string): void {
    this.invalidatePattern(tenantId);
  }

  // Clear all caches
  clear(): void {
    this.cache.flushAll();
    this.queryCache.flushAll();
    this.computationCache.flushAll();
  }

  // Get cache statistics
  getStats() {
    return {
      main: this.cache.getStats(),
      query: this.queryCache.getStats(),
      computation: this.computationCache.getStats()
    };
  }
}

// Singleton instance
export const performanceCache = new PerformanceCache();

// Memoized computation functions
export const memoizedCalculations = {
  // Memoized interest calculation
  calculateInterest: memoize(
    (principal: number, rate: number, days: number, rateType: string) => {
      if (rateType === 'yearly') {
        return (principal * rate * days) / (100 * 365);
      } else {
        return (principal * rate * days) / (100 * 30);
      }
    },
    { maxAge: 900000, max: 1000 } // 15 minutes, max 1000 entries
  ),

  // Memoized date formatting
  formatDate: memoize(
    (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB');
    },
    { maxAge: 3600000, max: 500 } // 1 hour, max 500 entries
  ),

  // Memoized amount formatting
  formatAmount: memoize(
    (amount: number) => {
      return new Intl.NumberFormat('en-IN').format(Math.floor(amount));
    },
    { maxAge: 3600000, max: 1000 } // 1 hour, max 1000 entries
  ),

  // Memoized search processing
  processSearchTerm: memoize(
    (searchTerm: string) => {
      return searchTerm.toLowerCase().trim();
    },
    { maxAge: 1800000, max: 200 } // 30 minutes, max 200 entries
  )
};

// Cache warming functions
export const cacheWarming = {
  // Pre-load frequently accessed data
  warmTenantData: async (tenantId: string, storage: any) => {
    try {
      // Warm up groups cache
      const groups = await storage.getGroups(tenantId);
      performanceCache.setQuery(`groups:${tenantId}`, groups);

      // Warm up company cache  
      const company = await storage.getCompany(tenantId);
      performanceCache.setQuery(`company:${tenantId}`, company);

      console.log(`🔥 Cache warmed for tenant: ${tenantId}`);
    } catch (error) {
      console.error(`❌ Cache warming failed for tenant ${tenantId}:`, error);
    }
  }
};