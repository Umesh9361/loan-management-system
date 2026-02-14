import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Calendar, Printer, Download, FileText, FileDown } from "lucide-react";
import { exportCapitalAccountToExcel } from "@/utils/excel-export";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function CapitalAccountReport() {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState("2025-08-01");
  const [dateTo, setDateTo] = useState("2025-08-31");
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection and navigation fix
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkMobile = () => setIsMobile(window.innerWidth < 1024);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      
      // Fix navigation issues
      const timer = setTimeout(() => {
        const buttons = document.querySelectorAll('button, a');
        buttons.forEach(btn => {
          (btn as HTMLElement).style.pointerEvents = 'auto';
        });
      }, 500);
      
      return () => {
        window.removeEventListener('resize', checkMobile);
        clearTimeout(timer);
      };
    }
  }, []);

  // Fetch loans data for capital calculation
  const { data: loans = [], isLoading: loansLoading } = useQuery({
    queryKey: ["/api/loans"],
    retry: 3,
    staleTime: 5 * 60 * 1000
  });

  // Fetch cash transactions for disbursement/repayment tracking
  const { data: cashTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/cash-transactions"],
    retry: 3,
    staleTime: 5 * 60 * 1000
  });

  // Fetch loan closures data for accurate collection amounts
  const { data: loanClosures = [], isLoading: closuresLoading } = useQuery({
    queryKey: ["/api/loan-closures"],
    retry: 3,
    staleTime: 5 * 60 * 1000
  });

  // Fetch company data for reports
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
    staleTime: 10 * 60 * 1000 // Company data changes rarely
  });

  // Calculate capital account data with opening and closing balance + daily totals
  const processCapitalData = () => {
    if (!dateFrom || !dateTo || !loans || !cashTransactions || !loanClosures) return { entries: [], openingBalance: 0, closingBalance: 0 };

    
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    
    // Calculate opening balance - total disbursed minus total repaid before start date
    let openingDisbursement = 0;
    let openingRepayment = 0;
    
    
    (loans as any[]).forEach((loan: any) => {
      const loanDate = new Date(loan.loanDate);
      
      // Count disbursements before start date
      if (loanDate < startDate) {
        openingDisbursement += parseFloat(loan.principalAmount || 0);
      }
      
      // Count repayments (closures) before start date using closure records
      if (loan.status === 'closed') {
        // Find corresponding closure record for accurate amount - Fix field mapping
        const closureRecord = (loanClosures as any[]).find((closure: any) => 
          closure.loanId === loan.id && 
          closure.closureDate && 
          new Date(closure.closureDate) < startDate
        );
        
        if (closureRecord) {
          // CAPITAL ACCOUNT: Only count principal amount for capital calculation, not interest
          const principalAmount = parseFloat(loan.principalAmount || 0);
          openingRepayment += principalAmount;
        }
      }
    });
    
    const openingBalance = openingDisbursement - openingRepayment;
    
    const groupedData = new Map();
    
    // Page number logic: Sequential numbering based on date order
    let disbursementPageCounter = 1;
    let repaymentPageCounter = 1;
    
    // Filter loans disbursed in the date range
    const filteredLoans = (loans as any[]).filter((loan: any) => {
      const loanDate = new Date(loan.loanDate);
      return loanDate >= startDate && loanDate <= endDate;
    }).sort((a: any, b: any) => {
      // Sort by loanDate ascending (oldest first) for correct page number assignment
      return new Date(a.loanDate).getTime() - new Date(b.loanDate).getTime();
    });
    
    // Filter loan closures in the date range using closure records
    const filteredClosures = (loanClosures as any[]).filter((closure: any) => {
      return closure.closureDate &&
             new Date(closure.closureDate) >= startDate && 
             new Date(closure.closureDate) <= endDate;
    }).sort((a: any, b: any) => {
      // Sort by closureDate ascending (oldest first) for correct page number assignment
      return new Date(a.closureDate).getTime() - new Date(b.closureDate).getTime();
    });

    

    
    
    // Process loan disbursements - group by date for daily totals with separate page numbers
    filteredLoans.forEach((loan: any) => {
      const loanDate = new Date(loan.loanDate);
      const dateKey = loanDate.toISOString().split('T')[0];
      
      if (!groupedData.has(dateKey)) {
        groupedData.set(dateKey, {
          date: dateKey,
          loanRepayment: 0,
          repaymentPageNo: null, // Will be set when repayment happens
          loanDisbursement: 0,
          disbursementPageNo: null, // Will be set when disbursement happens
          netBalance: 0,
          disbursementCount: 0,
          repaymentCount: 0,
          runningBalance: 0
        });
      }
      
      const entry = groupedData.get(dateKey);
      // Add individual loan amount to daily total (multiple loans on same date = total for that date)
      entry.loanDisbursement += parseFloat(loan.principalAmount || 0);
      entry.disbursementCount++;
      
      // Set disbursement page number for this date (same page for all disbursements on same date)
      if (!entry.disbursementPageNo) {
        entry.disbursementPageNo = `पान-${disbursementPageCounter}`;
        disbursementPageCounter++;
      }
    });
    
    // Process loan closures - group by date for daily totals with separate page numbers
    filteredClosures.forEach((closure: any) => {
      const closureDate = new Date(closure.closureDate);
      const dateKey = closureDate.toISOString().split('T')[0];
      
      if (!groupedData.has(dateKey)) {
        groupedData.set(dateKey, {
          date: dateKey,
          loanRepayment: 0,
          repaymentPageNo: null, // Will be set when repayment happens
          loanDisbursement: 0,
          disbursementPageNo: null, // Will be set when disbursement happens
          netBalance: 0,
          disbursementCount: 0,
          repaymentCount: 0,
          runningBalance: 0
        });
      }
      
      const entry = groupedData.get(dateKey);
      
      // Find the corresponding loan to get principal amount - Fix field mapping
      const correspondingLoan = (loans as any[]).find((loan: any) => loan.id === closure.loanId);
      // CAPITAL ACCOUNT FIX: Use only principal amount from loan, not interest - as per business requirement
      const principalOnlyAmount = correspondingLoan ? parseFloat(correspondingLoan.principalAmount || 0) : 0;
      
      // Add individual closure principal amount to daily total (multiple closures on same date = total for that date)
      entry.loanRepayment += principalOnlyAmount;
      entry.repaymentCount++;
      
      // Set repayment page number for this date (same page for all repayments on same date)
      if (!entry.repaymentPageNo) {
        entry.repaymentPageNo = `पान-${repaymentPageCounter}`;
        repaymentPageCounter++;
      }
    });
    
    // Calculate running balance for each date entry (cumulative business investment)
    let runningBalance = openingBalance;
    const sortedEntries = Array.from(groupedData.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    sortedEntries.forEach(entry => {
      // Daily net change = total disbursements - total repayments for that day
      const dailyChange = entry.loanDisbursement - entry.loanRepayment;
      runningBalance += dailyChange;
      entry.runningBalance = runningBalance; // Cumulative business investment
      entry.netBalance = runningBalance; // Show cumulative business investment
    });
    
    // Calculate period totals
    const periodDisbursement = sortedEntries.reduce((sum, entry) => sum + entry.loanDisbursement, 0);
    const periodRepayment = sortedEntries.reduce((sum, entry) => sum + entry.loanRepayment, 0);
    
    
    // Calculate closing balance = opening + disbursements - repayments in period
    const closingBalance = openingBalance + periodDisbursement - periodRepayment;
    
    
    return { 
      entries: sortedEntries,
      openingBalance,
      closingBalance,
      periodDisbursement,
      periodRepayment
    };
  };
  
  // Memoize capital data calculation to prevent re-computation on every render
  const capitalData = useMemo(() => {
    return processCapitalData();
  }, [dateFrom, dateTo, loans, cashTransactions, loanClosures]);
  
  // Extract values for display
  const { entries, openingBalance, closingBalance, periodDisbursement, periodRepayment } = capitalData;

  const handlePrint = () => {
    if (entries.length === 0 && openingBalance === 0) {
      alert("प्रिंट करण्यासाठी प्रथम तारीख निवडा आणि डेटा लोड करा");
      return;
    }
    
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
        .capital-header {
          text-align: center;
          margin-bottom: 20px;
          font-weight: bold;
        }
        .capital-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          table-layout: fixed;
        }
        .capital-table th,
        .capital-table td {
          border: 2px solid #1e40af;
          padding: 8px 10px;
          text-align: center;
        }
        /* Column widths for proper balance */
        .capital-table th:nth-child(1), .capital-table td:nth-child(1) { width: 8% !important; }
        .capital-table th:nth-child(2), .capital-table td:nth-child(2) { width: 12% !important; }
        .capital-table th:nth-child(3), .capital-table td:nth-child(3) { width: 18% !important; }
        .capital-table th:nth-child(4), .capital-table td:nth-child(4) { width: 12% !important; }
        .capital-table th:nth-child(5), .capital-table td:nth-child(5) { width: 18% !important; }
        .capital-table th:nth-child(6), .capital-table td:nth-child(6) { width: 12% !important; }
        .capital-table th:nth-child(7), .capital-table td:nth-child(7) { width: 20% !important; }
        .capital-table th {
          background: #f0f0f0;
          color: black;
          font-weight: bold;
          font-size: 12px;
        }
        .capital-table td {
          background: white;
          font-weight: 600;
          font-size: 9pt; /* Changed to 9pt for table data only */
        }
        .amount-col {
          text-align: right;
        }
        .total-row td {
          background: white !important;
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
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        // Clean up - remove injected print styles
        document.head.removeChild(styleSheet);
      }, 1000);
    }, 100);
  };

  // Excel Export Function  
  const handleExcelExport = () => {
    try {
      const excelData = entries.map((entry, index) => ({
        serialNo: index + 1,
        date: new Date(entry.date).toLocaleDateString('en-GB'),
        repaymentAmount: entry.loanRepayment || 0,
        repaymentPageNo: entry.repaymentPageNo || '-',
        disbursementAmount: entry.loanDisbursement || 0,
        disbursementPageNo: entry.disbursementPageNo || '-',
        netBalance: entry.netBalance || 0
      }));

      // Add opening balance row if exists
      if (openingBalance !== 0) {
        excelData.unshift({
          serialNo: 0,
          date: new Date(dateFrom).toLocaleDateString('en-GB'),
          repaymentAmount: 0,
          repaymentPageNo: '-',
          disbursementAmount: 0,
          disbursementPageNo: '-',
          netBalance: openingBalance
        });
      }

      const success = exportCapitalAccountToExcel(
        excelData,
        (company as any)?.name || 'कंपनी',
        { from: dateFrom, to: dateTo }
      );
      
      if (success) {
        alert('भांडवल खाते अहवाल यशस्वीरित्या एक्सेल फाइलमध्ये एक्सपोर्ट झाला!');
      } else {
        alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
      }
    } catch (error) {
      console.error('Excel export error:', error);
      alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
    }
  };

  const handleMobilePdfDownload = async () => {
    if (entries.length === 0 && openingBalance === 0) {
      alert("प्रथम तारीख निवडा आणि डेटा लोड करा");
      return;
    }

    try {
      const renderWidthPx = 794;
      const companyName = (company as any)?.name || 'कंपनी नाव';
      const bdr = '0.5px solid #bbb';
      const thStyle = `border:none;border-top:1px solid #333;border-bottom:1px solid #333;padding:8px 4px;text-align:center;font-size:9px;background:#f0f0f0;font-weight:bold;line-height:1.4;`;
      const tdBase = `border:none;border-bottom:0.5px solid #ddd;padding:7px 5px;font-size:10px;font-weight:600;line-height:1.5;`;

      let rows = '';
      rows += `<tr style="background:#fff4e6;">
        <td style="${tdBase}text-align:center;">-</td>
        <td style="${tdBase}text-align:center;">${new Date(dateFrom).toLocaleDateString('en-GB')}</td>
        <td style="${tdBase}text-align:center;">-</td>
        <td style="${tdBase}text-align:center;">-</td>
        <td style="${tdBase}text-align:center;">-</td>
        <td style="${tdBase}text-align:center;">-</td>
        <td style="${tdBase}text-align:right;font-weight:bold;font-size:12px;background:#eef2ff;color:#1e40af;white-space:nowrap;"><span style="font-size:12px;">${openingBalance.toLocaleString('en-IN')}</span> <span style="font-size:9px;">ओपनिंग बॅलन्स</span></td>
      </tr>`;

      entries.forEach((entry: any, index: number) => {
        rows += `<tr>
          <td style="${tdBase}text-align:center;">${index + 1}</td>
          <td style="${tdBase}text-align:center;">${new Date(entry.date).toLocaleDateString('en-GB')}</td>
          <td style="${tdBase}text-align:right;">${entry.loanRepayment > 0 ? '<span style="font-weight:bold;">' + entry.loanRepayment.toLocaleString('en-IN') + '</span>' : '<span style="color:#999;">-</span>'}</td>
          <td style="${tdBase}text-align:center;">${entry.loanRepayment > 0 && entry.repaymentPageNo ? entry.repaymentPageNo : '<span style="color:#999;">-</span>'}</td>
          <td style="${tdBase}text-align:right;">${entry.loanDisbursement > 0 ? '<span style="font-weight:bold;">' + entry.loanDisbursement.toLocaleString('en-IN') + '</span>' : '<span style="color:#999;">-</span>'}</td>
          <td style="${tdBase}text-align:center;">${entry.loanDisbursement > 0 && entry.disbursementPageNo ? entry.disbursementPageNo : '<span style="color:#999;">-</span>'}</td>
          <td style="${tdBase}text-align:right;font-weight:bold;font-size:12px;background:#eef2ff;color:#1e40af;">${entry.netBalance.toLocaleString('en-IN')}</td>
        </tr>`;
      });

      const totTd = `border:none;border-top:1px solid #333;border-bottom:1px solid #333;padding:7px 5px;font-size:10px;font-weight:bold;line-height:1.5;background:#e3f2fd;`;
      if (entries.length > 0 || openingBalance !== 0) {
        rows += `<tr>
          <td style="${totTd}text-align:center;"></td>
          <td style="${totTd}text-align:center;"></td>
          <td style="${totTd}text-align:right;">${periodRepayment.toLocaleString('en-IN')}</td>
          <td style="${totTd}text-align:center;"></td>
          <td style="${totTd}text-align:right;">${periodDisbursement.toLocaleString('en-IN')}</td>
          <td style="${totTd}text-align:center;"></td>
          <td style="${totTd}text-align:right;font-size:12px;background:#c7d2fe;color:#1e40af;white-space:nowrap;"><span style="font-size:12px;">${closingBalance.toLocaleString('en-IN')}</span> <span style="font-size:9px;">क्लोजिंग बॅलन्स</span></td>
        </tr>`;
      }

      const fullHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: white; width: ${renderWidthPx}px; padding: 20px 30px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      </style></head><body>
        <div style="text-align:center;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #ddd;">
          <p style="font-size:18px;font-weight:bold;margin-bottom:6px;">${companyName}</p>
          <p style="font-size:15px;font-weight:bold;margin-bottom:4px;">भांडवल खाते</p>
          <p style="font-size:11px;color:#555;margin-bottom:3px;">नमुना क्रमांक १३ (नियम १८ पहा)</p>
          <p style="font-size:11px;color:#555;">कालावधी: ${new Date(dateFrom).toLocaleDateString('en-GB')} ते ${new Date(dateTo).toLocaleDateString('en-GB')}</p>
        </div>
        <table>
          <colgroup>
            <col style="width:5%;">
            <col style="width:11%;">
            <col style="width:18%;">
            <col style="width:9%;">
            <col style="width:17%;">
            <col style="width:8%;">
            <col style="width:25%;">
          </colgroup>
          <thead>
            <tr>
              <th style="${thStyle}">अ.क्र.</th>
              <th style="${thStyle}">दिनांक</th>
              <th style="${thStyle}">कर्जाची रकमेची एकूण परतफेड</th>
              <th style="${thStyle}">रोकड वहीतील पान क्रमांक</th>
              <th style="${thStyle}">कर्ज वाटपाची एकूण रक्कम</th>
              <th style="${thStyle}">रोकड वहीतील पान क्रमांक</th>
              <th style="${thStyle}background:#dbeafe;font-size:10px;">व्यवसायात गुंतवलेली निव्वळ शिल्लक रक्कम</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body></html>`;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = renderWidthPx + 'px';
      iframe.style.height = '2000px';
      iframe.style.border = 'none';
      iframe.style.overflow = 'visible';
      iframe.style.zIndex = '-9999';
      iframe.style.pointerEvents = 'none';
      iframe.style.opacity = '0';

      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        alert("PDF तयार करण्यात समस्या आली.");
        return;
      }

      iframeDoc.open();
      iframeDoc.write(fullHTML);
      iframeDoc.close();

      await new Promise(resolve => setTimeout(resolve, 400));

      const targetEl = iframeDoc.body;
      const contentHeight = targetEl.scrollHeight;

      const canvas = await html2canvas(targetEl, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 0,
        width: renderWidthPx,
        height: contentHeight,
        windowWidth: renderWidthPx,
        windowHeight: contentHeight,
      });

      document.body.removeChild(iframe);

      const imgData = canvas.toDataURL('image/png');
      const pageWidth = 210;
      const pageHeight = 297;
      const marginTop = 8;
      const marginBottom = 8;
      const usableHeight = pageHeight - marginTop - marginBottom;
      const imgTotalHeight = (canvas.height * pageWidth) / canvas.width;
      const totalPages = Math.ceil(imgTotalHeight / usableHeight);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) doc.addPage();
        const yOffset = marginTop - (page * usableHeight);
        doc.addImage(imgData, 'PNG', 0, yOffset, pageWidth, imgTotalHeight);
      }

      doc.save(`भांडवल_खाते_नमुना१३_${dateFrom}_to_${dateTo}.pdf`);
    } catch (error) {
      console.error('Mobile PDF generation error:', error);
      const existingIframe = document.querySelector('iframe[style*="-9999px"]');
      if (existingIframe) existingIframe.remove();
      alert("PDF तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
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
            
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-foreground heading-professional">भांडवल खाते</h1>
              <p className="text-muted-foreground">नमुना क्रमांक १३ (नियम १८ पहा) - कर्ज वाटप अहवाल</p>
            </div>

            {/* Date Filter */}
            <Card className="mb-6 card-professional">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  तारीख निवडा
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <Label htmlFor="dateFrom" className="text-sm font-semibold text-gray-700">
                      या तारखेपासून (From Date)
                    </Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="border-2 border-indigo-200 focus:border-indigo-500 font-inter"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateTo" className="text-sm font-semibold text-gray-700">
                      या तारखेपर्यंत (To Date)
                    </Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="border-2 border-indigo-200 focus:border-indigo-500 font-inter"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-gray-700">रिपोर्ट पाहा</Label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Button 
                        onClick={handlePrint} 
                        className="btn-professional btn-primary print:hidden"
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        प्रिंट करा
                      </Button>
                      {!isMobile && (
                        <Button 
                          onClick={handleExcelExport} 
                          className="btn-professional print:hidden bg-green-50 hover:bg-green-100 text-green-700 border-green-200" 
                          variant="outline"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          एक्सेल एक्सपोर्ट
                        </Button>
                      )}
                      {isMobile && (
                        <Button 
                          onClick={handleMobilePdfDownload} 
                          className="btn-professional print:hidden bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200" 
                          variant="outline"
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          मोबाईल PDF
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-1"></div>
                </div>
              </CardContent>
            </Card>

            {/* Report Display */}
            <Card>
              <CardContent className="p-0">
                <div className="print-content">
                {/* Professional Header */}
                <div className="capital-header" style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold' }}>
                  <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>भांडवल खाते</h1>
                  <p style={{ fontSize: '16px', marginBottom: '2px' }}>नमुना क्रमांक १३</p>
                  <p style={{ fontSize: '14px', marginBottom: '20px' }}>(नियम १८ पहा)</p>
                  {dateFrom && dateTo && (
                    <p style={{ fontSize: '16px', marginBottom: '20px' }}>
                      कालावधी: {new Date(dateFrom).toLocaleDateString('en-GB')} ते {new Date(dateTo).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="capital-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px', background: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>अ.क्र.</th>
                        <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px', background: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>दिनांक</th>
                        <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px', background: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>कर्जाची रकमेची एकूण परतफेड</th>
                        <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px', background: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>रोकड वहीतील पान क्रमांक</th>
                        <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px', background: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>कर्ज वाटपाची एकूण रक्कम</th>
                        <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px', background: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>रोकड वहीतील पान क्रमांक</th>
                        <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px', background: '#f0f0f0', fontWeight: 'bold', textAlign: 'center' }}>व्यवसायात गुंतवलेली निव्वळ शिल्लक रक्कम</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!dateFrom || !dateTo ? (
                        <tr>
                          <td colSpan={7} style={{ border: '2px solid #1e40af', padding: '40px', textAlign: 'center', fontSize: '16px' }}>
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>कृपया तारीख निवडा</p>
                              <p style={{ fontSize: '14px', color: '#666' }}>वरील तारीख फील्डमध्ये From आणि To तारीख निवडा</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <>
                          {/* Opening Balance Row - Always show for period start */}
                          <tr style={{ background: '#fff4e6' }}>
                            <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>-</td>
                            <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>
                              {new Date(dateFrom).toLocaleDateString('en-GB')}
                            </td>
                            <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>-</td>
                            <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>-</td>
                            <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>-</td>
                            <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>-</td>
                            <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold' }}>
                              {openingBalance.toLocaleString('en-IN')} (ओपनिंग बॅलन्स)
                            </td>
                          </tr>
                          
                          {/* Transaction Rows - Daily Totals */}
                          {entries.length === 0 && openingBalance === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ border: '2px solid #1e40af', padding: '40px', textAlign: 'center', fontSize: '16px' }}>
                                <div style={{ textAlign: 'center' }}>
                                  <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>निवडलेल्या कालावधीत कोणतेही व्यवहार आढळले नाहीत</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            entries.map((entry, index) => (
                              <tr key={index}>
                                <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>
                                  {index + 1}
                                </td>
                                <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>
                                  {new Date(entry.date).toLocaleDateString('en-GB')}
                                </td>
                                <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px', fontWeight: '600' }}>
                                  {entry.loanRepayment > 0 ? (
                                    <span style={{ fontWeight: 'bold' }}>
                                      {entry.loanRepayment.toLocaleString('en-IN')}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#999', fontWeight: '600' }}>-</span>
                                  )}
                                </td>
                                <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>
                                  {entry.loanRepayment > 0 && entry.repaymentPageNo ? (
                                    <span style={{ fontWeight: '600' }}>{entry.repaymentPageNo}</span>
                                  ) : (
                                    <span style={{ color: '#999' }}>-</span>
                                  )}
                                </td>
                                <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px', fontWeight: '600' }}>
                                  {entry.loanDisbursement > 0 ? (
                                    <span style={{ fontWeight: 'bold' }}>
                                      {entry.loanDisbursement.toLocaleString('en-IN')}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#999', fontWeight: '600' }}>-</span>
                                  )}
                                </td>
                                <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>
                                  {entry.loanDisbursement > 0 && entry.disbursementPageNo ? (
                                    <span style={{ fontWeight: '600' }}>{entry.disbursementPageNo}</span>
                                  ) : (
                                    <span style={{ color: '#999' }}>-</span>
                                  )}
                                </td>
                                <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold' }}>
                                  {entry.netBalance.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            ))
                          )}
                          
                          {/* Closing Balance Row */}
                          {(entries.length > 0 || openingBalance !== 0) && (
                            <tr className="total-row" style={{ background: '#e3f2fd' }}>
                              <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', background: '#e3f2fd' }}>-</td>
                              <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', background: '#e3f2fd' }}>
                                {new Date(dateTo).toLocaleDateString('en-GB')}
                              </td>
                              <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold', background: '#e3f2fd' }}>
                                {periodRepayment.toLocaleString('en-IN')}
                              </td>
                              <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', background: '#e3f2fd' }}>एकूण</td>
                              <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold', background: '#e3f2fd' }}>
                                {periodDisbursement.toLocaleString('en-IN')}
                              </td>
                              <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', background: '#e3f2fd' }}>एकूण</td>
                              <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold', background: '#e3f2fd' }}>
                                {closingBalance.toLocaleString('en-IN')} क्लोजिंग बॅलन्स
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Minimal print footer */}
                {entries.length > 0 && (
                  <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                    <p>अहवाल तयार केल्याची तारीख: {new Date().toLocaleDateString('en-GB')}</p>
                  </div>
                )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

    </div>
  );
}