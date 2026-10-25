type PledgePrintPhotoOptionsProps = {
  includeBorrowerPhoto: boolean;
  includeCollateralPhotos: boolean;
  borrowerAvailable: boolean;
  collateralCount: number;
  disabled?: boolean;
  onChange: (patch: { includeBorrowerPhoto?: boolean; includeCollateralPhotos?: boolean }) => void;
};

export function PledgePrintPhotoOptions({
  includeBorrowerPhoto,
  includeCollateralPhotos,
  borrowerAvailable,
  collateralCount,
  disabled = false,
  onChange,
}: PledgePrintPhotoOptionsProps) {
  const safeCollateralCount = Number.isFinite(collateralCount) ? Math.max(0, Math.floor(collateralCount)) : 0;

  return (
    <section
      aria-labelledby="pledge-photo-options-heading"
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
    >
      <div className="min-w-0">
        <h2 id="pledge-photo-options-heading" className="text-sm font-semibold text-slate-900">
          प्रिंट / PDF मधील फोटो
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          फोटो लपवणे हा फक्त प्रिंट / PDF साठीचा पर्याय आहे; जतन केलेले फोटो हटवले जात नाहीत.
        </p>
      </div>

      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
        <PhotoToggle
          testId="pledge-photo-borrower"
          label="कर्जदाराचा फोटो"
          availability={borrowerAvailable ? "फोटो उपलब्ध" : "फोटो सध्या उपलब्ध नाही"}
          checked={includeBorrowerPhoto}
          disabled={disabled}
          onChange={checked => onChange({ includeBorrowerPhoto: checked })}
        />
        <PhotoToggle
          testId="pledge-photo-collateral"
          label="तारण वस्तूंचे फोटो"
          availability={`${safeCollateralCount} ${safeCollateralCount === 1 ? "फोटो उपलब्ध" : "फोटो उपलब्ध"}`}
          checked={includeCollateralPhotos}
          disabled={disabled}
          onChange={checked => onChange({ includeCollateralPhotos: checked })}
        />
      </div>
    </section>
  );
}

function PhotoToggle({
  testId,
  label,
  availability,
  checked,
  disabled,
  onChange,
}: {
  testId: string;
  label: string;
  availability: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label} — ${availability}`}
      data-testid={testId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-[60px] min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block break-words text-sm font-medium text-slate-800">{label}</span>
        <span className="mt-0.5 block break-words text-xs text-slate-500">{availability}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-slate-300"}`}
      >
        <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </span>
    </button>
  );
}
