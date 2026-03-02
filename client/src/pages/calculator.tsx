import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Calculator, Calendar, TrendingUp, Info, Home } from "lucide-react";
import { Link } from "wouter";
import { LoanCalculationsAdvanced, CompoundInterestCalculator } from "@/lib/loan-calculations";
import { DateUtils } from "@/lib/date-utils";

export default function InterestCalculator() {
  const [principalAmount, setPrincipalAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAdvanced, setIsAdvanced] = useState(true); // Default to Advanced (Advance Button व्याज)
  const [calculationMode, setCalculationMode] = useState("half_month"); // Default to half-month
  const [compoundFrequency, setCompoundFrequency] = useState("yearly"); // New compound frequency state
  const [rateType, setRateType] = useState("yearly"); // Monthly or Yearly rate for Simple Interest
  const [results, setResults] = useState<any>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

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
    const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    
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
        // 365-day banking standard: Convert months to days for other modes
        let effectiveRate = rate;
        if (rateType === "monthly") {
          effectiveRate = rate * 12; // Convert monthly to annual
        }
        const daysForCalculation = Math.round(calculatedMonths * 30); // Convert months to days  
        simpleInterest = Math.round((principal * effectiveRate * daysForCalculation) / (100 * 365));
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

  const clearAll = () => {
    setPrincipalAmount("");
    setInterestRate("");
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setIsAdvanced(true); // Default to Advanced (Advance Button व्याज)
    setCalculationMode("half_month"); // Default to half-month
    setCompoundFrequency("yearly"); // Default to yearly compound
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
                </CardContent>
              </Card>
            )}



          </div>
        </main>
      </div>
    </div>
  );
}