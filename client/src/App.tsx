import { useEffect, useCallback, useMemo, lazy, Suspense } from "react";
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
import { AuthService } from "@/lib/auth";
import { DedicatedModeProvider } from "@/contexts/dedicated-mode";
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
import LoadingReport from "@/pages/reports/loading-report";
import NoticeGeneratorPage from "@/pages/reports/notice-generator";
import InformationRegister from "@/pages/reports/information-register";
import BalanceSheet from "@/pages/reports/balance-sheet";
import ProfitLoss from "@/pages/reports/profit-loss";
import JawabGeneratorPage from "@/pages/reports/jawab-generator";

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
import QrScan from "@/pages/qr-scan";
const LazyInventoryScan = lazy(() => import("@/pages/inventory-scan"));
function InventoryScan() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>}>
      <LazyInventoryScan />
    </Suspense>
  );
}

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

const PERMISSION_ROUTE_MAP: Record<string, { route: string; label: string }> = {
  canAccessCompanyRegistration: { route: '/company', label: 'कंपनी नोंदणी' },
  canAccessGroupManagement: { route: '/groups', label: 'ग्रुप व्यवस्थापन' },
  canAccessLoanRegistration: { route: '/loans', label: 'कर्ज नोंदणी' },
  canAccessLoanClosure: { route: '/closure', label: 'कर्ज बंद करा' },
  canAccessCashTransactions: { route: '/cash-transactions', label: 'रोकड व्यवहार' },
  canAccessPartyManagement: { route: '/party-management', label: 'अकाउंट क्रिएशन' },
  canAccessMobileCashbook: { route: '/mobile-cashbook', label: 'मोबाईल रोकड वही' },
  canAccessInterestCalculator: { route: '/calculator', label: 'व्याज कॅल्क्युलेटर' },
  canViewReceiptGenerator: { route: '/reports/receipt-generator', label: 'पावती जनरेशन' },
  canViewCashBookReport: { route: '/reports/cashbook', label: 'रोकड वही' },
  canViewCapitalReport: { route: '/reports/capital-account', label: 'भांडवल खाते' },
  canViewLedgerReport: { route: '/reports/account-ledger', label: 'खाते वही' },
  canViewBorrowerListReport: { route: '/reports/borrower-list', label: 'कर्जदार सूची' },
  canViewOverdueReport: { route: '/reports/overdue', label: 'लॉस रिपोर्ट' },
  canViewLoadingReport: { route: '/reports/loading-report', label: 'लोडिंग रिपोर्ट' },
  canViewAccountSummaryReport: { route: '/reports/account-summary', label: 'खाते सारांश' },
  canViewInformationRegister: { route: '/reports/information-register', label: 'माहिती तक्ता' },
  canViewNoticeGenerator: { route: '/reports/notice-generator', label: 'नोटीस' },
  canViewBalanceSheet: { route: '/reports/balance-sheet', label: 'ताळेबंद' },
  canViewProfitLoss: { route: '/reports/profit-loss', label: 'नफा-तोटा पत्रक' },
};

function getActivePermissions(perms: any): { route: string; label: string; key: string }[] {
  const active: { route: string; label: string; key: string }[] = [];
  for (const [key, info] of Object.entries(PERMISSION_ROUTE_MAP)) {
    if (perms[key]) {
      active.push({ ...info, key });
    }
  }
  return active;
}

function getDedicatedComponent(permKey: string): any {
  const componentMap: Record<string, any> = {
    canAccessCompanyRegistration: Company,
    canAccessGroupManagement: Groups,
    canAccessLoanRegistration: Loans,
    canAccessLoanClosure: Closure,
    canAccessCashTransactions: CashTransactions,
    canAccessPartyManagement: PartyManagement,
    canAccessMobileCashbook: MobileCashbook,
    canAccessInterestCalculator: InterestCalculator,
    canViewReceiptGenerator: ReceiptGeneratorPage,
    canViewCashBookReport: CashBook,
    canViewCapitalReport: CapitalAccount,
    canViewLedgerReport: AccountLedger,
    canViewBorrowerListReport: BorrowerListReports,
    canViewOverdueReport: OverdueReport,
    canViewLoadingReport: LoadingReport,
    canViewAccountSummaryReport: AccountSummaryReport,
    canViewInformationRegister: InformationRegister,
    canViewNoticeGenerator: NoticeGeneratorPage,
    canViewBalanceSheet: BalanceSheet,
    canViewProfitLoss: ProfitLoss,
  };
  return componentMap[permKey] || null;
}

