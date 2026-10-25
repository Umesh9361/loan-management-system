import { useMemo } from "react";
import { RotateCcw, Save, SlidersHorizontal, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PLEDGE_FIELD_GROUPS,
  PLEDGE_MATTER_GROUPS,
  emptyPledgeItems,
  DEFAULT_PLEDGE_MATTER,
  type PledgeFormData,
  type PledgeFormMatter,
  type PledgeItem,
} from "@shared/pledge-form-editor";
import { getSelectedPledgeForms, type PledgeFormChoice } from "@/lib/pledge-forms";

type Props = {
  data: PledgeFormData;
  onChange: (patch: Partial<PledgeFormData>) => void;
  selection: PledgeFormChoice;
  matter: PledgeFormMatter;
  onMatterChange: (key: keyof PledgeFormMatter, value: string) => void;
  onUseSaved: () => void;
  onUseOriginal: () => void;
  onSaveDefault: () => void;
  onResetDefault: () => void;
  canSaveDefault: boolean;
  busy: boolean;
  blankMode: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
};

const selected = (forms: readonly string[], selection: PledgeFormChoice) =>
  getSelectedPledgeForms(selection).some(form => forms.includes(form));

const fieldInput = (type: string) =>
  type === "date" ? "date" : type === "number" ? "number" : "text";

