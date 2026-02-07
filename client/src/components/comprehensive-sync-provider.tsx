/**
 * COMPREHENSIVE SYNC PROVIDER
 * Automatically triggers real-time sync across ALL loan operations and ALL cashbook forms
 * सर्व कर्ज व्यवहार आणि रोकडबुक ऑटोमॅटिक सिंक्रोनाइझेशन
 */

import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealTimeSync } from '@/hooks/use-real-time-sync';

interface SyncContextType {
  triggerLoanSync: (operationType: string, loanData?: any) => Promise<void>;
  triggerCashSync: () => Promise<void>;
  triggerCompleteSync: () => Promise<void>;
  isEnabled: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface ComprehensiveSyncProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
}

export function ComprehensiveSyncProvider({ 
  children, 
  enabled = true 
}: ComprehensiveSyncProviderProps) {
  const queryClient = useQueryClient();
  const { triggerCompleteSync, syncLoanOperation } = useRealTimeSync({
    enabled,
    onSyncComplete: (operation) => {
      console.log(`🌐 COMPREHENSIVE SYNC: Operation ${operation} completed across all forms`);
    },
    onSyncError: (error) => {
      console.error('🌐 COMPREHENSIVE SYNC: Error:', error);
    }
  });

  /**
   * Trigger sync specifically for loan operations
   */
  const triggerLoanSync = useCallback(async (operationType: string, loanData?: any) => {
    if (!enabled) return;

    try {
      console.log(`🔄 LOAN SYNC: Triggering sync for ${operationType}`);
      
      // Use the comprehensive sync engine
      await syncLoanOperation(operationType, loanData);
      
      // Emit custom event for other components
      window.dispatchEvent(new CustomEvent('loan-operation', {
        detail: { type: operationType, data: loanData }
      }));

      console.log(`✅ LOAN SYNC: ${operationType} sync completed`);
    } catch (error) {
      console.error(`❌ LOAN SYNC: ${operationType} sync failed:`, error);
    }
  }, [enabled, syncLoanOperation]);

  /**
   * Trigger sync specifically for cash transactions
   */
  const triggerCashSync = useCallback(async () => {
    if (!enabled) return;

    try {
      console.log('🔄 CASH SYNC: Triggering cash transaction sync');
      
      // Invalidate all cash-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance"] });
      
      // Force refetch critical queries
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] }),
        queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] }),
        queryClient.refetchQueries({ queryKey: ["/api/mobile-cashbook"] })
      ]);

      // Emit custom event
      window.dispatchEvent(new CustomEvent('cash-transaction-updated', {
        detail: { type: 'CASH_SYNC' }
      }));

      console.log('✅ CASH SYNC: Cash transaction sync completed');
    } catch (error) {
      console.error('❌ CASH SYNC: Cash transaction sync failed:', error);
    }
  }, [enabled, queryClient]);

  const contextValue: SyncContextType = {
    triggerLoanSync,
    triggerCashSync,
    triggerCompleteSync,
    isEnabled: enabled
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
}

/**
 * Hook to use the comprehensive sync context
 */
export function useComprehensiveSync(): SyncContextType {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useComprehensiveSync must be used within a ComprehensiveSyncProvider');
  }
  return context;
}

/**
 * Hook specifically for loan operations
 */
export function useLoanOperationSync() {
  const { triggerLoanSync, isEnabled } = useComprehensiveSync();

  const syncAfterLoanCreate = useCallback(async (loanData: any) => {
    await triggerLoanSync('CREATE', loanData);
  }, [triggerLoanSync]);

  const syncAfterLoanUpdate = useCallback(async (oldData: any, newData: any) => {
    await triggerLoanSync('UPDATE', { oldData, newData });
  }, [triggerLoanSync]);

  const syncAfterLoanDelete = useCallback(async (loanData: any) => {
    await triggerLoanSync('DELETE', loanData);
  }, [triggerLoanSync]);

  const syncAfterLoanClose = useCallback(async (loanData: any, closureData: any) => {
    await triggerLoanSync('CLOSE', { ...loanData, closureData });
  }, [triggerLoanSync]);

  const syncAfterLoanReopen = useCallback(async (loanData: any) => {
    await triggerLoanSync('REOPEN', loanData);
  }, [triggerLoanSync]);

  return {
    syncAfterLoanCreate,
    syncAfterLoanUpdate,
    syncAfterLoanDelete,
    syncAfterLoanClose,
    syncAfterLoanReopen,
    isEnabled
  };
}

/**
 * Hook specifically for cash transaction operations
 */
export function useCashTransactionSync() {
  const { triggerCashSync, isEnabled } = useComprehensiveSync();

  const syncAfterCashCreate = useCallback(async () => {
    await triggerCashSync();
  }, [triggerCashSync]);

  const syncAfterCashUpdate = useCallback(async () => {
    await triggerCashSync();
  }, [triggerCashSync]);

  const syncAfterCashDelete = useCallback(async () => {
    await triggerCashSync();
  }, [triggerCashSync]);

  return {
    syncAfterCashCreate,
    syncAfterCashUpdate,
    syncAfterCashDelete,
    isEnabled
  };
}