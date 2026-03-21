import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, CheckCircle, X, FileText, Download, Search, Loader2, Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { ReceiptGenerator } from "@/components/receipt-generator";
import { Badge } from "@/components/ui/badge";
import { DateUtils } from "@/lib/date-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const marathiToEnglish: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'क': 'k', 'ख': 'kh',
  'ग': 'g', 'घ': 'gh', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't',
  'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'ph',
  'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l',
  'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
};

const normalizeMarathiVowels = (text: string): string => {
  return text
    .replace(/ी/g, 'ि').replace(/ू/g, 'ु').replace(/ै/g, 'े')
    .replace(/ौ/g, 'ो').replace(/ॅ/g, 'े').replace(/ॉ/g, 'ो')
    .replace(/आ/g, 'अ').replace(/ई/g, 'इ').replace(/ऊ/g, 'उ')
    .replace(/ऐ/g, 'ए').replace(/औ/g, 'ओ');
};

const createDualLanguageQuery = (query: string): string[] => {
  const queries = [query.toLowerCase()];
  const originalQuery = query.toLowerCase();
  Object.keys(marathiToEnglish).forEach(marathi => {
    if (originalQuery.includes(marathi)) {
      queries.push(originalQuery.replace(new RegExp(marathi, 'g'), marathiToEnglish[marathi]));
    }
  });
  return queries;
};

const matchesBorrowerName = (borrowerName: string, searchTerm: string): boolean => {
  if (!borrowerName || !searchTerm) return false;
  const trimmedSearch = searchTerm.trim().toLowerCase();
  if (!trimmedSearch) return false;
  const searchQueries = createDualLanguageQuery(trimmedSearch);
  const nameLower = borrowerName.toLowerCase();
  const nameNormalized = normalizeMarathiVowels(nameLower);
  return searchQueries.some(query => {
    const queryNormalized = normalizeMarathiVowels(query);
    if (nameLower.includes(query)) return true;
    if (nameNormalized.includes(queryNormalized)) return true;
    const nameWords = nameLower.split(/\s+/);
    const nameWordsNorm = nameNormalized.split(/\s+/);
    const queryWordsNorm = queryNormalized.split(/\s+/);
    if (query.split(/\s+/).length > 1) {
      return query.split(/\s+/).every((qWord, i) => {
        const qWordNorm = queryWordsNorm[i] || normalizeMarathiVowels(qWord);
        return nameWords.some((nWord, j) => {
          const nWordNorm = nameWordsNorm[j] || normalizeMarathiVowels(nWord);
          return nWord.includes(qWord) || nWord.startsWith(qWord) || nWordNorm.includes(qWordNorm) || nWordNorm.startsWith(qWordNorm);
        });
      });
    } else {
      return nameWords.some((nWord, j) => {
        const nWordNorm = nameWordsNorm[j] || normalizeMarathiVowels(nWord);
        return nWord.includes(query) || nWord.startsWith(query) || nWordNorm.includes(queryNormalized) || nWordNorm.startsWith(queryNormalized) ||
          (query.length >= 2 && nWord.length >= 2 && query.substring(0, 2) === nWord.substring(0, 2));
      });
    }
  });
};

