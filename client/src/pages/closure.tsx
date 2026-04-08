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
import { Calculator, FileText, AlertTriangle, CheckCircle, Download, Search, X, Clock, Edit, Calendar, Lightbulb, Sparkles, TrendingUp, Info, Check, AlertCircle, Home, Trash2, Printer, Bluetooth, Loader2, Settings, Minus, Plus, Bold, RotateCcw, ChevronDown, ChevronUp, Eye } from "lucide-react";
import html2canvas from "html2canvas";
import { printReceiptViaBluetooth, isBluetoothSupported } from "@/lib/bluetooth-printer";
import { encodeMultiQrData } from "@/lib/qr-utils";
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
  loanId: string;
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

interface ReceiptFieldSetting {
  fontSize: number;
  bold: boolean;
}

interface ReceiptPrintSettings {
  standard: {
    name: ReceiptFieldSetting;
    date: ReceiptFieldSetting;
    title: ReceiptFieldSetting;
    tableHeader: ReceiptFieldSetting;
    tableData: ReceiptFieldSetting;
    total: ReceiptFieldSetting;
    grandTotal: ReceiptFieldSetting;
  };
  thermal: {
    name: ReceiptFieldSetting;
    date: ReceiptFieldSetting;
    title: ReceiptFieldSetting;
    colSerial: ReceiptFieldSetting;
    colAccount: ReceiptFieldSetting;
    colDate: ReceiptFieldSetting;
    colRate: ReceiptFieldSetting;
    colDetails: ReceiptFieldSetting;
    colMonths: ReceiptFieldSetting;
    colPrincipal: ReceiptFieldSetting;
    colCharges: ReceiptFieldSetting;
    hdrSerial: ReceiptFieldSetting;
    hdrAccount: ReceiptFieldSetting;
    hdrDate: ReceiptFieldSetting;
    hdrPrincipal: ReceiptFieldSetting;
    hdrCharges: ReceiptFieldSetting;
    total: ReceiptFieldSetting;
    grandTotal: ReceiptFieldSetting;
    showQrCode?: boolean;
  };
}

const DEFAULT_RECEIPT_SETTINGS: ReceiptPrintSettings = {
  standard: {
    name: { fontSize: 13, bold: true },
    date: { fontSize: 12, bold: true },
    title: { fontSize: 13, bold: true },
    tableHeader: { fontSize: 12, bold: true },
    tableData: { fontSize: 12, bold: true },
    total: { fontSize: 12, bold: true },
    grandTotal: { fontSize: 13, bold: true },
  },
  thermal: {
    name: { fontSize: 26, bold: true },
    date: { fontSize: 22, bold: true },
    title: { fontSize: 24, bold: true },
    colSerial: { fontSize: 16, bold: true },
    colAccount: { fontSize: 22, bold: true },
    colDate: { fontSize: 22, bold: true },
    colRate: { fontSize: 20, bold: true },
    colDetails: { fontSize: 18, bold: false },
    colMonths: { fontSize: 18, bold: false },
    colPrincipal: { fontSize: 22, bold: true },
    colCharges: { fontSize: 22, bold: true },
    hdrSerial: { fontSize: 22, bold: true },
    hdrAccount: { fontSize: 22, bold: true },
    hdrDate: { fontSize: 22, bold: true },
    hdrPrincipal: { fontSize: 22, bold: true },
    hdrCharges: { fontSize: 22, bold: true },
    total: { fontSize: 22, bold: true },
    grandTotal: { fontSize: 32, bold: true },
  },
};

const RECEIPT_SETTINGS_KEY = 'lms_receipt_print_settings';

