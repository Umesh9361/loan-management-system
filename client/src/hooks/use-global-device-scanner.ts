import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { decodeQrLoanIds, isCodeQr, extractCode } from "@/lib/qr-utils";

export function useGlobalDeviceScanner(enabled: boolean) {
  const [, setLocation] = useLocation();
  const bufferRef = useRef("");
  const timerRef = useRef<number | null>(null);
  const lastKeyTimeRef = useRef(0);

  const processBuffer = useCallback(async (buffer: string) => {
    const trimmed = buffer.trim();
    if (!trimmed || trimmed.length < 8) return;

    if (isCodeQr(trimmed)) {
      const code = extractCode(trimmed);
      if (!code) return;
      try {
        const res = await fetch(`/api/estimate-code/${code}`);
        const data = await res.json();
        if (res.ok && data.loanIds) {
          let url: string;
          if (data.loanIds.length === 1) {
            url = `/closure?loanId=${data.loanIds[0]}`;
          } else {
            url = `/closure?loanIds=${data.loanIds.join(',')}`;
          }
          if (data.calcSettings) {
            const cs = data.calcSettings;
            if (cs.interestType) url += `&cIT=${cs.interestType}`;
            if (cs.compoundingFrequency) url += `&cCF=${cs.compoundingFrequency}`;
            if (cs.advancedCalculationMode) url += `&cACM=${cs.advancedCalculationMode}`;
            if (cs.useCustomRate && cs.customInterestRate) url += `&cCR=${cs.customInterestRate}`;
          }
          setLocation(url);
        }
      } catch {}
      return;
    }

    const loanIds = decodeQrLoanIds(trimmed);
    if (loanIds && loanIds.length > 0) {
      if (loanIds.length === 1) {
        setLocation(`/closure?loanId=${loanIds[0]}`);
      } else {
        setLocation(`/closure?loanIds=${loanIds.join(',')}`);
      }
    }
  }, [setLocation]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select";
      const isContentEditable = document.activeElement?.getAttribute("contenteditable") === "true";

      if (isInput || isContentEditable) return;

      const now = Date.now();

      if (e.key === "Enter") {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        const buf = bufferRef.current;
        bufferRef.current = "";
        if (buf.length >= 8) {
          e.preventDefault();
          e.stopPropagation();
          processBuffer(buf);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const gap = now - lastKeyTimeRef.current;
        if (gap > 200 && bufferRef.current.length > 0) {
          bufferRef.current = "";
        }

        bufferRef.current += e.key;
        lastKeyTimeRef.current = now;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          bufferRef.current = "";
          timerRef.current = null;
        }, 300);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, processBuffer]);
}
