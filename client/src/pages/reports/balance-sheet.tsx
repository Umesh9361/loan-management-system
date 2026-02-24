import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Printer, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Building2, Landmark, Wallet, Users, Package, Scale, FileText, Download, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useIsMobile } from "@/hooks/use-mobile";
import jsPDF from "jspdf";

function getDefaultFY() {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    fyStartDate: `${currentYear}-04-01`,
    asOfDate: `${currentYear + 1}-03-31`,
    fyLabel: `${currentYear}-${currentYear + 1}`,
  };
}

function formatCurrency(amount: number): string {
  if (amount === 0) return "0.00";
  return Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function buildBalanceSheetHTML(balanceSheet: any, company: any, fyStartDate: string, asOfDate: string): string {
  const fc = (amount: number) => {
    if (amount === 0) return "0.00";
    return Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fd = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  let assetsRows = "";
  assetsRows += `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd;font-weight:600;">कर्ज व अग्रिम</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;font-weight:600;">${fc(balanceSheet.assets.loansAndAdvances.total)}</td></tr>`;
  assetsRows += `<tr><td style="padding:4px 8px 4px 20px;border-bottom:1px solid #eee;font-size:9pt;color:#555;">${balanceSheet.assets.loansAndAdvances.loanCount} कर्जे (मूळ: ₹${fc(balanceSheet.assets.loansAndAdvances.principalTotal)})</td><td></td></tr>`;
  assetsRows += `<tr><td style="padding:6px 8px;border-bottom:1px solid #ddd;font-weight:600;">रोकड शिल्लक</td><td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;font-weight:600;">${fc(balanceSheet.assets.cashBalance)}</td></tr>`;

  if (balanceSheet.assets.bankAccounts?.length > 0) {
    for (const bank of balanceSheet.assets.bankAccounts) {
      assetsRows += `<tr><td style="padding:5px 8px;border-bottom:1px solid #ddd;">${bank.name}</td><td style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:right;">${fc(bank.balance)}</td></tr>`;
    }
  }

  if (balanceSheet.assets.fixedAssets?.length > 0) {
    assetsRows += `<tr><td colspan="2" style="padding:4px 8px;border-bottom:1px solid #ccc;font-weight:700;font-size:9pt;background:#f5f5f5;">स्थिर मालमत्ता (Fixed Assets)</td></tr>`;
    for (const asset of balanceSheet.assets.fixedAssets) {
      assetsRows += `<tr><td style="padding:5px 8px 5px 20px;border-bottom:1px solid #ddd;">${asset.name}</td><td style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:right;">${fc(asset.balance)}</td></tr>`;
    }
  }

  if (balanceSheet.assets.debtors?.length > 0) {
    assetsRows += `<tr><td colspan="2" style="padding:4px 8px;border-bottom:1px solid #ccc;font-weight:700;font-size:9pt;background:#f5f5f5;">देणेदार (Debtors)</td></tr>`;
    for (const d of balanceSheet.assets.debtors) {
      assetsRows += `<tr><td style="padding:5px 8px 5px 20px;border-bottom:1px solid #ddd;">${d.name}</td><td style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:right;">${fc(d.balance)}</td></tr>`;
    }
  }

  assetsRows += `<tr style="border-top:2px solid #000;font-weight:bold;background:#f0f0f0;"><td style="padding:8px;">एकूण मालमत्ता</td><td style="padding:8px;text-align:right;">${fc(balanceSheet.assets.totalAssets)}</td></tr>`;

  let liabRows = "";
  liabRows += `<tr><td colspan="2" style="padding:4px 8px;border-bottom:1px solid #ccc;font-weight:700;font-size:9pt;background:#f5f5f5;">भांडवल खाते (Capital Account)</td></tr>`;
  liabRows += `<tr><td style="padding:5px 8px 5px 20px;border-bottom:1px solid #ddd;">प्रारंभिक भांडवल</td><td style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:right;">${fc(balanceSheet.liabilities.capitalAccount.openingCapital)}</td></tr>`;

  if (balanceSheet.liabilities.capitalAccount.capitalAdded > 0) {
    liabRows += `<tr><td style="padding:5px 8px 5px 20px;border-bottom:1px solid #ddd;">(+) भांडवल जमा</td><td style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:right;">${fc(balanceSheet.liabilities.capitalAccount.capitalAdded)}</td></tr>`;
  }
  if (balanceSheet.liabilities.capitalAccount.capitalWithdrawn > 0) {
    liabRows += `<tr><td style="padding:5px 8px 5px 20px;border-bottom:1px solid #ddd;">(-) भांडवल काढणे</td><td style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:right;">${fc(balanceSheet.liabilities.capitalAccount.capitalWithdrawn)}</td></tr>`;
  }

  const npLabel = balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? "(+) निव्वळ नफा" : "(-) निव्वळ तोटा";
  liabRows += `<tr><td style="padding:5px 8px 5px 20px;border-bottom:1px solid #ddd;">${npLabel}</td><td style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:right;">${fc(balanceSheet.liabilities.capitalAccount.netProfit)}</td></tr>`;
  liabRows += `<tr><td style="padding:6px 8px 6px 20px;border-bottom:2px solid #999;font-weight:600;">अंतिम भांडवल</td><td style="padding:6px 8px;border-bottom:2px solid #999;text-align:right;font-weight:600;">${fc(balanceSheet.liabilities.capitalAccount.closingCapital)}</td></tr>`;

  if (balanceSheet.liabilities.creditors?.length > 0) {
    liabRows += `<tr><td colspan="2" style="padding:4px 8px;border-bottom:1px solid #ccc;font-weight:700;font-size:9pt;background:#f5f5f5;">धनको (Creditors)</td></tr>`;
    for (const c of balanceSheet.liabilities.creditors) {
      liabRows += `<tr><td style="padding:5px 8px 5px 20px;border-bottom:1px solid #ddd;">${c.name}</td><td style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:right;">${fc(c.balance)}</td></tr>`;
    }
  }

  liabRows += `<tr style="border-top:2px solid #000;font-weight:bold;background:#f0f0f0;"><td style="padding:8px;">एकूण दायित्वे व भांडवल</td><td style="padding:8px;text-align:right;">${fc(balanceSheet.liabilities.totalLiabilities)}</td></tr>`;

  return `
    <div style="font-family:'Noto Sans Devanagari',sans-serif;color:#000;background:#fff;padding:20px 15px;box-sizing:border-box;width:100%;">
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px;">
        <h2 style="font-size:16pt;font-weight:bold;margin:0 0 4px 0;">${company?.name || ""}</h2>
        ${company?.address ? `<p style="font-size:10pt;margin:0 0 2px 0;">${company.address}</p>` : ""}
        ${company?.registrationNumber ? `<p style="font-size:9pt;margin:0 0 6px 0;">नोंदणी क्र.: ${company.registrationNumber}</p>` : ""}
        <div style="border-top:1px solid #999;padding-top:8px;margin-top:4px;">
          <h3 style="font-size:14pt;font-weight:bold;margin:0 0 4px 0;">ताळेबंद (Balance Sheet)</h3>
          <p style="font-size:10pt;margin:0;">दिनांक: ${fd(asOfDate)} पर्यंत | आर्थिक वर्ष: ${fd(fyStartDate)} ते ${fd(asOfDate)}</p>
        </div>
      </div>

      <div style="display:flex;gap:10px;width:100%;">
        <div style="flex:1;border:1px solid #000;">
          <div style="text-align:center;font-weight:bold;font-size:11pt;padding:6px;border-bottom:2px solid #000;background:#f5f5f5;">मालमत्ता (Assets)</div>
          <table style="width:100%;border-collapse:collapse;font-size:10pt;">
            <thead><tr style="border-bottom:2px solid #000;"><th style="text-align:left;padding:5px 8px;font-weight:700;">तपशील</th><th style="text-align:right;padding:5px 8px;font-weight:700;width:110px;">रक्कम (₹)</th></tr></thead>
            <tbody>${assetsRows}</tbody>
          </table>
        </div>
        <div style="flex:1;border:1px solid #000;">
          <div style="text-align:center;font-weight:bold;font-size:11pt;padding:6px;border-bottom:2px solid #000;background:#f5f5f5;">दायित्वे व भांडवल (Liabilities & Capital)</div>
          <table style="width:100%;border-collapse:collapse;font-size:10pt;">
            <thead><tr style="border-bottom:2px solid #000;"><th style="text-align:left;padding:5px 8px;font-weight:700;">तपशील</th><th style="text-align:right;padding:5px 8px;font-weight:700;width:110px;">रक्कम (₹)</th></tr></thead>
            <tbody>${liabRows}</tbody>
          </table>
        </div>
      </div>

      ${!balanceSheet.isTallied ? `<div style="text-align:center;margin-top:10px;font-size:9pt;color:#666;">फरक: ₹ ${fc(balanceSheet.difference)}</div>` : ""}

      <div style="display:flex;justify-content:space-between;margin-top:50px;font-size:9pt;">
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:130px;padding-top:4px;">तपासणी अधिकारी</div></div>
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:130px;padding-top:4px;">व्यवस्थापक</div></div>
        <div style="text-align:center;"><div style="border-top:1px solid #000;width:130px;padding-top:4px;">अध्यक्ष / संचालक</div></div>
      </div>
      <p style="text-align:center;font-size:8pt;color:#999;margin-top:12px;">हा संगणकीय प्रत तयार केलेला अहवाल आहे | Generated by LonoPro</p>
    </div>
  `;
}

export default function BalanceSheet() {
  const fy = getDefaultFY();
  const [fyStartDate, setFyStartDate] = useState(fy.fyStartDate);
  const [asOfDate, setAsOfDate] = useState(fy.asOfDate);
  const isMobile = useIsMobile();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const { data: company } = useQuery<any>({ queryKey: ["/api/company"] });

  const { data: balanceSheet, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/reports/balance-sheet", asOfDate, fyStartDate],
    queryFn: async () => {
      const params = new URLSearchParams({ asOfDate, fyStartDate });
      const res = await fetch(`/api/reports/balance-sheet?${params}`, { credentials: "include" });
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
    setFyStartDate(`${baseYear}-04-01`);
    setAsOfDate(`${baseYear + 1}-03-31`);
    setTimeout(() => refetch(), 100);
  };

  const createOffscreenRendered = async (): Promise<{ container: HTMLElement, cleanup: () => void } | null> => {
    if (!balanceSheet) return null;

    const a4WidthPx = 794;
    const a4HeightPx = 1123;

    const html = buildBalanceSheetHTML(balanceSheet, company, fyStartDate, asOfDate);

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
      if (!result) { alert("ताळेबंद डेटा सापडला नाही"); setIsGeneratingPDF(false); return; }
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
      doc.save(`ताळेबंद_${companyName}_${asOfDate}.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("PDF तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
    setIsGeneratingPDF(false);
  };

  const downloadAsImage = async () => {
    setIsGeneratingImage(true);
    try {
      const result = await createOffscreenRendered();
      if (!result) { alert("ताळेबंद डेटा सापडला नाही"); setIsGeneratingImage(false); return; }
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

      const imageUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageUrl;
      const companyName = company?.name || "Company";
      link.download = `ताळेबंद_${companyName}_${asOfDate}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Image generation error:", error);
      alert("इमेज तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
    setIsGeneratingImage(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:block print:hidden">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="md:hidden print:hidden">
          <MobileNav />
        </div>

        <div className="p-3 sm:p-6 max-w-5xl mx-auto w-full print:p-0 print:max-w-none">
          <div className="print:hidden mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-indigo-900 mb-1">ताळेबंद</h1>
            <p className="text-sm text-gray-500">Balance Sheet</p>
          </div>

          <Card className="print:hidden mb-4">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs text-gray-600">आर्थिक वर्ष सुरू</Label>
                  <Input type="date" value={fyStartDate} onChange={(e) => setFyStartDate(e.target.value)} className="h-9 w-36 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">दिनांक पर्यंत</Label>
                  <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="h-9 w-36 text-sm" />
                </div>
                <Button onClick={() => refetch()} size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-9">
                  <Search className="w-4 h-4 mr-1" /> शोधा
                </Button>
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => quickFY(0)}>चालू वर्ष</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => quickFY(1)}>मागील वर्ष</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => quickFY(2)}>२ वर्षांपूर्वी</Button>
              </div>
            </CardContent>
          </Card>

          {isLoading && (
            <div className="text-center py-12 print:hidden">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
              <p className="text-gray-500">ताळेबंद तयार होत आहे...</p>
            </div>
          )}

          {balanceSheet && (
            <>
              <div className="print:hidden mb-3">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={downloadAsPDF} size="sm" disabled={isGeneratingPDF} className="bg-red-600 hover:bg-red-700 h-9">
                    <FileText className="w-4 h-4 mr-1" />
                    {isGeneratingPDF ? "PDF तयार होत आहे..." : "PDF डाउनलोड"}
                  </Button>
                  <Button onClick={downloadAsImage} size="sm" disabled={isGeneratingImage} variant="outline" className="h-9">
                    <Download className="w-4 h-4 mr-1" />
                    {isGeneratingImage ? "इमेज तयार होत आहे..." : "इमेज डाउनलोड"}
                  </Button>
                  {!isMobile && (
                    <Button onClick={handlePrint} size="sm" variant="outline" className="h-9">
                      <Printer className="w-4 h-4 mr-1" /> प्रिंट
                    </Button>
                  )}
                </div>
              </div>

              {balanceSheet.isTallied ? (
                <div className="print:hidden mb-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">ताळेबंद जुळतो (Assets = Liabilities + Capital)</span>
                </div>
              ) : (
                <div className="print:hidden mb-3 flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-700">फरक: ₹ {formatCurrency(balanceSheet.difference)}</span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 print:hidden">
                <Card className="border-indigo-200">
                  <CardContent className="p-3 text-center">
                    <Landmark className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
                    <p className="text-xs text-gray-500">कर्ज शिल्लक</p>
                    <p className="text-sm font-bold text-indigo-700">₹ {formatCurrency(balanceSheet.assets.loansAndAdvances.total)}</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200">
                  <CardContent className="p-3 text-center">
                    <Wallet className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="text-xs text-gray-500">रोकड शिल्लक</p>
                    <p className="text-sm font-bold text-green-700">₹ {formatCurrency(balanceSheet.assets.cashBalance)}</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200">
                  <CardContent className="p-3 text-center">
                    <Scale className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-xs text-gray-500">भांडवल</p>
                    <p className="text-sm font-bold text-blue-700">₹ {formatCurrency(balanceSheet.liabilities.capitalAccount.closingCapital)}</p>
                  </CardContent>
                </Card>
                <Card className={balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? "border-green-200" : "border-red-200"}>
                  <CardContent className="p-3 text-center">
                    {balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? (
                      <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 mx-auto mb-1 text-red-500" />
                    )}
                    <p className="text-xs text-gray-500">निव्वळ नफा/तोटा</p>
                    <p className={`text-sm font-bold ${balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? '+' : '-'} ₹ {formatCurrency(balanceSheet.liabilities.capitalAccount.netProfit)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="bs-print-area">
                <div className="hidden print:block text-center border-b-2 border-black pb-3 mb-4">
                  <h2 className="text-[16pt] font-bold leading-tight">{company?.name || ""}</h2>
                  {company?.address && <p className="text-[10pt] mt-1">{company.address}</p>}
                  {company?.registrationNumber && <p className="text-[9pt]">नोंदणी क्र.: {company.registrationNumber}</p>}
                  <div className="mt-2 border-t border-gray-400 pt-2">
                    <h3 className="text-[14pt] font-bold">ताळेबंद (Balance Sheet)</h3>
                    <p className="text-[10pt] mt-1">दिनांक: {formatDateDisplay(asOfDate)} पर्यंत | आर्थिक वर्ष: {formatDateDisplay(fyStartDate)} ते {formatDateDisplay(asOfDate)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-0">
                  <div className="print:border-r print:border-black">
                    <Card className="border-2 border-indigo-100 print:border-0 print:shadow-none print:rounded-none">
                      <CardHeader className="bg-indigo-50 py-3 px-4 print:bg-white print:py-1 print:px-2">
                        <CardTitle className="text-base font-bold text-indigo-900 flex items-center gap-2 print:text-[12pt] print:text-black print:text-center print:justify-center">
                          <TrendingUp className="w-5 h-5 print:hidden" />
                          मालमत्ता (Assets)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full text-sm bs-table">
                          <thead>
                            <tr className="border-b bg-gray-50 print:bg-white print:border-b-2 print:border-black">
                              <th className="text-left px-3 py-2 font-semibold print:px-2 print:py-1 print:text-[10pt]">तपशील</th>
                              <th className="text-right px-3 py-2 font-semibold print:px-2 print:py-1 print:text-[10pt] print:w-[120px]">रक्कम (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b hover:bg-indigo-50/30">
                              <td className="px-3 py-2 print:px-2 print:py-1.5">
                                <div className="flex items-center gap-2">
                                  <Landmark className="w-4 h-4 text-indigo-500 print:hidden flex-shrink-0" />
                                  <div>
                                    <div className="font-medium print:text-[10pt]">कर्ज व अग्रिम</div>
                                    <div className="text-xs text-gray-500 print:text-[8pt]">{balanceSheet.assets.loansAndAdvances.loanCount} कर्जे</div>
                                  </div>
                                </div>
                              </td>
                              <td className="text-right px-3 py-2 font-semibold print:px-2 print:py-1.5 print:text-[10pt]">{formatCurrency(balanceSheet.assets.loansAndAdvances.total)}</td>
                            </tr>

                            <tr className="border-b hover:bg-indigo-50/30">
                              <td className="px-3 py-2 print:px-2 print:py-1.5">
                                <div className="flex items-center gap-2">
                                  <Wallet className="w-4 h-4 text-green-500 print:hidden flex-shrink-0" />
                                  <span className="font-medium print:text-[10pt]">रोकड शिल्लक</span>
                                </div>
                              </td>
                              <td className="text-right px-3 py-2 font-semibold print:px-2 print:py-1.5 print:text-[10pt]">{formatCurrency(balanceSheet.assets.cashBalance)}</td>
                            </tr>

                            {balanceSheet.assets.bankAccounts.map((bank: any, i: number) => (
                              <tr key={`bank-${i}`} className="border-b hover:bg-indigo-50/30">
                                <td className="px-3 py-2 print:px-2 print:py-1.5">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-blue-500 print:hidden flex-shrink-0" />
                                    <span className="print:text-[10pt]">{bank.name}</span>
                                  </div>
                                </td>
                                <td className="text-right px-3 py-2 print:px-2 print:py-1.5 print:text-[10pt]">{formatCurrency(bank.balance)}</td>
                              </tr>
                            ))}

                            {balanceSheet.assets.fixedAssets.length > 0 && (
                              <>
                                <tr className="border-b bg-gray-50 print:bg-white">
                                  <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide print:text-[9pt] print:px-2 print:py-1 print:text-black">
                                    <Package className="w-3.5 h-3.5 inline mr-1 print:hidden" />
                                    स्थिर मालमत्ता
                                  </td>
                                </tr>
                                {balanceSheet.assets.fixedAssets.map((asset: any, i: number) => (
                                  <tr key={`asset-${i}`} className="border-b hover:bg-indigo-50/30">
                                    <td className="px-3 py-2 pl-6 print:px-2 print:py-1.5 print:pl-4 print:text-[10pt]">{asset.name}</td>
                                    <td className="text-right px-3 py-2 print:px-2 print:py-1.5 print:text-[10pt]">{formatCurrency(asset.balance)}</td>
                                  </tr>
                                ))}
                              </>
                            )}

                            {balanceSheet.assets.debtors.length > 0 && (
                              <>
                                <tr className="border-b bg-gray-50 print:bg-white">
                                  <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide print:text-[9pt] print:px-2 print:py-1 print:text-black">
                                    <Users className="w-3.5 h-3.5 inline mr-1 print:hidden" />
                                    देणेदार (Debtors)
                                  </td>
                                </tr>
                                {balanceSheet.assets.debtors.map((d: any, i: number) => (
                                  <tr key={`debtor-${i}`} className="border-b hover:bg-indigo-50/30">
                                    <td className="px-3 py-2 pl-6 print:px-2 print:py-1.5 print:pl-4 print:text-[10pt]">{d.name}</td>
                                    <td className="text-right px-3 py-2 print:px-2 print:py-1.5 print:text-[10pt]">{formatCurrency(d.balance)}</td>
                                  </tr>
                                ))}
                              </>
                            )}

                            <tr className="border-t-2 border-indigo-300 bg-indigo-50 font-bold print:bg-white print:border-t-2 print:border-black">
                              <td className="px-3 py-2.5 print:px-2 print:py-2 print:text-[11pt] print:font-bold">एकूण मालमत्ता</td>
                              <td className="text-right px-3 py-2.5 text-indigo-700 print:text-black print:px-2 print:py-2 print:text-[11pt] print:font-bold">{formatCurrency(balanceSheet.assets.totalAssets)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <Card className="border-2 border-rose-100 print:border-0 print:shadow-none print:rounded-none">
                      <CardHeader className="bg-rose-50 py-3 px-4 print:bg-white print:py-1 print:px-2">
                        <CardTitle className="text-base font-bold text-rose-900 flex items-center gap-2 print:text-[12pt] print:text-black print:text-center print:justify-center">
                          <TrendingDown className="w-5 h-5 print:hidden" />
                          दायित्वे व भांडवल
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full text-sm bs-table">
                          <thead>
                            <tr className="border-b bg-gray-50 print:bg-white print:border-b-2 print:border-black">
                              <th className="text-left px-3 py-2 font-semibold print:px-2 print:py-1 print:text-[10pt]">तपशील</th>
                              <th className="text-right px-3 py-2 font-semibold print:px-2 print:py-1 print:text-[10pt] print:w-[120px]">रक्कम (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b bg-gray-50 print:bg-white">
                              <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide print:text-[9pt] print:px-2 print:py-1 print:text-black">
                                <Scale className="w-3.5 h-3.5 inline mr-1 print:hidden" />
                                भांडवल खाते
                              </td>
                            </tr>
                            <tr className="border-b hover:bg-rose-50/30">
                              <td className="px-3 py-1.5 pl-6 text-gray-700 print:px-2 print:py-1 print:pl-4 print:text-[10pt]">प्रारंभिक भांडवल</td>
                              <td className="text-right px-3 py-1.5 print:px-2 print:py-1 print:text-[10pt]">{formatCurrency(balanceSheet.liabilities.capitalAccount.openingCapital)}</td>
                            </tr>
                            {balanceSheet.liabilities.capitalAccount.capitalAdded > 0 && (
                              <tr className="border-b hover:bg-rose-50/30">
                                <td className="px-3 py-1.5 pl-6 text-green-700 print:px-2 print:py-1 print:pl-4 print:text-[10pt] print:text-black">(+) भांडवल जमा</td>
                                <td className="text-right px-3 py-1.5 text-green-600 print:text-black print:px-2 print:py-1 print:text-[10pt]">{formatCurrency(balanceSheet.liabilities.capitalAccount.capitalAdded)}</td>
                              </tr>
                            )}
                            {balanceSheet.liabilities.capitalAccount.capitalWithdrawn > 0 && (
                              <tr className="border-b hover:bg-rose-50/30">
                                <td className="px-3 py-1.5 pl-6 text-red-700 print:px-2 print:py-1 print:pl-4 print:text-[10pt] print:text-black">(-) भांडवल काढणे</td>
                                <td className="text-right px-3 py-1.5 text-red-600 print:text-black print:px-2 print:py-1 print:text-[10pt]">{formatCurrency(balanceSheet.liabilities.capitalAccount.capitalWithdrawn)}</td>
                              </tr>
                            )}
                            <tr className="border-b hover:bg-rose-50/30">
                              <td className="px-3 py-1.5 pl-6 print:px-2 print:py-1 print:pl-4 print:text-[10pt]">
                                {balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? (
                                  <span className="text-green-700 print:text-black">(+) निव्वळ नफा</span>
                                ) : (
                                  <span className="text-red-700 print:text-black">(-) निव्वळ तोटा</span>
                                )}
                              </td>
                              <td className="text-right px-3 py-1.5 print:px-2 print:py-1 print:text-[10pt]">{formatCurrency(balanceSheet.liabilities.capitalAccount.netProfit)}</td>
                            </tr>
                            <tr className="border-b border-indigo-200 bg-indigo-50/50 font-semibold print:bg-white print:border-b-2 print:border-gray-400">
                              <td className="px-3 py-2 pl-6 print:px-2 print:py-1.5 print:pl-4 print:text-[10pt] print:font-bold">अंतिम भांडवल</td>
                              <td className="text-right px-3 py-2 print:px-2 print:py-1.5 print:text-[10pt] print:font-bold">{formatCurrency(balanceSheet.liabilities.capitalAccount.closingCapital)}</td>
                            </tr>

                            {balanceSheet.liabilities.creditors.length > 0 && (
                              <>
                                <tr className="border-b bg-gray-50 print:bg-white">
                                  <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide print:text-[9pt] print:px-2 print:py-1 print:text-black">
                                    <Users className="w-3.5 h-3.5 inline mr-1 print:hidden" />
                                    धनको (Creditors)
                                  </td>
                                </tr>
                                {balanceSheet.liabilities.creditors.map((c: any, i: number) => (
                                  <tr key={`cred-${i}`} className="border-b hover:bg-rose-50/30">
                                    <td className="px-3 py-2 pl-6 print:px-2 print:py-1.5 print:pl-4 print:text-[10pt]">{c.name}</td>
                                    <td className="text-right px-3 py-2 print:px-2 print:py-1.5 print:text-[10pt]">{formatCurrency(c.balance)}</td>
                                  </tr>
                                ))}
                              </>
                            )}

                            <tr className="border-t-2 border-rose-300 bg-rose-50 font-bold print:bg-white print:border-t-2 print:border-black">
                              <td className="px-3 py-2.5 print:px-2 print:py-2 print:text-[11pt] print:font-bold">एकूण दायित्वे व भांडवल</td>
                              <td className="text-right px-3 py-2.5 text-rose-700 print:text-black print:px-2 print:py-2 print:text-[11pt] print:font-bold">{formatCurrency(balanceSheet.liabilities.totalLiabilities)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="hidden print:block mt-6 pt-4 border-t border-gray-300">
                  <div className="flex justify-between text-[9pt]">
                    <div className="text-center"><div className="border-t border-black w-40 mt-8 pt-1">तपासणी अधिकारी</div></div>
                    <div className="text-center"><div className="border-t border-black w-40 mt-8 pt-1">व्यवस्थापक</div></div>
                    <div className="text-center"><div className="border-t border-black w-40 mt-8 pt-1">अध्यक्ष / संचालक</div></div>
                  </div>
                  <p className="text-center text-[8pt] text-gray-500 mt-4">हा संगणकीय प्रत तयार केलेला अहवाल आहे | Generated by LonoPro</p>
                </div>
              </div>

              {!balanceSheet.isTallied && (
                <Card className="mt-4 border-yellow-200 print:hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-yellow-700">
                      <AlertTriangle className="w-5 h-5" />
                      <div>
                        <p className="font-semibold">ताळेबंदात फरक आहे</p>
                        <p className="text-sm">
                          मालमत्ता: ₹ {formatCurrency(balanceSheet.assets.totalAssets)} | 
                          दायित्वे + भांडवल: ₹ {formatCurrency(balanceSheet.liabilities.totalLiabilities)} | 
                          फरक: ₹ {formatCurrency(balanceSheet.difference)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!isLoading && !balanceSheet && (
            <div className="text-center py-12 text-gray-400 print:hidden">
              <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>ताळेबंद पाहण्यासाठी तारखा निवडा आणि शोधा बटण दाबा</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}