import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strip hidden system fingerprint from narration before showing to user.
 * Full narration (stored in DB): "कर्ज वितरण - खाते क्र. 99 Seema - मुद्दल: ₹10000 | तारण | सोने | 5g | 26/02/2026"
 * Display narration (shown to user): "कर्ज वितरण - खाते क्र. 99 Seema - मुद्दल: ₹10000"
 */
export function displayNarration(narration: string | undefined | null): string {
  if (!narration) return '';
  const pipeIndex = narration.indexOf(' | ');
  return pipeIndex !== -1 ? narration.substring(0, pipeIndex) : narration;
}
