// Enhanced API configuration for all environments
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    
    // For Replit domains (production/preview)
    if (currentOrigin.includes('replit.app') || currentOrigin.includes('replit.dev') || currentOrigin.includes('replit.co')) {
      return currentOrigin;
    }
    
    // For local development - handle Vite dev server
    if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
      // If on Vite dev server port (5173), point to Express server
      if (currentOrigin.includes(':5173')) {
        return 'http://localhost:5000';
      }
      // Already on Express server port
      return currentOrigin;
    }
    
    // Fallback to current origin
    return currentOrigin;
  }
  
  // SSR fallback
  return '';
};

export const apiConfig = {
  baseURL: getApiBaseUrl(),
  credentials: 'include' as RequestCredentials,
  headers: {
    'Content-Type': 'application/json',
  },
};