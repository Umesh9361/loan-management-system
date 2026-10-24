import { useState, type ReactNode } from "react";
import { Bold, Check, Printer, RotateCcw, Bluetooth, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReceiptFieldSetting, ReceiptPrintSettings } from "@/lib/receipt-print-settings";

type Mode = "standard" | "thermal";
type StandardKey = keyof ReceiptPrintSettings["standard"];
type ThermalKey =
  | "name"
  | "date"
  | "title"
  | "hdrSerial"
  | "hdrAccount"
  | "hdrDate"
  | "hdrPrincipal"
  | "hdrCharges"
  | "colSerial"
  | "colAccount"
  | "colDate"
  | "colRate"
  | "colDetails"
  | "colMonths"
  | "colPrincipal"
  | "colCharges"
  | "total"
  | "grandTotal";

interface FieldDefinition<K extends string> {
  key: K;
  label: string;
}

const standardFields: FieldDefinition<StandardKey>[] = [
  { key: "name", label: "नाव" },
  { key: "date", label: "तारीख" },
  { key: "title", label: "शीर्षक (Estimate)" },
  { key: "tableHeader", label: "टेबल हेडर" },
  { key: "tableData", label: "टेबल डेटा" },
  { key: "total", label: "एकूण" },
  { key: "grandTotal", label: "Grand Total" },
];

const thermalSections: { title: string; fields: FieldDefinition<ThermalKey>[] }[] = [
  {
    title: "पावतीवरील मजकूर",
    fields: [
      { key: "name", label: "नाव" },
      { key: "date", label: "तारीख" },
      { key: "title", label: "शीर्षक (Estimate)" },
    ],
  },
  {
    title: "टेबल हेडर",
    fields: [
      { key: "hdrSerial", label: "अ.नं. — हेडर" },
      { key: "hdrAccount", label: "कोड नं. — हेडर" },
      { key: "hdrDate", label: "दिनांक — हेडर" },
      { key: "hdrPrincipal", label: "बाजारमूल्य — हेडर" },
      { key: "hdrCharges", label: "चार्जेस — हेडर" },
    ],
  },
  {
    title: "टेबलमधील माहिती",
    fields: [
      { key: "colSerial", label: "अ.नं. — डेटा" },
      { key: "colAccount", label: "कोड नं. — डेटा" },
      { key: "colDate", label: "दिनांक — डेटा" },
      { key: "colRate", label: "व्याजदर — डेटा" },
      { key: "colDetails", label: "तपशील — डेटा" },
      { key: "colMonths", label: "महिने — डेटा" },
      { key: "colPrincipal", label: "बाजारमूल्य — डेटा" },
      { key: "colCharges", label: "चार्जेस — डेटा" },
    ],
  },
  {
    title: "एकूण रक्कम",
    fields: [
      { key: "total", label: "एकूण" },
      { key: "grandTotal", label: "Grand Total" },
    ],
  },
];

interface ReceiptPrintSettingsEditorProps {
  settings: ReceiptPrintSettings;
  onChange: (updater: (previous: ReceiptPrintSettings) => ReceiptPrintSettings) => void;
  onReset: () => void;
}

