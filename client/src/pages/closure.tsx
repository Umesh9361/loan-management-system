import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Calculator, FileText, AlertTriangle, CheckCircle, Download, Search, X, Clock, Edit, Calendar, Lightbulb, Sparkles, TrendingUp, Info, Check, AlertCircle, Home } from "lucide-react";
import { PhotoViewer } from "@/components/ui/photo-viewer";
import { Link } from "wouter";

// Simplified Schema - एक ही field for final interest amount
const closureSchema = z.object({
  loanId: z.string().min(1, "कर्ज निवडणे आवश्यक"),
  closureDate: z.string().min(1, "तारीख आवश्यक"),
  interestType: z.enum(["simple", "compound", "advanced_compound"]).default("simple"),
  compoundingFrequency: z.enum(["yearly", "half_yearly", "quarterly", "monthly"]).default("yearly"),
  advancedCalculationMode: z.enum(["month", "half_month", "week", "day"]).default("half_month"),
  finalInterestAmount: z.string().min(1, "अंतिम व्याज रक्कम आवश्यक"),
  returnOfArticles: z.string().optional(),
  isClosed: z.boolean().default(true),
  useCustomRate: z.boolean().default(false),
  customInterestRate: z.string().optional(),
});

type ClosureFormData = z.infer<typeof closureSchema>;

