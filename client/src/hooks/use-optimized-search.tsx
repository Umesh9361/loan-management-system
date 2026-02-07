import { useMemo } from "react";

// Enhanced name matching with fuzzy search capabilities
const matchesName = (name: string, searchTerm: string): boolean => {
  if (!name || !searchTerm) return false;
  
  const nameLower = name.toLowerCase().trim();
  const searchLower = searchTerm.toLowerCase().trim();
  
  // Exact match
  if (nameLower === searchLower) return true;
  
  // Direct inclusion
  if (nameLower.includes(searchLower)) return true;
  
  // Word boundary matches - split by spaces and check each word
  const nameWords = nameLower.split(/\s+/);
  const searchWords = searchLower.split(/\s+/);
  
  // If searching for multiple words, all should match
  if (searchWords.length > 1) {
    return searchWords.every(searchWord => 
      nameWords.some(nameWord => 
        nameWord.includes(searchWord) || 
        nameWord.startsWith(searchWord) ||
        searchWord.includes(nameWord)
      )
    );
  }
  
  // Single word search - check if any name word contains or starts with search term
  return nameWords.some(nameWord => 
    nameWord.includes(searchLower) || 
    nameWord.startsWith(searchLower) ||
    searchLower.includes(nameWord) ||
    // Fuzzy matching for common misspellings (at least 2 chars matching from start)
    (searchLower.length >= 2 && nameWord.length >= 2 && 
     searchLower.substring(0, 2) === nameWord.substring(0, 2))
  );
};

// Memoized search function for instant local filtering with enhanced name matching
export function useOptimizedSearch(loans: any[], searchQuery: string, statusFilter: string) {
  return useMemo(() => {
    if (!Array.isArray(loans)) return [];
    
    let filtered = loans;
    
    // Fast status filtering first (most selective)
    if (statusFilter !== "all") {
      filtered = filtered.filter(loan => loan.status === statusFilter);
    }
    
    // Skip search processing if no query
    if (!searchQuery.trim()) return filtered;
    
    const searchLower = searchQuery.toLowerCase().trim();
    
    // Enhanced search implementation with fuzzy name matching
    const exactMatches: any[] = [];
    const partialMatches: any[] = [];
    const fuzzyMatches: any[] = [];
    
    filtered.forEach(loan => {
      // Enhanced name matching
      const nameMatch = matchesName(loan.borrowerName || '', searchQuery);
      
      // Other field matches (exact search)
      const otherFields = [
        loan.borrowerMobile?.toLowerCase() || '',
        loan.accountNumber?.toString().toLowerCase() || '',
        loan.collateralDetails?.toLowerCase() || '',
      ];
      
      const hasExactFieldMatch = otherFields.some(field => field === searchLower);
      const hasPartialFieldMatch = otherFields.some(field => field.includes(searchLower));
      
      // Prioritize matches
      if (loan.borrowerName?.toLowerCase() === searchLower || hasExactFieldMatch) {
        exactMatches.push(loan);
      } else if (nameMatch || hasPartialFieldMatch) {
        partialMatches.push(loan);
      }
    });
    
    // Return exact matches first, then partial matches, then fuzzy matches
    return [...exactMatches, ...partialMatches, ...fuzzyMatches];
  }, [loans, searchQuery, statusFilter]);
}