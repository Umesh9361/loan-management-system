import { overduePrintDocument, type OverduePrintOptions, type OverduePrintRow } from "../client/src/lib/overdue-print";

export const sevenLossRows: OverduePrintRow[] = [4.5, 4.5, 4.88, 4.95, 4.5, 16.66, 6.7].map((weight, index) => ({
  loanId: `fixture-${index}`, accountNumber: String(115 + index), borrowerName: `नमुना ग्राहक ${index + 1}`,
  borrowerPhone: index === 0 ? "0000000000" : "", groupName: "नमुना गट",
  loanDate: "2026-04-09", goldItem: index === 0 ? "बोरमाळ 30 मणी" : "सोन्याची अंगठी",
  principalAmount: 45000, interestToDate: index === 0 ? 6304 : 5516,
  totalAmount: index === 0 ? 51304 : 50516, goldWeight: weight, fineGoldWeight: weight * .82,
  purityUsed: 82, currentGoldValue: index < 2 ? 49915 : 54000,
  lossAmount: index === 0 ? 1389 : index === 1 ? 601 : 0, daysOverdue: 219,
  loanType: "तारण", metalType: "gold", securityLabel: index < 2 ? "नुकसान" : "कमी सुरक्षित",
}));
export const silverLossRow: OverduePrintRow = {
  ...sevenLossRows[2], loanId: "silver", accountNumber: "201", borrowerName: "नमुना चांदी खाते",
  goldWeight: 1245, fineGoldWeight: 1243.755, purityUsed: 99.9, metalType: "silver",
};
export const unsecuredLossRow: OverduePrintRow = {
  ...sevenLossRows[0], loanId: "unsecured", accountNumber: "301", borrowerName: "नमुना विनातारण खाते",
  goldItem: "", loanType: "विनातारण", goldWeight: 0, fineGoldWeight: 0, currentGoldValue: 0,
  principalAmount: 10000, interestToDate: 500, totalAmount: 10500, lossAmount: 10500,
};
export function lossPrintFixture(kind = "seven"): OverduePrintOptions {
  const mixed = [...sevenLossRows, silverLossRow, unsecuredLossRow];
  const rows = kind === "empty" ? [] : kind === "unsecured" ? [unsecuredLossRow] : kind === "mixed" ? mixed
    : kind === "long" ? Array.from({ length: 45 }, (_, index) => ({
      ...mixed[index % mixed.length], loanId: `long-${index}`, accountNumber: `${index + 1}`,
      borrowerName: `नमुना ग्राहक ${index + 1} ${"श्री रामचंद्र विश्वनाथ पाटील".repeat(index % 4 === 0 ? 2 : 1)}`,
      goldItem: index % 3 === 0 ? "वस्तूची तपशीलवार नोंद: सोन्याची जुनी बोरमाळ, अंगठी आणि बांगडी" : "",
    })) : sevenLossRows;
  return {
    rows, company: "नमुना फायनान्स", companyAddress: "नमुना गाव, महाराष्ट्र",
    title: kind === "future" ? "भविष्यातील नुकसान अंदाज रिपोर्ट" : "लॉस रिपोर्ट", reportDate: "15/11/2026",
    context: [
      ["कालावधी", "01/04/2026 ते 15/11/2026"], ["विश्लेषण", kind === "future" ? "पुढील 3 महिने" : "आजपर्यंत"],
      ["सोने दर / ग्रॅम", "₹13,527"], ["चांदी दर / ग्रॅम", "₹195"],
      ["शुद्धता", "कर्ज नोंदणीप्रमाणे"], ["व्याज", "कर्ज नोंदणीप्रमाणे"], ["निवड", "नमुना गट"],
    ],
  };
}
export const lossDocumentFixture = (kind = "seven") => overduePrintDocument(lossPrintFixture(kind));
