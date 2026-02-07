import { useState, useCallback } from 'react';

export type LanguageMode = 'english' | 'marathi' | 'auto';

interface UseDualLanguageProps {
  defaultMode?: LanguageMode;
  enableTransliteration?: boolean;
}

interface UseDualLanguageReturn {
  inputMode: LanguageMode;
  setInputMode: (mode: LanguageMode) => void;
  toggleInputMode: () => void;
  translateText: (text: string, targetLang: 'marathi' | 'english') => string;
  isMarathiText: (text: string) => boolean;
  isEnglishText: (text: string) => boolean;
}

// Enhanced transliteration mappings
const englishToMarathiMap: Record<string, string> = {
  // Basic vowels
  'a': 'अ', 'aa': 'आ', 'i': 'इ', 'ii': 'ई', 'u': 'उ', 'uu': 'ऊ',
  'e': 'ए', 'ai': 'ऐ', 'o': 'ओ', 'au': 'औ', 'an': 'अं', 'ah': 'अः',
  
  // Consonants
  'k': 'क', 'kh': 'ख', 'g': 'ग', 'gh': 'घ', 'ng': 'ङ',
  'ch': 'च', 'chh': 'छ', 'j': 'ज', 'jh': 'झ', 'ny': 'ञ',
  't': 'त', 'th': 'थ', 'd': 'द', 'dh': 'ध', 'n': 'न',
  'p': 'प', 'ph': 'फ', 'b': 'ब', 'bh': 'भ', 'm': 'म',
  'y': 'य', 'r': 'र', 'l': 'ल', 'v': 'व', 'w': 'व',
  'sh': 'श', 'shh': 'ष', 's': 'स', 'h': 'ह',
  
  // Popular names
  'ram': 'राम', 'shyam': 'श्याम', 'geeta': 'गीता', 'sita': 'सीता',
  'krishna': 'कृष्ण', 'radha': 'राधा', 'lakshmi': 'लक्ष्मी', 'saraswati': 'सरस्वती',
  'ganesh': 'गणेश', 'shiva': 'शिव', 'vishnu': 'विष्णु', 'brahma': 'ब्रह्मा',
  'durga': 'दुर्गा', 'kali': 'काली', 'parvati': 'पार्वती', 'indira': 'इंदिरा',
  'vijay': 'विजय', 'ajay': 'अजय', 'sanjay': 'संजय', 'prakash': 'प्रकाश',
  'sunil': 'सुनील', 'anil': 'अनिल', 'vinod': 'विनोद', 'manoj': 'मनोज',
  'raju': 'राजू', 'babu': 'बाबू', 'dada': 'दादा', 'mama': 'मामा',
  'kaka': 'काका', 'baba': 'बाबा', 'aai': 'आई', 'baba': 'बाबा',
  'tai': 'ताई', 'vahini': 'वहिनी', 'bhau': 'भाऊ', 'didi': 'दीदी',
  
  // Common surnames
  'patel': 'पाटेल', 'sharma': 'शर्मा', 'gupta': 'गुप्ता', 'singh': 'सिंह',
  'kumar': 'कुमार', 'yadav': 'यादव', 'jain': 'जैन', 'agrawal': 'अग्रवाल',
  'shah': 'शाह', 'mehta': 'मेहता', 'joshi': 'जोशी', 'dave': 'दवे',
  'desai': 'देसाई', 'bhatt': 'भट्ट', 'trivedi': 'त्रिवेदी', 'pandey': 'पांडे',
  
  // Financial terms
  'loan': 'कर्ज', 'amount': 'रक्कम', 'interest': 'व्याज', 'principal': 'मुद्दल',
  'borrower': 'कर्जदार', 'lender': 'सावकार', 'payment': 'पेमेंट', 'due': 'देय',
  'account': 'खाते', 'balance': 'शिल्लक', 'deposit': 'ठेव', 'withdrawal': 'काढणे',
  'business': 'व्यवसाय', 'agriculture': 'शेती', 'trade': 'व्यापार', 'service': 'सेवा',
  'income': 'उत्पन्न', 'expense': 'खर्च', 'profit': 'नफा', 'loss': 'तोटा',
  
  // Jewelry and collateral
  'gold': 'सोने', 'silver': 'चांदी', 'necklace': 'नेकलेस', 'chain': 'चेन',
  'ring': 'अंगठी', 'bangles': 'बांगड्या', 'earrings': 'कानातले', 'bracelet': 'हातकडी',
  'anklet': 'पायल', 'nose': 'नाक', 'ornament': 'दागिना', 'jewelry': 'दागिने',
  'diamond': 'हिरा', 'pearl': 'मोती', 'ruby': 'माणिक', 'emerald': 'पाचू',
  
  // Common words
  'name': 'नाव', 'address': 'पत्ता', 'mobile': 'मोबाइल', 'phone': 'फोन',
  'email': 'ईमेल', 'date': 'तारीख', 'time': 'वेळ', 'place': 'जागा',
  'village': 'गाव', 'city': 'शहर', 'district': 'जिल्हा', 'state': 'राज्य',
  'country': 'देश', 'house': 'घर', 'office': 'कार्यालय', 'shop': 'दुकान',
  
  // Family relations
  'father': 'वडील', 'mother': 'आई', 'son': 'मुलगा', 'daughter': 'मुलगी',
  'husband': 'नवरा', 'wife': 'बायको', 'brother': 'भाऊ', 'sister': 'बहीण',
  'grandfather': 'आजोबा', 'grandmother': 'आजी', 'uncle': 'काका', 'aunt': 'काकी',
  
  // Numbers in words
  'one': 'एक', 'two': 'दोन', 'three': 'तीन', 'four': 'चार', 'five': 'पाच',
  'six': 'सहा', 'seven': 'सात', 'eight': 'आठ', 'nine': 'नऊ', 'ten': 'दहा',
  'hundred': 'शंभर', 'thousand': 'हजार', 'lakh': 'लाख', 'crore': 'कोटी'
};

