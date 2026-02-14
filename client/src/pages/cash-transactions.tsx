import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Filter, Download, TrendingUp, TrendingDown, Home, Plus, Minus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DateUtils } from "@/lib/date-utils";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import CashInDialog from "@/components/cash-in-dialog";
import CashOutDialog from "@/components/cash-out-dialog";
import EditCashTransactionDialog from "@/components/edit-cash-transaction-dialog";
import { useRealTimeSync } from "@/hooks/use-real-time-sync";

export default function CashTransactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const { safeNavigate, isNavigating } = useSafeNavigation();
  const [showCashIn, setShowCashIn] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [editTransaction, setEditTransaction] = useState<any>(null);
  
  // 🚀 REAL-TIME SYNC: Enable automatic updates for all loan operations
  const { triggerCompleteSync } = useRealTimeSync({
    enabled: true,
    onSyncComplete: (operation) => {
      console.log(`💰 CASH TRANSACTIONS: Real-time sync completed for ${operation}`);
    }
  });
  // Helper function to get current date in YYYY-MM-DD format
  const getCurrentDate = () => new Date().toISOString().split('T')[0];
  
  const [filters, setFilters] = useState({
    dateFrom: "2025-08-01", // Start from beginning of month to show all data
    dateTo: getCurrentDate(),
    search: "",
    transactionType: "",
  });

  // Fetch transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/cash-transactions", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value);
      });
      return fetch(`/api/cash-transactions?${params}`, { credentials: 'include' }).then(r => r.json());
    },
  });

  // Fetch parties for filter
  const { data: parties } = useQuery({
    queryKey: ["/api/parties"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/cash-transactions/${id}`, "DELETE"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/closing"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"], refetchType: 'all' });
      
      toast({
        title: "यशस्वी!",
        description: "व्यवहार हटवला गेला आणि द्विनोंदणी journal भी अपडेट झाले",
      });
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी!",
        description: `व्यवहार हटवता आला नाही: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string, transactionType?: string, amount?: string) => {
    const amountText = amount ? `₹${Number(amount).toLocaleString('en-IN')}` : '';
    const typeText = transactionType === 'cash_in' ? 'पैसे आले' : 'पैसे दिले';
    
    if (confirm(`हा व्यवहार हटवायचा आहे का?\n${typeText} - ${amountText}\n\nसावधान: द्विनोंदणी journal entries भी हटतील!`)) {
      deleteMutation.mutate(id);
    }
  };

  const transactionsList = Array.isArray(transactions) ? transactions : [];
  const partiesList = Array.isArray(parties) ? parties : [];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + F = Focus on Party Filter
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const partyFilter = document.querySelector('[role="combobox"]') as HTMLElement;
        partyFilter?.click();
        return;
      }

      // Ctrl/Cmd + D = Focus on Date From
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        const dateFrom = document.getElementById('dateFrom') as HTMLInputElement;
        dateFrom?.focus();
        return;
      }

      // Ctrl/Cmd + T = Focus on Date To  
      if ((event.ctrlKey || event.metaKey) && event.key === 't') {
        event.preventDefault();
        const dateTo = document.getElementById('dateTo') as HTMLInputElement;
        dateTo?.focus();
        return;
      }

      // Ctrl/Cmd + R = Clear all filters and reset to show full month
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        setFilters({ 
          dateFrom: "2025-08-01", 
          dateTo: getCurrentDate(), 
          search: "", 
          transactionType: "" 
        });
        toast({
          title: "फिल्टर साफ केले!",
          description: "सर्व फिल्टर रीसेट झाले आहेत आणि पूर्ण महिना दाखवण्यासाठी सेट केले",
        });
        return;
      }

      // Ctrl/Cmd + H = Go to home
      if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
        event.preventDefault();
        // Navigation handled in parent component
        // window.location.href = '/';
        return;
      }

      // Escape = Clear filters
      if (event.key === 'Escape') {
        setFilters({ 
          dateFrom: "", 
          dateTo: "", 
          search: "", 
          transactionType: "" 
        });
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toast]);

  // Calculate totals
  const totals = transactionsList.reduce(
    (acc, t) => {
      const amount = Number(t.amount);
      if (t.transactionType === 'cash_in') {
        acc.cashIn += amount;
      } else {
        acc.cashOut += amount;
      }
      return acc;
    },
    { cashIn: 0, cashOut: 0 }
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="space-y-6">
              {/* Desktop Header */}
              <div className="hidden lg:block mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={() => safeNavigate('/')}
                        disabled={isNavigating || location === '/'}
                      >
                        <Home className="h-4 w-4" />
                        {isNavigating ? 'जात आहे...' : 'मुखपृष्ठ'}
                      </Button>
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-900">रोकड व्यवहार व्यवस्थापन</h1>
                    <p className="text-gray-600">रोकड आल्या-गेल्याचे व्यवहार व त्यांचे तपशील</p>
                  </div>
                  <div className="text-sm text-gray-600 bg-indigo-50 p-2 rounded-lg">
                    <strong>शॉर्टकट:</strong> Ctrl+F=व्यक्ती फिल्टर | Ctrl+D=पासून दिनांक | Ctrl+T=पर्यंत दिनांक | Ctrl+R=फिल्टर साफ करा
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-green-50 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-sm text-green-700">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      पैसे आले
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-700">
                      ₹{totals.cashIn.toLocaleString('en-IN')}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-red-50 border-red-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-sm text-red-700">
                      <TrendingDown className="h-4 w-4 mr-2" />
                      पैसे दिले
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-700">
                      ₹{totals.cashOut.toLocaleString('en-IN')}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-indigo-50 border-indigo-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-sm text-indigo-700">
                      <Filter className="h-4 w-4 mr-2" />
                      नेट बॅलन्स
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-indigo-700">
                      ₹{(totals.cashIn - totals.cashOut).toLocaleString('en-IN')}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Filter className="h-5 w-5 mr-2" />
                    फिल्टर
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="dateFrom">पासून दिनांक</Label>
                      <Input
                        id="dateFrom"
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                        className="font-inter"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dateTo">पर्यंत दिनांक</Label>
                      <Input
                        id="dateTo"
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                        className="font-inter"
                      />
                    </div>
                    <div>
                      <Label>सर्च</Label>
                      <Input
                        placeholder="व्यक्तीचे नाव, रक्कम किंवा तपशील टाका..."
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value.trimStart() }))}
                        className="font-inter"
                      />
                    </div>
                    <div>
                      <Label>प्रकार</Label>
                      <Select value={filters.transactionType} onValueChange={(value) => setFilters(prev => ({ ...prev, transactionType: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="सर्व प्रकार" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">सर्व प्रकार</SelectItem>
                          <SelectItem value="cash_in">पैसे आले</SelectItem>
                          <SelectItem value="cash_out">पैसे दिले</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Clear all filters and reset dates to show full month
                        setFilters({ 
                          dateFrom: "2025-08-01", 
                          dateTo: getCurrentDate(), 
                          search: "", 
                          transactionType: "" 
                        });
                      }}
                    >
                      फिल्टर साफ करा (Ctrl+R)
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Add Transaction Buttons - Mobile Friendly */}
              <Card className="lg:hidden">
                <CardHeader>
                  <CardTitle>नवा व्यवहार जोडा</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      onClick={() => setShowCashIn(true)}
                      className="bg-green-600 hover:bg-green-700 text-white h-12 font-semibold"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      पैसे आले
                    </Button>
                    <Button 
                      onClick={() => setShowCashOut(true)}
                      className="bg-red-600 hover:bg-red-700 text-white h-12 font-semibold"
                    >
                      <Minus className="h-5 w-5 mr-2" />
                      पैसे दिले
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Transactions Table */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>व्यवहार</CardTitle>
                    {/* Desktop Add Transaction Buttons */}
                    <div className="hidden lg:flex gap-2">
                      <Button 
                        onClick={() => setShowCashIn(true)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        पैसे आले
                      </Button>
                      <Button 
                        onClick={() => setShowCashOut(true)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        size="sm"
                      >
                        <Minus className="h-4 w-4 mr-2" />
                        पैसे दिले
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="mt-2 text-gray-600">लोड हो रहा है...</p>
                    </div>
                  ) : transactionsList.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">कोणतेही व्यवहार आढळले नाहीत</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>दिनांक</TableHead>
                            <TableHead>प्रकार</TableHead>
                            <TableHead>व्यक्ती</TableHead>
                            <TableHead>तपशील</TableHead>
                            <TableHead className="min-w-[120px] !important text-center font-bold">रक्कम</TableHead>
                            <TableHead>नोट्स</TableHead>
                            <TableHead>कृती</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactionsList.map((transaction: any) => (
                            <TableRow key={transaction.id}>
                              <TableCell>
                                {DateUtils.isoToIndianDate(transaction.transactionDate)}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={transaction.transactionType === 'cash_in' ? 'default' : 'destructive'}
                                  className={transaction.transactionType === 'cash_in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                                >
                                  {transaction.transactionType === 'cash_in' ? 'पैसे आले' : 'पैसे दिले'}
                                </Badge>
                              </TableCell>
                              <TableCell>{transaction.party?.name || 'रोकड'}</TableCell>
                              <TableCell>
                                {transaction.category === 'capital' && 'भांडवल'}
                                {transaction.category === 'income' && 'उत्पन्न'}
                                {transaction.category === 'expense' && 'खर्च'}
                                {transaction.category === 'other' && 'इतर'}
                              </TableCell>
                              <TableCell className={`font-semibold text-lg ${
                                transaction.transactionType === 'cash_in' ? 'text-green-600' : 'text-red-600'
                              } whitespace-nowrap min-w-[120px] !important`} style={{ minWidth: '120px', display: 'table-cell !important' }}>
                                <span className="block font-bold text-base">
                                  {transaction.transactionType === 'cash_in' ? '+' : '-'}₹{Number(transaction.amount || 0).toLocaleString('en-IN')}
                                </span>
                                {/* DEBUG: Amount Value */}
                                <span className="text-xs text-gray-500 block">
                                  Amount: {transaction.amount}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {transaction.narration}
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditTransaction(transaction)}
                                    title="संपादित करा"
                                  >
                                    <Edit className="h-4 w-4 text-indigo-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(transaction.id, transaction.transactionType, transaction.amount)}
                                    disabled={deleteMutation.isPending}
                                    title="हटवा"
                                  >
                                    {deleteMutation.isPending ? (
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
                                    ) : (
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Dialogs for Add Transaction */}
      <CashInDialog 
        open={showCashIn} 
        onOpenChange={setShowCashIn} 
      />
      
      <CashOutDialog 
        open={showCashOut} 
        onOpenChange={setShowCashOut} 
      />

      {/* Edit Transaction Dialog */}
      <EditCashTransactionDialog
        transaction={editTransaction}
        open={!!editTransaction}
        onOpenChange={(open) => !open && setEditTransaction(null)}
      />
    </div>
  );
}