export function ReceiptPrintSettingsEditor({
  settings,
  onChange,
  onReset,
}: ReceiptPrintSettingsEditorProps) {
  const [mode, setMode] = useState<Mode>("thermal");

  const updateField = (field: StandardKey | ThermalKey, patch: Partial<ReceiptFieldSetting>) => {
    onChange((previous) => ({
      ...previous,
      [mode]: {
        ...previous[mode],
        [field]: {
          ...(previous[mode][field as keyof typeof previous[typeof mode]] as ReceiptFieldSetting),
          ...patch,
        },
      },
    }));
  };

  const resetSettings = () => {
    const confirmed = window.confirm(
      "सामान्य आणि थर्मल/ब्लूटूथ पावतीची सर्व अक्षर-आकार, बोल्ड आणि QR कोड सेटिंग्ज डीफॉल्टवर आणायची आहेत का? हा बदल या ब्राउझर/डिव्हाइसवरील सेव्ह केलेल्या सेटिंग्जवर लागू होईल.",
    );
    if (confirmed) onReset();
  };

  const renderField = (field: FieldDefinition<StandardKey | ThermalKey>) => {
    const value = settings[mode][field.key as keyof typeof settings[typeof mode]] as ReceiptFieldSetting;
    return (
      <div
        key={field.key}
        className="grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 py-2 last:border-b-0"
      >
        <span className="min-w-0 whitespace-normal break-words text-sm font-medium leading-5 text-slate-700">
          {field.label}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <div className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              aria-label={`${field.label}: अक्षर लहान करा`}
              disabled={value.fontSize <= 6}
              onClick={() => updateField(field.key, { fontSize: Math.max(6, value.fontSize - 1) })}
              className="h-9 w-9 rounded-md text-lg font-medium text-slate-600 transition-colors hover:bg-white hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <span
              className="w-8 text-center font-mono text-xs font-semibold tabular-nums text-slate-800"
              aria-label={`अक्षर आकार ${value.fontSize}`}
            >
              {value.fontSize}
            </span>
            <button
              type="button"
              aria-label={`${field.label}: अक्षर मोठे करा`}
              disabled={value.fontSize >= 50}
              onClick={() => updateField(field.key, { fontSize: Math.min(50, value.fontSize + 1) })}
              className="h-9 w-9 rounded-md text-lg font-medium text-slate-600 transition-colors hover:bg-white hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            aria-label={`${field.label}: ${value.bold ? "बोल्ड बंद करा" : "बोल्ड करा"}`}
            aria-pressed={value.bold}
            onClick={() => updateField(field.key, { bold: !value.bold })}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              value.bold
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Bold className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Printer className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">पावती प्रिंट सेटिंग्ज</h2>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              या ब्राउझर आणि डिव्हाइसवर आपोआप सेव्ह होते; सर्व्हर किंवा क्लाउडवर नाही.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetSettings}
          className="min-h-10 w-full shrink-0 gap-2 border-slate-300 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 sm:w-auto"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          डीफॉल्टवर आणा
        </Button>
      </header>

      <div className="p-4">
        <div
          className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
          role="tablist"
          aria-label="पावतीचा प्रकार"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "thermal"}
            onClick={() => setMode("thermal")}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              mode === "thermal" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Bluetooth className="h-4 w-4" aria-hidden="true" />
            थर्मल / ब्लूटूथ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "standard"}
            onClick={() => setMode("standard")}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              mode === "standard" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            सामान्य पावती
          </button>
        </div>

        {mode === "standard" ? (
          <div role="tabpanel" aria-label="सामान्य पावती सेटिंग्ज">
            <SectionHeading icon={<Type className="h-4 w-4" aria-hidden="true" />} title="सामान्य प्रिंट" />
            <div className="divide-y divide-slate-100">{standardFields.map(renderField)}</div>
          </div>
        ) : (
          <div role="tabpanel" aria-label="थर्मल आणि ब्लूटूथ पावती सेटिंग्ज" className="space-y-5">
            <div className="flex min-h-[60px] items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">QR कोड दाखवा</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">थर्मल पावतीवर QR कोड छापा</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!settings.thermal.showQrCode}
                aria-label="थर्मल पावतीवर QR कोड दाखवा"
                onClick={() =>
                  onChange((previous) => ({
                    ...previous,
                    thermal: { ...previous.thermal, showQrCode: !previous.thermal.showQrCode },
                  }))
                }
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                  settings.thermal.showQrCode ? "bg-indigo-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
                    settings.thermal.showQrCode ? "translate-x-5" : "translate-x-0"
                  }`}
                >
                  {settings.thermal.showQrCode && <Check className="h-3 w-3 text-indigo-700" aria-hidden="true" />}
                </span>
              </button>
            </div>
            {thermalSections.map((section) => (
              <section key={section.title} aria-label={section.title}>
                <SectionHeading icon={<Type className="h-4 w-4" aria-hidden="true" />} title={section.title} />
                <div className="divide-y divide-slate-100">{section.fields.map(renderField)}</div>
              </section>
            ))}
          </div>
        )}

        <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
          अक्षर आकार 6 ते 50 दरम्यान बदला. बोल्ड बटण निवडल्यास त्या मजकुराची छपाई ठळक होईल.
        </p>
      </div>
    </section>
  );
}

function SectionHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h3 className="mb-1 flex items-center gap-2 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-800">
      <span className="text-indigo-600">{icon}</span>
      {title}
    </h3>
  );
}
