import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, Search, Home, FileText, ArrowLeft } from "lucide-react";
import { displayNarration } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DateUtils } from "@/lib/date-utils";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";

export default function PartyStatement() {
  const [, setLocation] = useLocation();
  
  const [filters, setFilters] = useState({
    partyId: '',
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  const [statementData, setStatementData] = useState<any>(null);
  const [selectedParty, setSelectedParty] = useState<any>(null);

  // ESC key navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setLocation('/cash');
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

  // Fetch all parties
  const { data: parties = [] } = useQuery({
    queryKey: ["/api/parties"],
  });

  // Fetch all cash transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["/api/cash-transactions"],
  });

  const handleSearch = () => {
    if (!filters.partyId || !filters.dateFrom || !filters.dateTo) {
      console.warn('Please select party and date range');
      return;
    }

    
    // Find selected party
    const party = (parties as any[]).find(p => p.id === filters.partyId);
    if (!party) {
      console.warn('Party not found');
      return;
    }
    
    setSelectedParty(party);
    
    // Filter transactions for this party in date range
    const partyTransactions = (transactions as any[]).filter((transaction: any) => {
      const transactionDate = new Date(transaction.transactionDate);
      const fromDate = new Date(filters.dateFrom);
      const toDate = new Date(filters.dateTo);
      
      return transaction.partyId === filters.partyId &&
             transactionDate >= fromDate && 
             transactionDate <= toDate;
    });
    
    
    // Calculate statement entries
    const entries: any[] = [];
    let runningBalance = 0;
    
    // Sort transactions by date
    partyTransactions.sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
    
    partyTransactions.forEach((transaction: any) => {
      const amount = parseFloat(transaction.amount || 0);
      
      let debit = 0, credit = 0;
      
      if (transaction.transactionType === 'cash_in') {
        // CASH_IN: व्यक्तीने आपल्याला पैसे दिले (Party paid us money)
        // From party's perspective: Money went OUT of their account → DEBIT (नावे)
        // Party's account gets debited because they gave us money
        debit = amount;
        runningBalance += amount; // Positive balance = Party has paid money (Debit balance)
      } else {
        // CASH_OUT: आपण व्यक्तीला पैसे दिले (We paid money to party)
        // From party's perspective: Money came INTO their account → CREDIT (जमा)  
        // Party's account gets credited because we gave them money
        credit = amount;
        runningBalance -= amount; // Negative balance = Party received money (Credit balance)
      }
      
      entries.push({
        date: transaction.transactionDate,
        description: displayNarration(transaction.narration) || (transaction.transactionType === 'cash_in' ? 'रोकड मिळाली' : 'रोकड दिली'),
        debit,
        credit,
        balance: runningBalance,
        transactionType: transaction.transactionType
      });
    });
    
    setStatementData({
      party,
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

  const handlePrint = () => {
    window.print();
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
              <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-4">
                  <Link href="/cash">
                    <Button variant="outline" size="sm" className="btn-primary-gradient flex items-center gap-2 text-white border-0">
                      <ArrowLeft className="h-4 w-4" />
                      रोकड व्यवहार
                    </Button>
                  </Link>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground heading-professional font-noto">
                    व्यक्ती खाते विवरण
                  </h1>
                </div>
              </div>

              {/* Filters */}
              <Card className="card-professional print:hidden">
                <CardHeader>
                  <CardTitle className="flex items-center heading-professional">
                    <Search className="h-5 w-5 mr-2" />
                    व्यक्ती आणि कालावधी निवडा
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>व्यक्ती निवडा</Label>
                      <Select value={filters.partyId} onValueChange={(value) => setFilters(prev => ({ ...prev, partyId: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="व्यक्ती निवडा" />
                        </SelectTrigger>
                        <SelectContent>
                          {(parties as any[]).map((party: any) => (
                            <SelectItem key={party.id} value={party.id}>
                              <div className="flex flex-col">
                                <span>{party.name}</span>
                                {party.mobile && (
                                  <span className="text-xs text-gray-500">{party.mobile}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="dateFrom">पासून दिनांक</Label>
                      <div className="space-y-2">
                        <Input
                          id="dateFrom"
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        />
                        <div className="bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
                          <p className="text-sm font-medium text-indigo-800">
                            {filters.dateFrom ? (
                              <>✓ निवडलेली तारीख: <span className="font-bold">{DateUtils.isoToIndianDate(filters.dateFrom)}</span></>
                            ) : (
                              'कृपया तारीख निवडा'
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="dateTo">पर्यंत दिनांक</Label>
                      <div className="space-y-2">
                        <Input
                          id="dateTo"
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        />
                        <div className="bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
                          <p className="text-sm font-medium text-indigo-800">
                            {filters.dateTo ? (
                              <>✓ निवडलेली तारीख: <span className="font-bold">{DateUtils.isoToIndianDate(filters.dateTo)}</span></>
                            ) : (
                              'कृपया तारीख निवडा'
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between mt-4">
                    <Button onClick={handleSearch} className="btn-primary-gradient text-white">
                      <Search className="h-4 w-4 mr-2" />
                      विवरण तयार करा
                    </Button>
                    {statementData && (
                      <Button onClick={handlePrint} variant="outline">
                        <Printer className="h-4 w-4 mr-2" />
                        प्रिंट करा
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Statement Display */}
              {statementData && (
                <Card className="statement-card">
                  <CardContent className="p-6 md:p-8">
                    {/* Statement Header */}
                    <div className="text-center mb-6 space-y-2">
                      <h2 className="text-xl md:text-2xl font-bold">{company?.name || 'कंपनी नाव'}</h2>
                      <p className="text-sm text-gray-600">{company?.address}</p>
                      <h3 className="text-lg md:text-xl font-semibold mt-4">व्यक्ती खाते विवरण</h3>
                      <div className="text-sm text-gray-600">
                        <p><strong>व्यक्ती:</strong> {statementData.party.name}</p>
                        {statementData.party.mobile && <p><strong>मोबाईल:</strong> {statementData.party.mobile}</p>}
                        <p><strong>कालावधी:</strong> {DateUtils.isoToIndianDate(statementData.dateRange.from)} ते {DateUtils.isoToIndianDate(statementData.dateRange.to)}</p>
                      </div>
                    </div>

                    {/* Statement Table */}
                    <div className="overflow-x-auto">
                      <Table className="statement-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="border text-center md:text-base md:py-3">दिनांक</TableHead>
                            <TableHead className="border text-center md:text-base md:py-3">तपशील</TableHead>
                            <TableHead className="border text-center md:text-base md:py-3">जमा (Cr.)</TableHead>
                            <TableHead className="border text-center md:text-base md:py-3">नावे (Dr.)</TableHead>
                            <TableHead className="border text-center md:text-base md:py-3">शिल्लक</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statementData.entries.map((entry: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="border text-center md:text-base md:py-3">
                                {DateUtils.isoToIndianDate(entry.date)}
                              </TableCell>
                              <TableCell className="border md:text-base md:py-3">
                                {entry.description}
                              </TableCell>
                              <TableCell className="border text-right md:text-base md:py-3">
                                {entry.credit > 0 && `₹${entry.credit.toLocaleString('en-IN')}`}
                              </TableCell>
                              <TableCell className="border text-right md:text-base md:py-3">
                                {entry.debit > 0 && `₹${entry.debit.toLocaleString('en-IN')}`}
                              </TableCell>
                              <TableCell className="border text-right md:text-base md:py-3">
                                <span className={entry.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  ₹{Math.abs(entry.balance).toLocaleString('en-IN')}
                                  {entry.balance >= 0 ? ' (Cr.)' : ' (Dr.)'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Summary Row */}
                          <TableRow className="bg-gray-50 font-semibold">
                            <TableCell className="border text-center md:text-base md:py-3" colSpan={2}>एकूण</TableCell>
                            <TableCell className="border text-right md:text-base md:py-3">
                              ₹{statementData.totalCredit.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="border text-right md:text-base md:py-3">
                              ₹{statementData.totalDebit.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="border text-right md:text-base md:py-3">
                              <span className={statementData.finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                ₹{Math.abs(statementData.finalBalance).toLocaleString('en-IN')}
                                {statementData.finalBalance >= 0 ? ' (Cr.)' : ' (Dr.)'}
                              </span>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Statement Footer */}
                    <div className="mt-6 text-sm text-gray-600 text-center">
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