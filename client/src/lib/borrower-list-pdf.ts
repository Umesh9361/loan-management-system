import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Match generateReportHTML's @page on every page, including the first.
export const BORROWER_PDF_PAGE = {
  width: 210, height: 297, left: 5, right: 5, top: 5, firstTop: 5, bottom: 5,
} as const;

/** Apply every print block, in source order, without any screen-only overrides. */
export function borrowerPrintCss(
  rules: ArrayLike<CSSRule>,
  matches: (query: string) => boolean,
): string {
  return Array.from(rules).map(rule => {
    if (rule.type === 4) { // CSSMediaRule; numeric type also works across iframe realms.
      const media = rule as CSSMediaRule;
      const applies = media.media.mediaText.split(',').some(query =>
        !/\bscreen\b/i.test(query) && matches(query.replace(/\bprint\b/gi, 'all')));
      return applies ? borrowerPrintCss(media.cssRules, matches) : '';
    }
    return rule.type === 6 ? '' : rule.cssText; // @page belongs to native printing only.
  }).join('\n');
}

export type BorrowerPdfSlice = {
  sourceY: number;
  sourceHeight: number;
  repeatedHeaderHeight: number;
};

/** Integer pixel cuts only: never split rows or introduce rounding gaps. */
export function borrowerPdfSlices(
  height: number, width: number, rowBottoms: number[],
  header: { top: number; bottom: number },
): BorrowerPdfSlice[] {
  if (!Number.isInteger(height) || !Number.isInteger(width) || height <= 0 || width <= 0) {
    throw new Error('PDFचे पान मोजता आले नाही.');
  }
  const page = BORROWER_PDF_PAGE;
  const ratio = (page.width - page.left - page.right) / width;
  const boundaries = Array.from(new Set(rowBottoms.map(Math.ceil)))
    .filter(y => y > 0 && y <= height).sort((a, b) => a - b);
  const slices: BorrowerPdfSlice[] = [];
  let sourceY = 0;
  while (sourceY < height) {
    const repeatedHeaderHeight = slices.length && sourceY >= header.bottom
      ? header.bottom - header.top : 0;
    const top = slices.length ? page.top : page.firstTop;
    const capacity = Math.floor((page.height - top - page.bottom) / ratio) - repeatedHeaderHeight;
    if (capacity <= 0) throw new Error('PDFमध्ये शीर्षकासाठी पुरेशी जागा नाही.');
    let end = Math.min(height, sourceY + capacity);
    if (end < height) {
      const fitting = boundaries.filter(y => y > sourceY && y <= end);
      if (!fitting.length) {
        throw new Error('एका नोंदीचा मजकूर A4 पानापेक्षा मोठा आहे. कृपया तपशील कमी करा.');
      }
      end = fitting[fitting.length - 1];
    }
    slices.push({ sourceY, sourceHeight: end - sourceY, repeatedHeaderHeight });
    sourceY = end;
  }
  return slices;
}

