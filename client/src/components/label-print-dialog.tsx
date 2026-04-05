import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Printer, Settings, ChevronDown, ChevronUp, Minus, Plus, Eye, ArrowUp, ArrowDown, Bold, Type, Trash2, PlusCircle, RotateCcw, Ruler, Loader2 } from "lucide-react";
import { LoanCalculations } from "@/lib/calculations";
import { DateUtils } from "@/lib/date-utils";
import { encodeQrData } from "@/lib/qr-utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface LabelLoan {
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

export interface LabelSettings {
  stickerSize: StickerSize;
  margins: MarginSettings;
  fields: LabelField[];
  horizontalOffset: number;
  fontFamily?: string;
  qrMode?: boolean;
  printMode?: 'normal' | 'qrSide' | 'qrCenter' | 'packet';
  packetFields?: {
    showCount: boolean;
    showWeight: boolean;
    showAmount: boolean;
    acctFontSize?: number;
    dateFontSize?: number;
    countFontSize?: number;
    weightFontSize?: number;
  };
  perPacket?: number;
}

export const FONT_OPTIONS = [
  { label: 'Noto Sans (Default)', value: 'Noto Sans Devanagari', url: 'Noto+Sans+Devanagari:wght@400;700;800', preview: 'अ आ क' },
  { label: 'Baloo 2 (आकर्षक ⭐)', value: 'Baloo 2', url: 'Baloo+2:wght@400;600;800', preview: 'अ आ क' },
  { label: 'Laila (Elegant)', value: 'Laila', url: 'Laila:wght@400;600;700', preview: 'अ आ क' },
  { label: 'Hind (Professional)', value: 'Hind', url: 'Hind:wght@400;700', preview: 'अ आ क' },
];

interface LabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loans: LabelLoan[];
}

