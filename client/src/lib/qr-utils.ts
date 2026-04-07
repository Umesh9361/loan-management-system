const QR_PREFIX = "LMS:";

export function encodeQrData(loanId: string): string {
  const reversed = loanId.split('').reverse().join('');
  return QR_PREFIX + btoa(reversed);
}

export function encodeMultiQrData(loanIds: string[]): string {
  const joined = loanIds.join(',');
  const reversed = joined.split('').reverse().join('');
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

export function decodeQrLoanIds(scannedText: string): string[] | null {
  const decoded = decodeQrData(scannedText);
  if (!decoded) return null;
  if (decoded.includes(',')) {
    const ids = decoded.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return ids.length > 0 ? ids : null;
  }
  return decoded.length > 0 ? [decoded] : null;
}
