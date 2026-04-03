import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, ArrowUpDown, CheckCircle, Database, Download, Eye, HardDrive, RefreshCw, Scale, Shield, Trash2, Upload } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import html2canvas from "html2canvas";
import { initDevanagariFont } from "@/lib/pdf-text-generator";

interface DataManagementResult {
  success: boolean;
  message: string;
  summary: any;
  details: any[];
  backupId?: string;
}

interface IntegrityCheckResult {
  success: boolean;
  message: string;
  summary: {
    issuesFound: number;
    timestamp: string;
  };
  details: Array<{ issue: string }>;
}

interface ReconciliationResult {
  success: boolean;
  missingCount: number;
  totalMissingAmount: number;
  loans: Array<{ id: number; accountNumber: string; borrowerName: string; groupName: string; loanDate: string; principalAmount: number; status?: string }>;
  mismatches: Array<{ id: number; accountNumber: string; borrowerName: string; groupName: string; loanDate: string; principalAmount: number; cashEntryId: string; cashEntryAmount: number; status?: string }>;
  duplicates: Array<{ id: number; accountNumber: string; borrowerName: string; loanDate: string; principalAmount: number; cashEntryIds: string[]; cashEntryAmounts: number[]; keepEntryId?: string; keepEntryIds?: string[] }>;
  summary: { missingCount: number; mismatchCount: number; duplicateCount: number; totalDiscrepancy: number };
}