export default function AnnualStatementPage() {
  const isMobile = useIsMobile();
  const [selectedBorrower, setSelectedBorrower] = useState<string>("");
  const [borrowerSearchQuery, setBorrowerSearchQuery] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [statementData, setStatementData] = useState<any>(null);
  const [showDesktopPreview, setShowDesktopPreview] = useState(false);
  const [receiptHTML, setReceiptHTML] = useState<string | null>(null);
  const [isMobileFullPage, setIsMobileFullPage] = useState(false);

  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [bulkFY, setBulkFY] = useState('');
  const [bulkStatusFilter, setBulkStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  // Fetch all loans
  const { data: loans = [] } = useQuery({
    queryKey: ["/api/loans"],
    staleTime: 5 * 60 * 1000
  });

  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ["/api/groups"],
    staleTime: 5 * 60 * 1000
  });

  // Fetch company data
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
    staleTime: 5 * 60 * 1000
  });

  // Get unique borrower names
  const borrowerNames = Array.from(new Set((loans as any[]).map(loan => loan.borrowerName))).sort();

  // Generate financial years (current year and past 9 years = 10 total)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const currentFYStart = currentMonth >= 3 ? currentYear : currentYear - 1;
  const financialYears = [];
  for (let i = 0; i < 10; i++) {
    const year = currentFYStart - i;
    financialYears.push({
      value: year.toString(),
      label: `${year}-${year + 1}`
    });
  }

  // Helper function to get group name
  const getGroupName = (groupId: string) => {
    const group = (groups as any[]).find((g: any) => g.id === groupId);
    return group?.name || '';
  };

  // Helper function to get loan's financial year
  const getLoanFinancialYear = (loanDate: string) => {
    const date = new Date(loanDate);
    const month = date.getMonth();
    const year = date.getFullYear();
    // Financial year: Apr-Mar (month 3 = April, month 0-2 = Jan-Mar)
    const financialYear = month >= 3 ? year : year - 1;
    return `${financialYear}-${financialYear + 1}`;
  };

  // Filter loans for selected borrower and financial year
  const filteredLoans = useMemo(() => {
    if (!selectedBorrower || !selectedYear) return [];

    const selectedYearNum = parseInt(selectedYear);
    const yearStartDate = new Date(selectedYearNum, 3, 1); // April 1 of selected year
    const yearEndDate = new Date(selectedYearNum + 1, 2, 31); // March 31 of next year

    return (loans as any[])
      .filter(loan => {
        const loanDate = new Date(loan.loanDate);
        
        // Loan must be given on or before year end
        if (loanDate > yearEndDate) return false;
        
        // Borrower must match
        if (loan.borrowerName !== selectedBorrower) return false;
        
        // If loan is closed, it must be closed on or after year start
        // (If closed before year start, there's no outstanding balance during the year)
        if (loan.closureDate) {
          const closureDate = new Date(loan.closureDate);
          if (closureDate < yearStartDate) {
            console.log(`⚠️ Excluding closed loan ${loan.accountNumber} - closed before year start`);
            return false;
          }
        }
        
        return true;
      })
      .sort((a, b) => new Date(a.loanDate).getTime() - new Date(b.loanDate).getTime());
  }, [loans, selectedBorrower, selectedYear]);

  // Reset when borrower changes
  useEffect(() => {
    console.log('🔄 Borrower changed:', selectedBorrower);
    setSelectedLoan(null);
    setStatementData(null);
    setSelectedYear(''); // Reset year too
  }, [selectedBorrower]);

  // Auto-select financial year when borrower is selected
  useEffect(() => {
    if (selectedBorrower && !selectedYear) {
      const borrowerLoans = (loans as any[]).filter(loan => loan.borrowerName === selectedBorrower);
      if (borrowerLoans.length > 0) {
        // Auto-select CURRENT financial year (not earliest)
        // This is more useful as users typically want recent statements
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Financial year: Apr-Mar (month 3 = April, month 0-2 = Jan-Mar)
        const currentFinancialYear = currentMonth >= 3 ? currentYear : currentYear - 1;
        
        console.log('📅 Auto-selected CURRENT financial year:', currentFinancialYear);
        setSelectedYear(currentFinancialYear.toString());
      }
    }
  }, [selectedBorrower, selectedYear, loans]);

  // Auto-select loan if only one available, DON'T auto-select for multiple
  useEffect(() => {
    console.log('🔍 Filtered loans count:', filteredLoans.length);
    if (filteredLoans.length === 1) {
      console.log('✅ Auto-selecting single loan:', filteredLoans[0].accountNumber);
      setSelectedLoan(filteredLoans[0]);
    } else if (filteredLoans.length > 1) {
      console.log('⚠️ Multiple loans found - user must select manually');
      // Don't auto-select, let user choose
      setSelectedLoan(null);
    } else if (filteredLoans.length === 0) {
      console.log('❌ No loans found');
      setSelectedLoan(null);
    }
  }, [filteredLoans]);

  const handleGenerateStatement = async () => {
    if (!selectedBorrower || !selectedYear) {
      alert("कृपया कर्जदार आणि वर्ष निवडा");
      return;
    }

    if (filteredLoans.length === 0) {
      alert(`${selectedBorrower} यांचे कोणतेही कर्ज ${selectedYear}-${parseInt(selectedYear) + 1} या आर्थिक वर्षापूर्वी नाही.`);
      return;
    }

    if (filteredLoans.length > 1 && !selectedLoan) {
      alert("कृपया कर्ज निवडा");
      return;
    }

    const loanToUse = selectedLoan || filteredLoans[0];

    try {
      const response = await fetch(
        `/api/annual-statement?loanId=${loanToUse.id}&year=${selectedYear}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch statement');
      }

      const data = await response.json();
      setStatementData(data);
      
      // Generate receipt HTML for preview
      const html = ReceiptGenerator.generateAnnualStatement(data, company || null);
      setReceiptHTML(html);
      
      if (isMobile) {
        setIsMobileFullPage(true);
      } else {
        setShowDesktopPreview(true);
      }
    } catch (error) {
      console.error('Error generating statement:', error);
      alert("विवरणपत्र तयार करताना त्रुटी झाली");
    }
  };

  const handlePrint = () => {
    if (!receiptHTML) {
      alert("प्रथम विवरणपत्र तयार करा");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 100);
      };
    }
  };

  const createOffscreenRendered = async (): Promise<{ container: HTMLElement, cleanup: () => void } | null> => {
    if (!receiptHTML) return null;

    const a5WidthPx = 560;
    const a5HeightPx = 794;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.style.width = a5WidthPx + 'px';
    wrapper.style.height = a5HeightPx + 'px';
    wrapper.style.zIndex = '-9999';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.overflow = 'visible';
    wrapper.style.background = 'white';
    wrapper.innerHTML = receiptHTML;
    document.body.appendChild(wrapper);

    const rc = wrapper.querySelector('.receipt-container') as HTMLElement;
    if (rc) {
      rc.classList.add('export-mode');
      rc.style.width = a5WidthPx + 'px';
      rc.style.minWidth = a5WidthPx + 'px';
      rc.style.maxWidth = a5WidthPx + 'px';
      rc.style.height = a5HeightPx + 'px';
      rc.style.boxShadow = 'none';
      rc.style.background = 'white';
      rc.style.padding = '22px 30px';
    }

    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      container: rc || wrapper,
      cleanup: () => document.body.removeChild(wrapper)
    };
  };

  const downloadReceiptAsPDF = async () => {
    try {
      const result = await createOffscreenRendered();
      if (!result) { alert("पावती सापडली नाही"); return; }
      const { container, cleanup } = result;

      const a5WidthPx = 560;
      const a5HeightPx = 794;

      const canvas = await html2canvas(container, {
        scale: 4,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 0,
        width: a5WidthPx,
        height: a5HeightPx,
        windowWidth: a5WidthPx,
        windowHeight: a5HeightPx,
      });

      cleanup();

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5',
        compress: false
      });
      doc.addImage(imgData, 'PNG', 0, 0, 148, 210);

      const fileName = `विवरणपत्र_नमुना१४_${selectedBorrower || 'statement'}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("PDF तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
  };

  const downloadReceiptAsImage = async () => {
    try {
      const result = await createOffscreenRendered();
      if (!result) { alert("पावती सापडली नाही"); return; }
      const { container, cleanup } = result;

      const a5WidthPx = 560;
      const a5HeightPx = 794;

      const canvas = await html2canvas(container, {
        scale: 4,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 0,
        width: a5WidthPx,
        height: a5HeightPx,
        windowWidth: a5WidthPx,
        windowHeight: a5HeightPx,
      });

      cleanup();

      const a5ImgWidth = 874;
      const a5ImgHeight = 1240;
      const resizedCanvas = document.createElement('canvas');
      resizedCanvas.width = a5ImgWidth;
      resizedCanvas.height = a5ImgHeight;
      const ctx = resizedCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, a5ImgWidth, a5ImgHeight);
        ctx.drawImage(canvas, 0, 0, a5ImgWidth, a5ImgHeight);
      }

      const imageUrl = resizedCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `विवरणपत्र_नमुना१४_${selectedBorrower || 'statement'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Image generation error:", error);
      alert("इमेज तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
  };

  const bulkFyOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const month = new Date().getMonth();
    const currentFY = month >= 3 ? current : current - 1;
    const options = [];
    for (let i = 0; i < 10; i++) {
      const y = currentFY - i;
      options.push({ value: y.toString(), label: `${y}-${y + 1}` });
    }
    return options;
  }, []);

  const handleBulkFetch = async (fy: string, status: string) => {
    if (!fy) return;
    setIsBulkLoading(true);
    try {
      const response = await fetch(`/api/annual-statement/bulk?year=${fy}&status=${status}`);
      if (!response.ok) throw new Error('Failed to fetch bulk data');
      const data = await response.json();
      const sorted = data.sort((a: any, b: any) => {
        const gA = (groups as any[]).find((g: any) => g.id === a.groupId)?.name || '';
        const gB = (groups as any[]).find((g: any) => g.id === b.groupId)?.name || '';
        if (gA !== gB) return gA.localeCompare(gB, 'mr');
        return (a.accountNumber || '').localeCompare(b.accountNumber || '', 'en', { numeric: true });
      });
      setBulkData(sorted);
    } catch (error) {
      console.error('Bulk fetch error:', error);
      alert('बल्क डेटा आणताना त्रुटी झाली');
      setBulkData([]);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkPrint = async () => {
    if (bulkData.length === 0) return;
    setIsBulkGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const bulkHTML = ReceiptGenerator.generateBulkAnnualStatements(bulkData, company as any);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(bulkHTML);
        printWindow.document.close();
        printWindow.onload = () => {
          setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
        };
      }
    } catch (error) {
      console.error('Bulk print error:', error);
      alert('बल्क प्रिंट तयार करताना त्रुटी झाली');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  if (isMobileFullPage && receiptHTML && isMobile) {
    return (
      <div className="min-h-screen bg-white" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="bg-indigo-50 border-b px-3 py-3 print:hidden" style={{ flexShrink: 0 }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-indigo-700 font-semibold">
              <FileText className="h-5 w-5" />
              नमुना क्र. १४
            </div>
            <Button 
              size="sm"
              variant="outline"
              onClick={() => {
                setIsMobileFullPage(false);
              }}
            >
              <X className="mr-1 h-4 w-4" />
              बंद करा
            </Button>
          </div>
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={downloadReceiptAsImage}
              className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-3 bg-indigo-600 hover:bg-indigo-700 text-white active:bg-indigo-800"
              style={{ touchAction: 'manipulation' }}
            >
              <Download className="mr-2 h-4 w-4" />
              इमेज
            </button>
            <button 
              type="button"
              onClick={downloadReceiptAsPDF}
              className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-3 bg-red-600 hover:bg-red-700 text-white active:bg-red-800"
              style={{ touchAction: 'manipulation' }}
            >
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
        
        <div 
          id="receipt-content-14"
          className="bg-white px-2 py-3"
          style={{ flex: 1, overflow: 'auto' }}
          dangerouslySetInnerHTML={{ __html: receiptHTML }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">

            {/* Desktop Full-Page Receipt Preview - keeps sidebar visible */}
            {showDesktopPreview && receiptHTML && !isMobile && (
              <div className="fixed top-0 right-0 bottom-0 left-0 lg:left-72 z-40 bg-gray-100 flex flex-col">
                {/* Header with buttons */}
                <div className="bg-indigo-50 px-6 py-4 border-b shadow-sm flex items-center justify-between">
                  <h2 className="text-indigo-700 font-semibold text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    वार्षिक विवरणपत्र - नमुना क्र. १४
                  </h2>
                  <div className="flex gap-3">
                    <Button 
                      onClick={handlePrint}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      प्रिंट करा
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setShowDesktopPreview(false);
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      बंद करा
                    </Button>
                  </div>
                </div>
                {/* Full receipt view */}
                <div 
                  className="flex-1 bg-white overflow-y-auto"
                  dangerouslySetInnerHTML={{ 
                    __html: receiptHTML.replace(
                      '</style>',
                      `
                      @page { size: A4; margin: 0; }
                      html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                      }
                      .receipt-container {
                        width: 100% !important;
                        max-width: 800px !important;
                        margin: 0 auto !important;
                        padding: 30px !important;
                        box-sizing: border-box !important;
                        box-shadow: none !important;
                        border: none !important;
                      }
                      </style>`
                    ).replace(/<\/?html[^>]*>|<\/?head[^>]*>|<\/?body[^>]*>|<!DOCTYPE[^>]*>/gi, '')
                  }}
                />
              </div>
            )}

            <div className="flex border-b mb-4">
              <button
                onClick={() => setActiveTab('single')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'single' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <FileText className="h-4 w-4 inline mr-1" />
                एकल विवरणपत्र
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'bulk' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <Layers className="h-4 w-4 inline mr-1" />
                बल्क प्रिंट
              </button>
            </div>

            {activeTab === 'single' && (<>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl md:text-3xl">
                  वार्षिक लेखा विवरणपत्र - नमुना क्रमांक १४
                </CardTitle>
                <p className="text-sm md:text-base text-gray-600">
                  वर्ष संपल्यानंतर ४५ दिवसांच्या आत सावकाराने कर्जदारास द्यावयाचे वार्षिक लेखा विवरणपत्र
                </p>
              </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Borrower Selection with Search */}
                <div className="space-y-2">
                  <Label className="md:text-base">कर्जदाराचे नाव निवडा *</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="कर्जदार शोधा... (raju, राजू, patel, kumar...)"
                      value={borrowerSearchQuery}
                      onChange={(e) => {
                        setBorrowerSearchQuery(e.target.value);
                        if (selectedBorrower) {
                          setSelectedBorrower("");
                          setSelectedLoan(null);
                          setStatementData(null);
                        }
                      }}
                      className="pl-10"
                      data-testid="search-borrower"
                    />
                  </div>
                  <Select 
                    value={selectedBorrower} 
                    onValueChange={(val) => {
                      setSelectedBorrower(val);
                      setBorrowerSearchQuery(val);
                      setSelectedLoan(null);
                      setStatementData(null);
                    }}
                  >
                    <SelectTrigger data-testid="select-borrower">
                      <SelectValue placeholder="कर्जदार निवडा..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {(() => {
                        const filtered = borrowerSearchQuery.trim()
                          ? borrowerNames.filter(name => matchesBorrowerName(name, borrowerSearchQuery))
                          : borrowerNames;
                        return filtered.length > 0 ? filtered.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        )) : (
                          <div className="p-2 text-sm text-gray-500 text-center">
                            {borrowerSearchQuery.trim() ? 'कोणतेही कर्जदार सापडले नाही' : 'वरील search box मध्ये टाइप करा'}
                          </div>
                        );
                      })()}
                    </SelectContent>
                  </Select>
                  {selectedBorrower && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedBorrower("");
                        setBorrowerSearchQuery("");
                        setSelectedLoan(null);
                        setStatementData(null);
                      }}
                      className="text-xs w-full"
                    >
                      निवड मिटवा
                    </Button>
                  )}
                </div>

                {/* Year Selection */}
                <div className="space-y-2">
                  <Label htmlFor="year-select" className="md:text-base">आर्थिक वर्ष निवडा *</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger id="year-select" data-testid="select-year">
                      <SelectValue placeholder="वर्ष निवडा..." />
                    </SelectTrigger>
                    <SelectContent>
                      {financialYears.map((fy) => (
                        <SelectItem key={fy.value} value={fy.value}>
                          {fy.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Multi-Loan Selection */}
              {filteredLoans.length > 1 && (
                <div className="mb-6 space-y-2">
                  <Label className="text-base md:text-lg font-semibold">कर्ज निवडा * ({filteredLoans.length} कर्जे आढळली - निवडलेल्या वर्षापर्यंतची)</Label>
                  <Card className="border-2 border-indigo-300 max-h-64 overflow-y-auto">
                    <CardContent className="p-0">
                      {filteredLoans.map((loan: any) => (
                        <div
                          key={loan.id}
                          className={`p-4 border-b last:border-b-0 cursor-pointer transition-all ${
                            selectedLoan?.id === loan.id 
                              ? 'bg-indigo-100 border-l-4 border-l-indigo-600 shadow-md' 
                              : 'hover:bg-gray-50 hover:border-l-2 hover:border-l-indigo-300'
                          }`}
                          onClick={() => {
                            console.log('🖱️ Loan clicked:', loan.accountNumber, loan.id);
                            setSelectedLoan(loan);
                          }}
                          data-testid={`loan-item-${loan.id}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className={`font-semibold ${selectedLoan?.id === loan.id ? 'text-indigo-900' : 'text-indigo-800'}`}>
                                  खाते क्रमांक: {loan.accountNumber}
                                </div>
                                <Badge variant="outline" className="text-xs bg-orange-50 border-orange-300 text-orange-700">
                                  {getLoanFinancialYear(loan.loanDate)}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-700 mt-1">
                                ग्रुप: {getGroupName(loan.groupId)} | कर्ज तारीख: {DateUtils.formatDate(loan.loanDate)}
                              </div>
                              <div className="text-sm text-green-700 font-medium mt-1">
                                मुद्दल: ₹{Math.round(loan.principalAmount).toLocaleString('en-IN')} | दर: {loan.interestRate}% {loan.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}
                              </div>
                              {(loan.collateralDetails || loan.otherInfo || loan.specialConditions || loan.documentDetails) && (
                                <div className="text-sm text-purple-700 mt-1">
                                  {loan.collateralDetails
                                    ? <>वस्तू: {loan.collateralDetails} {loan.weight && `| वजन: ${parseFloat(String(loan.weight)).toFixed(2)}`}</>
                                    : <>माहिती: {[loan.specialConditions, loan.documentDetails, loan.otherInfo].filter((v: string) => v && v !== '—' && v.trim() !== '').join(' | ') || '—'}</>
                                  }
                                </div>
                              )}
                            </div>
                            {selectedLoan?.id === loan.id && (
                              <Badge variant="default" className="ml-2 bg-indigo-600">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                निवडले
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="italic">टीप: कर्ज निवडण्यासाठी कार्डवर क्लिक करा</p>
                    <p className="text-xs">
                      प्रत्येक कर्जाच्या समोर त्याचं आर्थिक वर्ष दाखवलं आहे (केशरी रंगात). 
                      जर तुम्हाला विशिष्ट वर्षाचं कर्ज हवं असेल तर वरून वर्ष बदला.
                    </p>
                  </div>
                </div>
              )}

              {/* Selected Loan Info (for single loan or after selection) */}
              {selectedLoan && filteredLoans.length === 1 && (
                <Card className="border-green-200 bg-green-50 mb-6">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-green-800 flex items-center gap-2 text-base">
                      <CheckCircle className="h-5 w-5" />
                      निवडलेला कर्ज
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">खाते क्रमांक:</span> {selectedLoan.accountNumber}
                      </div>
                      <div>
                        <span className="font-medium">ग्रुप:</span> {getGroupName(selectedLoan.groupId)}
                      </div>
                      <div>
                        <span className="font-medium">मुद्दल रक्कम:</span> ₹{Math.round(selectedLoan.principalAmount).toLocaleString('en-IN')}
                      </div>
                      <div>
                        <span className="font-medium">कर्ज तारीख:</span> {DateUtils.formatDate(selectedLoan.loanDate)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button 
                  onClick={handleGenerateStatement}
                  className="flex-1"
                  data-testid="button-generate-statement"
                >
                  विवरणपत्र तयार करा
                </Button>
                
                {statementData && !isMobile && (
                  <Button 
                    onClick={handlePrint}
                    variant="outline"
                    className="flex items-center gap-2"
                    data-testid="button-print-statement"
                  >
                    <Printer className="h-4 w-4" />
                    प्रिंट करा
                  </Button>
                )}
                {statementData && isMobile && (
                  <Button 
                    onClick={() => setIsMobileFullPage(true)}
                    variant="outline"
                    className="flex items-center gap-2 bg-green-50 border-green-300 text-green-700"
                    data-testid="button-pdf-download"
                  >
                    <FileText className="h-4 w-4" />
                    पावती पहा
                  </Button>
                )}
              </div>

              {/* Display Statement Data */}
              {statementData && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg md:text-xl font-semibold mb-4">विवरणपत्र माहिती</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold">कर्जदाराचे नाव:</p>
                      <p>{statementData.borrowerName}</p>
                    </div>
                    <div>
                      <p className="font-semibold">खाते क्रमांक:</p>
                      <p>{statementData.accountNumber}</p>
                    </div>
                    <div>
                      <p className="font-semibold">व्यवसाय:</p>
                      <p>{statementData.occupation || 'नमूद नाही'}</p>
                    </div>
                    <div>
                      <p className="font-semibold">पत्ता:</p>
                      <p>{statementData.address || 'नमूद नाही'}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-semibold md:text-lg mb-2">आर्थिक तपशील (₹):</h4>
                    <table className="w-full text-sm md:text-base border">
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2 md:px-4 md:py-3">वर्षाच्या सुरुवातीस देय (मूळ + व्याज)</td>
                          <td className="p-2 md:px-4 md:py-3 text-right font-medium">
                            ₹{Math.round(statementData.openingTotal || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 md:px-4 md:py-3">वर्ष भरात दिलेलें एकूण कर्ज</td>
                          <td className="p-2 md:px-4 md:py-3 text-right font-medium">
                            ₹{Math.round(statementData.yearDisbursement || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 md:px-4 md:py-3">वर्ष भरात प्राप्त परतफेड (मूळ)</td>
                          <td className="p-2 md:px-4 md:py-3 text-right font-medium">
                            ₹{Math.round(statementData.yearPrincipalRepayment || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 md:px-4 md:py-3">वर्ष भरात प्राप्त परतफेड (व्याज)</td>
                          <td className="p-2 md:px-4 md:py-3 text-right font-medium">
                            ₹{Math.round(statementData.yearInterestRepayment || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                        <tr className="border-b bg-gray-50">
                          <td className="p-2 md:px-4 md:py-3 font-semibold">वर्ष अखेरीस देय (मूळ)</td>
                          <td className="p-2 md:px-4 md:py-3 text-right font-semibold">
                            ₹{Math.round(statementData.closingPrincipal || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="p-2 md:px-4 md:py-3 font-semibold">वर्ष अखेरीस देय (व्याज)</td>
                          <td className="p-2 md:px-4 md:py-3 text-right font-semibold">
                            ₹{Math.round(statementData.closingInterest || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </>)}

            {activeTab === 'bulk' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
                    <Layers className="h-5 w-5" />
                    बल्क प्रिंट — नमुना क्रमांक १४
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    एका आर्थिक वर्षातील सर्व कर्जांचे वार्षिक लेखा विवरणपत्र एकदम प्रिंट करा (A4 landscape — प्रत्येक पानावर ४)
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-sm font-semibold mb-1 block">आर्थिक वर्ष निवडा</Label>
                      <Select value={bulkFY} onValueChange={(val) => { setBulkFY(val); handleBulkFetch(val, bulkStatusFilter); }}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="आर्थिक वर्ष निवडा..." />
                        </SelectTrigger>
                        <SelectContent>
                          {bulkFyOptions.map(fy => (
                            <SelectItem key={fy.value} value={fy.value}>{fy.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-1 block">कर्ज स्थिती</Label>
                      <div className="flex gap-4 mt-2">
                        {([
                          { value: 'all', label: 'सर्व' },
                          { value: 'active', label: 'फक्त चालू' },
                          { value: 'closed', label: 'फक्त बंद' },
                        ] as const).map(opt => (
                          <div key={opt.value} className="flex items-center space-x-2">
                            <input type="radio" id={`bulk14-status-${opt.value}`} name="bulk14StatusFilter" value={opt.value} checked={bulkStatusFilter === opt.value} onChange={(e) => { const v = e.target.value as any; setBulkStatusFilter(v); if (bulkFY) handleBulkFetch(bulkFY, v); }} className="h-4 w-4" autoComplete="off" />
                            <Label htmlFor={`bulk14-status-${opt.value}`} className="text-sm cursor-pointer">{opt.label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-50 rounded">
                    • A4 landscape — प्रत्येक पानावर ४ विवरणपत्रे (2×2 grid) | गट नाव → खाते क्रमांक क्रमवारी
                  </div>

                  {isBulkLoading && (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-2" />
                      <p className="text-gray-500">डेटा लोड होत आहे...</p>
                    </div>
                  )}

                  {bulkFY && !isBulkLoading && (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
                          {bulkData.length} कर्जे
                        </span>
                        <span className="text-sm text-gray-500">
                          ({Math.ceil(bulkData.length / 4)} A4 पृष्ठे)
                        </span>
                      </div>

                      {bulkData.length > 0 && (
                        <div className="max-h-60 overflow-y-auto border rounded-lg mb-4 bg-white">
                          {bulkData.map((item: any, idx: number) => {
                            const groupName = (groups as any[]).find((g: any) => g.id === item.groupId)?.name || '';
                            return (
                              <div key={item.loanId || idx} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 hover:bg-gray-50">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 w-6 text-right">{idx + 1}</span>
                                  <div>
                                    <div className="text-sm font-medium">{item.borrowerName}</div>
                                    <div className="text-xs text-gray-500">
                                      {groupName && <span className="text-indigo-600">{groupName}</span>}
                                      {groupName && ' | '}खाते: {item.accountNumber} | मुद्दल: ₹{Math.round(item.closingPrincipal || 0).toLocaleString('en-IN')} | एकूण देय: ₹{Math.round(item.closingTotal || 0).toLocaleString('en-IN')}
                                    </div>
                                  </div>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${item.status === 'closed' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                  {item.status === 'closed' ? 'बंद' : 'चालू'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {bulkData.length === 0 && (
                        <div className="text-center py-8 text-gray-500 border rounded-lg mb-4">
                          या आर्थिक वर्षात निवडलेल्या स्थितीचे कोणतेही कर्ज नाही
                        </div>
                      )}

                      <Button
                        onClick={handleBulkPrint}
                        disabled={bulkData.length === 0 || isBulkGenerating}
                        className="w-full h-12 text-base"
                      >
                        {isBulkGenerating ? (
                          <><Loader2 className="mr-2 h-5 w-5 animate-spin" />प्रिंट तयार होत आहे...</>
                        ) : (
                          <><Printer className="mr-2 h-5 w-5" />सर्व प्रिंट करा ({bulkData.length} विवरणपत्रे)</>
                        )}
                      </Button>
                    </>
                  )}

                  {!bulkFY && (
                    <div className="text-center py-8 text-gray-500">
                      <Layers className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>बल्क प्रिंट साठी आर्थिक वर्ष निवडा</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
