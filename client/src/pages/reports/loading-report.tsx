import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, TrendingUp, AlertTriangle, Printer, FileSpreadsheet, Users, User, BarChart3, Loader2, Home, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import * as XLSX from 'xlsx';
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";

interface LoadingItem {
  loanId: string;
  accountNumber: string;
  borrowerName: string;
  borrowerMobile: string;
  groupName: string;
  loanDate: string;
  collateralDetails: string;
  metalType: string;
  weight: number;
  fineWeight: number;
  marketValue: number;
  standard80Loan: number;
  principalAmount: number;
  interestRate: number;
  interestRateType: string;
  interestToDate: number;
  totalWithInterest: number;
  ltvPercent: number;
  loadingAmount: number;
  loadingPercent: number;
  avgLTV: number;
  deviationFrom80: number;
  deviationFromAvg: number;
  above80: boolean;
  aboveAvg: boolean;
  category: string;
  categoryLabel: string;
  order: number;
}

interface LoadingSummary {
  totalLoans: number;
  avgLTV: number;
  overloadedCount: number;
  suspectCount: number;
  highCount: number;
  mediumCount: number;
  slightCount: number;
  totalOverloadAmount: number;
  goldRateUsed: number;
  goldRateSource: string;
  totalFlagged: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

interface LoadingReportData {
  items: LoadingItem[];
  summary: LoadingSummary;
}

function getCategoryStyle(category: string): { color: string; bgColor: string; borderColor: string } {
  switch (category) {
    case 'suspect':
      return { color: 'text-purple-700', bgColor: 'bg-purple-100', borderColor: 'border-purple-300' };
    case 'high':
      return { color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' };
    case 'medium':
      return { color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-300' };
    case 'slight':
    default:
      return { color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-300' };
  }
}

export default function LoadingReport() {
  const [, setLocation] = useLocation();
  const reportSectionRef = useRef<HTMLDivElement>(null);

  const handleBackNavigation = () => {
    try {
      if (window.history.length > 1 && document.referrer) {
        window.history.back();
      } else {
        setLocation("/dashboard");
      }
    } catch {
      setLocation("/dashboard");
    }
  };

  const [activeTab, setActiveTab] = useState<"group" | "customer">("group");
  const [groupId, setGroupId] = useState("all");
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [goldRateInput, setGoldRateInput] = useState("");
  const [goldRateManuallyEdited, setGoldRateManuallyEdited] = useState(false);
  const [silverRateInput, setSilverRateInput] = useState("");
  const [silverRateManuallyEdited, setSilverRateManuallyEdited] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [shouldScrollToReport, setShouldScrollToReport] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const dataTableRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const customerSuggestionsRef = useRef<HTMLDivElement>(null);

  const { data: groups = [] } = useQuery({ queryKey: ['/api/groups'] });

  const { data: goldRateData } = useQuery<any>({
    queryKey: ['/api/gold-rate'],
    queryFn: async () => {
      const res = await fetch('/api/gold-rate', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 4 * 60 * 60 * 1000,
  });

  const { data: silverRateData } = useQuery<any>({
    queryKey: ['/api/silver-rate'],
    queryFn: async () => {
      const res = await fetch('/api/silver-rate', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 4 * 60 * 60 * 1000,
  });

  useEffect(() => {
    if (goldRateData?.perGram && !goldRateManuallyEdited) {
      setGoldRateInput(String(goldRateData.perGram));
    }
  }, [goldRateData, goldRateManuallyEdited]);

  useEffect(() => {
    if (silverRateData?.perGram && !silverRateManuallyEdited) {
      setSilverRateInput(String(silverRateData.perGram));
    }
  }, [silverRateData, silverRateManuallyEdited]);

  const { data: customerAutocompleteSuggestions = [] } = useQuery<any[]>({
    queryKey: ["/api/borrowers/autocomplete", customerSearchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/borrowers/autocomplete?search=${encodeURIComponent(customerSearchTerm)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: customerSearchTerm.length >= 2,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (customerAutocompleteSuggestions.length > 0 && customerSearchTerm.length >= 2) {
      setShowCustomerSuggestions(true);
    }
  }, [customerAutocompleteSuggestions, customerSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerSuggestionsRef.current && !customerSuggestionsRef.current.contains(event.target as Node) &&
        customerInputRef.current && !customerInputRef.current.contains(event.target as Node)
      ) {
        setShowCustomerSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCustomerSelect = (name: string) => {
    setSelectedCustomerName(name);
    setCustomerSearchTerm(name);
    setShowCustomerSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  const buildQueryParams = (page = 1, exportAll = false) => {
    const params = new URLSearchParams();
    if (activeTab === "group") {
      params.append('groupId', groupId);
    }
    if (activeTab === "customer" && selectedCustomerName) {
      params.append('customerName', selectedCustomerName);
    }
    if (goldRateInput) {
      params.append('goldRate', goldRateInput);
    }
    if (silverRateInput) {
      params.append('silverRate', silverRateInput);
    }
    params.append('page', String(page));
    params.append('pageSize', '50');
    if (exportAll) {
      params.append('export', 'all');
    }
    return params;
  };

  const { data: reportData, isLoading: isGenerating, refetch: generateReport } = useQuery<LoadingReportData>({
    queryKey: ['/api/loading-report', activeTab, groupId, selectedCustomerName, goldRateInput, silverRateInput, currentPage],
    queryFn: async () => {
      const params = buildQueryParams(currentPage);
      const res = await fetch(`/api/loading-report?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch loading report');
      return res.json();
    },
    enabled: false,
    staleTime: 60 * 1000,
  });

  const items = reportData?.items || [];
  const summary = reportData?.summary;
  const hasSilverLoans = items.some(item => item.metalType === 'silver');

  const fetchAllForExport = async () => {
    const params = buildQueryParams(1, true);
    const res = await fetch(`/api/loading-report?${params.toString()}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch loading report');
    return res.json() as Promise<LoadingReportData>;
  };

  const handleGenerateReport = () => {
    if (!goldRateInput) {
      alert("कृपया सोन्याचा दर भरा / Please enter gold rate");
      return;
    }
    if (activeTab === "customer" && !selectedCustomerName) {
      alert("कृपया कर्जदार निवडा / Please select a borrower");
      return;
    }
    setCurrentPage(1);
    setTimeout(() => {
      generateReport();
      setReportGenerated(true);
      setSidebarHidden(true);
      setShouldScrollToReport(true);
    }, 50);
  };

  const handleResetFilters = () => {
    setGroupId("all");
    setCustomerSearchTerm("");
    setSelectedCustomerName("");
    setGoldRateManuallyEdited(false);
    setSilverRateManuallyEdited(false);
    if (goldRateData?.perGram) setGoldRateInput(String(goldRateData.perGram));
    if (silverRateData?.perGram) setSilverRateInput(String(silverRateData.perGram));
    setReportGenerated(false);
    setSidebarHidden(false);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setShouldScrollToReport(true);
  };

  useEffect(() => {
    if (reportGenerated && currentPage >= 1) {
      generateReport();
    }
  }, [currentPage]);

  useEffect(() => {
    if (shouldScrollToReport && reportGenerated && !isGenerating && dataTableRef.current) {
      setTimeout(() => {
        dataTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setShouldScrollToReport(false);
      }, 300);
    }
  }, [shouldScrollToReport, reportGenerated, isGenerating, reportData]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleBackNavigation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const handleExportExcel = async () => {
    if (items.length === 0) return;

    let exportItems = items;
    if (summary && summary.totalFlagged > summary.pageSize) {
      try {
        const allData = await fetchAllForExport();
        exportItems = allData.items;
      } catch { }
    }

    const excelData = exportItems.map((item, index) => ({
      'अ.क्र.': index + 1,
      'कर्जदार नाव': item.borrowerName,
      'खाते क्र.': item.accountNumber,
      'गट': item.groupName,
      'कर्ज दिनांक': formatDate(item.loanDate),
      'तारण वस्तू': item.collateralDetails,
      'धातू': item.metalType === 'silver' ? 'चांदी' : 'सोने',
      'वजन (ग्रॅम)': item.weight ? parseFloat(String(item.weight)).toFixed(2) : '0',
      'शुद्धता %': (item as any).purityUsed,
      'व्याजदर': `${item.interestRate}%${item.interestRateType === 'yearly' ? ' वार्षिक' : ''}`,
      'शुद्ध वजन': item.fineWeight,
      'बाजार मूल्य': item.marketValue,
      'व्याजासहित': item.totalWithInterest,
      '80% मानक कर्ज': item.standard80Loan,
      'प्रत्यक्ष कर्ज': item.principalAmount,
      'लोडिंग रक्कम': item.loadingAmount,
      'LTV %': `${item.ltvPercent}%`,
      'सरासरी LTV %': `${item.avgLTV}%`,
      '80% Deviation': `${item.deviationFrom80}%`,
      'जोखीम': item.categoryLabel,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    ws['!cols'] = [
      { wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Loading Report");
    const reportDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    XLSX.writeFile(wb, `Loading_Report_${reportDate}.xlsx`);
  };

  const handlePrint = async () => {
    if (items.length === 0) return;

    let printItems = items;
    if (summary && summary.totalFlagged > summary.pageSize) {
      try {
        const allData = await fetchAllForExport();
        printItems = allData.items;
      } catch { }
    }

    const printHTML = `
      <!DOCTYPE html>
      <html><head><title>लोडिंग रिपोर्ट</title>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 landscape; margin: 12mm 8mm 8mm 8mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; box-sizing: border-box; }
        h1 { text-align: center; font-size: 15px; font-weight: 700; margin: 5px 0; }
        h2 { text-align: center; font-size: 11px; font-weight: 600; margin: 3px 0; color: #555; }
        .info { display: flex; justify-content: space-between; margin: 8px 0; font-size: 9px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .summary { display: flex; gap: 8px; margin: 8px 0; font-size: 9px; }
        .summary-card { flex: 1; text-align: center; padding: 4px; border: 1px solid #ddd; border-radius: 4px; }
        .summary-card.high { background: #fee; border-color: #f99; }
        .summary-card.medium { background: #fff3e0; border-color: #ffb74d; }
        .summary-card.slight { background: #fff8e1; border-color: #ffd54f; }
        table { width: 100%; border-collapse: collapse; margin-top: 5px; table-layout: auto; }
        th { background: #4338ca; color: white; padding: 5px 4px; font-size: 8.5px; text-align: center; font-weight: 600; white-space: nowrap; }
        td { border: 1px solid #ddd; padding: 4px 3px; font-size: 8.5px; text-align: center; }
        tr:nth-child(even) { background: #f9f9f9; }
        .cat-high { background: #fee2e2; color: #991b1b; font-weight: bold; }
        .cat-medium { background: #fff7ed; color: #9a3412; }
        .cat-slight { background: #fefce8; color: #854d0e; }
        .cat-info { background: #eff6ff; color: #1e40af; }
        .cat-safe { background: #f0fdf4; color: #166534; }
        .footer { text-align: center; margin-top: 10px; font-size: 8px; color: #999; }
      </style></head><body>
      <h1>लोडिंग रिपोर्ट (LTV Overloading Analysis)</h1>
      <h2>कर्ज-ते-मूल्य (LTV) विश्लेषण — सर्व कर्ज</h2>
      <div class="info">
        <span>दिनांक: ${new Date().toLocaleDateString('en-GB')}</span>
        <span>सोन्याचा दर: ₹${summary?.goldRateUsed?.toLocaleString('en-IN')}/ग्रॅम</span>
        ${silverRateInput ? `<span>चांदीचा दर: ₹${parseFloat(silverRateInput).toLocaleString('en-IN')}/ग्रॅम</span>` : ''}
        <span>शुद्धता: 82% | पाटली/बांगडी: 90% | वेडण: 95% | चोख: 99.50%</span>
        <span>सरासरी LTV: ${summary?.avgLTV}%</span>
      </div>
      <div class="summary">
        <div class="summary-card">एकूण कर्ज: ${summary?.totalLoans}</div>
        <div class="summary-card">80%+: ${summary?.overloadedCount}</div>
        <div class="summary-card high">उच्च: ${summary?.highCount}</div>
        <div class="summary-card medium">मध्यम: ${summary?.mediumCount}</div>
        <div class="summary-card slight">किंचित: ${summary?.slightCount}</div>
        <div class="summary-card" style="background:#f0fdf4;border-color:#86efac">सुरक्षित: ${summary?.safeCount}</div>
        <div class="summary-card">अतिरिक्त: ${formatCurrency(summary?.totalOverloadAmount || 0)}</div>
      </div>
      <table>
        <thead><tr>
          <th>क्र.</th><th>कर्जदार नाव</th><th>खाते</th><th>दिनांक</th><th>गट</th>
          <th>धातू</th><th>वजन</th><th>शुद्धता</th><th>व्याजदर</th><th>बाजार मूल्य</th><th>व्याजासहित</th><th>80% मानक</th><th>प्रत्यक्ष कर्ज</th>
          <th>लोडिंग</th><th>LTV%</th><th>जोखीम</th>
        </tr></thead>
        <tbody>
          ${printItems.map((item, i) => `
            <tr>
              <td>${i + 1}</td>
              <td style="text-align:left">${item.borrowerName}</td>
              <td>${item.accountNumber}</td>
              <td>${formatDate(item.loanDate)}</td>
              <td>${item.groupName}</td>
              <td>${item.metalType === 'silver' ? 'चांदी' : 'सोने'}</td>
              <td>${item.weight ? parseFloat(String(item.weight)).toFixed(2) : '0'}g</td>
              <td style="color:#1d4ed8;font-weight:bold">${(item as any).purityUsed}%</td>
              <td style="color:#c2410c;font-weight:bold">${item.interestRate}%${item.interestRateType === 'yearly' ? ' वा.' : ''}</td>
              <td>${formatCurrency(item.marketValue)}</td>
              <td style="${item.totalWithInterest > item.marketValue ? 'color:#dc2626;font-weight:bold' : 'color:#16a34a;font-weight:bold'}">${formatCurrency(item.totalWithInterest)}</td>
              <td>${formatCurrency(item.standard80Loan)}</td>
              <td>${formatCurrency(item.principalAmount)}</td>
              <td>${formatCurrency(item.loadingAmount)}</td>
              <td>${item.ltvPercent}%</td>
              <td class="cat-${item.category}">${item.categoryLabel}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">Auto-generated Loading Report | ${summary?.goldRateSource || ''}</div>
      </body></html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  return (
    <>
      <div className="print:hidden">
        <MobileNav />
      </div>
      
      <div className="lg:flex print:block">
        {!sidebarHidden && (
          <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 print:hidden">
            <div className="sidebar-modern h-full">
              <Sidebar />
            </div>
          </aside>
        )}

        <main className={cn("flex-1 w-full pb-16 lg:pb-0 print:pl-0 print:pb-0", sidebarHidden ? "" : "lg:pl-72")}>
          <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4 print:min-h-0 print:bg-white print:p-0">
            <div className="space-y-3 print:max-w-none print:mx-0 print:space-y-0 px-2 lg:px-4">

              <div className="flex items-center justify-between bg-white rounded-lg shadow-md p-3 print:hidden">
                <div className="flex items-center gap-3">
                  {sidebarHidden ? (
                    <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")} title="मुख्यपृष्ठ">
                      <Home className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={handleBackNavigation}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-indigo-700">
                      लोडिंग रिपोर्ट
                    </h1>
                    <p className="text-xs text-gray-500">LTV Overloading Analysis — सरासरीपेक्षा जास्त कर्ज वाटप</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sidebarHidden && reportGenerated && (
                    <Button variant="outline" size="sm" onClick={() => { setSidebarHidden(false); setReportGenerated(false); }} className="text-indigo-600 border-indigo-300">
                      <Filter className="h-3.5 w-3.5 mr-1" /> फिल्टर बदला
                    </Button>
                  )}
                  {summary && (
                    <span className="text-xs text-gray-500 hidden sm:block">
                      दर: ₹{summary.goldRateUsed?.toLocaleString('en-IN')}/g ({summary.goldRateSource})
                    </span>
                  )}
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                </div>
              </div>

              {!reportGenerated && (
              <div className="flex mb-4 bg-white rounded-lg border border-gray-200 p-1 shadow-sm print:hidden">
                <button 
                  onClick={() => { setActiveTab("group"); setSelectedCustomerName(""); setCustomerSearchTerm(""); setReportGenerated(false); setSidebarHidden(false); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                    activeTab === "group" 
                      ? "bg-indigo-600 text-white shadow-sm" 
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <Users className="h-4 w-4" /> गट प्रमाणे
                </button>
                <button 
                  onClick={() => { setActiveTab("customer"); setReportGenerated(false); setSidebarHidden(false); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                    activeTab === "customer" 
                      ? "bg-indigo-600 text-white shadow-sm" 
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <User className="h-4 w-4" /> कर्जदार प्रमाणे
                </button>
              </div>

              <Card className="bg-white shadow-lg print:hidden">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4" />
                    {activeTab === "group" ? "गट प्रमाणे लोडिंग विश्लेषण" : "कर्जदार प्रमाणे लोडिंग विश्लेषण"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                    <div>
                      {activeTab === "group" ? (
                        <div>
                          <label className="text-sm font-semibold text-gray-700 block mb-1">गट निवड</label>
                          <Select value={groupId} onValueChange={setGroupId}>
                            <SelectTrigger>
                              <SelectValue placeholder="सर्व गट" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">सर्व गट</SelectItem>
                              {(groups as any[]).map((group: any) => (
                                <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="relative">
                          <label className="text-sm font-semibold text-gray-700 block mb-1">कर्जदार शोधा</label>
                          <input
                            ref={customerInputRef}
                            type="text"
                            placeholder="नाव टाईप करा..."
                            value={customerSearchTerm}
                            onChange={(e) => {
                              setCustomerSearchTerm(e.target.value);
                              if (e.target.value.length >= 2) setShowCustomerSuggestions(true);
                              else setShowCustomerSuggestions(false);
                              if (selectedCustomerName && e.target.value !== selectedCustomerName) {
                                setSelectedCustomerName("");
                              }
                            }}
                            onKeyDown={(e) => {
                              if (!showCustomerSuggestions || customerAutocompleteSuggestions.length === 0) return;
                              if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setSelectedSuggestionIndex(prev => prev < customerAutocompleteSuggestions.length - 1 ? prev + 1 : 0);
                              } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : customerAutocompleteSuggestions.length - 1);
                              } else if (e.key === "Enter" && selectedSuggestionIndex >= 0) {
                                e.preventDefault();
                                const selected = customerAutocompleteSuggestions[selectedSuggestionIndex];
                                handleCustomerSelect(selected.borrowerName || selected.name);
                              } else if (e.key === "Escape") {
                                setShowCustomerSuggestions(false);
                              }
                            }}
                            onFocus={() => {
                              if (customerAutocompleteSuggestions.length > 0) setShowCustomerSuggestions(true);
                            }}
                            onBlur={() => {
                              setTimeout(() => setShowCustomerSuggestions(false), 300);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          {showCustomerSuggestions && customerAutocompleteSuggestions.length > 0 && (
                            <div ref={customerSuggestionsRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {customerAutocompleteSuggestions.map((borrower: any, index: number) => (
                                <div
                                  key={index}
                                  onClick={() => handleCustomerSelect(borrower.borrowerName)}
                                  className={cn(
                                    "px-3 py-2 cursor-pointer text-sm hover:bg-indigo-50",
                                    selectedSuggestionIndex === index && "bg-indigo-100"
                                  )}
                                >
                                  <div className="font-medium">{borrower.borrowerName}</div>
                                  {borrower.borrowerMobile && (
                                    <div className="text-xs text-gray-500">{borrower.borrowerMobile}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {selectedCustomerName && (
                            <div className="mt-1 text-xs text-green-600">
                              निवडलेले: {selectedCustomerName}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-orange-700 block mb-1">💰 सोन्याचा दर (₹/ग्रॅम)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          placeholder="उदा: 7500"
                          value={goldRateInput}
                          onChange={(e) => {
                            setGoldRateInput(e.target.value);
                            setGoldRateManuallyEdited(true);
                          }}
                          className="w-40 px-3 py-1.5 text-sm border-2 border-orange-300 rounded-md focus:border-orange-500 focus:outline-none bg-white"
                        />
                        <span className="text-xs text-gray-500">प्रति ग्रॅम</span>
                      </div>
                      <div className="mt-0.5">
                        {goldRateData?.success && !goldRateManuallyEdited && (
                          <span className="text-[10px] text-green-600">✅ ₹{goldRateData.perGram?.toLocaleString('en-IN')}/g ({goldRateData.source})</span>
                        )}
                        {goldRateManuallyEdited && (
                          <button
                            onClick={() => {
                              setGoldRateManuallyEdited(false);
                              if (goldRateData?.perGram) setGoldRateInput(String(goldRateData.perGram));
                            }}
                            className="text-[10px] text-blue-600 underline"
                          >
                            IBJA दर वापरा
                          </button>
                        )}
                      </div>
                      {goldRateInput && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          प्रति तोळा: ₹{(parseFloat(goldRateInput) * 10).toLocaleString('en-IN')} | शुद्धता: 82% | पाटली/बांगडी: 90% | वेडण: 95% | चोख: 99.50%
                        </div>
                      )}
                      {goldRateData?.allSources && goldRateData.allSources.length > 1 && (
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          📊 {goldRateData.allSources.map((s: any) => `${s.source}: ₹${s.perGram?.toLocaleString('en-IN')}/g`).join(' | ')}
                        </div>
                      )}
                    </div>

                    {hasSilverLoans && (
                    <div>
                      <label className="text-sm font-semibold text-gray-600 block mb-1">🪙 चांदीचा दर (₹/ग्रॅम)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="उदा: 95"
                          value={silverRateInput}
                          onChange={(e) => {
                            setSilverRateInput(e.target.value);
                            setSilverRateManuallyEdited(true);
                          }}
                          className="w-40 px-3 py-1.5 text-sm border-2 border-gray-300 rounded-md focus:border-gray-500 focus:outline-none bg-white"
                        />
                        <span className="text-xs text-gray-500">प्रति ग्रॅम</span>
                      </div>
                      <div className="mt-0.5">
                        {silverRateData?.success && !silverRateManuallyEdited && (
                          <span className="text-[10px] text-green-600">✅ ₹{silverRateData.perGram}/g ({silverRateData.source})</span>
                        )}
                        {silverRateManuallyEdited && (
                          <button
                            onClick={() => {
                              setSilverRateManuallyEdited(false);
                              if (silverRateData?.perGram) setSilverRateInput(String(silverRateData.perGram));
                            }}
                            className="text-[10px] text-blue-600 underline"
                          >
                            ऑनलाईन दर वापरा
                          </button>
                        )}
                      </div>
                      {silverRateInput && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          प्रति किलो: ₹{(parseFloat(silverRateInput) * 1000).toLocaleString('en-IN')} | शुद्धता: 99.9%
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3 print:hidden">
                <Button 
                  onClick={handleGenerateReport} 
                  disabled={isGenerating}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 text-sm font-semibold shadow-md"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      तयार करीत आहे...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      अहवाल तयार करा
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleResetFilters} size="sm" className="text-gray-600 border-gray-300">
                  साफ करा
                </Button>
              </div>
              )}

              {isGenerating && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <span className="ml-3 text-indigo-600 font-medium">रिपोर्ट तयार करीत आहे...</span>
                </div>
              )}

              {!isGenerating && reportGenerated && summary && (
                <div ref={reportSectionRef}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 print:hidden">
                    <Card className="bg-white border-l-4 border-l-indigo-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-gray-500">एकूण कर्ज</p>
                        <p className="text-xl font-bold text-indigo-700">{summary.totalLoans}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-l-4 border-l-purple-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-gray-500">सरासरी LTV</p>
                        <p className="text-xl font-bold text-purple-700">{summary.avgLTV}%</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-l-4 border-l-amber-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-gray-500">80% पेक्षा जास्त</p>
                        <p className="text-xl font-bold text-amber-700">{summary.overloadedCount}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-l-4 border-l-red-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-red-600">उच्च जोखीम</p>
                        <p className="text-xl font-bold text-red-700">{summary.highCount}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-orange-50 border-l-4 border-l-orange-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-orange-600">मध्यम जोखीम</p>
                        <p className="text-xl font-bold text-orange-700">{summary.mediumCount}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-yellow-50 border-l-4 border-l-yellow-500">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-yellow-700">किंचित जास्त</p>
                        <p className="text-xl font-bold text-yellow-700">{summary.slightCount}</p>
                      </CardContent>
                    </Card>
                    {summary.suspectCount > 0 && (
                      <Card className="bg-purple-50 border-l-4 border-l-purple-500">
                        <CardContent className="p-3">
                          <p className="text-[10px] text-purple-600">इनपुट तपासा</p>
                          <p className="text-xl font-bold text-purple-700">{summary.suspectCount}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {summary.totalOverloadAmount > 0 && (
                    <Card className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 print:hidden mt-2">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                          <span className="font-semibold text-red-700">एकूण अतिरिक्त लोडिंग रक्कम:</span>
                        </div>
                        <span className="text-xl font-bold text-red-700">{formatCurrency(summary.totalOverloadAmount)}</span>
                      </CardContent>
                    </Card>
                  )}

                  {items.length > 0 && (
                    <div className="flex items-center justify-between print:hidden mt-2">
                      <div className="flex gap-2">
                        <Button onClick={handlePrint} variant="outline" size="sm" className="text-indigo-600 border-indigo-300">
                          <Printer className="h-4 w-4 mr-1" /> प्रिंट
                        </Button>
                        <Button onClick={handleExportExcel} variant="outline" size="sm" className="text-green-600 border-green-300">
                          <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                        </Button>
                      </div>
                      {summary.totalPages > 1 && (
                        <span className="text-xs text-gray-500">
                          पृष्ठ {summary.currentPage}/{summary.totalPages} — एकूण {summary.totalFlagged} कर्ज
                        </span>
                      )}
                    </div>
                  )}

                  {items.length === 0 ? (
                    <Card className="bg-white mt-2">
                      <CardContent className="p-8 text-center">
                        <TrendingUp className="h-12 w-12 text-green-400 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-green-700">कोणतेही overloaded कर्ज नाही</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          सर्व कर्ज सरासरी LTV ({summary.avgLTV}%) आणि 80% मानक मर्यादेत आहेत
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card ref={dataTableRef} className="bg-white shadow-lg mt-2 overflow-hidden">
                      <div className="sm:hidden divide-y divide-gray-100">
                        {items.map((item, index) => {
                          const serialNo = ((summary?.currentPage || 1) - 1) * (summary?.pageSize || 50) + index;
                          const style = getCategoryStyle(item.category);
                          return (
                            <div key={item.loanId} className={cn("p-3", index % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-bold text-gray-900 text-sm">{item.borrowerName}</div>
                                  <div className="text-xs text-gray-500">{item.accountNumber} | {item.groupName} | {formatDate(item.loanDate)}</div>
                                  {item.collateralDetails && (
                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                      {item.collateralDetails}
                                      {item.metalType === 'silver' && <span className="ml-1 bg-gray-200 text-gray-700 px-1 rounded">चांदी</span>}
                                    </div>
                                  )}
                                </div>
                                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap", style.bgColor, style.color, "border", style.borderColor)}>
                                  {item.categoryLabel}
                                </span>
                              </div>
                              <div className="grid grid-cols-5 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-500">वजन</span>
                                  <div className="font-semibold text-amber-700">{item.weight ? parseFloat(String(item.weight)).toFixed(2) : '0'}g</div>
                                </div>
                                <div>
                                  <span className="text-gray-500">शुद्धता</span>
                                  <div className="font-semibold text-blue-700">{(item as any).purityUsed}%</div>
                                </div>
                                <div>
                                  <span className="text-gray-500">व्याजदर</span>
                                  <div className="font-semibold text-orange-700">{item.interestRate}%{item.interestRateType === 'yearly' ? ' वा.' : ''}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500">बाजार मूल्य</span>
                                  <div className="font-semibold text-green-700">{formatCurrency(item.marketValue)}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500">व्याजासहित</span>
                                  <div className={cn("font-semibold", item.totalWithInterest > item.marketValue ? "text-red-600" : "text-green-700")}>{formatCurrency(item.totalWithInterest)}</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-xs mt-1">
                                <div>
                                  <span className="text-gray-500">80% मानक</span>
                                  <div className="font-semibold text-gray-700">{formatCurrency(item.standard80Loan)}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500">प्रत्यक्ष कर्ज</span>
                                  <div className="font-bold text-indigo-700">{formatCurrency(item.principalAmount)}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500">लोडिंग</span>
                                  <div className={cn("font-bold", item.loadingAmount > 0 ? "text-red-600" : "text-gray-500")}>
                                    {item.loadingAmount > 0 ? `+${formatCurrency(item.loadingAmount)}` : formatCurrency(item.loadingAmount)}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-500">LTV</span>
                                  <div className="font-bold text-purple-700">{item.ltvPercent}%</div>
                                </div>
                              </div>
                              {(item as any).suspiciousInput && (
                                <div className="mt-1 text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded">
                                  {(item as any).suspiciousInput}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className="p-3 bg-indigo-50 border-t-2 border-indigo-300">
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">एकूण बाजार मूल्य</span>
                              <div className="font-bold text-indigo-800">{formatCurrency(items.reduce((sum, i) => sum + i.marketValue, 0))}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">एकूण व्याजासहित</span>
                              <div className="font-bold text-red-700">{formatCurrency(items.reduce((sum, i) => sum + i.totalWithInterest, 0))}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">एकूण कर्ज</span>
                              <div className="font-bold text-indigo-800">{formatCurrency(items.reduce((sum, i) => sum + i.principalAmount, 0))}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">एकूण लोडिंग</span>
                              <div className="font-bold text-red-700">+{formatCurrency(items.reduce((sum, i) => sum + (i.loadingAmount > 0 ? i.loadingAmount : 0), 0))}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <CardContent className="p-0 hidden sm:block">
                        <div className="divide-y divide-gray-200">
                          {items.map((item, index) => {
                            const style = getCategoryStyle(item.category);
                            const serialNo = ((summary?.currentPage || 1) - 1) * (summary?.pageSize || 50) + index + 1;
                            return (
                              <div key={item.loanId} className={cn("px-4 py-3 hover:bg-indigo-50/50 transition-colors", index % 2 === 0 ? "bg-white" : "bg-gray-50/30")}>
                                <div className="flex items-start justify-between gap-4 mb-2">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0">{serialNo}</span>
                                    <div className="min-w-0">
                                      <div className="text-sm font-bold text-gray-800">{item.borrowerName}</div>
                                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                        <span>खाते: {item.accountNumber}</span>
                                        <span>•</span>
                                        <span>{formatDate(item.loanDate)}</span>
                                        <span>•</span>
                                        <span className="text-indigo-600">{item.groupName}</span>
                                        {item.collateralDetails && (
                                          <>
                                            <span>•</span>
                                            <span className="text-gray-400">{item.collateralDetails}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-sm font-bold text-gray-700">LTV: {item.ltvPercent}%</span>
                                    <span className={cn("text-xs px-2 py-1 rounded-full font-semibold", style.bgColor, style.color, "border", style.borderColor)}>
                                      {item.categoryLabel}
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-8 gap-3 text-xs">
                                  <div className="text-center bg-amber-50 rounded px-2 py-1.5">
                                    <div className="text-gray-500 mb-0.5">वजन</div>
                                    <div className="font-semibold text-amber-700">{item.weight ? parseFloat(String(item.weight)).toFixed(2) : '0'}g</div>
                                  </div>
                                  <div className="text-center bg-blue-50 rounded px-2 py-1.5">
                                    <div className="text-gray-500 mb-0.5">शुद्धता</div>
                                    <div className="font-semibold text-blue-700">{(item as any).purityUsed}%</div>
                                  </div>
                                  <div className="text-center bg-orange-50 rounded px-2 py-1.5">
                                    <div className="text-gray-500 mb-0.5">व्याजदर</div>
                                    <div className="font-semibold text-orange-700">{item.interestRate}%{item.interestRateType === 'yearly' ? ' वा.' : ''}</div>
                                  </div>
                                  <div className="text-center bg-green-50 rounded px-2 py-1.5">
                                    <div className="text-gray-500 mb-0.5">बाजार मूल्य</div>
                                    <div className="font-semibold text-green-700">{formatCurrency(item.marketValue)}</div>
                                  </div>
                                  <div className={cn("text-center rounded px-2 py-1.5", item.totalWithInterest > item.marketValue ? "bg-red-50" : "bg-green-50")}>
                                    <div className="text-gray-500 mb-0.5">व्याजासहित</div>
                                    <div className={cn("font-semibold", item.totalWithInterest > item.marketValue ? "text-red-600" : "text-green-700")}>{formatCurrency(item.totalWithInterest)}</div>
                                  </div>
                                  <div className="text-center bg-gray-100 rounded px-2 py-1.5">
                                    <div className="text-gray-500 mb-0.5">80% मानक</div>
                                    <div className="font-semibold text-gray-700">{formatCurrency(item.standard80Loan)}</div>
                                  </div>
                                  <div className="text-center bg-purple-50 rounded px-2 py-1.5">
                                    <div className="text-gray-500 mb-0.5">प्रत्यक्ष कर्ज</div>
                                    <div className="font-bold text-purple-700">{formatCurrency(item.principalAmount)}</div>
                                  </div>
                                  <div className={cn("text-center rounded px-2 py-1.5", item.loadingAmount > 0 ? "bg-red-50" : "bg-gray-50")}>
                                    <div className="text-gray-500 mb-0.5">लोडिंग</div>
                                    <div className={cn("font-bold", item.loadingAmount > 0 ? "text-red-600" : "text-gray-500")}>
                                      {item.loadingAmount > 0 ? `+${formatCurrency(item.loadingAmount)}` : formatCurrency(item.loadingAmount)}
                                    </div>
                                  </div>
                                </div>
                                {(item as any).suspiciousInput && (
                                  <div className="text-xs text-purple-600 font-semibold mt-1">⚠️ {(item as any).suspiciousInput}</div>
                                )}
                              </div>
                            );
                          })}

                          <div className="bg-indigo-50 px-4 py-3 border-t-2 border-indigo-300">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-indigo-800">एकूण: {items.length} कर्ज</span>
                              <span className="text-sm font-bold text-indigo-800">सरासरी LTV: {summary.avgLTV}%</span>
                            </div>
                            <div className="grid grid-cols-5 gap-3 text-xs">
                              <div className="text-center bg-white rounded px-2 py-1.5 shadow-sm">
                                <div className="text-gray-500 mb-0.5">बाजार मूल्य</div>
                                <div className="font-bold text-green-700">{formatCurrency(items.reduce((sum, i) => sum + i.marketValue, 0))}</div>
                              </div>
                              <div className="text-center bg-white rounded px-2 py-1.5 shadow-sm">
                                <div className="text-gray-500 mb-0.5">व्याजासहित</div>
                                <div className="font-bold text-red-700">{formatCurrency(items.reduce((sum, i) => sum + i.totalWithInterest, 0))}</div>
                              </div>
                              <div className="text-center bg-white rounded px-2 py-1.5 shadow-sm">
                                <div className="text-gray-500 mb-0.5">80% मानक</div>
                                <div className="font-bold text-gray-700">{formatCurrency(items.reduce((sum, i) => sum + i.standard80Loan, 0))}</div>
                              </div>
                              <div className="text-center bg-white rounded px-2 py-1.5 shadow-sm">
                                <div className="text-gray-500 mb-0.5">प्रत्यक्ष कर्ज</div>
                                <div className="font-bold text-purple-700">{formatCurrency(items.reduce((sum, i) => sum + i.principalAmount, 0))}</div>
                              </div>
                              <div className="text-center bg-white rounded px-2 py-1.5 shadow-sm">
                                <div className="text-gray-500 mb-0.5">एकूण लोडिंग</div>
                                <div className="font-bold text-red-700">+{formatCurrency(items.reduce((sum, i) => sum + (i.loadingAmount > 0 ? i.loadingAmount : 0), 0))}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {summary && summary.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4 print:hidden">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                        className="text-indigo-600 border-indigo-300"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {Array.from({ length: Math.min(summary.totalPages, 7) }, (_, i) => {
                        let pageNum: number;
                        if (summary.totalPages <= 7) {
                          pageNum = i + 1;
                        } else if (currentPage <= 4) {
                          pageNum = i + 1;
                        } else if (currentPage >= summary.totalPages - 3) {
                          pageNum = summary.totalPages - 6 + i;
                        } else {
                          pageNum = currentPage - 3 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            className={cn(
                              "min-w-[36px]",
                              currentPage === pageNum ? "bg-indigo-600 text-white" : "text-indigo-600 border-indigo-300"
                            )}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= summary.totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                        className="text-indigo-600 border-indigo-300"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-gray-500 ml-2">
                        {summary.totalFlagged} पैकी {((currentPage - 1) * summary.pageSize) + 1}-{Math.min(currentPage * summary.pageSize, summary.totalFlagged)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!reportGenerated && !isGenerating && activeTab === "customer" && !selectedCustomerName && (
                <Card className="bg-white">
                  <CardContent className="p-8 text-center">
                    <User className="h-12 w-12 text-indigo-300 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-600">कर्जदार निवडा</h3>
                    <p className="text-sm text-gray-400 mt-1">वरील शोध बॉक्समध्ये कर्जदाराचे नाव टाईप करा</p>
                  </CardContent>
                </Card>
              )}

            </div>
          </div>
        </main>
      </div>
    </>
  );
}
