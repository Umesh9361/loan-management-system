import { borrowerPrintCss } from "./borrower-list-pdf";

type Block = { top: number; bottom: number };

/** Find a page break without cutting a row, card, or closing total/signature. */
export function pdfPageEnd(start: number, capacity: number, height: number, blocks: Block[]): number {
  let end = Math.min(height, start + capacity);
  if (end >= height) return height;
  for (;;) {
    const crossing = blocks.filter(block => block.top < end - 0.01 && block.bottom > end + 0.01);
    if (!crossing.length) return end;
    const next = Math.min(...crossing.map(block => block.top));
    if (next <= start) throw new Error("एका भागाचा मजकूर A4 पानापेक्षा मोठा आहे. कृपया मजकूर किंवा मांडणी तपासा.");
    end = next;
  }
}

/** Download the actual print document as A4, independent of Android's paper selection. */
export async function downloadPrintDocumentPdf(html: string, filename: string, pageSelector?: string) {
  const frame = document.createElement("iframe");
  frame.title = "PDF तयार होत आहे";
  frame.setAttribute("aria-hidden", "true");
  frame.sandbox.add("allow-same-origin");
  frame.style.cssText = "position:absolute;left:-10000px;top:0;width:210mm;height:297mm;border:0";
  try {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    parsed.querySelectorAll("script").forEach(node => node.remove());
    parsed.querySelectorAll("*").forEach(node => {
      Array.from(node.attributes).filter(attr => /^on/i.test(attr.name)).forEach(attr => node.removeAttribute(attr.name));
    });
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("PDFची मांडणी लोड झाली नाही.")), 30000);
      frame.onload = () => { window.clearTimeout(timer); resolve(); };
      frame.onerror = () => { window.clearTimeout(timer); reject(new Error("PDFची मांडणी लोड झाली नाही.")); };
    });
    frame.srcdoc = "<!doctype html>" + parsed.documentElement.outerHTML;
    document.body.appendChild(frame);
    await loaded;
    const doc = frame.contentDocument, win = frame.contentWindow;
    if (!doc || !win) throw new Error("PDF तयार करता आली नाही.");
    for (const style of Array.from(doc.querySelectorAll("style"))) {
      if (!style.sheet) throw new Error("PDFचे नियम लोड झाले नाहीत.");
      style.textContent = borrowerPrintCss(style.sheet.cssRules, query => win.matchMedia(query).matches);
    }
    doc.body.style.setProperty("margin", "0", "important");
    await Promise.all([400, 500, 600, 700].map(weight => doc.fonts.load(`${weight} 12px "Noto Sans Devanagari"`)));
    await doc.fonts.ready;
    await new Promise<void>(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve())));
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const width = 200 * 96 / 25.4;
    const capacity = 287 * 96 / 25.4;
    if (Array.from(doc.querySelectorAll<HTMLElement>(".pf-section")).some(section =>
      section.scrollHeight > section.clientHeight + 2 || section.scrollWidth > section.clientWidth + 2 ||
      (section.lastElementChild?.getBoundingClientRect().bottom ?? 0) > section.getBoundingClientRect().bottom - 3
    )) throw new Error("मजकूर A4 नमुन्याच्या जागेपेक्षा मोठा आहे. 2 पानांची मांडणी / स्वतंत्र फॉर्म निवडा किंवा मजकूर कमी करा.");
    const render = async (element: HTMLElement, y: number, height: number) => html2canvas(element, {
      scale: 3, useCORS: true, logging: false, backgroundColor: "#ffffff",
      width, height, y, scrollX: 0, scrollY: 0, windowWidth: 210 * 96 / 25.4,
    });
    let pageCount = 0;
    const addPage = () => { if (pageCount++) pdf.addPage("a4", "portrait"); };
    if (pageSelector) {
      const pages = Array.from(doc.querySelectorAll<HTMLElement>(pageSelector));
      if (!pages.length) throw new Error("PDFसाठी फॉर्म निवडा.");
      for (const page of pages) {
        const rect = page.getBoundingClientRect();
        if (rect.height > capacity + 2 || page.scrollHeight > capacity + 2 || page.scrollWidth > width + 2) {
          throw new Error("फॉर्म A4 पानात बसत नाही. दोन पानांची मांडणी निवडा किंवा मजकूर तपासा.");
        }
        const canvas = await render(page, rect.top + win.scrollY, Math.min(capacity, Math.ceil(rect.height)));
        addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 5, 5, 200, Math.min(287, canvas.height / canvas.width * 200));
        canvas.width = canvas.height = 0;
      }
    } else {
      const origin = doc.body.getBoundingClientRect().top;
      const height = Math.ceil(doc.body.getBoundingClientRect().height);
      const blocks = Array.from(doc.querySelectorAll<HTMLElement>("tr, .summary-document-closing, .summary-document-header, .summary-document-notes, .aso-header, .aso-key-totals, .aso-chart"))
        .map(node => { const rect = node.getBoundingClientRect(); return { top: rect.top - origin, bottom: rect.bottom - origin }; });
      const head = doc.querySelector("thead")?.getBoundingClientRect();
      const firstRow = doc.querySelector("tbody tr")?.getBoundingClientRect();
      if (head && firstRow) blocks.push({ top: head.top - origin, bottom: firstRow.bottom - origin });
      let start = 0;
      while (start < height) {
        const repeat = start > 0 && head && start >= head.bottom - origin ? head : null;
        const headerHeight = repeat ? Math.ceil(repeat.height) : 0;
        const end = pdfPageEnd(start, Math.floor(capacity) - headerHeight, height, blocks);
        addPage();
        if (repeat) {
          const canvas = await render(doc.body, repeat.top + win.scrollY, headerHeight);
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", 5, 5, 200, headerHeight / width * 200);
          canvas.width = canvas.height = 0;
        }
        const canvas = await render(doc.body, origin + start + win.scrollY, end - start);
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 5, 5 + headerHeight / width * 200, 200, canvas.height / canvas.width * 200);
        canvas.width = canvas.height = 0;
        start = end;
      }
    }
    if (!pageCount) throw new Error("PDFसाठी माहिती उपलब्ध नाही.");
    pdf.save(filename);
  } finally {
    frame.remove();
  }
}
