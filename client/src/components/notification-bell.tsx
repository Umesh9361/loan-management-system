import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Bell, X, Check, Trash2, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notification-warnings/unread-count"],
    refetchInterval: 30000,
  });

  const { data: warnings = [] } = useQuery<NotificationWarning[]>({
    queryKey: ["/api/notification-warnings"],
    enabled: isOpen,
  });

  const unreadCount = unreadData?.count || 0;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/notification-warnings/${id}/read`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-warnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-warnings/unread-count"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/notification-warnings/${id}/dismiss`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-warnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-warnings/unread-count"] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/notification-warnings/clear-all", "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-warnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-warnings/unread-count"] });
      setIsOpen(false);
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/notification-warnings/mark-all-read", "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-warnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-warnings/unread-count"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-white/20 transition-colors"
        title="सूचना"
      >
        <Bell className="h-5 w-5 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-800">
              🔔 सूचना ({warnings.length})
            </h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-indigo-600 hover:text-indigo-700"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                >
                  <Check className="h-3 w-3 mr-1" />
                  सर्व वाचलेले
                </Button>
              )}
              {warnings.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-600 hover:text-red-700"
                  onClick={() => {
                    if (window.confirm("सर्व सूचना बंद करायच्या का?")) {
                      clearAllMutation.mutate();
                    }
                  }}
                  disabled={clearAllMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  सर्व बंद
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {warnings.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">कोणत्याही सूचना नाहीत</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {warnings.map((warning) => (
                  <div
                    key={warning.id}
                    className={`p-3 hover:bg-gray-50 transition-colors ${
                      !warning.isRead ? 'bg-amber-50/50' : ''
                    }`}
                    onClick={() => {
                      if (!warning.isRead) {
                        markReadMutation.mutate(warning.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 p-1 rounded-full shrink-0 ${
                        warning.severity === 'critical' 
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-amber-100 text-amber-600'
                      }`}>
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-semibold ${
                            warning.severity === 'critical' ? 'text-red-700' : 'text-amber-700'
                          }`}>
                            {warning.title}
                          </p>
                          {!warning.isRead && (
                            <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 break-words">
                          {warning.message}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDateTime(warning.createdAt)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissMutation.mutate(warning.id);
                            }}
                            className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5"
                          >
                            <X className="h-3 w-3" />
                            बंद करा
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
      )}
    </div>
  );
}
