import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Package, Printer, Calendar, Loader2, Settings, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Scale, Hash } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  LabelLoan, LabelSettings, DEFAULT_SETTINGS, FONT_OPTIONS, STICKER_PRESETS,
  generatePacketLabelHtml, generatePacketPrintPage
} from "./label-print-dialog";

interface PacketLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STORAGE_KEY = "label_print_settings_v2";

export function PacketLabelDialog({ open, onOpenChange }: PacketLabelDialogProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<LabelSettings>({
    ...DEFAULT_SETTINGS,
    printMode: 'packet',
    packetFields: { showCount: true, showWeight: true, showAmount: false },
  });
  const [dbLoaded, setDbLoaded] = useState(false);

  const { data: dbSettings } = useQuery<any>({
    queryKey: ['/api/label-settings'],
    enabled: open,
  });

  useEffect(() => {
    if (dbSettings && !dbLoaded) {
      try {
        const parsed = typeof dbSettings === 'string' ? JSON.parse(dbSettings) : dbSettings;
        if (parsed && parsed.stickerSize && parsed.margins) {
          setSettings(prev => ({
            ...prev,
            stickerSize: {
              width: typeof parsed.stickerSize.width === 'number' && parsed.stickerSize.width > 0 ? parsed.stickerSize.width : 50,
              height: typeof parsed.stickerSize.height === 'number' && parsed.stickerSize.height > 0 ? parsed.stickerSize.height : 25,
              preset: typeof parsed.stickerSize.preset === 'string' ? parsed.stickerSize.preset : '50 x 25 mm',
            },
            margins: {
              top: typeof parsed.margins?.top === 'number' ? parsed.margins.top : 1.5,
              bottom: typeof parsed.margins?.bottom === 'number' ? parsed.margins.bottom : 1,
              left: typeof parsed.margins?.left === 'number' ? parsed.margins.left : 2,
              right: typeof parsed.margins?.right === 'number' ? parsed.margins.right : 2,
            },
            horizontalOffset: typeof parsed.horizontalOffset === 'number' ? parsed.horizontalOffset : 0,
            fontFamily: typeof parsed.fontFamily === 'string' ? parsed.fontFamily : 'Noto Sans Devanagari',
            packetFields: parsed.packetFields && typeof parsed.packetFields === 'object'
              ? {
                  showCount: typeof parsed.packetFields.showCount === 'boolean' ? parsed.packetFields.showCount : true,
                  showWeight: typeof parsed.packetFields.showWeight === 'boolean' ? parsed.packetFields.showWeight : true,
                  showAmount: typeof parsed.packetFields.showAmount === 'boolean' ? parsed.packetFields.showAmount : false,
                }
              : { showCount: true, showWeight: true, showAmount: false },
          }));
          setDbLoaded(true);
        }
      } catch { }
    }
  }, [dbSettings, dbLoaded]);

  useEffect(() => {
    if (!open) {
      setDbLoaded(false);
    }
  }, [open]);

  const fetchEnabled = open && dateFrom.length > 0 && dateTo.length > 0;
  const { data: fetchedLoans, isLoading: loansLoading, error: loansError } = useQuery<LabelLoan[]>({
    queryKey: ['/api/loans/by-date-range', dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/loans/by-date-range?from=${dateFrom}&to=${dateTo}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: fetchEnabled,
  });

  const loans = fetchedLoans || [];

  const summary = useMemo(() => {
    if (loans.length === 0) return null;
    const sorted = [...loans].sort((a, b) => {
      const na = parseInt(String(a.accountNumber)) || 0;
      const nb = parseInt(String(b.accountNumber)) || 0;
      return na - nb;
    });
    const minAcct = sorted[0]?.accountNumber || '';
    const maxAcct = sorted[sorted.length - 1]?.accountNumber || '';
    const totalWeight = sorted.reduce((sum, l) => sum + (parseFloat(String(l.weight || '0')) || 0), 0);
    return {
      count: sorted.length,
      minAcct,
      maxAcct,
      acctRange: minAcct === maxAcct ? minAcct : `${minAcct} — ${maxAcct}`,
      totalWeight: totalWeight.toFixed(2),
    };
  }, [loans]);

  const previewHtml = useMemo(() => {
    if (loans.length === 0) return '';
    const packetSettings: LabelSettings = {
      ...settings,
      printMode: 'packet',
    };
    return generatePacketLabelHtml(loans, packetSettings);
  }, [loans, settings]);

  const previewScale = useMemo(() => {
    const maxPreviewW = 200;
    const realWPx = settings.stickerSize.width * 3.78;
    return Math.min(1, maxPreviewW / realWPx);
  }, [settings.stickerSize.width]);

  const handlePrint = useCallback(() => {
    if (loans.length === 0) return;
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) {
      alert("पॉप-अप ब्लॉक झाले. कृपया ब्राउझर सेटिंग्ज मध्ये पॉप-अप अनुमती द्या.");
      return;
    }
    const packetSettings: LabelSettings = {
      ...settings,
      printMode: 'packet',
    };
    printWindow.document.write(generatePacketPrintPage(loans, packetSettings));
    printWindow.document.close();
  }, [loans, settings]);

  const updateSettings = useCallback((fn: (prev: LabelSettings) => LabelSettings) => {
    setSettings(fn);
  }, []);

  const fmtDateDisplay = (isoDate: string) => {
    if (!isoDate) return '';
    try {
      const [y, m, d] = isoDate.split('-');
      return `${d}/${m}/${y}`;
    } catch { return isoDate; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-amber-800 flex items-center gap-2">
            <Package className="h-5 w-5" />
            पॅकेट लेबल प्रिंट
          </DialogTitle>
          <DialogDescription className="text-xs text-amber-600">
            तारीख श्रेणी निवडा — त्या कालावधीतील सर्व खात्यांचे एक summary स्टिकर प्रिंट होईल
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-amber-700 flex items-center gap-1 mb-1">
                  <Calendar className="h-3 w-3" />
                  तारखेपासून
                </Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 text-sm border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-amber-700 flex items-center gap-1 mb-1">
                  <Calendar className="h-3 w-3" />
                  तारखेपर्यंत
                </Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 text-sm border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                />
              </div>
            </div>

            {dateFrom && dateTo && (
              <div className="pt-1">
                {loansLoading && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    शोधत आहे...
                  </div>
                )}
                {!loansLoading && loansError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    कर्जे शोधताना त्रुटी आली
                  </div>
                )}
                {!loansLoading && !loansError && loans.length === 0 && (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    या तारीख श्रेणीत कोणतेही सक्रिय खाते सापडले नाही
                  </div>
                )}
                {!loansLoading && summary && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      {summary.count} खाती सापडली
                      <span className="text-green-600 font-bold ml-1">({summary.acctRange})</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-green-600 pl-6">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {fmtDateDisplay(dateFrom)} — {fmtDateDisplay(dateTo)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Scale className="h-3 w-3" />
                        {summary.totalWeight}g
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {summary && (
            <>
              <div className="flex items-center gap-4 px-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={settings.packetFields?.showCount ?? true}
                    onCheckedChange={(v) => updateSettings(prev => ({
                      ...prev,
                      packetFields: { ...prev.packetFields || { showCount: true, showWeight: true, showAmount: false }, showCount: v }
                    }))}
                    className="scale-90"
                  />
                  <Hash className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-amber-800 font-medium">वस्तू संख्या</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={settings.packetFields?.showWeight ?? true}
                    onCheckedChange={(v) => updateSettings(prev => ({
                      ...prev,
                      packetFields: { ...prev.packetFields || { showCount: true, showWeight: true, showAmount: false }, showWeight: v }
                    }))}
                    className="scale-90"
                  />
                  <Scale className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-amber-800 font-medium">एकूण वजन</span>
                </label>
              </div>

              <div className="flex justify-center">
                <div
                  className="border-2 border-dashed border-amber-300 rounded-lg bg-white p-2 flex items-center justify-center"
                  style={{ minWidth: '180px', minHeight: '80px' }}
                >
                  {previewHtml && (
                    <div
                      style={{
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'center center',
                      }}
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  )}
                </div>
              </div>
            </>
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              स्टिकर सेटिंग्ज
            </span>
            {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showSettings && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3">
              <div>
                <Label className="text-[11px] font-medium text-gray-600 mb-1 block">स्टिकर आकार</Label>
                <div className="flex flex-wrap gap-1">
                  {STICKER_PRESETS.map(preset => {
                    const active = settings.stickerSize.width === preset.width && settings.stickerSize.height === preset.height;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => updateSettings(prev => ({
                          ...prev,
                          stickerSize: { width: preset.width, height: preset.height, preset: preset.label },
                        }))}
                        style={{
                          padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 600,
                          background: active ? '#d97706' : '#f3f4f6',
                          color: active ? '#fff' : '#4b5563',
                          border: active ? 'none' : '1px solid #e5e7eb',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-medium text-gray-600 mb-1 block">फॉन्ट</Label>
                <div className="flex flex-wrap gap-1">
                  {FONT_OPTIONS.map(opt => {
                    const active = (settings.fontFamily || 'Noto Sans Devanagari') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateSettings(prev => ({ ...prev, fontFamily: opt.value }))}
                        style={{
                          padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 600,
                          background: active ? '#d97706' : '#f3f4f6',
                          color: active ? '#fff' : '#4b5563',
                          border: active ? 'none' : '1px solid #e5e7eb',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-gray-500">मार्जिन (mm): वर/खाली/डावे/उजवे</Label>
                  <div className="flex gap-1 mt-1">
                    {(['top', 'bottom', 'left', 'right'] as const).map(side => (
                      <Input
                        key={side}
                        type="number"
                        step="0.5"
                        min="0"
                        max="20"
                        value={settings.margins[side]}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          updateSettings(prev => ({ ...prev, margins: { ...prev.margins, [side]: v } }));
                        }}
                        className="h-7 text-[10px] text-center w-12 px-1"
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500">प्रिंट शिफ्ट (mm)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={settings.horizontalOffset}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      updateSettings(prev => ({ ...prev, horizontalOffset: v }));
                    }}
                    className="h-7 text-[10px] text-center w-20 mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handlePrint}
            disabled={loans.length === 0 || loansLoading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold h-11 text-sm"
          >
            {loansLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            {loans.length > 0
              ? `पॅकेट लेबल प्रिंट (${summary?.acctRange})`
              : 'तारीख श्रेणी निवडा'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
