import React from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReportPrintAction = "pdf" | "print" | null;

type Props = {
  pending: ReportPrintAction;
  disabled?: boolean;
  onPdf: () => void;
  onPrint: () => void;
  className?: string;
};

/** Equal mobile targets, with progress shown only on the action being performed. */
export function ReportPrintActions({ pending, disabled, onPdf, onPrint, className }: Props) {
  const buttonClass = "h-12 w-full min-w-0 gap-1 whitespace-normal px-2 text-xs leading-4 sm:text-sm";
  return (
    <div className={cn("grid w-full min-w-0 grid-cols-2 gap-2 sm:w-auto sm:min-w-[300px]", className)}>
      <Button variant="outline" onClick={onPdf} disabled={disabled || pending !== null}
        aria-busy={pending === "pdf"} data-report-action="pdf"
        className={cn(buttonClass, "border-indigo-200 text-indigo-700 hover:bg-indigo-50")}>
        {pending === "pdf" ? <Loader2 className="animate-spin" /> : <Download />}
        <span>{pending === "pdf" ? "PDF तयार होत आहे…" : "PDF डाउनलोड"}</span>
      </Button>
      <Button onClick={onPrint} disabled={disabled || pending !== null}
        aria-busy={pending === "print"} data-report-action="print"
        className={cn(buttonClass, "bg-indigo-600 text-white hover:bg-indigo-700")}>
        {pending === "print" ? <Loader2 className="animate-spin" /> : <Printer />}
        <span>{pending === "print" ? "प्रिंट तयार होत आहे…" : "प्रिंट करा"}</span>
      </Button>
    </div>
  );
}
