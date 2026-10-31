import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, FileText, Search, X, Download, AlertTriangle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { noticeMatterSchema, renderNoticeContent } from "@shared/notice-matter";
import { useNoticeDefaults } from "@/hooks/use-notice-defaults";
import { NoticeMatterEditor } from "@/components/notice-matter-editor";
import { downloadNoticePdf, noticeImageData } from "@/lib/notice-export";

export const NOTICE_STYLES = `
  @page {
    size: A5;
    margin: 5mm 5mm 5mm 25.4mm;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    font-family: 'Noto Sans Devanagari', 'Mangal', 'Kokila', 'Arial Unicode MS', sans-serif;
    background: white;
    width: 100%;
    height: auto;
    margin: 0;
    padding: 8px;
    font-size: 12px;
    line-height: 1.8;
    box-sizing: border-box;
  }
  .notice-container {
    width: 100%;
    max-width: 100%;
    height: auto;
    padding: 15mm 12mm 12mm 15mm;
    font-family: 'Noto Sans Devanagari', 'Mangal', 'Kokila', 'Arial Unicode MS', sans-serif;
    font-size: 12px;
    line-height: 1.8;
    color: #000;
    background: white;
    position: relative;
    box-sizing: border-box;
  }
  .notice-title {
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    text-decoration: underline;
    letter-spacing: 2px;
    margin-bottom: 8px;
  }
  .notice-date {
    text-align: right;
    margin-bottom: 12px;
  }
  .notice-to {
    margin-bottom: 18px;
  }
  .notice-to .name {
    font-weight: bold;
  }
  .notice-to .phone {
    font-size: 14px;
  }
  .notice-subject {
    margin-top: 10px;
    margin-bottom: 6px;
    font-weight: bold;
  }
  .notice-reference {
    margin-bottom: 12px;
  }
  .notice-body {
    text-align: justify;
    margin-bottom: 16px;
  }
  .notice-body p {
    margin-bottom: 10px;
    text-indent: 20px;
  }
  .notice-signature {
    text-align: right;
    margin-top: 24px;
  }
  @media print {
    @page {
      size: A5;
      margin: 5mm 5mm 5mm 25.4mm;
    }
    body {
      width: auto !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .notice-container {
      width: auto !important;
      height: auto !important;
      padding: 12mm 0 !important;
    }
  }
  @media screen and (min-width: 600px) {
    body {
      padding: 20px;
    }
    .notice-container {
      width: 148mm;
      max-width: 148mm;
      margin: 0 auto;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
  }
`;

