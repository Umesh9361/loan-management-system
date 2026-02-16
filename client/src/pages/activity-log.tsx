import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, RefreshCw, Clock, User, FileText, AlertTriangle } from "lucide-react";

interface ActivityLog {
  id: string;
  userId: string;
  activityType: string;
  description: string;
  metadata: string | null;
  createdAt: string;
  userName: string | null;
}

const activityTypeLabels: Record<string, { label: string; color: string }> = {
  login: { label: "लॉगिन", color: "bg-green-100 text-green-800" },
  logout: { label: "लॉगआउट", color: "bg-gray-100 text-gray-800" },
  create_group: { label: "नवीन ग्रुप", color: "bg-emerald-100 text-emerald-800" },
  update_group: { label: "ग्रुप अपडेट", color: "bg-indigo-100 text-indigo-800" },
  delete_group: { label: "ग्रुप डिलीट", color: "bg-red-100 text-red-800" },
  create_loan: { label: "नवीन कर्ज", color: "bg-emerald-100 text-emerald-800" },
  update_loan: { label: "कर्ज अपडेट", color: "bg-indigo-100 text-indigo-800" },
  delete_loan: { label: "कर्ज डिलीट", color: "bg-red-100 text-red-800" },
  reopen_loan: { label: "कर्ज पुन्हा सुरू", color: "bg-orange-100 text-orange-800" },
  create_party: { label: "नवीन पार्टी", color: "bg-emerald-100 text-emerald-800" },
  update_party: { label: "पार्टी अपडेट", color: "bg-indigo-100 text-indigo-800" },
  delete_party: { label: "पार्टी डिलीट", color: "bg-red-100 text-red-800" },
  create_cash_transaction: { label: "नवीन रोख व्यवहार", color: "bg-emerald-100 text-emerald-800" },
  update_cash_transaction: { label: "रोख व्यवहार अपडेट", color: "bg-indigo-100 text-indigo-800" },
  delete_cash_transaction: { label: "रोख व्यवहार डिलीट", color: "bg-red-100 text-red-800" },
  delete_photo: { label: "फोटो डिलीट", color: "bg-red-100 text-red-800" },
  date_warning: { label: "⚠️ तारीख चेतावणी", color: "bg-amber-100 text-amber-800" },
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export default function ActivityLogPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");

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

  const filteredLogs = filterType === "all" 
    ? logs 
    : filterType === "delete"
    ? logs.filter(log => log.activityType.startsWith("delete_"))
    : filterType === "update"
    ? logs.filter(log => log.activityType.startsWith("update_") || log.activityType === "reopen_loan")
    : filterType === "create"
    ? logs.filter(log => log.activityType.startsWith("create_"))
    : logs.filter(log => log.activityType === filterType);

  const deleteCount = logs.filter(l => l.activityType.startsWith("delete_")).length;
  const updateCount = logs.filter(l => l.activityType.startsWith("update_") || l.activityType === "reopen_loan").length;
  const createCount = logs.filter(l => l.activityType.startsWith("create_")).length;
  const loginCount = logs.filter(l => l.activityType === "login" || l.activityType === "logout").length;
  const warningCount = logs.filter(l => l.activityType === "date_warning").length;

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">कार्यवाही नोंद (Activity Log)</h1>
          <p className="text-muted-foreground text-sm mt-1">
            सर्व नवीन, डिलीट आणि अपडेट ऑपरेशन्सची नोंद
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
            disabled={clearLogsMutation.isPending || logs.length === 0}
            className="min-h-[40px]"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {clearLogsMutation.isPending ? "साफ करत आहे..." : "सर्व लॉग साफ करा"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge 
          variant={filterType === "all" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1"
          onClick={() => setFilterType("all")}
        >
          सर्व ({logs.length})
        </Badge>
        <Badge 
          variant={filterType === "delete" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1 border-red-300"
          onClick={() => setFilterType("delete")}
        >
          डिलीट ({deleteCount})
        </Badge>
        <Badge 
          variant={filterType === "update" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1 border-indigo-300"
          onClick={() => setFilterType("update")}
        >
          अपडेट ({updateCount})
        </Badge>
        <Badge 
          variant={filterType === "create" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1 border-emerald-300"
          onClick={() => setFilterType("create")}
        >
          नवीन ({createCount})
        </Badge>
        <Badge 
          variant={filterType === "login" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1 border-green-300"
          onClick={() => setFilterType("login")}
        >
          लॉगिन/लॉगआउट ({loginCount})
        </Badge>
        <Badge 
          variant={filterType === "date_warning" ? "default" : "outline"} 
          className="cursor-pointer px-3 py-1 border-amber-300"
          onClick={() => setFilterType("date_warning")}
        >
          ⚠️ चेतावणी ({warningCount})
        </Badge>
      </div>

      {clearLogsMutation.isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-700 text-sm">
          ✅ सर्व लॉग यशस्वीपणे साफ केले
        </div>
      )}

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
            कोणत्याही कार्यवाही नोंदी नाहीत
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const typeInfo = activityTypeLabels[log.activityType] || { 
              label: log.activityType, 
              color: "bg-gray-100 text-gray-800" 
            };
            const isDelete = log.activityType.startsWith("delete_");
            const isWarning = log.activityType === "date_warning";
            
            return (
              <Card 
                key={log.id} 
                className={`${isWarning ? 'border-amber-300 bg-amber-50' : isDelete ? 'border-red-200' : 'border-gray-200'}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={`text-xs ${typeInfo.color}`}>
                          {typeInfo.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.userName || "Unknown"}
                        </span>
                      </div>
                      <p className="text-sm font-medium break-words">
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
                                <p className="text-xs text-muted-foreground mt-1">
                                  {details.join(" | ")}
                                </p>
                              )}
                              {changedFieldsDisplay.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {changedFieldsDisplay.map((change, i) => (
                                    <p key={i} className="text-xs text-orange-600 dark:text-orange-400">
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
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(log.createdAt)}
                      </div>
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
