import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export interface CurrentUser {
  id: string;
  username: string;
  role: 'user' | 'admin' | 'super_admin';
  tenantId: string;
}

/**
 * Stable authentication hook with proper 401 handling and race condition prevention
 * Returns null for user when unauthenticated, preventing transient auth errors
 */
export function useCurrentUser() {
  const query = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn<CurrentUser | null>({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000, // 5 minutes cache for stable auth state
    gcTime: 10 * 60 * 1000, // 10 minutes retention
    refetchOnWindowFocus: false, // Prevent auth refetch on focus
    retry: 1, // Quick retry only
    refetchInterval: false, // No automatic polling
    placeholderData: keepPreviousData, // Prevent auth flicker during navigation
    refetchOnReconnect: false, // Prevent reconnect auth checks
  });

  return {
    user: query.data,
    authReady: !query.isLoading && !query.isPending, // Auth state is known
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}