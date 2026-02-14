import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Search, Printer } from "lucide-react";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { useQuery } from "@tanstack/react-query";

export default function CapitalPrint() {
  const { safeNavigate } = useSafeNavigation();
  const [dateFilters, setDateFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  const [filteredData, setFilteredData] = useState<any>(null);

  // Fetch company data
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["/api/loans"],
  });

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('hi-IN').format(amount);
  };

  const handleSearch = () => {
    if (!loans || loans.length === 0) return;

    const fromDate = new Date(dateFilters.dateFrom);
    const toDate = new Date(dateFilters.dateTo);
    
    let runningBalance = 0;
    const capitalEntries: any[] = [];

    // Filter loans within date range
    const filteredLoans = (loans as any[]).filter(loan => {
      const loanDate = new Date(loan.loanDate);
      return loanDate >= fromDate && loanDate <= toDate;
    });

    // Process each loan
    filteredLoans.forEach((loan: any) => {
      const amount = parseFloat(loan.principalAmount || 0);
      
      // Loan disbursement (Debit)
      if (loan.loanDate) {
        runningBalance -= amount;
        capitalEntries.push({
          date: loan.loanDate,
          description: `कर्ज वितरण - ${loan.borrowerName}`,
          groupName: loan.groupName || '',
          type: "debit",
          amount: amount,
          balance: runningBalance
        });
      }

      // Loan closure (Credit)
      if (loan.status === "closed" && loan.closureDate) {
        const totalAmount = amount + parseFloat(loan.finalInterest || 0);
        runningBalance += totalAmount;
        capitalEntries.push({
          date: loan.closureDate,
          description: `कर्ज परतफेड - ${loan.borrowerName}`,
          groupName: loan.groupName || '',
          type: "credit",
          amount: totalAmount,
          balance: runningBalance
        });
      }
    });

    // Sort by date
    capitalEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setFilteredData({
      entries: capitalEntries,
      closingBalance: runningBalance,
      openingBalance: 0
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      
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
            <CardTitle className="text-xl">भांडवल खाते अहवाल</CardTitle>
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
            <CardTitle className="text-xl print:mb-1">{(company as any)?.name || 'कंपनीचे नाव'}</CardTitle>
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
                  <col className="w-auto" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-28" />
                </colgroup>
                
                {/* Headers */}
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-center py-3 border-r border-gray-800 font-bold text-sm">तारीख</th>
                    <th className="text-center py-3 border-r border-gray-800 font-bold text-sm">तपशील</th>
                    <th className="text-center py-3 border-r border-gray-800 font-bold text-sm">जमा</th>
                    <th className="text-center py-3 border-r border-gray-800 font-bold text-sm">नावे</th>
                    <th className="text-center py-3 font-bold text-sm">शिल्लक</th>
                  </tr>
                </thead>
                
                <tbody>
                  {filteredData ? (
                    <>
                      {filteredData.entries.map((entry: any, index: number) => (
                        <tr key={index} className="border-t border-gray-200">
                          <td className="p-3 text-sm font-medium border-r border-gray-300 text-center">
                            {new Date(entry.date).toLocaleDateString('en-GB')}
                          </td>
                          <td className="p-3 text-sm border-r border-gray-300">
                            {entry.description}
                            {entry.groupName && (
                              <div className="text-sm text-gray-500 mt-1">{entry.groupName}</div>
                            )}
                          </td>
                          <td className="p-3 text-sm text-right font-medium border-r border-gray-300">
                            {entry.type === 'credit' ? `₹${formatAmount(entry.amount)}` : '-'}
                          </td>
                          <td className="p-3 text-sm text-right font-medium border-r border-gray-300">
                            {entry.type === 'debit' ? `₹${formatAmount(entry.amount)}` : '-'}
                          </td>
                          <td className="p-3 text-sm text-right font-medium">
                            ₹{formatAmount(Math.abs(entry.balance))} {entry.balance >= 0 ? '(जमा)' : '(नावे)'}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Closing Balance Row */}
                      <tr className="border-t-2 border-gray-800 bg-indigo-50">
                        <td className="p-3 font-bold border-r border-gray-300 text-center text-sm">
                          {new Date(dateFilters.dateTo).toLocaleDateString('en-GB')}
                        </td>
                        <td className="p-3 font-bold border-r border-gray-300 text-sm">शेवटची शिल्लक</td>
                        <td className="p-3 border-r border-gray-300"></td>
                        <td className="p-3 border-r border-gray-300"></td>
                        <td className="p-3 text-right font-bold text-indigo-600 text-sm">
                          ₹{formatAmount(Math.abs(filteredData.closingBalance))} {filteredData.closingBalance >= 0 ? '(जमा)' : '(नावे)'}
                        </td>
                      </tr>
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
                <div className="p-4 border-2 rounded-lg border-indigo-500 bg-indigo-50">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">शेवटची भांडवल शिल्लक</p>
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
          .border-r.border-gray-800 { border-right: 2px solid #000 !important; }
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
  );
}