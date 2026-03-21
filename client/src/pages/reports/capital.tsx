import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { LoanCalculations } from "@/lib/calculations";
import { DateUtils } from "@/lib/date-utils";
import { FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CapitalReport() {
  const [dateFilters, setDateFilters] = useState({
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0]
  });

  // Fetch company data
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  // Fetch capital report data
  const { data: capitalData, isLoading, refetch } = useQuery({
    queryKey: ["/api/reports/capital", dateFilters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateFilters.dateFrom) params.append('dateFrom', dateFilters.dateFrom);
      if (dateFilters.dateTo) params.append('dateTo', dateFilters.dateTo);
      return fetch(`/api/reports/capital?${params}`, { credentials: 'include' }).then(r => r.json());
    },
    enabled: false, // Only fetch on button click
  });

  const handleFilter = async () => {
    await refetch();
  };

  const handlePrint = () => {
    if (!capitalData) return;
    const companyName = (company as any)?.name || 'कंपनी नाव';
    const fmt = (v: number) => '₹' + (v || 0).toLocaleString('en-IN');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 8mm 8mm 8mm 25.4mm; }
  body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; margin: 0; padding: 20px; }
  .header { text-align: center; margin-bottom: 20px; }
  .header h2 { font-size: 14px; font-weight: bold; margin: 0 0 4px; }
  .header h3 { font-size: 12px; font-weight: bold; margin: 0 0 3px; }
  .header p { font-size: 10px; color: #555; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #f5f5f5; font-weight: 600; font-size: 10px; padding: 6px 8px; border: 1px solid #999; text-align: left; }
  td { font-size: 10px; padding: 6px 8px; border: 1px solid #ccc; }
  .text-right { text-align: right; }
  .bold { font-weight: bold; }
  .footer { text-align: center; font-size: 8px; color: #999; margin-top: 15px; }
</style></head><body>
<div class="header">
  <h2>${companyName}</h2>
  <h3>भांडवल खाते</h3>
  <p>नमुना क्रमांक १३ (नियम १९ पहा)</p>
  <p>कालावधी: ${DateUtils.formatDate(dateFilters.dateFrom)} ते ${DateUtils.formatDate(dateFilters.dateTo)}</p>
</div>
<table>
  <thead><tr><th>तपशील</th><th class="text-right">रक्कम</th></tr></thead>
  <tbody>
    <tr><td>प्रारंभिक शिल्लक</td><td class="text-right">${fmt(capitalData.openingBalance)}</td></tr>
    <tr><td>कर्ज वाटप</td><td class="text-right">${fmt(capitalData.totalDisbursement)}</td></tr>
    <tr><td>कर्ज संकलन</td><td class="text-right">${fmt(capitalData.totalCollection)}</td></tr>
    <tr class="bold"><td>अंतिम शिल्लक</td><td class="text-right">${fmt(capitalData.closingBalance)}</td></tr>
  </tbody>
</table>
<div class="footer">अहवाल तयार केला: ${new Date().toLocaleDateString('en-GB')}</div>
</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.width = '794px';
    iframe.style.height = '1123px';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch(e) { window.print(); }
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 500);
  };

  const handleExportPDF = () => {
    handlePrint();
  };

  const handleExportExcel = () => {
    if (!capitalData) return;
    // Add Excel export logic here
    console.log('Exporting to Excel...');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <MobileNav />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          <div className="p-6 md:p-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl md:text-3xl font-bold text-center">
                  कॅपिटल रिपोर्ट / Capital Report
                </CardTitle>
                <div className="text-center text-lg font-semibold text-gray-700">
                  {company?.name}
                </div>
              </CardHeader>
              <CardContent>
                {/* Date Filters */}
                <div className="mb-6 space-y-4 bg-gray-50 p-4 md:p-6 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="dateFrom">पासून तारीख</Label>
                      <Input
                        id="dateFrom"
                        type="date"
                        value={dateFilters.dateFrom}
                        onChange={(e) => setDateFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dateTo">पर्यंत तारीख</Label>
                      <Input
                        id="dateTo"
                        type="date"
                        value={dateFilters.dateTo}
                        onChange={(e) => setDateFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleFilter} className="w-full" disabled={isLoading}>
                        {isLoading ? 'लोड होत आहे...' : 'शोधा'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mb-6 flex flex-wrap gap-2">
                  <Button onClick={handlePrint} variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    प्रिंट करा
                  </Button>
                  <Button onClick={handleExportPDF} variant="outline" size="sm">
                    <FileDown className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button onClick={handleExportExcel} variant="outline" size="sm">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>

                {/* Report Content */}
                {capitalData ? (
                  <div className="print-content">
                    <div className="space-y-4">
                      <div className="text-center">
                        <h3 className="text-xl md:text-2xl font-bold">कॅपिटल रिपोर्ट</h3>
                        <p className="text-gray-600">
                          कालावधी: {DateUtils.formatDate(dateFilters.dateFrom)} ते {DateUtils.formatDate(dateFilters.dateTo)}
                        </p>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="md:text-base md:py-3">तपशील</TableHead>
                            <TableHead className="text-right md:text-base md:py-3">रक्कम</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="md:text-base md:py-3">प्रारंभिक शिल्लक</TableCell>
                            <TableCell className="text-right md:text-base md:py-3">₹{(capitalData?.openingBalance || 0).toLocaleString('en-IN')}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="md:text-base md:py-3">कर्ज वाटप</TableCell>
                            <TableCell className="text-right md:text-base md:py-3">₹{(capitalData?.totalDisbursement || 0).toLocaleString('en-IN')}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="md:text-base md:py-3">कर्ज संकलन</TableCell>
                            <TableCell className="text-right md:text-base md:py-3">₹{(capitalData?.totalCollection || 0).toLocaleString('en-IN')}</TableCell>
                          </TableRow>
                          <TableRow className="font-bold">
                            <TableCell className="md:text-base md:py-3">अंतिम शिल्लक</TableCell>
                            <TableCell className="text-right md:text-base md:py-3">₹{(capitalData?.closingBalance || 0).toLocaleString('en-IN')}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    कॅपिटल रिपोर्ट पाहण्यासाठी तारीख निवडा आणि शोधा बटण दाबा
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

    </div>
  );
}