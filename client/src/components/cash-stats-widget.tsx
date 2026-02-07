import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function CashStatsWidget() {
  // Fetch cash balance
  const { data: balanceData } = useQuery({
    queryKey: ["/api/cash-balance"],
  });

  // Fetch recent transactions for summary
  const { data: transactions } = useQuery({
    queryKey: ["/api/cash-transactions"],
  });

  // Fetch parties count
  const { data: parties } = useQuery({
    queryKey: ["/api/parties"],
  });

  const balance = (balanceData as any)?.balance || 0;
  const transactionsList = Array.isArray(transactions) ? transactions : [];
  const partiesCount = Array.isArray(parties) ? parties.length : 0;

  // Calculate today's transactions
  const today = new Date().toISOString().split('T')[0];
  const todayTransactions = transactionsList.filter((t: any) => 
    t.transactionDate === today
  );

  const todayStats = todayTransactions.reduce(
    (acc, t) => {
      const amount = Number(t.amount);
      if (t.transactionType === 'cash_in') {
        acc.cashIn += amount;
      } else {
        acc.cashOut += amount;
      }
      return acc;
    },
    { cashIn: 0, cashOut: 0 }
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Current Cash Balance */}
      <Card className="stats-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">रोकड शिल्लक</p>
              <p className="text-3xl font-bold text-primary">₹{balance.toLocaleString('en-IN')}</p>
              <p className="text-muted-foreground text-xs">एकूण रोकड</p>
            </div>
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Cash In */}
      <Card className="stats-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">आजचे पैसे आले</p>
              <p className="text-3xl font-bold text-green-600">₹{todayStats.cashIn.toLocaleString('en-IN')}</p>
              <p className="text-muted-foreground text-xs">आजची प्राप्ती</p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Cash Out */}
      <Card className="stats-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">आजचे पैसे दिले</p>
              <p className="text-3xl font-bold text-red-600">₹{todayStats.cashOut.toLocaleString('en-IN')}</p>
              <p className="text-muted-foreground text-xs">आजचा खर्च</p>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Parties */}
      <Card className="stats-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">एकूण व्यक्ती</p>
              <p className="text-3xl font-bold text-foreground">{partiesCount}</p>
              <p className="text-muted-foreground text-xs">नोंदणीकृत व्यक्ती</p>
            </div>
            <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}