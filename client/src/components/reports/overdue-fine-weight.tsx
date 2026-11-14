import React from "react";
import { formatWeight } from "@shared/report-weights";

/** The API already calculates fine grams using the purity applied to this loan. */
export function OverdueFineWeight({ weight }: { weight: number }) {
  return <span className="block font-semibold">{Number.isFinite(weight) ? formatWeight(weight) : "—"}</span>;
}
