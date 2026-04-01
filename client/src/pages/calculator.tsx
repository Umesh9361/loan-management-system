import React, { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Calculator, Calendar, TrendingUp, Info, Home, Plus, Trash2, Bluetooth, FileText, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { LoanCalculationsAdvanced, CompoundInterestCalculator } from "@/lib/loan-calculations";
import { DateUtils } from "@/lib/date-utils";
import html2canvas from "html2canvas";
import { printReceiptViaBluetooth, isBluetoothSupported } from "@/lib/bluetooth-printer";

interface CalcSummaryEntry {
  id: number;
  customerName: string;
  codeNumber: string;
  principalAmount: number;
  interestRate: string;
  startDate: string;
  endDate: string;
  interestAmount: number;
  totalAmount: number;
  totalDays: number;
}

const CALC_SUMMARY_KEY = 'calc_summary_entries';

const toShortDate = (isoDate: string): string => {
  const d = DateUtils.isoToIndianDate(isoDate);
  const parts = d.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[0]}/${parts[1]}/${parts[2].slice(2)}`;
  }
  return d;
};

export default function InterestCalculator() {
  const [principalAmount, setPrincipalAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAdvanced, setIsAdvanced] = useState(true);
  const [calculationMode, setCalculationMode] = useState("half_month");
  const [compoundFrequency, setCompoundFrequency] = useState("yearly");
  const [rateType, setRateType] = useState("yearly");
  const [results, setResults] = useState<any>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [customerName, setCustomerName] = useState("");
  const [codeNumber, setCodeNumber] = useState("");
  const [summaryEntries, setSummaryEntries] = useState<CalcSummaryEntry[]>(() => {
    try {
      const saved = sessionStorage.getItem(CALC_SUMMARY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [summaryCounter, setSummaryCounter] = useState(1);
  const summaryEntriesRef = useRef<CalcSummaryEntry[]>(summaryEntries);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [isBtPrinting, setIsBtPrinting] = useState(false);
  const btPrintBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    summaryEntriesRef.current = summaryEntries;
    try {
      sessionStorage.setItem(CALC_SUMMARY_KEY, JSON.stringify(summaryEntries));
    } catch {}
  }, [summaryEntries]);

  const calculatePeriod = (start: string, end: string, mode: string) => {
    if (!start || !end) return null;
    
    let startDate = new Date(start);
    let endDate = new Date(end);
    // CRITICAL FIX: Handle reverse date order and proper day calculation
    if (endDate < startDate) {
      console.warn("⚠️ End date is before start date - swapping dates");
      // Swap dates if end is before start
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }
    
    const timeDiff = endDate.getTime() - startDate.getTime();
    // Fix: Use floor for accurate day counting, then add 1 for inclusive
    const totalDays = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1;
    
    let calculatedMonths = 0;
    let calculatedDays = totalDays;
    
    switch (mode) {
      case "full-month":
        // पूर्ण महिना calculation: 1 दिवस झाला तरी पूर्ण महिन्याची व्याज (30 दिवसापर्यंत)
        // 5 महिने 1 दिवस = 6 महिन्याची व्याज
        // Same date to same date = exclude last day (e.g., 7th to 7th next month = 1 month, not 1 month 1 day)
        const fullMonths = Math.floor(totalDays / 30);
        const remainingDays = totalDays % 30;
        
        if (remainingDays > 0) {
          calculatedMonths = fullMonths + 1; // Any extra day = full month
        } else {
          calculatedMonths = fullMonths;
        }
        calculatedDays = calculatedMonths * 30;
        break;
        
      case "half-month":
        {
          // Proper half-month calculation: 1-15 days = 0.5 month, 16+ days = 1 full month
          const fullMonthsHalf = Math.floor(totalDays / 30);
          const remainingDaysHalf = totalDays % 30;
          
          let fractionalMonth = 0;
          if (remainingDaysHalf >= 1 && remainingDaysHalf <= 15) {
            fractionalMonth = 0.5; // Half month for 1-15 days
          } else if (remainingDaysHalf >= 16) {
            fractionalMonth = 1; // Full month for 16+ days
          }
          
          calculatedMonths = fullMonthsHalf + fractionalMonth;
          break;
        }
        
      case "week":
        {
          // Weekly calculation: 1-8=0.25, 9-15=0.5, 16-22=0.75, 23+=1 month
          const fullMonthsWeek = Math.floor(totalDays / 30);
          const remainingDaysWeek = totalDays % 30;
          let weekMonths = 0;
          
          if (remainingDaysWeek <= 8) {
            weekMonths = 0.25;
          } else if (remainingDaysWeek <= 15) {
            weekMonths = 0.5;
          } else if (remainingDaysWeek <= 22) {
            weekMonths = 0.75;
          } else {
            weekMonths = 1;
          }
          
          calculatedMonths = fullMonthsWeek + weekMonths;
          break;
        }
        
      case "daily":
        // Daily calculation: days/30 = months
        calculatedMonths = totalDays / 30;
        break;
        
      default:
        calculatedMonths = Math.floor(totalDays / 30);
        break;
    }
    
    return {
      totalDays,
      calculatedMonths,
      months: Math.floor(totalDays / 30),
      remainingDays: totalDays % 30,
      years: Math.floor(totalDays / 365),
      monthsInYear: Math.floor((totalDays % 365) / 30),
      mode
    };
  };

  const handleCalculate = () => {
    if (!principalAmount || !interestRate || !startDate || !endDate) {
      alert("कृपया सर्व फील्ड भरा");
      return;
    }

    const principal = Number(principalAmount);
    const rate = Number(interestRate);
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate total days with inclusive counting (both start and end dates included)
    const timeDiff = end.getTime() - start.getTime();
    const totalDays = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1;
    
    if (isAdvanced) {
      // Advanced compound interest calculation with calendar accuracy
      const advancedResult = LoanCalculationsAdvanced.calculateAdvancedCompoundInterest(
        principal,
        rate,
        start,
        end,
        compoundFrequency as any,
        calculationMode as any
      );

      // Get accurate time period with calendar awareness
      const timePeriod = LoanCalculationsAdvanced.calculateTimePeriod(start, end);
      const years = timePeriod.years;
      const months = timePeriod.months;
      const days = timePeriod.days;

      setResults({
        totalDays,
        years,
        months, 
        days,
        interest: advancedResult.interestAmount,
        total: advancedResult.totalPayable,
        principal,
        isAdvanced: true,
        breakdown: advancedResult.breakdown,
        calendarAccuracy: {
          isExactMonth: timePeriod.isExactMonth,
          calendarMonths: timePeriod.totalMonths,
          bankingMonths: timePeriod.bankingMonths,
          leapYearInfo: timePeriod.calendarInfo
        }
      });
    } else {
      // Enhanced Simple Interest with calendar-aware calculation modes
      const timePeriod = LoanCalculationsAdvanced.calculateTimePeriod(start, end);
      let calculatedMonths = 0;
      
      // Use calendar-aware calculation
      if (timePeriod.isExactMonth) {
        // Exact calendar months - no fractional calculation needed
        calculatedMonths = timePeriod.totalMonths;
      } else {
        // Apply calculation mode to remaining days
        const remainingDays = timePeriod.days;
        
        switch (calculationMode) {
          case "full-month":
            calculatedMonths = timePeriod.totalMonths + (remainingDays > 0 ? 1 : 0);
            break;
          case "half-month":
            calculatedMonths = timePeriod.totalMonths + 
              (remainingDays >= 1 && remainingDays <= 15 ? 0.5 : remainingDays >= 16 ? 1 : 0);
            break;
          case "week":
            let weekFraction = 0;
            if (remainingDays >= 1 && remainingDays <= 8) weekFraction = 0.25;
            else if (remainingDays >= 9 && remainingDays <= 15) weekFraction = 0.5;
            else if (remainingDays >= 16 && remainingDays <= 22) weekFraction = 0.75;
            else if (remainingDays >= 23) weekFraction = 1;
            calculatedMonths = timePeriod.totalMonths + weekFraction;
            break;
          case "daily":
            // FIXED: Direct daily calculation without month conversion to avoid rounding errors
            // For daily mode, we'll calculate interest directly using actual days
            calculatedMonths = totalDays; // Store actual days for direct calculation
            break;
          default:
            calculatedMonths = timePeriod.bankingMonths;
        }
      }
      
      // FIXED: Handle daily calculation differently to avoid rounding errors
      let simpleInterest = 0;
      
      if (calculationMode === "daily") {
        // SIMPLE INTEREST: Banking Standard (365-day formula)
        // Handle Monthly vs Yearly rate
        let effectiveRate = rate;
        if (rateType === "monthly") {
          // Convert monthly rate to annual rate
          effectiveRate = rate * 12;
        }
        
        // Formula: (Principal × Annual Rate × Days) / (100 × 365)
        const dailyInterestBeforeRounding = (principal * effectiveRate * totalDays) / (100 * 365);
        simpleInterest = Math.round(dailyInterestBeforeRounding);
        
        // Debug: Banking Standard Formula
        if (process.env.NODE_ENV === 'development') {
          console.log("🏦 SIMPLE INTEREST - Banking Standard:", {
            principal,
            rate: `${rate}%`,
            rateType,
            effectiveRate: `${effectiveRate}% (annual)`,
            totalDays,
            formula: `(${principal} × ${effectiveRate} × ${totalDays}) / (100 × 365)`,
            calculation: `${principal * effectiveRate * totalDays} / 36500 = ${dailyInterestBeforeRounding}`,
            beforeRounding: dailyInterestBeforeRounding,
            afterRounding: simpleInterest,
            bankingStandard: "365-day year calculation"
          });
        }
      } else {
        let effectiveRate = rate;
        if (rateType === "monthly") {
          effectiveRate = rate * 12;
        }
        simpleInterest = Math.round((principal * effectiveRate * totalDays) / (100 * 365));
      }
      const simpleTotal = principal + simpleInterest;

      const years = timePeriod.years;
      const months = timePeriod.months; 
      const days = timePeriod.days;

      setResults({
        totalDays,
        years,
        months, 
        days,
        interest: simpleInterest,
        total: simpleTotal,
        principal,
        isAdvanced: false,
        calculatedMonths: calculatedMonths,
        calendarAccuracy: {
          isExactMonth: timePeriod.isExactMonth,
          calendarMonths: timePeriod.totalMonths,
          bankingMonths: timePeriod.bankingMonths,
          leapYearInfo: timePeriod.calendarInfo
        }
      });
    }
    
    // Auto-scroll to results after calculation
    setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest' 
        });
      }
    }, 100);
  };

  const handleAddToSummary = useCallback(() => {
    if (!results) return;
    const entry: CalcSummaryEntry = {
      id: summaryCounter,
      customerName: customerName.trim(),
      codeNumber: codeNumber.trim(),
      principalAmount: results.principal,
      interestRate: interestRate,
      startDate: startDate,
      endDate: endDate,
      interestAmount: results.interest,
      totalAmount: results.total,
      totalDays: results.totalDays,
    };
    setSummaryEntries(prev => [...prev, entry]);
    setSummaryCounter(prev => prev + 1);
    setResults(null);
    setPrincipalAmount("");
    setCodeNumber("");
    setTimeout(() => {
      summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [results, summaryCounter, customerName, codeNumber, interestRate, startDate, endDate]);

  const handleDeleteEntry = useCallback((entryId: number) => {
    setSummaryEntries(prev => prev.filter(e => e.id !== entryId));
  }, []);

  const handleClearAllSummary = useCallback(() => {
    setSummaryEntries([]);
    setSummaryCounter(1);
  }, []);

  const generateThermalReceiptHTML = useCallback((entries: CalcSummaryEntry[]): string => {
    if (entries.length === 0) return '';
    const totalPrincipal = entries.reduce((sum, e) => sum + e.principalAmount, 0);
    const totalInterest = entries.reduce((sum, e) => sum + e.interestAmount, 0);
    const grandTotal = totalPrincipal + totalInterest;
    const displayName = entries[entries.length - 1].customerName || 'अंदाज';
    const todayFormatted = DateUtils.isoToIndianDate(new Date().toISOString().split('T')[0]);

    let rows = '';
    entries.forEach((entry, i) => {
      rows += `<tr>
        <td style="padding:14px 4px 14px 4px;text-align:center;font-size:16px;font-weight:600;">${i + 1}</td>
        <td style="padding:14px 4px;text-align:center;font-size:22px;font-weight:700;">${entry.codeNumber || '—'}</td>
        <td style="padding:14px 4px;text-align:right;font-size:20px;font-weight:700;vertical-align:middle;">${toShortDate(entry.startDate)}</td>
        <td style="padding:14px 4px;text-align:right;font-size:22px;font-weight:700;">${Number(Math.round(entry.principalAmount)).toLocaleString('en-IN')}</td>
        <td style="padding:14px 4px;text-align:right;font-size:22px;font-weight:700;">${Number(Math.round(entry.interestAmount)).toLocaleString('en-IN')}</td>
      </tr>`;
    });

    return `
      <div style="padding:6px 12px;font-family:'Noto Sans Devanagari',sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
          <div style="font-weight:800;font-size:26px;line-height:1.4;">${displayName}</div>
          <div style="font-size:22px;font-weight:700;white-space:nowrap;line-height:1.4;">तारीख: ${todayFormatted}</div>
        </div>
        <div style="text-align:center;font-weight:800;font-size:24px;margin-bottom:10px;"><span style="border-bottom:2px solid #000;padding-bottom:6px;">Estimate</span></div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <colgroup>
            <col style="width:46px;">
            <col style="width:90px;">
            <col style="width:110px;">
            <col style="width:auto;">
            <col style="width:110px;">
          </colgroup>
          <thead>
            <tr style="border-bottom:3px double #000;">
              <th style="padding:10px 4px;font-size:22px;text-align:center;font-weight:700;">अ.नं.</th>
              <th style="padding:10px 4px;font-size:22px;text-align:center;font-weight:700;">कोड नं</th>
              <th style="padding:10px 4px;font-size:22px;text-align:right;font-weight:700;">दिनांक</th>
              <th style="padding:10px 4px;font-size:22px;text-align:right;font-weight:700;">मुद्दल</th>
              <th style="padding:10px 4px;font-size:22px;text-align:right;font-weight:700;">व्याज</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr style="border-top:3px double #000;">
              <td colspan="3" style="padding:12px 4px;text-align:right;font-size:22px;font-weight:700;">एकूण</td>
              <td style="padding:12px 4px;text-align:right;font-size:22px;font-weight:700;">${Number(Math.round(totalPrincipal)).toLocaleString('en-IN')}</td>
              <td style="padding:12px 4px;text-align:right;font-size:22px;font-weight:700;">${Number(Math.round(totalInterest)).toLocaleString('en-IN')}</td>
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

  const handleBluetoothPrint = useCallback(async () => {
    const currentEntries = summaryEntriesRef.current;
    if (currentEntries.length === 0 || isBtPrinting) return;
    const thermalHTML = generateThermalReceiptHTML(currentEntries);
    if (!thermalHTML) return;
    setIsBtPrinting(true);
    try {
      const canvas = await renderReceiptToCanvas(thermalHTML);
      await printReceiptViaBluetooth(canvas, 576);
    } catch (error: any) {
      if (error?.message?.includes('cancelled') || error?.message?.includes('User cancelled')) {
        return;
      }
      console.error("Bluetooth print error:", error);
    } finally {
      setIsBtPrinting(false);
      if (btPrintBtnRef.current) btPrintBtnRef.current.blur();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
  }, [generateThermalReceiptHTML, renderReceiptToCanvas, isBtPrinting]);

  const clearAll = () => {
    setPrincipalAmount("");
    setInterestRate("");
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setIsAdvanced(true);
    setCalculationMode("half_month");
    setCompoundFrequency("yearly");
    setResults(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-3">
                <Link href="/">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    मुखपृष्ठावर जा
                  </Button>
                </Link>
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground heading-professional flex items-center gap-2">
                <Calculator className="h-6 w-6" />
                व्याज कॅल्क्युलेटर
              </h1>
              <p className="text-muted-foreground">
                365 दिवसांच्या बँकिंग मानकानुसार साधे व्याज गणना
              </p>
            </div>

            {/* Name & Code for Print */}
            <Card className="mb-4 card-professional border-amber-200 bg-amber-50/30">
              <CardContent className="py-3 px-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="customerName" className="text-sm font-medium text-amber-800">कर्जदार नाव <span className="text-xs text-gray-500">(प्रिंट साठी)</span></Label>
                    <Input
                      id="customerName"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="उदा. राम शिंदे"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="codeNumber" className="text-sm font-medium text-amber-800">कोड नंबर <span className="text-xs text-gray-500">(कर्ज क्रमांक)</span></Label>
                    <Input
                      id="codeNumber"
                      type="text"
                      value={codeNumber}
                      onChange={(e) => setCodeNumber(e.target.value)}
                      placeholder="उदा. 101"
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Input Form */}
            <Card className="mb-6 card-professional">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  व्याज गणना माहिती
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <Label htmlFor="principal">मूळ रक्कम (₹)</Label>
                    <Input
                      id="principal"
                      type="number"
                      value={principalAmount}
                      onChange={(e) => setPrincipalAmount(e.target.value)}
                      placeholder="उदा. 10000"
                      className="font-inter"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rate">व्याजदर (%)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="rate"
                        type="number"
                        step="0.1"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        placeholder={isAdvanced ? "उदा. 2" : (rateType === "monthly" ? "उदा. 2" : "उदा. 24")}
                        className="font-inter flex-1"
                      />
                      {!isAdvanced && (
                        <select 
                          value={rateType} 
                          onChange={(e) => setRateType(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm min-w-20"
                          autoComplete="off"
                        >
                          <option value="yearly">वार्षिक</option>
                          <option value="monthly">मासिक</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="startDate">सुरुवातीची तारीख</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="font-inter"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">शेवटची तारीख</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="font-inter"
                    />
                  </div>
                </div>

                {/* Simple/Advanced Toggle */}
                <div className="mt-6 p-4 md:p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-base font-medium">गणना पद्धत</Label>
                    <div className="flex items-center space-x-3">
                      <span className={`text-sm ${!isAdvanced ? 'font-semibold text-indigo-600' : 'text-gray-600'}`}>साधे व्याज</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAdvanced}
                          onChange={(e) => setIsAdvanced(e.target.checked)}
                          className="sr-only peer"
                          autoComplete="off"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                      <span className={`text-sm ${isAdvanced ? 'font-semibold text-green-600' : 'text-gray-600'}`}>ॲडव्हान्स व्याज</span>
                    </div>
                  </div>

                  {/* Advanced Options */}
                  {isAdvanced && (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">कंपाऊंड व्याज वारंवारता</Label>
                        <select 
                          value={compoundFrequency} 
                          onChange={(e) => setCompoundFrequency(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoComplete="off"
                        >
                          <option value="yearly">वार्षिक (Yearly)</option>
                          <option value="half_yearly">सहा महिने (Half Yearly)</option>
                          <option value="quarterly">तीन महिने (Quarterly)</option>
                          <option value="monthly">मासिक (Monthly)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Calculation Mode Options - Hidden in Simple Interest Mode */}
                  {isAdvanced && (
                    <div className="space-y-4 mt-4">
                      <Label className="text-sm font-medium mb-2 block">गणना पद्धत निवडा</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-indigo-50">
                          <input
                            type="radio"
                            value="full-month"
                            checked={calculationMode === "full-month"}
                            onChange={(e) => setCalculationMode(e.target.value)}
                            id="month-calc"
                            className="text-indigo-600"
                            autoComplete="off"
                          />
                          <Label htmlFor="month-calc" className="cursor-pointer">
                            <div className="font-medium">पूर्ण महिना</div>
                            <div className="text-xs text-gray-600">1 दिवस झाला तरी पूर्ण महिना</div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-green-50">
                          <input
                            type="radio"
                            value="half_month"
                            checked={calculationMode === "half_month"}
                            onChange={(e) => setCalculationMode(e.target.value)}
                            id="half-month-calc"
                            className="text-green-600"
                            autoComplete="off"
                          />
                          <Label htmlFor="half-month-calc" className="cursor-pointer">
                            <div className="font-medium">अर्धा महिना</div>
                            <div className="text-xs text-gray-600">1-15 दिवस = 0.5, 16+ = 1 महिना</div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-purple-50">
                          <input
                            type="radio"
                            value="week"
                            checked={calculationMode === "week"}
                            onChange={(e) => setCalculationMode(e.target.value)}
                            id="week-calc"
                            className="text-purple-600"
                            autoComplete="off"
                          />
                          <Label htmlFor="week-calc" className="cursor-pointer">
                            <div className="font-medium">आठवडा</div>
                            <div className="text-xs text-gray-600">0-8=0.25, 9-15=0.5, 16-22=0.75</div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-orange-50">
                          <input
                            type="radio"
                            value="daily"
                            checked={calculationMode === "daily"}
                            onChange={(e) => setCalculationMode(e.target.value)}
                            id="day-calc"
                            className="text-orange-600"
                            autoComplete="off"
                          />
                          <Label htmlFor="day-calc" className="cursor-pointer">
                            <div className="font-medium">दिवस</div>
                            <div className="text-xs text-gray-600">प्रत्येक दिवस वेगळा</div>
                          </Label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mt-6">
                  <Button onClick={handleCalculate} className="btn-professional btn-primary">
                    <Calculator className="h-4 w-4 mr-2" />
                    गणना करा
                  </Button>
                  <Button onClick={clearAll} variant="outline" className="btn-professional">
                    साफ करा
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Simple Results Display */}
            {results && (
              <Card ref={resultsRef} className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardHeader>
                  <CardTitle className={`${results.isAdvanced ? 'text-green-800' : 'text-indigo-800'} flex items-center gap-2`}>
                    <TrendingUp className="h-5 w-5" />
                    {results.isAdvanced ? 'ॲडव्हान्स व्याज गणना परिणाम' : 'साधे व्याज गणना परिणाम'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Duration Display */}
                  <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-indigo-800">
                      <Calendar className="h-5 w-5" />
                      कर्ज कालावधी
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-indigo-600">{results.totalDays}</div>
                        <div className="text-sm text-gray-600">एकूण दिवस</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-600">{results.years}</div>
                        <div className="text-sm text-gray-600">वर्षे</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{results.months}</div>
                        <div className="text-sm text-gray-600">महिने</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">{results.days}</div>
                        <div className="text-sm text-gray-600">दिवस</div>
                      </div>
                    </div>
                    
                    {/* Calendar Accuracy Information */}
                    {results.calendarAccuracy && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Info className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-800">कॅलेंडर अचूकता माहिती</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="font-medium">कॅलेंडर महिने:</span>
                            <div className="text-green-700">{results.calendarAccuracy.calendarMonths} महिने</div>
                          </div>
                          <div>
                            <span className="font-medium">बँकिंग महिने:</span>
                            <div className="text-indigo-700">{results.calendarAccuracy.bankingMonths?.toFixed(3)} महिने</div>
                          </div>
                          <div>
                            <span className="font-medium">अचूक महिना:</span>
                            <div className={results.calendarAccuracy.isExactMonth ? "text-green-700" : "text-orange-700"}>
                              {results.calendarAccuracy.isExactMonth ? "होय ✓" : "नाही"}
                            </div>
                          </div>
                        </div>
                        {results.calculatedMonths && (
                          <div className="mt-2 text-xs">
                            <span className="font-medium">वापरलेले महिने (गणना):</span>
                            <span className="text-purple-700 ml-1">{results.calculatedMonths.toFixed(3)} महिने</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Amount Display */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                    <div className="bg-white p-4 rounded-lg border border-green-200">
                      <div className="text-2xl font-bold text-gray-800">
                        ₹{results.principal.toLocaleString('en-IN')}
                      </div>
                      <div className="text-sm text-gray-600">मुद्दल रक्कम</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-green-200">
                      <div className="text-2xl font-bold text-indigo-600">
                        ₹{results.interest.toLocaleString('en-IN')}
                      </div>
                      <div className="text-sm text-gray-600">व्याज रक्कम</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-green-200">
                      <div className="text-2xl font-bold text-green-600">
                        ₹{results.total.toLocaleString('en-IN')}
                      </div>
                      <div className="text-sm text-gray-600">एकूण देय रक्कम</div>
                    </div>
                  </div>

                  {/* Date Range Display */}
                  <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <h4 className="font-semibold text-indigo-800 mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      कर्ज कालावधी तपशील
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">सुरुवात:</span> {DateUtils.isoToIndianDate(startDate)}
                      </div>
                      <div>
                        <span className="font-medium">समाप्ती:</span> {DateUtils.isoToIndianDate(endDate)}
                      </div>
                    </div>
                  </div>

                  {/* Formula Display */}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      {results.isAdvanced ? 'ॲडव्हान्स गणना पद्धत' : 'गणना सूत्र (365 दिवसांचे बँकिंग मानक)'}
                    </h4>
                    {results.isAdvanced ? (
                      <div className="text-sm text-gray-600">
                        <div className="bg-gradient-to-r from-green-100 to-indigo-100 p-4 rounded-lg border-2 border-green-300 mb-3">
                          <div className="font-bold text-green-800 mb-2">चक्रवाढ व्याज गणना तपशील</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="font-semibold text-indigo-700">कंपाऊंड वारंवारता: {compoundFrequency === 'yearly' ? 'वार्षिक' : compoundFrequency === 'half_yearly' ? 'सहा महिने' : compoundFrequency === 'quarterly' ? 'तीन महिने' : 'मासिक'}</div>
                              <div className="text-purple-700">दिन गणना पद्धत: {calculationMode === 'month' ? 'पूर्ण महिना (1 दिवस = 1 महिना)' : calculationMode === 'half_month' ? 'अर्धा महिना (1-15=0.5, 16+=1)' : calculationMode === 'week' ? 'आठवडा (1-8=0.25, 9-15=0.5, 16-22=0.75, 23+=1)' : 'दैनिक अचूक गणना'}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-red-700">व्याज मुद्दलावर भर घालून चक्रवाढ व्याज गणना</div>
                              <div className="text-gray-700">निवडलेल्या वारंवारतेनुसार compound होते</div>
                            </div>
                          </div>
                        </div>
                        {results.breakdown && results.breakdown.detailedBreakdown && (
                          <div className="mt-2 text-xs bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                            <div className="font-semibold text-gray-800 mb-1">गणना माहिती:</div>
                            <div>कंपाऊंडिंग पिरियड्स: {results.breakdown.compoundingPeriods || 0}</div>
                            <div>एकूण महिने: {results.breakdown.totalMonthsProcessed || 0}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-indigo-100 to-indigo-100 p-4 rounded-lg border-2 border-indigo-300">
                        <div className="font-bold text-indigo-800 mb-2">साधे व्याज गणना (365 दिवसांचे बँकिंग मानक)</div>
                        <div className="text-sm text-gray-700 mb-2">
                          <span className="font-semibold">सूत्र:</span> व्याज = (मुद्दल × व्याजदर × दिवस) ÷ (100 × 365)
                        </div>
                        <div className="text-sm text-indigo-700 font-medium bg-white p-2 rounded border">
                          व्याज = ({results.principal} × {interestRate} × {results.totalDays}) ÷ (100 × 365) = ₹{results.interest}
                        </div>
                        <div className="text-xs text-gray-600 mt-2 italic">
                          365 दिवसांचे बँकिंग मानक वापरून साधे व्याज गणना
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-6 flex justify-center">
                    <Button
                      onClick={handleAddToSummary}
                      className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 py-3 text-base font-bold shadow-lg"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      हिशोबात जोडा
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary Section - Closure Form Style */}
            {summaryEntries.length > 0 && (
              <Card ref={summaryRef} className="border border-amber-200 shadow-lg bg-white mb-6">
                <CardHeader className="py-3 px-4 bg-amber-50 border-b">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-amber-800 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      एकत्रित हिशोब ({summaryEntries.length})
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        ref={btPrintBtnRef}
                        type="button"
                        onClick={handleBluetoothPrint}
                        disabled={isBtPrinting}
                        className="inline-flex items-center rounded-md px-3 h-9 text-xs border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200 transition-colors outline-none disabled:opacity-50"
                      >
                        {isBtPrinting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bluetooth className="h-3 w-3 mr-1" />}
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
                  {summaryEntries[summaryEntries.length - 1]?.customerName && (
                    <div className="flex justify-between items-start px-3 pt-2 pb-1">
                      <div className="font-bold text-sm">{summaryEntries[summaryEntries.length - 1].customerName}</div>
                      <div className="text-xs text-gray-500 text-right">
                        तारीख: {DateUtils.isoToIndianDate(new Date().toISOString().split('T')[0])}
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-amber-200 bg-amber-50/50">
                          <th className="px-2 py-2 text-center font-bold text-xs">अ.नं.</th>
                          <th className="px-2 py-2 text-center font-bold text-xs">कोड नं</th>
                          <th className="px-2 py-2 text-right font-bold text-xs">दिनांक</th>
                          <th className="px-2 py-2 text-right font-bold text-xs">मुद्दल</th>
                          <th className="px-2 py-2 text-right font-bold text-xs">व्याज</th>
                          <th className="px-2 py-2 text-right font-bold text-xs">एकूण</th>
                          <th className="px-2 py-2 text-center font-bold text-xs w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryEntries.map((entry, index) => (
                          <tr key={entry.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-2 py-2 text-center text-xs font-medium">{index + 1}</td>
                            <td className="px-2 py-2 text-center text-xs font-semibold text-indigo-700">{entry.codeNumber || '—'}</td>
                            <td className="px-2 py-2 text-right text-xs whitespace-nowrap">{toShortDate(entry.startDate)}</td>
                            <td className="px-2 py-2 text-right text-xs font-semibold">₹{entry.principalAmount.toLocaleString('en-IN')}</td>
                            <td className="px-2 py-2 text-right text-xs font-semibold text-orange-700">₹{entry.interestAmount.toLocaleString('en-IN')}</td>
                            <td className="px-2 py-2 text-right text-xs font-bold text-green-700">₹{entry.totalAmount.toLocaleString('en-IN')}</td>
                            <td className="px-2 py-2 text-center">
                              <button onClick={() => handleDeleteEntry(entry.id)} className="text-red-400 hover:text-red-600 p-0.5">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-amber-300 bg-amber-50 font-bold">
                          <td colSpan={3} className="px-2 py-2 text-right text-sm font-bold text-amber-800">एकूण:</td>
                          <td className="px-2 py-2 text-right text-sm font-bold text-gray-800">₹{summaryEntries.reduce((s, e) => s + e.principalAmount, 0).toLocaleString('en-IN')}</td>
                          <td className="px-2 py-2 text-right text-sm font-bold text-orange-700">₹{summaryEntries.reduce((s, e) => s + e.interestAmount, 0).toLocaleString('en-IN')}</td>
                          <td className="px-2 py-2 text-right text-sm font-bold text-green-700">₹{summaryEntries.reduce((s, e) => s + e.totalAmount, 0).toLocaleString('en-IN')}</td>
                          <td></td>
                        </tr>
                        <tr className="border-t-2 border-amber-400 bg-gradient-to-r from-amber-100 to-orange-100">
                          <td colSpan={7} className="px-2 py-3 text-center text-lg font-black text-amber-900">
                            Grand Total : ₹{summaryEntries.reduce((s, e) => s + e.totalAmount, 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}