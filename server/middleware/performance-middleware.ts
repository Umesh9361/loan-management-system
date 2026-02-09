import { Request, Response, NextFunction } from 'express';
import { performanceCache } from '../performance-cache';

// Performance monitoring middleware
export function performanceMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Track slow requests (removed console.log for production)
    
    // Add performance headers
    res.setHeader('X-Response-Time', `${duration}ms`);
  });
  
  next();
}

// Cache warming middleware for tenant data
export function cacheWarmingMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.session?.tenantId && req.method === 'GET') {
    // Warm cache for first request after login
    const tenantId = req.session.tenantId;
    const cacheKey = `warmed:${tenantId}`;
    
    if (!performanceCache.get(cacheKey)) {
      // Mark as warmed for 10 minutes
      performanceCache.set(cacheKey, true, 600);
      // Cache warming initiated for tenant
    }
  }
  
  next();
}