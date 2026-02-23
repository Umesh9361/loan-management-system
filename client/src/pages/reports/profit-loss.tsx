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
  if (amount === 0) return "₹ 0.00";
  return `₹ ${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="md:hidden">
          <MobileNav />
        </div>

        <div className="p-3 sm:p-6 max-w-4xl mx-auto w-full">
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
                  <Printer className="w-4 h-4 mr-1" /> प्रिंट
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
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
              <p className="text-gray-500">नफा-तोटा पत्रक तयार होत आहे...</p>
            </div>
          )}

          {plData && (
            <div id="print-area">
              <div className="hidden print:block text-center mb-4 border-b-2 border-black pb-3">
                <h2 className="text-lg font-bold">{company?.name || ""}</h2>
                {company?.address && <p className="text-sm">{company.address}</p>}
                <h3 className="text-base font-bold mt-2">नफा-तोटा पत्रक (Profit & Loss Statement)</h3>
                <p className="text-sm">कालावधी: {formatDateDisplay(dateFrom)} ते {formatDateDisplay(dateTo)}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 print:hidden">
                <Card className="border-green-200">
                  <CardContent className="p-3 text-center">
                    <ArrowUpRight className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="text-xs text-gray-500">एकूण उत्पन्न</p>
                    <p className="text-sm font-bold text-green-700">{formatCurrency(plData.income.totalIncome)}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200">
                  <CardContent className="p-3 text-center">
                    <ArrowDownRight className="w-5 h-5 mx-auto mb-1 text-red-500" />
                    <p className="text-xs text-gray-500">एकूण खर्च</p>
                    <p className="text-sm font-bold text-red-700">{formatCurrency(plData.expenses.totalExpenses)}</p>
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
                      {formatCurrency(plData.netProfit)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="mb-4 border-2 border-green-100 print:border print:border-black print:shadow-none">
                <CardHeader className="bg-green-50 py-3 px-4 print:bg-white print:border-b print:border-black">
                  <CardTitle className="text-base font-bold text-green-900 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 print:hidden" />
                    उत्पन्न (Income)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 print:bg-white">
                        <th className="text-left px-4 py-2 font-semibold">तपशील</th>
                        <th className="text-right px-4 py-2 font-semibold">रक्कम (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-green-50/30">
                        <td className="px-4 py-2.5 flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-green-500 print:hidden" />
                          <span className="font-medium">व्याज उत्पन्न (Interest Income)</span>
                        </td>
                        <td className="text-right px-4 py-2.5 font-semibold">{formatCurrency(plData.income.interestIncome)}</td>
                      </tr>

                      {plData.income.otherIncomeItems.map((item: any, i: number) => (
                        <tr key={`income-${i}`} className="border-b hover:bg-green-50/30">
                          <td className="px-4 py-2.5 pl-6">{item.name}</td>
                          <td className="text-right px-4 py-2.5">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}

                      <tr className="border-t-2 border-green-300 bg-green-50 font-bold print:bg-white print:border-t-2 print:border-black">
                        <td className="px-4 py-2.5">एकूण उत्पन्न</td>
                        <td className="text-right px-4 py-2.5 text-green-700 print:text-black">{formatCurrency(plData.income.totalIncome)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card className="mb-4 border-2 border-red-100 print:border print:border-black print:shadow-none">
                <CardHeader className="bg-red-50 py-3 px-4 print:bg-white print:border-b print:border-black">
                  <CardTitle className="text-base font-bold text-red-900 flex items-center gap-2">
                    <Receipt className="w-5 h-5 print:hidden" />
                    खर्च (Expenses)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 print:bg-white">
                        <th className="text-left px-4 py-2 font-semibold">तपशील</th>
                        <th className="text-right px-4 py-2 font-semibold">रक्कम (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plData.expenses.items.length === 0 ? (
                        <tr className="border-b">
                          <td colSpan={2} className="px-4 py-4 text-center text-gray-400">या कालावधीत खर्च नाही</td>
                        </tr>
                      ) : (
                        plData.expenses.items.map((item: any, i: number) => (
                          <tr key={`expense-${i}`} className="border-b hover:bg-red-50/30">
                            <td className="px-4 py-2.5">{item.name}</td>
                            <td className="text-right px-4 py-2.5">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))
                      )}

                      <tr className="border-t-2 border-red-300 bg-red-50 font-bold print:bg-white print:border-t-2 print:border-black">
                        <td className="px-4 py-2.5">एकूण खर्च</td>
                        <td className="text-right px-4 py-2.5 text-red-700 print:text-black">{formatCurrency(plData.expenses.totalExpenses)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card className={`border-2 ${plData.isProfit ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'} print:border-2 print:border-black print:bg-white`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {plData.isProfit ? (
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center print:bg-white print:border print:border-black">
                          <TrendingUp className="w-6 h-6 text-green-600 print:text-black" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center print:bg-white print:border print:border-black">
                          <TrendingDown className="w-6 h-6 text-red-600 print:text-black" />
                        </div>
                      )}
                      <div>
                        <p className="text-lg font-bold">{plData.isProfit ? "निव्वळ नफा (Net Profit)" : "निव्वळ तोटा (Net Loss)"}</p>
                        <p className="text-xs text-gray-500">उत्पन्न {formatCurrency(plData.income.totalIncome)} - खर्च {formatCurrency(plData.expenses.totalExpenses)}</p>
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${plData.isProfit ? 'text-green-700' : 'text-red-700'} print:text-black`}>
                      {formatCurrency(plData.netProfit)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!isLoading && !plData && (
            <div className="text-center py-12 text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>नफा-तोटा पत्रक पाहण्यासाठी तारखा निवडा आणि शोधा बटण दाबा</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
