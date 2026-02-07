import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { LoanCalculations } from "@/lib/calculations";
import { ExportService } from "@/lib/export";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { exportBorrowerListToExcel } from '@/utils/excel-export';

export default function Ledger() {
  const [selectedLoanId, setSelectedLoanId] = useState<string>("");

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  const { data: loans } = useQuery({
    queryKey: ["/api/loans"],
  });

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ["/api/reports/ledger", selectedLoanId],
    queryFn: () => 
      fetch(`/api/reports/ledger/${selectedLoanId}`, {
        credentials: "include",
      }).then(res => res.json()),
    enabled: !!selectedLoanId,
  });

  const selectedLoan = loans?.find((loan: any) => loan.id === selectedLoanId);

  const handleExportPDF = () => {
    if (!ledgerData || !selectedLoan) return;
    
    const exportData = ExportService.prepareLoanLedgerData(selectedLoan, ledgerData);
    ExportService.exportToPDF(exportData, `ledger_${selectedLoan.loanNumber}.pdf`);
  };

  const handleExportExcel = () => {
    if (!ledgerData || !selectedLoan) {
      alert('एक्सेल एक्सपोर्ट करण्यासाठी कर्ज निवडा');
      return;
    }
    
    try {
      const excelData = ledgerData.map((entry: any, index: number) => ({
        serialNo: index + 1,
        date: entry.date,
        description: entry.description,
        debitAmount: entry.debit || 0,
        creditAmount: entry.credit || 0,
        balance: entry.balance
      }));

      const success = exportBorrowerListToExcel(
        excelData,
        selectedLoan?.borrowerName,
        { from: '', to: '' }
      );
      
      if (success) {
        alert('लेजर यशस्वीरित्या एक्सेल फाइलमध्ये एक्सपोर्ट झाले!');
      } else {
        alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
      }
    } catch (error) {
      console.error('Excel export error:', error);
      alert('एक्सेल एक्सपोर्ट करताना त्रुटी झाली');
    }
  };

  const calculateLedgerBalance = () => {
    let balance = Number(selectedLoan?.principalAmount || 0);
    const rows = [];

    // Add opening entry
    rows.push({
      date: selectedLoan?.startDate,
      description: "कर्ज वाटप",
      debit: Number(selectedLoan?.principalAmount || 0),
      credit: null,
      balance: balance,
      type: "disbursement"
    });

    // Process transactions
    ledgerData?.forEach((transaction: any) => {
      const isPayment = transaction.type === "payment" || transaction.type === "closure";
      const amount = Number(transaction.amount);
      
      if (isPayment) {
        balance -= amount;
      }

      rows.push({
        date: transaction.transactionDate,
        description: transaction.description || getTransactionTypeMarathi(transaction.type),
        debit: !isPayment ? amount : null,
        credit: isPayment ? amount : null,
        balance: balance,
        type: transaction.type
      });
    });

    return rows;
  };

  const getTransactionTypeMarathi = (type: string) => {
    switch (type) {
      case "disbursement": return "कर्ज वाटप";
      case "payment": return "हप्ता परतफेड";
      case "closure": return "कर्ज बंद";
      default: return type;
    }
  };

  const ledgerRows = selectedLoan && ledgerData ? calculateLedgerBalance() : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">खातेवही - व्यक्तिगत विवरण</h1>
              <p className="text-gray-600">व्यक्तीगत कर्ज खात्याचे संपूर्ण विवरण</p>
            </div>

            {/* Loan Selection */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-64">
                    <Label>कर्ज निवडा</Label>
                    <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                      <SelectTrigger>
                        <SelectValue placeholder="कर्ज निवडा" />
                      </SelectTrigger>
                      <SelectContent>
                        {loans?.map((loan: any) => (
                          <SelectItem key={loan.id} value={loan.id}>
                            {loan.loanNumber} - {loan.borrower.name} ({loan.group.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedLoanId && (
                    <>
                      <Button onClick={handleExportPDF} variant="outline">
                        <FileDown className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                      <Button onClick={handleExportExcel} variant="outline" className="bg-green-50 hover:bg-green-100 border-green-300">
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Excel एक्सपोर्ट
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {selectedLoan && (
              <>
                {/* Loan Details */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>कर्ज तपशील</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">कर्ज क्रमांक</Label>
                        <p className="font-medium font-inter">{selectedLoan.loanNumber}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">कर्जदार</Label>
                        <p className="font-medium">{selectedLoan.borrower.name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">ग्रुप</Label>
                        <p className="font-medium">{selectedLoan.group.name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">मोबाईल</Label>
                        <p className="font-medium font-inter">{selectedLoan.borrower.mobile}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">मुद्दल रक्कम</Label>
                        <p className="font-medium font-inter">
                          ₹ {LoanCalculations.formatAmount(Number(selectedLoan.principalAmount))}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">व्याज दर</Label>
                        <p className="font-medium font-inter">{selectedLoan.interestRate}%</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">कालावधी</Label>
                        <p className="font-medium font-inter">{selectedLoan.durationMonths} महिने</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">स्थिती</Label>
                        <p className="font-medium">
                          {selectedLoan.status === "active" ? "सक्रिय" : "बंद"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ledger Table */}
                <Card>
                  <CardHeader className="text-center">
                    <CardTitle className="text-xl">{company?.name || "कंपनी नाव"}</CardTitle>
                    <p className="text-gray-600">खातेवही - व्यक्तिगत विवरण</p>
                    <p className="text-sm text-gray-500">
                      {selectedLoan.borrower.name} ({selectedLoan.loanNumber})
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>तारीख</TableHead>
                            <TableHead>तपशील</TableHead>
                            <TableHead className="text-center">डेबिट</TableHead>
                            <TableHead className="text-center">क्रेडिट</TableHead>
                            <TableHead className="text-center">शिल्लक</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledgerRows.map((row, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-inter">
                                {new Date(row.date).toLocaleDateString('hi-IN')}
                              </TableCell>
                              <TableCell>{row.description}</TableCell>
                              <TableCell className="text-center font-inter">
                                {row.debit !== null 
                                  ? `₹ ${LoanCalculations.formatAmount(row.debit)}` 
                                  : "-"
                                }
                              </TableCell>
                              <TableCell className="text-center font-inter">
                                {row.credit !== null 
                                  ? `₹ ${LoanCalculations.formatAmount(row.credit)}` 
                                  : "-"
                                }
                              </TableCell>
                              <TableCell className="text-center font-medium font-inter">
                                ₹ {LoanCalculations.formatAmount(row.balance)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Summary */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <Label className="text-sm font-medium text-gray-600">मुद्दल रक्कम</Label>
                        <p className="text-lg font-bold font-inter">
                          ₹ {LoanCalculations.formatAmount(Number(selectedLoan.principalAmount))}
                        </p>
                      </div>
                      <div className="text-center">
                        <Label className="text-sm font-medium text-gray-600">परतफेड</Label>
                        <p className="text-lg font-bold font-inter">
                          ₹ {LoanCalculations.formatAmount(
                            Number(selectedLoan.principalAmount) - (ledgerRows[ledgerRows.length - 1]?.balance || 0)
                          )}
                        </p>
                      </div>
                      <div className="text-center">
                        <Label className="text-sm font-medium text-gray-600">वर्तमान शिल्लक</Label>
                        <p className="text-lg font-bold font-inter">
                          ₹ {LoanCalculations.formatAmount(ledgerRows[ledgerRows.length - 1]?.balance || 0)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {!selectedLoanId && (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    खातेवही पाहण्यासाठी कर्ज निवडा
                  </h3>
                  <p className="text-gray-600">
                    वरील ड्रॉपडाउन मधून कर्ज निवडा आणि त्याचे संपूर्ण खातेवही पहा
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
