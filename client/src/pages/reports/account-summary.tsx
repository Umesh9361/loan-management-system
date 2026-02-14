import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Search, Printer, Calendar, Download } from "lucide-react";
import { exportAccountSummaryToExcel } from "@/utils/excel-export";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { DateUtils } from "@/lib/date-utils";

interface GroupSummary {
  groupName: string;
  totalLoans: number;
  activeLoans: number;
  closedLoans: number;
  totalAmount: number;
  closedAmount: number;
  activeBalance: number;
  totalInterest: number;
}

export default function AccountSummaryReport() {
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  // Excel Export Function - Only clean statement data
  const handleExcelExport = () => {
    try {
      // Prepare clean report statement data (only printable content)
      const cleanReportData = groupSummaries.map((group, index) => ({
        serialNo: index + 1,
        groupName: group.groupName,
        accountName: group.groupName, // For Excel compatibility
        totalLoans: group.totalLoans,
        activeLoans: group.activeLoans,
        closedLoans: group.closedLoans,
        totalAmount: group.totalAmount,
        closedAmount: group.closedAmount,
        activeBalance: group.activeBalance,
        totalInterest: group.totalInterest
      }));

      const success = exportAccountSummaryToExcel(cleanReportData);
      
      if (success) {
        alert('खाते सारांश स्टेटमेंट यशस्वीरित्या एक्सेल फाइलमध्ये एक्सपोर्ट झाला!');
      } else {
        alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
      }
    } catch (error) {
      console.error('Excel export error:', error);
      alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
    }
  };

  // Fetch company data
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["/api/groups"],
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["/api/loans"],
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["/api/transactions"],
  });

  // Fetch loan closures for accurate closure data
  const { data: loanClosures = [] } = useQuery({
    queryKey: ["/api/loan-closures"],
  });

  const handlePrint = () => {
    const printStyles = `
      @media print {
        @page {
          size: A4;
          margin: 8mm;
        }
        body * {
          visibility: hidden !important;
        }
        .print-content, .print-content * {
          visibility: visible !important;
        }
        .print-content {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          z-index: 9999 !important;
        }
        body {
          font-size: 11px;
          line-height: 1.3;
        }
        .no-print {
          display: none !important;
        }
        .summary-header {
          text-align: center;
          margin-bottom: 20px;
          font-weight: bold;
        }
        .summary-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .summary-table th,
        .summary-table td {
          border: 2px solid #1e40af;
          padding: 8px 10px;
          text-align: center;
        }
        .summary-table th {
          background: #f0f0f0;
          color: black;
          font-weight: bold;
          font-size: 12px;
        }
        .summary-table td {
          background: white;
          font-weight: 600;
        }
        .amount-col {
          text-align: right;
          font-family: 'Courier New', monospace;
        }
        .total-row {
          background: #e3f2fd !important;
          font-weight: bold;
        }
      }
    `;
    
    const styleSheet = document.createElement("style");
    styleSheet.innerText = printStyles;
    document.head.appendChild(styleSheet);
    
    // Show print content before printing
    const printContentDiv = document.querySelector('.print-content') as HTMLElement;
    if (printContentDiv) {
      printContentDiv.style.display = 'block';
      printContentDiv.style.visibility = 'visible';
    }
    
    // Force content to be visible
    const printElements = document.querySelectorAll('.print-content *');
    printElements.forEach(el => {
      (el as HTMLElement).style.visibility = 'visible';
    });
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        // Hide print content after printing
        if (printContentDiv) {
          printContentDiv.style.display = 'none';
        }
        document.head.removeChild(styleSheet);
      }, 1000);
    }, 100);
  };

  // Calculate group-wise summary for specified date range ONLY
  const groupSummaries: GroupSummary[] = (groups as any[]).map((group: any) => {
    // Filter loans by group ID only - सर्व loans मिळवा या group मधील
    const allGroupLoans = (loans as any[]).filter((loan: any) => loan.groupId === group.id);
    
    // Filter loans that were disbursed in the specified date range
    const periodLoans = allGroupLoans.filter((loan: any) => {
      const loanDate = new Date(loan.loanDate);
      return loanDate >= new Date(fromDate) && loanDate <= new Date(toDate);
    });

    // Filter loan closures in the specified period - use loan_closures table for accurate data
    const periodClosures = (loanClosures as any[]).filter((closure: any) => {
      const closureDate = new Date(closure.closureDate);
      return closureDate >= new Date(fromDate) && 
             closureDate <= new Date(toDate) &&
             allGroupLoans.some((loan: any) => loan.id === closure.loanId);
    });

    // समस्त calculations फक्त specified period साठी
    const totalLoansInPeriod = periodLoans.length;
    const closedLoansInPeriod = periodClosures.length;
    const activeLoansInPeriod = totalLoansInPeriod - closedLoansInPeriod;

    // Period मधील एकूण वाटप केली रक्कम
    const totalAmountDisbursed = periodLoans.reduce((sum: number, loan: any) => 
      sum + parseFloat(loan.principalAmount || 0), 0);
    
    // Period मधील बंद झालेल्या loans ची रक्कम (principal only)
    const closedAmount = periodClosures.reduce((sum: number, closure: any) => {
      return sum + parseFloat(closure.principalPaid || closure.principalAmount || 0);
    }, 0);
    
    // Period मधील सक्रिय loans ची शिल्लक रक्कम
    const activeBalance = totalAmountDisbursed - closedAmount;

    // Period मधील व्याज calculation - फक्त या period मधील loan closures साठी
    const totalInterestInPeriod = periodClosures.reduce((sum: number, closure: any) => {
      // Use calculated interest from loan closure
      return sum + parseFloat(closure.calculatedInterest || closure.interestAmount || 0);
    }, 0);

    return {
      groupName: group.name,
      totalLoans: totalLoansInPeriod,
      activeLoans: activeLoansInPeriod,
      closedLoans: closedLoansInPeriod,
      totalAmount: totalAmountDisbursed,
      closedAmount,
      activeBalance,
      totalInterest: totalInterestInPeriod
    };
  }).filter(summary => summary.totalLoans > 0); // फक्त त्या groups दाखवा ज्यामध्ये या period मध्ये activity होती

  // Calculate grand totals
  const grandTotals = groupSummaries.reduce(
    (totals, group) => ({
      totalLoans: totals.totalLoans + group.totalLoans,
      activeLoans: totals.activeLoans + group.activeLoans,
      closedLoans: totals.closedLoans + group.closedLoans,
      totalAmount: totals.totalAmount + group.totalAmount,
      closedAmount: totals.closedAmount + group.closedAmount,
      activeBalance: totals.activeBalance + group.activeBalance,
      totalInterest: totals.totalInterest + group.totalInterest,
    }),
    { totalLoans: 0, activeLoans: 0, closedLoans: 0, totalAmount: 0, closedAmount: 0, activeBalance: 0, totalInterest: 0 }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('hi-IN');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            
            {/* Print Content - Only this will be visible during print */}
            <div className="print-content" style={{ display: 'none' }}>
              <div className="summary-header">
                <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>खाते सारांश अहवाल</h1>

                <p style={{ fontSize: '16px', marginBottom: '20px' }}>
                  कालावधी: {new Date(fromDate).toLocaleDateString('en-GB')} ते {new Date(toDate).toLocaleDateString('en-GB')}
                </p>
              </div>
              
              <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>गटाचे नाव</th>
                    <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>एकूण कर्ज</th>
                    <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>सक्रिय</th>
                    <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>बंद</th>
                    <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>एकूण रक्कम</th>
                    <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>बंद रक्कम</th>
                    <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>सक्रिय शिल्लक</th>
                    <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>एकूण व्याज</th>
                  </tr>
                </thead>
                <tbody>
                  {groupSummaries.map((group, index) => (
                    <tr key={index}>
                      <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'left', fontSize: '13px' }}>
                        {group.groupName}
                      </td>
                      <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                        {group.totalLoans}
                      </td>
                      <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                        {group.activeLoans}
                      </td>
                      <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                        {group.closedLoans}
                      </td>
                      <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px' }}>
                        ₹{group.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px' }}>
                        ₹{group.closedAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px' }}>
                        ₹{group.activeBalance.toLocaleString('en-IN')}
                      </td>
                      <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px' }}>
                        ₹{group.totalInterest.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Grand Total Row */}
                  <tr className="total-row">
                    <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'left', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                      एकूण योग
                    </td>
                    <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                      {grandTotals.totalLoans}
                    </td>
                    <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                      {grandTotals.activeLoans}
                    </td>
                    <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                      {grandTotals.closedLoans}
                    </td>
                    <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                      ₹{grandTotals.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                      ₹{grandTotals.closedAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                      ₹{grandTotals.activeBalance.toLocaleString('en-IN')}
                    </td>
                    <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                      ₹{grandTotals.totalInterest.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
              
              {groupSummaries.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', fontSize: '16px' }}>
                  निवडलेल्या तारखेच्या कालावधीत कोणतेही व्यवहार नाहीत
                </div>
              )}
              
              {/* Minimal print footer */}
              {groupSummaries.length > 0 && (
                <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                  <p>अहवाल तयार केल्याची तारीख: {new Date().toLocaleDateString('en-GB')}</p>
                </div>
              )}
            </div>

            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">खाते सारांश अहवाल</h1>
              <p className="text-gray-600">गटनिहाय कर्ज वाटप सारांश</p>
            </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            खाते सारांश अहवाल
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="fromDate">सुरुवातीची तारीख</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="font-inter"
              />
            </div>
            <div>
              <Label htmlFor="toDate">शेवटची तारीख</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="font-inter"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="flex items-center gap-2 no-print">
              <Printer className="h-4 w-4" />
              प्रिंट करा
            </Button>
            
            <Button onClick={handleExcelExport} variant="outline" className="bg-green-50 hover:bg-green-100 border-green-300 no-print">
              <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm2 2h8v12H6V4z"/>
              </svg>
              Excel एक्सपोर्ट करा
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Print Content */}
      <div className="bg-white">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            * { 
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
            }
            .print-hide { display: none !important; }
            .print-only { display: block !important; }
            body { 
              margin: 0;
              padding: 0;
              font-family: 'Noto Sans Devanagari', Arial, sans-serif;
              font-size: 12px;
              line-height: 1.2;
            }
            .print-content { 
              width: 210mm;
              min-height: 297mm;
              margin: 0;
              padding: 15mm 10mm;
              box-sizing: border-box;
              background: white;
              color: black;
            }
            .print-header {
              text-align: center;
              margin-bottom: 8mm;
              border-bottom: 2px solid black;
              padding-bottom: 3mm;
            }
            .company-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 2mm;
            }
            .report-title {
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 2mm;
            }
            .date-info {
              font-size: 11px;
              color: #333;
            }
            .summary-table { 
              width: 100%;
              border-collapse: collapse;
              margin-top: 5mm;
              font-size: 10px;
            }
            .summary-table th,
            .summary-table td { 
              border: 1px solid black;
              padding: 2mm 1mm;
              text-align: center;
              vertical-align: middle;
            }
            .summary-table th {
              background-color: #f0f0f0;
              font-weight: bold;
              font-size: 9px;
            }
            .group-name-cell {
              text-align: left !important;
              font-weight: 600;
              width: 25%;
            }
            .amount-cell {
              text-align: right !important;
            }
            .total-row {
              background-color: #e8f4fd !important;
              font-weight: bold;
              border-top: 2px solid black !important;
            }
            .total-row td {
              background-color: #e8f4fd !important;
              font-weight: bold;
            }
            .print-footer {
              margin-top: 10mm;
              font-size: 9px;
              color: #666;
            }
            .signature-section {
              margin-top: 15mm;
              display: flex;
              justify-content: space-between;
            }
            .signature-box {
              text-align: center;
              width: 30%;
            }
            .signature-line {
              border-top: 1px solid black;
              margin-top: 15mm;
              padding-top: 2mm;
            }
          }
          @media screen {
            .print-only { display: none; }
          }
        `}} />

        <div className="print-content">
          {/* Print Header */}
          <div className="print-header">
            <div className="company-title">
              {(company as any)?.name || "गजलक्ष्मी फायनान्स"}
            </div>
            <div className="report-title">
              खाते सारांश अहवाल
            </div>
            <div className="date-info">
              कालावधी: {formatDate(fromDate)} ते {formatDate(toDate)}
            </div>
          </div>

          {/* Summary Table */}
          <table className="w-full border-collapse border border-black text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className="border border-black p-2 bg-gray-100 text-left font-bold w-1/5">
                  गट नाव
                </th>
                <th colSpan={3} className="border border-black p-2 bg-gray-100 text-center font-bold">
                  कर्ज वाटप
                </th>
                <th rowSpan={2} className="border border-black p-2 bg-gray-100 text-center font-bold w-1/8">
                  एकूण वाटप (₹)
                </th>
                <th rowSpan={2} className="border border-black p-2 bg-gray-100 text-center font-bold w-1/8">
                  बंद रक्कम (₹)
                </th>
                <th rowSpan={2} className="border border-black p-2 bg-gray-100 text-center font-bold w-1/8">
                  सक्रिय शिल्लक (₹)
                </th>
                <th rowSpan={2} className="border border-black p-2 bg-gray-100 text-center font-bold w-1/8">
                  एकूण व्याज (₹)
                </th>
              </tr>
              <tr>
                <th className="border border-black p-2 bg-gray-100 text-center font-bold w-1/12">
                  एकूण
                </th>
                <th className="border border-black p-2 bg-gray-100 text-center font-bold w-1/12">
                  सक्रिय
                </th>
                <th className="border border-black p-2 bg-gray-100 text-center font-bold w-1/12">
                  बंद
                </th>
              </tr>
            </thead>
            <tbody>
              {groupSummaries.map((group, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border border-black p-2 text-left font-semibold">
                    {group.groupName}
                  </td>
                  <td className="border border-black p-2 text-center">
                    {group.totalLoans}
                  </td>
                  <td className="border border-black p-2 text-center">
                    {group.activeLoans}
                  </td>
                  <td className="border border-black p-2 text-center">
                    {group.closedLoans}
                  </td>
                  <td className="border border-black p-2 text-right">
                    {formatCurrency(group.totalAmount).replace('₹', '')}
                  </td>
                  <td className="border border-black p-2 text-right">
                    {formatCurrency(group.closedAmount).replace('₹', '')}
                  </td>
                  <td className="border border-black p-2 text-right">
                    {formatCurrency(group.activeBalance).replace('₹', '')}
                  </td>
                  <td className="border border-black p-2 text-right">
                    {formatCurrency(group.totalInterest).replace('₹', '')}
                  </td>
                </tr>
              ))}
              
              {/* Grand Total Row */}
              <tr className="bg-indigo-100 border-t-2 border-black font-bold">
                <td className="border border-black p-2 text-left font-bold">
                  एकूण योग
                </td>
                <td className="border border-black p-2 text-center font-bold">
                  {grandTotals.totalLoans}
                </td>
                <td className="border border-black p-2 text-center font-bold">
                  {grandTotals.activeLoans}
                </td>
                <td className="border border-black p-2 text-center font-bold">
                  {grandTotals.closedLoans}
                </td>
                <td className="border border-black p-2 text-right font-bold">
                  {formatCurrency(grandTotals.totalAmount).replace('₹', '')}
                </td>
                <td className="border border-black p-2 text-right font-bold">
                  {formatCurrency(grandTotals.closedAmount).replace('₹', '')}
                </td>
                <td className="border border-black p-2 text-right font-bold">
                  {formatCurrency(grandTotals.activeBalance).replace('₹', '')}
                </td>
                <td className="border border-black p-2 text-right font-bold">
                  {formatCurrency(grandTotals.totalInterest).replace('₹', '')}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <div className="mt-8 text-xs text-gray-600">
            <p>अहवाल तयार केल्याची तारीख: {new Date().toLocaleDateString('hi-IN')}</p>
            <p>सिस्टम रिपोर्ट - लोन मॅनेजमेंट सिस्टम</p>
          </div>
        </div>
      </div>
          </div>
        </main>
      </div>
    </div>
  );
}