const marathiToEnglishMap: Record<string, string> = Object.fromEntries(
  Object.entries(englishToMarathiMap).map(([eng, mar]) => [mar, eng])
);

export function useDualLanguage({
  defaultMode = 'auto',
  enableTransliteration = true
}: UseDualLanguageProps = {}): UseDualLanguageReturn {
  const [inputMode, setInputMode] = useState<LanguageMode>(defaultMode);

  const toggleInputMode = useCallback(() => {
    const modes: LanguageMode[] = ['auto', 'english', 'marathi'];
    const currentIndex = modes.indexOf(inputMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setInputMode(nextMode);
  }, [inputMode]);

  const isMarathiText = useCallback((text: string): boolean => {
    return /[\u0900-\u097F]/.test(text);
  }, []);

  const isEnglishText = useCallback((text: string): boolean => {
    return /[a-zA-Z]/.test(text) && !/[\u0900-\u097F]/.test(text);
  }, []);

  const translateText = useCallback((text: string, targetLang: 'marathi' | 'english'): string => {
    if (!enableTransliteration || !text.trim()) return text;
    
    const map = targetLang === 'marathi' ? englishToMarathiMap : marathiToEnglishMap;
    let translatedText = text.toLowerCase();
    
    // Sort by length (longer patterns first) to handle overlapping patterns correctly
    const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);
    
    // Apply transliteration word by word
    const words = translatedText.split(/(\s+)/);
    const translatedWords = words.map(word => {
      if (/^\s+$/.test(word)) return word; // Keep whitespace as-is
      
      let translatedWord = word;
      sortedKeys.forEach(key => {
        // Use word boundaries for better matching
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        translatedWord = translatedWord.replace(regex, map[key]);
      });
      
      return translatedWord;
    });
    
    return translatedWords.join('');
  }, [enableTransliteration]);

  return {
    inputMode,
    setInputMode,
    toggleInputMode,
    translateText,
    isMarathiText,
    isEnglishText
  };
}