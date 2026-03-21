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
    window.print();
  };

  const handleExportPDF = () => {
    window.print();
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

      <style jsx>{`
        @media print {
          @page {
            size: A4;
            margin: 8mm 8mm 8mm 25.4mm;
          }
          body {
            font-family: 'Noto Sans Devanagari', Arial, sans-serif !important;
          }
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding-left: 25mm;
            box-sizing: border-box;
          }
        }
      `}</style>
    </div>
  );
}