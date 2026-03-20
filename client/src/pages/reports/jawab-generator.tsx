import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Loader2, FileText, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useIsMobile } from "@/hooks/use-mobile";
import { ReceiptGenerator } from "@/components/receipt-generator";

interface JawabReportResponse {
  financialYear: string;
  prevYear: string;
  company: { name: string; licenseNumber: string | null; address: string | null } | null;
  totalLoans: number;
  openingBalance: number;
  yearDisbursement: number;
  totalAmount: number;
  yearCollection: number;
  closingBalance: number;
  interestCollected: number;
  maxCapitalAmount: number;
  maxCapitalDate: string;
  inspectionFee: number;
}

function getCurrentFinancialYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function getFinancialYearOptions(): { value: string; label: string }[] {
  const currentFY = getCurrentFinancialYear();
  const options = [];
  for (let y = currentFY; y >= currentFY - 10; y--) {
    options.push({ value: String(y), label: `${y}-${y + 1}` });
  }
  return options;
}

export default function JawabGeneratorPage() {
  const isMobile = useIsMobile();
  const currentFY = getCurrentFinancialYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentFY));
  const [applicationDate, setApplicationDate] = useState<string>('');
  const [feeDate, setFeeDate] = useState<string>('');
  const [proprietorName, setProprietorName] = useState<string>('');
  const [proprietorAge, setProprietorAge] = useState<string>('');
  const fyOptions = getFinancialYearOptions();
  const previewRef = useRef<HTMLIFrameElement>(null);

  const { data: jawabData, isLoading, error } = useQuery<JawabReportResponse>({
    queryKey: ['/api/jawab-report', selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/jawab-report?year=${selectedYear}`);
      if (!res.ok) throw new Error('Failed to fetch jawab report');
      return res.json();
    },
    enabled: !!selectedYear,
  });

  const jawabHTML = jawabData ? ReceiptGenerator.generateJawabForm({
    ...jawabData,
    renewalDate: applicationDate || undefined,
    feeDate: feeDate || undefined,
    jawabDate: applicationDate || undefined,
    proprietorName: proprietorName || undefined,
    proprietorAge: proprietorAge || undefined,
  }) : '';

  useEffect(() => {
    if (previewRef.current && jawabHTML) {
      const doc = previewRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(jawabHTML);
        doc.close();
      }
    }
  }, [jawabHTML]);

  const handlePrint = () => {
    if (!jawabHTML) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(jawabHTML);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileNav />
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <FileText className="h-5 w-5 md:h-6 md:w-6 text-indigo-600 flex-shrink-0" />
              <h1 className="text-lg md:text-2xl font-bold text-gray-900">जवाब (घोषणापत्र)</h1>
            </div>

            <Card className="mb-4 md:mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm md:text-base">आर्थिक वर्ष व तारखा निवडा</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end mb-4">
                  <div className="w-full sm:w-48">
                    <Label className="text-xs text-gray-500 mb-1 block">आर्थिक वर्ष</Label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="आर्थिक वर्ष निवडा" />
                      </SelectTrigger>
                      <SelectContent>
                        {fyOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handlePrint}
                    disabled={isLoading || !jawabData}
                    className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto h-10"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    प्रिंट करा
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      अर्ज / जवाब तारीख
                    </Label>
                    <Input
                      type="date"
                      value={applicationDate}
                      onChange={(e) => setApplicationDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      फी भरणा तारीख
                    </Label>
                    <Input
                      type="date"
                      value={feeDate}
                      onChange={(e) => setFeeDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">प्रोप्रायटर नाव</Label>
                    <Input
                      type="text"
                      value={proprietorName}
                      onChange={(e) => setProprietorName(e.target.value)}
                      placeholder="नाव टाका"
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">वय (वर्षे)</Label>
                    <Input
                      type="number"
                      value={proprietorAge}
                      onChange={(e) => setProprietorAge(e.target.value)}
                      placeholder="वय"
                      className="h-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {isLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                <span className="ml-3 text-gray-600 text-sm">डेटा लोड होत आहे...</span>
              </div>
            )}

            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="py-3">
                  <p className="text-red-700 text-sm">डेटा लोड करताना त्रुटी झाली. कृपया पुन्हा प्रयत्न करा.</p>
                </CardContent>
              </Card>
            )}

            {jawabData && !isLoading && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm md:text-base">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span>जवाब प्रिव्ह्यू - {jawabData.financialYear}</span>
                      <span className="text-xs md:text-sm font-normal text-gray-500">एकूण कर्ज: {jawabData.totalLoans}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-4 md:p-6">
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <iframe
                      ref={previewRef}
                      title="जवाब प्रिव्ह्यू"
                      className="w-full border-0"
                      style={{ minHeight: isMobile ? '500px' : '900px', height: '100%' }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
