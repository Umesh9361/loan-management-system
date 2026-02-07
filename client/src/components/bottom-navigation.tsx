import React from 'react';
import { useLocation } from 'wouter';
import { Home, CreditCard, Users, Calculator, FileText, DollarSign } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  role?: string[]; // Which roles can see this item
}

const navItems: NavItem[] = [
  {
    path: '/',
    icon: Home,
    label: 'होम',
    role: ['super_admin', 'admin', 'user']
  },
  {
    path: '/loans',
    icon: CreditCard,
    label: 'कर्ज',
    role: ['super_admin', 'admin', 'user']
  },
  {
    path: '/closure',
    icon: Calculator,
    label: 'कर्ज बंद',
    role: ['super_admin', 'admin', 'user']
  },
  {
    path: '/mobile-cashbook',
    icon: DollarSign,
    label: 'मोबाईल रोकड',
    role: ['super_admin', 'admin', 'user']
  },
  {
    path: '/reports/borrower-list',
    icon: FileText,
    label: 'कर्जदाराची यादी',
    role: ['super_admin', 'admin', 'user']
  }
];

interface BottomNavigationProps {
  userRole?: string;
}

export function BottomNavigation({ userRole = 'user' }: BottomNavigationProps) {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();

  // Hide on desktop - only show on mobile
  if (!isMobile) {
    return null;
  }

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter(item => 
    !item.role || item.role.includes(userRole)
  );

  const handleNavigation = (path: string) => {
    // Prevent unnecessary navigation if already on the same page
    if (location === path) {
      return;
    }
    setLocation(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="grid grid-cols-6 h-16">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || 
                          (item.path !== '/' && location.startsWith(item.path));
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              disabled={isActive}
              className={`flex flex-col items-center justify-center p-2 transition-colors ${
                isActive 
                  ? 'text-blue-600 bg-blue-50 cursor-default' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50 cursor-pointer'
              }`}
              data-testid={`nav-${item.path.replace('/', '').replace('/', '-') || 'home'}`}
            >
              <Icon className={`h-5 w-5 mb-1 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}