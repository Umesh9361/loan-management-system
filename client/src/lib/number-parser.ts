var NUMBER_WORD_MAP: Record<string, number> = {
  'शून्य': 0, 'एक': 1, 'दोन': 2, 'तीन': 3, 'चार': 4, 'पाच': 5,
  'सहा': 6, 'सात': 7, 'आठ': 8, 'नऊ': 9, 'दहा': 10,
  'अकरा': 11, 'बारा': 12, 'तेरा': 13, 'चौदा': 14, 'पंधरा': 15,
  'सोळा': 16, 'सतरा': 17, 'अठरा': 18, 'एकोणीस': 19, 'वीस': 20,
  'एकवीस': 21, 'बावीस': 22, 'तेवीस': 23, 'चोवीस': 24, 'पंचवीस': 25,
  'सव्वीस': 26, 'सत्तावीस': 27, 'अठ्ठावीस': 28, 'एकोणतीस': 29, 'तीस': 30,
  'एकतीस': 31, 'बत्तीस': 32, 'तेहतीस': 33, 'चौतीस': 34, 'पस्तीस': 35,
  'छत्तीस': 36, 'सदतीस': 37, 'अडतीस': 38, 'एकोणचाळीस': 39, 'चाळीस': 40,
  'एक्केचाळीस': 41, 'बेचाळीस': 42, 'त्रेचाळीस': 43, 'चव्वेचाळीस': 44, 'पंचेचाळीस': 45,
  'सेहेचाळीस': 46, 'सत्तेचाळीस': 47, 'अठ्ठेचाळीस': 48, 'एकोणपन्नास': 49, 'पन्नास': 50,
  'एक्कावन्न': 51, 'बावन्न': 52, 'त्रेपन्न': 53, 'चोपन्न': 54, 'पंचावन्न': 55,
  'छप्पन्न': 56, 'सत्तावन्न': 57, 'अठ्ठावन्न': 58, 'एकोणसाठ': 59, 'साठ': 60,
  'एकसष्ट': 61, 'बासष्ट': 62, 'त्रेसष्ट': 63, 'चौसष्ट': 64, 'पासष्ट': 65,
  'सहासष्ट': 66, 'सदुसष्ट': 67, 'अडुसष्ट': 68, 'एकोणसत्तर': 69, 'सत्तर': 70,
  'एक्काहत्तर': 71, 'बाहत्तर': 72, 'त्र्याहत्तर': 73, 'चौऱ्याहत्तर': 74, 'पंच्याहत्तर': 75,
  'शहात्तर': 76, 'सत्याहत्तर': 77, 'अठ्ठ्याहत्तर': 78, 'एकोणऐंशी': 79, 'ऐंशी': 80,
  'एक्क्याऐंशी': 81, 'ब्याऐंशी': 82, 'त्र्याऐंशी': 83, 'चौऱ्याऐंशी': 84, 'पंच्याऐंशी': 85,
  'शहाऐंशी': 86, 'सत्त्याऐंशी': 87, 'अठ्ठ्याऐंशी': 88, 'एकोणनव्वद': 89, 'नव्वद': 90,
  'एक्क्याण्णव': 91, 'ब्याण्णव': 92, 'त्र्याण्णव': 93, 'चौऱ्याण्णव': 94, 'पंच्याण्णव': 95,
  'शहाण्णव': 96, 'सत्त्याण्णव': 97, 'अठ्ठ्याण्णव': 98, 'नव्व्याण्णव': 99,
  'शंभर': 100, 'दोनशे': 200, 'तीनशे': 300, 'चारशे': 400, 'पाचशे': 500,
  'सहाशे': 600, 'सातशे': 700, 'आठशे': 800, 'नऊशे': 900, 'हजार': 1000,
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
  'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
  'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000,
  'शून्या': 0, 'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5,
  'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
  'एक सौ': 100, 'दो सौ': 200, 'तीन सौ': 300, 'चार सौ': 400, 'पांच सौ': 500,
  'छह सौ': 600, 'सात सौ': 700, 'आठ सौ': 800, 'नौ सौ': 900,
  'सौ': 100, 'हज़ार': 1000,
  'बीस': 20, 'चालीस': 40, 'पचास': 50, 'अस्सी': 80, 'नब्बे': 90,
};

export function devanagariToAscii(text: string): string {
  return text.replace(/[०-९]/g, function(ch) { return String('०१२३४५६७८९'.indexOf(ch)); });
}

export function normalizeTranscript(text: string): string {
  var normalized = devanagariToAscii(text.trim().toLowerCase());
  normalized = normalized.replace(/[।,\.]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized;
}

export function parseSpokenNumber(text: string): string | null {
  var normalized = normalizeTranscript(text);
  if (/^\d+$/.test(normalized)) return normalized;

  var direct = NUMBER_WORD_MAP[normalized];
  if (direct !== undefined) return String(direct);

  var parts = normalized.split(/[\s\-]+/);

  if (parts.length === 2) {
    var a = NUMBER_WORD_MAP[parts[0]];
    var b = NUMBER_WORD_MAP[parts[1]];
    if (a !== undefined && b !== undefined) {
      if (a >= 100 && b < 100) return String(a + b);
      if (a === 1000 && b < 1000) return String(a + b);
      if (a < 10 && b === 100) return String(a * b);
      if (a < 10 && b === 1000) return String(a * b);
      if (a >= 20 && a < 100 && b < 10) return String(a + b);
    }
  }

  if (parts.length === 3) {
    var a3 = NUMBER_WORD_MAP[parts[0]];
    var b3 = NUMBER_WORD_MAP[parts[1]];
    var c3 = NUMBER_WORD_MAP[parts[2]];
    if (a3 !== undefined && b3 !== undefined && c3 !== undefined) {
      if (a3 >= 100 && b3 >= 100) return String(a3 + b3 + c3);
      if (a3 < 10 && b3 === 100 && c3 < 100) return String(a3 * b3 + c3);
      if (a3 >= 100 && b3 < 100 && c3 < 10) return String(a3 + b3 + c3);
    }
  }

  if (parts.length === 4) {
    var a4 = NUMBER_WORD_MAP[parts[0]];
    var b4 = NUMBER_WORD_MAP[parts[1]];
    var c4 = NUMBER_WORD_MAP[parts[2]];
    var d4 = NUMBER_WORD_MAP[parts[3]];
    if (a4 !== undefined && b4 !== undefined && c4 !== undefined && d4 !== undefined) {
      if (a4 < 10 && b4 === 100 && c4 >= 10 && c4 < 100 && d4 < 10) return String(a4 * b4 + c4 + d4);
    }
  }

  var digits = normalized.replace(/\D/g, '');
  if (digits.length > 0) return digits;

  return null;
}

export function processTranscriptSegments(transcript: string, addFn: (accNo: string) => void): void {
  var normalized = normalizeTranscript(transcript);
  var fullParsed = parseSpokenNumber(normalized);
  if (fullParsed) { addFn(fullParsed); return; }
  var segments = normalized.split(/[,।\.\s]+/).filter(function(w: string) { return w.length > 0; });
  var i = 0;
  while (i < segments.length) {
    if (i + 1 < segments.length) {
      var twoWord = segments[i] + ' ' + segments[i + 1];
      var parsed2 = parseSpokenNumber(twoWord);
      if (parsed2) { addFn(parsed2); i += 2; continue; }
    }
    var parsed1 = parseSpokenNumber(segments[i]);
    if (parsed1) { addFn(parsed1); }
    i++;
  }
}
