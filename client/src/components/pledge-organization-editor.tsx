import { RotateCcw, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PledgeOrganizationData } from "@shared/pledge-form-editor";

type Props = {
  data: PledgeOrganizationData;
  onChange: (patch: Partial<PledgeOrganizationData>) => void;
  onReset: () => void;
  loading?: boolean;
  profileUnavailable?: boolean;
};

const fields: {
  key: keyof PledgeOrganizationData;
  id: string;
  label: string;
  maxLength: number;
  inputMode?: "tel";
}[] = [
  { key: "company", id: "pledge-company", label: "संस्था / फर्मचे नाव", maxLength: 160 },
  { key: "companyAddress", id: "pledge-companyAddress", label: "पत्ता", maxLength: 240 },
  { key: "companyContactNumber", id: "pledge-companyContactNumber", label: "संपर्क क्रमांक", maxLength: 60, inputMode: "tel" },
  { key: "companyLicenseNumber", id: "pledge-companyLicenseNumber", label: "परवाना क्रमांक", maxLength: 80 },
];

export function PledgeOrganizationEditor({
  data,
  onChange,
  onReset,
  loading = false,
  profileUnavailable = false,
}: Props) {
  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm"
      aria-labelledby="pledge-organization-heading"
    >
      <header className="border-b border-indigo-100 bg-indigo-50/70 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Store className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="pledge-organization-heading" className="text-base font-semibold text-indigo-950">
              संस्थेची माहिती
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              ही माहिती प्रत्येक पावतीवर दिसेल. येथील बदल फक्त या पावतीसाठी आहेत; प्रोफाइल बदलत नाही.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-3 p-4">
        {fields.map(field => (
          <div key={field.key} className="min-w-0">
            <Label htmlFor={field.id} className="mb-1.5 block text-xs leading-5 text-slate-700">
              {field.label}
            </Label>
            <Input
              id={field.id}
              value={data[field.key] || ""}
              onChange={event => onChange({ [field.key]: event.target.value })}
              maxLength={field.maxLength}
              inputMode={field.inputMode}
              className="h-10 min-w-0 border-indigo-200 bg-white transition-colors focus-visible:border-indigo-500 focus-visible:ring-indigo-500"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          disabled={loading || profileUnavailable}
          className="min-h-10 w-full justify-start gap-2 whitespace-normal border-indigo-200 text-indigo-800 transition-colors hover:bg-indigo-50 focus-visible:ring-indigo-500"
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
          प्रोफाइलमधील माहिती वापरा
        </Button>
        {profileUnavailable && (
          <p className="text-xs leading-5 text-amber-800" role="status">
            प्रोफाइलमधील माहिती उपलब्ध नाही; येथे माहिती टाइप करून वापरू शकता.
          </p>
        )}
      </div>
    </section>
  );
}
