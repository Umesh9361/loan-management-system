import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useLocation } from "wouter";
import { Shield } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  adminOnly?: boolean;
  userRole?: string;
}

export function ProtectedRoute({ children, permission, adminOnly }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { user, authReady, isLoading } = useCurrentUser();

  // Get user permissions if regular user with aggressive caching
  const { data: userPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["/api/user-permissions"],
    enabled: !!user && user.role === 'user',
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes retention
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    retry: 1 // Quick retry only
  });

  // Show loading state while auth is not ready
  if (!authReady || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is null (unauthenticated), navigate to login once
  if (!user) {
    setLocation("/login");
    return null;
  }

  // Check admin-only route access
  if (adminOnly && user.role !== 'admin' && user.role !== 'super_admin') {
    return <NoPermissionPage />;
  }

  // Check permission-based access for regular users
  if (permission && user.role === 'user') {
    // Show loading state while permissions are loading
    if (permissionsLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-xs text-gray-500">Checking permissions...</p>
          </div>
        </div>
      );
    }

    // If user lacks the required permission, show no permission page
    if (!userPermissions || !(userPermissions as any)[permission]) {
      return <NoPermissionPage />;
    }
  }

  // All checks passed - render the protected content
  return <>{children}</>;
}

export function NoPermissionPage() {
  const { safeNavigate, isNavigating } = useSafeNavigation();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <Shield className="h-6 w-6 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">परवानगी नाही</h1>
        <p className="text-gray-600 mb-6">
          या पृष्ठावर प्रवेश करण्यासाठी तुम्हाला परवानगी नाही आहे।
          <br />
          कृपया तुमच्या एडमिनशी संपर्क साधा.
        </p>
        <button
          onClick={() => safeNavigate("/")}
          disabled={isNavigating}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
        >
          {isNavigating ? 'जात आहे...' : 'मुख्यपृष्ठावर परत जा'}
        </button>
      </div>
    </div>
  );
}