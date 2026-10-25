import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { latestPledgeClosure, mapLoanToPledgeForm, sortPledgeLoanMatches, type PledgeClosureRecord, type PledgeLoanRecord } from "@/lib/pledge-loan-autofill";
import type { PledgeFormData } from "@/lib/pledge-forms";
import { loadPledgeLoanPhotos } from "@/lib/pledge-loan-photos";
import { PledgePhotoSelection } from "@/components/pledge-photo-selection";

type LoanWithDisplay = PledgeLoanRecord & Record<string, unknown>;
type Props = {
  onApply: (data: PledgeFormData, loan: PledgeLoanRecord) => boolean;
  onBusyChange: (busy: boolean) => void;
  onCollateralPhotosChange: (photos: string[], loanId: string, labels: string[]) => void;
};

function displayDate(loan: LoanWithDisplay) {
  const value = loan.loanDate ?? loan.date ?? loan.createdAt;
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function PledgeLoanPicker({ onApply, onBusyChange, onCollateralPhotosChange }: Props) {
  const [search, setSearch] = useState("");
  const currentSearch = useRef(search);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<PledgeLoanRecord | null>(null);
  const [lookupId, setLookupId] = useState<string | null>(null);
  const [failedLoanId, setFailedLoanId] = useState<string | null>(null);
  const [closureError, setClosureError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const requestId = useRef(0);
  const onBusyRef = useRef(onBusyChange);
  onBusyRef.current = onBusyChange;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    requestId.current += 1;
    setClosureError("");
    setLookupId(null);
    setFailedLoanId(null);
    onBusyRef.current(false);
  }, [search]);

  useEffect(() => () => {
    requestId.current += 1;
    onBusyRef.current(false);
  }, []);

  const updateSearch = (value: string) => {
    currentSearch.current = value;
    requestId.current += 1;
    setLookupId(null);
    setSearch(value);
  };

  const loansQuery = useQuery<PledgeLoanRecord[]>({
    queryKey: ["/api/loans/search", "pledge-autofill", debouncedSearch],
    queryFn: async () => {
      const response = await fetch(`/api/loans/search?q=${encodeURIComponent(debouncedSearch)}&limit=50`, { credentials: "include" });
      if (!response.ok) throw new Error("खाती शोधता आली नाहीत.");
      const result: unknown = await response.json();
      const rows = Array.isArray(result) ? result : (result && typeof result === "object" && Array.isArray((result as { loans?: unknown }).loans) ? (result as { loans: unknown[] }).loans : null);
      if (!rows || rows.some(row => !row || typeof row !== "object" ||
        !["string", "number"].includes(typeof (row as { id?: unknown }).id) ||
        !["string", "number"].includes(typeof (row as { accountNumber?: unknown }).accountNumber) ||
        typeof (row as { borrowerName?: unknown }).borrowerName !== "string")) {
        throw new Error("खात्यांच्या माहितीचे स्वरूप चुकीचे आहे.");
      }
      return rows.map(row => {
        const loan = row as PledgeLoanRecord & { id: string | number; accountNumber: string | number };
        return { ...loan, id: String(loan.id), accountNumber: String(loan.accountNumber) };
      });
    },
    enabled: debouncedSearch.length >= 1,
    retry: false,
    staleTime: 0,
  });

  const matches = useMemo(() => sortPledgeLoanMatches(loansQuery.data || [], debouncedSearch), [loansQuery.data, debouncedSearch]);
  const searching = search.trim().length > 0 && (search.trim() !== debouncedSearch || loansQuery.isFetching);
  const busy = lookupId !== null;

  useEffect(() => {
    onBusyRef.current(searching || busy || photoBusy);
  }, [searching, busy, photoBusy]);

  const applyLoan = async (loan: PledgeLoanRecord, withoutPhotos = false) => {
    const token = ++requestId.current;
    const requestedSearch = currentSearch.current.trim();
    setLookupId(loan.id);
    setClosureError("");
    setFailedLoanId(null);
    onBusyRef.current(true);
    try {
      const status = String(loan.status || "").toLowerCase();
      let closure: PledgeClosureRecord | undefined;
      if (status === "closed" || status === "बंद") {
        const response = await fetch(`/api/loan-closures?loanId=${encodeURIComponent(loan.id)}`, { credentials: "include" });
        if (!response.ok) throw new Error("बंद खात्याची समाप्ती माहिती मिळाली नाही.");
        const payload: unknown = await response.json();
        const rows = Array.isArray(payload) ? payload : (payload && typeof payload === "object" && Array.isArray((payload as { closures?: unknown }).closures) ? (payload as { closures: unknown[] }).closures : null);
        if (!rows) throw new Error("समाप्ती माहितीचे स्वरूप चुकीचे आहे.");
        closure = latestPledgeClosure(loan.id, rows.filter(row => row && typeof row === "object") as PledgeClosureRecord[]);
        if (!closure) throw new Error("या बंद खात्याची पुष्टी केलेली समाप्ती माहिती सापडली नाही.");
      }
      const photos = withoutPhotos ? { borrowerPhoto: "", collateralPhotos: [] } : await loadPledgeLoanPhotos(loan.id);
      if (requestId.current !== token || currentSearch.current.trim() !== requestedSearch) return;
      const accepted = onApply({ ...mapLoanToPledgeForm(loan, closure), ...photos }, loan);
      if (accepted) {
        setSelectedLoan(loan);
        setClosureError("");
        setFailedLoanId(null);
      }
    } catch (error) {
      if (requestId.current === token && currentSearch.current.trim() === requestedSearch) {
        setClosureError(error instanceof Error ? error.message : "खात्याची माहिती मिळाली नाही.");
        setFailedLoanId(loan.id);
      }
    } finally {
      if (requestId.current === token && currentSearch.current.trim() === requestedSearch) {
        setLookupId(null);
        onBusyRef.current(false);
      }
    }
  };

  const selectedDisplay = selectedLoan as LoanWithDisplay | null;
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="pledge-loan-search">खाते क्रमांक किंवा नावाने शोधा</Label>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <Input id="pledge-loan-search" value={search} onChange={event => updateSearch(event.target.value)} placeholder="किमान 1 अक्षर किंवा अंक" className="pl-9 pr-9" autoComplete="off" aria-describedby="pledge-loan-search-help" />
          {search && <button type="button" aria-label="शोध पुसा" onClick={() => updateSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>}
        </div>
        <p id="pledge-loan-search-help" className="mt-1.5 text-xs text-slate-500">अचूक खाते क्रमांकाचे परिणाम आधी दिसतील. खाते निवडल्यानंतर माहिती तपासून बदलता येईल.</p>
      </div>

      {search.trim().length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white" aria-live="polite">
          {searching ? (
            <div role="status" className="flex items-center gap-2 px-3 py-4 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> खाती शोधत आहोत…</div>
          ) : loansQuery.isError ? (
            <div className="space-y-2 p-3" role="alert">
              <p className="text-sm text-rose-700">खात्यांचा शोध पूर्ण झाला नाही.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => loansQuery.refetch()}>पुन्हा प्रयत्न करा</Button>
            </div>
          ) : matches.length ? (
            matches.map((loan, index) => {
              const display = loan as LoanWithDisplay;
              const group = display.groupName ?? display.loanGroupName ?? (display.group && typeof display.group === "object" ? (display.group as { name?: unknown }).name : undefined);
              const date = displayDate(display);
              return (
                <button type="button" data-loan-id={loan.id} key={`${loan.id}-${index}`} onClick={() => void applyLoan(loan)} disabled={busy} className="block w-full border-b border-slate-100 px-3 py-3 text-left last:border-0 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 disabled:opacity-60">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-slate-900">{loan.borrowerName}</span>
                    <span className="font-mono text-xs font-semibold text-indigo-800">खाते {loan.accountNumber}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                    {group != null && <span>{String(group)}</span>}
                    {date && <span>{date}</span>}
                    {loan.principalAmount != null && <span>₹{Number.isFinite(Number(loan.principalAmount)) ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(loan.principalAmount)) : String(loan.principalAmount)}</span>}
                    {loan.status && <span>{loan.status === "active" ? "चालू" : loan.status === "closed" ? "बंद" : loan.status}</span>}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-4 text-sm text-slate-500">या शोधासाठी खाते सापडले नाही.</p>
          )}
        </div>
      )}

      {busy && <p role="status" className="flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-900"><Loader2 className="h-4 w-4 animate-spin" /> खात्याची संपूर्ण माहिती तपासत आहोत…</p>}
      {closureError && (
        <div role="alert" className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="flex items-start gap-2 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{closureError}</p>
          {failedLoanId && <Button type="button" size="sm" variant="outline" onClick={() => {
            const loan = loansQuery.data?.find(row => row.id === failedLoanId);
            if (loan) void applyLoan(loan);
          }}>{closureError.includes("फोटो") ? "फोटो पुन्हा मिळवा" : "समाप्ती माहिती पुन्हा मिळवा"}</Button>}
          {failedLoanId && closureError.includes("फोटो") && <Button type="button" size="sm" variant="outline" className="ml-2" onClick={() => {
            const loan = loansQuery.data?.find(row => row.id === failedLoanId);
            if (loan) void applyLoan(loan, true);
          }}>फोटोविना माहिती भरा</Button>}
        </div>
      )}
      {selectedDisplay && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2.5" role="status">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-indigo-950"><Check className="h-4 w-4" /> निवडलेले खाते: {selectedLoan?.accountNumber} · {selectedLoan?.borrowerName}</p>
          <p className="mt-1 text-xs text-indigo-800">खात्याची माहिती फॉर्ममध्ये भरली आहे. प्रिंटपूर्वी तपशील संपादित करा.</p>
        </div>
      )}
      {selectedLoan && <PledgePhotoSelection key={selectedLoan.id} loanId={selectedLoan.id} onChange={onCollateralPhotosChange} onBusyChange={setPhotoBusy} />}
    </div>
  );
}