function DedicatedModeRedirect({ targetRoute }: { targetRoute: string }) {
  const [location, setLocation] = useLocation();
  useEffect(() => {
    if (location === '/' || location === '') {
      setLocation(targetRoute);
    }
  }, [location, targetRoute, setLocation]);
  return null;
}

function DedicatedModeHeader({ userName, label }: { userName: string; label: string }) {
  const handleLogout = async () => {
    try {
      await AuthService.logout();
      window.location.href = '/';
    } catch {
      window.location.href = '/';
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm print:hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">LP</span>
          </div>
          <div>
            <span className="text-sm font-semibold text-indigo-700">{label}</span>
            <span className="text-xs text-gray-400 ml-2 hidden sm:inline">| {userName}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          बाहेर पडा
        </button>
      </div>
    </div>
  );
}

const INACTIVITY_KEY = 'last_active_timestamp';
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

function useInactivityRedirect(isLoggedIn: boolean) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoggedIn) return;
    if (location === '/' || location === '/login') return;
    if (location === '/closure') return;

    const lastActive = localStorage.getItem(INACTIVITY_KEY);
    if (!lastActive) {
      localStorage.setItem(INACTIVITY_KEY, String(Date.now()));
      return;
    }
    const gap = Date.now() - Number(lastActive);
    if (gap > INACTIVITY_TIMEOUT) {
      localStorage.setItem(INACTIVITY_KEY, String(Date.now()));
      setLocation('/');
    }
  }, [isLoggedIn, location]);

  const updateActivity = useCallback(() => {
    if (!isLoggedIn) return;
    localStorage.setItem(INACTIVITY_KEY, String(Date.now()));
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    updateActivity();

    const events = ['click', 'keydown', 'scroll', 'touchstart'];
    const handler = () => updateActivity();
    const visHandler = () => {
      if (document.visibilityState === 'visible') {
        const lastActive = localStorage.getItem(INACTIVITY_KEY);
        if (lastActive) {
          const gap = Date.now() - Number(lastActive);
          if (gap > INACTIVITY_TIMEOUT && location !== '/' && location !== '/login' && location !== '/closure') {
            localStorage.setItem(INACTIVITY_KEY, String(Date.now()));
            setLocation('/');
            return;
          }
        }
        updateActivity();
      }
    };

    events.forEach(e => window.addEventListener(e, handler));
    document.addEventListener('visibilitychange', visHandler);
    window.addEventListener('focus', visHandler);
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      document.removeEventListener('visibilitychange', visHandler);
      window.removeEventListener('focus', visHandler);
    };
  }, [updateActivity, isLoggedIn, location]);
}

