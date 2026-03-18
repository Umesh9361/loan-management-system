import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Search, Printer } from "lucide-react";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { useQuery } from "@tanstack/react-query";
import { DateUtils } from "@/lib/date-utils";

export default function WorkingSummary() {
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

  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ["/api/groups"],
  });

  // Fetch loans
  const { data: loans = [] } = useQuery({
    queryKey: ["/api/loans"],
  });

  // Fetch loan closures for accurate closure data
  const { data: loanClosures = [] } = useQuery({
    queryKey: ["/api/loan-closures"],
  });

  const handleSearch = () => {
    // Filter loans by date range - period-wise filtering
    const fromDate = new Date(dateFilters.dateFrom);
    const toDate = new Date(dateFilters.dateTo);
    
    
    // Only include loans that fall within the selected period
    const filteredLoans = (loans as any[]).filter((loan: any) => {
      const loanDate = new Date(loan.loanDate);
      const isInPeriod = loanDate >= fromDate && loanDate <= toDate;
      return isInPeriod;
    });
    

    // Calculate group-wise summary
    const groupSummary: any[] = [];
    
    (groups as any[]).forEach((group: any) => {
      const groupLoans = filteredLoans.filter((loan: any) => loan.groupId === group.id);
      
      const summary = {
        groupName: group.name,
        totalLoans: groupLoans.length,
        activeLoans: groupLoans.filter((loan: any) => loan.status !== 'closed').length,
        closedLoans: groupLoans.filter((loan: any) => loan.status === 'closed').length,
        totalAmount: groupLoans.reduce((sum: number, loan: any) => sum + Number(loan.principalAmount || 0), 0),
        closedAmount: groupLoans
          .filter((loan: any) => loan.status === 'closed')
          .reduce((sum: number, loan: any) => sum + Number(loan.principalAmount || 0), 0),
        activeBalance: groupLoans
          .filter((loan: any) => loan.status !== 'closed')
          .reduce((sum: number, loan: any) => sum + Number(loan.principalAmount || 0), 0),
        totalInterest: groupLoans.reduce((sum: number, loan: any) => {
          if (loan.status !== 'closed') return sum; // Only calculate interest for closed loans
          
          // Find actual closure data from loan_closures table
          const closureData = (loanClosures as any[]).find((closure: any) => 
            closure.loanId === loan.id
          );
          
          if (closureData) {
            // Use actual calculated interest from closure record
            return sum + Number(closureData.calculatedInterest || closureData.interestAmount || 0);
          }
          
          // Fallback calculation if closure data not found
          const principal = Number(loan.principalAmount || 0);
          const rate = Number(loan.interestRate || 0);
          const loanDate = new Date(loan.loanDate);
          const closureDate = loan.closureDate ? new Date(loan.closureDate) : new Date();
          
          // Calculate days difference
          const timeDiff = closureDate.getTime() - loanDate.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          
          // Banking standard: (P × R × T) / (100 × 365)
          const interest = (principal * rate * daysDiff) / (100 * 365);
          
          return sum + Math.round(interest);
        }, 0)
      };
      
      if (summary.totalLoans > 0) {
        groupSummary.push(summary);
      }
    });

    // Calculate totals
    const totals = {
      totalLoans: groupSummary.reduce((sum, group) => sum + group.totalLoans, 0),
      activeLoans: groupSummary.reduce((sum, group) => sum + group.activeLoans, 0),
      closedLoans: groupSummary.reduce((sum, group) => sum + group.closedLoans, 0),
      totalAmount: groupSummary.reduce((sum, group) => sum + group.totalAmount, 0),
      closedAmount: groupSummary.reduce((sum, group) => sum + group.closedAmount, 0),
      activeBalance: groupSummary.reduce((sum, group) => sum + group.activeBalance, 0),
      totalInterest: groupSummary.reduce((sum, group) => sum + group.totalInterest, 0)
    };

    setFilteredData({
      groupSummary,
      totals
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('hi-IN').format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      
      {/* Mobile Header */}
      <div className="lg:hidden mb-4">
        <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-gray-200 rounded-lg">
          <h1 className="text-lg font-semibold">खाते सारांश अहवाल</h1>
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
            <CardTitle className="text-xl md:text-2xl">खाते सारांश अहवाल</CardTitle>
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

        {/* Account Summary Report */}
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="text-center print:pb-2">
            <CardTitle className="text-xl md:text-2xl print:mb-1">{(company as any)?.name || 'कंपनीचे नाव'}</CardTitle>
            <p className="text-gray-600 print:mb-1">खाते सारांश अहवाल</p>
            <p className="text-sm text-gray-500 print:mb-2">
              कालावधी: {new Date(dateFilters.dateFrom).toLocaleDateString('en-GB')} ते {new Date(dateFilters.dateTo).toLocaleDateString('en-GB')}
            </p>
          </CardHeader>
          <CardContent className="print:p-0">
            
            {/* Summary Table */}
            <div className="w-full border-2 border-gray-800">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-32" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-24" />
                </colgroup>
                
                {/* Headers */}
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-center py-3 border-r border-gray-800 font-bold text-sm md:text-base md:py-4">ग्रुप नाव</th>
                    <th className="text-center py-3 border-r border-gray-800 font-bold text-sm md:text-base md:py-4">एकूण कर्ज</th>
                    <th className="text-center py-3 border-r border-gray-800 font-bold text-sm md:text-base md:py-4">चालू कर्ज</th>
                    <th className="text-center py-3 border-r border-gray-800 font-bold text-sm md:text-base md:py-4">बंद कर्ज</th>
                    <th className="text-center py-3 border-r border-gray-800 font-bold text-sm md:text-base md:py-4">एकूण रक्कम</th>
                    <th className="text-center py-3 border-r border-gray-800 font-bold text-sm md:text-base md:py-4">बंद रक्कम</th>
                    <th className="text-center py-3 border-r border-gray-800 font-bold text-sm md:text-base md:py-4">चालू शिल्लक</th>
                    <th className="text-center py-3 font-bold text-sm md:text-base md:py-4">एकूण व्याज</th>
                  </tr>
                </thead>
                
                <tbody>
                  {filteredData ? (
                    <>
                      {filteredData.groupSummary.map((group: any, index: number) => (
                        <tr key={index} className="border-t border-gray-200">
                          <td className="p-3 md:p-4 text-sm md:text-base font-medium border-r border-gray-300">
                            {group.groupName}
                          </td>
                          <td className="p-3 md:p-4 text-sm md:text-base text-center font-medium border-r border-gray-300">
                            {group.totalLoans}
                          </td>
                          <td className="p-3 md:p-4 text-sm md:text-base text-center font-medium border-r border-gray-300">
                            {group.activeLoans}
                          </td>
                          <td className="p-3 md:p-4 text-sm md:text-base text-center font-medium border-r border-gray-300">
                            {group.closedLoans}
                          </td>
                          <td className="p-3 md:p-4 text-sm md:text-base text-right font-medium border-r border-gray-300">
                            ₹{formatAmount(group.totalAmount)}
                          </td>
                          <td className="p-3 md:p-4 text-sm md:text-base text-right font-medium border-r border-gray-300">
                            ₹{formatAmount(group.closedAmount)}
                          </td>
                          <td className="p-3 md:p-4 text-sm md:text-base text-right font-medium border-r border-gray-300">
                            ₹{formatAmount(group.activeBalance)}
                          </td>
                          <td className="p-3 md:p-4 text-sm md:text-base text-right font-medium">
                            ₹{formatAmount(group.totalInterest)}
                          </td>
                        </tr>
                      ))}
                      
                      {/* Total Row */}
                      <tr className="border-t-2 border-gray-800 bg-indigo-50">
                        <td className="p-3 md:p-4 font-bold border-r border-gray-300 text-sm md:text-base">एकूण</td>
                        <td className="p-3 md:p-4 text-center font-bold border-r border-gray-300 text-sm md:text-base">
                          {filteredData.totals.totalLoans}
                        </td>
                        <td className="p-3 md:p-4 text-center font-bold border-r border-gray-300 text-sm md:text-base">
                          {filteredData.totals.activeLoans}
                        </td>
                        <td className="p-3 md:p-4 text-center font-bold border-r border-gray-300 text-sm md:text-base">
                          {filteredData.totals.closedLoans}
                        </td>
                        <td className="p-3 md:p-4 text-right font-bold border-r border-gray-300 text-indigo-600 text-sm md:text-base">
                          ₹{formatAmount(filteredData.totals.totalAmount)}
                        </td>
                        <td className="p-3 md:p-4 text-right font-bold border-r border-gray-300 text-indigo-600 text-sm md:text-base">
                          ₹{formatAmount(filteredData.totals.closedAmount)}
                        </td>
                        <td className="p-3 md:p-4 text-right font-bold border-r border-gray-300 text-indigo-600 text-sm md:text-base">
                          ₹{formatAmount(filteredData.totals.activeBalance)}
                        </td>
                        <td className="p-3 md:p-4 text-right font-bold text-indigo-600 text-sm md:text-base">
                          ₹{formatAmount(filteredData.totals.totalInterest)}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-gray-500">
                        कृपया तारीख निवडा आणि शोधा दाबा
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Double Underline - Statement End */}
            <div className="mt-4 border-b-4 border-double border-gray-800 w-full"></div>

            {/* Summary Statistics - Screen Only */}
            {filteredData && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
                <div className="p-4 md:p-6 border-2 rounded-lg border-indigo-500 bg-indigo-50">
                  <div className="text-center">
                    <p className="text-sm md:text-base font-medium text-gray-600">एकूण चालू कर्ज</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {filteredData.totals.activeLoans}
                    </p>
                    <p className="text-sm text-indigo-600">
                      ₹{formatAmount(filteredData.totals.activeBalance)}
                    </p>
                  </div>
                </div>
                <div className="p-4 md:p-6 border-2 rounded-lg border-green-500 bg-green-50">
                  <div className="text-center">
                    <p className="text-sm md:text-base font-medium text-gray-600">एकूण बंद कर्ज</p>
                    <p className="text-2xl font-bold text-green-600">
                      {filteredData.totals.closedLoans}
                    </p>
                    <p className="text-sm text-green-600">
                      ₹{formatAmount(filteredData.totals.closedAmount)}
                    </p>
                  </div>
                </div>
                <div className="p-4 md:p-6 border-2 rounded-lg border-purple-500 bg-purple-50">
                  <div className="text-center">
                    <p className="text-sm md:text-base font-medium text-gray-600">एकूण व्याज</p>
                    <p className="text-2xl font-bold text-purple-600">
                      ₹{formatAmount(filteredData.totals.totalInterest)}
                    </p>
                    <p className="text-sm text-purple-600">
                      प्राप्त व्याज
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
          html, body { font-family: 'Noto Sans Devanagari', Arial, sans-serif !important; margin: 0 !important; padding: 0 !important; height: auto !important; }
          
          /* Fit to page */
          @page {
            size: A4 landscape;
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
          
          /* Table optimization for landscape A4 */
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
          
          /* Column width optimization for landscape */
          .w-32 { width: 120px !important; }
          .w-20 { width: 70px !important; }
          .w-24 { width: 90px !important; }
          
          /* Enhanced borders */
          .border-2.border-gray-800 { border: 2px solid #000 !important; }
          .border-r.border-gray-800 { border-right: 2px solid #000 !important; }
          .border-t-2.border-gray-800 { border-top: 2px solid #000 !important; }
          
          /* Background preservation */
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