export const STICKER_PRESETS: { label: string; width: number; height: number }[] = [
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

export const DEFAULT_SETTINGS: LabelSettings = {
  stickerSize: { width: 50, height: 25, preset: "50 x 25 mm" },
  margins: { top: 1.5, bottom: 1, left: 2, right: 2 },
  fields: DEFAULT_FIELDS,
  horizontalOffset: 0,
  fontFamily: 'Noto Sans Devanagari',
  qrMode: false,
  printMode: 'normal',
  packetFields: { showCount: true, showWeight: true, showAmount: true },
  perPacket: 0,
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
          horizontalOffset: typeof parsed.horizontalOffset === 'number' ? Math.max(-10, Math.min(10, parsed.horizontalOffset)) : 0,
          fontFamily: typeof parsed.fontFamily === 'string' && FONT_OPTIONS.some(f => f.value === parsed.fontFamily) ? parsed.fontFamily : 'Noto Sans Devanagari',
          qrMode: false,
          printMode: (['normal','qrSide','qrCenter','packet'] as const).includes(parsed.printMode)
            ? parsed.printMode
            : (parsed.qrMode ? 'qrSide' : 'normal'),
          packetFields: parsed.packetFields && typeof parsed.packetFields === 'object'
            ? {
                showCount: typeof parsed.packetFields.showCount === 'boolean' ? parsed.packetFields.showCount : true,
                showWeight: typeof parsed.packetFields.showWeight === 'boolean' ? parsed.packetFields.showWeight : true,
                showAmount: typeof parsed.packetFields.showAmount === 'boolean' ? parsed.packetFields.showAmount : true,
              }
            : { showCount: true, showWeight: true, showAmount: true },
          perPacket: typeof parsed.perPacket === 'number' && parsed.perPacket >= 0 ? parsed.perPacket : 0,
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
    case 'weight': return loan.weight ? `वजन: ${parseFloat(String(loan.weight)).toFixed(2)}` : "";
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

function ptToMm(pt: number): number {
  return pt * 0.3528;
}

function getFieldHeightMm(field: LabelField, isPaired: boolean, partnerField?: LabelField): number {
  if (field.id === 'details') return 0;
  const fs = isPaired && partnerField ? Math.max(field.fontSize, partnerField.fontSize) : field.fontSize;
  const lineH = fs * 1.4;
  const ptop = fs * 0.12;
  const hasOval = field.hasOvalBorder || (partnerField?.hasOvalBorder);
  const heightPt = hasOval ? lineH + 3 + ptop : lineH + ptop;
  return ptToMm(heightPt);
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
  const gapMm = 0.3;

  const detailsField = enabledFields.find(f => f.id === 'details');
  let fixedHeightMm = 0;
  let renderedRowCount = 0;

  const trioWeight = enabledFields.find(f => f.id === 'weight' && f.enabled);
  const trioRate = enabledFields.find(f => f.id === 'interestRate' && f.enabled);
  const trioDate = enabledFields.find(f => f.id === 'date' && f.enabled);
  const hasTrio = !!(trioWeight && trioRate && trioDate);

  const tempProcessed = new Set<string>();
  if (hasTrio) { ['weight', 'interestRate', 'date'].forEach(id => tempProcessed.add(id)); }

  for (let i = 0; i < enabledFields.length; i++) {
    const field = enabledFields[i];
    if (tempProcessed.has(field.id)) continue;
    if (field.id === 'details') { tempProcessed.add(field.id); continue; }
    const next1 = enabledFields[i + 1];
    if (field.type === 'pair' && field.pairedWith && next1 && !tempProcessed.has(next1.id) &&
        ((field.pairedWith === next1.id) || (next1.pairedWith === field.id))) {
      fixedHeightMm += getFieldHeightMm(field, true, next1);
      tempProcessed.add(field.id);
      tempProcessed.add(next1.id);
      renderedRowCount++;
      i++;
    } else {
      fixedHeightMm += getFieldHeightMm(field, false);
      tempProcessed.add(field.id);
      renderedRowCount++;
    }
  }

  if (hasTrio) {
    const trioFs = Math.max(trioWeight!.fontSize, trioRate!.fontSize, trioDate!.fontSize);
    const trioLineH = trioFs * 1.15;
    const trioHasOval = trioWeight!.hasOvalBorder || trioRate!.hasOvalBorder || trioDate!.hasOvalBorder;
    fixedHeightMm += ptToMm(trioHasOval ? trioLineH + 3 : trioLineH);
    renderedRowCount++;
  }

  const detailsIsRow = detailsField ? 1 : 0;
  const totalRows = renderedRowCount + detailsIsRow;
  const totalGapMm = totalRows > 1 ? (totalRows - 1) * gapMm : 0;
  const availableForDetailsMm = Math.max(0, contentHeight - fixedHeightMm - totalGapMm);

  let dynamicLineClamp = 1;
  if (detailsField && availableForDetailsMm > 0) {
    const detailsLineHPt = detailsField.fontSize * 1.1;
    const detailsLineHMm = ptToMm(detailsLineHPt);
    if (detailsLineHMm > 0) {
      dynamicLineClamp = Math.max(1, Math.floor(availableForDetailsMm / detailsLineHMm));
    }
  }

  const rendered: string[] = [];
  const processedIds = new Set<string>();

  function renderSingleField(field: LabelField, isLastRow: boolean): string {
    const val = field.type === 'custom' ? (field.customText || "") : getFieldValue(field.id, loan, field.displayMode);
    const marginTopAuto = isLastRow ? 'margin-top: auto;' : 'margin: 0;';

    if (field.id === 'details') {
      const fontSize = field.fontSize;
      const lineH = +(fontSize * 1.4).toFixed(1);
      const ptop = +(fontSize * 0.12).toFixed(1);
      return `<div style="font-size: ${fontSize}pt; font-weight: ${field.bold ? '800' : '400'}; line-height: ${lineH}pt; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: ${dynamicLineClamp}; -webkit-box-orient: vertical; color: #444; width: 100%; flex-shrink: 1; flex-grow: 1; ${marginTopAuto} padding-top: ${ptop}pt; padding-bottom: 0; padding-left: 0; padding-right: 0;">${val}</div>`;
    }

    const lineH = +(field.fontSize * 1.4).toFixed(1);
    const ptop = +(field.fontSize * 0.12).toFixed(1);
    const fieldMaxH = field.hasOvalBorder ? +(field.fontSize * 1.4 + 3 + field.fontSize * 0.12).toFixed(1) : +(field.fontSize * 1.4 + field.fontSize * 0.12).toFixed(1);
    let style = `font-size: ${field.fontSize}pt; font-weight: ${field.bold ? '800' : '400'}; line-height: ${lineH}pt; max-height: ${fieldMaxH}pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; flex-grow: 0; max-width: 100%; ${marginTopAuto} padding-top: ${ptop}pt; padding-bottom: 0; padding-left: 0; padding-right: 0;`;
    if (field.hasOvalBorder) {
      style += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1pt 3pt; letter-spacing: 0.3pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; max-width: 100%; box-sizing: border-box;`;
    }
    if (field.id === 'interestRate') style += ` text-align: center; color: #444;`;
    if (field.id === 'date') style += ` font-family: 'Arial','Helvetica',sans-serif; letter-spacing: 0.3pt;`;
    if (['accountNumber','amount','marketValue','interestRate','borrowerMobile'].includes(field.id)) style += ` font-family: 'Arial','Helvetica',sans-serif;`;
    // ₹ symbol always normal weight; number bold per user setting; add space between ₹ and number
    let displayVal = val;
    if (val.includes('₹')) {
      displayVal = val.replace(/₹\s*/g, `<span style="font-weight:400">₹</span>&nbsp;`);
    }
    return `<div style="${style}">${displayVal}</div>`;
  }

  function renderPairRow(leftField: LabelField, rightField: LabelField, isLastRow: boolean): string {
    const leftVal = leftField.type === 'custom' ? (leftField.customText || "") : getFieldValue(leftField.id, loan, leftField.displayMode);
    const rightVal = rightField.type === 'custom' ? (rightField.customText || "") : getFieldValue(rightField.id, loan, rightField.displayMode);
    const rowFontSize = Math.max(leftField.fontSize, rightField.fontSize);
    const rowLineH = +(rowFontSize * 1.4).toFixed(1);
    const rowPtop = +(rowFontSize * 0.12).toFixed(1);
    const hasAnyOval = leftField.hasOvalBorder || rightField.hasOvalBorder;
    const pairMaxH = hasAnyOval ? +(rowFontSize * 1.4 + 3 + rowFontSize * 0.12).toFixed(1) : +(rowFontSize * 1.4 + rowFontSize * 0.12).toFixed(1);
    const marginTopAuto = isLastRow ? 'margin-top:auto;' : 'margin:0;';
    let leftStyle = `font-size: ${leftField.fontSize}pt; font-weight: ${leftField.bold ? '800' : '400'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%;`;
    let rightStyle = `font-size: ${rightField.fontSize}pt; font-weight: ${rightField.bold ? '800' : '400'}; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%;`;
    if (leftField.hasOvalBorder) leftStyle += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1pt 3pt; letter-spacing: 0.3pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; box-sizing: border-box;`;
    if (rightField.hasOvalBorder) rightStyle += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1pt 3pt; letter-spacing: 0.3pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; box-sizing: border-box;`;
    if (leftField.id === 'date') leftStyle += ` font-family: 'Arial','Helvetica',sans-serif; letter-spacing: 0.3pt;`;
    if (rightField.id === 'date') rightStyle += ` font-family: 'Arial','Helvetica',sans-serif; letter-spacing: 0.3pt;`;
    const NUMERIC_FIELDS = ['accountNumber','amount','marketValue','interestRate','borrowerMobile'];
    if (NUMERIC_FIELDS.includes(leftField.id)) leftStyle += ` font-family: 'Arial','Helvetica',sans-serif;`;
    if (NUMERIC_FIELDS.includes(rightField.id)) rightStyle += ` font-family: 'Arial','Helvetica',sans-serif;`;
    // ₹ symbol always normal weight; number bold per user setting; add space between ₹ and number
    const displayLeftVal = leftVal.includes('₹') ? leftVal.replace(/₹\s*/g, `<span style="font-weight:400">₹</span>&nbsp;`) : leftVal;
    const displayRightVal = rightVal.includes('₹') ? rightVal.replace(/₹\s*/g, `<span style="font-weight:400">₹</span>&nbsp;`) : rightVal;
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:1pt;line-height:${rowLineH}pt;max-height:${pairMaxH}pt;overflow:hidden;flex-shrink:0;flex-grow:0;width:100%;${marginTopAuto}padding-top:${rowPtop}pt;padding-bottom:0;padding-left:0;padding-right:0;">
      <span style="${leftStyle}">${displayLeftVal}</span>
      <span style="${rightStyle}">${displayRightVal}</span>
    </div>`;
  }

  function arePairPartners(a: LabelField, b: LabelField): boolean {
    return (a.pairedWith === b.id) || (b.pairedWith === a.id);
  }

  function renderTrioRow(leftField: LabelField, centerField: LabelField, rightField: LabelField, isLastRow: boolean): string {
    const leftVal = getFieldValue(leftField.id, loan, leftField.displayMode);
    const centerVal = getFieldValue(centerField.id, loan, centerField.displayMode);
    const rightVal = getFieldValue(rightField.id, loan, rightField.displayMode);
    const rowFontSize = Math.max(leftField.fontSize, centerField.fontSize, rightField.fontSize);
    const rowLineH = +(rowFontSize * 1.4).toFixed(1);
    const rowPtop = +(rowFontSize * 0.12).toFixed(1);
    const hasAnyOval = leftField.hasOvalBorder || centerField.hasOvalBorder || rightField.hasOvalBorder;
    const trioMaxH = hasAnyOval ? +(rowFontSize * 1.4 + 3 + rowFontSize * 0.12).toFixed(1) : +(rowFontSize * 1.4 + rowFontSize * 0.12).toFixed(1);
    const marginTopAuto = isLastRow ? 'margin-top:auto;' : 'margin:0;';
    let leftStyle = `font-size: ${leftField.fontSize}pt; font-weight: ${leftField.bold ? '800' : '400'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
    let centerStyle = `font-size: ${centerField.fontSize}pt; font-weight: ${centerField.bold ? '800' : '400'}; white-space: nowrap; text-align: center; color: #444;`;
    let rightStyle = `font-size: ${rightField.fontSize}pt; font-weight: ${rightField.bold ? '800' : '400'}; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
    if (leftField.hasOvalBorder) leftStyle += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1pt 3pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; box-sizing: border-box;`;
    if (centerField.hasOvalBorder) centerStyle += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1pt 3pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; box-sizing: border-box;`;
    if (rightField.hasOvalBorder) rightStyle += ` border: 0.6pt solid #333; border-radius: 50px; padding: 1pt 3pt; font-family: 'Arial','Helvetica',sans-serif; display: inline-block; box-sizing: border-box;`;
    if (rightField.id === 'date') rightStyle += ` font-family: 'Arial','Helvetica',sans-serif; letter-spacing: 0.3pt;`;
    const TRIO_NUMERIC = ['accountNumber','amount','marketValue','interestRate','borrowerMobile'];
    if (TRIO_NUMERIC.includes(leftField.id)) leftStyle += ` font-family: 'Arial','Helvetica',sans-serif;`;
    if (TRIO_NUMERIC.includes(centerField.id)) centerStyle += ` font-family: 'Arial','Helvetica',sans-serif;`;
    if (TRIO_NUMERIC.includes(rightField.id)) rightStyle += ` font-family: 'Arial','Helvetica',sans-serif;`;
    const displayTrioLeft = leftVal.includes('₹') ? leftVal.replace(/₹\s*/g, `<span style="font-weight:400">₹</span>&nbsp;`) : leftVal;
    const displayTrioCenter = centerVal.includes('₹') ? centerVal.replace(/₹\s*/g, `<span style="font-weight:400">₹</span>&nbsp;`) : centerVal;
    const displayTrioRight = rightVal.includes('₹') ? rightVal.replace(/₹\s*/g, `<span style="font-weight:400">₹</span>&nbsp;`) : rightVal;
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:1pt;line-height:${rowLineH}pt;max-height:${trioMaxH}pt;overflow:hidden;flex-shrink:0;flex-grow:0;width:100%;${marginTopAuto}padding-top:${rowPtop}pt;padding-bottom:0;padding-left:0;padding-right:0;">
      <span style="${leftStyle}">${displayTrioLeft}</span>
      <span style="${centerStyle}">${displayTrioCenter}</span>
      <span style="${rightStyle}">${displayTrioRight}</span>
    </div>`;
  }

  if (hasTrio) {
    processedIds.add('weight');
    processedIds.add('interestRate');
    processedIds.add('date');
  }

  type RenderPlan = 
    | { type: 'single'; field: LabelField }
    | { type: 'pair'; left: LabelField; right: LabelField };
  const renderPlan: RenderPlan[] = [];

  for (let i = 0; i < enabledFields.length; i++) {
    const field = enabledFields[i];
    if (processedIds.has(field.id)) continue;

    const next1 = enabledFields[i + 1];

    if (field.type === 'pair' && field.pairedWith) {
      if (next1 && !processedIds.has(next1.id) && arePairPartners(field, next1)) {
        processedIds.add(field.id);
        processedIds.add(next1.id);
        renderPlan.push({ type: 'pair', left: field, right: next1 });
        i += 1;
      } else {
        processedIds.add(field.id);
        renderPlan.push({ type: 'single', field });
      }
    } else {
      processedIds.add(field.id);
      renderPlan.push({ type: 'single', field });
    }
  }

  const lastNonTrioIdx = renderPlan.length - 1;
  for (let idx = 0; idx < renderPlan.length; idx++) {
    const isLast = !hasTrio && idx === lastNonTrioIdx;
    const plan = renderPlan[idx];
    if (plan.type === 'pair') {
      rendered.push(renderPairRow(plan.left, plan.right, isLast));
    } else {
      rendered.push(renderSingleField(plan.field, isLast));
    }
  }

  if (hasTrio) {
    rendered.push(renderTrioRow(trioWeight!, trioRate!, trioDate!, true));
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
        justify-content: flex-start;
        gap: 0.3mm;
        overflow: hidden;
      ">
        ${rendered.join('\n')}
      </div>
    </div>
  `;
}

function generatePrintPage(labelsHtml: string, settings: LabelSettings): string {
  const { stickerSize, horizontalOffset } = settings;
  const offsetMm = horizontalOffset || 0;
  const transformStyle = offsetMm !== 0 ? `transform: translateX(${offsetMm}mm);` : '';
  const selectedFont = settings.fontFamily || 'Noto Sans Devanagari';
  const fontOption = FONT_OPTIONS.find(f => f.value === selectedFont) || FONT_OPTIONS[0];
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>लेबल प्रिंट</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=${fontOption.url}&display=swap" rel="stylesheet">
      <style>
        @page {
          size: ${stickerSize.width}mm ${stickerSize.height}mm;
          margin: 0;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: '${selectedFont}', 'Mangal', 'Arial Unicode MS', sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-kerning: normal;
          font-feature-settings: 'kern' 1, 'liga' 1;
        }
        .label-container {
          overflow: hidden;
          image-rendering: -webkit-optimize-contrast;
          ${transformStyle}
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

function generateQrLabelHtml(loan: LabelLoan, qrDataUrl: string, settings: LabelSettings): string {
  const { stickerSize, fontFamily, margins } = settings;
  const totalW = stickerSize.width;
  const totalH = stickerSize.height;
  const mTop = Math.min(margins.top, totalH / 2);
  const mBottom = Math.min(margins.bottom, totalH / 2);
  const mLeft = Math.min(margins.left, totalW / 2);
  const mRight = Math.min(margins.right, totalW / 2);
  const shorterSide = Math.min(totalW, totalH);

  const qrSizeMm = +(shorterSide * 0.68).toFixed(1);
  const qrPx = Math.round(qrSizeMm * 3.78);

  // Read font sizes, bold, oval, enabled from settings.fields — same as regular label
  const gf  = (id: string, fb: number)   => settings.fields.find(f => f.id === id)?.fontSize ?? fb;
  const gb  = (id: string, fb: boolean)  => (settings.fields.find(f => f.id === id)?.bold ?? fb) ? '800' : '600';
  const gov = (id: string)               => settings.fields.find(f => f.id === id)?.hasOvalBorder ?? false;
  const ge  = (id: string)               => settings.fields.find(f => f.id === id)?.enabled ?? true;

  const show_acct = ge('accountNumber');
  const show_amt  = ge('amount');
  const show_date = ge('date');
  const show_grp  = ge('groupBorrower');
  const show_int  = ge('interestRate');
  const show_wt   = ge('weight');

  const f_acct = gf('accountNumber', 11);
  const f_amt  = gf('amount', 10);
  const f_date = gf('date', 10);
  const f_grp  = gf('groupBorrower', 8);
  const f_int  = gf('interestRate', 7.5);
  const f_wt   = gf('weight', 7.5);

  const b_acct = gb('accountNumber', true);
  const b_amt  = gb('amount', true);
  const b_date = gb('date', true);
  const b_grp  = gb('groupBorrower', false);
  const b_int  = gb('interestRate', true);
  const b_wt   = gb('weight', true);

  const acctOval = gov('accountNumber');
  const acctOvalStyle = acctOval
    ? `border:0.6pt solid #333;border-radius:50px;padding:1pt 3pt;letter-spacing:0.3pt;display:inline-block;box-sizing:border-box;`
    : ``;

  const devaFont = `'${fontFamily || 'Noto Sans Devanagari'}','Mangal','Arial Unicode MS',sans-serif`;
  const numFont = `'Arial','Helvetica',sans-serif`;

  const dateStr = loan.loanDate ? (() => {
    try { const p = loan.loanDate.split('T')[0].split('-'); return `${p[2]}/${p[1]}/${p[0]}`; } catch { return loan.loanDate; }
  })() : '';
  const amtNum = (parseInt(String(loan.principalAmount)) || 0).toLocaleString('en-IN');
  const grpDisplayMode = settings.fields.find(f => f.id === 'groupBorrower')?.displayMode ?? 'groupBorrower';
  const groupLine = grpDisplayMode === 'groupOnly'
    ? (loan.groupName || '')
    : grpDisplayMode === 'borrowerOnly'
    ? (loan.borrowerName || '')
    : (loan.groupName ? `${loan.groupName} (${loan.borrowerName})` : (loan.borrowerName || ''));
  const intStr = (show_int && loan.interestRate) ? `${loan.interestRate}` : '';
  const wtStr  = (show_wt  && loan.weight)       ? `${parseFloat(String(loan.weight)).toFixed(2)}g`      : '';
  const hasExtra = !!(intStr || wtStr);
  const showRow1 = show_acct || show_amt;

  // Large amount → moves to 2nd line (no auto-shrink needed)
  const amtIsLong = show_amt && amtNum.length > 7;

  return `
    <div class="label-container" style="width:${totalW}mm;height:${totalH}mm;box-sizing:border-box;page-break-after:always;overflow:hidden;display:flex;flex-direction:row;align-items:stretch;padding:${mTop}mm ${mRight}mm ${mBottom}mm ${mLeft}mm;gap:0;">
      <div style="display:flex;align-items:center;flex-shrink:0;"><img src="${qrDataUrl}" width="${qrPx}" height="${qrPx}" style="width:${qrSizeMm}mm;height:${qrSizeMm}mm;display:block;" /></div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;padding-left:0.8mm;padding-right:0.3mm;border-left:0.3mm solid #ccc;margin-left:0.3mm;overflow:hidden;">
        ${amtIsLong ? `
          <div style="display:flex;flex-direction:column;overflow:hidden;">
            ${show_acct ? `<div style="line-height:1.3;text-align:left;"><span style="font-family:${numFont};font-size:${f_acct}pt;font-weight:${b_acct};white-space:nowrap;line-height:1.3;display:inline-block;${acctOvalStyle}">${loan.accountNumber}</span></div>` : ''}
            ${show_amt  ? `<div style="font-family:${numFont};font-size:${f_amt}pt;font-weight:${b_amt};white-space:nowrap;line-height:1.3;text-align:right;width:100%;">${amtNum}</div>` : ''}
          </div>
        ` : showRow1 ? `<div style="display:flex;justify-content:space-between;align-items:center;overflow:hidden;">
          ${show_acct ? `<span style="font-family:${numFont};font-size:${f_acct}pt;font-weight:${b_acct};white-space:nowrap;line-height:1.3;flex-shrink:0;${acctOvalStyle}">${loan.accountNumber}</span>` : ''}
          ${show_amt  ? `<span style="font-family:${numFont};font-size:${f_amt}pt;font-weight:${b_amt};white-space:nowrap;flex-shrink:0;margin-left:0.8mm;">${amtNum}</span>` : ''}
        </div>` : ''}
        ${show_date ? `<div style="font-family:${numFont};font-size:${f_date}pt;font-weight:${b_date};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;letter-spacing:0.3pt;">${dateStr}</div>` : ''}
        ${show_grp  ? `<div style="font-family:${devaFont};font-size:${f_grp}pt;font-weight:${b_grp};word-break:break-word;overflow-wrap:anywhere;line-height:1.3;overflow:hidden;">${groupLine}</div>` : ''}
        ${(hasExtra && !amtIsLong) ? `<div style="display:flex;justify-content:space-between;align-items:center;overflow:hidden;">${intStr ? `<span style="font-family:${numFont};font-size:${f_int}pt;font-weight:${b_int};color:#444;white-space:nowrap;">${intStr}</span>` : ''}${wtStr ? `<span style="font-family:${numFont};font-size:${f_wt}pt;font-weight:${b_wt};color:#444;white-space:nowrap;">${wtStr}</span>` : ''}</div>` : ''}
      </div>
    </div>
  `;
}

function generateQrCenterLabelHtml(loan: LabelLoan, qrDataUrl: string, settings: LabelSettings): string {
  const { stickerSize, margins } = settings;
  const totalW = stickerSize.width;
  const totalH = stickerSize.height;
  const mTop = Math.min(margins.top, totalH / 2);
  const mBottom = Math.min(margins.bottom, totalH / 2);
  const mLeft = Math.min(margins.left, totalW / 2);
  const mRight = Math.min(margins.right, totalW / 2);
  const qrSizeMm = +(Math.min(totalW, totalH) * 0.85).toFixed(1);

  const acctField = settings.fields.find(f => f.id === 'accountNumber');
  const show_acct = acctField?.enabled ?? true;
  const f_acct = acctField?.fontSize ?? 11;
  const b_acct = (acctField?.bold ?? true) ? '800' : '600';
  const acctOval = acctField?.hasOvalBorder ?? false;
  const numFont = `'Arial','Helvetica',sans-serif`;
  const acctOvalStyle = acctOval
    ? `border:0.6pt solid #333;border-radius:50px;padding:1pt 3pt;letter-spacing:0.3pt;display:inline-block;box-sizing:border-box;`
    : '';

  const nominalMarginMm = +((totalW - qrSizeMm) / 2).toFixed(2);
  let estimatedTextWidthMm = 0;
  if (show_acct && (loan.accountNumber || '').length > 0) {
    const charWidthMm = f_acct * 0.212;
    const acctLen = (loan.accountNumber || '').length;
    const ovalExtraMm = acctOval ? 2.0 : 0;
    estimatedTextWidthMm = acctLen * charWidthMm + ovalExtraMm + 1.5;
  }
  const effectiveLeftMm = Math.max(nominalMarginMm, estimatedTextWidthMm);
  const maxLeftMm = totalW - qrSizeMm;
  const finalLeftMm = +(Math.min(effectiveLeftMm, maxLeftMm)).toFixed(2);
  const rightMm = +(Math.max(0, totalW - finalLeftMm - +qrSizeMm)).toFixed(2);

  return `
    <div class="label-container" style="width:${totalW}mm;height:${totalH}mm;box-sizing:border-box;page-break-after:always;overflow:hidden;display:flex;flex-direction:row;align-items:center;padding:${mTop}mm ${mRight}mm ${mBottom}mm ${mLeft}mm;">
      <div style="width:${finalLeftMm}mm;height:100%;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0.5mm;overflow:hidden;">
        ${show_acct ? `<div style="font-family:${numFont};font-size:${f_acct}pt;font-weight:${b_acct};text-align:center;word-break:break-all;line-height:1.2;${acctOvalStyle}">${loan.accountNumber}</div>` : ''}
      </div>
      <img src="${qrDataUrl}" width="${Math.round(+qrSizeMm * 3.78)}" height="${Math.round(+qrSizeMm * 3.78)}" style="width:${qrSizeMm}mm;height:${qrSizeMm}mm;display:block;flex-shrink:0;" />
      <div style="width:${rightMm}mm;height:${totalH}mm;flex-shrink:0;"></div>
    </div>
  `;
}

function generateQrPrintPage(labelsHtml: string, settings: LabelSettings): string {
  const { stickerSize, fontFamily } = settings;
  const offsetMm = settings.horizontalOffset || 0;
  const transformStyle = offsetMm !== 0 ? `transform:translateX(${offsetMm}mm);` : '';
  const fontOpt = FONT_OPTIONS.find(f => f.value === fontFamily) || FONT_OPTIONS[0];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR लेबल प्रिंट</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=${fontOpt.url}&display=swap" rel="stylesheet">
    <style>@page{size:${stickerSize.width}mm ${stickerSize.height}mm;margin:0;}*{margin:0;padding:0;box-sizing:border-box;}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .label-container{${transformStyle}}
    .label-container:last-child{page-break-after:avoid;}
    @media print{.label-container{page-break-after:always;${transformStyle}}.label-container:last-child{page-break-after:avoid;}}</style></head>
    <body>${labelsHtml}<script>window.onload=function(){setTimeout(function(){window.print();},900);};</script></body></html>`;
}

export function toDevanagariDigits(n: number): string {
  const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(n).replace(/[0-9]/g, d => digits[parseInt(d)]);
}

export function generatePacketLabelHtml(
  loansSlice: LabelLoan[],
  settings: LabelSettings,
  packetIndex?: number,
  totalPackets?: number
): string {
  const { stickerSize, margins, fontFamily } = settings;
  const pf = settings.packetFields || { showCount: true, showWeight: true, showAmount: true };

  const contentWidth = Math.max(5, stickerSize.width - margins.left - margins.right);
  const contentHeight = Math.max(5, stickerSize.height - margins.top - margins.bottom);
  const safeMarginTop = Math.min(margins.top, stickerSize.height / 2);
  const safeMarginBottom = Math.min(margins.bottom, stickerSize.height / 2);
  const safeMarginLeft = Math.min(margins.left, stickerSize.width / 2);
  const safeMarginRight = Math.min(margins.right, stickerSize.width / 2);

  const sorted = [...loansSlice].sort((a, b) => {
    const na = parseInt(String(a.accountNumber)) || 0;
    const nb = parseInt(String(b.accountNumber)) || 0;
    return na - nb;
  });

  const minAcct = sorted[0]?.accountNumber || '';
  const maxAcct = sorted[sorted.length - 1]?.accountNumber || '';
  const acctRange = minAcct === maxAcct ? minAcct : `${minAcct} — ${maxAcct}`;

  const dates = sorted
    .map(l => l.loanDate)
    .filter(Boolean)
    .map(d => { try { return new Date(d.split('T')[0]); } catch { return null; } })
    .filter(Boolean) as Date[];
  dates.sort((a, b) => a.getTime() - b.getTime());
  const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  const minDate = dates.length > 0 ? fmtDate(dates[0]) : '';
  const maxDate = dates.length > 0 ? fmtDate(dates[dates.length - 1]) : '';
  const dateRange = minDate === maxDate ? minDate : `${minDate} — ${maxDate}`;

  const totalCount = sorted.length;
  const totalWeight = sorted.reduce((sum, l) => sum + (parseFloat(String(l.weight || '0')) || 0), 0);
  const totalAmount = sorted.reduce((sum, l) => sum + (Number(l.principalAmount) || 0), 0);

  const devaFont = `'${fontFamily || 'Noto Sans Devanagari'}','Mangal','Arial Unicode MS',sans-serif`;
  const numFont = `'Arial','Helvetica',sans-serif`;

  const lines: string[] = [];

  const acctFontPt = pf.acctFontSize ?? 18;
  const dateFontPt = pf.dateFontSize ?? 13;
  const countFontPt = pf.countFontSize ?? 10;
  const weightFontPt = pf.weightFontSize ?? 10;

  lines.push(`<div style="font-family:${numFont};font-size:${acctFontPt}pt;font-weight:800;text-align:center;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><span style="border:0.8pt solid #333;border-radius:50px;padding:1.5pt 6pt;letter-spacing:0.5pt;display:inline-block;box-sizing:border-box;">${acctRange}</span></div>`);

  lines.push(`<div style="font-family:${numFont};font-size:${dateFontPt}pt;font-weight:600;text-align:center;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.4pt;">${dateRange}</div>`);

  const extraParts: string[] = [];
  if (pf.showCount) {
    extraParts.push(`<span style="font-family:${devaFont};font-size:${countFontPt}pt;font-weight:600;white-space:nowrap;"><span style="font-size:${Math.max(countFontPt - 2, 6)}pt;color:#666;">एकूण </span>${totalCount}</span>`);
  }
  if (pf.showWeight) {
    extraParts.push(`<span style="font-family:${numFont};font-size:${weightFontPt}pt;font-weight:600;white-space:nowrap;"><span style="font-family:${devaFont};font-size:${Math.max(weightFontPt - 2, 6)}pt;color:#666;">वजन </span>${totalWeight.toFixed(2)}g</span>`);
  }
  if (pf.showAmount) {
    const fmtAmt = totalAmount.toLocaleString('en-IN');
    extraParts.push(`<span style="font-family:${numFont};font-size:${countFontPt}pt;font-weight:600;white-space:nowrap;">₹${fmtAmt}</span>`);
  }
  if (extraParts.length > 0) {
    lines.push(`<div style="text-align:center;line-height:1.3;display:flex;justify-content:center;gap:2mm;flex-wrap:wrap;">${extraParts.join('')}</div>`);
  }
  if (totalPackets && totalPackets > 1 && packetIndex !== undefined) {
    lines.push(`<div style="font-family:${devaFont};font-size:${Math.max(countFontPt - 2, 7)}pt;font-weight:700;text-align:center;line-height:1.2;color:#555;">पॅकेट ${toDevanagariDigits(packetIndex + 1)}/${toDevanagariDigits(totalPackets)}</div>`);
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
        justify-content: space-evenly;
        align-items: center;
        overflow: hidden;
      ">
        ${lines.join('\n')}
      </div>
    </div>
  `;
}

export function generatePacketPrintPage(loans: LabelLoan[], settings: LabelSettings): string {
  const { stickerSize, horizontalOffset } = settings;
  const offsetMm = horizontalOffset || 0;
  const transformStyle = offsetMm !== 0 ? `transform: translateX(${offsetMm}mm);` : '';
  const selectedFont = settings.fontFamily || 'Noto Sans Devanagari';
  const fontOption = FONT_OPTIONS.find(f => f.value === selectedFont) || FONT_OPTIONS[0];

  const sorted = [...loans].sort((a, b) => {
    const na = parseInt(String(a.accountNumber)) || 0;
    const nb = parseInt(String(b.accountNumber)) || 0;
    return na - nb;
  });

  const perPacket = settings.perPacket && settings.perPacket > 0 ? settings.perPacket : sorted.length;
  const chunks: LabelLoan[][] = [];
  for (let i = 0; i < sorted.length; i += perPacket) {
    chunks.push(sorted.slice(i, i + perPacket));
  }

  const labelsHtml = chunks.map((chunk, idx) =>
    generatePacketLabelHtml(chunk, settings, idx, chunks.length)
  ).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>पॅकेट लेबल प्रिंट</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=${fontOption.url}&display=swap" rel="stylesheet">
      <style>
        @page {
          size: ${stickerSize.width}mm ${stickerSize.height}mm;
          margin: 0;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: '${selectedFont}', 'Mangal', 'Arial Unicode MS', sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .label-container {
          overflow: hidden;
          ${transformStyle}
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
  const [qrPreviewUrls, setQrPreviewUrls] = useState<Record<string, string>>({});
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
              horizontalOffset: typeof parsed.horizontalOffset === 'number' ? parsed.horizontalOffset : 0,
              fontFamily: typeof parsed.fontFamily === 'string' ? parsed.fontFamily : undefined,
              qrMode: typeof parsed.qrMode === 'boolean' ? parsed.qrMode : false,
              printMode: (['normal','qrSide','qrCenter','packet'] as const).includes(parsed.printMode)
                ? parsed.printMode
                : (parsed.qrMode ? 'qrSide' : 'normal'),
              packetFields: parsed.packetFields && typeof parsed.packetFields === 'object'
                ? {
                    showCount: typeof parsed.packetFields.showCount === 'boolean' ? parsed.packetFields.showCount : true,
                    showWeight: typeof parsed.packetFields.showWeight === 'boolean' ? parsed.packetFields.showWeight : true,
                    showAmount: typeof parsed.packetFields.showAmount === 'boolean' ? parsed.packetFields.showAmount : true,
                  }
                : { showCount: true, showWeight: true, showAmount: true },
              perPacket: typeof parsed.perPacket === 'number' && parsed.perPacket >= 0 ? parsed.perPacket : 0,
            });
          }
        }
      } catch {}
    }
    setDbLoaded(true);
    setIsDirty(false);
  }, [dbSettings, isFetched, dbLoaded]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: LabelSettings) => {
      await apiRequest('PUT', '/api/label-settings', newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/label-settings'] });
    },
  });

  useEffect(() => {
    if (!open) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (isDirty && dbLoaded) {
        saveSettings(settings);
        saveMutation.mutate(settings);
      }
      setDbLoaded(false);
      setIsDirty(false);
    }
  }, [open, isDirty, dbLoaded, settings]);

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

  useEffect(() => {
    const fontFamily = settings.fontFamily || 'Noto Sans Devanagari';
    const fontOption = FONT_OPTIONS.find(f => f.value === fontFamily) || FONT_OPTIONS[0];
    const linkId = 'label-preview-font';
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${fontOption.url}&display=swap`;
  }, [settings.fontFamily]);

  useEffect(() => {
    const isQrAny = (settings.printMode === 'qrSide' || settings.printMode === 'qrCenter' || !!settings.qrMode) && settings.printMode !== 'packet';
    if (!isQrAny || !open) { setQrPreviewUrls({}); return; }
    let cancelled = false;
    (async () => {
      const urls: Record<string, string> = {};
      for (const loan of loans.slice(0, 4)) {
        if (cancelled) return;
        const qrData = encodeQrData(String(loan.id));
        const qrRes = await fetch(`/api/qr-generate?url=${encodeURIComponent(qrData)}&size=128`);
        const qrJson = await qrRes.json();
        urls[String(loan.id)] = qrJson.dataUrl;
      }
      if (!cancelled) setQrPreviewUrls(urls);
    })();
    return () => { cancelled = true; };
  }, [settings.printMode, settings.qrMode, open, loans]);

  const updateMargin = useCallback((side: keyof MarginSettings, delta: number) => {
    updateSettings(prev => ({
      ...prev,
      margins: {
        ...prev.margins,
        [side]: Math.max(0, Math.min(10, +(prev.margins[side] + delta).toFixed(1)))
      }
    }));
  }, [updateSettings]);

  const updateHorizontalOffset = useCallback((delta: number) => {
    updateSettings(prev => ({
      ...prev,
      horizontalOffset: Math.max(-10, Math.min(10, +((prev.horizontalOffset || 0) + delta).toFixed(1)))
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

  const openPrintWindow = useCallback(async (loansToprint: LabelLoan[]) => {
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) {
      alert("पॉप-अप ब्लॉक झाले. कृपया ब्राउझर सेटिंग्ज मध्ये पॉप-अप अनुमती द्या.");
      return;
    }
    if (settings.printMode === 'packet') {
      printWindow.document.write(generatePacketPrintPage(loansToprint, settings));
      printWindow.document.close();
      return;
    }
    const effectiveQrMode = settings.printMode === 'qrSide' || settings.printMode === 'qrCenter' || !!settings.qrMode;
    const isQrCenter = settings.printMode === 'qrCenter';
    if (effectiveQrMode) {
      const labelsHtml = (await Promise.all(loansToprint.map(async loan => {
        const qrData = encodeQrData(String(loan.id));
        const qrFetch = await fetch(`/api/qr-generate?url=${encodeURIComponent(qrData)}&size=512`);
        const qrFetchJson = await qrFetch.json();
        const qrDataUrl = qrFetchJson.dataUrl;
        return isQrCenter
          ? generateQrCenterLabelHtml(loan, qrDataUrl, settings)
          : generateQrLabelHtml(loan, qrDataUrl, settings);
      }))).join('');
      printWindow.document.write(generateQrPrintPage(labelsHtml, settings));
      printWindow.document.close();
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
              {/* Row 1: Print Mode — 3-way compact toggle */}
              <div className="px-3 py-2 bg-white border-b border-gray-100 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">प्रिंट मोड:</span>
                <div className="flex gap-1">
                  {([
                    { mode: 'normal'    as const, label: 'Regular' },
                    { mode: 'qrSide'   as const, label: 'QR साइड' },
                    { mode: 'qrCenter' as const, label: 'QR Center' },
                    { mode: 'packet'   as const, label: 'पॅकेट' },
                  ]).map(opt => {
                    const active = (settings.printMode || 'normal') === opt.mode;
                    return (
                      <button key={opt.mode}
                        onClick={() => updateSettings(prev => ({ ...prev, printMode: opt.mode, qrMode: opt.mode === 'qrSide' || opt.mode === 'qrCenter' }))}
                        style={{
                          padding: '3px 9px', borderRadius: '5px', fontSize: '10px', fontWeight: 600,
                          background: active ? '#4f46e5' : '#f3f4f6',
                          color: active ? '#fff' : '#4b5563',
                          border: active ? 'none' : '1px solid #e5e7eb',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >{opt.label}</button>
                    );
                  })}
                </div>
                {saveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-indigo-400 ml-auto flex-shrink-0" />}
                {!saveMutation.isPending && dbLoaded && <span className="text-[9px] text-green-500 ml-auto flex-shrink-0">✓ सेव्ह</span>}
              </div>
              {settings.printMode === 'packet' && (
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
                  <div className="text-[11px] font-semibold text-amber-800 mb-1.5">पॅकेट लेबल सेटिंग्ज:</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Switch
                          checked={settings.packetFields?.showCount ?? true}
                          onCheckedChange={(v) => updateSettings(prev => ({
                            ...prev,
                            packetFields: { ...prev.packetFields || { showCount: true, showWeight: true, showAmount: true }, showCount: v }
                          }))}
                          className="h-4 w-7"
                        />
                        <span className="text-[10px] text-gray-700">एकूण खाती</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Switch
                          checked={settings.packetFields?.showWeight ?? true}
                          onCheckedChange={(v) => updateSettings(prev => ({
                            ...prev,
                            packetFields: { ...prev.packetFields || { showCount: true, showWeight: true, showAmount: true }, showWeight: v }
                          }))}
                          className="h-4 w-7"
                        />
                        <span className="text-[10px] text-gray-700">एकूण वजन</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Switch
                          checked={settings.packetFields?.showAmount ?? true}
                          onCheckedChange={(v) => updateSettings(prev => ({
                            ...prev,
                            packetFields: { ...prev.packetFields || { showCount: true, showWeight: true, showAmount: true }, showAmount: v }
                          }))}
                          className="h-4 w-7"
                        />
                        <span className="text-[10px] text-gray-700">एकूण रक्कम</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 whitespace-nowrap">प्रति पॅकेट:</span>
                      <Input
                        type="number"
                        value={settings.perPacket || ''}
                        placeholder="सर्व"
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          updateSettings(prev => ({ ...prev, perPacket: Math.max(0, val) }));
                        }}
                        className="h-6 w-16 text-[10px] px-1.5"
                        min={0}
                      />
                      <span className="text-[9px] text-gray-400">
                        {settings.perPacket && settings.perPacket > 0
                          ? `${Math.ceil(loans.length / settings.perPacket)} पॅकेट`
                          : 'एकच पॅकेट'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* Row 2: Tabs + Font inline */}
              <div className="flex items-stretch border-b border-gray-200">
                {([
                  { key: 'size'    as const, label: 'साइज' },
                  { key: 'fields' as const, label: 'फील्ड्स' },
                  { key: 'margins' as const, label: 'मार्जिन' },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setSettingsTab(tab.key)}
                    className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
                      settingsTab === tab.key
                        ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >{tab.label}</button>
                ))}
                <select
                  value={settings.fontFamily || 'Noto Sans Devanagari'}
                  onChange={(e) => updateSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
                  className="text-[10px] border-l border-gray-200 bg-white px-1 focus:outline-none text-gray-600 cursor-pointer"
                  style={{ minWidth: '82px', maxWidth: '100px' }}
                  title="फॉन्ट बदला"
                >
                  {FONT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label.split(' ')[0]}</option>
                  ))}
                </select>
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
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-700 mb-1">प्रिंट शिफ्ट (mm):</div>
                      <div className="text-[10px] text-gray-400 mb-1.5">प्रिंटर alignment साठी लेबल डावी/उजवी सरकवा</div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs w-10 text-gray-600">आडवा</Label>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateHorizontalOffset(-0.5)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs font-mono w-8 text-center font-medium">
                          {(settings.horizontalOffset || 0).toFixed(1)}
                        </span>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateHorizontalOffset(0.5)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="text-[10px] text-gray-400 ml-1">
                          {(settings.horizontalOffset || 0) > 0 ? '→ उजवी' : (settings.horizontalOffset || 0) < 0 ? '← डावी' : ''}
                        </span>
                      </div>
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
            {settings.printMode === 'packet' ? (
              <div className="flex flex-wrap gap-3 justify-center">
                {(() => {
                  const sorted = [...loans].sort((a, b) => {
                    const na = parseInt(String(a.accountNumber)) || 0;
                    const nb = parseInt(String(b.accountNumber)) || 0;
                    return na - nb;
                  });
                  const perPacket = settings.perPacket && settings.perPacket > 0 ? settings.perPacket : sorted.length;
                  const chunks: LabelLoan[][] = [];
                  for (let i = 0; i < sorted.length; i += perPacket) {
                    chunks.push(sorted.slice(i, i + perPacket));
                  }
                  const previewChunks = chunks.slice(0, 4);
                  return previewChunks.map((chunk, idx) => {
                    const realWPx = settings.stickerSize.width * 3.78;
                    const realHPx = settings.stickerSize.height * 3.78;
                    const previewW = realWPx * previewScale;
                    const previewH = realHPx * previewScale;
                    const html = generatePacketLabelHtml(chunk, settings, idx, chunks.length)
                      .replace(/class="label-container"/, '')
                      .replace(/page-break-after:\s*always;/, '');
                    return (
                      <div
                        key={idx}
                        className="border border-dashed border-amber-400 bg-white rounded shadow-sm"
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
                            fontFamily: `'${settings.fontFamily || 'Noto Sans Devanagari'}', 'Mangal', 'Arial Unicode MS', sans-serif`,
                          }}
                          dangerouslySetInnerHTML={{ __html: html }}
                        />
                      </div>
                    );
                  });
                })()}
                {(() => {
                  const perPacket = settings.perPacket && settings.perPacket > 0 ? settings.perPacket : loans.length;
                  const totalChunks = Math.ceil(loans.length / perPacket);
                  return totalChunks > 4 ? (
                    <div className="flex items-center justify-center text-xs text-gray-400 font-medium">
                      +{totalChunks - 4} आणखी...
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
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
                    {(() => {
                      const previewQrMode = (settings.printMode === 'qrSide' || settings.printMode === 'qrCenter' || !!settings.qrMode) && settings.printMode !== 'packet';
                      const previewQrCenter = settings.printMode === 'qrCenter';
                      if (!previewQrMode) return null;

                      const shorterPx = Math.min(realWPx, realHPx);
                      const qrSizePx = +(shorterPx * 0.68).toFixed(1);
                      const pt2px = (pt: number) => Math.round(pt * 1.333);
                      const gf2  = (id: string, fb: number)  => settings.fields.find(f => f.id === id)?.fontSize ?? fb;
                      const gb2  = (id: string, fb: boolean) => (settings.fields.find(f => f.id === id)?.bold ?? fb) ? 800 : 600;
                      const gov2 = (id: string)              => settings.fields.find(f => f.id === id)?.hasOvalBorder ?? false;
                      const ge2  = (id: string)              => settings.fields.find(f => f.id === id)?.enabled ?? true;
                      const numF2 = `'Arial','Helvetica',sans-serif`;
                      const fp_acct = pt2px(gf2('accountNumber', 11));
                      const bw_acct = gb2('accountNumber', true);
                      const acctOval2 = gov2('accountNumber');
                      const sv_acct = ge2('accountNumber');

                      // QR Center preview
                      if (previewQrCenter) {
                        const qrCenterSizePx = +(shorterPx * 0.85).toFixed(1);
                        const nominalMarginPx = (realWPx - qrCenterSizePx) / 2;
                        const acctText = loan.accountNumber || '';
                        const charWidthPx = fp_acct * 0.212 * 3.78;
                        const ovalExtraPx = acctOval2 ? 7.56 : 0;
                        const estimatedTextWidthPx = sv_acct && acctText.length > 0
                          ? acctText.length * charWidthPx + ovalExtraPx + 5.67
                          : 0;
                        const effectiveLeftPx = Math.max(nominalMarginPx, estimatedTextWidthPx);
                        const maxLeftPx = realWPx - qrCenterSizePx;
                        const finalLeftPx = Math.min(effectiveLeftPx, maxLeftPx);
                        const rightPx = Math.max(0, realWPx - finalLeftPx - qrCenterSizePx);
                        const acctStyle: React.CSSProperties = acctOval2
                          ? { border: '0.8px solid #333', borderRadius: '50px', padding: '1px 3px', letterSpacing: '0.3px', display: 'inline-block', boxSizing: 'border-box' }
                          : {};
                        return (
                          <div style={{ width: `${realWPx}px`, height: `${realHPx}px`, transform: `scale(${previewScale})`, transformOrigin: 'top left', display: 'flex', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', boxSizing: 'border-box' }}>
                            <div style={{ width: `${finalLeftPx}px`, height: `${realHPx}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '2px', overflow: 'hidden' }}>
                              {sv_acct && <span style={{ fontFamily: numF2, fontSize: `${fp_acct}px`, fontWeight: bw_acct, textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.2, ...acctStyle }}>{loan.accountNumber}</span>}
                            </div>
                            {qrPreviewUrls[String(loan.id)]
                              ? <img src={qrPreviewUrls[String(loan.id)]} style={{ width: `${qrCenterSizePx}px`, height: `${qrCenterSizePx}px`, display: 'block', flexShrink: 0 }} alt="QR" />
                              : <div style={{ width: `${qrCenterSizePx}px`, height: `${qrCenterSizePx}px`, background: '#f3f4f6', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: '#9ca3af', flexShrink: 0 }}>QR</div>
                            }
                            <div style={{ width: `${rightPx}px`, height: `${realHPx}px`, flexShrink: 0 }} />
                          </div>
                        );
                      }

                      // QR Side preview (existing)
                      const ge2full = ge2;
                      const sv_amt  = ge2full('amount');
                      const sv_date = ge2full('date');
                      const sv_grp  = ge2full('groupBorrower');
                      const sv_int  = ge2full('interestRate');
                      const sv_wt   = ge2full('weight');
                      const fp_amt  = pt2px(gf2('amount', 10));
                      const fp_date = pt2px(gf2('date', 10));
                      const fp_grp  = pt2px(gf2('groupBorrower', 8));
                      const fp_int  = pt2px(gf2('interestRate', 7.5));
                      const fp_wt   = pt2px(gf2('weight', 7.5));
                      const bw_amt  = gb2('amount', true);
                      const bw_date = gb2('date', true);
                      const bw_grp  = gb2('groupBorrower', false);
                      const bw_int  = gb2('interestRate', true);
                      const bw_wt   = gb2('weight', true);
                      const devaF2 = `'${settings.fontFamily || 'Noto Sans Devanagari'}','Mangal',sans-serif`;
                      const dateStr2 = loan.loanDate ? (() => { try { const p = loan.loanDate.split('T')[0].split('-'); return `${p[2]}/${p[1]}/${p[0]}`; } catch { return loan.loanDate; } })() : '';
                      const amtNum2 = (parseInt(String(loan.principalAmount)) || 0).toLocaleString('en-IN');
                      const grpDM2 = settings.fields.find(f => f.id === 'groupBorrower')?.displayMode ?? 'groupBorrower';
                      const grpLine2 = grpDM2 === 'groupOnly' ? (loan.groupName || '') : grpDM2 === 'borrowerOnly' ? (loan.borrowerName || '') : (loan.groupName ? `${loan.groupName} (${loan.borrowerName})` : (loan.borrowerName || ''));
                      const intStr2 = (sv_int && loan.interestRate) ? `${loan.interestRate}` : '';
                      const wtStr2  = (sv_wt && loan.weight) ? `${parseFloat(String(loan.weight)).toFixed(2)}g` : '';
                      const hasExtra2 = !!(intStr2 || wtStr2);
                      const showRow1v = sv_acct || sv_amt;
                      const panelWpx = realWPx - qrSizePx - Math.round(3 * 3.78);
                      const row1Chars2 = (sv_acct ? (loan.accountNumber || '').length : 0) + (sv_amt ? amtNum2.length + 1 : 0);
                      const maxRow1Fpx = Math.max(sv_acct ? fp_acct : 0, sv_amt ? fp_amt : 0);
                      const charsPx = maxRow1Fpx > 0 ? panelWpx / (maxRow1Fpx * 0.55) : 999;
                      const row1Scale2 = row1Chars2 > 0 && row1Chars2 > charsPx ? Math.max(0.6, charsPx / row1Chars2) : 1;
                      const eff_fp_acct = Math.round(fp_acct * row1Scale2);
                      const eff_fp_amt  = Math.round(fp_amt * row1Scale2);
                      return (
                        <div style={{ width: `${realWPx}px`, height: `${realHPx}px`, transform: `scale(${previewScale})`, transformOrigin: 'top left', display: 'flex', flexDirection: 'row', alignItems: 'stretch', padding: '1px 1px 2.5px 3px', gap: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {qrPreviewUrls[String(loan.id)] ? (
                            <img src={qrPreviewUrls[String(loan.id)]} style={{ width: `${qrSizePx}px`, height: `${qrSizePx}px`, display: 'block', flexShrink: 0 }} alt="QR" />
                          ) : (
                            <div style={{ width: `${qrSizePx}px`, height: `${qrSizePx}px`, background: '#f3f4f6', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${fp_int}px`, color: '#9ca3af', flexShrink: 0 }}>QR…</div>
                          )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingLeft: '2px', paddingRight: '1px', borderLeft: '0.8px solid #ccc', marginLeft: '1px', overflow: 'hidden' }}>
                            {showRow1v && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' }}>
                                {sv_acct && <span style={{ fontFamily: numF2, fontSize: `${eff_fp_acct}px`, fontWeight: bw_acct, whiteSpace: 'nowrap', lineHeight: 1.3, flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', ...(acctOval2 ? { border: '0.8px solid #333', borderRadius: '50px', padding: '1px 3px', letterSpacing: '0.3px', display: 'inline-block', boxSizing: 'border-box' as const } : {}) }}>{loan.accountNumber}</span>}
                                {sv_amt  && <span style={{ fontFamily: numF2, fontSize: `${eff_fp_amt}px`, fontWeight: bw_amt, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '4px' }}>{amtNum2}</span>}
                              </div>
                            )}
                            {sv_date && <div style={{ fontFamily: numF2, fontSize: `${fp_date}px`, fontWeight: bw_date, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3, letterSpacing: '0.3px' }}>{dateStr2}</div>}
                            {sv_grp  && <div style={{ fontFamily: devaF2, fontSize: `${fp_grp}px`, fontWeight: bw_grp, wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.3, overflow: 'hidden' }}>{grpLine2}</div>}
                            {hasExtra2 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' }}>
                                {intStr2 && <span style={{ fontFamily: numF2, fontSize: `${fp_int}px`, fontWeight: bw_int, color: '#444', whiteSpace: 'nowrap' }}>{intStr2}</span>}
                                {wtStr2  && <span style={{ fontFamily: numF2, fontSize: `${fp_wt}px`, fontWeight: bw_wt, color: '#444', whiteSpace: 'nowrap' }}>{wtStr2}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {(settings.printMode === 'normal' || (!settings.printMode && !settings.qrMode)) && (
                      <div
                        style={{
                          width: `${realWPx}px`,
                          height: `${realHPx}px`,
                          transform: `scale(${previewScale})`,
                          transformOrigin: 'top left',
                          fontFamily: `'${settings.fontFamily || 'Noto Sans Devanagari'}', 'Mangal', 'Arial Unicode MS', sans-serif`,
                        }}
                        dangerouslySetInnerHTML={{
                          __html: generateLabelHtml(loan, settings)
                            .replace(/class="label-container"/, '')
                            .replace(/page-break-after:\s*always;/, '')
                        }}
                      />
                    )}
                  </div>
                );
              })}
              {loans.length > 4 && (
                <div className="flex items-center justify-center text-xs text-gray-400 font-medium">
                  +{loans.length - 4} आणखी...
                </div>
              )}
            </div>
            )}
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