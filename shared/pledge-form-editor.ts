import { z } from "zod";

export const PLEDGE_FIELD_GROUPS = [
  { title: "खाते व कर्ज तपशील", forms: ["loan", "interim", "final", "receipt", "disposal"], fields: [
    { key: "accountNumber", label: "खाते क्रमांक", type: "text" },
    { key: "principalAmount", label: "कर्ज रक्कम (₹)", type: "money" },
    { key: "loanDate", label: "कर्ज दिनांक", type: "date" },
    { key: "interestRate", label: "व्याजदर (%)", type: "number" },
    { key: "ratePeriod", label: "दराचा कालावधी", type: "text" },
    { key: "aadhaarLast4", label: "आधारचे शेवटचे 4 अंक", type: "text" },
    { key: "panNumber", label: "पॅन क्रमांक", type: "text" },
    { key: "repaymentDate", label: "परतफेड दिनांक / मुदत", type: "text" },
  ] },
  { title: "परतफेड व वस्तू परत देणे", forms: ["receipt"], fields: [
    { key: "receiptPrincipal", label: "प्राप्त मुद्दल (₹)", type: "money" },
    { key: "receiptInterest", label: "प्राप्त व्याज (₹)", type: "money" },
    { key: "receiptFees", label: "मान्य इतर शुल्क (₹)", type: "money" },
    { key: "receiptTotal", label: "एकूण प्राप्त रक्कम (₹)", type: "money" },
    { key: "paymentMethod", label: "प्राप्तीचा प्रकार", type: "text" },
  ] },
  { title: "विक्री / निपटारा", forms: ["disposal"], fields: [
    { key: "noticeDate", label: "पूर्वसूचना दिनांक", type: "date" },
    { key: "finalNoticeDate", label: "अंतिम नोटीस दिनांक", type: "date" },
    { key: "saleDate", label: "विक्री दिनांक", type: "date" },
    { key: "buyerDetails", label: "खरेदीदार / पावती क्रमांक", type: "text" },
    { key: "saleTotal", label: "एकूण विक्री रक्कम (₹)", type: "money" },
    { key: "outstandingPrincipal", label: "बाकी मुद्दल (₹)", type: "money" },
    { key: "dueInterest", label: "देय व्याज (₹)", type: "money" },
    { key: "saleExpenses", label: "मान्य विक्री खर्च (₹)", type: "money" },
    { key: "totalDue", label: "एकूण देय रक्कम (₹)", type: "money" },
    { key: "balanceReturn", label: "कर्जदारास परत / तूट (₹)", type: "money" },
  ] },
  { title: "फॉर्म दिनांक", forms: ["loan", "declaration", "interim", "final", "receipt", "disposal"], fields: [
    { key: "printDate", label: "फॉर्म दिनांक", type: "date" },
  ] },
] as const;
export type PledgeFieldKey = typeof PLEDGE_FIELD_GROUPS[number]["fields"][number]["key"];
export type PledgeItem = { description: string; purity: string; weight: string; value: string };
export type PledgeCompanyProfile = Partial<Record<"name" | "address" | "contactNumber" | "licenseNumber", string | null>>;
export type PledgeOrganizationData = {
  company: string; companyAddress: string; companyContactNumber: string; companyLicenseNumber: string;
};
export function getPledgeOrganization(profile?: PledgeCompanyProfile | null, overrides: Partial<PledgeOrganizationData> = {}): PledgeOrganizationData {
  return {
    company: overrides.company ?? profile?.name ?? "",
    companyAddress: overrides.companyAddress ?? profile?.address ?? "",
    companyContactNumber: overrides.companyContactNumber ?? profile?.contactNumber ?? "",
    companyLicenseNumber: overrides.companyLicenseNumber ?? profile?.licenseNumber ?? "",
  };
}
export type PledgeFormData = Partial<PledgeOrganizationData> & Partial<Record<PledgeFieldKey | "borrowerName" | "borrowerAddress" | "borrowerMobile", string>> & {
  // Kept for previously edited templates; the built-in receipt no longer repeats these fields.
  releaseDate?: string; itemCount?: string; conditionNote?: string;
  loanItems?: PledgeItem[]; saleItems?: PledgeItem[];
  borrowerPhoto?: string;
  collateralPhotos?: string[];
  collateralPhotoLabels?: string[];
  // Print-only choices; never persisted to the loan/photo records.
  includeBorrowerPhoto?: boolean;
  includeCollateralPhotos?: boolean;
};
export const emptyPledgeItems = (): PledgeItem[] => Array.from({ length: 3 }, () => ({ description: "", purity: "", weight: "", value: "" }));

