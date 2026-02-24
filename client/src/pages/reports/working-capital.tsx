import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Printer } from "lucide-react";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";

export default function WorkingCapital() {
  const { safeNavigate } = useSafeNavigation();
  const [dateFilters, setDateFilters] = useState({
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  const [filteredData, setFilteredData] = useState<any>(null);

  // Fetch company data
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  // Fetch cash transactions
  const { data: cashTransactions = [] } = useQuery({
    queryKey: ["/api/cash-transactions"],
  });

  // Fetch loans data
  const { data: loans = [] } = useQuery({
    queryKey: ["/api/loans"],
  });

  const handleSearch = () => {
    // Filter transactions by date range
    const fromDate = new Date(dateFilters.dateFrom);
    const toDate = new Date(dateFilters.dateTo);
    
    // Filter cash transactions
    const filteredCashTransactions = (cashTransactions as any[]).filter((transaction: any) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= fromDate && transactionDate <= toDate;
    });

    // Filter loan transactions  
    const filteredLoans = (loans as any[]).filter((loan: any) => {
      const loanDate = new Date(loan.createdAt || loan.date);
      return loanDate >= fromDate && loanDate <= toDate;
    });

    // Calculate daily capital account entries with page numbering
    const dailyEntries = new Map();
    let runningBalance = 0;
    let pageNumber = 1;
    
    // Get financial year start (April 1st of current or previous year)
    const getFinancialYearStart = (date: Date) => {
      const year = date.getFullYear();
      const financialYearStart = new Date(year, 3, 1); // April 1st
      if (date < financialYearStart) {
        return new Date(year - 1, 3, 1); // Previous year's April 1st
      }
      return financialYearStart;
    };

    // Professional accounting - consistent opening balance (starts at 0)
    // Previous calculation commented out - professional accounting starts fresh
    // (loans as any[]).forEach((loan: any) => {
    //   const loanDate = new Date(loan.createdAt || loan.date);
    //   if (loanDate < fromDate) {
    //     runningBalance += loan.amount || 0; // Disbursed amount
    //     if (loan.status === 'closed' && loan.repaidAmount) {
    //       runningBalance -= loan.amount || 0; // Only principal amount for closed loans
    //     }
    //   }
    // });
    
    // Professional accounting standard - all reports start with consistent 0 balance
    runningBalance = 0;

    // Get all loan transactions for page numbering
    const allTransactions: any[] = [];
    
    // Add disbursements
    (loans as any[]).forEach((loan: any) => {
      const loanDate = new Date(loan.createdAt || loan.date);
      if (loanDate >= fromDate && loanDate <= toDate) {
        allTransactions.push({
          date: loanDate,
          type: 'disbursement',
          loan: loan
        });
      }
    });
    
    // Add closures
    (loans as any[]).forEach((loan: any) => {
      if (loan.status === 'closed' && loan.closedAt) {
        const closeDate = new Date(loan.closedAt);
        if (closeDate >= fromDate && closeDate <= toDate) {
          allTransactions.push({
            date: closeDate,
            type: 'closure', 
            loan: loan
          });
        }
      }
    });

    // Sort all transactions by date
    allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Assign page numbers based on financial year and date sequence
    const pageMap = new Map();
    let currentPage = 1;
    let lastTransactionDate: Date | null = null;
    
    allTransactions.forEach(transaction => {
      const transactionDate = transaction.date;
      const financialYearStart = getFinancialYearStart(transactionDate);
      
      // Reset page number at financial year start
      if (lastTransactionDate && transactionDate >= new Date(financialYearStart.getFullYear() + 1, 3, 1)) {
        currentPage = 1;
      }
      
      // If different date, increment page number
      if (lastTransactionDate && transactionDate.toDateString() !== lastTransactionDate.toDateString()) {
        currentPage++;
      }
      
      pageMap.set(transactionDate.toDateString(), currentPage);
      lastTransactionDate = transactionDate;
    });

    // Process transactions and create daily entries
    allTransactions.forEach(transaction => {
      const dayKey = transaction.date.toDateString();
      const pageNum = pageMap.get(dayKey) || 1;
      
      if (!dailyEntries.has(dayKey)) {
        dailyEntries.set(dayKey, {
          date: transaction.date,
          totalDisbursed: 0,
          totalRepaid: 0,
          pageNumber: pageNum,
          loanNumbers: [],
          entries: []
        });
      }
      
      const dayData = dailyEntries.get(dayKey);
      
      if (transaction.type === 'disbursement') {
        // Add disbursement entry
        dayData.totalDisbursed += transaction.loan.amount || 0;
        runningBalance += transaction.loan.amount || 0;
        dayData.loanNumbers.push(transaction.loan.loanNumber || `LOAN${transaction.loan.id}`);
        
      } else if (transaction.type === 'closure') {
        // Add repayment entry (only principal)
        const principalAmount = transaction.loan.amount || 0;
        dayData.totalRepaid += principalAmount;
        runningBalance -= principalAmount;
        dayData.loanNumbers.push(transaction.loan.loanNumber || `LOAN${transaction.loan.id}`);
      }
      
      // Update balance for this day
      dayData.balance = runningBalance;
    });

    // Convert to sorted array
    const sortedEntries = Array.from(dailyEntries.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const capitalEntries: any[] = [];

    // Add opening balance if exists
    if (runningBalance !== 0) {
      const openingBalance = runningBalance - sortedEntries.reduce((sum, day) => 
        sum + day.totalDisbursed - day.totalRepaid, 0);
      
      if (openingBalance !== 0) {
        capitalEntries.push({
          date: dateFilters.dateFrom,
          description: "मागील शिल्लक",
          type: "opening",
          totalDisbursed: 0,
          totalRepaid: 0,
          balance: openingBalance
        });
      }
    }

    // Add daily entries to capital entries
    sortedEntries.forEach(dayData => {
      capitalEntries.push({
        date: dayData.date.toLocaleDateString('en-GB'),
        description: `दैनिक नोंदी - ${dayData.date.toLocaleDateString('hi-IN')}`,
        type: "daily",
        totalDisbursed: dayData.totalDisbursed,
        totalRepaid: dayData.totalRepaid,
        balance: dayData.balance,
        pageNumber: dayData.pageNumber,
        loanNumbers: dayData.loanNumbers
      });
    });

    setFilteredData({
      entries: capitalEntries,
      closingBalance: runningBalance,
      openingBalance: runningBalance - sortedEntries.reduce((sum, day) => 
        sum + day.totalDisbursed - day.totalRepaid, 0)
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('hi-IN').format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <div className="sidebar-modern h-full">
            <Sidebar />
          </div>
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            {/* Mobile Header */}
            <div className="lg:hidden mb-4">
        <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-gray-200 rounded-lg">
          <h1 className="text-lg font-semibold">भांडवल खाते</h1>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => window.history.back()}
          >
            ← परत
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        
        {/* Screen Controls */}
        <Card className="print:hidden mb-6">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">भांडवल खाते अहवाल</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="dateFrom">सुरुवातीची तारीख</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFilters.dateFrom}
                  onChange={(e) => setDateFilters({ ...dateFilters, dateFrom: e.target.value })}
                  className="font-inter"
                />
              </div>
              <div>
                <Label htmlFor="dateTo">शेवटची तारीख</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateFilters.dateTo}
                  onChange={(e) => setDateFilters({ ...dateFilters, dateTo: e.target.value })}
                  className="font-inter"
                />
              </div>
              <Button onClick={handleSearch} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Search className="mr-2 h-4 w-4" />
                शोधा
              </Button>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handlePrint} variant="outline">
                <Printer className="mr-2 h-4 w-4" />
                प्रिंट करा
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Capital Account Report */}
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="text-center print:pb-2">
            <CardTitle className="text-xl md:text-2xl print:mb-1">{(company as any)?.name || 'कंपनीचे नाव'}</CardTitle>
            <p className="text-gray-600 print:mb-1">भांडवल खाते अहवाल (नमुना क्रमांक १३)</p>
            <p className="text-sm text-gray-500 print:mb-2">
              कालावधी: {new Date(dateFilters.dateFrom).toLocaleDateString('en-GB')} ते {new Date(dateFilters.dateTo).toLocaleDateString('en-GB')}
            </p>
          </CardHeader>
          <CardContent className="print:p-0">
            
            {/* Capital Account Table */}
            <div className="w-full border-2 border-gray-800">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-20" />
                  <col className="w-24" />
                  <col className="w-32" />
                  <col className="w-24" />
                  <col className="w-32" />
                  <col className="w-32" />
                </colgroup>
                
                {/* Headers */}
                <thead>
                  <tr className="bg-indigo-500 text-white">
                    <th className="text-center py-3 px-2 border-r border-white font-bold text-xs md:text-sm md:py-4 md:px-3">दिनांक</th>
                    <th className="text-center py-3 px-2 border-r border-white font-bold text-xs md:text-sm md:py-4 md:px-3">कर्ज संख्या</th>
                    <th className="text-center py-3 px-2 border-r border-white font-bold text-xs md:text-sm md:py-4 md:px-3">कर्जाच्या रकमेची एकूण परतफेड</th>
                    <th className="text-center py-3 px-2 border-r border-white font-bold text-xs md:text-sm md:py-4 md:px-3">रोकड वहीतील पान क्रमांक</th>
                    <th className="text-center py-3 px-2 border-r border-white font-bold text-xs md:text-sm md:py-4 md:px-3">कर्ज वाटपाची एकूण रक्कम</th>
                    <th className="text-center py-3 px-2 font-bold text-xs md:text-sm md:py-4 md:px-3">व्यवसायात अडकलेली निव्वळ जिल्हक रक्कम</th>
                  </tr>
                </thead>
                
                <tbody>
                  {filteredData ? (
                    <>
                      {filteredData.entries.map((entry: any, index: number) => (
                        <tr key={index} className="border-t border-gray-200">
                          <td className="p-2 md:p-3 text-xs md:text-sm font-medium border-r border-gray-300 text-center text-indigo-600">
                            {entry.date}
                          </td>
                          <td className="p-2 md:p-3 text-xs md:text-sm font-medium border-r border-gray-300 text-center">
                            {entry.type === 'daily' && entry.loanNumbers ? 
                              entry.loanNumbers.join(', ') : 
                              '-'
                            }
                          </td>
                          <td className="p-2 md:p-3 text-xs md:text-sm text-right font-medium border-r border-gray-300">
                            {entry.totalRepaid > 0 ? (
                              <span className="text-red-600">₹{formatAmount(entry.totalRepaid)}</span>
                            ) : '-'}
                          </td>
                          <td className="p-2 md:p-3 text-xs md:text-sm border-r border-gray-300 text-center">
                            {entry.pageNumber ? `पान-${entry.pageNumber}` : 'पान-1'}
                          </td>
                          <td className="p-2 md:p-3 text-xs md:text-sm text-right font-medium border-r border-gray-300">
                            {entry.totalDisbursed > 0 ? (
                              <span className="text-red-600">₹{formatAmount(entry.totalDisbursed)}</span>
                            ) : '-'}
                          </td>
                          <td className="p-2 md:p-3 text-xs md:text-sm text-right font-medium">
                            <span className="text-red-600">₹{formatAmount(Math.abs(entry.balance))}</span>
                          </td>
                        </tr>
                      ))}

                    </>
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-500">
                        कृपया तारीख निवडा आणि शोधा दाबा
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Double Underline - Statement End */}
            <div className="mt-4 border-b-4 border-double border-gray-800 w-full"></div>

            {/* Closing Balance Summary - Screen Only */}
            {filteredData && (
              <div className="mt-6 flex justify-center print:hidden">
                <div className="p-4 md:p-6 border-2 rounded-lg border-indigo-500 bg-indigo-50">
                  <div className="text-center">
                    <p className="text-sm md:text-base font-medium text-gray-600">शेवटची भांडवल शिल्लक</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      ₹{formatAmount(Math.abs(filteredData.closingBalance))}
                    </p>
                    <p className="text-sm text-indigo-600">
                      {filteredData.closingBalance >= 0 ? '(जमा शिल्लक)' : '(नावे शिल्लक)'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-500">
                अहवाल तयार केला: {new Date().toLocaleDateString('hi-IN')} रोजी
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-50">
        <div className="flex justify-around">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center px-2 py-1 h-auto"
            onClick={() => safeNavigate('/')}
          >
            <span className="text-xs">मुख्य</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center px-2 py-1 h-auto"
            onClick={() => safeNavigate('/loans')}
          >
            <span className="text-xs">कर्ज</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center px-2 py-1 h-auto text-indigo-600"
          >
            <span className="text-xs">अहवाल</span>
          </Button>
        </div>
      </nav>

      {/* Print Styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          
          /* Remove all margins and padding */
          * { margin: 0 !important; padding: 0 !important; }
          html, body { margin: 0 !important; padding: 0 !important; height: auto !important; }
          
          /* Fit to page */
          @page {
            size: A4;
            margin: 5mm !important;
          }
          
          /* Container adjustments */
          .min-h-screen { 
            min-height: auto !important; 
            padding: 5mm !important;
          }
          
          /* Remove screen elements */
          nav, .print\\:hidden { display: none !important; }
          
          /* Header adjustments */
          .text-xl { font-size: 16px !important; font-weight: bold !important; }
          .text-gray-600 { font-size: 12px !important; }
          .text-sm.text-gray-500 { font-size: 10px !important; }
          
          /* Table optimization for A4 */
          table { 
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: avoid !important;
            margin: 0 !important;
          }
          
          /* Enhanced cell styling */
          td, th {
            border: 1.5px solid #000 !important;
            padding: 4px 6px !important;
            font-size: 9px !important;
            line-height: 1.2 !important;
            vertical-align: top !important;
          }
          
          /* Header cells */
          th {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
            font-size: 10px !important;
            padding: 6px !important;
          }
          
          /* Font size optimizations */
          .text-xs { font-size: 8px !important; }
          .text-sm { font-size: 8px !important; }
          .text-lg { font-size: 12px !important; }
          
          /* Column width optimization */
          .w-20 { width: 60px !important; }
          .w-24 { width: 80px !important; }
          .w-28 { width: 90px !important; }
          .w-auto { width: auto !important; }
          
          /* Enhanced borders */
          .border-2.border-gray-800 { border: 2px solid #000 !important; }
          .border-r-2.border-gray-800 { border-right: 2px solid #000 !important; }
          .border-t-2.border-gray-800 { border-top: 2px solid #000 !important; }
          
          /* Background preservation */
          .bg-yellow-50 { background-color: #fffef0 !important; }
          .bg-indigo-50 { background-color: #f0f4ff !important; }
          .bg-gray-50, .bg-gray-100 { background-color: #f8f8f8 !important; }
          
          /* Text emphasis */
          .font-bold { font-weight: bold !important; }
          .font-medium { font-weight: 500 !important; }
          .text-indigo-600 { color: #1e40af !important; font-weight: bold !important; }
          
          /* Remove spacing */
          .mt-4, .mt-6, .mt-8 { margin-top: 8px !important; }
          .py-3 { padding: 4px 0 !important; }
          .p-3 { padding: 3px !important; }
          
          /* Professional statement styling */
          .border-b-4.border-double { 
            border-bottom: 3px double #000 !important; 
            margin-top: 8px !important; 
          }
          
          /* Footer text */
          .text-center .text-xs { 
            font-size: 8px !important; 
            margin-top: 10px !important; 
            text-align: center !important; 
          }
        }
      `}</style>
            </div>
          </main>
        </div>
      </div>
    );
  }