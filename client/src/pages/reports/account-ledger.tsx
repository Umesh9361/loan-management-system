import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, Search, Home, FileText, ArrowLeft, User, Wallet, CreditCard, Download } from "lucide-react";
import { exportAccountLedgerToExcel } from "@/utils/excel-export";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DateUtils } from "@/lib/date-utils";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useRealTimeSync } from "@/hooks/use-real-time-sync";
import type { Company } from "@shared/schema";

export default function AccountLedger() {
  const [, setLocation] = useLocation();
  
  // Add print CSS for vertical orientation
  useEffect(() => {
    const printStyles = `
      @media print {
        @page {
          size: A4 portrait !important;
          margin: 0.5in;
        }
        body * {
          visibility: hidden;
        }
        .print-area, .print-area * {
          visibility: visible;
        }
        .print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .no-print {
          display: none !important;
        }
        /* ✅ PROFESSIONAL PRINT: Force horizontal layout for account info */
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
      document.head.removeChild(styleElement);
    };
  }, []);
  
  const [filters, setFilters] = useState({
    accountType: '', // 'party', 'cash', 'loan', or 'individual_loan'
    partyId: '',
    loanId: '',
    borrowerId: '',
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  const [statementData, setStatementData] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  
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
            simpleDescription = `${transaction.narration} - ${relatedParty.name}`;
          } else {
            simpleDescription = transaction.narration;
          }
        } else {
          simpleDescription = transaction.narration;
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
        simpleDescription = transaction.narration || 
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
    
    setStatementData({
      account: party,
      entries,
      totalDebit: entries.reduce((sum, entry) => sum + entry.debit, 0),
      totalCredit: entries.reduce((sum, entry) => sum + entry.credit, 0),
      finalBalance: runningBalance,
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
      // LOAN DISBURSEMENT: आपण कर्जदाराला पैसे दिले (We gave money to borrower)
      // From borrower's perspective: Money came INTO their account → DEBIT (नावे)
      // Borrower owes us money, so positive balance = debit balance
      runningBalance = principalAmount;
      entries.push({
        date: safeLoanDate,
        description: `कर्ज वितरण - खाते क्र. ${safeAccountNumber}`,
        debit: principalAmount,
        credit: 0,
        balance: runningBalance,
        type: 'loan_disbursement'
      });

      // Add any payments/transactions for this specific loan
      const safeTransactions = Array.isArray(transactions) ? transactions : [];
      const loanTransactions = safeTransactions.filter((transaction: any) => 
        transaction.loanId === filters.loanId
      );

      loanTransactions.forEach((transaction: any) => {
        const amount = parseFloat(transaction.amount || 0);
        // LOAN PAYMENT: कर्जदाराने आपल्याला पैसे दिले (Borrower paid us money)
        // From borrower's perspective: Money went OUT of their account → CREDIT (जमा)
        // Balance decreases (borrower owes us less)
        runningBalance -= amount;
        entries.push({
          date: transaction.transactionDate,
          description: `${transaction.description || 'Payment'} - ${transaction.narration || ''}`,
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
        
        // Add interest payment entry first (नावे then जमा)
        if (interestAmount > 0) {
          // Interest charge - DEBIT (नावे) - borrower owes interest
          runningBalance += interestAmount;
          entries.push({
            date: closureDate,
            description: `व्याज`,
            debit: interestAmount,
            credit: 0,
            balance: runningBalance,
            type: 'interest_charge'
          });
          
          // Interest payment - CREDIT (जमा) - borrower pays interest
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
        
        // Principal repayment - CREDIT (जमा) - borrower pays principal
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

    // Skip loan disbursements from loans table to avoid format mismatch
    // All loan entries will come from cash transactions with proper format

    // Process ALL closed loans (regardless of disbursement date)
    // Only filter by closure date being in range
    const closedLoans = (loans as any[]).filter((loan: any) => {
      if (loan.status !== 'closed' || !loan.closedAt) return false;
      
      const closureDate = new Date(loan.closedAt);
      return closureDate >= fromDate && closureDate <= toDate;
    });

    // Add loan closures (including those disbursed outside date range)
    closedLoans.forEach((loan: any) => {
      const totalRepayment = parseFloat(loan.principalAmount || 0) + parseFloat(loan.interest || 0);
      if (totalRepayment > 0) {
        runningBalance -= totalRepayment;
        entries.push({
          date: loan.closedAt.split('T')[0],
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

    // Add cash transactions with correct format to avoid duplicates
    const filteredTransactions = (transactions as any[]).filter((transaction: any) => {
      const transactionDate = new Date(transaction.transactionDate);
      return transactionDate >= fromDate && transactionDate <= toDate;
    });

    // Process cash transactions but avoid duplicates with loan disbursements
    const processedLoanIds = new Set();
    
    // Track loan disbursements to avoid duplicates
    disbursedLoans.forEach(loan => processedLoanIds.add(loan.id));

    // LOAN & ADVANCE ACCOUNT: Only loan-related cash transactions 
    // When loan given: Cash Cr → Loan Dr (shows as Dr in loan account)
    // When loan closed: Cash Dr → Loan Cr (shows as Cr in loan account)
    
    // Filter cash transactions for loan operations only
    const loanRelatedTransactions = filteredTransactions.filter((transaction: any) => {
      return transaction.narration && (
        transaction.narration.includes('कर्ज वितरण') || 
        transaction.narration.includes('कर्ज बंद')
      );
    });

    // Add loan disbursement transactions (Dr entries)
    loanRelatedTransactions.forEach((transaction: any) => {
      if (transaction.narration.includes('कर्ज वितरण')) {
        const amount = parseFloat(transaction.amount || 0);
        runningBalance += amount; // Loan given = Debit increases balance
        
        entries.push({
          date: transaction.transactionDate,
          description: transaction.narration, // Same format as रोकड खाते
          debit: amount,
          credit: 0,
          balance: runningBalance,
          type: 'loan_disbursement',
          transactionId: transaction.id
        });
      }
    });

    // Add loan closure transactions (Cr entries) - Same source as रोकड खाते
    loanRelatedTransactions.forEach((transaction: any) => {
      if (transaction.narration.includes('कर्ज बंद')) {
        const amount = parseFloat(transaction.amount || 0);
        runningBalance -= amount; // Loan closed = Credit decreases balance
        
        entries.push({
          date: transaction.transactionDate,
          description: transaction.narration, // Same format as रोकड खाते
          debit: 0,
          credit: amount,
          balance: runningBalance,
          type: 'loan_closure',
          transactionId: transaction.id
        });
      }
    });

    // Sort entries by date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate totals (loan cash transactions only)
    const totalLoanDisbursements = entries.filter(e => e.type === 'loan_disbursement').reduce((sum, entry) => sum + entry.debit, 0);
    const totalLoanClosures = entries.filter(e => e.type === 'loan_closure').reduce((sum, entry) => sum + entry.credit, 0);

    const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);

    setStatementData({
      account: {
        name: 'सर्व कर्ज खाते (एकत्रित)',
        type: 'loan',
        totalLoanTransactions: loanRelatedTransactions.length,
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
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50">
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
              <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-4">
                  <Link href="/">
                    <Button variant="outline" size="sm" className="btn-primary-gradient flex items-center gap-2 text-white border-0">
                      <ArrowLeft className="h-4 w-4" />
                      मुखपृष्ठ
                    </Button>
                  </Link>
                  <h1 className="text-2xl font-bold text-foreground heading-professional font-noto">
                    खाते लेजर (सर्वप्रकार)
                  </h1>
                </div>
              </div>

              {/* Account Selection & Filters */}
              <Card className="card-professional print:hidden">
                <CardHeader>
                  <CardTitle className="flex items-center heading-professional">
                    <Search className="h-5 w-5 mr-2" />
                    खाते प्रकार आणि कालावधी निवडा
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-2">
                    सर्व प्रकारचे खाते लेजर एकाच ठिकाणी - रोकड खाते, व्यक्ती खाते, आणि कर्ज खाते
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Account Type Selection */}
                    <div>
                      <Label>खाते प्रकार निवडा</Label>
                      <Select value={filters.accountType} onValueChange={handleAccountTypeChange}>
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
                        <Label>व्यक्ती निवडा</Label>
                        <Select value={filters.partyId} onValueChange={(value) => setFilters(prev => ({ ...prev, partyId: value }))}>
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
                        <Label>कर्जदार निवडा</Label>
                        <Select 
                          value={filters.loanId} 
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
                      <Label htmlFor="dateFrom">पासून दिनांक</Label>
                      <div className="space-y-2">
                        <Input
                          id="dateFrom"
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        />

                      </div>
                    </div>

                    {/* Date To */}
                    <div>
                      <Label htmlFor="dateTo">पर्यंत दिनांक</Label>
                      <div className="space-y-2">
                        <Input
                          id="dateTo"
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        />

                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between mt-4">
                    <Button onClick={generateStatement} className="btn-primary-gradient text-white">
                      <Search className="h-4 w-4 mr-2" />
                      लेजर तयार करा
                    </Button>
                    {statementData && (
                      <div className="flex gap-2">
                        <Button onClick={handlePrint} variant="outline">
                          <Printer className="h-4 w-4 mr-2" />
                          प्रिंट करा
                        </Button>
                        
                        <Button onClick={handleExcelExport} variant="outline" className="bg-green-50 hover:bg-green-100 border-green-300">
                          <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm2 2h8v12H6V4z"/>
                          </svg>
                          Excel एक्सपोर्ट
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Statement Display */}
              {statementData && (
                <Card className="ledger-card print-area">
                  <CardContent className="p-6">
                    {/* Statement Header */}
                    <div className="ledger-header space-y-2">
                      <h2 className="text-xl font-bold print:hidden">{company?.name || 'कंपनी नाव'}</h2>
                      <p className="text-sm text-gray-600 print:hidden">{company?.address}</p>
                      <h3 className="text-lg font-semibold mt-4">
                        {statementData.account.type === 'individual_loan' 
                          ? statementData.account.formattedType || 'नमुना क्रमांक आठ (नियम 18 पहा)'
                          : 'खाते लेजर'
                        }
                      </h3>
                      <div className="text-sm text-gray-600 text-left">
                        {/* ✅ PROFESSIONAL PRINT: Account info in horizontal layout for print only */}
                        <div className="print-hidden flex flex-col gap-1">
                          <p><strong>खाते:</strong> {statementData.account.borrowerName || statementData.account.name}</p>
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
                            <p><strong>खाते:</strong> {statementData.account.borrowerName || statementData.account.name}</p>
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
                          <div className="mt-2 p-2 bg-blue-50 rounded">
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
                      <Table className="ledger-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="border text-center">दिनांक</TableHead>
                            <TableHead className="border text-center">तपशील</TableHead>
                            <TableHead className="border text-center">नावे (Dr.)</TableHead>
                            <TableHead className="border text-center">जमा (Cr.)</TableHead>
                            <TableHead className="border text-center">शिल्लक</TableHead>
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
                                  const bal = entry.balance;
                                  const drLabel = isCashAccount
                                    ? (bal >= 0 ? ' (Cr.)' : ' (Dr.)')
                                    : (bal >= 0 ? ' (Dr.)' : ' (Cr.)');
                                  const isNeg = isCashAccount ? bal < 0 : bal < 0;
                                  return (
                                    <span className={isNeg ? 'text-red-600 font-semibold' : ''}>
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
                                const bal = parseFloat(statementData.finalBalance || 0);
                                const drLabel = isCashAccount
                                  ? (bal >= 0 ? ' (Cr.)' : ' (Dr.)')
                                  : (bal >= 0 ? ' (Dr.)' : ' (Cr.)');
                                return (
                                  <span className={bal < 0 ? 'text-red-600 font-bold' : 'font-bold'}>
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
                              <span className="text-blue-600">एकूण नावे: ₹{Math.round(statementData.totals.totalDebit).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-green-600">एकूण जमा: ₹{Math.round(statementData.totals.totalCredit).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-right">
                              {(() => {
                                const isCashAccount = statementData.account?.type === 'cash';
                                const bal = statementData.finalBalance;
                                const drLabel = isCashAccount
                                  ? (bal >= 0 ? ' (Cr.)' : ' (Dr.)')
                                  : (bal >= 0 ? ' (Dr.)' : ' (Cr.)');
                                const colorClass = isCashAccount
                                  ? (bal >= 0 ? 'text-green-600' : 'text-red-600')
                                  : (bal >= 0 ? 'text-blue-600' : 'text-red-600');
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
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}