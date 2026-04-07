import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { SubscriptionReminder } from "@/components/subscription-reminder";
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
  X,
  MoreVertical,
  Receipt,
  AlertTriangle,
  Building,
  Award,
  User,
  Navigation,
  ArrowUpRight,
  ArrowDownRight,
  LogOut,
  Maximize2
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { AuthService } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { QrScanButton } from "@/components/qr-scanner-modal";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Area, AreaChart, ReferenceLine } from 'recharts';



export default function Dashboard() {
  const { toast } = useToast();
  const [progressPeriod, setProgressPeriod] = useState<'3m' | '1y' | '3y'>('3m');
  const [cardPeriod, setCardPeriod] = useState<'1m' | '3m' | '1y' | '3y'>('1m');
  const [graphZoomOpen, setGraphZoomOpen] = useState(false);

  const { data: stats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"], 
    staleTime: 30000,
    gcTime: 60000,
  });

  const { data: periodStats, isLoading: periodStatsLoading } = useQuery({
    queryKey: ["/api/dashboard/period-stats", cardPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/period-stats?period=${cardPeriod}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 30000,
    gcTime: 60000,
  });

  const { data: monthlyProgress, isLoading: progressLoading } = useQuery({
    queryKey: ["/api/dashboard/monthly-progress", progressPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/monthly-progress?period=${progressPeriod}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 60000,
    gcTime: 120000,
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

  const today = new Date().toISOString().split('T')[0];

  const formatCompact = (num: number): string => {
    const n = Number(num) || 0;
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(1)} कोटी`;
    if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(1)} लाख`;
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)} हजार`;
    return `${sign}${abs}`;
  };

  const periodLabels: Record<string, { title: string; prev: string }> = {
    '1m': { title: 'या महिन्यात', prev: 'मागील महिना' },
    '3m': { title: 'पाठीमागील 3 महिन्यांत', prev: 'त्याआधीचे 3 महिने' },
    '1y': { title: 'पाठीमागील वर्षात', prev: 'त्याआधीचे वर्ष' },
    '3y': { title: 'पाठीमागील 3 वर्षांत', prev: 'त्याआधीचे 3 वर्षे' },
  };
  
  const cur = (periodStats as any)?.current || {};
  const prev = (periodStats as any)?.previous || {};
  const pLabel = periodLabels[cardPeriod];
  
  const monthlyCards = [
    {
      title: `${pLabel.title} कर्ज वाटप`,
      value: cur.disbursements || 0,
      amount: `₹${formatCompact(cur.disbursementAmount || 0)}`,
      previousValue: prev.disbursements || 0,
      previousAmount: `₹${formatCompact(prev.disbursementAmount || 0)}`,
      prevLabel: pLabel.prev,
      icon: CreditCard,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-100",
      borderColor: "border-l-indigo-500",
      isCount: true,
    },
    {
      title: `${pLabel.title} कर्ज बंद`,
      value: cur.closures || 0,
      amount: `₹${formatCompact(cur.closureAmount || 0)}`,
      previousValue: prev.closures || 0,
      previousAmount: `₹${formatCompact(prev.closureAmount || 0)}`,
      prevLabel: pLabel.prev,
      icon: Lock,
      iconColor: "text-teal-600",
      iconBg: "bg-teal-100",
      borderColor: "border-l-teal-500",
      isCount: true,
    },
    {
      title: `${pLabel.title} व्यवहार`,
      value: cur.transactions || 0,
      amount: `₹${formatCompact((cur.cashIn || 0) + (cur.cashOut || 0))}`,
      previousValue: prev.transactions || 0,
      previousAmount: `₹${formatCompact((prev.cashIn || 0) + (prev.cashOut || 0))}`,
      prevLabel: pLabel.prev,
      icon: HandCoins,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-100",
      borderColor: "border-l-indigo-500",
      isCount: true,
    },
    {
      title: `${pLabel.title} रोकड नेट`,
      value: `₹${formatCompact((cur.cashIn || 0) - (cur.cashOut || 0))}`,
      previousValue: `₹${formatCompact((prev.cashIn || 0) - (prev.cashOut || 0))}`,
      prevLabel: pLabel.prev,
      icon: TrendingUp,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-100",
      borderColor: "border-l-emerald-500",
      isCount: false,
      numericValue: (cur.cashIn || 0) - (cur.cashOut || 0),
      numericPrev: (prev.cashIn || 0) - (prev.cashOut || 0),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50">
      <MobileNav />
      
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <SubscriptionReminder />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              
              <div className="lg:col-span-2 bg-gradient-to-r from-indigo-600 to-indigo-600 rounded-xl p-6 shadow-md relative">
                <div className="flex items-center space-x-4">
                  <div className="bg-white/90 rounded-lg p-0.5 shadow-md">
                    <img src="/icons/icon-192x192.png" alt="LonoPro" className="h-14 w-14 rounded-md" />
                  </div>
                  <div className="flex-1">
                    {company && (company as any).name && (company as any).licenseNumber ? (
                      <>
                        <h1 className="text-2xl font-bold text-white mb-1">{(company as any).name}</h1>
                        <div className="flex items-center space-x-2 mb-1">
                          <Award className="h-4 w-4 text-amber-300" />
                          <span className="text-sm font-medium text-indigo-100">
                            परवाना क्र: {(company as any).licenseNumber}
                          </span>
                        </div>
                        <p className="text-indigo-200 text-sm">{(company as any).address}</p>
                      </>
                    ) : (
                      <div>
                        <h1 className="text-2xl font-bold text-white">Welcome</h1>
                        <p className="text-indigo-200 text-sm mt-1">LonoPro</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">झटपट कामे</h3>
                <div className="space-y-2.5">
                  <Link href="/loans">
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm text-sm h-9">
                      <CreditCard className="h-4 w-4 mr-2" />
                      नवे कर्ज
                    </Button>
                  </Link>
                  <Link href="/mobile-cashbook">
                    <Button variant="outline" className="w-full border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 text-sm h-9">
                      <HandCoins className="h-4 w-4 mr-2" />
                      Cashbook
                    </Button>
                  </Link>
                  <div className="flex gap-2">
                    <Link href="/closure" className="flex-1">
                      <Button variant="outline" className="w-full border-gray-200 text-gray-700 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 text-sm h-9">
                        <Lock className="h-4 w-4 mr-2" />
                        कर्ज बंद
                      </Button>
                    </Link>
                    <QrScanButton className="hidden md:flex items-center justify-center h-9 w-9 rounded-md border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-colors shadow-sm" />
                  </div>
                  {isAdmin && (
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 md:hidden">
                      <div className="flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">मोबाईल शॉर्टकट बार</span>
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
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-100">
                    <Button 
                      variant="outline" 
                      className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-sm h-9"
                      onClick={async () => {
                        sessionStorage.removeItem('closure_summary_entries');
                        sessionStorage.removeItem('closure_summary_counter');
                        await AuthService.logout();
                        window.location.reload();
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Log Out
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-sm md:text-base font-semibold text-gray-500 uppercase tracking-wide">कामगिरी सारांश</h3>
                <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                  {[
                    { key: '1m' as const, label: 'महिना' },
                    ...(isAdmin ? [
                      { key: '3m' as const, label: '3 म.' },
                      { key: '1y' as const, label: '1 वर्ष' },
                      { key: '3y' as const, label: '3 वर्षे' },
                    ] : []),
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setCardPeriod(opt.key)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        cardPeriod === opt.key
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
                {monthlyCards.map((card: any) => {
                  const Icon = card.icon;
                  const isImprovement = card.isCount 
                    ? (card.value > card.previousValue) 
                    : ((card.numericValue || 0) >= (card.numericPrev || 0));
                  
                  return (
                    <div key={card.title} className={`bg-white border border-gray-100 border-l-4 ${card.borderColor} rounded-xl p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-all`}>
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className={`h-8 w-8 sm:h-10 sm:w-10 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.iconColor}`} />
                        </div>
                        <div className="text-right">
                          <p className="text-lg sm:text-2xl font-bold text-gray-900">{card.value}</p>
                          {card.amount && <p className="text-[10px] sm:text-xs font-medium text-gray-500">{card.amount}</p>}
                        </div>
                      </div>
                      
                      <div className="space-y-0.5 sm:space-y-1">
                        <p className="text-xs sm:text-sm font-medium text-gray-600 leading-tight">{card.title}</p>
                        <div className="flex items-center justify-between text-[10px] sm:text-xs">
                          <span className="text-gray-400 truncate mr-1">{card.prevLabel}: {card.previousValue}</span>
                          <span className={`flex items-center gap-0.5 font-semibold shrink-0 ${isImprovement ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isImprovement ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {card.isCount 
                              ? Math.abs(Number(card.value || 0) - Number(card.previousValue || 0))
                              : 'बदल'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 sm:p-6 mb-8">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <h3 className="text-sm sm:text-lg font-bold text-gray-800">
                  {progressPeriod === '3m' ? 'पाठीमागील 3 महिन्यांची' : progressPeriod === '1y' ? 'पाठीमागील वर्षाची' : 'पाठीमागील 3 वर्षांची'} कर्ज प्रगती
                </h3>
                <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                  {[
                    { key: '3m' as const, label: '3 महिने' },
                    ...(isAdmin ? [
                      { key: '1y' as const, label: '1 वर्ष' },
                      { key: '3y' as const, label: '3 वर्षे' },
                    ] : []),
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setProgressPeriod(opt.key)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        progressPeriod === opt.key
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-slate-50 to-indigo-50/50 border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-8" />
                    <h4 className="text-base font-semibold text-gray-700 text-center">मासिक कर्ज प्रगती</h4>
                    <button
                      onClick={() => setGraphZoomOpen(true)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
                      title="मोठा करा"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                  {progressLoading ? (
                    <div className="flex items-center justify-center h-[300px] text-gray-400">लोड होत आहे...</div>
                  ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={(monthlyProgress as any)?.monthlyData || []} margin={{ left: -10, right: 5, bottom: 5, top: 5 }}>
                      <defs>
                        <linearGradient id="gradDisb" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gradClos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.12}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: progressPeriod === '3y' ? 7 : 8, fill: '#94a3b8' }} 
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval={progressPeriod === '3y' ? 3 : progressPeriod === '1y' ? 1 : 0}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={35} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(value: any, name: string) => {
                          if (name === 'एकूण रक्कम') return [`₹${formatCompact(Number(value))}`, name];
                          return [`${value}`, name];
                        }}
                        contentStyle={{ 
                          backgroundColor: 'rgba(255,255,255,0.95)', 
                          border: 'none', 
                          borderRadius: '12px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          padding: '10px 14px'
                        }}
                        cursor={{ stroke: '#c7d2fe', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} iconType="circle" iconSize={8} />
                      <Area type="monotone" dataKey="disbursements" stroke="#4f46e5" strokeWidth={2.5} fill="url(#gradDisb)" name="कर्ज वाटप" dot={progressPeriod === '3m' ? { fill: '#4f46e5', r: 3, strokeWidth: 2, stroke: '#fff' } : false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                      <Area type="monotone" dataKey="closures" stroke="#0d9488" strokeWidth={2.5} fill="url(#gradClos)" name="कर्ज बंद" dot={progressPeriod === '3m' ? { fill: '#0d9488', r: 3, strokeWidth: 2, stroke: '#fff' } : false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                      <Area type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} fill="url(#gradNet)" name="निव्वळ वाढ" dot={progressPeriod === '3m' ? { fill: '#f59e0b', r: 3, strokeWidth: 2, stroke: '#fff' } : false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} strokeDasharray="5 3" />
                      <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-gray-100 rounded-xl p-5">
                    <h4 className="text-base font-semibold text-gray-700 mb-4 text-center">
                      {progressPeriod === '3m' ? '3 महिन्यांची' : progressPeriod === '1y' ? 'वर्षाची' : '3 वर्षांची'} कामगिरी
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
                      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 sm:p-4 md:p-5 text-center">
                        <div className="text-lg sm:text-2xl font-bold text-indigo-700">
                          {(monthlyProgress as any)?.summary?.totalDisbursements || 0}
                        </div>
                        <div className="text-xs sm:text-sm md:text-base font-medium text-indigo-600">एकूण कर्ज वाटप</div>
                        <div className="text-[10px] sm:text-xs text-indigo-400 mt-0.5">{progressPeriod === '3m' ? '3 महिन्यांमध्ये' : progressPeriod === '1y' ? '1 वर्षामध्ये' : '3 वर्षांमध्ये'}</div>
                      </div>
                      <div className="bg-teal-50 border border-teal-100 rounded-lg p-2.5 sm:p-4 md:p-5 text-center">
                        <div className="text-lg sm:text-2xl font-bold text-teal-700">
                          {(monthlyProgress as any)?.summary?.totalClosures || 0}
                        </div>
                        <div className="text-xs sm:text-sm md:text-base font-medium text-teal-600">एकूण कर्ज बंद</div>
                        <div className="text-[10px] sm:text-xs text-teal-400 mt-0.5">{progressPeriod === '3m' ? '3 महिन्यांमध्ये' : progressPeriod === '1y' ? '1 वर्षामध्ये' : '3 वर्षांमध्ये'}</div>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 sm:p-4 md:p-5 text-center">
                        <div className="text-sm sm:text-xl font-bold text-indigo-700">
                          ₹{formatCompact((monthlyProgress as any)?.summary?.totalAmount || 0)}
                        </div>
                        <div className="text-xs sm:text-sm md:text-base font-medium text-indigo-600">एकूण व्यवहार</div>
                        <div className="text-[10px] sm:text-xs text-indigo-400 mt-0.5">वास्तविक रक्कम</div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 sm:p-4 md:p-5 text-center">
                        <div className="text-lg sm:text-2xl font-bold text-emerald-700">
                          {(monthlyProgress as any)?.summary?.successRate || 0}%
                        </div>
                        <div className="text-xs sm:text-sm md:text-base font-medium text-emerald-600">यशस्वी दर</div>
                        <div className="text-[10px] sm:text-xs text-emerald-400 mt-0.5">कर्ज वसुली</div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-lg p-3 sm:p-4 md:p-5">
                      <h5 className="font-semibold text-gray-700 mb-2 sm:mb-3 text-center text-xs sm:text-sm md:text-base">वाढीचे निर्देशक</h5>
                      <div className="space-y-2">
                        {(() => {
                          const summary = (monthlyProgress as any)?.summary || {};
                          const monthsInPeriod = progressPeriod === '3y' ? 36 : progressPeriod === '1y' ? 12 : 3;
                          const avgMonthlyDisb = monthsInPeriod > 0 ? Math.round((summary.totalDisbursements || 0) / monthsInPeriod * 10) / 10 : 0;
                          const netGrowth = summary.netGrowth || 0;
                          const successRate = summary.successRate || 0;
                          return (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-gray-500">मासिक औसत कर्ज:</span>
                                <span className="font-semibold text-xs sm:text-sm text-indigo-600">{avgMonthlyDisb}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-gray-500">निव्वळ वाढ:</span>
                                <span className={`font-semibold text-xs sm:text-sm flex items-center gap-0.5 ${netGrowth > 0 ? 'text-emerald-600' : netGrowth < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                  {netGrowth > 0 ? <ArrowUpRight className="h-3 w-3" /> : netGrowth < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                                  {netGrowth > 0 ? '+' : ''}{netGrowth}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-gray-500">चालू ट्रेंड:</span>
                                <span className={`font-semibold text-xs sm:text-sm ${netGrowth > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                                  {netGrowth > 0 ? 'वाढत्या' : netGrowth < 0 ? 'घटत्या' : 'स्थिर'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-gray-500">एकूण रक्कम:</span>
                                <span className="font-semibold text-xs sm:text-sm text-indigo-600">₹{formatCompact(summary.totalAmount || 0)}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

              {false && (
              <Card>
                <CardHeader>
                  <CardTitle>ग्रुप वार सारांश</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Array.isArray(groups) && (groups as any[]).slice(0, 5).map((group: any, index: number) => {
                      const colors = [
                        { bg: "bg-indigo-100", text: "text-indigo-600" },
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

      <Dialog open={graphZoomOpen} onOpenChange={setGraphZoomOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-4">
            <h3 className="text-lg font-bold text-gray-800">
              {progressPeriod === '3m' ? 'पाठीमागील 3 महिन्यांची' : progressPeriod === '1y' ? 'पाठीमागील वर्षाची' : 'पाठीमागील 3 वर्षांची'} कर्ज प्रगती
            </h3>
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              {[
                { key: '3m' as const, label: '3 महिने' },
                ...(isAdmin ? [
                  { key: '1y' as const, label: '1 वर्ष' },
                  { key: '3y' as const, label: '3 वर्षे' },
                ] : []),
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setProgressPeriod(opt.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    progressPeriod === opt.key
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {progressLoading ? (
            <div className="flex items-center justify-center h-[60vh] text-gray-400">लोड होत आहे...</div>
          ) : (
          <ResponsiveContainer width="100%" height={Math.min(window.innerHeight * 0.65, 450)}>
            <AreaChart data={(monthlyProgress as any)?.monthlyData || []} margin={{ left: -5, right: 10, bottom: 5, top: 10 }}>
              <defs>
                <linearGradient id="zGradDisb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="zGradClos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="zGradNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: window.innerWidth < 640 ? 8 : (progressPeriod === '3y' ? 10 : 12), fill: '#94a3b8' }} 
                angle={-40}
                textAnchor="end"
                height={65}
                interval={progressPeriod === '3y' ? (window.innerWidth < 640 ? 4 : 2) : progressPeriod === '1y' ? (window.innerWidth < 640 ? 1 : 0) : 0}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: window.innerWidth < 640 ? 10 : 12, fill: '#94a3b8' }} width={window.innerWidth < 640 ? 35 : 45} axisLine={false} tickLine={false} />
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (name === 'एकूण रक्कम') return [`₹${formatCompact(Number(value))}`, name];
                  return [`${value}`, name];
                }}
                contentStyle={{ 
                  backgroundColor: 'rgba(255,255,255,0.95)', 
                  border: 'none', 
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  padding: '10px 14px'
                }}
                cursor={{ stroke: '#c7d2fe', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Legend wrapperStyle={{ fontSize: window.innerWidth < 640 ? '11px' : '13px', paddingTop: '8px' }} iconType="circle" iconSize={10} />
              <Area type="monotone" dataKey="disbursements" stroke="#4f46e5" strokeWidth={3} fill="url(#zGradDisb)" name="कर्ज वाटप" dot={{ fill: '#4f46e5', r: window.innerWidth < 640 ? 3 : 5, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }} />
              <Area type="monotone" dataKey="closures" stroke="#0d9488" strokeWidth={3} fill="url(#zGradClos)" name="कर्ज बंद" dot={{ fill: '#0d9488', r: window.innerWidth < 640 ? 3 : 5, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }} />
              <Area type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2.5} fill="url(#zGradNet)" name="निव्वळ वाढ" dot={{ fill: '#f59e0b', r: window.innerWidth < 640 ? 3 : 5, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }} strokeDasharray="5 3" />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
