import { LoanCalculationsAdvanced } from "./loan-calculations";
import { uiText } from "@shared/ui-language";

/** Display-only calendar period, using the same date breakdown as the closure form. */
export function overdueDurationParts({ loanDate, daysOverdue }: { loanDate: string; daysOverdue: number }): string[] {
  const date = loanDate.slice(0, 10);
  const startUtc = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(startUtc.getTime()) ||
      startUtc.toISOString().slice(0, 10) !== date || !Number.isSafeInteger(daysOverdue) || daysOverdue < 0) {
    throw new Error("खात्याची तारीख किंवा कालावधी अवैध आहे. माहिती तपासून पुन्हा रिपोर्ट तयार करा.");
  }
  // The API's elapsed days already include the chosen current/future projection.
  // Reconstruct calendar dates in UTC before calling the closure calculator at
  // local noon, avoiding DST and browser/server timezone changes in the dates.
  const endUtc = new Date(startUtc);
  endUtc.setUTCDate(endUtc.getUTCDate() + daysOverdue);
  if (!Number.isFinite(endUtc.getTime())) throw new Error("खात्याचा कालावधी अवैध आहे.");
  const start = new Date(`${date}T12:00:00`);
  const end = new Date(`${endUtc.toISOString().slice(0, 10)}T12:00:00`);
  const { calendarYears: years, calendarMonths: months, calendarDays: days } =
    LoanCalculationsAdvanced.calculateTimePeriod(start, end);
  const monthPart = `${months} ${uiText(months === 1 ? "महिना" : "महिने")}`;
  if (years > 0) return [`${years} ${uiText(years === 1 ? "वर्ष" : "वर्षे")}`, ...(months > 0 ? [monthPart] : [])];
  const parts = [...(months > 0 ? [monthPart] : []), ...(days > 0 ? [`${days} ${uiText("दिवस")}`] : [])];
  return parts.length ? parts : [uiText("0 दिवस")];
}
