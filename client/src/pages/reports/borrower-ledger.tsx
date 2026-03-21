import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Printer, FileText, User, ArrowLeft, Download } from "lucide-react";
import { exportBorrowerListToExcel } from "@/utils/excel-export";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";

export default function BorrowerLedger() {
  const [location] = useLocation();
  const { safeNavigate } = useSafeNavigation();
  
  const [filters, setFilters] = useState({
    borrowerId: '',
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  const [ledgerData, setLedgerData] = useState<any>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);

  // ESC key navigation for form switching
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        safeNavigate('/'); // Navigate to dashboard on ESC
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setLocation]);

  // Fetch company data
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  // Fetch all loans
  const { data: loans = [] } = useQuery({
    queryKey: ["/api/loans"],
  });

  // Fetch loan closures for accurate closure data
  const { data: loanClosures = [] } = useQuery({
    queryKey: ["/api/loan-closures"],
  });

  // COMPREHENSIVE PRECAUTIONS: Get unique borrowers with security checks
  const borrowers = Array.from(new Map((loans as any[]).map((loan: any) => [loan.borrowerName, loan])).values());

  const handleSearch = () => {
    if (!filters.borrowerId || !filters.dateFrom || !filters.dateTo) {
      console.warn('Please select borrower and date range');
      return;
    }

    
    // Find selected borrower
    const borrower = (loans as any[]).find(loan => loan.id === filters.borrowerId);
    if (!borrower) {
      console.warn('Borrower not found');
      return;
    }
    
    setSelectedBorrower(borrower);
    
    // Filter loans for this borrower in date range
    const borrowerLoans = (loans as any[]).filter((loan: any) => {
      return loan.borrowerName === borrower.borrowerName &&
             loan.loanDate >= filters.dateFrom && 
             loan.loanDate <= filters.dateTo;
    });
    
    
    // Calculate ledger entries with proper banking simple interest
    const entries: any[] = [];
    let runningBalance = 0;
    
    borrowerLoans.forEach((loan: any) => {
      const principalAmount = parseFloat(loan.principalAmount || 0);
      const interestRate = parseFloat(loan.interestRate || 0);
      
      // Loan disbursement entry - clean format with group name
      runningBalance += principalAmount;
      entries.push({
        date: loan.loanDate,
        description: `कर्ज वितरण - खाते क्र. ${loan.accountNumber || loan.id.slice(0, 8)} ${loan.borrowerName}${loan.groupId ? ` (${(loan.groupName || '').replace(/\s*(ग्रुप|Group)$/i, '')})` : ''}`,
        debit: principalAmount,
        credit: 0,
        balance: runningBalance,
        type: 'disbursement',
        loanId: loan.id
      });
      
      // Calculate interest till statement date using Simple Interest formula: P × R × T / 100
      const loanDate = new Date(loan.loanDate);
      const statementDate = new Date(filters.dateTo);
      const daysDifference = Math.floor((statementDate.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDifference > 0 && interestRate > 0) {
        // SIMPLE INTEREST MODE: Match closure forms calculation exactly
        // Same formula as closure.tsx line 203: (Principal × Rate × Days) / (100 × 30) 
        const simpleInterest = Math.round((principalAmount * interestRate * daysDifference) / (100 * 30));
        
        if (simpleInterest > 0) {
          runningBalance += simpleInterest;
          entries.push({
            date: filters.dateTo, // Interest calculated till statement date
            description: `व्याज - ${daysDifference} दिवसांचे (${interestRate}% ${loan.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'})`,
            debit: simpleInterest,
            credit: 0,
            balance: runningBalance,
            type: 'interest',
            loanId: loan.id,
            days: daysDifference,
            rate: interestRate
          });
        }
      }
      
      // Closure entries (if closed) - proper Dr./Cr. accounting 
      if (loan.status === 'closed') {
        // Find actual closure data from loan_closures table
        const closureData = (loanClosures as any[]).find((closure: any) => 
          closure.loanId === loan.id
        );
        
        if (closureData) {
          const closureDate = new Date(closureData.closureDate);
          // Use actual calculated interest from closure record
          const actualInterest = Number(closureData.calculatedInterest || closureData.interestAmount || 0);
          const actualPaidAmount = Number(closureData.actualPaidAmount || 0);
          const principalPaid = Number(closureData.principalPaid || closureData.principalAmount || principalAmount);
          
          // FIXED ACCOUNTING LOGIC: Two separate entries for proper borrower statement
          
          // Entry 1: Interest payment by borrower (नावे/Dr.) - borrower pays interest
          if (actualInterest > 0) {
            runningBalance += actualInterest;
            entries.push({
              date: closureData.closureDate,
              description: `व्याज भरणा - खाते क्र. ${loan.accountNumber} ${loan.borrowerName}${loan.groupId ? ` (${(loan.groupName || '').replace(/\s*(ग्रुप|Group)$/i, '')})` : ''}`,
              debit: actualInterest, // Interest payment shows as debit (नावे) from borrower's perspective
              credit: 0,
              balance: runningBalance,
              type: 'interest_payment',
              loanId: loan.id,
              interestPaid: actualInterest
            });
          }
          
          // Entry 2: Total payment received (जमा/Cr.) - principal + interest settlement
          runningBalance -= actualPaidAmount; // This should bring balance to zero
          entries.push({
            date: closureData.closureDate,
            description: `कर्ज बंद (पूर्ण परतावा) - खाते क्र. ${loan.accountNumber} ${loan.borrowerName}${loan.groupId ? ` (${(loan.groupName || '').replace(/\s*(ग्रुप|Group)$/i, '')})` : ''} - मुद्दल: ₹${Math.round(principalPaid)} + व्याज: ₹${Math.round(actualInterest)}`,
            debit: 0,
            credit: actualPaidAmount, // Total payment as credit (जमा)
            balance: 0, // Balance becomes zero after complete payment
            type: 'closure',
            loanId: loan.id,
            principalPaid: principalPaid,
            interestPaid: actualInterest
          });
          
          // Ensure final balance is exactly zero
          runningBalance = 0;
        }
      }
    });
    
    // Sort entries by date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    setLedgerData({
      borrower,
      entries,
      totalDebit: entries.reduce((sum, entry) => sum + entry.debit, 0),
      totalCredit: entries.reduce((sum, entry) => sum + entry.credit, 0),
      finalBalance: runningBalance
    });
  };

  const handlePrint = () => {
    if (!ledgerData) {
      alert("प्रिंट करण्यासाठी प्रथम खाते वही तयार करा");
      return;
    }

    try {
      const companyName = (company as any)?.name || 'कंपनी नाव';
      const borrowerName = ledgerData.borrower?.borrowerName || 'कर्जदार';
      const accountNumber = ledgerData.borrower?.accountNumber || '';
      const fd = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };

      const bdr = '1.5px solid #333';
      const thStyle = `border:${bdr};padding:8px 6px;text-align:center;font-size:11px;background:#f0f0f0;font-weight:700;color:#111;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
      const tdBase = `border:${bdr};padding:8px 6px;font-size:11px;font-weight:600;line-height:1.4;`;

      let rows = '';
      ledgerData.entries.forEach((entry: any, index: number) => {
        const bal = entry.balance || 0;
        const drLabel = bal >= 0 ? ' (Dr.)' : ' (Cr.)';
        const dateDisplay = entry.type === 'opening' ? 'प्रारंभिक' : new Date(entry.date).toLocaleDateString('en-GB');
        const rowBg = entry.type === 'opening' ? 'background:#fef3c7;-webkit-print-color-adjust:exact;print-color-adjust:exact;' : '';

        rows += `<tr>
          <td style="${tdBase}text-align:center;${rowBg}">${index + 1}</td>
          <td style="${tdBase}text-align:center;${rowBg}">${dateDisplay}</td>
          <td style="${tdBase}text-align:left;${rowBg}">${entry.description || ''}</td>
          <td style="${tdBase}text-align:right;${rowBg}">${entry.debit > 0 ? Math.round(entry.debit).toLocaleString('en-IN') : '-'}</td>
          <td style="${tdBase}text-align:right;${rowBg}">${entry.credit > 0 ? Math.round(entry.credit).toLocaleString('en-IN') : '-'}</td>
          <td style="${tdBase}text-align:right;font-weight:bold;color:red;${rowBg}">${bal < 0 ? '-' : ''}${Math.round(Math.abs(bal)).toLocaleString('en-IN')}${drLabel}</td>
        </tr>`;
      });

      rows += `<tr>
        <td colspan="3" style="${tdBase}text-align:center;background:#e0e7ff;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact;">एकूण</td>
        <td style="${tdBase}text-align:right;background:#e0e7ff;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${Math.round(ledgerData.totalDebit).toLocaleString('en-IN')}</td>
        <td style="${tdBase}text-align:right;background:#e0e7ff;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${Math.round(ledgerData.totalCredit).toLocaleString('en-IN')}</td>
        <td style="${tdBase}text-align:right;background:#e0e7ff;font-weight:bold;color:red;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${Math.round(Math.abs(ledgerData.finalBalance)).toLocaleString('en-IN')}${ledgerData.finalBalance >= 0 ? ' (Dr.)' : ' (Cr.)'}</td>
      </tr>`;

      const printHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>कर्ज खातेवही - ${borrowerName}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 12mm 5mm 12mm 5mm; }
  body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; margin: 0; padding: 3mm 5mm 3mm 20mm; box-sizing: border-box; font-size: 11px; line-height: 1.4; }
  .header { text-align: center; margin-bottom: 12px; font-weight: bold; }
  .header p { margin: 0 0 4px 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: auto; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid !important; break-inside: avoid !important; }
  .footer { margin-top: 50px; display: flex; justify-content: flex-end; font-size: 11px; font-weight: 600; padding-right: 25%; }
</style></head><body>
<div class="header">
  <p style="font-size:15px;font-weight:700;">${companyName}</p>
  <p style="font-size:14px;font-weight:700;">नमुना क्रमांक आठ</p>
  <p style="font-size:11px;color:#333;">(नियम १८ पहा)</p>
  <p style="font-size:11px;color:#333;">कालावधी: ${fd(filters.dateFrom)} ते ${fd(filters.dateTo)}</p>
</div>
<div style="margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #ddd;">
  <p style="font-size:12px;font-weight:600;margin:0 0 4px 0;">कर्जदार: ${borrowerName}${accountNumber ? ' | खाते क्र.: ' + accountNumber : ''}</p>
</div>
<table>
  <colgroup><col style="width:6%;"><col style="width:11%;"><col style="width:31%;"><col style="width:16%;"><col style="width:16%;"><col style="width:20%;"></colgroup>
  <thead><tr>
    <th style="${thStyle}">अ.क्र.</th>
    <th style="${thStyle}">दिनांक</th>
    <th style="${thStyle}">तपशील</th>
    <th style="${thStyle}">नावे (Dr.)</th>
    <th style="${thStyle}">जमा (Cr.)</th>
    <th style="${thStyle}background:#dbeafe;">शिल्लक</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">
  <span>सावकाराची सही</span>
</div>
</body></html>`;

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.top = "-9999px";
      iframe.style.width = "794px";
      iframe.style.height = "1123px";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) { document.body.removeChild(iframe); return; }
      doc.open();
      doc.write(printHTML);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch(e) { /* ignore */ }
        setTimeout(() => { try { document.body.removeChild(iframe); } catch(e) {} }, 2000);
      }, 500);
    } catch (error) {
      alert('प्रिंट करताना त्रुटी झाली');
    }
  };

  // Excel Export Function
  const handleExcelExport = () => {
    if (!ledgerData || !ledgerData.entries) {
      alert('एक्सेल एक्सपोर्ट करण्यासाठी प्रथम कर्जदार निवडा आणि खाते वही तयार करा बटन दाबा');
      return;
    }

    try {
      const excelData = ledgerData.entries.map((entry: any, index: number) => ({
        serialNo: index + 1,
        date: new Date(entry.date).toLocaleDateString('en-GB'),
        description: entry.description,
        debitAmount: entry.debit > 0 ? entry.debit : 0,
        creditAmount: entry.credit > 0 ? entry.credit : 0,
        balance: entry.balance
      }));

      const success = exportBorrowerListToExcel(
        excelData,
        ledgerData.borrower?.borrowerName || 'कर्जदार'
      );
      
      if (success) {
        alert('कर्जदार लेजर यशस्वीरित्या एक्सेल फाइलमध्ये एक्सपोर्ट झाले!');
      } else {
        alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
      }
    } catch (error) {
      console.error('Excel export error:', error);
      alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
    }
  };



  const handleExportPDF = () => {
    if (!ledgerData) {
      alert('प्रथम खाते वही तयार करा');
      return;
    }
    handlePrint();
  };



  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-IN');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-4">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        
        {/* Header with ESC navigation hint */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">वैयक्तिक खाते वही</h1>
            <p className="text-gray-600">कर्जदाराचे संपूर्ण खाते विवरण (नमुना क्रमांक ८ - नियम १८ पहा)</p>
          </div>
          <div className="text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => safeNavigate('/')}
              className="mb-2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              मुख्य पान
            </Button>
            <p className="text-xs text-gray-500">ESC दाबून मुख्य पानावर जा</p>
          </div>
        </div>

        {/* Search Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl font-semibold text-gray-700">शोध निकष</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <Label htmlFor="borrower-select" className="text-sm font-medium">कर्जदार निवडा</Label>
                <Select value={filters.borrowerId} onValueChange={(value) => setFilters({...filters, borrowerId: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="कर्जदार निवडा" />
                  </SelectTrigger>
                  <SelectContent>
                    {borrowers.map((borrower: any) => (
                      <SelectItem key={borrower.id} value={borrower.id}>
                        {borrower.borrowerName} ({borrower.group?.name || 'अज्ञात गट'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="date-from" className="text-sm font-medium">सुरुवात दिनांक</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                  className="font-inter"
                />
              </div>
              
              <div>
                <Label htmlFor="date-to" className="text-sm font-medium">समाप्ती दिनांक</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                  className="font-inter"
                />
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSearch} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Search className="mr-2 h-4 w-4" />
                खाते वही तयार करा
              </Button>
              
              <Button onClick={handlePrint} variant="outline" disabled={!ledgerData}>
                <Printer className="mr-2 h-4 w-4" />
                प्रिंट करा
              </Button>
              
              <Button onClick={handleExcelExport} variant="outline" disabled={!ledgerData} className="bg-green-50 hover:bg-green-100 border-green-300">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm2 2h8v12H6V4z"/>
                </svg>
                Excel एक्सपोर्ट करा
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ledger Display */}
        <Card>
          <CardHeader>
            {/* Professional Borrower Details Section */}
            {selectedBorrower && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Left: Borrower Details */}
                <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-500">
                  <h3 className="text-lg font-bold text-indigo-800 mb-3">कर्जदाराचे तपशील</h3>
                  <div className="space-y-2">
                    <p className="text-sm"><span className="font-semibold">नाव:</span> <span className="font-bold text-indigo-900">{selectedBorrower.borrowerName}</span></p>
                    <p className="text-sm"><span className="font-semibold">खाते क्र.:</span> <span className="font-bold">{selectedBorrower.accountNumber || selectedBorrower.id.slice(0, 8)}</span></p>
                    <p className="text-sm"><span className="font-semibold">पत्ता:</span> {selectedBorrower.address || 'अज्ञात'}</p>
                    <p className="text-sm"><span className="font-semibold">मोबाईल:</span> {selectedBorrower.mobileNumber || 'अज्ञात'}</p>
                  </div>
                </div>
                
                {/* Center: Company & Report Info */}
                <div className="text-center">
                  <CardTitle className="text-xl mb-2">{(company as any)?.name || 'कंपनीचे नाव'}</CardTitle>
                  <p className="text-gray-600 mb-2">कर्ज खातेवही अहवाल</p>
                  <p className="text-sm text-gray-600">(नमुना क्रमांक ८ - नियम १८ पहा)</p>
                  <p className="text-sm text-gray-500 mt-2">
                    कालावधी: {new Date(filters.dateFrom).toLocaleDateString('en-GB')} ते {new Date(filters.dateTo).toLocaleDateString('en-GB')}
                  </p>
                </div>
                
                {/* Right: Summary */}
                <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                  <h3 className="text-lg font-bold text-green-800 mb-3">खाते सारांश</h3>
                  {ledgerData && (
                    <div className="space-y-2">
                      <p className="text-sm"><span className="font-semibold">एकूण नावे:</span> <span className="font-bold text-green-900">₹{ledgerData.totalDebit.toLocaleString('en-IN')}</span></p>
                      <p className="text-sm"><span className="font-semibold">एकूण जमा:</span> <span className="font-bold">₹{ledgerData.totalCredit.toLocaleString('en-IN')}</span></p>
                      <p className="text-sm"><span className="font-semibold">शिल्लक:</span> <span className={`font-bold ${ledgerData.finalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{Math.abs(ledgerData.finalBalance).toLocaleString('en-IN')}</span></p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            
            {ledgerData ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-2 border-gray-800 md:text-base">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border-2 border-gray-800 px-3 py-2 md:px-4 md:py-3 text-center font-bold">अ.क्र.</th>
                      <th className="border-2 border-gray-800 px-3 py-2 md:px-4 md:py-3 text-center font-bold">दिनांक</th>
                      <th className="border-2 border-gray-800 px-3 py-2 md:px-4 md:py-3 text-center font-bold">तपशील</th>
                      <th className="border-2 border-gray-800 px-3 py-2 md:px-4 md:py-3 text-center font-bold">नावे (₹)</th>
                      <th className="border-2 border-gray-800 px-3 py-2 md:px-4 md:py-3 text-center font-bold">जमा (₹)</th>
                      <th className="border-2 border-gray-800 px-3 py-2 md:px-4 md:py-3 text-center font-bold">शिल्लक (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.entries.length > 0 ? (
                      <>
                        {ledgerData.entries.map((entry: any, index: number) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2 md:px-4 md:py-3 text-center font-medium">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2 md:px-4 md:py-3 text-center">
                              {new Date(entry.date).toLocaleDateString('en-GB')}
                            </td>
                            <td className="border border-gray-300 px-3 py-2 md:px-4 md:py-3">{entry.description}</td>
                            <td className="border border-gray-300 px-3 py-2 md:px-4 md:py-3 text-right">
                              {entry.debit > 0 ? `₹${formatAmount(entry.debit)}` : '-'}
                            </td>
                            <td className="border border-gray-300 px-3 py-2 md:px-4 md:py-3 text-right">
                              {entry.credit > 0 ? `₹${formatAmount(entry.credit)}` : '-'}
                            </td>
                            <td className="border border-gray-300 px-3 py-2 md:px-4 md:py-3 text-right font-bold">
                              ₹{formatAmount(entry.balance)}
                            </td>
                          </tr>
                        ))}
                        
                        {/* Total Row */}
                        <tr className="bg-gray-100 border-t-2 border-gray-800">
                          <td colSpan={3} className="border-2 border-gray-800 px-3 py-2 md:px-4 md:py-3 text-center font-bold">एकूण</td>
                          <td className="border-2 border-gray-800 px-3 py-2 md:px-4 md:py-3 text-right font-bold">
                            ₹{formatAmount(ledgerData.totalDebit)}
                          </td>
                          <td className="border-2 border-gray-800 px-3 py-2 md:px-4 md:py-3 text-right font-bold">
                            ₹{formatAmount(ledgerData.totalCredit)}
                          </td>
                          <td className="border-2 border-gray-800 px-3 py-2 md:px-4 md:py-3 text-right font-bold">
                            ₹{formatAmount(ledgerData.finalBalance)}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={6} className="border border-gray-300 px-3 py-8 text-center">
                          <div className="flex flex-col items-center justify-center text-gray-500">
                            <FileText className="h-16 w-16 mb-4 text-gray-300" />
                            <p className="text-lg font-semibold mb-2">निवडलेल्या कालावधीत कोणतेही व्यवहार आढळले नाहीत</p>
                            <p className="text-sm">कृपया कर्जदार आणि तारीख निवडून पुन्हा प्रयत्न करा</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <User className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">खाते वही तयार करा</h3>
                <p className="text-gray-500">कर्जदार निवडा आणि तारीख ठरवून "खाते वही तयार करा" वर क्लिक करा</p>
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
    </div>
  );
}