import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Printer, Settings, ChevronDown, ChevronUp, Minus, Plus, Eye, ArrowUp, ArrowDown, Bold, Type, Trash2, PlusCircle, RotateCcw, Ruler, Loader2 } from "lucide-react";
import { LoanCalculations } from "@/lib/calculations";
import { DateUtils } from "@/lib/date-utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface LabelLoan {
  id: number | string;
  accountNumber: string;
  principalAmount: string | number;
  groupName?: string;
  borrowerName: string;
  collateralDetails?: string;
  weight?: string;
  loanDate: string;
  interestRate?: string | number;
  interestRateType?: string;
  maturityDate?: string;
  loanType?: string;
  businessType?: string;
  borrowerMobile?: string;
  borrowerAddress?: string;
  marketValue?: string | number;
  documentDetails?: string;
  specialConditions?: string;
}

interface MarginSettings {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface LabelField {
  id: string;
  label: string;
  enabled: boolean;
  fontSize: number;
  bold: boolean;
  type: 'data' | 'pair' | 'custom';
  customText?: string;
  hasOvalBorder?: boolean;
  pairedWith?: string;
  displayMode?: 'groupBorrower' | 'groupOnly' | 'borrowerOnly';
}

interface StickerSize {
  width: number;
  height: number;
  preset: string;
}

interface LabelSettings {
  stickerSize: StickerSize;
  margins: MarginSettings;
  fields: LabelField[];
}

interface LabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loans: LabelLoan[];
}

const STICKER_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "50 x 25 mm", width: 50, height: 25 },
  { label: "50 x 30 mm", width: 50, height: 30 },
  { label: "38 x 25 mm", width: 38, height: 25 },
  { label: "75 x 50 mm", width: 75, height: 50 },
  { label: "100 x 50 mm", width: 100, height: 50 },
];

const EXTRA_LOAN_FIELDS: { id: string; label: string; fontSize: number }[] = [
  { id: 'interestRate', label: 'व्याजदर', fontSize: 7.5 },
  { id: 'maturityDate', label: 'मुदत तारीख', fontSize: 7 },
  { id: 'loanType', label: 'कर्ज प्रकार', fontSize: 6.5 },
  { id: 'businessType', label: 'व्यवसाय प्रकार', fontSize: 6.5 },
  { id: 'borrowerMobile', label: 'मोबाईल', fontSize: 6.5 },
  { id: 'borrowerAddress', label: 'पत्ता', fontSize: 6 },
  { id: 'marketValue', label: 'बाजार मूल्य', fontSize: 7 },
  { id: 'documentDetails', label: 'कागदपत्र', fontSize: 6 },
  { id: 'specialConditions', label: 'विशेष शर्ती', fontSize: 6 },
];

const DEFAULT_FIELDS: LabelField[] = [
  { id: 'accountNumber', label: 'खाते नंबर', enabled: true, fontSize: 11, bold: true, type: 'pair', hasOvalBorder: true, pairedWith: 'amount' },
  { id: 'amount', label: 'रक्कम', enabled: true, fontSize: 10, bold: true, type: 'pair', pairedWith: 'accountNumber' },
  { id: 'groupBorrower', label: 'ग्रुप (नाव)', enabled: true, fontSize: 8, bold: false, type: 'data', displayMode: 'groupBorrower' },
  { id: 'details', label: 'तपशील', enabled: true, fontSize: 6.5, bold: false, type: 'data' },
  { id: 'interestRate', label: 'व्याजदर', enabled: true, fontSize: 7.5, bold: true, type: 'data' },
  { id: 'weight', label: 'वजन', enabled: true, fontSize: 7.5, bold: true, type: 'pair', pairedWith: 'date' },
  { id: 'date', label: 'तारीख', enabled: true, fontSize: 10, bold: true, type: 'pair', pairedWith: 'weight' },
];

const DEFAULT_SETTINGS: LabelSettings = {
  stickerSize: { width: 50, height: 25, preset: "50 x 25 mm" },
  margins: { top: 1.5, bottom: 1, left: 2, right: 2 },
  fields: DEFAULT_FIELDS,
};

const STORAGE_KEY = "label_print_settings_v2";

const DISPLAY_MODE_LABELS: Record<string, string> = {
  'groupBorrower': 'ग्रुप (नाव)',
  'groupOnly': 'फक्त ग्रुप',
  'borrowerOnly': 'फक्त नाव',
};

