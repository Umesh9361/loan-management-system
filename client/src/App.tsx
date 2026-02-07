import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ReportsNavFix, reportsFixStyles } from "@/components/reports-nav-fix";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/providers/I18nProvider";
import { useQuery } from "@tanstack/react-query";
import { AuthService } from "./lib/auth";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { BottomNavigation } from "@/components/bottom-navigation";

// Import date locale setup
import "@/lib/date-locale";
import NotFound from "@/pages/not-found";
import { NoPermissionPage } from "@/components/ProtectedRoute";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Company from "@/pages/company";
import Groups from "@/pages/groups";
import Loans from "@/pages/loans";
import Closure from "@/pages/closure";


import InterestCalculator from "@/pages/calculator";
import CashDashboard from "@/pages/cash-dashboard";
import CashTransactions from "@/pages/cash-transactions";
import CashBook from "@/pages/reports/cashbook";
import WorkingCashBook from "@/pages/reports/working-cashbook";
import Capital from "@/pages/reports/capital";
import WorkingCapital from "@/pages/reports/working-capital";
import CapitalAccount from "@/pages/reports/capital-account";

import AccountLedger from "@/pages/reports/account-ledger";
import WorkingSummary from "@/pages/reports/working-summary";
import ClosureReceiptPage from "@/pages/receipt/closure";
import AnnualStatementPage from "@/pages/receipt/annual-statement";
import ReceiptGeneratorPage from "@/pages/reports/receipt-generator";
import BorrowerListReports from "@/pages/reports/borrower-list";
import AccountSummaryReport from "@/pages/reports/account-summary";
import OverdueReport from "@/pages/reports/overdue";
import OtherReports from "@/pages/reports/other";

import SuperAdmin from "@/pages/super-admin";
import SuperAdminTenants from "@/pages/super-admin-tenants";
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import SuperAdminHome from "@/pages/super-admin-home";
import { SuperAdminPasswordRequests } from "@/pages/super-admin-password-requests";
import SuperAdminTenantManagement from "@/pages/super-admin-tenant-management";
import Profile from "@/pages/profile";
import StorageSettings from "@/pages/storage-settings";
import MobileCashbook from "@/pages/mobile-cashbook";
import DataManagement from "@/pages/data-management";
import ActivityLogPage from "@/pages/activity-log";
import UserManagement from "@/pages/user-management";
import PartyManagement from "@/pages/party-management";