/** Render the very same HTML and print CSS as the desktop print action. */
export async function createBorrowerListPdf(reportHTML: string): Promise<jsPDF> {
  const page = BORROWER_PDF_PAGE;
  const contentWidth = page.width - page.left - page.right;
  const cssWidth = contentWidth * 96 / 25.4;
  const parsed = new DOMParser().parseFromString(reportHTML, 'text/html');
  // The report also contains screen-only keyboard/popup scripts. Never run them
  // (or any event attributes in report data) in an export document.
  parsed.querySelectorAll('script').forEach(node => node.remove());
  parsed.querySelectorAll('*').forEach(node => {
    Array.from(node.attributes).filter(attr => /^on/i.test(attr.name))
      .forEach(attr => node.removeAttribute(attr.name));
  });
  const frame = document.createElement('iframe');
  frame.title = 'कर्जदार यादी PDF तयार करत आहे';
  frame.setAttribute('aria-hidden', 'true');
  frame.sandbox.add('allow-same-origin');
  Object.assign(frame.style, {
    position: 'absolute', left: '-10000px', top: '0', border: '0',
    width: `${cssWidth}px`, height: '1123px',
  });
  try {
    const loaded = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('प्रिंटची मांडणी लोड झाली नाही.')), 30000);
      frame.onload = () => { window.clearTimeout(timeout); resolve(); };
      frame.onerror = () => { window.clearTimeout(timeout); reject(new Error('प्रिंटची मांडणी लोड झाली नाही.')); };
    });
    frame.srcdoc = '<!doctype html>' + parsed.documentElement.outerHTML;
    document.body.appendChild(frame);
    await loaded;
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) throw new Error('PDFची मांडणी उघडता आली नाही.');
    for (const style of Array.from(doc.querySelectorAll('style'))) {
      if (!style.sheet) throw new Error('प्रिंटचे नियम लोड झाले नाहीत.');
      style.textContent = borrowerPrintCss(style.sheet.cssRules, query => win.matchMedia(query).matches);
    }
    doc.documentElement.style.setProperty('width', `${cssWidth}px`, 'important');
    doc.body.style.setProperty('width', `${cssWidth}px`, 'important');
    await Promise.all([400, 500, 600, 700].map(weight =>
      doc.fonts.load(`${weight} 14px "Noto Sans Devanagari"`)));
    await doc.fonts.ready;

    const scale = 2;
    // The iframe viewport may be taller than a short report. Capture its actual
    // content, not that empty viewport, otherwise a blank second page is added.
    const contentHeight = Math.ceil(doc.body.getBoundingClientRect().height);
    const renderOptions = {
      scale, useCORS: true, logging: false, backgroundColor: '#ffffff',
      width: Math.ceil(cssWidth), windowWidth: Math.ceil(cssWidth),
      scrollX: 0, scrollY: 0,
    };
    const imageWidth = Math.ceil(cssWidth) * scale;
    const origin = doc.body.getBoundingClientRect().top;
    const headerRect = doc.querySelector('thead')?.getBoundingClientRect();
    if (!headerRect) throw new Error('कॉलमची शीर्षके सापडली नाहीत.');
    const header = {
      top: Math.max(0, Math.floor((headerRect.top - origin) * scale)),
      bottom: Math.ceil((headerRect.bottom - origin) * scale),
    };
    const rowBottoms = Array.from(doc.querySelectorAll('tr')).map(row =>
      Math.ceil((row.getBoundingClientRect().bottom - origin) * scale));
    const slices = borrowerPdfSlices(contentHeight * scale, imageWidth, rowBottoms, header);
    // Render bounded A4-sized crops, never one giant canvas for the whole list.
    // The complete DOM stays in place, so column widths and row positions match
    // native printing even for hundreds of rows.
    const headerCanvas = slices.length > 1 ? await html2canvas(doc.body, {
      ...renderOptions, y: header.top / scale, height: (header.bottom - header.top) / scale,
    }) : null;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    for (let index = 0; index < slices.length; index++) {
      const slice = slices[index];
      if (index) pdf.addPage();
      const crop = await html2canvas(doc.body, {
        ...renderOptions, y: slice.sourceY / scale, height: slice.sourceHeight / scale,
      });
      if (!crop.width || !crop.height) throw new Error('PDFचे पान तयार झाले नाही.');
      const image = document.createElement('canvas');
      image.width = imageWidth;
      image.height = slice.sourceHeight + slice.repeatedHeaderHeight;
      const context = image.getContext('2d');
      if (!context) throw new Error('PDFसाठी चित्र तयार करता आले नाही.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, image.width, image.height);
      if (slice.repeatedHeaderHeight && headerCanvas) {
        context.drawImage(headerCanvas, 0, 0);
      }
      context.drawImage(crop, 0, slice.repeatedHeaderHeight);
      // Lossless output preserves thin column dividers and Devanagari strokes.
      pdf.addImage(image.toDataURL('image/png'), 'PNG', page.left,
        index ? page.top : page.firstTop, contentWidth,
        image.height * contentWidth / imageWidth, undefined, 'FAST');
      crop.width = crop.height = 0;
      image.width = image.height = 0;
    }
    if (headerCanvas) headerCanvas.width = headerCanvas.height = 0;
    return pdf;
  } finally {
    frame.remove();
  }
}
