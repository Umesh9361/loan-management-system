import { Link } from "wouter";
import { ArrowRight, FileStack, PenLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const destinations = [
  {
    href: "/reports/pledge-forms",
    title: "सर्व तारण फॉर्म",
    description: "सहा नमुने · कोरा फॉर्म",
    detail: "यातून एक किंवा अनेक फॉर्म निवडून प्रिंट / PDF",
    Icon: FileStack,
    tone: "indigo",
  },
  {
    href: "/reports/pledge-forms?mode=manual",
    title: "हाताने माहिती भरा",
    description: "नोंदणीपूर्वी ग्राहकाची माहिती टाइप करा",
    detail: "कर्जदार निवड आवश्यक नाही",
    Icon: PenLine,
    tone: "amber",
  },
] as const;

const toneClasses = {
  indigo: {
    icon: "bg-indigo-100 text-indigo-800",
    arrow: "text-indigo-700",
    hover: "hover:border-indigo-300 hover:bg-indigo-50/50",
  },
  amber: {
    icon: "bg-amber-100 text-amber-900",
    arrow: "text-amber-800",
    hover: "hover:border-amber-300 hover:bg-amber-50/60",
  },
};

export function NoticeFormsLauncher() {
  return (
    <Card className="mb-6 min-w-0 overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-1 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-700">
              छपाई केंद्र
            </p>
            <CardTitle className="text-base font-bold text-slate-900 sm:text-lg">
              तारण कर्ज फॉर्म
            </CardTitle>
          </div>
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-900">
            A4 · पूर्वदृश्य · प्रिंट · PDF
          </span>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">
          नोटीसपासून स्वतंत्रपणे फॉर्म उघडा — कर्जदार निवडण्याची गरज नाही.
        </p>
      </CardHeader>

      <CardContent className="grid min-w-0 grid-cols-1 gap-2.5 p-3 sm:grid-cols-2 sm:gap-3 sm:p-4">
        {destinations.map(({ href, title, description, detail, Icon, tone }) => {
          const classes = toneClasses[tone];
          return (
            <Link
              key={href}
              href={href}
              className={[
                "group flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2",
                classes.hover,
              ].join(" ")}
            >
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${classes.icon}`}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="break-words text-sm font-semibold leading-5 text-slate-900">
                    {title}
                  </span>
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${classes.arrow}`}
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-1 block break-words text-xs leading-relaxed text-slate-600">
                  {description}
                </span>
                <span className="mt-1.5 block break-words text-[11px] font-medium leading-relaxed text-slate-500">
                  {detail}
                </span>
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
