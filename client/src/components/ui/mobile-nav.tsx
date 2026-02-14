import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "./sidebar";
import { AuthService } from "@/lib/auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { NotificationBell } from "@/components/maturity-reminder";
import { 
  Home, 
  CreditCard, 
  UserCheck, 
  BarChart3, 
  Menu,
  User,
  ArrowLeft,
  LogOut,
  Settings
} from "lucide-react";

const bottomNavItems = [
  {
    name: "मुख्य",
    href: "/",
    icon: Home,
  },
  {
    name: "कर्ज",
    href: "/loans",
    icon: CreditCard,
  },
  {
    name: "कर्ज बंद",
    href: "/closure",
    icon: UserCheck,
  },
  {
    name: "कॅशबुक",
    href: "/mobile-cashbook",
    icon: BarChart3,
  },
];

interface MobileNavProps {
  hideBottomNav?: boolean;
}

export function MobileNav({ hideBottomNav = false }: MobileNavProps = {}) {
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { safeNavigate } = useSafeNavigation();
  const { user } = useCurrentUser();

  const { data: companyData } = useQuery<any>({
    queryKey: ["/api/company"],
    staleTime: 60 * 1000,
  });

  let bottomNavEnabled: boolean;
  if (companyData !== undefined) {
    bottomNavEnabled = companyData?.bottomNavEnabled !== false;
    try { localStorage.setItem('bottomNavEnabled', JSON.stringify(bottomNavEnabled)); } catch(e) {}
  } else {
    try { const v = localStorage.getItem('bottomNavEnabled'); bottomNavEnabled = v !== null ? JSON.parse(v) : false; } catch(e) { bottomNavEnabled = false; }
  }

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('closure_summary_entries');
      sessionStorage.removeItem('closure_summary_counter');
      await AuthService.logout();
      window.location.reload();
    } catch (error) {
      localStorage.clear();
      sessionStorage.clear();
      safeNavigate('/login');
    }
  };

  return (
    <>
      {/* Mobile Header - Enhanced */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between bg-white px-3 py-2.5 border-b border-gray-200 shadow-sm">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-60 sm:w-72" hideClose>
              <Sidebar />
            </SheetContent>
          </Sheet>
          
          <div className="flex items-center gap-2">
            <img src="/icons/icon-192x192.png" alt="LonoPro" className="h-7 w-7 rounded-md" />
            <h1 className="text-base font-semibold truncate">LonoPro</h1>
          </div>
          
          <div className="flex items-center gap-1">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <User className="h-5 w-5 text-indigo-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                  <>
                    <DropdownMenuItem onClick={() => setLocation('/profile')} className="text-gray-700 focus:text-indigo-700 focus:bg-indigo-50">
                      <UserCheck className="mr-2 h-4 w-4" />
                      {user?.username || 'Profile'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout} className="text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation - controlled by admin toggle */}
      {!hideBottomNav && bottomNavEnabled && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-1 py-1.5 z-50 shadow-lg">
        <div className="flex justify-around max-w-md mx-auto">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || 
              (item.href === "/mobile-cashbook" && location.startsWith("/mobile-cashbook"));
            
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "flex flex-col items-center gap-1 h-auto py-2 px-2 min-w-0 flex-1",
                    isActive ? "text-indigo-600 bg-indigo-50" : "text-gray-600"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive && "text-indigo-600")} />
                  <span className="text-xs truncate">{item.name}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>
      )}
    </>
  );
}
