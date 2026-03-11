import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { sortLoans } from "@/lib/loan-sorting";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceUtils } from "@/lib/performance-utils";
import { useOptimizedLoans } from "@/hooks/use-optimized-loans";
import { useOptimizedSearch } from "@/hooks/use-optimized-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DualLanguageInput } from "@/components/ui/dual-language-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoanCalculations } from "@/lib/calculations";
import { DateUtils } from "@/lib/date-utils";
import { Plus, Edit, Trash2, CreditCard, Search, Calendar, Filter, X, FileText, MoreVertical, Lock, Home, RotateCcw, ChevronDown, ChevronRight, Check, Camera, AlertTriangle, Printer, CheckSquare, Square } from "lucide-react";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { PhotoViewer } from "@/components/ui/photo-viewer";
import { Link, useLocation } from "wouter";
import { ReceiptGenerator } from "@/components/receipt-generator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LabelPrintDialog } from "@/components/label-print-dialog";


const loanSchema = z.object({
  groupId: z.string().min(1, "ग्रुप निवडा"),
  borrowerId: z.string().nullable().optional(),
  borrowerName: z.string().min(1, "कर्जदाराचे नाव आवश्यक आहे"),
  borrowerMobile: z.string().optional(),
  borrowerAddress: z.string().optional(),
  businessType: z.string().min(1, "व्यवसाय प्रकार निवडा"),
  isFarmer: z.boolean().default(false),
  isBackwardClass: z.boolean().default(false),
  loanType: z.string().min(1, "कर्जाचा प्रकार निवडा"),
  accountNumber: z.string().min(1, "खाते क्रमांक आवश्यक आहे"),
  principalAmount: z.string().min(1, "कर्जाची रक्कम आवश्यक आहे"),
  loanDate: z.string().min(1, "कर्जाची तारीख आवश्यक आहे"),
  maturityDate: z.string().min(1, "कर्ज मुदत दिनांक आवश्यक आहे"),
  
  // Maturity fields
  hasMaturity: z.boolean().default(false),
  maturityMonths: z.string().optional(),
  
  interestRate: z.string().min(1, "व्याजाचा दर आवश्यक आहे"),
  interestRateType: z.string().default("monthly"), // yearly, monthly
  collateralDetails: z.string().optional().default(""),
  weight: z.string().optional().default(""),
  purity: z.string().optional().default("82"),
  marketValue: z.string().optional(),
  documentDetails: z.string().optional().default("—"),
  specialConditions: z.string().optional().default("—"),
  otherInfo: z.string().optional().default("—"),
});

type LoanFormData = z.infer<typeof loanSchema>;

