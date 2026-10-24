import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getSelectedPledgeForms,
  PLEDGE_FORM_OPTIONS,
  type PledgeFormChoice,
  type PledgeFormKey,
} from "@/lib/pledge-forms";

type PledgeFormSelectorProps = {
  value: PledgeFormChoice;
  onChange: (value: PledgeFormChoice) => void;
  disabled?: boolean;
};

const formOptions = PLEDGE_FORM_OPTIONS.filter(
  (option): option is { value: PledgeFormKey; label: string } => option.value !== "all",
);

type SelectorMode = "all" | "single" | "multiple";

function modeFor(value: PledgeFormChoice): SelectorMode {
  if (Array.isArray(value)) return "multiple";
  return value === "all" ? "all" : "single";
}

export function PledgeFormSelector({
  value,
  onChange,
  disabled = false,
}: PledgeFormSelectorProps) {
  const selected = getSelectedPledgeForms(value);
  const mode = modeFor(value);
  const singleValue = typeof value === "string" && value !== "all" ? value : selected[0] ?? "loan";

  const setMode = (nextMode: SelectorMode) => {
    if (nextMode === "all") {
      onChange("all");
    } else if (nextMode === "single") {
      onChange(singleValue);
    } else {
      onChange(Array.isArray(value) ? value : [...selected]);
    }
  };

  const toggleForm = (key: PledgeFormKey, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    onChange(formOptions.map((option) => option.value).filter((form) => next.has(form)));
  };

  const selectAllCustom = () => onChange(formOptions.map((option) => option.value));
  const clearCustom = () => onChange([]);

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-semibold text-slate-900">फॉर्म निवड</legend>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        सर्व नमुने, एक स्वतंत्र फॉर्म किंवा हवे ते अनेक फॉर्म निवडा.
      </p>

      <div
        role="group"
        aria-label="फॉर्म निवडीचा प्रकार"
        className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1"
      >
        {([
          ["all", "सर्व"],
          ["single", "एक"],
          ["multiple", "अनेक"],
        ] as const).map(([key, label]) => {
          const active = mode === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => setMode(key)}
              className={[
                "min-h-10 min-w-0 rounded-md px-2 py-2 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1",
                active
                  ? "bg-white text-indigo-900 shadow-sm"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
                disabled ? "cursor-not-allowed opacity-55" : "",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {mode === "all" && (
        <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-3">
          <p className="text-sm font-semibold text-indigo-950">सर्व सहा नमुने</p>
          <p className="mt-1 text-xs leading-5 text-indigo-900/80">
            पूर्ण फॉर्म संच एकाच पूर्वदृश्यात, छपाईत किंवा PDF मध्ये.
          </p>
        </div>
      )}

      {mode === "single" && (
        <div className="mt-3 min-w-0 space-y-2">
          <label htmlFor="form-selection" className="block text-sm font-medium text-slate-800">
            स्वतंत्र फॉर्म
          </label>
          <Select
            value={singleValue}
            onValueChange={(next) => onChange(next as PledgeFormKey)}
            disabled={disabled}
          >
            <SelectTrigger
              id="form-selection"
              className="h-auto min-h-10 min-w-0 whitespace-normal text-left"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="whitespace-normal">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs leading-relaxed text-slate-500">
            निवडलेला नमुना स्वतंत्रपणे पूर्वदृश्य, छापता किंवा PDF म्हणून जतन करता येईल.
          </p>
        </div>
      )}

      {mode === "multiple" && (
        <div className="mt-3 min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-slate-800">नमुने निवडा</p>
            <span aria-live="polite" className="text-xs font-semibold tabular-nums text-slate-600">
              {String(selected.length)} / {String(formOptions.length)} निवडले
            </span>
          </div>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {formOptions.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={[
                    "flex min-h-11 min-w-0 cursor-pointer items-start gap-3 px-3 py-2.5",
                    "first:rounded-t-lg last:rounded-b-lg hover:bg-slate-50",
                    "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo-600",
                    disabled ? "cursor-not-allowed opacity-60" : "",
                    checked ? "bg-indigo-50/50" : "",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => toggleForm(option.value, event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-700 focus-visible:outline-none"
                  />
                  <span className="min-w-0 break-words text-sm leading-5 text-slate-800">
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={selectAllCustom}
              className="min-h-9 rounded-md px-2 text-xs font-semibold text-indigo-800 underline decoration-indigo-300 underline-offset-2 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              सर्व निवडा
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={clearCustom}
              className="min-h-9 rounded-md px-2 text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              निवड पुसा
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            फॉर्म ठरलेल्या क्रमाने येतील. एकही फॉर्म निवडलेला नसेल तर प्रिंट आणि PDF उपलब्ध होणार नाहीत.
          </p>
        </div>
      )}
    </fieldset>
  );
}