function validateField(f: any): LabelField | null {
  if (!f || typeof f.id !== 'string' || typeof f.label !== 'string') return null;
  const displayMode = ['groupBorrower', 'groupOnly', 'borrowerOnly'].includes(f.displayMode) ? f.displayMode : (f.id === 'groupBorrower' ? 'groupBorrower' : undefined);
  const label = (f.id === 'groupBorrower' && displayMode) ? DISPLAY_MODE_LABELS[displayMode] : f.label;
  return {
    id: f.id,
    label,
    enabled: typeof f.enabled === 'boolean' ? f.enabled : true,
    fontSize: typeof f.fontSize === 'number' && f.fontSize >= 4 && f.fontSize <= 24 ? f.fontSize : 8,
    bold: typeof f.bold === 'boolean' ? f.bold : false,
    type: ['data', 'pair', 'custom'].includes(f.type) ? f.type : 'data',
    customText: typeof f.customText === 'string' ? f.customText : undefined,
    hasOvalBorder: typeof f.hasOvalBorder === 'boolean' ? f.hasOvalBorder : false,
    pairedWith: typeof f.pairedWith === 'string' ? f.pairedWith : undefined,
    displayMode,
  };
}

function loadSettings(): LabelSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.stickerSize && parsed.margins && parsed.fields && Array.isArray(parsed.fields)) {
        const validFields = parsed.fields.map(validateField).filter(Boolean) as LabelField[];
        if (validFields.length === 0) throw new Error("no valid fields");
        const existingIds = new Set(validFields.map(f => f.id));
        DEFAULT_FIELDS.forEach(df => {
          if (!existingIds.has(df.id)) {
            const weightIdx = validFields.findIndex(f => f.id === 'weight');
            if (weightIdx >= 0) {
              validFields.splice(weightIdx, 0, { ...df });
            } else {
              const dateIdx = validFields.findIndex(f => f.id === 'date');
              if (dateIdx >= 0) {
                validFields.splice(dateIdx, 0, { ...df });
              } else {
                validFields.push({ ...df });
              }
            }
          }
        });
        return {
          stickerSize: {
            width: typeof parsed.stickerSize.width === 'number' && parsed.stickerSize.width > 0 ? parsed.stickerSize.width : 50,
            height: typeof parsed.stickerSize.height === 'number' && parsed.stickerSize.height > 0 ? parsed.stickerSize.height : 25,
            preset: typeof parsed.stickerSize.preset === 'string' ? parsed.stickerSize.preset : '50 x 25 mm',
          },
          margins: {
            top: typeof parsed.margins.top === 'number' ? Math.max(0, Math.min(10, parsed.margins.top)) : 1,
            bottom: typeof parsed.margins.bottom === 'number' ? Math.max(0, Math.min(10, parsed.margins.bottom)) : 1,
            left: typeof parsed.margins.left === 'number' ? Math.max(0, Math.min(10, parsed.margins.left)) : 1,
            right: typeof parsed.margins.right === 'number' ? Math.max(0, Math.min(10, parsed.margins.right)) : 1,
          },
          fields: validFields,
        };
      }
    }
  } catch {}
  return { ...DEFAULT_SETTINGS, fields: DEFAULT_FIELDS.map(f => ({ ...f })) };
}

