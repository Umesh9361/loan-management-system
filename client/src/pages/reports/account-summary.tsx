import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Search, Printer, Calendar, Download, Users, User, Trophy, BarChart3, TrendingUp, ChevronDown, ArrowUp } from "lucide-react";
import { exportAccountSummaryToExcel } from "@/utils/excel-export";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { DateUtils } from "@/lib/date-utils";

interface SummaryRow {
  name: string;
  totalLoans: number;
  activeLoans: number;
  closedLoans: number;
  totalWeight: number;
  totalFineWeight: number;
  goldWeight: number;
  goldFineWeight: number;
  silverWeight: number;
  silverFineWeight: number;
  totalAmount: number;
  closedAmount: number;
  activeBalance: number;
  totalInterest: number;
  score?: number;
}

export default function AccountSummaryReport() {
  const [activeTab, setActiveTab] = useState<"group" | "customer">("group");
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const [customerFromDate, setCustomerFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerToDate, setCustomerToDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerMode, setCustomerMode] = useState<"specific" | "top50">("specific");
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const customerSuggestionsRef = useRef<HTMLDivElement>(null);

  const { data: customerAutocompleteSuggestions = [] } = useQuery<any[]>({
    queryKey: ["/api/borrowers/autocomplete", customerSearchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/borrowers/autocomplete?search=${encodeURIComponent(customerSearchTerm)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch borrower suggestions');
      return res.json();
    },
    enabled: customerSearchTerm.length >= 2,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerSuggestionsRef.current &&
        !customerSuggestionsRef.current.contains(event.target as Node) &&
        customerInputRef.current &&
        !customerInputRef.current.contains(event.target as Node)
      ) {
        setShowCustomerSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCustomerSelect = (name: string) => {
    setSelectedCustomerName(name);
    setCustomerSearchTerm(name);
    setShowCustomerSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  const handleCustomerKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showCustomerSuggestions || customerAutocompleteSuggestions.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < customerAutocompleteSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : customerAutocompleteSuggestions.length - 1
      );
    } else if (e.key === "Enter" && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      const selected = customerAutocompleteSuggestions[selectedSuggestionIndex];
      handleCustomerSelect(selected.borrowerName || selected.name);
    } else if (e.key === "Escape") {
      setShowCustomerSuggestions(false);
    }
  };

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
          padding-left: 25mm !important;
          box-sizing: border-box !important;
        }
        body {
          font-family: 'Noto Sans Devanagari', Arial, sans-serif !important;
          font-size: 11px;
          line-height: 1.3;
        }
        .no-print {
          display: none !important;
        }
        .overflow-x-auto {
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
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
    
    const printContentDiv = document.querySelector('.print-content') as HTMLElement;
    if (printContentDiv) {
      printContentDiv.style.display = 'block';
      printContentDiv.style.visibility = 'visible';
    }
    
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
        document.head.removeChild(styleSheet);
      }, 1000);
    }, 100);
  };

  const groupSummaries: SummaryRow[] = (groups as any[]).map((group: any) => {
    const allGroupLoans = (loans as any[]).filter((loan: any) => loan.groupId === group.id);
    
    const periodLoans = allGroupLoans.filter((loan: any) => {
      const loanDate = new Date(loan.loanDate);
      return loanDate >= new Date(fromDate) && loanDate <= new Date(toDate);
    });

    const periodClosures = (loanClosures as any[]).filter((closure: any) => {
      const closureDate = new Date(closure.closureDate);
      return closureDate >= new Date(fromDate) && 
             closureDate <= new Date(toDate) &&
             allGroupLoans.some((loan: any) => loan.id === closure.loanId);
    });

    const totalLoansInPeriod = periodLoans.length;
    const closedLoansInPeriod = periodClosures.length;
    const activeLoansInPeriod = totalLoansInPeriod - closedLoansInPeriod;

    const totalAmountDisbursed = periodLoans.reduce((sum: number, loan: any) => 
      sum + parseFloat(loan.principalAmount || 0), 0);
    
    const closedAmount = periodClosures.reduce((sum: number, closure: any) => {
      return sum + parseFloat(closure.principalPaid || closure.principalAmount || 0);
    }, 0);
    
    const activeBalance = totalAmountDisbursed - closedAmount;

    const totalInterestInPeriod = periodClosures.reduce((sum: number, closure: any) => {
      return sum + parseFloat(closure.calculatedInterest || closure.interestAmount || 0);
    }, 0);

    const totalWeight = periodLoans.reduce((sum: number, loan: any) => 
      sum + (parseFloat(String(loan.weight || '0').replace(/[^\d.]/g, '')) || 0), 0);
    const totalFineWeight = periodLoans.reduce((sum: number, loan: any) => {
      const wt = parseFloat(String(loan.weight || '0').replace(/[^\d.]/g, '')) || 0;
      const pu = parseFloat(String(loan.purity || '82')) || 82;
      return sum + (wt * pu / 100);
    }, 0);

    const goldLoans = periodLoans.filter((l: any) => l.metalType !== 'silver' && l.loanType !== 'विनातारण');
    const silverLoans = periodLoans.filter((l: any) => l.metalType === 'silver');
    const goldWeight = goldLoans.reduce((s: number, l: any) => s + (parseFloat(String(l.weight || '0').replace(/[^\d.]/g, '')) || 0), 0);
    const goldFineWeight = goldLoans.reduce((s: number, l: any) => { const w = parseFloat(String(l.weight || '0').replace(/[^\d.]/g, '')) || 0; const p = parseFloat(String(l.purity || '82')) || 82; return s + (w * p / 100); }, 0);
    const silverWeight = silverLoans.reduce((s: number, l: any) => s + (parseFloat(String(l.weight || '0').replace(/[^\d.]/g, '')) || 0), 0);
    const silverFineWeight = silverLoans.reduce((s: number, l: any) => { const w = parseFloat(String(l.weight || '0').replace(/[^\d.]/g, '')) || 0; const p = parseFloat(String(l.purity || '82')) || 82; return s + (w * p / 100); }, 0);

    return {
      name: group.name,
      totalLoans: totalLoansInPeriod,
      activeLoans: activeLoansInPeriod,
      closedLoans: closedLoansInPeriod,
      totalWeight,
      totalFineWeight,
      goldWeight,
      goldFineWeight,
      silverWeight,
      silverFineWeight,
      totalAmount: totalAmountDisbursed,
      closedAmount,
      activeBalance,
      totalInterest: totalInterestInPeriod
    };
  }).filter(summary => summary.totalLoans > 0);

  const buildCustomerSummary = (customerName: string, fDate: string, tDate: string): SummaryRow => {
    const normalizedName = customerName.trim().toLowerCase();
    const customerLoans = (loans as any[]).filter((loan: any) => 
      (loan.borrowerName || '').trim().toLowerCase() === normalizedName
    );

    const periodLoans = customerLoans.filter((loan: any) => {
      const loanDate = new Date(loan.loanDate);
      return loanDate >= new Date(fDate) && loanDate <= new Date(tDate);
    });

    const periodClosures = (loanClosures as any[]).filter((closure: any) => {
      const closureDate = new Date(closure.closureDate);
      return closureDate >= new Date(fDate) && 
             closureDate <= new Date(tDate) &&
             customerLoans.some((loan: any) => loan.id === closure.loanId);
    });

    const totalLoansCount = periodLoans.length;
    const closedLoansCount = periodClosures.length;
    const activeLoansCount = totalLoansCount - closedLoansCount;

    const totalAmount = periodLoans.reduce((sum: number, loan: any) => 
      sum + parseFloat(loan.principalAmount || 0), 0);

    const closedAmount = periodClosures.reduce((sum: number, closure: any) => 
      sum + parseFloat(closure.principalPaid || closure.principalAmount || 0), 0);

    const activeBalance = totalAmount - closedAmount;

    const totalInterest = periodClosures.reduce((sum: number, closure: any) => 
      sum + parseFloat(closure.calculatedInterest || closure.interestAmount || 0), 0);

    const totalWeight = periodLoans.reduce((sum: number, loan: any) => 
      sum + (parseFloat(String(loan.weight || '0').replace(/[^\d.]/g, '')) || 0), 0);
    const totalFineWeight = periodLoans.reduce((sum: number, loan: any) => {
      const wt = parseFloat(String(loan.weight || '0').replace(/[^\d.]/g, '')) || 0;
      const pu = parseFloat(String(loan.purity || '82')) || 82;
      return sum + (wt * pu / 100);
    }, 0);

    const goldLoans = periodLoans.filter((l: any) => l.metalType !== 'silver' && l.loanType !== 'विनातारण');
    const silverLoans = periodLoans.filter((l: any) => l.metalType === 'silver');
    const goldWeight = goldLoans.reduce((s: number, l: any) => s + (parseFloat(String(l.weight || '0').replace(/[^\d.]/g, '')) || 0), 0);
    const goldFineWeight = goldLoans.reduce((s: number, l: any) => { const w = parseFloat(String(l.weight || '0').replace(/[^\d.]/g, '')) || 0; const p = parseFloat(String(l.purity || '82')) || 82; return s + (w * p / 100); }, 0);
    const silverWeight = silverLoans.reduce((s: number, l: any) => s + (parseFloat(String(l.weight || '0').replace(/[^\d.]/g, '')) || 0), 0);
    const silverFineWeight = silverLoans.reduce((s: number, l: any) => { const w = parseFloat(String(l.weight || '0').replace(/[^\d.]/g, '')) || 0; const p = parseFloat(String(l.purity || '82')) || 82; return s + (w * p / 100); }, 0);

    return {
      name: customerName,
      totalLoans: totalLoansCount,
      activeLoans: activeLoansCount,
      closedLoans: closedLoansCount,
      totalWeight,
      totalFineWeight,
      goldWeight,
      goldFineWeight,
      silverWeight,
      silverFineWeight,
      totalAmount,
      closedAmount,
      activeBalance,
      totalInterest,
    };
  };

  const specificCustomerSummary: SummaryRow[] = (() => {
    if (!selectedCustomerName || customerMode !== "specific") return [];
    const summary = buildCustomerSummary(selectedCustomerName, customerFromDate, customerToDate);
    return summary.totalLoans > 0 ? [summary] : [];
  })();

  const top50Customers: SummaryRow[] = (() => {
    if (customerMode !== "top50") return [];

    const borrowerNames = new Set<string>();
    (loans as any[]).forEach((loan: any) => {
      if (loan.borrowerName) {
        borrowerNames.add(loan.borrowerName.trim());
      }
    });

    const allSummaries: SummaryRow[] = [];
    borrowerNames.forEach(name => {
      const summary = buildCustomerSummary(name, customerFromDate, customerToDate);
      if (summary.totalLoans > 0) {
        allSummaries.push(summary);
      }
    });

    if (allSummaries.length === 0) return [];

    let maxTransactions = 1, maxTurnover = 1, maxInterest = 1;
    allSummaries.forEach(s => {
      const transactions = s.totalLoans + s.closedLoans;
      const turnover = s.totalAmount + s.closedAmount;
      if (transactions > maxTransactions) maxTransactions = transactions;
      if (turnover > maxTurnover) maxTurnover = turnover;
      if (s.totalInterest > maxInterest) maxInterest = s.totalInterest;
    });

    allSummaries.forEach(s => {
      const totalTransactions = s.totalLoans + s.closedLoans;
      const turnoverVolume = s.totalAmount + s.closedAmount;

      const transactionScore = (totalTransactions / maxTransactions) * 40;
      const turnoverScore = (turnoverVolume / maxTurnover) * 30;
      const interestScore = (s.totalInterest / maxInterest) * 20;
      const closureRatioScore = s.totalLoans > 0 ? (s.closedLoans / s.totalLoans) * 10 : 0;

      s.score = transactionScore + turnoverScore + interestScore + closureRatioScore;
    });

    allSummaries.sort((a, b) => (b.score || 0) - (a.score || 0));
    return allSummaries.slice(0, 50);
  })();

  const customerSummaries = customerMode === "specific" ? specificCustomerSummary : top50Customers;

  const calcGrandTotals = (rows: SummaryRow[]) => rows.reduce(
    (totals, row) => ({
      totalLoans: totals.totalLoans + row.totalLoans,
      activeLoans: totals.activeLoans + row.activeLoans,
      closedLoans: totals.closedLoans + row.closedLoans,
      totalWeight: totals.totalWeight + row.totalWeight,
      totalFineWeight: totals.totalFineWeight + row.totalFineWeight,
      goldWeight: totals.goldWeight + (row.goldWeight || 0),
      goldFineWeight: totals.goldFineWeight + (row.goldFineWeight || 0),
      silverWeight: totals.silverWeight + (row.silverWeight || 0),
      silverFineWeight: totals.silverFineWeight + (row.silverFineWeight || 0),
      totalAmount: totals.totalAmount + row.totalAmount,
      closedAmount: totals.closedAmount + row.closedAmount,
      activeBalance: totals.activeBalance + row.activeBalance,
      totalInterest: totals.totalInterest + row.totalInterest,
    }),
    { totalLoans: 0, activeLoans: 0, closedLoans: 0, totalWeight: 0, totalFineWeight: 0, goldWeight: 0, goldFineWeight: 0, silverWeight: 0, silverFineWeight: 0, totalAmount: 0, closedAmount: 0, activeBalance: 0, totalInterest: 0 }
  );

  const groupGrandTotals = calcGrandTotals(groupSummaries);
  const customerGrandTotals = calcGrandTotals(customerSummaries);

  const handleExcelExport = (data: SummaryRow[], label: string) => {
    try {
      if (data.length === 0) {
        alert('एक्सपोर्ट करण्यासाठी डेटा नाही');
        return;
      }
      const cleanReportData = data.map((row, index) => ({
        serialNo: index + 1,
        accountName: row.name,
        groupName: row.name,
        totalLoans: row.totalLoans,
        activeLoans: row.activeLoans,
        closedLoans: row.closedLoans,
        totalAmount: row.totalAmount,
        closedAmount: row.closedAmount,
        activeBalance: row.activeBalance,
        totalInterest: row.totalInterest
      }));

      const success = exportAccountSummaryToExcel(cleanReportData);
      if (success) {
        alert(`${label} यशस्वीरित्या एक्सेल फाइलमध्ये एक्सपोर्ट झाला!`);
      } else {
        alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
      }
    } catch (error) {
      console.error('Excel export error:', error);
      alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
    }
  };

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

  const renderSummaryTable = (data: SummaryRow[], grandTotals: ReturnType<typeof calcGrandTotals>, nameLabel: string, showRank?: boolean) => (
    <>
      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full border-collapse border border-black text-sm md:text-base">
          <thead>
            <tr>
              {showRank && (
                <th rowSpan={2} className="border border-black p-2 md:p-3 bg-gray-100 text-center font-bold w-12">#</th>
              )}
              <th rowSpan={2} className="border border-black p-2 md:p-3 bg-gray-100 text-left font-bold w-1/5">
                {nameLabel}
              </th>
              <th colSpan={3} className="border border-black p-2 md:p-3 bg-gray-100 text-center font-bold">
                कर्ज वाटप
              </th>
              <th rowSpan={2} className="border border-black p-2 md:p-3 bg-gray-100 text-center font-bold">
                एकूण वाटप (₹)
              </th>
              <th rowSpan={2} className="border border-black p-2 md:p-3 bg-gray-100 text-center font-bold">
                बंद रक्कम (₹)
              </th>
              <th rowSpan={2} className="border border-black p-2 md:p-3 bg-gray-100 text-center font-bold">
                सक्रिय शिल्लक (₹)
              </th>
              <th rowSpan={2} className="border border-black p-2 md:p-3 bg-gray-100 text-center font-bold">
                एकूण व्याज (₹)
              </th>
            </tr>
            <tr>
              <th className="border border-black p-2 md:p-3 bg-gray-100 text-center font-bold">एकूण</th>
              <th className="border border-black p-2 md:p-3 bg-gray-100 text-center font-bold">सक्रिय</th>
              <th className="border border-black p-2 md:p-3 bg-gray-100 text-center font-bold">बंद</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {showRank && (
                  <td className="border border-black p-2 md:p-3 text-center font-semibold text-indigo-600">{index + 1}</td>
                )}
                <td className="border border-black p-2 md:p-3 text-left font-semibold">{row.name}</td>
                <td className="border border-black p-2 md:p-3 text-center">{row.totalLoans}</td>
                <td className="border border-black p-2 md:p-3 text-center">{row.activeLoans}</td>
                <td className="border border-black p-2 md:p-3 text-center">{row.closedLoans}</td>
                <td className="border border-black p-2 md:p-3 text-right">{formatCurrency(row.totalAmount).replace('₹', '')}</td>
                <td className="border border-black p-2 md:p-3 text-right">{formatCurrency(row.closedAmount).replace('₹', '')}</td>
                <td className="border border-black p-2 md:p-3 text-right">{formatCurrency(row.activeBalance).replace('₹', '')}</td>
                <td className="border border-black p-2 md:p-3 text-right">{formatCurrency(row.totalInterest).replace('₹', '')}</td>
              </tr>
            ))}
            <tr className="bg-indigo-100 border-t-2 border-black font-bold">
              {showRank && (
                <td className="border border-black p-2 md:p-3 text-center font-bold">-</td>
              )}
              <td className="border border-black p-2 md:p-3 text-left font-bold">एकूण योग</td>
              <td className="border border-black p-2 md:p-3 text-center font-bold">{grandTotals.totalLoans}</td>
              <td className="border border-black p-2 md:p-3 text-center font-bold">{grandTotals.activeLoans}</td>
              <td className="border border-black p-2 md:p-3 text-center font-bold">{grandTotals.closedLoans}</td>
              <td className="border border-black p-2 md:p-3 text-right font-bold">{formatCurrency(grandTotals.totalAmount).replace('₹', '')}</td>
              <td className="border border-black p-2 md:p-3 text-right font-bold">{formatCurrency(grandTotals.closedAmount).replace('₹', '')}</td>
              <td className="border border-black p-2 md:p-3 text-right font-bold">{formatCurrency(grandTotals.activeBalance).replace('₹', '')}</td>
              <td className="border border-black p-2 md:p-3 text-right font-bold">{formatCurrency(grandTotals.totalInterest).replace('₹', '')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden divide-y divide-gray-100">
        {data.map((row, index) => (
          <div key={index} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                {showRank && (
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">#{index + 1}</span>
                )}
                <span className="font-semibold text-gray-900">{row.name}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs mb-2">
              <div className="bg-blue-50 rounded p-1.5 text-center">
                <div className="text-blue-600">एकूण</div>
                <div className="font-bold text-blue-800">{row.totalLoans}</div>
              </div>
              <div className="bg-green-50 rounded p-1.5 text-center">
                <div className="text-green-600">सक्रिय</div>
                <div className="font-bold text-green-800">{row.activeLoans}</div>
              </div>
              <div className="bg-red-50 rounded p-1.5 text-center">
                <div className="text-red-600">बंद</div>
                <div className="font-bold text-red-800">{row.closedLoans}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs mb-2">
              <div className="bg-amber-50 rounded p-1.5 text-center">
                <div className="text-amber-600">सोने वजन</div>
                <div className="font-bold text-amber-800">{(row.goldWeight || 0).toFixed(2)} ग्रॅ</div>
                {(row.silverWeight || 0) > 0 && (
                  <>
                    <div className="text-gray-500 mt-0.5">चांदी</div>
                    <div className="font-bold text-gray-700">{row.silverWeight.toFixed(2)} ग्रॅ</div>
                  </>
                )}
              </div>
              <div className="bg-yellow-50 rounded p-1.5 text-center">
                <div className="text-yellow-600">सोने शुद्ध</div>
                <div className="font-bold text-yellow-800">{(row.goldFineWeight || 0).toFixed(2)} ग्रॅ</div>
                {(row.silverFineWeight || 0) > 0 && (
                  <>
                    <div className="text-gray-500 mt-0.5">चांदी शुद्ध</div>
                    <div className="font-bold text-gray-700">{row.silverFineWeight.toFixed(2)} ग्रॅ</div>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-gray-500 text-xs">एकूण वाटप</div>
                <div className="font-semibold">{formatCurrency(row.totalAmount)}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">बंद रक्कम</div>
                <div className="font-semibold">{formatCurrency(row.closedAmount)}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">सक्रिय शिल्लक</div>
                <div className="font-semibold">{formatCurrency(row.activeBalance)}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">एकूण व्याज</div>
                <div className="font-semibold">{formatCurrency(row.totalInterest)}</div>
              </div>
            </div>
          </div>
        ))}

        {/* Mobile Totals */}
        <div className="p-4 bg-indigo-50">
          <div className="font-bold text-indigo-900 mb-2">एकूण योग</div>
          <div className="grid grid-cols-3 gap-1 text-xs mb-2">
            <div className="bg-blue-100 rounded p-1.5 text-center">
              <div className="text-blue-700">एकूण कर्जे</div>
              <div className="font-bold text-blue-900">{grandTotals.totalLoans}</div>
            </div>
            <div className="bg-green-100 rounded p-1.5 text-center">
              <div className="text-green-700">सक्रिय</div>
              <div className="font-bold text-green-900">{grandTotals.activeLoans}</div>
            </div>
            <div className="bg-red-100 rounded p-1.5 text-center">
              <div className="text-red-700">बंद</div>
              <div className="font-bold text-red-900">{grandTotals.closedLoans}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs mb-2">
            <div className="bg-amber-100 rounded p-1.5 text-center">
              <div className="text-amber-700">सोने वजन</div>
              <div className="font-bold text-amber-900">{(grandTotals.goldWeight || 0).toFixed(2)} ग्रॅ</div>
              {(grandTotals.silverWeight || 0) > 0 && (
                <>
                  <div className="text-gray-600 mt-0.5">चांदी</div>
                  <div className="font-bold text-gray-800">{grandTotals.silverWeight.toFixed(2)} ग्रॅ</div>
                </>
              )}
            </div>
            <div className="bg-yellow-100 rounded p-1.5 text-center">
              <div className="text-yellow-700">सोने शुद्ध</div>
              <div className="font-bold text-yellow-900">{(grandTotals.goldFineWeight || 0).toFixed(2)} ग्रॅ</div>
              {(grandTotals.silverFineWeight || 0) > 0 && (
                <>
                  <div className="text-gray-600 mt-0.5">चांदी शुद्ध</div>
                  <div className="font-bold text-gray-800">{grandTotals.silverFineWeight.toFixed(2)} ग्रॅ</div>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-indigo-600 text-xs">एकूण वाटप</div>
              <div className="font-bold text-indigo-900">{formatCurrency(grandTotals.totalAmount)}</div>
            </div>
            <div>
              <div className="text-indigo-600 text-xs">बंद रक्कम</div>
              <div className="font-bold text-indigo-900">{formatCurrency(grandTotals.closedAmount)}</div>
            </div>
            <div>
              <div className="text-indigo-600 text-xs">सक्रिय शिल्लक</div>
              <div className="font-bold text-indigo-900">{formatCurrency(grandTotals.activeBalance)}</div>
            </div>
            <div>
              <div className="text-indigo-600 text-xs">एकूण व्याज</div>
              <div className="font-bold text-indigo-900">{formatCurrency(grandTotals.totalInterest)}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderPrintTable = (data: SummaryRow[], grandTotals: ReturnType<typeof calcGrandTotals>, nameLabel: string, showRank?: boolean) => (
    <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {showRank && (
            <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>#</th>
          )}
          <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>{nameLabel}</th>
          <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>एकूण कर्ज</th>
          <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>सक्रिय</th>
          <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>बंद</th>
          <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>एकूण वाटप</th>
          <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>बंद रक्कम</th>
          <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>सक्रिय शिल्लक</th>
          <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>एकूण व्याज</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index}>
            {showRank && (
              <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>{index + 1}</td>
            )}
            <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'left', fontSize: '13px' }}>{row.name}</td>
            <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px' }}>{row.totalLoans}</td>
            <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px' }}>{row.activeLoans}</td>
            <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px' }}>{row.closedLoans}</td>
            <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px' }}>₹{row.totalAmount.toLocaleString('en-IN')}</td>
            <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px' }}>₹{row.closedAmount.toLocaleString('en-IN')}</td>
            <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px' }}>₹{row.activeBalance.toLocaleString('en-IN')}</td>
            <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px' }}>₹{row.totalInterest.toLocaleString('en-IN')}</td>
          </tr>
        ))}
        <tr className="total-row">
          {showRank && (
            <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>-</td>
          )}
          <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'left', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>एकूण योग</td>
          <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>{grandTotals.totalLoans}</td>
          <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>{grandTotals.activeLoans}</td>
          <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>{grandTotals.closedLoans}</td>
          <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>₹{grandTotals.totalAmount.toLocaleString('en-IN')}</td>
          <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>₹{grandTotals.closedAmount.toLocaleString('en-IN')}</td>
          <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>₹{grandTotals.activeBalance.toLocaleString('en-IN')}</td>
          <td className="amount-col" style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>₹{grandTotals.totalInterest.toLocaleString('en-IN')}</td>
        </tr>
      </tbody>
    </table>
  );

  const currentPrintData = activeTab === "group" ? groupSummaries : customerSummaries;
  const currentPrintTotals = activeTab === "group" ? groupGrandTotals : customerGrandTotals;
  const currentPrintLabel = activeTab === "group" ? "गटाचे नाव" : "कस्टमर नाव";
  const currentPrintTitle = activeTab === "group" 
    ? "गटनिहाय खाते सारांश अहवाल" 
    : (customerMode === "specific" ? `कस्टमर सारांश - ${selectedCustomerName}` : "टॉप ५० कस्टमर सारांश अहवाल");

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            
            {/* Print Content */}
            <div className="print-content" style={{ display: 'none' }}>
              <div className="summary-header">
                <h1 style={{ fontSize: '20px', marginBottom: '4px' }}>{(company as any)?.name || "गजलक्ष्मी फायनान्स"}</h1>
                <h2 style={{ fontSize: '16px', marginBottom: '4px' }}>{currentPrintTitle}</h2>
                <p style={{ fontSize: '13px', marginBottom: '20px' }}>
                  कालावधी: {new Date(activeTab === "group" ? fromDate : customerFromDate).toLocaleDateString('en-GB')} ते {new Date(activeTab === "group" ? toDate : customerToDate).toLocaleDateString('en-GB')}
                </p>
              </div>
              
              {currentPrintData.length > 0 ? (
                renderPrintTable(currentPrintData, currentPrintTotals, currentPrintLabel, activeTab === "customer" && customerMode === "top50")
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', fontSize: '16px' }}>
                  निवडलेल्या तारखेच्या कालावधीत कोणतेही व्यवहार नाहीत
                </div>
              )}

              {currentPrintData.length > 0 && (
                <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                  <p>अहवाल तयार केल्याची तारीख: {new Date().toLocaleDateString('en-GB')}</p>
                </div>
              )}
            </div>

            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">खाते सारांश अहवाल</h1>
              <p className="text-gray-600">गटनिहाय व कस्टमरनिहाय कर्ज वाटप सारांश</p>
            </div>

            {/* Tab Switcher */}
            <div className="flex mb-4 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
              <button
                onClick={() => setActiveTab("group")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-sm font-medium transition-all ${
                  activeTab === "group"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Users className="h-4 w-4" />
                गट प्रमाणे
              </button>
              <button
                onClick={() => setActiveTab("customer")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-sm font-medium transition-all ${
                  activeTab === "customer"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <User className="h-4 w-4" />
                कस्टमर नावाप्रमाणे
              </button>
            </div>

            {/* ==================== गट प्रमाणे TAB ==================== */}
            {activeTab === "group" && (
              <>
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      गट प्रमाणे सारांश
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="fromDate">सुरुवातीची तारीख</Label>
                        <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="font-inter" />
                      </div>
                      <div>
                        <Label htmlFor="toDate">शेवटची तारीख</Label>
                        <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="font-inter" />
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={handlePrint} className="flex items-center gap-2 no-print">
                        <Printer className="h-4 w-4" />
                        प्रिंट करा
                      </Button>
                      <Button onClick={() => handleExcelExport(groupSummaries, 'गट सारांश')} variant="outline" className="bg-green-50 hover:bg-green-100 border-green-300 no-print hidden sm:flex">
                        <Download className="mr-2 h-4 w-4" />
                        Excel एक्सपोर्ट
                      </Button>
                      {groupSummaries.length > 0 && (
                        <Button
                          variant="outline"
                          size="default"
                          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-1.5 no-print"
                          onClick={() => document.getElementById('group-performance-section')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                          <BarChart3 className="h-4 w-4" />
                          परफॉर्मन्स विश्लेषण पहा
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  {groupSummaries.length > 0 ? (
                    renderSummaryTable(groupSummaries, groupGrandTotals, "गट नाव")
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-lg font-medium">निवडलेल्या कालावधीत कोणतेही व्यवहार नाहीत</p>
                      <p className="text-sm mt-1">कृपया तारीख कालावधी तपासा</p>
                    </div>
                  )}
                </div>

                {/* ==================== गट परफॉर्मन्स विश्लेषण ==================== */}
                {groupSummaries.length > 0 && (() => {
                  const maxActiveLoans = Math.max(...groupSummaries.map(g => g.activeLoans), 1);
                  const maxTurnover = Math.max(...groupSummaries.map(g => g.totalAmount + g.closedAmount), 1);
                  const maxLoanCount = Math.max(...groupSummaries.map(g => g.totalLoans), 1);

                  const rankedGroups = [...groupSummaries]
                    .map(g => {
                      const recoveryRate = g.totalAmount > 0 ? Math.min(100, (g.closedAmount / g.totalAmount) * 100) : 0;
                      const activeScore = (g.activeLoans / maxActiveLoans) * 35;
                      const recoveryScore = (recoveryRate / 100) * 30;
                      const turnoverScore = ((g.totalAmount + g.closedAmount) / maxTurnover) * 20;
                      const loanCountScore = (g.totalLoans / maxLoanCount) * 15;
                      let smartScore = activeScore + recoveryScore + turnoverScore + loanCountScore;
                      if (g.activeLoans === 0) {
                        smartScore = smartScore * 0.4;
                      }
                      return { ...g, recoveryRate, smartScore, isInactive: g.activeLoans === 0 };
                    })
                    .sort((a, b) => b.smartScore - a.smartScore);

                  const maxAmount = Math.max(...groupSummaries.map(g => g.totalAmount), 1);

                  return (
                    <div id="group-performance-section" className="mt-6 space-y-5 no-print">

                      {/* KPI Summary Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="text-xs text-gray-500 mb-1">एकूण वाटप</div>
                          <div className="text-base sm:text-lg font-bold text-gray-900">{formatCurrency(groupGrandTotals.totalAmount)}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{groupGrandTotals.totalLoans} कर्जे</div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="text-xs text-gray-500 mb-1">वसुली (बंद)</div>
                          <div className="text-base sm:text-lg font-bold text-green-700">{formatCurrency(groupGrandTotals.closedAmount)}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{groupGrandTotals.closedLoans} बंद कर्जे</div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="text-xs text-gray-500 mb-1">बाकी रक्कम</div>
                          <div className="text-base sm:text-lg font-bold text-red-600">{formatCurrency(Math.max(0, groupGrandTotals.activeBalance))}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{groupGrandTotals.activeLoans} सक्रिय कर्जे</div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="text-xs text-gray-500 mb-1">व्याज उत्पन्न</div>
                          <div className="text-base sm:text-lg font-bold text-amber-700">{formatCurrency(groupGrandTotals.totalInterest)}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            वसुली दर: {groupGrandTotals.totalAmount > 0 ? Math.round(Math.min(100, (groupGrandTotals.closedAmount / groupGrandTotals.totalAmount) * 100)) : 0}%
                          </div>
                        </div>
                      </div>

                      {/* गटनिहाय वाटप vs वसुली तुलना */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-indigo-600" />
                            गटनिहाय वाटप व वसुली तुलना
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {[...groupSummaries].sort((a, b) => b.totalAmount - a.totalAmount).map((row, index) => {
                              const safeBase = Math.max(row.totalAmount, row.closedAmount, 1);
                              const barBase = Math.max(...groupSummaries.map(g => Math.max(g.totalAmount, g.closedAmount)), 1);
                              const totalWidthPct = (safeBase / barBase) * 100;
                              const recoveredWidthPct = Math.min(totalWidthPct, (row.closedAmount / barBase) * 100);
                              const recoveryPct = safeBase > 0 ? Math.min(100, (row.closedAmount / safeBase) * 100) : 0;
                              return (
                                <div key={index}>
                                  <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[45%]">{row.name}</span>
                                    <div className="flex items-center gap-3 text-xs">
                                      <span className="text-gray-600">वाटप: <span className="font-semibold text-gray-900">{formatCurrency(row.totalAmount)}</span></span>
                                      <span className="text-gray-400">|</span>
                                      <span className="text-gray-600">वसुली: <span className="font-semibold text-green-700">{formatCurrency(row.closedAmount)}</span></span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 relative h-5 bg-gray-100 rounded overflow-hidden">
                                      <div
                                        className="absolute inset-y-0 left-0 bg-indigo-100 rounded"
                                        style={{ width: `${Math.max(totalWidthPct, 1)}%`, transition: 'width 0.6s ease-out' }}
                                      />
                                      <div
                                        className="absolute inset-y-0 left-0 bg-indigo-500 rounded"
                                        style={{ width: `${Math.max(recoveredWidthPct, 0)}%`, transition: 'width 0.6s ease-out' }}
                                      />
                                    </div>
                                    <span className={`text-xs font-bold w-10 text-right ${
                                      recoveryPct >= 70 ? 'text-green-600' : recoveryPct >= 40 ? 'text-amber-600' : 'text-red-600'
                                    }`}>
                                      {Math.round(recoveryPct)}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                            <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200" />
                              एकूण वाटप
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded bg-indigo-500" />
                              वसुली रक्कम
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-green-600">%</span>
                              वसुली दर
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* गट परफॉर्मन्स रँकिंग (Smart Score) */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-indigo-600" />
                            गट परफॉर्मन्स रँकिंग
                          </CardTitle>
                          <p className="text-xs text-gray-500 mt-1">
                            सक्रिय कर्जे (३५%) + वसुली दर (३०%) + एकूण उलाढाल (२०%) + कर्ज संख्या (१५%)
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {rankedGroups.map((row, index) => {
                              const maxScore = rankedGroups[0]?.smartScore || 1;
                              const barWidth = (row.smartScore / maxScore) * 100;
                              return (
                                <div key={index}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-bold w-5 text-right ${
                                      index === 0 ? 'text-indigo-600' : 'text-gray-400'
                                    }`}>{index + 1}</span>
                                    <span className="text-sm font-medium text-gray-800 truncate flex-1">{row.name}</span>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      {row.isInactive ? (
                                        <span className="text-red-400 font-medium">निष्क्रिय</span>
                                      ) : (
                                        <span title="सक्रिय कर्जे" className="text-indigo-600">{row.activeLoans} सक्रिय</span>
                                      )}
                                      <span className="text-gray-300">|</span>
                                      <span title="वसुली दर" className={
                                        row.recoveryRate >= 70 ? 'text-green-600 font-medium' : row.recoveryRate >= 40 ? 'text-amber-600' : 'text-red-500'
                                      }>{Math.round(row.recoveryRate)}% वसुली</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 relative h-5 bg-gray-100 rounded overflow-hidden">
                                      <div
                                        className={`absolute inset-y-0 left-0 rounded ${
                                          row.isInactive ? 'bg-gray-300' : index === 0 ? 'bg-indigo-500' : index <= 2 ? 'bg-indigo-400' : 'bg-indigo-300'
                                        }`}
                                        style={{ width: `${Math.max(barWidth, 2)}%`, transition: 'width 0.6s ease-out' }}
                                      />
                                      {barWidth > 20 && (
                                        <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-white">
                                          {Math.round(row.smartScore)}/100
                                        </span>
                                      )}
                                    </div>
                                    {barWidth <= 20 && (
                                      <span className="text-xs font-semibold text-indigo-600 w-14 text-right">
                                        {Math.round(row.smartScore)}/100
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span><span className="font-medium text-gray-700">सक्रिय कर्जे ३५%</span> - सध्या किती कर्जे चालू आहेत</span>
                              <span><span className="font-medium text-gray-700">वसुली दर ३०%</span> - किती % रक्कम वसूल झाली</span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span><span className="font-medium text-gray-700">उलाढाल २०%</span> - एकूण किती रक्कम फिरवली</span>
                              <span><span className="font-medium text-gray-700">कर्ज संख्या १५%</span> - एकूण किती व्यवहार झाले</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}
              </>
            )}

            {/* ==================== कस्टमर नावाप्रमाणे TAB ==================== */}
            {activeTab === "customer" && (
              <>
                <Card className="mb-6" id="customer-search-area">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      कस्टमर नावाप्रमाणे सारांश
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Mode Switcher */}
                    <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => { setCustomerMode("specific"); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-sm font-medium transition-all ${
                          customerMode === "specific"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <Search className="h-3.5 w-3.5" />
                        विशिष्ट कस्टमर
                      </button>
                      <button
                        onClick={() => { setCustomerMode("top50"); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-sm font-medium transition-all ${
                          customerMode === "top50"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        टॉप ५० व्यवहार
                      </button>
                    </div>

                    {/* Specific Customer - Autocomplete */}
                    {customerMode === "specific" && (
                      <div className="mb-4 relative">
                        <Label htmlFor="customerSearch">कस्टमरचे नाव शोधा</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            ref={customerInputRef}
                            id="customerSearch"
                            type="text"
                            placeholder="कस्टमरचे नाव टाईप करा (किमान २ अक्षरे)..."
                            value={customerSearchTerm}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomerSearchTerm(val);
                              setShowCustomerSuggestions(val.length >= 2);
                              setSelectedSuggestionIndex(-1);
                              if (val !== selectedCustomerName) setSelectedCustomerName("");
                            }}
                            onKeyDown={handleCustomerKeyDown}
                            onFocus={() => {
                              if (customerSearchTerm.length >= 2) setShowCustomerSuggestions(true);
                            }}
                            className="pl-9"
                            autoComplete="off"
                          />
                          {selectedCustomerName && (
                            <button
                              onClick={() => {
                                setCustomerSearchTerm("");
                                setSelectedCustomerName("");
                                setShowCustomerSuggestions(false);
                                customerInputRef.current?.focus();
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {showCustomerSuggestions && customerAutocompleteSuggestions.length > 0 && (
                          <div
                            ref={customerSuggestionsRef}
                            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                          >
                            {customerAutocompleteSuggestions.map((suggestion: any, index: number) => (
                              <button
                                key={index}
                                onClick={() => handleCustomerSelect(suggestion.borrowerName || suggestion.name)}
                                className={`w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                                  index === selectedSuggestionIndex ? "bg-indigo-50" : ""
                                }`}
                              >
                                <div className="font-medium text-gray-900">{suggestion.borrowerName || suggestion.name}</div>
                                {suggestion.mobile && <div className="text-xs text-gray-500">{suggestion.mobile}</div>}
                                {suggestion.groupName && <div className="text-xs text-gray-400">गट: {suggestion.groupName}</div>}
                              </button>
                            ))}
                          </div>
                        )}

                        {showCustomerSuggestions && customerSearchTerm.length >= 2 && customerAutocompleteSuggestions.length === 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                            कोणताही कस्टमर सापडला नाही
                          </div>
                        )}
                      </div>
                    )}

                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="customerFromDate">सुरुवातीची तारीख</Label>
                        <Input id="customerFromDate" type="date" value={customerFromDate} onChange={(e) => setCustomerFromDate(e.target.value)} className="font-inter" />
                      </div>
                      <div>
                        <Label htmlFor="customerToDate">शेवटची तारीख</Label>
                        <Input id="customerToDate" type="date" value={customerToDate} onChange={(e) => setCustomerToDate(e.target.value)} className="font-inter" />
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        onClick={handlePrint} 
                        className="flex items-center gap-2 no-print" 
                        disabled={customerMode === "specific" && !selectedCustomerName}
                      >
                        <Printer className="h-4 w-4" />
                        प्रिंट करा
                      </Button>
                      <Button 
                        onClick={() => handleExcelExport(customerSummaries, customerMode === "specific" ? 'कस्टमर सारांश' : 'टॉप ५० सारांश')} 
                        variant="outline" 
                        className="bg-green-50 hover:bg-green-100 border-green-300 no-print hidden sm:flex"
                        disabled={customerMode === "specific" && !selectedCustomerName}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Excel एक्सपोर्ट
                      </Button>
                      {customerMode === "top50" && customerSummaries.length > 0 && (
                        <Button
                          variant="outline"
                          size="default"
                          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-1.5 no-print"
                          onClick={() => document.getElementById('customer-ranking-section')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                          <BarChart3 className="h-4 w-4" />
                          परफॉर्मन्स विश्लेषण पहा
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Results */}
                {customerSummaries.length > 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
                      <h3 className="font-semibold text-indigo-900 text-lg">
                        {customerMode === "specific" ? selectedCustomerName : "टॉप ५० कस्टमर (व्यवहार प्रमाणे)"}
                      </h3>
                      <p className="text-sm text-indigo-600">
                        कालावधी: {new Date(customerFromDate).toLocaleDateString('en-GB')} ते {new Date(customerToDate).toLocaleDateString('en-GB')}
                        {customerMode === "top50" && ` | एकूण ${customerSummaries.length} कस्टमर`}
                      </p>
                    </div>
                    {renderSummaryTable(customerSummaries, customerGrandTotals, "कस्टमर नाव", customerMode === "top50")}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
                    {customerMode === "specific" && !selectedCustomerName ? (
                      <>
                        <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-lg font-medium text-gray-500">कस्टमरचे नाव शोधा</p>
                        <p className="text-sm text-gray-400 mt-1">वरील सर्च बॉक्समध्ये किमान २ अक्षरे टाईप करा</p>
                      </>
                    ) : (
                      <>
                        <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-lg font-medium text-gray-500">निवडलेल्या कालावधीत कोणतेही व्यवहार नाहीत</p>
                        <p className="text-sm text-gray-400 mt-1">कृपया तारीख कालावधी तपासा</p>
                      </>
                    )}
                  </div>
                )}

                {/* ==================== टॉप कस्टमर परफॉर्मन्स विश्लेषण ==================== */}
                {customerMode === "top50" && customerSummaries.length > 0 && (() => {
                  const top50 = customerSummaries.slice(0, 50);
                  const maxCustAmount = Math.max(...top50.map(c => Math.max(c.totalAmount, c.closedAmount)), 1);
                  const maxCustActive = Math.max(...top50.map(c => c.activeLoans), 1);
                  const maxCustTurnover = Math.max(...top50.map(c => c.totalAmount + c.closedAmount), 1);
                  const maxCustLoans = Math.max(...top50.map(c => c.totalLoans), 1);

                  const rankedCustomers = top50.map(c => {
                    const recoveryRate = c.totalAmount > 0 ? Math.min(100, (c.closedAmount / c.totalAmount) * 100) : 0;
                    const activeScore = (c.activeLoans / maxCustActive) * 35;
                    const recoveryScore = (recoveryRate / 100) * 30;
                    const turnoverScore = ((c.totalAmount + c.closedAmount) / maxCustTurnover) * 20;
                    const loanCountScore = (c.totalLoans / maxCustLoans) * 15;
                    let smartScore = activeScore + recoveryScore + turnoverScore + loanCountScore;
                    const isInactive = c.activeLoans === 0;
                    if (isInactive) smartScore = smartScore * 0.4;
                    return { ...c, recoveryRate, smartScore, isInactive };
                  }).sort((a, b) => b.smartScore - a.smartScore);

                  return (
                    <div id="customer-performance-section" className="mt-6 space-y-5 no-print">

                      {/* KPI Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="text-xs text-gray-500 mb-1">एकूण वाटप</div>
                          <div className="text-base sm:text-lg font-bold text-gray-900">{formatCurrency(customerGrandTotals.totalAmount)}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{customerGrandTotals.totalLoans} कर्जे</div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="text-xs text-gray-500 mb-1">वसुली (बंद)</div>
                          <div className="text-base sm:text-lg font-bold text-green-700">{formatCurrency(customerGrandTotals.closedAmount)}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{customerGrandTotals.closedLoans} बंद कर्जे</div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="text-xs text-gray-500 mb-1">बाकी रक्कम</div>
                          <div className="text-base sm:text-lg font-bold text-red-600">{formatCurrency(Math.max(0, customerGrandTotals.activeBalance))}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{customerGrandTotals.activeLoans} सक्रिय कर्जे</div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                          <div className="text-xs text-gray-500 mb-1">व्याज उत्पन्न</div>
                          <div className="text-base sm:text-lg font-bold text-amber-700">{formatCurrency(customerGrandTotals.totalInterest)}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            वसुली दर: {customerGrandTotals.totalAmount > 0 ? Math.round(Math.min(100, (customerGrandTotals.closedAmount / customerGrandTotals.totalAmount) * 100)) : 0}%
                          </div>
                        </div>
                      </div>

                      {/* टॉप ५० कस्टमर वाटप vs वसुली */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-indigo-600" />
                            टॉप ५० कस्टमर - वाटप व वसुली तुलना
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {top50.map((row, index) => {
                              const safeBase = Math.max(row.totalAmount, row.closedAmount, 1);
                              const barBase = maxCustAmount;
                              const totalWidthPct = (safeBase / barBase) * 100;
                              const recoveredWidthPct = Math.min(totalWidthPct, (row.closedAmount / barBase) * 100);
                              const recoveryPct = safeBase > 0 ? Math.min(100, (row.closedAmount / safeBase) * 100) : 0;
                              return (
                                <div key={index}>
                                  <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[45%]">{row.name}</span>
                                    <div className="flex items-center gap-3 text-xs">
                                      <span className="text-gray-600">वाटप: <span className="font-semibold text-gray-900">{formatCurrency(row.totalAmount)}</span></span>
                                      <span className="text-gray-400">|</span>
                                      <span className="text-gray-600">वसुली: <span className="font-semibold text-green-700">{formatCurrency(row.closedAmount)}</span></span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 relative h-5 bg-gray-100 rounded overflow-hidden">
                                      <div
                                        className="absolute inset-y-0 left-0 bg-indigo-100 rounded"
                                        style={{ width: `${Math.max(totalWidthPct, 1)}%`, transition: 'width 0.6s ease-out' }}
                                      />
                                      <div
                                        className="absolute inset-y-0 left-0 bg-indigo-500 rounded"
                                        style={{ width: `${Math.max(recoveredWidthPct, 0)}%`, transition: 'width 0.6s ease-out' }}
                                      />
                                    </div>
                                    <span className={`text-xs font-bold w-10 text-right ${
                                      recoveryPct >= 70 ? 'text-green-600' : recoveryPct >= 40 ? 'text-amber-600' : 'text-red-600'
                                    }`}>
                                      {Math.round(recoveryPct)}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                            <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200" />
                              एकूण वाटप
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded bg-indigo-500" />
                              वसुली रक्कम
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-green-600">%</span>
                              वसुली दर
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* टॉप ५० कस्टमर Smart Score रँकिंग */}
                      <Card id="customer-ranking-section">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-indigo-600" />
                            टॉप ५० कस्टमर परफॉर्मन्स रँकिंग
                          </CardTitle>
                          <p className="text-xs text-gray-500 mt-1">
                            सक्रिय कर्जे (३५%) + वसुली दर (३०%) + एकूण उलाढाल (२०%) + कर्ज संख्या (१५%)
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {rankedCustomers.map((row, index) => {
                              const maxScore = rankedCustomers[0]?.smartScore || 1;
                              const barWidth = (row.smartScore / maxScore) * 100;
                              return (
                                <div key={index}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-bold w-5 text-right ${
                                      index === 0 ? 'text-indigo-600' : 'text-gray-400'
                                    }`}>{index + 1}</span>
                                    <span className="text-sm font-medium text-gray-800 truncate flex-1">{row.name}</span>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      {row.isInactive ? (
                                        <span className="text-red-400 font-medium">निष्क्रिय</span>
                                      ) : (
                                        <span className="text-indigo-600">{row.activeLoans} सक्रिय</span>
                                      )}
                                      <span className="text-gray-300">|</span>
                                      <span className={
                                        row.recoveryRate >= 70 ? 'text-green-600 font-medium' : row.recoveryRate >= 40 ? 'text-amber-600' : 'text-red-500'
                                      }>{Math.round(row.recoveryRate)}% वसुली</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 relative h-5 bg-gray-100 rounded overflow-hidden">
                                      <div
                                        className={`absolute inset-y-0 left-0 rounded ${
                                          row.isInactive ? 'bg-gray-300' : index === 0 ? 'bg-indigo-500' : index <= 2 ? 'bg-indigo-400' : 'bg-indigo-300'
                                        }`}
                                        style={{ width: `${Math.max(barWidth, 2)}%`, transition: 'width 0.6s ease-out' }}
                                      />
                                      {barWidth > 20 && (
                                        <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-white">
                                          {Math.round(row.smartScore)}/100
                                        </span>
                                      )}
                                    </div>
                                    {barWidth <= 20 && (
                                      <span className="text-xs font-semibold text-indigo-600 w-14 text-right">
                                        {Math.round(row.smartScore)}/100
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span><span className="font-medium text-gray-700">सक्रिय कर्जे ३५%</span> - सध्या किती कर्जे चालू आहेत</span>
                              <span><span className="font-medium text-gray-700">वसुली दर ३०%</span> - किती % रक्कम वसूल झाली</span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span><span className="font-medium text-gray-700">उलाढाल २०%</span> - एकूण किती रक्कम फिरवली</span>
                              <span><span className="font-medium text-gray-700">कर्ज संख्या १५%</span> - एकूण किती व्यवहार झाले</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="flex justify-center mt-4 no-print">
                        <Button
                          variant="outline"
                          size="default"
                          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-1.5"
                          onClick={() => document.getElementById('customer-search-area')?.scrollIntoView({ behavior: 'smooth' })}
                        >
                          <ArrowUp className="h-4 w-4" />
                          वर जा
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}