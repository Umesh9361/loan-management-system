import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode } from "lucide-react";

interface QrScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CAMERA_CONFIGS: Array<{ facingMode?: string }> = [
  { facingMode: "environment" },
  { facingMode: "user" },
  {},
];

const CDN_URL = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";

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
      existing.addEventListener("error", () => reject(new Error("CDN script load failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = CDN_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("html5-qrcode CDN लोड होऊ शकला नाही — internet तपासा"));
    document.head.appendChild(script);
  });
  return cdnLoadPromise;
}

export function QrScannerModal({ open, onOpenChange }: QrScannerModalProps) {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "scanning" | "found" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(false);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const [deviceMode, setDeviceMode] = useState(false);
  const deviceKeystrokeTimerRef = useRef<number | null>(null);
  const deviceCharCountRef = useRef(0);
  const containerId = "qr-scanner-container";

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
        setStatus("found");
        stopScanner();
        setTimeout(() => {
          onOpenChange(false);
          setLocation(`/closure?loanId=${match[1]}`);
        }, 600);
      } else {
        setErrorMsg("हे आपल्या app चे QR नाही");
        setStatus("error");
      }
    } catch {
      setErrorMsg("QR code ओळखता आला नाही");
      setStatus("error");
    }
  }, [onOpenChange, setLocation, stopScanner]);

  const handleDeviceScanInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = (e.target as HTMLInputElement).value.trim();
      if (!val) return;
      (e.target as HTMLInputElement).value = '';

      if (!deviceMode && deviceCharCountRef.current >= 8) {
        setDeviceMode(true);
        stopScanner();
      }

      deviceCharCountRef.current = 0;
      if (deviceKeystrokeTimerRef.current) {
        clearTimeout(deviceKeystrokeTimerRef.current);
        deviceKeystrokeTimerRef.current = null;
      }

      onQrDecoded(val);
      return;
    }

    deviceCharCountRef.current++;
    if (deviceKeystrokeTimerRef.current) clearTimeout(deviceKeystrokeTimerRef.current);
    deviceKeystrokeTimerRef.current = window.setTimeout(() => {
      deviceCharCountRef.current = 0;
    }, 300);
  }, [onQrDecoded, deviceMode, stopScanner]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      if (deviceInputRef.current && document.activeElement !== deviceInputRef.current) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          deviceInputRef.current.focus();
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  const tryStartCamera = useCallback(async (scanner: any, boxSize: number): Promise<boolean> => {
    // aspectRatio काढला — Android Chrome वर black screen चे कारण
    const scanConfig = { fps: 10, qrbox: { width: boxSize, height: boxSize } };
    for (const cfg of CAMERA_CONFIGS) {
      if (!mountedRef.current) return false;
      try {
        const cameraId = cfg.facingMode ? { facingMode: cfg.facingMode } : true;
        await scanner.start(cameraId, scanConfig, onQrDecoded, () => {});
        return true;
      } catch (e: any) {
        const msg = (e?.message || e?.name || "").toLowerCase();
        if (msg.includes("permission") || msg.includes("notallowed")) {
          throw e;
        }
      }
    }
    return false;
  }, [onQrDecoded]);

  const initScanner = useCallback(async () => {
    if (!mountedRef.current) return;
    setStatus("loading");
    setErrorMsg("");

    await new Promise(resolve => setTimeout(resolve, 600));
    if (!mountedRef.current) return;

    const containerEl = document.getElementById(containerId);
    if (!containerEl || containerEl.offsetWidth === 0) {
      if (mountedRef.current) {
        setErrorMsg("Camera container तयार नाही — पुन्हा प्रयत्न करा");
        setStatus("error");
      }
      return;
    }

    containerEl.innerHTML = "";

    try {
      await loadHtml5QrcodeCdn();
      if (!mountedRef.current) return;

      const Html5Qrcode = (window as any).Html5Qrcode;
      if (!Html5Qrcode) {
        setErrorMsg("QR library लोड झाली नाही — पुन्हा प्रयत्न करा");
        setStatus("error");
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
        setStatus("scanning");
      } else {
        setErrorMsg("कोणताही camera सापडला नाही — device ला camera आहे का तपासा");
        setStatus("error");
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = err?.message || err?.name || "";
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("notallowed")) {
        setErrorMsg("Camera परवानगी नाकारली — browser settings मध्ये camera allow करा");
      } else if (msg.toLowerCase().includes("notfound") || msg.toLowerCase().includes("no camera")) {
        setErrorMsg("Camera सापडला नाही — device ला camera आहे का तपासा");
      } else {
        setErrorMsg(`Camera समस्या: ${msg || "unknown error"}`);
      }
      setStatus("error");
    }
  }, [stopScanner, tryStartCamera]);

  useEffect(() => {
    if (!open) {
      mountedRef.current = false;
      stopScanner();
      setStatus("loading");
      setErrorMsg("");
      setDeviceMode(false);
      deviceCharCountRef.current = 0;
      return;
    }

    mountedRef.current = true;
    initScanner();

    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [open]);

  const handleRetry = useCallback(() => {
    stopScanner();
    cdnLoadPromise = null;
    const containerEl = document.getElementById(containerId);
    if (containerEl) containerEl.innerHTML = "";
    initScanner();
  }, [stopScanner, initScanner]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stopScanner(); onOpenChange(v); }}>
      <DialogContent className="w-[95vw] max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b bg-indigo-600">
          <DialogTitle className="text-white flex items-center gap-2 text-base">
            <QrCode className="h-5 w-5" />
            QR कोड स्कॅन करा
          </DialogTitle>
        </DialogHeader>

        <div className="p-3 space-y-2">
          <style>{`
            #qr-scanner-container video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
              border-radius: 8px;
            }
            #qr-scanner-container canvas {
              width: 100% !important;
              height: 100% !important;
            }
          `}</style>
          {deviceMode ? (
            <div className="rounded-lg border-2 border-green-400 bg-green-50 p-6 text-center space-y-3">
              <div className="text-3xl">📡</div>
              <div className="text-base font-bold text-green-700">Device Scanner Active</div>
              <div className="text-xs text-green-600">Camera बंद — बॅटरी बचत | Device ने scan करा</div>
              <button
                onClick={() => { setDeviceMode(false); handleRetry(); }}
                className="text-xs border border-green-400 text-green-700 hover:bg-green-100 px-3 py-1 rounded-md"
              >
                Camera पुन्हा सुरू करा
              </button>
            </div>
          ) : (
            <div
              id={containerId}
              style={{ width: '100%', height: '280px', borderRadius: '8px', background: '#111', position: 'relative' }}
            />
          )}

          <input
            ref={deviceInputRef}
            type="text"
            onKeyDown={handleDeviceScanInput}
            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
            tabIndex={-1}
            autoComplete="off"
            aria-label="Scanner device input"
          />

          {!deviceMode && status === "loading" && (
            <div className="text-center text-sm text-gray-500 py-1 flex items-center justify-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-indigo-600 rounded-full animate-spin" />
              Camera सुरू होत आहे...
            </div>
          )}
          {!deviceMode && status === "scanning" && (
            <div className="text-center text-sm text-indigo-600 font-medium py-1">
              📷 QR code camera समोर धरा | Scanner device पण चालेल
            </div>
          )}
          {status === "found" && (
            <div className="text-center text-sm text-green-600 font-semibold py-1">
              ✓ कर्ज सापडले! उघडत आहे...
            </div>
          )}
          {!deviceMode && status === "error" && (
            <div className="space-y-2">
              <div className="text-center text-sm text-red-600 py-1">{errorMsg}</div>
              <button
                onClick={handleRetry}
                className="w-full py-1.5 text-sm text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50 font-medium"
              >
                पुन्हा प्रयत्न करा
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QrScanButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className || "flex items-center justify-center h-9 w-9 rounded-md hover:bg-white/20 transition-colors"}
        title="QR स्कॅन करा"
        aria-label="QR Scanner"
      >
        <QrCode className="h-5 w-5" />
      </button>
      <QrScannerModal open={open} onOpenChange={setOpen} />
    </>
  );
}
