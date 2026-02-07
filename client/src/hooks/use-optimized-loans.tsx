import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

// Optimized loans hook with aggressive memoization
export function useOptimizedLoans() {
  const { data: loans, isLoading, error } = useQuery({
    queryKey: ["/api/loans"],
    staleTime: 2 * 60 * 1000, // 2 minutes - data is considered fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
  });

  const { data: groups } = useQuery({
    queryKey: ["/api/groups"],
    staleTime: 5 * 60 * 1000, // 5 minutes - groups change rarely
    gcTime: 15 * 60 * 1000, // 15 minutes cache
  });

  const { data: borrowers } = useQuery({
    queryKey: ["/api/borrowers"],
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000,
  });

  // Memoized processed data
  const processedData = useMemo(() => {
    if (!loans || !Array.isArray(loans)) return { loans: [], stats: null };

    const stats = {
      total: loans.length,
      active: loans.filter((l: any) => l.status === 'active').length,
      closed: loans.filter((l: any) => l.status === 'closed').length,
    };

    return { loans, stats };
  }, [loans]);

  // Memoized group mapping for faster lookups
  const groupMap = useMemo(() => {
    if (!groups || !Array.isArray(groups)) return new Map();
    return new Map(groups.map((group: any) => [group.id, group.name]));
  }, [groups]);

  // Memoized borrower mapping
  const borrowerMap = useMemo(() => {
    if (!borrowers || !Array.isArray(borrowers)) return new Map();
    return new Map(borrowers.map((borrower: any) => [borrower.id, borrower]));
  }, [borrowers]);

  return {
    loans: processedData.loans,
    stats: processedData.stats,
    groupMap,
    borrowerMap,
    isLoading,
    error
  };
}