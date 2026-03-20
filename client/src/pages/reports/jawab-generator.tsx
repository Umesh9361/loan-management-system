import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Loader2, FileText } from "lucide-react";
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

  const jawabHTML = jawabData ? ReceiptGenerator.generateJawabForm(jawabData) : '';

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
    <div className="flex min-h-screen bg-background">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileNav />}

      <main className={`flex-1 ${isMobile ? 'pb-20' : ''}`}>
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">जवाब जनरेटर</h1>
          </div>

          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">आर्थिक वर्ष निवडा</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <div className="w-full sm:w-48">
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
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
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  प्रिंट करा
                </Button>
              </div>
            </CardContent>
          </Card>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <span className="ml-3 text-gray-600">डेटा लोड होत आहे...</span>
            </div>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-4">
                <p className="text-red-700">डेटा लोड करताना त्रुटी झाली. कृपया पुन्हा प्रयत्न करा.</p>
              </CardContent>
            </Card>
          )}

          {jawabData && !isLoading && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>जवाब प्रिव्ह्यू - आर्थिक वर्ष {jawabData.financialYear}</span>
                  <span className="text-sm font-normal text-gray-500">एकूण कर्ज: {jawabData.totalLoans}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <iframe
                    ref={previewRef}
                    title="जवाब प्रिव्ह्यू"
                    className="w-full border-0"
                    style={{ minHeight: '900px', height: '100%' }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
