/** Remove only unambiguous whitespace around the decimal; never insert a decimal. */
export function normalizeLoanWeightInput(value: string) {
  return value.replace(/[०-९]/g, digit => String("०१२३४५६७८९".indexOf(digit)))
    .replace(/\s*\.\s*/g, ".");
}

export function normalizeLoanWeight(value: string) {
  return normalizeLoanWeightInput(value).trim();
}

export function loanWeightError(value: string, required = false) {
  const normalized = normalizeLoanWeight(value);
  if (!normalized) return required ? "कृपया तारणाचे वजन ग्राममध्ये भरा." : "";
  if (normalized.length > 50 || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    return "वजन फक्त ग्राममध्ये लिहा, उदा. 1.490. स्वल्पविराम, अक्षरे किंवा आकड्यांमधील स्पेस तपासा.";
  }
  if (!Number.isFinite(Number(normalized)) || Number(normalized) <= 0) {
    return "वजन शून्यापेक्षा जास्त असावे.";
  }
  return "";
}

export type LoanWeightCheck = {
  weight: string;
  principal: string | number;
  purity: string | number;
  metalType: string;
  loanType: string;
  /** An independent metal price per gram, not marketValue / entered weight. */
  ratePerGram: number;
};

export function loanWeightWarning(input: LoanWeightCheck): string | null {
  if (input.loanType === "विनातारण" || loanWeightError(input.weight, true)) return null;
  const weight = Number(normalizeLoanWeight(input.weight));
  const principal = Number(input.principal);
  const purity = Number(input.purity);
  const metal = input.metalType === "silver" ? "चांदी" : "सोने";
  const grams = weight.toLocaleString("en-IN", { maximumFractionDigits: 6 });
  const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const hasRate = Number.isFinite(input.ratePerGram) && input.ratePerGram > 0;
  if (hasRate && principal > 0 && Number.isFinite(principal) && purity > 0 && purity <= 100) {
    const value = weight * (purity / 100) * input.ratePerGram;
    // A very low advance can be legitimate. Warn, never silently change the weight.
    if (principal / value < 0.05) {
      return `${metal} वजन ${grams} ग्राम आणि कर्ज ${money(principal)}: ${money(input.ratePerGram)}/ग्राम व ${purity}% शुद्धतेनुसार तारणाचे अंदाजे मूल्य ${money(value)} आहे. कर्ज त्याच्या 5% पेक्षाही कमी असल्याने वजन जास्त टाइप झाले असण्याची शक्यता आहे. दशांश बिंदू तपासा (उदा. 1.490 ऐवजी 1490 झाले आहे का?). योग्य वजन असल्यास खात्री करून पुढे जा.`;
    }
    return null;
  }
  // Without a reliable price, do not invent a rate or claim an amount comparison.
  const unusuallyHeavy = weight >= (input.metalType === "silver" ? 10000 : 1000);
  if (unusuallyHeavy) {
    return `${metal} वजन ${grams} ग्राम आहे. हे मोठे वजन आहे; दशांश बिंदू व ग्रामचे एकक तपासा (उदा. 1.490 ऐवजी 1490 झाले आहे का?). ${hasRate ? "कर्जरक्कम व शुद्धता भरल्यावर" : "धातूचा दर उपलब्ध झाल्यावर"} रकमेशी तुलना करता येईल. वजन आपोआप बदललेले नाही.`;
  }
  return null;
}
