import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, FileText, Receipt, Search, X, Download } from "lucide-react";
import { ReceiptGenerator } from "@/components/receipt-generator";
import { useIsMobile } from "@/hooks/use-mobile";
import jsPDF from "jspdf";

export default function ReceiptGeneratorPage() {
  const isMobile = useIsMobile();
  const [selectedLoanId, setSelectedLoanId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [receiptType, setReceiptType] = useState<'combined' | 'disbursement' | 'closure' | 'blank'>('combined');

  // Fetch loans data first
  const { data: loans = [] } = useQuery({
    queryKey: ["/api/loans"],
  });

  // Fetch company data
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  // State for inline receipt preview (mobile)
  const [inlineReceiptHTML, setInlineReceiptHTML] = React.useState<string | null>(null);
  const [showInlinePreview, setShowInlinePreview] = React.useState(false);
  const [isMobileFullPage, setIsMobileFullPage] = React.useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = React.useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = React.useState(false);

  // Check for loan ID in URL parameters (from mobile redirect)
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loanId = urlParams.get('loanId');
    const urlType = urlParams.get('type') as 'combined' | 'disbursement' | 'closure' | 'blank' || 'combined';
    const autoGenerate = urlParams.get('autoGenerate') === 'true';
    
    if (loanId && (loans as any[]).length > 0) {
      console.log("📱 Auto-selecting loan from URL:", loanId, "Type:", urlType, "AutoGenerate:", autoGenerate);
      setSelectedLoanId(loanId);
      
      if (urlType) {
        setReceiptType(urlType);
      }
      
      // Auto-generate full-page receipt for mobile users
      if (autoGenerate) {
        const selectedLoan = (loans as any[]).find((loan: any) => loan.id === loanId);
        if (selectedLoan && company) {
          console.log("🖨️ Auto-generating full-page receipt for mobile user");
          const receiptHTML = ReceiptGenerator.generateLoanReceipt(selectedLoan, company as any, urlType);
          setInlineReceiptHTML(receiptHTML);
          setShowInlinePreview(true);
          setIsMobileFullPage(true); // Mobile uses full-page view, not dialog
        }
      }
    }
  }, [loans, company]);

  // Enhanced Dual Language Search for Receipt Generator - Same as Other Forms
  const createDualLanguageQuery = (originalQuery: string) => {
    const englishToMarathi: Record<string, string> = {
      'ram': 'राम', 'shyam': 'श्याम', 'geeta': 'गीता', 'seeta': 'सीता',
      'vijay': 'विजय', 'ajay': 'अजय', 'sanjay': 'संजय', 'prakash': 'प्रकाश',
      'sunil': 'सुनील', 'anil': 'अनिल', 'vinod': 'विनोद', 'manoj': 'मनोज',
      'raju': 'राजू', 'babu': 'बाबू', 'sir': 'सर', 'ji': 'जी',
      'patel': 'पाटील', 'patil': 'पाटील', 'kumar': 'कुमार', 'devi': 'देवी',
      'laxmi': 'लक्ष्मी', 'ganga': 'गंगा', 'saraswati': 'सरस्वती',
      'rajkumar': 'राजकुमार', 'rajat': 'राजत', 'more': 'मोरे'
    };
    
    const marathiToEnglish: Record<string, string> = {
      'राम': 'ram', 'श्याम': 'shyam', 'गीता': 'geeta', 'सीता': 'seeta',
      'विजय': 'vijay', 'अजय': 'ajay', 'संजय': 'sanjay', 'प्रकाश': 'prakash',
      'सुनील': 'sunil', 'अनिल': 'anil', 'विनोद': 'vinod', 'मनोज': 'manoj',
      'राजू': 'raju', 'बाबू': 'babu', 'सर': 'sir', 'जी': 'ji',
      'पाटील': 'patel', 'कुमार': 'kumar', 'देवी': 'devi',
      'लक्ष्मी': 'laxmi', 'गंगा': 'ganga', 'सरस्वती': 'saraswati',
      'राजकुमार': 'rajkumar', 'राजत': 'rajat', 'मोरे': 'more'
    };
    
    const queries = [originalQuery];
    
    // Add English-to-Marathi translations
    Object.keys(englishToMarathi).forEach(english => {
      if (originalQuery.includes(english)) {
        queries.push(originalQuery.replace(new RegExp(english, 'g'), englishToMarathi[english]));
      }
    });
    
    // Add Marathi-to-English translations
    Object.keys(marathiToEnglish).forEach(marathi => {
      if (originalQuery.includes(marathi)) {
        queries.push(originalQuery.replace(new RegExp(marathi, 'g'), marathiToEnglish[marathi]));
      }
    });
    
    return queries;
  };

  const normalizeMarathiVowels = (text: string): string => {
    return text
      .replace(/ी/g, 'ि')
      .replace(/ू/g, 'ु')
      .replace(/ै/g, 'े')
      .replace(/ौ/g, 'ो')
      .replace(/ॅ/g, 'े')
      .replace(/ॉ/g, 'ो')
      .replace(/आ/g, 'अ')
      .replace(/ई/g, 'इ')
      .replace(/ऊ/g, 'उ')
      .replace(/ऐ/g, 'ए')
      .replace(/औ/g, 'ओ');
  };

  // Enhanced borrower name matching with dual language support + vowel normalization
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
      const queryWords = query.split(/\s+/);
      const queryWordsNorm = queryNormalized.split(/\s+/);
      
      if (queryWords.length > 1) {
        return queryWords.every((qWord, i) => {
          const qWordNorm = queryWordsNorm[i] || normalizeMarathiVowels(qWord);
          return nameWords.some((nWord, j) => {
            const nWordNorm = nameWordsNorm[j] || normalizeMarathiVowels(nWord);
            return nWord.includes(qWord) || 
              nWord.startsWith(qWord) ||
              qWord.includes(nWord) ||
              nWordNorm.includes(qWordNorm) ||
              nWordNorm.startsWith(qWordNorm);
          });
        });
      } else {
        return nameWords.some((nWord, j) => {
          const nWordNorm = nameWordsNorm[j] || normalizeMarathiVowels(nWord);
          return nWord.includes(query) || 
            nWord.startsWith(query) ||
            query.includes(nWord) ||
            nWordNorm.includes(queryNormalized) ||
            nWordNorm.startsWith(queryNormalized) ||
            queryNormalized.includes(nWordNorm) ||
            (query.length >= 2 && nWord.length >= 2 && 
             query.substring(0, 2) === nWord.substring(0, 2));
        });
      }
    });
  };

  // Filter loans based on enhanced dual language search with trim support
  const filteredLoans = (loans as any[]).filter((loan: any) => {
    if (!searchQuery.trim()) return true;
    
    const trimmedQuery = searchQuery.trim();
    return matchesBorrowerName(loan.borrowerName || "", trimmedQuery) ||
           loan.accountNumber?.toLowerCase().includes(trimmedQuery.toLowerCase());
  });

  // Get selected loan details
  const selectedLoan = filteredLoans.find((loan: any) => loan.id === selectedLoanId);

  // ✅ BUSINESS LOGIC: Check if selected loan is closed (for closure receipt validation)
  const isLoanClosed = selectedLoan && selectedLoan.status === 'closed';
  const canGenerateClosureReceipt = isLoanClosed;

  // ✅ AUTO-RESET: If closure receipt is selected but loan becomes unavailable/unclosed, reset to combined
  React.useEffect(() => {
    if (receiptType === 'closure' && !canGenerateClosureReceipt) {
      console.log("🔄 Auto-resetting receipt type from closure to combined - loan not closed");
      setReceiptType('combined');
    }
  }, [receiptType, canGenerateClosureReceipt]);

  const downloadReceiptAsPDF = async () => {
    console.log("📥 Generating high-quality PDF for download...");
    try {
      const receiptDiv = document.getElementById('receipt-content');
      if (!receiptDiv) {
        alert("पावती सापडली नाही");
        return;
      }
      
      // Add export-mode class to inner receipt-container for fixed A5 dimensions with equal receipt heights
      const receiptContainer = receiptDiv.querySelector('.receipt-container') as HTMLElement;
      if (!receiptContainer) {
        alert("पावती container सापडले नाही");
        return;
      }
      
      receiptContainer.classList.add('export-mode');
      
      // Wait for layout to recalculate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { default: html2canvas } = await import('html2canvas');
      
      const a5WidthPx = 560;
      const a5HeightPx = 794;
      const origWidth = receiptContainer.style.width;
      const origMinWidth = receiptContainer.style.minWidth;
      const origMaxWidth = receiptContainer.style.maxWidth;
      const origMinHeight = receiptContainer.style.minHeight;
      receiptContainer.style.width = a5WidthPx + 'px';
      receiptContainer.style.minWidth = a5WidthPx + 'px';
      receiptContainer.style.maxWidth = a5WidthPx + 'px';
      receiptContainer.style.minHeight = a5HeightPx + 'px';

      const canvas = await html2canvas(receiptContainer, {
        scale: 4,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 0,
        removeContainer: true,
        width: a5WidthPx,
        height: a5HeightPx,
        windowWidth: a5WidthPx,
        windowHeight: a5HeightPx,
      });
      
      receiptContainer.classList.remove('export-mode');
      receiptContainer.style.width = origWidth;
      receiptContainer.style.minWidth = origMinWidth;
      receiptContainer.style.maxWidth = origMaxWidth;
      receiptContainer.style.minHeight = origMinHeight;
      
      const imgData = canvas.toDataURL('image/png');
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5',
        compress: false
      });
      
      const a5Width = 148;
      const a5Height = 210;
      
      doc.addImage(imgData, 'PNG', 0, 0, a5Width, a5Height);
      
      const selectedLoan = (loans as any[]).find((l: any) => l.id === selectedLoanId);
      const fileName = selectedLoan 
        ? `पावती_${selectedLoan.borrowerName}.pdf`
        : `पावती.pdf`;
      
      doc.save(fileName);
      console.log("✅ High-quality PDF downloaded successfully:", fileName);
    } catch (error) {
      console.error("🚨 PDF generation error:", error);
      alert("PDF तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
  };

  const downloadReceiptAsImage = async () => {
    console.log("📥 Generating A5 image for direct download...");
    try {
      const receiptDiv = document.getElementById('receipt-content');
      if (!receiptDiv) {
        alert("पावती सापडली नाही");
        return;
      }
      
      // Add export-mode class to inner receipt-container for fixed A5 dimensions with equal receipt heights
      const receiptContainer = receiptDiv.querySelector('.receipt-container') as HTMLElement;
      if (!receiptContainer) {
        alert("पावती container सापडले नाही");
        return;
      }
      
      receiptContainer.classList.add('export-mode');
      
      // Wait for layout to recalculate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { default: html2canvas } = await import('html2canvas');
      
      const a5WidthPx = 560;
      const a5HeightPx = 794;
      const origWidth = receiptContainer.style.width;
      const origMinWidth = receiptContainer.style.minWidth;
      const origMaxWidth = receiptContainer.style.maxWidth;
      const origMinHeight = receiptContainer.style.minHeight;
      receiptContainer.style.width = a5WidthPx + 'px';
      receiptContainer.style.minWidth = a5WidthPx + 'px';
      receiptContainer.style.maxWidth = a5WidthPx + 'px';
      receiptContainer.style.minHeight = a5HeightPx + 'px';

      const canvas = await html2canvas(receiptContainer, {
        scale: 4,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 0,
        removeContainer: true,
        width: a5WidthPx,
        height: a5HeightPx,
        windowWidth: a5WidthPx,
        windowHeight: a5HeightPx,
      });
      
      receiptContainer.classList.remove('export-mode');
      receiptContainer.style.width = origWidth;
      receiptContainer.style.minWidth = origMinWidth;
      receiptContainer.style.maxWidth = origMaxWidth;
      receiptContainer.style.minHeight = origMinHeight;
      
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
      
      const selectedLoan = (loans as any[]).find((l: any) => l.id === selectedLoanId);
      link.download = selectedLoan 
        ? `पावती_${selectedLoan.borrowerName}.png`
        : `पावती.png`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log("✅ A5 Image downloaded successfully");
    } catch (error) {
      console.error("🚨 Image generation error:", error);
      alert("इमेज तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
  };

  // Mobile Full-Page Receipt View - renders receipt directly with share/download support
  if (isMobileFullPage && showInlinePreview && inlineReceiptHTML) {
    // Show generated image view
    if (generatedImageUrl) {
      const selectedLoan = (loans as any[]).find((l: any) => l.id === selectedLoanId);
      const fileName = selectedLoan 
        ? `पावती_${selectedLoan.borrowerName}.png`
        : `पावती.png`;
      
      return (
        <div className="min-h-screen bg-gray-100">
          <div className="sticky top-0 z-50 bg-indigo-50 border-b px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                <Download className="h-5 w-5" />
                इमेज तयार झाली ✅
              </div>
              <Button 
                size="sm"
                variant="outline"
                onClick={() => {
                  setGeneratedImageUrl(null);
                }}
              >
                <X className="mr-1 h-4 w-4" />
                मागे जा
              </Button>
            </div>
            
            {/* Download Link */}
            <a
              href={generatedImageUrl}
              download={fileName}
              className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium h-12 px-4 bg-green-600 hover:bg-green-700 text-white mb-2"
            >
              <Download className="mr-2 h-5 w-5" />
              इमेज डाउनलोड करा
            </a>
            
            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-2 text-center">
              <p className="text-yellow-800 text-xs">
                वरील बटण काम नाही केले तर: इमेज वर लाँग-प्रेस करा → "Save Image" निवडा
              </p>
            </div>
          </div>
          <div className="p-4">
            <img 
              src={generatedImageUrl} 
              alt="पावती" 
              className="w-full border rounded-lg shadow-lg"
              style={{ maxWidth: '100%' }}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white">
        {/* Sticky Header with Share/Download/Close buttons - hidden when printing */}
        <div className="sticky top-0 z-50 bg-green-50 border-b px-3 py-3 print:hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <Receipt className="h-5 w-5" />
              पावती तयार
            </div>
            <Button 
              size="sm"
              variant="outline"
              onClick={() => {
                setShowInlinePreview(false);
                setInlineReceiptHTML(null);
                setIsMobileFullPage(false);
                setGeneratedImageUrl(null);
                window.history.replaceState({}, '', '/reports/receipt-generator');
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
        
        {/* Receipt Content - rendered directly with id for image capture */}
        <div 
          id="receipt-content"
          className="p-2 bg-white overflow-x-auto"
          style={{ 
            maxWidth: '100%',
            fontSize: '11px',
            lineHeight: '1.4'
          }}
          dangerouslySetInnerHTML={{ __html: inlineReceiptHTML }}
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

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0 screen-only">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-foreground heading-professional">पावती जनरेशन</h1>
              <p className="text-muted-foreground">नमुना क्रमांक १०/११ - कर्ज पावती तयार करा</p>
            </div>

            {/* Desktop Full-Page Receipt Preview - keeps sidebar visible */}
            {showInlinePreview && !!inlineReceiptHTML && !isMobileFullPage && (
              <div className="fixed top-0 right-0 bottom-0 left-0 lg:left-64 z-40 bg-gray-100 flex flex-col">
                {/* Header with buttons */}
                <div className="bg-green-50 px-6 py-4 border-b shadow-sm flex items-center justify-between">
                  <h2 className="text-green-700 font-semibold text-lg flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    पावती तयार
                  </h2>
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => {
                        // Open receipt in new window for printing
                        const printWindow = window.open('', '_blank');
                        if (printWindow && inlineReceiptHTML) {
                          printWindow.document.write(inlineReceiptHTML);
                          printWindow.document.close();
                          setTimeout(() => {
                            printWindow.focus();
                            printWindow.print();
                          }, 300);
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      प्रिंट करा
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setShowInlinePreview(false);
                        setInlineReceiptHTML(null);
                        window.history.replaceState({}, '', '/reports/receipt-generator');
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      बंद करा
                    </Button>
                  </div>
                </div>
                {/* Full receipt view - single scroll like mobile */}
                <div 
                  className="flex-1 bg-white overflow-y-auto"
                  dangerouslySetInnerHTML={{ 
                    __html: inlineReceiptHTML ? inlineReceiptHTML.replace(
                      '</style>',
                      `
                      @page { size: A5; margin: 0; }
                      html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                      }
                      .receipt-container {
                        width: 100% !important;
                        max-width: 700px !important;
                        margin: 0 auto !important;
                        padding: 30px !important;
                        box-sizing: border-box !important;
                        box-shadow: none !important;
                        border: none !important;
                      }
                      </style>`
                    ).replace(/<\/?html[^>]*>|<\/?head[^>]*>|<\/?body[^>]*>|<!DOCTYPE[^>]*>/gi, '') : ''
                  }}
                />
              </div>
            )}

            {/* Borrower Selection */}
            <Card className="mb-6 card-professional">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 heading-professional">
                  <Receipt className="h-5 w-5" />
                  कर्जदार निवडा
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <Label className="text-sm font-semibold">
                      कर्जदाराचे नाव निवडा
                    </Label>
                    <div className="space-y-2">
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="कर्जदार शोधा... (raju, राजू, patel, kumar...)"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                          autoFocus
                        />
                      </div>
                      
                      {/* Dropdown */}
                      <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="कर्जदार निवडा..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {filteredLoans.map((loan: any) => (
                            <SelectItem key={loan.id} value={loan.id}>
                              {loan.borrowerName} - खाते क्र. {loan.accountNumber}
                            </SelectItem>
                          ))}
                          {filteredLoans.length === 0 && searchQuery && (
                            <div className="p-2 text-sm text-gray-500 text-center">
                              कोणतेही कर्जदार सापडले नाही
                            </div>
                          )}
                          {filteredLoans.length === 0 && !searchQuery && (
                            <div className="p-2 text-sm text-gray-500 text-center">
                              वरील search box मध्ये टाइप करा
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      
                      {/* ✅ CLEAR SELECTION: Show clear button when loan is selected */}
                      {selectedLoanId && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setSelectedLoanId("");
                            setSearchQuery("");
                          }}
                          className="mt-2 text-xs w-full"
                          data-testid="button-clear-selection"
                        >
                          🗑️ निवड मिटवा (मोकळी पावती साठी)
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className={showInlinePreview ? "hidden" : ""}>
                    <Button 
                      onClick={async () => {
                        // ✅ BLANK RECEIPT: No need for selected loan
                        if (receiptType === 'blank' || selectedLoan) {
                          try {
                            console.log("📄 Generate button clicked for:", receiptType === 'blank' ? 'Blank Receipt' : selectedLoan.borrowerName, "Type:", receiptType);
                            console.log("📄 Company data:", company);
                            
                            // ✅ BLANK RECEIPT: Use dummy loan data for template structure  
                            const loanForTemplate = selectedLoan || {
                              id: 'blank',
                              borrowerName: '',
                              borrowerAddress: '',
                              principalAmount: 0,
                              interestRate: 0,
                              loanDate: new Date().toISOString(),
                              businessType: '',
                              accountNumber: '',
                              collateralDetails: '',
                              maturityDate: null
                            };
                            
                            // ✅ ENHANCED VALIDATION: Double-check loan status for closure receipts
                            if (receiptType === 'closure' && selectedLoan) {
                              if (selectedLoan.status !== 'closed') {
                                alert("🚫 हे कर्ज अजून बंद नाही! कृपया पहिले कर्ज बंद करा आणि नंतर क्लोजर पावती काढा.");
                                return;
                              }
                            }

                            // ✅ FETCH CLOSURE DATA: When receipt type is closure, get closure details
                            let closureData = null;
                            if (receiptType === 'closure' && selectedLoan) {
                              console.log("💰 Fetching closure data for loan:", selectedLoan.id);
                              try {
                                const response = await fetch(`/api/loan-closures?loanId=${selectedLoan.id}`, {
                                  credentials: 'include'
                                });
                                if (response.ok) {
                                  const closureResults = await response.json();
                                  if (closureResults && closureResults.length > 0) {
                                    // ✅ CRITICAL FIX: Validate closure data belongs to selected loan
                                    const validClosures = closureResults.filter((closure: any) => 
                                      closure.loanId === selectedLoan.id && closure.isClosed === true
                                    );
                                    
                                    if (validClosures.length > 0) {
                                      // Get latest closure record by closureDate 
                                      closureData = validClosures.sort((a: any, b: any) => 
                                        new Date(b.closureDate).getTime() - new Date(a.closureDate).getTime()
                                      )[0];
                                      
                                      console.log("✅ Valid closure data found:", {
                                        closureLoanId: closureData.loanId,
                                        selectedLoanId: selectedLoan.id,
                                        amounts: {
                                          principal: closureData.principalPaid,
                                          interest: closureData.interestPaid,
                                          total: closureData.totalAmount
                                        }
                                      });
                                    } else {
                                      console.warn("⚠️ No valid closure data found for this specific loan");
                                      alert("🚫 या विशिष्ट कर्जासाठी क्लोजर डेटा उपलब्ध नाही! कृपया पहिले कर्ज बंद करा.");
                                      return;
                                    }
                                  } else {
                                    console.warn("⚠️ No closure data found for loan");
                                    alert("🚫 या कर्जासाठी क्लोजर डेटा उपलब्ध नाही! कृपया पहिले कर्ज बंद करा.");
                                    return;
                                  }
                                } else {
                                  throw new Error("Failed to fetch closure data");
                                }
                              } catch (fetchError) {
                                console.error("🚨 Error fetching closure data:", fetchError);
                                alert("क्लोजर डेटा आणण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
                                return;
                              }
                            }
                            
                            // Generate receipt HTML and show in appropriate view
                            const receiptHTML = ReceiptGenerator.generateLoanReceipt(loanForTemplate, company as any, receiptType, closureData);
                            setInlineReceiptHTML(receiptHTML);
                            setShowInlinePreview(true);
                            
                            if (isMobile) {
                              // Mobile: Use full-page view for native print support
                              console.log("📱 Mobile: Opening full-page receipt view");
                              setIsMobileFullPage(true);
                              console.log("✅ Mobile full-page view opened with native print support");
                            } else {
                              // Desktop: Use Dialog with print button
                              console.log("🖥️ Desktop: Opening receipt dialog with print button");
                              setIsMobileFullPage(false);
                              console.log("✅ Desktop dialog opened with print support");
                            }
                          } catch (error) {
                            console.error("🚨 Generate error:", error);
                            alert("पावती तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
                          }
                        }
                      }} 
                      disabled={receiptType !== 'blank' && !selectedLoanId}
                      className="btn-professional btn-primary"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      पावती तयार करा
                    </Button>
                  </div>
                </div>
                
                {/* ✅ RECEIPT TYPE OPTIONS - 4 Radio Buttons */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <Label className="text-sm font-semibold mb-3 block">पावती प्रकार निवडा</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="combined"
                        name="receiptType"
                        value="combined"
                        checked={receiptType === 'combined'}
                        onChange={(e) => setReceiptType(e.target.value as any)}
                        className="h-4 w-4"
                        data-testid="radio-combined"
                        autoComplete="off"
                      />
                      <Label htmlFor="combined" className="text-sm font-medium cursor-pointer">
                        संयुक्त पावती (डिफॉल्ट) - दोन्ही पावत्या
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="disbursement"
                        name="receiptType" 
                        value="disbursement"
                        checked={receiptType === 'disbursement'}
                        onChange={(e) => setReceiptType(e.target.value as any)}
                        className="h-4 w-4"
                        data-testid="radio-disbursement"
                        autoComplete="off"
                      />
                      <Label htmlFor="disbursement" className="text-sm font-medium cursor-pointer">
                        फक्त कर्ज दिलेली - नमुना नं. १०
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="closure"
                        name="receiptType"
                        value="closure" 
                        checked={receiptType === 'closure'}
                        onChange={(e) => setReceiptType(e.target.value as any)}
                        className="h-4 w-4"
                        data-testid="radio-closure"
                        disabled={!canGenerateClosureReceipt}
                        autoComplete="off"
                      />
                      <Label 
                        htmlFor="closure" 
                        className={`text-sm font-medium ${canGenerateClosureReceipt ? 'cursor-pointer' : 'cursor-not-allowed text-gray-400'}`}
                      >
                        फक्त कर्ज क्लोजिंग - नमुना नं. ११ (रकमेसह)
                        {!canGenerateClosureReceipt && selectedLoan && (
                          <span className="text-xs text-red-500 block">
                            (हे कर्ज अजून बंद नाही)
                          </span>
                        )}
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="blank"
                        name="receiptType"
                        value="blank"
                        checked={receiptType === 'blank'}
                        onChange={(e) => setReceiptType(e.target.value as any)}
                        className="h-4 w-4" 
                        data-testid="radio-blank"
                        autoComplete="off"
                      />
                      <Label htmlFor="blank" className="text-sm font-medium cursor-pointer">
                        मोकळी पावती - हातानेे लिहिण्यासाठी
                      </Label>
                    </div>
                    
                  </div>
                  
                  {/* ✅ PROFESSIONAL POPUP APPROACH: Helper text */}
                  <div className="mt-3 text-xs text-gray-600">
                    {receiptType === 'combined' && "• दोन्ही पावत्या एकत्र professional popup window मध्ये उघडतील"}
                    {receiptType === 'disbursement' && "• फक्त कर्ज देण्याची पावती (नमुना नं. १०) popup window मध्ये उघडेल"}
                    {receiptType === 'closure' && "• फक्त कर्ज बंद करण्याची पावती (नमुना नं. ११) मुद्दल, व्याज व एकूण रकमेसह popup मध्ये उघडेल"}
                    {!canGenerateClosureReceipt && selectedLoan && selectedLoan.status !== 'closed' && (
                      <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                        ⚠️ कर्ज क्लोजिंग पावती फक्त बंद केलेल्या कर्जासाठी उपलब्ध आहे। पहिले कर्ज बंद करा.
                      </div>
                    )}
                    {receiptType === 'blank' && "• दोन्ही पावत्या मोकळ्या (बिना डेटा) popup window मध्ये उघडतील - हस्तलेखनासाठी"}
                    <div className="mt-2 text-xs text-green-600 bg-green-50 p-2 rounded">
                      ✨ Professional Approach: Clean popup window - कोणतेही dual scroll bars नाहीत!
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>



            {/* No Selection Message */}
            {!selectedLoanId && (
              <Card className="card-professional">
                <CardContent className="text-center py-12">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">कर्जदार निवडा</h3>
                  <p className="text-muted-foreground">
                    पावती तयार करण्यासाठी वरील ड्रॉपडाउनमधून कर्जदार निवडा
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}