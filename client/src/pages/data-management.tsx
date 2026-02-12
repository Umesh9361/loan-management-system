import { useState } from "react";
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
import { AlertTriangle, ArrowUpDown, CheckCircle, Database, HardDrive, RefreshCw, Shield, Trash2, Upload } from "lucide-react";

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

  const [rearrangeGroupId, setRearrangeGroupId] = useState("");

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

  // Account number rearrangement mutation
  const rearrangeAccountsMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const response = await apiRequest("/api/data-management/rearrange-account-numbers", "POST", { groupId });
      return await response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"], refetchType: 'all' });
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

  const handleRearrangeAccountNumbers = () => {
    if (!rearrangeGroupId) return;
    const confirmed = window.confirm(
      "⚠️ सावधान!\n\nया ग्रुपमधील सर्व कर्जांचे खाते क्रमांक तारखेनुसार बदलले जातील.\n\nतुम्हाला खात्री आहे का?"
    );
    if (confirmed) {
      rearrangeAccountsMutation.mutate(rearrangeGroupId);
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
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">डेटा व्यवस्थापन</h1>
        <p className="text-gray-600 dark:text-gray-300">
          संपूर्ण सिस्टम डेटा cleanup, backup आणि accounting reconciliation
        </p>
      </div>

      {/* System Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            सिस्टम स्थिती तपासा
          </CardTitle>
          <CardDescription>
            डेटा integrity verification आणि system health check
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Button 
              onClick={() => refetchIntegrity()} 
              variant="outline" 
              disabled={integrityLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${integrityLoading ? "animate-spin" : ""}`} />
              स्थिती तपासा
            </Button>
            
            {integrityData ? (
              <div className="flex items-center gap-2">
                {(integrityData as any)?.success ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    सर्व ठीक आहे
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {(integrityData as any)?.summary?.issuesFound || 0} समस्या आढळल्या
                  </Badge>
                )}
              </div>
            ) : null}
          </div>
          
          {integrityData && !(integrityData as any)?.success ? (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>डेटा समस्या आढळल्या</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1">
                  {((integrityData as any)?.details || []).map((detail: any, index: number) => (
                    <div key={index} className="text-sm">• {detail.issue}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="cleanup" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cleanup">कर्ज क्लीनअप</TabsTrigger>
          <TabsTrigger value="cashbook">कॅशबुक क्लीनअप</TabsTrigger>
          <TabsTrigger value="rearrange">खाते नंबर रिअरेंज</TabsTrigger>
          <TabsTrigger value="backup">बॅकअप व्यवस्थापन</TabsTrigger>
        </TabsList>

        {/* Data Cleanup Tab */}
        <TabsContent value="cleanup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                बंद झालेल्या कर्जांचा डेटा क्लीनअप
              </CardTitle>
              <CardDescription>
                तारीख रेंज नुसार बंद झालेल्या कर्जांचा संपूर्ण डेटा क्लीन करा - कर्जदार, व्यवहार, कॅशबुक एंट्री सर्व काही
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date Range Selection for Closed Loans */}
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200">
                <h4 className="font-semibold text-red-700 mb-3">📅 कर्ज बंद होण्याची तारीख रेंज</h4>
                <p className="text-sm text-red-600 mb-4">
                  या तारखांदरम्यान बंद झालेल्या सर्व कर्जांचा संपूर्ण डेटा क्लीन होईल - कर्जदार, व्यवहार, कॅशबुक एंट्री, पेमेंट हिस्ट्री सर्व काही
                </p>
                <div className="grid grid-cols-2 gap-4">
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

              {/* What will be cleaned explanation */}
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200">
                <h4 className="font-semibold text-orange-700 mb-3">🗑️ काय क्लीन होणार?</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-orange-600">
                  <li>या तारखांमध्ये बंद झालेल्या सर्व कर्जांचा संपूर्ण डेटा</li>
                  <li>त्या कर्जदारांच्या सर्व cash transactions आणि journal entries</li>
                  <li>कॅशबुक, रोकड वही मधील त्यांच्या सर्व एंट्री</li>
                  <li>लोन क्लोजर, इंटरेस्ट, पेमेंट हिस्ट्री सर्व काही</li>
                  <li>फक्त सक्रिय कर्जदार राहतील, बाकी सगळे पूर्ण क्लीन होतील</li>
                </ul>
                <div className="mt-3 p-2 bg-orange-100 rounded text-xs text-orange-700">
                  <strong>लक्षात ठेवा:</strong> कॅश बॅलन्स त्यानुसार ऍडजेस्ट होईल
                </div>
              </div>

              <Separator />

              {/* Options */}
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

              {/* Action Button */}
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded">
                  ⚠️ <strong>सावधान:</strong> हे क्रिया अपरिवर्तनीय आहे! या तारखांमधील सर्व बंद कर्जांचा डेटा कायमचा काढला जाईल.
                </div>
                <Button 
                  onClick={handleCleanup} 
                  variant="destructive"
                  disabled={cleanupMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {cleanupMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  डेटा क्लीनअप सुरू करा
                </Button>
              </div>

              {/* Cleanup Results */}
              {cleanupMutation.data && (
                <Alert className="mt-4">
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
                <Alert variant="destructive" className="mt-4">
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

        {/* Cashbook Cleanup Tab */}
        <TabsContent value="cashbook">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                कॅशबुक एन्ट्री क्लीनअप
              </CardTitle>
              <CardDescription>
                तारीख रेंज नुसार जुन्या सामान्य कॅशबुक एन्ट्री क्लीन करा - कर्जाच्या सर्व एन्ट्री सुरक्षित राहतील
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200">
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

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200">
                <h4 className="font-semibold text-red-700 mb-3">📅 तारीख रेंज निवडा</h4>
                <div className="grid grid-cols-2 gap-4">
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
                  className="flex items-center gap-2"
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 text-center">
                      <div className="text-3xl font-bold text-red-600">{cashbookPreview.deletableCount}</div>
                      <div className="text-sm text-red-500 mt-1">सामान्य कॅश एन्ट्री हटवल्या जातील</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 text-center">
                      <div className="text-3xl font-bold text-green-600">{cashbookPreview.protectedCount}</div>
                      <div className="text-sm text-green-500 mt-1">कर्ज एन्ट्री सुरक्षित राहतील</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 text-center">
                      <div className="text-2xl font-bold text-orange-600">{cashbookPreview.deletableJournalCount}</div>
                      <div className="text-sm text-orange-500 mt-1">सामान्य journal entries हटवल्या जातील</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 text-center">
                      <div className="text-2xl font-bold text-blue-600">{cashbookPreview.protectedJournalCount}</div>
                      <div className="text-sm text-blue-500 mt-1">कर्ज journal entries सुरक्षित</div>
                    </div>
                  </div>

                  {cashbookPreview.details.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
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
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-300 space-y-3">
                      <h4 className="font-bold text-yellow-800 dark:text-yellow-300 text-lg">
                        बॅलन्स प्रभाव विश्लेषण (Balance Impact)
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded border text-center">
                          <div className="text-lg font-bold text-green-600">
                            {cashbookPreview.balanceImpact.totalCashInDeleted.toLocaleString('hi-IN')}
                          </div>
                          <div className="text-xs text-gray-500">जमा (Cash In) हटणार</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded border text-center">
                          <div className="text-lg font-bold text-red-600">
                            {cashbookPreview.balanceImpact.totalCashOutDeleted.toLocaleString('hi-IN')}
                          </div>
                          <div className="text-xs text-gray-500">नावे (Cash Out) हटणार</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded border text-center">
                          <div className={`text-lg font-bold ${cashbookPreview.balanceImpact.netImpact >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {cashbookPreview.balanceImpact.netImpact >= 0 ? '+' : ''}{cashbookPreview.balanceImpact.netImpact.toLocaleString('hi-IN')}
                          </div>
                          <div className="text-xs text-gray-500">निव्वळ फरक (Net)</div>
                        </div>
                      </div>

                      {cashbookPreview.balanceImpact.adjustmentType !== 'none' && (
                        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded border border-blue-200">
                          <h5 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
                            क्लीनअप नंतर बॅलन्स ठीक करण्यासाठी:
                          </h5>
                          <p className="text-sm text-blue-700 dark:text-blue-400">
                            एक <strong>{cashbookPreview.balanceImpact.adjustmentType === 'cash_in' ? 'जमा (Cash In)' : 'नावे (Cash Out)'}</strong> एन्ट्री
                            {' '}<strong>₹{cashbookPreview.balanceImpact.adjustmentAmount.toLocaleString('hi-IN')}</strong> रकमेची
                            {' '}क्लीनअप तारखेच्या सुरुवातीला टाका.
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
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
                    <div className="flex items-center justify-between pt-4">
                      <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded">
                        ⚠️ <strong>सावधान:</strong> कर्जाच्या एन्ट्री safe आहेत, पण सामान्य एन्ट्री कायमच्या हटवल्या जातील.
                      </div>
                      <Button
                        onClick={handleCashbookCleanup}
                        variant="destructive"
                        disabled={cashbookCleanupMutation.isPending}
                        className="flex items-center gap-2"
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
                    <Alert className="border-green-200">
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
                  <Alert className="border-green-200">
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
                    <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-900/20">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-700">बॅलन्स ठीक करण्यासाठी पुढील पाऊल:</AlertTitle>
                      <AlertDescription className="text-blue-600 space-y-2">
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
                <Alert variant="destructive">
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

        {/* Account Number Rearrange Tab */}
        <TabsContent value="rearrange">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5 text-blue-600" />
                🔢 खाते क्रमांक पुनर्व्यवस्थापन
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                <strong>फक्त manual account number चेंज होईल</strong> - ग्रुप निवडून कर्ज वितरण तारखेनुसार 1, 2, 3, 4... असे रिअरेंज करा.<br/>
                <span className="text-xs text-blue-500">नोट: System ID आणि Loan Number कधीच चेंज होणार नाही, फक्त हाताने टाकलेला account number चेंज होईल</span>
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="rearrangeGroup">ग्रुप निवडा</Label>
                  <select 
                    id="rearrangeGroup"
                    value={rearrangeGroupId}
                    onChange={(e) => setRearrangeGroupId(e.target.value)}
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
                <Button 
                  onClick={handleRearrangeAccountNumbers}
                  disabled={!rearrangeGroupId || rearrangeAccountsMutation.isPending}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  {rearrangeAccountsMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4" />
                  )}
                  {rearrangeAccountsMutation.isPending ? "रिअरेंज करत आहे..." : "खाते क्रमांक रिअरेंज करा"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Management Tab */}
        <TabsContent value="backup">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Backup Section */}
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <Database className="h-5 w-5" />
                  डेटा बॅकअप
                </CardTitle>
                <CardDescription className="text-blue-600 dark:text-blue-400">
                  संपूर्ण सिस्टम डेटाचा complete backup तयार करा
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-700 mb-3">✅ हे backup मध्ये समाविष्ट असेल:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-blue-600">
                    <li>सर्व loans आणि borrower data</li>
                    <li>सर्व cash transactions आणि journal entries</li>
                    <li>Groups, parties आणि company information</li>
                    <li>User permissions आणि activity logs</li>
                    <li><strong>🚨 लोन फोटो metadata (loanPhotos table)</strong></li>
                    <li>Complete database state with relationships</li>
                  </ul>
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                    <strong>📸 Photo Files:</strong> Database metadata backup होईल, पण physical photo files अजूनही manual backup आवश्यक आहे
                  </div>
                </div>
                
                <Button 
                  onClick={handleBackup}
                  disabled={backupMutation.isPending}
                  className="w-full flex items-center gap-2"
                  variant="default"
                  size="lg"
                >
                  {backupMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {backupMutation.isPending ? "बॅकअप तयार करत आहे..." : "संपूर्ण बॅकअप तयार करा"}
                </Button>

                {/* Backup Results */}
                {backupMutation.data && (backupMutation.data as any).success && (
                  <Alert className="border-blue-200">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-700">बॅकअप यशस्वी ✅</AlertTitle>
                    <AlertDescription className="text-blue-600">
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
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>बॅकअप अपयशी</AlertTitle>
                    <AlertDescription>
                      {backupMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Data Restore Section */}
            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <RefreshCw className="h-5 w-5" />
                  डेटा रिस्टोर
                </CardTitle>
                <CardDescription className="text-orange-600 dark:text-orange-400">
                  backup फाइल किंवा system reset द्वारे डेटा पुनर्स्थापित करा
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* System Reset Option */}
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200">
                  <h4 className="font-semibold text-red-700 mb-3">🔄 संपूर्ण डेटा क्लीन (सिस्टम रिसेट)</h4>
                  <p className="text-sm text-red-600 mb-3">
                    सर्व loans, borrowers, cash transactions, journal entries, groups, parties, companies, photo records - सगळा डेटा permanently delete होईल!
                  </p>
                  <Button 
                    onClick={handleRestore}
                    disabled={restoreMutation.isPending}
                    className="w-full flex items-center gap-2"
                    variant="destructive"
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

                {/* Backup File Restore Option */}
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-700 mb-3">📁 बॅकअप फाइल रिस्टोर</h4>
                  <p className="text-sm text-green-600 mb-3">
                    पूर्वी तयार केलेल्या backup JSON फाइल वरून डेटा restore करा
                  </p>
                  <Button 
                    onClick={handleRestoreFromBackup}
                    disabled={restoreFromBackupMutation.isPending}
                    className="w-full flex items-center gap-2"
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

                {/* System Restore Results */}
                {restoreMutation.data && (
                  <Alert className="border-green-200">
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
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>सिस्टम रिसेट अपयशी</AlertTitle>
                    <AlertDescription>
                      {restoreMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Backup Restore Results */}
                {restoreFromBackupMutation.data && (
                  <Alert className="border-blue-200">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-700">बॅकअप रिस्टोर यशस्वी ✅</AlertTitle>
                    <AlertDescription className="text-blue-600">
                      <p>{(restoreFromBackupMutation.data as any).message}</p>
                      <p className="text-sm mt-1 font-semibold">
                        Records restored: {(restoreFromBackupMutation.data as any).summary?.recordsRestored || 0}
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {restoreFromBackupMutation.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>बॅकअप रिस्टोर अपयशी</AlertTitle>
                    <AlertDescription>
                      {restoreFromBackupMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-sm text-orange-600 p-3 bg-orange-50 rounded-lg">
                  ⚠️ <strong>सावधान:</strong> Restore operation सर्व current data replace करेल. पहिले backup घ्या!
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DataManagementPage;