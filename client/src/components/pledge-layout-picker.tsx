import { useId } from "react";
import { getSelectedPledgeForms, getPledgePageGroups, type PledgeFormChoice } from "@/lib/pledge-forms";

export type PledgeLayout = "compact" | "spacious";

type PledgeLayoutPickerProps = {
  value: PledgeLayout;
  onChange: (value: PledgeLayout) => void;
  disabled?: boolean;
  selection: PledgeFormChoice;
};

const layouts: {
  value: PledgeLayout;
  label: string;
  description: string;
  pages: number;
  formsPerPage: number;
}[] = [
  {
    value: "compact",
    label: "1 पान — संक्षिप्त",
    description: "सहा कट-आउट फॉर्म एका A4 पानावर.",
    pages: 1,
    formsPerPage: 6,
  },
  {
    value: "spacious",
    label: "2 पाने — मोकळी मांडणी",
    description: "मोठा मजकूर आणि कापण्यासाठी अधिक जागा; प्रत्येक पानावर 3 फॉर्म.",
    pages: 2,
    formsPerPage: 3,
  },
];

function PagePreview({ pages, formsPerPage }: { pages: number; formsPerPage: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: pages }, (_, pageIndex) => (
        <div
          key={pageIndex}
          className="flex h-[54px] w-[39px] flex-col gap-[3px] rounded-[3px] border border-slate-300 bg-white p-[5px] shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
        >
          {Array.from({ length: formsPerPage }, (_, formIndex) => (
            <span
              key={formIndex}
              className="min-h-0 flex-1 rounded-[1px] border border-dashed border-indigo-200 bg-indigo-50/70"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PledgeLayoutPicker({
  value,
  onChange,
  disabled = false,
  selection,
}: PledgeLayoutPickerProps) {
  const radioName = useId();
  const selectedCount = getSelectedPledgeForms(selection).length;
  const isFullSheet = selectedCount === 6;

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-semibold text-slate-900">पानांची मांडणी</legend>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        {isFullSheet
          ? "सहा फॉर्मची पूर्ण शीट कशी छापायची ते निवडा."
          : "स्वतंत्र फॉर्मसाठी मांडणी निवडा."}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {layouts.map((layout) => {
          const checked = value === layout.value;
          const pageCount = getPledgePageGroups(selection, layout.value).length;
          return (
            <label
              key={layout.value}
              className={[
                "relative flex min-h-[102px] cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                "focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2",
                disabled ? "cursor-not-allowed opacity-60" : "",
                checked
                  ? "border-indigo-500 bg-indigo-50/70 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.12)]"
                  : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50",
              ].join(" ")}
            >
              <input
                type="radio"
                name={radioName}
                value={layout.value}
                checked={checked}
                onChange={() => onChange(layout.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={[
                  "absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full border",
                  checked ? "border-indigo-600" : "border-slate-300",
                ].join(" ")}
              >
                {checked && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
              </span>
              <PagePreview pages={Math.max(1, pageCount)} formsPerPage={Math.max(1, Math.min(layout.formsPerPage, selectedCount))} />
              <span className="min-w-0 pr-4">
                <span className="block text-sm font-semibold leading-5 text-slate-900">
                  {layout.value === "spacious" && pageCount <= 1 ? "1 पान — मोकळी मांडणी" : layout.label}
                </span>
                <span className="mt-1 block text-xs leading-[1.15rem] text-slate-600">
                  {isFullSheet ? layout.description : layout.value === "compact" ? "निवडलेले फॉर्म एका A4 पानावर." : "मोठी अक्षरे; पूर्ण फॉर्म उपलब्ध जागेनुसार पानावर बसतील."}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {selectedCount === 1 && (
        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          स्वतंत्र निवडलेला फॉर्म एका पानावरच राहील. “मोकळी मांडणी”मध्ये अक्षरे मोठी होतील; दुसरे रिकामे पान जोडले जाणार नाही.
        </p>
      )}
    </fieldset>
  );
}
