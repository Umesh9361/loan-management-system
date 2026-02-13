import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoanCalculationsAdvanced } from "@/lib/loan-calculations";
import { LoanCalculations } from "@/lib/calculations";
import { DateUtils } from "@/lib/date-utils";
import { Calculator, FileText, AlertTriangle, CheckCircle, Download, Search, X, Clock, Edit, Calendar, Lightbulb, Sparkles, TrendingUp, Info, Check, AlertCircle, Home, Trash2, Printer, Bluetooth, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { printReceiptViaBluetooth, isBluetoothSupported } from "@/lib/bluetooth-printer";
import jsPDF from "jspdf";
import { PhotoViewer } from "@/components/ui/photo-viewer";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";

// Simplified Schema - एक ही field for final interest amount
const closureSchema = z.object({
  loanId: z.string().min(1, "कर्ज निवडणे आवश्यक"),
  closureDate: z.string().min(1, "तारीख आवश्यक"),
  interestType: z.enum(["simple", "compound", "advanced_compound"]).default("simple"),
  compoundingFrequency: z.enum(["yearly", "half_yearly", "quarterly", "monthly"]).default("yearly"),
  advancedCalculationMode: z.enum(["month", "half_month", "week", "day"]).default("half_month"),
  finalInterestAmount: z.string().min(1, "व्याज रक्कम आवश्यक"),
  returnOfArticles: z.string().optional(),
  isClosed: z.boolean().default(true),
  useCustomRate: z.boolean().default(false),
  customInterestRate: z.string().optional(),
});

type ClosureFormData = z.infer<typeof closureSchema>;

interface SummaryEntry {
  id: number;
  borrowerName: string;
  borrowerAddress: string;
  groupName: string;
  collateralDetails: string;
  accountNumber: string;
  loanDate: string;
  months: string;
  interestRate: string;
  principalAmount: number;
  chargesAmount: number;
  closureDate: string;
}

const formatRate = (rate: string | number): string => {
  const num = Number(rate);
  if (isNaN(num)) return String(rate);
  return parseFloat(num.toFixed(4)).toString();
};

const toShortDate = (isoDate: string): string => {
  const d = DateUtils.isoToIndianDate(isoDate);
  const parts = d.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[0]}/${parts[1]}/${parts[2].slice(2)}`;
  }
  return d;
};

export default function Closure() {
  const { toast } = useToast();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLoanList, setShowLoanList] = useState(false);
  const [selectedSearchGroup, setSelectedSearchGroup] = useState<string>("all");
  const [editableLoanDate, setEditableLoanDate] = useState<string>("");
  
  const SUMMARY_STORAGE_KEY = 'closure_summary_entries';
  const SUMMARY_COUNTER_KEY = 'closure_summary_counter';

  const [summaryEntries, setSummaryEntries] = useState<SummaryEntry[]>(() => {
    try {
      const saved = sessionStorage.getItem(SUMMARY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const summaryEntriesRef = useRef<SummaryEntry[]>(summaryEntries);
  const [summaryCounter, setSummaryCounter] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SUMMARY_COUNTER_KEY);
      return saved ? Number(saved) : 1;
    } catch { return 1; }
  });
  const [activeTab, setActiveTab] = useState<string>("closure");
  const [showSummaryReceipt, setShowSummaryReceipt] = useState(false);
  const [isBtPrinting, setIsBtPrinting] = useState(false);
  const [summaryReceiptHTML, setSummaryReceiptHTML] = useState<string | null>(null);
  const [printNameMode, setPrintNameMode] = useState<'group' | 'customer'>('group');
  
  const urlParams = new URLSearchParams(window.location.search);
  const loanIdFromUrl = urlParams.get('loanId');
  const hideSearch = !!loanIdFromUrl;

  useEffect(() => {
    summaryEntriesRef.current = summaryEntries;
    try {
      sessionStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(summaryEntries));
    } catch {}
  }, [summaryEntries]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SUMMARY_COUNTER_KEY, String(summaryCounter));
    } catch {}
  }, [summaryCounter]);

  const { data: activeLoans, isLoading } = useQuery({
    queryKey: ["/api/loans"],
    queryFn: () => 
      fetch("/api/loans?status=active", {
        credentials: "include",
      }).then(res => res.json()),
  });

  const { data: groups } = useQuery({
    queryKey: ["/api/groups"],
  });

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });
  const showRateMonths = (company as any)?.showSummaryRateMonths === true;
  const showDetails = (company as any)?.showSummaryDetails === true;

  const summaryColumnsToggle = useMutation({
    mutationFn: async ({ enabled, field }: { enabled: boolean; field?: string }) => {
      const res = await apiRequest("/api/company/summary-columns-toggle", "PUT", { enabled, field });
      return res.json();
    },
    onMutate: async ({ enabled, field }: { enabled: boolean; field?: string }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/company"] });
      const previous = queryClient.getQueryData(["/api/company"]);
      const updateKey = field === 'showSummaryDetails' ? 'showSummaryDetails' : 'showSummaryRateMonths';
      queryClient.setQueryData(["/api/company"], (old: any) => ({
        ...old,
        [updateKey]: enabled,
      }));
      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/company"], data);
    },
    onError: (_err: any, _enabled: any, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/company"], context.previous);
      }
    },
  });

  const form = useForm<ClosureFormData>({
    resolver: zodResolver(closureSchema),
    defaultValues: {
      loanId: "",
      closureDate: new Date().toISOString().split('T')[0],
      interestType: "advanced_compound", // Default to प्रगत चक्रवाढ व्याज
      compoundingFrequency: "yearly",
      advancedCalculationMode: "half_month",
      finalInterestAmount: "",
      returnOfArticles: "",
      isClosed: true,
      useCustomRate: false,
      customInterestRate: "",
    },
  });

  // 🚫 MANUAL ENTRY CLEANUP MUTATION - Prevent duplicates at form level
  const cleanupMutation = useMutation({
    mutationFn: (data: { amount: number, accountNumber: string }) => 
      apiRequest("/api/loans/cleanup-manual-entries", "POST", data),
    onSuccess: (result: any) => {
    },
    onError: (error) => {
      console.error("Manual entry cleanup failed:", error);
      // Don't show error toast - this is a background cleanup operation
    },
  });

  const closureMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/loans/${data.loanId}/close`, "POST", data),
    onSuccess: () => {
      // Critical real-time updates for loan closure - affects cash book directly
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] }); // Closure creates cash inflow
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] }); // Balance increases with payment
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] }); // Borrower statistics
      
      // Force immediate refresh for real-time cash book updates
      queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
      
      toast({
        title: "यशस्वी",
        description: "कर्ज बंद केले - रोकड वही तुरंत अपडेट झाली",
      });
      form.reset();
      setSelectedLoan(null);
      setCalculationResult(null);
      setSearchQuery("");
      setShowLoanList(false);
      setEditableLoanDate("");
    },
    onError: () => {
      toast({
        title: "त्रुटी",
        description: "कर्ज बंद करताना त्रुटी झाली",
        variant: "destructive",
      });
    },
  });

  // Auto-select loan from URL
  useEffect(() => {
    if (loanIdFromUrl && activeLoans) {
      const loan = activeLoans.find((l: any) => l.id === loanIdFromUrl);
      if (loan) {
        setSelectedLoan(loan);
        form.setValue("loanId", loan.id);
        setSearchQuery(`${loan.borrowerName} - ${loan.accountNumber}`);
        setEditableLoanDate(loan.loanDate || "");
      }
    }
  }, [loanIdFromUrl, activeLoans, form]);

  // Get group name for display
  const getGroupName = (groupId: string) => {
    if (!groups || !Array.isArray(groups)) return "अज्ञात ग्रुप";
    const group = groups.find((g: any) => g.id === groupId);
    return group ? group.name : "अज्ञात ग्रुप";
  };

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

  // Enhanced Dual Language Search - Same as Loan Form
  const createDualLanguageQuery = (originalQuery: string) => {
    const englishToMarathi: Record<string, string> = {
      'ram': 'राम', 'shyam': 'श्याम', 'geeta': 'गीता', 'seeta': 'सीता',
      'vijay': 'विजय', 'ajay': 'अजय', 'sanjay': 'संजय', 'prakash': 'प्रकाश',
      'sunil': 'सुनील', 'anil': 'अनिल', 'vinod': 'विनोद', 'manoj': 'मनोज',
      'raju': 'राजू', 'babu': 'बाबू', 'sir': 'सर', 'ji': 'जी',
      'patel': 'पाटील', 'patil': 'पाटील', 'kumar': 'कुमार', 'devi': 'देवी',
      'laxmi': 'लक्ष्मी', 'ganga': 'गंगा', 'saraswati': 'सरस्वती',
      'rajkumar': 'राजकुमार', 'rajat': 'राजत', 'more': 'मोरे'
    };
    
    const marathiToEnglish: Record<string, string> = {
      'राम': 'ram', 'श्याम': 'shyam', 'गीता': 'geeta', 'सीता': 'seeta',
      'विजय': 'vijay', 'अजय': 'ajay', 'संजय': 'sanjay', 'प्रकाश': 'prakash',
      'सुनील': 'sunil', 'अनिल': 'anil', 'विनोद': 'vinod', 'मनोज': 'manoj',
      'राजू': 'raju', 'बाबू': 'babu', 'सर': 'sir', 'जी': 'ji',
      'पाटील': 'patel', 'कुमार': 'kumar', 'देवी': 'devi',
      'लक्ष्मी': 'laxmi', 'गंगा': 'ganga', 'सरस्वती': 'saraswati',
      'राजकुमार': 'rajkumar', 'राजत': 'rajat', 'मोरे': 'more'
    };
    
    const queries = [originalQuery];
    
    // Add English-to-Marathi translations
    Object.keys(englishToMarathi).forEach(english => {
      if (originalQuery.includes(english)) {
        queries.push(originalQuery.replace(new RegExp(english, 'g'), englishToMarathi[english]));
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

  // Enhanced borrower name matching with dual language support
  const matchesBorrowerName = (borrowerName: string, searchTerm: string): boolean => {
    if (!borrowerName || !searchTerm) return false;
    
    const trimmedTerm = searchTerm.trim().toLowerCase();
    const searchQueries = createDualLanguageQuery(trimmedTerm);
    
    const normalizedVariant = normalizeMarathiVowels(trimmedTerm);
    if (normalizedVariant !== trimmedTerm && !searchQueries.includes(normalizedVariant)) {
      searchQueries.push(normalizedVariant);
    }
    
    const nameLower = borrowerName.toLowerCase();
    const nameNormalized = normalizeMarathiVowels(nameLower);
    
    return searchQueries.some(query => {
      const queryNormalized = normalizeMarathiVowels(query);
      
      if (nameLower.includes(query)) return true;
      if (nameNormalized.includes(queryNormalized)) return true;
      
      const nameWords = nameLower.split(/\s+/);
      const nameWordsNorm = nameNormalized.split(/\s+/);
      const queryWords = query.split(/\s+/);
      
      if (queryWords.length > 1) {
        return queryWords.every(qWord => {
          const qNorm = normalizeMarathiVowels(qWord);
          return nameWords.some(nWord => 
            nWord.includes(qWord) || 
            nWord.startsWith(qWord) ||
            qWord.includes(nWord)
          ) || nameWordsNorm.some(nWord =>
            nWord.includes(qNorm) ||
            nWord.startsWith(qNorm) ||
            qNorm.includes(nWord)
          );
        });
      } else {
        return nameWords.some(nWord => 
          nWord.includes(query) || 
          nWord.startsWith(query) ||
          query.includes(nWord) ||
          (query.length >= 2 && nWord.length >= 2 && 
           query.substring(0, 2) === nWord.substring(0, 2))
        ) || nameWordsNorm.some(nWord =>
          nWord.includes(queryNormalized) ||
          nWord.startsWith(queryNormalized) ||
          queryNormalized.includes(nWord)
        );
      }
    });
  };

  // Enhanced search with relevance scoring - prioritizes exact matches
  const filteredLoans = useMemo(() => {
    if (!activeLoans || !searchQuery.trim()) {
      return []; // Return empty array when no search query
    }

    const searchTerm = searchQuery.toLowerCase().trim();
    const searchDigits = searchTerm.replace(/\D/g, ""); // Extract only digits
    
    // Calculate relevance score for each loan
    const scoredLoans = (activeLoans || []).map((loan: any) => {
      const accountNumber = (loan.accountNumber || "").toLowerCase();
      const accountDigits = accountNumber.replace(/\D/g, "");
      const borrowerName = (loan.borrowerName || "").toLowerCase();
      const groupName = getGroupName(loan.groupId)?.toLowerCase() || "";
      
      let score = 0;
      
      // Exact numeric match for account number (highest priority)
      if (searchDigits && accountDigits) {
        const searchNum = parseInt(searchDigits, 10);
        const accountNum = parseInt(accountDigits, 10);
        if (!isNaN(searchNum) && !isNaN(accountNum) && searchNum === accountNum) {
          score = Math.max(score, 100);
        }
      }
      
      // Exact string match for account number
      if (accountNumber === searchTerm) {
        score = Math.max(score, 90);
      }
      
      // Account number starts with search term
      if (accountNumber.startsWith(searchTerm)) {
        score = Math.max(score, 80);
      }
      
      // Account number contains search term
      if (accountNumber.includes(searchTerm)) {
        score = Math.max(score, 70);
      }
      
      // Exact borrower name match
      if (borrowerName === searchTerm) {
        score = Math.max(score, 60);
      }
      
      // Borrower name starts with search term
      if (matchesBorrowerName(loan.borrowerName || "", searchTerm) && borrowerName.startsWith(searchTerm)) {
        score = Math.max(score, 50);
      }
      
      // Borrower name contains search term (dual language)
      if (matchesBorrowerName(loan.borrowerName || "", searchTerm)) {
        score = Math.max(score, 40);
      }
      
      // Group name match
      if (groupName.includes(searchTerm)) {
        score = Math.max(score, 30);
      }
      
      // Principal or interest rate match
      if (loan.principalAmount?.toString().includes(searchTerm) || 
         loan.interestRate?.toString().includes(searchTerm)) {
        score = Math.max(score, 20);
      }
      
      return { ...loan, relevanceScore: score };
    })
    .filter((loan: any) => loan.relevanceScore > 0) // Only include matches
    .filter((loan: any) => selectedSearchGroup === "all" || loan.groupId === selectedSearchGroup)
    .sort((a: any, b: any) => {
      // Primary sort: relevance score (descending)
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      // Secondary sort: account number (ascending)
      const accountA = parseInt((a.accountNumber || "").replace(/\D/g, "")) || 0;
      const accountB = parseInt((b.accountNumber || "").replace(/\D/g, "")) || 0;
      if (accountA !== accountB) {
        return accountA - accountB;
      }
      // Tertiary sort: string comparison for stability
      return (a.accountNumber || "").localeCompare(b.accountNumber || "");
    });

    return scoredLoans;
  }, [activeLoans, searchQuery, selectedSearchGroup, groups]);

  const handleLoanSelect = (loan: any) => {
    setSelectedLoan(loan);
    form.setValue("loanId", loan.id);
    setSearchQuery(`${loan.borrowerName} - ${loan.accountNumber}`);
    setShowLoanList(false);
    setEditableLoanDate(loan.loanDate || "");
    setCalculationResult(null);
    form.setValue("finalInterestAmount", "");
  };

  const calculateInterest = useCallback(() => {
    if (!selectedLoan) return;

    // Get form values once to avoid multiple watchers
    const formValues = form.getValues();
    const closureDate = new Date(formValues.closureDate);
    const { interestType, useCustomRate, customInterestRate: customRate, compoundingFrequency, advancedCalculationMode } = formValues;

    // FIXED: Convert yearly rate to monthly for advanced calculations
    let effectiveRate = useCustomRate && customRate ? 
      Number(customRate) : Number(selectedLoan.interestRate);
    
    // Convert yearly rate to monthly rate if needed (for advanced calculations)
    if (interestType !== "simple" && selectedLoan.interestRateType === "yearly") {
      effectiveRate = effectiveRate / 12;
    }

    try {
      let result;
      
      const loanStartDate = (editableLoanDate && !isNaN(new Date(editableLoanDate).getTime())) 
        ? editableLoanDate 
        : selectedLoan.loanDate;

      if (interestType === "simple") {
        let simpleInterestRate = effectiveRate;
        if (selectedLoan.interestRateType === "monthly") {
          simpleInterestRate = effectiveRate * 12;
        }
        
        const timePeriod = LoanCalculationsAdvanced.calculateTimePeriod(
          new Date(loanStartDate),
          closureDate
        );
        
        const timeInDays = timePeriod.totalDays;
        const principalNum = Number(selectedLoan.principalAmount);
        const interestAmount = LoanCalculations.calculateSimpleInterest(
          principalNum,
          simpleInterestRate,
          timeInDays
        );
        
        const calcModeMap: Record<string, string> = {
          'month': 'month',
          'half_month': 'half-month',
          'week': 'week',
          'day': 'daily'
        };
        const closureCalcResult = LoanCalculationsAdvanced.calculateInterestForClosure(
          principalNum,
          effectiveRate,
          new Date(loanStartDate),
          closureDate,
          'simple',
          (calcModeMap[advancedCalculationMode] || 'half-month') as any
        );
        
        result = {
          interestAmount: interestAmount,
          totalPayable: principalNum + interestAmount,
          durationInDays: timeInDays,
          durationInMonths: closureCalcResult.durationInMonths,
          years: timePeriod.years,
          months: timePeriod.months,  
          days: timePeriod.days,
          breakdown: {
            principalAmount: principalNum,
            interestRate: simpleInterestRate,
            calculationType: 'simple' as const,
            calculationMode: (calcModeMap[advancedCalculationMode] || 'daily') as any,
            periodUsed: `${timeInDays} दिवस`
          }
        };
      } else {
        // For compound interest, use advanced calculations
        
        const advancedResult = LoanCalculationsAdvanced.calculateAdvancedCompoundInterest(
          Number(selectedLoan.principalAmount),
          effectiveRate,
          new Date(loanStartDate),
          closureDate,
          formValues.compoundingFrequency,
          formValues.advancedCalculationMode
        );
        
        // Get calendar-based time period for display
        const timePeriod = LoanCalculationsAdvanced.calculateTimePeriod(
          new Date(loanStartDate),
          closureDate
        );

        const compoundCalcModeMap: Record<string, string> = {
          'month': 'month',
          'half_month': 'half-month',
          'week': 'week',
          'day': 'daily'
        };
        const compoundClosureCalc = LoanCalculationsAdvanced.calculateInterestForClosure(
          Number(selectedLoan.principalAmount),
          effectiveRate,
          new Date(loanStartDate),
          closureDate,
          'simple',
          (compoundCalcModeMap[formValues.advancedCalculationMode] || 'half-month') as any
        );
        
        result = {
          ...advancedResult,
          durationInMonths: compoundClosureCalc.durationInMonths,
          durationInDays: timePeriod.totalDays,
          years: timePeriod.years,
          months: timePeriod.months,
          days: timePeriod.days
        };
      }

      setCalculationResult(result);
      
      // Auto-fill the final interest amount with calculated value
      const interestAmount = typeof result === 'number' ? result : result.interestAmount;
      form.setValue("finalInterestAmount", interestAmount.toString());

    } catch (error) {
      console.error("Calculation error:", error);
      toast({
        title: "गणना त्रुटी",
        description: "व्याज गणना करताना त्रुटी झाली",
        variant: "destructive",
      });
    }
  }, [selectedLoan, form, editableLoanDate]);

  const parseFinalInterest = useCallback((inputValue: string, calculatedInterest: number): number => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      return calculatedInterest;
    }
    const directValue = parseFloat(trimmedValue);
    if (isNaN(directValue)) return calculatedInterest;
    return directValue;
  }, []);

  const generateMultiLoanReceiptHTML = useCallback((entries: SummaryEntry[], showInterestRate: boolean, showDetailsCols: boolean = true, nameMode: 'group' | 'customer' = 'group'): string => {
    if (entries.length === 0) return '';
    const fontSize = '12px';
    const headFontSize = '10px';
    const totalPrincipal = entries.reduce((sum, e) => sum + e.principalAmount, 0);
    const totalCharges = entries.reduce((sum, e) => sum + e.chargesAmount, 0);
    const grandTotal = totalPrincipal + totalCharges;
    const lastEntry = entries[entries.length - 1];
    const closureDateFormatted = DateUtils.isoToIndianDate(lastEntry.closureDate);
    const displayName = nameMode === 'group' ? (lastEntry.groupName || lastEntry.borrowerName) : lastEntry.borrowerName;
    const displayAddress = nameMode === 'group' ? '' : (lastEntry.borrowerAddress || '');
    const baseColCount = 1 + (showDetailsCols ? 2 : 0) + 2;
    const totalColSpan = baseColCount;
    const grandTotalColSpan = totalColSpan + 1;

    const ROWS_PER_PAGE = 4;
    const totalPages = Math.ceil(entries.length / ROWS_PER_PAGE);

    const makeHeader = (pageNum: number) => `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;line-height:1.8;">
        <div>
          <div style="font-weight:700;font-size:13px;line-height:1.8;">${displayName}</div>
          ${displayAddress ? `<div style="font-size:${fontSize};color:#333;line-height:1.8;">${displayAddress}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;font-weight:700;line-height:1.8;">तारीख: ${closureDateFormatted}</div>
          ${totalPages > 1 ? `<div style="font-size:${fontSize};color:#666;">पान ${pageNum}/${totalPages}</div>` : ''}
        </div>
      </div>
      <div style="text-align:center;font-weight:700;font-size:13px;margin-bottom:12px;text-decoration:underline;text-underline-offset:6px;line-height:1.8;">Estimate</div>`;

    const makeTableHead = () => `
      <colgroup>
        <col style="width:28px;">
        ${showDetailsCols ? `<col style="width:auto;">` : ''}
        <col style="width:50px;">
        <col style="width:56px;">
        ${showDetailsCols ? `<col style="width:32px;">` : ''}
        <col style="width:75px;">
        <col style="width:65px;">
      </colgroup>
      <thead>
      <tr>
        <th style="border:none;border-bottom:0.5px solid #000;padding:5px 3px;font-size:${headFontSize};text-align:center;vertical-align:middle;font-weight:700;line-height:1.8;">अ.नं.</th>
        ${showDetailsCols ? `<th style="border:none;border-bottom:0.5px solid #000;padding:5px 4px;font-size:${headFontSize};text-align:left;vertical-align:middle;font-weight:700;line-height:1.8;">तपशील</th>` : ''}
        <th style="border:none;border-bottom:0.5px solid #000;padding:5px 3px;font-size:${headFontSize};text-align:center;vertical-align:middle;font-weight:700;line-height:1.8;">कोड नं</th>
        <th style="border:none;border-bottom:0.5px solid #000;padding:5px 3px;font-size:${headFontSize};text-align:center;vertical-align:middle;font-weight:700;line-height:1.8;">दिनांक</th>
        ${showDetailsCols ? `<th style="border:none;border-bottom:0.5px solid #000;padding:5px 2px;font-size:${headFontSize};text-align:center;vertical-align:middle;font-weight:700;line-height:1.8;"></th>` : ''}
        <th style="border:none;border-bottom:0.5px solid #000;padding:5px 4px;font-size:${headFontSize};text-align:right;vertical-align:middle;font-weight:700;line-height:1.8;">बाजारमूल्य</th>
        <th style="border:none;border-bottom:0.5px solid #000;padding:5px 4px;font-size:${headFontSize};text-align:right;vertical-align:middle;font-weight:700;line-height:1.8;">चार्जेस</th>
      </tr>
    </thead>`;

    const makeRow = (entry: SummaryEntry, index: number) => `<tr>
      <td style="border:none;padding:10px 3px;text-align:center;font-size:${fontSize};vertical-align:middle;line-height:1.8;">${index + 1}</td>
      ${showDetailsCols ? `<td style="border:none;padding:10px 4px;font-size:${fontSize};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;line-height:1.8;">${entry.collateralDetails || '-'}</td>` : ''}
      <td style="border:none;padding:10px 3px;text-align:center;font-size:${fontSize};font-weight:700;vertical-align:middle;line-height:1.8;">${entry.accountNumber}</td>
      <td style="border:none;padding:10px 3px;text-align:center;font-size:${fontSize};vertical-align:middle;line-height:1.8;">${toShortDate(entry.loanDate)}${showInterestRate ? `<span style="margin-left:12px;font-size:13px;font-weight:600;">${formatRate(entry.interestRate)}</span>` : ''}</td>
      ${showDetailsCols ? `<td style="border:none;padding:10px 2px;text-align:center;font-size:${fontSize};vertical-align:middle;line-height:1.8;">${entry.months}</td>` : ''}
      <td style="border:none;padding:10px 4px;text-align:right;font-size:${fontSize};font-weight:700;vertical-align:middle;line-height:1.8;">${Number(Math.round(entry.principalAmount)).toLocaleString('en-IN')}</td>
      <td style="border:none;padding:10px 4px;text-align:right;font-size:${fontSize};font-weight:700;vertical-align:middle;line-height:1.8;">${Number(Math.round(entry.chargesAmount)).toLocaleString('en-IN')}</td>
    </tr>`;

    let pagesHTML = '';
    for (let p = 0; p < totalPages; p++) {
      const pageEntries = entries.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
      const isLastPage = p === totalPages - 1;

      let rows = '';
      pageEntries.forEach((entry, i) => {
        rows += makeRow(entry, p * ROWS_PER_PAGE + i);
      });

      const totalsHTML = isLastPage ? `
        <tr>
          <td colspan="${totalColSpan}" style="border-top:2px double #000;border-left:none;border-right:none;border-bottom:none;padding:8px 4px;text-align:right;font-size:${fontSize};font-weight:700;vertical-align:middle;line-height:1.8;">एकूण</td>
          <td style="border-top:2px double #000;border-left:none;border-right:none;border-bottom:none;padding:8px 4px;text-align:right;font-size:${fontSize};font-weight:700;vertical-align:middle;line-height:1.8;">${Number(Math.round(totalPrincipal)).toLocaleString('en-IN')}</td>
          <td style="border-top:2px double #000;border-left:none;border-right:none;border-bottom:none;padding:8px 4px;text-align:right;font-size:${fontSize};font-weight:700;vertical-align:middle;line-height:1.8;">${Number(Math.round(totalCharges)).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td colspan="${grandTotalColSpan}" style="border-top:2px double #000;border-bottom:2px double #000;border-left:none;border-right:none;padding:10px 4px;text-align:right;font-size:13px;font-weight:800;vertical-align:middle;line-height:1.8;">Grand Total</td>
          <td style="border-top:2px double #000;border-bottom:2px double #000;border-left:none;border-right:none;padding:10px 4px;text-align:right;font-size:13px;font-weight:800;vertical-align:middle;line-height:1.8;">${Number(Math.round(grandTotal)).toLocaleString('en-IN')}</td>
        </tr>` : '';

      const continuedNote = !isLastPage ? `<div style="text-align:right;font-size:${fontSize};color:#888;margin-top:1px;">पुढे चालू...</div>` : '';

      pagesHTML += `
      <div class="receipt-page" style="width:100%;padding:5mm 7mm;font-size:${fontSize};${p > 0 ? 'page-break-before:always;' : ''}">
        ${makeHeader(p + 1)}
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:2px;border:none;">
          ${makeTableHead()}
          <tbody>
            ${rows}
            ${totalsHTML}
          </tbody>
        </table>
        ${continuedNote}
      </div>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Noto Sans Devanagari',sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      @page { size:210mm 74mm landscape; margin:5mm; }
      @media print { body { margin:0; } tr { page-break-inside:avoid; } }
      table { border-collapse:collapse; width:100%; table-layout:fixed; }
      td, th { -webkit-print-color-adjust:exact; print-color-adjust:exact; overflow:hidden; text-overflow:ellipsis; word-wrap:break-word; }
    </style></head><body>
    ${pagesHTML}
    </body></html>`;
  }, []);

  const handleAddToSummary = useCallback(() => {
    if (!selectedLoan || !calculationResult) return;
    const finalInterestValue = form.getValues("finalInterestAmount");
    if (!finalInterestValue) return;

    const finalCharges = parseFinalInterest(finalInterestValue, calculationResult.interestAmount);

    let monthsDisplay = '';
    const currentInterestType = form.getValues("interestType");
    if (currentInterestType === "simple") {
      monthsDisplay = String(calculationResult.durationInDays || 0) + ' दिवस';
    } else {
      monthsDisplay = formatRate(calculationResult.durationInMonths ?? 0);
    }

    const effectiveRate = form.getValues("useCustomRate") && form.getValues("customInterestRate")
      ? form.getValues("customInterestRate")!
      : String(selectedLoan.interestRate);

    const entry: SummaryEntry = {
      id: summaryCounter,
      borrowerName: selectedLoan.borrowerName || '',
      borrowerAddress: selectedLoan.borrowerAddress || selectedLoan.address || '',
      groupName: getGroupName(selectedLoan.groupId) || '',
      collateralDetails: selectedLoan.collateralDetails || '',
      accountNumber: selectedLoan.accountNumber || '',
      loanDate: editableLoanDate || selectedLoan.loanDate || '',
      months: monthsDisplay,
      interestRate: effectiveRate,
      principalAmount: Number(selectedLoan.principalAmount) || 0,
      chargesAmount: Math.round(finalCharges),
      closureDate: form.getValues("closureDate"),
    };

    setSummaryEntries(prev => {
      const updated = [...prev, entry];
      updated.sort((a, b) => {
        const dateA = a.loanDate ? new Date(a.loanDate).getTime() : 0;
        const dateB = b.loanDate ? new Date(b.loanDate).getTime() : 0;
        return dateA - dateB;
      });
      return updated;
    });
    setSummaryCounter(prev => prev + 1);

    setSelectedLoan(null);
    setSearchQuery("");
    setCalculationResult(null);
    setShowLoanList(false);
    setEditableLoanDate("");
    form.setValue("loanId", "");
    form.setValue("finalInterestAmount", "");
    form.setValue("returnOfArticles", "");
    form.setValue("useCustomRate", false);
    form.setValue("customInterestRate", "");

    toast({
      title: "हिशोबात जोडले",
      description: `${entry.borrowerName} - ₹${entry.principalAmount.toLocaleString('en-IN')}`,
    });
  }, [selectedLoan, calculationResult, form, summaryCounter, parseFinalInterest, toast, editableLoanDate]);

  const handleDeleteSummaryEntry = useCallback((entryId: number) => {
    setSummaryEntries(prev => prev.filter(e => e.id !== entryId));
  }, []);

  const handleClearAllSummary = useCallback(() => {
    setSummaryEntries([]);
    setSummaryCounter(1);
  }, []);

  const handleGenerateSummaryReceipt = useCallback(() => {
    const currentEntries = summaryEntriesRef.current;
    if (currentEntries.length === 0) return;
    const html = generateMultiLoanReceiptHTML(currentEntries, showRateMonths, showDetails, printNameMode);
    if (isMobile) {
      setSummaryReceiptHTML(html);
      setShowSummaryReceipt(true);
    } else {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        if (printWindow.document.fonts && printWindow.document.fonts.ready) {
          printWindow.document.fonts.ready.then(() => {
            setTimeout(() => { printWindow.focus(); printWindow.print(); }, 200);
          });
        } else {
          setTimeout(() => { printWindow.focus(); printWindow.print(); }, 800);
        }
      }
    }
  }, [isMobile, generateMultiLoanReceiptHTML, showRateMonths, showDetails, printNameMode]);

  const createOffscreenReceiptContainer = useCallback((html: string): HTMLDivElement => {
    const a5LandscapeWidthPx = 794;
    const a5LandscapeHeightPx = 280;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.style.width = a5LandscapeWidthPx + 'px';
    wrapper.style.minWidth = a5LandscapeWidthPx + 'px';
    wrapper.style.maxWidth = a5LandscapeWidthPx + 'px';
    wrapper.style.background = 'white';
    wrapper.style.zIndex = '-9999';
    wrapper.style.overflow = 'hidden';

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body, div, table, td, th { font-family: 'Noto Sans Devanagari', sans-serif !important; }
      .receipt-page {
        width: ${a5LandscapeWidthPx}px !important;
        min-width: ${a5LandscapeWidthPx}px !important;
        max-width: ${a5LandscapeWidthPx}px !important;
        height: ${a5LandscapeHeightPx}px !important;
        overflow: hidden !important;
        box-shadow: none !important;
        margin: 0 !important;
        font-size: 10px !important;
        line-height: 1.8 !important;
        box-sizing: border-box !important;
        -webkit-font-smoothing: antialiased !important;
        text-rendering: optimizeLegibility !important;
      }
      table {
        border-collapse: collapse !important;
        width: 100% !important;
        table-layout: fixed !important;
      }
      td, th {
        word-wrap: break-word !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
    `;
    wrapper.appendChild(styleEl);

    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = html;
    wrapper.appendChild(contentDiv);

    document.body.appendChild(wrapper);
    return wrapper;
  }, []);

  const downloadReceiptAsPDF = useCallback(async () => {
    try {
      const currentEntries = summaryEntriesRef.current;
      if (!summaryReceiptHTML || currentEntries.length === 0) {
        toast({ title: "त्रुटी", description: "पावती सापडली नाही", variant: "destructive" });
        return;
      }

      const wrapper = createOffscreenReceiptContainer(summaryReceiptHTML);
      
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise(resolve => setTimeout(resolve, 500));

      const { default: html2canvas } = await import('html2canvas');

      const pages = wrapper.querySelectorAll('.receipt-page') as NodeListOf<HTMLElement>;
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [210, 74],
        compress: false,
      });

      const a5W = 210;
      const a5H = 74;

      if (pages.length > 0) {
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const canvas = await html2canvas(page, {
            scale: 6,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: 0,
            windowWidth: 794,
            windowHeight: 280,
          });
          const imgData = canvas.toDataURL('image/png', 1.0);
          if (i > 0) doc.addPage();
          doc.addImage(imgData, 'PNG', 0, 0, a5W, a5H);
        }
      } else {
        const canvas = await html2canvas(wrapper, {
          scale: 6,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 0,
          windowWidth: 794,
          windowHeight: 280,
        });
        const imgData = canvas.toDataURL('image/png', 1.0);
        doc.addImage(imgData, 'PNG', 0, 0, a5W, a5H);
      }

      document.body.removeChild(wrapper);

      const borrowerName = currentEntries[currentEntries.length - 1]?.borrowerName || 'पावती';
      doc.save(`पावती_${borrowerName}.pdf`);

      toast({ title: "यशस्वी", description: "PDF डाउनलोड झाले" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: "त्रुटी", description: "PDF तयार करण्यात समस्या आली", variant: "destructive" });
    }
  }, [summaryReceiptHTML, toast, createOffscreenReceiptContainer]);

  const generateThermalReceiptHTML = useCallback((entries: SummaryEntry[], nameMode: 'group' | 'customer' = 'group', showInterestRate: boolean = false): string => {
    if (entries.length === 0) return '';
    const totalPrincipal = entries.reduce((sum, e) => sum + e.principalAmount, 0);
    const totalCharges = entries.reduce((sum, e) => sum + e.chargesAmount, 0);
    const grandTotal = totalPrincipal + totalCharges;
    const lastEntry = entries[entries.length - 1];
    const closureDateFormatted = DateUtils.isoToIndianDate(lastEntry.closureDate);
    const displayName = nameMode === 'group' ? (lastEntry.groupName || lastEntry.borrowerName) : lastEntry.borrowerName;
    const displayAddress = nameMode === 'group' ? '' : (lastEntry.borrowerAddress || '');

    let rows = '';
    entries.forEach((entry, i) => {
      rows += `<tr>
        <td style="padding:14px 8px 14px 4px;text-align:center;font-size:16px;font-weight:600;">${i + 1}</td>
        <td style="padding:14px 8px;text-align:center;font-size:22px;font-weight:700;">${entry.accountNumber}</td>
        <td style="padding:14px 4px;text-align:right;font-size:22px;font-weight:700;">${toShortDate(entry.loanDate)}${showInterestRate ? `<span style="margin-left:16px;font-size:20px;font-weight:600;">${formatRate(entry.interestRate)}</span>` : ''}</td>
        <td style="padding:14px 4px;text-align:right;font-size:22px;font-weight:700;">${Number(Math.round(entry.principalAmount)).toLocaleString('en-IN')}</td>
        <td style="padding:14px 4px;text-align:right;font-size:22px;font-weight:700;">${Number(Math.round(entry.chargesAmount)).toLocaleString('en-IN')}</td>
      </tr>`;
    });

    return `
      <div style="padding:6px 12px;font-family:'Noto Sans Devanagari',sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
          <div style="font-weight:800;font-size:26px;line-height:1.4;">${displayName}</div>
          <div style="font-size:22px;font-weight:700;white-space:nowrap;line-height:1.4;">तारीख: ${closureDateFormatted}</div>
        </div>
        ${displayAddress ? `<div style="font-size:18px;color:#333;margin-bottom:4px;">${displayAddress}</div>` : ''}
        <div style="text-align:center;font-weight:800;font-size:24px;margin-bottom:10px;"><span style="border-bottom:2px solid #000;padding-bottom:6px;">Estimate</span></div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <colgroup>
            <col style="width:46px;">
            <col style="width:90px;">
            <col style="width:120px;">
            <col style="width:auto;">
            <col style="width:110px;">
          </colgroup>
          <thead>
            <tr style="border-bottom:3px double #000;">
              <th style="padding:10px 8px 10px 4px;font-size:22px;text-align:center;font-weight:700;">अ.नं.</th>
              <th style="padding:10px 8px;font-size:22px;text-align:center;font-weight:700;">कोड नं</th>
              <th style="padding:10px 4px;font-size:22px;text-align:right;font-weight:700;">दिनांक</th>
              <th style="padding:10px 4px;font-size:22px;text-align:right;font-weight:700;">बाजारमूल्य</th>
              <th style="padding:10px 4px;font-size:22px;text-align:right;font-weight:700;">चार्जेस</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr style="border-top:3px double #000;">
              <td colspan="3" style="padding:12px 4px;text-align:right;font-size:22px;font-weight:700;">एकूण</td>
              <td style="padding:12px 4px;text-align:right;font-size:22px;font-weight:700;">${Number(Math.round(totalPrincipal)).toLocaleString('en-IN')}</td>
              <td style="padding:12px 4px;text-align:right;font-size:22px;font-weight:700;">${Number(Math.round(totalCharges)).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-top:3px double #000;">
              <td colspan="5" style="padding:16px 4px;text-align:center;font-size:32px;font-weight:900;">Grand Total : ${Number(Math.round(grandTotal)).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }, []);

  const renderReceiptToCanvas = useCallback(async (thermalHTML: string): Promise<HTMLCanvasElement> => {
    const thermalWidth = 576;
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = `${thermalWidth}px`;
    container.style.background = '#fff';
    container.style.padding = '0';
    container.style.fontFamily = "'Noto Sans Devanagari', 'Mangal', sans-serif";
    container.style.fontWeight = '700';
    container.innerHTML = thermalHTML;
    document.body.appendChild(container);

    await new Promise(resolve => setTimeout(resolve, 300));

    const canvas = await html2canvas(container, {
      width: thermalWidth,
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });

    document.body.removeChild(container);
    return canvas;
  }, []);

  const btPrintBtnRef = useRef<HTMLButtonElement>(null);

  const handleBluetoothPrint = useCallback(async () => {
    const currentEntries = summaryEntriesRef.current;
    if (currentEntries.length === 0 || isBtPrinting) return;
    const thermalHTML = generateThermalReceiptHTML(currentEntries, printNameMode, showRateMonths);
    if (!thermalHTML) return;

    setIsBtPrinting(true);
    try {
      const canvas = await renderReceiptToCanvas(thermalHTML);
      toast({ title: "कनेक्ट करत आहे...", description: "ब्लूटूथ प्रिंटर निवडा" });
      await printReceiptViaBluetooth(canvas, 576);
      toast({ title: "यशस्वी", description: "प्रिंट पाठवले!" });
    } catch (error: any) {
      if (error?.message?.includes('cancelled') || error?.message?.includes('User cancelled')) {
        return;
      }
      const errMsg = error?.message || error?.name || String(error);
      console.error("Bluetooth print error:", errMsg, error);
      toast({ title: "ब्लूटूथ प्रिंट अयशस्वी", description: errMsg || "कृपया पुन्हा प्रयत्न करा", variant: "destructive" });
    } finally {
      setIsBtPrinting(false);
      if (btPrintBtnRef.current) {
        btPrintBtnRef.current.blur();
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [generateThermalReceiptHTML, toast, renderReceiptToCanvas, isBtPrinting, printNameMode, showRateMonths]);

  const recalculateWithOriginalDate = useCallback((data: ClosureFormData) => {
    if (!selectedLoan) return null;
    
    const originalLoanDate = selectedLoan.loanDate;
    const closureDate = new Date(data.closureDate);
    const { interestType, useCustomRate, customInterestRate: customRate, compoundingFrequency, advancedCalculationMode } = data;

    let effectiveRate = useCustomRate && customRate ? 
      Number(customRate) : Number(selectedLoan.interestRate);
    
    if (interestType !== "simple" && selectedLoan.interestRateType === "yearly") {
      effectiveRate = effectiveRate / 12;
    }

    try {
      let result;
      
      if (interestType === "simple") {
        let simpleInterestRate = effectiveRate;
        if (selectedLoan.interestRateType === "monthly") {
          simpleInterestRate = effectiveRate * 12;
        }
        
        const timePeriod = LoanCalculationsAdvanced.calculateTimePeriod(
          new Date(originalLoanDate),
          closureDate
        );
        
        const timeInDays = timePeriod.totalDays;
        const principalNum = Number(selectedLoan.principalAmount);
        const interestAmount = LoanCalculations.calculateSimpleInterest(
          principalNum,
          simpleInterestRate,
          timeInDays
        );
        
        const calcModeMap: Record<string, string> = {
          'month': 'month',
          'half_month': 'half-month',
          'week': 'week',
          'day': 'daily'
        };
        const closureCalcResult = LoanCalculationsAdvanced.calculateInterestForClosure(
          principalNum,
          effectiveRate,
          new Date(originalLoanDate),
          closureDate,
          'simple',
          (calcModeMap[advancedCalculationMode] || 'half-month') as any
        );
        
        result = {
          interestAmount: interestAmount,
          totalPayable: principalNum + interestAmount,
          durationInDays: timeInDays,
          durationInMonths: closureCalcResult.durationInMonths,
          years: timePeriod.years,
          months: timePeriod.months,
          days: timePeriod.days,
          breakdown: {
            principalAmount: principalNum,
            interestRate: simpleInterestRate,
            calculationType: 'simple' as const,
            calculationMode: (calcModeMap[advancedCalculationMode] || 'daily') as any,
            periodUsed: `${timeInDays} दिवस`
          }
        };
      } else {
        const advancedResult = LoanCalculationsAdvanced.calculateAdvancedCompoundInterest(
          Number(selectedLoan.principalAmount),
          effectiveRate,
          new Date(originalLoanDate),
          closureDate,
          compoundingFrequency,
          advancedCalculationMode
        );
        
        const timePeriod = LoanCalculationsAdvanced.calculateTimePeriod(
          new Date(originalLoanDate),
          closureDate
        );

        const compoundCalcModeMap: Record<string, string> = {
          'month': 'month',
          'half_month': 'half-month',
          'week': 'week',
          'day': 'daily'
        };
        const compoundClosureCalc = LoanCalculationsAdvanced.calculateInterestForClosure(
          Number(selectedLoan.principalAmount),
          effectiveRate,
          new Date(originalLoanDate),
          closureDate,
          'simple',
          (compoundCalcModeMap[advancedCalculationMode] || 'half-month') as any
        );
        
        result = {
          ...advancedResult,
          durationInMonths: compoundClosureCalc.durationInMonths,
          durationInDays: timePeriod.totalDays,
          years: timePeriod.years,
          months: timePeriod.months,
          days: timePeriod.days
        };
      }
      
      return result;
    } catch (error) {
      console.error("Recalculation error:", error);
      return null;
    }
  }, [selectedLoan]);

  const onSubmit = useCallback(async (data: ClosureFormData) => {
    if (!selectedLoan || !calculationResult) {
      toast({
        title: "त्रुटी",
        description: "कृपया प्रथम कर्ज निवडा आणि गणना करा",
        variant: "destructive",
      });
      return;
    }

    const isDateModified = editableLoanDate && selectedLoan.loanDate && editableLoanDate !== selectedLoan.loanDate;

    let finalCalcResult = calculationResult;

    if (isDateModified) {
      toast({
        title: "⚠️ कर्ज वाटप दिनांक बदलली होती",
        description: `मूळ दिनांक (${DateUtils.formatDate(selectedLoan.loanDate)}) ने पुनर्गणना करून सेव केले जात आहे`,
      });

      setEditableLoanDate(selectedLoan.loanDate);

      const recalculated = recalculateWithOriginalDate(data);
      if (recalculated) {
        finalCalcResult = recalculated;
        setCalculationResult(recalculated);
        form.setValue("finalInterestAmount", recalculated.interestAmount.toString());
      }
    }

    const finalInterest = isDateModified && finalCalcResult 
      ? finalCalcResult.interestAmount 
      : parseFinalInterest(data.finalInterestAmount, finalCalcResult.interestAmount);
    const principal = Number(selectedLoan.principalAmount);
    const totalAmount = principal + finalInterest;

    try {
      await cleanupMutation.mutateAsync({
        amount: totalAmount,
        accountNumber: selectedLoan.accountNumber || ""
      });
    } catch (error) {
    }

    const closureData = {
      loanId: data.loanId,
      closureDate: data.closureDate,
      principalPaid: principal,
      interestPaid: finalInterest,
      totalAmount: totalAmount,
      calculatedInterest: finalCalcResult.interestAmount,
      actualPaidAmount: totalAmount,
      balanceRefund: 0,
      interestType: data.interestType,
      advancedCalculationMode: data.advancedCalculationMode,
      durationInMonths: finalCalcResult.durationInMonths,
      returnOfArticles: data.returnOfArticles,
      isClosed: data.isClosed,
      advancedOverride: finalInterest !== finalCalcResult.interestAmount,
      interestVariance: finalInterest - finalCalcResult.interestAmount,
      varianceReason: finalInterest !== finalCalcResult.interestAmount ? 
        "हस्तचलित समायोजन" : "गणना प्रमाणे",
    };

    closureMutation.mutate(closureData);
  }, [selectedLoan, calculationResult, form, cleanupMutation, closureMutation, toast, editableLoanDate, recalculateWithOriginalDate]);

  if (showSummaryReceipt && summaryReceiptHTML) {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-50 bg-green-50 border-b px-3 py-3 print:hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <FileText className="h-5 w-5" />
              एकत्रित पावती
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowSummaryReceipt(false);
                setSummaryReceiptHTML(null);
              }}
            >
              <X className="mr-1 h-4 w-4" />
              बंद करा
            </Button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const printWindow = window.open('', '_blank');
                if (printWindow && summaryReceiptHTML) {
                  printWindow.document.write(summaryReceiptHTML);
                  printWindow.document.close();
                  if (printWindow.document.fonts && printWindow.document.fonts.ready) {
                    printWindow.document.fonts.ready.then(() => {
                      setTimeout(() => { printWindow.focus(); printWindow.print(); }, 200);
                    });
                  } else {
                    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 800);
                  }
                }
              }}
              className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-3 bg-green-600 hover:bg-green-700 text-white"
            >
              <Printer className="mr-2 h-4 w-4" />
              प्रिंट करा
            </button>
            <button
              type="button"
              onClick={downloadReceiptAsPDF}
              className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-3 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="mr-2 h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
        <div
          className="p-2 bg-white overflow-x-auto"
          style={{ maxWidth: '100%', fontSize: '11px', lineHeight: '1.4' }}
          dangerouslySetInnerHTML={{ __html: summaryReceiptHTML }}
        />
      </div>
    );
  }

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
              <div className="flex items-center gap-4 mb-4">
                <Link href="/">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    मुखपृष्ठ
                  </Button>
                </Link>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-12 bg-white shadow-sm border">
                <TabsTrigger 
                  value="closure" 
                  className="text-sm font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  कर्ज बंद करा
                </TabsTrigger>
                <TabsTrigger 
                  value="summary" 
                  className="text-sm font-semibold data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all relative"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  हिशोबात
                  {summaryEntries.length > 0 && (
                    <Badge className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0 min-w-[20px] h-5 flex items-center justify-center rounded-full">
                      {summaryEntries.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="closure" className="mt-0">
            <Card className="shadow-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200">
              
              <CardContent className="p-6 bg-white rounded-lg">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" autoComplete="off">
                    
                    {/* Enhanced Loan Search - Only show if not from URL */}
                    {!hideSearch && (
                      <div className="space-y-4">
                        <Label className="font-noto text-lg">कर्ज निवडा</Label>
                        
                        {/* Group Selection First */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">ग्रुप</Label>
                            <Select value={selectedSearchGroup} onValueChange={setSelectedSearchGroup}>
                              <SelectTrigger>
                                <SelectValue placeholder="ग्रुप निवडा..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">सर्व ग्रुप</SelectItem>
                                {(groups as any[])?.map((group: any) => (
                                  <SelectItem key={group.id} value={group.id}>
                                    {group.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-sm font-medium">सर्च: खाते क्रमांक → रक्कम → नाव</Label>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                type="text"
                                placeholder="66, 1000, उमेश..."
                                value={searchQuery}
                                onChange={(e) => {
                                  const converted = e.target.value.replace(/[०-९]/g, (d: string) => String('०१२३४५६७८९'.indexOf(d)));
                                  setSearchQuery(converted);
                                  setShowLoanList(converted.trim().length > 0);
                                }}
                                onFocus={() => {
                                  if (searchQuery.trim()) {
                                    setShowLoanList(true);
                                  }
                                }}
                                className="pl-10"
                                autoComplete="off"
                              />
                              {showLoanList && searchQuery && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                  onClick={() => {
                                    setSearchQuery("");
                                    setShowLoanList(false);
                                    setSelectedLoan(null);
                                    form.setValue("loanId", "");
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Loan Selection List */}
                        {showLoanList && filteredLoans.length > 0 && (
                          <Card className="border border-gray-300 max-h-60 overflow-y-auto">
                            <CardContent className="p-0">
                              {filteredLoans.map((loan: any) => (
                                <div
                                  key={loan.id}
                                  className="p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                                  onClick={() => handleLoanSelect(loan)}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="font-medium text-blue-800">{loan.borrowerName}</div>
                                      <div className="text-sm text-gray-600">
                                        खाते क्रमांक: {loan.accountNumber} | ग्रुप: {getGroupName(loan.groupId)}
                                      </div>
                                      <div className="text-sm text-green-600">
                                        मुद्दल: ₹{Math.round(loan.principalAmount).toLocaleString('en-IN')} | दर: {formatRate(loan.interestRate)}% {loan.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}
                                      </div>
                                      {loan.collateralDetails && (
                                        <div className="text-sm text-purple-600">
                                          वस्तू: {loan.collateralDetails} {loan.weight && `| वजन: ${loan.weight}`}
                                        </div>
                                      )}
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      {DateUtils.formatDate(loan.loanDate)}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}

                    {/* Selected Loan Info */}
                    {selectedLoan && (
                      <Card className="border-green-200 bg-green-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-green-800 flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" />
                            निवडलेले कर्ज
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">कर्जदाराचे नाव:</span> {selectedLoan.borrowerName}
                            </div>
                            <div>
                              <span className="font-medium">ग्रुप:</span> {getGroupName(selectedLoan.groupId)}
                            </div>
                            <div>
                              <span className="font-medium">खाते क्रमांक:</span> {selectedLoan.accountNumber}
                            </div>
                            <div>
                              <span className="font-medium">मुद्दल रक्कम:</span> ₹{Math.round(selectedLoan.principalAmount).toLocaleString('en-IN')}
                            </div>
                            <div>
                              <span className="font-medium">व्याजदर:</span> {formatRate(selectedLoan.interestRate)}% {selectedLoan.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}
                            </div>
                            <div>
                              <span className="font-medium">वाटप दिनांक:</span>{' '}
                              <Input 
                                type="date" 
                                value={editableLoanDate} 
                                onChange={(e) => {
                                  setEditableLoanDate(e.target.value);
                                  setCalculationResult(null);
                                  form.setValue("finalInterestAmount", "");
                                }}
                                className="inline-block w-auto h-7 px-2 py-0 text-sm border-blue-300"
                              />
                              {editableLoanDate && selectedLoan.loanDate && editableLoanDate !== selectedLoan.loanDate && (
                                <span className="ml-2 text-xs text-orange-600 font-medium">
                                  (मूळ: {DateUtils.formatDate(selectedLoan.loanDate)})
                                </span>
                              )}
                            </div>
                            {selectedLoan.collateralDetails && (
                              <div className="md:col-span-2">
                                <span className="font-medium">वस्तूचे वर्णन:</span> {selectedLoan.collateralDetails}
                              </div>
                            )}
                            {selectedLoan.weight && (
                              <div>
                                <span className="font-medium">वजन:</span> {selectedLoan.weight}
                              </div>
                            )}
                          </div>
                          
                          {/* Photo Viewer Section for Closure */}
                          {selectedLoan.id && (
                            <div className="mt-4 p-4 border rounded-lg bg-amber-50">
                              <PhotoViewer 
                                loanId={selectedLoan.id} 
                                loanAccountNumber={selectedLoan.accountNumber}
                                readonly={true}
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Closure Date */}
                    <FormField
                      control={form.control}
                      name="closureDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>बंद करण्याची तारीख</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium whitespace-nowrap">पावतीवर नाव:</Label>
                      <div className="flex rounded-lg border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setPrintNameMode('group')}
                          className={`px-3 py-1.5 text-sm font-medium transition-colors ${printNameMode === 'group' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                          ग्रुप
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintNameMode('customer')}
                          className={`px-3 py-1.5 text-sm font-medium transition-colors border-l ${printNameMode === 'customer' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                          कस्टमर
                        </button>
                      </div>
                    </div>

                    {/* Interest Type Selection */}
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="interestType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-noto">व्याज प्रकार</FormLabel>
                            <FormControl>
                              <RadioGroup
                                value={field.value}
                                onValueChange={field.onChange}
                                className="grid grid-cols-1 md:grid-cols-3 gap-4"
                              >
                                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-blue-50">
                                  <RadioGroupItem value="simple" id="simple" />
                                  <Label htmlFor="simple" className="cursor-pointer font-noto">
                                    <div className="font-medium">साधे व्याज</div>
                                    <div className="text-xs text-gray-600">दिवसांप्रमाणे</div>
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-orange-50">
                                  <RadioGroupItem value="compound" id="compound" />
                                  <Label htmlFor="compound" className="cursor-pointer font-noto">
                                    <div className="font-medium">चक्रवाढ व्याज</div>
                                    <div className="text-xs text-gray-600">मानक चक्रवाढ</div>
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-purple-50">
                                  <RadioGroupItem value="advanced_compound" id="advanced_compound" />
                                  <Label htmlFor="advanced_compound" className="cursor-pointer font-noto">
                                    <div className="font-medium">प्रगत चक्रवाढ</div>
                                    <div className="text-xs text-gray-600">कॅलेंडर अचूकता</div>
                                  </Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Custom Interest Rate Section */}
                      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <FormField
                          control={form.control}
                          name="useCustomRate"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-3">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div>
                                <FormLabel className="font-noto text-orange-800">
                                  कस्टम व्याजदर वापरा
                                </FormLabel>
                                <FormDescription className="text-xs text-orange-600">
                                  {selectedLoan && `मूळ दर: ${formatRate(selectedLoan.interestRate)}% ${selectedLoan.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}`}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        {form.watch("useCustomRate") && (
                          <FormField
                            control={form.control}
                            name="customInterestRate"
                            render={({ field }) => (
                              <FormItem className="mt-3">
                                <FormLabel className="font-noto text-orange-800">
                                  नवा व्याजदर (% {selectedLoan?.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'})
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="उदा. 18"
                                    value={field.value}
                                    onChange={field.onChange}
                                    className="font-inter bg-white border-orange-300"
                                  />
                                </FormControl>
                                <FormDescription className="text-xs text-orange-600">
                                  {selectedLoan?.interestRateType === 'monthly' ? 'मासिक दरासाठी: 1.5%' : 'वार्षिक दरासाठी: 18%'}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    </div>

                    {/* Advanced options for compound interest */}
                    {form.watch("interestType") !== "simple" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-300">
                        <FormField
                          control={form.control}
                          name="compoundingFrequency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-noto">चक्रवाढ वारंवारता</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="फ्रिक्वेंसी निवडा" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="yearly">वार्षिक</SelectItem>
                                  <SelectItem value="half_yearly">अर्धवार्षिक</SelectItem>
                                  <SelectItem value="quarterly">तिमाही</SelectItem>
                                  <SelectItem value="monthly">मासिक</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {form.watch("interestType") === "advanced_compound" && (
                          <FormField
                            control={form.control}
                            name="advancedCalculationMode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="font-noto">प्रगत गणना पद्धत</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="गणना पद्धत निवडा" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="month">महिना (30 दिवसापर्यंत = 1 महिना)</SelectItem>
                                    <SelectItem value="half_month">अर्धा महिना (0-15 दिवस = 0.5 महिना)</SelectItem>
                                    <SelectItem value="week">आठवडा (8 दिवसापर्यंत = 0.25 महिना)</SelectItem>
                                    <SelectItem value="day">दिवस (प्रत्येक दिवस वेगळा)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    )}

                    {/* Calculate Interest Button */}
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        onClick={calculateInterest}
                        disabled={!selectedLoan}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg"
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        व्याज गणना करा
                      </Button>
                    </div>

                    {/* Calculation Results */}
                    {calculationResult && (
                      <Card className="border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-blue-800 flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            गणना निकाल
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {/* Duration Display - Same as Interest Calculator */}
                          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-800">
                              <Calendar className="h-5 w-5" />
                              कर्ज कालावधी
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                              <div>
                                <div className="text-2xl font-bold text-blue-600">{calculationResult.durationInDays}</div>
                                <div className="text-sm text-gray-600">एकूण दिवस</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-orange-600">{calculationResult.years || 0}</div>
                                <div className="text-sm text-gray-600">वर्षे</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-green-600">{calculationResult.months || 0}</div>
                                <div className="text-sm text-gray-600">महिने</div>
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-purple-600">{calculationResult.days || 0}</div>
                                <div className="text-sm text-gray-600">दिवस</div>
                              </div>
                            </div>
                            {calculationResult.durationInMonths !== undefined && (
                              <div className="mt-3 pt-2 border-t border-blue-100 text-center">
                                <span className="text-sm text-gray-600">
                                  {form.watch("interestType") === "simple" 
                                    ? "एकूण कालावधी: " 
                                    : "गणना महिने: "}
                                </span>
                                <span className="text-lg font-bold text-indigo-700">
                                  {form.watch("interestType") === "simple"
                                    ? `${calculationResult.durationInDays} दिवस`
                                    : `${calculationResult.durationInMonths} महिने`}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Amount Display */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">मुद्दल रक्कम</span>
                                <span className="text-lg font-semibold text-blue-600">
                                  ₹{Number(selectedLoan?.principalAmount || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">गणना केलेले व्याज</span>
                                <span className="text-lg font-semibold text-orange-600">
                                  ₹{Math.round(calculationResult.interestAmount || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-300">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">एकूण देय रक्कम</span>
                                <span className="text-xl font-bold text-green-600">
                                  ₹{Math.round((calculationResult.totalPayable !== undefined && calculationResult.totalPayable !== null) 
                                    ? calculationResult.totalPayable 
                                    : (Number(selectedLoan?.principalAmount || 0) + (calculationResult.interestAmount || 0))
                                  ).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* SIMPLIFIED: Single Final Interest Amount Field */}
                    <Card className="border-purple-200 bg-purple-50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-purple-800 flex items-center gap-2">
                          <Edit className="h-5 w-5" />
                          व्याज रक्कम ठरवा
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FormField
                          control={form.control}
                          name="finalInterestAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-noto text-lg text-purple-800">
                                व्याज ₹
                              </FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <Input 
                                    type="text" 
                                    placeholder="व्याज रक्कम टाका"
                                    value={field.value}
                                    onChange={(e) => {
                                      field.onChange(e.target.value);
                                    }}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                    className="text-xl font-bold border-purple-300 bg-white text-purple-800"
                                  />
                                  
                                  {calculationResult && (
                                    <div className="flex gap-2 flex-wrap">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => form.setValue("finalInterestAmount", "0")}
                                        className="text-xs"
                                      >
                                        फक्त मुद्दल (0)
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => form.setValue("finalInterestAmount", Math.round(calculationResult.interestAmount / 2).toString())}
                                        className="text-xs"
                                      >
                                        अर्धा व्याज
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => form.setValue("finalInterestAmount", Math.round(calculationResult.interestAmount).toString())}
                                        className="text-xs"
                                      >
                                        पूर्ण गणना
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                              
                              {calculationResult && form.watch("finalInterestAmount") && (() => {
                                const enteredValue = form.watch("finalInterestAmount");
                                const finalInterest = parseFinalInterest(enteredValue, calculationResult.interestAmount);
                                const totalPayable = Number(selectedLoan?.principalAmount || 0) + finalInterest;
                                
                                return (
                                  <div className="mt-2 p-2 bg-white rounded border">
                                    <div className="text-sm">
                                      <div className="flex justify-between">
                                        <span>गणना केलेले व्याज:</span>
                                        <span>₹{Math.round(calculationResult.interestAmount)}</span>
                                      </div>
                                      <div className="flex justify-between font-medium">
                                        <span>अंतिम व्याज:</span>
                                        <span>₹{Math.round(finalInterest)}</span>
                                      </div>
                                      <div className="flex justify-between font-bold text-green-700 border-t pt-1">
                                        <span>एकूण देय रक्कम:</span>
                                        <span>₹{totalPayable.toLocaleString('en-IN')}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                              
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>

                    {/* Photo management moved to loan creation form */}

                    {/* Return of Articles */}
                    <FormField
                      control={form.control}
                      name="returnOfArticles"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-noto">परत द्यायचे दागिने</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="परत केलेल्या वस्तूंची माहिती..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Is Closed Checkbox */}
                    <FormField
                      control={form.control}
                      name="isClosed"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-noto">कर्ज बंद करा</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    <Separator />

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-end">
                      <Button
                        type="button"
                        onClick={handleAddToSummary}
                        disabled={!selectedLoan || !calculationResult || !form.watch("finalInterestAmount")}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transform hover:scale-105 transition-all duration-300"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                      <Button
                        type="submit"
                        disabled={closureMutation.isPending || cleanupMutation.isPending || !selectedLoan || !form.watch("finalInterestAmount")}
                        className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 transform hover:scale-105 transition-all duration-300"
                      >
                        {(closureMutation.isPending || cleanupMutation.isPending) ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {cleanupMutation.isPending ? "मॅन्युअल इंट्री साफ करत आहे..." : "कर्ज बंद करत आहे..."}
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            कर्ज बंद करा
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
              </TabsContent>

              <TabsContent value="summary" className="mt-0">
                {summaryEntries.length > 0 ? (
                  <Card className="border border-amber-200 shadow-lg bg-white">
                    <CardHeader className="py-3 px-4 bg-amber-50 border-b">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <CardTitle className="text-base font-semibold text-amber-800 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          एकत्रित हिशोब ({summaryEntries.length})
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 mr-2">
                            <span className="text-xs text-gray-600">तपशील/महिने</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showDetails}
                                onChange={(e) => summaryColumnsToggle.mutate({ enabled: e.target.checked, field: 'showSummaryDetails' })}
                                className="sr-only peer"
                                disabled={summaryColumnsToggle.isPending || !company}
                                autoComplete="off"
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                            </label>
                          </div>
                          <div className="flex items-center gap-1.5 mr-2">
                            <span className="text-xs text-gray-600">व्याजदर</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showRateMonths}
                                onChange={(e) => summaryColumnsToggle.mutate({ enabled: e.target.checked })}
                                className="sr-only peer"
                                disabled={summaryColumnsToggle.isPending || !company}
                                autoComplete="off"
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={handleGenerateSummaryReceipt}
                            className="inline-flex items-center rounded-md px-3 h-9 text-xs border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200 transition-colors outline-none"
                          >
                            <Printer className="h-3 w-3 mr-1" />
                            पावती तयार करा
                          </button>
                          <button
                            ref={btPrintBtnRef}
                            type="button"
                            onClick={handleBluetoothPrint}
                            className="inline-flex items-center rounded-md px-3 h-9 text-xs border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200 transition-colors outline-none"
                          >
                            <Bluetooth className="h-3 w-3 mr-1" />
                            ब्लूटूथ प्रिंट
                          </button>
                          <button
                            type="button"
                            onClick={handleClearAllSummary}
                            className="inline-flex items-center rounded-md px-3 h-9 text-xs border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 transition-colors outline-none"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            सर्व काढा
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {summaryEntries.length > 0 && (
                        <div className="flex justify-between items-start px-3 pt-2 pb-1">
                          <div>
                            <div className="font-bold text-sm">{summaryEntries[summaryEntries.length - 1].borrowerName}</div>
                            {summaryEntries[summaryEntries.length - 1].borrowerAddress && (
                              <div className="text-xs text-gray-500">{summaryEntries[summaryEntries.length - 1].borrowerAddress}</div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 text-right">
                            तारीख: {DateUtils.isoToIndianDate(summaryEntries[summaryEntries.length - 1].closureDate)}
                          </div>
                        </div>
                      )}
                      <div className="text-center font-bold text-sm py-1 underline">Estimate</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-100 text-xs">
                              <th className="border border-gray-300 px-1 py-1 text-center w-8">अ.नं.</th>
                              {showDetails && <th className="border border-gray-300 px-2 py-1 text-left">तपशील</th>}
                              <th className="border border-gray-300 px-1 py-1 text-center w-16 font-bold">कोड नं</th>
                              <th className="border border-gray-300 px-1 py-1 text-center w-20">दिनांक</th>
                              {showDetails && <th className="border border-gray-300 px-1 py-1 text-center w-10"></th>}
                              <th className="border border-gray-300 px-2 py-1 text-right w-24">बाजारमूल्य</th>
                              <th className="border border-gray-300 px-2 py-1 text-right w-20">चार्जेस</th>
                              <th className="border border-gray-300 px-1 py-1 w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryEntries.map((entry, index) => (
                              <tr key={entry.id} className="hover:bg-gray-50">
                                <td className="border border-gray-300 px-1 py-1 text-center text-xs">{index + 1}</td>
                                {showDetails && <td className="border border-gray-300 px-2 py-1 text-xs"><div className="max-w-[120px] truncate" title={entry.collateralDetails || '-'}>{entry.collateralDetails || '-'}</div></td>}
                                <td className="border border-gray-300 px-1 py-1 text-center text-xs font-bold">{entry.accountNumber}</td>
                                <td className="border border-gray-300 px-1 py-1 text-center text-xs">{toShortDate(entry.loanDate)}{showRateMonths ? <span className="ml-4 text-xs font-normal">{formatRate(entry.interestRate)}</span> : ''}</td>
                                {showDetails && <td className="border border-gray-300 px-1 py-1 text-center text-xs">{entry.months}</td>}
                                <td className="border border-gray-300 px-2 py-1 text-right text-xs font-bold">{Number(Math.round(entry.principalAmount)).toLocaleString('en-IN')}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right text-xs font-bold">{Number(Math.round(entry.chargesAmount)).toLocaleString('en-IN')}</td>
                                <td className="border border-gray-300 px-1 py-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSummaryEntry(entry.id)}
                                    className="text-red-500 hover:text-red-700 p-0.5"
                                    title="काढा"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold">
                              <td colSpan={1 + (showDetails ? 2 : 0) + 2} className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold">एकूण</td>
                              <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold">
                                {Number(Math.round(summaryEntries.reduce((sum, e) => sum + e.principalAmount, 0))).toLocaleString('en-IN')}
                              </td>
                              <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold">
                                {Number(Math.round(summaryEntries.reduce((sum, e) => sum + e.chargesAmount, 0))).toLocaleString('en-IN')}
                              </td>
                              <td className="border border-gray-300"></td>
                            </tr>
                            <tr className="bg-amber-50 font-bold">
                              <td colSpan={1 + (showDetails ? 2 : 0) + 2 + 1} className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold">Grand Total</td>
                              <td className="border border-gray-300 px-2 py-1.5 text-right text-sm font-bold text-green-700">
                                {Number(Math.round(summaryEntries.reduce((sum, e) => sum + e.principalAmount + e.chargesAmount, 0))).toLocaleString('en-IN')}
                              </td>
                              <td className="border border-gray-300"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="text-center py-16">
                      <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-500 mb-2">हिशोबात कोणतेही कर्ज नाही</h3>
                      <p className="text-sm text-gray-400 mb-4">
                        कर्ज बंद करा टॅब मधून "Add" बटण दाबून कर्ज जोडा
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={() => setActiveTab("closure")}
                        className="text-blue-600 border-blue-300"
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        कर्ज बंद करा टॅब वर जा
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}