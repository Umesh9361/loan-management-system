import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Calculator, TrendingDown, AlertTriangle, Printer, Eye, Camera, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { PhotoViewer } from "@/components/ui/photo-viewer";

// Extend window object for photo functionality
declare global {
  interface Window {
    overduePhotoUrls: string[];
    overdueCurrentPhotoIndex: number;
  }
}

interface OverdueReportFilters {
  dateFrom: string;
  dateTo: string;
  groupId: string;
  currentGoldRate: string;
  finePurityPercentage: string;
  monthlyInterestRate: string;
  interestRateMode: 'loan-wise' | 'manual'; // New option
  projectionMode: 'current' | 'future';
  futureProjectionPeriod: '1month' | '3months' | '6months' | '1year';
}

interface OverdueItem {
  loanId: string;
  borrowerName: string;
  borrowerPhone: string;
  groupName: string;
  loanDate: string;
  goldItem: string;
  principalAmount: number;
  interestToDate: number;
  totalAmount: number;
  totalPaid: number;
  outstandingAmount: number;
  goldWeight: number;
  fineGoldWeight: number;
  currentGoldValue: number;
  lossAmount: number;
  lossPercentage: number;
  riskLevel: 'low' | 'medium' | 'high';
  daysOverdue: number;
}

export default function OverdueReport() {
  const [, setLocation] = useLocation();
  const reportSectionRef = useRef<HTMLDivElement>(null);
  const dataTableRef = useRef<HTMLDivElement>(null);
  
  const handleBackNavigation = () => {
    try {
      // Check if there's history to go back to
      if (window.history.length > 1 && document.referrer) {
        window.history.back();
      } else {
        // Fallback to dashboard if no history or referrer
        setLocation("/dashboard");
      }
    } catch (error) {
      // Safety fallback in case of any navigation errors
      console.warn("Navigation error, falling back to dashboard:", error);
      setLocation("/dashboard");
    }
  };

  const [filters, setFilters] = useState<OverdueReportFilters>({
    dateFrom: new Date().toISOString().split('T')[0], // Today's date as default
    dateTo: new Date().toISOString().split('T')[0], // Today's date
    groupId: "all", // All groups
    currentGoldRate: "", // User will enter
    finePurityPercentage: "", // User will enter
    monthlyInterestRate: "", // User will enter
    interestRateMode: 'loan-wise', // Default to loan-wise to use individual rates
    projectionMode: 'current', // Current analysis
    futureProjectionPeriod: '3months',
  });

  const [reportGenerated, setReportGenerated] = useState(false);
  
  // Row selection for keyboard navigation
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<OverdueItem | null>(null);

  // Fetch groups for dropdown
  const { data: groups = [] } = useQuery({
    queryKey: ['/api/groups'],
  });

  // Generate overdue report with proper query parameters
  const { data: overdueData = [], isLoading: isGenerating, refetch: generateReport } = useQuery({
    queryKey: ['/api/overdue-report', filters],
    queryFn: async () => {
      // Convert filters to URL parameters properly
      const params = new URLSearchParams({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        groupId: filters.groupId,
        currentGoldRate: filters.currentGoldRate,
        finePurityPercentage: filters.finePurityPercentage,
        monthlyInterestRate: filters.monthlyInterestRate,
        interestRateMode: filters.interestRateMode,
        projectionMode: filters.projectionMode,
        futureProjectionPeriod: filters.futureProjectionPeriod,
      });
      
      console.log('🚀 FRONTEND API CALL:', `/api/overdue-report?${params.toString()}`);
      
      const response = await fetch(`/api/overdue-report?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch overdue report');
      }
      return response.json();
    },
    enabled: false, // Only run when manually triggered
  });

  // Keyboard navigation handlers
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!reportGenerated || overdueData.length === 0) return;

    // Skip if photo modal is open
    const photoModal = document.getElementById('overdue-photo-modal');
    if (photoModal && photoModal.style.display !== 'none') return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedRowIndex(prev => 
          prev < sortedOverdueData.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedRowIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        if (selectedRowIndex >= 0 && selectedRowIndex < sortedOverdueData.length) {
          event.preventDefault();
          handleRowSelect(sortedOverdueData[selectedRowIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setShowDetailsModal(false);
        setSelectedRowIndex(-1);
        break;
      case ' ': // Space bar for photo viewing
        if (selectedRowIndex >= 0 && selectedRowIndex < sortedOverdueData.length) {
          event.preventDefault();
          openPhotoModal(sortedOverdueData[selectedRowIndex]);
        }
        break;
    }
  };

  // Row selection handler
  const handleRowSelect = (loan: OverdueItem) => {
    setSelectedLoan(loan);
    setShowDetailsModal(true);
  };

  // Photo modal functionality for space bar
  const openPhotoModal = async (loan: OverdueItem) => {
    try {
      console.log('📸 Opening photo modal for loan:', loan.loanId);
      
      // Check if photo modal exists, create if not
      let modal = document.getElementById('overdue-photo-modal');
      if (!modal) {
        // Create photo modal HTML structure
        const modalHTML = `
          <div id="overdue-photo-modal" style="
            display: none;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
            backdrop-filter: blur(5px);
          ">
            <div style="
              display: flex;
              flex-direction: column;
              height: 100%;
              color: white;
              font-family: inherit;
            ">
              <!-- Header -->
              <div style="
                padding: 20px;
                text-align: center;
                border-bottom: 1px solid rgba(255,255,255,0.2);
                background: rgba(0,0,0,0.5);
              ">
                <h2 id="overdue-borrower-name" style="margin: 0; font-size: 24px; font-weight: bold;"></h2>
                <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">Space दाबून बंद करा | ← → फोटो नेव्हिगेशन</p>
              </div>
              
              <!-- Photo Container -->
              <div id="overdue-photo-container" style="
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                position: relative;
              "></div>
              
              <!-- Navigation Controls -->
              <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 20px;
                padding: 20px;
                background: rgba(0,0,0,0.5);
                border-top: 1px solid rgba(255,255,255,0.2);
              ">
                <button id="overdue-prev-photo" onclick="navigateOverduePhoto(-1)" style="
                  background: rgba(255,255,255,0.1);
                  border: 1px solid rgba(255,255,255,0.3);
                  color: white;
                  padding: 10px 20px;
                  border-radius: 8px;
                  cursor: pointer;
                  font-size: 16px;
                  display: none;
                " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                  ← मागील
                </button>
                
                <div id="overdue-photo-counter" style="
                  background: rgba(255,255,255,0.1);
                  padding: 8px 16px;
                  border-radius: 20px;
                  font-weight: bold;
                  display: none;
                "></div>
                
                <button id="overdue-next-photo" onclick="navigateOverduePhoto(1)" style="
                  background: rgba(255,255,255,0.1);
                  border: 1px solid rgba(255,255,255,0.3);
                  color: white;
                  padding: 10px 20px;
                  border-radius: 8px;
                  cursor: pointer;
                  font-size: 16px;
                  display: none;
                " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                  पुढील →
                </button>
              </div>
            </div>
          </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('overdue-photo-modal');
      }

      const borrowerNameDiv = document.getElementById('overdue-borrower-name');
      const photoContainer = document.getElementById('overdue-photo-container');
      const photoCounter = document.getElementById('overdue-photo-counter');
      const prevBtn = document.getElementById('overdue-prev-photo');
      const nextBtn = document.getElementById('overdue-next-photo');

      // Set borrower name
      if (borrowerNameDiv) {
        borrowerNameDiv.textContent = `📋 ${loan.borrowerName || 'कर्जदार'}`;
      }
      
      // Show loading state
      if (photoContainer) {
        photoContainer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: white;">
            <div style="text-align: center;">
              <div style="border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
              <div>📸 फोटो लोड होत आहेत...</div>
            </div>
          </div>
        `;
      }
      
      modal!.style.display = 'block';

      // Fetch photos from API
      const response = await fetch(`/api/loans/${loan.loanId}/photos`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const photos = await response.json();
      
      // Store photos globally for navigation
      window.overduePhotoUrls = [];
      window.overdueCurrentPhotoIndex = 0;
      
      if (Array.isArray(photos)) {
        window.overduePhotoUrls = photos
          .filter(photo => photo && photo.url)
          .map(photo => photo.url);
      }

      // If no photos available, show message
      if (window.overduePhotoUrls.length === 0) {
        if (photoContainer) {
          photoContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: white; text-align: center;">
              <div>
                <div style="font-size: 48px; margin-bottom: 20px;">📷</div>
                <div style="font-size: 18px;">या कर्जासाठी कोणतेही फोटो उपलब्ध नाहीत</div>
                <div style="margin-top: 10px; font-size: 14px; color: rgba(255,255,255,0.7);">Space दाबून बंद करा</div>
              </div>
            </div>
          `;
        }
        
        // Hide navigation buttons
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        if (photoCounter) photoCounter.style.display = 'none';
        return;
      }

      // Reset photo index
      window.overdueCurrentPhotoIndex = 0;

      // Show/hide navigation buttons
      if (window.overduePhotoUrls.length > 1) {
        if (prevBtn) prevBtn.style.display = 'block';
        if (nextBtn) nextBtn.style.display = 'block';
        if (photoCounter) photoCounter.style.display = 'block';
      } else {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        if (photoCounter) photoCounter.style.display = 'none';
      }

      // Display first photo
      (window as any).displayOverduePhoto(0);
      
    } catch (error) {
      console.error('📸 Photo fetch error:', error);
      const photoContainer = document.getElementById('overdue-photo-container');
      if (photoContainer) {
        photoContainer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: white; text-align: center;">
            <div>
              <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
              <div style="font-size: 18px;">फोटो लोड करताना त्रुटी झाली</div>
              <div style="margin-top: 10px; font-size: 14px; color: rgba(255,255,255,0.7);">कृपया पुन्हा प्रयत्न करा</div>
            </div>
          </div>
        `;
      }
      
      const prevBtn = document.getElementById('overdue-prev-photo');
      const nextBtn = document.getElementById('overdue-next-photo');
      const photoCounter = document.getElementById('overdue-photo-counter');
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      if (photoCounter) photoCounter.style.display = 'none';
    }
  };

  // Add global functions for photo navigation
  useEffect(() => {
    // Define global functions for overdue photo modal
    (window as any).displayOverduePhoto = (index: number) => {
      if (!window.overduePhotoUrls || window.overduePhotoUrls.length === 0) return;

      const photoContainer = document.getElementById('overdue-photo-container');
      const photoCounter = document.getElementById('overdue-photo-counter');
      
      // Ensure index is within bounds
      if (index < 0) window.overdueCurrentPhotoIndex = window.overduePhotoUrls.length - 1;
      else if (index >= window.overduePhotoUrls.length) window.overdueCurrentPhotoIndex = 0;
      else window.overdueCurrentPhotoIndex = index;

      const photoUrl = window.overduePhotoUrls[window.overdueCurrentPhotoIndex];
      
      if (photoContainer) {
        photoContainer.innerHTML = `
          <img 
            src="${photoUrl}" 
            alt="कर्ज फोटो" 
            style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); cursor: zoom-in; opacity: 0; transition: opacity 0.3s ease;" 
            onclick="(function(img) {
              if (img.style.maxWidth === '100%') {
                img.style.maxWidth = '90%';
                img.style.maxHeight = '90%';
                img.style.cursor = 'zoom-in';
                img.style.transform = 'scale(1)';
              } else {
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.cursor = 'zoom-out';
                img.style.transform = 'scale(1.1)';
              }
            })(this)"
            onload="this.style.opacity='1'"
            onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\"color: white; font-size: 18px; text-align: center;\\">📷 फोटो लोड करू शकले नाही</div>'"
          />
        `;
      }

      // Update counter
      if (photoCounter && window.overduePhotoUrls.length > 1) {
        photoCounter.textContent = `${window.overdueCurrentPhotoIndex + 1} / ${window.overduePhotoUrls.length}`;
      }
    };

    (window as any).navigateOverduePhoto = (direction: number) => {
      if (!window.overduePhotoUrls || window.overduePhotoUrls.length <= 1) return;
      
      const newIndex = window.overdueCurrentPhotoIndex + direction;
      (window as any).displayOverduePhoto(newIndex);
    };

    (window as any).closeOverduePhotoModal = () => {
      const modal = document.getElementById('overdue-photo-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    };

    // Global keyboard handler for photo modal
    const handlePhotoModalKeyboard = (event: KeyboardEvent) => {
      const modal = document.getElementById('overdue-photo-modal');
      if (!modal || modal.style.display === 'none') return;

      switch (event.key) {
        case ' ': // Space bar to close
        case 'Escape':
          event.preventDefault();
          event.stopImmediatePropagation(); // Prevent other listeners
          (window as any).closeOverduePhotoModal();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          event.stopImmediatePropagation();
          (window as any).navigateOverduePhoto(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          event.stopImmediatePropagation();
          (window as any).navigateOverduePhoto(1);
          break;
      }
    };

    // Add global keyboard listener
    document.addEventListener('keydown', handlePhotoModalKeyboard);

    // Close modal when clicking outside
    const handleModalClick = (event: MouseEvent) => {
      const modal = document.getElementById('overdue-photo-modal');
      if (modal && event.target === modal) {
        (window as any).closeOverduePhotoModal();
      }
    };

    document.addEventListener('click', handleModalClick);

    return () => {
      document.removeEventListener('keydown', handlePhotoModalKeyboard);
      document.removeEventListener('click', handleModalClick);
    };
  }, []);

  // Setup keyboard navigation
  useEffect(() => {
    if (reportGenerated && overdueData.length > 0) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [reportGenerated, overdueData, selectedRowIndex]);

  // Auto-scroll selected row into view
  useEffect(() => {
    if (selectedRowIndex >= 0) {
      const tableRows = document.querySelectorAll('[data-row-index]');
      const selectedRow = tableRows[selectedRowIndex] as HTMLElement;
      if (selectedRow) {
        selectedRow.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [selectedRowIndex]);

  // Excel export function
  const exportToExcel = () => {
    if (!overdueData || overdueData.length === 0) {
      return;
    }

    const sortedData = [...overdueData].sort((a, b) => {
      const dateA = new Date(a.loanDate).getTime();
      const dateB = new Date(b.loanDate).getTime();
      if (dateA !== dateB) return dateA - dateB;
      if (a.groupName !== b.groupName) return a.groupName.localeCompare(b.groupName);
      if (a.borrowerName !== b.borrowerName) return a.borrowerName.localeCompare(b.borrowerName);
      return a.principalAmount - b.principalAmount;
    });

    // Prepare data for Excel
    const excelData = sortedData.map((item, index) => ({
      'अनुक्रमांक': index + 1,
      'नाव': item.borrowerName,
      'फोन': item.borrowerPhone,
      'गट': item.groupName,
      'तारीख': formatDate(item.loanDate),
      'तारणाचा तपशील': item.goldItem,
      'मुद्दल': item.principalAmount,
      'व्याज': item.interestToDate,
      'एकूण': item.totalAmount,
      'वजन (ग्राम)': item.goldWeight,
      'सोन्याची किंमत': item.currentGoldValue,
      'नुकसान': item.lossAmount,
      'नुकसान %': `${item.lossPercentage}%`,
      'दिवस': item.daysOverdue,
      'जोखीम स्तर': item.riskLevel === 'high' ? 'उच्च' : item.riskLevel === 'medium' ? 'मध्यम' : 'कमी'
    }));

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();

    // Set column widths
    const colWidths = [
      { wch: 10 }, // अनुक्रमांक
      { wch: 20 }, // नाव  
      { wch: 15 }, // फोन
      { wch: 15 }, // गट
      { wch: 12 }, // तारीख
      { wch: 30 }, // तारणाचा तपशील
      { wch: 12 }, // मुद्दल
      { wch: 12 }, // व्याज
      { wch: 12 }, // एकूण
      { wch: 10 }, // वजन
      { wch: 15 }, // सोन्याची किंमत
      { wch: 12 }, // नुकसान
      { wch: 10 }, // नुकसान %
      { wch: 8 },  // दिवस
      { wch: 12 }  // जोखीम स्तर
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Overdue Report");

    // Generate filename with date and mode
    const reportDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const modeText = filters.projectionMode === 'current' ? 'Current' : 'Future';
    const filename = `Overdue_Report_${modeText}_${reportDate}.xlsx`;

    // Export file
    XLSX.writeFile(wb, filename);
  };

  // Utility functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  // Convert ISO date to DD/MM/YY for input fields
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  };

  // Convert DD/MM/YY to ISO format for backend
  const parseInputDate = (ddmmyy: string) => {
    if (!ddmmyy || ddmmyy.length !== 8) return '';
    const day = ddmmyy.substring(0, 2);
    const month = ddmmyy.substring(3, 5);
    const year = ddmmyy.substring(6, 8);
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
    return `${fullYear}-${month}-${day}`;
  };

  const handleGenerateReport = () => {
    if (!filters.dateFrom || !filters.dateTo || !filters.currentGoldRate || !filters.finePurityPercentage) {
      alert("कृपया सर्व आवश्यक फील्ड भरा / Please fill all required fields");
      return;
    }
    generateReport();
    setReportGenerated(true);
  };

  // Auto-scroll to data table when report is loaded
  useEffect(() => {
    if (reportGenerated && !isGenerating && overdueData.length >= 0 && dataTableRef.current) {
      setTimeout(() => {
        dataTableRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }, 300);
    }
  }, [reportGenerated, isGenerating, overdueData, dataTableRef]);

  // Sort overdue data by loss (max loss first), then loan date, then amount
  const filteredOverdueData = [...(overdueData as OverdueItem[])].filter(item => {
    const margin = item.currentGoldValue - item.totalAmount;
    return item.lossAmount > 0 || margin < 1000;
  });
  
  const sortedOverdueData = filteredOverdueData.sort((a, b) => {
    // First sort by loss amount (descending - max loss on top)
    if (b.lossAmount !== a.lossAmount) {
      return b.lossAmount - a.lossAmount;
    }
    // Then by loan date (ascending - older loans first)
    const dateA = new Date(a.loanDate);
    const dateB = new Date(b.loanDate);
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime();
    }
    // Finally by total amount (ascending - smaller amounts first)
    return a.totalAmount - b.totalAmount;
  });

  const totalLoss = sortedOverdueData.reduce((sum: number, item: OverdueItem) => sum + item.lossAmount, 0);
  const totalLoans = sortedOverdueData.length;
  const averageLoss = totalLoans > 0 ? totalLoss / totalLoans : 0;
  const totalAllLoans = (overdueData as OverdueItem[]).length;
  const filteredOutCount = totalAllLoans - totalLoans;

  return (
    <>

      
      <div className="print:hidden">
        <MobileNav />
      </div>
      
      <div className="lg:flex print:block">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 print:hidden">
          <div className="sidebar-modern h-full">
            <Sidebar />
          </div>
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0 print:pl-0 print:pb-0">
          <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4 print:min-h-0 print:bg-white print:p-0">
            <div className="space-y-3 print:max-w-none print:mx-0 print:space-y-0 px-2 lg:px-4">
        {/* Header - Hidden in Print */}
        <div className="flex items-center justify-between bg-white rounded-lg shadow-md p-3 print:hidden">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBackNavigation}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-red-700">
                {filters.projectionMode === 'current' ? '🔍 सध्याचे लॉस रिपोर्ट' : '🔮 भविष्यातील लॉस अंदाज'}
              </h1>
              <p className="text-sm text-gray-600">
                {filters.projectionMode === 'current' ? 
                  'आजच्या तारखेपर्यंत सोन्याच्या कर्जावरील नुकसान विश्लेषण' : 
                  `पुढच्या ${filters.futureProjectionPeriod === '1month' ? 'महिन्यात' : filters.futureProjectionPeriod === '3months' ? 'तीन महिन्यात' : filters.futureProjectionPeriod === '6months' ? 'सहा महिन्यात' : 'वर्षभरात'} कोणती कर्जे नुकसानात येतील`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">Loss Analysis</span>
          </div>
        </div>

        {/* Filters Card - Hidden in Print */}
        <Card className="bg-white shadow-lg print:hidden">
          <CardHeader className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* Projection Mode Selection */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-3 rounded-lg mb-3 border border-purple-200">
              <Label className="text-sm font-semibold text-purple-800 mb-2 block">📊 विश्लेषण प्रकार निवडा</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div 
                  className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${filters.projectionMode === 'current' ? 'border-indigo-500 bg-indigo-100' : 'border-gray-300 bg-white'}`}
                  onClick={() => setFilters(prev => ({ ...prev, projectionMode: 'current' }))}
                >
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={filters.projectionMode === 'current'} 
                      onChange={() => setFilters(prev => ({ ...prev, projectionMode: 'current' }))}
                      className="text-indigo-500"
                      autoComplete="off"
                    />
                    <span className="font-semibold text-indigo-800">🔍 सध्याचे नुकसान विश्लेषण</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">आजच्या तारखेपर्यंत कोणती कर्जे loss मध्ये आहेत</div>
                </div>
                
                <div 
                  className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${filters.projectionMode === 'future' ? 'border-purple-500 bg-purple-100' : 'border-gray-300 bg-white'}`}
                  onClick={() => setFilters(prev => ({ ...prev, projectionMode: 'future' }))}
                >
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={filters.projectionMode === 'future'} 
                      onChange={() => setFilters(prev => ({ ...prev, projectionMode: 'future' }))}
                      className="text-purple-500"
                      autoComplete="off"
                    />
                    <span className="font-semibold text-purple-800">🔮 भविष्यातील नुकसान अंदाज</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">पुढच्या काळात कोणती कर्जे loss मध्ये येतील</div>
                </div>
              </div>
            </div>

            {/* Future Projection Period - Only show if future mode selected */}
            {filters.projectionMode === 'future' && (
              <div className="bg-purple-50 p-3 rounded-lg mb-3 border border-purple-200">
                <Label className="text-sm font-semibold text-purple-800 mb-2 block">⏰ भविष्यातील कालावधी निवडा</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { value: '1month', label: '1 महिना', desc: 'पुढच्या महिन्यात' },
                    { value: '3months', label: '3 महिने', desc: 'पुढच्या तीन महिन्यात' },
                    { value: '6months', label: '6 महिने', desc: 'पुढच्या सहा महिन्यात' },
                    { value: '1year', label: '1 वर्ष', desc: 'पुढच्या वर्षभरात' }
                  ].map((period) => (
                    <div 
                      key={period.value}
                      className={`p-2 rounded-lg border-2 cursor-pointer transition-all text-center ${filters.futureProjectionPeriod === period.value ? 'border-purple-500 bg-purple-200' : 'border-gray-300 bg-white'}`}
                      onClick={() => setFilters(prev => ({ ...prev, futureProjectionPeriod: period.value as any }))}
                    >
                      <div className="font-semibold text-purple-800">{period.label}</div>
                      <div className="text-xs text-gray-600">{period.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-indigo-50 p-3 rounded-lg mb-3">
              <div className="text-[10px] sm:text-xs text-indigo-700 mb-2">
                <strong>नोंद:</strong> {filters.projectionMode === 'current' ? 
                  'या तारखांमध्ये दिलेली कर्जे आजच्या तारखेला नुकसानात आहेत का ते तपासले जाईल' :
                  `या तारखांमध्ये दिलेली कर्जे पुढच्या ${filters.futureProjectionPeriod === '1month' ? 'महिन्यात' : filters.futureProjectionPeriod === '3months' ? 'तीन महिन्यात' : filters.futureProjectionPeriod === '6months' ? 'सहा महिन्यात' : 'वर्षभरात'} नुकसानात येतील का ते दाखवले जाईल`
                }
              </div>
            </div>

            {/* Interest Calculation Formula Display */}
            <div className="bg-green-50 p-3 rounded-lg mb-3 border border-green-200">
              <div className="text-[10px] sm:text-xs text-green-800">
                <strong>📊 व्याज गणना पद्धत:</strong> Advanced Compound Interest (Calculator च्या सारखेच)<br/>
                <strong>📋 नियम:</strong> 2 दिवस झाले तरी पूर्ण महिना कन्सिडर केला जातो<br/>
                <strong>🔄 कंपाउंड:</strong> दर वर्षी व्याज मुळ रकमेत जमा होते (Yearly Compounding)<br/>
                <strong>💡 सध्या:</strong> आजच्या तारखेपर्यंत नुकसान | <strong>🔮 भविष्य:</strong> आजच्या तारखेपासून +6 महिने व्याज
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {/* Date Range */}
              <div>
                <Label className="text-sm font-semibold">पासून तारीख * (कर्ज वितरण)</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="mt-1 font-inter"
                />
                <div className="text-xs text-gray-500 mt-1">डीफॉल्ट: आजची तारीख</div>
              </div>
              <div>
                <Label className="text-sm font-semibold">पर्यंत तारीख * (कर्ज वितरण)</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="mt-1 font-inter"
                />
                <div className="text-xs text-gray-500 mt-1">आजची तारीख: {formatDate(new Date().toISOString())}</div>
              </div>
              
              {/* Group Selection */}
              <div>
                <Label className="text-sm font-semibold">गट निवड</Label>
                <Select 
                  value={filters.groupId} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, groupId: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="सर्व गट / All Groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">सर्व गट / All Groups</SelectItem>
                    {(groups as any[]).map((group: any) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-gray-500 mt-1">सर्व गटांसाठी 'All Groups' निवडा</div>
              </div>

              {/* Current Gold Rate - Now in main row for laptop */}
              <div>
                <Label className="text-orange-700 font-medium">💰 सोन्याचा दर (ग्राम)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="उदा: 7000"
                  value={filters.currentGoldRate || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, currentGoldRate: e.target.value }))}
                  className="mt-1 bg-white border-2 border-orange-300 focus:border-orange-500"
                />
                <div className="text-xs text-orange-600 mt-1">प्रति ग्राम दर</div>
              </div>

              {/* Gold Purity - Now in main row for laptop */}
              <div>
                <Label className="text-green-700 font-medium">⭐ सोन्याची शुद्धता (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="50"
                  max="100"
                  placeholder="उदा: 80"
                  value={filters.finePurityPercentage || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, finePurityPercentage: e.target.value }))}
                  className="mt-1 bg-white border-2 border-green-300 focus:border-green-500"
                />
                <div className="text-xs text-green-600 mt-1">80%, 90%, 91.6% etc</div>
              </div>
            </div>

            {/* Interest Rate Mode in separate compact row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Interest Rate Mode Selection */}
              <div className="space-y-2">
                <Label className="text-orange-700 font-medium">⚙️ व्याज दर पद्धत</Label>
                <Select value={filters.interestRateMode} onValueChange={(value: 'loan-wise' | 'manual') => 
                  setFilters(prev => ({ ...prev, interestRateMode: value }))}>
                  <SelectTrigger className="bg-white border-2 border-orange-300 focus:border-orange-500">
                    <SelectValue placeholder="व्याज दर पद्धत निवडा" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loan-wise">📋 कर्ज नोंदणीतील व्याज दर</SelectItem>
                    <SelectItem value="manual">✏️ मॅन्युअल व्याज दर</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-orange-600 mt-1">
                  {filters.interestRateMode === 'loan-wise' 
                    ? "प्रत्येक कर्जाचा नोंदणी केलेला व्याज दर वापरेल" 
                    : "सर्व कर्जांसाठी एकच व्याज दर वापरेल"}
                </div>
              </div>

              {/* Manual Interest Rate - Only show when manual mode selected */}
              {filters.interestRateMode === 'manual' && (
                <div className="space-y-2">
                  <Label className="text-purple-700 font-medium">📊 मासिक व्याज दर (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    placeholder="उदा: 1.5"
                    value={filters.monthlyInterestRate || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, monthlyInterestRate: e.target.value }))}
                    className="mt-1 bg-white border-2 border-purple-300 focus:border-purple-500"
                  />
                  <div className="text-xs text-purple-600 mt-1">
                    ✏️ उदा: 1.5% किंवा 15 (दोन्ही योग्य) | Both formats supported
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4">
              {/* Clear Button - Left side */}
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setFilters({
                    dateFrom: new Date().toISOString().split('T')[0],
                    dateTo: new Date().toISOString().split('T')[0],
                    groupId: "all",
                    currentGoldRate: "",
                    finePurityPercentage: "",
                    monthlyInterestRate: "",
                    interestRateMode: 'loan-wise',
                    projectionMode: 'current',
                    futureProjectionPeriod: '3months'
                  });
                  setReportGenerated(false); // Clear report
                }}
                className="text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                🗑️ साफ करा
              </Button>
              
              {/* Generate Button - Right side */}
              <Button 
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white px-6 py-2"
              >
                {isGenerating ? "तयार करीत आहे..." : "अहवाल तयार करा"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Professional Report Header - Print Optimized */}
        {reportGenerated && (
          <div ref={reportSectionRef} className="bg-white shadow-lg print:shadow-none print-content">
            {/* Report Header - Only on Screen */}
            <div className="p-4 border-b-2 border-gray-200 print:hidden">
              <div className="text-center">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-800 mb-2">
                  {filters.projectionMode === 'current' ? 'मुदत वाढलेल्या कर्जांचा तपशील' : 'भविष्यातील नुकसान अंदाज रिपोर्ट'}
                </h1>
                <h2 className="text-sm sm:text-lg font-semibold text-gray-600 mb-4">
                  {filters.projectionMode === 'current' ? 'Current Loss Analysis Report' : 
                    `Future Loss Projection - ${filters.futureProjectionPeriod === '1month' ? 'Next Month' : filters.futureProjectionPeriod === '3months' ? 'Next 3 Months' : filters.futureProjectionPeriod === '6months' ? 'Next 6 Months' : 'Next Year'}`
                  }
                </h2>
                
                {/* Report Parameters - Screen Only */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-6 max-w-2xl mx-auto">
                  <div className="text-left">
                    <p><strong>Report Date:</strong> {formatDate(new Date().toISOString())}</p>
                    <p><strong>Analysis Type:</strong> {filters.projectionMode === 'current' ? 'आजच्या दिनांकापर्यंत' : `${filters.futureProjectionPeriod === '1month' ? 'पुढच्या महिन्यात' : filters.futureProjectionPeriod === '3months' ? 'पुढच्या तीन महिन्यात' : filters.futureProjectionPeriod === '6months' ? 'पुढच्या सहा महिन्यात' : 'पुढच्या वर्षभरात'}`}</p>
                    <p><strong>Date Range:</strong> {formatDateForInput(filters.dateFrom)} to {formatDateForInput(filters.dateTo)}</p>
                  </div>
                  <div className="text-left">
                    <p><strong>Gold Rate:</strong> ₹{filters.currentGoldRate}/gram</p>
                    <p><strong>Purity:</strong> {filters.finePurityPercentage}%</p>
                    <p><strong>Interest Mode:</strong> {filters.interestRateMode === 'loan-wise' ? 'कर्ज नोंदणी दरानुसार' : `${filters.monthlyInterestRate}%/month (manual)`}</p>
                  </div>
                </div>
                
                {/* Summary Line - Screen Only */}
                <div className="mt-6 pt-4 border-t border-gray-300">
                  <p className="text-sm sm:text-base font-semibold text-gray-700">
                    Total Loans: {totalLoans} (सुरक्षित वगळले: {filteredOutCount}) | Total Loss: {formatCurrency(totalLoss)} | Average Loss: {formatCurrency(averageLoss)}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Print Header - Professional Layout */}
            <div className="print-only" style={{display: 'none', color: 'black', marginTop: '5px', marginBottom: '15px', padding: '10px', border: '2px solid black'}}>
              {/* Report Title */}
              <div style={{textAlign: 'center', fontSize: '14pt', fontWeight: 'bold', marginBottom: '12px', textDecoration: 'underline'}}>
                {filters.projectionMode === 'current' ? 'मुदत वाढलेल्या कर्जांचा तपशील' : 'भविष्यातील नुकसान अंदाज रिपोर्ट'}
              </div>
              
              {/* Report Details Table */}
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '10px'}}>
                <tbody>
                  <tr>
                    <td style={{fontWeight: 'bold', padding: '4px 8px', border: '1px solid #666', backgroundColor: '#f5f5f5'}}>
                      Report Date:
                    </td>
                    <td style={{padding: '4px 8px', border: '1px solid #666'}}>
                      {formatDate(new Date().toISOString())}
                    </td>
                    <td style={{fontWeight: 'bold', padding: '4px 8px', border: '1px solid #666', backgroundColor: '#f5f5f5'}}>
                      Analysis Type:
                    </td>
                    <td style={{padding: '4px 8px', border: '1px solid #666'}}>
                      {filters.projectionMode === 'current' ? 'आजच्या दिनांकापर्यंत' : `${filters.futureProjectionPeriod === '1month' ? 'पुढच्या महिन्यात' : filters.futureProjectionPeriod === '3months' ? 'पुढच्या तीन महिन्यात' : filters.futureProjectionPeriod === '6months' ? 'पुढच्या सहा महिन्यात' : 'पुढच्या वर्षभरात'}`}
                    </td>
                  </tr>
                  <tr>
                    <td style={{fontWeight: 'bold', padding: '4px 8px', border: '1px solid #666', backgroundColor: '#f5f5f5'}}>
                      Date Range:
                    </td>
                    <td style={{padding: '4px 8px', border: '1px solid #666'}}>
                      {formatDateForInput(filters.dateFrom)} to {formatDateForInput(filters.dateTo)}
                    </td>
                    <td style={{fontWeight: 'bold', padding: '4px 8px', border: '1px solid #666', backgroundColor: '#f5f5f5'}}>
                      Gold Rate:
                    </td>
                    <td style={{padding: '4px 8px', border: '1px solid #666'}}>
                      ₹{filters.currentGoldRate}/gram
                    </td>
                  </tr>
                  <tr>
                    <td style={{fontWeight: 'bold', padding: '4px 8px', border: '1px solid #666', backgroundColor: '#f5f5f5'}}>
                      Purity:
                    </td>
                    <td style={{padding: '4px 8px', border: '1px solid #666'}}>
                      {filters.finePurityPercentage}%
                    </td>
                    <td style={{fontWeight: 'bold', padding: '4px 8px', border: '1px solid #666', backgroundColor: '#f5f5f5'}}>
                      Interest Mode:
                    </td>
                    <td style={{padding: '4px 8px', border: '1px solid #666'}}>
                      {filters.interestRateMode === 'loan-wise' ? 'कर्ज नोंदणी दरानुसार' : `${filters.monthlyInterestRate}%/month (manual)`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Screen Display - Professional Table View */}
            <div ref={dataTableRef} className="print:hidden">
              {(overdueData as OverdueItem[]).length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-gray-500 text-lg">
                    {isGenerating ? "डेटा लोड होत आहे..." : "सध्या कोणतीही सक्रिय कर्जे नुकसानात नाहीत 🎉"}
                  </div>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="sm:hidden divide-y divide-gray-100">
                    {sortedOverdueData.map((item: OverdueItem, index: number) => (
                      <div 
                        key={item.loanId}
                        onClick={() => handleRowSelect(item)}
                        className={cn(
                          "p-3 cursor-pointer transition-colors",
                          selectedRowIndex === index ? "bg-indigo-50 border-l-4 border-l-indigo-500" : "",
                          "active:bg-indigo-50"
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{item.borrowerName}</div>
                            <div className="text-xs text-gray-500">{item.groupName} | {formatDate(item.loanDate)}</div>
                          </div>
                          <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            item.lossAmount > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.lossAmount > 0 ? `नुकसान: ${formatCurrency(item.lossAmount)}` : 'कमी सुरक्षित'}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">मुद्दल</span>
                            <div className="font-semibold text-purple-700">{formatCurrency(item.principalAmount)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">व्याज</span>
                            <div className="font-semibold text-orange-700">{formatCurrency(item.interestToDate)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">एकूण</span>
                            <div className="font-semibold text-indigo-700">{formatCurrency(item.totalAmount)}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                          <div>
                            <span className="text-gray-500">वजन</span>
                            <div className="font-semibold text-amber-700">{item.goldWeight}g</div>
                          </div>
                          <div>
                            <span className="text-gray-500">सोन्याची किंमत</span>
                            <div className="font-semibold text-green-700">{formatCurrency(item.currentGoldValue)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">दिवस</span>
                            <div className="font-semibold text-gray-700">{item.daysOverdue}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-r from-red-50 to-orange-50 border-b-2 border-red-200">
                          <th className="border border-gray-300 px-3 py-3 text-left text-base font-bold text-gray-700">नाव</th>
                          <th className="border border-gray-300 px-3 py-3 text-left text-base font-bold text-gray-700">फोन</th>
                          <th className="border border-gray-300 px-3 py-3 text-left text-base font-bold text-gray-700">गट</th>
                          <th className="border border-gray-300 px-3 py-3 text-center text-base font-bold text-gray-700">तारीख</th>
                          <th className="border border-gray-300 px-3 py-3 text-right text-base font-bold text-gray-700">मुद्दल</th>
                          <th className="border border-gray-300 px-3 py-3 text-right text-base font-bold text-gray-700">व्याज</th>
                          <th className="border border-gray-300 px-3 py-3 text-center text-base font-bold text-gray-700">वजन</th>
                          <th className="border border-gray-300 px-3 py-3 text-right text-base font-bold text-gray-700">सोन्याची किंमत</th>
                          <th className="border border-gray-300 px-3 py-3 text-right text-base font-bold text-gray-700">एकूण</th>
                          <th className="border border-gray-300 px-3 py-3 text-right text-base font-bold text-gray-700">नुकसान</th>
                          <th className="border border-gray-300 px-3 py-3 text-center text-base font-bold text-gray-700">दिवस</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedOverdueData.map((item: OverdueItem, index: number) => (
                          <tr 
                            key={item.loanId} 
                            data-row-index={index}
                            onClick={() => handleRowSelect(item)}
                            className={cn(
                              "cursor-pointer transition-colors border-l-4",
                              selectedRowIndex === index 
                                ? "bg-indigo-100 border-l-indigo-500 ring-2 ring-indigo-200" 
                                : index % 2 === 0 ? 'bg-white border-l-transparent' : 'bg-gray-50 border-l-transparent',
                              "hover:bg-indigo-50 hover:border-l-indigo-300"
                            )}>
                            <td className="border border-gray-300 px-3 py-3 text-base font-bold text-gray-800">{item.borrowerName}</td>
                            <td className="border border-gray-300 px-3 py-3 text-base text-indigo-600 font-medium">{item.borrowerPhone}</td>
                            <td className="border border-gray-300 px-3 py-3 text-base text-gray-600">{item.groupName}</td>
                            <td className="border border-gray-300 px-3 py-3 text-base text-center text-gray-700">{formatDate(item.loanDate)}</td>
                            <td className="border border-gray-300 px-3 py-3 text-base text-right font-semibold text-purple-700">{formatCurrency(item.principalAmount)}</td>
                            <td className="border border-gray-300 px-3 py-3 text-base text-right font-semibold text-orange-700">{formatCurrency(item.interestToDate)}</td>
                            <td className="border border-gray-300 px-3 py-3 text-base text-center font-semibold text-amber-700">{item.goldWeight}</td>
                            <td className="border border-gray-300 px-3 py-3 text-base text-right font-semibold text-green-700">{formatCurrency(item.currentGoldValue)}</td>
                            <td className="border border-gray-300 px-3 py-3 text-base text-right font-bold text-indigo-700">{formatCurrency(item.totalAmount)}</td>
                            <td className={`border border-gray-300 px-3 py-3 text-base text-right font-bold ${item.lossAmount > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                              {item.lossAmount > 0 ? formatCurrency(item.lossAmount) : '✓ सुरक्षित'}
                            </td>
                            <td className="border border-gray-300 px-3 py-3 text-base text-center text-gray-700">{item.daysOverdue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>

            {/* Print Table - Professional Complete Details */}
            <div className="print-only" style={{display: 'none'}}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '8pt',
                color: 'black',
                fontFamily: 'Arial, sans-serif'
              }}>
                <thead>
                  <tr style={{backgroundColor: '#f5f5f5'}}>
                    <th style={{border: '1px solid black', padding: '5px', fontWeight: 'bold', textAlign: 'left', width: '12%'}}>नाव</th>
                    <th style={{border: '1px solid black', padding: '5px', fontWeight: 'bold', textAlign: 'left', width: '8%'}}>फोन</th>
                    <th style={{border: '1px solid black', padding: '5px', fontWeight: 'bold', textAlign: 'left', width: '8%'}}>गट</th>
                    <th style={{border: '1px solid black', padding: '5px', fontWeight: 'bold', textAlign: 'center', width: '7%'}}>तारीख</th>
                    <th style={{border: '1px solid black', padding: '5px', fontWeight: 'bold', textAlign: 'right', width: '8%'}}>मुद्दल</th>
                    <th style={{border: '1px solid black', padding: '5px', fontWeight: 'bold', textAlign: 'right', width: '8%'}}>व्याज</th>
                    <th style={{border: '1px solid black', padding: '5px', fontWeight: 'bold', textAlign: 'center', width: '6%'}}>वजन</th>
                    <th style={{border: '1px solid black', padding: '5px', fontWeight: 'bold', textAlign: 'right', width: '8%'}}>सोन्याची किंमत</th>
                    <th style={{border: '1px solid black', padding: '5px', fontWeight: 'bold', textAlign: 'right', width: '8%'}}>एकूण</th>
                    <th style={{border: '1px solid black', padding: '5px', fontWeight: 'bold', textAlign: 'right', width: '8%'}}>नुकसान</th>
                    <th style={{border: '1px solid black', padding: '5px', fontWeight: 'bold', textAlign: 'center', width: '6%'}}>दिवस</th>
                  </tr>
                </thead>
                <tbody>
                  {(overdueData as OverdueItem[]).length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{border: '1px solid black', padding: '10px', textAlign: 'center', color: 'black'}}>
                        {isGenerating ? "डेटा लोड होत आहे..." : "सक्रिय कर्जे नाहीत / No Active Loans"}
                      </td>
                    </tr>
                  ) : (
                    sortedOverdueData.map((item: OverdueItem) => (
                      <tr key={item.loanId} style={{backgroundColor: 'white'}}>
                        <td style={{border: '1px solid black', padding: '3px', fontWeight: 'bold'}}>{item.borrowerName}</td>
                        <td style={{border: '1px solid black', padding: '3px'}}>{item.borrowerPhone}</td>
                        <td style={{border: '1px solid black', padding: '3px'}}>{item.groupName}</td>
                        <td style={{border: '1px solid black', padding: '3px', textAlign: 'center'}}>{formatDate(item.loanDate)}</td>
                        <td style={{border: '1px solid black', padding: '3px', textAlign: 'right'}}>{formatCurrency(item.principalAmount)}</td>
                        <td style={{border: '1px solid black', padding: '3px', textAlign: 'right'}}>{formatCurrency(item.interestToDate)}</td>
                        <td style={{border: '1px solid black', padding: '3px', textAlign: 'center'}}>{item.goldWeight}</td>
                        <td style={{border: '1px solid black', padding: '3px', textAlign: 'right'}}>{formatCurrency(item.currentGoldValue)}</td>
                        <td style={{border: '1px solid black', padding: '3px', textAlign: 'right', fontWeight: 'bold'}}>{formatCurrency(item.totalAmount)}</td>
                        <td style={{border: '1px solid black', padding: '3px', textAlign: 'right', fontWeight: 'bold', color: item.lossAmount > 0 ? 'red' : 'green'}}>
                          {item.lossAmount > 0 ? formatCurrency(item.lossAmount) : '✓'}
                        </td>
                        <td style={{border: '1px solid black', padding: '3px', textAlign: 'center'}}>{item.daysOverdue}</td>
                      </tr>
                    ))
                  )}
                  {/* Summary Row - Only show when there's data */}
                  {(overdueData as OverdueItem[]).length > 0 && (
                    <tr style={{backgroundColor: '#f8f9fa', borderTop: '2px solid black'}}>
                      <td colSpan={11} style={{
                        border: '1px solid black', 
                        padding: '8px', 
                        textAlign: 'center', 
                        fontWeight: 'bold', 
                        fontSize: '9pt',
                        color: 'black'
                      }}>
                        Total Loans: {totalLoans} (सुरक्षित वगळले: {filteredOutCount}) | Total Loss: {formatCurrency(totalLoss)} | Average Loss: {formatCurrency(averageLoss)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Export Buttons */}
            <div className="mt-6 text-center print:hidden space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Button 
                  onClick={() => window.print()}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Report
                </Button>
                <Button 
                  onClick={exportToExcel}
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-2 flex items-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel Export
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Compact Loan Details Modal */}
        {selectedLoan && (
          <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-noto flex items-center gap-2 text-lg">
                  <Eye className="h-5 w-5 text-indigo-600" />
                  कर्ज तपशील - {selectedLoan.borrowerName}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Essential Loan Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gradient-to-r from-indigo-50 to-indigo-50 rounded-lg border border-indigo-200">
                  <div>
                    <Label className="text-sm font-semibold text-indigo-700">तारणाचा तपशील</Label>
                    <p className="text-base font-medium text-gray-800 mt-1">{selectedLoan.goldItem}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-orange-700">व्याज दर</Label>
                    <p className="text-base font-medium text-gray-800 mt-1">
                      {filters.interestRateMode === 'loan-wise' 
                        ? "कर्ज नोंदणीतील दर" 
                        : `${filters.monthlyInterestRate}% मासिक`
                      }
                    </p>
                  </div>
                </div>

                {/* Photo Viewer Component */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <PhotoViewer 
                    loanId={selectedLoan.loanId} 
                    loanAccountNumber={selectedLoan.loanId.slice(-6)}
                    readonly={true}
                  />
                </div>

                {/* Close Button */}
                <div className="flex justify-center pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDetailsModal(false)}
                    className="min-h-[44px] px-6 touch-manipulation"
                  >
                    बंद करा
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Keyboard Navigation Help */}
        {reportGenerated && overdueData.length > 0 && (
          <div className="hidden sm:block mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200 print:hidden">
            <div className="text-xs text-indigo-700">
              <strong>⌨️ Keyboard Navigation:</strong> Use ↑↓ arrows to navigate rows, Enter to view details, <strong>Space for photos</strong>, Escape to close
            </div>
          </div>
        )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}