import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, Trash2, Filter, Download, TrendingUp, TrendingDown, Home, Plus, Minus, ArrowRightLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DateUtils } from "@/lib/date-utils";
import { displayNarration } from "@/lib/utils";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import CashInDialog from "@/components/cash-in-dialog";
import CashOutDialog from "@/components/cash-out-dialog";
import EditCashTransactionDialog from "@/components/edit-cash-transaction-dialog";
import PartySelector from "@/components/party-selector";
import { useRealTimeSync } from "@/hooks/use-real-time-sync";

export default function CashTransactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const { safeNavigate, isNavigating } = useSafeNavigation();
  const [showCashIn, setShowCashIn] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [editTransaction, setEditTransaction] = useState<any>(null);
  
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromPartyId: "",
    toPartyId: "",
    amount: "",
    narration: "",
    category: "transfer",
  });
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);

  const { triggerCompleteSync } = useRealTimeSync({
    enabled: true,
    onSyncComplete: (operation) => {
      console.log(`💰 CASH TRANSACTIONS: Real-time sync completed for ${operation}`);
    }
  });

  const getCurrentDate = () => new Date().toISOString().split('T')[0];
  
  const [searchDisplayText, setSearchDisplayText] = useState("");
  const [monthsBack, setMonthsBack] = useState("");
  const [filters, setFilters] = useState({
    dateFrom: "2025-08-01",
    dateTo: getCurrentDate(),
    search: "",
    transactionType: "",
  });

  const normalizeMarathiVowels = (text: string): string => {
    return text
      .replace(/ी/g, 'ि')
      .replace(/ू/g, 'ु')
      .replace(/ै/g, 'े')
      .replace(/ौ/g, 'ो')
      .replace(/ॅ/g, 'े')
      .replace(/ॉ/g, 'ो')
      .replace(/आ/g, 'अ')
      .replace(/ई/g, 'इ')
      .replace(/ऊ/g, 'उ')
      .replace(/ऐ/g, 'ए')
      .replace(/औ/g, 'ओ');
  };

  const createDualLanguageQuery = (originalQuery: string) => {
    const englishToMarathi: Record<string, string> = {
      'ram': 'राम', 'shyam': 'श्याम', 'geeta': 'गीता', 'seeta': 'सीता',
      'vijay': 'विजय', 'ajay': 'अजय', 'sanjay': 'संजय', 'prakash': 'प्रकाश',
      'sunil': 'सुनील', 'anil': 'अनिल', 'vinod': 'विनोद', 'manoj': 'मनोज',
      'raju': 'राजू', 'babu': 'बाबू', 'sir': 'सर', 'ji': 'जी',
      'patel': 'पाटील', 'patil': 'पाटील', 'kumar': 'कुमार', 'devi': 'देवी',
      'laxmi': 'लक्ष्मी', 'ganga': 'गंगा', 'saraswati': 'सरस्वती',
      'rajkumar': 'राजकुमार', 'rajat': 'राजत', 'more': 'मोरे', 'umesh': 'उमेश'
    };
    
    const marathiToEnglish: Record<string, string> = {
      'राम': 'ram', 'श्याम': 'shyam', 'गीता': 'geeta', 'सीता': 'seeta',
      'विजय': 'vijay', 'अजय': 'ajay', 'संजय': 'sanjay', 'प्रकाश': 'prakash',
      'सुनील': 'sunil', 'अनिल': 'anil', 'विनोद': 'vinod', 'मनोज': 'manoj',
      'राजू': 'raju', 'बाबू': 'babu', 'सर': 'sir', 'जी': 'ji',
      'पाटील': 'patel', 'कुमार': 'kumar', 'देवी': 'devi',
      'लक्ष्मी': 'laxmi', 'गंगा': 'ganga', 'सरस्वती': 'saraswati',
      'राजकुमार': 'rajkumar', 'राजत': 'rajat', 'मोरे': 'more', 'उमेश': 'umesh'
    };
    
    const queries = [originalQuery];
    
    Object.keys(englishToMarathi).forEach(english => {
      if (originalQuery.toLowerCase().includes(english)) {
        queries.push(originalQuery.replace(new RegExp(english, 'gi'), englishToMarathi[english]));
      }
    });
    
    Object.keys(marathiToEnglish).forEach(marathi => {
      if (originalQuery.includes(marathi)) {
        queries.push(originalQuery.replace(new RegExp(marathi, 'g'), marathiToEnglish[marathi]));
      }
    });
    
    return queries;
  };
  
  const performCrossLanguageSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return searchTerm;
    
    const searchQueries = createDualLanguageQuery(trimmed);
    const normalizedVariant = normalizeMarathiVowels(trimmed);
    if (normalizedVariant !== trimmed && !searchQueries.includes(normalizedVariant)) {
      searchQueries.push(normalizedVariant);
    }
    
    return searchQueries.join(' ');
  };

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

  const transferMutation = useMutation({
    mutationFn: (data: any) => {
      return apiRequest("/api/cash-transactions/transfer", "POST", {
        ...data,
        transactionDate: transferDate,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/closing"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"], refetchType: 'all' });
      setIsTransferOpen(false);
      setTransferForm({ fromPartyId: "", toPartyId: "", amount: "", narration: "", category: "transfer" });
      toast({ title: "यशस्वी!", description: "खाते ट्रान्सफर नोंद झाली" });
    },
    onError: (error: any) => {
      toast({
        title: "त्रुटी!",
        description: error?.message || "ट्रान्सफर अयशस्वी",
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const partyFilter = document.querySelector('[role="combobox"]') as HTMLElement;
        partyFilter?.click();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        const dateFrom = document.getElementById('dateFrom') as HTMLInputElement;
        dateFrom?.focus();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 't') {
        event.preventDefault();
        const dateTo = document.getElementById('dateTo') as HTMLInputElement;
        dateTo?.focus();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        setFilters({ 
          dateFrom: "2025-08-01", 
          dateTo: getCurrentDate(), 
          search: "", 
          transactionType: "" 
        });
        setSearchDisplayText("");
        setMonthsBack("");
        toast({
          title: "फिल्टर साफ केले!",
          description: "सर्व फिल्टर रीसेट झाले आहेत आणि पूर्ण महिना दाखवण्यासाठी सेट केले",
        });
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
        event.preventDefault();
        return;
      }

      if (event.key === 'Escape') {
        setFilters({ 
          dateFrom: "", 
          dateTo: "", 
          search: "", 
          transactionType: "" 
        });
        setSearchDisplayText("");
        setMonthsBack("");
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toast]);

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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Filter className="h-5 w-5 mr-2" />
                    फिल्टर
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                      <Label>सर्च (मराठी/English)</Label>
                      <Input
                        placeholder="नाव, रक्कम किंवा तपशील शोधा..."
                        value={searchDisplayText}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setSearchDisplayText(newValue);
                          const enhancedSearchTerm = performCrossLanguageSearch(newValue);
                          setFilters(prev => ({ ...prev, search: enhancedSearchTerm }));
                        }}
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
                          <SelectItem value="transfer">ट्रान्सफर</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>किती महिने मागे</Label>
                      <Input
                        type="number"
                        placeholder="3, 6, 12, 24"
                        value={monthsBack}
                        onChange={(e) => {
                          const months = e.target.value;
                          setMonthsBack(months);
                          if (months && !isNaN(parseInt(months))) {
                            const today = new Date();
                            const monthsAgo = new Date(today);
                            monthsAgo.setMonth(today.getMonth() - parseInt(months));
                            const fromDate = monthsAgo.toISOString().split('T')[0];
                            const toDate = today.toISOString().split('T')[0];
                            setFilters(prev => ({ ...prev, dateFrom: fromDate, dateTo: toDate }));
                          } else {
                            setFilters(prev => ({ ...prev, dateFrom: "2025-08-01", dateTo: getCurrentDate() }));
                          }
                        }}
                        className="font-inter"
                      />
                      {monthsBack && !isNaN(parseInt(monthsBack)) && (
                        <div className="mt-1 p-1.5 bg-indigo-50 rounded border border-indigo-100">
                          <p className="text-xs text-indigo-700 text-center font-medium">
                            श्रेणी: {(() => {
                              const today = new Date();
                              const monthsAgo = new Date(today);
                              monthsAgo.setMonth(today.getMonth() - parseInt(monthsBack));
                              const fromDisplay = `${monthsAgo.getDate().toString().padStart(2, '0')}/${(monthsAgo.getMonth() + 1).toString().padStart(2, '0')}/${monthsAgo.getFullYear().toString().slice(-2)}`;
                              const toDisplay = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear().toString().slice(-2)}`;
                              return `${fromDisplay} ते ${toDisplay}`;
                            })()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFilters({ 
                          dateFrom: "2025-08-01", 
                          dateTo: getCurrentDate(), 
                          search: "", 
                          transactionType: "" 
                        });
                        setSearchDisplayText("");
                        setMonthsBack("");
                      }}
                    >
                      फिल्टर साफ करा (Ctrl+R)
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:hidden">
                <CardHeader>
                  <CardTitle>नवा व्यवहार जोडा</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <Button 
                      onClick={() => setShowCashIn(true)}
                      className="bg-green-600 hover:bg-green-700 text-white h-12 font-semibold"
                    >
                      <Plus className="h-5 w-5 mr-1" />
                      पैसे आले
                    </Button>
                    <Button 
                      onClick={() => setShowCashOut(true)}
                      className="bg-red-600 hover:bg-red-700 text-white h-12 font-semibold"
                    >
                      <Minus className="h-5 w-5 mr-1" />
                      पैसे दिले
                    </Button>
                    <Button 
                      onClick={() => {
                        setTransferForm({ fromPartyId: "", toPartyId: "", amount: "", narration: "", category: "transfer" });
                        setTransferDate(getCurrentDate());
                        setIsTransferOpen(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white h-12 font-semibold"
                    >
                      <ArrowRightLeft className="h-5 w-5 mr-1" />
                      ट्रान्सफर
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>व्यवहार</CardTitle>
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
                      <Button 
                        onClick={() => {
                          setTransferForm({ fromPartyId: "", toPartyId: "", amount: "", narration: "", category: "transfer" });
                          setTransferDate(getCurrentDate());
                          setIsTransferOpen(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        size="sm"
                      >
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        ट्रान्सफर
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
                          <TableRow className="md:bg-indigo-700">
                            <TableHead className="md:text-white md:py-3">दिनांक</TableHead>
                            <TableHead className="md:text-white md:py-3">प्रकार</TableHead>
                            <TableHead className="md:text-white md:py-3">व्यक्ती</TableHead>
                            <TableHead className="md:text-white md:py-3">तपशील</TableHead>
                            <TableHead className="min-w-[120px] !important text-center font-bold md:text-white md:py-3">रक्कम</TableHead>
                            <TableHead className="md:text-white md:py-3">नोट्स</TableHead>
                            <TableHead className="md:text-white md:py-3">कृती</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactionsList.map((transaction: any) => {
                            const isTransferTransaction = transaction.category === 'transfer';
                            return (
                            <TableRow key={transaction.id}>
                              <TableCell className="md:px-4 md:py-3 md:text-base">
                                {DateUtils.isoToIndianDate(transaction.transactionDate)}
                              </TableCell>
                              <TableCell className="md:px-4 md:py-3">
                                {isTransferTransaction ? (
                                  <Badge className="bg-indigo-100 text-indigo-800">
                                    खाते ट्रान्सफर
                                  </Badge>
                                ) : (
                                  <Badge 
                                    variant={transaction.transactionType === 'cash_in' ? 'default' : 'destructive'}
                                    className={transaction.transactionType === 'cash_in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                                  >
                                    {transaction.transactionType === 'cash_in' ? 'पैसे आले' : 'पैसे दिले'}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="md:px-4 md:py-3 md:text-base">{transaction.party?.name || 'रोकड'}</TableCell>
                              <TableCell className="md:px-4 md:py-3 md:text-base">
                                {transaction.category === 'transfer' && 'खाते ट्रान्सफर'}
                                {transaction.category === 'capital' && 'भांडवल'}
                                {transaction.category === 'income' && 'उत्पन्न'}
                                {transaction.category === 'expense' && 'खर्च'}
                                {transaction.category === 'other' && 'इतर'}
                              </TableCell>
                              <TableCell className={`font-semibold text-lg ${
                                isTransferTransaction ? 'text-indigo-600' : transaction.transactionType === 'cash_in' ? 'text-green-600' : 'text-red-600'
                              } whitespace-nowrap min-w-[120px] !important`} style={{ minWidth: '120px', display: 'table-cell !important' }}>
                                <span className="block font-bold text-base">
                                  {isTransferTransaction ? '' : transaction.transactionType === 'cash_in' ? '+' : '-'}₹{Number(transaction.amount || 0).toLocaleString('en-IN')}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-xs truncate md:px-4 md:py-3 md:text-base">
                                {displayNarration(transaction.narration)}
                              </TableCell>
                              <TableCell className="md:px-4 md:py-3">
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
                          )})}
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

      <CashInDialog 
        open={showCashIn} 
        onOpenChange={setShowCashIn} 
      />
      
      <CashOutDialog 
        open={showCashOut} 
        onOpenChange={setShowCashOut} 
      />

      <EditCashTransactionDialog
        transaction={editTransaction}
        open={!!editTransaction}
        onOpenChange={(open) => !open && setEditTransaction(null)}
      />

      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent
          className="sm:max-w-md max-h-[85vh] overflow-y-auto"
          aria-describedby="transfer-description"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-indigo-600">
              खाते ट्रान्सफर
            </DialogTitle>
          </DialogHeader>
          <div id="transfer-description" className="sr-only">
            Account to account transfer form
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">तारीख</Label>
              <Input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="mt-2 h-10 text-sm font-inter"
                style={{ colorScheme: 'light' }}
              />
            </div>

            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <Label className="text-sm font-semibold text-green-700">कोणाकडून (Source)</Label>
              <div className="mt-2">
                <PartySelector
                  value={transferForm.fromPartyId || undefined}
                  onValueChange={(value) => setTransferForm(prev => ({ ...prev, fromPartyId: value || "" }))}
                  placeholder="Source पार्टी निवडा"
                />
              </div>
            </div>

            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <Label className="text-sm font-semibold text-red-700">कोणाला (Destination)</Label>
              <div className="mt-2">
                <PartySelector
                  value={transferForm.toPartyId || undefined}
                  onValueChange={(value) => setTransferForm(prev => ({ ...prev, toPartyId: value || "" }))}
                  placeholder="Destination पार्टी निवडा"
                />
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">रक्कम *</Label>
              <Input
                type="number"
                placeholder="₹ 0"
                step="any"
                value={transferForm.amount}
                onChange={(e) => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                className="mt-2 text-lg font-bold text-center h-10"
              />
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">तपशील *</Label>
              <Input
                placeholder="ट्रान्सफरचा तपशील लिहा..."
                value={transferForm.narration}
                onChange={(e) => setTransferForm(prev => ({ ...prev, narration: e.target.value }))}
                className="mt-2 h-10"
              />
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">प्रकार</Label>
              <Select
                value={transferForm.category}
                onValueChange={(value) => setTransferForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="mt-2 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">ट्रान्सफर</SelectItem>
                  <SelectItem value="capital">भांडवल</SelectItem>
                  <SelectItem value="income">उत्पन्न</SelectItem>
                  <SelectItem value="expense">खर्च</SelectItem>
                  <SelectItem value="other">इतर</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200 text-xs text-indigo-700">
              कॅशबुक balance बदलणार नाही — दोन्ही parties च्या ledger मध्ये entry दिसेल
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsTransferOpen(false)}
                className="h-10"
              >
                रद्द
              </Button>
              <Button
                onClick={() => {
                  if (!transferForm.fromPartyId || transferForm.fromPartyId === 'none') {
                    toast({ title: "त्रुटी", description: "Source पार्टी निवडा", variant: "destructive" });
                    return;
                  }
                  if (!transferForm.toPartyId || transferForm.toPartyId === 'none') {
                    toast({ title: "त्रुटी", description: "Destination पार्टी निवडा", variant: "destructive" });
                    return;
                  }
                  if (transferForm.fromPartyId === transferForm.toPartyId) {
                    toast({ title: "त्रुटी", description: "Source आणि Destination पार्टी वेगवेगळ्या हव्यात", variant: "destructive" });
                    return;
                  }
                  const amt = Number(transferForm.amount);
                  if (!transferForm.amount || isNaN(amt) || amt <= 0) {
                    toast({ title: "त्रुटी", description: "योग्य रक्कम भरा", variant: "destructive" });
                    return;
                  }
                  if (!transferForm.narration.trim()) {
                    toast({ title: "त्रुटी", description: "तपशील आवश्यक आहे", variant: "destructive" });
                    return;
                  }
                  transferMutation.mutate(transferForm);
                }}
                disabled={transferMutation.isPending}
                className="bg-indigo-500 hover:bg-indigo-600 h-10"
              >
                {transferMutation.isPending ? "जतन होत आहे..." : "ट्रान्सफर करा"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
