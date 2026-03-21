import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Calendar, Download, Printer, FileText } from "lucide-react";
import { displayNarration } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { initDevanagariFont } from '@/lib/pdf-text-generator';

export default function CashbookLedger() {
  const [dateFrom, setDateFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch cash transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/cash-transactions", { dateFrom, dateTo }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      return fetch(`/api/cash-transactions?${params}`, { credentials: 'include' }).then(r => r.json());
    },
  });

  const { data: balanceData } = useQuery({
    queryKey: ['/api/cash-balance', { date: dateFrom }],
    queryFn: async () => {
      const response = await fetch(`/api/cash-balance?date=${dateFrom}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch balance');
      return response.json();
    },
    enabled: !!dateFrom,
  });

  const transactionsList = Array.isArray(transactions) ? transactions : [];
  const openingBalance = (balanceData as any)?.openingBalance || 0;

  // Process transactions for cashbook format
  const processedEntries = transactionsList.map((t: any) => {
    const date = new Date(t.transactionDate).toLocaleDateString('en-GB');
    const amount = Number(t.amount);
    
    if (t.transactionType === 'cash_in') {
      return {
        date,
        creditNarration: t.party ? `${t.party.name} - ${displayNarration(t.narration) || ''}` : displayNarration(t.narration) || 'रोख व्यवहार',
        creditAmount: amount,
        debitNarration: '',
        debitAmount: 0
      };
    } else {
      return {
        date,
        creditNarration: '',
        creditAmount: 0,
        debitNarration: displayNarration(t.narration) || 'खर्च',
        debitAmount: amount
      };
    }
  });

  const totalCredit = processedEntries.reduce((sum, e) => sum + e.creditAmount, 0);
  const totalDebit = processedEntries.reduce((sum, e) => sum + e.debitAmount, 0);
  const closingBalance = openingBalance + totalCredit - totalDebit;

  // Print functionality
  const handlePrint = () => {
    const printStyles = `
      @media print {
        @page {
          size: A4;
          margin: 8mm 8mm 8mm 25.4mm;
        }
        body {
          font-family: 'Noto Sans Devanagari', Arial, sans-serif !important;
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
        .cashbook-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .cashbook-table th,
        .cashbook-table td {
          border: 1px solid #000;
          padding: 6px;
          text-align: center;
        }
        .cashbook-table th {
          background: #f0f0f0;
          font-weight: bold;
        }
        .amount-col {
          text-align: right;
        }
      }
    `;
    
    const styleSheet = document.createElement("style");
    styleSheet.innerText = printStyles;
    document.head.appendChild(styleSheet);
    
    // Show print content
    const printContentDiv = document.querySelector('.print-content') as HTMLElement;
    if (printContentDiv) {
      printContentDiv.style.display = 'block';
      printContentDiv.style.visibility = 'visible';
    }
    
    // Force content visibility
    const printElements = document.querySelectorAll('.print-content *');
    printElements.forEach(el => {
      (el as HTMLElement).style.visibility = 'visible';
    });
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (printContentDiv) {
          printContentDiv.style.display = 'none';
        }
        if (document.head.contains(styleSheet)) {
          document.head.removeChild(styleSheet);
        }
      }, 1000);
    }, 100);
  };

  // Export to PDF function
  const exportToPDF = () => {
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    initDevanagariFont(pdf);
    
    pdf.setFontSize(16);
    pdf.text('नमुना क्रमांक ७', pdf.internal.pageSize.width / 2, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text('(नियम १८ पहा - रोकड वही)', pdf.internal.pageSize.width / 2, 28, { align: 'center' });
    pdf.text(`दिनांक: ${new Date(dateFrom).toLocaleDateString('en-GB')} ते ${new Date(dateTo).toLocaleDateString('en-GB')}`, pdf.internal.pageSize.width / 2, 36, { align: 'center' });

    // Prepare table data
    const tableData = [
      [`${new Date(dateFrom).toLocaleDateString('en-GB')}`, `उघडत शिल्लक (Opening Balance)`, Math.round(openingBalance).toLocaleString('en-IN'), '', ''],
      ...processedEntries.map(e => [
        e.date,
        e.creditNarration,
        e.creditAmount ? Math.round(e.creditAmount).toLocaleString('en-IN') : '',
        e.debitNarration,
        e.debitAmount ? Math.round(e.debitAmount).toLocaleString('en-IN') : ''
      ])
    ];

    // Add table
    (pdf as any).autoTable({
      head: [['दिनांक', 'तपशील (जमा बाजू)', 'रक्कम ₹', 'तपशील (नावे बाजू)', 'रक्कम ₹']],
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: {
        font: 'NotoDevanagari',
        fontSize: 10,
        cellPadding: 3,
        halign: 'left'
      },
      headStyles: {
        fillColor: [66, 66, 66],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold'
      },
      foot: [
        ['', 'एकूण जमा:', Math.round(totalCredit).toLocaleString('en-IN'), 'एकूण नावे:', Math.round(totalDebit).toLocaleString('en-IN')],
        ['', `क्लोजिंग बॅलन्स: ₹${Math.round(closingBalance).toLocaleString('en-IN')}`, '', '', '']
      ]
    });

    // Save PDF
    pdf.save(`रोकड_वही_${dateFrom}_to_${dateTo}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          रोकड वही (नमुना क्रमांक ७)
        </h1>
        <div className="flex space-x-2">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            प्रिंट
          </Button>
          <Button onClick={exportToPDF} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            PDF डाउनलोड
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center md:text-xl">
            <Calendar className="h-5 w-5 mr-2" />
            दिनांक निवडा
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dateFrom">पासून दिनांक</Label>
              <DateInput
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">पर्यंत दिनांक</Label>
              <DateInput
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cashbook Report */}
      <Card className="overflow-hidden">
        <div ref={printRef} className="bg-white p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-xl md:text-2xl font-bold">नमुना क्रमांक ७</h2>
            <p className="text-sm text-gray-600">(नियम १८ पहा - रोकड वही)</p>
            <p className="text-sm mt-2 font-semibold">
              👉 दिनांक: {new Date(dateFrom).toLocaleDateString('en-GB')} ते {new Date(dateTo).toLocaleDateString('en-GB')} 👈
            </p>
          </div>

          {/* Cashbook Table */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-gray-600">लोड हो रहा है...</p>
            </div>
          ) : (
            <>
              <Table className="border-2 border-gray-800">
                <TableHeader>
                  <TableRow className="bg-gray-100 border-b-2 border-gray-800">
                    <TableHead className="border-r border-gray-600 text-center font-bold text-black md:text-base md:py-3">दिनांक</TableHead>
                    <TableHead className="border-r border-gray-600 text-center font-bold text-black md:text-base md:py-3">तपशील (जमा बाजू)</TableHead>
                    <TableHead className="border-r border-gray-600 text-center font-bold text-black md:text-base md:py-3">रक्कम ₹</TableHead>
                    <TableHead className="border-r border-gray-600 text-center font-bold text-black md:text-base md:py-3">तपशील (नावे बाजू)</TableHead>
                    <TableHead className="text-center font-bold text-black md:text-base md:py-3">रक्कम ₹</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance */}
                  <TableRow className="border-b border-gray-400">
                    <TableCell className="border-r border-gray-400 text-center md:text-base md:py-3">
                      {new Date(dateFrom).toLocaleDateString('en-GB')}
                    </TableCell>
                    <TableCell className="border-r border-gray-400 md:text-base md:py-3">
                      उघडत शिल्लक (Opening Balance)
                    </TableCell>
                    <TableCell className="border-r border-gray-400 text-right font-semibold md:text-base md:py-3">
                      {openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="border-r border-gray-400 md:py-3"></TableCell>
                    <TableCell className="text-right md:py-3"></TableCell>
                  </TableRow>

                  {/* Transactions */}
                  {processedEntries.map((entry, index) => (
                    <TableRow key={index} className="border-b border-gray-400">
                      <TableCell className="border-r border-gray-400 text-center md:text-base md:py-3">
                        {entry.date}
                      </TableCell>
                      <TableCell className="border-r border-gray-400 md:text-base md:py-3">
                        {entry.creditNarration}
                      </TableCell>
                      <TableCell className="border-r border-gray-400 text-right md:text-base md:py-3">
                        {entry.creditAmount ? entry.creditAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : ''}
                      </TableCell>
                      <TableCell className="border-r border-gray-400 md:text-base md:py-3">
                        {entry.debitNarration}
                      </TableCell>
                      <TableCell className="text-right md:text-base md:py-3">
                        {entry.debitAmount ? entry.debitAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : ''}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Totals */}
                  <TableRow className="border-t-2 border-gray-800 bg-gray-100">
                    <TableCell className="border-r border-gray-600 md:py-3"></TableCell>
                    <TableCell className="border-r border-gray-600 font-bold md:text-base md:py-3">
                      एकूण जमा:
                    </TableCell>
                    <TableCell className="border-r border-gray-600 text-right font-bold md:text-base md:py-3">
                      ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="border-r border-gray-600 font-bold md:text-base md:py-3">
                      एकूण नावे:
                    </TableCell>
                    <TableCell className="text-right font-bold md:text-base md:py-3">
                      ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                  </TableRow>

                  {/* Closing Balance */}
                  <TableRow className="bg-indigo-50 border-t-2 border-gray-800">
                    <TableCell colSpan={5} className="text-center py-4 md:py-5">
                      <span className="text-lg font-bold">
                        🔻 क्लोजिंग बॅलन्स: ₹{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 🔻
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* Footer */}
              <div className="mt-8 flex justify-between px-8">
                <div className="text-center">
                  <p className="mb-8">तपासले : ____________</p>
                </div>
                <div className="text-center">
                  <p className="mb-8">सही : ____________</p>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}