import { pdfPageEnd } from "./print-document-pdf";

// Keep the existing A5 notice format. A long edited notice must never be clipped.
async function withNoticeDocument<T>(html: string, action: (node: HTMLElement, doc: Document, render: (top: number, height: number) => Promise<HTMLCanvasElement>) => Promise<T>) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:560px;height:794px;border:0";
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    const style = doc.createElement("style");
    style.textContent = "html,body{width:560px!important;margin:0!important;padding:0!important;background:white!important}.notice-container{width:560px!important;max-width:560px!important;height:auto!important;min-height:794px!important;padding:144px 45px 45px 57px!important;overflow:visible!important;overflow-wrap:anywhere!important;box-shadow:none!important;margin:0!important;font-size:12px!important;line-height:1.8!important}";
    doc.head.appendChild(style);
    await doc.fonts.ready;
    await new Promise<void>(resolve => frame.contentWindow!.requestAnimationFrame(() => resolve()));
    const node = doc.querySelector<HTMLElement>(".notice-container");
    if (!node) throw new Error("नोटीस सापडली नाही.");
    const { default: html2canvas } = await import("html2canvas");
    return await action(node, doc, (top, height) => html2canvas(node, {
      scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false,
      width: 560, height, y: top, windowWidth: 560, windowHeight: 794, scrollX: 0, scrollY: 0,
    }));
  } finally { frame.remove(); }
}
export async function downloadNoticePdf(html: string, filename: string) {
  return withNoticeDocument(html, async (node, doc, render) => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait", compress: true });
    const height = Math.ceil(node.getBoundingClientRect().height);
    const capacity = Math.floor(560 * 210 / 148);
    const origin = node.getBoundingClientRect().top;
    const blocks: Array<{ top: number; bottom: number }> = [];
    for (const element of Array.from(node.querySelectorAll("p,.notice-title,.notice-date,.notice-to,.notice-subject,.notice-signature"))) {
      const rect = element.getBoundingClientRect();
      if (rect.height < capacity) blocks.push({ top: rect.top - origin, bottom: rect.bottom - origin });
    }
    // Very long paragraphs can span pages, but individual text lines cannot.
    const walker = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const range = doc.createRange();
      range.selectNodeContents(walker.currentNode);
      for (const rect of Array.from(range.getClientRects())) if (rect.height > 0) {
        blocks.push({ top: rect.top - origin, bottom: rect.bottom - origin });
      }
    }
    let start = 0, pages = 0;
    while (start < height) {
      const end = pdfPageEnd(start, capacity, height, blocks);
      const canvas = await render(start, Math.ceil(end - start));
      if (pages++) pdf.addPage("a5", "portrait");
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 148, canvas.height / canvas.width * 148);
      canvas.width = canvas.height = 0;
      start = end;
    }
    pdf.save(filename);
    return { pages };
  });
}
export async function noticeImageData(html: string) {
  return withNoticeDocument(html, async (node, _doc, render) => {
    const canvas = await render(0, Math.ceil(node.getBoundingClientRect().height));
    const data = canvas.toDataURL("image/png");
    canvas.width = canvas.height = 0;
    return data;
  });
}
