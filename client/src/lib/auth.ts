import { queryClient } from "./queryClient";
import { apiConfig } from "./api-config";

export interface User {
  id: string;
  username: string;
  tenantId: string;
  role: string;
}

export interface LoginCredentials {
  tenantId: string;
  username: string;
  password: string;
}

export class AuthService {
  static async login(credentials: LoginCredentials): Promise<User> {
    const response = await fetch(`${apiConfig.baseURL}/api/auth/login`, {
      method: "POST",
      headers: apiConfig.headers,
      body: JSON.stringify(credentials),
      credentials: apiConfig.credentials,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    const data = await response.json();
    return data.user;
  }

  static async logout(): Promise<void> {
    try {
      const response = await fetch(`${apiConfig.baseURL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.warn('Logout API call failed, but continuing with client-side cleanup');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Always clear client-side data regardless of API response
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch(`${apiConfig.baseURL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        cache: 'no-cache'
      });

      if (!response.ok) {
        // Silently handle 401 errors - user not authenticated
        if (response.status === 401) {
          return null;
        }
        // Log other errors for debugging
        console.warn('AuthService: Request failed with status:', response.status);
        return null;
      }

      const data = await response.json();
      
      // Handle both response formats: {user: {...}} or direct {...}
      return data.user || data;
    } catch (error) {
      // Network or parsing errors - silently handle
      return null;
    }
  }
}
