import { useState, useEffect, useCallback } from "react";
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
import { AlertTriangle, ArrowUpDown, CheckCircle, Database, Download, HardDrive, RefreshCw, Shield, Trash2, Upload } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
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

function DataManagementPage() {
  const queryClient = useQueryClient();
  
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
    mutationFn: async () => {
      const response = await apiRequest("/api/data-management/create-backup", "POST");
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
        a.href = url;
        a.download = `backup_${data.backupData.tenantId}_${dateStr}_${timeStr}.json`;
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
    backupMutation.mutate();
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

  const generateRearrangePdf = () => {
    if (!rearrangePreviewData?.mapping?.length) return;

    const mapping = rearrangePreviewData.mapping;
    const groupName = Array.isArray(groupsData) ? groupsData.find((g: any) => g.id.toString() === rearrangeGroupId)?.name || '' : '';

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    initDevanagariFont(doc);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const tableWidth = (pageWidth - margin * 3) / 2;
    const rowHeight = 7;
    const headerHeight = 9;
    const colWidths = [12, 28, 25, 25];
    const headers = ['अ.क्र.', 'तारीख', 'जुना क्र.', 'नवीन क्र.'];

    const topY = 25;
    const usableHeight = pageHeight - topY - margin;
    const rowsPerColumn = Math.floor((usableHeight - headerHeight) / rowHeight);
    const totalRows = mapping.length;
    const totalPages = Math.ceil(totalRows / (rowsPerColumn * 2));

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage('a4', 'landscape');

      doc.setFont('NotoDevanagari');
      doc.setFontSize(13);
      doc.text(`खाते क्रमांक पुनर्व्यवस्थापन - ${groupName}`, pageWidth / 2, 10, { align: 'center' });
      doc.setFontSize(9);
      const dateInfo = rearrangeUpToDate ? `${formatDateDDMMYYYY(rearrangeUpToDate)} पर्यंत` : 'सर्व कर्ज';
      doc.text(`एकूण: ${totalRows} | ${dateInfo}`, pageWidth / 2, 16, { align: 'center' });

      for (let col = 0; col < 2; col++) {
        const startIdx = page * rowsPerColumn * 2 + col * rowsPerColumn;
        if (startIdx >= totalRows) continue;

        const xStart = margin + col * (tableWidth + margin);
        let y = topY;

        doc.setFillColor(79, 70, 229);
        doc.rect(xStart, y, tableWidth, headerHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('NotoDevanagari');

        let cx = xStart + 2;
        for (let h = 0; h < headers.length; h++) {
          doc.text(headers[h], cx, y + 6);
          cx += colWidths[h];
        }

        y += headerHeight;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);

        const endIdx = Math.min(startIdx + rowsPerColumn, totalRows);
        for (let r = startIdx; r < endIdx; r++) {
          const item = mapping[r];
          if ((r - startIdx) % 2 === 0) {
            doc.setFillColor(245, 245, 250);
            doc.rect(xStart, y, tableWidth, rowHeight, 'F');
          }

          doc.setDrawColor(200, 200, 210);
          doc.rect(xStart, y, tableWidth, rowHeight, 'S');

          cx = xStart + 2;
          doc.setFont('NotoDevanagari');
          doc.text(String(r + 1), cx, y + 5);
          cx += colWidths[0];
          doc.text(formatDateDDMMYYYY(item.loanDate), cx, y + 5);
          cx += colWidths[1];
          doc.text(String(item.oldAccountNumber), cx, y + 5);
          cx += colWidths[2];
          doc.setFont('NotoDevanagari');
          doc.setTextColor(79, 70, 229);
          doc.text(String(item.newAccountNumber), cx, y + 5);
          doc.setTextColor(0, 0, 0);

          y += rowHeight;
        }
      }
    }

    doc.save(`खाते_रिअरेंज_${groupName}.pdf`);
    setRearrangePdfDownloaded(true);
  };

  const handleRearrangeConfirm = () => {
    if (isPreviewStale || !rearrangePreviewParams) {
      alert("Preview जुनी झाली आहे. कृपया पुन्हा Preview बघा.");
      return;
    }
    const confirmed = window.confirm(
      "⚠️ PDF डाउनलोड झाली आहे.\n\nआता खाते क्रमांक बदलायचे का?\nहे action undo करता येणार नाही!"
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
    <>
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      <div className="container mx-auto p-4 max-w-6xl">
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
              <span className="hidden sm:inline">खाते नंबर रिअरेंज</span>
              <span className="sm:hidden">रिअरेंज</span>
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
                        onChange={(e) => setCleanupOptions({...cleanupOptions, dateFrom: e.target.value})}
                        className="bg-white dark:bg-gray-800"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateTo">कर्ज बंद होण्याची शेवटची तारीख</Label>
                      <Input
                        id="dateTo"
                        type="date"
                        value={cleanupOptions.dateTo}
                        onChange={(e) => setCleanupOptions({...cleanupOptions, dateTo: e.target.value})}
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
                  🔢 खाते क्रमांक पुनर्व्यवस्थापन
                </CardTitle>
                <CardDescription>
                  ग्रुप निवडून कर्ज वितरण तारखेनुसार 1, 2, 3, 4... असे रिअरेंज करा. फक्त manual account number चेंज होईल.
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
                    <p className="text-xs text-gray-500 mt-1">रिकामे ठेवल्यास सर्व कर्ज रिअरेंज होतील</p>
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
                          <Button
                            onClick={generateRearrangePdf}
                            className="flex-1 flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                          >
                            <Download className="h-4 w-4" />
                            PDF डाउनलोड करा (जुना → नवीन नंबर)
                          </Button>

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
                            {rearrangeConfirmMutation.isPending ? "रिअरेंज करत आहे..." : "खाते क्रमांक बदला"}
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
                  
                  <Button 
                    onClick={handleBackup}
                    disabled={backupMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold rounded-lg shadow-sm bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white"
                    size="lg"
                  >
                    {backupMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4" />
                    )}
                    {backupMutation.isPending ? "बॅकअप तयार करत आहे..." : "संपूर्ण बॅकअप तयार करा"}
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
    </>
  );
}

export default DataManagementPage;