function loadReceiptSettings(): ReceiptPrintSettings {
  try {
    const saved = localStorage.getItem(RECEIPT_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        standard: { ...DEFAULT_RECEIPT_SETTINGS.standard, ...parsed.standard },
        thermal: { ...DEFAULT_RECEIPT_SETTINGS.thermal, ...parsed.thermal },
      };
    }
  } catch {}
  return { ...DEFAULT_RECEIPT_SETTINGS };
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
  
  // Date warning confirmation state
  const [dateWarningDialog, setDateWarningDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    severity: string;
    closureData: any;
  }>({ open: false, title: '', message: '', severity: '', closureData: null });
  
  const SUMMARY_STORAGE_KEY = 'closure_summary_entries';
  const SUMMARY_COUNTER_KEY = 'closure_summary_counter';

  const [summaryEntries, setSummaryEntries] = useState<SummaryEntry[]>(() => {
    try {
      const saved = sessionStorage.getItem(SUMMARY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const summaryEntriesRef = useRef<SummaryEntry[]>(summaryEntries);
  const autoCalculateRef = useRef(false);
  const resultSectionRef = useRef<HTMLDivElement>(null);
  const [summaryCounter, setSummaryCounter] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SUMMARY_COUNTER_KEY);
      return saved ? Number(saved) : 1;
    } catch { return 1; }
  });
  const [activeTab, setActiveTab] = useState<string>("closure");
  const [showSummaryReceipt, setShowSummaryReceipt] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [isBtPrinting, setIsBtPrinting] = useState(false);
  const [isBulkClosing, setIsBulkClosing] = useState(false);
  const [bulkCloseProgress, setBulkCloseProgress] = useState({ current: 0, total: 0, failed: 0 });
  const [receiptSettings, setReceiptSettings] = useState<ReceiptPrintSettings>(loadReceiptSettings);
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  const updateReceiptSettings = useCallback((updater: (prev: ReceiptPrintSettings) => ReceiptPrintSettings) => {
    setReceiptSettings(prev => {
      const next = updater(prev);
      try { localStorage.setItem(RECEIPT_SETTINGS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const resetReceiptSettings = useCallback(() => {
    setReceiptSettings({ ...DEFAULT_RECEIPT_SETTINGS, standard: { ...DEFAULT_RECEIPT_SETTINGS.standard }, thermal: { ...DEFAULT_RECEIPT_SETTINGS.thermal } });
    try { localStorage.removeItem(RECEIPT_SETTINGS_KEY); } catch {}
  }, []);
  const [summaryReceiptHTML, setSummaryReceiptHTML] = useState<string | null>(null);
  const [printNameMode, setPrintNameMode] = useState<'group' | 'customer'>('group');
  
  const [currentLocation] = useLocation();
  const loanIdFromUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('loanId');
  }, [currentLocation]);
  const loanIdsFromUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = params.get('loanIds');
    if (!ids) return null;
    return ids.split(',').map(s => s.trim()).filter(Boolean);
  }, [currentLocation]);
  const isEditMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('edit') === 'true';
  }, [currentLocation]);
  const hideSearch = !!loanIdFromUrl;
  const [existingClosureData, setExistingClosureData] = useState<any>(null);

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
    queryKey: ["/api/loans", isEditMode ? "all" : "active"],
    queryFn: () => 
      fetch(isEditMode ? "/api/loans" : "/api/loans?status=active", {
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
    mutationFn: async (data: any) => {
      if (isEditMode && existingClosureData) {
        const response = await apiRequest(`/api/loan-closures/${existingClosureData.id}`, "PATCH", {
          closureDate: data.closureDate,
          interestPaid: data.finalInterestAmount,
          principalPaid: String(selectedLoan?.principalAmount || '0'),
          totalAmount: String((parseFloat(selectedLoan?.principalAmount || '0') + parseFloat(data.finalInterestAmount || '0'))),
          actualPaidAmount: String((parseFloat(selectedLoan?.principalAmount || '0') + parseFloat(data.finalInterestAmount || '0'))),
          returnOfArticles: data.returnOfArticles || '',
          interestType: data.interestType,
          calculationMode: data.advancedCalculationMode,
          loanId: data.loanId,
        });
        return response.json();
      }
      const response = await apiRequest(`/api/loans/${data.loanId}/close`, "POST", data);
      const result = await response.json();
      if (result.dateWarning) {
        setDateWarningDialog({
          open: true,
          title: result.warningTitle,
          message: result.warningMessage,
          severity: result.warningSeverity,
          closureData: data
        });
        return { __dateWarning: true };
      }
      return result;
    },
    onSuccess: (result) => {
      if (result?.__dateWarning) return;
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-closures"] });
      queryClient.refetchQueries({ queryKey: ["/api/cash-transactions"] });
      queryClient.refetchQueries({ queryKey: ["/api/cash-balance"] });
      
      if (isEditMode) {
        toast({
          title: "यशस्वी",
          description: "बंद माहिती अपडेट झाली - रोकड वही अपडेट झाली",
        });
        window.history.back();
      } else {
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
      }
    },
    onError: () => {
      toast({
        title: "त्रुटी",
        description: isEditMode ? "बंद माहिती अपडेट करताना त्रुटी झाली" : "कर्ज बंद करताना त्रुटी झाली",
        variant: "destructive",
      });
    },
  });

  const handleClosureDateWarningConfirm = () => {
    if (dateWarningDialog.closureData) {
      closureMutation.mutate({ ...dateWarningDialog.closureData, dateWarningConfirmed: true });
      setDateWarningDialog({ open: false, title: '', message: '', severity: '', closureData: null });
    }
  };

  const handleClosureDateWarningCancel = () => {
    setDateWarningDialog({ open: false, title: '', message: '', severity: '', closureData: null });
  };

  useEffect(() => {
    if (loanIdFromUrl && activeLoans) {
      const loan = activeLoans.find((l: any) => l.id === loanIdFromUrl);
      if (loan) {
        setSelectedLoan(loan);
        form.setValue("loanId", loan.id);
        setSearchQuery(`${loan.borrowerName} - ${loan.accountNumber}`);
        setEditableLoanDate(loan.loanDate || "");
        autoCalculateRef.current = true;

        if (isEditMode) {
          fetch(`/api/loan-closures?loanId=${loan.id}`, { credentials: 'include' })
            .then(res => res.json())
            .then(closures => {
              if (closures && closures.length > 0) {
                const closure = closures[0];
                setExistingClosureData(closure);
                if (closure.closureDate) {
                  form.setValue("closureDate", closure.closureDate);
                }
                if (closure.interestPaid) {
                  form.setValue("finalInterestAmount", String(closure.interestPaid));
                }
                if (closure.returnOfArticles) {
                  form.setValue("returnOfArticles", closure.returnOfArticles);
                }
                if (closure.interestType) {
                  form.setValue("interestType", closure.interestType as any);
                }
                if (closure.calculationMode) {
                  form.setValue("advancedCalculationMode", closure.calculationMode as any);
                }
              }
            })
            .catch(err => console.error("Error fetching closure data:", err));
        }
      }
    }
  }, [loanIdFromUrl, activeLoans, form, isEditMode]);

  const multiLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!loanIdsFromUrl || !activeLoans) return;
    const urlKey = loanIdsFromUrl.join(',');
    if (multiLoadedRef.current === urlKey) return;
    multiLoadedRef.current = urlKey;
    const today = new Date().toISOString().split('T')[0];
    const matchedLoans = loanIdsFromUrl
      .map(id => activeLoans.find((l: any) => String(l.id) === id))
      .filter(Boolean) as any[];
    if (matchedLoans.length === 0) {
      toast({ title: "कर्ज सापडले नाही", description: "QR मधील खाती active नाहीत", variant: "destructive" });
      return;
    }

    setSummaryEntries(prev => {
      const existingIds = new Set(prev.map(e => e.loanId));
      let counter = prev.length > 0 ? Math.max(...prev.map(e => e.id)) + 1 : 1;
      const fresh: SummaryEntry[] = matchedLoans
        .filter((loan: any) => !existingIds.has(loan.id))
        .map((loan: any) => {
          const principal = Number(loan.principalAmount) || 0;
          let rate = Number(loan.interestRate) || 0;
          if (loan.interestRateType === 'monthly') {
            rate = rate * 12;
          }
          const loanDate = loan.loanDate || today;
          const diffMs = new Date(today).getTime() - new Date(loanDate).getTime();
          const days = Math.max(0, Math.ceil(diffMs / (1000 * 3600 * 24)));
          const interest = LoanCalculations.calculateSimpleInterest(principal, rate, days);
          const timePeriod = LoanCalculationsAdvanced.calculateTimePeriod(new Date(loanDate), new Date(today));
          let monthsDisplay = '';
          if (days > 0) {
            if (timePeriod.years > 0 || timePeriod.months > 0) {
              const parts = [];
              if (timePeriod.years > 0) parts.push(`${timePeriod.years}वर्ष`);
              if (timePeriod.months > 0) parts.push(`${timePeriod.months}महिने`);
              if (timePeriod.days > 0) parts.push(`${timePeriod.days}दिवस`);
              monthsDisplay = parts.join(' ');
            } else {
              monthsDisplay = `${days} दिवस`;
            }
          }
          return {
            id: counter++,
            loanId: loan.id,
            borrowerName: loan.borrowerName || '',
            borrowerAddress: loan.borrowerAddress || loan.address || '',
            groupName: loan.groupName || '',
            collateralDetails: loan.collateralDetails || '',
            accountNumber: loan.accountNumber || '',
            loanDate: loanDate,
            months: monthsDisplay,
            interestRate: String(loan.interestRate || ''),
            principalAmount: principal,
            chargesAmount: interest,
            closureDate: today,
          };
        });
      if (fresh.length === 0) return prev;
      const merged = [...prev, ...fresh];
      merged.sort((a, b) => {
        const dateA = a.loanDate ? new Date(a.loanDate).getTime() : 0;
        const dateB = b.loanDate ? new Date(b.loanDate).getTime() : 0;
        return dateA - dateB;
      });
      return merged;
    });
    setSummaryCounter(prev => prev + matchedLoans.length);
    setActiveTab("summary");
    toast({
      title: `${matchedLoans.length} कर्ज लोड झाले`,
      description: "एकत्रित हिशोबात जोडले — नको ते काढा, हवे ते ठेवा",
    });
  }, [loanIdsFromUrl, activeLoans, toast]);

  const calculateInterest = useCallback(() => {
    if (!selectedLoan) return;

    const formValues = form.getValues();
    const closureDate = new Date(formValues.closureDate);
    const { interestType, useCustomRate, customInterestRate: customRate, compoundingFrequency, advancedCalculationMode } = formValues;

    let effectiveRate = useCustomRate && customRate ? 
      Number(customRate) : Number(selectedLoan.interestRate);
    
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
        const advancedResult = LoanCalculationsAdvanced.calculateAdvancedCompoundInterest(
          Number(selectedLoan.principalAmount),
          effectiveRate,
          new Date(loanStartDate),
          closureDate,
          formValues.compoundingFrequency,
          formValues.advancedCalculationMode
        );
        
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
          years: timePeriod.calendarYears,
          months: timePeriod.calendarMonths,
          days: timePeriod.calendarDays
        };
      }

      setCalculationResult(result);
      
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

  // QR scan नंतर auto-calculate + auto-scroll to result
  useEffect(() => {
    if (selectedLoan && autoCalculateRef.current) {
      autoCalculateRef.current = false;
      const timer = setTimeout(() => {
        calculateInterest();
        setTimeout(() => {
          resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 400);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [selectedLoan, calculateInterest]);

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
    setShowPhotos(false);
    form.setValue("loanId", loan.id);
    setSearchQuery(`${loan.borrowerName} - ${loan.accountNumber}`);
    setShowLoanList(false);
    setEditableLoanDate(loan.loanDate || "");
    setCalculationResult(null);
    form.setValue("finalInterestAmount", "");
  };

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
    const rs = receiptSettings.standard;
    const fontSize = `${rs.tableData.fontSize}px`;
    const headFontSize = `${rs.tableHeader.fontSize}px`;
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
          <div style="font-weight:${rs.name.bold ? 700 : 400};font-size:${rs.name.fontSize}px;line-height:1.8;">${displayName}</div>
          ${displayAddress ? `<div style="font-size:${fontSize};color:#333;line-height:1.8;">${displayAddress}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:${rs.date.fontSize}px;font-weight:${rs.date.bold ? 700 : 400};line-height:1.8;">तारीख: ${closureDateFormatted}</div>
          ${totalPages > 1 ? `<div style="font-size:${fontSize};color:#666;">पान ${pageNum}/${totalPages}</div>` : ''}
        </div>
      </div>
      <div style="text-align:center;font-weight:${rs.title.bold ? 700 : 400};font-size:${rs.title.fontSize}px;margin-bottom:12px;text-decoration:underline;text-underline-offset:6px;line-height:1.8;">Estimate</div>`;

    const hfw = rs.tableHeader.bold ? 700 : 400;
    const makeTableHead = () => `
      <colgroup>
        <col style="width:36px;">
        ${showDetailsCols ? `<col style="width:auto;">` : ''}
        <col style="width:50px;">
        <col style="width:${showInterestRate ? '80px' : '60px'};">
        ${showDetailsCols ? `<col style="width:32px;">` : ''}
        <col style="width:70px;">
        <col style="width:65px;">
      </colgroup>
      <thead>
      <tr>
        <th style="border:none;border-bottom:0.5px solid #000;padding:5px 4px 5px 2px;font-size:${headFontSize};text-align:center;vertical-align:middle;font-weight:${hfw};line-height:1.8;">अ.नं.</th>
        ${showDetailsCols ? `<th style="border:none;border-bottom:0.5px solid #000;padding:5px 4px 5px 6px;font-size:${headFontSize};text-align:left;vertical-align:middle;font-weight:${hfw};line-height:1.8;">तपशील</th>` : ''}
        <th style="border:none;border-bottom:0.5px solid #000;padding:5px 3px;font-size:${headFontSize};text-align:center;vertical-align:middle;font-weight:${hfw};line-height:1.8;">कोड नं</th>
        <th style="border:none;border-bottom:0.5px solid #000;padding:5px 3px;font-size:${headFontSize};text-align:center;vertical-align:middle;font-weight:${hfw};line-height:1.8;">दिनांक</th>
        ${showDetailsCols ? `<th style="border:none;border-bottom:0.5px solid #000;padding:5px 2px;font-size:${headFontSize};text-align:center;vertical-align:middle;font-weight:${hfw};line-height:1.8;"></th>` : ''}
        <th style="border:none;border-bottom:0.5px solid #000;padding:5px 4px;font-size:${headFontSize};text-align:right;vertical-align:middle;font-weight:${hfw};line-height:1.8;">बाजारमूल्य</th>
        <th style="border:none;border-bottom:0.5px solid #000;padding:5px 4px;font-size:${headFontSize};text-align:right;vertical-align:middle;font-weight:${hfw};line-height:1.8;">चार्जेस</th>
      </tr>
    </thead>`;

    const dfw = rs.tableData.bold ? 700 : 400;
    const makeRow = (entry: SummaryEntry, index: number) => `<tr>
      <td style="border:none;padding:10px 4px 10px 2px;text-align:center;font-size:${fontSize};font-weight:${dfw};vertical-align:middle;line-height:1.8;">${index + 1}</td>
      ${showDetailsCols ? `<td style="border:none;padding:10px 4px 10px 6px;font-size:${fontSize};font-weight:${dfw};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;line-height:1.8;">${entry.collateralDetails || '-'}</td>` : ''}
      <td style="border:none;padding:10px 3px;text-align:center;font-size:${fontSize};font-weight:${dfw};vertical-align:middle;line-height:1.8;">${entry.accountNumber}</td>
      <td style="border:none;padding:10px 3px;text-align:center;font-size:${fontSize};font-weight:${dfw};vertical-align:middle;line-height:1.8;white-space:nowrap;">${toShortDate(entry.loanDate)}${showInterestRate ? `<span style="margin-left:4px;font-size:10px;font-weight:600;">${formatRate(entry.interestRate)}</span>` : ''}</td>
      ${showDetailsCols ? `<td style="border:none;padding:10px 2px;text-align:center;font-size:${fontSize};font-weight:${dfw};vertical-align:middle;line-height:1.8;">${entry.months}</td>` : ''}
      <td style="border:none;padding:10px 4px;text-align:right;font-size:${fontSize};font-weight:${dfw};vertical-align:middle;line-height:1.8;">${Number(Math.round(entry.principalAmount)).toLocaleString('en-IN')}</td>
      <td style="border:none;padding:10px 4px;text-align:right;font-size:${fontSize};font-weight:${dfw};vertical-align:middle;line-height:1.8;">${Number(Math.round(entry.chargesAmount)).toLocaleString('en-IN')}</td>
    </tr>`;

    let pagesHTML = '';
    for (let p = 0; p < totalPages; p++) {
      const pageEntries = entries.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
      const isLastPage = p === totalPages - 1;

      let rows = '';
      pageEntries.forEach((entry, i) => {
        rows += makeRow(entry, p * ROWS_PER_PAGE + i);
      });

      const tfw = rs.total.bold ? 700 : 400;
      const gfw = rs.grandTotal.bold ? 800 : 400;
      const totalsHTML = isLastPage ? `
        <tr>
          <td colspan="${totalColSpan}" style="border-top:2px double #000;border-left:none;border-right:none;border-bottom:none;padding:8px 4px;text-align:right;font-size:${rs.total.fontSize}px;font-weight:${tfw};vertical-align:middle;line-height:1.8;">एकूण</td>
          <td style="border-top:2px double #000;border-left:none;border-right:none;border-bottom:none;padding:8px 4px;text-align:right;font-size:${rs.total.fontSize}px;font-weight:${tfw};vertical-align:middle;line-height:1.8;">${Number(Math.round(totalPrincipal)).toLocaleString('en-IN')}</td>
          <td style="border-top:2px double #000;border-left:none;border-right:none;border-bottom:none;padding:8px 4px;text-align:right;font-size:${rs.total.fontSize}px;font-weight:${tfw};vertical-align:middle;line-height:1.8;">${Number(Math.round(totalCharges)).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td colspan="${grandTotalColSpan}" style="border-top:2px double #000;border-bottom:2px double #000;border-left:none;border-right:none;padding:10px 4px;text-align:right;font-size:${rs.grandTotal.fontSize}px;font-weight:${gfw};vertical-align:middle;line-height:1.8;">Grand Total</td>
          <td style="border-top:2px double #000;border-bottom:2px double #000;border-left:none;border-right:none;padding:10px 4px;text-align:right;font-size:${rs.grandTotal.fontSize}px;font-weight:${gfw};vertical-align:middle;line-height:1.8;">${Number(Math.round(grandTotal)).toLocaleString('en-IN')}</td>
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
  }, [receiptSettings.standard]);

  const handleAddToSummary = useCallback(() => {
    if (!selectedLoan || !calculationResult) return;
    const finalInterestValue = form.getValues("finalInterestAmount");
    if (!finalInterestValue) return;

    const currentEntries = summaryEntriesRef.current;
    const alreadyExists = currentEntries.some(e => e.loanId === selectedLoan.id);
    if (alreadyExists) {
      toast({
        title: "सूचना",
        description: `हे कर्ज (खाते क्र. ${selectedLoan.accountNumber}) आधीच हिशोबात जोडले आहे`,
        variant: "destructive",
      });
      return;
    }

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
      loanId: selectedLoan.id,
      borrowerName: selectedLoan.borrowerName || '',
      borrowerAddress: selectedLoan.borrowerAddress || selectedLoan.address || '',
      groupName: getGroupName(selectedLoan.groupId) || '',
      collateralDetails: selectedLoan.collateralDetails || [selectedLoan.specialConditions, selectedLoan.documentDetails, selectedLoan.otherInfo].filter((v: string) => v && v !== '—' && v.trim() !== '').join(' | ') || '',
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

  const handleBulkClose = useCallback(async () => {
    const entries = summaryEntriesRef.current;
    if (entries.length === 0) return;
    
    const confirmed = window.confirm(
      `${entries.length} कर्ज एकदम बंद करायचे आहेत?\n\n` +
      entries.map((e, i) => `${i+1}. खाते ${e.accountNumber} — ₹${e.principalAmount.toLocaleString('en-IN')} + ₹${e.chargesAmount.toLocaleString('en-IN')}`).join('\n') +
      `\n\nGrand Total: ₹${entries.reduce((s, e) => s + e.principalAmount + e.chargesAmount, 0).toLocaleString('en-IN')}`
    );
    if (!confirmed) return;

    setIsBulkClosing(true);
    setBulkCloseProgress({ current: 0, total: entries.length, failed: 0 });
    let failCount = 0;
    const closedIds: number[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      setBulkCloseProgress(p => ({ ...p, current: i + 1 }));
      try {
        await apiRequest(`/api/loans/cleanup-manual-entries`, "POST", {
          amount: entry.principalAmount + entry.chargesAmount,
          accountNumber: entry.accountNumber,
        });
      } catch {}
      try {
        const closureData = {
          loanId: entry.loanId,
          closureDate: entry.closureDate,
          principalPaid: entry.principalAmount,
          interestPaid: entry.chargesAmount,
          totalAmount: entry.principalAmount + entry.chargesAmount,
          calculatedInterest: entry.chargesAmount,
          actualPaidAmount: entry.principalAmount + entry.chargesAmount,
          balanceRefund: 0,
          interestType: 'simple',
          advancedCalculationMode: 'half_month',
          durationInMonths: 0,
          returnOfArticles: '',
          isClosed: true,
          advancedOverride: false,
          interestVariance: 0,
          varianceReason: 'गणना प्रमाणे',
          dateWarningConfirmed: true,
        };
        const res = await apiRequest(`/api/loans/${entry.loanId}/close`, "POST", closureData);
        const result = await res.json();
        if (result?.dateWarning) {
          await apiRequest(`/api/loans/${entry.loanId}/close`, "POST", { ...closureData, dateWarningConfirmed: true });
        }
        closedIds.push(entry.id);
      } catch {
        failCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cash-balance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/loan-closures"] });

    setSummaryEntries(prev => prev.filter(e => !closedIds.includes(e.id)));

    setIsBulkClosing(false);
    if (failCount === 0) {
      toast({ title: "यशस्वी", description: `${entries.length} कर्ज बंद केले — रोकड वही अपडेट` });
      if (closedIds.length === entries.length) {
        setSummaryEntries([]);
        setSummaryCounter(1);
      }
    } else {
      toast({
        title: `${entries.length - failCount} / ${entries.length} बंद`,
        description: `${failCount} कर्ज बंद करताना त्रुटी — पुन्हा प्रयत्न करा`,
        variant: "destructive",
      });
    }
  }, [toast]);

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
    wrapper.style.height = a5LandscapeHeightPx + 'px';
    wrapper.style.minHeight = a5LandscapeHeightPx + 'px';
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
          page.style.height = '280px';
          page.style.minHeight = '280px';
          const canvas = await html2canvas(page, {
            scale: 6,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: 0,
            width: 794,
            height: 280,
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
          width: 794,
          height: 280,
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

  const generateThermalReceiptHTML = useCallback((entries: SummaryEntry[], nameMode: 'group' | 'customer' = 'group', showInterestRate: boolean = false, qrDataUrl?: string, estimateCode?: string): string => {
    if (entries.length === 0) return '';
    const bt = receiptSettings.thermal;
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
        <td style="padding:14px 8px 14px 4px;text-align:center;font-size:${bt.colSerial.fontSize}px;font-weight:${bt.colSerial.bold ? 700 : 400};">${i + 1}</td>
        <td style="padding:14px 8px;text-align:center;font-size:${bt.colAccount.fontSize}px;font-weight:${bt.colAccount.bold ? 700 : 400};">${entry.accountNumber}</td>
        <td style="padding:14px 4px;text-align:right;font-size:${bt.colDate.fontSize}px;font-weight:${bt.colDate.bold ? 700 : 400};vertical-align:middle;">${toShortDate(entry.loanDate)}${showInterestRate ? `<span style="margin-left:16px;font-size:${bt.colRate.fontSize}px;font-weight:${bt.colRate.bold ? 700 : 400};">${formatRate(entry.interestRate)}</span>` : ''}</td>
        <td style="padding:14px 4px;text-align:right;font-size:${bt.colPrincipal.fontSize}px;font-weight:${bt.colPrincipal.bold ? 700 : 400};">${Number(Math.round(entry.principalAmount)).toLocaleString('en-IN')}</td>
        <td style="padding:14px 4px;text-align:right;font-size:${bt.colCharges.fontSize}px;font-weight:${bt.colCharges.bold ? 700 : 400};">${Number(Math.round(entry.chargesAmount)).toLocaleString('en-IN')}</td>
      </tr>`;
    });

    return `
      <div style="padding:6px 12px;font-family:'Noto Sans Devanagari',sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
          <div style="font-weight:${bt.name.bold ? 800 : 400};font-size:${bt.name.fontSize}px;line-height:1.4;">${displayName}</div>
          <div style="font-size:${bt.date.fontSize}px;font-weight:${bt.date.bold ? 700 : 400};white-space:nowrap;line-height:1.4;">तारीख: ${closureDateFormatted}</div>
        </div>
        ${displayAddress ? `<div style="font-size:${Math.round(bt.name.fontSize * 0.7)}px;color:#333;margin-bottom:4px;">${displayAddress}</div>` : ''}
        <div style="text-align:center;font-weight:${bt.title.bold ? 800 : 400};font-size:${bt.title.fontSize}px;margin-bottom:10px;"><span style="border-bottom:2px solid #000;padding-bottom:6px;">Estimate</span></div>
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
              <th style="padding:10px 8px 10px 4px;font-size:${bt.hdrSerial.fontSize}px;text-align:center;font-weight:${bt.hdrSerial.bold ? 700 : 400};">अ.नं.</th>
              <th style="padding:10px 8px;font-size:${bt.hdrAccount.fontSize}px;text-align:center;font-weight:${bt.hdrAccount.bold ? 700 : 400};">कोड नं</th>
              <th style="padding:10px 4px;font-size:${bt.hdrDate.fontSize}px;text-align:right;font-weight:${bt.hdrDate.bold ? 700 : 400};vertical-align:middle;">दिनांक</th>
              <th style="padding:10px 4px;font-size:${bt.hdrPrincipal.fontSize}px;text-align:right;font-weight:${bt.hdrPrincipal.bold ? 700 : 400};">बाजारमूल्य</th>
              <th style="padding:10px 4px;font-size:${bt.hdrCharges.fontSize}px;text-align:right;font-weight:${bt.hdrCharges.bold ? 700 : 400};">चार्जेस</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr style="border-top:3px double #000;">
              <td colspan="3" style="padding:12px 4px;text-align:right;font-size:${bt.total.fontSize}px;font-weight:${bt.total.bold ? 700 : 400};">एकूण</td>
              <td style="padding:12px 4px;text-align:right;font-size:${bt.total.fontSize}px;font-weight:${bt.total.bold ? 700 : 400};">${Number(Math.round(totalPrincipal)).toLocaleString('en-IN')}</td>
              <td style="padding:12px 4px;text-align:right;font-size:${bt.total.fontSize}px;font-weight:${bt.total.bold ? 700 : 400};">${Number(Math.round(totalCharges)).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-top:3px double #000;">
              <td colspan="5" style="padding:16px 4px;text-align:center;font-size:${bt.grandTotal.fontSize}px;font-weight:${bt.grandTotal.bold ? 900 : 400};">Grand Total : ${Number(Math.round(grandTotal)).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
        ${qrDataUrl ? `<div style="text-align:center;margin-top:16px;padding-bottom:8px;"><img src="${qrDataUrl}" style="width:${entries.length > 1 ? 280 : 160}px;height:${entries.length > 1 ? 280 : 160}px;margin:0 auto;" /><div style="font-size:14px;color:#666;margin-top:4px;">QR Scan → Direct Close</div>${estimateCode ? `<div style="margin-top:10px;font-size:22px;font-weight:900;letter-spacing:6px;color:#000;">कोड: ${estimateCode}</div><div style="font-size:12px;color:#888;margin-top:2px;">QR नाही चालला? — हा कोड टाका</div>` : ''}</div>` : ''}
      </div>`;
  }, [receiptSettings.thermal]);

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

    setIsBtPrinting(true);
    try {
      let qrDataUrl: string | undefined;
      let estimateCode: string | undefined;
      if (receiptSettings.thermal.showQrCode) {
        const loanIds = currentEntries.map(e => e.loanId);
        const qrData = encodeMultiQrData(loanIds);
        const qrSize = loanIds.length > 1 ? 768 : 512;
        const qrRes = await fetch(`/api/qr-generate?url=${encodeURIComponent(qrData)}&size=${qrSize}`);
        const qrJson = await qrRes.json();
        qrDataUrl = qrJson.dataUrl;
        try {
          const codeRes = await fetch('/api/estimate-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loanIds }),
          });
          const codeJson = await codeRes.json();
          if (codeJson.code) estimateCode = codeJson.code;
        } catch {}
      }
      const thermalHTML = generateThermalReceiptHTML(currentEntries, printNameMode, showRateMonths, qrDataUrl, estimateCode);
      if (!thermalHTML) { setIsBtPrinting(false); return; }
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
  }, [generateThermalReceiptHTML, toast, renderReceiptToCanvas, isBtPrinting, printNameMode, showRateMonths, receiptSettings.thermal.showQrCode]);

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
          years: timePeriod.calendarYears,
          months: timePeriod.calendarMonths,
          days: timePeriod.calendarDays
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
              className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-3 bg-indigo-600 hover:bg-indigo-700 text-white"
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
          <div className="px-4 sm:px-6 lg:px-8 py-6 md:max-w-7xl md:mx-auto">
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-2">
                <Link href="/">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    मुखपृष्ठ
                  </Button>
                </Link>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-indigo-900 mb-1">{isEditMode ? "बंद माहिती संपादन" : "कर्ज बंद करा"}</h1>
              <p className="text-sm text-gray-500">{isEditMode ? "Edit Closure Details & Recalculate" : "Loan Closure & Interest Calculation"}</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-12 bg-white shadow-sm border">
                <TabsTrigger 
                  value="closure" 
                  className="text-sm font-semibold data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all"
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
            <Card className="shadow-2xl bg-gradient-to-br from-indigo-50 via-indigo-50 to-purple-50 border-2 border-indigo-200">
              
              <CardContent className="p-6 md:p-8 bg-white rounded-lg">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8" autoComplete="off">
                    
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
                                      <div className="font-medium text-indigo-800">{loan.borrowerName}</div>
                                      <div className="text-sm text-gray-600">
                                        खाते क्रमांक: {loan.accountNumber} | ग्रुप: {getGroupName(loan.groupId)}
                                      </div>
                                      <div className="text-sm text-green-600">
                                        मुद्दल: ₹{Math.round(loan.principalAmount).toLocaleString('en-IN')} | दर: {formatRate(loan.interestRate)}% {loan.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}
                                      </div>
                                      {(loan.collateralDetails || loan.otherInfo || loan.specialConditions || loan.documentDetails) && (
                                        <div className="text-sm text-purple-600">
                                          {loan.collateralDetails ? (
                                            <>वस्तू: {loan.collateralDetails} {loan.weight && `| वजन: ${parseFloat(String(loan.weight)).toFixed(2)}`}</>
                                          ) : (
                                            <>माहिती: {[loan.specialConditions, loan.documentDetails, loan.otherInfo].filter((v: string) => v && v !== '—' && v.trim() !== '').join(' | ') || '—'}</>
                                          )}
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm md:text-base">
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
                                className="inline-block w-auto h-7 px-2 py-0 text-sm border-indigo-300"
                              />
                              {editableLoanDate && selectedLoan.loanDate && editableLoanDate !== selectedLoan.loanDate && (
                                <span className="ml-2 text-xs text-orange-600 font-medium">
                                  (मूळ: {DateUtils.formatDate(selectedLoan.loanDate)})
                                </span>
                              )}
                            </div>
                            {selectedLoan.collateralDetails ? (
                              <>
                                <div className="md:col-span-2">
                                  <span className="font-medium">वस्तूचे वर्णन:</span> {selectedLoan.collateralDetails}
                                </div>
                                {selectedLoan.weight && (
                                  <div>
                                    <span className="font-medium">वजन:</span> {selectedLoan.weight ? parseFloat(String(selectedLoan.weight)).toFixed(2) : selectedLoan.weight}
                                  </div>
                                )}
                              </>
                            ) : (selectedLoan.otherInfo || selectedLoan.specialConditions || selectedLoan.documentDetails) ? (
                              <div className="md:col-span-2">
                                <span className="font-medium">माहिती:</span> {[selectedLoan.specialConditions, selectedLoan.documentDetails, selectedLoan.otherInfo].filter((v: string) => v && v !== '—' && v.trim() !== '').join(' | ') || '—'}
                              </div>
                            ) : null}
                          </div>
                          
                          {/* Photo Viewer Section - Hidden by default, click to show */}
                          {selectedLoan.id && (
                            <div className="mt-4">
                              {!showPhotos ? (
                                <button
                                  type="button"
                                  onClick={() => setShowPhotos(true)}
                                  className="w-full py-2 px-4 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                                >
                                  📷 वस्तूंचे फोटो पहा
                                </button>
                              ) : (
                                <div className="p-4 border rounded-lg bg-amber-50">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-semibold">वस्तूंचे फोटो</span>
                                    <button
                                      type="button"
                                      onClick={() => setShowPhotos(false)}
                                      className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                      ✕ बंद करा
                                    </button>
                                  </div>
                                  <PhotoViewer 
                                    loanId={selectedLoan.id} 
                                    loanAccountNumber={selectedLoan.accountNumber}
                                    readonly={true}
                                  />
                                </div>
                              )}
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
                          className={`px-3 py-1.5 text-sm font-medium transition-colors ${printNameMode === 'group' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                          ग्रुप
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintNameMode('customer')}
                          className={`px-3 py-1.5 text-sm font-medium transition-colors border-l ${printNameMode === 'customer' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
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
                                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-indigo-50">
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

                    <div className="flex justify-center">
                      <Button
                        type="button"
                        onClick={calculateInterest}
                        disabled={!selectedLoan}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg md:px-8 md:py-3 md:text-base"
                      >
                        <Calculator className="h-4 w-4 mr-2 md:h-5 md:w-5" />
                        व्याज गणना करा
                      </Button>
                    </div>

                    {/* Calculation Results */}
                    {calculationResult && (
                      <div ref={resultSectionRef}>
                      <Card className="border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 to-indigo-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-indigo-800 flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            गणना निकाल
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {/* Duration Display - Same as Interest Calculator */}
                          <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-indigo-800">
                              <Calendar className="h-5 w-5" />
                              कर्ज कालावधी
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                              <div>
                                <div className="text-2xl font-bold text-indigo-600">{calculationResult.durationInDays}</div>
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
                              <div className="mt-3 pt-2 border-t border-indigo-100 text-center">
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
                            <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">मुद्दल रक्कम</span>
                                <span className="text-lg font-semibold text-indigo-600">
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
                      </div>
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
                        className="bg-gradient-to-r from-green-600 to-indigo-600 hover:from-green-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-300"
                      >
                        {(closureMutation.isPending || cleanupMutation.isPending) ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {cleanupMutation.isPending ? "मॅन्युअल इंट्री साफ करत आहे..." : isEditMode ? "अपडेट करत आहे..." : "कर्ज बंद करत आहे..."}
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {isEditMode ? "बंद माहिती अपडेट करा" : "कर्ज बंद करा"}
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="flex items-center gap-1.5">
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
                          <div className="flex items-center gap-1.5">
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
                            <Printer className="h-3.5 w-3.5 mr-1" />
                            पावती
                          </button>
                          <button
                            ref={btPrintBtnRef}
                            type="button"
                            onClick={handleBluetoothPrint}
                            className="inline-flex items-center rounded-md px-3 h-9 text-xs border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200 transition-colors outline-none"
                          >
                            <Bluetooth className="h-3.5 w-3.5 mr-1" />
                            ब्लूटूथ
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPrintSettings(v => !v)}
                            className={`inline-flex items-center rounded-md px-2.5 h-9 text-xs border transition-colors outline-none ${showPrintSettings ? 'border-amber-500 bg-amber-100 text-amber-800' : 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                            title="प्रिंट सेटिंग्स"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleBulkClose}
                            disabled={isBulkClosing || summaryEntries.some(e => e.chargesAmount === 0 && e.principalAmount === 0)}
                            className="inline-flex items-center rounded-md px-3 h-9 text-xs border border-green-500 bg-green-50 text-green-700 hover:bg-green-100 active:bg-green-200 disabled:opacity-50 transition-colors outline-none"
                          >
                            {isBulkClosing ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                {bulkCloseProgress.current}/{bulkCloseProgress.total}
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                सर्व बंद करा
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleClearAllSummary}
                            className="inline-flex items-center rounded-md px-3 h-9 text-xs border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 transition-colors outline-none"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            काढा
                          </button>
                        </div>
                      </div>
                      {showPrintSettings && (
                        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                              <Settings className="h-3.5 w-3.5" /> प्रिंट सेटिंग्स
                            </div>
                            <button onClick={resetReceiptSettings} className="text-[10px] text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded-md px-2 py-0.5 transition-colors flex items-center gap-1">
                              <RotateCcw className="h-2.5 w-2.5" /> डिफॉल्ट
                            </button>
                          </div>
                          {(() => {
                            const renderRow = (mode: 'standard' | 'thermal', key: string, label: string, setting: ReceiptFieldSetting) => (
                              <div key={key} className="flex items-center gap-1.5 py-0.5 px-1 bg-white rounded">
                                <span className="text-[10px] font-medium text-amber-800 flex-1 min-w-0 truncate">{label}</span>
                                <div className="flex items-center gap-0.5 bg-amber-100 rounded px-0.5 py-0.5 flex-shrink-0">
                                  <button onClick={() => updateReceiptSettings(prev => ({ ...prev, [mode]: { ...prev[mode], [key]: { ...prev[mode][key as keyof typeof prev[typeof mode]], fontSize: Math.max(6, setting.fontSize - 1) } } }))} className="p-0.5 rounded hover:bg-amber-200 active:bg-amber-300">
                                    <Minus className="h-2.5 w-2.5 text-amber-700" />
                                  </button>
                                  <span className="text-[9px] font-mono w-6 text-center text-amber-800 font-semibold">{setting.fontSize}</span>
                                  <button onClick={() => updateReceiptSettings(prev => ({ ...prev, [mode]: { ...prev[mode], [key]: { ...prev[mode][key as keyof typeof prev[typeof mode]], fontSize: Math.min(50, setting.fontSize + 1) } } }))} className="p-0.5 rounded hover:bg-amber-200 active:bg-amber-300">
                                    <Plus className="h-2.5 w-2.5 text-amber-700" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => updateReceiptSettings(prev => ({ ...prev, [mode]: { ...prev[mode], [key]: { ...prev[mode][key as keyof typeof prev[typeof mode]], bold: !setting.bold } } }))}
                                  className={`p-0.5 rounded transition-colors flex-shrink-0 ${setting.bold ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-amber-200 text-amber-400'}`}
                                  title="बोल्ड"
                                >
                                  <Bold className="h-3 w-3" />
                                </button>
                              </div>
                            );
                            const stdFields: { key: keyof ReceiptPrintSettings['standard']; label: string }[] = [
                              { key: 'name', label: 'नाव' },
                              { key: 'date', label: 'तारीख' },
                              { key: 'title', label: 'शीर्षक (Estimate)' },
                              { key: 'tableHeader', label: 'टेबल हेडर' },
                              { key: 'tableData', label: 'टेबल डेटा' },
                              { key: 'total', label: 'एकूण' },
                              { key: 'grandTotal', label: 'Grand Total' },
                            ];
                            const btFields: { key: keyof ReceiptPrintSettings['thermal']; label: string; group?: string }[] = [
                              { key: 'name', label: 'नाव' },
                              { key: 'date', label: 'तारीख' },
                              { key: 'title', label: 'शीर्षक (Estimate)' },
                              { key: 'hdrSerial', label: '🔤 अ.नं. (हेडर)', group: 'हेडर' },
                              { key: 'hdrAccount', label: '🔤 कोड नं (हेडर)', group: 'हेडर' },
                              { key: 'hdrDate', label: '🔤 दिनांक (हेडर)', group: 'हेडर' },
                              { key: 'hdrPrincipal', label: '🔤 बाजारमूल्य (हेडर)', group: 'हेडर' },
                              { key: 'hdrCharges', label: '🔤 चार्जेस (हेडर)', group: 'हेडर' },
                              { key: 'colSerial', label: '📊 अ.नं. (डेटा)', group: 'डेटा' },
                              { key: 'colAccount', label: '📊 कोड नं (डेटा)', group: 'डेटा' },
                              { key: 'colDate', label: '📊 दिनांक (डेटा)', group: 'डेटा' },
                              { key: 'colRate', label: '📊 व्याजदर (डेटा)', group: 'डेटा' },
                              { key: 'colDetails', label: '📊 तपशील (डेटा)', group: 'डेटा' },
                              { key: 'colMonths', label: '📊 महिने (डेटा)', group: 'डेटा' },
                              { key: 'colPrincipal', label: '📊 बाजारमूल्य (डेटा)', group: 'डेटा' },
                              { key: 'colCharges', label: '📊 चार्जेस (डेटा)', group: 'डेटा' },
                              { key: 'total', label: 'एकूण' },
                              { key: 'grandTotal', label: 'Grand Total' },
                            ];
                            return (
                              <>
                                <div className="space-y-1">
                                  <div className="text-[10px] font-semibold text-amber-700 flex items-center gap-1 border-b border-amber-200 pb-0.5">
                                    <Printer className="h-3 w-3" /> पावती प्रिंट
                                  </div>
                                  {stdFields.map(f => renderRow('standard', f.key, f.label, receiptSettings.standard[f.key]))}
                                </div>
                                <div className="space-y-1">
                                  <div className="text-[10px] font-semibold text-amber-700 flex items-center gap-1 border-b border-amber-200 pb-0.5">
                                    <Bluetooth className="h-3 w-3" /> ब्लूटूथ प्रिंट
                                  </div>
                                  <div className="flex items-center justify-between py-1 px-1 bg-indigo-50/60 rounded">
                                    <span className="text-[10px] font-medium text-indigo-700">QR कोड दाखवा</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!!receiptSettings.thermal.showQrCode}
                                        onChange={(e) => updateReceiptSettings(prev => ({
                                          ...prev,
                                          thermal: { ...prev.thermal, showQrCode: e.target.checked }
                                        }))}
                                        className="sr-only peer"
                                        autoComplete="off"
                                      />
                                      <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                  </div>
                                  {btFields.map(f => renderRow('thermal', f.key, f.label, receiptSettings.thermal[f.key]))}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      {(() => {
                        const bt = receiptSettings.thermal;
                        const sc = 0.5;
                        return (<>
                      {summaryEntries.length > 0 && (
                        <div className="flex justify-between items-start px-3 pt-2 pb-1">
                          <div>
                            <div style={{fontSize:bt.name.fontSize*sc,fontWeight:bt.name.bold?700:400}}>{summaryEntries[summaryEntries.length - 1].borrowerName}</div>
                            {summaryEntries[summaryEntries.length - 1].borrowerAddress && (
                              <div className="text-xs text-gray-500">{summaryEntries[summaryEntries.length - 1].borrowerAddress}</div>
                            )}
                          </div>
                          <div style={{fontSize:bt.date.fontSize*sc,fontWeight:bt.date.bold?700:400}} className="text-gray-500 text-right">
                            तारीख: {DateUtils.isoToIndianDate(summaryEntries[summaryEntries.length - 1].closureDate)}
                          </div>
                        </div>
                      )}
                      <div className="text-center py-1 underline" style={{fontSize:bt.title.fontSize*sc,fontWeight:bt.title.bold?700:400}}>Estimate</div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse" style={{fontSize:12}}>
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-1 py-1 text-center w-8" style={{fontSize:bt.hdrSerial.fontSize*sc,fontWeight:bt.hdrSerial.bold?700:400}}>अ.नं.</th>
                              {showDetails && <th className="border border-gray-300 px-2 py-1 text-left text-xs">तपशील</th>}
                              <th className="border border-gray-300 px-1 py-1 text-center w-16" style={{fontSize:bt.hdrAccount.fontSize*sc,fontWeight:bt.hdrAccount.bold?700:400}}>कोड नं</th>
                              <th className="border border-gray-300 px-1 py-1 text-center w-20" style={{fontSize:bt.hdrDate.fontSize*sc,fontWeight:bt.hdrDate.bold?700:400}}>दिनांक</th>
                              {showDetails && <th className="border border-gray-300 px-1 py-1 text-center w-10 text-xs"></th>}
                              <th className="border border-gray-300 px-2 py-1 text-right" style={{minWidth:'10ch',fontSize:bt.hdrPrincipal.fontSize*sc,fontWeight:bt.hdrPrincipal.bold?700:400}}>बाजारमूल्य</th>
                              <th className="border border-gray-300 px-2 py-1 text-right" style={{minWidth:'10ch',fontSize:bt.hdrCharges.fontSize*sc,fontWeight:bt.hdrCharges.bold?700:400}}>चार्जेस</th>
                              <th className="border border-gray-300 px-1 py-1 w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryEntries.map((entry, index) => (
                              <tr key={entry.id} className="hover:bg-gray-50">
                                <td className="border border-gray-300 px-1 py-1 text-center" style={{fontSize:bt.colSerial.fontSize*sc,fontWeight:bt.colSerial.bold?700:400}}>{index + 1}</td>
                                {showDetails && <td className="border border-gray-300 px-2 py-1" style={{fontSize:bt.colDetails.fontSize*sc,fontWeight:bt.colDetails.bold?700:400}}><div className="max-w-[120px] truncate" title={entry.collateralDetails || '-'}>{entry.collateralDetails || '-'}</div></td>}
                                <td className="border border-gray-300 px-1 py-1 text-center" style={{fontSize:bt.colAccount.fontSize*sc,fontWeight:bt.colAccount.bold?700:400}}>{entry.accountNumber}</td>
                                <td className="border border-gray-300 px-1 py-1 text-center" style={{fontSize:bt.colDate.fontSize*sc,fontWeight:bt.colDate.bold?700:400}}>{toShortDate(entry.loanDate)}{showRateMonths ? <span className="ml-4" style={{fontSize:bt.colRate.fontSize*sc,fontWeight:bt.colRate.bold?700:400}}>{formatRate(entry.interestRate)}</span> : ''}</td>
                                {showDetails && <td className="border border-gray-300 px-1 py-1 text-center" style={{fontSize:bt.colMonths.fontSize*sc,fontWeight:bt.colMonths.bold?700:400}}>{entry.months}</td>}
                                <td className="border border-gray-300 px-2 py-1 text-right" style={{fontSize:bt.colPrincipal.fontSize*sc,fontWeight:bt.colPrincipal.bold?700:400}}>{Number(Math.round(entry.principalAmount)).toLocaleString('en-IN')}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right" style={{fontSize:bt.colCharges.fontSize*sc,fontWeight:bt.colCharges.bold?700:400}}>{Number(Math.round(entry.chargesAmount)).toLocaleString('en-IN')}</td>
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
                            <tr className="bg-gray-100">
                              <td colSpan={1 + (showDetails ? 2 : 0) + 2} className="border border-gray-300 px-2 py-1.5 text-right" style={{fontSize:bt.total.fontSize*sc,fontWeight:bt.total.bold?700:400}}>एकूण</td>
                              <td className="border border-gray-300 px-2 py-1.5 text-right" style={{fontSize:bt.total.fontSize*sc,fontWeight:bt.total.bold?700:400}}>
                                {Number(Math.round(summaryEntries.reduce((sum, e) => sum + e.principalAmount, 0))).toLocaleString('en-IN')}
                              </td>
                              <td className="border border-gray-300 px-2 py-1.5 text-right" style={{fontSize:bt.total.fontSize*sc,fontWeight:bt.total.bold?700:400}}>
                                {Number(Math.round(summaryEntries.reduce((sum, e) => sum + e.chargesAmount, 0))).toLocaleString('en-IN')}
                              </td>
                              <td className="border border-gray-300"></td>
                            </tr>
                            <tr className="bg-amber-50">
                              <td colSpan={1 + (showDetails ? 2 : 0) + 2 + 1} className="border border-gray-300 px-2 py-1.5 text-right" style={{fontSize:bt.grandTotal.fontSize*sc*0.7,fontWeight:bt.grandTotal.bold?700:400}}>Grand Total</td>
                              <td className="border border-gray-300 px-2 py-1.5 text-right text-green-700" style={{fontSize:bt.grandTotal.fontSize*sc,fontWeight:bt.grandTotal.bold?900:400}}>
                                {Number(Math.round(summaryEntries.reduce((sum, e) => sum + e.principalAmount + e.chargesAmount, 0))).toLocaleString('en-IN')}
                              </td>
                              <td className="border border-gray-300"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                        </>);
                      })()}
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
                        className="text-indigo-600 border-indigo-300"
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

      {dateWarningDialog.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`bg-white rounded-xl shadow-2xl w-[90%] max-w-md mx-4 border-t-4 ${
            dateWarningDialog.severity === 'critical' ? 'border-red-500' : 'border-amber-500'
          }`}>
            <div className={`p-4 flex items-start gap-3 ${
              dateWarningDialog.severity === 'critical' ? 'bg-red-50' : 'bg-amber-50'
            } rounded-t-lg`}>
              <div className={`p-2 rounded-full shrink-0 ${
                dateWarningDialog.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className={`font-bold text-sm ${
                  dateWarningDialog.severity === 'critical' ? 'text-red-800' : 'text-amber-800'
                }`}>
                  {dateWarningDialog.title}
                </h3>
                <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                  {dateWarningDialog.message}
                </p>
              </div>
            </div>
            <div className="p-4 flex gap-2 justify-end bg-gray-50 rounded-b-xl">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClosureDateWarningCancel}
                className="text-sm"
              >
                रद्द करा
              </Button>
              <Button
                size="sm"
                onClick={handleClosureDateWarningConfirm}
                className={`text-sm text-white ${
                  dateWarningDialog.severity === 'critical'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                तरीही सेव करा
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}