function saveSettings(settings: LabelSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

function formatShortDate(isoDate: string): string {
  try {
    const indian = DateUtils.isoToIndianDate(isoDate);
    const parts = indian.split("/");
    if (parts.length === 3) {
      return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
    }
    return indian;
  } catch {
    return isoDate || "";
  }
}

function getFieldValue(fieldId: string, loan: LabelLoan, displayMode?: string): string {
  switch (fieldId) {
    case 'accountNumber': return loan.accountNumber || "";
    case 'amount': return `₹${LoanCalculations.formatAmount(Number(loan.principalAmount))}`;
    case 'groupBorrower': {
      const g = loan.groupName || "";
      const b = loan.borrowerName || "";
      if (displayMode === 'groupOnly') return g;
      if (displayMode === 'borrowerOnly') return b;
      return g ? `${g} (${b})` : b;
    }
    case 'details': return loan.collateralDetails || "";
    case 'weight': return loan.weight ? `वजन: ${loan.weight}` : "";
    case 'date': return formatShortDate(loan.loanDate);
    case 'interestRate': {
      if (!loan.interestRate) return "";
      return String(Number(loan.interestRate));
    }
    case 'maturityDate': return loan.maturityDate ? `मुदत: ${formatShortDate(loan.maturityDate)}` : "";
    case 'loanType': return loan.loanType || "";
    case 'businessType': return loan.businessType || "";
    case 'borrowerMobile': return loan.borrowerMobile || "";
    case 'borrowerAddress': return loan.borrowerAddress || "";
    case 'marketValue': return loan.marketValue ? `बा.मू: ₹${LoanCalculations.formatAmount(Number(loan.marketValue))}` : "";
    case 'documentDetails': return loan.documentDetails || "";
    case 'specialConditions': return loan.specialConditions || "";
    default: return "";
  }
}

function generateLabelHtml(loan: LabelLoan, settings: LabelSettings): string {
  const { stickerSize, margins, fields } = settings;
  const contentWidth = Math.max(5, stickerSize.width - margins.left - margins.right);
  const contentHeight = Math.max(5, stickerSize.height - margins.top - margins.bottom);
  const safeMarginTop = Math.min(margins.top, stickerSize.height / 2);
  const safeMarginBottom = Math.min(margins.bottom, stickerSize.height / 2);
  const safeMarginLeft = Math.min(margins.left, stickerSize.width / 2);
  const safeMarginRight = Math.min(margins.right, stickerSize.width / 2);

  const enabledFields = fields.filter(f => f.enabled);

  const rendered: string[] = [];
  const processedIds = new Set<string>();

  function renderSingleField(field: LabelField): string {
    const val = field.type === 'custom' ? (field.customText || "") : getFieldValue(field.id, loan, field.displayMode);

    if (field.id === 'details') {
      const detailsText = val;
      const charCount = detailsText.length;
      let fontSize = field.fontSize;
      if (charCount > 60) fontSize = Math.max(4, fontSize - 1.5);
      else if (charCount > 40) fontSize = Math.max(4, fontSize - 1);
      else if (charCount > 25) fontSize = Math.max(4, fontSize - 0.5);
      const lineH = +(fontSize * 1.25).toFixed(1);
      const maxH = +(lineH * 2.1).toFixed(1);
      return `<div style="font-size: ${fontSize}pt; font-weight: ${field.bold ? '800' : '400'}; line-height: ${lineH}pt; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: #444; max-height: ${maxH}pt; width: 100%; flex-shrink: 0; flex-grow: 0; margin-top: -2pt;">${detailsText}</div>`;
    }

    const lineH = +(field.fontSize * 1.3).toFixed(1);
    const fieldMaxH = field.hasOvalBorder ? +(field.fontSize * 1.3 + 4).toFixed(1) : lineH;
    let style = `font-size: ${field.fontSize}pt; font-weight: ${field.bold ? '800' : '400'}; line-height: ${lineH}pt; max-height: ${fieldMaxH}pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; flex-grow: 0; max-width: 100%;`;
    if (field.hasOvalBorder) {
      style += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1.5pt 4pt; letter-spacing: 0.3pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; max-width: 100%; box-sizing: border-box; margin: 0.5pt 0;`;
    }
    if (field.id === 'interestRate') style += ` text-align: center; color: #444;`;
    if (field.id === 'date') style += ` font-family: 'Arial','Helvetica',sans-serif; letter-spacing: 0.3pt;`;
    if (field.id === 'groupBorrower') style += ` margin-top: -1pt;`;
    return `<div style="${style}">${val}</div>`;
  }

  function renderPairRow(leftField: LabelField, rightField: LabelField): string {
    const leftVal = leftField.type === 'custom' ? (leftField.customText || "") : getFieldValue(leftField.id, loan, leftField.displayMode);
    const rightVal = rightField.type === 'custom' ? (rightField.customText || "") : getFieldValue(rightField.id, loan, rightField.displayMode);
    const rowFontSize = Math.max(leftField.fontSize, rightField.fontSize);
    const rowLineH = +(rowFontSize * 1.3).toFixed(1);
    const hasAnyOval = leftField.hasOvalBorder || rightField.hasOvalBorder;
    const pairMaxH = hasAnyOval ? +(rowFontSize * 1.3 + 4).toFixed(1) : rowLineH;
    let leftStyle = `font-size: ${leftField.fontSize}pt; font-weight: ${leftField.bold ? '800' : '400'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%;`;
    let rightStyle = `font-size: ${rightField.fontSize}pt; font-weight: ${rightField.bold ? '800' : '400'}; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%;`;
    if (leftField.hasOvalBorder) leftStyle += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1.5pt 4pt; letter-spacing: 0.3pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; box-sizing: border-box;`;
    if (rightField.hasOvalBorder) rightStyle += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1.5pt 4pt; letter-spacing: 0.3pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; box-sizing: border-box;`;
    if (leftField.id === 'date') leftStyle += ` font-family: 'Arial','Helvetica',sans-serif; letter-spacing: 0.3pt;`;
    if (rightField.id === 'date') rightStyle += ` font-family: 'Arial','Helvetica',sans-serif; letter-spacing: 0.3pt;`;
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:3pt;line-height:${rowLineH}pt;max-height:${pairMaxH}pt;overflow:hidden;flex-shrink:0;flex-grow:0;width:100%;">
      <span style="${leftStyle}">${leftVal}</span>
      <span style="${rightStyle}">${rightVal}</span>
    </div>`;
  }

  function arePairPartners(a: LabelField, b: LabelField): boolean {
    return (a.pairedWith === b.id) || (b.pairedWith === a.id);
  }

  function renderTrioRow(leftField: LabelField, centerField: LabelField, rightField: LabelField): string {
    const leftVal = getFieldValue(leftField.id, loan, leftField.displayMode);
    const centerVal = getFieldValue(centerField.id, loan, centerField.displayMode);
    const rightVal = getFieldValue(rightField.id, loan, rightField.displayMode);
    const rowFontSize = Math.max(leftField.fontSize, centerField.fontSize, rightField.fontSize);
    const rowLineH = +(rowFontSize * 1.3).toFixed(1);
    const hasAnyOval = leftField.hasOvalBorder || centerField.hasOvalBorder || rightField.hasOvalBorder;
    const trioMaxH = hasAnyOval ? +(rowFontSize * 1.3 + 4).toFixed(1) : rowLineH;
    let leftStyle = `font-size: ${leftField.fontSize}pt; font-weight: ${leftField.bold ? '800' : '400'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
    let centerStyle = `font-size: ${centerField.fontSize}pt; font-weight: ${centerField.bold ? '800' : '400'}; white-space: nowrap; text-align: center; color: #444;`;
    let rightStyle = `font-size: ${rightField.fontSize}pt; font-weight: ${rightField.bold ? '800' : '400'}; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
    if (leftField.hasOvalBorder) leftStyle += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1.5pt 4pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; box-sizing: border-box;`;
    if (centerField.hasOvalBorder) centerStyle += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1.5pt 4pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; box-sizing: border-box;`;
    if (rightField.hasOvalBorder) rightStyle += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1.5pt 4pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; box-sizing: border-box;`;
    if (rightField.id === 'date') rightStyle += ` font-family: 'Arial','Helvetica',sans-serif; letter-spacing: 0.3pt;`;
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:3pt;line-height:${rowLineH}pt;max-height:${trioMaxH}pt;overflow:hidden;flex-shrink:0;flex-grow:0;width:100%;">
      <span style="${leftStyle}">${leftVal}</span>
      <span style="${centerStyle}">${centerVal}</span>
      <span style="${rightStyle}">${rightVal}</span>
    </div>`;
  }

  for (let i = 0; i < enabledFields.length; i++) {
    const field = enabledFields[i];
    if (processedIds.has(field.id)) continue;

    const next1 = enabledFields[i + 1];
    const next2 = enabledFields[i + 2];
    if (next1 && next2 && !processedIds.has(next1.id) && !processedIds.has(next2.id)) {
      const ids = new Set([field.id, next1.id, next2.id]);
      if (ids.has('weight') && ids.has('interestRate') && ids.has('date')) {
        const wf = [field, next1, next2].find(f => f.id === 'weight')!;
        const irf = [field, next1, next2].find(f => f.id === 'interestRate')!;
        const df = [field, next1, next2].find(f => f.id === 'date')!;
        processedIds.add(field.id);
        processedIds.add(next1.id);
        processedIds.add(next2.id);
        rendered.push(renderTrioRow(wf, irf, df));
        i += 2;
        continue;
      }
    }

    if (field.type === 'pair' && field.pairedWith) {
      if (next1 && !processedIds.has(next1.id) && arePairPartners(field, next1)) {
        processedIds.add(field.id);
        processedIds.add(next1.id);
        rendered.push(renderPairRow(field, next1));
        i += 1;
      } else {
        processedIds.add(field.id);
        rendered.push(renderSingleField(field));
      }
    } else {
      processedIds.add(field.id);
      rendered.push(renderSingleField(field));
    }
  }

  return `
    <div class="label-container" style="
      width: ${stickerSize.width}mm;
      height: ${stickerSize.height}mm;
      padding: ${safeMarginTop}mm ${safeMarginRight}mm ${safeMarginBottom}mm ${safeMarginLeft}mm;
      box-sizing: border-box;
      page-break-after: always;
      overflow: hidden;
      position: relative;
    ">
      <div style="
        width: ${contentWidth}mm;
        height: ${contentHeight}mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
      ">
        ${rendered.join('\n')}
      </div>
    </div>
  `;
}

function generatePrintPage(labelsHtml: string, settings: LabelSettings): string {
  const { stickerSize } = settings;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>लेबल प्रिंट</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700;800&display=swap" rel="stylesheet">
      <style>
        @page {
          size: ${stickerSize.width}mm ${stickerSize.height}mm;
          margin: 0;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Noto Sans Devanagari', 'Mangal', 'Arial Unicode MS', sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .label-container {
          overflow: hidden;
        }
        .label-container:last-child { page-break-after: avoid; }
        @media print {
          .label-container { page-break-after: always; }
          .label-container:last-child { page-break-after: avoid; }
        }
      </style>
    </head>
    <body>
      ${labelsHtml}
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 500);
        };
      </script>
    </body>
    </html>
  `;
}

interface FieldItemProps {
  field: LabelField;
  idx: number;
  totalFields: number;
  toggleField: (id: string) => void;
  moveField: (id: string, dir: 'up' | 'down') => void;
  adjustFontSize: (id: string, delta: number) => void;
  toggleBold: (id: string) => void;
  toggleOvalBorder: (id: string) => void;
  removeField: (id: string) => void;
  setSettings: (fn: (prev: LabelSettings) => LabelSettings) => void;
}

function FieldItem({ field, idx, totalFields, toggleField, moveField, adjustFontSize, toggleBold, toggleOvalBorder, removeField, setSettings }: FieldItemProps) {
  return (
    <div className={`p-2 rounded-lg border transition-colors ${field.enabled ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-150 opacity-60'}`}>
      <div className="flex items-center gap-1.5">
        <Switch
          checked={field.enabled}
          onCheckedChange={() => toggleField(field.id)}
          className="scale-75 flex-shrink-0"
        />
        <span className="text-xs font-medium text-gray-700 truncate flex-1 min-w-0" title={field.label}>
          {field.label}
          {field.type === 'pair' && field.pairedWith && (
            <span className="text-[9px] text-indigo-400 ml-1">⇔</span>
          )}
        </span>
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            onClick={() => moveField(field.id, 'up')}
            disabled={idx === 0}
            className="p-1 rounded hover:bg-gray-200 active:bg-gray-300 disabled:opacity-30 transition-colors"
            title="वर हलवा"
          >
            <ArrowUp className="h-3 w-3 text-gray-500" />
          </button>
          <button
            onClick={() => moveField(field.id, 'down')}
            disabled={idx === totalFields - 1}
            className="p-1 rounded hover:bg-gray-200 active:bg-gray-300 disabled:opacity-30 transition-colors"
            title="खाली हलवा"
          >
            <ArrowDown className="h-3 w-3 text-gray-500" />
          </button>
          <div className="flex items-center gap-0.5 mx-0.5 bg-gray-100 rounded px-1 py-0.5">
            <button onClick={() => adjustFontSize(field.id, -0.5)} className="p-0.5 rounded hover:bg-gray-200 active:bg-gray-300" title="फॉन्ट कमी">
              <Minus className="h-2.5 w-2.5 text-gray-500" />
            </button>
            <span className="text-[10px] font-mono w-6 text-center text-gray-600">{field.fontSize}</span>
            <button onClick={() => adjustFontSize(field.id, 0.5)} className="p-0.5 rounded hover:bg-gray-200 active:bg-gray-300" title="फॉन्ट वाढवा">
              <Plus className="h-2.5 w-2.5 text-gray-500" />
            </button>
          </div>
          <button
            onClick={() => toggleBold(field.id)}
            className={`p-1 rounded transition-colors ${field.bold ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-200 text-gray-400'}`}
            title="बोल्ड"
          >
            <Bold className="h-3 w-3" />
          </button>
          {field.id === 'accountNumber' && (
            <button
              onClick={() => toggleOvalBorder(field.id)}
              className={`p-1 rounded text-[9px] font-bold transition-colors ${field.hasOvalBorder ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'hover:bg-gray-200 text-gray-400 border border-gray-300'}`}
              title="ओव्हल बॉर्डर"
              style={{ borderRadius: '50px', minWidth: '22px', lineHeight: 1 }}
            >
              O
            </button>
          )}
          {!DEFAULT_FIELDS.some(df => df.id === field.id) && (
            <button
              onClick={() => removeField(field.id)}
              className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors border border-red-200"
              title="काढा"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {field.id === 'groupBorrower' && field.enabled && (
        <div className="flex items-center gap-1.5 mt-1.5 ml-6 flex-wrap">
          <span className="text-[10px] text-gray-500">दाखवा:</span>
          {([
            { mode: 'groupBorrower' as const, label: 'ग्रुप (नाव)' },
            { mode: 'groupOnly' as const, label: 'फक्त ग्रुप' },
            { mode: 'borrowerOnly' as const, label: 'फक्त नाव' },
          ]).map(opt => (
            <button
              key={opt.mode}
              onClick={() => {
                setSettings(prev => ({
                  ...prev,
                  fields: prev.fields.map(f => f.id === 'groupBorrower' ? { ...f, displayMode: opt.mode, label: DISPLAY_MODE_LABELS[opt.mode] } : f)
                }));
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                (field.displayMode || 'groupBorrower') === opt.mode
                  ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LabelPrintDialog({ open, onOpenChange, loans }: LabelPrintDialogProps) {
  const [settings, setSettings] = useState<LabelSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'size' | 'fields' | 'margins'>('fields');
  const [selectedExtraField, setSelectedExtraField] = useState("");
  const [pairWithField, setPairWithField] = useState("");
  const [dbLoaded, setDbLoaded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: dbSettings, isLoading: isLoadingSettings, isFetched } = useQuery({
    queryKey: ['/api/label-settings'],
    enabled: open,
  });

  useEffect(() => {
    if (!isFetched || dbLoaded) return;
    if (dbSettings) {
      try {
        const parsed = typeof dbSettings === 'string' ? JSON.parse(dbSettings) : dbSettings;
        if (parsed && parsed.fields && Array.isArray(parsed.fields)) {
          const validFields = parsed.fields.map(validateField).filter(Boolean) as LabelField[];
          if (validFields.length > 0) {
            const existingIds = new Set(validFields.map((f: LabelField) => f.id));
            DEFAULT_FIELDS.forEach(df => {
              if (!existingIds.has(df.id)) {
                validFields.push({ ...df });
              }
            });
            setSettings({
              stickerSize: parsed.stickerSize || DEFAULT_SETTINGS.stickerSize,
              margins: parsed.margins || DEFAULT_SETTINGS.margins,
              fields: validFields,
            });
          }
        }
      } catch {}
    }
    setDbLoaded(true);
    setIsDirty(false);
  }, [dbSettings, isFetched, dbLoaded]);

  useEffect(() => {
    if (!open) {
      setDbLoaded(false);
      setIsDirty(false);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: LabelSettings) => {
      await apiRequest('PUT', '/api/label-settings', newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/label-settings'] });
    },
  });

  const updateSettings = useCallback((updater: (prev: LabelSettings) => LabelSettings) => {
    setSettings(prev => {
      const next = updater(prev);
      setIsDirty(true);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!dbLoaded || !isDirty) return;
    saveSettings(settings);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMutation.mutate(settings);
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [settings, dbLoaded, isDirty]);

  const updateMargin = useCallback((side: keyof MarginSettings, delta: number) => {
    updateSettings(prev => ({
      ...prev,
      margins: {
        ...prev.margins,
        [side]: Math.max(0, Math.min(10, +(prev.margins[side] + delta).toFixed(1)))
      }
    }));
  }, [updateSettings]);

  const updateStickerSize = useCallback((preset: typeof STICKER_PRESETS[0]) => {
    updateSettings(prev => ({
      ...prev,
      stickerSize: { width: preset.width, height: preset.height, preset: preset.label }
    }));
  }, [updateSettings]);

  const updateCustomSize = useCallback((dim: 'width' | 'height', value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0 && num <= 200) {
      updateSettings(prev => ({
        ...prev,
        stickerSize: { ...prev.stickerSize, [dim]: num, preset: 'custom' }
      }));
    }
  }, [updateSettings]);

  const toggleField = useCallback((fieldId: string) => {
    updateSettings(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === fieldId ? { ...f, enabled: !f.enabled } : f)
    }));
  }, [updateSettings]);

  const toggleBold = useCallback((fieldId: string) => {
    updateSettings(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === fieldId ? { ...f, bold: !f.bold } : f)
    }));
  }, [updateSettings]);

  const adjustFontSize = useCallback((fieldId: string, delta: number) => {
    updateSettings(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === fieldId ? { ...f, fontSize: Math.max(4, Math.min(24, +(f.fontSize + delta).toFixed(1))) } : f)
    }));
  }, [updateSettings]);

  const moveField = useCallback((fieldId: string, direction: 'up' | 'down') => {
    updateSettings(prev => {
      const fields = [...prev.fields];
      const idx = fields.findIndex(f => f.id === fieldId);
      if (idx < 0) return prev;
      if (direction === 'up' && idx > 0) {
        [fields[idx - 1], fields[idx]] = [fields[idx], fields[idx - 1]];
      } else if (direction === 'down' && idx < fields.length - 1) {
        [fields[idx + 1], fields[idx]] = [fields[idx], fields[idx + 1]];
      }
      return { ...prev, fields };
    });
  }, [updateSettings]);

  const availableExtraFields = useMemo(() => {
    const existingIds = new Set(settings.fields.map(f => f.id));
    return EXTRA_LOAN_FIELDS.filter(ef => !existingIds.has(ef.id));
  }, [settings.fields]);

  const addExtraField = useCallback((fieldId: string, pairTargetId: string) => {
    const extra = EXTRA_LOAN_FIELDS.find(ef => ef.id === fieldId);
    if (!extra) return;

    if (pairTargetId) {
      const newField: LabelField = {
        id: extra.id,
        label: extra.label,
        enabled: true,
        fontSize: extra.fontSize,
        bold: false,
        type: 'pair',
        pairedWith: pairTargetId,
      };
      updateSettings(prev => {
        const targetIdx = prev.fields.findIndex(f => f.id === pairTargetId);
        if (targetIdx < 0) return { ...prev, fields: [...prev.fields, newField] };
        const updatedFields = prev.fields.map(f =>
          f.id === pairTargetId ? { ...f, type: 'pair' as const, pairedWith: extra.id } : f
        );
        const insertIdx = targetIdx + 1;
        updatedFields.splice(insertIdx, 0, newField);
        return { ...prev, fields: updatedFields };
      });
    } else {
      const newField: LabelField = {
        id: extra.id,
        label: extra.label,
        enabled: true,
        fontSize: extra.fontSize,
        bold: false,
        type: 'data',
      };
      updateSettings(prev => ({
        ...prev,
        fields: [...prev.fields, newField]
      }));
    }
    setSelectedExtraField("");
    setPairWithField("");
  }, [updateSettings]);

  const removeField = useCallback((fieldId: string) => {
    updateSettings(prev => ({
      ...prev,
      fields: prev.fields
        .filter(f => f.id !== fieldId)
        .map(f => f.pairedWith === fieldId ? { ...f, type: 'data' as const, pairedWith: undefined } : f)
    }));
  }, [updateSettings]);

  const resetToDefaults = useCallback(() => {
    const defaultSettings = { ...DEFAULT_SETTINGS, fields: DEFAULT_FIELDS.map(f => ({ ...f })) };
    updateSettings(() => defaultSettings);
  }, [updateSettings]);

  const toggleOvalBorder = useCallback((fieldId: string) => {
    updateSettings(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === fieldId ? { ...f, hasOvalBorder: !f.hasOvalBorder } : f)
    }));
  }, [updateSettings]);

  const openPrintWindow = useCallback((loansToprint: LabelLoan[]) => {
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) {
      alert("पॉप-अप ब्लॉक झाले. कृपया ब्राउझर सेटिंग्ज मध्ये पॉप-अप अनुमती द्या.");
      return;
    }
    const labelsHtml = loansToprint.map(loan => generateLabelHtml(loan, settings)).join('');
    printWindow.document.write(generatePrintPage(labelsHtml, settings));
    printWindow.document.close();
  }, [settings]);

  const previewScale = useMemo(() => {
    const maxPreviewW = 160;
    const realWPx = settings.stickerSize.width * 3.78;
    return Math.min(0.85, maxPreviewW / realWPx);
  }, [settings.stickerSize.width]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-indigo-800 flex items-center gap-2">
            <Printer className="h-5 w-5" />
            लेबल प्रिंट ({loans.length} लेबल{loans.length > 1 ? "s" : ""})
          </DialogTitle>
          <DialogDescription>
            {settings.stickerSize.width} x {settings.stickerSize.height} mm स्टिकर लेबल
          </DialogDescription>
        </DialogHeader>

        {isLoadingSettings && !dbLoaded && (
          <div className="flex items-center justify-center py-4 gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            सेटिंग्ज लोड होत आहे...
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors w-full justify-between p-2 rounded-lg hover:bg-indigo-50"
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              लेबल सेटिंग्ज
              {saveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />}
              {!saveMutation.isPending && dbLoaded && <span className="text-[10px] text-green-500">✓ सेव्ह</span>}
            </span>
            {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showSettings && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex border-b border-gray-200">
                {([
                  { key: 'size' as const, label: 'साइज', icon: <Ruler className="h-3 w-3" /> },
                  { key: 'fields' as const, label: 'फील्ड्स', icon: <Type className="h-3 w-3" /> },
                  { key: 'margins' as const, label: 'मार्जिन', icon: <Settings className="h-3 w-3" /> },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setSettingsTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                      settingsTab === tab.key
                        ? 'bg-indigo-100 text-indigo-700 border-b-2 border-indigo-600'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-3">
                {settingsTab === 'size' && (
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-gray-700 mb-2">स्टिकर साइज निवडा:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {STICKER_PRESETS.map(preset => (
                        <button
                          key={preset.label}
                          onClick={() => updateStickerSize(preset)}
                          className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                            settings.stickerSize.preset === preset.label
                              ? 'bg-indigo-100 border-indigo-400 text-indigo-700 ring-1 ring-indigo-300'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs font-medium text-gray-600 mb-2">कस्टम साइज (mm):</div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">W:</span>
                          <Input
                            type="number"
                            value={settings.stickerSize.preset === 'custom' ? settings.stickerSize.width : ''}
                            placeholder={String(settings.stickerSize.width)}
                            onChange={(e) => updateCustomSize('width', e.target.value)}
                            className="h-8 w-16 text-xs"
                            min={10}
                            max={200}
                          />
                        </div>
                        <span className="text-gray-400 text-xs">×</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">H:</span>
                          <Input
                            type="number"
                            value={settings.stickerSize.preset === 'custom' ? settings.stickerSize.height : ''}
                            placeholder={String(settings.stickerSize.height)}
                            onChange={(e) => updateCustomSize('height', e.target.value)}
                            className="h-8 w-16 text-xs"
                            min={10}
                            max={200}
                          />
                        </div>
                        <span className="text-xs text-gray-400">mm</span>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'fields' && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-700 mb-1">
                      फील्ड्स (दाखवा/लपवा, क्रम बदला, फॉन्ट):
                    </div>
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                      {settings.fields.map((field, idx) => (
                        <FieldItem
                          key={field.id}
                          field={field}
                          idx={idx}
                          totalFields={settings.fields.length}
                          toggleField={toggleField}
                          moveField={moveField}
                          adjustFontSize={adjustFontSize}
                          toggleBold={toggleBold}
                          toggleOvalBorder={toggleOvalBorder}
                          removeField={removeField}
                          setSettings={updateSettings}
                        />
                      ))}
                    </div>
                    {availableExtraFields.length > 0 && (
                      <div className="pt-2 border-t border-gray-200">
                        <div className="text-xs font-medium text-gray-600 mb-1.5">अतिरिक्त फील्ड जोडा:</div>
                        <div className="space-y-2">
                          <select
                            value={selectedExtraField}
                            onChange={(e) => { setSelectedExtraField(e.target.value); setPairWithField(""); }}
                            className="h-8 text-xs w-full rounded-md border border-gray-300 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            <option value="">-- फील्ड निवडा --</option>
                            {availableExtraFields.map(ef => (
                              <option key={ef.id} value={ef.id}>{ef.label}</option>
                            ))}
                          </select>
                          {selectedExtraField && (
                            <div className="space-y-1.5">
                              <div className="text-[11px] text-gray-500">कुठे ठेवायचं?</div>
                              <select
                                value={pairWithField}
                                onChange={(e) => setPairWithField(e.target.value)}
                                className="h-8 text-xs w-full rounded-md border border-gray-300 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              >
                                <option value="">खाली जोडा (स्वतंत्र ओळ)</option>
                                {settings.fields.filter(f => f.enabled && f.id !== selectedExtraField).map(f => (
                                  <option key={f.id} value={f.id}>{f.label} च्या शेजारी (pair)</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <Button
                            size="sm"
                            onClick={() => addExtraField(selectedExtraField, pairWithField)}
                            disabled={!selectedExtraField}
                            className="h-8 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                          >
                            <PlusCircle className="h-3 w-3 mr-1" />
                            {pairWithField ? 'शेजारी जोडा' : 'खाली जोडा'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {settingsTab === 'margins' && (
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-gray-700 mb-1">मार्जिन (mm):</div>
                    <div className="grid grid-cols-2 gap-3">
                      {(["top", "bottom", "left", "right"] as const).map(side => (
                        <div key={side} className="flex items-center gap-1.5">
                          <Label className="text-xs w-10 text-gray-600">
                            {side === "top" ? "वर" : side === "bottom" ? "खाली" : side === "left" ? "डावी" : "उजवी"}
                          </Label>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateMargin(side, -0.5)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-xs font-mono w-8 text-center font-medium">
                            {settings.margins[side].toFixed(1)}
                          </span>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateMargin(side, 0.5)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 mt-2 border-t border-gray-200 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-gray-500 hover:text-red-600 hover:bg-red-50"
                    onClick={resetToDefaults}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    सर्व डिफॉल्ट रीसेट
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <Eye className="h-3 w-3" />
              पूर्वावलोकन ({settings.stickerSize.width}×{settings.stickerSize.height}mm)
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {loans.slice(0, 4).map((loan, idx) => {
                const realWPx = settings.stickerSize.width * 3.78;
                const realHPx = settings.stickerSize.height * 3.78;
                const previewW = realWPx * previewScale;
                const previewH = realHPx * previewScale;

                return (
                  <div
                    key={loan.id || idx}
                    className="border border-dashed border-gray-300 bg-white rounded shadow-sm"
                    style={{
                      width: `${previewW}px`,
                      height: `${previewH}px`,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${realWPx}px`,
                        height: `${realHPx}px`,
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                        fontFamily: "'Noto Sans Devanagari', 'Mangal', 'Arial Unicode MS', sans-serif",
                      }}
                      dangerouslySetInnerHTML={{
                        __html: generateLabelHtml(loan, settings)
                          .replace(/class="label-container"/, '')
                          .replace(/page-break-after:\s*always;/, '')
                      }}
                    />
                  </div>
                );
              })}
              {loans.length > 4 && (
                <div className="flex items-center justify-center text-xs text-gray-400 font-medium">
                  +{loans.length - 4} आणखी...
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              onClick={() => openPrintWindow(loans)}
              disabled={loans.length === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              <Printer className="mr-2 h-4 w-4" />
              प्रिंट करा ({loans.length})
            </Button>
            {loans.length > 1 && (
              <Button
                onClick={() => { if (loans.length > 0) openPrintWindow([loans[0]]); }}
                variant="outline"
                className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
              >
                <Eye className="mr-2 h-4 w-4" />
                टेस्ट (1)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}