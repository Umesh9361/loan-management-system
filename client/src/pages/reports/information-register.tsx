import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { DateUtils } from "@/lib/date-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, FileDown, ClipboardList, ArrowLeft, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface RegisterEntry {
  srNo: number;
  borrowerName: string;
  borrowerAddress: string;
  loanDate: string;
  principalAmount: string;
  interestRate: string;
  interestRateType: string;
  loanType: string;
  accountNumber: string;
  status: string;
  closureDate: string | null;
  principalPaid: string | null;
  interestPaid: string | null;
  isClosed: boolean;
}

export default function InformationRegister() {
  const [dateFilters, setDateFilters] = useState({
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });
  const [pdfLoading, setPdfLoading] = useState(false);
  const [demoData, setDemoData] = useState<RegisterEntry[] | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);
  const selectedPrintRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { safeNavigate } = useSafeNavigation();

  const { data: company } = useQuery<any>({
    queryKey: ["/api/company"],
  });

  const { data: registerData, isLoading, refetch } = useQuery<RegisterEntry[]>({
    queryKey: ["/api/reports/information-register", dateFilters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateFilters.dateFrom) params.append('dateFrom', dateFilters.dateFrom);
      if (dateFilters.dateTo) params.append('dateTo', dateFilters.dateTo);
      return fetch(`/api/reports/information-register?${params}`, { credentials: 'include' }).then(r => r.json());
    },
    enabled: false,
  });

  const handleFilter = async () => {
    setDemoData(null);
    setSelectedRows(new Set());
    await refetch();
  };

  const generateDemoData = () => {
    const randomNames = [
      { name: 'रामचंद्र विठ्ठल जाधव', address: 'पुणे' },
      { name: 'सुनीता भगवान पवार', address: 'सातारा' },
      { name: 'गणेश दत्तात्रय शिंदे', address: 'कोल्हापूर' },
      { name: 'प्रकाश शंकर माळी', address: 'सांगली' },
      { name: 'लक्ष्मी नारायण कुलकर्णी', address: 'सोलापूर' },
      { name: 'अनिल विश्वनाथ देशमुख', address: 'नाशिक' },
      { name: 'मंगल तुकाराम गायकवाड', address: 'अहमदनगर' },
      { name: 'विजय बाबूराव पाटील', address: 'बारामती' },
      { name: 'सरोज दिनकर भोसले', address: 'औरंगाबाद' },
      { name: 'दिलीप ज्ञानेश्वर कांबळे', address: 'लातूर' },
    ];

    const shuffled = [...randomNames].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 5);

    const currentYear = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const fyStart = new Date(currentYear, 3, 1);

    const randomDate = (start: Date, end: Date) => {
      const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
      return d.toISOString().split('T')[0];
    };

    const today = new Date();
    const loanAmounts = [50000, 75000, 100000, 25000, 150000, 30000, 60000, 80000, 40000, 120000];
    const rates = ['2', '3', '1.5', '2.5', '1'];

    const demoEntries: RegisterEntry[] = selected.map((person, i) => {
      const loanDate = randomDate(fyStart, today);
      const amount = loanAmounts[Math.floor(Math.random() * loanAmounts.length)];
      const rate = rates[Math.floor(Math.random() * rates.length)];
      return {
        srNo: i + 1,
        borrowerName: person.name,
        borrowerAddress: person.address,
        loanDate,
        principalAmount: amount.toString(),
        interestRate: rate,
        interestRateType: 'monthly',
        loanType: 'तारण',
        accountNumber: `${i + 1}`,
        status: 'active',
        closureDate: null,
        principalPaid: null,
        interestPaid: null,
        isClosed: false,
      };
    });

    setDemoData(demoEntries);
    setSelectedRows(new Set());
    setDateFilters({
      dateFrom: `${currentYear}-04-01`,
      dateTo: `${currentYear + 1}-03-31`,
    });
    toast({ title: "रँडम ५ नाव", description: "डेमो रिपोर्ट तयार झाला" });
    setTimeout(() => {
      printRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const displayData = demoData || registerData;

  const toggleRow = (srNo: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(srNo)) next.delete(srNo);
      else next.add(srNo);
      return next;
    });
  };

  const toggleAll = () => {
    if (!displayData) return;
    if (selectedRows.size === displayData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(displayData.map(e => e.srNo)));
    }
  };

  const isAllSelected = displayData ? selectedRows.size === displayData.length && displayData.length > 0 : false;
  const hasSelection = selectedRows.size > 0;

  const getSelectedData = (): RegisterEntry[] => {
    if (!displayData) return [];
    if (!hasSelection) return displayData;
    return displayData
      .filter(e => selectedRows.has(e.srNo))
      .map((e, i) => ({ ...e, srNo: i + 1 }));
  };

  const handlePrint = () => {
    if (!displayData || displayData.length === 0) {
      toast({ title: "डेटा नाही", description: "प्रिंट करण्यासाठी आधी शोधा किंवा रँडम ५ नाव बटण दाबा", variant: "destructive" });
      return;
    }
    if (hasSelection) {
      const printContent = selectedPrintRef.current;
      if (!printContent) return;
      printContent.style.display = 'block';
      setTimeout(() => {
        window.print();
        setTimeout(() => { printContent.style.display = 'none'; }, 500);
      }, 100);
    } else {
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    if (!displayData || displayData.length === 0) {
      toast({ title: "डेटा नाही", description: "PDF साठी आधी शोधा किंवा रँडम ५ नाव बटण दाबा", variant: "destructive" });
      return;
    }
    
    setPdfLoading(true);
    try {
      const landscapeWidthPx = 1122;
      const landscapeHeightPx = 794;

      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = landscapeWidthPx + 'px';
      wrapper.style.zIndex = '-9999';
      wrapper.style.pointerEvents = 'none';
      wrapper.style.overflow = 'visible';
      wrapper.style.background = 'white';

      const source = hasSelection ? selectedPrintRef.current : printRef.current;
      if (!source) { setPdfLoading(false); return; }
      if (hasSelection) source.style.display = 'block';

      const cloned = source.cloneNode(true) as HTMLElement;
      cloned.style.width = landscapeWidthPx + 'px';
      cloned.style.minWidth = landscapeWidthPx + 'px';
      cloned.style.padding = '70px 25px 20px 25px';
      cloned.style.background = 'white';
      cloned.style.fontSize = '12px';

      const table = cloned.querySelector('.register-table') as HTMLElement;
      if (table) {
        table.style.minWidth = '100%';
        table.style.width = '100%';
        table.style.fontSize = '11px';
      }

      const scrollWrapper = cloned.querySelector('.ir-table-scroll') as HTMLElement;
      if (scrollWrapper) {
        scrollWrapper.style.overflow = 'visible';
        scrollWrapper.style.border = 'none';
      }

      cloned.querySelectorAll('.no-print, .ir-col-check').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      wrapper.appendChild(cloned);
      document.body.appendChild(wrapper);

      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: landscapeWidthPx,
        windowWidth: landscapeWidthPx,
      });

      document.body.removeChild(wrapper);
      if (hasSelection && selectedPrintRef.current) selectedPrintRef.current.style.display = 'none';

      const imgData = canvas.toDataURL('image/png');
      const imgHeight = (canvas.height * 297) / canvas.width;
      
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      doc.addImage(imgData, 'PNG', 0, 0, 297, imgHeight);

      const fileName = `माहिती_तक्ता_${DateUtils.formatDate(dateFilters.dateFrom)}_ते_${DateUtils.formatDate(dateFilters.dateTo)}.pdf`;
      doc.save(fileName);

      toast({ title: "PDF तयार झाला", description: "फाइल डाउनलोड होत आहे" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: "PDF त्रुटी", description: "PDF तयार करताना समस्या आली", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  const formatAmount = (val: string | null) => {
    if (!val) return '.......';
    const num = parseFloat(val);
    if (isNaN(num)) return '.......';
    if (num % 1 === 0) {
      return num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (val: string | null) => {
    if (!val) return '.......';
    return DateUtils.formatDate(val);
  };

  const getLoanTypeLabel = (type: string) => {
    return type || 'विनातारण';
  };

  const getInterestDisplay = (rate: string, rateType: string) => {
    const r = parseFloat(rate);
    return `${r}%`;
  };

  return (
    <>
    <style>{`
      .ir-page-content {
        padding: 12px;
      }
      @media (min-width: 1024px) {
        .ir-page-content {
          padding: 24px;
        }
      }

      .register-header {
        text-align: center;
        margin-bottom: 10px;
        padding: 8px 14px;
        border: 2px solid #333;
        background: #fafbfc;
        border-radius: 4px;
      }
      .register-title {
        font-size: 13px;
        font-weight: 700;
        margin: 0;
        color: #1a1a1a;
      }
      @media (min-width: 1024px) {
        .register-title { font-size: 15px; }
      }

      .ir-table-scroll {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        border-radius: 6px;
        border: 1.5px solid #333;
      }

      .register-table {
        min-width: 1080px;
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
        background: #fff;
        table-layout: fixed;
      }
      @media (min-width: 1024px) {
        .register-table {
          font-size: 12px;
          min-width: 100%;
        }
      }

      .register-table th,
      .register-table td {
        border: 1px solid #555;
        padding: 4px 5px;
        vertical-align: middle;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }
      @media (min-width: 1024px) {
        .register-table th,
        .register-table td {
          border: 1.5px solid #444;
          padding: 6px 8px;
        }
      }

      .register-table thead th {
        background: #eef2ff;
        font-weight: 700;
        text-align: center;
        font-size: 10px;
        line-height: 1.3;
        color: #312e81;
        white-space: normal;
      }
      @media (min-width: 1024px) {
        .register-table thead th {
          font-size: 11.5px;
          line-height: 1.35;
        }
      }

      .register-table tbody tr:nth-child(even) {
        background: #f8fafc;
      }
      .register-table tbody tr:hover {
        background: #eef2ff;
      }

      .ir-col-sr { width: 35px; min-width: 35px; }
      .ir-col-name { width: 185px; min-width: 165px; }
      .ir-col-date { width: 82px; min-width: 78px; }
      .ir-col-amount { width: 100px; min-width: 88px; }
      .ir-col-recovery-header { text-align: center !important; }
      .ir-col-rdate { width: 82px; min-width: 78px; }
      .ir-col-rprincipal { width: 100px; min-width: 88px; }
      .ir-col-rinterest { width: 85px; min-width: 78px; }
      .ir-col-rate { width: 52px; min-width: 48px; }
      .ir-col-type { width: 72px; min-width: 66px; }
      .ir-col-acc { width: 48px; min-width: 42px; }
      .ir-col-status { width: 78px; min-width: 72px; }

      .ir-td-center { text-align: center; }
      .ir-td-right { text-align: right; font-variant-numeric: tabular-nums; }
      .ir-td-bold { font-weight: 600; }
      .ir-td-name {
        text-align: left;
        line-height: 1.25;
      }
      .ir-address {
        font-size: 9px;
        color: #666;
        margin-top: 1px;
        line-height: 1.15;
      }
      @media (min-width: 1024px) {
        .ir-address { font-size: 10.5px; }
      }

      .ir-status-closed {
        color: #16a34a;
        font-weight: 700;
      }
      .ir-status-open {
        color: #9ca3af;
        font-size: 10px;
      }

      .register-footer {
        display: flex;
        justify-content: space-between;
        margin-top: 24px;
        padding: 0 12px;
        font-size: 11px;
        color: #333;
      }
      .footer-right {
        margin-right: 15%;
      }
      @media (min-width: 1024px) {
        .register-footer {
          margin-top: 35px;
          padding: 0 20px;
          font-size: 12px;
        }
        .footer-right {
          margin-right: 20%;
        }
      }
      .footer-left p, .footer-right p { margin: 2px 0; }
      .ir-underline-space {
        border-bottom: 1px solid #333;
        display: inline-block;
        min-width: 180px;
      }

      .ir-col-check {
        width: 32px !important;
        min-width: 32px !important;
        max-width: 32px !important;
        text-align: center;
        padding: 2px !important;
      }
      .ir-row-selected {
        background: #eef2ff !important;
      }
      .ir-selected-print {
        display: none;
      }

      @media print {
        @page {
          size: A4 landscape;
          margin: 25mm 12mm 10mm 12mm;
        }
        body * { visibility: hidden; }
        .ir-selected-print[style*="display: block"],
        .ir-selected-print[style*="display: block"] * {
          visibility: visible !important;
        }
        .info-register-print, .info-register-print * { visibility: visible; }
        .ir-selected-print[style*="display: block"] {
          position: absolute; left: 0; top: 0; width: 100%;
        }
        .info-register-print {
          position: absolute; left: 0; top: 0; width: 100%;
        }
        .ir-selected-print[style*="display: block"] ~ .info-register-print,
        .ir-selected-print[style*="display: block"] ~ .info-register-print * {
          visibility: hidden !important;
          display: none !important;
        }
        .no-print, .ir-filter-section, .ir-col-check { display: none !important; }
        .ir-table-scroll { overflow: visible; border: none; border-radius: 0; }
        .register-header { border: 2px solid #000; border-radius: 0; }
        .register-table { font-size: 11px; min-width: 100%; }
        .register-table th {
          font-size: 10px; padding: 4px 5px;
          background: #eef2ff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .register-table td { padding: 4px 5px; font-size: 11px; }
        .register-table th, .register-table td { border: 1.5px solid #000 !important; }
        .ir-address { font-size: 9px; }
        .register-footer { margin-top: 20mm; font-size: 11px; }
        .register-table tbody tr:nth-child(even) { background: #f8fafc !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    `}</style>

    <div className="min-h-screen bg-gray-50">
      <MobileNav />

      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen print:hidden">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="ir-page-content">

            <div className="ir-filter-section no-print">
              <div className="mb-5 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl shadow-md">
                      <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-0.5">माहिती तक्ता</h1>
                      <p className="text-xs sm:text-sm text-gray-500">सर्व कर्ज नोंदणी माहिती - कालावधीनुसार</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => safeNavigate('/')}
                    className="hidden sm:flex self-end sm:self-auto border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    मुख्य पान
                  </Button>
                </div>
              </div>

              <Card className="mb-4 border border-indigo-100 shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-3 sm:p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 items-end">
                    <div>
                      <Label htmlFor="dateFrom" className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">पासून तारीख</Label>
                      <Input
                        id="dateFrom"
                        type="date"
                        className="h-10 sm:h-9 text-sm border-gray-300 focus:border-indigo-400 focus:ring-indigo-400"
                        value={dateFilters.dateFrom}
                        onChange={(e) => setDateFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dateTo" className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">पर्यंत तारीख</Label>
                      <Input
                        id="dateTo"
                        type="date"
                        className="h-10 sm:h-9 text-sm border-gray-300 focus:border-indigo-400 focus:ring-indigo-400"
                        value={dateFilters.dateTo}
                        onChange={(e) => setDateFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Button
                        onClick={handleFilter}
                        className="w-full h-10 sm:h-9 text-sm font-medium bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-sm rounded-lg active:scale-[0.98] transition-transform"
                        disabled={isLoading}
                      >
                        {isLoading ? 'लोड होत आहे...' : 'शोधा'}
                      </Button>
                    </div>
                    <div>
                      <Button
                        onClick={generateDemoData}
                        variant="outline"
                        className="w-full h-10 sm:h-9 text-sm font-medium border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-400 shadow-sm rounded-lg active:scale-[0.98] transition-transform"
                      >
                        रँडम ५ नाव
                      </Button>
                    </div>
                    <div className="flex gap-2 col-span-2 sm:col-span-1">
                      <Button onClick={handlePrint} variant="outline" size="sm" className="flex-1 h-10 sm:h-9 text-xs sm:text-sm border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                        <Printer className="h-3.5 w-3.5 mr-1" />
                        प्रिंट
                      </Button>
                      <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="flex-1 h-10 sm:h-9 text-xs sm:text-sm border-indigo-200 text-indigo-600 hover:bg-indigo-50" disabled={pdfLoading}>
                        <FileDown className="h-3.5 w-3.5 mr-1" />
                        {pdfLoading ? '...' : 'PDF'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {displayData && displayData.length > 0 ? (
              <>
              {hasSelection && (
                <div className="no-print mb-3 flex items-center gap-3 px-1">
                  <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                    <CheckSquare className="h-4 w-4" />
                    <span className="font-medium">{selectedRows.size} निवडलेले</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRows(new Set())}
                    className="text-xs text-gray-500 hover:text-red-500"
                  >
                    निवड रद्द करा
                  </Button>
                  <span className="text-xs text-gray-400">
                    (निवडलेले records चे print / PDF होईल)
                  </span>
                </div>
              )}

              <div className="info-register-print" ref={printRef}>
                <div className="register-header">
                  <p className="register-title">
                    सावकाराचे नांव :- {company?.name || ''} &nbsp;&nbsp; सावकारी लायसन नंबर :- {company?.licenseNumber || ''}
                  </p>
                </div>

                <div className="ir-table-scroll">
                  <table className="register-table">
                    <thead>
                      <tr>
                        <th rowSpan={2} className="ir-col-check no-print" style={{width:'32px',minWidth:'32px'}}>
                          <Checkbox checked={isAllSelected} onCheckedChange={toggleAll} className="border-indigo-400" />
                        </th>
                        <th rowSpan={2} className="ir-col-sr">अ.<br/>नं.</th>
                        <th rowSpan={2} className="ir-col-name">कर्जदाराचे पूर्ण नांव व<br/>पत्ता</th>
                        <th rowSpan={2} className="ir-col-date">कर्जाची<br/>तारीख</th>
                        <th rowSpan={2} className="ir-col-amount">कर्जाची<br/>रक्कम<br/>रुपये</th>
                        <th colSpan={3} className="ir-col-recovery-header">वसूल रक्कम रुपये</th>
                        <th rowSpan={2} className="ir-col-rate">व्याज<br/>दर %</th>
                        <th rowSpan={2} className="ir-col-type">तारणी की<br/>बिगर<br/>तारणी</th>
                        <th rowSpan={2} className="ir-col-acc">खाते<br/>नं.</th>
                        <th rowSpan={2} className="ir-col-status">तारण माल<br/>परत केला<br/>आहे का?</th>
                      </tr>
                      <tr>
                        <th className="ir-col-rdate">तारीख</th>
                        <th className="ir-col-rprincipal">मुद्दल</th>
                        <th className="ir-col-rinterest">व्याज</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayData.map((entry) => (
                        <tr key={entry.srNo} className={selectedRows.has(entry.srNo) ? 'ir-row-selected' : ''}>
                          <td className="ir-td-center no-print" style={{width:'32px',minWidth:'32px'}}>
                            <Checkbox
                              checked={selectedRows.has(entry.srNo)}
                              onCheckedChange={() => toggleRow(entry.srNo)}
                              className="border-gray-400"
                            />
                          </td>
                          <td className="ir-td-center">{entry.srNo}</td>
                          <td className="ir-td-name">
                            <strong>{entry.borrowerName}</strong>
                            {entry.borrowerAddress && (
                              <div className="ir-address">{entry.borrowerAddress}</div>
                            )}
                          </td>
                          <td className="ir-td-center">{formatDate(entry.loanDate)}</td>
                          <td className="ir-td-right">{formatAmount(entry.principalAmount)}</td>
                          <td className="ir-td-center">{entry.isClosed ? formatDate(entry.closureDate) : '.......'}</td>
                          <td className="ir-td-right">{entry.isClosed ? formatAmount(entry.principalPaid) : '.......'}</td>
                          <td className="ir-td-right">{entry.isClosed ? formatAmount(entry.interestPaid) : '.......'}</td>
                          <td className="ir-td-center">{getInterestDisplay(entry.interestRate, entry.interestRateType)}</td>
                          <td className="ir-td-center">{getLoanTypeLabel(entry.loanType)}</td>
                          <td className="ir-td-center">{entry.accountNumber}</td>
                          <td className={`ir-td-center ${entry.isClosed ? 'ir-status-closed' : 'ir-status-open'}`}>
                            {entry.isClosed ? 'होय' : 'लागू नाही'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="register-footer">
                  <div className="footer-left">
                    <p>सावकाराचे सहा. निबंधक तथा उपनिबंधक</p>
                    <p>सह. संस्था, <span className="ir-underline-space">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
                  </div>
                  <div className="footer-right">
                    <p>सावकाराची सही</p>
                  </div>
                </div>
              </div>

              <div ref={selectedPrintRef} className="info-register-print ir-selected-print" style={{display:'none'}}>
                <div className="register-header">
                  <p className="register-title">
                    सावकाराचे नांव :- {company?.name || ''} &nbsp;&nbsp; सावकारी लायसन नंबर :- {company?.licenseNumber || ''}
                  </p>
                </div>
                <div className="ir-table-scroll">
                  <table className="register-table">
                    <thead>
                      <tr>
                        <th rowSpan={2} className="ir-col-sr">अ.<br/>नं.</th>
                        <th rowSpan={2} className="ir-col-name">कर्जदाराचे पूर्ण नांव व<br/>पत्ता</th>
                        <th rowSpan={2} className="ir-col-date">कर्जाची<br/>तारीख</th>
                        <th rowSpan={2} className="ir-col-amount">कर्जाची<br/>रक्कम<br/>रुपये</th>
                        <th colSpan={3} className="ir-col-recovery-header">वसूल रक्कम रुपये</th>
                        <th rowSpan={2} className="ir-col-rate">व्याज<br/>दर %</th>
                        <th rowSpan={2} className="ir-col-type">तारणी की<br/>बिगर<br/>तारणी</th>
                        <th rowSpan={2} className="ir-col-acc">खाते<br/>नं.</th>
                        <th rowSpan={2} className="ir-col-status">तारण माल<br/>परत केला<br/>आहे का?</th>
                      </tr>
                      <tr>
                        <th className="ir-col-rdate">तारीख</th>
                        <th className="ir-col-rprincipal">मुद्दल</th>
                        <th className="ir-col-rinterest">व्याज</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSelectedData().map((entry) => (
                        <tr key={entry.srNo}>
                          <td className="ir-td-center">{entry.srNo}</td>
                          <td className="ir-td-name">
                            <strong>{entry.borrowerName}</strong>
                            {entry.borrowerAddress && (
                              <div className="ir-address">{entry.borrowerAddress}</div>
                            )}
                          </td>
                          <td className="ir-td-center">{formatDate(entry.loanDate)}</td>
                          <td className="ir-td-right">{formatAmount(entry.principalAmount)}</td>
                          <td className="ir-td-center">{entry.isClosed ? formatDate(entry.closureDate) : '.......'}</td>
                          <td className="ir-td-right">{entry.isClosed ? formatAmount(entry.principalPaid) : '.......'}</td>
                          <td className="ir-td-right">{entry.isClosed ? formatAmount(entry.interestPaid) : '.......'}</td>
                          <td className="ir-td-center">{getInterestDisplay(entry.interestRate, entry.interestRateType)}</td>
                          <td className="ir-td-center">{getLoanTypeLabel(entry.loanType)}</td>
                          <td className="ir-td-center">{entry.accountNumber}</td>
                          <td className={`ir-td-center ${entry.isClosed ? 'ir-status-closed' : 'ir-status-open'}`}>
                            {entry.isClosed ? 'होय' : 'लागू नाही'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="register-footer">
                  <div className="footer-left">
                    <p>सावकाराचे सहा. निबंधक तथा उपनिबंधक</p>
                    <p>सह. संस्था, <span className="ir-underline-space">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
                  </div>
                  <div className="footer-right">
                    <p>सावकाराची सही</p>
                  </div>
                </div>
              </div>
              </>

            ) : (registerData && registerData.length === 0 && !demoData) ? (
              <Card className="border border-dashed border-indigo-200 bg-indigo-50/30">
                <CardContent className="py-12 text-center">
                  <ClipboardList className="h-12 w-12 text-indigo-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">या कालावधीत कोणतेही कर्ज आढळले नाही</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-dashed border-gray-200 bg-gray-50/50">
                <CardContent className="py-12 text-center">
                  <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">माहिती तक्ता पाहण्यासाठी तारीख निवडा आणि शोधा बटण दाबा</p>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
    </>
  );
}