export function fullNoticeHTML(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>${NOTICE_STYLES}</style>
</head>
<body>
${content}
</body>
</html>`;
}

export default function NoticeGeneratorPage() {
  const isMobile = useIsMobile();
  const defaults = useNoticeDefaults();
  const [noticeType, setNoticeType] = useState<'filled' | 'blank'>('filled');
  const [selectedLoanId, setSelectedLoanId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: loans = [], isLoading: loansLoading } = useQuery({
    queryKey: ["/api/loans"],
  });

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
  });

  const [inlineNoticeHTML, setInlineNoticeHTML] = React.useState<string | null>(null);
  const [showInlinePreview, setShowInlinePreview] = React.useState(false);
  const [isMobileFullPage, setIsMobileFullPage] = React.useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = React.useState<string | null>(null);

  const createDualLanguageQuery = (originalQuery: string) => {
    const englishToMarathi: Record<string, string> = {
      'ram': 'राम', 'shyam': 'श्याम', 'geeta': 'गीता', 'seeta': 'सीता',
      'vijay': 'विजय', 'ajay': 'अजय', 'sanjay': 'संजय', 'prakash': 'प्रकाश',
      'sunil': 'सुनील', 'anil': 'अनिल', 'vinod': 'विनोद', 'manoj': 'मनोज',
      'raju': 'राजू', 'babu': 'बाबू', 'sir': 'सर', 'ji': 'जी',
      'patel': 'पाटील', 'patil': 'पाटील', 'kumar': 'कुमार', 'devi': 'देवी',
      'laxmi': 'लक्ष्मी', 'ganga': 'गंगा', 'saraswati': 'सरस्वती',
      'rajkumar': 'राजकुमार', 'rajat': 'राजत', 'more': 'मोरे'
    };

    const marathiToEnglish: Record<string, string> = {
      'राम': 'ram', 'श्याम': 'shyam', 'गीता': 'geeta', 'सीता': 'seeta',
      'विजय': 'vijay', 'अजय': 'ajay', 'संजय': 'sanjay', 'प्रकाश': 'prakash',
      'सुनील': 'sunil', 'अनिल': 'anil', 'विनोद': 'vinod', 'मनोज': 'manoj',
      'राजू': 'raju', 'बाबू': 'babu', 'सर': 'sir', 'जी': 'ji',
      'पाटील': 'patel', 'कुमार': 'kumar', 'देवी': 'devi',
      'लक्ष्मी': 'laxmi', 'गंगा': 'ganga', 'सरस्वती': 'saraswati',
      'राजकुमार': 'rajkumar', 'राजत': 'rajat', 'मोरे': 'more'
    };

    const queries = [originalQuery];

    Object.keys(englishToMarathi).forEach(english => {
      if (originalQuery.includes(english)) {
        queries.push(originalQuery.replace(new RegExp(english, 'g'), englishToMarathi[english]));
      }
    });

    Object.keys(marathiToEnglish).forEach(marathi => {
      if (originalQuery.includes(marathi)) {
        queries.push(originalQuery.replace(new RegExp(marathi, 'g'), marathiToEnglish[marathi]));
      }
    });

    return queries;
  };

  const normalizeMarathiVowels = (text: string): string => {
    return text
      .replace(/ी/g, 'ि')
      .replace(/ू/g, 'ु')
      .replace(/ै/g, 'े')
      .replace(/ौ/g, 'ो')
      .replace(/ॅ/g, 'े')
      .replace(/ॉ/g, 'ो')
      .replace(/आ/g, 'अ')
      .replace(/ई/g, 'इ')
      .replace(/ऊ/g, 'उ')
      .replace(/ऐ/g, 'ए')
      .replace(/औ/g, 'ओ');
  };

  const matchesBorrowerName = (borrowerName: string, searchTerm: string): boolean => {
    if (!borrowerName || !searchTerm) return false;

    const trimmedSearch = searchTerm.trim().toLowerCase();
    if (!trimmedSearch) return false;

    const searchQueries = createDualLanguageQuery(trimmedSearch);
    const nameLower = borrowerName.toLowerCase();
    const nameNormalized = normalizeMarathiVowels(nameLower);

    return searchQueries.some(query => {
      const queryNormalized = normalizeMarathiVowels(query);

      if (nameLower.includes(query)) return true;
      if (nameNormalized.includes(queryNormalized)) return true;

      const nameWords = nameLower.split(/\s+/);
      const nameWordsNorm = nameNormalized.split(/\s+/);
      const queryWords = query.split(/\s+/);
      const queryWordsNorm = queryNormalized.split(/\s+/);

      if (queryWords.length > 1) {
        return queryWords.every((qWord, i) => {
          const qWordNorm = queryWordsNorm[i] || normalizeMarathiVowels(qWord);
          return nameWords.some((nWord, j) => {
            const nWordNorm = nameWordsNorm[j] || normalizeMarathiVowels(nWord);
            return nWord.includes(qWord) ||
              nWord.startsWith(qWord) ||
              qWord.includes(nWord) ||
              nWordNorm.includes(qWordNorm) ||
              nWordNorm.startsWith(qWordNorm);
          });
        });
      } else {
        return nameWords.some((nWord, j) => {
          const nWordNorm = nameWordsNorm[j] || normalizeMarathiVowels(nWord);
          return nWord.includes(query) ||
            nWord.startsWith(query) ||
            query.includes(nWord) ||
            nWordNorm.includes(queryNormalized) ||
            nWordNorm.startsWith(queryNormalized) ||
            queryNormalized.includes(nWordNorm) ||
            (query.length >= 2 && nWord.length >= 2 &&
             query.substring(0, 2) === nWord.substring(0, 2));
        });
      }
    });
  };

  const filteredLoans = (loans as any[]).filter((loan: any) => {
    if (!searchQuery.trim()) return true;

    const trimmedQuery = searchQuery.trim();
    return matchesBorrowerName(loan.borrowerName || "", trimmedQuery) ||
           loan.accountNumber?.toLowerCase().includes(trimmedQuery.toLowerCase());
  });

  const selectedLoan = filteredLoans.find((loan: any) => loan.id === selectedLoanId);

  const downloadNoticeAsPDF = async () => {
    try {
      if (!inlineNoticeHTML) {
        alert("नोटीस सापडली नाही");
        return;
      }

      const loan = (loans as any[]).find((l: any) => l.id === selectedLoanId);
      const fileName = loan
        ? `नोटीस_${loan.borrowerName}.pdf`
        : `नोटीस.pdf`;

      await downloadNoticePdf(fullNoticeHTML(inlineNoticeHTML), fileName);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("PDF तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
  };

  const downloadNoticeAsImage = async () => {
    try {
      if (!inlineNoticeHTML) {
        alert("नोटीस सापडली नाही");
        return;
      }

      const imageUrl = await noticeImageData(fullNoticeHTML(inlineNoticeHTML));
      const link = document.createElement('a');
      link.href = imageUrl;

      const loan = (loans as any[]).find((l: any) => l.id === selectedLoanId);
      link.download = loan
        ? `नोटीस_${loan.borrowerName}.png`
        : `नोटीस.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Image generation error:", error);
      alert("इमेज तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
    }
  };

  if (isMobileFullPage && showInlinePreview && inlineNoticeHTML) {
    if (generatedImageUrl) {
      const loan = (loans as any[]).find((l: any) => l.id === selectedLoanId);
      const fileName = loan
        ? `नोटीस_${loan.borrowerName}.png`
        : `नोटीस.png`;

      return (
        <div className="min-h-screen bg-gray-100">
          <div className="sticky top-0 z-50 bg-indigo-50 border-b px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                <Download className="h-5 w-5" />
                इमेज तयार झाली ✅
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setGeneratedImageUrl(null);
                }}
              >
                <X className="mr-1 h-4 w-4" />
                मागे जा
              </Button>
            </div>

            <a
              href={generatedImageUrl}
              download={fileName}
              className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium h-12 px-4 bg-green-600 hover:bg-green-700 text-white mb-2"
            >
              <Download className="mr-2 h-5 w-5" />
              इमेज डाउनलोड करा
            </a>

            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-2 text-center">
              <p className="text-yellow-800 text-xs">
                वरील बटण काम नाही केले तर: इमेज वर लाँग-प्रेस करा → "Save Image" निवडा
              </p>
            </div>
          </div>
          <div className="p-4">
            <img
              src={generatedImageUrl}
              alt="नोटीस"
              className="w-full border rounded-lg shadow-lg"
              style={{ maxWidth: '100%' }}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-50 bg-orange-50 border-b px-3 py-3 print:hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-orange-700 font-semibold">
              <AlertTriangle className="h-5 w-5" />
              नोटीस तयार
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowInlinePreview(false);
                setInlineNoticeHTML(null);
                setIsMobileFullPage(false);
                setGeneratedImageUrl(null);
                window.history.replaceState({}, '', '/reports/notice-generator');
              }}
            >
              <X className="mr-1 h-4 w-4" />
              बंद करा
            </Button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-3 bg-green-600 hover:bg-green-700 text-white active:bg-green-800"
              style={{ touchAction: 'manipulation' }}
            >
              <Printer className="mr-2 h-4 w-4" />
              प्रिंट
            </button>
            <button
              type="button"
              onClick={downloadNoticeAsPDF}
              className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-3 bg-red-600 hover:bg-red-700 text-white active:bg-red-800"
              style={{ touchAction: 'manipulation' }}
            >
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </button>
          </div>
        </div>

        <div
          id="notice-content"
          className="bg-white overflow-x-auto"
          style={{
            maxWidth: '100%',
          }}
        >
          <style dangerouslySetInnerHTML={{ __html: NOTICE_STYLES }} />
          <style dangerouslySetInnerHTML={{ __html: `
            .notice-container {
              width: 100% !important;
              max-width: 100% !important;
              padding: 16px !important;
              font-size: 14px !important;
              line-height: 1.7 !important;
              box-shadow: none !important;
              margin: 0 !important;
              height: auto !important;
            }
            .notice-title {
              font-size: 20px !important;
            }
          `}} />
          <div dangerouslySetInnerHTML={{ __html: inlineNoticeHTML }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileNav />

      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>

        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0 screen-only">
          <div className="px-4 sm:px-6 lg:px-8 py-6">

            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-foreground heading-professional">कायदेशीर नोटीस</h1>
              <p className="text-muted-foreground">भारतीय करार अधिनियम, १८७२ कलम १७६ अन्वये</p>
            </div>
            <NoticeMatterEditor defaults={defaults} />

            {showInlinePreview && !!inlineNoticeHTML && !isMobileFullPage && (
              <div className="fixed top-0 right-0 bottom-0 left-0 lg:left-64 z-40 bg-gray-100 flex flex-col">
                <div className="bg-orange-50 px-6 py-4 border-b shadow-sm flex items-center justify-between">
                  <h2 className="text-orange-700 font-semibold text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    नोटीस तयार
                  </h2>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          const fullHTML = inlineNoticeHTML ? fullNoticeHTML(inlineNoticeHTML) : null;
                          if (fullHTML) {
                            printWindow.document.write(fullHTML);
                            printWindow.document.close();
                            setTimeout(() => {
                              printWindow.focus();
                              printWindow.print();
                            }, 300);
                          }
                        }
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      प्रिंट करा
                    </Button>
                    <Button
                      onClick={downloadNoticeAsPDF}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                    <Button
                      onClick={downloadNoticeAsImage}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      इमेज
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowInlinePreview(false);
                        setInlineNoticeHTML(null);
                        window.history.replaceState({}, '', '/reports/notice-generator');
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      बंद करा
                    </Button>
                  </div>
                </div>
                <div
                  id="notice-content"
                  className="flex-1 bg-white overflow-y-auto"
                >
                  <style dangerouslySetInnerHTML={{ __html: NOTICE_STYLES + `
                    .notice-container {
                      width: 100% !important;
                      max-width: 700px !important;
                      margin: 0 auto !important;
                      padding: 30px 30px 30px 38mm !important;
                      box-sizing: border-box !important;
                      box-shadow: none !important;
                      border: none !important;
                    }
                  `}} />
                  <div dangerouslySetInnerHTML={{ __html: inlineNoticeHTML || '' }} />
                </div>
              </div>
            )}

            <Card className="mb-6 card-professional">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 heading-professional md:text-xl">
                  <AlertTriangle className="h-5 w-5" />
                  कर्जदार निवडा
                </CardTitle>
              </CardHeader>
              <CardContent className="md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-end">
                  <div>
                    <Label className="text-sm font-semibold">
                      कर्जदाराचे नाव निवडा
                    </Label>
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="कर्जदार शोधा... (raju, राजू, patel, kumar...)"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                          autoFocus
                        />
                      </div>

                      <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={loansLoading ? "कर्ज डेटा लोड होत आहे..." : "कर्जदार निवडा..."} />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {loansLoading && (
                            <div className="p-3 text-sm text-gray-500 text-center">
                              कर्ज डेटा लोड होत आहे...
                            </div>
                          )}
                          {!loansLoading && filteredLoans.map((loan: any) => (
                            <SelectItem key={loan.id} value={loan.id}>
                              {loan.borrowerName} - खाते क्र. {loan.accountNumber}
                            </SelectItem>
                          ))}
                          {!loansLoading && filteredLoans.length === 0 && searchQuery && (
                            <div className="p-2 text-sm text-gray-500 text-center">
                              कोणतेही कर्जदार सापडले नाही
                            </div>
                          )}
                          {!loansLoading && filteredLoans.length === 0 && !searchQuery && (
                            <div className="p-2 text-sm text-gray-500 text-center">
                              वरील search box मध्ये टाइप करा
                            </div>
                          )}
                        </SelectContent>
                      </Select>

                      {selectedLoanId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLoanId("");
                            setSearchQuery("");
                          }}
                          className="mt-2 text-xs w-full"
                        >
                          🗑️ निवड मिटवा
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 p-4 md:p-6 bg-gray-50 rounded-lg">
                    <Label className="text-sm md:text-base font-semibold mb-3 block">नोटीस प्रकार निवडा</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="filled"
                          name="noticeType"
                          value="filled"
                          checked={noticeType === 'filled'}
                          onChange={(e) => setNoticeType(e.target.value as any)}
                          className="h-4 w-4"
                          autoComplete="off"
                        />
                        <Label htmlFor="filled" className="text-sm font-medium cursor-pointer">
                          भरलेली नोटीस (डिफॉल्ट)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="blank"
                          name="noticeType"
                          value="blank"
                          checked={noticeType === 'blank'}
                          onChange={(e) => setNoticeType(e.target.value as any)}
                          className="h-4 w-4"
                          autoComplete="off"
                        />
                        <Label htmlFor="blank" className="text-sm font-medium cursor-pointer">
                          मोकळी नोटीस - हाताने लिहिण्यासाठी
                        </Label>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      {noticeType === 'filled' && "• कर्जदाराची माहिती भरलेली नोटीस तयार होईल"}
                      {noticeType === 'blank' && "• नाव, पत्ता, दिनांक, कर्ज क्रमांक - सगळे हाताने लिहिण्यासाठी मोकळे"}
                    </div>
                  </div>

                  <div className={showInlinePreview ? "hidden" : "mt-4"}>
                    <Button
                      onClick={() => {
                        try {
                          if (!defaults.ready || defaults.busy) return;
                          const parsed = noticeMatterSchema.safeParse(defaults.matter);
                          if (!parsed.success) {
                            alert(parsed.error.issues[0]?.message || "नोटीशीचा मजकूर तपासा.");
                            return;
                          }
                          let noticeContent: string;
                          if (noticeType === 'blank') {
                            noticeContent = renderNoticeContent(null, parsed.data, company as any);
                          } else {
                            if (!selectedLoan) return;
                            noticeContent = renderNoticeContent(selectedLoan, parsed.data, company as any);
                          }
                          setInlineNoticeHTML(noticeContent);
                          setShowInlinePreview(true);

                          if (isMobile) {
                            setIsMobileFullPage(true);
                          } else {
                            setIsMobileFullPage(false);
                          }
                        } catch (error) {
                          console.error("Generate error:", error);
                          alert("नोटीस तयार करण्यात समस्या आली. कृपया पुन्हा प्रयत्न करा.");
                        }
                      }}
                      disabled={!defaults.ready || defaults.busy || (noticeType === 'filled' && !selectedLoanId)}
                      className="btn-professional btn-primary"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      नोटीस तयार करा
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {!selectedLoanId && noticeType === 'filled' && (
              <Card className="card-professional">
                <CardContent className="text-center py-12">
                  <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">कर्जदार निवडा</h3>
                  <p className="text-muted-foreground">
                    नोटीस तयार करण्यासाठी कर्जदार निवडा
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}