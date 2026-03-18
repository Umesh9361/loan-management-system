import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { DateUtils } from "@/lib/date-utils";
import { displayNarration } from "@/lib/utils";
import { LoanCalculations } from "@/lib/loan-calculations";
import { useQuery } from "@tanstack/react-query";
import { useRealTimeSync } from "@/hooks/use-real-time-sync";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Printer, FileDown, FileSpreadsheet } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
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

function CashBookReport() {
  const fy = getCurrentFinancialYear();
  const [dateFilters, setDateFilters] = useState({
    dateFrom: fy.start,
    dateTo: fy.end
  });
  const [printFormat, setPrintFormat] = useState<'vertical' | 'horizontal'>('horizontal');
  const printRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // 🚀 REAL-TIME SYNC: Enable automatic updates for all loan operations
  const { triggerCompleteSync } = useRealTimeSync({
    enabled: true,
    onSyncComplete: (operation) => {
      console.log(`📊 CASHBOOK REPORT: Real-time sync completed for ${operation}`);
    }
  });

  // Fetch company data
  const { data: company } = useQuery({ queryKey: ['/api/company'] });

  // Fetch cash transactions with date filters
  const { data: transactions = [], isLoading, error, refetch } = useQuery({
    queryKey: [`/api/cash-transactions`, {
      dateFrom: dateFilters.dateFrom,
      dateTo: dateFilters.dateTo
    }],
    enabled: !!dateFilters.dateFrom && !!dateFilters.dateTo,
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateFilters.dateFrom,
        dateTo: dateFilters.dateTo
      });
      
      console.log('🔄 CASHBOOK API CALL: Fetching with dates:', {
        dateFrom: dateFilters.dateFrom,
        dateTo: dateFilters.dateTo,
        url: `/api/cash-transactions?${params.toString()}`
      });
      
      const response = await fetch(`/api/cash-transactions?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    }
  });

  const { data: cashBalance } = useQuery({
    queryKey: ['/api/cash-balance', { date: dateFilters.dateFrom }],
    queryFn: async () => {
      const response = await fetch(`/api/cash-balance?date=${dateFilters.dateFrom}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch balance');
      return response.json();
    },
    enabled: !!dateFilters.dateFrom,
  });

  const handleFilter = () => {
    console.log('🔄 MANUAL FILTER: Button clicked with dates:', {
      dateFrom: dateFilters.dateFrom,
      dateTo: dateFilters.dateTo,
      convertedFrom: DateUtils.isoToDDMMYYYY(dateFilters.dateFrom),
      convertedTo: DateUtils.isoToDDMMYYYY(dateFilters.dateTo)
    });
    refetch();
  };

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
        .cashbook-header {
          text-align: center;
          margin-bottom: 20px;
          font-weight: bold;
        }
        .print-company-name {
          display: none !important;
        }
        .screen-title {
          display: none !important;
        }
        .print-title {
          display: block !important;
          text-align: center;
          font-size: 13px !important;
          line-height: 1.2;
          margin-bottom: 10px;
        }
        /* T-format table print styles */
        .t-format-table table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 11px;
        }
        .t-format-table td {
          border: 1px solid #000;
          padding: 4px 6px;
          vertical-align: top;
          background: white !important;
          font-size: 9pt; /* Changed to 9pt for table data only */
        }
        /* Remove all background colors in print */
        .print:hidden { display: none !important; }
        .print\\:block { display: block !important; }
        .t-format-table .bg-indigo-100,
        .t-format-table .bg-indigo-50,
        .t-format-table .bg-red-100,
        .t-format-table .bg-yellow-50,
        .bg-indigo-50,
        .bg-indigo-100,
        .bg-yellow-50,
        .bg-red-100 {
          background: white !important;
        }
        /* Bold styling for balance rows in print */
        .t-format-table .font-bold {
          font-weight: bold !important;
        }
        /* Make amount figures in balance rows extra bold */
        .t-format-table .bg-indigo-100 .amount-bold,
        .t-format-table .bg-indigo-50 .amount-bold {
          font-weight: 900 !important;
          font-size: 12px !important;
        }
        /* Total row styling */
        .border-t-2 {
          border-top: 2px solid #000 !important;
        }
        .border-r-2 {
          border-right: 2px solid #000 !important;
        }
        /* Header styling */
        .professional-t-format .border-b-4 {
          border-bottom: 2px solid #000 !important;
        }
        /* Reduce header text size in print */
        .t-format-table h3 {
          font-size: 12px !important;
          font-weight: bold;
        }
        .t-format-table .text-lg {
          font-size: 12px !important;
        }
        .t-format-table .text-sm {
          font-size: 10px !important;
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
        if (printContentDiv) {
          printContentDiv.style.display = '';
          printContentDiv.style.visibility = '';
        }
      }, 1000);
    }, 100);
  };

  const handleExportExcel = () => {
    const excelData = [];
    
    // Company header
    excelData.push([`${(company as any)?.name || 'कंपनी नाव'} - रोकड वही अहवाल (नमुना क्र. ७)`]);
    excelData.push([`${DateUtils.isoToIndianDate(dateFilters.dateFrom)} ते ${DateUtils.isoToIndianDate(dateFilters.dateTo)}`]);
    excelData.push([]); // Empty row

    if (printFormat === 'vertical') {
      // Vertical format Excel (matches screen display)
      excelData.push(['तारीख', 'तपशील', 'जमा (Cr.)', 'नावे (Dr.)', 'शिल्लक']);
      
      // Add all transaction rows exactly as displayed on screen
      processedTransactions.forEach(row => {
        excelData.push([
          DateUtils.isoToIndianDate(row.date),
          row.description,
          row.credit ? `${LoanCalculations.formatAmount(row.credit)}` : '',
          row.debit ? `${LoanCalculations.formatAmount(row.debit)}` : '',
          `${LoanCalculations.formatAmount(row.balance)}`
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(excelData);
      ws['!cols'] = [
        { width: 12 }, // तारीख
        { width: 35 }, // तपशील
        { width: 15 }, // जमा
        { width: 15 }, // नावे
        { width: 15 }  // शिल्लक
      ];
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CashBook Vertical');
      XLSX.writeFile(wb, `CashBook_Vertical_${dateFilters.dateFrom}_to_${dateFilters.dateTo}.xlsx`);
      
    } else {
      // Horizontal T-format Excel (matches screen display)
      const { creditRows, debitRows, grandTotalCredit, grandTotalDebit } = getHorizontalData();
      
      // Find maximum rows between credit and debit sides
      const maxRows = Math.max(creditRows.length, debitRows.length);
      
      // T-format headers - FIXED: Credit first, then Debit (matches screen)
      excelData.push([
        'जमा (Credit)', '', '', 'नावे (Debit)', '', ''
      ]);
      excelData.push([
        'दिनांक', 'तपशील', 'रक्कम', 'दिनांक', 'तपशील', 'रक्कम'
      ]);
      
      // Add data rows side by side
      for (let i = 0; i < maxRows; i++) {
        const creditRow = creditRows[i] || { date: '', description: '', amount: '' };
        const debitRow = debitRows[i] || { date: '', description: '', amount: '' };
        
        excelData.push([
          creditRow.date ? DateUtils.isoToIndianDate(creditRow.date) : '',
          creditRow.description || '',
          creditRow.amount ? `${LoanCalculations.formatAmount(creditRow.amount)}` : '',
          debitRow.date ? DateUtils.isoToIndianDate(debitRow.date) : '',
          debitRow.description || '',
          debitRow.amount ? `${LoanCalculations.formatAmount(debitRow.amount)}` : ''
        ]);
      }
      
      // Add totals row
      excelData.push([
        '', 'एकूण', `${LoanCalculations.formatAmount(grandTotalCredit)}`,
        '', 'एकूण', `${LoanCalculations.formatAmount(grandTotalDebit)}`
      ]);

      const ws = XLSX.utils.aoa_to_sheet(excelData);
      ws['!cols'] = [
        { width: 12 }, // Credit दिनांक
        { width: 25 }, // Credit तपशील
        { width: 15 }, // Credit रक्कम
        { width: 12 }, // Debit दिनांक
        { width: 25 }, // Debit तपशील
        { width: 15 }  // Debit रक्कम
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CashBook T-Format');
      XLSX.writeFile(wb, `CashBook_T-Format_${dateFilters.dateFrom}_to_${dateFilters.dateTo}.xlsx`);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const companyName = (company as any)?.name || 'कंपनी नाव';
    
    doc.setFontSize(16);
    doc.text(`${companyName} - रोकड वही अहवाल (नमुना क्र. ७)`, 20, 20);
    doc.setFontSize(12);
    doc.text(`${DateUtils.isoToIndianDate(dateFilters.dateFrom)} ते ${DateUtils.isoToIndianDate(dateFilters.dateTo)}`, 20, 30);
    
    if (printFormat === 'vertical') {
      // Vertical format PDF
      const tableData = processedTransactions.map(row => [
        DateUtils.isoToIndianDate(row.date),
        row.description,
        row.credit ? `${LoanCalculations.formatAmount(row.credit)}` : '',
        row.debit ? `${LoanCalculations.formatAmount(row.debit)}` : '',
        `${LoanCalculations.formatAmount(row.balance)}`
      ]);
      
      (doc as any).autoTable({
        head: [['तारीख', 'तपशील', 'जमा (Cr.)', 'नावे (Dr.)', 'शिल्लक']],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 25 }, // तारीख
          1: { cellWidth: 70 }, // तपशील
          2: { cellWidth: 25 }, // जमा
          3: { cellWidth: 25 }, // नावे
          4: { cellWidth: 25 }  // शिल्लक
        }
      });
    } else {
      // T-format PDF
      const { creditRows, debitRows, grandTotalCredit, grandTotalDebit } = getHorizontalData();
      const maxRows = Math.max(creditRows.length, debitRows.length);
      
      const tableData = [];
      for (let i = 0; i < maxRows; i++) {
        const creditRow = creditRows[i] || { date: '', description: '', amount: '' };
        const debitRow = debitRows[i] || { date: '', description: '', amount: '' };
        
        tableData.push([
          creditRow.date ? DateUtils.isoToIndianDate(creditRow.date) : '',
          creditRow.description || '',
          creditRow.amount ? `${LoanCalculations.formatAmount(creditRow.amount)}` : '',
          debitRow.date ? DateUtils.isoToIndianDate(debitRow.date) : '',
          debitRow.description || '',
          debitRow.amount ? `${LoanCalculations.formatAmount(debitRow.amount)}` : ''
        ]);
      }
      
      // Add totals
      tableData.push([
        '', 'एकूण', `${LoanCalculations.formatAmount(grandTotalCredit)}`,
        '', 'एकूण', `${LoanCalculations.formatAmount(grandTotalDebit)}`
      ]);
      
      (doc as any).autoTable({
        head: [['जमा (Credit)', '', '', 'नावे (Debit)', '', ''], ['दिनांक', 'तपशील', 'रक्कम', 'दिनांक', 'तपशील', 'रक्कम']],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 35 },
          5: { cellWidth: 25 }
        }
      });
    }
    
    doc.save(`CashBook_${printFormat}_${dateFilters.dateFrom}_to_${dateFilters.dateTo}.pdf`);
  };

  const handleMobilePdfDownload = async () => {
    if (finalTransactions.length === 0) {
      alert("प्रथम तारीख निवडा आणि डेटा लोड करा");
      return;
    }

    try {
      const renderWidthPx = 794;
      const companyName = (company as any)?.name || 'कंपनी नाव';
      const bdr = '0.5px solid #aaa';
      const thStyle = `border:${bdr};padding:6px 4px;text-align:center;font-size:10px;background:#f5f5f5;font-weight:bold;line-height:1.5;`;
      const tdBase = `border:${bdr};padding:6px 5px;font-size:10px;line-height:1.6;`;

      let tableHTML = '';
      if (printFormat === 'vertical') {
        const rows = finalTransactions.map((row: any, idx: number) => {
          const bgStyle = row.isOpeningBalance ? 'background:#fef9ef;' : (idx % 2 === 1 ? 'background:#fafafa;' : '');
          return `<tr style="${bgStyle}">
            <td style="${tdBase}text-align:center;">${DateUtils.isoToIndianDate(row.date).replace(/20(\d{2})/g, '$1')}</td>
            <td style="${tdBase}text-align:left;">${row.description}</td>
            <td style="${tdBase}text-align:right;">${row.credit ? LoanCalculations.formatAmount(row.credit) : '-'}</td>
            <td style="${tdBase}text-align:right;">${row.debit ? LoanCalculations.formatAmount(row.debit) : '-'}</td>
            <td style="${tdBase}text-align:right;font-weight:600;">${LoanCalculations.formatAmount(row.balance)}</td>
          </tr>`;
        }).join('');

        tableHTML = `
          <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
            <thead>
              <tr>
                <th style="${thStyle}width:12%;">तारीख</th>
                <th style="${thStyle}width:40%;">तपशील</th>
                <th style="${thStyle}width:15%;">जमा (Cr.)</th>
                <th style="${thStyle}width:15%;">नावे (Dr.)</th>
                <th style="${thStyle}width:18%;">शिल्लक</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      } else {
        const hData = getHorizontalData();
        const maxRows = Math.max(hData.creditRows.length, hData.debitRows.length);
        let tRows = '';

        const dtW = '60px';
        const amW = '80px';

        for (let i = 0; i < maxRows; i++) {
          const cr = hData.creditRows[i];
          const dr = hData.debitRows[i];
          const isCrBal = cr?.description?.includes('शिल्लक') || cr?.description?.includes('मागील');
          const isDrBal = dr?.description?.includes('शिल्लक') || dr?.description?.includes('मागील');
          const isBalRow = isCrBal || isDrBal;
          const rowBg = isBalRow ? 'background:#eef2ff;' : (i % 2 === 1 ? 'background:#fafafa;' : '');
          const balCellBg = isBalRow ? 'background:#eef2ff;' : '';

          const crDtStyle = `border:${bdr};padding:4px 2px 5px;font-size:7px;line-height:1.4;color:#666;text-align:center;${balCellBg}${isCrBal ? 'font-weight:bold;color:#333;' : ''}`;
          const crDescStyle = `border:${bdr};padding:5px 4px 6px;font-size:8.5px;line-height:1.5;text-align:left;${balCellBg}${isCrBal ? 'font-weight:bold;font-size:9px;color:#3730a3;' : ''}`;
          const crAmtStyle = `border:${bdr};padding:5px 3px 6px;font-size:8px;line-height:1.5;text-align:right;border-right:1px solid #999;${balCellBg}${isCrBal ? 'font-weight:bold;font-size:9px;' : ''}`;
          const drDtStyle = `border:${bdr};padding:4px 2px 5px;font-size:7px;line-height:1.4;color:#666;text-align:center;${balCellBg}${isDrBal ? 'font-weight:bold;color:#333;' : ''}`;
          const drDescStyle = `border:${bdr};padding:5px 4px 6px;font-size:8.5px;line-height:1.5;text-align:left;${balCellBg}${isDrBal ? 'font-weight:bold;font-size:9px;color:#3730a3;' : ''}`;
          const drAmtStyle = `border:${bdr};padding:5px 3px 6px;font-size:8px;line-height:1.5;text-align:right;${balCellBg}${isDrBal ? 'font-weight:bold;font-size:9px;' : ''}`;

          tRows += `<tr style="${rowBg}">
            <td style="${crDtStyle}">${cr ? DateUtils.isoToIndianDate(cr.date).replace(/20(\d{2})/g, '$1') : ''}</td>
            <td style="${crDescStyle}">${cr?.description || ''}</td>
            <td style="${crAmtStyle}">${cr ? LoanCalculations.formatAmount(cr.amount) : ''}</td>
            <td style="${drDtStyle}">${dr ? DateUtils.isoToIndianDate(dr.date).replace(/20(\d{2})/g, '$1') : ''}</td>
            <td style="${drDescStyle}">${dr?.description || ''}</td>
            <td style="${drAmtStyle}">${dr ? LoanCalculations.formatAmount(dr.amount) : ''}</td>
          </tr>`;
        }

        const totStyle = `border:${bdr};padding:6px 3px;font-size:9px;font-weight:bold;line-height:1.5;border-top:1.5px solid #555;background:#e0e7ff;`;
        tRows += `<tr>
          <td style="${totStyle}text-align:center;"></td>
          <td style="${totStyle}text-align:center;">एकूण</td>
          <td style="${totStyle}text-align:right;border-right:1px solid #999;">${LoanCalculations.formatAmount(hData.grandTotalCredit)}</td>
          <td style="${totStyle}text-align:center;"></td>
          <td style="${totStyle}text-align:center;">एकूण</td>
          <td style="${totStyle}text-align:right;">${LoanCalculations.formatAmount(hData.grandTotalDebit)}</td>
        </tr>`;

        tableHTML = `
          <div style="display:flex;width:100%;border:${bdr};">
            <div style="width:50%;text-align:center;padding:5px 2px;font-size:10px;background:#eef2ff;font-weight:bold;border-right:1px solid #999;">जमा (Credit)</div>
            <div style="width:50%;text-align:center;padding:5px 2px;font-size:10px;background:#fef2f2;font-weight:bold;">नावे (Debit)</div>
          </div>
          <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
            <colgroup>
              <col style="width:${dtW};">
              <col>
              <col style="width:${amW};">
              <col style="width:${dtW};">
              <col>
              <col style="width:${amW};">
            </colgroup>
            <thead>
              <tr>
                <th style="${thStyle}font-size:9px;">दिनांक</th>
                <th style="${thStyle}font-size:10px;">तपशील</th>
                <th style="${thStyle}border-right:1px solid #999;font-size:10px;">रक्कम</th>
                <th style="${thStyle}font-size:9px;">दिनांक</th>
                <th style="${thStyle}font-size:10px;">तपशील</th>
                <th style="${thStyle}font-size:10px;">रक्कम</th>
              </tr>
            </thead>
            <tbody>${tRows}</tbody>
          </table>
        `;
      }

      const fullHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: white; width: ${renderWidthPx}px; padding: 20px 30px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      </style></head><body>
        <div style="text-align:center;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #ddd;">
          <p style="font-size:18px;font-weight:bold;margin-bottom:6px;">${companyName}</p>
          <p style="font-size:15px;font-weight:bold;margin-bottom:4px;">रोकड वही</p>
          <p style="font-size:11px;color:#555;margin-bottom:3px;">नमुना क्र. ७ (नियम १८ पहा)</p>
          <p style="font-size:11px;color:#555;">कालावधी: ${DateUtils.isoToIndianDate(dateFilters.dateFrom)} ते ${DateUtils.isoToIndianDate(dateFilters.dateTo)}</p>
        </div>
        ${tableHTML}
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

      doc.save(`रोकड_वही_नमुना७_${dateFilters.dateFrom}_to_${dateFilters.dateTo}.pdf`);
    } catch (error) {
      console.error('Mobile PDF generation error:', error);
      const existingIframe = document.querySelector('iframe[style*="-9999px"]');
      if (existingIframe) existingIframe.remove();
      alert("PDF तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
  };

  // Processing transactions for display
  console.log('🔄 CASHBOOK: Processing transactions:', {
    count: transactions?.length || 0,
    transactions: transactions || []
  });

  // Calculate opening balance from the fetched cash balance
  const openingBalance = cashBalance?.openingBalance || 0;
  console.log('🔄 BALANCE CALCULATION START:', {
    openingBalance,
    initialRunningBalance: openingBalance,
    cashBalanceObject: cashBalance,
    dateRange: `${dateFilters.dateFrom} to ${dateFilters.dateTo}`
  });

  // Process transactions with running balance calculation
  let runningBalance = openingBalance;
  
  const processedTransactions = (transactions || [])
    .filter((transaction: any) => {
      const transDate = transaction.transactionDate?.split('T')[0] || transaction.transactionDate;
      return transDate >= dateFilters.dateFrom && transDate <= dateFilters.dateTo;
    })
    .sort((a: any, b: any) => {
      const dateCompare = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
      if (dateCompare !== 0) return dateCompare;
      const getAccNum = (t: any) => {
        const match = (t.narration || '').match(/खाते\s*क्र[.॰]?\s*(\d+)/);
        return match ? parseInt(match[1]) : 9999;
      };
      return getAccNum(a) - getAccNum(b);
    })
    .reduce((acc: any[], transaction: any, index: number) => {
      // Skip duplicate "राज पटेल" entries (keep only the first one)
      if (transaction.partyName === 'राज पटेल') {
        const existingRajPatel = acc.find(t => t.partyName === 'राज पटेल' && t.date === transaction.date);
        if (existingRajPatel) {
          console.log(`🔄 SKIPPING DUPLICATE: राज पटेल entry for ${transaction.date}`);
          return acc;
        }
      }
      
      const credit = transaction.transactionType === 'cash_in' ? parseFloat(transaction.amount) : 0;
      const debit = transaction.transactionType === 'cash_out' ? parseFloat(transaction.amount) : 0;
      
      runningBalance = runningBalance + credit - debit;
      
      acc.push({
        date: transaction.transactionDate,
        description: `${transaction.transactionType === 'cash_in' ? 'जमा' : 'नावे'}: ${displayNarration(transaction.narration)}`,
        credit: credit || 0,
        debit: debit || 0,
        balance: runningBalance,
        partyName: transaction.partyName
      });
      
      return acc;
    }, []);

  console.log('✅ CASHBOOK: After deduplication:', {
    original: transactions?.length || 0,
    final: processedTransactions.length,
    rajPatelCount: processedTransactions.filter((t: any) => t.partyName === 'राज पटेल').length
  });

  // Add opening balance row if there are transactions or opening balance exists
  const finalTransactions = [];
  if (processedTransactions.length > 0 || openingBalance !== 0) {
    if (openingBalance !== 0) {
      finalTransactions.push({
        date: dateFilters.dateFrom,
        description: 'प्रारंभिक शिल्लक',
        credit: 0,
        debit: 0,
        balance: openingBalance,
        isOpeningBalance: true
      });
    }
    finalTransactions.push(...processedTransactions);
  }

  // Add summary stats
  const totalCredit = processedTransactions.reduce((sum: number, t: any) => sum + (t.credit || 0), 0);
  const totalDebit = processedTransactions.reduce((sum: number, t: any) => sum + (t.debit || 0), 0);
  const closingBalance = openingBalance + totalCredit - totalDebit;

  console.log('🔄 TRANSACTION COUNT LOGIC:', {
    dateRange: `${DateUtils.isoToDDMMYYYY(dateFilters.dateFrom)} to ${DateUtils.isoToDDMMYYYY(dateFilters.dateTo)}`,
    totalRows: finalTransactions.length,
    afterDateFilter: processedTransactions.length,
    transactions: finalTransactions
  });

  // Get horizontal T-format data for print format switching
  const getHorizontalData = () => {
    console.log('📊 HORIZONTAL: Processing transactions:', {
      actualCount: processedTransactions.length,
      rajPatelEntries: processedTransactions.filter((t: any) => t.partyName === 'राज पटेल').length
    });

    const sortByDateAndAccount = (rows: any[]) => {
      return rows.sort((a: any, b: any) => {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        const getAccNum = (t: any) => {
          const match = (t.description || '').match(/खाते\s*क्र[.॰]?\s*(\d+)/);
          return match ? parseInt(match[1]) : 9999;
        };
        return getAccNum(a) - getAccNum(b);
      });
    };

    const creditRows = sortByDateAndAccount(processedTransactions
      .filter((t: any) => t.credit > 0)
      .map((t: any) => ({
        date: t.date,
        description: t.description.replace('जमा: ', ''),
        amount: t.credit
      })));

    const debitRows = sortByDateAndAccount(processedTransactions
      .filter((t: any) => t.debit > 0)
      .map((t: any) => ({
        date: t.date,
        description: t.description.replace('नावे: ', ''),
        amount: t.debit
      })));

    // Add opening balance to appropriate side - Always show opening balance
    if (openingBalance > 0) {
      creditRows.unshift({
        date: dateFilters.dateFrom,
        description: 'मागील शिल्लक',
        amount: openingBalance
      });
    } else if (openingBalance < 0) {
      debitRows.unshift({
        date: dateFilters.dateFrom,
        description: 'मागील शिल्लक',
        amount: Math.abs(openingBalance)
      });
    } else {
      // Always show opening balance line even when 0
      creditRows.unshift({
        date: dateFilters.dateFrom,
        description: 'मागील शिल्लक',
        amount: 0
      });
    }

    // Calculate closing balance and add to appropriate side
    const finalBalance = openingBalance + totalCredit - totalDebit;
    if (finalBalance > 0) {
      debitRows.push({
        date: dateFilters.dateTo,
        description: 'शिल्लक पुढे नेले',
        amount: finalBalance
      });
    } else if (finalBalance < 0) {
      creditRows.push({
        date: dateFilters.dateTo,
        description: 'शिल्लक पुढे',
        amount: Math.abs(finalBalance)
      });
    }

    const grandTotalCredit = creditRows.reduce((sum: number, row: any) => sum + row.amount, 0);
    const grandTotalDebit = debitRows.reduce((sum: number, row: any) => sum + row.amount, 0);

    console.log('📊 HORIZONTAL: Final split:', {
      debitCount: debitRows.length,
      creditCount: creditRows.length,
      debitRajPatel: debitRows.filter((r: any) => r.description.includes('राज पटेल')).length,
      creditRajPatel: creditRows.filter((r: any) => r.description.includes('राज पटेल')).length
    });

    console.log('💰 BALANCE CALCULATION DEBUG:', {
      totalCredit,
      totalDebit,
      calculatedBalance: openingBalance + totalCredit - totalDebit,
      storedClosingBalance: cashBalance?.closingBalance || 0,
      shouldMatch: true
    });

    return { creditRows, debitRows, grandTotalCredit, grandTotalDebit };
  };

  return (
    <>
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
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground heading-professional">रोकड वही</h1>
                <p className="text-muted-foreground">नमुना क्र. ७ (नियम १८ पहा) - दैनंदिन रोकड व्यवहाराची नोंद</p>
              </div>

              {/* Filters Card */}
              <Card className="mb-6">
                <CardContent className="p-6 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="dateFrom">पासून दिनांक</Label>
                      <Input
                        id="dateFrom"
                        type="date"
                        value={dateFilters.dateFrom}
                        onChange={(e) => setDateFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dateTo">पर्यंत दिनांक</Label>
                      <Input
                        id="dateTo"
                        type="date"
                        value={dateFilters.dateTo}
                        onChange={(e) => setDateFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="format">अहवाल प्रकार</Label>
                      <Select value={printFormat} onValueChange={(value: 'vertical' | 'horizontal') => setPrintFormat(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vertical">उभा (Vertical)</SelectItem>
                          <SelectItem value="horizontal">आडवा T-Format</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button onClick={handleFilter} className="flex-1">
                        <Search className="w-4 h-4 mr-2" />
                        फिल्टर करा
                      </Button>
                      <Button onClick={handlePrint} variant="outline">
                        <Printer className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Report Content */}
              <Card>
                <CardContent className="p-0">
                  <div className="print-content">
                    <div className="mb-4 flex gap-2 px-6 pt-6 print:hidden flex-wrap">
                    {!isMobile && (
                      <>
                        <Button onClick={handleExportExcel} variant="outline" className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Excel
                        </Button>
                        <Button onClick={handleExportPDF} variant="outline" className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200">
                          <FileDown className="w-4 h-4 mr-2" />
                          PDF
                        </Button>
                      </>
                    )}
                    {isMobile && (
                      <Button onClick={handleMobilePdfDownload} variant="outline" className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200">
                        <FileDown className="w-4 h-4 mr-2" />
                        मोबाईल PDF
                      </Button>
                    )}
                  </div>

                  {/* Professional Header - matches capital account style */}
                  <div className="cashbook-header" style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold' }}>
                    <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>रोकड वही</h1>
                    <p style={{ fontSize: '16px', marginBottom: '2px' }}>नमुना क्र. ७</p>
                    <p style={{ fontSize: '14px', marginBottom: '20px' }}>(नियम १८ पहा)</p>
                    {dateFilters.dateFrom && dateFilters.dateTo && (
                      <p style={{ fontSize: '16px', marginBottom: '20px' }}>
                        कालावधी: {DateUtils.isoToIndianDate(dateFilters.dateFrom)} ते {DateUtils.isoToIndianDate(dateFilters.dateTo)}
                      </p>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="text-center py-8">लोड होत आहे...</div>
                  ) : error ? (
                    <div className="text-center py-8 text-red-600">त्रुटी: डेटा लोड करताना समस्या आली</div>
                  ) : finalTransactions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">या कालावधीत कोणतेही व्यवहार आढळले नाहीत</div>
                  ) : printFormat === 'vertical' ? (
                    // Vertical Format Display
                    <div className="overflow-x-auto">
                      <Table className="professional-vertical-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16 sm:w-24 text-center border border-indigo-300 bg-indigo-50 text-xs sm:text-sm md:text-base px-1 sm:px-3 md:px-4 md:py-3">तारीख</TableHead>
                            <TableHead className="text-center border border-indigo-300 bg-indigo-50 text-xs sm:text-sm md:text-base px-1 sm:px-3 md:px-4 md:py-3">तपशील</TableHead>
                            <TableHead className="w-[72px] sm:w-28 text-center border border-indigo-300 bg-indigo-50 text-sm sm:text-sm md:text-base font-bold px-1 sm:px-3 md:px-4 md:py-3">जमा</TableHead>
                            <TableHead className="w-[72px] sm:w-28 text-center border border-indigo-300 bg-indigo-50 text-sm sm:text-sm md:text-base font-bold px-1 sm:px-3 md:px-4 md:py-3">नावे</TableHead>
                            <TableHead className="w-[60px] sm:w-32 text-center border border-indigo-300 bg-indigo-50/60 text-[10px] sm:text-sm md:text-base font-normal text-indigo-400 px-0.5 sm:px-3 md:px-4 md:py-3">शिल्लक</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {finalTransactions.map((row: any, index: number) => (
                            <TableRow key={index} className={row.isOpeningBalance ? "bg-yellow-50" : ""}>
                              <TableCell className="text-center text-xs sm:text-sm md:text-base border border-indigo-200 px-1 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3">
                                {DateUtils.isoToIndianDate(row.date).replace(/20(\d{2})/g, '$1')}
                              </TableCell>
                              <TableCell className="text-left text-xs sm:text-sm md:text-base border border-indigo-200 px-1 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3">
                                {row.description}
                              </TableCell>
                              <TableCell className="text-right text-sm sm:text-sm md:text-base font-medium border border-indigo-200 px-1 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3">
                                {row.credit ? `${LoanCalculations.formatAmount(row.credit)}` : "-"}
                              </TableCell>
                              <TableCell className="text-right text-sm sm:text-sm md:text-base font-medium border border-indigo-200 px-1 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3">
                                {row.debit ? `${LoanCalculations.formatAmount(row.debit)}` : "-"}
                              </TableCell>
                              <TableCell className="text-right text-[10px] sm:text-sm md:text-base border border-indigo-200 px-0.5 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 text-gray-400 sm:text-gray-700 sm:font-semibold">
                                {LoanCalculations.formatAmount(row.balance)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {/* Summary Stats */}
                      <div className="mt-4 sm:mt-6 bg-indigo-50 p-3 sm:p-4 md:p-6 rounded-lg">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 text-center">
                          <div>
                            <p className="text-xs sm:text-sm text-gray-600">प्रारंभिक शिल्लक</p>
                            <p className="text-sm sm:text-lg font-semibold">
                              {(() => {
                                const balance = openingBalance || 0;
                                return `${LoanCalculations.formatAmount(Math.abs(balance))}`;
                              })()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm text-gray-600">एकूण जमा</p>
                            <p className="text-sm sm:text-lg font-semibold text-green-600">{LoanCalculations.formatAmount(totalCredit)}</p>
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm text-gray-600">एकूण नावे</p>
                            <p className="text-sm sm:text-lg font-semibold text-red-600">{LoanCalculations.formatAmount(totalDebit)}</p>
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm text-gray-600">अंतिम शिल्लक</p>
                            <p className="text-sm sm:text-lg font-semibold">{LoanCalculations.formatAmount(Math.abs(closingBalance))}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Horizontal T-Format Display
                    <div className="professional-t-format border border-gray-300 overflow-hidden">
                      {/* Main Header */}
                      <div className="flex border-b-4 border-black">
                        <div className="w-1/2 border-r-2 border-black text-center py-2 sm:py-3 md:py-4 bg-indigo-100">
                          <h3 className="font-bold text-sm sm:text-lg md:text-xl">जमा <span className="text-xs sm:text-sm md:text-base font-normal">(Credit)</span></h3>
                        </div>
                        <div className="w-1/2 text-center py-2 sm:py-3 md:py-4 bg-red-100">
                          <h3 className="font-bold text-sm sm:text-lg md:text-xl">नावे <span className="text-xs sm:text-sm md:text-base font-normal">(Debit)</span></h3>
                        </div>
                      </div>
                      
                      {/* Sub Headers */}
                      <div className="flex border-b-2 border-black">
                        {/* Left Sub Header */}
                        <div className="w-1/2 border-r-2 border-black">
                          <div className="flex text-center font-semibold text-xs sm:text-sm md:text-base py-1.5 sm:py-2 md:py-3">
                            <div className="w-12 sm:w-16 border-r border-gray-300">दिनांक</div>
                            <div className="flex-1 border-r border-gray-300">तपशील</div>
                            <div className="w-16 sm:w-24">रक्कम</div>
                          </div>
                        </div>
                        {/* Right Sub Header */}
                        <div className="w-1/2">
                          <div className="flex text-center font-semibold text-xs sm:text-sm md:text-base py-1.5 sm:py-2 md:py-3">
                            <div className="w-12 sm:w-16 border-r border-gray-300">दिनांक</div>
                            <div className="flex-1 border-r border-gray-300">तपशील</div>
                            <div className="w-16 sm:w-24">रक्कम</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Single Table for Perfect Alignment */}
                      <div className="t-format-table overflow-hidden">
                        {(() => {
                          const { creditRows, debitRows, grandTotalCredit, grandTotalDebit } = getHorizontalData();
                          const maxRows = Math.max(creditRows.length, debitRows.length);
                          
                          return (
                            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                              <tbody>
                                {/* Data Rows */}
                                {Array.from({ length: maxRows }, (_, index) => {
                                  const creditRow = creditRows[index];
                                  const debitRow = debitRows[index];
                                  
                                  const isCreditBalance = creditRow?.description?.includes('शिल्लक पुढे') || creditRow?.description?.includes('मागील शिल्लक');
                                  const isDebitBalance = debitRow?.description?.includes('शिल्लक पुढे') || debitRow?.description?.includes('मागील शिल्लक');
                                  const hasBalance = isCreditBalance || isDebitBalance;
                                  
                                  return (
                                    <tr key={index} className={`border-b border-gray-200 ${hasBalance ? 'bg-indigo-50' : ''}`}>
                                      {/* Credit Side */}
                                      <td className="w-12 sm:w-16 px-1 py-1 text-center text-[10px] sm:text-xs border-r border-gray-300 align-top" style={{ width: '12%' }}>
                                        {creditRow ? DateUtils.isoToIndianDate(creditRow.date).replace(/20(\d{2})/g, '$1') : ''}
                                      </td>
                                      <td className={`px-1 sm:px-2 py-1 border-r border-gray-300 align-top ${isCreditBalance ? 'text-xs sm:text-base font-bold bg-indigo-100 border-2 border-indigo-400' : 'text-xs sm:text-sm'}`} style={{ width: '35%' }}>
                                        {creditRow?.description || ''}
                                      </td>
                                      <td className={`w-16 sm:w-24 px-1 py-1 text-right border-r-2 border-black align-top text-xs sm:text-sm ${isCreditBalance ? 'amount-bold' : ''}`} style={{ width: '15%' }}>
                                        {creditRow ? LoanCalculations.formatAmount(creditRow.amount) : ''}
                                      </td>
                                      
                                      {/* Debit Side */}
                                      <td className="w-12 sm:w-16 px-1 py-1 text-center text-[10px] sm:text-xs border-r border-gray-300 align-top" style={{ width: '12%' }}>
                                        {debitRow ? DateUtils.isoToIndianDate(debitRow.date).replace(/20(\d{2})/g, '$1') : ''}
                                      </td>
                                      <td className={`px-1 sm:px-2 py-1 border-r border-gray-300 align-top ${isDebitBalance ? 'text-xs sm:text-base font-bold bg-indigo-100 border-2 border-indigo-400' : 'text-xs sm:text-sm'}`} style={{ width: '35%' }}>
                                        {debitRow?.description || ''}
                                      </td>
                                      <td className={`w-16 sm:w-24 px-1 py-1 text-right align-top text-xs sm:text-sm ${isDebitBalance ? 'amount-bold' : ''}`} style={{ width: '15%' }}>
                                        {debitRow ? LoanCalculations.formatAmount(debitRow.amount) : ''}
                                      </td>
                                    </tr>
                                  );
                                })}
                                
                                {/* Totals Row - Perfect Alignment */}
                                <tr className="border-t-2 border-black font-bold text-xs sm:text-sm bg-indigo-50">
                                  <td className="w-12 sm:w-16 px-1 py-1.5 sm:py-2 text-center border-r border-gray-300"></td>
                                  <td className="px-1 sm:px-2 py-1.5 sm:py-2 text-center border-r border-gray-300">एकूण</td>
                                  <td className="w-16 sm:w-24 px-1 py-1.5 sm:py-2 text-right border-r-2 border-black">{LoanCalculations.formatAmount(grandTotalCredit)}</td>
                                  <td className="w-12 sm:w-16 px-1 py-1.5 sm:py-2 text-center border-r border-gray-300"></td>
                                  <td className="px-1 sm:px-2 py-1.5 sm:py-2 text-center border-r border-gray-300">एकूण</td>
                                  <td className="w-16 sm:w-24 px-1 py-1.5 sm:py-2 text-right">{LoanCalculations.formatAmount(grandTotalDebit)}</td>
                                </tr>
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

// Optimize with React.memo for better performance
export default React.memo(CashBookReport);