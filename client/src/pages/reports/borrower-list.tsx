import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";

import { ArrowLeft, FileText, Users, Calendar, Receipt, ChevronDown, Check, Table, Printer, Eye } from "lucide-react";
import { useLocation } from "wouter";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Sidebar } from "@/components/ui/sidebar";
import { toast } from "@/hooks/use-toast";
import { DateUtils } from "@/lib/date-utils";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import html2canvas from "html2canvas";
import { exportToExcel } from "@/utils/excel-export";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhotoViewer } from "@/components/ui/photo-viewer";
import { LoanCalculations } from "@/lib/calculations";
import { sortLoans, createLoanComparator } from "@/lib/loan-sorting";

export default function BorrowerListReports() {
  const [location] = useLocation();
  const { safeNavigate } = useSafeNavigation();
  const [activeTab, setActiveTab] = useState<'date-wise' | 'closing-wise' | 'name-wise' | 'maturity-wise'>('date-wise');
  
  // Common filters
  const [groupId, setGroupId] = useState("all");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  
  // Date-wise specific
  const [dateWiseStatus, setDateWiseStatus] = useState<'active' | 'all'>('active');
  
  // Closing-wise specific
  const [dateFilter, setDateFilter] = useState<'loan-date' | 'closure-date'>('loan-date');
  
  // Name-wise specific
  const [selectedBorrowerName, setSelectedBorrowerName] = useState("");
  const [nameWiseStatus, setNameWiseStatus] = useState<'active' | 'all' | 'closed'>('all');
  
  // Smart Autocomplete State for Name-wise borrower search
  const [borrowerSearchTerm, setBorrowerSearchTerm] = useState("");
  const [showBorrowerSuggestions, setShowBorrowerSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const borrowerInputRef = useRef<HTMLInputElement>(null);
  const borrowerSuggestionsRef = useRef<HTMLDivElement>(null);
  
  // Date filter state for name-wise report
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Maturity-wise specific
  const [maturityWiseStatus, setMaturityWiseStatus] = useState<'active' | 'all'>('active');
  const [includeSpecificPeriod, setIncludeSpecificPeriod] = useState(false);
  const [includeFutureMaturity, setIncludeFutureMaturity] = useState(false);
  const [futureMaturityPeriod, setFutureMaturityPeriod] = useState<'1month' | '3months' | '6months' | '1year'>('3months');
  
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100); // 100 entries per page
  
  // Fetch data with performance optimization
  const { data: groups = [] } = useQuery({
    queryKey: ["/api/groups"],
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    gcTime: 5 * 60 * 1000, // 5 minutes in memory
    refetchOnWindowFocus: false,
  });
  
  const { data: loans = [] } = useQuery({
    queryKey: ["/api/loans"],
    staleTime: 1 * 60 * 1000, // 1 minute cache
    gcTime: 3 * 60 * 1000, // 3 minutes in memory
    refetchOnWindowFocus: false,
  });

  // Fetch loan closures for accurate closure data
  const { data: loanClosures = [] } = useQuery({
    queryKey: ["/api/loan-closures"],
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    gcTime: 5 * 60 * 1000, // 5 minutes in memory
    refetchOnWindowFocus: false,
  });
  
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
    staleTime: 10 * 60 * 1000, // 10 minutes cache - company data rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes in memory
    refetchOnWindowFocus: false,
  });

  // Photo availability optimization - fetch availability for all loans
  const { data: photoAvailability = [] } = useQuery({
    queryKey: ["/api/loans/photo-availability", Array.isArray(loans) ? loans.map((l: any) => l.id) : []],
    queryFn: async () => {
      if (!Array.isArray(loans) || loans.length === 0) return [];
      
      const loanIds = loans.map((loan: any) => loan.id);
      console.log(`📸 FETCHING: Photo availability for ${loanIds.length} loans`);
      
      const response = await fetch('/api/loans/photo-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanIds })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch photo availability');
      }
      
      const availability = await response.json();
      console.log(`📸 LOADED: ${availability.filter((a: any) => a.hasPhotos).length}/${availability.length} loans have photos`);
      return availability;
    },
    enabled: Array.isArray(loans) && loans.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes in memory
    refetchOnWindowFocus: false,
  });

  // Photo availability helper - Memoized for performance
  const photoAvailabilityMap = useMemo(() => {
    const map = new Map();
    if (photoAvailability && photoAvailability.length > 0) {
      photoAvailability.forEach((item: any) => {
        map.set(item.loanId, { hasPhotos: item.hasPhotos, photoCount: item.photoCount });
      });
    }
    return map;
  }, [photoAvailability]);
  
  // Get unique borrower names from selected group or all groups - Memoized for performance
  const getUniqueBorrowers = useMemo(() => {
    if (!groupId) return [];
    
    const loansArray = Array.isArray(loans) ? loans : [];
    
    // If "all" is selected, get names from all groups
    if (groupId === "all") {
      const uniqueNames = Array.from(new Set(loansArray.map(loan => loan.borrowerName)));
      return uniqueNames.sort((a, b) => a.localeCompare(b));
    }
    
    // Otherwise, get names from specific group
    const groupLoans = loansArray.filter(loan => loan.groupId === groupId);
    const uniqueNames = Array.from(new Set(groupLoans.map(loan => loan.borrowerName)));
    return uniqueNames.sort((a, b) => a.localeCompare(b));
  }, [groupId, loans]);

  // OPTIMIZED LEVENSHTEIN DISTANCE - With early termination for performance
  const levenshteinDistance = useMemo(() => {
    const cache = new Map<string, number>();
    
    return (str1: string, str2: string, maxDistance = 3): number => {
      // Early return for exact matches
      if (str1 === str2) return 0;
      
      // Early return if length difference exceeds max distance
      if (Math.abs(str1.length - str2.length) > maxDistance) return maxDistance + 1;
      
      const cacheKey = `${str1}:${str2}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey)!;
      
      const [shorter, longer] = str1.length <= str2.length ? [str1, str2] : [str2, str1];
      let prevRow = Array.from({length: shorter.length + 1}, (_, i) => i);
      
      for (let i = 1; i <= longer.length; i++) {
        const currentRow = [i];
        let hasValidCell = false;
        
        for (let j = 1; j <= shorter.length; j++) {
          const cost = shorter[j - 1] === longer[i - 1] ? 0 : 1;
          const value = Math.min(
            currentRow[j - 1] + 1, // insertion
            prevRow[j] + 1,        // deletion
            prevRow[j - 1] + cost  // substitution
          );
          currentRow.push(value);
          
          if (value <= maxDistance) hasValidCell = true;
        }
        
        // Early termination if no cells are within max distance
        if (!hasValidCell) {
          cache.set(cacheKey, maxDistance + 1);
          return maxDistance + 1;
        }
        
        prevRow = currentRow;
      }
      
      const result = prevRow[shorter.length];
      cache.set(cacheKey, result);
      return result;
    };
  }, []);

  // OPTIMIZED DUAL LANGUAGE SEARCH - Memoized for performance
  const createDualLanguageQuery = useMemo(() => {
    return (originalQuery: string) => {
    // Core translation maps - optimized selection
    const coreEnglishToMarathi: Record<string, string> = {
      // === ESSENTIAL TRANSLATIONS ===
      'surya': 'सूर्य', 'suryakant': 'सूर्यकांत', 'kant': 'कांत',
      
      // === MALE NAMES - COMPREHENSIVE A-Z ===
      'amar': 'अमर', 'amarjit': 'अमरजीत', 'amardeep': 'अमरदीप', 'amarnath': 'अमरनाथ',
      'amit': 'अमित', 'amitabh': 'अमिताभ', 'amitesh': 'अमितेश', 'amol': 'अमोल',
      'anand': 'आनंद', 'ananth': 'अनंत', 'anant': 'अनंत', 'ankush': 'अंकुश',
      'arjun': 'अर्जुन', 'arun': 'अरुण', 'arvind': 'अरविंद', 'ashish': 'आशीष',
      'ashok': 'अशोक', 'ashwin': 'अश्विन', 'atul': 'अतुल', 'ayush': 'आयुष',
      
      'bala': 'बाला', 'balaji': 'बालाजी', 'balan': 'बालन', 'balaram': 'बलराम',
      'bharat': 'भरत', 'bharath': 'भरत', 'bhaskar': 'भास्कर', 'bhavesh': 'भावेश',
      'bhushan': 'भूषण', 'bijay': 'विजय', 'binod': 'बिनोद', 'birendra': 'बीरेंद्र',
      
      'chandra': 'चंद्र', 'chandran': 'चंद्रन', 'chetan': 'चेतन', 'chirag': 'चिराग',
      'deepak': 'दीपक', 'dipak': 'दीपक', 'devraj': 'देवराज', 'dharmesh': 'धर्मेश',
      'dilip': 'दिलीप', 'dinkar': 'दिनकर', 'divya': 'दिव्या', 'dushyant': 'दुष्यंत',
      
      'eknath': 'एकनाथ', 'ganesh': 'गणेश', 'gautam': 'गौतम', 'girish': 'गिरीश',
      'gopal': 'गोपाल', 'govind': 'गोविंद', 'gulab': 'गुलाब', 'gunjan': 'गुंजन',
      
      'hari': 'हरी', 'harish': 'हरीश', 'harsh': 'हर्ष', 'hemant': 'हेमंत',
      'hitesh': 'हितेश', 'jagdish': 'जगदीश', 'jagannath': 'जगन्नाथ', 'jatin': 'जतिन',
      'jayesh': 'जयेश', 'jitesh': 'जितेश', 'kailash': 'कैलाश', 'kamal': 'कमल',
      
      'kartik': 'कार्तिक', 'kiran': 'किरण', 'kishore': 'किशोर', 'krishna': 'कृष्ण',
      'lalit': 'ललित', 'laxman': 'लक्ष्मण', 'madhav': 'माधव', 'mahendra': 'महेंद्र',
      'manohar': 'मनोहर', 'milind': 'मिलिंद', 'mohan': 'मोहन', 'murali': 'मुरली',
      
      'narayan': 'नारायण', 'naveen': 'नवीन', 'nikhil': 'निखिल', 'nilesh': 'नीलेश',
      'omkar': 'ओमकार', 'parag': 'पराग', 'parth': 'पार्थ', 'pavan': 'पवन',
      'pradip': 'प्रदीप', 'pramod': 'प्रमोद', 'pranav': 'प्रणव', 'prashant': 'प्रशांत',
      
      'rahul': 'राहुल', 'raj': 'राज', 'rajan': 'राजन', 'rajesh': 'राजेश',
      'ravi': 'रवि', 'rohit': 'रोहित', 'sachin': 'सचिन', 'sagar': 'सागर',
      'sameer': 'समीर', 'sandip': 'संदीप', 'sanjay': 'संजय', 'santosh': 'संतोष',
      'shailesh': 'शैलेश', 'shashank': 'शशांक', 'shrikant': 'श्रीकांत', 'subhash': 'सुभाष',
      
      'tanmay': 'तन्मय', 'tejas': 'तेजस', 'tushar': 'तुषार', 'umesh': 'उमेश',
      'vaibhav': 'वैभव', 'vikram': 'विक्रम', 'vinay': 'विनय', 'vishal': 'विशाल',
      'yash': 'यश', 'yashwant': 'यशवंत', 'yogendra': 'योगेंद्र', 'zakir': 'जाकिर',
      
      // === FEMALE NAMES - COMPREHENSIVE A-Z ===
      'aarti': 'आरती', 'aditi': 'अदिती', 'alka': 'अल्का', 'amba': 'अंबा',
      'amrita': 'अमृता', 'anita': 'अनीता', 'anjali': 'अंजली', 'anu': 'अनु',
      'archana': 'अर्चना', 'aruna': 'अरुणा', 'asha': 'आशा', 'bharati': 'भारती',
      
      'chanda': 'चंदा', 'chhaya': 'छाया', 'deepa': 'दीपा', 'devi': 'देवी',
      'durga': 'दुर्गा', 'gauri': 'गौरी', 'gita': 'गीता', 'hema': 'हेमा',
      'indira': 'इंदिरा', 'jaya': 'जया', 'jayanti': 'जयंती', 'kala': 'कला',
      
      'kamala': 'कमला', 'kirann': 'किरण', 'kokila': 'कोकिला', 'lata': 'लता',
      'laxmi': 'लक्ष्मी', 'leela': 'लीला', 'madhu': 'मधु', 'maya': 'माया',
      'meena': 'मीना', 'neha': 'नेहा', 'nisha': 'निशा', 'parvati': 'पार्वती',
      
      'pooja': 'पूजा', 'priya': 'प्रिया', 'radha': 'राधा', 'rekha': 'रेखा',
      'rita': 'रीता', 'rupa': 'रूपा', 'sadhana': 'साधना', 'sarita': 'सरिता',
      'seeta': 'सीता', 'shanti': 'शांती', 'shobha': 'शोभा', 'sita': 'सीता',
      
      'sunita': 'सुनीता', 'sushma': 'सुष्मा', 'swati': 'स्वाती', 'tara': 'तारा',
      'usha': 'उषा', 'vandana': 'वंदना', 'veena': 'वीणा', 'vidya': 'विद्या',
      
      // === SURNAMES & CASTES - COMPREHENSIVE ===
      'agarwal': 'अग्रवाल', 'ahir': 'अहीर', 'bansal': 'बंसल', 'chauhan': 'चौहान',
      'desai': 'देसाई', 'gupta': 'गुप्ता', 'jain': 'जैन', 'joshi': 'जोशी',
      'kulkarni': 'कुलकर्णी', 'mali': 'माली', 'mehta': 'मेहता', 'nair': 'नायर',
      'patel': 'पाटील', 'patil': 'पाटील', 'rao': 'राव', 'reddy': 'रेड्डी',
      'shah': 'शाह', 'sharma': 'शर्मा', 'singh': 'सिंह', 'tiwari': 'तिवारी',
      'yadav': 'यादव', 'yadava': 'यादव', 'more': 'मोरे', 'jadhav': 'जाधव',
      
      // === REGIONAL VARIATIONS ===
      'anna': 'अण्णा', 'appa': 'अप्पा', 'dada': 'दादा', 'kaka': 'काका',
      'mama': 'मामा', 'tai': 'ताई', 'bai': 'बाई', 'aai': 'आई',
      'aji': 'आजी', 'ajoba': 'आजोबा', 'nana': 'नाना', 'nani': 'नानी',
      
      // === TITLES & HONORIFICS ===
      'saheb': 'साहेब', 'maharaj': 'महाराज', 'pandit': 'पंडित', 'ustad': 'उस्ताद',
      'master': 'मास्तर', 'doctor': 'डॉक्टर', 'professor': 'प्रोफेसर',
      
      // === PHONETIC & SPELLING VARIATIONS ===
      'santoshh': 'संतोष', 'santosh2': 'संतोश', 'ashok1': 'अशोक', 'ashok2': 'आशोक',
      'deepakk': 'दीपक', 'dipakk': 'दीपक', 'govinda': 'गोविंदा', 'govindan': 'गोविंदन',
      'krishnan': 'कृष्णन', 'raman': 'रमन', 'mohann': 'मोहन', 'sohan': 'सोहन',
      
      // === COMPOUND NAMES - EXTENSIVE ===
      'rajkumar': 'राजकुमार', 'ramkumar': 'रामकुमार', 'harikumar': 'हरिकुमार',
      'suryakumar': 'सूर्यकुमार', 'chandrakumar': 'चंद्रकुमार', 'devkumar': 'देवकुमार',
      
      // === COMMON NICKNAMES & VARIATIONS ===
      'ravii': 'रवि', 'rohitt': 'रोहित', 'ram': 'राम', 'shyam': 'श्याम',
      'harii': 'हरी', 'dev': 'देव', 'nath': 'नाथ', 'lal': 'लाल',
      'singhh': 'सिंह', 'kumarr': 'कुमार', 'devii': 'देवी', 'baii': 'बाई',
      'taii': 'ताई', 'kakaa': 'काका', 'mamaa': 'मामा', 'annaa': 'अण्णा',
      'dadaa': 'दादा', 'appaa': 'अप्पा', 'baba': 'बाबा', 'aaii': 'आई',
      'ajii': 'आजी', 'ajobaa': 'आजोबा', 'nanaa': 'नाना', 'nanii': 'नानी',
      
      // === MASSIVE REGIONAL NAME BANK - NORTH INDIA ===
      'harinder': 'हरिंदर', 'gurinder': 'गुरिंदर', 'maninder': 'मनिंदर',
      'davinder': 'दविंदर', 'navinder': 'नविंदर', 'ravinder': 'रविंदर',
      'surinder': 'सुरिंदर', 'jatinder': 'जतिंदर', 'satinder': 'सतिंदर',
      
      // === SOUTH INDIA NAMES ===
      'venkatesh': 'वेंकटेश', 'ramakrishna': 'रामकृष्ण', 'venkatesan': 'वेंकटेसन',
      'balasubramanian': 'बालासुब्रमण्यन', 'chandrasekar': 'चंद्रशेकर',
      'narasimhan': 'नरसिंहन', 'raghunath': 'रघुनाथ', 'jagannathan': 'जगन्नाथन',
      
      // === BENGALI NAMES ===
      'subrata': 'सुब्रत', 'subroto': 'सुब्रोतो', 'pradeep': 'प्रदीप',
      'pradyut': 'प्रद्युत', 'goutam': 'गौतम',
      'bijoy': 'बिजय', 'joy': 'जय', 'tapas': 'तपस', 'tarun': 'तरुण',
      
      // === GUJARATI NAMES ===
      'hiren': 'हिरेन', 'dhiren': 'धीरेन', 'jignesh': 'जिग्नेश',
      
      // === TRADITIONAL NAMES ===
      'ramdas': 'रामदास', 'krishnadas': 'कृष्णदास', 'tukaram': 'तुकाराम',
      'namdev': 'नामदेव', 'gyandev': 'ज्ञानदेव',
      'samarth': 'समर्थ', 'ramdoot': 'रामदूत', 'bajrang': 'बजरंग',
      
      // === SAINTS & GURUS ===
      'nanak': 'नानक', 'kabir': 'कबीर', 'rahim': 'रहीम', 'raskhan': 'रसखान',
      'tulsidas': 'तुलसीदास', 'surdas': 'सूरदास', 'meera': 'मीरा',
      'chaitanya': 'चैतन्य', 'ramanuja': 'रामानुज', 'madhva': 'माध्व',
      
      // === COMMON WORD PARTS & SUFFIXES ===
      'prakash': 'प्रकाश', 'shekhar': 'शेकर', 'kishan': 'किशन', 'darshan': 'दर्शन',
      'karan': 'करण', 'charan': 'चरण', 'bhavan': 'भवन', 'rohan': 'रोहन',
      'ghan': 'घन', 'dhan': 'धन', 'chan': 'चन', 'mani': 'मणि',
      'ratna': 'रत्न', 'chand': 'चंद',
      
      // === FEMALE NAME VARIATIONS ===
      'kavita': 'कविता', 'savita': 'सविता', 'mamta': 'ममता',
      'smita': 'स्मिता', 'nita': 'नीता', 'mita': 'मीता',
      'shila': 'शीला', 'sheela': 'शीला', 'neela': 'नीला'
    };
    
    const marathiToEnglish: Record<string, string> = {
      // === CRITICAL CORE TRANSLATIONS ===
      'सूर्य': 'surya', 'सूर्यकांत': 'suryakant', 'कांत': 'kant',
      
      // === MALE NAMES - COMPREHENSIVE A-Z ===
      'अमर': 'amar', 'अमरजीत': 'amarjit', 'अमरदीप': 'amardeep', 'अमरनाथ': 'amarnath',
      'अमित': 'amit', 'अमिताभ': 'amitabh', 'अमितेश': 'amitesh', 'अमोल': 'amol',
      'आनंद': 'anand', 'अनंत': 'anant', 'अंकुश': 'ankush', 'अर्जुन': 'arjun',
      'अरुण': 'arun', 'अरविंद': 'arvind', 'आशीष': 'ashish', 'अशोक': 'ashok',
      'अश्विन': 'ashwin', 'अतुल': 'atul', 'आयुष': 'ayush',
      
      'बाला': 'bala', 'बालाजी': 'balaji', 'बालन': 'balan', 'बलराम': 'balaram',
      'भरत': 'bharat', 'भास्कर': 'bhaskar', 'भावेश': 'bhavesh', 'भूषण': 'bhushan',
      'विजय': 'bijay', 'बिनोद': 'binod', 'बीरेंद्र': 'birendra',
      
      'चंद्र': 'chandra', 'चंद्रन': 'chandran', 'चेतन': 'chetan', 'चिराग': 'chirag',
      'दीपक': 'deepak', 'देवराज': 'devraj', 'धर्मेश': 'dharmesh', 'दिलीप': 'dilip',
      'दिनकर': 'dinkar', 'दिव्या': 'divya', 'दुष्यंत': 'dushyant',
      
      'एकनाथ': 'eknath', 'गणेश': 'ganesh', 'गौतम': 'gautam', 'गिरीश': 'girish',
      'गोपाल': 'gopal', 'गोविंद': 'govind', 'गुलाब': 'gulab', 'गुंजन': 'gunjan',
      
      'हरी': 'hari', 'हरीश': 'harish', 'हर्ष': 'harsh', 'हेमंत': 'hemant',
      'हितेश': 'hitesh', 'जगदीश': 'jagdish', 'जगन्नाथ': 'jagannath', 'जतिन': 'jatin',
      'जयेश': 'jayesh', 'जितेश': 'jitesh', 'कैलाश': 'kailash', 'कमल': 'kamal',
      
      'कार्तिक': 'kartik', 'किरण': 'kiran', 'किशोर': 'kishore', 'कृष्ण': 'krishna',
      'ललित': 'lalit', 'लक्ष्मण': 'laxman', 'माधव': 'madhav', 'महेंद्र': 'mahendra',
      'मनोहर': 'manohar', 'मिलिंद': 'milind', 'मोहन': 'mohan', 'मुरली': 'murali',
      
      'नारायण': 'narayan', 'नवीन': 'naveen', 'निखिल': 'nikhil', 'नीलेश': 'nilesh',
      'ओमकार': 'omkar', 'पराग': 'parag', 'पार्थ': 'parth', 'पवन': 'pavan',
      'प्रदीप': 'pradip', 'प्रमोद': 'pramod', 'प्रणव': 'pranav', 'प्रशांत': 'prashant',
      
      'राहुल': 'rahul', 'राज': 'raj', 'राजन': 'rajan', 'राजेश': 'rajesh',
      'रवि': 'ravi', 'रोहित': 'rohit', 'सचिन': 'sachin', 'सागर': 'sagar',
      'समीर': 'sameer', 'संदीप': 'sandip', 'संजय': 'sanjay', 'संतोष': 'santosh',
      'शैलेश': 'shailesh', 'शशांक': 'shashank', 'श्रीकांत': 'shrikant', 'सुभाष': 'subhash',
      
      'तन्मय': 'tanmay', 'तेजस': 'tejas', 'तुषार': 'tushar', 'उमेश': 'umesh',
      'वैभव': 'vaibhav', 'विक्रम': 'vikram', 'विनय': 'vinay', 'विशाल': 'vishal',
      'यश': 'yash', 'यशवंत': 'yashwant', 'योगेंद्र': 'yogendra', 'जाकिर': 'zakir',
      
      // === FEMALE NAMES - COMPREHENSIVE A-Z ===
      'आरती': 'aarti', 'अदिती': 'aditi', 'अल्का': 'alka', 'अंबा': 'amba',
      'अमृता': 'amrita', 'अनीता': 'anita', 'अंजली': 'anjali', 'अनु': 'anu',
      'अर्चना': 'archana', 'अरुणा': 'aruna', 'आशा': 'asha', 'भारती': 'bharati',
      
      'चंदा': 'chanda', 'छाया': 'chhaya', 'दीपा': 'deepa', 'देवी': 'devi',
      'दुर्गा': 'durga', 'गौरी': 'gauri', 'गीता': 'gita', 'हेमा': 'hema',
      'इंदिरा': 'indira', 'जया': 'jaya', 'जयंती': 'jayanti', 'कला': 'kala',
      
      'कमला': 'kamala', 'कोकिला': 'kokila', 'लता': 'lata', 'लक्ष्मी': 'laxmi',
      'लीला': 'leela', 'मधु': 'madhu', 'माया': 'maya', 'मीना': 'meena',
      'नेहा': 'neha', 'निशा': 'nisha', 'पार्वती': 'parvati', 'पूजा': 'pooja',
      
      'प्रिया': 'priya', 'राधा': 'radha', 'रेखा': 'rekha', 'रीता': 'rita',
      'रूपा': 'rupa', 'साधना': 'sadhana', 'सरिता': 'sarita', 'सीता': 'seeta',
      'शांती': 'shanti', 'शोभा': 'shobha', 'सुनीता': 'sunita', 'सुष्मा': 'sushma',
      'स्वाती': 'swati', 'तारा': 'tara', 'उषा': 'usha', 'वंदना': 'vandana',
      'वीणा': 'veena', 'विद्या': 'vidya',
      
      // === SURNAMES & CASTES - COMPREHENSIVE ===
      'अग्रवाल': 'agarwal', 'अहीर': 'ahir', 'बंसल': 'bansal', 'चौहान': 'chauhan',
      'देसाई': 'desai', 'गुप्ता': 'gupta', 'जैन': 'jain', 'जोशी': 'joshi',
      'कुलकर्णी': 'kulkarni', 'माली': 'mali', 'मेहता': 'mehta', 'नायर': 'nair',
      'पाटील': 'patel', 'राव': 'rao', 'रेड्डी': 'reddy', 'शाह': 'shah',
      'शर्मा': 'sharma', 'सिंह': 'singh', 'तिवारी': 'tiwari', 'यादव': 'yadav',
      'मोरे': 'more', 'जाधव': 'jadhav',
      
      // === REGIONAL VARIATIONS ===
      'अण्णा': 'anna', 'अप्पा': 'appa', 'दादा': 'dada', 'काका': 'kaka',
      'मामा': 'mama', 'ताई': 'tai', 'बाई': 'bai', 'आई': 'aai',
      'आजी': 'aji', 'आजोबा': 'ajoba', 'नाना': 'nana', 'नानी': 'nani',
      
      // === TITLES & HONORIFICS ===
      'साहेब': 'saheb', 'महाराज': 'maharaj', 'पंडित': 'pandit', 'उस्ताद': 'ustad',
      'मास्तर': 'master', 'डॉक्टर': 'doctor', 'प्रोफेसर': 'professor',
      
      // === PHONETIC & SPELLING VARIATIONS ===
      'संतोश': 'santosh', 'रवी': 'ravi', 'गोविंदा': 'govinda',
      'गोविंदन': 'govindan', 'कृष्णन': 'krishnan', 'रमन': 'raman',
      
      // === COMPOUND NAMES - EXTENSIVE ===
      'राजकुमार': 'rajkumar', 'रामकुमार': 'ramkumar', 'हरिकुमार': 'harikumar',
      'सूर्यकुमार': 'suryakumar', 'चंद्रकुमार': 'chandrakumar', 'देवकुमार': 'devkumar',
      
      // === COMPLICATED ENGLISH TO MARATHI MAPPINGS ===
      'krishnamurthy': 'कृष्णमूर्ति', 'lakshminarayan': 'लक्ष्मीनारायण', 'venkateswaran': 'वेंकटेश्वरन',
      'balasubramanian': 'बालासुब्रमण्यम', 'chandrashekaran': 'चंद्रशेखरन', 'radhakrishnan': 'राधाकृष्णन',
      'ramachandran': 'रामचंद्रन', 'sivaramakrishnan': 'शिवरामकृष्णन', 'parameswaran': 'परमेश्वरन',
      'jagannathan': 'जगन्नाथन', 'mahalingam': 'महालिंगम', 'narasimhan': 'नरसिंहन',
      'thirumalai': 'तिरुमलै', 'padmanabhan': 'पद्मनाभन', 'viswanathan': 'विश्वनाथन',
      
      // === MULTIPLE SPELLING VARIATIONS ===
      'krishna': 'कृष्ण', 'krshna': 'कृष्ण', 'krsna': 'कृष्ण', 'krushna': 'कृष्ण',
      'ganesha': 'गणेश', 'ganesa': 'गणेश', 'ganapati': 'गणपति', 'vinayaka': 'विनायक',
      'lakshmi': 'लक्ष्मी', 'laxmi': 'लक्ष्मी', 'lakshimi': 'लक्ष्मी', 'laksmi': 'लक्ष्मी',
      'saraswati': 'सरस्वती', 'sarasvati': 'सरस्वती', 'sarawati': 'सरस्वती',
      'shivram': 'शिवराम', 'shivarama': 'शिवराम', 'sivaram': 'शिवराम',
      
      // === MASSIVE REGIONAL NAME BANK - NORTH INDIA ===
      'हरिंदर': 'harinder', 'गुरिंदर': 'gurinder', 'मनिंदर': 'maninder',
      'दविंदर': 'davinder', 'नविंदर': 'navinder', 'रविंदर': 'ravinder',
      'सुरिंदर': 'surinder', 'जतिंदर': 'jatinder', 'सतिंदर': 'satinder',
      
      // === SOUTH INDIA NAMES ===
      'वेंकटेश': 'venkatesh', 'रामकृष्ण': 'ramakrishna', 'वेंकटेसन': 'venkatesan',
      'बालासुब्रमण्यन': 'balasubramanian', 'चंद्रशेकर': 'chandrasekar',
      'नरसिंहन': 'narasimhan', 'रघुनाथ': 'raghunath', 'जगन्नाथन': 'jagannathan',
      
      // === BENGALI NAMES ===
      'सुब्रत': 'subrata', 'सुब्रोतो': 'subroto', 'प्रद्युत': 'pradyut',
      'बिजय': 'bijoy', 'जय': 'joy', 'तपस': 'tapas', 'तरुण': 'tarun',
      
      // === GUJARATI NAMES ===
      'हिरेन': 'hiren', 'धीरेन': 'dhiren', 'जिग्नेश': 'jignesh',
      'परेश': 'paresh',
      
      // === TRADITIONAL NAMES ===
      'रामदास': 'ramdas', 'कृष्णदास': 'krishnadas', 'तुकाराम': 'tukaram',
      'नामदेव': 'namdev', 'ज्ञानदेव': 'gyandev', 'समर्थ': 'samarth',
      'रामदूत': 'ramdoot', 'बजरंग': 'bajrang',
      
      // === SAINTS & GURUS ===
      'नानक': 'nanak', 'कबीर': 'kabir', 'रहीम': 'rahim', 'रसखान': 'raskhan',
      'तुलसीदास': 'tulsidas', 'सूरदास': 'surdas', 'चैतन्य': 'chaitanya',
      'रामानुज': 'ramanuja', 'माध्व': 'madhva',
      
      // === COMMON WORD PARTS & SUFFIXES ===
      'शेकर': 'shekhar', 'किशन': 'kishan', 'दर्शन': 'darshan',
      'करण': 'karan', 'चरण': 'charan', 'भवन': 'bhavan',
      'घन': 'ghan', 'धन': 'dhan', 'चन': 'chan', 'मणि': 'mani',
      'रत्न': 'ratna', 'चंद': 'chand',
      
      // === FEMALE NAME VARIATIONS ===
      'कविता': 'kavita', 'सविता': 'savita', 'ममता': 'mamta',
      'स्मिता': 'smita', 'नीता': 'nita', 'मीता': 'mita',
      'शीला': 'shila', 'नीला': 'neela'
    };
    
    const queries = [originalQuery];
    const lowerQuery = originalQuery.toLowerCase();
    
    // Add direct translations for exact matches
    if (coreEnglishToMarathi[lowerQuery]) {
      queries.push(coreEnglishToMarathi[lowerQuery]);
    }
    if (marathiToEnglish[lowerQuery]) {
      queries.push(marathiToEnglish[lowerQuery]);
    }
    
    // Add partial word translations for compound names and complicated names
    Object.keys(coreEnglishToMarathi).forEach(english => {
      if (lowerQuery.includes(english)) {
        queries.push(coreEnglishToMarathi[english]);
        // Also add the original query with translation replaced
        queries.push(originalQuery.replace(new RegExp(english, 'gi'), coreEnglishToMarathi[english]));
      }
      
      // Handle phonetic variations and substring matches for complicated names
      if (english.length >= 4) {
        const distance = levenshteinDistance(lowerQuery, english);
        if (distance <= 2 && english.length >= 6) { // Allow 2 character differences for longer names
          queries.push(coreEnglishToMarathi[english]);
        }
        
        // Handle partial matches at word boundaries
        if (lowerQuery.split(/\s+/).some(word => word.length >= 3 && english.includes(word))) {
          queries.push(coreEnglishToMarathi[english]);
        }
      }
    });
    
    Object.keys(marathiToEnglish).forEach(marathi => {
      if (originalQuery.includes(marathi)) {
        queries.push(marathiToEnglish[marathi]);
        // Also add the original query with translation replaced
        queries.push(originalQuery.replace(new RegExp(marathi, 'g'), marathiToEnglish[marathi]));
      }
      
      // Handle phonetic variations for Marathi names
      if (marathi.length >= 3) {
        const marathiWords = originalQuery.split(/\s+/);
        marathiWords.forEach(word => {
          if (word.length >= 2 && marathi.includes(word)) {
            queries.push(marathiToEnglish[marathi]);
          }
        });
      }
    });
    
    // Remove duplicates
    return Array.from(new Set(queries));
    };
  }, []);

  const normalizeMarathiVowels = (text: string): string => {
    return text
      .replace(/ी/g, 'ि')
      .replace(/ू/g, 'ु')
      .replace(/ै/g, 'े')
      .replace(/ौ/g, 'ो')
      .replace(/ॅ/g, 'े')
      .replace(/ॉ/g, 'ो')
      .replace(/आ/g, 'अ')
      .replace(/ई/g, 'इ')
      .replace(/ऊ/g, 'उ')
      .replace(/ऐ/g, 'ए')
      .replace(/औ/g, 'ओ');
  };

  // OPTIMIZED FUZZY SEARCH - Cached and efficient pattern matching
  const fuzzyMatchBorrower = useMemo(() => {
    const scoreCache = new Map<string, number>();
    
    return (text: string, query: string): number => {
      if (!query) return 0;
      
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return 0;
      
      const cacheKey = `${text}:${trimmedQuery}`;
      if (scoreCache.has(cacheKey)) return scoreCache.get(cacheKey)!;
    
    // Get all language variations of the query
    const searchQueries = createDualLanguageQuery(trimmedQuery.toLowerCase());
    let maxScore = 0;
    
    // Add vowel-normalized variations for Marathi velanti matching
    const normalizedVariations: string[] = [];
    searchQueries.forEach(q => {
      const normalized = normalizeMarathiVowels(q);
      if (normalized !== q && !searchQueries.includes(normalized)) {
        normalizedVariations.push(normalized);
      }
    });
    searchQueries.push(...normalizedVariations);
    
    // Test each query variation and take the highest score
    searchQueries.forEach(queryVariation => {
      const textLower = text.toLowerCase();
      const textNormalized = normalizeMarathiVowels(textLower);
      const queryLower = queryVariation;
      
      let score = 0;
      
      const queryNormalized = normalizeMarathiVowels(queryLower);
      
      // === EXACT MATCHES (100 points) ===
      if (textLower === queryLower || textNormalized === queryNormalized) {
        score = 100;
      }
      
      // === STARTS WITH MATCHES (90 points) ===
      else if (textLower.startsWith(queryLower) || textNormalized.startsWith(queryNormalized)) {
        score = 90;
      }
      
      // === CONTAINS MATCHES (80 points) ===
      else if (textLower.includes(queryLower) || textNormalized.includes(queryNormalized)) {
        score = 80;
      }
      
      // === WORD BOUNDARY MATCHES (75-65 points) ===
      else {
        const words = textLower.split(/\s+/);
        const wordsNorm = textNormalized.split(/\s+/);
        const queryWords = queryLower.split(/\s+/);
        
        // Check each word in text against query (original + normalized)
        for (let wi = 0; wi < words.length; wi++) {
          const word = words[wi];
          const wordNorm = wordsNorm[wi] || normalizeMarathiVowels(word);
          
          if (word.startsWith(queryLower) || wordNorm.startsWith(queryNormalized)) {
            score = Math.max(score, 75);
          } else if (word.includes(queryLower) || wordNorm.includes(queryNormalized)) {
            score = Math.max(score, 65);
          }
          
          // Check each query word against text words
          for (const queryWord of queryWords) {
            const qwNorm = normalizeMarathiVowels(queryWord);
            if (word === queryWord || wordNorm === qwNorm) {
              score = Math.max(score, 70);
            } else if (word.startsWith(queryWord) || wordNorm.startsWith(qwNorm)) {
              score = Math.max(score, 68);
            } else if (word.includes(queryWord) || wordNorm.includes(qwNorm)) {
              score = Math.max(score, 62);
            }
          }
        }
      }
      
      // === ADVANCED FUZZY MATCHING (60+ points) ===
      if (score < 60) {
        // Partial word matching - split both text and query into all possible substrings
        const textSubstrings = [];
        const querySubstrings = [];
        
        // Generate all substrings of length 2 or more
        for (let i = 0; i < textLower.length - 1; i++) {
          for (let j = i + 2; j <= textLower.length; j++) {
            textSubstrings.push(textLower.substring(i, j));
          }
        }
        
        for (let i = 0; i < queryLower.length - 1; i++) {
          for (let j = i + 2; j <= queryLower.length; j++) {
            querySubstrings.push(queryLower.substring(i, j));
          }
        }
        
        // Find matching substrings
        let substringMatches = 0;
        for (const querySub of querySubstrings) {
          if (textSubstrings.includes(querySub)) {
            substringMatches += querySub.length * 2; // Weight by length
          }
        }
        
        if (substringMatches > 0) {
          score = Math.max(score, Math.min(60, substringMatches));
        }
      }
      
      // === CHARACTER-BASED SEQUENTIAL MATCHING (40-59 points) ===
      if (score < 40) {
        let charScore = 0;
        let textIndex = 0;
        let consecutiveMatches = 0;
        
        for (let i = 0; i < queryLower.length; i++) {
          const char = queryLower[i];
          const foundIndex = textLower.indexOf(char, textIndex);
          if (foundIndex !== -1) {
            // Bonus for consecutive characters
            if (foundIndex === textIndex) {
              consecutiveMatches++;
              charScore += 8 + consecutiveMatches; // Bonus for consecutive
            } else {
              consecutiveMatches = 0;
              charScore += Math.max(1, 6 - (foundIndex - textIndex));
            }
            textIndex = foundIndex + 1;
          } else {
            consecutiveMatches = 0;
          }
        }
        score = Math.max(score, Math.min(59, charScore));
      }
      
      // === PHONETIC/SIMILAR SOUND MATCHING (30-39 points) ===
      if (score < 30) {
        // Simple phonetic similarity for common variations
        const phoneticMappings = [
          ['ph', 'f'], ['ck', 'k'], ['ch', 'sh'], ['th', 'z'], 
          ['व', 'w'], ['य', 'y'], ['र', 'r'], ['ल', 'l']
        ];
        
        let phoneticText = textLower;
        let phoneticQuery = queryLower;
        
        for (const [from, to] of phoneticMappings) {
          phoneticText = phoneticText.replace(new RegExp(from, 'g'), to);
          phoneticQuery = phoneticQuery.replace(new RegExp(from, 'g'), to);
        }
        
        if (phoneticText.includes(phoneticQuery) || phoneticQuery.includes(phoneticText)) {
          score = Math.max(score, 35);
        }
      }
      
      maxScore = Math.max(maxScore, score);
    });
    
    scoreCache.set(cacheKey, maxScore);
    return maxScore;
    };
  }, []);

  // Enhanced Smart Borrower Suggestions with Rich Data - Same as Loan Form
  const smartBorrowerSuggestions = useMemo(() => {
    if (!borrowerSearchTerm.trim()) return [];
    
    if (getUniqueBorrowers.length === 0) return [];
    
    // Get borrower details from loans data for enriched suggestions
    const loansArray = Array.isArray(loans) ? loans : [];
    const borrowerDetails = getUniqueBorrowers.map((name: string) => {
      const borrowerLoans = loansArray.filter(loan => loan.borrowerName === name);
      const latestLoan = borrowerLoans.sort((a, b) => new Date(b.loanDate || b.createdAt).getTime() - new Date(a.loanDate || a.createdAt).getTime())[0];
      
      return {
        id: `borrower-${name}`, // Unique ID for the suggestion
        name,
        mobile: latestLoan?.borrowerMobile || '',
        address: latestLoan?.borrowerAddress || '',
        score: fuzzyMatchBorrower(name, borrowerSearchTerm.trim()),
        loanCount: borrowerLoans.length,
        groupName: latestLoan?.group?.name || '',
        lastLoanDate: latestLoan?.loanDate || latestLoan?.createdAt || ''
      };
    });
    
    const suggestions = borrowerDetails
      .filter((borrower: any) => borrower.score > 25) // Show maximum possible matches with comprehensive fuzzy search
      .sort((a: any, b: any) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.name.length - b.name.length; // Shorter names first for same score
      })
      .slice(0, 8); // Limit to 8 suggestions for better UX
    
    return suggestions;
  }, [borrowerSearchTerm, getUniqueBorrowers, loans]);

  // Enhanced Keyboard Navigation & Event Handlers - Same as Loan Form
  const handleBorrowerKeyDown = (e: React.KeyboardEvent) => {
    const suggestions = smartBorrowerSuggestions;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showBorrowerSuggestions && borrowerSearchTerm.trim()) {
        setShowBorrowerSuggestions(true);
        setSelectedSuggestionIndex(0);
      } else if (showBorrowerSuggestions && suggestions.length > 0) {
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showBorrowerSuggestions && suggestions.length > 0) {
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        selectBorrowerSuggestion(suggestions[selectedSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowBorrowerSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  // Enhanced Select borrower suggestion with rich data handling
  const selectBorrowerSuggestion = (borrower: any) => {
    setSelectedBorrowerName(borrower.name);
    setBorrowerSearchTerm(borrower.name);
    setShowBorrowerSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    // Focus back to input for better UX
    setTimeout(() => {
      borrowerInputRef.current?.blur();
    }, 100);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (borrowerSuggestionsRef.current && !borrowerSuggestionsRef.current.contains(event.target as Node) &&
          borrowerInputRef.current && !borrowerInputRef.current.contains(event.target as Node)) {
        setShowBorrowerSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear borrower selection when group changes
  useEffect(() => {
    if (groupId) {
      setBorrowerSearchTerm("");
      setSelectedBorrowerName("");
      setShowBorrowerSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  }, [groupId]);
  
  // Filter loans based on report type - Memoized for performance
  const getFilteredLoans = useMemo(() => {
    const loansArray = Array.isArray(loans) ? loans : [];
    let filteredLoans = [...loansArray] as any[];
    
    // Filter by group
    if (groupId && groupId !== "all") {
      filteredLoans = filteredLoans.filter(loan => loan.groupId === groupId);
    }
    
    // Filter by date range based on active tab
    if (activeTab === 'date-wise') {
      filteredLoans = filteredLoans.filter(loan => {
        const loanDate = new Date(loan.loanDate).toISOString().split('T')[0];
        return loanDate >= dateFrom && loanDate <= dateTo;
      });
      
      // Filter by status for date-wise report
      if (dateWiseStatus === 'active') {
        filteredLoans = filteredLoans.filter(loan => loan.status !== 'closed');
      }
      // For 'all' option, no additional filtering needed
      
      // Apply centralized sorting for consistent ordering with proper date normalization
      filteredLoans = sortLoans(filteredLoans, Array.isArray(groups) ? groups : [], { dateOrder: 'asc' });
      
    } else if (activeTab === 'closing-wise') {
      // Only closed loans
      filteredLoans = filteredLoans.filter(loan => loan.status === 'closed');
      
      // Filter by selected date type - use loan_closures table for accurate closure dates
      filteredLoans = filteredLoans.filter(loan => {
        const checkDate = dateFilter === 'loan-date' 
          ? new Date(loan.loanDate).toISOString().split('T')[0]
          : (() => {
              // Find actual closure date from loan_closures table
              const closureData = (loanClosures as any[]).find((closure: any) => 
                closure.loanId === loan.id
              );
              return closureData 
                ? new Date(closureData.closureDate).toISOString().split('T')[0]
                : new Date(loan.loanDate).toISOString().split('T')[0]; // fallback
            })();
        return checkDate >= dateFrom && checkDate <= dateTo;
      });
      
      // Apply centralized sorting for consistent ordering with proper date normalization
      filteredLoans = sortLoans(filteredLoans, Array.isArray(groups) ? groups : [], { dateOrder: 'asc' });
    } else if (activeTab === 'name-wise' && selectedBorrowerName) {
      filteredLoans = filteredLoans.filter(loan => {
        // Match borrower name
        const nameMatches = loan.borrowerName === selectedBorrowerName;
        
        // Apply date filter only if enabled
        if (dateFilterEnabled && startDate && endDate) {
          const loanDate = new Date(loan.loanDate).toISOString().split('T')[0];
          return nameMatches && loanDate >= startDate && loanDate <= endDate;
        }
        
        // No date filtering - show all records for this borrower
        return nameMatches;
      });
      
      // Filter by status for name-wise report
      if (nameWiseStatus === 'active') {
        filteredLoans = filteredLoans.filter(loan => loan.status !== 'closed');
      } else if (nameWiseStatus === 'closed') {
        filteredLoans = filteredLoans.filter(loan => loan.status === 'closed');
      }
      // For 'all' option, no additional filtering needed
      
      // Apply centralized sorting for consistent ordering with proper date normalization
      filteredLoans = sortLoans(filteredLoans, Array.isArray(groups) ? groups : [], { dateOrder: 'asc' });
    } else if (activeTab === 'name-wise' && !selectedBorrowerName) {
      // PROFESSIONALISM FIX: Don't show any data when no borrower is selected in name-wise tab
      filteredLoans = [];
    } else if (activeTab === 'maturity-wise') {
      // मुदत संपलेले रिपोर्ट: checkbox filters च्या आधारे फिल्टर करा
      if (includeSpecificPeriod && !includeFutureMaturity) {
        // फक्त त्या loans ज्यांना hasMaturity=true (निश्चित मुदतीसाठी) checkbox सेट केला आहे
        filteredLoans = filteredLoans.filter(loan => loan.hasMaturity === true);
      } else if (!includeSpecificPeriod && includeFutureMaturity) {
        // भविष्यातील मेच्योरिटी: selected period मध्ये mature होणारे loans
        const today = new Date();
        const periodMonths = futureMaturityPeriod === '1month' ? 1 : 
                           futureMaturityPeriod === '3months' ? 3 :
                           futureMaturityPeriod === '6months' ? 6 : 12;
        const futureDate = new Date(today);
        futureDate.setMonth(futureDate.getMonth() + periodMonths);
        
        filteredLoans = filteredLoans.filter(loan => {
          // केवळ active loans
          if (loan.status !== 'active') return false;
          
          // प्रत्येक loan साठी maturity date calculate करा
          let maturityDate;
          if (loan.maturityDate) {
            maturityDate = new Date(loan.maturityDate);
          } else if (loan.calculatedMaturityDate) {
            maturityDate = new Date(loan.calculatedMaturityDate);
          } else if (loan.maturityMonths && loan.loanDate) {
            const loanDate = new Date(loan.loanDate);
            maturityDate = new Date(loanDate);
            maturityDate.setMonth(maturityDate.getMonth() + parseInt(loan.maturityMonths, 10));
          } else {
            // Default 12 months
            const loanDate = new Date(loan.loanDate);
            maturityDate = new Date(loanDate);
            maturityDate.setMonth(maturityDate.getMonth() + 12);
          }
          
          // Check if maturity date is between today and selected future period
          return maturityDate >= today && maturityDate <= futureDate;
        });
      } else if (includeSpecificPeriod && includeFutureMaturity) {
        // दोन्ही conditions: specific period वाले loans + future maturity filter
        const specificLoans = filteredLoans.filter(loan => loan.hasMaturity === true);
        
        // Apply future maturity filter on specific loans
        const today = new Date();
        const periodMonths = futureMaturityPeriod === '1month' ? 1 : 
                           futureMaturityPeriod === '3months' ? 3 :
                           futureMaturityPeriod === '6months' ? 6 : 12;
        const futureDate = new Date(today);
        futureDate.setMonth(futureDate.getMonth() + periodMonths);
        
        filteredLoans = specificLoans.filter(loan => {
          // केवळ active loans
          if (loan.status !== 'active') return false;
          
          // प्रत्येक loan साठी maturity date calculate करा
          let maturityDate;
          if (loan.maturityDate) {
            maturityDate = new Date(loan.maturityDate);
          } else if (loan.calculatedMaturityDate) {
            maturityDate = new Date(loan.calculatedMaturityDate);
          } else if (loan.maturityMonths && loan.loanDate) {
            const loanDate = new Date(loan.loanDate);
            maturityDate = new Date(loanDate);
            maturityDate.setMonth(maturityDate.getMonth() + parseInt(loan.maturityMonths, 10));
          } else {
            // Default 12 months
            const loanDate = new Date(loan.loanDate);
            maturityDate = new Date(loanDate);
            maturityDate.setMonth(maturityDate.getMonth() + 12);
          }
          
          // Check if maturity date is between today and selected future period
          return maturityDate >= today && maturityDate <= futureDate;
        });
      }
      // कोणताही checkbox select नसेल तर सर्व loans (12 months default + specific दोन्ही)
      
      // फक्त expired checking करा जर future filter नसेल
      if (!includeFutureMaturity || (includeSpecificPeriod && !includeFutureMaturity)) {
        // प्रत्येक loan साठी actual maturity date काढतो
        filteredLoans = filteredLoans.map(loan => {
          let actualMaturityDate;
        
          // प्राथमिकता 1: User manually set केलेली maturityDate वापरा (सर्वोच्च प्राथमिकता)
          if (loan.maturityDate) {
            actualMaturityDate = loan.maturityDate;
          }
          // प्राथमिकता 2: calculatedMaturityDate वापरा जर maturityDate नसेल
          else if (loan.calculatedMaturityDate) {
            actualMaturityDate = loan.calculatedMaturityDate;
          }
          // प्राथमिकता 3: loan date + maturityMonths पासून calculate करा
          // उदाहरण: loan date 15/06/2025 + 2 months = 15/08/2025 maturity
          else if (loan.maturityMonths && loan.loanDate) {
            const loanDate = new Date(loan.loanDate);
            const maturityDate = new Date(loanDate);
            maturityDate.setMonth(maturityDate.getMonth() + parseInt(loan.maturityMonths, 10));
            actualMaturityDate = maturityDate.toISOString().split('T')[0];
          }
          // प्राथमिकता 4: Default fallback
          else {
            actualMaturityDate = null;
          }
          
          return {
            ...loan,
            actualMaturityDate: actualMaturityDate
          };
        })
        // Date range filtering based on LOAN DISBURSEMENT dates within selected range
        // Logic: Show loans that were DISBURSED in date range AND maturity has EXPIRED by today
        // उदाहरण: loan date 15/06/2024 (range में आहे) + maturity expired by today = दिसेल
        .filter(loan => {
          const maturityDate = loan.actualMaturityDate;
          const today = new Date().toISOString().split('T')[0];
          const loanDate = loan.loanDate; // Loan disbursement date
          
          // First check: Was loan disbursed within selected date range
          const isLoanInDateRange = loanDate >= dateFrom && loanDate <= dateTo;
          
          // Second check: Is maturity date expired by today (skip loans with no maturity date)
          const isMaturedByToday = maturityDate && maturityDate <= today;
          
          // Show loan if: loan disbursed in range AND maturity expired by today
          // Skip loans without valid maturity dates
          return isLoanInDateRange && isMaturedByToday;
        });
        
      }
      
      // मुदतवाईज रिपोर्ट फक्त active loans साठी आहे
      filteredLoans = filteredLoans.filter(loan => loan.status !== 'closed');
    }
    
    // Apply centralized sorting for consistent ordering with proper date normalization
    return sortLoans(filteredLoans, Array.isArray(groups) ? groups : [], { dateOrder: 'asc' });
  }, [activeTab, groupId, dateFrom, dateTo, dateWiseStatus, dateFilter, selectedBorrowerName, nameWiseStatus, maturityWiseStatus, includeSpecificPeriod, includeFutureMaturity, futureMaturityPeriod, dateFilterEnabled, startDate, endDate, loans, loanClosures, groups]);

  // Pagination logic for current page data
  const getPaginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return getFilteredLoans.slice(startIndex, endIndex);
  }, [getFilteredLoans, currentPage, itemsPerPage]);

  // Calculate pagination info
  const totalItems = getFilteredLoans.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, groupId, dateFrom, dateTo, dateWiseStatus, selectedBorrowerName, nameWiseStatus, maturityWiseStatus]);
  
  // Enhanced Generate report with mobile detection
  const handleGenerateReport = () => {
    const filteredLoans = getFilteredLoans;
    
    if (filteredLoans.length === 0) {
      toast({
        title: "माहिती आढळली नाही",
        description: "निवडलेल्या निकषांसाठी कोणतीही माहिती सापडली नाही",
        variant: "destructive",
      });
      return;
    }
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      handleMobilePdfDownload(filteredLoans);
    } else {
      printReport(filteredLoans);
    }
  };

  const handleMobilePdfDownload = async (reportData: any[]) => {
    const selectedGroup = Array.isArray(groups) ? groups.find(g => g.id === groupId) : null;
    const groupName = selectedGroup?.name || 'सर्व गट';

    toast({
      title: "PDF तयार करत आहे...",
      description: "कृपया थांबा, A4 PDF डाउनलोड होईल",
    });

    try {
      const reportHTML = generateReportHTML(reportData, groupName);

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '1123px';
      container.style.background = '#ffffff';

      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(reportHTML, 'text/html');
      const bodyContent = htmlDoc.body.innerHTML;
      const originalStyle = htmlDoc.head.querySelector('style')?.textContent || '';

      let printCss = '';
      const printStartIdx = originalStyle.indexOf('@media print');
      if (printStartIdx !== -1) {
        let braceCount = 0;
        let started = false;
        let contentStart = 0;
        for (let i = printStartIdx; i < originalStyle.length; i++) {
          if (originalStyle[i] === '{') {
            if (!started) { started = true; contentStart = i + 1; }
            braceCount++;
          } else if (originalStyle[i] === '}') {
            braceCount--;
            if (braceCount === 0 && started) {
              printCss = originalStyle.substring(contentStart, i);
              break;
            }
          }
        }
      }

      let baseStyle = originalStyle.replace(/@page\s*\{[^}]*\}/g, '');
      if (printStartIdx !== -1) {
        const printBlockStart = printStartIdx;
        let bc = 0; let st = false;
        for (let i = printBlockStart; i < baseStyle.length; i++) {
          if (baseStyle[i] === '{') { st = true; bc++; }
          else if (baseStyle[i] === '}') { bc--; if (bc === 0 && st) { baseStyle = baseStyle.substring(0, printBlockStart) + baseStyle.substring(i + 1); break; } }
        }
      }

      container.innerHTML = `
        <style>
          ${baseStyle}
          ${printCss}
          .mobile-hide { display: table-cell !important; }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          .header {
            display: none !important;
          }
          .company-name {
            display: none !important;
          }
          .report-info {
            background: none !important;
            border: none !important;
            border-radius: 0 !important;
            border-bottom: 1.5px solid #000 !important;
            padding: 4px 4px 6px !important;
            margin-bottom: 6px !important;
          }
          .report-info div {
            color: #000 !important;
          }

          table {
            table-layout: fixed !important;
            width: 100% !important;
            border-collapse: collapse !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          th {
            background: #e8e8e8 !important;
            color: #000 !important;
            font-weight: 700 !important;
            border-top: 1.5px solid #000 !important;
            border-bottom: 1.5px solid #000 !important;
            border-left: none !important;
            border-right: none !important;
            text-align: center !important;
            padding: 8px 4px !important;
            font-size: 15px !important;
            line-height: 1.3 !important;
            height: 44px !important;
          }
          th:nth-child(1) { min-width: 55px !important; width: 55px !important; }
          th[style*="font-size: 10px"] {
            font-size: 11px !important;
            line-height: 1.15 !important;
            word-break: keep-all !important;
          }
          td {
            border-bottom: 0.5px solid #bbb !important;
            border-left: none !important;
            border-right: none !important;
            border-top: none !important;
            color: #000 !important;
            background: transparent !important;
          }
          tr:nth-child(even) { background-color: transparent !important; }
          tr:nth-child(odd) { background-color: transparent !important; }
          tr:hover { background-color: transparent !important; }

          .footer {
            border-top: 1px solid #000 !important;
            color: #333 !important;
            background: none !important;
          }

          td:nth-child(1) { text-align: center !important; min-width: 55px !important; width: 55px !important; }
          td:nth-child(5) { text-align: center !important; }

          .closing-wise-table td:nth-child(7) { text-align: center !important; }
          .closing-wise-table td:nth-child(9) { text-align: center !important; }
          .maturity-wise-table td:nth-child(5) { text-align: center !important; }
        </style>
        ${bodyContent}
      `;

      document.body.appendChild(container);

      await new Promise(resolve => setTimeout(resolve, 600));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 1123,
        windowWidth: 1123,
      });

      document.body.removeChild(container);

      const a4Width = 210;
      const a4Height = 297;
      const margin = 5;
      const contentWidth = a4Width - (margin * 2);
      const contentHeight = a4Height - (margin * 2);

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = contentWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      const pageContentHeight = contentHeight;
      const totalPages = Math.ceil(scaledHeight / pageContentHeight);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        const sourceY = (page * pageContentHeight) / ratio;
        const sourceHeight = Math.min(pageContentHeight / ratio, imgHeight - sourceY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = sourceHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
        }

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const drawHeight = sourceHeight * ratio;
        pdf.addImage(pageImgData, 'JPEG', margin, margin, contentWidth, drawHeight);
      }

      const tabName = activeTab === 'date-wise' ? 'डेटवाईज' : activeTab === 'closing-wise' ? 'क्लोजिंगवाईज' : activeTab === 'name-wise' ? 'नेमवाईज' : 'मुदतवाईज';
      pdf.save(`कर्जदार_यादी_${tabName}_${groupName}.pdf`);

      toast({
        title: "PDF डाउनलोड झाली",
        description: `${reportData.length} नोंदी सह A4 PDF तयार झाली`,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "PDF त्रुटी",
        description: "PDF तयार करताना समस्या आली, कृपया पुन्हा प्रयत्न करा",
        variant: "destructive",
      });
    }
  };

  // Enhanced Direct Print function for mobile compatibility
  const handleDirectPrint = (reportData: any[]) => {
    const selectedGroup = Array.isArray(groups) ? groups.find(g => g.id === groupId) : null;
    const groupName = selectedGroup?.name || 'सर्व गट';
    
    try {
      // Generate print content
      const printHTML = generateReportHTML(reportData, groupName);
      
      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(printHTML);
        iframeDoc.close();
        
        // Wait for content to load, then print
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            
            // Clean up iframe after printing
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 1000);
          } catch (printError) {
            // Fallback: show toast with download option
            toast({
              title: "प्रिंट उपलब्ध नाही",
              description: "Excel मध्ये Export करा किंवा पॉप-अप वापरा",
              variant: "destructive",
            });
            document.body.removeChild(iframe);
          }
        }, 500);
      }
    } catch (error) {
      toast({
        title: "प्रिंट त्रुटी",
        description: "कृपया Excel Export वापरा",
        variant: "destructive",
      });
    }
  };

  // Generate Report HTML (shared function for both popup and direct print)
  const generateReportHTML = (reportData: any[], groupName: string) => {
    // Helper function to get photo indicator (hidden in print)
    const getPhotoIndicator = (loanId: string) => {
      const photoInfo = photoAvailabilityMap.get(loanId);
      if (photoInfo && photoInfo.hasPhotos) {
        return `<span class="no-print" style="color: #10b981; font-weight: bold; margin-right: 4px;" title="${photoInfo.photoCount} फोटो उपलब्ध">📸</span>`;
      }
      return '';
    };
    const getUnsecuredDetails = (loan: any) => {
      const parts = [loan.specialConditions, loan.documentDetails, loan.otherInfo].filter((v: string) => v && v !== '—' && v.trim() !== '');
      return parts.length > 0 ? parts.join(' | ') : '—';
    };
    let reportTitle = '';
    let tableHeaders = '';
    let tableRows = '';

    // Common table headers for all report types - PRINT LAYOUT with precise measurements
    const commonHeaders = `
      <tr style="border-bottom: 2px solid #000; height: 35px;">
        <th style="border-bottom: 1px solid #000; padding: 2px; width: 26px; text-align: center; font-size: 12px; height: 35px; vertical-align: middle; font-weight: bold;">अ.क्र.</th>
        <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 30px; text-align: center; font-size: 12px; height: 35px; vertical-align: middle; font-weight: bold;">तारीख</th>
        <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 58px; font-size: 8px; text-align: left; line-height: 1.2; height: 35px; vertical-align: middle; font-weight: bold; white-space: nowrap; padding-left: 5px;">अं.बा.<br/>मूल्य</th>
        <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 195px; font-size: 12px; height: 35px; vertical-align: middle; font-weight: bold;">नाव</th>
        <th class="mobile-hide" style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 48px; text-align: center; font-size: 12px; height: 35px; vertical-align: middle; font-weight: bold;">कोड नं</th>
        <th class="mobile-hide" style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: auto; min-width: 80px; font-size: 12px; height: 35px; vertical-align: middle; font-weight: bold;">वस्तूचा तपशील</th>
        <th class="mobile-hide" style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 46px; text-align: center; font-size: 12px; height: 35px; vertical-align: middle; font-weight: bold;">वजन</th>
      </tr>
    `;
    
    // Maturity-wise headers with maturity date column - Better spacing and proper table layout
    const maturityHeaders = `
      <tr style="border-bottom: 2px solid #000; height: 45px;">
        <th style="border-bottom: 1px solid #000; padding: 8px; width: 26px; text-align: center; font-size: 12px; height: 45px; vertical-align: middle; font-weight: bold;">अ.क्र.</th>
        <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 8px; width: 40px; text-align: center; font-size: 12px; height: 45px; vertical-align: middle; font-weight: bold;">तारीख</th>
        <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 8px; width: 48px; text-align: center; font-size: 12px; height: 45px; vertical-align: middle; font-weight: bold;">मुदत</th>
        <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 8px; width: 55px; font-size: 8px; text-align: center; line-height: 1.2; height: 45px; vertical-align: middle; font-weight: bold; white-space: nowrap;">अं.बा.<br/>मूल्य</th>
        <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 8px; width: 121px; font-size: 12px; height: 45px; vertical-align: middle; font-weight: bold; text-align: left;">नाव</th>
        <th class="mobile-hide" style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 8px; width: 48px; text-align: left; font-size: 12px; height: 45px; vertical-align: middle; font-weight: bold;">कोड नं</th>
        <th class="mobile-hide" style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 8px; width: auto; font-size: 12px; height: 45px; vertical-align: middle; font-weight: bold; text-align: left;">वस्तूचा तपशील</th>
        <th class="mobile-hide" style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 8px; width: 42px; text-align: center; font-size: 12px; height: 45px; vertical-align: middle; font-weight: bold;">वजन</th>
      </tr>
    `;

    if (activeTab === 'date-wise') {
      reportTitle = 'डेट वाईज रिपोर्ट';
      tableHeaders = commonHeaders;
      
      tableRows = reportData.map((loan, index) => {
        const isClosedLoan = loan.status === 'closed';
        const rowStyle = isClosedLoan && dateWiseStatus === 'all' 
          ? 'background-color: #ffebee; color: #c62828;' 
          : '';
        
        const loanDate = new Date(loan.loanDate);
        const day = String(loanDate.getDate()).padStart(2, '0');
        const month = String(loanDate.getMonth() + 1).padStart(2, '0');
        const year = String(loanDate.getFullYear()).slice(-2);
        const shortDate = `${day}/${month}/${year}`;
        
        
        // COLUMN ORDER FIXED: अ.क्र., तारीख, अंदाजे बाजार मूल्य, नाव, कोड नं, वस्तूचा तपशील, वजन
        return `
          <tr data-row-index="${index}" data-loan='${JSON.stringify(loan).replace(/'/g, "&apos;")}' style="${rowStyle} border-bottom: 1px solid #ccc; height: 40px; min-height: 40px; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor=''" class="loan-row">
            <td style="border-bottom: 1px solid #ccc; padding: 4px; text-align: center; width: 26px; font-size: 14px; vertical-align: middle; font-weight: 500;">${index + 1}</td>
            <td style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; text-align: center; width: 30px; font-size: 14px; vertical-align: middle; font-weight: 500;">${shortDate}</td>
            <td style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; text-align: left; width: 58px; font-size: 14px; vertical-align: middle; font-weight: 500; padding-left: 5px;" class="loan-amount">${Math.round(loan.principalAmount).toLocaleString('en-IN')}</td>
            <td style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; width: 195px; font-size: 14px; vertical-align: middle; font-weight: 500;">${getPhotoIndicator(loan.id)}${loan.borrowerName.length > 30 ? loan.borrowerName.substring(0, 30) + '...' : loan.borrowerName}${isClosedLoan && dateWiseStatus === 'all' ? ' (बंद)' : ''}</td>
            <td class="mobile-hide" style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; text-align: center; width: 48px; font-size: 14px; vertical-align: middle; font-weight: 500;">${(loan.accountNumber || loan.id.slice(0, 5)).toString().substring(0, 7)}</td>
            <td class="mobile-hide" style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; width: auto; font-size: 14px; word-wrap: break-word; white-space: normal; vertical-align: middle; line-height: 1.3; overflow-wrap: break-word; font-weight: 500;">${loan.loanType === 'विनातारण' ? getUnsecuredDetails(loan) : (loan.itemDescription || loan.collateralDetails || 'सोन्याचे दागिने, अंगूठी, कंगन, नथ, हार इत्यादी')}</td>
            <td class="mobile-hide" style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; text-align: center; width: 46px; font-size: 14px; vertical-align: middle; font-weight: 500;">${loan.loanType === 'विनातारण' ? '—' : (loan.weight ? parseFloat(loan.weight.toString()).toFixed(2) : '0')}</td>
          </tr>
        `;
      }).join('');
    } else if (activeTab === 'name-wise') {
      reportTitle = 'नेम वाईज रिपोर्ट';
      tableHeaders = commonHeaders;
      
      tableRows = reportData.map((loan, index) => {
        const isClosedLoan = loan.status === 'closed';
        const rowStyle = isClosedLoan && nameWiseStatus === 'all' 
          ? 'background-color: #ffebee; color: #c62828;' 
          : '';
        
        const loanDate = new Date(loan.loanDate);
        const day = String(loanDate.getDate()).padStart(2, '0');
        const month = String(loanDate.getMonth() + 1).padStart(2, '0');
        const year = String(loanDate.getFullYear()).slice(-2);
        const shortDate = `${day}/${month}/${year}`;
        
        // COLUMN ORDER FIXED FOR NAME-WISE: अ.क्र., तारीख, अंदाजे बाजार मूल्य, नाव, कोड नं, वस्तूचा तपशील, वजन
        return `
          <tr data-row-index="${index}" data-loan='${JSON.stringify(loan).replace(/'/g, "&apos;")}' style="${rowStyle} border-bottom: 1px solid #ccc; height: 40px; min-height: 40px; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor=''" class="loan-row">
            <td style="border-bottom: 1px solid #ccc; padding: 4px; text-align: center; width: 26px; font-size: 14px; vertical-align: middle; font-weight: 500;">${index + 1}</td>
            <td style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; text-align: center; width: 30px; font-size: 14px; vertical-align: middle; font-weight: 500;">${shortDate}</td>
            <td style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; text-align: left; width: 58px; font-size: 14px; vertical-align: middle; font-weight: 500; padding-left: 5px;" class="loan-amount">${Math.round(loan.principalAmount).toLocaleString('en-IN')}</td>
            <td style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; width: 195px; font-size: 14px; vertical-align: middle; font-weight: 500;">${getPhotoIndicator(loan.id)}${loan.borrowerName.length > 30 ? loan.borrowerName.substring(0, 30) + '...' : loan.borrowerName}${isClosedLoan && nameWiseStatus === 'all' ? ' (बंद)' : ''}</td>
            <td class="mobile-hide" style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; text-align: center; width: 48px; font-size: 14px; vertical-align: middle; font-weight: 500;">${(loan.accountNumber || loan.id.slice(0, 5)).toString().substring(0, 7)}</td>
            <td class="mobile-hide" style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; width: auto; font-size: 14px; word-wrap: break-word; white-space: normal; vertical-align: middle; line-height: 1.3; overflow-wrap: break-word; font-weight: 500;">${loan.loanType === 'विनातारण' ? getUnsecuredDetails(loan) : (loan.itemDescription || loan.collateralDetails || 'सोन्याचे दागिने, अंगूठी, कंगन, नथ, हार इत्यादी')}</td>
            <td class="mobile-hide" style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 4px; text-align: center; width: 46px; font-size: 14px; vertical-align: middle; font-weight: 500;">${loan.loanType === 'विनातारण' ? '—' : (loan.weight ? parseFloat(loan.weight.toString()).toFixed(2) : '0')}</td>
          </tr>
        `;
      }).join('');
    } else if (activeTab === 'closing-wise') {
      reportTitle = 'क्लोजिंग वाईज रिपोर्ट';
      
      // Modified headers for closing-wise report with precise PRINT column measurements
      tableHeaders = `
        <tr style="border-bottom: 2px solid #000; height: 35px;">
          <th style="border-bottom: 1px solid #000; padding: 2px; width: 30px; text-align: center; font-size: 11px; height: 35px; vertical-align: middle; font-weight: bold;">अ.क्र.</th>
          <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 58px; text-align: center; font-size: 11px; height: 35px; vertical-align: middle; font-weight: bold;">कर्ज तारीख</th>
          <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 58px; text-align: center; font-size: 11px; height: 35px; vertical-align: middle; font-weight: bold;">बंद तारीख</th>
          <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 65px; font-size: 8px; text-align: left; line-height: 1.2; height: 35px; vertical-align: middle; font-weight: bold; white-space: nowrap; padding-left: 5px;">अं.बा.<br/>मूल्य</th>
          <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 55px; text-align: left; font-size: 11px; height: 35px; vertical-align: middle; font-weight: bold; padding-left: 5px;">चार्जेस</th>
          <th style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 120px; font-size: 11px; height: 35px; vertical-align: middle; font-weight: bold; text-align: left; padding-left: 4px;">नाव</th>
          <th class="mobile-hide" style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 44px; text-align: center; font-size: 11px; height: 35px; vertical-align: middle; font-weight: bold;">कोड नं</th>
          <th class="mobile-hide" style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: auto; min-width: 60px; font-size: 11px; height: 35px; vertical-align: middle; font-weight: bold; text-align: left;">वस्तूचा तपशील</th>
          <th class="mobile-hide" style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px; width: 40px; text-align: center; font-size: 11px; height: 35px; vertical-align: middle; font-weight: bold;">वजन</th>
        </tr>
      `;
      
      tableRows = reportData.map((loan, index) => {
        const loanDate = new Date(loan.loanDate);
        const loanDay = String(loanDate.getDate()).padStart(2, '0');
        const loanMonth = String(loanDate.getMonth() + 1).padStart(2, '0');
        const loanYear = String(loanDate.getFullYear()).slice(-2);
        const shortLoanDate = `${loanDay}/${loanMonth}/${loanYear}`;
        
        // Get closure data for this loan
        const closureData = (loanClosures as any[]).find((closure: any) => 
          closure.loanId === loan.id
        );
        
        // Format closure date
        let shortClosureDate = '-';
        if (closureData && closureData.closureDate) {
          const closureDate = new Date(closureData.closureDate);
          const closureDay = String(closureDate.getDate()).padStart(2, '0');
          const closureMonth = String(closureDate.getMonth() + 1).padStart(2, '0');
          const closureYear = String(closureDate.getFullYear()).slice(-2);
          shortClosureDate = `${closureDay}/${closureMonth}/${closureYear}`;
        }
        
        // Get interest paid (charges)
        const interestPaid = closureData && closureData.interestPaid 
          ? Math.round(parseFloat(closureData.interestPaid)).toLocaleString('en-IN')
          : '0';
        
        return `
          <tr data-row-index="${index}" data-loan='${JSON.stringify(loan).replace(/'/g, "&apos;")}' style="border-bottom: 1px solid #ccc; height: auto; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor=''" class="loan-row">
            <td style="border-bottom: 1px solid #ccc; padding: 3px 2px; text-align: center; width: 30px; font-size: 13px; vertical-align: middle; font-weight: 500;">${index + 1}</td>
            <td style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 3px 2px; text-align: center; width: 58px; font-size: 13px; vertical-align: middle; font-weight: 500;">${shortLoanDate}</td>
            <td style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 3px 2px; text-align: center; width: 58px; font-size: 13px; vertical-align: middle; font-weight: 500;">${shortClosureDate}</td>
            <td style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 3px 2px; text-align: left; width: 65px; font-size: 13px; vertical-align: middle; font-weight: 500; padding-left: 5px;" class="loan-amount">${Math.round(loan.principalAmount).toLocaleString('en-IN')}</td>
            <td style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 3px 2px; text-align: left; width: 55px; font-size: 13px; vertical-align: middle; font-weight: 500; padding-left: 5px;" class="interest-amount">${interestPaid}</td>
            <td style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 3px 2px; width: 120px; font-size: 13px; vertical-align: middle; font-weight: 500; text-align: left; padding-left: 4px;">${getPhotoIndicator(loan.id)}${loan.borrowerName.length > 18 ? loan.borrowerName.substring(0, 18) + '...' : loan.borrowerName}</td>
            <td class="mobile-hide" style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 3px 2px; text-align: center; width: 44px; font-size: 13px; vertical-align: middle; font-weight: 500;">${(loan.accountNumber || loan.id.slice(0, 5)).toString().substring(0, 7)}</td>
            <td class="mobile-hide" style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 3px 2px; width: auto; min-width: 60px; font-size: 13px; word-wrap: break-word; white-space: normal; vertical-align: middle; line-height: 1.3; overflow-wrap: break-word; font-weight: 500; text-align: left;">${loan.loanType === 'विनातारण' ? getUnsecuredDetails(loan) : ((loan.itemDescription || loan.collateralDetails || 'सोन्याचे दागिने, अंगूठी, कंगन, नथ, हार इत्यादी').replace(/^\d+[\s-]*/, '').trim() || 'सोन्याचे दागिने, अंगूठी, कंगन, नथ, हार इत्यादी')}</td>
            <td class="mobile-hide" style="border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 3px 2px; text-align: center; width: 40px; font-size: 13px; vertical-align: middle; font-weight: 500;">${loan.loanType === 'विनातारण' ? '—' : (loan.weight ? parseFloat(loan.weight.toString()).toFixed(2) : '0')}</td>
          </tr>
        `;
      }).join('');
    } else if (activeTab === 'maturity-wise') {
      reportTitle = `मुदत संपलेले रिपोर्ट`;
      
      // 🎯 COMPLETELY FRESH MATURITY-WISE DESIGN - Independent & Optimized
      tableHeaders = `
        <tr class="maturity-report-header" style="border-bottom: 3px solid #000000; height: 50px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
          <th class="maturity-col-serial" style="border-bottom: 2px solid #000000; padding: 10px 4px; width: 45px; text-align: center; font-size: 14px; font-weight: bold; color: #ffffff; vertical-align: middle; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">अ.क्र.</th>
          <th class="maturity-col-date" style="border-bottom: 2px solid #000000; border-left: 1px solid #ffffff; padding: 10px 4px; width: 75px; text-align: center; font-size: 14px; font-weight: bold; color: #ffffff; vertical-align: middle; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">तारीख</th>
          <th class="maturity-col-amount" style="border-bottom: 2px solid #000000; border-left: 1px solid #ffffff; padding: 10px 4px; width: 70px; font-size: 10px; text-align: center; line-height: 1.2; font-weight: bold; color: #ffffff; vertical-align: middle; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); white-space: nowrap;">अं.बा.<br/>मूल्य</th>
          <th class="maturity-col-name" style="border-bottom: 2px solid #000000; border-left: 1px solid #ffffff; padding: 10px 4px; width: 200px; font-size: 14px; font-weight: bold; color: #ffffff; vertical-align: middle; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">नाव</th>
          <th class="maturity-col-code mobile-hide" style="border-bottom: 2px solid #000000; border-left: 1px solid #ffffff; padding: 10px 4px; width: 70px; text-align: center; font-size: 12px; font-weight: bold; color: #ffffff; vertical-align: middle; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">कोड नं</th>
          <th class="maturity-col-details mobile-hide" style="border-bottom: 2px solid #000000; border-left: 1px solid #ffffff; padding: 10px 4px; width: auto; font-size: 12px; font-weight: bold; color: #ffffff; vertical-align: middle; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">वस्तूचा तपशील</th>
          <th class="maturity-col-weight mobile-hide" style="border-bottom: 2px solid #000000; border-left: 1px solid #ffffff; padding: 10px 4px; width: 70px; text-align: center; font-size: 12px; font-weight: bold; color: #ffffff; vertical-align: middle; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">वजन</th>
          <th class="maturity-col-maturity mobile-hide" style="border-bottom: 2px solid #000000; border-left: 1px solid #ffffff; padding: 10px 4px; width: 60px; text-align: center; font-size: 14px; font-weight: bold; color: #fbbf24; vertical-align: middle; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">मुदत</th>
        </tr>
      `;
      
      // 🎯 FRESH MATURITY-WISE ROW DESIGN - Professional & Clean
      tableRows = reportData.map((loan, index) => {
        // Loan Date Formatting
        const loanDate = new Date(loan.loanDate);
        const day = String(loanDate.getDate()).padStart(2, '0');
        const month = String(loanDate.getMonth() + 1).padStart(2, '0');
        const year = String(loanDate.getFullYear()).slice(-2);
        const shortDate = `${day}/${month}/${year}`;
        
        // Maturity Date with Priority Logic
        let shortMaturityDate = '';
        if (loan.actualMaturityDate) {
          const maturityDate = new Date(loan.actualMaturityDate);
          const matDay = String(maturityDate.getDate()).padStart(2, '0');
          const matMonth = String(maturityDate.getMonth() + 1).padStart(2, '0');
          const matYear = String(maturityDate.getFullYear()).slice(-2);
          shortMaturityDate = `${matDay}/${matMonth}/${matYear}`;
        } else {
          // Fallback calculation
          const maturityDate = new Date(loan.loanDate);
          maturityDate.setMonth(maturityDate.getMonth() + (loan.maturityMonths || 12));
          const matDay = String(maturityDate.getDate()).padStart(2, '0');
          const matMonth = String(maturityDate.getMonth() + 1).padStart(2, '0');
          const matYear = String(maturityDate.getFullYear()).slice(-2);
          shortMaturityDate = `${matDay}/${matMonth}/${matYear}`;
        }
        
        // Row Styling with Alternating Colors
        const rowBgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        const hoverColor = '#e0f2fe';
        
        return `
          <tr data-row-index="${index}" data-loan='${JSON.stringify(loan).replace(/'/g, "&apos;")}' class="maturity-report-row loan-row" style="border-bottom: 1px solid #e2e8f0; height: 42px; background-color: ${rowBgColor}; transition: background-color 0.2s; cursor: pointer;" onmouseover="this.style.backgroundColor='${hoverColor}'; const maturityCell = this.querySelector('.maturity-cell-maturity'); if(maturityCell) { maturityCell.style.backgroundColor='#ffffff'; maturityCell.style.color='#1f2937'; maturityCell.style.fontWeight='700'; }" onmouseout="this.style.backgroundColor='${rowBgColor}'; const maturityCell = this.querySelector('.maturity-cell-maturity'); if(maturityCell) { maturityCell.style.backgroundColor='#fef2f2'; maturityCell.style.color='#dc2626'; maturityCell.style.fontWeight='700'; }">\
            <td class="maturity-cell-serial" style="padding: 8px 4px; text-align: center; width: 26px; font-size: 14px; font-weight: 600; color: #374151; vertical-align: middle;">${index + 1}</td>
            <td class="maturity-cell-date" style="border-left: 1px solid #e5e7eb; padding: 8px 4px; text-align: center; width: 40px; font-size: 14px; font-weight: 500; color: #1f2937; vertical-align: middle;">${shortDate}</td>
            <td class="maturity-cell-amount" style="border-left: 1px solid #e5e7eb; padding: 8px 4px; text-align: right; width: 70px; font-size: 14px; font-weight: 600; color: #059669; vertical-align: middle;">
              ${Math.round(loan.principalAmount).toLocaleString('en-IN')}
            </td>
            <td class="maturity-cell-name" style="border-left: 1px solid #e5e7eb; padding: 8px 4px; width: 200px; font-size: 14px; font-weight: 500; color: #1f2937; vertical-align: middle; word-wrap: break-word;">${getPhotoIndicator(loan.id)}${loan.borrowerName.length > 28 ? loan.borrowerName.substring(0, 28) + '...' : loan.borrowerName}</td>
            <td class="maturity-cell-code mobile-hide" style="border-left: 1px solid #e5e7eb; padding: 8px 4px; text-align: center; width: 50px; font-size: 14px; font-weight: 600; color: #000000; vertical-align: middle;">${(loan.accountNumber || loan.id.slice(0, 5)).toString().substring(0, 7)}</td>
            <td class="maturity-cell-details mobile-hide" style="border-left: 1px solid #e5e7eb; padding: 8px 4px; width: auto; font-size: 13px; font-weight: 400; color: #4b5563; vertical-align: middle; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">${loan.loanType === 'विनातारण' ? getUnsecuredDetails(loan) : (loan.itemDescription || loan.collateralDetails || 'सोन्याचे दागिने, अंगूठी, कंगन, नथ, हार इत्यादी').substring(0, 80)}</td>
            <td class="maturity-cell-weight mobile-hide" style="border-left: 1px solid #e5e7eb; padding: 8px 4px; text-align: center; width: 50px; font-size: 14px; font-weight: 500; color: #6b7280; vertical-align: middle;">${loan.loanType === 'विनातारण' ? '—' : (loan.weight ? parseFloat(loan.weight.toString()).toFixed(2) : '0')}</td>
            <td class="maturity-cell-maturity mobile-hide" style="border-left: 1px solid #e5e7eb; padding: 8px 4px; text-align: center; width: 60px; font-size: 14px; font-weight: 700; color: #dc2626; vertical-align: middle; background-color: #fef2f2;">${shortMaturityDate}</td>
          </tr>
        `;
      }).join('');
    }

    // Calculate totals
    const totalAmount = reportData.reduce((sum, loan) => sum + Math.round(loan.principalAmount), 0);
    const totalGoldWeight = reportData.reduce((sum, loan) => {
      if (loan.loanType === 'विनातारण' || loan.metalType === 'silver') return sum;
      const w = parseFloat((loan.weight || '0').toString().replace(/[^0-9.]/g, '')) || 0;
      return sum + w;
    }, 0);
    const totalSilverWeight = reportData.reduce((sum, loan) => {
      if (loan.metalType !== 'silver') return sum;
      const w = parseFloat((loan.weight || '0').toString().replace(/[^0-9.]/g, '')) || 0;
      return sum + w;
    }, 0);
    const totalWeight = totalGoldWeight + totalSilverWeight;
    const formatWeight = (w: number) => w % 1 === 0 ? w.toString() : w.toFixed(2);
    const weightDisplay = totalSilverWeight > 0 ? `सोने: ${formatWeight(totalGoldWeight)}g | चांदी: ${formatWeight(totalSilverWeight)}g` : `${formatWeight(totalWeight)}`;
    
    // Calculate total interest for closing-wise report
    const totalInterest = activeTab === 'closing-wise' ? reportData.reduce((sum, loan) => {
      const closureData = (loanClosures as any[]).find((closure: any) => 
        closure.loanId === loan.id
      );
      const interestPaid = closureData && closureData.interestPaid 
        ? parseFloat(closureData.interestPaid)
        : 0;
      return sum + Math.round(interestPaid);
    }, 0) : 0;

    // Add totals row - different structure for closing-wise report with precise column alignment
    let totalsRow = '';
    if (activeTab === 'closing-wise') {
      totalsRow = `
        <tr class="total-row" style="border-top: 2px solid #000; background-color: #f9f9f9; font-weight: bold; height: 40px;">
          <td style="border-top: 2px solid #000; padding: 3px 2px; text-align: center; vertical-align: middle; width: 30px;"></td>
          <td style="border-top: 2px solid #000; padding: 3px 2px; text-align: center; vertical-align: middle; width: 58px;"></td>
          <td style="border-top: 2px solid #000; border-left: 1px solid #000; padding: 3px 2px; font-size: 12px; text-align: center; vertical-align: middle; font-weight: bold; width: 58px;">एकूण:</td>
          <td style="border-top: 2px solid #000; border-left: 1px solid #000; padding: 3px 2px; text-align: left; font-size: 12px; font-weight: bold; vertical-align: middle; width: 65px; padding-left: 5px;">${totalAmount.toLocaleString('en-IN')}</td>
          <td style="border-top: 2px solid #000; border-left: 1px solid #000; padding: 3px 2px; text-align: left; font-size: 12px; font-weight: bold; vertical-align: middle; width: 55px; padding-left: 5px;">${totalInterest.toLocaleString('en-IN')}</td>
          <td style="border-top: 2px solid #000; padding: 3px 2px; vertical-align: middle; width: 120px;"></td>
          <td class="mobile-hide" style="border-top: 2px solid #000; padding: 3px 2px; vertical-align: middle; width: 44px;"></td>
          <td class="mobile-hide" style="border-top: 2px solid #000; padding: 3px 2px; vertical-align: middle; width: auto;"></td>
          <td class="mobile-hide" style="border-top: 2px solid #000; padding: 3px 2px; text-align: center; font-size: 12px; font-weight: bold; vertical-align: middle; width: 40px;">${weightDisplay}</td>
        </tr>
      `;
    } else if (activeTab === 'maturity-wise') {
      // 🎯 FRESH MATURITY-WISE TOTALS ROW - Professional Design
      totalsRow = `
        <tr class="maturity-totals-row" style="border-top: 3px solid #1e40af; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; font-weight: bold; height: 50px;">
          <td class="maturity-total-serial" style="border-top: 2px solid #1e40af; padding: 8px 4px; text-align: center; vertical-align: middle; width: 30px; font-size: 16px; font-weight: bold;"></td>
          <td class="maturity-total-label" style="border-top: 2px solid #1e40af; border-left: 1px solid #60a5fa; padding: 8px 4px; font-size: 16px; text-align: center; vertical-align: middle; font-weight: bold; width: 60px;">एकूण:</td>
          <td class="maturity-total-amount" style="border-top: 2px solid #1e40af; border-left: 1px solid #60a5fa; padding: 8px 4px; text-align: right; font-size: 16px; font-weight: bold; vertical-align: middle; width: 70px; color: #fef3c7;">${totalAmount.toLocaleString('en-IN')}</td>
          <td class="maturity-total-space" style="border-top: 2px solid #1e40af; border-left: 1px solid #60a5fa; padding: 8px 4px; vertical-align: middle; width: 200px;"></td>
          <td class="maturity-total-code mobile-hide" style="border-top: 2px solid #1e40af; border-left: 1px solid #60a5fa; padding: 8px 4px; vertical-align: middle; width: 50px;"></td>
          <td class="maturity-total-details mobile-hide" style="border-top: 2px solid #1e40af; border-left: 1px solid #60a5fa; padding: 8px 4px; vertical-align: middle; width: auto;"></td>
          <td class="maturity-total-weight mobile-hide" style="border-top: 2px solid #1e40af; border-left: 1px solid #60a5fa; padding: 8px 4px; text-align: center; font-size: 16px; font-weight: bold; vertical-align: middle; width: 50px; color: #fef3c7;">${weightDisplay}</td>
          <td class="maturity-total-maturity mobile-hide" style="border-top: 2px solid #1e40af; border-left: 1px solid #60a5fa; padding: 8px 4px; text-align: center; font-size: 14px; font-weight: 600; vertical-align: middle; width: 60px; color: #fbbf24;">कुल: ${reportData.length}</td>
        </tr>
      `;
    } else {
      // Default totals row for date-wise and name-wise reports
      totalsRow = `
        <tr style="border-top: 2px solid #000; background-color: #f9f9f9; font-weight: bold; height: 40px;">
          <td style="border-top: 2px solid #000; padding: 4px; text-align: center; vertical-align: middle; width: 39px;"></td>
          <td style="border-top: 2px solid #000; border-left: 1px solid #000; padding: 4px; font-size: 14px; text-align: center; vertical-align: middle; font-weight: bold; width: 60px;">एकूण:</td>
          <td style="border-top: 2px solid #000; border-left: 1px solid #000; padding: 4px; text-align: right; font-size: 14px; font-weight: bold; vertical-align: middle; width: 70px;">${totalAmount.toLocaleString('en-IN')}</td>
          <td style="border-top: 2px solid #000; border-left: 1px solid #000; padding: 4px; vertical-align: middle; width: 200px;"></td>
          <td class="mobile-hide" style="border-top: 2px solid #000; border-left: 1px solid #000; padding: 4px; vertical-align: middle; width: 70px;"></td>
          <td class="mobile-hide" style="border-top: 2px solid #000; border-left: 1px solid #000; padding: 4px; vertical-align: middle; width: auto;"></td>
          <td class="mobile-hide" style="border-top: 2px solid #000; border-left: 1px solid #000; padding: 4px; text-align: center; font-size: 14px; font-weight: bold; vertical-align: middle; width: 70px;">${weightDisplay}</td>
        </tr>
      `;
    }
    
    tableRows += totalsRow;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <meta name="language" content="mr">
          <title>${reportTitle} - ${groupName}</title>
          <!-- Google Fonts for consistent Marathi rendering -->
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 8mm 5mm 10mm 5mm; }
            @page:first { margin-top: 10mm; }
            * { box-sizing: border-box; }
            html { margin: 0 !important; padding: 0 !important; width: 100% !important; }
            body { 
              font-family: 'Noto Sans Devanagari', 'Inter', 'Nirmala UI', 'Mangal', 'Segoe UI', 'Arial', sans-serif; 
              font-size: 14px; 
              margin: 0 !important; 
              padding: 0 !important; 
              line-height: 1.4;
              background: #ffffff;
              width: 100% !important;
            }
            .print-content {
              margin: 0;
              padding: 0;
              width: 100%;
            }
            .header { 
              text-align: center; 
              margin-bottom: 15px; 
              border-bottom: 3px solid #2563eb; 
              padding-bottom: 15px; 
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
              border-radius: 8px;
              padding: 20px;
            }
            .company-name { 
              font-size: 31px; 
              font-weight: bold; 
              margin-bottom: 8px; 
              color: #1e40af;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
            }
            .report-info { 
              margin-bottom: 20px; 
              font-size: 18px; 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              padding: 12px; 
              border: 2px solid #e5e7eb; 
              border-radius: 8px;
              background: #f9fafb;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 12px;
              /* Remove table borders for professional print appearance */
              border: none;
            }
            @media print {
              @page { margin: 8mm 5mm 10mm 5mm !important; }
              @page:first { margin-top: 10mm !important; }
              * { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
              }
              
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                font-size: 11px;
                font-family: 'Noto Sans Devanagari', 'Inter', sans-serif !important;
                width: 100% !important;
              }
              
              table {
                table-layout: fixed !important;
                width: 100% !important;
                border: none !important;
                page-break-inside: auto;
                margin: 0 !important;
              }
              thead {
                display: table-header-group !important;
              }
              tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                height: auto !important;
                min-height: 0 !important;
              }
              td, th {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                height: auto !important;
              }
              
              /* Print table borders - thin grey lines */
              table {
                border: 0.5px solid #bbb !important;
              }
              th, td {
                border: 0.5px solid #bbb !important;
              }
              
              /* Header row - slightly stronger bottom border */
              th {
                border-bottom: 1px solid #999 !important;
              }
              
              /* Data rows - 30% more height via padding */
              tbody tr:not(.total-row):not(.summary-row) td {
                padding-top: 5px !important;
                padding-bottom: 5px !important;
                line-height: 1.5 !important;
              }
              
              /* A4 Portrait Print Column Measurements - compressed for portrait fit */
              th, td { font-size: 10px !important; padding: 3px 2px !important; word-wrap: break-word !important; overflow-wrap: break-word !important; }
              /* Data rows - 50% more height */
              tbody tr:not(.total-row):not(.summary-row) td { padding: 8px 2px !important; line-height: 1.6 !important; }
              th:nth-child(1), td:nth-child(1) { width: 26px !important; min-width: 26px !important; text-align: center !important; }    /* अनुक्रमांक */
              th:nth-child(2), td:nth-child(2) { width: 30px !important; min-width: 30px !important; }    /* तारीख - कमी */
              th:nth-child(3), td:nth-child(3) { width: 58px !important; min-width: 58px !important; text-align: left !important; padding-left: 5px !important; }    /* रक्कम */
              th:nth-child(4), td:nth-child(4) { width: 195px !important; min-width: 195px !important; text-align: left !important; padding-left: 4px !important; }   /* नाव — 30 अक्षरे */
              tbody tr:not(.total-row):not(.summary-row) td:nth-child(4) { padding-left: 4px !important; }
              th:nth-child(5), td:nth-child(5) { width: 48px !important; min-width: 48px !important; max-width: 52px !important; text-align: center !important; padding: 3px 2px !important; }    /* कोड */
              tbody tr:not(.total-row):not(.summary-row) td:nth-child(5) { padding: 8px 2px !important; text-align: center !important; }
              th:nth-child(6), td:nth-child(6) { width: auto !important; min-width: 80px !important; text-align: left !important; padding-left: 5px !important; }    /* वस्तूचा तपशील — उरलेली जागा */
              th:nth-child(7), td:nth-child(7) { width: 46px !important; min-width: 46px !important; }    /* वजन */
              
              /* MATURITY-WISE REPORT PRINT LAYOUT */
              .maturity-wise-table th:nth-child(1), .maturity-wise-table td:nth-child(1) { width: 26px !important; min-width: 26px !important; max-width: 30px !important; text-align: center !important; }    /* अ.क्र. */
              .maturity-wise-table th:nth-child(2), .maturity-wise-table td:nth-child(2) { width: 40px !important; }    /* तारीख - कमी */
              .maturity-wise-table th:nth-child(3), .maturity-wise-table td:nth-child(3) { width: 55px !important; min-width: 55px !important; }    /* अंदाजे बाजार मूल्य */
              .maturity-wise-table th:nth-child(4), .maturity-wise-table td:nth-child(4) { width: 121px !important; min-width: 121px !important; text-align: left !important; padding-left: 4px !important; }   /* नाव - 20% वाढ */
              .maturity-wise-table th:nth-child(5), .maturity-wise-table td:nth-child(5) { width: 48px !important; min-width: 48px !important; max-width: 52px !important; text-align: center !important; padding: 3px 2px !important; }      /* कोड नं */
              .maturity-wise-table tbody tr:not(.total-row):not(.summary-row) td:nth-child(5) { padding: 8px 2px !important; text-align: center !important; }
              .maturity-wise-table th:nth-child(6), .maturity-wise-table td:nth-child(6) { width: auto !important; min-width: 140px !important; }    /* वस्तूचा तपशील */
              .maturity-wise-table th:nth-child(7), .maturity-wise-table td:nth-child(7) { width: 40px !important; min-width: 40px !important; }    /* वजन */
              .maturity-wise-table th:nth-child(8), .maturity-wise-table td:nth-child(8) { width: 48px !important; min-width: 48px !important; }    /* मुदत */
              
              /* Portrait print - compact header */
              .header {
                border: none !important;
                box-shadow: none !important;
                background: none !important;
                padding: 2px 0 !important;
                margin: 0 0 2px 0 !important;
                border-bottom: 1.5px solid #333 !important;
                border-radius: 0 !important;
              }
              .company-name {
                font-size: 16px !important;
                color: #111 !important;
                text-shadow: none !important;
              }
              .report-info {
                font-size: 11px !important;
                padding: 2px 0 !important;
                margin: 0 0 2px 0 !important;
                border: none !important;
                background: none !important;
              }
            }
            th { 
              background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); 
              color: white;
              font-weight: bold; 
              font-size: 13px; 
              height: 45px; 
              padding: 12px 8px; 
              text-align: center;
              border-bottom: 2px solid #1e40af;
            }
            td { 
              font-size: 13px; 
              padding: 10px 8px;
              border-bottom: 1px solid #e5e7eb;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            tr:hover {
              background-color: #e0f2fe !important;
            }
            .footer { 
              margin-top: 20px; 
              text-align: center; 
              font-size: 12px; 
              color: #6b7280; 
              padding: 15px;
              border-top: 2px solid #e5e7eb;
            }
            
            /* SCREEN-OPTIMIZED COLUMN WIDTHS - Universal application for all report types */
            @media screen {
              /* Default screen layout for date-wise, name-wise reports */
              th:nth-child(1), td:nth-child(1) { width: 50px !important; min-width: 50px; }      /* अनुक्रमांक - wider for screen */
              th:nth-child(2), td:nth-child(2) { width: 70px !important; min-width: 70px; max-width: 70px !important; }      /* तारीख - 70px */
              th:nth-child(3), td:nth-child(3) { width: 100px !important; min-width: 100px; max-width: 100px !important; }    /* अंदाजे बाजार मूल्य - 100px */
              th:nth-child(4), td:nth-child(4) { width: 250px !important; min-width: 250px; max-width: 250px !important; }    /* नाव - 250px */
              th:nth-child(5), td:nth-child(5) { width: 80px !important; min-width: 80px; max-width: 80px !important; }      /* कोड नं - 80px */
              th:nth-child(6), td:nth-child(6) { width: auto !important; min-width: 150px; }     /* वस्तूचा तपशील - remaining auto */
              th:nth-child(7), td:nth-child(7) { width: 80px !important; min-width: 80px; max-width: 80px !important; }      /* वजन - 80px */
              
              /* 🎯 MATURITY-WISE SCREEN LAYOUT - Fresh Design (User Specifications) */
              .maturity-wise-table th:nth-child(1), .maturity-wise-table td:nth-child(1) { width: 40px !important; min-width: 40px !important; max-width: 40px !important; }    /* अ.क्र. - 40px for screen */
              .maturity-wise-table th:nth-child(2), .maturity-wise-table td:nth-child(2) { width: 80px !important; min-width: 80px !important; max-width: 80px !important; }    /* तारीख - 80px for screen */
              .maturity-wise-table th:nth-child(3), .maturity-wise-table td:nth-child(3) { width: 100px !important; min-width: 100px !important; max-width: 100px !important; }  /* अंदाजे बाजार मूल्य - 100px for screen */
              .maturity-wise-table th:nth-child(4), .maturity-wise-table td:nth-child(4) { width: 220px !important; min-width: 220px !important; max-width: 220px !important; } /* नाव - 220px for screen */
              .maturity-wise-table th:nth-child(5), .maturity-wise-table td:nth-child(5) { width: 60px !important; min-width: 60px !important; max-width: 60px !important; }    /* कोड नं - 60px for screen */
              .maturity-wise-table th:nth-child(6), .maturity-wise-table td:nth-child(6) { width: auto !important; min-width: 150px !important; }                                /* वस्तूचा तपशील - auto for screen */
              .maturity-wise-table th:nth-child(7), .maturity-wise-table td:nth-child(7) { width: 60px !important; min-width: 60px !important; max-width: 60px !important; }    /* वजन - 60px for screen */
              .maturity-wise-table th:nth-child(8), .maturity-wise-table td:nth-child(8) { width: 80px !important; min-width: 80px !important; max-width: 80px !important; }    /* मुदत - 80px for screen */
              
              /* Universal table column width enforcement for ALL report types */
              .borrower-report-table th:nth-child(1), .borrower-report-table td:nth-child(1) { width: 50px !important; min-width: 50px !important; max-width: 50px !important; }
              .borrower-report-table th:nth-child(2), .borrower-report-table td:nth-child(2) { width: 70px !important; min-width: 70px !important; max-width: 70px !important; }
              .borrower-report-table th:nth-child(3), .borrower-report-table td:nth-child(3) { width: 100px !important; min-width: 100px !important; max-width: 100px !important; }
              .borrower-report-table th:nth-child(4), .borrower-report-table td:nth-child(4) { width: 250px !important; min-width: 250px !important; max-width: 250px !important; }
              .borrower-report-table th:nth-child(5), .borrower-report-table td:nth-child(5) { width: 80px !important; min-width: 80px !important; max-width: 80px !important; }
              .borrower-report-table th:nth-child(6), .borrower-report-table td:nth-child(6) { width: auto !important; min-width: 150px !important; }
              .borrower-report-table th:nth-child(7), .borrower-report-table td:nth-child(7) { width: 80px !important; min-width: 80px !important; max-width: 80px !important; }
              
              /* Enhanced specificity for all generic table scenarios */
              table th:nth-child(1), table td:nth-child(1) { width: 50px !important; min-width: 50px !important; max-width: 50px !important; }
              table th:nth-child(2), table td:nth-child(2) { width: 70px !important; min-width: 70px !important; max-width: 70px !important; }
              table th:nth-child(3), table td:nth-child(3) { width: 100px !important; min-width: 100px !important; max-width: 100px !important; }
              table th:nth-child(4), table td:nth-child(4) { width: 250px !important; min-width: 250px !important; max-width: 250px !important; }
              table th:nth-child(5), table td:nth-child(5) { width: 80px !important; min-width: 80px !important; max-width: 80px !important; }
              table th:nth-child(6), table td:nth-child(6) { width: auto !important; min-width: 150px !important; }
              table th:nth-child(7), table td:nth-child(7) { width: 80px !important; min-width: 80px !important; max-width: 80px !important; }
              
              /* CLOSING-WISE SCREEN LAYOUT (9 cols) — single definition */
              .closing-wise-table th:nth-child(1), .closing-wise-table td:nth-child(1) { width: 50px !important; min-width: 50px !important; max-width: 50px !important; text-align: center !important; }
              .closing-wise-table th:nth-child(2), .closing-wise-table td:nth-child(2) { width: 70px !important; min-width: 70px !important; max-width: 70px !important; text-align: center !important; }
              .closing-wise-table th:nth-child(3), .closing-wise-table td:nth-child(3) { width: 80px !important; min-width: 80px !important; max-width: 80px !important; text-align: center !important; }
              .closing-wise-table th:nth-child(4), .closing-wise-table td:nth-child(4) { width: 100px !important; min-width: 100px !important; max-width: 100px !important; text-align: left !important; }
              .closing-wise-table th:nth-child(5), .closing-wise-table td:nth-child(5) { width: 60px !important; min-width: 60px !important; max-width: 60px !important; text-align: left !important; }
              .closing-wise-table th:nth-child(6), .closing-wise-table td:nth-child(6) { width: 250px !important; min-width: 250px !important; max-width: 250px !important; text-align: left !important; }
              .closing-wise-table th:nth-child(7), .closing-wise-table td:nth-child(7) { width: 80px !important; min-width: 80px !important; max-width: 80px !important; text-align: center !important; }
              .closing-wise-table th:nth-child(8), .closing-wise-table td:nth-child(8) { width: auto !important; min-width: 150px !important; text-align: left !important; }
              .closing-wise-table th:nth-child(9), .closing-wise-table td:nth-child(9) { width: 80px !important; min-width: 80px !important; max-width: 80px !important; text-align: center !important; }
              
              /* Enhanced table styling for screen */
              table {
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                border-radius: 8px;
                overflow: hidden;
                background: white;
                table-layout: fixed !important;
              }
              
              /* Better text alignment for screen viewing */
              th:nth-child(1), td:nth-child(1) { text-align: center !important; }     /* अनुक्रमांक */
              th:nth-child(2), td:nth-child(2) { text-align: center !important; }     /* तारीख */
              th:nth-child(3), td:nth-child(3) { text-align: right !important; padding-right: 12px !important; }      /* रक्कम */
              th:nth-child(4), td:nth-child(4) { text-align: left !important; padding-left: 12px !important; }        /* नाव */
              th:nth-child(5), td:nth-child(5) { text-align: center !important; }     /* कोड */
              th:nth-child(6), td:nth-child(6) { text-align: left !important; padding-left: 12px !important; }        /* वस्तूचा तपशील */
              th:nth-child(7), td:nth-child(7) { text-align: center !important; }     /* वजन */
            }
            
            /* NUCLEAR CSS FIX - MAXIMUM SPECIFICITY - CANNOT BE OVERRIDDEN */
            table[class*="borrower-report-table"]:not(.closing-wise-table) tbody tr td:nth-child(1) { 
              width: 45px !important; 
              min-width: 45px !important; 
              max-width: 45px !important; 
              box-sizing: border-box !important;
            }
            table[class*="borrower-report-table"]:not(.closing-wise-table) tbody tr td:nth-child(2) { 
              width: 75px !important; 
              min-width: 75px !important; 
              max-width: 75px !important; 
              box-sizing: border-box !important;
            }
            table[class*="borrower-report-table"]:not(.closing-wise-table) thead tr th:nth-child(1) { 
              width: 45px !important; 
              min-width: 45px !important; 
              max-width: 45px !important; 
              box-sizing: border-box !important;
            }
            table[class*="borrower-report-table"]:not(.closing-wise-table) thead tr th:nth-child(2) { 
              width: 75px !important; 
              min-width: 75px !important; 
              max-width: 75px !important; 
              box-sizing: border-box !important;
            }
            
            /* Print-only alignment: Right justify + Top align for all table content */
            @media print {
              /* REMOVE ALL SHADOWS GLOBALLY IN PRINT */
              * {
                box-shadow: none !important;
                filter: none !important;
                text-shadow: none !important;
                -webkit-filter: none !important;
                -webkit-box-shadow: none !important;
                -moz-box-shadow: none !important;
              }
              
              /* NEUTRALIZE TAILWIND DIVIDE-Y IN PRINT - ROOT CAUSE */
              [class*="divide-y"] > :not([hidden]) ~ :not([hidden]) {
                border-top-width: 0 !important;
                border-top-color: transparent !important;
              }
              
              /* Remove any top border on first content block after header */
              .report-info + * { border-top: 0 !important; }
              .report-info + div table, .report-info + table { border-top: 0 !important; }
              
              /* Prevent double borders from table itself */
              table { 
                border-collapse: collapse !important; 
                border-spacing: 0 !important; 
                border-top: 0 !important;
              }
              tbody tr:first-child > * { border-top: 0 !important; }
              
              /* Disable sticky to avoid compositor hairlines */
              .sticky, thead { 
                position: static !important; 
                box-shadow: none !important; 
              }
              
              /* Remove background artifacts that could create lines */
              .report-container, .report-info, table, th, td {
                outline: none !important;
                background: transparent !important;
                background-image: none !important;
              }
              
              table[class*="borrower-report-table"]:not(.closing-wise-table) tbody tr td,
              table[class*="borrower-report-table"]:not(.closing-wise-table) thead tr th { 
                text-align: right !important; 
                vertical-align: top !important;
              }
              table[class*="borrower-report-table"]:not(.closing-wise-table) tbody tr td:nth-child(4),
              table[class*="borrower-report-table"]:not(.closing-wise-table) thead tr th:nth-child(4) { 
                text-align: left !important; 
                vertical-align: top !important;
              }
              table[class*="borrower-report-table"]:not(.closing-wise-table) tbody tr td:nth-child(6),
              table[class*="borrower-report-table"]:not(.closing-wise-table) thead tr th:nth-child(6) { 
                text-align: left !important; 
                vertical-align: top !important;
              }
              
              /* Hide report title (डेट वाईज रिपोर्ट etc.) in print only */
              .report-info > div:first-child {
                display: none !important;
              }
              
              /* NUCLEAR HEADER BORDER REMOVAL - ROOT CAUSE FIX */
              .report-info, .report-info * {
                border: 0 !important;
                box-shadow: none !important;
                outline: 0 !important;
                background: #fff !important;
              }
              
              /* Remove shadcn/Tailwind border helpers on header */
              .report-info[class*="border"], .report-info[class*="ring"],
              .report-info [class*="border-"], .report-info [class*="ring-"] { 
                border: 0 !important; 
                box-shadow: none !important; 
              }
              .report-info hr, .report-info .separator, .report-info [role="separator"] { 
                display: none !important; 
              }
              
              /* Print-only: Flex layout with safe margins - CLEAN */
              .report-info {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 4px !important;
                padding: 2px 2px 4px 2px !important;
                position: relative !important;
              }
              
              /* Add clean black separator ONLY if needed */
              .report-info::after {
                content: "";
                position: absolute;
                bottom: -1px;
                left: 0;
                right: 0;
                height: 1px;
                background: #000;
              }
              
              /* Group name: Center of available space */
              .report-info > div:nth-child(2) {
                position: absolute !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                text-align: center !important;
                font-weight: 900 !important; /* Extra bold */
                font-size: 18px !important; /* Slightly bigger for emphasis */
              }
              
              /* Date range: Right side with safe distance from edge */
              .print-date-range {
                text-align: right !important;
                font-weight: bold !important;
                font-size: 14px !important;
                white-space: nowrap !important;
                flex-shrink: 0 !important;
                margin-left: auto !important;
              }
            }
            
            /* Professional Print Font Sizes - Uniform size for Marathi and English */
            @media print {
              html, body { 
                font-family: 'Noto Sans Devanagari', 'Inter', 'Nirmala UI', 'Mangal', 'Segoe UI', 'Arial', sans-serif !important;
                font-size: 10.5pt;
                line-height: 1.3;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
              }
              
              /* Print-only: Zero margin setup */
              body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                box-sizing: border-box !important;
              }
              
              /* Professional table typography - 10% smaller for better fit */
              table { font-size: 9pt; border-collapse: collapse; }
              th { font-size: 10pt; font-weight: 600; }
              td { font-size: 9pt; }
              td, th { padding: 2mm 2.5mm; line-height: 1.25; }
              
              /* Specific elements - Uniform sizing for Marathi-English */
              .report-title { font-size: 13pt; font-weight: 600; }
              .report-subtitle, .meta { font-size: 9.5pt; }
              .numeric { font-variant-numeric: tabular-nums; }
              .total-row td { font-size: 10.5pt; font-weight: 700; }
              .small-note { font-size: 9pt; }
              
              /* Override any inline styles with 10% smaller sizes for headers */
              th:not([style*="तारीख"]):not([style*="मुदत"]) { font-size: 10pt !important; }
              th[style*="font-size: 10px"] { font-size: 9pt !important; }
              
              /* Table data cells - standard size */
              td:not(.maturity-cell-date):not(.maturity-cell-maturity) { font-size: 9pt !important; }
              
              /* PRINT-ONLY font adjustments - Increase Marathi text in table data by 10% (excluding headings) */
              tbody td {
                font-size: 9.9pt !important; /* 10% increase for Marathi in data cells */
              }
              
              /* PRINT-ONLY - Special handling for Devanagari script characters */
              tbody td:not([style*="english"]) {
                font-size: 9.9pt !important;
                font-family: 'Noto Sans Devanagari', 'Inter', sans-serif !important;
              }
              
            }
            
            /* Hide company name on screen but show in print */
            @media screen {
              .company-name {
                display: none !important;
              }
            }
            
            /* Hide keyboard navigation help on mobile */
            @media screen and (max-width: 768px) {
              .print-hide { display: none !important; }
            }
            
            /* Mobile-First Responsive Design */
            @media screen and (max-width: 768px) {
              body {
                padding: 8px;
                font-size: 12px;
              }
              .header {
                padding: 15px;
                margin-bottom: 12px;
              }
              .company-name {
                font-size: 20px;
              }
              .report-info {
                flex-direction: column;
                gap: 8px;
                padding: 10px;
                font-size: 12px;
              }
              .report-info div {
                text-align: center !important;
                flex: none !important;
              }
              table {
                font-size: 11px;
              }
              th {
                font-size: 10px;
                padding: 8px 4px;
                height: 35px;
              }
              td {
                font-size: 10px;
                padding: 6px 4px;
              }
              /* Hide less important columns on mobile */
              .mobile-hide {
                display: none !important;
              }
            }
            
            @media screen and (max-width: 480px) {
              body {
                padding: 5px;
              }
              .header {
                padding: 10px;
              }
              .company-name {
                font-size: 18px;
              }
              table {
                font-size: 10px;
              }
              th {
                font-size: 9px;
                padding: 6px 2px;
                height: 30px;
              }
              td {
                font-size: 9px;
                padding: 4px 2px;
              }
            }
            
            @media print {
              * { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
              }
              
              body { 
                margin: 0 !important; 
                padding: 0 !important; 
                background: white !important;
                color: black !important;
                font-family: 'Noto Sans Devanagari', 'Inter', 'Nirmala UI', 'Mangal', 'Segoe UI', 'Arial', sans-serif !important;
                font-size: 12px !important;
                line-height: 1.3 !important;
              }
              
              /* Hide company header for clean professional print */
              .header { display: none !important; }
              
              /* Hide camera emoji in print */
              .no-print {
                display: none !important;
              }
              
              /* Grid layout handled by newer print CSS block below */
              
              /* Updated for new grid-based print layout */
              
              /* Hide footer for clean print */
              .footer { display: none !important; }
              
              .print-hide { display: none !important; }
              
              /* Hide selected row borders/highlights in print */
              tr {
                background: white !important;
                outline: none !important;
                border: none !important;
                box-shadow: none !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                height: auto !important;
                min-height: 0 !important;
              }
              td, th {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                height: auto !important;
              }
              thead {
                display: table-header-group !important;
              }
              
              /* Professional table styling - NO LEFT/RIGHT BORDERS as requested */
              table { 
                page-break-inside: auto;
                background: white !important;
                border-top: 2px solid black !important;
                border-bottom: 2px solid black !important;
                border-left: none !important;
                border-right: none !important;
                border-collapse: collapse !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                width: 100% !important;
                margin-top: 4px !important;
                table-layout: fixed !important;
              }
              
              /* Professional header styling - Only top/bottom borders + inner vertical dividers */
              th { 
                background: white !important; 
                color: black !important;
                border-top: 2px solid black !important;
                border-bottom: 2px solid black !important;
                border-left: none !important;
                border-right: 1px solid black !important; /* Only inner dividers */
                font-weight: bold !important;
                padding: 6px 4px !important;
                text-align: center !important;
                font-size: 11px !important;
                vertical-align: middle !important;
                height: auto !important;
                line-height: 1.3 !important;
              }
              
              /* Remove right border from last column */
              th:last-child {
                border-right: none !important;
              }
              
              /* A4 Print Column Widths — th+td consistent (date-wise, name-wise, maturity) */
              th:nth-child(1), td:nth-child(1) { width: 26px !important; min-width: 26px !important; max-width: 30px !important; text-align: center !important; }
              th:nth-child(2), td:nth-child(2) { width: 30px !important; min-width: 30px !important; max-width: 34px !important; text-align: center !important; }
              th:nth-child(3), td:nth-child(3) { width: 58px !important; min-width: 58px !important; max-width: 62px !important; text-align: left !important; padding-left: 5px !important; }
              th:nth-child(4), td:nth-child(4) { width: 195px !important; min-width: 195px !important; text-align: left !important; padding-left: 4px !important; }
              th:nth-child(5), td:nth-child(5) { width: 48px !important; min-width: 48px !important; max-width: 52px !important; text-align: center !important; }
              th:nth-child(6), td:nth-child(6) { width: auto !important; min-width: 80px !important; text-align: left !important; padding-left: 5px !important; }
              th:nth-child(7), td:nth-child(7) { width: 46px !important; min-width: 46px !important; max-width: 52px !important; text-align: center !important; }
              
              /* ═══════════════════════════════════════════════════════════════
                 CLOSING-WISE PRINT — SINGLE CONSOLIDATED BLOCK (9 columns)
                 This is the ONLY place closing-wise print widths are defined.
                 Uses body[data-report-type] for highest specificity.
                 ═══════════════════════════════════════════════════════════════ */
              body[data-report-type="closing-wise"] th:nth-child(1), body[data-report-type="closing-wise"] td:nth-child(1) { width: 30px !important; min-width: 30px !important; max-width: 34px !important; text-align: center !important; padding: 3px 2px !important; }
              body[data-report-type="closing-wise"] th:nth-child(2), body[data-report-type="closing-wise"] td:nth-child(2) { width: 58px !important; min-width: 58px !important; max-width: 62px !important; text-align: center !important; }
              body[data-report-type="closing-wise"] th:nth-child(3), body[data-report-type="closing-wise"] td:nth-child(3) { width: 58px !important; min-width: 58px !important; max-width: 62px !important; text-align: center !important; }
              body[data-report-type="closing-wise"] tbody tr:not(.total-row) td { padding: 3px 2px !important; line-height: 1.3 !important; }
              body[data-report-type="closing-wise"] th:nth-child(4), body[data-report-type="closing-wise"] td:nth-child(4) { width: 65px !important; min-width: 65px !important; max-width: 70px !important; text-align: left !important; padding-left: 5px !important; }
              body[data-report-type="closing-wise"] th:nth-child(5), body[data-report-type="closing-wise"] td:nth-child(5) { width: 55px !important; min-width: 55px !important; max-width: 60px !important; text-align: left !important; padding-left: 5px !important; }
              body[data-report-type="closing-wise"] th:nth-child(6), body[data-report-type="closing-wise"] td:nth-child(6) { width: 120px !important; min-width: 120px !important; max-width: 130px !important; text-align: left !important; padding-left: 4px !important; }
              body[data-report-type="closing-wise"] th:nth-child(7), body[data-report-type="closing-wise"] td:nth-child(7) { width: 44px !important; min-width: 44px !important; max-width: 48px !important; text-align: center !important; }
              body[data-report-type="closing-wise"] th:nth-child(8), body[data-report-type="closing-wise"] td:nth-child(8) { width: auto !important; min-width: 60px !important; text-align: left !important; }
              body[data-report-type="closing-wise"] th:nth-child(9), body[data-report-type="closing-wise"] td:nth-child(9) { width: 40px !important; min-width: 40px !important; max-width: 46px !important; text-align: center !important; }
              body[data-report-type="closing-wise"] .total-row td { border-left: none !important; border-right: none !important; }
              body[data-report-type="closing-wise"] .total-row td:nth-child(3),
              body[data-report-type="closing-wise"] .total-row td:nth-child(4),
              body[data-report-type="closing-wise"] .total-row td:nth-child(5) { border-left: 1px solid #000 !important; }
              
              /* Clean cell styling - Uniform professional black borders */
              td {
                background: white !important;
                color: black !important;
                border-top: none !important;
                border-bottom: 1px solid #000 !important;
                border-left: none !important;
                border-right: 1px solid #000 !important;
                padding: 4px 3px !important;
                font-size: 10px !important;
                vertical-align: middle !important;
                line-height: 1.3 !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
              }
              
              /* Force all maturity column cells to black & white for print */
              .maturity-cell-maturity {
                background: white !important;
                color: black !important;
                border: 1px solid #000 !important;
              }
              
              /* Override ALL colored backgrounds for print */
              .maturity-report-header th {
                background: white !important;
                color: black !important;
              }
              
              /* Force all table rows to black & white */
              .maturity-report-row {
                background: white !important;
                color: black !important;
                outline: none !important;
                box-shadow: none !important;
              }
              
              .maturity-report-row td {
                background: white !important;
                color: black !important;
                outline: none !important;
                box-shadow: none !important;
              }
              
              /* Remove ALL selection/hover styling in print */
              .maturity-report-row:hover,
              .maturity-report-row:focus,
              .maturity-report-row:active {
                background: white !important;
                color: black !important;
                outline: none !important;
                box-shadow: none !important;
              }
              
              /* Ensure maturity column has uniform black borders in print */
              .maturity-cell-maturity {
                background: white !important;
                color: black !important;
                border: 1px solid #000 !important;
                outline: none !important;
                box-shadow: none !important;
                text-decoration: none !important;
              }
              
              /* Remove right border from last column */
              td:last-child {
                border-right: none !important;
              }
              
              /* td display enforcement */
              td { display: table-cell !important; visibility: visible !important; }
              
              /* Hide rupee symbol in print - screen-only class */
              .screen-only {
                display: none !important;
              }
              
              /* Remove all row colors and effects for clean look */
              tr { 
                page-break-inside: avoid !important; 
                break-inside: avoid !important;
                height: auto !important;
                min-height: 0 !important;
                page-break-after: auto;
                background: white !important;
              }
              tr:nth-child(even) {
                background: white !important;
              }
              tr:hover {
                background: white !important;
              }
              
              /* Professional totals row - with proper borders */
              tr[style*="font-weight: bold"] {
                background: white !important;
                border-top: 2px solid black !important;
              }
              tr[style*="font-weight: bold"] td {
                font-weight: bold !important;
                font-size: 11px !important;
                border-top: 2px solid black !important;
                border-bottom: 2px solid black !important;
                border-left: none !important;
                border-right: 1px solid black !important;
                padding: 6px 5px !important;
              }
              tr[style*="font-weight: bold"] td:last-child {
                border-right: none !important;
              }
              
              /* FORCE TABLE LAYOUT FOR MATURITY-WISE - CRITICAL */
              .maturity-wise-table {
                table-layout: fixed !important;
                width: 100% !important;
                border-collapse: collapse !important;
                box-sizing: border-box !important;
              }
              
              .maturity-wise-table * {
                box-sizing: border-box !important;
              }
              
              /* EXACT DATE-WISE COLUMN WIDTHS for MATURITY-WISE with मुदत at LAST position */
              body[data-report-type="maturity-wise"] td:nth-child(1) { /* अनुक्रमांक - 45px (increased) */
                width: 45px !important;
                min-width: 45px !important;
                max-width: 45px !important;
                text-align: center !important;
              }
              body[data-report-type="maturity-wise"] td:nth-child(2) { /* तारीख - 75px (increased) */
                width: 75px !important;
                min-width: 75px !important;
                max-width: 75px !important;
                text-align: center !important;
              }
              body[data-report-type="maturity-wise"] td:nth-child(3) { /* अंदाजे बाजार मूल्य - 70px (same as date-wise) */
                width: 70px !important;
                min-width: 70px !important;
                max-width: 70px !important;
                text-align: right !important;
                white-space: nowrap !important;
              }
              body[data-report-type="maturity-wise"] td:nth-child(4) { /* नाव - 200px (same as date-wise) */
                width: 200px !important;
                min-width: 200px !important;
                max-width: 200px !important;
                text-align: left !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
              }
              body[data-report-type="maturity-wise"] td:nth-child(5) { /* कोड नं - 70px (same as date-wise) */
                width: 70px !important;
                min-width: 70px !important;
                max-width: 70px !important;
                text-align: left !important;
              }
              body[data-report-type="maturity-wise"] td:nth-child(6) { /* वस्तूचा तपशील - auto (same as date-wise) */
                width: auto !important;
                min-width: 111px !important;
                text-align: left !important;
                white-space: normal !important;
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
              }
              body[data-report-type="maturity-wise"] td:nth-child(7) { /* वजन - 70px (same as date-wise) */
                width: 70px !important;
                min-width: 70px !important;
                max-width: 70px !important;
                text-align: center !important;
              }
              body[data-report-type="maturity-wise"] td:nth-child(8) { /* मुदत - 75px (increased) */
                width: 75px !important;
                min-width: 75px !important;
                max-width: 75px !important;
                text-align: center !important;
              }
              body[data-report-type="maturity-wise"] td:nth-child(7) { /* वस्तूचा तपशील - auto */
                width: auto !important;
                min-width: 120px !important;
                text-align: left !important;
                white-space: normal !important;
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
              }
              body[data-report-type="maturity-wise"] td:nth-child(8) { /* वजन - 63px */
                width: 63px !important;
                min-width: 63px !important;
                max-width: 63px !important;
                text-align: center !important;
              }
              
              /* Hide mobile columns properly */
              .mobile-hide {
                display: table-cell !important;
              }
            }
          </style>
        </head>
        <body data-report-type="${activeTab}">
          <script>
            let currentRowIndex = -1;
            let isPopupOpen = false;
            
            function showPhonePopup(borrowerName, phoneNumber) {
              if (isPopupOpen) return; // Prevent multiple popups
              isPopupOpen = true;
              
              // Create custom popup with better design
              const popup = prompt(
                borrowerName + "\\n\\nफोन नंबर: " + phoneNumber + "\\n\\nCall करण्यासाठी Enter दाबा, Cancel करण्यासाठी Esc दाबा",
                phoneNumber
              );
              
              isPopupOpen = false;
              
              if (popup !== null && phoneNumber !== 'फोन नंबर उपलब्ध नाही') {
                // User pressed Enter or OK - initiate call
                window.open('tel:' + phoneNumber, '_self');
              }
            }
            
            function highlightRow(index) {
              // Remove previous highlight
              const allRows = document.querySelectorAll('.loan-row[data-row-index]');
              allRows.forEach(row => {
                const originalBg = row.dataset.originalBg || (row.style.backgroundColor || '');
                row.style.backgroundColor = originalBg;
                row.style.color = '';
                row.style.outline = '';
                row.style.boxShadow = '';
                
                // Reset all cell colors
                const cells = row.querySelectorAll('td');
                cells.forEach(cell => {
                  cell.style.color = '';
                });
                
                // Reset maturity column to original styling
                const maturityCell = row.querySelector('.maturity-cell-maturity');
                if (maturityCell) {
                  maturityCell.style.backgroundColor = '#fef2f2';
                  maturityCell.style.color = '#dc2626';
                  maturityCell.style.fontWeight = '700';
                }
              });
              
              // Add highlight to current row
              if (index >= 0 && index < allRows.length) {
                const currentRow = allRows[index];
                
                // Simple border highlight - keeps original text readable
                currentRow.style.outline = '3px solid #dc2626';
                currentRow.style.backgroundColor = '#fef2f2';
                
                // Scroll into view if needed
                currentRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }
            
            // Enhanced date-wise row highlighting function with pagination support
            function highlightDateWiseRow(index) {
              // Remove previous highlight from all date-wise rows
              const allDateRows = document.querySelectorAll('tbody tr');
              allDateRows.forEach(row => {
                if (!row.classList.contains('loan-row')) {
                  row.style.backgroundColor = '';
                  row.style.color = '';
                  row.style.outline = '';
                  row.style.boxShadow = '';
                  // Reset cell colors
                  const cells = row.querySelectorAll('td');
                  cells.forEach(cell => {
                    cell.style.color = '';
                    cell.style.backgroundColor = '';
                  });
                }
              });
              
              // Add highlight to current date-wise row (only current page rows)
              const dateRows = Array.from(document.querySelectorAll('tbody tr')).filter(row => 
                !row.classList.contains('loan-row')
              );
              
              if (index >= 0 && index < dateRows.length) {
                const currentRow = dateRows[index];
                
                // Simple border highlight - keeps original text readable
                currentRow.style.outline = '3px solid #dc2626';
                currentRow.style.backgroundColor = '#fef2f2';
                
                currentRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }

            // Complete keyboard navigation for both reports
            document.addEventListener('keydown', function(event) {
              if (isPopupOpen) return; // Don't handle keys when popup is open
              
              // Check which report type is active
              const isLoanReport = document.querySelectorAll('.loan-row[data-row-index]').length > 0;
              
              if (isLoanReport) {
                // Maturity-wise keyboard navigation
                const allRows = document.querySelectorAll('.loan-row[data-row-index]');
                
                switch(event.key) {
                  case 'ArrowDown':
                    event.preventDefault();
                    const newDownIndex = currentRowIndex === -1 ? 0 : Math.min(currentRowIndex + 1, allRows.length - 1);
                    if (newDownIndex !== currentRowIndex) {
                      currentRowIndex = newDownIndex;
                      highlightRow(currentRowIndex);
                    }
                    break;
                    
                  case 'ArrowUp':
                    event.preventDefault();
                    const newUpIndex = currentRowIndex === -1 ? allRows.length - 1 : Math.max(currentRowIndex - 1, 0);
                    if (newUpIndex !== currentRowIndex) {
                      currentRowIndex = newUpIndex;
                      highlightRow(currentRowIndex);
                    }
                    break;
                    
                  case 'Enter':
                    event.preventDefault();
                    if (currentRowIndex >= 0 && currentRowIndex < allRows.length) {
                      const currentRow = allRows[currentRowIndex];
                      if (currentRow && currentRow.onclick) {
                        currentRow.click();
                      }
                    }
                    break;
                  
                case 'Escape':
                  event.preventDefault();
                  // Clear highlighting and reset
                  currentRowIndex = -1;
                  highlightRow(-1);
                  break;
                  
                case 'Home':
                  event.preventDefault();
                  currentRowIndex = 0;
                  highlightRow(currentRowIndex);
                  break;
                  
                case 'End':
                  event.preventDefault();
                  currentRowIndex = allRows.length - 1;
                  highlightRow(currentRowIndex);
                  break;
                  
                case 'Escape':
                  event.preventDefault();
                  currentRowIndex = -1;
                  highlightRow(-1);
                  break;
              }
              } else {
                // Date-wise keyboard navigation with pagination support
                const dateRows = Array.from(document.querySelectorAll('tbody tr')).filter(row => 
                  !row.classList.contains('loan-row')
                );
                
                switch(event.key) {
                  case 'ArrowDown':
                    event.preventDefault();
                    const newDownIndex = currentRowIndex === -1 ? 0 : Math.min(currentRowIndex + 1, dateRows.length - 1);
                    if (newDownIndex !== currentRowIndex) {
                      currentRowIndex = newDownIndex;
                      highlightDateWiseRow(currentRowIndex);
                    }
                    break;
                    
                  case 'ArrowUp':
                    event.preventDefault();
                    const newUpIndex = currentRowIndex === -1 ? dateRows.length - 1 : Math.max(currentRowIndex - 1, 0);
                    if (newUpIndex !== currentRowIndex) {
                      currentRowIndex = newUpIndex;
                      highlightDateWiseRow(currentRowIndex);
                    }
                    break;
                  
                  case 'ArrowLeft':
                    if (event.ctrlKey) {
                      event.preventDefault();
                      // Previous page with Ctrl+Left Arrow
                      const prevPageBtn = document.querySelector('button[disabled]') ? null : document.querySelectorAll('button')[0];
                      if (prevPageBtn && !prevPageBtn.disabled) {
                        prevPageBtn.click();
                        currentRowIndex = 0; // Reset to first row on new page
                      }
                    }
                    break;
                    
                  case 'ArrowRight':
                    if (event.ctrlKey) {
                      event.preventDefault();
                      // Next page with Ctrl+Right Arrow
                      const buttons = document.querySelectorAll('button');
                      const nextPageBtn = Array.from(buttons).find(btn => btn.textContent === 'पुढे');
                      if (nextPageBtn && !nextPageBtn.disabled) {
                        nextPageBtn.click();
                        currentRowIndex = 0; // Reset to first row on new page
                      }
                    }
                    break;
                    
                  case 'Escape':
                    event.preventDefault();
                    currentRowIndex = -1;
                    highlightDateWiseRow(-1);
                    break;
                    
                  case 'Home':
                    if (event.ctrlKey) {
                      event.preventDefault();
                      // Go to first page with Ctrl+Home
                      const firstPageBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent === 'पहिला');
                      if (firstPageBtn && !firstPageBtn.disabled) {
                        firstPageBtn.click();
                        currentRowIndex = 0;
                      }
                    }
                    break;
                    
                  case 'End':
                    if (event.ctrlKey) {
                      event.preventDefault();
                      // Go to last page with Ctrl+End
                      const lastPageBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent === 'शेवटचा');
                      if (lastPageBtn && !lastPageBtn.disabled) {
                        lastPageBtn.click();
                        currentRowIndex = 0;
                      }
                    }
                    break;
                }
              }
            });
            
            // No automatic row highlighting on page load - user can navigate using arrow keys
          </script>
          <div class="header">
            <div class="company-name">${(company as any)?.companyName || 'कंपनीचे नाव'}</div>
          </div>
          
          <div class="report-info">
            <div style="flex: 1; font-weight: bold; font-size: 14px;">
              ${reportTitle}
            </div>
            <div style="flex: 1; text-align: center; font-weight: bold; font-size: 16px; color: #2563eb;">
              ${groupName}
            </div>
            <div class="print-date-range" style="flex: 1; text-align: right; font-weight: bold; font-size: 14px; color: #dc2626; padding-right: 30px;">
              ${new Date(dateFrom).toLocaleDateString('en-GB')} &nbsp;ते&nbsp; ${new Date(dateTo).toLocaleDateString('en-GB')}
            </div>
          </div>
          
          <table class="borrower-report-table${activeTab === 'closing-wise' ? ' closing-wise-table' : ''}${activeTab === 'maturity-wise' ? ' maturity-wise-table' : ''}" style="table-layout: fixed !important; width: 100% !important; border-collapse: collapse !important;">
            <thead>
              ${tableHeaders}
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div class="footer">
            <!-- Report date removed as requested -->
          </div>

          <!-- Photo Viewer Modal - Popup Style -->
          <div id="photo-modal" onclick="closePhotoModal()" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 10000; overflow: hidden; backdrop-filter: blur(5px); cursor: pointer;">
            <!-- Modal Content Container -->
            <div id="modal-content" onclick="event.stopPropagation()" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 1000px; height: 85%; max-height: 700px; background: rgba(0, 0, 0, 0.95); border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); overflow: hidden; cursor: default;">
              
              <!-- Header Bar -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(0,0,0,0.7); border-bottom: 1px solid rgba(255,255,255,0.1);">
                <!-- Borrower Name Display -->
                <div id="borrower-name" style="color: white; font-size: 18px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);"></div>
                
                <!-- Action Buttons -->
                <div style="display: flex; gap: 12px; align-items: center;">
                  <!-- Download Button -->
                  <button onclick="downloadCurrentPhoto()" data-testid="button-download-photo" style="background: rgba(34, 197, 94, 0.9); color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; transition: background 0.2s; display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 16px;">⬇️</span> डाउनलोड
                  </button>
                  
                  <!-- Close Button -->
                  <button onclick="closePhotoModal()" data-testid="button-close-photo" style="background: rgba(220, 38, 38, 0.9); color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; transition: background 0.2s; display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 16px;">❌</span> बंद करा
                  </button>
                </div>
              </div>
              
              <!-- Photo Container -->
              <div id="photo-container" style="display: flex; justify-content: center; align-items: center; width: 100%; height: calc(100% - 120px); padding: 20px; position: relative;">
                <!-- Photos will be populated by JavaScript -->
              </div>
              
              <!-- Navigation Arrows -->
              <button id="prev-photo" onclick="navigatePhoto(-1)" data-testid="button-prev-photo" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.7); color: white; border: none; padding: 12px 16px; font-size: 20px; cursor: pointer; border-radius: 50%; z-index: 10001; display: none; transition: background 0.2s; border: 1px solid rgba(255,255,255,0.2);">‹</button>
              <button id="next-photo" onclick="navigatePhoto(1)" data-testid="button-next-photo" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.7); color: white; border: none; padding: 12px 16px; font-size: 20px; cursor: pointer; border-radius: 50%; z-index: 10001; display: none; transition: background 0.2s; border: 1px solid rgba(255,255,255,0.2);">›</button>
              
              <!-- Footer Bar with Counter -->
              <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); padding: 12px 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: center;">
                <div id="photo-counter" data-testid="text-photo-counter" style="color: white; font-size: 14px; background: rgba(0,0,0,0.5); padding: 6px 12px; border-radius: 16px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);"></div>
              </div>
              
            </div>
          </div>

          <!-- Keyboard Navigation Help -->
          <div style="position: fixed; bottom: 10px; left: 10px; background: #dbeafe; border: 1px solid #3b82f6; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #1e40af; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 1000;" class="print-hide">
            <strong>⌨️ Keyboard Navigation:</strong> Use ↑↓ arrows to navigate rows, <strong>Space फोटो</strong> पाहण्यासाठी, Escape to close
          </div>

          <script>
            // Global variables for keyboard navigation and photo viewer
            let selectedRowIndex = -1;
            let allRows = [];
            let selectedLoanData = null;
            let currentPhotoIndex = 0;
            let photoUrls = [];

            // Initialize keyboard navigation when page loads
            document.addEventListener('DOMContentLoaded', function() {
              allRows = document.querySelectorAll('.loan-row[data-row-index]');
              initializeKeyboardNavigation();
            });
            
            // Pass photo availability map to window object for global access
            window.photoAvailabilityMap = new Map(${JSON.stringify(Array.from(photoAvailabilityMap.entries()))});

            function initializeKeyboardNavigation() {
              // Keyboard event handler
              document.addEventListener('keydown', function(event) {
                if (allRows.length === 0) return;
                
                // Don't handle navigation keys if modal is open
                const modal = document.getElementById('photo-modal');
                if (modal && modal.style.display === 'block') {
                  switch (event.key) {
                    case 'ArrowLeft':
                      event.preventDefault();
                      navigatePhoto(-1);
                      break;
                    case 'ArrowRight':
                      event.preventDefault();
                      navigatePhoto(1);
                      break;
                    case ' ': // Space key for zoom
                      event.preventDefault();
                      const currentImg = modal.querySelector('#photo-container img');
                      if (currentImg) {
                        toggleFullscreen(currentImg);
                      }
                      break;
                    case 'Escape':
                      event.preventDefault();
                      closePhotoModal();
                      break;
                  }
                  return;
                }

                switch (event.key) {
                  case 'ArrowDown':
                    event.preventDefault();
                    if (selectedRowIndex < allRows.length - 1) {
                      setSelectedRow(selectedRowIndex + 1);
                    }
                    break;
                  case 'ArrowUp':
                    event.preventDefault();
                    if (selectedRowIndex > 0) {
                      setSelectedRow(selectedRowIndex - 1);
                    }
                    break;
                  case ' ': // Space key
                    event.preventDefault();
                    if (selectedRowIndex >= 0 && allRows[selectedRowIndex]) {
                      attemptOpenPhotoModal();
                    }
                    break;
                  case 'Escape':
                    event.preventDefault();
                    closePhotoModal();
                    break;
                }
              });

              // Click handlers for rows
              allRows.forEach((row, index) => {
                row.addEventListener('click', function() {
                  setSelectedRow(index);
                  attemptOpenPhotoModal();
                });
              });

              // No automatic initial selection - user can navigate using arrow keys
              // if (allRows.length > 0) {
              //   setSelectedRow(0);
              // }
            }

            function setSelectedRow(index) {
              // Remove previous selection
              allRows.forEach(row => {
                row.style.backgroundColor = '';
                row.style.outline = '';
              });

              selectedRowIndex = index;
              const selectedRow = allRows[selectedRowIndex];
              
              if (selectedRow) {
                // Highlight selected row
                selectedRow.style.backgroundColor = '#dbeafe';
                selectedRow.style.outline = '2px solid #3b82f6';
                
                // Get loan data
                try {
                  selectedLoanData = JSON.parse(selectedRow.getAttribute('data-loan').replace(/&apos;/g, "'"));
                } catch (e) {
                  // Silently handle parsing errors
                }

                // Scroll into view
                selectedRow.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest'
                });
              }
            }

            // Helper function to check if current selected loan has photos
            function hasPhotosAvailable() {
              if (!selectedLoanData || !selectedLoanData.id) return false;
              
              // Get photo availability from the map (passed via window object)
              const photoInfo = window.photoAvailabilityMap?.get(selectedLoanData.id);
              return photoInfo && photoInfo.hasPhotos;
            }

            // Optimized function to open photo modal only if photos are available
            function attemptOpenPhotoModal() {
              if (!hasPhotosAvailable()) {
                // Show a quick notification for rows without photos
                showNoPhotosNotification();
                return;
              }
              
              // Only open modal if photos are available
              openPhotoModal();
            }

            // Show brief notification for rows without photos
            function showNoPhotosNotification() {
              // Create notification element
              const notification = document.createElement('div');
              notification.style.cssText = \`
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(239, 68, 68, 0.95);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: bold;
                z-index: 10002;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
              \`;
              notification.textContent = '📷 या कर्जासाठी फोटो नाहीत';
              
              document.body.appendChild(notification);
              
              // Auto remove after 2 seconds
              setTimeout(() => {
                if (notification.parentNode) {
                  notification.parentNode.removeChild(notification);
                }
              }, 2000);
            }

            // Download current photo functionality
            async function downloadCurrentPhoto() {
              if (!photoUrls || photoUrls.length === 0 || currentPhotoIndex < 0 || currentPhotoIndex >= photoUrls.length) {
                showDownloadNotification('कोणतेही फोटो उपलब्ध नाही', 'error');
                return;
              }

              try {
                const currentPhotoUrl = photoUrls[currentPhotoIndex];
                const photoNumber = currentPhotoIndex + 1;
                const borrowerName = selectedLoanData?.borrowerName || 'Borrower';
                const loanId = selectedLoanData?.id || 'loan';
                
                // Create filename: BorrowerName_LoanId_Photo1.jpg
                const sanitizedBorrowerName = borrowerName.replace(/[^a-zA-Z0-9\u0900-\u097F]/g, '_');
                const sanitizedLoanId = loanId.slice(0, 8);
                const filename = \`\${sanitizedBorrowerName}_\${sanitizedLoanId}_Photo\${photoNumber}.jpg\`;

                showDownloadNotification('डाउनलोड सुरू होत आहे...', 'info');

                // Fetch the image blob
                const response = await fetch(currentPhotoUrl);
                if (!response.ok) {
                  throw new Error(\`Failed to fetch image: \${response.status}\`);
                }
                
                const blob = await response.blob();
                
                // Create download link
                const downloadUrl = window.URL.createObjectURL(blob);
                const downloadLink = document.createElement('a');
                downloadLink.href = downloadUrl;
                downloadLink.download = filename;
                downloadLink.style.display = 'none';
                
                // Trigger download
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                // Clean up blob URL
                window.URL.revokeObjectURL(downloadUrl);
                
                showDownloadNotification(\`✅ फोटो डाउनलोड झाला: \${filename}\`, 'success');
                
              } catch (error) {
                console.error('Download error:', error);
                showDownloadNotification('❌ डाउनलोड अयशस्वी', 'error');
              }
            }

            // Show download notification
            function showDownloadNotification(message, type) {
              const notification = document.createElement('div');
              
              let backgroundColor, borderColor;
              switch (type) {
                case 'success':
                  backgroundColor = 'rgba(34, 197, 94, 0.95)';
                  borderColor = 'rgba(34, 197, 94, 0.3)';
                  break;
                case 'error':
                  backgroundColor = 'rgba(239, 68, 68, 0.95)';
                  borderColor = 'rgba(239, 68, 68, 0.3)';
                  break;
                case 'info':
                default:
                  backgroundColor = 'rgba(59, 130, 246, 0.95)';
                  borderColor = 'rgba(59, 130, 246, 0.3)';
                  break;
              }
              
              notification.style.cssText = \`
                position: fixed;
                top: 80px;
                right: 20px;
                background: \${backgroundColor};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: bold;
                z-index: 10003;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                backdrop-filter: blur(10px);
                border: 1px solid \${borderColor};
                max-width: 350px;
                word-wrap: break-word;
              \`;
              notification.textContent = message;
              
              document.body.appendChild(notification);
              
              // Auto remove after 3 seconds
              setTimeout(() => {
                if (notification.parentNode) {
                  notification.parentNode.removeChild(notification);
                }
              }, 3000);
            }

            async function openPhotoModal() {
              if (!selectedLoanData || !selectedLoanData.id) return;

              // Show loading state
              const modal = document.getElementById('photo-modal');
              const borrowerNameDiv = document.getElementById('borrower-name');
              const photoContainer = document.getElementById('photo-container');
              const photoCounter = document.getElementById('photo-counter');
              const prevBtn = document.getElementById('prev-photo');
              const nextBtn = document.getElementById('next-photo');

              // Set borrower name
              borrowerNameDiv.textContent = \`📋 \${selectedLoanData.borrowerName || 'कर्जदार'}\`;
              
              // Show loading
              photoContainer.innerHTML = \`
                <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: white;">
                  <div style="text-align: center;">
                    <div style="border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                    <div>📸 फोटो लोड होत आहेत...</div>
                  </div>
                </div>
              \`;
              modal.style.display = 'block';

              try {
                // Fetch photos from API
                const response = await fetch(\`/api/loans/\${selectedLoanData.id}/photos\`);
                
                if (!response.ok) {
                  throw new Error(\`HTTP \${response.status}\`);
                }
                
                const photos = await response.json();
                
                // Extract photo URLs - API returns photos with 'url' field  
                photoUrls = [];
                if (Array.isArray(photos)) {
                  photoUrls = photos
                    .filter(photo => photo && photo.url)
                    .map(photo => photo.url);
                }

                // If no photos available, show message
                if (photoUrls.length === 0) {
                  photoContainer.innerHTML = \`
                    <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: white; text-align: center;">
                      <div>
                        <div style="font-size: 48px; margin-bottom: 20px;">📷</div>
                        <div style="font-size: 18px;">या कर्जासाठी कोणतेही फोटो उपलब्ध नाहीत</div>
                        <div style="margin-top: 10px; font-size: 14px; color: rgba(255,255,255,0.7);">Space दाबून बंद करा</div>
                      </div>
                    </div>
                  \`;
                  
                  // Hide navigation buttons
                  prevBtn.style.display = 'none';
                  nextBtn.style.display = 'none';
                  photoCounter.style.display = 'none';
                  return;
                }

                // Reset photo index
                currentPhotoIndex = 0;

                // Show/hide navigation buttons
                if (photoUrls.length > 1) {
                  prevBtn.style.display = 'block';
                  nextBtn.style.display = 'block';
                  photoCounter.style.display = 'block';
                } else {
                  prevBtn.style.display = 'none';
                  nextBtn.style.display = 'none';
                  photoCounter.style.display = 'none';
                }

                // Display first photo
                displayPhoto(currentPhotoIndex);
                
              } catch (error) {
                console.error('Photo fetch error:', error);
                photoContainer.innerHTML = \`
                  <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: white; text-align: center;">
                    <div>
                      <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                      <div style="font-size: 18px;">फोटो लोड करताना त्रुटी झाली</div>
                      <div style="margin-top: 10px; font-size: 14px; color: rgba(255,255,255,0.7);">कृपया पुन्हा प्रयत्न करा</div>
                    </div>
                  </div>
                \`;
                
                // Hide navigation buttons
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
                photoCounter.style.display = 'none';
              }
            }

            function displayPhoto(index) {
              if (!photoUrls || photoUrls.length === 0) return;

              const photoContainer = document.getElementById('photo-container');
              const photoCounter = document.getElementById('photo-counter');
              
              // Ensure index is within bounds
              if (index < 0) currentPhotoIndex = photoUrls.length - 1;
              else if (index >= photoUrls.length) currentPhotoIndex = 0;
              else currentPhotoIndex = index;

              const photoUrl = photoUrls[currentPhotoIndex];
              
              photoContainer.innerHTML = \`
                <img 
                  src="\${photoUrl}" 
                  alt="कर्ज फोटो" 
                  style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); cursor: zoom-in;" 
                  onclick="toggleFullscreen(this)"
                  onload="this.style.opacity='1'"
                  onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\"color: white; font-size: 18px; text-align: center;\\">📷 फोटो लोड करू शकले नाही</div>'"
                  style="opacity: 0; transition: opacity 0.3s ease;"
                />
              \`;

              // Update counter
              if (photoUrls.length > 1) {
                photoCounter.textContent = \`\${currentPhotoIndex + 1} / \${photoUrls.length}\`;
              }
            }

            function navigatePhoto(direction) {
              if (!photoUrls || photoUrls.length <= 1) return;
              
              const newIndex = currentPhotoIndex + direction;
              displayPhoto(newIndex);
            }

            function toggleFullscreen(img) {
              if (img.style.maxWidth === '100%') {
                img.style.maxWidth = '90%';
                img.style.maxHeight = '90%';
                img.style.cursor = 'zoom-in';
                img.style.transform = 'scale(1)';
              } else {
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.cursor = 'zoom-out';
                img.style.transform = 'scale(1.1)';
              }
            }

            function closePhotoModal() {
              const modal = document.getElementById('photo-modal');
              modal.style.display = 'none';
            }

            // Close modal when clicking outside
            document.addEventListener('click', function(event) {
              const modal = document.getElementById('photo-modal');
              if (event.target === modal) {
                closePhotoModal();
              }
            });
          </script>
        </body>
      </html>
    `;
  };

  const printReport = (reportData: any[]) => {
    // Use exact same function as Direct Print - no differences
    const selectedGroup = (groups as any[]).find(g => g.id === groupId);
    const groupName = selectedGroup?.name || 'सर्व गट';
    
    try {
      const printWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes,location=no,menubar=no,toolbar=no,status=no,fullscreen=yes');
      if (!printWindow) {
        toast({
          title: "त्रुटी",
          description: "पॉप-अप ब्लॉकर बंद करा आणि पुन्हा प्रयत्न करा",
          variant: "destructive",
        });
        return;
      }
      
      // Add cache-busting timestamp to force fresh content
      const timestamp = new Date().getTime();
      const cacheKey = Math.random().toString(36).substring(7);
      const htmlContent = generateReportHTML(reportData, groupName);
      
      // Clear any existing content and force new content with timestamp
      printWindow.document.open();
      printWindow.document.write(`<!-- Cache Buster: ${timestamp}-${cacheKey} -->\n${htmlContent}`);
      printWindow.document.close();
      
      // Add print functionality to the preview window
      const printFunction = () => {
        printWindow.print();
      };
      
      // Add a print button to the preview window
      const printButton = printWindow.document.createElement('button');
      printButton.innerHTML = '🖨️ प्रिंट करा';
      printButton.style.cssText = `
        position: fixed; 
        top: 10px; 
        right: 10px; 
        z-index: 1000; 
        background: #4CAF50; 
        color: white; 
        border: none; 
        padding: 10px 15px; 
        border-radius: 5px; 
        cursor: pointer; 
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      `;
      printButton.className = 'print-hide';
      printButton.onclick = printFunction;
      
      const closeButton = printWindow.document.createElement('button');
      closeButton.innerHTML = '❌ बंद करा';
      closeButton.style.cssText = `
        position: fixed; 
        top: 10px; 
        right: 120px; 
        z-index: 1000; 
        background: #f44336; 
        color: white; 
        border: none; 
        padding: 10px 15px; 
        border-radius: 5px; 
        cursor: pointer; 
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      `;
      closeButton.className = 'print-hide';
      closeButton.onclick = () => printWindow.close();
      
      printWindow.document.body.appendChild(printButton);
      printWindow.document.body.appendChild(closeButton);
      
      // Focus and maximize the print window
      printWindow.focus();
      
      // Try to maximize the window if supported
      try {
        if (printWindow.moveTo && printWindow.resizeTo) {
          printWindow.moveTo(0, 0);
          printWindow.resizeTo(screen.availWidth, screen.availHeight);
        }
      } catch (e) {
        // Ignore errors
      }
      
    } catch (error) {
      toast({
        title: "त्रुटी", 
        description: "रिपोर्ट प्रिंट करताना त्रुटी झाली",
        variant: "destructive",
      });
    }
  };
  
  return (
    <>
    <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    <div className="min-h-screen bg-gray-50">
      <MobileNav />
      <div className="lg:flex">
        <aside className="hidden lg:block lg:w-72 lg:fixed lg:inset-y-0 print:hidden">
          <Sidebar />
        </aside>
        <main className="flex-1 w-full lg:pl-72 pb-20 lg:pb-4">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-7xl">
        
        {/* Header - Mobile Responsive */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl shadow-md">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-0.5">कर्जदाराची यादी</h1>
                <p className="text-xs sm:text-sm text-gray-500">विविध प्रकारचे कर्जदार अहवाल तयार करा</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => safeNavigate('/')}
              className="hidden sm:flex self-end sm:self-auto border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              मुख्य पान
            </Button>
          </div>
          
          {/* Action Buttons - Moved to top */}
          <div className="flex flex-col sm:flex-row gap-2 print-hide">
            <Button 
              onClick={handleGenerateReport}
              className="flex-1 sm:flex-none h-12 sm:h-10 text-base sm:text-sm font-medium touch-manipulation px-6 py-3 sm:px-4 sm:py-2 rounded-lg active:scale-[0.98] transition-transform bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-sm"
              size="default"
              data-testid="button-generate-report"
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
            >
              <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
              <span>रिपोर्ट तयार करा</span>
            </Button>
            
            <Button 
              onClick={() => {
                const filteredLoans = getFilteredLoans;
                if (filteredLoans.length === 0) {
                  toast({
                    title: "माहिती आढळली नाही",
                    description: "निवडलेल्या निकषांसाठी कोणतीही माहिती सापडली नाही",
                    variant: "destructive",
                  });
                  return;
                }
                
                toast({
                  title: "प्रिंट सुरू करत आहे",
                  description: "मोबाईलसाठी अनुकूलित प्रिंट...",
                });
                
                // Direct print with same content as popup
                handleDirectPrint(filteredLoans);
              }}
              variant="outline"
              className="hidden sm:flex flex-1 sm:flex-none h-12 sm:h-10 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 text-base sm:text-sm font-medium touch-manipulation px-6 py-3 sm:px-4 sm:py-2 rounded-lg active:scale-[0.98] transition-transform"
              size="default"
              data-testid="button-direct-print"
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
            >
              <Printer className="mr-2 h-4 w-4 flex-shrink-0" />
              <span>डायरेक्ट प्रिंट</span>
            </Button>
            
            <Button 
              onClick={() => {
                const filteredLoans = getFilteredLoans;
                if (filteredLoans.length === 0) {
                  toast({
                    title: "माहिती आढळली नाही",
                    description: "निवडलेल्या निकषांसाठी कोणतीही माहिती सापडली नाही",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Prepare data for Excel export with ALL available columns
                const excelData = filteredLoans.map((loan: any, index: number) => {
                  // Get closure data for closing-wise reports
                  const closureData = (loanClosures as any[]).find((closure: any) => 
                    closure.loanId === loan.id
                  );
                  
                  const baseData = {
                    serialNo: index + 1,
                    borrowerName: loan.borrowerName || '',
                    mobileNumber: loan.borrowerMobile || '',
                    address: loan.borrowerAddress || '',
                    groupName: loan.group?.name || '',
                    loanNumber: loan.accountNumber || loan.loanNumber || loan.id.slice(-8) || '',
                    principalAmount: loan.principalAmount ? `₹${Number(loan.principalAmount).toLocaleString('en-IN')}` : '₹0',
                    loanDate: loan.loanDate ? new Date(loan.loanDate).toLocaleDateString('en-GB') : '',
                    maturityDate: loan.maturityDate ? new Date(loan.maturityDate).toLocaleDateString('en-GB') : '',
                    calculatedMaturityDate: loan.calculatedMaturityDate ? new Date(loan.calculatedMaturityDate).toLocaleDateString('en-GB') : '',
                    hasMaturity: loan.hasMaturity ? 'होय' : 'नाही',
                    maturityMonths: loan.maturityMonths || '',
                    interestRate: `${loan.interestRate || 0}% ${loan.interestRateType === 'monthly' ? 'मासिक' : 'वार्षिक'}`,
                    businessType: loan.businessType || '',
                    loanType: loan.loanType || '',
                    status: loan.status === 'active' ? 'सक्रिय' : 'बंद',
                    collateralDetails: loan.collateralDetails || '',
                    weight: loan.weight || '',
                    marketValue: loan.marketValue ? `₹${Number(loan.marketValue).toLocaleString('en-IN')}` : '',
                    documentDetails: loan.documentDetails || '',
                    specialConditions: loan.specialConditions || '',
                    otherInfo: loan.otherInfo || '',
                    createdAt: loan.createdAt ? new Date(loan.createdAt).toLocaleDateString('en-GB') : '',
                    updatedAt: loan.updatedAt ? new Date(loan.updatedAt).toLocaleDateString('en-GB') : ''
                  };
                  
                  // Add closure-specific data
                  if (closureData) {
                    return {
                      ...baseData,
                      closureDate: closureData.closureDate ? new Date(closureData.closureDate).toLocaleDateString('en-GB') : '',
                      totalInterest: closureData.totalInterest ? `₹${Number(closureData.totalInterest).toLocaleString('en-IN')}` : '₹0',
                      totalAmount: closureData.totalAmount ? `₹${Number(closureData.totalAmount).toLocaleString('en-IN')}` : '₹0',
                      paidAmount: closureData.paidAmount ? `₹${Number(closureData.paidAmount).toLocaleString('en-IN')}` : '₹0',
                      balance: closureData.balance ? `₹${Number(closureData.balance).toLocaleString('en-IN')}` : '₹0',
                      closureNotes: closureData.notes || ''
                    };
                  }
                  
                  return baseData;
                });
                
                // Define ALL possible columns
                const columns = [
                  { key: 'serialNo', header: 'अनुक्रमांक', width: 10 },
                  { key: 'borrowerName', header: 'कर्जदाराचे नाव', width: 20 },
                  { key: 'mobileNumber', header: 'मोबाईल नंबर', width: 15 },
                  { key: 'address', header: 'पत्ता', width: 25 },
                  { key: 'groupName', header: 'गट', width: 15 },
                  { key: 'loanNumber', header: 'कर्ज नंबर', width: 15 },
                  { key: 'principalAmount', header: 'मूळ रक्कम', width: 15 },
                  { key: 'loanDate', header: 'कर्ज दिनांक', width: 12 },
                  { key: 'maturityDate', header: 'मुदत दिनांक', width: 12 },
                  { key: 'calculatedMaturityDate', header: 'गणना केलेली मुदत', width: 15 },
                  { key: 'hasMaturity', header: 'निश्चित मुदत', width: 12 },
                  { key: 'maturityMonths', header: 'मुदत महिने', width: 12 },
                  { key: 'interestRate', header: 'व्याज दर', width: 15 },
                  { key: 'businessType', header: 'व्यवसाय प्रकार', width: 15 },
                  { key: 'loanType', header: 'कर्ज प्रकार', width: 15 },
                  { key: 'status', header: 'स्थिती', width: 10 },
                  { key: 'collateralDetails', header: 'वस्तूचा तपशील', width: 25 },
                  { key: 'weight', header: 'वजन', width: 10 },
                  { key: 'marketValue', header: 'बाजार मूल्य', width: 15 },
                  { key: 'documentDetails', header: 'कागदपत्रांचा तपशील', width: 25 },
                  { key: 'specialConditions', header: 'विशेष अटी', width: 20 },
                  { key: 'otherInfo', header: 'इतर माहिती', width: 20 },
                  { key: 'createdAt', header: 'तयार केले', width: 12 },
                  { key: 'updatedAt', header: 'अपडेट केले', width: 12 }
                ];
                
                // Add closure-specific columns if any closed loans exist
                if (excelData.some((row: any) => row.closureDate)) {
                  columns.push(
                    { key: 'closureDate', header: 'बंद दिनांक', width: 12 },
                    { key: 'totalInterest', header: 'एकूण व्याज', width: 15 },
                    { key: 'totalAmount', header: 'एकूण रक्कम', width: 15 },
                    { key: 'paidAmount', header: 'भरलेली रक्कम', width: 15 },
                    { key: 'balance', header: 'शिल्लक', width: 15 },
                    { key: 'closureNotes', header: 'बंद करण्याच्या नोट्स', width: 25 }
                  );
                }
                
                // Export to Excel with proper columns
                const success = exportToExcel({
                  filename: `कर्जदारांची_यादी_${activeTab}`,
                  sheetName: `${activeTab === 'date-wise' ? 'दिनांक निहाय' : activeTab === 'closing-wise' ? 'बंदी निहाय' : activeTab === 'name-wise' ? 'नाव निहाय' : 'मुदत निहाय'} रिपोर्ट`,
                  data: excelData,
                  columns: columns
                });
                
                if (success) {
                  toast({
                    title: "Excel फाइल डाउनलोड झाली",
                    description: `${filteredLoans.length} नोंदी सह Excel फाइल तयार झाली आहे`,
                  });
                } else {
                  toast({
                    title: "Excel Export अयशस्वी",
                    description: "कृपया पुन्हा प्रयत्न करा",
                    variant: "destructive",
                  });
                }
              }}
              variant="outline"
              className="hidden sm:flex flex-1 sm:flex-none h-12 sm:h-10 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 text-base sm:text-sm font-medium touch-manipulation px-6 py-3 sm:px-4 sm:py-2 rounded-lg active:scale-[0.98] transition-transform"
              size="default"
              data-testid="button-excel-export"
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
            >
              <Table className="mr-2 h-4 w-4 flex-shrink-0" />
              <span>Excel मध्ये Export करा</span>
            </Button>
          </div>
        </div>
        
        {/* Tab Navigation - Mobile Responsive */}
        <Card className="mb-6 border-2 border-indigo-100 shadow-sm rounded-xl overflow-hidden">
          <div className="grid grid-cols-4 sm:flex border-b">
            <button
              onClick={() => setActiveTab('date-wise')}
              className={`py-2.5 sm:py-3 px-1 sm:px-4 text-center font-semibold transition-all text-[11px] sm:text-base sm:flex-1 ${
                activeTab === 'date-wise'
                  ? 'border-b-3 border-indigo-600 text-white bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              <Calendar className="hidden sm:inline-block sm:mr-2 h-4 w-4" />
              डेट वाईज
            </button>
            <button
              onClick={() => setActiveTab('closing-wise')}
              className={`py-2.5 sm:py-3 px-1 sm:px-4 text-center font-semibold transition-all text-[11px] sm:text-base sm:flex-1 ${
                activeTab === 'closing-wise'
                  ? 'border-b-3 border-indigo-600 text-white bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              <Receipt className="hidden sm:inline-block sm:mr-2 h-4 w-4" />
              क्लोजिंग वाईज
            </button>
            <button
              onClick={() => setActiveTab('name-wise')}
              className={`py-2.5 sm:py-3 px-1 sm:px-4 text-center font-semibold transition-all text-[11px] sm:text-base sm:flex-1 ${
                activeTab === 'name-wise'
                  ? 'border-b-3 border-indigo-600 text-white bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              <Users className="hidden sm:inline-block sm:mr-2 h-4 w-4" />
              नेम वाईज
            </button>
            <button
              onClick={() => setActiveTab('maturity-wise')}
              className={`py-2.5 sm:py-3 px-1 sm:px-4 text-center font-semibold transition-all text-[11px] sm:text-base sm:flex-1 ${
                activeTab === 'maturity-wise'
                  ? 'border-b-3 border-indigo-600 text-white bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              <Calendar className="hidden sm:inline-block sm:mr-2 h-4 w-4" />
              मुदत संपलेले
            </button>
          </div>
        </Card>
        
        {/* Filters - Mobile Responsive */}
        <Card className="p-4 sm:p-6">
          <div className="space-y-4">
            {/* Common Group Filter */}
            <div>
              <Label htmlFor="group" className="text-sm sm:text-base">गट निवडा</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger id="group" className="text-sm sm:text-base">
                  <SelectValue placeholder="गट निवडा" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">सर्व गट</SelectItem>
                  {(groups as any[]).map(group => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Date Range - Mobile Responsive */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateFrom" className="text-sm sm:text-base">पासून तारीख</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="font-inter text-sm sm:text-base"
                />
              </div>
              <div>
                <Label htmlFor="dateTo" className="text-sm sm:text-base">पर्यंत तारीख</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="font-inter text-sm sm:text-base"
                />
              </div>
            </div>
            
            {/* Date-wise specific filters */}
            {activeTab === 'date-wise' && (
              <div>
                <Label>कर्ज स्थिती</Label>
                <RadioGroup value={dateWiseStatus} onValueChange={(value: any) => setDateWiseStatus(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="active" id="active" />
                    <Label htmlFor="active" className="font-normal">
                      फक्त सक्रिय कर्जे
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all" />
                    <Label htmlFor="all" className="font-normal">
                      सर्व कर्जे (बंद कर्जे हायलाईट)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            
            {/* Closing-wise specific filters */}
            {activeTab === 'closing-wise' && (
              <div>
                <Label>कर्ज स्थिती</Label>
                <RadioGroup value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="loan-date" id="loan-date" />
                    <Label htmlFor="loan-date" className="font-normal">
                      कर्ज दिनांक प्रमाणे
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="closure-date" id="closure-date" />
                    <Label htmlFor="closure-date" className="font-normal">
                      कर्ज बंद दिनांक प्रमाणे
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            
            {/* Name-wise specific filters */}
            {activeTab === 'name-wise' && (
              <div className="space-y-4">
                <div className="relative">
                  <Label htmlFor="borrower" className="text-lg text-gray-900 font-noto">कर्जदार निवडा * 🎯</Label>
                  <div className="relative">
                    <Input
                      ref={borrowerInputRef}
                      id="borrower"
                      value={borrowerSearchTerm}
                      onChange={(e) => {
                        const value = e.target.value;
                        setBorrowerSearchTerm(value);
                        setSelectedBorrowerName(value);
                        
                        // INSTANT SUGGESTIONS: Show immediately even with 1 character - Same as Loan Form
                        if (value.trim().length >= 1 && groupId && groupId !== "") {
                          setShowBorrowerSuggestions(true);
                          // Only reset selection if suggestions dropdown is not currently active
                          if (!showBorrowerSuggestions) {
                            setSelectedSuggestionIndex(-1);
                          }
                        } else {
                          setShowBorrowerSuggestions(false);
                          setSelectedSuggestionIndex(-1);
                        }
                      }}
                      onKeyDown={handleBorrowerKeyDown}
                      onFocus={() => {
                        // Only show suggestions if user has already typed something - Same as Loan Form
                        if (borrowerSearchTerm.trim().length >= 1 && groupId && groupId !== "") {
                          setShowBorrowerSuggestions(true);
                          setSelectedSuggestionIndex(-1);
                        }
                      }}
                      onBlur={(e) => {
                        // Delay hiding to allow clicks on suggestions - Same as Loan Form
                        setTimeout(() => {
                          setShowBorrowerSuggestions(false);
                          setSelectedSuggestionIndex(-1);
                        }, 200);
                      }}
                      className="text-lg h-14 border-2 border-gray-300 focus:border-indigo-600 bg-white font-noto mt-2"
                      placeholder={
                        !groupId || groupId === "" 
                          ? "🚫 पहिले ग्रुप निवडा..." 
                          : getUniqueBorrowers.length === 0 
                            ? "⚠️ या ग्रुपमध्ये कर्जदार नाही"
                            : "🔍 नाव टाइप करा... (कमीत कमी १ अक्षर)"
                      }
                      disabled={!groupId || groupId === "" || getUniqueBorrowers.length === 0}
                      autoComplete="off"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <button
                        type="button"
                        className="md:pointer-events-none focus:outline-none"
                        onClick={() => {
                          const isMobile = window.innerWidth < 768;
                          if (isMobile && borrowerSearchTerm.trim() && groupId && groupId !== "") {
                            setShowBorrowerSuggestions(!showBorrowerSuggestions);
                          }
                        }}
                      >
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showBorrowerSuggestions ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Enhanced Smart Suggestions Dropdown - Same as Loan Form */}
                  {showBorrowerSuggestions && borrowerSearchTerm.trim().length >= 1 && smartBorrowerSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border-2 border-indigo-300 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                      {smartBorrowerSuggestions.map((borrower: any, index: number) => (
                        <div
                          key={borrower.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectBorrowerSuggestion(borrower);
                          }}
                          className={`p-4 border-b border-gray-100 last:border-b-0 cursor-pointer transition-all duration-200 ${
                            selectedSuggestionIndex === index 
                              ? 'bg-indigo-100 border-indigo-300 shadow-md scale-[1.02] ring-2 ring-indigo-200' 
                              : 'hover:bg-indigo-50 hover:shadow-sm'
                          } active:bg-indigo-200 active:scale-[0.98]`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-lg font-semibold text-gray-900 font-noto">
                                {borrower.name}
                                {index === selectedSuggestionIndex && (
                                  <Check className="inline h-4 w-4 ml-2 text-indigo-600" />
                                )}
                              </div>
                              <div className="flex gap-3 text-base text-gray-600">
                                <span className="flex items-center text-indigo-600 font-semibold">
                                  💰 {borrower.loanCount} कर्ज{borrower.loanCount > 1 ? 'े' : ''}
                                </span>
                              </div>
                            </div>
                            <div className="text-green-600 text-xl font-bold">
                              →
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div>
                  <Label>कर्ज स्थिती</Label>
                  <RadioGroup value={nameWiseStatus} onValueChange={(value: any) => setNameWiseStatus(value)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="name-all" />
                      <Label htmlFor="name-all" className="font-normal">
                        सर्व कर्जे (बंद कर्जे हायलाईट)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="active" id="name-active" />
                      <Label htmlFor="name-active" className="font-normal">
                        फक्त सक्रिय कर्जे
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="closed" id="name-closed" />
                      <Label htmlFor="name-closed" className="font-normal">
                        फक्त बंद कर्जे
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {/* Date Filter Toggle and Options */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="date-filter-toggle"
                      checked={dateFilterEnabled}
                      onChange={(e) => setDateFilterEnabled(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                      autoComplete="off"
                    />
                    <Label htmlFor="date-filter-toggle" className="text-sm font-medium text-gray-700">
                      📅 तारीख फिल्टर वापरा (वैकल्पिक)
                    </Label>
                  </div>
                  
                  {dateFilterEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6 border-l-2 border-indigo-200 bg-indigo-50 p-4 rounded-lg">
                      <div>
                        <Label htmlFor="start-date" className="text-sm font-medium text-gray-700">
                          पासून तारीख
                        </Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date" className="text-sm font-medium text-gray-700">
                          पर्यंत तारीख
                        </Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2 text-xs text-gray-600 bg-white p-2 rounded border">
                        💡 <strong>सूचना:</strong> तारीख फिल्टर सक्षम असल्यास फक्त निवडलेल्या तारीख श्रेणीमधील कर्जे दर्शविली जातील. 
                        अन्यथा त्या व्यक्तीच्या सर्व कर्जा दर्शविल्या जातील.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Maturity-wise specific filters */}
            {activeTab === 'maturity-wise' && (
              <>
                <div>
                  <Label>मुदत प्रकार निवडा (एकापेक्षा जास्त निवडू शकता)</Label>
                  <div className="space-y-3 mt-2">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="include-specific" 
                        checked={includeSpecificPeriod}
                        onChange={(e) => setIncludeSpecificPeriod(e.target.checked)}
                        className="rounded border-gray-300"
                        autoComplete="off"
                      />
                      <Label htmlFor="include-specific" className="font-normal">
                        निश्चित मुदतीसाठी (फक्त स्पेशल मुदत)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="include-future" 
                        checked={includeFutureMaturity}
                        onChange={(e) => setIncludeFutureMaturity(e.target.checked)}
                        className="rounded border-gray-300"
                        autoComplete="off"
                      />
                      <Label htmlFor="include-future" className="font-normal">
                        भविष्यातील मेच्योरिटी फिल्टर (आगामी कालावधी)
                      </Label>
                    </div>
                    <div className="text-xs text-gray-600 bg-indigo-50 p-2 rounded border">
                      💡 <strong>सूचना:</strong> दोन्ही checkbox select करून specific period वाले borrowers च्या future maturity पाहू शकता
                    </div>
                  </div>
                </div>
                
                {includeFutureMaturity && (
                  <div>
                    <Label>⏰ भविष्यातील कालावधी निवडा</Label>
                    <RadioGroup value={futureMaturityPeriod} onValueChange={(value: any) => setFutureMaturityPeriod(value)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="1month" id="future-1month" />
                        <Label htmlFor="future-1month" className="font-normal">
                          1 महिना - पुढच्या महिन्यात
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="3months" id="future-3months" />
                        <Label htmlFor="future-3months" className="font-normal">
                          3 महिने - पुढच्या तीन महिन्यात
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="6months" id="future-6months" />
                        <Label htmlFor="future-6months" className="font-normal">
                          6 महिने - पुढच्या सहा महिन्यात
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="1year" id="future-1year" />
                        <Label htmlFor="future-1year" className="font-normal">
                          1 वर्ष - पुढच्या वर्षभरात
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
                
                <div>
                  <Label>कर्ज स्थिती</Label>
                  <div className="text-sm text-gray-600 bg-green-50 p-2 rounded border">
                    ✅ <strong>सूचना:</strong> मुदतवाईज रिपोर्ट फक्त सक्रिय कर्जांसाठी आहे
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
        
        {/* Data Display Section with Pagination */}
        {totalItems > 0 ? (
          <Card className="mt-6 p-3 sm:p-6 md:p-8 border-2 border-indigo-100 shadow-sm rounded-xl">
            {/* Pagination Info */}
            <div className="mb-3 flex justify-between items-center">
              <div className="text-xs sm:text-sm text-indigo-700 font-medium bg-indigo-50 px-3 py-1.5 rounded-lg">
                {totalItems} पैकी {startItem}-{endItem} नोंदी
              </div>
              <div className="text-xs sm:text-sm text-indigo-600 font-medium">
                पान {currentPage} / {totalPages}
              </div>
            </div>

            {/* Table Display - All 7 columns visible on mobile with horizontal scroll */}
            <div className="overflow-x-auto sm:overflow-x-visible border border-indigo-200 rounded-lg -mx-1 sm:mx-0">
              <table className="w-full border-collapse min-w-[700px] sm:min-w-0">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-600 to-indigo-700">
                    <th className="border border-indigo-500 p-2 md:p-3 text-center text-xs sm:text-sm md:text-base font-semibold text-white">अ.क्र.</th>
                    <th className="border border-indigo-500 p-2 md:p-3 text-center text-xs sm:text-sm md:text-base font-semibold text-white">तारीख</th>
                    <th className="border border-indigo-500 p-2 md:p-3 text-right text-xs sm:text-sm md:text-base font-semibold text-white">रक्कम</th>
                    <th className="border border-indigo-500 p-2 md:p-3 text-left text-xs sm:text-sm md:text-base font-semibold text-white">नाव</th>
                    <th className="border border-indigo-500 p-2 md:p-3 text-center text-xs sm:text-sm md:text-base font-semibold text-white">खाते नं</th>
                    <th className="border border-indigo-500 p-2 md:p-3 text-left text-xs sm:text-sm md:text-base font-semibold text-white">तपशील</th>
                    <th className="border border-indigo-500 p-2 md:p-3 text-center text-xs sm:text-sm md:text-base font-semibold text-white">वजन</th>
                  </tr>
                </thead>
                <tbody>
                  {getPaginatedData.map((loan: any, index: number) => {
                    const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                    const isClosedLoan = loan.status === 'closed';
                    const loanDate = new Date(loan.loanDate);
                    const shortDate = `${String(loanDate.getDate()).padStart(2, '0')}/${String(loanDate.getMonth() + 1).padStart(2, '0')}/${String(loanDate.getFullYear()).slice(-2)}`;
                    
                    return (
                      <tr 
                        key={loan.id} 
                        className={`${isClosedLoan ? 'bg-red-50 text-red-800' : index % 2 === 0 ? 'bg-white' : 'bg-indigo-50/30'} hover:bg-indigo-50`}
                      >
                        <td className="border border-indigo-100 p-1.5 sm:p-2 md:p-3 text-center text-xs sm:text-sm md:text-base">{globalIndex}</td>
                        <td className="border border-indigo-100 p-1.5 sm:p-2 md:p-3 text-center text-xs sm:text-sm md:text-base whitespace-nowrap">{shortDate}</td>
                        <td className="border border-indigo-100 p-1.5 sm:p-2 md:p-3 text-right text-xs sm:text-sm md:text-base font-medium whitespace-nowrap">{Math.round(loan.principalAmount).toLocaleString('en-IN')}</td>
                        <td className="border border-indigo-100 p-1.5 sm:p-2 md:p-3 text-xs sm:text-sm md:text-base">
                          <span className="sm:hidden">{loan.borrowerName.length > 20 ? loan.borrowerName.substring(0, 20) + '...' : loan.borrowerName}</span>
                          <span className="hidden sm:inline">{loan.borrowerName}</span>
                          {isClosedLoan && <span className="text-red-600 ml-1">(बंद)</span>}
                        </td>
                        <td className="border border-indigo-100 p-1.5 sm:p-2 md:p-3 text-center text-xs sm:text-sm md:text-base">
                          {(loan.accountNumber || loan.id.slice(0, 5)).toString().substring(0, 7)}
                        </td>
                        <td className="border border-indigo-100 p-1.5 sm:p-2 md:p-3 text-xs sm:text-sm md:text-base">
                          {loan.loanType === 'विनातारण' ? ([loan.specialConditions, loan.documentDetails, loan.otherInfo].filter((v: string) => v && v !== '—' && v.trim() !== '').join(' | ') || '—') : (loan.itemDescription || loan.collateralDetails || 'सोन्याचे दागिने')}
                        </td>
                        <td className="border border-indigo-100 p-1.5 sm:p-2 md:p-3 text-center text-xs sm:text-sm md:text-base">
                          {loan.loanType === 'विनातारण' ? '—' : (loan.weight || '0')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                  >
                    पहिला
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                  >
                    मागे
                  </Button>
                </div>

                {/* Page Numbers */}
                <div className="flex items-center gap-1 flex-wrap">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`text-xs w-8 h-8 ${currentPage === pageNum ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                  >
                    पुढे
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                  >
                    शेवटचा
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ) : (
          /* Empty State */
          <Card className="mt-6 p-4 sm:p-6 border-2 border-indigo-100 shadow-sm rounded-xl">
            <div className="text-center text-indigo-400">
              <FileText className="mx-auto h-8 sm:h-12 w-8 sm:w-12 mb-3 text-indigo-300" />
              <p className="text-sm sm:text-base text-indigo-500">रिपोर्ट पाहण्यासाठी वरील फिल्टर निवडा</p>
            </div>
          </Card>
        )}
        
      </div>
        </main>
      </div>
    </div>
    </>
  );
}