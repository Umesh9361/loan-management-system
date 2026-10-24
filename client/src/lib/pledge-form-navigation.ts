import { PLEDGE_FORM_OPTIONS, type PledgeFormSelection } from "./pledge-forms";

/** Only recognized form keys and the registration-free mode may initialize this page. */
export function getPledgeFormEntry(search: string): { selection: PledgeFormSelection; mode: "blank" | "manual" } {
  const query = new URLSearchParams(search);
  const requested = query.get("form");
  return {
    selection: PLEDGE_FORM_OPTIONS.find(option => option.value === requested)?.value || "all",
    mode: query.get("mode") === "manual" ? "manual" : "blank",
  };
}
