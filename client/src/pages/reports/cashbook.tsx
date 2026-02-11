import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { DateUtils } from "@/lib/date-utils";
import { LoanCalculations } from "@/lib/loan-calculations";
import { useQuery } from "@tanstack/react-query";
import { useRealTimeSync } from "@/hooks/use-real-time-sync";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Printer, FileDown, FileSpreadsheet, Home, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

function CashBookReport() {
  const [dateFilters, setDateFilters] = useState({
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });
  const [printFormat, setPrintFormat] = useState<'vertical' | 'horizontal'>('horizontal');
  const printRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();
  const { safeNavigate } = useSafeNavigation();
  
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
        .t-format-table .bg-blue-100,
        .t-format-table .bg-blue-50,
        .t-format-table .bg-red-100,
        .t-format-table .bg-yellow-50,
        .bg-blue-50,
        .bg-blue-100,
        .bg-yellow-50,
        .bg-red-100 {
          background: white !important;
        }
        /* Bold styling for balance rows in print */
        .t-format-table .font-bold {
          font-weight: bold !important;
        }
        /* Make amount figures in balance rows extra bold */
        .t-format-table .bg-blue-100 .amount-bold,
        .t-format-table .bg-blue-50 .amount-bold {
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
    .sort((a: any, b: any) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime())
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
        description: `${transaction.transactionType === 'cash_in' ? 'जमा' : 'नावे'}: ${transaction.narration}`,
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

    const creditRows = processedTransactions
      .filter((t: any) => t.credit > 0)
      .map((t: any) => ({
        date: t.date,
        description: t.description.replace('जमा: ', ''),
        amount: t.credit
      }));

    const debitRows = processedTransactions
      .filter((t: any) => t.debit > 0)
      .map((t: any) => ({
        date: t.date,
        description: t.description.replace('नावे: ', ''),
        amount: t.debit
      }));

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
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => safeNavigate('/dashboard')}
                    variant="ghost"
                    size="icon"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">रोकड वही अहवाल (नमुना क्र. ७)</h1>
                    <p className="text-muted-foreground">
                      दैनंदिन रोकड व्यवहाराची नोंद
                    </p>
                  </div>
                </div>
              </div>

              {/* Filters Card */}
              <Card className="mb-6">
                <CardContent className="p-6">
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
                <CardHeader>
                  <CardTitle className="text-xl print-company-name">{(company as any)?.name || "टेस्ट कंपनी"}</CardTitle>
                  <p className="text-gray-600 screen-title">रोकड वही अहवाल (नमुना क्र. ७)</p>
                  <div className="text-gray-600 print-title" style={{ display: 'none' }}>
                    <div>रोकड वही</div>
                    <div>नमुना क्र. ७</div>
                    <div>(नियम १८ पहा)</div>
                  </div>
                  <p className="text-sm text-gray-500">
                    {DateUtils.isoToIndianDate(dateFilters.dateFrom)} ते {DateUtils.isoToIndianDate(dateFilters.dateTo)}
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="print-content">
                    <div className="mb-4 flex gap-2 px-6 pt-6 print:hidden">
                    <Button onClick={handleExportExcel} variant="outline" className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Excel
                    </Button>
                    <Button onClick={handleExportPDF} variant="outline" className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200">
                      <FileDown className="w-4 h-4 mr-2" />
                      PDF
                    </Button>
                  </div>

                  {/* Professional Print Header - matches capital account style */}
                  <div className="cashbook-header print:block hidden" style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold' }}>
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
                            <TableHead className="w-24 text-center border-2 border-blue-600 bg-blue-50">तारीख</TableHead>
                            <TableHead className="text-center border-2 border-blue-600 bg-blue-50">तपशील</TableHead>
                            <TableHead className="w-28 text-center border-2 border-blue-600 bg-blue-50">जमा (Cr.)</TableHead>
                            <TableHead className="w-28 text-center border-2 border-blue-600 bg-blue-50">नावे (Dr.)</TableHead>
                            <TableHead className="w-32 text-center border-2 border-blue-600 bg-blue-50">शिल्लक</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {finalTransactions.map((row: any, index: number) => (
                            <TableRow key={index} className={row.isOpeningBalance ? "bg-yellow-50" : ""}>
                              <TableCell className="text-center text-sm border-2 border-blue-600">
                                {DateUtils.isoToIndianDate(row.date).replace(/20(\d{2})/g, '$1')}
                              </TableCell>
                              <TableCell className="text-left text-sm border-2 border-blue-600">
                                {row.description}
                              </TableCell>
                              <TableCell className="text-right text-sm border-2 border-blue-600">
                                {row.credit ? `${LoanCalculations.formatAmount(row.credit)}` : "-"}
                              </TableCell>
                              <TableCell className="text-right text-sm border-2 border-blue-600">
                                {row.debit ? `${LoanCalculations.formatAmount(row.debit)}` : "-"}
                              </TableCell>
                              <TableCell className="text-right text-sm border-2 border-blue-600 font-semibold">
                                {LoanCalculations.formatAmount(row.balance)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {/* Summary Stats */}
                      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div>
                            <p className="text-sm text-gray-600">प्रारंभिक शिल्लक</p>
                            <p className="text-lg font-semibold">
                              {(() => {
                                const balance = openingBalance || 0;
                                return `${LoanCalculations.formatAmount(Math.abs(balance))}`;
                              })()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">एकूण जमा</p>
                            <p className="text-lg font-semibold text-green-600">{LoanCalculations.formatAmount(totalCredit)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">एकूण नावे</p>
                            <p className="text-lg font-semibold text-red-600">{LoanCalculations.formatAmount(totalDebit)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">अंतिम शिल्लक</p>
                            <p className="text-lg font-semibold">{LoanCalculations.formatAmount(Math.abs(closingBalance))}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Horizontal T-Format Display
                    <div className="professional-t-format border border-gray-300 overflow-hidden">
                      {/* Main Header */}
                      <div className="flex border-b-4 border-black">
                        <div className="w-1/2 border-r-2 border-black text-center py-3 bg-blue-100">
                          <h3 className="font-bold text-lg">जमा <span className="text-sm font-normal">(Credit)</span></h3>
                        </div>
                        <div className="w-1/2 text-center py-3 bg-red-100">
                          <h3 className="font-bold text-lg">नावे <span className="text-sm font-normal">(Debit)</span></h3>
                        </div>
                      </div>
                      
                      {/* Sub Headers */}
                      <div className="flex border-b-2 border-black">
                        {/* Left Sub Header */}
                        <div className="w-1/2 border-r-2 border-black">
                          <div className="flex text-center font-semibold text-sm py-2">
                            <div className="w-16 border-r border-gray-300">दिनांक</div>
                            <div className="flex-1 border-r border-gray-300">तपशील</div>
                            <div className="w-24">रक्कम</div>
                          </div>
                        </div>
                        {/* Right Sub Header */}
                        <div className="w-1/2">
                          <div className="flex text-center font-semibold text-sm py-2">
                            <div className="w-16 border-r border-gray-300">दिनांक</div>
                            <div className="flex-1 border-r border-gray-300">तपशील</div>
                            <div className="w-24">रक्कम</div>
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
                                    <tr key={index} className={`border-b border-gray-200 ${hasBalance ? 'bg-blue-50' : ''}`}>
                                      {/* Credit Side */}
                                      <td className="w-16 px-1 py-1 text-center text-xs border-r border-gray-300 align-top" style={{ width: '12%' }}>
                                        {creditRow ? DateUtils.isoToIndianDate(creditRow.date).replace(/20(\d{2})/g, '$1') : ''}
                                      </td>
                                      <td className={`px-2 py-1 border-r border-gray-300 align-top ${isCreditBalance ? 'text-base font-bold bg-blue-100 border-2 border-blue-400' : 'text-sm'}`} style={{ width: '35%' }}>
                                        {creditRow?.description || ''}
                                      </td>
                                      <td className={`w-24 px-1 py-1 text-right border-r-2 border-black align-top text-sm ${isCreditBalance ? 'amount-bold' : ''}`} style={{ width: '15%' }}>
                                        {creditRow ? LoanCalculations.formatAmount(creditRow.amount) : ''}
                                      </td>
                                      
                                      {/* Debit Side */}
                                      <td className="w-16 px-1 py-1 text-center text-xs border-r border-gray-300 align-top" style={{ width: '12%' }}>
                                        {debitRow ? DateUtils.isoToIndianDate(debitRow.date).replace(/20(\d{2})/g, '$1') : ''}
                                      </td>
                                      <td className={`px-2 py-1 border-r border-gray-300 align-top ${isDebitBalance ? 'text-base font-bold bg-blue-100 border-2 border-blue-400' : 'text-sm'}`} style={{ width: '35%' }}>
                                        {debitRow?.description || ''}
                                      </td>
                                      <td className={`w-24 px-1 py-1 text-right align-top text-sm ${isDebitBalance ? 'amount-bold' : ''}`} style={{ width: '15%' }}>
                                        {debitRow ? LoanCalculations.formatAmount(debitRow.amount) : ''}
                                      </td>
                                    </tr>
                                  );
                                })}
                                
                                {/* Totals Row - Perfect Alignment */}
                                <tr className="border-t-2 border-black font-bold text-sm bg-blue-50">
                                  <td className="w-16 px-1 py-2 text-center border-r border-gray-300">-</td>
                                  <td className="px-2 py-2 text-center border-r border-gray-300">एकूण</td>
                                  <td className="w-24 px-1 py-2 text-right border-r-2 border-black">{LoanCalculations.formatAmount(grandTotalCredit)}</td>
                                  <td className="w-16 px-1 py-2 text-center border-r border-gray-300">-</td>
                                  <td className="px-2 py-2 text-center border-r border-gray-300">एकूण</td>
                                  <td className="w-24 px-1 py-2 text-right">{LoanCalculations.formatAmount(grandTotalDebit)}</td>
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