export const DEFAULT_PLEDGE_MATTER = {
  loanTitle: "तारण कर्ज व्यवहार नोंद व पावती",
  declarationTitle: "मालकी व व्यवहाराचे घोषणापत्र",
  declaration1: "तारण वस्तू माझ्या कायदेशीर मालकीच्या आहेत. अन्य हक्क / बोजा असल्यास त्याची माहिती सावकारास दिली आहे.",
  declaration2: "वस्तू चोरीच्या किंवा बेकायदेशीररीत्या मिळविलेल्या नाहीत. दिलेली माहिती माझ्या माहितीनुसार खरी आहे.",
  declaration3: "वजन, शुद्धता, मुद्दल, व्याजदर व परतफेडीचा तपशील समजावून सांगितला असून नोंद / पावतीची प्रत मिळाली आहे.",
  declaration4: "मालकीबाबत वाद किंवा माहितीतील चूक आढळल्यास त्वरित कळवीन. जबाबदारी लागू कायद्यानुसार ठरेल.",
  interimTitle: "अंतरिम पूर्वसूचना",
  interimText1: "आपण दिनांक {{loanDate}} रोजी तारण कर्ज घेतले आहे. कर्जाच्या परतफेडीची मुदत जवळ आली आहे / संपली आहे.",
  interimText2: "कृपया कार्यालयाशी संपर्क साधून बाकी मुद्दल व देय व्याजाचा हिशोब तपासावा आणि परतफेड करून तारण वस्तू सोडवून घ्याव्यात. परतफेड आधीच केली असल्यास संबंधित पावती दाखवून नोंद दुरुस्त करून घ्यावी.",
  finalTitle: "अंतिम नोटीस",
  finalText1: "आपल्या कर्जाची परतफेड बाकी आहे. ही नोटीस मिळाल्यापासून 15 दिवसांत कार्यालयाशी संपर्क साधून बाकी मुद्दल व लागू व्याजाचा हिशोब पडताळावा व परतफेड करावी.",
  finalText2: "परतफेड न झाल्यास लागू कायद्यानुसार आवश्यक सूचना, वाजवी मुदत व प्रक्रिया पूर्ण करूनच विक्रीची कार्यवाही होईल. विक्रीचा हिशोब देऊन देय रक्कम व मान्य खर्च वजा केल्यानंतरची शिल्लक आपल्याला दिली जाईल; तूट असल्यास कायद्यानुसार कार्यवाही होईल.",
  receiptTitle: "परतफेड व तारण वस्तू परत मिळाल्याची पावती",
  releaseText: "मी तारण वस्तू स्वतः तपासल्या. ओळख, वजन व दिसणारी स्थिती पडताळून माझ्याच वस्तू समाधानाने ताब्यात घेतल्या आहेत. वस्तू स्वीकारताना तूटफूट, अदलाबदल किंवा बनावटपणाबाबत माझी कोणतीही तक्रार नाही. वरील मजकूर वाचून व समजून खाली सही केली आहे.",
  disposalTitle: "तारण वस्तू निपटारा / विक्री पावती",
  disposalText: "पूर्वसूचना दिनांक {{noticeDate}} व अंतिम नोटीस दिनांक {{finalNoticeDate}} यांनंतर लागू कायद्यानुसार आवश्यक प्रक्रिया पूर्ण करून खालील वस्तूंची विक्री केली. विक्री, मान्य खर्च व शिल्लक / तुटीचा हिशोब खाली दिला आहे.",
};
export type PledgeFormMatter = typeof DEFAULT_PLEDGE_MATTER;
export const PLEDGE_MATTER_GROUPS = [
  { form: "loan", title: "कर्ज नोंद", keys: [{ key: "loanTitle", label: "शीर्षक" }] },
  { form: "declaration", title: "मालकी घोषणापत्र", keys: [
    { key: "declarationTitle", label: "शीर्षक" }, { key: "declaration1", label: "मालकी" },
    { key: "declaration2", label: "माहितीची सत्यता" }, { key: "declaration3", label: "तपशीलाची खात्री" },
    { key: "declaration4", label: "वाद / चूक" },
  ] },
  { form: "interim", title: "अंतरिम पूर्वसूचना", keys: [
    { key: "interimTitle", label: "शीर्षक" }, { key: "interimText1", label: "पहिला परिच्छेद" }, { key: "interimText2", label: "दुसरा परिच्छेद" },
  ] },
  { form: "final", title: "अंतिम नोटीस", keys: [
    { key: "finalTitle", label: "शीर्षक" }, { key: "finalText1", label: "परतफेडीची सूचना" }, { key: "finalText2", label: "पुढील कार्यवाही" },
  ] },
  { form: "receipt", title: "परतफेड पावती", keys: [{ key: "receiptTitle", label: "शीर्षक" }, { key: "releaseText", label: "ग्राहकाची तपासणी व स्वीकृती घोषणा" }] },
  { form: "disposal", title: "विक्री पावती", keys: [{ key: "disposalTitle", label: "शीर्षक" }, { key: "disposalText", label: "विक्रीची नोंद" }] },
] as const;
const matterShape = Object.fromEntries(Object.keys(DEFAULT_PLEDGE_MATTER).map(key => [
  key, z.string().trim().min(1, "मजकूर रिकामा ठेवू नका.").max(key.endsWith("Title") ? 140 : 2500, "मजकूर खूप मोठा आहे."),
])) as Record<keyof PledgeFormMatter, z.ZodString>;
export const pledgeMatterSchema = z.object(matterShape).strict();
export const pledgeDefaultsRequestSchema = z.object({ matter: pledgeMatterSchema }).strict();
