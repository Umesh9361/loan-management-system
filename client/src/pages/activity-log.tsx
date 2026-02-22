import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, RefreshCw, Clock, User, FileText, Search, Filter, Activity, Shield, Edit, PlusCircle, MinusCircle, LogIn, AlertTriangle } from "lucide-react";

interface ActivityLog {
  id: string;
  userId: string;
  activityType: string;
  description: string;
  metadata: string | null;
  createdAt: string;
  userName: string | null;
  userRole: string | null;
}

const activityTypeLabels: Record<string, { label: string; color: string; icon: string }> = {
  login: { label: "लॉगिन", color: "bg-green-100 text-green-800 border-green-300", icon: "🟢" },
  logout: { label: "लॉगआउट", color: "bg-gray-100 text-gray-800 border-gray-300", icon: "⚪" },
  create_group: { label: "नवीन ग्रुप", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "➕" },
  update_group: { label: "ग्रुप अपडेट", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: "✏️" },
  delete_group: { label: "ग्रुप डिलीट", color: "bg-red-100 text-red-800 border-red-300", icon: "🗑️" },
  create_loan: { label: "नवीन कर्ज", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "➕" },
  update_loan: { label: "कर्ज अपडेट", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: "✏️" },
  delete_loan: { label: "कर्ज डिलीट", color: "bg-red-100 text-red-800 border-red-300", icon: "🗑️" },
  reopen_loan: { label: "कर्ज पुन्हा सुरू", color: "bg-orange-100 text-orange-800 border-orange-300", icon: "🔄" },
  create_party: { label: "नवीन पार्टी", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "➕" },
  update_party: { label: "पार्टी अपडेट", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: "✏️" },
  delete_party: { label: "पार्टी डिलीट", color: "bg-red-100 text-red-800 border-red-300", icon: "🗑️" },
  create_cash_transaction: { label: "नवीन रोख व्यवहार", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "➕" },
  update_cash_transaction: { label: "रोख व्यवहार अपडेट", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: "✏️" },
  delete_cash_transaction: { label: "रोख व्यवहार डिलीट", color: "bg-red-100 text-red-800 border-red-300", icon: "🗑️" },
  delete_photo: { label: "फोटो डिलीट", color: "bg-red-100 text-red-800 border-red-300", icon: "🗑️" },
  date_warning: { label: "तारीख चेतावणी", color: "bg-amber-100 text-amber-800 border-amber-300", icon: "⚠️" },
  change_own_password: { label: "पासवर्ड बदल", color: "bg-purple-100 text-purple-800 border-purple-300", icon: "🔑" },
  toggle_tenant: { label: "टेनंट टॉगल", color: "bg-blue-100 text-blue-800 border-blue-300", icon: "🔀" },
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function ActivityLogPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: logs = [], isLoading, refetch } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/activity-logs", "DELETE");
      return await response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/activity-logs"], refetchType: 'all' });
    }
  });

  const handleClearLogs = () => {
    if (window.confirm("⚠️ सावधान!\n\nसर्व कार्यवाही नोंदी कायमच्या डिलीट होतील.\n\nतुम्हाला खात्री आहे का?")) {
      clearLogsMutation.mutate();
    }
  };

  const userLogs = useMemo(() => {
    return logs.filter(log => log.userRole !== 'admin' && log.userRole !== 'super_admin');
  }, [logs]);

  const uniqueUsers = useMemo(() => {
    const userMap = new Map<string, string>();
    userLogs.forEach(log => {
      if (log.userId && log.userName) {
        userMap.set(log.userId, log.userName);
      }
    });
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [userLogs]);

  const filteredLogs = useMemo(() => {
    let result = userLogs;

    if (filterUser !== "all") {
      result = result.filter(log => log.userId === filterUser);
    }

    if (filterType === "delete") {
      result = result.filter(log => log.activityType.startsWith("delete_"));
    } else if (filterType === "update") {
      result = result.filter(log => log.activityType.startsWith("update_") || log.activityType === "reopen_loan");
    } else if (filterType === "create") {
      result = result.filter(log => log.activityType.startsWith("create_"));
    } else if (filterType === "login") {
      result = result.filter(log => log.activityType === "login" || log.activityType === "logout");
    } else if (filterType !== "all") {
      result = result.filter(log => log.activityType === filterType);
    }

    if (searchText.trim()) {
      const search = searchText.trim().toLowerCase();
      result = result.filter(log =>
        log.description.toLowerCase().includes(search) ||
        (log.userName || "").toLowerCase().includes(search) ||
        (log.metadata || "").toLowerCase().includes(search)
      );
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter(log => new Date(log.createdAt) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(log => new Date(log.createdAt) <= toDate);
    }

    return result;
  }, [userLogs, filterType, filterUser, searchText, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const todayLogs = userLogs.filter(l => isToday(l.createdAt));
    const deleteCount = userLogs.filter(l => l.activityType.startsWith("delete_")).length;
    const updateCount = userLogs.filter(l => l.activityType.startsWith("update_") || l.activityType === "reopen_loan").length;
    const createCount = userLogs.filter(l => l.activityType.startsWith("create_")).length;
    const loginCount = userLogs.filter(l => l.activityType === "login" || l.activityType === "logout").length;

    const userActivityCount = new Map<string, number>();
    userLogs.forEach(log => {
      const name = log.userName || "Unknown";
      userActivityCount.set(name, (userActivityCount.get(name) || 0) + 1);
    });
    const topUser = Array.from(userActivityCount.entries()).sort((a, b) => b[1] - a[1])[0];

    return { total: userLogs.length, today: todayLogs.length, deleteCount, updateCount, createCount, loginCount, topUser };
  }, [userLogs]);

  const hasFilters = filterType !== "all" || filterUser !== "all" || searchText.trim() || dateFrom || dateTo;

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-indigo-800 flex items-center gap-2">
            <Activity className="h-6 w-6" />
            युजर कार्यवाही नोंद
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            सर्व युजर्सच्या कार्यवाहीची तपशीलवार नोंद (Admin वगळून)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="min-h-[40px]"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            रिफ्रेश
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearLogs}
            disabled={clearLogsMutation.isPending || userLogs.length === 0}
            className="min-h-[40px]"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {clearLogsMutation.isPending ? "साफ करत आहे..." : "सर्व लॉग साफ करा"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-indigo-700">{stats.total}</div>
          <div className="text-xs text-indigo-600 font-medium">एकूण नोंदी</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{stats.today}</div>
          <div className="text-xs text-blue-600 font-medium">आजचे</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">{stats.createCount}</div>
          <div className="text-xs text-emerald-600 font-medium">नवीन तयार</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-700">{stats.updateCount}</div>
          <div className="text-xs text-amber-600 font-medium">अपडेट</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-700">{stats.deleteCount}</div>
          <div className="text-xs text-red-600 font-medium">डिलीट</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{stats.loginCount}</div>
          <div className="text-xs text-green-600 font-medium">लॉगिन</div>
        </div>
      </div>

      {stats.topUser && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-indigo-600" />
          <span className="text-indigo-700">
            <strong>सर्वाधिक सक्रिय युजर:</strong> {stats.topUser[0]} ({stats.topUser[1]} कार्यवाही)
          </span>
        </div>
      )}

      <div className="bg-white border rounded-lg p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Filter className="h-4 w-4" />
          फिल्टर
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">युजर निवडा</label>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="सर्व युजर" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">सर्व युजर</SelectItem>
                {uniqueUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">शोधा</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="नाव, खाते, वर्णन..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">तारखेपासून</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">तारखेपर्यंत</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterType("all"); setFilterUser("all"); setSearchText(""); setDateFrom(""); setDateTo(""); }}
            className="text-xs text-gray-500"
          >
            ✕ सर्व फिल्टर काढा
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge 
          variant={filterType === "all" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1.5 text-xs"
          onClick={() => setFilterType("all")}
        >
          सर्व ({userLogs.length})
        </Badge>
        <Badge 
          variant={filterType === "create" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1.5 text-xs border-emerald-300"
          onClick={() => setFilterType("create")}
        >
          <PlusCircle className="h-3 w-3 mr-1" />
          नवीन ({stats.createCount})
        </Badge>
        <Badge 
          variant={filterType === "update" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1.5 text-xs border-indigo-300"
          onClick={() => setFilterType("update")}
        >
          <Edit className="h-3 w-3 mr-1" />
          अपडेट ({stats.updateCount})
        </Badge>
        <Badge 
          variant={filterType === "delete" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1.5 text-xs border-red-300"
          onClick={() => setFilterType("delete")}
        >
          <MinusCircle className="h-3 w-3 mr-1" />
          डिलीट ({stats.deleteCount})
        </Badge>
        <Badge 
          variant={filterType === "login" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1.5 text-xs border-green-300"
          onClick={() => setFilterType("login")}
        >
          <LogIn className="h-3 w-3 mr-1" />
          लॉगिन ({stats.loginCount})
        </Badge>
        <Badge 
          variant={filterType === "date_warning" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1.5 text-xs border-amber-300"
          onClick={() => setFilterType("date_warning")}
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          चेतावणी ({userLogs.filter(l => l.activityType === "date_warning").length})
        </Badge>
      </div>

      {clearLogsMutation.isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-700 text-sm">
          ✅ सर्व लॉग यशस्वीपणे साफ केले
        </div>
      )}

      <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
        <span>दाखवत आहे: {filteredLogs.length} नोंदी {hasFilters ? "(फिल्टर लागू)" : ""}</span>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            लॉग लोड करत आहे...
          </CardContent>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {hasFilters ? "या फिल्टरनुसार कोणत्याही नोंदी नाहीत" : "कोणत्याही युजर कार्यवाही नोंदी नाहीत"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const typeInfo = activityTypeLabels[log.activityType] || { 
              label: log.activityType, 
              color: "bg-gray-100 text-gray-800 border-gray-300",
              icon: "📋"
            };
            const isDelete = log.activityType.startsWith("delete_");
            const isWarning = log.activityType === "date_warning";
            
            return (
              <Card 
                key={log.id} 
                className={`transition-all hover:shadow-sm ${isWarning ? 'border-amber-300 bg-amber-50/50' : isDelete ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <Badge className={`text-xs border ${typeInfo.color}`} variant="outline">
                          {typeInfo.icon} {typeInfo.label}
                        </Badge>
                        <span className="text-xs text-indigo-600 font-medium flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-full">
                          <User className="h-3 w-3" />
                          {log.userName || "Unknown"}
                        </span>
                      </div>
                      <p className="text-sm font-medium break-words text-gray-800">
                        {log.description}
                      </p>
                      {log.metadata && (() => {
                        try {
                          const meta = JSON.parse(log.metadata);
                          const details: string[] = [];
                          if (meta.accountNumber) details.push(`खाते: ${meta.accountNumber}`);
                          if (meta.borrowerName) details.push(`नाव: ${meta.borrowerName}`);
                          if (meta.amount) details.push(`रक्कम: ₹${Number(meta.amount).toLocaleString('en-IN')}`);
                          if (meta.principalAmount) details.push(`मूळ रक्कम: ₹${Number(meta.principalAmount).toLocaleString('en-IN')}`);
                          if (meta.groupName) details.push(`ग्रुप: ${meta.groupName}`);
                          if (meta.partyName) details.push(`पार्टी: ${meta.partyName}`);
                          if (meta.filename) details.push(`फाईल: ${meta.filename}`);
                          if (meta.loanDate) details.push(`तारीख: ${meta.loanDate}`);
                          if (meta.interestRate) details.push(`व्याज दर: ${meta.interestRate}%`);
                          if (meta.transactionDate) details.push(`तारीख: ${meta.transactionDate}`);
                          if (meta.transactionType) details.push(`प्रकार: ${meta.transactionType === 'cash_in' ? 'जमा' : meta.transactionType === 'cash_out' ? 'नावे' : meta.transactionType}`);
                          if (meta.narration && !details.some(d => d.includes(meta.narration?.substring(0, 20)))) details.push(`वर्णन: ${meta.narration}`);
                          if (meta.category) details.push(`वर्ग: ${meta.category}`);
                          if (meta.oldName && meta.oldName !== (meta.groupName || meta.partyName)) details.push(`जुने नाव: ${meta.oldName}`);
                          if (meta.openingBalance) details.push(`प्रारंभिक शिल्लक: ₹${Number(meta.openingBalance).toLocaleString('en-IN')}`);
                          
                          const fieldLabels: Record<string, string> = {
                            principalAmount: 'मूळ रक्कम',
                            loanDate: 'कर्ज तारीख',
                            interestRate: 'व्याज दर',
                            borrowerName: 'कर्जदार नाव',
                            accountNumber: 'खाते क्रमांक',
                            amount: 'रक्कम',
                            narration: 'वर्णन',
                            transactionDate: 'व्यवहार तारीख',
                            transactionType: 'व्यवहार प्रकार',
                            name: 'नाव',
                            status: 'स्थिती',
                            maturityDate: 'मुदत तारीख',
                          };
                          
                          const changedFieldsDisplay: string[] = [];
                          if (meta.changedFields && typeof meta.changedFields === 'object') {
                            for (const [field, change] of Object.entries(meta.changedFields)) {
                              const c = change as { old: any; new: any };
                              const label = fieldLabels[field] || field;
                              changedFieldsDisplay.push(`${label}: ${c.old} → ${c.new}`);
                            }
                          }

                          return (
                            <>
                              {details.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                                  {details.join(" · ")}
                                </p>
                              )}
                              {changedFieldsDisplay.length > 0 && (
                                <div className="mt-1.5 bg-orange-50 border border-orange-200 rounded p-2 space-y-0.5">
                                  <span className="text-xs font-semibold text-orange-700">बदल:</span>
                                  {changedFieldsDisplay.map((change, i) => (
                                    <p key={i} className="text-xs text-orange-700">
                                      ✏️ {change}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        } catch { return null; }
                      })()}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(log.createdAt)}
                      </div>
                      {isToday(log.createdAt) && (
                        <Badge variant="outline" className="text-[10px] mt-1 border-blue-300 text-blue-600">
                          आज
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
