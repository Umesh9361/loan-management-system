import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Printer, TrendingUp, TrendingDown, DollarSign, Receipt, ArrowUpRight, ArrowDownRight, BarChart3, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import jsPDF from "jspdf";

function getDefaultFY() {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    dateFrom: `${currentYear}-04-01`,
    dateTo: `${currentYear + 1}-03-31`,
    fyLabel: `${currentYear}-${currentYear + 1}`,
  };
}

function formatCurrency(amount: number): string {
  if (amount === 0) return "0";
  return Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function buildProfitLossHTML(plData: any, company: any, dateFrom: string, dateTo: string): string {
  const fc = (amount: number) => {
    if (amount === 0) return "0";
    return Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  const fd = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  let incomeRows = "";
  incomeRows += `<tr><td style="padding:6px 8px 6px 16px;border-bottom:1px solid #ddd;font-weight:600;">व्याज उत्पन्न (Interest Income)</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;font-weight:600;">${fc(plData.income.interestIncome)}</td></tr>`;

  if (plData.income.otherIncomeItems?.length > 0) {
    for (const item of plData.income.otherIncomeItems) {
      incomeRows += `<tr><td style="padding:5px 8px 5px 16px;border-bottom:1px solid #ddd;">${item.name}</td><td style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:right;">${fc(item.amount)}</td></tr>`;
    }
  }

  incomeRows += `<tr style="border-top:2px solid #000;font-weight:bold;background:#f0f0f0;"><td style="padding:8px;">एकूण उत्पन्न (A)</td><td style="padding:8px;text-align:right;">${fc(plData.income.totalIncome)}</td></tr>`;

  let expenseRows = "";
  if (plData.expenses.items?.length > 0) {
    for (const item of plData.expenses.items) {
      expenseRows += `<tr><td style="padding:5px 8px 5px 16px;border-bottom:1px solid #ddd;">${item.name}</td><td style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:right;">${fc(item.amount)}</td></tr>`;
    }
  } else {
    expenseRows += `<tr><td colspan="2" style="padding:10px;text-align:center;color:#999;">या कालावधीत खर्च नाही</td></tr>`;
  }

  expenseRows += `<tr style="border-top:2px solid #000;font-weight:bold;background:#f0f0f0;"><td style="padding:8px;">एकूण खर्च (B)</td><td style="padding:8px;text-align:right;">${fc(plData.expenses.totalExpenses)}</td></tr>`;

  const netLabel = plData.isProfit ? "निव्वळ नफा (A - B)" : "निव्वळ तोटा (B - A)";

  return `
    <div style="font-family:'Noto Sans Devanagari',sans-serif;color:#000;background:#fff;padding:20px 15px;box-sizing:border-box;width:100%;">
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px;">
        <h2 style="font-size:16pt;font-weight:bold;margin:0 0 4px 0;">${company?.name || ""}</h2>
        ${company?.address ? `<p style="font-size:10pt;margin:0 0 2px 0;">${company.address}</p>` : ""}
        ${company?.registrationNumber ? `<p style="font-size:9pt;margin:0 0 6px 0;">नोंदणी क्र.: ${company.registrationNumber}</p>` : ""}
        <div style="border-top:1px solid #999;padding-top:8px;margin-top:4px;">
          <h3 style="font-size:14pt;font-weight:bold;margin:0 0 4px 0;">नफा-तोटा पत्रक (Profit & Loss Statement)</h3>
          <p style="font-size:10pt;margin:0;">कालावधी: ${fd(dateFrom)} ते ${fd(dateTo)}</p>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:10pt;border:1px solid #000;margin-bottom:10px;">
        <thead>
          <tr style="border-bottom:2px solid #000;background:#f5f5f5;">
            <th style="text-align:left;padding:6px 8px;font-weight:700;">तपशील (Particulars)</th>
            <th style="text-align:right;padding:6px 8px;font-weight:700;width:120px;">रक्कम (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background:#e8f5e9;border-bottom:2px solid #4caf50;"><td colspan="2" style="padding:6px 8px;font-weight:bold;font-size:11pt;">उत्पन्न (Income)</td></tr>
          ${incomeRows}
          <tr><td colspan="2" style="height:8px;"></td></tr>
          <tr style="background:#ffebee;border-bottom:2px solid #ef5350;"><td colspan="2" style="padding:6px 8px;font-weight:bold;font-size:11pt;">खर्च (Expenses)</td></tr>
          ${expenseRows}
          <tr><td colspan="2" style="height:8px;"></td></tr>
          <tr style="border-top:3px solid #000;border-bottom:3px solid #000;background:#f5f5f5;">
            <td style="padding:10px 8px;">
              <span style="font-size:12pt;font-weight:bold;">${netLabel}</span><br/>
              <span style="font-size:8pt;color:#666;">₹ ${fc(plData.income.totalIncome)} - ₹ ${fc(plData.expenses.totalExpenses)}</span>
            </td>
            <td style="padding:10px 8px;text-align:right;font-size:14pt;font-weight:bold;">${fc(plData.netProfit)}</td>
          </tr>
        </tbody>
      </table>

      <div style="display:flex;justify-content:space-between;margin-top:50px;font-size:9pt;">
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:130px;padding-top:4px;">तपासणी अधिकारी</div></div>
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:130px;padding-top:4px;">व्यवस्थापक</div></div>
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:130px;padding-top:4px;">अध्यक्ष / संचालक</div></div>
      </div>
      <p style="text-align:center;font-size:8pt;color:#999;margin-top:12px;">हा संगणकीय प्रत तयार केलेला अहवाल आहे | Generated by LonoPro</p>
    </div>
  `;
}

export default function ProfitLoss() {
  const fy = getDefaultFY();
  const [dateFrom, setDateFrom] = useState(fy.dateFrom);
  const [dateTo, setDateTo] = useState(fy.dateTo);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        @page { size: A4; margin: 8mm; }
        body {
          font-family: 'Noto Sans Devanagari', Arial, sans-serif !important;
          padding-left: 17.4mm !important;
          box-sizing: border-box !important;
        }
        .lg\\:pl-72 { padding-left: 0 !important; }
        aside, .sidebar-modern, .mobile-nav { display: none !important; }
        .overflow-x-auto {
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const { data: company } = useQuery<any>({ queryKey: ["/api/company"] });

  const { data: plData, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/profit-loss", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ dateFrom, dateTo });
      const res = await fetch(`/api/reports/profit-loss?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const quickFY = (yearsBack: number) => {
    const now = new Date();
    const baseYear = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - yearsBack;
    setDateFrom(`${baseYear}-04-01`);
    setDateTo(`${baseYear + 1}-03-31`);
    setTimeout(() => refetch(), 100);
  };

  const createOffscreenRendered = async (): Promise<{ container: HTMLElement, cleanup: () => void } | null> => {
    if (!plData) return null;

    const a4WidthPx = 794;
    const a4HeightPx = 1123;

    const html = buildProfitLossHTML(plData, company, dateFrom, dateTo);

    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.style.width = a4WidthPx + 'px';
    wrapper.style.minHeight = a4HeightPx + 'px';
    wrapper.style.zIndex = '-9999';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.overflow = 'visible';
    wrapper.style.background = 'white';
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);

    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      container: wrapper,
      cleanup: () => document.body.removeChild(wrapper)
    };
  };

  const downloadAsPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const result = await createOffscreenRendered();
      if (!result) { alert("नफा-तोटा डेटा सापडला नाही"); setIsGeneratingPDF(false); return; }
      const { container, cleanup } = result;

      const { default: html2canvas } = await import('html2canvas');

      const a4WidthPx = 794;
      const contentHeight = container.scrollHeight;

      const canvas = await html2canvas(container, {
        scale: 4,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 0,
        width: a4WidthPx,
        height: contentHeight,
        windowWidth: a4WidthPx,
        windowHeight: contentHeight,
      });

      cleanup();

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      const imgAspect = canvas.height / canvas.width;
      const imgHeight = contentWidth * imgAspect;

      if (imgHeight <= pdfHeight - (margin * 2)) {
        doc.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight);
      } else {
        const pageContentHeight = pdfHeight - (margin * 2);
        const totalPages = Math.ceil(imgHeight / pageContentHeight);
        
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) doc.addPage();
          const srcY = (page * pageContentHeight / imgHeight) * canvas.height;
          const srcH = Math.min((pageContentHeight / imgHeight) * canvas.height, canvas.height - srcY);
          
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = srcH;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
          }
          const pageImgData = pageCanvas.toDataURL('image/png');
          const drawHeight = (srcH / canvas.height) * imgHeight;
          doc.addImage(pageImgData, 'PNG', margin, margin, contentWidth, drawHeight);
        }
      }

      const companyName = company?.name || "Company";
      doc.save(`नफा-तोटा_${companyName}_${dateTo}.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("PDF तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
    setIsGeneratingPDF(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNav />

      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen print:hidden">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0 print:pl-0 print:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl md:max-w-6xl mx-auto w-full print:p-0 print:max-w-none">
            <div className="print:hidden mb-6">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-indigo-900 mb-1">नफा-तोटा पत्रक</h1>
              <p className="text-sm text-gray-500">Profit & Loss Statement</p>
            </div>

            <Card className="print:hidden mb-6">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
                  <div>
                    <Label className="text-xs md:text-sm text-gray-600">तारखेपासून</Label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 md:h-10 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs md:text-sm text-gray-600">तारखेपर्यंत</Label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 md:h-10 text-sm" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => refetch()} size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-9 md:h-10 w-full md:w-auto">
                      <Search className="w-4 h-4 mr-1" /> शोधा
                    </Button>
                  </div>
                  <div className="flex items-end gap-2 flex-wrap">
                    <Button variant="ghost" size="sm" className="text-xs h-7 md:h-8" onClick={() => quickFY(0)}>चालू वर्ष</Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7 md:h-8" onClick={() => quickFY(1)}>मागील वर्ष</Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7 md:h-8" onClick={() => quickFY(2)}>२ वर्षांपूर्वी</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

          {isLoading && (
            <div className="text-center py-12 print:hidden">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
              <p className="text-gray-500">नफा-तोटा पत्रक तयार होत आहे...</p>
            </div>
          )}

          {plData && (
            <>
              <div className="print:hidden mb-3">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={downloadAsPDF} size="sm" disabled={isGeneratingPDF} className="bg-red-600 hover:bg-red-700 h-9">
                    <FileText className="w-4 h-4 mr-1" />
                    {isGeneratingPDF ? "PDF तयार होत आहे..." : "PDF डाउनलोड"}
                  </Button>
                  <Button onClick={handlePrint} size="sm" variant="outline" className="h-9">
                    <Printer className="w-4 h-4 mr-1" /> प्रिंट
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 print:hidden">
                <Card className="border-green-200">
                  <CardContent className="p-3 text-center">
                    <ArrowUpRight className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="text-xs text-gray-500">एकूण उत्पन्न</p>
                    <p className="text-sm font-bold text-green-700">₹ {formatCurrency(plData.income.totalIncome)}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200">
                  <CardContent className="p-3 text-center">
                    <ArrowDownRight className="w-5 h-5 mx-auto mb-1 text-red-500" />
                    <p className="text-xs text-gray-500">एकूण खर्च</p>
                    <p className="text-sm font-bold text-red-700">₹ {formatCurrency(plData.expenses.totalExpenses)}</p>
                  </CardContent>
                </Card>
                <Card className={`${plData.isProfit ? 'border-green-200' : 'border-red-200'} col-span-2 sm:col-span-1`}>
                  <CardContent className="p-3 text-center">
                    {plData.isProfit ? (
                      <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 mx-auto mb-1 text-red-500" />
                    )}
                    <p className="text-xs text-gray-500">{plData.isProfit ? "निव्वळ नफा" : "निव्वळ तोटा"}</p>
                    <p className={`text-sm font-bold ${plData.isProfit ? 'text-green-700' : 'text-red-700'}`}>
                      ₹ {formatCurrency(plData.netProfit)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="pl-print-area">
                <div className="hidden print:block text-center border-b-2 border-black pb-3 mb-4">
                  <h2 className="text-[16pt] font-bold leading-tight">{company?.name || ""}</h2>
                  {company?.address && <p className="text-[10pt] mt-1">{company.address}</p>}
                  {company?.registrationNumber && <p className="text-[9pt]">नोंदणी क्र.: {company.registrationNumber}</p>}
                  <div className="mt-2 border-t border-gray-400 pt-2">
                    <h3 className="text-[14pt] font-bold">नफा-तोटा पत्रक (Profit & Loss Statement)</h3>
                    <p className="text-[10pt] mt-1">कालावधी: {formatDateDisplay(dateFrom)} ते {formatDateDisplay(dateTo)}</p>
                  </div>
                </div>

                <table className="w-full text-sm md:text-base border-collapse pl-statement-table md:border md:border-gray-800 print:text-[10pt]">
                  <thead>
                    <tr className="bg-gray-100 md:bg-indigo-700 print:bg-white border-b-2 border-black">
                      <th className="text-left px-4 py-2.5 font-bold text-gray-800 md:text-white md:px-5 md:py-3.5 md:text-lg print:text-[11pt] print:text-black print:px-3 print:py-2" colSpan={2}>तपशील (Particulars)</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-800 w-[140px] md:text-white md:px-5 md:py-3.5 md:text-lg md:w-[200px] print:text-[11pt] print:text-black print:px-3 print:py-2 print:w-[130px]">रक्कम (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-green-50 print:bg-white border-b-2 border-green-300 md:border-green-400 print:border-black">
                      <td colSpan={3} className="px-4 py-2.5 font-bold text-green-800 md:px-5 md:py-3 md:text-base print:text-black print:text-[11pt] print:px-3 print:py-2">
                        <DollarSign className="w-4 h-4 inline mr-2 print:hidden" />
                        उत्पन्न (Income)
                      </td>
                    </tr>

                    <tr className="border-b hover:bg-green-50/30 md:border-b md:border-gray-200">
                      <td className="w-6 md:w-8 print:w-4"></td>
                      <td className="px-4 py-2.5 md:px-5 md:py-3 print:px-3 print:py-2">
                        <Receipt className="w-4 h-4 inline mr-2 text-green-500 print:hidden" />
                        <span className="font-medium">व्याज उत्पन्न (Interest Income)</span>
                      </td>
                      <td className="text-right px-4 py-2.5 font-semibold md:px-5 md:py-3 print:px-3 print:py-2">{formatCurrency(plData.income.interestIncome)}</td>
                    </tr>

                    {plData.income.otherIncomeItems.map((item: any, i: number) => (
                      <tr key={`income-${i}`} className="border-b hover:bg-green-50/30 md:border-b md:border-gray-200">
                        <td className="w-6 md:w-8 print:w-4"></td>
                        <td className="px-4 py-2.5 md:px-5 md:py-3 print:px-3 print:py-2">{item.name}</td>
                        <td className="text-right px-4 py-2.5 md:px-5 md:py-3 print:px-3 print:py-2">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}

                    <tr className="border-t-2 border-green-400 bg-green-100 font-bold md:border-t-2 md:border-green-500 print:bg-white print:border-t-2 print:border-black">
                      <td></td>
                      <td className="px-4 py-2.5 md:px-5 md:py-3 md:text-base print:px-3 print:py-2 print:text-[11pt]">एकूण उत्पन्न (A)</td>
                      <td className="text-right px-4 py-2.5 text-green-700 md:px-5 md:py-3 md:text-base print:text-black print:px-3 print:py-2 print:text-[11pt]">{formatCurrency(plData.income.totalIncome)}</td>
                    </tr>

                    <tr className="h-2 md:h-3 print:h-1"><td colSpan={3}></td></tr>

                    <tr className="bg-red-50 print:bg-white border-b-2 border-red-300 md:border-red-400 print:border-black">
                      <td colSpan={3} className="px-4 py-2.5 font-bold text-red-800 md:px-5 md:py-3 md:text-base print:text-black print:text-[11pt] print:px-3 print:py-2">
                        <Receipt className="w-4 h-4 inline mr-2 print:hidden" />
                        खर्च (Expenses)
                      </td>
                    </tr>

                    {plData.expenses.items.length === 0 ? (
                      <tr className="border-b">
                        <td></td>
                        <td colSpan={2} className="px-4 py-4 text-center text-gray-400 md:px-5 md:py-5 print:text-gray-600 print:py-2">या कालावधीत खर्च नाही</td>
                      </tr>
                    ) : (
                      plData.expenses.items.map((item: any, i: number) => (
                        <tr key={`expense-${i}`} className="border-b hover:bg-red-50/30 md:border-b md:border-gray-200">
                          <td className="w-6 md:w-8 print:w-4"></td>
                          <td className="px-4 py-2.5 md:px-5 md:py-3 print:px-3 print:py-2">{item.name}</td>
                          <td className="text-right px-4 py-2.5 md:px-5 md:py-3 print:px-3 print:py-2">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))
                    )}

                    <tr className="border-t-2 border-red-400 bg-red-100 font-bold md:border-t-2 md:border-red-500 print:bg-white print:border-t-2 print:border-black">
                      <td></td>
                      <td className="px-4 py-2.5 md:px-5 md:py-3 md:text-base print:px-3 print:py-2 print:text-[11pt]">एकूण खर्च (B)</td>
                      <td className="text-right px-4 py-2.5 text-red-700 md:px-5 md:py-3 md:text-base print:text-black print:px-3 print:py-2 print:text-[11pt]">{formatCurrency(plData.expenses.totalExpenses)}</td>
                    </tr>

                    <tr className="h-2 md:h-3 print:h-1"><td colSpan={3}></td></tr>

                    <tr className={`border-t-[3px] border-b-[3px] ${plData.isProfit ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'} print:bg-white print:border-black`}>
                      <td></td>
                      <td className="px-4 py-3 md:px-5 md:py-4 print:px-3 print:py-2.5">
                        <span className="text-lg font-bold md:text-xl print:text-[12pt]">
                          {plData.isProfit ? "निव्वळ नफा (A - B)" : "निव्वळ तोटा (B - A)"}
                        </span>
                        <div className="text-xs text-gray-500 md:text-sm print:text-[8pt] mt-0.5">
                          ₹ {formatCurrency(plData.income.totalIncome)} - ₹ {formatCurrency(plData.expenses.totalExpenses)}
                        </div>
                      </td>
                      <td className={`text-right px-4 py-3 text-xl font-bold md:px-5 md:py-4 md:text-2xl ${plData.isProfit ? 'text-green-700' : 'text-red-700'} print:text-black print:text-[13pt] print:px-3 print:py-2.5`}>
                        {formatCurrency(plData.netProfit)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="hidden print:block mt-8 pt-4 border-t border-gray-300">
                  <div className="flex justify-between text-[9pt]">
                    <div className="text-center"><div className="border-t border-black w-40 mt-8 pt-1">तपासणी अधिकारी</div></div>
                    <div className="text-center"><div className="border-t border-black w-40 mt-8 pt-1">व्यवस्थापक</div></div>
                    <div className="text-center"><div className="border-t border-black w-40 mt-8 pt-1">अध्यक्ष / संचालक</div></div>
                  </div>
                  <p className="text-center text-[8pt] text-gray-500 mt-4">हा संगणकीय प्रत तयार केलेला अहवाल आहे | Generated by LonoPro</p>
                </div>
              </div>
            </>
          )}

          {!isLoading && !plData && (
            <div className="text-center py-12 text-gray-400 print:hidden">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>नफा-तोटा पत्रक पाहण्यासाठी तारखा निवडा आणि शोधा बटण दाबा</p>
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}