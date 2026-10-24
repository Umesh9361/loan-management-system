import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, Download, Loader2, Printer, Search, UserRound, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePledgeFormDefaults } from "@/hooks/use-pledge-form-defaults";
import { PledgeFormEditor } from "@/components/pledge-form-editor";
import { PledgeLayoutPicker } from "@/components/pledge-layout-picker";
import { PledgeFormSelector } from "@/components/pledge-form-selector";
import { getPledgeFormEntry } from "@/lib/pledge-form-navigation";
import { pledgeMatterSchema } from "@shared/pledge-form-editor";
import {
  getSelectedPledgeForms,
  getPledgePageGroups,
  pledgeFormsDocument,
  printPledgeForms,
  type PledgeFormData,
  type PledgeFormChoice,
  type PledgeFormLayout,
} from "@/lib/pledge-forms";

type Borrower = {
  borrowerName: string;
  borrowerAddress: string | null;
  borrowerMobile: string | null;
};
type Company = { name?: string };
type Mode = "blank" | "borrower" | "manual";
type PersonalData = Pick<PledgeFormData, "borrowerName" | "borrowerAddress" | "borrowerMobile">;

const emptyPersonal: PersonalData = { borrowerName: "", borrowerAddress: "", borrowerMobile: "" };
const emptyDetails: PledgeFormData = { accountNumber: "", principalAmount: "", loanDate: "", interestRate: "", printDate: "" };

