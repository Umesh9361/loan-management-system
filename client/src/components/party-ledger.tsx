import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, PrinterIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DateUtils } from "@/lib/date-utils";
import PartySelector from "@/components/party-selector";

interface PartyLedgerProps {
  className?: string;
}

export default function PartyLedger({ className }: PartyLedgerProps) {
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Fetch party details
  const { data: parties } = useQuery({
    queryKey: ["/api/parties"],
  });

  const selectedParty = Array.isArray(parties) 
    ? parties.find((p: any) => p.id === selectedPartyId)
    : null;

  // Fetch cash transactions for the selected party
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/cash-transactions", { 
      partyId: selectedPartyId,
      dateFrom,
      dateTo 
    }],
    enabled: !!selectedPartyId,
  });

  const transactionsList = Array.isArray(transactions) ? transactions : [];

  // Calculate opening balance for the date range
  const getOpeningBalance = () => {
    if (!selectedParty) return { amount: 0, type: "credit" };
    
    const openingBalance = parseFloat(selectedParty.openingBalance || "0");
    const openingType = selectedParty.openingBalanceType || "credit";
    
    return {
      amount: openingBalance,
      type: openingType,
      narration: selectedParty.openingBalanceNarration || "Opening Balance"
    };
  };

  // Calculate running balance for each transaction
  const getTransactionsWithBalance = () => {
    if (!transactionsList.length) return [];
    
    const opening = getOpeningBalance();
    let runningBalance = opening.type === "credit" ? opening.amount : -opening.amount;
    
    return transactionsList.map((txn: any) => {
      const amount = parseFloat(txn.amount);
      
      // ACCURATE ACCOUNTING LOGIC - NO MISMATCH:
      // From Party's perspective in their account statement:
      
      if (txn.partyId === selectedPartyId) {
        // This is a direct party transaction
        if (txn.transactionType === "cash_in") {
          // Party gave us money - reduces their balance (they owe us less)
          // Example: Party had 1000 Credit, gave us 200, now 800 Credit
          runningBalance -= amount;
        } else if (txn.transactionType === "cash_out") {
          // We gave money to party - increases their balance (we owe them more)
          // Example: Party had 1000 Credit, we gave 200, now 1200 Credit
          runningBalance += amount;
        }
      } else if (txn.fromAccount === selectedPartyId) {
        // Party is the sender in a transfer - money going from party to someone
        // This reduces party's balance (they paid someone)
        runningBalance -= amount;
      } else if (txn.toAccount === selectedPartyId) {
        // Party is the receiver in a transfer - money coming to party from someone
        // This increases party's balance (someone paid them)
        runningBalance += amount;
      }
      
      return {
        ...txn,
        runningBalance,
        balanceType: runningBalance >= 0 ? "credit" : "debit"
      };
    });
  };

  const transactionsWithBalance = getTransactionsWithBalance();
  const opening = getOpeningBalance();
  const finalBalance = transactionsWithBalance.length > 0 
    ? transactionsWithBalance[transactionsWithBalance.length - 1].runningBalance 
    : (opening.type === "credit" ? opening.amount : -opening.amount);

  const handlePrint = () => {
    window.print();
  };

  if (!selectedPartyId) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Party Ledger (व्यक्ती खातेवही)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <PartySelector
              value={selectedPartyId}
              onValueChange={(value) => setSelectedPartyId(value || "")}
              placeholder="व्यक्ती निवडा..."
            />
            <p className="text-sm text-gray-600 text-center py-8">
              खातेवही पाहण्यासाठी व्यक्ती निवडा
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Print Header - Only visible during print */}
      <div className="print-only mb-6">
        <div className="text-center border-b-2 border-gray-300 pb-4 mb-4">
          <h1 className="text-2xl font-bold">Party Account Statement</h1>
          <h2 className="text-xl">{selectedParty?.name || "Unknown Party"}</h2>
          <p className="text-sm">Period: {DateUtils.formatForDisplay(dateFrom)} to {DateUtils.formatForDisplay(dateTo)}</p>
        </div>
      </div>

      {/* Screen Header */}
      <Card className="no-print mb-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              📊 Party Ledger (व्यक्ती खातेवही)
            </span>
            <Button onClick={handlePrint} variant="outline" size="sm">
              <PrinterIcon className="h-4 w-4 mr-2" />
              Print
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PartySelector
              value={selectedPartyId}
              onValueChange={(value) => setSelectedPartyId(value || "")}
              placeholder="व्यक्ती निवडा..."
            />
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">To Date</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Party Details */}
      {selectedParty && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-bold text-lg">{selectedParty.name}</h3>
                {selectedParty.mobile && <p className="text-sm">Mobile: {selectedParty.mobile}</p>}
                {selectedParty.address && <p className="text-sm">Address: {selectedParty.address}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">Opening Balance:</p>
                <p className={`text-lg font-bold ${opening.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                  ₹{opening.amount.toLocaleString()} {opening.type === "credit" ? "Cr" : "Dr"}
                </p>
                <p className="text-xs text-gray-500">{opening.narration}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Particulars</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Opening Balance Row */}
                <tr className="bg-blue-50">
                  <td className="px-4 py-3 text-sm">
                    {DateUtils.formatForDisplay(selectedParty?.openingBalanceDate || dateFrom)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    Opening Balance
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {opening.type === "debit" ? `₹${opening.amount.toLocaleString()}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {opening.type === "credit" ? `₹${opening.amount.toLocaleString()}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    <Badge variant={opening.type === "credit" ? "default" : "destructive"}>
                      ₹{opening.amount.toLocaleString()} {opening.type === "credit" ? "Cr" : "Dr"}
                    </Badge>
                  </td>
                </tr>

                {/* Transaction Rows */}
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Loading transactions...
                    </td>
                  </tr>
                ) : transactionsWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No transactions found for the selected period
                    </td>
                  </tr>
                ) : (
                  transactionsWithBalance.map((txn: any) => {
                    const amount = parseFloat(txn.amount);
                    
                    // ACCURATE DEBIT/CREDIT LOGIC - NO MISMATCH:
                    // From Party's account perspective (not our books)
                    let isDebit = false;
                    let isCredit = false;
                    
                    if (txn.partyId === selectedPartyId) {
                      if (txn.transactionType === "cash_in") {
                        // Party gave us money - DEBIT in their account (they paid)
                        isDebit = true;
                      } else if (txn.transactionType === "cash_out") {
                        // We gave money to party - CREDIT in their account (we paid them)
                        isCredit = true;
                      }
                    } else if (txn.fromAccount === selectedPartyId) {
                      // Party sent money to someone - DEBIT in their account
                      isDebit = true;
                    } else if (txn.toAccount === selectedPartyId) {
                      // Someone sent money to party - CREDIT in their account
                      isCredit = true;
                    }
                    
                    return (
                      <tr key={txn.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {DateUtils.formatForDisplay(txn.transactionDate)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {txn.narration || txn.category}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {isDebit ? `₹${amount.toLocaleString()}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {isCredit ? `₹${amount.toLocaleString()}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <Badge variant={txn.balanceType === "credit" ? "default" : "destructive"}>
                            ₹{Math.abs(txn.runningBalance).toLocaleString()} {txn.balanceType === "credit" ? "Cr" : "Dr"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Closing Balance Row */}
                {transactionsWithBalance.length > 0 && (
                  <tr className="bg-green-50 font-medium">
                    <td className="px-4 py-3 text-sm">
                      {DateUtils.formatForDisplay(dateTo)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold">
                      Closing Balance
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {finalBalance < 0 ? `₹${Math.abs(finalBalance).toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {finalBalance >= 0 ? `₹${finalBalance.toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <Badge variant={finalBalance >= 0 ? "default" : "destructive"}>
                        ₹{Math.abs(finalBalance).toLocaleString()} {finalBalance >= 0 ? "Cr" : "Dr"}
                      </Badge>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      {selectedParty && (
        <Card className="mt-4 no-print">
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Opening Balance</p>
                <p className={`text-lg font-bold ${opening.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                  ₹{opening.amount.toLocaleString()} {opening.type === "credit" ? "Cr" : "Dr"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-lg font-bold text-blue-600">
                  {transactionsWithBalance.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Closing Balance</p>
                <p className={`text-lg font-bold ${finalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ₹{Math.abs(finalBalance).toLocaleString()} {finalBalance >= 0 ? "Cr" : "Dr"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}