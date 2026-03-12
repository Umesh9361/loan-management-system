import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileNav } from "@/components/ui/mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { DateUtils } from "@/lib/date-utils";
import {
  Search, Calendar, ScanLine, Square, CheckSquare, Trash2,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle,
  PackageSearch, RotateCcw, Printer, StopCircle, Play
} from "lucide-react";

const CDN_URL = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
const STORAGE_KEY = "inventory_scan_session";

const CAMERA_CONFIGS: Array<{ facingMode?: string }> = [
  { facingMode: "environment" },
  { facingMode: "user" },
  {},
];

let cdnLoadPromise: Promise<void> | null = null;

function loadHtml5QrcodeCdn(): Promise<void> {
  if (cdnLoadPromise) return cdnLoadPromise;
  if ((window as any).Html5Qrcode) {
    cdnLoadPromise = Promise.resolve();
    return cdnLoadPromise;
  }
  cdnLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CDN_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("CDN load failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = CDN_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("html5-qrcode CDN लोड होऊ शकला नाही"));
    document.head.appendChild(script);
  });
  return cdnLoadPromise;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1200;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    setTimeout(() => ctx.close(), 200);
  } catch {}
}

function playErrorBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 400;
    osc.type = "square";
    gain.gain.value = 0.2;
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 400);
  } catch {}
}

interface ScanSession {
  filterSettings: {
    searchQuery: string;
    groupId: string;
    dateFrom: string;
    dateTo: string;
    statusFilter: string;
    accountFrom: string;
    accountTo: string;
  };
  scannedLoanIds: string[];
  startedAt: string;
  expectedCount: number;
}

