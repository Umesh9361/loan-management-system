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

function getCurrentFinancialYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 3) {
    return { start: `${year}-04-01`, end: `${year + 1}-03-31` };
  } else {
    return { start: `${year - 1}-04-01`, end: `${year}-03-31` };
  }
}

export default function CapitalAccountReport() {
  const { toast } = useToast();
  const fy = getCurrentFinancialYear();
  const [dateFrom, setDateFrom] = useState(fy.start);
  const [dateTo, setDateTo] = useState(fy.end);
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
          size: A4 portrait;
          margin: 10mm 8mm 10mm 25.4mm;
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
          padding-left: 25mm !important;
          box-sizing: border-box !important;
          font-family: 'Noto Sans Devanagari', Arial, sans-serif !important;
        }
        body {
          font-family: 'Noto Sans Devanagari', Arial, sans-serif !important;
          font-size: 11px;
          line-height: 1.4;
        }
        .capital-header {
          text-align: center;
          margin-bottom: 16px;
          font-weight: bold;
        }
        .capital-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .capital-table th,
        .capital-table td {
          border: 1.5px solid #333 !important;
          padding: 8px 6px !important;
          text-align: center !important;
          font-family: 'Noto Sans Devanagari', Arial, sans-serif !important;
        }
        .capital-table th:nth-child(1), .capital-table td:nth-child(1) { width: 6% !important; }
        .capital-table th:nth-child(2), .capital-table td:nth-child(2) { width: 12% !important; }
        .capital-table th:nth-child(3), .capital-table td:nth-child(3) { width: 18% !important; }
        .capital-table th:nth-child(4), .capital-table td:nth-child(4) { width: 10% !important; }
        .capital-table th:nth-child(5), .capital-table td:nth-child(5) { width: 18% !important; }
        .capital-table th:nth-child(6), .capital-table td:nth-child(6) { width: 10% !important; }
        .capital-table th:nth-child(7), .capital-table td:nth-child(7) { width: 26% !important; }
        .capital-table th {
          background: #f0f0f0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color: #111 !important;
          font-weight: 700 !important;
          font-size: 11px !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          line-height: 1.3 !important;
        }
        .capital-table td {
          background: white !important;
          font-weight: 600 !important;
          font-size: 12px !important;
        }
        .capital-table .opening-row td {
          background: #fef3c7 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .capital-table .closing-row td {
          background: #e0e7ff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-weight: 700;
        }
        .amount-col {
          text-align: right !important;
        }
        .capital-print-footer {
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 600;
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
      const bdr = '1.5px solid #333';
      const thStyle = `border:${bdr};padding:8px 6px;text-align:center;font-size:11px;background:#f0f0f0;font-weight:700;color:#111;line-height:1.3;word-wrap:break-word;overflow-wrap:break-word;`;
      const tdBase = `border:${bdr};padding:8px 6px;font-size:12px;font-weight:600;line-height:1.4;`;

      let rows = '';
      rows += `<tr>
        <td style="${tdBase}text-align:center;background:#fef3c7;">-</td>
        <td style="${tdBase}text-align:center;background:#fef3c7;">${new Date(dateFrom).toLocaleDateString('en-GB')}</td>
        <td style="${tdBase}text-align:center;background:#fef3c7;">-</td>
        <td style="${tdBase}text-align:center;background:#fef3c7;">-</td>
        <td style="${tdBase}text-align:center;background:#fef3c7;">-</td>
        <td style="${tdBase}text-align:center;background:#fef3c7;">-</td>
        <td style="${tdBase}text-align:right;font-weight:700;background:#fef3c7;white-space:nowrap;">${openingBalance.toLocaleString('en-IN')} (प्रारंभिक शिल्लक)</td>
      </tr>`;

      entries.forEach((entry: any, index: number) => {
        rows += `<tr>
          <td style="${tdBase}text-align:center;">${index + 1}</td>
          <td style="${tdBase}text-align:center;white-space:nowrap;">${new Date(entry.date).toLocaleDateString('en-GB')}</td>
          <td style="${tdBase}text-align:right;">${entry.loanRepayment > 0 ? entry.loanRepayment.toLocaleString('en-IN') : '-'}</td>
          <td style="${tdBase}text-align:center;">${entry.loanRepayment > 0 && entry.repaymentPageNo ? entry.repaymentPageNo : '-'}</td>
          <td style="${tdBase}text-align:right;">${entry.loanDisbursement > 0 ? entry.loanDisbursement.toLocaleString('en-IN') : '-'}</td>
          <td style="${tdBase}text-align:center;">${entry.loanDisbursement > 0 && entry.disbursementPageNo ? entry.disbursementPageNo : '-'}</td>
          <td style="${tdBase}text-align:right;font-weight:700;">${entry.netBalance.toLocaleString('en-IN')}</td>
        </tr>`;
      });

      if (entries.length > 0 || openingBalance !== 0) {
        rows += `<tr>
          <td style="${tdBase}text-align:center;background:#e0e7ff;font-weight:700;">-</td>
          <td style="${tdBase}text-align:center;background:#e0e7ff;font-weight:700;">${new Date(dateTo).toLocaleDateString('en-GB')}</td>
          <td style="${tdBase}text-align:right;background:#e0e7ff;font-weight:700;">${periodRepayment.toLocaleString('en-IN')}</td>
          <td style="${tdBase}text-align:center;background:#e0e7ff;font-weight:700;">एकूण</td>
          <td style="${tdBase}text-align:right;background:#e0e7ff;font-weight:700;">${periodDisbursement.toLocaleString('en-IN')}</td>
          <td style="${tdBase}text-align:center;background:#e0e7ff;font-weight:700;">एकूण</td>
          <td style="${tdBase}text-align:right;background:#e0e7ff;font-weight:700;white-space:nowrap;">${closingBalance.toLocaleString('en-IN')} (अंतिम शिल्लक)</td>
        </tr>`;
      }

      const fullHTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; background: white; width: ${renderWidthPx}px; padding: 18px 14px 18px 83px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      </style></head><body>
        <div style="text-align:center;margin-bottom:16px;">
          <p style="font-size:15px;font-weight:700;margin-bottom:4px;">${companyName}</p>
          <p style="font-size:14px;font-weight:700;margin-bottom:2px;">भांडवल खाते</p>
          <p style="font-size:11px;color:#333;margin-bottom:2px;">नमुना क्रमांक १३ (नियम १९ पहा)</p>
          <p style="font-size:11px;color:#333;">कालावधी: ${new Date(dateFrom).toLocaleDateString('en-GB')} ते ${new Date(dateTo).toLocaleDateString('en-GB')}</p>
        </div>
        <table>
          <colgroup>
            <col style="width:6%;">
            <col style="width:12%;">
            <col style="width:18%;">
            <col style="width:10%;">
            <col style="width:18%;">
            <col style="width:10%;">
            <col style="width:26%;">
          </colgroup>
          <thead>
            <tr>
              <th style="${thStyle}">अ.क्र.</th>
              <th style="${thStyle}">दिनांक</th>
              <th style="${thStyle}">कर्जाची रकमेची एकूण परतफेड</th>
              <th style="${thStyle}">रोकड वहीतील पान क्रमांक</th>
              <th style="${thStyle}">कर्ज वाटपाची एकूण रक्कम</th>
              <th style="${thStyle}">रोकड वहीतील पान क्रमांक</th>
              <th style="${thStyle}">व्यवसायात गुंतवलेली<br>निव्वळ शिल्लक रक्कम</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:50px;display:flex;justify-content:space-between;font-size:11px;font-weight:600;">
          <span>तयार केल्याची तारीख: ${new Date().toLocaleDateString('en-GB')}</span>
          <span>अधिकृत स्वाक्षरी</span>
        </div>
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

      await new Promise(resolve => setTimeout(resolve, 300));
      if (iframeDoc.fonts && iframeDoc.fonts.ready) {
        await iframeDoc.fonts.ready;
      }
      await new Promise(resolve => setTimeout(resolve, 100));

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
      const marginLeft = 0;
      const marginTop = 8;
      const marginBottom = 8;
      const contentWidth = pageWidth - marginLeft;
      const usableHeight = pageHeight - marginTop - marginBottom;
      const imgTotalHeight = (canvas.height * contentWidth) / canvas.width;
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
        doc.addImage(imgData, 'PNG', marginLeft, yOffset, contentWidth, imgTotalHeight);
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
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground heading-professional">भांडवल खाते</h1>
              <p className="text-muted-foreground">नमुना क्रमांक १३ (नियम १९ पहा) - कर्ज वाटप अहवाल</p>
            </div>

            {/* Date Filter */}
            <Card className="mb-6 card-professional">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 md:text-xl">
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
                <div className="print-content" style={{ fontFamily: "'Noto Sans Devanagari', Arial, sans-serif" }}>
                <div className="capital-header" style={{ textAlign: 'center', marginBottom: '16px', fontWeight: 'bold' }}>
                  <p style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>{(company as any)?.name || 'कंपनी नाव'}</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>भांडवल खाते</p>
                  <p style={{ fontSize: '11px', color: '#333', marginBottom: '2px' }}>नमुना क्रमांक १३ (नियम १९ पहा)</p>
                  {dateFrom && dateTo && (
                    <p style={{ fontSize: '11px', color: '#333' }}>
                      कालावधी: {new Date(dateFrom).toLocaleDateString('en-GB')} ते {new Date(dateTo).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="capital-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '6%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '26%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ border: '1.5px solid #333', padding: '10px 8px', fontSize: '13px', background: '#f0f0f0', fontWeight: 700, textAlign: 'center', color: '#111' }}>अ.क्र.</th>
                        <th style={{ border: '1.5px solid #333', padding: '10px 8px', fontSize: '13px', background: '#f0f0f0', fontWeight: 700, textAlign: 'center', color: '#111' }}>दिनांक</th>
                        <th style={{ border: '1.5px solid #333', padding: '10px 8px', fontSize: '13px', background: '#f0f0f0', fontWeight: 700, textAlign: 'center', color: '#111' }}>कर्जाची रकमेची एकूण परतफेड</th>
                        <th style={{ border: '1.5px solid #333', padding: '10px 8px', fontSize: '13px', background: '#f0f0f0', fontWeight: 700, textAlign: 'center', color: '#111' }}>रोकड वहीतील पान क्रमांक</th>
                        <th style={{ border: '1.5px solid #333', padding: '10px 8px', fontSize: '13px', background: '#f0f0f0', fontWeight: 700, textAlign: 'center', color: '#111' }}>कर्ज वाटपाची एकूण रक्कम</th>
                        <th style={{ border: '1.5px solid #333', padding: '10px 8px', fontSize: '13px', background: '#f0f0f0', fontWeight: 700, textAlign: 'center', color: '#111' }}>रोकड वहीतील पान क्रमांक</th>
                        <th style={{ border: '1.5px solid #333', padding: '10px 8px', fontSize: '13px', background: '#f0f0f0', fontWeight: 700, textAlign: 'center', color: '#111' }}>व्यवसायात गुंतवलेली<br />निव्वळ शिल्लक रक्कम</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!dateFrom || !dateTo ? (
                        <tr>
                          <td colSpan={7} style={{ border: '1.5px solid #333', padding: '40px', textAlign: 'center', fontSize: '14px' }}>
                            <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>कृपया तारीख निवडा</p>
                            <p style={{ fontSize: '12px', color: '#666' }}>वरील तारीख फील्डमध्ये From आणि To तारीख निवडा</p>
                          </td>
                        </tr>
                      ) : (
                        <>
                          <tr className="opening-row" style={{ background: '#fef3c7' }}>
                            <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>-</td>
                            <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {new Date(dateFrom).toLocaleDateString('en-GB')}
                            </td>
                            <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>-</td>
                            <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>-</td>
                            <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>-</td>
                            <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>-</td>
                            <td className="amount-col" style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {openingBalance.toLocaleString('en-IN')} (प्रारंभिक शिल्लक)
                            </td>
                          </tr>
                          
                          {entries.length === 0 && openingBalance === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ border: '1.5px solid #333', padding: '30px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
                                निवडलेल्या कालावधीत कोणतेही व्यवहार आढळले नाहीत
                              </td>
                            </tr>
                          ) : (
                            entries.map((entry, index) => (
                              <tr key={index}>
                                <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>
                                  {index + 1}
                                </td>
                                <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  {new Date(entry.date).toLocaleDateString('en-GB')}
                                </td>
                                <td className="amount-col" style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>
                                  {entry.loanRepayment > 0 ? entry.loanRepayment.toLocaleString('en-IN') : '-'}
                                </td>
                                <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>
                                  {entry.loanRepayment > 0 && entry.repaymentPageNo ? entry.repaymentPageNo : '-'}
                                </td>
                                <td className="amount-col" style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>
                                  {entry.loanDisbursement > 0 ? entry.loanDisbursement.toLocaleString('en-IN') : '-'}
                                </td>
                                <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>
                                  {entry.loanDisbursement > 0 && entry.disbursementPageNo ? entry.disbursementPageNo : '-'}
                                </td>
                                <td className="amount-col" style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>
                                  {entry.netBalance.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            ))
                          )}
                          
                          {(entries.length > 0 || openingBalance !== 0) && (
                            <tr className="closing-row" style={{ background: '#e0e7ff' }}>
                              <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 700, background: '#e0e7ff' }}>-</td>
                              <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 700, background: '#e0e7ff', whiteSpace: 'nowrap' }}>
                                {new Date(dateTo).toLocaleDateString('en-GB')}
                              </td>
                              <td className="amount-col" style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 700, background: '#e0e7ff' }}>
                                {periodRepayment.toLocaleString('en-IN')}
                              </td>
                              <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 700, background: '#e0e7ff' }}>एकूण</td>
                              <td className="amount-col" style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 700, background: '#e0e7ff' }}>
                                {periodDisbursement.toLocaleString('en-IN')}
                              </td>
                              <td style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 700, background: '#e0e7ff' }}>एकूण</td>
                              <td className="amount-col" style={{ border: '1.5px solid #333', padding: '10px 8px', textAlign: 'right', fontSize: '13px', fontWeight: 700, background: '#e0e7ff', whiteSpace: 'nowrap' }}>
                                {closingBalance.toLocaleString('en-IN')} (अंतिम शिल्लक)
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="capital-print-footer" style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                  <span>तयार केल्याची तारीख: {new Date().toLocaleDateString('en-GB')}</span>
                  <span>अधिकृत स्वाक्षरी</span>
                </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

    </div>
  );
}