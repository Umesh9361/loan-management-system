import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { displayNarration } from "@/lib/utils";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";

export default function CashDashboard() {
  // Fetch cash balance
  const { data: cashBalance } = useQuery({
    queryKey: ["/api/cash-balance"],
    queryFn: () => fetch("/api/cash-balance", { credentials: 'include' }).then(r => r.json()),
  });

  // Fetch recent transactions
  const { data: recentTransactions } = useQuery({
    queryKey: ["/api/cash-transactions"],
    queryFn: () => fetch("/api/cash-transactions?limit=5", { credentials: 'include' }).then(r => r.json()),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-white">
      <MobileNav />
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>
        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
      <div className="p-3 sm:p-6 md:p-8 md:max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">कैश डैशबोर्ड</h1>
        <Link href="/cash-transactions">
          <Button>
            सभी लेनदेन देखें
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm md:text-base font-medium">वर्तमान शेष</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{cashBalance?.balance?.toLocaleString('hi-IN') || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              कुल उपलब्ध नकद
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm md:text-base font-medium">आज की गतिविधि</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recentTransactions?.filter((t: any) => {
                const today = new Date().toISOString().split('T')[0];
                return t.date === today;
              })?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              आज के लेनदेन
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm md:text-base font-medium">नकद आवक</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₹{cashBalance?.totalIn?.toLocaleString('hi-IN') || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              कुल आवक राशि
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm md:text-base font-medium">नकद जावक</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ₹{Math.abs(cashBalance?.totalOut || 0).toLocaleString('hi-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
              कुल जावक राशि
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>हाल की गतिविधियां</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions && recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {recentTransactions.slice(0, 5).map((transaction: any) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 md:p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{displayNarration(transaction.narration)}</p>
                    <p className="text-sm md:text-base text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString('hi-IN')}
                    </p>
                  </div>
                  <div className={`font-bold ${transaction.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.type === 'IN' ? '+' : '-'}₹{Math.abs(transaction.amount).toLocaleString('hi-IN')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              कोई हाल की गतिविधि नहीं मिली
            </p>
          )}
        </CardContent>
      </Card>
    </div>
        </main>
      </div>
    </div>
  );
}