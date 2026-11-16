import { pledgeFormsDocument, PLEDGE_FORM_OPTIONS } from "../client/src/lib/pledge-forms";
import { defaultPledgeMatter } from "../shared/pledge-form-editor";
import { defaultNoticeMatter, renderNoticeContent } from "../shared/notice-matter";
import { fullNoticeHTML } from "../client/src/pages/reports/notice-generator";
import { accountSummaryPrintDocument } from "../client/src/lib/account-summary-print";
import { accountSummaryTotals } from "../shared/account-summary";
import { lossDocumentFixture } from "./overdue-print-fixtures";
import { getUiLanguage, setUiLanguage, uiText } from "../shared/ui-language";

export function englishPrintSamples() {
  const original = getUiLanguage();
  const samples: Array<{name:string;html:string;pageSelector?:string}> = [];
  const data = {
    company: "नमुना फायनान्स", companyAddress: "Sample Finance Office, Main Market Road, Maharashtra",
    borrowerName: "राम पाटील – Christopher Alexander Patil",
    borrowerAddress: "Near the Main Market, Building Number 123, Sample Town, Maharashtra",
    accountNumber: "621", loanDate: "2026-04-15", principalAmount: "100000",
    interestRate: "2", loanItems: [{ description: "ठुशी / Traditional gold necklace with detailed ornamental work", purity: "80", weight: "20", value: "200000" }],
  };
  try {
    for (const language of ["en", "mr"] as const) {
      setUiLanguage(language);
      for (const layout of ["compact", "spacious"] as const)
        samples.push({name:`${language}-forms-${layout}`,html:pledgeFormsDocument(data,"all",defaultPledgeMatter(language),layout),pageSelector:".pf-page"});
      for (const option of PLEDGE_FORM_OPTIONS.filter(o=>o.value!=="all"))
        samples.push({name:`${language}-form-${option.value}`,html:pledgeFormsDocument(data,option.value,defaultPledgeMatter(language),"spacious"),pageSelector:".pf-page"});
      for(const kind of ["mixed","long","no-phone","duration"])
        samples.push({name:`${language}-loss-${kind}`,html:lossDocumentFixture(kind)});
      for(const blank of [false,true])
        samples.push({name:`${language}-notice-${blank?"blank":"filled"}`,html:fullNoticeHTML(renderNoticeContent(blank?null:data,defaultNoticeMatter(language),{name:data.company,address:data.companyAddress}))});
      const row = {
        name: "Sample customer group with a long name / नमुना गट",
        totalLoans: 40, activeLoans: 30, closedLoans: 10, totalWeight: 100,
        totalFineWeight: 80, goldWeight: 100, goldFineWeight: 80, silverWeight: 300,
        silverFineWeight: 250, totalAmount: 2500000, closedAmount: 200000,
        activeBalance: 2300000, totalInterest: 15000,
      };
      for (const includeOverview of [false,true])
        samples.push({name:`${language}-summary-${includeOverview?"overview":"table"}`,html:accountSummaryPrintDocument({
          company:data.company,title:uiText("खाते सारांश"),period:"01/04/2026 – 31/03/2027",scope:uiText("सर्व"),
          interest:uiText("व्याज"),label:uiText("गटाचे नाव"),notes:"",rows:[row],totals:accountSummaryTotals([row]),
          showRank:false,includeOverview,includeNotes:false,overviewHTML:"",overviewMode:"cumulative",
          position:{activeLoans:30,activeBalance:2300000,goldWeight:100,silverWeight:300,totalInterest:15000},
          yearlyPeriod:"2022–23 – 2026–27",
          yearlyProgress:Array.from({length:5},(_,i)=>({
            year:2022+i,label:`${2022+i}–${2023+i}`,from:`${2022+i}-04-01`,to:`${2023+i}-03-31`,
            partial:false,disbursed:1000000+i*100000,interest:10000+i*1000,loanCount:40,
            previousComparableDisbursed:null,disbursementChange:null,
          })),
        })});
    }
  } finally { setUiLanguage(original); }
  return samples;
}
