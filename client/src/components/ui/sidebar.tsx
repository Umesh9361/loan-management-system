import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useEffect, useRef } from "react";
import { NotificationBell } from "@/components/maturity-reminder";
import { 
  Building, 
  Users, 
  User,
  CreditCard, 
  CheckCircle, 
  Book, 
  TrendingUp, 
  TrendingDown,
  FileText, 
  BarChart3,
  Home,
  Wallet,
  Receipt,
  Calculator,
  Shield,
  Database,
  Calendar,
  Cloud,
  ClipboardList,
  AlertTriangle,
  Scale,
  Settings
} from "lucide-react";

const navigation = [
  {
    name: "मुख्य पटल",
    href: "/",
    icon: Home,
    permission: "canViewDashboard",
  },
  {
    name: "कंपनी नोंदणी",
    href: "/company",
    icon: Building,
    permission: "canAccessCompanyRegistration",
  },
  {
    name: "ग्रुप व्यवस्थापन",
    href: "/groups",
    icon: Users,
    permission: "canAccessGroupManagement",
  },
  {
    name: "कर्ज नोंदणी",
    href: "/loans",
    icon: CreditCard,
    permission: "canAccessLoanRegistration",
  },
  {
    name: "कर्ज बंद करा",
    href: "/closure",
    icon: CheckCircle,
    permission: "canAccessLoanClosure",
  },
  {
    name: "रोकड व्यवहार",
    href: "/cash-transactions",
    icon: Wallet,
    permission: "canAccessCashTransactions",
  },
  {
    name: "अकाउंट क्रिएशन",
    href: "/party-management",
    icon: User,
    permission: "canAccessPartyManagement",
  },
  {
    name: "मोबाईल रोकड वही",
    href: "/mobile-cashbook",
    icon: Wallet,
    permission: "canAccessMobileCashbook",
  },
  {
    name: "व्याज कॅल्क्युलेटर",
    href: "/calculator",
    icon: Calculator,
    permission: "canAccessInterestCalculator",
  },
  {
    name: "ताळेबंद",
    href: "/reports/balance-sheet",
    icon: Scale,
    permission: "canViewBalanceSheet",
  },
  {
    name: "नफा-तोटा पत्रक",
    href: "/reports/profit-loss",
    icon: TrendingUp,
    permission: "canViewProfitLoss",
  },
];

const adminNavigation = [
  {
    name: "यूजर मॅनेजमेंट",
    href: "/user-management",
    icon: Shield,
    adminOnly: true,
  },
  {
    name: "डेटा व्यवस्थापन",
    href: "/data-management",
    icon: Database,
    adminOnly: true,
  },
  {
    name: "फोटो स्टोरेज सेटिंग्स",
    href: "/storage-settings",
    icon: Cloud,
    adminOnly: true,
  },
  {
    name: "कार्यवाही नोंद",
    href: "/activity-log",
    icon: ClipboardList,
    adminOnly: true,
  },
  {
    name: "माझे प्रोफाईल",
    href: "/profile",
    icon: Settings,
    adminOnly: true,
  },
];

// Super admin only navigation - Role-based access
const superAdminNavigation = [
  {
    name: "सुपर एडमिन डॅशबोर्ड",
    href: "/super-admin-dashboard",
    icon: Shield,
    superAdminOnly: true,
  },
];