export default function Closure() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLoanList, setShowLoanList] = useState(false);
  const [selectedSearchGroup, setSelectedSearchGroup] = useState<string>("all");
  // Photo management moved to loan creation form
  
  // Check if loanId passed in URL
  const urlParams = new URLSearchParams(window.location.search);
  const loanIdFromUrl = urlParams.get('loanId');
  const hideSearch = !!loanIdFromUrl;

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
    // Reset calculations when loan changes
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
      
      if (interestType === "simple") {
        // Handle rate conversion for Simple Interest
        let simpleInterestRate = effectiveRate;
        if (selectedLoan.interestRateType === "monthly") {
          simpleInterestRate = effectiveRate * 12; // Convert monthly to yearly for 365-day formula
        }
        
        // Use calendar-based calculation (same as fixed interest calculator)
        const timePeriod = LoanCalculationsAdvanced.calculateTimePeriod(
          new Date(selectedLoan.loanDate),
          closureDate
        );
        
        const timeInDays = timePeriod.totalDays;
        const years = timePeriod.years;
        const months = timePeriod.months;
        const days = timePeriod.days;
        
        // Use proper banking standard 365-day calculation
        const principalNum = Number(selectedLoan.principalAmount);
        const interestAmount = LoanCalculations.calculateSimpleInterest(
          principalNum,
          simpleInterestRate,
          timeInDays
        );
        
        
        result = {
          interestAmount: interestAmount,
          totalPayable: principalNum + interestAmount,
          durationInDays: timeInDays,
          durationInMonths: Math.round(timeInDays / 30),
          // Add detailed period breakdown
          years: years,
          months: months,  
          days: days,
          breakdown: {
            principalAmount: Number(selectedLoan.principalAmount),
            interestRate: simpleInterestRate,
            calculationType: 'simple' as const,
            calculationMode: 'daily' as const,
            periodUsed: `${timeInDays} दिवस`
          }
        };
      } else {
        // For compound interest, use advanced calculations
        
        // Debug closure form calculation parameters
        const debugParams = {
          principal: selectedLoan.principalAmount,
          effectiveRate,
          originalRate: selectedLoan.interestRate,
          rateType: selectedLoan.interestRateType,
          loanDate: selectedLoan.loanDate,
          closureDate: form.watch("closureDate"),
          compoundingFrequency: form.watch("compoundingFrequency"),
          calculationMode: form.watch("advancedCalculationMode")
        };
        console.log("🔧 CLOSURE FORM - Advanced Calculation Parameters:", debugParams);
        
        console.log("🔧 CLOSURE FORM - Before Advanced Call:", {
          principalAmount: selectedLoan.principalAmount,
          passedRate: effectiveRate,
          originalRate: selectedLoan.interestRate,
          rateType: selectedLoan.interestRateType
        });
        
        const advancedResult = LoanCalculationsAdvanced.calculateAdvancedCompoundInterest(
          Number(selectedLoan.principalAmount),
          effectiveRate,
          new Date(selectedLoan.loanDate),
          closureDate,
          form.watch("compoundingFrequency"),
          form.watch("advancedCalculationMode")
        );
        
        
        // Get calendar-based time period for display
        const timePeriod = LoanCalculationsAdvanced.calculateTimePeriod(
          new Date(selectedLoan.loanDate),
          closureDate
        );
        
        result = {
          ...advancedResult,
          durationInDays: timePeriod.totalDays,
          years: timePeriod.years,
          months: timePeriod.months,
          days: timePeriod.days
        };
      }

      setCalculationResult(result);
      
      // 🔍 DEBUG: Log calculation result to diagnose totalPayable issue
      console.log("🔍 CALCULATION RESULT SET:", {
        interestAmount: result.interestAmount,
        totalPayable: result.totalPayable,
        principal: selectedLoan.principalAmount,
        expectedTotal: Number(selectedLoan.principalAmount) + Number(result.interestAmount),
        resultObject: result
      });
      
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
  }, [selectedLoan, form]);

  // Helper function to parse interest adjustment with +/- prefix support
  const parseFinalInterest = useCallback((adjustmentValue: string, calculatedInterest: number): number => {
    const trimmedValue = adjustmentValue.trim();
    
    // Handle empty or whitespace-only input
    if (!trimmedValue) {
      console.log("🔍 PARSE: Empty input, returning calculated:", calculatedInterest);
      return calculatedInterest;
    }
    
    // If starts with "+", add to calculated interest
    if (trimmedValue.startsWith('+')) {
      const addAmount = parseFloat(trimmedValue.substring(1));
      if (isNaN(addAmount)) {
        console.log("🔍 PARSE: Invalid + input, returning calculated:", calculatedInterest);
        return calculatedInterest; // Fallback to calculated interest for invalid input
      }
      const result = calculatedInterest + addAmount;
      console.log(`🔍 PARSE: + mode: ${calculatedInterest} + ${addAmount} = ${result}`);
      return result;
    }
    
    // If starts with "-", subtract from calculated interest
    if (trimmedValue.startsWith('-')) {
      const subtractAmount = parseFloat(trimmedValue.substring(1));
      if (isNaN(subtractAmount)) {
        console.log("🔍 PARSE: Invalid - input, returning calculated:", calculatedInterest);
        return calculatedInterest; // Fallback to calculated interest for invalid input
      }
      const result = calculatedInterest - subtractAmount;
      console.log(`🔍 PARSE: - mode: ${calculatedInterest} - ${subtractAmount} = ${result}`);
      return result;
    }
    
    // Otherwise, use the value directly (replacement behavior)
    const directValue = parseFloat(trimmedValue);
    if (isNaN(directValue)) {
      console.log("🔍 PARSE: Invalid direct input, returning calculated:", calculatedInterest);
      return calculatedInterest; // Fallback to calculated interest for invalid input
    }
    console.log(`🔍 PARSE: Direct replacement mode: ${directValue} (ignoring calculated ${calculatedInterest})`);
    return directValue;
  }, []);

  const onSubmit = useCallback(async (data: ClosureFormData) => {
    if (!selectedLoan || !calculationResult) {
      toast({
        title: "त्रुटी",
        description: "कृपया प्रथम कर्ज निवडा आणि गणना करा",
        variant: "destructive",
      });
      return;
    }

    // Enhanced closure logic with +/- prefix support
    const finalInterest = parseFinalInterest(data.finalInterestAmount, calculationResult.interestAmount);
    const principal = Number(selectedLoan.principalAmount);
    const totalAmount = principal + finalInterest;

    // Clean up manual entries BEFORE loan closure to prevent duplicates
    try {
      // Run cleanup mutation first - this prevents manual entry duplicates
      await cleanupMutation.mutateAsync({
        amount: totalAmount,
        accountNumber: selectedLoan.accountNumber || ""
      });
    } catch (error) {
      // Continue even if cleanup fails - the storage layer will handle duplicates
    }

    const closureData = {
      loanId: data.loanId,
      closureDate: data.closureDate,
      principalPaid: principal,
      interestPaid: finalInterest,
      totalAmount: totalAmount,
      calculatedInterest: calculationResult.interestAmount,
      actualPaidAmount: totalAmount, // Same as total amount in simplified version
      balanceRefund: 0, // No balance/refund in simplified version
      interestType: data.interestType,
      advancedCalculationMode: data.advancedCalculationMode,
      durationInMonths: calculationResult.durationInMonths,
      returnOfArticles: data.returnOfArticles,
      isClosed: data.isClosed,
      advancedOverride: finalInterest !== calculationResult.interestAmount,
      interestVariance: finalInterest - calculationResult.interestAmount,
      varianceReason: finalInterest !== calculationResult.interestAmount ? 
        "हस्तचलित समायोजन" : "गणना प्रमाणे",
    };

    closureMutation.mutate(closureData);
  }, [selectedLoan, calculationResult, form, cleanupMutation, closureMutation, toast]);

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
              <h1 className="text-2xl font-semibold text-gray-900 font-noto">कर्ज बंद करा - सरल पद्धत</h1>
              <p className="text-gray-600 font-noto">एक ही field में अंतिम रक्कम एंटर करा</p>
            </div>

            <Card className="shadow-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200">
              <CardHeader className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-t-lg border-b-2 border-blue-200">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg">
                    <Calculator className="h-8 w-8 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl heading-professional flex items-center justify-center font-noto text-blue-900">
                  सरल कर्ज बंद - एक ही रक्कम
                </CardTitle>
                <p className="text-sm text-blue-700 text-center mt-2">गणना करा → समायोजन करा → बंद करा</p>
              </CardHeader>
              
              <CardContent className="p-6 bg-white rounded-b-lg">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    
                    {/* Enhanced Loan Search - Only show if not from URL */}
                    {!hideSearch && (
                      <div className="space-y-4">
                        <Label className="font-noto text-lg">कर्ज शोधा आणि निवडा *</Label>
                        
                        {/* Group Selection First */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">पहिले ग्रुप निवडा</Label>
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
                                  setSearchQuery(e.target.value);
                                  setShowLoanList(e.target.value.trim().length > 0);
                                }}
                                onFocus={() => {
                                  if (searchQuery.trim()) {
                                    setShowLoanList(true);
                                  }
                                }}
                                className="pl-10"
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
                                        मुद्दल: ₹{Math.round(loan.principalAmount).toLocaleString('en-IN')} | दर: {loan.interestRate}% {loan.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}
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
                            निवडलेला कर्ज
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
                              <span className="font-medium">व्याजदर:</span> {selectedLoan.interestRate}% {selectedLoan.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}
                            </div>
                            <div>
                              <span className="font-medium">वाटप दिनांक:</span> {DateUtils.formatDate(selectedLoan.loanDate)}
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
                                    <div className="font-medium">साधा व्याज</div>
                                    <div className="text-xs text-gray-600">365 दिवसांचे मानक</div>
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
                                  {selectedLoan && `मूळ दर: ${selectedLoan.interestRate}% ${selectedLoan.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}`}
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
                                <span className="text-sm text-gray-600">गणना केलेला व्याज</span>
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
                          अंतिम व्याज रक्कम (सरल पद्धत)
                        </CardTitle>
                        <p className="text-sm text-purple-600 mt-2">
                          गणना केलेला व्याज यथे दिसेल → आवश्यकतेनुसार plus/minus करा → 0 टाकल्यास फक्त मुद्दल
                        </p>
                      </CardHeader>
                      <CardContent>
                        <FormField
                          control={form.control}
                          name="finalInterestAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-noto text-lg text-purple-800">
                                अंतिम व्याज रक्कम ₹
                              </FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <Input 
                                    type="text" 
                                    placeholder="व्याज रक्कम (0 = फक्त मुद्दल)"
                                    value={field.value}
                                    onChange={(e) => {
                                      const rawValue = e.target.value;
                                      console.log("📝 RAW INPUT:", rawValue);
                                      field.onChange(rawValue);
                                    }}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                    className="text-xl font-bold border-purple-300 bg-white text-purple-800"
                                  />
                                  
                                  {/* Quick adjustment buttons */}
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
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          const current = Number(form.watch("finalInterestAmount")) || 0;
                                          form.setValue("finalInterestAmount", (current + 100).toString());
                                        }}
                                        className="text-xs"
                                      >
                                        +100
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          const current = Number(form.watch("finalInterestAmount")) || 0;
                                          form.setValue("finalInterestAmount", Math.max(0, current - 100).toString());
                                        }}
                                        className="text-xs"
                                      >
                                        -100
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                              
                              {/* Show comparison with calculated amount */}
                              {calculationResult && form.watch("finalInterestAmount") && (() => {
                                const adjustmentValue = form.watch("finalInterestAmount");
                                const parsedFinalInterest = parseFinalInterest(adjustmentValue, calculationResult.interestAmount);
                                const variance = parsedFinalInterest - calculationResult.interestAmount;
                                const totalPayable = Number(selectedLoan?.principalAmount || 0) + parsedFinalInterest;
                                
                                return (
                                  <div className="mt-2 p-2 bg-white rounded border">
                                    <div className="text-sm">
                                      <div className="flex justify-between">
                                        <span>गणना केलेला व्याज:</span>
                                        <span>₹{Math.round(calculationResult.interestAmount)}</span>
                                      </div>
                                      <div className="flex justify-between font-medium">
                                        <span>अंतिम व्याज:</span>
                                        <span>₹{Math.round(parsedFinalInterest)}</span>
                                      </div>
                                      <div className="flex justify-between text-purple-700 border-t pt-1">
                                        <span>फरक:</span>
                                        <span>
                                          {Math.round(variance) > 0 ? '+' : ''}
                                          ₹{Math.round(variance)}
                                        </span>
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
                          <FormLabel className="font-noto">ग्राहकास द्यावयाचे दागिने</FormLabel>
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
                            <FormLabel className="font-noto">व्यवहार बंद केला का?</FormLabel>
                            <div className="text-sm text-gray-600">
                              हे कर्ज पूर्णपणे बंद करण्याची पुष्टी करा
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />

                    <Separator />

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-end">
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
          </div>
        </main>
      </div>
    </div>
  );
}