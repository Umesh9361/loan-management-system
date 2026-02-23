import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Printer, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Building2, Landmark, Wallet, Users, Package, Scale } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";

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
  if (amount === 0) return "₹ 0.00";
  return `₹ ${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function BalanceSheet() {
  const fy = getDefaultFY();
  const [fyStartDate, setFyStartDate] = useState(fy.fyStartDate);
  const [asOfDate, setAsOfDate] = useState(fy.asOfDate);

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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="md:hidden">
          <MobileNav />
        </div>

        <div className="p-3 sm:p-6 max-w-5xl mx-auto w-full">
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
              <p className="text-gray-500">ताळेबंद तयार होत आहे...</p>
            </div>
          )}

          {balanceSheet && (
            <div id="print-area">
              <div className="hidden print:block text-center mb-4 border-b-2 border-black pb-3">
                <h2 className="text-lg font-bold">{company?.name || ""}</h2>
                {company?.address && <p className="text-sm">{company.address}</p>}
                <h3 className="text-base font-bold mt-2">ताळेबंद (Balance Sheet)</h3>
                <p className="text-sm">दिनांक: {formatDateDisplay(asOfDate)} पर्यंत | आर्थिक वर्ष: {formatDateDisplay(fyStartDate)} ते {formatDateDisplay(asOfDate)}</p>
              </div>

              {balanceSheet.isTallied ? (
                <div className="print:hidden mb-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">ताळेबंद जुळतो (Assets = Liabilities + Capital)</span>
                </div>
              ) : (
                <div className="print:hidden mb-3 flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-700">
                    फरक: {formatCurrency(balanceSheet.difference)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                <Card className="border-2 border-indigo-100 print:border print:border-black print:shadow-none">
                  <CardHeader className="bg-indigo-50 py-3 px-4 print:bg-white print:border-b print:border-black">
                    <CardTitle className="text-base font-bold text-indigo-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 print:hidden" />
                      मालमत्ता (Assets)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 print:bg-white">
                          <th className="text-left px-3 py-2 font-semibold">तपशील</th>
                          <th className="text-right px-3 py-2 font-semibold">रक्कम (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b hover:bg-indigo-50/30">
                          <td className="px-3 py-2 flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-indigo-500 print:hidden" />
                            <div>
                              <div className="font-medium">कर्ज व अग्रिम</div>
                              <div className="text-xs text-gray-500">
                                {balanceSheet.assets.loansAndAdvances.loanCount} कर्जे (मूळ: {formatCurrency(balanceSheet.assets.loansAndAdvances.principalTotal)}
                                {balanceSheet.assets.loansAndAdvances.collected > 0 && ` - वसूल: ${formatCurrency(balanceSheet.assets.loansAndAdvances.collected)}`})
                              </div>
                            </div>
                          </td>
                          <td className="text-right px-3 py-2 font-semibold">{formatCurrency(balanceSheet.assets.loansAndAdvances.total)}</td>
                        </tr>

                        <tr className="border-b hover:bg-indigo-50/30">
                          <td className="px-3 py-2 flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-green-500 print:hidden" />
                            <span className="font-medium">रोकड शिल्लक</span>
                          </td>
                          <td className="text-right px-3 py-2 font-semibold">{formatCurrency(balanceSheet.assets.cashBalance)}</td>
                        </tr>

                        {balanceSheet.assets.bankAccounts.length > 0 && (
                          <>
                            {balanceSheet.assets.bankAccounts.map((bank: any, i: number) => (
                              <tr key={`bank-${i}`} className="border-b hover:bg-indigo-50/30">
                                <td className="px-3 py-2 flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-blue-500 print:hidden" />
                                  <span>{bank.name}</span>
                                </td>
                                <td className="text-right px-3 py-2">{formatCurrency(bank.balance)}</td>
                              </tr>
                            ))}
                          </>
                        )}

                        {balanceSheet.assets.fixedAssets.length > 0 && (
                          <>
                            <tr className="border-b bg-gray-50 print:bg-white">
                              <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                <Package className="w-3.5 h-3.5 inline mr-1 print:hidden" />
                                स्थिर मालमत्ता (Fixed Assets)
                              </td>
                            </tr>
                            {balanceSheet.assets.fixedAssets.map((asset: any, i: number) => (
                              <tr key={`asset-${i}`} className="border-b hover:bg-indigo-50/30">
                                <td className="px-3 py-2 pl-6">{asset.name}</td>
                                <td className="text-right px-3 py-2">{formatCurrency(asset.balance)}</td>
                              </tr>
                            ))}
                          </>
                        )}

                        {balanceSheet.assets.debtors.length > 0 && (
                          <>
                            <tr className="border-b bg-gray-50 print:bg-white">
                              <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                <Users className="w-3.5 h-3.5 inline mr-1 print:hidden" />
                                देणेदार (Debtors)
                              </td>
                            </tr>
                            {balanceSheet.assets.debtors.map((d: any, i: number) => (
                              <tr key={`debtor-${i}`} className="border-b hover:bg-indigo-50/30">
                                <td className="px-3 py-2 pl-6">{d.name}</td>
                                <td className="text-right px-3 py-2">{formatCurrency(d.balance)}</td>
                              </tr>
                            ))}
                          </>
                        )}

                        <tr className="border-t-2 border-indigo-300 bg-indigo-50 font-bold print:bg-white print:border-t-2 print:border-black">
                          <td className="px-3 py-2.5">एकूण मालमत्ता</td>
                          <td className="text-right px-3 py-2.5 text-indigo-700 print:text-black">{formatCurrency(balanceSheet.assets.totalAssets)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                <Card className="border-2 border-rose-100 print:border print:border-black print:shadow-none">
                  <CardHeader className="bg-rose-50 py-3 px-4 print:bg-white print:border-b print:border-black">
                    <CardTitle className="text-base font-bold text-rose-900 flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 print:hidden" />
                      दायित्वे व भांडवल (Liabilities & Capital)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 print:bg-white">
                          <th className="text-left px-3 py-2 font-semibold">तपशील</th>
                          <th className="text-right px-3 py-2 font-semibold">रक्कम (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b bg-gray-50 print:bg-white">
                          <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                            <Scale className="w-3.5 h-3.5 inline mr-1 print:hidden" />
                            भांडवल खाते (Capital Account)
                          </td>
                        </tr>
                        <tr className="border-b hover:bg-rose-50/30">
                          <td className="px-3 py-1.5 pl-6 text-gray-700">प्रारंभिक भांडवल</td>
                          <td className="text-right px-3 py-1.5">{formatCurrency(balanceSheet.liabilities.capitalAccount.openingCapital)}</td>
                        </tr>
                        {balanceSheet.liabilities.capitalAccount.capitalAdded > 0 && (
                          <tr className="border-b hover:bg-rose-50/30">
                            <td className="px-3 py-1.5 pl-6 text-green-700">+ भांडवल जमा</td>
                            <td className="text-right px-3 py-1.5 text-green-600">+ {formatCurrency(balanceSheet.liabilities.capitalAccount.capitalAdded)}</td>
                          </tr>
                        )}
                        {balanceSheet.liabilities.capitalAccount.capitalWithdrawn > 0 && (
                          <tr className="border-b hover:bg-rose-50/30">
                            <td className="px-3 py-1.5 pl-6 text-red-700">- भांडवल काढणे</td>
                            <td className="text-right px-3 py-1.5 text-red-600">- {formatCurrency(balanceSheet.liabilities.capitalAccount.capitalWithdrawn)}</td>
                          </tr>
                        )}
                        <tr className="border-b hover:bg-rose-50/30">
                          <td className="px-3 py-1.5 pl-6">
                            {balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? (
                              <span className="text-green-700">+ निव्वळ नफा (P&L)</span>
                            ) : (
                              <span className="text-red-700">- निव्वळ तोटा (P&L)</span>
                            )}
                          </td>
                          <td className="text-right px-3 py-1.5">
                            {balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? (
                              <span className="text-green-600">+ {formatCurrency(balanceSheet.liabilities.capitalAccount.netProfit)}</span>
                            ) : (
                              <span className="text-red-600">- {formatCurrency(balanceSheet.liabilities.capitalAccount.netProfit)}</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b border-indigo-200 bg-indigo-50/50 font-semibold print:bg-white">
                          <td className="px-3 py-2 pl-6">अंतिम भांडवल</td>
                          <td className="text-right px-3 py-2">{formatCurrency(balanceSheet.liabilities.capitalAccount.closingCapital)}</td>
                        </tr>

                        {balanceSheet.liabilities.creditors.length > 0 && (
                          <>
                            <tr className="border-b bg-gray-50 print:bg-white">
                              <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                <Users className="w-3.5 h-3.5 inline mr-1 print:hidden" />
                                धनको (Creditors)
                              </td>
                            </tr>
                            {balanceSheet.liabilities.creditors.map((c: any, i: number) => (
                              <tr key={`cred-${i}`} className="border-b hover:bg-rose-50/30">
                                <td className="px-3 py-2 pl-6">{c.name}</td>
                                <td className="text-right px-3 py-2">{formatCurrency(c.balance)}</td>
                              </tr>
                            ))}
                          </>
                        )}

                        <tr className="border-t-2 border-rose-300 bg-rose-50 font-bold print:bg-white print:border-t-2 print:border-black">
                          <td className="px-3 py-2.5">एकूण दायित्वे व भांडवल</td>
                          <td className="text-right px-3 py-2.5 text-rose-700 print:text-black">{formatCurrency(balanceSheet.liabilities.totalLiabilities)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>

              {!balanceSheet.isTallied && (
                <Card className="mt-4 border-yellow-200 print:border print:border-black">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-yellow-700">
                      <AlertTriangle className="w-5 h-5" />
                      <div>
                        <p className="font-semibold">ताळेबंदात फरक आहे</p>
                        <p className="text-sm">
                          मालमत्ता: {formatCurrency(balanceSheet.assets.totalAssets)} | 
                          दायित्वे + भांडवल: {formatCurrency(balanceSheet.liabilities.totalLiabilities)} | 
                          फरक: {formatCurrency(balanceSheet.difference)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 print:hidden">
                <Card className="border-indigo-200">
                  <CardContent className="p-3 text-center">
                    <Landmark className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
                    <p className="text-xs text-gray-500">कर्ज शिल्लक</p>
                    <p className="text-sm font-bold text-indigo-700">{formatCurrency(balanceSheet.assets.loansAndAdvances.total)}</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200">
                  <CardContent className="p-3 text-center">
                    <Wallet className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="text-xs text-gray-500">रोकड शिल्लक</p>
                    <p className="text-sm font-bold text-green-700">{formatCurrency(balanceSheet.assets.cashBalance)}</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200">
                  <CardContent className="p-3 text-center">
                    <Scale className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-xs text-gray-500">भांडवल</p>
                    <p className="text-sm font-bold text-blue-700">{formatCurrency(balanceSheet.liabilities.capitalAccount.closingCapital)}</p>
                  </CardContent>
                </Card>
                <Card className={`border-${balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? 'green' : 'red'}-200`}>
                  <CardContent className="p-3 text-center">
                    {balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? (
                      <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 mx-auto mb-1 text-red-500" />
                    )}
                    <p className="text-xs text-gray-500">निव्वळ नफा/तोटा</p>
                    <p className={`text-sm font-bold ${balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {balanceSheet.liabilities.capitalAccount.netProfit >= 0 ? '+' : '-'} {formatCurrency(balanceSheet.liabilities.capitalAccount.netProfit)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {!isLoading && !balanceSheet && (
            <div className="text-center py-12 text-gray-400">
              <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>ताळेबंद पाहण्यासाठी तारखा निवडा आणि शोधा बटण दाबा</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
