/**
 * COMPREHENSIVE REAL-TIME SYNCHRONIZATION HOOK
 * Provides real-time updates for ALL cashbook forms when loan operations occur
 * सर्व कर्ज व्यवहार ऑटोमॅटिक रोकडबुक अपडेट
 */

import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface RealTimeSyncConfig {
  enabled?: boolean;
  invalidateQueries?: boolean;
  refetchQueries?: boolean;
  onSyncComplete?: (operation: string) => void;
  onSyncError?: (error: Error) => void;
}

/**
 * Hook for comprehensive real-time synchronization across ALL forms
 */
export function useRealTimeSync(config: RealTimeSyncConfig = {}) {
  const queryClient = useQueryClient();
  
  const {
    enabled = true,
    invalidateQueries = true,
    refetchQueries = true,
    onSyncComplete,
    onSyncError
  } = config;

  /**
   * Comprehensive cache invalidation for ALL cashbook forms
   */
  const invalidateAllCashbookCaches = useCallback(async () => {
    if (!enabled || !invalidateQueries) return;

    try {
      // Core cash data queries
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance"] });
      
      // Mobile cashbook queries
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook-balance"] });
      
      // Fixed cashbook queries
      queryClient.invalidateQueries({ queryKey: ["cashbook-fixed"] });
      queryClient.invalidateQueries({ queryKey: ["fixed-cashbook-data"] });
      
      // Working cashbook queries  
      queryClient.invalidateQueries({ queryKey: ["working-cashbook"] });
      queryClient.invalidateQueries({ queryKey: ["working-cashbook-data"] });
      
      // All cashbook report queries
      queryClient.invalidateQueries({ queryKey: ["cashbook"] });
      queryClient.invalidateQueries({ queryKey: ["cashbook-data"] });
      queryClient.invalidateQueries({ queryKey: ["simple-cashbook"] });
      queryClient.invalidateQueries({ queryKey: ["cashbook-ledger"] });
      
      // Loan-related queries (for balance calculations)
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-closures"] });
      
      // Party and journal queries
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      
      // Capital and account queries
      queryClient.invalidateQueries({ queryKey: ["/api/capital-account"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger"] });
      
      onSyncComplete?.('CACHE_INVALIDATION');
      
    } catch (error) {
      onSyncError?.(error as Error);
    }
  }, [enabled, invalidateQueries, queryClient, onSyncComplete, onSyncError]);

  /**
   * Force refetch critical queries for immediate updates
   */
  const refetchCriticalQueries = useCallback(async () => {
    if (!enabled || !refetchQueries) return;

    try {
      // Force refetch the most important queries
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] }),
        queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] }),
        queryClient.refetchQueries({ queryKey: ["/api/mobile-cashbook"] }),
        queryClient.refetchQueries({ queryKey: ["/api/loans"] })
      ]);

      onSyncComplete?.('QUERY_REFETCH');
      
    } catch (error) {
      onSyncError?.(error as Error);
    }
  }, [enabled, refetchQueries, queryClient, onSyncComplete, onSyncError]);

  /**
   * Complete synchronization - invalidate and refetch
   */
  const triggerCompleteSync = useCallback(async () => {
    if (!enabled) return;

    try {
      // First invalidate all caches
      await invalidateAllCashbookCaches();
      
      // Then refetch critical queries for immediate updates
      await refetchCriticalQueries();

      onSyncComplete?.('COMPLETE_SYNC');
      
    } catch (error) {
      onSyncError?.(error as Error);
    }
  }, [enabled, invalidateAllCashbookCaches, refetchCriticalQueries, onSyncComplete, onSyncError]);

  /**
   * Specific sync for loan operations
   */
  const syncLoanOperation = useCallback(async (operationType: string, loanData?: any) => {
    if (!enabled) return;

    try {
      // Immediate cache invalidation
      await invalidateAllCashbookCaches();

      // For specific operations, trigger targeted refetch
      if (operationType === 'CREATE' || operationType === 'CLOSE' || operationType === 'DELETE') {
        await refetchCriticalQueries();
      }

      onSyncComplete?.(operationType);
      
    } catch (error) {
      onSyncError?.(error as Error);
    }
  }, [enabled, invalidateAllCashbookCaches, refetchCriticalQueries, onSyncComplete, onSyncError]);

  /**
   * Listen for storage events (if implemented)
   */
  useEffect(() => {
    if (!enabled) return;

    // Custom event listener for real-time updates
    const handleStorageUpdate = (event: CustomEvent) => {
      const { type, data } = event.detail;
      syncLoanOperation(type, data);
    };

    // Listen for custom events
    window.addEventListener('loan-operation' as any, handleStorageUpdate);
    window.addEventListener('cash-transaction-updated' as any, handleStorageUpdate);
    
    return () => {
      window.removeEventListener('loan-operation' as any, handleStorageUpdate);
      window.removeEventListener('cash-transaction-updated' as any, handleStorageUpdate);
    };
  }, [enabled, syncLoanOperation]);

  return {
    invalidateAllCaches: invalidateAllCashbookCaches,
    refetchCriticalQueries,
    triggerCompleteSync,
    syncLoanOperation,
    isEnabled: enabled
  };
}

/**
 * Hook specifically for cashbook forms
 */
export function useCashbookRealTimeSync() {
  const queryClient = useQueryClient();

  const syncCashbookData = useCallback(async () => {
    // Invalidate all cashbook-related queries
    queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"] });
    queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
    
    // Force immediate refetch for instant updates
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] }),
      queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] }),
      queryClient.refetchQueries({ queryKey: ["/api/mobile-cashbook"] })
    ]);
  }, [queryClient]);

  return { syncCashbookData };
}

/**
 * Hook for automatic sync on mutations
 */
export function useAutoSync() {
  const { triggerCompleteSync } = useRealTimeSync();

  const withAutoSync = useCallback(async (operation: () => Promise<any>, operationType?: string) => {
    try {
      const result = await operation();
      
      // Trigger sync after successful operation
      await triggerCompleteSync();
      
      return result;
    } catch (error) {
      throw error;
    }
  }, [triggerCompleteSync]);

  return { withAutoSync };
}