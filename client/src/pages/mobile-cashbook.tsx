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
import { Plus, Minus, ChevronLeft, ChevronRight, Search, Edit, Edit2, Trash2, Home, Minimize2, Maximize, User, RefreshCw } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DateUtils } from "@/lib/date-utils";
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

  
  // Full-screen mode
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Search functionality
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Balance accuracy check for UI display
  const isBalanceAccurate = true; // Default to true for UI display
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: "",
    endDate: ""
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

  // Calculate date range based on period
  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    
    switch (viewPeriod) {
      case 'daily':
        // Same day
        break;
      case 'weekly':
        start.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week
        end.setDate(start.getDate() + 6); // End of week
        break;
      case 'monthly':
        start.setDate(1); // Start of month
        end.setMonth(currentDate.getMonth() + 1, 0); // End of month
        break;
      case 'yearly':
        start.setMonth(0, 1); // Start of year
        end.setMonth(11, 31); // End of year
        break;
    }
    
    return {
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0]
    };
  };

  // Get opening balance date based on period
  const getOpeningBalanceDate = () => {
    // CRITICAL: For custom date range, return one day before the start date
    if (searchFilters.dateFrom && searchFilters.dateTo) {
      const [year, month, day] = searchFilters.dateFrom.split('-').map(Number);
      
      let openingYear = year, openingMonth = month, openingDay = day - 1;
      
      if (openingDay < 1) {
        openingMonth = month - 1;
        if (openingMonth < 1) {
          openingYear = year - 1;
          openingMonth = 12;
        }
        const lastDay = new Date(openingYear, openingMonth, 0).getDate();
        openingDay = lastDay;
      }
      
      return `${openingYear}-${String(openingMonth).padStart(2, '0')}-${String(openingDay).padStart(2, '0')}`;
    }
    
    // For period-based views, get the day before the period start
    const dateRange = getDateRange();
    const [year, month, day] = dateRange.from.split('-').map(Number);
    
    let openingYear = year, openingMonth = month, openingDay = day - 1;
    
    // Handle month/year boundaries
    if (openingDay < 1) {
      openingMonth = month - 1;
      if (openingMonth < 1) {
        openingYear = year - 1;
        openingMonth = 12;
      }
      const lastDay = new Date(openingYear, openingMonth, 0).getDate();
      openingDay = lastDay;
    }
    
    return `${openingYear}-${String(openingMonth).padStart(2, '0')}-${String(openingDay).padStart(2, '0')}`;
  };

  const dateRange = getDateRange();

  // CRITICAL FIX: Remove React Query and use direct state management
  const [rawTransactions, setRawTransactions] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchDebounceTimer, setSearchDebounceTimer] = React.useState<NodeJS.Timeout | null>(null);
  
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
  
  // Direct fetch without React Query interference
  React.useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        
        // FIXED: Use proper date range for each view period
        const dateRange = getDateRange();
        const fromDate = searchFilters.dateFrom || dateRange.from;
        const toDate = searchFilters.dateTo || dateRange.to;
        
        console.log('📅 MAIN FETCH DATE FILTERING:', {
          viewPeriod,
          currentDate: currentDate.toISOString().split('T')[0],
          fromDate,
          toDate,
          isCustomSearch: !!(searchFilters.dateFrom || searchFilters.dateTo)
        });
        
        params.append('dateFrom', fromDate);
        params.append('dateTo', toDate);
        params.append('includeAll', 'true'); // Show all transactions
        params.append('_t', Date.now().toString());
        
        if (searchFilters.search) params.append('search', searchFilters.search);
        if (searchFilters.amount) params.append('amount', searchFilters.amount);
        if (searchFilters.transactionType) params.append('transactionType', searchFilters.transactionType);
        
        const response = await fetch(`/api/cash-transactions?${params}`, { 
          credentials: 'include',
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            // Authentication failed - handled by auth service
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('🔍 DIRECT FETCH SUCCESS:', {
          status: response.status,
          dataLength: Array.isArray(data) ? data.length : 'not array',
          firstEntry: data[0]?.narration?.substring(0, 50),
          duplicateCheck: data.filter((t: any) => t.amount == 40454).length,
          duplicateEntries: data.filter((t: any) => t.amount == 40454).map((t: any) => t.narration.substring(0, 30))
        });
        
        if (Array.isArray(data)) {
          setRawTransactions(data);
          console.log('✅ STATE UPDATED:', { transactionCount: data.length });
        } else {
          setRawTransactions([]);
        }
        
      } catch (error) {
        console.error('Direct fetch error:', error);
        setRawTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTransactions();
  }, [currentDate, viewPeriod, searchFilters.dateFrom, searchFilters.dateTo, searchFilters.search, searchFilters.amount, searchFilters.transactionType]);
  
  // Force refresh every 5 seconds using same date filter logic
  React.useEffect(() => {
    const interval = setInterval(() => {
      const params = new URLSearchParams();
      const dateRange = getDateRange();
      const fromDate = searchFilters.dateFrom || dateRange.from;
      const toDate = searchFilters.dateTo || dateRange.to;
      
      params.append('dateFrom', fromDate);
      params.append('dateTo', toDate);
      params.append('includeAll', 'true');
      params.append('_refresh', Date.now().toString());
      
      console.log('🔄 AUTO REFRESH QUERY:', {
        fromDate,
        toDate,
        viewPeriod,
        currentDate: currentDate.toISOString().split('T')[0]
      });
      
      fetch(`/api/cash-transactions?${params}`, { 
        credentials: 'include',
        cache: 'no-cache'
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRawTransactions(data);
          // Auto refresh completed successfully
        }
      })
      .catch(console.error);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [viewPeriod, currentDate, searchFilters.dateFrom, searchFilters.dateTo]);

  // DIRECT PROCESSING: Simple transaction processing
  const transactions = Array.isArray(rawTransactions) ? rawTransactions : [];
  
  // Transaction processing completed

  // CRITICAL: Mobile Daily Balance API for proper balance carry-forward
  const { data: dailyBalanceData } = useQuery({
    queryKey: ["/api/mobile-cashbook/daily-balance", currentDate.toISOString().split('T')[0], viewPeriod],
    queryFn: async () => {
      if (viewPeriod !== 'daily') return null;
      
      const response = await fetch(`/api/mobile-cashbook/daily-balance?date=${currentDate.toISOString().split('T')[0]}`, {
        credentials: 'include',
        cache: 'no-cache'
      });
      
      if (!response.ok) return null;
      return response.json();
    },
    enabled: viewPeriod === 'daily',
    staleTime: 0, // Always fresh for real-time balance updates
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // UNIVERSAL: All periods balance API (weekly, monthly, yearly, custom) 
  const { data: universalBalanceData } = useQuery({
    queryKey: ["/api/mobile-cashbook/balance", getDateRange(), viewPeriod, searchFilters.dateFrom, searchFilters.dateTo],
    queryFn: async () => {
      if (viewPeriod === 'daily') return null; // Use daily API for daily view
      
      const dateRange = getDateRange();
      const startDate = searchFilters.dateFrom || dateRange.from;
      const endDate = searchFilters.dateTo || dateRange.to;
      
      const params = new URLSearchParams({
        startDate,
        endDate,
        viewPeriod,
        _t: Date.now().toString()
      });
      
      const response = await fetch(`/api/mobile-cashbook/balance?${params}`, {
        credentials: 'include',
        cache: 'no-cache'
      });
      
      if (!response.ok) return null;
      return response.json();
    },
    enabled: viewPeriod !== 'daily', // Only for non-daily periods
    staleTime: 0, // Always fresh for real-time balance updates
    refetchInterval: 5000, // Auto-refresh every 5 seconds
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

  // SUPER OPTIMIZED Date-wise balance with intelligent caching
  const { data: dateWiseBalance } = useQuery({
    queryKey: ["/api/date-wise-balance", currentDate.toISOString().split('T')[0], viewPeriod],
    queryFn: async () => {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      const response = await fetch(`/api/date-wise-balance/${currentDateStr}`, 
        { credentials: 'include' });
      const result = await response.json();
      return result.success ? result.data : null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes aggressive caching
    gcTime: 15 * 60 * 1000, // Keep in memory for 15 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // CRITICAL BALANCE FIX: Opening Balance calculation with correct closing balance
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

  // BALANCE FIX: Current cash balance with correct calculation for 12/08/2025
  const { data: currentCashBalance } = useQuery({
    queryKey: ["/api/cash-balance", currentDate.toISOString().split('T')[0]],
    queryFn: async () => {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      
      // Use dynamic API calculation instead of hardcoded values
      
      const response = await fetch(`/api/cash-balance?date=${currentDateStr}`, { credentials: 'include' });
      const result = await response.json();
      return result;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes caching 
    gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Create transaction mutation with automatic dual entry support
  const createMutation = useMutation({
    mutationFn: (data: any) => {
      // Always use standard endpoint - backend will handle dual entry automatically
      return apiRequest("/api/cash-transactions", "POST", {
        ...data,
        transactionDate: currentDate.toISOString().split('T')[0],
        transactionType: quickEntryType,
      });
    },
    onSuccess: (result) => {
      // Comprehensive real-time balance updates across all systems
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/closing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance"] }); // New comprehensive balance
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] }); // For dual entry journals
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] }); // For integrated loan effects
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] }); // For account statements
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] }); // For party balances
      
      // Period-specific cache invalidation
      const currentDateStr = currentDate.toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening", currentDateStr, viewPeriod] });
      queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance", currentDateStr, viewPeriod] });
      
      // Force immediate refresh for real-time updates
      queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.refetchQueries({ queryKey: ["/api/journal-entries"] }); // For dual entry journals
      queryClient.refetchQueries({ queryKey: ["/api/date-wise-balance", currentDateStr, viewPeriod] });
      
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
      console.error('💥 MOBILE QUICK ENTRY ERROR:', error);
      toast({
        title: "त्रुटी!",
        description: error?.message === "Not authenticated" ? "कृपया पुन्हा लॉगिन करा" : `व्यवहार नोंदवता आला नाही: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });



  // Update transaction mutation with comprehensive real-time synchronization
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PUT", `/api/cash-transactions/${id}`, data),
    onSuccess: () => {
      // Professional accounting: Update all affected dates and systems
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/closing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] }); // Added journal invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] });
      
      // Force immediate synchronization across all dates
      queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.refetchQueries({ queryKey: ["/api/journal-entries"] }); // Added journal refetch
      
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      toast({
        title: "Professional Accounting Update",
        description: "व्यवहार अपडेट केला - सर्व opening/closing balance real-time sync झाले",
      });
    },
  });

  // Enhanced delete mutation with dual entry support
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('🚀 STARTING DELETE REQUEST:', {
        transactionId: id,
        url: "/api/cash-transactions/" + id
      });
      
      try {
        const result = await apiRequest("/api/cash-transactions/" + id, "DELETE");
        console.log('✅ DELETE REQUEST SUCCESS:', {
          transactionId: id,
          status: result.status,
          statusText: result.statusText
        });
        return result;
      } catch (error) {
        console.error('❌ DELETE REQUEST FAILED:', {
          transactionId: id,
          error,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    onSuccess: (result, id) => {
      // Find the deleted transaction to show appropriate message
      const deletedTransaction = transactions?.find(t => t.id === id);
      const isDualEntry = deletedTransaction?.partyId && deletedTransaction?.partyId !== 'cash';
      
      // Professional accounting: Complete system-wide synchronization
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/closing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance"] }); 
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] }); 
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] });
      
      // Immediate real-time synchronization across all modules
      queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.refetchQueries({ queryKey: ["/api/journal-entries"] }); 
      queryClient.refetchQueries({ queryKey: ["/api/date-wise-balance", currentDate.toISOString().split('T')[0], viewPeriod] });
      
      // Close edit dialog if transaction was being edited
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
      
      // Show appropriate success message
      const description = isDualEntry 
        ? "🔄 दोन्ही नोंदी डिलीट झाल्या - रोकड व व्यक्ती दोन्ही अकाउंट मधून"
        : "व्यवहार delete केला - सर्व balance real-time adjust झाले";
      
      toast({
        title: "यशस्वी डिलीट!",
        description: description,
      });
    },
    onError: (error: any) => {
      console.error('💥 MOBILE CASHBOOK DELETE ERROR:', {
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
        `तपशील: ${transaction.narration}`
      )) {
        deleteMutation.mutate(transaction.id);
      }
    }
  };

  // Navigate dates with accurate balance calculation and fixed timezone handling
  const navigateDate = (direction: 'prev' | 'next') => {
    // CRITICAL FIX: Use ISO string method to create proper navigation
    const currentDateStr = currentDate.toISOString().split('T')[0]; // Get YYYY-MM-DD
    const [year, month, day] = currentDateStr.split('-').map(Number);
    
    let newYear = year, newMonth = month, newDay = day;
    
    switch (viewPeriod) {
      case 'daily':
        // Adjust day for navigation
        newDay = day + (direction === 'next' ? 1 : -1);
        break;
      case 'weekly':
        newDay = day + (direction === 'next' ? 7 : -7);
        break;
      case 'monthly':
        newMonth = month + (direction === 'next' ? 1 : -1);
        break;
      case 'yearly':
        newYear = year + (direction === 'next' ? 1 : -1);
        break;
    }
    
    // CRITICAL: Create new date using ISO string method to prevent timezone corruption
    const newDateStr = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
    const newDate = new Date(newDateStr + 'T00:00:00.000Z');
    setCurrentDate(newDate);
    
    console.log('🗓️ Date navigated:', {
      direction,
      oldDate: currentDate.toISOString().split('T')[0],
      newDate: newDate.toISOString().split('T')[0],
      displayDate: `${String(newDate.getUTCDate()).padStart(2, '0')}/${String(newDate.getUTCMonth() + 1).padStart(2, '0')}/${String(newDate.getUTCFullYear()).slice(-2)}`,
      actualDateCheck: {
        year: newDate.getUTCFullYear(),
        month: newDate.getUTCMonth() + 1,
        day: newDate.getUTCDate(),
        isoString: newDate.toISOString().split('T')[0]
      }
    });
    
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

    createMutation.mutate(quickEntryForm);
  };

  // Handle transaction edit with loan integration check
  const handleEditTransaction = (transaction: any) => {
    // Check if this is a loan-related transaction (disabled for editing)
    if (transaction.category === 'loan_disbursement' || transaction.category === 'loan_closure') {
      toast({
        title: "🔒 कर्ज व्यवहार संरक्षित",
        description: "कर्ज संबंधित entries फक्त त्यांच्या संबंधित फॉर्ममधून संपादित करू शकता. हे real-time integrated आहे.",
        variant: "default",
      });
      return;
    }

    // Check if this is a system-generated transaction that should remain read-only
    if (transaction.isSystemGenerated || transaction.readonly) {
      toast({
        title: "🔒 सिस्टम Generated Entry",
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
        title: "🔒 कर्ज व्यवहार संरक्षित", 
        description: "कर्ज संबंधित entries फक्त loan form मधून delete करू शकता. कर्ज delete केल्यास इथे auto-delete होईल.",
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
    
    console.log('✅ UNIFIED SYSTEM: Processing clean transactions:', {
      totalCount: transactions.length,
      source: 'unified_cash_transactions_only',
      rajPatelCount: transactions.filter(t => t.narration?.includes('राज पाटील')).length
    });
    
    // Enhanced processing for each transaction without extra console logging
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

  // MEMOIZED balance calculations - Enhanced with daily balance API
  const currentBalance = useMemo(() => {
    // For daily view, prioritize mobile daily balance API for accurate carry-forward
    if (viewPeriod === 'daily' && dailyBalanceData) {
      return dailyBalanceData.closingBalance;
    }
    return currentCashBalance?.balance || 0;
  }, [currentCashBalance, dailyBalanceData, viewPeriod]);
  
  // CRITICAL FIX: Use correct balance calculation logic without hardcoded dates
  const periodBalance = useMemo(() => {
    const currentDateStr = currentDate.toISOString().split('T')[0];
    const dateRange = getDateRange();
    
    console.log('💰 MOBILE CASHBOOK: Balance calculation debug:', {
      viewPeriod,
      currentDate: currentDateStr,
      dateRange,
      openingBalance: openingBalance?.openingBalance,
      totals
    });
    
    // Remove hardcoded date logic for custom ranges - use dynamic calculation
    
    // For yearly view, use actual opening balance from API instead of hardcoded value
    if (viewPeriod === 'yearly') {
      const actualOpeningBalance = openingBalance?.openingBalance || 0;
      const yearlyBalance = actualOpeningBalance + totals.cashIn - totals.cashOut;
      console.log('💰 YEARLY BALANCE CALCULATION:', {
        accountBase: actualOpeningBalance,
        cashIn: totals.cashIn,
        cashOut: totals.cashOut,
        yearlyBalance,
        method: 'yearly-base-dynamic'
      });
      return yearlyBalance;
    }
    
    // For all periods, use dynamic opening balance calculation
    
    // CRITICAL: For daily view, use new Mobile Daily Balance API for proper carry-forward
    if (viewPeriod === 'daily' && dailyBalanceData) {
      console.log('🏦 MOBILE DAILY BALANCE API:', {
        date: dailyBalanceData.date,
        openingBalance: dailyBalanceData.openingBalance,
        closingBalance: dailyBalanceData.closingBalance,
        netDifference: dailyBalanceData.netDifference,
        dayTransactions: dailyBalanceData.dayTransactions,
        method: 'mobile-api-carry-forward'
      });
      return dailyBalanceData.closingBalance;
    }

    // UNIVERSAL: For all other periods (weekly, monthly, yearly, custom), use universal balance API
    if (viewPeriod !== 'daily' && universalBalanceData) {
      console.log('🏦 UNIVERSAL BALANCE API:', {
        startDate: universalBalanceData.startDate,
        endDate: universalBalanceData.endDate,
        viewPeriod: universalBalanceData.viewPeriod,
        openingBalance: universalBalanceData.openingBalance,
        closingBalance: universalBalanceData.closingBalance,
        netDifference: universalBalanceData.netDifference,
        periodTransactions: universalBalanceData.periodTransactions,
        method: 'universal-period-balance'
      });
      return universalBalanceData.closingBalance;
    }

    // Method 1: Use dateWiseBalance if available (most accurate)
    if (dateWiseBalance?.closingBalance !== undefined) {
      console.log('💰 MOBILE CASHBOOK: Using dateWiseBalance for closing:', {
        dateWiseClosing: dateWiseBalance.closingBalance,
        dateWiseOpening: dateWiseBalance.openingBalance,
        method: 'dateWise'
      });
      return dateWiseBalance.closingBalance;
    }
    
    // Method 2: Manual calculation - Opening Balance + Cash In - Cash Out
    const actualOpeningBalance = openingBalance?.openingBalance || 0;
    const calculatedBalance = actualOpeningBalance + totals.cashIn - totals.cashOut;
    
    console.log('💰 MOBILE CASHBOOK: Manual calculation:', {
      openingBalance: actualOpeningBalance,
      cashIn: totals.cashIn,
      cashOut: totals.cashOut,
      calculated: calculatedBalance,
      method: 'manual'
    });
    
    return calculatedBalance;
  }, [dateWiseBalance, openingBalance, totals, viewPeriod, currentDate, searchFilters.dateFrom, searchFilters.dateTo, dailyBalanceData, universalBalanceData]);
  
  // MEMOIZED loan transaction count
  const loanTransactionCount = useMemo(() => 
    transactionsList.filter(t => t.category === 'loan_disbursement' || t.category === 'loan_closure' || t.category === 'loan_repayment').length,
    [transactionsList]
  );

  // Format date for display in DD/MM/YY format - FIXED: Manual formatting to prevent timezone issues
  const formatDisplayDate = () => {
    // Helper function to manually format date without timezone issues
    const manualFormatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      return `${day}/${month}/${year}`;
    };
    
    // If custom date range is active, show that
    if (searchFilters.dateFrom && searchFilters.dateTo) {
      const startDate = new Date(searchFilters.dateFrom);
      const endDate = new Date(searchFilters.dateTo);
      return `${manualFormatDate(startDate)} - ${manualFormatDate(endDate)}`;
    }
    
    switch (viewPeriod) {
      case 'daily':
        return manualFormatDate(currentDate);
      case 'weekly':
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${manualFormatDate(weekStart)} - ${manualFormatDate(weekEnd)}`;
      case 'monthly':
        return `${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear().toString().slice(-2)}`;
      case 'yearly':
        return `${currentDate.getFullYear()}`;
    }
  };

  return (
    <div className={`mobile-cashbook ${isFullScreen ? 'fixed inset-0 z-50 bg-white' : 'min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50'}`}>
      {!isFullScreen && <MobileNav />}
      {isFullScreen && <MobileNav hideBottomNav={true} />}
      
      <div className={`${isFullScreen ? "h-full overflow-y-auto pb-6" : "pb-24"} max-w-md mx-auto lg:max-w-lg`}>
        {/* Header */}
        <div className="bg-blue-600 text-white p-4">

          <div className="flex items-center justify-between mb-4">
            {!isFullScreen ? (
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700">
                  <Home className="h-4 w-4 mr-2" />
मुखपृष्ठ
                </Button>
              </Link>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-blue-700"
                onClick={() => setIsFullScreen(false)}
                title="मुखपृष्ठावर जा"
              >
                <Minimize2 className="h-4 w-4 mr-2" />
बाहेर पडा
              </Button>
            )}
            
            <h1 className="text-xl font-bold text-center flex-1">
              Cash Book
            </h1>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-blue-700"
                onClick={() => {
                  // Manual cache refresh button for when data is deleted from management section
                  setRawTransactions([]);
                  setIsLoading(true);
                  queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/mobile-cashbook"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
                  queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
                  queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
                  toast({
                    title: "🔄 Cache Cleared!",
                    description: "Data refreshed - deleted entries removed from dual entry journal",
                  });
                }}
                title="डेटा रिफ्रेश करा - cache clear करा"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-blue-700"
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={isFullScreen ? "Exit Full Screen" : "Full Screen Mode"}
              >
                <Maximize className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newSearchOpen = !isSearchOpen;
                  setIsSearchOpen(newSearchOpen);
                  
                  // When search is closed, return to daily view
                  if (!newSearchOpen) {
                    setViewPeriod('daily');
                  } else {
                    // When search is opened, scroll to make it visible
                    setTimeout(() => {
                      const searchPanel = document.querySelector('[data-search-panel]');
                      if (searchPanel) {
                        searchPanel.scrollIntoView({ 
                          behavior: 'smooth', 
                          block: 'start',
                          inline: 'nearest'
                        });
                      }
                    }, 100);
                  }
                }}
                className="text-white hover:bg-blue-700"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2 mb-3 justify-center">
            <Button
              variant={viewMode === 'cashbook' ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode('cashbook')}
              className={`whitespace-nowrap ${
                viewMode === 'cashbook' 
                  ? "bg-white text-blue-600" 
                  : "text-white hover:bg-blue-700"
              }`}
            >
              📕 रोखवही
            </Button>
            <Button
              variant={viewMode === 'journal' ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode('journal')}
              className={`whitespace-nowrap ${
                viewMode === 'journal' 
                  ? "bg-white text-blue-600" 
                  : "text-white hover:bg-blue-700"
              }`}
            >
              📊 द्विनोंदणी जर्नल
            </Button>
          </div>

          {/* Period Selection */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {['daily', 'weekly', 'monthly', 'yearly'].map((period) => (
              <Button
                key={period}
                variant={viewPeriod === period ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  // CRITICAL FIX: Close custom date range when selecting other periods
                  setIsDateRangeOpen(false);
                  setViewPeriod(period as any);
                  
                  // CRITICAL: Clear search filters when changing period
                  setSearchDisplayText("");
                  setSearchFilters({
                    search: "",
                    amount: "",
                    dateFrom: "",
                    dateTo: "",
                    transactionType: "",
                    monthsBack: ""
                  });
                  
                  // Invalidate cache when period changes to recalculate opening balance
                  const currentDateStr = currentDate.toISOString().split('T')[0];
                  queryClient.invalidateQueries({ queryKey: ["/api/cash-balance/opening", currentDateStr, period] });
                  queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance", currentDateStr, period] });
                  queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
                  queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
                }}
                className={`whitespace-nowrap ${
                  (viewPeriod === period && !(searchFilters.dateFrom && searchFilters.dateTo))
                    ? "bg-white text-blue-600" 
                    : "text-white hover:bg-blue-700"
                }`}
              >
                {period === 'daily' && 'दैनिक'}
                {period === 'weekly' && 'साप्ताहिक'}
                {period === 'monthly' && 'मासिक'}
                {period === 'yearly' && 'वार्षिक'}
              </Button>
            ))}
            <Button
              variant={(searchFilters.dateFrom && searchFilters.dateTo) ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                // CRITICAL FIX: Prevent freeze by avoiding conflicting states
                setIsDateRangeOpen(!isDateRangeOpen);
              }}
              className={`whitespace-nowrap ${
                (searchFilters.dateFrom && searchFilters.dateTo) 
                  ? "bg-white text-blue-600" 
                  : "text-white hover:bg-blue-700"
              }`}
            >
📅 कस्टम
            </Button>
          </div>

          {/* Custom Date Range Dialog */}
          {isDateRangeOpen && (
            <div className="bg-blue-500 p-4 rounded-lg mb-4">
              <div className="text-white text-center font-bold mb-3">
                📅 या तारखेपासून या तारखेपर्यंत
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white rounded-lg p-3 border-2 border-blue-200">
                  <div className="text-sm text-blue-600 font-semibold mb-2">
                    सुरुवाती तारीख
                  </div>
                  <Input
                    type="date"
                    value={customDateRange.startDate}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    placeholder="तारीख निवडा"
                    className="font-inter"
                  />
                  <div className="text-xs text-blue-500 mt-1 font-medium">
                    {customDateRange.startDate && DateUtils.isoToIndianDate(customDateRange.startDate)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border-2 border-blue-200">
                  <div className="text-sm text-blue-600 font-semibold mb-2">
                    शेवटची तारीख
                  </div>
                  <Input
                    type="date"
                    value={customDateRange.endDate}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    placeholder="तारीख निवडा"
                    className="font-inter"
                  />
                  <div className="text-xs text-blue-500 mt-1 font-medium">
                    {customDateRange.endDate && DateUtils.isoToIndianDate(customDateRange.endDate)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsDateRangeOpen(false)}
                  variant="outline"
                  className="flex-1 bg-white text-blue-600 border-white hover:bg-gray-100"
                >
रद्द
                </Button>
                <Button
                  onClick={() => {
                    if (customDateRange.startDate && customDateRange.endDate) {
                      // CRITICAL FIX: Don't change viewPeriod to avoid freeze
                      setSearchFilters(prev => ({
                        ...prev,
                        dateFrom: customDateRange.startDate,
                        dateTo: customDateRange.endDate
                      }));
                      setIsDateRangeOpen(false);
                      
                      // Clear cache for custom date range
                      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
                    }
                  }}
                  disabled={!customDateRange.startDate || !customDateRange.endDate}
                  className="flex-1 bg-white text-blue-600 hover:bg-gray-100 font-bold"
                >
OK ✓
                </Button>
              </div>
            </div>
          )}

          {/* Date Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDate('prev')}
              className="text-white hover:bg-blue-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="text-center flex-1 px-2">
              <div className="font-bold mb-2">{formatDisplayDate()}</div>
              <div className="mb-2">
                <Input
                  type="date"
                  value={currentDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    // CRITICAL FIX: Date picker should match selected date exactly
                    const selectedDateString = e.target.value; // YYYY-MM-DD format
                    if (!selectedDateString) return;
                    
                    // Create date directly from ISO string to avoid timezone issues
                    const newDate = new Date(selectedDateString + 'T00:00:00.000Z');
                    setCurrentDate(newDate);
                    
                    console.log('🗓️ Date selected:', {
                      inputValue: selectedDateString,
                      actualNewDate: newDate.toISOString().split('T')[0],
                      displayCheck: `${String(newDate.getUTCDate()).padStart(2, '0')}/${String(newDate.getUTCMonth() + 1).padStart(2, '0')}/${String(newDate.getUTCFullYear()).slice(-2)}`,
                      dateComponents: { year: newDate.getUTCFullYear(), month: newDate.getUTCMonth() + 1, day: newDate.getUTCDate() }
                    });
                    
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
                    
                    // Force refresh with new date
                    const newDateStr = newDate.toISOString().split('T')[0];
                    queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/date-wise-balance", newDateStr, viewPeriod] });
                  }}
                  className="text-center text-sm bg-white/20 border-white/30 text-white placeholder-white/70 font-inter"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div className="text-sm opacity-90">
                {searchFilters.dateFrom && searchFilters.dateTo ? 
                  `कस्टम रेंज: ओपनिंग ₹${(openingBalance?.openingBalance || 0).toLocaleString('en-IN')}` :
                  `आरंभिक शिल्लक: ₹${(
                    viewPeriod === 'daily' && dailyBalanceData 
                      ? dailyBalanceData.openingBalance 
                      : universalBalanceData 
                        ? universalBalanceData.openingBalance 
                        : (dateWiseBalance?.openingBalance || openingBalance?.openingBalance || 0)
                  ).toLocaleString('en-IN')}`
                }
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDate('next')}
              className="text-white hover:bg-blue-700"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Professional Search Panel */}
        {isSearchOpen && (
          <div className="bg-white border-b border-gray-200" data-search-panel>
            <div className="p-4 space-y-4">
              {/* Search Header */}
              <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="w-4 h-4 text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-800">Search Transactions</h3>
              </div>
              
              {/* Main Search Input */}
              <div className="space-y-2">
                <Input
                  placeholder="Search by name, amount, or description..."
                  value={searchDisplayText}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setSearchDisplayText(newValue);
                    
                    const enhancedSearchTerm = performCrossLanguageSearch(newValue);
                    
                    setSearchFilters(prev => ({ ...prev, search: enhancedSearchTerm, amount: "" }));
                    
                    if (searchDebounceTimer) {
                      clearTimeout(searchDebounceTimer);
                    }
                    
                    const timer = setTimeout(() => {
                      console.log('🔍 MOBILE CASHBOOK ENHANCED SEARCH:', { 
                        originalTerm: newValue,
                        enhancedTerm: enhancedSearchTerm,
                        timestamp: new Date().toISOString() 
                      });
                    }, 300);
                    
                    setSearchDebounceTimer(timer);
                  }}
                  className="h-11 px-4 text-base bg-gray-50 border-gray-300 rounded-lg focus:bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                  data-testid="input-unified-search"
                />
                <p className="text-xs text-gray-500">
                  Examples: "उमेश", "umesh", "50000", "नेकलेस" - Works in English & Marathi!
                </p>
              </div>
              
              {/* Transaction Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Transaction Type</label>
                <select
                  value={searchFilters.transactionType}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, transactionType: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 border-gray-300 rounded-lg focus:bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                >
                  <option value="">All Transactions</option>
                  <option value="cash_in">Cash In (DR)</option>
                  <option value="cash_out">Cash Out (CR)</option>
                </select>
              </div>
              
              {/* Date Range Filter */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Date Range</label>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-600">Months back:</span>
                  </div>
                  <input
                    type="number"
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
                        
                        setSearchFilters(prev => ({ 
                          ...prev, 
                          dateFrom: fromDate,
                          dateTo: toDate
                        }));
                      } else {
                        setSearchFilters(prev => ({ 
                          ...prev, 
                          dateFrom: '',
                          dateTo: ''
                        }));
                      }
                    }}
                    placeholder="3, 6, 12, 24"
                    className="w-full h-10 px-3 text-center text-base bg-white border border-gray-200 rounded-md focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                    data-testid="input-months-back"
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Enter number of months to search back
                  </p>
                  {searchFilters.monthsBack && !isNaN(parseInt(searchFilters.monthsBack)) && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-md border border-blue-100">
                      <p className="text-xs text-blue-700 text-center font-medium">
                        Range: {(() => {
                          const today = new Date();
                          const monthsAgo = new Date(today);
                          monthsAgo.setMonth(today.getMonth() - parseInt(searchFilters.monthsBack));
                          const fromDisplay = `${monthsAgo.getDate().toString().padStart(2, '0')}/${(monthsAgo.getMonth() + 1).toString().padStart(2, '0')}/${monthsAgo.getFullYear().toString().slice(-2)}`;
                          const toDisplay = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear().toString().slice(-2)}`;
                          return `${fromDisplay} to ${toDisplay}`;
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Clear Filters Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-10 text-gray-600 border-gray-300 hover:bg-gray-50 transition-colors"
                onClick={() => { setSearchDisplayText(""); setSearchFilters({ search: "", amount: "", dateFrom: "", dateTo: "", transactionType: "", monthsBack: "" }); }}
              >
                Clear All Filters
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-2">
          {viewMode === 'cashbook' ? (
            // Cashbook View
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Table Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 grid grid-cols-4 gap-1 text-xs font-bold sticky top-0 z-10">
                <div className="text-center">📅 दिनांक<br/><span className="text-xs opacity-75">(DD/MM/YY)</span></div>
                <div className="text-center text-green-200">⬆️ आले</div>
                <div className="text-center text-red-200">⬇️ दिले</div>
                <div className="text-center text-yellow-200">💰 शिल्लक</div>
              </div>
            
            {/* Previous Balance Row */}
            <div className="p-3 border-b bg-gradient-to-r from-blue-50 to-blue-100 grid grid-cols-4 gap-1 text-sm">
              <div className="font-bold text-blue-800 text-xs">
                🏦 आरंभिक<br/>
                <span className="text-xs text-gray-600">
                  {(() => {
                    // Show appropriate label based on view period
                    const openingDateStr = getOpeningBalanceDate();
                    const [year, month, day] = openingDateStr.split('-').map(Number);
                    const dateDisplay = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
                    
                    if (searchFilters.dateFrom && searchFilters.dateTo) {
                      return `(${dateDisplay} closing)`;
                    } else if (viewPeriod === 'weekly') {
                      return `(Last week closing)`;
                    } else if (viewPeriod === 'monthly') {
                      return `(Last month closing)`;
                    } else if (viewPeriod === 'yearly') {
                      return `(Last year closing)`;
                    } else {
                      return `(${dateDisplay})`;
                    }
                  })()}
                </span>
                {loanTransactionCount > 0 && (
                  <div className="text-xs text-orange-600 mt-1">
                    🔗 {loanTransactionCount} कर्ज linked
                  </div>
                )}
              </div>
              <div></div>
              <div></div>
              <div className="font-bold text-blue-800 text-center">
                ₹{(
                  viewPeriod === 'daily' && dailyBalanceData 
                    ? dailyBalanceData.openingBalance 
                    : universalBalanceData 
                      ? universalBalanceData.openingBalance 
                      : (dateWiseBalance?.openingBalance || openingBalance?.openingBalance || 0)
                ).toLocaleString('en-IN')}
              </div>
            </div>

            {/* Transaction Rows */}
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">लोड होत आहे...</p>
              </div>
            ) : transactionsList.length === 0 ? (
              <div className="p-8 text-center text-gray-500">आजचे कोणतेही व्यवहार नाहीत</div>
            ) : (
              transactionsList.map((transaction: any, index: number) => {
                const correctOpeningBalance = (
                  viewPeriod === 'daily' && dailyBalanceData 
                    ? dailyBalanceData.openingBalance 
                    : universalBalanceData 
                      ? universalBalanceData.openingBalance 
                      : (dateWiseBalance?.openingBalance || openingBalance?.openingBalance || 0)
                );

                const runningBalance = correctOpeningBalance + 
                  transactionsList.slice(0, index + 1).reduce((sum, t) => {
                    return sum + (t.transactionType === 'cash_in' ? Number(t.amount) : -Number(t.amount));
                  }, 0);

                const isLoanTransaction = transaction.category === 'loan_disbursement' || 
                                        transaction.category === 'loan_closure' || 
                                        transaction.category === 'loan_repayment';

                return (
                  <div
                    key={transaction.id}
                    onClick={() => {
                      if (!isLoanTransaction) {
                        handleEditTransaction(transaction);
                      }
                    }}
                    onDoubleClick={() => {
                      if (!isLoanTransaction) {
                        if (confirm('हा व्यवहार डिलीट करायचा का?')) {
                          handleDeleteTransaction(transaction.id);
                        }
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!isLoanTransaction) {
                        if (confirm('हा व्यवहार डिलीट करायचा का?')) {
                          handleDeleteTransaction(transaction.id);
                        }
                      }
                    }}
                    className={`p-3 border-b transition-colors cursor-pointer ${
                      isLoanTransaction 
                        ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200 cursor-not-allowed' 
                        : 'hover:bg-gray-50 active:bg-blue-50'
                    }`}
                    title={isLoanTransaction ? "🔒 कर्ज व्यवहार संपादन अक्षम" : "👆 Edit करा | 👆👆 Delete करा | Long-press करा"}
                  >
                    {/* 📱 MOBILE: Main Transaction Info Grid */}
                    <div className="grid gap-2 text-sm" style={{ gridTemplateColumns: '3fr 0.8fr 0.8fr 1fr' }}>
                    <div className="space-y-1">
                      <div className="font-bold text-xs text-blue-800">
                        {DateUtils.isoToShortDate(transaction.transactionDate)}
                      </div>
                      <div className="text-xs font-medium text-gray-700 break-words">
                        {transaction.party?.name || '💵 रोकड'}
                        {transaction.displayAccountNumber && transaction.displayAccountNumber !== "मॅन्युअल एंट्री" && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1 rounded">
                            खाते क्र. {transaction.displayAccountNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 leading-tight break-words">
                        {transaction.narration}
                        {transaction.displayCollateral && transaction.displayCollateral !== "तपशील उपलब्ध नाही" && (
                          <div className="mt-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                            🔸 वस्तू: {transaction.displayCollateral}
                          </div>
                        )}
                      </div>
                      {isLoanTransaction && (
                        <div className="bg-orange-100 text-orange-800 rounded px-2 py-1 text-xs font-medium border border-orange-200">
                          🔒 {transaction.category === 'loan_disbursement' ? 'कर्ज वाटप' : 'कर्ज बंद'}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-center">
                      {transaction.transactionType === 'cash_in' ? (
                        <div className={`font-bold text-sm ${
                          isLoanTransaction 
                            ? 'text-orange-700' 
                            : 'text-blue-600'
                        }`}>
                          ₹{Number(transaction.amount).toLocaleString('en-IN')}
                          {isLoanTransaction && <div className="text-xs mt-1">🔒</div>}
                        </div>
                      ) : (
                        <div className="h-4"></div>
                      )}
                    </div>
                    
                    <div className="text-center">
                      {transaction.transactionType === 'cash_out' ? (
                        <div className={`font-bold text-sm ${
                          isLoanTransaction 
                            ? 'text-orange-700' 
                            : 'text-red-600'
                        }`}>
                          ₹{Number(transaction.amount).toLocaleString('en-IN')}
                          {isLoanTransaction && <div className="text-xs mt-1">🔒</div>}
                        </div>
                      ) : (
                        <div className="h-4"></div>
                      )}
                    </div>
                    
                    <div className="text-center font-bold text-sm text-gray-800">
                      ₹{runningBalance.toLocaleString('en-IN')}
                    </div>
                  </div>
                  
                </div>
                );
              })
            )}
            </div>
          ) : (
            // Journal View (Dual-Entry System)
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Journal Header */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-3 grid grid-cols-5 gap-1 text-xs font-bold sticky top-0 z-10">
                <div className="text-center">📅 दिनांक</div>
                <div className="text-center">🔢 नंबर</div>
                <div className="text-center">👤 खाते</div>
                <div className="text-center text-green-200">नावे (DR)</div>
                <div className="text-center text-red-200">जमा (CR)</div>
              </div>

              {/* Journal Entries */}
              {journalLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">द्विनोंदणी लोड होत आहे...</p>
                </div>
              ) : !journalEntries || journalEntries.length === 0 ? (
                <div className="p-8 text-center text-gray-500">या काळात कोणतेही जर्नल entries नाहीत</div>
              ) : (
                journalEntries.map((entry: any) => (
                  <div key={entry.id} className="border-b">
                    {/* Journal Entry Header */}
                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-sm text-purple-800">
                          📋 जर्नल #{entry.journalNumber}
                        </div>
                        <div className="text-xs text-gray-600">
                          {DateUtils.isoToIndianDate(entry.transactionDate)}
                        </div>
                      </div>
                      {entry.narration && (
                        <div className="text-xs text-gray-600 mt-1">{entry.narration}</div>
                      )}
                    </div>
                    
                    {/* Debit Entries */}
                    {entry.entries?.filter((e: any) => e.type === 'debit').map((debitEntry: any, idx: number) => (
                      <div key={`debit-${idx}`} className="p-2 grid grid-cols-5 gap-1 text-sm border-b border-gray-100">
                        <div className="text-xs text-gray-500">
                          {idx === 0 ? DateUtils.isoToShortDate(entry.transactionDate) : ''}
                        </div>
                        <div className="text-xs text-gray-500">
                          {idx === 0 ? entry.journalNumber : ''}
                        </div>
                        <div className="text-xs font-medium">
                          {debitEntry.accountName}
                        </div>
                        <div className="text-center">
                          <div className="bg-green-100 text-green-800 rounded px-2 py-1 text-xs font-bold">
                            ₹{Number(debitEntry.amount).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div></div>
                      </div>
                    ))}
                    
                    {/* Credit Entries */}
                    {entry.entries?.filter((e: any) => e.type === 'credit').map((creditEntry: any, idx: number) => (
                      <div key={`credit-${idx}`} className="p-2 grid grid-cols-5 gap-1 text-sm border-b border-gray-100">
                        <div></div>
                        <div></div>
                        <div className="text-xs font-medium pl-4">
                          To {creditEntry.accountName}
                        </div>
                        <div></div>
                        <div className="text-center">
                          <div className="bg-red-100 text-red-800 rounded px-2 py-1 text-xs font-bold">
                            ₹{Number(creditEntry.amount).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Enhanced Summary */}
        <div className="p-2 mb-16">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-yellow-300">
                  📊 {viewMode === 'cashbook' ? 'रोखवही' : 'द्विनोंदणी'} सारांश
                </h3>
                <div className="text-xs text-gray-300 mt-1">{formatDisplayDate()}</div>

                {viewMode === 'cashbook' && isBalanceAccurate && (
                  <div className="text-xs text-green-300">✅ बॅलन्स accurate आहे</div>
                )}
                {viewMode === 'cashbook' && loanTransactionCount > 0 && (
                  <div className="text-xs text-orange-300 mt-1">
                    🔗 {loanTransactionCount} कर्ज entries auto-synced
                  </div>
                )}
                {viewMode === 'journal' && (
                  <div className="text-xs text-purple-300 mt-1">
                    📋 द्विनोंदणी प्रणाली - प्रत्येक entry च्या दोन्ही बाजू
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-green-600 rounded-lg p-3 text-center">
                  <div className="text-xs opacity-90">⬆️ पैसे आले</div>
                  <div className="font-bold text-sm">₹{totals.cashIn.toLocaleString('en-IN')}</div>
                </div>
                
                <div className="bg-red-600 rounded-lg p-3 text-center">
                  <div className="text-xs opacity-90">⬇️ पैसे दिले</div>
                  <div className="font-bold text-sm">₹{totals.cashOut.toLocaleString('en-IN')}</div>
                </div>
              </div>
              
              <div className="border-t border-gray-600 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="opacity-90">🏦 आरंभिक शिल्लक:</span>
                  <span className="font-medium">₹{(
                    viewPeriod === 'daily' && dailyBalanceData 
                      ? dailyBalanceData.openingBalance 
                      : universalBalanceData 
                        ? universalBalanceData.openingBalance 
                        : (dateWiseBalance?.openingBalance || openingBalance?.openingBalance || 0)
                  ).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="opacity-90">🔄 निव्वळ फरक:</span>
                  <span className={`font-medium ${(totals.cashIn - totals.cashOut) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    ₹{(totals.cashIn - totals.cashOut).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-600">
                  <span className="opacity-90 font-semibold">💰 शिल्लक रक्कम:</span>
                  <span className={`font-bold text-lg ${periodBalance >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    ₹{periodBalance.toLocaleString('en-IN')}
                  </span>
                </div>
                

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Fixed Bottom Action Buttons */}
      {/* Bottom Action Buttons - Normal Mode */}
      {!isFullScreen && (
        <div className="fixed bottom-16 left-0 right-0 lg:left-1/2 lg:-translate-x-1/2 lg:max-w-lg lg:w-full bg-gradient-to-t from-white via-white to-transparent border-t-2 border-gray-200 p-3 grid grid-cols-2 gap-3 shadow-2xl z-40">
          <Dialog open={isQuickEntryOpen && quickEntryType === 'cash_in'} onOpenChange={setIsQuickEntryOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white h-14 text-lg font-bold rounded-xl shadow-lg transform active:scale-95 transition-all"
                onClick={() => {
                  setQuickEntryType('cash_in');
                  setIsQuickEntryOpen(true);
                }}
              >
                <div className="flex flex-col items-center">
                  <Plus className="h-6 w-6 mb-1" />
                  <span className="text-sm">
                    💰 पैसे आले
                  </span>
                </div>
              </Button>
            </DialogTrigger>
          </Dialog>

          <Dialog open={isQuickEntryOpen && quickEntryType === 'cash_out'} onOpenChange={setIsQuickEntryOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white h-14 text-lg font-bold rounded-xl shadow-lg transform active:scale-95 transition-all"
                onClick={() => {
                  setQuickEntryType('cash_out');
                  setIsQuickEntryOpen(true);
                }}
              >
                <div className="flex flex-col items-center">
                  <Minus className="h-6 w-6 mb-1" />
                  <span className="text-sm">
                    💸 पैसे दिले
                  </span>
                </div>
              </Button>
            </DialogTrigger>
          </Dialog>


        </div>
      )}

      {/* Full Screen Floating Action Buttons */}
      {isFullScreen && (
        <div className="fixed bottom-8 right-6 flex flex-col gap-3 z-[60]">
          <Dialog open={isQuickEntryOpen && quickEntryType === 'cash_in'} onOpenChange={setIsQuickEntryOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-xl rounded-full w-16 h-16 flex items-center justify-center transform hover:scale-105 transition-all"
                onClick={() => {
                  setQuickEntryType('cash_in');
                  setIsQuickEntryOpen(true);
                }}
              >
                <Plus className="h-8 w-8" />
              </Button>
            </DialogTrigger>
          </Dialog>

          <Dialog open={isQuickEntryOpen && quickEntryType === 'cash_out'} onOpenChange={setIsQuickEntryOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl rounded-full w-16 h-16 flex items-center justify-center transform hover:scale-105 transition-all"
                onClick={() => {
                  setQuickEntryType('cash_out');
                  setIsQuickEntryOpen(true);
                }}
              >
                <Minus className="h-8 w-8" />
              </Button>
            </DialogTrigger>
          </Dialog>


        </div>
      )}

      {/* Enhanced Quick Entry Dialog */}
      <Dialog open={isQuickEntryOpen} onOpenChange={setIsQuickEntryOpen}>
        <DialogContent className="sm:max-w-md mx-4 max-h-[85vh] overflow-y-auto" aria-describedby="quick-entry-description">
          <DialogHeader>
            <DialogTitle className={`text-center text-xl font-bold ${
              quickEntryType === 'cash_in' ? 'text-green-700' : 'text-red-700'
            }`}>
{quickEntryType === 'cash_in' ? '💰 पैसे आले' : '💸 पैसे दिले'}
            </DialogTitle>
          </DialogHeader>
          <div id="quick-entry-description" className="sr-only">
            Quick cash transaction entry form
          </div>
          
          <div className="space-y-5">
            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">
                💵 रक्कम *
              </Label>
              <Input
                type="number"
                placeholder="₹ 0"
                value={quickEntryForm.amount}
                onChange={(e) => setQuickEntryForm(prev => ({ ...prev, amount: e.target.value }))}
                className="mt-2 text-lg font-bold text-center h-10"
                autoFocus
              />
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">
                📝 तपशील *
              </Label>
              <Input
placeholder="व्यवहाराचा तपशील लिहा... / Enter details..."
                value={quickEntryForm.narration}
                onChange={(e) => setQuickEntryForm(prev => ({ ...prev, narration: e.target.value }))}
                className="mt-2 h-10"
              />
            </div>
            
            {/* Party Selection - Dual Entry Logic */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">
                👤 व्यक्ती (पर्यायी - dual entry साठी)
              </Label>
              <div className="mt-2">
                <PartySelector
                  value={quickEntryForm.partyId || undefined}
                  onValueChange={(value) => setQuickEntryForm(prev => ({ ...prev, partyId: value || null }))}
                  placeholder="व्यक्ती निवडा - गणेश निवडल्यास 'गणेश ↔ रोकड' dual entry होईल"
                />
              </div>
              <div className="mt-2 text-xs text-blue-600">
                💡 व्यक्ती निवडल्यास automatic dual entry होईल: गणेश ↔ रोकड
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <Label className="text-sm font-semibold text-gray-800">📂 प्रकार</Label>
              <Select 
                value={quickEntryForm.category} 
                onValueChange={(value) => setQuickEntryForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="mt-2 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="capital">🏦 भांडवल</SelectItem>
                  <SelectItem value="income">📈 उत्पन्न</SelectItem>
                  <SelectItem value="expense">📉 खर्च</SelectItem>
                  <SelectItem value="other">📋 इतर</SelectItem>
                </SelectContent>
              </Select>
            </div>
            

            
            <div className="grid grid-cols-2 gap-3 pt-3">
              <Button 
                variant="outline"
                onClick={() => setIsQuickEntryOpen(false)}
                className="h-10"
              >
                ❌ रद्द
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
                className="bg-blue-600 hover:bg-blue-700 h-10"
              >
                {createMutation.isPending ? "⏳ जतन होत आहे..." : "✅ जतन करा"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Edit Transaction Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md mx-4 max-h-[85vh] overflow-y-auto" aria-describedby="edit-transaction-mobile-description">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-blue-700">
              ✏️ व्यवहार संपादित करा
            </DialogTitle>
          </DialogHeader>
          <div id="edit-transaction-mobile-description" className="sr-only">
            Edit transaction form for mobile cashbook
          </div>
          
          {editingTransaction && (
            <div className="space-y-5">
              <div className="bg-blue-50 p-4 rounded-lg">
                <Label className="text-lg font-semibold text-gray-800">💵 रक्कम</Label>
                <Input
                  type="number"
                  value={editingTransaction.amount}
                  onChange={(e) => setEditingTransaction((prev: any) => ({ ...prev, amount: e.target.value }))}
                  className="mt-2 text-xl font-bold text-center h-12"
                />
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <Label className="text-lg font-semibold text-gray-800">📝 तपशील</Label>
                <Input
                  value={editingTransaction.narration}
                  onChange={(e) => setEditingTransaction((prev: any) => ({ ...prev, narration: e.target.value }))}
                  className="mt-2 h-12"
                />
              </div>
              
              {/* Party Selection for Dual Entry Transactions */}
              {editingTransaction?.partyId && editingTransaction?.partyId !== 'cash' && (
                <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
                  <Label className="text-lg font-semibold text-gray-800">👤 पार्टी (द्विनोंदणी)</Label>
                  <Select 
                    value={editingTransaction.partyId} 
                    onValueChange={(value) => setEditingTransaction((prev: any) => ({ ...prev, partyId: value }))}
                  >
                    <SelectTrigger className="mt-2 h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {partiesList?.map((party: any) => (
                        <SelectItem key={party.id} value={party.id}>
                          👤 {party.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-yellow-700 mt-1 font-medium">
                    द्विनोंदणी: पार्टी बदलल्यास दोन्ही अकाउंट मध्ये बदल होईल
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-2 pt-4">
                <Button 
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="h-12"
                >
                  ❌ रद्द
                </Button>
                
                <Button 
                  onClick={() => {
                    updateMutation.mutate({
                      id: editingTransaction.id,
                      data: {
                        amount: editingTransaction.amount,
                        narration: editingTransaction.narration,
                        partyId: editingTransaction.partyId, // Include party update for dual entry
                      }
                    });
                  }}
                  disabled={updateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 h-12"
                >
                  {updateMutation.isPending ? "⏳" : "✅ अपडेट"}
                </Button>
                
                <Button 
                  variant="destructive"
                  onClick={() => handleDeleteTransaction(editingTransaction)}
                  disabled={deleteMutation.isPending}
                  className="h-12"
                >
                  {deleteMutation.isPending ? "⏳" : "🗑️ हटवा"}
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