import { z } from "zod";

export const NOTICE_TOKENS = [
  { key: "borrowerName", label: "कर्जदाराचे नाव" },
  { key: "borrowerAddress", label: "पत्ता" },
  { key: "borrowerPhone", label: "मोबाईल" },
  { key: "accountNumber", label: "खाते क्रमांक" },
  { key: "loanDate", label: "कर्जाची तारीख" },
  { key: "noticeDate", label: "नोटीसची तारीख" },
  { key: "companyName", label: "संस्थेचे नाव" },
  { key: "companyAddress", label: "संस्थेचा पत्ता" },
  { key: "principalAmount", label: "मुद्दल" },
  { key: "interestRate", label: "व्याजदर" },
  { key: "loanPeriod", label: "मुदत" },
] as const;
const tokens = new Set<string>(NOTICE_TOKENS.map(token => token.key));
const wording = (max: number, required = false) => z.string().trim().max(max, `मजकूर ${max} अक्षरांपर्यंत ठेवा.`)
  .refine(value => !required || value.length > 0, "हा मजकूर रिकामा ठेवू नका.")
  .refine(value => Array.from(value.matchAll(/\{([^{}]+)\}/g)).every(match => tokens.has(match[1])),
    "माहिती भरण्यासाठी दिलेलेच {खूणशब्द} वापरा.");
export const noticeMatterSchema = z.object({
  title: wording(160, true),
  dateLine: wording(250),
  recipient: wording(1600),
  subject: wording(1200),
  body: wording(15000, true),
  signature: wording(800),
}).strict();
export type NoticeMatter = z.infer<typeof noticeMatterSchema>;
export const noticeDefaultsRequestSchema = z.object({ matter: noticeMatterSchema }).strict();

// Immutable original: never replace this with an organization's saved wording.
export const DEFAULT_NOTICE_MATTER: Readonly<NoticeMatter> = Object.freeze({
  title: "नोटीस",
  dateLine: "दिनांक: {noticeDate}",
  recipient: "प्रति,\n{borrowerName}\n{borrowerAddress}\n{borrowerPhone}",
  subject: "विषय: कर्ज खाते क्र. {accountNumber} - तारण कर्ज परतफेड व कलम १७६ अन्वये सूचना",
  body: "सदर नोटीसद्वारे आपणास कळविण्यात येते की, दि. {loanDate} रोजी आपण तारण कर्ज घेतले असून, कर्जाची विहित मुदत संपुष्टात आली आहे.\n\nभारतीय करार अधिनियम, १८७२ कलम १७६ अन्वये, तारणदाराला कर्जाची मुदत संपल्यानंतर वाजवी सूचना देऊन तारण वस्तूची विक्री/विल्हेवाट लावण्याचा कायदेशीर अधिकार आहे. त्यानुसार, सदर नोटीस प्राप्त झाल्यापासून १५ (पंधरा) दिवसांच्या आत कर्जाची संपूर्ण मूळ रक्कम व देय व्याज अदा करावे.\n\nवरील दिलेल्या मुदतीत रक्कम अदा न केल्यास, तारण ठेवलेल्या वस्तूची विक्री / मोड / विल्हेवाट करण्यात येईल. त्यातून प्राप्त रकमेतील तूट, बाजारभावातील फरक व इतर नुकसानीची संपूर्ण जबाबदारी कर्जदाराची (तुमची) राहील.\n\nसदर नोटीसची गंभीर दखल घ्यावी.",
  signature: "अधिकृत स्वाक्षरी",
});
export const NOTICE_MATTER_FIELDS: Array<{ key: keyof NoticeMatter; label: string; rows: number }> = [
  { key: "title", label: "नोटीशीचे शीर्षक", rows: 1 },
  { key: "dateLine", label: "तारीख", rows: 1 },
  { key: "recipient", label: "प्रति / कर्जदाराचे तपशील", rows: 4 },
  { key: "subject", label: "विषय", rows: 2 },
  { key: "body", label: "संपूर्ण मुख्य मजकूर", rows: 12 },
  { key: "signature", label: "सहीखालील मजकूर", rows: 2 },
];

function escape(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
function date(value: unknown) {
  const text = String(value ?? "").split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)}` : text;
}
/** Templates and all account values are plain text, never executable HTML. */
export function renderNoticeContent(loan: Record<string, any> | null, input: NoticeMatter, company?: Record<string, any> | null) {
  const matter = noticeMatterSchema.parse(input);
  const blank = "________________________";
  const values: Record<string, string> = {
    borrowerName: escape(loan ? loan.borrowerName : blank),
    borrowerAddress: escape(loan ? loan.borrowerAddress : blank),
    borrowerPhone: escape(loan ? (loan.borrowerPhone || loan.phone ? `मो: ${loan.borrowerPhone || loan.phone}` : "") : blank),
    accountNumber: escape(loan ? loan.accountNumber : blank),
    loanDate: escape(loan ? date(loan.loanDate) : blank),
    noticeDate: "____/____/________",
    companyName: escape(company?.name || ""),
    companyAddress: escape(company?.address || ""),
    principalAmount: escape(loan ? (Number.isFinite(Number(loan.principalAmount)) ? Number(loan.principalAmount).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "") : blank),
    interestRate: escape(loan ? loan.interestRate : blank),
    loanPeriod: escape(loan ? (loan.durationInMonths != null ? `${loan.durationInMonths} महिने` : "") : blank),
  };
  const fill = (template: string) => escape(template).replace(/\{([^{}]+)\}/g, (_, token: string) => values[token] ?? "");
  const lines = (template: string) => template.split("\n").map(fill).filter(Boolean).join("<br/>");
  return `<div class="notice-container">
    <div class="notice-title">${lines(matter.title)}</div>
    <div class="notice-date">${lines(matter.dateLine)}</div>
    <div class="notice-to">${lines(matter.recipient)}</div>
    <div class="notice-subject">${lines(matter.subject)}</div>
    <div class="notice-body">${matter.body.split(/\n\s*\n/).map(paragraph => `<p>${lines(paragraph)}</p>`).join("")}</div>
    <div class="notice-signature">${lines(matter.signature)}</div>
  </div>`;
}
