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
import {
  Search, Calendar, ScanLine, CheckSquare, Trash2,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle,
  PackageSearch, RotateCcw, Printer, StopCircle, Play, X, FilterX, Download,
  Camera, Keyboard, Mic, MicOff
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { decodeQrData } from "@/lib/qr-utils";

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
  try { navigator.vibrate?.(100); } catch {}
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
  try { navigator.vibrate?.([50, 50, 50]); } catch {}
}

function playCelebrationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.value = 0.25;
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.15);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {}
  try { navigator.vibrate?.([100, 50, 100, 50, 200]); } catch {}
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

function clearSessionStorage() {
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

  const [borrowerSearchTerm, setBorrowerSearchTerm] = useState("");
  const [showBorrowerSuggestions, setShowBorrowerSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const borrowerInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: borrowerAutocompleteSuggestions = [] } = useQuery<any[]>({
    queryKey: ["/api/borrowers/autocomplete", borrowerSearchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/borrowers/autocomplete?search=${encodeURIComponent(borrowerSearchTerm)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: borrowerSearchTerm.length >= 2,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (borrowerAutocompleteSuggestions.length > 0 && borrowerSearchTerm.length >= 2) {
      setShowBorrowerSuggestions(true);
    }
  }, [borrowerAutocompleteSuggestions, borrowerSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          borrowerInputRef.current && !borrowerInputRef.current.contains(event.target as Node)) {
        setShowBorrowerSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [phase, setPhase] = useState<"filter" | "scanning" | "report">("filter");
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "loading" | "active" | "error">("idle");
  const [scanError, setScanError] = useState("");
  const [duplicateFlash, setDuplicateFlash] = useState(false);
  const [autoStopFlash, setAutoStopFlash] = useState(false);
  const [showFound, setShowFound] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<ScanSession | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualAccountNo, setManualAccountNo] = useState("");
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [deviceMode, setDeviceMode] = useState(false);
  const [scanMode, setScanMode] = useState<"camera" | "manual">("camera");
  const [rapidInput, setRapidInput] = useState("");
  const rapidInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [rapidAddedFlash, setRapidAddedFlash] = useState<string | null>(null);

  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const deviceKeystrokeTimerRef = useRef<number | null>(null);
  const deviceCharCountRef = useRef(0);
  const containerId = "inventory-scanner-container";

  const filteredLoanIdsRef = useRef<Set<string>>(new Set());
  const loanMapByIdRef = useRef<Record<string, any>>({});
  const scannedIdsRef = useRef<Set<string>>(new Set());
  const filterSettingsRef = useRef({ searchQuery, groupId, dateFrom, dateTo, statusFilter, accountFrom, accountTo });
  const filteredCountRef = useRef(0);

  const { data: loans = [], isLoading: loansLoading } = useQuery<any[]>({
    queryKey: ["/api/loans"],
  });

  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups"],
  });

  const { data: company } = useQuery({
    queryKey: ["/api/company"],
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

      if (groupId !== "all" && String(loan.groupId) !== String(groupId)) return false;

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

  useEffect(() => { filteredLoanIdsRef.current = filteredLoanIds; }, [filteredLoanIds]);
  useEffect(() => { loanMapByIdRef.current = loanMapById; }, [loanMapById]);
  useEffect(() => { scannedIdsRef.current = scannedIds; }, [scannedIds]);
  useEffect(() => { filteredCountRef.current = filteredLoans.length; }, [filteredLoans.length]);
  useEffect(() => {
    filterSettingsRef.current = { searchQuery, groupId, dateFrom, dateTo, statusFilter, accountFrom, accountTo };
  }, [searchQuery, groupId, dateFrom, dateTo, statusFilter, accountFrom, accountTo]);

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
      const loanId = decodeQrData(decodedText);
      if (!loanId) {
        toast({ title: "अज्ञात QR", description: "हे आपल्या app चे QR नाही", variant: "destructive" });
        playErrorBeep();
        return;
      }
      const currentScanned = scannedIdsRef.current;
      const currentFilteredIds = filteredLoanIdsRef.current;
      const currentLoanMap = loanMapByIdRef.current;

      if (currentScanned.has(loanId)) {
        setDuplicateFlash(true);
        playErrorBeep();
        setTimeout(() => setDuplicateFlash(false), 800);
        return;
      }

      if (!currentFilteredIds.has(loanId)) {
        const loan = currentLoanMap[loanId];
        toast({
          title: "फिल्टर बाहेरील वस्तू",
          description: loan?.borrowerName
            ? `${loan.borrowerName} (खाते ${loan.accountNumber}) — सध्याच्या फिल्टरमध्ये नाही`
            : "ही वस्तू सध्याच्या फिल्टर मध्ये नाही",
          variant: "destructive",
        });
        playErrorBeep();
        return;
      }

      const newSet = new Set(currentScanned);
      newSet.add(loanId);
      setScannedIds(newSet);

      const loan = currentLoanMap[loanId];
      if (loan) setLastScanned(loan);

      const session: ScanSession = {
        filterSettings: filterSettingsRef.current,
        scannedLoanIds: Array.from(newSet),
        startedAt: new Date().toISOString(),
        expectedCount: filteredCountRef.current,
      };
      saveSession(session);

      let scannedInFilter = 0;
      newSet.forEach(id => { if (currentFilteredIds.has(id)) scannedInFilter++; });
      const totalFiltered = filteredCountRef.current;

      if (totalFiltered > 0 && scannedInFilter >= totalFiltered) {
        playCelebrationSound();
        setAutoStopFlash(true);
        setTimeout(() => {
          setAutoStopFlash(false);
          stopScanner();
          setScanStatus("idle");
          setPhase("report");
        }, 1800);
      } else {
        playBeep();
      }
    } catch {
      toast({ title: "QR वाचता आला नाही", variant: "destructive" });
      playErrorBeep();
    }
  }, [toast, stopScanner]);

  const deviceModeRef = useRef(false);
  useEffect(() => { deviceModeRef.current = deviceMode; }, [deviceMode]);

  const handleDeviceScanInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = (e.target as HTMLInputElement).value.trim();
      if (!val) return;
      (e.target as HTMLInputElement).value = '';

      const charCount = deviceCharCountRef.current;
      deviceCharCountRef.current = 0;
      if (deviceKeystrokeTimerRef.current) {
        clearTimeout(deviceKeystrokeTimerRef.current);
        deviceKeystrokeTimerRef.current = null;
      }

      if (!deviceModeRef.current && charCount >= 8) {
        setDeviceMode(true);
        deviceModeRef.current = true;
        stopScanner();
        setScanStatus("idle");
      }

      onQrDecoded(val);
      setTimeout(() => deviceInputRef.current?.focus(), 50);
      return;
    }

    if (e.key.length === 1) {
      deviceCharCountRef.current++;
      if (deviceKeystrokeTimerRef.current) clearTimeout(deviceKeystrokeTimerRef.current);
      deviceKeystrokeTimerRef.current = window.setTimeout(() => {
        deviceCharCountRef.current = 0;
      }, 800);
    }
  }, [onQrDecoded, stopScanner]);

  const handleManualAdd = useCallback(() => {
    const accNo = manualAccountNo.trim();
    if (!accNo) return;

    const loan = filteredLoans.find((l: any) => String(l.accountNumber) === accNo);
    if (!loan) {
      const allLoan = (loans as any[])?.find((l: any) => String(l.accountNumber) === accNo);
      if (allLoan) {
        toast({ title: "फिल्टर बाहेरील वस्तू", description: `${allLoan.borrowerName} (खाते ${allLoan.accountNumber}) — सध्याच्या फिल्टरमध्ये नाही`, variant: "destructive" });
      } else {
        toast({ title: "खाते सापडले नाही", description: `खाते क्रमांक ${accNo} सापडले नाही`, variant: "destructive" });
      }
      playErrorBeep();
      return;
    }

    const loanId = String(loan.id);
    const currentScanned = scannedIdsRef.current;

    if (currentScanned.has(loanId)) {
      setDuplicateFlash(true);
      playErrorBeep();
      toast({ title: "आधीच scan झाले", description: `खाते ${accNo} आधीच जोडले आहे`, variant: "destructive" });
      setTimeout(() => setDuplicateFlash(false), 800);
      setManualAccountNo("");
      return;
    }

    const newSet = new Set(currentScanned);
    newSet.add(loanId);
    setScannedIds(newSet);
    setLastScanned(loan);
    setManualAccountNo("");

    const session: ScanSession = {
      filterSettings: filterSettingsRef.current,
      scannedLoanIds: Array.from(newSet),
      startedAt: new Date().toISOString(),
      expectedCount: filteredCountRef.current,
    };
    saveSession(session);

    let scannedInFilter = 0;
    const currentFilteredIds = filteredLoanIdsRef.current;
    newSet.forEach(id => { if (currentFilteredIds.has(id)) scannedInFilter++; });
    const totalFiltered = filteredCountRef.current;

    if (totalFiltered > 0 && scannedInFilter >= totalFiltered) {
      playCelebrationSound();
      setAutoStopFlash(true);
      setTimeout(() => {
        setAutoStopFlash(false);
        stopScanner();
        setScanStatus("idle");
        setPhase("report");
      }, 1800);
    } else {
      playBeep();
    }

    toast({ title: "मॅन्युअल जोडले", description: `${loan.borrowerName} — खाते ${accNo}` });
  }, [manualAccountNo, filteredLoans, loans, toast, stopScanner]);

  const marathiNumberMap: Record<string, number> = useMemo(() => ({
    'शून्य': 0, 'एक': 1, 'दोन': 2, 'तीन': 3, 'चार': 4, 'पाच': 5,
    'सहा': 6, 'सात': 7, 'आठ': 8, 'नऊ': 9, 'दहा': 10,
    'अकरा': 11, 'बारा': 12, 'तेरा': 13, 'चौदा': 14, 'पंधरा': 15,
    'सोळा': 16, 'सतरा': 17, 'अठरा': 18, 'एकोणीस': 19, 'वीस': 20,
    'एकवीस': 21, 'बावीस': 22, 'तेवीस': 23, 'चोवीस': 24, 'पंचवीस': 25,
    'सव्वीस': 26, 'सत्तावीस': 27, 'अठ्ठावीस': 28, 'एकोणतीस': 29, 'तीस': 30,
    'एकतीस': 31, 'बत्तीस': 32, 'तेहतीस': 33, 'चौतीस': 34, 'पस्तीस': 35,
    'छत्तीस': 36, 'सदतीस': 37, 'अडतीस': 38, 'एकोणचाळीस': 39, 'चाळीस': 40,
    'एक्केचाळीस': 41, 'बेचाळीस': 42, 'त्रेचाळीस': 43, 'चव्वेचाळीस': 44, 'पंचेचाळीस': 45,
    'सेहेचाळीस': 46, 'सत्तेचाळीस': 47, 'अठ्ठेचाळीस': 48, 'एकोणपन्नास': 49, 'पन्नास': 50,
    'एक्कावन्न': 51, 'बावन्न': 52, 'त्रेपन्न': 53, 'चोपन्न': 54, 'पंचावन्न': 55,
    'छप्पन्न': 56, 'सत्तावन्न': 57, 'अठ्ठावन्न': 58, 'एकोणसाठ': 59, 'साठ': 60,
    'एकसष्ट': 61, 'बासष्ट': 62, 'त्रेसष्ट': 63, 'चौसष्ट': 64, 'पासष्ट': 65,
    'सहासष्ट': 66, 'सदुसष्ट': 67, 'अडुसष्ट': 68, 'एकोणसत्तर': 69, 'सत्तर': 70,
    'एक्काहत्तर': 71, 'बाहत्तर': 72, 'त्र्याहत्तर': 73, 'चौऱ्याहत्तर': 74, 'पंच्याहत्तर': 75,
    'शहात्तर': 76, 'सत्याहत्तर': 77, 'अठ्ठ्याहत्तर': 78, 'एकोणऐंशी': 79, 'ऐंशी': 80,
    'एक्क्याऐंशी': 81, 'ब्याऐंशी': 82, 'त्र्याऐंशी': 83, 'चौऱ्याऐंशी': 84, 'पंच्याऐंशी': 85,
    'शहाऐंशी': 86, 'सत्त्याऐंशी': 87, 'अठ्ठ्याऐंशी': 88, 'एकोणनव्वद': 89, 'नव्वद': 90,
    'एक्क्याण्णव': 91, 'ब्याण्णव': 92, 'त्र्याण्णव': 93, 'चौऱ्याण्णव': 94, 'पंच्याण्णव': 95,
    'शहाण्णव': 96, 'सत्त्याण्णव': 97, 'अठ्ठ्याण्णव': 98, 'नव्व्याण्णव': 99,
    'शंभर': 100, 'दोनशे': 200, 'तीनशे': 300, 'चारशे': 400, 'पाचशे': 500,
    'सहाशे': 600, 'सातशे': 700, 'आठशे': 800, 'नऊशे': 900, 'हजार': 1000,
  }), []);

  const parseMarathiNumber = useCallback((text: string): string | null => {
    const trimmed = text.trim();
    if (/^\d+$/.test(trimmed)) return trimmed;
    const direct = marathiNumberMap[trimmed];
    if (direct !== undefined) return String(direct);
    const parts = trimmed.split(/\s+/);
    if (parts.length === 2) {
      const a = marathiNumberMap[parts[0]];
      const b = marathiNumberMap[parts[1]];
      if (a !== undefined && b !== undefined) {
        if (a >= 100 && b < 100) return String(a + b);
        if (a === 1000 && b < 1000) return String(a + b);
      }
    }
    if (parts.length === 3) {
      const a = marathiNumberMap[parts[0]];
      const b = marathiNumberMap[parts[1]];
      const c = marathiNumberMap[parts[2]];
      if (a !== undefined && b !== undefined && c !== undefined) {
        if (a >= 100 && b >= 100) return String(a + b + c);
      }
    }
    return null;
  }, [marathiNumberMap]);

  const handleRapidAdd = useCallback((accNo: string) => {
    const trimmed = accNo.trim();
    if (!trimmed) return;

    const loan = filteredLoans.find((l: any) => String(l.accountNumber) === trimmed);
    if (!loan) {
      const allLoan = (loans as any[])?.find((l: any) => String(l.accountNumber) === trimmed);
      if (allLoan) {
        toast({ title: "फिल्टर बाहेरील", description: `${allLoan.borrowerName} (खाते ${allLoan.accountNumber}) — फिल्टरमध्ये नाही`, variant: "destructive" });
      } else {
        toast({ title: "सापडले नाही", description: `खाते ${trimmed} सापडले नाही`, variant: "destructive" });
      }
      playErrorBeep();
      return;
    }

    const loanId = String(loan.id);
    const currentScanned = scannedIdsRef.current;

    if (currentScanned.has(loanId)) {
      setDuplicateFlash(true);
      playErrorBeep();
      setTimeout(() => setDuplicateFlash(false), 800);
      return;
    }

    const newSet = new Set(currentScanned);
    newSet.add(loanId);
    setScannedIds(newSet);
    setLastScanned(loan);
    setRapidAddedFlash(trimmed);
    setTimeout(() => setRapidAddedFlash(null), 600);

    const session: ScanSession = {
      filterSettings: filterSettingsRef.current,
      scannedLoanIds: Array.from(newSet),
      startedAt: new Date().toISOString(),
      expectedCount: filteredCountRef.current,
    };
    saveSession(session);

    let scannedInFilter = 0;
    const currentFilteredIds = filteredLoanIdsRef.current;
    newSet.forEach(id => { if (currentFilteredIds.has(id)) scannedInFilter++; });
    const totalFiltered = filteredCountRef.current;

    if (totalFiltered > 0 && scannedInFilter >= totalFiltered) {
      playCelebrationSound();
      setAutoStopFlash(true);
      setTimeout(() => {
        setAutoStopFlash(false);
        setScanStatus("idle");
        setPhase("report");
      }, 1800);
    } else {
      playBeep();
    }
  }, [filteredLoans, loans, toast]);

  const handleRapidKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const val = rapidInput.trim();
      if (val) {
        const parsed = parseMarathiNumber(val);
        if (parsed) {
          handleRapidAdd(parsed);
        } else {
          toast({ title: "ओळखता आला नाही", description: `"${val}" हा खाते क्रमांक नाही`, variant: "destructive" });
          playErrorBeep();
        }
      }
      setRapidInput("");
    }
  }, [rapidInput, handleRapidAdd, parseMarathiNumber, toast]);

  const hasSpeechRecognition = useMemo(() => {
    return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }, []);

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startVoice = useCallback(() => {
    if (!hasSpeechRecognition) return;
    stopVoice();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'mr-IN';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          const words = transcript.split(/[,\s]+/).filter((w: string) => w.length > 0);
          for (const word of words) {
            const parsed = parseMarathiNumber(word);
            if (parsed) {
              handleRapidAdd(parsed);
            }
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        toast({ title: "Voice त्रुटी", description: `${event.error}`, variant: "destructive" });
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition && mountedRef.current) {
        try { recognition.start(); } catch { setIsListening(false); }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      toast({ title: "Voice सुरू झाले नाही", variant: "destructive" });
    }
  }, [hasSpeechRecognition, stopVoice, parseMarathiNumber, handleRapidAdd, toast]);

  useEffect(() => {
    if (phase !== 'scanning' || scanMode !== 'manual') {
      stopVoice();
    }
  }, [phase, scanMode, stopVoice]);

  useEffect(() => {
    if (phase !== 'scanning') return;
    if (scanMode === 'camera') {
      const interval = setInterval(() => {
        if (deviceInputRef.current && document.activeElement !== deviceInputRef.current) {
          const tag = document.activeElement?.tagName?.toLowerCase();
          if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
            deviceInputRef.current.focus();
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
    if (scanMode === 'manual') {
      setTimeout(() => rapidInputRef.current?.focus(), 200);
    }
  }, [phase, scanMode]);
  }, [phase]);

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
    stopScanner();
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
    stopVoice();
    setScanStatus("idle");
    setPhase("report");
  }, [stopScanner, stopVoice]);

  const handleBackFromScanning = useCallback(() => {
    stopScanner();
    stopVoice();
    setScanStatus("idle");
    setPhase("filter");
  }, [stopScanner, stopVoice]);

  const hasAnyFilter = searchQuery || groupId !== "all" || dateFrom || dateTo || statusFilter !== "active" || accountFrom || accountTo;

  const handleClearAllFilters = useCallback(() => {
    setSearchQuery("");
    setGroupId("all");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("active");
    setAccountFrom("");
    setAccountTo("");
    setBorrowerSearchTerm("");
    setShowBorrowerSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, []);

  const handleClearSession = useCallback(() => {
    stopScanner();
    stopVoice();
    clearSessionStorage();
    setScannedIds(new Set());
    setLastScanned(null);
    setPhase("filter");
    setScanStatus("idle");
    setResumePrompt(null);
    setShowFound(false);
    setSearchQuery("");
    setGroupId("all");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("active");
    setAccountFrom("");
    setAccountTo("");
    setBorrowerSearchTerm("");
    setShowBorrowerSuggestions(false);
    setSelectedSuggestionIndex(-1);
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

  const buildReportHTML = useCallback((forPdf: boolean = false) => {
    const companyName = (company as any)?.name || 'कंपनी नाव';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('mr-IN', { hour: '2-digit', minute: '2-digit' });
    const fontFamily = "'Noto Sans Devanagari', Arial, sans-serif";
    const renderWidth = forPdf ? 794 : 'auto';
    const paddingStyle = forPdf ? 'padding: 18px 14px 18px 14px;' : 'padding: 12mm 5mm 12mm 5mm;';

    const selectedGroup = Array.isArray(groups) ? groups.find((g: any) => String(g.id) === groupId) : null;
    const groupLabel = selectedGroup?.name || 'सर्व गट';

    let filterInfo = `गट: ${groupLabel}`;
    if (accountFrom || accountTo) filterInfo += ` | खाते: ${accountFrom || '—'} ते ${accountTo || '—'}`;
    if (statusFilter !== 'all') filterInfo += ` | स्थिती: ${statusFilter === 'active' ? 'चालू' : 'बंद'}`;

    const bdr = '1.5px solid #333';
    const thStyle = `border:${bdr};padding:7px 5px;text-align:center;font-size:11px;background:#4F46E5;color:#fff;font-weight:700;line-height:1.3;`;
    const tdBase = `border:${bdr};padding:6px 5px;font-size:11px;font-weight:500;line-height:1.3;`;

    const missingRows = missingLoans.map((loan: any, idx: number) => {
      const gName = Array.isArray(groups) ? groups.find((g: any) => String(g.id) === String(loan.groupId))?.name || '' : '';
      const loanDate = loan.loanDate ? new Date(loan.loanDate).toLocaleDateString('en-GB') : '-';
      return `<tr${idx % 2 === 1 ? ' style="background:#FEF2F2;"' : ''}>
        <td style="${tdBase}text-align:center;">${idx + 1}</td>
        <td style="${tdBase}text-align:center;font-weight:700;">${loan.accountNumber}</td>
        <td style="${tdBase}">${loan.borrowerName}</td>
        <td style="${tdBase}text-align:right;">₹${Number(loan.principalAmount || 0).toLocaleString('en-IN')}</td>
        <td style="${tdBase}text-align:center;">${loanDate}</td>
        <td style="${tdBase}">${gName}</td>
        <td style="${tdBase}font-size:10px;">${loan.collateralDetails || '-'}</td>
      </tr>`;
    }).join('');

    const foundRows = foundLoans.map((loan: any, idx: number) => {
      const gName = Array.isArray(groups) ? groups.find((g: any) => String(g.id) === String(loan.groupId))?.name || '' : '';
      return `<tr${idx % 2 === 1 ? ' style="background:#F0FDF4;"' : ''}>
        <td style="${tdBase}text-align:center;">${idx + 1}</td>
        <td style="${tdBase}text-align:center;">${loan.accountNumber}</td>
        <td style="${tdBase}">${loan.borrowerName}</td>
        <td style="${tdBase}text-align:right;">₹${Number(loan.principalAmount || 0).toLocaleString('en-IN')}</td>
        <td style="${tdBase}">${gName}</td>
      </tr>`;
    }).join('');

    const totalAmount = filteredLoans.reduce((s: number, l: any) => s + Number(l.principalAmount || 0), 0);
    const missingAmount = missingLoans.reduce((s: number, l: any) => s + Number(l.principalAmount || 0), 0);
    const foundAmount = foundLoans.reduce((s: number, l: any) => s + Number(l.principalAmount || 0), 0);

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      @page { size: A4 portrait; margin: 12mm 8mm 12mm 8mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: ${fontFamily}; background: white; width: ${typeof renderWidth === 'number' ? renderWidth + 'px' : renderWidth}; ${paddingStyle} font-size: 11px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: auto; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    </style></head><body>
    <div style="text-align:center;margin-bottom:14px;">
      <p style="font-size:16px;font-weight:700;margin-bottom:3px;">${companyName}</p>
      <p style="font-size:14px;font-weight:700;color:#4F46E5;margin-bottom:3px;">वस्तू तपासणी अहवाल</p>
      <p style="font-size:11px;color:#555;margin-bottom:2px;">${filterInfo}</p>
      <p style="font-size:10px;color:#777;">दिनांक: ${dateStr} | वेळ: ${timeStr}</p>
    </div>
    <div style="height:2px;background:#4F46E5;margin:0 0 12px 0;"></div>

    <div style="display:flex;gap:0;margin-bottom:14px;border:${bdr};border-radius:0;">
      <div style="flex:1;text-align:center;padding:8px 4px;border-right:${bdr};">
        <div style="font-size:20px;font-weight:700;color:#4F46E5;">${filteredLoans.length}</div>
        <div style="font-size:10px;color:#555;">एकूण वस्तू</div>
        <div style="font-size:9px;color:#777;">₹${totalAmount.toLocaleString('en-IN')}</div>
      </div>
      <div style="flex:1;text-align:center;padding:8px 4px;border-right:${bdr};background:#F0FDF4;">
        <div style="font-size:20px;font-weight:700;color:#16A34A;">${scannedCount}</div>
        <div style="font-size:10px;color:#16A34A;">सापडल्या</div>
        <div style="font-size:9px;color:#555;">₹${foundAmount.toLocaleString('en-IN')}</div>
      </div>
      <div style="flex:1;text-align:center;padding:8px 4px;${missingLoans.length > 0 ? 'background:#FEF2F2;' : 'background:#F0FDF4;'}">
        <div style="font-size:20px;font-weight:700;color:${missingLoans.length > 0 ? '#DC2626' : '#16A34A'};">${missingLoans.length}</div>
        <div style="font-size:10px;color:${missingLoans.length > 0 ? '#DC2626' : '#16A34A'};">${missingLoans.length > 0 ? 'गहाळ' : 'गहाळ नाही'}</div>
        ${missingLoans.length > 0 ? `<div style="font-size:9px;color:#DC2626;">₹${missingAmount.toLocaleString('en-IN')}</div>` : ''}
      </div>
    </div>

    ${missingLoans.length > 0 ? `
    <p style="font-size:13px;font-weight:700;color:#DC2626;margin-bottom:6px;">⚠ गहाळ वस्तू (${missingLoans.length})</p>
    <table style="margin-bottom:16px;">
      <colgroup>
        <col style="width:6%;"><col style="width:10%;"><col style="width:22%;"><col style="width:14%;">
        <col style="width:11%;"><col style="width:15%;"><col style="width:22%;">
      </colgroup>
      <thead><tr>
        <th style="${thStyle}background:#DC2626;">अ.क्र.</th>
        <th style="${thStyle}background:#DC2626;">खाते क्र.</th>
        <th style="${thStyle}background:#DC2626;">कर्जदार नाव</th>
        <th style="${thStyle}background:#DC2626;">रक्कम</th>
        <th style="${thStyle}background:#DC2626;">तारीख</th>
        <th style="${thStyle}background:#DC2626;">गट</th>
        <th style="${thStyle}background:#DC2626;">वस्तू तपशील</th>
      </tr></thead>
      <tbody>${missingRows}</tbody>
      <tfoot><tr>
        <td colspan="3" style="${tdBase}text-align:right;font-weight:700;background:#FEE2E2;">एकूण गहाळ रक्कम:</td>
        <td style="${tdBase}text-align:right;font-weight:700;background:#FEE2E2;">₹${missingAmount.toLocaleString('en-IN')}</td>
        <td colspan="3" style="${tdBase}background:#FEE2E2;"></td>
      </tr></tfoot>
    </table>
    ` : `
    <div style="text-align:center;padding:20px 0;margin-bottom:16px;">
      <p style="font-size:16px;color:#16A34A;font-weight:700;">✓ सर्व वस्तू सापडल्या!</p>
    </div>
    `}

    ${foundLoans.length > 0 ? `
    <p style="font-size:13px;font-weight:700;color:#16A34A;margin-bottom:6px;">✓ सापडलेल्या वस्तू (${foundLoans.length})</p>
    <table>
      <colgroup>
        <col style="width:7%;"><col style="width:12%;"><col style="width:35%;"><col style="width:20%;"><col style="width:26%;">
      </colgroup>
      <thead><tr>
        <th style="${thStyle}">अ.क्र.</th>
        <th style="${thStyle}">खाते क्र.</th>
        <th style="${thStyle}">कर्जदार नाव</th>
        <th style="${thStyle}">रक्कम</th>
        <th style="${thStyle}">गट</th>
      </tr></thead>
      <tbody>${foundRows}</tbody>
      <tfoot><tr>
        <td colspan="3" style="${tdBase}text-align:right;font-weight:700;background:#e0e7ff;">एकूण सापडलेली रक्कम:</td>
        <td style="${tdBase}text-align:right;font-weight:700;background:#e0e7ff;">₹${foundAmount.toLocaleString('en-IN')}</td>
        <td style="${tdBase}background:#e0e7ff;"></td>
      </tr></tfoot>
    </table>
    ` : ''}

    <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:11px;font-weight:600;padding:0 10px;">
      <span>दिनांक: ${dateStr}</span>
      <span>सावकाराची सही</span>
    </div>
    </body></html>`;
  }, [company, groups, groupId, accountFrom, accountTo, statusFilter, filteredLoans, missingLoans, foundLoans, scannedCount]);

  const handlePrint = useCallback(() => {
    const printHTML = buildReportHTML(false);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "794px";
    iframe.style.height = "1123px";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(printHTML);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      }
      setTimeout(() => { document.body.removeChild(iframe); }, 2000);
    }, 500);
  }, [buildReportHTML]);

  const handlePdfDownload = useCallback(async () => {
    try {
      const renderWidthPx = 794;
      const fullHTML = buildReportHTML(true);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = renderWidthPx + 'px';
      iframe.style.height = '2000px';
      iframe.style.border = 'none';
      iframe.style.overflow = 'visible';
      iframe.style.zIndex = '-9999';
      iframe.style.pointerEvents = 'none';
      iframe.style.opacity = '0';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        toast({ title: "PDF त्रुटी", description: "PDF तयार करता आली नाही", variant: "destructive" });
        return;
      }

      iframeDoc.open();
      iframeDoc.write(fullHTML);
      iframeDoc.close();

      await new Promise(resolve => setTimeout(resolve, 300));
      if (iframeDoc.fonts && iframeDoc.fonts.ready) {
        await iframeDoc.fonts.ready;
      }
      await new Promise(resolve => setTimeout(resolve, 200));

      const targetEl = iframeDoc.body;
      const canvas = await html2canvas(targetEl, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: renderWidthPx,
        windowWidth: renderWidthPx,
      });

      document.body.removeChild(iframe);

      const a4Width = 210;
      const a4Height = 297;
      const margin = 5;
      const contentWidth = a4Width - (margin * 2);
      const contentHeight = a4Height - (margin * 2);

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = contentWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      const pageContentHeight = contentHeight;
      const totalPages = Math.ceil(scaledHeight / pageContentHeight);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();
        const sourceY = (page * pageContentHeight) / ratio;
        const sourceHeight = Math.min(pageContentHeight / ratio, imgHeight - sourceY);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = sourceHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
        }
        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const drawHeight = sourceHeight * ratio;
        pdf.addImage(pageImgData, 'JPEG', margin, margin, contentWidth, drawHeight);
      }

      const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
      pdf.save(`वस्तू_तपासणी_अहवाल_${dateStr}.pdf`);

      toast({ title: "PDF डाउनलोड झाली", description: `${filteredLoans.length} वस्तूंचा अहवाल PDF तयार झाली` });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: "PDF त्रुटी", description: "PDF तयार करताना समस्या आली", variant: "destructive" });
    }
  }, [buildReportHTML, filteredLoans.length, toast]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
      stopVoice();
    };
  }, [stopScanner, stopVoice]);

  const scannedCount = useMemo(() => {
    let count = 0;
    scannedIds.forEach(id => { if (filteredLoanIds.has(id)) count++; });
    return count;
  }, [scannedIds, filteredLoanIds]);

  if (resumePrompt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50">
        <MobileNav />
        <div className="lg:flex">
          <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
            <Sidebar />
          </aside>
          <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
            <div className="flex-1 p-4 flex items-center justify-center min-h-[60vh]">
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
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50">
      <MobileNav />
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 lg:h-screen">
          <Sidebar />
        </aside>
        <main className="flex-1 w-full lg:pl-72 pb-16 lg:pb-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-4 max-w-4xl mx-auto w-full">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageSearch className="h-6 w-6 text-indigo-600" />
              <h1 className="text-lg md:text-xl font-bold text-indigo-900">
                {phase === "scanning" ? "Scan चालू आहे" : phase === "report" ? "तपासणी अहवाल" : "वस्तू तपासणी"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {phase === "scanning" && (
                <button
                  onClick={handleBackFromScanning}
                  className="p-2 rounded-full bg-white border border-gray-300 shadow-sm hover:bg-gray-100 active:bg-gray-200 transition-colors"
                  title="बंद करा"
                >
                  <X className="h-5 w-5 text-gray-700" />
                </button>
              )}
              {phase === "filter" && hasAnyFilter && (
                <Button onClick={handleClearAllFilters} variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50">
                  <FilterX className="h-3.5 w-3.5 mr-1" />
                  फिल्टर साफ
                </Button>
              )}
              {scannedIds.size > 0 && phase !== "scanning" && (
                <Button onClick={handleClearSession} variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  साफ करा
                </Button>
              )}
            </div>
          </div>

          {phase === "filter" && (
            <>
              <Card className="shadow-sm border border-indigo-200">
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <Label className="text-indigo-700 font-medium text-sm mb-1.5">कर्जदाराचे नाव शोधा</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 z-10" />
                      <Input
                        ref={borrowerInputRef}
                        placeholder="नाव टाइप करा (2 अक्षरे)..."
                        value={searchQuery}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSearchQuery(value);
                          const trimmedVal = value.trimStart();
                          const firstWord = trimmedVal.split(/\s/)[0] || '';
                          const smartTrim = (firstWord.length <= 1 && trimmedVal.length > firstWord.length) ? trimmedVal : value.trim();
                          setBorrowerSearchTerm(smartTrim);
                          setSelectedSuggestionIndex(-1);
                          if (smartTrim.length >= 2) {
                            setShowBorrowerSuggestions(true);
                          } else {
                            setShowBorrowerSuggestions(false);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (!showBorrowerSuggestions || borrowerAutocompleteSuggestions.length === 0) return;
                          switch (e.key) {
                            case 'ArrowDown':
                              e.preventDefault();
                              setSelectedSuggestionIndex(prev =>
                                prev < borrowerAutocompleteSuggestions.length - 1 ? prev + 1 : 0
                              );
                              break;
                            case 'ArrowUp':
                              e.preventDefault();
                              setSelectedSuggestionIndex(prev =>
                                prev > 0 ? prev - 1 : borrowerAutocompleteSuggestions.length - 1
                              );
                              break;
                            case 'Enter':
                              e.preventDefault();
                              if (selectedSuggestionIndex >= 0) {
                                const selected = borrowerAutocompleteSuggestions[selectedSuggestionIndex];
                                setSearchQuery(selected.borrowerName);
                                setBorrowerSearchTerm("");
                                setShowBorrowerSuggestions(false);
                                setSelectedSuggestionIndex(-1);
                              }
                              break;
                            case 'Escape':
                              setShowBorrowerSuggestions(false);
                              setSelectedSuggestionIndex(-1);
                              break;
                          }
                        }}
                        onFocus={() => {
                          if (borrowerAutocompleteSuggestions.length > 0 && borrowerSearchTerm.length >= 2) {
                            setShowBorrowerSuggestions(true);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setShowBorrowerSuggestions(false);
                            setSelectedSuggestionIndex(-1);
                          }, 300);
                        }}
                        className="pl-10 border-gray-300"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery("");
                            setBorrowerSearchTerm("");
                            setShowBorrowerSuggestions(false);
                            borrowerInputRef.current?.focus();
                          }}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors z-10"
                        >
                          <XCircle className="h-4 w-4 text-gray-400" />
                        </button>
                      )}
                      {showBorrowerSuggestions && borrowerAutocompleteSuggestions.length > 0 && (
                        <div ref={suggestionsRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {borrowerAutocompleteSuggestions.filter((borrower: any, index: number, arr: any[]) => {
                            const normalizedName = (borrower.borrowerName || '').normalize('NFC').trim().replace(/\s+/g, ' ');
                            return arr.findIndex((b: any) => (b.borrowerName || '').normalize('NFC').trim().replace(/\s+/g, ' ') === normalizedName) === index;
                          }).map((borrower: any, index: number) => (
                            <div
                              key={index}
                              className={`p-3 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${
                                index === selectedSuggestionIndex
                                  ? 'bg-indigo-100 border-indigo-200'
                                  : 'hover:bg-indigo-50'
                              }`}
                              onMouseEnter={() => setSelectedSuggestionIndex(index)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSearchQuery(borrower.borrowerName);
                                setBorrowerSearchTerm("");
                                setShowBorrowerSuggestions(false);
                                setSelectedSuggestionIndex(-1);
                              }}
                            >
                              <div className="font-medium text-gray-900">{borrower.borrowerName}</div>
                              {borrower.borrowerMobile && (
                                <div className="text-xs text-gray-500">{borrower.borrowerMobile}</div>
                              )}
                              {borrower.borrowerAddress && (
                                <div className="text-xs text-gray-400 truncate">{borrower.borrowerAddress}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-700 font-medium text-sm mb-1.5">ग्रुप निवडा</Label>
                    <Select value={groupId} onValueChange={(val) => {
                      setGroupId(val);
                      if (val === "all") {
                        setAccountFrom("");
                        setAccountTo("");
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="सर्व ग्रुप" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">सर्व ग्रुप</SelectItem>
                        {Array.isArray(groups) && groups.map((g: any) => (
                          <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
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

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-gray-700 font-medium text-sm">खाते क्र. पासून — पर्यंत</Label>
                      {groupId === "all" && (
                        <span className="text-xs text-amber-600 font-medium">ग्रुप निवडा</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        placeholder="उदा. 100"
                        value={accountFrom}
                        onChange={(e) => setAccountFrom(e.target.value)}
                        disabled={groupId === "all"}
                        className={`border-gray-300 ${groupId === "all" ? "opacity-50 bg-gray-100 cursor-not-allowed" : ""}`}
                      />
                      <Input
                        type="number"
                        placeholder="उदा. 200"
                        value={accountTo}
                        onChange={(e) => setAccountTo(e.target.value)}
                        disabled={groupId === "all"}
                        className={`border-gray-300 ${groupId === "all" ? "opacity-50 bg-gray-100 cursor-not-allowed" : ""}`}
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
              <div className="flex rounded-lg border border-indigo-300 overflow-hidden">
                <button
                  onClick={() => { setScanMode("camera"); if (scanStatus !== "active" && scanStatus !== "loading") startScanning(); }}
                  className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 text-sm font-bold transition-colors ${scanMode === "camera" ? "bg-indigo-600 text-white" : "bg-white text-indigo-600 hover:bg-indigo-50"}`}
                >
                  <Camera className="h-4 w-4" />
                  Camera / QR
                </button>
                <button
                  onClick={() => { setScanMode("manual"); stopScanner(); setScanStatus("idle"); setTimeout(() => rapidInputRef.current?.focus(), 200); }}
                  className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 text-sm font-bold transition-colors ${scanMode === "manual" ? "bg-indigo-600 text-white" : "bg-white text-indigo-600 hover:bg-indigo-50"}`}
                >
                  <Keyboard className="h-4 w-4" />
                  Manual Input
                </button>
              </div>

              {scanMode === "camera" && (
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
                    {deviceMode && (
                      <div className="rounded-lg border-2 border-green-400 bg-green-50 p-6 text-center space-y-3">
                        <div className="text-3xl">📡</div>
                        <div className="text-base font-bold text-green-700">Device Scanner Active</div>
                        <div className="text-xs text-green-600">Camera बंद — बॅटरी बचत | Device ने scan करा</div>
                        <Button
                          onClick={() => { setDeviceMode(false); deviceModeRef.current = false; startScanning(); }}
                          variant="outline"
                          size="sm"
                          className="text-xs border-green-400 text-green-700 hover:bg-green-100"
                        >
                          Camera पुन्हा सुरू करा
                        </Button>
                      </div>
                    )}
                    <div
                      id={containerId}
                      style={{ width: '100%', height: deviceMode ? '0px' : '280px', borderRadius: '8px', background: '#111', position: 'relative', overflow: 'hidden', transition: 'height 0.3s' }}
                    />

                    <input
                      ref={deviceInputRef}
                      type="text"
                      onKeyDown={handleDeviceScanInput}
                      style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
                      tabIndex={-1}
                      autoComplete="off"
                      aria-label="Scanner device input"
                    />

                    {!deviceMode && scanStatus === "loading" && (
                      <div className="text-center text-sm text-gray-500 py-1 flex items-center justify-center gap-2">
                        <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-indigo-600 rounded-full animate-spin" />
                        Camera सुरू होत आहे...
                      </div>
                    )}
                    {!deviceMode && scanStatus === "active" && (
                      <div className="text-center text-sm text-indigo-600 font-medium py-1">
                        📷 QR code camera समोर धरा | Scanner device पण चालेल
                      </div>
                    )}
                    {!deviceMode && scanStatus === "error" && (
                      <div className="space-y-2">
                        <div className="text-center text-sm text-red-600 py-1">{scanError}</div>
                        <Button onClick={startScanning} variant="outline" className="w-full text-indigo-600 border-indigo-300">
                          <RotateCcw className="h-4 w-4 mr-1.5" />
                          पुन्हा प्रयत्न करा
                        </Button>
                      </div>
                    )}

                    {!showManualEntry ? (
                      <Button
                        onClick={() => { setShowManualEntry(true); setTimeout(() => manualInputRef.current?.focus(), 100); }}
                        variant="outline"
                        className="w-full border-indigo-300 text-indigo-700 py-3"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        QR खराब? — खाते नंबर टाका
                      </Button>
                    ) : (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                        <div className="text-xs font-medium text-indigo-700">खाते क्रमांक टाका (QR खराब असल्यास)</div>
                        <div className="flex gap-2">
                          <Input
                            ref={manualInputRef}
                            type="text"
                            inputMode="numeric"
                            placeholder="उदा. 55"
                            value={manualAccountNo}
                            onChange={(e) => setManualAccountNo(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleManualAdd(); } }}
                            className="flex-1 text-center text-lg font-bold border-indigo-300"
                          />
                          <Button onClick={handleManualAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4">
                            जोडा
                          </Button>
                          <Button onClick={() => { setShowManualEntry(false); setManualAccountNo(""); }} variant="ghost" size="icon" className="text-gray-500">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {scanMode === "manual" && (
                <Card className="shadow-sm border border-indigo-300">
                  <CardContent className="pt-4 space-y-3">
                    <div className="text-center">
                      <Keyboard className="h-8 w-8 text-indigo-600 mx-auto mb-1" />
                      <div className="text-sm font-bold text-indigo-800">खाते क्रमांक टाइप करा</div>
                      <div className="text-xs text-gray-500 mt-0.5">नंबर टाका → Space / Enter दाबा → auto-add</div>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          ref={rapidInputRef}
                          type="text"
                          inputMode="numeric"
                          placeholder="उदा. 320"
                          value={rapidInput}
                          onChange={(e) => setRapidInput(e.target.value)}
                          onKeyDown={handleRapidKeyDown}
                          className={`text-center text-2xl font-black py-6 border-2 transition-colors ${rapidAddedFlash ? 'border-green-400 bg-green-50' : 'border-indigo-300'}`}
                          autoFocus
                        />
                        {rapidAddedFlash && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-green-600 text-sm font-bold animate-pulse">✓ {rapidAddedFlash} जोडले</span>
                          </div>
                        )}
                      </div>
                      {hasSpeechRecognition && (
                        <Button
                          onClick={isListening ? stopVoice : startVoice}
                          className={`px-4 py-6 ${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
                        >
                          {isListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                        </Button>
                      )}
                    </div>

                    {isListening && (
                      <div className="flex items-center justify-center gap-2 py-2 bg-red-50 border border-red-200 rounded-lg">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium text-red-700">ऐकत आहे... खाते नंबर बोला</span>
                      </div>
                    )}

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>⌨️ <span className="font-medium">Keyboard:</span> नंबर टाका → Space / Enter</div>
                        {hasSpeechRecognition && <div>🎤 <span className="font-medium">Voice:</span> 🎤 दाबा → "तीनशे वीस" बोला</div>}
                        <div>🔁 <span className="font-medium">सतत:</span> एक मागून एक पटापट टाकत जा</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {autoStopFlash ? (
                <div className="rounded-xl p-6 text-center bg-green-100 border-2 border-green-400 animate-pulse">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                  <div className="text-xl font-black text-green-700">सर्व वस्तू सापडल्या!</div>
                  <div className="text-sm text-green-600 mt-1">{scannedCount}/{filteredLoans.length} — अहवाल तयार होत आहे...</div>
                </div>
              ) : (
                <div className={`rounded-xl p-4 text-center transition-colors duration-300 ${duplicateFlash ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-indigo-50 border border-indigo-200'}`}>
                  <div className="text-3xl font-black text-indigo-700">
                    {scannedCount} <span className="text-lg font-medium text-gray-500">/ {filteredLoans.length}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {duplicateFlash ? (
                      <span className="text-yellow-700 font-medium">आधीच scan झाले!</span>
                    ) : scannedCount === filteredLoans.length && filteredLoans.length > 0 ? (
                      <span className="text-green-700 font-bold">सर्व scan पूर्ण!</span>
                    ) : (
                      "scan झाले"
                    )}
                  </div>
                  {filteredLoans.length > 0 && (
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((scannedCount / filteredLoans.length) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {lastScanned && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-green-800 truncate">{lastScanned.borrowerName}</div>
                    <div className="text-xs text-green-600">खाते {lastScanned.accountNumber} • ₹{Number(lastScanned.principalAmount || 0).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              )}

              <Button onClick={handleStopScan} className="w-full bg-red-600 hover:bg-red-700 text-white py-5 font-bold">
                <StopCircle className="h-5 w-5 mr-2" />
                Scan थांबवा — अहवाल पहा
              </Button>
            </>
          )}

          {phase === "report" && (
            <div className="space-y-4 print-section">
              <style>{`
                @media print {
                  body { font-family: 'Noto Sans Devanagari', Arial, sans-serif !important; }
                  body * { visibility: hidden; }
                  .print-section, .print-section * { visibility: visible; }
                  .print-section { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
                  .no-print { display: none !important; }
                }
              `}</style>

              <Card className="shadow-lg border-2 border-indigo-300">
                <CardContent className="pt-5 space-y-4">
                  <h2 className="text-lg font-bold text-indigo-900 text-center">तपासणी अहवाल</h2>
                  <p className="text-xs text-gray-400 text-center">{new Date().toLocaleString('mr-IN')}</p>

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
                          const groupName = Array.isArray(groups) ? groups.find((g: any) => String(g.id) === String(loan.groupId))?.name : "";
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

              <div className="grid grid-cols-2 gap-3 no-print">
                <Button onClick={handlePrint} variant="outline" className="border-indigo-300 text-indigo-700 py-5">
                  <Printer className="h-4 w-4 mr-1.5" />
                  प्रिंट
                </Button>
                <Button onClick={handlePdfDownload} className="bg-indigo-600 hover:bg-indigo-700 text-white py-5">
                  <Download className="h-4 w-4 mr-1.5" />
                  PDF डाउनलोड
                </Button>
              </div>
              <div className="flex gap-3 no-print">
                <Button onClick={() => setPhase("filter")} variant="outline" className="flex-1 border-indigo-300 text-indigo-700">
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  परत Filter
                </Button>
                <Button onClick={startScanning} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                  <ScanLine className="h-4 w-4 mr-1.5" />
                  पुन्हा Scan
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
        </main>
      </div>
    </div>
  );
}