export default function PledgeFormsPage() {
  const { toast } = useToast();
  const defaults = usePledgeFormDefaults();
  const [mode, setMode] = useState<Mode>(() => getPledgeFormEntry(window.location.search).mode);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Borrower | null>(null);
  const [personal, setPersonal] = useState<PersonalData>(emptyPersonal);
  const [openSuggestions, setOpenSuggestions] = useState(false);
  const [selection, setSelection] = useState<PledgeFormChoice>(() => getPledgeFormEntry(window.location.search).selection);
  const [layout, setLayout] = useState<PledgeFormLayout>("compact");
  const [printPending, setPrintPending] = useState(false);
  const [pdfPending, setPdfPending] = useState(false);
  const working = printPending || pdfPending;
  const selectedForms = getSelectedPledgeForms(selection);
  const noForms = selectedForms.length === 0;
  const expectedPages = getPledgePageGroups(selection, layout).length;
  const [details, setDetails] = useState(emptyDetails);
  const searchWrap = useRef<HTMLDivElement>(null);

  const { data: company } = useQuery<Company>({
    queryKey: ["/api/company"],
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const borrowersQuery = useQuery<Borrower[]>({
    queryKey: ["/api/borrowers/autocomplete", debouncedSearch],
    queryFn: async () => {
      const response = await fetch(`/api/borrowers/autocomplete?search=${encodeURIComponent(debouncedSearch)}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("कर्जदार शोधता आले नाहीत.");
      const result = await response.json();
      if (!Array.isArray(result) || result.some(row => !row || typeof row.borrowerName !== "string")) {
        throw new Error("कर्जदारांच्या माहितीचे स्वरूप चुकीचे आहे.");
      }
      return result;
    },
    enabled: mode === "borrower" && debouncedSearch.length >= 2,
    retry: false,
  });

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (!searchWrap.current?.contains(event.target as Node)) setOpenSuggestions(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const data = useMemo<PledgeFormData>(() => ({
    company: company?.name || "",
    ...(mode === "blank" ? {} : { ...personal, ...details }),
  }), [company?.name, mode, personal, details]);
  const previewDocument = useMemo(() => noForms ? "" : pledgeFormsDocument(data, selection, defaults.matter, layout), [data, selection, defaults.matter, layout, noForms]);

  const clearBorrower = () => {
    setSelected(null);
    setPersonal(emptyPersonal);
  };
  const changeMode = (next: Mode) => {
    setMode(next);
    setSearch("");
    setDebouncedSearch("");
    setOpenSuggestions(false);
    clearBorrower();
    setDetails(emptyDetails);
  };
  const changeSearch = (value: string) => {
    setSearch(value);
    clearBorrower();
    setDetails(emptyDetails);
    setOpenSuggestions(value.trim().length >= 2);
  };
  const chooseBorrower = (borrower: Borrower) => {
    setSelected(borrower);
    setPersonal({
      borrowerName: borrower.borrowerName || "",
      borrowerAddress: borrower.borrowerAddress || "",
      borrowerMobile: borrower.borrowerMobile || "",
    });
    setSearch(borrower.borrowerName);
    setOpenSuggestions(false);
  };
  const handlePrint = async (blankCopy = false, asPdf = false) => {
    if (working || defaults.busy || !defaults.ready || noForms) return;
    if (!blankCopy && mode === "borrower" && !selected) {
      toast({ title: "कर्जदार निवडा", description: "छपाईपूर्वी यादीतून कर्जदार निवडा.", variant: "destructive" });
      return;
    }
    const validMatter = pledgeMatterSchema.safeParse(defaults.matter);
    if (!validMatter.success) {
      toast({ title: "मजकूर तपासा", description: validMatter.error.issues[0]?.message, variant: "destructive" }); return;
    }
    if (asPdf) setPdfPending(true);
    else setPrintPending(true);
    try {
      await printPledgeForms(pledgeFormsDocument(blankCopy ? { company: company?.name || "" } : data, selection, validMatter.data, layout));
      toast(asPdf
        ? { title: "PDF जतन करा", description: `मोबाईलच्या छपाई संवादात “Save as PDF” निवडा. ${expectedPages} A4 ${expectedPages === 1 ? "पान" : "पाने"} जतन होतील.` }
        : { title: "छपाई संवाद उघडला", description: "ब्राउझरच्या छपाई संवादातून आवश्यक पर्याय निवडा." });
    } catch (error) {
      toast({ title: "छपाई सुरू करता आली नाही", description: error instanceof Error ? error.message : "कृपया पुन्हा प्रयत्न करा.", variant: "destructive" });
    } finally {
      setPrintPending(false);
      setPdfPending(false);
    }
  };
  const updatePersonal = (key: keyof PersonalData, value: string) => setPersonal((old) => ({ ...old, [key]: value }));

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-800">
      <MobileNav />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block"><Sidebar /></aside>
      <main className="min-w-0 pb-20 lg:ml-72 lg:pb-8">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
            <div>
              <Link href="/reports/notice-generator" className="mb-3 inline-flex min-h-9 items-center text-sm font-medium text-indigo-700 underline underline-offset-4">नोटीसकडे परत</Link>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
                <span className="h-px w-7 bg-indigo-600" /> छपाई केंद्र
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">तारण कर्ज फॉर्म</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">सहा नमुने 1 किंवा 2 A4 पानांवर तयार करा; प्रिंट आणि मोबाईल PDFसाठी एकच मांडणी.</p>
            </div>
            <div className="flex flex-wrap gap-2">
            {mode !== "blank" && <Button variant="outline" onClick={() => handlePrint(true)} disabled={noForms || working || defaults.busy || !defaults.ready} className="h-11">कोरी प्रत प्रिंट</Button>}
            <Button variant="outline" onClick={() => handlePrint(false, true)} disabled={noForms || working || defaults.busy || !defaults.ready || (mode === "borrower" && !selected)} className="h-11 border-indigo-200 text-indigo-700">
              {pdfPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {pdfPending ? "PDF तयार होत आहे…" : "PDF तयार करा"}
            </Button>
            <Button onClick={() => handlePrint()} disabled={noForms || working || defaults.busy || !defaults.ready || (mode === "borrower" && !selected)} className="h-11 shrink-0 bg-indigo-600 px-5 text-white hover:bg-indigo-700">
              {printPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              {printPending ? "तयार होत आहे…" : "छपाई संवाद उघडा"}
            </Button>
            </div>
          </header>
          {!defaults.ready && <Alert className="mb-4 border-amber-200 bg-amber-50"><AlertDescription>{defaults.error ? "डिफॉल्ट मजकूर मिळाला नाही." : "डिफॉल्ट मजकूर लोड होत आहे…"}{defaults.error && <Button variant="outline" size="sm" onClick={() => defaults.refetch()} className="ml-2">पुन्हा प्रयत्न करा</Button>}</AlertDescription></Alert>}

          <div className="grid items-start gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
            <section className="space-y-4">
              <Card className="overflow-visible border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4 text-indigo-700" /> माहितीचा प्रकार</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                    <button type="button" onClick={() => changeMode("blank")} className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${mode === "blank" ? "bg-white text-indigo-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>कोरा फॉर्म</button>
                    <button type="button" onClick={() => changeMode("borrower")} className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${mode === "borrower" ? "bg-white text-indigo-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>कर्जदार निवडा</button>
                    <button type="button" onClick={() => changeMode("manual")} className={`rounded-md px-2 py-2 text-sm font-semibold transition-colors ${mode === "manual" ? "bg-white text-indigo-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>टाइप करून भरा</button>
                  </div>

                  {mode === "borrower" && (
                    <div ref={searchWrap} className="relative">
                      <Label htmlFor="borrower-search">नावाने शोधा</Label>
                      <div className="relative mt-1.5">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input id="borrower-search" value={search} onChange={(e) => changeSearch(e.target.value)} onFocus={() => setOpenSuggestions(search.trim().length >= 2)} placeholder="किमान 2 अक्षरे टाइप करा" className="pl-9 pr-9" autoComplete="off" />
                        {search && <button type="button" aria-label="शोध पुसा" onClick={() => changeSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>}
                      </div>
                      {openSuggestions && debouncedSearch.length >= 2 && (
                        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                          {debouncedSearch !== search.trim() || borrowersQuery.isFetching ? (
                            <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> कर्जदार शोधत आहोत…</div>
                          ) : borrowersQuery.isError ? (
                            <div className="space-y-2 p-3">
                              <p className="text-sm text-rose-700">शोध पूर्ण झाला नाही.</p>
                              <Button size="sm" variant="outline" onClick={() => borrowersQuery.refetch()}>पुन्हा प्रयत्न करा</Button>
                            </div>
                          ) : (borrowersQuery.data || []).length ? (
                            borrowersQuery.data!.map((borrower, index) => (
                              <button type="button" key={`${borrower.borrowerName}-${borrower.borrowerMobile || index}`} onClick={() => chooseBorrower(borrower)} className="block w-full border-b border-slate-100 px-3 py-3 text-left last:border-0 hover:bg-indigo-50">
                                <span className="block text-sm font-semibold text-slate-900">{borrower.borrowerName}</span>
                                {borrower.borrowerAddress && <span className="mt-0.5 block line-clamp-1 text-xs text-slate-500">{borrower.borrowerAddress}</span>}
                              </button>
                            ))
                          ) : (
                            <p className="px-3 py-4 text-sm text-slate-500">या शोधासाठी कर्जदार सापडला नाही.</p>
                          )}
                        </div>
                      )}
                      {selected && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-indigo-800"><Check className="h-3.5 w-3.5" /> निवडले: {selected.borrowerName} · माहिती छपाईपूर्वी संपादित करू शकता</p>}
                      {!selected && <p className="mt-2 text-xs text-amber-800">छपाईसाठी यादीतून कर्जदार निवडा. नाव टाइप करणे पुरेसे नाही.</p>}
                    </div>
                  )}

                  {mode !== "blank" && (
                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <div><Label htmlFor="borrower-name">कर्जदाराचे नाव</Label><Input id="borrower-name" className="mt-1" value={personal.borrowerName} onChange={(e) => updatePersonal("borrowerName", e.target.value)} disabled={mode === "borrower" && !selected} /></div>
                      <div><Label htmlFor="borrower-address">पत्ता</Label><Input id="borrower-address" className="mt-1" value={personal.borrowerAddress} onChange={(e) => updatePersonal("borrowerAddress", e.target.value)} disabled={mode === "borrower" && !selected} /></div>
                      <div><Label htmlFor="borrower-mobile">मोबाईल</Label><Input id="borrower-mobile" className="mt-1" inputMode="tel" value={personal.borrowerMobile} onChange={(e) => updatePersonal("borrowerMobile", e.target.value)} disabled={mode === "borrower" && !selected} /></div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <PledgeFormSelector value={selection} onChange={setSelection} disabled={working} />

              <PledgeLayoutPicker value={layout} onChange={setLayout} disabled={working} selection={selection} />

              {!noForms && <PledgeFormEditor data={data} onChange={patch => setDetails(previous => ({ ...previous, ...patch }))} selection={selection}
                matter={defaults.matter} onMatterChange={defaults.onMatterChange}
                onUseSaved={defaults.onUseSaved} onUseOriginal={defaults.onUseOriginal}
                onSaveDefault={defaults.onSaveDefault} onResetDefault={defaults.onResetDefault}
                canSaveDefault={defaults.canSaveDefault} busy={defaults.busy || !defaults.ready}
                blankMode={mode === "blank" || (mode === "borrower" && !selected)} />}

              <Alert className="border-indigo-200 bg-indigo-50 text-indigo-950">
                <AlertCircle className="h-4 w-4 text-indigo-800" />
                <AlertDescription className="text-xs leading-relaxed">
                  A4 कागद निवडा; स्केलिंग <strong>Actual size / 100%</strong> ठेवा आणि ब्राउझर headers/footers बंद करा. ही पानांची संख्या आहे; कागदाच्या दोन्ही बाजूंवर छपाई नव्हे. मोबाईलवर “PDF तयार करा” नंतर <strong>Save as PDF</strong> निवडून जतन करा.
                </AlertDescription>
              </Alert>
              <p className="px-1 text-xs leading-relaxed text-slate-500">हे संपादनयोग्य नमुने आहेत, कायदेशीर वैधतेची हमी नाही. नोटिसीतील 15 दिवस ही नमुना मुदत आहे; लागू राज्य कायदा, परवान्याच्या अटी व आवश्यक सूचना स्थानिक वकिलाकडून तपासून वापरा. संस्थेचा आधी जतन केलेला मजकूर स्वतःहून बदलला जात नाही.</p>
            </section>

            <section className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="text-sm font-semibold text-slate-800">पूर्वदृश्य</h2><p className="text-xs text-slate-500">A4 आकार · {expectedPages} {expectedPages === 1 ? "पान" : "पाने"}</p></div>
                <Button variant="outline" size="sm" onClick={() => handlePrint()} disabled={noForms || working || defaults.busy || !defaults.ready || (mode === "borrower" && !selected)} className="border-indigo-700 text-indigo-900 hover:bg-indigo-50"><Printer className="mr-2 h-4 w-4" /> छपाई</Button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-300 bg-slate-200 p-3 sm:p-5">
                <div className="mx-auto w-[210mm] min-w-[210mm] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.14)]">
                  {noForms ? <p role="status" className="p-8 text-sm text-slate-600">पूर्वदृश्य, प्रिंट किंवा PDF साठी किमान एक फॉर्म निवडा.</p> : <iframe
                    title="तारण कर्ज फॉर्म पूर्वदृश्य"
                    srcDoc={previewDocument}
                    sandbox="allow-same-origin"
                    className="block w-[210mm] border-0"
                    style={{ height: `${expectedPages * 297 + (expectedPages - 1) * 16}mm` }}
                  />}
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-slate-500">मोबाईलवर संपूर्ण A4 फॉर्म पाहण्यासाठी आडवे स्क्रोल करा.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