function CashReconciliationTab({ queryClient }: { queryClient: any }) {
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<{ message: string; deleted: number; created: number } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const { data: balanceData, isLoading, refetch } = useQuery<{
    cashTotal: number; loanTotal: number; diff: number; allClear: boolean;
  }>({
    queryKey: ["/api/data-management/balance-check"],
    retry: false,
    staleTime: 0,
  });

  const { data: detailData, isLoading: detailLoading, refetch: refetchDetails } = useQuery<ReconciliationResult>({
    queryKey: ["/api/data-management/missing-cash-entries"],
    retry: false,
    staleTime: 0,
    enabled: showDetails,
  });

  const rebuildMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/data-management/rebuild-disbursement-entries", "POST");
      return await response.json();
    },
    onSuccess: async (data: any) => {
      setRebuildResult(data);
      setConfirmRebuild(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' });
      refetch();
    }
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <Card className="border-2 border-amber-200 dark:border-amber-800 rounded-xl shadow-sm">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <div className="p-1.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg">
            <Scale className="h-4 w-4 text-white" />
          </div>
          कर्ज व रोकड मेळ
        </CardTitle>
        <CardDescription className="text-amber-700 dark:text-amber-400">
          कॅशबुक कर्ज वितरण = कर्ज DB मुद्दल — दोन्ही जुळतात का ते तपासा
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-5">

        {isLoading && (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border">
            <RefreshCw className="h-5 w-5 animate-spin text-amber-600" />
            <span className="text-gray-600 text-sm">तपासत आहे...</span>
          </div>
        )}

        {balanceData && !isLoading && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border-2 ${balanceData.allClear
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'}`}>
              <div className={`flex items-center gap-2 font-semibold text-sm ${balanceData.allClear ? 'text-green-700' : 'text-red-700'}`}>
                {balanceData.allClear
                  ? <><CheckCircle className="h-5 w-5" /> सर्व ठीक आहे — कॅशबुक आणि कर्ज जुळतात</>
                  : <><AlertTriangle className="h-5 w-5" /> फरक आढळला — Rebuild करणे आवश्यक आहे</>
                }
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-white rounded-lg p-2 text-center border">
                  <div className="text-gray-500 mb-1">कॅशबुक कर्ज वितरण</div>
                  <div className="font-bold text-blue-700">{fmt(balanceData.cashTotal)}</div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border">
                  <div className="text-gray-500 mb-1">कर्ज DB मुद्दल</div>
                  <div className="font-bold text-indigo-700">{fmt(balanceData.loanTotal)}</div>
                </div>
                <div className={`rounded-lg p-2 text-center border ${balanceData.allClear ? 'bg-green-100' : 'bg-red-100'}`}>
                  <div className="text-gray-500 mb-1">फरक</div>
                  <div className={`font-bold ${balanceData.allClear ? 'text-green-700' : 'text-red-700'}`}>
                    {balanceData.allClear ? '₹0' : fmt(balanceData.diff)}
                  </div>
                </div>
              </div>
            </div>

            {!balanceData.allClear && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                <strong>उपाय:</strong> खाली "Rebuild" button वापरा — सर्व कर्ज वितरण entries DB वरून fresh तयार होतील आणि फरक ₹0 होईल.
              </div>
            )}

            {rebuildResult && (
              <Alert className="border-green-300 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700 text-sm">Rebuild यशस्वी!</AlertTitle>
                <AlertDescription className="text-green-600 text-xs">
                  {rebuildResult.message}
                  <span className="block mt-1">हटवल्या: {rebuildResult.deleted} | नव्या: {rebuildResult.created}</span>
                </AlertDescription>
              </Alert>
            )}

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <p className="text-xs text-gray-500 font-medium">कर्ज वितरण Entries Rebuild</p>
              {!confirmRebuild ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-400 text-orange-700 hover:bg-orange-50 text-xs"
                  onClick={() => setConfirmRebuild(true)}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Rebuild करा (सर्व entries fresh तयार होतील)
                </Button>
              ) : (
                <div className="p-3 bg-orange-50 rounded-xl border-2 border-orange-300 space-y-2">
                  <p className="text-orange-800 text-xs font-semibold">⚠️ खात्री करा:</p>
                  <ul className="text-orange-700 text-xs space-y-1 list-disc list-inside">
                    <li>जुन्या loan_disbursement entries DELETE होतील</li>
                    <li>प्रत्येक कर्जासाठी DB वरून fresh entry तयार होईल</li>
                    <li>Opening balance, expenses, repayment entries safe आहेत</li>
                  </ul>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-7"
                      onClick={() => rebuildMutation.mutate()}
                      disabled={rebuildMutation.isPending}
                    >
                      {rebuildMutation.isPending
                        ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Rebuild करत आहे...</>
                        : <>✅ होय, Rebuild करा</>}
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7"
                      onClick={() => setConfirmRebuild(false)} disabled={rebuildMutation.isPending}>
                      रद्द करा
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                पुन्हा तपासा
              </Button>
              {!balanceData.allClear && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-400 text-blue-700 hover:bg-blue-50 text-xs"
                  onClick={() => { setShowDetails(!showDetails); if (!showDetails) refetchDetails(); }}
                >
                  {showDetails ? "तपशील लपवा" : "कोणती कर्जे मिसिंग? पाहा"}
                </Button>
              )}
            </div>

            {showDetails && (
              <div className="mt-3 border border-blue-200 rounded-xl overflow-hidden">
                <div className="bg-blue-50 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-800">कॅशबुक एन्ट्री नसलेली कर्जे</span>
                  {detailLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />}
                </div>
                {detailData && !detailLoading && (
                  <div className="overflow-x-auto">
                    {detailData.loans.length === 0 && detailData.mismatches.length === 0 ? (
                      <div className="p-4 text-center text-sm text-green-700">
                        ✅ सर्व कर्जांच्या कॅशबुक entries सापडल्या — Details सापडले नाहीत (totals मध्ये फरक असेल तर Rebuild करा)
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-blue-100 text-blue-800">
                            <th className="px-3 py-2 text-left font-semibold">खाते</th>
                            <th className="px-3 py-2 text-left font-semibold">ग्रुप</th>
                            <th className="px-3 py-2 text-left font-semibold">नाव</th>
                            <th className="px-3 py-2 text-left font-semibold">कर्ज दिनांक</th>
                            <th className="px-3 py-2 text-right font-semibold">मुद्दल</th>
                            <th className="px-3 py-2 text-center font-semibold">स्थिती</th>
                            <th className="px-3 py-2 text-center font-semibold">समस्या</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.loans.map((loan, i) => (
                            <tr key={`miss-${i}`} className="border-t border-blue-100 hover:bg-red-50">
                              <td className="px-3 py-2 font-mono font-semibold text-gray-800">{loan.accountNumber || '—'}</td>
                              <td className="px-3 py-2 text-gray-700">{loan.groupName || '—'}</td>
                              <td className="px-3 py-2 text-gray-800">{loan.borrowerName}</td>
                              <td className="px-3 py-2 text-gray-600">
                                {loan.loanDate ? (() => {
                                  const d = new Date(loan.loanDate);
                                  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                                })() : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-red-700">
                                ₹{Number(loan.principalAmount).toLocaleString('en-IN')}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {loan.status === 'closed'
                                  ? <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">बंद खाते</span>
                                  : <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">सक्रिय</span>
                                }
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">एन्ट्री नाही</span>
                              </td>
                            </tr>
                          ))}
                          {detailData.mismatches.map((m, i) => (
                            <tr key={`mm-${i}`} className="border-t border-blue-100 hover:bg-amber-50">
                              <td className="px-3 py-2 font-mono font-semibold text-gray-800">{m.accountNumber || '—'}</td>
                              <td className="px-3 py-2 text-gray-700">{m.groupName || '—'}</td>
                              <td className="px-3 py-2 text-gray-800">{m.borrowerName}</td>
                              <td className="px-3 py-2 text-gray-600">
                                {m.loanDate ? (() => {
                                  const d = new Date(m.loanDate);
                                  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                                })() : '—'}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="text-indigo-700 font-semibold">₹{Number(m.principalAmount).toLocaleString('en-IN')}</div>
                                <div className="text-gray-500 text-xs">कॅश: ₹{Number(m.cashEntryAmount).toLocaleString('en-IN')}</div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {m.status === 'closed'
                                  ? <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">बंद खाते</span>
                                  : <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">सक्रिय</span>
                                }
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">रक्कम वेगळी</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DataManagementPage() {
  const queryClient = useQueryClient();
  
  const [backupPortable, setBackupPortable] = useState(false);

  const [cleanupOptions, setCleanupOptions] = useState({
    dateFrom: "",
    dateTo: "",
    includeAssociatedTransactions: true,
    createBackup: true
  });

  const [rearrangeGroupId, setRearrangeGroupId] = useState(() => {
    return sessionStorage.getItem('rearrange_groupId') || "";
  });
  const [rearrangeUpToDate, setRearrangeUpToDate] = useState(() => {
    return sessionStorage.getItem('rearrange_upToDate') || "";
  });
  const [rearrangePreviewData, setRearrangePreviewData] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('rearrange_previewData');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [rearrangePreviewParams, setRearrangePreviewParams] = useState<{ groupId: string; upToDate: string } | null>(() => {
    try {
      const saved = sessionStorage.getItem('rearrange_previewParams');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [rearrangePdfDownloaded, setRearrangePdfDownloaded] = useState(() => {
    return sessionStorage.getItem('rearrange_pdfDownloaded') === 'true';
  });

  const [cashbookCleanupOptions, setCashbookCleanupOptions] = useState({
    dateFrom: "",
    dateTo: "",
    cleanCashTransactions: true,
    cleanJournalEntries: true,
    createBackup: true
  });

  const [loanCleanupPreview, setLoanCleanupPreview] = useState<{
    success: boolean;
    loanCount: number;
    totalDisbursed: number;
    totalRepaid: number;
    netCashbookImpact: number;
    interestAmount: number;
    loans: { accountNumber: string; borrowerName: string; disbursed: number; repaid: number; net: number }[];
    message: string;
  } | null>(null);

  const [showLoanPreviewTable, setShowLoanPreviewTable] = useState(false);

  const [cashbookPreview, setCashbookPreview] = useState<{
    success: boolean;
    deletableCount: number;
    protectedCount: number;
    deletableJournalCount: number;
    protectedJournalCount: number;
    details: { category: string; count: number }[];
    balanceImpact?: {
      totalCashInDeleted: number;
      totalCashOutDeleted: number;
      netImpact: number;
      adjustmentType: 'cash_in' | 'cash_out' | 'none';
      adjustmentAmount: number;
      partyWiseImpact: { partyName: string; partyId: string; cashIn: number; cashOut: number; net: number }[];
    };
  } | null>(null);

  useEffect(() => {
    sessionStorage.setItem('rearrange_groupId', rearrangeGroupId);
  }, [rearrangeGroupId]);

  useEffect(() => {
    sessionStorage.setItem('rearrange_upToDate', rearrangeUpToDate);
  }, [rearrangeUpToDate]);

  useEffect(() => {
    if (rearrangePreviewData) {
      sessionStorage.setItem('rearrange_previewData', JSON.stringify(rearrangePreviewData));
    } else {
      sessionStorage.removeItem('rearrange_previewData');
    }
  }, [rearrangePreviewData]);

  useEffect(() => {
    if (rearrangePreviewParams) {
      sessionStorage.setItem('rearrange_previewParams', JSON.stringify(rearrangePreviewParams));
    } else {
      sessionStorage.removeItem('rearrange_previewParams');
    }
  }, [rearrangePreviewParams]);

  useEffect(() => {
    sessionStorage.setItem('rearrange_pdfDownloaded', rearrangePdfDownloaded ? 'true' : 'false');
  }, [rearrangePdfDownloaded]);

  const clearRearrangeSession = useCallback(() => {
    setRearrangePreviewData(null);
    setRearrangePreviewParams(null);
    setRearrangePdfDownloaded(false);
    setRearrangeGroupId("");
    setRearrangeUpToDate("");
    sessionStorage.removeItem('rearrange_groupId');
    sessionStorage.removeItem('rearrange_upToDate');
    sessionStorage.removeItem('rearrange_previewData');
    sessionStorage.removeItem('rearrange_previewParams');
    sessionStorage.removeItem('rearrange_pdfDownloaded');
  }, []);

  const isPreviewStale = rearrangePreviewData && rearrangePreviewParams && (
    rearrangePreviewParams.groupId !== rearrangeGroupId ||
    rearrangePreviewParams.upToDate !== rearrangeUpToDate
  );

  // Groups query for account rearrangement
  const { data: groupsData } = useQuery({
    queryKey: ["/api/groups"],
    retry: false
  });

  // Integrity check query
  const { data: integrityData, isLoading: integrityLoading, refetch: refetchIntegrity } = useQuery({
    queryKey: ["/api/data-management/integrity-check"],
    retry: false
  });

  // Cleanup mutation with comprehensive cache invalidation
  const cleanupMutation = useMutation({
    mutationFn: async (options: typeof cleanupOptions) => {
      const response = await apiRequest("/api/data-management/cleanup-closed-loans", "POST", options);
      return await response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' });
      
      refetchIntegrity();
    }
  });

  const backupMutation = useMutation({
    mutationFn: async (options?: { portable?: boolean }) => {
      const response = await apiRequest("/api/data-management/create-backup", "POST", { portable: options?.portable || false });
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.success && data.backupData) {
        const jsonStr = JSON.stringify(data.backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;
        const timeStr = `${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`;
        const isPortable = data.backupData.portable === true;
        const prefix = isPortable ? 'portable_backup' : 'backup';
        const tenantLabel = isPortable ? (data.backupData.originalTenantId || 'universal') : data.backupData.tenantId;
        a.href = url;
        a.download = `${prefix}_${tenantLabel}_${dateStr}_${timeStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  });

  // System restore mutation
  const restoreMutation = useMutation({
    mutationFn: async (options: { createBackup: boolean } = { createBackup: true }) => {
      const response = await apiRequest("/api/data-management/restore-system-data", "POST", options);
      return await response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' });
      
      refetchIntegrity();
    }
  });

  // Restore from backup mutation
  const restoreFromBackupMutation = useMutation({
    mutationFn: async (backupData: any) => {
      const response = await apiRequest("/api/data-management/restore-from-backup", "POST", { backupData });
      return await response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' });
      
      refetchIntegrity();
    }
  });

  const rearrangePreviewMutation = useMutation({
    mutationFn: async (params: { groupId: string; upToDate?: string }) => {
      const response = await apiRequest("/api/data-management/rearrange-preview", "POST", params);
      return await response.json();
    },
    onSuccess: (data: any) => {
      setRearrangePreviewData(data);
      setRearrangePreviewParams({ groupId: rearrangeGroupId, upToDate: rearrangeUpToDate });
      setRearrangePdfDownloaded(false);
    }
  });

  const rearrangeConfirmMutation = useMutation({
    mutationFn: async (params: { groupId: string; upToDate?: string; checksum?: string }) => {
      const response = await apiRequest("/api/data-management/rearrange-confirm", "POST", params);
      return await response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"], refetchType: 'all' });
      clearRearrangeSession();
    }
  });

  const rearrangeAccountsMutation = rearrangeConfirmMutation;

  const loanCleanupPreviewMutation = useMutation({
    mutationFn: async (options: { dateFrom?: string; dateTo?: string }) => {
      const response = await apiRequest("/api/data-management/preview-closed-loan-cleanup", "POST", options);
      return await response.json();
    },
    onSuccess: (data: any) => {
      setLoanCleanupPreview(data);
      setShowLoanPreviewTable(false);
    }
  });

  const cashbookPreviewMutation = useMutation({
    mutationFn: async (options: { dateFrom: string; dateTo: string }) => {
      const response = await apiRequest("/api/data-management/preview-cashbook-cleanup", "POST", options);
      return await response.json();
    },
    onSuccess: (data: any) => {
      setCashbookPreview(data);
    }
  });

  const cashbookCleanupMutation = useMutation({
    mutationFn: async (options: typeof cashbookCleanupOptions) => {
      const response = await apiRequest("/api/data-management/cleanup-cashbook-entries", "POST", options);
      return await response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' });
      refetchIntegrity();
    }
  });

  const handleCleanup = () => {
    const confirmed = window.confirm(
      "⚠️ सावधान!\n\nया तारखांमधील सर्व बंद कर्जांचा डेटा कायमचा काढला जाईल.\nहे action undo करता येणार नाही!\n\nतुम्हाला खात्री आहे का?"
    );
    if (confirmed) {
      cleanupMutation.mutate(cleanupOptions);
    }
  };

  const handleBackup = () => {
    backupMutation.mutate({ portable: backupPortable });
  };

  const handleRestore = () => {
    const confirmed = window.confirm(
      "⚠️ सावधान!\n\nसर्व loans, borrowers, cash transactions, journal entries, groups, parties, companies - सगळा डेटा permanently delete होईल!\n\nहे action undo करता येणार नाही!\n\nपहिले backup तयार केला जाईल, पण तुम्हाला खात्री आहे का?"
    );
    if (confirmed) {
      restoreMutation.mutate({ createBackup: true });
    }
  };

  const handleRearrangePreview = () => {
    if (!rearrangeGroupId) return;
    rearrangePreviewMutation.mutate({
      groupId: rearrangeGroupId,
      upToDate: rearrangeUpToDate || undefined
    });
  };

  const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const buildRearrangePageHtml = (
    mapping: any[],
    groupName: string,
    totalRows: number,
    pageNum: number,
    totalPages: number,
    pageItems: { serialNum: number; item: any }[],
    isMobile: boolean,
    isTwoColumn: boolean,
    dateInfo: string
  ) => {
    const fontFamily = "'Noto Sans Devanagari', Arial, sans-serif";
    const headerRow = (cols: string[]) => `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;

    const headers = ['अ.क्र.', 'तारीख', 'जुना क्र.', 'नवीन क्र.'];

    if (isTwoColumn) {
      const half = Math.ceil(pageItems.length / 2);
      const leftItems = pageItems.slice(0, half);
      const rightItems = pageItems.slice(half);

      const buildTable = (items: { serialNum: number; item: any }[]) => {
        if (items.length === 0) return '';
        const rows = items.map((pi, idx) =>
          `<tr class="${idx % 2 === 0 ? 'even-row' : ''}">
            <td>${pi.serialNum}</td>
            <td>${formatDateDDMMYYYY(pi.item.loanDate)}</td>
            <td>${pi.item.oldAccountNumber}</td>
            <td class="new-num">${pi.item.newAccountNumber}</td>
          </tr>`
        ).join('');
        return `<table class="data-table">
          ${headerRow(headers)}
          ${rows}
        </table>`;
      };

      return `
        <div class="page" style="width:794px;min-height:1123px;padding:0;margin:0;background:#fff;font-family:${fontFamily};box-sizing:border-box;">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');
            .page * { box-sizing: border-box; }
            .title { text-align:center;font-size:20px;font-weight:700;color:#000;margin-top:16px;margin-bottom:4px; }
            .group-name { text-align:center;font-size:16px;font-weight:600;color:#000;margin-bottom:3px; }
            .info-line { text-align:center;font-size:13px;color:#505050;margin-bottom:8px; }
            .divider { height:2px;background:#4F46E5;margin:0 56px 12px 56px; }
            .tables-container { display:flex;gap:30px;padding:0 56px; }
            .data-table { border-collapse:collapse;width:100%;border:1px solid #4F46E5; }
            .data-table th { background:#4F46E5;color:#fff;padding:6px 4px;font-size:13px;font-weight:600;text-align:center;border:none; }
            .data-table td { padding:5px 4px;font-size:12px;text-align:center;color:#000;border-bottom:1px solid #D2D2DC; }
            .data-table .even-row td { background:#F5F5FA; }
            .data-table .new-num { color:#4F46E5;font-weight:600; }
            .data-table th:nth-child(1) { width:15%; }
            .data-table th:nth-child(2) { width:35%; }
            .data-table th:nth-child(3) { width:25%; }
            .data-table th:nth-child(4) { width:25%; }
          </style>
          <div class="title">खाते क्रमांक पुनर्क्रमांकन</div>
          <div class="group-name">${groupName}</div>
          <div class="info-line">एकूण कर्जे: ${totalRows}  |  ${dateInfo}  |  पान ${pageNum}/${totalPages}</div>
          <div class="divider"></div>
          <div class="tables-container">
            <div style="flex:1">${buildTable(leftItems)}</div>
            <div style="flex:1">${buildTable(rightItems)}</div>
          </div>
        </div>
      `;
    } else {
      const rows = pageItems.map((pi, idx) =>
        `<tr style="${idx % 2 === 0 ? '' : ''}">
          <td>${pi.serialNum}</td>
          <td>${formatDateDDMMYYYY(pi.item.loanDate)}</td>
          <td>${pi.item.oldAccountNumber}</td>
          <td>${pi.item.newAccountNumber}</td>
        </tr>`
      ).join('');

      return `
        <div class="page" style="width:794px;min-height:1123px;padding:0;margin:0;background:#fff;font-family:${fontFamily};box-sizing:border-box;">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');
            .page * { box-sizing: border-box; }
            .title { text-align:center;font-size:20px;font-weight:700;color:#000;margin-top:16px;margin-bottom:4px; }
            .group-name { text-align:center;font-size:16px;font-weight:600;color:#000;margin-bottom:3px; }
            .info-line { text-align:center;font-size:13px;color:#505050;margin-bottom:8px; }
            .divider { height:2px;background:#4F46E5;margin:0 45px 12px 45px; }
            .mobile-table { border-collapse:collapse;width:calc(100% - 90px);margin:0 45px; }
            .mobile-table th { background:#DCDCE1;color:#000;padding:8px 4px;font-size:15px;font-weight:600;text-align:center;border-top:1.5px solid #000;border-bottom:1.5px solid #000; }
            .mobile-table td { padding:7px 4px;font-size:14px;text-align:center;color:#000;border-bottom:1px solid #B4B4B9; }
            .mobile-table th:nth-child(1) { width:12%; }
            .mobile-table th:nth-child(2) { width:35%; }
            .mobile-table th:nth-child(3) { width:26%; }
            .mobile-table th:nth-child(4) { width:27%; }
            .footer { text-align:center;font-size:11px;color:#787878;margin-top:12px; }
          </style>
          <div class="title">खाते क्रमांक पुनर्क्रमांकन</div>
          <div class="group-name">${groupName}</div>
          <div class="info-line">एकूण कर्जे: ${totalRows}  |  ${dateInfo}  |  पान ${pageNum}/${totalPages}</div>
          <div class="divider"></div>
          <table class="mobile-table">
            ${headerRow(headers)}
            ${rows}
            <tr><td colspan="4" style="border-bottom:1.5px solid #000;padding:0;"></td></tr>
          </table>
          <div class="footer">पान ${pageNum} / ${totalPages}</div>
        </div>
      `;
    }
  };

  const renderPageToCanvas = async (htmlContent: string): Promise<HTMLCanvasElement> => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 400));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    });

    document.body.removeChild(container);
    return canvas;
  };

  const generateRearrangePdf = async () => {
    if (!rearrangePreviewData?.mapping?.length) return;

    const mapping = rearrangePreviewData.mapping;
    const groupName = Array.isArray(groupsData) ? groupsData.find((g: any) => g.id.toString() === rearrangeGroupId)?.name || '' : '';
    const dateInfo = rearrangeUpToDate ? `${formatDateDDMMYYYY(rearrangeUpToDate)} पर्यंत` : 'सर्व कर्ज';

    const rowsPerColumn = 35;
    const totalRows = mapping.length;
    const rowsPerPage = rowsPerColumn * 2;
    const totalPages = Math.ceil(totalRows / rowsPerPage);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      const startIdx = page * rowsPerPage;
      const endIdx = Math.min(startIdx + rowsPerPage, totalRows);
      const pageItems: { serialNum: number; item: any }[] = [];
      for (let r = startIdx; r < endIdx; r++) {
        pageItems.push({ serialNum: r + 1, item: mapping[r] });
      }

      const pageHtml = buildRearrangePageHtml(mapping, groupName, totalRows, page + 1, totalPages, pageItems, false, true, dateInfo);
      const canvas = await renderPageToCanvas(pageHtml);

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const a4W = 210;
      const a4H = 297;
      const margin = 2;
      const contentW = a4W - margin * 2;
      const ratio = contentW / canvas.width;
      const contentH = Math.min(canvas.height * ratio, a4H - margin * 2);

      pdf.addImage(imgData, 'JPEG', margin, margin, contentW, contentH);
    }

    pdf.save(`खाते_पुनर्क्रमांकन_${groupName}.pdf`);
    setRearrangePdfDownloaded(true);
  };

  const generateMobileRearrangePdf = async () => {
    if (!rearrangePreviewData?.mapping?.length) return;

    const mapping = rearrangePreviewData.mapping;
    const groupName = Array.isArray(groupsData) ? groupsData.find((g: any) => g.id.toString() === rearrangeGroupId)?.name || '' : '';
    const dateInfo = rearrangeUpToDate ? `${formatDateDDMMYYYY(rearrangeUpToDate)} पर्यंत` : 'सर्व कर्ज';

    const rowsPerPage = 30;
    const totalRows = mapping.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      const startIdx = page * rowsPerPage;
      const endIdx = Math.min(startIdx + rowsPerPage, totalRows);
      const pageItems: { serialNum: number; item: any }[] = [];
      for (let r = startIdx; r < endIdx; r++) {
        pageItems.push({ serialNum: r + 1, item: mapping[r] });
      }

      const pageHtml = buildRearrangePageHtml(mapping, groupName, totalRows, page + 1, totalPages, pageItems, true, false, dateInfo);
      const canvas = await renderPageToCanvas(pageHtml);

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const a4W = 210;
      const a4H = 297;
      const margin = 2;
      const contentW = a4W - margin * 2;
      const ratio = contentW / canvas.width;
      const contentH = Math.min(canvas.height * ratio, a4H - margin * 2);

      pdf.addImage(imgData, 'JPEG', margin, margin, contentW, contentH);
    }

    pdf.save(`खाते_पुनर्क्रमांकन_${groupName}_mobile.pdf`);
    setRearrangePdfDownloaded(true);
  };

  const handleRearrangeConfirm = () => {
    if (isPreviewStale || !rearrangePreviewParams) {
      alert("Preview जुनी झाली आहे. कृपया पुन्हा Preview बघा.");
      return;
    }
    const confirmed = window.confirm(
      "⚠️ PDF डाउनलोड झाले आहे.\n\nआता खाते क्रमांक बदलायचे का?\nहे बदल पूर्ववत करता येणार नाहीत!"
    );
    if (confirmed) {
      rearrangeConfirmMutation.mutate({
        groupId: rearrangePreviewParams.groupId,
        upToDate: rearrangePreviewParams.upToDate || undefined,
        checksum: rearrangePreviewData?.checksum
      });
    }
  };

  const handleRestoreFromBackup = () => {
    const confirmed = window.confirm(
      "⚠️ सावधान!\n\nbackup file मधील डेटा restore केल्यावर सध्याचा सर्व डेटा replace होईल!\n\nतुम्हाला खात्री आहे का?"
    );
    if (!confirmed) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const backupData = JSON.parse(e.target?.result as string);
            restoreFromBackupMutation.mutate(backupData);
          } catch (error) {
            console.error('Invalid backup file:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleCashbookPreview = () => {
    if (!cashbookCleanupOptions.dateFrom || !cashbookCleanupOptions.dateTo) return;
    cashbookPreviewMutation.mutate({
      dateFrom: cashbookCleanupOptions.dateFrom,
      dateTo: cashbookCleanupOptions.dateTo
    });
  };

  const handleCashbookCleanup = () => {
    if (!cashbookCleanupOptions.dateFrom || !cashbookCleanupOptions.dateTo) return;
    const confirmed = window.confirm(
      "⚠️ सावधान!\n\nया तारखांमधील सामान्य कॅशबुक एन्ट्री कायमच्या हटवल्या जातील.\nकर्जाच्या सर्व एन्ट्री सुरक्षित राहतील.\n\nहे action undo करता येणार नाही!\n\nतुम्हाला खात्री आहे का?"
    );
    if (confirmed) {
      cashbookCleanupMutation.mutate(cashbookCleanupOptions);
    }
  };

  const categoryLabels: Record<string, string> = {
    'expense': 'खर्च',
    'income': 'जमा',
    'capital': 'भांडवल',
    'transfer': 'हस्तांतरण',
    'opening_balance': 'प्रारंभिक शिल्लक',
    'other': 'इतर'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-white">
      <MobileNav />
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>
        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
      <div className="p-3 sm:p-6 md:p-8 max-w-6xl md:max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl shadow-md">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">डेटा व्यवस्थापन</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">डेटा cleanup, backup आणि reconciliation</p>
            </div>
          </div>
        </div>

        <Card className="mb-5 border-2 border-indigo-100 dark:border-indigo-800 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">सिस्टम स्थिती</span>
              </div>
              <div className="flex items-center gap-2">
                {integrityData ? (
                  (integrityData as any)?.success ? (
                    <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs px-2 py-1">
                      <CheckCircle className="h-3 w-3 mr-1" /> ठीक
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs px-2 py-1">
                      <AlertTriangle className="h-3 w-3 mr-1" /> {(integrityData as any)?.summary?.issuesFound || 0} समस्या
                    </Badge>
                  )
                ) : null}
                <Button onClick={() => refetchIntegrity()} variant="outline" size="sm" disabled={integrityLoading} className="h-8 px-3 text-xs border-indigo-200">
                  <RefreshCw className={`h-3.5 w-3.5 ${integrityLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
            {integrityData && !(integrityData as any)?.success ? (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  <span className="text-sm font-semibold text-red-700">डेटा समस्या</span>
                </div>
                <div className="space-y-0.5">
                  {((integrityData as any)?.details || []).map((detail: any, index: number) => (
                    <div key={index} className="text-xs text-red-600">• {detail.issue}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Tabs defaultValue="cleanup" className="space-y-5">
          <TabsList className="flex w-full overflow-x-auto no-scrollbar gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border-2 border-indigo-200 dark:border-indigo-700">
            <TabsTrigger value="cleanup" className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">कर्ज क्लीनअप</span>
              <span className="sm:hidden">क्लीनअप</span>
            </TabsTrigger>
            <TabsTrigger value="cashbook" className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">कॅशबुक क्लीनअप</span>
              <span className="sm:hidden">कॅशबुक</span>
            </TabsTrigger>
            <TabsTrigger value="rearrange" className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <ArrowUpDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">खाते क्रमांक पुनर्क्रमांकन</span>
              <span className="sm:hidden">पुनर्क्रमांकन</span>
            </TabsTrigger>
            <TabsTrigger value="cashfix" className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <Scale className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">रोकड मेळ</span>
              <span className="sm:hidden">रोकड मेळ</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <HardDrive className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">बॅकअप व्यवस्थापन</span>
              <span className="sm:hidden">बॅकअप</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cleanup">
            <Card className="border-2 border-red-100 dark:border-red-800 rounded-xl shadow-sm">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-red-500 to-red-600 rounded-lg">
                    <Trash2 className="h-4 w-4 text-white" />
                  </div>
                  बंद झालेल्या कर्जांचा डेटा क्लीनअप
                </CardTitle>
                <CardDescription>
                  तारीख रेंज नुसार बंद झालेल्या कर्जांचा संपूर्ण डेटा क्लीन करा - कर्जदार, व्यवहार, कॅशबुक एंट्री सर्व काही
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-6">
                <div className="bg-red-50 dark:bg-red-900/20 p-3 sm:p-4 rounded-xl border-2 border-red-200">
                  <h4 className="font-semibold text-red-700 mb-3">📅 कर्ज बंद होण्याची तारीख रेंज</h4>
                  <p className="text-sm text-red-600 mb-4">
                    या तारखांदरम्यान बंद झालेल्या सर्व कर्जांचा संपूर्ण डेटा क्लीन होईल - कर्जदार, व्यवहार, कॅशबुक एंट्री, पेमेंट हिस्ट्री सर्व काही
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dateFrom">कर्ज बंद होण्याची सुरुवातीची तारीख</Label>
                      <Input
                        id="dateFrom"
                        type="date"
                        value={cleanupOptions.dateFrom}
                        onChange={(e) => { setCleanupOptions({...cleanupOptions, dateFrom: e.target.value}); setLoanCleanupPreview(null); }}
                        className="bg-white dark:bg-gray-800"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateTo">कर्ज बंद होण्याची शेवटची तारीख</Label>
                      <Input
                        id="dateTo"
                        type="date"
                        value={cleanupOptions.dateTo}
                        onChange={(e) => { setCleanupOptions({...cleanupOptions, dateTo: e.target.value}); setLoanCleanupPreview(null); }}
                        className="bg-white dark:bg-gray-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 sm:p-4 rounded-xl border-2 border-orange-200">
                  <h4 className="font-semibold text-orange-700 mb-3">🗑️ काय क्लीन होणार?</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-orange-600">
                    <li>या तारखांमध्ये बंद झालेल्या सर्व कर्जांचा संपूर्ण डेटा</li>
                    <li>त्या कर्जदारांच्या सर्व cash transactions आणि journal entries</li>
                    <li>कॅशबुक, रोकड वही मधील त्यांच्या सर्व एंट्री</li>
                    <li>लोन क्लोजर, इंटरेस्ट, पेमेंट हिस्ट्री सर्व काही</li>
                    <li>फक्त सक्रिय कर्जदार राहतील, बाकी सगळे पूर्ण क्लीन होतील</li>
                  </ul>
                  <div className="mt-3 p-2 bg-orange-100 rounded-lg text-xs text-orange-700">
                    <strong>लक्षात ठेवा:</strong> कॅश बॅलन्स त्यानुसार ऍडजेस्ट होईल
                  </div>
                </div>

                {/* Preview Button */}
                <div className="flex justify-start">
                  <Button
                    variant="outline"
                    onClick={() => loanCleanupPreviewMutation.mutate({ dateFrom: cleanupOptions.dateFrom || undefined, dateTo: cleanupOptions.dateTo || undefined })}
                    disabled={loanCleanupPreviewMutation.isPending}
                    className="flex items-center gap-2 border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  >
                    {loanCleanupPreviewMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    {loanCleanupPreviewMutation.isPending ? "तपासत आहे..." : "कॅशबुक प्रभाव पहा (Preview)"}
                  </Button>
                </div>

                {/* Preview Result Box */}
                {loanCleanupPreview && loanCleanupPreview.success && (
                  <div className="space-y-3">
                    {loanCleanupPreview.loanCount === 0 ? (
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-green-700 text-sm">
                        ✅ {loanCleanupPreview.message}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white border-2 border-red-200 rounded-xl p-3 text-center">
                            <div className="text-xs text-red-500 mb-1">बंद कर्जे</div>
                            <div className="text-2xl font-bold text-red-600">{loanCleanupPreview.loanCount}</div>
                          </div>
                          <div className="bg-white border-2 border-orange-200 rounded-xl p-3 text-center">
                            <div className="text-xs text-orange-500 mb-1">कर्ज वितरण (हटेल)</div>
                            <div className="text-lg font-bold text-orange-600">₹{loanCleanupPreview.totalDisbursed.toLocaleString('hi-IN')}</div>
                          </div>
                          <div className="bg-white border-2 border-blue-200 rounded-xl p-3 text-center">
                            <div className="text-xs text-blue-500 mb-1">कर्ज जमा (हटेल)</div>
                            <div className="text-lg font-bold text-blue-600">₹{loanCleanupPreview.totalRepaid.toLocaleString('hi-IN')}</div>
                          </div>
                        </div>

                        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 space-y-3">
                          <h4 className="font-bold text-yellow-800">📊 कॅशबुक बॅलन्स प्रभाव विश्लेषण</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-white rounded-lg p-2">
                              <div className="text-xs text-gray-500">Cash Out हटेल (कर्ज वितरण)</div>
                              <div className="font-semibold text-orange-600">₹{loanCleanupPreview.totalDisbursed.toLocaleString('hi-IN')}</div>
                            </div>
                            <div className="bg-white rounded-lg p-2">
                              <div className="text-xs text-gray-500">Cash In हटेल (कर्ज जमा)</div>
                              <div className="font-semibold text-blue-600">₹{loanCleanupPreview.totalRepaid.toLocaleString('hi-IN')}</div>
                            </div>
                          </div>
                          <div className={`rounded-lg p-3 border-2 ${loanCleanupPreview.netCashbookImpact < 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                            <div className="text-xs text-gray-600 mb-1">Cashbook Closing Balance वर परिणाम</div>
                            <div className={`text-xl font-bold ${loanCleanupPreview.netCashbookImpact < 0 ? 'text-red-700' : 'text-green-700'}`}>
                              {loanCleanupPreview.netCashbookImpact >= 0 ? '+' : ''}₹{loanCleanupPreview.netCashbookImpact.toLocaleString('hi-IN')}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {loanCleanupPreview.netCashbookImpact < 0
                                ? `Cashbook balance ₹${loanCleanupPreview.interestAmount.toLocaleString('hi-IN')} ने कमी होईल (व्याजाची रक्कम history मधून निघेल)`
                                : 'Cashbook balance वर विशेष फरक नाही'}
                            </div>
                          </div>
                          {loanCleanupPreview.netCashbookImpact < 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                              💡 <strong>Balance adjust करायचे असेल तर:</strong> Cashbook मध्ये एक <strong>Cash In (जमा)</strong> entry ₹{loanCleanupPreview.interestAmount.toLocaleString('hi-IN')} रकमेची "व्याज उत्पन्न" म्हणून करा
                            </div>
                          )}
                        </div>

                        {/* Per-loan table toggle */}
                        <button
                          onClick={() => setShowLoanPreviewTable(v => !v)}
                          className="text-xs text-indigo-600 underline flex items-center gap-1"
                        >
                          {showLoanPreviewTable ? '▲ कर्ज-निहाय तपशील लपवा' : `▼ कर्ज-निहाय तपशील पहा (${loanCleanupPreview.loanCount} कर्जे)`}
                        </button>

                        {showLoanPreviewTable && (
                          <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left text-gray-600">खाते क्र.</th>
                                  <th className="px-3 py-2 text-left text-gray-600">कर्जदार</th>
                                  <th className="px-3 py-2 text-right text-orange-600">वितरण (Out)</th>
                                  <th className="px-3 py-2 text-right text-blue-600">जमा (In)</th>
                                  <th className="px-3 py-2 text-right text-gray-600">Net</th>
                                </tr>
                              </thead>
                              <tbody>
                                {loanCleanupPreview.loans.map((l, i) => (
                                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-3 py-1.5 font-medium">{l.accountNumber}</td>
                                    <td className="px-3 py-1.5">{l.borrowerName}</td>
                                    <td className="px-3 py-1.5 text-right text-orange-600">₹{l.disbursed.toLocaleString('hi-IN')}</td>
                                    <td className="px-3 py-1.5 text-right text-blue-600">₹{l.repaid.toLocaleString('hi-IN')}</td>
                                    <td className={`px-3 py-1.5 text-right font-medium ${l.net < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {l.net >= 0 ? '+' : ''}₹{l.net.toLocaleString('hi-IN')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeTransactions"
                      checked={cleanupOptions.includeAssociatedTransactions}
                      onCheckedChange={(checked) => 
                        setCleanupOptions({...cleanupOptions, includeAssociatedTransactions: checked as boolean})
                      }
                    />
                    <Label htmlFor="includeTransactions" className="text-sm">
                      सर्व संबंधित cash transactions, journal entries आणि कॅशबुक एंट्री काढा
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="createBackup"
                      checked={cleanupOptions.createBackup}
                      onCheckedChange={(checked) => 
                        setCleanupOptions({...cleanupOptions, createBackup: checked as boolean})
                      }
                    />
                    <Label htmlFor="createBackup" className="text-sm">
                      cleanup करण्यापूर्वी backup तयार करा
                    </Label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4">
                  <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border-2 border-red-200">
                    ⚠️ <strong>सावधान:</strong> हे क्रिया अपरिवर्तनीय आहे! या तारखांमधील सर्व बंद कर्जांचा डेटा कायमचा काढला जाईल.
                  </div>
                  <Button 
                    onClick={handleCleanup} 
                    variant="destructive"
                    disabled={cleanupMutation.isPending}
                    className="flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                  >
                    {cleanupMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    डेटा क्लीनअप सुरू करा
                  </Button>
                </div>

                {cleanupMutation.data && (
                  <Alert className="mt-4 rounded-xl border-2">
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>क्लीनअप पूर्ण झाले</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2">
                        <p>{(cleanupMutation.data as DataManagementResult).message}</p>
                        <p className="text-sm mt-1">
                          प्रक्रिया केलेले records: {(cleanupMutation.data as DataManagementResult).summary?.recordsProcessed || 0}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {cleanupMutation.error && (
                  <Alert variant="destructive" className="mt-4 rounded-xl border-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>क्लीनअप अपयशी</AlertTitle>
                    <AlertDescription>
                      {cleanupMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cashbook">
            <Card className="border-2 border-orange-100 dark:border-orange-800 rounded-xl shadow-sm">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
                    <Trash2 className="h-4 w-4 text-white" />
                  </div>
                  कॅशबुक एन्ट्री क्लीनअप
                </CardTitle>
                <CardDescription>
                  तारीख रेंज नुसार जुन्या सामान्य कॅशबुक एन्ट्री क्लीन करा - कर्जाच्या सर्व एन्ट्री सुरक्षित राहतील
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-6">
                <div className="bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 rounded-xl border-2 border-green-200">
                  <h4 className="font-semibold text-green-700 mb-3">🛡️ कर्ज सुरक्षा (3-Layer Protection)</h4>
                  <p className="text-sm text-green-600 mb-2">खालील एन्ट्री <strong>कधीच delete होणार नाहीत</strong>:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-600">
                    <li>कर्ज वितरण (loan disbursement) एन्ट्री</li>
                    <li>कर्ज बंद / वसूली (loan repayment) एन्ट्री</li>
                    <li>व्याज जमा, मुद्दल संबंधित एन्ट्री</li>
                    <li>System-generated सर्व एन्ट्री</li>
                    <li>कर्जाशी संबंधित journal entries</li>
                  </ul>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 p-3 sm:p-4 rounded-xl border-2 border-red-200">
                  <h4 className="font-semibold text-red-700 mb-3">📅 तारीख रेंज निवडा</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cbDateFrom">सुरुवातीची तारीख</Label>
                      <Input
                        id="cbDateFrom"
                        type="date"
                        value={cashbookCleanupOptions.dateFrom}
                        onChange={(e) => {
                          setCashbookCleanupOptions({...cashbookCleanupOptions, dateFrom: e.target.value});
                          setCashbookPreview(null);
                        }}
                        className="bg-white dark:bg-gray-800"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cbDateTo">शेवटची तारीख</Label>
                      <Input
                        id="cbDateTo"
                        type="date"
                        value={cashbookCleanupOptions.dateTo}
                        onChange={(e) => {
                          setCashbookCleanupOptions({...cashbookCleanupOptions, dateTo: e.target.value});
                          setCashbookPreview(null);
                        }}
                        className="bg-white dark:bg-gray-800"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cleanCashTx"
                      checked={cashbookCleanupOptions.cleanCashTransactions}
                      onCheckedChange={(checked) =>
                        setCashbookCleanupOptions({...cashbookCleanupOptions, cleanCashTransactions: checked as boolean})
                      }
                    />
                    <Label htmlFor="cleanCashTx" className="text-sm">
                      सामान्य कॅश एन्ट्री (जमा/खर्च/भांडवल) हटवा
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cleanJournalTx"
                      checked={cashbookCleanupOptions.cleanJournalEntries}
                      onCheckedChange={(checked) =>
                        setCashbookCleanupOptions({...cashbookCleanupOptions, cleanJournalEntries: checked as boolean})
                      }
                    />
                    <Label htmlFor="cleanJournalTx" className="text-sm">
                      सामान्य journal entries (कर्जाच्या सोडून) हटवा
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cbBackup"
                      checked={cashbookCleanupOptions.createBackup}
                      onCheckedChange={(checked) =>
                        setCashbookCleanupOptions({...cashbookCleanupOptions, createBackup: checked as boolean})
                      }
                    />
                    <Label htmlFor="cbBackup" className="text-sm">
                      cleanup करण्यापूर्वी backup तयार करा
                    </Label>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleCashbookPreview}
                    variant="outline"
                    disabled={!cashbookCleanupOptions.dateFrom || !cashbookCleanupOptions.dateTo || cashbookPreviewMutation.isPending}
                    className="flex items-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm border-indigo-200"
                  >
                    {cashbookPreviewMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4" />
                    )}
                    {cashbookPreviewMutation.isPending ? "तपासत आहे..." : "प्रिव्ह्यू पहा"}
                  </Button>
                </div>

                {cashbookPreview && cashbookPreview.success && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 sm:p-4 rounded-xl border-2 border-red-200 text-center">
                        <div className="text-3xl font-bold text-red-600">{cashbookPreview.deletableCount}</div>
                        <div className="text-sm text-red-500 mt-1">सामान्य कॅश एन्ट्री हटवल्या जातील</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 rounded-xl border-2 border-green-200 text-center">
                        <div className="text-3xl font-bold text-green-600">{cashbookPreview.protectedCount}</div>
                        <div className="text-sm text-green-500 mt-1">कर्ज एन्ट्री सुरक्षित राहतील</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-orange-50 dark:bg-orange-900/20 p-3 sm:p-4 rounded-xl border-2 border-orange-200 text-center">
                        <div className="text-2xl font-bold text-orange-600">{cashbookPreview.deletableJournalCount}</div>
                        <div className="text-sm text-orange-500 mt-1">सामान्य journal entries हटवल्या जातील</div>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 sm:p-4 rounded-xl border-2 border-indigo-200 text-center">
                        <div className="text-2xl font-bold text-indigo-600">{cashbookPreview.protectedJournalCount}</div>
                        <div className="text-sm text-indigo-500 mt-1">कर्ज journal entries सुरक्षित</div>
                      </div>
                    </div>

                    {cashbookPreview.details.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">हटवल्या जाणाऱ्या एन्ट्रीचे प्रकार:</h4>
                        <div className="space-y-1">
                          {cashbookPreview.details.map((detail, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">{categoryLabels[detail.category] || detail.category}</span>
                              <span className="font-semibold">{detail.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cashbookPreview.balanceImpact && cashbookPreview.deletableCount > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 sm:p-4 rounded-xl border-2 border-yellow-300 space-y-3">
                        <h4 className="font-bold text-yellow-800 dark:text-yellow-300 text-lg">
                          बॅलन्स प्रभाव विश्लेषण (Balance Impact)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border-2 text-center">
                            <div className="text-lg font-bold text-green-600">
                              {cashbookPreview.balanceImpact.totalCashInDeleted.toLocaleString('hi-IN')}
                            </div>
                            <div className="text-xs text-gray-500">जमा (Cash In) हटणार</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border-2 text-center">
                            <div className="text-lg font-bold text-red-600">
                              {cashbookPreview.balanceImpact.totalCashOutDeleted.toLocaleString('hi-IN')}
                            </div>
                            <div className="text-xs text-gray-500">नावे (Cash Out) हटणार</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border-2 text-center">
                            <div className={`text-lg font-bold ${cashbookPreview.balanceImpact.netImpact >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {cashbookPreview.balanceImpact.netImpact >= 0 ? '+' : ''}{cashbookPreview.balanceImpact.netImpact.toLocaleString('hi-IN')}
                            </div>
                            <div className="text-xs text-gray-500">निव्वळ फरक (Net)</div>
                          </div>
                        </div>

                        {cashbookPreview.balanceImpact.adjustmentType !== 'none' && (
                          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-xl border-2 border-indigo-200">
                            <h5 className="font-semibold text-indigo-800 dark:text-indigo-300 mb-1">
                              क्लीनअप नंतर बॅलन्स ठीक करण्यासाठी:
                            </h5>
                            <p className="text-sm text-indigo-700 dark:text-indigo-400">
                              एक <strong>{cashbookPreview.balanceImpact.adjustmentType === 'cash_in' ? 'जमा (Cash In)' : 'नावे (Cash Out)'}</strong> एन्ट्री
                              {' '}<strong>₹{cashbookPreview.balanceImpact.adjustmentAmount.toLocaleString('hi-IN')}</strong> रकमेची
                              {' '}क्लीनअप तारखेच्या सुरुवातीला टाका.
                            </p>
                            <p className="text-xs text-indigo-600 dark:text-indigo-500 mt-1">
                              उदा. narration: "जुन्या entries adjustment" म्हणून टाका.
                            </p>
                          </div>
                        )}

                        {cashbookPreview.balanceImpact.partyWiseImpact.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                              पार्टी-निहाय प्रभाव पहा ({cashbookPreview.balanceImpact.partyWiseImpact.length} parties)
                            </summary>
                            <div className="mt-2 max-h-48 overflow-y-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr className="bg-gray-100 dark:bg-gray-700">
                                    <th className="text-left p-1.5 border">पार्टी नाव</th>
                                    <th className="text-right p-1.5 border">जमा</th>
                                    <th className="text-right p-1.5 border">नावे</th>
                                    <th className="text-right p-1.5 border">फरक</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cashbookPreview.balanceImpact.partyWiseImpact.map((party, i) => (
                                    <tr key={i} className="border-b">
                                      <td className="p-1.5 border">{party.partyName}</td>
                                      <td className="text-right p-1.5 border text-green-600">{party.cashIn.toLocaleString('hi-IN')}</td>
                                      <td className="text-right p-1.5 border text-red-600">{party.cashOut.toLocaleString('hi-IN')}</td>
                                      <td className={`text-right p-1.5 border font-semibold ${party.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {party.net >= 0 ? '+' : ''}{party.net.toLocaleString('hi-IN')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <p className="text-xs text-yellow-600 mt-1">
                              प्रत्येक party साठी स्वतंत्र adjusting DR/CR entry लागेल.
                            </p>
                          </details>
                        )}
                      </div>
                    )}

                    {(cashbookPreview.deletableCount > 0 || cashbookPreview.deletableJournalCount > 0) && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4">
                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border-2 border-red-200">
                          ⚠️ <strong>सावधान:</strong> कर्जाच्या एन्ट्री safe आहेत, पण सामान्य एन्ट्री कायमच्या हटवल्या जातील.
                        </div>
                        <Button
                          onClick={handleCashbookCleanup}
                          variant="destructive"
                          disabled={cashbookCleanupMutation.isPending}
                          className="flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                        >
                          {cashbookCleanupMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          {cashbookCleanupMutation.isPending ? "क्लीनअप करत आहे..." : "कॅशबुक क्लीनअप सुरू करा"}
                        </Button>
                      </div>
                    )}

                    {cashbookPreview.deletableCount === 0 && cashbookPreview.deletableJournalCount === 0 && (
                      <Alert className="border-2 border-green-200 rounded-xl">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-700">या तारखांमध्ये हटवण्यासारख्या सामान्य एन्ट्री नाहीत</AlertTitle>
                        <AlertDescription className="text-green-600">
                          सर्व एन्ट्री कर्जाशी संबंधित आहेत आणि सुरक्षित आहेत.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {cashbookCleanupMutation.data && (cashbookCleanupMutation.data as any).success && (
                  <div className="space-y-3">
                    <Alert className="border-2 border-green-200 rounded-xl">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-700">कॅशबुक क्लीनअप यशस्वी</AlertTitle>
                      <AlertDescription className="text-green-600">
                        <p>{(cashbookCleanupMutation.data as any).message}</p>
                        <p className="text-sm mt-1">
                          हटवलेले records: {(cashbookCleanupMutation.data as any).summary?.recordsDeleted || 0}
                        </p>
                        {(cashbookCleanupMutation.data as any).details?.map((detail: any, index: number) => (
                          <p key={index} className="text-xs mt-1">{detail.message}</p>
                        ))}
                      </AlertDescription>
                    </Alert>

                    {cashbookPreview?.balanceImpact && cashbookPreview.balanceImpact.adjustmentType !== 'none' && (
                      <Alert className="border-2 border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                        <AlertTriangle className="h-4 w-4 text-indigo-600" />
                        <AlertTitle className="text-indigo-700">बॅलन्स ठीक करण्यासाठी पुढील पाऊल:</AlertTitle>
                        <AlertDescription className="text-indigo-600 space-y-2">
                          <p className="font-semibold">
                            एक <strong>{cashbookPreview.balanceImpact.adjustmentType === 'cash_in' ? 'जमा (Cash In)' : 'नावे (Cash Out)'}</strong> एन्ट्री
                            {' '}₹<strong>{cashbookPreview.balanceImpact.adjustmentAmount.toLocaleString('hi-IN')}</strong> रकमेची
                            {' '}कॅश व्यवहार मध्ये टाका.
                          </p>
                          <p className="text-xs">
                            Narration: "जुन्या entries adjustment ({cashbookCleanupOptions.dateFrom} ते {cashbookCleanupOptions.dateTo})"
                          </p>
                          {cashbookPreview.balanceImpact.partyWiseImpact.length > 0 && (
                            <p className="text-xs">
                              पार्टी-निहाय बॅलन्स ठीक करण्यासाठी प्रत्येक party साठी स्वतंत्र adjusting entry टाकावी लागेल.
                            </p>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {cashbookCleanupMutation.error && (
                  <Alert variant="destructive" className="rounded-xl border-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>कॅशबुक क्लीनअप अयशस्वी</AlertTitle>
                    <AlertDescription>
                      {cashbookCleanupMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rearrange">
            <Card className="border-2 border-indigo-200 dark:border-indigo-800 rounded-xl shadow-sm">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
                    <ArrowUpDown className="h-4 w-4 text-white" />
                  </div>
                  🔢 खाते क्रमांक पुनर्क्रमांकन
                </CardTitle>
                <CardDescription>
                  ग्रुप निवडून कर्ज वितरण तारखेनुसार 1, 2, 3, 4... असे पुनर्क्रमांकन करा. फक्त खाते क्रमांक बदलेल.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-5">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 sm:p-4 rounded-xl border-2 border-indigo-200 text-sm text-indigo-600 dark:text-indigo-400">
                  <strong>नोट:</strong> System ID आणि Loan Number कधीच चेंज होणार नाही, फक्त हाताने टाकलेला account number चेंज होईल.
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                  <div>
                    <Label htmlFor="rearrangeGroup">ग्रुप निवडा</Label>
                    <select 
                      id="rearrangeGroup"
                      value={rearrangeGroupId}
                      onChange={(e) => {
                        setRearrangeGroupId(e.target.value);
                      }}
                      className="w-full mt-1 p-2 border rounded-md bg-white dark:bg-gray-800"
                      autoComplete="off"
                    >
                      <option value="">ग्रुप निवडा...</option>
                      {Array.isArray(groupsData) && groupsData.map((group: any) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="rearrangeDate">तारखेपर्यंत (ऐच्छिक)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="rearrangeDateText"
                        type="text"
                        placeholder="DD/MM/YYYY"
                        value={rearrangeUpToDate ? (() => {
                          const p = rearrangeUpToDate.split('-');
                          return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '';
                        })() : ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d/]/g, '');
                          const match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                          if (match) {
                            const [, dd, mm, yyyy] = match;
                            const d = parseInt(dd), m = parseInt(mm), y = parseInt(yyyy);
                            if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2099) {
                              setRearrangeUpToDate(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
                            }
                          } else if (val === '') {
                            setRearrangeUpToDate('');
                          }
                        }}
                        className="flex-1"
                      />
                      <div className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          className="px-3"
                          onClick={() => {
                            const el = document.getElementById('rearrangeDatePicker') as HTMLInputElement;
                            if (el) { try { el.showPicker(); } catch { el.click(); } }
                          }}
                        >
                          📅
                        </Button>
                        <input
                          id="rearrangeDatePicker"
                          type="date"
                          value={rearrangeUpToDate}
                          onChange={(e) => { setRearrangeUpToDate(e.target.value); }}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">रिकामे ठेवल्यास सर्व कर्जांचे पुनर्क्रमांकन होईल</p>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleRearrangePreview}
                      disabled={!rearrangeGroupId || rearrangePreviewMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800"
                    >
                      {rearrangePreviewMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4" />
                      )}
                      {rearrangePreviewMutation.isPending ? "तपासत आहे..." : "Preview बघा"}
                    </Button>
                  </div>
                </div>

                {rearrangePreviewData && rearrangePreviewData.success && (
                  <div className="space-y-4 mt-4">
                    {isPreviewStale && (
                      <Alert className="border-2 border-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-700">Preview जुनी झाली आहे</AlertTitle>
                        <AlertDescription className="text-amber-600">
                          ग्रुप किंवा तारीख बदलली आहे. कृपया पुन्हा "Preview बघा" क्लिक करा.
                        </AlertDescription>
                      </Alert>
                    )}

                    {!isPreviewStale && (
                      <>
                        <Alert className="border-2 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                          <CheckCircle className="h-4 w-4 text-indigo-600" />
                          <AlertTitle className="text-indigo-700">
                            {rearrangePreviewData.totalLoans} कर्ज सापडले
                          </AlertTitle>
                          <AlertDescription className="text-indigo-600">
                            खालील बटणांचा वापर करा: आधी PDF डाउनलोड करा, मग confirm करा.
                          </AlertDescription>
                        </Alert>

                        <div className="flex flex-col sm:flex-row gap-3">
                          {isMobileDevice() ? (
                            <Button
                              onClick={generateMobileRearrangePdf}
                              className="flex-1 flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                            >
                              <Download className="h-4 w-4" />
                              PDF डाउनलोड करा (जुना → नवीन नंबर)
                            </Button>
                          ) : (
                            <Button
                              onClick={generateRearrangePdf}
                              className="flex-1 flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                            >
                              <Download className="h-4 w-4" />
                              PDF डाउनलोड करा (जुना → नवीन नंबर)
                            </Button>
                          )}

                          <Button
                            onClick={handleRearrangeConfirm}
                            disabled={!rearrangePdfDownloaded || rearrangeConfirmMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white disabled:opacity-50"
                          >
                            {rearrangeConfirmMutation.isPending ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            {rearrangeConfirmMutation.isPending ? "पुनर्क्रमांकन करत आहे..." : "खाते क्रमांक बदला"}
                          </Button>
                        </div>

                        {!rearrangePdfDownloaded && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠️ कृपया आधी PDF डाउनलोड करा, मगच "खाते क्रमांक बदला" बटण active होईल.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {rearrangePreviewData && !rearrangePreviewData.success && (
                  <Alert className="border-2 border-red-200 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="text-red-700">अयशस्वी</AlertTitle>
                    <AlertDescription className="text-red-600">
                      {rearrangePreviewData.message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cashfix">
            <CashReconciliationTab queryClient={queryClient} />
          </TabsContent>

          <TabsContent value="backup">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-indigo-200 dark:border-indigo-800 rounded-xl shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                    <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
                      <Database className="h-4 w-4 text-white" />
                    </div>
                    डेटा बॅकअप
                  </CardTitle>
                  <CardDescription className="text-indigo-600 dark:text-indigo-400">
                    संपूर्ण सिस्टम डेटाचा complete backup तयार करा
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 sm:p-4 rounded-xl border-2 border-indigo-200">
                    <h4 className="font-semibold text-indigo-700 mb-3">✅ हे backup मध्ये समाविष्ट असेल:</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-indigo-600">
                      <li>सर्व loans आणि borrower data</li>
                      <li>सर्व cash transactions आणि journal entries</li>
                      <li>Groups, parties आणि company information</li>
                      <li>User permissions आणि activity logs</li>
                      <li><strong>🚨 लोन फोटो metadata (loanPhotos table)</strong></li>
                      <li>Complete database state with relationships</li>
                    </ul>
                    <div className="mt-3 p-2 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-xs text-yellow-700">
                      <strong>📸 Photo Files:</strong> Database metadata backup होईल, पण physical photo files अजूनही manual backup आवश्यक आहे
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 space-y-2">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-2">बॅकअप प्रकार निवडा:</h4>
                    <label 
                      className={`flex items-start gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${!backupPortable ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                      onClick={() => setBackupPortable(false)}
                    >
                      <input 
                        type="radio" 
                        name="backupType" 
                        checked={!backupPortable} 
                        onChange={() => setBackupPortable(false)}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <div>
                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">📌 या टेनंट साठी बॅकअप</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">फक्त याच टेनंट ला रिस्टोर करता येईल (users, permissions सहित)</div>
                      </div>
                    </label>
                    <label 
                      className={`flex items-start gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${backupPortable ? 'border-green-400 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                      onClick={() => setBackupPortable(true)}
                    >
                      <input 
                        type="radio" 
                        name="backupType" 
                        checked={backupPortable} 
                        onChange={() => setBackupPortable(true)}
                        className="mt-0.5 accent-green-600"
                      />
                      <div>
                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">🌐 सार्वत्रिक बॅकअप</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">कोणत्याही टेनंट ला रिस्टोर करता येईल (users exclude होतील)</div>
                      </div>
                    </label>
                  </div>
                  
                  <Button 
                    onClick={handleBackup}
                    disabled={backupMutation.isPending}
                    className={`w-full flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm text-white ${backupPortable ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800' : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800'}`}
                    size="lg"
                  >
                    {backupMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4" />
                    )}
                    {backupMutation.isPending ? "बॅकअप तयार करत आहे..." : (backupPortable ? "🌐 सार्वत्रिक बॅकअप तयार करा" : "📌 संपूर्ण बॅकअप तयार करा")}
                  </Button>

                  {backupMutation.data && (backupMutation.data as any).success && (
                    <Alert className="border-2 border-indigo-200 rounded-xl">
                      <CheckCircle className="h-4 w-4 text-indigo-600" />
                      <AlertTitle className="text-indigo-700">बॅकअप यशस्वी ✅</AlertTitle>
                      <AlertDescription className="text-indigo-600">
                        <p>{(backupMutation.data as any).message}</p>
                        {(() => {
                          const ts = (backupMutation.data as any).summary?.timestamp;
                          if (!ts) return null;
                          const d = new Date(ts);
                          const formatted = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
                          return (
                            <p className="text-sm mt-1 font-semibold">
                              बॅकअप तारीख व वेळ: {formatted}
                            </p>
                          );
                        })()}
                        <p className="text-xs mt-1">
                          Backup ID: {(backupMutation.data as any).backupId}
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {backupMutation.error && (
                    <Alert variant="destructive" className="rounded-xl border-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>बॅकअप अपयशी</AlertTitle>
                      <AlertDescription>
                        {backupMutation.error.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-orange-200 dark:border-orange-800 rounded-xl shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <div className="p-1.5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
                      <RefreshCw className="h-4 w-4 text-white" />
                    </div>
                    डेटा रिस्टोर
                  </CardTitle>
                  <CardDescription className="text-orange-600 dark:text-orange-400">
                    backup फाइल किंवा system reset द्वारे डेटा पुनर्स्थापित करा
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 sm:p-4 rounded-xl border-2 border-red-200">
                    <h4 className="font-semibold text-red-700 mb-3">🔄 संपूर्ण डेटा क्लीन (सिस्टम रिसेट)</h4>
                    <p className="text-sm text-red-600 mb-3">
                      सर्व loans, borrowers, cash transactions, journal entries, groups, parties, companies, photo records - सगळा डेटा permanently delete होईल!
                    </p>
                    <Button 
                      onClick={handleRestore}
                      disabled={restoreMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                      size="lg"
                    >
                      {restoreMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {restoreMutation.isPending ? "सिस्टम रिसेट करत आहे..." : "संपूर्ण डेटा क्लीन करा"}
                    </Button>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 rounded-xl border-2 border-green-200">
                    <h4 className="font-semibold text-green-700 mb-3">📁 बॅकअप फाइल रिस्टोर</h4>
                    <p className="text-sm text-green-600 mb-3">
                      पूर्वी तयार केलेल्या backup JSON फाइल वरून डेटा restore करा
                    </p>
                    <Button 
                      onClick={handleRestoreFromBackup}
                      disabled={restoreFromBackupMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm"
                      variant="outline"
                      size="lg"
                    >
                      {restoreFromBackupMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {restoreFromBackupMutation.isPending ? "बॅकअप रिस्टोर करत आहे..." : "बॅकअप फाइल निवडा"}
                    </Button>
                  </div>

                  {restoreMutation.data && (
                    <Alert className="border-2 border-green-200 rounded-xl">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-700">सिस्टम रिसेट यशस्वी ✅</AlertTitle>
                      <AlertDescription className="text-green-600">
                        <p>{(restoreMutation.data as any).message}</p>
                        <p className="text-sm mt-1 font-semibold">
                          Records affected: {(restoreMutation.data as any).summary?.recordsRestored || 0}
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {restoreMutation.error && (
                    <Alert variant="destructive" className="rounded-xl border-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>सिस्टम रिसेट अपयशी</AlertTitle>
                      <AlertDescription>
                        {restoreMutation.error.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {restoreFromBackupMutation.data && (
                    <Alert className="border-2 border-indigo-200 rounded-xl">
                      <CheckCircle className="h-4 w-4 text-indigo-600" />
                      <AlertTitle className="text-indigo-700">बॅकअप रिस्टोर यशस्वी ✅</AlertTitle>
                      <AlertDescription className="text-indigo-600">
                        <p>{(restoreFromBackupMutation.data as any).message}</p>
                        <p className="text-sm mt-1 font-semibold">
                          Records restored: {(restoreFromBackupMutation.data as any).summary?.recordsRestored || 0}
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {restoreFromBackupMutation.error && (
                    <Alert variant="destructive" className="rounded-xl border-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>बॅकअप रिस्टोर अपयशी</AlertTitle>
                      <AlertDescription>
                        {restoreFromBackupMutation.error.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="text-sm text-orange-600 p-3 bg-orange-50 rounded-xl border-2 border-orange-200">
                    ⚠️ <strong>सावधान:</strong> Restore operation सर्व current data replace करेल. पहिले backup घ्या!
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
        </main>
      </div>
    </div>
  );
}

export default DataManagementPage;