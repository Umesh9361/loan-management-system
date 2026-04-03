import jsPDF from 'jspdf';
import { NOTO_SANS_DEVANAGARI_BASE64 } from './fonts/noto-devanagari-font';

const initializedDocs = new WeakSet<jsPDF>();

export function initDevanagariFont(doc: jsPDF): void {
  if (!initializedDocs.has(doc)) {
    doc.addFileToVFS('NotoSansDevanagari.ttf', NOTO_SANS_DEVANAGARI_BASE64);
    doc.addFont('NotoSansDevanagari.ttf', 'NotoDevanagari', 'normal');
    initializedDocs.add(doc);
  }
  doc.setFont('NotoDevanagari');
}

interface ReceiptData {
  companyName: string;
  licenseNumber: string;
  borrowerName: string;
  address: string;
  loanNumber: string;
  loanDate: string;
  principal: string;
  interestRate: string;
  collateralDetails: string;
  collateralWeight: string;
  collateralValue: string;
  closureDate?: string;
  closurePrincipal?: string;
  closureInterest?: string;
  closureTotal?: string;
  closureTotalWords?: string;
  receiptType: 'combined' | 'disbursement' | 'closure' | 'blank';
}

export function generateTextBasedReceiptPDF(data: ReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5'
  });

  initDevanagariFont(doc);

  const pageWidth = 148;
  const margin = 8;
  let y = margin;
  const lineHeight = 5;
  const sectionGap = 3;

  const centerText = (text: string, yPos: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, yPos);
  };

  const leftText = (text: string, yPos: number, fontSize: number = 9) => {
    doc.setFontSize(fontSize);
    doc.text(text, margin, yPos);
  };

  const rightText = (text: string, yPos: number, fontSize: number = 9) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, pageWidth - margin - textWidth, yPos);
  };

  const fieldRow = (label: string, value: string, yPos: number, fontSize: number = 9) => {
    doc.setFontSize(fontSize);
    doc.text(`${label}: ${value}`, margin, yPos);
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    doc.setLineWidth(0.2);
    doc.line(x1, y1, x2, y2);
  };

  const isBlank = data.receiptType === 'blank';
  const getValue = (val: string) => isBlank ? '_____________' : val;

  if (data.receiptType === 'closure') {
    centerText('नमुना क्र ११', y, 12);
    y += lineHeight + 2;
    centerText('कर्ज समाप्ती पावती', y, 11);
  } else if (data.receiptType === 'disbursement') {
    centerText('नमुना क्र १०', y, 12);
    y += lineHeight + 2;
    centerText('कर्ज वितरण पावती', y, 11);
  } else {
    centerText('नमुना क्र १०/११', y, 12);
    y += lineHeight + 2;
    centerText('कर्ज पावती', y, 11);
  }

  y += lineHeight + sectionGap;
  drawLine(margin, y, pageWidth - margin, y);
  y += sectionGap + 2;

  centerText(getValue(data.companyName), y, 11);
  y += lineHeight;
  if (data.licenseNumber) {
    centerText(`परवाना क्र: ${getValue(data.licenseNumber)}`, y, 8);
    y += lineHeight;
  }

  y += sectionGap;
  drawLine(margin, y, pageWidth - margin, y);
  y += sectionGap + 2;

  fieldRow('कर्जदाराचे नाव', getValue(data.borrowerName), y);
  y += lineHeight;
  
  fieldRow('पत्ता', getValue(data.address), y);
  y += lineHeight;

  y += sectionGap;
  drawLine(margin, y, pageWidth - margin, y);
  y += sectionGap + 2;

  leftText('कर्ज माहिती:', y, 10);
  y += lineHeight + 1;

  fieldRow('कर्ज क्रमांक', getValue(data.loanNumber), y);
  y += lineHeight;

  fieldRow('कर्ज तारीख', getValue(data.loanDate), y);
  y += lineHeight;

  fieldRow('मुद्दल रक्कम', getValue(data.principal ? `₹${data.principal}` : ''), y);
  y += lineHeight;

  fieldRow('व्याज दर', getValue(data.interestRate ? `${data.interestRate}%` : ''), y);
  y += lineHeight;

  y += sectionGap;
  drawLine(margin, y, pageWidth - margin, y);
  y += sectionGap + 2;

  leftText('तारण माहिती:', y, 10);
  y += lineHeight + 1;

  fieldRow('वस्तूचा तपशील', getValue(data.collateralDetails), y);
  y += lineHeight;

  if (data.collateralWeight) {
    fieldRow('वजन', getValue(`${data.collateralWeight} ग्राम`), y);
    y += lineHeight;
  }

  if (data.collateralValue) {
    fieldRow('अंदाजे मूल्य', getValue(`₹${data.collateralValue}`), y);
    y += lineHeight;
  }

  if (data.receiptType === 'closure' && data.closureDate) {
    y += sectionGap;
    drawLine(margin, y, pageWidth - margin, y);
    y += sectionGap + 2;

    leftText('समाप्ती माहिती:', y, 10);
    y += lineHeight + 1;

    fieldRow('समाप्ती तारीख', getValue(data.closureDate), y);
    y += lineHeight;

    if (data.closurePrincipal) {
      fieldRow('मुद्दल', getValue(`₹${data.closurePrincipal}`), y);
      y += lineHeight;
    }

    if (data.closureInterest) {
      fieldRow('व्याज', getValue(`₹${data.closureInterest}`), y);
      y += lineHeight;
    }

    if (data.closureTotal) {
      fieldRow('एकूण रक्कम', getValue(`₹${data.closureTotal}`), y);
      y += lineHeight;
    }

    if (data.closureTotalWords) {
      y += 2;
      doc.setFontSize(8);
      doc.text(`(अक्षरी: ${data.closureTotalWords})`, margin, y);
      y += lineHeight;
    }
  }

  y += sectionGap + 5;
  drawLine(margin, y, pageWidth - margin, y);
  y += sectionGap + 8;

  leftText('कर्जदाराची सही:', y, 9);
  rightText('अधिकृत सही:', y, 9);

  y += 15;
  drawLine(margin, y, margin + 40, y);
  drawLine(pageWidth - margin - 40, y, pageWidth - margin, y);

  return doc;
}