const reports = [
  {
    name: "पावती जनरेशन (नमुना क्र. १०/११)",
    href: "/reports/receipt-generator",
    icon: Receipt,
    description: "कर्ज पावती तयार करा"
  },
  {
    name: "वार्षिक निवेदन (नमुना क्र. १४)",
    href: "/receipt/annual-statement",
    icon: Calendar,
    description: "वार्षिक खाते निवेदन"
  },
  {
    name: "रोकड वही (नमुना क्र. ७)",
    href: "/reports/cashbook",
    icon: Book,
    description: "दैनंदिन रोकड व्यवहार - नियम १८"
  },
  {
    name: "भांडवल खाते (नमुना क्र. १३)",
    href: "/reports/capital-account",
    icon: FileText,
    description: "नियम १९ - कर्ज वाटप अहवाल"
  },
  {
    name: "ताळेबंद",
    href: "/reports/balance-sheet",
    icon: Scale,
    description: "मालमत्ता व दायित्वे - आर्थिक वर्षनिहाय"
  },
  {
    name: "नफा-तोटा पत्रक",
    href: "/reports/profit-loss",
    icon: TrendingUp,
    description: "उत्पन्न व खर्च - निव्वळ नफा/तोटा"
  },
  {
    name: "कर्जदाराची यादी",
    href: "/reports/borrower-list",
    icon: Users,
    description: "डेट वाईज, क्लोजिंग वाईज, नेम वाईज, मुदत संपलेले रिपोर्ट"
  },
  {
    name: "नोटीस",
    href: "/reports/notice-generator",
    icon: AlertTriangle,
    description: "कायदेशीर नोटीस - कलम १७६"
  },
  {
    name: "लॉस रिपोर्ट",
    href: "/reports/overdue",
    icon: TrendingDown,
    description: "सोन्याच्या नुकसानाचे विश्लेषण"
  },
  {
    name: "लोडिंग रिपोर्ट",
    href: "/reports/loading-report",
    icon: TrendingUp,
    description: "LTV Overloading विश्लेषण"
  },
  {
    name: "खाते सारांश अहवाल",
    href: "/reports/account-summary",
    icon: BarChart3,
    description: "गटनिहाय कर्ज वाटप सारांश"
  },
  {
    name: "खाते लेजर (सर्वप्रकार)",
    href: "/reports/account-ledger",
    icon: FileText,
    description: "सर्व खाते - रोकड, व्यक्ती, कर्ज लेजर एकत्र"
  },
  {
    name: "माहिती तक्ता",
    href: "/reports/information-register",
    icon: ClipboardList,
    description: "सर्व कर्ज नोंदणी माहिती - कालावधीनुसार"
  },

];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { user: currentUser } = useCurrentUser();

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
    enabled: !!currentUser,
  });

  // Fetch user permissions for regular users to conditionally show menu items
  const { data: userPermissions } = useQuery({
    queryKey: ["/api/user-permissions"],
    enabled: !!currentUser && (currentUser as any)?.role === 'user',
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - permissions don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
    refetchOnWindowFocus: false,
  });

  const user = currentUser as any;
  const perms = (userPermissions as any) || {};

  // Enhanced scrolling with keyboard navigation
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== scrollContainer && !scrollContainer.contains(e.target as Node)) return;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          scrollContainer.scrollBy({ top: -60, behavior: 'smooth' });
          break;
        case 'ArrowDown':
          e.preventDefault();
          scrollContainer.scrollBy({ top: 60, behavior: 'smooth' });
          break;
        case 'Home':
          e.preventDefault();
          scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
          break;
        case 'End':
          e.preventDefault();
          scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
          break;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      scrollContainer.scrollBy({ 
        top: e.deltaY * 0.5, // Smoother scrolling
        behavior: 'auto' 
      });
    };

    scrollContainer.addEventListener('keydown', handleKeyDown);
    scrollContainer.addEventListener('wheel', handleWheel, { passive: false });
    scrollContainer.setAttribute('tabindex', '0'); // Make focusable

    return () => {
      scrollContainer.removeEventListener('keydown', handleKeyDown);
      scrollContainer.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div className={cn("flex flex-col sidebar-modern h-full", className)}>
      <div className="header-gradient p-3 lg:px-5 lg:py-4 border-b">
        <div className="flex items-center justify-between w-full min-w-0">
          <div className="flex items-center space-x-2 lg:space-x-3">
            <img src="/icons/icon-192x192.png" alt="LonoPro" className="h-10 w-10 lg:h-11 lg:w-11 rounded-xl flex-shrink-0 shadow-lg shadow-indigo-900/30" />
            <div>
              <h1 className="text-sm lg:text-base font-bold text-white font-noto tracking-wide">
                कर्ज व्यवस्थापन
              </h1>
              {company && (
                <p className="hidden lg:block text-[11px] text-indigo-200 font-medium truncate max-w-[140px]">
                  {(company as any)?.name || ''}
                </p>
              )}
            </div>
          </div>
          <div className="hidden lg:block">
            {user && (
              <NotificationBell variant="sidebar" />
            )}
          </div>
        </div>
      </div>

      {/* Custom Scrollable Area with Wider Scrollbar */}
      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto sidebar-scroll px-2 lg:px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
      >
        <div className="space-y-0.5 lg:space-y-0 py-3 lg:py-3">
          {navigation.map((item) => {
            if ((item as any).adminOnly && user?.role !== 'admin' && user?.role !== 'super_admin') {
              return null;
            }
            if (user?.role === 'user' && item.permission && !(perms as any)[item.permission]) {
              return null;
            }
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start text-sm py-3 lg:py-2.5 lg:text-sm h-auto font-medium rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm lg:shadow-md lg:border-l-3 lg:border-l-indigo-400" 
                      : "hover:bg-indigo-50/80 hover:text-indigo-700 lg:text-gray-700"
                  )}
                >
                  <Icon className="mr-2 lg:mr-2.5 h-4 w-4 flex-shrink-0" />
                  <span className="truncate font-noto">{item.name}</span>
                </Button>
              </Link>
            );
          })}
          
          <Separator className="my-3 lg:my-2" />
          
          <div className="px-2 lg:px-1.5 py-2 lg:py-1">
            <h3 className="text-sm lg:text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 rounded-lg px-3 lg:px-2.5 py-2 lg:py-1.5 font-noto">
              📊 अहवाल
            </h3>
          </div>
          
          {reports.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            if (user?.role === 'user') {
              const reportPermissionMap: Record<string, string> = {
                '/reports/receipt-generator': 'canViewReceiptGenerator',
                '/receipt/annual-statement': 'canViewReceiptGenerator',
                '/reports/cashbook': 'canViewCashBookReport',
                '/reports/capital-account': 'canViewCapitalReport',
                '/reports/borrower-list': 'canViewBorrowerListReport',
                '/reports/notice-generator': 'canViewNoticeGenerator',
                '/reports/overdue': 'canViewOverdueReport',
                '/reports/loading-report': 'canViewLoadingReport',
                '/reports/account-summary': 'canViewAccountSummaryReport',
                '/reports/account-ledger': 'canViewLedgerReport',
                '/reports/information-register': 'canViewInformationRegister',
                '/reports/balance-sheet': 'canViewBalanceSheet',
                '/reports/profit-loss': 'canViewProfitLoss',
              };
              const requiredPermission = reportPermissionMap[item.href];
              if (requiredPermission && !(perms as any)[requiredPermission]) {
                return null;
              }
            }
            
            return (
              <div key={item.name} className="reports-section">
                <Link href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start text-sm py-3 lg:py-2.5 lg:text-sm h-auto font-medium report-button-fix rounded-lg",
                      isActive && "bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500"
                    )}
                    data-report-button="true"
                    data-href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = item.href;
                    }}
                  >
                    <Icon className="mr-3 lg:mr-2.5 h-4 w-4 flex-shrink-0" />
                    <span className="truncate font-noto">{item.name}</span>
                  </Button>
                </Link>
              </div>
            );
          })}
          
          {/* Admin Navigation Section - For ALL admins including super admins */}
          {((user as any)?.role === 'admin' || (user as any)?.role === 'super_admin') && (
            <>
              <Separator className="my-3 lg:my-2" />
              
              <div className="px-2 lg:px-1.5 py-2 lg:py-1">
                <h3 className="text-sm lg:text-xs font-bold text-orange-600 uppercase tracking-wider bg-orange-50 rounded-lg px-3 lg:px-2.5 py-2 lg:py-1.5 font-noto">
                  🔧 {(user as any)?.role === 'super_admin' ? 'सुपर एडमिन पॅनेल' : 'एडमिन पॅनेल'}
                </h3>
              </div>
              
              {adminNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <Link key={item.name} href={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "w-full justify-start text-sm py-3 lg:py-2.5 lg:text-sm h-auto font-medium rounded-lg transition-all duration-200",
                        isActive 
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm lg:shadow-md" 
                          : "hover:bg-orange-50 hover:text-orange-700 lg:text-gray-700"
                      )}
                    >
                      <Icon className="mr-2 lg:mr-2.5 h-4 w-4 flex-shrink-0" />
                      <span className="truncate font-noto">{item.name}</span>
                    </Button>
                  </Link>
                );
              })}
            </>
          )}

          {/* Super Admin Navigation Section - Role-based, not tenant-based */}
          {(user as any)?.role === 'super_admin' && (
            <>
              <Separator className="my-3 lg:my-2" />
              
              <div className="px-2 lg:px-1.5 py-2 lg:py-1">
                <h3 className="text-sm lg:text-xs font-bold text-red-600 uppercase tracking-wider bg-red-50 rounded-lg px-3 lg:px-2.5 py-2 lg:py-1.5 font-noto">
                  🔐 सुपर एडमिन पॅनेल
                </h3>
              </div>
              
              {superAdminNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <Link key={item.name} href={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "w-full justify-start text-sm py-3 lg:py-2.5 lg:text-sm h-auto font-medium rounded-lg transition-all duration-200",
                        isActive 
                          ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm lg:shadow-md" 
                          : "hover:bg-red-50 hover:text-red-600 lg:text-gray-700"
                      )}
                    >
                      <Icon className="mr-2 lg:mr-2.5 h-4 w-4 flex-shrink-0" />
                      <span className="truncate font-noto">{item.name}</span>
                    </Button>
                  </Link>
                );
              })}
            </>
          )}
          

        </div>
        
      </div>

    </div>
  );
}
