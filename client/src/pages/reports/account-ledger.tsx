import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, Search, FileText, User, Wallet, CreditCard, Download, FileDown, Loader2, Layers } from "lucide-react";
import { ReceiptGenerator } from "@/components/receipt-generator";
import { displayNarration } from "@/lib/utils";
import { exportAccountLedgerToExcel } from "@/utils/excel-export";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DateUtils } from "@/lib/date-utils";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useRealTimeSync } from "@/hooks/use-real-time-sync";
import type { Company } from "@shared/schema";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function AccountLedger() {
  const [, setLocation] = useLocation();
  
  // Add print CSS for vertical orientation
  useEffect(() => {
    const printStyles = `
      @media print {
        @page {
          size: A4 portrait !important;
          margin: 8mm;
        }
        html, body {
          font-family: 'Noto Sans Devanagari', Arial, sans-serif !important;
          height: auto !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        body * {
          visibility: hidden;
        }
        .print-area, .print-area * {
          visibility: visible;
        }
        .print-area {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
          page-break-inside: auto;
          padding-left: 25mm !important;
          box-sizing: border-box !important;
        }
        .print-area table {
          page-break-inside: auto;
        }
        .print-area tr {
          page-break-inside: avoid;
        }
        .overflow-x-auto {
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
        }
        .no-print, .print:hidden, nav, aside, footer, .mobile-nav, .sidebar-modern {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          overflow: hidden !important;
        }
        .print-horizontal-layout {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 1.5rem !important;
          margin-bottom: 1rem !important;
        }
        .print-horizontal-layout > div {
          flex: 1 1 30% !important;
          min-width: 180px !important;
        }
        .print-hidden {
          display: none !important;
        }
        .print-only {
          display: block !important;
        }
      }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.textContent = printStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      try {
        if (styleElement.parentNode) {
          document.head.removeChild(styleElement);
        }
      } catch (e) {}
    };
  }, []);
  
  const getFYDates = () => {
    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();
    const fyStartYear = month >= 3 ? year : year - 1;
    return {
      from: `${fyStartYear}-04-01`,
      to: `${fyStartYear + 1}-03-31`
    };
  };
  const fyDates = getFYDates();

  const [filters, setFilters] = useState({
    accountType: '',
    partyId: '',
    loanId: '',
    borrowerId: '',
    dateFrom: fyDates.from,
    dateTo: fyDates.to
  });

  const [statementData, setStatementData] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // 🚀 REAL-TIME SYNC: Enable automatic updates for all loan operations
  const { triggerCompleteSync } = useRealTimeSync({
    enabled: true,
    onSyncComplete: (operation) => {
      console.log(`📊 ACCOUNT LEDGER: Real-time sync completed for ${operation}`);
      // Only refresh statement if user has already generated one AND it's not a UI interaction
      // Prevent automatic generation during dropdown selection to avoid race conditions
      if (statementData && filters.accountType && operation !== 'USER_INTERACTION') {
        // Only auto-refresh for actual data changes, not user selections
        console.log('📊 Auto-refreshing statement for data change:', operation);
        generateStatement();
      }
    }
  });

  // Excel Export Function with enhanced data
  const handleExcelExport = () => {
    if (!statementData || !statementData.entries || !Array.isArray(statementData.entries)) {
      alert('एक्सेल एक्सपोर्ट करण्यासाठी प्रथम खाते निवडा आणि शोधा बटन दाबा');
      return;
    }

    try {
      console.log('📄 EXCEL EXPORT: Starting with complete data:', {
        entriesCount: statementData.entries?.length || 0,
        accountName: selectedAccount?.name,
        accountType: statementData.account?.type,
        companyData: company?.name,
        hasTotals: !!statementData.totals
      });
      
      const success = exportAccountLedgerToExcel(
        statementData.entries,
        selectedAccount?.name || 'खाते',
        { from: filters.dateFrom, to: filters.dateTo },
        statementData.account,
        company, // Pass company data
        statementData // Pass complete statement data including totals
      );
      
      if (success) {
        alert('खाते लेजर यशस्वीरित्या एक्सेल फाइलमध्ये एक्सपोर्ट झाले!');
      } else {
        alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
      }
    } catch (error) {
      console.error('Excel export error:', error);
      alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
    }
  };

  // ESC key navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setLocation('/');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setLocation]);

  // Fetch company data
  const { data: company } = useQuery<Company>({
    queryKey: ["/api/company"],
  });

  // Fetch parties
  const { data: parties = [] } = useQuery({
    queryKey: ["/api/parties"],
  });

  // Fetch cash transactions with deduplication safety
  const { data: rawTransactions = [] } = useQuery({
    queryKey: ["/api/cash-transactions"],
    staleTime: 0, // Always refetch for fresh data
    gcTime: 0, // Don't cache
  });

  // Apply deduplication to prevent duplicate entries
  const transactions = Array.isArray(rawTransactions) ? 
    rawTransactions.filter((transaction, index) => 
      rawTransactions.findIndex(t => t.id === transaction.id) === index
    ) : [];

  // Fetch cash balance for cash account statement
  const { data: cashBalance } = useQuery({
    queryKey: ["/api/cash-balance"],
  });

  // Fetch loans for cash account integration and loan ledger
  const { data: loans = [] } = useQuery({
    queryKey: ["/api/loans"],
  });

  // Fetch loan closures for loan ledger
  const { data: closures = [] } = useQuery({
    queryKey: ["/api/loan-closures"],
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["/api/groups"],
  });

  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [bulkFY, setBulkFY] = useState('');
  const [bulkStatusFilter, setBulkStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  const bulkFyOptions = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const options = [];
    for (let i = 0; i < 10; i++) {
      const y = startYear - i;
      options.push({ value: y.toString(), label: `${y}-${y + 1}` });
    }
    return options;
  }, []);

  const handleBulkFetch = async (fy: string, status: string) => {
    if (!fy) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch(`/api/account-ledger/bulk?year=${fy}&status=${status}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const groupMap = new Map((groups as any[]).map((g: any) => [g.id, g.name || '']));
      data.sort((a: any, b: any) => {
        const gA = (groupMap.get(a.groupId) || '').localeCompare(groupMap.get(b.groupId) || '', 'mr');
        if (gA !== 0) return gA;
        return (a.accountNumber || '').localeCompare(b.accountNumber || '', undefined, { numeric: true });
      });
      setBulkData(data);
    } catch (err) {
      console.error('Bulk fetch error:', err);
      setBulkData([]);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkPrint = () => {
    if (bulkData.length === 0) return;
    setIsBulkGenerating(true);
    try {
      const html = ReceiptGenerator.generateBulkLoanLedger(bulkData, company ? { name: company.name, licenseNumber: company.licenseNumber ?? undefined } : null, groups as { id?: string; name?: string }[]);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
        };
      }
    } catch (err) {
      console.error('Bulk print error:', err);
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleAccountTypeChange = (type: string) => {
    setFilters(prev => ({ 
      ...prev, 
      accountType: type, 
      partyId: '', // Reset party selection when changing account type
      loanId: '', // Reset loan selection when changing account type
      borrowerId: '' // Reset borrower selection when changing account type
    }));
    setStatementData(null);
    setSelectedAccount(null);
  };

  const generateStatement = () => {
    try {
      // Enhanced validation with data readiness checks
      if (!filters.accountType || !filters.dateFrom || !filters.dateTo) {
        alert('कृपया खाते प्रकार आणि दिनांक निवडा');
        return;
      }

      if (filters.accountType === 'party' && !filters.partyId) {
        alert('कृपया पार्टी निवडा');
        return;
      }

      if (filters.accountType === 'individual_loan' && !filters.loanId) {
        alert('कृपया कर्ज निवडा');
        return;
      }

      // ✅ RACE CONDITION PROTECTION: Ensure data is loaded before processing
      if (filters.accountType === 'individual_loan') {
        const safeLoans = Array.isArray(loans) ? loans : [];
        if (safeLoans.length === 0) {
          console.warn('⚠️ PROTECTION: Loans data not ready, skipping statement generation');
          return;
        }
        
        const selectedLoan = safeLoans.find((loan: any) => loan.id === filters.loanId);
        if (!selectedLoan) {
          console.warn('⚠️ PROTECTION: Selected loan not found in data, skipping generation');
          return;
        }
      }

      if (filters.accountType === 'party') {
        const safeParties = Array.isArray(parties) ? parties : [];
        if (safeParties.length === 0) {
          console.warn('⚠️ PROTECTION: Parties data not ready, skipping statement generation');
          return;
        }
      }

      console.log('✅ STATEMENT GENERATION: All validations passed, proceeding...');

      if (filters.accountType === 'cash') {
        generateCashStatement();
      } else if (filters.accountType === 'party') {
        generatePartyStatement();
      } else if (filters.accountType === 'loan') {
        generateLoanStatement();
      } else if (filters.accountType === 'individual_loan') {
        generateIndividualLoanStatement();
      }
    } catch (error) {
      console.error('❌ Error generating statement:', error);
      setStatementData(null);
      setSelectedAccount(null);
      alert('लेजर तयार करताना त्रुटी झाली. कृपया पुन्हा प्रयत्न करा.');
    }
  };

  const generateCashStatement = () => {
    try {
      setSelectedAccount({ name: 'रोकड खाते', type: 'cash' });

      // Safe array check and filter transactions by date range
      const safeTransactions = Array.isArray(transactions) ? transactions : [];
      const filteredTransactions = safeTransactions.filter((transaction: any) => {
        try {
          const transactionDate = new Date(transaction.transactionDate);
          const fromDate = new Date(filters.dateFrom);
          const toDate = new Date(filters.dateTo);
          return transactionDate >= fromDate && transactionDate <= toDate;
        } catch (error) {
          console.warn('Error filtering transaction:', transaction, error);
          return false;
        }
      });

      // Filter loans by date range
      const safeLoans = Array.isArray(loans) ? loans : [];
      const filteredLoans = safeLoans.filter((loan: any) => {
        try {
          const loanDate = new Date(loan.loanDate);
          const fromDate = new Date(filters.dateFrom);
          const toDate = new Date(filters.dateTo);
          return loanDate >= fromDate && loanDate <= toDate;
        } catch (error) {
          console.warn('Error filtering loan:', loan, error);
          return false;
        }
      });

      // Create comprehensive cash ledger entries
      const entries: any[] = [];
      
      // Get opening balance from cash balance API (same as cashbook) 
      const openingBalance = (cashBalance as any)?.openingBalance || 0; // Default to 0 for clean start
      let runningBalance = openingBalance;

      const openingDate = new Date(filters.dateFrom).toLocaleDateString('en-GB');
      entries.push({
        date: openingDate,
        formattedDate: openingDate,
        description: 'प्रारंभिक शिल्लक',
        debit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        credit: openingBalance > 0 ? openingBalance : 0,
        balance: openingBalance,
        type: 'opening'
      });

      // CRITICAL FIX: Add cash transactions with deduplication
      // Filter out duplicates based on transaction ID
      const uniqueTransactionMap = new Map();
      filteredTransactions.forEach((transaction: any) => {
        if (!uniqueTransactionMap.has(transaction.id)) {
          uniqueTransactionMap.set(transaction.id, transaction);
        }
      });
      const uniqueTransactions = Array.from(uniqueTransactionMap.values());
      
      console.log('🔧 ACCOUNT LEDGER: After transaction deduplication:', {
        original: filteredTransactions.length,
        deduplicated: uniqueTransactions.length,
        rajPatelCount: uniqueTransactions.filter((t: any) => t.narration?.includes('राज पाटील')).length
      });

      uniqueTransactions.forEach((transaction: any) => {
        const amount = parseFloat(transaction.amount || 0);
        let debit = 0, credit = 0;

        if (transaction.transactionType === 'cash_out') {
          debit = amount;
          runningBalance -= amount;
        } else {
          credit = amount;
          runningBalance += amount;
        }

        // CASH ACCOUNT ENHANCEMENT: Show party name in description for dual-entry transactions
        let simpleDescription;
        
        // Check if this transaction has a party associated (dual-entry)
        if (transaction.partyId && (parties as any[])?.length > 0) {
          const relatedParty = (parties as any[]).find((p: any) => p.id === transaction.partyId);
          if (relatedParty) {
            simpleDescription = `${displayNarration(transaction.narration)} - ${relatedParty.name}`;
          } else {
            simpleDescription = displayNarration(transaction.narration);
          }
        } else {
          simpleDescription = displayNarration(transaction.narration);
        }

        // CRITICAL FIX: Ensure proper date formatting for each transaction
        const formattedDate = new Date(transaction.transactionDate).toLocaleDateString('en-GB');
        
        entries.push({
          date: formattedDate,
          formattedDate: formattedDate, // Backup date field
          description: simpleDescription,
          debit,
          credit,
          balance: runningBalance,
          type: 'transaction',
          originalDate: transaction.transactionDate // Keep original for debugging
        });
      });

      console.log('✅ ACCOUNT LEDGER: Skipping loan disbursements to prevent duplicates');
      console.log('✅ ACCOUNT LEDGER: Skipping loan closures to prevent duplicates');

      // Calculate totals for ledger footer
      const totalDebit = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
      const totalCredit = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
      
      console.log('💰 CASH LEDGER TOTALS:', {
        totalDebit: totalDebit.toLocaleString('en-IN'),
        totalCredit: totalCredit.toLocaleString('en-IN'),
        difference: (totalDebit - totalCredit).toLocaleString('en-IN')
      });

      setStatementData({
        entries: entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        account: {
          name: 'रोकड खाते',
          type: 'cash',
          openingBalance,
          closingBalance: runningBalance
        },
        totalDebit,
        totalCredit,
        finalBalance: runningBalance,
        totals: {
          totalDebit,
          totalCredit,
          balanceDifference: totalDebit - totalCredit
        }
      });
    } catch (error) {
      console.error('Error generating cash statement:', error);
      setStatementData(null);
      setSelectedAccount(null);
    }
  };

  const generatePartyStatement = () => {
    const party = (parties as any[]).find(p => p.id === filters.partyId);
    if (!party) {
      console.warn('Party not found');
      return;
    }

    setSelectedAccount(party);

    // Filter transactions for this party in date range
    const partyTransactions = (transactions as any[]).filter((transaction: any) => {
      const transactionDate = new Date(transaction.transactionDate);
      const fromDate = new Date(filters.dateFrom);
      const toDate = new Date(filters.dateTo);
      
      return transaction.partyId === filters.partyId &&
             transactionDate >= fromDate && 
             transactionDate <= toDate;
    });

    // Calculate opening balance by considering all transactions before the date range
    const allPartyTransactions = (transactions as any[]).filter((transaction: any) => {
      return transaction.partyId === filters.partyId;
    });

    // Calculate balance before the statement period starts
    const rawOpening = parseFloat(party.openingBalance) || 0;
    let openingBalance = party.openingBalanceType === 'credit' ? -rawOpening : rawOpening;
    
    allPartyTransactions.forEach((transaction: any) => {
      const transactionDate = new Date(transaction.transactionDate);
      const fromDate = new Date(filters.dateFrom);
      
      if (transactionDate < fromDate) {
        const amount = parseFloat(transaction.amount || 0);
        if (transaction.transactionType === 'cash_in') {
          openingBalance += amount;
        } else {
          openingBalance -= amount;
        }
      }
    });

    console.log('🎯 Party Opening Balance Calculation:', {
      partyName: party.name,
      originalOpeningBalance: party.openingBalance || 0,
      calculatedOpeningBalance: openingBalance,
      dateFrom: filters.dateFrom,
      allTransactionsCount: allPartyTransactions.length
    });

    const entries: any[] = [];
    let runningBalance = openingBalance;

    // Add opening balance entry with proper amount
    entries.push({
      date: filters.dateFrom,
      description: 'प्रारंभिक शिल्लक',
      debit: openingBalance > 0 ? openingBalance : 0,
      credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
      balance: openingBalance,
      type: 'opening'
    });

    // Sort transactions by date
    partyTransactions.sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
    
    partyTransactions.forEach((transaction: any) => {
      const amount = parseFloat(transaction.amount || 0);
      let debit = 0, credit = 0;
      
      if (transaction.transactionType === 'cash_in') {
        debit = amount;
        runningBalance += amount;
      } else {
        credit = amount;
        runningBalance -= amount;
      }
      
      let simpleDescription;
      
      if (transaction.partyId && transaction.partyId === filters.partyId) {
        if (transaction.transactionType === 'cash_in') {
          simpleDescription = `${party.name} - रोकड मिळाली`;
        } else {
          simpleDescription = `${party.name} - रोकड दिली`;
        }
      } else {
        simpleDescription = displayNarration(transaction.narration) || 
          (transaction.transactionType === 'cash_out' ? 'रोकड दिली' : 'रोकड मिळाली');
      }

      entries.push({
        date: transaction.transactionDate,
        description: simpleDescription,
        debit,
        credit,
        balance: runningBalance,
        type: transaction.transactionType,
        transactionId: transaction.id
      });
    });
    
    const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);
    
    setStatementData({
      account: party,
      entries,
      totalDebit,
      totalCredit,
      finalBalance: runningBalance,
      totals: {
        totalDebit,
        totalCredit,
        balanceDifference: totalDebit - totalCredit
      },
      dateRange: {
        from: filters.dateFrom,
        to: filters.dateTo
      }
    });
  };

  const generateIndividualLoanStatement = () => {
    try {
      console.log('🚀 Starting Individual Loan Statement Generation:', {
        loanId: filters.loanId,
        hasLoans: Array.isArray(loans),
        loansLength: Array.isArray(loans) ? loans.length : 0,
        hasTransactions: Array.isArray(transactions),
        hasClosures: Array.isArray(closures)
      });

      // Safety checks for all required data
      if (!filters.loanId) {
        console.error('❌ No loan ID specified in filters');
        alert('कृपया एक कर्ज निवडा');
        return;
      }

      const safeLoans = Array.isArray(loans) ? loans : [];
      if (safeLoans.length === 0) {
        console.error('❌ No loans data available');
        alert('कर्ज डेटा उपलब्ध नाही. कृपया पुन्हा प्रयत्न करा');
        return;
      }

      const selectedLoan = safeLoans.find((loan: any) => loan.id === filters.loanId);
      if (!selectedLoan) {
        console.error('❌ Loan not found for ID:', filters.loanId);
        console.log('Available loans:', safeLoans.map(l => ({ id: l.id, accountNumber: l.accountNumber })));
        alert('निवडलेले कर्ज सापडले नाही. कृपया पुन्हा निवडा');
        return;
      }

      // ✅ ENHANCED SAFETY: Additional validation before processing
      if (!selectedLoan.id || !selectedLoan.accountNumber) {
        console.error('❌ Invalid loan data structure:', selectedLoan);
        alert('कर्ज डेटा अपूर्ण आहे. कृपया पुन्हा निवडा');
        return;
      }

      setSelectedAccount(selectedLoan);

      // Generate individual loan ledger with enhanced safety
      const entries: any[] = [];
      let runningBalance = 0;
      
      // ✅ SAFE AMOUNT PARSING: Multiple fallbacks
      let principalAmount = 0;
      try {
        principalAmount = parseFloat(selectedLoan.principalAmount || 0);
        if (isNaN(principalAmount) || principalAmount < 0) {
          console.warn('⚠️ Invalid principal amount, defaulting to 0:', selectedLoan.principalAmount);
          principalAmount = 0;
        }
      } catch (parseError) {
        console.error('❌ Error parsing principal amount:', selectedLoan.principalAmount, parseError);
        principalAmount = 0;
      }

      // ✅ SAFE DATE HANDLING: Ensure valid date
      const safeLoanDate = selectedLoan.loanDate || new Date().toISOString().split('T')[0];
      const safeAccountNumber = selectedLoan.accountNumber || 'N/A';

      // Add opening balance entry (loan disbursement)
      // FORMAT 8 (LENDER PERSPECTIVE): Disbursement = Dr.(नावे) = we gave the loan
      runningBalance = principalAmount;
      entries.push({
        date: safeLoanDate,
        description: `कर्ज वितरण - खाते क्र. ${safeAccountNumber}`,
        debit: principalAmount,
        credit: 0,
        balance: runningBalance,
        type: 'loan_disbursement'
      });

      const safeTransactions = Array.isArray(transactions) ? transactions : [];
      // Filter loan transactions, excluding closure-related entries to prevent double-counting
      // (closure block below handles interest/principal breakdown separately)
      const loanTransactions = safeTransactions.filter((transaction: any) => {
        if (transaction.loanId !== filters.loanId) return false;
        const narration = transaction.narration || '';
        if (narration.includes('कर्ज बंद') || narration.includes('मुद्दल') || narration.includes('व्याज') || transaction.isSystemGenerated) return false;
        return true;
      });

      // FORMAT 8 (LENDER PERSPECTIVE): Payment received = Cr.(जमा) = borrower paid back
      loanTransactions.forEach((transaction: any) => {
        const amount = parseFloat(transaction.amount || 0);
        runningBalance -= amount;
        entries.push({
          date: transaction.transactionDate,
          description: `${transaction.description || 'Payment'} - ${displayNarration(transaction.narration) || ''}`,
          debit: 0,
          credit: amount,
          balance: runningBalance,
          type: 'payment',
          transactionId: transaction.id
        });
      });

      // Process loan closure entries with detailed breakdown
      
      // Fix: Check for closure data from loan closures table if closedAt is missing
      const safeClosures = Array.isArray(closures) ? closures : [];
      const loanClosure = safeClosures.find((closure: any) => closure.loanId === selectedLoan.id);
      // Retrieved loan closure data from database
      
      if (selectedLoan.status === 'closed' && (selectedLoan.closedAt || loanClosure)) {
        const principalAmount = parseFloat(loanClosure?.principalPaid || selectedLoan.principalAmount || 0);
        const interestAmount = parseFloat(loanClosure?.interestPaid || selectedLoan.interest || 0);
        const rawClosureDate = selectedLoan.closedAt || loanClosure?.closureDate;
        const closureDate = rawClosureDate ? (typeof rawClosureDate === 'string' ? rawClosureDate.split('T')[0] : rawClosureDate) : selectedLoan.loanDate;
        
        // Processing closure amounts for ledger entry
        
        // FORMAT 8 (LENDER PERSPECTIVE):
        // Interest charge = Dr.(नावे) = additional amount owed to lender
        // Interest payment = Cr.(जमा) = borrower paid interest
        // Principal repayment = Cr.(जमा) = borrower returned principal
        if (interestAmount > 0) {
          runningBalance += interestAmount;
          entries.push({
            date: closureDate,
            description: `व्याज`,
            debit: interestAmount,
            credit: 0,
            balance: runningBalance,
            type: 'interest_charge'
          });
          
          runningBalance -= interestAmount;
          entries.push({
            date: closureDate,
            description: `व्याज परतफेड`,
            debit: 0,
            credit: interestAmount,
            balance: runningBalance,
            type: 'interest_payment'
          });
        }
        
        runningBalance -= principalAmount;
        entries.push({
          date: closureDate,
          description: `मुद्दल परतफेड`,
          debit: 0,
          credit: principalAmount,
          balance: runningBalance,
          type: 'principal_payment'
        });
        
        // Final closure entry
        entries.push({
          date: closureDate,
          description: `कर्ज संपूर्ण बंद`,
          debit: 0,
          credit: 0,
          balance: runningBalance,
          type: 'loan_closure_final'
        });
      }

      // Sort entries by date
      entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      console.log('📊 FINAL STATEMENT ENTRIES:', entries.map(e => ({
        date: e.date,
        description: e.description,
        debit: e.debit,
        credit: e.credit,
        type: e.type
      })));

      const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
      const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);

      setStatementData({
        account: {
          ...selectedLoan,
          type: 'individual_loan',
          formattedType: 'नमुना क्रमांक आठ (नियम 18 पहा)'
        },
        entries,
        totalDebit,
        totalCredit,
        finalBalance: runningBalance,
        totals: {
          totalDebit,
          totalCredit,
          balanceDifference: totalDebit - totalCredit
        },
        dateRange: {
          from: filters.dateFrom,
          to: filters.dateTo
        }
      });
    } catch (error) {
      console.error('Error generating individual loan statement:', error);
      setStatementData(null);
      setSelectedAccount(null);
    }
  };

  const generateLoanStatement = () => {
    setSelectedAccount({
      name: 'सर्व कर्ज खाते (एकत्रित)',
      type: 'loan'
    });

    const entries: any[] = [];
    let runningBalance = 0;
    const fromDate = new Date(filters.dateFrom);
    const toDate = new Date(filters.dateTo);

    // Add opening balance entry
    entries.push({
      date: filters.dateFrom,
      description: 'प्रारंभिक शिल्लक',
      debit: 0,
      credit: 0,
      balance: 0,
      type: 'opening'
    });

    // Process loan disbursements in date range
    const disbursedLoans = (loans as any[]).filter((loan: any) => {
      const loanDate = new Date(loan.loanDate);
      return loanDate >= fromDate && loanDate <= toDate;
    });

    // LENDER PERSPECTIVE (Format 8 standard):
    // Disbursement = Dr.(नावे) = we gave the loan (our receivable increases)
    // Closure = Cr.(जमा) = we received back (our receivable decreases)
    // Using loans table as SINGLE authoritative source to prevent duplicates

    // Add loan disbursements from loans table
    disbursedLoans.forEach((loan: any) => {
      const amount = parseFloat(loan.principalAmount || 0);
      if (amount > 0) {
        runningBalance += amount;
        entries.push({
          date: loan.loanDate,
          description: `कर्ज वितरण - ${loan.borrowerName} (खाते क्र. ${loan.accountNumber})`,
          debit: amount,
          credit: 0,
          balance: runningBalance,
          type: 'loan_disbursement',
          loanId: loan.id,
          borrowerName: loan.borrowerName
        });
      }
    });

    const safeClosures = Array.isArray(closures) ? closures : [];
    const closedLoansWithData = (loans as any[]).filter((loan: any) => {
      if (loan.status !== 'closed') return false;
      const loanClosure = safeClosures.find((c: any) => c.loanId === loan.id);
      if (!loanClosure) return false;
      const closureDate = new Date(loanClosure.closureDate);
      return closureDate >= fromDate && closureDate <= toDate;
    });

    closedLoansWithData.forEach((loan: any) => {
      const loanClosure = safeClosures.find((c: any) => c.loanId === loan.id);
      if (!loanClosure) return;
      const principalPaid = parseFloat(loanClosure.principalPaid || '0');
      const interestPaid = parseFloat(loanClosure.interestPaid || '0');
      const totalRepayment = principalPaid + interestPaid;
      const closureDate = typeof loanClosure.closureDate === 'string' ? loanClosure.closureDate.split('T')[0] : loanClosure.closureDate;
      if (totalRepayment > 0) {
        runningBalance -= totalRepayment;
        entries.push({
          date: closureDate,
          description: `कर्ज बंद - ${loan.borrowerName} (खाते क्र. ${loan.accountNumber})`,
          debit: 0,
          credit: totalRepayment,
          balance: runningBalance,
          type: 'loan_closure',
          loanId: loan.id,
          borrowerName: loan.borrowerName
        });
      }
    });

    const loanRelatedTransactions = disbursedLoans.length + closedLoansWithData.length;

    // Sort entries by date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // LENDER PERSPECTIVE: Disbursements in Dr.(debit) column, Closures in Cr.(credit) column
    const totalLoanDisbursements = entries.filter(e => e.type === 'loan_disbursement').reduce((sum, entry) => sum + entry.debit, 0);
    const totalLoanClosures = entries.filter(e => e.type === 'loan_closure').reduce((sum, entry) => sum + entry.credit, 0);

    const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);

    setStatementData({
      account: {
        name: 'सर्व कर्ज खाते (एकत्रित)',
        type: 'loan',
        totalLoanTransactions: loanRelatedTransactions,
        totalDisbursements: totalLoanDisbursements,
        totalClosures: totalLoanClosures,
        outstandingAmount: totalLoanDisbursements - totalLoanClosures
      },
      entries,
      totalDebit,
      totalCredit,
      finalBalance: runningBalance,
      totals: {
        totalDebit,
        totalCredit,
        balanceDifference: totalDebit - totalCredit
      },
      dateRange: {
        from: filters.dateFrom,
        to: filters.dateTo
      }
    });
  };

  const handlePrint = () => {
    if (!statementData || !statementData.entries || statementData.entries.length === 0) {
      alert("प्रथम खाते निवडा आणि लेजर तयार करा");
      return;
    }

    const companyName = company?.name || 'कंपनी नाव';
    const accountType = statementData.account?.type || '';
    const isCashAccount = accountType === 'cash';
    const isLoanAccount = accountType === 'individual_loan' || accountType === 'loan';

    let headerTitle = 'खाते लेजर';
    let subTitle = '';
    if (accountType === 'individual_loan') {
      headerTitle = 'नमुना क्रमांक आठ';
      subTitle = '(नियम १८ पहा)';
    } else if (accountType === 'cash') {
      headerTitle = 'रोकड खाते लेजर';
    } else if (accountType === 'party') {
      headerTitle = 'व्यक्ती खाते लेजर';
    } else if (accountType === 'loan') {
      headerTitle = 'सर्व कर्ज खाते (एकत्रित) लेजर';
    }

    const accountName = statementData.account?.borrowerName || statementData.account?.name || 'खाते';
    const cleanAccountName = accountName.includes(' - ') ? accountName.split(' - ').pop()?.trim() || accountName : accountName;

    let accountInfoHTML = '';
    if (statementData.account?.accountNumber) {
      accountInfoHTML += `<span style="font-size:11px;margin-right:15px;">खाते क्र.: ${statementData.account.accountNumber}</span>`;
    }
    if (statementData.account?.principalAmount) {
      const amt = parseFloat(statementData.account.principalAmount);
      accountInfoHTML += `<span style="font-size:11px;margin-right:15px;">मुद्दल: ₹${isNaN(amt) ? '0' : amt.toLocaleString('en-IN')}</span>`;
    }
    if (statementData.account?.interestRate) {
      accountInfoHTML += `<span style="font-size:11px;margin-right:15px;">व्याज दर: ${statementData.account.interestRate}% ${statementData.account.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}</span>`;
    }
    if (statementData.account?.loanDate) {
      accountInfoHTML += `<span style="font-size:11px;">कर्ज दिनांक: ${DateUtils.isoToIndianDate(statementData.account.loanDate)}</span>`;
    }

    const bdr = '1.5px solid #333';
    const thStyle = `border:${bdr};padding:8px 6px;text-align:center;font-size:11px;background:#f0f0f0;font-weight:700;color:#111;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
    const tdBase = `border:${bdr};padding:8px 6px;font-size:11px;font-weight:600;line-height:1.4;`;

    let rows = '';
    statementData.entries.forEach((entry: any) => {
      const bal = entry.balance || 0;
      const drLabel = isCashAccount
        ? (bal >= 0 ? ' (Cr.)' : ' (Dr.)')
        : (bal >= 0 ? ' (Dr.)' : ' (Cr.)');
      const balColor = isCashAccount
        ? (bal >= 0 ? 'color:green;' : 'color:red;')
        : isLoanAccount
          ? 'color:red;'
          : (bal >= 0 ? 'color:#1e40af;' : 'color:red;');

      const dateDisplay = entry.type === 'opening' ? 'प्रारंभिक' : DateUtils.isoToIndianDate(entry.date);
      const rowBg = entry.type === 'opening' ? 'background:#fef3c7;-webkit-print-color-adjust:exact;print-color-adjust:exact;' : '';

      rows += `<tr>
        <td style="${tdBase}text-align:center;${rowBg}">${dateDisplay}</td>
        <td style="${tdBase}text-align:left;${rowBg}">${entry.description || ''}</td>
        <td style="${tdBase}text-align:right;${rowBg}">${entry.debit > 0 ? Math.round(entry.debit).toLocaleString('en-IN') : '-'}</td>
        <td style="${tdBase}text-align:right;${rowBg}">${entry.credit > 0 ? Math.round(entry.credit).toLocaleString('en-IN') : '-'}</td>
        <td style="${tdBase}text-align:right;font-weight:bold;${rowBg}${balColor}">${bal < 0 ? '-' : ''}${Math.round(Math.abs(bal)).toLocaleString('en-IN')}${drLabel}</td>
      </tr>`;
    });

    const finalBal = parseFloat(statementData.finalBalance || 0);
    const finalDrLabel = isCashAccount
      ? (finalBal >= 0 ? ' (Cr.)' : ' (Dr.)')
      : (finalBal >= 0 ? ' (Dr.)' : ' (Cr.)');
    const finalBalColor = isCashAccount
      ? (finalBal >= 0 ? 'color:green;' : 'color:red;')
      : isLoanAccount
        ? 'color:red;'
        : (finalBal >= 0 ? 'color:#1e40af;' : 'color:red;');

    rows += `<tr>
      <td style="${tdBase}text-align:center;background:#e0e7ff;-webkit-print-color-adjust:exact;print-color-adjust:exact;" colspan="2"><b>एकूण</b></td>
      <td style="${tdBase}text-align:right;background:#e0e7ff;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${Math.round(parseFloat(statementData.totalDebit || 0)).toLocaleString('en-IN')}</td>
      <td style="${tdBase}text-align:right;background:#e0e7ff;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${Math.round(parseFloat(statementData.totalCredit || 0)).toLocaleString('en-IN')}</td>
      <td style="${tdBase}text-align:right;background:#e0e7ff;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact;${finalBalColor}">${finalBal < 0 ? '-' : ''}${Math.round(Math.abs(finalBal)).toLocaleString('en-IN')} ${finalDrLabel.trim()}</td>
    </tr>`;

    const printHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${headerTitle}</title>
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
  <p style="font-size:14px;font-weight:700;">${headerTitle}</p>
  ${subTitle ? `<p style="font-size:11px;color:#333;">${subTitle}</p>` : ''}
  <p style="font-size:11px;color:#333;">कालावधी: ${DateUtils.isoToIndianDate(filters.dateFrom)} ते ${DateUtils.isoToIndianDate(filters.dateTo)}</p>
</div>
<div style="margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #ddd;">
  <p style="font-size:12px;font-weight:600;margin:0 0 4px 0;">खाते: ${cleanAccountName}</p>
  ${accountInfoHTML ? `<p style="margin:0 0 3px 0;">${accountInfoHTML}</p>` : ''}
</div>
<table>
  <colgroup><col style="width:12%;"><col style="width:34%;"><col style="width:16%;"><col style="width:16%;"><col style="width:22%;"></colgroup>
  <thead><tr>
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
  };

  const handleMobilePdfDownload = async () => {
    if (!statementData || !statementData.entries || statementData.entries.length === 0) {
      alert("प्रथम खाते निवडा आणि लेजर तयार करा");
      return;
    }

    try {
      const renderWidthPx = 794;
      const companyName = company?.name || 'कंपनी नाव';
      const accountName = statementData.account?.borrowerName || statementData.account?.name || 'खाते';
      const cleanAccountName = accountName.includes(' - ') ? accountName.split(' - ').pop()?.trim() || accountName : accountName;
      const accountType = statementData.account?.type || '';
      const isCashAccount = accountType === 'cash';
      const isLoanAccount = accountType === 'individual_loan' || accountType === 'loan';

      let headerTitle = 'खाते लेजर';
      let subTitle = '';
      if (accountType === 'individual_loan') {
        headerTitle = 'नमुना क्रमांक आठ';
        subTitle = '(नियम १८ पहा)';
      } else if (accountType === 'cash') {
        headerTitle = 'रोकड खाते लेजर';
      } else if (accountType === 'party') {
        headerTitle = 'व्यक्ती खाते लेजर';
      } else if (accountType === 'loan') {
        headerTitle = 'सर्व कर्ज खाते (एकत्रित) लेजर';
      }

      let accountInfoHTML = '';
      if (statementData.account?.accountNumber) {
        accountInfoHTML += `<span style="font-size:11px;margin-right:15px;">खाते क्र.: ${statementData.account.accountNumber}</span>`;
      }
      if (statementData.account?.principalAmount) {
        const amt = parseFloat(statementData.account.principalAmount);
        accountInfoHTML += `<span style="font-size:11px;margin-right:15px;">मुद्दल: ₹${isNaN(amt) ? '0' : amt.toLocaleString('en-IN')}</span>`;
      }
      if (statementData.account?.interestRate) {
        accountInfoHTML += `<span style="font-size:11px;margin-right:15px;">व्याज दर: ${statementData.account.interestRate}% ${statementData.account.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}</span>`;
      }
      if (statementData.account?.loanDate) {
        accountInfoHTML += `<span style="font-size:11px;">कर्ज दिनांक: ${DateUtils.isoToIndianDate(statementData.account.loanDate)}</span>`;
      }

      const thStyle = `border:1.5px solid #333;padding:8px 6px;text-align:center;font-size:11px;background:#f0f0f0;font-weight:700;color:#111;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
      const tdBase = `border:1.5px solid #333;padding:8px 6px;font-size:11px;font-weight:600;line-height:1.4;`;

      let rows = '';
      statementData.entries.forEach((entry: any) => {
        const bal = entry.balance || 0;
        const drLabel = isCashAccount
          ? (bal >= 0 ? ' (Cr.)' : ' (Dr.)')
          : (bal >= 0 ? ' (Dr.)' : ' (Cr.)');
        const balColor = isCashAccount
          ? (bal >= 0 ? 'color:green;' : 'color:red;')
          : isLoanAccount
            ? 'color:red;'
            : (bal >= 0 ? 'color:#1e40af;' : 'color:red;');

        const dateDisplay = entry.type === 'opening' ? 'प्रारंभिक' : DateUtils.isoToIndianDate(entry.date);
        const rowBg = entry.type === 'opening' ? 'background:#fff4e6;' : '';

        rows += `<tr style="${rowBg}">
          <td style="${tdBase}text-align:center;">${dateDisplay}</td>
          <td style="${tdBase}text-align:left;">${entry.description || ''}</td>
          <td style="${tdBase}text-align:right;">${entry.debit > 0 ? Math.round(entry.debit).toLocaleString('en-IN') : '<span style="color:#999;">-</span>'}</td>
          <td style="${tdBase}text-align:right;">${entry.credit > 0 ? Math.round(entry.credit).toLocaleString('en-IN') : '<span style="color:#999;">-</span>'}</td>
          <td style="${tdBase}text-align:right;font-weight:bold;font-size:11px;background:#eef2ff;${balColor}">${bal < 0 ? '-' : ''}${Math.round(Math.abs(bal)).toLocaleString('en-IN')}${drLabel}</td>
        </tr>`;
      });

      const finalBal = parseFloat(statementData.finalBalance || 0);
      const finalDrLabel = isCashAccount
        ? (finalBal >= 0 ? ' (Cr.)' : ' (Dr.)')
        : (finalBal >= 0 ? ' (Dr.)' : ' (Cr.)');
      const finalBalColor = isCashAccount
        ? (finalBal >= 0 ? 'color:green;' : 'color:red;')
        : isLoanAccount
          ? 'color:red;'
          : (finalBal >= 0 ? 'color:#1e40af;' : 'color:red;');

      const totTd = `border:none;border-top:1px solid #333;border-bottom:1px solid #333;padding:7px 5px;font-size:10px;font-weight:bold;line-height:1.5;background:#e3f2fd;`;

      rows += `<tr>
        <td style="${totTd}text-align:center;" colspan="2">एकूण</td>
        <td style="${totTd}text-align:right;">${Math.round(parseFloat(statementData.totalDebit || 0)).toLocaleString('en-IN')}</td>
        <td style="${totTd}text-align:right;">${Math.round(parseFloat(statementData.totalCredit || 0)).toLocaleString('en-IN')}</td>
        <td style="${totTd}text-align:right;font-size:12px;background:#c7d2fe;color:#1e40af;white-space:nowrap;${finalBalColor}"><span style="font-size:12px;">${finalBal < 0 ? '-' : ''}${Math.round(Math.abs(finalBal)).toLocaleString('en-IN')}</span> <span style="font-size:9px;">${finalDrLabel.trim()}</span></td>
      </tr>`;

      const fullHTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; background: white; width: ${renderWidthPx}px; padding: 20px 30px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      </style></head><body>
        <div style="text-align:center;margin-bottom:12px;font-weight:bold;">
          <p style="font-size:15px;font-weight:700;margin:0 0 4px 0;">${companyName}</p>
          <p style="font-size:14px;font-weight:700;margin:0 0 4px 0;">${headerTitle}</p>
          ${subTitle ? `<p style="font-size:11px;color:#333;margin:0 0 4px 0;">${subTitle}</p>` : ''}
          <p style="font-size:11px;color:#333;margin:0 0 4px 0;">कालावधी: ${DateUtils.isoToIndianDate(filters.dateFrom)} ते ${DateUtils.isoToIndianDate(filters.dateTo)}</p>
        </div>
        <div style="margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #ddd;">
          <p style="font-size:12px;font-weight:600;margin:0 0 4px 0;">खाते: ${cleanAccountName}</p>
          ${accountInfoHTML ? `<p style="margin:0 0 3px 0;">${accountInfoHTML}</p>` : ''}
        </div>
        <table>
          <colgroup>
            <col style="width:12%;">
            <col style="width:34%;">
            <col style="width:16%;">
            <col style="width:16%;">
            <col style="width:22%;">
          </colgroup>
          <thead>
            <tr>
              <th style="${thStyle}">दिनांक</th>
              <th style="${thStyle}">तपशील</th>
              <th style="${thStyle}">नावे (Dr.)</th>
              <th style="${thStyle}">जमा (Cr.)</th>
              <th style="${thStyle}background:#dbeafe;font-size:10px;">शिल्लक</th>
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

      await new Promise(resolve => setTimeout(resolve, 300));
      if (iframeDoc.fonts && iframeDoc.fonts.ready) {
        await iframeDoc.fonts.ready;
      }
      await new Promise(resolve => setTimeout(resolve, 100));

      const targetEl = iframeDoc.body;
      const contentHeight = targetEl.scrollHeight;

      const canvas = await html2canvas(targetEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 5000,
        width: renderWidthPx,
        height: contentHeight,
        windowWidth: renderWidthPx,
        windowHeight: contentHeight,
      });

      document.body.removeChild(iframe);

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
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
        doc.addImage(imgData, 'JPEG', 0, yOffset, pageWidth, imgTotalHeight);
      }

      const safeAccountName = (accountName || 'खाते').replace(/[/\\?%*:|"<>]/g, '_');
      doc.save(`खाते_लेजर_${safeAccountName}_${filters.dateFrom}_to_${filters.dateTo}.pdf`);
    } catch (error) {
      console.error('Mobile PDF generation error:', error);
      const existingIframe = document.querySelector('iframe[style*="-9999px"]');
      if (existingIframe) existingIframe.remove();
      alert("PDF तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-amber-50">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 print:hidden">
          <div className="sidebar-modern h-full">
            <Sidebar />
          </div>
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="space-y-6">
              {/* Header */}
              <div className="mb-6 print:hidden">
                <h1 className="text-2xl font-semibold text-foreground heading-professional">खाते लेजर (सर्वप्रकार)</h1>
                <p className="text-muted-foreground">सर्व प्रकारचे खाते लेजर एकाच ठिकाणी</p>
              </div>

              <div className="flex border-b mb-4 print:hidden">
                <button
                  onClick={() => setActiveTab('single')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'single' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <FileText className="h-4 w-4 inline mr-1" />
                  एकल लेजर
                </button>
                <button
                  onClick={() => setActiveTab('bulk')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'bulk' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <Layers className="h-4 w-4 inline mr-1" />
                  बल्क प्रिंट (नमुना ८)
                </button>
              </div>

              {activeTab === 'single' && (<>
              {/* Account Selection & Filters */}
              <Card className="card-professional print:hidden mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 heading-professional">
                    <Search className="h-5 w-5" />
                    खाते प्रकार आणि कालावधी निवडा
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    {/* Account Type Selection */}
                    <div>
                      <Label className="text-sm font-semibold text-gray-700">खाते प्रकार निवडा</Label>
                      <Select value={filters.accountType || undefined} onValueChange={handleAccountTypeChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="खाते प्रकार निवडा" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash" textValue="रोकड खाते">
                            <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4" />
                              रोकड खाते
                            </div>
                          </SelectItem>
                          <SelectItem value="party" textValue="व्यक्ती खाते">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              व्यक्ती खाते
                            </div>
                          </SelectItem>
                          <SelectItem value="loan" textValue="सर्व कर्ज खाते">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              सर्व कर्ज खाते (एकत्रित)
                            </div>
                          </SelectItem>
                          <SelectItem value="individual_loan" textValue="वैयक्तिक कर्ज लेजर">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              वैयक्तिक कर्ज लेजर (नमुना क्र. ८)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Party Selection (only when party account type is selected) */}
                    {filters.accountType === 'party' && (
                      <div>
                        <Label className="text-sm font-semibold text-gray-700">व्यक्ती निवडा</Label>
                        <Select value={filters.partyId || undefined} onValueChange={(value) => setFilters(prev => ({ ...prev, partyId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="व्यक्ती निवडा" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(parties) && parties.map((party: any) => (
                              <SelectItem key={party?.id || 'unknown'} value={party?.id || ''} textValue={party?.name || 'अज्ञात व्यक्ती'}>
                                <div className="flex flex-col">
                                  <span>{party?.name || 'अज्ञात व्यक्ती'}</span>
                                  {party?.mobile && (
                                    <span className="text-xs text-gray-500">{party.mobile}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Individual Loan Selection (only when individual_loan account type is selected) */}
                    {filters.accountType === 'individual_loan' && (
                      <div>
                        <Label className="text-sm font-semibold text-gray-700">कर्जदार निवडा</Label>
                        <Select 
                          value={filters.loanId || undefined} 
                          onValueChange={(value) => {
                            try {
                              console.log('🔍 DROPDOWN: Loan selection changed to:', value);
                              if (value && typeof value === 'string') {
                                setFilters(prev => ({ ...prev, loanId: value }));
                              }
                            } catch (error) {
                              console.error('❌ Error in loan dropdown selection:', error);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="कर्जदार निवडा" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(loans) && loans
                              .filter((loan: any) => loan && loan.id && typeof loan.id === 'string') // ✅ Filter out invalid loans
                              .map((loan: any, index: number) => {
                                const safeId = loan.id || `fallback-${index}`;
                                const safeName = loan.borrowerName || 'अज्ञात कर्जदार';
                                const safeAccountNumber = loan.accountNumber || 'N/A';
                                
                                let amountDisplay = '0';
                                try {
                                  const amount = parseFloat(loan.principalAmount || 0);
                                  amountDisplay = isNaN(amount) ? '0' : amount.toLocaleString('en-IN');
                                } catch (error) {
                                  console.warn('⚠️ Amount formatting error for loan:', loan.id, error);
                                  amountDisplay = '0';
                                }
                                
                                return (
                                  <SelectItem 
                                    key={`loan-${safeId}-${index}`} 
                                    value={safeId}
                                    textValue={safeName}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{safeName}</span>
                                      <span className="text-xs text-gray-500">
                                        खाते क्र. {safeAccountNumber} | ₹{amountDisplay}
                                      </span>
                                      {loan.borrowerMobile && (
                                        <span className="text-xs text-gray-500">{loan.borrowerMobile}</span>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}



                    {/* Date From */}
                    <div>
                      <Label htmlFor="dateFrom" className="text-sm font-semibold text-gray-700">पासून दिनांक (From Date)</Label>
                      <Input
                        id="dateFrom"
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        className="border-2 border-indigo-200 focus:border-indigo-500 font-inter"
                      />
                    </div>

                    {/* Date To */}
                    <div>
                      <Label htmlFor="dateTo" className="text-sm font-semibold text-gray-700">पर्यंत दिनांक (To Date)</Label>
                      <Input
                        id="dateTo"
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        className="border-2 border-indigo-200 focus:border-indigo-500 font-inter"
                      />
                    </div>

                    {/* Buttons */}
                    <div>
                      <Label className="text-sm font-semibold text-gray-700">रिपोर्ट पाहा</Label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Button onClick={generateStatement} className="btn-professional btn-primary print:hidden">
                          <Search className="h-4 w-4 mr-2" />
                          लेजर तयार करा
                        </Button>
                        {statementData && (
                          <>
                            <Button onClick={handlePrint} variant="outline" className="btn-professional print:hidden">
                              <Printer className="h-4 w-4 mr-2" />
                              प्रिंट करा
                            </Button>
                            {!isMobile && (
                              <Button onClick={handleExcelExport} variant="outline" className="btn-professional print:hidden bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                                <Download className="h-4 w-4 mr-2" />
                                एक्सेल एक्सपोर्ट
                              </Button>
                            )}
                            {isMobile && (
                              <Button onClick={handleMobilePdfDownload} variant="outline" className="btn-professional print:hidden bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200">
                                <FileDown className="h-4 w-4 mr-2" />
                                मोबाईल PDF
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Statement Display */}
              {statementData && (
                <Card className="ledger-card print-area">
                  <CardContent className="p-6 md:p-8">
                    {/* Statement Header */}
                    <div className="ledger-header space-y-2">
                      <h2 className="text-xl md:text-2xl font-bold print:hidden">{company?.name || 'कंपनी नाव'}</h2>
                      <p className="text-sm md:text-base text-gray-600 print:hidden">{company?.address}</p>
                      <h3 className="text-lg md:text-xl font-semibold mt-4">
                        {statementData.account.type === 'individual_loan' 
                          ? statementData.account.formattedType || 'नमुना क्रमांक आठ (नियम 18 पहा)'
                          : 'खाते लेजर'
                        }
                      </h3>
                      <div className="text-sm text-gray-600 text-left">
                        {/* ✅ PROFESSIONAL PRINT: Account info in horizontal layout for print only */}
                        <div className="print-hidden flex flex-col gap-1">
                          <p><strong>खाते:</strong> {(() => { const n = statementData.account.borrowerName || statementData.account.name || ''; return n.includes(' - ') ? n.split(' - ').pop()?.trim() || n : n; })()}</p>
                          {(statementData.account.mobile || statementData.account.borrowerMobile) && (
                            <p><strong>मोबाईल:</strong> {statementData.account.mobile || statementData.account.borrowerMobile}</p>
                          )}
                          {statementData.account.accountNumber && <p><strong>खाते क्र.:</strong> {statementData.account.accountNumber}</p>}
                          {statementData.account.principalAmount && <p><strong>मुद्दल:</strong> ₹{(() => {
                            try {
                              const amount = parseFloat(statementData.account.principalAmount);
                              return isNaN(amount) ? '0' : amount.toLocaleString('en-IN');
                            } catch (error) {
                              console.warn('Error formatting principal amount:', statementData.account.principalAmount, error);
                              return '0';
                            }
                          })()}</p>}
                          {statementData.account.interestRate && <p><strong>व्याज दर:</strong> {statementData.account.interestRate}% {statementData.account.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}</p>}
                          {statementData.account.type === 'individual_loan' && (
                            <>
                              {statementData.account.loanDate && <p><strong>कर्ज दिनांक:</strong> {DateUtils.isoToIndianDate(statementData.account.loanDate)}</p>}
                              {/* ✅ ALWAYS SHOW LABEL: Show closure date for closed loans, blank for active loans */}
                              {statementData.account.type === 'individual_loan' && (
                                <p><strong>परतफेड दिनांक:</strong> {
                                  statementData.account.status === 'closed' && statementData.account.closedAt 
                                    ? DateUtils.isoToIndianDate(statementData.account.closedAt)
                                    : ''
                                }</p>
                              )}
                              {statementData.account.businessType && <p><strong>व्यवसाय प्रकार:</strong> {statementData.account.businessType === 'कृषी' ? 'कृषी' : 'बिगर कृषी'}</p>}
                              {statementData.account.collateral && <p><strong>वस्तूचे नाव:</strong> {statementData.account.collateral}</p>}
                            </>
                          )}
                        </div>
                        
                        {/* ✅ PRINT ONLY: Professional horizontal layout */}
                        <div className="print-only print-horizontal-layout">
                          <div>
                            <p><strong>खाते:</strong> {(() => { const n = statementData.account.borrowerName || statementData.account.name || ''; return n.includes(' - ') ? n.split(' - ').pop()?.trim() || n : n; })()}</p>
                            {(statementData.account.mobile || statementData.account.borrowerMobile) && (
                              <p><strong>मोबाईल:</strong> {statementData.account.mobile || statementData.account.borrowerMobile}</p>
                            )}
                            {statementData.account.accountNumber && <p><strong>खाते क्र.:</strong> {statementData.account.accountNumber}</p>}
                          </div>
                          <div>
                            {statementData.account.principalAmount && <p><strong>मुद्दल:</strong> ₹{(() => {
                              try {
                                const amount = parseFloat(statementData.account.principalAmount);
                                return isNaN(amount) ? '0' : amount.toLocaleString('en-IN');
                              } catch (error) {
                                console.warn('Error formatting principal amount:', statementData.account.principalAmount, error);
                                return '0';
                              }
                            })()}</p>}
                            {statementData.account.interestRate && <p><strong>व्याज दर:</strong> {statementData.account.interestRate}% {statementData.account.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}</p>}
                          </div>
                          <div>
                            {statementData.account.type === 'individual_loan' && (
                              <>
                                {statementData.account.loanDate && <p><strong>कर्ज दिनांक:</strong> {DateUtils.isoToIndianDate(statementData.account.loanDate)}</p>}
                                {/* ✅ ALWAYS SHOW LABEL: Show closure date for closed loans, blank for active loans */}
                                <p><strong>परतफेड दिनांक:</strong> {
                                  statementData.account.status === 'closed' && statementData.account.closedAt 
                                    ? DateUtils.isoToIndianDate(statementData.account.closedAt)
                                    : ''
                                }</p>
                                {statementData.account.businessType && <p><strong>व्यवसाय प्रकार:</strong> {statementData.account.businessType === 'कृषी' ? 'कृषी' : 'बिगर कृषी'}</p>}
                              </>
                            )}
                          </div>
                        </div>
                        {statementData.account.totalLoans && (
                          <div className="mt-2 p-2 bg-indigo-50 rounded">
                            <p><strong>एकूण कर्ज:</strong> {statementData.account.totalLoans} कर्ज</p>
                            <p><strong>एकूण कर्ज राशी:</strong> ₹{(() => {
                              try {
                                return statementData.account.totalLoansAmount?.toLocaleString('en-IN') || '0';
                              } catch (error) {
                                console.warn('Error formatting totalLoansAmount:', error);
                                return '0';
                              }
                            })()}</p>
                            <p><strong>एकूण बंद कर्ज:</strong> ₹{(() => {
                              try {
                                return statementData.account.totalClosuresAmount?.toLocaleString('en-IN') || '0';
                              } catch (error) {
                                console.warn('Error formatting totalClosuresAmount:', error);
                                return '0';
                              }
                            })()}</p>
                            <p><strong>एकूण रोकड आली:</strong> ₹{(() => {
                              try {
                                return statementData.account.totalCashIn?.toLocaleString('en-IN') || '0';
                              } catch (error) {
                                console.warn('Error formatting totalCashIn:', error);
                                return '0';
                              }
                            })()}</p>
                            <p><strong>एकूण रोकड गेली:</strong> ₹{(() => {
                              try {
                                return statementData.account.totalCashOut?.toLocaleString('en-IN') || '0';
                              } catch (error) {
                                console.warn('Error formatting totalCashOut:', error);
                                return '0';
                              }
                            })()}</p>
                          </div>
                        )}

                      </div>
                    </div>

                    {/* Statement Table */}
                    <div className="overflow-x-auto">
                      <Table className="ledger-table md:text-base">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="border text-center md:py-3">दिनांक</TableHead>
                            <TableHead className="border text-center md:py-3">तपशील</TableHead>
                            <TableHead className="border text-center md:py-3">नावे (Dr.)</TableHead>
                            <TableHead className="border text-center md:py-3">जमा (Cr.)</TableHead>
                            <TableHead className="border text-center md:py-3">शिल्लक</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statementData.entries.map((entry: any, index: number) => (
                            <TableRow key={index} className={entry.type === 'opening' ? 'bg-gray-50 font-semibold' : ''}>
                              <TableCell className="border text-center">
                                {(() => {
                                  // If it's marked as opening entry, show प्रारंभिक
                                  if (entry.type === 'opening') {
                                    return 'प्रारंभिक';
                                  }
                                  
                                  // Use dynamic date calculation
                                  const entryDate = entry.date;
                                  
                                  // Otherwise show normal date
                                  return DateUtils.isoToIndianDate(entry.date);
                                })()}
                              </TableCell>
                              <TableCell className="border">
                                {entry.description}
                              </TableCell>
                              <TableCell className="border text-right">
                                {entry.debit > 0 && `₹${Math.round(entry.debit).toLocaleString('en-IN')}`}
                              </TableCell>
                              <TableCell className="border text-right">
                                {entry.credit > 0 && `₹${Math.round(entry.credit).toLocaleString('en-IN')}`}
                              </TableCell>
                              <TableCell className="border text-right">
                                {(() => {
                                  const isCashAccount = statementData.account?.type === 'cash';
                                  const isLoanAccount = statementData.account?.type === 'individual_loan' || statementData.account?.type === 'loan';
                                  const bal = entry.balance;
                                  const drLabel = isCashAccount
                                    ? (bal >= 0 ? ' (Cr.)' : ' (Dr.)')
                                    : (bal >= 0 ? ' (Dr.)' : ' (Cr.)');
                                  const colorClass = isCashAccount
                                    ? (bal >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold')
                                    : isLoanAccount
                                      ? 'text-red-600 font-semibold'
                                      : (bal >= 0 ? 'text-indigo-600 font-semibold' : 'text-red-600 font-semibold');
                                  return (
                                    <span className={colorClass}>
                                      {bal < 0 ? '-' : ''}₹{Math.round(Math.abs(bal)).toLocaleString('en-IN')}
                                      {drLabel}
                                    </span>
                                  );
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}

                          {/* Summary Row */}
                          <TableRow className="bg-gray-100 font-bold">
                            <TableCell className="border text-center" colSpan={2}>एकूण</TableCell>
                            <TableCell className="border text-right">
                              ₹{Math.round(parseFloat(statementData.totalDebit || 0)).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="border text-right">
                              ₹{Math.round(parseFloat(statementData.totalCredit || 0)).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="border text-right">
                              {(() => {
                                const isCashAccount = statementData.account?.type === 'cash';
                                const isLoanAccount = statementData.account?.type === 'individual_loan' || statementData.account?.type === 'loan';
                                const bal = parseFloat(statementData.finalBalance || 0);
                                const drLabel = isCashAccount
                                  ? (bal >= 0 ? ' (Cr.)' : ' (Dr.)')
                                  : (bal >= 0 ? ' (Dr.)' : ' (Cr.)');
                                const colorClass = isCashAccount
                                  ? (bal >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold')
                                  : isLoanAccount
                                    ? 'text-red-600 font-bold'
                                    : (bal >= 0 ? 'text-indigo-600 font-bold' : 'text-red-600 font-bold');
                                return (
                                  <span className={colorClass}>
                                    {bal < 0 ? '-' : ''}₹{Math.round(Math.abs(bal)).toLocaleString('en-IN')}
                                    {drLabel}
                                  </span>
                                );
                              })()}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      
                      {/* CRITICAL: Add totals section */}
                      {statementData.totals && (
                        <div className="mt-4 border-t pt-4">
                          <div className="grid grid-cols-3 gap-4 font-semibold text-lg">
                            <div className="text-right">
                              <span className={statementData.account?.type === 'individual_loan' || statementData.account?.type === 'loan' ? 'text-red-600' : 'text-indigo-600'}>एकूण नावे: ₹{Math.round(statementData.totals.totalDebit).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-green-600">एकूण जमा: ₹{Math.round(statementData.totals.totalCredit).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-right">
                              {(() => {
                                const isCashAccount = statementData.account?.type === 'cash';
                                const isLoanAccount = statementData.account?.type === 'individual_loan' || statementData.account?.type === 'loan';
                                const bal = statementData.finalBalance;
                                const drLabel = isCashAccount
                                  ? (bal >= 0 ? ' (Cr.)' : ' (Dr.)')
                                  : (bal >= 0 ? ' (Dr.)' : ' (Cr.)');
                                const colorClass = isCashAccount
                                  ? (bal >= 0 ? 'text-green-600' : 'text-red-600')
                                  : isLoanAccount
                                    ? 'text-red-600'
                                    : (bal >= 0 ? 'text-indigo-600' : 'text-red-600');
                                return (
                                  <span className={colorClass}>
                                    फरक: {bal < 0 ? '-' : ''}₹{Math.round(Math.abs(bal)).toLocaleString('en-IN')}
                                    {drLabel}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Statement Footer */}
                    <div className="mt-6 text-sm text-gray-600 text-center no-print">
                      <p>अहवाल तयार केला: {new Date().toLocaleDateString('en-GB')}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              </>)}

              {activeTab === 'bulk' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
                      <Layers className="h-5 w-5" />
                      बल्क प्रिंट — नमुना क्रमांक ८
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      एका आर्थिक वर्षातील सर्व कर्जांचे वैयक्तिक लेजर (नमुना क्र. ८) एकदम प्रिंट करा (A4 portrait — प्रत्येक कर्ज स्वतंत्र पानावर)
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="text-sm font-semibold mb-1 block">आर्थिक वर्ष निवडा</Label>
                        <Select value={bulkFY} onValueChange={(val) => { setBulkFY(val); handleBulkFetch(val, bulkStatusFilter); }}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="आर्थिक वर्ष निवडा..." />
                          </SelectTrigger>
                          <SelectContent>
                            {bulkFyOptions.map(fy => (
                              <SelectItem key={fy.value} value={fy.value}>{fy.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold mb-1 block">कर्ज स्थिती</Label>
                        <div className="flex gap-4 mt-2">
                          {([
                            { value: 'all', label: 'सर्व' },
                            { value: 'active', label: 'फक्त चालू' },
                            { value: 'closed', label: 'फक्त बंद' },
                          ] as const).map(opt => (
                            <div key={opt.value} className="flex items-center space-x-2">
                              <input type="radio" id={`bulk8-status-${opt.value}`} name="bulk8StatusFilter" value={opt.value} checked={bulkStatusFilter === opt.value} onChange={(e) => { const v = e.target.value as 'all' | 'active' | 'closed'; setBulkStatusFilter(v); if (bulkFY) handleBulkFetch(bulkFY, v); }} className="h-4 w-4" autoComplete="off" />
                              <Label htmlFor={`bulk8-status-${opt.value}`} className="text-sm cursor-pointer">{opt.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-50 rounded">
                      • A4 portrait — प्रत्येक कर्जाचा लेजर स्वतंत्र पानावर | गट नाव → खाते क्रमांक क्रमवारी
                    </div>

                    {isBulkLoading && (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-2" />
                        <p className="text-gray-500">डेटा लोड होत आहे...</p>
                      </div>
                    )}

                    {bulkFY && !isBulkLoading && (
                      <>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
                            {bulkData.length} कर्जे
                          </span>
                          <span className="text-sm text-gray-500">
                            ({bulkData.length} A4 पृष्ठे)
                          </span>
                        </div>

                        {bulkData.length > 0 && (
                          <div className="max-h-60 overflow-y-auto border rounded-lg mb-4 bg-white">
                            {bulkData.map((item: any, idx: number) => {
                              const groupName = (groups as any[]).find((g: any) => g.id === item.groupId)?.name || '';
                              return (
                                <div key={item.loanId || idx} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 hover:bg-gray-50">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 w-6 text-right">{idx + 1}</span>
                                    <div>
                                      <div className="text-sm font-medium">{item.borrowerName}</div>
                                      <div className="text-xs text-gray-500">
                                        {groupName && <span className="text-indigo-600">{groupName}</span>}
                                        {groupName && ' | '}खाते: {item.accountNumber} | मुद्दल: ₹{Math.round(item.principalAmount || 0).toLocaleString('en-IN')} | शिल्लक: ₹{Math.round(Math.abs(item.finalBalance || 0)).toLocaleString('en-IN')}
                                      </div>
                                    </div>
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.status === 'closed' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {item.status === 'closed' ? 'बंद' : 'चालू'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {bulkData.length === 0 && (
                          <div className="text-center py-8 text-gray-500 border rounded-lg mb-4">
                            या आर्थिक वर्षात निवडलेल्या स्थितीचे कोणतेही कर्ज नाही
                          </div>
                        )}

                        <Button
                          onClick={handleBulkPrint}
                          disabled={bulkData.length === 0 || isBulkGenerating}
                          className="w-full h-12 text-base"
                        >
                          {isBulkGenerating ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" />प्रिंट तयार होत आहे...</>
                          ) : (
                            <><Printer className="mr-2 h-5 w-5" />सर्व प्रिंट करा ({bulkData.length} लेजर)</>
                          )}
                        </Button>
                      </>
                    )}

                    {!bulkFY && (
                      <div className="text-center py-8 text-gray-500">
                        <Layers className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>बल्क प्रिंट साठी आर्थिक वर्ष निवडा</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}