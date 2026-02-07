import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, CheckCircle, X, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { ReceiptGenerator } from "@/components/receipt-generator";
import { Badge } from "@/components/ui/badge";
import { DateUtils } from "@/lib/date-utils";
import { useIsMobile } from "@/hooks/use-mobile";

export default function AnnualStatementPage() {
  const isMobile = useIsMobile();
  const [selectedBorrower, setSelectedBorrower] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [statementData, setStatementData] = useState<any>(null);
  const [showDesktopPreview, setShowDesktopPreview] = useState(false);
  const [receiptHTML, setReceiptHTML] = useState<string | null>(null);

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

  // Generate financial years (current year and past 5 years)
  const currentYear = new Date().getFullYear();
  const financialYears = [];
  for (let i = 0; i < 6; i++) {
    const year = currentYear - i;
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
      
      // On desktop, show full-page preview
      if (!isMobile) {
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
                <div className="bg-blue-50 px-6 py-4 border-b shadow-sm flex items-center justify-between">
                  <h2 className="text-blue-700 font-semibold text-lg flex items-center gap-2">
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

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">
                  वार्षिक लेखा विवरणपत्र - नमुना क्रमांक १४
                </CardTitle>
                <p className="text-sm text-gray-600">
                  वर्ष संपल्यानंतर ४५ दिवसांच्या आत सावकाराने कर्जदारास द्यावयाचे वार्षिक लेखा विवरणपत्र
                </p>
              </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Borrower Selection */}
                <div className="space-y-2">
                  <Label htmlFor="borrower-select">कर्जदाराचे नाव निवडा *</Label>
                  <Select value={selectedBorrower} onValueChange={setSelectedBorrower}>
                    <SelectTrigger id="borrower-select" data-testid="select-borrower">
                      <SelectValue placeholder="कर्जदार निवडा..." />
                    </SelectTrigger>
                    <SelectContent>
                      {borrowerNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Year Selection */}
                <div className="space-y-2">
                  <Label htmlFor="year-select">आर्थिक वर्ष निवडा *</Label>
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
                  <Label className="text-base font-semibold">कर्ज निवडा * ({filteredLoans.length} कर्जे आढळली - निवडलेल्या वर्षापर्यंतची)</Label>
                  <Card className="border-2 border-blue-300 max-h-64 overflow-y-auto">
                    <CardContent className="p-0">
                      {filteredLoans.map((loan: any) => (
                        <div
                          key={loan.id}
                          className={`p-4 border-b last:border-b-0 cursor-pointer transition-all ${
                            selectedLoan?.id === loan.id 
                              ? 'bg-blue-100 border-l-4 border-l-blue-600 shadow-md' 
                              : 'hover:bg-gray-50 hover:border-l-2 hover:border-l-blue-300'
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
                                <div className={`font-semibold ${selectedLoan?.id === loan.id ? 'text-blue-900' : 'text-blue-800'}`}>
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
                              {loan.collateralDetails && (
                                <div className="text-sm text-purple-700 mt-1">
                                  वस्तू: {loan.collateralDetails} {loan.weight && `| वजन: ${loan.weight}`}
                                </div>
                              )}
                            </div>
                            {selectedLoan?.id === loan.id && (
                              <Badge variant="default" className="ml-2 bg-blue-600">
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
                
                {statementData && (
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
              </div>

              {/* Display Statement Data */}
              {statementData && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">विवरणपत्र माहिती</h3>
                  
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
                    <h4 className="font-semibold mb-2">आर्थिक तपशील (₹):</h4>
                    <table className="w-full text-sm border">
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2">वर्षाच्या सुरुवातीस देय (मूळ + व्याज)</td>
                          <td className="p-2 text-right font-medium">
                            ₹{statementData.openingTotal?.toLocaleString('en-IN')}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2">वर्ष भरात दिलेलें एकूण कर्ज</td>
                          <td className="p-2 text-right font-medium">
                            ₹{statementData.yearDisbursement?.toLocaleString('en-IN')}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2">वर्ष भरात प्राप्त परतफेड (मूळ)</td>
                          <td className="p-2 text-right font-medium">
                            ₹{statementData.yearPrincipalRepayment?.toLocaleString('en-IN')}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2">वर्ष भरात प्राप्त परतफेड (व्याज)</td>
                          <td className="p-2 text-right font-medium">
                            ₹{statementData.yearInterestRepayment?.toLocaleString('en-IN')}
                          </td>
                        </tr>
                        <tr className="border-b bg-gray-50">
                          <td className="p-2 font-semibold">वर्ष अखेरीस देय (मूळ)</td>
                          <td className="p-2 text-right font-semibold">
                            ₹{statementData.closingPrincipal?.toLocaleString('en-IN')}
                          </td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="p-2 font-semibold">वर्ष अखेरीस देय (व्याज)</td>
                          <td className="p-2 text-right font-semibold">
                            ₹{statementData.closingInterest?.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
