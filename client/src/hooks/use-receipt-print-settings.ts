import { useCallback, useSyncExternalStore } from "react";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_RECEIPT_SETTINGS, receiptSettingsStore, type ReceiptPrintSettings } from "@/lib/receipt-print-settings";

export function useReceiptPrintSettings() {
  const { toast } = useToast();
  const receiptSettings = useSyncExternalStore(receiptSettingsStore.subscribe, receiptSettingsStore.getSnapshot, () => DEFAULT_RECEIPT_SETTINGS);
  const updateReceiptSettings = useCallback((updater: (previous: ReceiptPrintSettings) => ReceiptPrintSettings) => {
    try { receiptSettingsStore.update(updater); }
    catch { toast({ title: "सेटिंग जतन झाली नाही", description: "ब्राउझर स्टोरेज उपलब्ध आहे का तपासा. पुन्हा प्रयत्न करा.", variant: "destructive" }); }
  }, [toast]);
  const resetReceiptSettings = useCallback(() => {
    try { receiptSettingsStore.reset(); }
    catch { toast({ title: "डिफॉल्ट सेटिंग लागू झाली नाही", description: "ब्राउझर स्टोरेज तपासा.", variant: "destructive" }); }
  }, [toast]);
  return { receiptSettings, updateReceiptSettings, resetReceiptSettings };
}
