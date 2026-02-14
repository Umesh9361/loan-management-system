import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface LoanCashImpactProps {
  loanId?: string;
  showDetails?: boolean;
}

export default function LoanCashImpact({ loanId, showDetails = true }: LoanCashImpactProps) {
  // Fetch loan transactions
  const { data: transactions } = useQuery({
    queryKey: ["/api/transactions", loanId],
    enabled: !!loanId,
    queryFn: () => {
      const params = new URLSearchParams();
      if (loanId) params.append('loanId', loanId);
      return fetch(`/api/transactions?${params}`, { credentials: 'include' }).then(r => r.json());
    },
  });

  // Fetch related cash transactions
  const { data: cashTransactions } = useQuery({
    queryKey: ["/api/cash-transactions"],
  });

  const transactionsList = Array.isArray(transactions) ? transactions : [];
  const cashTransactionsList = Array.isArray(cashTransactions) ? cashTransactions : [];

  // Find related cash transactions
  const relatedCashTransactions = cashTransactionsList.filter((ct: any) => 
    ct.narration && loanId && ct.narration.includes(loanId.substring(0, 8))
  );

  // Calculate loan impact on cash
  const loanImpact = transactionsList.reduce((acc, t) => {
    if (t.transactionType === 'disbursement') {
      acc.disbursed += Number(t.amount);
    } else if (t.transactionType === 'repayment') {
      acc.repaid += Number(t.amount);
    }
    return acc;
  }, { disbursed: 0, repaid: 0 });

  const netCashFlow = loanImpact.repaid - loanImpact.disbursed;

  if (!showDetails || !loanId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-sm">
          <Wallet className="h-4 w-4 mr-2" />
          रोकड प्रभाव (Cash Impact)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Loan Disbursement */}
          <div className="flex items-center justify-between p-2 bg-red-50 rounded">
            <div className="flex items-center">
              <ArrowDownCircle className="h-4 w-4 text-red-600 mr-2" />
              <span className="text-sm">कर्ज दिले (Disbursed)</span>
            </div>
            <span className="text-sm font-semibold text-red-600">
              -₹{loanImpact.disbursed.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Loan Repayment */}
          <div className="flex items-center justify-between p-2 bg-green-50 rounded">
            <div className="flex items-center">
              <ArrowUpCircle className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm">परतफेड (Repaid)</span>
            </div>
            <span className="text-sm font-semibold text-green-600">
              +₹{loanImpact.repaid.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Net Cash Flow */}
          <div className="border-t pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 text-indigo-600 mr-2" />
                <span className="text-sm font-medium">नेट रोकड प्रवाह</span>
              </div>
              <Badge variant={netCashFlow >= 0 ? "default" : "destructive"}>
                ₹{Math.abs(netCashFlow).toLocaleString('en-IN')}
                {netCashFlow >= 0 ? ' (Profit)' : ' (Outstanding)'}
              </Badge>
            </div>
          </div>

          {/* Related Cash Transactions */}
          {relatedCashTransactions.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-600 mb-2">संबंधित रोकड व्यवहार:</p>
              <div className="space-y-1">
                {relatedCashTransactions.slice(0, 3).map((ct: any) => (
                  <div key={ct.id} className="text-xs flex justify-between">
                    <span className="text-gray-600">
                      {new Date(ct.transactionDate).toLocaleDateString('en-GB')}
                    </span>
                    <span className={ct.transactionType === 'cash_in' ? 'text-green-600' : 'text-red-600'}>
                      {ct.transactionType === 'cash_in' ? '+' : '-'}₹{Number(ct.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}