function Loans() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<any>(null);
  
  // Track camera dialog state to prevent parent dialog close when camera is open
  const [isCameraDialogOpen, setIsCameraDialogOpen] = useState(false);
  
  // Photo state for new loans (deferred upload)
  const [pendingPhotos, setPendingPhotos] = useState<any[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [createdLoanId, setCreatedLoanId] = useState<string | null>(null);
  const [isPhotoSectionOpen, setIsPhotoSectionOpen] = useState(false);
  
  // Date warning confirmation state
  const [dateWarningDialog, setDateWarningDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    severity: string;
    formData: LoanFormData | null;
  }>({ open: false, title: '', message: '', severity: '', formData: null });

  // Duplicate loan warning state
  const [duplicateWarningDialog, setDuplicateWarningDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    formData: LoanFormData | null;
  }>({ open: false, title: '', message: '', formData: null });

  // LTV overloading warning state
  const [ltvWarningDialog, setLtvWarningDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    formData: LoanFormData | null;
  }>({ open: false, title: '', message: '', formData: null });
  
  const savedScrollPositionRef = useRef<number | null>(null);
  const scrollLockActiveRef = useRef<boolean>(false);

  // Refs for keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState({
    groupId: "all",
    dateFrom: DateUtils.formatForInput(new Date()),
    dateTo: DateUtils.formatForInput(new Date()),
  });
  // Removed isSearchActive - simplified search logic
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Pagination states for large datasets
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [showLoadMore, setShowLoadMore] = useState(false);

  const [selectedLoanIds, setSelectedLoanIds] = useState<Set<string | number>>(new Set());
  const [labelPrintDialogOpen, setLabelPrintDialogOpen] = useState(false);
  const [labelPrintLoans, setLabelPrintLoans] = useState<any[]>([]);

  // Loan details modal state
  const [selectedLoanDetails, setSelectedLoanDetails] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Live gold rate for auto market value calculation
  const [liveGoldRate, setLiveGoldRate] = useState<number>(0);
  const [goldRateSource, setGoldRateSource] = useState<string>('');
  const [goldRateStatus, setGoldRateStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [marketValueManual, setMarketValueManual] = useState(false);
  const [editOriginalRate, setEditOriginalRate] = useState<number>(0);
  
  // Borrower autocomplete state
  const [showBorrowerSuggestions, setShowBorrowerSuggestions] = useState(false);
  const [borrowerSearchQuery, setBorrowerSearchQuery] = useState("");
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const borrowerDropdownRef = useRef<HTMLDivElement>(null);

  // Simple form setup for basic functionality
  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      groupId: "",
      borrowerName: "",
      borrowerMobile: "",
      borrowerAddress: "",
      businessType: "बिगर शेती",
      isFarmer: false,
      isBackwardClass: false,
      loanType: "तारण",
      accountNumber: "",
      principalAmount: "",
      loanDate: DateUtils.getCurrentIndianDate(),
      maturityDate: DateUtils.addMonthsToIndianDate(DateUtils.getCurrentIndianDate(), 12),
      hasMaturity: false,
      maturityMonths: "",
      interestRate: "",
      interestRateType: "monthly",
      collateralDetails: "",
      weight: "",
      purity: "82",
      marketValue: "",
      documentDetails: "",
      specialConditions: "", 
      otherInfo: "",
    },
  });

  // Fetch live gold rate on mount
  useEffect(() => {
    fetch('/api/gold-rate')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.perGram > 0) {
          setLiveGoldRate(data.perGram);
          setGoldRateSource(data.source || 'Live');
          setGoldRateStatus('success');
        } else {
          setGoldRateStatus('failed');
        }
      })
      .catch(() => {
        setGoldRateStatus('failed');
      });
  }, []);

  const smartRound = (val: number): number => {
    if (val >= 10000) return Math.floor(val / 1000) * 1000;
    if (val >= 1000) return Math.floor(val / 500) * 500;
    if (val >= 100) return Math.floor(val / 100) * 100;
    return Math.floor(val);
  };

  const watchedLoanType = form.watch("loanType");

  useEffect(() => {
    if (watchedLoanType === 'विनातारण') {
      form.setValue('collateralDetails', '', { shouldValidate: false });
      form.setValue('weight', '', { shouldValidate: false });
      form.setValue('purity', '82', { shouldValidate: false });
      form.setValue('marketValue', '', { shouldValidate: false });
    }
  }, [watchedLoanType]);

  // Auto-calculate market value when weight or purity changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'weight' || name === 'purity') {
        if (value.loanType === 'विनातारण') return;
        const weightStr = (value.weight || '0').replace(/[^\d.]/g, '');
        const weightNum = parseFloat(weightStr) || 0;
        const purityNum = parseFloat(value.purity || '82') || 82;
        if (weightNum > 0) {
          const fineWeight = weightNum * (purityNum / 100);
          if (editOriginalRate > 0) {
            const marketVal = smartRound(fineWeight * editOriginalRate);
            form.setValue('marketValue', String(marketVal), { shouldValidate: false });
          } else if (!marketValueManual && liveGoldRate > 0) {
            const marketVal = smartRound(fineWeight * liveGoldRate);
            form.setValue('marketValue', String(marketVal), { shouldValidate: false });
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, liveGoldRate, marketValueManual, editOriginalRate]);

  // Auto-calculate maturity date when loanDate changes (reactive)
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Only auto-update maturity when loanDate changes and hasMaturity is false
      if (name === 'loanDate' && !value.hasMaturity) {
        const loanDate = value.loanDate;
        if (loanDate && DateUtils.isValidIndianDate(loanDate)) {
          // Calculate maturity = loanDate + 12 months in DD/MM/YYYY format
          const calculatedMaturity = DateUtils.addMonthsToIndianDate(loanDate, 12);
          form.setValue('maturityDate', calculatedMaturity, { shouldValidate: false });
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  // Handle clicking outside borrower dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (borrowerDropdownRef.current && !borrowerDropdownRef.current.contains(event.target as Node)) {
        setShowBorrowerSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  // Simple handlers
  const handleEdit = (loan: any) => {
    savedScrollPositionRef.current = window.scrollY;
    
    // Pre-fill form with loan data
    form.reset({
      groupId: loan.groupId || "",
      borrowerId: loan.borrowerId || "",
      borrowerName: loan.borrowerName || "",
      borrowerMobile: loan.borrowerMobile || "",
      borrowerAddress: loan.borrowerAddress || "",
      businessType: loan.businessType === "शेती" ? "बिगर शेती" : (loan.businessType || "बिगर शेती"),
      isFarmer: loan.isFarmer ?? false,
      isBackwardClass: loan.isBackwardClass ?? false,
      loanType: loan.loanType || "gold_loan",
      accountNumber: loan.accountNumber || "",
      principalAmount: loan.principalAmount ? String(loan.principalAmount).replace('.00', '') : "",
      loanDate: loan.loanDate || DateUtils.formatForInput(new Date()),
      maturityDate: loan.maturityDate || DateUtils.formatForInput(new Date()),
      hasMaturity: !!loan.hasMaturity,
      maturityMonths: loan.maturityMonths ? String(loan.maturityMonths) : "",
      interestRate: loan.interestRate ? String(loan.interestRate).replace('.00', '') : "",
      interestRateType: loan.interestRateType || "monthly",
      collateralDetails: loan.collateralDetails || "",
      weight: loan.weight || "",
      purity: loan.purity ? String(loan.purity).replace('.00', '') : "82",
      marketValue: loan.marketValue ? String(loan.marketValue).replace('.00', '') : "",
      documentDetails: loan.documentDetails || "",
      specialConditions: loan.specialConditions || "",
      otherInfo: loan.otherInfo || "",
    });
    
    setEditingLoan(loan);
    const mv = parseFloat(String(loan.marketValue || '0').replace(/[^\d.]/g, '')) || 0;
    const wt = parseFloat(String(loan.weight || '0').replace(/[^\d.]/g, '')) || 0;
    const pu = parseFloat(String(loan.purity || '82')) || 82;
    const fineWt = wt * (pu / 100);
    if (fineWt > 0 && mv > 0) {
      setEditOriginalRate(mv / fineWt);
      setMarketValueManual(true);
    } else {
      setEditOriginalRate(0);
      setMarketValueManual(false);
    }
    setIsDialogOpen(true);
  };

  const handleCloseLoan = (loan: any) => {
    // Navigate to closure form with loan pre-selected
    setLocation(`/closure?loanId=${loan.id}`);
  };

  const handleReopen = (loan: any) => {
    if (confirm(`खाते ${loan.accountNumber} - ${loan.borrowerName} पुन्हा उघडायचे काय?`)) {
      // Implement loan reopening logic
      alert("खाते पुन्हा उघडण्याची सुविधा लवकरच उपलब्ध होईल.");
    }
  };

  const deleteLoanMutation = useMutation({
    mutationFn: async (loanId: string) => {
      const response = await apiRequest(`/api/loans/${loanId}`, "DELETE");
      return response.json();
    },
    onMutate: async (loanId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/loans"] });
      const previousLoans = queryClient.getQueryData(["/api/loans"]);
      queryClient.setQueryData(["/api/loans"], (old: any) =>
        Array.isArray(old) ? old.filter((loan: any) => loan.id !== loanId) : old
      );
      return { previousLoans };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-closures"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"], refetchType: 'all' });
      setSelectedLoanId(null);
      toast({
        title: "कर्ज डिलीट झाले",
        description: "कर्ज आणि संबंधित व्यवहार यशस्वीपणे डिलीट केले गेले.",
      });
    },
    onError: (error: any, _loanId: string, context: any) => {
      if (context?.previousLoans) {
        queryClient.setQueryData(["/api/loans"], context.previousLoans);
      }
      let msg = "कर्ज डिलीट करताना त्रुटी आली. पुन्हा प्रयत्न करा.";
      try {
        const errorText = error?.message || '';
        const jsonMatch = errorText.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          msg = parsed.message || msg;
        }
      } catch(e) {}
      toast({
        title: "डिलीट अयशस्वी",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const handleDelete = (loanId: string) => {
    if (confirm("हे कर्ज पूर्णपणे डिलीट करायचे काय? ही क्रिया रद्द करता येणार नाही.")) {
      const scrollY = window.scrollY;
      const startTime = Date.now();
      const lockInterval = setInterval(() => {
        if (Date.now() - startTime > 1500) {
          clearInterval(lockInterval);
          return;
        }
        window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior });
      }, 50);
      deleteLoanMutation.mutate(loanId);
    }
  };

  const toggleLoanSelection = (loanId: string | number) => {
    setSelectedLoanIds(prev => {
      const next = new Set(prev);
      if (next.has(loanId)) next.delete(loanId);
      else next.add(loanId);
      return next;
    });
  };

  const handleLabelPrintSingle = (loan: any) => {
    setLabelPrintLoans([{
      ...loan,
      groupName: loan.groupName || loan.group?.name || "",
      interestRate: loan.interestRate,
      interestRateType: loan.interestRateType,
      maturityDate: loan.maturityDate,
      loanType: loan.loanType,
      businessType: loan.businessType,
      borrowerMobile: loan.borrowerMobile,
      borrowerAddress: loan.borrowerAddress,
      marketValue: loan.marketValue,
      documentDetails: loan.documentDetails,
      specialConditions: loan.specialConditions,
    }]);
    setLabelPrintDialogOpen(true);
  };


  // Form submission handler with real database integration
  const createLoanMutation = useMutation({
    mutationFn: async (data: LoanFormData & { dateWarningConfirmed?: boolean }) => {
      const apiData: any = {
        ...data,
        groupId: data.groupId || undefined,
        borrowerId: data.borrowerId || undefined,
        principalAmount: data.principalAmount,
        interestRate: data.interestRate,
        purity: data.purity || "82",
        marketValue: data.marketValue || undefined,
        maturityMonths: data.maturityMonths ? parseInt(data.maturityMonths) : undefined,
      };
      if (data.dateWarningConfirmed) {
        apiData.dateWarningConfirmed = true;
      }
      if ((data as any).duplicateWarningConfirmed) {
        apiData.duplicateWarningConfirmed = true;
      }
      
      if (editingLoan) {
        const response = await apiRequest(`/api/loans/${editingLoan.id}`, "PUT", apiData);
        return response.json();
      } else {
        const response = await apiRequest("/api/loans", "POST", apiData);
        const result = await response.json();
        if (result.dateWarning) {
          setDateWarningDialog({
            open: true,
            title: result.warningTitle,
            message: result.warningMessage,
            severity: result.warningSeverity,
            formData: data
          });
          return { __dateWarning: true };
        }
        if (result.duplicateWarning) {
          setDuplicateWarningDialog({
            open: true,
            title: result.warningTitle,
            message: result.warningMessage,
            formData: data
          });
          return { __duplicateWarning: true };
        }
        return result;
      }
    },
    onSuccess: async (newLoan) => {
      if (newLoan?.__dateWarning) return;
      if (newLoan?.__duplicateWarning) return;
      
      toast({
        title: editingLoan ? "कर्ज अपडेट झाले" : "कर्ज नोंद झाले",
        description: editingLoan 
          ? `खाते ${newLoan.accountNumber} यशस्वीपणे अपडेट केले गेले`
          : `खाते ${newLoan.accountNumber} यशस्वीपणे तयार केले गेले`,
      });
      
      if (!editingLoan && pendingPhotos.length > 0) {
        setCreatedLoanId(newLoan.id);
        await handlePhotoUpload(newLoan.id);
      }
      
      if (editingLoan) {
        const scrollTarget = savedScrollPositionRef.current;
        const editedLoanId = editingLoan.id;

        queryClient.setQueryData(["/api/loans"], (oldLoans: any[]) => {
          if (!oldLoans) return oldLoans;
          return oldLoans.map((loan: any) =>
            loan.id === editedLoanId ? { ...loan, ...newLoan } : loan
          );
        });

        form.reset();
        setIsDialogOpen(false);
        setEditingLoan(null);
        setCreatedLoanId(null);
        setMarketValueManual(false);
        setEditOriginalRate(0);

        scrollLockActiveRef.current = true;
        let scrollLock: ReturnType<typeof setInterval> | null = null;
        if (scrollTarget !== null) {
          scrollLock = setInterval(() => {
            window.scrollTo(0, scrollTarget);
          }, 16);
          window.scrollTo(0, scrollTarget);
        }

        const safetyTimeout = scrollLock ? setTimeout(() => {
          if (scrollLock) clearInterval(scrollLock);
          scrollLockActiveRef.current = false;
        }, 5000) : null;

        await queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });

        queryClient.setQueryData(["/api/loans"], (currentLoans: any[]) => {
          if (!currentLoans) return currentLoans;
          return currentLoans.map((loan: any) =>
            loan.id === editedLoanId ? { ...loan, ...newLoan } : loan
          );
        });

        queryClient.invalidateQueries({ queryKey: ["/api/borrowers/autocomplete"], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' });

        if (scrollLock !== null) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.scrollTo(0, scrollTarget!);
              savedScrollPositionRef.current = null;
              clearInterval(scrollLock!);
              if (safetyTimeout) clearTimeout(safetyTimeout);
              scrollLockActiveRef.current = false;
            });
          });
        } else {
          scrollLockActiveRef.current = false;
        }
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/loans"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers/autocomplete"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-transactions"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' });

      if (!editingLoan) {
        const currentGroupId = form.getValues('groupId');
        const currentGroupName = groupSearchTerm;
        const todayDate = DateUtils.getCurrentIndianDate();
        form.reset({
          groupId: currentGroupId,
          borrowerName: "",
          borrowerMobile: "",
          borrowerAddress: "",
          businessType: "बिगर शेती",
          isFarmer: false,
          isBackwardClass: false,
          loanType: "तारण",
          accountNumber: "",
          principalAmount: "",
          loanDate: todayDate,
          maturityDate: DateUtils.addMonthsToIndianDate(todayDate, 12),
          hasMaturity: false,
          maturityMonths: "",
          interestRate: "",
          interestRateType: "monthly",
          collateralDetails: "",
          weight: "",
          purity: "82",
          marketValue: "",
          documentDetails: "—",
          specialConditions: "—",
          otherInfo: "—",
        });
        setGroupSearchTerm(currentGroupName);
        setBorrowerSearchTerm("");
        setBorrowerSearchQuery("");
        setShowBorrowerSuggestions(false);
        setPendingPhotos([]);
        setCreatedLoanId(null);
        setIsPhotoSectionOpen(false);
      }
    },
    onError: (error: Error) => {
      console.error("🚨 Loan submission error:", error);
      
      toast({
        title: "त्रुटी",
        description: error.message || "कर्ज नोंदणीत समस्या आली. कृपया पुन्हा प्रयत्न करा.",
        variant: "destructive",
      });
    },
  });

  // Photo upload function that can be called for new loans or retry
  const handlePhotoUpload = async (loanId: string) => {
    if (pendingPhotos.length === 0) return;
    
    setIsUploadingPhotos(true);
    
    try {
      toast({
        title: "फोटो अपलोड करत आहे",
        description: `${pendingPhotos.length} फोटो server मध्ये upload करत आहे...`,
      });
      
      // Upload pending photos
      const { photosToFormData } = await import('@/lib/photo-utils');
      const formData = photosToFormData(pendingPhotos, loanId);
      
      const response = await fetch(`/api/loans/${loanId}/photos`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Photo upload failed');
      }
      
      // Success: Clear all states and close dialog
      setPendingPhotos([]);
      setIsUploadingPhotos(false);
      setCreatedLoanId(null);
      
      // Invalidate cache to refresh photos list
      queryClient.invalidateQueries({ queryKey: ["/api/loans", loanId, "photos"] });
      
      toast({
        title: "फोटो अपलोड यशस्वी",
        description: `${pendingPhotos.length} फोटो यशस्वीरित्या save झाले`,
      });
      
      if (editingLoan) {
        form.reset();
        setIsDialogOpen(false);
        setEditingLoan(null);
        setMarketValueManual(false);
        setEditOriginalRate(0);
      } else {
        const currentGroupId = form.getValues('groupId');
        const currentGroupName = groupSearchTerm;
        const todayDate = DateUtils.getCurrentIndianDate();
        form.reset({
          groupId: currentGroupId,
          borrowerName: "",
          borrowerMobile: "",
          borrowerAddress: "",
          businessType: "बिगर शेती",
          isFarmer: false,
          isBackwardClass: false,
          loanType: "तारण",
          accountNumber: "",
          principalAmount: "",
          loanDate: todayDate,
          maturityDate: DateUtils.addMonthsToIndianDate(todayDate, 12),
          hasMaturity: false,
          maturityMonths: "",
          interestRate: "",
          interestRateType: "monthly",
          collateralDetails: "",
          weight: "",
          purity: "82",
          marketValue: "",
          documentDetails: "—",
          specialConditions: "—",
          otherInfo: "—",
        });
        setGroupSearchTerm(currentGroupName);
        setBorrowerSearchTerm("");
        setBorrowerSearchQuery("");
        setShowBorrowerSuggestions(false);
        setIsPhotoSectionOpen(false);
      }
      
    } catch (error) {
      console.error('Photo upload error:', error);
      setIsUploadingPhotos(false);
      
      toast({
        title: "फोटो अपलोड त्रुटी",
        description: "फोटो upload करताना समस्या झाली. कृपया पुन्हा प्रयत्न करा.",
        variant: "destructive",
      });
      
      // Keep dialog open and states for retry
    }
  };

  const onSubmit = async (data: LoanFormData & { ltvWarningConfirmed?: boolean }) => {
    if (createdLoanId) {
      await handlePhotoUpload(createdLoanId);
      return;
    }

    if (data.loanType !== 'विनातारण') {
      if (!data.collateralDetails || data.collateralDetails.trim() === '') {
        toast({ title: "कृपया तारणाचा तपशील भरा", variant: "destructive" });
        return;
      }
      if (!data.weight || data.weight.trim() === '') {
        toast({ title: "कृपया वजन भरा", variant: "destructive" });
        return;
      }
    }

    const ltvEnabled = (company as any)?.ltvWarningEnabled !== false;
    if (ltvEnabled && !data.ltvWarningConfirmed && data.marketValue && data.principalAmount) {
      const principal = parseFloat(data.principalAmount) || 0;
      const market = parseFloat(data.marketValue) || 0;
      if (market > 0 && principal > 0) {
        const ltv = (principal / market) * 100;
        if (ltv > 80) {
          const overAmount = principal - Math.round(market * 0.8);
          const ltvRounded = Math.round(ltv);
          setLtvWarningDialog({
            open: true,
            title: `⚠️ लोडिंग — जास्त रक्कम (LTV ${ltvRounded}%)`,
            message: `कर्ज रक्कम ₹${Number(principal).toLocaleString('en-IN')} ही बाजार मूल्य ₹${Number(market).toLocaleString('en-IN')} च्या 80% (₹${Math.round(market * 0.8).toLocaleString('en-IN')}) पेक्षा ₹${overAmount.toLocaleString('en-IN')} जास्त आहे.\n\nतरीही सेव्ह करायचे का?`,
            formData: data,
          });
          return;
        }
      }
    }
    
    createLoanMutation.mutate(data);
  };

  const handleDateWarningConfirm = () => {
    if (dateWarningDialog.formData) {
      createLoanMutation.mutate({ ...dateWarningDialog.formData, dateWarningConfirmed: true } as any);
      setDateWarningDialog({ open: false, title: '', message: '', severity: '', formData: null });
    }
  };

  const handleDateWarningCancel = () => {
    setDateWarningDialog({ open: false, title: '', message: '', severity: '', formData: null });
  };

  const handleDuplicateWarningConfirm = () => {
    if (duplicateWarningDialog.formData) {
      createLoanMutation.mutate({ ...duplicateWarningDialog.formData, duplicateWarningConfirmed: true } as any);
      setDuplicateWarningDialog({ open: false, title: '', message: '', formData: null });
    }
  };

  const handleDuplicateWarningCancel = () => {
    setDuplicateWarningDialog({ open: false, title: '', message: '', formData: null });
  };

  const handleLtvWarningConfirm = () => {
    if (ltvWarningDialog.formData) {
      createLoanMutation.mutate({ ...ltvWarningDialog.formData, ltvWarningConfirmed: true } as any);
      setLtvWarningDialog({ open: false, title: '', message: '', formData: null });
    }
  };

  const handleLtvWarningCancel = () => {
    setLtvWarningDialog({ open: false, title: '', message: '', formData: null });
  };

  // Keyboard shortcut handler for Ctrl+S
  useEffect(() => {
    const handleKeyboardShortcut = (e: KeyboardEvent) => {
      // Only handle Ctrl+S when dialog is open
      if (isDialogOpen && e.ctrlKey && e.key === 's') {
        e.preventDefault(); // Prevent browser save dialog
        e.stopPropagation();
        
        // Trigger form submission
        form.handleSubmit(onSubmit)();
      }
    };

    // Add event listener when dialog is open
    if (isDialogOpen) {
      document.addEventListener('keydown', handleKeyboardShortcut);
      return () => {
        document.removeEventListener('keydown', handleKeyboardShortcut);
      };
    }
  }, [isDialogOpen, form, onSubmit]);


  // Data fetching queries - MUST BE FIRST before any functions use them
  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ["/api/loans"],
    staleTime: 2 * 60 * 1000, // 2 minutes cache for better performance
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  });

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  const { data: groups } = useQuery({
    queryKey: ["/api/groups"],
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });

  // Smart Autocomplete State - Instant suggestions (no debounce)
  const [borrowerSearchTerm, setBorrowerSearchTerm] = useState("");

  // Real-time borrower autocomplete query from existing loans database - INSTANT RESPONSE
  const { data: borrowerAutocompleteSuggestions = [] } = useQuery<any[]>({
    queryKey: ["/api/borrowers/autocomplete", borrowerSearchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/borrowers/autocomplete?search=${encodeURIComponent(borrowerSearchTerm)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch borrower suggestions');
      return res.json();
    },
    enabled: borrowerSearchTerm.length >= 2,
    staleTime: 30 * 1000, // 30 seconds cache for autocomplete
    gcTime: 2 * 60 * 1000, // 2 minutes garbage collection
  });
  const borrowerInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (borrowerAutocompleteSuggestions.length > 0 && borrowerSearchTerm.length >= 2) {
      setShowBorrowerSuggestions(true);
    }
  }, [borrowerAutocompleteSuggestions, borrowerSearchTerm]);
  
  // Group Search State - Cross-Language Support
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
  const [selectedGroupSuggestionIndex, setSelectedGroupSuggestionIndex] = useState(-1);
  const groupInputRef = useRef<HTMLInputElement>(null);
  const groupSuggestionsRef = useRef<HTMLDivElement>(null);

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

  // Enhanced Smart Fuzzy Search Logic with Dual Language Support
  const fuzzyMatch = (text: string, query: string): number => {
    if (!query) return 0;
    
    const textLower = normalizeMarathiVowels(text.toLowerCase());
    const queryLower = normalizeMarathiVowels(query.toLowerCase());
    
    // Enhanced transliteration mapping for borrower search
    const englishToMarathi: Record<string, string> = {
      // Names
      'ram': 'राम', 'shyam': 'श्याम', 'geeta': 'गीता', 'seeta': 'सीता',
      'vijay': 'विजय', 'ajay': 'अजय', 'sanjay': 'संजय', 'prakash': 'प्रकाश',
      'sunil': 'सुनील', 'anil': 'अनिल', 'vinod': 'विनोद', 'manoj': 'मनोज',
      'raju': 'राजू', 'babu': 'बाबू', 'sir': 'सर', 'ji': 'जी',
      'umesh': 'उमेश', 'ganesh': 'गणेश', 'mahesh': 'महेश', 'ramesh': 'रमेश',
      'suresh': 'सुरेश', 'dinesh': 'दिनेश', 'kiran': 'किरण', 'deepak': 'दीपक',
      'sachin': 'सचिन', 'rahul': 'राहुल', 'rohit': 'रोहित', 'amit': 'अमित',
      'sumit': 'सुमित', 'ashok': 'अशोक', 'radhika': 'राधिका', 'priya': 'प्रिया',
      
      // Surnames
      'patel': 'पाटील', 'patil': 'पाटील', 'kumar': 'कुमार', 'devi': 'देवी',
      'sharma': 'शर्मा', 'singh': 'सिंग', 'yadav': 'यादव', 'joshi': 'जोशी',
      'shah': 'शाह', 'gupta': 'गुप्ता', 'agarwal': 'अग्रवाल', 'tiwari': 'तिवारी',
      'more': 'मोरे', 'jadhav': 'जाधव', 'desai': 'देसाई', 'kale': 'काळे',
      'kulkarni': 'कुलकर्णी', 'jain': 'जैन', 'gandhi': 'गांधी',
      
      // Religious/Traditional
      'laxmi': 'लक्ष्मी', 'ganga': 'गंगा', 'saraswati': 'सरस्वती',
      'rajkumar': 'राजकुमार', 'rajat': 'राजत', 'krishna': 'कृष्ण',
      'hanuman': 'हनुमान', 'shiva': 'शिव', 'vishnu': 'विष्णु'
    };
    
    const marathiToEnglish: Record<string, string> = {
      // Names
      'राम': 'ram', 'श्याम': 'shyam', 'गीता': 'geeta', 'सीता': 'seeta',
      'विजय': 'vijay', 'अजय': 'ajay', 'संजय': 'sanjay', 'प्रकाश': 'prakash',
      'सुनील': 'sunil', 'अनिल': 'anil', 'विनोद': 'vinod', 'मनोज': 'manoj',
      'राजू': 'raju', 'बाबू': 'babu', 'सर': 'sir', 'जी': 'ji',
      'उमेश': 'umesh', 'गणेश': 'ganesh', 'महेश': 'mahesh', 'रमेश': 'ramesh',
      'सुरेश': 'suresh', 'दिनेश': 'dinesh', 'किरण': 'kiran', 'दीपक': 'deepak',
      'सचिन': 'sachin', 'राहुल': 'rahul', 'रोहित': 'rohit', 'अमित': 'amit',
      'सुमित': 'sumit', 'अशोक': 'ashok', 'राधिका': 'radhika', 'प्रिया': 'priya',
      
      // Surnames
      'पाटील': 'patel', 'कुमार': 'kumar', 'देवी': 'devi',
      'शर्मा': 'sharma', 'सिंग': 'singh', 'यादव': 'yadav', 'जोशी': 'joshi',
      'शाह': 'shah', 'गुप्ता': 'gupta', 'अग्रवाल': 'agarwal', 'तिवारी': 'tiwari',
      'मोरे': 'more', 'जाधव': 'jadhav', 'देसाई': 'desai', 'काळे': 'kale',
      'कुलकर्णी': 'kulkarni', 'जैन': 'jain', 'गांधी': 'gandhi',
      
      // Religious/Traditional
      'लक्ष्मी': 'laxmi', 'गंगा': 'ganga', 'सरस्वती': 'saraswati',
      'राजकुमार': 'rajkumar', 'राजत': 'rajat', 'कृष्ण': 'krishna',
      'हनुमान': 'hanuman', 'शिव': 'shiva', 'विष्णू': 'vishnu'
    };
    
    // Create multiple query variations for dual language search
    const createSearchQueries = (originalQuery: string) => {
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
    
    // Cross-Language Group Search Function
    const createGroupSearchQueries = (originalQuery: string) => {
      const englishToMarathi: Record<string, string> = {
        // Names
        'ram': 'राम', 'shyam': 'श्याम', 'geeta': 'गीता', 'seeta': 'सीता',
        'vijay': 'विजय', 'ajay': 'अजय', 'sanjay': 'संजय', 'prakash': 'प्रकाश',
        'sunil': 'सुनील', 'anil': 'अनिल', 'vinod': 'विनोद', 'manoj': 'मनोज',
        'raju': 'राजू', 'babu': 'बाबू', 'sir': 'सर', 'ji': 'जी',
        'umesh': 'उमेश', 'ganesh': 'गणेश', 'mahesh': 'महेश', 'ramesh': 'रमेश',
        'suresh': 'सुरेश', 'dinesh': 'दिनेश', 'kiran': 'किरण', 'deepak': 'दीपक',
        'sachin': 'सचिन', 'rahul': 'राहुल', 'rohit': 'रोहित', 'amit': 'अमित',
        'sumit': 'सुमित', 'ashok': 'अशोक', 'radhika': 'राधिका', 'priya': 'प्रिया',
        
        // Surnames  
        'patel': 'पाटील', 'patil': 'पाटील', 'kumar': 'कुमार', 'devi': 'देवी',
        'sharma': 'शर्मा', 'singh': 'सिंग', 'yadav': 'यादव', 'joshi': 'जोशी',
        'shah': 'शाह', 'gupta': 'गुप्ता', 'agarwal': 'अग्रवाल', 'tiwari': 'तिवारी',
        'more': 'मोरे', 'jadhav': 'जाधव', 'desai': 'देसाई', 'kale': 'काळे',
        'kulkarni': 'कुलकर्णी', 'jain': 'जैन', 'gandhi': 'गांधी',
        
        // Religious/Traditional
        'laxmi': 'लक्ष्मी', 'ganga': 'गंगा', 'saraswati': 'सरस्वती',
        'rajkumar': 'राजकुमार', 'rajat': 'राजत', 'krishna': 'कृष्ण',
        'hanuman': 'हनुमान', 'shiva': 'शिव', 'vishnu': 'विष्णु'
      };
      
      const marathiToEnglish: Record<string, string> = {
        // Names
        'राम': 'ram', 'श्याम': 'shyam', 'गीता': 'geeta', 'सीता': 'seeta',
        'विजय': 'vijay', 'अजय': 'ajay', 'संजय': 'sanjay', 'प्रकाश': 'prakash',
        'सुनील': 'sunil', 'अनिल': 'anil', 'विनोद': 'vinod', 'मनोज': 'manoj',
        'राजू': 'raju', 'बाबू': 'babu', 'सर': 'sir', 'जी': 'ji',
        'उमेश': 'umesh', 'गणेश': 'ganesh', 'महेश': 'mahesh', 'रमेश': 'ramesh',
        'सुरेश': 'suresh', 'दिनेश': 'dinesh', 'किरण': 'kiran', 'दीपक': 'deepak',
        'सचिन': 'sachin', 'राहुल': 'rahul', 'रोहित': 'rohit', 'अमित': 'amit',
        'सुमित': 'sumit', 'अशोक': 'ashok', 'राधिका': 'radhika', 'प्रिया': 'priya',
        
        // Surnames
        'पाटील': 'patel', 'कुमार': 'kumar', 'देवी': 'devi',
        'शर्मा': 'sharma', 'सिंग': 'singh', 'यादव': 'yadav', 'जोशी': 'joshi',
        'शाह': 'shah', 'गुप्ता': 'gupta', 'अग्रवाल': 'agarwal', 'तिवारी': 'tiwari',
        'मोरे': 'more', 'जाधव': 'jadhav', 'देसाई': 'desai', 'काळे': 'kale',
        'कुलकर्णी': 'kulkarni', 'जैन': 'jain', 'गांधी': 'gandhi',
        
        // Religious/Traditional
        'लक्ष्मी': 'laxmi', 'गंगा': 'ganga', 'सरस्वती': 'saraswati',
        'राजकुमार': 'rajkumar', 'राजत': 'rajat', 'कृष्ण': 'krishna',
        'हनुमान': 'hanuman', 'शिव': 'shiva', 'विष्णू': 'vishnu'
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
    
    const searchQueries = createSearchQueries(queryLower);
    let maxScore = 0;
    
    // Test each query variation against the text
    for (const q of searchQueries) {
      let score = 0;
      
      // Exact match gets highest score
      if (textLower === q) {
        score = 100;
      }
      // Starts with query gets high score
      else if (textLower.startsWith(q)) {
        score = 90;
      }
      // Contains query gets medium score
      else if (textLower.includes(q)) {
        score = 80;
      }
      // Word boundary matches get good score
      else {
        const words = textLower.split(/\s+/);
        for (const word of words) {
          if (word.startsWith(q)) {
            score = Math.max(score, 75);
          } else if (word.includes(q)) {
            score = Math.max(score, 65);
          }
        }
      }
      
      // Character-based fuzzy matching for remaining cases
      if (score === 0) {
        let fuzzyScore = 0;
        let textIndex = 0;
        for (let i = 0; i < q.length; i++) {
          const char = q[i];
          const foundIndex = textLower.indexOf(char, textIndex);
          if (foundIndex !== -1) {
            fuzzyScore += 50 - (foundIndex - textIndex); // Closer characters get higher score
            textIndex = foundIndex + 1;
          } else {
            fuzzyScore = 0; // No match
            break;
          }
        }
        score = Math.max(score, Math.min(60, fuzzyScore)); // Cap fuzzy score at 60
      }
      
      maxScore = Math.max(maxScore, score);
    }
    
    return maxScore;
  };

  // Group fuzzy matching with cross-language support
  const groupFuzzyMatch = (text: string, query: string): number => {
    if (!query) return 0;
    
    const textLower = normalizeMarathiVowels(text.toLowerCase());
    const queryLower = normalizeMarathiVowels(query.toLowerCase());
    
    // Create multiple query variations for dual language search
    const createGroupSearchQueries = (originalQuery: string) => {
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

    const searchQueries = createGroupSearchQueries(queryLower);
    
    let maxScore = 0;
    
    searchQueries.forEach((searchQuery: string) => {
      // Direct inclusion anywhere in name (highest priority)
      if (textLower.includes(searchQuery)) {
        maxScore = Math.max(maxScore, 100);
        return;
      }
      
      // Word-level inclusion
      const textWords = textLower.split(/\s+/);
      const hasWordMatch = textWords.some(word => 
        word.includes(searchQuery) || 
        word.startsWith(searchQuery) ||
        searchQuery.includes(word)
      );
      
      if (hasWordMatch) {
        maxScore = Math.max(maxScore, 80);
      }
    });
    
    return maxScore;
  };

  // getSuggestions function will be defined after borrowers data is loaded


  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle borrower suggestions
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          borrowerInputRef.current && !borrowerInputRef.current.contains(event.target as Node)) {
        setShowBorrowerSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
      
      // Handle group suggestions
      if (groupSuggestionsRef.current && !groupSuggestionsRef.current.contains(event.target as Node) &&
          groupInputRef.current && !groupInputRef.current.contains(event.target as Node)) {
        setShowGroupSuggestions(false);
        setSelectedGroupSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync form values with search term when editing
  useEffect(() => {
    if (editingLoan && editingLoan.borrowerName) {
      setBorrowerSearchTerm(editingLoan.borrowerName);
      // Don't show suggestions when editing - this prevents interference
      setShowBorrowerSuggestions(false);
    }
    
    // Sync group search term when editing
    if (editingLoan && editingLoan.groupId && Array.isArray(groups)) {
      const group = groups.find((g: any) => g.id === editingLoan.groupId);
      if (group) {
        setGroupSearchTerm(group.name);
      }
    }
    
    // Sync group search term when editing
    if (editingLoan && editingLoan.groupId && groups && Array.isArray(groups)) {
      const selectedGroup = groups.find((g: any) => g.id === editingLoan.groupId);
      if (selectedGroup) {
        setGroupSearchTerm(selectedGroup.name);
        setShowGroupSuggestions(false);
      }
    }
  }, [editingLoan, groups]);

  // Check if any filters are active (auto-activate search)
  // FIXED: Search should work independently without requiring date filters
  const hasDateFilters = dateFilter.groupId !== "all" || dateFilter.dateFrom || dateFilter.dateTo;
  const hasStatusFilter = statusFilter !== "all";
  const hasActiveFilters = searchQuery || hasStatusFilter || hasDateFilters;
  const hasSearchQuery = searchQuery && searchQuery.trim() !== "";
  
  
  // Calculate string similarity (Levenshtein distance based)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    return 1 - matrix[len1][len2] / Math.max(len1, len2);
  };

  // 🔍 SMART SEARCH SYSTEM - Advanced fuzzy matching with ranking
  const getSearchScore = (loan: any, query: string): number => {
    if (!query || query.trim() === "") return 0;
    
    const searchTerm = normalizeMarathiVowels(query.toLowerCase().trim());
    let score = 0;
    
    
    
    // Field definitions with weights
    const searchFields = [
      { field: loan.borrowerName, weight: 10, label: 'name' },           // Name gets highest priority
      { field: loan.accountNumber, weight: 8, label: 'account' },        // Account number high priority  
      { field: loan.collateralDetails, weight: 6, label: 'item' },       // Items/collateral medium priority
      { field: loan.borrowerMobile, weight: 4, label: 'mobile' },        // Mobile lower priority
      { field: loan.businessType, weight: 3, label: 'business' },        // Business type lowest
      { field: loan.otherInfo, weight: 5, label: 'other' },              // इतर माहिती - third party tracking
    ];
    
    searchFields.forEach(({ field, weight, label }) => {
      if (!field) return;
      
      const fieldValue = normalizeMarathiVowels(field.toString().toLowerCase());
      let fieldScore = 0;
      
      // Exact match gets maximum score
      if (fieldValue === searchTerm) {
        fieldScore = weight * 10;
      }
      // Starts with search term gets high score  
      else if (fieldValue.startsWith(searchTerm)) {
        fieldScore = weight * 8;
      }
      // Contains search term gets medium score
      else if (fieldValue.includes(searchTerm)) {
        fieldScore = weight * 5;
      }
      // Enhanced fuzzy matching for partial matches
      else {
        const words = fieldValue.split(' ');
        words.forEach((word: string) => {
          // Direct word matching
          if (word.startsWith(searchTerm)) {
            fieldScore += weight * 3;
          } else if (word.includes(searchTerm)) {
            fieldScore += weight * 2;
          }
          // Fuzzy similarity matching (mohit ↔ mohite)
          else if (searchTerm.length >= 3 && word.length >= 3) {
            // Check if first 3-4 characters match (mohit vs mohite)
            const searchStart = searchTerm.substring(0, Math.min(4, searchTerm.length));
            const wordStart = word.substring(0, Math.min(4, word.length));
            if (searchStart === wordStart) {
              fieldScore += weight * 2; // Similar names like mohit/mohite
            }
            // Check character similarity (at least 70% similar)
            else if (calculateSimilarity(searchTerm, word) >= 0.7) {
              fieldScore += weight * 1;
            }
          }
        });
      }
      
      // Special handling for numbers (account numbers)
      if (label === 'account' && /\d/.test(searchTerm)) {
        const fieldNumbers = fieldValue.match(/\d+/g) || [];
        fieldNumbers.forEach((num: string) => {
          if (num.startsWith(searchTerm)) {
            fieldScore += weight * 6;
          } else if (num.includes(searchTerm)) {
            fieldScore += weight * 4;
          }
        });
      }
      
      score += fieldScore;
      
    });
    
    return score;
  };


  // 🔍 COMPREHENSIVE FILTERING - Search + Date + Status + Group with Smart Ranking
  // COMPLETELY FIXED: Search works independently, show all loans when no filters
  const filteredLoans = Array.isArray(loans) ? loans.map((loan: any) => {
    
    // Calculate search score
    const searchScore = searchQuery ? getSearchScore(loan, searchQuery) : 1;
    
    // Apply all filters - FIXED: Allow search to work independently
    let passesFilters = true;
    
    
    // 1. Text Search Filter (if search query provided)
    if (hasSearchQuery) {
      if (searchScore === 0) passesFilters = false; // Must have some relevance
    }
    
    // 2. Status Filter
    if (statusFilter !== "all") {
      if (statusFilter === "active" && loan.status !== "active") passesFilters = false;
      if (statusFilter === "closed" && loan.status !== "closed") passesFilters = false;
    }
    
    // 3. Group Filter
    if (dateFilter.groupId !== "all" && loan.groupId !== dateFilter.groupId) {
      passesFilters = false;
    }
    
    // 4. Date Range Filter - COMPLETELY SKIP during search-only queries
    if (searchQuery && searchQuery.trim() !== "") {
      // SKIP all date filters during search - search works completely independently
    } else if (dateFilter.dateFrom || dateFilter.dateTo) {
      const loanDate = new Date(loan.loanDate);
      
      if (dateFilter.dateFrom) {
        const fromDate = new Date(dateFilter.dateFrom);
        if (loanDate < fromDate) {
          passesFilters = false;
        }
      }
      
      if (dateFilter.dateTo) {
        const toDate = new Date(dateFilter.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (loanDate > toDate) {
          passesFilters = false;
        }
      }
    }
    
    return passesFilters ? { ...loan, searchScore } : null;
  }).filter(loan => loan !== null)
  .sort((a, b) => {
    if (hasSearchQuery) {
      return (b.searchScore || 0) - (a.searchScore || 0);
    }
    return 0;
  }) : [];

  const sortedLoans = hasSearchQuery
    ? filteredLoans
    : sortLoans(filteredLoans, Array.isArray(groups) ? groups : [], { dateOrder: 'asc' });

  // Pagination logic for large datasets
  const totalRecords = sortedLoans.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedLoans = sortedLoans.slice(startIndex, endIndex);
  
  // Auto-enable Load More for large datasets
  useEffect(() => {
    setShowLoadMore(totalRecords > 200);
  }, [totalRecords]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRowIndex(-1);
    setSelectedLoanId(null);
  }, [searchQuery, statusFilter, dateFilter]);

  // Enhanced Keyboard navigation and auto-scroll effects - FIXED
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only check if we have results to navigate, not filter conditions
      if (!Array.isArray(paginatedLoans) || paginatedLoans.length === 0) return;
      
      // Don't interfere with form inputs
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.contentEditable === 'true')) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedRowIndex(prev => {
            const newIndex = prev < paginatedLoans.length - 1 ? prev + 1 : 0; // Cycle to first
            if (newIndex >= 0) {
              setSelectedLoanId(paginatedLoans[newIndex]?.id || null);
            }
            return newIndex;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedRowIndex(prev => {
            const newIndex = prev > 0 ? prev - 1 : paginatedLoans.length - 1; // Cycle to last
            if (newIndex >= 0) {
              setSelectedLoanId(paginatedLoans[newIndex]?.id || null);
            }
            return newIndex;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedRowIndex >= 0 && paginatedLoans[selectedRowIndex]) {
            const selectedLoan = paginatedLoans[selectedRowIndex];
            if (selectedLoan.status === 'active') {
              handleEdit(selectedLoan);
            }
          }
          break;
        case ' ': // Space key for full details
          e.preventDefault();
          if (selectedRowIndex >= 0 && paginatedLoans[selectedRowIndex]) {
            const selectedLoan = paginatedLoans[selectedRowIndex];
            setSelectedLoanDetails(selectedLoan);
            setShowDetailsModal(true);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedRowIndex(-1);
          setSelectedLoanId(null);
          break;
      }
    };

    // Always enable keyboard navigation when there are results
    if (Array.isArray(paginatedLoans) && paginatedLoans.length > 0) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [hasSearchQuery, hasDateFilters, hasStatusFilter, paginatedLoans, selectedRowIndex, company]);

  // Manual scroll to search results (controlled by user action)
  const scrollToSearchResults = () => {
    if (searchResultsRef.current) {
      searchResultsRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
      setSelectedRowIndex(0); // Auto-select first row
      if (Array.isArray(filteredLoans) && filteredLoans.length > 0) {
        setSelectedLoanId(filteredLoans[0]?.id || null);
      }
    }
  };

  // Reset form when dialog opens for new loans
  useEffect(() => {
    if (isDialogOpen && !editingLoan) {
      const todayDate = DateUtils.getCurrentIndianDate();
      // Reset form with fresh values for new loan
      form.reset({
        groupId: "",
        borrowerName: "",
        borrowerMobile: "",
        borrowerAddress: "",
        businessType: "बिगर शेती",
        isFarmer: false,
        isBackwardClass: false,
        loanType: "तारण",
        accountNumber: "",
        principalAmount: "",
        loanDate: todayDate,
        maturityDate: DateUtils.addMonthsToIndianDate(todayDate, 12),
        hasMaturity: false,
        maturityMonths: "",
        interestRate: "",
        interestRateType: "monthly",
        collateralDetails: "",
        weight: "",
        purity: "82",
        marketValue: "",
        documentDetails: "—",
        specialConditions: "—", 
        otherInfo: "—",
      });
      // Clear any autocomplete states
      setGroupSearchTerm("");
      setBorrowerSearchTerm("");
      setBorrowerSearchQuery("");
      setShowBorrowerSuggestions(false);
      setShowGroupSuggestions(false);
      
      if (!editingLoan) {
        setPendingPhotos([]);
        setCreatedLoanId(null);
        setIsPhotoSectionOpen(false);
      }
    }
  }, [isDialogOpen, editingLoan, form]);

  useEffect(() => {
    if (isDialogOpen) return;
    if (scrollLockActiveRef.current) return;
    if (savedScrollPositionRef.current !== null) {
      const targetScroll = savedScrollPositionRef.current;
      savedScrollPositionRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, targetScroll);
        });
      });
    }
  }, [isDialogOpen]);

  // Comprehensive Keyboard Shortcuts System
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when typing in input fields (except our specific shortcuts)
      const isInInput = (event.target as HTMLElement)?.tagName === 'INPUT' || 
                       (event.target as HTMLElement)?.tagName === 'TEXTAREA';
      
      // Alt+N: New Loan
      if (event.altKey && event.key === 'n') {
        event.preventDefault();
        event.stopPropagation();
        setIsDialogOpen(true);
        setEditingLoan(null);
        return;
      }
      
      // Alt+F: Focus Search Bar (changed from Alt+S to avoid conflict with form save)
      if (event.altKey && event.key === 'f') {
        event.preventDefault();
        event.stopPropagation();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      
      // Escape: Clear search or close dialog
      if (event.key === 'Escape') {
        if (isDialogOpen) {
          setIsDialogOpen(false);
          setEditingLoan(null);
          setMarketValueManual(false);
          setEditOriginalRate(0);
        } else if (searchQuery) {
          setSearchQuery('');
          searchInputRef.current?.focus();
        }
        return;
      }
      
      // Enter: Submit search (when in search input)
      if (event.key === 'Enter' && !isInInput && searchQuery.trim()) {
        scrollToSearchResults();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [searchQuery, isDialogOpen]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-white">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
      {/* Header with Title and New Loan Button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">कर्ज व्यवस्थापन</h1>
          <p className="text-gray-600">कर्ज नोंदणी, कर्जदार नोंदणी आणि शोध</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          // Prevent parent dialog from closing when camera dialog is open
          if (!open && isCameraDialogOpen) {
            console.log('📸 GUARD: Preventing parent dialog close - camera dialog is open');
            return;
          }
          setIsDialogOpen(open);
          if (!open) {
            setEditingLoan(null);
            setEditOriginalRate(0);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md" title="Alt+N: नवीन कर्ज">
              <Plus className="mr-2 h-4 w-4" />
              नवीन कर्ज
            </Button>
          </DialogTrigger>
          <DialogContent 
            fullScreenMobile={true}
            className="sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] sm:h-[90vh] sm:max-w-7xl sm:max-h-[90vh] overflow-y-auto font-['Noto Sans Devanagari',sans-serif] text-base"
            onEscapeKeyDown={(e) => {
              // Prevent parent dialog from closing when camera dialog is open
              if (isCameraDialogOpen) {
                e.preventDefault();
                console.log('📸 GUARD: Blocking escape key - camera dialog is open');
              }
            }}
            onInteractOutside={(e) => {
              if (isCameraDialogOpen) {
                e.preventDefault();
              }
            }}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingLoan ? "कर्ज संपादन करा" : "नवीन कर्ज नोंदणी"}
              </DialogTitle>
              <DialogDescription>
                {editingLoan ? "कर्जाची माहिती अपडेट करा" : "नवीन कर्ज नोंदणी करण्यासाठी खालील माहिती भरा"}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form 
                onSubmit={form.handleSubmit(onSubmit)} 
                className="space-y-4 sm:space-y-6"
                autoComplete="off"
                onKeyDown={(e) => {
                  // Alt+S: Save Form
                  if (e.altKey && e.key === 's') {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit(onSubmit)();
                  }
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                  
                  {/* Column 1 - Basic Information */}
                  <div className="space-y-2 sm:space-y-3">
                    <h3 className="text-lg font-semibold border-b pb-1 text-indigo-700">मूलभूत माहिती</h3>
                    
                    {/* Group Selection with Autocomplete */}
                    <FormField
                      control={form.control}
                      name="groupId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">ग्रुप निवडा *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                ref={groupInputRef}
                                className="text-base pr-10"
                                placeholder="ग्रुप नाव टाइप करा (उदा: गजलक्ष्मी)"
                                value={groupSearchTerm}
                                tabIndex={1}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setGroupSearchTerm(value);
                                  setSelectedGroupSuggestionIndex(-1);
                                  
                                  const trimmedValue = value.trim();
                                  if (trimmedValue.length >= 1 && Array.isArray(groups)) {
                                    const filtered = groups.filter((group: any) => 
                                      normalizeMarathiVowels(group.name.toLowerCase()).includes(normalizeMarathiVowels(trimmedValue.toLowerCase())) ||
                                      group.name.includes(trimmedValue)
                                    );
                                    setShowGroupSuggestions(filtered.length > 0);
                                  } else {
                                    setShowGroupSuggestions(false);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (!showGroupSuggestions || !Array.isArray(groups)) return;
                                  
                                  const trimmedSearch = groupSearchTerm.trim();
                                  const filteredGroups = trimmedSearch 
                                    ? groups.filter((group: any) => 
                                        normalizeMarathiVowels(group.name.toLowerCase()).includes(normalizeMarathiVowels(trimmedSearch.toLowerCase())) ||
                                        group.name.includes(trimmedSearch)
                                      )
                                    : groups;
                                  
                                  if (filteredGroups.length === 0) return;
                                  
                                  switch (e.key) {
                                    case 'ArrowDown':
                                      e.preventDefault();
                                      setSelectedGroupSuggestionIndex(prev => 
                                        prev < filteredGroups.length - 1 ? prev + 1 : 0
                                      );
                                      break;
                                    case 'ArrowUp':
                                      e.preventDefault();
                                      setSelectedGroupSuggestionIndex(prev => 
                                        prev > 0 ? prev - 1 : filteredGroups.length - 1
                                      );
                                      break;
                                    case 'Enter':
                                      e.preventDefault();
                                      if (selectedGroupSuggestionIndex >= 0) {
                                        const selectedGroup = filteredGroups[selectedGroupSuggestionIndex];
                                        field.onChange(selectedGroup.id);
                                        setGroupSearchTerm(selectedGroup.name);
                                        setShowGroupSuggestions(false);
                                        setSelectedGroupSuggestionIndex(-1);
                                      }
                                      break;
                                    case 'Escape':
                                      setShowGroupSuggestions(false);
                                      setSelectedGroupSuggestionIndex(-1);
                                      break;
                                  }
                                }}
                                onFocus={() => {
                                  const trimmedSearch = groupSearchTerm.trim();
                                  if (trimmedSearch.length >= 1 && Array.isArray(groups) && groups.length > 0) {
                                    const filtered = groups.filter((group: any) => 
                                      normalizeMarathiVowels(group.name.toLowerCase()).includes(normalizeMarathiVowels(trimmedSearch.toLowerCase())) ||
                                      group.name.includes(trimmedSearch)
                                    );
                                    setShowGroupSuggestions(filtered.length > 0);
                                  }
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setShowGroupSuggestions(false);
                                    setSelectedGroupSuggestionIndex(-1);
                                  }, 300);
                                }}
                              />
                              
                              {/* Dropdown Arrow Button */}
                              <button
                                type="button"
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                }}
                                onClick={() => {
                                  if (Array.isArray(groups) && groups.length > 0) {
                                    setGroupSearchTerm("");
                                    setShowGroupSuggestions(true);
                                    setSelectedGroupSuggestionIndex(-1);
                                    const inputEl = groupInputRef.current;
                                    if (inputEl) {
                                      inputEl.focus();
                                    }
                                  }
                                }}
                              >
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              
                              {/* Group Autocomplete Dropdown */}
                              {showGroupSuggestions && Array.isArray(groups) && (() => {
                                const trimmedSearch = groupSearchTerm.trim();
                                const filteredGroups = trimmedSearch 
                                  ? groups.filter((group: any) => 
                                      normalizeMarathiVowels(group.name.toLowerCase()).includes(normalizeMarathiVowels(trimmedSearch.toLowerCase())) ||
                                      group.name.includes(trimmedSearch)
                                    )
                                  : groups;
                                
                                return filteredGroups.length > 0 && (
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {filteredGroups.map((group: any, index: number) => (
                                      <div
                                        key={group.id}
                                        className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${
                                          index === selectedGroupSuggestionIndex 
                                            ? 'bg-indigo-100 border-indigo-200' 
                                            : 'hover:bg-indigo-50'
                                        }`}
                                        onMouseEnter={() => setSelectedGroupSuggestionIndex(index)}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                        }}
                                        onClick={() => {
                                          field.onChange(group.id);
                                          setGroupSearchTerm(group.name);
                                          setShowGroupSuggestions(false);
                                          setSelectedGroupSuggestionIndex(-1);
                                        }}
                                      >
                                        <div className="font-medium text-gray-900">{group.name}</div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Borrower Name with Autocomplete */}
                    <FormField
                      control={form.control}
                      name="borrowerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">कर्जदाराचे नाव *</FormLabel>
                          <FormControl>
                            <div className="relative" ref={borrowerDropdownRef}>
                              <Input
                                {...field}
                                className="text-base"
                                placeholder="कर्जदाराचे नाव टाइप करा (आधीचे कर्जदार दिसतील)"
                                tabIndex={2}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(value);
                                  const trimmedVal = value.trimStart();
                                  const firstWord = trimmedVal.split(/\s/)[0] || '';
                                  const smartTrim = (firstWord.length <= 1 && trimmedVal.length > firstWord.length) ? trimmedVal : value.trim();
                                  setBorrowerSearchTerm(smartTrim);
                                  setBorrowerSearchQuery(value);
                                  setSelectedSuggestionIndex(-1); // Reset selection
                                  
                                  if (smartTrim.length >= 2) {
                                    setShowBorrowerSuggestions(true);
                                  } else {
                                    setShowBorrowerSuggestions(false);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (!showBorrowerSuggestions || borrowerAutocompleteSuggestions.length === 0) return;
                                  
                                  switch (e.key) {
                                    case 'ArrowDown':
                                      e.preventDefault();
                                      setSelectedSuggestionIndex(prev => 
                                        prev < borrowerAutocompleteSuggestions.length - 1 ? prev + 1 : 0
                                      );
                                      break;
                                    case 'ArrowUp':
                                      e.preventDefault();
                                      setSelectedSuggestionIndex(prev => 
                                        prev > 0 ? prev - 1 : borrowerAutocompleteSuggestions.length - 1
                                      );
                                      break;
                                    case 'Enter':
                                      e.preventDefault();
                                      if (selectedSuggestionIndex >= 0) {
                                        const selectedBorrower = borrowerAutocompleteSuggestions[selectedSuggestionIndex];
                                        form.setValue('borrowerName', selectedBorrower.borrowerName);
                                        form.setValue('borrowerMobile', selectedBorrower.borrowerMobile || '');
                                        form.setValue('borrowerAddress', selectedBorrower.borrowerAddress || '');
                                        setBorrowerSearchQuery(selectedBorrower.borrowerName);
                                        setShowBorrowerSuggestions(false);
                                        setSelectedSuggestionIndex(-1);
                                      }
                                      break;
                                    case 'Escape':
                                      setShowBorrowerSuggestions(false);
                                      setSelectedSuggestionIndex(-1);
                                      break;
                                  }
                                }}
                                onFocus={() => {
                                  // Use React Query data instead of local state
                                  if (borrowerAutocompleteSuggestions && borrowerAutocompleteSuggestions.length > 0) {
                                    setShowBorrowerSuggestions(true);
                                  }
                                }}
                                onBlur={() => {
                                  // Delay hiding to allow for clicks (increased for mobile)
                                  setTimeout(() => {
                                    setShowBorrowerSuggestions(false);
                                    setSelectedSuggestionIndex(-1);
                                  }, 300);
                                }}
                              />
                              
                              {/* Autocomplete Dropdown */}
                              {showBorrowerSuggestions && borrowerAutocompleteSuggestions.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                  {borrowerAutocompleteSuggestions.filter((borrower, index, arr) => {
                                    const normalizedName = (borrower.borrowerName || '').normalize('NFC').trim().replace(/\s+/g, ' ');
                                    return arr.findIndex(b => (b.borrowerName || '').normalize('NFC').trim().replace(/\s+/g, ' ') === normalizedName) === index;
                                  }).map((borrower, index) => (
                                    <div
                                      key={index}
                                      className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${
                                        index === selectedSuggestionIndex 
                                          ? 'bg-indigo-100 border-indigo-200' 
                                          : 'hover:bg-indigo-50'
                                      }`}
                                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                                      onMouseDown={(e) => {
                                        // Prevent blur event
                                        e.preventDefault();
                                      }}
                                      onClick={() => {
                                        // Fill in borrower details
                                        form.setValue('borrowerName', borrower.borrowerName);
                                        form.setValue('borrowerMobile', borrower.borrowerMobile || '');
                                        form.setValue('borrowerAddress', borrower.borrowerAddress || '');
                                        setBorrowerSearchQuery(borrower.borrowerName);
                                        setShowBorrowerSuggestions(false);
                                        setSelectedSuggestionIndex(-1);
                                      }}
                                    >
                                      <div className="font-medium text-gray-900">{borrower.borrowerName}</div>
                                      {borrower.borrowerMobile && (
                                        <div className="text-sm text-gray-600">📞 {borrower.borrowerMobile}</div>
                                      )}
                                      {borrower.borrowerAddress && (
                                        <div className="text-sm text-gray-500 truncate">🏠 {borrower.borrowerAddress}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Mobile Number */}
                    <FormField
                      control={form.control}
                      name="borrowerMobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">मोबाइल नंबर</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="" tabIndex={3} className="text-base" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Address */}
                    <FormField
                      control={form.control}
                      name="borrowerAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">पत्ता</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="पूर्ण पत्ता" tabIndex={4} className="text-base" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Business Type */}
                    <FormField
                      control={form.control}
                      name="businessType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">व्यवसाय *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="text-base" tabIndex={5}>
                                <SelectValue placeholder="व्यवसाय निवडा" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="शेती">शेती</SelectItem>
                              <SelectItem value="बिगर शेती">बिगर शेती</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Farmer & Backward Class Checkboxes */}
                    <div className="flex gap-6 items-center py-1">
                      <FormField
                        control={form.control}
                        name="isFarmer"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-medium cursor-pointer">शेतकरी</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="isBackwardClass"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-medium cursor-pointer">मागासवर्गीय</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Loan Type */}
                    <FormField
                      control={form.control}
                      name="loanType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">कर्जाचा प्रकार *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="text-base" tabIndex={6}>
                                <SelectValue placeholder="कर्जाचा प्रकार निवडा" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="तारण">तारण</SelectItem>
                              <SelectItem value="विनातारण">विनातारण</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                {/* Column 2 - Loan Details */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold border-b pb-1 text-green-700">कर्जाची माहिती</h3>
                    
                    {/* Account Number */}
                    <FormField
                      control={form.control}
                      name="accountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">खाते क्रमांक *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder=""
                              tabIndex={7}
                              className="text-base font-bold"
                              style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
                              onChange={(e) => {
                                const converted = e.target.value.replace(/[०-९]/g, (d: string) => String('०१२३४५६७८९'.indexOf(d)));
                                field.onChange(converted);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Principal Amount */}
                    <FormField
                      control={form.control}
                      name="principalAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">कर्ज रक्कम *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              className="text-base font-bold"
                              style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
                              value={!field.value || field.value === '0' ? '' : field.value}
                              onChange={(e) => {
                                const converted = e.target.value.replace(/[०-९]/g, (d: string) => String('०१२३४५६७८९'.indexOf(d)));
                                field.onChange(converted);
                              }}
                              tabIndex={8}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Loan Date */}
                    <FormField
                      control={form.control}
                      name="loanDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">
                            कर्ज दिनांक *<span className="hidden sm:inline"> (DD/MM/YYYY)</span>
                          </FormLabel>
                          <FormControl>
                            <div>
                              {/* Desktop: Text input for typing date */}
                              <Input
                                className="hidden sm:block text-base"
                                value={field.value || DateUtils.getCurrentIndianDate()}
                                placeholder="DD/MM/YYYY"
                                tabIndex={9}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  field.onChange(inputValue);
                                  
                                  // Auto-calculate maturity date only when hasMaturity is false
                                  const hasMaturity = form.getValues('hasMaturity');
                                  if (!hasMaturity && inputValue && DateUtils.isValidIndianDate(inputValue)) {
                                    const months = 12;
                                    const calculatedMaturity = DateUtils.addMonthsToIndianDate(inputValue, months);
                                    form.setValue('maturityDate', calculatedMaturity);
                                  }
                                }}
                                onBlur={(e) => {
                                  const inputValue = e.target.value;
                                  if (inputValue && !DateUtils.isValidIndianDate(inputValue)) {
                                    const formatted = DateUtils.autoFormatIndianDate(inputValue);
                                    if (formatted) {
                                      field.onChange(formatted);
                                    }
                                  }
                                }}
                              />
                              {/* Mobile: Native date picker */}
                              <Input
                                type="date"
                                className="block sm:hidden text-base"
                                value={field.value ? DateUtils.indianDateToISO(field.value) : DateUtils.indianDateToISO(DateUtils.getCurrentIndianDate())}
                                tabIndex={9}
                                onChange={(e) => {
                                  const isoValue = e.target.value;
                                  if (isoValue) {
                                    const indianDate = DateUtils.isoToIndianDate(isoValue);
                                    field.onChange(indianDate);
                                    
                                    // Auto-calculate maturity date only when hasMaturity is false
                                    const hasMaturity = form.getValues('hasMaturity');
                                    if (!hasMaturity && DateUtils.isValidIndianDate(indianDate)) {
                                      const months = 12;
                                      const calculatedMaturity = DateUtils.addMonthsToIndianDate(indianDate, months);
                                      form.setValue('maturityDate', calculatedMaturity);
                                    }
                                  }
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Fixed Maturity Loan Checkbox */}
                    <FormField
                      control={form.control}
                      name="hasMaturity"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              tabIndex={10}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                
                                if (checked) {
                                  // When checkbox is checked, set default 12 months and auto-calculate maturity date
                                  form.setValue('maturityMonths', '12');
                                  
                                  const loanDate = form.getValues('loanDate');
                                  let dateToUse;
                                  
                                  if (loanDate) {
                                    // Convert to Indian format if needed
                                    dateToUse = loanDate.includes('-') ? DateUtils.isoToIndianDate(loanDate) : loanDate;
                                  } else {
                                    dateToUse = DateUtils.getCurrentIndianDate();
                                  }
                                  
                                  const calculatedMaturity = DateUtils.addMonthsToIndianDate(dateToUse, 12);
                                  form.setValue('maturityDate', calculatedMaturity);
                                } else {
                                  // When checkbox is unchecked, clear maturity fields
                                  form.setValue('maturityMonths', '');
                                  form.setValue('maturityDate', '');
                                }
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-base font-medium">
                              मुदत ठरावीक कर्ज (निश्चित मुदतीसाठी)
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    {/* Maturity Months - always visible when hasMaturity is true */}
                    {form.watch("hasMaturity") && (
                      <FormField
                        control={form.control}
                        name="maturityMonths"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-medium">मुदत महिने *</FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2">
                                <Input
                                  {...field}
                                  type="number"
                                  placeholder="12"
                                  className="text-base w-20"
                                  tabIndex={11}
                                  onChange={(e) => {
                                    field.onChange(e.target.value);
                                    // Auto-calculate maturity date
                                    const monthsValue = e.target.value;
                                    const months = parseInt(monthsValue);
                                    
                                    
                                    if (months && !isNaN(months) && months > 0) {
                                      const loanDate = form.getValues('loanDate');
                                      
                                      
                                      if (loanDate) {
                                        // Convert loan date to Indian format if it's in ISO format
                                        const indianLoanDate = loanDate.includes('-') ? DateUtils.isoToIndianDate(loanDate) : loanDate;
                                        
                                        // Use proper month addition function
                                        const calculatedMaturity = DateUtils.addMonthsToIndianDate(indianLoanDate, months);
                                        
                                        
                                        // Set in Indian format for internal storage
                                        form.setValue('maturityDate', calculatedMaturity, { 
                                          shouldValidate: true,
                                          shouldDirty: true,
                                          shouldTouch: true 
                                        });
                                        
                                      } else {
                                        // Use today's date if no loan date is set
                                        const todaysDate = DateUtils.getCurrentIndianDate();
                                        const calculatedMaturity = DateUtils.addMonthsToIndianDate(todaysDate, months);
                                        form.setValue('maturityDate', calculatedMaturity, { 
                                          shouldValidate: true,
                                          shouldDirty: true,
                                          shouldTouch: true 
                                        });
                                      }
                                    } else {
                                      // When field is cleared, calculate default 12 months from loan date or today
                                      if (!monthsValue || monthsValue.trim() === '') {
                                        const loanDate = form.getValues('loanDate');
                                        let dateToUse;
                                        
                                        if (loanDate) {
                                          // Convert to Indian format if needed
                                          dateToUse = loanDate.includes('-') ? DateUtils.isoToIndianDate(loanDate) : loanDate;
                                        } else {
                                          dateToUse = DateUtils.getCurrentIndianDate();
                                        }
                                        
                                        const calculatedMaturity = DateUtils.addMonthsToIndianDate(dateToUse, 12);
                                        
                                        form.setValue('maturityDate', calculatedMaturity, { 
                                          shouldValidate: true,
                                          shouldDirty: true,
                                          shouldTouch: true 
                                        });
                                      }
                                    }
                                  }}
                                />
                                <span className="text-gray-600">महिने</span>
                              </div>
                            </FormControl>
                            <div className="text-sm text-gray-600 mt-1">
                              उदा: 6, 12, 18 महिने (कर्ज दिनांकावर आधारित ऑटो मुदत मिळेल)
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Maturity Date - always visible */}
                    <FormField
                      control={form.control}
                      name="maturityDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">
                            कर्ज मुदत दिनांक *<span className="hidden sm:inline"> (DD/MM/YYYY)</span>
                          </FormLabel>
                          <FormControl>
                            <div>
                              {/* Desktop: Text input for typing date */}
                              <Input
                                className="hidden sm:block text-base"
                                value={field.value || ''}
                                placeholder="DD/MM/YYYY"
                                tabIndex={12}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  field.onChange(inputValue);
                                }}
                                onBlur={(e) => {
                                  const inputValue = e.target.value;
                                  if (inputValue && !DateUtils.isValidIndianDate(inputValue)) {
                                    const formatted = DateUtils.autoFormatIndianDate(inputValue);
                                    if (formatted) {
                                      field.onChange(formatted);
                                    }
                                  }
                                }}
                              />
                              {/* Mobile: Native date picker */}
                              <Input
                                type="date"
                                className="block sm:hidden text-base"
                                value={field.value ? DateUtils.indianDateToISO(field.value) : ''}
                                tabIndex={12}
                                onChange={(e) => {
                                  const isoValue = e.target.value;
                                  if (isoValue) {
                                    const indianDate = DateUtils.isoToIndianDate(isoValue);
                                    field.onChange(indianDate);
                                  }
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Interest Rate Type */}
                    <FormField
                      control={form.control}
                      name="interestRateType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">व्याजाचा दर प्रकार *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={(value) => {
                                field.onChange(value);
                                // Auto-fill interest rate based on type
                                if (value === 'monthly') {
                                  form.setValue('interestRate', '1.5');
                                } else if (value === 'yearly') {
                                  form.setValue('interestRate', '12');
                                }
                              }}
                              value={field.value}
                              className="flex space-x-6"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="yearly" id="yearly" />
                                <Label htmlFor="yearly">वार्षिक</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="monthly" id="monthly" />
                                <Label htmlFor="monthly">मासिक</Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Interest Rate */}
                    <FormField
                      control={form.control}
                      name="interestRate"
                      render={({ field }) => {
                        const rateType = form.watch("interestRateType");
                        const isYearly = rateType === "yearly";
                        const rateValue = parseFloat(field.value || '0');
                        
                        const interestRateWarningEnabled = (company as any)?.interestRateWarningEnabled !== false;
                        const getSuggestedRate = () => {
                          if (!interestRateWarningEnabled) return null;
                          if (!rateValue || rateValue <= 0) return null;
                          if (!isYearly && rateValue > 10) {
                            const div100 = rateValue / 100;
                            if (div100 >= 0.5 && div100 <= 5) {
                              return { suggested: div100, message: `मासिक व्याजदर ${rateValue}% खूप जास्त वाटतो. तुम्हाला ${div100}% म्हणायचं आहे का?` };
                            }
                            const div10 = rateValue / 10;
                            if (div10 >= 0.5 && div10 <= 5) {
                              return { suggested: div10, message: `मासिक व्याजदर ${rateValue}% खूप जास्त वाटतो. तुम्हाला ${div10}% म्हणायचं आहे का?` };
                            }
                            return { suggested: null, message: `⚠️ मासिक व्याजदर ${rateValue}% खूप जास्त वाटतो. कृपया तपासा.` };
                          }
                          if (isYearly && rateValue > 50) {
                            const div10 = rateValue / 10;
                            if (div10 >= 6 && div10 <= 36) {
                              return { suggested: div10, message: `वार्षिक व्याजदर ${rateValue}% खूप जास्त वाटतो. तुम्हाला ${div10}% म्हणायचं आहे का?` };
                            }
                            return { suggested: null, message: `⚠️ वार्षिक व्याजदर ${rateValue}% खूप जास्त वाटतो. कृपया तपासा.` };
                          }
                          if (isYearly && rateValue > 0 && rateValue < 5) {
                            return { suggested: rateValue, switchToMonthly: true, message: `वार्षिक व्याजदर ${rateValue}% खूप कमी वाटतो. तुम्हाला मासिक ${rateValue}% म्हणायचं आहे का?` };
                          }
                          return null;
                        };
                        const suggestion = getSuggestedRate();
                        
                        return (
                          <FormItem>
                            <FormLabel className="text-base font-medium">व्याजाचा दर {isYearly ? "वार्षिक" : "मासिक"} *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  tabIndex={13}
                                  placeholder=""
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="pr-8 text-base"
                                />
                                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                              </div>
                            </FormControl>
                            {suggestion && (
                              <div className="mt-1 p-2 bg-amber-50 border border-amber-300 rounded-lg">
                                <p className="text-sm text-amber-800 font-medium font-noto">⚠️ {suggestion.message}</p>
                                {suggestion.suggested !== null && (
                                  <button
                                    type="button"
                                    className="mt-1 px-3 py-1 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors font-noto"
                                    onClick={() => {
                                      if ((suggestion as any).switchToMonthly) {
                                        form.setValue('interestRateType', 'monthly');
                                      } else {
                                        form.setValue('interestRate', String(suggestion.suggested));
                                      }
                                    }}
                                  >
                                    {(suggestion as any).switchToMonthly 
                                      ? `होय, मासिक ${suggestion.suggested}% मध्ये बदला`
                                      : `होय, ${suggestion.suggested}% करा`
                                    }
                                  </button>
                                )}
                              </div>
                            )}
                            <div className="text-sm text-gray-600 mt-1">
                              उदा: {isYearly ? "12% वार्षिक" : "1.5% मासिक"}
                            </div>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                </div>

                {/* Column 3 - Collateral Information (hidden for विनातारण) */}
                {watchedLoanType !== 'विनातारण' && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold border-b pb-1 text-orange-700">तारणाची माहिती</h3>
                  
                  {/* Collateral Details */}
                  <FormField
                    control={form.control}
                    name="collateralDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">तारणाचा तपशील *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder=""
                            tabIndex={14}
                            className="text-base"
                            value={field.value || ''}
                            onChange={(e) => {
                              const converted = e.target.value.replace(/[०-९]/g, (d: string) => String('०१२३४५६७८९'.indexOf(d)));
                              field.onChange(converted);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Weight */}
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">वजन *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder=""
                            tabIndex={15}
                            className="text-base"
                            value={field.value || ''}
                            onChange={(e) => {
                              const converted = e.target.value.replace(/[०-९]/g, (d: string) => String('०१२३४५६७८९'.indexOf(d)));
                              field.onChange(converted);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Purity */}
                  <FormField
                    control={form.control}
                    name="purity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">शुद्धता %</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="82"
                            tabIndex={16}
                            className="text-base"
                            value={field.value || '82'}
                            onChange={(e) => {
                              const converted = e.target.value.replace(/[०-९]/g, (d: string) => String('०१२३४५६७८९'.indexOf(d)));
                              field.onChange(converted);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Market Value */}
                  <FormField
                    control={form.control}
                    name="marketValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          बाजार मूल्य
                          {editOriginalRate > 0 && (
                            <span className="text-xs text-indigo-600 ml-1">(मूळ दर — ₹{Math.round(editOriginalRate).toLocaleString('en-IN')}/ग्रॅम)</span>
                          )}
                          {editOriginalRate === 0 && goldRateStatus === 'success' && !marketValueManual && (
                            <span className="text-xs text-green-600 ml-1">(ऑटो — ₹{liveGoldRate.toLocaleString('en-IN')}/ग्रॅम • {goldRateSource})</span>
                          )}
                          {editOriginalRate === 0 && goldRateStatus === 'failed' && (
                            <span className="text-xs text-red-600 ml-1">(दर उपलब्ध नाही — स्वतः भरा)</span>
                          )}
                          {editOriginalRate === 0 && goldRateStatus === 'loading' && (
                            <span className="text-xs text-gray-500 ml-1">(दर लोड होत आहे...)</span>
                          )}
                          {editOriginalRate > 0 && goldRateStatus === 'success' && (
                            <button type="button" className="text-xs text-blue-600 ml-1 underline" onClick={() => {
                              setEditOriginalRate(0);
                              setMarketValueManual(false);
                              const w = parseFloat((form.getValues('weight') || '0').replace(/[^\d.]/g, '')) || 0;
                              const p = parseFloat(form.getValues('purity') || '82') || 82;
                              if (w > 0 && liveGoldRate > 0) {
                                form.setValue('marketValue', String(smartRound(w * (p / 100) * liveGoldRate)), { shouldValidate: false });
                              }
                            }}>(आजचा दर लावा)</button>
                          )}
                          {editOriginalRate === 0 && marketValueManual && goldRateStatus === 'success' && (
                            <button type="button" className="text-xs text-blue-600 ml-1 underline" onClick={() => {
                              setMarketValueManual(false);
                              const w = parseFloat((form.getValues('weight') || '0').replace(/[^\d.]/g, '')) || 0;
                              const p = parseFloat(form.getValues('purity') || '82') || 82;
                              if (w > 0 && liveGoldRate > 0) {
                                form.setValue('marketValue', String(smartRound(w * (p / 100) * liveGoldRate)), { shouldValidate: false });
                              }
                            }}>(ऑटो करा)</button>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="0"
                            className="text-base"
                            tabIndex={17}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              setMarketValueManual(true);
                              if (editOriginalRate > 0) {
                                const newMv = parseFloat(e.target.value) || 0;
                                const w = parseFloat((form.getValues('weight') || '0').replace(/[^\d.]/g, '')) || 0;
                                const p = parseFloat(form.getValues('purity') || '82') || 82;
                                const fineWt = w * (p / 100);
                                if (fineWt > 0 && newMv > 0) {
                                  setEditOriginalRate(newMv / fineWt);
                                }
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                )}
              </div>

              {/* Additional Information Section */}
              <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-gray-200">
                <h3 className="text-base font-semibold text-purple-700">
                  {watchedLoanType === 'विनातारण' ? 'कर्ज तपशील / अतिरिक्त माहिती (विनातारण कर्जाची माहिती येथे भरा)' : 'अतिरिक्त माहिती'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {/* Document Details */}
                  <FormField
                    control={form.control}
                    name="documentDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">कागदपत्राचा तपशील</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="कागदपत्राचा तपशील" tabIndex={17} className="text-base" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Special Conditions */}
                  <FormField
                    control={form.control}
                    name="specialConditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">विशेष शर्ती</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="विशेष शर्ती" tabIndex={18} className="text-base" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Other Information */}
                  <FormField
                    control={form.control}
                    name="otherInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">इतर संबंधित माहिती</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="इतर संबंधित माहिती" tabIndex={19} className="text-base" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Photo Upload Section - Collapsible */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsPhotoSectionOpen(!isPhotoSectionOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="flex items-center gap-2 text-base font-medium text-gray-700">
                    <Camera className="h-5 w-5 text-amber-600" />
                    तारणाचे फोटो
                    {pendingPhotos.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">{pendingPhotos.length} तयार</Badge>
                    )}
                  </span>
                  {isPhotoSectionOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                </button>
                {isPhotoSectionOpen && (
                  <div className="p-3 sm:p-4 space-y-3">
                    <PhotoUpload 
                      loanId={editingLoan?.id}
                      onCameraDialogChange={setIsCameraDialogOpen}
                      onPhotosChange={(photos) => {
                        if (editingLoan?.id) {
                          const newPhotos = photos.filter(photo => !photo.isExisting);
                          if (newPhotos.length > 0) {
                            setTimeout(() => {
                              void (async () => {
                                try {
                                  const { photosToFormData } = await import('@/lib/photo-utils');
                                  const formData = photosToFormData(newPhotos, editingLoan.id);
                                  const response = await fetch(`/api/loans/${editingLoan.id}/photos`, {
                                    method: 'POST',
                                    body: formData
                                  });
                                  if (!response.ok) throw new Error('Photo upload failed');
                                  queryClient.invalidateQueries({ queryKey: ["/api/loans", editingLoan.id, "photos"] });
                                  toast({ title: "फोटो अपलोड यशस्वी", description: `${newPhotos.length} फोटो save झाले` });
                                  setIsPhotoSectionOpen(false);
                                } catch (error) {
                                  console.error('Photo upload error:', error);
                                  toast({ title: "फोटो अपलोड त्रुटी", description: "फोटो upload करताना समस्या झाली", variant: "destructive" });
                                }
                              })();
                            }, 0);
                          }
                        } else {
                          setPendingPhotos(photos);
                          toast({ title: "फोटो तयार", description: `${photos.length} फोटो तयार, save केल्यावर upload होतील` });
                          setIsPhotoSectionOpen(false);
                        }
                      }}
                      maxPhotos={2}
                    />
                  </div>
                )}
              </div>

              {/* Photo Upload Status */}
              {!editingLoan && pendingPhotos.length > 0 && createdLoanId && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
                  {isUploadingPhotos ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                      <span className="text-sm text-orange-700 font-medium">फोटो upload करत आहे...</span>
                    </>
                  ) : (
                    <span className="text-sm text-orange-700 font-medium">📸 फोटो upload बाकी - "फोटो अपलोड करा" दाबा</span>
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-4 sm:pt-6 border-t">
                {/* Clear Button - Left side */}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    const todayDate = DateUtils.getCurrentIndianDate();
                    form.reset({
                      groupId: "",
                      borrowerName: "",
                      borrowerMobile: "",
                      borrowerAddress: "",
                      businessType: "बिगर शेती",
                      isFarmer: false,
                      isBackwardClass: false,
                      loanType: "तारण",
                      accountNumber: "",
                      principalAmount: "",
                      loanDate: todayDate,
                      maturityDate: DateUtils.addMonthsToIndianDate(todayDate, 12),
                      hasMaturity: false,
                      maturityMonths: "",
                      interestRate: "",
                      interestRateType: "monthly",
                      collateralDetails: "",
                      weight: "",
                      purity: "82",
                      marketValue: "",
                      documentDetails: "",
                      specialConditions: "",
                      otherInfo: ""
                    });
                  }}
                  className="text-orange-600 border-orange-300 hover:bg-orange-50 w-full sm:w-auto"
                  tabIndex={21}
                >
                  🗑️ साफ करा
                </Button>
                
                {/* Cancel and Submit - Right side */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end w-full sm:w-auto">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" tabIndex={22} disabled={isUploadingPhotos}>
                      रद्द करा
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={createLoanMutation.isPending || isUploadingPhotos} tabIndex={23} title="Alt+S">
                    {isUploadingPhotos ? "अपलोड करत आहे..." : 
                     createdLoanId ? "फोटो अपलोड करा" :
                     editingLoan ? "अपडेट करा" : "जतन करा"}<span className="hidden sm:inline"> (Alt+S)</span>
                  </Button>
                </div>
              </div>
            </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Keyboard Shortcuts Guide - Hidden on mobile (keyboard shortcuts not useful on mobile) */}
      <Card className="hidden lg:block bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border">
              <kbd className="bg-gray-100 px-1 rounded text-xs">Alt+N</kbd>
              <span>नवीन कर्ज</span>
            </div>
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border">
              <kbd className="bg-gray-100 px-1 rounded text-xs">Alt+F</kbd>
              <span>सर्च फोकस</span>
            </div>
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border">
              <kbd className="bg-gray-100 px-1 rounded text-xs">Alt+S</kbd>
              <span>फॉर्म सेव्ह</span>
            </div>
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border">
              <kbd className="bg-gray-100 px-1 rounded text-xs">Enter</kbd>
              <span>सर्च करा</span>
            </div>
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border">
              <kbd className="bg-gray-100 px-1 rounded text-xs">Esc</kbd>
              <span>क्लियर/बंद</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter Section */}
      <Card className="shadow-sm border border-indigo-200">
        <CardContent className="space-y-4 pt-4">
          {/* Smart Text Search */}
          <div>
            <Label htmlFor="smart-search" className="text-indigo-700 font-medium text-sm mb-1.5">
              नाव किंवा खाते क्रमांक शोधा
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  ref={searchInputRef}
                  id="smart-search"
                  placeholder="नाव, खाते क्रमांक टाका..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      scrollToSearchResults();
                    }
                  }}
                  className="pl-10 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <Button 
                type="button"
                onClick={() => {
                  if (searchQuery.trim()) {
                    scrollToSearchResults();
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 shadow-sm"
              >
                <Search className="h-4 w-4 mr-1.5" />
                शोध
              </Button>
            </div>
          </div>

          {/* Group Filter */}
          <div>
            <Label className="text-gray-700 font-medium text-sm mb-1.5">ग्रुप निवडा</Label>
            <Select value={dateFilter.groupId} onValueChange={(value) => {
              setDateFilter(prev => ({ ...prev, groupId: value }));
            }}>
              <SelectTrigger>
                <SelectValue placeholder="सर्व ग्रुप" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">सर्व ग्रुप</SelectItem>
                {Array.isArray(groups) && groups.map((group: any) => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 font-medium text-sm flex items-center">
                <Calendar className="mr-2 h-4 w-4" />
                या तारखेपासून
              </Label>
              <Input
                type="date"
                value={dateFilter.dateFrom}
                onChange={(e) => {
                  setDateFilter(prev => ({ ...prev, dateFrom: e.target.value }));
                }}
                className="border-gray-300"
              />
            </div>
            <div>
              <Label className="text-gray-700 font-medium text-sm flex items-center">
                <Calendar className="mr-2 h-4 w-4" />
                या तारखेपर्यंत
              </Label>
              <Input
                type="date"
                value={dateFilter.dateTo}
                onChange={(e) => {
                  setDateFilter(prev => ({ ...prev, dateTo: e.target.value }));
                }}
                className="border-gray-300"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <Label className="text-indigo-700 font-medium mb-3 block">कर्जाची स्थिती</Label>
            <RadioGroup
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
              }}
              className="flex space-x-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="status-all" className="text-indigo-600" />
                <Label htmlFor="status-all" className="text-indigo-700">सर्व</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="active" id="status-active" className="text-green-600" />
                <Label htmlFor="status-active" className="text-green-700">सक्रिय</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="closed" id="status-closed" className="text-red-600" />
                <Label htmlFor="status-closed" className="text-red-700">बंद</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Search and Clear Buttons */}
          <div className="flex space-x-4">
            <Button
              onClick={() => {
                // Always scroll to results area, regardless of search query
                scrollToSearchResults();
              }}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Search className="mr-2 h-4 w-4" />
              शोधा
            </Button>
            <Button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setDateFilter({
                  groupId: "all",
                  dateFrom: DateUtils.formatForInput(new Date()),
                  dateTo: DateUtils.formatForInput(new Date()),
                });
                setSelectedRowIndex(-1);
                setSelectedLoanId(null);
              }}
              variant="outline"
              className="flex-1 border-gray-300 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
            >
              <X className="mr-2 h-4 w-4" />
              साफ करा
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results Card - Show ALL loans OR when any filters are active */}
      {(Array.isArray(loans) && loans.length > 0) && (
        <div ref={searchResultsRef}>
        <Card className="border-indigo-200">
          <CardHeader>
            <CardTitle>
              {searchQuery ? 
                `शोध निकाल: "${searchQuery}" (${Array.isArray(filteredLoans) ? filteredLoans.length : 0} कर्जे आढळली)` :
                `सर्व कर्जाची यादी (${Array.isArray(filteredLoans) ? filteredLoans.length : 0} एकूण कर्जे)`
              }
            </CardTitle>
            {searchQuery ? (
              <p className="text-sm text-indigo-600 mt-2">
                "<span className="font-medium">{searchQuery}</span>" साठी शोध परिणाम दाखवत आहेत
              </p>
            ) : (
              <p className="text-sm text-green-600 mt-2">
                सर्व कर्जे दाखवत आहेत - शोध करण्यासाठी वरील शोध बॉक्स वापरा
              </p>
            )}
          </CardHeader>
          <CardContent>
            {/* Modern Grid with Enhanced Styling */}
            <div className="relative">
              {/* Multi-select Action Bar */}
              {selectedLoanIds.size > 0 && (
                <div className="mb-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-indigo-600" />
                    <span className="text-sm font-medium text-indigo-700">
                      {selectedLoanIds.size} / {sortedLoans.length} निवडले
                    </span>
                    {selectedLoanIds.size < sortedLoans.length && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-indigo-600 border-indigo-300 h-7"
                        onClick={() => {
                          const allIds = sortedLoans.map((l: any) => l.id);
                          setSelectedLoanIds(new Set(allIds));
                        }}
                      >
                        <CheckSquare className="h-3 w-3 mr-1" />
                        सर्व {sortedLoans.length} निवडा
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-gray-500 h-7"
                      onClick={() => setSelectedLoanIds(new Set())}
                    >
                      <X className="h-3 w-3 mr-1" />
                      रद्द करा
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-8"
                    onClick={() => {
                      const selected = Array.isArray(sortedLoans) ? sortedLoans.filter((l: any) => selectedLoanIds.has(l.id)).map((l: any) => ({
                        ...l,
                        groupName: l.groupName || l.group?.name || "",
                      })) : [];
                      if (selected.length > 0) {
                        setLabelPrintLoans(selected);
                        setLabelPrintDialogOpen(true);
                      }
                    }}
                  >
                    <Printer className="h-3.5 w-3.5 mr-1.5" />
                    लेबल प्रिंट ({selectedLoanIds.size})
                  </Button>
                </div>
              )}

              {/* Performance and Navigation Info */}
              <div className="mb-4 space-y-3">
                {/* Keyboard Navigation Hint - Desktop Only */}
                <div className="hidden md:block p-3 bg-gradient-to-r from-indigo-50 to-indigo-50 border border-indigo-200 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <span className="text-indigo-700 font-medium">⌨️ कीबोर्ड नेव्हिगेशन:</span>
                      <span className="text-indigo-600">↑↓ निवडा</span>
                      <span className="text-green-600">Enter संपादन</span>
                      <span className="text-purple-600">Space तपशील</span>
                      <span className="text-gray-600">Esc बाहेर</span>
                    </div>
                    <span className="text-indigo-600 text-xs">
                      {paginatedLoans.length > 0 ? `${selectedRowIndex + 1}/${paginatedLoans.length}` : "0/0"}
                    </span>
                  </div>
                </div>

                {/* Performance Info and Pagination Controls */}
                <div className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Record Count and Performance */}
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-700 font-medium">
                        📊 दाखवत आहे: {startIndex + 1}-{Math.min(endIndex, totalRecords)} of {totalRecords} कर्जे
                      </span>
                      {totalRecords > 200 && (
                        <span className="text-orange-600 text-xs bg-orange-100 px-2 py-1 rounded">
                          मोठा डेटासेट
                        </span>
                      )}
                    </div>

                    {/* Page Size and Navigation */}
                    <div className="flex items-center space-x-3">
                      {totalRecords > 50 && (
                        <>
                          <span className="text-gray-600 text-sm">प्रति पेज:</span>
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                            autoComplete="off"
                          >
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                            <option value={500}>500</option>
                          </select>
                        </>
                      )}

                      {totalPages > 1 && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            ← पूर्व
                          </button>
                          <span className="text-sm text-gray-600">
                            पेज {currentPage} of {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            पुढे →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Table View - Hidden on Mobile */}
              <div className="hidden md:block overflow-x-auto bg-white rounded-lg border border-indigo-200 shadow-sm" ref={searchResultsRef}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-indigo-700 border-b border-indigo-600">
                      <TableHead className="py-3 px-3 w-10">
                        <button
                          onClick={() => {
                            const allIds = Array.isArray(sortedLoans) ? sortedLoans.map((l: any) => l.id) : [];
                            const allSelected = allIds.length > 0 && allIds.every((id: any) => selectedLoanIds.has(id));
                            if (allSelected) setSelectedLoanIds(new Set());
                            else setSelectedLoanIds(new Set(allIds));
                          }}
                          className="p-1 rounded hover:bg-indigo-600 transition-colors"
                          title={`सर्व ${sortedLoans.length} निवडा / रद्द करा`}
                        >
                          {Array.isArray(sortedLoans) && sortedLoans.length > 0 && sortedLoans.every((l: any) => selectedLoanIds.has(l.id))
                            ? <CheckSquare className="h-4 w-4 text-indigo-300" />
                            : <Square className="h-4 w-4 text-indigo-300" />
                          }
                        </button>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-indigo-100 uppercase tracking-wider py-3 px-4">खाते नं.</TableHead>
                      <TableHead className="text-xs font-semibold text-indigo-100 uppercase tracking-wider py-3 px-4">कर्जदार नाव</TableHead>
                      <TableHead className="text-xs font-semibold text-indigo-100 uppercase tracking-wider py-3 px-4">मोबाइल</TableHead>
                      <TableHead className="text-xs font-semibold text-indigo-100 uppercase tracking-wider py-3 px-4">वस्तु/तारण</TableHead>
                      <TableHead className="text-xs font-semibold text-indigo-100 uppercase tracking-wider py-3 px-4">वजन</TableHead>
                      <TableHead className="text-xs font-semibold text-indigo-100 uppercase tracking-wider py-3 px-4 text-center">व्याज%</TableHead>
                      <TableHead className="text-xs font-semibold text-indigo-100 uppercase tracking-wider py-3 px-4 text-right min-w-[120px]">रक्कम (₹)</TableHead>
                      <TableHead className="text-xs font-semibold text-indigo-100 uppercase tracking-wider py-3 px-4">तारीख</TableHead>
                      <TableHead className="text-xs font-semibold text-indigo-100 uppercase tracking-wider py-3 px-4 text-center">स्थिती</TableHead>
                      <TableHead className="text-xs font-semibold text-indigo-100 uppercase tracking-wider py-3 px-4 text-center">कृती</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {Array.isArray(paginatedLoans) && paginatedLoans.length > 0 && paginatedLoans.map((loan: any, index: number) => (
                    <TableRow 
                      key={loan.id} 
                      className={`
                        ${loan.status === 'closed' 
                          ? 'bg-red-50/60 hover:bg-red-50 border-l-3 border-l-red-400 text-gray-700' 
                          : index % 2 === 0 ? 'bg-white hover:bg-indigo-50/50 border-l-3 border-l-transparent' : 'bg-indigo-50/30 hover:bg-indigo-50 border-l-3 border-l-transparent'
                        }
                        ${selectedRowIndex === index 
                          ? 'bg-indigo-50 border-l-3 border-l-indigo-500' 
                          : 'border-b border-indigo-100'
                        }
                        cursor-pointer transition-colors duration-150
                      `}
                      onClick={() => {
                        setSelectedRowIndex(index);
                        setSelectedLoanId(loan.id);
                      }}
                      data-loan-id={loan.id}
                      data-testid={`row-loan-${loan.id}`}
                    >
                      <TableCell className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleLoanSelection(loan.id)}
                          className="p-1 rounded hover:bg-indigo-100 transition-colors"
                        >
                          {selectedLoanIds.has(loan.id)
                            ? <CheckSquare className="h-4 w-4 text-indigo-600" />
                            : <Square className="h-4 w-4 text-indigo-300" />
                          }
                        </button>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-indigo-700 py-3 px-4 whitespace-nowrap">
                        {loan.accountNumber || "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-gray-800 py-3 px-4">{loan.borrowerName}</TableCell>
                      <TableCell className="text-sm text-gray-600 py-3 px-4 tabular-nums">{loan.borrowerMobile || "—"}</TableCell>
                      <TableCell className="text-sm text-gray-600 py-3 px-4 max-w-[200px] truncate" title={loan.collateralDetails || [loan.specialConditions, loan.documentDetails, loan.otherInfo].filter((v: string) => v && v !== '—').join(' | ') || ''}>
                        {loan.collateralDetails || [loan.specialConditions, loan.documentDetails, loan.otherInfo].filter((v: string) => v && v !== '—').join(' | ') || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 py-3 px-4">
                        {loan.loanType === 'विनातारण' ? "—" : (loan.weight || "—")}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 py-3 px-4 text-center tabular-nums font-medium">
                        {loan.interestRate ? `${loan.interestRate}%` : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-gray-800 py-3 px-4 text-right tabular-nums whitespace-nowrap min-w-[120px]">
                        ₹ {LoanCalculations.formatAmount(Number(loan.principalAmount))}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 py-3 px-4 whitespace-nowrap tabular-nums">
                        {DateUtils.isoToIndianDate(loan.loanDate)}
                        {loan.status === 'closed' && loan.closureDate && (
                          <div className="text-xs text-red-600 mt-0.5">
                            बंद: {DateUtils.isoToIndianDate(loan.closureDate)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${loan.status === "active" 
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" 
                            : "bg-red-50 text-red-700 ring-1 ring-red-200"
                          }
                        `}>
                          <span className={`w-1.5 h-1.5 rounded-full ${loan.status === "active" ? "bg-emerald-500" : "bg-red-500"}`}></span>
                          {loan.status === "active" ? "सक्रिय" : "बंद"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200 touch-manipulation min-h-[44px] min-w-[44px]"
                              onTouchStart={(e) => {
                                const btn = e.currentTarget as any;
                                btn._touchStartY = e.touches[0].clientY;
                                btn._wasDrag = false;
                              }}
                              onTouchMove={(e) => {
                                const btn = e.currentTarget as any;
                                if (btn._touchStartY !== undefined && Math.abs(e.touches[0].clientY - btn._touchStartY) > 8) {
                                  btn._wasDrag = true;
                                }
                              }}
                              onTouchEnd={(e) => {
                                if ((e.currentTarget as any)._wasDrag) {
                                  e.preventDefault();
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-5 w-5" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {loan.status === 'active' && (
                              <DropdownMenuItem onClick={() => handleEdit(loan)}>
                                <Edit className="mr-2 h-4 w-4" />
                                संपादन करा
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => {
                                try {
                                  
                                  // Direct receipt generation - much faster
                                  ReceiptGenerator.openReceiptWindow(loan, company as any);
                                } catch (error) {
                                  console.error("🚨 Receipt generation error:", error);
                                  alert("पावती तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
                                }
                              }}
                              className="text-indigo-600"
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              पावती काढा
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleLabelPrintSingle(loan)}
                              className="text-teal-600"
                            >
                              <Printer className="mr-2 h-4 w-4" />
                              लेबल प्रिंट
                            </DropdownMenuItem>
                            {loan.status === 'active' && (
                              <DropdownMenuItem 
                                onClick={() => handleCloseLoan(loan)}
                                className="text-orange-600"
                              >
                                <Lock className="mr-2 h-4 w-4" />
                                खाते बंद करा
                              </DropdownMenuItem>
                            )}
                            {loan.status === 'closed' && (
                              <DropdownMenuItem 
                                onClick={() => handleReopen(loan)}
                                className="text-green-600"
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                पुनरोपन करा
                              </DropdownMenuItem>
                            )}
                            {loan.status === 'active' && (
                              <DropdownMenuItem 
                                onClick={() => handleDelete(loan.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                डिलीट करा
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!Array.isArray(paginatedLoans) || paginatedLoans.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 bg-slate-50/50">
                        <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 font-medium">
                          शोध निकालांसाठी कोणतीही कर्जे आढळली नाहीत
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          वेगळे शब्द वापरून पुन्हा शोधा
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>

              {/* Mobile Card View - Shown on Mobile Only */}
              <div className="md:hidden space-y-3" ref={searchResultsRef}>
                {Array.isArray(paginatedLoans) && paginatedLoans.length > 0 && paginatedLoans.map((loan: any, index: number) => (
                  <div 
                    key={loan.id}
                    data-loan-id={loan.id}
                    className={`
                      p-4 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer
                      ${loan.status === 'closed' 
                        ? 'bg-red-50 border-red-200 hover:bg-red-100' 
                        : 'bg-white border-gray-200 hover:bg-indigo-50'
                      }
                      ${selectedRowIndex === index 
                        ? 'ring-2 ring-indigo-400 bg-gradient-to-r from-indigo-50 to-indigo-50 shadow-md' 
                        : ''
                      }
                    `}
                    onClick={() => {
                      setSelectedRowIndex(index);
                      setSelectedLoanId(loan.id);
                    }}
                    data-testid={`card-loan-${loan.id}`}
                  >
                    {/* Header with Checkbox, Name and Status */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLoanSelection(loan.id);
                          }}
                          className="mt-1 p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
                        >
                          {selectedLoanIds.has(loan.id)
                            ? <CheckSquare className="h-5 w-5 text-indigo-600" />
                            : <Square className="h-5 w-5 text-gray-400" />
                          }
                        </button>
                        <div>
                          <h3 className="font-noto font-semibold text-lg text-gray-900">{loan.borrowerName}</h3>
                          <p className="text-sm font-bold text-gray-700 font-inter">
                            खाते: {loan.accountNumber || "—"}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        className={`
                          px-2 py-1 rounded-full text-xs font-medium
                          ${loan.status === "active" 
                            ? "bg-green-100 text-green-800 border border-green-200" 
                            : "bg-red-100 text-red-800 border border-red-200"
                          }
                        `}
                      >
                        <div className="flex items-center space-x-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${loan.status === "active" ? "bg-green-500" : "bg-red-500"}`}></span>
                          <span>{loan.status === "active" ? "सक्रिय" : "बंद"}</span>
                        </div>
                      </Badge>
                    </div>

                    {/* Amount - Prominent */}
                    <div className="mb-3 p-3 bg-gradient-to-r from-indigo-50 to-indigo-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-indigo-600 font-medium">कर्ज रक्कम</p>
                        <p className="text-2xl font-bold text-indigo-900 font-inter">
                          ₹ {LoanCalculations.formatAmount(Number(loan.principalAmount))}
                        </p>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-gray-600">मोबाइल</p>
                        <p className="font-medium font-inter">{loan.borrowerMobile || "—"}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">तारीख</p>
                        <p className="font-medium font-inter">{DateUtils.isoToIndianDate(loan.loanDate)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">वस्तु</p>
                        <p className="font-medium font-noto whitespace-normal break-words" title={loan.collateralDetails}>
                          {loan.collateralDetails || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">वजन</p>
                        <p className="font-medium font-inter">
                          {loan.weight || "—"}
                          {loan.interestRate ? <span className="ml-6 text-gray-500">{loan.interestRate}%</span> : null}
                        </p>
                      </div>
                    </div>

                    {/* Closure Date for Closed Loans */}
                    {loan.status === 'closed' && loan.closureDate && (
                      <div className="mb-3 p-2 bg-red-50 rounded-lg">
                        <p className="text-xs text-red-700">
                          बंद केले: {DateUtils.isoToIndianDate(loan.closureDate)}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                      <div className="flex space-x-2">
                        {loan.status === 'active' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(loan);
                            }}
                            className="px-4 py-2.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors min-h-[44px] min-w-[80px] touch-manipulation"
                          >
                            <Edit className="w-3 h-3 mr-1 inline" />
                            संपादन
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLoanDetails(loan);
                            setShowDetailsModal(true);
                          }}
                          className="px-4 py-2.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors min-h-[44px] min-w-[80px] touch-manipulation"
                        >
                          <Camera className="w-3 h-3 mr-1 inline" />
                          तपशील
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              ReceiptGenerator.openReceiptWindow(loan, company as any);
                            } catch (error) {
                              console.error("Receipt generation error:", error);
                            }
                          }}
                          className="px-4 py-2.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors min-h-[44px] min-w-[80px] touch-manipulation"
                        >
                          <FileText className="w-3 h-3 mr-1 inline" />
                          पावती
                        </button>
                      </div>
                      
                      {/* Three Dots Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-11 w-11 p-0 touch-manipulation min-h-[48px] min-w-[48px] rounded-full bg-gray-100 hover:bg-gray-200"
                            onTouchStart={(e) => {
                              const btn = e.currentTarget as any;
                              btn._touchStartY = e.touches[0].clientY;
                              btn._wasDrag = false;
                            }}
                            onTouchMove={(e) => {
                              const btn = e.currentTarget as any;
                              if (btn._touchStartY !== undefined && Math.abs(e.touches[0].clientY - btn._touchStartY) > 8) {
                                btn._wasDrag = true;
                              }
                            }}
                            onTouchEnd={(e) => {
                              if ((e.currentTarget as any)._wasDrag) {
                                e.preventDefault();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-5 w-5 text-gray-600" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleLabelPrintSingle(loan)}
                            className="text-teal-600"
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            लेबल प्रिंट
                          </DropdownMenuItem>
                          {loan.status === 'active' && (
                            <DropdownMenuItem 
                              onClick={() => handleCloseLoan(loan)}
                              className="text-orange-600"
                            >
                              <Lock className="mr-2 h-4 w-4" />
                              खाते बंद करा
                            </DropdownMenuItem>
                          )}
                          {loan.status === 'closed' && (
                            <DropdownMenuItem 
                              onClick={() => handleReopen(loan)}
                              className="text-green-600"
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              पुनरोपन करा
                            </DropdownMenuItem>
                          )}
                          {loan.status === 'active' && (
                            <DropdownMenuItem 
                              onClick={() => handleDelete(loan.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              डिलीट करा
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                
                {/* No Results for Mobile */}
                {(!Array.isArray(paginatedLoans) || paginatedLoans.length === 0) && (
                  <div className="text-center py-12">
                    <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg font-medium mb-2">
                      कोणतीही कर्जे आढळली नाहीत
                    </p>
                    <p className="text-sm text-gray-400">
                      वेगळे शब्द वापरून पुन्हा शोधा
                    </p>
                  </div>
                )}
              </div>

              {/* Scroll to Top Button for Large Datasets */}
              {totalRecords > 100 && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => {
                      if (searchResultsRef.current) {
                        searchResultsRef.current.scrollIntoView({ 
                          behavior: 'smooth', 
                          block: 'start' 
                        });
                      }
                    }}
                    className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium"
                  >
                    ↑ वरच्या बाजूला जा
                  </button>
                </div>
              )}

              {/* Load More Button (Alternative to Pagination) */}
              {showLoadMore && currentPage < totalPages && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all font-medium shadow-sm"
                  >
                    आणखी {Math.min(pageSize, totalRecords - (currentPage * pageSize))} कर्जे लोड करा
                  </button>
                  <p className="text-sm text-gray-500 mt-2">
                    बाकी {totalRecords - (currentPage * pageSize)} कर्जे उपलब्ध
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Loan Details Modal - Show complete loan information */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="w-[95vw] h-[90vh] max-w-4xl max-h-none overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-indigo-800">
              📋 संपूर्ण कर्ज तपशील
            </DialogTitle>
            <DialogDescription>
              {selectedLoanDetails ? `${selectedLoanDetails.borrowerName} ची सर्व माहिती` : "कर्ज माहिती"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedLoanDetails && (
            <div className="space-y-6 py-4">
              {/* Basic Information Section */}
              <div className="bg-gradient-to-r from-indigo-50 to-indigo-50 p-4 rounded-lg border border-indigo-200">
                <h3 className="text-lg font-semibold text-indigo-800 mb-3 flex items-center">
                  👤 मूलभूत माहिती
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">खाते नंबर</label>
                    <p className="text-base font-medium">{selectedLoanDetails.accountNumber || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">कर्जदाराचे नाव</label>
                    <p className="text-base font-medium font-noto">{selectedLoanDetails.borrowerName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">मोबाइल नंबर</label>
                    <p className="text-base font-medium">{selectedLoanDetails.borrowerMobile || "—"}</p>
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="text-sm font-medium text-gray-600">पत्ता</label>
                    <p className="text-base font-medium font-noto">{selectedLoanDetails.borrowerAddress || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Loan Details Section */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-green-800 mb-3 flex items-center">
                  💰 कर्ज तपशील
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">कर्ज रक्कम</label>
                    <p className="text-xl font-bold text-green-700">₹ {LoanCalculations.formatAmount(Number(selectedLoanDetails.principalAmount))}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">कर्ज तारीख</label>
                    <p className="text-base font-medium">{DateUtils.isoToIndianDate(selectedLoanDetails.loanDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">ग्रुप</label>
                    <p className="text-base font-medium font-noto">{selectedLoanDetails.groupName || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">व्यवसाय</label>
                    <p className="text-base font-medium font-noto">{selectedLoanDetails.businessType || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">कर्ज प्रकार</label>
                    <p className="text-base font-medium font-noto">{selectedLoanDetails.loanType || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">स्थिती</label>
                    <Badge className={selectedLoanDetails.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {selectedLoanDetails.status === "active" ? "सक्रिय" : "बंद"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Interest & Maturity Section */}
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-200">
                <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center">
                  📊 व्याज आणि कालावधी
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">व्याज दर</label>
                    <p className="text-base font-medium">{selectedLoanDetails.interestRate || "—"}%</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">व्याज प्रकार</label>
                    <p className="text-base font-medium font-noto">{selectedLoanDetails.interestRateType === "monthly" ? "मासिक" : "वार्षिक"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">मुदत तारीख</label>
                    <p className="text-base font-medium">{selectedLoanDetails.maturityDate ? DateUtils.isoToIndianDate(selectedLoanDetails.maturityDate) : "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">मुदत आहे का?</label>
                    <p className="text-base font-medium">{selectedLoanDetails.hasMaturity ? "होय" : "नाही"}</p>
                  </div>
                </div>
              </div>

              {/* Collateral Section - hidden for विनातारण */}
              {selectedLoanDetails.loanType !== 'विनातारण' && (
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-lg border border-orange-200">
                <h3 className="text-lg font-semibold text-orange-800 mb-3 flex items-center">
                  🏺 तारण / गहाण तपशील
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <label className="text-sm font-medium text-gray-600">वस्तूचा तपशील</label>
                    <p className="text-base font-medium font-noto">{selectedLoanDetails.collateralDetails || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">वजन</label>
                    <p className="text-base font-medium">{selectedLoanDetails.weight || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">शुद्धता %</label>
                    <p className="text-base font-medium">{selectedLoanDetails.purity ? String(selectedLoanDetails.purity).replace('.00', '') : "82"}%</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">अंदाजे बाजार मूल्य</label>
                    <p className="text-base font-medium">₹ {selectedLoanDetails.marketValue ? LoanCalculations.formatAmount(Number(selectedLoanDetails.marketValue)) : "—"}</p>
                  </div>
                </div>
              </div>
              )}

              {/* Documents & Additional Info */}
              <div className={`p-4 rounded-lg border ${selectedLoanDetails.loanType === 'विनातारण' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200' : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'}`}>
                <h3 className={`text-lg font-semibold mb-3 flex items-center ${selectedLoanDetails.loanType === 'विनातारण' ? 'text-blue-800' : 'text-gray-800'}`}>
                  📄 {selectedLoanDetails.loanType === 'विनातारण' ? 'कर्ज तपशील / अतिरिक्त माहिती' : 'अतिरिक्त माहिती'}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">कागदपत्रे</label>
                    <p className="text-base font-medium font-noto">{selectedLoanDetails.documentDetails || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">विशेष अटी</label>
                    <p className="text-base font-medium font-noto">{selectedLoanDetails.specialConditions || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">इतर माहिती</label>
                    <p className="text-base font-medium font-noto">{selectedLoanDetails.otherInfo || "—"}</p>
                  </div>
                </div>

                {/* Read-Only Photo Viewing Section */}
                <div className="space-y-4 border-t pt-4">
                  <PhotoViewer 
                    loanId={selectedLoanDetails.id}
                    loanAccountNumber={selectedLoanDetails.accountNumber}
                    readonly={true}
                  />
                </div>
              </div>

              {/* Closure Information (if closed) */}
              {selectedLoanDetails.status === 'closed' && selectedLoanDetails.closureDate && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-lg border border-red-200">
                  <h3 className="text-lg font-semibold text-red-800 mb-3 flex items-center">
                    🔒 खाते बंद माहिती
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">बंद तारीख</label>
                      <p className="text-base font-medium">{DateUtils.isoToIndianDate(selectedLoanDetails.closureDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">बंद रक्कम</label>
                      <p className="text-base font-medium">₹ {selectedLoanDetails.closureAmount ? LoanCalculations.formatAmount(Number(selectedLoanDetails.closureAmount)) : "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-center space-x-4 pt-4 border-t border-gray-200">
                {selectedLoanDetails.status === 'active' && (
                  <Button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleEdit(selectedLoanDetails);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    संपादन करा
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setShowDetailsModal(false);
                    try {
                      ReceiptGenerator.openReceiptWindow(selectedLoanDetails, company as any);
                    } catch (error) {
                      console.error("Receipt generation error:", error);
                    }
                  }}
                  variant="outline"
                  className="border-purple-300 text-purple-600 hover:bg-purple-50"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  पावती काढा
                </Button>
                <Button
                  onClick={() => setShowDetailsModal(false)}
                  variant="outline"
                >
                  बंद करा
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Performance Info Card - Only show when no filters are active AND no search query */}
      {!hasSearchQuery && !hasDateFilters && !hasStatusFilter && (
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-50 border-indigo-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-center text-center">
              <div>
                <CreditCard className="h-16 w-16 text-indigo-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">कर्ज शोधा</h3>
                <p className="text-gray-600 mb-4">
                  वरील search box वापरून कर्ज शोधा.<br/>
                  Performance साठी default list दिसत नाही.
                </p>
                <div className="bg-white/70 p-4 rounded-lg border border-indigo-200">
                  <p className="text-sm text-gray-700">
                    📝 <strong>सूचना:</strong> कर्जदाराचे नाव, कर्ज क्रमांक, किंवा रक्कम टाइप करा
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
          </div>
        </main>
      </div>

      <Dialog open={dateWarningDialog.open} onOpenChange={(open) => { if (!open) handleDateWarningCancel(); }}>
        <DialogContent className={`w-[90%] max-w-md p-0 border-t-4 ${dateWarningDialog.severity === 'critical' ? 'border-red-500' : 'border-amber-500'}`}>
          <div className={`p-4 flex items-start gap-3 ${dateWarningDialog.severity === 'critical' ? 'bg-red-50' : 'bg-amber-50'} rounded-t-lg`}>
            <div className={`p-2 rounded-full shrink-0 ${dateWarningDialog.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className={`font-bold text-sm ${dateWarningDialog.severity === 'critical' ? 'text-red-800' : 'text-amber-800'}`}>
                {dateWarningDialog.title}
              </h3>
              <p className="text-xs text-gray-700 mt-1 leading-relaxed">{dateWarningDialog.message}</p>
            </div>
          </div>
          <div className="p-4 flex gap-2 justify-end bg-gray-50 rounded-b-xl">
            <Button variant="outline" size="sm" onClick={handleDateWarningCancel} className="text-sm">
              रद्द करा
            </Button>
            <Button size="sm" onClick={handleDateWarningConfirm}
              className={`text-sm text-white ${dateWarningDialog.severity === 'critical' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
              तरीही सेव करा
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateWarningDialog.open} onOpenChange={(open) => { if (!open) handleDuplicateWarningCancel(); }}>
        <DialogContent className="w-[90%] max-w-md p-0 border-t-4 border-orange-500">
          <div className="p-4 flex items-start gap-3 bg-orange-50 rounded-t-lg">
            <div className="p-2 rounded-full shrink-0 bg-orange-100 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-orange-800">{duplicateWarningDialog.title}</h3>
              <p className="text-xs text-gray-700 mt-1 leading-relaxed">{duplicateWarningDialog.message}</p>
            </div>
          </div>
          <div className="p-4 flex gap-2 justify-end bg-gray-50 rounded-b-xl">
            <Button variant="outline" size="sm" onClick={handleDuplicateWarningCancel} className="text-sm">
              रद्द करा (तपासतो)
            </Button>
            <Button size="sm" onClick={handleDuplicateWarningConfirm} className="text-sm text-white bg-orange-600 hover:bg-orange-700">
              होय, नवीन कर्ज नोंद करा
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ltvWarningDialog.open} onOpenChange={(open) => { if (!open) handleLtvWarningCancel(); }}>
        <DialogContent className="w-[90%] max-w-md p-0 border-t-4 border-red-500">
          <div className="p-4 flex items-start gap-3 bg-red-50 rounded-t-lg">
            <div className="p-2 rounded-full shrink-0 bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-red-800">{ltvWarningDialog.title}</h3>
              <p className="text-xs text-gray-700 mt-1 leading-relaxed whitespace-pre-line">{ltvWarningDialog.message}</p>
            </div>
          </div>
          <div className="p-4 flex gap-2 justify-end bg-gray-50 rounded-b-xl">
            <Button variant="outline" size="sm" onClick={handleLtvWarningCancel} className="text-sm">
              रद्द करा (रक्कम बदला)
            </Button>
            <Button size="sm" onClick={handleLtvWarningConfirm} className="text-sm text-white bg-red-600 hover:bg-red-700">
              होय, तरीही सेव्ह करा
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LabelPrintDialog
        open={labelPrintDialogOpen}
        onOpenChange={setLabelPrintDialogOpen}
        loans={labelPrintLoans}
      />
    </div>
  );
}

export default React.memo(Loans);
