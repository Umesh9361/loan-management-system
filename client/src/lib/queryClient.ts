import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiConfig } from "./api-config";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  method: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${apiConfig.baseURL}${url}`;
  
  // Always include headers for consistency, especially for authentication
  const headers = { ...apiConfig.headers };
  
  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: apiConfig.credentials,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Ensure queryKey is properly formatted as strings
    const urlParts = queryKey.filter(part => typeof part === 'string');
    const url = urlParts.join("/") as string;
    const fullUrl = url.startsWith('http') ? url : `${apiConfig.baseURL}${url}`;
    const res = await fetch(fullUrl, {
      credentials: apiConfig.credentials,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // Prevent unnecessary refetches for performance
      staleTime: 2 * 60 * 1000, // 2 minutes cache for better performance
      gcTime: 10 * 60 * 1000, // 10 minutes retention for faster loading
      retry: 1, // Quick retry only for better performance
      refetchOnReconnect: false, // Prevent excessive API calls
    },
    mutations: {
      retry: false,
    },
  },
});
