import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiConfig } from "@/lib/api-config";

export interface CurrentUser {
  id: string;
  username: string;
  role: 'user' | 'admin' | 'super_admin';
  tenantId: string;
}

function normalizeRole(role: string | undefined): string {
  if (!role) return '';
  const r = role.trim().toLowerCase();
  return r === 'clerk' ? 'user' : r;
}

function unwrapUser(data: any): CurrentUser | null {
  if (!data) return null;
  const raw = data.user || (data.id && data.role ? data : null);
  if (!raw) return null;
  return { ...raw, role: normalizeRole(raw.role) };
}

export function useCurrentUser() {
  const query = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const res = await fetch(`${apiConfig.baseURL}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          cache: 'no-cache'
        });
        if (!res.ok) {
          if (res.status === 401) return null;
          return null;
        }
        const data = await res.json();
        return unwrapUser(data);
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
    refetchInterval: false,
    placeholderData: keepPreviousData,
    refetchOnReconnect: true,
  });

  return {
    user: query.data as CurrentUser | null,
    authReady: !query.isLoading && !query.isPending,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}