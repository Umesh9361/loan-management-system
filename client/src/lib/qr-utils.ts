const QR_PREFIX = "LMS:";

export function encodeQrData(loanId: string): string {
  const reversed = loanId.split('').reverse().join('');
  return QR_PREFIX + btoa(reversed);
}

export function decodeQrData(scannedText: string): string | null {
  if (scannedText.startsWith(QR_PREFIX)) {
    try {
      const encoded = scannedText.slice(QR_PREFIX.length);
      const reversed = atob(encoded);
      return reversed.split('').reverse().join('');
    } catch {
      return null;
    }
  }

  try {
    const url = new URL(scannedText);
    const match = url.pathname.match(/^\/qr\/([a-zA-Z0-9\-]+)$/);
    if (match) return match[1];
  } catch {}

  return null;
}