function AppContent() {
  const { safeNavigate } = useSafeNavigation();
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const userData = await AuthService.getCurrentUser();
      return userData;
    },
    retry: false, // Don't retry 401 errors
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false, // Prevent unnecessary refetches
  });

  // Fetch user permissions for dynamic routing with aggressive caching
  const { data: userPermissions } = useQuery({
    queryKey: ["/api/user-permissions"],
    enabled: !!user && user.role === 'user', // Only fetch for regular users
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - permissions don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
    refetchOnWindowFocus: false, // Don't refetch on focus for better performance
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <Login />;
  }

  // FIX: Handle nested user structure + normalize role for consistency  
  const actualUser = (user as any)?.user || user; // Handle both {user: {...}} and direct {...} formats
  
  // Normalize role to prevent auth fallback from 'clerk' or whitespace issues
  if (actualUser && actualUser.role) {
    const normalizedRole = actualUser.role.trim().toLowerCase();
    // Map legacy 'clerk' to 'user' for compatibility
    if (normalizedRole === 'clerk') {
      actualUser.role = 'user';
    }
  }
  
  // Super Admin Routes - COMPLETE ACCESS to ALL features including Super Admin management
  if (actualUser.role === 'super_admin') {
    return (
      <div className="pb-16"> {/* Add padding for bottom nav */}
        <Switch>
          <Route path="/" component={Dashboard} />
        
        {/* Super Admin Exclusive Routes */}
        <Route path="/super-admin-dashboard" component={SuperAdminDashboard} />
        <Route path="/super-admin-home" component={SuperAdminHome} />
        <Route path="/super-admin" component={SuperAdmin} />
        <Route path="/super-admin/tenants" component={SuperAdminTenants} />
        <Route path="/super-admin/password-requests" component={SuperAdminPasswordRequests} />
        <Route path="/super-admin-tenant-management" component={SuperAdminTenantManagement} />
        <Route path="/storage-settings" component={StorageSettings} />
        
        {/* Core Management Routes */}
        <Route path="/company" component={Company} />
        <Route path="/groups" component={Groups} />
        <Route path="/loans" component={Loans} />
        <Route path="/closure" component={Closure} />
        
        {/* Financial Management Routes */}
        <Route path="/cash-transactions" component={CashTransactions} />
        <Route path="/cash-dashboard" component={CashDashboard} />
        <Route path="/party-management" component={PartyManagement} />
        <Route path="/mobile-cashbook" component={MobileCashbook} />
        <Route path="/calculator" component={InterestCalculator} />
        
        {/* Administration Routes */}
        <Route path="/user-management" component={UserManagement} />
        <Route path="/data-management" component={DataManagement} />
        <Route path="/activity-log" component={ActivityLogPage} />
        
        {/* All Report Routes - Complete Access */}
        <Route path="/reports/cashbook" component={CashBook} />
        <Route path="/reports/working-cashbook" component={WorkingCashBook} />
        <Route path="/reports/capital" component={Capital} />
        <Route path="/reports/capital-account" component={CapitalAccount} />
        <Route path="/reports/working-capital" component={WorkingCapital} />
        <Route path="/reports/account-ledger" component={AccountLedger} />
        <Route path="/reports/account-summary" component={AccountSummaryReport} />
        <Route path="/reports/working-summary" component={WorkingSummary} />
        <Route path="/reports/borrower-list" component={BorrowerListReports} />

        <Route path="/reports/overdue" component={OverdueReport} />
        <Route path="/reports/other" component={OtherReports} />
        <Route path="/reports/receipt-generator" component={ReceiptGeneratorPage} />
        <Route path="/reports/receipt">{() => { window.location.replace('/reports/receipt-generator'); return null; }}</Route>
        
        {/* Receipt and Profile Routes */}
          <Route path="/receipt/closure/:loanId" component={ClosureReceiptPage} />
          <Route path="/receipt/annual-statement" component={AnnualStatementPage} />
          <Route path="/profile" component={Profile} />
          
          <Route component={NotFound} />
        </Switch>
        <BottomNavigation userRole="super_admin" />
      </div>
    );
  }

  // User Role Routes - DYNAMIC ACCESS based on Admin-granted permissions
  if (actualUser.role === 'user') {
    const perms = (userPermissions as any) || {};
    
    return (
      <div className="pb-16"> {/* Add padding for bottom nav */}
        <Switch>
          {/* Always available routes */}
          <Route path="/" component={Dashboard} />
        {/* Profile page removed for normal users - Admin/Super Admin only */}
        
        {/* Core Features - Permission controlled */}
        {perms.canAccessCompanyRegistration && <Route path="/company" component={Company} />}
        {perms.canAccessGroupManagement && <Route path="/groups" component={Groups} />}
        {perms.canAccessLoanRegistration && <Route path="/loans" component={Loans} />}
        {perms.canAccessLoanClosure && <Route path="/closure" component={Closure} />}
        {/* Bulk closure feature removed - single closure only */}
        {perms.canAccessCashTransactions && <Route path="/cash-transactions" component={CashTransactions} />}
        {perms.canAccessCashTransactions && <Route path="/cash-dashboard" component={CashDashboard} />}
        {perms.canAccessPartyManagement && <Route path="/party-management" component={PartyManagement} />}
        {perms.canAccessMobileCashbook && <Route path="/mobile-cashbook" component={MobileCashbook} />}
        {perms.canAccessInterestCalculator && <Route path="/calculator" component={InterestCalculator} />}
        
        {/* Admin Functions - REMOVED: Regular users should never access admin panels */}
        {/* User Management और Data Management admin-only features हैं */}
        
        {/* Reports - Permission controlled */}
        {perms.canViewReceiptGenerator && <Route path="/reports/receipt-generator" component={ReceiptGeneratorPage} />}
        {perms.canViewReceiptGenerator && <Route path="/reports/receipt">{() => { window.location.replace('/reports/receipt-generator'); return null; }}</Route>}
        {perms.canViewCashBookReport && <Route path="/reports/cashbook" component={CashBook} />}
        {perms.canViewCashBookReport && <Route path="/reports/working-cashbook" component={WorkingCashBook} />}
        {perms.canViewCapitalReport && <Route path="/reports/capital" component={Capital} />}
        {perms.canViewCapitalReport && <Route path="/reports/capital-account" component={CapitalAccount} />}
        {perms.canViewCapitalReport && <Route path="/reports/working-capital" component={WorkingCapital} />}
        {perms.canViewLedgerReport && <Route path="/reports/account-ledger" component={AccountLedger} />}
        {perms.canViewAccountSummaryReport && <Route path="/reports/account-summary" component={AccountSummaryReport} />}
        {perms.canViewLedgerReport && <Route path="/reports/working-summary" component={WorkingSummary} />}
        {perms.canViewBorrowerListReport && <Route path="/reports/borrower-list" component={BorrowerListReports} />}
        {perms.canViewOverdueReport && <Route path="/reports/overdue" component={OverdueReport} />}
        {perms.canViewOtherReports && <Route path="/reports/other" component={OtherReports} />}
        
        {/* Receipt routes - Only if loan closure permitted */}
          {perms.canAccessLoanClosure && <Route path="/receipt/closure/:loanId" component={ClosureReceiptPage} />}
          {perms.canViewReceiptGenerator && <Route path="/receipt/annual-statement" component={AnnualStatementPage} />}
          
          <Route component={NoPermissionPage} />
        </Switch>
        <BottomNavigation userRole="user" />
      </div>
    );
  }

  // Admin Routes - Full access to all features for TENANT ADMINS only (excluding Super Admin management)
  if (actualUser.role === 'admin') {
    return (
      <div className="pb-16"> {/* Add padding for bottom nav */}
        <Switch>
          <Route path="/" component={Dashboard} />
        <Route path="/company" component={Company} />
        <Route path="/groups" component={Groups} />
        <Route path="/loans" component={Loans} />
        <Route path="/closure" component={Closure} />
        <Route path="/cash-transactions" component={CashTransactions} />
        <Route path="/cash-dashboard" component={CashDashboard} />
        <Route path="/party-management" component={PartyManagement} />
        <Route path="/mobile-cashbook" component={MobileCashbook} />
        <Route path="/calculator" component={InterestCalculator} />
        <Route path="/user-management" component={UserManagement} />
        <Route path="/data-management" component={DataManagement} />
        <Route path="/activity-log" component={ActivityLogPage} />
        <Route path="/storage-settings" component={StorageSettings} />
        <Route path="/reports/receipt-generator" component={ReceiptGeneratorPage} />
        <Route path="/reports/receipt">{() => { window.location.replace('/reports/receipt-generator'); return null; }}</Route>
        <Route path="/reports/cashbook" component={CashBook} />
        <Route path="/reports/working-cashbook" component={WorkingCashBook} />
        <Route path="/reports/capital" component={Capital} />
        <Route path="/reports/capital-account" component={CapitalAccount} />
        <Route path="/reports/working-capital" component={WorkingCapital} />
        <Route path="/reports/account-ledger" component={AccountLedger} />
        <Route path="/reports/account-summary" component={AccountSummaryReport} />
        <Route path="/reports/working-summary" component={WorkingSummary} />
        <Route path="/reports/borrower-list" component={BorrowerListReports} />
        <Route path="/reports/overdue" component={OverdueReport} />
        <Route path="/reports/other" component={OtherReports} />
          <Route path="/receipt/closure/:loanId" component={ClosureReceiptPage} />
          <Route path="/receipt/annual-statement" component={AnnualStatementPage} />
          <Route path="/profile" component={Profile} />
          <Route component={NotFound} />
        </Switch>
        <BottomNavigation userRole="admin" />
      </div>
    );
  }

  // Enhanced debugging for auth fallback
  console.debug("🔍 AUTH FALLBACK:", { 
    role: actualUser?.role, 
    roleType: typeof actualUser?.role,
    actualUser: actualUser,
    path: window.location.pathname 
  });
  
  // Use consistent Marathi NoPermissionPage instead of English fallback
  return <NoPermissionPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <div className="font-marathi">
            <style dangerouslySetInnerHTML={{ __html: reportsFixStyles }} />
            <ReportsNavFix />
            <Toaster />
            <AppContent />
          </div>
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