function saveSession(session: ScanSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

function loadSession(): ScanSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function InventoryScan() {
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [groupId, setGroupId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [accountFrom, setAccountFrom] = useState("");
  const [accountTo, setAccountTo] = useState("");

  const [phase, setPhase] = useState<"filter" | "scanning" | "report">("filter");
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "loading" | "active" | "error">("idle");
  const [scanError, setScanError] = useState("");
  const [duplicateFlash, setDuplicateFlash] = useState(false);
  const [showFound, setShowFound] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<ScanSession | null>(null);

  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const containerId = "inventory-scanner-container";

  const { data: loans = [], isLoading: loansLoading } = useQuery<any[]>({
    queryKey: ["/api/loans"],
  });

  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups"],
  });

  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.scannedLoanIds.length > 0) {
      setResumePrompt(saved);
    }
  }, []);

  const filteredLoans = useMemo(() => {
    if (!Array.isArray(loans)) return [];

    return loans.filter((loan: any) => {
      if (statusFilter !== "all") {
        if (statusFilter === "active" && loan.status !== "active") return false;
        if (statusFilter === "closed" && loan.status !== "closed") return false;
      }

      if (groupId !== "all" && loan.groupId !== groupId) return false;

      if (dateFrom) {
        const loanDate = new Date(loan.loanDate);
        if (loanDate < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const loanDate = new Date(loan.loanDate);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (loanDate > toDate) return false;
      }

      if (accountFrom) {
        const accNum = parseInt(loan.accountNumber, 10);
        const fromNum = parseInt(accountFrom, 10);
        if (!isNaN(accNum) && !isNaN(fromNum) && accNum < fromNum) return false;
      }
      if (accountTo) {
        const accNum = parseInt(loan.accountNumber, 10);
        const toNum = parseInt(accountTo, 10);
        if (!isNaN(accNum) && !isNaN(toNum) && accNum > toNum) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (loan.borrowerName || "").toLowerCase();
        const acc = (loan.accountNumber || "").toLowerCase();
        const collateral = (loan.collateralDetails || "").toLowerCase();
        if (!name.includes(q) && !acc.includes(q) && !collateral.includes(q)) return false;
      }

      return true;
    });
  }, [loans, searchQuery, groupId, dateFrom, dateTo, statusFilter, accountFrom, accountTo]);

  const loanMapById = useMemo(() => {
    const map: Record<string, any> = {};
    if (Array.isArray(loans)) {
      loans.forEach((l: any) => { map[String(l.id)] = l; });
    }
    return map;
  }, [loans]);

  const filteredLoanIds = useMemo(() => new Set(filteredLoans.map((l: any) => String(l.id))), [filteredLoans]);

  const missingLoans = useMemo(() => {
    return filteredLoans.filter((l: any) => !scannedIds.has(String(l.id)));
  }, [filteredLoans, scannedIds]);

  const foundLoans = useMemo(() => {
    return filteredLoans.filter((l: any) => scannedIds.has(String(l.id)));
  }, [filteredLoans, scannedIds]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      const s = scannerRef.current;
      scannerRef.current = null;
      try {
        if (s.isScanning) {
          s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch {} });
        } else {
          try { s.clear(); } catch {}
        }
      } catch {}
    }
  }, []);

  const onQrDecoded = useCallback((decodedText: string) => {
    if (!mountedRef.current) return;
    try {
      const url = new URL(decodedText);
      const match = url.pathname.match(/^\/qr\/([a-zA-Z0-9\-]+)$/);
      if (match) {
        const loanId = match[1];

        setScannedIds(prev => {
          if (prev.has(loanId)) {
            setDuplicateFlash(true);
            playErrorBeep();
            setTimeout(() => setDuplicateFlash(false), 800);
            return prev;
          }

          if (!filteredLoanIds.has(loanId)) {
            toast({
              title: "फिल्टर बाहेरील वस्तू",
              description: loanMapById[loanId]?.borrowerName
                ? `${loanMapById[loanId].borrowerName} (खाते ${loanMapById[loanId].accountNumber}) — सध्याच्या फिल्टरमध्ये नाही`
                : "ही वस्तू सध्याच्या फिल्टर मध्ये नाही",
              variant: "destructive",
            });
            playErrorBeep();
            return prev;
          }

          const newSet = new Set(prev);
          newSet.add(loanId);
          playBeep();

          const loan = loanMapById[loanId];
          if (loan) setLastScanned(loan);

          const session: ScanSession = {
            filterSettings: { searchQuery, groupId, dateFrom, dateTo, statusFilter, accountFrom, accountTo },
            scannedLoanIds: Array.from(newSet),
            startedAt: new Date().toISOString(),
            expectedCount: filteredLoans.length,
          };
          saveSession(session);

          return newSet;
        });
      } else {
        toast({ title: "अज्ञात QR", description: "हे आपल्या app चे QR नाही", variant: "destructive" });
        playErrorBeep();
      }
    } catch {
      toast({ title: "QR वाचता आला नाही", variant: "destructive" });
      playErrorBeep();
    }
  }, [filteredLoanIds, loanMapById, searchQuery, groupId, dateFrom, dateTo, statusFilter, accountFrom, accountTo, filteredLoans.length, toast]);

  const tryStartCamera = useCallback(async (scanner: any, boxSize: number): Promise<boolean> => {
    const scanConfig = { fps: 10, qrbox: { width: boxSize, height: boxSize } };
    for (const cfg of CAMERA_CONFIGS) {
      if (!mountedRef.current) return false;
      try {
        const cameraId = cfg.facingMode ? { facingMode: cfg.facingMode } : true;
        await scanner.start(cameraId, scanConfig, onQrDecoded, () => {});
        return true;
      } catch (e: any) {
        const msg = (e?.message || e?.name || "").toLowerCase();
        if (msg.includes("permission") || msg.includes("notallowed")) throw e;
      }
    }
    return false;
  }, [onQrDecoded]);

  const startScanning = useCallback(async () => {
    setPhase("scanning");
    setScanStatus("loading");
    setScanError("");

    await new Promise(r => setTimeout(r, 600));
    if (!mountedRef.current) return;

    const containerEl = document.getElementById(containerId);
    if (!containerEl || containerEl.offsetWidth === 0) {
      setScanError("Camera container तयार नाही — पुन्हा प्रयत्न करा");
      setScanStatus("error");
      return;
    }
    containerEl.innerHTML = "";

    try {
      await loadHtml5QrcodeCdn();
      if (!mountedRef.current) return;

      const Html5Qrcode = (window as any).Html5Qrcode;
      if (!Html5Qrcode) {
        setScanError("QR library लोड झाली नाही");
        setScanStatus("error");
        return;
      }

      stopScanner();
      const scanner = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = scanner;

      const containerW = containerEl.offsetWidth || 280;
      const boxSize = Math.min(containerW - 40, 220);

      const started = await tryStartCamera(scanner, boxSize);
      if (!mountedRef.current) return;

      if (started) {
        setScanStatus("active");
      } else {
        setScanError("Camera सापडला नाही");
        setScanStatus("error");
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("permission")) {
        setScanError("Camera परवानगी नाकारली — browser settings मध्ये camera allow करा");
      } else {
        setScanError(`Camera समस्या: ${msg || "unknown"}`);
      }
      setScanStatus("error");
    }
  }, [stopScanner, tryStartCamera]);

  const handleStopScan = useCallback(() => {
    stopScanner();
    setScanStatus("idle");
    setPhase("report");
  }, [stopScanner]);

  const handleClearSession = useCallback(() => {
    stopScanner();
    clearSession();
    setScannedIds(new Set());
    setLastScanned(null);
    setPhase("filter");
    setScanStatus("idle");
    setResumePrompt(null);
    setShowFound(false);
    toast({ title: "साफ केले", description: "Scan session clear झाले — नव्याने सुरू करा" });
  }, [stopScanner, toast]);

  const handleResume = useCallback((session: ScanSession) => {
    setSearchQuery(session.filterSettings.searchQuery);
    setGroupId(session.filterSettings.groupId);
    setDateFrom(session.filterSettings.dateFrom);
    setDateTo(session.filterSettings.dateTo);
    setStatusFilter(session.filterSettings.statusFilter);
    setAccountFrom(session.filterSettings.accountFrom || "");
    setAccountTo(session.filterSettings.accountTo || "");
    setScannedIds(new Set(session.scannedLoanIds));
    setResumePrompt(null);
    setPhase("filter");
    toast({ title: "Session पुन्हा सुरू", description: `${session.scannedLoanIds.length}/${session.expectedCount} आधीच scan झाले` });
  }, [toast]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [stopScanner]);

  const scannedCount = useMemo(() => {
    let count = 0;
    scannedIds.forEach(id => { if (filteredLoanIds.has(id)) count++; });
    return count;
  }, [scannedIds, filteredLoanIds]);

  if (resumePrompt) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col">
          <MobileNav />
          <div className="flex-1 p-4 flex items-center justify-center">
            <Card className="w-full max-w-md shadow-lg border-indigo-200">
              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  <PackageSearch className="h-12 w-12 text-indigo-600 mx-auto mb-3" />
                  <h2 className="text-lg font-bold text-indigo-900">अपूर्ण Scan सापडले</h2>
                  <p className="text-sm text-gray-600 mt-2">
                    तुमचे <span className="font-bold text-indigo-700">{resumePrompt.scannedLoanIds.length}/{resumePrompt.expectedCount}</span> scan चालू आहे
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(resumePrompt.startedAt).toLocaleString('mr-IN')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Button onClick={() => handleResume(resumePrompt)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Play className="h-4 w-4 mr-2" />
                    Continue करा
                  </Button>
                  <Button onClick={handleClearSession} variant="outline" className="w-full border-red-300 text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 mr-2" />
                    साफ करा — नव्याने सुरू
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col">
        <MobileNav />
        <div className="flex-1 p-3 md:p-6 pb-24 space-y-4 max-w-4xl mx-auto w-full">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageSearch className="h-6 w-6 text-indigo-600" />
              <h1 className="text-lg md:text-xl font-bold text-indigo-900">वस्तू तपासणी</h1>
            </div>
            {scannedIds.size > 0 && (
              <Button onClick={handleClearSession} variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                साफ करा
              </Button>
            )}
          </div>

          {phase === "filter" && (
            <>
              <Card className="shadow-sm border border-indigo-200">
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <Label className="text-indigo-700 font-medium text-sm mb-1.5">नाव किंवा खाते क्रमांक शोधा</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="नाव, खाते क्रमांक टाका..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-700 font-medium text-sm mb-1.5">ग्रुप निवडा</Label>
                    <Select value={groupId} onValueChange={setGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="सर्व ग्रुप" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">सर्व ग्रुप</SelectItem>
                        {Array.isArray(groups) && groups.map((g: any) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-700 font-medium text-sm flex items-center">
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        या तारखेपासून
                      </Label>
                      <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border-gray-300" />
                    </div>
                    <div>
                      <Label className="text-gray-700 font-medium text-sm flex items-center">
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        या तारखेपर्यंत
                      </Label>
                      <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border-gray-300" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-700 font-medium text-sm">खाते क्र. पासून</Label>
                      <Input
                        type="number"
                        placeholder="उदा. 100"
                        value={accountFrom}
                        onChange={(e) => setAccountFrom(e.target.value)}
                        className="border-gray-300"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-700 font-medium text-sm">खाते क्र. पर्यंत</Label>
                      <Input
                        type="number"
                        placeholder="उदा. 200"
                        value={accountTo}
                        onChange={(e) => setAccountTo(e.target.value)}
                        className="border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-indigo-700 font-medium mb-2 block">कर्जाची स्थिती</Label>
                    <RadioGroup value={statusFilter} onValueChange={setStatusFilter} className="flex space-x-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="inv-all" className="text-indigo-600" />
                        <Label htmlFor="inv-all" className="text-indigo-700">सर्व</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="active" id="inv-active" className="text-green-600" />
                        <Label htmlFor="inv-active" className="text-green-700">सक्रिय</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="closed" id="inv-closed" className="text-red-600" />
                        <Label htmlFor="inv-closed" className="text-red-700">बंद</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>

              <Card className={`shadow-sm border ${filteredLoans.length > 0 ? 'border-green-300 bg-green-50/50' : 'border-gray-200'}`}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PackageSearch className={`h-5 w-5 ${filteredLoans.length > 0 ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-700">
                        {loansLoading ? "लोड होत आहे..." : (
                          <>
                            एकूण <span className="text-lg font-bold text-indigo-700">{filteredLoans.length}</span> वस्तू सापडल्या
                          </>
                        )}
                      </span>
                    </div>
                    {scannedCount > 0 && (
                      <Badge className="bg-indigo-100 text-indigo-700">
                        {scannedCount}/{filteredLoans.length} scan झाले
                      </Badge>
                    )}
                  </div>

                  <Button
                    onClick={startScanning}
                    disabled={filteredLoans.length === 0 || loansLoading}
                    className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-base font-bold"
                  >
                    <ScanLine className="h-5 w-5 mr-2" />
                    {scannedCount > 0 ? `Scan सुरू ठेवा (${scannedCount}/${filteredLoans.length})` : "Scan सुरू करा"}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {phase === "scanning" && (
            <>
              <Card className="shadow-sm border border-indigo-300">
                <CardContent className="pt-4 space-y-3">
                  <style>{`
                    #${containerId} video {
                      width: 100% !important;
                      height: 100% !important;
                      object-fit: cover !important;
                      border-radius: 8px;
                    }
                    #${containerId} canvas {
                      width: 100% !important;
                      height: 100% !important;
                    }
                  `}</style>
                  <div
                    id={containerId}
                    style={{ width: '100%', height: '280px', borderRadius: '8px', background: '#111', position: 'relative' }}
                  />

                  {scanStatus === "loading" && (
                    <div className="text-center text-sm text-gray-500 py-1 flex items-center justify-center gap-2">
                      <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-indigo-600 rounded-full animate-spin" />
                      Camera सुरू होत आहे...
                    </div>
                  )}
                  {scanStatus === "error" && (
                    <div className="space-y-2">
                      <div className="text-center text-sm text-red-600 py-1">{scanError}</div>
                      <Button onClick={startScanning} variant="outline" className="w-full text-indigo-600 border-indigo-300">
                        <RotateCcw className="h-4 w-4 mr-1.5" />
                        पुन्हा प्रयत्न करा
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className={`rounded-xl p-4 text-center transition-colors ${duplicateFlash ? 'bg-yellow-100 border border-yellow-400' : 'bg-indigo-50 border border-indigo-200'}`}>
                <div className="text-3xl font-black text-indigo-700">
                  {scannedCount} <span className="text-lg font-medium text-gray-500">/ {filteredLoans.length}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {duplicateFlash ? (
                    <span className="text-yellow-700 font-medium">आधीच scan झाले!</span>
                  ) : (
                    "scan झाले"
                  )}
                </div>
              </div>

              {lastScanned && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-green-800 truncate">{lastScanned.borrowerName}</div>
                    <div className="text-xs text-green-600">खाते {lastScanned.accountNumber} • ₹{Number(lastScanned.principalAmount || 0).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={handleStopScan} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-5 font-bold">
                  <StopCircle className="h-5 w-5 mr-2" />
                  Scan थांबवा
                </Button>
                <Button onClick={handleClearSession} variant="outline" className="border-gray-300 text-gray-600 py-5">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {phase === "report" && (
            <div className="space-y-4 print-section">
              <style>{`
                @media print {
                  body * { visibility: hidden; }
                  .print-section, .print-section * { visibility: visible; }
                  .print-section { position: absolute; left: 0; top: 0; width: 100%; }
                  .no-print { display: none !important; }
                }
              `}</style>

              <Card className="shadow-lg border-2 border-indigo-300">
                <CardContent className="pt-5 space-y-4">
                  <h2 className="text-lg font-bold text-indigo-900 text-center">तपासणी अहवाल</h2>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-2xl font-black text-blue-700">{filteredLoans.length}</div>
                      <div className="text-xs text-blue-600">एकूण</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-2xl font-black text-green-700">{scannedCount}</div>
                      <div className="text-xs text-green-600">सापडल्या</div>
                    </div>
                    <div className={`rounded-lg p-3 ${missingLoans.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <div className={`text-2xl font-black ${missingLoans.length > 0 ? 'text-red-700' : 'text-green-700'}`}>{missingLoans.length}</div>
                      <div className={`text-xs ${missingLoans.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {missingLoans.length > 0 ? 'गहाळ' : 'गहाळ नाही'}
                      </div>
                    </div>
                  </div>

                  {missingLoans.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-bold text-red-700">गहाळ वस्तू ({missingLoans.length})</span>
                      </div>
                      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                        {missingLoans.map((loan: any) => {
                          const groupName = Array.isArray(groups) ? groups.find((g: any) => g.id === loan.groupId)?.name : "";
                          return (
                            <div key={loan.id} className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-sm font-bold text-red-900">{loan.borrowerName}</div>
                                  <div className="text-xs text-red-700">
                                    खाते {loan.accountNumber} • ₹{Number(loan.principalAmount || 0).toLocaleString('en-IN')}
                                  </div>
                                  {groupName && <div className="text-xs text-red-500 mt-0.5">{groupName}</div>}
                                </div>
                                <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                              </div>
                              {loan.collateralDetails && (
                                <div className="text-xs text-red-600 mt-1 truncate">{loan.collateralDetails}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {missingLoans.length === 0 && (
                    <div className="text-center py-4">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="text-green-700 font-bold">सर्व वस्तू सापडल्या!</p>
                    </div>
                  )}

                  {foundLoans.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowFound(!showFound)}
                        className="flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800"
                      >
                        {showFound ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <CheckCircle className="h-3.5 w-3.5" />
                        सापडलेल्या वस्तू ({foundLoans.length})
                      </button>
                      {showFound && (
                        <div className="space-y-1.5 mt-2 max-h-[30vh] overflow-y-auto">
                          {foundLoans.map((loan: any) => (
                            <div key={loan.id} className="bg-green-50 border border-green-100 rounded p-2 flex items-center gap-2">
                              <CheckSquare className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                              <span className="text-xs text-green-800 truncate">{loan.accountNumber} — {loan.borrowerName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3 no-print">
                <Button onClick={() => setPhase("filter")} variant="outline" className="flex-1 border-indigo-300 text-indigo-700">
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  परत Filter
                </Button>
                <Button onClick={startScanning} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                  <ScanLine className="h-4 w-4 mr-1.5" />
                  पुन्हा Scan
                </Button>
                <Button onClick={handlePrint} variant="outline" className="border-gray-300">
                  <Printer className="h-4 w-4" />
                </Button>
              </div>

              <div className="no-print">
                <Button onClick={handleClearSession} variant="outline" className="w-full border-red-300 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  साफ करा — नवीन तपासणी सुरू करा
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
