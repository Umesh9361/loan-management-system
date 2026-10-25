/** Native print must not open before saved images have decoded. */
export async function waitForPrintImages(doc: Document) {
  await Promise.all(Array.from(doc.images).map(image => new Promise<void>((resolve, reject) => {
    const finish = () => { cleanup(); image.naturalWidth ? resolve() : reject(new Error("फॉर्ममधील फोटो उघडला नाही.")); };
    const fail = () => { cleanup(); reject(new Error("फॉर्ममधील फोटो उघडला नाही. पुन्हा प्रयत्न करा.")); };
    const cleanup = () => { window.clearTimeout(timer); image.removeEventListener("load", finish); image.removeEventListener("error", fail); };
    const timer = window.setTimeout(fail, 20000);
    if (image.complete) finish();
    else { image.addEventListener("load", finish, { once: true }); image.addEventListener("error", fail, { once: true }); }
  })));
}
