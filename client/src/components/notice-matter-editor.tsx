import { useState } from "react";
import { RotateCcw, Save, SlidersHorizontal, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NOTICE_MATTER_FIELDS,
  NOTICE_TOKENS,
  type NoticeMatter,
} from "@shared/notice-matter";
import { useNoticeDefaults } from "@/hooks/use-notice-defaults";

type Props = { defaults: ReturnType<typeof useNoticeDefaults> };

export function NoticeMatterEditor({ defaults }: Props) {
  const [expanded, setExpanded] = useState(false);
  const {
    matter,
    ready,
    error,
    refetch,
    busy,
    canSaveDefault,
    customized,
    onMatterChange,
    onUseSaved,
    onUseOriginal,
    onSaveDefault,
    onResetDefault,
  } = defaults;
  const hasTemporaryChanges = NOTICE_MATTER_FIELDS.some(
    field => matter[field.key] !== defaults.defaultMatter[field.key],
  );
  const statusText = hasTemporaryChanges
    ? "तात्पुरते बदल"
    : customized
      ? "संस्थेचा जतन केलेला मजकूर"
      : "मूळ नमुना";

  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm"
      aria-label="नोटीसचा मजकूर संपादन"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="notice-matter-editor-content"
        onClick={() => setExpanded(value => !value)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-indigo-900 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-indigo-700" aria-hidden="true" />
          <span>नोटीसचा मजकूर संपादित करा</span>
        </span>
        {ready && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              hasTemporaryChanges
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : customized
                  ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                  : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {statusText}
          </span>
        )}
      </button>

      {expanded && (
        <div id="notice-matter-editor-content" className="space-y-4 border-t border-indigo-100 p-3 sm:p-4">
          {!ready ? (
            <div
              role={error ? "alert" : "status"}
              className={`rounded-lg border px-3 py-3 text-sm leading-6 ${
                error
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-indigo-100 bg-indigo-50 text-indigo-900"
              }`}
            >
              {error ? (
                <>
                  <p className="font-semibold">नोटीसचा जतन केलेला मजकूर लोड झाला नाही.</p>
                  <p className="mt-1">मजकूर वापरण्यापूर्वी पुन्हा प्रयत्न करा. मूळ नमुन्याला आपोआप पर्याय म्हणून वापरलेले नाही.</p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void refetch()}
                    className="mt-3 min-h-10 border-rose-300 bg-white text-rose-900 hover:bg-rose-100"
                  >
                    पुन्हा प्रयत्न करा
                  </Button>
                </>
              ) : (
                <p className="animate-pulse">नोटीसचा जतन केलेला मजकूर तपासत आहोत…</p>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs leading-5 text-indigo-950">
                येथे केलेले बदल या नोटीससाठी तात्पुरते आहेत. कंपनीचा मजकूर बदलण्यासाठी खालील प्रशासकीय पर्याय स्वतंत्रपणे वापरा. कर्जदार, खाते किंवा कर्जाची नोंद बदलत नाही.
              </div>

              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                {NOTICE_MATTER_FIELDS.map(field => {
                  const id = `notice-matter-${field.key}`;
                  return (
                    <div
                      key={field.key}
                      className={`min-w-0 ${field.key === "body" ? "sm:col-span-2" : ""}`}
                    >
                      <Label htmlFor={id} className="mb-1.5 block text-xs font-medium leading-5 text-slate-700">
                        {field.label}
                      </Label>
                      {field.rows > 1 ? (
                        <textarea
                          id={id}
                          data-testid={id}
                          rows={field.rows}
                          value={matter[field.key]}
                          onChange={event => onMatterChange(field.key as keyof NoticeMatter, event.target.value)}
                          disabled={busy}
                          spellCheck
                          className="block min-h-20 w-full min-w-0 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70"
                        />
                      ) : (
                        <input
                          id={id}
                          data-testid={id}
                          type="text"
                          value={matter[field.key]}
                          onChange={event => onMatterChange(field.key as keyof NoticeMatter, event.target.value)}
                          disabled={busy}
                          className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <aside
                className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                aria-label="नोटीससाठी उपलब्ध बदलणारे तपशील"
              >
                <p className="text-xs font-semibold text-slate-800">बदलणारे तपशील</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  हे टोकन मजकुरात जसेच्या तसे ठेवा. नोटीस तयार करताना संबंधित खाते / संस्थेची माहिती वापरली जाईल.
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {NOTICE_TOKENS.map(token => (
                    <li key={token.key}>
                      <span className="inline-flex max-w-full rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs text-indigo-900">
                        <span className="font-mono break-all">{"{"}{token.key}{"}"}</span>
                        <span className="ml-1.5 text-slate-500">{token.label}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>

              <div className="space-y-3 border-t border-slate-200 pt-3">
                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onUseSaved}
                    disabled={busy || !ready}
                    className="min-h-10 w-full justify-start gap-2 whitespace-normal border-slate-300 text-slate-700"
                  >
                    <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    जतन केलेला मजकूर पुन्हा वापरा
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onUseOriginal}
                    disabled={busy || !ready}
                    className="min-h-10 w-full justify-start gap-2 whitespace-normal border-slate-300 text-slate-700"
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                    मूळ मजकूर तात्पुरता वापरा
                  </Button>
                </div>

                {canSaveDefault ? (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
                    <p className="mb-2 text-xs leading-5 text-indigo-950">
                      प्रशासकीय बदल संस्थेतील सर्व वापरकर्त्यांसाठी आणि पुढील नोटिसांसाठी लागू होतील. आधीच्या नोटिसा किंवा कर्जदाराची माहिती बदलणार नाही.
                    </p>
                    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        onClick={onSaveDefault}
                        disabled={busy || !ready}
                        className="min-h-10 w-full gap-2 whitespace-normal bg-indigo-700 text-white hover:bg-indigo-800"
                      >
                        <Save className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {busy ? "जतन करत आहोत…" : "संस्थेसाठी हा मजकूर जतन करा"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onResetDefault}
                        disabled={busy || !ready}
                        className="min-h-10 w-full gap-2 whitespace-normal border-rose-300 bg-white text-rose-800 hover:bg-rose-50"
                      >
                        <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                        संस्थेचा जतन केलेला मजकूर मूळ करा
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
                    संस्थेचा मजकूर जतन किंवा मूळ करण्याचा अधिकार प्रशासकाला आहे. आपण या नोटीससाठी तात्पुरते बदल करू शकता.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
