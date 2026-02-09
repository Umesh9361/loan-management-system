// Clean Narration Utilities
// Prevents duplicate text patterns in cash transaction narrations

export class NarrationUtils {
  // Clean party-based narration without duplicate "रोकड आली/दिली" text
  static formatPartyNarration(
    partyName: string, 
    transactionType: 'cash_in' | 'cash_out', 
    userNarration?: string
  ): string {
    const cleanPartyName = partyName.trim();
    const cleanUserNarration = userNarration?.trim() || '';
    
    // If user already provided complete narration, use it as-is
    if (cleanUserNarration && 
        (cleanUserNarration.includes(cleanPartyName) || 
         cleanUserNarration.includes('कडून') || 
         cleanUserNarration.includes('ला'))) {
      return cleanUserNarration;
    }
    
    // Build clean narration without duplicate "रोकड" words
    if (transactionType === 'cash_in') {
      return cleanUserNarration 
        ? `${cleanPartyName} कडून ${cleanUserNarration}`
        : `${cleanPartyName} कडून पेमेंट मिळाले`;
    } else {
      return cleanUserNarration
        ? `${cleanPartyName} ला ${cleanUserNarration}`
        : `${cleanPartyName} ला पेमेंट केले`;
    }
  }
  
  // Clean simple narration without party
  static formatSimpleNarration(
    transactionType: 'cash_in' | 'cash_out',
    userNarration: string
  ): string {
    const cleanNarration = userNarration.trim();
    
    // Don't add prefixes if already descriptive
    if (cleanNarration.length > 10 || 
        cleanNarration.includes('व्याज') ||
        cleanNarration.includes('खर्च') ||
        cleanNarration.includes('उत्पन्न')) {
      return cleanNarration;
    }
    
    // Add minimal context for very short descriptions
    return transactionType === 'cash_in' 
      ? `उत्पन्न: ${cleanNarration}`
      : `खर्च: ${cleanNarration}`;
  }
  
  // Check if narration already has duplicate patterns
  static hasDuplicatePattern(narration: string): boolean {
    return narration.includes('रोकड आली रोकड') ||
           narration.includes('रोकड दिली रोकड') ||
           /(.+)\s+\1/.test(narration); // General duplicate word pattern
  }
  
  // Clean existing duplicate patterns
  static cleanDuplicatePattern(narration: string): string {
    // Remove duplicate "रोकड आली/दिली" patterns
    let cleaned = narration
      .replace(/रोकड आली.*रोकड आली/g, 'पेमेंट मिळाले')
      .replace(/रोकड दिली.*रोकड दिली/g, 'पेमेंट केले');
    
    // Remove general duplicate word patterns (word word -> word)
    cleaned = cleaned.replace(/\b(\w+)\s+\1\b/g, '$1');
    
    return cleaned.trim();
  }
}