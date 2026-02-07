import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';

/**
 * Safe navigation hook that prevents multiple clicks and provides loading states
 */
export function useSafeNavigation() {
  const [, setLocation] = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  const navigateWithDebounce = useCallback((path: string, delay: number = 500) => {
    if (isNavigating) return; // Prevent multiple clicks
    
    setIsNavigating(true);
    
    // Use setTimeout to prevent rapid clicking
    setTimeout(() => {
      setLocation(path);
      // Reset after navigation
      setTimeout(() => setIsNavigating(false), 300);
    }, 50);
  }, [setLocation, isNavigating]);

  const safeNavigate = useCallback((path: string) => {
    navigateWithDebounce(path);
  }, [navigateWithDebounce]);

  return {
    safeNavigate,
    isNavigating
  };
}