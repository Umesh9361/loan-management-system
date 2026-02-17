import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, Calendar, Clock, X, Bell, IndianRupee, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface NotificationWarning {
  id: string;
  tenantId: string;
  warningType: string;
  severity: string;
  title: string;
  message: string;
  metadata: string | null;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

interface MaturityReminder {
  loanId: string;
  borrowerName: string;
  accountNumber: string;
  principalAmount: string;
  loanDate: string;
  maturityDate: string;
  daysRemaining: number;
  maturityMonths: number | null;
  groupId: string;
}

function formatIndianDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getUrgencyConfig(daysRemaining: number) {
  if (daysRemaining === 0) {
    return {
      cardBg: 'bg-red-50 dark:bg-red-950/40',
      border: 'border-red-500',
      badgeCls: 'bg-red-600 text-white border-red-600',
      label: 'आज शेवटचा दिवस!',
      icon: '🔴',
    };
  }
  if (daysRemaining <= 3) {
    return {
      cardBg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-500',
      badgeCls: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300',
      label: `${daysRemaining} दिवस शिल्लक`,
      icon: '🔴',
    };
  }
  if (daysRemaining <= 7) {
    return {
      cardBg: 'bg-orange-50 dark:bg-orange-950/30',
      border: 'border-orange-400',
      badgeCls: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-300',
      label: `${daysRemaining} दिवस शिल्लक`,
      icon: '🟠',
    };
  }
  return {
    cardBg: 'bg-yellow-50 dark:bg-yellow-950/30',
    border: 'border-yellow-400',
    badgeCls: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300',
    label: `${daysRemaining} दिवस शिल्लक`,
    icon: '🟡',
  };
}

function ReminderCard({ reminder }: { reminder: MaturityReminder }) {
  const urgency = getUrgencyConfig(reminder.daysRemaining);
  return (
    <div
      className={`p-2.5 sm:p-3 rounded-lg border-l-4 ${urgency.cardBg} ${urgency.border} transition-colors`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">
            {urgency.icon} {reminder.borrowerName}
          </h3>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
            खाते क्र.: <span className="font-bold text-gray-700 dark:text-gray-200">{reminder.accountNumber}</span>
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] sm:text-xs font-bold whitespace-nowrap shrink-0 ${urgency.badgeCls}`}
        >
          {urgency.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 sm:gap-1.5 text-gray-600 dark:text-gray-400">
          <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
          <span className="text-[11px] sm:text-sm truncate">कर्ज: {formatIndianDate(reminder.loanDate)}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 text-gray-600 dark:text-gray-400">
          <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
          <span className="text-[11px] sm:text-sm truncate">मुदत: {formatIndianDate(reminder.maturityDate)}</span>
        </div>
      </div>

      <div className="mt-1.5 sm:mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <IndianRupee className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-700 dark:text-gray-300" />
          <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
            {Number(reminder.principalAmount).toLocaleString('en-IN')}
          </span>
        </div>
        {reminder.maturityMonths && (
          <span className="text-[10px] sm:text-xs text-gray-500">
            ({reminder.maturityMonths} महिने मुदत)
          </span>
        )}
      </div>

      {reminder.daysRemaining <= 8 && (
        <div className="mt-1.5 sm:mt-2 flex items-center gap-1 sm:gap-1.5 text-red-600 dark:text-red-400 text-[11px] sm:text-xs font-semibold bg-red-100/50 dark:bg-red-900/30 px-2 py-1 rounded">
          <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
          <span>कृपया follow up घ्या - मुदत संपत आली आहे!</span>
        </div>
      )}
    </div>
  );
}

function getAutoPopupEnabled(): boolean {
  const val = localStorage.getItem('maturity_auto_popup_enabled');
  return val !== 'false';
}

function setAutoPopupEnabled(enabled: boolean) {
  localStorage.setItem('maturity_auto_popup_enabled', enabled ? 'true' : 'false');
}

export function NotificationBell({ variant = 'default' }: { variant?: 'default' | 'sidebar' }) {
  const [panelOpen, setPanelOpen] = useState(false);

  const { data } = useQuery<{ success: boolean; reminders: MaturityReminder[]; count: number }>({
    queryKey: ["/api/maturity-reminders"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notification-warnings/unread-count"],
    refetchInterval: 30000,
  });

  const maturityCount = data?.count || 0;
  const warningCount = unreadData?.count || 0;
  const count = maturityCount + warningCount;
  const hasNotifications = count > 0;
  const displayCount = count > 99 ? '99+' : String(count);

  return (
    <>
      <button
        onClick={() => setPanelOpen(true)}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full transition-all duration-200",
          variant === 'sidebar'
            ? "h-9 w-9 bg-white/20 hover:bg-white/30 active:bg-white/40"
            : "h-9 w-9 hover:bg-gray-100 active:bg-gray-200"
        )}
        aria-label="मुदत सूचना"
      >
        <Bell className={cn(
          "h-5 w-5",
          variant === 'sidebar' ? "text-white" : "text-gray-700",
          hasNotifications && "animate-[bell-ring_2s_ease-in-out_infinite]"
        )} />
        {hasNotifications && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-indigo-500 rounded-full border-2 border-white shadow-sm">
            {displayCount}
          </span>
        )}
      </button>
      {panelOpen && (
        <NotificationPanel onClose={() => setPanelOpen(false)} />
      )}
    </>
  );
}

function formatWarningDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function DateWarningsTab() {
  const qc = useQueryClient();
  const { data: warnings = [] } = useQuery<NotificationWarning[]>({
    queryKey: ["/api/notification-warnings"],
  });
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notification-warnings/unread-count"],
  });
  const unreadCount = unreadData?.count || 0;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest(`/api/notification-warnings/${id}/read`, "PATCH"); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/notification-warnings"] }); qc.invalidateQueries({ queryKey: ["/api/notification-warnings/unread-count"] }); },
  });
  const dismissMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest(`/api/notification-warnings/${id}/dismiss`, "PATCH"); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/notification-warnings"] }); qc.invalidateQueries({ queryKey: ["/api/notification-warnings/unread-count"] }); },
  });
  const clearAllMutation = useMutation({
    mutationFn: async () => { await apiRequest("/api/notification-warnings/clear-all", "DELETE"); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/notification-warnings"] }); qc.invalidateQueries({ queryKey: ["/api/notification-warnings/unread-count"] }); },
  });
  const markAllReadMutation = useMutation({
    mutationFn: async () => { await apiRequest("/api/notification-warnings/mark-all-read", "PATCH"); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/notification-warnings"] }); qc.invalidateQueries({ queryKey: ["/api/notification-warnings/unread-count"] }); },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {(unreadCount > 0 || warnings.length > 0) && (
        <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-b border-gray-100 shrink-0">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-indigo-600" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
              <Check className="h-3 w-3 mr-0.5" />सर्व वाचलेले
            </Button>
          )}
          {warnings.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-600" onClick={() => { if (window.confirm("सर्व सूचना बंद करायच्या का?")) clearAllMutation.mutate(); }} disabled={clearAllMutation.isPending}>
              <Trash2 className="h-3 w-3 mr-0.5" />सर्व बंद
            </Button>
          )}
        </div>
      )}
      <div className="overflow-y-auto flex-1 overscroll-contain">
        {warnings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">कोणत्याही तारीख चेतावणी नाहीत</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {warnings.map((w) => (
              <div key={w.id} className={`p-3 hover:bg-gray-50 transition-colors ${!w.isRead ? 'bg-amber-50/50' : ''}`}
                onClick={() => { if (!w.isRead) markReadMutation.mutate(w.id); }}>
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 p-1 rounded-full shrink-0 ${w.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-semibold ${w.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>{w.title}</p>
                      {!w.isRead && <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 break-words">{w.message}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />{formatWarningDateTime(w.createdAt)}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); dismissMutation.mutate(w.id); }} className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5">
                        <X className="h-3 w-3" />बंद करा
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [autoPopup, setAutoPopup] = useState(getAutoPopupEnabled);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [activeTab, setActiveTab] = useState<'maturity' | 'warnings'>('maturity');

  const { data } = useQuery<{ success: boolean; reminders: MaturityReminder[]; count: number }>({
    queryKey: ["/api/maturity-reminders"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notification-warnings/unread-count"],
  });

  const reminders = data?.reminders || [];
  const warningCount = unreadData?.count || 0;

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (isDesktop && panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  }, [isDesktop, onClose]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (!isDesktop) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isDesktop]);

  const handleToggleAutoPopup = (checked: boolean) => {
    setAutoPopup(checked);
    setAutoPopupEnabled(checked);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY !== null) {
      const diff = e.changedTouches[0].clientY - touchStartY;
      if (diff > 80) { onClose(); }
    }
    setTouchStartY(null);
  };

  const tabBar = (
    <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
      <button
        onClick={() => setActiveTab('maturity')}
        className={cn(
          "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors",
          activeTab === 'maturity' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
        )}
      >
        मुदत सूचना {reminders.length > 0 && <Badge className="ml-1 bg-indigo-100 text-indigo-700 text-[10px] px-1 py-0">{reminders.length}</Badge>}
      </button>
      <button
        onClick={() => setActiveTab('warnings')}
        className={cn(
          "flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors",
          activeTab === 'warnings' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'
        )}
      >
        तारीख चेतावणी {warningCount > 0 && <Badge className="ml-1 bg-amber-100 text-amber-700 text-[10px] px-1 py-0">{warningCount}</Badge>}
      </button>
    </div>
  );

  const maturityContent = (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-850 shrink-0">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">स्वयं सूचना</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">{autoPopup ? 'ON' : 'OFF'}</span>
          <Switch checked={autoPopup} onCheckedChange={handleToggleAutoPopup} />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 p-3 space-y-2.5 overscroll-contain">
        {reminders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">सध्या कोणतीही मुदत सूचना नाही</p>
          </div>
        ) : (
          reminders.map((reminder) => (
            <ReminderCard key={reminder.loanId} reminder={reminder} />
          ))
        )}
      </div>
    </div>
  );

  const header = (
    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-3 rounded-t-xl flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <div className="bg-white/20 p-1.5 rounded-full">
          <Bell className="h-4 w-4" />
        </div>
        <h2 className="text-base font-bold">सूचना</h2>
      </div>
      <button onClick={onClose} className="bg-white/20 hover:bg-white/30 rounded-full p-1.5 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-[60]" onClick={onClose}>
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          className="fixed top-16 right-4 lg:right-auto lg:left-[calc(18rem+1rem)] w-[420px] min-h-[50vh] max-h-[85vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col animate-in fade-in zoom-in-95 duration-200 z-[61]"
        >
          {header}
          {tabBar}
          {activeTab === 'maturity' ? maturityContent : <DateWarningsTab />}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl min-h-[60vh] max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-300 z-[61]"
      >
        <div className="flex justify-center py-2 shrink-0">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1.5 rounded-full">
              <Bell className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold">सूचना</h2>
          </div>
          <button onClick={onClose} className="bg-white/20 hover:bg-white/30 rounded-full p-1.5 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {tabBar}
        {activeTab === 'maturity' ? maturityContent : <DateWarningsTab />}

        <div className="p-3 border-t bg-gray-50 dark:bg-gray-800 shrink-0 safe-area-bottom">
          <Button
            onClick={onClose}
            className="w-full bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white h-10 text-sm font-semibold"
          >
            बंद करा
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MaturityReminderPopup() {
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; reminders: MaturityReminder[]; count: number }>({
    queryKey: ["/api/maturity-reminders"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const sessionKey = `maturity_reminder_dismissed_${new Date().toISOString().split('T')[0]}`;
    const wasDismissed = sessionStorage.getItem(sessionKey);
    if (wasDismissed) {
      setDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (data?.count && data.count > 0 && !dismissed) {
      const autoEnabled = getAutoPopupEnabled();
      if (!autoEnabled) return;
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [data, dismissed]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    const sessionKey = `maturity_reminder_dismissed_${new Date().toISOString().split('T')[0]}`;
    sessionStorage.setItem(sessionKey, 'true');
  };

  if (isLoading || dismissed || !visible || !data?.reminders?.length) {
    return null;
  }

  const reminders = data.reminders;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-gray-900 w-full sm:w-[95%] sm:max-w-lg sm:mx-4 sm:rounded-xl rounded-t-2xl shadow-2xl border-t-2 sm:border-2 border-indigo-300 dark:border-indigo-600 max-h-[90vh] sm:max-h-[80vh] flex flex-col animate-in slide-in-from-bottom sm:fade-in sm:zoom-in-95 duration-300"
      >
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-3 sm:p-4 rounded-t-2xl sm:rounded-t-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-white/20 p-1.5 sm:p-2 rounded-full">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">मुदत सूचना</h2>
              <p className="text-[11px] sm:text-xs text-indigo-100">{reminders.length} कर्जांची मुदत जवळ आली आहे - follow up घ्या</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full p-1.5 sm:p-2 transition-colors"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-2.5 sm:space-y-3 overscroll-contain">
          {reminders.map((reminder) => (
            <ReminderCard key={reminder.loanId} reminder={reminder} />
          ))}
        </div>

        <div className="p-3 sm:p-4 border-t bg-gray-50 dark:bg-gray-800 rounded-b-none sm:rounded-b-xl shrink-0 safe-area-bottom">
          <Button
            onClick={handleDismiss}
            className="w-full bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white h-10 sm:h-11 text-sm sm:text-base font-semibold"
          >
            समजले, बंद करा
          </Button>
        </div>
      </div>
    </div>
  );
}