function AppContent() {
  const { safeNavigate } = useSafeNavigation();
  const { user: rawUser, authReady, isLoading } = useCurrentUser();
  const [location] = useLocation();

  useMidnightLogout(!!rawUser);
  useInactivityRedirect(!!rawUser);

  const userRole = normalizeRole(rawUser?.role);

  const { data: userPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["/api/user-permissions"],
    enabled: !!rawUser && userRole === 'user',
    retry: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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
    if (location.startsWith('/qr/')) return <QrScan />;
    return <Login />;
  }

  const actualUser = { ...rawUser, role: userRole };

  if (!actualUser.role || !['super_admin', 'admin', 'user'].includes(actualUser.role)) {
    return <Login />;
  }
  
  // Super Admin Routes - COMPLETE ACCESS to ALL features including Super Admin management
  if (actualUser.role === 'super_admin') {
    return (
      <div className="pb-16">
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
        <Route path="/inventory-scan" component={InventoryScan} />
        
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
        <Route path="/reports/loading-report" component={LoadingReport} />
        <Route path="/reports/information-register" component={InformationRegister} />
        <Route path="/reports/balance-sheet" component={BalanceSheet} />
        <Route path="/reports/profit-loss" component={ProfitLoss} />
        <Route path="/reports/receipt-generator" component={ReceiptGeneratorPage} />
        <Route path="/reports/notice-generator" component={NoticeGeneratorPage} />
        <Route path="/reports/jawab-generator" component={JawabGeneratorPage} />
        <Route path="/reports/receipt">{() => { window.location.replace('/reports/receipt-generator'); return null; }}</Route>
        
        {/* Receipt and Profile Routes */}
          <Route path="/receipt/closure/:loanId" component={ClosureReceiptPage} />
          <Route path="/receipt/annual-statement" component={AnnualStatementPage} />
          <Route path="/profile" component={Profile} />
          <Route path="/qr/:loanId" component={QrScan} />
          
          <Route component={RedirectToDashboard} />
        </Switch>
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
    const activePerms = getActivePermissions(perms);
    const isDedicatedMode = activePerms.length === 1;
    const dedicatedRoute = isDedicatedMode ? activePerms[0] : null;

    if (isDedicatedMode && dedicatedRoute) {
      return (
        <DedicatedModeProvider isDedicatedMode={true}>
          <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
            <DedicatedModeHeader 
              userName={actualUser.username || ''} 
              label={dedicatedRoute.label} 
            />
            <DedicatedModeRedirect targetRoute={dedicatedRoute.route} />
            <Switch>
              <Route path={dedicatedRoute.route}>
                {() => {
                  const RouteComponent = getDedicatedComponent(dedicatedRoute.key);
                  return RouteComponent ? <RouteComponent /> : null;
                }}
              </Route>
              <Route>{() => <DedicatedModeRedirect targetRoute={dedicatedRoute.route} />}</Route>
            </Switch>
          </div>
        </DedicatedModeProvider>
      );
    }
    
    return (
      <div className="pb-16">
        <Switch>
          <Route path="/" component={Dashboard} />
        
        {perms.canAccessCompanyRegistration && <Route path="/company" component={Company} />}
        {perms.canAccessGroupManagement && <Route path="/groups" component={Groups} />}
        {perms.canAccessLoanRegistration && <Route path="/loans" component={Loans} />}
        {perms.canAccessLoanClosure && <Route path="/closure" component={Closure} />}
        {perms.canAccessCashTransactions && <Route path="/cash-transactions" component={CashTransactions} />}
        {perms.canAccessCashTransactions && <Route path="/cash-dashboard" component={CashDashboard} />}
        {perms.canAccessPartyManagement && <Route path="/party-management" component={PartyManagement} />}
        {perms.canAccessMobileCashbook && <Route path="/mobile-cashbook" component={MobileCashbook} />}
        {perms.canAccessInterestCalculator && <Route path="/calculator" component={InterestCalculator} />}
        {perms.canAccessLoanRegistration && <Route path="/inventory-scan" component={InventoryScan} />}
        
        {perms.canViewReceiptGenerator && <Route path="/reports/receipt-generator" component={ReceiptGeneratorPage} />}
        {perms.canViewNoticeGenerator && <Route path="/reports/notice-generator" component={NoticeGeneratorPage} />}
        {perms.canViewReceiptGenerator && <Route path="/reports/jawab-generator" component={JawabGeneratorPage} />}
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
        {perms.canViewLoadingReport && <Route path="/reports/loading-report" component={LoadingReport} />}
        {perms.canViewInformationRegister && <Route path="/reports/information-register" component={InformationRegister} />}
        {perms.canViewBalanceSheet && <Route path="/reports/balance-sheet" component={BalanceSheet} />}
        {perms.canViewProfitLoss && <Route path="/reports/profit-loss" component={ProfitLoss} />}
        
          {perms.canAccessLoanClosure && <Route path="/receipt/closure/:loanId" component={ClosureReceiptPage} />}
          {perms.canViewReceiptGenerator && <Route path="/receipt/annual-statement" component={AnnualStatementPage} />}
          <Route path="/qr/:loanId" component={QrScan} />
          
          <Route component={NoPermissionPage} />
        </Switch>
      </div>
    );
  }

  // Admin Routes - Full access to all features for TENANT ADMINS only (excluding Super Admin management)
  if (actualUser.role === 'admin') {
    return (
      <div className="pb-16">
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
        <Route path="/inventory-scan" component={InventoryScan} />
        <Route path="/user-management" component={UserManagement} />
        <Route path="/data-management" component={DataManagement} />
        <Route path="/activity-log" component={ActivityLogPage} />
        <Route path="/storage-settings" component={StorageSettings} />
        <Route path="/reports/receipt-generator" component={ReceiptGeneratorPage} />
        <Route path="/reports/notice-generator" component={NoticeGeneratorPage} />
        <Route path="/reports/jawab-generator" component={JawabGeneratorPage} />
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
        <Route path="/reports/loading-report" component={LoadingReport} />
        <Route path="/reports/information-register" component={InformationRegister} />
        <Route path="/reports/balance-sheet" component={BalanceSheet} />
        <Route path="/reports/profit-loss" component={ProfitLoss} />
          <Route path="/receipt/closure/:loanId" component={ClosureReceiptPage} />
          <Route path="/receipt/annual-statement" component={AnnualStatementPage} />
          <Route path="/profile" component={Profile} />
          <Route path="/qr/:loanId" component={QrScan} />
          <Route component={RedirectToDashboard} />
        </Switch>
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
