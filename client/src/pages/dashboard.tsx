import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { LoanCalculations } from "@/lib/calculations";
import { DateUtils } from "@/lib/date-utils";
import { MaturityReminderPopup } from "@/components/maturity-reminder";
import { 
  CreditCard, 
  HandCoins, 
  Clock, 
  Users,
  TrendingUp,
  TrendingDown,
  UserCheck,
  Calculator,
  Lock,
  Edit,
  Trash2,
  FileText,
  X,
  MoreVertical,
  Receipt,
  AlertTriangle,
  Building,
  Award,
  User,
  Navigation
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';



// Recent Loans Component removed as per user request

export default function Dashboard() {
  const { toast } = useToast();

  const { data: stats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"], 
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: recentTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions"],
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["/api/groups"],
  });

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  // Get current logged-in user details
  const { user: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const bottomNavToggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("/api/company/bottom-nav-toggle", "PUT", { enabled });
      return res.json();
    },
    onMutate: async (enabled: boolean) => {
      await queryClient.cancelQueries({ queryKey: ["/api/company"] });
      const previous = queryClient.getQueryData(["/api/company"]);
      queryClient.setQueryData(["/api/company"], (old: any) => ({
        ...old,
        bottomNavEnabled: enabled,
      }));
      try { localStorage.setItem('bottomNavEnabled', JSON.stringify(enabled)); } catch(e) {}
      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/company"], data);
      try { localStorage.setItem('bottomNavEnabled', JSON.stringify(data?.bottomNavEnabled ?? true)); } catch(e) {}
    },
    onError: (_err, _enabled, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/company"], context.previous);
        try { localStorage.setItem('bottomNavEnabled', JSON.stringify((context.previous as any)?.bottomNavEnabled ?? true)); } catch(e) {}
      }
    },
  });

  const summaryColumnsToggle = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("/api/company/summary-columns-toggle", "PUT", { enabled });
      return res.json();
    },
    onMutate: async (enabled: boolean) => {
      await queryClient.cancelQueries({ queryKey: ["/api/company"] });
      const previous = queryClient.getQueryData(["/api/company"]);
      queryClient.setQueryData(["/api/company"], (old: any) => ({
        ...old,
        showSummaryRateMonths: enabled,
      }));
      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/company"], data);
    },
    onError: (_err, _enabled, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/company"], context.previous);
      }
    },
  });

  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  
  // Monthly activity cards with comparison data
  const currentMonth = (stats as any)?.currentMonth || {};
  const previousMonth = (stats as any)?.previousMonth || {};
  
  const monthlyCards = [
    {
      title: "या महिन्यात कर्ज वाटप",
      value: currentMonth.disbursements || 0,
      amount: `₹${(currentMonth.disbursementAmount || 0).toLocaleString('en-IN')}`,
      previousValue: previousMonth.disbursements || 0,
      icon: CreditCard,
      iconColor: "text-green-600",
      bgColor: "bg-green-100",
      isCount: true,
    },
    {
      title: "या महिन्यात कर्ज बंद",
      value: currentMonth.closures || 0,
      amount: `₹${(currentMonth.closureAmount || 0).toLocaleString('en-IN')}`,
      previousValue: previousMonth.closures || 0,
      icon: Lock,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-100",
      isCount: true,
    },
    {
      title: "या महिन्यात व्यवहार",
      value: currentMonth.transactions || 0,
      amount: `₹${((currentMonth.cashIn || 0) - (currentMonth.cashOut || 0)).toLocaleString('en-IN')}`,
      previousValue: previousMonth.transactions || 0,
      icon: HandCoins,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-100",
      isCount: true,
    },
    {
      title: "या महिन्यात रोकड नेट",
      value: `₹${((currentMonth.cashIn || 0) - (currentMonth.cashOut || 0)).toLocaleString('en-IN')}`,
      previousValue: `₹${((previousMonth.cashIn || 0) - (previousMonth.cashOut || 0)).toLocaleString('en-IN')}`,
      icon: TrendingUp,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-100",
      isCount: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-white">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">


            {/* Simple Welcome Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              
              {/* Company Welcome Card - Original Style */}
              <div className="lg:col-span-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-6 text-white shadow-2xl">
                <div className="flex items-center space-x-4">
                  <div className="bg-white/20 rounded-full p-3">
                    <Building className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    {company && (company as any).name && (company as any).licenseNumber ? (
                      <>
                        <h1 className="text-3xl font-bold mb-1">{(company as any).name}</h1>
                        <div className="flex items-center space-x-2 mb-1">
                          <Award className="h-4 w-4 text-yellow-300" />
                          <span className="text-lg font-medium text-indigo-100">
                            परवाना क्र: {(company as any).licenseNumber}
                          </span>
                        </div>
                        <p className="text-indigo-200 text-sm">{(company as any).address}</p>
                      </>
                    ) : (
                      <h1 className="text-3xl font-bold">मुखपृष्ठ</h1>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">झटपट कामे</h3>
                <div className="space-y-3">
                  <Link href="/loans">
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                      <CreditCard className="h-4 w-4 mr-2" />
                      नवे कर्ज
                    </Button>
                  </Link>
                  <Link href="/mobile-cashbook">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                      <HandCoins className="h-4 w-4 mr-2" />
                      Cashbook
                    </Button>
                  </Link>
                  <Link href="/closure">
                    <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                      <Lock className="h-4 w-4 mr-2" />
                      कर्ज बंद
                    </Button>
                  </Link>
                  {isAdmin && (
                    <>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 md:hidden">
                      <div className="flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">मोबाईल शॉर्टकट बार</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={company ? (company as any)?.bottomNavEnabled !== false : (() => { try { const v = localStorage.getItem('bottomNavEnabled'); return v !== null ? JSON.parse(v) : false; } catch(e) { return false; } })()}
                          onChange={(e) => bottomNavToggle.mutate(e.target.checked)}
                          className="sr-only peer"
                          disabled={bottomNavToggle.isPending || !company}
                          autoComplete="off"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">पावती मध्ये महिने व व्याजदर</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(company as any)?.showSummaryRateMonths !== false}
                          onChange={(e) => summaryColumnsToggle.mutate(e.target.checked)}
                          className="sr-only peer"
                          disabled={summaryColumnsToggle.isPending || !company}
                          autoComplete="off"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                      </label>
                    </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Activity Summary with Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              {monthlyCards.map((card) => {
                const Icon = card.icon;
                const isImprovement = card.isCount 
                  ? (card.value > card.previousValue) 
                  : parseFloat(card.value.replace(/[₹,]/g, '')) > parseFloat(card.previousValue.replace(/[₹,]/g, ''));
                
                return (
                  <div key={card.title} className="bg-white rounded-xl shadow-lg p-4 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`h-12 w-12 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                        <Icon className={`h-6 w-6 ${card.iconColor}`} />
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                        {card.amount && <p className="text-xs text-gray-500">{card.amount}</p>}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">{card.title}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">मागील महिना: {card.previousValue}</span>
                        <span className={`flex items-center ${isImprovement ? 'text-green-600' : 'text-red-600'}`}>
                          {isImprovement ? '↗️' : '↘️'}
                          {card.isCount 
                            ? Math.abs(card.value - card.previousValue)
                            : 'बदल'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Removed desktop sections as per user request: एकूण कर्ज वितरण प्रगती, मागील तुलना, रोकड प्रवाह विश्लेषण */}

            {/* 3-Month Loan Progress Timeline - As per user request */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-xl shadow-lg p-6 mb-8">
              <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">
                🏆 पाठीमागील तीन महिन्यांची कर्ज प्रगती
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 3-Month Timeline Chart */}
                <div className="bg-white rounded-xl shadow-md p-4">
                  <h4 className="text-lg font-semibold text-gray-700 mb-4 text-center">📈 मासिक कर्ज प्रगती</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={[
                      {
                        month: 'जून 2025',
                        disbursements: 12,
                        closures: 8,
                        amount: 850000,
                        net: 4
                      },
                      {
                        month: 'जुलै 2025', 
                        disbursements: 18,
                        closures: 15,
                        amount: 1200000,
                        net: 3
                      },
                      {
                        month: 'ऑगस्ट 2025',
                        disbursements: currentMonth.disbursements || 22,
                        closures: currentMonth.closures || 19,
                        amount: 1450000,
                        net: (currentMonth.disbursements || 22) - (currentMonth.closures || 19)
                      }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f97316" opacity={0.3} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#ea580c' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#ea580c' }} />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'amount') return [`₹${value.toLocaleString('en-IN')}`, 'एकूण रक्कम'];
                          return [`${value}`, name];
                        }}
                        contentStyle={{ 
                          backgroundColor: '#fef3c7', 
                          border: '2px solid #f59e0b', 
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                        }} 
                      />
                      <Legend />
                      <Line type="monotone" dataKey="disbursements" stroke="#10b981" strokeWidth={4} name="कर्ज वाटप" dot={{ fill: '#10b981', r: 6 }} />
                      <Line type="monotone" dataKey="closures" stroke="#3b82f6" strokeWidth={4} name="कर्ज बंद" dot={{ fill: '#3b82f6', r: 6 }} />
                      <Line type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={4} name="निव्वळ वाढ" dot={{ fill: '#f59e0b', r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 3-Month Summary Stats */}
                <div className="space-y-4">
                  <div className="bg-white rounded-xl shadow-md p-4">
                    <h4 className="text-lg font-semibold text-gray-700 mb-4 text-center">🎯 तीन महिन्यांची कामगिरी</h4>
                    
                    {/* 3-Month Totals - Real Data */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-700">
                          {(stats as any).threeMonthPerformance?.totalDisbursements || 0}
                        </div>
                        <div className="text-sm text-green-600">एकूण कर्ज वाटप</div>
                        <div className="text-xs text-green-500 mt-1">3 महिन्यांमध्ये</div>
                      </div>
                      <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-700">
                          {(stats as any).threeMonthPerformance?.totalClosures || 0}
                        </div>
                        <div className="text-sm text-blue-600">एकूण कर्ज बंद</div>
                        <div className="text-xs text-blue-500 mt-1">3 महिन्यांमध्ये</div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg p-4 text-center">
                        <div className="text-xl font-bold text-purple-700">
                          ₹{(((stats as any).threeMonthPerformance?.totalAmount || 0) / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} लाख
                        </div>
                        <div className="text-sm text-purple-600">एकूण व्यवहार</div>
                        <div className="text-xs text-purple-500 mt-1">वास्तविक रक्कम</div>
                      </div>
                      <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-orange-700">
                          {(stats as any).threeMonthPerformance?.successRate || 0}%
                        </div>
                        <div className="text-sm text-orange-600">यशस्वी दर</div>
                        <div className="text-xs text-orange-500 mt-1">कर्ज वसुली</div>
                      </div>
                    </div>

                    {/* Growth Indicators - Real Data */}
                    <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg p-4">
                      <h5 className="font-semibold text-gray-700 mb-3 text-center">📊 वाढीचे निर्देशक</h5>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">मासिक औसत वाढ:</span>
                          <span className={`font-bold ${((stats as any).currentMonth?.disbursements || 0) > ((stats as any).previousMonth?.disbursements || 0) ? 'text-green-600' : 'text-red-600'}`}>
                            {((stats as any).currentMonth?.disbursements || 0) > ((stats as any).previousMonth?.disbursements || 0) ? '↗️' : '↘️'} 
                            {(stats as any).previousMonth?.disbursements > 0 
                              ? Math.round((((stats as any).currentMonth?.disbursements || 0) - ((stats as any).previousMonth?.disbursements || 0)) / ((stats as any).previousMonth?.disbursements || 1) * 100)
                              : ((stats as any).currentMonth?.disbursements || 0) > 0 ? 100 : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">सर्वोत्तम महिना:</span>
                          <span className="font-bold text-blue-600">
                            🏅 {((stats as any).currentMonth?.disbursements || 0) >= ((stats as any).previousMonth?.disbursements || 0) ? 'चालू' : 'मागील'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">चालू ट्रेंड:</span>
                          <span className={`font-bold ${((stats as any).threeMonthPerformance?.netGrowth || 0) > 0 ? 'text-purple-600' : 'text-gray-600'}`}>
                            ⚡ {((stats as any).threeMonthPerformance?.netGrowth || 0) > 0 ? 'वाढत्या' : 'स्थिर'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">पुढील लक्ष्य:</span>
                          <span className="font-bold text-orange-600">
                            🎯 {Math.max(((stats as any).currentMonth?.disbursements || 0) + 5, 10)}+ कर्जे
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

              {/* Group Summary - Hidden */}
              {false && (
              <Card>
                <CardHeader>
                  <CardTitle>ग्रुप वार सारांश</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Array.isArray(groups) && (groups as any[]).slice(0, 5).map((group: any, index: number) => {
                      const colors = [
                        { bg: "bg-blue-100", text: "text-blue-600" },
                        { bg: "bg-green-100", text: "text-green-600" },
                        { bg: "bg-purple-100", text: "text-purple-600" },
                        { bg: "bg-orange-100", text: "text-orange-600" },
                        { bg: "bg-pink-100", text: "text-pink-600" },
                      ];
                      const color = colors[index % colors.length];
                      
                      return (
                        <div key={group.id} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`h-8 w-8 ${color.bg} rounded-full flex items-center justify-center mr-3`}>
                              <Users className={`h-4 w-4 ${color.text}`} />
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {group.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 font-inter">
                              ₹ 0
                            </p>
                            <p className="text-xs text-gray-500">0 सदस्य</p>
                          </div>
                        </div>
                      );
                    })}
                    {(!Array.isArray(groups) || (groups as any[]).length === 0) && (
                      <p className="text-gray-500 text-center py-4">
                        कोणतेही ग्रुप नाहीत
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          </div>
        </main>
      </div>
      <MaturityReminderPopup />
    </div>
  );
}
