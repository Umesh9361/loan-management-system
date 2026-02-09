import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRealTimeSync } from "@/hooks/use-real-time-sync";

import { Label } from "@/components/ui/label";
import { Search, Printer, Home, ArrowLeft, Download } from "lucide-react";
import { Link } from "wouter";
import { exportCashBookToExcel } from "@/utils/excel-export";
// import { createCashBalanceEngine } from "@/lib/cashbook-engine";

export default function WorkingCashBook() {
  const [dateFilters, setDateFilters] = useState({
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });
  
  const [filteredData, setFilteredData] = useState<any>(null);
  
  // 🚀 REAL-TIME SYNC: Enable automatic updates for all loan operations
  const { triggerCompleteSync } = useRealTimeSync({
    enabled: true,
    onSyncComplete: (operation) => {
      console.log(`💼 WORKING CASHBOOK: Real-time sync completed for ${operation}`);
    }
  });

  // Fetch required data first
  const { data: cashTransactions = [] } = useQuery({
    queryKey: ['/api/cash-transactions'],
  });

  const { data: loans = [] } = useQuery({
    queryKey: ['/api/loans'],
  });

  const { data: company } = useQuery({
    queryKey: ['/api/company'],
  });

  // Define handleSearch function first
  const handleSearch = useCallback(() => {
    // Ensure data is available before processing
    if (!Array.isArray(cashTransactions) || !Array.isArray(loans)) {
      return;
    }
    const fromDate = dateFilters.dateFrom;
    const toDate = dateFilters.dateTo;
    
    // Filter transactions by date range with deduplication
    const filteredCashTransactions = (cashTransactions as any[])
      .filter((transaction: any) => {
        return transaction.transactionDate >= fromDate && transaction.transactionDate <= toDate;
      })
      .filter((transaction, index, self) => 
        index === self.findIndex(t => t.id === transaction.id)
      );

    const filteredLoans = (loans as any[])
      .filter((loan: any) => {
        return loan.loanDate >= fromDate && loan.loanDate <= toDate;
      })
      .filter((loan, index, self) => 
        index === self.findIndex(l => l.id === loan.id)
      );

    // Calculate opening balance up to start date with default base of 5000
    let openingBalance = 5000; // Fixed base opening balance as per requirement
    
    // Calculate opening balance from cash transactions before start date
    (cashTransactions as any[]).forEach((transaction: any) => {
      if (transaction.transactionDate < fromDate) {
        const amount = parseFloat(transaction.amount || 0);
        if (transaction.transactionType === 'cash_in') {
          openingBalance += amount;
        } else {
          openingBalance -= amount;
        }
      }
    });
    
    // Calculate opening balance from loans before start date
    (loans as any[]).forEach((loan: any) => {
      if (loan.loanDate < fromDate) {
        // Loan disbursed (cash goes out)
        const amount = parseFloat(loan.principalAmount || 0);
        openingBalance -= amount;
      }
      if (loan.status === 'closed' && loan.closureDate && loan.closureDate < fromDate) {
        // Loan closed (cash comes in)
        const totalRepayment = parseFloat(loan.principalAmount || 0) + parseFloat(loan.finalInterest || 0);
        openingBalance += totalRepayment;
      }
    });

    // Process filtered data for display
    const debitEntries: any[] = [];
    const creditEntries: any[] = [];

    // FIXED: Opening balance placement for correct T-format accounting
    // This ensures opening balance is ALWAYS visible in the cash book
    if (openingBalance !== 0) {
      if (openingBalance >= 0) {
        // Positive opening balance goes to credit side (जमा बाजू) - FIXED ACCOUNTING LOGIC
        creditEntries.push({
          date: fromDate,
          description: "मागील शिल्लक पुढे",
          amount: openingBalance,
          isOpening: true
        });
      } else {
        // Negative opening balance goes to debit side (नावे बाजू) - FIXED ACCOUNTING LOGIC
        debitEntries.push({
          date: fromDate,
          description: "मागील शिल्लक पुढे (कमतरता)",
          amount: Math.abs(openingBalance),
          isOpening: true
        });
      }
    }

    // Process filtered cash transactions - SIMPLIFIED NARRATION
    filteredCashTransactions.forEach((transaction: any) => {
      const partyName = transaction.party?.name || '';
      const narration = transaction.narration || '';
      

      
      if (transaction.transactionType === 'cash_in') {
        // Cash IN = Credit (जमा बाजू) - FIXED ACCOUNTING LOGIC
        // SIMPLE FORMAT: Just party name + narration in brackets (if any)
        let simpleDescription = '';
        if (partyName && partyName !== 'अज्ञात पार्टी') {
          simpleDescription = partyName;
          if (narration && narration !== 'रक्कम' && narration.trim() !== '') {
            simpleDescription += ` (${narration})`;
          }
        } else {
          simpleDescription = narration || 'रोकड मिळाली';
        }
        
        creditEntries.push({
          date: transaction.transactionDate,
          description: simpleDescription,
          amount: parseFloat(transaction.amount || 0),
          transactionId: transaction.id,
          type: 'cash'
        });
      } else {
        // Cash OUT = Debit (नावे बाजू) - FIXED ACCOUNTING LOGIC
        // SIMPLE FORMAT: Just party name + narration in brackets (if any)
        let simpleDescription = '';
        if (partyName && partyName !== 'अज्ञात पार्टी') {
          simpleDescription = partyName;
          if (narration && narration !== 'रक्कम' && narration.trim() !== '') {
            simpleDescription += ` (${narration})`;
          }
        } else {
          simpleDescription = narration || 'रोकड दिली';
        }
          
        debitEntries.push({
          date: transaction.transactionDate,
          description: simpleDescription,
          amount: parseFloat(transaction.amount || 0),
          transactionId: transaction.id,
          type: 'cash'
        });
      }
    });

    // Process filtered loan disbursements
    // NOTE: We already get loan disbursements through cash_transactions API
    // So we DON'T need to add them again from loans API to avoid duplicates
    
    // filteredLoans.forEach((loan: any) => {
    //   const groupName = loan.group?.name || 'अज्ञात गट';
    //   const description = `कर्ज वितरण (खाते क्र. ${loan.accountNumber || loan.id.slice(0, 8)} ${loan.borrowerName}) - ${groupName}`;
    //   
    //   creditEntries.push({
    //     date: loan.loanDate,
    //     description: description,
    //     amount: parseFloat(loan.principalAmount || 0),
    //     loanId: loan.id,
    //     type: 'loan'
    //   });
    // });
    
    // Add loan closures in date range - FIXED ACCOUNTING LOGIC
    (loans as any[]).forEach((loan: any) => {
      if (loan.status === 'closed' && loan.closureDate && 
          loan.closureDate >= fromDate && loan.closureDate <= toDate) {
        const groupName = loan.group?.name || 'अज्ञात गट';
        const totalRepayment = parseFloat(loan.principalAmount || 0) + parseFloat(loan.finalInterest || 0);
        
        // Loan repayment = Credit (जमा बाजू) - money coming in - FIXED ACCOUNTING LOGIC
        creditEntries.push({
          date: loan.closureDate,
          description: `कर्ज परतफेड (खाते क्र. ${loan.accountNumber || loan.id.slice(0, 8)} ${loan.borrowerName}) - ${groupName}`,
          amount: totalRepayment,
          loanId: loan.id,
          type: 'loan'
        });
      }
    });

    // Calculate proper closing balance - FIXED ACCOUNTING LOGIC
    const debitTransactionTotal = debitEntries.filter(e => !e.isClosing).reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const creditTransactionTotal = creditEntries.filter(e => !e.isClosing).reduce((sum, entry) => sum + (entry.amount || 0), 0);
    
    // Real closing balance calculation - FIXED LOGIC (Credit - Debit for cash balance)
    const realClosingBalance = creditTransactionTotal - debitTransactionTotal;

    // Add closing balance to balance the T-account format - FIXED LOGIC
    if (realClosingBalance > 0) {
      // Positive closing balance goes to debit side (नावे बाजू) to balance the account
      debitEntries.push({
        date: dateFilters.dateTo,
        description: "शिल्लक खाली",
        amount: realClosingBalance,
        isClosing: true
      });
    } else if (realClosingBalance < 0) {
      // Negative closing balance goes to credit side (जमा बाजू) to balance the account
      creditEntries.push({
        date: dateFilters.dateTo,
        description: "शिल्लक खाली (कमतरता)",
        amount: Math.abs(realClosingBalance),
        isClosing: true
      });
    }

    // Calculate final totals - both sides must be equal in T-format
    const finalDebitTotal = debitEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const finalCreditTotal = creditEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

    setFilteredData({
      debitEntries,
      creditEntries,
      debitTotal: finalDebitTotal,
      creditTotal: finalCreditTotal,
      openingBalance,
      closingBalance: realClosingBalance,
      allTransactionsCount: ((cashTransactions as any[]).length || 0) + ((loans as any[]).length || 0),
      filteredTransactionsCount: filteredCashTransactions.length + filteredLoans.length
    });
  }, [cashTransactions, loans, dateFilters]);

  // Initialize with default opening balance and auto-search on mount
  useEffect(() => {
    if (Array.isArray(cashTransactions) && Array.isArray(loans) && 
        (cashTransactions.length > 0 || loans.length > 0)) {
      handleSearch(); // Auto search with default dates to show opening balance
    }
  }, [cashTransactions, loans, handleSearch]);

  const handlePrint = () => {
    if (!filteredData) {
      alert('प्रिंट करण्यासाठी प्रथम तारीख निवडा आणि शोधा बटन दाबा');
      return;
    }
    
    try {
      setTimeout(() => {
        window.print();
      }, 100);
    } catch (error) {
      alert('प्रिंट करताना त्रुटी झाली');
    }
  };

  const handleExcelExport = () => {
    if (!filteredData) {
      alert('एक्सेल एक्सपोर्ट करण्यासाठी प्रथम तारीख निवडा आणि शोधा बटन दाबा');
      return;
    }

    try {
      // Prepare clean statement data for Excel (only the printable content)
      const cleanStatementData = [];
      
      // Add opening balance row
      if (filteredData.openingBalance !== 0) {
        cleanStatementData.push({
          date: dateFilters.dateFrom,
          particulars: filteredData.openingBalance >= 0 ? 'प्रारंभिक शिल्लक' : 'प्रारंभिक शिल्लक (उधार)',
          amount: Math.abs(filteredData.openingBalance),
          type: filteredData.openingBalance >= 0 ? 'आवक' : 'जावक'
        });
      }
      
      // Add all transactions
      [...filteredData.leftSideTransactions, ...filteredData.rightSideTransactions]
        .forEach(transaction => {
          cleanStatementData.push({
            date: transaction.formattedDate || transaction.date,
            particulars: transaction.narration || transaction.particulars,
            amount: transaction.amount,
            type: transaction.type === 'cash_in' ? 'आवक' : 'जावक'
          });
        });
      
      // Add closing balance
      cleanStatementData.push({
        date: dateFilters.dateTo,
        particulars: 'अंतिम शिल्लक',
        amount: Math.abs(filteredData.closingBalance),
        type: filteredData.closingBalance >= 0 ? 'आवक' : 'जावक'
      });

      const success = exportCashBookToExcel(
        cleanStatementData,
        (company as any)?.name || 'कंपनी',
        { from: dateFilters.dateFrom, to: dateFilters.dateTo }
      );
      
      if (success) {
        alert('रोकड वही स्टेटमेंट यशस्वीरित्या एक्सेल फाइलमध्ये एक्सपोर्ट झाली!');
      } else {
        alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
      }
    } catch (error) {
      console.error('Excel export error:', error);
      alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('hi-IN').format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      
      {/* Mobile & Universal Navigation Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between bg-white px-4 py-3 border border-gray-200 rounded-lg shadow-sm">
          <h1 className="text-lg font-semibold text-blue-900">रोकड वही (नमुना क्र. ७)</h1>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="text-xs">
                <Home className="h-3 w-3 mr-1" />
                होम
              </Button>
            </Link>
            <Button 
              variant="outline" 
              size="sm"
              className="text-xs"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              परत
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        
        {/* Screen Controls */}
        <Card className="print:hidden mb-6">
          <CardHeader>
            <CardTitle className="text-xl">फिल्टर आणि ऑप्शन्स</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Search className="mr-2 h-4 w-4" />
                शोधा
              </Button>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handlePrint} variant="outline">
                <Printer className="mr-2 h-4 w-4" />
                प्रिंट करा
              </Button>
              
              <Button onClick={handleExcelExport} variant="outline" className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                <Download className="mr-2 h-4 w-4" />
                एक्सेल एक्सपोर्ट
              </Button>


              
              {/* Transaction Count Info */}
              {filteredData && (
                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  एकूण: {filteredData.allTransactionsCount} | फिल्टर: {filteredData.filteredTransactionsCount}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* T-Format Cash Book */}
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="text-center print:pb-2">
            <CardTitle className="text-xl print:mb-1">{(company as any)?.name || 'कंपनीचे नाव'}</CardTitle>
            <p className="text-gray-600 print:mb-1">रोकड वही अहवाल (नमुना क्रमांक ७)</p>
            <p className="text-sm text-gray-500 print:mb-2">
              कालावधी: {new Date(dateFilters.dateFrom).toLocaleDateString('en-GB')} ते {new Date(dateFilters.dateTo).toLocaleDateString('en-GB')}
            </p>
          </CardHeader>
          <CardContent className="print:p-0">
            
            {/* T-Format Table */}
            <div className="w-full border-2 border-gray-800">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-1/2" />
                  <col className="w-1/2" />
                </colgroup>
                
                {/* Headers */}
                <thead>
                  <tr>
                    <th className="bg-gray-100 text-center py-4 border-r-2 border-gray-800 font-bold text-lg">नावे</th>
                    <th className="bg-gray-100 text-center py-4 font-bold text-lg">जमा</th>
                  </tr>
                </thead>
                
                <tbody>
                  {/* Main Content */}
                  <tr>
                    {/* Debit Side (नावे) */}
                    <td className="align-top border-r-2 border-gray-800 p-0">
                      <table className="w-full">
                        <tbody>
                          {filteredData?.debitEntries?.map((entry: any, index: number) => (
                            <tr key={index} className={`border-b border-gray-300 ${entry.isOpening ? 'bg-yellow-50' : entry.isClosing ? 'bg-green-50' : ''}`}>
                              <td className="px-3 py-2 text-xs">
                                {new Date(entry.date).toLocaleDateString('en-GB')}
                              </td>
                              <td className="px-3 py-2 text-sm">{entry.description}</td>
                              <td className="px-3 py-2 text-right font-mono text-sm">
                                ₹{formatAmount(entry.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                    
                    {/* Credit Side (जमा) */}
                    <td className="align-top p-0">
                      <table className="w-full">
                        <tbody>
                          {filteredData?.creditEntries?.map((entry: any, index: number) => (
                            <tr key={index} className={`border-b border-gray-300 ${entry.isOpening ? 'bg-yellow-50' : entry.isClosing ? 'bg-green-50' : ''}`}>
                              <td className="px-3 py-2 text-xs">
                                {new Date(entry.date).toLocaleDateString('en-GB')}
                              </td>
                              <td className="px-3 py-2 text-sm">{entry.description}</td>
                              <td className="px-3 py-2 text-right font-mono text-sm">
                                ₹{formatAmount(entry.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  
                  {/* Totals Row */}
                  <tr className="bg-gray-100 font-bold">
                    <td className="text-center py-3 border-r-2 border-gray-800 text-lg">
                      एकूण: ₹{filteredData ? formatAmount(filteredData.debitTotal) : '0'}
                    </td>
                    <td className="text-center py-3 text-lg">
                      एकूण: ₹{filteredData ? formatAmount(filteredData.creditTotal) : '0'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Balance Summary */}
            {filteredData && (
              <div className="mt-4 print:mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 print:gap-2">
                <div className="bg-blue-50 border border-blue-200 rounded p-3 print:p-2">
                  <h4 className="font-semibold text-blue-800 mb-1">सुरुवातीची शिल्लक</h4>
                  <p className="text-lg font-mono text-blue-900">
                    ₹{formatAmount(Math.abs(filteredData.openingBalance))} 
                    {filteredData.openingBalance < 0 && ' (कमतरता)'}
                  </p>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded p-3 print:p-2">
                  <h4 className="font-semibold text-green-800 mb-1">शेवटची शिल्लक</h4>
                  <p className="text-lg font-mono text-green-900">
                    ₹{formatAmount(Math.abs(filteredData.closingBalance))} 
                    {filteredData.closingBalance < 0 && ' (कमतरता)'}
                  </p>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded p-3 print:p-2">
                  <h4 className="font-semibold text-gray-800 mb-1">व्यवहारांची संख्या</h4>
                  <p className="text-lg font-mono text-gray-900">
                    {filteredData.filteredTransactionsCount}
                  </p>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

      </div>
    </div>
  );
}