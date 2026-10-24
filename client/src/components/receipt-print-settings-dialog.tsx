import { Bluetooth } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useReceiptPrintSettings } from "@/hooks/use-receipt-print-settings";
import { ReceiptPrintSettingsEditor } from "@/components/receipt-print-settings-editor";

export function ReceiptPrintSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { receiptSettings, updateReceiptSettings, resetReceiptSettings } = useReceiptPrintSettings();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[94vw] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-slate-100 p-4 pr-10 sm:p-5">
          <DialogTitle className="flex items-center gap-2 text-indigo-900"><Bluetooth className="h-5 w-5 shrink-0" />ब्लूटूथ प्रिंट सेटिंग</DialogTitle>
          <DialogDescription className="pt-1 text-xs leading-relaxed">खाते न निवडता पावतीची मांडणी बदला. हेच बदल कर्ज बंद करतानाच्या पावतीला लागू होतील.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5">
          <ReceiptPrintSettingsEditor settings={receiptSettings} onChange={updateReceiptSettings} onReset={resetReceiptSettings} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
