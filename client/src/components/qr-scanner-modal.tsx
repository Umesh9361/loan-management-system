import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, X } from "lucide-react";

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
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
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
        if (mounted) {
          setErrorMsg(err?.message?.includes("permission") || err?.message?.includes("Permission")
            ? "Camera परवानगी नाकारली — browser settings मध्ये camera allow करा"
            : "Camera सुरू करताना समस्या झाली");
          setStatus("error");
        }
      }
    };

    startScanner();
    return () => { mounted = false; stopScanner(); };
  }, [open]);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {}).finally(() => {
        try { scannerRef.current?.clear(); } catch {}
        scannerRef.current = null;
      });
    }
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

        <div className="p-4 space-y-3">
          <div
            id={containerId}
            className="w-full rounded-lg overflow-hidden bg-gray-900"
            style={{ minHeight: "260px" }}
          />

          {status === "loading" && (
            <div className="text-center text-sm text-gray-500 py-2">Camera सुरू होत आहे...</div>
          )}
          {status === "scanning" && (
            <div className="text-center text-sm text-indigo-600 font-medium py-1">
              लेबल वरील QR code camera समोर धरा
            </div>
          )}
          {status === "found" && (
            <div className="text-center text-sm text-green-600 font-semibold py-1 flex items-center justify-center gap-2">
              <span>✓</span> कर्ज सापडले! उघडत आहे...
            </div>
          )}
          {status === "error" && (
            <div className="space-y-2">
              <div className="text-center text-sm text-red-600 py-1">{errorMsg}</div>
              <button
                onClick={() => { setStatus("loading"); setErrorMsg(""); stopScanner(); setTimeout(() => { if (open) setStatus("loading"); }, 100); }}
                className="w-full py-1.5 text-sm text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50"
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
