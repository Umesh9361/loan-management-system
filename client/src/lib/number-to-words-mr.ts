// Marathi Number to Words Converter for Indian Currency
// Supports up to crores with proper Marathi linguistic rules

// Basic numbers 1-99 in Marathi
const marathiNumbers: { [key: number]: string } = {
  0: 'शून्य',
  1: 'एक', 2: 'दोन', 3: 'तीन', 4: 'चार', 5: 'पाच', 6: 'सहा', 7: 'सात', 8: 'आठ', 9: 'नऊ', 10: 'दहा',
  11: 'अकरा', 12: 'बारा', 13: 'तेरा', 14: 'चौदा', 15: 'पंधरा', 16: 'सोळा', 17: 'सतरा', 18: 'अठरा', 19: 'एकोणीस',
  20: 'वीस', 21: 'एकवीस', 22: 'बावीस', 23: 'तेवीस', 24: 'चोवीस', 25: 'पंचवीस', 26: 'सव्वीस', 27: 'सत्तावीस', 28: 'अठ्ठावीस', 29: 'एकोणतीस',
  30: 'तीस', 31: 'एकतीस', 32: 'बत्तीस', 33: 'तेहतीस', 34: 'चौतीस', 35: 'पस्तीस', 36: 'छत्तीस', 37: 'सदतीस', 38: 'अडतीस', 39: 'एकोणचाळीस',
  40: 'चाळीस', 41: 'एकेचाळीस', 42: 'बेचाळीस', 43: 'त्रेचाळीस', 44: 'चवेचाळीस', 45: 'पंचेचाळीस', 46: 'सेहेचाळीस', 47: 'सत्तेचाळीस', 48: 'अठ्ठेचाळीस', 49: 'एकोणपन्नास',
  50: 'पन्नास', 51: 'एक्कावन्न', 52: 'बावन्न', 53: 'त्रेपन्न', 54: 'चोपन्न', 55: 'पंचावन्न', 56: 'छप्पन्न', 57: 'सत्तावन्न', 58: 'अठ्ठावन्न', 59: 'एकोणसाठ',
  60: 'साठ', 61: 'एकसष्ठ', 62: 'बासष्ठ', 63: 'त्रेसष्ठ', 64: 'चौसष्ठ', 65: 'पासष्ठ', 66: 'सहासष्ठ', 67: 'सदुसष्ठ', 68: 'अडुसष्ठ', 69: 'एकोणसत्तर',
  70: 'सत्तर', 71: 'एक्काहत्तर', 72: 'बाहत्तर', 73: 'त्र्याहत्तर', 74: 'चौर्‍याहत्तर', 75: 'पंच्याहत्तर', 76: 'शहत्तर', 77: 'सत्याहत्तर', 78: 'अठ्ठ्याहत्तर', 79: 'एकोणऐंशी',
  80: 'ऐंशी', 81: 'एक्क्याऐंशी', 82: 'ब्याऐंशी', 83: 'त्र्याऐंशी', 84: 'चौर्‍याऐंशी', 85: 'पंच्याऐंशी', 86: 'शहाऐंशी', 87: 'सत्याऐंशी', 88: 'अठ्ठ्याऐंशी', 89: 'एकोणनव्वद',
  90: 'नव्वद', 91: 'एक्क्याण्णव', 92: 'ब्याण्णव', 93: 'त्र्याण्णव', 94: 'चौर्‍याण्णव', 95: 'पंच्याण्णव', 96: 'शहाण्णव', 97: 'सत्याण्णव', 98: 'अठ्ठ्याण्णव', 99: 'नव्याण्णव'
};

// ✅ PROPER MARATHI HUNDREDS - Grammatically correct forms
const marathiHundreds: { [key: number]: string } = {
  1: 'एकशे',    // Not "एक शंभर"
  2: 'दोनशे',   // Not "दोन शंभर" 
  3: 'तीनशे',   // Not "तीन शंभर"
  4: 'चारशे',   // Not "चार शंभर" ✅ THIS FIXES THE USER'S ISSUE
  5: 'पाचशे',   // Not "पाच शंभर"
  6: 'सहाशे',   // Not "सहा शंभर"
  7: 'सातशे',   // Not "सात शंभर"
  8: 'आठशे',   // Not "आठ शंभर"
  9: 'नऊशे'    // Not "नऊ शंभर"
};

// Convert numbers under 100 to Marathi words
function convertUnder100(num: number): string {
  if (num === 0) return '';
  if (marathiNumbers[num]) return marathiNumbers[num];
  
  // This shouldn't happen with our complete mapping, but fallback
  const tens = Math.floor(num / 10) * 10;
  const ones = num % 10;
  return `${marathiNumbers[tens]} ${marathiNumbers[ones]}`;
}

// Convert numbers under 1000 to Marathi words
function convertUnder1000(num: number): string {
  if (num === 0) return '';
  
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;
  
  let result = '';
  
  // ✅ GRAMMATICALLY CORRECT: Use proper Marathi hundreds forms
  if (hundreds > 0) {
    result += marathiHundreds[hundreds]; // "चारशे" not "चार शंभर"
    if (remainder > 0) result += ' ';
  }
  
  if (remainder > 0) {
    result += convertUnder100(remainder);
  }
  
  return result;
}

// Main conversion function for Indian currency (up to crores)
export function inrToWordsMr(amount: number, options: { includePaise?: boolean } = {}): string {
  if (amount === 0) return 'शून्य रुपये';
  
  const { includePaise = false } = options;
  
  // Separate rupees and paise
  const rupees = Math.trunc(amount);
  const paise = Math.round((amount - rupees) * 100);
  
  let result = '';
  
  // Convert rupees part
  if (rupees > 0) {
    const crores = Math.floor(rupees / 10000000);
    const lakhs = Math.floor((rupees % 10000000) / 100000);
    const thousands = Math.floor((rupees % 100000) / 1000);
    const hundreds = rupees % 1000;
    
    const parts: string[] = [];
    
    if (crores > 0) {
      parts.push(`${convertUnder100(crores)} कोटी`);
    }
    
    if (lakhs > 0) {
      parts.push(`${convertUnder100(lakhs)} लाख`);
    }
    
    if (thousands > 0) {
      parts.push(`${convertUnder100(thousands)} हजार`);
    }
    
    if (hundreds > 0) {
      parts.push(convertUnder1000(hundreds));
    }
    
    result = parts.join(' ') + ' रुपये';
  }
  
  // Add paise part if requested and exists
  if (includePaise && paise > 0) {
    if (result) result += ' आणि ';
    result += `${convertUnder100(paise)} पैसे`;
  }
  
  return result;
}

// Format currency with words for display in receipts
export function formatCurrencyWithWordsMr(amount: number, options: { includePaise?: boolean } = {}): string {
  const numericPart = `₹${amount.toLocaleString('en-IN')}`;
  const wordsPart = inrToWordsMr(amount, options);
  
  return `${numericPart} (${wordsPart})`;
}