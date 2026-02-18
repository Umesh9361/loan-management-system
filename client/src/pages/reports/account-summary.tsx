import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Search, Printer, Calendar, Download, Users, User } from "lucide-react";
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

interface CustomerSummary {
  borrowerName: string;
  groupName: string;
  loanDate: string;
  loanNumber: string;
  principalAmount: number;
  status: string;
  closedAmount: number;
  interestPaid: number;
}

export default function AccountSummaryReport() {
  const [activeTab, setActiveTab] = useState<"group" | "customer">("group");
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const [customerFromDate, setCustomerFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerToDate, setCustomerToDate] = useState(new Date().toISOString().split('T')[0]);
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

  const handleExcelExport = () => {
    try {
      const cleanReportData = groupSummaries.map((group, index) => ({
        serialNo: index + 1,
        groupName: group.groupName,
        accountName: group.groupName,
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

  const handleCustomerExcelExport = () => {
    try {
      if (!selectedCustomerName || customerLoanSummaries.length === 0) {
        alert('कृपया प्रथम कस्टमरचे नाव निवडा');
        return;
      }

      const cleanReportData = customerLoanSummaries.map((loan, index) => ({
        serialNo: index + 1,
        accountName: loan.borrowerName,
        groupName: loan.groupName,
        loanNumber: loan.loanNumber,
        loanDate: new Date(loan.loanDate).toLocaleDateString('en-GB'),
        totalLoans: 1,
        activeLoans: loan.status === 'active' ? 1 : 0,
        closedLoans: loan.status === 'closed' ? 1 : 0,
        totalAmount: loan.principalAmount,
        closedAmount: loan.closedAmount,
        activeBalance: loan.status === 'active' ? loan.principalAmount : 0,
        totalInterest: loan.interestPaid
      }));

      const success = exportAccountSummaryToExcel(cleanReportData);
      
      if (success) {
        alert('कस्टमर सारांश यशस्वीरित्या एक्सेल फाइलमध्ये एक्सपोर्ट झाला!');
      } else {
        alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
      }
    } catch (error) {
      console.error('Excel export error:', error);
      alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
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

  const groupSummaries: GroupSummary[] = (groups as any[]).map((group: any) => {
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
  }).filter(summary => summary.totalLoans > 0);

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

  const customerLoanSummaries: CustomerSummary[] = (() => {
    if (!selectedCustomerName) return [];

    const normalizedSelected = selectedCustomerName.trim().toLowerCase();
    const customerLoans = (loans as any[]).filter((loan: any) => {
      const loanName = (loan.borrowerName || '').trim().toLowerCase();
      return loanName === normalizedSelected;
    });

    const periodLoans = customerLoans.filter((loan: any) => {
      const loanDate = new Date(loan.loanDate);
      return loanDate >= new Date(customerFromDate) && loanDate <= new Date(customerToDate);
    });

    return periodLoans.map((loan: any) => {
      const group = (groups as any[]).find((g: any) => g.id === loan.groupId);
      const closure = (loanClosures as any[]).find((c: any) => c.loanId === loan.id);

      const closureInPeriod = closure ? (() => {
        const closureDate = new Date(closure.closureDate);
        return closureDate >= new Date(customerFromDate) && closureDate <= new Date(customerToDate);
      })() : false;

      return {
        borrowerName: loan.borrowerName,
        groupName: group?.name || '-',
        loanDate: loan.loanDate,
        loanNumber: loan.loanNumber || '-',
        principalAmount: parseFloat(loan.principalAmount || 0),
        status: closureInPeriod ? 'closed' : 'active',
        closedAmount: closureInPeriod ? parseFloat(closure.principalPaid || closure.principalAmount || 0) : 0,
        interestPaid: closureInPeriod ? parseFloat(closure.calculatedInterest || closure.interestAmount || 0) : 0,
      };
    }).sort((a, b) => new Date(a.loanDate).getTime() - new Date(b.loanDate).getTime());
  })();

  const customerGrandTotals = customerLoanSummaries.reduce(
    (totals, loan) => ({
      totalLoans: totals.totalLoans + 1,
      activeLoans: totals.activeLoans + (loan.status === 'active' ? 1 : 0),
      closedLoans: totals.closedLoans + (loan.status === 'closed' ? 1 : 0),
      totalAmount: totals.totalAmount + loan.principalAmount,
      closedAmount: totals.closedAmount + loan.closedAmount,
      activeBalance: totals.activeBalance + (loan.status === 'active' ? loan.principalAmount : 0),
      totalInterest: totals.totalInterest + loan.interestPaid,
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
                  {activeTab === "customer" && selectedCustomerName ? (
                    <>कस्टमर: {selectedCustomerName} | कालावधी: {new Date(customerFromDate).toLocaleDateString('en-GB')} ते {new Date(customerToDate).toLocaleDateString('en-GB')}</>
                  ) : (
                    <>कालावधी: {new Date(fromDate).toLocaleDateString('en-GB')} ते {new Date(toDate).toLocaleDateString('en-GB')}</>
                  )}
                </p>
              </div>
              
              {activeTab === "group" ? (
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
              ) : (
                <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>गट नाव</th>
                      <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>कर्ज क्र.</th>
                      <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>कर्ज तारीख</th>
                      <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>मुद्दल रक्कम</th>
                      <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>स्थिती</th>
                      <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>बंद रक्कम</th>
                      <th style={{ border: '2px solid #1e40af', padding: '10px', fontSize: '14px' }}>व्याज</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerLoanSummaries.map((loan, index) => (
                      <tr key={index}>
                        <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'left', fontSize: '13px' }}>{loan.groupName}</td>
                        <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px' }}>{loan.loanNumber}</td>
                        <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px' }}>{new Date(loan.loanDate).toLocaleDateString('en-GB')}</td>
                        <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px' }}>₹{loan.principalAmount.toLocaleString('en-IN')}</td>
                        <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontSize: '13px' }}>{loan.status === 'active' ? 'सक्रिय' : 'बंद'}</td>
                        <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px' }}>₹{loan.closedAmount.toLocaleString('en-IN')}</td>
                        <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontSize: '13px' }}>₹{loan.interestPaid.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan={3} style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'left', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                        एकूण योग ({customerGrandTotals.totalLoans} कर्जे - सक्रिय: {customerGrandTotals.activeLoans}, बंद: {customerGrandTotals.closedLoans})
                      </td>
                      <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                        ₹{customerGrandTotals.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'center', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>-</td>
                      <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                        ₹{customerGrandTotals.closedAmount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ border: '2px solid #1e40af', padding: '10px', textAlign: 'right', fontWeight: 'bold', background: '#e3f2fd', fontSize: '13px' }}>
                        ₹{customerGrandTotals.totalInterest.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
              
              {activeTab === "group" && groupSummaries.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', fontSize: '16px' }}>
                  निवडलेल्या तारखेच्या कालावधीत कोणतेही व्यवहार नाहीत
                </div>
              )}
              
              {((activeTab === "group" && groupSummaries.length > 0) || (activeTab === "customer" && customerLoanSummaries.length > 0)) && (
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

            {/* Tab Switcher - Mobile Friendly */}
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
                      
                      <Button onClick={handleExcelExport} variant="outline" className="bg-green-50 hover:bg-green-100 border-green-300 no-print hidden sm:flex">
                        <Download className="mr-2 h-4 w-4" />
                        Excel एक्सपोर्ट
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Group Summary Table */}
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

                    <div className="mt-8 text-xs text-gray-600">
                      <p>अहवाल तयार केल्याची तारीख: {new Date().toLocaleDateString('hi-IN')}</p>
                      <p>सिस्टम रिपोर्ट - लोन मॅनेजमेंट सिस्टम</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ==================== कस्टमर नावाप्रमाणे TAB ==================== */}
            {activeTab === "customer" && (
              <>
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      कस्टमर नावाप्रमाणे सारांश
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Customer Autocomplete Search */}
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
                            if (val.length < 2) {
                              setSelectedCustomerName("");
                            }
                          }}
                          onKeyDown={handleCustomerKeyDown}
                          onFocus={() => {
                            if (customerSearchTerm.length >= 2) {
                              setShowCustomerSuggestions(true);
                            }
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

                      {/* Autocomplete Dropdown */}
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
                              {suggestion.mobile && (
                                <div className="text-xs text-gray-500">{suggestion.mobile}</div>
                              )}
                              {suggestion.groupName && (
                                <div className="text-xs text-gray-400">गट: {suggestion.groupName}</div>
                              )}
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

                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="customerFromDate">सुरुवातीची तारीख</Label>
                        <Input
                          id="customerFromDate"
                          type="date"
                          value={customerFromDate}
                          onChange={(e) => setCustomerFromDate(e.target.value)}
                          className="font-inter"
                        />
                      </div>
                      <div>
                        <Label htmlFor="customerToDate">शेवटची तारीख</Label>
                        <Input
                          id="customerToDate"
                          type="date"
                          value={customerToDate}
                          onChange={(e) => setCustomerToDate(e.target.value)}
                          className="font-inter"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handlePrint} className="flex items-center gap-2 no-print" disabled={!selectedCustomerName}>
                        <Printer className="h-4 w-4" />
                        प्रिंट करा
                      </Button>
                      
                      <Button onClick={handleCustomerExcelExport} variant="outline" className="bg-green-50 hover:bg-green-100 border-green-300 no-print hidden sm:flex" disabled={!selectedCustomerName}>
                        <Download className="mr-2 h-4 w-4" />
                        Excel एक्सपोर्ट
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Summary Table */}
                {selectedCustomerName && (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
                      <h3 className="font-semibold text-indigo-900 text-lg">{selectedCustomerName}</h3>
                      <p className="text-sm text-indigo-600">
                        कालावधी: {new Date(customerFromDate).toLocaleDateString('en-GB')} ते {new Date(customerToDate).toLocaleDateString('en-GB')}
                      </p>
                    </div>

                    {customerLoanSummaries.length > 0 ? (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border border-gray-300 p-2 text-left font-bold">गट नाव</th>
                                <th className="border border-gray-300 p-2 text-center font-bold">कर्ज क्र.</th>
                                <th className="border border-gray-300 p-2 text-center font-bold">कर्ज तारीख</th>
                                <th className="border border-gray-300 p-2 text-right font-bold">मुद्दल रक्कम (₹)</th>
                                <th className="border border-gray-300 p-2 text-center font-bold">स्थिती</th>
                                <th className="border border-gray-300 p-2 text-right font-bold">बंद रक्कम (₹)</th>
                                <th className="border border-gray-300 p-2 text-right font-bold">व्याज (₹)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {customerLoanSummaries.map((loan, index) => (
                                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                  <td className="border border-gray-300 p-2 text-left font-medium">{loan.groupName}</td>
                                  <td className="border border-gray-300 p-2 text-center">{loan.loanNumber}</td>
                                  <td className="border border-gray-300 p-2 text-center">{new Date(loan.loanDate).toLocaleDateString('en-GB')}</td>
                                  <td className="border border-gray-300 p-2 text-right">{formatCurrency(loan.principalAmount).replace('₹', '')}</td>
                                  <td className="border border-gray-300 p-2 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                      loan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {loan.status === 'active' ? 'सक्रिय' : 'बंद'}
                                    </span>
                                  </td>
                                  <td className="border border-gray-300 p-2 text-right">{formatCurrency(loan.closedAmount).replace('₹', '')}</td>
                                  <td className="border border-gray-300 p-2 text-right">{formatCurrency(loan.interestPaid).replace('₹', '')}</td>
                                </tr>
                              ))}
                              <tr className="bg-indigo-100 border-t-2 border-black font-bold">
                                <td colSpan={3} className="border border-gray-300 p-2 text-left font-bold">
                                  एकूण योग (कर्जे: {customerGrandTotals.totalLoans} | सक्रिय: {customerGrandTotals.activeLoans} | बंद: {customerGrandTotals.closedLoans})
                                </td>
                                <td className="border border-gray-300 p-2 text-right font-bold">{formatCurrency(customerGrandTotals.totalAmount).replace('₹', '')}</td>
                                <td className="border border-gray-300 p-2 text-center font-bold">-</td>
                                <td className="border border-gray-300 p-2 text-right font-bold">{formatCurrency(customerGrandTotals.closedAmount).replace('₹', '')}</td>
                                <td className="border border-gray-300 p-2 text-right font-bold">{formatCurrency(customerGrandTotals.totalInterest).replace('₹', '')}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="sm:hidden divide-y divide-gray-100">
                          {customerLoanSummaries.map((loan, index) => (
                            <div key={index} className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="font-semibold text-gray-900">{loan.groupName}</span>
                                  <span className="text-gray-500 text-sm ml-2">#{loan.loanNumber}</span>
                                </div>
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                  loan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {loan.status === 'active' ? 'सक्रिय' : 'बंद'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mb-2">
                                {new Date(loan.loanDate).toLocaleDateString('en-GB')}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>
                                  <div className="text-gray-500 text-xs">मुद्दल</div>
                                  <div className="font-semibold">{formatCurrency(loan.principalAmount)}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">बंद रक्कम</div>
                                  <div className="font-semibold">{formatCurrency(loan.closedAmount)}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">व्याज</div>
                                  <div className="font-semibold">{formatCurrency(loan.interestPaid)}</div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Mobile Totals */}
                          <div className="p-4 bg-indigo-50">
                            <div className="font-bold text-indigo-900 mb-2">
                              एकूण योग
                            </div>
                            <div className="text-sm text-indigo-700 mb-3">
                              कर्जे: {customerGrandTotals.totalLoans} | सक्रिय: {customerGrandTotals.activeLoans} | बंद: {customerGrandTotals.closedLoans}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <div className="text-indigo-600 text-xs">एकूण मुद्दल</div>
                                <div className="font-bold text-indigo-900">{formatCurrency(customerGrandTotals.totalAmount)}</div>
                              </div>
                              <div>
                                <div className="text-indigo-600 text-xs">बंद रक्कम</div>
                                <div className="font-bold text-indigo-900">{formatCurrency(customerGrandTotals.closedAmount)}</div>
                              </div>
                              <div>
                                <div className="text-indigo-600 text-xs">एकूण व्याज</div>
                                <div className="font-bold text-indigo-900">{formatCurrency(customerGrandTotals.totalInterest)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-lg font-medium">निवडलेल्या कालावधीत कोणतेही कर्ज सापडले नाही</p>
                        <p className="text-sm mt-1">कृपया तारीख कालावधी तपासा</p>
                      </div>
                    )}
                  </div>
                )}

                {!selectedCustomerName && (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
                    <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-medium text-gray-500">कस्टमरचे नाव शोधा</p>
                    <p className="text-sm text-gray-400 mt-1">वरील सर्च बॉक्समध्ये किमान २ अक्षरे टाईप करा</p>
                  </div>
                )}
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}