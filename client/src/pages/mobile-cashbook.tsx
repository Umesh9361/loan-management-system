import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Search, Edit, Edit2, Trash2, Home, User, RefreshCw, X, ArrowDown } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DateUtils } from "@/lib/date-utils";
import { displayNarration } from "@/lib/utils";
import { MobileNav } from "@/components/ui/mobile-nav";
import PartySelector from "@/components/party-selector";
import { useRealTimeSync } from "@/hooks/use-real-time-sync";



function MobileCashbook() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  
  // 🚀 REAL-TIME SYNC: Enable automatic updates for all loan operations
  const { triggerCompleteSync, isEnabled: syncEnabled } = useRealTimeSync({
    enabled: true,
    onSyncComplete: (operation) => {
      // console.log(`📱 MOBILE CASHBOOK: Real-time sync completed for ${operation}`);
    },
    onSyncError: (error) => {
      // console.error('📱 MOBILE CASHBOOK: Real-time sync error:', error);
    }
  });
  // Default Marathi interface with dual language search support
  
  // Date and period management - Set today by default with UTC to avoid timezone issues
  const [currentDate, setCurrentDate] = useState(() => {
    // CRITICAL FIX: Use ISO string method to create today's date without timezone corruption
    const todayStr = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD
    const today = new Date(todayStr + 'T00:00:00.000Z'); // Create UTC date
    return today;
  });
  const [viewPeriod, setViewPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [viewMode, setViewMode] = useState<'cashbook' | 'journal'>('cashbook');
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickEntryType, setQuickEntryType] = useState<'cash_in' | 'cash_out'>('cash_in');
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [quickEntryDate, setQuickEntryDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromPartyId: "",
    toPartyId: "",
    amount: "",
    narration: "",
    category: "transfer",
  });
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Search functionality
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Balance accuracy check for UI display
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];
  const [customDateRange, setCustomDateRange] = useState({
    startDate: todayStr,
    endDate: todayStr
  });
  const [searchDisplayText, setSearchDisplayText] = useState("");
  const [searchFilters, setSearchFilters] = useState({
    search: "",
    amount: "",
    dateFrom: "",
    dateTo: "",
    transactionType: "",
    monthsBack: ""
  });

  // Convert DD/MM/YY to YYYY-MM-DD format
  const convertDateFormat = (dateStr: string): string => {
    if (!dateStr || dateStr.length === 0) return '';
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Handle DD/MM/YY format
    const ddmmyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
    const match = dateStr.match(ddmmyyPattern);
    
    if (match) {
      let [, day, month, year] = match;
      
      // Pad day and month with leading zeros
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');
      
      // Convert 2-digit year to 4-digit year
      if (year.length === 2) {
        const currentYear = new Date().getFullYear();
        const currentCentury = Math.floor(currentYear / 100) * 100;
        year = `${currentCentury + parseInt(year)}`;
      }
      
      return `${year}-${month}-${day}`;
    }
    
    // If invalid format, return empty string to avoid errors
    return '';
  };

  // Quick entry form
  const [quickEntryForm, setQuickEntryForm] = useState({
    amount: "",
    narration: "",
    partyId: null as string | null, // null for single entry, UUID for dual entry
    category: "capital",
  });
  
  // Dual entry toggle for mobile quick entry
  // Removed dual entry state - using direct party selection instead

  const getDateRange = () => {
    const dateStr = currentDate.toISOString().split('T')[0];
    const [y, m, d] = dateStr.split('-').map(Number);

    switch (viewPeriod) {
      case 'daily':
        return { from: dateStr, to: dateStr };
      case 'weekly': {
        const ref = new Date(Date.UTC(y, m - 1, d));
        const dow = ref.getUTCDay();
        const startD = new Date(Date.UTC(y, m - 1, d - dow));
        const endD = new Date(Date.UTC(y, m - 1, d - dow + 6));
        return {
          from: startD.toISOString().split('T')[0],
          to: endD.toISOString().split('T')[0]
        };
      }
      case 'monthly': {
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
        return {
          from: `${y}-${String(m).padStart(2, '0')}-01`,
          to: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        };
      }
      case 'yearly':
        return {
          from: `${y}-01-01`,
          to: `${y}-12-31`
        };
      default:
        return { from: dateStr, to: dateStr };
    }
  };

  // Get opening balance date based on period
  const getOpeningBalanceDate = () => {
    // CRITICAL: For custom date range, return one day before the start date
    const startDateStr = (searchFilters.dateFrom && searchFilters.dateTo)
      ? searchFilters.dateFrom
      : getDateRange().from;
    const [y, m, d] = startDateStr.split('-').map(Number);
    const prevDay = new Date(Date.UTC(y, m - 1, d - 1));
    return prevDay.toISOString().split('T')[0];
  };

  const dateRange = getDateRange();

  // CRITICAL FIX: Remove React Query and use direct state management
  const [rawTransactions, setRawTransactions] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
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

  // Enhanced Cross-Language Search Support - Same as All Other Forms
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
    
    // Add English-to-Marathi translations
    Object.keys(englishToMarathi).forEach(english => {
      if (originalQuery.toLowerCase().includes(english)) {
        queries.push(originalQuery.replace(new RegExp(english, 'gi'), englishToMarathi[english]));
      }
    });
    
    // Add Marathi-to-English translations
    Object.keys(marathiToEnglish).forEach(marathi => {
      if (originalQuery.includes(marathi)) {
        queries.push(originalQuery.replace(new RegExp(marathi, 'g'), marathiToEnglish[marathi]));
      }
    });
    
    return queries;
  };
  
  const performCrossLanguageSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      return searchTerm;
    }
    
    const searchQueries = createDualLanguageQuery(trimmed);
    
    const normalizedVariant = normalizeMarathiVowels(trimmed);
    if (normalizedVariant !== trimmed && !searchQueries.includes(normalizedVariant)) {
      searchQueries.push(normalizedVariant);
    }
    
    const combinedSearch = searchQueries.join(' ');
    
    return combinedSearch;
  };
  
  const buildFetchParams = React.useCallback(() => {
    const params = new URLSearchParams();
    const dateRange = getDateRange();
    const fromDate = searchFilters.dateFrom || dateRange.from;
    const toDate = searchFilters.dateTo || dateRange.to;
    params.append('dateFrom', fromDate);
    params.append('dateTo', toDate);
    params.append('includeAll', 'true');
    if (searchFilters.search) params.append('search', searchFilters.search);
    if (searchFilters.amount) params.append('amount', searchFilters.amount);
    if (searchFilters.transactionType) params.append('transactionType', searchFilters.transactionType);
    return params;
  }, [viewPeriod, currentDate, searchFilters]);

  React.useEffect(() => {
    const controller = new AbortController();
    let latestRequestId = 0;

    const fetchTransactions = async () => {
      const requestId = ++latestRequestId;
      try {
        setIsLoading(true);
        const params = buildFetchParams();
        params.append('_t', Date.now().toString());

        const response = await fetch(`/api/cash-transactions?${params}`, {
          credentials: 'include',
          cache: 'no-cache',
          signal: controller.signal
        });

        if (!response.ok) {
          if (response.status === 401) return;
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!controller.signal.aborted && requestId === latestRequestId && Array.isArray(data)) {
          setRawTransactions(data);
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.error('Fetch error:', error);
          if (!controller.signal.aborted && requestId === latestRequestId) setRawTransactions([]);
        }
      } finally {
        if (!controller.signal.aborted && requestId === latestRequestId) setIsLoading(false);
      }
    };

    fetchTransactions();

    const interval = setInterval(async () => {
      if (controller.signal.aborted) return;
      const requestId = ++latestRequestId;
      try {
        const params = buildFetchParams();
        params.append('_refresh', Date.now().toString());
        const res = await fetch(`/api/cash-transactions?${params}`, {
          credentials: 'include',
          cache: 'no-cache',
          signal: controller.signal
        });
        const data = await res.json();
        if (!controller.signal.aborted && requestId === latestRequestId && Array.isArray(data)) {
          setRawTransactions(data);
        }
      } catch (_) {}
    }, 30000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [buildFetchParams]);

  // DIRECT PROCESSING: Simple transaction processing
  const transactions = Array.isArray(rawTransactions) ? rawTransactions : [];
  
  // Transaction processing completed

  const isCustomRange = !!(searchFilters.dateFrom && searchFilters.dateTo);
  const useDaily = viewPeriod === 'daily' && !isCustomRange;

  // Daily Balance API - only for daily view without custom date range
  const { data: dailyBalanceData } = useQuery({
    queryKey: ["/api/mobile-cashbook/daily-balance", currentDate.toISOString().split('T')[0], viewPeriod, isCustomRange],
    queryFn: async () => {
      const response = await fetch(`/api/mobile-cashbook/daily-balance?date=${currentDate.toISOString().split('T')[0]}`, {
        credentials: 'include',
        cache: 'no-cache'
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: useDaily,
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Universal Balance API - for weekly/monthly/yearly AND custom date range (regardless of viewPeriod)
  const { data: universalBalanceData } = useQuery({
    queryKey: ["/api/mobile-cashbook/balance", getDateRange(), viewPeriod, searchFilters.dateFrom, searchFilters.dateTo, isCustomRange],
    queryFn: async () => {
      const dateRange = getDateRange();
      const startDate = searchFilters.dateFrom || dateRange.from;
      const endDate = searchFilters.dateTo || dateRange.to;

      const params = new URLSearchParams({
        startDate,
        endDate,
        viewPeriod: isCustomRange ? 'custom' : viewPeriod,
        _t: Date.now().toString()
      });

      const response = await fetch(`/api/mobile-cashbook/balance?${params}`, {
        credentials: 'include',
        cache: 'no-cache'
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !useDaily,
    staleTime: 0,
    refetchInterval: 5000,
  });

  // OPTIMIZED Parties fetch with aggressive caching
  const { data: parties } = useQuery({
    queryKey: ["/api/parties"],
    staleTime: 10 * 60 * 1000, // 10 minutes - parties rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes memory retention
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch journal entries for dual-entry view with proper error handling and real-time updates
  const { data: journalEntries, isLoading: journalLoading } = useQuery({
    queryKey: ["/api/journal-entries", currentDate.toISOString().split('T')[0], viewPeriod, searchFilters, "realtime"],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        
        // Always use the actual date range for the current date and period
        const actualDateRange = getDateRange();
        const fromDate = searchFilters.dateFrom || actualDateRange.from;
        const toDate = searchFilters.dateTo || actualDateRange.to;
        
        params.append('dateFrom', fromDate);
        params.append('dateTo', toDate);
        params.append('sourceType', 'cash_transaction');
        
        const response = await fetch(`/api/journal-entries?${params}`, { credentials: 'include' });
        if (!response.ok) {
          // Return empty array instead of throwing error
          return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn('Journal entries fetch failed:', error);
        return []; // Return empty array as fallback
      }
    },
    enabled: viewMode === 'journal',
    retry: false, // Don't retry on failure
    staleTime: 0, // Always fetch fresh data for real-time updates
    gcTime: 0, // Don't cache old data
  });

  // Fallback opening balance query (only used when primary APIs haven't loaded yet)
  const { data: openingBalance } = useQuery({
    queryKey: ["/api/cash-balance/opening", currentDate.toISOString().split('T')[0], viewPeriod, searchFilters.dateFrom, searchFilters.dateTo],
    queryFn: async () => {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      const openingBalanceDate = getOpeningBalanceDate();
      
      const response = await fetch(`/api/cash-balance?date=${openingBalanceDate}`, 
        { credentials: 'include' });
      const result = await response.json();
      
      return {
        ...result,
        openingBalance: result.closingBalance,
        cached: false
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes aggressive caching
    gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    networkMode: 'online', // Only fetch when online
  });

  // Create transaction mutation with automatic dual entry support
  const createMutation = useMutation({
    mutationFn: (data: any) => {
      return apiRequest("/api/cash-transactions", "POST", {
        ...data,
        transactionDate: quickEntryDate,
        transactionType: quickEntryType,
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook/daily-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook/balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/closing"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
      
      const currentDateStr = currentDate.toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening", currentDateStr, viewPeriod], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance", currentDateStr, viewPeriod], refetchType: 'all' });
      
      setIsQuickEntryOpen(false);
      setQuickEntryForm({ amount: "", narration: "", partyId: null, category: "capital" });
      
      const response = result as any;
      const isDualEntry = quickEntryForm.partyId !== null;
      const description = isDualEntry 
        ? `${quickEntryType === 'cash_in' ? 'रोकड आलेली' : 'रोकड दिलेली'} नोंद झाली - व्यक्तीसह dual entry`
        : `${quickEntryType === 'cash_in' ? 'रोकड आलेली' : 'रोकड दिलेली'} साधी नोंद झाली`;
      
      toast({
        title: "यशस्वी!",
        description: description,
      });
    },
    onError: (error: any) => {
      console.error('MOBILE QUICK ENTRY ERROR:', error);
      toast({
        title: "त्रुटी!",
        description: error?.message === "Not authenticated" ? "कृपया पुन्हा लॉगिन करा" : `व्यवहार नोंदवता आला नाही: ${error?.message || 'Unknown error'}`,
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
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook/daily-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook/balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
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


  // Update transaction mutation with comprehensive real-time synchronization
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest(`/api/cash-transactions/${id}`, "PUT", data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook/daily-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook/balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/closing"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance"], refetchType: 'all' });
      
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      toast({
        title: "यशस्वी अपडेट",
        description: "व्यवहार अपडेट केला",
      });
    },
  });

  // Enhanced delete mutation with dual entry support
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const result = await apiRequest("/api/cash-transactions/" + id, "DELETE");
        return result;
      } catch (error) {
        console.error('DELETE REQUEST FAILED:', {
          transactionId: id,
          error,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    onSuccess: async (result, id) => {
      const deletedTransaction = transactions?.find(t => t.id === id);
      const isDualEntry = deletedTransaction?.partyId && deletedTransaction?.partyId !== 'cash';
      
      await queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook/daily-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook/balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/closing"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance"], refetchType: 'all' }); 
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"], refetchType: 'all' }); 
      queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"], refetchType: 'all' });
      
      // Close edit dialog if transaction was being edited
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      
      // Show appropriate success message
      const description = isDualEntry 
        ? "दोन्ही नोंदी डिलीट झाल्या - रोकड व व्यक्ती दोन्ही अकाउंट मधून"
        : "व्यवहार डिलीट केला";
      
      toast({
        title: "यशस्वी डिलीट!",
        description: description,
      });
    },
    onError: (error: any) => {
      console.error('MOBILE CASHBOOK DELETE ERROR:', {
        error,
        errorMessage: error?.message,
        errorStatus: error?.status,
        fullError: JSON.stringify(error)
      });
      
      let errorMessage = "व्यवहार डिलीट करताना समस्या आली. पुन्हा प्रयत्न करा.";
      
      if (error?.message === "Not authenticated") {
        errorMessage = "कृपया पुन्हा लॉगिन करा";
      } else if (error?.message === "Transaction not found") {
        errorMessage = "व्यवहार सापडला नाही";
      } else if (error?.status === 500) {
        errorMessage = "सर्व्हर एरर - पुन्हा प्रयत्न करा";
      }
      
      toast({
        title: "डिलीट एरर!",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Enhanced dual entry delete handler (like cash-transactions.tsx)
  const handleSmartDelete = (transaction: any) => {
    const isDualEntry = transaction?.partyId && transaction?.partyId !== 'cash';
    const partyName = partiesList?.find(p => p.id === transaction?.partyId)?.name || 'व्यक्ती';
    const amountText = transaction?.amount ? `₹${Number(transaction.amount).toLocaleString('en-IN')}` : '';
    const typeText = transaction?.transactionType === 'cash_in' ? 'पैसे आले' : 'पैसे दिले';
    
    if (isDualEntry) {
      // Enhanced dual entry confirmation with party name (like cash-transactions.tsx)
      if (window.confirm(
        `हा व्यवहार हटवायचा आहे का?\n` +
        `${typeText} - ${amountText}\n` +
        `पार्टी: ${partyName}\n\n` +
        `सावधान: द्विनोंदणी journal entries भी हटतील!\n` +
        `दोन्ही बाजूंना एंट्री डिलीट होते:\n` +
        `• रोकड अकाउंट मधून\n` +
        `• ${partyName} अकाउंट मधून`
      )) {
        deleteMutation.mutate(transaction.id);
      }
    } else {
      // Simple single entry confirmation
      if (window.confirm(
        `हा व्यवहार हटवायचा आहे का?\n` +
        `${typeText} - ${amountText}\n\n` +
        `तपशील: ${displayNarration(transaction.narration)}`
      )) {
        deleteMutation.mutate(transaction.id);
      }
    }
  };

  // Navigate dates with accurate balance calculation and fixed timezone handling
  const navigateDate = (direction: 'prev' | 'next') => {
    // CRITICAL FIX: Use ISO string method to create proper navigation
    const currentDateStr = currentDate.toISOString().split('T')[0];
    const [year, month, day] = currentDateStr.split('-').map(Number);
    
    let newDate: Date;
    switch (viewPeriod) {
      case 'daily':
        newDate = new Date(Date.UTC(year, month - 1, day + (direction === 'next' ? 1 : -1)));
        break;
      case 'weekly':
        newDate = new Date(Date.UTC(year, month - 1, day + (direction === 'next' ? 7 : -7)));
        break;
      case 'monthly':
        newDate = new Date(Date.UTC(year, month - 1 + (direction === 'next' ? 1 : -1), day));
        break;
      case 'yearly':
        newDate = new Date(Date.UTC(year + (direction === 'next' ? 1 : -1), month - 1, day));
        break;
      default:
        newDate = new Date(Date.UTC(year, month - 1, day));
    }
    setCurrentDate(newDate);
    
    // CRITICAL: Clear search filters to show entries for new date
    setSearchDisplayText("");
    setSearchFilters({
      search: "",
      amount: "",
      dateFrom: "",
      dateTo: "",
      transactionType: "",
      monthsBack: ""
    });
    
    // Professional accounting: Force complete balance recalculation for new date
    queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/closing"] });
    queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance"] }); // New comprehensive balance
    queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
    
    // Invalidate date-specific opening balance queries with period dependency
    const finalDateStr = newDate.toISOString().split('T')[0];
    queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening", finalDateStr, viewPeriod] });
    queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance", finalDateStr, viewPeriod] });
    
    // Immediate refresh for accurate opening/closing balance
    setTimeout(() => {
      queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.refetchQueries({ queryKey: ["/api/cash-balance/opening", finalDateStr, viewPeriod] });
      queryClient.refetchQueries({ queryKey: ["/api/date-wise-balance", finalDateStr, viewPeriod] });
    }, 100);
  };

  // Handle quick entry submit
  const handleQuickEntry = () => {
    if (!quickEntryForm.amount || !quickEntryForm.narration) {
      toast({
        title: "त्रुटी",
        description: "रक्कम आणि तपशील आवश्यक आहेत",
        variant: "destructive",
      });
      return;
    }

    const numAmount = Number(quickEntryForm.amount);
    if (isNaN(numAmount) || numAmount === 0) {
      toast({
        title: "त्रुटी",
        description: "रक्कम शून्य असू शकत नाही",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      ...quickEntryForm,
      amount: Math.abs(numAmount).toString(),
    });
  };

  // Handle transaction edit with loan integration check
  const handleEditTransaction = (transaction: any) => {
    // Check if this is a loan-related transaction (disabled for editing)
    if (transaction.category === 'loan_disbursement' || transaction.category === 'loan_closure') {
      toast({
        title: "कर्ज व्यवहार संरक्षित",
        description: "कर्ज संबंधित entries फक्त त्यांच्या संबंधित फॉर्ममधून संपादित करू शकता.",
        variant: "default",
      });
      return;
    }

    // Check if this is a system-generated transaction that should remain read-only
    if (transaction.isSystemGenerated || transaction.readonly) {
      toast({
        title: "सिस्टम नोंद संरक्षित",
        description: "ही entry system generated आहे आणि modify करता येत नाही. फक्त manual entries modify करू शकता.",
        variant: "default",
      });
      return;
    }

    setEditingTransaction(transaction);
    setIsEditDialogOpen(true);
  };

  // Handle transaction delete with dual entry support
  const handleDeleteTransaction = (transaction: any) => {
    if (transaction.category === 'loan_disbursement' || transaction.category === 'loan_closure') {
      toast({
        title: "कर्ज व्यवहार संरक्षित", 
        description: "कर्ज संबंधित entries फक्त loan form मधून delete करू शकता.",
        variant: "default",
      });
      return;
    }

    // Use the enhanced smart delete handler
    handleSmartDelete(transaction);
  };

  // UNIFIED SYSTEM: Single source processing without deduplication
  const transactionsList = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    
    // Enhanced processing for each transaction
    return transactions.map(transaction => {
      return {
        ...transaction,
        // Enhanced account number display for manual entries
        displayAccountNumber: transaction.accountNumber || 
          (transaction.party?.accountNumber) || 
          "मॅन्युअल एंट्री",
        
        // Enhanced collateral details display
        displayCollateral: transaction.collateralDetails || 
          transaction.itemDetails || 
          transaction.description || 
          "तपशील उपलब्ध नाही"
      };
    });
  }, [transactions]);
  const partiesList = useMemo(() => Array.isArray(parties) ? parties : [], [parties]);
  
  // MEMOIZED totals calculation - Only recalculate when transactions change
  const totals = useMemo(() => {
    return transactionsList.reduce(
      (acc, t) => {
        const amount = Number(t.amount);
        const isLoan = t.category === 'loan_disbursement' || t.category === 'loan_closure' || t.category === 'loan_repayment';
        

        
        if (t.transactionType === 'cash_in') {
          acc.cashIn += amount;
          if (isLoan) acc.loanIn += amount;
        } else {
          acc.cashOut += amount;
          if (isLoan) acc.loanOut += amount;
        }
        return acc;
      },
      { cashIn: 0, cashOut: 0, loanIn: 0, loanOut: 0 }
    );
  }, [transactionsList]);

  // Simplified balance calculation: useDaily → dailyBalanceData, else → universalBalanceData
  const correctOpeningBalance = useMemo(() => {
    if (useDaily && dailyBalanceData) {
      return dailyBalanceData.openingBalance;
    }
    if (!useDaily && universalBalanceData) {
      return universalBalanceData.openingBalance;
    }
    return openingBalance?.openingBalance || 0;
  }, [useDaily, dailyBalanceData, universalBalanceData, openingBalance]);

  const periodBalance = useMemo(() => {
    if (useDaily && dailyBalanceData) {
      return dailyBalanceData.closingBalance;
    }
    if (!useDaily && universalBalanceData) {
      return universalBalanceData.closingBalance;
    }
    return correctOpeningBalance + totals.cashIn - totals.cashOut;
  }, [useDaily, dailyBalanceData, universalBalanceData, correctOpeningBalance, totals]);

  // MEMOIZED loan transaction count
  const loanTransactionCount = useMemo(() => 
    transactionsList.filter(t => t.category === 'loan_disbursement' || t.category === 'loan_closure' || t.category === 'loan_repayment').length,
    [transactionsList]
  );

  // B3 FIX: Pre-computed running balances O(n) instead of O(n²)
  const runningBalances = useMemo(() => {
    let balance = correctOpeningBalance;
    return transactionsList.map(t => {
      balance += (t.transactionType === 'cash_in' ? Number(t.amount) : -Number(t.amount));
      return balance;
    });
  }, [transactionsList, correctOpeningBalance]);

  // Format date for display in DD/MM/YY format - FIXED: Manual formatting to prevent timezone issues
  const formatDisplayDate = () => {
    // Helper function to manually format date without timezone issues
    const manualFormatDate = (date: Date) => {
      const isoStr = date.toISOString().split('T')[0];
      const [yr, mo, dy] = isoStr.split('-');
      return `${dy}/${mo}/${yr}`;
    };
    
    if (searchFilters.dateFrom && searchFilters.dateTo) {
      return `${manualFormatDate(new Date(searchFilters.dateFrom + 'T00:00:00Z'))} - ${manualFormatDate(new Date(searchFilters.dateTo + 'T00:00:00Z'))}`;
    }
    
    const range = getDateRange();
    switch (viewPeriod) {
      case 'daily':
        return manualFormatDate(currentDate);
      case 'weekly':
        return `${manualFormatDate(new Date(range.from + 'T00:00:00Z'))} - ${manualFormatDate(new Date(range.to + 'T00:00:00Z'))}`;
      case 'monthly': {
        const [yr, mo] = currentDate.toISOString().split('T')[0].split('-');
        return `${mo}/${yr.slice(-2)}`;
      }
      case 'yearly':
        return `${currentDate.toISOString().split('T')[0].split('-')[0]}`;
    }
  };

  return (
    <div className="mobile-cashbook min-h-screen bg-gray-50">
      <MobileNav />
      
      <div className="pb-40 max-w-md mx-auto lg:max-w-lg">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-gray-800 hover:bg-gray-100 w-10 h-10">
                <Home className="h-5 w-5" />
              </Button>
            </Link>
            
            <h1 className="text-lg font-semibold text-gray-800">रोखवही</h1>
            
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                className="text-gray-800 hover:bg-gray-100 w-10 h-10"
                onClick={async () => {
                  queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance"] });

                  setIsLoading(true);
                  try {
                    const params = buildFetchParams();
                    params.append('_t', Date.now().toString());
                    const response = await fetch(`/api/cash-transactions?${params}`, {
                      credentials: 'include',
                      cache: 'no-cache'
                    });
                    if (response.ok) {
                      const data = await response.json();
                      if (Array.isArray(data)) setRawTransactions(data);
                    }
                  } catch (_) {}
                  setIsLoading(false);

                  queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
                  queryClient.refetchQueries({ queryKey: ["/api/mobile-cashbook"] });
                  toast({
                    title: "डेटा रिफ्रेश झाला",
                    description: "सर्व डेटा पुन्हा लोड केला",
                  });
                }}
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              
              <button
                onClick={() => {
                  const newSearchOpen = !isSearchOpen;
                  setIsSearchOpen(newSearchOpen);
                  if (!newSearchOpen) {
                    setViewPeriod('daily');
                    setSearchDisplayText("");
                    setSearchFilters({ search: "", amount: "", dateFrom: "", dateTo: "", transactionType: "", monthsBack: "" });
                  } else {
                    setTimeout(() => {
                      const searchPanel = document.querySelector('[data-search-panel]');
                      if (searchPanel) {
                        searchPanel.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                      }
                    }, 100);
                  }
                }}
                style={{
                  width: 40, height: 40,
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isSearchOpen ? '#e0e7ff' : 'transparent',
                  color: isSearchOpen ? '#4f46e5' : '#1f2937',
                  transition: 'background-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { if (!isSearchOpen) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6'; }}
                onMouseLeave={e => { if (!isSearchOpen) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
              >
                <Search style={{ width: 20, height: 20 }} />
              </button>
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setViewMode('cashbook')}
              className={`flex-1 py-2 text-sm font-medium rounded-full transition-all ${
                viewMode === 'cashbook' 
                  ? 'bg-indigo-500 text-white shadow-sm' 
                  : 'text-gray-600'
              }`}
            >
              रोखवही
            </button>
            <button
              onClick={() => setViewMode('journal')}
              className={`flex-1 py-2 text-sm font-medium rounded-full transition-all ${
                viewMode === 'journal' 
                  ? 'bg-indigo-500 text-white shadow-sm' 
                  : 'text-gray-600'
              }`}
            >
              द्विनोंदणी
            </button>
          </div>
        </div>

        {/* Period Tabs */}
        <div className="px-4 pb-2">
          <div className="flex gap-1.5 overflow-x-auto">
            {['daily', 'weekly', 'monthly', 'yearly'].map((period) => (
              <button
                key={period}
                onClick={() => {
                  setIsDateRangeOpen(false);
                  setViewPeriod(period as any);
                  setSearchDisplayText("");
                  setSearchFilters({ search: "", amount: "", dateFrom: "", dateTo: "", transactionType: "", monthsBack: "" });
                  const currentDateStr = currentDate.toISOString().split('T')[0];
                  queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening", currentDateStr, period] });
                  queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance", currentDateStr, period] });
                  queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
                  queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
                }}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  (viewPeriod === period && !(searchFilters.dateFrom && searchFilters.dateTo) && !isDateRangeOpen)
                    ? 'bg-indigo-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {period === 'daily' && 'दैनिक'}
                {period === 'weekly' && 'साप्ताहिक'}
                {period === 'monthly' && 'मासिक'}
                {period === 'yearly' && 'वार्षिक'}
              </button>
            ))}
            <button
              onClick={() => setIsDateRangeOpen(!isDateRangeOpen)}
              className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                (isDateRangeOpen || (searchFilters.dateFrom && searchFilters.dateTo)) 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              कस्टम
            </button>
          </div>
        </div>

        {/* Custom Date Range Dialog */}
        {isDateRangeOpen && (
          <div className="custom-date-range mx-3 mb-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100">
              <span className="text-gray-700 font-medium text-xs">तारीख निवडा</span>
              <button onClick={() => setIsDateRangeOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="px-3 py-2.5 flex items-center gap-2">
              <div className="flex-1 space-y-0.5">
                <label className="text-[10px] font-medium text-gray-400">पासून</label>
                <Input
                  type="date"
                  value={customDateRange.startDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="font-inter text-gray-800 h-9 text-sm border-gray-200 rounded-md"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <span className="text-gray-300 text-xs mt-3">—</span>
              <div className="flex-1 space-y-0.5">
                <label className="text-[10px] font-medium text-gray-400">पर्यंत</label>
                <Input
                  type="date"
                  value={customDateRange.endDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="font-inter text-gray-800 h-9 text-sm border-gray-200 rounded-md"
                  style={{ colorScheme: 'light' }}
                />
              </div>
            </div>
            <div className="px-3 pb-2.5 flex gap-2">
              <Button
                onClick={() => setIsDateRangeOpen(false)}
                variant="outline"
                className="flex-1 h-8 rounded-md border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-medium"
              >
                रद्द करा
              </Button>
              <Button
                onClick={() => {
                  if (customDateRange.startDate && customDateRange.endDate) {
                    if (customDateRange.startDate > customDateRange.endDate) {
                      toast({
                        title: "त्रुटी",
                        description: "सुरुवात तारीख शेवट तारखेपेक्षा मोठी असू शकत नाही",
                        variant: "destructive",
                      });
                      return;
                    }
                    setSearchFilters(prev => ({
                      ...prev,
                      dateFrom: customDateRange.startDate,
                      dateTo: customDateRange.endDate
                    }));
                    setIsDateRangeOpen(false);
                    queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
                  }
                }}
                disabled={!customDateRange.startDate || !customDateRange.endDate}
                className="flex-1 h-8 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium"
              >
                शोधा
              </Button>
            </div>
          </div>
        )}

        {/* Date Navigation */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 mx-3 mb-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateDate('prev')}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:bg-gray-300"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <div className="text-center flex-1 px-3">
              <div className="text-base font-semibold text-gray-800 mb-1">{formatDisplayDate()}</div>
              <div className="mb-2">
                <Input
                  type="date"
                  value={currentDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const selectedDateString = e.target.value;
                    if (!selectedDateString) return;
                    const newDate = new Date(selectedDateString + 'T00:00:00.000Z');
                    setCurrentDate(newDate);
                    setSearchDisplayText("");
                    setSearchFilters({ search: "", amount: "", dateFrom: "", dateTo: "", transactionType: "", monthsBack: "" });
                    const newDateStr = newDate.toISOString().split('T')[0];
                    queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance", newDateStr, viewPeriod] });
                  }}
                  className="text-center text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-inter"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <div className={`text-sm font-medium ${correctOpeningBalance < 0 ? 'text-red-600' : 'text-indigo-600'}`}>
                आरंभिक शिल्लक: {correctOpeningBalance < 0 ? `-₹${Math.abs(correctOpeningBalance).toLocaleString('en-IN')}` : `₹${correctOpeningBalance.toLocaleString('en-IN')}`}
              </div>
            </div>
            
            <button
              onClick={() => navigateDate('next')}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:bg-gray-300"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search Panel */}
        {isSearchOpen && (
          <div className="bg-white border border-gray-200 rounded-lg mx-3 mb-3" data-search-panel>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="w-4 h-4 text-gray-600" />
                </div>
                <h3 className="text-base font-medium text-gray-800">व्यवहार शोधा</h3>
              </div>
              
              <div className="space-y-2">
                <Input
                  placeholder="नाव, रक्कम किंवा तपशील शोधा..."
                  value={searchDisplayText}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setSearchDisplayText(newValue);
                    const enhancedSearchTerm = performCrossLanguageSearch(newValue);
                    setSearchFilters(prev => ({ ...prev, search: enhancedSearchTerm, amount: "" }));
                  }}
                  className="h-11 px-4 text-base bg-gray-50 border-gray-200 rounded-lg focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                  data-testid="input-unified-search"
                />
                <p className="text-xs text-gray-500">
                  उदा: उमेश, 50000, नेकलेस
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">व्यवहार प्रकार</label>
                <select
                  value={searchFilters.transactionType}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, transactionType: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                  autoComplete="off"
                >
                  <option value="">सर्व व्यवहार</option>
                  <option value="cash_in">पैसे आले (जमा)</option>
                  <option value="cash_out">पैसे दिले (नावे)</option>
                </select>
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">तारीख श्रेणी</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-600">किती महिने मागे:</span>
                  </div>
                  <input
                    type="number"
                    autoComplete="off"
                    value={searchFilters.monthsBack}
                    onChange={(e) => {
                      const months = e.target.value;
                      setSearchFilters(prev => ({ ...prev, monthsBack: months }));
                      if (months && !isNaN(parseInt(months))) {
                        const today = new Date();
                        const monthsAgo = new Date(today);
                        monthsAgo.setMonth(today.getMonth() - parseInt(months));
                        const fromDate = monthsAgo.toISOString().split('T')[0];
                        const toDate = today.toISOString().split('T')[0];
                        setSearchFilters(prev => ({ ...prev, dateFrom: fromDate, dateTo: toDate }));
                      } else {
                        setSearchFilters(prev => ({ ...prev, dateFrom: '', dateTo: '' }));
                      }
                    }}
                    placeholder="3, 6, 12, 24"
                    className="w-full h-10 px-3 text-center text-base bg-white border border-gray-200 rounded-md focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                    data-testid="input-months-back"
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    महिने संख्या टाका
                  </p>
                  {searchFilters.monthsBack && !isNaN(parseInt(searchFilters.monthsBack)) && (
                    <div className="mt-2 p-2 bg-indigo-50 rounded-md border border-indigo-100">
                      <p className="text-xs text-indigo-700 text-center font-medium">
                        श्रेणी: {(() => {
                          const today = new Date();
                          const monthsAgo = new Date(today);
                          monthsAgo.setMonth(today.getMonth() - parseInt(searchFilters.monthsBack));
                          const fromDisplay = `${monthsAgo.getDate().toString().padStart(2, '0')}/${(monthsAgo.getMonth() + 1).toString().padStart(2, '0')}/${monthsAgo.getFullYear().toString().slice(-2)}`;
                          const toDisplay = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear().toString().slice(-2)}`;
                          return `${fromDisplay} ते ${toDisplay}`;
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full h-10 text-gray-600 border-gray-200 hover:bg-gray-50"
                onClick={() => { setSearchDisplayText(""); setSearchFilters({ search: "", amount: "", dateFrom: "", dateTo: "", transactionType: "", monthsBack: "" }); }}
              >
                सर्व फिल्टर साफ करा
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="px-3">
          {viewMode === 'cashbook' ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Table Header */}
              <div className="bg-gray-100 text-gray-700 p-3 grid gap-1 font-semibold sticky top-0 z-10" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                <div className="text-xs">तारीख</div>
                <div className="text-center text-green-700 text-sm font-bold">जमा</div>
                <div className="text-center text-red-700 text-sm font-bold">नावे</div>
              </div>
            
              {/* Opening Balance Row */}
              <div className="p-3 border-b border-gray-200 bg-indigo-50">
                <div className="grid gap-1 text-sm" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                  <div className="text-xs font-medium text-indigo-700">
                    आरंभिक शिल्लक
                    <div className="text-xs text-gray-500 mt-0.5">
                      {(() => {
                        if (searchFilters.dateFrom && searchFilters.dateTo) {
                          return '(कस्टम कालावधी)';
                        } else if (viewPeriod === 'weekly') {
                          return '(मागील आठवडा)';
                        } else if (viewPeriod === 'monthly') {
                          return '(मागील महिना)';
                        } else if (viewPeriod === 'yearly') {
                          return '(मागील वर्ष)';
                        } else {
                          return '(मागील दिवस)';
                        }
                      })()}
                    </div>
                  </div>
                  <div></div>
                  <div></div>
                </div>
                <div className={`text-right text-xs mt-1 ${correctOpeningBalance < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  शिल्लक {correctOpeningBalance < 0 ? `-₹${Math.abs(correctOpeningBalance).toLocaleString('en-IN')}` : `₹${correctOpeningBalance.toLocaleString('en-IN')}`}
                </div>
              </div>

              {/* Transaction Rows */}
              {isLoading && transactionsList.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                  <p className="mt-2 text-gray-500 text-sm">लोड होत आहे...</p>
                </div>
              ) : !isLoading && transactionsList.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">या कालावधीत कोणतेही व्यवहार नाहीत</div>
              ) : (
                transactionsList.map((transaction: any, index: number) => {
                  const runningBalance = runningBalances[index] ?? correctOpeningBalance;

                  const isLoanTransaction = transaction.category === 'loan_disbursement' || 
                                          transaction.category === 'loan_closure' || 
                                          transaction.category === 'loan_repayment';
                  const isTransferTransaction = transaction.category === 'transfer';

                  return (
                    <div
                      key={transaction.id}
                      className={`p-3 ${
                        isLoanTransaction 
                          ? 'bg-amber-50 border-b border-amber-100' 
                          : isTransferTransaction
                          ? 'bg-indigo-50 border-b border-indigo-100'
                          : 'bg-white border-b border-gray-100'
                      }`}
                    >
                      <div className="grid gap-2 text-sm" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                        <div className="space-y-1 min-w-0">
                          <div className="text-xs font-medium text-gray-600">
                            {DateUtils.isoToShortDate(transaction.transactionDate)}
                          </div>
                          <div className="text-sm font-medium text-gray-800 break-words">
                            {transaction.party?.name || 'रोकड'}
                            {transaction.displayAccountNumber && transaction.displayAccountNumber !== "मॅन्युअल एंट्री" && (
                              <span className="ml-1 text-xs bg-indigo-50 text-indigo-700 px-1 rounded">
                                खाते क्र. {transaction.displayAccountNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 leading-tight break-words">
                            {displayNarration(transaction.narration)}
                            {transaction.displayCollateral && transaction.displayCollateral !== "तपशील उपलब्ध नाही" && (
                              <div className="mt-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                वस्तू: {transaction.displayCollateral}
                              </div>
                            )}
                          </div>
                          {isLoanTransaction ? (
                            <div className="bg-amber-100 text-amber-700 rounded px-2 py-0.5 text-xs font-medium inline-block">
                              {transaction.category === 'loan_disbursement' ? 'कर्ज वाटप' : 'कर्ज बंद'}
                            </div>
                          ) : isTransferTransaction ? (
                            <div className="space-y-1">
                              <div className="bg-indigo-100 text-indigo-700 rounded px-2 py-0.5 text-xs font-medium inline-block">
                                खाते ट्रान्सफर
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditTransaction(transaction)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 bg-indigo-50 rounded-md active:bg-indigo-100"
                                >
                                  <Edit2 className="h-3 w-3" /> बदला
                                </button>
                                <button
                                  onClick={() => handleDeleteTransaction(transaction)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 rounded-md active:bg-red-100"
                                >
                                  <Trash2 className="h-3 w-3" /> हटवा
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2 mt-1">
                              <button
                                onClick={() => handleEditTransaction(transaction)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 bg-indigo-50 rounded-md active:bg-indigo-100"
                              >
                                <Edit2 className="h-3 w-3" /> बदला
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(transaction)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 rounded-md active:bg-red-100"
                              >
                                <Trash2 className="h-3 w-3" /> हटवा
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-center self-center">
                          {transaction.transactionType === 'cash_in' ? (
                            <div className="text-green-700 font-bold text-base">
                              ₹{Number(transaction.amount).toLocaleString('en-IN')}
                            </div>
                          ) : (
                            <div></div>
                          )}
                        </div>
                        
                        <div className="text-center self-center">
                          {transaction.transactionType === 'cash_out' ? (
                            <div className="text-red-700 font-bold text-base">
                              ₹{Number(transaction.amount).toLocaleString('en-IN')}
                            </div>
                          ) : (
                            <div></div>
                          )}
                        </div>
                      </div>
                      <div className={`text-right text-xs whitespace-nowrap ${runningBalance < 0 ? 'text-red-500' : 'text-green-600'}`}>
                        शिल्लक {runningBalance < 0 ? `-₹${Math.abs(runningBalance).toLocaleString('en-IN')}` : `₹${runningBalance.toLocaleString('en-IN')}`}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Journal Header — U4 FIX: 3-column mobile-friendly layout */}
              <div className="bg-gray-100 text-gray-700 p-3 grid gap-1 text-xs font-semibold sticky top-0 z-10" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                <div>खाते तपशील</div>
                <div className="text-center text-green-600">नावे (Dr)</div>
                <div className="text-center text-red-600">जमा (Cr)</div>
              </div>

              {journalLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                  <p className="mt-2 text-gray-500 text-sm">द्विनोंदणी लोड होत आहे...</p>
                </div>
              ) : !journalEntries || journalEntries.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">या काळात कोणतेही जर्नल entries नाहीत</div>
              ) : (
                journalEntries.map((entry: any) => (
                  <div key={entry.id} className="border-b border-gray-200">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                      <div className="flex justify-between items-center">
                        <div className="font-medium text-xs text-gray-800">
                          #{entry.journalNumber}
                        </div>
                        <div className="text-xs text-gray-500">
                          {DateUtils.isoToShortDate(entry.transactionDate)}
                        </div>
                      </div>
                      {entry.narration && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{displayNarration(entry.narration)}</div>
                      )}
                    </div>
                    
                    {entry.entries?.filter((e: any) => e.type === 'debit').map((debitEntry: any, idx: number) => (
                      <div key={`debit-${idx}`} className="px-3 py-2 grid gap-1 text-sm border-b border-gray-50" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                        <div className="text-xs font-medium text-gray-800 truncate">
                          {debitEntry.accountName}
                        </div>
                        <div className="text-center">
                          <span className="bg-green-50 text-green-700 rounded px-1.5 py-0.5 text-xs font-semibold border border-green-200">
                            ₹{Number(debitEntry.amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div></div>
                      </div>
                    ))}
                    
                    {entry.entries?.filter((e: any) => e.type === 'credit').map((creditEntry: any, idx: number) => (
                      <div key={`credit-${idx}`} className="px-3 py-2 grid gap-1 text-sm border-b border-gray-50" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                        <div className="text-xs font-medium text-gray-800 pl-3 truncate">
                          ↳ {creditEntry.accountName}
                        </div>
                        <div></div>
                        <div className="text-center">
                          <span className="bg-red-50 text-red-700 rounded px-1.5 py-0.5 text-xs font-semibold border border-red-200">
                            ₹{Number(creditEntry.amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Summary Card */}
        <div className="px-3 py-3">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4">
              <h3 className="text-base font-semibold text-gray-800 text-center mb-1">सारांश</h3>
              <div className="text-xs text-gray-500 text-center mb-4">{formatDisplayDate()}</div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-green-600 font-medium">जमा</div>
                  <div className="font-semibold text-green-600 text-sm mt-1">₹{totals.cashIn.toLocaleString('en-IN')}</div>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="text-xs text-red-600 font-medium">नावे</div>
                  <div className="font-semibold text-red-600 text-sm mt-1">₹{totals.cashOut.toLocaleString('en-IN')}</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">आरंभिक शिल्लक:</span>
                  <span className={`font-medium ${correctOpeningBalance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {correctOpeningBalance < 0 ? `-₹${Math.abs(correctOpeningBalance).toLocaleString('en-IN')}` : `₹${correctOpeningBalance.toLocaleString('en-IN')}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">निव्वळ फरक:</span>
                  <span className={`font-medium ${(totals.cashIn - totals.cashOut) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(totals.cashIn - totals.cashOut) < 0 
                      ? `-₹${Math.abs(totals.cashIn - totals.cashOut).toLocaleString('en-IN')}` 
                      : `₹${(totals.cashIn - totals.cashOut).toLocaleString('en-IN')}`}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-800">अंतिम शिल्लक:</span>
                    <span className={`font-bold text-lg ${periodBalance >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                      {periodBalance < 0 ? `-₹${Math.abs(periodBalance).toLocaleString('en-IN')}` : `₹${periodBalance.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="fixed bottom-[72px] left-0 right-0 lg:left-1/2 lg:-translate-x-1/2 lg:max-w-lg lg:w-full bg-white border-t border-gray-200 p-3 grid grid-cols-3 gap-2 shadow-sm z-40">
        <Button 
          className="bg-green-500 hover:bg-green-600 text-white h-12 rounded-lg font-medium text-sm"
          onClick={() => {
            setQuickEntryType('cash_in');
            setQuickEntryForm({ amount: "", narration: "", partyId: null, category: "capital" });
            setQuickEntryDate(currentDate.toISOString().split('T')[0]);
            setIsQuickEntryOpen(true);
          }}
        >
          पैसे आले
        </Button>
        <Button 
          className="bg-indigo-500 hover:bg-indigo-600 text-white h-12 rounded-lg font-medium text-sm"
          onClick={() => {
            setTransferForm({ fromPartyId: "", toPartyId: "", amount: "", narration: "", category: "transfer" });
            setTransferDate(currentDate.toISOString().split('T')[0]);
            setIsTransferOpen(true);
          }}
        >
          ट्रान्सफर
        </Button>
        <Button 
          className="bg-red-500 hover:bg-red-600 text-white h-12 rounded-lg font-medium text-sm"
          onClick={() => {
            setQuickEntryType('cash_out');
            setQuickEntryForm({ amount: "", narration: "", partyId: null, category: "capital" });
            setQuickEntryDate(currentDate.toISOString().split('T')[0]);
            setIsQuickEntryOpen(true);
          }}
        >
          पैसे दिले
        </Button>
      </div>

      {/* Quick Entry Dialog */}
      <Dialog open={isQuickEntryOpen} onOpenChange={setIsQuickEntryOpen}>
        <DialogContent
          className="sm:max-w-md mx-4 max-h-[85vh] overflow-y-auto"
          aria-describedby="quick-entry-description"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className={`text-center text-xl font-bold ${
              quickEntryType === 'cash_in' ? 'text-green-600' : 'text-red-600'
            }`}>
              {quickEntryType === 'cash_in' ? 'पैसे आले' : 'पैसे दिले'}
            </DialogTitle>
          </DialogHeader>
          <div id="quick-entry-description" className="sr-only">
            Quick cash transaction entry form
          </div>
          
          <div className="space-y-5">
            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">
                तारीख
              </Label>
              <Input
                type="date"
                value={quickEntryDate}
                onChange={(e) => setQuickEntryDate(e.target.value)}
                className="mt-2 h-10 text-sm font-inter"
                style={{ colorScheme: 'light' }}
              />
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">
                रक्कम *
              </Label>
              <Input
                type="number"
                placeholder="₹ 0"
                step="any"
                value={quickEntryForm.amount}
                onChange={(e) => setQuickEntryForm(prev => ({ ...prev, amount: e.target.value }))}
                className="mt-2 text-lg font-bold text-center h-10"
              />
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">
                तपशील *
              </Label>
              <Input
                placeholder="व्यवहाराचा तपशील लिहा..."
                value={quickEntryForm.narration}
                onChange={(e) => setQuickEntryForm(prev => ({ ...prev, narration: e.target.value }))}
                className="mt-2 h-10"
              />
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">
                व्यक्ती (पर्यायी - dual entry साठी)
              </Label>
              <div className="mt-2">
                <PartySelector
                  value={quickEntryForm.partyId || undefined}
                  onValueChange={(value) => setQuickEntryForm(prev => ({ ...prev, partyId: value || null }))}
                  placeholder="व्यक्ती निवडा"
                />
              </div>
              <div className="mt-2 text-xs text-indigo-600">
                व्यक्ती निवडल्यास automatic dual entry होईल
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">प्रकार</Label>
              <Select 
                value={quickEntryForm.category} 
                onValueChange={(value) => setQuickEntryForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="mt-2 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="capital">भांडवल</SelectItem>
                  <SelectItem value="income">उत्पन्न</SelectItem>
                  <SelectItem value="expense">खर्च</SelectItem>
                  <SelectItem value="other">इतर</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-3">
              <Button 
                variant="outline"
                onClick={() => setIsQuickEntryOpen(false)}
                className="h-10"
              >
                रद्द
              </Button>
              <Button 
                onClick={() => {
                  if (!quickEntryForm.amount || !quickEntryForm.narration) {
                    toast({
                      title: "त्रुटी",
                      description: "कृपया सर्व आवश्यक माहिती भरा",
                      variant: "destructive",
                    });
                    return;
                  }
                  handleQuickEntry();
                }}
                disabled={createMutation.isPending}
                className="bg-indigo-500 hover:bg-indigo-600 h-10"
              >
                {createMutation.isPending ? "जतन होत आहे..." : "जतन करा"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Account Transfer Dialog */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent
          className="sm:max-w-md mx-4 max-h-[85vh] overflow-y-auto"
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

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent
          className="sm:max-w-md mx-4 max-h-[85vh] overflow-y-auto"
          aria-describedby="edit-transaction-mobile-description"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-gray-800">
              व्यवहार संपादित करा
            </DialogTitle>
          </DialogHeader>
          <div id="edit-transaction-mobile-description" className="sr-only">
            Edit transaction form for mobile cashbook
          </div>
          
          {editingTransaction && (
            <div className="space-y-5">
              {editingTransaction.category === 'transfer' && (
                <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg text-sm text-indigo-700">
                  <div className="font-semibold">खाते ट्रान्सफर entry</div>
                  <div className="text-xs mt-1">
                    {editingTransaction.transactionType === 'cash_in' ? 'Source (कोणाकडून)' : 'Destination (कोणाला)'} — रक्कम/तपशील/तारीख बदलल्यास दोन्ही entries अपडेट होतील
                  </div>
                </div>
              )}
              <div className="bg-gray-50 p-4 rounded-lg">
                <Label className="text-sm font-semibold text-gray-800">तारीख</Label>
                <Input
                  type="date"
                  value={editingTransaction.transactionDate}
                  onChange={(e) => setEditingTransaction((prev: any) => ({ ...prev, transactionDate: e.target.value }))}
                  className="mt-2 h-12 text-sm font-inter"
                  style={{ colorScheme: 'light' }}
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <Label className="text-sm font-semibold text-gray-800">रक्कम</Label>
                <Input
                  type="number"
                  step="any"
                  value={editingTransaction.amount}
                  onChange={(e) => setEditingTransaction((prev: any) => ({ ...prev, amount: e.target.value }))}
                  className="mt-2 text-xl font-bold text-center h-12"
                />
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <Label className="text-sm font-semibold text-gray-800">तपशील</Label>
                <Input
                  value={editingTransaction.narration}
                  onChange={(e) => setEditingTransaction((prev: any) => ({ ...prev, narration: e.target.value }))}
                  className="mt-2 h-12"
                />
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <Label className="text-sm font-semibold text-gray-800">
                  व्यक्ती {editingTransaction?.partyId && editingTransaction?.partyId !== 'cash' ? '(द्विनोंदणी)' : '(पर्यायी)'}
                </Label>
                <div className="mt-2">
                  <PartySelector
                    value={editingTransaction.partyId && editingTransaction.partyId !== 'cash' ? editingTransaction.partyId : undefined}
                    onValueChange={(value) => setEditingTransaction((prev: any) => ({ ...prev, partyId: value || null }))}
                    placeholder="व्यक्ती निवडा"
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  व्यक्ती निवडल्यास / बदलल्यास dual entry अपडेट होईल
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 pt-4">
                <Button 
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="h-12"
                >
                  रद्द
                </Button>
                
                <Button 
                  onClick={() => {
                    const editAmount = Number(editingTransaction.amount);
                    if (isNaN(editAmount) || editAmount === 0) {
                      toast({
                        title: "त्रुटी",
                        description: "रक्कम शून्य असू शकत नाही",
                        variant: "destructive",
                      });
                      return;
                    }
                    updateMutation.mutate({
                      id: editingTransaction.id,
                      data: {
                        amount: editingTransaction.amount,
                        narration: editingTransaction.narration,
                        partyId: editingTransaction.partyId,
                        transactionDate: editingTransaction.transactionDate,
                      }
                    });
                  }}
                  disabled={updateMutation.isPending}
                  className="bg-indigo-500 hover:bg-indigo-600 h-12"
                >
                  {updateMutation.isPending ? "..." : "अपडेट"}
                </Button>
                
                <Button 
                  variant="destructive"
                  onClick={() => handleDeleteTransaction(editingTransaction)}
                  disabled={deleteMutation.isPending}
                  className="h-12"
                >
                  {deleteMutation.isPending ? "..." : "हटवा"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Optimize with React.memo for better performance
export default React.memo(MobileCashbook);