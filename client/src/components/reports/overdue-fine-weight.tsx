import React from "react";
import { formatWeight } from "@shared/report-weights";

/** The API already calculates fine grams using the purity applied to this loan. */
export function OverdueFineWeight({ weight, purity }: { weight: number; purity?: number }) {
  return <>
    <span className="block font-semibold">{Number.isFinite(weight) ? `${formatWeight(weight)} ग्रॅम` : "—"}</span>
    {purity !== undefined && <span className="block text-[11px] font-normal text-gray-500">({purity}%)</span>}
  </>;
}
