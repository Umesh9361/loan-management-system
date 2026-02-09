import { Link, useLocation } from "wouter";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { AuthService } from "@/lib/auth";
import { useEffect, useRef } from "react";
import { NotificationBell } from "@/components/maturity-reminder";
import { 
  Building, 
  Users, 
  User,
  CreditCard, 
  UserCheck, 
  CheckCircle, 
  Book, 
  TrendingUp, 
  TrendingDown,
  FileText, 
  BarChart3,
  Home,
  Wallet,
  LogOut,
  Receipt,
  Calculator,
  Shield,
  Database,
  Calendar,
  Cloud,
  ClipboardList,
  AlertTriangle
} from "lucide-react";

const navigation = [
  {
    name: "मुख्य पटल",
    href: "/",
    icon: Home,
  },
  {
    name: "कंपनी नोंदणी",
    href: "/company",
    icon: Building,
  },
  {
    name: "ग्रुप व्यवस्थापन",
    href: "/groups",
    icon: Users,
  },
  {
    name: "कर्ज नोंदणी",
    href: "/loans",
    icon: CreditCard,
  },

  {
    name: "कर्ज बंद करा",
    href: "/closure",
    icon: CheckCircle,
  },

  {
    name: "रोकड व्यवहार",
    href: "/cash-transactions",
    icon: Wallet,
  },
  {
    name: "अकाउंट क्रिएशन",
    href: "/party-management",
    icon: User,
  },
  {
    name: "मोबाईल रोकड वही",
    href: "/mobile-cashbook",
    icon: Wallet,
  },
  {
    name: "व्याज कॅल्क्युलेटर",
    href: "/calculator",
    icon: Calculator,
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
    name: "इतर अहवाल",
    href: "/reports/other",
    icon: BarChart3,
    description: "अतिरिक्त रिपोर्ट्स"
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { safeNavigate } = useSafeNavigation();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => AuthService.getCurrentUser(),
  });

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

  const handleLogout = async () => {
    await AuthService.logout();
    window.location.reload();
  };

  return (
    <div className={cn("flex flex-col sidebar-modern h-full", className)}>
      <div className="header-gradient p-4 border-b">
        <div className="flex items-center justify-between w-full min-w-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 lg:h-12 lg:w-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <Building className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-sm lg:text-lg font-bold text-white font-noto">
                कर्ज व्यवस्थापन
              </h1>
            </div>
          </div>
          <NotificationBell variant="sidebar" />
        </div>
      </div>

      {/* Custom Scrollable Area with Wider Scrollbar */}
      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto sidebar-scroll px-2 lg:px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
      >
        <div className="space-y-1 py-3 lg:py-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start text-sm lg:text-base py-3 lg:py-3.5 h-auto font-medium rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md transform scale-105" 
                      : "hover:bg-blue-50 hover:text-blue-700 hover:transform hover:scale-102"
                  )}
                >
                  <Icon className="mr-2 lg:mr-3 h-4 w-4 lg:h-4 lg:w-4 flex-shrink-0" />
                  <span className="truncate font-noto">{item.name}</span>
                </Button>
              </Link>
            );
          })}
          
          <Separator className="my-4" />
          
          <div className="px-2 lg:px-3 py-2">
            <h3 className="text-sm lg:text-base font-bold text-blue-600 uppercase tracking-wider bg-blue-50 rounded-lg px-3 py-2 font-noto">
              📊 अहवाल
            </h3>
          </div>
          
          {reports.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            // For regular users, check permissions for annual statement link
            if (user?.role === 'user' && item.href === '/receipt/annual-statement') {
              // Only show annual statement if user has receipt generator permission
              if (!perms.canViewReceiptGenerator) {
                return null;
              }
            }
            
            return (
              <div key={item.name} className="reports-section">
                <Link href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start text-sm lg:text-base py-3 lg:py-3.5 h-auto font-medium report-button-fix",
                      isActive && "bg-blue-50 text-blue-700 border-r-2 border-blue-500"
                    )}
                    data-report-button="true"
                    data-href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = item.href;
                    }}
                  >
                    <Icon className="mr-3 h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              </div>
            );
          })}
          
          {/* Admin Navigation Section - For ALL admins including super admins */}
          {((user as any)?.role === 'admin' || (user as any)?.role === 'super_admin') && (
            <>
              <Separator className="my-4" />
              
              <div className="px-2 lg:px-3 py-2">
                <h3 className="text-sm lg:text-base font-bold text-orange-600 uppercase tracking-wider bg-orange-50 rounded-lg px-3 py-2 font-noto">
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
                        "w-full justify-start text-sm lg:text-base py-3 lg:py-3.5 h-auto font-medium rounded-lg transition-all duration-200",
                        isActive 
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md transform scale-105" 
                          : "hover:bg-orange-50 hover:text-orange-700 hover:transform hover:scale-102"
                      )}
                    >
                      <Icon className="mr-2 lg:mr-3 h-4 w-4 lg:h-4 lg:w-4 flex-shrink-0" />
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
              <Separator className="my-4" />
              
              <div className="px-2 lg:px-3 py-2">
                <h3 className="text-sm lg:text-base font-bold text-red-600 uppercase tracking-wider bg-red-50 rounded-lg px-3 py-2 font-noto">
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
                        "w-full justify-start text-sm lg:text-base py-3 lg:py-3.5 h-auto font-medium rounded-lg transition-all duration-200",
                        isActive 
                          ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md transform scale-105" 
                          : "hover:bg-red-50 hover:text-red-600 hover:transform hover:scale-102"
                      )}
                    >
                      <Icon className="mr-2 lg:mr-3 h-4 w-4 lg:h-4 lg:w-4 flex-shrink-0" />
                      <span className="truncate font-noto">{item.name}</span>
                    </Button>
                  </Link>
                );
              })}
            </>
          )}
          

        </div>
        
        {/* Quick Navigation */}
        <div className="sticky bottom-0 bg-white border-t mt-4 pt-3 pb-3">
          <div className="flex justify-center items-center px-2 gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="text-sm px-3 py-2 h-8 font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              ⬆️ वर जा
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTo({ 
                    top: scrollRef.current.scrollHeight, 
                    behavior: 'smooth' 
                  });
                }
              }}
              className="text-sm px-3 py-2 h-8 font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              ⬇️ खाली जा
            </Button>
          </div>
        </div>
      </div>

      {/* Fixed Footer - Always Visible */}
      <div className="flex-shrink-0 mt-auto border-t p-3 bg-white">
        {/* User info row with logout button */}
        <div className="flex items-center justify-between gap-2">
          {/* User info - clickable for admin/super_admin to go to profile */}
          {(user?.role === 'admin' || user?.role === 'super_admin') ? (
            <Link href="/profile" className="flex items-center space-x-2 min-w-0 flex-1 hover:bg-blue-50 rounded-lg p-1 transition-colors cursor-pointer">
              <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <UserCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-blue-600 truncate hover:text-blue-700">{user?.username}</p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <UserCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{user?.username}</p>
              </div>
            </div>
          )}
          
          {/* Logout button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-shrink-0 text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
            onClick={async () => {
              try {
                await handleLogout();
              } catch (error) {
                localStorage.clear();
                sessionStorage.clear();
                safeNavigate('/login');
              }
            }}
          >
            <LogOut className="mr-1 h-4 w-4" />
            बाहेर पडा
          </Button>
        </div>
      </div>
    </div>
  );
}