export function PledgeFormEditor({
  data,
  onChange,
  selection,
  matter,
  onMatterChange,
  onUseSaved,
  onUseOriginal,
  onSaveDefault,
  onResetDefault,
  canSaveDefault,
  busy,
  blankMode,
  editing = true,
  onEditingChange,
}: Props) {
  const visibleFieldGroups = useMemo(
    () => PLEDGE_FIELD_GROUPS.filter(group => selected(group.forms, selection)),
    [selection],
  );
  const visibleMatterGroups = useMemo(
    () => PLEDGE_MATTER_GROUPS.filter(group => selected([group.form], selection)),
    [selection],
  );

  const changeField = (key: keyof PledgeFormData, value: string) => onChange({ [key]: value });
  const updateItem = (key: "loanItems" | "saleItems", index: number, field: keyof PledgeItem, value: string) => {
    const rows = data[key]?.length ? [...data[key]!] : emptyPledgeItems();
    rows[index] = { ...rows[index], [field]: value };
    onChange({ [key]: rows });
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="फॉर्म मजकूर संपादन">
      <header className="border-b border-slate-200 bg-slate-50/80 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">फॉर्ममध्ये भरण्याची माहिती</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                निवडलेल्या फॉर्मचे तपशील भरा आणि गरज असल्यास मजकूर बदला.
              </p>
            </div>
          </div>
          {onEditingChange && (
            <Button
              type="button"
              variant={editing ? "default" : "outline"}
              data-testid="pledge-edit-toggle"
              aria-pressed={editing}
              disabled={busy || blankMode}
              onClick={() => onEditingChange(!editing)}
              className={`min-h-10 w-full shrink-0 whitespace-normal sm:w-auto ${editing ? "bg-indigo-600 text-white hover:bg-indigo-700" : "border-indigo-300 text-indigo-800 hover:bg-indigo-50"}`}
            >
              {editing ? "संपादन पूर्ण" : "माहिती संपादित करा"}
            </Button>
          )}
        </div>
        <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
          येथे केलेले बदल फक्त या फॉर्म / प्रिंटसाठी आहेत. मूळ कर्ज नोंदीत कोणताही बदल होत नाही.
        </p>
        {blankMode && (
          <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm leading-5 text-indigo-950">
            कोऱ्या फॉर्ममध्ये तपशील रिकामे राहतील. भरायचे असल्यास “टाइप करून भरा” किंवा “कर्जदार निवडा” निवडा. फॉर्मवरील मजकूर बदलता येईल.
          </div>
        )}
      </header>

      <div className="space-y-4 p-4">
        {visibleFieldGroups.map((group, groupIndex) => (
          <details key={group.title} open={(editing && !blankMode) || groupIndex === 0} className="group min-w-0 rounded-lg border border-slate-200">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">{group.title}</span>
              <span className="shrink-0 text-xs font-medium text-slate-500">{group.fields.length} तपशील</span>
            </summary>
            <div className="grid min-w-0 gap-3 border-t border-slate-100 p-3 sm:grid-cols-2">
              {group.fields.map(field => (
                <div key={field.key} className="min-w-0">
                  <Label htmlFor={`pledge-field-${field.key}`} className="mb-1.5 block whitespace-normal text-xs leading-5 text-slate-700">
                    {field.label}
                  </Label>
                  <Input
                    id={`pledge-field-${field.key}`}
                    data-testid={`pledge-field-${field.key}`}
                    type={fieldInput(field.type)}
                    inputMode={field.type === "money" || field.type === "number" ? "decimal" : undefined}
                    value={data[field.key] || ""}
                    onChange={event => changeField(field.key, event.target.value)}
                    disabled={blankMode || busy || !editing}
                    className="h-10 min-w-0 border-slate-300 bg-white"
                  />
                </div>
              ))}
            </div>
          </details>
        ))}

      {selected(["loan"], selection) && (
          <ItemRows
            title="तारण वस्तू"
            testId="pledge-loan-items"
            items={data.loanItems?.length ? data.loanItems : emptyPledgeItems()}
            disabled={blankMode || busy || !editing}
            defaultOpen={editing}
            onChange={(index, field, value) => updateItem("loanItems", index, field, value)}
          />
        )}
      {selected(["disposal"], selection) && (
          <ItemRows
            title="विक्री / निपटारा वस्तू"
            testId="pledge-sale-items"
            items={data.saleItems?.length ? data.saleItems : emptyPledgeItems()}
            disabled={blankMode || busy || !editing}
            defaultOpen={editing}
            onChange={(index, field, value) => updateItem("saleItems", index, field, value)}
          />
        )}

        <section className="min-w-0 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3" aria-labelledby="pledge-matter-heading">
          <div className="mb-3">
            <h3 id="pledge-matter-heading" className="text-sm font-semibold text-slate-900">फॉर्मवरील मजकूर</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">बदल सध्या तात्पुरते आहेत. कंपनीचा डीफॉल्ट बदलण्यासाठी “डीफॉल्ट जतन करा” निवडा.</p>
          </div>
          <div className="space-y-2">
            {visibleMatterGroups.map(group => (
              <details key={group.form} className="group min-w-0 rounded-lg border border-indigo-100 bg-white">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-indigo-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">{group.title}</span>
                  <span className="shrink-0 text-xs font-medium text-slate-500">{group.keys.length} मजकूर</span>
                </summary>
                <div className="grid min-w-0 gap-3 border-t border-slate-100 p-3">
                  {group.keys.map(field => {
                    const multiline = !field.key.endsWith("Title");
                    return (
                      <div key={field.key} className="min-w-0">
                        <Label htmlFor={`pledge-matter-${field.key}`} className="mb-1.5 block text-xs leading-5 text-slate-700">{field.label}</Label>
                        {multiline ? (
                          <textarea
                            id={`pledge-matter-${field.key}`}
                            data-testid={`pledge-matter-${field.key}`}
                            value={matter[field.key]}
                            onChange={event => onMatterChange(field.key, event.target.value)}
                             disabled={busy || !editing}
                            rows={Math.min(5, Math.max(2, Math.ceil(matter[field.key].length / 95)))}
                            className="block min-h-20 w-full min-w-0 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        ) : (
                          <Input
                            id={`pledge-matter-${field.key}`}
                            data-testid={`pledge-matter-${field.key}`}
                            value={matter[field.key]}
                            onChange={event => onMatterChange(field.key, event.target.value)}
                             disabled={busy || !editing}
                            maxLength={140}
                            className="h-10 min-w-0 border-slate-300"
                          />
                        )}
                      </div>
                    );
                  })}
                  {group.form === "receipt" && (
                    <Button type="button" variant="outline" disabled={busy}
                      data-testid="pledge-use-release-undertaking"
                      className="h-auto whitespace-normal py-2 text-left"
                      onClick={() => {
                        if (window.confirm("फक्त वस्तू तपासणी व स्वीकृतीचा मजकूर नवीन नमुन्याने बदलायचा? इतर मजकूर व भरलेली माहिती कायम राहील. संस्थेचा डिफॉल्ट बदलण्यासाठी नंतर स्वतंत्रपणे जतन करा.")) {
                          onMatterChange("releaseText", DEFAULT_PLEDGE_MATTER.releaseText);
                        }
                      }}>
                      तपासणी व स्वीकृतीचा नवीन नमुना वापरा
                    </Button>
                  )}
                </div>
              </details>
            ))}
          </div>
          <p className="mt-3 rounded-md bg-white/80 px-3 py-2 text-xs leading-5 text-slate-600">
            मजकुरातील {"{{loanDate}}"}, {"{{noticeDate}}"} आणि {"{{finalNoticeDate}}"} तसेच ठेवा; प्रिंटमध्ये संबंधित तारखा दिसतील.
          </p>
        </section>

        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={onUseSaved} disabled={busy} className="min-h-10 justify-start gap-2 border-slate-300 text-slate-700">
              <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              जतन केलेला मजकूर वापरा
            </Button>
            <Button type="button" variant="outline" onClick={onUseOriginal} disabled={busy} className="min-h-10 justify-start gap-2 border-slate-300 text-slate-700">
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
              मूळ मजकूर तात्पुरता वापरा
            </Button>
          </div>
          {canSaveDefault ? (
            <div className="rounded-lg border border-indigo-200 bg-white p-3">
              <p className="mb-2 text-xs leading-5 text-slate-600">कंपनीचा डीफॉल्ट बदलण्यासाठी स्वतंत्रपणे जतन करा. फक्त फॉर्मचा मजकूर जतन होतो; कर्जदार किंवा व्यवहाराची माहिती नाही.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" onClick={onSaveDefault} disabled={busy} className="min-h-10 gap-2 bg-indigo-600 text-white hover:bg-indigo-700">
                  <Save className="h-4 w-4" aria-hidden="true" /> डीफॉल्ट जतन करा
                </Button>
                <Button type="button" variant="outline" onClick={onResetDefault} disabled={busy} className="min-h-10 gap-2 border-rose-200 text-rose-700 hover:bg-rose-50">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> कंपनीचा डीफॉल्ट मूळ करा
                </Button>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
              कंपनीचा डीफॉल्ट जतन किंवा मूळ करण्याचा अधिकार फक्त कंपनी प्रशासकाला आहे. आपण मजकूर तात्पुरता संपादित करू शकता.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

type ItemField = "description" | "purity" | "weight" | "value";
type ItemRow = { description: string; purity: string; weight: string; value: string };

function ItemRows({
  title,
  testId,
  items,
  disabled,
  defaultOpen,
  onChange,
}: {
  title: string;
  testId: string;
  items: ItemRow[];
  disabled: boolean;
  defaultOpen: boolean;
  onChange: (index: number, field: ItemField, value: string) => void;
}) {
  const columns: { key: ItemField; label: string }[] = [
    { key: "description", label: "वस्तूचे वर्णन" },
    { key: "purity", label: "शुद्धता" },
    { key: "weight", label: "वजन" },
    { key: "value", label: testId === "pledge-loan-items" ? "अंदाजे बाजारमूल्य (₹)" : "विक्री रक्कम (₹)" },
  ];
  return (
    <details open={defaultOpen} className="group min-w-0 rounded-lg border border-slate-200">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
        <span>{title}</span><span className="shrink-0 text-xs font-medium text-slate-500">३ ओळी</span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 p-3">
        {items.slice(0, 3).map((item, index) => (
          <fieldset key={index} data-testid={`${testId}-row-${index + 1}`} className="grid min-w-0 grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 sm:grid-cols-4">
            <legend className="sr-only">{title} — ओळ {index + 1}</legend>
            {columns.map(column => (
              <div key={column.key} className="min-w-0">
                <Label htmlFor={`${testId}-${index}-${column.key}`} className="mb-1 block min-h-8 whitespace-normal text-[11px] leading-4 text-slate-600">{column.label}</Label>
                <Input
                  id={`${testId}-${index}-${column.key}`}
                  data-testid={`${testId}-${index}-${column.key}`}
                  value={item[column.key]}
                  onChange={event => onChange(index, column.key, event.target.value)}
                  disabled={disabled}
                  className="h-9 min-w-0 border-slate-300 bg-white px-2 text-sm"
                />
              </div>
            ))}
          </fieldset>
        ))}
      </div>
    </details>
  );
}
