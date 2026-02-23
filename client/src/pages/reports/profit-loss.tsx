import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Printer, TrendingUp, TrendingDown, DollarSign, Receipt, ArrowUpRight, ArrowDownRight, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";

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
  if (amount === 0) return "0.00";
  return Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function ProfitLoss() {
  const fy = getDefaultFY();
  const [dateFrom, setDateFrom] = useState(fy.dateFrom);
  const [dateTo, setDateTo] = useState(fy.dateTo);

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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:block print:hidden">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="md:hidden print:hidden">
          <MobileNav />
        </div>

        <div className="p-3 sm:p-6 max-w-4xl mx-auto w-full print:p-0 print:max-w-none">
          <div className="print:hidden mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-indigo-900 mb-1">नफा-तोटा पत्रक</h1>
            <p className="text-sm text-gray-500">Profit & Loss Statement</p>
          </div>

          <Card className="print:hidden mb-4">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs text-gray-600">तारखेपासून</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">तारखेपर्यंत</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36 text-sm" />
                </div>
                <Button onClick={() => refetch()} size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-9">
                  <Search className="w-4 h-4 mr-1" /> शोधा
                </Button>
                <Button onClick={handlePrint} size="sm" variant="outline" className="h-9">
                  <Printer className="w-4 h-4 mr-1" /> प्रिंट / PDF
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
              <p className="text-gray-500">नफा-तोटा पत्रक तयार होत आहे...</p>
            </div>
          )}

          {plData && (
            <>
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
                <Card className={`border-${plData.isProfit ? 'green' : 'red'}-200 col-span-2 sm:col-span-1`}>
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
                <div className="hidden print:block pl-print-header">
                  <div className="text-center border-b-2 border-black pb-3 mb-4">
                    <h2 className="text-[16pt] font-bold leading-tight">{company?.name || ""}</h2>
                    {company?.address && <p className="text-[10pt] mt-1">{company.address}</p>}
                    {company?.registrationNumber && <p className="text-[9pt]">नोंदणी क्र.: {company.registrationNumber}</p>}
                    <div className="mt-2 border-t border-gray-400 pt-2">
                      <h3 className="text-[14pt] font-bold">नफा-तोटा पत्रक (Profit & Loss Statement)</h3>
                      <p className="text-[10pt] mt-1">कालावधी: {formatDateDisplay(dateFrom)} ते {formatDateDisplay(dateTo)}</p>
                    </div>
                  </div>
                </div>

                <table className="w-full text-sm border-collapse pl-statement-table print:text-[10pt]">
                  <thead>
                    <tr className="bg-gray-100 print:bg-white border-b-2 border-black">
                      <th className="text-left px-4 py-2.5 font-bold text-gray-800 print:text-[11pt] print:px-3 print:py-2" colSpan={2}>तपशील (Particulars)</th>
                      <th className="text-right px-4 py-2.5 font-bold text-gray-800 w-[140px] print:text-[11pt] print:px-3 print:py-2 print:w-[130px]">रक्कम (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-green-50 print:bg-white border-b-2 border-green-300 print:border-black">
                      <td colSpan={3} className="px-4 py-2.5 font-bold text-green-800 print:text-black print:text-[11pt] print:px-3 print:py-2">
                        <DollarSign className="w-4 h-4 inline mr-2 print:hidden" />
                        उत्पन्न (Income)
                      </td>
                    </tr>

                    <tr className="border-b hover:bg-green-50/30">
                      <td className="w-6 print:w-4"></td>
                      <td className="px-4 py-2.5 print:px-3 print:py-2">
                        <Receipt className="w-4 h-4 inline mr-2 text-green-500 print:hidden" />
                        <span className="font-medium">व्याज उत्पन्न (Interest Income)</span>
                      </td>
                      <td className="text-right px-4 py-2.5 font-semibold print:px-3 print:py-2">{formatCurrency(plData.income.interestIncome)}</td>
                    </tr>

                    {plData.income.otherIncomeItems.map((item: any, i: number) => (
                      <tr key={`income-${i}`} className="border-b hover:bg-green-50/30">
                        <td className="w-6 print:w-4"></td>
                        <td className="px-4 py-2.5 print:px-3 print:py-2">{item.name}</td>
                        <td className="text-right px-4 py-2.5 print:px-3 print:py-2">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}

                    <tr className="border-t-2 border-green-400 bg-green-100 font-bold print:bg-white print:border-t-2 print:border-black">
                      <td></td>
                      <td className="px-4 py-2.5 print:px-3 print:py-2 print:text-[11pt]">एकूण उत्पन्न (A)</td>
                      <td className="text-right px-4 py-2.5 text-green-700 print:text-black print:px-3 print:py-2 print:text-[11pt]">{formatCurrency(plData.income.totalIncome)}</td>
                    </tr>

                    <tr className="h-2 print:h-1"><td colSpan={3}></td></tr>

                    <tr className="bg-red-50 print:bg-white border-b-2 border-red-300 print:border-black">
                      <td colSpan={3} className="px-4 py-2.5 font-bold text-red-800 print:text-black print:text-[11pt] print:px-3 print:py-2">
                        <Receipt className="w-4 h-4 inline mr-2 print:hidden" />
                        खर्च (Expenses)
                      </td>
                    </tr>

                    {plData.expenses.items.length === 0 ? (
                      <tr className="border-b">
                        <td></td>
                        <td colSpan={2} className="px-4 py-4 text-center text-gray-400 print:text-gray-600 print:py-2">या कालावधीत खर्च नाही</td>
                      </tr>
                    ) : (
                      plData.expenses.items.map((item: any, i: number) => (
                        <tr key={`expense-${i}`} className="border-b hover:bg-red-50/30">
                          <td className="w-6 print:w-4"></td>
                          <td className="px-4 py-2.5 print:px-3 print:py-2">{item.name}</td>
                          <td className="text-right px-4 py-2.5 print:px-3 print:py-2">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))
                    )}

                    <tr className="border-t-2 border-red-400 bg-red-100 font-bold print:bg-white print:border-t-2 print:border-black">
                      <td></td>
                      <td className="px-4 py-2.5 print:px-3 print:py-2 print:text-[11pt]">एकूण खर्च (B)</td>
                      <td className="text-right px-4 py-2.5 text-red-700 print:text-black print:px-3 print:py-2 print:text-[11pt]">{formatCurrency(plData.expenses.totalExpenses)}</td>
                    </tr>

                    <tr className="h-2 print:h-1"><td colSpan={3}></td></tr>

                    <tr className={`border-t-[3px] border-b-[3px] ${plData.isProfit ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'} print:bg-white print:border-black`}>
                      <td></td>
                      <td className="px-4 py-3 print:px-3 print:py-2.5">
                        <span className="text-lg font-bold print:text-[12pt]">
                          {plData.isProfit ? "निव्वळ नफा (A - B)" : "निव्वळ तोटा (B - A)"}
                        </span>
                        <div className="text-xs text-gray-500 print:text-[8pt] mt-0.5">
                          ₹ {formatCurrency(plData.income.totalIncome)} - ₹ {formatCurrency(plData.expenses.totalExpenses)}
                        </div>
                      </td>
                      <td className={`text-right px-4 py-3 text-xl font-bold ${plData.isProfit ? 'text-green-700' : 'text-red-700'} print:text-black print:text-[13pt] print:px-3 print:py-2.5`}>
                        {formatCurrency(plData.netProfit)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="hidden print:block mt-8 pt-4 border-t border-gray-300">
                  <div className="flex justify-between text-[9pt]">
                    <div className="text-center">
                      <div className="border-t border-black w-40 mt-8 pt-1">तपासणी अधिकारी</div>
                    </div>
                    <div className="text-center">
                      <div className="border-t border-black w-40 mt-8 pt-1">व्यवस्थापक</div>
                    </div>
                    <div className="text-center">
                      <div className="border-t border-black w-40 mt-8 pt-1">अध्यक्ष / संचालक</div>
                    </div>
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
      </div>
    </div>
  );
}