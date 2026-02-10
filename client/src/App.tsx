import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ReportsNavFix, reportsFixStyles } from "@/components/reports-nav-fix";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/providers/I18nProvider";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMidnightLogout } from "@/hooks/use-midnight-logout";
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
import NoticeGeneratorPage from "@/pages/reports/notice-generator";

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

function normalizeRole(role: string | undefined): string {
  if (!role) return '';
  const r = role.trim().toLowerCase();
  return r === 'clerk' ? 'user' : r;
}

function RedirectToDashboard() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation('/'); }, []);
  return null;
}

function AppContent() {
  const { safeNavigate } = useSafeNavigation();
  const { user: rawUser, authReady, isLoading } = useCurrentUser();

  useMidnightLogout(!!rawUser);

  const userRole = normalizeRole(rawUser?.role);

  const { data: userPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["/api/user-permissions"],
    enabled: !!rawUser && userRole === 'user',
    retry: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: companyData } = useQuery<any>({
    queryKey: ["/api/company"],
    enabled: !!rawUser,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const bottomNavEnabled = companyData?.bottomNavEnabled !== false;

  if (!authReady || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  if (!rawUser) {
    return <Login />;
  }

  const actualUser = { ...rawUser, role: userRole };

  if (!actualUser.role || !['super_admin', 'admin', 'user'].includes(actualUser.role)) {
    return <Login />;
  }
  
  // Super Admin Routes - COMPLETE ACCESS to ALL features including Super Admin management
  if (actualUser.role === 'super_admin') {
    return (
      <div className={bottomNavEnabled ? "pb-16" : ""}>
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
        <Route path="/reports/notice-generator" component={NoticeGeneratorPage} />
        <Route path="/reports/receipt">{() => { window.location.replace('/reports/receipt-generator'); return null; }}</Route>
        
        {/* Receipt and Profile Routes */}
          <Route path="/receipt/closure/:loanId" component={ClosureReceiptPage} />
          <Route path="/receipt/annual-statement" component={AnnualStatementPage} />
          <Route path="/profile" component={Profile} />
          
          <Route component={RedirectToDashboard} />
        </Switch>
        {bottomNavEnabled && <BottomNavigation userRole="super_admin" />}
      </div>
    );
  }

  // User Role Routes - DYNAMIC ACCESS based on Admin-granted permissions
  if (actualUser.role === 'user') {
    if (permissionsLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">परवानग्या तपासत आहे...</p>
          </div>
        </div>
      );
    }
    const perms = (userPermissions as any) || {};
    
    return (
      <div className={bottomNavEnabled ? "pb-16" : ""}>
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
        {perms.canViewReceiptGenerator && <Route path="/reports/notice-generator" component={NoticeGeneratorPage} />}
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
        {bottomNavEnabled && <BottomNavigation userRole="user" />}
      </div>
    );
  }

  // Admin Routes - Full access to all features for TENANT ADMINS only (excluding Super Admin management)
  if (actualUser.role === 'admin') {
    return (
      <div className={bottomNavEnabled ? "pb-16" : ""}>
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
        <Route path="/reports/notice-generator" component={NoticeGeneratorPage} />
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
          <Route component={RedirectToDashboard} />
        </Switch>
        {bottomNavEnabled && <BottomNavigation userRole="admin" />}
      </div>
    );
  }

  return <Login />;
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
