import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode } from "lucide-react";

interface QrScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QrScannerModal({ open, onOpenChange }: QrScannerModalProps) {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "scanning" | "found" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef<any>(null);
  const containerId = "qr-scanner-container";

  const stopScanner = () => {
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
  };

  useEffect(() => {
    if (!open) {
      stopScanner();
      setStatus("loading");
      setErrorMsg("");
      return;
    }

    let mounted = true;
    setStatus("loading");

    const startScanner = async () => {
      // Wait for Dialog animation + DOM render to complete
      await new Promise(resolve => setTimeout(resolve, 350));
      if (!mounted) return;

      // Verify container exists in DOM
      const containerEl = document.getElementById(containerId);
      if (!containerEl) {
        if (mounted) {
          setErrorMsg("Camera container तयार नाही — पुन्हा प्रयत्न करा");
          setStatus("error");
        }
        return;
      }

      // Clear any leftover html from previous scan
      containerEl.innerHTML = "";

      try {
        const { Html5Qrcode } = await import(/* @vite-ignore */ "html5-qrcode");
        if (!mounted) return;

        const scanner = new Html5Qrcode(containerId, { verbose: false } as any);
        scannerRef.current = scanner;

        const containerW = containerEl.offsetWidth || 280;
        const boxSize = Math.min(containerW - 40, 220);

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: boxSize, height: boxSize },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            if (!mounted) return;
            try {
              const url = new URL(decodedText);
              const match = url.pathname.match(/^\/qr\/([a-zA-Z0-9\-]+)$/);
              if (match) {
                const loanId = match[1];
                setStatus("found");
                stopScanner();
                setTimeout(() => {
                  onOpenChange(false);
                  setLocation(`/closure?loanId=${loanId}`);
                }, 600);
              } else {
                setErrorMsg("हे आपल्या app चे QR नाही");
                setStatus("error");
              }
            } catch {
              setErrorMsg("QR code ओळखता आला नाही");
              setStatus("error");
            }
          },
          () => {}
        );
        if (mounted) setStatus("scanning");
      } catch (err: any) {
        if (!mounted) return;
        const msg = err?.message || "";
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("notallowed")) {
          setErrorMsg("Camera परवानगी नाकारली — browser मध्ये camera allow करा");
        } else if (msg.toLowerCase().includes("notfound") || msg.toLowerCase().includes("no camera")) {
          setErrorMsg("Camera सापडला नाही — device ला camera आहे का तपासा");
        } else {
          setErrorMsg("Camera सुरू करताना समस्या झाली");
        }
        setStatus("error");
      }
    };

    startScanner();
    return () => {
      mounted = false;
      stopScanner();
    };
  }, [open]);

  const handleRetry = () => {
    stopScanner();
    setStatus("loading");
    setErrorMsg("");
    // Re-trigger the effect by toggling
    const containerEl = document.getElementById(containerId);
    if (containerEl) containerEl.innerHTML = "";
    setTimeout(async () => {
      const containerEl2 = document.getElementById(containerId);
      if (!containerEl2) return;
      try {
        const { Html5Qrcode } = await import(/* @vite-ignore */ "html5-qrcode");
        const scanner = new Html5Qrcode(containerId, { verbose: false } as any);
        scannerRef.current = scanner;
        const boxSize = Math.min((containerEl2.offsetWidth || 280) - 40, 220);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: boxSize, height: boxSize }, aspectRatio: 1.0 },
          (decodedText: string) => {
            try {
              const url = new URL(decodedText);
              const match = url.pathname.match(/^\/qr\/([a-zA-Z0-9\-]+)$/);
              if (match) {
                setStatus("found");
                stopScanner();
                setTimeout(() => { onOpenChange(false); setLocation(`/closure?loanId=${match[1]}`); }, 600);
              } else {
                setErrorMsg("हे आपल्या app चे QR नाही"); setStatus("error");
              }
            } catch { setErrorMsg("QR code ओळखता आला नाही"); setStatus("error"); }
          },
          () => {}
        );
        setStatus("scanning");
      } catch (err: any) {
        const msg = err?.message || "";
        setErrorMsg(msg.toLowerCase().includes("permission") ? "Camera परवानगी नाकारली" : "Camera सुरू करताना समस्या झाली");
        setStatus("error");
      }
    }, 300);
  };

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
          {/* Camera container — explicit height so video renders properly */}
          <div
            id={containerId}
            style={{ width: '100%', height: '280px', borderRadius: '8px', overflow: 'hidden', background: '#111', position: 'relative' }}
          />

          {status === "loading" && (
            <div className="text-center text-sm text-gray-500 py-1 flex items-center justify-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-indigo-600 rounded-full animate-spin" />
              Camera सुरू होत आहे...
            </div>
          )}
          {status === "scanning" && (
            <div className="text-center text-sm text-indigo-600 font-medium py-1">
              📷 लेबल वरील QR code camera समोर धरा
            </div>
          )}
          {status === "found" && (
            <div className="text-center text-sm text-green-600 font-semibold py-1">
              ✓ कर्ज सापडले! उघडत आहे...
            </div>
          )}
          {status === "error" && (
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
