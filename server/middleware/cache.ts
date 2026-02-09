import type { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';

// Initialize cache with smart TTL settings
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default
  checkperiod: 60, // Check for expired keys every minute
  useClones: false // Better performance for read-heavy workloads
});

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

/**
 * Smart caching middleware for API endpoints
 * Automatically handles tenant-specific caching and cache invalidation
 */
export function apiCache(options: CacheOptions = {}) {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator = (req: Request) => {
      const tenantId = req.session?.tenantId || 'no-tenant';
      const path = req.originalUrl;
      const method = req.method;
      return `${method}:${tenantId}:${path}`;
    },
    condition = () => true
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching if condition not met
    if (!condition(req)) {
      return next();
    }

    const cacheKey = keyGenerator(req);
    
    // Try to get from cache
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      res.set('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    // Cache miss - continue to actual handler
    res.set('X-Cache', 'MISS');

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (data: any) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, data, ttl);
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Invalidate cache entries by pattern
 */
export function invalidateCache(pattern: string, tenantId?: string) {
  const keys = cache.keys();
  
  // Build multiple patterns to match different cache key formats
  const patterns: string[] = [];
  if (tenantId) {
    patterns.push(`${tenantId}:${pattern}`);
    patterns.push(`GET:${tenantId}:/api/${pattern}`);
    patterns.push(`POST:${tenantId}:/api/${pattern}`);
  } else {
    patterns.push(pattern);
  }
  
  let invalidatedCount = 0;
  keys.forEach(key => {
    const shouldDelete = patterns.some(p => key.includes(p.replace(':', '')));
    if (shouldDelete) {
      cache.del(key);
      invalidatedCount++;
    }
  });
  
  return invalidatedCount;
}

/**
 * Invalidate all cache for a specific tenant
 */
export function invalidateTenantCache(tenantId: string) {
  return invalidateCache('', tenantId);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const stats = cache.getStats();
  const keys = cache.keys();
  
  return {
    keys: stats.keys,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits / (stats.hits + stats.misses) || 0,
    memoryUsage: keys.length,
    keyDetails: keys.slice(0, 10) // Show first 10 keys for debugging
  };
}

/**
 * Middleware for cache-busting when data changes
 */
export function cacheBuster(patterns: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.session?.tenantId;
    
    // Override response to invalidate cache after successful operations
    const originalJson = res.json.bind(res);
    res.json = (data: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && tenantId) {
        let totalInvalidated = 0;
        patterns.forEach(pattern => {
          totalInvalidated += invalidateCache(pattern, tenantId);
        });
        
        // Force clear specific cache keys to ensure fresh data
        if (patterns.some(p => p.includes('groups'))) {
          const forceClearKey = `GET:${tenantId}:/api/groups`;
          cache.del(forceClearKey);
        }
      }
      return originalJson(data);
    };

    next();
  };
}

export { cache };